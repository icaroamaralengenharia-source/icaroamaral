import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const ASSET_SCHEMA = "backend/src/data/municipal-asset-schema.sql";
const NOTIFICATION_SCHEMA = "backend/src/data/municipal-notification-schema.sql";
const SCHEMAS = [ASSET_SCHEMA, NOTIFICATION_SCHEMA];
const FORBIDDEN_PROJECT_REF = "lidueokjpzxdybtongbk";
const DANGEROUS_PATTERNS = [
  { name: "DROP", regex: /\bdrop\b/i },
  { name: "TRUNCATE", regex: /\btruncate\b/i },
  { name: "DELETE FROM", regex: /\bdelete\s+from\b/i },
  { name: "ALTER TABLE DROP", regex: /\balter\s+table\b[\s\S]*?\bdrop\b/i }
];
const CREDENTIAL_PATTERNS = [
  /supabase_(anon|service_role)_key\s*=/i,
  /\b(service[_-]?key|api[_-]?key|password|senha|token)\s*[:=]\s*['"]?[A-Za-z0-9_.-]{12,}/i,
  /\bbearer\s+[A-Za-z0-9_.-]{12,}/i
];

function readSchema(path) {
  return readFileSync(path, "utf8");
}

function normalized(path) {
  return readSchema(path).toLowerCase();
}

test("schemas municipais pendentes existem e sao auditados", () => {
  for (const path of SCHEMAS) {
    const sql = normalized(path);
    assert.ok(sql.includes("create table if not exists"), `${path} deve ser aditivo/idempotente`);
  }
});

test("schemas municipais nao contem comandos destrutivos", () => {
  for (const path of SCHEMAS) {
    const sql = readSchema(path);
    for (const pattern of DANGEROUS_PATTERNS) {
      assert.equal(pattern.regex.test(sql), false, `${path} contem ${pattern.name}`);
    }
  }
});

test("schemas municipais nao contem credenciais, project_id nem projeto proibido", () => {
  for (const path of SCHEMAS) {
    const sql = readSchema(path);
    assert.equal(sql.includes(FORBIDDEN_PROJECT_REF), false, `${path} referencia projeto proibido`);
    assert.equal(/\bproject_id\b/i.test(sql), false, `${path} nao deve usar project_id`);
    for (const pattern of CREDENTIAL_PATTERNS) {
      assert.equal(pattern.test(sql), false, `${path} parece conter credencial`);
    }
  }
});

test("schemas municipais preservam escopo por institution_id e unit_id", () => {
  for (const path of SCHEMAS) {
    const sql = readSchema(path);
    assert.match(sql, /\binstitution_id\b/i, `${path} precisa conter institution_id`);
    assert.match(sql, /\bunit_id\b/i, `${path} precisa conter unit_id`);
  }
});

test("schemas municipais ativam RLS", () => {
  for (const path of SCHEMAS) {
    const sql = readSchema(path);
    assert.match(sql, /alter\s+table\s+public\.[a-z_]+\s+enable\s+row\s+level\s+security/i, `${path} precisa ativar RLS`);
  }
});

test("schema de patrimonio cria policies RLS idempotentes", () => {
  const sql = readSchema(ASSET_SCHEMA);
  assert.match(sql, /pg_policies/i, "patrimonio deve verificar pg_policies para idempotencia");
  assert.match(sql, /create\s+policy\s+municipal_assets_select_scoped/i, "patrimonio precisa de policy SELECT de bens");
  assert.match(sql, /create\s+policy\s+municipal_assets_write_admin_scoped/i, "patrimonio precisa de policy de escrita de bens");
  assert.match(sql, /create\s+policy\s+municipal_asset_history_select_scoped/i, "historico precisa de policy SELECT");
  assert.match(sql, /create\s+policy\s+municipal_asset_history_write_admin_scoped/i, "historico precisa de policy de escrita");
});

test("policies de patrimonio restringem leitura e escrita por escopo municipal", () => {
  const sql = readSchema(ASSET_SCHEMA);
  assert.match(sql, /for\s+select[\s\S]*institution_id[\s\S]*unit_id/i, "SELECT deve usar institution_id e unit_id");
  assert.match(sql, /for\s+all[\s\S]*with\s+check[\s\S]*institution_id[\s\S]*unit_id/i, "escrita de bens deve validar institution_id e unit_id");
  assert.match(sql, /for\s+insert[\s\S]*with\s+check[\s\S]*institution_id[\s\S]*unit_id/i, "historico deve validar institution_id e unit_id");
  assert.match(sql, /'platform_admin',\s*'municipal_admin',\s*'gestor'/i, "escrita deve ficar restrita a papeis administrativos");
  assert.equal(/'leitura'[\s\S]*with\s+check/i.test(sql), false, "leitura nao pode aparecer em policy de escrita");
});
