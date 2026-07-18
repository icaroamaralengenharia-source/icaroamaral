import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadWindow(files, setup) {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  if (setup) setup(sandbox.window);
  for (const file of files) {
    vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", file), "utf8"), sandbox, { filename: file });
  }
  return sandbox.window;
}

function loadResolver() {
  return loadWindow(["elo-composition-resolver.js"]).EloCompositionResolver;
}

function candidate(code, description, unit, score = 0.72) {
  return {
    code,
    description,
    unit,
    source: "SINAPI",
    score,
    reasons: ["mock"],
    composition: { code, description, unit, source: "SINAPI" }
  };
}

function fakeEngine(handler) {
  const calls = [];
  return {
    calls,
    searchOfficialCompositions(query, options) {
      calls.push({ query, options });
      return handler(query, options || {});
    }
  };
}

test("compositionSearchable false bloqueia busca e preserva item no resultado", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [
      { id: "prma-quarto", etapaId: "instalacoes", nome: "Pacote PRMA - quarto", disciplina: "prma", unidadeEsperada: "un", obrigatorio: false, termosBusca: ["prma_room_quarto_comum", "decompose_required"], compositionStatus: "decompose_required", compositionSearchable: false },
      { id: "prma-dr", etapaId: "instalacoes", nome: "DR", disciplina: "prma", unidadeEsperada: "un", obrigatorio: false, termosBusca: ["prma_dr", "pending"], compositionStatus: "pending", compositionSearchable: false },
      { id: "prma-reservatorio", etapaId: "instalacoes", nome: "Reservatorio 1000 L", disciplina: "prma", unidadeEsperada: "un", obrigatorio: true, termosBusca: ["caixa d agua 1000 litros fornecimento instalacao"], compositionStatus: "auto_resolve", compositionSearchable: true },
      { id: "legacy-piso", etapaId: "pisos", nome: "piso ceramico", disciplina: "piso", unidadeEsperada: "m2", obrigatorio: true, termosBusca: ["piso ceramico"] }
    ]
  };
  const engine = fakeEngine((query, options) => {
    if (/caixa d agua/.test(query)) return { found: true, candidates: [candidate("102607", "caixa d agua 1000 litros fornecimento instalacao", options.unit)] };
    if (/piso ceramico/.test(query)) return { found: true, candidates: [candidate("87248", "piso ceramico assentado", options.unit)] };
    throw new Error("busca inesperada: " + query);
  });
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine });

  assert.equal(engine.calls.length, 2);
  assert.deepEqual(engine.calls.map((call) => call.query), ["caixa d agua 1000 litros fornecimento instalacao", "piso ceramico"]);
  assert.equal(result.resolvedItems.length, 2);
  assert.equal(result.unresolvedItems.length, 2);

  const skippedQuarto = result.unresolvedItems.find((item) => item.eapItemId === "prma-quarto");
  const skippedDr = result.unresolvedItems.find((item) => item.eapItemId === "prma-dr");
  assert.ok(skippedQuarto);
  assert.ok(skippedDr);
  [skippedQuarto, skippedDr].forEach((item) => {
    assert.equal(item.searchSkippedReason, "composition_search_disabled");
    assert.equal(item.motivoEscolha, "composition_search_disabled");
    assert.equal(item.candidatos.length, 0);
    assert.equal(item.composicaoSelecionada, null);
    assert.equal(item.confianca, 0);
    assert.equal(item.compositionSearchable, false);
    assert.equal(item.obrigatorio, false);
  });
  assert.equal(skippedQuarto.compositionStatus, "decompose_required");
  assert.equal(skippedDr.compositionStatus, "pending");
  assert.equal(result.resolvedItems.find((item) => item.eapItemId === "prma-reservatorio").compositionStatus, "auto_resolve");
  assert.equal(result.resolvedItems.find((item) => item.eapItemId === "legacy-piso").compositionStatus, undefined);
});

test("casa 80m2 resolve composicoes por item da EAP sem buscar obra inteira", () => {
  const win = loadWindow(["elo-budget-eap-engine.js", "elo-composition-resolver.js"]);
  const eap = win.EloBudgetEapEngine.buildEloBudgetEap({
    tipo: "casa",
    areaConstruidaM2: 80,
    ambientes: { banheiros: 2, cozinha: 1 },
    uf: "BA"
  });
  const engine = fakeEngine((query, options) => {
    if (/limpeza terreno/.test(query)) return { found: true, candidates: [candidate("98524", "limpeza manual de terreno", options.unit)] };
    if (/locacao de obra/.test(query)) return { found: true, candidates: [candidate("99059", "locacao convencional de obra", options.unit)] };
    return { found: false, candidates: [], reason: "no_match" };
  });
  const result = win.EloCompositionResolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine, maxCandidates: 5 });

  assert.ok(engine.calls.length > 10);
  assert.ok(engine.calls.every((call) => !/casa terrea 80m2/.test(call.query)));
  assert.ok(result.resolvedItems.length > 0);
  assert.ok(result.unresolvedItems.length > 0);
});

test("item sem candidato confiavel nao inventa composicao e bloqueia completo", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [{ id: "x1", etapaId: "fundacao", nome: "sapata isolada", disciplina: "fundacao", unidadeEsperada: "m3", obrigatorio: true, termosBusca: ["sapata isolada"] }]
  };
  const engine = fakeEngine(() => ({ found: false, candidates: [], reason: "no_official_composition_found" }));
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine });

  assert.equal(result.resolvedItems.length, 0);
  assert.equal(result.unresolvedItems.length, 1);
  assert.equal(result.unresolvedItems[0].composicaoSelecionada, null);
  assert.equal(result.podeFecharOrcamentoCompleto, false);
});

test("unidade incompativel reduz confianca e nao seleciona automaticamente item obrigatorio", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [{ id: "x2", etapaId: "pintura", nome: "pintura interna", disciplina: "pintura", unidadeEsperada: "m2", obrigatorio: true, termosBusca: ["pintura interna"] }]
  };
  const engine = fakeEngine(() => ({ found: true, candidates: [candidate("88489", "pintura interna parede", "un", 0.95)] }));
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine });

  assert.equal(result.resolvedItems.length, 0);
  assert.equal(result.unresolvedItems.length, 1);
  assert.equal(result.unresolvedItems[0].motivoEscolha, "unidade_incompativel");
  assert.ok(result.unresolvedItems[0].candidatos[0].confianca < 0.95);
});

test("item obrigatorio sem composicao mantem podeFecharOrcamentoCompleto false", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [
      { id: "ok", etapaId: "piso", nome: "piso ceramico", disciplina: "piso", unidadeEsperada: "m2", obrigatorio: true, termosBusca: ["piso ceramico"] },
      { id: "pendente", etapaId: "instalacoes", nome: "caixa sifonada", disciplina: "instalacoes", unidadeEsperada: "un", obrigatorio: true, termosBusca: ["caixa sifonada"] }
    ]
  };
  const engine = fakeEngine((query, options) => /piso/.test(query)
    ? { found: true, candidates: [candidate("87248", "piso ceramico assentado", options.unit)] }
    : { found: false, candidates: [], reason: "no_match" });
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine });

  assert.equal(result.resolvedItems.length, 1);
  assert.equal(result.unresolvedItems.length, 1);
  assert.equal(result.podeFecharOrcamentoCompleto, false);
});

test("respeita maxCandidates", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [{ id: "x3", etapaId: "piso", nome: "piso ceramico", disciplina: "piso", unidadeEsperada: "m2", obrigatorio: false, termosBusca: ["piso ceramico"] }]
  };
  const many = [1, 2, 3, 4, 5].map((index) => candidate(`87${index}`, `piso ceramico ${index}`, "m2", 0.7 + index / 100));
  const engine = fakeEngine(() => ({ found: true, candidates: many }));
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine, maxCandidates: 2 });

  assert.equal(engine.calls[0].options.limit, 2);
  assert.equal(result.resolvedItems[0].candidatos.length, 2);
});

test("mantem auxiliaresDetectadas como array vazio", () => {
  const resolver = loadResolver();
  const eap = {
    bloqueadores: [],
    itens: [{ id: "x4", etapaId: "pintura", nome: "pintura externa", disciplina: "pintura", unidadeEsperada: "m2", obrigatorio: false, termosBusca: ["pintura externa"] }]
  };
  const engine = fakeEngine((query, options) => ({ found: true, candidates: [candidate("88423", "pintura externa", options.unit)] }));
  const result = resolver.resolveEloEapCompositions({ eap, compositionSearchEngine: engine });

  assert.ok(Array.isArray(result.resolvedItems[0].auxiliaresDetectadas));
  assert.equal(result.resolvedItems[0].auxiliaresDetectadas.length, 0);
});

test("BudgetEngine inclui compositionResolution sem quebrar fluxo antigo", () => {
  const win = loadWindow([
    "stock-ai-composition-engine.js",
    "composition-search-engine.js",
    "elo-budget-eap-engine.js",
    "elo-composition-resolver.js",
    "elo-work-package-engine.js",
    "elo-quantity-engine.js",
    "elo-consumption-engine.js",
    "elo-budget-table-engine.js",
    "elo-budget-engine.js"
  ], (root) => {
    root.StockAiCompositionEngine = {
      getImportedOfficialBaseCatalog() {
        return [
          { code: "98524", description: "limpeza manual de terreno", unit: "m2", source: "SINAPI", isOfficial: true },
          { code: "99059", description: "locacao convencional de obra", unit: "m2", source: "SINAPI", isOfficial: true },
          { code: "87248", description: "piso ceramico assentado", unit: "m2", source: "SINAPI", isOfficial: true }
        ];
      }
    };
  });
  const budget = win.EloBudgetEngine.buildPreliminaryBudget({
    originalMessage: "casa terrea 80m2 com 2 banheiros",
    builtAreaM2: 80,
    bathrooms: 2
  }, {});

  assert.equal(budget.mode, "preliminary_budget");
  assert.ok(budget.budgetEap);
  assert.ok(budget.compositionResolution);
  assert.ok(Array.isArray(budget.compositionResolution.resolvedItems));
  assert.ok(Array.isArray(budget.compositionResolution.unresolvedItems));
});
