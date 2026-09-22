const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repo = path.resolve(__dirname, "..", "..");
const ASSET_VERSION = "20260921-rdo-cache-v1";
const SW_VERSION = "20260921-sw-optional-media-v1";

function read(file) {
  return fs.readFileSync(path.join(repo, file), "utf8");
}

test("ELO WebView versiona os assets do shell sem apagar o cache compartilhado", () => {
  const html = read("elo.html");
  const sw = read("elo-sw.js");
  const standalone = read(path.join("relatorio-qualidade-obras", "relatorio-qualidade-obras.html"));
  const assistant = read(path.join("relatorio-qualidade-obras", "elo-assistente.js"));
  const bridge = read(path.join("relatorio-qualidade-obras", "elo-command-bridge.js"));

  assert.match(html, new RegExp("elo-command-bridge\\.js\\?v=" + ASSET_VERSION));
  assert.match(html, new RegExp("elo-assistente\\.js\\?v=" + ASSET_VERSION));
  assert.match(html, new RegExp("elo-sw\\.js\\?v=" + SW_VERSION));
  assert.match(sw, new RegExp("elo-command-bridge\\.js\\?v=" + ASSET_VERSION));
  assert.match(sw, new RegExp("elo-assistente\\.js\\?v=" + ASSET_VERSION));
  assert.match(standalone, new RegExp("elo-command-bridge\\.js\\?v=" + ASSET_VERSION));
  assert.match(standalone, new RegExp("elo-assistente\\.js\\?v=" + ASSET_VERSION));

  assert.match(sw, /const ELO_CACHE_NAME = "elo-web-offline-v13-20260920-observability-final-v1"/);
  assert.match(sw, /name\.indexOf\("elo-web-offline-"\) === 0/);
  assert.match(sw, /return caches\.delete\(name\)/);
  assert.match(assistant, /wantsRdoGenerateDocument/);
  assert.match(bridge, /rdo\.generateDocument/);
  assert.doesNotMatch(html, /elo-assistente\.js\?v=20260920-device-availability-fix-v1/);
  assert.doesNotMatch(html, /elo-command-bridge\.js\?v=20260727-command-bridge-v1/);
});
