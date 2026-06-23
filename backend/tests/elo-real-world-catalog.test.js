import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");
const resultsDir = join(testDir, "..", "test-results");
const textReportPath = join(resultsDir, "elo-real-world-report.txt");
const jsonReportPath = join(resultsDir, "elo-real-world-report.json");

function normalize(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function createLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function loadEloSandbox() {
  const sandbox = {
    console,
    window: {},
    document: {
      addEventListener() {},
      createElement() {
        return {
          classList: { add() {}, remove() {}, toggle() {} },
          appendChild() {},
          focus() {},
          blur() {},
          addEventListener() {},
          setAttribute() {},
          querySelector() { return null; },
          querySelectorAll() { return []; },
          style: {}
        };
      },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      body: {
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {},
        getAttribute() { return null; },
        setAttribute() {}
      }
    },
    navigator: { userAgent: "node-test" },
    location: { hash: "", search: "", pathname: "/elo.html" },
    localStorage: createLocalStorage(),
    sessionStorage: createLocalStorage(),
    setTimeout() { return 0; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  };
  sandbox.window = {
    ...sandbox.window,
    document: sandbox.document,
    navigator: sandbox.navigator,
    location: sandbox.location,
    localStorage: sandbox.localStorage,
    sessionStorage: sandbox.sessionStorage,
    setTimeout() { return 0; },
    clearTimeout() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return true; }
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.self = sandbox.window;
  sandbox.window.globalThis = sandbox.window;

  vm.createContext(sandbox);
  [
    "elo-technical-validator.js",
    "stock-ai-composition-engine.js",
    "stock-ai-real-compositions.js",
    "elo-assistente.js"
  ].forEach((file) => {
    const source = readFileSync(join(repoRoot, "relatorio-qualidade-obras", file), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  });

  assert.ok(sandbox.window.EloAssistente?.buildResponseForTest);
  return sandbox;
}

function numbered(category, start, questions, expected, options = {}) {
  return questions.map((question, index) => ({
    id: `ELO-${String(start + index).padStart(3, "0")}`,
    categoria: category,
    pergunta: question,
    resultadoEsperado: expected,
    ...options
  }));
}

const catalog = [
  ...numbered("quantitativos", 1, [
    "Quantos blocos gasto para uma parede de 10x3?",
    "Quantos blocos cerâmicos 14x19x29 são necessários para uma parede de 42 m²?",
    "Tenho parede 12 m por 2,80 m, sem portas e sem janelas. Qual a área?",
    "Parede 8x3 com uma porta 0,80x2,10. Calcule área líquida.",
    "Quanto chapisco preciso para 50 m² de parede interna?",
    "Quanto reboco para parede de 20 m x 2,80 m nos dois lados?",
    "Quantos m² de pintura em uma parede de 5 m por 3 m?",
    "Quantas telhas cerâmicas preciso para telhado de 120 m²?",
    "Quantos pisos cerâmicos 60x60 para 36 m²?",
    "Quantos sacos de argamassa para assentar 25 m² de piso?",
    "Quantos blocos para muro 30 m por 2 m com bloco 14x19x39?",
    "Quero calcular contrapiso de 80 m² com 5 cm.",
    "Quantos m³ de areia para contrapiso de 40 m²?",
    "Quantos m³ de concreto para radier 10x12 com 10 cm?",
    "Quantos litros de tinta para 90 m²?",
    "Quantas barras de aço para uma viga de 5 m?",
    "Quantos metros de rodapé para sala 4x5?",
    "Quantos m² de forro para ambiente 3,5x4,2?",
    "Calcule o volume de concreto de 14 pilares 20x30 com 3 m.",
    "Calcule concreto de viga 15x40 com 6 m.",
    "Quantos blocos baianos para parede 15 m por 2,80 m?",
    "Tenho 3 paredes de 4 m por 2,70 m. Qual área total?",
    "Calcule área de revestimento de banheiro 2x3 com pé direito 2,60.",
    "Quantos m² de impermeabilização para laje 8x10?",
    "Quantos blocos preciso para parede com janela e porta?"
  ], ["geometria quando possível", "premissas", "não inventar composição"]),
  ...numbered("custos", 26, [
    "Quanto custa a alvenaria de uma casa de 120 m²?",
    "Qual o custo de uma parede de 100 m² com bloco 14x19x29?",
    "Orçamento de concreto fck 25 para 12 m³.",
    "Quanto custa executar 80 m² de contrapiso?",
    "Quanto custa pintar 200 m² de parede interna?",
    "Qual o custo de mão de obra para 150 m² de piso cerâmico?",
    "Quanto custa uma laje maciça de 75 m²?",
    "Faça orçamento de reboco para 60 m².",
    "Qual custo por m² de uma casa padrão médio usando SINAPI Bahia?",
    "Quanto custa construir 80 m² em Vitória da Conquista?",
    "Orçamento oficial para muro 20x2,5.",
    "Qual preço de chapisco por m²?",
    "Quanto custa concreto armado de 50 m³?",
    "Qual BDI aplicar em obra residencial pequena?",
    "Quanto custa fundação de casa térrea de 100 m²?",
    "Qual custo de telhado cerâmico 120 m²?",
    "Quanto custa assentamento de bloco cerâmico?",
    "Orçamento de pintura externa muro 40 m².",
    "Quanto custa trocar piso de um apartamento de 70 m²?",
    "Faça custo total de banheiro 2x3 com revestimento.",
    "Quanto custa mão de obra de pedreiro por dia?",
    "Quanto gasto de material para reboco de 100 m²?",
    "Qual custo de uma sapata 80x80x30?",
    "Quanto custa uma viga baldrame de 30 m?",
    "Dê um orçamento completo de residência sem composição."
  ], ["bloquear custo oficial sem base", "premissas", "base técnica"]),
  ...numbered("produtividade", 51, [
    "Qual a produtividade de pedreiro para alvenaria?",
    "Quantos dias 2 pedreiros e 2 serventes levam para 200 m² de alvenaria?",
    "Quantos homens-hora para executar 100 m² de reboco?",
    "Quantos homens-hora para assentar 1.000 blocos?",
    "Qual produtividade diária de servente em contrapiso?",
    "Quanto tempo para concretar 12 m³ com equipe de 4 pessoas?",
    "Quantos dias para pintar 300 m²?",
    "Qual equipe para chapisco de 80 m²?",
    "Quantos pedreiros preciso para levantar 60 m² de parede em 2 dias?",
    "Produtividade para assentamento de piso cerâmico.",
    "Qual produção diária de reboco interno?",
    "Equipe para executar laje de 75 m².",
    "Quantos serventes para descarregar 500 blocos?",
    "Tempo para fazer contrapiso de garagem 5x5.",
    "Quantos dias para telhado de 120 m²?",
    "Produtividade de carpinteiro em forma de viga.",
    "Produtividade de armador para CA-50.",
    "Equipe necessária para fundação de casa de 80 m².",
    "Cronograma físico para alvenaria e reboco.",
    "Prazo para obra residencial de 120 m² padrão médio."
  ], ["produtividade exige composição", "auditor", "não inventar prazo oficial"]),
  ...numbered("patologias", 71, [
    "A parede está com trinca diagonal perto da janela. O que pode ser?",
    "A laje apresenta infiltração depois da chuva.",
    "O reboco está soltando em placas.",
    "Piso cerâmico está estufando.",
    "Pintura externa descascando em menos de 6 meses.",
    "Apareceu mofo no quarto.",
    "Concreto ficou esfarelando na superfície.",
    "Parede com umidade subindo do rodapé.",
    "Fissuras finas no contrapiso recém feito.",
    "Telhado com vazamento no encontro da parede.",
    "Revestimento cerâmico oco ao bater.",
    "Trinca horizontal em muro de divisa.",
    "Porta emperrando depois da obra.",
    "Janela com infiltração na esquadria.",
    "Pilar com armadura aparecendo.",
    "Viga com fissura no meio do vão.",
    "Laje cedendo visualmente. O que fazer?",
    "Argamassa de assentamento virou pó.",
    "Bolhas na pintura interna.",
    "Cheiro de esgoto no banheiro novo.",
    "Rachadura grande na fundação.",
    "Piso drenante empoçando água.",
    "Contrapiso sem caimento no box.",
    "Manchas brancas no revestimento.",
    "Muro inclinando para o vizinho."
  ], ["orientação técnica", "alertas", "responsável técnico quando necessário"]),
  ...numbered("geometria", 96, [
    "Qual a área de uma parede 10x3?",
    "Qual volume de laje 8x10 com 12 cm?",
    "Qual perímetro de quarto 3,50x4,00?",
    "Qual área líquida de parede 12x2,80 com porta 0,90x2,10?",
    "Calcule área bruta e área líquida com duas janelas 1,20x1,00.",
    "Qual volume de pilar 20x30 com 3 m?",
    "Qual volume de viga 20x40 com 5 m?",
    "Qual área de piso de ambiente 4,2x5,3?",
    "Qual área de telhado de 6x8 com 30% de inclinação?",
    "Quantos metros lineares de rodapé em sala 4x5 com porta 0,80?",
    "Área de fachada 8 m por 6 m.",
    "Volume de concreto para sapata 80x80x30 cm.",
    "Área de reboco de duas faces em parede 20x2,8.",
    "Área de pintura em 4 paredes de quarto 3x4 e altura 2,8.",
    "Volume de contrapiso 30 m² com 4 cm.",
    "Área de muro 25 m por 2,2 m.",
    "Área de janela 1,50x1,20.",
    "Área de porta 0,80x2,10.",
    "Comprimento total de 5 vigas de 4 m.",
    "Área total de 6 cômodos de 12 m²."
  ], ["geometria imediata", "memória de cálculo"]),
  ...numbered("legislacao", 116, [
    "Qual norma usar para concreto armado?",
    "Preciso de ART para reforma pequena?",
    "Qual norma trata desempenho de edificações?",
    "Posso construir muro na divisa sem consultar prefeitura?",
    "Qual recuo obrigatório em terreno urbano?",
    "Qual largura mínima de porta de banheiro acessível?",
    "Preciso de alvará para ampliar a casa?",
    "O que é Habite-se?",
    "Qual norma para instalações elétricas residenciais?",
    "Qual norma para instalações hidráulicas?",
    "Qual responsabilidade do engenheiro em obra residencial?",
    "Posso usar SINAPI para orçamento público?",
    "BDI tem regra obrigatória?",
    "Qual documentação para regularizar obra?",
    "Preciso seguir código de obras municipal?"
  ], ["orientação", "não inventar lei local", "recomendar responsável quando aplicável"]),
  ...numbered("dono_de_casa", 131, [
    "Minha obra está gastando muito cimento. O que eu verifico?",
    "O pedreiro pediu mais areia do que o combinado.",
    "Como saber se o reboco está bem feito?",
    "O orçamento ficou 20% mais caro. É normal?",
    "Como comparar duas propostas de empreiteiro?",
    "Devo comprar material todo de uma vez?",
    "Como controlar entrada e saída de material na obra?",
    "O mestre pediu para concretar sem engenheiro. Pode?",
    "Como saber se uma trinca é perigosa?",
    "Posso trocar bloco cerâmico por bloco de concreto?",
    "Qual melhor etapa para instalar esquadrias?",
    "Como evitar desperdício de piso?",
    "O que conferir antes de pagar medição?",
    "Como organizar cronograma da reforma?",
    "Vale a pena fazer contrapiso antes do reboco?",
    "Como saber se o concreto chegou bom?",
    "O que perguntar antes de contratar pedreiro?",
    "Como conferir se a quantidade de bloco está correta?",
    "O empreiteiro não quer dar recibo.",
    "Olá"
  ], ["linguagem simples", "sem cálculo indevido", "sem auditor em saudação quando aplicável"]),
  {
    id: "ELO-151",
    categoria: "memoria_elo_10a",
    pergunta: "Minha obra Residencial Alfa fica em Vitória da Conquista-BA e tem 120 m².",
    resultadoEsperado: ["salvar memória", "resposta curta", "não iniciar cálculo"]
  },
  {
    id: "ELO-152",
    categoria: "memoria_elo_10a",
    pergunta: "Quanto custa a alvenaria?",
    resultadoEsperado: ["lembrar obra", "pedir premissas faltantes"]
  },
  {
    id: "ELO-153",
    categoria: "memoria_elo_10a",
    pergunta: "Qual produtividade da equipe?",
    resultadoEsperado: ["lembrar obra", "auditor", "bloquear produtividade oficial sem composição"]
  },
  {
    id: "ELO-154",
    categoria: "memoria_elo_10a",
    pergunta: "Atualize área para 140 m².",
    resultadoEsperado: ["atualizar memória"]
  },
  {
    id: "ELO-155",
    categoria: "memoria_elo_10a",
    pergunta: "Atualize padrão para alto padrão.",
    resultadoEsperado: ["atualizar memória"]
  },
  {
    id: "ELO-156",
    categoria: "memoria_elo_10a",
    pergunta: "Estamos na fase de acabamento.",
    resultadoEsperado: ["atualizar memória"]
  },
  {
    id: "ELO-157",
    categoria: "memoria_elo_10a",
    pergunta: "Troque para Obra Beta.",
    resultadoEsperado: ["criar contexto separado"]
  },
  ...numbered("memoria_elo_10a", 158, [
    "A Obra Beta fica em Feira de Santana-BA.",
    "A área da Obra Beta é 80 m².",
    "Qual custo de concreto para essa obra?",
    "Volte para Residencial Alfa.",
    "Quanto custa a pintura?",
    "Use como etapa atual: alvenaria.",
    "Registre que usamos bloco 14x19x29 com frequência.",
    "Obrigado",
    "Como funciona o CADISTA?",
    "Quem criou você?",
    "Boa noite",
    "Qual é a cidade da obra atual?",
    "Atualize cidade para Salvador-BA."
  ], ["continuidade", "memória discreta", "sem falso positivo"])
];

function responseToText(response) {
  if (typeof response === "string") return response;
  if (!response || typeof response !== "object") return String(response || "");
  return String(response.fullAnswer || response.answer || response.shortAnswer || JSON.stringify(response));
}
function includesAny(text, words) {
  const source = normalize(text);
  return words.some((word) => source.includes(normalize(word)));
}

function evaluateCase(caso, resposta) {
  const text = responseToText(resposta);
  const n = normalize(text);
  const observations = [];
  let status = "PASS";

  if (!text.trim()) {
    return { status: "FAIL", observacoes: ["Resposta vazia."] };
  }

  if (/sinapi\s*\d{3,}|orse\s*\d{3,}|composi[cç][aã]o\s+\d{3,}/i.test(text) && !includesAny(text, ["não localizada", "informe", "preciso", "base técnica"])) {
    status = "FAIL";
    observations.push("Possível composição oficial inventada.");
  }

  if (includesAny(caso.pergunta, ["custo", "orçamento", "preço", "quanto custa", "BDI"]) && !includesAny(text, ["SINAPI", "ORSE", "base técnica", "composição", "não localizada", "não gero custo oficial"])) {
    status = status === "FAIL" ? status : "WARNING";
    observations.push("Pergunta de custo sem referência clara à base técnica.");
  }

  if (includesAny(caso.pergunta, ["produtividade", "homens-hora", "equipe", "cronograma"]) && !includesAny(text, ["composição", "base técnica", "auditor", "produtividade", "SINAPI", "ORSE"])) {
    status = status === "FAIL" ? status : "WARNING";
    observations.push("Produtividade/equipe sem auditoria técnica evidente.");
  }

  if (caso.categoria === "geometria" && !includesAny(text, ["área", "volume", "perímetro", "m²", "m3", "m³", "metros lineares", "memória de cálculo"])) {
    status = status === "FAIL" ? status : "WARNING";
    observations.push("Geometria não apareceu de forma objetiva.");
  }

  if (caso.categoria === "patologias" && !includesAny(text, ["risco", "verifique", "engenheiro", "responsável", "causa", "inspeção", "segurança"])) {
    status = status === "FAIL" ? status : "WARNING";
    observations.push("Patologia sem orientação/alerta técnico suficiente.");
  }

  if (caso.id === "ELO-151") {
    if (!includesAny(text, ["salvei", "memória", "Residencial Alfa", "Vitória da Conquista"]) || includesAny(text, ["Memória de cálculo", "Base técnica utilizada"])) {
      status = "FAIL";
      observations.push("Cadastro de obra não foi tratado como memória curta.");
    }
  }

  if (["ELO-152", "ELO-153"].includes(caso.id)) {
    if (!includesAny(text, ["Residencial Alfa", "Vitória da Conquista", "120"])) {
      status = "FAIL";
      observations.push("Memória da obra não foi reutilizada.");
    }
  }

  if (["ELO-166", "ELO-168", "ELO-169", "ELO-170"].includes(caso.id) || caso.pergunta === "Olá" || caso.pergunta === "Obrigado" || caso.pergunta === "Boa noite") {
    if (includesAny(text, ["Memória de cálculo", "Base técnica utilizada", "Alertas do auditor"])) {
      status = "FAIL";
      observations.push("Falso positivo: conversa simples ativou estrutura técnica.");
    }
  }

  if (text.length > 3000) {
    status = status === "FAIL" ? status : "WARNING";
    observations.push("Resposta excessivamente longa para experiência real.");
  }

  if (!observations.length) {
    observations.push("Nenhuma");
  }

  return { status, observacoes: observations };
}

function buildTextReport(report) {
  const lines = [];
  lines.push("STRESS TEST PROFISSIONAL DO ELO - COBERTURA REAL");
  lines.push(`Gerado em: ${report.generatedAt}`);
  lines.push("");
  lines.push(`TOTAL: ${report.total}`);
  lines.push(`PASS: ${report.passed}`);
  lines.push(`WARNING: ${report.warnings}`);
  lines.push(`FAIL: ${report.failed}`);
  lines.push("");
  lines.push("Casos com FAIL:");
  report.cases.filter((item) => item.status === "FAIL").forEach((item) => lines.push(`* ${item.id}`));
  if (!report.cases.some((item) => item.status === "FAIL")) lines.push("* Nenhum");
  lines.push("");
  lines.push("Casos com WARNING:");
  report.cases.filter((item) => item.status === "WARNING").forEach((item) => lines.push(`* ${item.id}`));
  if (!report.cases.some((item) => item.status === "WARNING")) lines.push("* Nenhum");
  lines.push("");

  report.cases.forEach((item) => {
    lines.push("==================================================");
    lines.push(`CASO: ${item.id}`);
    lines.push(`CATEGORIA: ${item.categoria}`);
    lines.push("========================");
    lines.push("");
    lines.push("PERGUNTA:");
    lines.push(item.pergunta);
    lines.push("");
    lines.push("RESPOSTA:");
    lines.push(item.resposta);
    lines.push("");
    lines.push("RESULTADO ESPERADO:");
    item.resultadoEsperado.forEach((expected) => lines.push(`* ${expected}`));
    lines.push("");
    lines.push("STATUS:");
    lines.push(item.status);
    lines.push("");
    lines.push("OBSERVAÇÕES:");
    item.observacoes.forEach((observation) => lines.push(observation === "Nenhuma" ? "Nenhuma" : `* ${observation}`));
    lines.push("");
  });

  return lines.join("\n");
}

test("Elo real-world catalog gera relatorio auditavel de 170 cenarios", () => {
  assert.equal(catalog.length, 170);
  mkdirSync(resultsDir, { recursive: true });

  const sandbox = loadEloSandbox();
  const cases = catalog.map((caso) => {
    const resposta = sandbox.window.EloAssistente.buildResponseForTest(caso.pergunta);
    const evaluation = evaluateCase(caso, resposta);
    return {
      id: caso.id,
      categoria: caso.categoria,
      pergunta: caso.pergunta,
      resposta: responseToText(resposta),
      resultadoEsperado: caso.resultadoEsperado,
      status: evaluation.status,
      observacoes: evaluation.observacoes
    };
  });

  const categories = {};
  cases.forEach((item) => {
    categories[item.categoria] ||= { total: 0, passed: 0, failed: 0, warnings: 0 };
    categories[item.categoria].total += 1;
    if (item.status === "PASS") categories[item.categoria].passed += 1;
    if (item.status === "FAIL") categories[item.categoria].failed += 1;
    if (item.status === "WARNING") categories[item.categoria].warnings += 1;
  });

  const report = {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    passed: cases.filter((item) => item.status === "PASS").length,
    failed: cases.filter((item) => item.status === "FAIL").length,
    warnings: cases.filter((item) => item.status === "WARNING").length,
    categories,
    cases
  };

  writeFileSync(jsonReportPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(textReportPath, buildTextReport(report), "utf8");

  assert.equal(report.total, 170);
  assert.ok(existsSync(jsonReportPath));
  assert.ok(existsSync(textReportPath));
});
