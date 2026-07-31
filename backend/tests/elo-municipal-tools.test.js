import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore } from "../src/municipal-admin-service.js";
import { createEloMunicipalTools } from "../src/elo-municipal-tools.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId ?? "inst-a",
    role,
    profile: Object.assign({
      id: role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId ?? "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: "active"
    }, overrides.profile || {})
  };
}

function setup(extra = {}) {
  const seed = Object.assign({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", status: "active" },
      { id: "inst-b", name: "Prefeitura B", status: "active" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Central A", status: "active" },
      { id: "unit-b", institution_id: "inst-b", name: "Central B", status: "active" }
    ],
    stock_items: [
      { id: "item-zero", institution_id: "inst-a", unit_id: "unit-a", name: "Item Zerado", minimum_quantity: 5, token: "TOKEN_NAO_SAIR" },
      { id: "item-low", institution_id: "inst-a", unit_id: "unit-a", name: "Item Baixo", minimum_quantity: 10 },
      { id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", name: "Item Normal", minimum_quantity: 5 },
      { id: "item-b", institution_id: "inst-b", unit_id: "unit-b", name: "Tenant B", minimum_quantity: 1 }
    ],
    stock_entries: [
      { id: "entry-low", item_id: "item-low", institution_id: "inst-a", unit_id: "unit-a", quantity: 4, status: "approved", source: "Compra", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "entry-ok", item_id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", quantity: 9, status: "approved", source: "Compra", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "entry-b", item_id: "item-b", institution_id: "inst-b", unit_id: "unit-b", quantity: 3, status: "approved", source: "Compra B", created_at: "2026-01-01T00:00:00.000Z" }
    ],
    stock_exits: [
      { id: "exit-low", item_id: "item-low", institution_id: "inst-a", unit_id: "unit-a", quantity: 1, purpose: "Distribuicao", destination_sector: "UBS", created_at: "2026-01-02T00:00:00.000Z" },
      { id: "exit-ok", item_id: "item-ok", institution_id: "inst-a", unit_id: "unit-a", quantity: 2, purpose: "Consumo", destination_sector: "UBS", created_at: "2026-01-03T00:00:00.000Z" },
      { id: "exit-b", item_id: "item-b", institution_id: "inst-b", unit_id: "unit-b", quantity: 1, purpose: "Tenant B", created_at: "2026-01-03T00:00:00.000Z" }
    ],
    stock_audit_log: [],
    municipal_documents: [
      { id: "doc-report", institution_id: "inst-a", unit_id: "unit-a", title: "Relatorio Mensal", document_type: "relatorio", status: "active", current_version: 1, storage_path: "raw/secret.pdf" },
      { id: "doc-inventory", institution_id: "inst-a", unit_id: "unit-a", title: "Inventario Central", document_type: "inventario", status: "active", current_version: 1 },
      { id: "doc-b", institution_id: "inst-b", unit_id: "unit-b", title: "Documento B", document_type: "relatorio", status: "active", current_version: 1 }
    ],
    municipal_document_versions: [],
    municipal_assets: [],
    municipal_asset_history: [],
    municipal_admin_audit_log: [
      { id: "audit-a", institution_id: "inst-a", action: "stock_entry_created", target_type: "stock_entry", target_id: "entry-low", created_at: "2026-01-04T00:00:00.000Z", token_hash: "HASH_NAO_SAIR" },
      { id: "audit-b", institution_id: "inst-b", action: "stock_entry_created", target_type: "stock_entry", target_id: "entry-b", created_at: "2026-01-04T00:00:00.000Z" }
    ]
  }, extra);
  const store = createMemoryMunicipalAdminStore(seed);
  return { store, tools: createEloMunicipalTools({ store }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("consulta estoque e saldo da unidade autorizada sem expor campos sensiveis", async () => {
  const { tools } = setup();
  const stock = await tools.getStockAndBalance(ctx("gestor", { unitId: "unit-a" }), { unit_id: "unit-a" });
  assert.deepEqual(stock.map((item) => item.id).sort(), ["item-low", "item-ok", "item-zero"]);
  assert.equal(stock.find((item) => item.id === "item-low").current_quantity, 3);
  assert.equal(JSON.stringify(stock).includes("TOKEN_NAO_SAIR"), false);
});

test("bloqueia unidade externa", async () => {
  const { tools } = setup();
  await rejectsCode(tools.getStockAndBalance(ctx("gestor", { unitId: "unit-a" }), { unit_id: "unit-b" }), "unit_scope_forbidden");
});

test("lista alertas abertos do Sentinela Municipal", async () => {
  const { tools } = setup();
  const alerts = await tools.listSentinelAlerts(ctx("municipal_admin"), {});
  assert.ok(alerts.some((item) => item.rule_code === "item_zero_stock" && item.status === "open"));
  assert.ok(alerts.every((item) => item.institution_id === "inst-a"));
});

test("localiza documento do Acervo Municipal sem storage_path", async () => {
  const { tools } = setup();
  const docs = await tools.listDocuments(ctx("gestor", { unitId: "unit-a" }), {});
  assert.ok(docs.some((item) => item.title === "Relatorio Mensal"));
  assert.equal(JSON.stringify(docs).includes("storage_path"), false);
});

test("resume movimentacoes do periodo e explica reducao de saldo", async () => {
  const { tools } = setup();
  const movements = await tools.listMovements(ctx("gestor", { unitId: "unit-a" }), { date_from: "2026-01-02", date_to: "2026-01-03" });
  assert.equal(movements.some((item) => item.type === "saida" && item.item_name === "Item Baixo"), true);
  const result = await tools.answer(ctx("gestor", { unitId: "unit-a" }), "explique por que o saldo deste item caiu", {});
  assert.match(result.answer, /Resposta principal:/);
  assert.match(result.answer, /O saldo caiu pelas saidas registradas/);
  assert.match(result.answer, /Dados consultados:/);
});

test("nao mistura instituicoes e nao executa escrita", async () => {
  const { store, tools } = setup();
  const before = JSON.stringify(store.tables);
  const result = await tools.answer(ctx("municipal_admin"), "mostre acoes recentes da auditoria", {});
  assert.equal(result.answer.includes("Tenant B"), false);
  assert.equal(JSON.stringify(store.tables), before);
});

test("declara ausencia de dados", async () => {
  const { tools } = setup({ stock_items: [], stock_entries: [], stock_exits: [], municipal_documents: [], municipal_admin_audit_log: [] });
  const result = await tools.answer(ctx("municipal_admin"), "quais itens estao zerados?", {});
  assert.match(result.answer, /Nao ha itens zerados/);
  assert.match(result.answer, /0 item/);
});

test("falha parcial de ferramenta nao derruba resposta", async () => {
  const { store, tools } = setup();
  const originalList = store.list;
  store.list = async (table, filters) => {
    if (table === "municipal_documents") throw Object.assign(new Error("documents_down"), { code: "documents_down" });
    return originalList.call(store, table, filters);
  };
  const result = await tools.answer(ctx("municipal_admin"), "quais itens estao abaixo do minimo?", {});
  assert.match(result.answer, /Itens abaixo do minimo/);
  assert.ok(result.snapshot.partial_errors.some((item) => item.tool === "municipal_documents"));
});
