import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appSource = fs.readFileSync(path.join(root, "stock-full-app.js"), "utf8");
const rlsSource = fs.readFileSync(path.join(root, "backend/src/data/stock-full-runtime-rls.sql"), "utf8");

test("Stock Full apresenta estoque geral como escopo válido sem obra", () => {
  assert.match(appSource, /Empresa\/loja \(sem obra\)/);
  assert.match(appSource, /Operação da empresa\/loja sem obra ativa\./);
});

test("Stock Full não expõe diagnóstico técnico no login", () => {
  assert.match(appSource, /Não foi possível entrar\. Verifique e-mail e senha\./);
  assert.doesNotMatch(appSource, /REQUEST URL:/);
  assert.doesNotMatch(appSource, /RESPONSE BODY:/);
  assert.doesNotMatch(appSource, /ERROR NAME:/);
});

test("RLS permite escopo tenant-level e preserva validação de obra", () => {
  assert.match(rlsSource, /stock_full_scope_allowed/);
  assert.match(rlsSource, /nullif\(btrim\(p_project_id\), ''\) is null/);
  assert.match(rlsSource, /or public\.stock_full_work_allowed\(p_project_id\)/);
  assert.doesNotMatch(rlsSource, /project_id is not null\s+and\s+public\.stock_full_work_allowed\(project_id\)/);
});
