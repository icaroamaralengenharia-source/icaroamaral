const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const vm = require("node:vm");

// Isolated regression fixture only: no live API, credentials, browser session or business writes.
const repoRoot = path.resolve(__dirname, "..", "..");
const workerPath = path.join(repoRoot, "elo-sw.js");
const baselineRevision = process.env.RDO_SW_TEST_REVISION;
const workerSource = baselineRevision
  ? execFileSync("git", ["show", baselineRevision + ":elo-sw.js"], { cwd: repoRoot, encoding: "utf8" })
  : fs.existsSync(workerPath)
  ? fs.readFileSync(workerPath, "utf8")
  : execFileSync("git", ["show", "HEAD:elo-sw.js"], { cwd: repoRoot, encoding: "utf8" });
const cacheName = workerSource.match(/const ELO_CACHE_NAME\s*=\s*["']([^"']+)["']/)[1];
const frontendOrigin = "https://www.icaroamaral.com.br";
const backendOrigin = "https://obrareport-backend.onrender.com";
const fixtureRows = ["old-1", "old-2", "old-3", "new-4"].map(id => ({ id, project_id: "fixture-project" }));

function json(data) {
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}

function loadWorker({ offline = false, seeds = [] } = {}) {
  const listeners = new Map();
  const stores = new Map();
  const metrics = { matches: [], writes: [], deletes: [], network: [], networkCacheModes: [] };
  function urlOf(input) {
    return new URL(typeof input === "string" ? input : input.url, frontendOrigin + "/").href;
  }
  function store(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name);
  }
  for (const seed of seeds) store(seed.cache || cacheName).set(urlOf(seed.url), seed.response.clone());
  function cacheApi(name) {
    const entries = store(name);
    return {
      async match(input) {
        const url = urlOf(input);
        metrics.matches.push(url);
        return entries.get(url)?.clone();
      },
      async put(input, response) {
        const url = urlOf(input);
        metrics.writes.push(url);
        entries.set(url, response.clone());
      },
      async keys() { return Array.from(entries.keys(), url => new Request(url)); },
      async delete(input) {
        const url = urlOf(input);
        metrics.deletes.push(url);
        return entries.delete(url);
      },
      async addAll() { throw new Error("install_not_part_of_this_fixture"); }
    };
  }
  async function network(input, options = {}) {
    const url = urlOf(input);
    metrics.network.push(url);
    metrics.networkCacheModes.push(options.cache);
    if (offline) throw new TypeError("fixture_network_offline");
    if (new URL(url).pathname.endsWith("/new-4")) return json({ ok: true, rdo: fixtureRows[3] });
    if (new URL(url).pathname.startsWith("/api/obrareport/")) return json({ ok: true, rdos: fixtureRows });
    return new Response("fixture static asset", { headers: { "Content-Type": "text/plain" } });
  }
  const context = {
    URL, Request, Response, Headers, console,
    fetch: network,
    caches: {
      async open(name) { return cacheApi(name); },
      async keys() { return Array.from(stores.keys()); },
      async delete(name) { return stores.delete(name); },
      async match(input) {
        const url = urlOf(input);
        metrics.matches.push(url);
        for (const entries of stores.values()) if (entries.has(url)) return entries.get(url).clone();
        return undefined;
      }
    },
    self: {
      location: { origin: frontendOrigin, href: frontendOrigin + "/elo-sw.js" },
      clients: { async claim() {} },
      async skipWaiting() {},
      addEventListener(type, handler) { listeners.set(type, handler); }
    }
  };
  vm.runInNewContext(workerSource, context, { filename: "elo-sw.js" });
  return {
    metrics, stores,
    async fetch(url, { method = "GET", authenticated = true } = {}) {
      const request = new Request(url, {
        method,
        headers: authenticated ? { Authorization: "Bearer synthetic-test-only" } : {}
      });
      let handled = false;
      let responsePromise;
      const pending = [];
      listeners.get("fetch")({
        request,
        respondWith(value) { handled = true; responsePromise = Promise.resolve(value); },
        waitUntil(value) { pending.push(Promise.resolve(value)); }
      });
      const response = await (handled ? responsePromise : network(request));
      await Promise.all(pending);
      // Flush cache.put scheduled by the existing worker without event.waitUntil.
      await new Promise(resolve => setImmediate(resolve));
      return { response, handled };
    },
    async activate() {
      const pending = [];
      listeners.get("activate")({ waitUntil(value) { pending.push(Promise.resolve(value)); } });
      await Promise.all(pending);
    }
  };
}

test("RDO filtered list must see the fourth record even when its URL cached three before create", async () => {
  const filtered = backendOrigin + "/api/obrareport/rdos?projectId=fixture-project";
  const worker = loadWorker({ seeds: [{ url: filtered, response: json({ ok: true, rdos: fixtureRows.slice(0, 3) }) }] });
  const byId = await (await worker.fetch(backendOrigin + "/api/obrareport/rdos/new-4")).response.json();
  const all = await (await worker.fetch(backendOrigin + "/api/obrareport/rdos")).response.json();
  const scoped = await (await worker.fetch(filtered)).response.json();
  assert.equal(byId.rdo.id, "new-4");
  assert.equal(all.rdos.length, 4);
  assert.equal(scoped.rdos.length, 4, "A stale three-row filtered cache must not shadow the four-row network response");
  assert.equal(scoped.rdos.some(row => row.id === "new-4"), true);
});

for (const origin of [frontendOrigin, backendOrigin]) {
  test(`ObraReport API GET never reads or writes Cache Storage at ${origin}`, async () => {
    const worker = loadWorker();
    const routes = [
      "/api/obrareport/rdos?projectId=fixture-project",
      "/api/obrareport/rdos",
      "/api/obrareport/rdos/new-4",
      "/api/obrareport/documents/fixture-document/content"
    ];
    for (const route of routes) await worker.fetch(origin + route);
    assert.equal(worker.metrics.network.length, routes.length);
    assert.deepEqual(worker.metrics.matches, [], "Private API GET must not consult Cache Storage");
    assert.deepEqual(worker.metrics.writes, [], "Private API GET must not populate Cache Storage");
    assert.deepEqual(worker.metrics.networkCacheModes, routes.map(() => "no-store"), "Private API GET must also bypass the browser HTTP cache");
  });

  test(`authenticated ObraReport API fails closed offline even if cached at ${origin}`, async () => {
    const url = origin + "/api/obrareport/rdos?projectId=fixture-project";
    const worker = loadWorker({ offline: true, seeds: [{ url, response: json({ ok: true, rdos: fixtureRows.slice(0, 3) }) }] });
    await assert.rejects(worker.fetch(url), /fixture_network_offline/);
    assert.deepEqual(worker.metrics.matches, []);
    assert.deepEqual(worker.metrics.writes, []);
  });
}

test("POST RDO creation stays outside service-worker interception and cache", async () => {
  const worker = loadWorker();
  const result = await worker.fetch(backendOrigin + "/api/obrareport/rdos", { method: "POST" });
  assert.equal(result.handled, false);
  assert.equal(worker.metrics.network.length, 1);
  assert.deepEqual(worker.metrics.matches, []);
  assert.deepEqual(worker.metrics.writes, []);
});

test("public static assets remain cacheable", async () => {
  const url = frontendOrigin + "/relatorio-qualidade-obras/rdo-project-workspace.js?v=fixture";
  const worker = loadWorker();
  const first = await worker.fetch(url, { authenticated: false });
  const second = await worker.fetch(url, { authenticated: false });
  assert.equal(await first.response.text(), "fixture static asset");
  assert.equal(await second.response.text(), "fixture static asset");
  assert.equal(first.handled, true);
  assert.equal(second.handled, true);
  assert.equal(worker.metrics.network.length, 1);
  assert.deepEqual(worker.metrics.writes, [url]);
});

test("activation removes legacy ObraReport API cache entries while preserving current static assets", async () => {
  const privateUrls = [
    frontendOrigin + "/api/obrareport/rdos?projectId=fixture-project",
    backendOrigin + "/api/obrareport/rdos/new-4"
  ];
  const assetUrl = frontendOrigin + "/elo.css?v=current";
  const otherUrl = frontendOrigin + "/unrelated-static.txt";
  const worker = loadWorker({ seeds: [
    ...privateUrls.map(url => ({ url, response: json({ ok: true, rdos: fixtureRows }) })),
    { url: assetUrl, response: new Response("current asset") },
    { cache: "unrelated-feature-cache", url: otherUrl, response: new Response("other asset") }
  ] });
  await worker.activate();
  const current = worker.stores.get(cacheName);
  assert.ok(current, "The current offline shell cache must remain available");
  for (const url of privateUrls) assert.equal(current.has(url), false, "Legacy private API entry must be evicted: " + url);
  assert.equal(current.has(assetUrl), true);
  assert.equal(worker.stores.get("unrelated-feature-cache").has(otherUrl), true);
});
