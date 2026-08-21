import assert from "node:assert/strict";
import { test } from "node:test";
import { routeEloCommandForAndroid_ } from "../src/app.js";

test("roteador Android normaliza numeros em ingles somente no contexto matematico", async () => {
  const two = await routeEloCommandForAndroid_({ command: "quanto é two mais two" });
  const three = await routeEloCommandForAndroid_({ command: "three mais three" });
  const digits = await routeEloCommandForAndroid_({ command: "5 mais 5" });

  assert.equal(two.normalizedCommand, "quanto é dois mais dois");
  assert.equal(two.router, "OPERATIONAL");
  assert.match(two.answer, /quatro/i);
  assert.equal(three.normalizedCommand, "três mais três");
  assert.match(three.answer, /seis/i);
  assert.equal(digits.router, "OPERATIONAL");
  assert.match(digits.answer, /dez/i);
});

test("roteador Android separa musica de conversa sobre artista", async () => {
  const music = await routeEloCommandForAndroid_({ command: "toque Sultans of Swing" });
  const chat = await routeEloCommandForAndroid_({ command: "quem é Dire Straits?" });

  assert.equal(music.type, "media");
  assert.equal(music.router, "MUSIC");
  assert.equal(music.action, "play");
  assert.equal(music.media.videoId, "h0ffIJ7ZO4U");
  assert.equal(chat.router, "CHAT");
  assert.notEqual(chat.router, "MUSIC");
});

test("roteador Android classifica dado atual como live data", async () => {
  const live = await routeEloCommandForAndroid_({ command: "quantos graus está fazendo em Vitória da Conquista" });

  assert.equal(live.router, "LIVE_DATA");
  assert.equal(live.action, "provider_unavailable");
  assert.match(live.answer, /provedor de clima ao vivo/i);
});


test("follow-up curto continua assunto pelo historico", async () => {
  const sultans = await routeEloCommandForAndroid_({
    command: "sim",
    history: [
      { role: "user", content: "me fale sobre Sultans of Swing" },
      { role: "assistant", content: "Sultans of Swing é uma música do Dire Straits. Quer mais detalhes?" }
    ]
  });
  const dire = await routeEloCommandForAndroid_({
    command: "sim",
    history: [
      { role: "user", content: "quem é Dire Straits?" },
      { role: "assistant", content: "Dire Straits é uma banda britânica. Quer saber mais?" }
    ]
  });

  assert.equal(sultans.router, "FOLLOWUP");
  assert.equal(sultans.action, "continue_topic");
  assert.equal(sultans.followupDetected, true);
  assert.equal(sultans.followupTopic, "Sultans of Swing");
  assert.match(sultans.answer, /Sultans of Swing/i);
  assert.equal(dire.router, "FOLLOWUP");
  assert.equal(dire.followupTopic, "Dire Straits");
  assert.match(dire.answer, /Dire Straits/i);
});

test("follow-up curto sem contexto nao inventa tema", async () => {
  const result = await routeEloCommandForAndroid_({ command: "sim", history: [] });

  assert.equal(result.router, "FOLLOWUP");
  assert.equal(result.action, "needs_context");
  assert.equal(result.followupDetected, true);
  assert.equal(result.followupTopic, "");
  assert.match(result.answer, /qual assunto|tema/i);
});

test("follow-up sim so dispara play quando a pergunta anterior pede tocar", async () => {
  const result = await routeEloCommandForAndroid_({
    command: "sim",
    history: [
      { role: "user", content: "me fale sobre Sultans of Swing" },
      { role: "assistant", content: "Quer que eu toque Sultans of Swing?" }
    ]
  });

  assert.equal(result.router, "MUSIC");
  assert.equal(result.action, "play");
  assert.equal(result.media.videoId, "h0ffIJ7ZO4U");
});
