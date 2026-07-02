const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function createElement(tag) {
  return {
    tagName: String(tag || '').toUpperCase(),
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ''; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: '',
    value: '',
    options: [],
    selectedIndex: -1
  };
}

function loadElo() {
  const localStorage = createStorage();
  const context = {
    console,
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout() {},
    Date,
    Math,
    Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      location: { hostname: 'localhost', protocol: 'http:', pathname: '/relatorio-qualidade-obras.html', hash: '' },
      localStorage,
      sessionStorage: createStorage(),
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => 'test-id' },
      open: () => null
    },
    document: {
      readyState: 'complete',
      body: createElement('body'),
      createElement,
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    navigator: { userAgent: 'node-test' }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;
  context.globalThis = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'elo-assistente.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'elo-assistente.js' });
  return context.window.EloAssistente;
}

test('ELO padroniza marcadores de c?rebro nos roteamentos principais', () => {
  const elo = loadElo();
  const cases = [
    ['Ol\u00e1', 'conversational'],
    ['Quero or\u00e7amento residencial', 'budget'],
    ['Parede de bloco cer\u00e2mico', 'technical'],
    ['Gerar RDO de hoje', 'rdo'],
    ['Analisar infiltra\u00e7\u00e3o', 'report']
  ];
  for (const [message, expectedBrain] of cases) {
    const response = elo.buildResponseForTest(message);
    assert.equal(response.brain, expectedBrain, `${message} deveria rotear para ${expectedBrain}`);
    assert.equal(response.brainMarker, expectedBrain);
  }
});

test('ELO pede briefing m?nimo antes de SINAPI no or?amento residencial preliminar', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Quero or\u00e7amento residencial');
  assert.equal(response.brain, 'budget');
  assert.equal(response.budgetBrainSubtype, 'residential_preliminary');
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /padrao construtivo|padrao da obra/i);
  assert.match(response.fullAnswer, /area construida|area aproximada/i);
  assert.match(response.fullAnswer, /tipo de construcao/i);
  assert.match(response.fullAnswer, /quantidade de pavimentos/i);
  assert.match(response.fullAnswer, /etapa desejada/i);
  assert.equal(response.sessionIntent, 'budget_v2_briefing');
  assert.equal(response.canSave, false);
});

test('ELO continua o or?amento pelo subtipo correto', () => {
  const elo = loadElo();
  let response = elo.buildResponseForTest('or\u00e7amento residencial preliminar de casa terrea 80 m2 em Salvador/BA padrao medio');
  assert.equal(response.brain, 'budget');
  assert.equal(response.budgetBrainSubtype, 'residential_preliminary');

  response = elo.buildResponseForTest('Continuar meu or\u00e7amento');
  assert.equal(response.brain, 'budget');
  assert.match(response.fullAnswer, /or.amento residencial preliminar|orcamento residencial preliminar/i);
  assert.doesNotMatch(response.fullAnswer, /parede\/alvenaria.*Tipo identificado/i);
});

test('ELO direciona servi?os t?cnicos e RDO/relat?rio sem cair em fluxo gen?rico', () => {
  const elo = loadElo();
  const technical = elo.buildResponseForTest('reboco');
  assert.equal(technical.brain, 'technical');
  assert.match(technical.fullAnswer + technical.nextAction, /SINAPI|ORSE|compos/i);

  const rdo = elo.buildResponseForTest('Fazer di\u00e1rio');
  assert.equal(rdo.brain, 'rdo');
  assert.match(rdo.fullAnswer + rdo.nextAction, /RDO|Di.rio|di.rio/i);

  const report = elo.buildResponseForTest('relat\u00f3rio t\u00e9cnico de fissura');
  assert.equal(report.brain, 'report');
  assert.match(report.fullAnswer + report.nextAction, /relato tecnico|relato t.cnico|vistoria|fissura|relatorio|relat.rio/i);
});

test('ELO amplia gatilhos de orçamento residencial sem duplicar fluxo', () => {
  const elo = loadElo();
  const casa70 = elo.buildResponseForTest('quero or\u00e7ar uma casa de 70m2');
  assert.equal(casa70.brain, 'budget');
  assert.equal(casa70.budgetBrainSubtype, 'residential_preliminary');
  assert.equal(casa70.sessionTheme, 'residential_budget_package');
  assert.match(casa70.fullAnswer, /Macroetapas|Dados complementares|cidade\/UF/i);

  const terrea = elo.buildResponseForTest('quanto custa construir uma casa t\u00e9rrea?');
  assert.equal(terrea.brain, 'budget');
  assert.equal(terrea.budgetBrainSubtype, 'residential_preliminary');
  assert.match(terrea.fullAnswer, /or\u00e7amento residencial preliminar|orcamento residencial preliminar/i);

  const sobrado = elo.buildResponseForTest('sobrado de 120m2 padr\u00e3o m\u00e9dio');
  assert.equal(sobrado.brain, 'budget');
  assert.equal(sobrado.budgetBrainSubtype, 'residential_preliminary');
  assert.match(sobrado.fullAnswer, /sobrado|2 pavimento|pavimentos/i);
});

test('ELO continua orçamento residencial reaproveitando contexto salvo', () => {
  const elo = loadElo();
  const first = elo.buildResponseForTest('quero or\u00e7ar uma casa de 70m2 em Salvador/BA padr\u00e3o m\u00e9dio com 2 quartos, 1 banheiro, garagem e obra completa');
  assert.equal(first.brain, 'budget');
  assert.equal(first.budgetBrainSubtype, 'residential_preliminary');

  const next = elo.buildResponseForTest('continuar meu or\u00e7amento');
  assert.equal(next.brain, 'budget');
  assert.match(next.fullAnswer, /or.amento residencial preliminar|orcamento residencial preliminar/i);
  assert.doesNotMatch(next.fullAnswer, /composicao tecnica SINAPI\/ORSE.*Tipo identificado/i);
});

test('ELO mantém parede e reforma parcial fora de casa completa', () => {
  const elo = loadElo();
  const wall = elo.buildResponseForTest('or\u00e7ar parede de bloco cer\u00e2mico');
  assert.ok(wall.brain === 'technical' || wall.budgetBrainSubtype === 'wall');
  assert.notEqual(wall.budgetBrainSubtype, 'residential_preliminary');
  assert.notEqual(wall.sessionIntent, 'budget_v2_scope');
  assert.doesNotMatch(wall.fullAnswer, /Macroetapas da estimativa preliminar/i);

  const eloReforma = loadElo();
  const reforma = eloReforma.buildResponseForTest('reforma de banheiro');
  assert.notEqual(reforma.budgetBrainSubtype, 'residential_preliminary');
  assert.doesNotMatch(reforma.fullAnswer, /Macroetapas da estimativa preliminar/i);
  assert.match(reforma.fullAnswer + reforma.shortAnswer + reforma.nextAction, /reforma|banheiro|or\u00e7amento executivo|orcamento executivo/i);
});
