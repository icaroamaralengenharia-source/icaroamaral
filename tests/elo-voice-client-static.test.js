import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const client = readFileSync(new URL("../elo-voice-client.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../elo-voice-test.html", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

function createVoiceHarness(options = {}) {
  const calls = { audioPlay: 0, audioPause: 0, cancel: 0, fetch: 0, objectUrls: 0, revoke: 0, speak: 0 };
  const voices = options.voices || [{ lang: "pt-BR", name: "Teste PT-BR" }];
  class SpeechSynthesisUtterance {
    constructor(text) {
      this.text = text;
      this.lang = "";
      this.rate = 1;
      this.pitch = 1;
      this.onend = null;
      this.onerror = null;
    }
  }
  const speechSynthesis = {
    speaking: false,
    getVoices() { return voices; },
    cancel() { calls.cancel += 1; this.speaking = false; },
    speak(utterance) {
      calls.speak += 1;
      this.lastUtterance = utterance;
      this.speaking = true;
      setTimeout(() => {
        this.speaking = false;
        if (utterance.onend) utterance.onend();
      }, 0);
    }
  };
  class Audio {
    constructor(url) {
      this.url = url;
      this.paused = true;
      this.duration = 1.2;
      this.onplaying = null;
      this.onended = null;
      this.onerror = null;
    }
    play() {
      calls.audioPlay += 1;
      this.paused = false;
      if (options.audioRejects) return Promise.reject(new Error("play_failed"));
      setTimeout(() => {
        if (this.onplaying) this.onplaying();
        setTimeout(() => {
          this.paused = true;
          if (this.onended) this.onended();
        }, 0);
      }, 0);
      return Promise.resolve();
    }
    pause() { calls.audioPause += 1; this.paused = true; }
    removeAttribute() {}
    load() {}
  }
  const fetchImpl = async (...args) => {
    calls.fetch += 1;
    if (options.fetchImpl) return options.fetchImpl(...args);
    return {
      ok: true,
      status: 200,
      headers: new Map([["content-type", "audio/mpeg"], ["x-elo-tts-provider-ms", "123"]]),
      blob: async () => new Blob(["audio"], { type: "audio/mpeg" })
    };
  };
  const context = {
    Audio,
    Blob,
    Error,
    Promise,
    RegExp,
    URL: {
      createObjectURL(blob) { calls.objectUrls += 1; return "blob:test-" + blob.size; },
      revokeObjectURL() { calls.revoke += 1; }
    },
    fetch: fetchImpl,
    performance: { now: () => Date.now() },
    setTimeout,
    SpeechSynthesisUtterance,
    window: {
      location: { hostname: "www.icaroamaral.com.br", protocol: "https:" },
      speechSynthesis,
      SpeechSynthesisUtterance
    }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(client, context);
  return { calls, speechSynthesis, voice: context.window.EloVoice };
}

test("EloVoice expõe contrato isolado de voz", () => {
  assert.match(client, /window\.EloVoice\s*=\s*\{/);
  ["speak", "stop", "pause", "resume", "isSpeaking", "setEnabled"].forEach((name) => {
    assert.match(client, new RegExp(name + ": " + name));
  });
});

test("EloVoice usa backend TTS sem credenciais e com fallback opcional", () => {
  assert.match(client, /\/api\/elo\/tts/);
  assert.match(client, /credentials:\s*"omit"/);
  assert.match(client, /speechSynthesis/);
  assert.match(client, /fallback\s*!==\s*false/);
  assert.match(client, /tts_empty_audio|tts_invalid_audio_type/);
  assert.doesNotMatch(client + page, /OPENAI_API_KEY|Bearer|api[_-]?key|secret|token/i);
});

test("EloVoice impede vozes simultaneas e libera object URLs", () => {
  assert.match(client, /function stop\(\)/);
  assert.match(client, /stop\(\);/);
  assert.match(client, /URL\.revokeObjectURL/);
  assert.match(client, /currentAudio\.pause\(\)/);
});

test("pagina isolada nao depende do chat real", () => {
  assert.match(page, /elo-voice-client\.js/);
  assert.match(page, /Olá\. Eu sou o ELO\. Esta é uma demonstração da nova voz neural\./);
  assert.doesNotMatch(page, /elo-assistente\.js|relatorio-qualidade-obras\.js|stock-full/i);
});

test("ELO real carrega voice client antes do assistente", () => {
  const voiceIndex = eloPage.indexOf("elo-voice-client.js");
  const assistantIndex = eloPage.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  assert.ok(voiceIndex > 0);
  assert.ok(assistantIndex > voiceIndex);
});

test("botao Ouvir usa EloVoice com fallback para speechSynthesis", () => {
  assert.match(assistant, /function getEloVoiceClient_/);
  assert.match(assistant, /voice\.speak\(speechText, \{ voice: "alloy" \}\)/);
  assert.doesNotMatch(assistant, /voice\.speak\(speechText, \{ voice: "alloy", fallback: false \}\)/);
  assert.match(assistant, /speakEloTextWithBrowserFallback_/);
  assert.match(assistant, /synthesis\.speak\(utterance\)/);
  assert.match(assistant, /function stopEloSpeechOutput_/);
  assert.match(assistant, /voice\.stop\(\)/);
});

test("ELO real mantem voz apenas por clique em Ouvir", () => {
  assert.match(assistant, /button\.addEventListener\("click", function \(\) \{ speakEloText_/);
  assert.doesNotMatch(assistant, /appendAssistantMessage[\s\S]{0,400}voice\.speak/);
});

test("TTS neural 200 toca audio neural sem speechSynthesis", async () => {
  const { calls, voice } = createVoiceHarness();
  const result = await voice.speak("Olá do ELO");
  assert.equal(result.mode, "neural");
  assert.equal(calls.audioPlay, 1);
  assert.equal(calls.speak, 0);
});

test("TTS neural 503 aciona speechSynthesis", async () => {
  const { calls, voice, speechSynthesis } = createVoiceHarness({
    fetchImpl: async () => ({ ok: false, status: 503, headers: new Map(), blob: async () => new Blob([]) })
  });
  const result = await voice.speak("Fallback do ELO");
  assert.equal(result.mode, "browser");
  assert.equal(calls.speak, 1);
  assert.equal(speechSynthesis.lastUtterance.text, "Fallback do ELO");
});

test("fetch rejeitado aciona speechSynthesis", async () => {
  const { calls, voice } = createVoiceHarness({ fetchImpl: async () => { throw new Error("network_down"); } });
  const result = await voice.speak("Fallback por rede");
  assert.equal(result.mode, "browser");
  assert.equal(calls.speak, 1);
});

test("audio invalido aciona speechSynthesis", async () => {
  const { calls, voice } = createVoiceHarness({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: new Map([["content-type", "text/plain"]]),
      blob: async () => new Blob(["texto"], { type: "text/plain" })
    })
  });
  const result = await voice.speak("Fallback por audio invalido");
  assert.equal(result.mode, "browser");
  assert.equal(calls.speak, 1);
});

test("fallback desabilitado retorna erro controlado sem speechSynthesis", async () => {
  const { calls, voice } = createVoiceHarness({
    fetchImpl: async () => ({ ok: false, status: 503, headers: new Map(), blob: async () => new Blob([]) })
  });
  const result = await voice.speak("Sem fallback", { fallback: false });
  assert.equal(result.mode, "text");
  assert.match(result.error, /tts_backend_503/);
  assert.equal(calls.speak, 0);
});

test("stop cancela saidas sem disparar fallback indevido", async () => {
  let resolveFetch;
  const pendingFetch = new Promise((resolve) => { resolveFetch = resolve; });
  const { calls, voice } = createVoiceHarness({ fetchImpl: async () => pendingFetch });
  const pendingSpeak = voice.speak("Parar fala");
  voice.stop();
  resolveFetch({ ok: false, status: 503, headers: new Map(), blob: async () => new Blob([]) });
  const result = await pendingSpeak;
  assert.equal(result.mode, "stopped");
  assert.ok(calls.cancel >= 1);
  assert.equal(calls.speak, 0);
});

test("novo Ouvir cancela anterior e mantem apenas uma saida ativa", async () => {
  let resolveFirst;
  const firstFetch = new Promise((resolve) => { resolveFirst = resolve; });
  let count = 0;
  const { calls, voice } = createVoiceHarness({
    fetchImpl: async () => {
      count += 1;
      if (count === 1) return firstFetch;
      return { ok: false, status: 503, headers: new Map(), blob: async () => new Blob([]) };
    }
  });
  const first = voice.speak("Primeira fala");
  const second = await voice.speak("Segunda fala");
  resolveFirst({ ok: false, status: 503, headers: new Map(), blob: async () => new Blob([]) });
  const firstResult = await first;
  assert.equal(second.mode, "browser");
  assert.equal(firstResult.mode, "stopped");
  assert.equal(calls.speak, 1);
  assert.ok(calls.cancel >= 2);
});