import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createObraReportTransactionalService } from "../src/services/obrareport-transactional-service.js";

const profiles = {
  userA: { id: "profile-a", auth_user_id: "user-a", institution_id: "tenant-a", company_id: "tenant-a", role: "admin" },
  userB: { id: "profile-b", auth_user_id: "user-b", institution_id: "tenant-b", company_id: "tenant-b", role: "admin" }
};

function authClient() {
  return {
    auth: {
      async getUser(token) {
        const id = token === "token-b" ? "user-b" : "user-a";
        return { data: { user: { id, email: id + "@example.test" } }, error: null };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() {
          return {
            eq(_column, userId) {
              return { async maybeSingle() {
                const profile = userId === "user-b" ? profiles.userB : profiles.userA;
                return { data: profile, error: null };
              } };
            }
          };
        }
      };
    }
  };
}

async function startServer(options) {
  const app = createApp(options);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    base: "http://127.0.0.1:" + server.address().port,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function json(base, path, options = {}) {
  const response = await fetch(base + path, Object.assign({}, options, {
    headers: Object.assign({
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500",
      Authorization: "Bearer " + (options.token || "token-a")
    }, options.headers || {})
  }));
  return { response, data: await response.json() };
}

test("RDO exige obra canônica do tenant no create/list/get/update/version/PDF/events", async () => {
  const dir = mkdtempSync(join(tmpdir(), "obrareport-rdo-work-scope-"));
  const service = createObraReportTransactionalService({ dataPath: join(dir, "obrareport.json") });
  const projects = new Map([
    ["WORK_A1", { id: "WORK_A1", institution_id: "tenant-a" }],
    ["WORK_A2", { id: "WORK_A2", institution_id: "tenant-a" }],
    ["WORK_B1", { id: "WORK_B1", institution_id: "tenant-b" }]
  ]);
  const app = await startServer({
    obraReportTransactionalService: service,
    authContextSupabaseClient: authClient(),
    rdoWorkScopeValidator: async (context, projectId) => {
      const project = projects.get(projectId);
      if (!project || project.institution_id !== context.institutionId) {
        throw Object.assign(new Error("rdo_project_not_found"), { status: 404 });
      }
      return project;
    }
  });

  try {
    const created = await json(app.base, "/api/obrareport/rdos", {
      method: "POST",
      body: JSON.stringify({
        institutionId: "tenant-b",
        projectId: "WORK_A1",
        title: "RDO A1",
        idempotencyKey: "rdo-ui-a1-001",
        rdoData: { operationId: "rdo-ui-a1-001", date: "2026-10-11", summary: "Fixture A1" }
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.data.rdo.institution_id, "tenant-a");
    assert.equal(created.data.rdo.project_id, "WORK_A1");
    const id = created.data.rdo.id;

    const listedA1 = await json(app.base, "/api/obrareport/rdos?projectId=WORK_A1");
    assert.equal(listedA1.response.status, 200);
    assert.deepEqual(listedA1.data.rdos.map((rdo) => rdo.id), [id]);
    const listedA2 = await json(app.base, "/api/obrareport/rdos?projectId=WORK_A2");
    assert.equal(listedA2.response.status, 200);
    assert.deepEqual(listedA2.data.rdos, []);

    const foreignCreate = await json(app.base, "/api/obrareport/rdos", {
      method: "POST",
      body: JSON.stringify({
        projectId: "WORK_B1",
        idempotencyKey: "rdo-ui-cross-tenant",
        rdoData: { operationId: "rdo-ui-cross-tenant", date: "2026-10-11" }
      })
    });
    assert.equal(foreignCreate.response.status, 404);

    const mismatchedUpdate = await json(app.base, "/api/obrareport/rdos/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify({ projectId: "WORK_A2", rdoData: { operationId: "rdo-ui-a1-001", summary: "move attempt" } })
    });
    assert.equal(mismatchedUpdate.response.status, 403);

    const tenantBCreate = await json(app.base, "/api/obrareport/rdos", {
      method: "POST",
      token: "token-b",
      body: JSON.stringify({
        projectId: "WORK_B1",
        idempotencyKey: "rdo-ui-b1-001",
        rdoData: { operationId: "rdo-ui-b1-001", date: "2026-10-11" }
      })
    });
    assert.equal(tenantBCreate.response.status, 201);
    const foreignId = tenantBCreate.data.rdo.id;
    const directTenantRead = await json(app.base, "/api/obrareport/rdos/" + encodeURIComponent(foreignId));
    assert.equal(directTenantRead.response.status, 403);

    projects.set("WORK_A1", { id: "WORK_A1", institution_id: "tenant-b" });
    const paths = [
      ["GET", "/api/obrareport/rdos/" + encodeURIComponent(id)],
      ["PUT", "/api/obrareport/rdos/" + encodeURIComponent(id)],
      ["POST", "/api/obrareport/rdos/" + encodeURIComponent(id) + "/versions"],
      ["POST", "/api/obrareport/rdos/" + encodeURIComponent(id) + "/generate-document"],
      ["GET", "/api/obrareport/rdos/" + encodeURIComponent(id) + "/events"],
      ["GET", "/api/obrareport/rdos?projectId=WORK_A1"]
    ];
    for (const [method, path] of paths) {
      const result = await json(app.base, path, {
        method,
        body: method === "PUT" || method === "POST" ? JSON.stringify({ rdoData: { summary: "blocked" } }) : undefined
      });
      assert.equal(result.response.status, 404, method + " " + path);
    }
  } finally {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
