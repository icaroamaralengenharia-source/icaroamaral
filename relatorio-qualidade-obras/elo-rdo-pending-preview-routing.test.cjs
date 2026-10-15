"use strict";

// The real assistant, canonical auth adapter and bridge run only against these synthetic fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const NOW = "2026-10-15T12:00:00.000Z";
const IDENTITY = { userId: "pending_fixture_user", institutionId: "pending_fixture_tenant", companyId: "pending_fixture_company", role: "admin" };
const CREDENTIAL = "synthetic-pending-preview-credential";
const WORK_ID = "work_pending_fixture_canonical";
const WORK_NAME = "OBRA TESTE ELO E2E";
const SMOKE = "Elo, prepare um RDO para a OBRA TESTE ELO E2E, mas não salve.";

class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [NOW])); }
  static now() { return new Date(NOW).getTime(); }
}

function storage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); }, clear() { values.clear(); }
  };
}

function element(tag) {
  const classes = new Set();
  const node = {
    tagName: String(tag || "").toUpperCase(), dataset: {}, style: {}, children: [],
    value: "", scrollTop: 0, scrollHeight: 0, clientHeight: 0,
    classList: {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) { const on = force === undefined ? !classes.has(name) : !!force; on ? classes.add(name) : classes.delete(name); return on; }
    },
    appendChild(child) {
      if (child.parentNode) child.remove();
      child.parentNode = this; this.children.push(child); this.firstChild = this.children[0] || null;
      this.scrollHeight = this.children.length * 120; return child;
    },
    remove() {
      if (this.parentNode) {
        this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
        this.parentNode.firstChild = this.parentNode.children[0] || null;
      }
      this.parentNode = null;
    },
    addEventListener() {}, setAttribute(key, value) { this[key] = String(value); },
    getAttribute(key) { return this[key] || ""; },
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
    querySelectorAll(selector) {
      const found = [];
      const selectors = String(selector).split(",").map((part) => part.trim());
      function visit(parent) {
        parent.children.forEach((child) => {
          if (selectors.some((part) => part[0] === "." && part.slice(1).split(".").every((name) => child.classList.contains(name)))) found.push(child);
          visit(child);
        });
      }
      visit(this); return found;
    }
  };
  Object.defineProperty(node, "className", {
    get() { return [...classes].join(" "); },
    set(value) { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); }
  });
  Object.defineProperty(node, "textContent", {
    get() { return this._text || ""; },
    set(value) { this._text = String(value || ""); if (!this._text) { this.children = []; this.firstChild = null; } }
  });
  return node;
}

function text(node) { return [node.textContent || "", ...node.children.map(text)].join(" "); }
function work(id = WORK_ID, name = WORK_NAME, institutionId = IDENTITY.institutionId) {
  return { id, name, institutionId, projectId: id, workId: id, clientId: "pending_fixture_client" };
}

function runtime(works = [work()], options = {}) {
  const calls = [];
  const localStorage = storage();
  const document = {
    readyState: "complete", body: element("body"), documentElement: element("html"),
    createElement: element, createDocumentFragment() { return element("fragment"); },
    addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; }
  };
  const messages = element("div");
  let canonicalIdentity = { ...IDENTITY };
  function storeCanonicalSession() {
    if (options.providerOnly) return;
    localStorage.setItem("obrareport-rdo-stock-canonical-session-v1", JSON.stringify({
      session: { access_token: CREDENTIAL, expires_at: Math.floor(FixtureDate.now() / 1000) + 3600 },
      user: { id: canonicalIdentity.userId },
      profile: { institution_id: canonicalIdentity.institutionId, company_id: canonicalIdentity.companyId }
    }));
  }
  storeCanonicalSession();
  const quiet = { log() {}, info() {}, warn() {}, error() {} };
  const immediate = (fn) => { if (typeof fn === "function") fn(); return 0; };
  const window = {
    ELO_SKIP_AUTO_WIDGET: true, ELO_DISABLE_AUTOFOCUS: true, ELO_PRODUCT_MODE: true,
    ELO_AUTH_CONTEXT: { ...IDENTITY },
    location: { hostname: "www.icaroamaral.com.br", protocol: "https:", pathname: "/elo.html", search: "", hash: "" },
    localStorage, sessionStorage: storage(), document, console: quiet,
    navigator: { onLine: true, userAgent: "synthetic-pending-preview-test" },
    crypto: { randomUUID() { return "pending-fixture-id"; } },
    addEventListener() {}, removeEventListener() {}, setTimeout: immediate, clearTimeout() {},
    open() { return null; }, URL,
    atob(value) { return Buffer.from(String(value), "base64").toString("binary"); },
    btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); },
    async fetch(rawUrl, options = {}) {
      const url = new URL(String(rawUrl));
      const method = String(options.method || "GET").toUpperCase();
      calls.push({ url: String(rawUrl), method, options });
      assert.equal(url.origin, "https://obrareport-backend.onrender.com");
      assert.equal(url.pathname, "/api/stock-full/works", "only canonical catalog reads are permitted");
      assert.equal(method, "GET", "no RDO, chat, TTS or other POST is permitted");
      assert.equal(options.cache, "no-store");
      assert.equal(options.headers.Authorization, "Bearer " + CREDENTIAL);
      assert.equal(options.headers["x-institution-id"], canonicalIdentity.institutionId);
      assert.equal(options.headers["x-company-id"], canonicalIdentity.companyId);
      assert.equal(options.headers["x-user-id"], canonicalIdentity.userId);
      return { ok: true, status: 200, async json() { return { ok: true, works }; } };
    }
  };
  window.window = window;
  const context = vm.createContext({
    window, globalThis: window, document, navigator: window.navigator, console: quiet,
    Date: FixtureDate, Math, URL, URLSearchParams, Blob,
    setTimeout: immediate, clearTimeout() {}, fetch: window.fetch
  });
  for (const name of ["rdo-canonical-auth.js", "elo-command-bridge.js", "elo-assistente.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, name), "utf8"), context, { filename: name });
  }
  if (options.providerOnly) window.EloCanonicalSession = {
    async getSession() { return { ok: true, accessToken: CREDENTIAL, authContext: { ...canonicalIdentity } }; },
    async getValidAccessToken() { return CREDENTIAL; }
  };
  const api = window.EloAssistente;
  api.setCoreMessagesElementForTest(messages);
  return {
    api, window, calls, localStorage,
    pending() { return window.EloActionBusRdo.readPending(); },
    answer() { return text(messages.children[messages.children.length - 1] || messages); },
    async ask(message) {
      api.ask(message, [], "manual");
      for (let round = 0; round < 3; round += 1) await new Promise((done) => setImmediate(done));
      return this.answer();
    },
    switchActor(identity, updateCore = true) { canonicalIdentity = { ...identity }; if (updateCore) window.ELO_AUTH_CONTEXT = { ...identity }; storeCanonicalSession(); }
  };
}

function assertNoWrites(env) {
  assert.equal(env.calls.filter((call) => call.method !== "GET").length, 0);
  assert.ok(env.calls.every((call) => new URL(call.url).pathname === "/api/stock-full/works"));
  assert.equal(env.api.getRdoPreviewStateForTest().active, false, "legacy preview was not started");
}

function assertPreview(env, id = WORK_ID, date = "2026-10-15") {
  const pending = env.pending();
  assert.equal(pending.action, "rdo.create.execute");
  assert.equal(pending.status, "pending");
  assert.equal(pending.draft.projectId, id);
  assert.equal(pending.draft.workId, id);
  assert.equal(pending.draft.rdoDate, date);
  assert.equal(pending.draft.source, "stock_full_api");
  assert.match(env.answer(), /confirma|pr[eé]via|Preview/i);
  assert.doesNotMatch(env.answer(), /O resultado é 1,5|Claro\. Me passe/);
  assertNoWrites(env);
}

for (const dateAnswer of ["hoje", "15/10/2026", "Para hoje 15/10/2026 Mantenha sem salvar"]) {
  test("pending RDO: literal public smoke then " + dateAnswer + " reaches the canonical preview with zero POST", async () => {
    const env = runtime([work("other_work", "OBRA SECUNDÁRIA"), work()]);
    assert.match(await env.ask(SMOKE), /data do RDO/);
    assert.equal(env.pending().status, "awaiting_work");
    assert.equal(env.pending().targetDate, "");
    const request = env.api.detectCommandBridgeRequestForTest(dateAnswer);
    assert.equal(request.action, "rdo.create.preview");
    assert.equal(env.api.isCommandBridgePriorityRequestForTest(request), true);
    assert.notEqual(request.payload.workName, dateAnswer);
    await env.ask(dateAnswer);
    assertPreview(env);
    assert.equal(env.calls.length, 2);
  });
}

test("pending RDO: new explicit numeric-date command outranks an older awaiting-work selection", async () => {
  const env = runtime([work(), work("second_canonical_work", "OBRA SEGUNDA")]);
  await env.ask("Prepare um RDO de 14/10/2026, mas não salve.");
  assert.equal(env.pending().status, "awaiting_work");
  const phrase = "Elo, prepare um RDO para a OBRA SEGUNDA na data 15/10/2026, mas não salve.";
  const request = env.api.detectCommandBridgeRequestForTest(phrase);
  assert.equal(request.action, "preview_new_rdo");
  assert.equal(Object.hasOwn(request.payload, "workName"), false);
  await env.ask(phrase);
  assertPreview(env, "second_canonical_work");
});

test("pending RDO: an explicit today request also outranks the pending branch and legacy preview", async () => {
  const env = runtime();
  await env.ask(SMOKE);
  await env.ask("Elo, prepare um RDO de hoje para a OBRA TESTE ELO E2E, mas não salve.");
  assertPreview(env);
});

test("pending RDO: a new explicit request without a date does not inherit the prior request's date", async () => {
  const env = runtime([work(), work("second_canonical_work", "OBRA SEGUNDA")]);
  await env.ask("Prepare um RDO de 14/10/2026, mas não salve.");
  assert.equal(env.pending().targetDate, "2026-10-14");
  await env.ask("Prepare um RDO para a OBRA SEGUNDA, mas não salve.");
  assert.match(env.answer(), /data do RDO/);
  assert.equal(env.pending().targetDate, "");
  assert.equal(env.pending().draft.projectId, "");
  assertNoWrites(env);
});

test("pending RDO: a real work selection retains the explicitly supplied date", async () => {
  const env = runtime([work(), work("second_canonical_work", "Residencial Sintético")]);
  await env.ask("Prepare um RDO de 15/10/2026, mas não salve.");
  assert.match(env.answer(), /Para qual obra/);
  await env.ask("Residencial Sintético");
  assertPreview(env, "second_canonical_work");
});

test("pending RDO: a literal work selected before the date is retained without inventing an id", async () => {
  const env = runtime([work(), work("second_canonical_work", "Residencial Sintético")]);
  await env.ask("Prepare um RDO, mas não salve.");
  await env.ask("Residencial Sintético");
  assert.match(env.answer(), /data do RDO/);
  assert.equal(env.pending().draft.projectId, "");
  await env.ask("15/10/2026");
  assertPreview(env, "second_canonical_work");
});

test("pending RDO: a date correction replaces the old date before a real work selection", async () => {
  const env = runtime([work(), work("second_canonical_work", "Residencial Sintético")]);
  await env.ask("Prepare um RDO de 14/10/2026, mas não salve.");
  await env.ask("15/10/2026");
  assert.equal(env.pending().targetDate, "2026-10-15");
  assert.equal(env.pending().draft.projectId, "");
  await env.ask("Residencial Sintético");
  assertPreview(env, "second_canonical_work");
});

test("pending RDO: an unknown work selection cannot create an invented project", async () => {
  const env = runtime([work(), work("second_canonical_work", "Residencial Sintético")]);
  await env.ask("Prepare um RDO de 15/10/2026, mas não salve.");
  await env.ask("OBRA INEXISTENTE SINTÉTICA");
  assert.match(env.answer(), /Não encontrei essa obra/);
  assert.equal(env.pending().status, "awaiting_work");
  assert.equal(env.pending().draft.projectId, "");
  assertNoWrites(env);
});

test("pending RDO: an ambiguous canonical work still requires a real selection", async () => {
  const env = runtime([work("block_a", WORK_NAME + " BLOCO A"), work("block_b", WORK_NAME + " BLOCO B")]);
  await env.ask(SMOKE);
  await env.ask("15/10/2026");
  assert.match(env.answer(), /Para qual obra/);
  assert.equal(env.pending().draft.projectId, "");
  await env.ask(WORK_NAME + " BLOCO B");
  assertPreview(env, "block_b");
});

test("pending RDO: an unrelated unknown reply cannot invent either date or work", async () => {
  const env = runtime();
  await env.ask(SMOKE);
  await env.ask("assunto desconhecido completamente alheio");
  assert.match(env.answer(), /data do RDO/);
  assert.equal(env.pending().targetDate, "");
  assert.equal(env.pending().draft.projectId, "");
  assertNoWrites(env);
});

test("pending RDO: a date reply cannot reuse another user's pending work", async () => {
  const env = runtime();
  await env.ask(SMOKE);
  const before = env.localStorage.getItem("elo_action_bus_rdo_pending_v1");
  env.switchActor({ ...IDENTITY, userId: "another_synthetic_user" });
  await env.ask("hoje");
  assert.match(env.answer(), /outra sessão/);
  assert.equal(env.localStorage.getItem("elo_action_bus_rdo_pending_v1"), before);
  assertNoWrites(env);
});

for (const providerOnly of [false, true]) {
  test("pending RDO: a changed " + (providerOnly ? "provider-only" : "stored canonical") + " session cannot reuse a stale Core identity's pending work", async () => {
    const env = runtime([work()], { providerOnly });
    await env.ask(SMOKE);
    assert.equal(env.pending().status, "awaiting_work");
    const before = env.localStorage.getItem("elo_action_bus_rdo_pending_v1");
    const reads = env.calls.length;
    env.switchActor({ ...IDENTITY, userId: "canonical_session_user_changed", institutionId: "changed_fixture_tenant", companyId: "changed_fixture_company" }, false);
    await env.ask("hoje");
    assert.match(env.answer(), /outra sessão/);
    assert.equal(env.calls.length, reads, "binding rejects before another catalog read");
    assert.equal(env.localStorage.getItem("elo_action_bus_rdo_pending_v1"), before);
    assertNoWrites(env);
  });
}

test("pending RDO: explicit commands retain priority and exact confirmation/cancellation terms are unchanged", async () => {
  const env = runtime();
  await env.ask(SMOKE);
  for (const [phrase, action] of [["Liste os RDOs", "rdo.list"], ["Gere o PDF do RDO", "rdo.generateDocument"], ["Atualize o RDO", "rdo.update.preview"]]) {
    assert.equal(env.api.detectCommandBridgeRequestForTest(phrase).action, action, phrase);
  }
  for (const phrase of ["sim", "não"]) {
    assert.equal(env.api.detectCommandBridgeRequestForTest(phrase), null, phrase);
  }
  const ambiguousConfirmation = env.api.detectCommandBridgeRequestForTest("sim, pode criar porque revisei tudo");
  assert.notEqual(ambiguousConfirmation && ambiguousConfirmation.action, "rdo_confirm");
  await env.ask("15/10/2026");
  assertPreview(env);
  assert.equal(env.api.detectCommandBridgeRequestForTest("sim").action, "rdo_confirm");
  assert.equal(env.api.detectCommandBridgeRequestForTest("não").action, "rdo_cancel");
  assert.equal(env.api.detectCommandBridgeRequestForTest("sim, pode criar porque revisei tudo"), null);
  await env.ask("não");
  assert.equal(env.pending(), null);
  assertNoWrites(env);
});
