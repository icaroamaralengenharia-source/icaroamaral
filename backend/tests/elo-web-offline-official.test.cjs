const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const relatorioRoot = path.join(repoRoot, "relatorio-qualidade-obras");
const libraryPath = path.join(relatorioRoot, "offline-media", "classical", "library.json");
const library = JSON.parse(fs.readFileSync(libraryPath, "utf8"));

function createStorage(seed) {
  const values = new Map(Object.entries(seed || {}));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    dump() {
      return Object.fromEntries(values.entries());
    }
  };
}

function loadOfficialOffline(options = {}) {
  const fetchCalls = [];
  const playCalls = [];
  const context = {
    console,
    setTimeout,
    clearTimeout,
    URL,
    globalThis: null,
    window: {
      navigator: options.navigator || { onLine: false },
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
          playCalls.push(media && media.title);
          return Promise.resolve(true);
        }
      },
      EloMediaPlayer: {
        stop() {
          playCalls.push("STOP");
          return { executed: true };
        }
      }
    }
  };
  context.globalThis = context.window;
  vm.createContext(context);
  for (const file of ["elo-offline-media-library.js", "elo-offline-memory-adapter.js", "elo-offline-router.js"]) {
    vm.runInContext(fs.readFileSync(path.join(relatorioRoot, file), "utf8"), context, { filename: file });
  }
  return { window: context.window, fetchCalls, playCalls };
}

test("elo.html oficial carrega módulos offline antes do assistente", () => {
  const html = fs.readFileSync(path.join(repoRoot, "elo.html"), "utf8");
  const memoryIndex = html.indexOf("relatorio-qualidade-obras/elo-offline-memory-adapter.js");
  const routerIndex = html.indexOf("relatorio-qualidade-obras/elo-offline-router.js");
  const assistantIndex = html.indexOf("relatorio-qualidade-obras/elo-assistente.js");
  assert.ok(memoryIndex > 0);
  assert.ok(routerIndex > memoryIndex);
  assert.ok(assistantIndex > routerIndex);
});

test("service worker oficial cacheia shell offline sem cachear API", () => {
  const sw = fs.readFileSync(path.join(repoRoot, "elo-sw.js"), "utf8");
  assert.match(sw, /elo-web-offline-v4-20260903-official-offline-v1/);
  assert.match(sw, /elo-offline-memory-adapter\.js/);
  assert.match(sw, /elo-offline-router\.js/);
  const assetsBlock = sw.match(/const ELO_SHELL_ASSETS = \[[\s\S]*?\];/)[0];
  assert.doesNotMatch(assetsBlock, /"\.\/api\//);
  assert.match(sw, /\/api\/elo\//);
  for (const track of library) {
    for (const file of track.files) {
      assert.match(sw, new RegExp(file.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});

test("roteador oficial classifica falhas recuperáveis sem mascarar 401 e 403", () => {
  const { window } = loadOfficialOffline();
  for (const status of [0, 502, 503, 504]) {
    assert.equal(window.EloOfflineRouter.classifyBackendResult({ status }), "BACKEND_UNAVAILABLE");
  }
  for (const status of [400, 401, 403, 404]) {
    assert.equal(window.EloOfflineRouter.classifyBackendResult({ status }), "ONLINE_VALIDATED");
  }
  assert.equal(window.EloOfflineRouter.classifyBackendFailure(new Error("network")), "BACKEND_UNAVAILABLE");
});

test("cinco obras obrigatórias tocam offline sem provider nem chat", async () => {
  const { window, fetchCalls, playCalls } = loadOfficialOffline();
  const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage });
  const cases = [
    ["toque Beethoven", "Für Elise"],
    ["toque Debussy", "Clair de Lune"],
    ["toque Vivaldi", "Spring"],
    ["toque Pachelbel", "Canon in D"],
    ["toque Chopin", "Nocturne"]
  ];
  for (const [command, titlePart] of cases) {
    const result = await router.route(command, { navigator: { onLine: false } });
    assert.equal(result.handled, true);
    assert.equal(result.localPlay, true);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.chatCalls, 0);
    assert.match(result.media.title, new RegExp(titlePart, "i"));
  }
  assert.equal(fetchCalls.filter((url) => !url.includes("library.json")).length, 0);
  assert.equal(playCalls.length, 5);
});

test("misses musicais offline são honestos e não chamam provider", async () => {
  const { window, fetchCalls, playCalls } = loadOfficialOffline();
  const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage });
  for (const command of ["toque Take On Me", "toque Sweet Child O' Mine"]) {
    const result = await router.route(command, { navigator: { onLine: false } });
    assert.equal(result.handled, true);
    assert.equal(result.localPlay, false);
    assert.equal(result.unavailableOffline, true);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.chatCalls, 0);
    assert.match(result.message, /não está disponível/i);
  }
  assert.equal(fetchCalls.filter((url) => !url.includes("library.json")).length, 0);
  assert.equal(playCalls.length, 0);
});

test("memória Thor e Photo Bridge persistem nas chaves oficiais", async () => {
  const storage = createStorage();
  const first = loadOfficialOffline({ storage });
  const router = first.window.EloOfflineRouter.createRouter({ storage });
  await router.route("lembre que meu cachorro se chama Thor", { navigator: { onLine: false } });
  await router.route("lembre que o projeto atual é Photo Bridge", { navigator: { onLine: false } });

  const second = loadOfficialOffline({ storage });
  const reloaded = second.window.EloOfflineRouter.createRouter({ storage });
  const dog = await reloaded.route("qual o nome do meu cachorro?", { navigator: { onLine: false } });
  const project = await reloaded.route("qual projeto estamos trabalhando?", { navigator: { onLine: false } });

  assert.match(dog.message, /Thor/);
  assert.match(project.message, /Photo Bridge/);
  assert.ok(JSON.parse(storage.getItem("elo_long_term_memory_v1")).length >= 2);
  assert.equal(JSON.parse(storage.getItem("elo_core_project_memory_v1"))[0].project_name, "Photo Bridge");
  assert.equal(storage.getItem("elo_offline_memory_v1"), null);
});

test("backend indisponível bloqueia comando sem suporte offline", async () => {
  const { window } = loadOfficialOffline({ navigator: { onLine: true } });
  const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage, backendState: "BACKEND_UNAVAILABLE" });
  const result = await router.route("pesquise notícias de hoje", { navigator: { onLine: true } });
  assert.equal(result.handled, false);
  assert.equal(result.connectivity, "BACKEND_UNAVAILABLE");
  assert.equal(result.providerCalls, 0);
  assert.equal(result.chatCalls, 0);
  assert.match(result.message, /precisa de conexão/i);
});

test("pare offline aciona stop local e invalida execução antiga", async () => {
  const { window, playCalls } = loadOfficialOffline();
  const router = window.EloOfflineRouter.createRouter({ storage: window.localStorage });
  const result = await router.route("pare", { navigator: { onLine: false } });
  assert.equal(result.handled, true);
  assert.equal(result.intent, "MUSIC_STOP");
  assert.equal(result.localStop, true);
  assert.deepEqual(playCalls, ["STOP"]);
});
