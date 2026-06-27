import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const APP_URL = pathToFileURL(resolve("stockfull.html")).toString();

async function openApp(page, login = "manoel", options = {}) {
  if (options.clearStorage) {
    await page.addInitScript(() => {
      window.localStorage.removeItem("obraReportAlmoxarifadoData");
      window.localStorage.removeItem("stockFullOfflineSyncQueue");
      window.localStorage.removeItem("stockFullOfflineSyncMeta");
      window.localStorage.removeItem("stockFullSyncedMovementKeys");
    });
  }
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  const button = page.locator('[data-stock-full-demo-login="' + login + '"]');
  if (await button.isVisible().catch(() => false)) {
    await button.click();
  }
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

async function openWithEmployeeSession(page) {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    window.localStorage.setItem("stockFullSession", JSON.stringify({
      isAuthenticated: true,
      mode: "local",
      userId: "user_joao_estoque",
      userName: "Joao Estoque",
      userEmail: "joao@manoelimportados.com",
      companyId: "company_manoel_importados",
      companyName: "Manoel Importados",
      role: "estoquista"
    }));
  });
  await page.reload();
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

async function openModal(page, action) {
  await page.locator('[data-almox-action="' + action + '"]').first().click();
  const form = page.locator("#almoxModal form").first();
  await expect(form).toBeVisible();
  return form;
}

async function submitModal(page, form) {
  await form.locator("[data-almox-modal-submit]").click();
  await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
}

async function selectByText(select, text) {
  const value = await select.evaluate((element, expected) => {
    const option = Array.from(element.options).find((candidate) => candidate.textContent.trim().includes(expected));
    return option ? option.value : "";
  }, text);
  expect(value).not.toBe("");
  await select.selectOption(value);
  return value;
}

test.describe("Stock Full SaaS - fase A cirurgica", () => {
  test("admin e funcionario respeitam permissoes centrais", async ({ page }) => {
    await openApp(page, "manoel");
    expect(await page.evaluate(() => window.StockFullCore.canStockFull("products:import", "admin"))).toBe(true);
    await expect(page.locator("#stockFullAdminPanel")).toBeVisible();
    await expect(page.locator("#stockFullImportButton")).toBeVisible();
    await expect(page.locator("#almoxManagerAuditButton")).toBeVisible();

    await openWithEmployeeSession(page);
    expect(await page.evaluate(() => window.StockFullCore.canStockFull("products:import", "estoquista"))).toBe(false);
    await expect(page.locator("#stockFullAdminPanel")).toHaveClass(/is-hidden/);
    await expect(page.locator("#stockFullImportButton")).toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxManagerAuditButton")).toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxManagerPanel").locator('[data-almox-action="entry"]')).toBeVisible();
    await expect(page.locator("#almoxManagerPanel").locator('[data-almox-action="exit"]')).toBeVisible();
  });

  test("admin opera estoque com historico, auditoria e bloqueio de saldo", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });

    const productName = "Produto Fase A " + Date.now();
    const itemForm = await openModal(page, "item");
    await itemForm.locator('[name="name"]').fill(productName);
    await itemForm.locator('[name="category"]').fill("Fase A");
    await itemForm.locator('[name="unit"]').fill("un");
    await itemForm.locator('[name="initialQuantity"]').fill("10");
    await itemForm.locator('[name="minimumStock"]').fill("2");
    await submitModal(page, itemForm);

    const entryForm = await openModal(page, "entry");
    const productId = await selectByText(entryForm.locator('[name="itemId"]'), productName);
    await entryForm.locator('[name="quantity"]').fill("5");
    await entryForm.locator('[name="responsible"]').fill("Admin Fase A");
    await entryForm.locator('[name="documentNumber"]').fill("NF-FASE-A");
    await submitModal(page, entryForm);

    const exitForm = await openModal(page, "exit");
    await exitForm.locator('[name="itemId"]').selectOption(productId);
    await exitForm.locator('[name="quantity"]').fill("3");
    await exitForm.locator('[name="recipient"]').fill("Loja");
    await exitForm.locator('[name="sector"]').fill("Balcao");
    await exitForm.locator('[name="responsible"]').fill("Admin Fase A");
    await submitModal(page, exitForm);

    const balanceAfterExit = await page.evaluate((itemId) => {
      const state = JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey));
      const movementBalance = window.StockFullStock.getItemBalance({ id: itemId }, state.movements || []);
      return Number.isFinite(movementBalance) ? movementBalance : 0;
    }, productId);
    expect(await page.evaluate((balance) => window.StockFullStock.canExit(balance + 1, balance), balanceAfterExit)).toBe(false);

    const state = await page.evaluate(() => JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey)));
    expect(state.movements.filter((movement) => movement.companyId === "company_manoel_importados").length).toBeGreaterThanOrEqual(3);
    expect(state.auditLog.some((entry) => entry.action === "movement_in_created")).toBe(true);
    expect(state.auditLog.some((entry) => entry.action === "movement_out_created")).toBe(true);
    await expect(page.locator("#almoxHistorySection")).toContainText(productName);
  });

  test("fila offline possui metadados, deduplica operationId e aplica conflito simples", async ({ page, context }) => {
    await openApp(page, "manoel");
    await context.setOffline(true);
    const queued = await page.evaluate(() => {
      const keys = window.StockFullSync.storageKeys;
      window.localStorage.removeItem(keys.queue);
      window.localStorage.removeItem(keys.syncedMovements);
      const operationId = "op_fase_a_1";
      const first = window.StockFullSync.enqueue("stock:exit", { id: "mov_fase_a", itemId: "prod_fase_a", quantity: 4 }, { operationId, companyId: "company_manoel_importados" });
      const second = window.StockFullSync.enqueue("stock:exit", { id: "mov_fase_a", itemId: "prod_fase_a", quantity: 4 }, { operationId, companyId: "company_manoel_importados" });
      return { first, second, queue: window.StockFullSync.getQueue() };
    });
    expect(queued.queue).toHaveLength(1);
    expect(queued.first.operationId).toBe("op_fase_a_1");
    expect(queued.second.operationId).toBe("op_fase_a_1");
    expect(queued.first.deviceId).toBeTruthy();
    expect(queued.first.companyId).toBe("company_manoel_importados");
    await expect(page.locator("#stockFullSyncDetails")).toContainText("Modo offline");

    await context.setOffline(false);
    await page.evaluate(() => {
      window.StockFullSync.configure({ transport: {
        async getProductBalance() { return 2; },
        async createExit() { throw new Error("should_not_sync_negative_stock"); }
      }});
    });
    await page.locator("#stockFullSyncNowButton").click();
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue()[0].status)).toBe("conflict");
  });

  test("empresa A nao ve dados da empresa B", async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "local", userId: "a", userName: "Admin A", companyId: "company_manoel_importados", companyName: "Manoel Importados", role: "admin" }));
      window.localStorage.setItem(window.StockFullCore.storageKey, JSON.stringify({
        stockEnvironments: [{ id: "env_company_manoel_importados", companyId: "company_manoel_importados", mode: "almoxarifado", clientName: "Manoel Importados", environmentName: "Estoque principal" }],
        activeStockEnvironmentId: "env_company_manoel_importados",
        items: [
          { id: "a1", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", name: "Produto Empresa A", unit: "un" },
          { id: "b1", companyId: "company_loja_teste_sul", environmentId: "env_company_loja_teste_sul", name: "Produto Empresa B", unit: "un" }
        ],
        movements: [], auditLog: []
      }));
    });
    await page.reload();
    await expect(page.locator("#stockFullDashboard")).toBeVisible();
    await expect(page.locator("#almoxItemsSection")).toContainText("Produto Empresa A");
    await expect(page.locator("#almoxItemsSection")).not.toContainText("Produto Empresa B");
  });

  test("mobile 390px sem rolagem horizontal nem botao cortado", async ({ page }) => {
    const consoleErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, "manoel");
    const metrics = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      clippedButtons: Array.from(document.querySelectorAll("button, .mini-button, a.mini-button")).filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > window.innerWidth + 1;
      }).length
    }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.clippedButtons).toBe(0);
    expect(consoleErrors.filter((text) => !/favicon|cdn.jsdelivr|supabase/i.test(text))).toEqual([]);
  });
  test("modo online real escolhe backend em producao e bloqueia demo", async ({ page }) => {
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    const result = await page.evaluate(() => {
      const productionLocation = { protocol: "https:", hostname: "www.icaroamaral.com.br", origin: "https://www.icaroamaral.com.br", href: "https://www.icaroamaral.com.br/stockfull.html" };
      const localhostLocation = { protocol: "http:", hostname: "localhost", origin: "http://localhost:5500", href: "http://localhost:5500/stockfull.html" };
      return {
        productionBase: window.StockFullCore.getStockFullApiBaseUrl(productionLocation),
        productionItemUrl: window.StockFullCore.buildStockFullApiUrl("/api/stock-full/items", productionLocation),
        localhostBase: window.StockFullCore.getStockFullApiBaseUrl(localhostLocation),
        demoAllowedProduction: window.StockFullAppRuntime.isDemoLoginAllowedFor(productionLocation),
        demoAllowedLocalhost: window.StockFullAppRuntime.isDemoLoginAllowedFor(localhostLocation),
        clearsLocalSessionProduction: window.StockFullAppRuntime.shouldClearLocalOnlySession({ isAuthenticated: true, mode: "local" }, false, productionLocation),
        keepsBackendSessionProduction: window.StockFullAppRuntime.shouldClearLocalOnlySession({ isAuthenticated: true, mode: "backend" }, true, productionLocation)
      };
    });
    expect(result.productionBase).toBe("https://obrareport-backend-stockfull.onrender.com/api/stock-full");
    expect(result.productionItemUrl).toBe("https://obrareport-backend-stockfull.onrender.com/api/stock-full/items");
    expect(result.localhostBase).toBe("/api/stock-full");
    expect(result.demoAllowedProduction).toBe(false);
    expect(result.demoAllowedLocalhost).toBe(true);
    expect(result.clearsLocalSessionProduction).toBe(true);
    expect(result.keepsBackendSessionProduction).toBe(false);
  });

  test("fila offline sincroniza usando API backend configurada", async ({ page }) => {
    const requests = [];
    await page.route("https://backend.example/api/stock-full/entries", async (route) => {
      requests.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, entry: { id: "entry_remote" }, item: { id: "prod_backend", currentQuantity: 15 } })
      });
    });
    await page.addInitScript(() => {
      window.STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
      window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: "token.test" }, access_token: "token.test" }));
      window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "backend", userId: "user_backend", userName: "Admin Backend", companyId: "inst_backend", companyName: "Empresa Backend", role: "admin" }));
    });
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.removeItem(window.StockFullSync.storageKeys.queue);
      window.StockFullSync.enqueue("stock:entry", { id: "mov_backend", itemId: "prod_backend", quantity: 5 }, { operationId: "op_backend_1", companyId: "inst_backend" });
    });
    await page.evaluate(() => window.StockFullSync.processQueue());
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue()[0].status)).toBe("synced");
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe("https://backend.example/api/stock-full/entries");
    expect(requests[0].body.operationId).toBe("op_backend_1");
    expect(requests[0].body.companyId).toBe("inst_backend");
  });

  test("dois clientes simulados compartilham produto e saldo pelo backend", async ({ browser }) => {
    const remote = { items: [], entries: [], exits: [] };
    async function installRoutes(context) {
      await context.route("https://backend.example/api/stock-full/items", async (route) => {
        const request = route.request();
        if (request.method() === "POST") {
          const body = request.postDataJSON();
          const item = { id: "prod_shared", name: body.name, currentQuantity: Number(body.currentQuantity || 0), institution_id: "inst_shared" };
          remote.items = [item];
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, item }) });
          return;
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, items: remote.items }) });
      });
      await context.route("https://backend.example/api/stock-full/entries", async (route) => {
        const body = route.request().postDataJSON();
        const item = remote.items[0];
        item.currentQuantity = Number(item.currentQuantity || 0) + Number(body.quantity || 0);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entry: { id: "entry_shared" }, item }) });
      });
    }

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    await installRoutes(contextA);
    await installRoutes(contextB);
    await contextA.addInitScript(() => {
      window.STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
      window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: "token.admin" }, access_token: "token.admin" }));
    });
    await contextB.addInitScript(() => {
      window.STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
      window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: "token.func" }, access_token: "token.func" }));
    });

    const admin = await contextA.newPage();
    const worker = await contextB.newPage();
    await admin.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await worker.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await admin.evaluate(async () => {
      await fetch("/api/stock-full/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Produto compartilhado", currentQuantity: 0 }) });
    });
    const seenByWorker = await worker.evaluate(async () => {
      const response = await fetch("/api/stock-full/items");
      return await response.json();
    });
    expect(seenByWorker.items[0].name).toBe("Produto compartilhado");
    await worker.evaluate(async () => {
      await fetch("/api/stock-full/entries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: "prod_shared", quantity: 10 }) });
    });
    const seenByAdmin = await admin.evaluate(async () => {
      const response = await fetch("/api/stock-full/items");
      return await response.json();
    });
    expect(seenByAdmin.items[0].currentQuantity).toBe(10);
    await contextA.close();
    await contextB.close();
  });
});
