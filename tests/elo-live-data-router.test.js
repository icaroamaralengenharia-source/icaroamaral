import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const routerSource = readFileSync(new URL("../relatorio-qualidade-obras/elo-live-data-router.js", import.meta.url), "utf8");
const assistantSource = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
const eloHtml = readFileSync(new URL("../elo.html", import.meta.url), "utf8");

function createRouter() {
  const context = { window: {} };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(routerSource, context);
  return context.window.EloLiveDataRouter;
}

test("live data router classifica clima, data, financeiro e fatos atuais automaticamente", () => {
  const router = createRouter();

  const weather = router.classifyLiveDataNeed("qual a temperatura de Vitória da Conquista?");
  assert.equal(weather.needsLiveData, true);
  assert.equal(weather.category, "weather");
  assert.equal(weather.lookup, "web_search");
  assert.match(weather.searchQuery, /temperatura atual em Vitória da Conquista/i);

  const date = router.classifyLiveDataNeed("que dia é hoje?");
  assert.equal(date.needsLiveData, true);
  assert.equal(date.category, "date_time");
  assert.equal(date.lookup, "local_clock");

  const japan = router.classifyLiveDataNeed("E se fosse no Japão?", { category: "date_time" });
  assert.equal(japan.needsLiveData, true);
  assert.equal(japan.category, "date_time");
  assert.equal(japan.timeZone, "Asia/Tokyo");

  const finance = router.classifyLiveDataNeed("qual o dólar hoje?");
  assert.equal(finance.needsLiveData, true);
  assert.equal(finance.category, "finance");
  assert.match(finance.searchQuery, /dólar hoje/i);

  const president = router.classifyLiveDataNeed("quem é o presidente do Brasil?");
  assert.equal(president.needsLiveData, true);
  assert.equal(president.category, "current_fact");
});

test("live data router preserva perguntas estaveis e contexto de clima", () => {
  const router = createRouter();

  assert.equal(router.classifyLiveDataNeed("quanto é 2+2?").needsLiveData, false);
  assert.equal(router.classifyLiveDataNeed("conte uma piada").needsLiveData, false);
  assert.equal(router.classifyLiveDataNeed("quem canta Sultans of Swing?").needsLiveData, false);

  const tomorrow = router.classifyLiveDataNeed("e amanhã?", { category: "weather", location: "Vitória da Conquista" });
  assert.equal(tomorrow.needsLiveData, true);
  assert.equal(tomorrow.category, "weather");
  assert.equal(tomorrow.location, "Vitória da Conquista");
  assert.match(tomorrow.searchQuery, /Vitória da Conquista amanhã/i);
});

test("frontend carrega router antes do assistente e usa busca direta sem botao obrigatorio", () => {
  assert.match(eloHtml, /elo-live-data-router\.js[\s\S]*elo-assistente\.js/);
  assert.match(assistantSource, /classifyEloLiveDataNeed_/);
  assert.match(assistantSource, /buildEloLiveDataDirectAnswer_/);
  assert.match(assistantSource, /requestEloWebSearchAnswer_\(cleanQuestion\)/);
  assert.match(assistantSource, /classifiedLiveData\.searchQuery \|\| question/);
  assert.match(assistantSource, /action: null/);
});
