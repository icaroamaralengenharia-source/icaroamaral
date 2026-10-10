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

const newChatViewports = [
  { name: "desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1366x768", width: 1366, height: 768 },
  { name: "desktop-narrow-804x700", width: 804, height: 700 },
  { name: "tablet-boundary-768x900", width: 768, height: 900 },
  { name: "tablet-641x800", width: 641, height: 800 },
  { name: "mobile-412x915", width: 412, height: 915 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-360x800", width: 360, height: 800 }
];

test("ELO Novo chat acessivel, isolado e sem apagar historico em todos os viewports", async ({ page }, testInfo) => {
  const conversationRequests = [];
  page.on("request", (request) => {
    if (/\/api\/elo\/conversations(?:\/|$)/.test(new URL(request.url()).pathname)) {
      conversationRequests.push({ method: request.method(), url: request.url() });
    }
  });

  await page.setViewportSize({ width: newChatViewports[0].width, height: newChatViewports[0].height });
  await page.addInitScript(() => {
    // Keep the mocked authenticated session stable for this visual-only fixture.
    let validated = false;
    Object.defineProperty(window, "ELO_AUTH_SESSION_VALIDATED", {
      configurable: true,
      get: () => validated,
      set: (value) => { if (value === true) validated = true; }
    });
  });
  await installSession(page, validToken());
  await installAuthRoutes(page);
  await waitForElo(page);
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true && document.body.classList.contains("elo-authenticated"));

  for (const viewport of newChatViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.waitForFunction(() => {
      const button = document.querySelector("[data-elo-new-chat]");
      return !!(window.EloAssistente && button && button.dataset.eloCoreBound === "true");
    });
    await page.evaluate(() => {
      const api = window.EloAssistente;
      api.startNewConversationForLayoutTest();
      api.setCurrentConversationIdForTest("conv-p0");
      api.appendMessageForLayoutTest("user", "pergunta sintetica anterior");
      api.appendMessageForLayoutTest("assistant", "resposta sintetica anterior");
    });
    await expect(page.locator(".elo-messages .elo-message")).toHaveCount(2);

    const before = await page.evaluate(() => {
      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, width: box.width, height: box.height, display: style.display };
      };
      const header = rect(".elo-product-top");
      const actions = rect(".elo-core-actions");
      const messages = rect(".elo-messages");
      const firstMessage = rect(".elo-messages .elo-message");
      const newChat = document.querySelector("[data-elo-new-chat]");
      const newChatBox = newChat && newChat.getBoundingClientRect();
      const hit = newChatBox && document.elementFromPoint(newChatBox.x + newChatBox.width / 2, newChatBox.y + newChatBox.height / 2);
      return {
        header,
        actions,
        messages,
        firstMessage,
        mobileToggleDisplay: getComputedStyle(document.querySelector("[data-elo-mobile-menu-toggle]")).display,
        mobileMediaMatches: matchMedia("(max-width: 768px)").matches,
        sidebarDisplay: getComputedStyle(document.querySelector(".elo-desktop-sidebar")).display,
        desktopNewChatVisible: !!newChatBox && newChatBox.width > 0 && newChatBox.height > 0,
        desktopNewChatHit: !!hit && (hit === newChat || newChat.contains(hit))
      };
    });
    if (viewport.width >= 769) {
      expect(before.firstMessage.y).toBeGreaterThanOrEqual(before.header.bottom - 1);
    }
    if (viewport.width >= 769 && viewport.width <= 1100) {
      expect(before.actions.bottom).toBeLessThanOrEqual(before.header.bottom + 1);
    }
    if (viewport.width <= 768) {
      expect(before.mobileMediaMatches).toBe(true);
      expect(before.mobileToggleDisplay).not.toBe("none");
      expect(before.firstMessage.y).toBeGreaterThanOrEqual(before.header.bottom - 1);
    }

    const beforeScreenshot = await page.screenshot({ path: testInfo.outputPath(`${viewport.name}.png`), fullPage: false });
    await testInfo.attach(`${viewport.name}-before-new-chat`, {
      body: beforeScreenshot,
      contentType: "image/png"
    });

    if (viewport.width <= 768) {
      expect(before.sidebarDisplay).toBe("none");
      const menuToggle = page.locator("[data-elo-mobile-menu-toggle]");
      await expect(menuToggle).toBeVisible();
      await menuToggle.click();
      const newChatProxy = page.locator('[data-elo-mobile-menu-action="new-chat"]');
      await expect(newChatProxy).toBeVisible();
      const menuScreenshot = await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-menu.png`), fullPage: false });
      await testInfo.attach(`${viewport.name}-new-chat-control`, {
        body: menuScreenshot,
        contentType: "image/png"
      });
      await newChatProxy.click();
    } else {
      expect(before.sidebarDisplay).not.toBe("none");
      expect(before.desktopNewChatVisible).toBe(true);
      expect(before.desktopNewChatHit).toBe(true);
      await page.locator("[data-elo-new-chat]").click();
    }

    const afterNewChat = await page.evaluate(() => ({
      currentId: window.EloAssistente.getCurrentConversationIdForTest(),
      oldConversationCleared: window.EloAssistente.isConversationClearedForTest("conv-p0"),
      visibleMessages: document.querySelectorAll(".elo-messages .elo-message").length
    }));
    expect(afterNewChat).toEqual({ currentId: "", oldConversationCleared: false, visibleMessages: 0 });

    expect(conversationRequests.some((request) => request.method === "DELETE" && request.url.includes("/api/elo/conversations/conv-p0"))).toBe(false);

    const afterScreenshot = await page.screenshot({ path: testInfo.outputPath(`${viewport.name}-after-new-chat.png`), fullPage: false });
    await testInfo.attach(`${viewport.name}-new-chat`, {
      body: afterScreenshot,
      contentType: "image/png"
    });
  }
});







