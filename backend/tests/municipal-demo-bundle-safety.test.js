import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(".");
const bundlePath = "backend/src/data/municipal-demo-schema-bundle.sql";
const verificationPath = "backend/src/data/municipal-demo-verification.sql";
const cleanupPath = "backend/src/data/municipal-demo-cleanup.sql";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function stripComments(sql) {
  return sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function statements(sql) {
  return stripComments(sql).split(";").map((item) => item.trim()).filter(Boolean);
}

function assertNoDangerousSql(sql) {
  const text = stripComments(sql);
  assert.doesNotMatch(text, /\bdrop\b/i);
  assert.doesNotMatch(text, /\btruncate\b/i);
  assert.doesNotMatch(text, /\bdelete\s+from\b/i);
  assert.doesNotMatch(text, /\balter\s+table\b[\s\S]{0,120}\bdrop\b/i);
  assert.doesNotMatch(text, /\bupdate\b[\s\S]{0,80}\bset\b/i);
  assert.doesNotMatch(text, /\binsert\s+into\b/i);
}

test("bundle contem todos os modulos municipais em ordem segura", () => {
  const sql = read(bundlePath);
  const modules = [
    "municipal-admin-schema.sql",
    "municipal-operational-stock-schema.sql",
    "municipal-document-schema.sql",
    "municipal-asset-schema.sql",
    "municipal-notification-schema.sql",
    "municipal-sentinel-audit-contract"
  ];
  let previous = -1;
  for (const module of modules) {
    const begin = sql.indexOf(`-- BEGIN MODULE: ${module}`);
    const end = sql.indexOf(`-- END MODULE: ${module}`);
    assert.ok(begin > previous, `${module} deve aparecer na ordem esperada`);
    assert.ok(end > begin, `${module} deve ter marcador de fim`);
    previous = begin;
  }
});

test("bundle e aditivo, idempotente e sem comandos destrutivos", () => {
  const sql = read(bundlePath);
  assertNoDangerousSql(sql);
  for (const table of [
    "institutions",
    "units",
    "profiles",
    "municipal_admin_audit_log",
    "stock_items",
    "stock_entries",
    "stock_exits",
    "stock_audit_log",
    "municipal_documents",
    "municipal_document_versions",
    "municipal_assets",
    "municipal_asset_history",
    "municipal_notifications"
  ]) {
    assert.match(sql, new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}`, "i"));
  }
  assert.match(sql, /create\s+index\s+if\s+not\s+exists/i);
  assert.match(sql, /if\s+not\s+exists[\s\S]+create\s+policy/i);
});

test("bundle preserva contratos estruturais essenciais dos schemas de origem", () => {
  const sql = read(bundlePath);
  for (const term of [
    "municipal_assets_tag_per_institution_unique",
    "on delete cascade",
    "on delete restrict",
    "on delete set null",
    "municipal_notifications_dedup_unique",
    "municipal_documents_tenant_select",
    "municipal_asset_history_write_admin_scoped",
    "municipal_notifications_service_all"
  ]) {
    assert.match(sql, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});


test("bloco de estoque demo e compativel com schema e backend reais", () => {
  const sql = read(bundlePath);
  const stockBlock = sql.slice(
    sql.indexOf("-- BEGIN MODULE: municipal-operational-stock-schema.sql"),
    sql.indexOf("-- END MODULE: municipal-operational-stock-schema.sql")
  );
  for (const term of [
    "create table if not exists public.stock_items",
    "create table if not exists public.stock_entries",
    "create table if not exists public.stock_exits",
    "create table if not exists public.stock_audit_log",
    "minimum_quantity numeric(14, 3) not null default 0 check (minimum_quantity >= 0)",
    "quantity numeric(14, 3) not null check (quantity > 0)",
    "status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada'))",
    "requested_by uuid references public.profiles(id) on delete set null",
    "approved_by uuid references public.profiles(id) on delete set null",
    "created_by uuid references public.profiles(id) on delete set null",
    "profile_id uuid references public.profiles(id) on delete set null",
    "idx_stock_entries_status"
  ]) {
    assert.match(stockBlock, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  const stockItemsTable = stockBlock.slice(stockBlock.indexOf("create table if not exists public.stock_items"), stockBlock.indexOf("create table if not exists public.stock_entries"));
  assert.doesNotMatch(stockItemsTable, /status\s+text\s+not\s+null\s+default\s+'active'/i);
  assert.doesNotMatch(stockItemsTable, /created_by\s+uuid/i);
  assert.doesNotMatch(stockBlock, /'approved'|'rejected'/i);
});
test("bundle ativa RLS e isola por institution_id e unit_id", () => {
  const sql = read(bundlePath);
  for (const table of [
    "institutions",
    "units",
    "profiles",
    "municipal_admin_audit_log",
    "stock_items",
    "stock_entries",
    "stock_exits",
    "stock_audit_log",
    "municipal_documents",
    "municipal_document_versions",
    "municipal_assets",
    "municipal_asset_history",
    "municipal_notifications"
  ]) {
    assert.match(sql, new RegExp(`alter\\s+table\\s+public\\.${table}\\s+enable\\s+row\\s+level\\s+security`, "i"));
  }
  assert.match(sql, /institution_id/i);
  assert.match(sql, /unit_id/i);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
});

test("bundle nao contem credenciais, URLs, project refs ou project_id", () => {
  const sql = read(bundlePath);
  assert.doesNotMatch(sql, /https?:\/\//i);
  assert.doesNotMatch(sql, /project_id/i);
  assert.doesNotMatch(sql, /mplpzyalcxhhinuvjthx|lidueokjpzxdybtongbk/i);
  assert.doesNotMatch(sql, /eyJ[A-Za-z0-9_-]{20,}\./);
  assert.doesNotMatch(sql, /(api[_-]?key|service_role|password|token)\s*[:=]\s*['"][A-Za-z0-9_.-]{12,}/i);
});

test("verification e estritamente read-only", () => {
  const sql = read(verificationPath);
  for (const statement of statements(sql)) {
    assert.match(statement, /^(select|with)\b/i, `statement nao read-only: ${statement.slice(0, 80)}`);
  }
  assert.doesNotMatch(stripComments(sql), /\b(insert|update|delete|drop|truncate|alter|create)\b/i);
  assert.match(sql, /tombamentos duplicados|asset_tag/i);
  assert.match(sql, /deduplication_key/i);
});

test("cleanup e manual, filtrado pelo prefixo demo e nao destrutivo de schema", () => {
  const sql = read(cleanupPath);
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b|auth\.users/i);
  const deletes = statements(sql).filter((item) => /^delete\s+from\b/i.test(item));
  assert.ok(deletes.length >= 8);
  for (const statement of deletes) {
    assert.match(statement, /where/i, "delete precisa ter filtro");
    assert.match(statement, /DEMO_MUNICIPAL_/i, "delete precisa filtrar pelo prefixo demo");
  }
});