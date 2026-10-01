import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

function createSupabaseMock(user, profile) {
  return {
    auth: {
      async getUser() {
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

async function startServer(service, authContextSupabaseClient) {
  const app = createApp({ obraReportTransactionalService: service, authContextSupabaseClient });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    base: "http://127.0.0.1:" + server.address().port,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500",
      Authorization: "Bearer canonical-token"
    }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

const userA = { id: "auth-a", email: "a@example.test" };
const profileA = { id: "profile-a", auth_user_id: userA.id, institution_id: "tenant-a", company_id: "company-a", role: "admin" };
const userB = { id: "auth-b", email: "b@example.test" };
const profileB = { id: "profile-b", auth_user_id: userB.id, institution_id: "tenant-b", company_id: "company-b", role: "admin" };

test("RDO P0 isola lista, detalhe e update pelo tenant canônico do profile", async () => {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-rdo-tenant-p0-"));
  const service = createObraReportTransactionalService({ dataPath: join(dir, "obrareport.json") });
  let serverA = null;
  let serverB = null;
  try {
    serverA = await startServer(service, createSupabaseMock(userA, profileA));
    const created = await json(serverA.base, "/api/obrareport/rdos", {
      method: "POST",
      headers: { "x-institution-id": "tenant-b", "x-user-id": "forged-user" },
      body: JSON.stringify({
        institutionId: "tenant-b",
        companyId: "company-b",
        projectId: "work-a",
        title: "RDO A",
        rdoData: { date: "2026-09-14", observation: "original" }
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.rdo.institution_id, "tenant-a");
    assert.equal(created.data.rdo.created_by, "profile-a");
    const id = created.data.rdo.id;

    const sameTenantList = await json(serverA.base, "/api/obrareport/rdos?institutionId=tenant-b");
    assert.equal(sameTenantList.response.status, 200);
    assert.deepEqual(sameTenantList.data.rdos.map((rdo) => rdo.id), [id]);
    const sameTenantDetail = await json(serverA.base, "/api/obrareport/rdos/" + id);
    assert.equal(sameTenantDetail.response.status, 200);
    assert.equal(sameTenantDetail.data.rdo.rdo_data_json.observation, "original");

    const sameTenantUpdate = await json(serverA.base, "/api/obrareport/rdos/" + id, {
      method: "PUT",
      body: JSON.stringify({ institutionId: "tenant-b", rdoData: { date: "2026-09-14", observation: "same-tenant-update" } })
    });
    assert.equal(sameTenantUpdate.response.status, 200);
    assert.equal(sameTenantUpdate.data.rdo.institution_id, "tenant-a");
    assert.equal(sameTenantUpdate.data.rdo.rdo_data_json.observation, "same-tenant-update");
    await serverA.close();
    serverA = null;

    serverB = await startServer(service, createSupabaseMock(userB, profileB));
    const crossTenantList = await json(serverB.base, "/api/obrareport/rdos?institutionId=tenant-a", {
      headers: { "x-institution-id": "tenant-a", "x-user-id": "forged-user-a" }
    });
    assert.equal(crossTenantList.response.status, 200);
    assert.deepEqual(crossTenantList.data.rdos, []);

    const crossTenantDetail = await json(serverB.base, "/api/obrareport/rdos/" + id, {
      headers: { "x-institution-id": "tenant-a", "x-user-id": "forged-user-a" }
    });
    assert.equal(crossTenantDetail.response.status, 403);
    assert.equal(crossTenantDetail.data.error, "rdo_forbidden");

    const crossTenantUpdate = await json(serverB.base, "/api/obrareport/rdos/" + id, {
      method: "PUT",
      headers: { "x-institution-id": "tenant-a", "x-user-id": "forged-user-a" },
      body: JSON.stringify({ institutionId: "tenant-a", rdoData: { date: "2026-09-14", observation: "CROSS_TENANT_SHOULD_BE_BLOCKED" } })
    });
    assert.equal(crossTenantUpdate.response.status, 403);
    assert.equal(crossTenantUpdate.data.error, "rdo_forbidden");
    await serverB.close();
    serverB = null;

    serverA = await startServer(service, createSupabaseMock(userA, profileA));
    const unchanged = await json(serverA.base, "/api/obrareport/rdos/" + id);
    assert.equal(unchanged.response.status, 200);
    assert.equal(unchanged.data.rdo.rdo_data_json.observation, "same-tenant-update");
  } finally {
    if (serverB) await serverB.close();
    if (serverA) await serverA.close();
    rmSync(dir, { recursive: true, force: true });
  }
});