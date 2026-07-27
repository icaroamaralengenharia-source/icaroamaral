import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadE2eEnv, publicEnvReport, validateE2eEnv } from "./validate-e2e-env.mjs";

const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const STATE_PATH = resolve("backend/data/e2e-test-state.json");

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function id(prefix, slug) {
  return `${prefix}_${slug}`.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function tableExists(supabase, table) {
  const { error } = await supabase.from(table).select("*").limit(1);
  if (!error) return true;
  if (/does not exist|schema cache|Could not find/i.test(error.message || "")) return false;
  return true;
}

async function insertIfTableExists(supabase, table, payload, select = "id") {
  if (!(await tableExists(supabase, table))) return { skipped: true, reason: "table_missing" };
  const { data, error } = await supabase.from(table).insert(payload).select(select).single();
  if (error) return { skipped: true, reason: error.message };
  return { skipped: false, data };
}
async function insertManyIfTableExists(supabase, table, payloads, select = "id") {
  if (!(await tableExists(supabase, table))) return { skipped: true, reason: "table_missing", data: [] };
  const { data, error } = await supabase.from(table).insert(payloads).select(select);
  if (error) return { skipped: true, reason: error.message, data: [] };
  return { skipped: false, data: Array.isArray(data) ? data : [] };
}

async function setup() {
  const { env, envPath } = loadE2eEnv();
  const validation = validateE2eEnv(env);
  if (!validation.ok) fail("Ambiente E2E inseguro ou incompleto. Setup real bloqueado.", { envPath, checks: publicEnvReport(validation) });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const slug = env.E2E_TENANT_SLUG;
  const state = {
    slug,
    createdAt: new Date().toISOString(),
    envPath,
    ids: {},
    tables: {},
    notes: []
  };

  const userResult = await supabase.auth.admin.createUser({
    email: env.E2E_ADMIN_EMAIL,
    password: env.E2E_ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { e2eTenantSlug: slug, environment: "test" }
  });
  if (userResult.error) fail("Nao foi possivel criar usuario Auth de teste.", { reason: userResult.error.message });
  state.ids.authUserId = userResult.data.user.id;

  const institution = await insertIfTableExists(supabase, "institutions", {
    name: env.E2E_COMPANY_NAME,
    document: slug
  });
  if (!institution.skipped) state.ids.institutionId = institution.data.id;
  state.tables.institutions = institution.skipped ? institution.reason : "created";

  const unit = state.ids.institutionId
    ? await insertIfTableExists(supabase, "units", { institution_id: state.ids.institutionId, name: "Unidade E2E", type: "teste" })
    : { skipped: true, reason: "institution_missing" };
  if (!unit.skipped) state.ids.unitId = unit.data.id;
  state.tables.units = unit.skipped ? unit.reason : "created";

  const company = await insertIfTableExists(supabase, "companies", {
    company_id: slug,
    name: env.E2E_COMPANY_NAME,
    document: slug,
    responsible_name: "Administrador E2E",
    status: "ativo"
  });
  if (!company.skipped) state.ids.companyId = company.data.id;
  state.tables.companies = company.skipped ? company.reason : "created";

  let profile = { skipped: true, reason: "no_profile_shape" };
  if (state.ids.companyId) {
    profile = await insertIfTableExists(supabase, "profiles", {
      auth_user_id: state.ids.authUserId,
      company_id: state.ids.companyId,
      name: "Admin E2E",
      email: env.E2E_ADMIN_EMAIL,
      role: "admin",
      status: "ativo"
    });
  }
  if (profile.skipped && state.ids.institutionId) {
    profile = await insertIfTableExists(supabase, "profiles", {
      auth_user_id: state.ids.authUserId,
      institution_id: state.ids.institutionId,
      unit_id: state.ids.unitId || null,
      name: "Admin E2E",
      email: env.E2E_ADMIN_EMAIL,
      role: "admin"
    });
  }
  if (!profile.skipped) state.ids.profileId = profile.data.id;
  state.tables.profiles = profile.skipped ? profile.reason : "created";

  const clientId = id("client", slug);
  const projectId = id("work", slug);
  const client = await insertIfTableExists(supabase, "obrareport_clients", {
    id: clientId,
    institution_id: slug,
    name: env.E2E_CLIENT_NAME
  });
  if (!client.skipped) state.ids.clientId = clientId;
  state.tables.obrareport_clients = client.skipped ? client.reason : "created";

  const project = await insertIfTableExists(supabase, "obrareport_projects", {
    id: projectId,
    institution_id: slug,
    client_id: state.ids.clientId || null,
    name: env.E2E_WORK_NAME,
    address: "Endereco de teste"
  });
  if (!project.skipped) state.ids.projectId = projectId;
  state.tables.obrareport_projects = project.skipped ? project.reason : "created";

  const budgetId = id("budget", slug);
  const budget = await insertIfTableExists(supabase, "elo_budget_documents", {
    id: budgetId,
    institution_id: slug,
    project_id: state.ids.projectId || projectId,
    owner_user_id: state.ids.authUserId,
    title: "Orcamento E2E 80 m2",
    status: "draft",
    document_data: { kind: "e2e_seed", areaM2: 80, city: "Vitoria da Conquista", uf: "BA", standard: "economico" }
  });
  if (!budget.skipped) state.ids.budgetId = budgetId;
  state.tables.elo_budget_documents = budget.skipped ? budget.reason : "created";

  const rdoId = id("rdo", slug);
  const rdo = await insertIfTableExists(supabase, "obrareport_rdos", {
    id: rdoId,
    institution_id: slug,
    project_id: state.ids.projectId || null,
    client_id: state.ids.clientId || null,
    title: "RDO E2E",
    rdo_date: "2026-07-27",
    status: "draft",
    rdo_data_json: { weather: "tempo firme", team: ["pedreiro", "servente"], materials: ["cimento", "bloco"] },
    created_by: state.ids.authUserId
  });
  if (!rdo.skipped) state.ids.rdoId = rdoId;
  state.tables.obrareport_rdos = rdo.skipped ? rdo.reason : "created";

  const reportId = id("report", slug);
  const report = await insertIfTableExists(supabase, "obrareport_technical_reports", {
    id: reportId,
    institution_id: slug,
    project_id: state.ids.projectId || null,
    client_id: state.ids.clientId || null,
    title: "Relatorio tecnico E2E",
    status: "draft",
    report_data_json: { manifestations: ["fissura", "infiltracao", "umidade"] },
    created_by: state.ids.authUserId
  });
  if (!report.skipped) state.ids.reportId = reportId;
  state.tables.obrareport_technical_reports = report.skipped ? report.reason : "created";

  const stockSeed = [
    { name: "Cimento", unit: "sc", initial: 100, exit: 12, final: 88 },
    { name: "Blocos", unit: "un", initial: 1000, exit: 250, final: 750 },
    { name: "Aco", unit: "kg", initial: 500, exit: 80, final: 420 },
    { name: "Areia", unit: "m3", initial: 10, exit: 2, final: 8 },
    { name: "Brita", unit: "m3", initial: 8, exit: 1, final: 7 }
  ];

  if (state.ids.companyId) {
    const products = await insertManyIfTableExists(supabase, "products", stockSeed.map((item, index) => ({
      company_id: state.ids.companyId,
      name: item.name,
      sku: `${slug}-sku-${index + 1}`,
      category: "E2E",
      unit: item.unit,
      current_stock: item.final,
      min_stock: 1,
      cost_price: 1,
      sale_price: 1,
      supplier: "Fornecedor E2E",
      created_by: state.ids.profileId || null
    })));
    state.tables.products = products.skipped ? products.reason : "created";
    state.ids.productIds = products.data.map((item) => item.id);
    if (!products.skipped && products.data.length) {
      const movements = [];
      products.data.forEach((product, index) => {
        const seed = stockSeed[index];
        movements.push({ company_id: state.ids.companyId, product_id: product.id, type: "entrada", quantity: seed.initial, unit_cost: 1, total: seed.initial, reason: "seed_e2e", responsible: "Admin E2E", created_by: state.ids.profileId || null });
        movements.push({ company_id: state.ids.companyId, product_id: product.id, type: "saida", quantity: seed.exit, unit_cost: 1, total: seed.exit, reason: "seed_e2e", destination: "Obra E2E", responsible: "Admin E2E", created_by: state.ids.profileId || null });
      });
      const movementResult = await insertManyIfTableExists(supabase, "stock_movements", movements);
      state.tables.stock_movements = movementResult.skipped ? movementResult.reason : "created";
    }
  }

  const runtimeItems = await insertManyIfTableExists(supabase, "stock_full_items", stockSeed.map((item) => ({
    institution_id: slug,
    name: item.name,
    unit: item.unit,
    category: "E2E",
    min_quantity: 1,
    current_quantity: item.final,
    location: "Deposito E2E",
    notes: "Seed E2E",
    created_by: state.ids.profileId || null
  })));
  state.tables.stock_full_items = runtimeItems.skipped ? runtimeItems.reason : "created";
  state.ids.stockFullItemIds = runtimeItems.data.map((item) => item.id);
  if (!runtimeItems.skipped && runtimeItems.data.length) {
    const entries = [];
    const exits = [];
    runtimeItems.data.forEach((item, index) => {
      const seed = stockSeed[index];
      entries.push({ institution_id: slug, item_id: item.id, quantity: seed.initial, source: "e2e", supplier: "Fornecedor E2E", notes: "Seed E2E", created_by: state.ids.profileId || null });
      exits.push({ institution_id: slug, item_id: item.id, quantity: seed.exit, destination: "Obra E2E", responsible: "Admin E2E", notes: "Seed E2E", created_by: state.ids.profileId || null });
    });
    const entriesResult = await insertManyIfTableExists(supabase, "stock_full_entries", entries);
    const exitsResult = await insertManyIfTableExists(supabase, "stock_full_exits", exits);
    state.tables.stock_full_entries = entriesResult.skipped ? entriesResult.reason : "created";
    state.tables.stock_full_exits = exitsResult.skipped ? exitsResult.reason : "created";
  }

  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
  console.log(JSON.stringify({ ok: true, statePath: STATE_PATH, ids: state.ids, tables: state.tables }, null, 2));
}

setup().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || {} }, null, 2));
  process.exit(1);
});
