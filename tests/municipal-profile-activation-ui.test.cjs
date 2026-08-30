const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");

const ui = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.js", "utf8");
const css = readFileSync("relatorio-qualidade-obras/municipal-admin-ui.css", "utf8");

test("municipal profile activation UI exposes controlled action and endpoint", () => {
  assert.match(ui, /ATIVAR NOVA VERSAO/);
  assert.match(ui, /openProfileActivationModal/);
  assert.match(ui, /activateProfileVersion/);
  assert.match(ui, /\/municipal-profiles\/"\+encodeURIComponent\(profileId\)\+"\/activate/);
  assert.match(ui, /method:"PUT"/);
  assert.match(ui, /confirmation:true/);
  assert.match(ui, /versionId:versionId/);
});

test("municipal profile activation modal renders explicit summary, date, cancel and confirm", () => {
  assert.match(ui, /function renderProfileActivationModal\(\)/);
  assert.match(ui, /role","dialog"/);
  assert.match(ui, /aria-modal","true"/);
  assert.match(ui, /Esta versao passara a ser a versao oficial utilizada pelo sistema para este municipio/);
  for (const label of ["Cidade", "UF", "Versao atual", "Nova versao", "Alterados", "Novos", "Removidos", "Data de vigencia", "Cancelar", "Ativar nova versao"]) {
    assert.match(ui, new RegExp(label));
  }
});

test("municipal profile activation UI handles loading, success, errors and mobile modal", () => {
  assert.match(ui, /profileActivationLoading/);
  assert.match(ui, /profileActivationError/);
  assert.match(ui, /Versao ativada com sucesso/);
  assert.match(ui, /Falha ao ativar nova versao/);
  assert.match(css, /\.ma-modal-backdrop/);
  assert.match(css, /\.ma-activation-modal/);
  assert.match(css, /@media \(max-width: 620px\)/);
});
