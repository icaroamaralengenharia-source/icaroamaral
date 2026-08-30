import assert from "node:assert/strict";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/app.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..", "..");
const fixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-corrected.json");
const pdfBytes = Buffer.from("%PDF-1.4\n% protected trial smoke\n%%EOF\n", "utf8");
const institutionA = "11111111-1111-4111-8111-111111111111";
const institutionB = "22222222-2222-4222-8222-222222222222";
const legacyCompanyA = "99999999-9999-4999-8999-999999999999";
const inspectionA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const inspectionB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const inspectionC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function readFixture(inspectionId = inspectionA, mode = "draft") {
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  payload.mode = mode;
  payload.inspection_id = inspectionId;
  payload.report.inspection.id = inspectionId;
  payload.report.inspection.status = mode === "final" ? "completed" : "draft";
  payload.report.inspection.finalizada = mode === "final";
  return payload;
}

async function withServer(app, callback) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

function createAuthClient() {
  const usersByToken = new Map([
    ["token-a", { id: "user-a" }],
    ["token-b", { id: "user-b" }],
    ["token-other", { id: "user-other" }]
  ]);
  const profiles = new Map([
    ["user-a", { id: "profile-a", auth_user_id: "user-a", company_id: legacyCompanyA, institution_id: institutionA, role: "admin", status: "ativo" }],
    ["user-b", { id: "profile-b", auth_user_id: "user-b", company_id: legacyCompanyA, institution_id: institutionA, role: "user", status: "ativo" }],
    ["user-other", { id: "profile-other", auth_user_id: "user-other", company_id: legacyCompanyA, institution_id: institutionB, role: "user", status: "ativo" }]
  ]);
  return {
    auth: {
      async getUser(token) {
        const user = usersByToken.get(token);
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid" } };
      }
    },
    from(table) {
      assert.equal(table, "profiles");
      let authUserId = "";
      return {
        select() { return this; },
        eq(column, value) { if (column === "auth_user_id") authUserId = String(value); return this; },
        async maybeSingle() { return { data: profiles.get(authUserId) || null, error: null }; }
      };
    }
  };
}

function createAppForAccess(accessByInstitution, options = {}) {
  const calls = { resolver: [], authorizer: [], generator: 0 };
  const app = createApp({
    authContextSupabaseClient: createAuthClient(),
    resolveApartmentHandoverAccess({ institutionId }) {
      calls.resolver.push({ institutionId });
      return accessByInstitution[institutionId] || { allowed: false, status: "no_entitlement", code: "NO_ENTITLEMENT", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false };
    },
    authorizeApartmentHandoverInspectionUsage(input) {
      calls.authorizer.push({ institutionId: input.institutionId, inspectionId: input.inspectionId, consume: input.consume });
      return options.authorize ? options.authorize(input) : { allowed: true, status: "trial_active", consumed: input.consume === true, trialUsed: 1, trialLimit: 2, remaining: 1, canCreate: true };
    },
    async apartmentHandoverPdfGenerator(payload, outputPath) {
      calls.generator += 1;
      writeFileSync(outputPath, options.pdfBytes || pdfBytes);
      return { ok: true, payload };
    }
  });
  return { app, calls };
}

async function postProtected(base, token, payload = readFixture(), extraHeaders = {}) {
  const headers = { "Content-Type": "application/json", ...extraHeaders };
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(base + "/api/apartment-handover/pdf-protected", { method: "POST", headers, body: JSON.stringify(payload) });
}

test("GET /api/apartment-handover/access exige Authorization Bearer", async () => {
  const { app, calls } = createAppForAccess({});
  await withServer(app, async (base) => {
    const missing = await fetch(base + "/api/apartment-handover/access");
    assert.equal(missing.status, 401);
    assert.equal(calls.resolver.length, 0);

    const invalid = await fetch(base + "/api/apartment-handover/access", { headers: { Authorization: "Bearer invalid" } });
    assert.equal(invalid.status, 401);
    assert.equal(calls.resolver.length, 0);
  });
});

test("GET /api/apartment-handover/access retorna contagem por institution sem horario", async () => {
  const access = { allowed: true, status: "trial_active", trialUsed: 1, trialLimit: 2, remaining: 1, canCreate: true };
  const { app, calls } = createAppForAccess({ [institutionA]: access });
  await withServer(app, async (base) => {
    const first = await fetch(base + "/api/apartment-handover/access?institution_id=" + institutionB, {
      headers: { Authorization: "Bearer token-a", "x-institution-id": institutionB }
    });
    const second = await fetch(base + "/api/apartment-handover/access", { headers: { Authorization: "Bearer token-b" } });
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    const body = await first.json();
    assert.equal(body.trial_used, 1);
    assert.equal(body.trial_limit, 2);
    assert.equal(body.remaining, 1);
    assert.equal(body.can_create, true);
    assert.equal("trial_expires_at" in body, false);
    assert.equal("remaining_seconds" in body, false);
    assert.equal(calls.resolver.every((call) => call.institutionId === institutionA), true);
  });
});

test("GET access trial_exhausted continua allowed para consulta mas can_create=false", async () => {
  const { app } = createAppForAccess({ [institutionA]: { allowed: true, status: "trial_exhausted", trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: false } });
  await withServer(app, async (base) => {
    const response = await fetch(base + "/api/apartment-handover/access", { headers: { Authorization: "Bearer token-a" } });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.allowed, true);
    assert.equal(body.status, "trial_exhausted");
    assert.equal(body.can_create, false);
  });
});

test("institution diferente nao herda entitlement", async () => {
  const { app } = createAppForAccess({ [institutionA]: { allowed: true, status: "active", trialUsed: 0, trialLimit: 2, remaining: 2, canCreate: true } });
  await withServer(app, async (base) => {
    const response = await fetch(base + "/api/apartment-handover/access", { headers: { Authorization: "Bearer token-other" } });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).code, "NO_ENTITLEMENT");
  });
});

test("POST /api/apartment-handover/pdf-protected nega sem token, sem entitlement e blocked antes do generator", async () => {
  for (const access of [
    { allowed: false, status: "no_entitlement", code: "NO_ENTITLEMENT", trialUsed: 0, trialLimit: 0, remaining: 0, canCreate: false },
    { allowed: false, status: "blocked", code: "MODULE_BLOCKED", trialUsed: 0, trialLimit: 2, remaining: 2, canCreate: false }
  ]) {
    const { app, calls } = createAppForAccess({ [institutionA]: access });
    await withServer(app, async (base) => {
      const missing = await postProtected(base, "");
      assert.equal(missing.status, 401);
      assert.equal(calls.generator, 0);

      const denied = await postProtected(base, "token-a", readFixture(inspectionA, "final"));
      assert.equal(denied.status, 403);
      assert.equal((await denied.json()).code, access.code);
      assert.equal(calls.generator, 0);
      assert.equal(calls.authorizer.length, 0);
    });
  }
});

test("POST protegido exige inspection_id", async () => {
  const { app, calls } = createAppForAccess({ [institutionA]: { allowed: true, status: "trial_active", trialUsed: 0, trialLimit: 2, remaining: 2, canCreate: true } });
  await withServer(app, async (base) => {
    const payload = readFixture("", "final");
    delete payload.inspection_id;
    delete payload.report.inspection.id;
    const response = await postProtected(base, "token-a", payload);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).code, "INSPECTION_ID_REQUIRED");
    assert.equal(calls.generator, 0);
  });
});

test("POST protegido consome somente PDF final e passa inspection_id para authorizer", async () => {
  const { app, calls } = createAppForAccess({ [institutionA]: { allowed: true, status: "trial_active", trialUsed: 0, trialLimit: 2, remaining: 2, canCreate: true } });
  await withServer(app, async (base) => {
    const draft = await postProtected(base, "token-a", readFixture(inspectionA, "draft"), { "x-institution-id": institutionB });
    const final = await postProtected(base, "token-a", readFixture(inspectionA, "final"), { "x-institution-id": institutionB });
    assert.equal(draft.status, 200);
    assert.equal(final.status, 200);
    assert.deepEqual(calls.authorizer.map((call) => ({ institutionId: call.institutionId, inspectionId: call.inspectionId, consume: call.consume })), [
      { institutionId: institutionA, inspectionId: inspectionA, consume: false },
      { institutionId: institutionA, inspectionId: inspectionA, consume: true }
    ]);
    assert.equal(calls.generator, 2);
  });
});

test("trial_exhausted permite reprint de vistoria no ledger e bloqueia terceira", async () => {
  const allowedIds = new Set([inspectionA, inspectionB]);
  const { app, calls } = createAppForAccess(
    { [institutionA]: { allowed: true, status: "trial_exhausted", trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: false } },
    { authorize: ({ inspectionId }) => allowedIds.has(inspectionId)
      ? { allowed: true, status: "trial_exhausted", consumed: false, trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: false }
      : { allowed: false, status: "trial_exhausted", code: "TRIAL_EXHAUSTED", consumed: false, trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: false } }
  );
  await withServer(app, async (base) => {
    assert.equal((await postProtected(base, "token-a", readFixture(inspectionA, "final"))).status, 200);
    assert.equal((await postProtected(base, "token-a", readFixture(inspectionB, "final"))).status, 200);
    const third = await postProtected(base, "token-a", readFixture(inspectionC, "final"));
    assert.equal(third.status, 403);
    assert.equal((await third.json()).code, "TRIAL_EXHAUSTED");
    assert.equal(calls.generator, 2);
  });
});

test("active permite PDF sem consumir unidade", async () => {
  const { app, calls } = createAppForAccess({ [institutionA]: { allowed: true, status: "active", trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: true } }, {
    authorize: () => ({ allowed: true, status: "active", consumed: false, trialUsed: 2, trialLimit: 2, remaining: 0, canCreate: true })
  });
  await withServer(app, async (base) => {
    const response = await postProtected(base, "token-a", readFixture(inspectionC, "final"));
    assert.equal(response.status, 200);
    assert.equal(calls.authorizer[0].consume, true);
    assert.equal(calls.authorizer[0].institutionId, institutionA);
    assert.equal(calls.generator, 1);
  });
});

test("CORS preflight do endpoint protegido aceita Authorization sem wildcard", async () => {
  const { app } = createAppForAccess({});
  await withServer(app, async (base) => {
    const response = await fetch(base + "/api/apartment-handover/pdf-protected", {
      method: "OPTIONS",
      headers: {
        Origin: "https://convergence-files-thou-environment.trycloudflare.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization,content-type"
      }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://convergence-files-thou-environment.trycloudflare.com");
    assert.notEqual(response.headers.get("access-control-allow-origin"), "*");
    assert.match(response.headers.get("access-control-allow-headers") || "", /authorization/i);
  });
});
