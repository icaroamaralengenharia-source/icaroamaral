import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

function extractFunction(source, name) {
  const start = source.indexOf("function " + name + "(");
  assert.notEqual(start, -1, "missing function " + name);
  const open = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (character === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (character === "*" && next === "/") { blockComment = false; index += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "/" && next === "/") { lineComment = true; index += 1; continue; }
    if (character === "/" && next === "*") { blockComment = true; index += 1; continue; }
    if (character === "'" || character === '"' || character === "`") { quote = character; continue; }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error("unterminated function " + name);
}

const functionNames = [
  "chooseEloPortugueseVoice_",
  "getEloTtsEndpoint_",
  "getEloAudioConstructor_",
  "revokeEloNeuralSpeechObjectUrl_",
  "cleanupEloNeuralSpeechAudio_",
  "setEloTtsAudit_",
  "logEloTtsLifecycle_",
  "isEloCurrentSpeechGeneration_",
  "normalizeEloTtsPayload_",
  "playEloNeuralSpeechAudio_",
  "requestEloNeuralSpeech_",
  "stopAllEloSpeech_",
  "stopEloSpeechOutput_",
  "speakEloTextFallback_",
  "speakEloText_"
];
const ttsFunctions = functionNames.map((name) => extractFunction(assistant, name)).join("\n");

function response({ ok = true, status = 200, contentType, jsonData, audioSize = 4, onJson, onBlob } = {}) {
  const calls = { json: 0, blob: 0 };
  return {
    calls,
    value: {
      ok,
      status,
      headers: { get(name) { return name.toLowerCase() === "content-type" ? contentType || "" : null; } },
      async json() { calls.json += 1; if (onJson) onJson(); return jsonData; },
      async blob() { calls.blob += 1; if (onBlob) onBlob(); return { size: audioSize, type: contentType || "" }; }
    }
  };
}

function createHarness(responses, options = {}) {
  const calls = { fetch: 0, audioPlay: 0, audioPause: 0, cancel: 0, speak: 0, createUrl: 0, revoke: [], urls: [], buttonStates: [] };
  const audioInstances = [];
  const responseQueue = Array.isArray(responses) ? responses.slice() : [responses];
  class FakeAudio {
    constructor(source) {
      this.src = source;
      this.paused = true;
      this.currentTime = 0;
      this.duration = 1;
      this.playbackRate = 1;
      this.preservesPitch = true;
      this.onended = null;
      this.onerror = null;
      audioInstances.push(this);
    }
    play() {
      calls.audioPlay += 1;
      this.paused = false;
      if (options.playRejects) {
        if (options.emitErrorOnReject && this.onerror) this.onerror();
        return Promise.reject(new Error("play_failed"));
      }
      return Promise.resolve();
    }
    pause() { calls.audioPause += 1; this.paused = true; }
  }
  class FakeUtterance {
    constructor(text) { this.text = text; this.lang = ""; this.rate = 1; this.pitch = 1; }
  }
  const synthesis = {
    getVoices() { return [{ lang: "pt-BR", name: "Test PT-BR" }]; },
    cancel() { calls.cancel += 1; },
    speak(utterance) { calls.speak += 1; this.lastUtterance = utterance; }
  };
  const window = {
    fetch: async (...args) => {
      calls.fetch += 1;
      calls.lastFetch = args;
      const next = responseQueue.shift();
      if (next instanceof Error) throw next;
      return next && next.value || next;
    },
    Audio: FakeAudio,
    URL: {
      createObjectURL(blob) { calls.createUrl += 1; const url = "blob:elo-tts-" + calls.createUrl; calls.urls.push({ url, size: blob.size }); return url; },
      revokeObjectURL(url) { calls.revoke.push(url); }
    },
    speechSynthesis: synthesis,
    ELO_TTS_VOICE: ""
  };
  const context = {
    window,
    URL: window.URL,
    ELO_UI: {
      neuralSpeechAudio: null, neuralSpeechObjectUrl: "", speechShutdownRequested: false,
      speechSynthesisUtterance: null, speechSynthesisButton: null, speechSynthesisState: "idle",
      ttsAudit: null, voiceModeEnabled: false, voiceModeStatus: "idle", wakeContinuousState: "IDLE",
      activeSpeechGenerationId: 0, activeSpeechResponseId: "", assistantResponseSequence: 0
    },
    sanitizeUserText(value) { return value == null ? "" : String(value); },
    getEloBackendEndpoint_(path) { return "https://api.example.test" + path; },
    fetchEloAuthenticated_(url, config) { return window.fetch(url, config); },
    isEloOnline_() { return true; },
    logEloMusicEvent_() {},
    getEloSpeechSynthesis_() { return synthesis; },
    getEloSpeechSynthesisUtteranceConstructor_() { return FakeUtterance; },
    setEloSpeechButtonState_(_button, active) { calls.buttonStates.push(!!active); },
    resetEloSpeechButton_(_button, _metadata) { context.ELO_UI.speechSynthesisButton = null; context.ELO_UI.speechSynthesisState = "idle"; },
    setEloVoiceModeStatus_() {},
    setEloWakeContinuousState_() {},
    clearEloWakeRestartTimer_() {},
    clearEloWakeCommandTimer_() {},
    clearEloVoiceAutoSendTimer_() {},
    stopEloVoiceInput_() {},
    cleanEloTextForSpeech_(value) { return String(value || "").trim(); },
    setTimeout
  };
  vm.createContext(context);
  return { api: vm.runInContext("(function(){" + ttsFunctions + "\nreturn { speak: speakEloText_, stop: stopEloSpeechOutput_, request: requestEloNeuralSpeech_, runtime: function(){return ELO_UI;}, audit: function(){return ELO_UI.ttsAudit;} }; })()", context), calls, audioInstances, synthesis, context };
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function button() { return { disabled: false, textContent: "Ouvir", title: "" }; }

test("audio/mpeg binário toca como neural sem ler JSON", async () => {
  const result = response({ contentType: "audio/mpeg" });
  const h = createHarness(result);
  h.api.speak("Resposta neural", button());
  await settle();
  assert.equal(result.calls.blob, 1);
  assert.equal(result.calls.json, 0);
  assert.equal(h.calls.audioPlay, 1);
  assert.equal(h.calls.speak, 0);
  assert.equal(h.api.audit().mode, "neural");
  assert.equal(h.audioInstances[0].src, h.calls.urls[0].url);
});

test("audio/wav binário toca como neural", async () => {
  const result = response({ contentType: "audio/wav" });
  const h = createHarness(result);
  h.api.speak("Resposta WAV", button());
  await settle();
  assert.equal(result.calls.blob, 1);
  assert.equal(result.calls.json, 0);
  assert.equal(h.calls.audioPlay, 1);
  assert.equal(h.calls.speak, 0);
});

test("JSON audioUrl permanece compatível", async () => {
  const result = response({ contentType: "application/json", jsonData: { audioUrl: "https://cdn.example.test/audio.mp3", provider: "neural" } });
  const h = createHarness(result);
  h.api.speak("Audio URL", button());
  await settle();
  assert.equal(result.calls.json, 1);
  assert.equal(result.calls.blob, 0);
  assert.equal(h.audioInstances[0].src, "https://cdn.example.test/audio.mp3");
  assert.equal(h.calls.speak, 0);
});

test("JSON audioBase64 permanece compatível", async () => {
  const result = response({ contentType: "application/json", jsonData: { audioBase64: "QUJD" } });
  const h = createHarness(result);
  h.api.speak("Audio Base64", button());
  await settle();
  assert.equal(result.calls.json, 1);
  assert.equal(h.audioInstances[0].src, "data:audio/mpeg;base64,QUJD");
  assert.equal(h.calls.speak, 0);
});

test("blob vazio aciona speechSynthesis", async () => {
  const h = createHarness(response({ contentType: "audio/mpeg", audioSize: 0 }));
  h.api.speak("Audio vazio", button());
  await settle();
  assert.equal(h.calls.audioPlay, 0);
  assert.equal(h.calls.speak, 1);
});

test("HTTP error aciona speechSynthesis sem tentar tocar binário", async () => {
  const result = response({ ok: false, status: 503, contentType: "application/json", jsonData: { error: "provider_down" } });
  const h = createHarness(result);
  h.api.speak("Erro HTTP", button());
  await settle();
  assert.equal(result.calls.json, 1);
  assert.equal(result.calls.blob, 0);
  assert.equal(h.calls.audioPlay, 0);
  assert.equal(h.calls.speak, 1);
});

test("HTML e texto não são tratados como áudio e acionam fallback", async (t) => {
  for (const contentType of ["text/html", "text/plain"]) {
    await t.test(contentType, async () => {
      const result = response({ contentType, jsonData: { audioUrl: "must-not-be-used" } });
      const h = createHarness(result);
      h.api.speak("Resposta inválida", button());
      await settle();
      assert.equal(result.calls.json, 0);
      assert.equal(result.calls.blob, 0);
      assert.equal(h.calls.audioPlay, 0);
      assert.equal(h.calls.speak, 1);
    });
  }
});

test("interrupção para áudio neural e revoga object URL", async () => {
  const h = createHarness(response({ contentType: "audio/mpeg" }));
  h.api.speak("Interromper", button());
  await settle();
  const audio = h.audioInstances[0];
  const url = audio.src;
  h.api.stop();
  assert.equal(h.calls.audioPause, 1);
  assert.equal(audio.currentTime, 0);
  assert.equal(audio.src, "");
  assert.deepEqual(h.calls.revoke, [url]);
  assert.equal(h.calls.speak, 0);
});

test("nova fala substitui anterior e libera o object URL anterior", async () => {
  const h = createHarness([response({ contentType: "audio/mpeg" }), response({ contentType: "audio/wav" })]);
  const firstButton = button();
  h.api.speak("Primeira", firstButton);
  await settle();
  const firstAudio = h.audioInstances[0];
  const firstUrl = firstAudio.src;
  h.api.speak("Segunda", button());
  await settle();
  assert.equal(h.audioInstances.length, 2);
  assert.equal(firstAudio.paused, true);
  assert.deepEqual(h.calls.revoke, [firstUrl]);
  assert.equal(h.calls.audioPlay, 2);
  assert.equal(h.calls.speak, 0);
});

test("fim e erro do áudio limpam object URL; erro usa fallback", async () => {
  const h = createHarness([response({ contentType: "audio/mpeg" }), response({ contentType: "audio/mpeg" })]);
  h.api.speak("Terminar", button());
  await settle();
  const endedAudio = h.audioInstances[0];
  const endedUrl = endedAudio.src;
  endedAudio.onended();
  assert.deepEqual(h.calls.revoke, [endedUrl]);

  h.api.speak("Erro de playback", button());
  await settle();
  const failedAudio = h.audioInstances[1];
  const failedUrl = failedAudio.src;
  failedAudio.onerror();
  assert.deepEqual(h.calls.revoke, [endedUrl, failedUrl]);
  assert.equal(h.calls.speak, 1);
});

test("rejeição de play libera object URL e usa fallback sem duplicar fala", async () => {
  const h = createHarness(response({ contentType: "audio/mpeg" }), { playRejects: true, emitErrorOnReject: true });
  h.api.speak("Falha ao iniciar áudio", button());
  await settle();
  assert.equal(h.calls.audioPlay, 1);
  assert.equal(h.calls.revoke.length, 1);
  assert.equal(h.calls.speak, 1);
});

test("fala neural válida não chama speechSynthesis", async () => {
  const h = createHarness(response({ contentType: "audio/mpeg" }));
  h.api.speak("Neural válido", button());
  await settle();
  assert.equal(h.calls.audioPlay, 1);
  assert.equal(h.calls.speak, 0);
});

test("botão Ouvir/Parar mantém alternância de playback sem fallback indevido", async () => {
  const h = createHarness(response({ contentType: "audio/mpeg" }));
  const control = button();
  h.api.speak("Clique para ouvir", control);
  await settle();
  assert.equal(h.api.runtime().speechSynthesisButton, control);
  h.api.speak("Clique para parar", control);
  assert.equal(h.calls.audioPause, 1);
  assert.equal(h.calls.speak, 0);
  assert.equal(h.api.runtime().speechSynthesisState, "idle");
});

test("fetch continua passando pela camada autenticada existente", () => {
  assert.match(assistant, /function fetchEloAuthenticated_\(url, options\)/);
  assert.match(assistant, /return fetchEloAuthenticated_\(endpoint,[\s\S]{0,120}method: "POST"/);
});
