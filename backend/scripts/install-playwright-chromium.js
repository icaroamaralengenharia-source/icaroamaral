import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { ensureRenderPlaywrightBrowsersPath } from "./playwright-render-env.js";

ensureRenderPlaywrightBrowsersPath();

const require = createRequire(import.meta.url);
const playwrightPackage = require.resolve("playwright/package.json");
const playwrightCli = join(dirname(playwrightPackage), "cli.js");
const result = spawnSync(process.execPath, [playwrightCli, "install", "chromium"], {
  env: process.env,
  stdio: "inherit",
  shell: false
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
