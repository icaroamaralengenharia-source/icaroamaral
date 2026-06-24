import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const surfaces = [
  { name: "elo.html", file: "elo.html" },
  { name: "stock-ai-obras.html", file: "stock-ai-obras.html" },
  { name: "relatorio-qualidade-obras.html", file: "relatorio-qualidade-obras/relatorio-qualidade-obras.html" }
];

function surfaceUrl(surface) {
  return pathToFileURL(resolve(surface.file)).href;
}

async function loadSurface(page, surface) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(surfaceUrl(surface));
  await page.waitForFunction(() => window.EloAssistente && window.EloAssistente.buildResponseForTest && window.EloBrainRouter && window.EloBudgetEngine && window.EloBudgetTableEngine && window.EloConsumptionEngine && window.EloQuantityEngine && window.EloWorkPackageEngine && window.EloTechnicalEngine && window.CompositionSearchEngine && window.StockAiCompositionEngine);
  expect(errors, `${surface.name} sem pageerror`).toEqual([]);
}

async function ask(page, message) {
  return page.evaluate((question) => {
    const response = window.EloAssistente.buildResponseForTest(question);
    return {
      shortAnswer: response && response.shortAnswer || "",
      fullAnswer: response && response.fullAnswer || "",
      sessionIntent: response && response.sessionIntent || "",
      brain: response && response.eloBrain && response.eloBrain.brain || "",
      reason: response && response.eloBrain && response.eloBrain.reason || "",
      technicalMode: response && response.technicalEngine && response.technicalEngine.mode || "",
      searchFound: !!(response && response.technicalEngine && response.technicalEngine.compositionSearch && response.technicalEngine.compositionSearch.found),
      searchIndexed: response && response.technicalEngine && response.technicalEngine.compositionSearch && response.technicalEngine.compositionSearch.indexedCount || 0
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
      expect(piso.brain).toBe("technical");
      expect(piso.fullAnswer).toMatch(/Piso ceramico|Piso cerâmico|50/i);
      expect(piso.fullAnswer).toMatch(/dimens|junta|argamassa|composi/i);
      expect(piso.fullAnswer).not.toMatch(/cliente|cidade\/UF|nome da obra|briefing da obra/i);

      const casa = await ask(page, "casa de 80m² térrea, paredes com 4m de altura e bloco cerâmico baiano");
      expect(casa.brain).toBe("technical");
      expect(casa.fullAnswer).toMatch(/80|Area construida|Área construída/i);
      expect(casa.fullAnswer).toMatch(/4,00 m|4 m|Altura/i);
      expect(casa.fullAnswer).not.toMatch(/Area construida:\s*4/i);
      expect(casa.fullAnswer).not.toMatch(/cliente|cidade\/UF|nome da obra|briefing da obra/i);

      const telhado = await ask(page, "quero telhado com telha portuguesa");
      expect(telhado.brain).toBe("technical");
      expect(telhado.fullAnswer).toMatch(/BUSCA NA BASE OFICIAL|composi/i);
      expect(telhado.fullAnswer).toMatch(/telha|portuguesa|cobertura/i);
      expect(telhado.fullAnswer).not.toMatch(/mensagem genérica|nao entendi|não entendi/i);
    });
  }
});



