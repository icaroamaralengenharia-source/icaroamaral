import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createContext, runInContext } from "node:vm";
import {
  buildEloSystemPrompt_,
  buildPathologyContext,
  buildVisionUserPrompt_,
  createApp,
  createEloVectorMemoryStore_,
  buildPrevisaoConsumoContext,
  buildAuditoriaConsumoContext,
  buildStockIaLaunchPlan,
  extractQuantidadeServico,
  extractPrevistoRealConsumo,
  findObraComposicaoContext,
  formatImageAnalysis_,
  normalizeImageAnalysis_,
  reindexEloVectorMemoryFile_,
  searchEloRelevantMemories_,
  searchPathologyKnowledge
} from "../src/app.js";

let server;
let baseUrl;
let eloVectorMemoryStore;

test("stock demo health continua funcionando", async () => {
  const response = await fetch(baseUrl + "/api/stock-demo/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.service, "Stock AI Demo Backend");
});

test("stock saude health responde com fallback local sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.module, "stock-saude");
  assert.equal(data.database, "not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock saude me retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/me");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full health responde com fallback local sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-full/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.module, "stock-full");
  assert.equal(data.database, "not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full me retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-full/me");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_full_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full me exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full me reconhece profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_();
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.module, "stock-full");
    assert.equal(data.mode, "remote");
    assert.equal(data.profile.institution_id, "inst_auth");
    assert.equal(data.profile.unit_id, "unit_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full me retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude items retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/items?institution_id=inst_teste");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock saude cria item retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      institution_id: "inst_teste",
      unit_id: "unit_teste",
      name: "Mascara cirurgica",
      unit: "un"
    })
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("frontend Stock Saude prepara autenticacao Supabase sem remover fallback local", async () => {
  const content = readFileSync(join("..", "stock-saude.js"), "utf8");

  assert.match(content, /function getStockSaudeSupabaseToken\(\)/);
  assert.match(content, /async function fetchStockSaudeMe\(\)/);
  assert.match(content, /async function initStockSaudeAuthContext\(\)/);
  assert.match(content, /\/api\/stock-saude\/me/);
  assert.match(content, /\/api\/stock-saude\/audit-log/);
  assert.match(content, /listAuditLog\(token\)/);
  assert.match(content, /Criou item/);
  assert.match(content, /Registrou entrada/);
  assert.match(content, /Registrou saida/);
  assert.match(content, /Aprovou entrada/);
  assert.match(content, /Rejeitou entrada/);
  assert.match(content, /activeHistoryFilter === "aprovacoes"/);
  assert.match(content, /activeHistoryFilter === "itens"/);
  assert.match(content, /function canStockSaudeRole\(action\)/);
  assert.match(content, /stockSaudeAuthContext\.mode !== "supabase"/);
  assert.match(content, /Seu perfil nao tem permissao para esta acao/);
  assert.match(content, /function buildStockSaudeManagerPdfHtml_\(data\)/);
  assert.match(content, /async function generateStockSaudeManagementPdf\(\)/);
  assert.match(content, /Gerar PDF Gerencial/);
  assert.match(content, /Relatorio Gerencial - Stock Saude/);
  assert.match(content, /Controle de estoque, movimentacoes, pendencias e auditoria operacional/);
  assert.match(content, /StockSaudeAPI\.getDashboard\(token\)/);
  assert.match(content, /StockSaudeAPI\.listAuditLog\(token\)/);
  assert.match(content, /\/api\/stock-saude\/invites/);
  assert.match(content, /async listInvites\(token\)/);
  assert.match(content, /async createInvite\(token, invite\)/);
  assert.match(content, /async acceptInvite\(token\)/);
  assert.match(content, /\/api\/stock-saude\/invites\/accept/);
  assert.match(content, /Convidar usuario/);
  assert.match(content, /Aceitar convite/);
  assert.match(content, /Voce foi vinculado a instituicao com sucesso/);
  assert.match(content, /stockSaudeInviteForm/);
  assert.match(content, /create_invite/);
  assert.match(content, /read_invites/);
  assert.match(content, /loadCurrentStockSaudeState\(\)/);
  assert.match(content, /window\.print\(\)/);
  assert.match(content, /async function exportStockSaudeCsv\(\)/);
  assert.match(content, /async function exportStockSaudeExcel\(\)/);
  assert.match(content, /buildStockSaudeCsvContent\(state\)/);
  assert.match(content, /buildStockSaudeExcelContent\(state\)/);
  assert.match(content, /Exportar CSV/);
  assert.match(content, /Exportar Excel/);
  assert.match(content, /stock-saude-operacional\.csv/);
  assert.match(content, /stock-saude-operacional\.xls/);
  assert.match(content, /Nome", "Categoria", "Unidade", "Saldo", "Minimo", "Local/);
  assert.match(content, /Data", "Item", "Quantidade", "Status", "Responsavel/);
  assert.match(content, /Data", "Item", "Quantidade", "Responsavel/);
  assert.match(content, /Authorization: "Bearer " \+ token/);
  assert.match(content, /mode: "supabase"/);
  assert.match(content, /mode: "local"/);
  assert.match(content, /STOCK_SAUDE_DEMO_INSTITUTION_ID/);
  assert.match(content, /STOCK_SAUDE_DEMO_UNIT_ID/);
  assert.match(content, /STOCK_SAUDE_DEMO_PROFILE_ID/);
  assert.doesNotMatch(content, /console\.(?:log|info|warn|error)\([^)]*token/i);
});

test("frontend Stock Full detecta token Supabase e preserva modo local", async () => {
  const content = readFileSync(join("..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");

  assert.match(content, /function getStockFullSupabaseToken_\(\)/);
  assert.match(content, /async function fetchStockFullMe_\(\)/);
  assert.match(content, /async function initStockFullAuthContext_\(\)/);
  assert.match(content, /\/api\/stock-full\/me/);
  assert.match(content, /stockFullRuntimeMode = "local"/);
  assert.match(content, /Conectado ao Stock Full/);
  assert.match(content, /Não sincronizado na nuvem/);
  assert.doesNotMatch(content, /console\.(?:log|info|warn|error)\([^)]*token/i);
});

test("stock saude items exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria item exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Item teste", unit: "un" })
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria item valida name e unit com profile autenticado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ category: "Medicamento" })
    });
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.ok, false);
    assert.equal(data.error, "name_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria itens usando institution e unit do profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10,
        location: "Farmacia",
        expiration_date: null
      },
      {
        id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outro",
        category: "Medicamento",
        unit: "un",
        minimum_quantity: 1
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items?institution_id=forjada&unit_id=forjada", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.items.length, 1);
    assert.equal(listData.items[0].institution_id, "inst_auth");
    assert.equal(listData.items[0].unit_id, "unit_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        name: "Seringa",
        category: "Material",
        unit: "un",
        minimum_quantity: 25,
        location: "Almoxarifado"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.item.institution_id, "inst_auth");
    assert.equal(createData.item.unit_id, "unit_auth");
    assert.equal(createData.item.name, "Seringa");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao cria item", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Item leitura", unit: "un" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude entries exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude entries retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria entry valida item_id e quantidade", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const missingItemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ quantity: 10 })
    });
    const missingItemData = await missingItemResponse.json();
    assert.equal(missingItemResponse.status, 400);
    assert.equal(missingItemData.error, "item_id_required");

    const invalidQuantityResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 0 })
    });
    const invalidQuantityData = await invalidQuantityResponse.json();
    assert.equal(invalidQuantityResponse.status, 400);
    assert.equal(invalidQuantityData.error, "quantity_must_be_positive");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao registra entrada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria entries usando profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 12,
        status: "pendente",
        requested_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "entry_2",
        item_id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 3,
        status: "pendente",
        requested_by: "profile_auth",
        created_at: "2026-06-01T11:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.entries.length, 1);
    assert.equal(listData.entries[0].institution_id, "inst_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        requested_by: "forjado",
        item_id: "item_1",
        quantity: 7,
        invoice_number: "NF-TESTE"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.entry.institution_id, "inst_auth");
    assert.equal(createData.entry.unit_id, "unit_auth");
    assert.equal(createData.entry.requested_by, "profile_auth");
    assert.equal(createData.entry.status, "pendente");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia entry para item de outra instituicao", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Item externo",
        unit: "un"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_outra_inst", quantity: 5 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "item_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao registra saida", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude exits exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude exits retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria exit valida item_id e quantidade", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const missingItemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ quantity: 10 })
    });
    const missingItemData = await missingItemResponse.json();
    assert.equal(missingItemResponse.status, 400);
    assert.equal(missingItemData.error, "item_id_required");

    const invalidQuantityResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 0 })
    });
    const invalidQuantityData = await invalidQuantityResponse.json();
    assert.equal(invalidQuantityResponse.status, 400);
    assert.equal(invalidQuantityData.error, "quantity_must_be_positive");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria exits usando profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada",
        requested_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 4,
        destination_sector: "Enfermaria",
        purpose: "Reposicao",
        responsible_name: "Gestor",
        created_by: "profile_auth",
        created_at: "2026-06-01T12:00:00.000Z"
      },
      {
        id: "exit_2",
        item_id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 2,
        created_by: "profile_auth",
        created_at: "2026-06-01T13:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.exits.length, 1);
    assert.equal(listData.exits[0].institution_id, "inst_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        created_by: "forjado",
        item_id: "item_1",
        quantity: 3,
        destination_sector: "UPA Centro",
        purpose: "Atendimento"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.exit.institution_id, "inst_auth");
    assert.equal(createData.exit.unit_id, "unit_auth");
    assert.equal(createData.exit.created_by, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia exit para item de outra unidade", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        name: "Item externo",
        unit: "un"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_outra_unit", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "item_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude balance exige Authorization e ignora escopo forjado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      },
      {
        id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outro",
        category: "Medicamento",
        unit: "un",
        minimum_quantity: 1
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 5
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const unauthorizedResponse = await fetch(testServer.baseUrl + "/api/stock-saude/balance");
    const unauthorizedData = await unauthorizedResponse.json();
    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedData.error, "authentication_required");

    const response = await fetch(testServer.baseUrl + "/api/stock-saude/balance?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.balance.length, 1);
    assert.equal(data.balance[0].item_id, "item_1");
    assert.equal(data.balance[0].current_quantity, 15);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria auditoria para item, entry e exit", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Seringa", unit: "un" })
    });
    await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 2 })
    });
    await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });

    const actions = supabase.auditLogs.map((log) => log.action);
    assert.deepEqual(actions, ["item_created", "entry_created", "exit_created"]);
    supabase.auditLogs.forEach((log) => {
      assert.equal(log.institution_id, "inst_auth");
      assert.equal(log.unit_id, "unit_auth");
      assert.equal(log.profile_id, "profile_auth");
      assert.ok(log.created_at);
    });
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprovacao exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      entries: [
        {
          id: "entry_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST"
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprovacao retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia aprovacao de entrada fora do escopo", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      entries: [
        {
          id: "entry_outra_inst",
          institution_id: "outra_inst",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_outra_inst/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "entry_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role almoxarife nao aprova entrada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("almoxarife"),
      entries: [
        {
          id: "entry_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprova entrada com profile real e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente",
        requested_by: "profile_auth"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ approved_by: "forjado" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.entry.status, "aprovada");
    assert.equal(data.entry.approved_by, "profile_auth");
    assert.ok(data.entry.approved_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "approve_entry");
    assert.equal(supabase.auditLogs[0].profile_id, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role gestor aprova entrada", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("gestor"),
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.entry.status, "aprovada");
    assert.equal(data.entry.approved_by, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role administrador pode criar item entrada saida e aprovar", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("administrador"),
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_approved",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      },
      {
        id: "entry_pending",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 2,
        status: "pendente"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const itemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Seringa", unit: "un" })
    });
    assert.equal(itemResponse.status, 200);

    const entryResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 2 })
    });
    assert.equal(entryResponse.status, 200);

    const exitResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    assert.equal(exitResponse.status, 200);

    const approvalResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_pending/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    assert.equal(approvalResponse.status, 200);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role gestor cria convite", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("gestor")
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "novo@teste.local", role: "almoxarife" })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.invite.email, "novo@teste.local");
    assert.equal(createData.invite.role, "almoxarife");
    assert.equal(createData.invite.institution_id, "inst_auth");
    assert.equal(createData.invite.unit_id, "unit_auth");
    assert.equal(createData.invite.created_by, "profile_auth");
    assert.equal(createData.invite.status, "pendente");

    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listData.invites.length, 1);
    assert.equal(listData.invites[0].email, "novo@teste.local");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role administrador cria convite", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("administrador")
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "leitura@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.invite.role, "leitura");
    assert.equal(supabase.invites.length, 1);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao cria convite", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "bloqueado@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role almoxarife nao cria convite", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("almoxarife")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "bloqueado@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite retorna 404 para convite inexistente", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: null,
      user: {
        id: "auth_convidado",
        email: "sem-convite@teste.local"
      }
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.error, "stock_saude_invite_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite nao permite convite de outro email", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: null,
      user: {
        id: "auth_convidado",
        email: "usuario@teste.local"
      },
      invites: [
        {
          id: "invite_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          email: "outro@teste.local",
          role: "leitura",
          status: "pendente",
          created_by: "profile_auth",
          created_at: "2026-06-01T10:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.error, "stock_saude_invite_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite retorna profile existente sem duplicar", async () => {
  const profile = createMockStockSaudeProfile_("leitura");
  const supabase = createMockStockSaudeSupabase_({
    profile,
    user: {
      id: profile.auth_user_id,
      email: profile.email
    },
    invites: [
      {
        id: "invite_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: profile.email,
        role: "gestor",
        status: "pendente",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.profile.id, profile.id);
    assert.equal(supabase.profiles.length, 1);
    assert.equal(supabase.invites[0].status, "aceito");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite cria profile automatico e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: null,
    user: {
      id: "auth_novo",
      email: "novo@teste.local",
      user_metadata: { name: "Novo Usuario" }
    },
    invites: [
      {
        id: "invite_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: "novo@teste.local",
        role: "almoxarife",
        status: "pendente",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.profile.auth_user_id, undefined);
    assert.equal(data.profile.email, "novo@teste.local");
    assert.equal(data.profile.role, "almoxarife");
    assert.equal(data.profile.institution_id, "inst_auth");
    assert.equal(data.profile.unit_id, "unit_auth");
    assert.equal(supabase.profiles.length, 1);
    assert.equal(supabase.profiles[0].auth_user_id, "auth_novo");
    assert.equal(supabase.invites[0].status, "aceito");
    assert.ok(supabase.invites[0].accepted_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "accept_invite");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite fluxo feliz vincula convite pendente", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: null,
    user: {
      id: "auth_fluxo",
      email: "fluxo@teste.local"
    },
    invites: [
      {
        id: "invite_fluxo",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: "fluxo@teste.local",
        role: "leitura",
        status: "pending",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.profile.email, "fluxo@teste.local");
    assert.equal(data.invite.status, "aceito");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude rejeita entrada com profile real e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente",
        requested_by: "profile_auth"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/reject", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.entry.status, "rejeitada");
    assert.equal(data.entry.approved_by, "profile_auth");
    assert.ok(data.entry.approved_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "reject_entry");
    assert.equal(supabase.auditLogs[0].profile_id, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard consolida dados reais do profile", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10,
        expiration_date: "2026-07-01"
      },
      {
        id: "item_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Seringa vencida",
        category: "Material",
        unit: "un",
        minimum_quantity: 2,
        expiration_date: "2026-01-01"
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada",
        created_at: "2026-06-03T10:00:00.000Z"
      },
      {
        id: "entry_2",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 3,
        status: "pendente",
        created_at: "2026-06-04T10:00:00.000Z"
      },
      {
        id: "entry_3",
        item_id: "item_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 1,
        status: "rejeitada",
        created_at: "2026-06-04T11:00:00.000Z"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 15,
        created_at: "2026-06-04T12:00:00.000Z"
      }
    ],
    auditLogs: [
      {
        id: "audit_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        action: "item_created"
      },
      {
        id: "audit_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        action: "approve_entry"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.dashboard.totalItems, 2);
    assert.equal(data.dashboard.totalEntries, 3);
    assert.equal(data.dashboard.totalExits, 1);
    assert.equal(data.dashboard.pendingEntries, 1);
    assert.equal(data.dashboard.approvedEntries, 1);
    assert.equal(data.dashboard.rejectedEntries, 1);
    assert.equal(data.dashboard.lowStockItems, 1);
    assert.equal(data.dashboard.expiredItems, 1);
    assert.equal(data.dashboard.expiringSoonItems, 1);
    assert.equal(data.dashboard.totalBalance, 5);
    assert.equal(data.dashboard.auditCount, 2);
    assert.equal(data.dashboard.recentEntries.length, 3);
    assert.equal(data.dashboard.recentExits.length, 1);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard filtra por institution e unit do profile", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Item auth",
        unit: "un",
        minimum_quantity: 1
      },
      {
        id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outra inst",
        unit: "un",
        minimum_quantity: 1
      },
      {
        id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        name: "Outra unit",
        unit: "un",
        minimum_quantity: 1
      }
    ],
    entries: [
      {
        id: "entry_auth",
        item_id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 4,
        status: "aprovada"
      },
      {
        id: "entry_outra_unit",
        item_id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        quantity: 99,
        status: "aprovada"
      }
    ],
    exits: [
      {
        id: "exit_auth",
        item_id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 1
      },
      {
        id: "exit_outra_inst",
        item_id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 99
      }
    ],
    auditLogs: [
      {
        id: "audit_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth"
      },
      {
        id: "audit_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.dashboard.totalItems, 1);
    assert.equal(data.dashboard.totalEntries, 1);
    assert.equal(data.dashboard.totalExits, 1);
    assert.equal(data.dashboard.totalBalance, 3);
    assert.equal(data.dashboard.auditCount, 1);
    assert.equal(data.dashboard.recentEntries[0].id, "entry_auth");
    assert.equal(data.dashboard.recentExits[0].id, "exit_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log filtra escopo e ordena do mais recente", async () => {
  const supabase = createMockStockSaudeSupabase_({
    auditLogs: [
      {
        id: "audit_old",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "item_created",
        entity_type: "stock_items",
        entity_id: "item_1",
        created_at: "2026-06-02T10:00:00.000Z"
      },
      {
        id: "audit_other_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        profile_id: "profile_auth",
        action: "entry_created",
        entity_type: "stock_entries",
        entity_id: "entry_outra_unit",
        created_at: "2026-06-04T12:00:00.000Z"
      },
      {
        id: "audit_new",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "approve_entry",
        entity_type: "stock_entries",
        entity_id: "entry_1",
        created_at: "2026-06-04T11:00:00.000Z"
      },
      {
        id: "audit_other_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "exit_created",
        entity_type: "stock_exits",
        entity_id: "exit_outra_inst",
        created_at: "2026-06-04T13:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.auditLog.length, 2);
    assert.equal(data.auditLog[0].action, "approve_entry");
    assert.equal(data.auditLog[1].action, "item_created");
    assert.deepEqual(Object.keys(data.auditLog[0]).sort(), [
      "action",
      "created_at",
      "entity_id",
      "entity_type",
      "profile_id",
      "profile_name"
    ]);
    assert.equal(data.auditLog[0].profile_name, "Gestor Teste");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log retorna trilha operacional feliz", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      auditLogs: [
        {
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          profile_id: "profile_auth",
          action: "create_item",
          entity_type: "stock_entries",
          entity_id: "entry_1",
          created_at: "2026-06-04T12:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.deepEqual(data.auditLog[0], {
      profile_name: "Gestor Teste",
      action: "create_item",
      entity_type: "stock_entries",
      entity_id: "entry_1",
      profile_id: "profile_auth",
      created_at: "2026-06-04T12:00:00.000Z"
    });
  } finally {
    await closeTestServer_(testServer.server);
  }
});

before(async () => {
  eloVectorMemoryStore = createEloVectorMemoryStore_({ memoryOnly: true });
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500"
    },
    eloVectorMemoryStore
  });

  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve) => server.close(resolve));
});

test("health responde ok", async () => {
  const response = await fetch(baseUrl + "/api/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test("bloqueia action inválida", async () => {
  const response = await postAi_({
    action: "invalid",
    text: "teste",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("valida texto vazio em improve", async () => {
  const response = await postAi_({
    action: "improve",
    text: "",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("sem chave retorna erro amigável para fallback local", async () => {
  const response = await postAi_({
    action: "review",
    text: "",
    context: {
      report: {
        obra: "Obra teste"
      },
      stats: {
        fotos: 1,
        inconformidades: 0,
        riscosAltos: 0
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("análise visual exige imagem processada", async () => {
  const response = await postImage_({
    image: {},
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("análise visual sem chave retorna erro amigável", async () => {
  const response = await postImage_({
    image: {
      base64: tinyJpegBase64_(),
      mimeType: "image/jpeg",
      fileName: "teste.jpg",
      width: 1,
      height: 1
    },
    context: {
      report: {
        obra: "Obra teste"
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("elo chat exige mensagem", async () => {
  const response = await postEloChat_({
    message: "",
    history: []
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.equal(data.fallback, true);
});

test("elo chat sem chave solicita fallback local", async () => {
  const response = await postEloChat_({
    message: "Oi Elo, voce esta online?",
    history: [
      { role: "system", content: "ignorar" },
      { role: "user", content: "Ola" },
      { role: "assistant", content: "Ola, posso ajudar." }
    ],
    context: {
      source: "elo",
      mode: "standalone"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.mode, "fallback_required");
  assert.equal(data.fallback, true);
  assert.match(data.answer, /forma local/);
});

test("prompt mestre do Elo define identidade, memoria e limites", () => {
  const prompt = buildEloSystemPrompt_();

  assert.match(prompt, /Contexto ativo: Elo Geral/i);
  assert.match(prompt, /companheiro digital com memória recente/i);
  assert.match(prompt, /não é humano/i);
  assert.match(prompt, /sem parecer atendimento genérico/i);
  assert.match(prompt, /o que percebo/i);
  assert.match(prompt, /histórico recente/i);
  assert.match(prompt, /não dê diagnóstico médico, jurídico, financeiro ou psicológico/i);
  assert.match(prompt, /Eu sou o Elo/i);
  assert.match(prompt, /Sou real como sistema digital/i);
});

test("prompt mestre do Elo aplica contexto Saude", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "saude"
  });

  assert.match(prompt, /Contexto ativo: Elo Saude/i);
  assert.match(prompt, /almoxarifado hospitalar/i);
  assert.match(prompt, /lote/i);
  assert.match(prompt, /validade/i);
  assert.match(prompt, /estoque minimo/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Obras/i);
});

test("prompt mestre do Elo aplica contexto Obras", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "obras"
  });

  assert.match(prompt, /Contexto ativo: Elo Obras/i);
  assert.match(prompt, /engenharia civil/i);
  assert.match(prompt, /RDO/i);
  assert.match(prompt, /fissuras/i);
  assert.match(prompt, /estoque de obra/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Saude/i);
});

test("Elo Obras encontra base tecnica de composicoes por mensagem", () => {
  const context = findObraComposicaoContext("Quais insumos entram em piso ceramico?");

  assert.match(context, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.match(context, /Piso ceramico/i);
  assert.match(context, /Argamassa colante/i);
  assert.match(context, /Rejunte/i);
  assert.match(context, /informe a quantidade em m2/i);
  assert.doesNotMatch(context, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
});

test("Elo Obras extrai quantidade de servico", () => {
  assert.deepEqual(extractQuantidadeServico("Vou executar 250 m2 de alvenaria"), {
    quantidade: 250,
    unidade: "m2"
  });
  assert.deepEqual(extractQuantidadeServico("Vou concretar 10 m3"), {
    quantidade: 10,
    unidade: "m3"
  });
  assert.deepEqual(extractQuantidadeServico("Quanto material para 80 metros quadrados de reboco?"), {
    quantidade: 80,
    unidade: "m2"
  });
  assert.deepEqual(extractQuantidadeServico("Vou fazer 20 pontos de tomada"), {
    quantidade: 20,
    unidade: "ponto"
  });
});

test("Elo Obras calcula previsao demonstrativa de consumo", () => {
  const context = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria com bloco ceramico");

  assert.match(context, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.match(context, /Alvenaria de vedacao/i);
  assert.match(context, /Quantidade informada: 250 m2/i);
  assert.match(context, /Bloco ceramico: 6\.750 un/i);
  assert.match(context, /Argamassa de assentamento: 5 m3/i);
  assert.match(context, /Insumos sem coeficiente demonstrativo/i);
  assert.match(context, /Cimento/i);
  assert.match(context, /Stock IA/i);
  assert.match(context, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.match(context, /pendente_confirmacao/i);
  assert.match(context, /origemCalculo: coeficiente_demonstrativo/i);
  assert.match(context, /Nao lancado automaticamente no estoque/i);
});

test("Elo Obras encontra composicoes novas e respeita pendencia de coeficientes", () => {
  const chapisco = buildPrevisaoConsumoContext("Vou executar 100 m2 de chapisco");
  const pintura = buildPrevisaoConsumoContext("Vou fazer 80 m2 de pintura");
  const concreto = buildPrevisaoConsumoContext("Vou executar 10 m3 de concreto");
  const tomada = buildPrevisaoConsumoContext("Vou fazer 20 pontos de tomada");
  const aguaFria = buildPrevisaoConsumoContext("Vou fazer 15 pontos de agua fria");

  assert.match(chapisco, /Chapisco/i);
  assert.match(chapisco, /Sem coeficientes numericos demonstrativos/i);
  assert.match(chapisco, /Cimento/i);
  assert.match(chapisco, /Insumos sem coeficiente demonstrativo/i);
  assert.doesNotMatch(chapisco, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);

  assert.match(pintura, /Pintura acrilica/i);
  assert.match(pintura, /Tinta acrilica: 13,6 l/i);
  assert.match(pintura, /Selador: 8 l/i);

  assert.match(concreto, /Concretagem simples/i);
  assert.match(concreto, /Concreto: 10 m3/i);

  assert.match(tomada, /Instalacao eletrica - tomada/i);
  assert.match(tomada, /Sem coeficientes numericos demonstrativos/i);
  assert.match(tomada, /Tomada/i);
  assert.doesNotMatch(tomada, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);

  assert.match(aguaFria, /Instalacao hidraulica - ponto de agua fria/i);
  assert.match(aguaFria, /Sem coeficientes numericos demonstrativos/i);
  assert.match(aguaFria, /Tubo PVC agua fria/i);
  assert.doesNotMatch(aguaFria, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
});

test("Elo Obras prepara plano estruturado para Stock IA sem lancamento real", () => {
  const plan = buildStockIaLaunchPlan("Vou executar 250 m2 de alvenaria com bloco ceramico");

  assert.equal(plan.origem, "elo_obras");
  assert.equal(plan.tipo, "previsao_consumo");
  assert.equal(plan.status, "pendente_confirmacao");
  assert.equal(plan.servico, "Alvenaria de vedacao");
  assert.equal(plan.quantidadeServico, 250);
  assert.equal(plan.unidadeServico, "m2");
  assert.deepEqual(plan.itens[0], {
    nome: "Bloco ceramico",
    quantidade: 6750,
    unidade: "un",
    origemCalculo: "coeficiente_demonstrativo"
  });
  assert.match(plan.observacao, /Nao lancado automaticamente no estoque/i);
  assert.equal(buildStockIaLaunchPlan("Vou fazer 20 pontos de tomada"), null);
});

test("Elo Obras extrai previsto e real de consumo", () => {
  assert.deepEqual(extractPrevistoRealConsumo("Previsto 6750 blocos, consumido 8900 blocos"), {
    item: "Blocos ceramicos",
    unidade: "un",
    previsto: 6750,
    real: 8900
  });
  assert.deepEqual(extractPrevistoRealConsumo("Compare 5 m3 de argamassa previsto com 6,8 m3 consumido"), {
    item: "Argamassa",
    unidade: "m3",
    previsto: 5,
    real: 6.8
  });
  assert.deepEqual(extractPrevistoRealConsumo("Audite o consumo: previsto 100 sacos de cimento, real 132"), {
    item: "Cimento",
    unidade: "sacos",
    previsto: 100,
    real: 132
  });
});

test("Elo Obras calcula auditoria critica de consumo", () => {
  const context = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");

  assert.match(context, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(context, /Previsto: 6\.750 un/i);
  assert.match(context, /Consumido\/real: 8\.900 un/i);
  assert.match(context, /Diferenca: \+2\.150 un/i);
  assert.match(context, /Variacao: \+31,85%/i);
  assert.match(context, /Status: critico/i);
});

test("Elo Obras classifica faixas da auditoria de consumo", () => {
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 108"), /Status: atencao leve/i);
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 120"), /Status: atencao/i);
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 80"), /Status: dentro ou abaixo do previsto/i);
});

test("prompt do Elo Obras injeta base tecnica somente no contexto obras", () => {
  const composicao = findObraComposicaoContext("Quanto material preciso para 80 m2 de reboco?");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: composicao
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: composicao
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: composicao
  });

  assert.match(obrasPrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.match(obrasPrompt, /Reboco/i);
  assert.match(obrasPrompt, /informe a quantidade em m2/i);
  assert.doesNotMatch(saudePrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.doesNotMatch(geralPrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
});

test("prompt do Elo Obras injeta previsao calculada somente no contexto obras", () => {
  const previsao = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: previsao
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: previsao
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: previsao
  });

  assert.match(obrasPrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.match(obrasPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.match(obrasPrompt, /Bloco ceramico: 6\.750 un/i);
  assert.match(obrasPrompt, /pendente_confirmacao/i);
  assert.doesNotMatch(saudePrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.doesNotMatch(saudePrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.doesNotMatch(geralPrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.doesNotMatch(geralPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
});

test("prompt do Elo Obras injeta auditoria somente no contexto obras", () => {
  const auditoria = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: auditoria
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: auditoria
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: auditoria
  });

  assert.match(obrasPrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(obrasPrompt, /Status: critico/i);
  assert.doesNotMatch(obrasPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.doesNotMatch(saudePrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.doesNotMatch(geralPrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
});

test("Elo Obras prioriza auditoria quando ha previsto e real", () => {
  const auditoria = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");
  const previsao = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria");

  assert.match(auditoria, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(previsao, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
});

test("prompt mestre do Elo inclui memoria permanente enviada no contexto", () => {
  const prompt = buildEloSystemPrompt_({
    memoriesSummary: "- [pessoa; importancia alta] Minha mae se chama Maria."
  });

  assert.match(prompt, /Contexto salvo sobre a pessoa/i);
  assert.match(prompt, /Minha mae se chama Maria/i);
  assert.match(prompt, /sem repetir 'segundo minha memoria'/i);
});

test("prompt mestre do Elo inclui contexto relevante recuperado por vetor", () => {
  const prompt = buildEloSystemPrompt_({
    relevantMemoriesSummary: "- [projeto; score 0.42] Stock IA organiza almoxarifado e controle de materiais."
  });

  assert.match(prompt, /Contexto relevante recuperado/i);
  assert.match(prompt, /Stock IA organiza almoxarifado/i);
});

test("prompt mestre do Elo inclui conteudo de documento anexado", () => {
  const prompt = buildEloSystemPrompt_({
    documentsSummary: "Documento 1: contrato.txt\nTrecho extraido:\nPrazo de entrega: 30 dias."
  });

  assert.match(prompt, /documentos anexados/i);
  assert.match(prompt, /contrato\.txt/i);
  assert.match(prompt, /Prazo de entrega: 30 dias/i);
  assert.match(prompt, /Não invente informação/i);
});

test("memoria vetorial recupera contexto por significado", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "stock-ia",
    text: "Meu projeto principal e o Stock IA para controlar almoxarifado, materiais e entradas de obra.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "familia",
    text: "Minha mae se chama Maria e gosta de conversar com calma.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const summary = await searchEloRelevantMemories_(store, "Como esta aquela ideia do estoque?", "elo_dev_usuario_a");

  assert.match(summary, /Stock IA/i);
  assert.doesNotMatch(summary.split("\n")[0], /Maria/i);
});

test("memoria vetorial fica isolada por deviceId", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "mae-maria",
    text: "Minha mae se chama Maria.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const userA = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_a");
  const userB = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_b");
  const noDevice = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "");

  assert.match(userA, /Maria/i);
  assert.doesNotMatch(userB, /Maria/i);
  assert.equal(noDevice, "");
});

test("endpoint de memoria vetorial salva item local", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "memoria-teste",
      text: "Controle de estoque da obra com materiais e almoxarifado.",
      category: "projeto"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, "local_vector");
  assert.equal(data.item.id, "memoria-teste");
  assert.equal(data.item.embeddingProvider, "local");
  assert.equal(data.item.embeddingModel, "local-hash-96");
  assert.equal(data.item.embeddingDimensions, 96);
  assert.equal(data.item.schemaVersion, 2);
});

test("memoria vetorial usa embedding real mockado com OPENAI_API_KEY", async () => {
  const originalFetch = globalThis.fetch;
  let embeddingPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      embeddingPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_openai_embedding",
      id: "openai-memoria",
      text: "Memoria com embedding real mockado.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 3);
    assert.equal(item.schemaVersion, 2);
    assert.equal(embeddingPayload.model, "text-embedding-3-small");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial usa fallback local quando embedding real falha", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_embedding_fallback",
      id: "fallback-memoria",
      text: "Controle de estoque com fallback local.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "local");
    assert.equal(item.embeddingModel, "local-hash-96");
    assert.equal(item.embeddingDimensions, 96);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial nao mistura vetores incompatíveis", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      },
      initialState: {
        items: [
          {
            ownerId: "elo_dev_dimensoes",
            id: "local-antigo",
            text: "Memoria local antiga sobre estoque.",
            category: "projeto",
            embedding: new Array(96).fill(0.1),
            embeddingProvider: "local",
            embeddingModel: "local-hash-96",
            embeddingDimensions: 96,
            schemaVersion: 1
          }
        ]
      }
    });
    const items = await store.search("estoque", "elo_dev_dimensoes", 5);

    assert.equal(items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reindexacao segura converte memoria local para OpenAI", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_reindex",
      id: "memoria-local",
      text: "Memoria antiga sobre contrato e prazo.",
      category: "projeto",
      source: "elo",
      createdAt: "2026-06-01T00:00:00.000Z",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.ok, true);
    assert.equal(result.candidates, 1);
    assert.equal(result.reindexed, 1);
    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 1536);
    assert.equal(item.embedding.length, 1536);
    assert.equal(item.schemaVersion, 2);
    assert.equal(item.reindexedAt, "2026-06-03T10:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura preserva campos essenciais da memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_preserva",
      deviceId: "elo_dev_preserva",
      id: "memoria-preservada",
      text: "Memoria antiga com dados preservados.",
      category: "pessoa",
      type: "memory",
      source: "elo",
      fileName: "memoria.txt",
      createdAt: "2026-06-01T00:00:00.000Z",
      metadata: { fileName: "memoria.txt", origem: "teste" },
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(item.ownerId, "elo_dev_preserva");
    assert.equal(item.deviceId, "elo_dev_preserva");
    assert.equal(item.id, "memoria-preservada");
    assert.equal(item.text, "Memoria antiga com dados preservados.");
    assert.equal(item.category, "pessoa");
    assert.equal(item.type, "memory");
    assert.equal(item.source, "elo");
    assert.equal(item.fileName, "memoria.txt");
    assert.equal(item.createdAt, "2026-06-01T00:00:00.000Z");
    assert.deepEqual(item.metadata, { fileName: "memoria.txt", origem: "teste" });
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura cria backup antes de alterar memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_backup",
      id: "memoria-backup",
      text: "Memoria antiga que exige backup.",
      category: "projeto",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const backup = readJsonFile_(result.backupPath);

    assert.equal(result.backupCreated, true);
    assert.equal(existsSync(result.backupPath), true);
    assert.equal(backup.items[0].embeddingProvider, "local");
    assert.equal(backup.items[0].embeddingModel, "local-hash-96");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura mantem memoria intacta quando OpenAI falha", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  const originalItem = {
    ownerId: "elo_dev_falha",
    id: "memoria-falha",
    text: "Memoria antiga protegida contra falha.",
    category: "projeto",
    embedding: new Array(96).fill(0.1),
    embeddingProvider: "local",
    embeddingModel: "local-hash-96",
    embeddingDimensions: 96,
    schemaVersion: 1
  };
  writeEloVectorTestFile_(storePath, [originalItem]);
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.reindexed, 0);
    assert.equal(result.failed, 1);
    assert.deepEqual(item, originalItem);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura nao cria backup quando nao ha registros pendentes", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const item = {
    ownerId: "elo_dev_sem_pendencia",
    id: "memoria-openai",
    text: "Memoria ja indexada com OpenAI.",
    category: "projeto",
    embedding: new Array(1536).fill(0.01),
    embeddingProvider: "openai",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    schemaVersion: 2
  };
  writeEloVectorTestFile_(storePath, [item]);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });

    assert.equal(result.candidates, 0);
    assert.equal(result.reindexed, 0);
    assert.equal(result.backupCreated, false);
    assert.deepEqual(readJsonFile_(storePath).items[0], item);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("elo chat com anexo txt indexa documento sem quebrar fallback", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, resuma este documento",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_teste"
    },
    files: [
      {
        name: "contrato.txt",
        type: "text/plain",
        content: "Contrato de obra. Prazo de entrega: 30 dias. Pagamento em duas parcelas."
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega do contrato?", "elo_dev_doc_teste");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.answer, /extrair texto do anexo/i);
  assert.match(data.answer, /contrato\.txt/i);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("documento anexado preserva chunk maior que 800 caracteres na memoria vetorial", async () => {
  const longText = "Contrato longo do Elo. " + "Clausula tecnica preservada para indexacao sem corte prematuro. ".repeat(18);
  const response = await postEloChatMultipart_({
    message: "Elo, leia este documento longo",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_longo"
    },
    files: [
      {
        name: "contrato-longo.txt",
        type: "text/plain",
        content: longText
      }
    ]
  });
  const data = await response.json();
  const indexedChunk = eloVectorMemoryStore.list().find((item) => item.ownerId === "elo_dev_doc_longo" && item.source === "upload_elo");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(indexedChunk);
  assert.ok(indexedChunk.text.length > 800);
  assert.match(indexedChunk.text, /Clausula tecnica preservada/i);
});

test("elo chat com pdf vazio ou sem texto retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_teste"
    },
    files: [
      {
        name: "vazio.pdf",
        type: "application/pdf",
        content: "%PDF-1.4\n%%EOF"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(Array.isArray(data.attachmentErrors));
  assert.match(data.attachmentErrors.join("\n"), /PDF pode estar escaneado|texto extraivel|corrompido/i);
});

test("elo chat com pdf corrompido retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_corrompido"
    },
    files: [
      {
        name: "corrompido.pdf",
        type: "application/pdf",
        content: "isto nao e um pdf valido"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.attachmentErrors.join("\n"), /corrompido|texto extraivel|Nao consegui ler/i);
});

test("elo chat com pdf valido extrai e indexa texto", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, qual e o prazo deste PDF?",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_valido"
    },
    files: [
      {
        name: "contrato-valido.pdf",
        type: "application/pdf",
        content: tinyPdfBuffer_()
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega?", "elo_dev_pdf_valido");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("upload acima do limite retorna JSON amigavel", async () => {
  await withTemporaryEloServer_({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      ELO_MAX_UPLOAD_BYTES: "100",
      ELO_MAX_ATTACHMENT_BYTES: "50"
    }
  }, async (url) => {
    const response = await postEloChatMultipartTo_(url, {
      message: "Elo, leia este anexo",
      context: {
        source: "elo",
        mode: "standalone",
        deviceId: "elo_dev_limite"
      },
      files: [
        {
          name: "grande.txt",
          type: "text/plain",
          content: "x".repeat(400)
        }
      ]
    });
    const data = await response.json();

    assert.equal(response.status, 413);
    assert.equal(data.fallback, true);
    assert.match(data.answer, /excede o limite|grande demais/i);
    assert.match(data.attachmentErrors.join("\n"), /grande demais/i);
  });
});

test("falha da OpenAI preserva attachmentErrors", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, leia este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_openai_falha"
        },
        files: [
          {
            name: "corrompido.pdf",
            type: "application/pdf",
            content: "pdf invalido"
          }
        ]
      });
      const data = await response.json();

      assert.equal(response.status, 502);
      assert.equal(data.fallback, true);
      assert.match(data.attachmentErrors.join("\n"), /Nao consegui ler|corrompido|texto extraivel/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("payload enviado ao LLM contem resumo do documento", async () => {
  const originalFetch = globalThis.fetch;
  let openAiPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      openAiPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "O documento anexado informa prazo de entrega de 30 dias." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, resuma este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_payload_pdf"
        },
        files: [
          {
            name: "contrato-valido.pdf",
            type: "application/pdf",
            content: tinyPdfBuffer_()
          }
        ]
      });
      const data = await response.json();
      const payloadText = JSON.stringify(openAiPayload);

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.match(data.answer, /30 dias/i);
      assert.match(payloadText, /Prazo de entrega: 30 dias/i);
      assert.match(payloadText, /contrato-valido\.pdf/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo injeta previsao de consumo apenas no contexto obras", async () => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      prompts.push(payload.input[0].content);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Resposta contextual do Elo." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const obrasResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_obras_composicao"
        },
        eloContext: "obras"
      });
      const saudeResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_saude_sem_composicao"
        },
        eloContext: "saude"
      });
      const geralResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_geral_sem_composicao"
        },
        eloContext: "geral"
      });

      assert.equal(obrasResponse.status, 200);
      assert.equal(saudeResponse.status, 200);
      assert.equal(geralResponse.status, 200);
      const obrasData = await obrasResponse.clone().json();
      const saudeData = await saudeResponse.clone().json();
      const geralData = await geralResponse.clone().json();
      assert.match(prompts[0], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.match(prompts[0], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.match(prompts[0], /Alvenaria de vedacao/i);
      assert.match(prompts[0], /Bloco ceramico: 6\.750 un/i);
      assert.match(prompts[0], /pendente_confirmacao/i);
      assert.equal(obrasData.stockIaLaunchPlan.status, "pendente_confirmacao");
      assert.equal(obrasData.stockIaLaunchPlan.tipo, "previsao_consumo");
      assert.equal(obrasData.stockIaLaunchPlan.origem, "elo_obras");
      assert.equal(obrasData.stockIaLaunchPlan.itens[0].nome, "Bloco ceramico");
      assert.equal(obrasData.stockIaLaunchPlan.itens[0].origemCalculo, "coeficiente_demonstrativo");
      assert.doesNotMatch(prompts[1], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[1], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(saudeData.stockIaLaunchPlan, null);
      assert.doesNotMatch(prompts[2], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[2], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(geralData.stockIaLaunchPlan, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo prioriza auditoria previsto x real no contexto obras", async () => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      prompts.push(payload.input[0].content);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Auditoria contextual do Elo." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const obrasResponse = await postEloChatMultipartTo_(url, {
        message: "Previsto 6750 blocos, consumido 8900 blocos",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_obras_auditoria"
        },
        eloContext: "obras"
      });
      const saudeResponse = await postEloChatMultipartTo_(url, {
        message: "Previsto 6750 blocos, consumido 8900 blocos",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_saude_sem_auditoria"
        },
        eloContext: "saude"
      });

      assert.equal(obrasResponse.status, 200);
      assert.equal(saudeResponse.status, 200);
      const obrasData = await obrasResponse.clone().json();
      assert.match(prompts[0], /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
      assert.match(prompts[0], /Status: critico/i);
      assert.doesNotMatch(prompts[1], /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
      assert.doesNotMatch(prompts[0], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[0], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(obrasData.stockIaLaunchPlan, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontend do Elo nao expoe chave OpenAI", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    new URL("../../elo.html", import.meta.url),
    new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url),
    new URL("../../relatorio-qualidade-obras/relatorio-config.js", import.meta.url)
  ];
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));

  contents.forEach((content) => {
    assert.doesNotMatch(content, /OPENAI_API_KEY/);
    assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  });
});

test("frontend do Elo reconhece attachmentErrors em resposta online", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /attachmentErrors/);
  assert.match(content, /formatEloAttachmentErrors_/);
  assert.match(content, /data && Array\.isArray\(data\.attachmentErrors\)/);
  assert.match(content, /data && data\.fallback && data\.answer/);
});

test("frontend do Elo envia eloContext no JSON e multipart", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /function getEloContext\(\)/);
  assert.match(content, /eloContext: eloContext/);
  assert.match(content, /formData\.append\("eloContext", payload\.eloContext\)/);
  assert.match(content, /stock-saude/);
  assert.match(content, /stock-ai/);
});

test("frontend do Elo registra plano Stock IA apenas como planejamento local", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /obraReport\.stockIa\.plannedConsumptions/);
  assert.match(content, /tryConfirmPendingStockIaPlan/);
  assert.match(content, /saveStockIaPlannedConsumption/);
  assert.match(content, /status: "planejado"/);
  assert.match(content, /Nenhum saldo de estoque foi alterado/);
  assert.doesNotMatch(content, /fetch\([^)]*stock-demo/i);
  assert.doesNotMatch(content, /approval-requests/i);
});

test("Elo standalone carrega motor Stock AI antes do assistente", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../elo.html", import.meta.url), "utf8");
  const stockEngineIndex = content.indexOf("relatorio-qualidade-obras/stock-ai-composition-engine.js");
  const eloAssistantIndex = content.indexOf("relatorio-qualidade-obras/elo-assistente.js");

  assert.ok(stockEngineIndex > 0);
  assert.ok(eloAssistantIndex > stockEngineIndex);
});

test("Elo standalone operacional mostra previsao sem saldo disponivel", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho 14 pilares 20x30 com 3m. Posso executar?");

  assert.equal(response.sessionTheme, "elo_operacional_obras");
  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Fonte: Base técnica demonstrativa\/editável/);
  assert.match(response.fullAnswer, /Aco CA-50: 251,37 kg/i);
  assert.match(response.fullAnswer, /Não encontrei saldo do Almoxarifado disponível nesta tela para comparar\./);
  assert.deepEqual(sandbox.__almoxMovements, []);
});

test("Elo operacional responde com saldo suficiente sem criar movimentacao", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 620, realBalance: 620 },
    { name: "Cimento", unit: "saco", balance: 80, realBalance: 80 },
    { name: "Areia", unit: "m3", balance: 900, realBalance: 900 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m². Posso executar amanhã?");

  assert.equal(response.sessionTheme, "elo_operacional_obras");
  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Fonte: Base técnica demonstrativa\/editável/);
  assert.match(response.fullAnswer, /Almoxarifado/);
  assert.match(response.fullAnswer, /Saldo suficiente/);
  assert.doesNotMatch(response.fullAnswer, /Areia: 756 m3/i);
  assert.match(response.fullAnswer, /Areia: 0,756 m³/i);
  assert.doesNotMatch(response.fullAnswer, /saida oficial criada/i);
});

test("Elo operacional interpreta parede 12 m x 3 m como 36 m2", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 500, realBalance: 500 },
    { name: "Cimento", unit: "saco", balance: 80, realBalance: 80 },
    { name: "Areia", unit: "m3", balance: 50, realBalance: 50 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede 12 m x 3 m. Dá para executar amanhã?");

  assert.match(response.fullAnswer, /Bloco ceramico: 491,4 un/i);
  assert.match(response.fullAnswer, /Areia: 0,68 m³/i);
  assert.doesNotMatch(response.fullAnswer, /Areia: 680 m3/i);
});

test("Elo operacional alerta saldo insuficiente e nao altera estoque", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 620, realBalance: 620 },
    { name: "Cimento", unit: "saco", balance: 1, realBalance: 1 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m². Posso executar amanhã?");

  assert.match(response.fullAnswer, /Material insuficiente/);
  assert.match(response.fullAnswer, /faltam/i);
  assert.deepEqual(sandbox.__almoxMovements, []);
});

test("Elo operacional calcula piso e compara estoque sem converter unidade errada", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Piso ceramico", unit: "m2", balance: 40, realBalance: 40 },
    { name: "Argamassa colante", unit: "saco", balance: 20, realBalance: 20 },
    { name: "Rejunte", unit: "kg", balance: 20, realBalance: 20 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho piso de 30 m². Posso executar amanhã?");

  assert.match(response.fullAnswer, /Piso ceramico: 32,445 m²/i);
  assert.match(response.fullAnswer, /Saldo suficiente/);
  assert.doesNotMatch(response.fullAnswer, /32450/);
});

test("Elo operacional calcula reboco e compara estoque", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 10, realBalance: 10 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho reboco de 50 m². Posso fazer amanhã?");

  assert.match(response.fullAnswer, /Reboco|Previsão Stock AI/);
  assert.match(response.fullAnswer, /Areia: 1,05 m³/i);
  assert.doesNotMatch(response.fullAnswer, /Areia: 1050 m3/i);
});

test("Elo operacional trata concreto por volume sem converter m3 para m2", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 20, realBalance: 20 },
    { name: "Areia", unit: "m3", balance: 5, realBalance: 5 },
    { name: "Brita", unit: "m3", balance: 5, realBalance: 5 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho concreto de 2 m³. Tenho material?");

  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.doesNotMatch(response.fullAnswer, /2000 m³|2000 m3/i);
});

test("Elo operacional informa item inexistente no almoxarifado", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 12, realBalance: 12 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m². Posso executar amanhã?");

  assert.match(response.fullAnswer, /Material não encontrado no Almoxarifado/);
  assert.match(response.fullAnswer, /Bloco ceramico: não encontrado/i);
});

test("Elo operacional mostra previsao mesmo com almoxarifado vazio", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m². Posso executar amanhã?");

  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Não encontrei saldo do Almoxarifado disponível nesta tela para comparar/);
  assert.match(response.fullAnswer, /Almoxarifado sem saldo comparável/);
});

test("Elo operacional pede dados quando Stock AI nao consegue prever", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Posso executar concreto amanhã?");

  assert.match(response.fullAnswer, /Eu ainda não consegui calcular essa previsão técnica/);
  assert.match(response.fullAnswer, /parede de 40 m²/);
});

test("Elo operacional indica fonte real quando composicao importada estiver disponivel", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco teste real", unit: "un", balance: 100, realBalance: 100 },
    { name: "Areia real", unit: "m3", balance: 10, realBalance: 10 }
  ]);
  sandbox.window.StockAiCompositionEngine.setExternalCompositionCatalog([{
    id: "sinapi_alvenaria_teste",
    code: "SINAPI-TESTE",
    service: "Alvenaria de teste SINAPI",
    productionUnit: "m2",
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2026-06",
    isRealComposition: true,
    inputs: [
      { name: "Bloco teste real", quantityPerUnit: 2, unit: "un" },
      { name: "Areia real", quantityPerUnit: 0.01, unit: "m3" }
    ],
    keywords: ["alvenaria", "parede", "bloco"]
  }]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 10 m². Posso executar amanhã?");

  assert.match(response.fullAnswer, /Fonte: SINAPI real\/importada/);
  assert.match(response.fullAnswer, /Bloco teste real: 20 un/);
  sandbox.window.StockAiCompositionEngine.clearExternalCompositionCatalog();
});

test("Elo operacional usa ponte de leitura do Almoxarifado sem API de baixa", async () => {
  const { readFile } = await import("node:fs/promises");
  const eloContent = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const appContent = await readFile(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.js", import.meta.url), "utf8");

  assert.match(eloContent, /ObraReportOperationalStock/);
  assert.match(eloContent, /getAlmoxBalances/);
  assert.doesNotMatch(eloContent, /saveAlmoxState_/);
  assert.doesNotMatch(eloContent, /almox\.movements|movements\.push/);
  assert.doesNotMatch(eloContent, /materials\[\]\.push|consumo_rdo/);
  assert.match(appContent, /getOperationalAlmoxBalanceSnapshot_/);
  assert.match(appContent, /window\.ObraReportOperationalStock/);
});

test("endpoint de memoria vetorial exige deviceId valido", async () => {
  const response = await postEloVectorMemory_({
    memory: {
      id: "sem-device",
      text: "Minha mae se chama Maria.",
      category: "pessoa"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /deviceId/i);
});

test("endpoint de memoria vetorial rejeita texto acima do limite", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "texto-grande",
      text: "a".repeat(801),
      category: "outro"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /longo/i);
});

test("prompt visual inclui biblioteca de patologias e restricoes tecnicas", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "fissura-parede.jpg",
      width: 1200,
      height: 900
    },
    context: {
      imageLabel: "Foto da inconformidade 01",
      report: {
        obra: "Obra teste",
        local: "Bloco A"
      }
    }
  });

  assert.match(prompt, /fissuras e trincas/i);
  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao de armadura/i);
  assert.match(prompt, /Nao afirmar causa definitiva/);
  assert.match(prompt, /Nao emitir laudo/);
  assert.match(prompt, /validacao do responsavel tecnico/);
});

test("base consultavel de patologias localiza verificacoes e alertas", () => {
  const result = searchPathologyKnowledge("mancha de umidade com pintura descascando");

  assert.equal(result.totalRecords, 8);
  assert.ok(result.items.length >= 1);
  assert.ok(result.items.some((item) => /umidade|infiltracao/i.test(item.nome)));
  assert.ok(result.items[0].verificacoes_recomendadas.length > 0);
  assert.ok(result.items[0].alertas.length > 0);
});

test("contexto de patologias resume a base para a IA visual", () => {
  const context = buildPathologyContext("aco exposto com ferrugem em viga de concreto");

  assert.match(context, /Registros locais consultados:/);
  assert.match(context, /Corrosao de armadura/);
  assert.match(context, /Verificacoes recomendadas:/);
  assert.match(context, /Nao emitir laudo definitivo/);
  assert.match(context, /validacao do responsavel tecnico/);
});

test("prompt visual preserva categorias de infiltracao e corrosao", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "umidade-corrosao.jpg",
      width: 800,
      height: 600
    },
    context: {
      report: {
        obra: "Inspecao teste"
      }
    }
  });

  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao/i);
  assert.match(prompt, /armadura/i);
});

test("analise visual formatada usa padrao de patologias e observacao obrigatoria", () => {
  const analysis = normalizeImageAnalysis_({
    elementoObservado: "Parede interna",
    categoriaProvavel: "fissuras e trincas",
    confianca: "media",
    descricaoTecnica: "Indicio visual de fissura linear no revestimento.",
    evidenciasVisuais: ["linha fina no revestimento", "alteracao superficial localizada"],
    possiveisInconformidades: ["possivel manifestacao de fissura"],
    verificacoesRecomendadas: ["verificar abertura e extensao", "acompanhar evolucao"],
    grauPreliminar: "atencao",
    textoRelatorio: "Foi observado indicio visual de fissura em parede interna, recomendando-se verificacao complementar."
  });
  const formatted = formatImageAnalysis_(analysis);

  assert.match(formatted, /Elemento observado:/);
  assert.match(formatted, /Possivel manifestacao:/);
  assert.match(formatted, /Evidencias visuais:/);
  assert.match(formatted, /Verificacoes recomendadas:/);
  assert.match(formatted, /Grau preliminar:/);
  assert.match(formatted, /Texto sugerido para relatorio:/);
  assert.match(formatted, /Analise assistida por IA, sujeita a validacao do responsavel tecnico/);
});

test("stock demo sincroniza estado remoto em memoria", async () => {
  const key = "prefeitura-sao-joao-secretaria";
  const state = {
    items: [{ id: "item-1", name: "Mascara", environmentId: "env-1" }],
    movements: [],
    approvalRequests: [],
    stockEnvironments: [{ id: "env-1", clientName: "Prefeitura Sao Joao" }],
    activeStockEnvironmentId: "env-1"
  };

  const saveResponse = await postStockDemoState_({ key, state });
  const saveData = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saveData.ok, true);
  assert.equal(saveData.revision, 1);

  const getResponse = await fetch(baseUrl + "/api/stock-demo/state?key=" + encodeURIComponent(key));
  const getData = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getData.ok, true);
  assert.equal(getData.state.items[0].name, "Mascara");
});

test("stock demo registra solicitacao de aprovacao", async () => {
  const response = await postStockDemoApproval_({
    key: "prefeitura-sao-joao-aprovacao",
    request: {
      id: "apv-1",
      environmentId: "env-1",
      organizationId: "env-1",
      role: "almoxarife",
      type: "entrada",
      status: "pending",
      payload: {
        product: "Luva",
        quantity: 50,
        unit: "cx"
      }
    },
    state: {
      items: [],
      movements: [],
      approvalRequests: [],
      stockEnvironments: [{ id: "env-1" }],
      activeStockEnvironmentId: "env-1"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.state.approvalRequests.length, 1);
  assert.equal(data.state.approvalRequests[0].status, "pending");
});

function writeEloVectorTestFile_(path, items) {
  writeFileSync(path, JSON.stringify({
    items,
    updatedAt: "2026-06-01T00:00:00.000Z"
  }, null, 2), "utf8");
}

async function loadEloOperationalSandbox_(balances) {
  const stockEngineContent = readFileSync(new URL("../../relatorio-qualidade-obras/stock-ai-composition-engine.js", import.meta.url), "utf8");
  const eloContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const storage = new Map();
  const element = {
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    dataset: {},
    textContent: "",
    value: ""
  };
  const sandbox = {
    console,
    setTimeout() {},
    clearTimeout() {},
    Math,
    Date,
    JSON,
    RegExp,
    Number,
    String,
    Array,
    Object,
    URLSearchParams,
    __almoxMovements: [],
    location: {
      hostname: "127.0.0.1",
      protocol: "http:",
      pathname: "/relatorio-qualidade-obras/relatorio-qualidade-obras.html",
      search: "",
      hash: "#app/almoxarifado"
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    document: {
      body: { dataset: {}, getAttribute() { return ""; }, appendChild() {} },
      readyState: "complete",
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return Object.assign({}, element); }
    },
    navigator: {},
    fetch: async () => ({ ok: false, json: async () => ({}) })
  };
  sandbox.window = sandbox;
  sandbox.ELO_SKIP_AUTO_WIDGET = true;
  sandbox.ObraReportOperationalStock = {
    getAlmoxBalances() {
      return balances;
    }
  };

  createContext(sandbox);
  runInContext(stockEngineContent, sandbox);
  runInContext(eloContent, sandbox);
  return sandbox;
}

function readJsonFile_(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mockOpenAiEmbeddingFetch_(embedding, originalFetch) {
  return async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
}

function postAi_(body) {
  return fetch(baseUrl + "/api/ai/improve-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postImage_(body) {
  return fetch(baseUrl + "/api/ai/analyze-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChat_(body) {
  return fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChatMultipart_({ message, history = [], context = {}, eloContext = "", files = [] }) {
  return postEloChatMultipartTo_(baseUrl, { message, history, context, eloContext, files });
}

function postEloChatMultipartTo_(url, { message, history = [], context = {}, eloContext = "", files = [] }) {
  const formData = new FormData();
  formData.append("message", message);
  if (eloContext) {
    formData.append("eloContext", eloContext);
  }
  formData.append("history", JSON.stringify(history));
  formData.append("context", JSON.stringify(context));
  files.forEach((file) => {
    formData.append("files", new Blob([file.content], { type: file.type }), file.name);
  });
  return fetch(url + "/api/elo/chat", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:5500"
    },
    body: formData
  });
}

async function withTemporaryEloServer_(options, callback) {
  const app = createApp(Object.assign({
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  }, options || {}));
  const instance = await new Promise((resolve) => {
    const serverInstance = app.listen(0, () => resolve(serverInstance));
  });
  try {
    await callback("http://127.0.0.1:" + instance.address().port);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

function tinyPdfBuffer_() {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT /F1 24 Tf 100 700 Td (Prazo de entrega: 30 dias) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R /Size 6 >>
%%EOF`);
}

function postEloVectorMemory_(body) {
  return fetch(baseUrl + "/api/elo/vector-memory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoState_(body) {
  return fetch(baseUrl + "/api/stock-demo/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoApproval_(body) {
  return fetch(baseUrl + "/api/stock-demo/approval-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

async function listenTestApp_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    server,
    baseUrl: "http://127.0.0.1:" + server.address().port
  };
}

async function closeTestServer_(server) {
  await new Promise((resolve) => server.close(resolve));
}

function createMockStockSaudeSupabase_(options = {}) {
  const profile = Object.prototype.hasOwnProperty.call(options, "profile") ? options.profile : createMockStockSaudeProfile_("gestor");
  const profiles = profile ? [profile] : [];
  const authUser = options.user || {
    id: profile ? profile.auth_user_id : "auth_user_without_profile",
    email: profile ? profile.email : "sem-profile@teste.local"
  };
  const institutions = (options.institutions || [{ id: "inst_auth" }]).slice();
  const units = (options.units || [{ id: "unit_auth", institution_id: "inst_auth" }]).slice();
  const items = (options.items || []).slice();
  const entries = (options.entries || []).slice();
  const exits = (options.exits || []).slice();
  const auditLogs = (options.auditLogs || []).slice();
  const invites = (options.invites || []).slice();

  const client = {
    auditLogs,
    invites,
    profiles,
    auth: {
      async getUser(token) {
        if (token !== "valid-token") {
          return { data: null, error: { message: "invalid" } };
        }
        return {
          data: {
            user: {
              id: authUser.id,
              email: authUser.email,
              user_metadata: authUser.user_metadata || {}
            }
          },
          error: null
        };
      }
    },
    from(table) {
      if (table === "profiles") {
        return createMockProfilesQuery_(profiles);
      }
      if (table === "institutions") {
        return createMockSimpleIdQuery_(institutions);
      }
      if (table === "units") {
        return createMockSimpleIdQuery_(units);
      }
      if (table === "stock_items") {
        return createMockStockItemsQuery_(items);
      }
      if (table === "stock_entries") {
        return createMockStockEntriesQuery_(entries);
      }
      if (table === "stock_exits") {
        return createMockStockExitsQuery_(exits);
      }
      if (table === "stock_audit_log") {
        return createMockStockAuditLogQuery_(auditLogs);
      }
      if (table === "stock_saude_invites") {
        return createMockStockInvitesQuery_(invites);
      }
      return createMockStockItemsQuery_([]);
    }
  };
  return client;
}

function createMockStockSaudeProfile_(role = "gestor") {
  return {
    id: "profile_auth",
    auth_user_id: "auth_user_1",
    institution_id: "inst_auth",
    unit_id: "unit_auth",
    name: "Gestor Teste",
    email: "gestor@teste.local",
    role
  };
}

function createMockProfilesQuery_(profiles) {
  let authUserId = "";
  const filters = [];
  return {
    select() {
      return this;
    },
    eq(column, value) {
      if (column === "auth_user_id") {
        authUserId = value;
      }
      filters.push({ column, value });
      return this;
    },
    insert(payload) {
      const profile = Object.assign({
        id: "profile_created",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      profiles.push(profile);
      return {
        select() {
          return {
            async single() {
              const projected = Object.assign({}, profile);
              delete projected.auth_user_id;
              return { data: projected, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      const profile = profiles.find((candidate) => {
        if (authUserId) {
          return candidate.auth_user_id === authUserId;
        }
        return filters.every((filter) => candidate[filter.column] === filter.value);
      });
      return {
        data: profile || null,
        error: null
      };
    }
  };
}

function createMockSimpleIdQuery_(records) {
  const filters = [];
  return {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    async maybeSingle() {
      return {
        data: records.find((record) => filters.every((filter) => record[filter.column] === filter.value)) || null,
        error: null
      };
    }
  };
}

function createMockStockItemsQuery_(items) {
  const filters = [];
  const inFilters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const item = Object.assign({
        id: "item_created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      items.push(item);
      return {
        select() {
          return {
            async single() {
              return { data: item, error: null };
            }
          };
        }
      };
    },
    then(resolve) {
      const data = items.filter((item) => {
        return filters.every((filter) => item[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(item[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockEntriesQuery_(entries) {
  const filters = [];
  const inFilters = [];
  let updatePayload = null;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    update(payload) {
      updatePayload = payload;
      return this;
    },
    insert(payload) {
      const entry = Object.assign({
        id: "entry_created",
        status: "pendente",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      entries.push(entry);
      return {
        select() {
          return {
            async single() {
              return { data: entry, error: null };
            }
          };
        }
      };
    },
    async single() {
      const entry = entries.find((candidate) => {
        return filters.every((filter) => candidate[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(candidate[filter.column]));
      });
      if (!entry) {
        return { data: null, error: null };
      }
      if (updatePayload) {
        Object.assign(entry, updatePayload);
      }
      return { data: entry, error: null };
    },
    then(resolve) {
      const data = entries.filter((entry) => {
        return filters.every((filter) => entry[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(entry[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockExitsQuery_(exits) {
  const filters = [];
  const inFilters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const exit = Object.assign({
        id: "exit_created",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      exits.push(exit);
      return {
        select() {
          return {
            async single() {
              return { data: exit, error: null };
            }
          };
        }
      };
    },
    then(resolve) {
      const data = exits.filter((exit) => {
        return filters.every((filter) => exit[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(exit[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockInvitesQuery_(invites) {
  const filters = [];
  let orderConfig = null;
  let updatePayload = null;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order(column, options = {}) {
      orderConfig = { column, ascending: options.ascending !== false };
      return this;
    },
    update(payload) {
      updatePayload = payload;
      return this;
    },
    insert(payload) {
      const invite = Object.assign({
        id: "invite_created",
        status: "pendente",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      invites.push(invite);
      return {
        select() {
          return {
            async single() {
              return { data: invite, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      let data = invites.filter((invite) => filters.every((filter) => invite[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      return { data: data[0] || null, error: null };
    },
    async single() {
      const invite = invites.find((candidate) => filters.every((filter) => candidate[filter.column] === filter.value));
      if (invite && updatePayload) {
        Object.assign(invite, updatePayload);
      }
      return { data: invite || null, error: null };
    },
    then(resolve) {
      let data = invites.filter((invite) => filters.every((filter) => invite[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockAuditLogQuery_(auditLogs) {
  const filters = [];
  let selectedColumns = null;
  let orderConfig = null;
  const query = {
    select(columns) {
      selectedColumns = String(columns || "*")
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order(column, options = {}) {
      orderConfig = { column, ascending: options.ascending !== false };
      return this;
    },
    async insert(payload) {
      auditLogs.push(Array.isArray(payload) ? payload[0] : payload);
      return { data: null, error: null };
    },
    then(resolve) {
      let data = auditLogs.filter((log) => filters.every((filter) => log[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      if (selectedColumns && selectedColumns[0] !== "*") {
        data = data.map((log) => {
          const projected = {};
          selectedColumns.forEach((column) => {
            projected[column] = log[column];
          });
          return projected;
        });
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function tinyJpegBase64_() {
  return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";
}
