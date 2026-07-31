import { createMunicipalSentinelService } from "./municipal-sentinel-service.js";
import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";

const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "leitura"]);
const WRITE_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const CHANNELS = new Set(["in_app", "email", "whatsapp"]);
const STATUSES = new Set(["pending", "sent", "delivered", "read", "failed", "cancelled"]);
const NOTIFIABLE_RULES = new Set(["item_zero_stock", "item_below_minimum", "asset_bad_condition", "required_report_missing", "archived_document_without_replacement", "document_report_pending", "sync_failed", "report_ready_for_review"]);
const NOTIFIABLE_SEVERITIES = new Set(["critical", "high"]);
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|phone|telefone|whatsapp|email|storage_path|storagePath/i;
const SENSITIVE_TEXT = /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+?\d[\d .()-]{7,}\d)|(?:token|bearer|senha|password|secret)\s*[:=]\s*\S+)/gi;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
function safeText(value) { return clean(value).replace(SENSITIVE_TEXT, "[redigido]"); }
function lower(value) { return clean(value).toLowerCase(); }
function nowIso(now = () => new Date()) {
  const value = now();
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw makeError(400, "invalid_notification_timestamp");
  return date.toISOString();
}
function temporalOrNull(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) throw makeError(400, "invalid_notification_timestamp");
    return value.toISOString();
  }
  const raw = clean(value);
  if (!raw || ["undefined", "null", "invalid date"].includes(raw.toLowerCase())) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) throw makeError(400, "invalid_notification_timestamp");
  return parsed.toISOString();
}
function temporalOrNow(value) {
  return value === undefined || value === null || !clean(value) ? nowIso() : temporalOrNull(value);
}
function makeError(status, code) { const err = new Error(code); err.status = status; err.code = code; return err; }
function isUuid(value) { return UUID_RE.test(clean(value)); }
function uuidRequired(value, code) { const id = clean(value); if (!isUuid(id)) throw makeError(400, code); return id; }
function uuidOrNull(value) { const id = clean(value); if (!id || ["undefined", "null"].includes(id.toLowerCase())) return null; return isUuid(id) ? id : null; }
function isActive(row) { return ["active", "ativo"].includes(lower(row && row.status || "active")); }
function statusValue(value, fallback = "pending") { const normalized = lower(value) || fallback; if (!STATUSES.has(normalized)) throw makeError(400, "invalid_notification_status"); return normalized; }
function channelValue(value) { const normalized = lower(value) || "in_app"; if (!CHANNELS.has(normalized)) throw makeError(400, "invalid_notification_channel"); return normalized; }
function severityValue(value) { const normalized = lower(value) || "medium"; return ["low", "medium", "high", "critical"].includes(normalized) ? normalized : "medium"; }
function sanitize(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}
function publicNotification(row) { const out = sanitize(row) || {}; delete out.raw_payload; return out; }
function assertRead(session) { if (!READ_ROLES.has(session.role)) throw makeError(403, "notification_access_forbidden"); }
function assertWrite(session) { if (!WRITE_ROLES.has(session.role)) throw makeError(403, "notification_write_forbidden"); }
async function assertInstitution(store, institutionId) {
  const id = clean(institutionId);
  if (!id) throw makeError(400, "institution_id_required");
  const institution = await store.get("institutions", id);
  if (!institution || !isActive(institution)) throw makeError(404, "institution_not_found");
  return id;
}
async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") return await assertInstitution(store, requestedInstitutionId);
  const id = clean(session.institutionId);
  if (!id) throw makeError(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw makeError(403, "institution_scope_forbidden");
  return await assertInstitution(store, id);
}
async function resolveUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId ?? (session.role === "gestor" ? session.unitId : ""));
  if (!id) return null;
  uuidRequired(id, "unit_id_invalid");
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId) || !isActive(unit)) throw makeError(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw makeError(403, "unit_scope_forbidden");
  return id;
}
async function assertRecipient(store, institutionId, recipientUserId) {
  const id = uuidRequired(recipientUserId, "recipient_user_id_invalid");
  const user = await store.findOne("profiles", { auth_user_id: id }) || await store.get("profiles", id);
  if (!user || clean(user.institution_id) !== clean(institutionId) || !isActive(user)) throw makeError(403, "recipient_scope_forbidden");
  return id;
}
function canSee(session, row) {
  if (session.role === "platform_admin") return true;
  if (clean(row.institution_id) !== clean(session.institutionId)) return false;
  if (session.role === "gestor" && clean(row.unit_id) && clean(row.unit_id) !== clean(session.unitId)) return false;
  if (session.role === "leitura" && clean(row.recipient_user_id) !== clean(session.userId)) return false;
  return true;
}
async function writeAudit(store, session, action, institutionId, targetId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: uuidOrNull(session.userId),
    institution_id: uuidRequired(institutionId, "institution_id_invalid"),
    target_type: "municipal_notification",
    target_id: uuidOrNull(targetId),
    action,
    metadata: sanitize(metadata) || {},
    created_at: nowIso()
  });
}
function normalizeSource(input = {}) {
  const sourceType = clean(input.source_type || input.sourceType || input.event_type || input.eventType || "manual");
  const sourceId = clean(input.source_id || input.sourceId || input.alert_id || input.alertId || input.id || sourceType);
  return { sourceType, sourceId };
}
function dedupeKey(institutionId, unitId, recipientUserId, sourceType, sourceId, channel) {
  return [institutionId, unitId, recipientUserId, sourceType, sourceId, channel].map(clean).join(":");
}
function notificationPayload(session, institutionId, unitId, input = {}) {
  const channel = channelValue(input.channel);
  const source = normalizeSource(input);
  const recipient = uuidRequired(input.recipient_user_id ?? input.recipientUserId ?? input.responsible_user_id ?? input.responsibleUserId ?? session.userId, "recipient_user_id_invalid");
  return {
    institution_id: uuidRequired(institutionId, "institution_id_invalid"),
    unit_id: uuidOrNull(input.unit_id ?? input.unitId ?? unitId),
    recipient_user_id: recipient,
    source_type: source.sourceType,
    source_id: source.sourceId,
    channel,
    title: safeText(input.title) || "Notificacao municipal",
    message: safeText(input.message || input.description) || "Existe uma ocorrencia municipal para revisar.",
    severity: severityValue(input.severity),
    status: statusValue(input.status || "pending"),
    deduplication_key: clean(input.deduplication_key ?? input.deduplicationKey) || dedupeKey(institutionId, clean(input.unit_id ?? input.unitId ?? unitId), recipient, source.sourceType, source.sourceId, channel),
    scheduled_at: temporalOrNull(input.scheduled_at ?? input.scheduledAt),
    sent_at: temporalOrNull(input.sent_at ?? input.sentAt),
    delivered_at: temporalOrNull(input.delivered_at ?? input.deliveredAt),
    read_at: temporalOrNull(input.read_at ?? input.readAt),
    failure_reason: safeText(input.failure_reason || input.failureReason),
    created_at: temporalOrNow(input.created_at ?? input.createdAt),
    metadata: sanitize(input.metadata || {}) || {}
  };
}
function alertToNotification(session, alert, channel = "in_app") {
  return {
    channel,
    source_type: "sentinel_alert",
    source_id: alert.id,
    unit_id: alert.unit_id,
    recipient_user_id: alert.responsible_user_id || session.userId,
    title: alert.title || "Alerta municipal",
    message: alert.description || "Alerta municipal exige revisao.",
    severity: alert.severity,
    metadata: { rule_code: alert.rule_code, source_entity_type: alert.source_entity_type, source_entity_id: alert.source_entity_id, evidence: alert.evidence }
  };
}
function isNotifiableAlert(alert) { return NOTIFIABLE_SEVERITIES.has(lower(alert && alert.severity)) || NOTIFIABLE_RULES.has(clean(alert && alert.rule_code)); }
function adapterEnabled(env, channel) {
  if (channel === "in_app") return true;
  if (channel === "whatsapp") return lower(env.MUNICIPAL_WHATSAPP_ENABLED) === "true";
  if (channel === "email") return lower(env.MUNICIPAL_EMAIL_ENABLED) === "true";
  return false;
}
function adapterConfigured(env, channel) {
  if (channel === "in_app") return true;
  if (channel === "whatsapp") return !!clean(env.MUNICIPAL_WHATSAPP_PROVIDER_TOKEN || env.MUNICIPAL_WHATSAPP_PROVIDER_URL);
  if (channel === "email") return !!clean(env.MUNICIPAL_EMAIL_PROVIDER_TOKEN || env.MUNICIPAL_EMAIL_PROVIDER_URL);
  return false;
}
function applyAdapterStatus(payload, env) {
  if (payload.channel === "in_app") return payload;
  if (!adapterEnabled(env, payload.channel)) return Object.assign({}, payload, { status: "failed", failure_reason: payload.channel + "_disabled" });
  if (!adapterConfigured(env, payload.channel)) return Object.assign({}, payload, { status: "failed", failure_reason: payload.channel + "_not_configured" });
  if (payload.channel === "whatsapp" && !payload.metadata.whatsapp_consent) return Object.assign({}, payload, { status: "failed", failure_reason: "whatsapp_consent_required" });
  return Object.assign({}, payload, { status: "pending" });
}
async function createOne(store, session, institutionId, unitId, input, env) {
  const scopedUnit = await resolveUnit(store, session, institutionId, input.unit_id ?? input.unitId ?? unitId);
  let payload = notificationPayload(session, institutionId, scopedUnit, Object.assign({}, input, { unit_id: scopedUnit }));
  await assertRecipient(store, institutionId, payload.recipient_user_id);
  const existing = await store.findOne("municipal_notifications", { deduplication_key: payload.deduplication_key });
  if (existing) return { notification: publicNotification(existing), deduplicated: true };
  payload = applyAdapterStatus(payload, env);
  const row = await store.insert("municipal_notifications", payload);
  await writeAudit(store, session, "notification_created", institutionId, row.id, { channel: row.channel, source_type: row.source_type, severity: row.severity });
  if (row.status === "failed") await writeAudit(store, session, "notification_failed", institutionId, row.id, { channel: row.channel, failure_reason: row.failure_reason });
  else if (row.channel !== "in_app") await writeAudit(store, session, "notification_queued", institutionId, row.id, { channel: row.channel });
  return { notification: publicNotification(row), deduplicated: false };
}

export function createMunicipalNotificationService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const sentinel = options.sentinelService || createMunicipalSentinelService({ store });
  const env = options.env || process.env || {};

  return {
    async createNotification(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const institutionId = await resolveInstitution(store, session, body.institution_id || body.institutionId);
      const unitId = await resolveUnit(store, session, institutionId, body.unit_id || body.unitId);
      return await createOne(store, session, institutionId, unitId, body, env);
    },

    async dispatch(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const institutionId = await resolveInstitution(store, session, body.institution_id || body.institutionId);
      const unitId = await resolveUnit(store, session, institutionId, body.unit_id || body.unitId);
      let inputs = Array.isArray(body.notifications) ? body.notifications.slice() : [];
      if (Array.isArray(body.alerts)) inputs = inputs.concat(body.alerts.filter(isNotifiableAlert).map((alert) => alertToNotification(session, alert, body.channel || "in_app")));
      if (body.scan === true || lower(body.source_type || body.sourceType) === "sentinel_scan") {
        const scanned = await sentinel.scan(context, { institution_id: institutionId, unit_id: unitId });
        inputs = inputs.concat((scanned.alerts || []).filter(isNotifiableAlert).map((alert) => alertToNotification(session, alert, body.channel || "in_app")));
      }
      if (!inputs.length && (body.source_type || body.sourceType || body.title)) inputs.push(body);
      const results = [];
      for (const input of inputs) results.push(await createOne(store, session, institutionId, unitId, input, env));
      await writeAudit(store, session, "notification_dispatch_executed", institutionId, "dispatch", { count: results.length });
      return { notifications: results.map((item) => item.notification), deduplicated_count: results.filter((item) => item.deduplicated).length };
    },

    async listNotifications(context, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const institutionId = await resolveInstitution(store, session, query.institution_id || query.institutionId);
      const unitId = await resolveUnit(store, session, institutionId, query.unit_id || query.unitId);
      let rows = await store.list("municipal_notifications", { institution_id: institutionId });
      if (unitId) rows = rows.filter((row) => clean(row.unit_id) === unitId);
      if (query.status) rows = rows.filter((row) => lower(row.status) === lower(query.status));
      if (query.channel) rows = rows.filter((row) => lower(row.channel) === lower(query.channel));
      rows = rows.filter((row) => canSee(session, row));
      rows.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      return { notifications: rows.map(publicNotification) };
    },

    async unreadCount(context, query = {}) {
      const listed = await this.listNotifications(context, Object.assign({}, query, { status: "" }));
      return { unread_count: listed.notifications.filter((row) => !row.read_at && !["read", "cancelled", "failed"].includes(lower(row.status))).length };
    },

    async markRead(context, notificationId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertRead(session);
      const row = await store.get("municipal_notifications", notificationId);
      if (!row || !canSee(session, row)) throw makeError(404, "notification_not_found");
      const patch = { status: "read", read_at: nowIso() };
      const updated = await store.update("municipal_notifications", row.id, patch);
      await writeAudit(store, session, "notification_read", row.institution_id, row.id, { channel: row.channel });
      return { notification: publicNotification(updated) };
    },

    async cancel(context, notificationId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWrite(session);
      const row = await store.get("municipal_notifications", notificationId);
      if (!row || !canSee(session, row)) throw makeError(404, "notification_not_found");
      if (["read", "cancelled"].includes(lower(row.status))) throw makeError(409, "notification_not_cancellable");
      const updated = await store.update("municipal_notifications", row.id, { status: "cancelled" });
      await writeAudit(store, session, "notification_cancelled", row.institution_id, row.id, { channel: row.channel });
      return { notification: publicNotification(updated) };
    }
  };
}

export { createSupabaseMunicipalAdminStore as createSupabaseMunicipalNotificationStore, toMunicipalAdminHttpError as toMunicipalNotificationHttpError };
