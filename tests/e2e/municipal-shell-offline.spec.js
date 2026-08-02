import { expect, test } from "@playwright/test";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

function startStaticServer() {
  const root = normalize(process.cwd());
  const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".webmanifest": "application/manifest+json; charset=utf-8" };
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const file = normalize(join(root, decodeURIComponent(url.pathname === "/" ? "/municipal-admin.html" : url.pathname)));
    if (!file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, { "Content-Type": mime[extname(file).toLowerCase()] || "application/octet-stream" });
    createReadStream(file).pipe(res);
  });
  return new Promise((resolveServer) => server.listen(0, "127.0.0.1", () => resolveServer(server)));
}

test("service worker serve o shell municipal em reload e aba nova offline", async ({ browser }) => {
  const server = await startStaticServer();
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      window.OBRAREPORT_API_BASE_URL = window.location.origin;
      window.MUNICIPAL_ADMIN_AUTH_TOKEN = "header.payload.signature";
    });
    await page.route("**/api/municipal-admin/**", async (route) => {
      await route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ ok: false, error: "test_auth_unavailable" }) });
    });

    await page.goto(`${origin}/municipal-admin.html`);
    await expect(page.locator("body")).toContainText("Administracao Municipal");
    await page.evaluate(() => navigator.serviceWorker.ready);

    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toContainText("Administracao Municipal");

    const reopened = await context.newPage();
    await reopened.goto(`${origin}/municipal-admin.html`, { waitUntil: "domcontentloaded" });
    await expect(reopened.locator("body")).toContainText("Administracao Municipal");
  } finally {
    await context.close().catch(() => {});
    server.close();
  }
});