const assert = require("node:assert/strict");
const test = require("node:test");

const docsPromise = import("./operational-documents.js").then(() => globalThis.ObraReportOperationalDocuments);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildState() {
  return {
    version: 1,
    works: [
      { id: "obra-a", clientId: "cliente-a", name: "Obra A" },
      { id: "obra-b", clientId: "cliente-b", name: "Obra B" }
    ],
    reports: [{ id: "rel-qualidade", workId: "obra-a", title: "Relatorio de Qualidade", pdfUrl: "https://example.test/report.pdf" }],
    dailyLogs: [
      { id: "rdo-a", workId: "obra-a", updatedAt: "2026-08-02T08:00:00.000Z", materials: [{ name: "Bloco", quantity: 12 }] },
      { id: "rdo-b", workId: "obra-b", updatedAt: "2026-08-02T08:00:00.000Z", materials: [{ name: "Cimento", quantity: 3 }] }
    ],
    executionStockAlerts: [
      { id: "alert-a", version: 1, workId: "obra-a", sourceRdoId: "rdo-a", status: "open", title: "Consumo acima" },
      { id: "alert-b", version: 1, workId: "obra-b", sourceRdoId: "rdo-b", status: "open", title: "Consumo acima B" }
    ],
    stockMovements: [{ id: "mov-a", workId: "obra-a", quantity: 1 }],
    stockBalances: [{ id: "bal-a", workId: "obra-a", balance: 10 }]
  };
}

async function registerBase(state, overrides = {}) {
  const docs = await docsPromise;
  return docs.registerOperationalDocument(state, Object.assign({
    type: "rdo",
    workId: "obra-a",
    clientId: "cliente-a",
    title: "RDO - Obra A",
    sourceRdoIds: ["rdo-a"],
    sourceAlertIds: ["alert-a"],
    analysisFingerprint: "fp-1",
    renderer: "daily_log_pdf_v1"
  }, overrides), { now: "2026-08-02T10:00:00.000Z" });
}

test("gerar relatorio registra documento operacional sem payload pesado", async () => {
  const state = buildState();
  const result = await registerBase(state);

  assert.equal(result.ok, true);
  assert.equal(result.created, true);
  assert.equal(state.operationalDocuments.length, 1);
  const documentItem = state.operationalDocuments[0];
  assert.equal(documentItem.type, "rdo");
  assert.equal(documentItem.workId, "obra-a");
  assert.equal(documentItem.sourceRdoIds[0], "rdo-a");
  assert.equal(documentItem.sourceAlertIds[0], "alert-a");
  assert.equal(Object.hasOwn(documentItem, "html"), false);
  assert.equal(Object.hasOwn(documentItem, "pdf"), false);
  assert.equal(Object.hasOwn(documentItem, "blob"), false);
  assert.equal(JSON.stringify(documentItem).includes("base64"), false);
});

test("mesmo relatorio nao duplica e fingerprint novo atualiza registro", async () => {
  const state = buildState();
  await registerBase(state);
  const firstId = state.operationalDocuments[0].id;
  const firstCreatedAt = state.operationalDocuments[0].createdAt;
  await registerBase(state, { analysisFingerprint: "fp-2" });

  assert.equal(state.operationalDocuments.length, 1);
  assert.equal(state.operationalDocuments[0].id, firstId);
  assert.equal(state.operationalDocuments[0].createdAt, firstCreatedAt);
  assert.equal(state.operationalDocuments[0].analysisFingerprint, "fp-2");
});

test("reload preserva documento e obras diferentes ficam isoladas", async () => {
  const state = buildState();
  await registerBase(state);
  await registerBase(state, { workId: "obra-b", clientId: "cliente-b", sourceRdoIds: ["rdo-b"], sourceAlertIds: ["alert-b"], title: "RDO - Obra B" });
  const reloaded = clone(state);
  const docs = await docsPromise;

  assert.equal(docs.getDocumentsForWork(reloaded, "obra-a", { type: "all", status: "all" }).length, 1);
  assert.equal(docs.getDocumentsForWork(reloaded, "obra-b", { type: "all", status: "all" }).length, 1);
});

test("abrir documento regenera HTML e altera somente lastOpenedAt", async () => {
  const state = buildState();
  const before = clone({ dailyLogs: state.dailyLogs, alerts: state.executionStockAlerts, stockMovements: state.stockMovements, stockBalances: state.stockBalances });
  await registerBase(state);
  const docs = await docsPromise;
  const id = state.operationalDocuments[0].id;
  let networkCalls = 0;
  const previousFetch = globalThis.fetch;
  globalThis.fetch = function () { networkCalls += 1; throw new Error("network_forbidden"); };
  try {
    const opened = docs.openOperationalDocument(state, id, {
      rdo(documentItem) {
        return { ok: true, html: "<html><body>" + documentItem.sourceRdoIds[0] + "</body></html>" };
      }
    }, { now: "2026-08-02T11:00:00.000Z" });

    assert.equal(opened.ok, true);
    assert.match(opened.html, /rdo-a/);
    assert.equal(state.operationalDocuments[0].lastOpenedAt, "2026-08-02T11:00:00.000Z");
    assert.deepEqual({ dailyLogs: state.dailyLogs, alerts: state.executionStockAlerts, stockMovements: state.stockMovements, stockBalances: state.stockBalances }, before);
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("origem ausente torna documento obsoleto sem apagar historico", async () => {
  const state = buildState();
  await registerBase(state);
  const docs = await docsPromise;
  const id = state.operationalDocuments[0].id;
  state.dailyLogs = [];

  const opened = docs.openOperationalDocument(state, id, { rdo() { return { ok: true, html: "<html></html>" }; } }, { now: "2026-08-02T12:00:00.000Z" });

  assert.equal(opened.ok, false);
  assert.equal(opened.reason, "missing_rdo");
  assert.equal(state.operationalDocuments.length, 1);
  assert.equal(state.operationalDocuments[0].status, "obsolete");
});

test("colecao ausente ou antiga nao quebra e relatorios de qualidade ficam intactos", async () => {
  const docs = await docsPromise;
  const state = buildState();
  delete state.operationalDocuments;
  const qualityReports = clone(state.reports);

  assert.deepEqual(docs.getDocumentsForWork(state, "obra-a", { type: "all", status: "all" }), []);
  await registerBase(state);

  assert.equal(Array.isArray(state.operationalDocuments), true);
  assert.deepEqual(state.reports, qualityReports);
});

test("referencias de outra obra sao rejeitadas", async () => {
  const state = buildState();
  const result = await registerBase(state, { sourceRdoIds: ["rdo-b"] });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_rdo");
  assert.equal(state.operationalDocuments.length, 0);
});
