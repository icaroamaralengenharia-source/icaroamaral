import { expect, test } from "@playwright/test";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const ROOT_DIR = process.cwd();
const STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

let staticServer = null;
let APP_ORIGIN = "";
let APP_URL = "";

function startStockFullStaticServer() {
  return new Promise((resolveServer, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
      const relativePath = requestUrl.pathname === "/" ? "stockfull.html" : requestUrl.pathname.slice(1);
      const filePath = normalize(join(ROOT_DIR, relativePath));
      if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + sep)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }
      response.writeHead(200, { "Content-Type": MIME_TYPES[extname(filePath)] || "application/octet-stream" });
      createReadStream(filePath).pipe(response);
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolveServer(server));
  });
}

async function installStockFullHarness(target) {
  await target.addInitScript(() => {
    window.sessionStorage.setItem("icaro_site_access_v2", JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000
    }));
  });
  await target.route("https://cdn.jsdelivr.net/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/javascript", body: "" });
  });
  await target.route("https://fonts.googleapis.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/css", body: "" });
  });
  await target.route("https://fonts.gstatic.com/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "font/woff2", body: "" });
  });
}

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


function stockFullNfeXml(options = {}) {
  const secondItem = options.secondItem === false ? "" : `
      <det nItem="2">
        <prod>
          <cProd>SKU-002</cProd>
          <xProd>Tubo PVC 100mm</xProd>
          <NCM>39172300</NCM>
          <uCom>UN</uCom>
          <qCom>3.0000</qCom>
          <vUnCom>55.9900</vUnCom>
          <vProd>167.9700</vProd>
        </prod>
      </det>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe29260612345678000199550010000012341000012345" versao="4.00">
      <ide>
        <cUF>29</cUF>
        <nNF>1234</nNF>
        <dhEmi>2026-08-03T10:20:30-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor Teste Ltda</xNome>
      </emit>
      <det nItem="1">
        <prod>
          <cProd>SKU-001</cProd>
          <xProd>Cimento CP II</xProd>
          <NCM>25232910</NCM>
          <uCom>SC</uCom>
          <qCom>10.5000</qCom>
          <vUnCom>35.1234567890</vUnCom>
          <vProd>368.7962962845</vProd>
        </prod>
      </det>
      ${secondItem}
    </infNFe>
  </NFe>
</nfeProc>`;
}

async function seedStockFullProduct(page) {
  await page.evaluate(() => {
    window.localStorage.setItem(window.StockFullCore.storageKey, JSON.stringify({
      stockEnvironments: [{ id: "env_company_manoel_importados", companyId: "company_manoel_importados", environmentName: "Estoque principal" }],
      activeStockEnvironmentId: "env_company_manoel_importados",
      items: [{ id: "prod_cimento", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", name: "Cimento cadastrado", sku: "SKU-001", unit: "SC", initialQuantity: 0, currentStock: 0 }],
      movements: [],
      auditLog: []
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

test.describe("Stock Full SaaS - fase A cirurgica", () => {
  test.beforeAll(async () => {
    staticServer = await startStockFullStaticServer();
    APP_ORIGIN = "http://127.0.0.1:" + staticServer.address().port;
    APP_URL = APP_ORIGIN + "/stockfull.html";
  });

  test.afterAll(async () => {
    if (!staticServer) return;
    await new Promise((resolveClose) => staticServer.close(resolveClose));
    staticServer = null;
  });

  test.beforeEach(async ({ page }) => {
    await installStockFullHarness(page);
  });

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

  test("mobile sem rolagem horizontal nem botao cortado", async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));

    for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
      await page.setViewportSize(viewport);
      await openApp(page, "manoel", { clearStorage: true });
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
      await expect(page.locator("#stockFullDashboard")).toBeVisible();
      await expect(page.locator("[data-almox-action=\"entry\"]").first()).toBeVisible();
      await expect(page.locator("[data-almox-action=\"exit\"]").first()).toBeVisible();
      await expect(page.locator("#stockFullSyncDetails")).toBeVisible();
      await expect(page.locator("#stockFullSyncNowButton")).toBeVisible();
    }

    expect(pageErrors).toEqual([]);
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
    await page.route("https://backend.example/api/stock-full/sync", async (route) => {
      requests.push({ url: route.request().url(), body: route.request().postDataJSON() });
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, results: [{ offline_uuid: "op_backend_1", status: "synced", movement_id: "entry_remote" }] })
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
    expect(requests[0].url).toBe("https://backend.example/api/stock-full/sync");
    expect(requests[0].body.movements).toHaveLength(1);
    expect(requests[0].body.movements[0].type).toBe("entrada");
    expect(requests[0].body.movements[0].operationId).toBe("op_backend_1");
    expect(requests[0].body.movements[0].offlineUuid).toBe("op_backend_1");
  });

  test("fila offline de saida persiste apos reload e sincroniza com offlineUuid", async ({ page }) => {
    const requests = [];
    await page.route("https://backend.example/api/stock-full/sync", async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, results: [{ offline_uuid: "op_exit_reload", status: "duplicate", movement_id: "exit_remote" }] })
      });
    });
    await page.addInitScript(() => {
      window.STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
      window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: "token.test" }, access_token: "token.test" }));
      window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "backend", userId: "user_backend", userName: "Funcionario Backend", companyId: "inst_backend", companyName: "Empresa Backend", role: "funcionario" }));
    });
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => {
      window.localStorage.removeItem(window.StockFullSync.storageKeys.queue);
      window.localStorage.removeItem(window.StockFullSync.storageKeys.syncedMovements);
      window.StockFullSync.enqueue("stock:exit", { id: "mov_exit_reload", itemId: "prod_backend", quantity: 2 }, { operationId: "op_exit_reload", companyId: "inst_backend" });
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue()[0].status)).toBe("pending");
    await expect(page.locator("#stockFullLivePendingList")).toContainText("Pendente");
    await page.evaluate(() => window.StockFullSync.processQueue());
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue()[0].status)).toBe("synced");
    expect(requests).toHaveLength(1);
    expect(requests[0].movements).toHaveLength(1);
    expect(requests[0].movements[0].type).toBe("saida");
    expect(requests[0].movements[0].operationId).toBe("op_exit_reload");
    expect(requests[0].movements[0].offlineUuid).toBe("op_exit_reload");
  });

  test("painel ao vivo do patrao renderiza saida online", async ({ page }) => {
    await page.route("https://backend.example/api/stock-full/live", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, exits: [{ id: "exit_live_1", itemName: "Caneta azul", quantity: 3, unit: "un", employeeName: "Funcionario A", currentQuantity: 7, createdAt: "2026-06-08T10:00:00.000Z" }] })
      });
    });
    await page.addInitScript(() => {
      window.STOCK_FULL_API_BASE_URL = "https://backend.example/api/stock-full";
      window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: "token.test" }, access_token: "token.test" }));
      window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "backend", userId: "admin_backend", userName: "Patrao Backend", companyId: "inst_backend", companyName: "Empresa Backend", role: "patrao" }));
    });
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#stockFullLivePanel")).toBeVisible();
    await expect(page.locator("#stockFullLiveList")).toContainText("Caneta azul", { timeout: 5000 });
    await expect(page.locator("#stockFullLiveList")).toContainText("Funcionario A");
    await expect(page.locator("#stockFullLiveList")).toContainText("Saldo: 7");
  });


  test("dois clientes simulados compartilham produto e saldo pelo backend", async ({ browser }) => {
    const remote = { items: [], entries: [], exits: [] };
    async function installRoutes(context) {
      for (const url of [STOCK_FULL_API_BASE_URL + "/items", APP_ORIGIN + "/api/stock-full/items"]) {
        await context.route(url, async (route) => {
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
      }
      for (const url of [STOCK_FULL_API_BASE_URL + "/entries", APP_ORIGIN + "/api/stock-full/entries"]) {
        await context.route(url, async (route) => {
          const body = route.request().postDataJSON();
          const item = remote.items[0];
          item.currentQuantity = Number(item.currentQuantity || 0) + Number(body.quantity || 0);
          await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, entry: { id: "entry_shared" }, item }) });
        });
      }
    }

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    await installStockFullHarness(contextA);
    await installStockFullHarness(contextB);
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

  test("Stock Full NF-e review carrega XML valido por arquivo", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await page.locator("#stockFullNfeXmlInput").setInputFiles({ name: "nfe.xml", mimeType: "application/xml", buffer: Buffer.from(stockFullNfeXml()) });

    await expect(page.locator("#stockFullNfeReviewPanel")).toBeVisible();
    await expect(page.locator('[data-stock-full-nfe-header="accessKey"]')).toHaveText("29260612345678000199550010000012341000012345");
    await expect(page.locator('[data-stock-full-nfe-header="number"]')).toHaveText("1234");
    await expect(page.locator('[data-stock-full-nfe-header="supplierName"]')).toHaveText("Fornecedor Teste Ltda");
    await expect(page.locator('[data-stock-full-nfe-item-row]')).toHaveCount(2);
    await expect(page.locator('[data-stock-full-nfe-item-row]').first()).toContainText("Cimento CP II");
  });

  test("Stock Full NF-e review mostra erro de XML invalido", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await page.evaluate(() => window.StockFullNfeReview.loadXmlTextForTest("<NFe><infNFe></NFe>"));

    await expect(page.locator("#stockFullNfeReviewPanel")).toBeVisible();
    await expect(page.locator("#stockFullNfeStatus")).toContainText("XML rejeitado");
    await expect(page.locator('[data-stock-full-nfe-item-row]')).toHaveCount(0);
  });

  test("Stock Full NF-e review relaciona item com produto existente", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    const itemForm = await openModal(page, "item");
    await itemForm.locator('[name="name"]').fill("Cimento cadastrado NF-e");
    await itemForm.locator('[name="category"]').fill("Fiscal");
    await itemForm.locator('[name="unit"]').fill("SC");
    await itemForm.locator('[name="initialQuantity"]').fill("0");
    await itemForm.locator('[name="minimumStock"]').fill("0");
    await submitModal(page, itemForm);
    await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml({ secondItem: false }));

    const productId = await selectByText(page.locator('[data-stock-full-nfe-product-select]').first(), "Cimento cadastrado NF-e");
    const review = await page.evaluate(() => window.StockFullNfeReview.getDraftForTest());
    expect(review.items[0].productId).toBe(productId);
    expect(review.items[0].createProduct).toBe(false);
  });

  test("Stock Full NF-e review marca produto novo sem criar cadastro", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml({ secondItem: false }));

    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    const review = await page.evaluate(() => window.StockFullNfeReview.getDraftForTest());
    const state = await page.evaluate(() => JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey)));
    expect(review.items[0].createProduct).toBe(true);
    expect(state.items || []).toHaveLength(0);
  });

  test("Stock Full NF-e review cancela sem efeito colateral", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await seedStockFullProduct(page);
    const before = await page.evaluate(() => window.localStorage.getItem(window.StockFullCore.storageKey));
    await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml());
    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    await page.locator("#stockFullNfeCancelButton").click();

    await expect(page.locator("#stockFullNfeReviewPanel")).toHaveClass(/is-hidden/);
    expect(await page.evaluate(() => window.StockFullNfeReview.getDraftForTest())).toBeNull();
    expect(await page.evaluate(() => window.localStorage.getItem(window.StockFullCore.storageKey))).toBe(before);
  });

  test("Stock Full NF-e review nao faz fetch, produto ou movimentacao", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await page.evaluate(() => {
      window.__stockFullNfeSideEffects = { fetches: 0, enqueues: 0 };
      const originalFetch = window.fetch.bind(window);
      window.fetch = function () {
        window.__stockFullNfeSideEffects.fetches += 1;
        return originalFetch.apply(window, arguments);
      };
      if (window.StockFullSync && typeof window.StockFullSync.enqueue === "function") {
        const originalEnqueue = window.StockFullSync.enqueue;
        window.StockFullSync.enqueue = function () {
          window.__stockFullNfeSideEffects.enqueues += 1;
          return originalEnqueue.apply(window.StockFullSync, arguments);
        };
      }
    });
    const before = await page.evaluate(() => JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey)));
    await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml());
    const after = await page.evaluate(() => JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey)));
    const sideEffects = await page.evaluate(() => window.__stockFullNfeSideEffects);

    expect(sideEffects).toEqual({ fetches: 0, enqueues: 0 });
    expect(after.items || []).toHaveLength((before.items || []).length);
    expect(after.movements || []).toHaveLength((before.movements || []).length);
  });
});
