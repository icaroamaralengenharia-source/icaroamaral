import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
}

function loadAssistant(options = {}) {
  const fetchCalls = [];
  const sandbox = {
    console,
    setTimeout(fn) {
      if (typeof fn === "function") fn();
      return 0;
    },
    clearTimeout() {},
    document: {
      readyState: "complete",
      documentElement: { style: { setProperty() {} } },
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; },
      createElement(tag) {
        return {
          tagName: String(tag || "").toUpperCase(),
          dataset: {},
          style: {},
          classList: { add() {}, remove() {}, toggle() {} },
          appendChild() {},
          addEventListener() {},
          setAttribute() {},
          getAttribute() { return ""; },
          querySelector() { return null; },
          querySelectorAll() { return []; },
          textContent: "",
          value: ""
        };
      }
    },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_PRODUCT_MODE: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/elo.html" },
      localStorage: createStorage(options.localStorage || {}),
      sessionStorage: createStorage(),
      performance: { mark() {}, now() { return 0; } },
      requestAnimationFrame(fn) {
        if (typeof fn === "function") fn();
      },
      fetch(url, config) {
        const payload = JSON.parse(config && config.body ? config.body : "{}");
        fetchCalls.push({ url: String(url), payload });
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            ok: true,
            answer: "Resposta pesquisada: " + payload.query,
            sources: ["https://fonte.example/dado-vivo"]
          })
        });
      }
    },
    navigator: { userAgent: "node-test" }
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, fetchCalls };
}

test("conversa comum nao cai em template tecnico ou operacional", () => {
  const { assistant } = loadAssistant();
  const cases = ["oi", "tu sabe fazer nada", "por que o ceu e azul?"];

  for (const message of cases) {
    const response = assistant.buildResponseForTest(message);
    const answer = [response.shortAnswer, response.fullAnswer, response.nextAction].filter(Boolean).join("\n");
    assert.equal(response.brain, "conversational", message);
    assert.doesNotMatch(answer, /Prefer[eê]ncia de resposta|Pr[oó]xima a[cç][aã]o|Resposta principal|Base t[eé]cnica|Mem[oó]ria de c[aá]lculo/i);
    assert.doesNotMatch(answer, /Posso te ajudar por alguns caminhos|biblioteca|projeto\/mem[oó]ria/i);
  }
});

test("busca viva e conhecimento estavel roteiam corretamente", () => {
  const { assistant } = loadAssistant();
  const liveCases = [
    "quem e atualmente o presidente do Brasil?",
    "qual e a previsao do tempo para Vitoria da Conquista hoje?",
    "qual e o preco atual do cimento na Bahia?"
  ];

  for (const message of liveCases) {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionIntent, "meta_web_search", message);
    assert.equal(response.needsLiveSearch, true, message);
    assert.equal(response.action.type, "meta_web_search", message);
  }

  const stable = assistant.buildResponseForTest("o que e concreto armado?");
  assert.notEqual(stable.sessionIntent, "meta_web_search");
  assert.notEqual(stable.brain, "budget");
});

test("parede completa composta nao vira pintura nem MVP V1", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("quero um orçamento de uma parede de 20 x 2,80 bloco cerâmico baiano, chapisco, emboço reboco e pintura dos dois lados");
  const answer = [response.shortAnswer, response.fullAnswer, response.nextAction].filter(Boolean).join("\n");

  assert.equal(response.sessionIntent, "budget_v2_wall_complete_created");
  assert.equal(response.brain, "budget");
  assert.match(answer, /20(?:,00)?\s*m/i);
  assert.match(answer, /2,80\s*m/i);
  assert.match(answer, /56(?:,00)?\s*m/i);
  assert.match(answer, /dois lados|duas faces/i);
  assert.match(answer, /alvenaria/i);
  assert.match(answer, /chapisco/i);
  assert.match(answer, /embo[cç]o/i);
  assert.match(answer, /reboco/i);
  assert.match(answer, /pintura/i);
  assert.ok(response.budgetDocumentData, "budgetDocumentData deve existir");
  assert.equal(response.pdfAction && response.pdfAction.type, "budget_v2_professional_pdf");
  assert.doesNotMatch(answer, /apenas pintura|Vou tratar isso como pintura|MVP Elo Orcamentista Assistido v1/i);
});

test("helper de busca executa backend e preserva fontes", async () => {
  const { assistant, fetchCalls } = loadAssistant();
  const result = await assistant.requestWebSearchForTest("quem e atualmente o presidente do Brasil?");

  assert.equal(fetchCalls.length, 1);
  assert.match(fetchCalls[0].url, /\/api\/elo\/web-search$/);
  assert.equal(fetchCalls[0].payload.query, "quem e atualmente o presidente do Brasil?");
  assert.match(result, /Resposta pesquisada/);
  assert.match(result, /https:\/\/fonte\.example\/dado-vivo/);
});
