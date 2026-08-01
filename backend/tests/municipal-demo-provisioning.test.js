import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import {
  CONFIRMATIONS,
  buildContext,
  findBlockedProject,
  parseArgs,
  replacePlaceholders,
  requireExecuteConfirmation,
  runSqlOperation,
  sanitize,
  unresolvedPlaceholders
} from "../scripts/municipal-demo-lib.js";
import { preflight } from "../scripts/municipal-demo-preflight.js";
import { applySchema } from "../scripts/municipal-demo-apply-schema.js";
import { applySeed } from "../scripts/municipal-demo-apply-seed.js";
import { verifyDemo } from "../scripts/municipal-demo-verify.js";
import { cleanupDemo } from "../scripts/municipal-demo-cleanup.js";

const root = process.cwd();
const safeEnv = {
  APP_ENV: "demo",
  NODE_ENV: "production",
  MUNICIPAL_DEMO_MODE: "true",
  DEMO_SUPABASE_URL: "https://demomunicipalabcdefghijkl.supabase.co",
  DEMO_SUPABASE_ANON_KEY: "anon_fixture_value_never_print",
  SUPABASE_SERVICE_ROLE_KEY: "service_fixture_value_never_print",
  AI_ALLOWED_ORIGINS: "https://demo.exemplo.com",
  MUNICIPAL_WHATSAPP_ENABLED: "false",
  MUNICIPAL_EMAIL_ENABLED: "false"
};

const uuid = {
  platform: "11111111-1111-4111-8111-111111111111",
  admin: "22222222-2222-4222-8222-222222222222",
  gestor: "33333333-3333-4333-8333-333333333333",
  leitura: "44444444-4444-4444-8444-444444444444"
};

test("parseArgs entende flags booleanas e valores", () => {
  const args = parseArgs(["--execute", "--confirm", CONFIRMATIONS.schema, "--root=demo"]);
  assert.equal(args.execute, true);
  assert.equal(args.confirm, CONFIRMATIONS.schema);
  assert.equal(args.root, "demo");
});

test("preflight e dry-run e nao abre conexao", async () => {
  const result = await preflight({ root }, { env: safeEnv, cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.dry_run, true);
  assert.equal(result.files.schema.path, "backend/src/data/municipal-demo-schema-bundle.sql");
  assert.equal(JSON.stringify(result).includes(safeEnv.SUPABASE_SERVICE_ROLE_KEY), false);
});

test("preflight localiza raiz quando executado de backend", async () => {
  const result = await preflight({}, { env: safeEnv, cwd: `${root}/backend` });
  assert.equal(result.ok, true);
  assert.equal(result.files.seed.path, "backend/src/data/municipal-demo-seed.sql");
});

test("scripts de aplicacao sao dry-run por padrao", async () => {
  const schema = await applySchema({ root }, { env: safeEnv, cwd: root });
  const seed = await applySeed({ root }, { env: safeEnv, cwd: root });
  const verify = await verifyDemo({ root }, { env: safeEnv, cwd: root });
  const cleanup = await cleanupDemo({ root }, { env: safeEnv, cwd: root });
  assert.equal(schema.dry_run, true);
  assert.equal(seed.dry_run, true);
  assert.equal(verify.dry_run, true);
  assert.equal(cleanup.dry_run, true);
  assert.equal("executed" in schema, false);
});

test("escrita exige --execute e confirmacao literal", async () => {
  await assert.rejects(
    applySchema({ root, execute: true, confirm: "ERRADO" }, { env: safeEnv, cwd: root }),
    /confirmation_required:APLICAR_SCHEMA_DEMO/
  );
  assert.deepEqual(requireExecuteConfirmation("cleanup", { execute: true, confirm: CONFIRMATIONS.cleanup }), {
    execute: true,
    confirmation: CONFIRMATIONS.cleanup
  });
});

test("execute sem executor nao abre rede nem banco", async () => {
  await assert.rejects(
    applySchema({ root, execute: true, confirm: CONFIRMATIONS.schema }, { env: safeEnv, cwd: root }),
    /automatic_sql_execution_not_configured/
  );
});

test("executor injetado permite testar execucao sem conexao real", async () => {
  const calls = [];
  const result = await runSqlOperation({
    kind: "verify",
    args: { root, execute: true, confirm: CONFIRMATIONS.verify },
    env: safeEnv,
    cwd: root,
    executor: async ({ sql, kind }) => {
      calls.push({ kind, selectOnly: /^\s*(--.*\n|\s)*(select|with)/i.test(sql) });
    }
  });
  assert.equal(result.executed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].kind, "verify");
});

test("bloqueia projetos E2E e proibido", async () => {
  assert.equal(findBlockedProject("https://mplpzyalcxhhinuvjthx.supabase.co"), "mplpzyalcxhhinuvjthx");
  assert.equal(findBlockedProject("https://lidueokjpzxdybtongbk.supabase.co"), "lidueokjpzxdybtongbk");
  await assert.rejects(
    preflight({ root }, { env: { ...safeEnv, DEMO_SUPABASE_URL: "https://mplpzyalcxhhinuvjthx.supabase.co" }, cwd: root }),
    /blocked_project_ref/
  );
});

test("project ref informado deve bater com a URL", () => {
  const context = buildContext(
    { root, "project-ref": "demomunicipalabcdefghijkl" },
    safeEnv,
    root
  );
  assert.equal(context.projectRef, "demomunicipalabcdefghijkl");
  assert.equal(context.projectRefConfirmed, true);
  assert.throws(
    () => buildContext({ root, "project-ref": "outroprojetodemo" }, safeEnv, root),
    /project_ref_mismatch/
  );
});

test("seed exige placeholders e aceita somente UUIDs validos", async () => {
  const dryRun = await applySeed({ root }, { env: safeEnv, cwd: root });
  assert.equal(dryRun.placeholders_unresolved, 4);
  const content = "DEMO_GESTOR_USER_ID DEMO_LEITURA_USER_ID";
  assert.equal(unresolvedPlaceholders(content).length, 2);
  assert.throws(() => replacePlaceholders(content, { DEMO_GESTOR_USER_ID: "texto" }), /invalid_uuid_placeholder/);
  const replaced = replacePlaceholders(content, {
    DEMO_GESTOR_USER_ID: uuid.gestor,
    DEMO_LEITURA_USER_ID: uuid.leitura
  });
  assert.equal(unresolvedPlaceholders(replaced).length, 0);
});

test("execute do seed exige placeholders substituidos", async () => {
  await assert.rejects(
    applySeed({ root, execute: true, confirm: CONFIRMATIONS.seed }, {
      env: safeEnv,
      cwd: root,
      executor: async () => {}
    }),
    /placeholders_unresolved/
  );
  const calls = [];
  const result = await applySeed({
    root,
    execute: true,
    confirm: CONFIRMATIONS.seed,
    "platform-admin-user-id": uuid.platform,
    "municipal-admin-user-id": uuid.admin,
    "gestor-user-id": uuid.gestor,
    "leitura-user-id": uuid.leitura
  }, {
    env: safeEnv,
    cwd: root,
    executor: async ({ sql }) => calls.push(sql)
  });
  assert.equal(result.executed, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].includes("DEMO_GESTOR_USER_ID"), false);
});

test("wrappers chamam modos corretos com executor injetado", async () => {
  const calls = [];
  const executor = async ({ kind }) => calls.push(kind);
  await applySchema({ root, execute: true, confirm: CONFIRMATIONS.schema }, { env: safeEnv, cwd: root, executor });
  await verifyDemo({ root, execute: true, confirm: CONFIRMATIONS.verify }, { env: safeEnv, cwd: root, executor });
  await cleanupDemo({ root, execute: true, confirm: CONFIRMATIONS.cleanup }, { env: safeEnv, cwd: root, executor });
  await applySeed({
    root,
    execute: true,
    confirm: CONFIRMATIONS.seed,
    "platform-admin-user-id": uuid.platform,
    "municipal-admin-user-id": uuid.admin,
    "gestor-user-id": uuid.gestor,
    "leitura-user-id": uuid.leitura
  }, { env: safeEnv, cwd: root, executor });
  assert.deepEqual(calls.sort(), ["cleanup", "schema", "seed", "verify"]);
});

test("CLI de falha retorna exit code diferente de zero e saida sanitizada", () => {
  const result = spawnSync(process.execPath, [
    "backend/scripts/municipal-demo-apply-schema.js",
    "--root",
    root,
    "--execute",
    "--confirm",
    "ERRADO"
  ], {
    cwd: root,
    env: { ...process.env, ...safeEnv },
    encoding: "utf8"
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /confirmation_required/);
  assert.equal(result.stderr.includes("supabase.co"), false);
  assert.equal(result.stderr.includes(safeEnv.SUPABASE_SERVICE_ROLE_KEY), false);
});

test("package scripts da demo permanecem dry-run por padrao", () => {
  const pkg = JSON.parse(readFileSync(`${root}/backend/package.json`, "utf8").replace(/^\uFEFF/, ""));
  const demoScripts = Object.entries(pkg.scripts).filter(([name]) => name.startsWith("demo:"));
  assert.ok(demoScripts.length >= 5);
  for (const [name, script] of demoScripts) {
    assert.equal(script.includes("--execute"), false, `${name} nao deve executar por padrao`);
  }
});

test("sanitize mascara URLs, segredos e UUIDs completos", () => {
  const data = sanitize({
    url: "https://demomunicipalabcdefghijkl.supabase.co",
    service_role_key: "service_fixture_value_never_print",
    id: uuid.gestor
  });
  const serialized = JSON.stringify(data);
  assert.equal(serialized.includes("supabase.co"), false);
  assert.equal(serialized.includes("service_fixture_value_never_print"), false);
  assert.equal(serialized.includes(uuid.gestor), false);
  assert.match(serialized, /33333333\.\.\.3333/);
});
