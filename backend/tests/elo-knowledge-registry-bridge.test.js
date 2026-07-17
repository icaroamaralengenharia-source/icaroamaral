import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    }
  };
}

function composition(code = "SINAPI-ALV-001") {
  return {
    code,
    description: "Alvenaria de vedacao com bloco ceramico",
    unit: "m2",
    source: "SINAPI",
    inputs: [{
      code: "MAT-BLOCO",
      name: "Bloco ceramico de vedacao",
      type: "material",
      unit: "un",
      coefficient: 13.5,
      unitPrice: 0
    }]
  };
}

function searchFor(compositions = [composition()]) {
  return {
    calls: [],
    searchOfficialCompositions(query, options) {
      this.calls.push({ query, options });
      return {
        found: true,
        candidates: compositions.map((item, index) => ({
          code: item.code,
          description: item.description,
          unit: item.unit,
          source: item.source,
          score: 1 - index / 10,
          composition: item
        }))
      };
    }
  };
}

function loadContext(searchEngine, options = {}) {
  const storage = memoryStorage();
  const sandbox = {
    console,
    window: {
      CompositionSearchEngine: searchEngine || searchFor(),
      localStorage: storage
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  const files = [
    ...(options.withRegistry === false ? [] : ["elo-knowledge-registry.js"]),
    "elo-consumption-engine.js",
    "elo-technical-service-bridge.js"
  ];
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return { window: sandbox.window, storage };
}

test("sinonimo confirmado expande o texto enviado a busca de composicoes", () => {
  const search = searchFor();
  const { window } = loadContext(search);
  const registry = window.EloKnowledgeRegistry.createSync({ storage: window.localStorage });

  registry.handleCommandSync("aprenda que bloco baiano significa bloco ceramico");
  registry.handleCommandSync("sim");

  const result = window.EloTechnicalServiceBridge.build({
    text: "Quero fazer uma parede com bloco baiano, 30 metros de comprimento e 2,80 metros de altura"
  });

  assert.equal(result.quantity, 84);
  assert.equal(result.composition.code, "SINAPI-ALV-001");
  assert.match(search.calls[0].query, /bloco baiano/);
  assert.match(search.calls[0].query, /bloco ceramico/);
});

test("sinonimo desativado nao e aplicado na busca", () => {
  const search = searchFor();
  const { window } = loadContext(search);
  const registry = window.EloKnowledgeRegistry.createSync({ storage: window.localStorage });

  registry.handleCommandSync("aprenda que baianinho significa termo expandido unico");
  const saved = registry.handleCommandSync("sim");
  registry.handleCommandSync("desative o aprendizado " + saved.learning.id);

  window.EloTechnicalServiceBridge.build({ text: "Parede com baianinho em 10 m2" });

  assert.doesNotMatch(search.calls[0].query, /termo expandido unico/);
});

test("sinonimo apagado nao e aplicado na busca", () => {
  const search = searchFor();
  const { window } = loadContext(search);
  const registry = window.EloKnowledgeRegistry.createSync({ storage: window.localStorage });

  registry.handleCommandSync("aprenda que baianinho significa termo expandido unico");
  const saved = registry.handleCommandSync("sim");
  registry.handleCommandSync("apague o aprendizado " + saved.learning.id);

  window.EloTechnicalServiceBridge.build({ text: "Parede com baianinho em 10 m2" });

  assert.doesNotMatch(search.calls[0].query, /termo expandido unico/);
});

test("regra tecnica confirmada nao entra na busca de composicoes", () => {
  const search = searchFor();
  const { window } = loadContext(search);
  const registry = window.EloKnowledgeRegistry.createSync({ storage: window.localStorage });

  registry.handleCommandSync("salve regra tecnica: baianinho significa termo proibido na busca");
  registry.handleCommandSync("sim");

  window.EloTechnicalServiceBridge.build({ text: "Parede com baianinho em 10 m2" });

  assert.doesNotMatch(search.calls[0].query, /termo proibido na busca/);
});

test("ranking atual permanece preservado apos expansao", () => {
  const first = composition("SINAPI-ALV-001");
  const second = composition("SINAPI-ALV-002");
  const search = searchFor([first, second]);
  const { window } = loadContext(search);
  const registry = window.EloKnowledgeRegistry.createSync({ storage: window.localStorage });

  registry.handleCommandSync("aprenda que bloco baiano significa bloco ceramico");
  registry.handleCommandSync("sim");

  const result = window.EloTechnicalServiceBridge.build({ text: "Alvenaria com bloco baiano em 12 m2" });

  assert.equal(result.composition.code, "SINAPI-ALV-001");
  assert.equal(search.calls[0].options.unit, "m2");
});

test("sem registry disponivel a ponte usa o texto original", () => {
  const search = searchFor();
  const { window } = loadContext(search, { withRegistry: false });

  const result = window.EloTechnicalServiceBridge.build({ text: "Alvenaria com bloco baiano em 12 m2" });

  assert.equal(result.composition.code, "SINAPI-ALV-001");
  assert.match(search.calls[0].query, /bloco baiano/);
});
