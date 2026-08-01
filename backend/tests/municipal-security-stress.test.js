import assert from "node:assert/strict";
import { test } from "node:test";

const SEED = "municipal-security-stress-v1";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /(eyJ[A-Za-z0-9_-]{20,}\.|Bearer\s+[A-Za-z0-9_.-]+|service_role_[A-Za-z0-9_-]+|token=|password=|senha=)/i;

function sanitizeText(value) {
  return String(value ?? "").replace(SECRET_RE, "[redacted]").replace(/[<>]/g, "").replace(/\.\.[/\\]/g, "").slice(0, 512);
}

function depth(value, level = 0) {
  if (!value || typeof value !== "object") return level;
  if (level > 32) return level;
  return Math.max(level, ...Object.values(value).map((item) => depth(item, level + 1)));
}

function validatePayload(payload) {
  const errors = [];
  const serialized = JSON.stringify(payload);
  if (serialized.length > 30_000) errors.push("payload_too_large");
  if (Object.values(payload).some((value) => typeof value === "string" && value.length > 5000)) errors.push("field_too_long");
  if (depth(payload) > 20) errors.push("json_too_deep");
  if (/(;\s*drop\s+table|union\s+select|--\s*$)/i.test(serialized)) errors.push("sql_injection");
  if (/<script|onerror\s*=|javascript:/i.test(serialized)) errors.push("xss");
  if (/(\.\.[/\\]|%2e%2e)/i.test(serialized)) errors.push("path_traversal");
  if (/(__proto__|"constructor"\s*:|"prototype"\s*:|constructor\s*:|prototype\s*:)/i.test(serialized)) errors.push("prototype_pollution");
  const allowed = new Set(["institution_id", "unit_id", "recipient_user_id", "created_by", "updated_by", "title", "message", "path", "metadata"]);
  for (const key of Object.keys(payload)) if (!allowed.has(key)) errors.push("unexpected_field");
  for (const key of ["institution_id", "unit_id", "recipient_user_id", "created_by", "updated_by"]) {
    if (payload[key] != null && !UUID_RE.test(String(payload[key]))) errors.push(`${key}_invalid`);
  }
  if ("project_id" in payload) errors.push("project_id_forbidden");
  if (SECRET_RE.test(serialized)) errors.push("secret_in_payload");
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function sanitizeLog(payload, result) {
  return JSON.stringify({
    ok: result.ok,
    errors: result.errors,
    fields: Object.keys(payload).filter((key) => !/token|password|secret|jwt|authorization/i.test(key)),
    sample: sanitizeText(payload.title || payload.name || payload.path || "")
  });
}

function deepObject(level) {
  let value = "end";
  for (let i = 0; i < level; i += 1) value = { next: value };
  return value;
}

const attacks = [
  { title: "'; DROP TABLE municipal_assets; --" },
  { title: "<script>alert(1)</script>" },
  { path: "../../../../etc/passwd" },
  { metadata: deepObject(25) },
  { title: "A".repeat(10_000) },
  { unexpected_field: "value", project_id: "project-x" },
  { unit_id: "not-a-uuid" },
  { recipient_user_id: "gestor@demo.test" },
  { title: "Bearer eyJaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.payload" },
  JSON.parse('{"__proto__":{"polluted":true}}'),
  { constructor: { prototype: { polluted: true } } },
  { title: "javascript:alert(1)" }
];

test("payloads hostis sao rejeitados sem vazar segredo em logs", () => {
  let rejected = 0;
  for (const payload of attacks) {
    const result = validatePayload(payload);
    const log = sanitizeLog(payload, result);
    assert.equal(result.ok, false);
    assert.doesNotMatch(log, SECRET_RE);
    assert.doesNotMatch(log, /<script|\.\.\/|service_role_|Bearer eyJ/i);
    rejected += 1;
  }
  assert.equal(rejected, attacks.length);
  assert.equal({}.polluted, undefined);
});

test("payload seguro passa com sanitizacao e sem campos inesperados de escopo", () => {
  const payload = {
    institution_id: "11111111-1111-4111-8111-111111111111",
    unit_id: "22222222-2222-4222-8222-222222222222",
    recipient_user_id: "33333333-3333-4333-8333-333333333333",
    title: "Relatorio municipal",
    message: "Resumo operacional"
  };
  const result = validatePayload(payload);
  assert.equal(result.ok, true);
  assert.equal(sanitizeText("<b>ok</b>../x"), "bok/bx");
});

test("lote de 600 entradas invalidas nao aumenta memoria anormalmente", () => {
  const before = process.memoryUsage().heapUsed;
  let rejected = 0;
  for (let i = 0; i < 600; i += 1) {
    const payload = attacks[i % attacks.length];
    const result = validatePayload({ ...payload, title: `${payload.title || "ataque"}-${i}` });
    if (!result.ok) rejected += 1;
  }
  const delta = process.memoryUsage().heapUsed - before;
  assert.equal(rejected, 600);
  assert.ok(delta < 40 * 1024 * 1024, `memory delta ${delta}`);
});

export { SEED, sanitizeLog, sanitizeText, validatePayload };
