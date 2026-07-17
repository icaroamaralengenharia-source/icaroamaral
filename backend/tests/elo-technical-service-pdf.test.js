import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { chromium } from "@playwright/test";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const artifactDir = resolve(repoDir, "artifacts");
const pdfPath = join(artifactDir, "elo-technical-service-quantitativos-v6.pdf");

function loadContext(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadTechnicalPdfContext() {
  return loadContext([
    "stock-ai-composition-engine.js",
    "bases-reais/sinapi-ba-202412-index.js",
    "composition-search-engine.js",
    "elo-consumption-engine.js",
    "elo-technical-service-bridge.js",
    "elo-technical-service-pdf.js"
  ]);
}

function loadRouterContext() {
  return loadContext(["elo-technical-service-router.js"]);
}

function buildResults(win) {
  return [
    "Quero fazer uma parede de bloco ceramico baiano com 30 metros de comprimento e 2,80 metros de altura. Qual material necessario?",
    "Escavacao manual de vala de 12 x 0,40 x 0,60 m",
    "Viga baldrame com 45 m, secao 20 x 30 cm",
    "Cobertura ceramica para uma casa de 8 x 12 m, inclinacao de 30%"
  ].map((text) => win.EloTechnicalServiceBridge.build({ text }));
}

function sectionBetween(html, start, end) {
  const startIndex = html.indexOf(start);
  assert.notEqual(startIndex, -1, start);
  const endIndex = html.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, end);
  return html.slice(startIndex, endIndex);
}

function countPdfPages(path) {
  const content = readFileSync(path, "latin1");
  return (content.match(/\/Type\s*\/Page\b/g) || []).length;
}

test("PDF v6 remove caminhos locais e reduz repeticao sem alterar totais", async () => {
  mkdirSync(artifactDir, { recursive: true });
  const win = loadTechnicalPdfContext();
  const results = buildResults(win);

  assert.equal(results.length, 4);
  assert.equal(results[0].quantity, 84);
  assert.equal(results[1].quantity, 2.88);
  assert.equal(results[2].quantity, 2.7);
  assert.equal(results[3].quantity, 100.224);
  assert.equal(results[0].materials.find((item) => item.code === "37592").quantity, 1142.4);
  assert.equal(results[3].materials.find((item) => item.code === "7175").quantity, 1778.876);
  assert.ok(results[2].assumptions.some((item) => /aco estrutural nao incluido|a.o estrutural n.o inclu.do/i.test(item)));
  assert.ok(results[3].pending.includes("cumeeira_length_missing"));
  assert.ok(results[3].pending.includes("loss_percent_not_informed"));
  assert.ok(results.every((result) => result.composition && result.composition.source === "SINAPI"));
  const block = results[0].materials.find((item) => item.code === "37592");
  assert.equal(block.unitPrice, 1.92);
  assert.equal(block.itemSubtotal, 2193.408);
  const unpriced = { code: "SEM-PRECO", name: "Sem preco", unit: "un", quantity: 1, coefficient: 1 };
  const isolatedUnpricedHtml = win.EloTechnicalServicePdf.buildHtmlDocument([Object.assign({}, results[0], {
    materials: results[0].materials.concat([unpriced]),
    labor: [],
    equipment: []
  })], { generatedAt: "2026-07-17T00:00:00.000Z" });
  const isolatedPricedItemsSection = sectionBetween(isolatedUnpricedHtml, "<h2>Itens precificados</h2>", "<h2>Materiais que ser\u00e3o utilizados</h2>");
  assert.doesNotMatch(isolatedPricedItemsSection, /SEM-PRECO|Sem preco/i);

  const html = win.EloTechnicalServicePdf.buildHtmlDocument(results, {
    generatedAt: "2026-07-17T00:00:00.000Z",
    identification: {
      displayName: "\u00cdcaro Amaral Engenharia",
      phone: "(77) 99999-9999",
      email: "contato@empresa.com"
    }
  });

  for (const expected of [
    /84,00 m\u00b2/,
    /2,70 m\u00b3/,
    /100,22 m\u00b2/,
    /1\.142,40 un/,
    /3,9558/,
    /R\$ 10\.740,00/,
    /Or\u00e7amento preliminar e quantitativos t\u00e9cnicos\./,
    /Base SINAPI \| BA \| 2024-12 \| Desonerado/,
    /Resumo executivo/,
    /Servi\u00e7os analisados:<\/strong> 4/,
    /Subtotal dos servi\u00e7os analisados/,
    /R\$ 17\.990,24/,
    /Servi\u00e7os com valor/,
    /<th>C\u00f3digo<\/th><th>Servi\u00e7o<\/th><th>Un\.<\/th><th>Quantidade<\/th><th>Pre\u00e7o unit\u00e1rio<\/th><th>Subtotal<\/th>/,
    /Itens precificados/,
    /<th>C\u00f3digo<\/th><th>Categoria<\/th><th>Item<\/th><th>Un\.<\/th><th>Quantidade<\/th><th>Pre\u00e7o unit\u00e1rio<\/th><th>Subtotal<\/th>/,
    /87292[\s\S]*composi\u00e7\u00e3o auxiliar[\s\S]*ARGAMASSA/,
    /94972[\s\S]*composi\u00e7\u00e3o auxiliar[\s\S]*CONCRETO FCK/,
    /37592[\s\S]*material[\s\S]*BLOCO CERAMICO[\s\S]*1\.142,40[\s\S]*R\$ 1,92[\s\S]*R\$ 2\.193,41/,
    /88309[\s\S]*m\u00e3o de obra[\s\S]*PEDREIRO[\s\S]*R\$ 29,00/,
    /93281[\s\S]*equipamento[\s\S]*GUINCHO[\s\S]*R\$ 33,45/,
    /Subtotal anal\u00edtico dos itens[\s\S]*R\$ 17\.998,22/,
    /Subtotal oficial dos servi\u00e7os[\s\S]*R\$ 17\.990,24/,
    /Diverg\u00eancia anal\u00edtica: R\$ 7,99 \(0,04%\)/,
    /A soma anal\u00edtica pode divergir do pre\u00e7o total oficial da composi\u00e7\u00e3o/,
    /O subtotal oficial prevalece e n\u00e3o foi substitu\u00eddo/,
    /Materiais que ser\u00e3o utilizados/,
    /Consumo t\u00e9cnico/,
    /Compra m\u00ednima/,
    /1\.143 un/,
    /1\.779 un/,
    /Perdas n\u00e3o aplicadas/,
    /Composi\u00e7\u00f5es auxiliares utilizadas/,
    /87292[\s\S]*Composi\u00e7\u00e3o auxiliar ainda n\u00e3o detalhada em insumos de compra/,
    /94972[\s\S]*Composi\u00e7\u00e3o auxiliar ainda n\u00e3o detalhada em insumos de compra/,
    /Anexo t\u00e9cnico/,
    /\u00cdcaro Amaral Engenharia/,
    /Telefone: \(77\) 99999-9999/,
    /E-mail: contato@empresa\.com/,
    /\u00c1rea = 30,00 m \u00d7 2,80 m = 84,00 m\u00b2/,
    /Volume = 45,00 m x 0,20 m x 0,30 m = 2,70 m\u00b3/,
    /Gerado em 16\/07\/2026, 21:00/,
    /Comprimento da cumeeira n\u00e3o informado\./,
    /Percentual de perdas n\u00e3o informado\./,
    /A\u00e7o estrutural n\u00e3o inclu\u00eddo\./,
    /A concretagem da viga baldrame n\u00e3o inclui a\u00e7o, formas, escava\u00e7\u00e3o, impermeabiliza\u00e7\u00e3o ou reaterro\./,
    /Nenhum pre\u00e7o foi inventado/,
    /BDI e perdas n\u00e3o foram aplicados/
  ]) {
    assert.match(html, expected);
  }

  assert.doesNotMatch(html, /cumeeira_length_missing|loss_percent_not_informed|steel_not_included|Total geral|total da obra|Documento consolidado gerado|quadro consolidado|SEM-PRECO|Sem preco|C:\/|C:\\\|Users|originPath|origem arquivo|Downloads/i);
  assert.ok((html.match(/Base SINAPI \| BA \| 2024-12 \| Desonerado/g) || []).length <= 2);
  assert.doesNotMatch(html, /undefined|null|\[object Object\]/i);

  const pricedItemsSection = sectionBetween(html, "<h2>Itens precificados</h2>", "<h2>Materiais que ser\u00e3o utilizados</h2>");
  assert.doesNotMatch(pricedItemsSection, /SEM-PRECO/i);

  const materialsUseSection = sectionBetween(html, "<h2>Materiais que ser\u00e3o utilizados</h2>", "<h3>Composi\u00e7\u00f5es auxiliares utilizadas</h3>");
  assert.doesNotMatch(materialsUseSection, /PEDREIRO|SERVENTE|TELHADISTA|CARPINTEIRO|VIBRADOR|GUINCHO/i);
  assert.doesNotMatch(materialsUseSection, /ARGAMASSA TRA|CONCRETO FCK/i);

  const directMaterialsSection = sectionBetween(html, "<h3>Materiais diretos</h3>", "<h3>Composi\u00e7\u00f5es auxiliares utilizadas</h3>");
  assert.doesNotMatch(directMaterialsSection, /PEDREIRO|SERVENTE|TELHADISTA|CARPINTEIRO|VIBRADOR|GUINCHO|ARGAMASSA TRA|CONCRETO FCK/i);
  const laborSection = sectionBetween(html, "<h3>M\u00e3o de obra</h3>", "<h3>Equipamentos</h3>");
  assert.match(laborSection, /PEDREIRO|SERVENTE|TELHADISTA|CARPINTEIRO/i);
  assert.match(html, /<h3>Equipamentos<\/h3>[\s\S]*?(VIBRADOR|GUINCHO)/i);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true, preferCSSPageSize: true });
    await page.close();
  } finally {
    await browser.close();
  }

  assert.ok(existsSync(pdfPath), pdfPath);
  assert.ok(statSync(pdfPath).size > 20_000, "PDF deve ter conteudo real");
  assert.equal(readFileSync(pdfPath).subarray(0, 4).toString("utf8"), "%PDF");
  assert.ok(countPdfPages(pdfPath) >= 2, "PDF deve ter paginacao real");
});

test("roteador coleta identificacao temporaria e limpa o estado", () => {
  const win = loadRouterContext();
  const router = win.EloTechnicalServiceRouter;

  const prompt = router.requestPdfIdentification({ generationId: "full" });
  assert.match(prompt.fullAnswer, /Deseja colocar o nome da sua empresa ou seu nome no documento/);
  assert.equal(router.hasPendingPdfIdentification(), true);

  const complete = router.route("\u00cdcaro Amaral Engenharia telefone (77) 99999-9999 email contato@empresa.com");
  assert.equal(complete.technicalServicePdfIdentification.displayName, "\u00cdcaro Amaral Engenharia");
  assert.equal(complete.technicalServicePdfIdentification.phone, "(77) 99999-9999");
  assert.equal(complete.technicalServicePdfIdentification.email, "contato@empresa.com");
  assert.equal(router.hasPendingPdfIdentification(), false);

  router.requestPdfIdentification({ generationId: "name-only" });
  const nameOnly = router.route("\u00cdcaro Amaral Engenharia");
  assert.equal(nameOnly.technicalServicePdfIdentification.displayName, "\u00cdcaro Amaral Engenharia");
  assert.equal(nameOnly.technicalServicePdfIdentification.phone, "");
  assert.equal(nameOnly.technicalServicePdfIdentification.email, "");
  assert.equal(router.hasPendingPdfIdentification(), false);

  router.requestPdfIdentification({ generationId: "skip" });
  const skipped = router.route("gerar sem identifica\u00e7\u00e3o");
  assert.equal(skipped.technicalServicePdfIdentification.displayName, "");
  assert.equal(skipped.technicalServicePdfIdentification.phone, "");
  assert.equal(skipped.technicalServicePdfIdentification.email, "");
  assert.equal(router.hasPendingPdfIdentification(), false);

  assert.equal(router.route("\u00cdcaro Amaral Engenharia"), null);
});
