import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";
import {
  buildApartmentHandoverInspectionHtml,
  buildPendingItemsConclusionSentence,
  generateApartmentHandoverInspectionPdf,
  normalizeApartmentHandoverInspectionPayload
} from "../src/apartment-handover-pdf.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..", "..");
const tmpDir = join(repoRoot, "tmp", "apartment-handover-pdf");
const finalFixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-corrected.json");
const draftFixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-draft.json");
const finalPdfPath = join(tmpDir, "apartment-handover-final.pdf");
const draftPdfPath = join(tmpDir, "apartment-handover-draft.pdf");
const finalHtmlPath = join(tmpDir, "apartment-handover-final.html");
const draftHtmlPath = join(tmpDir, "apartment-handover-draft.html");

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function pageCount(path) {
  const content = readFileSync(path, "latin1");
  return (content.match(/\/Type\s*\/Page\b/g) || []).length;
}

function assertPdf(path) {
  assert.ok(existsSync(path), path);
  assert.equal(readFileSync(path).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(statSync(path).size > 30_000, "PDF deve ter conteudo real");
  assert.ok(pageCount(path) >= 4, "PDF deve conter multiplas paginas reais");
}

async function extractPdfText(path) {
  const parser = new PDFParse({ data: readFileSync(path) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}


test("pluralizacao da conclusao cobre pendencias NV e NI", () => {
  assert.equal(buildPendingItemsConclusionSentence({ NV: 1, NI: 1 }), "Permanecem 1 item Nao Verificado e 1 item Nao Inspecionado, que devem ser revisados pelo responsavel tecnico antes do encerramento definitivo.");
  assert.equal(buildPendingItemsConclusionSentence({ NV: 2, NI: 1 }), "Permanecem 2 itens Nao Verificados e 1 item Nao Inspecionado, que devem ser revisados pelo responsavel tecnico antes do encerramento definitivo.");
  assert.equal(buildPendingItemsConclusionSentence({ NV: 1, NI: 0 }), "Permanece 1 item Nao Verificado, que deve ser revisado pelo responsavel tecnico antes do encerramento definitivo.");
  assert.equal(buildPendingItemsConclusionSentence({ NV: 0, NI: 1 }), "Permanece 1 item Nao Inspecionado, que deve ser revisado pelo responsavel tecnico antes do encerramento definitivo.");
  assert.equal(buildPendingItemsConclusionSentence({ NV: 0, NI: 0 }), "");
});
test("gerador independente cria PDFs final e rascunho com fixture de 144 itens", async () => {
  mkdirSync(tmpDir, { recursive: true });
  const finalPayload = readJson(finalFixturePath);
  const draftPayload = readJson(draftFixturePath);

  const normalized = normalizeApartmentHandoverInspectionPayload(finalPayload);
  assert.equal(normalized.items.length, 144);
  assert.deepEqual(normalized.counts, { C: 138, NC: 3, NA: 1, NV: 1, NI: 1 });
  assert.equal(normalized.nonConformities.length, 3);
  assert.equal(normalized.nonConformities[2].fotos.length, 5);
  assert.equal(normalized.percent, 99.3);

  const finalHtml = buildApartmentHandoverInspectionHtml(finalPayload);
  const draftHtml = buildApartmentHandoverInspectionHtml(draftPayload);
  for (const expected of [
    "LAUDO DE VISTORIA DE ENTREGA",
    "Identificacao",
    "Objeto",
    "Metodologia",
    "Legenda",
    "Resumo executivo",
    "Resumo por ambiente",
    "Checklist completo",
    "Nao conformidades",
    "Fotografias",
    "Medicoes e verificacoes",
    "Instrumentos",
    "NV / NI",
    "Plano de correcoes",
    "Conclusao",
    "Re-vistoria",
    "Responsabilidade tecnica",
    "Assinatura"
  ]) {
    assert.match(finalHtml, new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
  assert.doesNotMatch(finalHtml, /RASCUNHO - NAO FINALIZADO/);
  assert.match(draftHtml, /RASCUNHO - NAO FINALIZADO/);
  assert.equal((finalHtml.match(/<figure>/g) || []).length, 8);
  assert.match(finalHtml, /NC-003[\s\S]*foto sintetica 5/);
  assert.match(finalHtml, /DOCUMENTO FINAL/);
  assert.doesNotMatch(finalHtml, /Com base na amostra vistoriada/i);
  assert.match(finalHtml, /Com base nos itens efetivamente inspecionados/i);
  assert.match(finalHtml, /<th>NC<\/th><th>Ambiente<\/th><th>Severidade<\/th><th>Recomendacao<\/th><th>Situacao<\/th>/);

  await generateApartmentHandoverInspectionPdf(finalPayload, finalPdfPath, { htmlPath: finalHtmlPath, mode: "final" });
  await generateApartmentHandoverInspectionPdf(draftPayload, draftPdfPath, { htmlPath: draftHtmlPath });

  assertPdf(finalPdfPath);
  assertPdf(draftPdfPath);

  const finalText = await extractPdfText(finalPdfPath);
  const draftText = await extractPdfText(draftPdfPath);
  assert.match(finalText, /LAUDO DE VISTORIA/i);
  assert.match(finalText, /144/);
  assert.match(finalText, /NC/);
  assert.match(finalText, /Nao Conforme/i);
  assert.match(finalText, /Nao Verificado/i);
  assert.match(finalText, /Nao Inspecionado/i);
  assert.match(finalText, /ObraReport/i);
  assert.match(finalText, /Pagina\s+1\s+de\s+\d+/i);
  assert.match(finalText, /Com base nos itens efetivamente inspecionados/i);
  assert.match(finalText, /Permanecem 1 item Nao Verificado e 1 item Nao Inspecionado/i);
  assert.doesNotMatch(finalText, /1 itens/i);
  assert.doesNotMatch(finalText, /Com base na amostra vistoriada/i);
  assert.doesNotMatch(finalText, /RASCUNHO - NAO FINALIZADO/i);
  assert.match(draftText, /RASCUNHO - NAO FINALIZADO/i);
});

test("gerador permite draft com blocker e recusa final bloqueado pelo preflight", async () => {
  mkdirSync(tmpDir, { recursive: true });
  const payload = readJson(finalFixturePath);
  payload.report.inspection.items[0].descricaoTecnica = "";

  const blocked = await generateApartmentHandoverInspectionPdf(payload, join(tmpDir, "apartment-handover-blocked.pdf"), { mode: "final" });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "INSPECTION_PREFLIGHT_BLOCKED");
  assert.equal(blocked.review.canGenerateFinal, false);

  const draftPayload = readJson(draftFixturePath);
  draftPayload.report.inspection.items[0].descricaoTecnica = "";
  const draft = await generateApartmentHandoverInspectionPdf(draftPayload, join(tmpDir, "apartment-handover-draft-with-blocker.pdf"));
  assert.equal(draft.ok, true);
  assertPdf(join(tmpDir, "apartment-handover-draft-with-blocker.pdf"));
});
