const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "..", "..");
const labRoot = path.join(repoRoot, "elo-offline-lab");
const libraryPath = path.join(repoRoot, "relatorio-qualidade-obras", "offline-media", "classical", "library.json");
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
    }
  };
}

function loadLab() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    globalThis: null,
    window: {
      navigator: { onLine: true },
      localStorage: createStorage()
    }
  };
  context.globalThis = context.window;
  vm.createContext(context);
  for (const file of ["elo-offline-memory-adapter.js", "elo-offline-router.js"]) {
    vm.runInContext(fs.readFileSync(path.join(labRoot, file), "utf8"), context, { filename: file });
  }
  return context.window;
}

test("lab usa a biblioteca real de 5 obras e 7 audios", () => {
  assert.equal(library.length, 5);
  assert.equal(library.reduce((total, item) => total + item.files.length, 0), 7);
});

test("detecta browser offline e online ainda nao validado", () => {
  const lab = loadLab();
  assert.equal(lab.EloOfflineLabRouter.detectBrowserState({ onLine: false }), "BROWSER_OFFLINE");
  assert.equal(lab.EloOfflineLabRouter.detectBrowserState({ onLine: true }), "ONLINE_UNVERIFIED");
});

test("classifica falhas recuperaveis sem mascarar 401 e 403 como offline", () => {
  const lab = loadLab();
  for (const status of [502, 503, 504]) {
    assert.equal(lab.EloOfflineLabRouter.classifyBackendResult({ status }), "BACKEND_UNAVAILABLE");
  }
  for (const status of [401, 403, 404, 400]) {
    assert.equal(lab.EloOfflineLabRouter.classifyBackendResult({ status }), "ONLINE_VALIDATED");
  }
  assert.equal(lab.EloOfflineLabRouter.classifyBackendFailure(new Error("network")), "BACKEND_UNAVAILABLE");
  assert.equal(lab.EloOfflineLabRouter.classifyBackendFailure({ status: 503 }), "BACKEND_UNAVAILABLE");
});

test("timeout de backend habilita execucao local para comandos offline", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({
    library,
    timeoutMs: 5,
    backendProbe: () => new Promise(() => {})
  });
  const result = await router.route("toque Chopin", { navigator: { onLine: true } });
  assert.equal(result.connectivity, "BACKEND_UNAVAILABLE");
  assert.equal(result.localPlay, true);
  assert.equal(result.providerCalls, 0);
  assert.equal(result.chatCalls, 0);
});

test("navigator online com falha de rede usa router local quando o intent e local", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({
    library,
    backendProbe: () => Promise.reject(new Error("DNS failure"))
  });
  const result = await router.route("toque Beethoven", { navigator: { onLine: true } });
  assert.equal(result.connectivity, "BACKEND_UNAVAILABLE");
  assert.equal(result.localPlay, true);
  assert.equal(result.track.id, "beethoven-fur-elise");
});

test("backend indisponivel nao finge executar comando sem suporte offline", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({
    library,
    backendProbe: () => Promise.resolve({ status: 503 })
  });
  const result = await router.route("pesquise noticias de hoje", { navigator: { onLine: true } });
  assert.equal(result.connectivity, "BACKEND_UNAVAILABLE");
  assert.equal(result.handled, false);
  assert.equal(result.localOnly, false);
});

test("status 401 e 403 continuam no fluxo online, nao em fallback offline", async () => {
  const lab = loadLab();
  for (const status of [401, 403]) {
    const router = lab.EloOfflineLabRouter.createRouter({
      library,
      backendProbe: () => Promise.resolve({ status })
    });
    const result = await router.route("pesquise noticias de hoje", { navigator: { onLine: true } });
    assert.equal(result.connectivity, "ONLINE_VALIDATED");
    assert.equal(result.message, "Comando encaminhável ao fluxo online existente.");
  }
});

test("cinco obras obrigatorias tocam offline sem chamadas externas", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({ library });
  const commands = [
    ["toque Beethoven", "beethoven-fur-elise", 1],
    ["toque Debussy", "debussy-clair-de-lune", 1],
    ["toque Vivaldi", "vivaldi-four-seasons-spring", 3],
    ["toque Pachelbel", "pachelbel-canon-in-d", 1],
    ["toque Chopin", "chopin-nocturne-op-9-no-2", 1]
  ];

  for (const [command, id, fileCount] of commands) {
    const result = await router.route(command, { navigator: { onLine: false } });
    assert.equal(result.localPlay, true);
    assert.equal(result.track.id, id);
    assert.equal(result.files.length, fileCount);
    assert.equal(result.providerCalls, 0);
    assert.equal(result.chatCalls, 0);
  }
});

test("Take On Me ausente nao e anunciado como tocado", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({ library });
  const result = await router.route("toque Take On Me", { navigator: { onLine: false } });
  assert.equal(result.localPlay, false);
  assert.equal(result.unavailableOffline, true);
  assert.match(result.message, /não está disponível/i);
});

test("comando pare interrompe audio offline", async () => {
  const lab = loadLab();
  const router = lab.EloOfflineLabRouter.createRouter({ library });
  const result = await router.route("pare", { navigator: { onLine: false } });
  assert.equal(result.intent, "MUSIC_STOP");
  assert.equal(result.localStop, true);
});

test("memoria Thor e Photo Bridge persistem entre instancias do router", async () => {
  const lab = loadLab();
  const storage = createStorage();
  const firstRouter = lab.EloOfflineLabRouter.createRouter({ library, storage });
  await firstRouter.route("lembre que meu cachorro se chama Thor", { navigator: { onLine: false } });
  await firstRouter.route("lembre que o projeto atual é Photo Bridge", { navigator: { onLine: false } });

  const secondRouter = lab.EloOfflineLabRouter.createRouter({ library, storage });
  const dog = await secondRouter.route("qual o nome do meu cachorro?", { navigator: { onLine: false } });
  const project = await secondRouter.route("qual projeto estamos trabalhando?", { navigator: { onLine: false } });

  assert.match(dog.message, /Thor/);
  assert.match(project.message, /Photo Bridge/);
  assert.equal(JSON.parse(storage.getItem(lab.EloOfflineMemoryAdapter.LONG_TERM_KEY)).length >= 2, true);
  assert.equal(JSON.parse(storage.getItem(lab.EloOfflineMemoryAdapter.PROJECT_KEY))[0].project_name, "Photo Bridge");
});

test("nao gera falsos positivos para mencoes sem comando local", () => {
  const lab = loadLab();
  for (const phrase of [
    "gosto de Beethoven",
    "quem foi Beethoven?",
    "projeto de uma casa",
    "meu cachorro latiu",
    "parede de concreto"
  ]) {
    assert.equal(lab.EloOfflineLabRouter.detectIntent(phrase), "NONE");
  }
});

test("service worker e restrito ao cache do lab e inclui todos os audios reais", () => {
  const sw = fs.readFileSync(path.join(labRoot, "sw.js"), "utf8");
  assert.match(sw, /elo-offline-lab-v1-20260902/);
  assert.doesNotMatch(sw, /elo-web-offline/);
  assert.doesNotMatch(sw, /clients\.claim/);
  for (const track of library) {
    for (const file of track.files) {
      assert.match(sw, new RegExp(file.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  }
});
