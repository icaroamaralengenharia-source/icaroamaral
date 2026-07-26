const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    writes: 0,
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { this.writes += 1; data.set(String(key), String(value)); },
    removeItem(key) { this.writes += 1; data.delete(String(key)); },
    clear() { this.writes += 1; data.clear(); },
    dump() { return Object.fromEntries(data); }
  };
}

function createJwt(payload = {}) {
  function encode(value) { return Buffer.from(JSON.stringify(value)).toString("base64url"); }
  return encode({ alg: "none", typ: "JWT" }) + "." + encode(Object.assign({
    iss: "https://lidueokjpzxdybtongbk.supabase.co/auth/v1",
    exp: Math.floor(Date.now() / 1000) + 3600
  }, payload)) + ".sig";
}

function createClassList(initial = []) {
  const classes = new Set(initial);
  return {
    add(...names) { names.forEach((name) => classes.add(String(name))); },
    remove(...names) { names.forEach((name) => classes.delete(String(name))); },
    toggle(name, force) {
      const active = force === undefined ? !classes.has(String(name)) : Boolean(force);
      if (active) classes.add(String(name)); else classes.delete(String(name));
      return active;
    },
    contains(name) { return classes.has(String(name)); }
  };
}

function createElement(tag) {
  const element = {
    tagName: String(tag || "").toUpperCase(),
    dataset: {},
    style: { setProperty() {} },
    children: [],
    parentNode: null,
    events: {},
    className: "",
    classList: createClassList(),
    appendChild(child) { child.parentNode = this; this.children.push(child); this.firstChild = this.children[0] || null; this.scrollHeight = this.children.length * 120; return child; },
    removeChild(child) { this.children = this.children.filter((item) => item !== child); child.parentNode = null; this.firstChild = this.children[0] || null; return child; },
    remove() { if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this); },
    addEventListener(type, listener) { this.events[type] = this.events[type] || []; this.events[type].push(listener); },
    click() { (this.events.click || []).forEach((listener) => listener({ preventDefault() {} })); },
    setAttribute(name, value) { this[String(name)] = String(value); },
    getAttribute(name) { return this[String(name)] || ""; },
    querySelector(selector) {
      if (selector === ".elo-message-bubble") return findByClass(this, "elo-message-bubble");
      return null;
    },
    querySelectorAll() { return []; },
    focus() {},
    value: "",
    options: [],
    selectedIndex: -1,
    scrollTop: 0,
    scrollHeight: 0,
    clientHeight: 400
  };
  Object.defineProperty(element, "textContent", {
    get() { return this._textContent || ""; },
    set(value) { this._textContent = String(value || ""); if (!this._textContent) { this.children = []; this.firstChild = null; } }
  });
  return element;
}

function findByClass(element, className) {
  if (!element) return null;
  if (String(element.className || "").split(/\s+/).includes(className)) return element;
  for (const child of element.children || []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function collectText(element) {
  if (!element) return "";
  return [element.textContent || ""].concat((element.children || []).map(collectText)).filter(Boolean).join("\n");
}

function findButton(element, label) {
  if (!element) return null;
  if (element.tagName === "BUTTON" && element.textContent === label) return element;
  for (const child of element.children || []) {
    const found = findButton(child, label);
    if (found) return found;
  }
  return null;
}

function loadEloContext(options = {}) {
  const localStorage = createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const body = createElement("body");
  body.classList = createClassList(["elo-empty-state"]);
  const documentElement = createElement("html");
  const context = {
    console,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Date,
    Math,
    fetch: options.fetch,
    URLSearchParams,
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      location: { hostname: "localhost", protocol: "http:", pathname: "/elo.html", hash: "", search: "" },
      localStorage,
      sessionStorage,
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => "test-id" },
      requestAnimationFrame(fn) { if (typeof fn === "function") fn(); return 1; },
      open: () => null,
      fetch: options.fetch,
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {},
      atob(value) { return Buffer.from(String(value), "base64").toString("binary"); },
      btoa(value) { return Buffer.from(String(value), "binary").toString("base64"); }
    },
    document: {
      readyState: "complete",
      body,
      documentElement,
      createElement,
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    navigator: { userAgent: "node-test" }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.navigator = context.navigator;
  Object.assign(context.window, options.window || {});
  context.globalThis = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, "elo-assistente.js"), "utf8");
  vm.runInContext(source, context, { filename: "elo-assistente.js" });
  return { elo: context.window.EloAssistente, localStorage, sessionStorage, context };
}

function criticalPayload(extra = {}) {
  return Object.assign({
    ok: true,
    dailySummary: {
      scope: { projectId: "proj-a", workId: "obra-a-work" },
      faltas: [{ material: "Cimento", gap: 7, unit: "sc", severity: "critical" }],
      desviosCriticos: [],
      prioridades: []
    },
    executionStockCross: { materials: [], alerts: [] },
    auditMemory: { ok: true }
  }, extra);
}

async function setupWithPayload(payload) {
  const calls = [];
  const messages = createElement("div");
  const validToken = createJwt({ sub: "user-a" });
  const loaded = loadEloContext({
    window: { ELO_AUTH_TOKEN: validToken, ELO_PROJECT_ID: "proj-a", ELO_WORK_ID: "obra-a-work" },
    fetch(url, options = {}) {
      calls.push({ url: String(url), options });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
    }
  });
  loaded.elo.setCoreMessagesElementForTest(messages);
  loaded.elo.setCorePanelElementForTest(createElement("section"));
  return Object.assign(loaded, { calls, messages, validToken });
}

test("alerta proativo mostra falta e preserva projectId/workId", async () => {
  const { elo, calls, messages, validToken } = await setupWithPayload(criticalPayload());

  assert.equal(await elo.maybeShowProactiveAttentionForTest(), true);

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/elo\/obra\/attention\?projectId=proj-a&workId=obra-a-work/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer " + validToken);
  assert.match(collectText(messages), /Atenção na obra/);
  assert.match(collectText(messages), /Falta: Cimento/);
});

test("alerta proativo mostra desvio critico", async () => {
  const payload = criticalPayload({
    dailySummary: { scope: { projectId: "proj-a", workId: "obra-a-work" }, faltas: [], desviosCriticos: [{ material: "Tinta", differencePercent: 30 }], prioridades: [] }
  });
  const { elo, messages } = await setupWithPayload(payload);

  assert.equal(await elo.maybeShowProactiveAttentionForTest(), true);

  assert.match(collectText(messages), /Desvio crítico: Tinta/);
});

test("alerta proativo nao aparece quando normal ou vazio", async () => {
  const { elo, messages } = await setupWithPayload({ ok: true, dailySummary: { scope: { projectId: "proj-a", workId: "obra-a-work" }, faltas: [], desviosCriticos: [], prioridades: [] }, executionStockCross: { materials: [], alerts: [] }, auditMemory: { ok: true } });

  assert.equal(await elo.maybeShowProactiveAttentionForTest(), false);
  assert.equal(messages.children.length, 0);
});

test("alerta proativo nao repete na mesma sessao", async () => {
  const { elo, messages, sessionStorage } = await setupWithPayload(criticalPayload());

  assert.equal(await elo.maybeShowProactiveAttentionForTest(), true);
  assert.equal(await elo.maybeShowProactiveAttentionForTest(), false);

  assert.equal(messages.children.length, 1);
  assert.equal(Object.keys(sessionStorage.dump()).length, 1);
});

test("alerta proativo permite fechar", async () => {
  const { elo, messages } = await setupWithPayload(criticalPayload());

  assert.equal(await elo.maybeShowProactiveAttentionForTest(), true);
  const button = findButton(messages, "Fechar");
  assert.ok(button);
  button.click();

  assert.equal(messages.children.length, 0);
});