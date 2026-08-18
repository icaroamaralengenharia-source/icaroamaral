import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const mediaClient = readFileSync(new URL("../elo-media-player.js", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

function createDocumentHarness() {
  const nodes = {};
  const body = { appendChild(node) { this.lastChild = node; }, querySelector() { return null; } };
  const head = { appendChild(node) { this.lastScript = node; } };
  return {
    body,
    head,
    querySelector(selector) {
      if (selector === "[data-elo-media-player]") return nodes.container || null;
      if (selector === "script[src='https://www.youtube.com/iframe_api']") return head.lastScript || null;
      return null;
    },
    createElement(tag) {
      const node = {
        tagName: tag.toUpperCase(),
        children: [],
        attributes: {},
        className: "",
        hidden: false,
        textContent: "",
        appendChild(child) {
          this.children.push(child);
          if (child && child.attributes && child.attributes["data-elo-media-status"]) this.status = child;
        },
        addEventListener() {},
        setAttribute(name, value) {
          this.attributes[name] = value;
          if (name === "data-elo-media-player") nodes.container = this;
        },
        querySelector(selector) {
          if (selector === "[data-elo-media-status]") return this.status || null;
          return null;
        }
      };
      return node;
    }
  };
}

function createMediaContext() {
  const calls = [];
  const document = createDocumentHarness();
  const context = {
    document,
    window: {
      location: { origin: "https://www.icaroamaral.com.br" },
      setTimeout: (fn) => { fn(); return 1; }
    }
  };
  context.window.window = context.window;
  context.window.document = document;
  context.window.YT = {
    PlayerState: { PLAYING: 1, PAUSED: 2, ENDED: 0 },
    Player: function Player(id, config) {
      calls.push(["player", id, config.videoId]);
      return {
        loadVideoById(videoId) { calls.push(["loadVideoById", videoId]); },
        playVideo() {
          calls.push(["playVideo"]);
          config.events.onStateChange({ data: context.window.YT.PlayerState.PLAYING });
        },
        pauseVideo() { calls.push(["pauseVideo"]); },
        stopVideo() { calls.push(["stopVideo"]); },
        setVolume(value) { calls.push(["setVolume", value]); }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(mediaClient, context);
  return { calls, media: context.window.EloMedia };
}

test("EloMedia expõe contrato público esperado", () => {
  assert.match(mediaClient, /window\.EloMedia\s*=\s*\{/);
  ["play", "playYouTubeVideo", "pause", "resume", "stop", "setVolume", "isPlaying"].forEach((name) => {
    assert.match(mediaClient, new RegExp(name + ": " + name));
  });
});

test("ELO carrega player de mídia antes do assistente", () => {
  const mediaIndex = eloPage.indexOf("elo-media-player.js");
  const assistantIndex = eloPage.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  assert.ok(mediaIndex > 0);
  assert.ok(assistantIndex > mediaIndex);
});

test("mapeia somente comandos de play para Sultans of Swing", () => {
  const { media } = createMediaContext();
  assert.equal(media.resolveCommandForTest("toque Sultans of Swing").videoId, "h0ffIJ7ZO4U");
  assert.equal(media.resolveCommandForTest("reproduza sultan of swing").videoId, "h0ffIJ7ZO4U");
  assert.equal(media.resolveCommandForTest("quem canta Sultans of Swing?"), null);
});

test("play usa YouTube IFrame API e controles chamam player oficial", async () => {
  const { calls, media } = createMediaContext();
  const result = await media.play("toque Sultans of Swing");
  assert.equal(result.ok, true);
  assert.equal(result.videoId, "h0ffIJ7ZO4U");
  assert.deepEqual(calls.filter((item) => item[0] === "loadVideoById").at(-1), ["loadVideoById", "h0ffIJ7ZO4U"]);
  assert.ok(calls.some((item) => item[0] === "playVideo"));
  media.pause();
  media.resume();
  media.stop();
  media.setVolume(25);
  assert.ok(calls.some((item) => item[0] === "pauseVideo"));
  assert.ok(calls.filter((item) => item[0] === "playVideo").length >= 2);
  assert.ok(calls.some((item) => item[0] === "stopVideo"));
  assert.ok(calls.some((item) => item[0] === "setVolume" && item[1] === 25));
});

test("assistente intercepta música sem alterar pergunta comum", () => {
  assert.match(assistant, /function getEloMediaIntent_/);
  assert.match(assistant, /handleEloMediaCommand_\(question\)/);
  assert.match(assistant, /tryHandleEloMediaCommand_\(cleanQuestion, attachedFiles\)/);
  assert.match(assistant, /Tocando Sultans of Swing\./);
  assert.match(assistant, /quem\|qual\|quais\|quando\|onde\|porque\|por que\|canta/);
});

test("não adiciona API key nem baixa áudio", () => {
  assert.doesNotMatch(mediaClient, /YOUTUBE_API_KEY|AIza|download|extract|audio-only/i);
  assert.match(mediaClient, /https:\/\/www\.youtube\.com\/iframe_api/);
});
