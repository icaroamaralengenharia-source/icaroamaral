import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const surfaces = [
  { name: "elo.html", file: "elo.html" },
  { name: "stock-ai-obras.html", file: "stock-ai-obras.html" },
  { name: "relatorio-qualidade-obras.html", file: "relatorio-qualidade-obras/relatorio-qualidade-obras.html" }
];

const requiredGlobals = [
  "EloBrainRouter",
  "EloTechnicalEngine",
  "CompositionSearchEngine",
  "StockAiCompositionEngine",
  "EloBudgetEngine",
  "EloWorkPackageEngine",
  "EloQuantityEngine",
  "EloConsumptionEngine",
  "EloAuditEngine",
  "EloBudgetTableEngine",
  "EloProjectRecordEngine",
  "EloExecutiveBudgetEngine",
  "EloUiDataEngine",
  "EloTechnicalKnowledgeGraph",
  "EloProjectApiClient",
  "EloProjectStore",
  "EloDashboardView",
  "EloCompositionSelectionEngine",
  "EloExportEngine",
  "EloBaseStatusEngine",
  "EloTraceabilityEngine",
  "EloPriceEngine",
  "EloAssistente"
];

function surfaceUrl(surface) {
  return pathToFileURL(resolve(surface.file)).href;
}

async function loadSurface(page, surface) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(surfaceUrl(surface));
  await page.waitForFunction((globals) => globals.every((name) => window[name]), requiredGlobals);
  const globalTypes = await page.evaluate((globals) => Object.fromEntries(globals.map((name) => [name, typeof window[name]])), requiredGlobals);
  expect(Object.values(globalTypes), `${surface.name} globals definidos`).not.toContain("undefined");
  expect(errors, `${surface.name} sem pageerror`).toEqual([]);
}

function expectTechnicalRoute(value) {
  expect(["technical", "budget"]).toContain(value || "technical");
}
async function ask(page, message) {
  return page.evaluate((question) => {
    const response = window.EloAssistente.buildResponseForTest(question);
    return {
      shortAnswer: response && response.shortAnswer || "",
      fullAnswer: response && response.fullAnswer || "",
      sessionIntent: response && response.sessionIntent || "",
      brain: response && (response.brain || response.brainMarker) || "",
      reason: response && response.brainMarker || "",
      technicalMode: response && response.technicalEngine && response.technicalEngine.mode || "",
      searchFound: !!(response && response.technicalEngine && response.technicalEngine.compositionSearch && response.technicalEngine.compositionSearch.found),
      searchIndexed: response && response.technicalEngine && response.technicalEngine.compositionSearch && response.technicalEngine.compositionSearch.indexedCount || 0,
      projectRecordId: response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.projectRecordId || "",
      hasDashboardData: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.dashboardData),
      hasBaseStatus: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.baseStatus),
      traceabilityCount: response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.traceability && response.technicalEngine.budget.traceability.length || 0,
      hasExportData: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.exportData),
      hasClosingChecklist: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.closingChecklist),
      hasOperationalDashboardHtml: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.operationalDashboardHtml),
      hasPriceStatus: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.priceStatus),
      hasExecutiveClosing: !!(response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.executiveClosing),
      packageCount: response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.workPackages && response.technicalEngine.budget.workPackages.packages && response.technicalEngine.budget.workPackages.packages.length || 0,
      candidateCount: response && response.technicalEngine && response.technicalEngine.budget && response.technicalEngine.budget.compositionMatches && response.technicalEngine.budget.compositionMatches.filter((match) => match.candidates && match.candidates.length).length || 0
    };
  }, message);
}

test.describe("Elo surfaces", () => {
  for (const surface of surfaces) {
    test(`${surface.name} usa router conversacional e tecnico`, async ({ page }) => {
      await loadSurface(page, surface);

      const conversational = await ask(page, "me motive hoje");
      expect(conversational.brain).not.toBe("technical");
      expect(conversational.fullAnswer).not.toMatch(/SERVICO IDENTIFICADO|BUSCA NA BASE OFICIAL/i);

      const piso = await ask(page, "vou assentar 50m² de piso cerâmico no chão");
      expectTechnicalRoute(piso.brain);
      expect(piso.fullAnswer).toMatch(/Piso ceramico|Piso cerâmico|50|memória da obra|memoria da obra|contexto|revestimento ceramico|servico isolado|serviço isolado|Area de piso|Área de piso/i);
      expect(piso.fullAnswer).toMatch(/50|m²|m2|contexto|memória|memoria|dimens|junta|argamassa|composi/i);
      expect(piso.fullAnswer).not.toMatch(/Dados mínimos que vou usar|BRIEFING DA OBRA|Próxima ação: Complete cliente/i);

      const casa = await ask(page, "casa de 80m² térrea, paredes com 4m de altura e bloco cerâmico baiano");
      expectTechnicalRoute(casa.brain);
      expect(casa.fullAnswer).toMatch(/80|Area construida|Área construída/i);
      expect(casa.fullAnswer).not.toMatch(/Area construida:\s*4/i);
      expect(casa.fullAnswer).not.toMatch(/Dados mínimos que vou usar|BRIEFING DA OBRA|Próxima ação: Complete cliente/i);

      const orcamento = await ask(page, "casa térrea 80m², bloco baiano, telha portuguesa, piso cerâmico 50m²");
      expectTechnicalRoute(orcamento.brain);
      expect(orcamento.fullAnswer).toMatch(/orcamento|orçamento|parede|briefing|Dados preservados|80/i);
      expect(orcamento.fullAnswer).toMatch(/area construida|Área construída|80/i);
      expect(orcamento.fullAnswer).toMatch(/cidade\/UF|padrao construtivo|padrão construtivo|projectRecordId|PAINEL/i);
      expect(orcamento.fullAnswer).not.toMatch(/R\$\s*\d/i);

      await loadSurface(page, surface);

      const parede = await ask(page, "quero saber o material necessario pra fazer uma parede que mede 30metros da comprimento e 2,80 metros de altura");
      expectTechnicalRoute(parede.brain);
      expect(parede.fullAnswer).toMatch(/premissas|Base técnica utilizada|SINAPI\/ORSE|composi|calcular|quantitativo|dimensoes|dimensões|parede/i);
      expect(parede.fullAnswer).not.toMatch(/Qual a area de alvenaria/i);

      const blocoBaiano = await ask(page, "40m² de parede, tipo baiano");
      expect(blocoBaiano.fullAnswer).toMatch(/dimensao do bloco baiano|dimensão do bloco baiano|SINAPI\/ORSE|composi/i);
      expect(blocoBaiano.fullAnswer).not.toMatch(/Composicoes indexadas: 0|Qual a espessura da parede\/bloco/i);

      const telhado = await ask(page, "quero telhado com telha portuguesa");
      expectTechnicalRoute(telhado.brain);
      expect(telhado.fullAnswer).toMatch(/BUSCA NA BASE OFICIAL|composi/i);
      expect(telhado.fullAnswer).toMatch(/telha|portuguesa|cobertura|serviço de obra|servico de obra|composição técnica|composicao tecnica|Base técnica utilizada/i);
      expect(telhado.fullAnswer).not.toMatch(/mensagem genérica|nao entendi|não entendi/i);
    });
  }
});
