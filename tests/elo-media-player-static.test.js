import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const mediaClient = readFileSync(new URL("../elo-media-player.js", import.meta.url), "utf8");
const eloPage = readFileSync(new URL("../elo.html", import.meta.url), "utf8");
const assistant = readFileSync(new URL("../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

function createDocumentHarness() {
  const nodes = {};
  const body = { appendChild(node) { this.lastChild = node; node.parentNode = this; }, querySelector() { return null; } };
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
        style: {},
        events: {},
        appendChild(child) {
          if (child && child.parentNode && child.parentNode.children) child.parentNode.children = child.parentNode.children.filter((item) => item !== child);
          this.children.push(child);
          if (child) child.parentNode = this;
          if (child && child.attributes && child.attributes["data-elo-media-status"]) this.status = child;
        },
        addEventListener(type, handler) { this.events[type] = handler; },
        click() { if (this.events.click) return this.events.click(); },
        setAttribute(name, value) {
          this.attributes[name] = value;
          if (name === "data-elo-media-player") nodes.container = this;
        },
        querySelector(selector) {
          if (selector === "[data-elo-media-status]") return this.status || null;
          const match = selector.match(/^\[data-elo-media-control="([^\"]+)"\]$/);
          if (match) {
            const stack = [...this.children];
            while (stack.length) {
              const child = stack.shift();
              if (child.attributes && child.attributes["data-elo-media-control"] === match[1]) return child;
              if (child.children) stack.push(...child.children);
            }
          }
          return null;
        }
      };
      return node;
    }
  };
}

function createMediaContext(options = {}) {
  const calls = [];
  const autoplay = options.autoplay !== false;
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
          if (autoplay || calls.filter((item) => item[0] === "playVideo").length > 1) {
            config.events.onStateChange({ data: context.window.YT.PlayerState.PLAYING });
          }
        },
        pauseVideo() { calls.push(["pauseVideo"]); },
        stopVideo() { calls.push(["stopVideo"]); },
        setVolume(value) { calls.push(["setVolume", value]); }
      };
    }
  };
  vm.createContext(context);
  vm.runInContext(mediaClient, context);
  return { calls, document, media: context.window.EloMedia };
}

test("EloMedia expõe contrato público esperado", () => {
  assert.match(mediaClient, /window\.EloMedia\s*=\s*\{/);
  ["play", "playYouTubeVideo", "pause", "resume", "stop", "setVolume", "isPlaying"].forEach((name) => {
    assert.match(mediaClient, new RegExp(name + ": " + name));
  });
  assert.match(mediaClient, /mountForTest: setMount/);
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


test("autoplay bloqueado mostra botão Tocar real e não usa botão Ouvir", async () => {
  const { calls, document, media } = createMediaContext({ autoplay: false });
  const result = await media.play("toque Sultans of Swing");
  const container = document.body.lastChild;
  const playButton = container.querySelector("[data-elo-media-control=\"play\"]");
  const pauseButton = container.querySelector("[data-elo-media-control=\"pause\"]");
  const stopButton = container.querySelector("[data-elo-media-control=\"stop\"]");

  assert.equal(result.autoplayBlocked, true);
  assert.equal(playButton.hidden, false);
  assert.equal(playButton.textContent, "▶ Tocar");
  assert.equal(stopButton.hidden, false);
  assert.equal(pauseButton.hidden, true);
  assert.notEqual(playButton.textContent, "Ouvir");

  playButton.click();
  assert.equal(calls.filter((item) => item[0] === "playVideo").length, 2);
  assert.equal(playButton.hidden, true);
  assert.equal(pauseButton.hidden, false);

  pauseButton.click();
  assert.ok(calls.some((item) => item[0] === "pauseVideo"));
  assert.equal(container.querySelector("[data-elo-media-control=\"resume\"]").hidden, false);
  stopButton.click();
  assert.ok(calls.some((item) => item[0] === "stopVideo"));
});


test("controles de música podem ser montados dentro da mensagem do ELO", async () => {
  const { document, media } = createMediaContext({ autoplay: false });
  const message = document.createElement("article");
  message.className = "elo-message assistant";
  const result = await media.play("toque Sultans of Swing", { mount: message });
  const container = message.querySelector("[data-elo-media-player]") || message.children.find((child) => child.attributes && child.attributes["data-elo-media-player"]);
  const playButton = container.querySelector("[data-elo-media-control=\"play\"]");
  const stopButton = container.querySelector("[data-elo-media-control=\"stop\"]");

  assert.equal(result.autoplayBlocked, true);
  assert.equal(container.parentNode, message);
  assert.equal(playButton.hidden, false);
  assert.equal(playButton.textContent, "▶ Tocar");
  assert.equal(stopButton.hidden, false);
  assert.notEqual(playButton.textContent, "Ouvir");
});
test("assistente intercepta música sem alterar pergunta comum", () => {
  assert.match(assistant, /function getEloMediaIntent_/);
  assert.match(assistant, /handleEloMediaCommand_\(question\)/);
  assert.match(assistant, /tryHandleEloMediaCommand_\(cleanQuestion, attachedFiles\)/);
  assert.match(assistant, /media\.play\(question, \{ mount: mediaMessage \}\)/);
  assert.match(assistant, /Tocando Sultans of Swing\./);
  assert.match(assistant, /quem\|qual\|quais\|quando\|onde\|porque\|por que\|canta/);
});

test("não adiciona API key nem baixa áudio", () => {
  assert.doesNotMatch(mediaClient, /YOUTUBE_API_KEY|AIza|download|extract|audio-only/i);
  assert.match(mediaClient, /https:\/\/www\.youtube\.com\/iframe_api/);
});

