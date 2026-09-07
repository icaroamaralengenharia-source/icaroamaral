import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { resolveAuthContext } from "../src/auth-context.js";

function createSupabaseMock({ user = null, profile = null, userError = null, profileError = null, profileResults = null } = {}) {
  const calls = [];
  const queuedResults = Array.isArray(profileResults) ? profileResults.slice() : null;
  return {
    calls,
    auth: {
      async getUser(token) {
        calls.push({ type: "getUser", token });
        return userError ? { data: null, error: userError } : { data: { user }, error: null };
      }
    },
    from(table) {
      calls.push({ type: "from", table });
      return {
        select(columns) {
          calls.push({ type: "select", columns });
          return {
            eq(column, value) {
              calls.push({ type: "eq", column, value });
              return {
                async maybeSingle() {
                  calls.push({ type: "maybeSingle" });
                  if (queuedResults) {
                    const next = queuedResults.shift() || { data: null, error: null };
                    return next;
                  }
                  return profileError ? { data: null, error: profileError } : { data: profile, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

function request() {
  return { headers: { authorization: "Bearer token-valido" } };
}

test("authContext valida Bearer Supabase e prioriza company_id quando disponivel", async () => {
  const supabase = createSupabaseMock({
    user: { id: "auth-user-1", email: "engenheiro@example.com" },
    profile: {
      id: "profile-1",
      auth_user_id: "auth-user-1",
      institution_id: "inst-1",
      company_id: "company-1",
      unit_id: "unit-1",
      name: "Engenheiro",
      email: "engenheiro@example.com",
      role: "admin",
      status: "ativo"
    }
  });

  const context = await resolveAuthContext(request(), { supabase });

  assert.equal(context.ok, true);
  assert.equal(context.userId, "auth-user-1");
  assert.equal(context.institutionId, "inst-1");
  assert.equal(context.companyId, "company-1");
  assert.equal(context.role, "admin");
  assert.equal(context.profile.status, "ativo");
  assert.deepEqual(supabase.calls.filter((call) => call.type === "eq")[0], {
    type: "eq",
    column: "auth_user_id",
    value: "auth-user-1"
  });
});

test("authContext recua quando company_id nao existe e resolve por institution_id", async () => {
  const supabase = createSupabaseMock({
    user: { id: "auth-user-real", email: "teste@stocksaude.com" },
    profileResults: [
      { data: null, error: { code: "42703", message: "column profiles.company_id does not exist" } },
      {
        data: {
          id: "profile-real",
          auth_user_id: "auth-user-real",
          institution_id: "inst-real",
          unit_id: "unit-real",
          name: "Teste Stock Saude",
          email: "teste@stocksaude.com",
          role: "gestor",
          status: "active"
        },
        error: null
      }
    ]
  });

  const context = await resolveAuthContext(request(), { supabase });

  assert.equal(context.ok, true);
  assert.equal(context.institutionId, "inst-real");
  assert.equal(context.companyId, "inst-real");
  assert.equal(context.profile.company_id, "");
  assert.equal(context.profile.unit_id, "unit-real");
  assert.equal(context.role, "gestor");
  assert.equal(supabase.calls.filter((call) => call.type === "select").length, 2);
});

test("authContext recua quando company_id e status nao existem", async () => {
  const supabase = createSupabaseMock({
    user: { id: "auth-user-min", email: "min@example.com" },
    profileResults: [
      { data: null, error: { code: "42703", message: "column profiles.company_id does not exist" } },
      { data: null, error: { code: "42703", message: "column profiles.status does not exist" } },
      { data: null, error: { code: "42703", message: "column profiles.company_id does not exist" } },
      {
        data: {
          id: "profile-min",
          auth_user_id: "auth-user-min",
          institution_id: "inst-min",
          unit_id: "unit-min",
          email: "min@example.com",
          role: "gestor"
        },
        error: null
      }
    ]
  });

  const context = await resolveAuthContext(request(), { supabase });

  assert.equal(context.ok, true);
  assert.equal(context.institutionId, "inst-min");
  assert.equal(context.companyId, "inst-min");
  assert.equal(context.profile.status, "");
  assert.equal(context.role, "gestor");
});

test("authContext retorna erro seguro para token ausente ou invalido", async () => {
  const missing = await resolveAuthContext({ headers: {} }, { supabase: createSupabaseMock() });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 401);
  assert.equal(missing.error, "authentication_required");

  const invalid = await resolveAuthContext(
    { headers: { authorization: "Bearer token-invalido" } },
    { supabase: createSupabaseMock({ userError: new Error("jwt expired") }) }
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.status, 401);
  assert.equal(invalid.error, "invalid_session");
});

test("authContext bloqueia profile ausente", async () => {
  const context = await resolveAuthContext(request(), {
    supabase: createSupabaseMock({ user: { id: "auth-missing" }, profile: null })
  });

  assert.equal(context.ok, false);
  assert.equal(context.status, 403);
  assert.equal(context.error, "auth_context_profile_not_found");
});

test("authContext bloqueia profile sem tenant", async () => {
  const context = await resolveAuthContext(request(), {
    supabase: createSupabaseMock({
      user: { id: "auth-no-tenant" },
      profile: { id: "profile-no-tenant", auth_user_id: "auth-no-tenant", email: "no@example.com", role: "gestor" }
    })
  });

  assert.equal(context.ok, false);
  assert.equal(context.status, 403);
  assert.equal(context.error, "auth_context_tenant_not_found");
});

test("app expoe authContext apenas internamente em app.locals", async () => {
  const supabase = createSupabaseMock({
    user: { id: "auth-user-2", email: "gestor@example.com" },
    profile: {
      id: "profile-2",
      auth_user_id: "auth-user-2",
      institution_id: "inst-2",
      role: "gestor",
      email: "gestor@example.com"
    }
  });
  const app = createApp({ authContextSupabaseClient: supabase });

  assert.equal(typeof app.locals.resolveAuthContext, "function");
  const context = await app.locals.resolveAuthContext({ headers: { authorization: "Bearer token-local" } });

  assert.equal(context.ok, true);
  assert.equal(context.userId, "auth-user-2");
  assert.equal(context.institutionId, "inst-2");
  assert.equal(context.companyId, "inst-2");
  assert.equal(context.role, "gestor");
  assert.equal(context.profile.id, "profile-2");
});
