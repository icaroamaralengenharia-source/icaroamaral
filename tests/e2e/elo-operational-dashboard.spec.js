import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const surfaces = [
  { name: "elo.html", file: "elo.html" },
  { name: "stock-ai-obras.html", file: "stock-ai-obras.html" },
  { name: "relatorio-qualidade-obras.html", file: "relatorio-qualidade-obras/relatorio-qualidade-obras.html" }
];
function surfaceUrl(surface) { return pathToFileURL(resolve(surface.file)).href; }

test.describe("Elo operational", () => {
  for (const surface of surfaces) {
    test(`${surface.name} renderiza dashboard operacional sem pre?o inventado`, async ({ page }) => {
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(surfaceUrl(surface));
      await page.waitForFunction(() => window.EloAssistente && window.EloDashboardView && window.EloDashboardActions && window.EloPriceEngine && window.EloProjectApiClient);
      const result = await page.evaluate(() => {
        window.StockAiCompositionEngine.importOfficialBase({ rows: [
          { source: "SINAPI", compositionCode: "SINAPI-ALV-001", compositionName: "Alvenaria de vedacao com bloco ceramico baiano", compositionUnit: "m2", serviceType: "alvenaria", inputCode: "BLOCO", inputName: "Bloco ceramico", inputUnit: "un", coefficient: "13,5" },
          { source: "SINAPI", compositionCode: "SINAPI-COB-001", compositionName: "Telhamento com telha ceramica portuguesa", compositionUnit: "m2", serviceType: "cobertura", inputCode: "TELHA", inputName: "Telha ceramica portuguesa", inputUnit: "un", coefficient: "16" },
          { source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso com argamassa colante", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante", inputUnit: "kg", coefficient: "4,2" }
        ] }, { state: "BA", referenceMonth: "2026-06" });
        const budget = window.EloBudgetEngine.buildPreliminaryBudget({ originalMessage: "casa t?rrea 80m?, bloco baiano, telha portuguesa, piso cer?mico 50m?" }, {});
        window.EloDashboardView.renderEloDashboard("#elo-operational-dashboard", Object.assign({}, budget.dashboardData, {
          projectRecordId: budget.projectRecordId,
          baseStatus: budget.baseStatus,
          executiveClosing: budget.executiveClosing,
          closingChecklist: budget.closingChecklist,
          selectableCompositions: budget.selectableCompositions,
          missing: budget.missing
        }));
        return {
          projectRecordId: budget.projectRecordId,
          canTotal: budget.priceStatus.canTotal,
          hasDashboardHtml: !!budget.operationalDashboardHtml,
          csv: window.EloDashboardActions.exportCsv(),
          checklist: window.EloDashboardActions.generateExecutiveChecklist()
        };
      });
      expect(result.projectRecordId).not.toBe("");
      expect(result.canTotal).toBe(false);
      expect(result.hasDashboardHtml).toBe(true);
      expect(result.csv).toMatch(/Pacote;/);
      expect(result.csv).toMatch(/Quantidade/);
      expect(result.checklist.canClose).toBe(false);
      await expect(page.locator("#elo-operational-dashboard")).toContainText("Painel operacional do ELO");
      await expect(page.locator("#elo-operational-dashboard")).toContainText("Base SINAPI");
      await expect(page.locator("#elo-operational-dashboard")).toContainText("Checklist executivo");
      await expect(page.locator("#elo-operational-dashboard button", { hasText: "Exportar CSV" })).toBeVisible();
      await expect(page.locator("#elo-operational-dashboard button", { hasText: "Selecionar" }).first()).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
