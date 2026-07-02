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

function assertNoEloInternalState(answer) {
  assert.doesNotMatch(answer, /Sess[aã]o de trabalho/i);
  assert.doesNotMatch(answer, /\bStatus:/i);
  assert.doesNotMatch(answer, /Entrega alvo/i);
  assert.doesNotMatch(answer, /Pr[eé]via da entrega/i);
  assert.doesNotMatch(answer, /Pr[oó]ximo dado/i);
  assert.doesNotMatch(answer, /Para conduzir certo/i);
  assert.doesNotMatch(answer, /checklist de progresso/i);
}

function assertNoInventedPrice(answer) {
  assert.doesNotMatch(answer, /R\$\s*(?:25,00|1\.200,00|750,00|3\.000,00)/i);
  assert.doesNotMatch(answer, /pre[cç]os? m[eé]dios? locais/i);
}

test('ELO conversacional profissional: parede inicial calcula sem estado interno e libera PDF', () => {
  const elo = loadElo();
  const response = elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assertNoEloInternalState(answer);
  assert.ok(response.pdfAction, 'parede com quantitativo deve liberar PDF mesmo antes da cidade');
  assert.equal(response.pdfAction.type, 'budget_v2_professional_pdf');
});

test('ELO conversacional profissional: pedido de PDF usa orçamento atual sem repetir orçamento', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('gere o orçamento em pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction, 'pedido de PDF deve retornar pdfAction do orçamento atual');
  assert.match(answer, /Use o botão abaixo para gerar o PDF do orçamento atual/i);
  assert.doesNotMatch(answer, /conte[uú]do exato/i);
  assert.doesNotMatch(answer, /Servicos executaveis e quantitativos preliminares/i);
  assertNoEloInternalState(answer);
});

test('ELO conversacional profissional: pdf curto retorna acao do orçamento atual', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('pdf');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.ok(answer.length < 180, 'resposta para pdf deve ser curta');
  assert.match(answer, /botão abaixo/i);
});

test('ELO conversacional profissional: cidade atualiza parede sem perder medidas', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  const response = elo.buildResponseForTest('Vitória da Conquista/BA');
  const answer = response.fullAnswer || '';

  assert.match(answer, /Area da parede: 30,00 m2/i);
  assert.match(answer, /Blocos ceramicos aproximados: \d+ un/i);
  assert.match(answer, /Cidade\/UF: Vit[oó]ria da Conquista\/BA/i);
  assert.doesNotMatch(answer, /comprimento da parede|altura da parede|informe area|informe .*area/i);
  assert.ok(response.pdfAction);
});

test('ELO conversacional profissional: faca com orçamento suficiente aciona PDF sem preco inventado', () => {
  const elo = loadElo();
  elo.buildResponseForTest('orçamento de parede bloco cerâmico baiano, dimensão 12 metros de comprimento e 2,5 m de altura');
  elo.buildResponseForTest('Vitória da Conquista/BA');
  const response = elo.buildResponseForTest('faça');
  const answer = response.fullAnswer || '';

  assert.ok(response.pdfAction);
  assert.match(answer, /Preço pendente de composição SINAPI\/ORSE, BDI e mês-base/i);
  assertNoInventedPrice(answer);
  assert.doesNotMatch(answer, /conte[uú]do exato/i);
});

test('ELO conversacional profissional: casa e banheiro ocultam estado interno e pdf usa orçamento atual', () => {
  let elo = loadElo();
  elo.buildResponseForTest('Quero orcar uma casa de 70m2');
  let response = elo.buildResponseForTest('Salvador/BA, padrao medio, casa terrea, 2 quartos, 1 banheiro, garagem, obra completa');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'casa deve reutilizar orçamento atual para PDF');
  assert.match(response.fullAnswer || '', /botão abaixo/i);
  assert.doesNotMatch(response.fullAnswer || '', /Servicos executaveis e quantitativos preliminares/i);

  elo = loadElo();
  elo.buildResponseForTest('Reforma de banheiro');
  response = elo.buildResponseForTest('banheiro de 4m2, troca piso e revestimento, trocar vaso e lavatorio, 2 pontos hidraulicos, 2 pontos eletricos, com demolicao, Salvador/BA');
  assertNoEloInternalState(response.fullAnswer || '');
  response = elo.buildResponseForTest('pdf');
  assert.ok(response.pdfAction, 'banheiro deve reutilizar orçamento atual para PDF');
  assert.match(response.fullAnswer || '', /botão abaixo/i);
});
