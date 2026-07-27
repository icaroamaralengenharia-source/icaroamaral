import { test, expect } from "@playwright/test";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadE2eEnv, validateE2eEnv } from "../../scripts/e2e/validate-e2e-env.mjs";

const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const statePath = resolve("backend/data/e2e-test-state.json");
const backendPort = Number(process.env.E2E_BACKEND_PORT || 3569);
const backendBaseUrl = `http://127.0.0.1:${backendPort}`;
const runId = `pw_${Date.now().toString(36)}`;

let fixture = null;
let fixtureSkipReason = "Ambiente E2E real nao configurado com seguranca.";
let backendProcess = null;
let backendStarted = false;
let createdStockItem = null;

function jsonHeaders(extra = {}) {
  return { "content-type": "application/json", ...extra };
}

function requireFixture() {
  test.skip(!fixture, fixtureSkipReason);
  return fixture;
}

async function waitForBackend() {
  const deadline = Date.now() + 20_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${backendBaseUrl}/api/health`);
      if (response.ok) return true;
      lastError = new Error(`status_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw lastError || new Error("backend_not_ready");
}


const stockSeed = [
  { name: "Cimento", unit: "sc", initial: 100, exit: 12, final: 88 },
  { name: "Blocos", unit: "un", initial: 1000, exit: 250, final: 750 },
  { name: "Aco", unit: "kg", initial: 500, exit: 80, final: 420 },
  { name: "Areia", unit: "m3", initial: 10, exit: 2, final: 8 },
  { name: "Brita", unit: "m3", initial: 8, exit: 1, final: 7 }
];

function stockFullInstitutionId(state) {
  return state.ids.stockFullInstitutionId || state.ids.institutionId || state.slug;
}

async function ensureStockFullRuntimeSeed(supabase, state) {
  const institutionId = stockFullInstitutionId(state);
  const existing = await supabase
    .from("stock_full_items")
    .select("id,name")
    .eq("institution_id", institutionId);
  if (existing.error) throw new Error(`stock_full_seed_lookup_failed: ${existing.error.message}`);
  const existingNames = new Set((existing.data || []).map((item) => item.name));
  const missing = stockSeed.filter((item) => !existingNames.has(item.name));
  if (!missing.length) return;

  const inserted = await supabase
    .from("stock_full_items")
    .insert(missing.map((item) => ({
      institution_id: institutionId,
      name: item.name,
      unit: item.unit,
      category: "E2E",
      min_quantity: 1,
      current_quantity: item.final,
      location: "Deposito E2E",
      notes: "Seed E2E",
      created_by: state.ids.profileId || null
    })))
    .select("id,name");
  if (inserted.error) throw new Error(`stock_full_seed_insert_failed: ${inserted.error.message}`);

  const entries = [];
  const exits = [];
  (inserted.data || []).forEach((item) => {
    const seed = stockSeed.find((candidate) => candidate.name === item.name);
    if (!seed) return;
    entries.push({ institution_id: institutionId, item_id: item.id, quantity: seed.initial, source: "e2e", supplier: "Fornecedor E2E", notes: "Seed E2E", created_by: state.ids.profileId || null });
    exits.push({ institution_id: institutionId, item_id: item.id, quantity: seed.exit, destination: "Obra E2E", responsible: "Admin E2E", notes: "Seed E2E", created_by: state.ids.profileId || null });
  });
  if (entries.length) {
    const entryResult = await supabase.from("stock_full_entries").insert(entries);
    if (entryResult.error) throw new Error(`stock_full_seed_entries_failed: ${entryResult.error.message}`);
  }
  if (exits.length) {
    const exitResult = await supabase.from("stock_full_exits").insert(exits);
    if (exitResult.error) throw new Error(`stock_full_seed_exits_failed: ${exitResult.error.message}`);
  }
}
async function apiJson(request, method, url, body, headers = {}) {
  const response = await request.fetch(`${backendBaseUrl}${url}`, {
    method,
    headers: jsonHeaders(headers),
    data: body === undefined ? undefined : body
  });
  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = { raw: await response.text() };
  }
  return { response, data };
}

test.beforeAll(async () => {
  const { env } = loadE2eEnv([], process.env);
  const validation = validateE2eEnv(env);
  if (!validation.ok) return;
  if (!existsSync(statePath)) {
    fixtureSkipReason = "Execute scripts/e2e/setup-e2e-tenant.mjs antes da jornada real.";
    return;
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const signIn = await supabaseAnon.auth.signInWithPassword({
    email: env.E2E_ADMIN_EMAIL,
    password: env.E2E_ADMIN_PASSWORD
  });
  if (signIn.error) {
    fixtureSkipReason = `Login Supabase E2E falhou: ${signIn.error.message}`;
    return;
  }

  if (state.ids.profileId && state.ids.institutionId) {
    const profileRepair = await supabaseAdmin
      .from("profiles")
      .update({ institution_id: state.ids.institutionId, unit_id: state.ids.unitId || null })
      .eq("id", state.ids.profileId)
      .eq("auth_user_id", state.ids.authUserId)
      .select("id,institution_id,unit_id")
      .maybeSingle();
    if (profileRepair.error) {
      fixtureSkipReason = `Profile E2E incompleto e reparo seguro falhou: ${profileRepair.error.message}`;
      return;
    }
  }

  try {
    await ensureStockFullRuntimeSeed(supabaseAdmin, state);
  } catch (error) {
    fixtureSkipReason = error.message;
    return;
  }

  fixture = {
    env,
    state,
    supabaseAdmin,
    supabaseAnon,
    session: signIn.data.session,
    authHeader: { authorization: `Bearer ${signIn.data.session.access_token}` },
    obraHeaders: {
      "x-institution-id": state.slug,
      "x-user-id": state.ids.authUserId
    },
    budgetHeaders: {
      "x-institution-id": state.slug,
      "x-user-id": state.ids.authUserId
    }
  };

  backendProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: resolve("backend"),
    env: { ...process.env, ...env, PORT: String(backendPort) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  backendProcess.stdout.on("data", () => {});
  backendProcess.stderr.on("data", () => {});
  await waitForBackend();
  backendStarted = true;
});

test.afterAll(async () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill();
  }
});

test("01 ambiente e state E2E isolado estao configurados", async () => {
  const { env, state } = requireFixture();
  expect(state.slug).toBe(env.E2E_TENANT_SLUG);
  expect(state.slug).toMatch(/^elo-e2e-/);
  expect(state.ids.authUserId).toBeTruthy();
  expect(state.ids.companyId || state.ids.institutionId).toBeTruthy();
  expect(state.ids.clientId || state.tables.obrareport_clients).toBeTruthy();
  expect(state.ids.projectId || state.tables.obrareport_projects).toBeTruthy();
});

test("02 autenticacao Supabase real encontra usuario e profile", async () => {
  const { env, state, session, supabaseAdmin } = requireFixture();
  expect(session.user.email).toBe(env.E2E_ADMIN_EMAIL);
  expect(session.user.id).toBe(state.ids.authUserId);

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("id,auth_user_id,institution_id,company_id,unit_id,email,role,status")
    .eq("auth_user_id", state.ids.authUserId)
    .maybeSingle();
  expect(error).toBeFalsy();
  expect(profile).toBeTruthy();
  expect(profile.email).toBe(env.E2E_ADMIN_EMAIL);
  expect(profile.company_id || profile.institution_id).toBeTruthy();
});

test("03 tenant empresa cliente obra e budget seed existem no Supabase", async () => {
  const { state, supabaseAdmin } = requireFixture();
  const [institution, company, client, project, budget] = await Promise.all([
    supabaseAdmin.from("institutions").select("id,document,name").eq("id", state.ids.institutionId).maybeSingle(),
    supabaseAdmin.from("companies").select("id,company_id,name").eq("id", state.ids.companyId).maybeSingle(),
    supabaseAdmin.from("obrareport_clients").select("id,institution_id,name").eq("id", state.ids.clientId).maybeSingle(),
    supabaseAdmin.from("obrareport_projects").select("id,institution_id,client_id,name").eq("id", state.ids.projectId).maybeSingle(),
    supabaseAdmin.from("elo_budget_documents").select("id,institution_id,project_id,title,document_data").eq("id", state.ids.budgetId).maybeSingle()
  ]);
  for (const result of [institution, company, client, project, budget]) expect(result.error).toBeFalsy();
  expect(institution.data.document).toBe(state.slug);
  expect(company.data.company_id).toBe(state.slug);
  expect(client.data.institution_id).toBe(state.slug);
  expect(project.data.client_id).toBe(state.ids.clientId);
  expect(budget.data.project_id).toBe(state.ids.projectId);
});

test("04 Stock Full seed no Supabase tem produtos movimentos entradas saidas e saldos", async () => {
  const { state, supabaseAdmin } = requireFixture();
  const [runtimeItems, entries, exits, products, movements] = await Promise.all([
    supabaseAdmin.from("stock_full_items").select("id,name,current_quantity").eq("institution_id", stockFullInstitutionId(state)),
    supabaseAdmin.from("stock_full_entries").select("id,item_id,quantity").eq("institution_id", stockFullInstitutionId(state)),
    supabaseAdmin.from("stock_full_exits").select("id,item_id,quantity").eq("institution_id", stockFullInstitutionId(state)),
    supabaseAdmin.from("products").select("id,name,current_stock").eq("company_id", state.ids.companyId),
    supabaseAdmin.from("stock_movements").select("id,product_id,type,quantity").eq("company_id", state.ids.companyId)
  ]);
  for (const result of [runtimeItems, entries, exits, products, movements]) expect(result.error).toBeFalsy();
  expect(runtimeItems.data.length).toBeGreaterThanOrEqual(5);
  expect(entries.data.length).toBeGreaterThanOrEqual(5);
  expect(exits.data.length).toBeGreaterThanOrEqual(5);
  expect(products.data.length).toBeGreaterThanOrEqual(5);
  expect(movements.data.length).toBeGreaterThanOrEqual(10);
  expect(runtimeItems.data.every((item) => Number(item.current_quantity) >= 0)).toBe(true);
});

test("05 backend real sobe e autentica Stock Full", async ({ request }) => {
  const { authHeader } = requireFixture();
  expect(backendStarted).toBe(true);
  const { response, data } = await apiJson(request, "GET", "/api/stock-full/me", undefined, authHeader);
  expect(response.status(), JSON.stringify(data)).toBe(200);
  expect(data.ok).toBe(true);
  expect(data.profile).toBeTruthy();
  expect(data.profile.institution_id, "profile precisa ter institution_id para o Stock Full runtime").toBeTruthy();
});

test("06 Stock Full backend cadastra item entrada saida rejeita saldo negativo e audita", async ({ request }) => {
  const { authHeader } = requireFixture();
  const itemName = `E2E Item ${runId}`;
  const create = await apiJson(request, "POST", "/api/stock-full/items", {
    name: itemName,
    unit: "un",
    category: "E2E",
    minQuantity: 1,
    currentQuantity: 0,
    location: "Deposito E2E"
  }, authHeader);
  expect(create.response.status(), JSON.stringify(create.data)).toBe(200);
  expect(create.data.ok).toBe(true);
  createdStockItem = create.data.item;

  const entry = await apiJson(request, "POST", "/api/stock-full/entries", {
    itemId: createdStockItem.id,
    quantity: 10,
    supplier: "Fornecedor E2E",
    notes: runId
  }, authHeader);
  expect(entry.response.status(), JSON.stringify(entry.data)).toBe(200);
  expect(Number(entry.data.item.currentQuantity)).toBe(10);

  const exit = await apiJson(request, "POST", "/api/stock-full/exits", {
    itemId: createdStockItem.id,
    quantity: 3,
    destination: "Obra E2E",
    responsible: "Admin E2E",
    notes: runId
  }, authHeader);
  expect(exit.response.status(), JSON.stringify(exit.data)).toBe(200);
  expect(Number(exit.data.item.currentQuantity)).toBe(7);

  const negative = await apiJson(request, "POST", "/api/stock-full/exits", {
    itemId: createdStockItem.id,
    quantity: 9999,
    destination: "Obra E2E",
    responsible: "Admin E2E",
    notes: runId
  }, authHeader);
  expect(negative.response.status(), JSON.stringify(negative.data)).toBe(409);
  expect(negative.data.error).toBe("stock_full_insufficient_quantity");

  const audit = await apiJson(request, "GET", "/api/stock-full/audit-log", undefined, authHeader);
  expect(audit.response.status(), JSON.stringify(audit.data)).toBe(200);
  expect(audit.data.auditLog.some((event) => String(event.description || "").includes(itemName))).toBe(true);
});

test("07 ObraReport backend cria reabre RDO gera documento e eventos", async ({ request }) => {
  const { state, obraHeaders } = requireFixture();
  const create = await apiJson(request, "POST", "/api/obrareport/rdos", {
    projectId: state.ids.projectId,
    clientId: state.ids.clientId,
    title: `RDO E2E ${runId}`,
    rdoData: { weather: "tempo firme", team: ["pedreiro"], materials: ["cimento"] }
  }, obraHeaders);
  expect(create.response.status(), JSON.stringify(create.data)).toBe(201);
  const id = create.data.rdo.id;

  const reopen = await apiJson(request, "GET", `/api/obrareport/rdos?projectId=${encodeURIComponent(state.ids.projectId)}`, undefined, obraHeaders);
  expect(reopen.response.status(), JSON.stringify(reopen.data)).toBe(200);
  expect(reopen.data.rdos.some((rdo) => rdo.id === id)).toBe(true);

  const version = await apiJson(request, "POST", `/api/obrareport/rdos/${encodeURIComponent(id)}/versions`, {}, obraHeaders);
  expect(version.response.status(), JSON.stringify(version.data)).toBe(201);

  const document = await apiJson(request, "POST", `/api/obrareport/rdos/${encodeURIComponent(id)}/generate-document`, {}, obraHeaders);
  expect(document.response.status(), JSON.stringify(document.data)).toBe(201);
  expect(document.data.document.hash).toBeTruthy();
  expect(document.data.document.file.id).toBeTruthy();
  expect(document.data.document.file.filename).toMatch(/\.html$/);
  expect(document.data.document.file.mime_type).toContain("text/html");
  expect(document.data.document.file.size_bytes).toBeGreaterThan(0);
  expect(document.data.document.html_content).toContain("ObraReport");
});

test("08 ObraReport backend cria reabre relatorio tecnico gera documento", async ({ request }) => {
  const { state, obraHeaders } = requireFixture();
  const create = await apiJson(request, "POST", "/api/obrareport/reports", {
    projectId: state.ids.projectId,
    clientId: state.ids.clientId,
    title: `Relatorio E2E ${runId}`,
    reportData: { manifestations: ["fissura", "umidade"], summary: "Teste E2E" }
  }, obraHeaders);
  expect(create.response.status(), JSON.stringify(create.data)).toBe(201);
  const id = create.data.report.id;

  const get = await apiJson(request, "GET", `/api/obrareport/reports/${encodeURIComponent(id)}`, undefined, obraHeaders);
  expect(get.response.status(), JSON.stringify(get.data)).toBe(200);
  expect(get.data.report.title).toContain("Relatorio E2E");

  const document = await apiJson(request, "POST", `/api/obrareport/reports/${encodeURIComponent(id)}/generate-document`, {}, obraHeaders);
  expect(document.response.status(), JSON.stringify(document.data)).toBe(201);
  expect(document.data.document.hash).toBeTruthy();
  expect(document.data.document.file.id).toBeTruthy();
  expect(document.data.document.file.filename).toMatch(/\.html$/);
  expect(document.data.document.file.mime_type).toContain("text/html");
  expect(document.data.document.file.size_bytes).toBeGreaterThan(0);
  expect(document.data.document.html_content).toContain("ObraReport");
});

test("09 orcamento backend cria versao gera documento HTML consultavel", async ({ request }) => {
  const { state, budgetHeaders } = requireFixture();
  const create = await apiJson(request, "POST", "/api/elo/budgets", {
    documentData: {
      projectId: state.ids.projectId,
      title: `Orcamento E2E ${runId}`,
      items: [{ description: "Parede", quantity: 10, unit: "m2", unitPrice: 100 }]
    }
  }, budgetHeaders);
  expect(create.response.status(), JSON.stringify(create.data)).toBe(201);
  const id = create.data.budget.id;

  const version = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(id)}/versions`, { documentData: create.data.budget.document_data }, budgetHeaders);
  expect(version.response.status(), JSON.stringify(version.data)).toBe(201);

  const pdf = await apiJson(request, "POST", `/api/elo/budgets/${encodeURIComponent(id)}/generate-pdf`, {}, budgetHeaders);
  expect(pdf.response.status(), JSON.stringify(pdf.data)).toBe(201);
  expect(pdf.data.document.file_name).toMatch(/\.html$/);
  expect(pdf.data.html).toContain("Orcamento");

  const documents = await apiJson(request, "GET", `/api/elo/budgets/${encodeURIComponent(id)}/documents`, undefined, budgetHeaders);
  expect(documents.response.status(), JSON.stringify(documents.data)).toBe(200);
  expect(documents.data.documents.length).toBeGreaterThanOrEqual(1);
});

test("10 ELO observa dados persistidos por rota real ou expõe desvio", async ({ request }) => {
  const { state, authHeader } = requireFixture();
  const url = `/api/elo/obra/attention?projectId=${encodeURIComponent(state.ids.projectId)}&institutionId=${encodeURIComponent(state.slug)}`;
  const result = await apiJson(request, "GET", url, undefined, authHeader);
  expect(result.response.status(), JSON.stringify(result.data)).toBe(200);
  expect(result.data.ok).toBe(true);
  expect(result.data.summary).toBeTruthy();
  expect(Array.isArray(result.data.alerts)).toBe(true);
  expect(result.data.sourcesUsed).toBeTruthy();
  expect(result.data.dataQuality).toBeTruthy();
});

test("11 isolamento tenant e idempotencia de saldo negativo", async ({ request }) => {
  const { state, authHeader, supabaseAdmin } = requireFixture();
  const otherSlug = `${state.slug}-outra-obra`;
  const [itemsOther, clientsOther] = await Promise.all([
    supabaseAdmin.from("stock_full_items").select("id").eq("institution_id", otherSlug),
    supabaseAdmin.from("obrareport_clients").select("id").eq("institution_id", otherSlug)
  ]);
  expect(itemsOther.error).toBeFalsy();
  expect(clientsOther.error).toBeFalsy();
  expect(itemsOther.data).toHaveLength(0);
  expect(clientsOther.data).toHaveLength(0);

  test.skip(!createdStockItem, "Teste de item Stock Full nao criou item; idempotencia de saldo negativo indisponivel.");
  const before = await apiJson(request, "GET", "/api/stock-full/items", undefined, authHeader);
  const beforeItem = before.data.items.find((item) => item.id === createdStockItem.id);
  const negative = await apiJson(request, "POST", "/api/stock-full/exits", {
    itemId: createdStockItem.id,
    quantity: 9999,
    destination: "Obra E2E",
    responsible: "Admin E2E"
  }, authHeader);
  expect(negative.response.status(), JSON.stringify(negative.data)).toBe(409);
  const after = await apiJson(request, "GET", "/api/stock-full/items", undefined, authHeader);
  const afterItem = after.data.items.find((item) => item.id === createdStockItem.id);
  expect(Number(afterItem.currentQuantity)).toBe(Number(beforeItem.currentQuantity));
});