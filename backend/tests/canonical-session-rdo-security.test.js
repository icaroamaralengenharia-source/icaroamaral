import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

function createSupabaseMock({ user = null, profile = null, userError = null } = {}) {
  return {
    auth: {
      async getUser() {
        if (userError) return { data: null, error: userError };
        return { data: { user }, error: null };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq() {
              return { async maybeSingle() { return { data: profile, error: null }; } };
            }
          };
        }
      };
    }
  };
}

function createRdoServiceSpy() {
  const calls = [];
  return {
    calls,
    createRdo(context, body) {
      calls.push({ context, body });
      return { id: "rdo-security-test", institution_id: context.institutionId, project_id: body.projectId, rdo_date: body.rdoDate, title: body.title || "RDO" };
    }
  };
}

async function withServer(options, callback) {
  const app = createApp(options);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

const authUser = { id: "auth-user-real", email: "real@example.com" };
const profile = { id: "profile-real", auth_user_id: authUser.id, institution_id: "tenant-real", company_id: "company-real", role: "admin", email: authUser.email };

test("RDO exige sessão canônica e rejeita token ausente, inválido e expirado", async () => {
  await withServer({ authContextSupabaseClient: createSupabaseMock({ userError: new Error("invalid token") }) }, async (base) => {
    const missing = await fetch(base + "/api/obrareport/rdos");
    assert.equal(missing.status, 401);
    assert.equal((await missing.json()).error, "authentication_required");

    const invalid = await fetch(base + "/api/obrareport/rdos", { headers: { Authorization: "Bearer invalid" } });
    assert.equal(invalid.status, 401);
    assert.equal((await invalid.json()).error, "invalid_session");
  });

  await withServer({ authContextSupabaseClient: createSupabaseMock({ userError: new Error("jwt expired") }) }, async (base) => {
    const expired = await fetch(base + "/api/obrareport/rdos", { headers: { Authorization: "Bearer expired" } });
    assert.equal(expired.status, 401);
    assert.equal((await expired.json()).error, "invalid_session");
  });
});

test("RDO usa tenant, usuário e role do token e ignora contexto forjado do embedded", async () => {
  const service = createRdoServiceSpy();
  await withServer({ authContextSupabaseClient: createSupabaseMock({ user: authUser, profile }), obraReportTransactionalService: service }, async (base) => {
    const response = await fetch(base + "/api/obrareport/rdos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-canonical-token",
        "x-institution-id": "tenant-forged",
        "x-company-id": "company-forged",
        "x-user-id": "user-forged"
      },
      body: JSON.stringify({ institutionId: "tenant-forged", companyId: "company-forged", userId: "user-forged", projectId: "work-real", rdoDate: "2026-09-13" })
    });
    assert.equal(response.status, 201);
    assert.equal(service.calls.length, 1);
    assert.equal(service.calls[0].context.institutionId, "tenant-real");
    assert.equal(service.calls[0].context.companyId, "company-real");
    assert.equal(service.calls[0].context.userId, "auth-user-real");
    assert.equal(service.calls[0].context.role, "admin");
    assert.equal((await response.json()).rdo.institution_id, "tenant-real");
  });
});
