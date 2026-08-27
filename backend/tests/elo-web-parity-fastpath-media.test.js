import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function loadAssistant() {
  const calls = { fetch: 0, router: 0 };
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {} },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost" },
      localStorage: createStorage({ obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" }) }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() {
        calls.fetch += 1;
        throw new Error("fetch nao deve ser chamado em fast-path local");
      },
      EloBrainRouter: {
        routeEloBrain() {
          calls.router += 1;
          throw new Error("router nao deve ser chamado em fast-path local");
        }
      }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls };
}

test("SOCIAL_FAST_PATH responde Tudo e vc sem loop e sem backend", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Tudo e vc?");

  assert.equal(response.fastPath, "SOCIAL_FAST_PATH");
  assert.equal(response.sessionIntent, "social_greeting_reply_no_loop");
  assert.equal(response.shortAnswer, "Tudo certo por aqui.");
  assert.doesNotMatch(response.shortAnswer, /com voce|com você/i);
  assert.deepEqual(calls, { fetch: 0, router: 0 });
});

test("IMAGE_INTENT cria midia inline e preserva referente visual", () => {
  const { assistant } = loadAssistant();
  const image = assistant.buildVisualMediaResponseForTest("Me mostre aqui uma imagem de um poodle toy");

  assert.equal(image.fastPath, "IMAGE_INTENT");
  assert.equal(image.visualMedia.type, "image");
  assert.match(image.visualMedia.src, /source\.unsplash\.com/);
  assert.match(image.visualMedia.title, /poodle toy/i);

  const referent = assistant.buildVisualMediaResponseForTest("Renderize aqui");
  assert.equal(referent.fastPath, "VISUAL_REFERENT");
  assert.equal(referent.visualMedia.type, "image");
  assert.match(referent.visualMedia.title, /poodle toy/i);
});

test("VIDEO_INTENT nao cai no chat de marketing", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildVisualMediaResponseForTest("Abra um vídeo de um poodle toy no veterinário");

  assert.equal(response.fastPath, "VIDEO_SEARCH");
  assert.equal(response.sessionIntent, "video_search_inline");
  assert.equal(response.visualMedia.type, "video");
  assert.match(response.visualMedia.src, /youtube\.com\/embed/);
  assert.doesNotMatch([response.shortAnswer, response.fullAnswer].join("\n"), /marketing|estrategia/i);
});
