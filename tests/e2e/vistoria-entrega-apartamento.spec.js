import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createApp } from "../../backend/src/app.js";

const appUrl = process.env.VISTORIA_BASE_URL || "http://127.0.0.1:5542";
const productionApiBaseUrl = "https://obrareport-backend.onrender.com";

async function openFresh(page) {
  await page.goto(`${appUrl}/vistoria-entrega-apartamento/`);
  await page.evaluate(() => window.VistoriaEntregaApp.reset());
}

async function startInspection(page) {
  await page.locator("[data-field='projectName']").fill("Residencial Campo Real");
  await page.locator("[data-field='developerName']").fill("Construtora Alfa");
  await page.locator("[data-field='towerName']").fill("Torre B");
  await page.locator("[data-field='unitName']").fill("Apto 802");
  await page.locator("[data-field='address']").fill("Rua Técnica, 100");
  await page.locator("[data-field='clientName']").fill("Cliente Teste");
  await page.locator("[data-field='technicalResponsible']").fill("Eng. Responsável");
  await page.locator("[data-field='professionalRegistry']").fill("CREA 12345");
  await page.locator("[data-field='inspectionType']").selectOption("Pré-entrega");
  await page.locator("[data-field='initialNotes']").fill("Vistoria com acesso liberado.");
  await page.locator("[data-start-inspection]").click();
}

async function openEnvironment(page, name) {
  const card = page.locator("[data-environment-grid] [data-open-env]").filter({ hasText: name }).first();
  if (await card.isVisible()) {
    await card.click();
    return;
  }
  await page.getByRole("button", { name, exact: true }).click();
}

async function openItem(page, itemId) {
  await page.locator(`[data-item-id='${itemId}'] [data-open-item]`).click();
}

async function registerNc(page, itemId, description, photoCount = 0) {
  await openItem(page, itemId);
  await page.locator("[data-sheet-status='NC']").click();
  await page.locator("[data-nc-severity]").selectOption("media");
  await page.locator("[data-nc-notes]").fill(description);
  await page.locator("[data-nc-recommendation]").fill("Corrigir e registrar re-vistoria.");
  if (photoCount > 0) {
    await page.locator("[data-nc-photo]").setInputFiles(Array.from({ length: photoCount }, (_, index) => ({
      name: `campo-${index + 1}.jpg`,
      mimeType: "image/jpeg",
      buffer: Buffer.from([255, 216, 255, 217])
    })));
  }
  await page.locator("[data-save-item]").click();
}

async function startBackendServer() {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function closeBackendServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function completeInspectionInStorage(page) {
  await page.evaluate(() => {
    const key = "obrareport-apartment-handover-inspection-v2";
    const state = window.VistoriaEntregaApp.getState();
    const now = new Date().toISOString();
    for (const result of Object.values(state.inspection.results)) {
      if (result.status === "NAO_INSPECIONADO") {
        result.status = "C";
        result.confirmedByUser = true;
        result.confirmedAt = now;
      }
    }
    state.inspection.status = "completed";
    state.inspection.completedAt = now;
    localStorage.setItem(key, JSON.stringify(state));
  });
  await page.reload();
  await page.locator("[data-view-button='dashboard']").click();
}
test.describe("vistoria de entrega profissional isolada", () => {
  test.beforeEach(async ({ page }) => {
    await openFresh(page);
  });

  test("abre app, preenche identificação, inicia e mostra dashboard profissional", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Vistoria de Entrega" })).toBeVisible();
    await startInspection(page);

    await expect(page.locator("[data-dashboard-cards]")).toContainText("Progresso total");
    await expect(page.locator("[data-environment-grid]")).toContainText("Geral da unidade");

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.type).toBe("apartment_handover_inspection");
    expect(state.inspection.metadata.projectName).toBe("Residencial Campo Real");
    expect(state.inspection.items.length).toBeGreaterThanOrEqual(80);
    expect(state.inspection.environments.length).toBe(13);
    expect(state.inspection.systems.length).toBe(18);
    expect(state.inspection.summary.counts.NAO_INSPECIONADO).toBe(state.inspection.summary.counts.total);
  });

  test("navega por ambiente, filtra pendentes, busca item e registra C NA NV", async ({ page }) => {
    await startInspection(page);
    await openEnvironment(page, "Sala");
    await page.locator("[data-search-input]").fill("janela");
    await expect(page.locator("[data-item-list]")).toContainText("Janela");
    await page.locator("[data-search-input]").fill("");

    await page.locator("[data-filter='pending']").click();
    await expect(page.locator("[data-item-list]")).toContainText("Não Inspecionado");

    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-sheet-status='C']").click();
    await page.locator("[data-observation]").fill("Sem ressalvas.");
    await page.locator("[data-save-item]").click();

    await openItem(page, "sala-piso-aderencia");
    await page.locator("[data-sheet-status='NA']").click();
    await page.locator("[data-na-justification]").fill("Ambiente entregue sem esse acabamento específico.");
    await page.locator("[data-save-item]").click();

    await openItem(page, "sala-janela-vedacao");
    await page.locator("[data-sheet-status='NV']").click();
    await page.locator("[data-nv-reason]").selectOption("acesso_impedido");
    await page.locator("[data-save-item]").click();

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-integridade"].status).toBe("C");
    expect(state.inspection.results["sala::sala-piso-aderencia"].status).toBe("NA");
    expect(state.inspection.results["sala::sala-janela-vedacao"].status).toBe("NV");
    expect(state.inspection.summary.environmentStatuses.find((env) => env.id === "sala").label).toBe("EM ANDAMENTO");
  });

  test("registra NC com descrição, severidade e 2 fotos preservadas após reload", async ({ page }) => {
    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-severity]").selectOption("alta");
    await page.locator("[data-nc-notes]").fill("Piso com peça trincada junto ao acesso da sala.");
    await page.locator("[data-nc-recommendation]").fill("Substituir peça antes da entrega definitiva.");
    await page.locator("[data-nc-photo]").setInputFiles([
      { name: "foto-1.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) },
      { name: "foto-2.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) }
    ]);
    await page.locator("[data-save-item]").click();
    await page.waitForFunction(() => window.VistoriaEntregaApp.getState().inspection.results["sala::sala-piso-integridade"].photoIds.length === 2);

    await page.reload();
    await page.locator("[data-view-button='dashboard']").click();
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await expect(page.locator("[data-photo-status]")).toContainText("2 foto(s) vinculada(s)");

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    const result = state.inspection.results["sala::sala-piso-integridade"];
    expect(result.status).toBe("NC");
    expect(result.severity).toBe("alta");
    expect(result.photoIds).toHaveLength(2);
  });

  test("registra medição e cadastra instrumento local", async ({ page }) => {
    await startInspection(page);
    await page.locator("[data-instrument-type]").fill("Multímetro calibrado");
    await page.locator("[data-instrument-brand]").fill("Minipa");
    await page.locator("[data-instrument-model]").fill("ET-1000");
    await page.locator("[data-instrument-id]").fill("PAT-77");
    await page.locator("[data-add-instrument]").click();
    await expect(page.locator("[data-instrument-list]")).toContainText("Multímetro calibrado");

    await openEnvironment(page, "Sala");
    await page.getByRole("button", { name: "Instalações elétricas" }).click();
    await openItem(page, "sala-pontos-tensao");
    await expect(page.locator("[data-measurement-panel]")).toBeVisible();
    await page.locator("[data-sheet-status='C']").click();
    await page.locator("[data-measurement-value]").fill("127");
    await page.locator("[data-measurement-instrument]").selectOption("Multímetro calibrado");
    await page.locator("[data-save-item]").click();

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.instruments.some((inst) => inst.type === "Multímetro calibrado")).toBe(true);
    expect(state.inspection.measurements["sala::sala-pontos-tensao"].value).toBe("127");
  });

  test("ambiente NA, bulk conforme, lista global de NC e resumo", async ({ page }) => {
    await startInspection(page);
    await openEnvironment(page, "Cozinha");
    await openItem(page, "cozinha-cozinha-bancada");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-severity]").selectOption("critica");
    await page.locator("[data-nc-notes]").fill("Bancada fissurada.");
    await page.locator("[data-save-item]").click();

    await page.locator("[data-finish-environment]").click();
    await expect(page.locator("[data-bulk-dialog]")).toBeVisible();
    await page.locator("[data-confirm-bulk]").click();

    await openEnvironment(page, "Varanda");
    await page.locator("[data-mark-environment-na]").click();
    await expect(page.locator("[data-env-na-dialog]")).toBeVisible();
    await page.locator("[data-confirm-env-na]").click();

    await page.locator("[data-view-button='ncs']").click();
    await expect(page.locator("[data-global-nc-list]")).toContainText("Bancada fissurada.");
    await page.locator("[data-nc-filter='critica']").click();
    await expect(page.locator("[data-global-nc-list]")).toContainText("critica");

    await page.locator("[data-summary-button]").click();
    await expect(page.locator("[data-full-summary]")).toContainText("Não conformes: 1");

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    const varanda = Object.values(state.inspection.results).filter((result) => result.environmentId === "varanda");
    expect(varanda.every((result) => result.status === "NA")).toBe(true);
    expect(varanda.every((result) => result.bulkAction === "environment_na")).toBe(true);
    expect(state.inspection.results["cozinha::cozinha-piso-integridade"].bulkAction).toBe("environment_c");
  });

  test("autosave, reload, finalizar vistoria e reabrir para edição", async ({ page }) => {
    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-sheet-status='C']").click();
    await page.locator("[data-save-item]").click();

    await page.reload();
    await page.locator("[data-view-button='dashboard']").click();
    await page.locator("[data-finalize-inspection]").click();
    await expect(page.locator("[data-finalize-warning]")).toContainText("itens não inspecionados");
    await page.locator("[data-confirm-finalize]").click();
    await expect(page.locator("[data-reopen-inspection]")).toBeVisible();
    await page.locator("[data-reopen-inspection]").click();

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-integridade"].status).toBe("C");
    expect(state.inspection.completedAt).toBeTruthy();
    expect(state.inspection.reopenedAt).toBeTruthy();
    expect(state.inspection.status).toBe("draft");
  });


  test("analisa foto com IA mockada, aceita parcialmente e nao sobrescreve automatico", async ({ page }) => {
    let requestPayload = null;
    let requestUrl = "";
    await page.route("**/api/ai/analyze-image", async (route) => {
      requestUrl = route.request().url();
      requestPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "remote",
          title: "Análise visual da foto",
          analysis: {
            categoriaProvavel: "fissura aparente em acabamento",
            confianca: "alta",
            descricaoTecnica: "Observa-se fissura aparente junto ao encontro entre parede e esquadria.",
            possiveisInconformidades: ["Fissura aparente"],
            grauPreliminar: "media",
            recomendacaoAcao: "Recomenda-se avaliação do acabamento e correção localizada após validação do responsável.",
            suggestedItemId: "sala-janela-vedacao",
            suggestedSystemId: "janelas",
            suggestedEnvironmentId: "sala"
          },
          suggestion: "Sugestão textual controlada",
          note: "Mock"
        })
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Descrição manual preservada.");
    await page.locator("[data-nc-recommendation]").fill("Recomendação manual preservada.");
    await page.locator("[data-nc-photo]").setInputFiles({ name: "ia.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();
    await page.waitForFunction(() => window.VistoriaEntregaApp.getState().inspection.results["sala::sala-parede-pintura"].photoIds.length === 1);

    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-status]")).toContainText(/Analisando|Sugestão pronta/);
    await expect(page.locator("[data-ai-card]")).toContainText("Sugestão da IA");
    await expect(page.locator("[data-ai-card]")).toContainText("fissura aparente");
    await expect(page.locator("[data-ai-card]")).toContainText("sala-janela-vedacao");
    await page.locator("[data-dismiss-ai]").click();
    await expect(page.locator("[data-ai-card]")).toBeHidden();
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-card]")).toContainText("sala-janela-vedacao");

    let state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    let result = state.inspection.results["sala::sala-parede-pintura"];
    expect(requestUrl).toBe(`${productionApiBaseUrl}/api/ai/analyze-image`);
    expect(requestPayload.context.inspection.type).toBe("vistoria de entrega de apartamento");
    expect(requestPayload.context.inspection.environment.name).toBe("Sala");
    expect(requestPayload.context.inspection.system.name).toBe("Paredes");
    expect(requestPayload.context.inspection.item.id).toBe("sala-parede-pintura");
    expect(requestPayload.context.inspection.acceptanceCriteria).toContain("Pintura homogênea");
    expect(requestPayload.context.technicalContext).toContain("AMBIENTE: Sala");
    expect(requestPayload.context.technicalContext).toContain("SISTEMA: Paredes");
    expect(requestPayload.context.technicalContext).toContain("ITEM: Paredes com pintura uniforme");
    expect(requestPayload.context.technicalContext).toContain("CRITÉRIO DE ACEITAÇÃO: Pintura homogênea");
    expect(requestPayload.context.objective).toContain("item específico");
    expect(requestPayload.image.base64).toBeTruthy();
    expect(result.notes).toBe("Descrição manual preservada.");
    expect(result.recommendation).toBe("Recomendação manual preservada.");
    expect(result.confirmedByUser).toBe(true);
    expect(result.aiSuggestion.context).toEqual({ environmentId: "sala", systemId: "paredes", itemId: "sala-parede-pintura" });
    expect(result.aiSuggestion.recommendationSource).toBe("analysis");
    expect(result.aiSuggestion.recommendation).toContain("Recomenda-se avaliação");
    expect(result.aiSuggestion.suggestedStatus).toBe("NC");
    expect(result.aiSuggestion.suggestedSeverity).toBe("media");
    expect(result.aiSuggestion.suggestedItemId).toBe("sala-janela-vedacao");
    expect(result.aiSuggestion.suggestedEnvironmentId).toBeNull();

    await page.locator("[data-apply-ai='description']").click();
    await page.locator("[data-apply-ai='severity']").click();
    await page.locator("[data-apply-ai='item']").click();
    await page.locator("[data-apply-ai='environment']").click();
    await page.locator("[data-save-item]").click();
    state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    result = state.inspection.results["sala::sala-parede-pintura"];
    expect(result.notes).toContain("fissura aparente");
    expect(result.recommendation).toBe("Recomendação manual preservada.");
    expect(result.severity).toBe("media");
    expect(result.aiSuggestion.acceptedFields).toEqual(expect.arrayContaining(["description", "severity", "item"]));
    expect(result.aiSuggestion.acceptedFields).not.toContain("environment");
    expect(result.suggestedItemAccepted.itemId).toBe("sala-janela-vedacao");
    expect(result.suggestedEnvironmentAccepted).toBeUndefined();
  });

  test("trata recomendacao ausente sem inventar conteudo da IA", async ({ page }) => {
    await page.route("**/api/ai/analyze-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "remote",
          title: "Análise visual da foto",
          analysis: {
            confianca: "media",
            descricaoTecnica: "Imagem permite ver acabamento, mas não permite concluir providência técnica apenas pela foto.",
            possiveisInconformidades: [],
            grauPreliminar: "baixa",
            recomendacaoAcao: ""
          },
          suggestion: "",
          note: "Mock sem recomendação"
        })
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Descrição manual preservada sem recomendação da IA.");
    await page.locator("[data-nc-recommendation]").fill("Recomendação manual preservada sem IA.");
    await page.locator("[data-nc-photo]").setInputFiles({ name: "sem-rec.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();
    await page.waitForFunction(() => window.VistoriaEntregaApp.getState().inspection.results["sala::sala-parede-pintura"].photoIds.length === 1);

    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-card]")).toContainText("A IA não retornou recomendação técnica para esta imagem.");
    await expect(page.locator("[data-ai-card]")).toContainText("Fonte da recomendação: not_returned");
    await page.locator("[data-apply-ai='recommendation']").click();
    await page.locator("[data-save-item]").click();

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    const result = state.inspection.results["sala::sala-parede-pintura"];
    expect(result.recommendation).toBe("Recomendação manual preservada sem IA.");
    expect(result.aiSuggestion.recommendation).toBe("");
    expect(result.aiSuggestion.recommendationSource).toBe("not_returned");
    expect(result.aiSuggestion.acceptedFields || []).not.toContain("recommendation");
  });

  test("usa suggestion como recomendacao apenas quando o texto e tecnico e sinaliza incompatibilidade", async ({ page }) => {
    await page.route("**/api/ai/analyze-image", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "remote",
          title: "Análise visual da foto",
          analysis: {
            confianca: "alta",
            descricaoTecnica: "A imagem pode não corresponder ao item informado e mostra ponto de vedação aparente.",
            possiveisInconformidades: ["Vedação aparente"],
            grauPreliminar: "alta",
            recomendacaoAcao: "",
            itemMismatch: true,
            suggestedItemId: "sala-janela-vedacao",
            suggestedSystemId: "janelas"
          },
          suggestion: "Recomenda-se verificar a vedação da esquadria e registrar nova foto enquadrando o item correto.",
          note: "Mock"
        })
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Descrição manual preservada com possível incompatibilidade.");
    await page.locator("[data-nc-photo]").setInputFiles({ name: "suggestion-rec.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();
    await page.waitForFunction(() => window.VistoriaEntregaApp.getState().inspection.results["sala::sala-parede-pintura"].photoIds.length === 1);

    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-card]")).toContainText("Fonte da recomendação: suggestion");
    await expect(page.locator("[data-ai-card]")).toContainText("A imagem pode não corresponder ao item atual");
    await expect(page.locator("[data-ai-card]")).toContainText("sala-janela-vedacao");

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    const result = state.inspection.results["sala::sala-parede-pintura"];
    expect(result.aiSuggestion.recommendationSource).toBe("suggestion");
    expect(result.aiSuggestion.recommendation).toContain("verificar a vedação");
    expect(result.aiSuggestion.itemMismatch).toBe(true);
    expect(result.aiSuggestion.context).toEqual({ environmentId: "sala", systemId: "paredes", itemId: "sala-parede-pintura" });
    expect(result.suggestedItemAccepted).toBeUndefined();
  });

  test("descarta sugestao, trata erro de backend e offline sem bloquear preenchimento manual", async ({ page, context }) => {
    await page.route("**/api/ai/analyze-image", async (route) => {
      await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Backend indisponível" }) });
    });
    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Falha manual continua editável.");
    await page.locator("[data-nc-photo]").setInputFiles({ name: "erro.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();
    await page.waitForFunction(() => window.VistoriaEntregaApp.getState().inspection.results["sala::sala-piso-integridade"].photoIds.length === 1);

    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-status]")).toContainText("Backend indisponível");
    await page.locator("[data-save-item]").click();

    await context.setOffline(true);
    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-analyze-ai]").click();
    await expect(page.locator("[data-ai-status]")).toContainText("indisponível sem conexão");
    await context.setOffline(false);

    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    const result = state.inspection.results["sala::sala-piso-integridade"];
    expect(result.notes).toBe("Falha manual continua editável.");
    expect(result.photoIds).toHaveLength(1);
  });

  test("gera rascunho em PDF, mostra loading e cria links blob sem localStorage", async ({ page }) => {
    let requestPayload = null;
    let resolveRoute;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      requestPayload = route.request().postDataJSON();
      await new Promise((resolve) => { resolveRoute = resolve; });
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% UI mock\n%%EOF")
      });
    });

    await startInspection(page);
    const requestPromise = page.waitForRequest("**/api/apartment-handover/pdf");
    await page.locator("[data-generate-draft-pdf]").click();
    await expect(page.locator("[data-generate-draft-pdf]")).toBeDisabled();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Gerando rascunho");
    resolveRoute();
    await requestPromise;
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho gerado");
    await expect(page.locator("[data-open-pdf]")).toHaveAttribute("href", /^blob:/);
    await expect(page.locator("[data-download-pdf]")).toHaveAttribute("download", "Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf");

    expect(requestPayload.mode).toBe("draft");
    expect(requestPayload.report.type).toBe("apartment_handover_inspection");
    expect(requestPayload.report.inspection.status).toBe("draft");
    const storageHasPdf = await page.evaluate(() => Object.keys(localStorage).some((key) => /pdf|laudo/i.test(key)));
    expect(storageHasPdf).toBe(false);
  });

  test("gera laudo final apenas depois da vistoria finalizada", async ({ page }) => {
    let requestPayload = null;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      requestPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% UI mock final\n%%EOF")
      });
    });

    await startInspection(page);
    await expect(page.locator("[data-generate-final-pdf]")).toBeHidden();
    await page.locator("[data-finalize-inspection]").click();
    await page.locator("[data-confirm-finalize]").click();
    await expect(page.locator("[data-generate-final-pdf]")).toBeVisible();
    await page.locator("[data-generate-final-pdf]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Laudo gerado com sucesso");

    expect(requestPayload.mode).toBe("final");
    expect(requestPayload.report.inspection.finalizada).toBe(true);
    expect(requestPayload.report.responsavelTecnico).toBe("Eng. Responsável");
  });

  test("mostra modal de preflight quando o laudo final fica bloqueado", async ({ page }) => {
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          code: "INSPECTION_PREFLIGHT_BLOCKED",
          review: {
            canGenerateFinal: false,
            blockers: [{ title: "Descrição técnica ausente", message: "Não conformidade sem descrição técnica.", ambiente: "Sala", sistema: "Pisos", item: "Piso com peça trincada" }],
            warnings: [{ title: "Não conformidade sem foto", message: "Revise a evidência antes da emissão final.", ambiente: "Sala", sistema: "Pisos", item: "Piso com peça trincada" }]
          }
        })
      });
    });

    await startInspection(page);
    await page.locator("[data-finalize-inspection]").click();
    await page.locator("[data-confirm-finalize]").click();
    await page.locator("[data-generate-final-pdf]").click();

    await expect(page.locator("[data-pdf-dialog]")).toContainText("O laudo final ainda não pode ser emitido.");
    await expect(page.locator("[data-pdf-blockers]")).toContainText("Descrição técnica ausente");
    await expect(page.locator("[data-pdf-warnings]")).toContainText("Não conformidade sem foto");
    await expect(page.locator("[data-pdf-actions]")).toBeHidden();
  });

  test("informa falha do backend sem bloquear nova tentativa manual", async ({ page }) => {
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, code: "APARTMENT_HANDOVER_PDF_FAILED" }) });
    });

    await startInspection(page);
    await page.locator("[data-generate-draft-pdf]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Não foi possível gerar o relatório.");
    await expect(page.locator("[data-generate-draft-pdf]")).toBeEnabled();
  });

  test("mobile 390x844 simula campo com 1 NC, medicao, instrumento, reload, draft e final", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let calls = 0;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      calls += 1;
      const payload = route.request().postDataJSON();
      expect(payload.report.inspection.items.filter((item) => item.status === "NC")).toHaveLength(1);
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% mobile mock\n%%EOF")
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-aderencia");
    await page.locator("[data-sheet-status='C']").click();
    await page.locator("[data-save-item]").click();
    await registerNc(page, "sala-piso-integridade", "Piso com peça trincada em teste mobile.", 3);
    await page.reload();
    await page.locator("[data-view-button='dashboard']").click();
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await expect(page.locator("[data-photo-status]")).toContainText("3 foto(s) vinculada(s)");
    await page.locator("[data-close-sheet]").click();

    await page.getByRole("button", { name: "Instalações elétricas" }).click();
    await openItem(page, "sala-pontos-tensao");
    await page.locator("[data-sheet-status='C']").click();
    await page.locator("[data-measurement-value]").fill("127");
    await page.locator("[data-save-item]").click();
    await page.locator("[data-view-button='dashboard']").click();
    await page.locator("[data-instrument-type]").fill("Multímetro campo");
    await page.locator("[data-instrument-id]").fill("CAMPO-01");
    await page.locator("[data-add-instrument]").click();

    await page.locator("[data-generate-draft-pdf]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho gerado com sucesso");
    await expect(page.locator("[data-open-pdf]")).toHaveText("Abrir Laudo");
    await expect(page.locator("[data-download-pdf]")).toHaveText("Baixar PDF");
    await page.locator("[data-close-pdf-dialog]").click();

    await completeInspectionInStorage(page);
    await page.locator("[data-generate-final-pdf]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Laudo gerado com sucesso");
    expect(calls).toBe(2);
  });

  test("5 NCs e multiplas fotos entram no payload do PDF", async ({ page }) => {
    let pdfPayload = null;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      pdfPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% 5 ncs mock\n%%EOF")
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await registerNc(page, "sala-piso-integridade", "NC 1 com múltiplas fotos.", 5);
    await registerNc(page, "sala-piso-aderencia", "NC 2 registrada.");
    await registerNc(page, "sala-parede-pintura", "NC 3 registrada.");
    await registerNc(page, "sala-teto-acabamento", "NC 4 registrada.");
    await registerNc(page, "sala-janela-vedacao", "NC 5 registrada.");
    await page.locator("[data-view-button='dashboard']").click();
    await page.locator("[data-generate-draft-pdf]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho gerado com sucesso");

    const ncs = pdfPayload.report.inspection.items.filter((item) => item.status === "NC");
    expect(ncs).toHaveLength(5);
    expect(ncs[0].fotos).toHaveLength(5);
  });

  test("duplo clique em gerar laudo dispara somente uma geracao ativa", async ({ page }) => {
    let calls = 0;
    let release;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% double click mock\n%%EOF")
      });
    });

    await startInspection(page);
    await completeInspectionInStorage(page);
    const first = page.locator("[data-generate-final-pdf]");
    await first.dblclick({ delay: 10 });
    await expect(first).toBeDisabled();
    release();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Laudo gerado com sucesso");
    expect(calls).toBe(1);
  });

  test("smoke real local app backend pdf blob download", async ({ page }) => {
    const { server, baseUrl } = await startBackendServer();
    try {
      await page.addInitScript((url) => { window.OBRAREPORT_API_BASE_URL = url; }, baseUrl);
      await openFresh(page);
      await startInspection(page);
      await completeInspectionInStorage(page);
      await page.locator("[data-generate-final-pdf]").click();
      await expect(page.locator("[data-pdf-dialog]")).toContainText("Laudo gerado com sucesso", { timeout: 30000 });
      await expect(page.locator("[data-open-pdf]")).toHaveAttribute("href", /^blob:/);
      const downloadPromise = page.waitForEvent("download");
      await page.locator("[data-download-pdf]").click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe("Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf");
      const path = await download.path();
      const pdf = readFileSync(path);
      expect(pdf.subarray(0, 4).toString("utf8")).toBe("%PDF");
      expect(pdf.length).toBeGreaterThan(30000);
    } finally {
      await closeBackendServer(server);
    }
  });

  test("UX campo: C em um toque e camera/galeria separadas", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startInspection(page);
    await openEnvironment(page, "Sala");

    const firstCard = page.locator("[data-item-id='sala-piso-integridade']");
    await firstCard.locator("[data-status='C']").click();
    await expect(page.locator("[data-item-sheet]")).toBeHidden();

    let state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-integridade"].status).toBe("C");

    await openItem(page, "sala-piso-aderencia");
    await page.locator("[data-sheet-status='NC']").click();
    await expect(page.getByText("Tirar foto")).toBeVisible();
    await expect(page.getByText("Escolher da galeria")).toBeVisible();
    await expect(page.locator("[data-nc-photo-camera]")).toHaveAttribute("capture", "environment");
    await expect(page.locator("[data-nc-photo-gallery]")).not.toHaveAttribute("capture", /.+/);
    await page.locator("[data-nc-notes]").fill("NC registrada com câmera.");
    await page.locator("[data-nc-photo-camera]").setInputFiles({ name: "camera.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();

    await openItem(page, "sala-parede-pintura");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("NC registrada com galeria.");
    await page.locator("[data-nc-photo-gallery]").setInputFiles({ name: "galeria.jpg", mimeType: "image/jpeg", buffer: Buffer.from([255, 216, 255, 217]) });
    await page.locator("[data-save-item]").click();

    state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-aderencia"].photoIds).toHaveLength(1);
    expect(state.inspection.results["sala::sala-parede-pintura"].photoIds).toHaveLength(1);
  });

  test("UX campo: gerar relatorio no topo com 2 itens, draft parcial, autosave e download", async ({ page }) => {
    let requestPayload = null;
    let requestUrl = "";
    let calls = 0;
    let release;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      calls += 1;
      requestUrl = route.request().url();
      requestPayload = route.request().postDataJSON();
      await new Promise((resolve) => { release = resolve; });
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% top report draft\n%%EOF")
      });
    });

    await startInspection(page);
    await expect(page.locator("[data-generate-report]")).toBeVisible();
    await openEnvironment(page, "Sala");
    await page.locator("[data-item-id='sala-piso-integridade'] [data-status='C']").click();
    await openItem(page, "sala-piso-aderencia");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Piso com som cavo em trecho próximo ao acesso.");
    await page.locator("[data-nc-recommendation]").fill("Revisar aderência e corrigir antes da entrega.");

    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-generate-report]").click();
    await expect(page.locator("[data-generate-report]")).toBeDisabled();
    release();
    const download = await downloadPromise;
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho gerado com sucesso");
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf");
    await expect(page.locator("[data-open-pdf]")).toHaveAttribute("href", /^blob:/);
    await expect(page.locator("[data-download-pdf]")).toHaveAttribute("download", "Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf");

    expect(download.suggestedFilename()).toBe("Rascunho-Vistoria-Residencial-Campo-Real-Apto-802.pdf");
    expect(calls).toBe(1);
    expect(requestUrl).toBe(`${productionApiBaseUrl}/api/apartment-handover/pdf`);
    expect(requestPayload.mode).toBe("draft");
    expect(requestPayload.report.inspection.finalizada).toBe(false);
    expect(requestPayload.report.inspection.items).toHaveLength(144);
    expect(requestPayload.report.inspection.items.filter((item) => item.status === "C")).toHaveLength(1);
    expect(requestPayload.report.inspection.items.filter((item) => item.status === "NC")).toHaveLength(1);
    expect(requestPayload.report.inspection.items.filter((item) => item.status === "NI")).toHaveLength(142);
    expect(requestPayload.report.inspection.summary.counts.C).toBe(1);
    expect(requestPayload.report.inspection.summary.counts.NC).toBe(1);
    expect(requestPayload.report.inspection.summary.counts.NAO_INSPECIONADO).toBe(142);
    const state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.status).toBe("draft");
    expect(state.inspection.results["sala::sala-piso-aderencia"].notes).toContain("som cavo");
  });

  test("UX campo: finalizada apta usa FINAL no botao superior", async ({ page }) => {
    let requestPayload = null;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      requestPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% top report final\n%%EOF")
      });
    });

    await startInspection(page);
    await completeInspectionInStorage(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-generate-report]").click();
    await downloadPromise;
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Laudo gerado com sucesso");
    expect(requestPayload.mode).toBe("final");
    expect(requestPayload.report.inspection.finalizada).toBe(true);
  });

  test("UX campo: finalizada com blocker informa pendencia e gera DRAFT", async ({ page }) => {
    const modes = [];
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      const payload = route.request().postDataJSON();
      modes.push(payload.mode);
      if (payload.mode === "final") {
        await route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({ ok: false, code: "INSPECTION_PREFLIGHT_BLOCKED", review: { canGenerateFinal: false, blockers: [{ title: "Descrição técnica ausente", message: "Não conformidade sem descrição técnica." }], warnings: [] } })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% fallback draft\n%%EOF")
      });
    });

    await startInspection(page);
    await completeInspectionInStorage(page);
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-generate-report]").click();
    await downloadPromise;
    await expect(page.locator("[data-pdf-dialog]")).toContainText("O laudo final possui pendências");
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Rascunho gerado com sucesso");
    expect(modes).toEqual(["final", "draft"]);
  });

  test("UX campo: duplo clique e erro de rede preservam dados", async ({ page }) => {
    let calls = 0;
    let release;
    await page.route("**/api/apartment-handover/pdf", async (route) => {
      calls += 1;
      await new Promise((resolve) => { release = resolve; });
      await route.fulfill({
        status: 200,
        contentType: "application/pdf",
        headers: { "content-disposition": "attachment; filename=\"Laudo-Vistoria-Residencial-Campo-Real-Apto-802.pdf\"" },
        body: Buffer.from("%PDF-1.4\n% double top\n%%EOF")
      });
    });

    await startInspection(page);
    await openEnvironment(page, "Sala");
    await openItem(page, "sala-piso-integridade");
    await page.locator("[data-sheet-status='NC']").click();
    await page.locator("[data-nc-notes]").fill("Dado preservado durante duplo clique.");
    const downloadPromise = page.waitForEvent("download");
    await page.locator("[data-generate-report]").dblclick({ delay: 10 });
    await expect(page.locator("[data-generate-report]")).toBeDisabled();
    release();
    await downloadPromise;
    expect(calls).toBe(1);
    let state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-integridade"].notes).toContain("Dado preservado");

    await page.unroute("**/api/apartment-handover/pdf");
    await page.route("**/api/apartment-handover/pdf", async (route) => route.abort());
    await page.locator("[data-close-pdf-dialog]").click();
    await page.locator("[data-generate-report]").click();
    await expect(page.locator("[data-pdf-dialog]")).toContainText("Não foi possível gerar o relatório.");
    await expect(page.locator("[data-generate-report]")).toBeEnabled();
    state = await page.evaluate(() => window.VistoriaEntregaApp.getState());
    expect(state.inspection.results["sala::sala-piso-integridade"].notes).toContain("Dado preservado");
  });
  test("template suporta validação artificial de 300 itens sem travar", async ({ page }) => {
    await startInspection(page);
    const perf = await page.evaluate(() => {
      const t0 = performance.now();
      const items = window.VistoriaEntregaApp.buildPerformanceTemplate(300);
      const elapsed = performance.now() - t0;
      return { total: items.length, elapsed };
    });
    expect(perf.total).toBe(300);
    expect(perf.elapsed).toBeLessThan(100);
  });
});







