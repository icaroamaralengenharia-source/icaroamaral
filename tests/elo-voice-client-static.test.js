import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const client = readFileSync(new URL("../elo-voice-client.js", import.meta.url), "utf8");
const page = readFileSync(new URL("../elo-voice-test.html", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

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


test("ELO real carrega voice client antes do assistente", () => {
  const voiceIndex = eloPage.indexOf("elo-voice-client.js");
  const assistantIndex = eloPage.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  assert.ok(voiceIndex > 0);
  assert.ok(assistantIndex > voiceIndex);
});

test("botao Ouvir usa EloVoice com fallback para speechSynthesis", () => {
  assert.match(assistant, /function getEloVoiceClient_/);
  assert.match(assistant, /voice\.speak\(speechText, \{ voice: "alloy", fallback: false \}\)/);
  assert.match(assistant, /speakEloTextWithBrowserFallback_/);
  assert.match(assistant, /synthesis\.speak\(utterance\)/);
  assert.match(assistant, /function stopEloSpeechOutput_/);
  assert.match(assistant, /voice\.stop\(\)/);
});

test("ELO real mantem voz apenas por clique em Ouvir", () => {
  assert.match(assistant, /button\.addEventListener\("click", function \(\) \{ speakEloText_/);
  assert.doesNotMatch(assistant, /appendAssistantMessage[\s\S]{0,400}voice\.speak/);
});
