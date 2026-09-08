const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = path.resolve(__dirname, "../..");
const publicConfigPath = path.join(root, "assets", "elo-public-config.js");
const expectedProjectRef = "mplpzyalcxhhinuvjthx";

function runConfig(windowOverrides = {}) {
  const windowRef = { ...windowOverrides };
  vm.runInNewContext(fs.readFileSync(publicConfigPath, "utf8"), { window: windowRef });
  return windowRef;
}

test("ELO public config preserves environment Supabase overrides", () => {
  const windowRef = runConfig({
    ELO_SUPABASE_URL: "https://shared-auth-project.supabase.co",
    ELO_SUPABASE_ANON_KEY: "publishable-shared-auth-key"
  });

  assert.equal(windowRef.ELO_SUPABASE_URL, "https://shared-auth-project.supabase.co");
  assert.equal(windowRef.ELO_SUPABASE_ANON_KEY, "publishable-shared-auth-key");
});

test("ELO public config still provides production defaults when no environment override exists", () => {
  const windowRef = runConfig();

  assert.match(windowRef.ELO_SUPABASE_URL, /^https:\/\/[a-z0-9-]+\.supabase\.co$/);
  assert.equal(typeof windowRef.ELO_SUPABASE_ANON_KEY, "string");
  assert.ok(windowRef.ELO_SUPABASE_ANON_KEY.length > 0);
});
