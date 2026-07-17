import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); },
    dump() { return Object.fromEntries(data.entries()); }
  };
}

function loadRouter(options = {}) {
  const localStorage = createStorage();
  const calls = { original: 0 };
  const sandbox = {
    console,
    window: {
      localStorage,
      location: { href: "http://localhost/relatorio-qualidade-obras.html" },
      EloAssistente: {
        buildResponseForTest(message) {
          calls.original += 1;
          return {
            shortAnswer: "original",
            fullAnswer: "original: " + message,
            sessionIntent: "original_flow"
          };
        },
        buildResponse(message) {
          calls.original += 1;
          return {
            shortAnswer: "original",
            fullAnswer: "original: " + message,
            sessionIntent: "original_flow"
          };
        }
      },
      EloTechnicalServiceBridge: options.bridge || null
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  const files = options.withRegistry === false
    ? ["elo-technical-service-router.js"]
    : ["elo-knowledge-registry.js", "elo-technical-service-router.js"];
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return { win: sandbox.window, localStorage, calls };
}

test("roteador salva sinonimo e preferencia no modo aprender", () => {
  const { win, localStorage, calls } = loadRouter();
  const elo = win.EloAssistente;

  const pendingSynonym = elo.buildResponseForTest("aprenda que bloco baiano significa bloco cerâmico");
  assert.equal(pendingSynonym.sessionIntent, "knowledge_registry_confirmation");
  assert.equal(calls.original, 0);

  const savedSynonym = elo.buildResponseForTest("sim");
  assert.equal(savedSynonym.sessionIntent, "knowledge_registry_saved");
  assert.match(savedSynonym.fullAnswer, /bloco baiano -> bloco cerâmico/);

  const pendingPreference = elo.buildResponseForTest("minha preferência é usar SINAPI BA");
  assert.equal(pendingPreference.sessionIntent, "knowledge_registry_confirmation");
  const savedPreference = elo.buildResponseForTest("sim");
  assert.equal(savedPreference.learning.type, "preference");
  assert.equal(savedPreference.learning.value, "usar SINAPI BA");

  const stored = JSON.parse(localStorage.getItem("elo_knowledge_registry_v1"));
  assert.equal(Object.values(stored).length, 2);
});

test("regra tecnica pede confirmacao e so salva depois de sim", () => {
  const { win, localStorage } = loadRouter();
  const elo = win.EloAssistente;

  const pending = elo.buildResponseForTest("salve regra técnica: nunca usar coeficiente sem fonte");
  assert.equal(pending.sessionIntent, "knowledge_registry_technical_rule_confirmation");
  assert.match(pending.fullAnswer, /Deseja realmente salvar esta regra técnica/);
  assert.equal(localStorage.getItem("elo_knowledge_registry_v1"), null);

  const confirmed = elo.buildResponseForTest("sim");
  assert.equal(confirmed.sessionIntent, "knowledge_registry_saved");
  assert.equal(confirmed.learning.type, "technical_rule");
  assert.equal(confirmed.learning.confirmed, true);
});

test("lista, desativa e apaga aprendizados pelo chat", () => {
  const { win } = loadRouter();
  const elo = win.EloAssistente;

  elo.buildResponseForTest("aprenda que bloco baiano significa bloco cerâmico");
  const saved = elo.buildResponseForTest("sim");
  const id = saved.learning.id;

  const listed = elo.buildResponseForTest("liste aprendizados");
  assert.equal(listed.sessionIntent, "knowledge_registry_list");
  assert.match(listed.fullAnswer, new RegExp(id));

  const disabled = elo.buildResponseForTest("desative o aprendizado " + id);
  assert.equal(disabled.sessionIntent, "knowledge_registry_disable");
  assert.equal(disabled.disabled, true);

  const afterDisable = elo.buildResponseForTest("liste aprendizados");
  assert.doesNotMatch(afterDisable.fullAnswer, new RegExp(id));

  const deleted = elo.buildResponseForTest("apague o aprendizado " + id);
  assert.equal(deleted.sessionIntent, "knowledge_registry_delete");
  assert.equal(deleted.deleted, true);
});

test("conversa comum, residencial e busca web seguem fluxo original", () => {
  const { win, calls } = loadRouter();
  const elo = win.EloAssistente;

  const common = elo.buildResponseForTest("bom dia, como você está?");
  const residential = elo.buildResponseForTest("Quero fazer o orçamento de uma casa.");
  const web = elo.buildResponseForTest("pesquise notícias atuais de Salvador");

  assert.equal(common.sessionIntent, "original_flow");
  assert.equal(residential.sessionIntent, "original_flow");
  assert.equal(web.sessionIntent, "original_flow");
  assert.equal(calls.original, 3);
});

test("ausencia do registry preserva fluxo original", () => {
  const { win, calls } = loadRouter({ withRegistry: false });
  const response = win.EloAssistente.buildResponseForTest("aprenda que bloco baiano significa bloco cerâmico");

  assert.equal(response.sessionIntent, "original_flow");
  assert.equal(calls.original, 1);
});
