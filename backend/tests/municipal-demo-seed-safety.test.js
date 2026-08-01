import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = resolve(".");
const seed = readFileSync(resolve(root, "backend/src/data/municipal-demo-seed.sql"), "utf8");

function stripComments(sql) {
  return sql.replace(/--.*$/gm, "");
}

test("seed exige placeholders reais e nao cria usuarios Auth", () => {
  for (const placeholder of [
    "DEMO_PLATFORM_ADMIN_USER_ID",
    "DEMO_MUNICIPAL_ADMIN_USER_ID",
    "DEMO_GESTOR_USER_ID",
    "DEMO_LEITURA_USER_ID"
  ]) {
    assert.match(seed, new RegExp(placeholder, "g"));
  }
  assert.match(seed, /raise\s+exception/i);
  assert.doesNotMatch(seed, /auth\.users|create\s+user|sign_up|invite_user/i);
});

test("seed usa somente dados ficticios com prefixo DEMO_MUNICIPAL_", () => {
  for (const term of [
    "Prefeitura Municipal Demonstrativa",
    "Almoxarifado Central Demonstrativo",
    "Secretaria de Saude Demonstrativa",
    "Secretaria de Educacao Demonstrativa",
    "Luvas",
    "Papel A4",
    "Lampadas",
    "Material de Limpeza",
    "Tubos",
    "Conexoes",
    "Ferramentas",
    "Computador",
    "Impressora",
    "Cadeira",
    "Mesa",
    "Ar Condicionado",
    "Veiculo Administrativo Ficticio"
  ]) {
    assert.match(seed, new RegExp(`DEMO_MUNICIPAL_[^'\\n]*${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i"));
  }
});

test("seed cobre estoque, patrimonio, acervo, sentinela e notificacoes in_app", () => {
  for (const table of [
    "institutions",
    "units",
    "profiles",
    "stock_items",
    "stock_entries",
    "stock_exits",
    "municipal_assets",
    "municipal_asset_history",
    "municipal_documents",
    "municipal_document_versions",
    "municipal_admin_audit_log",
    "municipal_notifications"
  ]) {
    assert.match(seed, new RegExp(`insert\\s+into\\s+public\\.${table}`, "i"));
  }
  assert.match(seed, /sentinel_scan_executed|sentinel_alert_acknowledged|sentinel_alert_resolved/i);
  assert.match(seed, /'in_app'/i);
  assert.doesNotMatch(seed, /'email'|'whatsapp'/i);
});

test("seed nao contem dados pessoais, projetos reais ou credenciais", () => {
  assert.doesNotMatch(seed, /@/);
  assert.doesNotMatch(seed, /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b|\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
  assert.doesNotMatch(seed, /telefone|whatsapp|celular|cpf|cnpj/i);
  assert.doesNotMatch(seed, /mplpzyalcxhhinuvjthx|lidueokjpzxdybtongbk/i);
  assert.doesNotMatch(seed, /eyJ[A-Za-z0-9_-]{20,}\./);
  assert.doesNotMatch(seed, /(api[_-]?key|service_role|password|token)\s*[:=]\s*['"][A-Za-z0-9_.-]{12,}/i);
});

test("seed controla idempotencia, tombamento, operation_id e deduplicacao", () => {
  const sql = stripComments(seed);
  assert.match(sql, /where\s+not\s+exists/i);
  assert.match(sql, /asset_tag/i);
  assert.match(sql, /deduplication_key/i);
  assert.match(sql, /DEMO_MUNICIPAL_notification_low_stock/i);
  assert.match(sql, /metadata/i);
});
