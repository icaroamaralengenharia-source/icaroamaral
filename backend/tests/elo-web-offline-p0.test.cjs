const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const relatorioRoot = path.join(repoRoot, "relatorio-qualidade-obras");
const library = JSON.parse(fs.readFileSync(path.join(relatorioRoot, "offline-media", "classical", "library.json"), "utf8"));

function createStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function loadOffline(options = {}) {
  const fetchCalls = [];
  const playCalls = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    globalThis: null,
    window: {
      navigator: { onLine: false },
      localStorage: options.storage || createStorage(),
      fetch(url) {
        fetchCalls.push(String(url));
        if (String(url).includes("library.json")) {
          return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(library) });
        }
        return Promise.reject(new Error("external_fetch_blocked"));
      },
      EloMusicResolver: {
        play(media) {
          playCalls.push(media);
          return Promise.resolve(options.playResult === undefined ? true : options.playResult);
        }
      },
      EloMediaPlayer: {
        stop() { return { executed: true }; }
      }
    }
  };
  context.globalThis = context.window;
  vm.createContext(context);
  for (const file of ["elo-offline-media-library.js", "elo-offline-memory-adapter.js", "elo-offline-router.js"]) {
    vm.runInContext(fs.readFileSync(path.join(relatorioRoot, file), "utf8"), context, { filename: file });
  }
  return { window: context.window, router: context.window.EloOfflineRouter.createRouter({ storage: context.window.localStorage, now: options.now }), fetchCalls, playCalls };
}

function externalFetches(fetchCalls) {
  return fetchCalls.filter((url) => !url.includes("library.json"));
}

test("P0 offline: data hora matematica e capacidades sao locais", async () => {
  const { window, router, fetchCalls } = loadOffline({ now: () => new Date("2026-09-06T15:42:00-03:00") });

  const date = await router.route("que dia e hoje?", { navigator: { onLine: false } });
  const time = await router.route("que horas sao?", { navigator: { onLine: false } });
  const math = await router.route("quanto e 158 x 23", { navigator: { onLine: false } });
  const capabilities = await router.route("o que sabe fazer offline?", { navigator: { onLine: false } });

  assert.equal(date.handled, true);
  assert.equal(date.intent, "DATE_LOCAL");
  assert.match(date.message, /06\/09\/2026|6 de setembro de 2026/i);
  assert.equal(time.handled, true);
  assert.equal(time.intent, "TIME_LOCAL");
  assert.match(time.message, /15:42/);
  assert.equal(math.handled, true);
  assert.equal(math.intent, "MATH_LOCAL");
  assert.equal(math.result, 3634);
  assert.match(math.message, /3634/);
  assert.equal(capabilities.handled, true);
  assert.equal(capabilities.intent, "OFFLINE_CAPABILITIES");
  assert.match(capabilities.message, /data/i);
  assert.match(capabilities.message, /matem/i);
  assert.match(window.EloOfflineRouter.normalize(capabilities.message), /musica/);
  assert.equal(externalFetches(fetchCalls).length, 0);
});

test("P0 offline: nome local nao inventa e usa perfil quando existe", async () => {
  const empty = loadOffline();
  const missing = await empty.router.route("qual meu nome?", { navigator: { onLine: false } });
  assert.equal(missing.handled, true);
  assert.equal(missing.intent, "IDENTITY_LOCAL");
  assert.equal(missing.identityAvailable, false);
  assert.doesNotMatch(empty.window.EloOfflineRouter.normalize(missing.message), /precisa de conexao/);

  const named = loadOffline({ storage: createStorage({ obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro Amaral" }) }) });
  const answer = await named.router.route("qual meu nome?", { navigator: { onLine: false } });
  assert.equal(answer.handled, true);
  assert.equal(answer.identityAvailable, true);
  assert.match(answer.message, /Icaro Amaral/);
});

test("P0 offline: Fur Elise sempre vence como LOCAL_CLASSICAL", async () => {
  const { router, fetchCalls, playCalls } = loadOffline();
  const commands = [
    "toque Fur Elise",
    "toque fur elise",
    "toque Fur Elise - Ludwig van Beethoven",
    "toque a musica Fur Elise",
    "toque Beethoven"
  ];

  for (const command of commands) {
    const result = await router.route(command, { navigator: { onLine: false } });
    assert.equal(result.handled, true, command);
    assert.equal(result.localPlay, true, command);
    assert.equal(result.media.id, "beethoven-fur-elise", command);
    assert.equal(result.media.source, "LOCAL_CLASSICAL", command);
    assert.match(result.media.files[0].url, /offline-media\/classical\/beethoven\/fur-elise\.ogg/);
  }
  assert.equal(externalFetches(fetchCalls).length, 0);
  assert.equal(playCalls.length, commands.length);
});

test("P0 offline: sugestao para trabalhar preserva asset local no sim", async () => {
  const { window, router, fetchCalls, playCalls } = loadOffline();

  const suggestion = await router.route("toque musicas para trabalhar", { navigator: { onLine: false } });
  assert.equal(suggestion.handled, true);
  assert.equal(suggestion.intent, "MUSIC_SUGGESTION");
  assert.equal(suggestion.pendingLocalMediaId, "beethoven-fur-elise");
  assert.match(window.EloOfflineRouter.normalize(suggestion.message), /fur elise/);

  const confirmed = await router.route("sim", { navigator: { onLine: false } });
  assert.equal(confirmed.handled, true);
  assert.equal(confirmed.intent, "MUSIC_CONFIRMATION");
  assert.equal(confirmed.localPlay, true);
  assert.equal(confirmed.media.id, "beethoven-fur-elise");
  assert.equal(externalFetches(fetchCalls).length, 0);
  assert.equal(playCalls.length, 1);
});

test("P0 offline: play rejeitado nao vira falso Tocando", async () => {
  const { router } = loadOffline({ playResult: false });
  const result = await router.route("toque fur elise", { navigator: { onLine: false } });
  assert.equal(result.handled, true);
  assert.equal(result.localPlay, false);
  assert.doesNotMatch(result.message, /^Tocando/i);
  assert.match(result.message, /não iniciou|nao iniciou/i);
});

