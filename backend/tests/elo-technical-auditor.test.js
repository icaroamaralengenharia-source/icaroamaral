import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files, setup) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  if (setup) setup(sandbox.window);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadAuditor() {
  return loadWindow(["elo-technical-auditor.js"]).EloTechnicalAuditor;
}

function unresolved(id, nome, etapaId = "fundacao", disciplina = "fundacao") {
  return {
    eapItemId: id,
    etapaId,
    nome,
    disciplina,
    unidadeEsperada: "m2",
    termosBusca: [nome],
    composicaoSelecionada: null,
    confianca: 0,
    motivoEscolha: "sem_candidato",
    pendencias: ["composicao_sinapi_nao_resolvida"],
    bloqueadores: [],
    obrigatorio: true
  };
}

test("Technical Auditor V1 bloqueia executivo e lista itens tecnicos obrigatorios faltantes", () => {
  const auditor = loadAuditor();
  const result = auditor.auditTechnicalBudget({
    budgetEap: {
      bloqueadores: [{ id: "area_construida", message: "Casa sem area construida informada.", severity: "critica" }],
      assumidos: ["fundacao_superficial_a_confirmar"],
      itens: []
    },
    compositionResolution: { unresolvedItems: [], resolvedItems: [] },
    constructionReadiness: { bloqueadores: ["area_construida"], assumidos: ["casa_terrea"] }
  });

  assert.equal(result.executiveBudget, false);
  assert.equal(result.canGenerate.executiveBudget, false);
  assert.equal(result.canGenerate.pdf, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.missingItems.some((item) => item.id === "fundacao"));
  assert.ok(result.missingItems.some((item) => item.id === "baldrame"));
  assert.ok(result.missingItems.some((item) => item.id === "impermeabilizacao"));
  assert.ok(result.missingItems.some((item) => item.id === "alvenaria"));
  assert.ok(result.missingItems.some((item) => item.id === "instalacoes"));
  assert.ok(result.missingItems.some((item) => item.id === "ralo"));
  assert.ok(result.missingItems.some((item) => item.id === "caixa_sifonada"));
  assert.ok(result.missingItems.some((item) => item.id === "chapisco_reboco"));
  assert.ok(result.missingItems.some((item) => item.id === "pintura"));
  assert.ok(result.missingItems.some((item) => item.id === "limpeza"));
  assert.ok(result.confidence < 0.6);
  assert.match(result.summary, /orcamento executivo bloqueado/i);
});

test("reduz confidence por bloqueadores, pendencias, composicoes obrigatorias sem resolver e premissas", () => {
  const auditor = loadAuditor();
  const weak = auditor.auditTechnicalBudget({
    budgetEap: {
      bloqueadores: [{ id: "area_construida", message: "Casa sem area construida." }],
      assumidos: ["padrao_simples_preliminar", "fundacao_superficial_a_confirmar"],
      itens: []
    },
    compositionResolution: {
      resolvedItems: [],
      unresolvedItems: [
        unresolved("fundacao", "concreto fundacao"),
        unresolved("baldrame", "viga baldrame"),
        unresolved("pintura", "pintura interna", "pintura", "pintura")
      ]
    },
    constructionReadiness: { bloqueadores: ["tipo_fundacao"], assumidos: ["tipo_obra_residencial"] }
  });
  const stronger = auditor.auditTechnicalBudget({
    budgetEap: { bloqueadores: [], assumidos: [], itens: [] },
    compositionResolution: { resolvedItems: [], unresolvedItems: [] },
    constructionReadiness: { bloqueadores: [], assumidos: [] },
    originalMessage: "fundacao sapata viga baldrame impermeabilizacao alvenaria eletrica hidraulica esgoto ralo caixa sifonada chapisco reboco pintura limpeza final"
  });

  assert.ok(weak.confidence < stronger.confidence);
  assert.ok(weak.blockers.length > stronger.blockers.length);
  assert.equal(weak.executiveBudget, false);
  assert.equal(stronger.executiveBudget, false);
});

test("nao calcula preco, nao inventa composicao e nao gera PDF", () => {
  const auditor = loadAuditor();
  const result = auditor.auditTechnicalBudget({
    compositionResolution: {
      resolvedItems: [],
      unresolvedItems: [unresolved("caixa", "caixa sifonada", "instalacoes", "instalacoes")]
    }
  });

  assert.equal(Object.prototype.hasOwnProperty.call(result, "price"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "total"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(result, "pdf"), false);
  assert.equal(result.canGenerate.pdf, false);
  assert.equal(result.missingItems.find((item) => item.id === "caixa_sifonada").reason, "item_obrigatorio_sem_composicao_confiavel");
});

test("BudgetEngine inclui technicalAudit quando auditor esta carregado", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-budget-eap-engine.js",
    "elo-composition-resolver.js",
    "elo-technical-auditor.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-budget-engine.js"
  ], (root) => {
    root.StockAiCompositionEngine = {
      getImportedOfficialBaseCatalog() {
        return [
          { code: "98524", description: "limpeza manual de terreno", unit: "m2", source: "SINAPI", isOfficial: true }
        ];
      }
    };
  });
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({
    originalMessage: "casa terrea 80m2 com 1 banheiro",
    builtAreaM2: 80,
    bathrooms: 1
  }, {});

  assert.ok(budget.technicalAudit);
  assert.equal(budget.technicalAudit.executiveBudget, false);
  assert.equal(budget.technicalAudit.canGenerate.pdf, false);
  assert.ok(Array.isArray(budget.technicalAudit.missingItems));
  assert.ok(budget.technicalAudit.confidence <= 0.82);
  assert.match(win.EloBudgetEngine.buildBudgetReportText(budget), /AUDITORIA TECNICA V1/i);
});
