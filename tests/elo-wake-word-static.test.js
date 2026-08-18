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
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      latestRecognition = this;
    }
    start() { calls.starts += 1; }
    stop() { calls.stops += 1; }
  }

  class SpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
      this.onend = null;
      this.onerror = null;
    }
  }

  const statusEl = { textContent: "" };
  const button = {
    dataset: {},
    textContent: "",
    title: "",
    attrs: {},
    addEventListener(event, callback) { this.listener = callback; },
    setAttribute(name, value) { this.attrs[name] = value; }
  };

  const timers = [];
  const context = {
    console,
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
      SpeechRecognition,
      SpeechSynthesisUtterance,
      speechSynthesis: {
        cancel() { calls.synthCancel += 1; },
        speak(utterance) {
          calls.synthSpeak += 1;
          this.lastUtterance = utterance;
        }
      },
      EloAssistente: { ask(command) { calls.ask.push(command); } },
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

  function emit(transcript, isFinal = true) {
    latestRecognition.onresult({ resultIndex: 0, results: [{ 0: { transcript }, isFinal }] });
  }

  function endRecognition() {
    latestRecognition.onend();
  }

  function endSpeech() {
    context.window.speechSynthesis.lastUtterance.onend();
  }

  function errorSpeech() {
    context.window.speechSynthesis.lastUtterance.onerror();
  }

  function runTimer(delay) {
    const timer = timers.find((item) => item.delay === delay && !item.cleared);
    assert.ok(timer, "timer " + delay + "ms deveria existir");
    timer.cleared = true;
    timer.callback();
  }

  return { button, calls, context, emit, endRecognition, endSpeech, errorSpeech, getRecognition: () => latestRecognition, runTimer, statusEl, timers };
}

test("EloWakeWord expoe API publica e configura SpeechRecognition do navegador", () => {
  const { context, getRecognition } = createHarness();
  assert.equal(typeof context.window.EloWakeWord.start, "function");
  assert.equal(typeof context.window.EloWakeWord.stop, "function");
  assert.equal(typeof context.window.EloWakeWord.isActive, "function");
  assert.equal(typeof context.window.EloWakeWord.isListeningForCommand, "function");
  assert.equal(context.window.EloWakeWord.start(), true);
  assert.equal(getRecognition().lang, "pt-BR");
  assert.equal(getRecognition().continuous, true);
  assert.equal(getRecognition().interimResults, true);
});

test("wake detectado para reconhecimento durante ACK e nao envia ELO ao chat", () => {
  const { calls, context, emit } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "ACKNOWLEDGING");
  assert.equal(context.window.EloWakeWord.isListeningForCommand(), false);
  assert.deepEqual(calls.ask, []);
  assert.equal(calls.stops, 1);
  assert.equal(calls.synthSpeak, 1);
  assert.equal(context.window.speechSynthesis.lastUtterance.text, "Oi! Pode falar.");
});

test("onend da fala inicia command listening e so entao abre timeout", () => {
  const { context, emit, endSpeech, endRecognition, runTimer, timers, statusEl, button } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  endSpeech();
  assert.equal(context.window.EloWakeWord.getStateForTest(), "COMMAND_LISTENING");
  assert.equal(timers.some((timer) => timer.delay === 8000 && !timer.cleared), false);
  endRecognition();
  runTimer(120);
  assert.equal(context.window.EloWakeWord.getRecognitionModeForTest(), "command");
  assert.equal(timers.some((timer) => timer.delay === 8000 && !timer.cleared), true);
  assert.equal(statusEl.textContent, "Pode falar.");
  assert.equal(button.textContent, "● ELO ouvindo...");
});

test("normaliza acentos e aceita apenas variantes seguras", () => {
  const { context } = createHarness();
  const api = context.window.EloWakeWord;
  assert.equal(api.normalizeTranscriptForTest("  ÉLO!!! "), "elo");
  assert.equal(api.isWakeWordForTest("élo"), true);
  assert.equal(api.isWakeWordForTest("hello"), true);
  assert.equal(api.isWakeWordForTest("elogiou"), false);
});

test("comando final chama askElo uma vez e retorna para wake listening", () => {
  const { calls, context, emit, endSpeech, endRecognition, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  endSpeech();
  endRecognition();
  runTimer(120);
  emit("Toque Sultans of Swing", true);
  assert.deepEqual(calls.ask, ["Toque Sultans of Swing"]);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
  assert.equal(context.window.EloWakeWord.getRecognitionModeForTest(), "command");
  endRecognition();
  runTimer(120);
  assert.equal(context.window.EloWakeWord.getRecognitionModeForTest(), "wake");
});

test("segundo ciclo funciona depois de executar um comando", () => {
  const { calls, context, emit, endSpeech, endRecognition, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  endSpeech();
  endRecognition();
  runTimer(120);
  emit("pause a musica", true);
  endRecognition();
  runTimer(120);
  emit("ELO", false);
  endSpeech();
  endRecognition();
  runTimer(120);
  emit("continue a musica", true);
  assert.deepEqual(calls.ask, ["pause a musica", "continue a musica"]);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("timeout volta para wake listening sem enviar mensagem vazia", () => {
  const { calls, context, emit, endSpeech, endRecognition, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  endSpeech();
  endRecognition();
  runTimer(120);
  runTimer(8000);
  assert.deepEqual(calls.ask, []);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("cancelar em command mode nao envia comando ao ELO", () => {
  const { calls, context, emit, endSpeech, endRecognition, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  endSpeech();
  endRecognition();
  runTimer(120);
  emit("cancelar", true);
  assert.deepEqual(calls.ask, []);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "WAKE_LISTENING");
});

test("erro na fala tambem abre command listening", () => {
  const { context, emit, errorSpeech, endRecognition, runTimer } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  errorSpeech();
  assert.equal(context.window.EloWakeWord.getStateForTest(), "COMMAND_LISTENING");
  endRecognition();
  runTimer(120);
  assert.equal(context.window.EloWakeWord.getRecognitionModeForTest(), "command");
});

test("stop desliga reconhecimento e atualiza estado visual", () => {
  const { button, calls, context } = createHarness();
  context.window.EloWakeWord.start();
  context.window.EloWakeWord.stop();
  assert.equal(context.window.EloWakeWord.isActive(), false);
  assert.ok(calls.stops >= 1);
  assert.equal(button.textContent, "○ ELO inativo");
  assert.equal(button.attrs["aria-pressed"], "false");
});

test("protege contra loop da propria voz do ELO", () => {
  const { calls, context, emit } = createHarness();
  context.window.EloWakeWord.start();
  emit("ELO", false);
  emit("Oi! Pode falar.", true);
  assert.deepEqual(calls.ask, []);
  assert.equal(context.window.EloWakeWord.getStateForTest(), "ACKNOWLEDGING");
});

test("pagina real carrega wake word depois do assistente e mostra microfone ativo", () => {
  const assistantIndex = eloPage.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  const wakeIndex = eloPage.indexOf("elo-wake-word.js");
  assert.ok(assistantIndex > 0);
  assert.ok(wakeIndex > assistantIndex);
  assert.match(eloPage, /data-elo-wake-toggle/);
  assert.match(eloPage, /○ ELO inativo/);
});
