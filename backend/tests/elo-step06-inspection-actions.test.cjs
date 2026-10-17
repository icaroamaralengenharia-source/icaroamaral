const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");

function responseJson(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => "application/json" }, json: () => Promise.resolve(body) };
}

function inspection() {
  return {
    id: "inspection-101",
    institution_id: "inst_a",
    project_id: "obra_a",
    title: "Obra A",
    status: "draft",
    inspection_data_json: {
      metadata: { projectName: "Obra A", unitName: "101" },
      items: [
        { id: "bath-wall", ambiente: "Banheiro Social", sistema: "Revestimentos", item: "Parede", status: "NI", fotos: [] },
        { id: "kitchen-floor", ambiente: "Cozinha", sistema: "Pisos", item: "Piso", status: "NI", fotos: [] }
      ]
    }
  };
}

function loadBridge(fetchImpl) {
  const source = readFileSync(path.join(repo, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8");
  const storage = new Map([["obrareport_access_token", "token-a"]]);
  const sandbox = {
    Blob: function Blob() { this.size = 1; },
    window: {
      location: { hostname: "localhost", protocol: "http:" },
      fetch: fetchImpl,
      URL: { createObjectURL: () => "blob:pdf" },
      localStorage: { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, String(value)), removeItem: (key) => storage.delete(key) },
      sessionStorage: { getItem: () => null }
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function request(message, payload = {}) {
  return { module: "inspection", payload: Object.assign({ message }, payload), context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a", projectId: "obra_a" } };
}

test("Step 06 actions route create, updateItem and attachPhoto through existing API", async () => {
  const calls = [];
  const record = inspection();
  const win = loadBridge((url, options = {}) => {
    calls.push({ url, options });
    if (options.method === "POST") return Promise.resolve(responseJson({ ok: true, inspection: record }, 201));
    if (options.method === "PUT") return Promise.resolve(responseJson({ ok: true, inspection: record }));
    return Promise.resolve(responseJson({ ok: true, inspection: record, inspections: [record] }));
  });

  const created = await win.EloCommandBridge.execute(request("ELO, inicie uma vistoria de entrega na obra X", { projectId: "obra_a", unit: "101" }));
  assert.equal(created.action, "inspection.create");
  assert.equal(created.mode, "execute");
  assert.ok(calls.some((call) => call.options.method === "POST" && call.url.includes("apartment-handover-inspections")));

  const updated = await win.EloCommandBridge.execute(request("banheiro social: parede não conforme, gravidade média", { inspectionId: record.id, itemId: "bath-wall", status: "NC", severity: "media" }));
  assert.equal(updated.action, "inspection.updateItem");
  assert.equal(updated.mode, "execute");
  const updateBody = JSON.parse(calls.find((call) => call.options.method === "PUT").options.body);
  assert.equal(updateBody.itemUpdate.itemId, "bath-wall");

  const attached = await win.EloCommandBridge.execute(request("adicione esta foto à inconformidade do banheiro", { inspectionId: record.id, itemId: "bath-wall", photo: { id: "photo-1", fileName: "banheiro.jpg", mimeType: "image/jpeg" } }));
  assert.equal(attached.action, "inspection.attachPhoto");
  assert.equal(attached.mode, "execute");
});

test("Step 06 create fails closed when project is not resolvable", async () => {
  const win = loadBridge(() => Promise.resolve(responseJson({ ok: true, inspections: [] })));
  const result = await win.EloCommandBridge.execute({ module: "inspection", payload: { message: "ELO, inicie uma vistoria de entrega para a obra X" }, context: { authToken: "token-a", institutionId: "inst_a" } });
  assert.equal(result.action, "inspection.create");
  assert.equal(result.mode, "blocked");
  assert.equal(result.error, "project_required");
});

test("Step 06 natural language parser preserves existing read actions", () => {
  const win = loadBridge(() => Promise.resolve(responseJson({ ok: true, inspections: [] })));
  assert.equal(win.EloActionBusInspection.parseIntent(request("quais inconformidades ainda estão abertas?")).action, "inspection.openNCs");
  assert.equal(win.EloActionBusInspection.parseIntent(request("gere o relatório da vistoria")).action, "inspection.generatePdf");
  assert.equal(win.EloActionBusInspection.parseIntent(request("abra a vistoria do apartamento 101")).action, "inspection.get");
});
