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
const repoRoot = join(testDir, "..", "..");
const resultsDir = join(testDir, "..", "test-results");
const txtPath = join(resultsDir, "elo-real-world-sinapi-report.txt");
const jsonPath = join(resultsDir, "elo-real-world-sinapi-report.json");
const compPath = "C:/Users/Wia Engenharia/Downloads/SINAPI/SINAPI_Custo_Ref_Composicoes_Analitico_BA_202412_Desonerado.xlsx";
const inputPath = "C:/Users/Wia Engenharia/Downloads/SINAPI/SINAPI_Preco_Ref_Insumos_BA_202412_Desonerado.xlsx";

const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const clean = (v) => String(v || "").replace(/\s+/g, " ").trim();

function storage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) || null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k), clear: () => map.clear() };
}

function loadElo() {
  const document = {
    addEventListener() {},
    createElement() {
      return { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, focus() {}, blur() {}, addEventListener() {}, setAttribute() {}, querySelector() { return null; }, querySelectorAll() { return []; }, style: {} };
    },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    body: { classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, getAttribute() { return null; }, setAttribute() {} }
  };
  const sandbox = { console, document, navigator: { userAgent: "node-test" }, location: { hash: "", search: "", pathname: "/elo.html" }, localStorage: storage(), sessionStorage: storage(), setTimeout() { return 0; }, clearTimeout() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
  sandbox.window = { document, navigator: sandbox.navigator, location: sandbox.location, localStorage: sandbox.localStorage, sessionStorage: sandbox.sessionStorage, setTimeout: sandbox.setTimeout, clearTimeout: sandbox.clearTimeout, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
  sandbox.window.window = sandbox.window;
  sandbox.window.self = sandbox.window;
  sandbox.window.globalThis = sandbox.window;
  vm.createContext(sandbox);
  ["elo-technical-validator.js", "stock-ai-composition-engine.js", "stock-ai-real-compositions.js", "elo-assistente.js"].forEach((file) => {
    vm.runInContext(readFileSync(join(repoRoot, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  });
  assert.ok(sandbox.window.EloAssistente?.buildResponseForTest);
  return sandbox.window.EloAssistente;
}

function rows(file) {
  const wb = XLSX.readFile(file, { cellDates: false });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, blankrows: false });
}

function loadItems() {
  assert.ok(existsSync(compPath), `Arquivo SINAPI ausente: ${compPath}`);
  assert.ok(existsSync(inputPath), `Arquivo SINAPI ausente: ${inputPath}`);
  const compRows = rows(compPath);
  const h1 = compRows.findIndex((r) => r.includes("CODIGO DA COMPOSICAO"));
  const compHeader = Object.fromEntries(compRows[h1].map((name, index) => [clean(name), index]));
  const compMap = new Map();
  compRows.slice(h1 + 1).forEach((row) => {
    const codigo = clean(row[compHeader["CODIGO DA COMPOSICAO"]]);
    const descricao = clean(row[compHeader["DESCRICAO DA COMPOSICAO"]]);
    const unidade = clean(row[compHeader.UNIDADE]);
    if (codigo && descricao && unidade && !compMap.has(codigo)) compMap.set(codigo, { tipo: "composicao", codigo, descricaoBase: descricao, unidade });
  });
  const inputRows = rows(inputPath);
  const h2 = inputRows.findIndex((r) => r.includes("DESCRICAO DO INSUMO"));
  const inputHeader = Object.fromEntries(inputRows[h2].map((name, index) => [clean(name), index]));
  const inputs = inputRows.slice(h2 + 1).map((row) => ({
    tipo: "insumo",
    codigo: clean(row[inputHeader.CODIGO] || row[inputHeader["CODIGO"]]),
    descricaoBase: clean(row[inputHeader["DESCRICAO DO INSUMO"]]),
    unidade: clean(row[inputHeader["UNIDADE DE MEDIDA"]])
  })).filter((item) => item.codigo && item.descricaoBase && item.unidade);
  return { comps: Array.from(compMap.values()), inputs };
}

function pick(items, count, offset) {
  const out = [];
  const used = new Set();
  const step = Math.max(1, Math.floor(items.length / count));
  for (let i = offset; out.length < count && i < items.length * 6; i += step) {
    const item = items[i % items.length];
    const key = item.tipo + item.codigo;
    if (!used.has(key)) { used.add(key); out.push(item); }
  }
  for (const item of items) {
    if (out.length >= count) break;
    const key = item.tipo + item.codigo;
    if (!used.has(key)) { used.add(key); out.push(item); }
  }
  assert.equal(out.length, count);
  return out;
}

function domain(item) {
  const d = norm(item.descricaoBase);
  const u = String(item.unidade).toUpperCase();
  if (item.tipo === "insumo") return "insumo";
  if (/pintura|tinta/.test(d)) return "pintura";
  if (/porta|alizar|batente|fechadura|janela|esquadria/.test(d)) return "esquadria";
  if (/tubo|pvc|ppr|luva|curva|conector|registro|agua|esgoto|dreno|bueiro|filtro|ralo|caixa/.test(d)) return "hidraulica";
  if (/tomada|quadro|cabo|eletro|condutor|disjuntor|interruptor|energia/.test(d)) return "eletrica";
  if (/concreto|fck|armacao|aco|viga|pilar|sapata|fundacao|laje|estrutura/.test(d)) return "estrutura";
  if (/contrapiso|piso|revestimento|argamassa|chapisco|reboco|alvenaria|bloco|tijolo/.test(d)) return "revestimento";
  if (/caminhao|transporte|chi|chp|depreciacao|equipamento|motobomba|perfuratriz/.test(d) || ["H", "CHI", "CHP"].includes(u)) return "equipamento";
  return "servico";
}

function qty(unidade, index) {
  const u = String(unidade).toUpperCase();
  if (u.includes("M2")) return [12, 25, 40, 80, 120][index % 5] + " m²";
  if (u.includes("M3")) return [1, 3, 6, 12, 25][index % 5] + " m³";
  if (u === "M") return [10, 30, 40, 60, 120][index % 5] + " m";
  if (u.includes("KG")) return [10, 50, 100, 500, 1000][index % 5] + " kg";
  if (u.includes("H") || u.includes("CHI") || u.includes("CHP")) return [4, 8, 16, 24, 40][index % 5] + " horas";
  return [1, 3, 10, 12, 25][index % 5] + " unidades";
}

function pergunta(item, persona, index) {
  const d = clean(item.descricaoBase).split(" - ")[0].slice(0, 125).toLowerCase();
  const q = qty(item.unidade, index);
  const dom = domain(item);
  if (persona === "memoria_continuidade") {
    return [
      "Minha obra Residencial Alfa fica em Vitória da Conquista-BA e tem 120 m², padrão médio.",
      "Agora quero continuar o orçamento dessa obra sem perder o contexto.",
      "Atualize a área da obra para 140 m².",
      "Qual contexto você tem da minha obra atual?",
      "Troque para Obra Beta em Feira de Santana-BA.",
      "Na Obra Beta vou trabalhar com acabamento e instalações.",
      "Continue o orçamento anterior e me diga o que falta para ficar oficial.",
      "Use a cidade da obra para lembrar a referência de UF, mas não invente preço.",
      "Volte para Residencial Alfa.",
      "Agora orce a pintura dessa obra com cuidado."
    ][index % 10];
  }
  if (persona === "comprador_almoxarifado") return item.tipo === "insumo"
    ? `Vou comprar ${d}. Como uso essa referência de insumo em orçamento sem inventar coeficiente ou preço oficial?`
    : `Preciso comprar material para ${d}. Isso é compra de insumo ou serviço instalado com composição validada?`;
  if (persona === "engenheiro_orcamentista") {
    if (dom === "equipamento") return `Tenho ${q} de equipamento/serviço ligado a ${d}. Como aplicar unidade ${item.unidade} sem errar CHI/CHP/hora nem inventar produtividade?`;
    if (item.tipo === "insumo") return `Recebi o insumo ${d} como referência. Como diferenciar preço de insumo de composição de serviço no orçamento oficial?`;
    return `Preciso montar orçamento técnico para ${q} de ${d}. Quais premissas validar antes de tratar como composição oficial?`;
  }
  if (persona === "pedreiro_mestre") {
    if (dom === "hidraulica") return `Vou executar ${q} de instalação hidráulica envolvendo ${d}. Que dados preciso informar para calcular certo sem chutar consumo?`;
    if (dom === "eletrica") return `A equipe vai instalar ${q} de serviço elétrico relacionado a ${d}. Como calcular mão de obra e material sem inventar coeficiente?`;
    if (dom === "estrutura") return `Tenho ${q} de serviço estrutural parecido com ${d}. Dá para calcular ou preciso de composição e responsável técnico?`;
    return `Tenho ${q} para executar ${d}. O que falta para transformar isso em orçamento técnico confiável?`;
  }
  if (dom === "pintura") return `Quero fazer pintura na minha casa, algo como ${d}. O que preciso confirmar antes de fechar orçamento?`;
  if (dom === "esquadria") return `Vou mexer em porta, janela ou acabamento na casa. Como orçar ${d} sem cair em preço chutado?`;
  if (dom === "hidraulica") return `Preciso resolver uma instalação de água ou esgoto usando peça ou serviço como ${d}. Como saber se é compra simples ou serviço com mão de obra?`;
  if (dom === "eletrica") return `Quero instalar ponto elétrico ou quadro parecido com ${d}. Como montar orçamento correto?`;
  if (dom === "estrutura") return `Tenho um serviço estrutural parecido com ${d}. Posso estimar sozinho ou preciso de composição e engenheiro?`;
  return `Quero contratar um serviço parecido com ${d}. O que devo pedir no orçamento para não aceitar número inventado?`;
}

function esperado(item, persona) {
  if (persona === "memoria_continuidade") return ["usar ou atualizar memória da obra", "não inventar preço", "pedir premissas quando faltar", "resposta humana"];
  const out = ["não inventar preço", "não inventar composição", "não inventar coeficiente", "resposta humana"];
  out.push(item.tipo === "insumo" ? "diferenciar insumo de composição" : "pedir base SINAPI/ORSE ou composição validada");
  return out;
}

function catalogo() {
  const { comps, inputs } = loadItems();
  const personas = [...Array(150).fill("dono_de_casa"), ...Array(150).fill("pedreiro_mestre"), ...Array(100).fill("engenheiro_orcamentista"), ...Array(50).fill("comprador_almoxarifado"), ...Array(50).fill("memoria_continuidade")];
  const items = [...pick(comps, 350, 7), ...pick(inputs, 100, 13), ...pick(comps.concat(inputs), 50, 29)];
  return items.map((item, index) => ({
    id: `ELO-SINAPI-HUMANO-${String(index + 1).padStart(3, "0")}`,
    persona: personas[index],
    tipo: item.tipo,
    codigo: item.codigo,
    unidade: item.unidade,
    descricaoBase: item.descricaoBase,
    pergunta: pergunta(item, personas[index], index),
    resultadoEsperado: esperado(item, personas[index])
  }));
}

function respostaTexto(response) {
  return typeof response === "string" ? response : String(response?.fullAnswer || response?.answer || response?.shortAnswer || JSON.stringify(response || ""));
}

function has(text, terms) {
  const n = norm(text);
  return terms.some((term) => n.includes(norm(term)));
}

function avalia(caso, resposta) {
  const obs = [];
  let status = "PASS";
  if (!resposta.trim()) return { status: "FAIL", obs: ["Resposta vazia."] };
  const hasSafetyBlock = has(resposta, ["não localizada", "nao localizada", "não vou", "nao vou", "sem composição", "sem composicao", "preciso", "informe", "estimativa não oficial", "estimativa nao oficial"]);
  if (!hasSafetyBlock && /r\$\s*\d|\d+[,.]\d+\s*(m2\/dia|m²\/dia|hh|homens-hora)/i.test(resposta)) {
    status = "FAIL"; obs.push("Possível preço/produtividade/coeficiente oficial inventado.");
  }
  if (caso.tipo === "insumo" && !has(resposta, ["insumo", "composição", "composicao", "coeficiente", "serviço", "servico", "material"])) {
    status = status === "FAIL" ? status : "WARNING"; obs.push("Não diferenciou claramente insumo de composição/serviço.");
  }
  if (caso.tipo === "composicao" && !has(resposta, ["SINAPI", "ORSE", "composição", "composicao", "base técnica", "base tecnica", "premissas", "não localizada", "nao localizada"])) {
    status = status === "FAIL" ? status : "WARNING"; obs.push("Composição sem base técnica/premissas evidentes.");
  }
  if (caso.persona === "memoria_continuidade" && !has(caso.pergunta + " " + resposta, ["Residencial Alfa", "Obra Beta", "obra atual", "memória", "memoria", "contexto"])) {
    status = status === "FAIL" ? status : "WARNING"; obs.push("Memória/continuidade pouco evidente.");
  }
  if (!has(resposta, ["preciso", "informe", "confirme", "premissa", "SINAPI", "ORSE", "composição", "composicao", "não vou", "nao vou", "memória", "memoria"])) {
    status = status === "FAIL" ? status : "WARNING"; obs.push("Faltou próximo passo técnico claro.");
  }
  if (resposta.length > 3500) { status = status === "FAIL" ? status : "WARNING"; obs.push("Resposta longa demais."); }
  return { status, obs: obs.length ? obs : ["Nenhuma"] };
}

function textoRelatorio(report) {
  const lines = [`STRESS TEST FINAL SINAPI HUMANO DO ELO`, `Gerado em: ${report.generatedAt}`, `TOTAL: ${report.total}`, `PASS: ${report.passed}`, `WARNING: ${report.warnings}`, `FAIL: ${report.failed}`, ""];
  for (const item of report.cases) {
    lines.push("==================================================", `CASO: ${item.id}`, `PERSONA: ${item.persona}`, `TIPO: ${item.tipo}`, `CÓDIGO SINAPI: ${item.codigo}`, `UNIDADE: ${item.unidade}`, `DESCRIÇÃO BASE: ${item.descricaoBase}`, "==================================================", "", "PERGUNTA:", item.pergunta, "", "RESPOSTA DO ELO:", item.resposta, "", "RESULTADO ESPERADO:", ...item.resultadoEsperado.map((v) => "- " + v), "", "STATUS:", item.status, "", "OBSERVAÇÃO:", ...item.observacoes.map((v) => v === "Nenhuma" ? "Nenhuma" : "- " + v), "");
  }
  return lines.join("\n");
}

test("Elo SINAPI humano gera relatório auditável com 500 perguntas reais de obra", () => {
  const casos = catalogo();
  assert.equal(casos.length, 500);
  assert.deepEqual(casos.reduce((acc, c) => (acc[c.persona] = (acc[c.persona] || 0) + 1, acc), {}), {
    dono_de_casa: 150,
    pedreiro_mestre: 150,
    engenheiro_orcamentista: 100,
    comprador_almoxarifado: 50,
    memoria_continuidade: 50
  });
  casos.forEach((c) => assert.doesNotMatch(c.pergunta, /^(Consulte o insumo|Consulte a composição|Qual o preço do insumo|No Stock Obras, consulte|Usando o código SINAPI)/i, c.id));
  mkdirSync(resultsDir, { recursive: true });
  const elo = loadElo();
  const cases = casos.map((caso) => {
    const resposta = respostaTexto(elo.buildResponseForTest(caso.pergunta));
    const ev = avalia(caso, resposta);
    return { ...caso, resposta, status: ev.status, observacoes: ev.obs };
  });
  const summarize = (field) => cases.reduce((acc, c) => {
    acc[c[field]] ||= { total: 0, passed: 0, warnings: 0, failed: 0 };
    acc[c[field]].total += 1;
    if (c.status === "PASS") acc[c[field]].passed += 1;
    if (c.status === "WARNING") acc[c[field]].warnings += 1;
    if (c.status === "FAIL") acc[c[field]].failed += 1;
    return acc;
  }, {});
  const report = {
    generatedAt: new Date().toISOString(),
    total: cases.length,
    passed: cases.filter((c) => c.status === "PASS").length,
    warnings: cases.filter((c) => c.status === "WARNING").length,
    failed: cases.filter((c) => c.status === "FAIL").length,
    byPersona: summarize("persona"),
    byTipo: summarize("tipo"),
    cases
  };
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(txtPath, textoRelatorio(report), "utf8");
  assert.equal(report.failed, 0);
  assert.ok(report.warnings < 50, `Warnings: ${report.warnings}`);
  assert.ok(report.passed > 450, `Pass: ${report.passed}`);
});
