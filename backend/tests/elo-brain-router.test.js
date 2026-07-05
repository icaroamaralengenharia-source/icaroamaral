import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function officialRowsFixture() {
  return [{ source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso com argamassa colante", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante", inputUnit: "kg", coefficient: "4,2" },
    { source: "SINAPI", compositionCode: "SINAPI-ALV-001", compositionName: "Alvenaria de vedacao com bloco ceramico", compositionUnit: "m2", serviceType: "alvenaria", inputCode: "BLOCO", inputName: "Bloco ceramico", inputUnit: "un", coefficient: "13,5" },
    { source: "SINAPI", compositionCode: "SINAPI-COB-001", compositionName: "Telhamento com telha ceramica portuguesa e estrutura de madeira", compositionUnit: "m2", serviceType: "cobertura", inputCode: "TELHA", inputName: "Telha ceramica portuguesa", inputUnit: "un", coefficient: "16" },
    { source: "SINAPI", compositionCode: "SINAPI-CONTRA-001", compositionName: "Contrapiso em argamassa cimento e areia", compositionUnit: "m2", serviceType: "contrapiso", inputCode: "CIM", inputName: "Cimento portland", inputUnit: "kg", coefficient: "8" }];
}

function loadRouter() {
  const stockSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const searchSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  const technicalSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-engine.js"), "utf8");
  const bcpSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-parametric-composition-engine.js"), "utf8");
  const routerSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-brain-router.js"), "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(stockSource, sandbox, { filename: "stock-ai-composition-engine.js" });
  vm.runInContext(searchSource, sandbox, { filename: "composition-search-engine.js" });
  sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() });
  vm.runInContext(technicalSource, sandbox, { filename: "elo-technical-engine.js" });
  vm.runInContext(bcpSource, sandbox, { filename: "elo-parametric-composition-engine.js" });
  sandbox.window.EloBudgetEngine = {
    buildPreliminaryBudget() { return { projectFacts: {}, missing: [], projectRecord: null }; },
    buildBudgetReportText() { return "ORCAMENTO PRELIMINAR ESTRUTURADO"; }
  };
  vm.runInContext(routerSource, sandbox, { filename: "elo-brain-router.js" });
  return sandbox.window.EloBrainRouter;
}

test("EloBrainRouter classifica mensagens tecnicas e conversacionais", () => {
  const router = loadRouter();
  const cases = [
    ["me motive", "conversational"],
    ["você é o cara", "conversational"],
    ["vou assentar 50m² de piso cerâmico", "technical"],
    ["o pedreiro retirou 15 sacos de cimento", "technical"],
    ["quanto cimento gasto no contrapiso?", "technical"],
    ["estou cansado", "conversational"],
    ["quero um telhado com telha portuguesa", "technical"],
    ["vamos organizar minhas ideias", "conversational"],
    ["rdo informou 30m² executado", "technical"],
    ["almoxarife liberou argamassa", "technical"]
  ];
  cases.forEach(([message, expected]) => {
    const context = {};
    const routed = router.routeEloBrain(message, context);
    assert.equal(routed.brain, expected, message);
    assert.equal(typeof routed.reason, "string", message);
    assert.ok(routed.confidence > 0, message);
    assert.ok(routed.result, message);
  });
});
test("EloBrainRouter aplica separacao de contexto para BCP e orcamento", () => {
  const router = loadRouter();
  const missing = router.routeEloBrain("viga baldrame 20x30", {});
  assert.equal(missing.brain, "technical");
  assert.equal(missing.result.sessionIntent, "parametric_composition");
  assert.equal(missing.result.technicalEngine.bcp.status, "needs_parameters");
  assert.match(missing.result.fullAnswer, /vou considerar concreto fck 25 MPa/i);
  assert.match(missing.result.fullAnswer, /comprimento total/i);
  assert.doesNotMatch(missing.result.fullAnswer, /EAP|Auditor|Base Tecnica|Base Técnica/);

  const routine = router.routeEloBrain("parede 20x2,80", {});
  assert.equal(routine.result.sessionIntent, "parametric_composition");
  assert.equal(routine.result.technicalEngine.bcp.status, "ready");
  assert.match(routine.result.fullAnswer, /lista de compras parametrica/i);
  assert.match(routine.result.fullAnswer, /bloco ceramico 14x19x29/i);
  assert.doesNotMatch(routine.result.fullAnswer, /EAP|Auditor|Base Tecnica|Base Técnica/);

  const broad = router.routeEloBrain("quero orçamento de uma casa 80m2 com piso ceramico", {});
  assert.equal(broad.result.sessionIntent, "preliminary_budget");
  assert.notEqual(broad.result.sessionIntent, "parametric_composition");
});

test("EloBrainRouter usa acolhimento curto com proxima acao", () => {
  const router = loadRouter();
  const routed = router.routeEloBrain("nao aguento mais perder tempo", {});
  assert.equal(routed.brain, "conversational");
  assert.equal(routed.result.sessionIntent, "acolhimento_com_solucao");
  assert.match(routed.result.fullAnswer, /Entendi a frustracao/);
  assert.match(routed.result.fullAnswer, /servico e as medidas/);
  assert.doesNotMatch(routed.result.fullAnswer, /Memoria|Auditor|Base Tecnica|Base Técnica/);
});
