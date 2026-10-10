import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";

const repoRoot = resolve(import.meta.dirname, "../..");
const assetVersion = "20261008-stock-uuid-lookup-v2";

function read(relativePath) {
  return readFileSync(join(repoRoot, relativePath), "utf8");
}

test("ELO shells and service worker use the Stock item lookup bridge cache version", () => {
  const shell = read("elo.html");
  const standalone = read("relatorio-qualidade-obras/relatorio-qualidade-obras.html");
  const serviceWorker = read("elo-sw.js");

  assert.match(shell, new RegExp("elo-command-bridge\\.js\\?v=" + assetVersion));
  assert.match(standalone, new RegExp("elo-command-bridge\\.js\\?v=" + assetVersion));
  assert.match(serviceWorker, new RegExp("elo-command-bridge\\.js\\?v=" + assetVersion));
  assert.match(shell, /elo-sw\.js\?v=20261010-safe-humor-v2/);
  assert.match(serviceWorker, /const ELO_CACHE_NAME = "elo-web-offline-v34-20261010-safe-humor-v2"/);
  assert.doesNotMatch(shell, /elo-command-bridge\.js\?v=20261008-stock-auth-refresh-v1/);
  assert.doesNotMatch(serviceWorker, /elo-command-bridge\.js\?v=20261008-stock-auth-refresh-v1/);
});
