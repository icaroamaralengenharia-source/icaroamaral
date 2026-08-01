import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { buildRunbook, renderRunbookMarkdown } from "../scripts/municipal-demo-build-runbook.js";
import { DEFAULT_ENV_OUTPUT, runWizard } from "../scripts/municipal-demo-wizard.js";
import { validateOperatorInput } from "../scripts/municipal-demo-validate-operator-input.js";
import { readRequiredFile } from "../scripts/municipal-demo-lib.js";

const root = process.cwd();
const validInput = Object.freeze({
  environmentName: "DEMO_MUNICIPAL_WIZARD",
  plannedDomain: "https://demo-municipal.exemplo.com",
  projectRef: "demowizardabcdefghij",
  technicalOwner: "OperadorTecnicoDemo",
  isolationConfirmed: "SIM",
  backupConfirmed: "SIM",
  integrationsDisabledConfirmed: "SIM",
  platformAdminUserId: "11111111-1111-4111-8111-111111111111",
  municipalAdminUserId: "22222222-2222-4222-8222-222222222222",
  gestorUserId: "33333333-3333-4333-8333-333333333333",
  leituraUserId: "44444444-4444-4444-8444-444444444444"
});

function expectInvalid(patch, code) {
  assert.throws(() => validateOperatorInput({ ...validInput, ...patch }), new RegExp(code));
}

function cli(args) {
  return spawnSync(process.execPath, ["backend/scripts/municipal-demo-wizard.js", ...args], {
    cwd: root,
    encoding: "utf8"
  });
}

function sqlHashes() {
  return [
    "backend/src/data/municipal-demo-schema-bundle.sql",
    "backend/src/data/municipal-demo-seed.sql",
    "backend/src/data/municipal-demo-verification.sql",
    "backend/src/data/municipal-demo-live-verification.sql"
  ].map((file) => readRequiredFile(root, file).sha256).join("|");
}

test("fluxo valido do wizard em dry-run nao abre rede nem escreve", async () => {
  const result = await runWizard({
    "non-interactive": true,
    "dry-run": true,
    "environment-name": validInput.environmentName,
    "planned-domain": validInput.plannedDomain,
    "project-ref": validInput.projectRef,
    "technical-owner": validInput.technicalOwner,
    "isolation-confirmed": validInput.isolationConfirmed,
    "backup-confirmed": validInput.backupConfirmed,
    "integrations-disabled-confirmed": validInput.integrationsDisabledConfirmed,
    "platform-admin-user-id": validInput.platformAdminUserId,
    "municipal-admin-user-id": validInput.municipalAdminUserId,
    "gestor-user-id": validInput.gestorUserId,
    "leitura-user-id": validInput.leituraUserId
  }, { cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.dry_run, true);
  assert.equal(result.written, false);
  assert.equal(result.network_opened, false);
  assert.equal(result.supabase_accessed, false);
  assert.equal(result.sql_executed, false);
  assert.equal(result.user_created, false);
  assert.equal(result.deploy_executed, false);
});

test("project refs E2E e proibido sao bloqueados", () => {
  expectInvalid({ projectRef: "mplpzyalcxhhinuvjthx" }, "blocked_project_ref:mplpzyalcxhhinuvjthx");
  expectInvalid({ projectRef: "lidueokjpzxdybtongbk" }, "blocked_project_ref:lidueokjpzxdybtongbk");
});

test("HTTP, localhost e nome sem prefixo sao bloqueados", () => {
  expectInvalid({ plannedDomain: "http://demo-municipal.exemplo.com" }, "https_domain_required");
  expectInvalid({ plannedDomain: "https://localhost:3000" }, "localhost_domain_forbidden");
  expectInvalid({ environmentName: "WIZARD" }, "environment_name_prefix_required");
});

test("UUID invalido e UUID repetido sao bloqueados", () => {
  expectInvalid({ gestorUserId: "texto" }, "uuid_invalid");
  expectInvalid({ gestorUserId: validInput.leituraUserId }, "uuid_repeated");
});

test("confirmacao diferente de SIM e bloqueada", () => {
  expectInvalid({ isolationConfirmed: "NAO" }, "confirmation_SIM_required");
});

test("responsavel com e-mail, telefone ou CPF e bloqueado", () => {
  expectInvalid({ technicalOwner: "operador@example.com" }, "technical_owner_email_forbidden");
  expectInvalid({ technicalOwner: "Operador 77999999999" }, "technical_owner_personal_data_forbidden");
  expectInvalid({ technicalOwner: "Operador 123.456.789-00" }, "technical_owner_personal_data_forbidden");
});

test("senha token e connection string em entrada sao bloqueados", () => {
  expectInvalid({ technicalOwner: "service_role token" }, "technical_owner_sensitive_value_forbidden");
  expectInvalid({ environmentName: "DEMO_MUNICIPAL_password" }, "environment_name_contains_sensitive_value");
  expectInvalid({ plannedDomain: "postgres://user:pass@host/db" }, "https_domain_required");
});

test("wizard nao modifica SQL e nao cria .env real em dry-run", async () => {
  const before = sqlHashes();
  await runWizard({ "non-interactive": true, "dry-run": true, ...Object.fromEntries(Object.entries(validInput).map(([key, value]) => [key, value])) }, { cwd: root });
  assert.equal(sqlHashes(), before);
  assert.equal(existsSync(`${root}/.env`), false);
});

test("runbook contem hashes e nao expoe UUID completo", () => {
  const runbook = buildRunbook(validInput, { root });
  const markdown = renderRunbookMarkdown(runbook);
  assert.match(markdown, /SHA-256 [a-f0-9]{64}/);
  assert.doesNotMatch(markdown, /11111111-1111-4111-8111-111111111111/);
  assert.match(markdown, /11111111\.\.\.1111/);
});

test("artifacts e ignorado pelo Git e env permitido nao e env real", () => {
  const ignore = readFileSync(`${root}/.gitignore`, "utf8");
  assert.match(ignore, /^artifacts\/$/m);
  assert.equal(DEFAULT_ENV_OUTPUT.endsWith(".env"), false);
});

test("package scripts sao seguros", () => {
  const pkg = JSON.parse(readFileSync(`${root}/backend/package.json`, "utf8").replace(/^\uFEFF/, ""));
  for (const name of ["demo:wizard", "demo:wizard:example", "demo:runbook:dry-run"]) {
    assert.ok(pkg.scripts[name], `${name} ausente`);
    assert.doesNotMatch(pkg.scripts[name], /--execute|RUN_DEMO_LIVE_TESTS=true|supabase\s|supabase\.com|deploy/i);
    assert.doesNotMatch(pkg.scripts[name], /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  }
});

test("falha CLI usa exit code diferente de zero e saida sanitizada", () => {
  const result = cli([
    "--non-interactive",
    "--environment-name", "DEMO_MUNICIPAL_WIZARD",
    "--planned-domain", "http://localhost:3000",
    "--project-ref", "mplpzyalcxhhinuvjthx",
    "--technical-owner", "operador@example.com token=SECRET",
    "--isolation-confirmed", "NAO"
  ]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /operator_input_invalid/);
  assert.doesNotMatch(result.stderr, /SECRET|operador@example\.com|token=/i);
});

