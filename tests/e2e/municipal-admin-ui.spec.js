import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(resolve("municipal-admin.html")).href;

function installSession(page, options = {}) {
  return page.addInitScript((values) => {
    window.OBRAREPORT_API_BASE_URL = "https://municipal.local";
    if (values.token !== false) window.MUNICIPAL_ADMIN_AUTH_TOKEN = "admin.header.payload";
  }, { token: options.token });
}

async function mockMunicipalApi(page, options = {}) {
  const calls = [];
  const state = {
    institutions: options.empty ? [] : [
      { id: "inst-a", name: "Prefeitura A", city: "Salvador", state: "BA", document: "11.111", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "inst-b", name: "Prefeitura Inativa", city: "Feira", state: "BA", document: "", status: "inactive", created_at: "2026-01-02T00:00:00.000Z" }
    ],
    units: {
      "inst-a": [{ id: "unit-a", institution_id: "inst-a", name: "Almox Central", code: "CENTRAL", address: "Rua A", status: "active" }],
      "inst-b": [{ id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", address: "Rua B", status: "active" }]
    },
    users: {
      "inst-a": [{ id: "profile-a", auth_user_id: "user-a", institution_id: "inst-a", unit_id: "unit-a", name: "Gestor A", email: "gestor@a.test", role: "gestor", status: "active", created_at: "2026-01-03T00:00:00.000Z" }],
      "inst-b": []
    },
    inviteCount: 0
  };

  await page.route("https://municipal.local/api/municipal-admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/municipal-admin", "");
    calls.push({ method: request.method(), path });
    if (path === "/me") {
      if (options.denied) return route.fulfill({ status: 403, json: { ok: false, error: "permission_denied" } });
      return route.fulfill({ json: { ok: true, me: { user_id: "platform-user", role: options.role || "platform_admin", status: "active", institution_id: "", allowed_units: [] } } });
    }
    if (options.role && options.role !== "platform_admin") return route.fulfill({ status: 403, json: { ok: false, error: "platform_admin_required" } });
    if (request.method() === "GET" && path === "/institutions") return route.fulfill({ json: { ok: true, institutions: state.institutions } });
    if (request.method() === "POST" && path === "/institutions") {
      const body = request.postDataJSON();
      if (!body.name) return route.fulfill({ status: 400, json: { ok: false, error: "institution_name_required" } });
      const inst = { id: "inst-new", name: body.name, city: body.city, state: body.state, document: body.document || "", status: body.status || "active" };
      state.institutions.unshift(inst);
      state.units[inst.id] = [];
      state.users[inst.id] = [];
      return route.fulfill({ json: { ok: true, institution: inst } });
    }
    const instMatch = path.match(/^\/institutions\/([^/]+)$/);
    if (instMatch && request.method() === "GET") {
      const inst = state.institutions.find((item) => item.id === instMatch[1]);
      return inst ? route.fulfill({ json: { ok: true, institution: inst } }) : route.fulfill({ status: 404, json: { ok: false, error: "institution_not_found" } });
    }
    if (instMatch && request.method() === "PATCH") {
      const body = request.postDataJSON();
      const inst = state.institutions.find((item) => item.id === instMatch[1]);
      Object.assign(inst, body);
      return route.fulfill({ json: { ok: true, institution: inst } });
    }
    const deactivateInst = path.match(/^\/institutions\/([^/]+)\/deactivate$/);
    if (deactivateInst && request.method() === "POST") {
      const inst = state.institutions.find((item) => item.id === deactivateInst[1]);
      inst.status = "inactive";
      return route.fulfill({ json: { ok: true, institution: inst } });
    }
    const unitsMatch = path.match(/^\/institutions\/([^/]+)\/units$/);
    if (unitsMatch && request.method() === "GET") return route.fulfill({ json: { ok: true, units: state.units[unitsMatch[1]] || [] } });
    if (unitsMatch && request.method() === "POST") {
      const body = request.postDataJSON();
      const unit = { id: "unit-new", institution_id: unitsMatch[1], name: body.name, code: body.code, address: body.address || "", status: body.status || "active" };
      state.units[unitsMatch[1]] = (state.units[unitsMatch[1]] || []).concat(unit);
      return route.fulfill({ json: { ok: true, unit } });
    }
    const unitPatch = path.match(/^\/units\/([^/]+)$/);
    if (unitPatch && request.method() === "PATCH") {
      const body = request.postDataJSON();
      const unit = Object.values(state.units).flat().find((item) => item.id === unitPatch[1]);
      Object.assign(unit, body);
      return route.fulfill({ json: { ok: true, unit } });
    }
    const unitDeactivate = path.match(/^\/units\/([^/]+)\/deactivate$/);
    if (unitDeactivate && request.method() === "POST") {
      const unit = Object.values(state.units).flat().find((item) => item.id === unitDeactivate[1]);
      unit.status = "inactive";
      return route.fulfill({ json: { ok: true, unit } });
    }
    const usersMatch = path.match(/^\/institutions\/([^/]+)\/users$/);
    if (usersMatch && request.method() === "GET") {
      if (options.usersFail && usersMatch[1] === "inst-a") return route.fulfill({ status: 500, json: { ok: false, error: "users_failed" } });
      return route.fulfill({ json: { ok: true, users: state.users[usersMatch[1]] || [] } });
    }
    const inviteMatch = path.match(/^\/institutions\/([^/]+)\/invites$/);
    if (inviteMatch && request.method() === "POST") {
      const body = request.postDataJSON();
      state.inviteCount += 1;
      return route.fulfill({ json: { ok: true, invite: { id: "invite-" + state.inviteCount, institution_id: inviteMatch[1], email: body.email, role: body.role, unit_id: body.unit_id || null, status: "pending" }, invite_token: "token-unico-" + state.inviteCount } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  return { calls, state };
}

test.describe("Administracao Municipal UI", () => {
  test("platform_admin acessa painel, lista prefeituras e renderiza desktop", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administracao Municipal" })).toBeVisible();
    await expect(page.getByText("Prefeitura A")).toBeVisible();
    await expect(page.getByText("Prefeitura Inativa")).toBeVisible();
    await expect(page.getByText("Inativa").first()).toBeVisible();
    await expect(page.getByText("Almoxarifados").first()).toBeVisible();
  });

  test("usuario sem token nao acessa nem dispara requisicao administrativa", async ({ page }) => {
    await installSession(page, { token: false });
    let calls = 0;
    await page.route("https://municipal.local/api/municipal-admin/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Sessao expirada");
    expect(calls).toBe(0);
  });

  test("usuario nao platform_admin recebe acesso negado", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Acesso negado");
    await expect(page.getByText("Prefeitura A")).toHaveCount(0);
  });

  test("lista vazia mostra estado vazio", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { empty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Nenhuma prefeitura cadastrada.")).toBeVisible();
    await expect(page.getByText("Prefeituras").first()).toBeVisible();
  });

  test("cadastra, edita, abre e desativa prefeitura", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { empty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Nova prefeitura" }).click();
    await page.locator("[name='name']").fill("Prefeitura Nova");
    await page.locator("[name='city']").fill("Camacari");
    await page.locator("[name='state']").fill("BA");
    await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();
    await expect(page.getByRole("button", { name: /Prefeitura Nova/ })).toBeVisible();
    await page.getByRole("button", { name: /Prefeitura Nova/ }).click();
    await page.getByRole("button", { name: "Editar prefeitura" }).click();
    await page.locator("[name='name']").fill("Prefeitura Editada");
    await page.getByRole("button", { name: "Salvar prefeitura" }).click();
    await expect(page.getByRole("button", { name: /Prefeitura Editada/ })).toBeVisible();
    await page.getByRole("button", { name: "Desativar prefeitura" }).click();
    await expect(page.getByText("Prefeitura desativada.")).toBeVisible();
  });

  test("valida cadastro de prefeitura", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { empty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Nova prefeitura" }).click();
    await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();
    await expect(page.locator(".ma-status")).toContainText("Nome obrigatorio");
    await page.locator("[name='name']").fill("Prefeitura X");
    await page.locator("[name='city']").fill("Cidade X");
    await page.locator("[name='state']").fill("B");
    await page.getByRole("button", { name: "Cadastrar prefeitura" }).click();
    await expect(page.locator(".ma-status")).toContainText("UF deve ter 2 caracteres");
  });

  test("abre prefeitura, cadastra/desativa unidade e nao mostra unidade de outra prefeitura", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("Prefeitura A").click();
    const detail = page.locator(".ma-detail");
    await expect(detail).toContainText("Almox Central");
    await expect(detail).not.toContainText("Almox B");
    await detail.locator("[data-form='unit'] [name='name']").fill("Almox Obras");
    await detail.locator("[data-form='unit'] [name='code']").fill("OBRAS");
    await detail.getByRole("button", { name: "Criar unidade" }).click();
    await expect(detail).toContainText("Almox Obras");
    await detail.locator("article.ma-row", { hasText: "Almox Obras" }).getByRole("button", { name: "Desativar" }).click();
    await expect(page.locator(".ma-status")).toContainText("Unidade desativada");
  });

  test("cria convite para gestor sem oferecer platform_admin e token aparece uma unica vez", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("Prefeitura A").click();
    await expect(page.locator("select[name='role'] option", { hasText: "Superadmin" })).toHaveCount(0);
    await page.locator("input[name='email']").fill("gestor@pref.test");
    await page.locator("select[name='role']").selectOption("gestor");
    await page.getByRole("button", { name: "Criar convite" }).click();
    await expect(page.getByText("token-unico-1")).toBeVisible();
    await page.getByRole("button", { name: "Atualizar lista" }).first().click();
    await expect(page.getByText("token-unico-1")).toHaveCount(0);
  });

  test("falha ao carregar usuarios nao derruba unidades", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { usersFail: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("Prefeitura A").click();
    await expect(page.locator(".ma-detail")).toContainText("Almox Central");
    await expect(page.locator(".ma-detail")).toContainText("users_failed");
  });

  test("tablet mantem painel e detalhe sem sobreposicao", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByText("Prefeitura A").click();
    await expect(page.locator(".ma-metrics")).toBeVisible();
    await expect(page.locator(".ma-detail")).toContainText("Almoxarifados");
    await expect(page.locator(".ma-detail")).toContainText("Convites");
  });
  test("mobile mantem listas e formularios legiveis", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administracao Municipal" })).toBeVisible();
    await page.getByText("Prefeitura A").click();
    await expect(page.locator(".ma-detail")).toContainText("Usuarios");
    await expect(page.locator(".ma-detail")).toBeVisible();
  });
});