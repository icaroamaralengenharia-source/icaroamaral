import { createHash, randomUUID } from "node:crypto";

export const ELO_TELEMETRY_EVENT_TYPES = Object.freeze([
  "APP_OPEN", "APP_READY", "AUTH_VALIDATED", "AUTH_FAILED", "AUTH_EXPIRED", "ONLINE", "OFFLINE",
  "BACKEND_UNAVAILABLE", "BACKEND_RECOVERED", "CHAT_SENT", "CHAT_RESPONSE", "CHAT_FAILED",
  "ATTACHMENT_SELECTED", "ATTACHMENT_PROCESSED", "ATTACHMENT_FAILED", "IMAGE_ANALYSIS", "IMAGE_FAILED",
  "PROACTIVE_REASONING", "SELF_CHECK", "ACTION_EXECUTED", "ACTION_FAILED", "OFFLINE_COMMAND",
  "OFFLINE_FALLBACK", "MUSIC_PLAY", "MUSIC_FAILED", "REPORT_GENERATED", "REPORT_FAILED", "MEMORY_USED",
  "MEMORY_FAILED", "RETRY", "FEEDBACK_SUBMITTED", "CRASH_DETECTED", "ANR_DETECTED"
]);

export const ELO_TELEMETRY_ERROR_CODES = Object.freeze([
  "AUTH_REQUIRED", "INVALID_SESSION", "AUTH_CONTEXT_PROFILE_NOT_FOUND", "TENANT_INVALID", "NETWORK_TIMEOUT",
  "DNS_ERROR", "BACKEND_5XX", "RATE_LIMITED", "FILE_TOO_LARGE", "INVALID_MIME", "FILE_PARSE_FAILED",
  "IMAGE_ANALYSIS_FAILED", "MODEL_TIMEOUT", "MODEL_ERROR", "CONTEXT_MISSING", "ACTION_ROUTER_FAILED",
  "OFFLINE_UNSUPPORTED", "UNKNOWN"
]);

export const ELO_TELEMETRY_FIELDS = Object.freeze([
  "event_id", "timestamp", "session_hash", "anonymous_user_hash", "tenant_hash", "project_hash", "surface",
  "event_type", "route", "answer_mode", "proactivity_level", "self_check_level", "latency_ms",
  "backend_latency_ms", "model_latency_ms", "status", "http_status", "error_code", "fallback_used",
  "offline_used", "retry_count", "attachment_type", "attachment_size_bucket", "response_size_bucket",
  "context_turn_count_bucket", "memory_used", "project_context_used", "risk_detected", "missing_essential_count",
  "action_type", "response_event_hash", "model_class", "token_usage_bucket", "estimated_cost_bucket"
]);

const MAX_BATCH = 50;
const MAX_EVENT_BYTES = 4096;
const MAX_BATCH_BYTES = 64 * 1024;
const DEFAULT_CAPACITY = 500;
const RETENTION_DAYS = 60;
const RETENTION_MAX_DELETE_PER_RUN = 500;
const SAFE_SURFACES = new Set(["WEB", "ANDROID_WEBVIEW"]);
const SAFE_STATUSES = new Set(["SUCCESS", "ERROR", "OFFLINE", "FALLBACK", "PENDING"]);
const SAFE_MODEL_CLASSES = new Set(["LOCAL", "CHEAP_REMOTE", "STANDARD", "HIGH_REASONING"]);
const SAFE_BUCKETS = new Set(["<250ms", "250-500ms", "500ms-1s", "1-2s", "2-5s", "5-10s", ">10s"]);
const SAFE_SIZE_BUCKETS = new Set(["0", "<10KB", "10-100KB", "100KB-1MB", "1-5MB", ">5MB"]);
const SAFE_COUNT_BUCKETS = new Set(["0", "1-3", "4-10", ">10"]);
const SAFE_TOKEN_BUCKETS = new Set(["0", "1-500", "501-2k", "2k-8k", ">8k"]);
const SAFE_COST_BUCKETS = new Set(["0", "LOW", "MEDIUM", "HIGH"]);
const PROHIBITED_KEYS = /^(prompt|answer|response|content|body|text|raw|file_name|filename|email|cpf|cnpj|phone|telephone|telefone|jwt|cookie|authorization|password|secret|access_token|refresh_token)$/i;
const PROHIBITED_VALUE = /(TOKEN_SECRET_CANARY|PASSWORD_SECRET_CANARY|PROMPT_CANARY|PROMPT_PRIVATE_CANARY|RESPONSE_CANARY|PDF_TEXT_CANARY|JWT_CANARY|EMAIL_CANARY|CPF_CANARY|CNPJ_CANARY|TELEPHONE_CANARY|BEARER_CANARY|Authorization:\s*Bearer)/i;

function asFiniteInt(value, min = 0, max = 2147483647) {
  const number = Number(value);
  if (!Number.isFinite(number)) return undefined;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function asBoolean(value) {
  return value === true ? true : value === false ? false : undefined;
}

function asSafeString(value, max = 80) {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim().slice(0, max);
  return text || undefined;
}

function hasProhibitedInput(value, key = "") {
  if (PROHIBITED_KEYS.test(key)) return true;
  if (typeof value === "string") return PROHIBITED_VALUE.test(value);
  if (Array.isArray(value)) return value.some((item) => hasProhibitedInput(item, key));
  if (value && typeof value === "object") return Object.entries(value).some(([childKey, childValue]) => hasProhibitedInput(childValue, childKey));
  return false;
}

function pick(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback;
}

export function hashOpaque(value, salt = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return createHash("sha256").update(String(salt || "elo-telemetry-process-salt")).update(":").update(raw).digest("hex");
}

export function bucketLatency(value) {
  const ms = Number(value);
  if (!Number.isFinite(ms) || ms < 0) return undefined;
  if (ms < 250) return "<250ms";
  if (ms < 500) return "250-500ms";
  if (ms < 1000) return "500ms-1s";
  if (ms < 2000) return "1-2s";
  if (ms < 5000) return "2-5s";
  if (ms < 10000) return "5-10s";
  return ">10s";
}

export function bucketBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "0";
  if (bytes < 10 * 1024) return "<10KB";
  if (bytes < 100 * 1024) return "10-100KB";
  if (bytes < 1024 * 1024) return "100KB-1MB";
  if (bytes < 5 * 1024 * 1024) return "1-5MB";
  return ">5MB";
}

export function bucketCount(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count <= 3) return "1-3";
  if (count <= 10) return "4-10";
  return ">10";
}

export function bucketTokens(value) {
  const count = Number(value);
  if (!Number.isFinite(count) || count <= 0) return "0";
  if (count <= 500) return "1-500";
  if (count <= 2000) return "501-2k";
  if (count <= 8000) return "2k-8k";
  return ">8k";
}

export function classifyTelemetryError(error, status = 0) {
  const code = String(error && (error.code || error.error || error.message) || "").toLowerCase();
  if (status === 401 || code.includes("auth") || code.includes("session")) return code.includes("required") ? "AUTH_REQUIRED" : "INVALID_SESSION";
  if (status === 429 || code.includes("rate")) return "RATE_LIMITED";
  if (status >= 500) return "BACKEND_5XX";
  if (code.includes("timeout")) return "NETWORK_TIMEOUT";
  if (code.includes("dns")) return "DNS_ERROR";
  if (code.includes("large") || code.includes("size")) return "FILE_TOO_LARGE";
  if (code.includes("mime") || code.includes("format")) return "INVALID_MIME";
  if (code.includes("pdf") || code.includes("parse") || code.includes("extract")) return "FILE_PARSE_FAILED";
  if (code.includes("image")) return "IMAGE_ANALYSIS_FAILED";
  if (code.includes("model") || code.includes("openai")) return "MODEL_ERROR";
  if (code.includes("context")) return "CONTEXT_MISSING";
  return "UNKNOWN";
}

export function sanitizeTelemetryEvent(input, options = {}) {
  if (!input || typeof input !== "object" || hasProhibitedInput(input)) return null;
  const source = input;
  const eventType = asSafeString(source.event_type, 40);
  if (!ELO_TELEMETRY_EVENT_TYPES.includes(eventType)) return null;
  const event = {
    event_id: asSafeString(source.event_id, 80) || randomUUID(),
    timestamp: asSafeString(source.timestamp, 40) || new Date().toISOString(),
    surface: pick(asSafeString(source.surface, 30), SAFE_SURFACES, "WEB"),
    event_type: eventType,
    route: asSafeString(source.route, 40),
    answer_mode: asSafeString(source.answer_mode, 30),
    proactivity_level: asSafeString(source.proactivity_level, 30),
    self_check_level: asSafeString(source.self_check_level, 30),
    status: pick(asSafeString(source.status, 20), SAFE_STATUSES, "SUCCESS"),
    error_code: pick(asSafeString(source.error_code, 50), new Set(ELO_TELEMETRY_ERROR_CODES), undefined),
    attachment_type: asSafeString(source.attachment_type, 40),
    attachment_size_bucket: pick(asSafeString(source.attachment_size_bucket, 20), SAFE_SIZE_BUCKETS, undefined),
    response_size_bucket: pick(asSafeString(source.response_size_bucket, 20), SAFE_SIZE_BUCKETS, undefined),
    context_turn_count_bucket: pick(asSafeString(source.context_turn_count_bucket, 20), SAFE_COUNT_BUCKETS, undefined),
    action_type: asSafeString(source.action_type, 40),
    response_event_hash: /^[a-f0-9]{32,128}$/i.test(asSafeString(source.response_event_hash, 128) || "")
      ? asSafeString(source.response_event_hash, 128).toLowerCase()
      : undefined,
    model_class: pick(asSafeString(source.model_class, 30), SAFE_MODEL_CLASSES, undefined),
    token_usage_bucket: pick(asSafeString(source.token_usage_bucket, 20), SAFE_TOKEN_BUCKETS, undefined),
    estimated_cost_bucket: pick(asSafeString(source.estimated_cost_bucket, 20), SAFE_COST_BUCKETS, undefined)
  };
  ["session_hash", "anonymous_user_hash", "tenant_hash", "project_hash"].forEach((key) => {
    const value = asSafeString(source[key], 128);
    if (value && /^[a-f0-9]{32,128}$/i.test(value)) event[key] = value;
    else if (value && options.hashSalt) event[key] = hashOpaque(value, options.hashSalt);
  });
  ["latency_ms", "backend_latency_ms", "model_latency_ms", "http_status", "retry_count", "missing_essential_count"].forEach((key) => {
    const value = asFiniteInt(source[key], 0, key === "http_status" ? 599 : key === "missing_essential_count" ? 20 : 86400000);
    if (value !== undefined) event[key] = value;
  });
  ["fallback_used", "offline_used", "memory_used", "project_context_used", "risk_detected"].forEach((key) => {
    const value = asBoolean(source[key]);
    if (value !== undefined) event[key] = value;
  });
  const serialized = JSON.stringify(event);
  if (serialized.length > MAX_EVENT_BYTES || hasProhibitedInput(event)) return null;
  return event;
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

export function summarizeTelemetry(events, now = Date.now(), windowMs = 24 * 60 * 60 * 1000) {
  const recent = (Array.isArray(events) ? events : []).filter((event) => {
    const timestamp = Date.parse(event && event.timestamp);
    return Number.isFinite(timestamp) && timestamp >= now - windowMs;
  });
  const count = (type) => recent.filter((event) => event.event_type === type).length;
  const successRate = (okTypes, errorTypes) => {
    const ok = okTypes.reduce((sum, type) => sum + count(type), 0);
    const failed = errorTypes.reduce((sum, type) => sum + count(type), 0);
    return ok + failed ? Number((ok / (ok + failed)).toFixed(4)) : null;
  };
  const latencies = recent.filter((event) => Number.isFinite(event.latency_ms)).map((event) => event.latency_ms);
  const imageLatencies = recent.filter((event) => event.event_type === "IMAGE_ANALYSIS" && Number.isFinite(event.latency_ms)).map((event) => event.latency_ms);
  const authSuccessRate = successRate(["AUTH_VALIDATED"], ["AUTH_FAILED", "AUTH_EXPIRED"]);
  const chatSuccessRate = successRate(["CHAT_RESPONSE"], ["CHAT_FAILED"]);
  const attachmentSuccessRate = successRate(["ATTACHMENT_PROCESSED"], ["ATTACHMENT_FAILED"]);
  const imageSuccessRate = successRate(["IMAGE_ANALYSIS"], ["IMAGE_FAILED"]);
  const backendErrors = recent.filter((event) => event.error_code === "BACKEND_5XX" || event.event_type === "BACKEND_UNAVAILABLE").length;
  const chatTotal = count("CHAT_RESPONSE") + count("CHAT_FAILED");
  let state = "HEALTHY";
  if ((authSuccessRate !== null && authSuccessRate < 0.5) || (chatSuccessRate !== null && chatSuccessRate < 0.5) || (chatTotal && backendErrors / chatTotal >= 0.5)) state = "UNHEALTHY";
  else if ((authSuccessRate !== null && authSuccessRate < 0.9) || (chatSuccessRate !== null && chatSuccessRate < 0.95) || (attachmentSuccessRate !== null && attachmentSuccessRate < 0.9) || (imageSuccessRate !== null && imageSuccessRate < 0.9) || (percentile(latencies, 0.95) || 0) > 5000) state = "DEGRADED";
  return {
    state,
    window_ms: windowMs,
    event_count: recent.length,
    auth_success_rate: authSuccessRate,
    chat_success_rate: chatSuccessRate,
    attachment_success_rate: attachmentSuccessRate,
    image_success_rate: imageSuccessRate,
    backend_error_count: backendErrors,
    p95_latency_ms: percentile(latencies, 0.95),
    p95_image_latency_ms: percentile(imageLatencies, 0.95),
    session_recovery_count: count("BACKEND_RECOVERED"),
    crash_count: count("CRASH_DETECTED"),
    anr_count: count("ANR_DETECTED"),
    offline_event_count: count("OFFLINE") + count("OFFLINE_COMMAND") + count("OFFLINE_FALLBACK"),
    proactive_count: count("PROACTIVE_REASONING"),
    self_check_count: count("SELF_CHECK")
  };
}

export function createEloTelemetryService(options = {}) {
  const env = options.env || process.env;
  const capacity = Math.max(100, Math.min(500, Number(options.capacity || env.ELO_TELEMETRY_BUFFER_SIZE || DEFAULT_CAPACITY)));
  const hashSalt = String(options.hashSalt || env.ELO_TELEMETRY_HASH_SALT || randomUUID());
  const events = [];
  const client = options.client || null;
  const useSupabase = String(options.store || env.ELO_TELEMETRY_STORE || (client ? "supabase" : "memory")).toLowerCase() === "supabase" && client;
  let persistErrors = 0;

  async function persist(event) {
    if (!useSupabase) return;
    try {
      const row = Object.assign({}, event, { occurred_at: event.timestamp });
      delete row.timestamp;
      let { error } = await client.from("elo_telemetry_events").insert(row);
      if (error && event.response_event_hash) {
        delete row.response_event_hash;
        ({ error } = await client.from("elo_telemetry_events").insert(row));
      }
      if (error) throw error;
    } catch (_) {
      persistErrors += 1;
    }
  }

  async function cleanupExpired({ days = RETENTION_DAYS, now = Date.now(), dryRun = false, maxPerRun = RETENTION_MAX_DELETE_PER_RUN } = {}) {
    const retentionDays = Math.max(1, Math.min(3650, Number(days) || RETENTION_DAYS));
    const deleteLimit = Math.max(1, Math.min(RETENTION_MAX_DELETE_PER_RUN, Number(maxPerRun) || RETENTION_MAX_DELETE_PER_RUN));
    const cutoff = new Date(now - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    if (!useSupabase) return { ok: true, skipped: true, dry_run: dryRun, cutoff, matching: 0, deleted: 0, max_per_run: deleteLimit };
    try {
      if (dryRun) {
        const { count, error } = await client.from("elo_telemetry_events").select("id", { count: "exact", head: true }).lt("occurred_at", cutoff);
        if (error) throw error;
        const matching = Number(count || 0);
        return { ok: true, dry_run: true, cutoff, matching, deleted: 0, max_per_run: deleteLimit, capped: matching > deleteLimit };
      }
      const { data: candidates, error: candidateError } = await client.from("elo_telemetry_events")
        .select("id", { count: "exact" })
        .lt("occurred_at", cutoff)
        .order("occurred_at", { ascending: true })
        .limit(deleteLimit);
      if (candidateError) throw candidateError;
      const ids = Array.isArray(candidates) ? candidates.map((row) => row && row.id).filter(Boolean) : [];
      if (!ids.length) return { ok: true, dry_run: false, cutoff, matching: 0, deleted: 0, max_per_run: deleteLimit, capped: false };
      const { data, error } = await client.from("elo_telemetry_events")
        .delete()
        .lt("occurred_at", cutoff)
        .in("id", ids)
        .select("id");
      if (error) throw error;
      return { ok: true, dry_run: false, cutoff, matching: ids.length, deleted: Array.isArray(data) ? data.length : 0, max_per_run: deleteLimit, capped: ids.length >= deleteLimit };
    } catch (_) {
      persistErrors += 1;
      return { ok: false, dry_run: dryRun, cutoff, matching: 0, deleted: 0, max_per_run: deleteLimit };
    }
  }

  async function ingest(input) {
    const event = sanitizeTelemetryEvent(input, { hashSalt });
    if (!event) return { accepted: false, reason: "invalid_or_sensitive" };
    events.push(event);
    while (events.length > capacity) events.shift();
    await persist(event);
    return { accepted: true, event };
  }

  async function ingestBatch(batch) {
    if (!Array.isArray(batch) || batch.length > MAX_BATCH || JSON.stringify(batch).length > MAX_BATCH_BYTES) return { accepted: 0, rejected: Array.isArray(batch) ? batch.length : 0, reason: "batch_limit" };
    let accepted = 0;
    let rejected = 0;
    for (const item of batch) {
      const result = await ingest(item);
      if (result.accepted) accepted += 1;
      else rejected += 1;
    }
    return { accepted, rejected };
  }

  async function snapshot({ windowMs = 24 * 60 * 60 * 1000 } = {}) {
    return summarizeTelemetry(events, Date.now(), windowMs);
  }

  return {
    capacity,
    hashSalt,
    ingest,
    ingestBatch,
    snapshot,
    cleanupExpired,
    getEvents: () => events.slice(),
    getStats: () => ({ buffered: events.length, capacity, persist_errors: persistErrors })
  };
}

export const ELO_TELEMETRY_LIMITS = Object.freeze({ MAX_BATCH, MAX_EVENT_BYTES, MAX_BATCH_BYTES, RETENTION_DAYS, RETENTION_MAX_DELETE_PER_RUN });
