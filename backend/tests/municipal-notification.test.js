import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createMunicipalNotificationService } from "../src/municipal-notification-service.js";

const IDS = {
  instA: "11111111-1111-4111-8111-111111111111",
  instB: "22222222-2222-4222-8222-222222222222",
  unitA: "33333333-3333-4333-8333-333333333333",
  unitA2: "44444444-4444-4444-8444-444444444444",
  unitB: "55555555-5555-4555-8555-555555555555",
  admin: "66666666-6666-4666-8666-666666666666",
  gestor: "77777777-7777-4777-8777-777777777777",
  leitura: "88888888-8888-4888-8888-888888888888",
  adminB: "99999999-9999-4999-8999-999999999999"
};

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? IDS.instA,
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? IDS.instA,
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }, overrides.profile || {})
  };
}

function setup(extra = {}, options = {}) {
  const store = createMemoryMunicipalAdminStore(Object.assign({
    institutions: [
      { id: IDS.instA, name: "Prefeitura A", status: "active" },
      { id: IDS.instB, name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: IDS.unitA, institution_id: IDS.instA, name: "Central", status: "active" },
      { id: IDS.unitA2, institution_id: IDS.instA, name: "Norte", status: "active" },
      { id: IDS.unitB, institution_id: IDS.instB, name: "Outra", status: "active" }
    ],
    profiles: [
      { id: "profile-admin", auth_user_id: IDS.admin, institution_id: IDS.instA, unit_id: null, role: "municipal_admin", status: "active" },
      { id: "profile-gestor", auth_user_id: IDS.gestor, institution_id: IDS.instA, unit_id: IDS.unitA, role: "gestor", status: "active" },
      { id: "profile-leitura", auth_user_id: IDS.leitura, institution_id: IDS.instA, unit_id: IDS.unitA, role: "leitura", status: "active" },
      { id: "profile-b", auth_user_id: IDS.adminB, institution_id: IDS.instB, unit_id: IDS.unitB, role: "municipal_admin", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: IDS.instA, unit_id: IDS.unitA, name: "Zerado", minimum_quantity: 5 },
      { id: "item-ok", institution_id: IDS.instA, unit_id: IDS.unitA, name: "Normal", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-ok", item_id: "item-ok", institution_id: IDS.instA, unit_id: IDS.unitA, quantity: 3, status: "aprovada" }
    ],
    stock_exits: [],
    stock_audit_log: [],
    municipal_assets: [{ id: "asset-ruim", institution_id: IDS.instA, unit_id: IDS.unitA, asset_tag: "PAT-1", name: "Mesa", condition: "ruim", status: "ativo" }],
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
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "sentinel_alert",
    source_id: "alert-zero",
    title: "Item zerado",
    message: "Alerta interno",
    severity: "high"
  };
  const first = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), body);
  const second = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), body);
  assert.equal(first.notification.status, "pending");
  assert.equal(second.deduplicated, true);
  assert.equal(store.tables.municipal_notifications.length, 1);
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_created"));
});

test("gestor ve apenas notificacoes autorizadas e tenant externo e bloqueado", async () => {
  const { service } = setup({
    municipal_notifications: [
      { id: "n1", institution_id: IDS.instA, unit_id: IDS.unitA, recipient_user_id: IDS.gestor, source_type: "manual", source_id: "1", channel: "in_app", title: "A", message: "A", severity: "high", status: "pending", deduplication_key: "n1", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n2", institution_id: IDS.instA, unit_id: IDS.unitA2, recipient_user_id: IDS.admin, source_type: "manual", source_id: "2", channel: "in_app", title: "A2", message: "A2", severity: "high", status: "pending", deduplication_key: "n2", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n3", institution_id: IDS.instB, unit_id: IDS.unitB, recipient_user_id: IDS.adminB, source_type: "manual", source_id: "3", channel: "in_app", title: "B", message: "B", severity: "high", status: "pending", deduplication_key: "n3", created_at: "2026-01-02T00:00:00.000Z" }
    ]
  });
  const listed = await service.listNotifications(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }));
  assert.deepEqual(listed.notifications.map((row) => row.id), ["n1"]);
  await rejectsCode(service.listNotifications(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }), { institution_id: IDS.instB }), "institution_scope_forbidden");
  await rejectsCode(service.createNotification(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }), { unit_id: IDS.unitA2, recipient_user_id: IDS.gestor, title: "externa" }), "unit_scope_forbidden");
});

test("marca como lida, calcula unread-count e permite cancelamento seguro", async () => {
  const { store, service } = setup({
    municipal_notifications: [
      { id: "n1", institution_id: IDS.instA, unit_id: IDS.unitA, recipient_user_id: IDS.gestor, source_type: "manual", source_id: "1", channel: "in_app", title: "A", message: "A", severity: "high", status: "pending", deduplication_key: "n1", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "n2", institution_id: IDS.instA, unit_id: IDS.unitA, recipient_user_id: IDS.gestor, source_type: "manual", source_id: "2", channel: "in_app", title: "B", message: "B", severity: "medium", status: "pending", deduplication_key: "n2", created_at: "2026-01-03T00:00:00.000Z" }
    ]
  });
  assert.equal((await service.unreadCount(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }))).unread_count, 2);
  const read = await service.markRead(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }), "n1");
  assert.equal(read.notification.status, "read");
  assert.equal((await service.unreadCount(ctx("gestor", { userId: IDS.gestor, unitId: IDS.unitA }))).unread_count, 1);
  const cancelled = await service.cancel(ctx("municipal_admin", { userId: IDS.admin }), "n2");
  assert.equal(cancelled.notification.status, "cancelled");
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_read"));
  assert.ok(store.tables.municipal_admin_audit_log.some((row) => row.action === "notification_cancelled"));
});

test("whatsapp desligado, email sem credencial e dados sensiveis falham com seguranca", async () => {
  const { service } = setup({}, { env: { MUNICIPAL_WHATSAPP_ENABLED: "false", MUNICIPAL_EMAIL_ENABLED: "true" } });
  const whatsapp = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
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

  const email = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    channel: "email",
    source_type: "manual",
    source_id: "email1",
    title: "Email"
  });
  assert.equal(email.notification.status, "failed");
  assert.equal(email.notification.failure_reason, "email_not_configured");
});



test("valida UUIDs do payload antes de enviar ao store", async () => {
  const { store, service } = setup();
  const captured = [];
  const originalInsert = store.insert.bind(store);
  store.insert = async (table, row) => {
    if (table === "municipal_notifications" || table === "municipal_admin_audit_log") captured.push({ table, row });
    return originalInsert(table, row);
  };

  const result = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "HOMOLOGACAO_FUNCIONAL_43_SOURCE_TEXT",
    title: "UUID valido"
  });
  assert.equal(result.notification.recipient_user_id, IDS.gestor);
  assert.equal(result.notification.source_id, "HOMOLOGACAO_FUNCIONAL_43_SOURCE_TEXT");
  assert.equal(captured.find((item) => item.table === "municipal_notifications").row.unit_id, IDS.unitA);
  assert.equal(captured.find((item) => item.table === "municipal_admin_audit_log").row.target_id, null);

  await rejectsCode(service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: "",
    title: "Sem destinatario"
  }), "recipient_user_id_invalid");

  await rejectsCode(service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: "HOMOLOGACAO_FUNCIONAL_43_UNIT",
    recipient_user_id: IDS.gestor,
    title: "Unidade textual"
  }), "unit_id_invalid");

  await rejectsCode(service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: "gestor@elo-e2e.test",
    title: "Destinatario textual"
  }), "recipient_user_id_invalid");
});

test("dispatch nao envia identificador textual para target_id UUID de auditoria", async () => {
  const { store, service } = setup();
  const auditRows = [];
  const originalInsert = store.insert.bind(store);
  store.insert = async (table, row) => {
    if (table === "municipal_admin_audit_log") auditRows.push(row);
    return originalInsert(table, row);
  };

  await service.dispatch(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "manual-text-source",
    title: "Dispatch"
  });
  const dispatchAudit = auditRows.find((row) => row.action === "notification_dispatch_executed");
  assert.ok(dispatchAudit);
  assert.equal(dispatchAudit.target_id, null);
});
test("normaliza campos temporais antes de inserir notificacoes", async () => {
  const { store, service } = setup();
  const captured = [];
  const originalInsert = store.insert.bind(store);
  store.insert = async (table, row) => {
    if (table === "municipal_notifications") captured.push(row);
    return originalInsert(table, row);
  };

  const iso = "2026-01-02T03:04:05.000Z";
  const withDates = await service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "dates-1",
    title: "Datas validas",
    scheduled_at: iso,
    sent_at: "",
    delivered_at: "undefined",
    read_at: null
  });
  assert.equal(withDates.notification.scheduled_at, iso);
  assert.equal(withDates.notification.sent_at, null);
  assert.equal(withDates.notification.delivered_at, null);
  assert.equal(withDates.notification.read_at, null);
  assert.match(withDates.notification.created_at, /^\d{4}-\d{2}-\d{2}T/);
  for (const field of ["scheduled_at", "sent_at", "delivered_at", "read_at", "created_at"]) {
    assert.notEqual(captured[0][field], "");
    assert.notEqual(captured[0][field], "undefined");
    assert.notEqual(captured[0][field], "null");
    assert.notEqual(captured[0][field], "Invalid Date");
    assert.equal(captured[0][field] instanceof Date, false);
  }

  const dispatched = await service.dispatch(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "dates-dispatch",
    title: "Dispatch sem agendamento"
  });
  assert.equal(dispatched.notifications.length, 1);
  assert.equal(dispatched.notifications[0].scheduled_at, null);

  const scheduled = await service.dispatch(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "dates-dispatch-scheduled",
    title: "Dispatch agendado",
    scheduled_at: iso
  });
  assert.equal(scheduled.notifications[0].scheduled_at, iso);
});

test("rejeita campo temporal invalido antes do banco", async () => {
  const { store, service } = setup();
  let inserted = false;
  const originalInsert = store.insert.bind(store);
  store.insert = async (table, row) => {
    if (table === "municipal_notifications") inserted = true;
    return originalInsert(table, row);
  };

  await rejectsCode(service.createNotification(ctx("municipal_admin", { userId: IDS.admin }), {
    unit_id: IDS.unitA,
    recipient_user_id: IDS.gestor,
    source_type: "manual",
    source_id: "bad-date",
    title: "Data invalida",
    scheduled_at: "amanha cedo"
  }), "invalid_notification_timestamp");
  assert.equal(inserted, false);
});
test("dispatch do Sentinela gera fila sem alterar estoque, patrimonio ou documentos", async () => {
  const { store, service } = setup();
  const beforeStock = JSON.stringify({ items: store.tables.stock_items, entries: store.tables.stock_entries, exits: store.tables.stock_exits });
  const beforeAssets = JSON.stringify(store.tables.municipal_assets);
  const beforeDocs = JSON.stringify(store.tables.municipal_documents);
  const result = await service.dispatch(ctx("municipal_admin", { userId: IDS.admin }), { scan: true, unit_id: IDS.unitA });
  assert.ok(result.notifications.some((row) => row.source_type === "sentinel_alert" && row.severity === "high"));
  assert.ok(result.notifications.some((row) => row.metadata && row.metadata.rule_code === "item_zero_stock"));
  assert.equal(JSON.stringify({ items: store.tables.stock_items, entries: store.tables.stock_entries, exits: store.tables.stock_exits }), beforeStock);
  assert.equal(JSON.stringify(store.tables.municipal_assets), beforeAssets);
  assert.equal(JSON.stringify(store.tables.municipal_documents), beforeDocs);
});
