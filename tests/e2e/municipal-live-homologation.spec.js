import { expect, test } from "@playwright/test";
import { createReadStream, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";
import {
  LIVE_PREFIX,
  apiJson,
  createMunicipalLiveFixture,
  makeLiveName,
  stopMunicipalLiveFixture
} from "../../backend/tests/municipal-e2e-live-fixture.js";

const STATIC_PORT = Number(process.env.MUNICIPAL_E2E_STATIC_PORT || 5583);
const pageUrl = `http://127.0.0.1:${STATIC_PORT}/municipal-admin.html`;
let staticServer = null;


function contentType(file) {
  const ext = extname(file).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
}

async function ensureStaticServer() {
  if (staticServer) return;
  const root = resolve(".");
  staticServer = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${STATIC_PORT}`);
    const requested = decodeURIComponent(url.pathname === "/" ? "/municipal-admin.html" : url.pathname);
    const file = resolve(join(root, requested.replace(/^\/+/, "")));
    if (!file.startsWith(root) || !existsSync(file)) {
      response.writeHead(404).end("not_found");
      return;
    }
    response.writeHead(200, { "content-type": contentType(file) });
    createReadStream(file).pipe(response);
  });
  await new Promise((resolveListen) => staticServer.listen(STATIC_PORT, "127.0.0.1", resolveListen));
}

function diagnostic(fx, route, status, data = {}) {
  const recipient = fx.profiles.gestor;
  return JSON.stringify({
    route,
    status,
    actor_role: fx.profiles.platform.role,
    actor_category: "platform_admin_e2e",
    recipient_role: recipient.role,
    institution_compatible: recipient.institution_id === fx.institution.id,
    unit_compatible: recipient.unit_id === fx.unitA.id,
    error: data && data.error ? String(data.error) : undefined
  });
}

test.beforeAll(async () => ensureStaticServer());

test.afterAll(async () => {
  stopMunicipalLiveFixture();
  if (staticServer) await new Promise((resolveClose) => staticServer.close(resolveClose));
  staticServer = null;
});

async function installLiveSession(page, fx, role = "platform") {
  await page.addInitScript(({ baseUrl, token }) => {
    window.OBRAREPORT_API_BASE_URL = baseUrl;
    window.MUNICIPAL_ADMIN_AUTH_TOKEN = token;
  }, { baseUrl: fx.backendBaseUrl, token: fx.tokens[role] });
}

test("painel municipal integrado homologa dados reais do E2E", async ({ page }) => {
  const fx = await createMunicipalLiveFixture();
  const tag = makeLiveName("UI_TOMBAMENTO");
  const asset = await apiJson(fx, "platform", "POST", "/api/municipal-admin/assets", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    asset_tag: tag,
    name: `${LIVE_PREFIX}UI_BEM`,
    category: `${LIVE_PREFIX}UI_CATEGORIA`,
    condition: "ruim",
    status: "ativo",
    location: `${LIVE_PREFIX}UI_LOCAL`
  });
  expect(asset.status).toBe(200);
  const notification = await apiJson(fx, "platform", "POST", "/api/municipal-admin/notifications/dispatch", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    recipient_user_id: fx.profiles.gestor.auth_user_id,
    channel: "in_app",
    source_type: "manual",
    source_id: makeLiveName("UI_SOURCE"),
    title: `${LIVE_PREFIX}UI_NOTIFICACAO`,
    severity: "high",
    deduplication_key: makeLiveName("UI_DEDUP")
  });
  expect(notification.status, diagnostic(fx, "/api/municipal-admin/notifications/dispatch", notification.status, notification.data)).toBe(200);

  await installLiveSession(page, fx, "platform");
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Visao Geral", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Notificacoes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Patrimonio", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Patrimonio", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(tag);
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(`${LIVE_PREFIX}UI_BEM`);

  await page.getByRole("button", { name: "Notificacoes", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(`${LIVE_PREFIX}UI_NOTIFICACAO`);
  await expect(page.locator("[data-municipal-admin-root]")).toContainText("Email e WhatsApp permanecem desativados");

  await page.getByRole("button", { name: "Sentinela", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(/Sentinela|Alertas/i);

  await page.getByRole("button", { name: "Relatorios", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(/Relatorio|Preview|Tipos/i);

  await page.getByRole("button", { name: "Acervo", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(/Acervo|Documento/i);

  await page.getByRole("button", { name: "Assistente ELO", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText("Perguntar ao ELO");

  await page.context().setOffline(true);
  await page.getByRole("button", { name: "Patrimonio", exact: true }).click();
  await expect(page.locator("[data-municipal-admin-root]")).toContainText(/offline|sincronizados/i);
  await page.context().setOffline(false);
});

for (const viewport of [
  { name: "desktop", width: 1366, height: 768 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "celular", width: 390, height: 844 }
]) {
  test(`painel municipal integrado responsivo ${viewport.name}`, async ({ page }) => {
    const fx = await createMunicipalLiveFixture();
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await installLiveSession(page, fx, "platform");
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Administracao Municipal");
    await expect(page.getByRole("button", { name: "Visao Geral", exact: true })).toBeVisible();
  });
}
