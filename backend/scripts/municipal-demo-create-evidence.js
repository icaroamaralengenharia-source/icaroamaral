import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateMunicipalDemoConfig } from "../src/municipal-demo-config.js";
import { preflight } from "./municipal-demo-preflight.js";
import { applySchema } from "./municipal-demo-apply-schema.js";
import { applySeed } from "./municipal-demo-apply-seed.js";
import { verifyDemo } from "./municipal-demo-verify.js";
import { cleanupDemo } from "./municipal-demo-cleanup.js";
import { FILES, isMain, parseArgs, readRequiredFile, runCli, sanitize } from "./municipal-demo-lib.js";

const DEFAULT_EVIDENCE_OUTPUT = "artifacts/municipal-demo-evidence.json";

const fixtureEnv = Object.freeze({
  APP_ENV: "demo",
  NODE_ENV: "production",
  MUNICIPAL_DEMO_MODE: "true",
  DEMO_SUPABASE_URL: "https://demomunicipalabcdefghijkl.supabase.co",
  DEMO_SUPABASE_PROJECT_REF: "demomunicipalabcdefghijkl",
  DEMO_SUPABASE_ANON_KEY: "anon_placeholder_for_dry_run_only",
  SUPABASE_SERVICE_ROLE_KEY: "service_placeholder_for_dry_run_only",
  AI_ALLOWED_ORIGINS: "https://demo.exemplo.com",
  MUNICIPAL_WHATSAPP_ENABLED: "false",
  MUNICIPAL_EMAIL_ENABLED: "false",
  MUNICIPAL_DEMO_SEED_ENABLED: "false"
});

const fixtureUsers = Object.freeze({
  "platform-admin-user-id": "11111111-1111-4111-8111-111111111111",
  "municipal-admin-user-id": "22222222-2222-4222-8222-222222222222",
  "gestor-user-id": "33333333-3333-4333-8333-333333333333",
  "leitura-user-id": "44444444-4444-4444-8444-444444444444"
});

function gitValue(root, args) {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch (_) {
    return "unavailable";
  }
}

function gitStatus(root) {
  const status = gitValue(root, ["status", "--short"]);
  return status ? "dirty" : "clean";
}

function sqlHashes(root) {
  return Object.fromEntries(Object.entries(FILES).map(([kind, relativePath]) => {
    const file = readRequiredFile(root, relativePath);
    return [kind, { file: relativePath, sha256: file.sha256, bytes: file.bytes }];
  }));
}

async function createEvidence(args = {}, options = {}) {
  const root = resolve(options.cwd || process.cwd(), args.root || ".");
  const env = options.env || fixtureEnv;
  const dryRunArgs = { root };
  const config = validateMunicipalDemoConfig(env);
  const results = {
    preflight: await preflight(dryRunArgs, { env, cwd: root }),
    schema: await applySchema(dryRunArgs, { env, cwd: root }),
    seed: await applySeed({ ...dryRunArgs, ...fixtureUsers }, { env, cwd: root }),
    verification: await verifyDemo(dryRunArgs, { env, cwd: root }),
    cleanup: await cleanupDemo(dryRunArgs, { env, cwd: root })
  };
  const evidence = sanitize({
    generated_at: new Date().toISOString(),
    branch: gitValue(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    head: gitValue(root, ["rev-parse", "--short", "HEAD"]),
    git_status: gitStatus(root),
    sql_hashes: sqlHashes(root),
    preflight: results.preflight,
    dry_runs: results,
    environment_validated: config.ok,
    database_connected: false,
    sql_executed: false,
    deploy_realizado: false,
    risks: [
      "Criacao do projeto demo real ainda e manual.",
      "Credenciais reais devem ficar fora do Git.",
      "Execucao automatica de SQL segue bloqueada sem executor aprovado."
    ],
    pending: [
      "Criar projeto demo isolado.",
      "Criar usuarios ficticios no Auth demo.",
      "Aplicar SQL manualmente quando autorizado.",
      "Registrar evidencia operacional real."
    ],
    decision: "PRONTO PARA CRIACAO MANUAL DO AMBIENTE DEMO"
  });

  if (args.write) {
    const output = resolve(root, args.output || DEFAULT_EVIDENCE_OUTPUT);
    if (!output.includes(`${resolve(root, "artifacts")}`)) {
      const err = new Error("evidence_output_must_be_under_artifacts");
      err.code = "evidence_output_must_be_under_artifacts";
      throw err;
    }
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, JSON.stringify(evidence, null, 2) + "\n", "utf8");
    return sanitize({ ok: true, dry_run: false, written: true, output: DEFAULT_EVIDENCE_OUTPUT, evidence });
  }
  return sanitize({ ok: true, dry_run: true, written: false, output: existsSync(resolve(root, DEFAULT_EVIDENCE_OUTPUT)) ? DEFAULT_EVIDENCE_OUTPUT : "[not_written]", evidence });
}

if (isMain(import.meta.url)) {
  runCli("evidence", (args) => createEvidence(args), process.argv.slice(2));
}

export { DEFAULT_EVIDENCE_OUTPUT, createEvidence, fixtureEnv, fixtureUsers, parseArgs };
