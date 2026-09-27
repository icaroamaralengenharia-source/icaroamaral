import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

test("handoff nativo exige sessao autenticada antes de chamar o roteador Web", () => {
  assert.match(assistant, /function dispatchVoiceTranscript_\(transcript, generation\)/);
  assert.match(assistant, /window\.ELO_AUTH_SESSION_VALIDATED === true && !!getEloCoreAuthToken_\(\)/);
  assert.match(assistant, /error: "authentication_required"/);
  assert.match(assistant, /message: "Faça login no ELO para usar a voz\."/);
  assert.match(assistant, /askElo\(command, \[\], "native_voice"\)/);
  assert.match(assistant, /dispatchVoiceTranscript: dispatchVoiceTranscript_/);
});
test("resposta do mesmo roteador volta ao Android e nao duplica TTS Web", () => {
  assert.match(assistant, /onVoiceHandoffResult\(JSON\.stringify\(payload \|\| \{\}\)\)/);
  assert.match(assistant, /ELO_UI\.nativeVoiceHandoff = \{ generation: requestGeneration, command: command \}/);
  assert.match(assistant, /skipAutoTts: !!nativeVoiceHandoff/);
  assert.match(assistant, /ELO_UI\.nativeVoiceHandoff = null/);
  assert.match(assistant, /answer: cleanAnswer/);
});
