import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadE2eEnv, publicEnvReport, validateE2eEnv } from "./validate-e2e-env.mjs";

const require = createRequire(new URL("../../backend/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

const STATE_PATH = resolve("backend/data/e2e-test-state.json");

function fail(message, details = {}) {
  const error = new Error(message);
  error.details = details;
  throw error;
}

async function safeDelete(supabase, table, column, value) {
  if (!table || !column || !value) fail("Cleanup recusado: filtro obrigatorio ausente.", { table, column });
  const { error } = await supabase.from(table).delete().eq(column, value);
  if (error && !/does not exist|schema cache|Could not find/i.test(error.message || "")) {
    return { table, status: "error", reason: error.message };
  }
  return { table, status: error ? "missing" : "deleted" };
}

async function cleanup() {
  const { env, envPath } = loadE2eEnv();
  const validation = validateE2eEnv(env);
  if (!validation.ok) fail("Ambiente E2E inseguro ou incompleto. Cleanup real bloqueado.", { envPath, checks: publicEnvReport(validation) });
  if (!existsSync(STATE_PATH)) fail("Arquivo de estado do setup nao encontrado. Cleanup recusado.", { statePath: STATE_PATH });

  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
  const slug = env.E2E_TENANT_SLUG;
  if (!/^elo-e2e-/.test(slug) || state.slug !== slug) fail("Slug do estado nao confere com o ambiente. Cleanup recusado.", { stateSlug: state.slug });

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const results = [];

  results.push(await safeDelete(supabase, "obrareport_generated_documents", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_rdo_events", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_rdo_versions", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_rdos", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_report_events", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_report_versions", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_technical_reports", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_projects", "institution_id", slug));
  results.push(await safeDelete(supabase, "obrareport_clients", "institution_id", slug));
  results.push(await safeDelete(supabase, "elo_generated_documents", "budget_id", state.ids.budgetId || "__none__"));
  results.push(await safeDelete(supabase, "elo_budget_events", "institution_id", slug));
  results.push(await safeDelete(supabase, "elo_budget_documents", "institution_id", slug));
  results.push(await safeDelete(supabase, "stock_full_entries", "institution_id", slug));
  results.push(await safeDelete(supabase, "stock_full_exits", "institution_id", slug));
  results.push(await safeDelete(supabase, "stock_full_audit_log", "institution_id", slug));
  results.push(await safeDelete(supabase, "stock_full_items", "institution_id", slug));

  if (state.ids.companyId) {
    results.push(await safeDelete(supabase, "stock_movements", "company_id", state.ids.companyId));
    results.push(await safeDelete(supabase, "audit_logs", "company_id", state.ids.companyId));
    results.push(await safeDelete(supabase, "imports", "company_id", state.ids.companyId));
    results.push(await safeDelete(supabase, "products", "company_id", state.ids.companyId));
    results.push(await safeDelete(supabase, "profiles", "company_id", state.ids.companyId));
    results.push(await safeDelete(supabase, "companies", "id", state.ids.companyId));
  }
  if (state.ids.institutionId) {
    results.push(await safeDelete(supabase, "stock_entries", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "stock_exits", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "stock_audit_log", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "stock_items", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "profiles", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "units", "institution_id", state.ids.institutionId));
    results.push(await safeDelete(supabase, "institutions", "id", state.ids.institutionId));
  }

  if (state.ids.authUserId) {
    const authDelete = await supabase.auth.admin.deleteUser(state.ids.authUserId);
    results.push({ table: "auth.users", status: authDelete.error ? "error" : "deleted", reason: authDelete.error && authDelete.error.message });
  }

  console.log(JSON.stringify({ ok: true, statePath: STATE_PATH, results }, null, 2));
}

cleanup().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, details: error.details || {} }, null, 2));
  process.exit(1);
});
