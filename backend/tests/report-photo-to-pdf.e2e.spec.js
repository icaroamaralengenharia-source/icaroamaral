import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ARTIFACT_DIR = resolve("artifacts");
const PDF_PATH = join(ARTIFACT_DIR, "report-photo-to-pdf-test.pdf");
const SCREENSHOT_PATH = join(ARTIFACT_DIR, "report-photo-to-pdf-applied.png");
const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";

const MOCK_ANALYSIS = {
  elementoObservado: "Parede interna",
  categoriaProvavel: "Umidade/Infiltracao",
  evidenciasVisuais: [
    "Manchas escuras na superficie",
    "Descascamento localizado da pintura",
    "Indicios de umidade ascendente ou vazamento proximo"
  ],
  possiveisInconformidades: [
    "Falha de impermeabilizacao",
    "Vazamento em tubulacao proxima",
    "Umidade por capilaridade"
  ],
  grauPreliminar: "Medio",
  recomendacaoAcao: "Realizar vistoria complementar, verificar instalacoes hidraulicas proximas, medir umidade e corrigir a origem antes de recompor o revestimento.",
  textoRelatorio: "Observam-se indicios de manifestacao patologica por umidade/infiltracao em parede interna, com manchas e possivel degradacao do revestimento. A causa deve ser confirmada por vistoria tecnica complementar."
};

const MOCK_SUGGESTION = [
  "Elemento observado: " + MOCK_ANALYSIS.elementoObservado,
  "Possivel manifestacao: " + MOCK_ANALYSIS.categoriaProvavel,
  "Evidencias visuais: " + MOCK_ANALYSIS.evidenciasVisuais.join("; "),
  "Verificacoes recomendadas: " + MOCK_ANALYSIS.recomendacaoAcao,
  "Grau preliminar: " + MOCK_ANALYSIS.grauPreliminar,
  "Texto sugerido para relatorio: " + MOCK_ANALYSIS.textoRelatorio,
  "Observacao obrigatoria: Analise preliminar, a confirmar em vistoria."
].join("\n");

const PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAWUlEQVR4nO3PQQ3AIADAQMDK/hqnK6SGYE8X5Nw7sTc9fQH8WQKTYBKTmMSkJjGJSUxiEpOYxCQmMYlJTGISk5jEJCYxiUlMYhKTmMQkJjGJSUxiEpOYxCQmMYlJTGICxwMBPOcCh9cAAAAASUVORK5CYII=";

function imagePayload(name) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(PNG_BASE64, "base64")
  };
}

async function login(page) {
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);
  await page.goto("/relatorio-qualidade-obras/relatorio-qualidade-obras.html");
  await page.evaluate((storageKey) => {
    window.localStorage.clear();
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator('[data-home-action="relatorio"]').first().click();
  await expect(page.locator("#loginForm")).toBeVisible();
  await page.locator("#loginForm [name='userName']").fill("Engenheiro E2E");
  await page.locator("#loginForm [name='userEmail']").fill("engenheiro.e2e@obrareport.local");
  await page.locator("#loginForm [name='userPassword']").fill("ObraReport2026");
  await page.locator("#loginForm button[type='submit']").click();
  await expect(page.locator("#dashboardPanel")).toBeVisible();
}

async function goToRoute(page, route) {
  await page.evaluate((nextRoute) => {
    window.location.hash = "#app/" + nextRoute;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, route);
  await page.waitForTimeout(150);
}
async function createClientAndWork(page) {
  await goToRoute(page, "clientes");
  await expect(page.locator("#clientForm")).toBeVisible();
  await page.locator("#clientForm [name='clientName']").fill("Cliente E2E Foto IA");
  await page.locator("#clientForm [name='clientDocument']").fill("00.000.000/0001-00");
  await page.locator("#clientForm [name='clientPhone']").fill("(71) 99999-0000");
  await page.locator("#clientForm [name='clientEmail']").fill("cliente.e2e@obrareport.local");
  await page.locator("#clientForm button[type='submit']").click();

  await goToRoute(page, "obras");
  await expect(page.locator("#workForm")).toBeVisible();
  await expect.poll(async () => page.locator("#workForm [name='workClientId'] option").count()).toBeGreaterThan(1);
  await page.locator("#workForm [name='workClientId']").selectOption({ index: 1 });
  await page.locator("#workForm [name='workName']").fill("Obra E2E Foto IA");
  await page.locator("#workForm [name='workAddress']").fill("Rua Teste da Vistoria, 123");
  await page.locator("#workForm [name='workType']").selectOption("Residencial");
  await page.locator("#workForm [name='workStatus']").selectOption("Em andamento");
  await page.locator("#workForm button[type='submit']").click();
}

async function openReportEditor(page) {
  await goToRoute(page, "relatorios");
  await expect(page.locator("#reportCreateForm")).toBeVisible();
  await expect.poll(async () => page.locator("#reportCreateForm [name='reportClientId'] option").count()).toBeGreaterThan(1);
  await page.locator("#reportCreateForm [name='reportClientId']").selectOption({ index: 1 });
  await expect.poll(async () => page.locator("#reportCreateForm [name='reportWorkId'] option").count()).toBeGreaterThan(1);
  await page.locator("#reportCreateForm [name='reportWorkId']").selectOption({ index: 1 });
  await page.locator("#reportCreateForm [name='reportTitle']").fill("Relatorio E2E Foto IA PDF");
  await page.locator("#reportCreateForm button[type='submit']").click();
  await expect(page.locator("#qualityReportForm")).toBeVisible();
  await expect(page.locator("[name='obra']")).toHaveValue(/Obra E2E Foto IA/);
}

async function fillReportBasics(page) {
  await page.locator("[name='responsavelTecnico']").fill("Eng. E2E Responsavel");
  await page.locator("[name='nomeEmpresa']").fill("Icaro Amaral Engenharia - Teste E2E");
  await page.locator("[name='creaCau']").fill("CREA-BA 000000/D");
  await page.locator("[name='tipoObra']").selectOption("Residencial");
}

async function attachPhotos(page) {
  await page.locator('[data-step-target="fotos"]').click();
  await page.locator("[name='fotoUnidade01']").setInputFiles(imagePayload("ambiente-01.png"));
  await page.locator("[name='descricaoFotoUnidade01']").fill("Vista geral do ambiente vistoriado.");
  await page.locator("[name='fotoUnidade02']").setInputFiles(imagePayload("ambiente-02.png"));
  await page.locator("[name='descricaoFotoUnidade02']").fill("Registro complementar do ambiente vistoriado.");

  await page.locator('[data-step-target="inconformidades"]').click();
  await page.locator("[name='fotoInconformidade01']").setInputFiles(imagePayload("umidade-parede.png"));
  await expect(page.locator('[data-ai-image-target="fotoInconformidade01"]')).toBeVisible();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function imageTag(photo, alt) {
  const src = photo && photo.base64 ? `data:${photo.mimeType || "image/jpeg"};base64,${photo.base64}` : "";
  return src ? `<img src="${src}" alt="${escapeHtml(alt)}">` : "";
}

async function writePdfFromPayload(browser, payload) {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  const pdfPage = await browser.newPage();
  const report = payload.report || {};
  const photos = payload.fotosUnidade || [];
  const issues = payload.inconformidades || [];
  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatorio tecnico - ObraReport E2E</title>
<style>
  body { font-family: Arial, sans-serif; color: #172033; margin: 40px; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { border-bottom: 1px solid #c8d0dc; padding-bottom: 6px; margin-top: 28px; }
  .meta, .issue { border: 1px solid #d6dde8; border-radius: 8px; padding: 14px; margin: 12px 0; }
  .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  figure { margin: 0; border: 1px solid #d6dde8; padding: 8px; border-radius: 8px; }
  img { width: 100%; height: 140px; object-fit: cover; background: #f3f6fa; }
  figcaption { font-size: 12px; margin-top: 6px; }
  .signature { margin-top: 34px; border-top: 1px solid #172033; width: 320px; padding-top: 8px; }
</style>
</head>
<body>
<h1>Relatorio tecnico de vistoria</h1>
<p>PDF local de conferencia gerado pelo teste E2E do ObraReport.</p>
<section class="meta">
  <strong>Obra:</strong> ${escapeHtml(report.obra)}<br>
  <strong>Local:</strong> ${escapeHtml(report.local)}<br>
  <strong>Responsavel tecnico:</strong> ${escapeHtml(report.responsavelTecnico)}<br>
  <strong>Registro:</strong> ${escapeHtml(report.creaCau)}
</section>
<h2>Galeria de fotos</h2>
<div class="photos">
${photos.map((item) => `<figure>${imageTag(item.foto, "Foto da unidade " + item.numero)}<figcaption>Foto ${escapeHtml(item.numero)} - ${escapeHtml(item.descricao)}</figcaption></figure>`).join("")}
${issues.map((item) => `<figure>${imageTag(item.foto, "Inconformidade " + item.numero)}<figcaption>Inconformidade ${escapeHtml(item.numero)}</figcaption></figure>`).join("")}
</div>
<h2>Inconformidades</h2>
${issues.map((item) => `<section class="issue"><h3>Inconformidade ${escapeHtml(item.numero)}</h3><p><strong>Descricao:</strong> ${escapeHtml(item.descricaoTecnica)}</p><p><strong>Recomendacao:</strong> ${escapeHtml(item.solucaoRecomendada)}</p><p><strong>Grau de risco:</strong> ${escapeHtml(item.grauRisco)}</p></section>`).join("")}
<h2>Observacoes e conclusao</h2>
<p>${escapeHtml(report.observacoes)}</p>
<p>${escapeHtml(report.conclusaoTecnica)}</p>
<div class="signature">${escapeHtml(report.responsavelTecnico)}<br>${escapeHtml(report.creaCau)}</div>
</body>
</html>`;
  await pdfPage.setContent(html, { waitUntil: "load" });
  await pdfPage.pdf({ path: PDF_PATH, format: "A4", printBackground: true });
  await pdfPage.close();
}

test("foto, IA estruturada, campos editaveis e PDF salvo para conferencia", async ({ page, browser }) => {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  let submittedPayload = null;

  await page.route("**/api/ai/analyze-image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "mock-e2e",
        title: "Analise visual mockada",
        suggestion: MOCK_SUGGESTION,
        note: "Mock seguro do E2E sem chamada externa.",
        analysis: MOCK_ANALYSIS
      })
    });
  });

  await page.route("https://script.google.com/**", async (route) => {
    const text = route.request().postData() || "{}";
    const parsed = JSON.parse(text);
    if (parsed && parsed.tipoRelatorio === "fiscalizacao") {
      submittedPayload = parsed;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/plain;charset=utf-8",
      body: JSON.stringify({ ok: true, pdfUrl: "artifacts/report-photo-to-pdf-test.pdf" })
    });
  });

  page.on("dialog", async (dialog) => dialog.accept());

  await login(page);
  await createClientAndWork(page);
  await openReportEditor(page);
  await fillReportBasics(page);
  await attachPhotos(page);

  await page.locator('[data-ai-image-target="fotoInconformidade01"]').click();
  await expect(page.locator("#aiSuggestionPanel")).toBeVisible();
  await expect(page.locator('[data-ai-apply-structured="true"]')).toBeVisible();
  await page.locator('[data-ai-apply-structured="true"]').click();

  await expect(page.locator("[name='descricaoInconformidade01']")).toHaveValue(/umidade|infiltracao|parede interna/i);
  await expect(page.locator("[name='solucaoInconformidade01']")).toHaveValue(/vistoria complementar|hidraulicas|umidade/i);
  await expect(page.locator("[name='grauRisco01']")).toHaveValue(/Medio|M[e�]dio/i);
  await expect(page.locator("[name='observacoes']")).toHaveValue(/Evidencias visuais|Possiveis inconformidades|Grau preliminar/i);

  await page.locator("[name='descricaoInconformidade01']").fill("Texto revisado manualmente: ha indicios de umidade em parede interna, com confirmacao pendente em vistoria complementar.");
  await expect(page.locator("[name='descricaoInconformidade01']")).toHaveValue(/Texto revisado manualmente/);

  await page.locator('[data-step-target="revisao"]').click();
  await page.locator("[name='conclusaoTecnica']").fill("Relatorio emitido para conferencia E2E do fluxo foto, IA, campos e PDF.");
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });
  await page.locator('[data-step-target="gerar"]').click();
  await page.locator("[name='emailDestino']").fill("destino.e2e@obrareport.local");
  await page.locator("#submitButton").click();
  await expect(page.locator("#generationStatus")).toContainText(/Relat.rio gerado com sucesso/i);
  await expect.poll(() => submittedPayload).not.toBeNull();

  expect(submittedPayload.fotosUnidade).toHaveLength(2);
  expect(submittedPayload.inconformidades).toHaveLength(1);
  expect(submittedPayload.inconformidades[0].descricaoTecnica).toMatch(/Texto revisado manualmente/);
  expect(submittedPayload.inconformidades[0].solucaoRecomendada).toMatch(/vistoria complementar/i);
  expect(submittedPayload.inconformidades[0].grauRisco).toMatch(/Medio|M[e�]dio/i);
  expect(submittedPayload.report.observacoes).toMatch(/Possiveis inconformidades|Grau preliminar/i);

  await writePdfFromPayload(browser, submittedPayload);
});
test("Elo com imagem gera payload ObraReport e mostra link PDF clicavel", async ({ page }) => {
  const submittedPayloads = [];
  const pdfUrl = "https://drive.google.com/file/d/pdf-e2e-elo/view";
  const consoleErrors = [];
  const pdfRequests = [
    "fa\u00e7a o relat\u00f3rio em PDF desta imagem pelo ObraReport",
    "fa\u00e7a um relat\u00f3rio em PDF desta foto",
    "gere o PDF desta imagem",
    "crie um relat\u00f3rio t\u00e9cnico em PDF com esta foto",
    "quero o relat\u00f3rio PDF da imagem",
    "fa\u00e7a o laudo em PDF desta foto",
    "gere o relat\u00f3rio pelo ObraReport",
    "fa\u00e7a um relat\u00f3rio desta imagem e gere o PDF"
  ];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);

  await page.route("**/api/elo/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [], memories: [] }) });
  });

  await page.route("**/api/ai/analyze-image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "mock-e2e",
        suggestion: MOCK_SUGGESTION,
        analysis: Object.assign({}, MOCK_ANALYSIS, {
          descricaoTecnica: MOCK_ANALYSIS.textoRelatorio,
          recomendacaoAcao: MOCK_ANALYSIS.recomendacaoAcao,
          grauPreliminar: MOCK_ANALYSIS.grauPreliminar,
          textoRelatorio: MOCK_ANALYSIS.textoRelatorio
        })
      })
    });
  });

  await page.route("https://script.google.com/**", async (route) => {
    const text = route.request().postData() || "{}";
    const parsed = JSON.parse(text);
    if (parsed && parsed.tipoRelatorio === "fiscalizacao") {
      submittedPayloads.push(parsed);
    }
    await route.fulfill({
      status: 200,
      contentType: "text/plain;charset=utf-8",
      body: JSON.stringify({ ok: true, requestId: "elo-e2e-request", pdfFileId: "pdf-e2e-elo", pdfUrl, imageFolderUrl: "https://drive.google.com/drive/folders/image-e2e-elo" })
    });
  });

  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-access-gate")).toBeHidden();
  await expect(page.locator(".elo-input-row")).toBeVisible();

  for (const [index, requestText] of pdfRequests.entries()) {
    await page.locator(".elo-attachment-input").setInputFiles(imagePayload(`elo-umidade-parede-${index + 1}.png`));
    await expect(page.locator("[data-elo-attachment-name]")).toContainText(`elo-umidade-parede-${index + 1}.png`);
    await page.locator(".elo-input").fill(requestText);
    await page.locator(".elo-send-button").click();

    await expect(page.locator(".elo-message.assistant").last()).toContainText("PDF real gerado pelo ObraReport", { timeout: 30000 });
    await expect(page.locator(".elo-message.assistant").last()).toContainText(pdfUrl);
    const pdfLink = page.locator(".elo-message.assistant a", { hasText: "Abrir / baixar PDF" }).last();
    await expect(pdfLink).toBeVisible();
    await expect(pdfLink).toHaveAttribute("href", pdfUrl);
    await expect.poll(() => submittedPayloads.length).toBe(index + 1);

    const submittedPayload = submittedPayloads[index];
    expect(submittedPayload.report.obra).toBe("Relatorio gerado pelo Elo");
    expect(submittedPayload.fotosUnidade).toHaveLength(1);
    expect(submittedPayload.inconformidades).toHaveLength(1);
    expect(submittedPayload.fotosUnidade[0].foto.fileName).toMatch(/elo-umidade-parede/i);
    expect(submittedPayload.inconformidades[0].descricaoTecnica).toMatch(/umidade|infiltracao|parede/i);
  }

  expect(page.locator(".elo-message.assistant").last()).not.toContainText(/Texto identificado/i);
  expect(consoleErrors.filter((item) => !/favicon|Failed to load resource/i.test(item))).toEqual([]);
});

test("Elo com imagem preserva analise visual e OCR fora do PDF", async ({ page }) => {
  let appsScriptCalls = 0;
  const visualRequests = [
    "analise esta imagem",
    "descreva esta foto",
    "o que aparece nesta imagem?",
    "identifique a possivel manifestacao",
    "avalie esta parede"
  ];
  const ocrRequests = [
    "transcreva o texto desta imagem",
    "leia o que esta escrito",
    "quero somente o texto da foto"
  ];

  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);

  await page.route("**/api/elo/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [], memories: [] }) });
  });

  await page.route("**/api/ai/analyze-image", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "mock-e2e",
        suggestion: MOCK_SUGGESTION,
        text: "Texto OCR mockado",
        analysis: MOCK_ANALYSIS
      })
    });
  });

  await page.route("https://script.google.com/**", async (route) => {
    appsScriptCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "text/plain;charset=utf-8",
      body: JSON.stringify({ ok: true, pdfUrl: "https://drive.google.com/file/d/unexpected/view" })
    });
  });

  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-access-gate")).toBeHidden();
  await expect(page.locator(".elo-input-row")).toBeVisible();

  for (const [index, requestText] of visualRequests.entries()) {
    await page.locator(".elo-attachment-input").setInputFiles(imagePayload(`elo-visual-${index + 1}.png`));
    await page.locator(".elo-input").fill(requestText);
    await page.locator(".elo-send-button").click();
    await expect(page.locator(".elo-message.assistant").last()).toContainText(/An.lise visual/i, { timeout: 30000 });
    await expect(page.locator(".elo-message.assistant").last()).not.toContainText("PDF real gerado pelo ObraReport");
  }

  for (const [index, requestText] of ocrRequests.entries()) {
    await page.locator(".elo-attachment-input").setInputFiles(imagePayload(`elo-ocr-${index + 1}.png`));
    await page.locator(".elo-input").fill(requestText);
    await page.locator(".elo-send-button").click();
    await expect(page.locator(".elo-message.assistant").last()).toContainText("Texto identificado", { timeout: 30000 });
    await expect(page.locator(".elo-message.assistant").last()).not.toContainText("PDF real gerado pelo ObraReport");
  }

  expect(appsScriptCalls).toBe(0);
});