import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

const SESSIONS = {
  "token-user-a": {
    user: { id: "auth-user-a", email: "admin@elo-e2e.test", app_metadata: { provider: "email" } },
    profile: {
      id: "profile-a",
      auth_user_id: "auth-user-a",
      institution_id: "inst-e2e-a",
      company_id: "company-e2e-a",
      unit_id: "unit-e2e-a",
      email: "admin@elo-e2e.test",
      name: "Synthetic E2E Admin",
      role: "admin",
      status: "active",
      private_notes: "must not be returned"
    }
  },
  "token-user-b": {
    user: { id: "auth-user-b", email: "other@elo-e2e.test" },
    profile: {
      id: "profile-b",
      auth_user_id: "auth-user-b",
      institution_id: "inst-e2e-b",
      company_id: "company-e2e-b",
      email: "other@elo-e2e.test"
    }
  },
  "token-no-profile": {
    user: { id: "auth-user-no-profile", email: "no-profile@elo-e2e.test" },
    profile: null
  }
};

function createSupabaseMock() {
  const calls = [];
  let currentUserId = "";
  return {
    calls,
    auth: {
      async getUser(token) {
        calls.push({ type: "getUser" });
        const session = SESSIONS[token];
        if (!session) return { data: null, error: new Error("invalid session") };
        currentUserId = session.user.id;
        return { data: { user: session.user }, error: null };
      }
    },
    from(table) {
      calls.push({ type: "from", table });
      return {
        select(columns) {
          calls.push({ type: "select", columns });
          return {
            eq(column, value) {
              calls.push({ type: "eq", column, value });
              return {
                async maybeSingle() {
                  calls.push({ type: "maybeSingle" });
                  assert.equal(value, currentUserId);
                  const session = Object.values(SESSIONS).find((entry) => entry.user.id === value);
                  return { data: session && session.profile || null, error: null };
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
  const directory = mkdtempSync(join(tmpdir(), "elo-me-endpoint-"));
  const supabase = createSupabaseMock();
  const store = createEloCoreStore({ dataPath: join(directory, "elo-core.json") });
  let mergeCalls = 0;
  const mergeAnonymous = store.mergeAnonymous.bind(store);
  store.mergeAnonymous = (...args) => {
    mergeCalls += 1;
    return mergeAnonymous(...args);
  };
  const app = createApp({ authContextSupabaseClient: supabase, eloCoreStore: store });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  try {
    await callback("http://127.0.0.1:" + server.address().port, { supabase, getMergeCalls: () => mergeCalls });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }
}

async function getJson(base, path, token) {
  const response = await fetch(base + path, {
    method: "GET",
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  return { response, data: await response.json() };
}

test("GET /api/elo/me returns only the profile attached to the authenticated user", async () => {
  await withServer(async (base, state) => {
    const { response, data } = await getJson(
      base,
      "/api/elo/me?user_id=auth-user-b&institution_id=inst-e2e-b",
      "token-user-a"
    );

    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") || "", /no-store/i);
    assert.deepEqual(data, {
      ok: true,
      user_id: "auth-user-a",
      institution_id: "inst-e2e-a",
      company_id: "company-e2e-a",
      email: "admin@elo-e2e.test"
    });
    assert.deepEqual(state.supabase.calls.filter((call) => call.type === "eq"), [
      { type: "eq", column: "auth_user_id", value: "auth-user-a" }
    ]);
    assert.deepEqual(state.supabase.calls.filter((call) => call.type === "from"), [
      { type: "from", table: "profiles" }
    ]);
    assert.equal(state.getMergeCalls(), 0);
    assert.equal(JSON.stringify(data).includes("token-user-a"), false);
    assert.equal("private_notes" in data, false);
    assert.equal("name" in data, false);
    assert.equal("role" in data, false);
    assert.equal("status" in data, false);
    assert.equal("unit_id" in data, false);
    assert.equal("environment" in data, false);
  });
});

test("GET /api/elo/me rejects missing and invalid sessions", async () => {
  await withServer(async (base) => {
    const missing = await getJson(base, "/api/elo/me", "");
    assert.equal(missing.response.status, 401);
    assert.equal(missing.data.ok, false);

    const invalid = await getJson(base, "/api/elo/me", "token-invalid");
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.data.ok, false);
  });
});

test("GET /api/elo/me denies an authenticated user without an authorized profile", async () => {
  await withServer(async (base, state) => {
    const { response, data } = await getJson(base, "/api/elo/me", "token-no-profile");
    assert.equal(response.status, 403);
    assert.deepEqual(data, { ok: false, error: "profile_not_authorized" });
    assert.deepEqual(state.supabase.calls.filter((call) => call.type === "eq"), [
      { type: "eq", column: "auth_user_id", value: "auth-user-no-profile" }
    ]);
    assert.equal(state.getMergeCalls(), 0);
  });
});
