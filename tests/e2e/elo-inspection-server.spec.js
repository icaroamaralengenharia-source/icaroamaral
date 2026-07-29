import { expect, test } from "@playwright/test";
import { spawn } from "node:child_process";

const ELO_PORT = 5610;
const ELO_BASE_URL = `http://127.0.0.1:${ELO_PORT}`;
const OBRAREPORT_BASE_URL = "http://127.0.0.1:5541";

let serverProcess;

async function waitForServer(url) {
  const deadline = Date.now() + 30_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw lastError || new Error("Servidor de inspecao nao respondeu.");
}

test.beforeAll(async () => {
  serverProcess = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--config", "vite.elo.config.js", "--host", "127.0.0.1", "--port", String(ELO_PORT), "--strictPort"], {
    cwd: process.cwd(),
    env: { ...process.env, BROWSER: "none" },
    stdio: "pipe"
  });
  await waitForServer(`${ELO_BASE_URL}/elo.html`);
});

test.afterAll(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
  }
});

test("servidor de inspecao serve ELO multipagina sem fallback do ObraReport", async ({ page, request }) => {
  await page.addInitScript(() => {
    window.OBRAREPORT_API_BASE_URL = "https://sentinel.local";
    window.ELO_SENTINEL_UI_ENABLED = "true";
    window.ELO_SENTINEL_AUTH_TOKEN = "sentinel.header.payload";
    window.ELO_SENTINEL_ACTIVE_CONTEXT = {
      institutionId: "inst-a",
      companyId: "company-a",
      projectId: "obra-a",
      workId: "work-a",
      companyName: "Empresa A",
      projectName: "Obra A"
    };
  });

  await page.route("https://sentinel.local/api/elo/sentinel/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname.replace("/api/elo/sentinel", "");
    if (path === "/evidences") return route.fulfill({ json: { ok: true, evidences: [] } });
    if (path === "/timeline") return route.fulfill({ json: { ok: true, events: [] } });
    if (path === "/pending-items") return route.fulfill({ json: { ok: true, pending_items: [] } });
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  const navigations = [];
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });

  await page.goto(`${ELO_BASE_URL}/elo.html`, { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle("ELO CORE | Pergunte ao ELO");
  await expect(page.getByRole("button", { name: "Conversa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sentinela" })).toBeVisible();
  await page.getByRole("button", { name: "Sentinela" }).click();
  await expect(page.locator("[data-elo-sentinel-context-title]")).toHaveText("Obra A");
  expect(page.url()).toBe(`${ELO_BASE_URL}/elo.html`);
  expect(navigations.some((url) => url.includes("/relatorio-qualidade-obras/relatorio-qualidade-obras.html"))).toBe(false);

  const eloHtml = await request.get(`${ELO_BASE_URL}/elo.html`);
  expect(await eloHtml.text()).toContain("ELO CORE | Pergunte ao ELO");

  const obraReport = await request.get(`${OBRAREPORT_BASE_URL}/relatorio-qualidade-obras.html`);
  expect(obraReport.ok()).toBe(true);
  expect(await obraReport.text()).toContain("ObraReport");
});
