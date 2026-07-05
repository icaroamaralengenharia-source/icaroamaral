import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-parametric-composition-engine.js"), "utf8"), sandbox);
  return sandbox.window.EloParametricCompositionEngine;
}

function byId(list, id) {
  return list.find((item) => item.id === id);
}

test("BCP pergunta parametros obrigatorios antes de calcular viga baldrame", () => {
  const engine = loadEngine();
  const result = engine.calculateFromText("viga baldrame 20x30");

  assert.equal(result.status, "needs_parameters");
  assert.equal(result.recipe, "viga_baldrame");
  assert.ok(result.missingParameters.includes("lengthM"));
  assert.ok(result.missingParameters.includes("fckMpa"));
  assert.ok(result.missingParameters.includes("steelRateKgM3"));
  assert.match(result.questions.join(" "), /comprimento total/i);
  assert.match(result.questions.join(" "), /fck/i);
  assert.match(result.questions.join(" "), /taxa de aco/i);
});

test("BCP calcula parede 20x2,80 com EAP e lista de compras consolidada", () => {
  const engine = loadEngine();
  const result = engine.calculateFromText("Quero construir uma parede de 20x2,80", {
    blockType: "bloco ceramico 14x19x29",
    faces: 2
  });

  assert.equal(result.status, "ready");
  assert.equal(result.recipe, "parede_alvenaria");
  assert.deepEqual(Array.from(result.eap), [
    "Marcacao e prumo",
    "Assentamento de alvenaria",
    "Argamassa de assentamento",
    "Chapisco",
    "Emboco/reboco",
    "Limpeza final"
  ]);
  assert.equal(result.quantities.find((item) => item.item === "Area liquida de alvenaria").quantity, 56);
  assert.equal(byId(result.shoppingList, "bloco_ceramico").quantity, 982);
  assert.ok(byId(result.shoppingList, "cimento_50kg").quantity > 0);
  assert.ok(byId(result.shoppingList, "areia_media").quantity > 0);
  assert.equal(byId(result.shoppingList, "bloco_ceramico").wastePercent, 5);
  assert.equal(byId(result.shoppingList, "cimento_50kg").wastePercent, 10);
});

test("BCP calcula sapata isolada com regra do 100 por cento", () => {
  const engine = loadEngine();
  const result = engine.calculate({
    recipe: "sapata_isolada",
    quantity: 4,
    widthM: 0.6,
    lengthM: 0.6,
    heightM: 0.3,
    fckMpa: 25,
    steelRateKgM3: 80
  });

  assert.equal(result.status, "ready");
  assert.deepEqual(Array.from(result.eap), [
    "Escavacao manual",
    "Lastro de concreto magro",
    "Forma de madeira",
    "Armacao de aco",
    "Concreto estrutural",
    "Reaterro compactado"
  ]);
  assert.equal(result.quantities.find((item) => item.item === "Concreto estrutural fck 25 MPa").quantity, 0.432);
  assert.equal(result.quantities.find((item) => item.item === "Armacao de aco").quantity, 34.56);
  assert.ok(byId(result.shoppingList, "cimento_50kg").quantity >= 4);
  assert.ok(byId(result.shoppingList, "aco_ca50").quantity > 30);
});

test("BCP calcula viga baldrame de secao variavel", () => {
  const engine = loadEngine();
  const result = engine.calculate({
    recipe: "viga_baldrame",
    lengthM: 20,
    widthM: 0.2,
    heightM: 0.3,
    fckMpa: 25,
    steelRateKgM3: 90
  });

  assert.equal(result.status, "ready");
  assert.equal(result.quantities.find((item) => item.item === "Concreto estrutural fck 25 MPa").quantity, 1.2);
  assert.equal(result.quantities.find((item) => item.item === "Armacao de aco").quantity, 108);
  assert.equal(result.eap.includes("Impermeabilizacao superior quando aplicavel"), true);
});

test("BCP calcula piso ceramico com contrapiso, colante e rejunte", () => {
  const engine = loadEngine();
  const result = engine.calculate({
    recipe: "piso_ceramico",
    areaM2: 12,
    contrapisoThicknessCm: 3,
    tileBoxM2: 2.2
  });

  assert.equal(result.status, "ready");
  assert.equal(result.quantities.find((item) => item.item === "Contrapiso").quantity, 0.36);
  assert.equal(result.quantities.find((item) => item.item === "Piso ceramico com perda").quantity, 12.6);
  assert.equal(byId(result.shoppingList, "piso_ceramico").quantity, 6);
  assert.equal(byId(result.shoppingList, "argamassa_colante_20kg").quantity, 4);
  assert.ok(byId(result.shoppingList, "rejunte_kg").quantity > 0);
});

test("BCP calcula instalacao de porta com folha, marco e ferragens", () => {
  const engine = loadEngine();
  const result = engine.calculate({
    recipe: "instalacao_porta",
    quantity: 2,
    widthM: 0.8,
    heightM: 2.1
  });

  assert.equal(result.status, "ready");
  assert.equal(byId(result.shoppingList, "folha_porta").quantity, 2);
  assert.equal(byId(result.shoppingList, "kit_marco").quantity, 2);
  assert.equal(byId(result.shoppingList, "dobradica").quantity, 6);
  assert.equal(byId(result.shoppingList, "fechadura").quantity, 2);
  assert.equal(byId(result.shoppingList, "alizar_guarnicao").quantity, 10.4);
});

