import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { createApp } from "../src/app.js";
import { validateMunicipalDemoConfig } from "../src/municipal-demo-config.js";
import { preflight } from "./municipal-demo-preflight.js";
import { applySchema } from "./municipal-demo-apply-schema.js";
import { applySeed } from "./municipal-demo-apply-seed.js";
import { verifyDemo } from "./municipal-demo-verify.js";
import { cleanupDemo } from "./municipal-demo-cleanup.js";
import { fixtureEnv, fixtureUsers } from "./municipal-demo-create-evidence.js";
import { FILES, assertSqlSafety, isMain, parseArgs, readRequiredFile, runCli, sanitize } from "./municipal-demo-lib.js";

const REQUIRED_STATIC_FILES = [
  "municipal-admin.html",
  "relatorio-qualidade-obras/municipal-admin-ui.js",
  "relatorio-qualidade-obras/municipal-admin-ui.css"
];

const REQUIRED_SCRIPT_FILES = [
  "backend/scripts/municipal-demo-preflight.js",
  "backend/scripts/municipal-demo-apply-schema.js",
  "backend/scripts/municipal-demo-apply-seed.js",
  "backend/scripts/municipal-demo-verify.js",
  "backend/scripts/municipal-demo-cleanup.js",
  "backend/scripts/municipal-demo-generate-env.js",
  "backend/scripts/municipal-demo-create-evidence.js",
  "backend/scripts/municipal-demo-smoke-local.js"
];

function ensureFiles(root, files) {
  return files.map((file) => ({ file, exists: existsSync(resolve(root, file)) }));
}

function assertAllFilesPresent(entries) {
  const missing = entries.filter((entry) => !entry.exists).map((entry) => entry.file);
  if (missing.length) {
    const err = new Error(`required_files_missing:${missing.join(",")}`);
    err.code = "required_files_missing";
    throw err;
  }
}

async function healthProbe(root, env) {
  const app = createApp({ env: { ...env, AI_ALLOWED_ORIGINS: "http://127.0.0.1" }, eloSentinelSupabaseClient: null });
  return new Promise((resolvePromise, reject) => {
    const server = app.listen(0, "127.0.0.1", async () => {
      try {
        const port = server.address().port;
        const response = await fetch(`http://127.0.0.1:${port}/api/health`);
        const text = await response.text();
        if (response.status !== 200) throw new Error(`health_status:${response.status}`);
        if (/supabase\.co|service_|SUPABASE|Bearer|token|jwt/i.test(text)) throw new Error("health_exposes_sensitive_data");
        server.close(() => resolvePromise({ ok: true, status: response.status, server_closed: true }));
      } catch (error) {
        server.close(() => reject(error));
      }
    });
    server.on("error", reject);
  });
}

async function smokeLocal(args = {}, options = {}) {
  const root = resolve(options.cwd || process.cwd(), args.root || ".");
  const env = options.env || fixtureEnv;
  const config = validateMunicipalDemoConfig({ ...env, OPENAI_API_KEY: "" });
  if (!config.ok) {
    const err = new Error("demo_smoke_config_invalid");
    err.code = "demo_smoke_config_invalid";
    err.summary = sanitize(config);
    throw err;
  }
  const staticFiles = ensureFiles(root, REQUIRED_STATIC_FILES);
  const scriptFiles = ensureFiles(root, REQUIRED_SCRIPT_FILES);
  const sqlFiles = ensureFiles(root, Object.values(FILES));
  assertAllFilesPresent([...staticFiles, ...scriptFiles, ...sqlFiles]);
  for (const [kind, relativePath] of Object.entries(FILES)) {
    const file = readRequiredFile(root, relativePath);
    assertSqlSafety(kind, file.content);
  }
  const app = createApp({ env: { AI_ALLOWED_ORIGINS: "http://127.0.0.1" }, eloSentinelSupabaseClient: null });
  if (!app || typeof app.listen !== "function") throw Object.assign(new Error("app_not_loadable"), { code: "app_not_loadable" });
  const server = args["start-local"] ? await healthProbe(root, env) : { ok: true, skipped: true, server_started: false };
  return sanitize({
    ok: true,
    dry_run: true,
    external_access: false,
    database_connected: false,
    sql_executed: false,
    app_loaded: true,
    config_ok: config.ok,
    health: server,
    static_files: staticFiles,
    script_files: scriptFiles,
    sql_files: sqlFiles,
    integrations: { whatsapp: false, email: false, ai: "optional" }
  });
}

async function fullDryRun(args = {}, options = {}) {
  const root = resolve(options.cwd || process.cwd(), args.root || ".");
  const env = options.env || fixtureEnv;
  const base = { root };
  return sanitize({
    ok: true,
    dry_run: true,
    execute_flag_used: false,
    steps: {
      preflight: await preflight(base, { env, cwd: root }),
      schema: await applySchema(base, { env, cwd: root }),
      seed: await applySeed({ ...base, ...fixtureUsers }, { env, cwd: root }),
      verification: await verifyDemo(base, { env, cwd: root }),
      cleanup: await cleanupDemo(base, { env, cwd: root }),
      smoke: await smokeLocal(base, { env, cwd: root })
    }
  });
}

if (isMain(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  runCli("smoke-local", (parsed) => parsed.full ? fullDryRun(parsed) : smokeLocal(parsed), process.argv.slice(2));
}

export { REQUIRED_SCRIPT_FILES, REQUIRED_STATIC_FILES, fullDryRun, parseArgs, smokeLocal };
