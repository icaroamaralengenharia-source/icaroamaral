const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const test = require("node:test");

function load() {
  const data = new Map();
  const window = { localStorage: { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) } };
  const context = { window, console };
  context.globalThis = window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("relatorio-qualidade-obras/elo-conversation-conductor.js", "utf8"), context);
  return window.EloConversationConductor;
}

test("continuação curta preserva o tópico ativo", () => {
  const conductor = load();
  conductor.enhanceResponse({ userMessage: "estou fazendo uma casa com laje", assistantResponse: "Entendi o contexto." });
  const answer = conductor.enhanceResponse({ userMessage: "e se for treliçada?", assistantResponse: "A laje treliçada muda as premissas." });
  assert.match(answer, /premissa|proximo passo|laje/i);
  assert.equal(conductor.loadState().intent, "duvida_tecnica");
});

test("encerramento não inicia interrogatório", () => {
  const conductor = load();
  const answer = conductor.enhanceResponse({ userMessage: "valeu", assistantResponse: "Por nada." });
  assert.equal(answer, "Por nada.");
});

test("resposta factual curta não recebe ação artificial", () => {
  const conductor = load();
  const answer = conductor.enhanceResponse({ userMessage: "quanto é 2+2?", assistantResponse: "4" });
  assert.equal(answer, "4");
});
