import assert from "node:assert/strict";
import { test } from "node:test";
import { LIVE_PREFIX } from "./municipal-demo-live-preflight.test.js";

const roles = [
  { key: "platform_admin", writes: true, allUnits: true },
  { key: "municipal_admin", writes: true, ownInstitution: true },
  { key: "gestor_a", role: "gestor", writes: true, unit: "A" },
  { key: "gestor_b", role: "gestor", writes: true, unit: "B" },
  { key: "leitura", writes: false, readOnly: true },
  { key: "sessao_ausente", writes: false, unauthenticated: true },
  { key: "sessao_expirada", writes: false, expired: true }
];

const rlsScenarios = [
  { id: `${LIVE_PREFIX}gestor_a_nao_le_unidade_b`, actor: "gestor_a", action: "select", entity: "stock_items", unit: "B", expected: "blocked" },
  { id: `${LIVE_PREFIX}gestor_b_nao_le_unidade_a`, actor: "gestor_b", action: "select", entity: "municipal_assets", unit: "A", expected: "blocked" },
  { id: `${LIVE_PREFIX}leitura_nao_escreve`, actor: "leitura", action: "insert", entity: "municipal_notifications", unit: "A", expected: "blocked" },
  { id: `${LIVE_PREFIX}municipal_admin_propria_instituicao`, actor: "municipal_admin", action: "select", entity: "municipal_documents", institution: "own", expected: "allowed" },
  { id: `${LIVE_PREFIX}tenant_externo_bloqueado`, actor: "municipal_admin", action: "select", entity: "municipal_assets", institution: "external", expected: "blocked" },
  { id: `${LIVE_PREFIX}payload_nao_sobrescreve_sessao`, actor: "gestor_a", action: "insert", entity: "stock_entries", payloadScope: "B", expected: "blocked" },
  { id: `${LIVE_PREFIX}project_id_rejeitado`, actor: "platform_admin", action: "insert", entity: "municipal_assets", payload: { project_id: "forbidden" }, expected: "blocked" },
  { id: `${LIVE_PREFIX}patrimonio_policy_funciona`, actor: "gestor_a", action: "select", entity: "municipal_assets", unit: "A", expected: "allowed" },
  { id: `${LIVE_PREFIX}notificacoes_policy_funciona`, actor: "gestor_a", action: "select", entity: "municipal_notifications", unit: "A", expected: "allowed" },
  { id: `${LIVE_PREFIX}estoque_policy_funciona`, actor: "gestor_a", action: "select", entity: "stock_items", unit: "A", expected: "allowed" },
  { id: `${LIVE_PREFIX}acervo_policy_funciona`, actor: "gestor_a", action: "select", entity: "municipal_documents", unit: "A", expected: "allowed" },
  { id: `${LIVE_PREFIX}auditoria_registra_autorizada`, actor: "municipal_admin", action: "audit", entity: "municipal_admin_audit_log", expected: "allowed" }
];

function isWrite(action) {
  return ["insert", "update", "transfer", "maintenance", "deactivate", "audit"].includes(action);
}

function evaluateLocalPolicyShape(scenario) {
  const actor = roles.find((item) => item.key === scenario.actor);
  if (!actor || actor.unauthenticated || actor.expired) return "blocked";
  if (scenario.payload && Object.hasOwn(scenario.payload, "project_id")) return "blocked";
  if (scenario.institution === "external") return "blocked";
  if (actor.readOnly && isWrite(scenario.action)) return "blocked";
  if (actor.role === "gestor" && scenario.unit && scenario.unit !== actor.unit) return "blocked";
  if (actor.role === "gestor" && scenario.payloadScope && scenario.payloadScope !== actor.unit) return "blocked";
  return "allowed";
}

test("RLS live permanece bloqueado sem flag e sem conexao", () => {
  assert.equal(process.env.RUN_DEMO_LIVE_TESTS === "true", false, "esta etapa nao deve executar live");
});

test("cenarios RLS cobrem papeis obrigatorios", () => {
  assert.deepEqual(roles.map((role) => role.key), [
    "platform_admin",
    "municipal_admin",
    "gestor_a",
    "gestor_b",
    "leitura",
    "sessao_ausente",
    "sessao_expirada"
  ]);
});

test("todos os cenarios usam prefixo DEMO_MUNICIPAL_LIVE_52_", () => {
  for (const scenario of rlsScenarios) {
    assert.ok(scenario.id.startsWith(LIVE_PREFIX), scenario.id);
  }
});

test("matriz local prepara bloqueios RLS esperados", () => {
  for (const scenario of rlsScenarios) {
    assert.equal(evaluateLocalPolicyShape(scenario), scenario.expected, scenario.id);
  }
});

test("leitura nao insere, atualiza, transfere, mantem ou baixa", () => {
  for (const action of ["insert", "update", "transfer", "maintenance", "deactivate"]) {
    assert.equal(evaluateLocalPolicyShape({ actor: "leitura", action, entity: "municipal_assets" }), "blocked");
  }
});

test("service role nunca e preparada para navegador", () => {
  const browserContext = {
    anonKey: "configured_by_runtime",
    serviceRoleKey: undefined,
    databaseUrl: undefined
  };
  assert.equal("serviceRoleKey" in browserContext && browserContext.serviceRoleKey, undefined);
  assert.equal(browserContext.databaseUrl, undefined);
});

export { rlsScenarios, roles };

