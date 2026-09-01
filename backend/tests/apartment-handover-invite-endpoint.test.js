import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { APARTMENT_HANDOVER_MODULE_KEY, hashInviteToken } from "../src/apartment-handover-invite-service.js";

const SECRET = "0123456789abcdef0123456789abcdef";
const INSTITUTION_ID = "95fd8a25-14cd-4a9f-927a-c89be8a3c2bc";
const INSPECTION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_INSTITUTION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_INSPECTION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const SECOND_INSPECTION_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const THIRD_INSPECTION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

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

class Query {
  constructor(table, db) {
    this.table = table;
    this.db = db;
    this.filters = [];
  }
  select() { return this; }
  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }
  maybeSingle() {
    const records = this.table === "institution_module_entitlements" ? this.db.entitlements : [];
    return Promise.resolve({
      data: records.find((record) => this.filters.every((filter) => record[filter.column] === filter.value)) || null,
      error: null
    });
  }
}

class EndpointDb {
  constructor(inviteOverrides = {}, entitlementOverrides = {}) {
    this.invites = [Object.assign({
      id: "22222222-2222-4222-8222-222222222222",
      institution_id: INSTITUTION_ID,
      module_key: APARTMENT_HANDOVER_MODULE_KEY,
      token_hash: hashInviteToken("token-real"),
      status: "active",
      expires_at: "2026-09-03T12:00:00.000Z",
      max_redemptions: 3,
      redeemed_count: 0
    }, inviteOverrides)];
    this.entitlements = [Object.assign({
      id: "entitlement-1",
      institution_id: INSTITUTION_ID,
      module_key: APARTMENT_HANDOVER_MODULE_KEY,
      status: "trial_active",
      trial_limit: 2,
      trial_used: 0
    }, entitlementOverrides)];
  }
  from(table) {
    return new Query(table, this);
  }
  async rpc(name, args) {
    const invite = this.invites.find((item) => item.token_hash === args.p_token_hash);
    if (!invite) return { data: null, error: { message: "invite_not_found" } };
    if (invite.status === "revoked") return { data: null, error: { message: "invite_revoked" } };
    if (new Date(invite.expires_at) <= new Date(args.p_now)) return { data: null, error: { message: "invite_expired" } };
    if (invite.redeemed_count >= invite.max_redemptions) return { data: null, error: { message: "invite_max_redemptions_reached" } };
    invite.redeemed_count += 1;
    invite.last_redeemed_at = args.p_now;
    return { data: invite, error: null };
  }
}

function inspectionRecord(id = INSPECTION_ID, institutionId = INSTITUTION_ID) {
  return {
    id,
    institution_id: institutionId,
    title: institutionId === INSTITUTION_ID ? "TESTE LINK CONVITE AUTORIZADO" : "TESTE OUTRO TENANT",
    created_at: "2026-08-31T12:00:00.000Z",
    inspection_data_json: {
      id,
      metadata: {
        projectName: institutionId === INSTITUTION_ID ? "Empreendimento A" : "Empreendimento B",
        unitName: institutionId === INSTITUTION_ID ? "101" : "999",
        clientName: "Cliente Teste"
      },
      items: []
    }
  };
}

function inspectionService(records = [inspectionRecord()]) {
  return {
    getApartmentHandoverInspection(context, id) {
      const record = records.find((item) => item.id === id);
      if (!record || record.institution_id !== context.institutionId) {
        throw Object.assign(new Error("inspection_not_found"), { status: 404 });
      }
      return JSON.parse(JSON.stringify(record));
    }
  };
}

function appFor(db, service = inspectionService()) {
  return createApp({
    env: {
      APARTMENT_HANDOVER_INVITE_SECRET: SECRET,
      AI_ALLOWED_ORIGINS: "https://www.icaroamaral.com.br"
    },
    apartmentHandoverSupabaseClient: db,
    obraReportTransactionalService: service,
    apartmentHandoverReviewer: () => ({ canGenerateFinal: true, blockers: [] }),
    apartmentHandoverPdfGenerator: async (payload, outputPath) => {
      writeFileSync(outputPath, Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF"));
      return { ok: true };
    }
  });
}

function payload(id = INSPECTION_ID) {
  return {
    mode: "final",
    inspection_id: id,
    report: {
      type: "apartment_handover_inspection",
      empreendimento: "PAYLOAD CLIENTE NAO AUTORITATIVO",
      unidade: "999",
      inspection: { id, items: [] }
    }
  };
}


function markInspectionFinalizedForTrial(db, finalizedInspectionIds, inspectionId) {
  const entitlement = db.entitlements[0];
  if (finalizedInspectionIds.has(inspectionId)) return { consumed: false, entitlement };
  if (Number(entitlement.trial_used || 0) >= Number(entitlement.trial_limit || 0)) {
    entitlement.status = "trial_exhausted";
    throw Object.assign(new Error("trial_limit_reached"), { status: 403 });
  }
  finalizedInspectionIds.add(inspectionId);
  entitlement.trial_used = Number(entitlement.trial_used || 0) + 1;
  if (entitlement.trial_used >= entitlement.trial_limit) entitlement.status = "trial_exhausted";
  return { consumed: true, entitlement };
}

async function accessWithInvite(baseUrl, session) {
  const response = await fetch(baseUrl + "/api/apartment-handover/access", {
    headers: { "X-Apartment-Handover-Invite-Session": session }
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function inviteSession(baseUrl) {
  const redeem = await fetch(`${baseUrl}/api/apartment-handover/invite/redeem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteToken: "token-real" })
  });
  assert.equal(redeem.status, 200);
  return (await redeem.json()).invite_session;
}

test("POST redeem retorna sessao curta e GET access usa auth_mode invite 0/2", async () => {
  const db = new EndpointDb();
  await withServer(appFor(db), async (baseUrl) => {
    const redeem = await fetch(`${baseUrl}/api/apartment-handover/invite/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://www.icaroamaral.com.br" },
      body: JSON.stringify({ inviteToken: "token-real" })
    });
    assert.equal(redeem.status, 200);
    const body = await redeem.json();
    assert.equal(body.auth_mode, "invite");
    assert.equal(body.access.status, "trial_active");
    assert.equal(body.access.trial_used, 0);
    assert.equal(body.access.trial_limit, 2);
    assert.equal(body.access.remaining, 2);
    assert.equal(body.access.can_create, true);
    assert.equal(JSON.stringify(db.invites).includes("token-real"), false);

    const access = await fetch(`${baseUrl}/api/apartment-handover/access`, {
      headers: { "X-Apartment-Handover-Invite-Session": body.invite_session }
    });
    assert.equal(access.status, 200);
    const accessBody = await access.json();
    assert.equal(accessBody.auth_mode, "invite");
    assert.equal(accessBody.trial_used, 0);
    assert.equal(db.invites[0].redeemed_count, 1);
  });
});

test("POST pdf-protected aceita inspection do mesmo tenant e nao consome novo redeem", async () => {
  const db = new EndpointDb();
  await withServer(appFor(db), async (baseUrl) => {
    const session = await inviteSession(baseUrl);
    const pdf = await fetch(`${baseUrl}/api/apartment-handover/pdf-protected`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Apartment-Handover-Invite-Session": session
      },
      body: JSON.stringify(payload())
    });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get("content-type") || "", /^application\/pdf\b/);
    assert.equal(pdf.headers.get("x-apartment-handover-auth-mode"), "invite");
    assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString("utf8"), "%PDF");
    assert.equal(db.invites[0].redeemed_count, 1);
  });
});

test("POST pdf-protected bloqueia cross-tenant e inspection inexistente antes de gerar PDF", async () => {
  const db = new EndpointDb();
  const service = inspectionService([
    inspectionRecord(INSPECTION_ID, INSTITUTION_ID),
    inspectionRecord(OTHER_INSPECTION_ID, OTHER_INSTITUTION_ID)
  ]);

  await withServer(appFor(db, service), async (baseUrl) => {
    const session = await inviteSession(baseUrl);
    const headers = {
      "Content-Type": "application/json",
      "X-Apartment-Handover-Invite-Session": session
    };

    const crossTenant = await fetch(`${baseUrl}/api/apartment-handover/pdf-protected`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload(OTHER_INSPECTION_ID))
    });
    assert.equal(crossTenant.status, 404);
    assert.match(crossTenant.headers.get("content-type") || "", /^application\/json\b/);
    assert.equal((await crossTenant.json()).error, "inspection_not_found");

    const missing = await fetch(`${baseUrl}/api/apartment-handover/pdf-protected`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload("dddddddd-dddd-4ddd-8ddd-dddddddddddd"))
    });
    assert.equal(missing.status, 404);
    assert.match(missing.headers.get("content-type") || "", /^application\/json\b/);
    assert.equal((await missing.json()).error, "inspection_not_found");
  });
});


test("trial 2/2 consome somente na finalizacao idempotente da inspection", async () => {
  const db = new EndpointDb();
  const finalizedInspectionIds = new Set();
  const service = inspectionService([
    inspectionRecord(INSPECTION_ID, INSTITUTION_ID),
    inspectionRecord(SECOND_INSPECTION_ID, INSTITUTION_ID),
    inspectionRecord(THIRD_INSPECTION_ID, INSTITUTION_ID)
  ]);

  assert.equal(db.entitlements[0].trial_used, 0);
  assert.equal(db.entitlements[0].trial_limit, 2);
  assert.equal(db.invites[0].redeemed_count, 0);

  await withServer(appFor(db, service), async (baseUrl) => {
    const session = await inviteSession(baseUrl);
    assert.equal(db.entitlements[0].trial_used, 0);
    assert.equal(db.invites[0].redeemed_count, 1);

    let access = await accessWithInvite(baseUrl, session);
    assert.equal(access.trial_used, 0);
    assert.equal(access.trial_limit, 2);
    assert.equal(access.remaining, 2);
    assert.equal(access.can_create, true);

    const draft = await fetch(baseUrl + "/api/apartment-handover/pdf-protected", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Apartment-Handover-Invite-Session": session
      },
      body: JSON.stringify(Object.assign(payload(INSPECTION_ID), { mode: "draft" }))
    });
    assert.equal(draft.status, 200);
    assert.match(draft.headers.get("content-type") || "", /^application\/pdf\b/);
    assert.equal(db.entitlements[0].trial_used, 0);

    assert.equal(markInspectionFinalizedForTrial(db, finalizedInspectionIds, INSPECTION_ID).consumed, true);
    access = await accessWithInvite(baseUrl, session);
    assert.equal(access.trial_used, 1);
    assert.equal(access.remaining, 1);
    assert.equal(access.can_create, true);

    assert.equal(markInspectionFinalizedForTrial(db, finalizedInspectionIds, INSPECTION_ID).consumed, false);
    const reprintFirst = await fetch(baseUrl + "/api/apartment-handover/pdf-protected", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Apartment-Handover-Invite-Session": session
      },
      body: JSON.stringify(payload(INSPECTION_ID))
    });
    assert.equal(reprintFirst.status, 200);
    access = await accessWithInvite(baseUrl, session);
    assert.equal(access.trial_used, 1);
    assert.equal(access.remaining, 1);

    assert.equal(markInspectionFinalizedForTrial(db, finalizedInspectionIds, SECOND_INSPECTION_ID).consumed, true);
    access = await accessWithInvite(baseUrl, session);
    assert.equal(access.status, "trial_exhausted");
    assert.equal(access.trial_used, 2);
    assert.equal(access.remaining, 0);
    assert.equal(access.can_create, false);
    assert.equal(access.read_only, true);

    assert.equal(markInspectionFinalizedForTrial(db, finalizedInspectionIds, SECOND_INSPECTION_ID).consumed, false);
    access = await accessWithInvite(baseUrl, session);
    assert.equal(access.trial_used, 2);
    assert.equal(access.remaining, 0);

    assert.throws(() => markInspectionFinalizedForTrial(db, finalizedInspectionIds, THIRD_INSPECTION_ID), /trial_limit_reached/);
    access = await accessWithInvite(baseUrl, session);
    assert.equal(access.trial_used, 2);
    assert.equal(access.can_create, false);
  });
});


test("redeem exposto retorna mensagens amigaveis para convite invalido, expirado, revogado e usado", async () => {
  const cases = [
    [new EndpointDb(), "outro-token", 404, "CONVITE INVALIDO"],
    [new EndpointDb({ expires_at: "2026-08-01T00:00:00.000Z" }), "token-real", 410, "CONVITE EXPIRADO"],
    [new EndpointDb({ status: "revoked" }), "token-real", 403, "CONVITE REVOGADO"],
    [new EndpointDb({ redeemed_count: 3, max_redemptions: 3 }), "token-real", 409, "CONVITE JA UTILIZADO"]
  ];

  for (const [db, token, status, message] of cases) {
    await withServer(appFor(db), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/apartment-handover/invite/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteToken: token })
      });
      assert.equal(response.status, status);
      assert.equal((await response.json()).message, message);
    });
  }
});
