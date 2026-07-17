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

function volumeComposition(code, description, coefficient = 1.5) {
  return {
    code,
    description,
    unit: "m3",
    source: "SINAPI",
    inputs: [{
      code: code + "-MAT",
      name: description + " - material principal",
      type: "material",
      unit: "m3",
      coefficient,
      unitPrice: 0
    }, {
      code: code + "-MO",
      name: description + " - oficial",
      type: "labor",
      unit: "h",
      coefficient: 0.4,
      unitPrice: 0
    }]
  };
}

function roofSearch(options = {}) {
  const telha = {
    code: "SINAPI-TELHA-001",
    description: "Telhamento com telha ceramica",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "SINAPI-TELHA-001-MAT",
      name: "Telhamento com telha ceramica - material",
      type: "material",
      unit: "un",
      coefficient: 10,
      unitPrice: 0
    }, {
      code: "SINAPI-TELHA-001-MO",
      name: "Telhamento com telha ceramica - oficial",
      type: "labor",
      unit: "h",
      coefficient: 0.1,
      unitPrice: 0
    }]
  };
  const madeira = {
    code: "SINAPI-MAD-001",
    description: "Trama de madeira para telha ceramica",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "SINAPI-MAD-001-MAT",
      name: "Trama de madeira para telha ceramica - material",
      type: "material",
      unit: "un",
      coefficient: 2,
      unitPrice: 0
    }, {
      code: "SINAPI-MAD-001-MO",
      name: "Trama de madeira para telha ceramica - oficial",
      type: "labor",
      unit: "h",
      coefficient: 0.1,
      unitPrice: 0
    }]
  };
  const telhaPriced = {
    code: "SINAPI-TELHA-001",
    description: "Telhamento com telha ceramica",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "SINAPI-TELHA-001-MAT",
      name: "Telhamento com telha ceramica - material",
      type: "material",
      unit: "un",
      coefficient: 10,
      unitPrice: 2
    }, {
      code: "SINAPI-TELHA-001-MO",
      name: "Telhamento com telha ceramica - oficial",
      type: "labor",
      unit: "h",
      coefficient: 0.1,
      unitPrice: 10
    }]
  };
  const madeiraPriced = {
    code: "SINAPI-MAD-001",
    description: "Trama de madeira para telha ceramica",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "SINAPI-MAD-001-MAT",
      name: "Trama de madeira para telha ceramica - material",
      type: "material",
      unit: "un",
      coefficient: 2,
      unitPrice: 5
    }, {
      code: "SINAPI-MAD-001-MO",
      name: "Trama de madeira para telha ceramica - oficial",
      type: "labor",
      unit: "h",
      coefficient: 0.1,
      unitPrice: 10
    }]
  };
  return {
    calls: [],
    searchOfficialCompositions(query, searchOptions) {
      this.calls.push({ query, options: searchOptions });
      if (/trama de madeira/.test(query)) {
        if (options.withoutWood) return { found: false, candidates: [] };
        const composition = options.priced ? madeiraPriced : madeira;
        return { found: true, candidates: [{ code: composition.code, description: composition.description, unit: composition.unit, source: composition.source, score: 0.9, composition }] };
      }
      if (/cumeeira/.test(query)) return { found: false, candidates: [] };
      if (/telhamento/.test(query)) {
        const composition = options.priced ? telhaPriced : telha;
        return { found: true, candidates: [{ code: composition.code, description: composition.description, unit: composition.unit, source: composition.source, score: 0.95, composition }] };
      }
      return { found: false, candidates: [] };
    }
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

test("escavacao de sapata unica converte cm para m e calcula volume", () => {
  const search = searchFor(volumeComposition("SINAPI-ESC-SAP", "Escavacao manual para sapata", 2));
  const bridge = loadBridge(search);
  const result = bridge.build({ text: "Escavar 1 sapata de 80 x 80 x 60 cm" });

  assert.equal(result.service, "escavacao manual para sapata");
  assert.equal(result.quantity, 0.384);
  assert.equal(result.unit, "m3");
  assert.equal(result.dimensions.length, 0.8);
  assert.equal(result.materials[0].quantity, 0.768);
  assert.match(result.calculationMemory[0], /1 x 0,8 m x 0,8 m x 0,6 m = 0,384 m3/);
  assert.match(search.calls[0].query, /escavacao manual para sapata/i);
});

test("escavacao de varias sapatas calcula volume total", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-ESC-SAP", "Escavacao manual para sapata", 2)));
  const result = bridge.build({ text: "Escavar 8 sapatas de 80 x 80 x 60 cm" });

  assert.equal(result.quantity, 3.072);
  assert.equal(result.dimensions.count, 8);
  assert.equal(result.materials[0].quantity, 6.144);
});

test("escavacao de vala usa comprimento largura profundidade", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-ESC-VALA", "Escavacao manual de vala", 1.2)));
  const result = bridge.build({ text: "Escavacao de vala de 12 x 0,40 x 0,60 m" });

  assert.equal(result.service, "escavacao manual de vala");
  assert.equal(result.quantity, 2.88);
  assert.equal(result.materials[0].quantity, 3.456);
});

test("concreto de viga baldrame por metro linear e secao", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-CONC-BAL", "Concreto para viga baldrame", 1.1)));
  const result = bridge.build({ text: "Viga baldrame com 45 m, secao 20 x 30 cm" });

  assert.equal(result.service, "concreto para viga baldrame");
  assert.equal(result.quantity, 2.7);
  assert.equal(result.materials[0].quantity, 2.97);
  assert.match(result.assumptions.join(" "), /A.o estrutural n.o inclu.do neste quantitativo/);
});

test("concreto de pilares por quantidade e altura", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-CONC-PIL", "Concreto para pilar", 1.3)));
  const result = bridge.build({ text: "Concreto para 10 pilares de secao 15 x 30 cm e 3 m de altura" });

  assert.equal(result.service, "concreto para pilar");
  assert.equal(result.quantity, 1.35);
  assert.equal(result.dimensions.count, 10);
  assert.equal(result.materials[0].quantity, 1.755);
});

test("volume direto em m3 usa quantidade informada", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-CONC", "Concreto para fundacao sapata", 1.4)));
  const result = bridge.build({ text: "Concreto para sapata com 2,5 m3" });

  assert.equal(result.quantity, 2.5);
  assert.equal(result.unit, "m3");
  assert.equal(result.materials[0].quantity, 3.5);
});

test("cinta de amarracao calcula volume e informa que aco nao esta incluido", () => {
  const bridge = loadBridge(searchFor(volumeComposition("SINAPI-CINTA", "Concreto para cinta de amarracao", 1)));
  const result = bridge.build({ text: "Cinta de amarracao com 30 m, secao 15 x 20 cm" });

  assert.equal(result.service, "concreto para cinta de amarracao");
  assert.equal(result.quantity, 0.9);
  assert.match(result.assumptions.join(" "), /A.o estrutural n.o inclu.do neste quantitativo/);
});

test("cobertura por comprimento largura e inclinacao percentual", () => {
  const bridge = loadBridge(roofSearch());
  const result = bridge.build({ text: "Cobertura ceramica para uma casa de 8 x 12 m, inclinacao de 30%." });

  assert.equal(result.service, "cobertura");
  assert.equal(result.dimensions.projectedArea, 96);
  assert.equal(result.quantity, 100.224);
  assert.equal(result.unit, "m2");
  assert.equal(result.materials.find((item) => item.name.includes("Telhamento")).quantity, 1002.24);
  assert.equal(result.materials.find((item) => item.name.includes("Trama")).quantity, 200.448);
  assert.match(result.calculationMemory.join(" "), /96 m2/);
  assert.equal(JSON.stringify(result.relatedCompositions.map((item) => item.role)), JSON.stringify(["telhamento", "estrutura_madeira"]));
});

test("cobertura com area direta sem inclinacao", () => {
  const bridge = loadBridge(roofSearch());
  const result = bridge.build({ text: "Quanto material para 120 m2 de telhado ceramico?" });

  assert.equal(result.quantity, 120);
  assert.equal(result.dimensions.projectedArea, 120);
  assert.equal(result.dimensions.slopeFactor, 1);
});

test("cobertura com inclinacao em graus", () => {
  const bridge = loadBridge(roofSearch());
  const result = bridge.build({ text: "Telhado ceramico de 10 x 8 m com inclinacao de 30 graus" });

  assert.equal(result.dimensions.projectedArea, 80);
  assert.equal(result.dimensions.slopeFactor, 1.155);
  assert.equal(result.quantity, 92.4);
});

test("cobertura com fator de inclinacao informado", () => {
  const bridge = loadBridge(roofSearch());
  const result = bridge.build({ text: "Telhado ceramico de 10 x 8 m com fator de inclinacao 1,08" });

  assert.equal(result.quantity, 86.4);
  assert.equal(result.dimensions.slopeFactor, 1.08);
});

test("estrutura de madeira ausente vira pendencia sem bloquear telhamento", () => {
  const bridge = loadBridge(roofSearch({ withoutWood: true }));
  const result = bridge.build({ text: "Telhado duas aguas de 10 x 8 m" });

  assert.equal(result.quantity, 80);
  assert.equal(JSON.stringify(result.relatedCompositions.map((item) => item.role)), JSON.stringify(["telhamento"]));
  assert.ok(result.pending.includes("estrutura_madeira_composition_not_found"));
  assert.equal(result.materials[0].quantity, 800);
});

test("cobertura sem preco entrega quantitativo sem inventar custo", () => {
  const bridge = loadBridge(roofSearch());
  const result = bridge.build({ text: "Telhado ceramico de 10 x 8 m" });

  assert.equal(result.pricingStatus, "unpriced");
  assert.equal(result.unitCost, null);
  assert.equal(result.totalCost, null);
});

test("cobertura com preco valido soma somente precos das composicoes", () => {
  const bridge = loadBridge(roofSearch({ priced: true }));
  const result = bridge.build({ text: "Telhado ceramico de 10 x 8 m" });

  assert.equal(result.pricingStatus, "priced");
  assert.equal(result.unitCost, 32);
  assert.equal(result.totalCost, 2560);
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

  assert.doesNotMatch(source, /13\.5|12\.5|bloco ceramico baiano 14x19x39|saco de cimento|areia media|brita 1/i);
});
