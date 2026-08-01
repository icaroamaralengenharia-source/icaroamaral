import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(".");
const blockedRefs = /mplpzyalcxhhinuvjthx|lidueokjpzxdybtongbk/i;
const jwtRe = /eyJ[A-Za-z0-9_-]{20,}\./;
const secretAssignmentRe = /(password|senha|token|jwt|service[_-]?role|api[_-]?key|private[_-]?key|connection\s*string|database[_-]?url)\s*[:=]\s*['"]?[A-Za-z0-9_.:/@-]{12,}/i;
const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

const files = {
  bundle: "backend/src/data/municipal-demo-schema-bundle.sql",
  seed: "backend/src/data/municipal-demo-seed.sql",
  verification: "backend/src/data/municipal-demo-verification.sql",
  cleanup: "backend/src/data/municipal-demo-cleanup.sql",
  liveVerification: "backend/src/data/municipal-demo-live-verification.sql",
  preflight: "backend/scripts/municipal-demo-preflight.js",
  applySchema: "backend/scripts/municipal-demo-apply-schema.js",
  applySeed: "backend/scripts/municipal-demo-apply-seed.js",
  verifyCli: "backend/scripts/municipal-demo-verify.js",
  cleanupCli: "backend/scripts/municipal-demo-cleanup.js",
  wizard: "backend/scripts/municipal-demo-wizard.js",
  runbook: "backend/scripts/municipal-demo-build-runbook.js",
  packageJson: "backend/package.json",
  stressTotal: "backend/tests/municipal-total-stress.test.js",
  stressConcurrency: "backend/tests/municipal-concurrency-stress.test.js",
  stressSecurity: "backend/tests/municipal-security-stress.test.js",
  chaosStress: "tests/e2e/municipal-chaos-stress.spec.js",
  livePreflight: "backend/tests/municipal-demo-live-preflight.test.js",
  liveRls: "backend/tests/municipal-demo-live-rls.test.js",
  liveConcurrency: "backend/tests/municipal-demo-live-concurrency.test.js",
  operationDocs: "docs/OPERACAO-AMBIENTE-DEMO-MUNICIPAL.md",
  checklistLive: "docs/CHECKLIST-HOMOLOGACAO-DEMO-REAL.md",
  readinessDocs: "docs/RELATORIO-PRONTIDAO-DEMO-MUNICIPAL.md",
  stressDocs: "docs/RELATORIO-STRESS-TEST-MUNICIPAL.md",
  wizardDocs: "docs/RELATORIO-ETAPA-53-WIZARD-DEMO.md",
  exampleDocs: "docs/RELATORIO-ETAPA-54-WIZARD-EXEMPLO.md"
};

function read(path) {
  return readFileSync(resolve(root, path), "utf8").replace(/^\uFEFF/, "");
}

function stripSqlComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function statements(sql) {
  return stripSqlComments(sql).split(";").map((item) => item.trim()).filter(Boolean);
}

function trackedAndUntrackedStatus() {
  return execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
}

test("artefatos fundamentais da demo existem", () => {
  for (const [name, path] of Object.entries(files)) {
    assert.equal(existsSync(resolve(root, path)), true, `${name}:${path}`);
  }
});

test("nenhum package script executa escrita ou live por padrao", () => {
  const pkg = JSON.parse(read(files.packageJson));
  const scripts = Object.entries(pkg.scripts || {}).filter(([name]) => name.startsWith("demo:"));
  assert.ok(scripts.length >= 10);
  for (const [name, script] of scripts) {
    assert.doesNotMatch(script, /--execute/i, `${name} nao deve usar --execute`);
    assert.doesNotMatch(script, /RUN_DEMO_LIVE_TESTS=true/i, `${name} nao deve habilitar live`);
    assert.doesNotMatch(script, /supabase\s|deploy/i, `${name} nao deve chamar supabase/deploy`);
  }
});

test("E2E e projeto proibido continuam bloqueados", () => {
  const text = [files.preflight, files.livePreflight, files.wizard, "backend/scripts/municipal-demo-lib.js"].map(read).join("\n");
  assert.match(text, /mplpzyalcxhhinuvjthx/);
  assert.match(text, /lidueokjpzxdybtongbk/);
  assert.match(text, /blocked_project_ref|BLOCKED_PROJECT_REFS/);
});

test("nenhum segredo real, JWT ou connection string esta versionado nos artefatos demo", () => {
  const audited = [
    files.bundle,
    files.seed,
    files.verification,
    files.cleanup,
    files.liveVerification,
    files.preflight,
    files.applySchema,
    files.applySeed,
    files.verifyCli,
    files.cleanupCli,
    files.wizard,
    files.runbook,
    files.operationDocs,
    files.checklistLive,
    files.readinessDocs,
    files.wizardDocs,
    files.exampleDocs
  ];
  for (const path of audited) {
    const text = read(path);
    assert.doesNotMatch(text, jwtRe, path);
    assert.doesNotMatch(text, /postgres:\/\/[^\s`]+/i, path);
    assert.doesNotMatch(text, secretAssignmentRe, path);
  }
});

test("documentacao nao expoe UUID completo", () => {
  const docs = [
    files.operationDocs,
    files.checklistLive,
    files.readinessDocs,
    files.stressDocs,
    files.wizardDocs,
    files.exampleDocs,
    "docs/RUNBOOK-DEMO-MUNICIPAL-GERADO.example.md"
  ];
  for (const path of docs) {
    assert.doesNotMatch(read(path), uuidRe, path);
  }
});

test("artifacts continua ignorado", () => {
  assert.match(read(".gitignore"), /^artifacts\/$/m);
});

test("bundle seed verification e cleanup passam regras estruturais basicas", () => {
  assert.match(read(files.bundle), /create\s+table\s+if\s+not\s+exists/i);
  assert.match(read(files.bundle), /enable\s+row\s+level\s+security/i);
  assert.match(read(files.seed), /DEMO_MUNICIPAL_/);
  assert.match(read(files.verification), /select|with/i);
  assert.match(read(files.cleanup), /DEMO_MUNICIPAL_/);
});

test("verification e live verification sao read-only", () => {
  for (const path of [files.verification, files.liveVerification]) {
    for (const statement of statements(read(path))) {
      assert.match(statement, /^(select|with)\b/i, `${path}: ${statement.slice(0, 80)}`);
    }
    assert.doesNotMatch(stripSqlComments(read(path)), /\b(insert|update|delete|drop|truncate|alter|create)\b/i, path);
  }
});

test("cleanup e manual e filtrado", () => {
  const sql = stripSqlComments(read(files.cleanup));
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|auth\.users/i);
  const deletes = statements(sql).filter((item) => /^delete\s+from\b/i.test(item));
  assert.ok(deletes.length >= 8);
  for (const statement of deletes) {
    assert.match(statement, /\bwhere\b/i);
    assert.match(statement, /DEMO_MUNICIPAL_/i);
  }
});

test("wizard nao acessa rede nem cria .env real", () => {
  const text = read(files.wizard);
  assert.doesNotMatch(text, /\bfetch\s*\(|node:https|node:http|createClient|SupabaseClient/i);
  assert.match(text, /network_opened:\s*false/);
  assert.match(text, /supabase_accessed:\s*false/);
  assert.match(text, /sql_executed:\s*false/);
  assert.doesNotMatch(text, /DEFAULT_ENV_OUTPUT\s*=\s*"\.env"/);
});

test("dry-run permanece sem conexao real", () => {
  const text = [files.preflight, files.applySchema, files.applySeed, files.verifyCli, files.cleanupCli, "backend/tests/municipal-demo-dry-run.test.js"].map(read).join("\n");
  assert.match(text, /dry[_-]?run/i);
  assert.match(text, /automatic_sql_execution_not_configured|nao executam SQL|database_connected, false/);
});

test("stress cobre isolamento concorrencia seguranca e offline", () => {
  const stress = [files.stressTotal, files.stressConcurrency, files.stressSecurity, files.chaosStress, files.stressDocs].map(read).join("\n");
  for (const term of ["tenant", "isolamento", "concurrency", "concorr", "offline", "SQL injection", "XSS", "prototype", "logout", "operation_id", "deduplication_key"]) {
    assert.match(stress, new RegExp(term, "i"), term);
  }
});

test("homologacao live fica bloqueada sem flag", () => {
  const live = [files.livePreflight, files.liveRls, files.liveConcurrency].map(read).join("\n");
  assert.match(live, /RUN_DEMO_LIVE_TESTS/);
  assert.match(live, /blocked_without_RUN_DEMO_LIVE_TESTS|esta etapa nao deve executar live/);
});

test("WhatsApp e email ficam desligados", () => {
  const text = [files.preflight, files.wizard, files.operationDocs, files.checklistLive, "backend/.env.demo.local.example"].map(read).join("\n");
  assert.match(text, /MUNICIPAL_WHATSAPP_ENABLED=false/);
  assert.match(text, /MUNICIPAL_EMAIL_ENABLED=false/);
});

test("ausencia de IA nao derruba validacao", () => {
  const text = ["backend/tests/municipal-demo-dry-run.test.js", "backend/src/municipal-demo-config.js"].map(read).join("\n");
  assert.match(text, /ausencia de IA nao falha|ai_optional|warning/i);
});

test("esta etapa nao altera codigo funcional", () => {
  const allowed = new Set([
    " M backend/tests/municipal-demo-final-readiness.test.js",
    "M backend/tests/municipal-demo-final-readiness.test.js",
    "?? backend/tests/municipal-demo-final-readiness.test.js",
    "?? backend/tests/municipal-demo-repeatability.test.js",
    "?? docs/RELATORIO-FINAL-PRONTIDAO-DEMO-MUNICIPAL.md",
    "?? docs/RELATORIO-ETAPA-56-PREFLIGHT-10X.md"
  ]);
  const status = trackedAndUntrackedStatus();
  for (const line of status) {
    assert.ok(allowed.has(line), `mudanca fora do escopo: ${line}`);
  }
});

test("documentacao nao afirma que demo real ja existe", () => {
  const docs = [files.operationDocs, files.checklistLive, files.readinessDocs, files.wizardDocs, files.exampleDocs].map(read).join("\n");
  assert.doesNotMatch(docs, /demo real (criada|existe|provisionada|implantada)|banco real criado|deploy realizado/i);
});
