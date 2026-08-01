import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { applySchema } from "../scripts/municipal-demo-apply-schema.js";
import { applySeed } from "../scripts/municipal-demo-apply-seed.js";
import { buildRunbook } from "../scripts/municipal-demo-build-runbook.js";
import { cleanupDemo } from "../scripts/municipal-demo-cleanup.js";
import { fixtureEnv, fixtureUsers } from "../scripts/municipal-demo-create-evidence.js";
import { preflight } from "../scripts/municipal-demo-preflight.js";
import { runWizard } from "../scripts/municipal-demo-wizard.js";
import { smokeLocal } from "../scripts/municipal-demo-smoke-local.js";
import { verifyDemo } from "../scripts/municipal-demo-verify.js";
import { FILES, assertSqlSafety, readRequiredFile } from "../scripts/municipal-demo-lib.js";

const root = process.cwd();
const CYCLES = 10;
const SEED = "municipal-demo-repeatability-v1";
const CYCLE_TIMEOUT_MS = 10_000;
const safeEnv = Object.freeze({
  ...fixtureEnv,
  APP_ENV: "demo",
  MUNICIPAL_DEMO_MODE: "true",
  DEMO_SUPABASE_URL: "https://demorepeatabcdefghij.supabase.co",
  DEMO_SUPABASE_PROJECT_REF: "demorepeatabcdefghij",
  AI_ALLOWED_ORIGINS: "https://demo-repeat.exemplo.invalid",
  MUNICIPAL_WHATSAPP_ENABLED: "false",
  MUNICIPAL_EMAIL_ENABLED: "false",
  MUNICIPAL_DEMO_SEED_ENABLED: "false"
});

const wizardArgs = Object.freeze({
  "non-interactive": true,
  "dry-run": true,
  "environment-name": "DEMO_MUNICIPAL_REPEATABILITY",
  "planned-domain": "https://demo-repeat.exemplo.invalid",
  "project-ref": "demorepeatabcdefghij",
  "technical-owner": "ResponsavelTecnicoRepeatability",
  "isolation-confirmed": "SIM",
  "backup-confirmed": "SIM",
  "integrations-disabled-confirmed": "SIM",
  "platform-admin-user-id": "11111111-1111-4111-8111-111111111111",
  "municipal-admin-user-id": "22222222-2222-4222-8222-222222222222",
  "gestor-user-id": "33333333-3333-4333-8333-333333333333",
  "leitura-user-id": "44444444-4444-4444-8444-444444444444"
});

function sqlHashes() {
  return Object.fromEntries(Object.entries(FILES).map(([kind, file]) => {
    const info = readRequiredFile(root, file);
    return [kind, info.sha256];
  }));
}

function sqlContents() {
  return Object.fromEntries(Object.entries(FILES).map(([kind, file]) => [kind, readFileSync(`${root}/${file}`, "utf8")]));
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function statements(sql) {
  return stripSqlComments(sql).split(";").map((item) => item.trim()).filter(Boolean);
}

function assertVerificationReadOnly() {
  const verification = readRequiredFile(root, FILES.verify).content;
  for (const statement of statements(verification)) {
    assert.match(statement, /^(select|with)\b/i, statement.slice(0, 80));
  }
  assert.doesNotMatch(stripSqlComments(verification), /\b(insert|update|delete|drop|truncate|alter|create)\b/i);
}

function assertNoSecrets(serialized) {
  assert.doesNotMatch(serialized, /service_placeholder|anon_placeholder|SUPABASE_SERVICE_ROLE_KEY|eyJ[A-Za-z0-9_-]{20,}\.|postgres:\/\/|password|senha|token=/i);
}

function normalizeCycle(result) {
  return JSON.stringify({
    seed: result.seed,
    hashes: result.hashes,
    preflight: {
      ok: result.preflight.ok,
      dry_run: result.preflight.dry_run,
      project_ref_confirmed: result.preflight.project_ref_confirmed,
      environment_validated: result.preflight.environment_validated
    },
    schema: {
      ok: result.schema.ok,
      dry_run: result.schema.dry_run,
      executed: Boolean(result.schema.executed),
      file: result.schema.file,
      sha256: result.schema.sha256
    },
    seedDryRun: {
      ok: result.seedDryRun.ok,
      dry_run: result.seedDryRun.dry_run,
      executed: Boolean(result.seedDryRun.executed),
      placeholders_unresolved: result.seedDryRun.placeholders_unresolved,
      sha256: result.seedDryRun.sha256
    },
    verification: {
      ok: result.verification.ok,
      dry_run: result.verification.dry_run,
      executed: Boolean(result.verification.executed),
      sha256: result.verification.sha256
    },
    cleanup: {
      ok: result.cleanup.ok,
      dry_run: result.cleanup.dry_run,
      executed: Boolean(result.cleanup.executed),
      sha256: result.cleanup.sha256
    },
    wizard: {
      ok: result.wizard.ok,
      dry_run: result.wizard.dry_run,
      written: result.wizard.written,
      network_opened: result.wizard.network_opened,
      sql_executed: result.wizard.sql_executed
    },
    runbookDecision: result.runbook.decision,
    smoke: {
      ok: result.smoke.ok,
      dry_run: result.smoke.dry_run,
      external_access: result.smoke.external_access,
      database_connected: result.smoke.database_connected,
      sql_executed: result.smoke.sql_executed,
      app_loaded: result.smoke.app_loaded
    }
  });
}

async function runCycle(cycle) {
  const started = performance.now();
  const beforeHashes = sqlHashes();
  const beforeSql = sqlContents();
  for (const [kind, file] of Object.entries(FILES)) {
    assertSqlSafety(kind, beforeSql[kind]);
  }
  assertVerificationReadOnly();

  const base = { root };
  const preflightResult = await preflight({ ...base }, { env: { ...safeEnv }, cwd: root });
  const schema = await applySchema({ ...base }, { env: { ...safeEnv }, cwd: root });
  const seedDryRun = await applySeed({ ...base, ...fixtureUsers }, { env: { ...safeEnv }, cwd: root });
  const verification = await verifyDemo({ ...base }, { env: { ...safeEnv }, cwd: root });
  const cleanup = await cleanupDemo({ ...base }, { env: { ...safeEnv }, cwd: root });
  const wizard = await runWizard({ ...wizardArgs }, { cwd: root, write: false });
  const runbook = buildRunbook({
    environmentName: wizardArgs["environment-name"],
    plannedDomain: wizardArgs["planned-domain"],
    projectRef: wizardArgs["project-ref"],
    technicalOwner: wizardArgs["technical-owner"],
    isolationConfirmed: "SIM",
    backupConfirmed: "SIM",
    integrationsDisabledConfirmed: "SIM",
    platformAdminUserId: wizardArgs["platform-admin-user-id"],
    municipalAdminUserId: wizardArgs["municipal-admin-user-id"],
    gestorUserId: wizardArgs["gestor-user-id"],
    leituraUserId: wizardArgs["leitura-user-id"]
  }, { root });
  const smoke = await smokeLocal({ ...base }, { env: { ...safeEnv }, cwd: root });

  const durationMs = performance.now() - started;
  assert.ok(durationMs < CYCLE_TIMEOUT_MS, `cycle_timeout:${cycle}:${durationMs}`);
  const afterHashes = sqlHashes();
  const afterSql = sqlContents();
  assert.deepEqual(afterHashes, beforeHashes, `sql_hash_changed:${cycle}`);
  assert.deepEqual(afterSql, beforeSql, `sql_content_changed:${cycle}`);

  const cycleResult = {
    cycle,
    seed: SEED,
    durationMs,
    hashes: afterHashes,
    preflight: preflightResult,
    schema,
    seedDryRun,
    verification,
    cleanup,
    wizard,
    runbook,
    smoke,
    connection_opened: false,
    sql_executed: false,
    supabase_accessed: false,
    deploy_executed: false,
    differences_detected: []
  };

  assert.equal(preflightResult.ok, true, `preflight_failed:${cycle}`);
  assert.equal(schema.dry_run, true, `schema_not_dry_run:${cycle}`);
  assert.equal(seedDryRun.dry_run, true, `seed_not_dry_run:${cycle}`);
  assert.equal(verification.dry_run, true, `verification_not_dry_run:${cycle}`);
  assert.equal(cleanup.dry_run, true, `cleanup_not_dry_run:${cycle}`);
  assert.equal(wizard.dry_run, true, `wizard_not_dry_run:${cycle}`);
  assert.equal(wizard.written, false, `wizard_written:${cycle}`);
  assert.equal(smoke.external_access, false, `smoke_external_access:${cycle}`);
  assert.equal(smoke.database_connected, false, `smoke_database_connected:${cycle}`);
  assert.equal(smoke.sql_executed, false, `smoke_sql_executed:${cycle}`);
  assert.equal("executed" in schema, false, `schema_executed:${cycle}`);
  assert.equal("executed" in seedDryRun, false, `seed_executed:${cycle}`);
  assert.equal("executed" in verification, false, `verification_executed:${cycle}`);
  assert.equal("executed" in cleanup, false, `cleanup_executed:${cycle}`);
  assertNoSecrets(JSON.stringify(cycleResult));
  return cycleResult;
}

test("preflight municipal e repetivel em 10 ciclos dry-run", { timeout: 120_000 }, async () => {
  const results = [];
  const totalStarted = performance.now();
  for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
    results.push(await runCycle(cycle));
  }
  const normalized = results.map(normalizeCycle);
  const first = normalized[0];
  for (const item of normalized) {
    assert.equal(item, first, "saida_equivalente_entre_ciclos");
  }
  const firstHashes = JSON.stringify(results[0].hashes);
  for (const result of results) {
    assert.equal(JSON.stringify(result.hashes), firstHashes, `hashes_diferentes:${result.cycle}`);
    assert.deepEqual(result.differences_detected, []);
  }
  const totalDurationMs = performance.now() - totalStarted;
  const averageDurationMs = totalDurationMs / results.length;
  assert.equal(results.length, CYCLES);
  assert.ok(averageDurationMs < CYCLE_TIMEOUT_MS);
  console.log(JSON.stringify({
    ok: true,
    seed: SEED,
    cycles: results.length,
    totalDurationMs: Math.round(totalDurationMs),
    averageDurationMs: Math.round(averageDurationMs),
    hashes: results[0].hashes,
    differences: []
  }));
});
