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

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; }
  };
}

function loadSync(fetchImpl) {
  const storage = createStorage();
  storage.setItem("sb-stock-full-backend-auth-token", JSON.stringify({ access_token: "token.test" }));
  storage.setItem("stockFullSession", JSON.stringify({
    isAuthenticated: true,
    mode: "backend",
    userId: "user-e2e",
    companyId: "tenant-e2e",
    role: "admin"
  }));
  const document = {
    readyState: "complete",
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    createElement() { return { appendChild() {}, addEventListener() {}, dataset: {}, className: "" }; }
  };
  const sandbox = {
    URLSearchParams,
    window: {
      localStorage: storage,
      sessionStorage: storage,
      navigator: { onLine: true },
      location: { search: "?produto=stock-full", pathname: "/stockfull.html", hostname: "127.0.0.1", protocol: "http:", origin: "http://127.0.0.1" },
      document,
      fetch: fetchImpl,
      setTimeout() { return 1; },
      clearTimeout() {},
      addEventListener() {}
    },
    console
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(rootDir, "stock-full-core.js"), "utf8"), sandbox, { filename: "stock-full-core.js" });
  vm.runInContext(readFileSync(join(rootDir, "stock-full-sync.js"), "utf8"), sandbox, { filename: "stock-full-sync.js" });
  return sandbox.window;
}

test("Stock Full reconcilia fila confirmada sem repetir POSTs", async () => {
  const requests = [];
  const win = loadSync(async (url) => {
    requests.push(String(url));
    if (String(url).includes("/sync/status")) {
      return response({ ok: true, statuses: [{ id: "remote-entry-1", type: "entrada", operationId: "op-entry-1", offlineUuid: "op-entry-1", projectId: "" }] });
    }
    if (String(url).includes("/items")) {
      return response({ ok: true, items: [{ id: "remote-product-1", projectId: "", name: "Cimento E2E", sku: "CIM-E2E", unit: "un", category: "Material" }] });
    }
    throw new Error("unexpected_request");
  });

  win.StockFullSync.enqueue("product:create", {
    id: "tmp_product_e2e",
    name: "Cimento E2E",
    sku: "CIM-E2E",
    unit: "un",
    category: "Material"
  }, { operationId: "op-product-1", companyId: "tenant-e2e" });
  win.StockFullSync.enqueue("stock:entry", {
    id: "tmp_movement_e2e",
    itemId: "tmp_product_e2e",
    quantity: 5,
    operationId: "op-entry-1"
  }, { operationId: "op-entry-1", companyId: "tenant-e2e" });

  const queue = await win.StockFullSync.reconcileQueueWithRemote(win.StockFullSync.getQueue());
  assert.deepEqual(Array.from(queue, (item) => item.status), ["synced", "synced"]);
  assert.equal(win.StockFullSync.getIdMap().tmp_product_e2e, "remote-product-1");
  assert.equal(requests.filter((url) => url.includes("/sync/status")).length, 1);
  assert.equal(requests.filter((url) => url.includes("/items")).length, 1);
  assert.equal(requests.some((url) => url.includes("/sync\"")), false);
});
