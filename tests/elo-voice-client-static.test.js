import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const client = readFileSync(new URL("../elo-voice-client.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../elo-voice-test.html", import.meta.url), "utf8");

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
