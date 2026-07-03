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
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

function loadFrontline() {
  const storage = createStorage();
  const sandbox = {
    URLSearchParams,
    window: {
      localStorage: storage,
      URLSearchParams,
      navigator: { onLine: false },
      location: { search: "?produto=stock-full", pathname: "/stockfull.html", hostname: "127.0.0.1", protocol: "http:", origin: "http://127.0.0.1" },
      document: {
        readyState: "complete",
        addEventListener() {},
        getElementById() { return null; },
        querySelector() { return null; },
        createElement() {
          return { appendChild() {}, className: "", textContent: "", dataset: {}, setAttribute() {}, addEventListener() {} };
        }
      },
      addEventListener() {},
      setTimeout() { return 1; },
      clearTimeout() {}
    },
    console
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.localStorage.setItem("obraReportAlmoxarifadoData", JSON.stringify({
    items: [
      { id: "item_42", sku: "42", name: "Arroz", minimumStock: 10 },
      { id: "item_55", sku: "55", name: "Feijao", minimumStock: 5 }
    ],
    movements: [
      { id: "m1", itemId: "item_42", type: "entrada", quantity: 12 }
    ]
  }));
  vm.createContext(sandbox);
  ["stock-full-core.js", "stock-full-stock.js", "stock-full-sync.js", "stock-full-frontline.js"].forEach((file) => {
    vm.runInContext(readFileSync(join(rootDir, file), "utf8"), sandbox, { filename: file });
  });
  return sandbox.window;
}

test("Stock Full Frontline parseia comando com codigo lote e avaria", () => {
  const win = loadFrontline();
  const parsed = win.StockFullFrontline.parseInventoryCommand("codigo 42 lote B trinta unidades duas avariadas");

  assert.equal(parsed.productCode, "42");
  assert.equal(parsed.batch, "B");
  assert.equal(parsed.totalQuantity, 30);
  assert.equal(parsed.damagedQuantity, 2);
  assert.equal(parsed.availableQuantity, 28);
  assert.equal(parsed.operationType, "inventory_adjustment");
  assert.equal(parsed.lossType, "damaged");
  assert.equal(parsed.source, "voice_or_text_inventory");
});

test("Stock Full Frontline parseia produto por nome e retirada", () => {
  const win = loadFrontline();
  const parsed = win.StockFullFrontline.parseInventoryCommand("produto arroz retirar 3 unidades");

  assert.equal(parsed.productName, "Arroz");
  assert.equal(parsed.productId, "item_42");
  assert.equal(parsed.totalQuantity, 3);
  assert.equal(parsed.availableQuantity, 3);
  assert.equal(parsed.operationType, "stock_exit");
});

test("Stock Full Frontline cria operacao auditavel com operationId e idempotencyKey", () => {
  const win = loadFrontline();
  const parsed = win.StockFullFrontline.parseInventoryCommand("codigo 55 ajuste 20 unidades 1 perdida");
  const operation = win.StockFullFrontline.createInventoryOperation(parsed, { companyId: "empresa_1", userId: "user_1", operationId: "op_1" });

  assert.equal(operation.operationId, "op_1");
  assert.match(operation.idempotencyKey, /inventory_adjustment/);
  assert.equal(operation.companyId, "empresa_1");
  assert.equal(operation.userId, "user_1");
  assert.equal(operation.productCode, "55");
  assert.equal(operation.totalQuantity, 20);
  assert.equal(operation.availableQuantity, 19);
  assert.equal(operation.damagedQuantity, 1);
  assert.equal(operation.syncStatus, "pending");
});

test("Stock Full Frontline salva na fila offline sem duplicar idempotencyKey", () => {
  const win = loadFrontline();
  const first = win.StockFullFrontline.submitInventoryCommand("codigo 42 lote B trinta unidades duas avariadas", { companyId: "empresa_1", userId: "user_1", operationId: "op_a" });
  const second = win.StockFullFrontline.submitInventoryCommand("codigo 42 lote B trinta unidades duas avariadas", { companyId: "empresa_1", userId: "user_1", operationId: "op_b" });
  const queue = win.StockFullSync.getQueue();

  assert.equal(first.operation.availableQuantity, 28);
  assert.equal(second.operation.idempotencyKey, first.operation.idempotencyKey);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].operation, "stock:adjust");
  assert.equal(queue[0].payload.source, "voice_or_text_inventory");
  assert.equal(queue[0].payload.damagedQuantity, 2);
});

test("Stock Full Frontline registra auditoria e alerta de perda", () => {
  const win = loadFrontline();
  const result = win.StockFullFrontline.submitInventoryCommand("codigo 42 lote B trinta unidades duas avariadas", { companyId: "empresa_1", userId: "user_1", lossLimit: 1 });
  const audit = JSON.parse(win.localStorage.getItem(win.StockFullFrontline.storageKeys.audit));
  const alerts = JSON.parse(win.localStorage.getItem(win.StockFullFrontline.storageKeys.alerts));

  assert.equal(result.audit.action, "frontline_inventory_operation_created");
  assert.equal(audit.length, 1);
  assert.equal(audit[0].operationId, result.operation.operationId);
  assert.equal(audit[0].availableQuantity, 28);
  assert.equal(audit[0].damagedQuantity, 2);
  assert.ok(alerts.some((alert) => alert.type === "loss_detected"));
});

test("Stock Full Frontline gera alerta abaixo do minimo em saida", () => {
  const win = loadFrontline();
  const result = win.StockFullFrontline.submitInventoryCommand("produto arroz retirar 3 unidades", { companyId: "empresa_1", userId: "user_1" });

  assert.ok(result.alerts.some((alert) => alert.type === "below_minimum"));
});

test("Stock Full Guided Inventory inicia inventario completo com setor e checklist", () => {
  const win = loadFrontline();
  const session = win.StockFullFrontline.startGuidedInventory({ sector: "Prateleira A", mode: "inventario completo", companyId: "empresa_1", userId: "user_1", sessionId: "guided_1" });
  const audit = JSON.parse(win.localStorage.getItem(win.StockFullFrontline.storageKeys.audit));

  assert.equal(session.sessionId, "guided_1");
  assert.equal(session.sector, "Prateleira A");
  assert.equal(session.mode, "inventario_completo");
  assert.equal(session.checklist.length, 6);
  assert.ok(session.checklist.some((item) => item.label === "conferir quantidade"));
  assert.ok(audit.some((item) => item.action === "frontline_guided_session_started"));
});

test("Stock Full Guided Inventory mantem contexto entre comandos continuos", () => {
  const win = loadFrontline();
  win.StockFullFrontline.startGuidedInventory({ sector: "Deposito", mode: "conferencia rapida", companyId: "empresa_1", userId: "user_1", sessionId: "guided_2" });

  win.StockFullFrontline.handleGuidedCommand("Codigo 10");
  win.StockFullFrontline.handleGuidedCommand("15 unidades");
  win.StockFullFrontline.handleGuidedCommand("lote B");
  const result = win.StockFullFrontline.handleGuidedCommand("1 avariada");

  assert.equal(result.ready, true);
  assert.equal(result.session.currentDraft.productCode, "10");
  assert.equal(result.session.currentDraft.totalQuantity, 15);
  assert.equal(result.session.currentDraft.batch, "B");
  assert.equal(result.session.currentDraft.damagedQuantity, 1);
  assert.ok(result.checklist.find((item) => item.id === "product").done);
  assert.ok(result.checklist.find((item) => item.id === "quantity").done);
});

test("Stock Full Guided Inventory comando proximo confirma produto e troca contexto", () => {
  const win = loadFrontline();
  win.StockFullFrontline.startGuidedInventory({ sector: "Loja", mode: "auditoria", companyId: "empresa_1", userId: "user_1", sessionId: "guided_3" });
  win.StockFullFrontline.handleGuidedCommand("Codigo 10");
  win.StockFullFrontline.handleGuidedCommand("15 unidades");
  win.StockFullFrontline.handleGuidedCommand("lote B");
  win.StockFullFrontline.handleGuidedCommand("1 avariada");
  const confirmed = win.StockFullFrontline.handleGuidedCommand("proximo");
  win.StockFullFrontline.handleGuidedCommand("Codigo 11");
  win.StockFullFrontline.handleGuidedCommand("20");
  const session = win.StockFullFrontline.getGuidedSession();
  const queue = win.StockFullSync.getQueue();

  assert.equal(confirmed.ok, true);
  assert.equal(confirmed.operation.totalQuantity, 15);
  assert.equal(confirmed.operation.availableQuantity, 14);
  assert.equal(session.checkedProducts, 1);
  assert.equal(session.currentDraft.productCode, "11");
  assert.equal(session.currentDraft.totalQuantity, 20);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].payload.source, "voice_or_text_inventory");
});

test("Stock Full Guided Inventory finaliza com resumo automatico", () => {
  const win = loadFrontline();
  win.StockFullFrontline.startGuidedInventory({ sector: "Estoque geral", mode: "inventario completo", companyId: "empresa_1", userId: "user_1", sessionId: "guided_4" });
  win.StockFullFrontline.handleGuidedCommand("Codigo 10");
  win.StockFullFrontline.handleGuidedCommand("15 unidades");
  win.StockFullFrontline.handleGuidedCommand("1 avariada");
  win.StockFullFrontline.handleGuidedCommand("proximo");
  win.StockFullFrontline.handleGuidedCommand("Codigo 11");
  win.StockFullFrontline.handleGuidedCommand("20");
  const finished = win.StockFullFrontline.handleGuidedCommand("finalizar");

  assert.equal(finished.action, "finished");
  assert.equal(finished.summary.productsChecked, 2);
  assert.equal(finished.summary.totalCounted, 35);
  assert.equal(finished.summary.totalDamaged, 1);
  assert.equal(finished.summary.pendingSyncOperations, 2);
  assert.equal(finished.session.status, "finished");
});

test("Stock Full Guided Inventory nao duplica operacao ao repetir proximo", () => {
  const win = loadFrontline();
  win.StockFullFrontline.startGuidedInventory({ sector: "Deposito", mode: "auditoria", companyId: "empresa_1", userId: "user_1", sessionId: "guided_5" });
  win.StockFullFrontline.handleGuidedCommand("Codigo 10");
  win.StockFullFrontline.handleGuidedCommand("15 unidades");
  const first = win.StockFullFrontline.handleGuidedCommand("proximo");
  const second = win.StockFullFrontline.handleGuidedCommand("proximo");
  const queue = win.StockFullSync.getQueue();

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.equal(queue.length, 1);
});

test("Stock Full Guided Inventory modo funcionario mostra somente controles essenciais", () => {
  const win = loadFrontline();
  const config = win.StockFullFrontline.getEmployeeModeConfig();

  assert.deepEqual(Array.from(config.visibleControls), ["Pesquisar produto", "Comando", "Confirmar", "Proximo"]);
  assert.ok(config.hiddenControls.includes("menus administrativos"));
  assert.ok(config.allowedActions.includes("guided_command"));
});
