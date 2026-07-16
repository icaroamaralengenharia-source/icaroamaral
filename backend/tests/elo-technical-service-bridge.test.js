import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadBridge(searchEngine) {
  const sandbox = { console, window: { CompositionSearchEngine: searchEngine || notFoundSearch() } };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  for (const file of ["elo-consumption-engine.js", "elo-technical-service-bridge.js"]) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window.EloTechnicalServiceBridge;
}

function notFoundSearch() {
  return {
    calls: [],
    searchOfficialCompositions(query, options) {
      this.calls.push({ query, options });
      return { found: false, candidates: [] };
    }
  };
}

function searchFor(composition) {
  return {
    calls: [],
    searchOfficialCompositions(query, options) {
      this.calls.push({ query, options });
      return {
        found: true,
        candidates: [{
          code: composition.code,
          description: composition.description,
          unit: composition.unit,
          source: composition.source,
          score: 0.97,
          reasons: ["mock compatível"],
          composition
        }]
      };
    }
  };
}

function composition(priceMode = "none") {
  const priced = priceMode === "priced";
  return {
    code: "SINAPI-ALV-001",
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "MAT-BLOCO",
      name: "Bloco ceramico de vedacao",
      type: "material",
      unit: "un",
      coefficient: 13.5,
      unitPrice: priced ? 2 : 0
    }, {
      code: "MO-PED",
      name: "Pedreiro",
      type: "labor",
      unit: "h",
      coefficient: 0.6,
      unitPrice: priced ? 30 : 0
    }, {
      code: "EQ-BET",
      name: "Betoneira",
      type: "equipment",
      unit: "h",
      coefficient: 0.05,
      unitPrice: priced ? 100 : 0
    }]
  };
}

test("parede 30 x 2,80 m resulta em 84 m2 e usa coeficientes da composicao", () => {
  const search = searchFor(composition());
  const bridge = loadBridge(search);
  const result = bridge.build({ text: "Quero fazer uma parede com bloco ceramico baiano, 30 metros de comprimento e 2,80 metros de altura. Qual material necessario?" });

  assert.equal(result.quantity, 84);
  assert.equal(result.unit, "m2");
  assert.equal(result.composition.code, "SINAPI-ALV-001");
  assert.equal(result.materials[0].quantity, 1134);
  assert.equal(result.materials[0].coefficient, 13.5);
  assert.equal(result.pricingStatus, "unpriced");
  assert.equal(result.unitCost, null);
  assert.equal(result.totalCost, null);
  assert.equal(search.calls[0].options.unit, "m2");
});

test("servico informado diretamente em m2", () => {
  const bridge = loadBridge(searchFor(composition()));
  const result = bridge.build({ text: "Preciso de material para alvenaria de bloco ceramico em 42 m2" });

  assert.equal(result.quantity, 42);
  assert.equal(result.dimensions.area, 42);
  assert.equal(result.materials[0].quantity, 567);
});

test("dimensao ausente gera bloqueio claro", () => {
  const search = notFoundSearch();
  const bridge = loadBridge(search);
  const result = bridge.build({ text: "Quero fazer uma parede de bloco ceramico" });

  assert.equal(result.pricingStatus, "blocked_missing_quantity");
  assert.equal(JSON.stringify(result.warnings), JSON.stringify(["quantity_missing"]));
  assert.equal(search.calls.length, 0);
});

test("composicao ausente gera bloqueio claro", () => {
  const bridge = loadBridge(notFoundSearch());
  const result = bridge.build({ text: "Quero executar servico xyz em 10 m2", service: "servico xyz" });

  assert.equal(result.pricingStatus, "blocked_composition_not_found");
  assert.equal(JSON.stringify(result.warnings), JSON.stringify(["composition_not_found"]));
});

test("composicao sem preco entrega quantitativo sem inventar custo", () => {
  const bridge = loadBridge(searchFor(composition("none")));
  const result = bridge.build({ text: "Alvenaria de bloco ceramico com 10 m2" });

  assert.equal(result.pricingStatus, "unpriced");
  assert.equal(result.unitCost, null);
  assert.equal(result.totalCost, null);
  assert.equal(result.materials[0].quantity, 135);
});

test("composicao com preco entrega custo unitario e total", () => {
  const bridge = loadBridge(searchFor(composition("priced")));
  const result = bridge.build({ text: "Alvenaria de bloco ceramico com 10 m2" });

  assert.equal(result.pricingStatus, "priced");
  assert.equal(result.unitCost, 50);
  assert.equal(result.totalCost, 500);
});

test("materiais mao de obra e equipamentos permanecem separados", () => {
  const bridge = loadBridge(searchFor(composition("priced")));
  const result = bridge.build({ text: "Alvenaria de bloco ceramico com 10 m2" });

  assert.equal(JSON.stringify(result.materials.map((item) => item.name)), JSON.stringify(["Bloco ceramico de vedacao"]));
  assert.equal(JSON.stringify(result.labor.map((item) => item.name)), JSON.stringify(["Pedreiro"]));
  assert.equal(JSON.stringify(result.equipment.map((item) => item.name)), JSON.stringify(["Betoneira"]));
});

test("ponte nao contem coeficiente especifico fixo de parede", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-service-bridge.js"), "utf8");

  assert.doesNotMatch(source, /13\.5|12\.5|bloco ceramico baiano 14x19x39/i);
});
