import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const sql = readFileSync(new URL("../src/data/municipal-admin-schema.sql", import.meta.url), "utf8").toLowerCase();

function has(pattern) {
  assert.match(sql, pattern);
}

test("schema municipal e aditivo e idempotente", () => {
  has(/create table if not exists public\.institutions/);
  has(/create table if not exists public\.units/);
  has(/create table if not exists public\.profiles/);
  has(/create table if not exists public\.municipal_admin_invites/);
  has(/create table if not exists public\.municipal_admin_audit_log/);
  has(/alter table public\.profiles add column if not exists institution_id/);
  assert.doesNotMatch(sql, /drop\s+table/);
  assert.doesNotMatch(sql, /truncate\s+table/);
  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/);
});

test("schema municipal cobre indices obrigatorios", () => {
  [
    /institutions.*status/s,
    /institutions.*created_at/s,
    /units.*institution_id/s,
    /units.*status/s,
    /units.*created_at/s,
    /profiles.*institution_id/s,
    /profiles.*unit_id/s,
    /profiles.*auth_user_id/s,
    /profiles.*email/s,
    /profiles.*status/s,
    /profiles.*created_at/s,
    /invites.*institution_id/s,
    /invites.*unit_id/s,
    /invites.*email/s,
    /invites.*status/s,
    /invites.*token_hash/s,
    /invites.*created_at/s,
    /audit.*institution_id/s,
    /audit.*created_at/s
  ].forEach(has);
});

test("schema municipal habilita RLS sem politica permissiva ampla", () => {
  has(/alter table public\.institutions enable row level security/);
  has(/alter table public\.units enable row level security/);
  has(/alter table public\.profiles enable row level security/);
  has(/alter table public\.municipal_admin_invites enable row level security/);
  has(/alter table public\.municipal_admin_audit_log enable row level security/);
  has(/create policy municipal_institutions_tenant_select/);
  has(/create policy municipal_units_tenant_select/);
  has(/create policy municipal_profiles_tenant_select/);
});