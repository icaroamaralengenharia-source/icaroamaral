import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const REQUIRED_E2E_ENV = [
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "E2E_ALLOW_WRITES",
  "E2E_ENVIRONMENT",
  "E2E_ADMIN_EMAIL",
  "E2E_ADMIN_PASSWORD",
  "E2E_TENANT_SLUG",
  "E2E_COMPANY_NAME",
  "E2E_CLIENT_NAME",
  "E2E_WORK_NAME"
];

const SECRET_KEYS = new Set([
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "E2E_ADMIN_PASSWORD"
]);

export function parseDotEnv(text = "") {
  const parsed = {};
  String(text).split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    parsed[match[1]] = value;
  });
  return parsed;
}

export function loadE2eEnv(argv = process.argv.slice(2), baseEnv = process.env) {
  const env = { ...baseEnv };
  const envIndex = argv.indexOf("--env");
  const envPath = envIndex >= 0 ? argv[envIndex + 1] : ".env.e2e";
  const resolvedEnvPath = resolve(envPath || ".env.e2e");
  if (existsSync(resolvedEnvPath)) {
    Object.assign(env, parseDotEnv(readFileSync(resolvedEnvPath, "utf8")));
  }
  return { env, envPath: resolvedEnvPath };
}

function classifySupabaseUrl(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (!/^https?:$/.test(url.protocol)) return { ok: false, status: "invalida", reason: "protocol" };
    if (host === "localhost" || host === "127.0.0.1") return { ok: true, status: "aparentemente teste" };
    if (/\b(prod|production|producao|produção)\b/i.test(value)) return { ok: false, status: "aparentemente produção", reason: "production_marker" };
    if (host.endsWith(".supabase.co")) return { ok: true, status: /e2e|test|dev|staging|sandbox/i.test(value) ? "aparentemente teste" : "presente/nao classificada" };
    return { ok: false, status: "invalida", reason: "unexpected_host" };
  } catch {
    return { ok: false, status: "invalida", reason: "parse" };
  }
}

function isReservedTestEmail(email) {
  const match = String(email || "").trim().toLowerCase().match(/@([^@]+)$/);
  return Boolean(match && match[1].endsWith(".test"));
}

export function validateE2eEnv(env) {
  const checks = [];
  const errors = [];
  const add = (key, status, ok, reason = "") => {
    checks.push({ key, status, ok, reason, secret: SECRET_KEYS.has(key) });
    if (!ok) errors.push({ key, status, reason });
  };

  REQUIRED_E2E_ENV.forEach((key) => {
    if (!String(env[key] || "").trim()) add(key, "ausente", false, "required");
  });

  if (env.SUPABASE_URL) {
    const urlCheck = classifySupabaseUrl(env.SUPABASE_URL);
    add("SUPABASE_URL", urlCheck.status, urlCheck.ok, urlCheck.reason || "");
  }
  if (env.E2E_ALLOW_WRITES) add("E2E_ALLOW_WRITES", env.E2E_ALLOW_WRITES === "true" ? "presente/valida" : "presente/invalida", env.E2E_ALLOW_WRITES === "true", "must_be_true");
  if (env.E2E_ENVIRONMENT) add("E2E_ENVIRONMENT", env.E2E_ENVIRONMENT === "test" ? "presente/aparentemente teste" : "presente/invalida", env.E2E_ENVIRONMENT === "test", "must_be_test");
  if (env.E2E_TENANT_SLUG) add("E2E_TENANT_SLUG", /^elo-e2e-[a-z0-9-]+$/.test(env.E2E_TENANT_SLUG) ? "presente/valida" : "presente/invalida", /^elo-e2e-[a-z0-9-]+$/.test(env.E2E_TENANT_SLUG), "must_start_with_elo_e2e");
  if (env.E2E_ADMIN_EMAIL) add("E2E_ADMIN_EMAIL", isReservedTestEmail(env.E2E_ADMIN_EMAIL) ? "presente/dominio teste" : "presente/invalida", isReservedTestEmail(env.E2E_ADMIN_EMAIL), "must_end_with_dot_test");

  return { ok: errors.length === 0, checks, errors };
}

export function publicEnvReport(validation) {
  return validation.checks.map((check) => ({
    key: check.key,
    status: check.status,
    ok: check.ok,
    reason: check.reason || undefined
  }));
}

function isMain() {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
}

if (isMain()) {
  const { env, envPath } = loadE2eEnv();
  const validation = validateE2eEnv(env);
  console.log(JSON.stringify({ ok: validation.ok, envPath, checks: publicEnvReport(validation) }, null, 2));
  process.exit(validation.ok ? 0 : 1);
}
