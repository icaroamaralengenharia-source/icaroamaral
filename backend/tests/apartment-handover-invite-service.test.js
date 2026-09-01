import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APARTMENT_HANDOVER_MODULE_KEY,
  createApartmentHandoverInvite,
  createApartmentHandoverInviteSession,
  generateInviteToken,
  hashInviteToken,
  mapEntitlementAccess,
  redeemApartmentHandoverInvite,
  verifyApartmentHandoverInviteSession
} from "../src/apartment-handover-invite-service.js";

const SECRET = "0123456789abcdef0123456789abcdef";
const NOW = new Date("2026-08-31T12:00:00.000Z");

class Query {
  constructor(table, db) {
    this.table = table;
    this.db = db;
    this.filters = [];
    this.payload = null;
  }
  select() { return this; }
  eq(column, value) {
    this.filters.push({ column, value });
    return this;
  }
  insert(payload) {
    this.payload = Array.isArray(payload) ? payload[0] : payload;
    return this;
  }
  single() {
    if (this.table !== "institution_module_invites") return Promise.resolve({ data: null, error: null });
    const invite = Object.assign({
      id: "11111111-1111-4111-8111-111111111111",
      created_at: NOW.toISOString(),
      revoked_at: null,
      last_redeemed_at: null
    }, this.payload);
    this.db.invites.push(invite);
    return Promise.resolve({ data: invite, error: null });
  }
  maybeSingle() {
    const records = this.table === "institution_module_entitlements" ? this.db.entitlements : this.db.invites;
    return Promise.resolve({
      data: records.find((record) => this.filters.every((filter) => record[filter.column] === filter.value)) || null,
      error: null
    });
  }
}

class InviteDb {
  constructor({ invites = [], entitlements = [] } = {}) {
    this.invites = invites;
    this.entitlements = entitlements;
    this.rpcCalls = [];
  }
  from(table) {
    return new Query(table, this);
  }
  async rpc(name, args) {
    this.rpcCalls.push({ name, args });
    const invite = this.invites.find((item) => item.token_hash === args.p_token_hash && item.module_key === args.p_module_key);
    if (!invite) return { data: null, error: { message: "invite_not_found" } };
    if (invite.status === "revoked" || invite.revoked_at) return { data: null, error: { message: "invite_revoked" } };
    if (invite.status === "expired" || new Date(invite.expires_at) <= new Date(args.p_now)) return { data: null, error: { message: "invite_expired" } };
    if (invite.redeemed_count >= invite.max_redemptions) return { data: null, error: { message: "invite_max_redemptions_reached" } };
    invite.redeemed_count += 1;
    invite.last_redeemed_at = args.p_now;
    return { data: invite, error: null };
  }
}

function dbFor(status = "trial_active", inviteOverrides = {}) {
  const token = "raw-token-abc";
  const institutionId = "95fd8a25-14cd-4a9f-927a-c89be8a3c2bc";
  return {
    token,
    institutionId,
    db: new InviteDb({
      invites: [Object.assign({
        id: "22222222-2222-4222-8222-222222222222",
        institution_id: institutionId,
        module_key: APARTMENT_HANDOVER_MODULE_KEY,
        token_hash: hashInviteToken(token),
        status: "active",
        expires_at: "2026-09-03T12:00:00.000Z",
        max_redemptions: 3,
        redeemed_count: 0
      }, inviteOverrides)],
      entitlements: [{
        id: "entitlement-1",
        institution_id: institutionId,
        module_key: APARTMENT_HANDOVER_MODULE_KEY,
        status,
        trial_limit: 2,
        trial_used: status === "trial_exhausted" ? 2 : 0
      }]
    })
  };
}

test("gera token criptografico e hash sha-256 sem persistir token bruto", async () => {
  const token = generateInviteToken();
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/);
  const hash = hashInviteToken(token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.notEqual(hash, token);

  const db = new InviteDb();
  const created = await createApartmentHandoverInvite(db, {
    token,
    institutionId: "95fd8a25-14cd-4a9f-927a-c89be8a3c2bc"
  }, { now: NOW });
  assert.equal(created.token, token);
  assert.equal(db.invites[0].token_hash, hash);
  assert.equal(JSON.stringify(db.invites).includes(token), false);
  assert.equal(db.invites[0].max_redemptions, 3);
  assert.equal(db.invites[0].expires_at, "2026-09-03T12:00:00.000Z");
});

test("sessao curta assinada valida assinatura, expiracao e adulteracao", () => {
  const session = createApartmentHandoverInviteSession({
    inviteId: "invite-a",
    institutionId: "inst-a"
  }, { secret: SECRET, now: NOW, ttlMinutes: 30 });
  const valid = verifyApartmentHandoverInviteSession(session.token, { secret: SECRET, now: new Date("2026-08-31T12:10:00.000Z") });
  assert.equal(valid.ok, true);
  assert.equal(valid.authMode, "invite");
  assert.equal(valid.institutionId, "inst-a");

  assert.equal(verifyApartmentHandoverInviteSession(session.token.replace(/.$/, "x"), { secret: SECRET, now: NOW }).ok, false);
  assert.equal(verifyApartmentHandoverInviteSession(session.token, { secret: SECRET, now: new Date("2026-08-31T13:00:00.000Z") }).error, "expired_invite_session");
});

test("redeem valido incrementa uma vez via rpc atomica e retorna trial_active 0/2", async () => {
  const { db, token } = dbFor("trial_active");
  const result = await redeemApartmentHandoverInvite(db, { inviteToken: token }, { secret: SECRET, now: NOW });
  assert.equal(result.ok, true);
  assert.equal(result.access.status, "trial_active");
  assert.equal(result.access.trial_used, 0);
  assert.equal(result.access.trial_limit, 2);
  assert.equal(result.access.remaining, 2);
  assert.equal(result.access.can_create, true);
  assert.equal(db.invites[0].redeemed_count, 1);
  assert.equal(db.rpcCalls[0].name, "redeem_institution_module_invite");
});

test("redeem rejeita token inexistente, expirado, revogado e limite de resgates", async () => {
  await assert.rejects(() => redeemApartmentHandoverInvite(dbFor().db, { inviteToken: "missing" }, { secret: SECRET, now: NOW }), /invite_not_found/);
  await assert.rejects(() => redeemApartmentHandoverInvite(dbFor("trial_active", { expires_at: "2026-08-30T12:00:00.000Z" }).db, { inviteToken: "raw-token-abc" }, { secret: SECRET, now: NOW }), /invite_expired/);
  await assert.rejects(() => redeemApartmentHandoverInvite(dbFor("trial_active", { status: "revoked" }).db, { inviteToken: "raw-token-abc" }, { secret: SECRET, now: NOW }), /invite_revoked/);
  await assert.rejects(() => redeemApartmentHandoverInvite(dbFor("trial_active", { redeemed_count: 3, max_redemptions: 3 }).db, { inviteToken: "raw-token-abc" }, { secret: SECRET, now: NOW }), /invite_max_redemptions_reached/);
});

test("entitlement separa estados comerciais do convite", async () => {
  assert.equal(mapEntitlementAccess(null).error, "NO_ENTITLEMENT");
  assert.equal(mapEntitlementAccess({ status: "blocked" }).error, "MODULE_BLOCKED");
  assert.equal(mapEntitlementAccess({ status: "active" }).can_create, true);
  assert.equal(mapEntitlementAccess({ status: "trial_active", trial_limit: 2, trial_used: 2 }).read_only, true);
  assert.equal(mapEntitlementAccess({ status: "trial_exhausted", trial_limit: 2, trial_used: 2 }).can_create, false);

  await assert.rejects(() => redeemApartmentHandoverInvite(dbFor("blocked").db, { inviteToken: "raw-token-abc" }, { secret: SECRET, now: NOW }), /MODULE_BLOCKED/);
  const exhausted = await redeemApartmentHandoverInvite(dbFor("trial_exhausted").db, { inviteToken: "raw-token-abc" }, { secret: SECRET, now: NOW });
  assert.equal(exhausted.access.read_only, true);
});
