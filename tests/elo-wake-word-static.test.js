import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const wakeSource = readFileSync(new URL("../elo-wake-word.js", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");

function createHarness() {
  const calls = { starts: 0, stops: 0, synthCancel: 0, synthSpeak: 0, ask: [] };
  let latestRecognition = null;

  class SpeechRecognition {
    constructor() {
      this.lang = "";
      this.continuous = false;
      this.interimResults = false;
      this.onstart = null;
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
    }
    start() { calls.starts += 1; }
    stop() { calls.stops += 1; }
  }

  function SpeechSynthesisUtterance(text) {
    this.text = text;
    this.lang = "";
    this.rate = 1;
    this.onend = null;
    this.onerror = null;
  }

  const button = {
    attrs: {},
    dataset: {},
    textContent: "",
    title: "",
    setAttribute(name, value) { this.attrs[name] = value; },
    addEventListener(_type, handler) { this.click = handler; }
  };
  const statusEl = { textContent: "" };
  const timers = [];

  const context = {
    console,
    Date,
    document: {
      readyState: "complete",
      querySelector(selector) {
        if (selector === "[data-elo-wake-toggle]") return button;
        if (selector === "[data-elo-wake-status]") return statusEl;
        return null;
      },
      addEventListener() {}
    },
    window: {
      SpeechRecognition: class extends SpeechRecognition { constructor() { super(); latestRecognition = this; } },
      SpeechSynthesisUtterance,
      location: { hostname: "127.0.0.1", protocol: "http:" },
      localStorage: { getItem() { return null; }, setItem() {} },
      speechSynthesis: {
        lastUtterance: null,
        cancel() { calls.synthCancel += 1; },
        speak(utterance) { calls.synthSpeak += 1; this.lastUtterance = utterance; }
      },
      EloAssistente: { ask(message) { calls.ask.push(message); } },
      setTimeout(callback, delay) {
        timers.push({ callback, delay, cleared: false });
        return timers.length - 1;
      },
      clearTimeout(id) { if (timers[id]) timers[id].cleared = true; }
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  vm.createContext(context);
  vm.runInContext(wakeSource, context);

  function startAndOnstart() {
    assert.equal(context.window.EloWakeWord.start(), true);
    latestRecognition.onstart();
  }

  function emit(transcript, isFinal = true) {
    latestRecognition.onresult({ resultIndex: 0, results: [{ 0: { transcript }, isFinal }] });
  }

  function endRecognition() { latestRecognition.onend(); }
  function runTimer(delay) {
    const timer = timers.find((item) => item.delay === delay && !item.cleared);
    assert.ok(timer, "timer " + delay + "ms deveria existir");
    timer.cleared = true;
    timer.callback();
  }
  function hasPendingTimer(delay) { return timers.some((item) => item.delay === delay && !item.cleared); }

  return { button, calls, context, emit, endRecognition, getRecognition: () => latestRecognition, hasPendingTimer, runTimer, startAndOnstart, statusEl, timers };
}

function enterCommandModeAfterWakeSilence(harness) {
  harness.emit("ELO", true);
  harness.runTimer(1500);
  assert.equal(harness.calls.synthSpeak, 0);
  assert.equal(harness.context.window.speechSynthesis.lastUtterance, null);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "COMMAND_LISTENING");
  assert.equal(harness.statusEl.textContent, "Pode falar.");
  assert.equal(harness.button.textContent, "● ELO ouvindo...");
}

test("EloWakeWord expoe API publica e configura SpeechRecognition do navegador", () => {
  const { context, getRecognition } = createHarness();
  assert.equal(typeof context.window.EloWakeWord.start, "function");
  assert.equal(typeof context.window.EloWakeWord.stop, "function");
  assert.equal(typeof context.window.EloWakeWord.isActive, "function");
  assert.equal(typeof context.window.EloWakeWord.isListeningForCommand, "function");
  assert.equal(typeof context.window.EloWakeWord.getRuntimeForTest, "function");
  assert.equal(typeof context.window.EloWakeWord.extractCommandAfterWakeForTest, "function");
  assert.equal(context.window.EloWakeWord.start(), true);
  assert.equal(getRecognition().lang, "pt-BR");
  assert.equal(getRecognition().continuous, true);
  assert.equal(getRecognition().interimResults, true);
});

test("extrai comando depois do wake word sem fuzzy amplo", () => {
  const { context } = createHarness();
  const api = context.window.EloWakeWord;
  assert.equal(api.extractCommandAfterWakeForTest("ELO toque Sultans of Swing"), "toque Sultans of Swing");
  assert.equal(api.extractCommandAfterWakeForTest("elo, pause a música"), "pause a música");
  assert.equal(api.extractCommandAfterWakeForTest("hello continue a música"), "continue a música");
  assert.equal(api.extractCommandAfterWakeForTest("ELO"), "");
  assert.equal(api.isWakeWordForTest("élo"), true);
  assert.equal(api.isWakeWordForTest("hello"), true);
  assert.equal(api.isWakeWordForTest("elogiou"), false);
});

test("wake word registra start/onstart/onresult para diagnostico tecnico", () => {
  const { context, emit, startAndOnstart } = createHarness();
  startAndOnstart();
  assert.equal(context.window.EloWakeWord.getRuntimeForTest().recognitionStarted, true);
  emit("ELO", false);
  const events = context.window.EloWakeWord.getDebugForTest();
  assert.ok(events.some((entry) => entry.event === "start_called" && entry.details.mode === "wake"));
  assert.ok(events.some((entry) => entry.event === "onstart"));
  assert.ok(events.some((entry) => entry.event === "onresult" && entry.details.rawTranscript === "ELO" && entry.details.normalized === "elo" && entry.details.wakeMatch === true));
});

test("start sem onstart confirmado aciona watchdog e volta a ouvir wake", () => {
  const { calls, context, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  assert.equal(context.window.EloWakeWord.getRuntimeForTest().recognitionStarted, false);
  runTimer(1500);
  assert.ok(context.window.EloWakeWord.getDebugForTest().some((entry) => entry.event === "start_watchdog_restart"));
  runTimer(120);
  assert.equal(calls.starts, 2);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("onend inesperado em WAKE_LISTENING agenda restart seguro", () => {
  const { calls, context, endRecognition, runTimer, startAndOnstart } = createHarness();
  startAndOnstart();
  assert.equal(calls.starts, 1);
  endRecognition();
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
  assert.ok(context.window.EloWakeWord.getDebugForTest().some((entry) => entry.event === "restart_scheduled" && entry.details.reason === "onend"));
  runTimer(120);
  assert.equal(calls.starts, 2);
});

test("ELO virgula comando executa direto sem falar Diga", () => {
  const { calls, context, emit, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO, toque Sultans of Swing", true);
  assert.deepEqual(calls.ask, ["toque Sultans of Swing"]);
  assert.equal(calls.synthSpeak, 0);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("ELO toque sul of swing preserva comando imperfeito para resolver musical", () => {
  const { calls, emit, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO, toque sul of swing", true);
  assert.deepEqual(calls.ask, ["toque sul of swing"]);
  assert.equal(calls.synthSpeak, 0);
});

test("ELO sozinho apos 1,5s de silencio entra em command listening sem fala", () => {
  const harness = createHarness();
  harness.startAndOnstart();
  harness.emit("ELO", true);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "WAKE_GRACE_PERIOD");
  assert.equal(harness.calls.synthSpeak, 0);
  harness.runTimer(1500);
  assert.equal(harness.calls.synthSpeak, 0);
  assert.equal(harness.context.window.speechSynthesis.lastUtterance, null);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "COMMAND_LISTENING");
  assert.equal(harness.statusEl.textContent, "Pode falar.");
  assert.equal(harness.button.textContent, "● ELO ouvindo...");
});

test("ELO e continuacao antes de 1,5s cancela Diga e executa comando", () => {
  const { calls, context, emit, hasPendingTimer, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO", false);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_GRACE_PERIOD");
  assert.equal(hasPendingTimer(1500), true);
  emit("toque Sultans of Swing", true);
  assert.deepEqual(calls.ask, ["toque Sultans of Swing"]);
  assert.equal(calls.synthSpeak, 0);
  assert.equal(hasPendingTimer(1500), false);
});

test("transcript incremental ELO depois comando final nao fala Diga", () => {
  const { calls, context, emit, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO", false);
  emit("ELO toque", false);
  assert.equal(context.window.EloWakeWord.getRuntimeForTest().pendingWakeCommand, "toque");
  emit("ELO toque Sultans of Swing", true);
  assert.deepEqual(calls.ask, ["toque Sultans of Swing"]);
  assert.equal(calls.synthSpeak, 0);
});

test("ELO pause a musica despacha pausa sem ACK", () => {
  const { calls, emit, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO, pause a música", true);
  assert.deepEqual(calls.ask, ["pause a música"]);
  assert.equal(calls.synthSpeak, 0);
});

test("depois do silencio comando seguinte chega ao ELO", () => {
  const harness = createHarness();
  harness.startAndOnstart();
  enterCommandModeAfterWakeSilence(harness);
  harness.emit("continue a música", true);
  assert.deepEqual(harness.calls.ask, ["continue a música"]);
});

test("transcricao Diga acidental nao e capturada como comando", () => {
  const harness = createHarness();
  harness.startAndOnstart();
  enterCommandModeAfterWakeSilence(harness);
  harness.emit("Diga.", true);
  assert.deepEqual(harness.calls.ask, []);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "COMMAND_LISTENING");
});

test("timeout em command mode volta para wake listening sem enviar vazio", () => {
  const harness = createHarness();
  harness.startAndOnstart();
  enterCommandModeAfterWakeSilence(harness);
  harness.runTimer(8000);
  assert.deepEqual(harness.calls.ask, []);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("cancelar em command mode nao envia comando ao ELO", () => {
  const harness = createHarness();
  harness.startAndOnstart();
  enterCommandModeAfterWakeSilence(harness);
  harness.emit("cancelar", true);
  assert.deepEqual(harness.calls.ask, []);
  assert.equal(harness.context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("segundo ciclo funciona depois de executar comando continuo", () => {
  const { calls, emit, endRecognition, runTimer, startAndOnstart } = createHarness();
  startAndOnstart();
  emit("ELO, pause a música", true);
  endRecognition();
  runTimer(120);
  emit("ELO, continue a música", true);
  assert.deepEqual(calls.ask, ["pause a música", "continue a música"]);
});

test("stop desliga reconhecimento e atualiza estado visual", () => {
  const { button, calls, context, startAndOnstart } = createHarness();
  startAndOnstart();
  context.window.EloWakeWord.stop();
  assert.equal(context.window.EloWakeWord.isActive(), false);
  assert.ok(calls.stops >= 1);
  assert.equal(button.textContent, "○ ELO inativo");
  assert.equal(button.attrs["aria-pressed"], "false");
});

test("pagina real carrega wake word depois do assistente e mostra microfone ativo", () => {
  const assistantIndex = eloPage.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  const wakeIndex = eloPage.indexOf("elo-wake-word.js");
  assert.ok(assistantIndex > 0);
  assert.ok(wakeIndex > assistantIndex);
  assert.match(eloPage, /data-elo-wake-toggle/);
  assert.match(eloPage, /○ ELO inativo/);
});
