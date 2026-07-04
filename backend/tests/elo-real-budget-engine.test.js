import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadRealBudget() {
  return loadWindow(["elo-real-budget-engine.js"]).EloRealBudgetEngine;
}

function eapFixture() {
  return {
    etapas: [
      { id: "fundacao_baldrame", nome: "Fundacao / baldrame" },
      { id: "alvenaria", nome: "Alvenaria" },
      { id: "pintura", nome: "Pintura" },
      { id: "instalacoes", nome: "Instalacoes" }
    ],
    assumidos: ["padrao_simples_preliminar"],
    itens: [
      { id: "baldrame", etapaId: "fundacao_baldrame", nome: "viga baldrame", unidadeEsperada: "m", obrigatorio: true, quantidadeBase: { valor: 42, unidade: "m", origem: "projeto" } },
      { id: "alvenaria", etapaId: "alvenaria", nome: "alvenaria de bloco", unidadeEsperada: "m2", obrigatorio: true, quantidadeBase: { valor: 160, unidade: "m2", origem: "projeto" } },
      { id: "pintura", etapaId: "pintura", nome: "pintura interna", unidadeEsperada: "m2", obrigatorio: true, quantidadeBase: { valor: 220, unidade: "m2", origem: "projeto" } },
      { id: "caixa", etapaId: "instalacoes", nome: "caixa sifonada", unidadeEsperada: "un", obrigatorio: true }
    ]
  };
}

function resolutionFixture() {
  return {
    resolvedItems: [
      { eapItemId: "baldrame", confianca: 0.88, composicaoSelecionada: { code: "SINAPI-BAL-001", description: "Viga baldrame em concreto armado", source: "SINAPI" } },
      { eapItemId: "alvenaria", confianca: 0.91, composicaoSelecionada: { code: "SINAPI-ALV-001", description: "Alvenaria de bloco ceramico", source: "SINAPI" } },
      { eapItemId: "pintura", confianca: 0.86, composicaoSelecionada: { code: "SINAPI-PINT-001", description: "Pintura interna", source: "SINAPI" } }
    ],
    unresolvedItems: []
  };
}

function releasedAudit() {
  return { canGenerate: { executiveBudget: true }, executiveBudget: true, blockers: [], missingItems: [], assumptions: [] };
}

function blockedAudit() {
  return { canGenerate: { executiveBudget: false }, executiveBudget: false, blockers: [{ id: "fundacao_nao_confirmada", message: "Fundacao nao confirmada." }], missingItems: [], assumptions: ["fundacao_superficial_a_confirmar"] };
}

function priceBase() {
  return { source: "fixture", "SINAPI-BAL-001": 85.4, "SINAPI-ALV-001": 92.25, "SINAPI-PINT-001": 18.5 };
}

test("gera item quando ha composicao, quantidade e preco", () => {
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolutionFixture(), technicalAudit: releasedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  const item = result.items.find((entry) => entry.eapItemId === "baldrame");
  assert.ok(item);
  assert.equal(item.etapaId, "fundacao_baldrame");
  assert.equal(item.etapa, "Fundacao / baldrame");
  assert.equal(item.item, "viga baldrame");
  assert.equal(item.quantity, 42);
  assert.equal(item.unit, "m");
  assert.equal(item.compositionCode, "SINAPI-BAL-001");
  assert.equal(item.compositionDescription, "Viga baldrame em concreto armado");
  assert.equal(item.unitPrice, 85.4);
  assert.equal(item.subtotal, 3586.8);
  assert.equal(item.source, "fixture");
  assert.equal(item.confidence, 0.88);
});

test("nao gera item completo sem composicao", () => {
  const resolution = { resolvedItems: resolutionFixture().resolvedItems.filter((item) => item.eapItemId !== "pintura") };
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolution, technicalAudit: releasedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(result.items.some((item) => item.eapItemId === "pintura"), false);
  assert.ok(result.missingCompositions.some((item) => item.eapItemId === "pintura"));
});

test("nao gera item completo sem quantidade", () => {
  const eap = eapFixture();
  eap.itens.find((item) => item.id === "alvenaria").quantidadeBase = null;
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eap, compositionResolution: resolutionFixture(), technicalAudit: releasedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(result.items.some((item) => item.eapItemId === "alvenaria"), false);
  assert.ok(result.missingQuantities.some((item) => item.eapItemId === "alvenaria"));
});

test("nao gera item completo sem preco", () => {
  const prices = priceBase();
  delete prices["SINAPI-PINT-001"];
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolutionFixture(), technicalAudit: releasedAudit(), priceBase: prices, bdiPercent: 25 });
  assert.equal(result.items.some((item) => item.eapItemId === "pintura"), false);
  assert.ok(result.missingPrices.some((item) => item.eapItemId === "pintura"));
});

test("calcula subtotal BDI e total corretamente", () => {
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolutionFixture(), technicalAudit: releasedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(result.subtotal, 22416.8);
  assert.equal(result.bdiValue, 5604.2);
  assert.equal(result.total, 28021);
});

test("canClose false quando auditor bloqueia executivo", () => {
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolutionFixture(), technicalAudit: blockedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(result.canClose, false);
  assert.equal(result.status, "partial");
  assert.ok(result.blockers.some((item) => item.source === "technical_audit"));
});

test("canClose true somente quando tudo esta completo e auditor libera", () => {
  const eap = eapFixture();
  eap.itens = eap.itens.filter((item) => item.id !== "caixa");
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eap, compositionResolution: resolutionFixture(), technicalAudit: releasedAudit(), priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(result.canClose, true);
  assert.equal(result.status, "complete");
  assert.equal(result.blockers.length, 0);
});

test("gera tabela parcial mesmo bloqueado", () => {
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: resolutionFixture(), technicalAudit: blockedAudit(), priceBase: { "SINAPI-BAL-001": 85.4 }, bdiPercent: 10 });
  assert.equal(result.canClose, false);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].eapItemId, "baldrame");
  assert.ok(result.missingPrices.length > 0);
  assert.ok(result.missingCompositions.length > 0);
});

test("nao inventa preco composicao ou quantidade", () => {
  const result = loadRealBudget().buildCompleteBudget({ budgetEap: eapFixture(), compositionResolution: { resolvedItems: [] }, technicalAudit: releasedAudit(), priceBase: {}, bdiPercent: 25 });
  assert.equal(result.items.length, 0);
  assert.ok(result.missingCompositions.length > 0);
  assert.equal(result.items.some((item) => item.unitPrice != null || item.compositionCode), false);
});

test("integra ao elo-budget-engine sem quebrar fluxo antigo", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-technical-auditor.js",
    "elo-budget-eap-engine.js",
    "elo-composition-resolver.js",
    "elo-real-budget-engine.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-price-engine.js",
    "elo-budget-engine.js"
  ]);
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "casa terrea 80m2 com 1 banheiro", builtAreaM2: 80, bathrooms: 1 }, { priceBase: priceBase(), bdiPercent: 25 });
  assert.equal(budget.mode, "preliminary_budget");
  assert.ok(budget.realBudget);
  assert.equal(Array.isArray(budget.realBudget.items), true);
  assert.equal(budget.realBudget.canClose, false);
});
