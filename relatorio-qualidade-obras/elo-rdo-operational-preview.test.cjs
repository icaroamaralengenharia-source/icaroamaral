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


const FULL_COMMAND = `Elo, crie o RDO de hoje para a OBRA TESTE ELO E2E.

Este é o piloto controlado PILOTO_ELO_RDO_PREVIEW_TEST.

Equipe presente:
1 encarregado,
2 pedreiros
e 3 serventes.

Horário:
das 8h às 17h.

Clima:
sol.

Serviço executado:
17 m² de alvenaria.

Material recebido:
24 sacos de cimento às 10h.

Intercorrência:
houve paralisação parcial entre 14h e 14h30 por falta de material.

Não salve antes de me mostrar a prévia completa.`;

test("operational preview: exact public pilot extracts, retains and renders the official fields without writes", async (t) => {
  const env = runtime();
  const request = env.api.detectCommandBridgeRequestForTest(FULL_COMMAND);
  const intent = env.window.EloActionBusRdo.parseIntent(request);
  assert.equal(intent.workName, WORK_NAME);
  await env.ask(FULL_COMMAND);
  const pending = env.pending();
  t.diagnostic(JSON.stringify({ extracted: intent.rdoData || null, pending: pending.draft.rdoData, preview: env.answer(), writes: env.calls.filter((call) => call.method !== "GET").length }));
  assertPreview(env);
  assert.equal(intent.rdoData && intent.rdoData.employeeCount, "6", "intent parser extracts the operational team before the bridge builds pending");
  assert.equal(pending.draft.rdoData.employeeCount, "6");
  assert.match(pending.draft.rdoData.teamPresent, /1 encarregado.*2 pedreiros.*3 serventes/);
  assert.equal(pending.draft.rdoData.startTime, "08:00");
  assert.equal(pending.draft.rdoData.endTime, "17:00");
  assert.equal(pending.draft.rdoData.weather, "sol");
  assert.deepEqual(plain(pending.draft.rdoData.productions).map(({ id, ...item }) => item), [{ service: "alvenaria", quantity: 17, unit: "m²" }]);
  assert.deepEqual(plain(pending.draft.rdoData.materials).map(({ id, ...item }) => item), [{ name: "cimento", quantity: 24, unit: "sacos", note: "Recebido às 10:00" }]);
  assert.match(pending.draft.rdoData.productions[0].id, /^elo_prd_/);
  assert.match(pending.draft.rdoData.materials[0].id, /^elo_mat_/);
  assert.match(pending.draft.rdoData.occurrences, /paralisação parcial entre 14:00 e 14:30 por falta de material/);
  assert.match(pending.draft.rdoData.generalNotes, /PILOTO_ELO_RDO_PREVIEW_TEST/);
  for (const value of ["OBRA TESTE ELO E2E", "1 encarregado", "2 pedreiros", "3 serventes", "08:00", "17:00", "sol", "17 m²", "alvenaria", "24 sacos", "cimento", "10:00", "14:00", "14:30", "falta de material", "PILOTO_ELO_RDO_PREVIEW_TEST"]) assert.ok(env.answer().includes(value), value);
  assert.doesNotMatch(env.answer(), /PROJECT ID|operationId|WRITE EXECUTED|MODULE:|ACTION:|CONFIRMATION REQUIRED|pending-fixture|work_pending_fixture|elo_(?:prd|mat)_|\{"/);
  assert.ok(env.answer().replace(/\s+Sem voz[\s\S]*$/, "").trim().endsWith("Ainda não salvei. Deseja confirmar?"));
});

const plain = (value) => JSON.parse(JSON.stringify(value));

for (const [field, expected] of [
  ["employeeCount", "6"], ["teamPresent", "1 encarregado, 2 pedreiros e 3 serventes"],
  ["startTime", "08:00"], ["endTime", "17:00"], ["weather", "sol"],
  ["productions", [{ service: "alvenaria", quantity: 17, unit: "m²" }]],
  ["materials", [{ name: "cimento", quantity: 24, unit: "sacos", note: "Recebido às 10:00" }]],
  ["occurrences", "houve paralisação parcial entre 14:00 e 14:30 por falta de material"],
  ["generalNotes", "PILOTO_ELO_RDO_PREVIEW_TEST"]
]) {
  test("operational preview: official field survives parser → pending → follow-up: " + field, async () => {
    const env = runtime();
    const intent = env.window.EloActionBusRdo.parseIntent(env.api.detectCommandBridgeRequestForTest(FULL_COMMAND));
    assert.deepEqual(plain(intent.rdoData[field]), expected);
    await env.ask(FULL_COMMAND);
    const stored = plain(env.pending().draft.rdoData[field]);
    assert.deepEqual(Array.isArray(stored) ? stored.map(({ id, ...item }) => item) : stored, expected);
    await env.ask("quais campos foram preenchidos?");
    const revised = plain(env.pending().draft.rdoData[field]);
    assert.deepEqual(Array.isArray(revised) ? revised.map(({ id, ...item }) => item) : revised, expected);
    assertNoWrites(env);
  });
}

for (const phrase of [
  "mostre a prévia completa", "quais campos foram preenchidos?", "faltou mostrar a equipe", "inclua os horários", "não salve ainda",
  "Mostre a prévia completa desse mesmo RDO com a equipe, os horários, clima, serviço, material, intercorrência e marcador que informei. Não salve nem execute."
]) {
  test("operational preview: follow-up remains in the same bound draft: " + phrase, async () => {
    const env = runtime();
    await env.ask(FULL_COMMAND);
    const before = plain(env.pending());
    const request = env.api.detectCommandBridgeRequestForTest(phrase);
    assert.equal(request.action, "rdo.create.revise");
    assert.equal(env.api.isCommandBridgePriorityRequestForTest(request), true);
    await env.ask(phrase);
    assert.deepEqual(plain(env.pending()), before);
    assert.match(env.answer(), /EQUIPE: 6 pessoas/);
    assert.match(env.answer(), /24 sacos de cimento/);
    assert.doesNotMatch(env.answer(), /RDOs encontrados|O resultado é|Claro\. Me passe/);
    assertNoWrites(env);
  });
}

test("operational preview: 24 → 22 modifies only one material quantity, preserving the operation and receipt time", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending());
  await env.ask("Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");
  const expected = plain(before);
  expected.draft.rdoData.materials[0].quantity = 22;
  assert.deepEqual(plain(env.pending()), expected);
  assert.match(env.answer(), /22 sacos de cimento.*10:00/);
  assert.doesNotMatch(env.answer(), /24 sacos|RDOs encontrados/);
  assertNoWrites(env);
});

test("operational preview: incomplete material correction asks for details and blocks save without changing fields", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending().draft);
  await env.ask("corrija o material");
  assert.match(env.answer(), /Informe o material e a quantidade/);
  assert.deepEqual(plain(env.pending().draft), before);
  await env.ask("sim");
  assert.match(env.answer(), /incompleto/);
  assertNoWrites(env);
  await env.ask("Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");
  assert.equal(env.pending().draft.rdoData.materials[0].quantity, 22);
  assert.equal(env.pending().revisionError, undefined);
  assertNoWrites(env);
});

test("operational preview: mismatched previous quantity cannot edit a different receipt", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending().draft);
  await env.ask("Corrija o material: chegaram 22 sacos de cimento, não 25.");
  assert.deepEqual(plain(env.pending().draft), before);
  assert.match(env.answer(), /Não alterei/);
  assertNoWrites(env);
});

test("operational preview: cancellation clears the draft without creating an RDO", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  await env.ask("não");
  assert.equal(env.pending(), null);
  assert.match(env.answer(), /cancelada/);
  assertNoWrites(env);
});

test("operational preview: asking to display a preview never applies quantities mentioned in the question", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending());
  await env.ask("Mostre a prévia completa. Material recebido: 99 sacos de cimento às 11h. Não salve.");
  assert.deepEqual(plain(env.pending()), before);
  assert.match(env.answer(), /24 sacos de cimento.*10:00/);
  assertNoWrites(env);
});

test("operational preview: correcting one receipt preserves other receipts and services", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND.replace("24 sacos de cimento às 10h.", "24 sacos de cimento às 10h; 8 unidades de bloco às 11h.").replace("17 m² de alvenaria.", "17 m² de alvenaria; 5 m² de chapisco."));
  const before = plain(env.pending());
  assert.equal(before.draft.rdoData.materials.length, 2);
  assert.equal(before.draft.rdoData.productions.length, 2);
  await env.ask("Corrija nesse mesmo RDO: chegaram 22 sacos de cimento, não 24. Não altere os demais dados.");
  before.draft.rdoData.materials[0].quantity = 22;
  assert.deepEqual(plain(env.pending()), before);
  assertNoWrites(env);
});

test("operational preview: signed material quantities cannot turn into positive corrections", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending().draft);
  await env.ask("Corrija o material: chegaram -22 sacos de cimento, não 24.");
  assert.deepEqual(plain(env.pending().draft), before);
  assert.match(env.answer(), /Não alterei/);
  assertNoWrites(env);
});

test("operational preview: team roles use the official supplied text, including additional trades", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND.replace("3 serventes", "3 armadores"));
  assert.equal(env.pending().draft.rdoData.employeeCount, "6");
  assert.match(env.pending().draft.rdoData.teamPresent, /1 encarregado, 2 pedreiros e 3 armadores/);
  assertNoWrites(env);
});

for (const cancelFirst of [true, false]) {
  test("operational preview: explicit new create inherits no operational fields " + (cancelFirst ? "after cancellation" : "while another draft is pending"), async () => {
    const env = runtime([work(), work("new_validated_work", "OBRA SEGUNDA")]);
    await env.ask(FULL_COMMAND);
    if (cancelFirst) await env.ask("cancelar");
    await env.ask("Elo, crie o RDO de hoje para a OBRA SEGUNDA. Não salve.");
    assertPreview(env, "new_validated_work");
    const data = env.pending().draft.rdoData;
    for (const field of ["employeeCount", "teamPresent", "materials", "productions", "occurrences", "generalNotes", "weather", "startTime", "endTime"]) assert.equal(data[field], undefined, field);
    assert.doesNotMatch(env.answer(), /PILOTO_ELO_RDO_PREVIEW_TEST|24 sacos|17 m²|6 pessoas/);
    assertNoWrites(env);
  });
}

test("operational preview: all supplied fields survive the missing-date continuation from PR228", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND.replace("RDO de hoje", "RDO"));
  const before = plain(env.pending());
  assert.equal(before.status, "awaiting_work");
  assert.equal(before.draft.rdoData.employeeCount, "6");
  await env.ask("15/10/2026");
  assertPreview(env);
  assert.equal(env.pending().operationId, before.operationId);
  assert.equal(env.pending().createdAt, before.createdAt);
  for (const field of ["employeeCount", "teamPresent", "materials", "productions", "occurrences", "generalNotes", "weather", "startTime", "endTime"]) assert.deepEqual(plain(env.pending().draft.rdoData[field]), before.draft.rdoData[field], field);
  assertNoWrites(env);
});

test("operational preview: work selection retains fields and uses only a canonical catalog ID", async () => {
  const env = runtime([work(), work("other_canonical_work", "OBRA SEGUNDA")]);
  await env.ask(FULL_COMMAND.replace(" para a OBRA TESTE ELO E2E", ""));
  assert.equal(env.pending().status, "awaiting_work");
  await env.ask(WORK_NAME);
  assertPreview(env);
  assert.equal(env.pending().draft.rdoData.employeeCount, "6");
  assert.equal(env.pending().draft.rdoData.materials[0].quantity, 24);
  assertNoWrites(env);
});

test("operational preview: absent fields have no invented operational values", async () => {
  const env = runtime();
  await env.ask("Elo, crie um RDO de hoje para a OBRA TESTE ELO E2E, mas não salve.");
  const data = env.pending().draft.rdoData;
  for (const field of ["responsible", "employeeCount", "weather", "startTime", "endTime", "materials", "productions", "occurrences", "generalNotes"]) assert.equal(data[field], undefined, field);
  assert.match(env.answer(), /CLIMA: Não informado/);
  assert.match(env.answer(), /EQUIPE: Não informado/);
  assertNoWrites(env);
});

for (const providerOnly of [false, true]) {
  test("operational preview: another canonical actor cannot read or revise the old draft, providerOnly=" + providerOnly, async () => {
    const env = runtime([work()], { providerOnly });
    await env.ask(FULL_COMMAND);
    const before = plain(env.pending());
    const reads = env.calls.length;
    env.switchActor({ ...IDENTITY, userId: "other_user", institutionId: "other_tenant", companyId: "other_company" }, false);
    await env.ask("mostre a prévia completa");
    assert.match(env.answer(), /outra sessão/);
    assert.doesNotMatch(env.answer(), /PILOTO_ELO_RDO_PREVIEW_TEST|24 sacos|17 m²|OBRA TESTE/);
    assert.equal(env.calls.length, reads);
    assert.deepEqual(plain(env.pending()), before);
    assertNoWrites(env);
  });
}

for (const key of ["operationId", "createdAt"]) {
  test("operational preview: rejects stale continuation " + key, async () => {
    const env = runtime();
    await env.ask(FULL_COMMAND);
    const request = env.api.detectCommandBridgeRequestForTest("mostre a prévia completa");
    request.payload.rdoPreviewContinuation[key] = "stale";
    const before = plain(env.pending());
    const result = await env.window.EloActionBusRdo.execute(request);
    assert.equal(result.error, "rdo_preview_context_changed");
    assert.deepEqual(plain(env.pending()), before);
    assertNoWrites(env);
  });
}

test("operational preview: a foreign catalog cannot expose another tenant's fields or names", async () => {
  const env = runtime([work("foreign_id", "FOREIGN TENANT WORK", "foreign_tenant")]);
  await env.ask(FULL_COMMAND);
  assert.equal(env.pending(), null);
  assert.doesNotMatch(env.answer(), /FOREIGN TENANT WORK|foreign_id/);
  assertNoWrites(env);
});

test("operational preview: an operational continuation cannot be replayed as a new create preview", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending());
  const request = env.api.detectCommandBridgeRequestForTest("mostre a prévia completa");
  request.action = "rdo.create.preview";
  const result = await env.window.EloActionBusRdo.execute(request);
  assert.equal(result.error, "rdo_preview_context_changed");
  assert.deepEqual(plain(env.pending()), before);
  assertNoWrites(env);
});

test("operational preview: an explicit Stock Full product command retains its module during an RDO draft", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const before = plain(env.pending());
  const request = env.api.detectCommandBridgeRequestForTest("adicione um novo produto chamado CIMENTO TESTE com unidade saco no Stock Full");
  assert.equal(request.module, "stock_full");
  assert.equal(request.action, "create_product");
  assert.deepEqual(plain(env.pending()), before);
  assertNoWrites(env);
});

test("operational preview: official generator consumes the preserved fields without a parallel schema", async () => {
  const env = runtime();
  await env.ask(FULL_COMMAND);
  const data = plain(env.pending().draft.rdoData);
  const { buildRdoGeneratorPayload } = await import(require("node:url").pathToFileURL(path.join(__dirname, "../backend/src/services/obrareport-report-orchestrator.js")).href);
  const payload = buildRdoGeneratorPayload({ rdo_date: data.date, project_id: WORK_ID, rdo_data_json: data });
  assert.equal(payload.report.team, data.teamPresent);
  assert.equal(payload.report.workers, "6");
  assert.equal(payload.report.climate, "sol");
  assert.equal(payload.report.hours, "08:00 - 17:00");
  assert.match(payload.report.production, /alvenaria: 17 m²/);
  assert.deepEqual(payload.report.materials, data.materials);
  assert.equal(payload.report.occurrences, data.occurrences);
  assert.equal(payload.report.observations, data.generalNotes);
  assertNoWrites(env);
});

test("AUDIT-005 preview review accepts adverbs without losing the bound draft",async()=>{const env=runtime();await env.ask(FULL_COMMAND);const before=JSON.stringify(env.pending());await env.ask("Mostre novamente a prévia completa.");assert.equal(JSON.stringify(env.pending()),before);assert.match(env.answer(),/EQUIPE: 6 pessoas/);assertNoWrites(env);});
test("AUDIT-005 date revision takes priority over saved RDO update",async()=>{const env=runtime();await env.ask(FULL_COMMAND);await env.ask("Corrija somente a data deste RDO para 13/10/2026. Não altere os demais dados.");assert.equal(env.pending().draft.rdoDate,"2026-10-13");assert.equal(env.pending().draft.rdoData.materials[0].quantity,24);assertNoWrites(env);});
test("AUDIT-005 work change resolves canonical catalog and keeps operational data",async()=>{const env=runtime([{id:WORK_ID,name:WORK_NAME,institutionId:IDENTITY.institutionId},{id:"work_other",name:"Obra Residencial Mar",institutionId:IDENTITY.institutionId}]);await env.ask(FULL_COMMAND);await env.ask("Troque a obra para Obra Residencial Mar.");assert.equal(env.pending().draft.projectId,"work_other");assert.equal(env.pending().draft.rdoData.employeeCount,"6");assertNoWrites(env);});
test("AUDIT-010 RDO payload preserves long notes beyond generic 600 character helper",async()=>{const env=runtime();const notes="Atenção à concretagem e proteção dos elementos. ".repeat(30)+"FIM_NOTA_EXTENSA";await env.ask("Prepare um RDO de 15/10/2026 para a "+WORK_NAME+". Observações: "+notes+". Não salve.");assert.equal(env.pending().draft.rdoData.generalNotes,notes);assert.match(env.answer(),/FIM_NOTA_EXTENSA/);assertNoWrites(env);});
test("AUDIT-011 new conversation clears unsaved RDO without any write",async()=>{const env=runtime();await env.ask(FULL_COMMAND);env.api.startNewConversationForLayoutTest();assert.equal(env.pending(),null);assertNoWrites(env);});
test("AUDIT-011 logout clears unsaved RDO without any write",async()=>{const env=runtime();await env.ask(FULL_COMMAND);await env.api.logoutSupabaseForTest();assert.equal(env.pending(),null);assertNoWrites(env);});
