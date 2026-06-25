import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PRODUCT_NAMES = [
  "Cimento E2E",
  "Areia E2E",
  "Brita E2E",
  "Vergalhao E2E",
  "Tijolo E2E",
  "Cal E2E",
  "Argamassa E2E",
  "Tinta E2E",
  "Eletroduto E2E",
  "Parafuso E2E"
];

async function loginLocal(page) {
  await page.goto("/relatorio-qualidade-obras.html#app/almoxarifado");
  await page.keyboard.press("Control+F5").catch(() => {});
  await page.waitForLoadState("domcontentloaded");

  if (await page.locator("#loginForm").isVisible().catch(() => false)) {
    await page.locator("[name='userPassword']").fill("ObraReport2026");
    await page.locator("#loginForm").locator("button[type='submit']").click();
  }

  await expect(page.locator("#almoxManagerPanel")).toBeVisible();
}

async function enterStockFullDemo(page) {
  const demoButton = page.locator('[data-stock-full-demo-login="manoel"]');
  if (await demoButton.isVisible().catch(() => false)) {
    await demoButton.click();
  }
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}
async function goToRoute(page, route) {
  await page.evaluate((nextRoute) => {
    window.location.hash = "#app/" + nextRoute;
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }, route);
  await page.waitForTimeout(150);
}

async function submitClient(page) {
  await goToRoute(page, "clientes");
  await expect(page.locator("#clientForm")).toBeVisible();
  await page.locator("#clientForm [name='clientName']").fill("Cliente E2E Almoxarifado");
  await page.locator("#clientForm [name='clientDocument']").fill("00.000.000/0001-00");
  await page.locator("#clientForm [name='clientPhone']").fill("(11) 99999-0000");
  await page.locator("#clientForm [name='clientEmail']").fill("cliente.e2e@obrareport.local");
  await page.locator("#clientForm [name='clientNotes']").fill("Cliente criado pelo E2E do Almoxarifado.");
  await page.locator("#clientForm").locator("button[type='submit']").click();
}

async function submitWork(page) {
  await goToRoute(page, "obras");
  await expect(page.locator("#workForm")).toBeVisible();
  const clientSelect = page.locator("#workForm [name='workClientId']");
  await expect.poll(async () => clientSelect.locator("option").count()).toBeGreaterThan(1);
  await clientSelect.selectOption({ index: 1 });
  await page.locator("#workForm [name='workName']").fill("Obra E2E Almoxarifado");
  await page.locator("#workForm [name='workAddress']").fill("Rua do Teste, 100");
  await page.locator("#workForm [name='workType']").selectOption({ index: 1 });
  await page.locator("#workForm [name='workStatus']").selectOption({ index: 1 }).catch(async () => {
    await page.locator("#workForm [name='workStatus']").fill("Em andamento");
  });
  await page.locator("#workForm").locator("button[type='submit']").click();
}

async function openAlmoxModal(page, action) {
  await page.locator(`[data-almox-action="${action}"]`).first().click();
  const form = page.locator("#almoxModal form").first();
  await expect(form).toBeVisible();
  return form;
}

async function submitAlmoxModal(page, form) {
  await form.locator("[data-almox-modal-submit]").click();
  await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
}

async function selectOptionByText(select, text) {
  const value = await select.evaluate((element, expectedText) => {
    const option = Array.from(element.options).find((candidate) => candidate.textContent.trim().startsWith(expectedText));
    return option ? option.value : "";
  }, text);
  expect(value, `option for ${text}`).not.toBe("");
  await select.selectOption(value);
}

async function createProduct(page, index) {
  const form = await openAlmoxModal(page, "item");
  await form.locator("[name='name']").fill(PRODUCT_NAMES[index]);
  await form.locator("[name='category']").fill("E2E");
  await form.locator("[name='unit']").fill(index === 0 ? "saco" : "un");
  await form.locator("[name='initialQuantity']").fill(String(20 + index));
  await form.locator("[name='minimumStock']").fill(index === 0 ? "40" : "5");
  await form.locator("[name='location']").fill("Almoxarifado E2E");
  await submitAlmoxModal(page, form);
}

async function createEntry(page, index) {
  const form = await openAlmoxModal(page, "entry");
  await selectOptionByText(form.locator("[name='itemId']"), PRODUCT_NAMES[index]);
  await form.locator("[name='quantity']").fill(String(10 + index));
  await form.locator("[name='responsible']").fill("Auditor E2E");
  await form.locator("[name='documentNumber']").fill("NF-E2E-" + String(index + 1).padStart(2, "0"));
  await form.locator("[name='notes']").fill("Entrada criada pelo E2E.");
  await submitAlmoxModal(page, form);
}

async function createExit(page, index, quantity) {
  const form = await openAlmoxModal(page, "exit");
  await selectOptionByText(form.locator("[name='itemId']"), PRODUCT_NAMES[index]);
  await form.locator("[name='quantity']").fill(String(quantity));
  await form.locator("[name='recipient']").fill("Mestre E2E");
  await form.locator("[name='sector']").fill("Obra E2E");
  await form.locator("[name='purpose']").fill("Execucao de servico E2E");
  await form.locator("[name='responsible']").fill("Almoxarife E2E");
  await form.locator("[name='notes']").fill("Saida criada pelo E2E.");
  return form;
}

test.describe("Almoxarifado", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/relatorio-qualidade-obras.html");
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test("fluxo completo de estoque, auditoria, historico, backup e Elo", async ({ page }, testInfo) => {
    await loginLocal(page);
    await submitClient(page);
    await submitWork(page);
    await goToRoute(page, "almoxarifado");
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      await createProduct(page, index);
    }

    await expect(page.locator("#almoxItemsSection")).toContainText(PRODUCT_NAMES[0]);

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      await createEntry(page, index);
    }

    for (let index = 0; index < PRODUCT_NAMES.length; index += 1) {
      const form = await createExit(page, index, index % 3 === 0 ? 5 : 2);
      await submitAlmoxModal(page, form);
    }

    const blockedForm = await createExit(page, 0, 9999);
    await blockedForm.locator("[data-almox-modal-submit]").click();
    await expect(page.locator("#almoxActionMessage")).toContainText(/Saldo insuficiente/i);
    await page.locator("#almoxModal [data-almox-modal-close]").last().click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);

    await page.locator("#almoxManagerPanel a[href='#almoxHistorySection']").click();
    await expect(page.locator("#almoxHistorySection")).toContainText("Mestre E2E");
    await expect(page.locator("#almoxHistorySection")).toContainText("NF-E2E");

    const downloadPromise = page.waitForEvent("download");
    await page.locator("#almoxExportBackupButton").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^stock-full-backup-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.json$/);
    const backupPath = testInfo.outputPath("stock-full-backup.json");
    await download.saveAs(backupPath);
    await expect(page.locator("#almoxActionMessage")).toContainText(/Backup|exportado/i);

    await page.evaluate(() => {
      window.localStorage.removeItem("obraReportAlmoxarifadoData");
    });
    await page.reload();
    await goToRoute(page, "almoxarifado");
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();
    await expect(page.locator("#almoxItemsSection")).not.toContainText(PRODUCT_NAMES[0]);

    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/substituir os dados locais/i);
      await dialog.accept();
    });
    await page.locator("#almoxBackupFileInput").setInputFiles(backupPath);
    await expect(page.locator("#almoxActionMessage")).toContainText(/Backup importado/i);
    await expect(page.locator("#almoxItemsSection")).toContainText(PRODUCT_NAMES[0]);
    await page.locator("#almoxManagerPanel a[href='#almoxHistorySection']").click();
    await expect(page.locator("#almoxHistorySection")).toContainText("Mestre E2E");
    await expect(page.locator("#almoxHistorySection")).toContainText("NF-E2E");

    await page.locator("#almoxSummaryButton").click();
    await expect(page.locator("#almoxGeneratedReport")).not.toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxGeneratedReport")).toContainText(/Resumo|Auditoria|Cimento E2E/i);

    await page.locator("#almoxAuditButton").click();
    await expect(page.locator("#almoxGeneratedReport")).toContainText(/Auditoria|risco|saldo/i);

    await page.locator("[data-almox-elo-action='risk']").click();
    await expect(page.locator("#almoxActionMessage")).toContainText(/Elo|Pergunta enviada/i);

    await page.locator("[data-almox-elo-form] [name='almoxEloQuestion']").fill("Elo, quais itens exigem atencao?");
    await page.locator("[data-almox-elo-form]").evaluate((form) => form.requestSubmit());
    await expect(page.locator("#almoxActionMessage")).toContainText(/Elo|Pergunta enviada/i);

    await expect(page.locator(".almox-elo-card")).toBeVisible();
    await expect(page.locator(".almox-elo-input-row input")).toBeVisible();
    await expect(page.locator("#almoxManagerPanel")).toBeVisible();
  });

  test("Stock Full abre Loja e Gestor reaproveitando o Almoxarifado", async ({ page }) => {
    const stockFullUrl = pathToFileURL(resolve("stock-full.html")).toString();
    await page.goto(stockFullUrl);
    await expect(page.locator("h1")).toHaveText("Controle seu estoque mesmo sem internet.");
    await expect(page.locator("body")).toContainText("Funciona localmente para entrada, saída, saldo e histórico.");

    await page.locator("a", { hasText: "Testar Stock Full" }).first().click();
    await expect(page).toHaveURL(/produto=stock-full/);
    await expect(page).toHaveURL(/perfil=loja/);
    await enterStockFullDemo(page);
    await expect(page.locator("#stockFullDashboard")).toBeVisible();
    await expect(page.locator("#almoxOfflineStatus")).toContainText("Modo local");
    await expect(page.locator("#almoxOfflineStatus")).toContainText(/sincronizado na nuvem/i);
    await expect(page.locator("#stockFullAppTitle")).toContainText("STOCK");
    await expect(page.locator("[data-stock-full-dashboard-action='entry']").first()).toBeVisible();
    await expect(page.locator("[data-stock-full-dashboard-action='exit']").first()).toBeVisible();

    await page.goto(stockFullUrl);
    await page.evaluate(() => {
      window.location.href = "stockfull.html?produto=stock-full&perfil=gestor";
    });
    await expect(page).toHaveURL(/produto=stock-full/);
    await expect(page).toHaveURL(/perfil=gestor/);
    await enterStockFullDemo(page);
    await expect(page.locator("#stockFullDashboard")).toBeVisible();
    await expect(page.locator("[data-stock-full-dashboard-action='entry']").first()).toBeVisible();
    await expect(page.locator("[data-stock-full-dashboard-action='exit']").first()).toBeVisible();
    await expect(page.locator("#almoxManagerAuditButton")).toBeAttached();
    await expect(page.locator("#almoxDownloadPdfButton")).toBeAttached();
  });


  test("fila offline do Stock Full processa pendencias sem duplicar", async ({ page, context }) => {
    const stockFullUrl = pathToFileURL(resolve("stockfull.html")).toString();
    await page.goto(stockFullUrl);
    await enterStockFullDemo(page);
    await context.setOffline(true);

    const queued = await page.evaluate(() => {
      const keys = window.StockFullSync.storageKeys;
      window.localStorage.removeItem(keys.queue);
      window.localStorage.removeItem(keys.meta);
      window.localStorage.removeItem(keys.idMap);
      window.localStorage.removeItem(keys.syncedMovements);
      const productId = window.StockFullSync.createTemporaryId("product");
      const entryId = window.StockFullSync.createTemporaryId("movement");
      const exitId = window.StockFullSync.createTemporaryId("movement");
      window.StockFullSync.enqueue("product:create", {
        id: productId,
        name: "Produto Offline E2E",
        unit: "un",
        category: "Offline",
        initialQuantity: 10,
        currentStock: 10,
        minimumStock: 2,
        updatedAt: "2026-06-24T10:00:00.000Z"
      }, { localOperationKey: "product:create:" + productId });
      window.StockFullSync.enqueue("stock:entry", {
        id: entryId,
        itemId: productId,
        productId,
        type: "entrada",
        quantity: 5,
        responsible: "E2E",
        createdAt: "2026-06-24T10:01:00.000Z"
      }, { localOperationKey: "stock:entry:" + entryId });
      window.StockFullSync.enqueue("stock:exit", {
        id: exitId,
        itemId: productId,
        productId,
        type: "saida",
        quantity: 3,
        responsible: "E2E",
        createdAt: "2026-06-24T10:02:00.000Z"
      }, { localOperationKey: "stock:exit:" + exitId });
      return {
        productId,
        queue: window.StockFullSync.getQueue(),
        canBlockInvalidExit: window.StockFullStock.canExit(999, 12) === false
      };
    });

    expect(queued.productId).toMatch(/^tmp_product_/);
    expect(queued.queue).toHaveLength(3);
    expect(queued.queue.map((item) => item.status)).toEqual(["pending", "pending", "pending"]);
    expect(queued.canBlockInvalidExit).toBe(true);
    await expect(page.locator("#stockFullSyncStatus")).toContainText(/Offline|Pendente/i);
    await expect(page.locator("#stockFullSyncDetails")).toContainText("3 pendência");

    await context.setOffline(false);
    await page.evaluate(() => {
      const calls = [];
      window.__stockFullSyncCalls = calls;
      window.StockFullSync.configure({
        transport: {
          async createProduct(payload) {
            calls.push({ type: "product", id: payload.id });
            return { ok: true, item: { id: "remote_product_e2e" } };
          },
          async createEntry(payload) {
            calls.push({ type: "entry", itemId: payload.itemId });
            return { ok: true, entry: { id: "remote_entry_e2e" } };
          },
          async createExit(payload) {
            calls.push({ type: "exit", itemId: payload.itemId });
            return { ok: true, exit: { id: "remote_exit_e2e" } };
          }
        }
      });
    });

    await Promise.all([
      page.locator("#stockFullSyncNowButton").click(),
      page.locator("#stockFullSyncNowButton").click().catch(() => {})
    ]);
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue().every((item) => item.status === "synced"))).toBe(true);

    const result = await page.evaluate(() => ({
      calls: window.__stockFullSyncCalls,
      queue: window.StockFullSync.getQueue(),
      map: window.StockFullSync.getIdMap(),
      meta: window.StockFullSync.getMeta()
    }));
    expect(result.calls).toEqual([
      { type: "product", id: queued.productId },
      { type: "entry", itemId: queued.productId },
      { type: "exit", itemId: queued.productId }
    ]);
    expect(result.map[queued.productId]).toBe("remote_product_e2e");
    expect(result.meta.pendingCount).toBe(0);
    await expect(page.locator("#stockFullSyncStatus")).toContainText("Online");

    await page.locator("#stockFullSyncNowButton").click();
    const callsAfterSecondSync = await page.evaluate(() => window.__stockFullSyncCalls.length);
    expect(callsAfterSecondSync).toBe(3);
  });

  test.skip("Stock Full autenticado carrega produtos remotos sem alterar movimentacoes", async ({ page }) => {
    let createPayload = null;

    await page.route("**/api/stock-full/me", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          module: "stock-full",
          mode: "remote",
          user: { id: "auth_e2e", email: "gestor@stockfull.local" },
          profile: {
            id: "profile_e2e",
            institution_id: "inst_e2e",
            unit_id: "unit_e2e",
            name: "Gestor Stock Full",
            email: "gestor@stockfull.local",
            role: "gestor"
          }
        })
      });
    });

    await page.route("**/api/stock-full/items", async (route) => {
      if (route.request().method() === "POST") {
        createPayload = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            ok: true,
            mode: "remote",
            item: {
              id: "remote_item_created",
              institution_id: "inst_e2e",
              name: createPayload.name,
              unit: createPayload.unit,
              category: createPayload.category,
              minQuantity: createPayload.minQuantity,
              currentQuantity: createPayload.currentQuantity,
              location: createPayload.location,
              notes: createPayload.notes,
              isActive: true
            }
          })
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          mode: "remote",
          items: [
            {
              id: "remote_item_1",
              institution_id: "inst_e2e",
              name: "Produto remoto E2E",
              unit: "un",
              category: "Papelaria",
              minQuantity: 3,
              currentQuantity: 9,
              location: "Prateleira 1",
              notes: "",
              isActive: true
            }
          ]
        })
      });
    });

    await page.evaluate(() => {
      const payload = JSON.stringify({
        currentSession: { access_token: "valid.token.e2e" }
      });
      window.localStorage.setItem("sb-stock-full-auth-token", payload);
      window.sessionStorage.setItem("sb-stock-full-auth-token", payload);
    });

    await page.goto("/relatorio-qualidade-obras.html?produto=stock-full&perfil=loja#app/almoxarifado");
    await expect(page.locator("#almoxOfflineStatus")).toContainText("Produtos sincronizados na nuvem");
    await expect(page.locator("#almoxOfflineStatus")).toContainText("Movimentações ainda locais");
    await expect(page.locator("#almoxItemsSection")).toContainText("Produto remoto E2E");

    await openAlmoxModal(page, "item");
    const form = page.locator("#almoxModal form");
    await form.locator("[name='name']").fill("Produto remoto criado E2E");
    await form.locator("[name='category']").fill("Eletronicos");
    await form.locator("[name='unit']").fill("un");
    await form.locator("[name='initialQuantity']").fill("4");
    await form.locator("[name='minimumStock']").fill("2");
    await form.locator("[name='location']").fill("Balcao");
    await submitAlmoxModal(page, form);

    await expect(page.locator("#almoxItemsSection")).toContainText("Produto remoto criado E2E");
    expect(createPayload).toMatchObject({
      name: "Produto remoto criado E2E",
      unit: "un",
      category: "Eletronicos",
      minQuantity: 2,
      currentQuantity: 4,
      location: "Balcao"
    });
  });
});
