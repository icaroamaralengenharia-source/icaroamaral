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

async function readStockFullState(page) {
  return page.evaluate(() => JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey) || "{}"));
}

async function readStockFullQueue(page) {
  return page.evaluate(() => window.StockFullSync.getQueue());
}

async function clearStockFullQueue(page) {
  await page.evaluate(() => window.localStorage.removeItem(window.StockFullSync.storageKeys.queue));
}

async function createStockFullProductThroughModal(page, name = "Cimento cadastrado NF-e") {
  const itemForm = await openModal(page, "item");
  await itemForm.locator('[name="name"]').fill(name);
  await itemForm.locator('[name="category"]').fill("Fiscal");
  await itemForm.locator('[name="unit"]').fill("SC");
  await itemForm.locator('[name="initialQuantity"]').fill("0");
  await itemForm.locator('[name="minimumStock"]').fill("0");
  await submitModal(page, itemForm);
  await clearStockFullQueue(page);
}
async function loadSingleItemNfe(page) {
  await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml({ secondItem: false }));
}

async function confirmLoadedNfe(page) {
  const result = await page.evaluate(() => window.StockFullNfeReview.confirmForTest());
  await expect(page.locator("#stockFullNfeResults")).toBeVisible();
  return result;
}


async function seedStockFullManagementReportData(page) {
  await page.evaluate(() => {
    const now = new Date().toISOString();
    window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "local", userId: "user_manoel", userName: "Manoel Gerente", userEmail: "manoel@manoelimportados.com", companyId: "company_manoel_importados", companyName: "Manoel Importados", role: "admin" }));
    window.localStorage.setItem(window.StockFullCore.storageKey, JSON.stringify({
      stockEnvironments: [
        { id: "env_company_manoel_importados", companyId: "company_manoel_importados", mode: "almoxarifado", clientName: "Cliente Antigo Nao Usar", unitName: "Matriz Centro", environmentName: "Estoque principal", responsible: "Manoel Gerente" },
        { id: "env_company_loja_teste_sul", companyId: "company_loja_teste_sul", mode: "almoxarifado", clientName: "Loja Teste Sul", unitName: "Filial Sul", environmentName: "Estoque sul", responsible: "Loja Sul" }
      ],
      activeStockEnvironmentId: "env_company_manoel_importados",
      items: [
        { id: "prod_cimento_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", name: "Cimento PDF", sku: "CIM-PDF", unit: "SC", initialQuantity: 5, minimumStock: 10 },
        { id: "prod_tubo_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", name: "Tubo PDF", sku: "TUB-PDF", unit: "UN", initialQuantity: 0, minimumStock: 2 },
        { id: "prod_outro_tenant", companyId: "company_loja_teste_sul", environmentId: "env_company_loja_teste_sul", name: "Produto Tenant Sul", sku: "SUL-001", unit: "UN", initialQuantity: 999, minimumStock: 1 }
      ],
      movements: [
        { id: "mov_entry_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", itemId: "prod_cimento_pdf", type: "entrada", quantity: 12, responsible: "Manoel Gerente", supplier: "Fornecedor Manual", documentNumber: "NF-100", origin: "manual_entry", deviceId: "caixa-desktop-01", operationId: "op_entry_pdf", offlineUuid: "off_entry_pdf", syncStatus: "synced", balanceBefore: 5, balanceAfter: 17, movementDateTime: "2026-08-03T09:00:00", createdAt: now },
        { id: "mov_exit_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", itemId: "prod_cimento_pdf", type: "saida", quantity: 4, responsible: "Joao Estoque", recipient: "Balcao", sector: "Loja", origin: "manual_exit", deviceId: "tablet-loja-02", operationId: "op_exit_pdf", offlineUuid: "off_exit_pdf", syncStatus: "pending", balanceBefore: 17, balanceAfter: 13, movementDateTime: "2026-08-03T10:00:00", createdAt: now },
        { id: "mov_adjust_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", itemId: "prod_tubo_pdf", type: "entrada", quantity: 2, responsible: "Manoel Gerente", reason: "Ajuste inventario", origin: "adjustment", deviceId: "admin-note-03", operationId: "op_adjust_pdf", offlineUuid: "off_adjust_pdf", syncStatus: "synced", balanceBefore: 0, balanceAfter: 2, movementDateTime: "2026-08-03T11:00:00", createdAt: now },
        { id: "mov_nfe_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", itemId: "prod_tubo_pdf", type: "entrada", quantity: 7, responsible: "Manoel Gerente", supplier: "Fornecedor PDF Ltda", documentNumber: "29260612345678000199550010000012341000012345", nfeAccessKey: "29260612345678000199550010000012341000012345", nfeNumber: "1234", origin: "nfe_import", deviceId: "xml-import-04", operationId: "op_nfe_pdf", offlineUuid: "off_nfe_pdf", syncStatus: "synced", balanceBefore: 2, balanceAfter: 9, movementDateTime: "2026-08-03T12:00:00", createdAt: now },
        { id: "mov_exit_inconsistent_pdf", companyId: "company_manoel_importados", environmentId: "env_company_manoel_importados", itemId: "prod_tubo_pdf", type: "saida", quantity: 1, responsible: "", origin: "manual_exit", deviceId: "offline-celular-05", operationId: "op_conflict_pdf", offlineUuid: "off_conflict_pdf", syncStatus: "conflict", balanceBefore: 9, balanceAfter: 8, movementDateTime: "2026-08-03T13:00:00", createdAt: now },
        { id: "mov_other_tenant", companyId: "company_loja_teste_sul", environmentId: "env_company_loja_teste_sul", itemId: "prod_outro_tenant", type: "entrada", quantity: 999, responsible: "Loja Sul", supplier: "Fornecedor Sul", origin: "nfe_import", nfeNumber: "9999", nfeAccessKey: "99999999999999999999999999999999999999999999", deviceId: "tenant-sul-device", operationId: "op_other_tenant", offlineUuid: "off_other_tenant", syncStatus: "synced", balanceBefore: 999, balanceAfter: 1998, movementDateTime: "2026-08-03T12:00:00", createdAt: now }
      ],
      alertHistory: [], auditLog: []
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

async function seedStockFullManagementUnitScenario(page, options) {
  const config = Object.assign({
    companyId: "company_manoel_importados",
    companyName: "Manoel Importados",
    environmentId: "env_company_manoel_importados",
    unitName: "Matriz Centro",
    otherCompanyId: "company_loja_teste_sul",
    otherCompanyName: "Loja Teste Sul",
    otherEnvironmentId: "env_company_loja_teste_sul",
    otherUnitName: "Filial Sul",
    items: [],
    otherItems: []
  }, options || {});
  await page.evaluate((scenario) => {
    const normalizeItem = (item, companyId, environmentId) => Object.assign({}, item, {
      companyId,
      environmentId,
      currentStock: item.currentStock ?? item.initialQuantity ?? 0,
      minimumStock: item.minimumStock ?? item.minStock ?? 0
    });
    const activeItems = scenario.items.map((item) => normalizeItem(item, scenario.companyId, scenario.environmentId));
    const externalItems = scenario.otherItems.map((item) => normalizeItem(item, scenario.otherCompanyId, scenario.otherEnvironmentId));
    window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "local", userId: "user_pdf_unit", userName: "Gestor PDF", userEmail: "gestor.pdf@teste.local", companyId: scenario.companyId, companyName: scenario.companyName, role: "admin" }));
    window.localStorage.setItem(window.StockFullCore.storageKey, JSON.stringify({
      stockEnvironments: [
        { id: scenario.environmentId, companyId: scenario.companyId, mode: "almoxarifado", clientName: scenario.companyName, unitName: scenario.unitName, environmentName: "Estoque PDF", responsible: "Gestor PDF" },
        { id: scenario.otherEnvironmentId, companyId: scenario.otherCompanyId, mode: "almoxarifado", clientName: scenario.otherCompanyName, unitName: scenario.otherUnitName, environmentName: "Estoque PDF B", responsible: "Gestor B" }
      ],
      activeStockEnvironmentId: scenario.environmentId,
      items: activeItems.concat(externalItems),
      movements: [],
      alertHistory: [],
      auditLog: []
    }));
  }, config);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

async function getStockFullManagementReportForTest(page) {
  return page.evaluate(() => ({ html: window.StockFullManagementPdf.buildHtmlForTest(), model: window.StockFullManagementPdf.buildViewModelForTest() }));
}

function getStockFullManagementMetric(model, label) {
  return (model.metrics || []).find((metric) => metric.label === label);
}

function expectNoStockFullPaginationArtifacts(html) {
  expect(html).not.toContain("Pagina 0");
  expect(html).not.toContain("Página 0");
  expect(html).not.toContain("Pagina NaN");
  expect(html).not.toContain("Página NaN");
  expect(html).not.toContain("Pagina undefined");
  expect(html).not.toContain("Página undefined");
  expect(html).not.toContain("page-number");
  expect(html).not.toContain("counter(page)");
  expect(html).not.toContain("counter(pages)");
}

function countHtmlOccurrences(html, value) {
  return (html.match(new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
}

async function appendStockFullReportRowsForPagination(page, count = 80) {
  await page.evaluate((totalRows) => {
    const state = JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey) || "{}");
    const companyId = "company_manoel_importados";
    const environmentId = "env_company_manoel_importados";
    const now = new Date().toISOString();
    const items = Array.from({ length: totalRows }, (_, index) => ({
      id: `prod_page_${index}`,
      companyId,
      environmentId,
      name: `Produto paginado ${String(index + 1).padStart(2, "0")}`,
      sku: `PAGE-${String(index + 1).padStart(2, "0")}`,
      unit: index % 2 ? "CX" : "UN",
      initialQuantity: 20 + index,
      currentStock: 20 + index,
      minimumStock: 1
    }));
    const movements = items.map((item, index) => ({
      id: `mov_page_${index}`,
      companyId,
      environmentId,
      itemId: item.id,
      type: index % 3 === 0 ? "saida" : "entrada",
      quantity: 1 + (index % 5),
      responsible: index % 3 === 0 ? "Joao Estoque" : "Manoel Gerente",
      supplier: "Fornecedor Paginacao",
      origin: index % 4 === 0 ? "nfe_import" : "manual_entry",
      documentNumber: `NF-PAGE-${index}`,
      nfeAccessKey: index % 4 === 0 ? `292606123456780001995500100000${String(index).padStart(8, "0")}` : "",
      deviceId: `device-page-${index}`,
      operationId: `op_page_${index}`,
      offlineUuid: `off_page_${index}`,
      syncStatus: "synced",
      balanceBefore: 20 + index,
      balanceAfter: 21 + index,
      movementDateTime: "2026-08-03T12:00:00",
      createdAt: now
    }));
    state.items = items.concat((state.items || []).filter((item) => item.companyId !== companyId || !String(item.id || "").startsWith("prod_page_")));
    state.movements = movements.concat((state.movements || []).filter((movement) => movement.companyId !== companyId || !String(movement.id || "").startsWith("mov_page_")));
    window.localStorage.setItem(window.StockFullCore.storageKey, JSON.stringify(state));
  }, count);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#stockFullDashboard")).toBeVisible();
}

async function waitForStockFullReportFilters(page) {
  await expect(page.locator("#stockFullReportProduct option", { hasText: "Cimento PDF" })).toHaveCount(1);
  await expect(page.locator("#stockFullReportUser option", { hasText: "Joao Estoque" })).toHaveCount(1);
}

async function selectStockFullReportProductByLabel(page, label) {
  const value = await page.locator("#stockFullReportProduct option", { hasText: label }).first().getAttribute("value");
  expect(value).toBeTruthy();
  await page.selectOption("#stockFullReportProduct", value);
}
async function setStockFullSession(page, session) {
  await page.evaluate((nextSession) => {
    window.StockFullCore.setSession(Object.assign({ isAuthenticated: true, mode: "local" }, nextSession));
  }, session);
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
  test("Stock Full NF-e confirmacao registra entrada para produto existente pelo fluxo oficial", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await createStockFullProductThroughModal(page);
    await loadSingleItemNfe(page);
    const productId = await selectByText(page.locator('[data-stock-full-nfe-product-select]').first(), "Cimento cadastrado NF-e");

    const result = await confirmLoadedNfe(page);
    const state = await readStockFullState(page);
    const queue = await readStockFullQueue(page);
    const movement = state.movements.find((candidate) => candidate.origin === "nfe_import");
    const balance = await page.evaluate((itemId) => {
      const stored = JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey) || "{}");
      return window.StockFullStock.getItemBalance({ id: itemId }, stored.movements || []);
    }, productId);

    expect(result.ok).toBe(true);
    expect(movement).toMatchObject({ itemId: productId, type: "entrada", documentNumber: "29260612345678000199550010000012341000012345", companyId: "company_manoel_importados" });
    expect(movement.operationId).toContain("stock:entry:nfe:");
    expect(movement.offlineUuid).toBe(movement.operationId);
    expect(balance).toBe(10.5);
    expect(queue.map((item) => item.operation)).toEqual(["nfe:confirm"]);
    expect(queue[0].payload.product).toBeNull();
    expect(queue[0].payload.movement.documentNumber).toBe(movement.documentNumber);
  });

  test("Stock Full NF-e confirmacao cria produto novo e entrada oficial sem saldo direto", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check();

    const result = await confirmLoadedNfe(page);
    const state = await readStockFullState(page);
    const queue = await readStockFullQueue(page);
    const product = state.items.find((item) => item.name === "Cimento CP II");
    const movement = state.movements.find((candidate) => candidate.origin === "nfe_import");
    const balance = await page.evaluate((itemId) => {
      const stored = JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey) || "{}");
      return window.StockFullStock.getItemBalance({ id: itemId }, stored.movements || []);
    }, product.id);

    expect(result.ok).toBe(true);
    expect(product.id).toContain("tmp_product_nfe_");
    expect(product.currentStock).toBe(0);
    expect(movement.itemId).toBe(product.id);
    expect(balance).toBe(10.5);
    expect(queue.map((item) => item.operation)).toEqual(["nfe:confirm"]);
    expect(queue[0].payload.nfeAccessKey).toBe("29260612345678000199550010000012341000012345");
    expect(queue[0].payload.product.name).toBe("Cimento CP II");
  });

  test("Stock Full NF-e confirmacao bloqueia duplicidade por empresa e aceita mesma chave em outra empresa", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    expect((await confirmLoadedNfe(page)).ok).toBe(true);

    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    const duplicate = await confirmLoadedNfe(page);
    expect(duplicate.ok).toBe(false);
    expect(duplicate.errors.join(" ")).toContain("ja confirmada");

    await setStockFullSession(page, {
      userId: "user_sul_admin",
      userName: "Loja Sul",
      userEmail: "sul@lojateste.com",
      companyId: "company_loja_teste_sul",
      companyName: "Loja Teste Sul",
      role: "admin"
    });
    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    expect((await confirmLoadedNfe(page)).ok).toBe(true);

    const state = await readStockFullState(page);
    expect(state.movements.filter((movement) => movement.origin === "nfe_import" && movement.companyId === "company_loja_teste_sul")).toHaveLength(1);
  });

  test("Stock Full NF-e confirmacao falha sem confirmacao parcial silenciosa", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await createStockFullProductThroughModal(page);
    const before = await readStockFullState(page);
    await page.evaluate((xml) => window.StockFullNfeReview.loadXmlTextForTest(xml), stockFullNfeXml());
    await selectByText(page.locator('[data-stock-full-nfe-product-select]').first(), "Cimento cadastrado NF-e");

    const result = await confirmLoadedNfe(page);
    const after = await readStockFullState(page);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("Item 2");
    expect(after.items).toEqual(before.items);
    expect(after.movements).toEqual(before.movements);
  });

  test("Stock Full NF-e confirmacao offline preserva idempotencia e sincroniza depois", async ({ page, context }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await context.setOffline(true);
    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check();
    expect((await confirmLoadedNfe(page)).ok).toBe(true);
    const queue = await readStockFullQueue(page);
    expect(queue.map((item) => item.operation)).toEqual(["nfe:confirm"]);
    expect(queue[0].payload.nfeAccessKey).toBe("29260612345678000199550010000012341000012345");
    expect(queue[0].payload.product.name).toBe("Cimento CP II");
    expect(queue.every((item) => item.operationId && item.payload.offlineUuid)).toBe(true);

    await context.setOffline(false);
    const synced = await page.evaluate(async () => {
      window.__stockFullNfeSyncCalls = [];
      window.StockFullSync.configure({ transport: {
        async confirmNfe(payload) {
          window.__stockFullNfeSyncCalls.push({ type: "nfe:confirm", payload });
          return { ok: true, status: "synced", entry: { id: "remote_entry_nfe_1" }, item: { id: "remote_prod_nfe_1" } };
        },
        async createProduct(payload) {
          window.__stockFullNfeSyncCalls.push({ type: "product:create", payload });
          return { ok: true, remoteId: "remote_prod_nfe_1", item: { id: "remote_prod_nfe_1" } };
        },
        async updateProduct(payload) {
          window.__stockFullNfeSyncCalls.push({ type: "product:update", payload });
          return { ok: true, remoteId: payload.id };
        },
        async createEntry(payload) {
          window.__stockFullNfeSyncCalls.push({ type: "stock:entry", payload });
          return { ok: true, remoteId: "remote_entry_nfe_1", entry: { id: "remote_entry_nfe_1" } };
        },
        async createExit(payload) {
          window.__stockFullNfeSyncCalls.push({ type: "stock:exit", payload });
          return { ok: true, remoteId: payload.id };
        }
      } });
      await window.StockFullSync.processQueue();
      return { queue: window.StockFullSync.getQueue(), calls: window.__stockFullNfeSyncCalls };
    });

    expect(synced.queue.every((item) => item.status === "synced")).toBe(true);
    expect(synced.calls.map((call) => call.type)).toEqual(["nfe:confirm"]);
    expect(synced.calls[0].payload.movement.itemId).toContain("tmp_product_nfe_");
    expect(synced.calls[0].payload.movement.operationId).toContain("stock:entry:nfe:");
    expect(synced.calls[0].payload.movement.documentNumber).toBe("29260612345678000199550010000012341000012345");
    expect(synced.calls[0].payload.movement.offlineUuid).toContain("stock:entry:nfe:");
  });

  test("Stock Full NF-e confirmacao respeita permissao do usuario", async ({ page }) => {
    await openApp(page, "manoel", { clearStorage: true });
    await setStockFullSession(page, {
      userId: "user_carla_vendas",
      userName: "Carla Vendas",
      userEmail: "carla@manoelimportados.com",
      companyId: "company_manoel_importados",
      companyName: "Manoel Importados",
      role: "vendedor"
    });
    await loadSingleItemNfe(page);
    await page.locator('[data-stock-full-nfe-create-new]').first().check({ force: true });

    const result = await confirmLoadedNfe(page);
    const state = await readStockFullState(page);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("sem permissao");
    expect(state.movements || []).toHaveLength(0);
  });

  test("PDF gerencial Stock Full contem conteudo profissional, A4 e isolamento", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await page.locator("#stockFullReportPeriod").selectOption("all");
    const result = await page.evaluate(() => ({ html: window.StockFullManagementPdf.buildHtmlForTest(), model: window.StockFullManagementPdf.buildViewModelForTest() }));
    expect(result.model.profile.companyName).toBe("Manoel Importados");
    expect(result.model.profile.unitName).toBe("Matriz Centro");
    expect(result.html).toContain("Relatorio Gerencial - Stock Full");
    expect(result.html).toContain("Resumo executivo");
    expect(result.html).toContain("Total de produtos");
    expect(result.html).toContain("Produtos com saldo");
    expect(result.html).not.toContain("Saldo total</span>");
    expect(result.html).not.toContain("21 un.");
    expect(getStockFullManagementMetric(result.model, "Produtos com saldo").value).toBe("2");
    expect(result.html).toContain("multiplas unidades de medida");
    expect(result.html).toContain("Itens zerados");
    expect(result.html).toContain("Abaixo do minimo");
    expect(result.html).toContain("Movimentacoes por produto");
    expect(result.html).toContain("Ultimas movimentacoes");
    expect(result.html).toContain("NF-e importadas no periodo");
    expect(result.html).toContain("Fornecedor PDF Ltda");
    expect(result.html).toContain("29260612...00012345");
    expect(result.html).toContain("@page{size:A4");
    expect(result.html).toContain("Stock Full - relatorio gerencial sem segredos ou dados de outro tenant.");
    expect(countHtmlOccurrences(result.html, "Stock Full - relatorio gerencial sem segredos ou dados de outro tenant.")).toBe(1);
    expectNoStockFullPaginationArtifacts(result.html);
    expect(result.html).toContain("thead{display:table-header-group}");
    expect(result.html).toContain("break-inside:avoid");
    expect(result.html).not.toContain("Produto Tenant Sul");
    expect(result.html).not.toContain("Loja Teste Sul");
    expect(result.html).not.toContain("9999");
    expect(result.html).not.toContain("Cliente Antigo Nao Usar");
  });

  test("PDF gerencial Stock Full mostra saldo total quando todos os produtos usam UN", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementUnitScenario(page, {
      items: [
        { id: "prod_un_01", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Parafuso UN", sku: "UN-001", unit: "UN", initialQuantity: 10, minimumStock: 1 },
        { id: "prod_un_02", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Bucha UN", sku: "UN-002", unit: "un", initialQuantity: 5, minimumStock: 1 }
      ]
    });
    const result = await getStockFullManagementReportForTest(page);
    expect(getStockFullManagementMetric(result.model, "Saldo total").value).toBe("15 UN");
    expect(result.html).toContain("Saldo total");
    expect(result.html).toContain("15 UN");
    expect(result.html).not.toContain("Produtos com saldo");
  });

  test("PDF gerencial Stock Full mostra saldo total com unidade unica CX sem unidade generica", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementUnitScenario(page, {
      items: [
        { id: "prod_cx_01", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Caixa fechada CX", sku: "CX-001", unit: "CX", initialQuantity: 12, minimumStock: 1 },
        { id: "prod_cx_02", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Caixa avulsa CX", sku: "CX-002", unit: "cx", initialQuantity: 3, minimumStock: 1 }
      ]
    });
    const result = await getStockFullManagementReportForTest(page);
    expect(getStockFullManagementMetric(result.model, "Saldo total").value).toBe("15 CX");
    expect(result.html).toContain("15 CX");
    expect(result.html).not.toContain("15 un.");
    expect(result.html).not.toContain("15 unidade(s)");
  });

  test("PDF gerencial Stock Full nao soma 642 un quando ha unidades heterogeneas", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementUnitScenario(page, {
      items: [
        { id: "prod_unit_un", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto UN", sku: "MIX-UN", unit: "UN", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_cx", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto CX", sku: "MIX-CX", unit: "CX", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_kg", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto KG", sku: "MIX-KG", unit: "KG", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_l", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto L", sku: "MIX-L", unit: "L", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_m", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto M", sku: "MIX-M", unit: "M", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_sc", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto SC", sku: "MIX-SC", unit: "SC", initialQuantity: 100, minimumStock: 1 },
        { id: "prod_unit_zero", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto zerado", sku: "MIX-ZERO", unit: "UN", initialQuantity: 0, minimumStock: 1 },
        { id: "prod_unit_negative", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto negativo", sku: "MIX-NEG", unit: "CX", initialQuantity: -8, minimumStock: 1 },
        { id: "prod_unit_empty", companyId: "company_pdf_unit_a", environmentId: "env_pdf_unit_a", name: "Produto sem unidade", sku: "MIX-EMPTY", unit: "   ", initialQuantity: 50, minimumStock: 1 }
      ]
    });
    const result = await getStockFullManagementReportForTest(page);
    expect(getStockFullManagementMetric(result.model, "Produtos com saldo").value).toBe("7");
    expect(result.model.metrics.some((metric) => metric.label === "Saldo total")).toBe(false);
    expect(result.html).toContain("Produtos com saldo");
    expect(result.html).toContain("multiplas unidades de medida");
    expect(result.html).not.toContain("Saldo total</span>");
    expect(result.html).not.toContain("642 un.");
    expect(result.html).not.toContain("saldo total de 642 unidade(s)");
    expect(getStockFullManagementMetric(result.model, "Itens zerados").value).toBe("2");
  });




  test("PDF gerencial Stock Full calcula empresas A e B separadamente", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementUnitScenario(page, {
      companyId: "company_manoel_importados",
      companyName: "Manoel Importados",
      environmentId: "env_company_manoel_importados",
      unitName: "Matriz Centro",
      otherCompanyId: "company_loja_teste_sul",
      otherCompanyName: "Loja Teste Sul",
      otherEnvironmentId: "env_company_loja_teste_sul",
      otherUnitName: "Filial Sul",
      items: [
        { id: "prod_alfa_un", name: "Alfa Produto UN", sku: "ALFA-UN", unit: "UN", initialQuantity: 11, minimumStock: 1 }
      ],
      otherItems: [
        { id: "prod_beta_cx", name: "Beta Produto CX", sku: "BETA-CX", unit: "CX", initialQuantity: 22, minimumStock: 1 }
      ]
    });
    const alfa = await getStockFullManagementReportForTest(page);
    expect(alfa.model.profile.companyName).toBe("Manoel Importados");
    expect(getStockFullManagementMetric(alfa.model, "Saldo total").value).toBe("11 UN");
    expect(alfa.html).not.toContain("Beta Produto CX");

    await seedStockFullManagementUnitScenario(page, {
      companyId: "company_loja_teste_sul",
      companyName: "Loja Teste Sul",
      environmentId: "env_company_loja_teste_sul",
      unitName: "Filial Sul",
      otherCompanyId: "company_manoel_importados",
      otherCompanyName: "Manoel Importados",
      otherEnvironmentId: "env_company_manoel_importados",
      otherUnitName: "Matriz Centro",
      items: [
        { id: "prod_beta_cx", name: "Beta Produto CX", sku: "BETA-CX", unit: "CX", initialQuantity: 22, minimumStock: 1 }
      ],
      otherItems: [
        { id: "prod_alfa_un", name: "Alfa Produto UN", sku: "ALFA-UN", unit: "UN", initialQuantity: 11, minimumStock: 1 }
      ]
    });
    const beta = await getStockFullManagementReportForTest(page);
    expect(beta.model.profile.companyName).toBe("Loja Teste Sul");
    expect(getStockFullManagementMetric(beta.model, "Saldo total").value).toBe("22 CX");
    expect(beta.html).not.toContain("Alfa Produto UN");
  });
  test("PDF gerencial Stock Full aplica filtros de produto, usuario e tipo", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await waitForStockFullReportFilters(page);
    await page.selectOption("#stockFullReportPeriod", "all");
    await selectStockFullReportProductByLabel(page, "Cimento PDF");
    await page.selectOption("#stockFullReportUser", "Joao Estoque");
    await page.selectOption("#stockFullReportType", "saida");
    const result = await page.evaluate(() => ({ html: window.StockFullManagementPdf.buildHtmlForTest(), model: window.StockFullManagementPdf.buildViewModelForTest() }));
    expect(result.model.filters.product).toBe("Cimento PDF");
    expect(result.model.filters.user).toBe("Joao Estoque");
    expect(result.model.filters.type).toBe("Saidas");
    expect(result.html).toContain("Cimento PDF");
    expect(result.html).toContain("Joao Estoque");
    expect(result.html).not.toContain("Fornecedor PDF Ltda");
    expect(result.html).not.toContain("Tubo PDF</td>");
    expect(getStockFullManagementMetric(result.model, "Total de produtos").value).toBe("1");
    expect(getStockFullManagementMetric(result.model, "Saldo total").value).toBe("13 SC");
    expect(result.html).not.toContain("Produtos com saldo");
  });


  test("PDF gerencial Stock Full funciona no mobile com filtros reais", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await waitForStockFullReportFilters(page);
    await page.selectOption("#stockFullReportPeriod", "all");
    await selectStockFullReportProductByLabel(page, "Cimento PDF");
    await page.selectOption("#stockFullReportUser", "Joao Estoque");
    await page.selectOption("#stockFullReportType", "saida");
    await page.evaluate(() => {
      window.__stockFullOpenedHtml = "";
      window.open = function () { return { document: { open() {}, write(html) { window.__stockFullOpenedHtml = html; }, close() {} } }; };
    });
    await page.locator("#almoxDownloadPdfButton").click();
    const html = await page.evaluate(() => window.__stockFullOpenedHtml);
    expect(html).toContain("data-stock-full-management-pdf");
    expect(html).toContain("Cimento PDF");
    expect(html).toContain("Joao Estoque");
    expect(html).not.toContain("Produto Tenant Sul");
  });

  test("botao Baixar PDF abre o gerencial proprio do Stock Full", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await page.evaluate(() => {
      window.__stockFullOpenedHtml = "";
      window.open = function () { return { document: { open() {}, write(html) { window.__stockFullOpenedHtml = html; }, close() {} } }; };
    });
    await page.locator("#almoxDownloadPdfButton").click();
    const html = await page.evaluate(() => window.__stockFullOpenedHtml);
    expect(html).toContain("data-stock-full-management-pdf");
    expect(html).toContain("Relatorio Gerencial - Stock Full");
    expect(html).toContain("Manoel Importados");
    expect(html).toContain("window.print");
    expect(html).not.toContain("Relatorio Stock IA - Almoxarifado");
  });



  test("PDF de auditoria Stock Full contem rastreabilidade completa e isolamento", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await waitForStockFullReportFilters(page);
    await page.selectOption("#stockFullReportPeriod", "all");
    const result = await page.evaluate(() => ({ html: window.StockFullAuditPdf.buildHtmlForTest(), model: window.StockFullAuditPdf.buildViewModelForTest() }));
    expect(result.model.profile.companyName).toBe("Manoel Importados");
    expect(result.model.profile.unitName).toBe("Matriz Centro");
    expect(result.html).toContain("Relatorio de Auditoria - Stock Full");
    expect(result.html).toContain("Resumo da auditoria");
    expect(result.html).toContain("Movimentacoes auditadas");
    expect(result.html).toContain("Saldo ant.");
    expect(result.html).toContain("Saldo post.");
    expect(result.html).toContain("operation_id");
    expect(result.html).toContain("offline_uuid");
    expect(result.html).toContain("tablet-loja-02");
    expect(result.html).toContain("op_exit_pdf");
    expect(result.html).toContain("off_exit_pdf");
    expect(result.html).toContain("pending");
    expect(result.html).toContain("conflict");
    expect(result.html).toContain("Saida sem responsavel");
    expect(result.html).toContain("Saida sem setor/destino");
    expect(result.html).toContain("Fornecedor PDF Ltda");
    expect(result.html).toContain("29260612...00012345");
    expect(result.html).toContain("@page{size:A4");
    expect(result.html).toContain("Stock Full - auditoria sem segredos ou dados de outro tenant.");
    expect(countHtmlOccurrences(result.html, "Stock Full - auditoria sem segredos ou dados de outro tenant.")).toBe(1);
    expectNoStockFullPaginationArtifacts(result.html);
    expect(result.html).toContain("thead{display:table-header-group}");
    expect(result.html).toContain("break-inside:avoid");
    expect(result.html).not.toContain("Produto Tenant Sul");
    expect(result.html).not.toContain("Loja Teste Sul");
    expect(result.html).not.toContain("op_other_tenant");
  });

  test("PDFs Stock Full extensos nao usam contador interno de pagina", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await appendStockFullReportRowsForPagination(page, 90);
    await page.selectOption("#stockFullReportPeriod", "all");
    const result = await page.evaluate(() => ({
      managementHtml: window.StockFullManagementPdf.buildHtmlForTest(),
      auditHtml: window.StockFullAuditPdf.buildHtmlForTest(),
      managementModel: window.StockFullManagementPdf.buildViewModelForTest(),
      auditModel: window.StockFullAuditPdf.buildViewModelForTest()
    }));
    expect(result.managementModel.tables.movementByProduct.length).toBeGreaterThan(40);
    expect(result.auditModel.movements.length).toBeGreaterThan(40);
    expect(result.managementHtml).toContain("Produto paginado 90");
    expect(result.auditHtml).toContain("op_page_89");
    expect(result.managementHtml).toContain("Stock Full - relatorio gerencial sem segredos ou dados de outro tenant.");
    expect(result.auditHtml).toContain("Stock Full - auditoria sem segredos ou dados de outro tenant.");
    expect(countHtmlOccurrences(result.managementHtml, "Stock Full - relatorio gerencial sem segredos ou dados de outro tenant.")).toBe(1);
    expect(countHtmlOccurrences(result.auditHtml, "Stock Full - auditoria sem segredos ou dados de outro tenant.")).toBe(1);
    expectNoStockFullPaginationArtifacts(result.managementHtml);
    expectNoStockFullPaginationArtifacts(result.auditHtml);
  });

  test("PDF de auditoria Stock Full calcula saldo anterior e posterior", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await waitForStockFullReportFilters(page);
    await page.selectOption("#stockFullReportPeriod", "all");
    await page.selectOption("#stockFullReportProduct", "");
    await page.selectOption("#stockFullReportUser", "");
    await page.selectOption("#stockFullReportType", "all");
    const model = await page.evaluate(() => window.StockFullAuditPdf.buildViewModelForTest());
    const cimentoEntrada = model.movements.find((row) => row[14] === "op_entry_pdf");
    const cimentoSaida = model.movements.find((row) => row[14] === "op_exit_pdf");
    const nfe = model.movements.find((row) => row[14] === "op_nfe_pdf");
    const inconsistent = model.movements.find((row) => row[14] === "op_conflict_pdf");
    expect(cimentoEntrada[6]).toBe("5");
    expect(cimentoEntrada[7]).toBe("17");
    expect(cimentoSaida[6]).toBe("17");
    expect(cimentoSaida[7]).toBe("13");
    expect(nfe[6]).toBe("2");
    expect(nfe[7]).toBe("9");
    expect(inconsistent[6]).toBe("9");
    expect(inconsistent[7]).toBe("8");
  });

  test("PDF de auditoria Stock Full aplica filtros reais", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await waitForStockFullReportFilters(page);
    await page.selectOption("#stockFullReportPeriod", "all");
    await selectStockFullReportProductByLabel(page, "Cimento PDF");
    await page.selectOption("#stockFullReportUser", "Joao Estoque");
    await page.selectOption("#stockFullReportType", "saida");
    const result = await page.evaluate(() => ({ html: window.StockFullAuditPdf.buildHtmlForTest(), model: window.StockFullAuditPdf.buildViewModelForTest() }));
    expect(result.model.filters.product).toBe("Cimento PDF");
    expect(result.model.filters.user).toBe("Joao Estoque");
    expect(result.model.filters.type).toBe("Saidas");
    expect(result.model.movements).toHaveLength(1);
    expect(result.html).toContain("op_exit_pdf");
    expect(result.html).not.toContain("op_nfe_pdf");
    expect(result.html).not.toContain("Tubo PDF</td>");
  });

  test("botao Gerar auditoria abre PDF de auditoria separado no desktop e mobile", async ({ page }) => {
    await openApp(page, "manoel");
    await seedStockFullManagementReportData(page);
    await page.evaluate(() => {
      window.__stockFullOpenedHtml = "";
      window.open = function () { return { document: { open() {}, write(html) { window.__stockFullOpenedHtml = html; }, close() {} } }; };
    });
    await page.locator("#almoxManagerAuditButton").click();
    const desktopHtml = await page.evaluate(() => window.__stockFullOpenedHtml);
    expect(desktopHtml).toContain("data-stock-full-audit-pdf");
    expect(desktopHtml).toContain("Relatorio de Auditoria - Stock Full");
    expect(desktopHtml).not.toContain("data-stock-full-management-pdf");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { window.__stockFullOpenedHtml = ""; });
    await page.locator("#almoxManagerAuditButton").click();
    const mobileHtml = await page.evaluate(() => window.__stockFullOpenedHtml);
    expect(mobileHtml).toContain("data-stock-full-audit-pdf");
    expect(mobileHtml).toContain("window.print");
  });});
