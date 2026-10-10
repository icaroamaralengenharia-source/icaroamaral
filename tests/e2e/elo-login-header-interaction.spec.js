import { expect, test } from "@playwright/test";

const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 390, height: 844 }
];

async function openUnauthenticatedElo(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000
    }));
    window.ELO_AUTH_SESSION_VALIDATED = false;
  }, SITE_ACCESS_STORAGE_KEY);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-elo-auth-form]")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/elo-auth-required/);
  await expect(page.locator("body")).toHaveClass(/elo-local-readonly/);
}

for (const viewport of VIEWPORTS) {
  test(`login header receives pointer hits and focus in ${viewport.name}`, async ({ page }) => {
    await openUnauthenticatedElo(page, viewport);

    const results = await page.evaluate(() => {
      return [
        document.querySelector('[data-elo-auth-form] input[name="email"]'),
        document.querySelector('[data-elo-auth-form] input[name="password"]'),
        document.querySelector('[data-elo-auth-form] button[type="submit"]')
      ].map((target) => {
        const box = target.getBoundingClientRect();
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        return {
          name: target.name || "submit",
          receivesHit: hit === target || target.contains(hit),
          pointerEvents: getComputedStyle(target).pointerEvents
        };
      });
    });

    expect(results).toEqual([
      { name: "email", receivesHit: true, pointerEvents: "auto" },
      { name: "password", receivesHit: true, pointerEvents: "auto" },
      { name: "submit", receivesHit: true, pointerEvents: "auto" }
    ]);

    const email = page.locator('[data-elo-auth-form] input[name="email"]');
    const password = page.locator('[data-elo-auth-form] input[name="password"]');
    const button = page.locator('[data-elo-auth-form] button[type="submit"]');
    await email.click();
    await expect(email).toBeFocused();
    await password.click();
    await expect(password).toBeFocused();

    await email.focus();
    await page.keyboard.press("Tab");
    await expect(password).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(button).toBeFocused();
  });
}

test("Entrar receives a click without submitting authentication and stays enabled after reload", async ({ page }) => {
  await openUnauthenticatedElo(page, VIEWPORTS[0]);
  const authRequests = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/auth/v1/token") && url.searchParams.get("grant_type") === "password") {
      authRequests.push(request.method());
    }
  });

  const button = page.locator('[data-elo-auth-form] button[type="submit"]');
  await expect(button).toBeEnabled();
  await button.evaluate((element) => {
    element.addEventListener("click", (event) => {
      window.__eloLoginHeaderTestClickCount = (window.__eloLoginHeaderTestClickCount || 0) + 1;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, { capture: true, once: true });
  });
  await button.click();

  expect(await page.evaluate(() => window.__eloLoginHeaderTestClickCount)).toBe(1);
  expect(authRequests).toEqual([]);
  await expect(button).toBeEnabled();

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-elo-auth-form]")).toBeVisible();
  await expect(page.locator('[data-elo-auth-form] button[type="submit"]')).toBeEnabled();
});
