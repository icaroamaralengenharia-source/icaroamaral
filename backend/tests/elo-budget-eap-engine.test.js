import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadEap() {
  return loadWindow(["elo-budget-eap-engine.js"]).EloBudgetEapEngine;
}

function names(eap) {
  return eap.itens.map((item) => item.nome).join(" | ");
}

function itemByName(eap, name) {
  return eap.itens.find((item) => item.nome === name);
}

function detailedRoomRequirementsTotals() {
  return {
    electrical: { lightingPoints: 5, switchPoints: 5, generalOutletPoints: 12, dedicatedOutletPoints: 3, specialPoints: 1 },
    hydraulic: {
      coldWaterPoints: 6,
      hotWaterPoints: 0,
      sewagePoints: 5,
      floorDrains: 2,
      fixtures: { toilet: 2, washbasin: 2, shower: 2, sink: 1, tank: 1, washingMachine: 1 }
    }
  };
}

test("casa 80m2 gera EAP com pacotes minimos completos", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { quartos: 2, suites: 1, banheiros: 2, cozinha: 1, areaServico: 1 },
    cobertura: "telha ceramica",
    parede: "bloco ceramico",
    piso: "porcelanato",
    uf: "BA",
    padrao: "medio"
  });
  const text = names(eap);
  assert.match(text, /concreto magro/);
  assert.match(text, /viga baldrame/);
  assert.match(text, /impermeabilizacao do baldrame/);
  assert.match(text, /alvenaria de bloco/);
  assert.match(text, /eletrica embutida/);
  assert.match(text, /telhamento/);
  assert.match(text, /chapisco/);
  assert.match(text, /contrapiso/);
  assert.match(text, /portas internas/);
  assert.match(text, /vaso sanitario por banheiro/);
  assert.match(text, /pintura interna/);
  assert.match(text, /limpeza final/);
  assert.equal(eap.itens.find((item) => item.nome === "vaso sanitario por banheiro").quantidadeBase.valor, 3);
});

test("casa com roomRequirements gera EAP detalhada sem duplicar genericos equivalentes", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { quartos: 2, banheiros: 2, cozinha: 1, areaServico: 1 },
    uf: "BA",
    padrao: "medio",
    budgetPackage: { roomRequirements: { totals: detailedRoomRequirementsTotals() } }
  });

  [
    ["pontos de iluminacao", 5],
    ["interruptores", 5],
    ["tomadas de uso geral", 12],
    ["tomadas de uso especifico", 3],
    ["pontos especiais", 1]
  ].forEach(([name, expected]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "instalacoes");
    assert.equal(entry.disciplina, "eletrica");
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  [
    ["pontos de agua fria", 6, "hidraulica"],
    ["pontos de esgoto", 5, "esgoto"],
    ["ralos", 2, "esgoto"]
  ].forEach(([name, expected, discipline]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "instalacoes");
    assert.equal(entry.disciplina, discipline);
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  assert.equal(itemByName(eap, "pontos de agua quente"), undefined);

  [
    ["vasos sanitarios", 2],
    ["lavatorios", 2],
    ["chuveiros", 2],
    ["pias", 1],
    ["tanques", 1],
    ["pontos de maquina de lavar", 1]
  ].forEach(([name, expected]) => {
    const entry = itemByName(eap, name);
    assert.ok(entry, name);
    assert.equal(entry.etapaId, "loucas_metais");
    assert.equal(entry.quantidadeBase.valor, expected);
  });

  [
    "eletrica embutida",
    "hidraulica",
    "esgoto sanitario",
    "vaso sanitario por banheiro",
    "lavatorio por banheiro",
    "chuveiro por banheiro",
    "pia/cuba da cozinha",
    "tanque da area de servico quando houver"
  ].forEach((name) => assert.equal(itemByName(eap, name), undefined, name));

  assert.ok(itemByName(eap, "aguas pluviais quando aplicavel"));
  assert.ok(itemByName(eap, "testes"));
  assert.ok(itemByName(eap, "torneira cozinha"));
  assert.ok(itemByName(eap, "registros"));
  assert.equal(eap.itens.filter((item) => item.quantidadeBase && item.quantidadeBase.valor === 0).length, 0);
});

test("casa sem roomRequirements preserva EAP generica antiga", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", areaConstruidaM2: 80, ambientes: { banheiros: 2 }, uf: "BA" });
  assert.ok(itemByName(eap, "eletrica embutida"));
  assert.ok(itemByName(eap, "hidraulica"));
  assert.ok(itemByName(eap, "esgoto sanitario"));
  assert.ok(itemByName(eap, "vaso sanitario por banheiro"));
  assert.equal(itemByName(eap, "pontos de iluminacao"), undefined);
});

test("casa sem area construida bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "casa", ambientes: { banheiros: 1 }, uf: "BA" });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "area_construida"));
});

test("muro 30 x 2,20 inclui estrutura revestimento pintura e portao citado", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "muro", comprimentoM: 30, alturaM: 2.2, message: "muro com portao metalico" });
  const text = names(eap);
  assert.match(text, /escavacao/);
  assert.match(text, /fundacao\/baldrame/);
  assert.match(text, /forma/);
  assert.match(text, /aco/);
  assert.match(text, /concreto/);
  assert.match(text, /alvenaria/);
  assert.match(text, /chapisco dos dois lados/);
  assert.match(text, /reboco dos dois lados/);
  assert.match(text, /pintura dos dois lados/);
  assert.match(text, /portao metalico/);
  assert.equal(eap.itens.find((item) => item.nome === "alvenaria").quantidadeBase.valor, 66);
});

test("muro sem comprimento ou altura bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "muro", comprimentoM: 30 });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "altura_muro"));
});

test("banheiro 2x2,5 inclui reforma completa minima", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "banheiro", larguraM: 2, profundidadeM: 2.5 });
  const text = names(eap);
  assert.match(text, /demolicao de revestimento/);
  assert.match(text, /transporte\/entulho/);
  assert.match(text, /impermeabilizacao/);
  assert.match(text, /piso/);
  assert.match(text, /revestimento de parede/);
  assert.match(text, /vaso sanitario/);
  assert.match(text, /lavatorio/);
  assert.match(text, /chuveiro/);
  assert.match(text, /ralo/);
  assert.match(text, /caixa sifonada/);
  assert.match(text, /ponto de agua/);
  assert.match(text, /ponto de esgoto/);
  assert.match(text, /eletrica minima/);
  assert.match(text, /pintura de teto/);
  assert.match(text, /limpeza final/);
  assert.equal(eap.itens.find((item) => item.nome === "piso").quantidadeBase.valor, 5);
});

test("banheiro sem dimensoes bloqueia orcamento completo", () => {
  const engine = loadEap();
  const eap = engine.buildEloBudgetEap({ tipo: "banheiro" });
  assert.equal(eap.podeFecharOrcamentoCompleto, false);
  assert.ok(eap.bloqueadores.some((item) => item.id === "dimensoes_banheiro"));
});

test("nenhuma EAP com bloqueador fecha orcamento completo", () => {
  const engine = loadEap();
  [
    engine.buildEloBudgetEap({ tipo: "casa" }),
    engine.buildEloBudgetEap({ tipo: "muro" }),
    engine.buildEloBudgetEap({ tipo: "banheiro" })
  ].forEach((eap) => {
    assert.ok(eap.bloqueadores.length > 0);
    assert.equal(eap.podeFecharOrcamentoCompleto, false);
  });
});

test("BudgetEngine inclui budgetEap em modo leitura sem quebrar orcamento preliminar", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-budget-eap-engine.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-budget-engine.js"
  ]);
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({
    originalMessage: "casa terrea 80m2 com 2 banheiros, cozinha e area de servico",
    builtAreaM2: 80,
    bathrooms: 2
  }, {});
  assert.equal(budget.mode, "preliminary_budget");
  assert.ok(budget.budgetEap);
  assert.ok(budget.budgetEap.itens.length > 20);
  assert.equal(budget.budgetEap.podeFecharOrcamentoCompleto, false);
});
