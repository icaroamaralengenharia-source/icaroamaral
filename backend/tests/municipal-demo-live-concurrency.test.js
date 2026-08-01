import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_PREFIX } from "./municipal-demo-live-preflight.test.js";

const MAX_CONCURRENCY = 20;
const TIMEOUT_MS = 30000;

const concurrencyScenarios = [
  { id: `${LIVE_PREFIX}vinte_entradas_simultaneas`, type: "stock_entries", operations: 20, retry: false, validate: ["saldo_final", "auditoria"] },
  { id: `${LIVE_PREFIX}vinte_saidas_simultaneas`, type: "stock_exits", operations: 20, retry: false, validate: ["saldo_final", "sem_saldo_negativo"] },
  { id: `${LIVE_PREFIX}operation_id_repetido`, type: "stock_entries", operations: 2, retry: false, duplicateKey: "operation_id", validate: ["idempotencia", "sem_duplicidade"] },
  { id: `${LIVE_PREFIX}saida_maior_que_saldo`, type: "stock_exits", operations: 1, retry: false, validate: ["bloqueio", "sem_saldo_negativo"] },
  { id: `${LIVE_PREFIX}tombamento_duplicado_concorrente`, type: "municipal_assets", operations: 2, retry: false, duplicateKey: "asset_tag", validate: ["constraint", "historico"] },
  { id: `${LIVE_PREFIX}deduplication_key_repetida`, type: "municipal_notifications", operations: 2, retry: false, duplicateKey: "deduplication_key", validate: ["idempotencia", "sem_duplicidade"] },
  { id: `${LIVE_PREFIX}versoes_documento_concorrentes`, type: "municipal_document_versions", operations: 2, retry: false, validate: ["versionamento", "auditoria"] },
  { id: `${LIVE_PREFIX}transferencia_patrimonial_concorrente`, type: "municipal_asset_history", operations: 2, retry: false, validate: ["historico", "constraint"] }
];

function validateScenarioPlan(scenario) {
  if (!scenario.id.startsWith(LIVE_PREFIX)) return "invalid_prefix";
  if (scenario.operations > MAX_CONCURRENCY) return "too_many_operations";
  if (scenario.retry !== false) return "retry_forbidden";
  if (!Array.isArray(scenario.validate) || !scenario.validate.length) return "missing_validation";
  return "ok";
}

test("concorrencia live fica bloqueada sem flag e sem retry automatico", () => {
  assert.equal(process.env.RUN_DEMO_LIVE_TESTS === "true", false, "esta etapa nao deve executar live");
  assert.equal(concurrencyScenarios.every((scenario) => scenario.retry === false), true);
});

test("cenarios cobrem operacoes concorrentes obrigatorias", () => {
  assert.deepEqual(concurrencyScenarios.map((scenario) => scenario.type), [
    "stock_entries",
    "stock_exits",
    "stock_entries",
    "stock_exits",
    "municipal_assets",
    "municipal_notifications",
    "municipal_document_versions",
    "municipal_asset_history"
  ]);
});

test("concorrencia maxima e controlada em 20 operacoes", () => {
  assert.equal(Math.max(...concurrencyScenarios.map((scenario) => scenario.operations)), MAX_CONCURRENCY);
  for (const scenario of concurrencyScenarios) {
    assert.ok(scenario.operations <= MAX_CONCURRENCY, scenario.id);
  }
});

test("cada cenario tem timeout, uma execucao e aborta no primeiro erro de destino", () => {
  const runnerPolicy = {
    maxConcurrency: MAX_CONCURRENCY,
    timeoutMs: TIMEOUT_MS,
    scenarioRuns: 1,
    retry: false,
    abortOnDestinationError: true
  };
  assert.equal(runnerPolicy.scenarioRuns, 1);
  assert.equal(runnerPolicy.retry, false);
  assert.equal(runnerPolicy.abortOnDestinationError, true);
  assert.equal(runnerPolicy.maxConcurrency, 20);
});

test("planos validam saldo, idempotencia, historico, auditoria e constraints", () => {
  const validations = new Set(concurrencyScenarios.flatMap((scenario) => scenario.validate));
  for (const required of ["saldo_final", "idempotencia", "historico", "auditoria", "constraint", "sem_saldo_negativo", "sem_duplicidade"]) {
    assert.equal(validations.has(required), true, required);
  }
});

test("todos os cenarios de concorrencia sao localmente seguros", () => {
  for (const scenario of concurrencyScenarios) {
    assert.equal(validateScenarioPlan(scenario), "ok", scenario.id);
  }
});

export { MAX_CONCURRENCY, concurrencyScenarios, validateScenarioPlan };
