const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync("relatorio-stelecom/index.html", "utf8");
const app = readFileSync("relatorio-stelecom/app.js", "utf8");
const css = readFileSync("relatorio-stelecom/styles.css", "utf8");
const templateCode = readFileSync("relatorio-stelecom/stelecom-template.js", "utf8");

function loadTemplate() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(templateCode, context);
  return context.StelecomTemplate;
}

test("relatorio STELECOM oferece as cinco cidades urgentes e mantém cidade digitável", () => {
  assert.match(html, /data-visit-city/);
  assert.match(html, /list="stelecom-city-options"/);
  for (const city of ["Belo Campo", "Tremedal", "Ibirapuã", "Ibicoara", "Malhada de Pedras"]) {
    assert.match(html, new RegExp(city));
  }
});

test("UI cria tabela SIM/NAO com autosave local e perfis independentes por relatório", () => {
  assert.match(html, /data-checklist-profile/);
  assert.match(app, /stelecomMunicipalProfiles/);
  assert.match(app, /cityKey\(state\.city\)/);
  assert.match(app, /reportKey\(\)/);
  assert.match(app, /checklistAnswers/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /Dados desta cidade salvos/);
  assert.match(app, /NÃO DEFINIDO/);
  assert.match(app, /data-answer="SIM"/);
  assert.match(app, /data-answer="NAO"/);
});

test("trocar cidade, SGTO/STELECOM e DT1B/PM1B preserva fotos e carrega apenas checklist", () => {
  assert.match(app, /nodes\.city\.addEventListener\("input"/);
  assert.match(app, /loadChecklistProfile\(\);\s*renderChecklist\(\);/);
  assert.match(app, /nodes\.reportType\.addEventListener\("change"/);
  assert.match(app, /state\.workType = template\.normalizeWorkType/);
  assert.doesNotMatch(app, /state\.cameras\s*=\s*\[\]/);
  assert.doesNotMatch(app, /state\.tomadas\s*=\s*\[\]/);
});

test("PDF usa exatamente SIM/NAO selecionado e não inventa resposta ausente", () => {
  const template = loadTemplate();
  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Belo Campo",
    workType: "DT1B",
    reportType: "STELECOM",
    checklistAnswers: { 1: "NAO", 2: "SIM" },
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "STELECOM");

  assert.match(report, /RELATORIO_STELECOM_BELO_CAMPO_DT1B_30-08-2026/);
  assert.match(report, /<td class="col-item">1<\/td>[\s\S]*?<td class="col-mark"><\/td>\s*<td class="col-mark">X<\/td>/);
  assert.match(report, /<td class="col-item">2<\/td>[\s\S]*?<td class="col-mark">X<\/td>\s*<td class="col-mark"><\/td>/);
  assert.match(report, /<td class="col-item">3<\/td>[\s\S]*?<td class="col-mark"><\/td>\s*<td class="col-mark"><\/td>/);
});

test("validação bloqueia PDF com campos obrigatórios não preenchidos", () => {
  assert.match(app, /missingChecklistItems\(\)/);
  assert.match(app, /Tabela incompleta/);
  assert.match(app, /Existem \$\{missing\.length\} campos da tabela ainda nao preenchidos/);
});

test("mobile usa cards e botões grandes, sem tabela horizontal para SIM/NAO", () => {
  assert.match(css, /\.checklist-answer-card/);
  assert.match(css, /\.choice-buttons/);
  assert.match(css, /\.choice-button/);
  assert.match(css, /min-height: 52px/);
  assert.match(css, /@media \(max-width: 720px\)/);
});
