const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function storage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); }
  };
}

function element(tag) {
  const classes = new Set();
  return {
    tagName: String(tag || '').toUpperCase(), style: {}, dataset: {}, children: [],
    className: '', textContent: '', value: '',
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { const enabled = force === undefined ? !classes.has(name) : !!force; enabled ? classes.add(name) : classes.delete(name); return enabled; }
    },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    addEventListener() {}, remove() {},
    setAttribute(name, value) { this[name] = String(value); },
    getAttribute(name) { return this[name] || ''; },
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}

function loadBudget(options = {}) {
  const localStorage = storage();
  const sessionStorage = storage();
  const document = {
    readyState: 'complete', body: element('body'), createElement: element,
    createDocumentFragment() { return element('fragment'); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }
  };
  const noNetwork = () => { throw new Error('budget_regression_must_not_use_network'); };
  const immediate = (callback) => { if (typeof callback === 'function') callback(); return 0; };
  const navigator = { userAgent: 'node-budget-regression' };
  const window = {
    ELO_SKIP_AUTO_WIDGET: true, ELO_DISABLE_AUTOFOCUS: true, ELO_PRODUCT_MODE: true,
    location: { hostname: 'localhost', protocol: 'http:', pathname: '/elo.html', search: '', hash: '' },
    document, navigator, localStorage, sessionStorage, fetch: noNetwork,
    crypto: { randomUUID: () => 'budget-fixture-id' },
    addEventListener() {}, removeEventListener() {}, open() { return null; },
    setTimeout: immediate, clearTimeout() {},
    atob(value) { return Buffer.from(String(value), 'base64').toString('binary'); },
    btoa(value) { return Buffer.from(String(value), 'binary').toString('base64'); },
    URL: { createObjectURL() { return 'blob:budget-fixture'; }, revokeObjectURL() {} },
    ...options
  };
  window.window = window;
  const context = { window, globalThis: window, document, navigator, console, Date, Math, URLSearchParams, Blob, fetch: noNetwork, setTimeout: immediate, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'elo-assistente.js'), 'utf8'), context, { filename: 'elo-assistente.js' });
  return window.EloAssistente;
}

function wall(elo) {
  elo.buildResponseForTest('Parede de bloco ceramico');
  return elo.buildResponseForTest('20 metros por 2,80, bloco 14x19x29, com mao de obra, Salvador/BA');
}

function render(elo, response) {
  assert.ok(response.pdfAction && response.pdfAction.budgetDocumentData);
  const data = elo.buildBudgetV2ProfessionalPdfDataForTest(response.pdfAction.budgetDocumentData);
  return { data, html: elo.buildProfessionalPdfDocumentForTest(data.record, data.context) };
}

test('budget regression: bare PDF reuses the current wall and retains its quantities', () => {
  const elo = loadBudget();
  const original = wall(elo);
  const current = elo.buildResponseForTest('pdf');
  assert.equal(current.pdfAction.type, 'budget_v2_professional_pdf');
  assert.equal(current.pdfAction.budgetId, original.pdfAction.budgetId);
  assert.equal(current.pdfAction.budgetDocumentData.documentType, 'wall');
  assert.equal(current.pdfAction.budgetDocumentData.facts.builtAreaM2, '56,00 m2');
  assert.ok(current.fullAnswer.length < 180);
  assert.match(current.fullAnswer, /Preço pendente de composição SINAPI\/ORSE, BDI e mês-base/);
});

test('budget regression: bare PDF does not create a budget without active context', () => {
  const response = loadBudget().buildResponseForTest('pdf');
  assert.ok(!response.pdfAction);
});

test('budget regression: measured Unicode wall keeps dimensions through city and PDF follow-ups', () => {
  const elo = loadBudget();
  const initial = elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  assert.equal(initial.sessionIntent, 'budget_v2_wall_quantities');
  assert.match(initial.fullAnswer, /Area da parede: 30,00 m2/);
  const city = elo.buildResponseForTest('Vitória da Conquista/BA');
  assert.match(city.fullAnswer, /Area da parede: 30,00 m2/);
  assert.match(city.fullAnswer, /Cidade\/UF: Vit[oó]ria da Conquista\/BA/);
  const pdf = elo.buildResponseForTest('faça');
  assert.equal(pdf.pdfAction.budgetDocumentData.documentType, 'wall');
  assert.equal(pdf.pdfAction.budgetDocumentData.facts.builtAreaM2, '30,00 m2');
  assert.match(pdf.fullAnswer, /Preço pendente/);
});

test('budget regression: explicit square metre symbol retains the isolated service quantity', () => {
  const elo = loadBudget();
  const response = elo.buildResponseForTest('Quero um orçamento preliminar para 100 m² de alvenaria com bloco cerâmico, em Vitória da Conquista/BA.');
  assert.equal(response.sessionIntent, 'budget_v2_isolated_service');
  assert.match(response.fullAnswer, /Quantidade: 100 m2/);
  assert.equal(response.budgetOrchestratorV2.budgetPackage.quantities[0].quantity, 100);
  assert.equal(response.pdfAction.budgetDocumentData.facts.builtAreaM2, 100);
  assert.ok(!response.eloBudgetRouteContext);
});

test('budget regression: wall PDF preserves its title, scope and unpriced status', () => {
  const elo = loadBudget();
  const { data, html } = render(elo, wall(elo));
  assert.equal(data.record.titulo, 'Orçamento preliminar — Parede de bloco cerâmico');
  assert.match(html, /<h1>Orçamento preliminar — Parede de bloco cerâmico<\/h1>/);
  assert.doesNotMatch(html, /<h1>ORÇAMENTO RESIDENCIAL<\/h1>/);
  assert.match(html, /Área da parede/);
  assert.match(html, /56,00 m²/);
  assert.match(html, /14x19x29/);
  assert.match(html, /Mao de obra: sim/);
  assert.match(html, /preços, BDI e encargos pendentes/);
  assert.equal(data.record.professionalBudget.hasReliablePrices, false);
});

test('budget regression: bathroom PDF keeps its own scope and points', () => {
  const elo = loadBudget();
  elo.buildResponseForTest('Reforma de banheiro');
  const response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  const { data, html } = render(elo, response);
  assert.equal(data.record.titulo, 'Orçamento preliminar — Reforma de banheiro');
  assert.match(html, /<h1>Orçamento preliminar — Reforma de banheiro<\/h1>/);
  assert.doesNotMatch(html, /<h1>ORÇAMENTO RESIDENCIAL<\/h1>/);
  assert.match(html, /Área do banheiro/);
  assert.match(html, /Pontos hidráulicos[\s\S]*2/);
  assert.match(html, /Pontos elétricos[\s\S]*2/);
  assert.match(html, /4,00 m²/);
  assert.equal(data.record.professionalBudget.hasReliablePrices, false);
});

test('budget regression: PDF retains official composition limitations and sanitizes document assumptions', () => {
  for (const type of ['wall', 'bathroom']) {
    const elo = loadBudget();
    let response;
    if (type === 'wall') response = wall(elo);
    else {
      elo.buildResponseForTest('Reforma de banheiro');
      response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
    }
    const document = response.pdfAction.budgetDocumentData;
    assert.ok(document.assumptions.includes('preco pendente de composicao oficial'));
    document.assumptions.push('Conferir <script>document-assumption-fixture</script> & "evidencia" antes de executar.');
    const { html } = render(elo, response);
    assert.match(html, /pendente de composicao oficial/);
    assert.match(html, /scriptdocument-assumption-fixture\/script &amp; &quot;evidencia&quot;/);
    assert.doesNotMatch(html, /<script>document-assumption-fixture<\/script>/);
  }
});

test('budget regression: bare PDF keeps the active compound technical document', () => {
  const elo = loadBudget();
  const original = elo.buildResponseForTest('Quero orcamento completo para 4 pilares de 15x25 cm e altura 2,80 m, mais 15 metros lineares de viga baldrame medindo 20 cm de largura e 25 cm de altura, e uma parede de bloco ceramico de 8 metros por 2,80 metros. Quero o orcamento completo, do chapisco a areia.');
  const response = elo.buildResponseForTest('pdf');
  assert.equal(response.pdfAction.budgetId, original.pdfAction.budgetId);
  assert.equal(response.pdfAction.budgetDocumentData.documentType, 'technical_composition');
  assert.equal(response.sessionIntent, 'budget_v2_current_pdf');
});

test('budget regression: advanced details require an explicit request and retain missing premises', () => {
  const elo = loadBudget();
  const initial = elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  assert.doesNotMatch(initial.fullAnswer, /Checklist tecnico e premissas/);
  const detailed = elo.buildResponseForTest('modo avancado');
  assert.match(detailed.fullAnswer, /Checklist tecnico e premissas/);
  assert.match(detailed.fullAnswer, /Premissas faltantes:[\s\S]*(?:cidade|padrao)/);
  assert.doesNotMatch(detailed.fullAnswer, /R\$\s*\d/);
});

test('budget regression: analytic preliminary scope discloses missing city without invented prices', () => {
  const response = loadBudget().buildResponseForTest('Orçamento analítico casa 70m2 padrão médio');
  assert.match(response.fullAnswer, /Escopo preliminar/);
  assert.match(response.fullAnswer, /Etapas obrigatorias do orcamento/);
  assert.match(response.fullAnswer, /Servicos executaveis e quantitativos preliminares/);
  assert.match(response.fullAnswer, /Dados que faltam:[\s\S]*cidade\/UF/);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/);
});

function pipelineFixture(calls) {
  const step = (name, value) => ({ build(input) { calls.push(name); assert.ok(input); return value; } });
  return {
    ResidentialBriefingCompleteEngine: step('briefing', { briefing: { builtAreaM2: 70, city: 'Salvador', uf: 'BA' } }),
    ResidentialGeometryModelEngine: step('geometry', { geometry: { builtAreaM2: 70 } }),
    ResidentialQuantityTakeoffEngine: step('takeoff', { items: [{ id: 'area', quantity: 70, unit: 'm2' }] }),
    ResidentialTakeoffCompositionAdapter: { resolve(input) { calls.push('composition'); assert.ok(input); return { resolution: { resolved: [] } }; } },
    ResidentialCompositionConsumptionAdapter: { calculate(input, options) { calls.push('consumption'); assert.equal(typeof options.consumptionEngine.calculateConsumptionFromCompositions, 'function'); return { consumption: { calculated: [] } }; } },
    ResidentialConsumptionPriceAdapter: { price(input) { calls.push('price'); assert.ok(input); return { priceBase: { source: 'SINAPI_TEST' } }; } },
    ResidentialRealBudgetAdapter: { build(input) { calls.push('budget'); assert.ok(input); return { realBudgetInput: { quantities: [{ id: 'area', quantity: 70, unit: 'm2' }] }, realBudget: { status: 'complete', subtotal: 700, bdiValue: 140, total: 840 } }; } },
    EloCompositionResolver: { resolveEloEapCompositions() {} },
    EloConsumptionEngine: { calculateConsumptionFromCompositions() {} },
    EloPriceEngine: { attachPricesToBudgetRows() {} },
    EloRealBudgetEngine: { buildCompleteBudget() {} }
  };
}

const residentialMessage = 'Quero orcamento residencial preliminar para casa terrea 70m2 padrao medio em Salvador/BA, obra completa, 1 pavimento';

test('budget regression: explicit pipeline flag invokes each canonical adapter once', () => {
  const calls = [];
  const elo = loadBudget({ ...pipelineFixture(calls), ELO_RESIDENTIAL_NEW_PIPELINE: true });
  const response = elo.buildResponseForTest(residentialMessage);
  assert.equal(response.sessionIntent, 'residential_new_pipeline_record_created');
  assert.equal(response.pipeline, 'residential_new_pipeline');
  assert.deepEqual(calls, ['briefing', 'geometry', 'takeoff', 'composition', 'consumption', 'price', 'budget']);
  const records = elo.getBudgetRecordsForTest();
  assert.equal(records.length, 1);
  assert.match(records[0].custos_encontrados, /840/);
});

test('budget regression: default V2 flow does not invoke the experimental pipeline', () => {
  const calls = [];
  const elo = loadBudget({ ...pipelineFixture(calls), ELO_RESIDENTIAL_NEW_PIPELINE: false });
  const response = elo.buildResponseForTest(residentialMessage);
  assert.match(response.sessionIntent, /^budget_v2_/);
  assert.deepEqual(calls, []);
});

test('budget regression: unavailable requested pipeline fails without a fabricated budget', () => {
  const elo = loadBudget({ ELO_RESIDENTIAL_NEW_PIPELINE: true });
  const response = elo.buildResponseForTest(residentialMessage);
  assert.equal(response.sessionIntent, 'residential_new_pipeline_unavailable');
  assert.equal(response.canSave, false);
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assert.ok(response.missingDependencies.length > 0);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/);
});

test('budget regression: current pipeline record serves both PDF phrases without rebuilding or duplicating', () => {
  const calls = [];
  const documents = [];
  const elo = loadBudget({
    ...pipelineFixture(calls), ELO_RESIDENTIAL_NEW_PIPELINE: true,
    open() { return { document: { open() {}, write(html) { documents.push(html); }, close() {} }, focus() {} }; }
  });
  assert.equal(elo.buildResponseForTest(residentialMessage).sessionIntent, 'residential_new_pipeline_record_created');
  const before = JSON.stringify(elo.getBudgetRecordsForTest());
  const record = elo.getBudgetRecordsForTest()[0];
  for (const phrase of ['gerar PDF', 'Gere o orçamento em PDF']) {
    const response = elo.buildResponseForTest(phrase);
    assert.equal(response.sessionIntent, 'budget_pdf');
    assert.ok(response.fullAnswer.includes(record.numero + ' v' + record.versao));
    assert.ok(!response.pdfAction);
    assert.ok(!response.budgetOrchestratorV2);
    assert.equal(JSON.stringify(elo.getBudgetRecordsForTest()), before);
    assert.equal(Object.keys(elo.getBudgetOrchestratorV2StateForTest()).length, 0);
  }
  assert.equal(documents.length, 2);
  assert.equal(documents[0], documents[1]);
  assert.ok(documents[0].includes(record.numero));
  assert.match(documents[0], /840/);
  assert.deepEqual(calls, ['briefing', 'geometry', 'takeoff', 'composition', 'consumption', 'price', 'budget']);
});

test('budget regression: explicit budget PDF without context keeps the no-budget response', () => {
  const elo = loadBudget({ ELO_RESIDENTIAL_NEW_PIPELINE: true });
  const response = elo.buildResponseForTest('Gere o orçamento em PDF');
  assert.equal(response.sessionIntent, 'budget_v2_pdf_without_budget');
  assert.equal(elo.getBudgetRecordsForTest().length, 0);
  assert.ok(!response.pdfAction);
});

test('budget regression: a historical pipeline record after reload is not current PDF context', () => {
  const shared = storage();
  const first = loadBudget({ ...pipelineFixture([]), ELO_RESIDENTIAL_NEW_PIPELINE: true, localStorage: shared });
  assert.equal(first.buildResponseForTest(residentialMessage).sessionIntent, 'residential_new_pipeline_record_created');
  const original = JSON.stringify(first.getBudgetRecordsForTest());
  const reloaded = loadBudget({ ...pipelineFixture([]), ELO_RESIDENTIAL_NEW_PIPELINE: true, localStorage: shared });
  const response = reloaded.buildResponseForTest('Gere o orçamento em PDF');
  assert.equal(response.sessionIntent, 'budget_v2_pdf_without_budget');
  assert.equal(JSON.stringify(reloaded.getBudgetRecordsForTest()), original);
  assert.ok(!response.pdfAction);
});

test('budget regression: an active V2 wall takes precedence over the pipeline record', () => {
  const calls = [];
  const elo = loadBudget({ ...pipelineFixture(calls), ELO_RESIDENTIAL_NEW_PIPELINE: true });
  elo.buildResponseForTest(residentialMessage);
  const records = JSON.stringify(elo.getBudgetRecordsForTest());
  const current = wall(elo);
  const response = elo.buildResponseForTest('Gere o orçamento em PDF');
  assert.equal(response.sessionIntent, 'budget_v2_current_pdf');
  assert.equal(response.pdfAction.budgetId, current.pdfAction.budgetId);
  assert.equal(response.pdfAction.budgetDocumentData.documentType, 'wall');
  assert.equal(response.pdfAction.budgetDocumentData.facts.builtAreaM2, '56,00 m2');
  assert.equal(JSON.stringify(elo.getBudgetRecordsForTest()), records);
  assert.deepEqual(calls, ['briefing', 'geometry', 'takeoff', 'composition', 'consumption', 'price', 'budget']);
});

test('budget regression: changed content, a newer record or a failed attempt invalidates pipeline PDF context', () => {
  for (const scenario of ['changed-content', 'newer-record', 'failed-attempt']) {
    const shared = storage();
    const fixture = pipelineFixture([]);
    const elo = loadBudget({ ...fixture, ELO_RESIDENTIAL_NEW_PIPELINE: true, localStorage: shared });
    assert.equal(elo.buildResponseForTest(residentialMessage).sessionIntent, 'residential_new_pipeline_record_created', scenario);
    if (scenario === 'failed-attempt') {
      fixture.ResidentialBriefingCompleteEngine.build = undefined;
      assert.equal(elo.buildResponseForTest(residentialMessage).sessionIntent, 'residential_new_pipeline_unavailable');
    } else {
      const records = JSON.parse(shared.getItem('elo_budget_records_v1'));
      if (scenario === 'changed-content') records[0].conteudo_markdown += '\nConteudo alterado apos a criacao.';
      else records.push({ ...records[0], id: records[0].numero.replace(/\d{4}$/, '9999') + '-v1', numero: records[0].numero.replace(/\d{4}$/, '9999') });
      shared.setItem('elo_budget_records_v1', JSON.stringify(records));
    }
    const before = JSON.stringify(elo.getBudgetRecordsForTest());
    const response = elo.buildResponseForTest('Gere o orçamento em PDF');
    assert.equal(response.sessionIntent, 'budget_v2_pdf_without_budget', scenario);
    assert.equal(JSON.stringify(elo.getBudgetRecordsForTest()), before, scenario);
    assert.ok(!response.pdfAction, scenario);
  }
});

test('budget regression: an explicit different record number cannot use current pipeline PDF context', () => {
  const elo = loadBudget({ ...pipelineFixture([]), ELO_RESIDENTIAL_NEW_PIPELINE: true });
  elo.buildResponseForTest(residentialMessage);
  const record = elo.getBudgetRecordsForTest()[0];
  const differentNumber = record.numero.replace(/\d{4}$/, '9999');
  const original = JSON.stringify(elo.getBudgetRecordsForTest());
  const response = elo.buildResponseForTest('Gere o orçamento ' + differentNumber + ' em PDF');
  assert.equal(response.sessionIntent, 'budget_v2_pdf_without_budget');
  assert.equal(JSON.stringify(elo.getBudgetRecordsForTest()), original);
  assert.ok(!response.pdfAction);
});
