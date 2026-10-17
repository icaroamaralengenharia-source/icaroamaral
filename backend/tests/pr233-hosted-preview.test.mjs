import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import handle, { config } from "../../netlify/functions/pr233-live-qa.mjs";

const origin = "https://deploy-preview-233--icaroamaral.netlify.app";
const backend = "https://obrareport-backend.onrender.com";
const prefix = "/__pr233_live_qa";
const context = { deploy: { context: "deploy-preview" } };
const fixtureHeaders = { Authorization: "Bearer fixture-normal-qa-token", "Content-Type": "application/json", "x-user-id": "fixture-user", "x-institution-id": "fixture-tenant" };
const request = (path, options = {}) => new Request(origin + prefix + path, { headers: fixtureHeaders, ...options });
const runtime = readFileSync(new URL("../../relatorio-qualidade-obras/elo-runtime-config.js", import.meta.url), "utf8");

test("only the exact PR233 origin selects the hosted transport", () => {
  for (const candidate of [origin, "https://deploy-preview-234--icaroamaral.netlify.app", "https://www.icaroamaral.com.br", "https://icaroamaral.netlify.app", "http://127.0.0.1:5502", "https://deploy-preview-233--icaroamaral.netlify.app.attacker.test"]) {
    const window = { location: { origin: candidate }, OBRAREPORT_API_BASE_URL: backend };
    vm.runInNewContext(runtime, { window });
    assert.equal(window.EloRuntimeConfig.getBackendBaseUrl(), candidate === origin ? origin + prefix : backend);
  }
  assert.equal(config.path, prefix + "/*");
});

test("proxy is disabled outside deploy-preview context", async () => {
  for (const name of ["production", "branch-deploy", "dev", undefined]) assert.equal((await handle(request("/api/stock-full/works"), { deploy: { context: name } })).status, 403);
});

test("other hosts and cross-origin requests are rejected without upstream calls", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must_not_fetch"); });
  for (const url of ["https://deploy-preview-234--icaroamaral.netlify.app", "https://icaroamaral.netlify.app", "https://www.icaroamaral.com.br"]) assert.equal((await handle(new Request(url + prefix + "/api/stock-full/works", { headers: fixtureHeaders }), context)).status, 403);
  assert.equal((await handle(request("/api/stock-full/works", { headers: { ...fixtureHeaders, Origin: "https://attacker.test" } }), context)).status, 403);
  assert.equal(fetch.mock.calls.length, 0);
});

test("normal bearer and tenant assertions reach only the fixed backend, never cookies or Origin", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(url, backend + "/api/stock-full/works?fixture=yes");
    assert.equal(options.headers.get("authorization"), fixtureHeaders.Authorization);
    assert.equal(options.headers.get("x-user-id"), "fixture-user");
    assert.equal(options.headers.get("x-institution-id"), "fixture-tenant");
    for (const name of ["cookie", "origin", "x-forwarded-host"]) assert.equal(options.headers.has(name), false);
    assert.equal(options.cache, "no-store"); assert.equal(options.redirect, "error");
    return Response.json({ ok: true, works: [] }, { headers: { "Set-Cookie": "must-not-forward", "Access-Control-Allow-Origin": "*" } });
  });
  const result = await handle(request("/api/stock-full/works?fixture=yes", { headers: { ...fixtureHeaders, Origin: origin, Cookie: "fixture=ignored", "x-forwarded-host": "attacker.test" } }), context);
  assert.equal(result.status, 200); assert.deepEqual(await result.json(), { ok: true, works: [] });
  assert.equal(result.headers.get("cache-control"), "no-store"); assert.equal(result.headers.has("set-cookie"), false); assert.equal(result.headers.has("access-control-allow-origin"), false);
});

test("the backend still decides unauthorized, forbidden and transient responses", async t => {
  for (const status of [401, 403, 503]) {
    t.mock.method(globalThis, "fetch", async () => Response.json({ ok: false, error: "fixture_backend_denial" }, { status }));
    const result = await handle(request("/api/stock-full/works"), context);
    assert.equal(result.status, status); assert.equal((await result.json()).error, "fixture_backend_denial");
    t.mock.restoreAll();
  }
});

test("auth resolution POST retains its body and normal bearer", async t => {
  t.mock.method(globalThis, "fetch", async (url, options) => { assert.equal(url, backend + "/api/elo/identity/merge"); assert.equal(options.method, "POST"); assert.equal(options.body, '{"anonymousId":"fixture"}'); return Response.json({ ok: true }); });
  assert.equal((await handle(request("/api/elo/identity/merge", { method: "POST", body: '{"anonymousId":"fixture"}' }), context)).status, 200);
});

test("all RDO mutation methods and other business mutations are blocked before upstream", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must_not_fetch"); });
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) for (const path of ["/api/obrareport/rdos", "/api/obrareport/rdos/fixture", "/api/stock-full/works", "/api/stock-full/items"]) assert.equal((await handle(request(path, { method }), context)).status, 405);
  assert.equal(fetch.mock.calls.length, 0);
});

test("missing bearer, arbitrary destinations and non-allowlisted routes never reach backend", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must_not_fetch"); });
  assert.equal((await handle(request("/api/stock-full/works", { headers: {} }), context)).status, 401);
  for (const path of ["/https://attacker.test/", "/api/admin/users", "/api/stock-full/login", "/api/elo/identity/merge", "/api/stock-full/works%2f..%2fadmin"]) assert.equal((await handle(request(path), context)).status, 405);
  assert.equal(fetch.mock.calls.length, 0);
});

test("upstream failure is sanitized and never cached", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("fixture-private-error-do-not-expose"); });
  const result = await handle(request("/api/stock-full/works"), context);
  assert.equal(result.status, 502); assert.equal(result.headers.get("cache-control"), "no-store");
  assert.deepEqual(await result.json(), { ok: false, error: "pr233_qa_upstream_unavailable" });
});

test("oversized body is rejected before upstream", async t => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("must_not_fetch"); });
  assert.equal((await handle(request("/api/elo/identity/merge", { method: "POST", body: "x".repeat(65537) }), context)).status, 413);
  assert.equal(fetch.mock.calls.length, 0);
});
