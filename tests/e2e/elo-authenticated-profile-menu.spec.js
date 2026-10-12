import { expect, test } from "@playwright/test";

const AUTH_URL = "https://mplpzyalcxhhinuvjthx.supabase.co";
const AUTH_USER_ID = "user-profile-menu-e2e";
const AUTH_EMAIL = "admin@elo-e2e.test";

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function token() {
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    iss: `${AUTH_URL}/auth/v1`,
    sub: AUTH_USER_ID,
    exp: Math.floor(Date.now() / 1000) + 3600
  })}.synthetic-signature`;
}

async function installSession(page) {
  await page.addInitScript(({ savedToken }) => {
    window.ELO_SUPABASE_URL = "https://mplpzyalcxhhinuvjthx.supabase.co";
    window.ELO_SUPABASE_ANON_KEY = "synthetic-anon-key";
    window.ELO_API_BASE_URL = window.location.origin;
    const session = JSON.stringify({ currentSession: { access_token: savedToken }, access_token: savedToken });
    const authContext = JSON.stringify({
      userId: "user-profile-menu-e2e",
      institutionId: "inst-profile-menu-e2e",
      companyId: "company-profile-menu-e2e",
      profile: { id: "user-profile-menu-e2e", email: "admin@elo-e2e.test" }
    });
    window.localStorage.setItem("sb-elo-core-auth-token", session);
    window.sessionStorage.setItem("sb-elo-core-auth-token", session);
    window.localStorage.setItem("elo_core_auth_context_v1", authContext);
    window.sessionStorage.setItem("elo_core_auth_context_v1", authContext);
  }, { savedToken: token() });
}

async function installRoutes(page, meResponse = { status: 200, body: {
  ok: true,
  user_id: AUTH_USER_ID,
  email: AUTH_EMAIL,
  institution_id: "inst-profile-menu-e2e",
  company_id: "company-profile-menu-e2e"
} }) {
  const state = { mergeRequests: 0, meRequests: [], mutations: [] };
  await page.route(`${AUTH_URL}/auth/v1/user**`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:5541",
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "apikey, authorization, x-client-info, content-type"
        }
      });
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ id: AUTH_USER_ID, email: AUTH_EMAIL })
    });
  });
  await page.route("**/api/elo/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== "GET" && method !== "OPTIONS") state.mutations.push({ method, path });
    if (method === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "http://127.0.0.1:5541",
          "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
          "access-control-allow-headers": "authorization, content-type, x-elo-user-id, x-elo-anonymous-id"
        }
      });
    }
    if (path === "/api/elo/identity/merge" && method === "POST") {
      state.mergeRequests += 1;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          authContext: {
            userId: AUTH_USER_ID,
            institutionId: "inst-profile-menu-e2e",
            companyId: "company-profile-menu-e2e",
            profile: { id: AUTH_USER_ID, email: AUTH_EMAIL }
          }
        })
      });
    }
    if (path === "/api/elo/me" && method === "GET") {
      state.meRequests.push({ method, path });
      return route.fulfill({
        status: meResponse.status,
        contentType: "application/json",
        headers: { "cache-control": "private, no-store" },
        body: JSON.stringify(meResponse.body || {})
      });
    }
    if (path === "/api/elo/memories") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, memories: [] }) });
    }
    if (path === "/api/elo/conversations") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [] }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return state;
}

for (const surface of [
  {
    name: "mobile web",
    userAgent: "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0.0.0 Mobile Safari/537.36"
  },
  {
    name: "Android WebView",
    userAgent: "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36"
  }
]) {
  test(`${surface.name} shows the authenticated account from the read-only profile route`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:5541",
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent: surface.userAgent
    });
    const page = await context.newPage();
    await installSession(page);
    const state = await installRoutes(page);

    try {
      await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true);
      await expect.poll(() => state.mergeRequests).toBeGreaterThan(0);

      const mergesBeforeOpeningProfile = state.mergeRequests;
      const mutationsBeforeOpeningProfile = state.mutations.slice();
      await page.locator("[data-elo-mobile-menu-toggle]").click();
      await page.locator("[data-elo-profile-diagnostics] > summary").click();
      const account = page.locator("[data-elo-profile-label]");
      await expect(account).toBeVisible();
      await expect(account.locator("[data-elo-profile-state]")).toHaveText("VALID");
      await expect(account.locator("[data-elo-profile-email]")).toHaveText(AUTH_EMAIL);
      await expect(account.locator("[data-elo-profile-institution]")).toHaveText("inst-profile-menu-e2e");
      await expect(account.locator("[data-elo-profile-company]")).toHaveText("company-profile-menu-e2e");
      await expect(account.locator("[data-elo-profile-request]")).toHaveText("HTTP 200");
      await expect(account.locator("[data-elo-profile-bundle]")).toHaveText("20261012-profile-diagnostics-v1");
      expect(state.meRequests).toEqual([{ method: "GET", path: "/api/elo/me" }]);
      expect(state.mergeRequests).toBe(mergesBeforeOpeningProfile);
      expect(state.mutations).toEqual(mutationsBeforeOpeningProfile);
      await expect(account).not.toContainText("synthetic-signature");
      await expect(account).not.toContainText("Bearer");
      await expect(account).not.toContainText("Authorization");
      await expect(account).not.toContainText("JWT");
      expect(await page.evaluate(() => window.ELO_ASSISTENTE_BUILD_VERSION)).toBe("20261012-profile-diagnostics-v1");
    } finally {
      await context.close();
    }
  });
}

for (const response of [
  { name: "expired session", status: 401, state: "INVALID" },
  { name: "profile absent", status: 403, state: "INVALID" },
  { name: "profile endpoint unavailable", status: 503, state: "UNAVAILABLE" }
]) {
  test(`${response.name} is reported without exposing session data or mutating identity`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installSession(page);
    const state = await installRoutes(page, { status: response.status, body: { ok: false } });
    await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true);
    await expect.poll(() => state.mergeRequests).toBeGreaterThan(0);
    const mergesBeforeOpeningProfile = state.mergeRequests;
    const mutationsBeforeOpeningProfile = state.mutations.slice();

    await page.locator("[data-elo-mobile-menu-toggle]").click();
    await page.locator("[data-elo-profile-diagnostics] > summary").click();
    const account = page.locator("[data-elo-profile-label]");
    await expect(account).toBeVisible();
    await expect(account.locator("[data-elo-profile-state]")).toHaveText(response.state);
    await expect(account.locator("[data-elo-profile-request]")).toHaveText(`HTTP ${response.status}`);
    await expect(account.locator("[data-elo-profile-email]")).toHaveText("Não confirmada");
    expect(state.meRequests).toEqual([{ method: "GET", path: "/api/elo/me" }]);
    expect(state.mergeRequests).toBe(mergesBeforeOpeningProfile);
    expect(state.mutations).toEqual(mutationsBeforeOpeningProfile);
    await expect(account).not.toContainText("synthetic-signature");
    await expect(account).not.toContainText("Bearer");
  });
}

test("missing local session is invalid and does not request another user's profile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const state = await installRoutes(page);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.EloAssistente.loadProfileMenuIdentityForTest());
  const account = page.locator("[data-elo-profile-label]");
  await expect(account).toHaveJSProperty("hidden", false);
  await expect(account.locator("[data-elo-profile-state]")).toHaveText("INVALID");
  await expect(account.locator("[data-elo-profile-request]")).toHaveText("Não executada: sessão não validada");
  expect(state.meRequests).toEqual([]);
  expect(state.mutations).toEqual([]);
});
