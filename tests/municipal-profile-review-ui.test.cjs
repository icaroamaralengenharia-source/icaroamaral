const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const ui = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.js", "utf8");
const css = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.css", "utf8");

test("municipal import review UI exposes the review tab and import header", () => {
  assert.match(ui, /tabButton\("profile-imports","Importacoes",canUseProfileImports\(\)\)/);
  assert.match(ui, /function renderProfileImportReviewView\(\)/);
  assert.match(ui, /Revisao de importacao/);
  assert.match(ui, /original_filename/);
  assert.match(ui, /Versao draft/);
  assert.match(ui, /municipal-profile-imports\/"\+encodeURIComponent/);
});

test("municipal import review UI includes required row decisions and confidence filters", () => {
  for (const label of ["HIGH", "MEDIUM", "LOW", "UNMATCHED"]) {
    assert.match(ui, new RegExp(label));
  }
  for (const label of ["Confirmar", "Corrigir item", "Corrigir valor", "Ignorar"]) {
    assert.match(ui, new RegExp(label));
  }
  assert.match(ui, /Confirmar todos HIGH validos/);
  assert.match(ui, /profileDuplicateCodes/);
  assert.match(ui, /Duplicidade bloqueante/);
  assert.match(ui, /Buscar no catalogo/);
  assert.match(ui, /Valor revisado/);
});

test("municipal import review UI saves review to draft endpoint and is mobile styled", () => {
  assert.match(ui, /method:"PUT"/);
  assert.match(ui, /\/review"/);
  assert.match(ui, /Versao ativa preservada/);
  assert.match(css, /\.ma-import-review/);
  assert.match(css, /\.ma-import-row\.is-high/);
  assert.match(css, /\.ma-import-row\.is-medium/);
  assert.match(css, /\.ma-import-row\.is-low/);
  assert.match(css, /\.ma-import-row\.is-unmatched/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
