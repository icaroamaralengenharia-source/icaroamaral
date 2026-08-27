import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, String(value)); },
    removeItem(key) { store.delete(key); }
  };
}

function createClassList(element) {
  const values = new Set();
  return {
    add(name) { values.add(name); element.className = Array.from(values).join(" "); },
    remove(name) { values.delete(name); element.className = Array.from(values).join(" "); },
    toggle(name, enabled) { if (enabled) this.add(name); else this.remove(name); },
    contains(name) { return values.has(name); }
  };
}

function createElement(tagName = "div", className = "") {
  const listeners = {};
  const element = {
    tagName: tagName.toUpperCase(),
    className,
    children: [],
    dataset: {},
    style: {},
    attributes: {},
    parentNode: null,
    textContent: "",
    value: "",
    hidden: false,
    disabled: false,
    classList: null,
    addEventListener(type, handler) { listeners[type] = handler; },
    dispatchEvent(event) { if (listeners[event.type]) listeners[event.type](event); return true; },
    setAttribute(name, value) { this.attributes[name] = String(value); },
    getAttribute(name) { return this.attributes[name] || null; },
    appendChild(child) { this.children.push(child); child.parentNode = this; return child; },
    insertBefore(child, reference) {
      const index = reference ? this.children.indexOf(reference) : -1;
      if (index >= 0) this.children.splice(index, 0, child);
      else this.children.push(child);
      child.parentNode = this;
      return child;
    },
    remove() {
      if (!this.parentNode) return;
      this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
      this.parentNode = null;
    },
    querySelector(selector) {
      const classNameSelector = selector.startsWith(".") ? selector.slice(1) : "";
      const walk = (node) => {
        if (classNameSelector && String(node.className || "").split(/\s+/).includes(classNameSelector)) return node;
        for (const child of node.children || []) {
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(this);
    },
    querySelectorAll() { return []; }
  };
  element.classList = createClassList(element);
  className.split(/\s+/).filter(Boolean).forEach((name) => element.classList.add(name));
  return element;
}

function createSpeechRecognitionHarness({ autoStart = true } = {}) {
  const instances = [];
  class FakeSpeechRecognition {
    constructor() {
      this.lang = "";
      this.interimResults = false;
      this.continuous = false;
      this.maxAlternatives = 1;
      this.started = false;
      this.stopped = false;
      instances.push(this);
    }
    start() {
      this.started = true;
      if (autoStart && this.onstart) this.onstart();
    }
    stop() {
      this.stopped = true;
    }
    emit(transcript, isFinal = true) {
      if (!this.onresult) return;
      this.onresult({
        resultIndex: 0,
        results: [{ 0: { transcript }, isFinal }]
      });
    }
    end() {
      if (this.onend) this.onend();
    }
    error(error) {
      if (this.onerror) this.onerror({ error });
    }
  }
  return { Recognition: FakeSpeechRecognition, instances };
}

function loadAssistant(options = {}) {
  const events = [];
  const timers = [];
  const speech = createSpeechRecognitionHarness(options.speech || {});
  const documentNodes = new Map();
  const document = {
    readyState: "complete",
    body: createElement("body"),
    createElement,
    addEventListener() {},
    querySelector(selector) { return documentNodes.get(selector) || null; },
    querySelectorAll() { return []; }
  };
  const sandbox = {
    console: Object.assign({}, console, {
      info(name, payload) { events.push({ name, payload: payload || {} }); }
    }),
    document,
    Event: function Event(type, init = {}) { this.type = type; Object.assign(this, init); },
    SubmitEvent: function SubmitEvent(type, init = {}) { this.type = type; Object.assign(this, init); this.preventDefault = function () { this.defaultPrevented = true; }; },
    setTimeout(fn, ms) {
      if (options.controlTimers) {
        const timer = { fn, ms, canceled: false };
        timers.push(timer);
        return timer;
      }
      return setTimeout(fn, ms);
    },
    clearTimeout(timer) {
      if (options.controlTimers) {
        if (timer) timer.canceled = true;
        return;
      }
      clearTimeout(timer);
    }
  };
  sandbox.window = Object.assign({
    ELO_SKIP_AUTO_WIDGET: true,
    location: { hostname: "localhost", protocol: "http:", origin: "http://localhost" },
    navigator: { onLine: false },
    localStorage: createStorage({ obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" }) }),
    performance: { mark() {}, now() { return 0; } },
    console: sandbox.console,
    setTimeout: sandbox.setTimeout,
    clearTimeout: sandbox.clearTimeout,
    SpeechRecognition: speech.Recognition,
    webkitSpeechRecognition: speech.Recognition,
    addEventListener() {},
    fetch: options.fetch || function () { throw new Error("backend nao deve ser chamado no teste wake"); }
  }, options.window || {});
  sandbox.globalThis = sandbox.window;
  sandbox.window.window = sandbox.window;
  sandbox.window.document = document;
  sandbox.window.Event = sandbox.Event;
  sandbox.window.SubmitEvent = sandbox.SubmitEvent;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { elo: sandbox.window.EloAssistente, events, timers, speech, document, documentNodes };
}

function eventPayloads(events, name) {
  return events.filter((event) => event.name === name).map((event) => event.payload);
}

test("wake continuo reconhece somente aliases permitidos e extrai comando", () => {
  const { elo } = loadAssistant();

  const chopin = elo.detectWakeContinuousForTest("ELO, toque Chopin");
  assert.equal(chopin.matched, true);
  assert.equal(chopin.alias, "elo");
  assert.equal(chopin.command, "toque Chopin");
  const hello = elo.detectWakeContinuousForTest("hello abrir relatório");
  assert.equal(hello.matched, true);
  assert.equal(hello.alias, "hello");
  assert.equal(hello.command, "abrir relatório");
  const spaced = elo.detectWakeContinuousForTest("e lo, renderize aqui");
  assert.equal(spaced.matched, true);
  assert.equal(spaced.alias, "e lo");
  assert.equal(spaced.command, "renderize aqui");
  assert.equal(elo.detectWakeContinuousForTest("elô toque música").matched, false);
});

test("wake-only entra em COMMAND_LISTENING e reaproveita um unico voiceRecognition", () => {
  const { elo, speech } = loadAssistant();

  assert.equal(elo.startWakeContinuousForTest(), true);
  assert.equal(speech.instances.length, 1);
  assert.equal(speech.instances[0].continuous, true);
  assert.equal(elo.getWakeContinuousStateForTest().state, "WAKE_LISTENING");

  assert.equal(elo.handleWakeTranscriptForTest("ELO", true), true);
  const state = elo.getWakeContinuousStateForTest();
  assert.equal(state.state, "COMMAND_LISTENING");
  assert.equal(state.enabled, true);
  assert.equal(speech.instances[0].stopped, true);
});

test("wake com comando despacha uma vez com source wake_continuous", async () => {
  const { elo, events } = loadAssistant();
  elo.setConnectivityForTest(false, "test");
  elo.setCoreMessagesElementForTest(createElement("div", "elo-messages"));

  assert.equal(elo.startWakeContinuousForTest(), true);
  assert.equal(elo.handleWakeTranscriptForTest("ELO, tudo e vc?", true), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(elo.handleWakeTranscriptForTest("tudo e vc?", true), false);

  assert.equal(elo.getWakeContinuousStateForTest().lastCommand, "tudo e vc");
  assert.equal(eventPayloads(events, "WAKE_COMMAND_DISPATCH").at(-1).command, "tudo e vc");
  assert.equal(eventPayloads(events, "SUBMIT_SOURCE").at(-1).source, "wake_continuous");
});

test("timeout de comando volta para WAKE_LISTENING sem dispatch", () => {
  const { elo, timers, events } = loadAssistant({ controlTimers: true });

  assert.equal(elo.startWakeContinuousForTest(), true);
  assert.equal(elo.handleWakeTranscriptForTest("ELO", true), true);
  const commandTimer = timers.find((timer) => timer.ms === 8000 && !timer.canceled);
  assert.ok(commandTimer);
  commandTimer.fn();

  assert.equal(elo.getWakeContinuousStateForTest().state, "WAKE_LISTENING");
  assert.equal(eventPayloads(events, "WAKE_COMMAND_TIMEOUT").length, 1);
  assert.equal(eventPayloads(events, "WAKE_COMMAND_DISPATCH").length, 0);
});

test("watchdog reinicia wake quando recognition.start nao confirma onstart", () => {
  const { elo, timers, events, speech } = loadAssistant({ controlTimers: true, speech: { autoStart: false } });

  assert.equal(elo.startWakeContinuousForTest(), true);
  assert.equal(elo.getWakeContinuousStateForTest().starting, true);
  const watchdog = timers.find((timer) => timer.ms === 1500 && !timer.canceled);
  assert.ok(watchdog);
  watchdog.fn();
  const restart = timers.find((timer) => timer.ms === 120 && !timer.canceled);
  assert.ok(restart);
  restart.fn();

  assert.equal(speech.instances.length, 2);
  assert.equal(eventPayloads(events, "WAKE_START_WATCHDOG").length, 1);
  assert.equal(eventPayloads(events, "WAKE_RESTART").at(-1).reason, "start_watchdog");
});

test("TTS e mic manual suspendem wake e retornam para escuta", async () => {
  let utterance = null;
  const { elo } = loadAssistant({
    window: {
      speechSynthesis: { cancel() {}, getVoices() { return [{ name: "Microsoft Maria", lang: "pt-BR" }]; }, speak(value) { utterance = value; } },
      SpeechSynthesisUtterance: function Utterance(text) { this.text = text; }
    },
    fetch() { return Promise.reject(new Error("tts offline")); }
  });

  assert.equal(elo.startWakeContinuousForTest(), true);
  elo.setConnectivityForTest(false, "test");
  assert.equal(elo.speakTextForTest("Resposta falada"), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(elo.getWakeContinuousStateForTest().state, "SPEAKING");
  utterance.onend();
  assert.equal(elo.getWakeContinuousStateForTest().state, "WAKE_LISTENING");

  const form = createElement("form");
  const input = createElement("textarea");
  input.value = "";
  elo.setVoiceComposerForTest(form, input);
  assert.equal(elo.startVoiceInputForTest(), true);
  assert.equal(elo.getWakeContinuousStateForTest().state, "COMMAND_LISTENING");
});
