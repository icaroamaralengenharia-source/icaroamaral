import { expect, test } from "@playwright/test";
import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "../../backend/src/app.js";
import { authorizeApartmentHandoverInspectionUsage, resolveApartmentHandoverAccess } from "../../backend/src/apartment-handover-access-service.js";

const appUrl = process.env.VISTORIA_BASE_URL || "http://127.0.0.1:5541";
const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, "..", "..");
const fixturePath = join(repoRoot, "tests", "fixtures", "apartment-handover-inspection-144-corrected.json");
const institutionA = "11111111-1111-4111-8111-111111111111";
const institutionB = "22222222-2222-4222-8222-222222222222";
const legacyCompany = "99999999-9999-4999-8999-999999999999";
const inspectionA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const inspectionB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const inspectionC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
function readFixture(inspectionId, mode = "final") {
  const payload = JSON.parse(readFileSync(fixturePath, "utf8"));
  payload.mode = mode;
  payload.inspection_id = inspectionId;
  payload.report.inspection.id = inspectionId;
  payload.report.inspection.status = mode === "final" ? "completed" : "draft";
  payload.report.inspection.finalizada = mode === "final";
  return payload;
}

function createAuthClient() {
  const usersByToken = new Map([
    ["token-a", { id: "user-a" }],
    ["token-b", { id: "user-b" }],
    ["token-other", { id: "user-other" }]
  ]);
  const profiles = new Map([
    ["user-a", { id: "profile-a", auth_user_id: "user-a", company_id: legacyCompany, institution_id: institutionA, role: "admin", status: "ativo" }],
    ["user-b", { id: "profile-b", auth_user_id: "user-b", company_id: legacyCompany, institution_id: institutionA, role: "user", status: "ativo" }],
    ["user-other", { id: "profile-other", auth_user_id: "user-other", company_id: legacyCompany, institution_id: institutionB, role: "user", status: "ativo" }]
  ]);
  return {
    auth: { async getUser(token) { const user = usersByToken.get(token); return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: "invalid" } }; } },
    from(table) {
      if (table !== "profiles") throw new Error("unexpected auth table " + table);
      let authUserId = "";
      return { select() { return this; }, eq(column, value) { if (column === "auth_user_id") authUserId = String(value); return this; }, async maybeSingle() { return { data: profiles.get(authUserId) || null, error: null }; } };
    }
  };
}

function createEntitlementClient(state) {
  function queryBuilder() {
    const filters = [];
    return {
      select() { return this; },
      eq(column, value) { filters.push({ column, value: String(value) }); return this; },
      async maybeSingle() {
        const row = state.rows.find((item) => filters.every((filter) => String(item[filter.column]) === filter.value));
        return { data: clone(row || null), error: null };
      }
    };
  }
  function result(row, values) {
    const trialLimit = Number(row && row.trial_limit || 0);
    const trialUsed = Number(row && row.trial_used || 0);
    return { allowed: Boolean(values.allowed), consumed: Boolean(values.consumed), status: values.status, code: values.code || null, trial_used: trialUsed, trial_limit: trialLimit, remaining: Math.max(0, trialLimit - trialUsed) };
  }
  function consume(args) {
    const institutionId = String(args.p_institution_id || "");
    const inspectionId = String(args.p_inspection_id || "");
    const shouldConsume = args.p_consume !== false;
    const row = state.rows.find((item) => item.institution_id === institutionId && item.module_key === "apartment_handover");
    if (!row) return { allowed: false, consumed: false, status: "no_entitlement", code: "NO_ENTITLEMENT", trial_used: 0, trial_limit: 0, remaining: 0 };
    if (row.status === "blocked") return result(row, { allowed: false, status: "blocked", code: "MODULE_BLOCKED" });
    if (row.status === "active") return result(row, { allowed: true, status: "active" });
    const existing = state.usages.find((usage) => usage.institution_id === institutionId && usage.inspection_id === inspectionId);
    if (existing) return result(row, { allowed: true, status: row.status });
    if (row.status === "trial_exhausted" || row.trial_used >= row.trial_limit) { row.status = "trial_exhausted"; return result(row, { allowed: false, status: "trial_exhausted", code: "TRIAL_EXHAUSTED" }); }
    if (!shouldConsume) return result(row, { allowed: true, status: row.status });
    state.usages.push({ institution_id: institutionId, module_key: "apartment_handover", inspection_id: inspectionId });
    row.trial_used += 1;
    if (row.trial_used >= row.trial_limit) row.status = "trial_exhausted";
    return result(row, { allowed: true, consumed: true, status: row.status });
  }
  return {
    from(table) {
      if (table !== "institution_module_entitlements") throw new Error("unexpected entitlement table " + table);
      return { select() { return queryBuilder(); } };
    },
    rpc(name, args) {
      if (name !== "consume_apartment_handover_trial_usage") throw new Error("unexpected rpc " + name);
      return { single: async () => ({ data: clone(consume(args || {})), error: null }) };
    }
  };
}

async function startBackend(state) {
  const client = createEntitlementClient(state);
  const app = createApp({
    authContextSupabaseClient: createAuthClient(),
    apartmentHandoverEntitlementSupabaseClient: client,
    resolveApartmentHandoverAccess(input) { return resolveApartmentHandoverAccess({ ...input, supabase: client }); },
    authorizeApartmentHandoverInspectionUsage(input) { return authorizeApartmentHandoverInspectionUsage({ ...input, supabase: client }); },
    async apartmentHandoverPdfGenerator(payload, outputPath) {
      state.pdfBuilderCalls += 1;
      writeFileSync(outputPath, Buffer.from("%PDF-1.4\n% trial two inspections e2e\n%%EOF\n", "utf8"));
      return { ok: true, payload };
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function openTrial(page, baseUrl, token) {
  await page.addInitScript(({ baseUrl, token }) => {
    window.OBRAREPORT_API_BASE_URL = baseUrl;
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem("icaro_site_access_v2", JSON.stringify({ authenticated: true, createdAt: Date.now(), expiresAt: Date.now() + 3600000 }));
    localStorage.setItem("sb-trial-auth-token", JSON.stringify({ currentSession: { access_token: token } }));
  }, { baseUrl, token });
  await page.goto(`${appUrl}/vistoria-entrega-apartamento-trial/index.html`);
}

async function protectedPdf(page, inspectionId, mode = "final") {
  return page.evaluate(async (payload) => {
    const response = await fetch(window.OBRAREPORT_API_BASE_URL + "/api/apartment-handover/pdf-protected", {
      method: "POST",
      headers: window.ApartmentHandoverAccess.authenticatedHeaders({ "Content-Type": "application/json", "x-institution-id": "ignored-by-backend" }),
      body: JSON.stringify(payload)
    });
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/pdf")) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      return { status: response.status, contentType, prefix: String.fromCharCode(...bytes.slice(0, 4)), length: bytes.length };
    }
    return { status: response.status, contentType, body: await response.json() };
  }, readFixture(inspectionId, mode));
}

test("trial paralelo limita 2 vistorias concluidas por institution e preserva reprint", async ({ browser }) => {
  const state = {
    pdfBuilderCalls: 0,
    rows: [
      { id: "ent-a", institution_id: institutionA, module_key: "apartment_handover", status: "trial_active", trial_limit: 2, trial_used: 0 },
      { id: "ent-b", institution_id: institutionB, module_key: "apartment_handover", status: "trial_active", trial_limit: 2, trial_used: 0 }
    ],
    usages: []
  };
  const backend = await startBackend(state);
  try {
    const contextA = await browser.newContext();
    const pageA = await contextA.newPage();
    await openTrial(pageA, backend.baseUrl, "token-a");
    await expect(pageA.locator("[data-start-inspection]")).toBeVisible();
    await expect(pageA.locator("[data-trial-banner]")).toContainText("0 de 2 vistorias utilizadas");

    const first = await protectedPdf(pageA, inspectionA, "final");
    expect(first.status).toBe(200);
    expect(first.prefix).toBe("%PDF");
    expect(state.rows[0].trial_used).toBe(1);
    expect(state.usages.filter((usage) => usage.inspection_id === inspectionA)).toHaveLength(1);

    const firstAgain = await protectedPdf(pageA, inspectionA, "final");
    expect(firstAgain.status).toBe(200);
    expect(state.rows[0].trial_used).toBe(1);
    expect(state.usages).toHaveLength(1);

    await pageA.reload();
    await expect(pageA.locator("[data-trial-banner]")).toContainText("1 de 2 vistorias utilizadas");

    const contextB = await browser.newContext();
    const pageB = await contextB.newPage();
    await openTrial(pageB, backend.baseUrl, "token-b");
    await expect(pageB.locator("[data-trial-banner]")).toContainText("1 de 2 vistorias utilizadas");

    const second = await protectedPdf(pageB, inspectionB, "final");
    expect(second.status).toBe(200);
    expect(state.rows[0].trial_used).toBe(2);
    expect(state.rows[0].status).toBe("trial_exhausted");
    expect(state.usages).toHaveLength(2);

    await pageA.reload();
    await expect(pageA.locator("[data-trial-banner]")).toContainText("Teste concluído. 2 de 2 vistorias utilizadas");

    expect((await protectedPdf(pageA, inspectionA, "final")).status).toBe(200);
    expect((await protectedPdf(pageA, inspectionB, "final")).status).toBe(200);
    const third = await protectedPdf(pageA, inspectionC, "final");
    expect(third.status).toBe(403);
    expect(third.body.code).toBe("TRIAL_EXHAUSTED");
    expect(state.rows[0].trial_used).toBe(2);

    const contextOther = await browser.newContext();
    const pageOther = await contextOther.newPage();
    await openTrial(pageOther, backend.baseUrl, "token-other");
    await expect(pageOther.locator("[data-trial-banner]")).toContainText("0 de 2 vistorias utilizadas");

    state.rows[0].status = "trial_active";
    state.rows[0].trial_used = 1;
    state.usages = [{ institution_id: institutionA, module_key: "apartment_handover", inspection_id: inspectionA }];
    const concurrent = await Promise.all([protectedPdf(pageA, inspectionB, "final"), protectedPdf(pageA, inspectionC, "final")]);
    expect(concurrent.filter((result) => result.status === 200)).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 403)).toHaveLength(1);
    expect(state.rows[0].trial_used).toBe(2);
    expect(state.rows[0].trial_used <= state.rows[0].trial_limit).toBe(true);

    state.rows[0].status = "active";
    const active = await protectedPdf(pageA, inspectionC, "final");
    expect(active.status).toBe(200);

    state.rows[0].status = "blocked";
    await pageA.reload();
    await expect(pageA.locator("text=ACESSO BLOQUEADO")).toBeVisible();
    const blocked = await protectedPdf(pageA, inspectionC, "final");
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe("MODULE_BLOCKED");

    await contextA.close();
    await contextB.close();
    await contextOther.close();
  } finally {
    await new Promise((resolve, reject) => backend.server.close((error) => error ? reject(error) : resolve()));
  }
});
