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

function areaComposition(code, description, coefficient = 2) {
  return {
    code,
    description,
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: code + "-MAT",
      name: description + " - material principal",
      type: "material",
      unit: "kg",
      coefficient,
      unitPrice: 0
    }, {
      code: code + "-MO",
      name: description + " - aplicador",
      type: "labor",
      unit: "h",
      coefficient: 0.1,
      unitPrice: 0
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

test("piso com area direta usa composicao por m2", () => {
  const search = searchFor(areaComposition("SINAPI-PISO-001", "Revestimento ceramico para piso", 2.5));
  const bridge = loadBridge(search);
  const result = bridge.build({ text: "Qual material para 40 m2 de piso ceramico?" });

  assert.equal(result.service, "revestimento ceramico para piso");
  assert.equal(result.quantity, 40);
  assert.equal(result.materials[0].quantity, 100);
  assert.match(search.calls[0].query, /revestimento ceramico para piso/i);
});

test("piso com comprimento e largura calcula area", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-PISO-002", "Revestimento ceramico para piso", 1.8)));
  const result = bridge.build({ text: "Piso ceramico em ambiente com 5 metros de comprimento e 4 metros de largura" });

  assert.equal(result.quantity, 20);
  assert.equal(result.dimensions.length, 5);
  assert.equal(result.dimensions.width, 4);
  assert.equal(result.materials[0].quantity, 36);
});

test("reboco com comprimento e altura calcula area", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-REB-001", "Reboco emboco massa unica em parede", 3)));
  const result = bridge.build({ text: "Vou rebocar uma parede de 12 x 2,80" });

  assert.equal(result.service, "reboco emboco massa unica em parede");
  assert.equal(result.quantity, 33.6);
  assert.equal(result.materials[0].quantity, 100.8);
});

test("pintura com area direta calcula consumo", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-PINT-001", "Pintura latex acrilica em paredes", 0.22)));
  const result = bridge.build({ text: "Quanto material para pintar 180 m2?" });

  assert.equal(result.service, "pintura latex acrilica em paredes");
  assert.equal(result.quantity, 180);
  assert.equal(result.materials[0].quantity, 39.6);
});

test("contrapiso com dimensao calcula area", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-CONTRA-001", "Contrapiso piso cimentado regularizacao", 4)));
  const result = bridge.build({ text: "Contrapiso em um ambiente de 5 x 4" });

  assert.equal(result.service, "contrapiso piso cimentado regularizacao");
  assert.equal(result.quantity, 20);
  assert.equal(result.materials[0].quantity, 80);
});

test("chapisco com area direta calcula consumo", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-CHAP-001", "Chapisco aplicado em alvenaria", 1.1)));
  const result = bridge.build({ text: "Material para chapisco em 25 m2" });

  assert.equal(result.service, "chapisco aplicado em alvenaria");
  assert.equal(result.quantity, 25);
  assert.equal(result.materials[0].quantity, 27.5);
});

test("emboco com area direta usa cadeia de reboco massa unica", () => {
  const bridge = loadBridge(searchFor(areaComposition("SINAPI-EMB-001", "Emboco massa unica em parede", 2.2)));
  const result = bridge.build({ text: "Quanto material para emboco em 30 m2?" });

  assert.equal(result.service, "reboco emboco massa unica em parede");
  assert.equal(result.quantity, 30);
  assert.equal(result.materials[0].quantity, 66);
});

test("revestimento ceramico de parede usa termo tecnico especifico", () => {
  const search = searchFor(areaComposition("SINAPI-REV-001", "Revestimento ceramico parede interna", 1.4));
  const bridge = loadBridge(search);
  const result = bridge.build({ text: "Revestimento ceramico em parede interna com 15 m2" });

  assert.equal(result.service, "revestimento ceramico parede interna");
  assert.equal(result.quantity, 15);
  assert.equal(result.materials[0].quantity, 21);
  assert.match(search.calls[0].query, /revestimento ceramico parede interna/i);
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
