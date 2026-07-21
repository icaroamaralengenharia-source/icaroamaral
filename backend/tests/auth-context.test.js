import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { resolveAuthContext } from "../src/auth-context.js";

function createSupabaseMock({ user = null, profile = null, userError = null, profileError = null } = {}) {
  const calls = [];
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

test("authContext valida Bearer Supabase e normaliza contexto multiusuario", async () => {
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

  const context = await resolveAuthContext(
    { headers: { authorization: "Bearer token-valido" } },
    { supabase }
  );

  assert.equal(context.ok, true);
  assert.equal(context.userId, "auth-user-1");
  assert.equal(context.institutionId, "inst-1");
  assert.equal(context.companyId, "company-1");
  assert.equal(context.role, "admin");
  assert.equal(context.profile.id, "profile-1");
  assert.deepEqual(supabase.calls.filter((call) => call.type === "eq")[0], {
    type: "eq",
    column: "auth_user_id",
    value: "auth-user-1"
  });
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
