import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

const AUTH_USERS = {
  "token-a": { id: "auth-a", email: "a@example.com", profile: { id: "profile-a", auth_user_id: "auth-a", institution_id: "inst-a", company_id: "company-a", role: "admin" } },
  "token-b": { id: "auth-b", email: "b@example.com", profile: { id: "profile-b", auth_user_id: "auth-b", institution_id: "inst-b", company_id: "company-b", role: "admin" } }
};

function authClient() {
  return {
    auth: { async getUser(token) { const item = AUTH_USERS[token]; return item ? { data: { user: { id: item.id, email: item.email } }, error: null } : { data: null, error: new Error("invalid_session") }; } },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(_column, userId) {
              return {
                async maybeSingle() {
                  const item = Object.values(AUTH_USERS).find((candidate) => candidate.id === userId);
                  return { data: item ? item.profile : null, error: null };
                }
              };
            }
          };
        }
      };
    }
  };
}

async function withServer(callback) {
  const dir = mkdtempSync(join(tmpdir(), "step10-security-"));
  const app = createApp({
    obraReportTransactionalService: createObraReportTransactionalService({ dataPath: join(dir, "obrareport.json") }),
    authContextSupabaseClient: authClient(),
    municipalAdminSupabaseClient: authClient()
  });
  const server = await new Promise((resolve) => { const instance = app.listen(0, () => resolve(instance)); });
  try { await callback("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); }
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({ headers: { "Content-Type": "application/json" } }, options, { headers: Object.assign({ "Content-Type": "application/json" }, options.headers || {}) }));
  return { response, data: await response.json() };
}

test("Step 10: anonymous and forged context cannot reach technical reports", async () => {
  await withServer(async (base) => {
    const response = await json(base, "/api/obrareport/reports", {
      method: "POST",
      headers: { "x-institution-id": "inst-forged", "x-user-id": "user-forged" },
      body: JSON.stringify({ institutionId: "inst-forged", userId: "user-forged", title: "IDOR" })
    });
    assert.equal(response.response.status, 401);
    assert.equal(response.data.error, "authentication_required");
    assert.equal(response.response.headers.get("cache-control"), "private, no-store");
  });
});

test("Step 10: authenticated reports stay private and cacheless", async () => {
  await withServer(async (base) => {
    const report = await json(base, "/api/obrareport/reports", {
      method: "POST",
      headers: { Authorization: "Bearer token-a" },
      body: JSON.stringify({ institutionId: "inst-forged", projectId: "work-a", title: "Seguro", reportData: { title: "Seguro" } })
    });
    assert.equal(report.response.status, 201);
    assert.equal(report.data.report.institution_id, "inst-a");
    assert.equal(report.response.headers.get("cache-control"), "private, no-store");

    const municipal = await json(base, "/api/municipal-admin/me");
    assert.equal(municipal.response.status, 401);
    assert.equal(municipal.response.headers.get("cache-control"), "private, no-store");
  });
});

test("Step 10: local-only mode cannot satisfy authenticated private access", () => {
  const source = readFileSync(join("relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
  assert.match(source, /appState\.session\.localOnly !== true/);
  assert.match(source, /function loginLocalFallback_\(/);
  const municipal = readFileSync(join("relatorio-qualidade-obras", "municipal-admin-ui.js"), "utf8");
  assert.match(municipal, /function restorePrivateSession\(\)\{return false\}/);
  assert.doesNotMatch(municipal, /restorePrivateSession\(\)\)return true/);
});
