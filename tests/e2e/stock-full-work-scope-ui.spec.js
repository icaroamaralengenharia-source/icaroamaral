import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

const ROOT_DIR = process.cwd();
const APP_ORIGIN = "https://www.icaroamaral.com.br";
const APP_URL = APP_ORIGIN + "/stockfull.html?produto=stock-full#app/almoxarifado";
const API_ORIGIN = "https://obrareport-backend-stockfull.onrender.com";
const API_PATH = "/api/stock-full";
const API_BASE = API_ORIGIN + API_PATH;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function corsHeaders() {
  return {
    "access-control-allow-origin": APP_ORIGIN,
    "access-control-allow-credentials": "true",
    "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-project-id",
    vary: "Origin"
  };
}

async function installLocalFrontend(page) {
  const apiTrace = [];
  const remote = {
    generalItems: Array.from({ length: 40 }, (_, index) => ({ id: "general-item-" + index, institution_id: "tenant-e2e", projectId: "", name: "E2E CLOUD ITEM " + String(index + 1).padStart(2, "0"), unit: "un", currentQuantity: index + 1 })),
    workItems: Array.from({ length: 8 }, (_, index) => ({ id: "work-item-" + index, institution_id: "tenant-e2e", projectId: "work-e2e", name: "E2E WORK ITEM " + (index + 1), unit: "un", currentQuantity: index + 1 })),
    movements: [],
    movementByOperationId: new Map(),
    auditLog: [],
    nextMovementId: 1,
    nextProductId: 1
  };
  await page.route(APP_ORIGIN + "/**", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ status: 405, body: "Method not allowed" });
      return;
    }
    const pathname = decodeURIComponent(new URL(route.request().url()).pathname);
    const filePath = resolve(ROOT_DIR, "." + pathname);
    if (filePath !== ROOT_DIR && !filePath.startsWith(ROOT_DIR + sep)) {
      await route.fulfill({ status: 403, body: "Forbidden" });
      return;
    }
    try {
      const body = await readFile(filePath);
      await route.fulfill({ status: 200, headers: { "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream" }, body });
    } catch (_) {
      await route.fulfill({ status: 404, body: "Not found" });
    }
  });

  await page.route(API_BASE + "/**", async (route) => {
    const method = route.request().method();
    const requestUrl = new URL(route.request().url());
    const endpoint = requestUrl.pathname.slice(API_PATH.length);
    const projectId = route.request().headers()["x-project-id"] || "";
    let body;
    if (method === "OPTIONS") {
      apiTrace.push({ method, path: requestUrl.pathname, status: 204 });
      await route.fulfill({ status: 204, headers: corsHeaders() });
      return;
    }
    if (method === "POST" && endpoint === "/sync") {
      const payload = route.request().postDataJSON() || {};
      const results = [];
      for (const movement of Array.isArray(payload.movements) ? payload.movements : []) {
        const operationId = String(movement.offlineUuid || movement.operationId || "");
        const existing = remote.movementByOperationId.get(operationId);
        if (existing) {
          results.push({ offline_uuid: operationId, status: "duplicate", movement_id: existing.id });
          continue;
        }
        const itemLists = movement.projectId || movement.project_id ? [remote.workItems] : [remote.generalItems];
        const item = itemLists.flat().find((candidate) => candidate.id === String(movement.itemId || movement.productId || ""));
        const quantity = Number(movement.quantity || 0);
        const type = movement.type === "saida" ? "saida" : "entrada";
        if (!operationId || !item || !Number.isFinite(quantity) || quantity <= 0 || (type === "saida" && item.currentQuantity < quantity)) {
          results.push({ offline_uuid: operationId, status: "rejected", message: "invalid_e2e_fixture_movement" });
          continue;
        }
        item.currentQuantity += type === "saida" ? -quantity : quantity;
        const record = { ...movement, id: "movement-e2e-" + remote.nextMovementId++, institution_id: "tenant-e2e", itemId: item.id, projectId: item.projectId, type, createdAt: new Date().toISOString() };
        remote.movements.push(record);
        remote.movementByOperationId.set(operationId, record);
        remote.auditLog.push({ id: "audit-e2e-" + remote.auditLog.length, institution_id: "tenant-e2e", action: type === "entrada" ? "movement_in_created" : "movement_out_created", entity_type: "stock_full_movement", entity_id: record.id, created_at: record.createdAt });
        results.push({ offline_uuid: operationId, status: "synced", movement_id: record.id });
      }
      apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 200 });
      await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: true, results }) });
      return;
    }
    if (method === "POST" && endpoint === "/items") {
      const payload = route.request().postDataJSON() || {};
      const item = {
        id: "created-item-e2e-" + remote.nextProductId++,
        institution_id: "tenant-e2e",
        projectId: String(payload.projectId || ""),
        name: String(payload.name || ""),
        sku: String(payload.sku || ""),
        unit: String(payload.unit || "un"),
        category: String(payload.category || "Geral"),
        minQuantity: Number(payload.minQuantity || 0),
        currentQuantity: Number(payload.currentQuantity || 0),
        location: String(payload.location || ""),
        notes: String(payload.notes || "")
      };
      (item.projectId ? remote.workItems : remote.generalItems).push(item);
      apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 200 });
      await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: true, mode: "remote", item }) });
      return;
    }
    if (method === "PUT" && endpoint.startsWith("/items/")) {
      const itemId = decodeURIComponent(endpoint.slice("/items/".length));
      const item = [...remote.generalItems, ...remote.workItems].find((candidate) => candidate.id === itemId);
      if (!item) {
        await route.fulfill({ status: 404, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: false, error: "stock_full_item_not_found" }) });
        return;
      }
      const payload = route.request().postDataJSON() || {};
      Object.assign(item, { name: payload.name, sku: payload.sku, unit: payload.unit, category: payload.category, minQuantity: Number(payload.minQuantity || 0), currentQuantity: Number(payload.currentQuantity || 0), location: payload.location || "", notes: payload.notes || "" });
      apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 200 });
      await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: true, mode: "remote", item }) });
      return;
    }
    if (method === "POST" && (endpoint === "/entries" || endpoint === "/exits")) {
      const payload = route.request().postDataJSON() || {};
      const type = endpoint === "/exits" ? "saida" : "entrada";
      const item = [...remote.generalItems, ...remote.workItems].find((candidate) => candidate.id === String(payload.itemId || payload.productId || ""));
      const operationId = String(payload.operationId || payload.offlineUuid || "");
      const duplicate = remote.movementByOperationId.get(operationId);
      if (duplicate) {
        await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: true, duplicate: true, [type === "entrada" ? "entry" : "exit"]: duplicate, item }) });
        return;
      }
      const quantity = Number(payload.quantity || 0);
      if (!item || quantity <= 0 || (type === "saida" && item.currentQuantity < quantity)) {
        await route.fulfill({ status: 409, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: false, error: "stock_full_insufficient_quantity" }) });
        return;
      }
      item.currentQuantity += type === "saida" ? -quantity : quantity;
      const record = { ...payload, id: "movement-e2e-" + remote.nextMovementId++, institution_id: "tenant-e2e", itemId: item.id, projectId: item.projectId, type, source: "web", syncStatus: "synced", createdAt: new Date().toISOString() };
      remote.movements.push(record);
      remote.movementByOperationId.set(operationId, record);
      remote.auditLog.push({ id: "audit-e2e-" + remote.auditLog.length, institution_id: "tenant-e2e", action: type === "entrada" ? "movement_in_created" : "movement_out_created", entity_type: "stock_full_movement", entity_id: record.id, created_at: record.createdAt });
      apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 200 });
      await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify({ ok: true, mode: "remote", duplicate: false, [type === "entrada" ? "entry" : "exit"]: record, item }) });
      return;
    }
    if (method !== "GET") {
      await route.fulfill({ status: 405, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: "method_not_allowed" }) });
      return;
    }
    switch (endpoint) {
      case "/me":
        body = { ok: true, profile: { id: "profile-e2e", institution_id: "tenant-e2e", name: "E2E Stock", email: "e2e@example.invalid", role: "admin" } };
        break;
      case "/works":
        body = { ok: true, works: [{ id: "work-e2e", name: "E2E WORK SCOPE" }] };
        break;
      case "/items":
        body = { ok: true, items: projectId ? remote.workItems : remote.generalItems };
        break;
      case "/sync/status":
        body = { ok: true, statuses: remote.movements.map((movement) => ({ id: movement.id, type: movement.type, operationId: movement.operationId, offlineUuid: movement.offlineUuid, projectId: movement.projectId })) };
        break;
      case "/entries":
        body = { ok: true, entries: remote.movements.filter((movement) => movement.type === "entrada") };
        break;
      case "/exits":
        body = { ok: true, exits: remote.movements.filter((movement) => movement.type === "saida") };
        break;
      case "/audit-log":
        body = { ok: true, auditLog: remote.auditLog };
        break;
      case "/live":
        body = { ok: true, lastMovements: [] };
        break;
      default:
        body = { ok: false, error: "not_found" };
        apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 404 });
        await route.fulfill({ status: 404, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify(body) });
        return;
    }
    apiTrace.push({ method, path: requestUrl.pathname, projectId, status: 200 });
    await route.fulfill({ status: 200, headers: corsHeaders(), contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.route("https://cdn.jsdelivr.net/**", (route) => route.fulfill({ status: 200, contentType: "text/javascript", body: "" }));
  await page.route("https://fonts.googleapis.com/**", (route) => route.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.route("https://fonts.gstatic.com/**", (route) => route.fulfill({ status: 200, contentType: "font/woff2", body: "" }));
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("stock-full-work-scope-fixture") === "ready") return;
    window.sessionStorage.setItem("stock-full-work-scope-fixture", "ready");
    window.sessionStorage.setItem("icaro_site_access_v2", JSON.stringify({ authenticated: true, createdAt: Date.now(), expiresAt: Date.now() + 60 * 60 * 1000 }));
    const mockJwt = "e30.eyJzdWIiOiJlMmUifQ.sig";
    window.localStorage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ currentSession: { access_token: mockJwt }, access_token: mockJwt }));
    window.localStorage.setItem("stockFullSession", JSON.stringify({ isAuthenticated: true, mode: "backend", userId: "user-e2e", userName: "E2E Stock", userEmail: "e2e@example.invalid", companyId: "tenant-e2e", companyName: "E2E Stock", role: "admin" }));
    window.localStorage.setItem("stockFullCurrentWork", JSON.stringify({}));
    window.localStorage.setItem("obraReportAlmoxarifadoData", JSON.stringify({ items: Array.from({ length: 8 }, (_, index) => ({ id: "local-stale-" + index, companyId: "tenant-e2e", name: "LOCAL STALE ITEM " + (index + 1), currentQuantity: 99 })), movements: [], stockEnvironments: [], activeStockEnvironmentId: "" }));
  });
  return { apiTrace, remote };
}

test.use({ trace: "off", screenshot: "off", video: "off" });

test.describe("Stock Full cloud/work scope UI regression", () => {
  test("keeps cloud GENERAL canonical and switches GENERAL → WORK → GENERAL without bleed", async ({ page }) => {
    const { apiTrace } = await installLocalFrontend(page);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });

    const scope = page.locator("#stockFullWorkScopeSelect");
    await expect(page.locator("#stockFullDashboard")).toBeVisible();
    await expect(scope).toHaveValue("");
    await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");
    await expect(page.locator("#almoxItemsCards")).toContainText("E2E CLOUD ITEM 40");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("LOCAL STALE ITEM");

    await page.locator("#almoxSearchInput").fill("E2E CLOUD ITEM 40");
    await expect(page.locator("#almoxItemsCards")).toContainText("E2E CLOUD ITEM 40");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("E2E CLOUD ITEM 01");
    await page.locator("#almoxSearchInput").fill("");

    await Promise.all([page.waitForNavigation(), scope.selectOption("work-e2e")]);
    await expect(page.locator("#almoxItemsCount")).toHaveText("8 itens cadastrados");
    await expect(page.locator("#almoxItemsCards")).toContainText("E2E WORK ITEM 8");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("E2E CLOUD ITEM");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("LOCAL STALE ITEM");

    const generalScope = page.locator("#stockFullWorkScopeSelect");
    await Promise.all([page.waitForNavigation(), generalScope.selectOption("")]);
    await expect(page.locator("#stockFullWorkScopeSelect")).toHaveValue("");
    await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");
    await expect(page.locator("#almoxItemsCards")).toContainText("E2E CLOUD ITEM 40");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("E2E WORK ITEM");
    await expect(page.locator("#almoxItemsCards")).not.toContainText("LOCAL STALE ITEM");
    expect(apiTrace.some((entry) => entry.path.endsWith("/items") && !entry.projectId)).toBe(true);
    expect(apiTrace.some((entry) => entry.path.endsWith("/items") && entry.projectId === "work-e2e")).toBe(true);
  });

  test("renders cloud GENERAL and search without horizontal overflow at required mobile sizes", async ({ page }) => {
    await installLocalFrontend(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });

    for (const viewport of [{ width: 360, height: 800 }, { width: 375, height: 812 }, { width: 390, height: 844 }, { width: 412, height: 915 }]) {
      await page.setViewportSize(viewport);
      await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");
      await page.locator("#almoxSearchInput").fill("E2E CLOUD ITEM 40");
      await expect(page.locator("#almoxItemsCards")).toContainText("E2E CLOUD ITEM 40");
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
      await page.locator("#almoxSearchInput").fill("");
    }
  });

  test("performs cloud CRUD, entry, exit, search and history from a mobile viewport", async ({ page }) => {
    const { remote } = await installLocalFrontend(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");

    await page.locator("#almoxSearchInput").fill("E2E CLOUD ITEM 10");
    await expect(page.locator("#almoxItemsCards")).toContainText("E2E CLOUD ITEM 10");
    await page.locator("#almoxSearchInput").fill("");

    const originalCreateName = "E2E MOBILE CLOUD PRODUCT";
    await page.locator('#almoxManagerPanel [data-almox-action="item"]').click();
    let form = page.locator("#almoxModal form");
    await expect(form).toBeVisible();
    await form.locator('[name="name"]').fill(originalCreateName);
    await form.locator('[name="sku"]').fill("E2E-MOBILE-CLOUD-01");
    await form.locator('[name="category"]').fill("E2E Mobile");
    await form.locator('[name="unit"]').fill("un");
    await form.locator('[name="initialQuantity"]').fill("7");
    await form.locator('[name="minimumStock"]').fill("1");
    await page.locator("#almoxModalItemSubmitButton").click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxItemsCount")).toHaveText("41 itens cadastrados");
    await expect(page.locator("#almoxItemsCards")).toContainText(originalCreateName);

    const createdCard = page.locator(".almox-item-card").filter({ hasText: originalCreateName });
    await createdCard.locator('[data-almox-action="edit"]').click();
    form = page.locator("#almoxModal form");
    await expect(form).toBeVisible();
    const updatedName = originalCreateName + " EDITED";
    await form.locator('[name="name"]').fill(updatedName);
    await page.locator("#almoxModalEditSubmitButton").click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
    await expect(page.locator("#almoxItemsCards")).toContainText(updatedName);

    await page.locator('#almoxManagerPanel [data-almox-action="entry"]').click();
    form = page.locator("#almoxModal form");
    await form.locator('[name="itemId"]').selectOption({ label: updatedName + " (un)" });
    await form.locator('[name="quantity"]').fill("3");
    await form.locator('[name="responsible"]').fill("E2E Mobile Receiver");
    await form.locator('[name="documentNumber"]').fill("E2E-MOBILE-ENTRY");
    await page.locator("#almoxModalEntrySubmitButton").click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);

    await page.locator('#almoxManagerPanel [data-almox-action="exit"]').click();
    form = page.locator("#almoxModal form");
    await form.locator('[name="itemId"]').selectOption({ label: updatedName + " (un)" });
    await form.locator('[name="quantity"]').fill("2");
    await form.locator('[name="recipient"]').fill("E2E Mobile Recipient");
    await form.locator('[name="sector"]').fill("E2E Mobile Sector");
    await form.locator('[name="responsible"]').fill("E2E Mobile Operator");
    await page.locator("#almoxModalExitSubmitButton").click();
    await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
    expect(remote.movements.map((movement) => movement.type)).toEqual(["entrada", "saida"]);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#almoxItemsCount")).toHaveText("41 itens cadastrados");
    const finalCard = page.locator(".almox-item-card").filter({ hasText: updatedName });
    await expect(finalCard).toContainText("Saldo atual: 8 un");
    await expect(page.locator("#almoxHistoryCount")).toHaveText("2 movimentações");
    await expect(page.locator("#almoxHistorySection")).toContainText(updatedName);
  });

  test("queues three offline UI movements, syncs once each, then reloads cloud balance and history", async ({ page, context }) => {
    const { remote } = await installLocalFrontend(page);
    await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");
    await context.setOffline(true);

    async function submitMovement(type, quantity) {
      await page.locator('#almoxManagerPanel [data-almox-action="' + type + '"]').click();
      const form = page.locator("#almoxModal form");
      await expect(form).toBeVisible();
      await form.locator('[name="itemId"]').selectOption("general-item-9");
      await form.locator('[name="quantity"]').fill(String(quantity));
      if (type === "entry") {
        await form.locator('[name="responsible"]').fill("E2E Offline Receiver");
        await form.locator('[name="documentNumber"]').fill("E2E-STRESS-OFFLINE");
        await page.locator("#almoxModalEntrySubmitButton").click();
      } else {
        await form.locator('[name="recipient"]').fill("E2E Offline Recipient");
        await form.locator('[name="sector"]').fill("E2E Test Sector");
        await form.locator('[name="responsible"]').fill("E2E Offline Operator");
        await page.locator("#almoxModalExitSubmitButton").click();
      }
      await expect(page.locator("#almoxModal")).toHaveClass(/is-hidden/);
    }

    await submitMovement("entry", 3);
    await submitMovement("entry", 2);
    await submitMovement("exit", 4);
    await expect(page.locator("#stockFullSyncDetails")).toContainText("Pendencias: 3");
    expect(await page.evaluate(() => window.StockFullSync.getQueue().map((item) => item.status))).toEqual(["pending", "pending", "pending"]);
    expect(remote.movements).toHaveLength(0);

    await context.setOffline(false);
    await expect.poll(async () => page.evaluate(() => window.StockFullSync.getQueue().map((item) => item.status))).toEqual(["synced", "synced", "synced"]);
    expect(remote.movements).toHaveLength(3);
    expect(new Set(remote.movements.map((movement) => movement.operationId)).size).toBe(3);
    expect(remote.generalItems.find((item) => item.id === "general-item-9").currentQuantity).toBe(11);
    await expect(page.locator("#stockFullSyncDetails")).toContainText("Pendencias: 0");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#almoxItemsCount")).toHaveText("40 itens cadastrados");
    await expect(page.locator("#almoxHistoryCount")).toHaveText("3 movimentações");
    const itemCard = page.locator(".almox-item-card").filter({ hasText: "E2E CLOUD ITEM 10" });
    await expect(itemCard).toContainText("Saldo atual: 11 un");
  });
});
