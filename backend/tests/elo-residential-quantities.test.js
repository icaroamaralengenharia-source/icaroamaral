import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return { getItem(key) { return data.has(key) ? data.get(key) : null; }, setItem(key, value) { data.set(String(key), String(value)); }, removeItem(key) { data.delete(key); }, clear() { data.clear(); } };
}

function createElement(tag) {
  return { tagName: String(tag || "").toUpperCase(), dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {}, setAttribute() {}, getAttribute() { return ""; }, querySelector() { return null; }, querySelectorAll() { return []; }, textContent: "", value: "", options: [], selectedIndex: -1 };
}

function fixtureBudget(facts) {
  return { projectFacts: facts, budgetEap: { stages: [{ name: "Servicos preliminares" }, { name: "Fundacao" }, { name: "Estrutura" }, { name: "Vedacoes" }, { name: "Cobertura" }], items: [{ description: "Locacao de obra" }, { description: "Fundacao" }, { description: "Alvenaria" }] }, quantities: [{ serviceId: "area_construida", description: "Area construida", quantity: facts.builtAreaM2 || 0, unit: "m2", source: "engine_stub" }], compositionMatches: [], priceStatus: { canTotal: false, totals: null, missingPrices: [] }, missing: [], risks: ["Orcamento preliminar sem fechamento financeiro."], baseStatus: { loaded: false, source: "SINAPI", state: facts.uf || "BA", referenceMonth: "" } };
}

function loadAssistant() {
  const localStorage = createStorage();
  const calls = { buildPreliminaryBudget: 0, facts: [] };
  const sandbox = { console, Date, Math, setTimeout(fn) { if (typeof fn === "function") fn(); return 0; }, clearTimeout() {}, Blob: function Blob() {}, URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} }, URLSearchParams, window: { ELO_SKIP_AUTO_WIDGET: true, ELO_DISABLE_AUTOFOCUS: true, ELO_PRODUCT_MODE: true, localStorage, sessionStorage: createStorage(), location: { hostname: "localhost", protocol: "http:", pathname: "/relatorio-qualidade-obras.html", hash: "" }, addEventListener() {}, removeEventListener() {}, crypto: { randomUUID: () => "test-id" }, open() { return { document: { open() {}, write() {}, close() {} }, focus() {} }; }, setTimeout(fn) { if (typeof fn === "function") fn(); return 0; }, clearTimeout() {}, EloBudgetEngine: { buildPreliminaryBudget(facts) { calls.buildPreliminaryBudget += 1; calls.facts.push(facts); return fixtureBudget(facts || {}); } } }, document: { readyState: "complete", body: createElement("body"), createElement, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } }, navigator: { userAgent: "node-test" } };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, calls };
}

function packageFrom(response) { return response.budgetOrchestratorV2?.budgetPackage; }
function quantity(pack, serviceId) { return (pack.quantities || []).find((item) => item.serviceId === serviceId); }
function qty(pack, serviceId) { return quantity(pack, serviceId)?.quantity || 0; }
function runCase(message) { const { elo, calls } = loadAssistant(); elo.clearBudgetRecordsForTest(); const response = elo.buildResponseForTest(message); return { elo, calls, response, pack: packageFrom(response), doc: response.pdfAction?.budgetDocumentData }; }
function percentDiff(a, b) { return Math.abs(Number(a) - Number(b)) / Math.max(Math.abs(Number(b)), 0.0001) * 100; }

const CASES = {
  casa70: "Quero orcar uma casa de 7x10 em Salvador/BA, casa terrea, padrao medio, estrutura convencional, alvenaria ceramica e cobertura em telha ceramica. Pode gerar.",
  casa80: "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica, dois quartos, um banheiro, sala, cozinha e area de servico. Pode gerar.",
  casa120: "Quero orcamento residencial preliminar para casa terrea de 120 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica, tres quartos, uma suite, dois banheiros, sala, cozinha, area de servico e garagem. Pode gerar.",
  sobrado160: "Faca um orcamento preliminar de um sobrado de 160 m2, dois pavimentos, tres quartos, uma suite, banheiro social, lavabo, sala, cozinha, area de servico, garagem e varanda, em Salvador/BA, estrutura de concreto armado, laje e cobertura embutida. Padrao medio.",
  tresBanheiros: "Quero orcamento residencial preliminar para casa terrea de 100 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica, tres quartos, tres banheiros, sala, cozinha e area de servico. Pode gerar.",
  umBanheiro: "Quero orcamento residencial preliminar para casa terrea de 100 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica, tres quartos, um banheiro, sala, cozinha e area de servico. Pode gerar.",
  laje: "Quero orcamento residencial preliminar para casa terrea de 80 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica e cobertura em laje impermeabilizada. Pode gerar."
};

const EXPECTED_80_SERVICES = ["servicos_preliminares_limpeza", "locacao_obra", "escavacao_fundacoes", "fundacao_concreto", "fundacao_formas", "fundacao_aco", "baldrame_concreto", "baldrame_impermeabilizacao", "estrutura_concreto", "estrutura_formas", "estrutura_aco", "alvenaria_externa", "alvenaria_interna", "alvenaria_liquida", "vergas", "contravergas", "chapisco", "emboco", "reboco", "pintura_interna", "pintura_externa", "contrapiso", "piso_interno", "piso_area_molhada", "rodape", "revestimento_areas_molhadas", "impermeabilizacao_areas_molhadas", "cobertura", "esquadrias_portas", "esquadrias_janelas", "pontos_eletricos", "pontos_iluminacao", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros", "loucas", "metais", "limpeza_final"];

function assertAuditable(pack) {
  assert.ok(pack, "budget package ausente");
  assert.ok(pack.quantityCoverage.percent >= 90, "cobertura minima de 90%");
  assert.equal(new Set((pack.quantities || []).map((item) => item.serviceId)).size, pack.quantities.length, "sem duplicidade de serviceId");
  for (const item of pack.quantities) {
    assert.ok(item.quantity > 0, item.serviceId + " deve ser positivo");
    assert.ok(item.unit, item.serviceId + " deve ter unidade");
    assert.ok(item.formula, item.serviceId + " deve ter formula");
    assert.ok(item.memory || item.calculationText, item.serviceId + " deve ter memoria");
    assert.ok(item.range?.min > 0 && item.range?.max >= item.range?.min, item.serviceId + " deve ter faixa");
    assert.ok(Array.isArray(item.dependencies) && item.dependencies.length > 0, item.serviceId + " deve ter dependencias");
  }
  for (const item of pack.quantities.filter((entry) => /fundacao|estrutura|baldrame|laje|escada|aco|formas|concreto/.test(entry.serviceId))) {
    assert.ok(item.dependencies.includes("projeto estrutural"), item.serviceId + " estrutural deve depender de projeto estrutural");
  }
}

test("inventario obrigatorio prova cobertura formula memoria unidade faixa dependencias e duplicidades", () => {
  for (const [name, message] of Object.entries(CASES)) {
    const { response, pack, doc } = runCase(message);
    assert.equal(response.sessionIntent, "budget_v2_residential_created", name);
    assert.ok(doc, name + " deve gerar budgetDocumentData");
    assertAuditable(pack);
    assert.equal((pack.blockedServices || []).length, 0, name + " sem bloqueados na matriz preliminar aplicavel");
  }
});

test("casa terrea 80 m2 possui lista completa de servicos principais solicitados", () => {
  const { pack, doc } = runCase(CASES.casa80);
  for (const serviceId of EXPECTED_80_SERVICES) assert.ok(quantity(pack, serviceId), serviceId + " ausente");
  assert.equal(pack.geometry.builtAreaM2, 80);
  assert.equal(pack.geometry.floors, 1);
  assert.ok(doc.calculationMemory.length >= pack.quantities.length);
  assert.match(doc.budget.source, /SINAPI|ORSE|pendente/i);
  assert.equal(doc.budget.pending, true);
});

test("gabarito independente da casa 80 m2 fica dentro dos desvios aceitos", () => {
  const { pack } = runCase(CASES.casa80);
  const area = 80;
  const width = Math.sqrt(area / 1.35);
  const length = area / width;
  const perimeter = 2 * (width + length);
  const externalGross = perimeter * 2.8;
  const externalNet = externalGross * 0.84;
  const internalFaces = area * 0.62 * 2.8 * 2;
  const wetWall = 1 * 18 + 1 * 12 + 1 * 8;
  const painting = Math.max(0, internalFaces - (2 + 1 + 1 + 1) * 1.68 - wetWall) + externalNet;
  const roof = area * 1.22;
  const concreteFoundation = area * 0.055;
  const concreteStructure = area * 0.085;
  const checks = [
    [pack.geometry.footprintAreaM2, area, 1, "area de piso"],
    [pack.geometry.externalPerimeterM, perimeter, 1, "perimetro"],
    [pack.geometry.externalWallGrossM2, externalGross, 1, "parede externa bruta"],
    [pack.geometry.externalWallNetM2, externalNet, 1, "parede externa liquida"],
    [pack.geometry.internalWallFacesM2, internalFaces, 1, "paredes internas"],
    [qty(pack, "pintura_interna") + qty(pack, "pintura_externa"), painting, 10, "pintura"],
    [qty(pack, "cobertura"), roof, 1, "cobertura"],
    [qty(pack, "esquadrias_portas"), 6, 10, "portas"],
    [qty(pack, "esquadrias_janelas"), 6, 10, "janelas"],
    [qty(pack, "pontos_eletricos"), 32, 10, "pontos eletricos"],
    [qty(pack, "pontos_hidraulicos"), 7, 10, "pontos hidraulicos"],
    [qty(pack, "revestimento_areas_molhadas"), wetWall, 1, "revestimentos"],
    [qty(pack, "impermeabilizacao_areas_molhadas"), 16.5, 1, "impermeabilizacao"],
    [qty(pack, "fundacao_concreto"), concreteFoundation, 1, "concreto fundacao"],
    [qty(pack, "estrutura_concreto"), concreteStructure, 1, "concreto estrutura"]
  ];
  for (const [elo, expected, maxDiff, label] of checks) assert.ok(percentDiff(elo, expected) <= maxDiff, label + " fora do desvio: " + percentDiff(elo, expected));
});

test("casa 7x10 usa dimensoes informadas e casa 80 m2 usa retangulo equivalente", () => {
  const casa70 = runCase(CASES.casa70).pack;
  const casa80 = runCase(CASES.casa80).pack;
  assert.equal(casa70.geometry.source, "informed_dimensions");
  assert.equal(casa70.geometry.widthM, 7);
  assert.equal(casa70.geometry.lengthM, 10);
  assert.equal(casa70.geometry.builtAreaM2, 70);
  assert.equal(casa80.geometry.source, "inferred_from_built_area");
  assert.ok(casa80.geometry.widthM > 0 && casa80.geometry.lengthM > 0);
});

test("escala 80 m2 versus 120 m2 cresce coerente sem perimetro linear por area", () => {
  const casa80 = runCase(CASES.casa80).pack;
  const casa120 = runCase(CASES.casa120).pack;
  assert.equal(qty(casa120, "piso_interno"), 120);
  assert.ok(casa120.geometry.externalPerimeterM > casa80.geometry.externalPerimeterM);
  assert.ok(casa120.geometry.externalPerimeterM / casa80.geometry.externalPerimeterM < 120 / 80);
  assert.ok(qty(casa120, "alvenaria_interna") > qty(casa80, "alvenaria_interna"));
  assert.ok(qty(casa120, "cobertura") > qty(casa80, "cobertura"));
  assert.ok(qty(casa120, "pontos_eletricos") > qty(casa80, "pontos_eletricos"));
  assert.ok(qty(casa120, "estrutura_concreto") > qty(casa80, "estrutura_concreto"));
});

test("sobrado 160 m2 diferencia cobertura laje intermediaria escada e pavimentos", () => {
  const sobrado = runCase(CASES.sobrado160).pack;
  const terrea = runCase("Quero orcamento residencial preliminar para casa terrea de 160 m2 em Salvador/BA, padrao medio, estrutura convencional, alvenaria ceramica, cobertura em telha ceramica, tres quartos, uma suite, banheiro social, lavabo, sala, cozinha, area de servico, garagem e varanda. Pode gerar.").pack;
  assert.equal(sobrado.geometry.floors, 2);
  assert.equal(sobrado.geometry.builtAreaM2, 160);
  assert.equal(sobrado.geometry.footprintAreaM2, 80);
  assert.equal(qty(sobrado, "piso_interno"), 160);
  assert.ok(qty(sobrado, "cobertura") < qty(terrea, "cobertura"));
  assert.ok(qty(sobrado, "laje_intermediaria") > 0);
  assert.equal(qty(sobrado, "escada_concreto"), 1);
  assert.ok(sobrado.calculationMemory.some((line) => /Laje intermediaria|Escada/.test(line)));
});

test("tres banheiros alteram areas molhadas instalacoes loucas metais e esquadrias", () => {
  const one = runCase(CASES.umBanheiro).pack;
  const three = runCase(CASES.tresBanheiros).pack;
  for (const serviceId of ["impermeabilizacao_areas_molhadas", "revestimento_areas_molhadas", "piso_area_molhada", "pontos_hidraulicos", "pontos_sanitarios", "chuveiros", "loucas", "metais", "esquadrias_portas", "esquadrias_janelas"]) {
    assert.ok(qty(three, serviceId) > qty(one, serviceId), serviceId + " deveria aumentar");
  }
});

test("telha ceramica e laje impermeabilizada mudam fator de cobertura", () => {
  const tile = runCase(CASES.casa80).pack;
  const slab = runCase(CASES.laje).pack;
  assert.match(quantity(tile, "cobertura").description, /telha ceramica/i);
  assert.match(quantity(slab, "cobertura").description, /laje impermeabilizada/i);
  assert.ok(qty(slab, "cobertura") < qty(tile, "cobertura"));
});

test("alteracao de escopo registra revisao e recalcula suite cobertura esquadrias instalacoes e PDF", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();
  const first = elo.buildResponseForTest(CASES.casa80);
  const before = packageFrom(first);
  const response = elo.buildResponseForTest("Troque o piso ceramico por porcelanato 90 x 90, acrescente uma suite e mude a cobertura para laje impermeabilizada.");
  const after = packageFrom(response);
  assert.equal(calls.buildPreliminaryBudget, 2);
  assert.ok(response.revision);
  assert.equal(after.geometry.roofSystem, "laje impermeabilizada");
  assert.ok(qty(after, "cobertura") < qty(before, "cobertura"));
  assert.ok(qty(after, "esquadrias_portas") > qty(before, "esquadrias_portas"));
  assert.ok(qty(after, "pontos_hidraulicos") > qty(before, "pontos_hidraulicos"));
  assert.ok(qty(after, "loucas") > qty(before, "loucas"));
  assert.ok(response.pdfAction?.budgetDocumentData?.calculationMemory?.length >= after.quantities.length);
  assert.equal(after.priceStatus?.canTotal, false);
});

test("dados insuficientes nao chamam motor e pedido de planta continua no Cadista", () => {
  const { elo, calls } = loadAssistant();
  elo.clearBudgetRecordsForTest();
  const insufficient = elo.buildResponseForTest("Quero orcar uma casa.");
  assert.equal(insufficient.sessionIntent, "budget_v2_briefing");
  assert.equal(calls.buildPreliminaryBudget, 0);
  const { elo: cadElo, calls: cadCalls } = loadAssistant();
  cadElo.clearBudgetRecordsForTest();
  const cadista = cadElo.buildResponseForTest("Quero uma casa de 7x10, a planta.");
  assert.equal(cadista.brain, "cadista");
  assert.equal(cadista.sessionIntent, "cadista_plan_briefing");
  assert.equal(cadCalls.buildPreliminaryBudget, 0);
});