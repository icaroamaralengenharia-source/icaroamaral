import assert from "node:assert/strict";
import { test } from "node:test";
import { authorizeApartmentHandoverInspectionUsage, resolveApartmentHandoverAccess, toApartmentHandoverAccessResponse } from "../src/apartment-handover-access-service.js";

const MODULE = "apartment_handover";
const INSTITUTION_A = "11111111-1111-4111-8111-111111111111";
const INSTITUTION_B = "22222222-2222-4222-8222-222222222222";
const INSPECTION_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INSPECTION_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const INSPECTION_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createEntitlementStore(rows = []) {
  const state = {
    rows: rows.map((row, index) => ({ id: row.id || "ent-" + index, module_key: MODULE, trial_limit: 2, trial_used: 0, ...row })),
    usages: [],
    rpcCalls: []
  };

  function response(row, values) {
    const trialLimit = Number(row && row.trial_limit || values.trial_limit || 0);
    const trialUsed = Number(row && row.trial_used || values.trial_used || 0);
    return {
      allowed: Boolean(values.allowed),
      consumed: Boolean(values.consumed),
      status: values.status,
      code: values.code || null,
      trial_used: trialUsed,
      trial_limit: trialLimit,
      remaining: Math.max(0, trialLimit - trialUsed)
    };
  }

  function consumeTrial(args) {
    state.rpcCalls.push(clone(args));
    const institutionId = String(args.p_institution_id || "");
    const inspectionId = String(args.p_inspection_id || "");
    const shouldConsume = args.p_consume !== false;
    if (!institutionId) return response(null, { allowed: false, status: "no_institution", code: "INSTITUTION_REQUIRED" });
    if (!inspectionId) return response(null, { allowed: false, status: "missing_inspection_id", code: "INSPECTION_ID_REQUIRED" });

    const row = state.rows.find((item) => item.institution_id === institutionId && item.module_key === MODULE);
    if (!row) return response(null, { allowed: false, status: "no_entitlement", code: "NO_ENTITLEMENT" });
    if (row.status === "blocked") return response(row, { allowed: false, status: "blocked", code: "MODULE_BLOCKED" });
    if (row.status === "active") return response(row, { allowed: true, status: "active" });

    const existing = state.usages.find((usage) => usage.institution_id === institutionId && usage.module_key === MODULE && usage.inspection_id === inspectionId);
    if (existing) return response(row, { allowed: true, status: row.status });
    if (row.status === "trial_exhausted" || row.trial_used >= row.trial_limit) {
      row.status = "trial_exhausted";
      return response(row, { allowed: false, status: "trial_exhausted", code: "TRIAL_EXHAUSTED" });
    }
    if (!shouldConsume) return response(row, { allowed: true, status: row.status });

    state.usages.push({ entitlement_id: row.id, institution_id: institutionId, module_key: MODULE, inspection_id: inspectionId });
    row.trial_used += 1;
    if (row.trial_used >= row.trial_limit) row.status = "trial_exhausted";
    return response(row, { allowed: true, consumed: true, status: row.status });
  }

  function queryBuilder() {
    const filters = [];
    return {
      select() { return this; },
      eq(column, value) { filters.push({ column, value: String(value) }); return this; },
      maybeSingle() {
        const row = state.rows.find((item) => filters.every((filter) => String(item[filter.column]) === filter.value));
        return Promise.resolve({ data: clone(row || null), error: null });
      }
    };
  }

  return {
    state,
    supabase: {
      from(table) {
        assert.equal(table, "institution_module_entitlements");
        return { select() { return queryBuilder(); } };
      },
      rpc(name, args) {
        assert.equal(name, "consume_apartment_handover_trial_usage");
        const data = consumeTrial(args || {});
        return { single: async () => ({ data: clone(data), error: null }) };
      }
    }
  };
}

async function accessFor(rows, institutionId = INSTITUTION_A) {
  const store = createEntitlementStore(rows);
  const access = await resolveApartmentHandoverAccess({ supabase: store.supabase, institutionId });
  return { access, store };
}

async function consume(store, inspectionId, institutionId = INSTITUTION_A, consumeUsage = true) {
  return authorizeApartmentHandoverInspectionUsage({ supabase: store.supabase, institutionId, inspectionId, consume: consumeUsage });
}

test("NO_ENTITLEMENT nega acesso e nao cria trial automaticamente", async () => {
  const { access } = await accessFor([]);
  assert.equal(access.allowed, false);
  assert.equal(access.status, "no_entitlement");
  assert.equal(access.code, "NO_ENTITLEMENT");
});

test("trial_active expõe limite, uso e can_create sem campos de horario", async () => {
  const { access } = await accessFor([{ institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 1 }]);
  const body = toApartmentHandoverAccessResponse(access);
  assert.equal(body.allowed, true);
  assert.equal(body.status, "trial_active");
  assert.equal(body.trial_used, 1);
  assert.equal(body.trial_limit, 2);
  assert.equal(body.remaining, 1);
  assert.equal(body.can_create, true);
  assert.equal("trial_started_at" in body, false);
  assert.equal("trial_expires_at" in body, false);
  assert.equal("remaining_seconds" in body, false);
});

test("primeira vistoria consome 1 unidade e cria ledger", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  const access = await consume(store, INSPECTION_A);
  assert.equal(access.allowed, true);
  assert.equal(access.consumed, true);
  assert.equal(access.trialUsed, 1);
  assert.equal(access.remaining, 1);
  assert.equal(store.state.usages.length, 1);
  assert.equal(store.state.usages[0].inspection_id, INSPECTION_A);
});

test("mesma vistoria nao consome duas vezes", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  await consume(store, INSPECTION_A);
  const again = await consume(store, INSPECTION_A);
  assert.equal(again.allowed, true);
  assert.equal(again.consumed, false);
  assert.equal(again.trialUsed, 1);
  assert.equal(again.remaining, 1);
  assert.equal(store.state.usages.length, 1);
});

test("segunda vistoria conclui e marca trial_exhausted sem bloquear a propria vistoria", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  await consume(store, INSPECTION_A);
  const second = await consume(store, INSPECTION_B);
  assert.equal(second.allowed, true);
  assert.equal(second.consumed, true);
  assert.equal(second.status, "trial_exhausted");
  assert.equal(second.trialUsed, 2);
  assert.equal(second.remaining, 0);
  assert.equal(store.state.rows[0].status, "trial_exhausted");
  assert.equal(store.state.usages.length, 2);
});

test("terceira vistoria e bloqueada sem aumentar trial_used", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  await consume(store, INSPECTION_A);
  await consume(store, INSPECTION_B);
  const third = await consume(store, INSPECTION_C);
  assert.equal(third.allowed, false);
  assert.equal(third.code, "TRIAL_EXHAUSTED");
  assert.equal(third.trialUsed, 2);
  assert.equal(store.state.rows[0].trial_used, 2);
  assert.equal(store.state.usages.length, 2);
});

test("trial_exhausted permite reprint de vistorias no ledger", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  await consume(store, INSPECTION_A);
  await consume(store, INSPECTION_B);
  const reprintA = await consume(store, INSPECTION_A, INSTITUTION_A, false);
  const reprintB = await consume(store, INSPECTION_B, INSTITUTION_A, false);
  assert.equal(reprintA.allowed, true);
  assert.equal(reprintB.allowed, true);
  assert.equal(store.state.rows[0].trial_used, 2);
});

test("trial_exhausted nega PDF de vistoria fora do ledger", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_exhausted", trial_limit: 2, trial_used: 2 }]);
  const third = await consume(store, INSPECTION_C, INSTITUTION_A, false);
  assert.equal(third.allowed, false);
  assert.equal(third.code, "TRIAL_EXHAUSTED");
});

test("reload/outro usuario mesma institution ve a mesma contagem", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  await consume(store, INSPECTION_A);
  const first = await resolveApartmentHandoverAccess({ supabase: store.supabase, institutionId: INSTITUTION_A });
  const secondUserSameInstitution = await resolveApartmentHandoverAccess({ supabase: store.supabase, institutionId: INSTITUTION_A });
  assert.equal(first.trialUsed, 1);
  assert.equal(secondUserSameInstitution.trialUsed, 1);
  assert.equal(secondUserSameInstitution.remaining, 1);
});

test("institution diferente nao herda uso da institution A", async () => {
  const store = createEntitlementStore([
    { id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 },
    { id: "ent-b", institution_id: INSTITUTION_B, status: "trial_active", trial_limit: 2, trial_used: 0 }
  ]);
  await consume(store, INSPECTION_A, INSTITUTION_A);
  const other = await resolveApartmentHandoverAccess({ supabase: store.supabase, institutionId: INSTITUTION_B });
  assert.equal(other.trialUsed, 0);
  assert.equal(other.remaining, 2);
});

test("dois requests simultaneos para a mesma vistoria consomem uma vez", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  const [first, second] = await Promise.all([consume(store, INSPECTION_A), consume(store, INSPECTION_A)]);
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(store.state.rows[0].trial_used, 1);
  assert.equal(store.state.usages.length, 1);
});

test("se resta uma vaga, duas vistorias concorrentes nunca passam do limite", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 1 }]);
  const [one, other] = await Promise.all([consume(store, INSPECTION_B), consume(store, INSPECTION_C)]);
  assert.equal([one.allowed, other.allowed].filter(Boolean).length, 1);
  assert.equal(store.state.rows[0].trial_used, 2);
  assert.equal(store.state.usages.length, 1);
  assert.equal(store.state.rows[0].trial_used <= store.state.rows[0].trial_limit, true);
});

test("active permite sem consumir trial", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "active", trial_limit: 2, trial_used: 2 }]);
  const access = await consume(store, INSPECTION_C);
  assert.equal(access.allowed, true);
  assert.equal(access.status, "active");
  assert.equal(access.consumed, false);
  assert.equal(store.state.usages.length, 0);
});

test("blocked nega tudo", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "blocked", trial_limit: 2, trial_used: 0 }]);
  const access = await consume(store, INSPECTION_A);
  assert.equal(access.allowed, false);
  assert.equal(access.code, "MODULE_BLOCKED");
});

test("inspection_id obrigatorio no fluxo protegido", async () => {
  const store = createEntitlementStore([{ id: "ent-a", institution_id: INSTITUTION_A, status: "trial_active", trial_limit: 2, trial_used: 0 }]);
  const access = await consume(store, "");
  assert.equal(access.allowed, false);
  assert.equal(access.code, "INSPECTION_ID_REQUIRED");
  assert.equal(store.state.usages.length, 0);
});
