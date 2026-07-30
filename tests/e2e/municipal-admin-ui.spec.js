import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const pageUrl = pathToFileURL(resolve("municipal-admin.html")).href;

function installSession(page, options = {}) {
  return page.addInitScript((values) => {
    window.OBRAREPORT_API_BASE_URL = "https://municipal.local";
    window.confirm = () => true;
    if (values.token !== false) window.MUNICIPAL_ADMIN_AUTH_TOKEN = "admin.header.payload";
  }, { token: options.token });
}

async function mockMunicipalApi(page, options = {}) {
  const calls = [];
  const actorRole = options.role || "platform_admin";
  const actorInstitution = actorRole === "platform_admin" ? "" : "inst-a";
  const actorUnit = actorRole === "gestor" ? "unit-a" : "";
  const state = {
    institutions: options.empty ? [] : [
      { id: "inst-a", name: "Prefeitura A", city: "Salvador", state: "BA", document: "11.111", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "inst-b", name: "Prefeitura Inativa", city: "Feira", state: "BA", document: "22.222", status: "inactive", created_at: "2026-01-02T00:00:00.000Z" }
    ],
    units: {
      "inst-a": [
        { id: "unit-a", institution_id: "inst-a", name: "Almox Central", code: "CENTRAL", address: "Rua A", status: "active" },
        { id: "unit-a-2", institution_id: "inst-a", name: "Almox Distrital", code: "DIST", address: "Rua D", status: "active" }
      ],
      "inst-b": [{ id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", address: "Rua B", status: "active" }]
    },
    users: {
      "inst-a": [
        { id: "profile-admin-a", auth_user_id: "municipal_admin-user", institution_id: "inst-a", unit_id: null, name: "Admin A", email: "admin@a.test", role: "municipal_admin", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
        { id: "profile-gestor-a", auth_user_id: "gestor-user", institution_id: "inst-a", unit_id: "unit-a", name: "Gestor A", email: "gestor@a.test", role: "gestor", status: "active", created_at: "2026-01-03T00:00:00.000Z" },
        { id: "profile-func-a", auth_user_id: "func-a", institution_id: "inst-a", unit_id: "unit-a", name: "Func A", email: "func@a.test", role: "funcionario", status: "active", created_at: "2026-01-04T00:00:00.000Z" },
        { id: "profile-almox-a", auth_user_id: "almox-a", institution_id: "inst-a", unit_id: "unit-a", name: "Almox A", email: "almox@a.test", role: "almoxarife", status: "active", created_at: "2026-01-05T00:00:00.000Z" }
      ],
      "inst-b": [{ id: "profile-b", auth_user_id: "func-b", institution_id: "inst-b", unit_id: "unit-b", name: "Func B", email: "func@b.test", role: "funcionario", status: "active" }]
    },
    inviteCount: 0,
    dashboards: {
      "unit-a": {
        unit: { id: "unit-a", institution_id: "inst-a", name: "Almox Central", code: "CENTRAL", address: "Rua A", status: "active" },
        metrics: { total_items: 2, total_quantity: 11, low_stock_items: 1, zero_stock_items: 1, recent_entries: 1, recent_exits: 1, open_alerts: 2, last_movement_at: "2026-02-04T10:00:00.000Z", last_audit_at: "2026-02-04T11:00:00.000Z" },
        items: [
          { id: "item-seringa", name: "Seringa", unit: "un", current_quantity: 2, minimum_quantity: 5, situation: "baixo" },
          { id: "item-luva", name: "Luva", unit: "cx", current_quantity: 0, minimum_quantity: 1, situation: "zerado" }
        ],
        movements: [
          { id: "mov-entry", type: "entrada", item_name: "Seringa", quantity: 10, created_at: "2026-02-03T10:00:00.000Z", responsible: "Ana", reason: "NF 10", source: "stock_saude" },
          { id: "mov-exit", type: "saida", item_name: "Luva", quantity: 1, created_at: "2026-02-04T10:00:00.000Z", responsible: "Bia", reason: "UBS", source: "stock_saude" }
        ],
        alerts: [
          { id: "alert-seringa", title: "Seringa", type: "estoque_baixo", current_quantity: 2, minimum_quantity: 5 },
          { id: "alert-luva", title: "Luva", type: "item_zerado", current_quantity: 0, minimum_quantity: 1 }
        ],
        audit_log: [{ id: "audit-1", action: "stock_checked", user: "gestor-user", created_at: "2026-02-04T11:00:00.000Z", summary: "Conferencia" }],
        partial_errors: []
      },
      "unit-a-2": {
        unit: { id: "unit-a-2", institution_id: "inst-a", name: "Almox Distrital", code: "DIST", address: "Rua D", status: "active" },
        metrics: { total_items: 0, total_quantity: 0, low_stock_items: 0, zero_stock_items: 0, recent_entries: 0, recent_exits: 0, open_alerts: 0, last_movement_at: "", last_audit_at: "" },
        items: [], movements: [], alerts: [], audit_log: [], partial_errors: []
      },
      "unit-b": {
        unit: { id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", address: "Rua B", status: "active" },
        metrics: { total_items: 1, total_quantity: 99, low_stock_items: 0, zero_stock_items: 0, recent_entries: 0, recent_exits: 0, open_alerts: 0 },
        items: [], movements: [], alerts: [], audit_log: [], partial_errors: []
      }
    }
  };

  function actorCanUseInstitution(id) {
    return actorRole === "platform_admin" || id === actorInstitution;
  }
  function roleAllowed(next) {
    if (actorRole === "platform_admin") return ["municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"].includes(next);
    if (actorRole === "municipal_admin") return ["gestor", "almoxarife", "funcionario", "leitura"].includes(next);
    if (actorRole === "gestor") return ["almoxarife", "funcionario", "leitura"].includes(next);
    return false;
  }
  function findUnit(id) {
    return Object.values(state.units).flat().find((unit) => unit.id === id);
  }
  function findUser(id) {
    return Object.values(state.users).flat().find((user) => user.id === id || user.auth_user_id === id);
  }
  function canActOn(user) {
    if (!user || !actorCanUseInstitution(user.institution_id)) return false;
    if (user.auth_user_id === actorRole + "-user") return false;
    if (actorRole === "platform_admin") return true;
    if (actorRole === "municipal_admin") return !["platform_admin", "municipal_admin"].includes(user.role);
    if (actorRole === "gestor") return ["almoxarife", "funcionario", "leitura"].includes(user.role);
    return false;
  }

  await page.route("https://municipal.local/api/municipal-admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace("/api/municipal-admin", "");
    calls.push({ method: request.method(), path });
    if (path === "/me") {
      if (options.denied) return route.fulfill({ status: 403, json: { ok: false, error: "permission_denied" } });
      if (options.inactive) return route.fulfill({ status: 403, json: { ok: false, error: "user_inactive" } });
      return route.fulfill({ json: { ok: true, me: { user_id: actorRole + "-user", role: actorRole, status: "active", institution_id: actorInstitution, unit_id: actorUnit || null, allowed_units: actorUnit ? [state.units["inst-a"][0]] : state.units["inst-a"] } } });
    }
    if (request.method() === "GET" && path === "/institutions") {
      if (actorRole !== "platform_admin") return route.fulfill({ status: 403, json: { ok: false, error: "platform_admin_required" } });
      return route.fulfill({ json: { ok: true, institutions: state.institutions } });
    }
    if (request.method() === "POST" && path === "/institutions") {
      if (actorRole !== "platform_admin") return route.fulfill({ status: 403, json: { ok: false, error: "platform_admin_required" } });
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
      if (!actorCanUseInstitution(instMatch[1])) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      const inst = state.institutions.find((item) => item.id === instMatch[1]);
      return inst ? route.fulfill({ json: { ok: true, institution: inst } }) : route.fulfill({ status: 404, json: { ok: false, error: "institution_not_found" } });
    }
    if (instMatch && request.method() === "PATCH") {
      if (actorRole !== "platform_admin") return route.fulfill({ status: 403, json: { ok: false, error: "platform_admin_required" } });
      const body = request.postDataJSON();
      const inst = state.institutions.find((item) => item.id === instMatch[1]);
      Object.assign(inst, body);
      return route.fulfill({ json: { ok: true, institution: inst } });
    }
    const deactivateInst = path.match(/^\/institutions\/([^/]+)\/deactivate$/);
    if (deactivateInst && request.method() === "POST") {
      if (actorRole !== "platform_admin") return route.fulfill({ status: 403, json: { ok: false, error: "platform_admin_required" } });
      const inst = state.institutions.find((item) => item.id === deactivateInst[1]);
      inst.status = "inactive";
      return route.fulfill({ json: { ok: true, institution: inst } });
    }
    const unitsMatch = path.match(/^\/institutions\/([^/]+)\/units$/);
    if (unitsMatch && request.method() === "GET") {
      if (!actorCanUseInstitution(unitsMatch[1])) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      return route.fulfill({ json: { ok: true, units: state.units[unitsMatch[1]] || [] } });
    }
    if (unitsMatch && request.method() === "POST") {
      if (!["platform_admin", "municipal_admin"].includes(actorRole) || !actorCanUseInstitution(unitsMatch[1])) return route.fulfill({ status: 403, json: { ok: false, error: "unit_management_forbidden" } });
      const body = request.postDataJSON();
      const unit = { id: "unit-new", institution_id: unitsMatch[1], name: body.name, code: body.code, address: body.address || "", status: body.status || "active" };
      state.units[unitsMatch[1]] = (state.units[unitsMatch[1]] || []).concat(unit);
      return route.fulfill({ json: { ok: true, unit } });
    }
    const dashboardMatch = path.match(/^\/units\/([^/]+)\/operational-dashboard$/);
    if (dashboardMatch && request.method() === "GET") {
      const unit = findUnit(dashboardMatch[1]);
      if (!unit || !actorCanUseInstitution(unit.institution_id)) return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      if (actorRole === "gestor" && unit.id !== "unit-a") return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      if (options.shelfFailUnit === unit.id) return route.fulfill({ status: 500, json: { ok: false, error: "stock_source_failed" } });
      const dashboard = state.dashboards[unit.id];
      return dashboard ? route.fulfill({ json: { ok: true, dashboard } }) : route.fulfill({ status: 404, json: { ok: false, error: "unit_not_found" } });
    }
    const unitPatch = path.match(/^\/units\/([^/]+)$/);
    if (unitPatch && request.method() === "PATCH") {
      const unit = findUnit(unitPatch[1]);
      if (!["platform_admin", "municipal_admin"].includes(actorRole) || !actorCanUseInstitution(unit && unit.institution_id)) return route.fulfill({ status: 403, json: { ok: false, error: "unit_management_forbidden" } });
      Object.assign(unit, request.postDataJSON());
      return route.fulfill({ json: { ok: true, unit } });
    }
    const unitDeactivate = path.match(/^\/units\/([^/]+)\/deactivate$/);
    if (unitDeactivate && request.method() === "POST") {
      const unit = findUnit(unitDeactivate[1]);
      if (!["platform_admin", "municipal_admin"].includes(actorRole) || !actorCanUseInstitution(unit && unit.institution_id)) return route.fulfill({ status: 403, json: { ok: false, error: "unit_management_forbidden" } });
      unit.status = "inactive";
      return route.fulfill({ json: { ok: true, unit } });
    }
    const usersMatch = path.match(/^\/institutions\/([^/]+)\/users$/);
    if (usersMatch && request.method() === "GET") {
      if (!actorCanUseInstitution(usersMatch[1])) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      if (options.usersFail && usersMatch[1] === "inst-a") return route.fulfill({ status: 500, json: { ok: false, error: "users_failed" } });
      return route.fulfill({ json: { ok: true, users: state.users[usersMatch[1]] || [] } });
    }
    const inviteMatch = path.match(/^\/institutions\/([^/]+)\/invites$/);
    if (inviteMatch && request.method() === "POST") {
      if (!actorCanUseInstitution(inviteMatch[1])) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      const body = request.postDataJSON();
      if (!roleAllowed(body.role)) return route.fulfill({ status: 403, json: { ok: false, error: "role_assignment_forbidden" } });
      if (actorRole === "gestor" && body.unit_id && body.unit_id !== "unit-a") return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      state.inviteCount += 1;
      return route.fulfill({ json: { ok: true, invite: { id: "invite-" + state.inviteCount, institution_id: inviteMatch[1], email: body.email, role: body.role, unit_id: body.unit_id || null, status: "pending" }, invite_token: "token-unico-" + state.inviteCount } });
    }
    const rolePatch = path.match(/^\/users\/([^/]+)\/role$/);
    if (rolePatch && request.method() === "PATCH") {
      const user = findUser(rolePatch[1]);
      const body = request.postDataJSON();
      if (!canActOn(user) || !roleAllowed(body.role)) return route.fulfill({ status: 403, json: { ok: false, error: "role_assignment_forbidden" } });
      user.role = body.role;
      return route.fulfill({ json: { ok: true, user } });
    }
    const unitUserPatch = path.match(/^\/users\/([^/]+)\/units$/);
    if (unitUserPatch && request.method() === "PATCH") {
      const user = findUser(unitUserPatch[1]);
      const body = request.postDataJSON();
      if (!canActOn(user)) return route.fulfill({ status: 403, json: { ok: false, error: "user_management_forbidden" } });
      if (actorRole === "gestor" && body.unit_id && body.unit_id !== "unit-a") return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      user.unit_id = body.unit_id || null;
      return route.fulfill({ json: { ok: true, user, units: user.unit_id ? [user.unit_id] : [] } });
    }
    const deactUser = path.match(/^\/users\/([^/]+)\/deactivate$/);
    if (deactUser && request.method() === "POST") {
      const user = findUser(deactUser[1]);
      if (!canActOn(user)) return route.fulfill({ status: 403, json: { ok: false, error: "user_management_forbidden" } });
      user.status = "inactive";
      return route.fulfill({ json: { ok: true, user } });
    }
    return route.fulfill({ status: 404, json: { ok: false, error: "not_found" } });
  });

  return { calls, state };
}

test.describe("Administracao Municipal UI", () => {
  test("platform_admin continua usando painel completo", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page);
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administracao Municipal" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Prefeitura A/ })).toBeVisible();
    await expect(page.getByText("Prefeitura Inativa")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nova prefeitura" })).toBeVisible();
  });

  test("usuario sem token nao acessa nem dispara requisicao administrativa", async ({ page }) => {
    await installSession(page, { token: false });
    let calls = 0;
    await page.route("https://municipal.local/api/municipal-admin/**", (route) => { calls += 1; return route.abort(); });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Sessao expirada");
    expect(calls).toBe(0);
  });

  test("papel inferior recebe acesso negado", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "almoxarife" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Acesso negado");
    await expect(page.getByText("Prefeitura A")).toHaveCount(0);
  });

  test("usuario inativo recebe acesso negado", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor", inactive: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Acesso negado");
  });

  test("lista vazia funciona para platform_admin", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { empty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Nenhuma prefeitura cadastrada.")).toBeVisible();
  });

  test("platform_admin cadastra, edita, abre e desativa prefeitura", async ({ page }) => {
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
  });

  test("municipal_admin acessa somente a propria prefeitura", async ({ page }) => {
    await installSession(page);
    const mock = await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Minha prefeitura")).toBeVisible();
    await expect(page.getByRole("button", { name: /Prefeitura A/ })).toBeVisible();
    await expect(page.getByText("Prefeitura Inativa")).toHaveCount(0);
    expect(mock.calls.some((call) => call.path === "/institutions")).toBe(false);
  });

  test("municipal_admin cria unidade na propria prefeitura", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const detail = page.locator(".ma-detail");
    await detail.locator("[data-form='unit'] [name='name']").fill("Almox Obras");
    await detail.locator("[data-form='unit'] [name='code']").fill("OBRAS");
    await detail.getByRole("button", { name: "Criar unidade" }).click();
    await expect(detail).toContainText("Almox Obras");
  });

  test("municipal_admin nao acessa outra prefeitura por troca manual", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-status")).toContainText("Prefeitura carregada");
    await page.evaluate(() => window.MunicipalAdminUi.openInstitutionForTest("inst-b"));
    await expect(page.locator(".ma-status")).toContainText("Acesso negado");
    await expect(page.locator(".ma-detail")).not.toContainText("Prefeitura Inativa");
  });

  test("gestor acessa somente a propria prefeitura e nao ve lista global", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Minha prefeitura")).toBeVisible();
    await expect(page.getByRole("button", { name: /Prefeitura A/ })).toBeVisible();
    await expect(page.getByText("Prefeitura Inativa")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Nova prefeitura" })).toHaveCount(0);
  });

  test("gestor nao ve acoes de prefeitura nem de unidade", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Editar prefeitura" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Desativar prefeitura" })).toHaveCount(0);
    await expect(page.locator("[data-form='unit']")).toHaveCount(0);
    await expect(page.locator(".ma-detail .ma-panel", { hasText: "Almoxarifados" }).getByRole("button", { name: "Desativar" })).toHaveCount(0);
  });

  test("gestor nao ve platform_admin nem municipal_admin nos convites", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator("select[name='role'] option", { hasText: "Superadmin" })).toHaveCount(0);
    await expect(page.locator("select[name='role'] option", { hasText: "Admin municipal" })).toHaveCount(0);
    await expect(page.locator("select[name='role'] option", { hasText: "Gestor" })).toHaveCount(0);
  });

  test("gestor cria convite para funcionario", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.locator("input[name='email']").fill("funcionario@pref.test");
    await page.locator("select[name='role']").selectOption("funcionario");
    await page.locator("select[name='unit_id']").selectOption("unit-a");
    await page.getByRole("button", { name: "Criar convite" }).click();
    await expect(page.getByText("token-unico-1")).toBeVisible();
    await page.getByRole("button", { name: "Atualizar" }).click();
    await expect(page.getByText("token-unico-1")).toHaveCount(0);
  });

  test("gestor vincula funcionario a unidade permitida", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const row = page.locator("article.ma-row", { hasText: "Func A" });
    await row.getByLabel("Alterar unidade").selectOption("unit-a");
    await row.getByRole("button", { name: "Salvar unidade" }).click();
    await expect(page.locator(".ma-status")).toContainText("Unidade do usuario atualizada");
  });

  test("unidade de outro tenant nunca aparece", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-detail")).toContainText("Almox Central");
    await expect(page.locator(".ma-detail")).not.toContainText("Almox Distrital");
    await expect(page.locator(".ma-detail")).not.toContainText("Almox B");
  });

  test("troca manual de ID retorna acesso negado seguro", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-status")).toContainText("Prefeitura carregada");
    await page.evaluate(() => window.MunicipalAdminUi.openInstitutionForTest("inst-b"));
    await expect(page.locator(".ma-status")).toContainText("Acesso negado");
  });

  test("falha de usuarios nao derruba unidades", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin", usersFail: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-detail")).toContainText("Almox Central");
    await expect(page.locator(".ma-detail")).toContainText("users_failed");
  });

  test("desktop renderiza painel e detalhe", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-metrics")).toBeVisible();
    await expect(page.locator(".ma-detail")).toContainText("Usuarios");
  });

  test("tablet mantem painel e detalhe sem sobreposicao", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-metrics")).toBeVisible();
    await expect(page.locator(".ma-detail")).toContainText("Almoxarifados");
    await expect(page.locator(".ma-detail")).toContainText("Convites");
  });

  test("mobile mantem listas e formularios legiveis", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Administracao Municipal" })).toBeVisible();
    await expect(page.locator(".ma-detail")).toContainText("Usuarios");
    await expect(page.locator(".ma-detail")).toBeVisible();
  });
  test("prateleira operacional exibe metricas reais e detalhe do almoxarifado", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const shelf = page.locator(".ma-shelf");
    await expect(shelf.getByRole("heading", { name: "Prateleira Operacional" })).toBeVisible();
    await expect(shelf).toContainText("Itens cadastrados");
    await expect(shelf).toContainText("Seringa");
    await expect(shelf).toContainText("Luva");
    await expect(shelf).toContainText("Movimentacoes");
    await expect(shelf).toContainText("Historico/Auditoria");
  });

  test("gestor ve somente almoxarifado autorizado na prateleira", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const shelf = page.locator(".ma-shelf");
    await expect(shelf).toContainText("Almox Central");
    await expect(shelf).not.toContainText("Almox Distrital");
    await expect(shelf).not.toContainText("Almox B");
  });

  test("troca manual de almoxarifado externo fica bloqueada", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".ma-status")).toContainText("Prefeitura carregada");
    await page.evaluate(() => window.MunicipalAdminUi.openShelfUnitForTest("unit-a-2"));
    await expect(page.locator(".ma-status")).toContainText("Acesso negado para almoxarifado");
    await expect(page.locator(".ma-shelf")).not.toContainText("Almox Distrital");
  });

  test("almoxarifado sem itens apresenta estados vazios", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".ma-shelf-card", { hasText: "Almox Distrital" }).getByRole("button", { name: "Abrir almoxarifado" }).click();
    const detail = page.locator(".ma-shelf-detail");
    await expect(detail).toContainText("Unidade sem itens");
    await expect(detail).toContainText("Unidade sem movimentacoes");
    await expect(detail).toContainText("Unidade sem alertas");
  });

  test("falha em um almoxarifado nao derruba os demais", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin", shelfFailUnit: "unit-a-2" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    const shelf = page.locator(".ma-shelf");
    await expect(shelf).toContainText("Seringa");
    await expect(page.locator(".ma-shelf-card", { hasText: "Almox Distrital" })).toContainText("stock_source_failed");
  });
});
