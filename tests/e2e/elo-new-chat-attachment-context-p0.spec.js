import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

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
    window.__ELO_TEST_SPEECH_SYNTHESIS_CALLS = 0;
    try {
      const synthesis = window.speechSynthesis;
      if (synthesis) {
        Object.defineProperty(synthesis, "speak", {
          configurable: true,
          value: () => { window.__ELO_TEST_SPEECH_SYNTHESIS_CALLS += 1; }
        });
      }
    } catch (_) {}
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

async function submitChatMessage(page, message) {
  await page.locator(".elo-input").fill(message);
  await page.locator(".elo-input-row").evaluate((form) => form.requestSubmit());
}

async function readNewAssistantReply(page, previousReplyCount) {
  const replies = page.locator(".elo-message.assistant .elo-message-bubble");
  await expect(replies).toHaveCount(previousReplyCount + 1);
  const reply = replies.nth(previousReplyCount);
  await expect(reply).not.toHaveText(/pensando/i);
  return (await reply.innerText()).trim();
}

const HUMOR_CONTENT = /r[eé]gua|somaram\s+7|escala|ideia\s+nova|abas|maquete/i;

test("chat real entrega uma piada completa pelo fast-path", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const replies = page.locator(".elo-message.assistant .elo-message-bubble");
  const previousReplyCount = await replies.count();
  const userInput = "me conte uma piada";
  await submitChatMessage(page, userInput);
  const finalChatOutput = await readNewAssistantReply(page, previousReplyCount);

  expect(finalChatOutput).not.toBe("Claro.");
  expect(finalChatOutput).toMatch(HUMOR_CONTENT);
  expect(routes.chatBodies).toHaveLength(0);
});

test("chat real entrega outra piada completa no follow-up", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  let previousReplyCount = await page.locator(".elo-message.assistant .elo-message-bubble").count();
  await submitChatMessage(page, "me conte uma piada");
  const firstReply = await readNewAssistantReply(page, previousReplyCount);

  previousReplyCount += 1;
  await submitChatMessage(page, "me conte outra");
  const secondReply = await readNewAssistantReply(page, previousReplyCount);

  expect(firstReply).toMatch(HUMOR_CONTENT);
  expect(secondReply).not.toBe("Claro.");
  expect(secondReply).toMatch(HUMOR_CONTENT);
  expect(secondReply).not.toBe(firstReply);
  expect(routes.chatBodies).toHaveLength(0);
});

test("chat real não deixa saudação interceptar um pedido de piada", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const previousReplyCount = await page.locator(".elo-message.assistant .elo-message-bubble").count();
  await submitChatMessage(page, "bom dia, me conte uma piada");
  const finalChatOutput = await readNewAssistantReply(page, previousReplyCount);

  expect(finalChatOutput).toMatch(HUMOR_CONTENT);
  expect(routes.chatBodies).toHaveLength(0);
});

test("pedido técnico sério permanece fora do fluxo de humor", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const previousReplyCount = await page.locator(".elo-message.assistant .elo-message-bubble").count();
  await submitChatMessage(page, "Explique como dimensionar uma viga de concreto armado.");
  const finalChatOutput = await readNewAssistantReply(page, previousReplyCount);

  expect(routes.chatBodies.length).toBeLessThanOrEqual(1);
  expect(finalChatOutput).not.toBe("Claro.");
  expect(finalChatOutput).not.toMatch(HUMOR_CONTENT);
});

test("composer preserva 32.891 caracteres no DOM e no payload enviado", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const longMessage = "Registro tecnico da obra, lote 07; ".repeat(1000).slice(0, 32891).trimEnd().padEnd(32891, "x");
  const composer = page.locator(".elo-input");
  await composer.fill(longMessage);

  const domState = await composer.evaluate((input) => ({ valueLength: input.value.length, maxLength: input.maxLength }));
  expect(domState).toEqual({ valueLength: 32891, maxLength: -1 });

  const chatRequest = page.waitForRequest((request) => new URL(request.url()).pathname === "/api/elo/chat" && request.method() === "POST");
  await page.locator(".elo-input-row").evaluate((form) => form.requestSubmit());
  await chatRequest;
  await expect.poll(() => routes.chatBodies.length, { timeout: 10000 }).toBe(1);
  expect(routes.chatBodies[0].message.length).toBe(32891);
  expect(routes.chatBodies[0].message).toBe(longMessage);
});

test("conversa longa mantém rolagem, composer e posição de leitura em 300, 500 e 1.000 mensagens", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const messages = page.locator(".elo-messages");
  const composer = page.locator(".elo-input-row");
  const returnButton = page.locator("[data-elo-scroll-bottom]");

  for (const count of [300, 500, 1000]) {
    await messages.evaluate((container, total) => {
      container.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let index = 0; index < total; index += 1) {
        const message = document.createElement("div");
        message.className = "elo-message " + (index % 2 === 0 ? "user" : "assistant");
        const bubble = document.createElement("div");
        bubble.className = "elo-message-bubble";
        bubble.textContent = `Mensagem ${index + 1}: contexto longo de teste para medir a rolagem contínua sem remover mensagens anteriores. ` + "conteúdo adicional ".repeat(index % 5);
        if (total === 1000 && index === total - 1) {
          const image = document.createElement("img");
          image.alt = "Imagem anexada de teste";
          image.width = 480;
          image.height = 320;
          image.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320'%3E%3Crect width='480' height='320' fill='%23dce8f5'/%3E%3C/svg%3E";
          bubble.appendChild(image);
          const pdf = document.createElement("a");
          pdf.href = "data:application/pdf,%25PDF-1.4%0A%25synthetic";
          pdf.textContent = "PDF anexado de teste";
          pdf.setAttribute("data-elo-test-pdf", "true");
          bubble.appendChild(pdf);
        }
        message.appendChild(bubble);
        fragment.appendChild(message);
      }
      container.appendChild(fragment);
    }, count);

    const initial = await messages.evaluate((container) => ({
      count: container.querySelectorAll(".elo-message").length,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight
    }));
    expect(initial.count).toBe(count);
    expect(initial.scrollHeight).toBeGreaterThan(initial.clientHeight * 2);

    await messages.evaluate((container) => { container.scrollTop = 0; container.dispatchEvent(new Event("scroll")); });
    await expect(returnButton).toBeVisible();
    const beforeTyping = await messages.evaluate((container) => container.scrollTop);
    const composerHeightBeforeTyping = await composer.evaluate((row) => row.getBoundingClientRect().height);
    const longDraft = ("rascunho longo enquanto leio o histórico. ").repeat(300);
    await page.locator(".elo-input").fill(longDraft);
    await page.waitForTimeout(1000);
    const afterTyping = await messages.evaluate((container) => container.scrollTop);
    const composerHeightAfterTyping = await composer.evaluate((row) => row.getBoundingClientRect().height);
    expect(Math.abs(afterTyping - beforeTyping)).toBeLessThanOrEqual(1);
    expect(composerHeightAfterTyping).toBeGreaterThan(composerHeightBeforeTyping);
    await page.locator(".elo-input").fill("");
    await page.waitForTimeout(1000);
    const afterClearingDraft = await messages.evaluate((container) => container.scrollTop);
    expect(Math.abs(afterClearingDraft - beforeTyping)).toBeLessThanOrEqual(1);

    const layout = await page.evaluate(() => {
      const row = document.querySelector(".elo-input-row").getBoundingClientRect();
      return { composerTop: row.top, composerBottom: row.bottom, viewportHeight: window.innerHeight };
    });
    expect(layout.composerTop).toBeGreaterThanOrEqual(0);
    expect(layout.composerBottom).toBeLessThanOrEqual(layout.viewportHeight + 1);

    if (count === 1000) {
      expect(await messages.locator("img[alt='Imagem anexada de teste']").count()).toBe(1);
      expect(await messages.locator("[data-elo-test-pdf]").count()).toBe(1);
      const userCount = await messages.locator(".elo-message.user").count();
      const assistantCount = await messages.locator(".elo-message.assistant").count();
      await page.locator(".elo-input").fill("Oi");
      await page.locator(".elo-input-row").evaluate((form) => form.requestSubmit());
      await expect(messages.locator(".elo-message.user")).toHaveCount(userCount + 1);
      await expect(messages.locator(".elo-message.assistant")).toHaveCount(assistantCount + 1);
      expect(Math.abs(await messages.evaluate((container) => container.scrollTop))).toBeLessThanOrEqual(1);
    }

    await returnButton.click();
    await expect.poll(() => messages.evaluate((container) => Math.abs(container.scrollHeight - container.clientHeight - container.scrollTop))).toBeLessThanOrEqual(2);
    expect(await messages.locator(".elo-message").count()).toBe(count + (count === 1000 ? 2 : 0));
  }
});

test("histórico online usa somente a conversa ativa, sem reaproveitar memória de outro chat", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  await page.evaluate(() => window.EloAssistente.saveConversationForTest(
    "FATO_PRIVADO_DE_OUTRA_CONVERSA",
    "RESPOSTA_PRIVADA_DE_OUTRA_CONVERSA"
  ));
  const currentHistory = await page.evaluate(() => window.EloAssistente.getOnlineHistoryForTest("pergunta atual"));
  expect(currentHistory.some((item) => item.content.includes("mensagem antiga sintética"))).toBe(true);
  expect(currentHistory.some((item) => item.content.includes("FATO_PRIVADO_DE_OUTRA_CONVERSA"))).toBe(false);
  await page.evaluate(() => window.EloAssistente.rememberSessionTurnForTest("Minha lista", {}, "1. Jiboia\n2. Samambaia"));
  expect((await page.evaluate(() => window.EloAssistente.getWorkingMemoryForTest())).activeEntities.length).toBeGreaterThan(0);

  await clickNewChat(page);
  const newConversationHistory = await page.evaluate(() => window.EloAssistente.getOnlineHistoryForTest("nova conversa"));
  const newConversationWorkingMemory = await page.evaluate(() => window.EloAssistente.getWorkingMemoryForTest());
  expect(newConversationHistory).toEqual([]);
  expect(JSON.stringify(newConversationHistory)).not.toContain("FATO_PRIVADO_DE_OUTRA_CONVERSA");
  expect(newConversationWorkingMemory.activeEntities).toEqual([]);
  expect(newConversationWorkingMemory.lastEnumeratedItems).toEqual([]);
  expect(newConversationWorkingMemory.lastReferenceSet).toEqual([]);
  expect(newConversationWorkingMemory.detailLevel).toBe(0);
});

test("histórico acima de 48 mensagens arquiva fatos da conversa atual sem vazar para Novo chat", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  const fact = `Meu pássaro se chama ${randomUUID()} e o passeio é às 6h30.`;
  await page.locator(".elo-messages").evaluate((container, openingFact) => {
    container.replaceChildren();
    for (let index = 0; index < 60; index += 1) {
      const message = document.createElement("div");
      message.className = "elo-message " + (index % 2 === 0 ? "user" : "assistant");
      const bubble = document.createElement("div");
      bubble.className = "elo-message-bubble";
      bubble.textContent = index === 0 ? openingFact : `Conversa variada ${index + 1}.`;
      message.appendChild(bubble);
      container.appendChild(message);
    }
  }, fact);
  await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("Qual o nome do meu pássaro e o horário do passeio?", [], {}));
  const payload = routes.chatBodies[0];
  expect(payload.history).toHaveLength(48);
  expect(JSON.stringify(payload.history)).not.toContain(fact);
  expect(payload.context.conversationArchive.conversationId).toBe(payload.context.currentConversationId);
  expect(payload.context.conversationArchive.messages.length).toBeLessThanOrEqual(12);
  expect(JSON.stringify(payload.context.conversationArchive.messages)).toContain(fact);

  await clickNewChat(page);
  await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("O que você sabe sobre meu pássaro?", [], {}));
  expect(routes.chatBodies[1].context.conversationArchive).toBeNull();
  expect(JSON.stringify(routes.chatBodies[1])).not.toContain(fact);
});

test("sessão autenticada não envia memória local sem escopo de usuário", async ({ page }) => {
  await installSyntheticSession(page);
  const routes = await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await page.evaluate(() => {
    window.localStorage.setItem("elo_device_id_v1", "device-global-shared");
    window.localStorage.setItem("elo_long_term_memory_v1", JSON.stringify([
      { id: "legacy-memory-a", text: "FATO_PRIVADO_DE_OUTRO_USUARIO", category: "pessoa", importance: "alta", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    ]));
  });

  await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("Qual é uma forma simples de organizar ideias?", [], {}));
  await expect.poll(() => routes.chatBodies.length, { timeout: 10000 }).toBe(1);
  const context = routes.chatBodies[0].context;
  expect(context.memoriesSummary).toBe("");
  expect(context.deviceId).not.toBe("device-global-shared");
  expect(context.deviceId).toMatch(/^elo_dev_user_/);
  expect(JSON.stringify(routes.chatBodies[0])).not.toContain("FATO_PRIVADO_DE_OUTRO_USUARIO");
  expect(routes.requests.filter((request) => request.path === "/api/elo/vector-memory" && request.method === "POST")).toHaveLength(0);
});

test("replay do histórico mantém a posição de leitura salva", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);

  const history = [];
  for (let index = 0; index < 300; index += 1) {
    history.push({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Mensagem histórica ${index + 1}: contexto preservado durante o replay. ` + "continuidade da conversa ".repeat(2)
    });
  }
  const messages = page.locator(".elo-messages");
  const targetScrollTop = 720;
  await page.evaluate(({ historyMessages, scrollTop }) => {
    window.EloAssistente.replayCoreMessagesForTest(historyMessages, scrollTop);
  }, { historyMessages: history, scrollTop: targetScrollTop });
  await expect(messages.locator(".elo-message")).toHaveCount(300);
  await expect.poll(() => messages.evaluate((container) => container.scrollTop)).toBe(targetScrollTop);
  await expect(page.locator(".elo-input-row")).toBeInViewport();
});

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
  await expect.poll(() => page.evaluate(() => window.EloAssistente.getActiveDocumentForTest()?.documents?.[0]?.text || "")).toContain("CONTEUDO_SINTETICO_EXCLUSIVO_PDF_A");
  await clickNewChat(page);
  await expect.poll(() => page.evaluate(() => window.EloAssistente.getActiveDocumentForTest())).toBeNull();

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

test("Novo chat isola PDF e imagem ao alternar os tipos de anexo", async ({ page }) => {
  await installSyntheticSession(page);
  await installSyntheticRoutes(page);
  await openSyntheticConversation(page);
  await seedPdfA(page);
  await clickNewChat(page);

  await page.locator(".elo-attachment-input").setInputFiles({
    name: "imagem-A.png",
    mimeType: "image/png",
    buffer: Buffer.from("synthetic-image-A")
  });
  await page.evaluate(() => {
    const attachment = window.EloAssistente.beginImageAttachmentForTest({ name: "imagem-A.png", type: "image/png" });
    window.EloAssistente.rememberActiveAnalysisForTest(
      "Analise a imagem da obra",
      { sessionIntent: "document_analysis" },
      "ANALISE_SINTETICA_EXCLUSIVA_IMAGEM_A",
      attachment.id
    );
  });
  const imageState = await page.evaluate(() => {
    return {
      activeAnalysis: window.EloAssistente.getActiveAnalysisForTest(),
      activeDocument: window.EloAssistente.getActiveDocumentForTest(),
      activeAttachment: window.EloAssistente.getActiveAttachmentForTest()
    };
  });
  expect(imageState.activeAttachment).toMatchObject({ type: "image", fileName: "imagem-A.png" });
  expect(JSON.stringify(imageState.activeAnalysis)).toContain("ANALISE_SINTETICA_EXCLUSIVA_IMAGEM_A");
  expect(imageState.activeDocument).toBeNull();

  await clickNewChat(page);
  await expect.poll(() => page.evaluate(() => ({ analysis: window.EloAssistente.getActiveAnalysisForTest(), attachment: window.EloAssistente.getActiveAttachmentForTest() }))).toEqual({ analysis: null, attachment: null });
  await page.locator(".elo-attachment-input").setInputFiles({
    name: "PDF-B.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\nSYNTHETIC PDF B\n%%EOF")
  });
  await page.evaluate(() => window.EloAssistente.rememberActiveDocumentForTest([
    { fileName: "PDF-B.pdf", text: "CONTEUDO_SINTETICO_EXCLUSIVO_PDF_B", documentId: "synthetic-doc-b" }
  ]));
  const pdfState = await page.evaluate(() => {
    const payload = { message: "resuma isso", context: {} };
    const applied = window.EloAssistente.applyAttachmentContextToPayloadForTest(payload, payload.message);
    return { applied, payloadContext: payload.context, activeAttachment: window.EloAssistente.getActiveAttachmentForTest() };
  });
  expect(pdfState.applied).toBe(true);
  expect(pdfState.activeAttachment).toMatchObject({ type: "pdf", fileName: "PDF-B.pdf" });
  expect(JSON.stringify(pdfState.payloadContext)).toContain("CONTEUDO_SINTETICO_EXCLUSIVO_PDF_B");
  expect(JSON.stringify(pdfState.payloadContext)).not.toContain("ANALISE_SINTETICA_EXCLUSIVA_IMAGEM_A");
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
