const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

const ROOT = join(__dirname, "..");
const HTML_PATH = join(ROOT, "vistoria-entrega-apartamento", "index.html");
const APP_PATH = join(ROOT, "vistoria-entrega-apartamento", "app.js");
const TEMPLATE_PATH = join(ROOT, "vistoria-entrega-apartamento", "inspection-template.js");
const AI_PATH = join(ROOT, "vistoria-entrega-apartamento", "inspection-ai.js");
const ADAPTER_PATH = join(ROOT, "vistoria-entrega-apartamento", "apartment-handover-document-adapter.js");
const SYNC_PATH = join(ROOT, "vistoria-entrega-apartamento", "apartment-handover-sync.js");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.has(key) ? data.get(key) : null, setItem: (key, value) => data.set(key, String(value)), removeItem: (key) => data.delete(key) };
}

function createElement(dataset = {}) {
  const element = { dataset, hidden: false, disabled: false, value: "", textContent: "", className: "", classList: { toggle() {}, add() {}, remove() {} }, style: {}, files: [], appendChild() {}, remove() {}, focus() {}, showModal() { this.open = true; }, close() { this.open = false; }, setAttribute(name, value) { this[name] = String(value); }, addEventListener(type, handler) { this.listeners = this.listeners || {}; this.listeners[type] = handler; }, click() { if (this.listeners && this.listeners.click) return this.listeners.click({ target: this, preventDefault() {}, stopImmediatePropagation() {} }); }, querySelectorAll(selector) { this.cache = this.cache || new Map(); if (this.cache.has(selector)) return this.cache.get(selector); let parsed = []; if (selector === "[data-status]") parsed = parseStatusButtons(this.innerHTML); else if (selector === "[data-open-item]") parsed = parseButtons(this.innerHTML, "open-item"); else if (selector === "[data-open-env]") parsed = parseButtons(this.innerHTML, "open-env"); else if (selector === "[data-env]") parsed = parseButtons(this.innerHTML, "env"); else if (selector === "[data-system]") parsed = parseButtons(this.innerHTML, "system"); this.cache.set(selector, parsed); return parsed; } };
  let html = "";
  Object.defineProperty(element, "innerHTML", { get() { return html; }, set(value) { html = String(value || ""); element.cache = new Map(); } });
  return element;
}

function parseButtons(html, name) {
  const attr = "data-" + name;
  const regex = new RegExp(attr + '="([^"]+)"', "g");
  const key = name.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
  return Array.from(html.matchAll(regex), (match) => createElement({ [key]: match[1] }));
}

function parseStatusButtons(html) {
  const regex = /data-status="([^"]+)" data-key="([^"]+)"/g;
  return Array.from(html.matchAll(regex), (match) => createElement({ status: match[1], key: match[2] }));
}

function createDocument() {
  const elements = new Map();
  const bySelector = (selector) => { if (!elements.has(selector)) elements.set(selector, createElement()); return elements.get(selector); };
  const views = ["identification", "dashboard", "environment", "ncs"].map((view) => createElement({ view }));
  const viewButtons = ["dashboard", "ncs"].map((viewButton) => createElement({ viewButton }));
  const filterButtons = ["all", "pending", "NC", "NV"].map((filter) => createElement({ filter }));
  const ncFilterButtons = ["all", "critica", "alta", "media", "baixa"].map((ncFilter) => createElement({ ncFilter }));
  const sheetStatusButtons = ["C", "NC", "NA", "NV"].map((sheetStatus) => createElement({ sheetStatus }));
  const aiButtons = ["description", "severity", "recommendation", "status", "item", "environment"].map((applyAi) => createElement({ applyAi }));
  return { elements, document: { body: createElement(), createElement: () => createElement(), querySelector(selector) { if (selector === "[data-filter-chips]") { const item = bySelector(selector); item.querySelectorAll = (nested) => nested === "[data-filter]" ? filterButtons : []; return item; } if (selector === "[data-nc-filter-chips]") { const item = bySelector(selector); item.querySelectorAll = (nested) => nested === "[data-nc-filter]" ? ncFilterButtons : []; return item; } return bySelector(selector); }, querySelectorAll(selector) { if (selector === "[data-view]") return views; if (selector === "[data-field]") return []; if (selector === "[data-view-button]") return viewButtons; if (selector === "[data-sheet-status]") return sheetStatusButtons; if (selector === "[data-apply-ai]") return aiButtons; return []; } } };
}

function okResponse(body, status = 200, contentType = "application/json") {
  return { ok: status >= 200 && status < 300, status, headers: { get(name) { return name.toLowerCase() === "content-type" ? contentType : ""; } }, async json() { return body; }, async blob() { return new Blob(["pdf"], { type: "application/pdf" }); } };
}

function loadApp({ storage = createStorage(), fetchImpl = async () => okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:00:00.000Z" } }, 201), online = true } = {}) {
  const { document, elements } = createDocument();
  const timers = [];
  const context = { console, Blob, URL: { createObjectURL: () => "blob:pdf", revokeObjectURL() {} }, FileReader: function FileReader() {}, localStorage: storage, indexedDB: {}, navigator: { onLine: online }, fetch: fetchImpl, document, window: null, module: undefined, exports: undefined, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, addEventListener() {}, location: { hash: "", search: "" } };
  context.window = context;
  context.globalThis = context;
  for (const path of [TEMPLATE_PATH, AI_PATH, ADAPTER_PATH, SYNC_PATH, APP_PATH]) vm.runInNewContext(readFileSync(path, "utf8"), context, { filename: path });
  return { context, elements, storage, timers };
}

function contextStorage() {
  return createStorage({ "obrareport-apartment-handover-sync-context-v1": JSON.stringify({ institutionId: "inst-a", clientId: "client-a", projectId: "obra-a", createdBy: "user-a" }) });
}

function getFirstStatusButton(elements, status = "C") {
  const button = elements.get("[data-item-list]").querySelectorAll("[data-status]").find((item) => item.dataset.status === status);
  assert.ok(button, "status button should exist");
  return button;
}

async function settle() { for (let index = 0; index < 4; index += 1) await new Promise((resolve) => setImmediate(resolve)); }

test("HTML e app ligam adapter/sync de forma controlada", () => {
  const html = readFileSync(HTML_PATH, "utf8");
  const app = readFileSync(APP_PATH, "utf8");
  assert.ok(html.indexOf("apartment-handover-document-adapter.js") < html.indexOf("apartment-handover-sync.js"));
  assert.ok(html.indexOf("apartment-handover-sync.js") < html.indexOf("app.js"));
  assert.match(html, /data-sync-status/);
  for (const marker of ["save_item", "quick_c", "finish_environment", "environment_na", "finalize_inspection", "reopen_inspection", "pdf_"]) assert.match(app, new RegExp(marker));
  assert.match(app, /hasSyncContext/);
  assert.match(app, /obrareport-saas-v1/);
});

test("sem contexto: sync off, zero request e C local funciona", async () => {
  const calls = [];
  const { context, elements } = loadApp({ fetchImpl: async (url, options) => { calls.push({ url, options }); return okResponse({}); } });
  assert.equal(context.VistoriaEntregaApp.isSyncEnabled(), false);
  getFirstStatusButton(elements, "C").click();
  assert.equal(context.VistoriaEntregaApp.getState().inspection.summary.counts.C, 1);
  await context.VistoriaEntregaApp.retryPendingSync("test");
  assert.equal(calls.length, 0);
  assert.equal(elements.get("[data-sync-status]").textContent, "Salvo neste aparelho");
});

test("contexto valido: C local antes do POST, depois create synced", async () => {
  const calls = [];
  const { context, elements } = loadApp({ storage: contextStorage(), fetchImpl: async (url, options) => { calls.push({ url, options, body: JSON.parse(options.body) }); return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }, 201); } });
  assert.equal(context.VistoriaEntregaApp.isSyncEnabled(), true);
  getFirstStatusButton(elements, "C").click();
  assert.equal(calls.length, 0);
  assert.equal(context.VistoriaEntregaApp.getState().inspection.summary.counts.C, 1);
  const createResult = await context.VistoriaEntregaApp.retryPendingSync("manual_test");
  await settle();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].body.inspection_data_json.items.length, 144);
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().backendInspectionId, "remote-1", JSON.stringify({ createResult, metadata: context.VistoriaEntregaApp.getSyncMetadata() }));
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().syncStatus, "synced");
});

test("update, offline, online retry e conflito preservam local", async () => {
  let mode = "ok";
  const calls = [];
  const { context, elements } = loadApp({ storage: contextStorage(), fetchImpl: async (url, options) => { calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null }); if (options.method === "GET") return okResponse({ inspection: { id: "remote-1", updated_at: mode === "conflict" ? "2026-08-29T13:00:00.000Z" : "2026-08-29T12:01:00.000Z" } }); return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }, options.method === "POST" ? 201 : 200); } });
  getFirstStatusButton(elements, "C").click();
  await context.VistoriaEntregaApp.retryPendingSync("create");
  getFirstStatusButton(elements, "C").click();
  await context.VistoriaEntregaApp.retryPendingSync("update");
  assert.ok(calls.some((call) => call.options.method === "PUT"));

  context.navigator.onLine = false;
  getFirstStatusButton(elements, "C").click();
  await context.VistoriaEntregaApp.retryPendingSync("offline");
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().syncStatus, "dirty");
  context.navigator.onLine = true;
  await context.VistoriaEntregaApp.retryPendingSync("online");
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().syncStatus, "synced");

  mode = "conflict";
  context.VistoriaEntregaApp.queueInspectionSync("local_change");
  await context.VistoriaEntregaApp.retryPendingSync("conflict");
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().syncStatus, "conflict");
  assert.equal(context.VistoriaEntregaApp.getState().inspection.items.length, 144);
});

test("tenant change, hydrate protegido e fotos metadata-only", async () => {
  const storage = contextStorage();
  const { context, elements } = loadApp({ storage, fetchImpl: async (url, options) => okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }, options.method === "POST" ? 201 : 200) });
  getFirstStatusButton(elements, "C").click();
  await context.VistoriaEntregaApp.retryPendingSync("create");
  storage.setItem("obrareport-apartment-handover-sync-context-v1", JSON.stringify({ institutionId: "inst-b", clientId: "client-a", projectId: "obra-a", createdBy: "user-a" }));
  context.VistoriaEntregaApp.queueInspectionSync("tenant_changed");
  await context.VistoriaEntregaApp.retryPendingSync("tenant_changed");
  assert.equal(context.VistoriaEntregaApp.getSyncMetadata().lastSyncError, "tenant_context_changed");

  const before = context.VistoriaEntregaApp.getState();
  const maybe = context.VistoriaEntregaApp.maybeHydrateRemote({ id: "remote-2", inspection_data_json: { inspection: { items: [] } } }, {});
  assert.equal(maybe.applied, false);
  assert.deepEqual(context.VistoriaEntregaApp.getState().inspection.summary, before.inspection.summary);

  const payload = context.ApartmentHandoverDocumentAdapter.toTransactionalPayload({ id: "photo-test", inspection: { ...before.inspection, photos: { p1: { id: "p1", fileName: "nc.jpg", mimeType: "image/jpeg", base64: "secret", data: { blob: true } } } } }, { institutionId: "inst-a", clientId: "client-a", projectId: "obra-a", createdBy: "user-a" });
  assert.equal(payload.inspection_data_json.photos.p1.base64, undefined);
  assert.equal(payload.inspection_data_json.photos.p1.data, undefined);
});

test("create dedup: mudanca durante POST nao abre segundo POST", async () => {
  const { context } = loadApp({ storage: contextStorage() });
  const state = context.VistoriaEntregaApp.getState();
  let resolvePost;
  const calls = [];
  const controller = context.ApartmentHandoverInspectionSync.createController({ apiBaseUrl: "https://backend.local", adapter: context.ApartmentHandoverDocumentAdapter, getState: () => state, getContext: () => ({ institutionId: "inst-a", clientId: "client-a", projectId: "obra-a", createdBy: "user-a" }), persistState() {}, debounceMs: 1, fetchImpl: async (url, options) => { calls.push({ url, options }); if (options.method === "POST") await new Promise((resolve) => { resolvePost = resolve; }); if (options.method === "GET") return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }); return okResponse({ inspection: { id: "remote-1", updated_at: "2026-08-29T12:01:00.000Z" } }, options.method === "POST" ? 201 : 200); } });
  const first = controller.syncNow("create");
  await settle();
  context.ApartmentHandoverInspectionSync.markDirty(state, "second_change");
  const second = controller.syncNow("second_change");
  await settle();
  assert.equal(calls.filter((call) => call.options.method === "POST").length, 1);
  resolvePost();
  await first;
  await second;
  await settle();
  assert.equal(calls.filter((call) => call.options.method === "POST").length, 1);
  assert.ok(calls.some((call) => call.options.method === "PUT"));
});
