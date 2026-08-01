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


test("painel municipal live fecha ressalva offline logout troca de usuario", async ({ page, context }) => {
  const fx = await createMunicipalLiveFixture();
  expect(fx.projectRef).toBe("mplpzyalcxhhinuvjthx");

  const tag = makeLiveName("OFFLINE_TOMBAMENTO");
  const asset = await apiJson(fx, "platform", "POST", "/api/municipal-admin/assets", {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    asset_tag: tag,
    name: `${LIVE_PREFIX}OFFLINE_BEM`,
    category: `${LIVE_PREFIX}OFFLINE_CATEGORIA`,
    condition: "bom",
    status: "ativo",
    location: `${LIVE_PREFIX}OFFLINE_LOCAL`,
    responsible_user_id: fx.profiles.gestor.auth_user_id
  });
  expect(asset.status, JSON.stringify(asset.data)).toBe(200);

  const scopeA = {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    user_id: fx.profiles.gestor.auth_user_id
  };
  const scopeB = {
    institution_id: fx.institution.id,
    unit_id: fx.unitA.id,
    user_id: fx.profiles.leitura.auth_user_id
  };
  const otherUnitScope = {
    institution_id: fx.institution.id,
    unit_id: fx.unitB.id,
    user_id: fx.profiles.gestor.auth_user_id
  };
  const otherInstitutionScope = {
    institution_id: "institution-forbidden-local-check",
    unit_id: fx.unitA.id,
    user_id: fx.profiles.gestor.auth_user_id
  };

  await installLiveSession(page, fx, "gestor");
  await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-municipal-admin-root]")).toContainText("Administracao Municipal");

  const synced = await page.evaluate(async ({ apiBase, scope, token, tag }) => {
    const store = window.MunicipalAssetOfflineStore.create({ apiBase });
    const cache = await store.sync(scope, { token });
    return {
      scope: cache.scope,
      last_synced_at: cache.last_synced_at,
      found: store.search(scope, { asset_tag: tag }).map((item) => item.asset_tag),
      raw: JSON.stringify(window.localStorage)
    };
  }, { apiBase: fx.backendBaseUrl, scope: scopeA, token: fx.tokens.gestor, tag });
  expect(synced.scope).toEqual(scopeA);
  expect(synced.last_synced_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(synced.found).toContain(tag);
  expect(synced.raw).not.toContain(fx.tokens.gestor);
  expect(synced.raw).not.toContain(fx.tokens.leitura);
  expect(synced.raw).not.toContain("lidueokjpzxdybtongbk");

  await page.route(`${fx.backendBaseUrl}/api/municipal-admin/assets**`, (route) => route.abort());
  await context.setOffline(true);
  const offline = await page.evaluate(async ({ apiBase, scope, tag }) => {
    const store = window.MunicipalAssetOfflineStore.create({ apiBase });
    const failedSync = await store.sync(scope);
    let writeError = "";
    try {
      store.transferOffline();
    } catch (error) {
      writeError = error && error.message;
    }
    return {
      online: failedSync.online,
      status: store.status(scope, false),
      found: store.search(scope, { asset_tag: tag }).map((item) => item.asset_tag),
      writeError
    };
  }, { apiBase: fx.backendBaseUrl, scope: scopeA, tag });
  expect(offline.online).toBe(false);
  expect(offline.status).toBe("offline");
  expect(offline.found).toContain(tag);
  expect(offline.writeError).toBe("asset_offline_write_forbidden");

  const afterLogout = await page.evaluate(({ apiBase, scopeA, scopeB, otherUnitScope, otherInstitutionScope, userId, tag }) => {
    const store = window.MunicipalAssetOfflineStore.create({ apiBase });
    store.invalidateUser(userId);
    return {
      userA: store.search(scopeA, { asset_tag: tag }).length,
      userB: store.search(scopeB, { asset_tag: tag }).length,
      otherUnit: store.search(otherUnitScope, { asset_tag: tag }).length,
      otherInstitution: store.search(otherInstitutionScope, { asset_tag: tag }).length,
      raw: JSON.stringify(window.localStorage)
    };
  }, {
    apiBase: fx.backendBaseUrl,
    scopeA,
    scopeB,
    otherUnitScope,
    otherInstitutionScope,
    userId: scopeA.user_id,
    tag
  });
  expect(afterLogout.userA).toBe(0);
  expect(afterLogout.userB).toBe(0);
  expect(afterLogout.otherUnit).toBe(0);
  expect(afterLogout.otherInstitution).toBe(0);
  expect(afterLogout.raw).not.toContain(tag);
  expect(afterLogout.raw).not.toContain("lidueokjpzxdybtongbk");

  await context.setOffline(false);
  await page.unroute(`${fx.backendBaseUrl}/api/municipal-admin/assets**`);
  const resynced = await page.evaluate(async ({ apiBase, scope, token, tag }) => {
    const store = window.MunicipalAssetOfflineStore.create({ apiBase });
    const cache = await store.sync(scope, { token });
    return {
      online: cache.online,
      found: store.search(scope, { asset_tag: tag }).map((item) => item.asset_tag),
      raw: JSON.stringify(window.localStorage)
    };
  }, { apiBase: fx.backendBaseUrl, scope: scopeA, token: fx.tokens.gestor, tag });
  expect(resynced.online).toBe(true);
  expect(resynced.found).toContain(tag);
  expect(resynced.raw).not.toContain(fx.tokens.gestor);
  expect(resynced.raw).not.toContain("lidueokjpzxdybtongbk");
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
