import assert from "node:assert/strict";
import test from "node:test";
import {
  EXPECTED_PROJECT_REF,
  TARGETS,
  assertSafeTeardown,
  createDryRunReceipt,
  isDryRunReceiptValid,
  makeInitialState,
  parseEnvText,
  parseMode,
  runProvisioner,
  sanitizedManifest,
  validateConfig,
  validateTargets
} from "./provision-live-qa-tenants.mjs";

const config = Object.freeze({
  supabaseUrl: `https://${EXPECTED_PROJECT_REF}.supabase.co`,
  projectRef: EXPECTED_PROJECT_REF,
  anonKey: "public-anon-test-value",
  serviceRoleKey: "service-role-never-log-test-value"
});

const ids = Object.freeze({
  authA: "auth-user-a-synthetic",
  authB: "auth-user-b-synthetic",
  tenantA: "10000000-0000-4000-8000-00000000000a",
  tenantB: "10000000-0000-4000-8000-00000000000b",
  profileA: "20000000-0000-4000-8000-00000000000a",
  profileB: "20000000-0000-4000-8000-00000000000b"
});

function fakeClient(options = {}) {
  const store = {
    institutions: [],
    profiles: [],
    projects: [],
    users: new Map(),
    created: [],
    deleted: [],
    nonEmptyTable: options.nonEmptyTable || ""
  };
  const client = {
    async inspectSchema() { store.schemaInspected = true; },
    async findInstitutionsByName(name) { return store.institutions.filter((row) => row.name === name); },
    async findProfilesByEmail(email) { return store.profiles.filter((row) => row.email === email); },
    async findProfilesByInstitution(institutionId) { return store.profiles.filter((row) => row.institution_id === institutionId); },
    async findProjectsById(id) { return store.projects.filter((row) => row.id === id); },
    async findProjectsByInstitution(institutionId) { return store.projects.filter((row) => row.institution_id === institutionId); },
    async getAuthUser(id) { return store.users.get(id) || null; },
    async createAuthUser({ email, marker }) {
      if (options.failAuthEmail === email) throw new Error("sensitive provider response must not be logged");
      const id = email === TARGETS.A.email ? ids.authA : ids.authB;
      const user = { id, email, user_metadata: { qaNamespace: marker } };
      store.users.set(id, user);
      store.created.push(["auth", id]);
      return user;
    },
    async insertInstitution(payload) {
      const row = { ...payload, status: "active" };
      store.institutions.push(row);
      store.created.push(["institutions", row.id]);
      return row;
    },
    async insertProfile(payload) {
      const row = { ...payload, status: "active" };
      store.profiles.push(row);
      store.created.push(["profiles", row.id]);
      return row;
    },
    async insertProject(payload) {
      const row = { ...payload };
      store.projects.push(row);
      store.created.push(["obrareport_projects", row.id]);
      return row;
    },
    async countTenantRows(table) { return table === store.nonEmptyTable ? 1 : 0; },
    async deleteProject(id, institutionId) {
      const matches = store.projects.filter((row) => row.id === id && row.institution_id === institutionId);
      store.projects = store.projects.filter((row) => !matches.includes(row));
      store.deleted.push(["obrareport_projects", id]);
      return matches;
    },
    async deleteProfile(id, authUserId) {
      const matches = store.profiles.filter((row) => row.id === id && row.auth_user_id === authUserId);
      store.profiles = store.profiles.filter((row) => !matches.includes(row));
      store.deleted.push(["profiles", id]);
      return matches;
    },
    async deleteAuthUser(id) { store.users.delete(id); store.deleted.push(["auth", id]); },
    async deleteInstitution(id) {
      const matches = store.institutions.filter((row) => row.id === id);
      store.institutions = store.institutions.filter((row) => !matches.includes(row));
      store.deleted.push(["institutions", id]);
      return matches;
    }
  };
  return { client, store };
}

function liveConfigText(overrides = {}) {
  return [
    `SUPABASE_URL=${overrides.SUPABASE_URL || config.supabaseUrl}`,
    `SUPABASE_ANON_KEY=${overrides.SUPABASE_ANON_KEY || config.anonKey}`,
    `SUPABASE_SERVICE_ROLE_KEY=${overrides.SUPABASE_SERVICE_ROLE_KEY || config.serviceRoleKey}`,
    `LIVE_QA_EXPECTED_PROJECT_REF=${overrides.LIVE_QA_EXPECTED_PROJECT_REF || EXPECTED_PROJECT_REF}`
  ].join("\n");
}

test("dry-run produces a sanitized plan with no mutations", async () => {
  const { client, store } = fakeClient();
  const result = await runProvisioner({ mode: "dry-run", config, client });
  assert.equal(result.ready, true);
  assert.match(result.report, /READY_TO_APPLY=YES/);
  assert.match(result.report, /SCHEMA_CHANGES=0/);
  assert.match(result.report, /RLS_CHANGES=0/);
  assert.match(result.report, /EXISTING_REAL_ENTITIES_TOUCHED=0/);
  assert.doesNotMatch(result.report, /elo\.qa\.live\.[ab]@elo-e2e\.test/);
  assert.doesNotMatch(result.report, /service-role-never-log-test-value|public-anon-test-value/);
  assert.equal(store.created.length, 0);
});

test("apply without the live confirmation flag aborts before reading or mutating", async () => {
  const { client, store } = fakeClient();
  await assert.rejects(runProvisioner({ mode: "apply", config, client, confirmed: false }), { code: "live_confirmation_required" });
  assert.equal(store.schemaInspected, undefined);
  assert.equal(store.created.length, 0);
  assert.throws(() => parseMode(["--apply"]), { code: "live_confirmation_required" });
});

test("apply requires a recent successful dry-run receipt", async () => {
  const { client, store } = fakeClient();
  await assert.rejects(runProvisioner({ mode: "apply", confirmed: true, config, client }), { code: "successful_dry_run_required" });
  assert.equal(store.schemaInspected, undefined);
  const receipt = createDryRunReceipt(Date.now() - 31 * 60 * 1000);
  assert.equal(isDryRunReceiptValid(receipt), false);
});

test("tenant prefixes and QA email namespace are mandatory", () => {
  assert.equal(validateTargets(), true);
  const invalidTenant = { ...TARGETS, A: { ...TARGETS.A, tenantName: "CLIENTE_REAL" } };
  const invalidUser = { ...TARGETS, B: { ...TARGETS.B, email: "pessoa@empresa.com.br" } };
  assert.throws(() => validateTargets(invalidTenant), { code: "tenant_namespace_invalid" });
  assert.throws(() => validateTargets(invalidUser), { code: "user_namespace_invalid" });
});

test("project ref mismatch and non-HTTPS/custom URLs fail closed", () => {
  assert.throws(() => validateConfig({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    LIVE_QA_EXPECTED_PROJECT_REF: "example"
  }), { code: "target_project_mismatch" });
  assert.throws(() => validateConfig({
    SUPABASE_URL: `http://${EXPECTED_PROJECT_REF}.supabase.co`,
    SUPABASE_ANON_KEY: "anon",
    SUPABASE_SERVICE_ROLE_KEY: "service",
    LIVE_QA_EXPECTED_PROJECT_REF: EXPECTED_PROJECT_REF
  }), { code: "supabase_url_invalid" });
});

test("existing target tenant without the private ownership manifest is never adopted", async () => {
  const { client, store } = fakeClient();
  store.institutions.push({ id: "real-institution-id", name: TARGETS.A.tenantName, document: "12.345.678/0001-90", status: "active" });
  await assert.rejects(runProvisioner({ mode: "dry-run", config, client }), { code: "tenant_exists_unowned_or_mismatched" });
  assert.equal(store.created.length, 0);
});

test("existing profile under the reserved QA email cannot be reused", async () => {
  const { client, store } = fakeClient();
  store.profiles.push({ id: "profile-real", auth_user_id: "real-user", institution_id: "real-institution", email: TARGETS.B.email, role: "gestor", status: "active" });
  await assert.rejects(runProvisioner({ mode: "dry-run", config, client }), { code: "profile_exists_unowned_or_mismatched" });
  assert.equal(store.created.length, 0);
});

test("repeating apply with a complete manifest is idempotent", async () => {
  const { client, store } = fakeClient();
  const state = makeInitialState();
  let manifestWrites = 0;
  const result = await runProvisioner({
    mode: "apply",
    confirmed: true,
    config,
    client,
    state,
    dryRunReceipt: createDryRunReceipt(),
    credentials: { A: "password-A-never-log", B: "password-B-never-log" },
    savePrivateState: async () => {},
    saveManifest: async () => { manifestWrites += 1; },
    ensurePrivate: async () => {}
  });
  assert.equal(result.tenantsDistinct, true);
  assert.equal(result.idempotent, false);
  const afterFirstRun = store.created.length;
  const secondRun = await runProvisioner({
    mode: "apply",
    confirmed: true,
    config,
    client,
    state,
    dryRunReceipt: createDryRunReceipt(),
    credentials: { A: "password-A-never-log", B: "password-B-never-log" },
    savePrivateState: async () => {},
    saveManifest: async () => { manifestWrites += 1; },
    ensurePrivate: async () => {}
  });
  assert.equal(secondRun.idempotent, true);
  assert.equal(store.created.length, afterFirstRun);
  assert.equal(store.institutions.length, 2);
  assert.equal(store.profiles.length, 2);
  assert.equal(store.projects.length, 2);
  assert.equal(manifestWrites, 2);
  assert.equal(store.created.some(([table]) => ["obrareport_rdos", "obrareport_clients", "stock_full_items"].includes(table)), false);
});

test("duplicate reserved Auth user aborts and rolls back only the just-created QA user", async () => {
  const { client, store } = fakeClient({ failAuthEmail: TARGETS.B.email });
  const state = makeInitialState();
  await assert.rejects(runProvisioner({
    mode: "apply", confirmed: true, config, client, state,
    dryRunReceipt: createDryRunReceipt(),
    credentials: { A: "password-A", B: "password-B" },
    savePrivateState: async () => {}, saveManifest: async () => {}, ensurePrivate: async () => {}
  }), { code: "auth_create_failed_rolled_back" });
  assert.equal(store.users.size, 0);
  assert.equal(store.institutions.length, 0);
  assert.deepEqual(store.deleted, [["auth", ids.authA]]);
  assert.equal(state.tenantA.authUserId, null);
});

test("sanitized artifact contains fingerprints only, never raw IDs or credentials", () => {
  const state = makeInitialState();
  Object.assign(state.tenantA, { institutionId: ids.tenantA, authUserId: ids.authA, profileId: ids.profileA, workId: TARGETS.A.workId });
  Object.assign(state.tenantB, { institutionId: ids.tenantB, authUserId: ids.authB, profileId: ids.profileB, workId: TARGETS.B.workId });
  const text = JSON.stringify(sanitizedManifest(state));
  for (const privateValue of Object.values(ids)) assert.equal(text.includes(privateValue), false);
  assert.equal(text.includes(TARGETS.A.email), false);
  assert.equal(text.includes("password"), false);
  assert.equal(text.includes("service-role"), false);
  assert.match(text, /"realDataTouched":false/);
  assert.match(text, /"schemaChanged":false/);
  assert.match(text, /"rlsChanged":false/);
});

test("service-role value is not included in logs or reports", async () => {
  const { client } = fakeClient();
  const output = [];
  const result = await runProvisioner({ mode: "dry-run", config, client, logger: (value) => output.push(value) });
  assert.equal(output.some((value) => String(value).includes(config.serviceRoleKey)), false);
  assert.equal(JSON.stringify(result).includes(config.serviceRoleKey), false);
});

test("teardown requires confirmation and its scope is bounded by private manifest IDs", async () => {
  const { client } = fakeClient();
  const state = makeInitialState();
  const calls = [];
  await assert.rejects(runProvisioner({ mode: "teardown", confirmed: false, config, client, state, teardown: async () => calls.push("delete") }), { code: "live_confirmation_required" });
  assert.deepEqual(calls, []);
  const result = await runProvisioner({ mode: "teardown", confirmed: true, config, client, state, teardown: async (receivedClient, receivedState) => calls.push(receivedState) });
  assert.equal(result.teardownExecuted, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0], state);
});

test("teardown aborts before deletes when QA tenant has any unrelated data", async () => {
  const { client, store } = fakeClient({ nonEmptyTable: "obrareport_rdos" });
  const state = makeInitialState();
  await runProvisioner({
    mode: "apply", confirmed: true, config, client, state, dryRunReceipt: createDryRunReceipt(),
    credentials: { A: "password-A", B: "password-B" },
    savePrivateState: async () => {}, saveManifest: async () => {}, ensurePrivate: async () => {}
  });
  await assert.rejects(assertSafeTeardown(client, state), { code: "teardown_has_qa_data" });
  assert.equal(store.deleted.length, 0);
});

test("preflight performs no schema or RLS mutation", async () => {
  const { client, store } = fakeClient();
  await runProvisioner({ mode: "dry-run", config, client });
  assert.equal(store.schemaInspected, true);
  assert.deepEqual(store.created, []);
  assert.equal(typeof client.alterSchema, "undefined");
  assert.equal(typeof client.alterRls, "undefined");
});

test("two profiles and work records are bound to distinct tenant IDs", async () => {
  const { client, store } = fakeClient();
  const state = makeInitialState();
  await runProvisioner({
    mode: "apply", confirmed: true, config, client, state, dryRunReceipt: createDryRunReceipt(),
    credentials: { A: "password-A", B: "password-B" },
    savePrivateState: async () => {}, saveManifest: async () => {}, ensurePrivate: async () => {}
  });
  assert.notEqual(state.tenantA.institutionId, state.tenantB.institutionId);
  assert.notEqual(state.tenantA.authUserId, state.tenantB.authUserId);
  assert.equal(store.profiles.find((row) => row.email === TARGETS.A.email)?.institution_id, state.tenantA.institutionId);
  assert.equal(store.profiles.find((row) => row.email === TARGETS.B.email)?.institution_id, state.tenantB.institutionId);
  assert.equal(store.projects.find((row) => row.id === TARGETS.A.workId)?.institution_id, state.tenantA.institutionId);
  assert.equal(store.projects.find((row) => row.id === TARGETS.B.workId)?.institution_id, state.tenantB.institutionId);
});

test("configuration parser rejects duplicate fields and config never echoes values", () => {
  assert.throws(() => parseEnvText("SUPABASE_URL=a\nSUPABASE_URL=b"), { code: "secure_config_malformed" });
  const parsed = validateConfig(Object.fromEntries(liveConfigText().split("\n").map((line) => line.split("=")).filter((entry) => entry.length > 1)));
  assert.equal(parsed.projectRef, EXPECTED_PROJECT_REF);
  assert.equal(JSON.stringify(parsed).includes("service-role-never-log-test-value"), true);
  assert.equal(JSON.stringify(parsed).includes("public-anon-test-value"), true);
});
