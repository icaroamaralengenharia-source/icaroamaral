import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const XLSX = require("../node_modules/xlsx");
const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const realSinapiPath = "C:/Users/Wia Engenharia/Downloads/SINAPI/SINAPI_Custo_Ref_Composicoes_Analitico_BA_202412_Desonerado.xlsx";
const reportJsonPath = join(repoDir, "tmp", "elo-human-stress-report.json");
const reportTxtPath = join(repoDir, "tmp", "elo-human-stress-report.txt");

const HUMAN_CASES = [
  "quero telhado com telha portuguesa",
  "telha colonial quantos material",
  "coberta de fibrocimento 30m2",
  "cumeeira telha portuguesa",
  "ripamento pra telhado",
  "caibro pra cobertura",
  "terça de madeira telhado",
  "estrutura metalica pra telhado",
  "telhado colonial com madeira",
  "fazer cobertura ceramica",
  "sapata de concreto",
  "quanto aço vai na sapata",
  "radier de 50m2",
  "baldrame com concreto",
  "viga baldrame",
  "pilar de concreto",
  "viga de concreto armado",
  "laje 80m2 10cm fck25",
  "concreto magro pra fundação",
  "concretar laje",
  "bloco baiano parede 10m2",
  "quantos blocos gasto em 30m2",
  "bloco ceramico 14x19x29",
  "alvenaria de vedação",
  "parede de bloco estrutural",
  "canaleta ceramica",
  "verga de porta",
  "contraverga janela",
  "levantar parede 20m2",
  "paredi de bloko baiano 10 metro",
  "piso ceramico 50m2",
  "porcelanato 60x60 junta 3mm",
  "argamassa ac2 pra piso",
  "argamassa ac iii porcelanato",
  "rejunte para piso",
  "assentamento de piso no chao",
  "revestimento ceramico parede banheiro",
  "quero saber quantos saco de argamassa",
  "piso porcelanato na sala",
  "ceramica no banheiro",
  "chapisco 10m2",
  "reboco 10m2",
  "emboço parede externa",
  "massa unica interna",
  "contrapiso 30m2 3cm",
  "regularização de piso",
  "quanto cimento no contrapiso",
  "areia pra chapisco",
  "reboca essa parede",
  "xapisco e rebocu 20 metro",
  "pintura acrilica parede",
  "tinta acrilica 200m2",
  "selador parede nova",
  "massa corrida parede",
  "textura acrilica",
  "pintar fachada",
  "fundo preparador",
  "quantos litros de tinta",
  "pintura interna duas demao",
  "pintar muro",
  "eletroduto embutido parede",
  "pvc esgoto 100mm",
  "tubo pvc agua fria",
  "caixa sifonada banheiro",
  "caixa de passagem eletrica",
  "cabo eletrico 2.5mm",
  "disjuntor quadro",
  "ponto de tomada",
  "ponto de luz",
  "ppr agua quente",
  "impermeabilização laje",
  "manta asfaltica",
  "impermeabilizante parede",
  "rodape ceramico",
  "soleira granito",
  "peitoril janela",
  "porta de madeira",
  "janela aluminio",
  "forro pvc",
  "gesso teto",
  "o pedreiro executou 30 m2 de parede",
  "retirou 15 sacos de cimento",
  "quantos deveria gastar",
  "foram retirados 20 sacos de argamassa para 50m2 de piso",
  "almoxarife liberou 10 saco de cimento pro contrapiso",
  "rdo informou 12m2 de reboco",
  "consumo acima do previsto",
  "confere se esse material bate com 20m2 de chapisco",
  "fiscalizar retirada de areia",
  "comparar executado com material retirado",
  "vou faze um telhado portugues quanto vai",
  "presiso de material pra levanta parede",
  "qnto de cimento no reboco",
  "qtos saco argamassa piso 50 metro",
  "bloquinho baiano parede pequena",
  "quero compra material pra sapata",
  "o cara pediu 20 saco ta certo?",
  "fiz 10 metro de xapisco",
  "quantas telha portuguesa por metro",
  "arruma orçamento desse piso ai"
];

function officialRowsFixture() {
  return [{ source: "SINAPI", compositionCode: "SINAPI-COB-001", compositionName: "Cobertura com telha ceramica portuguesa", compositionUnit: "m2", serviceType: "cobertura", inputCode: "TELHA", inputName: "Telha ceramica portuguesa", inputUnit: "un", coefficient: "16" },
    { source: "SINAPI", compositionCode: "SINAPI-PISO-001", compositionName: "Revestimento ceramico para piso", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG", inputName: "Argamassa colante", inputUnit: "kg", coefficient: "4,2" },
    { source: "SINAPI", compositionCode: "SINAPI-PORC-001", compositionName: "Revestimento porcelanato para piso", compositionUnit: "m2", serviceType: "piso_ceramico", inputCode: "ARG3", inputName: "Argamassa AC III porcelanato", inputUnit: "kg", coefficient: "5,1" },
    { source: "SINAPI", compositionCode: "SINAPI-CHAP-001", compositionName: "Chapisco aplicado em alvenaria", compositionUnit: "m2", serviceType: "chapisco", inputCode: "CIM", inputName: "Cimento portland", inputUnit: "kg", coefficient: "2,4" },
    { source: "SINAPI", compositionCode: "SINAPI-REBOCO-001", compositionName: "Emboco ou massa unica em argamassa", compositionUnit: "m2", serviceType: "reboco", inputCode: "AREIA", inputName: "Areia media", inputUnit: "m3", coefficient: "0,025" },
    { source: "SINAPI", compositionCode: "SINAPI-ALV-001", compositionName: "Alvenaria de vedacao com bloco ceramico", compositionUnit: "m2", serviceType: "alvenaria", inputCode: "BLOCO", inputName: "Bloco ceramico", inputUnit: "un", coefficient: "13,5" },
    { source: "SINAPI", compositionCode: "SINAPI-CONTRA-001", compositionName: "Regularizacao de piso cimentado tipo contrapiso", compositionUnit: "m2", serviceType: "contrapiso", inputCode: "ARGC", inputName: "Argamassa para contrapiso", inputUnit: "m3", coefficient: "0,035" }];
}

function loadEngines() {
  const stockSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "stock-ai-composition-engine.js"), "utf8");
  const searchSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "composition-search-engine.js"), "utf8");
  const eloSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-engine.js"), "utf8");
  const sandbox = { console, window: { XLSX }, XLSX };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(stockSource, sandbox, { filename: "stock-ai-composition-engine.js" });
  vm.runInContext(searchSource, sandbox, { filename: "composition-search-engine.js" });

  let baseMode = "fallback";
  let baseLoadError = "";
  try {
    if (existsSync(realSinapiPath)) {
      const imported = sandbox.window.StockAiCompositionEngine.importSinapiAnaliticoXlsx(realSinapiPath, { readFile: readFileSync, source: "SINAPI", state: "BA", referenceMonth: "2024-12" });
      if (imported && imported.ok && imported.imported && imported.imported.length > 1000) {
        baseMode = "real";
      } else {
        baseLoadError = imported && imported.error || "real base import did not return enough compositions";
      }
    } else {
      baseLoadError = "real SINAPI XLSX not found";
    }
  } catch (error) {
    baseLoadError = error && error.message || String(error);
  }
  if (baseMode !== "real") {
    const fallback = sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows: officialRowsFixture() });
    assert.equal(fallback.ok, true);
  }

  const rawSearch = sandbox.window.CompositionSearchEngine.searchOfficialCompositions.bind(sandbox.window.CompositionSearchEngine);
  const calls = [];
  sandbox.window.CompositionSearchEngine.searchOfficialCompositions = function wrappedSearch(query, options) {
    const startedAt = performance.now();
    const result = rawSearch(query, options || {});
    calls.push({ query, options: options || {}, result, elapsedMs: performance.now() - startedAt });
    return result;
  };

  vm.runInContext(eloSource, sandbox, { filename: "elo-technical-engine.js" });
  const stats = sandbox.window.CompositionSearchEngine.getIndexStats();
  return { sandbox, baseMode, baseLoadError, stats, calls };
}

function collectSearches(analysis) {
  const searches = [];
  if (analysis && analysis.compositionSearch) searches.push(analysis.compositionSearch);
  if (analysis && Array.isArray(analysis.services)) {
    analysis.services.forEach((service) => {
      if (service && service.compositionSearch) searches.push(service.compositionSearch);
    });
  }
  return searches;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function hasGenericBriefing(answer) {
  return /cliente|cidade\/uf|nome da obra|briefing da obra/i.test(answer || "");
}

function inferSynonymNeeds(row) {
  const text = row.normalizedText;
  const needs = [];
  if (/xapisco/.test(text)) needs.push("xapisco -> chapisco");
  if (/rebocu/.test(text)) needs.push("rebocu -> reboco");
  if (/paredi/.test(text)) needs.push("paredi -> parede");
  if (/bloko/.test(text)) needs.push("bloko -> bloco");
  if (/qnto|qtos/.test(text)) needs.push("qnto/qtos -> quanto/quantos");
  if (/presiso/.test(text)) needs.push("presiso -> preciso");
  if (/\bfaze\b/.test(text)) needs.push("faze -> fazer");
  if (/ac2/.test(text)) needs.push("ac2 -> AC-II");
  if (/\baciii\b/.test(text)) needs.push("aciii -> AC-III");
  return needs;
}

function writeReports(report) {
  mkdirSync(join(repoDir, "tmp"), { recursive: true });
  writeFileSync(reportJsonPath, JSON.stringify(report, null, 2), "utf8");
  const lines = [];
  lines.push("ELO HUMAN STRESS REPORT", "");
  lines.push(`Base: ${report.baseMode}`);
  if (report.baseLoadError) lines.push(`Fallback motivo: ${report.baseLoadError}`);
  lines.push(`Composicoes indexadas: ${report.index.totalCompositions}`);
  lines.push(`Itens/insumos indexados: ${report.index.totalInputs}`);
  lines.push(`Origem: ${report.index.baseLocations.join(", ")}`);
  lines.push("");
  lines.push("Resumo geral");
  lines.push(`- Total testado: ${report.summary.total}`);
  lines.push(`- Busca acionada: ${report.summary.searchTriggered} (${report.summary.searchTriggeredRate}%)`);
  lines.push(`- Com candidatos: ${report.summary.withCandidates} (${report.summary.candidateRate}%)`);
  lines.push(`- Sem candidatos: ${report.summary.withoutCandidates}`);
  lines.push(`- Pediu parametro: ${report.summary.askedMissingParameter}`);
  lines.push(`- Falhas: ${report.summary.failures}`);
  lines.push(`- Tempo medio de busca: ${report.summary.avgSearchMs} ms`);
  lines.push(`- P95 de busca: ${report.summary.p95SearchMs} ms`);
  lines.push("");
  lines.push("Top acertos");
  report.topHits.forEach((row) => lines.push(`- ${row.input} => ${row.top3.map((item) => `${item.code} ${item.score}`).join("; ")}`));
  lines.push("");
  lines.push("Buscas sem candidato");
  report.noCandidateRows.slice(0, 20).forEach((row) => lines.push(`- ${row.input} | mode=${row.mode} | busca=${row.searchTriggered}`));
  lines.push("");
  lines.push("Frases que cairam errado");
  report.badModeRows.forEach((row) => lines.push(`- ${row.input} | mode=${row.mode}`));
  lines.push("");
  lines.push("Termos que precisam de sinonimo novo");
  report.synonymNeeds.forEach((item) => lines.push(`- ${item}`));
  lines.push("");
  lines.push("10 piores buscas por tempo");
  report.slowestSearches.forEach((row) => lines.push(`- ${row.searchMs} ms | ${row.input}`));
  lines.push("");
  lines.push("Recomendacoes automaticas");
  report.recommendations.forEach((item) => lines.push(`- ${item}`));
  writeFileSync(reportTxtPath, lines.join("\n"), "utf8");
}

test("Elo auditor suporta stress humano com 100 frases reais de obra", { timeout: 240000 }, () => {
  const { sandbox, baseMode, baseLoadError, stats, calls } = loadEngines();
  assert.equal(HUMAN_CASES.length, 100);
  if (sandbox.window.CompositionSearchEngine.clearIndexCache) sandbox.window.CompositionSearchEngine.clearIndexCache();
  sandbox.window.CompositionSearchEngine.getIndexStats();

  const rows = HUMAN_CASES.map((input) => {
    const callStart = calls.length;
    let analysis;
    let crashed = false;
    let error = "";
    try {
      analysis = sandbox.window.EloTechnicalEngine.analyze(input);
    } catch (caught) {
      crashed = true;
      error = caught && caught.stack || String(caught);
      analysis = null;
    }
    const newCalls = calls.slice(callStart);
    const searches = collectSearches(analysis);
    const searchResults = searches.length ? searches : newCalls.map((call) => call.result).filter(Boolean);
    const bestCandidates = searchResults.flatMap((result) => result.candidates || []).sort((a, b) => (b.score || 0) - (a.score || 0));
    const searchMs = newCalls.reduce((total, call) => total + call.elapsedMs, 0);
    const answer = analysis && analysis.answer || "";
    const normalizedText = sandbox.window.CompositionSearchEngine.normalize(input);
    const row = {
      input,
      normalizedText,
      mode: analysis && analysis.mode || "crash",
      service: analysis && analysis.service && analysis.service.id || "",
      searchTriggered: newCalls.length > 0,
      searchCount: newCalls.length,
      candidateCount: bestCandidates.length,
      top3: bestCandidates.slice(0, 3).map((candidate) => ({ code: candidate.code, unit: candidate.unit, score: candidate.score, description: candidate.description, reasons: candidate.reasons })),
      bestScore: bestCandidates[0] && bestCandidates[0].score || 0,
      reasons: bestCandidates[0] && bestCandidates[0].reasons || [],
      askedMissingParameter: !!(analysis && Array.isArray(analysis.missing) && analysis.missing.length),
      inventedConsumption: /COEFICIENTES E CONSUMO PREVISTO/i.test(answer) && !/COMPOSICAO UTILIZADA/i.test(answer),
      genericBriefing: hasGenericBriefing(answer),
      searchMs: Number(searchMs.toFixed(3)),
      crashed,
      error
    };
    row.synonymNeeds = inferSynonymNeeds(row);
    return row;
  });

  const searchTimes = rows.filter((row) => row.searchTriggered).map((row) => row.searchMs);
  const summary = {
    total: rows.length,
    searchTriggered: rows.filter((row) => row.searchTriggered).length,
    withCandidates: rows.filter((row) => row.candidateCount > 0).length,
    withoutCandidates: rows.filter((row) => row.candidateCount === 0).length,
    askedMissingParameter: rows.filter((row) => row.askedMissingParameter).length,
    failures: rows.filter((row) => row.crashed || row.genericBriefing || row.inventedConsumption).length,
    avgSearchMs: Number((searchTimes.reduce((total, value) => total + value, 0) / Math.max(1, searchTimes.length)).toFixed(3)),
    p95SearchMs: Number(percentile(searchTimes, 95).toFixed(3))
  };
  summary.searchTriggeredRate = Number(((summary.searchTriggered / summary.total) * 100).toFixed(1));
  summary.candidateRate = Number(((summary.withCandidates / summary.total) * 100).toFixed(1));

  const badModeRows = rows.filter((row) => row.genericBriefing || row.mode === "project_facts" || row.mode === "not_technical");
  const noCandidateRows = rows.filter((row) => row.candidateCount === 0);
  const topHits = rows.filter((row) => row.candidateCount > 0).sort((a, b) => b.bestScore - a.bestScore).slice(0, 15);
  const synonymNeeds = Array.from(new Set(rows.flatMap((row) => row.synonymNeeds)));
  const slowestSearches = rows.filter((row) => row.searchTriggered).sort((a, b) => b.searchMs - a.searchMs).slice(0, 10).map((row) => ({ input: row.input, searchMs: row.searchMs, mode: row.mode }));
  const recommendations = [];
  if (summary.candidateRate < 80) recommendations.push("Ampliar sinonimos e ranking para instalacoes, esquadrias, forro, gesso e auditoria de almoxarifado.");
  if (synonymNeeds.length) recommendations.push("Adicionar normalizacao explicita para erros populares detectados no teste.");
  if (badModeRows.length) recommendations.push("Fazer o Elo manter modo tecnico mesmo quando a busca oficial nao retorna candidato.");
  if (summary.p95SearchMs > 500) recommendations.push("Otimizar ranking ou reduzir custo por busca apos indice cacheado.");

  const report = {
    baseMode,
    baseLoadError,
    index: stats,
    summary,
    topHits,
    noCandidateRows,
    badModeRows,
    synonymNeeds,
    slowestSearches,
    recommendations,
    rows
  };
  writeReports(report);

  assert.equal(rows.filter((row) => row.crashed).length, 0, "nenhuma pergunta pode causar crash");
  assert.equal(rows.filter((row) => row.genericBriefing).length, 0, "nao pode voltar ao briefing generico antigo");
  assert.equal(rows.filter((row) => row.inventedConsumption).length, 0, "nao pode inventar coeficiente sem composicao oficial");
  assert.ok(summary.searchTriggeredRate >= 80, `busca acionada em ${summary.searchTriggeredRate}%`);
  if (baseMode === "real") {
    assert.ok(summary.candidateRate >= 65, `candidatos encontrados em ${summary.candidateRate}%`);
  }
  assert.ok(summary.p95SearchMs < 500, `p95 de busca ${summary.p95SearchMs}ms`);
});

