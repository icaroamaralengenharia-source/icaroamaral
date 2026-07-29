import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const eloUrl = pathToFileURL(resolve("elo.html")).href;

function installSentinelInit(page, overrides = {}) {
  return page.addInitScript((values) => {
    window.OBRAREPORT_API_BASE_URL = "https://sentinel.local";
    window.ELO_SENTINEL_UI_ENABLED = values.enabled ? "true" : "false";
    window.ELO_SENTINEL_AUTH_TOKEN = "sentinel.header.payload";
    window.confirm = () => true;
    if (values.context !== false) {
      window.ELO_SENTINEL_ACTIVE_CONTEXT = {
        institutionId: "inst-a",
        companyId: "company-a",
        projectId: "obra-a",
        workId: "work-a",
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

function createSentinelMock(page) {
  const calls = [];
  const state = {
    evidences: [],
    pending: [],
    events: []
  };

  function event(type, title) {
    state.events.unshift({ id: `event-${state.events.length + 1}`, event_type: type, title, occurred_at: "2026-07-29T12:00:00.000Z" });
  }

  page.route("https://sentinel.local/api/elo/sentinel/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/elo/sentinel", "");
    const method = request.method();
    const body = method === "GET" ? null : JSON.parse(request.postData() || "{}");
    calls.push({ method, path, body });

    if (method === "GET" && path === "/evidences") {
      expect(url.searchParams.get("projectId")).toBe("obra-a");
      return route.fulfill({ json: { ok: true, evidences: state.evidences } });
    }
    if (method === "GET" && path === "/timeline") {
      expect(url.searchParams.get("projectId")).toBe("obra-a");
      return route.fulfill({ json: { ok: true, events: state.events } });
    }
    if (method === "GET" && path === "/pending-items") {
      expect(url.searchParams.get("projectId")).toBe("obra-a");
      return route.fulfill({ json: { ok: true, pending_items: state.pending } });
    }
    if (method === "POST" && path === "/evidences") {
      expect(body.project_id).toBe("obra-a");
      expect(body.source).toBe("manual");
      expect(body.idempotency_key).toBeTruthy();
      expect(body.company_id).toBeUndefined();
      expect(body.institution_id).toBeUndefined();
      const evidence = { id: `evidence-${state.evidences.length + 1}`, evidence_type: "text", source: "manual", title: body.title, description: body.description };
      state.evidences.unshift(evidence);
      event("evidence_created", "Evidência criada");
      return route.fulfill({ json: { ok: true, evidence } });
    }
    if (method === "POST" && path === "/pending-items") {
      expect(body.project_id).toBe("obra-a");
      expect(body.company_id).toBeUndefined();
      expect(body.institution_id).toBeUndefined();
      expect(body.status).toBeUndefined();
      expect(body.resolved).toBeUndefined();
      expect(body.validated_by).toBeUndefined();
      const pending = { id: `pending-${state.pending.length + 1}`, title: body.title, description: body.description, category: body.category, priority: body.priority, severity: body.severity, status: "suggested", links: [] };
      state.pending.unshift(pending);
      event("pending_item_created", "Pendência criada");
      return route.fulfill({ json: { ok: true, pending_item: pending } });
    }
    const pendingEvidence = path.match(/^\/pending-items\/([^/]+)\/evidences$/);
    if (method === "POST" && pendingEvidence) {
      expect(body.project_id).toBe("obra-a");
      expect(body.relation_type).toBe("correction");
      const pending = state.pending.find((item) => item.id === pendingEvidence[1]);
      pending.links.push({ evidence_id: body.evidence_id, relation_type: "correction" });
      pending.has_correction = true;
      event("pending_item_evidence_linked", "Correção vinculada");
      return route.fulfill({ json: { ok: true, pending_item: pending } });
    }
    const validate = path.match(/^\/pending-items\/([^/]+)\/validate$/);
    if (method === "POST" && validate) {
      expect(body.project_id).toBe("obra-a");
      expect(body.decision).toBe("approved");
      const pending = state.pending.find((item) => item.id === validate[1]);
      expect(pending.has_correction).toBe(true);
      pending.status = "resolved";
      pending.validation_status = "approved";
      pending.validated_by = "user-a";
      pending.validated_at = "2026-07-29T12:05:00.000Z";
      event("pending_item_validated", "Validação humana aprovada");
      return route.fulfill({ json: { ok: true, pending_item: pending } });
    }
    const update = path.match(/^\/pending-items\/([^/]+)$/);
    if (method === "PUT" && update) {
      expect(body.project_id).toBe("obra-a");
      expect(body.status).not.toBe("resolved");
      const pending = state.pending.find((item) => item.id === update[1]);
      pending.status = body.status;
      event("pending_item_status_changed", `Status ${body.status}`);
      return route.fulfill({ json: { ok: true, pending_item: pending } });
    }

    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  return { calls, state };
}

test.describe("ELO Sentinela UI", () => {
  test("flag desligada mantém Sentinela invisível e sem fetch", async ({ page }) => {
    await installSentinelInit(page, { enabled: false });
    let calls = 0;
    await page.route("https://sentinel.local/api/elo/sentinel/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await expect(page.locator("[data-elo-sentinel-mode-switch]")).toBeHidden();
    expect(calls).toBe(0);
  });

  test("sem obra ativa mostra aviso e não consulta Sentinela", async ({ page }) => {
    await installSentinelInit(page, { enabled: true, context: false });
    let calls = 0;
    await page.route("https://sentinel.local/api/elo/sentinel/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await page.getByRole("button", { name: "Sentinela" }).click();
    await expect(page.getByText("Selecione uma obra para usar o Sentinela.")).toBeVisible();
    expect(calls).toBe(0);
  });

  test("executa evidência, timeline, pendência, correção e validação humana", async ({ page }) => {
    await installSentinelInit(page, { enabled: true });
    const mock = createSentinelMock(page);
    await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
    await exposeElo(page);
    await expect(page.getByRole("button", { name: "Sentinela" })).toBeVisible();
    await page.getByRole("button", { name: "Sentinela" }).click();
    await expect(page.getByText("Obra A")).toBeVisible();

    await page.locator("[data-elo-sentinel-evidence-form] input[name='title']").fill("Fissura na fachada");
    await page.locator("[data-elo-sentinel-evidence-form] textarea[name='description']").fill("Trinca horizontal próxima ao peitoril.");
    await page.getByRole("button", { name: "Registrar evidência" }).click();
    await expect(page.getByText("Fissura na fachada")).toBeVisible();
    await expect(page.getByText("Evidência criada")).toBeVisible();

    await page.getByText("Fissura na fachada").click();
    await page.locator("[data-elo-sentinel-pending-form] input[name='title']").fill("Corrigir fissura");
    await page.locator("[data-elo-sentinel-pending-form] textarea[name='description']").fill("Executar abertura, tratamento e recomposição.");
    await page.getByRole("button", { name: "Criar pendência" }).click();
    await expect(page.getByText("Corrigir fissura")).toBeVisible();

    await page.getByText("Corrigir fissura").click();
    await page.getByRole("button", { name: "Atualizar status" }).click();
    await expect(page.getByText("open · normal · medium")).toBeVisible();
    await page.getByText("Corrigir fissura").click();
    await page.getByRole("button", { name: "Atualizar status" }).click();
    await expect(page.getByText("in_progress · normal · medium")).toBeVisible();

    await page.locator("[data-elo-sentinel-evidence-form] input[name='title']").fill("Correção executada");
    await page.locator("[data-elo-sentinel-evidence-form] textarea[name='description']").fill("Tratamento concluído e área recomposta.");
    await page.getByRole("button", { name: "Registrar evidência" }).click();
    await page.getByText("Correção executada").click();
    await page.getByText("Corrigir fissura").click();
    await page.getByRole("button", { name: "Vincular correção" }).click();
    await expect(page.getByText("Correção vinculada")).toBeVisible();
    await page.getByText("Corrigir fissura").click();
    await page.locator("[data-elo-sentinel-status-select]").selectOption("awaiting_validation");
    await page.getByRole("button", { name: "Atualizar status" }).click();
    await expect(page.getByText("awaiting_validation · normal · medium")).toBeVisible();

    await page.getByText("Corrigir fissura").click();
    await page.getByRole("button", { name: "Aprovar" }).click();
    await expect(page.getByText("resolved · normal · medium")).toBeVisible();
    expect(mock.state.pending[0].validation_status).toBe("approved");
    expect(mock.state.pending[0].validated_by).toBe("user-a");
    expect(mock.state.pending[0].validated_at).toBeTruthy();
    expect(mock.calls.some((call) => call.method === "POST" && call.path === "/evidences")).toBe(true);
    expect(mock.calls.some((call) => call.method === "POST" && call.path === "/pending-items")).toBe(true);
  });

  for (const viewport of [
    { name: "desktop", width: 1366, height: 900 },
    { name: "tablet", width: 820, height: 1180 },
    { name: "mobile", width: 390, height: 844 }
  ]) {
    test(`captura visual ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await installSentinelInit(page, { enabled: true });
      const mock = createSentinelMock(page);
      mock.state.evidences.push({ id: "evidence-a", evidence_type: "text", source: "manual", title: "Registro visual", description: "Ponto vistoriado" });
      mock.state.pending.push({ id: "pending-a", title: "Pendência visual", status: "open", priority: "normal", severity: "medium", links: [] });
      mock.state.events.push({ id: "event-a", event_type: "evidence_created", title: "Evidência criada", occurred_at: "2026-07-29T12:00:00.000Z" });
      await page.goto(eloUrl, { waitUntil: "domcontentloaded" });
      await exposeElo(page);
      await page.getByRole("button", { name: "Sentinela" }).click();
      await expect(page.getByText("Registro visual")).toBeVisible();
      await page.screenshot({ path: `test-results/elo-sentinel-ui-${viewport.name}.png`, fullPage: true });
    });
  }
});
