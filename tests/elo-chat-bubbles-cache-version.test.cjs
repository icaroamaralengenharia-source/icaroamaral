const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "elo.html"), "utf8");

test("ELO chat bubble CSS uses a versioned asset URL", () => {
  assert.match(html, /href="elo\.css\?v=20261010-chat-bubbles-v1"/);
});
