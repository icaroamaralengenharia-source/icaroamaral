import { expect, test } from "@playwright/test";

const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";

async function openElo(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, SITE_ACCESS_STORAGE_KEY);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".elo-input-row")).toBeVisible();
}

async function sendElo(page, text) {
  await page.locator(".elo-input").fill(text);
  await page.locator(".elo-send-button").click();
}

for (const viewport of [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-430", width: 430, height: 932 }
]) {
  test(`ELO Web renderiza social, imagem e video inline em ${viewport.name}`, async ({ page }) => {
    await openElo(page, viewport);

    await sendElo(page, "Tudo e vc?");
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toContainText("Tudo certo por aqui.");
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).not.toContainText(/com você|com voce/i);

    await sendElo(page, "Me mostre aqui uma imagem de um poodle toy");
    await expect(page.locator(".elo-inline-media-card[data-elo-media-type='image']").last()).toBeVisible();
    await expect(page.locator(".elo-inline-image").last()).toHaveAttribute("src", /source\.unsplash\.com|images\.unsplash\.com/);

    await sendElo(page, "Renderize aqui");
    await expect(page.locator(".elo-inline-media-card[data-elo-media-type='image']").last()).toContainText(/poodle toy/i);

    await sendElo(page, "Abra um vídeo de um poodle toy no veterinário");
    await expect(page.locator(".elo-inline-media-card[data-elo-media-type='video']").last()).toBeVisible();
    await expect(page.locator(".elo-inline-video").last()).toHaveAttribute("src", /youtube\.com\/embed/);
  });
}
