import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const BUNDLE = "backend/src/data/municipal-e2e-homologation.sql";
const VERIFY = "backend/src/data/municipal-e2e-verification.sql";
const FORBIDDEN_PROJECT_REF = "lidueokjpzxdybtongbk";
const DESTRUCTIVE = [
  /\bdrop\b/i,
  /\btruncate\b/i,
  /\bdelete\s+from\b/i,
  /\balter\s+table\b[\s\S]*?\bdrop\b/i
];
const DATA_WRITES = [/\binsert\s+into\b/i, /\bupdate\s+[\w."`]+\s+set\b/i, /\bdelete\s+from\b/i];
const CREDENTIALS = [
  /supabase_(anon|service_role)_key\s*=/i,
  /\b(service[_-]?key|api[_-]?key|password|senha|token)\s*[:=]\s*['"]?[A-Za-z0-9_.-]{12,}/i,
  /\bbearer\s+[A-Za-z0-9_.-]{12,}/i,
  /https:\/\/[a-z0-9-]+\.supabase\.co/i
];

function read(path) {
  return readFileSync(path, "utf8");
}

function withoutComments(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*--/.test(line))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
}

test("bundle contem os dois modulos na ordem esperada", () => {
  const sql = read(BUNDLE);
  const assetStart = sql.indexOf("-- BEGIN MODULE: municipal-asset-schema.sql");
  const notificationStart = sql.indexOf("-- BEGIN MODULE: municipal-notification-schema.sql");
  assert.ok(assetStart >= 0, "bundle deve conter modulo de patrimonio");
  assert.ok(notificationStart > assetStart, "notificacoes devem vir depois de patrimonio");
  assert.ok(sql.includes("-- END MODULE: municipal-asset-schema.sql"));
  assert.ok(sql.includes("-- END MODULE: municipal-notification-schema.sql"));
});

test("bundle nao contem comandos destrutivos nem escrita de dados", () => {
  const sql = withoutComments(read(BUNDLE));
  for (const pattern of DESTRUCTIVE.concat(DATA_WRITES)) {
    assert.equal(pattern.test(sql), false, `bundle contem padrao proibido ${pattern}`);
  }
});

test("bundle nao contem project_id, credenciais, URLs Supabase ou projeto proibido", () => {
  const sql = read(BUNDLE);
  assert.equal(sql.includes(FORBIDDEN_PROJECT_REF), false, "projeto proibido nao pode aparecer");
  assert.equal(/\bproject_id\b/i.test(sql), false, "project_id nao pode aparecer");
  for (const pattern of CREDENTIALS) {
    assert.equal(pattern.test(sql), false, `bundle parece conter credencial ou URL ${pattern}`);
  }
});

test("bundle mantem RLS e policies esperadas", () => {
  const sql = read(BUNDLE);
  assert.match(sql, /alter\s+table\s+public\.municipal_assets\s+enable\s+row\s+level\s+security/i);
  assert.match(sql, /alter\s+table\s+public\.municipal_asset_history\s+enable\s+row\s+level\s+security/i);
  assert.match(sql, /alter\s+table\s+public\.municipal_notifications\s+enable\s+row\s+level\s+security/i);
  for (const policy of [
    "municipal_assets_select_scoped",
    "municipal_assets_write_admin_scoped",
    "municipal_asset_history_select_scoped",
    "municipal_asset_history_write_admin_scoped",
    "municipal_notifications_select_scoped",
    "municipal_notifications_service_all"
  ]) {
    assert.ok(sql.includes(policy), `policy ausente: ${policy}`);
  }
});

test("bundle preserva construcao idempotente", () => {
  const sql = read(BUNDLE);
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.municipal_assets/i);
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.municipal_asset_history/i);
  assert.match(sql, /create\s+table\s+if\s+not\s+exists\s+public\.municipal_notifications/i);
  assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+municipal_assets_institution_unit_idx/i);
  assert.match(sql, /create\s+index\s+if\s+not\s+exists\s+municipal_notifications_institution_idx/i);
  assert.match(sql, /pg_policies/i);
});

test("verification.sql contem apenas SELECT, WITH e comentarios", () => {
  const sql = withoutComments(read(VERIFY));
  const statements = sql.split(";").map((item) => item.trim()).filter(Boolean);
  assert.ok(statements.length > 0, "verification deve conter consultas");
  for (const statement of statements) {
    assert.match(statement, /^(select|with)\b/i, `statement nao permitido: ${statement.slice(0, 80)}`);
    assert.equal(/\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|call|do)\b/i.test(statement), false, `verification contem comando proibido: ${statement.slice(0, 80)}`);
  }
});

test("verification.sql cobre tabelas, RLS, policies, indices e inconsistencias", () => {
  const sql = read(VERIFY);
  for (const expected of [
    "information_schema.tables",
    "information_schema.columns",
    "pg_policies",
    "pg_indexes",
    "relrowsecurity",
    "municipal_assets_tag_per_institution_unique",
    "records_without_institution_id",
    "records_with_invalid_unit_id",
    "duplicate_count",
    "municipal_notifications"
  ]) {
    assert.ok(sql.includes(expected), `verification sem ${expected}`);
  }
  assert.equal(sql.includes(FORBIDDEN_PROJECT_REF), false, "verification nao pode citar projeto proibido");
});
test("bundle preserva equivalencia estrutural dos schemas de origem", () => {
  const bundle = read(BUNDLE);
  const asset = read("backend/src/data/municipal-asset-schema.sql").trim();
  const notification = read("backend/src/data/municipal-notification-schema.sql").trim();
  assert.ok(bundle.includes(asset), "bundle deve conter municipal-asset-schema.sql sem remover FKs ou constraints");
  assert.ok(bundle.includes(notification), "bundle deve conter municipal-notification-schema.sql sem alteracoes estruturais");
  assert.match(bundle, /on\s+delete\s+restrict/i, "bundle deve preservar ON DELETE RESTRICT");
  assert.match(bundle, /on\s+delete\s+cascade/i, "bundle deve preservar ON DELETE CASCADE");
});
test("verification.sql valida constraints de notificacoes por nomes exatos", () => {
  const sql = read(VERIFY);
  const blocks = sql.match(/select\s+tc\.table_name[\s\S]*?from\s+information_schema\.table_constraints\s+tc[\s\S]*?;/gi) || [];
  const block = blocks.find((item) => item.includes("municipal_notifications_channel_check") && item.includes("municipal_notifications_status_check")) || "";
  assert.ok(block, "verification deve consultar constraints channel/status por nome exato");
  assert.equal(/\bcc\.table_name\b/i.test(block), false, "check_constraints nao possui cc.table_name");
  assert.equal(/constraint_table_usage/i.test(block), false, "usar table_constraints tc em vez de constraint_table_usage nesse bloco");
  assert.match(block, /join\s+information_schema\.check_constraints\s+cc/i);
  assert.match(block, /cc\.constraint_schema\s*=\s*tc\.constraint_schema/i);
  assert.match(block, /cc\.constraint_name\s*=\s*tc\.constraint_name/i);
  assert.match(block, /tc\.table_schema\s*=\s*'public'/i);
  assert.match(block, /tc\.table_name\s*=\s*'municipal_notifications'/i);
  assert.match(block, /tc\.constraint_name\s+in\s*\(/i);
  assert.match(block, /municipal_notifications_channel_check/i);
  assert.match(block, /municipal_notifications_status_check/i);
});
