import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { validateMunicipalDemoConfig } from "../src/municipal-demo-config.js";
import { applySchema } from "../scripts/municipal-demo-apply-schema.js";
import { applySeed } from "../scripts/municipal-demo-apply-seed.js";
import { verifyDemo } from "../scripts/municipal-demo-verify.js";
import { cleanupDemo } from "../scripts/municipal-demo-cleanup.js";
import { createEvidence, fixtureEnv, fixtureUsers } from "../scripts/municipal-demo-create-evidence.js";
import { envExampleContent, generateEnvExample } from "../scripts/municipal-demo-generate-env.js";
import { fullDryRun, smokeLocal } from "../scripts/municipal-demo-smoke-local.js";
import { FILES, readRequiredFile } from "../scripts/municipal-demo-lib.js";
import { preflight } from "../scripts/municipal-demo-preflight.js";

const root = process.cwd();
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

function tempDir() {
  return mkdtempSync(join(tmpdir(), "municipal-demo-dry-run-"));
}

function runNode(args, env = {}) {
  return spawnSync(process.execPath, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8"
  });
}

function sqlHashes() {
  return Object.fromEntries(Object.entries(FILES).map(([kind, file]) => [kind, readRequiredFile(root, file).sha256]));
}

test("gerador cria somente exemplo local e nao sobrescreve sem force", () => {
  const dir = tempDir();
  try {
    const output = join(dir, ".env.demo.local.example");
    const first = generateEnvExample({ output }, { cwd: root });
    assert.equal(first.written, true);
    assert.throws(() => generateEnvExample({ output }, { cwd: root }), /env_example_exists_use_force/);
    const forced = generateEnvExample({ output, force: true }, { cwd: root });
    assert.equal(forced.overwritten, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gerador nao cria segredo, URL real, E2E ou projeto proibido", () => {
  const content = envExampleContent();
  assert.doesNotMatch(content, /mplpzyalcxhhinuvjthx|lidueokjpzxdybtongbk/i);
  assert.doesNotMatch(content, /=\s*eyJ[A-Za-z0-9_-]{20,}\.|=\s*service_role_[A-Za-z0-9_-]+|=\s*anon_[A-Za-z0-9_-]+/i);
  assert.match(content, /APP_ENV=demo/);
  assert.match(content, /MUNICIPAL_DEMO_MODE=true/);
  assert.match(content, /MUNICIPAL_WHATSAPP_ENABLED=false/);
  assert.match(content, /MUNICIPAL_EMAIL_ENABLED=false/);
});

test("preflight sem variaveis bloqueia e com ambiente ficticio passa", async () => {
  await assert.rejects(preflight({ root }, { env: {}, cwd: root }), /demo_config_invalid/);
  const result = await preflight({ root }, { env: fixtureEnv, cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.environment_validated, true);
});

test("dry-runs de schema, seed, verification e cleanup nao executam SQL", async () => {
  const before = sqlHashes();
  const schema = await applySchema({ root }, { env: fixtureEnv, cwd: root });
  const seed = await applySeed({ root, ...fixtureUsers }, { env: fixtureEnv, cwd: root });
  const verification = await verifyDemo({ root }, { env: fixtureEnv, cwd: root });
  const cleanup = await cleanupDemo({ root }, { env: fixtureEnv, cwd: root });
  for (const result of [schema, seed, verification, cleanup]) {
    assert.equal(result.dry_run, true);
    assert.equal("executed" in result, false);
  }
  assert.deepEqual(sqlHashes(), before);
});

test("evidence sanitiza conexao, UUIDs e nao escreve sem opcao explicita", async () => {
  const evidence = await createEvidence({ root }, { env: fixtureEnv, cwd: root });
  const serialized = JSON.stringify(evidence);
  assert.equal(evidence.written, false);
  assert.doesNotMatch(serialized, /supabase\.co|service_placeholder|anon_placeholder/i);
  assert.doesNotMatch(serialized, uuidRe);
  assert.equal(evidence.evidence.database_connected, false);
  assert.equal(evidence.evidence.sql_executed, false);
  assert.equal(evidence.evidence.deploy_realizado, false);
});

test("evidence escreve apenas em artifacts quando solicitado", async () => {
  const result = await createEvidence({ root, write: true }, { env: fixtureEnv, cwd: root });
  assert.equal(result.written, true);
  assert.equal(result.output, "artifacts/municipal-demo-evidence.json");
  await assert.rejects(
    createEvidence({ root, write: true, output: "backend/evidence.json" }, { env: fixtureEnv, cwd: root }),
    /evidence_output_must_be_under_artifacts/
  );
});

test("smoke local nao abre rede externa e encontra arquivos obrigatorios", async () => {
  const result = await smokeLocal({ root }, { env: fixtureEnv, cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.external_access, false);
  assert.equal(result.database_connected, false);
  assert.equal(result.sql_executed, false);
  assert.equal(result.static_files.every((item) => item.exists), true);
  assert.equal(result.script_files.every((item) => item.exists), true);
});

test("ausencia de IA nao falha e WhatsApp/e-mail ativos bloqueiam", async () => {
  const noAi = validateMunicipalDemoConfig({ ...fixtureEnv, OPENAI_API_KEY: "" });
  assert.equal(noAi.ok, true);
  assert.equal(noAi.checks.find((check) => check.id === "ai_optional").status, "warning");
  assert.equal(validateMunicipalDemoConfig({ ...fixtureEnv, MUNICIPAL_WHATSAPP_ENABLED: "true" }).ok, false);
  assert.equal(validateMunicipalDemoConfig({ ...fixtureEnv, MUNICIPAL_EMAIL_ENABLED: "true" }).ok, false);
});

test("full dry-run nao contem --execute e nao abre conexao", async () => {
  const pkg = JSON.parse(readFileSync(`${root}/backend/package.json`, "utf8").replace(/^\uFEFF/, ""));
  assert.equal(pkg.scripts["demo:full:dry-run"].includes("--execute"), false);
  const result = await fullDryRun({ root }, { env: fixtureEnv, cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.execute_flag_used, false);
  assert.equal(result.steps.smoke.external_access, false);
});

test("E2E e projeto proibido continuam bloqueados", async () => {
  await assert.rejects(
    preflight({ root }, { env: { ...fixtureEnv, DEMO_SUPABASE_URL: "https://mplpzyalcxhhinuvjthx.supabase.co" }, cwd: root }),
    /demo_config_invalid|blocked_project_ref/
  );
  await assert.rejects(
    preflight({ root }, { env: { ...fixtureEnv, DEMO_SUPABASE_URL: "https://lidueokjpzxdybtongbk.supabase.co" }, cwd: root }),
    /demo_config_invalid|blocked_project_ref/
  );
});

test("CLI BLOCKED tem exit code nao zero e PASS tem exit code zero", () => {
  const blocked = runNode(["backend/scripts/municipal-demo-preflight.js", "--root", root], { APP_ENV: "demo" });
  assert.notEqual(blocked.status, 0);
  assert.doesNotMatch(blocked.stderr, /service_fixture|supabase\.co|Bearer [A-Za-z]|eyJ[A-Za-z0-9_-]{20,}\./i);
  const pass = runNode(["backend/scripts/municipal-demo-preflight.js", "--root", root], fixtureEnv);
  assert.equal(pass.status, 0);
  assert.match(pass.stdout, /"ok": true/);
});

test("servidor temporario localhost encerra sozinho e health nao expoe config", async () => {
  const result = await smokeLocal({ root, "start-local": true }, { env: fixtureEnv, cwd: root });
  assert.equal(result.health.ok, true);
  assert.equal(result.health.server_closed, true);
  assert.doesNotMatch(JSON.stringify(result), /service_|supabase\.co|SUPABASE|Bearer|jwt/i);
});

test("artifacts e ignorado e documentacao nao afirma deploy realizado", () => {
  const ignore = readFileSync(`${root}/.gitignore`, "utf8");
  assert.match(ignore, /^artifacts\/$/m);
  const docs = [
    "docs/OPERACAO-AMBIENTE-DEMO-MUNICIPAL.md",
    "docs/GUIA-CRIACAO-AMBIENTE-DEMO-MUNICIPAL.md"
  ].map((file) => readFileSync(`${root}/${file}`, "utf8")).join("\n");
  assert.doesNotMatch(docs, /deploy realizado|SQL executado|banco criado/i);
});
