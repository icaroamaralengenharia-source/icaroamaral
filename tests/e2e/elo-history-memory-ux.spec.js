import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

test.use({ serviceWorkers: "block" });

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "tablet-804", width: 804, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 }
];

const ARTIFACT_DIR = join(process.cwd(), "..", "qa-artifacts", "elo-history-memory-ux-20261011");
const CONVERSATIONS = [
  { id: "history-synthetic-a", title: "Conversa sintética A", summary: "Fixture de histórico A", updated_at: "2026-10-10T10:00:00.000Z" },
  { id: "history-synthetic-b", title: "Conversa sintética B", summary: "Fixture de histórico B", updated_at: "2026-10-10T11:00:00.000Z" }
];
const MESSAGES = {
  "history-synthetic-a": [
    { id: "message-a-user", role: "user", content: "PERGUNTA_FIXTURE_A" },
    { id: "message-a-assistant", role: "assistant", content: "RESPOSTA_FIXTURE_A_CONTEXT_A" }
  ],
  "history-synthetic-b": [
    { id: "message-b-user", role: "user", content: "PERGUNTA_FIXTURE_B" },
    { id: "message-b-assistant", role: "assistant", content: "RESPOSTA_FIXTURE_B_CONTEXT_B" }
  ]
};

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function syntheticToken() {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    iss: "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1",
    sub: "user-history-memory-ux",
    exp: Math.floor(Date.now() / 1000) + 3600
  })}.synthetic-signature`;
}

async function installSyntheticSession(page) {
  await page.addInitScript((token) => {
    window.ELO_SUPABASE_URL = "https://mplpzyalcxhhinuvjthx.supabase.co";
    window.ELO_SUPABASE_ANON_KEY = "synthetic-anon-key";
    const session = JSON.stringify({ currentSession: { access_token: token }, access_token: token });
    const authContext = JSON.stringify({
      userId: "user-history-memory-ux",
      institutionId: "inst-history-memory-ux",
      companyId: "company-history-memory-ux",
      profile: { id: "user-history-memory-ux", email: "history-memory-ux@example.test" }
    });
    window.localStorage.setItem("sb-elo-core-auth-token", session);
    window.sessionStorage.setItem("sb-elo-core-auth-token", session);
    window.localStorage.setItem("elo_core_auth_context_v1", authContext);
    window.sessionStorage.setItem("elo_core_auth_context_v1", authContext);
    let validated = false;
    Object.defineProperty(window, "ELO_AUTH_SESSION_VALIDATED", {
      configurable: true,
      get: () => validated,
      set: (value) => { if (value === true) validated = true; }
    });
  }, syntheticToken());
}

async function installSyntheticRoutes(page, options = {}) {
  const state = {
    conversationLoads: [],
    requests: [],
    memories: [
      { id: "memory-profile", category: "profile", memory_value: "profile: Preferência sintética de teste" },
      { id: "memory-context", category: "technical_context", memory_value: "technical_context: Respostas com listas curtas" }
    ],
    archived: [],
    deletedMemories: [],
    clearMemoryCalls: 0,
    failConversation: ""
  };
  await page.route("https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1/user**", (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:5541",
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "apikey, authorization, x-client-info, content-type"
        }
      });
    }
    return route.fulfill({
      status: 200,
      headers: { "access-control-allow-origin": "http://127.0.0.1:5541", "access-control-allow-credentials": "true" },
      contentType: "application/json",
      body: JSON.stringify({ id: "user-history-memory-ux", email: "history-memory-ux@example.test" })
    });
  });
  await page.route("**/api/elo/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:5541",
          "access-control-allow-credentials": "true",
          "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers": "authorization, content-type, x-elo-user-id, x-elo-anonymous-id"
        }
      });
    }
    let body = null;
    if (method !== "GET") {
      try { body = request.postDataJSON(); } catch (error) { body = null; }
    }
    state.requests.push({ method, path, body });

    if (path === "/api/elo/identity/merge") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (path === "/api/elo/conversations" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: CONVERSATIONS.filter((conversation) => !state.archived.includes(conversation.id)) }) });
    }
    if (path.startsWith("/api/elo/conversations/") && method === "GET") {
      const id = decodeURIComponent(path.split("/").pop());
      state.conversationLoads.push(id);
      if (id === options.failConversation || id === state.failConversation) {
        return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ ok: false, error: "conversation_not_found" }) });
      }
      if (id === "history-synthetic-a" && options.delayConversationA) await new Promise((resolve) => setTimeout(resolve, options.delayConversationA));
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id }, messages: MESSAGES[id] || [] }) });
    }
    if (path.startsWith("/api/elo/conversations/") && method === "PUT") {
      const id = decodeURIComponent(path.split("/").pop());
      state.archived.push(id);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id, archived_at: "2026-10-11T00:00:00.000Z" } }) });
    }
    if (path === "/api/elo/memories" && method === "GET") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, memories: state.memories }) });
    }
    if (path === "/api/elo/memories" && method === "DELETE") {
      state.clearMemoryCalls += 1;
      state.memories = [];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    if (path.startsWith("/api/elo/memories/") && method === "DELETE") {
      const id = decodeURIComponent(path.split("/").pop());
      state.deletedMemories.push(id);
      state.memories = state.memories.filter((memory) => memory.id !== id);
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, messages: [] }) });
  });
  return state;
}

async function openSyntheticElo(page, viewport) {
  test.setTimeout(240000);
  await page.setViewportSize(viewport || VIEWPORTS[0]);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.EloAssistente && document.querySelector(".elo-input-row"));
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true && document.body.classList.contains("elo-authenticated"));
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_RESTORING !== true);
}

async function openHeaderAction(page, selector) {
  const menuToggle = page.locator("[data-elo-mobile-menu-toggle]");
  if (await menuToggle.isVisible()) {
    if (await menuToggle.getAttribute("aria-expanded") !== "true") await menuToggle.click();
  }
  await page.locator(selector).click();
}

async function openHistory(page, expectedCount = 2) {
  await openHeaderAction(page, "[data-elo-history]");
  await expect(page.locator(".elo-history-list")).toBeVisible();
  await expect(page.locator(".elo-history-item")).toHaveCount(expectedCount);
}

async function openMemory(page) {
  await openHeaderAction(page, "[data-elo-memory]");
  await expect(page.locator(".elo-memory-list")).toBeVisible();
}

test("Histórico e Memória preservam as ações, o conteúdo e o layout", async ({ page }) => {
  test.setTimeout(360000);
  mkdirSync(ARTIFACT_DIR, { recursive: true });
  await installSyntheticSession(page);
  const state = await installSyntheticRoutes(page, { delayConversationA: 450 });
  await openSyntheticElo(page);
  await openHistory(page);

  const cardA = page.locator(".elo-history-item", { hasText: "Conversa sintética A" });
  const cardB = page.locator(".elo-history-item", { hasText: "Conversa sintética B" });
  await cardA.getByRole("button", { name: "Abrir" }).click();
  await cardB.getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".elo-messages")).toContainText("RESPOSTA_FIXTURE_B_CONTEXT_B");
  await page.waitForTimeout(550);
  await expect(page.locator(".elo-messages")).toContainText("RESPOSTA_FIXTURE_B_CONTEXT_B");
  await expect(page.locator(".elo-messages")).not.toContainText("RESPOSTA_FIXTURE_A_CONTEXT_A");
  expect(state.conversationLoads).toEqual(["history-synthetic-a", "history-synthetic-b"]);

  await openHistory(page);
  await page.locator(".elo-history-item", { hasText: "Conversa sintética A" }).getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".elo-messages")).toContainText("RESPOSTA_FIXTURE_A_CONTEXT_A");
  await expect(page.locator(".elo-messages")).not.toContainText("RESPOSTA_FIXTURE_B_CONTEXT_B");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true && document.body.classList.contains("elo-authenticated"));
  await page.waitForFunction(() => window.ELO_AUTH_SESSION_RESTORING !== true);
  await expect(page.locator(".elo-messages")).toContainText("RESPOSTA_FIXTURE_A_CONTEXT_A");
  await expect(page.locator(".elo-messages")).not.toContainText("RESPOSTA_FIXTURE_B_CONTEXT_B");
  await expect(page.locator(".elo-offline-badge")).toBeHidden();

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openHistory(page);
    await expect(page.locator(".elo-core-utility-header h3")).toBeVisible();
    await expect(page.locator(".elo-history-item").first()).toContainText("Fixture de histórico");
    await expect(page.locator(".elo-history-item").first().getByRole("button", { name: "Abrir" })).toBeVisible();
    await expect(page.locator(".elo-history-item").first().getByRole("button", { name: "Arquivar" })).toBeVisible();
    const historyTitleStyle = await page.locator(".elo-history-title").first().evaluate((element) => ({ color: getComputedStyle(element).color, fill: getComputedStyle(element).webkitTextFillColor }));
    expect(historyTitleStyle).toEqual({ color: "rgb(35, 54, 75)", fill: "rgb(35, 54, 75)" });
    await expect(page.locator(".elo-local-report-button")).toBeHidden();
    await expect(page.locator(".elo-voice-mode-button")).toBeHidden();
    await page.screenshot({ path: join(ARTIFACT_DIR, `${viewport.name}-history.png`), fullPage: true });

    await page.locator(".elo-history-back").click();
    await expect(page.locator(".elo-input-row")).toBeVisible();
    await openMemory(page);
    await expect(page.locator(".elo-history-back")).toBeVisible();
    await expect(page.locator(".elo-memory-delete").first()).toBeVisible();
    await expect(page.locator(".elo-local-report-button")).toBeHidden();
    await expect(page.locator(".elo-voice-mode-button")).toBeHidden();
    await page.screenshot({ path: join(ARTIFACT_DIR, `${viewport.name}-memory.png`), fullPage: true });

    const layout = await page.evaluate(() => ({
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      headerVisible: getComputedStyle(document.querySelector(".elo-product-top")).display !== "none",
      panelVisible: !document.querySelector(".elo-core-utility-panel").hidden,
      internalPrefixVisible: /(?:technical_context|profile):/.test(document.querySelector(".elo-memory-list").textContent)
    }));
    expect(layout).toEqual({ horizontalOverflow: false, headerVisible: true, panelVisible: true, internalPrefixVisible: false });

    await page.locator(".elo-history-back").click();
    await expect(page.locator(".elo-input-row")).toBeVisible();
    await expect(page.locator(".elo-product-top")).toBeVisible();
    const chatLayout = await page.evaluate(() => {
      const header = document.querySelector(".elo-product-top").getBoundingClientRect();
      const composer = document.querySelector(".elo-input-row").getBoundingClientRect();
      return {
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
        headerComposerOverlap: header.left < composer.right && header.right > composer.left && header.top < composer.bottom && header.bottom > composer.top
      };
    });
    expect(chatLayout).toEqual({ horizontalOverflow: false, headerComposerOverlap: false });
  }

  await page.setViewportSize(VIEWPORTS[0]);
  await openHistory(page);
  state.failConversation = "history-synthetic-a";
  await page.locator(".elo-history-item", { hasText: "Conversa sintética A" }).getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".elo-history-feedback")).toHaveText("Não foi possível abrir esta conversa agora. Tente novamente.");
  await expect(page.locator(".elo-history-list")).toBeVisible();
  await expect(page.locator(".elo-history-item", { hasText: "Conversa sintética B" })).toBeVisible();
  state.failConversation = "";
  await page.locator(".elo-history-item", { hasText: "Conversa sintética A" }).getByRole("button", { name: "Abrir" }).click();
  await expect(page.locator(".elo-messages")).toContainText("RESPOSTA_FIXTURE_A_CONTEXT_A");

  await openHistory(page);
  const loadsBeforeArchive = state.conversationLoads.length;
  await page.locator(".elo-history-item", { hasText: "Conversa sintética B" }).getByRole("button", { name: "Arquivar" }).click();
  await expect(page.locator(".elo-history-item", { hasText: "Conversa sintética B" })).toHaveCount(0);
  expect(state.archived).toEqual(["history-synthetic-b"]);
  expect(state.conversationLoads).toHaveLength(loadsBeforeArchive);
  expect(state.requests.some((request) => request.method === "DELETE" && request.path.includes("conversations"))).toBe(false);

  await openMemory(page);

  const cards = page.locator(".elo-memory-item");
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Preferência sintética de teste");
  await expect(cards.nth(1)).toContainText("Respostas com listas curtas");
  await expect(page.locator(".elo-memory-list")).not.toContainText("profile:");
  await expect(page.locator(".elo-memory-list")).not.toContainText("technical_context:");

  await cards.nth(0).locator(".elo-memory-content").click();
  expect(state.deletedMemories).toEqual([]);
  expect(state.clearMemoryCalls).toBe(0);

  let deletePrompt = "";
  page.once("dialog", async (dialog) => { deletePrompt = dialog.message(); await dialog.dismiss(); });
  await cards.nth(0).getByRole("button", { name: "Excluir memória" }).click();
  expect(deletePrompt).toMatch(/excluir esta memória/i);
  expect(state.deletedMemories).toEqual([]);
  await expect(page.locator(".elo-memory-item")).toHaveCount(2);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".elo-memory-item").filter({ hasText: "Preferência sintética de teste" }).getByRole("button", { name: "Excluir memória" }).click();
  await expect(page.locator(".elo-memory-item")).toHaveCount(1);
  expect(state.deletedMemories).toEqual(["memory-profile"]);

  let clearPrompt = "";
  page.once("dialog", async (dialog) => { clearPrompt = dialog.message(); await dialog.dismiss(); });
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  expect(clearPrompt).toMatch(/limpar todas as memórias/i);
  expect(state.clearMemoryCalls).toBe(0);
  await expect(page.locator(".elo-memory-item")).toHaveCount(1);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(page.locator(".elo-memory-item")).toHaveCount(0);
  expect(state.clearMemoryCalls).toBe(1);
});
