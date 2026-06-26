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

function loadAssistant() {
  const calls = { router: 0, technical: 0, composition: 0 };
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {} },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost" },
      localStorage: createStorage({
        obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" })
      }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() {
        throw new Error("fetch nao deve ser chamado em saudacao simples");
      },
      EloBrainRouter: {
        routeEloBrain() {
          calls.router += 1;
          throw new Error("EloBrainRouter nao deve ser chamado em saudacao simples");
        }
      },
      EloTechnicalEngine: {
        buildResponse() {
          calls.technical += 1;
          throw new Error("EloTechnicalEngine nao deve ser chamado em saudacao simples");
        }
      },
      CompositionSearchEngine: {
        searchOfficialCompositions() {
          calls.composition += 1;
          throw new Error("CompositionSearchEngine nao deve ser chamado em saudacao simples");
        }
      }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls };
}

test("Elo responde oi pelo fast-path sem base tecnica", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("oi");

  assert.equal(response.fastPath, "greeting");
  assert.equal(response.sessionIntent, "cumprimento_instantaneo");
  assert.match(response.shortAnswer, /Oi, Icaro\. Estou pronto\./);
  assert.match(response.fullAnswer, /SINAPI|obra/i);
  assert.deepEqual(calls, { router: 0, technical: 0, composition: 0 });
});

test("Elo responde ola sem chamar CompositionSearchEngine", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("ol\u00e1");

  assert.equal(response.fastPath, "greeting");
  assert.doesNotMatch(response.fullAnswer, /area|dimensao|composicao de parede/i);
  assert.equal(calls.composition, 0);
  assert.equal(calls.router, 0);
  assert.equal(calls.technical, 0);
});

test("Elo responde bom dia sem parser de orcamento", () => {
  const { assistant, calls } = loadAssistant();
  const startedAt = performance.now();
  const response = assistant.buildResponseForTest("bom dia");
  const elapsedMs = performance.now() - startedAt;

  assert.equal(response.fastPath, "greeting");
  assert.match(response.shortAnswer, /Bom dia, Icaro\. Estou pronto\./);
  assert.equal(calls.router, 0);
  assert.equal(calls.technical, 0);
  assert.ok(elapsedMs < 50, "saudacao simples deve ser respondida sem rotina pesada");
});