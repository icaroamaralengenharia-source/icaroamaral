import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ARTIFACT_DIR = join(process.cwd(), "..", "qa-artifacts", "elo-header-p0-20261011");
const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "tablet-804", width: 804, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-360", width: 360, height: 800 }
];

async function openAuthenticatedElo(page, viewport) {
  await page.setViewportSize(viewport);
  await page.route("**/api/elo/conversations?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, conversations: [{ id: "synthetic-history-1", title: "Conversa sintética", summary: "Fixture de interface." }] })
  }));
  await page.route("**/api/elo/memories?**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ ok: true, memories: [] })
  }));
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const payload = btoa(JSON.stringify({
      iss: "https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1",
      sub: "synthetic-header-test-user",
      exp: expiresAt
    })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    const syntheticToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${payload}.synthetic-signature`;
    localStorage.setItem("sb-elo-core-auth-token", JSON.stringify({
      access_token: syntheticToken,
      expires_at: expiresAt,
      user: { id: "synthetic-header-test-user" }
    }));
    window.ELO_AUTH_SESSION_VALIDATED = true;
    document.body.classList.remove("elo-auth-required", "elo-local-readonly");
    document.body.classList.add("elo-authenticated", "elo-empty-state");
    document.querySelector("[data-elo-auth-form]")?.setAttribute("hidden", "");
    document.querySelector("[data-elo-auth-session]")?.removeAttribute("hidden");
    const user = document.querySelector("[data-elo-auth-user]");
    if (user) user.textContent = "admin@elo-e2e.test";
    window.EloCoreAuthGate?.setAuthenticated(true);
  });
  await expect(page.locator(".elo-input-row")).toBeVisible();
  await expect(page.locator(".elo-product-top")).toBeVisible();
  if (viewport.width > 768) await expect(page.locator("[data-elo-auth-logout]")).toBeVisible();
  else await expect(page.locator("[data-elo-mobile-menu-toggle]")).toBeVisible();
}

async function assertHitTarget(page, locator) {
  const hit = await locator.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const x = bounds.left + bounds.width / 2;
    const y = bounds.top + bounds.height / 2;
    const hitElement = document.elementFromPoint(x, y);
    return {
      target: element.tagName.toLowerCase(),
      hit: hitElement?.tagName.toLowerCase() || null,
      hitClass: hitElement?.className?.toString() || "",
      targetContainsHit: Boolean(hitElement && (hitElement === element || element.contains(hitElement))),
      mainIntercepted: hitElement?.matches("main.elo-product-shell") === true,
      inViewport: x >= 0 && x < innerWidth && y >= 0 && y < innerHeight,
      rect: { left: bounds.left, top: bounds.top, right: bounds.right, bottom: bounds.bottom }
    };
  });
  expect(hit.inViewport, JSON.stringify(hit)).toBe(true);
  expect(hit.targetContainsHit, JSON.stringify(hit)).toBe(true);
  expect(hit.mainIntercepted, JSON.stringify(hit)).toBe(false);
  return hit;
}

async function openMobileActions(page) {
  const toggle = page.locator("[data-elo-mobile-menu-toggle]");
  if (await toggle.isVisible()) {
    await assertHitTarget(page, toggle);
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
    await expect(page.locator("[data-elo-mobile-menu]")).toHaveClass(/is-open/);
  }
}

for (const viewport of VIEWPORTS) {
  test(`header controls remain clickable without overflow at ${viewport.name}`, async ({ page }) => {
    test.setTimeout(60_000);
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    await openAuthenticatedElo(page, viewport);

    const headerZIndex = await page.locator(".elo-product-top").evaluate((element) => getComputedStyle(element).zIndex);
    expect(Number(headerZIndex)).toBeGreaterThan(2);

    const brandHit = await assertHitTarget(page, page.locator(".elo-product-brand"));
    expect(brandHit.mainIntercepted).toBe(false);

    const onlineStatus = await page.locator(".elo-product-top").evaluate((header) => ({
      desktopPointerEvents: getComputedStyle(header, "::after").pointerEvents,
      mobileLabel: getComputedStyle(header.querySelector(".elo-product-brand"), "::after").content
    }));
    if (viewport.width > 768) expect(onlineStatus.desktopPointerEvents).toBe("none");
    if (viewport.width <= 768) expect(onlineStatus.mobileLabel).toContain("Online");

    await openMobileActions(page);
    const historyButton = page.locator("[data-elo-history]");
    await expect(historyButton).toBeVisible();
    await assertHitTarget(page, historyButton);
    await historyButton.click();
    await expect(page.locator(".elo-history-list")).toBeVisible();
    await expect(page.locator(".elo-history-item")).toContainText("Conversa sintética");
    await page.screenshot({ path: join(ARTIFACT_DIR, `${viewport.name}-history.png`), fullPage: true });

    await page.locator(".elo-history-back").click();
    await openMobileActions(page);
    const memoryButton = page.locator("[data-elo-memory]");
    await expect(memoryButton).toBeVisible();
    await assertHitTarget(page, memoryButton);
    await memoryButton.click();
    await expect(page.locator(".elo-memory-list")).toBeVisible();
    await page.screenshot({ path: join(ARTIFACT_DIR, `${viewport.name}-memory.png`), fullPage: true });

    await page.locator(".elo-history-back").click();
    await openMobileActions(page);
    const clearButton = page.locator("[data-elo-clear-chat]");
    await expect(clearButton).toBeVisible();
    await assertHitTarget(page, clearButton);
    await page.locator(".elo-input").fill("rascunho sintético para testar Limpar conversa");
    let clearDialogMessage = "";
    page.once("dialog", async (dialog) => {
      clearDialogMessage = dialog.message();
      await dialog.accept();
    });
    await clearButton.click();
    expect(clearDialogMessage).toMatch(/limpar a conversa atual/i);
    await expect(page.locator(".elo-input")).toHaveValue("");

    const input = page.locator(".elo-input");
    await assertHitTarget(page, input);
    await input.fill("pergunta sintética não enviada");
    await expect(input).toHaveValue("pergunta sintética não enviada");
    await input.fill("");

    const overflow = await page.evaluate(() => ({
      horizontal: document.documentElement.scrollWidth > innerWidth || document.body.scrollWidth > innerWidth,
      vertical: document.documentElement.scrollHeight > innerHeight
    }));
    expect(overflow.horizontal).toBe(false);
    expect(overflow.vertical).toBe(false);

    const logoutControl = viewport.width <= 768
      ? page.locator('[data-elo-mobile-menu-action="logout"]')
      : page.locator("[data-elo-auth-logout]");
    await openMobileActions(page);
    await expect(logoutControl).toBeVisible();
    await assertHitTarget(page, logoutControl);
    await logoutControl.click();
    await expect(page.locator("body")).toHaveClass(/elo-auth-required/);
  });
}
