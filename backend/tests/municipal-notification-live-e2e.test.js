import assert from "node:assert/strict";
import { after, test } from "node:test";
import {
  LIVE_PREFIX,
  apiJson,
  createMunicipalLiveFixture,
  listAudit,
  makeLiveName,
  stopMunicipalLiveFixture
} from "./municipal-e2e-live-fixture.js";

after(() => stopMunicipalLiveFixture());

test("homologacao funcional viva de notificacoes municipais", async () => {
  const fx = await createMunicipalLiveFixture();
  assert.equal(fx.projectRef, "mplpzyalcxhhinuvjthx");
  assert.equal(fx.env.MUNICIPAL_WHATSAPP_ENABLED, "false");
  assert.equal(fx.env.MUNICIPAL_EMAIL_ENABLED, "false");

  const key = makeLiveName("DEDUP");
  const create = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    source_type: "manual",
    source_id: makeLiveName("SOURCE"),
    channel: "in_app",
    title: `${LIVE_PREFIX}NOTIFICACAO`,
    message: "Notificacao funcional sem dado sensivel",
    severity: "high",
    deduplication_key: key
  });
  assert.equal(create.status, 200, JSON.stringify(create.data));
  assert.equal((create.data.notifications || []).length, 1);
  const notificationId = create.data.notifications[0].id;

  const countBeforeRead = await apiJson(fx, "gestor", "GET", `/api/municipal-admin/notifications/unread-count?institution_id=${encodeURIComponent(fx.institution.id)}`);
  assert.equal(countBeforeRead.status, 200);
  assert.ok(countBeforeRead.data.unread_count >= 1);

  const duplicate = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    source_type: "manual",
    source_id: makeLiveName("SOURCE_DUP"),
    channel: "in_app",
    title: `${LIVE_PREFIX}NOTIFICACAO_DUP`,
    severity: "high",
    deduplication_key: key
  });
  assert.equal(duplicate.status, 200);
  assert.equal(duplicate.data.deduplicated_count, 1);

  const listed = await apiJson(fx, "gestor", "GET", `/api/municipal-admin/notifications?institution_id=${encodeURIComponent(fx.institution.id)}`);
  assert.equal(listed.status, 200);
  assert.ok((listed.data.notifications || []).some((row) => row.id === notificationId));
  assert.doesNotMatch(JSON.stringify(listed.data), /token|senha|password|Bearer\s+[A-Za-z0-9._-]+/i);

  const read = await apiJson(fx, "gestor", "POST", `/api/municipal-admin/notifications/${notificationId}/read`);
  assert.equal(read.status, 200, JSON.stringify(read.data));
  assert.equal(read.data.notification.status, "read");

  const cancelKey = makeLiveName("CANCEL");
  const cancellable = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    source_type: "manual",
    source_id: makeLiveName("CANCEL_SOURCE"),
    channel: "in_app",
    title: `${LIVE_PREFIX}CANCELAR`,
    deduplication_key: cancelKey
  });
  assert.equal(cancellable.status, 200);
  const cancelId = cancellable.data.notifications[0].id;
  const cancel = await apiJson(fx, "platform", "POST", `/api/municipal-admin/notifications/${cancelId}/cancel`);
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.notification.status, "cancelled");

  const whatsapp = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    source_type: "manual",
    source_id: makeLiveName("WA"),
    channel: "whatsapp",
    title: `${LIVE_PREFIX}WHATSAPP_DESLIGADO`,
    deduplication_key: makeLiveName("WA_KEY")
  });
  assert.equal(whatsapp.status, 200);
  assert.equal(whatsapp.data.notifications[0].status, "failed");
  assert.equal(whatsapp.data.notifications[0].failure_reason, "whatsapp_disabled");

  const email = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    source_type: "manual",
    source_id: makeLiveName("EMAIL"),
    channel: "email",
    title: `${LIVE_PREFIX}EMAIL_DESLIGADO`,
    deduplication_key: makeLiveName("EMAIL_KEY")
  });
  assert.equal(email.status, 200);
  assert.equal(email.data.notifications[0].status, "failed");
  assert.equal(email.data.notifications[0].failure_reason, "email_disabled");

  const sentinel = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    channel: "in_app",
    alerts: [{
      id: makeLiveName("ALERT"),
      institution_id: fx.institution.id,
      unit_id: fx.unitA.id,
      rule_code: "item_zero_stock",
      title: `${LIVE_PREFIX}ALERTA_SENTINELA`,
      description: "Alerta funcional de homologacao",
      severity: "critical",
      status: "open",
      source_entity_type: "stock_items",
      source_entity_id: makeLiveName("ITEM"),
      responsible_user_id: fx.profiles.gestor.auth_user_id
    }]
  });
  assert.equal(sentinel.status, 200, JSON.stringify(sentinel.data));
  assert.ok((sentinel.data.notifications || []).some((row) => row.source_type === "sentinel_alert"));

  const afterRead = await apiJson(fx, "gestor", "GET", `/api/municipal-admin/notifications/unread-count?institution_id=${encodeURIComponent(fx.institution.id)}`);
  assert.equal(afterRead.status, 200);
  assert.ok(afterRead.data.unread_count >= 0);

  const readAudit = await listAudit(fx, "notification_read", notificationId);
  const cancelAudit = await listAudit(fx, "notification_cancelled", cancelId);
  assert.ok(readAudit.length >= 1);
  assert.ok(cancelAudit.length >= 1);
});
