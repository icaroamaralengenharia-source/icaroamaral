import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import {
  createApp,
  createEloVectorMemoryStore_,
  detectEloIntent_,
  interpretEloUserMessage,
  routeEloRequest_
} from "../src/app.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, "..", "..");

const HARDENING_CASES = [
  ...cases("saudacoes", "geral", [
    ["oi", { brain: "conversational", include: /elo|aqui|ajudar|conversar|pronto/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["olá", { brain: "conversational", include: /elo|aqui|ajudar|conversar|pronto/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["bom dia", { brain: "conversational", include: /bom dia|elo|ajudar|pronto/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["hi", { brain: "conversational", include: /hi|hello|elo|ajudar|pronto/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["e aí", { brain: "conversational", include: /elo|aqui|ajudar|conversar|pronto/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["teste", { brain: "conversational", include: /teste|elo|responder|ajudar/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }],
    ["você está aí?", { brain: "conversational", include: /sim|estou|aqui|elo/i, exclude: /sinapi|orse|or[cç]amento|5 etapas/i }]
  ]),
  ...cases("roteamento", "obras", [
    ["quero orçamento residencial", { brain: "budget", category: "orçamento", include: /or[cç]amento|residencial|cidade|area|padr[aã]o/i, exclude: /rdo|di[aá]rio|cadista/i }],
    ["orça uma parede de bloco cerâmico", { brain: "budget", category: "orçamento", include: /parede|bloco|or[cç]amento|compos/i, exclude: /rdo|relat[oó]rio gen[eé]rico/i }],
    ["parede de bloco baiano 8x3", { brain: "technical", category: "cálculo", include: /parede|bloco|8|3|m2|m²|premissa|dimens/i }],
    ["quanto custa tudo?", { brain: "budget", category: "orçamento", include: /dado|escopo|quantidade|or[cç]amento|base/i, exclude: /valor oficial garantido|sample como real/i }],
    ["gerar RDO de hoje", { brain: "rdo", category: "relatório", include: /rdo|di[aá]rio|obra|data|equipe|servi[cç]os/i, exclude: /or[cç]amento/i }],
    ["fazer relatório de infiltração", { brain: "report", category: "relatório", include: /relat[oó]rio|infiltra|vistoria|foto|dados|triagem/i, exclude: /or[cç]amento/i }],
    ["analisar trinca em viga", { brain: "report", category: "relatório", include: /trinca|viga|vistoria|foto|dados|diagn[oó]stico/i, exclude: /or[cç]amento autom[aá]tico/i }],
    ["abrir CADISTA", { brain: "cadista", category: "cadista", include: /cadista|planta|projeto|terreno|briefing/i, exclude: /or[cç]amento autom[aá]tico/i }],
    ["quero gerar uma planta", { brain: "cadista", category: "cadista", include: /planta|cadista|terreno|ambiente|projeto/i, exclude: /or[cç]amento autom[aá]tico/i }],
    ["dar baixa no estoque da obra", { brain: "stock_obras", category: "estoque", include: /estoque|obra|baixa|saldo|material/i, exclude: /stock full/i }],
    ["estou cansado desse orçamento", { brain: "support", include: /entendi|vamos|simplificar|pr[oó]ximo passo|or[cç]amento/i, exclude: /fluxo t[eé]cnico pesado|sinapi/i }],
    ["que saco, isso não funciona", { brain: "support", include: /entendi|vamos|corrigir|simplificar|problema|passo/i, exclude: /sinapi|orse|composi[cç][aã]o/i }]
  ]),
  ...cases("orcamento", "obras", [
    ["quero orçamento de uma casa de 80m2", { brain: "budget", include: /80|m2|casa|or[cç]amento|cidade|padr[aã]o/i }],
    ["parede de bloco cerâmico 14x19x29 com 20m por 2,80", { brain: "budget", include: /parede|bloco|20|2,?80|compos|quant/i }],
    ["quanto vai dar mais ou menos?", { brain: "budget", include: /estimativa|dado|base|or[cç]amento|escopo/i }],
    ["inclui mão de obra?", { brain: "budget", include: /m[aã]o de obra|compos|produtividade|encargos/i }],
    ["me diga só os materiais", { brain: "budget", include: /materiais|quantitativo|sem valor|premissa/i }],
    ["continuar meu orçamento", { brain: "budget", include: /continuar|or[cç]amento|contexto|dados/i }],
    ["usar tabela própria SAMPLE", { brain: "budget", include: /sample|demonstra|teste|n[aã]o.*real|base oficial/i, exclude: /(?:usar|usa|usando).{0,20}(?:pre[cç]o|valor) real/i }],
    ["usar tabela teste", { brain: "budget", include: /teste|demonstra|n[aã]o.*real|base oficial/i, exclude: /(?:usar|usa|usando).{0,20}(?:pre[cç]o|valor) real/i }],
    ["orçar reboco de 50m2", { brain: "budget", include: /reboco|50|m2|compos|sinapi|orse|dados/i }],
    ["quanto gasta de bloco numa parede 8x3?", { brain: "technical", include: /bloco|parede|8|3|quant|premissa/i }]
  ]),
  ...cases("relatorios", "obras", [
    ["fazer relatório de infiltração na parede", { brain: "report", include: /relat[oó]rio|infiltra|parede|vistoria|foto|dados/i, exclude: /art garantida|conclus[aã]o definitiva/i }],
    ["analisar fissura diagonal", { brain: "report", include: /fissura|diagonal|vistoria|foto|dados|triagem/i, exclude: /conclus[aã]o definitiva/i }],
    ["relatório de vistoria com fotos", { brain: "report", include: /relat[oó]rio|vistoria|fotos|evid[eê]ncia|estrutura/i }],
    ["tem mofo no teto do banheiro", { brain: "report", include: /mofo|teto|banheiro|umidade|foto|ventila/i }],
    ["preciso de laudo", { brain: "report", include: /laudo|relat[oó]rio|responsabilidade|vistoria|profissional/i, exclude: /art garantida/i }]
  ]),
  ...cases("rdo", "obras", [
    ["gerar RDO de hoje", { brain: "rdo", include: /rdo|di[aá]rio|obra|data|equipe|servi[cç]os/i, exclude: /or[cç]amento/i }],
    ["diário de obra com 4 pedreiros e 2 serventes", { brain: "rdo", include: /di[aá]rio|rdo|4 pedreiros|2 serventes|equipe/i, exclude: /or[cç]amento/i }],
    ["teve chuva e concretagem da laje", { brain: "rdo", include: /chuva|concretagem|laje|rdo|ocorr[eê]ncia|registro/i }],
    ["registrar ocorrência de atraso de material", { brain: "rdo", include: /ocorr[eê]ncia|atraso|material|rdo|registro/i }]
  ]),
  ...cases("cadista", "geral", [
    ["abrir CADISTA", { brain: "cadista", include: /cadista|planta|projeto|briefing/i, exclude: /or[cç]amento/i }],
    ["quero gerar uma planta", { brain: "cadista", include: /planta|cadista|terreno|ambiente|projeto/i, exclude: /or[cç]amento/i }],
    ["terreno 10x20 com 3 quartos", { brain: "cadista", include: /terreno|10x20|3 quartos|planta|ambientes/i, exclude: /or[cç]amento autom[aá]tico/i }],
    ["fazer planta com suíte e garagem", { brain: "cadista", include: /planta|su[ií]te|garagem|cadista|ambientes/i, exclude: /patologia|or[cç]amento autom[aá]tico/i }]
  ]),
  ...cases("robustez", "obras", [
    ["", { include: /mensagem|pergunta|ajudar|elo/i }],
    ["   ", { include: /mensagem|pergunta|ajudar|elo/i }],
    ["a".repeat(5000), { include: /elo|ajudar|contexto|mensagem|responder/i }],
    ["orÃ§amento de parede 8x3 com bloco cerÃ¢mico", { include: /parede|bloco|8|3|or|quant|dados/i }],
    ["qnto gasta d bloko numa parede 8x3?", { include: /parede|bloco|8|3|premissa|quant/i }],
    ["hi, how can I make a report?", { include: /report|relat[oó]rio|elo|help|ajudar/i }],
    ["parede 8 metros por 3 m, 24 m2, 24 m²", { include: /parede|24|m2|m²|metros|premissa/i }],
    ["parede 8,5x3.20", { include: /parede|8,5|3.20|m2|m²|premissa/i }],
    ["oi oi oi oi oi", { include: /elo|aqui|ajudar|conversar/i }],
    ["quanto custa?", { include: /dado|escopo|quantidade|base|or[cç]amento/i }]
  ])
];

const SYNTHETIC_PERFORMANCE_MESSAGES = Array.from({ length: 200 }, (_, index) => {
  const pool = [
    "oi",
    "quero orçamento residencial",
    "parede de bloco cerâmico 8x3",
    "gerar RDO de hoje",
    "fazer relatório de infiltração",
    "abrir CADISTA",
    "dar baixa no estoque da obra",
    "que saco, isso não funciona"
  ];
  return pool[index % pool.length] + " #" + index;
});

const runStats = [];

test("ELO hardening valida superficies publicas", () => {
  const rootElo = readFileSync(join(repoRoot, "elo.html"), "utf8");
  const stockObras = readFileSync(join(repoRoot, "stock-ai-obras.html"), "utf8");
  const obraReport = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html"), "utf8");

  assert.match(rootElo, /data-elo-mode="standalone"/);
  assert.match(rootElo, /relatorio-qualidade-obras\/elo-assistente\.js/);
  assert.match(stockObras, /data-elo-product="stock-ai-obras"/);
  assert.match(stockObras, /relatorio-qualidade-obras\/elo-assistente\.js/);
  assert.match(obraReport, /elo-assistente\.js/);
});

test("ELO hardening executa matriz pesada pelo widget e exports reais", () => {
  const sandbox = loadEloWidgetSandbox_();
  const failures = [];

  for (const item of HARDENING_CASES) {
    const started = performance.now();
    const response = sandbox.window.EloAssistente.buildResponseForTest(item.message);
    const answer = responseText_(response);
    const elapsedMs = performance.now() - started;
    const exportedIntent = detectEloIntent_(item.message, { eloContext: item.context });
    const operationalRoute = routeEloRequest_({ message: item.message, context: { eloContext: item.context } });
    const interpretation = interpretEloUserMessage({ message: item.message, context: item.context });

    const record = { ...item, elapsedMs, answer, brain: response && response.brain, exportedIntent, operationalRoute, interpretation };
    runStats.push(record);

    collectAssertion_(failures, record, () => assertValidAnswer_(answer));
    if (item.expect.brain) collectAssertion_(failures, record, () => assert.equal(response.brain, item.expect.brain));
    if (item.expect.category) collectAssertion_(failures, record, () => assert.ok(exportedIntent.categories.includes(item.expect.category), "categoria ausente: " + item.expect.category));
    if (item.expect.include) collectAssertion_(failures, record, () => assert.match(answer, item.expect.include));
    if (item.expect.exclude) collectAssertion_(failures, record, () => assert.doesNotMatch(answer, item.expect.exclude));
    collectAssertion_(failures, record, () => assertNoForbiddenProductMix_(record));
  }

  printHardeningSummary_("matriz", runStats.filter((item) => item.source !== "performance"), failures);
  assert.equal(failures.length, 0, formatFailures_(failures));
});

test("ELO hardening valida /api/elo/chat sem IA externa real", async () => {
  const originalFetch = globalThis.fetch;
  const openAiCalls = [];
  const failures = [];
  globalThis.fetch = buildMockedOpenAiFetch_(originalFetch, openAiCalls);

  try {
    await withTemporaryEloServer_(async (baseUrl) => {
      const client = createEloConversationClient_(baseUrl);
      for (const item of HARDENING_CASES.slice(0, 30)) {
        const started = performance.now();
        const data = await client.ask(item.message, item.context);
        const elapsedMs = performance.now() - started;
        const record = { ...item, source: "api", elapsedMs, answer: data.answer, data };
        runStats.push(record);
        collectAssertion_(failures, record, () => assert.equal(data.ok, true));
        collectAssertion_(failures, record, () => assertValidAnswer_(data.answer));
        collectAssertion_(failures, record, () => assertNoForbiddenProductMix_(record));
      }
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.ok(openAiCalls.length > 0, "o mock local deve interceptar chamadas OpenAI");
  printHardeningSummary_("api", runStats.filter((item) => item.source === "api"), failures);
  assert.equal(failures.length, 0, formatFailures_(failures));
});

test("ELO hardening performance lote 200 mensagens", () => {
  const sandbox = loadEloWidgetSandbox_();
  const failures = [];
  const batchStats = [];

  for (const message of SYNTHETIC_PERFORMANCE_MESSAGES) {
    const started = performance.now();
    const response = sandbox.window.EloAssistente.buildResponseForTest(message);
    const elapsedMs = performance.now() - started;
    const record = { source: "performance", category: "performance", context: "obras", message, elapsedMs, answer: responseText_(response), brain: response && response.brain };
    batchStats.push(record);
    runStats.push(record);
    collectAssertion_(failures, record, () => assertValidAnswer_(record.answer));
    collectAssertion_(failures, record, () => assert.ok(record.answer.length <= 6000, "resposta longa demais"));
  }

  printHardeningSummary_("performance", batchStats, failures);
  assert.equal(batchStats.length, 200);
  assert.equal(failures.length, 0, formatFailures_(failures));
});

function cases(category, context, entries) {
  return entries.map(([message, expect]) => ({ category, context, message, expect }));
}

function loadEloWidgetSandbox_() {
  const storage = new Map();
  const element = {
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    dataset: {},
    textContent: "",
    value: "",
    focus() {},
    blur() {}
  };
  const sandbox = {
    console,
    setTimeout() { return 0; },
    clearTimeout() {},
    Math,
    Date,
    JSON,
    RegExp,
    Number,
    String,
    Array,
    Object,
    URLSearchParams,
    location: { hostname: "127.0.0.1", protocol: "http:", pathname: "/elo.html", search: "", hash: "" },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); },
      clear() { storage.clear(); }
    },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      body: { dataset: {}, getAttribute() { return ""; }, appendChild() {} },
      readyState: "complete",
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return Object.assign({}, element); }
    },
    navigator: { userAgent: "node-test" },
    fetch: async () => ({ ok: false, json: async () => ({}) })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.ELO_SKIP_AUTO_WIDGET = true;
  sandbox.ELO_DISABLE_AUTOFOCUS = true;
  sandbox.ObraReportOperationalStock = { getAlmoxBalances() { return []; } };

  vm.createContext(sandbox);
  ["elo-technical-validator.js", "stock-ai-composition-engine.js", "stock-ai-real-compositions.js", "elo-assistente.js"].forEach((file) => {
    const source = readFileSync(join(repoRoot, "relatorio-qualidade-obras", file), "utf8");
    vm.runInContext(source, sandbox, { filename: file });
  });

  assert.ok(sandbox.window.EloAssistente && sandbox.window.EloAssistente.buildResponseForTest);
  return sandbox;
}

async function withTemporaryEloServer_(callback) {
  const app = createApp({
    env: { PORT: "0", AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500", OPENAI_API_KEY: "test-key" },
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  });
  const instance = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  try {
    await callback("http://127.0.0.1:" + instance.address().port);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

function createEloConversationClient_(baseUrl) {
  const history = [];
  return {
    async ask(message, eloContext) {
      const response = await fetch(baseUrl + "/api/elo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, context: { eloContext, deviceId: "elo-hardening-device", location: { pathname: "/elo.html", hash: "" } } })
      });
      const data = await response.json();
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: data.answer || "" });
      return data;
    }
  };
}

function buildMockedOpenAiFetch_(originalFetch, openAiCalls) {
  return async function mockedFetch(url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const message = extractLatestEloMessage_(payload.input);
      openAiCalls.push({ message });
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: buildMockedEloAnswer_(message) }] }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
}

function extractLatestEloMessage_(input) {
  const latest = Array.isArray(input) ? input[input.length - 1] : null;
  const content = String(latest && latest.content ? latest.content : "");
  const match = content.match(/Mensagem original do usu[áa]rio:\s*([\s\S]*?)\n\s*Mensagem interpretada:/i);
  return match && match[1] ? match[1].trim() : content.trim();
}

function buildMockedEloAnswer_(message) {
  const text = normalizeText_(message);
  if (/^(oi|ola|bom dia|hi|e ai|teste|voce esta ai)/.test(text)) return "Estou aqui. Sou o Elo e posso ajudar sem abrir fluxo tecnico pesado.";
  if (/rdo|diario/.test(text)) return "Fluxo RDO: preciso confirmar obra, data, equipe, servicos executados, clima e ocorrencias.";
  if (/relatorio|infiltra|fissura|trinca|mofo|laudo/.test(text)) return "Fluxo de relatorio tecnico: vou estruturar vistoria, evidencias, fotos, dados e limites sem conclusao definitiva.";
  if (/cadista|planta|terreno|suite|garagem/.test(text)) return "Fluxo CADISTA: vamos organizar terreno, ambientes, quartos, garagem e premissas para planta.";
  if (/estoque|baixa|material/.test(text)) return "Fluxo Stock Obras: registrar material, saldo e baixa da obra sem misturar com Stock Full.";
  if (/cansado|saco|nao funciona/.test(text)) return "Entendi. Vamos simplificar o problema e pegar o proximo passo com calma.";
  if (/orcamento|orca|quanto custa|reboco|parede|bloco|material|mao de obra|sample|teste/.test(text)) return "Fluxo de orcamento: preciso de escopo, quantidade, base tecnica e nao uso SAMPLE/TEST como preco real.";
  return "Resposta valida do Elo para conversa simples com contexto.";
}

function responseText_(response) {
  return [response && response.shortAnswer, response && response.fullAnswer, response && response.nextAction].map((value) => String(value || "").trim()).filter(Boolean).join("\n");
}

function assertValidAnswer_(answer) {
  assert.equal(typeof answer, "string");
  assert.ok(answer.trim().length > 0, "resposta vazia");
  assert.doesNotMatch(answer, /undefined|null|TypeError|ReferenceError|stack trace|^\s*at\s+\w+/i);
}

function assertNoForbiddenProductMix_(record) {
  if (/cadista|planta/i.test(record.message)) assert.doesNotMatch(record.answer, /or[cç]amento autom[aá]tico|patologia/i);
  if (/rdo|di[aá]rio/i.test(record.message)) assert.doesNotMatch(record.answer, /or[cç]amento residencial|SINAPI como fluxo principal/i);
  if (/stock obras|estoque da obra|baixa no estoque/i.test(record.message)) assert.doesNotMatch(record.answer, /Stock Full como destino/i);
  if (/sample|tabela teste/i.test(record.message)) assert.doesNotMatch(record.answer, /(?:usar|usa|usando).{0,20}(?:pre[cç]o|valor) real|base oficial confirmada/i);
}

function collectAssertion_(failures, record, assertion) {
  try {
    assertion();
  } catch (error) {
    failures.push({
      category: record.category,
      message: record.message,
      elapsedMs: record.elapsedMs,
      brain: record.brain,
      route: record.operationalRoute,
      intent: record.exportedIntent,
      error: error && error.message ? error.message : String(error),
      answer: String(record.answer || "").slice(0, 600)
    });
  }
}

function printHardeningSummary_(label, stats, failures) {
  const total = stats.length;
  const failedKeys = new Set(failures.map((failure) => failure.category + "::" + failure.message));
  const elapsed = stats.map((item) => item.elapsedMs || 0);
  const avg = elapsed.length ? elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length : 0;
  const max = elapsed.length ? Math.max(...elapsed) : 0;
  const categoriesWithFailure = [...new Set(failures.map((failure) => failure.category))];
  const slowest = stats.slice().sort((a, b) => (b.elapsedMs || 0) - (a.elapsedMs || 0)).slice(0, 10);

  console.log("\n[ELO HARDENING] " + label);
  console.log("total de casos:", total);
  console.log("aprovados:", Math.max(0, total - failedKeys.size));
  console.log("falhas:", failedKeys.size);
  console.log("categorias com falha:", categoriesWithFailure.join(", ") || "nenhuma");
  console.log("tempo medio por caso:", avg.toFixed(2) + "ms");
  console.log("tempo maximo por caso:", max.toFixed(2) + "ms");
  console.log("top 10 mensagens lentas/problematicas:");
  slowest.forEach((item, index) => console.log(String(index + 1).padStart(2, "0") + ". " + (item.elapsedMs || 0).toFixed(2) + "ms - " + item.category + " - " + item.message));
  if (failures.length) {
    console.log("top 10 mensagens problemáticas:");
    failures.slice(0, 10).forEach((failure, index) => console.log(String(index + 1).padStart(2, "0") + ". [" + failure.category + "] " + failure.message + " -> " + failure.error));
  }
}

function formatFailures_(failures) {
  return failures.map((failure, index) => [
    String(index + 1) + ". [" + failure.category + "] " + failure.message,
    "erro: " + failure.error,
    "brain: " + failure.brain,
    "resposta: " + failure.answer
  ].join("\n")).join("\n\n");
}

function normalizeText_(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
