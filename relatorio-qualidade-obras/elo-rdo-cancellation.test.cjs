"use strict";

// The real assistant, canonical auth adapter and bridge run only against these synthetic fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const {execFileSync} = require("node:child_process");

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
  const optionsForRuntime = options;
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
    addEventListener() {}, removeEventListener() {}, setTimeout: optionsForRuntime.queryTimers ? (callback, delay) => delay < 10000 ? immediate(callback) : 0 : immediate, clearTimeout() {},
    open() { return null; }, URL,
    atob(value) { return Buffer.from(String(value), "base64").toString("binary"); },
    btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); },
    async fetch(rawUrl, options = {}) {
      const url = new URL(String(rawUrl));
      const method = String(options.method || "GET").toUpperCase();
      calls.push({ url: String(rawUrl), method, options });
      assert.equal(url.origin, "https://obrareport-backend.onrender.com");
      if (optionsForRuntime.rdos && url.pathname === "/api/obrareport/rdos" && method === "GET") {
        assert.equal(options.headers.Authorization, "Bearer " + CREDENTIAL);
        return { ok: true, status: 200, async json() { return { ok: true, rdos: optionsForRuntime.rdos }; } };
      }
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
    vm.runInContext((process.env.RDO_CANCEL_BASELINE_REF ? execFileSync("git", ["show", process.env.RDO_CANCEL_BASELINE_REF + ":relatorio-qualidade-obras/" + name], {cwd:path.resolve(__dirname,".."),encoding:"utf8",maxBuffer:20*1024*1024}) : fs.readFileSync(path.join(__dirname, name), "utf8")), context, { filename: name });
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

const CANCEL_PUBLIC="Cancele a prévia. Não salve nem crie nenhum RDO.";
const PREVIEW="Prepare um RDO de 15/10/2026 para a OBRA TESTE ELO E2E. Equipe: 1 encarregado, 2 pedreiros e 3 serventes. Jornada: das 08h às 17h. Clima: sol. Serviço: 17 m² de alvenaria. Material recebido: 24 sacos de cimento às 10h. Não salve.";
for(const [state,command]of [["ready",PREVIEW],["missing-date","Prepare um RDO para a OBRA TESTE ELO E2E, mas não salve."]])test("cancel reproduction: exact LIVE sentence / "+state,async t=>{
 const env=runtime();await env.ask(command);const before=JSON.parse(JSON.stringify(env.pending()));
 const request=env.api.detectCommandBridgeRequestForTest(CANCEL_PUBLIC);
 await env.ask(CANCEL_PUBLIC);
 t.diagnostic(JSON.stringify({input:CANCEL_PUBLIC,state,route:request,before,output:env.answer(),after:env.pending(),writes:env.calls.filter(x=>x.method!=="GET").length}));
 assert.equal(env.pending(),null);assert.match(env.answer(),/cancelad/i);assert.doesNotMatch(env.answer(),/informe:|para qual obra/i);assert.equal(env.calls.filter(x=>x.method!=="GET").length,0);
});

const copy=value=>JSON.parse(JSON.stringify(value));
const noWrites=env=>assert.equal(env.calls.filter(c=>c.method!=="GET").length,0);
const CANCEL_VARIANTS=[
"Cancele a prévia","Elo, cancele a prévia, por favor.","Por favor, cancele o rascunho.",
"Cancela essa prévia.","Cancelar a prévia.","Pode cancelar a prévia.",
"Quero cancelar esta operação.","Aborte a preparação do RDO.","Descarte a prévia do RDO.",
"Interrompa a preparação do RDO.","Cancele a prévia! Não execute.",
"Corrija o clima para chuva e cancele a prévia.","Não salve ainda; cancele a prévia.",
"Mostre o resumo. Cancele a prévia.","Cancele a prévia e não crie nada.",
"cansela a previa","cancelle a prévia","canceela a previa",
"Cancele a prévia, sem salvar e sem atualizar o RDO.","cancela isso",
"Cancele o RDO que ainda não foi salvo."
];
for(const phrase of CANCEL_VARIANTS)test("natural cancellation: "+phrase,async()=>{
 const env=runtime();await env.ask(PREVIEW);assert.ok(env.pending());
 const request=env.api.detectCommandBridgeRequestForTest(phrase);assert.equal(request.action,"rdo_cancel");assert.equal(env.api.isCommandBridgePriorityRequestForTest(request),true);
 await env.ask(phrase);assert.equal(env.pending(),null);assert.match(env.answer(),/cancelad/i);assert.doesNotMatch(env.answer(),/informe:|para qual obra/i);noWrites(env);
 await env.ask("sim");assert.equal(env.pending(),null);noWrites(env);
});
for(const phrase of ["Não salve ainda","Não salve por enquanto.","Não crie ainda este RDO.","Não cancele a prévia.","Não quero cancelar."])test("hold preserves pending byte-for-byte: "+phrase,async()=>{
 const env=runtime();await env.ask(PREVIEW);const before=copy(env.pending());await env.ask(phrase);assert.deepEqual(copy(env.pending()),before);assert.match(env.answer(),/continua pendente/);noWrites(env);
});
for(const phrase of ["Posso cancelar?","Posso cancelar a prévia do RDO?","Como cancelo a prévia?","O que acontece se cancelar a prévia?","Se eu cancelar, perco os dados?","Você pode cancelar uma prévia?","Quero cancelar?"])test("question does not cancel: "+phrase,async()=>{
 const env=runtime();await env.ask(PREVIEW);const before=copy(env.pending());await env.ask(phrase);assert.deepEqual(copy(env.pending()),before);assert.match(env.answer(),/pergunta não cancelou/);noWrites(env);
});
test("cancel after correcting 24 to 22 clears revised operation without writes",async()=>{
 const env=runtime();await env.ask(PREVIEW);await env.ask("Corrija apenas o material recebido de 24 para 22 sacos de cimento. Preserve todos os demais dados e não salve.");assert.equal(env.pending().draft.rdoData.materials[0].quantity,22);await env.ask(CANCEL_PUBLIC);assert.equal(env.pending(),null);noWrites(env);
});
test("repeated cancellation and absent pending are idempotent",async()=>{
 const env=runtime();await env.ask(PREVIEW);for(let i=0;i<3;i++)await env.ask(CANCEL_PUBLIC);assert.equal(env.pending(),null);assert.match(env.answer(),/Não há ação de RDO pendente/);noWrites(env);
});
test("cancel with no pending never starts field collection",async()=>{
 const env=runtime();await env.ask(CANCEL_PUBLIC);assert.equal(env.pending(),null);assert.doesNotMatch(env.answer(),/informe:|data do RDO/i);noWrites(env);
});
test("subject change retains pending and does not become cancellation",async()=>{
 const env=runtime();await env.ask(PREVIEW);const before=copy(env.pending());await env.ask("Quanto é 2 + 2?");assert.deepEqual(copy(env.pending()),before);assert.doesNotMatch(env.answer(),/foi cancelada/);noWrites(env);
});
test("other module cancellation is not stolen by RDO",()=>{
 const env=runtime();assert.equal(env.window.EloActionBusRdo.classifyCancellation("Cancele o pagamento.",true),"");assert.equal(env.window.EloActionBusRdo.classifyCancellation("Não cancele a prévia.",true),"hold");
});
test("bridge defensively recognizes cancellation even with incorrect create action",async()=>{
 const env=runtime();await env.ask(PREVIEW);const r=await env.window.EloActionBusRdo.execute({action:"preview_new_rdo",payload:{message:CANCEL_PUBLIC}});assert.equal(r.action,"rdo.cancel");assert.equal(env.pending(),null);noWrites(env);
});
test("concurrent duplicate cancels do not write",async()=>{
 const env=runtime();await env.ask(PREVIEW);await Promise.all(Array.from({length:8},()=>env.window.EloActionBusRdo.execute({action:"rdo_cancel",payload:{message:CANCEL_PUBLIC}})));assert.equal(env.pending(),null);noWrites(env);
});
test("stale async cancellation cannot remove replacement operation with same ID and date",async()=>{
 const env=runtime(undefined,{providerOnly:true});await env.ask(PREVIEW);const before=copy(env.pending());let release;const gate=new Promise(r=>release=r);const old=env.window.EloCanonicalSession.getSession;env.window.EloCanonicalSession.getSession=async()=>{await gate;return old();};
 const request=env.window.EloActionBusRdo.execute({action:"rdo_cancel",payload:{message:CANCEL_PUBLIC}});const replacement={...before,operationToken:before.operationToken+":replacement"};env.localStorage.setItem("elo_action_bus_rdo_pending_v1",JSON.stringify(replacement));release();const r=await request;assert.equal(r.ok,false);assert.deepEqual(copy(env.pending()),replacement);noWrites(env);
});
test("stale confirmation after cancellation cannot confirm a replacement pending",async()=>{
 const env=runtime(undefined,{providerOnly:true});await env.ask(PREVIEW);const before=copy(env.pending());let release;const gate=new Promise(r=>release=r);const old=env.window.EloCanonicalSession.getSession;env.window.EloCanonicalSession.getSession=async()=>{await gate;return old();};
 const confirmation=env.window.EloActionBusRdo.execute({action:"rdo_confirm",payload:{message:"sim"}});env.window.EloActionBusRdo.clearPending();const replacement={...before,operationToken:before.operationToken+":new"};env.localStorage.setItem("elo_action_bus_rdo_pending_v1",JSON.stringify(replacement));release();assert.equal((await confirmation).ok,false);assert.deepEqual(copy(env.pending()),replacement);noWrites(env);
});
test("cancel cannot invalidate pending of another account",async()=>{
 const env=runtime(undefined,{providerOnly:true});await env.ask(PREVIEW);const before=copy(env.pending());env.switchActor({institutionId:"other-tenant",companyId:"other-company",userId:"other-user",role:"admin"});const r=await env.window.EloActionBusRdo.execute({action:"rdo_cancel",payload:{message:CANCEL_PUBLIC}});assert.equal(r.ok,false);assert.deepEqual(copy(env.pending()),before);noWrites(env);
});
test("new conversation invalidates old pending and confirmation",async()=>{
 const env=runtime();await env.ask(PREVIEW);env.api.startNewConversationForLayoutTest();assert.equal(env.pending(),null);await env.ask("sim");assert.equal(env.pending(),null);noWrites(env);
});
test("pending catalog response cannot resurrect cancelled conversation operation",async()=>{
 const env=runtime();const original=env.window.fetch;let release;const gate=new Promise(r=>release=r);env.window.fetch=async(...args)=>{await gate;return original(...args);};
 const inFlight=env.window.EloActionBusRdo.execute({action:"preview_new_rdo",payload:{message:PREVIEW}});await new Promise(r=>setImmediate(r));env.window.EloActionBusRdo.clearPending();release();const r=await inFlight;assert.equal(r.ok,false);assert.equal(env.pending(),null);noWrites(env);
});
test("cancellation during already-sending confirmation never claims an undo",async()=>{
 const env=runtime();await env.ask(PREVIEW);const p=copy(env.pending());p.status="saving";env.localStorage.setItem("elo_action_bus_rdo_pending_v1",JSON.stringify(p));await env.ask(CANCEL_PUBLIC);assert.equal(env.pending().status,"saving");assert.match(env.answer(),/já está em andamento/);noWrites(env);
});

test("missing pending confirmation keeps established error contract and performs no write",async()=>{const env=runtime();const r=await env.window.EloActionBusRdo.execute({action:"rdo_confirm",payload:{message:"sim"}});assert.equal(r.error,"rdo_pending_missing");noWrites(env);});
