import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SITE_ACCESS_STORAGE_KEY = "icaro_site_access_v2";
const ARTIFACT_DIR = join(process.cwd(), "artifacts", "elo-mobile-regressions");

async function openElo(page, viewport = { width: 390, height: 844 }, options = {}) {
  await page.setViewportSize(viewport);
  await page.addInitScript(({ storageKey, preserveContinuityStorage }) => {
    if (!preserveContinuityStorage && !window.name.includes("elo_mobile_regression_storage_ready")) {
      window.sessionStorage.removeItem("elo_core_surface_state_v1");
      window.localStorage.removeItem("elo_core_surface_state_v1");
      Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)).filter(Boolean).forEach((key) => {
        if (key.startsWith("elo_core_surface_state_v1::") || key.startsWith("elo_core_current_conversation_id_v1::")) {
          window.localStorage.removeItem(key);
        }
      });
      window.localStorage.removeItem("elo_real_media_player_layout_v1");
      window.name = [window.name, "elo_mobile_regression_storage_ready"].filter(Boolean).join(" ");
    }
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 12 * 60 * 60 * 1000
    }));
  }, { storageKey: SITE_ACCESS_STORAGE_KEY, preserveContinuityStorage: Boolean(options.preserveContinuityStorage) });
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

test.describe("Elo mobile regressions", () => {
  test.beforeEach(async ({ page }) => {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    await page.route("**/api/elo/conversations?**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          conversations: [
            { id: "c1", title: "Parede bloco baiano", updated_at: "2026-07-11T18:30:00.000Z", summary: "Orcamento de parede com revestimento." },
            { id: "c2", title: "Relatorio de inconformidade", updated_at: "2026-07-11T18:10:00.000Z", summary: "Foto, PDF e link externo." }
          ]
        })
      });
    });
    await page.route("**/api/elo/conversations", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, conversation: { id: "new-conversation" } }) });
    });
    await page.route("**/api/elo/conversations/**", async (route) => {
      const method = route.request().method();
      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, messages: [{ role: "user", content: "Pedido antigo" }, { role: "assistant", content: "Resposta antiga" }] })
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/elo/memories?**", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, memories: [] }) });
    });
    await page.route("**/api/elo/web-search", async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          answer: "Resultado pesquisado para: " + payload.query,
          sources: ["https://fonte.example/resultado"]
        })
      });
    });
    await page.route("**/api/elo/chat", async (route) => {
      const payload = JSON.parse(route.request().postData() || "{}");
      if (/formatacao tecnica/i.test(payload.message || "")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            answer: [
              "Resposta principal",
              "A resposta tecnica deve manter blocos separados.",
              "",
              "Memoria de calculo",
              "- Area: 56 m2",
              "- Quantidade: conforme premissas.",
              "",
              "Premissas",
              "- Parede informada pelo usuario.",
              "",
              "Base tecnica",
              "- Sem JSON bruto.",
              "",
              "Alertas",
              "- Validar antes de executar.",
              "",
              "Proxima acao",
              "Conferir composicao oficial."
            ].join("\n")
          })
        });
        return;
      }
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

  test("loader encerra em sucesso e erro", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "me motive hoje");
    await expect(page.locator("[data-elo-typing='true']")).toHaveCount(0);

    await page.route("**/api/elo/web-search", async (route) => {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "mock_error" }) });
    });
    await sendElo(page, "preco atual do cimento");
    await expect(page.locator("[data-elo-typing='true']")).toHaveCount(0);
  });

  test("botao Pesquise preserva a pergunta original", async ({ page }) => {
    const requests = [];
    let releaseSearch;
    const searchCanFinish = new Promise((resolve) => {
      releaseSearch = resolve;
    });
    await page.route("**/api/elo/web-search", async (route) => {
      requests.push(JSON.parse(route.request().postData() || "{}"));
      await searchCanFinish;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, answer: "Resultado com fonte", sources: ["https://fonte.example/copa"] })
      });
    });
    await openElo(page);
    await sendElo(page, "Quero saber os proximos jogos da Copa do Mundo");
    const searchButton = page.locator('[data-elo-action-type="meta_web_search"]').last();
    await expect(searchButton).toBeVisible();
    await expect(searchButton).toHaveText("Pesquise");
    await searchButton.click();
    await expect(searchButton).toBeDisabled();
    await expect(searchButton).toHaveText("Pesquisando...");
    await searchButton.click({ force: true }).catch(() => {});
    releaseSearch();
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toContainText("Resultado com fonte");
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toContainText("https://fonte.example/copa");
    expect(requests).toHaveLength(1);
    expect(requests[0].query).toMatch(/proximos jogos da Copa do Mundo/i);
    expect(requests[0].query).not.toBe("Pesquise");
  });

  test("orcamento retoma contexto e reclamacao da tarefa ativa", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "Orce uma parede de bloco ceramico baiana, dimensao 20 metros x 2,80 metros, uma face chapisco reboco e pintura e o outro lado com revestimento ceramico 50x50");
    await expect(page.locator(".elo-message.assistant").last()).toContainText(/56|parede|orcamento/i);

    await sendElo(page, "O orcamento, faca");
    await expect(page.locator(".elo-message.assistant").last()).toContainText(/56|orcamento|parede/i);

    await sendElo(page, "O Elo nao criou o orcamento");
    await expect(page.locator(".elo-message.assistant").last()).toContainText(/retomar|parede|56|orcamento/i);
  });

  test("historico mobile fica isolado e usavel", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "me motive hoje");
    await page.locator("[data-elo-history]").click();
    await expect(page.locator(".elo-history-list")).toBeVisible();
    await expect(page.locator(".elo-history-item")).toHaveCount(2);
    const overflow = await page.locator(".elo-history-list").evaluate((list) => list.scrollWidth > list.clientWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: join(ARTIFACT_DIR, "mobile-history.png"), fullPage: true });
  });

  test("formatacao tecnica preserva secoes e listas", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "formatacao tecnica");
    const answer = await page.locator(".elo-message.assistant:not(.is-typing)").last().locator(".elo-message-bubble").textContent();
    expect(answer).toContain("Resposta principal\n");
    expect(answer).toContain("\nMemoria de calculo\n");
    expect(answer).toContain("\nPremissas\n");
    expect(answer).toContain("\nBase tecnica\n");
    expect(answer).toContain("\nAlertas\n");
    expect(answer).toContain("\nProxima acao\n");
    expect(answer).toContain("- Area: 56 m2");
    expect(answer).not.toMatch(/ainda s\s*Proxima acao/i);
    expect(answer).not.toMatch(/[{}][\s\S]*"/);
  });

  test("rotacao e reload preservam conversa pesquisa draft e scroll", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "preco atual do cimento em Salvador");
    await page.locator(".elo-input").fill("rascunho que nao pode sumir na rotacao");
    await page.locator(".elo-messages").evaluate((messages) => { messages.scrollTop = messages.scrollHeight; });
    const before = await page.locator(".elo-messages").evaluate((messages) => ({ scrollTop: messages.scrollTop, count: messages.querySelectorAll(".elo-message").length }));

    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-access-gate")).toBeHidden();
    await expect(page.locator(".elo-input-row")).toBeVisible();
    await expect(page.locator(".elo-input")).toHaveValue("rascunho que nao pode sumir na rotacao");
    await expect(page.locator(".elo-message.user")).toContainText([/preco atual do cimento em Salvador/i]);
    await expect(page.locator(".elo-message.assistant:not(.is-typing)")).toContainText([/Resultado pesquisado/i]);
    const landscape = await page.locator(".elo-messages").evaluate((messages) => ({ scrollTop: messages.scrollTop, count: messages.querySelectorAll(".elo-message").length }));
    expect(landscape.count).toBeGreaterThanOrEqual(before.count);
    expect(landscape.scrollTop).toBeGreaterThanOrEqual(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/elo.html", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".site-access-gate")).toBeHidden();
    await expect(page.locator(".elo-input")).toHaveValue("rascunho que nao pode sumir na rotacao");
    await expect(page.locator(".elo-message.user")).toContainText([/preco atual do cimento em Salvador/i]);
    await expect(page.locator(".elo-message.assistant:not(.is-typing)")).toContainText([/Resultado pesquisado/i]);
  });

  test("player flutuante move recolhe e nao bloqueia input", async ({ page }) => {
    await openElo(page);
    await page.addStyleTag({ content: "#elo-real-media-player { transition: none !important; }" });
    await page.evaluate(() => {
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event("playing"));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () {
        this.dispatchEvent(new Event("pause"));
      };
    });
    await page.evaluate(async () => {
      await window.EloMediaPlayer.play({
        source: "LOCAL_CLASSICAL",
        title: "Fur Elise",
        files: [{ url: "relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg", type: "audio/ogg" }]
      });
    });
    const player = page.locator("#elo-real-media-player");
    const handle = page.locator('[data-elo-media-drag-handle="true"]');
    await expect(player).toBeVisible();
    await expect(handle).toBeVisible();
    await expect(page.locator("#elo-real-media-player")).toHaveCount(1);

    const dragMouseStart = await handle.boundingBox();
    expect(dragMouseStart).not.toBeNull();
    await page.mouse.move(dragMouseStart.x + 20, dragMouseStart.y + 16);
    await page.mouse.down();
    await page.mouse.move(20, 60, { steps: 6 });
    await page.mouse.up();
    const afterMouse = await player.boundingBox();
    expect(afterMouse.x).toBeGreaterThanOrEqual(10);
    expect(afterMouse.y).toBeGreaterThanOrEqual(10);
    expect(afterMouse.x + afterMouse.width).toBeLessThanOrEqual(390);
    expect(afterMouse.y + afterMouse.height).toBeLessThanOrEqual(844);

    await handle.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, pointerType: "touch", clientX: rect.left + 20, clientY: rect.top + 14 }));
      window.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, pointerId: 7, pointerType: "touch", clientX: 999, clientY: 999 }));
      window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 7, pointerType: "touch", clientX: 999, clientY: 999 }));
    });
    const afterTouch = await player.boundingBox();
    expect(afterTouch.x).toBeGreaterThanOrEqual(10);
    expect(afterTouch.y).toBeGreaterThanOrEqual(10);
    expect(afterTouch.x + afterTouch.width).toBeLessThanOrEqual(390);
    expect(afterTouch.y + afterTouch.height).toBeLessThanOrEqual(844);

    await page.locator('[data-elo-media-action="toggle-minimize"]').click();
    await expect(player).toHaveAttribute("data-elo-media-minimized", "true");
    await expect(player).toBeVisible();
    expect(await page.evaluate(() => window.EloMediaPlayer.getState())).toBe("PLAYING");
    const minimizedBox = await player.boundingBox();
    const inputBox = await page.locator(".elo-input-row").boundingBox();
    expect(Math.max(0, Math.min(minimizedBox.y + minimizedBox.height, inputBox.y + inputBox.height) - Math.max(minimizedBox.y, inputBox.y))).toBe(0);
    await page.locator(".elo-input").fill("digitando com player recolhido");
    await expect(page.locator(".elo-input")).toHaveValue("digitando com player recolhido");

    await page.setViewportSize({ width: 844, height: 390 });
    const afterRotate = await player.boundingBox();
    expect(afterRotate.x).toBeGreaterThanOrEqual(10);
    expect(afterRotate.y).toBeGreaterThanOrEqual(10);
    expect(afterRotate.x + afterRotate.width).toBeLessThanOrEqual(844);
    expect(afterRotate.y + afterRotate.height).toBeLessThanOrEqual(390);
    expect(await page.evaluate(() => window.EloMediaPlayer.getState())).toBe("PLAYING");
    await expect(page.locator("#elo-real-media-player")).toHaveCount(1);
  });


  test("apk mobile deixa rolagem perceptivel e respeita leitura", async ({ page }) => {
    await openElo(page);
    await sendElo(page, "mensagem inicial para ativar rolagem mobile");
    await page.evaluate(() => {
      for (let index = 0; index < 36; index += 1) {
        window.EloAssistente.appendAssistantMessageForTest("historico " + index, "Mensagem longa de historico " + index + "\nLinha tecnica para criar altura e manter leitura antiga.", false, { responseLifecycle: "historical" });
      }
      window.EloAssistente.updateScrollToBottomForTest();
    });

    const messages = page.locator(".elo-messages");
    await messages.evaluate((node) => { node.scrollTop = node.scrollHeight; });
    const bottom = await messages.evaluate((node) => node.scrollTop);
    await messages.evaluate((node) => { node.scrollTop = Math.max(0, node.scrollTop - 220); node.dispatchEvent(new Event("scroll")); });
    await page.evaluate(() => window.EloAssistente.updateScrollToBottomForTest());
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeVisible();

    const scrolled = await messages.evaluate((node) => ({
      scrollTop: node.scrollTop,
      scrollHeight: node.scrollHeight,
      clientHeight: node.clientHeight,
      paddingRight: getComputedStyle(node).paddingRight,
      scrollbarWidth: getComputedStyle(node).scrollbarWidth || "auto"
    }));
    expect(scrolled.scrollHeight).toBeGreaterThan(scrolled.clientHeight);
    expect(scrolled.scrollTop).toBeLessThan(bottom);
    expect(["thin", "auto", ""].includes(scrolled.scrollbarWidth)).toBe(true);

    await page.evaluate(() => {
      window.EloAssistente.appendAssistantMessageForTest("mensagem enquanto le", "Nova resposta sem puxar quem esta lendo acima.", false, { responseLifecycle: "new" });
      window.EloAssistente.updateScrollToBottomForTest();
    });
    const afterAppend = await messages.evaluate((node) => ({ scrollTop: node.scrollTop, distanceFromBottom: node.scrollHeight - node.clientHeight - node.scrollTop }));
    expect(afterAppend.distanceFromBottom).toBeGreaterThan(48);
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeVisible();

    const buttonBox = await page.locator("[data-elo-scroll-bottom]").boundingBox();
    const inputBox = await page.locator(".elo-input-row").boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(inputBox.y + 4);

    await page.locator("[data-elo-scroll-bottom]").click();
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeHidden();
    const atEnd = await messages.evaluate((node) => node.scrollHeight - node.clientHeight - node.scrollTop);
    expect(atEnd).toBeLessThanOrEqual(54);

    await page.setViewportSize({ width: 390, height: 520 });
    await messages.evaluate((node) => { node.scrollTop = Math.max(0, node.scrollTop - 180); node.dispatchEvent(new Event("scroll")); });
    await page.evaluate(() => window.EloAssistente.updateScrollToBottomForTest());
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeVisible();
    const keyboardButton = await page.locator("[data-elo-scroll-bottom]").boundingBox();
    const keyboardInput = await page.locator(".elo-input-row").boundingBox();
    expect(keyboardButton.y + keyboardButton.height).toBeLessThanOrEqual(keyboardInput.y + 4);

    await page.evaluate(() => {
      HTMLMediaElement.prototype.play = function () {
        this.dispatchEvent(new Event("playing"));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () { this.dispatchEvent(new Event("pause")); };
    });
    await page.evaluate(async () => {
      await window.EloMediaPlayer.play({
        source: "LOCAL_CLASSICAL",
        title: "Fur Elise",
        files: [{ url: "relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg", type: "audio/ogg" }]
      });
    });
    await expect(page.locator("#elo-real-media-player")).toBeVisible();
    const playerBox = await page.locator("#elo-real-media-player").boundingBox();
    const visibleButton = await page.locator("[data-elo-scroll-bottom]").boundingBox();
    const overlap = Math.max(0, Math.min(playerBox.x + playerBox.width, visibleButton.x + visibleButton.width) - Math.max(playerBox.x, visibleButton.x)) * Math.max(0, Math.min(playerBox.y + playerBox.height, visibleButton.y + visibleButton.height) - Math.max(playerBox.y, visibleButton.y));
    expect(overlap).toBe(0);

    await page.setViewportSize({ width: 844, height: 390 });
    await messages.evaluate((node) => { node.scrollTop = Math.max(0, node.scrollTop - 160); node.dispatchEvent(new Event("scroll")); });
    await page.evaluate(() => window.EloAssistente.updateScrollToBottomForTest());
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeVisible();
    await page.locator("[data-elo-scroll-bottom]").click();
    await expect(page.locator("[data-elo-scroll-bottom]")).toBeHidden();
  });
  test("apk reabre preservando conversa e draft anonimos", async ({ page, context }) => {
    await openElo(page);
    await sendElo(page, "preco atual do cimento em Salvador");
    await page.locator(".elo-input").fill("draft que deve voltar ao abrir o app");
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.close();

    const reopened = await context.newPage();
    await openElo(reopened, { width: 390, height: 844 }, { preserveContinuityStorage: true });
    await expect(reopened.locator(".elo-message.user")).toContainText([/preco atual do cimento em Salvador/i]);
    await expect(reopened.locator(".elo-message.assistant:not(.is-typing)")).toContainText([/Resultado pesquisado/i]);
    await expect(reopened.locator(".elo-input")).toHaveValue("draft que deve voltar ao abrir o app");
    const keys = await reopened.evaluate(() => Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key) => key && key.startsWith("elo_core_surface_state_v1::anon_")));
    expect(keys.length).toBeGreaterThan(0);
  });

  test("nova conversa limpa estado persistente ao reabrir", async ({ page, context }) => {
    await openElo(page);
    await sendElo(page, "me motive hoje");
    await page.locator(".elo-input").fill("draft descartavel");
    await page.evaluate(() => window.EloAssistente.clearLocalConversationForTest());
    await expect(page.locator(".elo-input")).toHaveValue("");
    await expect(page.locator(".elo-message.user")).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.close();

    const reopened = await context.newPage();
    await openElo(reopened, { width: 390, height: 844 }, { preserveContinuityStorage: true });
    await expect(reopened.locator(".elo-input")).toHaveValue("");
    await expect(reopened.locator(".elo-message.user")).toHaveCount(0);
    await expect(reopened.locator(".elo-messages")).not.toContainText(/Resposta de teste para: me motive hoje/i);
  });

  test("persistencia local nao mistura conversa entre usuarios", async ({ page, context }) => {
    await page.addInitScript(() => {
      localStorage.setItem("elo_core_auth_context_v1", JSON.stringify({ userId: "usuario-a", profile: { email: "a@elo.local" } }));
      window.ELO_AUTH_CONTEXT = { userId: "usuario-a", profile: { email: "a@elo.local" } };
    });
    await openElo(page);
    await sendElo(page, "conversa privada do usuario A");
    await page.locator(".elo-input").fill("draft privado A");
    await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
    await page.close();

    const reopened = await context.newPage();
    await reopened.addInitScript(() => {
      localStorage.setItem("elo_core_auth_context_v1", JSON.stringify({ userId: "usuario-b", profile: { email: "b@elo.local" } }));
      window.ELO_AUTH_CONTEXT = { userId: "usuario-b", profile: { email: "b@elo.local" } };
    });
    await openElo(reopened, { width: 390, height: 844 }, { preserveContinuityStorage: true });
    await expect(reopened.locator(".elo-input")).toHaveValue("");
    await expect(reopened.locator(".elo-message.user")).toHaveCount(0);
    const scopes = await reopened.evaluate(() => ({
      current: window.EloAssistente.getStorageIdentityScopeForTest(),
      keys: Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).filter((key) => key && key.startsWith("elo_core_surface_state_v1::user_"))
    }));
    expect(scopes.current).toContain("usuario-b");
    expect(scopes.keys.some((key) => key.includes("usuario-a"))).toBe(true);
  });
  test("apk mobile nao corta topo perfil composer ou input", async ({ page }) => {
    await openElo(page, { width: 390, height: 844 });

    async function visualMetrics() {
      return await page.evaluate(() => {
        function box(selector) {
          const node = document.querySelector(selector);
          if (!node) return null;
          const rect = node.getBoundingClientRect();
          return { top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left, width: rect.width, height: rect.height };
        }
        const header = box(".elo-product-top");
        const shell = box(".elo-product-shell");
        const auth = box(".elo-local-auth");
        const composer = box(".elo-input-row");
        const input = box(".elo-input");
        const send = box(".elo-send-button");
        const brandLabel = box(".elo-brand-name");
        return {
          width: window.innerWidth,
          height: window.innerHeight,
          header,
          shell,
          auth,
          composer,
          input,
          send,
          brandLabel,
          visibleAuth: !!document.querySelector(".elo-local-auth") && getComputedStyle(document.querySelector(".elo-local-auth")).display !== "none",
          clippedComposerText: !!input && !!composer && (input.top < composer.top || input.bottom > composer.bottom),
          sendClipped: !!send && !!composer && (send.top < composer.top || send.bottom > composer.bottom),
          topOverlap: !!header && header.top < 6,
          firstContentUnderHeader: !!header && !!composer && composer.top <= header.bottom
        };
      });
    }

    let metrics = await visualMetrics();
    console.log("ELO_APK_VISUAL_PORTRAIT", JSON.stringify(metrics));
    expect(metrics.visibleAuth).toBe(true);
    expect(metrics.topOverlap).toBe(false);
    expect(metrics.firstContentUnderHeader).toBe(false);
    expect(metrics.clippedComposerText).toBe(false);
    expect(metrics.sendClipped).toBe(false);
    expect(metrics.auth.left).toBeGreaterThanOrEqual(0);
    expect(metrics.auth.right).toBeLessThanOrEqual(metrics.width);
    await expect(page.locator(".elo-input")).toBeVisible();
    await page.locator(".elo-input").fill("draft visual mobile");
    await expect(page.locator(".elo-input")).toHaveValue("draft visual mobile");

    await page.setViewportSize({ width: 390, height: 520 });
    metrics = await visualMetrics();
    console.log("ELO_APK_VISUAL_KEYBOARD", JSON.stringify(metrics));
    expect(metrics.visibleAuth).toBe(true);
    expect(metrics.topOverlap).toBe(false);
    expect(metrics.clippedComposerText).toBe(false);
    expect(metrics.sendClipped).toBe(false);

    await page.setViewportSize({ width: 844, height: 390 });
    metrics = await visualMetrics();
    console.log("ELO_APK_VISUAL_LANDSCAPE", JSON.stringify(metrics));
    expect(metrics.visibleAuth).toBe(true);
    expect(metrics.topOverlap).toBe(false);
    expect(metrics.clippedComposerText).toBe(false);
    expect(metrics.sendClipped).toBe(false);
  });

  test("desktop mantem fluxo basico", async ({ page }) => {
    await openElo(page, { width: 1366, height: 768 });
    await sendElo(page, "me motive hoje");
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toBeVisible();
    await expect(page.locator("[data-elo-typing='true']")).toHaveCount(0);
  });
});
