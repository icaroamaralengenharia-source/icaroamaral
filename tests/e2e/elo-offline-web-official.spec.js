import { expect, test } from "@playwright/test";

async function waitForElo(page) {
  await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.EloAssistente && window.EloOfflineRouter && window.EloOfflineMemoryAdapter && window.EloOfflineMediaLibrary);
}

async function installServiceWorker(page, context) {
  await context.setOffline(false);
  await waitForElo(page);
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return false;
    await navigator.serviceWorker.ready;
    return true;
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.EloAssistente && window.EloOfflineRouter);
    const controlled = await page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    if (controlled) break;
    await page.waitForTimeout(300);
  }
  await expect(page.locator("body")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller)), { timeout: 10000 }).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.EloAssistente && window.EloOfflineRouter);
}

test("ELO oficial online preserva chat via backend antes do offline router", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let chatCalls = 0;
  await page.route("**/api/elo/chat", async (route) => {
    chatCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, answer: "Resposta online preservada." })
    });
  });

  await waitForElo(page);
  const answer = await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("conversa normal", []));
  expect(answer).toBe("Resposta online preservada.");
  expect(chatCalls).toBe(1);
  expect(await page.evaluate(() => window.EloAssistente.getChatTransportStateForTest().state)).toBe("ONLINE_VALIDATED");
  expect(errors.filter((message) => !message.includes("Cannot set properties of null (setting 'innerHTML')"))).toEqual([]);
});

test("ELO oficial instala cache e recarrega offline com músicas, memória e pare locais", async ({ page, context }) => {
  await installServiceWorker(page, context);
  const result = await page.evaluate(async () => {
    const storage = window.localStorage;
    window.__eloOfflinePlayed = [];
    window.EloMusicResolver = Object.assign({}, window.EloMusicResolver, {
      play(media) {
        window.__eloOfflinePlayed.push(media && media.title);
        return Promise.resolve(true);
      }
    });
    window.EloMediaPlayer = Object.assign({}, window.EloMediaPlayer, {
      stop() {
        window.__eloOfflinePlayed.push("STOP");
        return { executed: true };
      }
    });
    const router = window.EloOfflineRouter.createRouter({ storage });
    await router.route("lembre que meu cachorro se chama Thor", { navigator: { onLine: false } });
    await router.route("lembre que o projeto atual é Photo Bridge", { navigator: { onLine: false } });
    const commands = ["toque Beethoven", "toque Debussy", "toque Vivaldi", "toque Pachelbel", "toque Chopin"];
    const music = [];
    for (const command of commands) {
      music.push(await router.route(command, { navigator: { onLine: false } }));
    }
    const dog = await router.route("qual o nome do meu cachorro?", { navigator: { onLine: false } });
    const project = await router.route("qual projeto estamos trabalhando?", { navigator: { onLine: false } });
    const stop = await router.route("pare", { navigator: { onLine: false } });
    return {
      music,
      dog: dog.message,
      project: project.message,
      stop,
      played: window.__eloOfflinePlayed,
      longTerm: JSON.parse(storage.getItem("elo_long_term_memory_v1") || "[]"),
      projectMemory: JSON.parse(storage.getItem("elo_core_project_memory_v1") || "[]")
    };
  });

  expect(result.music.every((item) => item.localPlay === true && item.providerCalls === 0 && item.chatCalls === 0)).toBe(true);
  expect(result.dog).toMatch(/Thor/);
  expect(result.project).toMatch(/Photo Bridge/);
  expect(result.stop.localStop).toBe(true);
  expect(result.played).toContain("STOP");
  expect(result.longTerm.length).toBeGreaterThanOrEqual(2);
  expect(result.projectMemory[0].project_name).toBe("Photo Bridge");
});

test("ELO oficial com navegador online e backend morto usa fallback local permitido", async ({ page }) => {
  await page.route("**/api/elo/chat", async (route) => route.abort("failed"));
  await waitForElo(page);
  await page.evaluate(async () => {
    window.localStorage.setItem("elo_long_term_memory_v1", JSON.stringify([{ id: "dog", text: "Meu cachorro se chama Thor.", category: "pessoa", importance: "media", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }]));
  });
  const online = await page.evaluate(() => window.navigator.onLine);
  const onlineAnswer = await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("qual o nome do meu cachorro?", []));
  const transport = await page.evaluate(() => window.EloAssistente.getChatTransportStateForTest());
  const local = await page.evaluate(() => window.EloAssistente.requestOfflineRouteForTest("qual o nome do meu cachorro?"));
  const unsupported = await page.evaluate(() => window.EloAssistente.requestOfflineRouteForTest("pesquise notícias de hoje"));

  expect(online).toBe(true);
  expect(onlineAnswer).toBe(null);
  expect(transport.state).toBe("BACKEND_UNAVAILABLE");
  expect(local.message).toMatch(/Thor/);
  expect(unsupported.handled).toBe(false);
  expect(unsupported.message).toMatch(/precisa de conexão/i);
});

for (const status of [502, 503, 504]) {
  test(`ELO oficial fallback local para status ${status}`, async ({ page }) => {
    await page.route("**/api/elo/chat", async (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: false, error: "backend_down" }) }));
    await waitForElo(page);
    await page.evaluate(() => window.localStorage.setItem("elo_long_term_memory_v1", JSON.stringify([{ id: "dog", text: "Meu cachorro se chama Thor.", category: "pessoa", importance: "media" }])));
    await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("qual o nome do meu cachorro?", []));
    const transport = await page.evaluate(() => window.EloAssistente.getChatTransportStateForTest());
    const local = await page.evaluate(() => window.EloAssistente.requestOfflineRouteForTest("qual o nome do meu cachorro?"));
    expect(transport.state).toBe("BACKEND_UNAVAILABLE");
    expect(local.message).toMatch(/Thor/);
  });
}

for (const status of [401, 403]) {
  test(`ELO oficial status ${status} não vira offline`, async ({ page }) => {
    await page.route("**/api/elo/chat", async (route) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ ok: false, error: "auth_or_rule" }) }));
    await waitForElo(page);
    await page.evaluate(() => window.EloAssistente.requestOnlineAnswerForTest("pesquise notícias de hoje", []));
    const transport = await page.evaluate(() => window.EloAssistente.getChatTransportStateForTest());
    expect(transport.state).toBe("ONLINE_VALIDATED");
  });
}

test("ELO oficial misses offline não chamam provider nem chat", async ({ page, context }) => {
  await waitForElo(page);
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const fetchCalls = [];
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (...args) {
      fetchCalls.push(String(args[0]));
      return originalFetch(...args);
    };
    const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage });
    const takeOnMe = await router.route("toque Take On Me", { navigator: { onLine: false } });
    const sweetChild = await router.route("toque Sweet Child O' Mine", { navigator: { onLine: false } });
    return { takeOnMe, sweetChild, fetchCalls };
  });
  expect(result.takeOnMe.localPlay).toBe(false);
  expect(result.sweetChild.localPlay).toBe(false);
  expect(result.takeOnMe.message).toMatch(/não está disponível/i);
  expect(result.sweetChild.message).toMatch(/não está disponível/i);
  expect(result.fetchCalls.filter((url) => !url.includes("library.json")).length).toBe(0);
});
