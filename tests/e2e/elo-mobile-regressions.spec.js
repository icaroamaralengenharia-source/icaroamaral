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

  test("desktop mantem fluxo basico", async ({ page }) => {
    await openElo(page, { width: 1366, height: 768 });
    await sendElo(page, "me motive hoje");
    await expect(page.locator(".elo-message.assistant:not(.is-typing)").last()).toBeVisible();
    await expect(page.locator("[data-elo-typing='true']")).toHaveCount(0);
  });
});
