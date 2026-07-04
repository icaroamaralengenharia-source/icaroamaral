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
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-construction-sequence-engine.js"), "utf8"), sandbox, { filename: "elo-construction-sequence-engine.js" });
  return sandbox.window.EloConstructionSequenceEngine;
}

test("sequencia canonica tem etapa zero e ordem fisica minima de obra residencial", () => {
  const engine = loadEngine();
  const stages = engine.getStages();
  assert.equal(stages[0].id, "premissas_projeto");
  assert.equal(stages[0].ordem, 0);
  assert.equal(stages.map((stage) => stage.id).slice(1, 6).join("|"), "servicos_preliminares|movimento_terra|fundacao|baldrame|impermeabilizacao");
  assert.ok(stages.some((stage) => stage.id === "loucas_metais"));
  assert.ok(stages.some((stage) => stage.id === "limpeza_final"));
});

test("casa 80m2 nao fecha sem fundacao instalacoes cobertura revestimentos loucas metais e limpeza", () => {
  const engine = loadEngine();
  const result = engine.analyzeConstruction({
    originalMessage: "Casa terrea de 80 m2 com 2 quartos, sala, cozinha e banheiro social."
  });
  assert.equal(result.podeFecharOrcamentoCompleto, false);
  assert.ok(result.pendentes.includes("tipo_fundacao"));
  assert.ok(result.pendentes.includes("eletrica"));
  assert.ok(result.pendentes.includes("hidraulica"));
  assert.ok(result.pendentes.includes("telhas"));
  assert.ok(result.pendentes.includes("chapisco"));
  assert.ok(result.pendentes.includes("vaso_sanitario"));
  assert.ok(result.pendentes.includes("limpeza_final"));
  assert.ok(result.bloqueadores.length > 0);
});

test("muro com portao citado preserva escavacao baldrame aco forma concreto alvenaria revestimento pintura e portao", () => {
  const engine = loadEngine();
  const result = engine.analyzeConstruction({
    originalMessage: "Muro de 30 m lineares com 2,20 m de altura e portao metalico simples."
  });
  assert.equal(result.podeFecharOrcamentoCompleto, false);
  assert.ok(result.pendentes.includes("escavacao"));
  assert.ok(result.pendentes.includes("formas"));
  assert.ok(result.pendentes.includes("aco"));
  assert.ok(result.pendentes.includes("concreto"));
  assert.ok(result.pendentes.includes("blocos_tijolos"));
  assert.ok(result.pendentes.includes("chapisco"));
  assert.ok(result.pendentes.includes("pintura_interna"));
  assert.ok(result.encontrados.includes("portao"));
  assert.equal(result.termosBuscaPorItem.portao.join("|"), "portao metalico|instalacao portao");
});

test("termos do CompositionSearchEngine sao gerados por item e nao pelo prompt inteiro", () => {
  const engine = loadEngine();
  const result = engine.analyzeConstruction({
    originalMessage: "Preciso orcar uma casa completa de 80 m2 com banheiro, cozinha e telhado ceramico."
  });
  assert.ok(Array.isArray(result.termosBuscaPorItem.concreto));
  assert.ok(result.termosBuscaPorItem.concreto.some((term) => /concreto/.test(term)));
  assert.equal(result.termosBuscaPorItem.concreto.includes("Preciso orcar uma casa completa de 80 m2 com banheiro, cozinha e telhado ceramico."), false);
  assert.ok(result.termosBuscaPorItem.piso.some((term) => /piso|argamassa|rejunte/.test(term)));
});


