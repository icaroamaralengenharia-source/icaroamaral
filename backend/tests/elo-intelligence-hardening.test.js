import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import vm from "node:vm";
import { buildEloSystemPrompt_ } from "../src/app.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadOfflineRouter() {
  const sandbox = { console, Date, Intl, Promise };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-offline-router.js"), "utf8"), sandbox, { filename: "elo-offline-router.js" });
  return sandbox.EloOfflineRouter;
}

test("intelligence hardening: relative dates stay local and use the runtime date", async () => {
  const router = loadOfflineRouter().createRouter({ now: () => new Date("2026-10-03T12:00:00-03:00") });
  const route = (question) => router.route(question, { backendState: "OFFLINE" });

  assert.match((await route("amanhã é qual dia?")).message, /^Amanhã será 04\/10\/2026\.$/);
  assert.match((await route("ontem foi que dia?")).message, /^Ontem foi 02\/10\/2026\.$/);
  assert.match((await route("depois de amanhã")).message, /^Depois de amanhã será 05\/10\/2026\.$/);
  assert.match((await route("anteontem")).message, /^Anteontem foi 01\/10\/2026\.$/);
  assert.match((await route("daqui a 7 dias")).message, /^A data calculada será 10\/10\/2026\.$/);
});

test("intelligence hardening: online prompt injects a runtime clock and anti-invention rule", () => {
  const prompt = buildEloSystemPrompt_({ eloContext: "geral" });
  assert.match(prompt, /RUNTIME CLOCK \(SOURCE OF TRUTH\)/);
  assert.match(prompt, /America\/Bahia/);
  assert.match(prompt, /nunca use data de treinamento, exemplo antigo ou data fixa/i);
  assert.match(prompt, /Não invente feriado\/evento sem fonte fornecida/i);
});
