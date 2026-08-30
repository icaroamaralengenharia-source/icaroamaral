const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const ui = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.js", "utf8");
const css = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.css", "utf8");

test("municipal profile diff UI renders entry point, summary and endpoint", () => {
  assert.match(ui, /Ver alteracoes/);
  assert.match(ui, /function loadProfileDiffForImport\(\)/);
  assert.match(ui, /\/municipal-profiles\/"\+encodeURIComponent\(profileId\)\+"\/diff/);
  assert.match(ui, /Alteracoes entre versoes/);
  for (const label of ["Antes", "Depois", "Alterados", "Novos", "Removidos", "Fonte"]) {
    assert.match(ui, new RegExp(label));
  }
});

test("municipal profile diff UI renders changed, added, removed and collapsed unchanged filter", () => {
  for (const status of ["CHANGED", "ADDED", "REMOVED", "UNCHANGED"]) {
    assert.match(ui, new RegExp(status));
  }
  for (const filter of ["Todos", "Alterados", "Novos", "Removidos", "Fonte alterada", "Tipo alterado", "Sem alteracao"]) {
    assert.match(ui, new RegExp(filter));
  }
  assert.match(ui, /S\.profileDiffFilter=S\.profileDiffFilter\|\|"changed"/);
});

test("municipal profile diff UI shows before after values and old new source on mobile cards", () => {
  assert.match(ui, /oldNormalizedValue/);
  assert.match(ui, /newNormalizedValue/);
  assert.match(ui, /oldRawValue/);
  assert.match(ui, /newRawValue/);
  assert.match(ui, /oldSource/);
  assert.match(ui, /newSource/);
  assert.match(css, /\.ma-diff-before-after/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /\.ma-diff-row\.is-changed/);
  assert.match(css, /\.ma-diff-row\.is-added/);
  assert.match(css, /\.ma-diff-row\.is-removed/);
});
