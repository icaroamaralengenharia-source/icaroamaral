import assert from "node:assert/strict";
import fs from "node:fs";
import path, { dirname } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "elo.html"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "elo-sw.js"), "utf8");

test("ELO neural TTS cache version is synchronized across page and service worker", () => {
  const version = "20261009-tts-binary-v1";
  const scriptUrl = `relatorio-qualidade-obras/elo-assistente.js?v=${version}`;
  const workerUrl = `./elo-sw.js?v=${version}`;

  assert.ok(html.includes(`<script src="${scriptUrl}"></script>`));
  assert.ok(html.includes(`navigator.serviceWorker.register("${workerUrl}")`));
  assert.ok(serviceWorker.includes(`"./${scriptUrl}"`));

  assert.ok(!html.includes("elo-assistente.js?v=20261008-android-stock-routing-v1"));
  assert.ok(!serviceWorker.includes("elo-assistente.js?v=20261008-android-stock-routing-v1"));
});
