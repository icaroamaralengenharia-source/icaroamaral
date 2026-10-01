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
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function loadAssistant() {
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/elo.html" },
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() { throw new Error("fetch nao deve ser chamado no detector de intent RDO"); }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return sandbox.window.EloAssistente;
}

test("ELO roteia frases de RDO para actions reais do Action Bus", () => {
  const assistant = loadAssistant();
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("liste os RDOs desta obra")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.list", payload: { message: "liste os RDOs desta obra" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("abra o RDO de ontem")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.get", payload: { message: "abra o RDO de ontem" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("quais problemas se repetiram nos ultimos 30 dias?")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.problemsByPeriod", payload: { message: "quais problemas se repetiram nos ultimos 30 dias?" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("quais RDOs existem?")), JSON.stringify({ module: "obrareport_rdo", action: "rdo.list", payload: { message: "quais RDOs existem?" } }));
  assert.equal(JSON.stringify(assistant.detectCommandBridgeRequestForTest("crie um RDO para hoje")), JSON.stringify({ module: "obrareport_rdo", action: "preview_new_rdo", payload: { message: "crie um RDO para hoje" } }));
  assert.equal(assistant.detectCommandBridgeRequestForTest("rota invalida rdo step04"), null);
  assert.equal(assistant.detectCommandBridgeRequestForTest("rdo banana xyz"), null);
});
