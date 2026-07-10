import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const storageKey = "icaro_site_access_v2";
const password = ["Kellinha", "#", "13"].join("");
const checkoutRoute = "/filhos-fortes/comprar.html";
const ignoredDirs = new Set([".git", "node_modules", "tmp", "test-results", "artifacts", "dist"]);
const requiredRobots = '<meta name="robots" content="noindex, nofollow, noarchive">';

function shouldIgnoreDir(name) {
  return ignoredDirs.has(name) || name.startsWith("backup-");
}

function walkHtml(dir, root = dir, files = []) {
  for (const entry of readdirSync(dir)) {
    if (shouldIgnoreDir(entry)) continue;
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkHtml(fullPath, root, files);
    } else if (entry.toLowerCase().endsWith(".html")) {
      files.push({
        fullPath,
        relativePath: relative(root, fullPath)
      });
    }
  }
  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

function routeFor(relativePath) {
  const route = "/" + relativePath.split(sep).join("/");
  return route.endsWith("/index.html") ? route.slice(0, -"index.html".length) : route;
}

async function stubExternalCheckout(page) {
  await page.route("https://www.mercadopago.com.br/**", async (route) => {
    await route.fulfill({ status: 200, contentType: "text/html", body: "Checkout Mercado Pago" });
  });
}

const htmlFiles = walkHtml(process.cwd());
const requiredRoutes = [
  "/",
  "/elo.html",
  "/stockfull.html",
  "/cadista/",
  "/relatorio-qualidade-obras/"
];
const allRoutes = Array.from(new Set(requiredRoutes.concat(htmlFiles.map((file) => routeFor(file.relativePath)))));

test("all public HTML files load the shared gate and temporary noindex", () => {
  const missing = [];

  for (const file of htmlFiles) {
    const content = readFileSync(file.fullPath, "utf8");
    const hasLock = content.includes("document.documentElement.classList.add('site-access-locked');");
    const hasCss = content.includes('href="/assets/site-access-gate.css?v=20260710-access-v2"');
    const hasJs = content.includes('src="/assets/site-access-gate.js?v=20260710-access-v2"');
    const hasRobots = content.includes(requiredRobots);
    const robotsCount = (content.match(/<meta\s+name=["']robots["'][^>]*>/gi) || []).length;
    if (!hasLock || !hasCss || !hasJs || !hasRobots || robotsCount !== 1) {
      missing.push(file.relativePath);
    }
  }

  expect(missing, `HTML sem gate/noindex correto: ${missing.join(", ")}`).toEqual([]);
});

test("gate script uses sessionStorage and only clears the old localStorage session", () => {
  const source = readFileSync(join(process.cwd(), "assets", "site-access-gate.js"), "utf8");
  const localStorageMatches = source.match(/localStorage/g) || [];

  expect(source).toContain("window.sessionStorage.getItem(STORAGE_KEY)");
  expect(source).toContain("window.sessionStorage.setItem(STORAGE_KEY");
  expect(source).toContain("window.sessionStorage.removeItem(STORAGE_KEY)");
  expect(source).toContain("window.localStorage.removeItem(STORAGE_KEY)");
  expect(localStorageMatches.length).toBe(1);
  expect(source).toContain("window.logoutSite");
  expect(source).toContain("SESSION_TTL_MS");
  expect(source).toContain("expiresAt");
  expect(source).not.toContain(password);
});

test("password unlocks routes, logout locks again, and new browser context asks again", async ({ browser, page }) => {
  await stubExternalCheckout(page);

  await page.goto("/", { waitUntil: "commit" });
  await page.evaluate((key) => {
    window.localStorage.setItem(key, "legacy-bad-session");
    window.sessionStorage.removeItem(key);
  }, storageKey);
  await page.reload({ waitUntil: "commit" });
  await expect(page.locator(".site-access-gate")).toBeVisible();
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull();

  await page.locator(".site-access-gate input[name='password']").fill(password);
  await page.locator(".site-access-gate button[type='submit']").click();
  await expect(page.locator(".site-access-gate")).toBeHidden();

  await expect.poll(() => page.evaluate((key) => Boolean(window.sessionStorage.getItem(key)), storageKey)).toBe(true);
  await expect.poll(() => page.evaluate((key) => window.localStorage.getItem(key), storageKey)).toBeNull();

  for (const route of allRoutes) {
    await page.goto(route, { waitUntil: "commit" });
    if (route === checkoutRoute) {
      await expect.poll(() => page.url()).toContain("mercadopago.com.br");
      continue;
    }
    await expect(page.locator(".site-access-gate")).toBeHidden();
  }

  await page.goto("/", { waitUntil: "commit" });
  await expect.poll(() => page.evaluate(() => typeof window.logoutSite === "function")).toBe(true);
  await page.evaluate(() => window.logoutSite());
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator(".site-access-gate")).toBeVisible();
  await expect.poll(() => page.evaluate((key) => window.sessionStorage.getItem(key), storageKey)).toBeNull();

  const freshContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const freshPage = await freshContext.newPage();
  await stubExternalCheckout(freshPage);
  await freshPage.goto("/", { waitUntil: "commit" });
  await expect(freshPage.locator(".site-access-gate")).toBeVisible();
  await freshContext.close();
});
