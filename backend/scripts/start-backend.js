import { ensureRenderPlaywrightBrowsersPath } from "./playwright-render-env.js";

ensureRenderPlaywrightBrowsersPath();

await import("../src/server.js");
