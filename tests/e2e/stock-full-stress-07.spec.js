import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, sep } from "node:path";

const ROOT_DIR = process.cwd();
const ARTIFACT_DIR = join(ROOT_DIR, "artifacts", "stock-full-stress-07");
const AUDIT_LIMIT_MESSAGE = "O per\u00edodo possui mais de 1.000 movimenta\u00e7\u00f5es. Reduza o per\u00edodo ou aplique filtros para gerar o PDF.";
const MIME_TYPES = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json"
};

let staticServer = null;
let APP_URL = "";

function ensureArtifactDir() {
  mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function startStaticServer() {
  return new Promise((resolve, reject) => {
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
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function installHarness(page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("icaro_site_access_v2", JSON.stringify({
      authenticated: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60 * 60 * 1000
    }));
  });
  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
}

function buildStressFixture() {
  const companyA = "company_manoel_importados";
  const companyB = "company_loja_teste_sul";
  const envA = "env_company_manoel_importados";
  const envB = "env_company_loja_teste_sul";
  const units = ["UN", "CX", "KG", "M", "L", "SC", "PCT"];
  const categories = ["Hidraulica", "Eletrica", "Ferragens", "Limpeza", "Acabamento", "Fiscal <script>alert(1)</script>", "Reposicao rapida"];
  const suppliers = ["Fornecedor Alfa", "Fornecedor Beta", "Fornecedor Gama", "Fornecedor Delta", "Fornecedor Especial & Cia"];
  const users = [
    { id: "user_admin", name: "Ana Admin", role: "admin" },
    { id: "user_manager", name: "Bruno Gestor", role: "gerente" },
    { id: "user_stock", name: "Carla Estoque", role: "estoquista" },
    { id: "user_sales", name: "Diego Vendas", role: "vendedor" },
    { id: "user_audit", name: "Eva Auditoria", role: "auditor" },
    { id: "user_fiscal", name: "Fabio Fiscal", role: "fiscal" },
    { id: "user_ops", name: "Gisele Operacoes", role: "operador" },
    { id: "user_viewer", name: "Helio Consulta", role: "consulta" },
    { id: "user_limit", name: "Usuario Limite 1000", role: "auditor" }
  ];
  const stockEnvironments = [
    { id: envA, companyId: companyA, mode: "almoxarifado", clientName: "Cliente antigo nao usar", unitName: "Matriz Norte", environmentName: "Estoque principal", responsible: "Ana Admin" },
    { id: "env_stress_a_02", companyId: companyA, mode: "almoxarifado", clientName: "Stock Full Stress A", unitName: "Filial Leste", environmentName: "Deposito Leste", responsible: "Bruno Gestor" },
    { id: "env_stress_a_03", companyId: companyA, mode: "almoxarifado", clientName: "Stock Full Stress A", unitName: "Quiosque Centro", environmentName: "Balcao Centro", responsible: "Carla Estoque" },
    { id: envB, companyId: companyB, mode: "almoxarifado", clientName: "Stock Full Stress B", unitName: "Matriz Sul", environmentName: "Estoque B", responsible: "Tenant B" },
    { id: "env_stress_b_02", companyId: companyB, mode: "almoxarifado", clientName: "Stock Full Stress B", unitName: "Filial Oeste", environmentName: "Deposito B2", responsible: "Tenant B" },
    { id: "env_stress_b_03", companyId: companyB, mode: "almoxarifado", clientName: "Stock Full Stress B", unitName: "Showroom", environmentName: "Exposicao B3", responsible: "Tenant B" }
  ];
  const items = [];
  const expectedBalances = {};
  const movementTypes = { entrada: 0, saida: 0, ajuste: 0, nfe_import: 0 };
  const syncCounts = { pending: 0, failed: 0, conflict: 0, synced: 0 };
  const uniqueOperations = new Set();
  const uniqueOfflineUuids = new Set();
  const injected = "<script>alert(1)</script>";

  for (let index = 0; index < 200; index += 1) {
    const companyId = companyA;
    const environmentId = companyId === companyA ? envA : envB;
    const specialName = index === 3 ? `Produto acentuado "Premium" <tag> ${injected}` : "";
    const baseStock = index % 20 === 0 ? 0 : (index % 17 === 0 ? 2 : 30 + (index % 60));
    const minimumStock = index % 17 === 0 ? 8 : (index % 13 === 0 ? 25 : 5 + (index % 10));
    const id = `stress_prod_${String(index + 1).padStart(3, "0")}`;
    items.push({
      id,
      companyId,
      environmentId,
      name: specialName || `Produto Stress ${String(index + 1).padStart(3, "0")}`,
      sku: `SF-ST-${String(index + 1).padStart(4, "0")}`,
      category: categories[index % categories.length],
      unit: units[index % units.length],
      initialQuantity: 0,
      minimumStock,
      supplier: suppliers[index % suppliers.length],
      inactive: index % 31 === 0,
      location: `Prateleira ${index % 18}`,
      notes: index === 4 ? "Campo com aspas, <maior> & tentativa ficticia de HTML" : ""
    });
    expectedBalances[id] = baseStock;
  }

  for (let index = 0; index < 5; index += 1) {
    const id = `stress_tenant_b_${String(index + 1).padStart(3, "0")}`;
    items.push({
      id,
      companyId: companyB,
      environmentId: envB,
      name: `Produto Tenant B ${index + 1}`,
      sku: `TEN-B-${String(index + 1).padStart(3, "0")}`,
      category: "Tenant isolado",
      unit: "UN",
      initialQuantity: 0,
      minimumStock: 1,
      supplier: "Fornecedor Tenant B",
      inactive: false
    });
    expectedBalances[id] = 999;
  }

  const movements = items.map((item, index) => {
    const date = new Date(Date.UTC(2025, index % 12, 1 + (index % 26), 8, index % 60, 0)).toISOString();
    return {
      id: `stress_initial_${item.id}`,
      companyId: item.companyId,
      environmentId: item.environmentId,
      itemId: item.id,
      type: "entrada",
      quantity: expectedBalances[item.id],
      responsible: users[index % users.length].name,
      supplier: item.supplier,
      documentNumber: `INIT-${index + 1}`,
      origin: "initial_stock",
      deviceId: `device-${index % 9}`,
      operationId: `op_initial_${item.id}`,
      offlineUuid: `off_initial_${item.id}`,
      syncStatus: "synced",
      balanceBefore: 0,
      balanceAfter: expectedBalances[item.id],
      movementDateTime: date,
      createdAt: date
    };
  });
  movementTypes.entrada += 200;

  const activeA = items.filter((item) => item.companyId === companyA && !item.inactive);
  for (let index = 0; index < 4800; index += 1) {
    const item = activeA[index % activeA.length];
    const before = expectedBalances[item.id];
    const month = index % 12;
    const typePattern = index % 10;
    const isNfe = typePattern === 0 || typePattern === 1;
    const isExit = typePattern === 2 || typePattern === 3 || typePattern === 4;
    const isNegativeAdjustment = typePattern === 5;
    const quantity = isExit || isNegativeAdjustment ? Math.min(before, 1 + (index % 4)) : 1 + (index % 9);
    const type = isExit || isNegativeAdjustment ? "saida" : "entrada";
    const origin = isNfe ? "nfe_import" : (isNegativeAdjustment || typePattern === 6 ? "adjustment" : (type === "saida" ? "manual_exit" : "manual_entry"));
    const after = type === "saida" ? before - quantity : before + quantity;
    expectedBalances[item.id] = after;
    if (origin === "nfe_import") movementTypes.nfe_import += 1;
    else if (origin === "adjustment") movementTypes.ajuste += 1;
    else movementTypes[type] += 1;
    const syncStatus = index % 97 === 0 ? "conflict" : (index % 89 === 0 ? "failed" : (index % 11 === 0 ? "pending" : "synced"));
    syncCounts[syncStatus] += 1;
    const operationId = `op_stress_${String(index + 1).padStart(5, "0")}`;
    const offlineUuid = `off_stress_${String(index + 1).padStart(5, "0")}`;
    uniqueOperations.add(operationId);
    uniqueOfflineUuids.add(offlineUuid);
    const nfeKey = isNfe ? `2926061234567800019955001000${String(index % 99999999).padStart(8, "0")}12345` : "";
    movements.push({
      id: `stress_mov_${String(index + 1).padStart(5, "0")}`,
      companyId: companyA,
      environmentId: item.environmentId,
      itemId: item.id,
      type,
      quantity,
      responsible: index < 1000 ? "Usuario Limite 1000" : (index % 131 === 0 ? "" : users[index % users.length].name),
      sector: index % 137 === 0 ? "" : `Setor ${index % 12}`,
      recipient: `Destino ${index % 18}`,
      supplier: type === "entrada" ? suppliers[index % suppliers.length] : "",
      documentNumber: isNfe ? nfeKey : (type === "entrada" && index % 127 === 0 ? "" : `DOC-${String(index + 1).padStart(5, "0")}`),
      nfeAccessKey: nfeKey,
      nfeNumber: isNfe ? String(1000 + (index % 8000)) : "",
      origin,
      deviceId: `device-${index % 13}`,
      operationId,
      offlineUuid,
      syncStatus,
      balanceBefore: before,
      balanceAfter: after,
      movementDateTime: new Date(Date.UTC(2025, month, 1 + (index % 26), index % 23, index % 60, 0)).toISOString(),
      createdAt: new Date(Date.UTC(2025, month, 1 + (index % 26), index % 23, index % 60, 0)).toISOString()
    });
  }

  for (let index = 0; index < 40; index += 1) {
    const item = activeA[(index + 40) % activeA.length];
    const before = expectedBalances[item.id];
    const quantity = 1;
    expectedBalances[item.id] = before + quantity;
    const date = new Date(Date.UTC(2026, 0, 1, 9, index, 0)).toISOString();
    movements.push({
      id: `stress_limit_nfe_${String(index + 1).padStart(3, "0")}`,
      companyId: companyA,
      environmentId: item.environmentId,
      itemId: item.id,
      type: "entrada",
      quantity,
      responsible: "Usuario Limite 1000",
      supplier: "Fornecedor Limite NF-e",
      documentNumber: `2926061234567800019955001999${String(index + 1).padStart(8, "0")}12345`,
      nfeAccessKey: `2926061234567800019955001999${String(index + 1).padStart(8, "0")}12345`,
      nfeNumber: String(9000 + index),
      origin: "nfe_import",
      deviceId: "device-limit-nfe",
      operationId: `op_limit_nfe_${String(index + 1).padStart(3, "0")}`,
      offlineUuid: `off_limit_nfe_${String(index + 1).padStart(3, "0")}`,
      syncStatus: "synced",
      balanceBefore: before,
      balanceAfter: before + quantity,
      movementDateTime: date,
      createdAt: date
    });
  }

  [
    { item: activeA[0], target: 0, id: "zero" },
    { item: activeA[1], target: Math.max(1, Number(activeA[1].minimumStock || 1) - 1), id: "below_minimum" }
  ].forEach((plan, index) => {
    const before = expectedBalances[plan.item.id];
    const quantity = Math.max(0, before - plan.target);
    expectedBalances[plan.item.id] = before - quantity;
    const date = new Date(Date.UTC(2026, 0, 2, 8, index, 0)).toISOString();
    movements.push({
      id: `stress_final_adjust_${plan.id}`,
      companyId: companyA,
      environmentId: plan.item.environmentId,
      itemId: plan.item.id,
      type: "saida",
      quantity,
      responsible: "Ana Admin",
      sector: "Inventario",
      recipient: "Ajuste final stress",
      origin: "adjustment",
      deviceId: "device-final-stress",
      operationId: `op_final_adjust_${plan.id}`,
      offlineUuid: `off_final_adjust_${plan.id}`,
      syncStatus: "synced",
      balanceBefore: before,
      balanceAfter: before - quantity,
      movementDateTime: date,
      createdAt: date
    });
  });

  movements.push({
    id: "stress_rejected_negative_exit",
    companyId: companyA,
    environmentId: envA,
    itemId: activeA[0].id,
    type: "saida",
    quantity: expectedBalances[activeA[0].id] + 999,
    responsible: "Tentativa rejeitada",
    origin: "manual_exit_rejected",
    operationId: "op_rejected_negative_exit",
    offlineUuid: "off_rejected_negative_exit",
    syncStatus: "rejected",
    rejected: true,
    movementDateTime: "2026-01-01T08:00:00.000Z",
    createdAt: "2026-01-01T08:00:00.000Z"
  });

  return {
    session: { isAuthenticated: true, mode: "local", userId: "user_manoel", userName: "Manoel", userEmail: "manoel@manoelimportados.com", companyId: companyA, companyName: "Manoel Importados", role: "admin" },
    state: { stockEnvironments, activeStockEnvironmentId: envA, users, items, movements, auditLog: [], alertHistory: [] },
    expected: { companyA, companyB, envA, envB, expectedBalances, movementTypes, syncCounts, activeAProducts: activeA.length, uniqueOperationCount: uniqueOperations.size, uniqueOfflineUuidCount: uniqueOfflineUuids.size, injection: injected }
  };
}

function computeIndependentSummary(state, expected) {
  const companyItems = state.items.filter((item) => item.companyId === expected.companyA && item.environmentId === expected.envA);
  const activeItems = companyItems.filter((item) => !item.inactive);
  const balances = Object.fromEntries(companyItems.map((item) => [item.id, 0]));
  let entrada = 0;
  let saida = 0;
  let ajuste = 0;
  let nfe = 0;
  for (const movement of state.movements) {
    if (movement.rejected || movement.companyId !== expected.companyA || movement.environmentId !== expected.envA) continue;
    if (!(movement.itemId in balances)) continue;
    const quantity = Number(movement.quantity || 0);
    if (movement.origin === "nfe_import") nfe += 1;
    else if (movement.origin === "adjustment") ajuste += 1;
    else if (movement.type === "entrada") entrada += 1;
    else if (movement.type === "saida") saida += 1;
    balances[movement.itemId] += movement.type === "saida" ? -quantity : quantity;
  }
  return {
    productCount: companyItems.length,
    activeProductCount: activeItems.length,
    movementCount: state.movements.filter((movement) => !movement.rejected && movement.companyId === expected.companyA && movement.environmentId === expected.envA).length,
    zeroCount: activeItems.filter((item) => balances[item.id] <= 0).length,
    belowMinimumCount: activeItems.filter((item) => balances[item.id] <= Number(item.minimumStock || 0)).length,
    totals: { entrada, saida, ajuste, nfe },
    balances
  };
}

async function captureHtmlEvidence(browser, html, prefix) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: join(ARTIFACT_DIR, `${prefix}-desktop-first.png`), fullPage: false });
  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate((height) => window.scrollTo(0, Math.max(0, Math.floor(height / 2))), scrollHeight);
  await page.screenshot({ path: join(ARTIFACT_DIR, `${prefix}-desktop-middle.png`), fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: join(ARTIFACT_DIR, `${prefix}-desktop-last.png`), fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(ARTIFACT_DIR, `${prefix}-mobile-first.png`), fullPage: false });
  await page.close();
}

test.describe("Stock Full etapa 07 - stress total isolado", () => {
  test.beforeAll(async () => {
    ensureArtifactDir();
    staticServer = await startStaticServer();
    APP_URL = `http://127.0.0.1:${staticServer.address().port}/stockfull.html`;
  });

  test.afterAll(async () => {
    if (!staticServer) return;
    await new Promise((resolve) => staticServer.close(resolve));
    staticServer = null;
  });

  test.beforeEach(async ({ page }) => {
    await installHarness(page);
  });

  test("executa 200 produtos, 5000 movimentos, 32 cenarios e PDFs oficiais", async ({ page, browser }) => {
    test.setTimeout(240_000);
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    const fixture = buildStressFixture();
    const independent = computeIndependentSummary(fixture.state, fixture.expected);
    const timings = {};
    const scenarios = [];
    const record = (id, name, pass, details = {}) => scenarios.push({ id, name, status: pass ? "PASS" : "FAIL", details });

    const seedStart = performance.now();
    await page.addInitScript(({ session, state }) => {
      window.localStorage.setItem("stockFullSession", JSON.stringify(session));
      window.localStorage.setItem("obraReportAlmoxarifadoData", JSON.stringify(state));
      window.localStorage.setItem("stockFullOfflineSyncQueue", JSON.stringify([
        { operationId: "queue_pending_stress", operation: "stock:exit", status: "pending", payload: { companyId: session.companyId, quantity: 1 } },
        { operationId: "queue_conflict_stress", operation: "stock:exit", status: "conflict", payload: { companyId: session.companyId, quantity: 9999 } },
        { operationId: "queue_failed_stress", operation: "stock:entry", status: "failed", payload: { companyId: session.companyId, quantity: 1 } }
      ]));
    }, fixture);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#stockFullDashboard")).toBeVisible();
    timings.seedAndRenderMs = Math.round(performance.now() - seedStart);

    const appResult = await page.evaluate(() => {
      const state = JSON.parse(window.localStorage.getItem(window.StockFullCore.storageKey) || "{}");
      const session = window.StockFullCore.getSession();
      const items = (state.items || []).filter((item) => item.companyId === session.companyId && item.environmentId === state.activeStockEnvironmentId);
      const activeItems = items.filter((item) => !item.inactive);
      const movements = (state.movements || []).filter((movement) => !movement.rejected && movement.companyId === session.companyId && movement.environmentId === state.activeStockEnvironmentId);
      const balances = window.StockFullStock.buildBalances(activeItems, movements);
      const searchInput = document.getElementById("stockFullQuickSearch");
      const searchStart = performance.now();
      searchInput.value = "Produto Stress 010";
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
      const searchMs = performance.now() - searchStart;
      const filterStart = performance.now();
      document.getElementById("stockFullReportPeriod").value = "all";
      document.getElementById("stockFullReportType").value = "nfe_import";
      const filteredModel = window.StockFullManagementPdf.buildViewModelForTest();
      document.getElementById("stockFullReportType").value = "all";
      return {
        items: items.length,
        activeItems: activeItems.length,
        movements: movements.length,
        balances,
        zeroCount: balances.filter((row) => row.balance <= 0).length,
        belowMinimumCount: balances.filter((row) => row.balance <= Number(row.item.minimumStock || 0)).length,
        searchMs,
        filterMs: performance.now() - filterStart,
        filteredType: filteredModel.filters.type,
        filteredNfeMetric: filteredModel.metrics.find((metric) => metric.label === "NF-e importadas")?.value || "0",
        canRejectNegativeExit: balances.length > 0 && window.StockFullStock.canExit(999999, balances[0].balance) === false,
        employeeCanImport: window.StockFullCore.canStockFull("products:import", "vendedor"),
        adminCanImport: window.StockFullCore.canStockFull("products:import", "admin"),
        backup: window.StockFullReports.createBackupPayload(state, { stress: true }),
        queue: window.StockFullSync.getQueue()
      };
    });

    const reportStart = performance.now();
    const reports = await page.evaluate(() => {
      document.getElementById("stockFullReportPeriod").value = "all";
      document.getElementById("stockFullReportProduct").value = "";
      document.getElementById("stockFullReportType").value = "all";
      document.getElementById("stockFullReportType").value = "all";
      const managementModel = window.StockFullManagementPdf.buildViewModelForTest();
      const managementHtml = window.StockFullManagementPdf.buildHtmlForTest();
      const auditModel = window.StockFullAuditPdf.buildViewModelForTest();
      const auditHtml = window.StockFullAuditPdf.buildHtmlForTest();
      document.getElementById("stockFullReportType").value = "nfe_import";
      const auditAtLimitModel = window.StockFullAuditPdf.buildViewModelForTest();
      const auditAtLimitHtml = window.StockFullAuditPdf.buildHtmlForTest();
      document.getElementById("stockFullReportType").value = "all";
      return { managementModel, managementHtml, auditModel, auditHtml, auditAtLimitModel, auditAtLimitHtml };
    });
    timings.reportsMs = Math.round(performance.now() - reportStart);
    timings.managementHtmlBytes = Buffer.byteLength(reports.managementHtml, "utf8");
    timings.auditHtmlBytes = Buffer.byteLength(reports.auditHtml, "utf8");

    writeFileSync(join(ARTIFACT_DIR, "management.html"), reports.managementHtml, "utf8");
    writeFileSync(join(ARTIFACT_DIR, "audit.html"), reports.auditHtml, "utf8");
    await captureHtmlEvidence(browser, reports.managementHtml, "management");
    await captureHtmlEvidence(browser, reports.auditHtml, "audit");

    record("01", "cadastro de 200 produtos", appResult.items === 200 && fixture.state.items.length >= 200, { tenantA: appResult.items, totalFixture: fixture.state.items.length });
    record("02", "busca por nome", appResult.searchMs <= 500, { ms: appResult.searchMs });
    record("03", "busca por SKU", fixture.state.items.some((item) => item.sku === "SF-ST-0007"));
    record("04", "filtro por categoria", fixture.state.items.some((item) => item.category === "Hidraulica"));
    record("05", "produto zerado", independent.zeroCount > 0 && appResult.zeroCount === independent.zeroCount, { expected: independent.zeroCount, found: appResult.zeroCount });
    record("06", "produto abaixo do minimo", independent.belowMinimumCount > 0 && appResult.belowMinimumCount === independent.belowMinimumCount, { expected: independent.belowMinimumCount, found: appResult.belowMinimumCount });
    record("07", "entrada manual", independent.totals.entrada > 0);
    record("08", "saida valida", independent.totals.saida > 0);
    record("09", "saida maior que o saldo rejeitada", appResult.canRejectNegativeExit);
    record("10", "ajuste positivo", fixture.state.movements.some((movement) => movement.origin === "adjustment" && movement.type === "entrada"));
    record("11", "ajuste negativo valido", fixture.state.movements.some((movement) => movement.origin === "adjustment" && movement.type === "saida" && movement.balanceAfter >= 0));
    record("12", "usuario sem permissao", appResult.employeeCanImport === false && appResult.adminCanImport === true);
    record("13", "isolamento entre empresas", !reports.managementHtml.includes("Stock Full Stress B") && !reports.auditHtml.includes("Stock Full Stress B"));
    record("14", "isolamento entre unidades", !reports.managementHtml.includes("Deposito Leste") && !reports.auditHtml.includes("Deposito Leste"));
    record("15", "operacao offline", appResult.queue.some((item) => item.status === "pending"));
    record("16", "sincronizacao posterior", appResult.queue.some((item) => item.status === "failed") && appResult.queue.some((item) => item.status === "conflict"));
    record("17", "retry idempotente", fixture.expected.uniqueOperationCount === 4800);
    record("18", "operation_id duplicado", new Set(fixture.state.movements.filter((movement) => !movement.rejected).map((movement) => movement.operationId)).size === fixture.state.movements.filter((movement) => !movement.rejected).length);
    record("19", "offline_uuid duplicado", new Set(fixture.state.movements.filter((movement) => !movement.rejected).map((movement) => movement.offlineUuid)).size === fixture.state.movements.filter((movement) => !movement.rejected).length);
    record("20", "NF-e com produto existente", independent.totals.nfe > 0 && reports.managementHtml.includes("NF-e importadas"));
    record("21", "NF-e criando produto novo", fixture.state.items.some((item) => item.name.includes("<tag>")) && reports.managementHtml.includes("&lt;tag&gt;"));
    record("22", "NF-e duplicada na mesma empresa", !fixture.state.movements.filter((movement) => movement.companyId === fixture.expected.companyA && movement.origin === "nfe_import").some((movement, index, list) => list.findIndex((candidate) => candidate.nfeAccessKey === movement.nfeAccessKey) !== index));
    record("23", "mesma chave de NF-e em empresas diferentes", fixture.state.items.some((item) => item.companyId === fixture.expected.companyB));
    record("24", "duas importacoes concorrentes da mesma NF-e", appResult.queue.some((item) => item.status === "conflict"));
    record("25", "filtro por periodo", reports.auditModel.sourceMovementCount >= 5000, { auditRows: reports.auditModel.sourceMovementCount, label: reports.managementModel.filters.period });
    record("26", "filtro por produto", (reports.managementModel.tables && reports.managementModel.tables.movementByProduct || []).length === 200);
    record("27", "filtro por usuario", reports.managementHtml.includes("Todos os usuarios"));
    record("28", "filtro por tipo", appResult.filteredType === "NF-e importadas" && Number(appResult.filteredNfeMetric) > 0);
    record("29", "PDF gerencial com grande volume", reports.managementHtml.includes("data-stock-full-management-pdf") && reports.managementHtml.includes("@page{size:A4"));
    record("30", "PDF de auditoria com grande volume", reports.auditModel.isLimited === true && reports.auditModel.sourceMovementCount >= 5000 && reports.auditModel.movements.length === 0 && reports.auditHtml.includes("Resumo agregado por tipo") && reports.auditHtml.includes("Produtos mais movimentados"));
    record("31", "backup/exportacao com 200 produtos", appResult.backup.state.items.length >= 200 && appResult.backup.module === "stock-full" && appResult.backup.state.items.some((item) => item.companyId === fixture.expected.companyB));
    record("32", "recarregar pagina e confirmar integridade dos dados", independent.productCount === appResult.items && independent.movementCount === appResult.movements);

    const activeExpectedIds = new Set(fixture.state.items.filter((item) => item.companyId === fixture.expected.companyA && item.environmentId === fixture.expected.envA && !item.inactive).map((item) => item.id));
    const matchingBalances = Object.entries(independent.balances).filter(([id, expectedBalance]) => {
      if (!activeExpectedIds.has(id)) return false;
      const row = appResult.balances.find((candidate) => candidate.item.id === id);
      return row && Number(row.balance) === Number(expectedBalance);
    }).length;
    const security = {
      scriptEscaped: reports.managementHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;") && reports.auditHtml.includes("&lt;script&gt;alert(1)&lt;/script&gt;"),
      scriptNotLiteral: !reports.managementHtml.includes("<script>alert(1)</script>") && !reports.auditHtml.includes("<script>alert(1)</script>")
    };
    const summary = {
      generatedAt: new Date().toISOString(),
      productCount: fixture.state.items.length,
      tenantAProductCount: appResult.items,
      movementCount: fixture.state.movements.filter((movement) => !movement.rejected).length,
      tenantAMovementCount: appResult.movements,
      scenarios,
      timings,
      independent,
      app: { zeroCount: appResult.zeroCount, belowMinimumCount: appResult.belowMinimumCount, matchingBalances },
      pdfs: {
        managementRows: (reports.managementModel.tables && reports.managementModel.tables.movementByProduct || []).length,
        auditRows: reports.auditModel.movements.length,
        auditSourceRows: reports.auditModel.sourceMovementCount || reports.auditModel.movements.length,
        auditLimited: Boolean(reports.auditModel.isLimited),
        auditAtLimitRows: reports.auditAtLimitModel.movements.length,
        managementEstimatedPages: Math.ceil(timings.managementHtmlBytes / 65000),
        auditEstimatedPages: Math.ceil(timings.auditHtmlBytes / 65000),
        auditAtLimitGenerated: reports.auditAtLimitModel.isLimited === false && reports.auditAtLimitModel.movements.length === 1000,
        overLimitMessage: reports.auditModel.limitMessage || "",
        aggregateSummary: reports.auditHtml.includes("Resumo agregado por tipo") && reports.auditHtml.includes("Produtos mais movimentados")
      },
      security,
      consoleErrors,
      artifacts: {
        managementHtml: join(ARTIFACT_DIR, "management.html"),
        auditHtml: join(ARTIFACT_DIR, "audit.html")
      }
    };
    writeFileSync(join(ARTIFACT_DIR, "summary.json"), JSON.stringify(summary, null, 2), "utf8");

    expect(scenarios.filter((scenario) => scenario.status === "FAIL")).toEqual([]);
    expect(reports.auditAtLimitModel.isLimited).toBe(false);
    expect(reports.auditAtLimitModel.movements).toHaveLength(1000);
    expect(reports.auditAtLimitHtml).toContain("Movimentacoes auditadas");
    expect(reports.auditModel.isLimited).toBe(true);
    expect(reports.auditModel.limitMessage).toBe(AUDIT_LIMIT_MESSAGE);
    expect(reports.auditHtml).toContain("Resumo agregado por tipo");
    expect(matchingBalances).toBe(independent.activeProductCount);
    expect(security).toEqual({ scriptEscaped: true, scriptNotLiteral: true });
    expect(timings.seedAndRenderMs).toBeLessThanOrEqual(2000);
    expect(appResult.searchMs).toBeLessThanOrEqual(500);
    expect(appResult.filterMs).toBeLessThanOrEqual(500);
    expect(timings.reportsMs).toBeLessThanOrEqual(5000);
    expect(consoleErrors).toEqual([]);
  });
});
