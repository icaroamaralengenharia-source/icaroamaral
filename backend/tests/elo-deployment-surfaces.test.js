import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

const surfaces = [
  { name: "elo.html", path: join(repoDir, "elo.html") },
  { name: "stock-ai-obras.html", path: join(repoDir, "stock-ai-obras.html") },
  { name: "relatorio-qualidade-obras.html", path: join(repoDir, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html") }
];

const expectedOrder = [
  "stock-ai-composition-engine.js",
  "composition-search-engine.js",
  "elo-technical-engine.js",
  "elo-budget-engine.js",
  "elo-brain-router.js",
  "elo-assistente.js"
];

function scriptPositions(html) {
  return Object.fromEntries(expectedOrder.map((script) => [script, html.indexOf(script)]));
}

test("superficies do Elo carregam motores novos na ordem correta", () => {
  surfaces.forEach((surface) => {
    const html = readFileSync(surface.path, "utf8");
    const positions = scriptPositions(html);

    expectedOrder.forEach((script) => {
      assert.ok(positions[script] >= 0, `${surface.name} deve carregar ${script}`);
    });

    assert.ok(positions["stock-ai-composition-engine.js"] < positions["composition-search-engine.js"], `${surface.name}: StockAiCompositionEngine antes de CompositionSearchEngine`);
    assert.ok(positions["composition-search-engine.js"] < positions["elo-technical-engine.js"], `${surface.name}: CompositionSearchEngine antes de EloTechnicalEngine`);
    assert.ok(positions["elo-technical-engine.js"] < positions["elo-budget-engine.js"], `${surface.name}: EloTechnicalEngine antes de EloBudgetEngine`);
    assert.ok(positions["elo-budget-engine.js"] < positions["elo-brain-router.js"], `${surface.name}: EloBudgetEngine antes de EloBrainRouter`);
    assert.ok(positions["elo-brain-router.js"] < positions["elo-assistente.js"], `${surface.name}: EloBrainRouter antes de elo-assistente`);
  });
});

test("elo-assistente usa EloBrainRouter antes dos fluxos antigos", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const routerCall = source.indexOf("router.routeEloBrain(message, ELO_BRAIN_CONTEXT)");
  const technicalHookInBuildResponse = source.indexOf("const technicalEngineAnswer = buildEloTechnicalEngineAnswer_(cleanQuestion)");
  const crisisFallback = source.indexOf("if (isCrisisQuestion(normalizedQuestion))");
  const residentialFallback = source.indexOf("const residentialBudgetFlowAnswer = buildEloResidentialBudgetFlowAnswer_(cleanQuestion)");
  const chatHook = source.indexOf("const technicalChatEngineAnswer = buildEloTechnicalEngineAnswer_(cleanQuestion)");
  const operationalFallback = source.indexOf("const operationalChatEcosystemAnswer = buildEloOperationalEcosystemAnswer_(cleanQuestion)");

  assert.ok(routerCall > 0, "elo-assistente deve chamar EloBrainRouter");
  assert.ok(technicalHookInBuildResponse > 0 && technicalHookInBuildResponse < crisisFallback, "router deve entrar antes do fallback conversacional/buildResponse antigo");
  assert.ok(technicalHookInBuildResponse < residentialFallback, "router deve entrar antes do briefing residencial antigo");
  assert.ok(chatHook > 0 && chatHook < operationalFallback, "router deve entrar no fluxo principal do chat antes do ecossistema operacional antigo");
  assert.match(source, /routed\.brain !== "technical"/, "mensagens conversacionais devem continuar no fluxo atual");
  assert.match(source, /window\.EloTechnicalEngine/, "fallback tecnico ainda preserva EloTechnicalEngine quando router nao existir");
});

