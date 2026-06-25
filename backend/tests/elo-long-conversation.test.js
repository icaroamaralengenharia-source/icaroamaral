import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const reportJsonPath = join(repoDir, "tmp", "elo-long-conversation-report.json");
const reportTxtPath = join(repoDir, "tmp", "elo-long-conversation-report.txt");

const CONVERSATION = [
  ["me motive hoje", "conversational"],
  ["valeu, você é o cara", "conversational"],
  ["agora vamos orçar uma casa", "technical"],
  ["é uma casa térrea de 80m²", "technical"],
  ["as paredes tem 4m de altura", "technical"],
  ["vou usar bloco baiano", "technical"],
  ["quero telhado com telha portuguesa", "technical"],
  ["estrutura de madeira", "technical"],
  ["também vou colocar piso cerâmico", "technical"],
  ["são 50m² no chão", "technical"],
  ["60x60 junta 3mm ac2 interno", "technical"],
  ["quero saber quantos sacos de argamassa", "technical"],
  ["vou fazer 10m² de chapisco", "technical"],
  ["é interno", "technical"],
  ["e reboco também", "technical"],
  ["espessura 2cm interno", "technical"],
  ["o pedreiro executou 30m² de parede", "technical"],
  ["retirou 15 sacos de cimento", "technical"],
  ["isso está certo?", "technical"],
  ["quero pintar 200m²", "technical"],
  ["tinta acrílica duas demãos", "technical"],
  ["vou fazer contrapiso 30m² 3cm", "technical"],
  ["quanto cimento?", "technical"],
  ["estou cansado disso tudo", "conversational"],
  ["mas vamos terminar, gera um resumo técnico", "technical"],
  ["gera orçamento preliminar agora", "technical"]
];

function officialRowsFixture() {
  return [{ source: "SINAPI", compositionCode: "SINAPI-COB-001", compositionName: "Telhamento com telha ceramica portuguesa sobre estrutura de madeira", compositionUnit: "m2", serviceType: "cobertura", inputCode: "TELHA", inputName: "Telha ceramica portuguesa", inputUnit: "un", coefficient: "16" },
    { source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso com argamassa colante AC II", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante AC II", inputUnit: "kg", coefficient: "4,2" },
    { source: "SINAPI", compositionCode: "SINAPI-CHAP-001", compositionName: "Chapisco aplicado em alvenaria interna", compositionUnit: "m2", serviceType: "chapisco", inputCode: "CIM", inputName: "Cimento portland", inputUnit: "kg", coefficient: "2,4" },
    { source: "SINAPI", compositionCode: "SINAPI-REBOCO-001", compositionName: "Emboco ou massa unica em argamassa para parede interna", compositionUnit: "m2", serviceType: "reboco", inputCode: "AREIA", inputName: "Areia media", inputUnit: "m3", coefficient: "0,025" },
    { source: "SINAPI", compositionCode: "SINAPI-ALV-001", compositionName: "Alvenaria de vedacao com bloco ceramico baiano", compositionUnit: "m2", serviceType: "alvenaria", inputCode: "BLOCO", inputName: "Bloco ceramico", inputUnit: "un", coefficient: "13,5" },
    { source: "SINAPI", compositionCode: "SINAPI-PINT-001", compositionName: "Aplicacao de tinta acrilica em parede interna duas demaos", compositionUnit: "m2", serviceType: "pintura", inputCode: "TINTA", inputName: "Tinta acrilica", inputUnit: "l", coefficient: "0,18" },
    { source: "SINAPI", compositionCode: "SINAPI-CONTRA-001", compositionName: "Contrapiso em argamassa cimento e areia espessura 3 cm", compositionUnit: "m2", serviceType: "contrapiso", inputCode: "CIM2", inputName: "Cimento portland", inputUnit: "kg", coefficient: "8" }];
}

function loadRouterStack() {
  const files = ["stock-ai-composition-engine.js", "composition-search-engine.js", "elo-technical-engine.js", "elo-work-package-engine.js", "elo-quantity-engine.js", "elo-consumption-engine.js", "elo-audit-engine.js", "elo-budget-table-engine.js", "elo-project-record-engine.js", "elo-project-store.js", "elo-executive-budget-engine.js", "elo-ui-data-engine.js", "elo-composition-selection-engine.js", "elo-export-engine.js", "elo-base-status-engine.js", "elo-traceability-engine.js", "elo-technical-knowledge-graph.js", "elo-budget-engine.js", "elo-brain-router.js"];
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", files[0]), "utf8"), sandbox, { filename: files[0] });
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", files[1]), "utf8"), sandbox, { filename: files[1] });
  sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() }, { state: "BA", referenceMonth: "2026-06" });
  const originalSearch = sandbox.window.CompositionSearchEngine.searchOfficialCompositions.bind(sandbox.window.CompositionSearchEngine);
  const searchCalls = [];
  sandbox.window.CompositionSearchEngine.searchOfficialCompositions = function wrappedSearch(query, options) {
    const result = originalSearch(query, options || {});
    searchCalls.push({ query, result });
    return result;
  };
  for (let index = 2; index < files.length; index += 1) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", files[index]), "utf8"), sandbox, { filename: files[index] });
  }
  return { router: sandbox.window.EloBrainRouter, searchCalls };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function hasGenericBriefing(text) {
  return /Dados mínimos que vou usar|BRIEFING DA OBRA|Próxima ação: Complete cliente/i.test(text || "");
}

function writeReport(report) {
  mkdirSync(join(repoDir, "tmp"), { recursive: true });
  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), "utf8");
  const lines = ["ELO LONG CONVERSATION REPORT", ""];
  lines.push(`Total: ${report.summary.total}`);
  lines.push(`Technical Brain: ${report.summary.technical}`);
  lines.push(`Conversational Brain: ${report.summary.conversational}`);
  lines.push(`CompositionSearchEngine acionado: ${report.summary.searchTriggered}`);
  lines.push(`Falhas: ${report.summary.failures}`);
  lines.push("");
  lines.push("Contexto final");
  lines.push(JSON.stringify(report.finalContext, null, 2));
  lines.push("");
  lines.push("Turnos");
  report.turns.forEach((turn, index) => {
    lines.push(`${index + 1}. [${turn.brain}] ${turn.message}`);
    lines.push(`   reason=${turn.reason} confidence=${turn.confidence}`);
    if (turn.searchTriggered) lines.push(`   busca=true top=${turn.topCandidate || "sem candidato"}`);
  });
  writeFileSync(reportTxtPath, lines.join("\n"), "utf8");
}

test("Elo preserva contexto tecnico em conversa longa", () => {
  const { router, searchCalls } = loadRouterStack();
  const context = {};
  const turns = [];
  let failures = 0;
  CONVERSATION.forEach(([message, expectedBrain]) => {
    const before = clone(context);
    const callStart = searchCalls.length;
    let routed;
    try {
      routed = router.routeEloBrain(message, context);
    } catch (error) {
      failures += 1;
      routed = { brain: "crash", reason: error.message, confidence: 0, result: { fullAnswer: error.stack || String(error) } };
    }
    const newSearches = searchCalls.slice(callStart);
    const answer = routed.result && routed.result.fullAnswer || "";
    if (routed.brain !== expectedBrain || hasGenericBriefing(answer) || (/COEFICIENTES E CONSUMO PREVISTO/i.test(answer) && !/COMPOSICAO UTILIZADA/i.test(answer))) failures += 1;
    turns.push({
      message,
      expectedBrain,
      brain: routed.brain,
      reason: routed.reason,
      confidence: Number((routed.confidence || 0).toFixed(3)),
      searchTriggered: newSearches.length > 0,
      topCandidate: newSearches[0] && newSearches[0].result && newSearches[0].result.candidates && newSearches[0].result.candidates[0] && newSearches[0].result.candidates[0].code || "",
      before,
      after: clone(context),
      answer
    });
  });

  const summary = {
    total: turns.length,
    technical: turns.filter((turn) => turn.brain === "technical").length,
    conversational: turns.filter((turn) => turn.brain === "conversational").length,
    searchTriggered: turns.filter((turn) => turn.searchTriggered).length,
    failures
  };
  const report = { summary, turns, finalContext: clone(context.technical || {}) };
  writeReport(report);

  assert.equal(failures, 0);
  assert.ok(summary.technical >= 15);
  assert.ok(summary.conversational >= 3);
  assert.ok(summary.searchTriggered >= 12);
  const budgetTurn = turns[turns.length - 1];
  assert.equal(budgetTurn.brain, "technical");
  assert.match(budgetTurn.answer, /ORÇAMENTO PRELIMINAR|ORCAMENTO PRELIMINAR|PRONTUÁRIO DA OBRA|PRONTUARIO DA OBRA|PRONTIDÃO PARA EXECUTIVO|PRONTIDAO PARA EXECUTIVO/i);
  assert.match(budgetTurn.answer, /Pendências|Pendencias|Composições candidatas|Composicoes candidatas|Quantitativos seguros/i);
  assert.equal(context.technical.facts.builtAreaM2, 80);
  assert.equal(context.technical.facts.wallHeightM, 4);
  assert.equal(context.technical.facts.wallMaterial, "bloco ceramico baiano");
  assert.equal(context.technical.services.piso_ceramico.areaM2, 50);
  assert.equal(context.technical.services.piso_ceramico.tileSize, "60x60");
  assert.equal(context.technical.services.piso_ceramico.jointMm, 3);
  assert.equal(context.technical.services.piso_ceramico.mortar, "AC-II");
  assert.equal(context.technical.services.piso_ceramico.environment, "interno");
  assert.equal(context.technical.services.telhado.material, "telha portuguesa");
  assert.equal(context.technical.services.telhado.structure, "estrutura de madeira");
  assert.equal(context.technical.audit.executedAreaM2, 30);
  assert.equal(context.technical.audit.withdrawnQuantity, 15);
  assert.equal(context.technical.audit.withdrawnMaterial, "cimento");
  assert.ok(context.technical.projectRecord);
  assert.ok(turns[turns.length - 1].answer.match(/SITUAÇÃO DO PRODUTO|SITUACAO DO PRODUTO|PRONTIDÃO PARA EXECUTIVO|PRONTIDAO PARA EXECUTIVO/i));
  assert.ok(turns.every((turn) => !hasGenericBriefing(turn.answer)));
});








