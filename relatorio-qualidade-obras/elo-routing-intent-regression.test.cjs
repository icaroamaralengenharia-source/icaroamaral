const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); }
  };
}

function element() {
  return {
    dataset: {}, style: {}, children: [], textContent: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    appendChild(child) { this.children.push(child); return child; },
    setAttribute() {}, getAttribute() { return null; }, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}

function token(subject = 'intent-regression-synthetic-user') {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({
    iss: 'https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1',
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: subject
  }) + '.fixture';
}

function load(options = {}) {
  const calls = [];
  const document = {
    body: element(), documentElement: element(), readyState: 'complete',
    createElement: element, createDocumentFragment: element,
    addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, getElementById() { return null; }
  };
  const window = {
    ELO_SKIP_AUTO_WIDGET: true, ELO_DISABLE_AUTOFOCUS: true, ELO_PRODUCT_MODE: true,
    location: { hostname: 'localhost', protocol: 'http:', pathname: '/elo.html', hash: '', search: '' },
    localStorage: storage(), sessionStorage: storage(), document,
    navigator: { onLine: true, userAgent: 'synthetic-node-test' },
    crypto: { randomUUID: () => 'intent-regression-synthetic-id' },
    addEventListener() {}, removeEventListener() {},
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; }, clearTimeout() {},
    atob(value) { return Buffer.from(String(value), 'base64').toString('binary'); },
    btoa(value) { return Buffer.from(String(value), 'binary').toString('base64'); },
    open() { return null; },
    fetch(url, config = {}) {
      calls.push({ url: String(url), config });
      if (options.fetch) return options.fetch(url, config);
      throw new Error('unexpected_network_in_synthetic_intent_test');
    }
  };
  Object.assign(window, options.window || {});
  window.window = window;
  const context = vm.createContext({
    window, document, navigator: window.navigator, localStorage: window.localStorage,
    sessionStorage: window.sessionStorage, console, Date, Math, URLSearchParams,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout, fetch: window.fetch
  });
  for (const name of ['elo-command-bridge.js', 'elo-assistente.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, name), 'utf8'), context, { filename: name });
  }
  return { api: window.EloAssistente, calls, window };
}

function prepareStockRelease(options = {}) {
  const bridgeCalls = [];
  const environment = load({ window: {
    ELO_PROJECT_ID: 'synthetic-project-a', ELO_WORK_ID: 'synthetic-work-a',
    ELO_AUTH_TOKEN: options.anonymous ? '' : token(),
    ELO_AUTH_CONTEXT: options.anonymous ? {} : {
      userId: 'intent-regression-synthetic-user', institutionId: 'synthetic-institution-a',
      companyId: 'synthetic-company-a', projectId: 'synthetic-project-a'
    },
    StockAiCompositionEngine: {
      parseRequest() { return { services: [{ service: 'Calcada', serviceType: 'calcada', quantity: 24, unit: 'm2' }] }; },
      calculateMultipleServices() { return {
        predictedItems: [
          { name: 'Cimento', unit: 'saco', quantity: 2 }, { name: 'Areia', unit: 'm3', quantity: 1 },
          { name: 'Brita', unit: 'm3', quantity: 1 }, { name: 'Piso ceramico', unit: 'm2', quantity: 24 }
        ],
        predictions: [{ composition: { source: 'SINAPI', code: '94992', unit: 'm2', isRealComposition: true, inputs: [{ name: 'Cimento', coefficient: 1 }] } }]
      }; }
    },
    ObraReportOperationalStock: {
      getAlmoxBalances() { return [
        { itemId: 'synthetic-cement', name: 'Cimento', unit: 'saco', balance: 10, realBalance: 10 },
        { itemId: 'synthetic-sand', name: 'Areia', unit: 'm3', balance: 5, realBalance: 5 },
        { itemId: 'synthetic-gravel', name: 'Brita', unit: 'm3', balance: 5, realBalance: 5 },
        { itemId: 'synthetic-floor', name: 'Piso ceramico', unit: 'm2', balance: 40, realBalance: 40 }
      ]; },
      createConfirmedExit(payload) {
        bridgeCalls.push(payload);
        return { ok: true, after: [], movements: payload.items.map((item, index) => ({ id: 'synthetic-movement-' + index, stockItemId: item.stockItemId, quantity: item.releaseQuantity, unit: item.unit })) };
      }
    }
  } });
  const preview = environment.api.buildResponseForTest('O pedreiro vai executar uma calcada de 8 x 3 m. Qual material completo preciso liberar?');
  assert.match(preview.fullAnswer, /Sugestao de saida/i);
  const pending = JSON.parse(environment.window.sessionStorage.getItem('obraReport.elo.pendingStockRelease'));
  assert.equal(pending.status, 'pending_confirmation');
  assert.equal(bridgeCalls.length, 0);
  return { ...environment, bridgeCalls, pending };
}

test('intent regression: social fast path preserves both brain markers', () => {
  const { api, calls } = load();
  for (const message of ['Olá', 'Oi', 'Tudo bem', 'Obrigado']) {
    const response = api.buildResponseForTest(message);
    assert.equal(response.brain, 'conversational', message);
    assert.equal(response.brainMarker, 'conversational', message);
  }
  assert.equal(calls.length, 0);
});

test('intent regression: negative RDO clause does not steal an affirmative Stock command', () => {
  const { api, calls } = load();
  const request = api.detectCommandBridgeRequestForTest('Registrar entrada de 1 unidade no Stock Full para o item ITEM SINTETICO. Não executar saída, RDO ou Inspeção.');
  assert.equal(request.module, 'stock_full');
  assert.equal(request.action, 'stock_entry');
  assert.equal(calls.length, 0);
});

test('intent regression: affirmative RDO keeps priority when another operation is prohibited', () => {
  const { api, calls } = load();
  const request = api.detectCommandBridgeRequestForTest('Atualize o RDO da OBRA SINTETICA para hoje. Não alterar o estoque.');
  assert.equal(request.module, 'obrareport_rdo');
  assert.equal(request.action, 'rdo.update.preview');
  assert.equal(calls.length, 0);
});

test('intent regression: an explicitly prohibited RDO document is not executed', () => {
  const { api, calls } = load();
  assert.equal(api.detectCommandBridgeRequestForTest('Não gerar PDF do RDO.'), null);
  assert.equal(calls.length, 0);
});

test('intent regression: inspection PDF remains in the inspection domain', () => {
  const { api, calls } = load();
  const request = api.detectCommandBridgeRequestForTest('Gere o PDF da vistoria');
  assert.equal(request.module, 'inspection');
  assert.equal(request.action, 'inspection.generatePdf');
  const nonconformity = api.detectCommandBridgeRequestForTest('Registre uma não conformidade na vistoria.');
  assert.equal(nonconformity.module, 'inspection');
  assert.equal(nonconformity.action, 'inspection.openNCs');
  assert.equal(calls.length, 0);
});

test('intent regression: unit or apartment wording does not route a budget PDF to inspection', () => {
  const { api, calls } = load();
  for (const message of ['Gere o PDF do orçamento por unidade.', 'Gere o PDF do orçamento do apartamento 101.', 'Gere o PDF do orçamento do apto 101.']) {
    assert.equal(api.detectCommandBridgeRequestForTest(message), null, message);
  }
  assert.equal(calls.length, 0);
});

test('intent regression: finite PDF domain matrix covers every inspection context token', () => {
  const strong = ['vistoria', 'vistorias'];
  const generic = ['NC', 'NCs', 'não conformidade', 'não conformidades', 'unidade', 'apartamento', 'apto'];
  const contexts = strong.concat(generic);
  const { api, calls } = load();
  for (const context of contexts) {
    const isInspection = strong.includes(context);
    for (const [message, expectedModule, expectedAction] of [
      ['Gere o PDF de ' + context + '.', isInspection ? 'inspection' : null, 'inspection.generatePdf'],
      ['Gere o PDF do orçamento com ' + context + '.', null, null],
      ['Gere o PDF do relatório de ' + context + '.', isInspection ? 'inspection' : null, 'inspection.generatePdf'],
      ['Gere o PDF do RDO com ' + context + '.', 'obrareport_rdo', 'rdo.generateDocument']
    ]) {
      const request = api.detectCommandBridgeRequestForTest(message);
      if (expectedModule === null) assert.equal(request, null, message);
      else {
        assert.equal(request && request.module, expectedModule, message);
        assert.equal(request.action, expectedAction, message);
      }
    }
  }
  assert.equal(calls.length, 0);
});

test('intent regression: municipal adapter alone does not assign generic documents to a municipality', () => {
  const { api, calls } = load({ window: { EloMunicipalActionAdapter: {} } });
  assert.equal(api.detectCommandBridgeRequestForTest('Quais documentos temos?'), null);
  assert.equal(api.detectCommandBridgeRequestForTest('Gere o PDF'), null);
  assert.equal(calls.length, 0);
});

test('intent regression: explicit municipal scope permits its catalog without changing scope', () => {
  const { api, calls, window } = load({ window: { ELO_MUNICIPAL_CONTEXT: { institutionId: 'synthetic-municipality-only' } } });
  const before = JSON.stringify(window.ELO_MUNICIPAL_CONTEXT);
  const request = api.detectCommandBridgeRequestForTest('Quais documentos temos?');
  assert.equal(request.module, 'municipal');
  assert.equal(request.action, 'archive.documents.list');
  assert.equal(JSON.stringify(window.ELO_MUNICIPAL_CONTEXT), before);
  assert.equal(calls.length, 0);
});

test('intent regression: active attachment takes precedence over a contextual municipal catalog', () => {
  const { api, calls } = load({ window: { ELO_MUNICIPAL_CONTEXT: { institutionId: 'synthetic-municipality-only' } } });
  api.rememberActiveDocumentForTest([{ fileName: 'synthetic.pdf', text: 'Only synthetic attachment content.', documentId: 'synthetic-document-only' }]);
  assert.equal(api.detectCommandBridgeRequestForTest('Quais documentos temos?'), null);
  assert.equal(calls.length, 0);
});

test('intent regression: project decisions are updates rather than generic memory recall', () => {
  const { api, calls } = load();
  assert.equal(api.buildResponseForTest('Estamos desenvolvendo o ELO Core.').sessionIntent, 'project_memory_save');
  const decision = api.buildResponseForTest('Decidimos que a memória de projeto fica separada do perfil.');
  assert.equal(decision.sessionIntent, 'project_memory_update');
  assert.match(api.buildResponseForTest('O que decidimos ontem?').fullAnswer, /mem[oó]ria de projeto fica separada do perfil/i);
  assert.equal(calls.length, 0);
});

test('intent regression: creating a budget does not create a project memory', () => {
  const { api, calls } = load();
  const response = api.buildResponseForTest('Quero criar um orçamento residencial para casa térrea de 70m2 em Salvador/BA, padrão médio, 1 pavimento, obra completa.');
  assert.equal(response.brain, 'budget');
  assert.notEqual(response.sessionIntent, 'project_memory_save');
  assert.ok(response.budgetOrchestratorV2);
  assert.equal(calls.length, 0);
});

for (const hasProject of [false, true]) {
  test('intent regression: an explicit budget continuation keeps priority with project=' + hasProject, () => {
    const { api, calls } = load();
    if (hasProject) assert.equal(api.buildResponseForTest('Estamos desenvolvendo o PROJETO SINTETICO.').sessionIntent, 'project_memory_save');
    const budget = api.buildResponseForTest('Quero orçamento residencial de casa térrea 70m2 em Salvador/BA, padrão médio, 1 pavimento, obra completa.');
    assert.equal(budget.brain, 'budget');
    const continuation = api.buildResponseForTest('Continuar meu orçamento');
    assert.equal(continuation.brain, 'budget');
    assert.notEqual(continuation.sessionIntent, 'project_memory_continue');
    assert.ok(continuation.budgetOrchestratorV2);
    assert.equal(calls.length, 0);
  });

  test('intent regression: bare continuation preserves the legacy contract with project=' + hasProject, () => {
    const { api, calls, window } = load();
    if (hasProject) assert.equal(api.buildResponseForTest('Estamos desenvolvendo o PROJETO SINTETICO.').sessionIntent, 'project_memory_save');
    assert.equal(api.buildResponseForTest('Quero orçamento residencial de casa térrea 70m2 em Salvador/BA, padrão médio, 1 pavimento, obra completa.').brain, 'budget');
    const keys = ['elo_core_project_memory_v1', 'elo_long_term_memory_v1', 'obrareport_elo_memorias_importantes_v1'];
    const before = keys.map((key) => window.localStorage.getItem(key));
    const continuation = api.buildResponseForTest('Continuar.');
    assert.equal(continuation.brain, 'conversational');
    assert.equal(continuation.sessionIntent, 'project_memory_continue');
    assert.deepEqual(keys.map((key) => window.localStorage.getItem(key)), before);
    assert.equal(calls.length, 0);
  });
}

test('intent regression: explicit report opening wins over a photo analysis prompt', () => {
  const { api, calls } = load();
  const response = api.buildResponseForTest('Analise esta foto e abra o relatorio para revisao.');
  assert.equal(response.eloCoreMode, 'tool');
  assert.equal(response.eloCoreTool.id, 'relatorio');
  assert.equal(calls.length, 0);
});

for (const [label, change] of [
  ['project', (window) => { window.ELO_PROJECT_ID = 'synthetic-project-b'; window.ELO_AUTH_CONTEXT.projectId = 'synthetic-project-b'; }],
  ['work', (window) => { window.ELO_WORK_ID = 'synthetic-work-b'; }],
  ['institution', (window) => { window.ELO_AUTH_CONTEXT.institutionId = 'synthetic-institution-b'; }],
  ['company', (window) => { window.ELO_AUTH_CONTEXT.companyId = 'synthetic-company-b'; }],
  ['user', (window) => { window.ELO_AUTH_CONTEXT.userId = 'synthetic-user-b'; }],
  ['token subject', (window) => { window.ELO_AUTH_TOKEN = token('synthetic-user-b'); }],
  ['logout', (window) => { window.ELO_AUTH_TOKEN = ''; window.ELO_AUTH_CONTEXT = {}; }]
]) {
  test('intent regression: stock release blocks a changed ' + label + ' before writing', () => {
    const { api, window, bridgeCalls, calls } = prepareStockRelease();
    change(window);
    const answer = api.buildResponseForTest('Confirme a saida.');
    assert.equal(answer.sessionIntent, 'stock_release_context_changed');
    assert.equal(bridgeCalls.length, 0);
    assert.equal(calls.length, 0);
    assert.equal(window.sessionStorage.getItem('obraReport.elo.pendingStockRelease'), null);
  });
}

test('intent regression: stock release keeps same-context confirmation idempotent', () => {
  const { api, bridgeCalls, pending, calls, window } = prepareStockRelease();
  assert.equal(pending.binding.version, 1);
  assert.equal(pending.binding.institutionId, 'synthetic-institution-a');
  assert.equal(pending.binding.userId, 'intent-regression-synthetic-user');
  assert.equal(pending.binding.tokenSubject, 'intent-regression-synthetic-user');
  assert.equal(api.buildResponseForTest('Confirme a saida.').sessionIntent, 'stock_release_confirmed');
  assert.equal(api.buildResponseForTest('Confirme a saida.').sessionIntent, 'stock_release_idempotent');
  assert.equal(bridgeCalls.length, 1);
  window.ELO_AUTH_CONTEXT.institutionId = 'synthetic-institution-b';
  const switched = api.buildResponseForTest('Confirme a saida.');
  assert.equal(switched.sessionIntent, 'stock_release_context_changed');
  assert.doesNotMatch(switched.fullAnswer, /synthetic-project-a|synthetic-cement|Saldo depois/i);
  assert.equal(bridgeCalls.length, 1);
  assert.equal(calls.length, 0);
});

test('intent regression: a legacy stock release without binding requires a new preview', () => {
  const sessionStorage = storage();
  sessionStorage.setItem('obraReport.elo.pendingStockRelease', JSON.stringify({
    id: 'synthetic-legacy-release', status: 'pending_confirmation', createdAt: Date.now(),
    projectId: 'synthetic-project-a', workId: 'synthetic-work-a', releaseItems: []
  }));
  let writes = 0;
  const { api, calls } = load({ window: {
    sessionStorage, ELO_PROJECT_ID: 'synthetic-project-a', ELO_WORK_ID: 'synthetic-work-a',
    ObraReportOperationalStock: { createConfirmedExit() { writes += 1; return { ok: true }; } }
  } });
  const response = api.buildResponseForTest('Confirme a saida.');
  assert.equal(response.sessionIntent, 'stock_release_context_changed');
  assert.equal(writes, 0);
  assert.equal(calls.length, 0);
});

test('intent regression: logging in after an anonymous local stock preview invalidates it', () => {
  const { api, window, bridgeCalls, calls } = prepareStockRelease({ anonymous: true });
  window.ELO_AUTH_TOKEN = token();
  window.ELO_AUTH_CONTEXT = { userId: 'intent-regression-synthetic-user', institutionId: 'synthetic-institution-a', companyId: 'synthetic-company-a' };
  assert.equal(api.buildResponseForTest('Confirme a saida.').sessionIntent, 'stock_release_context_changed');
  assert.equal(bridgeCalls.length, 0);
  assert.equal(calls.length, 0);
});

test('intent regression: unauthenticated Observer keeps the auth error and performs no request', async () => {
  const { api, calls } = load();
  const answer = await api.requestObraAttentionForTest('O que precisa da minha atenção hoje?');
  assert.match(answer, /Entre no ELO/i);
  assert.doesNotMatch(answer, /Qualidade dos dados: boa|nenhuma prioridade critica/i);
  assert.equal(calls.length, 0);
});

test('intent regression: Observer backend errors are not replaced by an empty local success', async () => {
  for (const [error, expected] of [
    ['authentication_required', /Sua sessão não foi enviada/i],
    ['invalid_session', /Sua sessão expirou/i],
    ['project_required', /Nenhuma obra foi selecionada/i],
    ['offline', /Nao consegui consultar/i]
  ]) {
    const accessToken = token();
    const { api, calls } = load({
      window: { ELO_AUTH_TOKEN: accessToken, ELO_PROJECT_ID: 'synthetic-project-only' },
      fetch(url, config) {
        assert.match(String(url), /\/api\/elo\/obra\/attention\?projectId=synthetic-project-only$/);
        assert.equal(config.method, 'GET');
        assert.equal(config.headers.Authorization, 'Bearer ' + accessToken);
        return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false, error }) });
      }
    });
    const answer = await api.requestObraAttentionForTest('O que precisa da minha atenção hoje?');
    assert.match(answer, expected, error);
    assert.doesNotMatch(answer, /Qualidade dos dados: boa|nenhuma prioridade critica/i);
    assert.equal(calls.length, 1);
  }
});

test('intent regression: Observer can use a genuine local source after a backend failure', async () => {
  const { api } = load({
    window: {
      ELO_AUTH_TOKEN: token(),
      EloTodayWorkCore: { buildTodayWorkCore() { return {
        summary: { text: 'Synthetic local RDO summary.' }, priorities: [],
        dataQuality: { level: 'low', missingSources: ['stockBalances'], sourcesUsed: { rdos: true } }
      }; } }
    },
    fetch() { return Promise.resolve({ ok: false, json: () => Promise.resolve({ ok: false, error: 'offline' }) }); }
  });
  const answer = await api.requestObraAttentionForTest('O que precisa da minha atenção hoje?');
  assert.match(answer, /Synthetic local RDO summary/);
  assert.match(answer, /Qualidade dos dados: baixa/);
  assert.match(answer, /stockBalances/);
  assert.doesNotMatch(answer, /Qualidade dos dados: boa|nenhuma prioridade critica/i);
});
