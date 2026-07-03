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
  assert.match(html, /Orçamento preliminar — Parede de bloco cerâmico/i);
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
  assert.match(html, /Orçamento preliminar — Reforma de banheiro/i);
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
  assert.match(answer, /FUNDAÇÃO[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);
  assert.match(answer, /ALVENARIA[\s\S]*Servico:[\s\S]*Materiais:[\s\S]*Quantidade:[\s\S]*Preco:/i);
});


test('ELO PDF residencial: casa 140m2 usa quantitativos ricos no documento', () => {
  const elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa terrea completa de 140m2');
  const response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 3 quartos sendo 1 suite, 2 banheiros, garagem, obra completa, sem piscina, cobertura telha ceramica estrutura madeira, forro gesso, piso ceramico, revestimento cozinha e banheiros, pintura interna e externa, portas e janelas, loucas e metais, instalacoes eletricas e hidrossanitarias, limpeza final');

  assert.ok(response.pdfAction, 'casa 140m2 deve liberar acao de PDF');
  const doc = response.pdfAction.budgetDocumentData;
  const pdfData = elo.buildBudgetV2ProfessionalPdfDataForTest(doc);
  const pdfText = [pdfData.record.quantitativos, pdfData.record.servicos, pdfData.record.custos_encontrados, pdfData.record.memoriaCalculo].join('\n');

  assert.match(pdfText, /PLANILHA ORCAMENTARIA PRELIMINAR - RESIDENCIAL/i);
  assert.match(pdfText, /Item \| Servi.o \| Unidade \| Quantidade \| Fonte\/Composi..o \| Pre.o unit.rio \| Total \| Observa..o/i);
  assert.match(pdfText, /Loca..o da obra[\s\S]*140/i);
  assert.match(pdfText, /Sapatas isoladas[\s\S]*12/i);
  assert.match(pdfText, /Pilares[\s\S]*10,50/i);
  assert.match(pdfText, /Vigas baldrame[\s\S]*24,50/i);
  assert.match(pdfText, /Formas de madeira[\s\S]*350/i);
  assert.match(pdfText, /Alvenaria de veda..o[\s\S]*336/i);
  assert.match(pdfText, /Blocos cer.micos[\s\S]*4536/i);
  assert.match(pdfText, /Cobertura[\s\S]*161/i);
  assert.match(pdfText, /Piso interno[\s\S]*140/i);
  assert.match(pdfText, /Revestimento de .reas molhadas[\s\S]*52/i);
  assert.match(pdfText, /Pintura[\s\S]*448/i);
  assert.match(pdfText, /Instala..es el.tricas[\s\S]*29/i);
  assert.match(pdfText, /Instala..es hidrossanit.rias[\s\S]*12/i);
  assert.match(pdfText, /Portas[\s\S]*8/i);
  assert.match(pdfText, /Janelas[\s\S]*6/i);
  assert.match(pdfText, /Box[\s\S]*2/i);
  assert.match(pdfText, /Aguardando composi..o SINAPI\/ORSE/i);
  assert.match(pdfText, /Subtotal: aguardando composi..es oficiais/i);
  assert.doesNotMatch(pdfText, /quantitativos pendentes/i);
});

function assertNoEloInternalState(answer) {
  assert.doesNotMatch(answer, /Sess[a�]o de trabalho/i);
  assert.doesNotMatch(answer, /\bStatus:/i);
  assert.doesNotMatch(answer, /Entrega alvo/i);
  assert.doesNotMatch(answer, /Pr[e�]via da entrega/i);
  assert.doesNotMatch(answer, /Pr[o�]ximo dado/i);
  assert.doesNotMatch(answer, /Para conduzir certo/i);
  assert.doesNotMatch(answer, /checklist de progresso/i);
}

function assertNoInventedPrice(answer) {
  assert.doesNotMatch(answer, /R\$\s*(?:25,00|1\.200,00|750,00|3\.000,00)/i);
  assert.doesNotMatch(answer, /pre[c�]os? m[e�]dios? locais/i);
}

test('ELO conversacional profissional: parede inicial calcula sem estado interno e libera PDF', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('or�amento de parede bloco cer�mico baiano, dimens�o 12 metros de comprimento e 2,5 m de altura');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assertNoEloInternalState(answer);
  assert.ok(response.pdfAction, 'parede com quantitativo deve liberar PDF mesmo antes da cidade');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
});

test('ELO conversacional profissional: pedido de PDF usa or�amento atual sem repetir or�amento', () => {
  const elo = loadElo();
  elo.buildResponseForTest('or�amento de parede bloco cer�mico baiano, dimens�o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('gere o or�amento em pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'pedido de PDF deve retornar pdfAction do or�amento atual');
  assert.match(answer, /Use o bot�o abaixo para gerar o PDF do or�amento atual/i);
  assert.doesNotMatch(answer, /conte[u�]do exato/i);
  assert.doesNotMatch(answer, /Servicos executaveis e quantitativos preliminares/i);
  assertNoEloInternalState(answer);
});

test('ELO conversacional profissional: pdf curto retorna acao do or�amento atual', () => {
  const elo = loadElo();
  elo.buildResponseForTest('or�amento de parede bloco cer�mico baiano, dimens�o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.ok(answer.length < 180, 'resposta para pdf deve ser curta');
  assert.match(answer, /bot�o abaixo/i);
});

test('ELO conversacional profissional: cidade atualiza parede sem perder medidas', () => {
  const elo = loadElo();
  elo.buildResponseForTest('or�amento de parede bloco cer�mico baiano, dimens�o 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('Vit�ria da Conquista/BA');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assert.match(answer, /Cidade\/UF: Vit[o�]ria da Conquista\/BA/i);
  assert.doesNotMatch(answer, /comprimento da parede|altura da parede|informe area|informe .*area/i);
  assert.ok(response.pdfAction);
});

test('ELO conversacional profissional: faca com or�amento suficiente aciona PDF sem preco inventado', () => {
  const elo = loadElo();
  elo.buildResponseForTest('or�amento de parede bloco cer�mico baiano, dimens�o 12 metros de comprimento e 2,5 m de altura');
  elo.buildResponseForTest('Vit�ria da Conquista/BA');
  const response = elo.buildResponseForTest('fa�a');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.match(answer, /Pre�o pendente de composi��o SINAPI\/ORSE, BDI e m�s-base/i);
  assertNoInventedPrice(answer);
  assert.doesNotMatch(answer, /conte[u�]do exato/i);
});

test('ELO conversacional profissional: casa e banheiro ocultam estado interno e pdf usa or�amento atual', () => {
  let elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  let response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'casa deve reutilizar or�amento atual para PDF');
  assert.match(response.fullAnswer || '', /bot�o abaixo/i);
  assert.doesNotMatch(response.fullAnswer || '', /Servicos executaveis e quantitativos preliminares/i);

  elo = loadElo();
  elo.buildResponseForTest('Reforma de banheiro');
  response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'banheiro deve reutilizar or�amento atual para PDF');
  assert.match(response.fullAnswer || '', /bot�o abaixo/i);
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
