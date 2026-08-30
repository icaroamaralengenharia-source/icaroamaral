import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const migrationPath = resolve("backend/src/data/apartment-handover-entitlements-migration.sql");
const sql = readFileSync(migrationPath, "utf8");
const compact = sql.replace(/\s+/g, " ").toLowerCase();

function includesSql(fragment) {
  return compact.includes(fragment.replace(/\s+/g, " ").toLowerCase());
}

test("migration usa schema real institution/profiles e nao depende de companies/current_company_id", () => {
  assert.match(sql, /to_regclass\('public\.institutions'\)/);
  assert.match(sql, /to_regclass\('public\.profiles'\)/);
  assert.match(sql, /column_name = 'auth_user_id'/);
  assert.match(sql, /column_name = 'institution_id'/);
  assert.match(sql, /create table public\.institution_module_entitlements/);
  assert.match(sql, /create table public\.institution_module_trial_usages/);
  assert.doesNotMatch(sql, /public\.companies/);
  assert.doesNotMatch(sql, /company_module_entitlements/);
  assert.doesNotMatch(sql, /company_module_trial_usages/);
  assert.doesNotMatch(sql, /company_id/);
  assert.doesNotMatch(sql, /current_company_id/);
});

test("policies RLS permitem SELECT apenas para profiles da propria institution", () => {
  assert.ok(includesSql("alter table public.institution_module_entitlements enable row level security"));
  assert.ok(includesSql("alter table public.institution_module_trial_usages enable row level security"));
  assert.ok(includesSql("create policy institution_module_entitlements_same_institution_select on public.institution_module_entitlements for select to authenticated using ( exists ( select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.institution_id = institution_module_entitlements.institution_id ) )"));
  assert.ok(includesSql("create policy institution_module_trial_usages_same_institution_select on public.institution_module_trial_usages for select to authenticated using ( exists ( select 1 from public.profiles p where p.auth_user_id = auth.uid() and p.institution_id = institution_module_trial_usages.institution_id ) )"));
  assert.doesNotMatch(sql, /for\s+(insert|update|delete|all)\s+to\s+authenticated/i);
});

test("RPC e grants ficam restritos ao service_role", () => {
  assert.ok(includesSql("create function public.consume_apartment_handover_trial_usage( p_institution_id uuid, p_inspection_id uuid, p_consume boolean default true )"));
  assert.ok(includesSql("security definer set search_path = public"));
  assert.ok(includesSql("revoke all on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) from public"));
  assert.ok(includesSql("revoke all on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) from authenticated"));
  assert.ok(includesSql("grant execute on function public.consume_apartment_handover_trial_usage(uuid, uuid, boolean) to service_role"));
});

test("migration preserva modelo de duas vistorias sem residuos 48h", () => {
  assert.match(sql, /trial_limit integer not null/);
  assert.match(sql, /trial_used integer not null default 0/);
  assert.match(sql, /status in \('trial_active', 'trial_exhausted', 'active', 'blocked'\)/);
  assert.match(sql, /unique \(institution_id, module_key\)/);
  assert.match(sql, /unique \(id, institution_id, module_key\)/);
  assert.match(sql, /unique \(institution_id, module_key, inspection_id\)/);
  assert.match(sql, /foreign key \(entitlement_id, institution_id, module_key\)/);
  assert.doesNotMatch(sql, /trial_started_at|trial_expires_at|trial_not_started|trial_expired|remaining_seconds/);
});
