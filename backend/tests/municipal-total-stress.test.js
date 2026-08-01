import assert from "node:assert/strict";
import { test } from "node:test";

const SEED = "municipal-total-stress-v1";
const ROLES = ["platform_admin", "municipal_admin", "gestor", "leitura"];
const SESSION_STATES = ["active", "inactive", "missing", "expired", "invalid"];
const INSTITUTIONS = ["inst-a", "inst-b"];
const UNITS = { "inst-a": ["unit-a-1", "unit-a-2"], "inst-b": ["unit-b-1", "unit-b-2"] };

function ctx(role, institutionId = "inst-a", unitId = "unit-a-1", status = "active") {
  return {
    ok: status === "active",
    role,
    userId: `${role}-${institutionId}-${unitId}`,
    institutionId,
    unitId: role === "gestor" || role === "leitura" ? unitId : null,
    status,
    allowedUnits: role === "gestor" || role === "leitura" ? [unitId] : UNITS[institutionId]
  };
}

function denied(reason) {
  return { ok: false, reason };
}

function authorize(context, action, payload = {}) {
  if (!context || ["missing", "expired", "invalid"].includes(context.status)) return denied("session_invalid");
  if (context.status !== "active") return denied("user_inactive");
  if ("project_id" in payload) return denied("project_id_forbidden");
  const institutionId = payload.institution_id || context.institutionId;
  const unitId = payload.unit_id || context.unitId;
  if (context.role !== "platform_admin" && institutionId !== context.institutionId) return denied("institution_scope_forbidden");
  if (["write", "archive", "notify", "report_confirm"].includes(action) && context.role === "leitura") return denied("read_only");
  if (context.role === "gestor" && unitId && !context.allowedUnits.includes(unitId)) return denied("unit_scope_forbidden");
  return { ok: true, institutionId, unitId };
}

function createHarness() {
  const audit = [];
  const stock = new Map();
  const assets = new Map();
  const documents = new Map();
  const notifications = new Map();
  const reports = new Map();
  const operationIds = new Set();
  for (const institutionId of INSTITUTIONS) {
    for (const unitId of UNITS[institutionId]) {
      stock.set(`${institutionId}:${unitId}:item-main`, { institutionId, unitId, itemId: "item-main", active: true, quantity: 0, minimum: 5, entries: 0, exits: 0 });
    }
  }
  return {
    audit,
    stock,
    assets,
    documents,
    notifications,
    reports,
    applyStock(context, body) {
      const scope = authorize(context, "write", body);
      if (!scope.ok) return scope;
      if (body.quantity <= 0 || !Number.isInteger(body.quantity) || body.quantity > 1_000_000) return denied("quantity_invalid");
      if (operationIds.has(body.operation_id)) return denied("operation_duplicate");
      const item = stock.get(`${scope.institutionId}:${scope.unitId}:${body.item_id}`);
      if (!item || !item.active) return denied("item_unavailable");
      if (body.type === "exit" && item.quantity < body.quantity) return denied("insufficient_stock");
      operationIds.add(body.operation_id);
      if (body.type === "entry") { item.quantity += body.quantity; item.entries += 1; }
      if (body.type === "exit") { item.quantity -= body.quantity; item.exits += 1; }
      audit.push({ action: `stock_${body.type}`, institutionId: scope.institutionId, unitId: scope.unitId, operation_id: body.operation_id });
      return { ok: true, quantity: item.quantity };
    },
    createAsset(context, body) {
      const scope = authorize(context, "write", body);
      if (!scope.ok) return scope;
      const key = `${scope.institutionId}:${body.asset_tag}`;
      if (assets.has(key)) return denied("asset_tag_duplicate");
      assets.set(key, { ...body, institution_id: scope.institutionId, unit_id: scope.unitId, status: "ativo", history: ["created"] });
      audit.push({ action: "asset_created", institutionId: scope.institutionId, unitId: scope.unitId });
      return { ok: true };
    },
    mutateAsset(context, tag, action, next = {}) {
      const scope = authorize(context, "write", next);
      if (!scope.ok) return scope;
      const asset = assets.get(`${scope.institutionId}:${tag}`);
      if (!asset) return denied("asset_not_found");
      if (action === "transfer") asset.unit_id = next.unit_id;
      if (action === "maintenance") asset.status = "em_manutencao";
      if (action === "deactivate") asset.status = "baixado";
      asset.history.push(action);
      audit.push({ action: `asset_${action}`, institutionId: scope.institutionId, unitId: asset.unit_id });
      return { ok: true, asset };
    },
    createDocument(context, body) {
      const scope = authorize(context, "write", body);
      if (!scope.ok) return scope;
      if (!/^https?:\/\//.test(body.file_reference || "") && !String(body.file_reference || "").startsWith("/api/municipal-admin/document-files/")) return denied("file_reference_invalid");
      const key = `${scope.institutionId}:${scope.unitId}:${body.title}`;
      if (documents.has(key)) return denied("document_duplicate");
      documents.set(key, { ...body, institution_id: scope.institutionId, unit_id: scope.unitId, versions: [1], archived: false });
      audit.push({ action: "document_created", institutionId: scope.institutionId, unitId: scope.unitId });
      return { ok: true };
    },
    archiveReport(context, body) {
      const scope = authorize(context, "report_confirm", body);
      if (!scope.ok) return scope;
      if (body.confirmation !== true) return denied("confirmation_required");
      const key = `${scope.institutionId}:${body.operation_id}`;
      if (reports.has(key)) return denied("report_duplicate");
      reports.set(key, { ...body, institution_id: scope.institutionId, unit_id: scope.unitId, version: 1 });
      audit.push({ action: "report_archived", institutionId: scope.institutionId, unitId: scope.unitId });
      return { ok: true };
    },
    notify(context, body) {
      const scope = authorize(context, "notify", body);
      if (!scope.ok) return scope;
      const when = body.scheduled_at == null || body.scheduled_at === "" ? null : new Date(body.scheduled_at).toISOString();
      const key = `${scope.institutionId}:${scope.unitId}:${body.deduplication_key}`;
      if (notifications.has(key)) return { ok: true, deduplicated: true };
      notifications.set(key, { ...body, channel: "in_app", scheduled_at: when, institution_id: scope.institutionId, unit_id: scope.unitId, status: "pending" });
      audit.push({ action: "notification_created", institutionId: scope.institutionId, unitId: scope.unitId });
      return { ok: true };
    }
  };
}

test("500 combinacoes multi-tenant preservam escopo e permissoes", () => {
  const start = performance.now();
  const harness = createHarness();
  let combinations = 0;
  let deniedCount = 0;
  let acceptedCount = 0;
  for (let i = 0; i < 520; i += 1) {
    const role = ROLES[i % ROLES.length];
    const session = SESSION_STATES[i % SESSION_STATES.length];
    const institution = INSTITUTIONS[i % INSTITUTIONS.length];
    const unit = UNITS[institution][i % 2];
    const wrongInstitution = INSTITUTIONS[(i + 1) % INSTITUTIONS.length];
    const wrongUnit = UNITS[wrongInstitution][i % 2];
    const context = ctx(role, institution, unit, session);
    const result = authorize(context, i % 3 === 0 ? "write" : "read", {
      institution_id: i % 2 === 0 ? institution : wrongInstitution,
      unit_id: i % 4 === 0 ? unit : wrongUnit,
      project_id: i % 37 === 0 ? "project-x" : undefined
    });
    combinations += 1;
    if (result.ok) acceptedCount += 1;
    else deniedCount += 1;
    if (result.ok && role !== "platform_admin") assert.equal(result.institutionId, institution);
    if (result.ok && role === "gestor") assert.ok(context.allowedUnits.includes(result.unitId));
  }
  const durationMs = performance.now() - start;
  assert.equal(combinations, 520);
  assert.ok(deniedCount > acceptedCount);
  assert.ok(durationMs < 1500);
});

test("1000 operacoes de estoque mantem saldo e auditoria consistentes", () => {
  const harness = createHarness();
  const admin = ctx("municipal_admin");
  let accepted = 0;
  let rejected = 0;
  for (let i = 0; i < 1000; i += 1) {
    const type = i % 4 === 0 ? "exit" : "entry";
    const quantity = i % 97 === 0 ? 0 : 1;
    const result = harness.applyStock(admin, { institution_id: "inst-a", unit_id: "unit-a-1", item_id: "item-main", type, quantity, operation_id: `stock-${i}` });
    if (result.ok) accepted += 1;
    else rejected += 1;
  }
  const item = harness.stock.get("inst-a:unit-a-1:item-main");
  assert.equal(item.quantity, item.entries - item.exits);
  assert.equal(harness.audit.filter((row) => row.action.startsWith("stock_")).length, accepted);
  assert.ok(accepted >= 700);
  assert.ok(rejected > 0);
  assert.equal(harness.applyStock(admin, { institution_id: "inst-a", unit_id: "unit-a-1", item_id: "item-main", type: "entry", quantity: 1, operation_id: "stock-1" }).reason, "operation_duplicate");
  assert.equal(harness.applyStock(admin, { institution_id: "inst-a", unit_id: "unit-a-1", item_id: "missing", type: "entry", quantity: 1, operation_id: "stock-missing" }).reason, "item_unavailable");
});

test("500 bens, acervo, relatorios e notificacoes preservam isolamento e historico", () => {
  const harness = createHarness();
  const admin = ctx("municipal_admin");
  for (let i = 0; i < 500; i += 1) {
    const unit_id = i % 2 === 0 ? "unit-a-1" : "unit-a-2";
    assert.equal(harness.createAsset(admin, { institution_id: "inst-a", unit_id, asset_tag: `PAT-${i}`, name: `Bem ${i}` }).ok, true);
  }
  assert.equal(harness.createAsset(admin, { institution_id: "inst-a", unit_id: "unit-a-1", asset_tag: "PAT-1", name: "Duplicado" }).reason, "asset_tag_duplicate");
  assert.equal(harness.mutateAsset(admin, "PAT-2", "transfer", { institution_id: "inst-a", unit_id: "unit-a-2" }).ok, true);
  assert.equal(harness.mutateAsset(admin, "PAT-2", "maintenance", { institution_id: "inst-a", unit_id: "unit-a-2" }).ok, true);
  assert.equal(harness.mutateAsset(admin, "PAT-2", "deactivate", { institution_id: "inst-a", unit_id: "unit-a-2" }).asset.status, "baixado");
  assert.deepEqual(harness.assets.get("inst-a:PAT-2").history, ["created", "transfer", "maintenance", "deactivate"]);
  assert.equal(harness.createDocument(admin, { institution_id: "inst-a", unit_id: "unit-a-1", title: "Inventario", file_reference: "/api/municipal-admin/document-files/inventario.pdf" }).ok, true);
  assert.equal(harness.createDocument(admin, { institution_id: "inst-a", unit_id: "unit-a-1", title: "Inventario", file_reference: "/api/municipal-admin/document-files/inventario.pdf" }).reason, "document_duplicate");
  assert.equal(harness.createDocument(admin, { institution_id: "inst-a", unit_id: "unit-a-1", title: "Path", file_reference: "file:///etc/passwd" }).reason, "file_reference_invalid");
  assert.equal(harness.archiveReport(admin, { institution_id: "inst-a", unit_id: "unit-a-1", operation_id: "report-1", confirmation: false }).reason, "confirmation_required");
  assert.equal(harness.archiveReport(admin, { institution_id: "inst-a", unit_id: "unit-a-1", operation_id: "report-1", confirmation: true }).ok, true);
  assert.equal(harness.archiveReport(admin, { institution_id: "inst-a", unit_id: "unit-a-1", operation_id: "report-1", confirmation: true }).reason, "report_duplicate");
  for (let i = 0; i < 1000; i += 1) harness.notify(admin, { institution_id: "inst-a", unit_id: "unit-a-1", deduplication_key: `notif-${i % 200}`, scheduled_at: i % 2 === 0 ? null : "2026-01-01T00:00:00.000Z" });
  assert.equal(harness.notifications.size, 200);
  assert.ok(harness.audit.length >= 700);
  assert.equal([...harness.assets.values()].some((asset) => asset.institution_id === "inst-b"), false);
});

export { SEED, authorize, createHarness, ctx };
