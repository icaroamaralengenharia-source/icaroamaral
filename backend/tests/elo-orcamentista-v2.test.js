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
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function loadAssistant(pathname = "/elo.html") {
  const calls = { router: 0, technical: 0, composition: 0 };
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname },
      localStorage: createStorage({
        obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" })
      }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() {
        throw new Error("fetch nao deve ser chamado pelo orcamentista local");
      },
      EloBrainRouter: {
        routeEloBrain() {
          calls.router += 1;
          throw new Error("EloBrainRouter nao deve ser chamado antes do Orcamentista V2");
        }
      },
      EloTechnicalEngine: {
        buildResponse() {
          calls.technical += 1;
          throw new Error("EloTechnicalEngine nao deve ser chamado antes do Orcamentista V2");
        }
      },
      CompositionSearchEngine: {
        searchOfficialCompositions() {
          calls.composition += 1;
          return [];
        }
      }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls };
}

test("Orcamentista V2 inicia briefing residencial sem buscar SINAPI direto", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar");

  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.match(response.fullAnswer, /area construida/i);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /padrao construtivo/i);
  assert.equal(calls.router, 0);
  assert.equal(calls.technical, 0);
  assert.equal(calls.composition, 0);
});

test("Orcamentista V2 continua briefing com area cidade e padrao sem reiniciar fluxo", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.equal(state.type, "residential");
  assert.equal(state.areaM2, 120);
  assert.equal(state.state, "BA");
  assert.match(state.city, /Vitoria da Conquista/i);
  assert.match(response.fullAnswer, /Escopo preliminar/i);
  assert.match(response.fullAnswer, /Servicos preliminares/i);
  assert.match(response.fullAnswer, /Limpeza final/i);
});

test("Orcamentista V2 monta escopo para casa completa e avisa pendencias", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("quanto custa construir uma casa terrea de 100 m2 padrao simples?");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(state.type, "residential");
  assert.equal(state.areaM2, 100);
  assert.equal(state.standard, "simples");
  assert.match(response.fullAnswer, /Escopo preliminar/i);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /nao vou inventar preco/i);
});

test("Orcamentista V2 preserva fluxo de parede", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("orca uma parede de bloco baiano 8 metros por 2,80");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(state.type, "wall");
  assert.doesNotMatch(response.fullAnswer, /ORCAMENTO RESIDENCIAL PRELIMINAR/i);
  assert.match(response.fullAnswer, /parede|bloco|comprimento|altura|vãos|vaos|composição|composicao/i);
});

test("Orcamentista V2 nao inventa preco sem composicao oficial", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("quanto custa construir uma casa terrea de 100 m2 padrao simples?");

  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/i);
  assert.match(response.fullAnswer, /pendente de composicao SINAPI\/ORSE oficial|nao vou inventar preco/i);
});

test("Orcamentista V2 segue disponivel nas tres superficies compartilhadas", () => {
  ["/elo.html", "/stock-ai-obras.html", "/relatorio-qualidade-obras/relatorio-qualidade-obras.html"].forEach((pathname) => {
    const { assistant } = loadAssistant(pathname);
    const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar");
    assert.equal(typeof assistant.ask, "function", pathname);
    assert.equal(response.sessionIntent, "budget_v2_briefing", pathname);
    assert.match(response.fullAnswer, /ELO ORCAMENTISTA V2/i, pathname);
  });
});
