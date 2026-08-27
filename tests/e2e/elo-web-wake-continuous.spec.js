import { expect, test } from "@playwright/test";

const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";

async function openEloWithWakeMock(page, viewport) {
  await page.setViewportSize(viewport);
  await page.addInitScript((storageKey) => {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
    window.__eloSpeechInstances = [];
    class FakeSpeechRecognition {
      constructor() {
        this.lang = "";
        this.interimResults = false;
        this.continuous = false;
        this.maxAlternatives = 1;
        this.started = false;
        this.stopped = false;
        window.__eloSpeechInstances.push(this);
      }
      start() {
        this.started = true;
        if (this.onstart) this.onstart();
      }
      stop() {
        this.stopped = true;
      }
      emit(transcript, isFinal = true) {
        if (!this.onresult) return;
        this.onresult({
          resultIndex: 0,
          results: [{ 0: { transcript }, isFinal }]
        });
      }
    }
    window.SpeechRecognition = FakeSpeechRecognition;
    window.webkitSpeechRecognition = FakeSpeechRecognition;
  }, SITE_ACCESS_STORAGE_KEY);
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".elo-input-row")).toBeVisible();
  await expect(page.locator(".elo-wake-continuous-button")).toBeVisible();
}

for (const viewport of [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-412", width: 412, height: 915 },
  { name: "mobile-430", width: 430, height: 932 }
]) {
  test(`wake continuo ativa, aceita wake-only e despacha comando em ${viewport.name}`, async ({ page }) => {
    await openEloWithWakeMock(page, viewport);

    await page.locator(".elo-wake-continuous-button").click();
    await expect(page.locator(".elo-wake-continuous-button")).toHaveText("ELO ativo");
    await expect.poll(() => page.evaluate(() => window.EloAssistente.getWakeContinuousStateForTest().state)).toBe("WAKE_LISTENING");

    await page.evaluate(() => window.__eloSpeechInstances.at(-1).emit("ELO", true));
    await expect.poll(() => page.evaluate(() => window.EloAssistente.getWakeContinuousStateForTest().state)).toBe("COMMAND_LISTENING");

    await page.evaluate(() => window.EloAssistente.stopWakeContinuousForTest());
    await page.evaluate(() => window.EloAssistente.startWakeContinuousForTest());
    await page.evaluate(() => window.__eloSpeechInstances.at(-1).emit("ELO, tudo e vc?", true));

    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toContainText("Tudo certo por aqui.");
    await expect.poll(() => page.evaluate(() => window.EloAssistente.getWakeContinuousStateForTest().lastCommand)).toBe("tudo e vc");
    const events = await page.evaluate(() => window.EloAssistente.getWakeEventsForTest().map((event) => event.name));
    expect(events).toContain("WAKE_MATCH");
    expect(events).toContain("WAKE_COMMAND_DISPATCH");
  });
}
