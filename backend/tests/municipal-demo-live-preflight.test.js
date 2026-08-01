import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  FILES,
  findBlockedProject,  readRequiredFile,
  sanitize
} from "../scripts/municipal-demo-lib.js";

const root = process.cwd();
const LIVE_PREFIX = "DEMO_MUNICIPAL_LIVE_52_";
const LIVE_VERIFICATION = "backend/src/data/municipal-demo-live-verification.sql";
const BLOCKED_REFS = ["mplpzyalcxhhinuvjthx", "lidueokjpzxdybtongbk"];
const safeEnv = {
  APP_ENV: "demo",
  MUNICIPAL_DEMO_MODE: "true",
  RUN_DEMO_LIVE_TESTS: "false",
  DEMO_PROJECT_REF: "demoliveabcdefghijkl",
  DEMO_SUPABASE_URL: "https://demoliveabcdefghijkl.supabase.co",
  DEMO_DATABASE_URL: "postgres://demo_user:redacted@db.demoliveabcdefghijkl.supabase.co:5432/postgres",
  AI_ALLOWED_ORIGINS: "https://demo-municipal.example.com",
  MUNICIPAL_WHATSAPP_ENABLED: "false",
  MUNICIPAL_EMAIL_ENABLED: "false",
  DEMO_PLATFORM_ADMIN_USER_ID: "11111111-1111-4111-8111-111111111111",
  DEMO_MUNICIPAL_ADMIN_USER_ID: "22222222-2222-4222-8222-222222222222",
  DEMO_GESTOR_A_USER_ID: "33333333-3333-4333-8333-333333333333",
  DEMO_GESTOR_B_USER_ID: "44444444-4444-4444-8444-444444444444",
  DEMO_LEITURA_USER_ID: "55555555-5555-4555-8555-555555555555"
};

function refFromUrl(value) {
  try {
    const hostname = new URL(String(value || "")).hostname.toLowerCase();
    return hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] || "";
  } catch (_) {
    return "";
  }
}

function validateDemoLiveEnv(env = {}) {
  const failures = [];
  const projectRef = String(env.DEMO_PROJECT_REF || "").trim();
  const url = String(env.DEMO_SUPABASE_URL || "").trim();
  const databaseUrl = String(env.DEMO_DATABASE_URL || "").trim();
  const urlProjectRef = refFromUrl(url);
  if (env.RUN_DEMO_LIVE_TESTS !== "true") failures.push("blocked_without_RUN_DEMO_LIVE_TESTS");
  if (env.APP_ENV !== "demo") failures.push("APP_ENV_must_be_demo");
  if (env.MUNICIPAL_DEMO_MODE !== "true") failures.push("MUNICIPAL_DEMO_MODE_must_be_true");
  if (!projectRef) failures.push("DEMO_PROJECT_REF_required");
  if (!url) failures.push("DEMO_SUPABASE_URL_required");
  if (!databaseUrl) failures.push("DEMO_DATABASE_URL_required");
  if (!url.startsWith("https://")) failures.push("DEMO_SUPABASE_URL_must_use_https");
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)) failures.push("localhost_url_forbidden_for_remote_live");
  if (urlProjectRef && projectRef && urlProjectRef !== projectRef) failures.push("project_ref_url_mismatch");
  for (const value of [projectRef, url, databaseUrl]) {
    const blocked = findBlockedProject(value);
    if (blocked) failures.push(`blocked_project_ref:${blocked}`);
  }
  if (String(env.AI_ALLOWED_ORIGINS || "").trim() === "*") failures.push("cors_wildcard_forbidden");
  if (env.MUNICIPAL_WHATSAPP_ENABLED !== "false") failures.push("whatsapp_must_be_disabled");
  if (env.MUNICIPAL_EMAIL_ENABLED !== "false") failures.push("email_must_be_disabled");
  for (const key of Object.keys(env)) {
    if (/FRONTEND|VITE|PUBLIC/i.test(key) && /SERVICE_ROLE|DATABASE_URL|PASSWORD|SECRET/i.test(key)) {
      failures.push(`frontend_credential_forbidden:${key}`);
    }
  }
  return { ok: failures.length === 0, failures, projectRef, urlProjectRef };
}

function requiredUserPlaceholders(env = {}) {
  return [
    "DEMO_PLATFORM_ADMIN_USER_ID",
    "DEMO_MUNICIPAL_ADMIN_USER_ID",
    "DEMO_GESTOR_A_USER_ID",
    "DEMO_GESTOR_B_USER_ID",
    "DEMO_LEITURA_USER_ID"
  ].filter((key) => !env[key]);
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function statements(sql) {
  return stripSqlComments(sql).split(";").map((item) => item.trim()).filter(Boolean);
}

test("preflight live fica bloqueado sem flag e nao abre conexao", () => {
  const result = validateDemoLiveEnv(safeEnv);
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["blocked_without_RUN_DEMO_LIVE_TESTS"]);
});

test("preflight live aceita somente ambiente demo com ref e URL coerentes", () => {
  const result = validateDemoLiveEnv({ ...safeEnv, RUN_DEMO_LIVE_TESTS: "true" });
  assert.equal(result.ok, true);
  assert.equal(result.projectRef, result.urlProjectRef);
});

test("E2E e projeto proibido sao bloqueados em ref, URL e database URL", () => {
  for (const ref of BLOCKED_REFS) {
    const result = validateDemoLiveEnv({
      ...safeEnv,
      RUN_DEMO_LIVE_TESTS: "true",
      DEMO_PROJECT_REF: ref,
      DEMO_SUPABASE_URL: `https://${ref}.supabase.co`,
      DEMO_DATABASE_URL: `postgres://demo:secret@db.${ref}.supabase.co:5432/postgres`
    });
    assert.equal(result.ok, false);
    assert.ok(result.failures.some((failure) => failure.includes(`blocked_project_ref:${ref}`)));
  }
});

test("URL e project ref divergentes bloqueiam", () => {
  const result = validateDemoLiveEnv({ ...safeEnv, RUN_DEMO_LIVE_TESTS: "true", DEMO_PROJECT_REF: "outrodemoprojectref" });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("project_ref_url_mismatch"));
});

test("destino live rejeita localhost, CORS wildcard, HTTP e integracoes externas", () => {
  const result = validateDemoLiveEnv({
    ...safeEnv,
    RUN_DEMO_LIVE_TESTS: "true",
    DEMO_SUPABASE_URL: "http://localhost:54321",
    AI_ALLOWED_ORIGINS: "*",
    MUNICIPAL_WHATSAPP_ENABLED: "true",
    MUNICIPAL_EMAIL_ENABLED: "true"
  });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes("DEMO_SUPABASE_URL_must_use_https"));
  assert.ok(result.failures.includes("localhost_url_forbidden_for_remote_live"));
  assert.ok(result.failures.includes("cors_wildcard_forbidden"));
  assert.ok(result.failures.includes("whatsapp_must_be_disabled"));
  assert.ok(result.failures.includes("email_must_be_disabled"));
});

test("usuarios ficticios precisam ser informados antes do live", () => {
  assert.deepEqual(requiredUserPlaceholders(safeEnv), []);
  assert.deepEqual(requiredUserPlaceholders({}), [
    "DEMO_PLATFORM_ADMIN_USER_ID",
    "DEMO_MUNICIPAL_ADMIN_USER_ID",
    "DEMO_GESTOR_A_USER_ID",
    "DEMO_GESTOR_B_USER_ID",
    "DEMO_LEITURA_USER_ID"
  ]);
});

test("bundle, seed, verification e live verification possuem hashes rastreaveis", () => {
  const files = [FILES.schema, FILES.seed, FILES.verify, LIVE_VERIFICATION];
  for (const file of files) {
    const info = readRequiredFile(root, file);
    assert.match(info.sha256, /^[a-f0-9]{64}$/);
    assert.ok(info.bytes > 100, `${file} deve ter conteudo real`);
  }
});

test("credenciais e IDs completos nao aparecem em logs sanitizados", () => {
  const raw = {
    url: safeEnv.DEMO_SUPABASE_URL,
    database_url_configured: Boolean(safeEnv.DEMO_DATABASE_URL),
    token: "eyJfixture.jwt.secret",
    user_id: safeEnv.DEMO_GESTOR_A_USER_ID
  };
  const serialized = JSON.stringify(sanitize(raw));
  assert.doesNotMatch(serialized, /supabase\.co|postgres:\/\/|eyJfixture|33333333-3333-4333-8333-333333333333/i);
  assert.match(serialized, /33333333\.\.\.3333/);
});

test("verification live e estritamente read-only e cobre inconsistencias essenciais", () => {
  const sql = readFileSync(`${root}/${LIVE_VERIFICATION}`, "utf8");
  for (const statement of statements(sql)) {
    assert.match(statement, /^(select|with)\b/i, `statement nao read-only: ${statement.slice(0, 80)}`);
  }
  assert.doesNotMatch(stripSqlComments(sql), /\b(insert|update|delete|drop|truncate|alter|create)\b/i);
  for (const term of [
    LIVE_PREFIX,
    "rls_enabled",
    "policies",
    "saldo_negativo",
    "tombamento_duplicado",
    "operation_id_duplicado",
    "deduplication_key_duplicada",
    "historico_ausente",
    "auditoria_ausente",
    "notificacoes_externas"
  ]) {
    assert.match(sql, new RegExp(term, "i"));
  }
});

test("package scripts nao executam live por padrao", () => {
  const pkg = JSON.parse(readFileSync(`${root}/backend/package.json`, "utf8").replace(/^\uFEFF/, ""));
  for (const [name, script] of Object.entries(pkg.scripts)) {
    if (name.startsWith("demo:")) {
      assert.equal(script.includes("RUN_DEMO_LIVE_TESTS=true"), false, `${name} nao deve habilitar live por padrao`);
      assert.equal(script.includes("--execute"), false, `${name} nao deve executar por padrao`);
    }
  }
});

export { LIVE_PREFIX, safeEnv, validateDemoLiveEnv };




