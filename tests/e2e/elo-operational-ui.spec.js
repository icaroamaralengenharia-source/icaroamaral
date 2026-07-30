import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const eloUrl = pathToFileURL(resolve("elo.html")).href;

function installOperationalInit(page, overrides = {}) {
  return page.addInitScript((values) => {
    window.OBRAREPORT_API_BASE_URL = "https://operational.local";
    window.ELO_SENTINEL_UI_ENABLED = values.enabled ? "true" : "false";
    window.ELO_ARCHIVE_UI_ENABLED = values.enabled ? "true" : "false";
    if (values.token !== false) {
      window.ELO_SENTINEL_AUTH_TOKEN = "sentinel.header.payload";
      window.ELO_ARCHIVE_AUTH_TOKEN = "sentinel.header.payload";
    }
    if (values.context !== false) {
      window.ELO_SENTINEL_ACTIVE_CONTEXT = {
        institutionId: "inst-a",
        companyId: "company-a",
        projectId: "obra-a",
        companyName: "Empresa A",
        projectName: "Obra A"
      };
    }
  }, { enabled: overrides.enabled !== false, context: overrides.context, token: overrides.token });
}

async function exposeElo(page) {
  await page.evaluate(() => {
    document.body.classList.remove("elo-auth-required");
    document.body.classList.remove("elo-local-readonly");
  });
}

async function createOperationalMock(page, options = {}) {
  const calls = [];
  const pending = options.empty ? [] : [{
    id: "pending-1",
    title: "Corrigir fissura",
    description: "Executar tratamento e recomposicao.",
    status: "open",
    priority: "high",
    severity: "major",
    responsible_user_id: "eng-a",
    due_at: "2026-08-02T12:00:00.000Z",
    evidences: [{
      evidence_id: "evidence-1",
      evidence: {
        id: "evidence-1",
        title: "Foto da fissura",
        file_reference: { kind: "endpoint", endpoint: "/api/elo/sentinel/evidences/evidence-1/open" }
      }
    }]
  }];
  const events = options.empty ? [] : [{
    id: "event-1",
    event_type: "pending_item_created",
    source_module: "sentinel",
    title: "Pendencia criada",
    description: "Registro da pendencia operacional.",
    occurred_at: "2026-07-30T10:00:00.000Z"
  }];
  const archive = options.empty ? [] : [{
    id: "archive-1",
    title: "RDO concreto",
    document_type: "rdo",
    source_module: "rdo",
    occurred_at: "2026-07-30T09:00:00.000Z",
    file_reference: options.unsafeArchive
      ? { kind: "url", url: "javascript:alert(1)" }
      : { kind: "endpoint", endpoint: "/api/obrareport/documents/doc-1" }
  }];

  await page.route("https://operational.local/api/elo/sentinel/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/elo/sentinel", "");
    calls.push({ method: request.method(), path, search: url.search });
    if (options.denied && path !== "/evidences") return route.fulfill({ status: 403, json: { ok: false, error: "access_denied" } });
    if (request.method() === "GET" && path === "/evidences") return route.fulfill({ json: { ok: true, evidences: [] } });
    if (request.method() === "GET" && path === "/timeline") return route.fulfill({ json: { ok: true, events } });
    if (request.method() === "GET" && path === "/pending-items") return route.fulfill({ json: { ok: true, pending_items: pending } });
    if (request.method() === "GET" && path === "/pending-items/pending-1") return route.fulfill({ json: { ok: true, pending_item: pending[0], events } });
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  await page.route("https://operational.local/api/elo/projects/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    calls.push({ method: request.method(), path: url.pathname, search: url.search });
    expect(url.pathname).toContain("/api/elo/projects/obra-a/");
    if (options.denied) return route.fulfill({ status: 403, json: { ok: false, error: "access_denied" } });
    if (request.method() === "GET" && url.pathname.endsWith("/timeline")) return route.fulfill({ json: { ok: true, events } });
    if (request.method() === "GET" && url.pathname.endsWith("/archive")) {
      if (options.archiveUnavailable) return route.fulfill({ status: 503, json: { ok: false, error: "feature_disabled" } });
      return route.fulfill({ json: { ok: true, items: archive, warnings: [] } });
    }
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

  test("sem obra selecionada mostra estado seguro e nao busca dados", async ({ page }) => {
    await installOperationalInit(page, { enabled: true, context: false });
    let calls = 0;
    await page.route("https://operational.local/api/elo/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.locator("[data-elo-operational-root]")).toContainText("Selecione uma obra");
    expect(calls).toBe(0);
  });

  test("usuario sem token nao acessa dados operacionais", async ({ page }) => {
    await installOperationalInit(page, { enabled: true, token: false });
    let calls = 0;
    await page.route("https://operational.local/api/elo/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await expect(page.getByRole("button", { name: "Operacional" })).toBeHidden();
    expect(calls).toBe(0);
  });

  test("navega por visao geral, pendencias, timeline e acervo em modo somente leitura", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    const mock = await createOperationalMock(page);
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
    await expect(page.locator("[data-elo-operational-detail]")).toContainText("Evidencias vinculadas");
    await page.locator("[data-elo-operational-detail]").getByRole("button", { name: "Abrir evidencia" }).click();
    expect(opened[0]).toBe("https://operational.local/api/elo/sentinel/evidences/evidence-1/open");

    await page.locator("[data-elo-operational-view='timeline']").click();
    await expect(page.locator("[data-elo-operational-timeline-list]")).toContainText("Sentinela");

    await page.locator("[data-elo-operational-view='archive']").click();
    await expect(page.locator("[data-elo-operational-archive-list]")).toContainText("Obra A");
    await page.locator("[data-elo-operational-archive-list]").getByRole("button", { name: "Abrir" }).click();
    expect(opened[1]).toBe("https://operational.local/api/obrareport/documents/doc-1");
    expect(mock.calls.some((call) => call.path.includes("/archive"))).toBe(true);
    expect(mock.calls.some((call) => call.method !== "GET")).toBe(false);
  });

  test("APIs vazias exibem estados vazios sem erro", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    await createOperationalMock(page, { empty: true });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.locator("[data-elo-operational-status]")).toHaveText("Ativo");
    await expect(page.locator("[data-elo-operational-root]")).toContainText("Nenhuma pendencia aberta");
    await page.locator("[data-elo-operational-view='archive']").click();
    await expect(page.locator("[data-elo-operational-archive-list]")).toContainText("Nenhum registro encontrado");
  });

  test("uma API indisponivel nao derruba os demais modulos", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    await createOperationalMock(page, { archiveUnavailable: true });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.locator("[data-elo-operational-status]")).toHaveText("Parcial");
    await expect(page.locator("[data-elo-operational-root]").getByText("Pendencia criada").first()).toBeVisible();
    await page.locator("[data-elo-operational-view='archive']").click();
    await expect(page.locator("[data-elo-operational-archive-list]")).toContainText("Modulo indisponivel ou desligado");
  });

  test("acesso negado nao expõe dados operacionais", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    await createOperationalMock(page, { denied: true });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.locator("[data-elo-operational-status]")).toHaveText("Acesso negado");
    await expect(page.locator("[data-elo-operational-error]")).toContainText("Acesso negado");
    await expect(page.locator("[data-elo-operational-root]")).not.toContainText("Corrigir fissura");
  });

  test("bloqueia abertura insegura de item do Acervo", async ({ page }) => {
    await installOperationalInit(page, { enabled: true });
    await createOperationalMock(page, { unsafeArchive: true });
    const opened = [];
    await page.exposeFunction("captureOpen", (url) => opened.push(url));
    await page.addInitScript(() => {
      window.open = (url) => window.captureOpen(url);
    });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await page.locator("[data-elo-operational-view='archive']").click();
    await page.locator("[data-elo-operational-archive-list]").getByRole("button", { name: "Abrir" }).click();
    await expect(page.locator("[data-elo-operational-error]")).toContainText("sem abertura segura");
    expect(opened).toEqual([]);
  });

  test("mantem navegacao operacional legivel no mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installOperationalInit(page, { enabled: true });
    await createOperationalMock(page);
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Operacional" }).click();
    await expect(page.getByRole("button", { name: "Visao geral" })).toBeVisible();
    await expect(page.getByText("Pendencias abertas")).toBeVisible();
    await expect(page.locator("[data-elo-operational-root]")).toBeVisible();
  });
});