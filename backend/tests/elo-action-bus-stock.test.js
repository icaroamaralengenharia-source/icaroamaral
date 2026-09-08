import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    key(index) { return Array.from(data.keys())[index] || null; },
    get length() { return data.size; }
  };
}

function createResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json() { return Promise.resolve(body); }
  };
}

function loadBridge(fetchImpl) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  localStorage.setItem("stock_full_access_token", "token_123");
  const sandbox = {
    window: {
      localStorage,
      sessionStorage,
      location: { hostname: "127.0.0.1", protocol: "http:" },
      fetch: fetchImpl || (() => Promise.resolve(createResponse({ ok: true, items: [] })))
    },
    console,
    Date,
    JSON,
    Promise,
    RegExp,
    Number,
    String,
    Object,
    Array,
    Set
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(rootDir, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8"), sandbox, { filename: "elo-command-bridge.js" });
  return sandbox.window;
}

const items = [
  { id: "cimento_a", name: "Cimento CP II", unit: "saco", currentQuantity: 30, minQuantity: 10, location: "Almoxarifado A" },
  { id: "cimento_b", name: "Cimento CP II", unit: "saco", currentQuantity: 2, minQuantity: 10, location: "Almoxarifado B" },
  { id: "areia", name: "Areia media", unit: "m3", currentQuantity: 4, minQuantity: 5, location: "Patio" }
];

function request(message, context = {}) {
  return { module: "stock_full", payload: { message }, context: Object.assign({ companyId: "empresa_1", userId: "user_1" }, context) };
}

test("ELO Action Bus Stock Full parseia frases principais", () => {
  const win = loadBridge();
  assert.equal(win.EloActionBusStockFull.parseIntent(request("ELO, quanto cimento temos?")).action, "stock.query");
  assert.equal(win.EloActionBusStockFull.parseIntent(request("quais produtos existem no estoque?")).action, "stock.listProducts");
  assert.equal(win.EloActionBusStockFull.parseIntent(request("ELO, o que está acabando?")).action, "stock.lowStock");
  assert.equal(win.EloActionBusStockFull.parseIntent(request("ELO, chegaram 20 sacos de cimento.")).action, "stock.entry.preview");
  assert.equal(win.EloActionBusStockFull.parseIntent(request("ELO, dê saída de 4 sacos de cimento.")).action, "stock.exit.preview");
  assert.equal(win.EloActionBusStockFull.parseIntent(request("ELO, transfira 5 sacos de cimento para o almoxarifado B.")).action, "stock.transfer.preview");
});

test("ELO Action Bus Stock Full consulta saldo real sem inventar numero", async () => {
  const win = loadBridge((url) => {
    assert.match(url, /\/api\/stock-full\/items$/);
    return Promise.resolve(createResponse({ ok: true, items: [items[0]] }));
  });
  const result = await win.EloCommandBridge.execute(request("ELO, quanto cimento temos?"));
  assert.equal(result.action, "get_balance");
  assert.match(result.humanAnswer, /30 saco/);
  assert.match(result.humanAnswer, /Cimento/);
});

test("ELO Action Bus Stock Full lista estoque baixo real", async () => {
  const win = loadBridge(() => Promise.resolve(createResponse({ ok: true, items })));
  const result = await win.EloCommandBridge.execute(request("ELO, o que está acabando?"));
  assert.equal(result.action, "stock.lowStock");
  assert.match(result.humanAnswer, /Cimento CP II/);
  assert.match(result.humanAnswer, /Areia media/);
});

test("ELO Action Bus Stock Full lista produtos reais", async () => {
  const calls = [];
  const win = loadBridge((url) => {
    calls.push(String(url));
    return Promise.resolve(createResponse({ ok: true, items }));
  });
  const result = await win.EloCommandBridge.execute(request("quais produtos existem no estoque?"));
  assert.equal(result.action, "list_products");
  assert.match(result.humanAnswer, /Produtos no Stock Full/);
  assert.match(result.humanAnswer, /Cimento CP II: 30 saco/);
  assert.equal(calls.filter((url) => /\/api\/stock-full\/items$/.test(url)).length, 1);
});
test("ELO Action Bus Stock Full entrada exige preview e confirma uma vez", async () => {
  const calls = [];
  const win = loadBridge((url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/api/stock-full/items")) return Promise.resolve(createResponse({ ok: true, items: [items[0]] }));
    if (url.endsWith("/api/stock-full/sync")) return Promise.resolve(createResponse({ ok: true, results: [{ status: "synced" }] }));
    return Promise.resolve(createResponse({ ok: false, error: "unexpected" }, 404));
  });

  const preview = await win.EloCommandBridge.execute(request("ELO, chegaram 20 sacos de cimento."));
  assert.equal(preview.requiresConfirmation, true);
  assert.match(preview.preview, /Preview de entrada/);

  const confirmed = await win.EloCommandBridge.execute(request("sim"));
  assert.equal(confirmed.action, "stock.entry.execute");
  assert.match(confirmed.humanAnswer, /Entrada registrada/);

  const repeated = await win.EloCommandBridge.execute(request("sim"));
  assert.equal(repeated.ok, false);
  assert.match(repeated.humanAnswer, /Não há movimento pendente/);
  assert.equal(calls.filter((call) => call.url.endsWith("/api/stock-full/sync")).length, 1);
});

test("ELO Action Bus Stock Full preview de entrada resolve produto real sem executar", async () => {
  const calls = [];
  const win = loadBridge((url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith("/api/stock-full/items")) return Promise.resolve(createResponse({ ok: true, items: [{ id: "aco", name: "Aco", unit: "kg", currentQuantity: 420, minQuantity: 10 }] }));
    return Promise.resolve(createResponse({ ok: false, error: "unexpected_write" }, 500));
  });
  const preview = await win.EloCommandBridge.execute(request("registre entrada de 10 kg de Aco"));
  assert.equal(preview.requiresConfirmation, true);
  assert.equal(preview.action, "stock.entry.preview");
  assert.match(preview.preview, /10 kg de Aco/);
  assert.equal(calls.filter((call) => call.url.endsWith("/api/stock-full/items")).length, 1);
  assert.equal(calls.filter((call) => call.url.endsWith("/api/stock-full/sync")).length, 0);
});
test("ELO Action Bus Stock Full bloqueia saida com saldo insuficiente", async () => {
  const win = loadBridge(() => Promise.resolve(createResponse({ ok: true, items: [items[1]] })));
  const result = await win.EloCommandBridge.execute(request("ELO, dê saída de 4 sacos de cimento."));
  assert.equal(result.ok, false);
  assert.match(result.humanAnswer, /saldo insuficiente/i);
  assert.equal(win.EloActionBusStockFull.readPending(), null);
});

test("ELO Action Bus Stock Full transfere via endpoint dedicado apos confirmacao", async () => {
  const calls = [];
  const win = loadBridge((url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith("/api/stock-full/items")) return Promise.resolve(createResponse({ ok: true, items }));
    if (url.endsWith("/api/stock-full/transfers")) return Promise.resolve(createResponse({ ok: true, status: "synced", operationId: "op_1" }));
    return Promise.resolve(createResponse({ ok: false, error: "unexpected" }, 404));
  });

  const preview = await win.EloCommandBridge.execute(request("ELO, transfira 5 sacos de cimento para o almoxarifado B."));
  assert.equal(preview.action, "stock.transfer.preview");
  assert.match(preview.preview, /Transfer|transfer/i);

  const confirmed = await win.EloCommandBridge.execute(request("confirmar"));
  assert.equal(confirmed.action, "stock.transfer.execute");
  assert.match(confirmed.humanAnswer, /Transferência registrada/);
  const transferCall = calls.find((call) => call.url.endsWith("/api/stock-full/transfers"));
  assert.ok(transferCall);
  const body = JSON.parse(transferCall.options.body);
  assert.equal(body.sourceItemId, "cimento_a");
  assert.equal(body.destinationItemId, "cimento_b");
  assert.equal(body.quantity, 5);
});

test("ELO Action Bus Stock Full bloqueia sim sem pendencia", async () => {
  const win = loadBridge();
  const result = await win.EloCommandBridge.execute(request("sim"));
  assert.equal(result.ok, false);
  assert.match(result.humanAnswer, /Não há movimento pendente/);
});

test("ELO Action Bus Stock Full relata falha honesta do backend", async () => {
  const win = loadBridge(() => Promise.resolve(createResponse({ ok: false, error: "stock_full_items_query_failed" }, 500)));
  const result = await win.EloCommandBridge.execute(request("ELO, quanto cimento temos?"));
  assert.equal(result.ok, false);
  assert.match(result.humanAnswer, /backend retornou/);
  assert.match(result.error, /stock_full_items_query_failed/);
});

test("ELO Action Bus Stock Full exige autenticacao para consulta real", async () => {
  const win = loadBridge(() => { throw new Error("fetch_should_not_run"); });
  win.localStorage.removeItem("stock_full_access_token");
  const result = await win.EloCommandBridge.execute(request("ELO, quanto cimento temos?"));
  assert.equal(result.requiresAuth, true);
  assert.match(result.humanAnswer, /autenticação/);
});
