const RENDER_PLAYWRIGHT_BROWSERS_PATH = "/opt/render/project/.cache/playwright";

function isRenderRuntime() {
  return Boolean(
    process.env.RENDER ||
    process.env.RENDER_SERVICE_ID ||
    process.env.RENDER_EXTERNAL_URL ||
    process.cwd().startsWith("/opt/render/")
  );
}

function ensureRenderPlaywrightBrowsersPath() {
  if (isRenderRuntime() && !process.env.PLAYWRIGHT_BROWSERS_PATH) {
    process.env.PLAYWRIGHT_BROWSERS_PATH = RENDER_PLAYWRIGHT_BROWSERS_PATH;
  }

  return process.env.PLAYWRIGHT_BROWSERS_PATH || "";
}

export { RENDER_PLAYWRIGHT_BROWSERS_PATH, ensureRenderPlaywrightBrowsersPath };
