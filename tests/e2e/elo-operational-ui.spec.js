import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const eloUrl = pathToFileURL(resolve("elo.html")).href;

function installOperationalInit(page, overrides = {}) {
  return page.addInitScript((values) => {
    window.OBRAREPORT_API_BASE_URL = "https://operational.local";
    window.ELO_SENTINEL_UI_ENABLED = values.enabled ? "true" : "false";
    window.ELO_ARCHIVE_UI_ENABLED = values.enabled ? "true" : "false";
    window.ELO_SENTINEL_AUTH_TOKEN = "sentinel.header.payload";
    window.ELO_ARCHIVE_AUTH_TOKEN = "sentinel.header.payload";
    if (values.context !== false) {
      window.ELO_SENTINEL_ACTIVE_CONTEXT = {
        institutionId: "inst-a",
        companyId: "company-a",
        projectId: "obra-a",
        companyName: "Empresa A",
        projectName: "Obra A"
      };
    }
  }, { enabled: overrides.enabled !== false, context: overrides.context });
}

async function exposeElo(page) {
  await page.evaluate(() => {
    document.body.classList.remove("elo-auth-required");
    document.body.classList.remove("elo-local-readonly");
  });
}

function createOperationalMock(page) {
  const calls = [];
  const pending = [{
    id: "pending-1",
    title: "Corrigir fissura",
    description: "Executar tratamento e recomposicao.",
    status: "open",
    priority: "high",
    severity: "major",
    responsible_user_id: "eng-a",
    due_at: "2026-08-02T12:00:00.000Z"
  }];
  const events = [{
    id: "event-1",
    event_type: "pending_item_created",
    source_module: "sentinel",
    title: "Pendencia criada",
    description: "Registro da pendencia operacional.",
    occurred_at: "2026-07-30T10:00:00.000Z"
  }];
  const archive = [{
    id: "archive-1",
    title: "RDO concreto",
    document_type: "rdo",
    source_module: "rdo",
    occurred_at: "2026-07-30T09:00:00.000Z",
    file_reference: { kind: "endpoint", endpoint: "/api/obrareport/documents/doc-1" }
  }];

  page.route("https://operational.local/api/elo/sentinel/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/elo/sentinel", "");
    calls.push({ method: request.method(), path, search: url.search });
    if (request.method() === "GET" && path === "/evidences") return route.fulfill({ json: { ok: true, evidences: [] } });
    if (request.method() === "GET" && path === "/timeline") return route.fulfill({ json: { ok: true, events } });
    if (request.method() === "GET" && path === "/pending-items") return route.fulfill({ json: { ok: true, pending_items: pending } });
    if (request.method() === "GET" && path === "/pending-items/pending-1") return route.fulfill({ json: { ok: true, pending_item: pending[0], events } });
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  page.route("https://operational.local/api/elo/projects/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), path: url.pathname, search: url.search });
    expect(url.pathname).toContain("/api/elo/projects/obra-a/");
    if (request.method() === "GET" && url.pathname.endsWith("/timeline")) return route.fulfill({ json: { ok: true, events } });
    if (request.method() === "GET" && url.pathname.endsWith("/archive")) return route.fulfill({ json: { ok: true, items: archive, warnings: [] } });
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  return { calls, pending, events, archive };
}

test.describe("ELO interface operacional", () => {
  test("flag desligada mantem area operacional invisivel e sem fetch", async ({ page }) => {
    await installOperationalInit(page, { enabled: false });
    let calls = 0;
    await page.route("https://operational.local/api/elo/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await expect(page.getByRole("button", { name: "Operacional" })).toBeHidden();
    expect(calls).toBe(0);
  });

  test("navega por visao geral, pendencias, timeline e acervo em modo somente leitura", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    const mock = createOperationalMock(page);
    const opened = [];
    await page.exposeFunction("captureOpen", (url) => opened.push(url));
    await page.addInitScript(() => {
      window.open = (url) => window.captureOpen(url);
    });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);

    await page.getByRole("button", { name: "Operacional" }).click();
    const operationalRoot = page.locator("[data-elo-operational-root]");
    await expect(page.locator("[data-elo-operational-title]")).toHaveText("Obra A");
    await expect(operationalRoot.getByText("Pendencias abertas")).toBeVisible();
    await expect(operationalRoot.getByText("Alta: 1")).toBeVisible();
    await expect(operationalRoot.getByText("Pendencia criada").first()).toBeVisible();
    await expect(operationalRoot.getByText("RDO concreto").first()).toBeVisible();

    await page.locator("[data-elo-operational-view='pending']").click();
    await page.locator("[data-elo-operational-pending-form] select[name='priority']").selectOption("high");
    await page.locator("[data-elo-operational-pending-form]").getByRole("button", { name: "Filtrar" }).click();
    await page.locator("[data-elo-operational-pending-id='pending-1']").click();
    await expect(page.locator("[data-elo-operational-detail]")).toContainText("Executar tratamento");

    await page.locator("[data-elo-operational-view='timeline']").click();
    await expect(page.locator("[data-elo-operational-timeline-list]")).toContainText("Sentinela");

    await page.locator("[data-elo-operational-view='archive']").click();
    await expect(page.locator("[data-elo-operational-archive-list]")).toContainText("Obra A");
    await page.locator("[data-elo-operational-archive-list]").getByRole("button", { name: "Abrir" }).click();
    expect(opened[0]).toBe("https://operational.local/api/obrareport/documents/doc-1");
    expect(mock.calls.some((call) => call.path.includes("/archive"))).toBe(true);
    expect(mock.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test("mantem navegacao operacional legivel no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installOperationalInit(page, { enabled: true });
    createOperationalMock(page);
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.getByRole("button", { name: "Visao geral" })).toBeVisible();
    await expect(page.getByText("Pendencias abertas")).toBeVisible();
    await expect(page.locator("[data-elo-operational-root]")).toBeVisible();
  });
});
