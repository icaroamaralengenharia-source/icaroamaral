const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function load() {
  const calls = [];
  const window = {
    EloOfflineMediaLibrary: {
      find() { return { title: "Für Elise", source: "LOCAL_CLASSICAL", offline: true, files: [{ path: "offline-media/classical/beethoven/fur-elise.ogg", url: "./relatorio-qualidade-obras/offline-media/classical/beethoven/fur-elise.ogg" }] }; }
    },
    EloMediaPlayer: {
      play(item) { calls.push(["play", item.title]); return Promise.resolve(true); },
      pause() { calls.push(["pause"]); return true; },
      resume() { calls.push(["resume"]); return true; },
      stop() { calls.push(["stop"]); return true; }
    }
  };
  const context = { window, console, Date, Intl, JSON, Number, String, Math, Promise };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "elo-offline-core-v2.js"), "utf8"), context);
  return { core: window.EloOfflineCoreV2, calls };
}

test("offline core resolves device date without backend", () => {
  const { core } = load();
  const today = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
  assert.match(core.resolve("Que dia é hoje?").fullAnswer, new RegExp(today.replace(/\//g, "\\/")));
  assert.equal(core.resolve("Que dia é amanhã?").offline, true);
});

test("offline core calculates percentage, volume and continuity", () => {
  const { core } = load();
  assert.match(core.resolve("Quanto é 125 x 8").fullAnswer, /1\.000/);
  assert.match(core.resolve("Quanto é 15% de 200").fullAnswer, /30/);
  assert.match(core.resolve("Uma laje de 8 x 6 x 0,12 m tem quantos m³").fullAnswer, /5,76/);
  assert.match(core.resolve("Quanto é 20 x 5").fullAnswer, /100/);
  assert.match(core.resolve("E vezes 3").fullAnswer, /300/);
});

test("offline core answers technical knowledge and internet boundary locally", () => {
  const { core } = load();
  assert.match(core.resolve("O que é impermeabilização?").fullAnswer, /Impermeabilização/);
  assert.equal(core.resolve("Pesquise o preço atual do cimento.").sessionIntent, "online_required");
  assert.equal(core.intentCount >= 100, true);
  assert.equal(core.knowledgeCount >= 15, true);
});

test("offline core plays local Für Elise and controls it without URL", () => {
  const { core, calls } = load();
  assert.match(core.resolve("Toque Für Elise").fullAnswer, /offline/);
  assert.deepEqual(calls[0], ["play", "Für Elise"]);
  core.resolve("Pause");
  core.resolve("Continue");
  assert.deepEqual(calls.slice(1), [["pause"], ["resume"]]);
});
