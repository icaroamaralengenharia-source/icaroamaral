import { expect, test } from "@playwright/test";

function createJwt(payload = {}) {
  function encode(value) {
    return Buffer.from(JSON.stringify(value)).toString("base64url");
  }
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(payload) + ".sig";
}

function validToken() {
  return createJwt({ iss: "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1", sub: "user-p0", exp: Math.floor(Date.now() / 1000) + 3600 });
}

async function installSession(page, token, conversationId = "") {
  await page.addInitScript(({ savedToken, savedConversationId }) => {
    window.ELO_SUPABASE_URL = "https://mplpzyalcxhhinuvjthx.supabase.co";
    window.ELO_SUPABASE_ANON_KEY = "anon-key";
    const payload = JSON.stringify({ currentSession: { access_token: savedToken }, access_token: savedToken });
    const authContext = JSON.stringify({ userId: "user-p0", institutionId: "inst-p0", companyId: "company-p0", profile: { id: "user-p0", company_id: "company-p0", institution_id: "inst-p0", email: "p0@example.test" } });
    window.localStorage.setItem("sb-elo-core-auth-token", payload);
    window.sessionStorage.setItem("sb-elo-core-auth-token", payload);
    window.localStorage.setItem("elo_core_auth_context_v1", authContext);
    window.sessionStorage.setItem("elo_core_auth_context_v1", authContext);
    if (savedConversationId) {
      window.localStorage.setItem("elo_core_current_conversation_id_v1", savedConversationId);
      window.localStorage.setItem("elo_core_current_conversation_id_v1::user_user-p0", savedConversationId);
    }
  }, { savedToken: token, savedConversationId: conversationId });
}

async function installAuthRoutes(page, options = {}) {
  const calls = [];
  const routeTarget = page.context ? page.context() : page;
  await routeTarget.route("https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1/user", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "user-p0", email: "p0@example.test" }) });
  });
  await routeTarget.route("**/api/elo/identity/merge", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, authContext: { userId: "user-p0", institutionId: "inst-p0", companyId: "company-p0", profile: { id: "user-p0", company_id: "company-p0", institution_id: "inst-p0", email: "p0@example.test" } } }) });
  });
  await routeTarget.route("**/api/elo/memories**", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: options.memoryStatus || 200, contentType: "application/json", body: JSON.stringify(options.memoryStatus ? { ok: false, error: "memory_down" } : { ok: true, memories: [] }) });
  });
  await routeTarget.route("**/api/elo/conversations/conv-p0/messages", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await routeTarget.route("**/api/elo/conversations/conv-p0**", async (route) => {
    calls.push(route.request().url());
    await new Promise((resolve) => setTimeout(resolve, options.conversationDelayMs || 0));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, messages: [{ role: "user", content: "mensagem antiga" }, { role: "assistant", content: "resposta antiga" }] }) });
  });
  await routeTarget.route("**/api/elo/conversations", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id: "conv-p0" }, conversations: [] }) });
  });
  return calls;
}

async function waitForElo(page) {
  await page.goto("/elo.html", { waitUntil: "commit", timeout: 10000 });
  await page.waitForFunction(() => window.EloAssistente);
}

test("ELO P0 reload preserva sessao autenticada via storage", async ({ page }) => {
  const token = validToken();
  await installSession(page, token);
  await installAuthRoutes(page);

  await waitForElo(page);
  let state = await page.evaluate(async () => {
    const result = await Promise.race([
      window.EloAssistente.initCorePersistenceForTest(),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000))
    ]);
    return {
      result,
      tokenPresent: !!window.ELO_AUTH_TOKEN,
      storedTokenPresent: !!window.localStorage.getItem("sb-elo-core-auth-token"),
      validated: window.ELO_AUTH_SESSION_VALIDATED,
      restoring: window.ELO_AUTH_SESSION_RESTORING,
      supabaseUrl: window.ELO_SUPABASE_URL,
      authFormVisible: !document.querySelector("[data-elo-auth-form]").hidden,
      authSessionVisible: !document.querySelector("[data-elo-auth-session]").hidden
    };
  });
  expect(state).toMatchObject({ result: true, tokenPresent: true, storedTokenPresent: true, validated: true, restoring: false, supabaseUrl: "https://mplpzyalcxhhinuvjthx.supabase.co", authFormVisible: false, authSessionVisible: true });
});

test("ELO P0 oi nao some quando restore antigo chega atrasado", async ({ page }) => {
  const token = validToken();
  const calls = await installAuthRoutes(page, { conversationDelayMs: 400 });
  await installSession(page, token, "conv-p0");
  await waitForElo(page);

  await page.evaluate(() => window.EloAssistente.ask("oi"));
  await page.waitForTimeout(15000);

  const transcript = await page.locator(".elo-message-bubble").allTextContents();
  const conversationId = await page.evaluate(() => window.EloAssistente.getCurrentConversationIdForTest());
  expect(transcript.join("\n")).toMatch(/oi|estou pronto/i);
  expect(transcript.join("\n")).not.toMatch(/mensagem antiga|resposta antiga/i);
  expect(conversationId).toBe("conv-p0");
});

test("ELO P0 data e hora respondem local sem chat, conversas ou tts", async ({ page }) => {
  let chatCalls = 0;
  let conversationCalls = 0;
  let ttsCalls = 0;
  await page.route("**/api/elo/chat", async (route) => { chatCalls += 1; await route.abort("failed"); });
  await page.route("**/api/elo/conversations**", async (route) => { conversationCalls += 1; await route.abort("failed"); });
  await page.route("**/api/elo/tts", async (route) => { ttsCalls += 1; await route.abort("failed"); });
  await waitForElo(page);

  const result = await page.evaluate(() => {
    ["QUE DIA É HOJE?", "que horas são?", "qual a data de hoje?", "hoje é que dia?"].forEach((question) => window.EloAssistente.ask(question));
    return Array.from(document.querySelectorAll(".elo-message-bubble")).map((item) => item.textContent || "");
  });

  expect(result.join("\n")).toMatch(/Hoje é|Hoje e|Agora são|Agora sao/i);
  expect(chatCalls).toBe(0);
  expect(conversationCalls).toBe(0);
  expect(ttsCalls).toBe(0);
});







