import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalNotificationService } from "../src/municipal-notification-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }, overrides.profile || {})
  };
}

function setup(extra = {}, options = {}) {
  const store = createMemoryMunicipalAdminStore(Object.assign({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Central", status: "active" },
      { id: "unit-a2", institution_id: "inst-a", name: "Norte", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Outra", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: "admin-user", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: "gestor-user", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active" },
      { id: "profile-leitura", auth_user_id: "leitura-user", institution_id: "inst-a", unit_id: "unit-a", role: "leitura", status: "active" },
      { id: "profile-b", auth_user_id: "admin-b", institution_id: "inst-b", unit_id: "unit-b", role: "municipal_admin", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Zerado", minimum_quantity: 5 },
      { id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", name: "Normal", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-ok", item_id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", quantity: 3, status: "aprovada" }
    ],
    stock_exits: [],
    stock_audit_log: [],
    municipal_assets: [{ id: "asset-ruim", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-1", name: "Mesa", condition: "ruim", status: "ativo" }],
    municipal_documents: [],
    municipal_document_versions: [],
    municipal_notifications: [],
    municipal_admin_audit_log: []
  }, extra));
  return { store, service: createMunicipalNotificationService({ store, env: options.env || {} }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("cria notificacao in-app, deduplica alerta repetido e registra auditoria", async () => {
  const { store, service } = setup();
  const body = {
    unit_id: "unit-a",
    recipient_user_id: "gestor-user",
    source_type: "sentinel_alert",
    source_id: "alert-zero",
    title: "Item zerado",
    message: "Alerta interno",
    severity: "high"
  };
  const first = await service.createNotification(ctx("municipal_admin", { userId: "admin-user" }), body);
  const second = await service.createNotification(ctx("municipal_admin", { userId: "admin-user" }), body);
  assert.equal(first.notification.status, "pending");
  assert.equal(second.deduplicated, true);
  assert.equal(store.tables.municipal_notifications.length, 1);
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_created"));
});

test("gestor ve apenas notificacoes autorizadas e tenant externo e bloqueado", async () => {
  const { service } = setup({
    municipal_notifications: [
      { id: "n1", institution_id: "inst-a", unit_id: "unit-a", recipient_user_id: "gestor-user", source_type: "manual", source_id: "1", channel: "in_app", title: "A", message: "A", severity: "high", status: "pending", deduplication_key: "n1", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n2", institution_id: "inst-a", unit_id: "unit-a2", recipient_user_id: "admin-user", source_type: "manual", source_id: "2", channel: "in_app", title: "A2", message: "A2", severity: "high", status: "pending", deduplication_key: "n2", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n3", institution_id: "inst-b", unit_id: "unit-b", recipient_user_id: "admin-b", source_type: "manual", source_id: "3", channel: "in_app", title: "B", message: "B", severity: "high", status: "pending", deduplication_key: "n3", created_at: "2026-01-02T00:00:00.000Z" }
    ]
  });
  const listed = await service.listNotifications(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }));
  assert.deepEqual(listed.notifications.map((row) => row.id), ["n1"]);
  await rejectsCode(service.listNotifications(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }), { institution_id: "inst-b" }), "institution_scope_forbidden");
  await rejectsCode(service.createNotification(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }), { unit_id: "unit-a2", recipient_user_id: "gestor-user", title: "externa" }), "unit_scope_forbidden");
});

test("marca como lida, calcula unread-count e permite cancelamento seguro", async () => {
  const { store, service } = setup({
    municipal_notifications: [
      { id: "n1", institution_id: "inst-a", unit_id: "unit-a", recipient_user_id: "gestor-user", source_type: "manual", source_id: "1", channel: "in_app", title: "A", message: "A", severity: "high", status: "pending", deduplication_key: "n1", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n2", institution_id: "inst-a", unit_id: "unit-a", recipient_user_id: "gestor-user", source_type: "manual", source_id: "2", channel: "in_app", title: "B", message: "B", severity: "medium", status: "pending", deduplication_key: "n2", created_at: "2026-01-03T00:00:00.000Z" }
    ]
  });
  assert.equal((await service.unreadCount(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }))).unread_count, 2);
  const read = await service.markRead(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }), "n1");
  assert.equal(read.notification.status, "read");
  assert.equal((await service.unreadCount(ctx("gestor", { userId: "gestor-user", unitId: "unit-a" }))).unread_count, 1);
  const cancelled = await service.cancel(ctx("municipal_admin", { userId: "admin-user" }), "n2");
  assert.equal(cancelled.notification.status, "cancelled");
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_read"));
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_cancelled"));
});

test("whatsapp desligado, email sem credencial e dados sensiveis falham com seguranca", async () => {
  const { service } = setup({}, { env: { MUNICIPAL_WHATSAPP_ENABLED: "false", MUNICIPAL_EMAIL_ENABLED: "true" } });
  const whatsapp = await service.createNotification(ctx("municipal_admin", { userId: "admin-user" }), {
    unit_id: "unit-a",
    recipient_user_id: "gestor-user",
    channel: "whatsapp",
    source_type: "sentinel_alert",
    source_id: "w1",
    title: "Telefone +55 77 99999-9999",
    message: "token=SEGREDO gestor@elo-e2e.test",
    metadata: { phone: "+55 77 99999-9999", token: "SEGREDO", visible: "ok" }
  });
  assert.equal(whatsapp.notification.status, "failed");
  assert.equal(whatsapp.notification.failure_reason, "whatsapp_disabled");
  const serialized = JSON.stringify(whatsapp.notification);
  assert.equal(serialized.includes("SEGREDO"), false);
  assert.equal(serialized.includes("gestor@elo-e2e.test"), false);
  assert.equal(serialized.includes("99999-9999"), false);
  assert.equal(whatsapp.notification.metadata.visible, "ok");

  const email = await service.createNotification(ctx("municipal_admin", { userId: "admin-user" }), {
    unit_id: "unit-a",
    recipient_user_id: "gestor-user",
    channel: "email",
    source_type: "manual",
    source_id: "email1",
    title: "Email"
  });
  assert.equal(email.notification.status, "failed");
  assert.equal(email.notification.failure_reason, "email_not_configured");
});

test("dispatch do Sentinela gera fila sem alterar estoque, patrimonio ou documentos", async () => {
  const { store, service } = setup();
  const beforeStock = JSON.stringify({ items: store.tables.stock_items, entries: store.tables.stock_entries, exits: store.tables.stock_exits });
  const beforeAssets = JSON.stringify(store.tables.municipal_assets);
  const beforeDocs = JSON.stringify(store.tables.municipal_documents);
  const result = await service.dispatch(ctx("municipal_admin", { userId: "admin-user" }), { scan: true, unit_id: "unit-a" });
  assert.ok(result.notifications.some((row) => row.source_type === "sentinel_alert" && row.severity === "high"));
  assert.ok(result.notifications.some((row) => row.metadata && row.metadata.rule_code === "item_zero_stock"));
  assert.equal(JSON.stringify({ items: store.tables.stock_items, entries: store.tables.stock_entries, exits: store.tables.stock_exits }), beforeStock);
  assert.equal(JSON.stringify(store.tables.municipal_assets), beforeAssets);
  assert.equal(JSON.stringify(store.tables.municipal_documents), beforeDocs);
});
