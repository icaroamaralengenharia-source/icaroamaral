const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");

function responseJson(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: () => Promise.resolve(body)
  };
}

function responsePdf(bytes = "%PDF-1.4 test") {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name === "content-type" ? "application/pdf" : "" },
    blob: () => Promise.resolve({ size: bytes.length, type: "application/pdf" })
  };
}

function inspection(overrides = {}) {
  return Object.assign({
    id: "inspection-202",
    institution_id: "inst_a",
    project_id: "obra_a",
    title: "Vistoria Torre A",
    status: "completed",
    updated_at: "2026-09-06T10:00:00.000Z",
    inspection_data_json: {
      metadata: { projectName: "Obra A", unitName: "202", technicalResponsible: "RT", professionalRegistry: "CREA TESTE" },
      items: [
        { ambiente: "Sala", item: "Rodape", status: "NC", severidade: "Alta", descricaoTecnica: "Rodape solto", recomendacaoAcao: "Refixar", fotos: [{ id: "foto-1" }] },
        { ambiente: "Cozinha", item: "Pintura", status: "NC", severidade: "Baixa", descricaoTecnica: "Retoque pendente", situacao: "Resolvido", fotos: [] },
        { ambiente: "Banheiro", item: "Torneira", status: "C", severidade: "", descricaoTecnica: "" },
        { ambiente: "Quarto", item: "Porta", status: "NC", severidade: "Media", descricaoTecnica: "Folga excessiva", fotos: [] }
      ]
    }
  }, overrides);
}

function loadBridge(fetchImpl) {
  const source = readFileSync(path.join(repo, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8");
  const storage = new Map([["obrareport_access_token", "token-a"]]);
  const sandbox = {
    Blob: function Blob(parts) { this.size = (parts || []).join("").length; },
    window: {
      location: { hostname: "localhost", protocol: "http:" },
      URL: { createObjectURL: () => "blob:inspection-pdf" },
      fetch: fetchImpl,
      localStorage: {
        get length() { return storage.size; },
        key(index) { return Array.from(storage.keys())[index] || null; },
        getItem(key) { return storage.has(key) ? storage.get(key) : null; },
        setItem(key, value) { storage.set(key, String(value)); },
        removeItem(key) { storage.delete(key); }
      }
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

function request(message, extra = {}) {
  return Object.assign({
    module: "inspection",
    payload: { message },
    context: { authToken: "token-a", institutionId: "inst_a", userId: "user_a", projectId: "obra_a" }
  }, extra);
}

test("ELO Action Bus Vistoria parseia intenções principais", () => {
  const win = loadBridge(() => Promise.resolve(responseJson({ ok: true, inspections: [] })));
  assert.equal(win.EloActionBusInspection.parseIntent(request("quais vistorias temos?")).action, "inspection.list");
  assert.equal(win.EloActionBusInspection.parseIntent(request("abra a vistoria do apartamento 202")).action, "inspection.get");
  assert.equal(win.EloActionBusInspection.parseIntent(request("quais NCs estão abertas?")).action, "inspection.openNCs");
  assert.equal(win.EloActionBusInspection.parseIntent(request("gere o laudo dessa vistoria")).action, "inspection.generatePdf");
});

test("inspection.list, get e openNCs usam dados reais e ordenam severidade", async () => {
  const records = [inspection(), inspection({ id: "inspection-303", inspection_data_json: { metadata: { unitName: "303" }, items: [] } })];
  const win = loadBridge((url) => Promise.resolve(url.includes("/inspection-202") ? responseJson({ ok: true, inspection: records[0] }) : responseJson({ ok: true, inspections: records })));

  const list = await win.EloCommandBridge.execute(request("quais vistorias temos?"));
  assert.equal(list.action, "inspection.list");
  assert.equal(list.data.inspections.length, 2);

  const got = await win.EloCommandBridge.execute(request("abra a vistoria do apartamento 202"));
  assert.equal(got.action, "inspection.get");
  assert.equal(got.data.inspection.unit, "202");

  const ncs = await win.EloCommandBridge.execute(request("quais não conformidades estão abertas no apartamento 202?"));
  assert.equal(ncs.action, "inspection.openNCs");
  assert.deepEqual(ncs.data.ncs.map((item) => item.item), ["Rodape", "Porta"]);
  assert.equal(ncs.data.ncs[0].evidencias, 1);
  assert.doesNotMatch(ncs.humanAnswer, /Pintura/);
});

test("inspection.get não escolhe vistoria ambígua e bloqueia tenant/auth ausentes", async () => {
  const records = [inspection({ id: "a" }), inspection({ id: "b" })];
  const win = loadBridge(() => Promise.resolve(responseJson({ ok: true, inspections: records })));
  const ambiguous = await win.EloCommandBridge.execute(request("abra a vistoria do apartamento 202"));
  assert.equal(ambiguous.ok, false);
  assert.equal(ambiguous.mode, "blocked");
  assert.equal(ambiguous.error, "inspection_ambiguous");

  win.localStorage.removeItem("obrareport_access_token");
  const noAuth = await win.EloCommandBridge.execute(request("quais vistorias temos?", { context: { institutionId: "inst_a" } }));
  assert.equal(noAuth.requiresAuth, true);

  const noTenant = await win.EloCommandBridge.execute(request("quais vistorias temos?", { context: { authToken: "token-a" } }));
  assert.equal(noTenant.ok, false);
  assert.equal(noTenant.error, "institution_required");
});

test("inspection.openNCs responde lista vazia honesta", async () => {
  const win = loadBridge(() => Promise.resolve(responseJson({ ok: true, inspections: [inspection({ inspection_data_json: { metadata: { unitName: "202" }, items: [{ ambiente: "Sala", item: "Piso", status: "C" }] } })] })));
  const result = await win.EloCommandBridge.execute(request("quais NCs estão abertas no apartamento 202?"));
  assert.equal(result.ok, true);
  assert.equal(result.data.ncs.length, 0);
  assert.match(result.humanAnswer, /Não encontrei NCs abertas/);
});

test("inspection.generatePdf chama gerador real e não mascara falha", async () => {
  const calls = [];
  const win = loadBridge((url, options = {}) => {
    calls.push({ url, options });
    if (url.includes("apartment-handover/pdf")) return Promise.resolve(responsePdf());
    return Promise.resolve(responseJson({ ok: true, inspections: [inspection()] }));
  });
  const pdf = await win.EloCommandBridge.execute(request("gere o PDF da vistoria do apartamento 202"));
  assert.equal(pdf.action, "inspection.generatePdf");
  assert.equal(pdf.mode, "execute");
  assert.equal(pdf.data.pdfUrl, "blob:inspection-pdf");
  assert.ok(calls.some((call) => call.url.includes("/api/apartment-handover/pdf") && call.options.method === "POST"));

  const failWin = loadBridge((url) => Promise.resolve(url.includes("apartment-handover/pdf") ? responseJson({ ok: false, error: "pdf_backend_down" }, 500) : responseJson({ ok: true, inspections: [inspection()] })));
  const failed = await failWin.EloCommandBridge.execute(request("gere o PDF da vistoria do apartamento 202"));
  assert.equal(failed.ok, false);
  assert.equal(failed.mode, "error");
  assert.match(failed.humanAnswer, /pdf_backend_down/);
});
