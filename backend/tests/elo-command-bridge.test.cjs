const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");

function loadBridge(options = {}) {
  const source = readFileSync(path.join(repo, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8");
  const storage = new Map();
  const sandbox = {
    window: {
      localStorage: {
        get length() {
          return storage.size;
        },
        key(index) {
          return Array.from(storage.keys())[index] || null;
        },
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
          storage.set(key, String(value));
        },
        removeItem(key) {
          storage.delete(key);
        }
      },
      fetch: options.fetch,
      location: options.location || { hostname: "localhost", protocol: "http:" }
    }
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.sessionStorage = sandbox.window.localStorage;
  if (options.authToken) sandbox.window.localStorage.setItem("stock_full_access_token", options.authToken);
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

test("EloCommandBridge expõe contrato central sem CADISTA", () => {
  const window = loadBridge();
  assert.equal(typeof window.EloCommandBridge.execute, "function");
  assert.deepEqual(Array.from(window.EloCommandBridge.modules), [
    "budget",
    "inspection",
    "obrareport_rdo",
    "obrareport_report",
    "stock_full",
    "stock_obras",
    "elo_autopilot",
    "municipal",
    "municipal_sentinel",
    "memory",
    "alerts"
  ]);
  assert.equal(window.EloCommandBridge.modules.includes("cadista"), false);
});

test("EloCommandBridge retorna preview e confirmação para ações perigosas", () => {
  const window = loadBridge();
  const response = window.EloCommandBridge.execute({
    module: "stock_full",
    action: "stock_exit",
    payload: { message: "registre saída de 12 sacos para a obra A" },
    dryRun: true
  });
  assert.equal(response.handled, true);
  assert.equal(response.module, "stock_full");
  assert.equal(response.mode, "preview");
  assert.equal(response.requiresConfirmation, true);
  assert.match(response.humanAnswer, /preview|confirma/i);
  assert.doesNotMatch(JSON.stringify(response), /sessionIntent|sessionTheme|Ready for cost|Auditoria t/i);
});

test("EloCommandBridge consulta módulos de leitura sem fingir escrita", () => {
  const window = loadBridge();
  window.localStorage.setItem("elo_budget_records", JSON.stringify([{ numero: "ELO-1", status: "rascunho" }]));
  const budget = window.EloCommandBridge.execute({
    module: "budget",
    action: "list",
    payload: { message: "listar orçamentos" },
    dryRun: true
  });
  assert.equal(budget.handled, true);
  assert.equal(budget.requiresConfirmation, false);
  assert.match(budget.humanAnswer, /orçamento|orcamento/i);

  const stockObras = window.EloCommandBridge.execute({
    module: "stock_obras",
    action: "search_composition",
    payload: { message: "pesquise composição SINAPI para alvenaria" },
    dryRun: true
  });
  assert.equal(stockObras.handled, true);
  assert.equal(stockObras.requiresConfirmation, false);
  assert.match(stockObras.humanAnswer, /bases locais|compos/i);
});

test("EloCommandBridge está carregado nas superfícies ELO sem tocar CADISTA", () => {
  const elo = readFileSync(path.join(repo, "elo.html"), "utf8");
  const stockObras = readFileSync(path.join(repo, "stock-ai-obras.html"), "utf8");
  const obraReport = readFileSync(path.join(repo, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html"), "utf8");
  const cadista = readFileSync(path.join(repo, "cadista", "index.html"), "utf8");
  assert.match(elo, /elo-command-bridge\.js/);
  assert.match(stockObras, /elo-command-bridge\.js/);
  assert.match(obraReport, /elo-command-bridge\.js/);
  assert.doesNotMatch(cadista, /elo-command-bridge\.js/);
});

function createStockBridgeHarness(options = {}) {
  const requests = [];
  const items = (options.items || []).slice();
  const window = loadBridge({
    authToken: options.authToken === false ? "" : "token.test",
    fetch(url, config = {}) {
      const method = config.method || "GET";
      requests.push({ url, method, body: config.body ? JSON.parse(config.body) : null });
      if (url.endsWith("/api/stock-full/items") && method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, items: items.slice() }) });
      }
      if (url.endsWith("/api/stock-full/items") && method === "POST") {
        const body = config.body ? JSON.parse(config.body) : {};
        if (!body.name) return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ ok: false, error: "name_required" }) });
        const item = { id: "created_" + (items.length + 1), name: body.name, unit: body.unit || "un", category: body.category || "Geral", minQuantity: body.minQuantity || 0, currentQuantity: body.currentQuantity || 0 };
        items.push(item);
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, mode: "remote", item }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ ok: false, error: "unexpected_request" }) });
    }
  });
  const context = {
    authToken: options.authToken === false ? "" : "token.test",
    identity: {
      companyId: options.companyId === false ? "" : "inst_auth",
      userId: "profile_auth",
      role: options.role || "gestor"
    }
  };
  return { window, requests, items, context };
}

test("EloActionBusStockFull gera preview de cadastro sem POST", async () => {
  const harness = createStockBridgeHarness();
  const response = await harness.window.EloCommandBridge.execute({
    module: "stock_full",
    action: "create_product",
    payload: { message: "cadastre um produto chamado TESTE ELO E2E com unidade kg" },
    context: harness.context
  });
  assert.equal(response.handled, true);
  assert.equal(response.module, "stock_full");
  assert.equal(response.action, "stock.create_product");
  assert.equal(response.mode, "preview");
  assert.equal(response.requiresConfirmation, true);
  assert.match(response.humanAnswer, /NAME: TESTE ELO E2E/);
  assert.match(response.humanAnswer, /UNIT: kg/);
  assert.match(response.humanAnswer, /WRITE EXECUTED: 0/);
  assert.equal(harness.requests.filter((request) => request.method === "POST" && request.url.endsWith("/api/stock-full/items")).length, 0);
});

test("EloActionBusStockFull confirma cadastro com um POST real controlado", async () => {
  const harness = createStockBridgeHarness();
  await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "cadastre um produto chamado TESTE ELO E2E com unidade kg" }, context: harness.context });
  const response = await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "stock_confirm", payload: { message: "confirmar" }, context: harness.context });
  const posts = harness.requests.filter((request) => request.method === "POST" && request.url.endsWith("/api/stock-full/items"));
  assert.equal(posts.length, 1);
  assert.equal(posts[0].body.name, "TESTE ELO E2E");
  assert.equal(posts[0].body.unit, "kg");
  assert.equal(posts[0].body.category, "Geral");
  assert.equal(posts[0].body.currentQuantity, 0);
  assert.match(posts[0].body.notes, /operationId=/);
  assert.equal(response.mode, "execute");
  assert.match(response.humanAnswer, /Produto cadastrado/);
});

test("EloActionBusStockFull sem confirmação não executa POST", async () => {
  const harness = createStockBridgeHarness();
  await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "adicione um novo produto ao estoque chamado Produto Sem Confirmacao com unidade un" }, context: harness.context });
  assert.equal(harness.requests.filter((request) => request.method === "POST").length, 0);
});

test("EloActionBusStockFull confirmação repetida não duplica cadastro", async () => {
  const harness = createStockBridgeHarness();
  await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "crie um produto no estoque chamado Produto Idempotente com unidade kg" }, context: harness.context });
  await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "stock_confirm", payload: { message: "sim" }, context: harness.context });
  await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "stock_confirm", payload: { message: "sim" }, context: harness.context });
  assert.equal(harness.requests.filter((request) => request.method === "POST" && request.url.endsWith("/api/stock-full/items")).length, 1);
});

test("EloActionBusStockFull bloqueia payload inválido antes de POST", async () => {
  const harness = createStockBridgeHarness();
  const response = await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "cadastre um produto chamado com unidade kg" }, context: harness.context });
  assert.equal(response.ok, false);
  assert.equal(response.error, "name_required");
  assert.equal(harness.requests.filter((request) => request.method === "POST").length, 0);
});

test("EloActionBusStockFull bloqueia cadastro fora de tenant antes de POST", async () => {
  const harness = createStockBridgeHarness({ companyId: false });
  const response = await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "cadastre um produto chamado Produto Tenant com unidade kg" }, context: harness.context });
  assert.equal(response.ok, false);
  assert.equal(response.error, "institution_required");
  assert.equal(harness.requests.filter((request) => request.method === "POST").length, 0);
});

test("EloActionBusStockFull bloqueia usuário sem permissão antes de POST", async () => {
  const harness = createStockBridgeHarness({ role: "leitura" });
  const response = await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "cadastre um produto chamado Produto Leitura com unidade kg" }, context: harness.context });
  assert.equal(response.ok, false);
  assert.equal(response.error, "permission_denied");
  assert.equal(harness.requests.filter((request) => request.method === "POST").length, 0);
});

test("EloActionBusStockFull bloqueia duplicidade exata no tenant antes de POST", async () => {
  const harness = createStockBridgeHarness({ items: [{ id: "item_1", name: "TESTE ELO E2E", unit: "kg", currentQuantity: 0, minQuantity: 0 }] });
  const response = await harness.window.EloCommandBridge.execute({ module: "stock_full", action: "create_product", payload: { message: "cadastre um produto chamado TESTE ELO E2E com unidade kg" }, context: harness.context });
  assert.equal(response.ok, false);
  assert.equal(response.error, "stock_full_product_duplicate");
  assert.equal(harness.requests.filter((request) => request.method === "POST").length, 0);
});
