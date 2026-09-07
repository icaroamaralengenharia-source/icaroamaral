const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "relatorio-qualidade-obras.html"), "utf8");
const css = fs.readFileSync(path.join(root, "relatorio-qualidade-obras.css"), "utf8");
const js = fs.readFileSync(path.join(root, "relatorio-qualidade-obras.js"), "utf8");

test("RDO keeps final real-test fixes wired in the page", () => {
  assert.match(html, /relatorio-qualidade-obras\.css\?v=20260906-rdo-final-real-test-bugs/);
  assert.match(html, /relatorio-qualidade-obras\.js\?v=20260906-rdo-final-real-test-bugs/);
  assert.match(html, /<option value="Escavação">Escavação<\/option>/);
  assert.match(html, /Item vinculado do almoxarifado/);
  assert.match(html, /Legenda padrão das fotos/);
  assert.match(html, /id="diaryToolsToggle"/);
  assert.match(html, /id="diarySidePanels"/);
});

test("RDO JS avoids stale or misleading production and stock text", () => {
  assert.match(js, /function cleanDailyLogServicesText_/);
  assert.match(js, /cleanDailyLogServicesText_\(logItem\.services\)/);
  assert.match(js, /const summary = buildDailyLogSummary_\(logItem\);/);
  assert.doesNotMatch(js, /buildDailyLogPdfTextSection_\("Resumo executivo", \[/);
  assert.match(js, /hasRegisteredConsumption/);
  assert.match(js, /Consumo real não informado/);
  assert.match(js, /formatPurchasePlanQuantity_/);
  assert.match(js, /Não consultável/);
});

test("RDO JS protects dynamic containers and supports per-photo captions", () => {
  assert.match(js, /if \(!fotosUnidadeContainer\) \{\s*return;\s*\}/);
  assert.match(js, /if \(!inconformidadesContainer\) \{\s*return;\s*\}/);
  assert.match(js, /if \(!isStockFullIsolatedApp_ && form\) \{/);
  assert.match(js, /if \(form\) form\.addEventListener\("submit", async function/);
  assert.match(js, /data-diary-photo-caption-id/);
  assert.match(js, /function updateDailyLogPhotoCaption_/);
  assert.match(js, /dailyLogSaveButton\.disabled = true/);
});

test("RDO CSS collapses side tools by default and stabilizes embedded ELO", () => {
  assert.match(css, /\.diary-tools-toggle/);
  assert.match(css, /body\.rdo-tools-open[\s\S]*\.diary-side-panels/);
  assert.match(css, /\.report-elo-chat \.elo-standalone-panel/);
  assert.match(css, /grid-template-rows: minmax\(220px, 1fr\) auto auto/);
  assert.match(css, /\.diary-photo-caption-field input/);
});
