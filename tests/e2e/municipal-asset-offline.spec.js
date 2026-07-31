import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(resolve("municipal-admin.html")).href;
const offlineStorePath = resolve("relatorio-qualidade-obras/municipal-asset-offline-store.js");

const scope = { institution_id: "inst-a", unit_id: "unit-a", user_id: "gestor-a" };

async function loadStore(page, assetName = "Mesa offline") {
  await page.goto(pageUrl);
  await page.addScriptTag({ path: offlineStorePath });
  let requestCount = 0;
  await page.route("https://municipal.local/api/municipal-admin/assets**", async (route) => {
    requestCount += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        sync_cursor: "2026-01-02T00:00:00.000Z",
        assets: [
          { id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-001", name: assetName, category: "mobiliario", condition: "ruim", status: "ativo", location: "Sala 1", responsible_user_id: "", updated_at: "2026-01-02T00:00:00.000Z" },
          { id: "asset-a2", institution_id: "inst-a", unit_id: "unit-a2", asset_tag: "PAT-002", name: "Unidade externa", category: "mobiliario", condition: "bom", status: "ativo", updated_at: "2026-01-02T00:00:00.000Z" },
          { id: "asset-b", institution_id: "inst-b", unit_id: "unit-b", asset_tag: "B-001", name: "Tenant B", category: "mobiliario", condition: "bom", status: "ativo", updated_at: "2026-01-02T00:00:00.000Z", token: "NAO_ARMAZENAR" }
        ],
        history: [
          { id: "hist-a", asset_id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", action: "asset_transferred", created_at: "2026-01-02T00:00:00.000Z" },
          { id: "hist-b", asset_id: "asset-b", institution_id: "inst-b", unit_id: "unit-b", action: "asset_transferred", created_at: "2026-01-02T00:00:00.000Z" }
        ]
      })
    });
  });
  await page.evaluate(async ({ scope }) => {
    window.assetStore = window.MunicipalAssetOfflineStore.create({ apiBase: "https://municipal.local", now: () => new Date("2026-01-03T00:00:00.000Z") });
    await window.assetStore.sync(scope, { token: "TOKEN_SECRETO" });
  }, { scope });
  return { getRequestCount: () => requestCount };
}

test("consulta patrimonio sem internet e busca por tombamento offline", async ({ page, context }) => {
  await loadStore(page);
  await context.setOffline(true);
  const result = await page.evaluate(({ scope }) => ({
    byTag: window.assetStore.search(scope, { q: "PAT-001" }),
    detail: window.assetStore.getAsset(scope, "asset-a"),
    history: window.assetStore.getHistory(scope, "asset-a"),
    status: window.assetStore.status(scope, false),
    raw: JSON.stringify(localStorage)
  }), { scope });
  expect(result.byTag).toHaveLength(1);
  expect(result.detail.condition).toBe("ruim");
  expect(result.detail.location).toBe("Sala 1");
  expect(result.history).toHaveLength(1);
  expect(result.status).toBe("offline");
  expect(result.raw).not.toContain("TOKEN_SECRETO");
});

test("ELO offline responde com data da ultima sincronizacao", async ({ page, context }) => {
  await loadStore(page);
  await context.setOffline(true);
  const answer = await page.evaluate(({ scope }) => window.assetStore.answerEloOffline(scope, "localize tombamento PAT-001"), { scope });
  expect(answer).toContain("Resposta baseada nos dados disponíveis offline, sincronizados em 2026-01-03T00:00:00.000Z");
  expect(answer).toContain("PAT-001");
});

test("cache nao mistura tenants nem unidade nao autorizada", async ({ page, context }) => {
  await loadStore(page);
  await context.setOffline(true);
  const result = await page.evaluate(({ scope }) => ({
    all: window.assetStore.search(scope),
    externalUnit: window.assetStore.search(Object.assign({}, scope, { unit_id: "unit-a2" })),
    otherTenant: window.assetStore.search(Object.assign({}, scope, { institution_id: "inst-b", unit_id: "unit-b" }))
  }), { scope });
  expect(result.all.map((item) => item.asset_tag)).toEqual(["PAT-001"]);
  expect(result.externalUnit).toHaveLength(0);
  expect(result.otherTenant).toHaveLength(0);
});

test("logout invalida cache e escrita offline e bloqueada", async ({ page, context }) => {
  await loadStore(page);
  await context.setOffline(true);
  const result = await page.evaluate(({ scope }) => {
    let writeError = "";
    try { window.assetStore.transferOffline(); } catch (err) { writeError = err.message; }
    window.assetStore.invalidateUser("gestor-a");
    return { writeError, remaining: window.assetStore.search(scope) };
  }, { scope });
  expect(result.writeError).toBe("asset_offline_write_forbidden");
  expect(result.remaining).toHaveLength(0);
});

test("retorno da conexao atualiza dados e falha de sync preserva cache valido", async ({ page, context }) => {
  const state = await loadStore(page, "Mesa offline");
  await context.setOffline(false);
  await page.unroute("https://municipal.local/api/municipal-admin/assets**");
  await page.route("https://municipal.local/api/municipal-admin/assets**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, sync_cursor: "2026-01-04T00:00:00.000Z", assets: [{ id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-001", name: "Mesa atualizada", category: "mobiliario", condition: "bom", status: "ativo", location: "Sala 2", updated_at: "2026-01-04T00:00:00.000Z" }], history: [] })
    });
  });
  await page.evaluate(async ({ scope }) => window.assetStore.sync(scope), { scope });
  const updated = await page.evaluate(({ scope }) => window.assetStore.getAsset(scope, "asset-a"), { scope });
  expect(updated.name).toBe("Mesa atualizada");
  await page.unroute("https://municipal.local/api/municipal-admin/assets**");
  await context.setOffline(true);
  const preserved = await page.evaluate(async ({ scope }) => {
    await window.assetStore.sync(scope);
    return window.assetStore.getAsset(scope, "asset-a");
  }, { scope });
  expect(preserved.name).toBe("Mesa atualizada");
  expect(state.getRequestCount()).toBeGreaterThan(0);
});
