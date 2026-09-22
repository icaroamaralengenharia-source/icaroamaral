const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repo = path.resolve(__dirname, "..", "..");
const ASSET_VERSION = "20260922-rdo-routing-v2";
const SW_VERSION = "20260922-sw-routing-v2";
const CACHE_NAME = "elo-web-offline-v14-20260922-routing-v2";
const OLD_ASSET_VERSION = "20260921-rdo-cache-v1";

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

  assert.match(sw, new RegExp('const ELO_CACHE_NAME = "' + CACHE_NAME + '"'));
  assert.match(sw, /name\.indexOf\("elo-web-offline-"\) === 0/);
  assert.match(sw, /return caches\.delete\(name\)/);
  assert.doesNotMatch(html, new RegExp("elo-(?:assistente|command-bridge)\\.js\\?v=" + OLD_ASSET_VERSION));
  assert.doesNotMatch(sw, new RegExp("elo-(?:assistente|command-bridge)\\.js\\?v=" + OLD_ASSET_VERSION));
  assert.doesNotMatch(standalone, new RegExp("elo-(?:assistente|command-bridge)\\.js\\?v=" + OLD_ASSET_VERSION));
  assert.doesNotMatch(sw, /ignoreSearch\s*:\s*true/);
  assert.match(sw, /cache\.put\(request, copy\)/);
  assert.match(assistant, /wantsRdoGenerateDocument/);
  assert.match(bridge, /rdo\.generateDocument/);
  assert.doesNotMatch(html, /elo-assistente\.js\?v=20260920-device-availability-fix-v1/);
  assert.doesNotMatch(html, /elo-command-bridge\.js\?v=20260727-command-bridge-v1/);
});
