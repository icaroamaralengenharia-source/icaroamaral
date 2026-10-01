import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(process.cwd());
const TRIAL_URL = pathToFileURL(resolve(ROOT, "vistoria-entrega-apartamento-trial", "index.html")).toString();
const API_BASE = "https://obrareport-backend.onrender.com";

test("convite trial entra sem senha, limpa URL, persiste reload e logout volta ao login", async ({ page }) => {
  const calls = [];
  await page.route(`${API_BASE}/api/apartment-handover/invite/redeem`, async (route) => {
    calls.push({ type: "redeem", body: route.request().postDataJSON() });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        auth_mode: "invite",
        invite_session: "signed-session-test",
        invite_session_expires_at: "2026-08-31T23:59:00.000Z",
        access: {
          ok: true,
          allowed: true,
          auth_mode: "invite",
          status: "trial_active",
          trial_used: 0,
          trial_limit: 2,
          remaining: 2,
          can_create: true
        }
      })
    });
  });
  await page.route(`${API_BASE}/api/apartment-handover/access`, async (route) => {
    calls.push({
      type: "access",
      inviteSession: route.request().headers()["x-apartment-handover-invite-session"] || "",
      authorization: route.request().headers().authorization || ""
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        allowed: true,
        auth_mode: "invite",
        status: "trial_active",
        trial_used: 0,
        trial_limit: 2,
        remaining: 2,
        can_create: true
      })
    });
  });

  await page.goto(`${TRIAL_URL}?invite=raw-token-test`);
  await expect(page.locator("[data-trial-banner]")).toContainText("0 de 2");
  await expect(page).not.toHaveURL(/invite=/);
  expect(await page.evaluate(() => sessionStorage.getItem("obrareport-apartment-handover-invite-session-v1"))).toContain("signed-session-test");
  expect(calls.find((call) => call.type === "redeem").body).toEqual({ inviteToken: "raw-token-test" });
  expect(calls.some((call) => call.type === "access" && call.inviteSession === "signed-session-test" && call.authorization === "")).toBeTruthy();

  calls.length = 0;
  await page.reload();
  await expect(page.locator("[data-trial-banner]")).toContainText("0 de 2");
  expect(calls.some((call) => call.type === "access" && call.inviteSession === "signed-session-test")).toBeTruthy();

  await page.locator("[data-trial-logout]").click();
  await expect(page.locator("[data-trial-login-overlay]")).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("obrareport-apartment-handover-invite-session-v1"))).toBeNull();

  await page.goto(TRIAL_URL);
  await expect(page.locator("[data-trial-login-overlay]")).toBeVisible();
  await expect(page.locator("[data-trial-login-email]")).toBeVisible();
  await expect(page.locator("[data-trial-login-password]")).toBeVisible();
});
