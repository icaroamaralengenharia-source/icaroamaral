import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";
const ARTIFACT_DIR = join(process.cwd(), "artifacts", "elo-mobile-regressions");

async function openElo(page, viewport = { width: 390, height: 844 }) {
  await page.setViewportSize(viewport);
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".site-access-gate")).toBeHidden();
  await expect(page.locator(".elo-input-row")).toBeVisible();
}

async function sendElo(page, text) {
  const currentAnswers = await page.locator(".elo-message.assistant:not(.is-typing)").count();
  await page.locator(".elo-input").fill(text);
  await page.locator(".elo-send-button").click();
  await expect(page.locator(".elo-message.assistant:not(.is-typing)")).toHaveCount(currentAnswers + 1);
  await expect(page.locator("[data-elo-typing='true']")).toHaveCount(0);
}

test.describe("Elo mobile scroll regressions", () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    await page.route("**/api/elo/conversations?**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversations: [] }) });
    });
    await page.route("**/api/elo/conversations", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id: "new-conversation" } }) });
    });
    await page.route("**/api/elo/conversations/**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/elo/memories?**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, memories: [] }) });
    });
    await page.route("**/api/elo/chat", async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, answer: "Resposta de teste para: " + (payload.message || "pergunta") })
      });
    });
  });

  test("mobile rola conversa longa e nao cobre a ultima resposta", async ({ page }) => {
    await openElo(page);
    for (let index = 0; index < 30; index += 1) {
      await sendElo(page, "Mensagem longa de teste " + index);
      await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toBeVisible();
    }

    const metrics = await page.locator(".elo-messages").evaluate((messages) => {
      const composer = document.querySelector(".elo-input-row").getBoundingClientRect();
      const last = messages.querySelector(".elo-message:last-child").getBoundingClientRect();
      const initialScrollTop = messages.scrollTop;
      messages.scrollTop = 0;
      const topScrollTop = messages.scrollTop;
      const movedTop = messages.scrollTop === 0;
      messages.scrollTop = messages.scrollHeight;
      const finalScrollTop = messages.scrollTop;
      return {
        scrollHeight: messages.scrollHeight,
        clientHeight: messages.clientHeight,
        initialScrollTop,
        topScrollTop,
        finalScrollTop,
        scrollable: messages.scrollHeight > messages.clientHeight,
        movedTop,
        movedBottom: finalScrollTop > 0,
        composerHeight: composer.height,
        lastBox: { top: last.top, bottom: last.bottom, height: last.height, left: last.left, right: last.right, width: last.width },
        composerBox: { top: composer.top, bottom: composer.bottom, height: composer.height, left: composer.left, right: composer.right, width: composer.width },
        overlapPx: Math.max(0, last.bottom - composer.top),
        loaderCount: document.querySelectorAll("[data-elo-typing='true']").length
      };
    });
    console.log("ELO_MOBILE_SCROLL_METRICS", JSON.stringify(metrics));

    expect(metrics.scrollable).toBe(true);
    expect(metrics.finalScrollTop).toBeGreaterThan(0);
    expect(metrics.movedTop).toBe(true);
    expect(metrics.movedBottom).toBe(true);
    expect(metrics.overlapPx).toBeLessThanOrEqual(0);
    expect(metrics.loaderCount).toBe(0);
    await page.screenshot({ path: join(ARTIFACT_DIR, "mobile-scroll-after.png"), fullPage: true });
  });
});
