const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); },
    dump() { return Object.fromEntries(data); }
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

function loadEloContext(options = {}) {
  const localStorage = createStorage(options.localStorage || {});
  const context = {
    console,
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout() {},
    Date,
    Math,
    fetch: options.fetch,
    Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:test'; }, revokeObjectURL() {} },
    URLSearchParams,
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
      open: () => null,
      fetch: options.fetch,
      setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
      clearTimeout() {}
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
  Object.assign(context.window, options.window || {});
  context.globalThis = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'elo-assistente.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'elo-assistente.js' });
  return { elo: context.window.EloAssistente, localStorage, context };
}

function loadElo() {
  return loadEloContext().elo;
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

test('ELO conversa natural roteia sem fallback generico', () => {
  const elo = loadElo();

  const hello = elo.buildResponseForTest('hello');
  assert.equal(hello.brain, 'conversational');
  assert.notEqual(hello.sessionIntent, 'fallback_comunicativo');
  assert.match([hello.shortAnswer, hello.fullAnswer].filter(Boolean).join(' '), /Oi|Ola|Ol.|pergunta comum|ideia|tarefa/i);

  const joke = elo.buildResponseForTest('me conte uma piada');
  assert.equal(joke.brain, 'conversational');
  assert.notEqual(joke.sessionIntent, 'fallback_comunicativo');
  assert.match([joke.shortAnswer, joke.fullAnswer].filter(Boolean).join(' '), /or.amento|composi/i);

  const rdo = elo.buildResponseForTest('gerar RDO de hoje');
  assert.equal(rdo.brain, 'rdo');
  assert.match(rdo.fullAnswer + rdo.nextAction, /RDO|Di.rio|di.rio/i);

  const technical = elo.buildResponseForTest('parede de bloco baiano 8x3');
  assert.equal(technical.brain, 'technical');
  assert.notEqual(technical.brain, 'budget');
});
test('ELO FASE 5 residencial: feature flag liga pipeline novo por injecao', () => {
  const calls = [];
  const makeStep = (name, result) => ({
    build(input) { calls.push(name); return typeof result === 'function' ? result(input) : result; }
  });
  const { elo } = loadEloContext({
    window: {
      ELO_RESIDENTIAL_NEW_PIPELINE: true,
      ResidentialBriefingCompleteEngine: makeStep('briefing', { schema: 'briefing', status: 'complete', briefing: { builtAreaM2: 70, city: 'Salvador', uf: 'BA' } }),
      ResidentialGeometryModelEngine: makeStep('geometry', { schema: 'geometry', status: 'complete' }),
      ResidentialQuantityTakeoffEngine: makeStep('takeoff', { schema: 'takeoff', status: 'complete', items: [{ code: 'FLOOR_AREA_TOTAL', status: 'quantified', quantity: 70, unit: 'm2' }] }),
      ResidentialTakeoffCompositionAdapter: { resolve() { calls.push('takeoffComposition'); return { schema: 'composition', status: 'complete', resolution: { resolved: [{ serviceId: 'area', composition: { code: 'SINAPI-AREA', description: 'Area construida', source: 'SINAPI', unit: 'm2' } }] } }; } },
      ResidentialCompositionConsumptionAdapter: { calculate() { calls.push('compositionConsumption'); return { schema: 'consumption', status: 'complete', consumption: { calculated: [{ composition: { code: 'SINAPI-AREA' }, inputs: [] }] } }; } },
      ResidentialConsumptionPriceAdapter: { price() { calls.push('consumptionPrice'); return { schema: 'elo.residential_consumption_price', status: 'complete', priceBase: { source: 'SINAPI_TEST' }, request: { rows: [{ takeoffItemId: 'area', serviceId: 'area', quantity: 70, unit: 'm2' }] }, price: { pricedRows: [{ takeoffItemId: 'area', serviceId: 'area', service: 'Area construida', compositionCode: 'SINAPI-AREA', compositionDescription: 'Area construida', compositionSource: 'SINAPI', quantity: 70, unit: 'm2', unitPrice: 10, totalPrice: 700 }] }, audit: { priceFingerprint: 'fp_test' } }; } },
      ResidentialRealBudgetAdapter: { build() { calls.push('realBudgetAdapter'); return { schema: 'elo.residential_real_budget_package', status: 'complete', realBudgetInput: { budgetEap: { etapas: [{ nome: 'Pipeline residencial' }], itens: [{ id: 'area', nome: 'Area construida', quantidadeBase: { valor: 70, unidade: 'm2' } }] }, quantities: [{ eapItemId: 'area', quantity: 70, unit: 'm2' }] }, realBudget: { status: 'complete', items: [{ item: 'Area construida', quantity: 70, unit: 'm2' }], subtotal: 700, bdiPercent: 20, bdiValue: 140, total: 840, missingPrices: [], canClose: true }, errors: [], warnings: [], blockingFields: [] }; } },
      EloCompositionResolver: { resolveEloEapCompositions() {} },
      EloConsumptionEngine: { calculateConsumption() {} },
      EloPriceEngine: { attachPricesToBudgetRows() {} },
      EloRealBudgetEngine: { buildCompleteBudget() {} },
      EloBudgetEngine: { buildPreliminaryBudget() { calls.push('oldBudget'); return {}; } }
    }
  });
  elo.clearBudgetRecordsForTest();
  const response = elo.buildResponseForTest('Quero orcamento residencial preliminar para casa terrea 70m2 padrao medio em Salvador/BA, obra completa, 1 pavimento');
  assert.equal(response.sessionIntent, 'residential_new_pipeline_record_created');
  assert.equal(response.pipeline, 'residential_new_pipeline');
  assert.equal(response.featureFlag, 'ELO_RESIDENTIAL_NEW_PIPELINE');
  assert.deepEqual(calls, ['briefing', 'geometry', 'takeoff', 'takeoffComposition', 'compositionConsumption', 'consumptionPrice', 'realBudgetAdapter']);
  const [record] = elo.getBudgetRecordsForTest();
  assert.match(record.custos_encontrados, /Subtotal|Total/i);
  assert.match(record.conteudo_markdown, /pipeline novo/i);
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

  const reportWithImage = elo.buildResponseForTest('gerar relatório técnico com esta imagem');
  const reportWithImageAnswer = [reportWithImage.shortAnswer, reportWithImage.fullAnswer, reportWithImage.nextAction].filter(Boolean).join(' ');
  assert.equal(reportWithImage.brain, 'report');
  assert.equal(reportWithImage.sessionIntent, 'relatorio_imagem_obrareport');
  assert.match(reportWithImageAnswer, /ObraReport|Relatorios|Relat[oó]rios|imagem|foto|evidencia/i);
  assert.doesNotMatch(reportWithImageAnswer, /PROPOSTA T[EÉ]CNICA PRELIMINAR|proposta t[eé]cnica preliminar/i);
});


test('ELO qualidade: or?amento residencial padr?o fica curto e sem auditoria', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  const answer = response.fullAnswer || '';
  assert.equal(response.brain, 'budget');
  assert.match(answer, /70 m2|70m2/i);
  assert.match(answer, /cidade\/UF/i);
  assert.match(answer, /padrao construtivo|padr.o construtivo/i);
  assert.doesNotMatch(answer, /Auditoria tecnica V3/i);
  assert.doesNotMatch(answer, /Checklist tecnico/i);
  const pendingSinapi = answer.match(/pendente de composicao SINAPI\/ORSE oficial/gi) || [];
  assert.equal(pendingSinapi.length, 0);
});

test('ELO qualidade: briefing residencial reconhece Salvador BA sem pedir cidade novamente', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';
  assert.match(answer, /cidade\/UF: Salvador\/BA/i);
  assert.match(answer, /padrao: medio/i);
  assert.match(answer, /quartos: 2/i);
  assert.match(answer, /banheiros: 1/i);
  assert.doesNotMatch(answer, /Dados que faltam:\n- cidade\/UF/i);
  assert.doesNotMatch(answer, /Auditoria tecnica V3/i);
});

test('ELO qualidade: parede n?o herda or?amento residencial', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const response = elo.buildResponseForTest('Parede de bloco cer?mico');
  const answer = response.fullAnswer || '';
  assert.equal(response.brain, 'technical');
  assert.match(answer, /parede|bloco cer.mico|bloco/i);
  assert.match(answer, /comprimento|medidas|area/i);
  assert.match(answer, /cidade\/UF|SINAPI|ORSE/i);
  assert.doesNotMatch(answer, /casa de 70 m2/i);
  assert.notEqual(response.sessionIntent, 'budget_v2_scope');
});

test('ELO qualidade: reforma de banheiro n?o mistura casa nem parede', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  elo.buildResponseForTest('Parede de bloco cer?mico');
  const response = elo.buildResponseForTest('Reforma de banheiro');
  const answer = response.fullAnswer || '';
  assert.match(answer, /reforma parcial de banheiro|reforma do banheiro/i);
  assert.match(answer, /area aproximada/i);
  assert.match(answer, /piso\/revestimento/i);
  assert.match(answer, /lou.as\/metais/i);
  assert.match(answer, /pontos hidr.ulicos\/el.tricos/i);
  assert.match(answer, /demoli/i);
  assert.match(answer, /cidade\/UF/i);
  assert.doesNotMatch(answer, /casa de 70 m2/i);
  assert.doesNotMatch(answer, /comprimento da parede|dimens.o real do bloco/i);
});

test('ELO qualidade: modo avancado mostra detalhes t?cnicos sob demanda', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcamento residencial casa 70m2');
  const response = elo.buildResponseForTest('modo avancado');
  const answer = response.fullAnswer || '';
  assert.match(answer, /Auditoria tecnica V3|Checklist tecnico|Premissas faltantes/i);
});

test('ELO qualidade: saudacao pura vence contexto tecnico ativo', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Parede de bloco ceramico');
  const response = elo.buildResponseForTest('hi');
  const answer = response.fullAnswer || '';
  assert.equal(response.brain, 'conversational');
  assert.doesNotMatch(answer, /comprimento|altura|parede de bloco|Sessao/i);
  assert.notEqual(response.sessionIntent, 'confirmar_bloco_parede');
});

test('ELO premissas residenciais: casa terrea 80m2 aplica estrutura preliminar', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa terrea 80m2 padrao medio em Salvador/BA sem piscina');
  const answer = response.fullAnswer || '';
  assert.equal(response.brain, 'budget');
  assert.match(answer, /Etapas obrigatorias do orcamento/i);
  assert.match(answer, /Locacao da obra|gabarito/i);
  assert.match(answer, /Sapatas isoladas/i);
  assert.match(answer, /Vergas e contravergas/i);
  assert.match(answer, /60 x 60 x 30 cm/i);
  assert.match(answer, /0,108 m3/i);
  assert.match(answer, /25 MPa/i);
  assert.match(answer, /Pilares .*6,00 m3/i);
  assert.match(answer, /Vigas baldrame.*14,00 m3/i);
  assert.match(answer, /Formas de madeira.*200 m2/i);
  assert.doesNotMatch(answer, /Auditoria tecnica V3/i);
});

test('ELO premissas residenciais: casa terrea 120m2 calcula fatores estruturais', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa terrea 120m2 padrao medio em Salvador/BA');
  const answer = response.fullAnswer || '';
  assert.match(answer, /Pilares .*9,00 m3/i);
  assert.match(answer, /Vigas baldrame.*21,00 m3/i);
  assert.match(answer, /Formas de madeira.*300 m2/i);
  assert.match(answer, /concreto 25 MPa/i);
});

test('ELO premissas residenciais: casa 160m2 nao aplica regra absoluta', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa terrea 160m2 padrao medio em Salvador/BA');
  const answer = response.fullAnswer || '';
  assert.match(answer, /Area acima de 140 m2|nao aplico esta regra como absoluta|parametrizacao\/projeto estrutural/i);
  assert.doesNotMatch(answer, /Pilares .*12,00 m3/i);
  assert.doesNotMatch(answer, /Vigas baldrame.*28,00 m3/i);
});

test('ELO premissas residenciais: piscina fica fora do escopo', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa terrea 100m2 padrao medio em Salvador/BA com piscina');
  const answer = response.fullAnswer || '';
  assert.match(answer, /Piscina fora do escopo|orcada separadamente/i);
  assert.doesNotMatch(answer, /Pilares .*7,50 m3/i);
});

test('ELO premissas residenciais: sobrado nao usa regra terrea como absoluta', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Sobrado 120m2 padrao medio em Salvador/BA');
  const answer = response.fullAnswer || '';
  assert.match(answer, /Sobrado precisa de premissas proprias|nao aplico esta regra terrea como absoluta/i);
  assert.doesNotMatch(answer, /Pilares .*9,00 m3/i);
  assert.doesNotMatch(answer, /Vigas baldrame.*21,00 m3/i);
});
test('ELO quantitativos residenciais: casa 70m2 completa mostra servicos materiais e unidades', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';
  const quantityLines = answer.split('\n').filter((line) => /^- .*\b\d+[\d,.]*\s*(m2|m3|un|pontos)/i.test(line));

  assert.ok(quantityLines.length >= 5, 'deveria haver pelo menos 5 servicos com quantidade e unidade');
  assert.match(answer, /Servicos executaveis e quantitativos preliminares/i);
  assert.match(answer, /concreto 25 MPa/i);
  assert.match(answer, /Formas de madeira: 175 m2/i);
  assert.match(answer, /bloco ceramico aprox\. \d+ un/i);
  assert.match(answer, /Cobertura|telhamento|telha/i);
  assert.match(answer, /Piso interno|revestimento de areas molhadas/i);
  assert.match(answer, /Pintura: \d+ m2/i);
  assert.match(answer, /Portas:/i);
  assert.match(answer, /Janelas:/i);
  assert.match(answer, /Box:/i);
  assert.doesNotMatch(answer, /Fundacao pendente[\s\S]*Estrutura pendente[\s\S]*Alvenaria pendente/i);
});

test('ELO quantitativos residenciais: portas minimas da casa 70m2', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Portas: minimo 6 un/i);
  assert.match(answer, /1 porta 0,90 m/i);
  assert.match(answer, /2 portas 0,80 m/i);
  assert.match(answer, /3 portas 0,70 m/i);
});

test('ELO quantitativos residenciais: janelas minimas da casa 70m2', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';

  assert.match(answer, /1 janela 0,40 x 0,40 m/i);
  assert.match(answer, /4 janelas 1,20 x 1,10 m/i);
});

test('ELO quantitativos residenciais: regra de box por area', () => {
  let elo = loadElo();
  let response = elo.buildResponseForTest('Casa terrea 45m2 padrao medio em Salvador/BA, 1 banheiro, obra completa');
  assert.match(response.fullAnswer || '', /Box: 1 un/i);

  elo = loadElo();
  response = elo.buildResponseForTest('Casa terrea 70m2 padrao medio em Salvador/BA, 1 banheiro, obra completa');
  assert.match(response.fullAnswer || '', /Box: 2 un/i);
});

test('ELO quantitativos parede: bloco ceramico com medidas calcula area e blocos', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Parede de bloco ceramico');
  const response = elo.buildResponseForTest('20 metros por 2,80, bloco 14x19x29, com mao de obra, Salvador/BA');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 56,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assert.match(answer, /Cidade\/UF: Salvador\/BA/i);
  assert.doesNotMatch(answer, /casa de 70 m2/i);
});

test('ELO quantitativos reforma banheiro: servicos e materiais sem heranca', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  elo.buildResponseForTest('Parede de bloco ceramico');
  elo.buildResponseForTest('Reforma de banheiro');
  const response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  const answer = response.fullAnswer || '';

  assert.match(answer, /reforma parcial de banheiro/i);
  assert.match(answer, /area: 4 m2/i);
  assert.match(answer, /Demolicao\/retirada: \d+ m2/i);
  assert.match(answer, /Piso do banheiro: 4,00 m2/i);
  assert.match(answer, /Revestimento de parede: \d+ m2/i);
  assert.match(answer, /Loucas\/metais/i);
  assert.match(answer, /Materiais principais/i);
  assert.doesNotMatch(answer, /casa de 70 m2/i);
  assert.doesNotMatch(answer, /Area da parede: 56/i);
});

test('ELO quantitativos residenciais: nao aceita resposta generica sem quantitativo', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Servicos executaveis e quantitativos preliminares/i);
  assert.match(answer, /\d+[\d,.]*\s*(m2|m3|un|pontos)/i);
  assert.doesNotMatch(answer, /Fundacao pendente|Estrutura pendente|Alvenaria pendente|Cobertura pendente/i);
});
test('ELO PDF parede: acao e documento profissional contem titulo e quantitativos', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Parede de bloco ceramico');
  const response = elo.buildResponseForTest('20 metros por 2,80, bloco 14x19x29, com mao de obra, Salvador/BA');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'parede deve liberar acao de PDF');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
  assert.match(answer, /PAREDE DE BLOCO CERAMICO[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);

  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(response.pdfAction.budgetDocumentData);
  const html = elo.buildProfessionalPdfDocumentForTest(pdfData.record, pdfData.context);
  assert.match(html, /OrÃ§amento preliminar â€” Parede de bloco cerÃ¢mico/i);
  assert.match(html, /Salvador\/BA/i);
  assert.match(html, /56,00 m2/i);
  assert.match(html, /14x19x29/i);
  assert.match(html, /Blocos ceramicos aproximados/i);
  assert.match(html, /Mao de obra[\s\S]*sim/i);
  assert.match(html, /pendente de composicao oficial|composicoes oficiais pendentes/i);
});

test('ELO PDF banheiro: acao e documento profissional contem escopo da reforma', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Reforma de banheiro');
  const response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'banheiro deve liberar acao de PDF');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
  assert.match(answer, /REFORMA DE BANHEIRO[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);

  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(response.pdfAction.budgetDocumentData);
  const html = elo.buildProfessionalPdfDocumentForTest(pdfData.record, pdfData.context);
  assert.match(html, /OrÃ§amento preliminar â€” Reforma de banheiro/i);
  assert.match(html, /Salvador\/BA/i);
  assert.match(html, /4,00 m2|4 m2/i);
  assert.match(html, /Demolicao\/retirada/i);
  assert.match(html, /Piso/i);
  assert.match(html, /Revestimento de parede/i);
  assert.match(html, /Pontos hidraulicos[\s\S]*2/i);
  assert.match(html, /Pontos eletricos[\s\S]*2/i);
  assert.match(html, /pendente de composicao oficial|composicoes oficiais pendentes/i);
});

test('ELO PDF residencial: casa 70m2 continua com PDF, quantitativos e esquadrias', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'casa completa deve continuar liberando PDF');
  assert.match(answer, /Servicos executaveis e quantitativos preliminares/i);
  assert.match(answer, /Portas:/i);
  assert.match(answer, /Janelas:/i);
  assert.match(answer, /Box:/i);
  assert.match(answer, /FUNDAÃ‡ÃƒO[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);
  assert.match(answer, /ALVENARIA[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);
});

test('ELO orcamento direto 70m2 usa dados informados e gera pacote com PDF', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa terrea de 70 m2, 2 quartos, 2 banheiros, sala, cozinha e area de servico, Vitoria da Conquista/BA, padrao medio, SINAPI BA 2024-12, BDI 25%.');

  assert.equal(response.brain, 'budget');
  assert.notEqual(response.sessionIntent, 'budget_v2_briefing');
  assert.ok(response.budgetOrchestratorV2 && response.budgetOrchestratorV2.budgetPackage, 'deve gerar budgetPackage direto');
  assert.ok(response.pdfAction, 'deve gerar pdfAction do cenario atual');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');

  const state = response.budgetOrchestratorV2.state;
  assert.equal(state.type, 'residential');
  assert.equal(state.areaM2, 70);
  assert.equal(state.city, 'Vitoria da Conquista');
  assert.equal(state.state, 'BA');
  assert.equal(state.standard, 'medio');
  assert.equal(state.floors, 1);
  assert.equal(state.rooms, 2);
  assert.equal(state.wetAreas, 2);
  assert.equal(state.serviceAreas, 1);
  assert.equal(state.bdiPercent, 25);
  assert.equal(response.budgetOrchestratorV2.budgetPackage.quantities.length, 38);
});
test('ELO PDF residencial: casa 140m2 usa quantitativos ricos no documento', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa terrea completa de 140m2');
  const briefingResponse = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 3 quartos sendo 1 suite, 2 banheiros, garagem, obra completa, sem piscina, cobertura telha ceramica estrutura madeira, forro gesso, piso ceramico, revestimento cozinha e banheiros, pintura interna e externa, portas e janelas, loucas e metais, instalacoes eletricas e hidrossanitarias, limpeza final');
  const response = elo.buildResponseForTest('Pode gerar');

  assert.equal(briefingResponse.sessionIntent, 'budget_v2_briefing');
  assert.match(briefingResponse.nextAction || '', /Pode gerar/i);
  assert.match(response.sessionIntent || '', /^budget_v2_/);
  assert.ok(response.budgetOrchestratorV2 && response.budgetOrchestratorV2.budgetPackage, 'casa 140m2 deve criar budgetPackage apos confirmacao');
  assert.ok(response.budgetOrchestratorV2 && response.budgetOrchestratorV2.budgetDocumentData, 'casa 140m2 deve criar budgetDocumentData apos confirmacao');
  assert.ok(response.pdfAction, 'casa 140m2 deve liberar acao de PDF apos confirmacao');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
  assert.equal(response.budgetOrchestratorV2.state.type, 'residential');
  const doc = response.pdfAction.budgetDocumentData;
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(doc);
  const pdfText = [pdfData.record.quantitativos, pdfData.record.servicos, pdfData.record.custos_encontrados, pdfData.record.memoriaCalculo].join('\n');

  assert.equal(pdfData.record.titulo, 'ELO Or\u00e7amentista V2');
  assert.match(pdfText, /Quantitativos/i);
  assert.match(pdfText, /Escopo preliminar/i);
  assert.match(pdfText, /Memoria de calculo dos quantitativos/i);
  assert.match(pdfText, /Limpeza e preparo inicial do terreno[\s\S]*140 m2/i);
  assert.match(pdfText, /Loca..o da obra pelo perimetro externo[\s\S]*47.86 m/i);
  assert.match(pdfText, /Concreto preliminar de fundacoes[\s\S]*7.7 m3/i);
  assert.match(pdfText, /Viga baldrame preliminar[\s\S]*2.35 m3/i);
  assert.match(pdfText, /Alvenaria externa bruta[\s\S]*134.01 m2/i);
  assert.match(pdfText, /Piso interno[\s\S]*140 m2/i);
  assert.match(pdfText, /Pintura interna preliminar[\s\S]*447.68 m2/i);
  assert.match(pdfText, /Pontos eletricos preliminares[\s\S]*37 un/i);
  assert.match(pdfText, /Pontos hidraulicos preliminares[\s\S]*5 un/i);
  assert.match(pdfText, /Portas internas e externas[\s\S]*6 un/i);
  assert.match(pdfText, /Janelas preliminares[\s\S]*6 un/i);
  assert.match(pdfText, /Valores pendentes. Nao ha fonte confiavel oficial informada/i);
  assert.match(pdfText, /status: unpriced/i);
  assert.match(pdfText, /Tabela financeira/i);
  assert.match(pdfText, /Instalacoes eletricas/i);
  assert.match(pdfText, /Instalacoes hidraulicas e sanitarias/i);
  assert.match(pdfText, /Quarto|Sala|Banheiro|Cozinha/i);
  assert.match(pdfText, /iluminacao/i);
  assert.match(pdfText, /tomadas|TUG/i);
  assert.match(pdfText, /agua fria/i);
  assert.match(pdfText, /esgoto/i);
  assert.match(pdfText, /ralos/i);
  assert.equal((pdfText.match(/Instalacoes eletricas/g) || []).length, 1);
  assert.equal((pdfText.match(/Instalacoes hidraulicas e sanitarias/g) || []).length, 1);
  assert.doesNotMatch(pdfText, /quantitativos pendentes/i);
});

function assertNoEloInternalState(answer) {
  assert.doesNotMatch(answer, /Sess[aï¿½]o de trabalho/i);
  assert.doesNotMatch(answer, /\bStatus:/i);
  assert.doesNotMatch(answer, /Entrega alvo/i);
  assert.doesNotMatch(answer, /Pr[eï¿½]via da entrega/i);
  assert.doesNotMatch(answer, /Pr[oï¿½]ximo dado/i);
  assert.doesNotMatch(answer, /Para conduzir certo/i);
  assert.doesNotMatch(answer, /checklist de progresso/i);
}

function assertNoInventedPrice(answer) {
  assert.doesNotMatch(answer, /R\$\s*(?:25,00|1\.200,00|750,00|3\.000,00)/i);
  assert.doesNotMatch(answer, /pre[cï¿½]os? m[eï¿½]dios? locais/i);
}

test('ELO conversacional profissional: parede inicial calcula sem estado interno e libera PDF', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('orï¿½amento de parede bloco cerï¿½mico baiano, dimensï¿½o 12 metros de comprimento e 2,5 m de altura');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assertNoEloInternalState(answer);
  assert.ok(response.pdfAction, 'parede com quantitativo deve liberar PDF mesmo antes da cidade');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
});

test('ELO conversacional profissional: pedido de PDF usa orï¿½amento atual sem repetir orï¿½amento', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orï¿½amento de parede bloco cerï¿½mico baiano, dimensï¿½o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('gere o orï¿½amento em pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'pedido de PDF deve retornar pdfAction do orï¿½amento atual');
  assert.match(answer, /Use o botï¿½o abaixo para gerar o PDF do orï¿½amento atual/i);
  assert.doesNotMatch(answer, /conte[uï¿½]do exato/i);
  assert.doesNotMatch(answer, /Servicos executaveis e quantitativos preliminares/i);
  assertNoEloInternalState(answer);
});

test('ELO conversacional profissional: pdf curto retorna acao do orï¿½amento atual', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orï¿½amento de parede bloco cerï¿½mico baiano, dimensï¿½o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.ok(answer.length < 180, 'resposta para pdf deve ser curta');
  assert.match(answer, /botï¿½o abaixo/i);
});

test('ELO conversacional profissional: cidade atualiza parede sem perder medidas', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orï¿½amento de parede bloco cerï¿½mico baiano, dimensï¿½o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('Vitï¿½ria da Conquista/BA');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assert.match(answer, /Cidade\/UF: Vit[oï¿½]ria da Conquista\/BA/i);
  assert.doesNotMatch(answer, /comprimento da parede|altura da parede|informe area|informe .*area/i);
  assert.ok(response.pdfAction);
});

test('ELO conversacional profissional: faca com orï¿½amento suficiente aciona PDF sem preco inventado', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orï¿½amento de parede bloco cerï¿½mico baiano, dimensï¿½o 12 metros de comprimento e 2,5 m de altura');
  elo.buildResponseForTest('Vitï¿½ria da Conquista/BA');
  const response = elo.buildResponseForTest('faï¿½a');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.match(answer, /Preï¿½o pendente de composiï¿½ï¿½o SINAPI\/ORSE, BDI e mï¿½s-base/i);
  assertNoInventedPrice(answer);
  assert.doesNotMatch(answer, /conte[uï¿½]do exato/i);
});

test('ELO conversacional profissional: casa e banheiro ocultam estado interno e pdf usa orï¿½amento atual', () => {
  let elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  let response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'casa deve reutilizar orï¿½amento atual para PDF');
  assert.match(response.fullAnswer || '', /botï¿½o abaixo/i);
  assert.doesNotMatch(response.fullAnswer || '', /Servicos executaveis e quantitativos preliminares/i);

  elo = loadElo();
  elo.buildResponseForTest('Reforma de banheiro');
  response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'banheiro deve reutilizar orï¿½amento atual para PDF');
  assert.match(response.fullAnswer || '', /botï¿½o abaixo/i);
});

test('ELO EAP: casa 70m2 cria escopo cronologico sem preco inventado', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Quero or?amento de casa de 70m2');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Etapas obrigatorias do orcamento/i);
  assert.match(answer, /Servicos preliminares|Locacao da obra/i);
  assert.match(answer, /Vigas baldrame/i);
  assert.match(answer, /Impermeabilizacao de baldrame/i);
  assert.match(answer, /Alvenaria de bloco ceramico|Alvenaria de vedacao/i);
  assert.match(answer, /Instalacoes eletricas/i);
  assert.match(answer, /Instalacoes hidrossanitarias|hidrossanitarias/i);
  assert.match(answer, /Pintura/i);
  assert.match(answer, /Limpeza final/i);
  assert.match(answer, /pendente de composi/i);
  assertNoInventedPrice(answer);
});

test('ELO EAP: parede parcial calcula area e nao vira casa completa', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Parede de bloco ceramico 12m por 2,5m');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Alvenaria (?:em|de) bloco ceramico/i);
  assert.match(answer, /Chapisco\/reboco|PAREDE DE BLOCO CERAMICO/i);
  assert.doesNotMatch(answer, /Limpeza do terreno/i);
  assert.doesNotMatch(answer, /casa de 70/i);
  assertNoInventedPrice(answer);
});

test('ELO EAP: forro PVC em casa entra no escopo sem valores ficticios', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Forro de PVC para casa de 80m2');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Forro/i);
  assert.match(answer, /80 m2/i);
  assert.match(answer, /Forro, se aplicavel|Servicos executaveis/i);
  assert.match(answer, /pendente de composi|preco pendente/i);
  assertNoInventedPrice(answer);
});

test('ELO EAP: modo analitico mantem escopo e quantitativos sem valores ficticios', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Or?amento anal?tico casa 70m2 padr?o m?dio');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Resposta principal|Escopo preliminar/i);
  assert.match(answer, /Etapas obrigatorias do orcamento/i);
  assert.match(answer, /Servicos executaveis e quantitativos preliminares/i);
  assert.match(answer, /Vigas baldrame|Alvenaria de vedacao/i);
  assertNoInventedPrice(answer);
});

test('ELO EAP: previsao eletrica basica aparece como estimativa preliminar', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Casa 70m2 com 2 quartos, sala, cozinha, banheiro e area de servico');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Instalacoes eletricas: \d+ pontos estimados|Pontos eletricos preliminares/i);
  assert.match(answer, /Instalacoes hidrossanitarias|hidrossanitarias/i);
  assertNoInventedPrice(answer);
});

const ELO_TECHNICAL_COMPOSITION_MESSAGE = 'Quero or?amento completo para 4 pilares de 15x25 cm e altura 2,80 m, mais 15 metros lineares de viga baldrame medindo 20 cm de largura e 25 cm de altura, e uma parede de bloco cer?mico de 8 metros por 2,80 metros. Quero o or?amento completo, do chapisco a areia.';

function getCompoundBudgetTexts(elo, response) {
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(response.pdfAction.budgetDocumentData);
  return {
    pdfData,
    answer: response.fullAnswer || response.shortAnswer || '',
    table: response.pdfAction.budgetDocumentData.budgetTableText || '',
    materials: response.pdfAction.budgetDocumentData.materialsText || '',
    financial: response.pdfAction.budgetDocumentData.financialSummaryText || '',
    memorial: response.pdfAction.budgetDocumentData.memorialText || '',
    pdfText: [pdfData.record.titulo, pdfData.record.tipo, pdfData.record.resumoExecutivo, pdfData.record.conteudo_markdown, pdfData.record.servicos, pdfData.record.quantitativos, pdfData.record.memoriaCalculo, pdfData.record.custos_encontrados, pdfData.context && pdfData.context.quantitativos].join('\n')
  };
}

test('ELO composto: planilha principal prioriza servicos executaveis', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const texts = getCompoundBudgetTexts(elo, response);
  assert.equal(response.brain, 'budget');
  assert.match(response.sessionIntent || '', /technical_composition|composto/i);
  assert.match(texts.answer, /Itens or?ados: 11|Itens or.ados: 11/i);
  assert.match(texts.table, /Locacao\/gabarito/i);
  assert.match(texts.table, /Escavacao para baldrame\/sapatas/i);
  assert.match(texts.table, /Concreto para pilares/i);
  assert.match(texts.table, /Formas para pilares/i);
  assert.match(texts.table, /Aco para pilares/i);
  assert.match(texts.table, /Concreto para viga baldrame/i);
  assert.match(texts.table, /Formas para viga baldrame/i);
  assert.match(texts.table, /Impermeabilizacao de baldrame/i);
  assert.match(texts.table, /Alvenaria de bloco ceramico/i);
  assert.match(texts.table, /Chapisco/i);
  assert.match(texts.table, /Reboco\/Emboco/i);
  assert.doesNotMatch(texts.table, /\|\s*Cimento\s*\|/i);
  assert.doesNotMatch(texts.table, /\|\s*Areia\s*\|/i);
  assert.match(texts.materials, /Cimento, areia e argamassa: aguardando/i);
  assert.ok(response.pdfAction, 'orcamento composto deve liberar pdfAction');
});

test('ELO composto: quantidades e materiais principais ficam corretos', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const texts = getCompoundBudgetTexts(elo, response);
  assert.match(texts.table, /Concreto para pilares\s*\|\s*m3\s*\|\s*0,42/i);
  assert.match(texts.table, /Formas para pilares\s*\|\s*m2\s*\|\s*8,96/i);
  assert.match(texts.table, /Concreto para viga baldrame\s*\|\s*m3\s*\|\s*0,75/i);
  assert.match(texts.table, /Formas para viga baldrame\s*\|\s*m2\s*\|\s*7,50/i);
  assert.match(texts.table, /Impermeabilizacao de baldrame\s*\|\s*m2\s*\|\s*3,00/i);
  assert.match(texts.table, /Alvenaria de bloco ceramico\s*\|\s*m2\s*\|\s*22,40/i);
  assert.match(texts.table, /Chapisco\s*\|\s*m2\s*\|\s*44,80/i);
  assert.match(texts.table, /Reboco\/Emboco\s*\|\s*m2\s*\|\s*44,80/i);
  assert.match(texts.materials, /Bloco 14x19x39: 327 un/i);
});

test('ELO composto: sem base oficial nao inventa preco e totaliza como aguardando', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const texts = getCompoundBudgetTexts(elo, response);
  assert.match(texts.table, /Preco unitario/i);
  assert.match(texts.table, /Total/i);
  assert.match(texts.table, /Aguardando composi..o oficial/i);
  assert.doesNotMatch(texts.table, /R\$\s*\d/i);
  assert.match(texts.financial, /Subtotal: aguardando composi..es oficiais/i);
  assert.match(texts.financial, /BDI: aguardando defini..o/i);
  assert.match(texts.financial, /Total preliminar: aguardando composi..es oficiais/i);
});

test('ELO composto: BDI informado fica guardado sem inventar total', () => {
  const elo = loadElo();
  elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const response = elo.buildResponseForTest('usar BDI de 25%');
  const texts = getCompoundBudgetTexts(elo, response);
  assert.match(texts.answer, /BDI de 25,00% guardado|BDI informado: 25,00%/i);
  assert.match(texts.financial, /BDI informado: 25,00%/i);
  assert.match(texts.financial, /Total preliminar: aguardando composi..es oficiais/i);
  assert.doesNotMatch(texts.financial, /R\$\s*\d/i);
});

test('ELO composto: memorial de calculo reaproveita orcamento atual', () => {
  const elo = loadElo();
  elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const response = elo.buildResponseForTest('memorial de calculo');
  const answer = response.fullAnswer || response.shortAnswer || '';
  assert.match(response.sessionIntent || '', /technical_composition_memorial/i);
  assert.match(answer, /Pilares: qtd x largura x espessura x altura/i);
  assert.match(answer, /Formas dos pilares/i);
  assert.match(answer, /Viga baldrame: comprimento x largura x altura/i);
  assert.match(answer, /Parede: comprimento x altura/i);
  assert.match(answer, /Chapisco\/reboco: area da parede x faces/i);
  assert.doesNotMatch(answer, /PLANILHA ORCAMENTARIA PRELIMINAR/i);
});

test('ELO composto: pdf curto usa orcamento composto atual sem repetir tudo', () => {
  const elo = loadElo();
  elo.buildResponseForTest(ELO_TECHNICAL_COMPOSITION_MESSAGE);
  const response = elo.buildResponseForTest('pdf');
  const answer = response.fullAnswer || response.shortAnswer || '';
  assert.ok(response.pdfAction, 'pdf deve retornar acao do orcamento composto');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
  assert.match(answer, /Use o bot.o abaixo para gerar o PDF do or.amento atual/i);
  assert.doesNotMatch(answer, /Concreto para pilares[\s\S]*Concreto para viga baldrame[\s\S]*Reboco\/Emboco/i);
  const texts = getCompoundBudgetTexts(elo, response);
  assert.match(texts.pdfText, /Or.amento t.cnico composto/i);
  assert.match(texts.pdfText, /PLANILHA ORCAMENTARIA PRELIMINAR/i);
  assert.match(texts.pdfText, /Preco unitario/i);
  assert.match(texts.pdfText, /Aguardando composi..o oficial/i);
  assert.match(texts.pdfText, /MATERIAIS PRINCIPAIS/i);
  assert.match(texts.memorial, /MEMORIAL DE CALCULO/i);
  assert.doesNotMatch(texts.memorial, /PLANILHA ORCAMENTARIA PRELIMINAR/i);
  assert.doesNotMatch(texts.pdfText, /Or.amento residencial preliminar/i);
});


test('ELO CORE: abre ferramentas explicitas com nomes publicos e rotas auditadas', () => {
  const elo = loadElo();
  const cases = [
    ['Abra o CADISTA.', 'cadista', '/cadista/', '/cadista/?source=elo-core', /Abrindo o Editor t[eé]cnico/i],
    ['Abra o relatório.', 'relatorio', '/relatorio-qualidade-obras/', '/relatorio-qualidade-obras/?source=elo-core', /Abrindo o Editor de relat[oó]rio/i],
    ['Abrir ObraReport.', 'relatorio', '/relatorio-qualidade-obras/', '/relatorio-qualidade-obras/?source=elo-core', /Abrindo o Editor de relat[oó]rio/i],
    ['Quero abrir o relatório.', 'relatorio', '/relatorio-qualidade-obras/', '/relatorio-qualidade-obras/?source=elo-core', /Abrindo o Editor de relat[oó]rio/i],
    ['Abra o RDO.', 'rdo', '/relatorio-qualidade-obras/#rdo-identificacao', '/relatorio-qualidade-obras/?source=elo-core&section=rdo', /Abrindo o Di[aá]rio de obra/i],
    ['Abra o Diário de Obra.', 'rdo', '/relatorio-qualidade-obras/#rdo-identificacao', '/relatorio-qualidade-obras/?source=elo-core&section=rdo', /Abrindo o Di[aá]rio de obra/i],
    ['Abra o Stock.', 'stock', '/stockfull.html', '/stockfull.html?source=elo-core', /Abrindo a Gest[aã]o de estoque/i],
    ['Abra o Stock Full.', 'stock', '/stockfull.html', '/stockfull.html?source=elo-core', /Abrindo a Gest[aã]o de estoque/i],
    ['Abra o estoque.', 'stock', '/stockfull.html', '/stockfull.html?source=elo-core', /Abrindo a Gest[aã]o de estoque/i],
    ['Quero acessar o estoque.', 'stock', '/stockfull.html', '/stockfull.html?source=elo-core', /Abrindo a Gest[aã]o de estoque/i],
    ['Abra o Stock Obras.', 'stockObras', '/stock-ai-obras.html', '/stock-ai-obras.html?source=elo-core', /Abrindo o Estoque de obra/i],
    ['Abra o almoxarifado.', 'stockObras', '/stock-ai-obras.html', '/stock-ai-obras.html?source=elo-core', /Abrindo o Estoque de obra/i]
  ];

  for (const [message, id, route, url, answer] of cases) {
    const response = elo.buildResponseForTest(message);
    assert.equal(response.sessionIntent, 'explicit_tool_request');
    assert.equal(response.eloCoreMode, 'tool');
    assert.equal(response.eloCoreTool.id, id);
    assert.equal(response.eloCoreTool.route, route);
    assert.equal(response.eloCoreTool.url, url);
    assert.match(response.fullAnswer, answer);
    assert.match(response.eloCoreTool.url, /[?&]source=elo-core(?:&|$)/);
    assert.doesNotMatch(response.fullAnswer, /https?:\/\//i);
  }
});
test('ELO estoque: saldo conhecido roteia antes da ajuda de materiais', () => {
  const { elo } = loadEloContext({
    window: {
      ObraReportOperationalStock: {
        getAlmoxBalances() {
          return [{
            id: 'cimento',
            name: 'Cimento CP II',
            unit: 'sc',
            entries: 100,
            exits: 15,
            balance: 85,
            realBalance: 85,
            minimumStock: 20,
            status: 'OK'
          }];
        }
      }
    }
  });

  const response = elo.buildResponseForTest('quanto cimento ainda tem?');
  const answer = [response.shortAnswer, response.fullAnswer, response.nextAction].filter(Boolean).join(' ');

  assert.equal(response.brain, 'stock');
  assert.equal(response.sessionIntent, 'stock_full_saldo');
  assert.notEqual(response.sessionIntent, 'ajuda_materiais');
  assert.match(answer, /85 sc de Cimento CP II|Saldo atual: 85 sc/i);
});
test('ELO CORE: pedido de link mostra botao sem navegar', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Qual Ã© o link do CADISTA?');

  assert.equal(response.eloCoreMode, 'link');
  assert.equal(response.eloCoreTool.id, 'cadista');
  assert.equal(response.eloCoreTool.route, '/cadista/');
  assert.match(response.fullAnswer, /link do Editor t[eé]cnico/i);
  assert.doesNotMatch(response.fullAnswer, /Abrindo/i);
});
test('ELO CORE: anÃ¡lise de foto resolve direto salvo quando abrir ferramenta Ã© explÃ­cito', () => {
  const elo = loadElo();
  let response = elo.buildResponseForTest('Analise esta foto e gere um relatorio.');
  assert.notEqual(response.eloCoreMode, 'tool');
  assert.notEqual(response.eloCoreMode, 'link');

  response = elo.buildResponseForTest('Analise esta foto e abra o relatorio para revisao.');
  assert.equal(response.eloCoreMode, 'tool');
  assert.equal(response.eloCoreTool.id, 'relatorio');
  assert.match(response.fullAnswer, /Abrindo o Editor de relat[oó]rio/i);
});

test('ELO CORE intent: classifica data clima opiniao e multi-intent', () => {
  const elo = loadElo();
  assert.equal(elo.classifyIntentForTest('Qual dia e hoje?').map((item) => item.type).join(','), 'date_time');

  const weather = elo.classifyIntentForTest('Quantos graus faz em Vitoria da Conquista?');
  assert.equal(weather[0].type, 'weather');
  assert.match(weather[0].location, /Vitoria da Conquista/i);

  const cup = elo.classifyIntentForTest('Quem vai ganhar a Copa?');
  assert.equal(cup[0].type, 'research_or_opinion');

  const multi = elo.classifyIntentForTest('Qual dia e hoje? Quantos graus faz em Vitoria da Conquista e quem vai ganhar a Copa?');
  assert.equal(multi.map((item) => item.type).join(','), 'date_time,weather,research_or_opinion');
});

test('ELO CORE intent: responde pergunta composta sem fallback generico', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Qual dia e hoje? Quantos graus faz em Vitoria da Conquista e quem vai ganhar a Copa?');
  const answer = response.fullAnswer || response.shortAnswer || '';

  assert.match(answer, /Hoje (e|é)/i);
  assert.match(answer, /clima|temperatura|integra/i);
  assert.match(answer, /N.o d.|Não d.|nao da/i);
  assert.doesNotMatch(answer, /Posso organizar uma ideia/i);
  assert.doesNotMatch(answer, /Projeto, mem.ria, biblioteca ou decis/i);
  assert.doesNotMatch(answer, /Pr.xima a..o:/i);
});

test('ELO CORE intent: conversas comuns nao recebem Proxima acao robotica', () => {
  const elo = loadElo();
  const date = elo.buildResponseForTest('Qual dia e hoje?');
  const cup = elo.buildResponseForTest('Quem vai ganhar a Copa?');
  assert.doesNotMatch((date.fullAnswer || date.shortAnswer || ''), /Pr.xima a..o:/i);
  assert.doesNotMatch((cup.fullAnswer || cup.shortAnswer || ''), /Pr.xima a..o:/i);
  assert.match((cup.fullAnswer || cup.shortAnswer || ''), /N.o d.|Não d.|nao da/i);
});

test('ELO CORE intent: diagnostico de trabalho nao cai no cerebro tecnico de obras', () => {
  const elo = loadElo();
  const question = 'Faca um diagnostico do nosso historico de trabalho recente e aponte onde perdemos tempo, quais tipos de pedidos geraram mais vai-e-vem, onde esta o ruido, qual e o parafuso principal e qual mudanca na forma de pedir faria a primeira versao ser definitiva.';
  const intents = elo.classifyIntentForTest(question).map((item) => item.type).join(',');
  const response = elo.buildResponseForTest(question);
  const answer = [response.shortAnswer, response.fullAnswer, response.nextAction].filter(Boolean).join('\n');

  assert.match(intents, /meta_workflow/);
  assert.equal(response.sessionIntent, 'meta_workflow_diagnosis');
  assert.match(answer, /modo de trabalho|objetivo|comportamento esperado|parafuso principal|retrabalho/i);
  assert.doesNotMatch(answer, /SINAPI|ORSE|servi.o solicitado|Mem.ria de c.lculo|composi..o t.cnica|premissas t.cnicas|Quantidade/i);
  assert.doesNotMatch(answer, /Pr.xima a..o:/i);
});

test('ELO CORE POC: pedido misto deve pedir separacao antes de implementar', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Crie uma memoria com Supabase e altere a interface do chat');
  const answer = response.fullAnswer || response.shortAnswer || '';

  assert.match(elo.classifyIntentForTest('Crie uma memoria com Supabase e altere a interface do chat').map((item) => item.type).join(','), /poc_needs_split/);
  assert.match(answer, /mistura comportamento e implementa/i);
  assert.match(answer, /Camada 1/i);
  assert.match(answer, /Camada 2/i);
  assert.doesNotMatch(answer, /CREATE TABLE|fetch|supabase\.from|schema/i);
});

test('ELO CORE POC: camada 2 sem camada 1 aprovada nao implementa', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Implemente persistencia real no Supabase');
  const answer = response.fullAnswer || response.shortAnswer || '';

  assert.match(elo.classifyIntentForTest('Implemente persistencia real no Supabase').map((item) => item.type).join(','), /poc_layer_2_implementation/);
  assert.match(answer, /Ainda n.o vou implementar/i);
  assert.match(answer, /Camada 1 precisa estar aprovada/i);
  assert.doesNotMatch(answer, /CREATE TABLE|supabase\.from|migration|schema/i);
});

test('ELO CORE POC: camada 1 retorna template comportamental', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('Vamos definir a Camada 1 com inputs, saidas esperadas e saidas proibidas');
  const answer = response.fullAnswer || response.shortAnswer || '';

  assert.match(answer, /Objetivo do usu.rio/i);
  assert.match(answer, /Inputs -> Sa.das esperadas/i);
  assert.match(answer, /Sa.das proibidas/i);
  assert.doesNotMatch(answer, /SINAPI|ORSE|servi.o de obra/i);
});

test('ELO CORE projeto: salva continua decide atualiza e troca projeto ativo', () => {
  const current = loadEloContext();
  let response = current.elo.buildResponseForTest('Estamos desenvolvendo o ELO Core.');
  assert.equal(response.sessionIntent, 'project_memory_save');
  assert.match(response.shortAnswer, /ELO Core/);
  assert.doesNotMatch(response.shortAnswer + response.fullAnswer, /Seu nome|perfil/i);

  response = current.elo.buildResponseForTest('Continuar.');
  assert.equal(response.sessionIntent, 'project_memory_continue');
  assert.match(response.fullAnswer, /trabalhando no ELO Core/i);
  assert.match(response.fullAnswer, /Abertura autom[aá]tica das ferramentas/i);
  assert.match(response.fullAnswer, /Implementar mem[oó]ria de projeto/i);

  response = current.elo.buildResponseForTest('Decidimos que a memória de projeto fica separada do perfil.');
  assert.equal(response.sessionIntent, 'project_memory_update');
  response = current.elo.buildResponseForTest('O que decidimos ontem?');
  assert.equal(response.sessionIntent, 'project_memory_query');
  assert.match(response.fullAnswer, /mem[oó]ria de projeto fica separada do perfil/i);

  response = current.elo.buildResponseForTest('Próxima tarefa é testar usuário sem memória.');
  assert.equal(response.sessionIntent, 'project_memory_update');
  response = current.elo.buildResponseForTest('Qual é a próxima tarefa?');
  assert.match(response.fullAnswer, /testar usu[aá]rio sem mem[oó]ria/i);

  response = current.elo.buildResponseForTest('Concluímos a memória de projeto.');
  assert.equal(response.sessionIntent, 'project_memory_update');
  response = current.elo.buildResponseForTest('Continuar.');
  assert.match(response.fullAnswer, /mem[oó]ria de projeto/i);
  assert.doesNotMatch(response.fullAnswer, /Pr[oó]xima tarefa:\nMem[oó]ria de projeto/i);

  response = current.elo.buildResponseForTest('Mudar de projeto.');
  assert.equal(response.shortAnswer, 'Qual projeto deseja iniciar?');
  response = current.elo.buildResponseForTest('O projeto chama ObraReport.');
  assert.equal(response.sessionIntent, 'project_memory_save');
  response = current.elo.buildResponseForTest('Continuar.');
  assert.match(response.fullAnswer, /ObraReport/i);
  assert.doesNotMatch(response.fullAnswer, /trabalhando no ELO Core/i);
});
test('ELO CORE nome: salva, consulta, recarrega e corrige sem cair no motor tecnico', () => {
  const current = loadEloContext();
  let response = current.elo.buildResponseForTest('Meu nome é Ícaro Amaral. Guarde isso.');
  assert.equal(response.sessionIntent, 'user_name_memory');
  assert.equal(response.shortAnswer, 'Certo, Ícaro. Vou lembrar do seu nome nas próximas conversas.');
  assert.doesNotMatch(response.fullAnswer, /obra|SINAPI|ORSE|técnic|tecnic/i);

  response = current.elo.buildResponseForTest('Qual é o meu nome?');
  assert.equal(response.shortAnswer, 'Seu nome é Ícaro Amaral.');

  const reloaded = loadEloContext({ localStorage: current.localStorage.dump() });
  response = reloaded.elo.buildResponseForTest('Você lembra quem eu sou?');
  assert.equal(response.shortAnswer, 'Sim. Você é Ícaro Amaral.');

  response = reloaded.elo.buildResponseForTest('Meu nome não é Ícaro. Meu nome é Amaral.');
  assert.equal(response.shortAnswer, 'Entendido. Vou lembrar que seu nome é Amaral.');

  response = reloaded.elo.buildResponseForTest('Qual é o meu nome?');
  assert.equal(response.shortAnswer, 'Seu nome é Amaral.');
  assert.doesNotMatch(response.shortAnswer, /Ícaro Amaral/);
});

test('ELO CORE nome: usuario sem memoria nao recebe nome inventado', () => {
  const { elo } = loadEloContext();
  const response = elo.buildResponseForTest('Qual é o meu nome?');
  assert.equal(response.sessionIntent, 'user_name_memory');
  assert.match(response.shortAnswer, /Ainda não sei o seu nome/);
  assert.doesNotMatch(response.shortAnswer + response.fullAnswer, /Ícaro|Amaral|João|Maria/);
});

test('ELO CORE nome: bloqueia dado sensivel e preserva perfil local', () => {
  const { elo, localStorage } = loadEloContext();
  const response = elo.buildResponseForTest('Meu nome é senha 123456. Guarde isso.');
  assert.notEqual(response.sessionIntent, 'user_name_memory');
  assert.equal(localStorage.getItem('obrareport_elo_perfil_usuario_v1'), null);
});

test('ELO CORE nome: perfil local migra como compatibilidade de nova conversa', () => {
  const localStorage = {
    obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: 'Ícaro Amaral' })
  };
  const { elo } = loadEloContext({ localStorage });
  const response = elo.buildResponseForTest('Qual é o meu nome?');
  assert.equal(response.shortAnswer, 'Seu nome é Ícaro Amaral.');
});


test('ELO CORE sincroniza as tres superficies publicas no bootstrap minimalista', () => {
  const root = path.resolve(__dirname, '..');
  const surfaces = [
    ['elo.html', path.join(root, 'elo.html')],
    ['stock-ai-obras.html', path.join(root, 'stock-ai-obras.html')],
    ['relatorio-qualidade-obras.html', path.join(root, 'relatorio-qualidade-obras', 'relatorio-qualidade-obras.html')]
  ];

  for (const [label, filePath] of surfaces) {
    const html = fs.readFileSync(filePath, 'utf8');
    assert.match(html, /elo-assistente\.js/);
    assert.match(html, /ELO_SKIP_AUTO_WIDGET\s*=\s*true/);
    assert.match(html, /initializeSurface\s*\(/, label + ' deve usar o bootstrap publico comum');
    assert.match(html, /<textarea[^>]+class="elo-input"/i, label + ' deve manter composer textarea');
    assert.doesNotMatch(html, /elo-assistente\.css/, label + ' nao deve carregar o CSS do widget antigo');
  }

  const eloHtml = fs.readFileSync(path.join(root, 'elo.html'), 'utf8');
  assert.doesNotMatch(eloHtml, /ELO_CORE_NAME_MEMORY_CATEGORY\s*=\s*"profile"/, 'elo.html nao deve duplicar memoria canonica');

  const reportHtml = fs.readFileSync(path.join(root, 'relatorio-qualidade-obras', 'relatorio-qualidade-obras.html'), 'utf8');
  assert.match(reportHtml, /\.\.\/elo\.css/);
  assert.match(reportHtml, /report-elo-chat/);
});


test('ELO CORE confiabilidade: registra eventos sanitizados e limita historico local', () => {
  const { elo, localStorage } = loadEloContext();
  for (let index = 0; index < 105; index += 1) {
    elo.recordReliabilityEventForTest('intent_detected', {
      message: 'evento ' + index,
      anonymousId: 'elo_anon_secreto',
      userId: 'usuario-secreto',
      token: 'token-secreto',
      senha: 'senha-secreta',
      safe: 'ok'
    });
  }
  const events = JSON.parse(localStorage.getItem('elo_core_reliability_events_v1'));
  assert.equal(events.length, 100);
  assert.equal(events[events.length - 1].type, 'intent_detected');
  assert.equal(events[events.length - 1].metadata.safe, 'ok');
  const serialized = JSON.stringify(events);
  assert.doesNotMatch(serialized, /elo_anon_secreto|usuario-secreto|token-secreto|senha-secreta/i);
});

test('ELO CORE memoria: deduplica historico e preserva continuidade isolada', () => {
  const { elo, localStorage } = loadEloContext();

  elo.saveConversationForTest('Continuar projeto ELO', 'Vamos por partes.');
  elo.saveConversationForTest('Continuar projeto ELO', 'Vamos por partes.');
  let history = elo.getRecentQuestionsForTest();
  assert.equal(history.length, 1);
  assert.equal(history[0].question, 'Continuar projeto ELO');

  localStorage.setItem('obrareport_elo_assistente_v1', JSON.stringify({
    conversations: [
      { question: 'Continuar projeto ELO', answer: 'Vamos por partes.', createdAt: '2026-07-20T10:00:00.000Z' },
      { question: 'Continuar projeto ELO', answer: 'Vamos por partes.', createdAt: '2026-07-20T09:00:00.000Z' },
      { question: 'Qual e o proximo passo?', answer: 'Escolha uma entrega pequena.', createdAt: '2026-07-20T08:00:00.000Z' }
    ]
  }));
  history = elo.getRecentQuestionsForTest();
  assert.equal(history.length, 2);

  assert.doesNotThrow(() => {
    elo.rememberSessionTurnForTest('continuar ' + 'detalhe '.repeat(80), null, 'Resposta longa preservada.');
  });

  let response = elo.buildResponseForTest('Estamos desenvolvendo o ELO Core.');
  assert.equal(response.sessionIntent, 'project_memory_save');
  response = elo.buildResponseForTest('Continuar.');
  const answer = [response.shortAnswer, response.fullAnswer, response.nextAction].filter(Boolean).join(' ');
  assert.equal(response.sessionIntent, 'project_memory_continue');
  assert.match(answer, /ELO Core/i);
  assert.doesNotMatch(answer, /CADISTA|Stock Sa[uú]de|Stock Saude/i);
});
test('ELO CORE memoria de obra: salva obra ativa e retoma apos outro assunto', () => {
  const { elo, localStorage } = loadEloContext();

  const save = elo.buildResponseForTest('Minha obra ativa é Residencial Alfa, 70 m² em Vitória da Conquista/BA');
  assert.equal(save.sessionIntent, 'salvar_memoria_obra');
  assert.equal(save.brain, 'conversational');
  assert.notEqual(save.brain, 'budget');
  assert.doesNotMatch(save.fullAnswer || save.shortAnswer || '', /orçamento|orcamento|SINAPI|Stock Sa[uú]de|CADISTA/i);

  elo.buildResponseForTest('me conte uma piada');
  const resume = elo.buildResponseForTest('retome minha obra');
  const answer = [resume.shortAnswer, resume.fullAnswer, resume.nextAction].filter(Boolean).join(' ');

  assert.equal(resume.sessionIntent, 'consultar_memoria_obra');
  assert.equal(resume.brain, 'conversational');
  assert.match(answer, /Residencial Alfa/i);
  assert.match(answer, /70,00 m²|70 m²/i);
  assert.match(answer, /Vitória da Conquista\/BA|Vitoria da Conquista\/BA/i);
  assert.doesNotMatch(answer, /ativa é Residencial Alfa|ativa e Residencial Alfa/i);
  assert.doesNotMatch(answer, /CADISTA|Stock Sa[uú]de|Stock Saude/i);

  const stored = JSON.parse(localStorage.getItem('elo_work_memory_v1'));
  assert.equal(Object.keys(stored.projects).filter((id) => /residencial_alfa/i.test(id)).length, 1);
});
test('ELO CORE confiabilidade: falha de memoria nao inventa nome e marca safe state', async () => {
  const { elo } = loadEloContext({ fetch: () => Promise.reject(new Error('backend offline')) });
  await elo.loadCoreMemoriesForTest();
  const response = elo.buildResponseForTest('Qual \u00e9 o meu nome?');
  const snapshot = elo.getReliabilitySnapshotForTest();
  assert.equal(snapshot.memoryAvailable, false);
  assert.equal(snapshot.lastEvent.type, 'memory_failed');
  assert.match(response.fullAnswer || response.shortAnswer, /ainda n\u00e3o tenho um nome salvo|ainda nao tenho um nome salvo|n\u00e3o sei seu nome ainda|nao sei seu nome ainda|n\u00e3o tenho seu nome salvo|nao tenho seu nome salvo/i);
  assert.doesNotMatch(response.fullAnswer || response.shortAnswer, new RegExp("\\u00cdcaro Amaral|Icaro Amaral", "i"));
});

test('ELO CORE confiabilidade: falha do classificador cai em modo seguro', () => {
  const { elo, context } = loadEloContext();
  context.window.ELO_CORE_FORCE_CLASSIFIER_FAILURE = true;
  const response = elo.buildResponseForTest('Que dia \u00e9 hoje?');
  const snapshot = elo.getReliabilitySnapshotForTest();
  assert.equal(response.sessionIntent, 'safe_mode');
  assert.equal(response.shortAnswer, 'N\u00e3o consegui classificar isso com seguran\u00e7a. Pode reformular em uma frase mais direta?');
  assert.equal(snapshot.safeModeActive, true);
  assert.equal(snapshot.lastEvent.type, 'classifier_failed');
});

test('ELO CORE confiabilidade: falha ao abrir ferramenta registra evento seguro', () => {
  const { elo, context } = loadEloContext();
  context.window.location.assign = () => { throw new Error('navigation blocked'); };
  const response = elo.detectCoreToolIntentForTest('Abra o CADISTA.');
  const navigated = elo.navigateToolForTest(response);
  const snapshot = elo.getReliabilitySnapshotForTest();
  assert.equal(navigated, true);
  assert.equal(snapshot.lastEvent.type, 'tool_open_failed');
  assert.equal(snapshot.safeModeActive, true);
  assert.doesNotMatch(JSON.stringify(snapshot.lastEvent), /anonymousId|userId|token|senha/i);
});
