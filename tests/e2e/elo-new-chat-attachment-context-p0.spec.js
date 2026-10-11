import { expect, test } from "@playwright/test";

const OLD_CONVERSATION_ID = "conv-attachment-old";
const OLD_USER_MESSAGE = "mensagem antiga sintética";
const OLD_ASSISTANT_MESSAGE = "resposta antiga sintética";

function createJwt(payload = {}) {
  function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(payload) + ".sig";
}

function validToken() {
  return createJwt({
    iss: "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1",
    sub: "user-attachment-p0",
    exp: Math.floor(Date.now() / 1000) + 3600
  });
}

async function installSyntheticSession(page) {
  await page.addInitScript((savedToken) => {
    window.ELO_SUPABASE_URL = "https://mplpzyalcxhhinuvjthx.supabase.co";
    window.ELO_SUPABASE_ANON_KEY = "anon-key";
    const payload = JSON.stringify({ currentSession: { access_token: savedToken }, access_token: savedToken });
    const authContext = JSON.stringify({
      userId: "user-attachment-p0",
      institutionId: "inst-attachment-p0",
      companyId: "company-attachment-p0",
      profile: {
        id: "user-attachment-p0",
        company_id: "company-attachment-p0",
        institution_id: "inst-attachment-p0",
        email: "attachment-p0@example.test"
      }
    });
    window.localStorage.setItem("sb-elo-core-auth-token", payload);
    window.sessionStorage.setItem("sb-elo-core-auth-token", payload);
    window.localStorage.setItem("elo_core_auth_context_v1", authContext);
    window.sessionStorage.setItem("elo_core_auth_context_v1", authContext);
    if (!window.sessionStorage.getItem("elo-attachment-p0-seeded")) {
      window.localStorage.setItem("elo_core_current_conversation_id_v1", "conv-attachment-old");
      window.localStorage.setItem("elo_core_current_conversation_id_v1::user_user-attachment-p0", "conv-attachment-old");
      window.sessionStorage.setItem("elo-attachment-p0-seeded", "true");
    }

    let validated = false;
    Object.defineProperty(window, "ELO_AUTH_SESSION_VALIDATED", {
      configurable: true,
      get: () => validated,
      set: (value) => { if (value === true) validated = true; }
    });
  }, validToken());
}

async function installSyntheticRoutes(page) {
  const state = { requests: [], chatBodies: [], oldConversationLoads: 0 };
  await page.route("https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1/user", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-attachment-p0", email: "attachment-p0@example.test" }) });
  });
  await page.route("**/api/elo/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    state.requests.push({ method, path });

    if (path === "/api/elo/identity/merge") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true,
        authContext: { userId: "user-attachment-p0", institutionId: "inst-attachment-p0", companyId: "company-attachment-p0", profile: { id: "user-attachment-p0", company_id: "company-attachment-p0", institution_id: "inst-attachment-p0", email: "attachment-p0@example.test" } }
      }) });
    }
    if (path.startsWith("/api/elo/memories")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, memories: [] }) });
    }
    if (path === "/api/elo/conversations" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true,
        conversations: [{ id: OLD_CONVERSATION_ID, title: "Conversa sintética anterior", summary: "Histórico sintético preservado", updated_at: new Date().toISOString() }]
      }) });
    }
    if (path === "/api/elo/conversations" && method === "POST") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id: "conv-attachment-new" }, conversations: [] }) });
    }
    if (path === "/api/elo/conversations/" + OLD_CONVERSATION_ID && method === "GET") {
      state.oldConversationLoads += 1;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true,
        conversation: { id: OLD_CONVERSATION_ID },
        messages: [{ role: "user", content: OLD_USER_MESSAGE }, { role: "assistant", content: OLD_ASSISTANT_MESSAGE }]
      }) });
    }
    if (path === "/api/elo/chat" && method === "POST") {
      const body = request.postDataJSON();
      state.chatBodies.push(body);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, answer: "Resposta geral sintética, sem usar documento anterior." }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, messages: [] }) });
  });
  return state;
}

async function openSyntheticConversation(page) {
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.EloAssistente && document.querySelector(".elo-attachment-input"));
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true && document.body.classList.contains("elo-authenticated"));
  await page.waitForFunction(() => document.querySelector("[data-elo-new-chat]")?.dataset.eloCoreBound === "true");
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".elo-message-bubble")).some((message) => message.textContent.includes("mensagem antiga sintética")));
}

async function seedPdfA(page) {
  await page.locator(".elo-attachment-input").setInputFiles({
    name: "PDF-A.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSYNTHETIC PDF A\n%%EOF")
  });
  await expect(page.locator("[data-elo-attachment-name]")).toHaveText("PDF-A.pdf");
  await page.evaluate(() => window.EloAssistente.rememberActiveDocumentForTest([
    { fileName: "PDF-A.pdf", text: "CONTEUDO_SINTETICO_EXCLUSIVO_PDF_A", documentId: "synthetic-doc-a" }
  ]));
}

async function clickNewChat(page) {
  await page.locator("[data-elo-new-chat]").click();
  await expect(page.locator(".elo-messages .elo-message")).toHaveCount(0);
}

test("Novo chat remove PDF ativo, preview, FileList e contexto parseado", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);

  const authBeforeNewChat = await page.evaluate(() => ({
    localToken: window.localStorage.getItem("sb-elo-core-auth-token"),
    sessionToken: window.sessionStorage.getItem("sb-elo-core-auth-token"),
    authContext: window.localStorage.getItem("elo_core_auth_context_v1")
  }));
  await expect(page.locator("[data-elo-attachment-preview]")).toBeVisible();
  expect(await page.locator(".elo-attachment-input").evaluate((input) => input.files.length)).toBe(1);
  await clickNewChat(page);

  const state = await page.evaluate(() => {
    const input = document.querySelector(".elo-attachment-input");
    const preview = document.querySelector("[data-elo-attachment-preview]");
    const payload = { message: "resuma isso", context: {} };
    const reused = window.EloAssistente.applyAttachmentContextToPayloadForTest(payload, payload.message);
    return {
      currentConversationId: window.EloAssistente.getCurrentConversationIdForTest(),
      fileCount: input.files.length,
      inputValue: input.value,
      previewVisible: preview.classList.contains("is-visible"),
      fileName: document.querySelector("[data-elo-attachment-name]").textContent,
      activeAttachment: window.EloAssistente.getActiveAttachmentForTest(),
      activeDocument: window.EloAssistente.getActiveDocumentForTest(),
      reused,
      payloadContext: payload.context,
      localToken: window.localStorage.getItem("sb-elo-core-auth-token"),
      sessionToken: window.sessionStorage.getItem("sb-elo-core-auth-token"),
      authContext: window.localStorage.getItem("elo_core_auth_context_v1")
    };
  });
  expect(state).toMatchObject({ currentConversationId: "", fileCount: 0, inputValue: "", previewVisible: false, fileName: "", activeAttachment: null, activeDocument: null, reused: false, payloadContext: {} });
  expect({ localToken: state.localToken, sessionToken: state.sessionToken, authContext: state.authContext }).toEqual(authBeforeNewChat);
});

test("PDF A não entra em pergunta de novo chat 'resuma isso'", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);
  await clickNewChat(page);

  const chatRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/elo/chat" && request.method() === "POST");
  await page.locator(".elo-input").fill("resuma isso");
  await page.locator(".elo-input-row").evaluate((form) => form.requestSubmit());
  await chatRequest;

  await expect.poll(() => routes.chatBodies.length, { timeout: 10000 }).toBe(1);
  expect(routes.chatBodies).toHaveLength(1);
  const body = routes.chatBodies[0];
  const serialized = JSON.stringify(body);
  expect(body.message).toBe("resuma isso");
  expect(body.context.activeDocumentReused).not.toBe(true);
  expect(body.context.documentsSummary).toBeUndefined();
  expect(serialized).not.toContain("PDF-A.pdf");
  expect(serialized).not.toContain("CONTEUDO_SINTETICO_EXCLUSIVO_PDF_A");
  expect(serialized).not.toContain("synthetic-doc-a");
});

test("Novo chat remove imagem e análise visual ativos", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await page.locator(".elo-attachment-input").setInputFiles({
    name: "imagem-A.png",
    mimeType: "image/png",
    buffer: Buffer.from("synthetic-image-A")
  });
  const seededAnalysis = await page.evaluate(() => {
    const attachment = window.EloAssistente.beginImageAttachmentForTest({ name: "imagem-A.png", type: "image/png" });
    const analysis = window.EloAssistente.rememberActiveAnalysisForTest(
      "Analise a imagem da obra",
      { sessionIntent: "document_analysis" },
      "A imagem sintética da obra mostra uma fissura.",
      attachment.id
    );
    return { attachment, analysis };
  });
  expect(seededAnalysis.attachment.id).toBeTruthy();
  expect(seededAnalysis.analysis).toBeTruthy();
  await expect(page.locator("[data-elo-attachment-preview]")).toBeVisible();

  await clickNewChat(page);
  const state = await page.evaluate(() => {
    const payload = { message: "fale dessa imagem", context: {} };
    const reused = window.EloAssistente.applyAttachmentContextToPayloadForTest(payload, payload.message);
    return {
      fileCount: document.querySelector(".elo-attachment-input").files.length,
      activeAttachment: window.EloAssistente.getActiveAttachmentForTest(),
      previewVisible: document.querySelector("[data-elo-attachment-preview]").classList.contains("is-visible"),
      analysis: window.EloAssistente.getActiveAnalysisForTest(),
      reused,
      imageAnalysisContext: payload.context.imageAnalysisContext
    };
  });
  expect(state).toMatchObject({ fileCount: 0, activeAttachment: null, previewVisible: false, analysis: null, reused: false, imageAnalysisContext: undefined });
});

test("PDF B após Novo chat substitui PDF A sem reaproveitar seu conteúdo", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);
  await clickNewChat(page);

  await page.locator(".elo-attachment-input").setInputFiles({
    name: "PDF-B.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSYNTHETIC PDF B\n%%EOF")
  });
  await page.evaluate(() => window.EloAssistente.rememberActiveDocumentForTest([
    { fileName: "PDF-B.pdf", text: "CONTEUDO_SINTETICO_EXCLUSIVO_PDF_B", documentId: "synthetic-doc-b" }
  ]));

  const state = await page.evaluate(() => {
    const input = document.querySelector(".elo-attachment-input");
    const payload = { message: "resuma isso", context: {} };
    const applied = window.EloAssistente.applyAttachmentContextToPayloadForTest(payload, payload.message);
    return {
      fileCount: input.files.length,
      selectedFile: input.files[0] && input.files[0].name,
      previewName: document.querySelector("[data-elo-attachment-name]").textContent,
      activeAttachment: window.EloAssistente.getActiveAttachmentForTest(),
      applied,
      activeDocumentId: payload.context.activeDocumentId,
      summary: payload.context.documentsSummary
    };
  });
  expect(state).toMatchObject({ fileCount: 1, selectedFile: "PDF-B.pdf", previewName: "PDF-B.pdf", activeAttachment: { type: "pdf", fileName: "PDF-B.pdf", documentId: "synthetic-doc-b" }, applied: true, activeDocumentId: "synthetic-doc-b" });
  expect(state.summary).toContain("CONTEUDO_SINTETICO_EXCLUSIVO_PDF_B");
  expect(state.summary).not.toContain("CONTEUDO_SINTETICO_EXCLUSIVO_PDF_A");
});

test("Novo chat preserva a conversa antiga e ela continua abrindo pelo histórico", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);
  await clickNewChat(page);
  await expect(page.locator(".elo-messages .elo-message")).toHaveCount(0);
  expect(routes.requests.some((request) => request.method === "DELETE" && request.path.includes(OLD_CONVERSATION_ID))).toBe(false);

  await page.evaluate(() => window.EloAssistente.showCoreHistoryForTest());
  const oldConversation = page.locator(".elo-history-item").filter({ hasText: "Conversa sintética anterior" });
  await expect(oldConversation).toBeVisible();
  await oldConversation.getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".elo-message-bubble").filter({ hasText: OLD_USER_MESSAGE })).toBeVisible();
  await expect(page.locator(".elo-message-bubble").filter({ hasText: OLD_ASSISTANT_MESSAGE })).toBeVisible();
  expect(routes.oldConversationLoads).toBeGreaterThanOrEqual(2);
});

test("reload após Novo chat não ressuscita o anexo da conversa encerrada", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);
  await clickNewChat(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.EloAssistente && document.querySelector(".elo-attachment-input"), { timeout: 20000 });
  await expect(page.locator("[data-elo-attachment-preview]")).toBeHidden();

  const state = await page.evaluate(() => ({
    currentConversationId: window.EloAssistente.getCurrentConversationIdForTest(),
    fileCount: document.querySelector(".elo-attachment-input").files.length,
    fileName: document.querySelector("[data-elo-attachment-name]").textContent,
    activeAttachment: window.EloAssistente.getActiveAttachmentForTest(),
    activeDocument: window.EloAssistente.getActiveDocumentForTest(),
    activeAnalysis: window.EloAssistente.getActiveAnalysisForTest()
  }));
  expect(state).toMatchObject({ currentConversationId: "", fileCount: 0, fileName: "", activeAttachment: null, activeDocument: null, activeAnalysis: null });
});
