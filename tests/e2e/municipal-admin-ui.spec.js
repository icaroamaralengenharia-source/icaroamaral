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
    assetCount: 2,
    assets: (options.assetsEmpty ? [] : [
      { id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", asset_tag: "PAT-001", name: "Mesa Diretoria", description: "Mesa em madeira", category: "Mobiliario", brand: "Marca A", model: "M1", serial_number: "SER-1", acquisition_date: "2026-01-10", acquisition_value: 1200, condition: "bom", status: "ativo", location: "Sala 1", responsible_user_id: "gestor-user", created_by: "admin-a", created_at: "2026-02-01T10:00:00.000Z", updated_at: "2026-02-01T10:00:00.000Z" },
      { id: "asset-b", institution_id: "inst-a", unit_id: "unit-a-2", asset_tag: "PAT-002", name: "Cadeira Reserva", description: "", category: "Mobiliario", condition: "ruim", status: "ativo", location: "Deposito", responsible_user_id: "", created_by: "admin-a", created_at: "2026-02-02T10:00:00.000Z", updated_at: "2026-02-02T10:00:00.000Z" },
      { id: "asset-tenant-b", institution_id: "inst-b", unit_id: "unit-b", asset_tag: "PAT-B", name: "Bem Tenant B", category: "Sigiloso", condition: "bom", status: "ativo", location: "Outra prefeitura", responsible_user_id: "func-b", created_at: "2026-02-03T10:00:00.000Z", updated_at: "2026-02-03T10:00:00.000Z" }
    ]),
    assetHistory: {
      "asset-a": [{ id: "hist-a-1", asset_id: "asset-a", institution_id: "inst-a", unit_id: "unit-a", action: "asset_created", performed_by: "admin-a", created_at: "2026-02-01T10:00:00.000Z" }]
    },
    documentCount: 1,
    versionCount: 1,
    documents: (options.docsEmpty ? [] : [
      { id: "doc-a", institution_id: "inst-a", unit_id: "unit-a", title: "Relatorio A", description: "Documento do acervo", document_type: "relatorio", status: "active", current_version: 1, created_by: "admin-a", created_at: "2026-02-05T10:00:00.000Z", storage_path: "private/raw/doc-a.pdf" }
    ]),
    versions: {
      "doc-a": [{ id: "ver-a-1", document_id: "doc-a", institution_id: "inst-a", unit_id: "unit-a", version_number: 1, original_filename: "relatorio-a.pdf", mime_type: "application/pdf", size_bytes: 1024, file_reference: "/api/municipal-admin/document-files/relatorio-a.pdf", file_hash: "HASH_A", storage_path: "private/raw/relatorio-a.pdf", created_at: "2026-02-05T10:05:00.000Z" }]
    },
    notifications: [
      { id: "notif-a", institution_id: "inst-a", unit_id: "unit-a", recipient_user_id: actorRole + "-user", source_type: "sentinel_alert", source_id: "sent-a", channel: "in_app", title: "Item zerado", message: "Luva zerada", severity: "high", status: "pending", deduplication_key: "notif-a", created_at: "2026-02-06T08:00:00.000Z" },
      { id: "notif-b", institution_id: "inst-b", unit_id: "unit-b", recipient_user_id: "admin-b", source_type: "manual", source_id: "tenant-b", channel: "in_app", title: "Tenant B", message: "Nao deve aparecer", severity: "high", status: "pending", deduplication_key: "notif-b", created_at: "2026-02-06T08:00:00.000Z" }
    ],
    sentinelAlerts: [
      { id: "sent-a", institution_id: "inst-a", unit_id: "unit-a", rule_code: "item_zero_stock", title: "Luva zerada", description: "Saldo zerado no almoxarifado", severity: "high", status: "open", source_entity_type: "stock_item", source_entity_id: "item-luva", detected_at: "2026-02-06T08:00:00.000Z", metadata: { safe: true } },
      { id: "sent-b", institution_id: "inst-b", unit_id: "unit-b", rule_code: "item_zero_stock", title: "Tenant B", description: "Nao deve aparecer", severity: "high", status: "open", source_entity_type: "stock_item", source_entity_id: "item-b", detected_at: "2026-02-06T08:00:00.000Z" }
    ],
    reportArchiveCount: 0,
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
    if (request.method() === "GET" && path === "/assets") {
      const requestedInstitution = url.searchParams.get("institution_id") || actorInstitution || "inst-a";
      const requestedUnit = url.searchParams.get("unit_id") || "";
      if (!actorCanUseInstitution(requestedInstitution)) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      if (options.assetsFail) return route.fulfill({ status: 500, json: { ok: false, error: "assets_failed" } });
      let assets = state.assets.filter((asset) => asset.institution_id === requestedInstitution);
      if (requestedUnit) assets = assets.filter((asset) => asset.unit_id === requestedUnit);
      if (actorRole === "gestor") assets = assets.filter((asset) => asset.unit_id === "unit-a");
      return route.fulfill({ json: { ok: true, assets, sync_cursor: "2026-02-06T10:00:00.000Z" } });
    }
    if (request.method() === "POST" && path === "/assets") {
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole)) return route.fulfill({ status: 403, json: { ok: false, error: "asset_write_forbidden" } });
      const body = request.postDataJSON();
      const instId = actorRole === "platform_admin" ? body.institution_id || "inst-a" : actorInstitution;
      const unit = findUnit(body.unit_id);
      if (!actorCanUseInstitution(instId) || !unit || unit.institution_id !== instId || (actorRole === "gestor" && unit.id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      if (state.assets.some((asset) => asset.institution_id === instId && asset.asset_tag === body.asset_tag)) return route.fulfill({ status: 409, json: { ok: false, error: "asset_tag_duplicate" } });
      state.assetCount += 1;
      const asset = { id: "asset-new-" + state.assetCount, institution_id: instId, unit_id: body.unit_id, asset_tag: body.asset_tag, name: body.name, description: body.description || "", category: body.category || "", brand: body.brand || "", model: body.model || "", serial_number: body.serial_number || "", acquisition_date: body.acquisition_date || "", acquisition_value: Number(body.acquisition_value || 0), condition: body.condition || "bom", status: body.status || "ativo", location: body.location || "", responsible_user_id: body.responsible_user_id || "", created_by: actorRole + "-user", created_at: "2026-02-07T10:00:00.000Z", updated_at: "2026-02-07T10:00:00.000Z" };
      state.assets.unshift(asset);
      state.assetHistory[asset.id] = [{ id: "hist-" + asset.id, asset_id: asset.id, institution_id: instId, unit_id: asset.unit_id, action: "asset_created", performed_by: actorRole + "-user", created_at: asset.created_at }];
      return route.fulfill({ json: { ok: true, asset } });
    }
    const assetMatch = path.match(/^\/assets\/([^/]+)$/);
    if (assetMatch && request.method() === "GET") {
      const asset = state.assets.find((item) => item.id === assetMatch[1]);
      if (!asset) return route.fulfill({ status: 404, json: { ok: false, error: "asset_not_found" } });
      if (!actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && asset.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      return route.fulfill({ json: { ok: true, asset } });
    }
    if (assetMatch && request.method() === "PATCH") {
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole)) return route.fulfill({ status: 403, json: { ok: false, error: "asset_write_forbidden" } });
      const asset = state.assets.find((item) => item.id === assetMatch[1]);
      if (!asset || !actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && asset.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      const body = request.postDataJSON();
      if (body.asset_tag && state.assets.some((item) => item.id !== asset.id && item.institution_id === asset.institution_id && item.asset_tag === body.asset_tag)) return route.fulfill({ status: 409, json: { ok: false, error: "asset_tag_duplicate" } });
      Object.assign(asset, body, { updated_at: "2026-02-07T11:00:00.000Z" });
      state.assetHistory[asset.id] = (state.assetHistory[asset.id] || []).concat({ id: "hist-update-" + asset.id, asset_id: asset.id, institution_id: asset.institution_id, unit_id: asset.unit_id, action: "asset_updated", performed_by: actorRole + "-user", created_at: asset.updated_at });
      return route.fulfill({ json: { ok: true, asset } });
    }
    const assetHistoryMatch = path.match(/^\/assets\/([^/]+)\/history$/);
    if (assetHistoryMatch && request.method() === "GET") {
      const asset = state.assets.find((item) => item.id === assetHistoryMatch[1]);
      if (!asset || !actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && asset.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      return route.fulfill({ json: { ok: true, history: state.assetHistory[asset.id] || [] } });
    }
    const assetTransfer = path.match(/^\/assets\/([^/]+)\/transfer$/);
    if (assetTransfer && request.method() === "POST") {
      const asset = state.assets.find((item) => item.id === assetTransfer[1]);
      const body = request.postDataJSON();
      const target = findUnit(body.target_unit_id);
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole) || !asset || !target || target.institution_id !== asset.institution_id || !actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && (asset.unit_id !== "unit-a" || target.id !== "unit-a"))) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      asset.unit_id = target.id; asset.location = body.location || asset.location; asset.status = "transferido"; asset.updated_at = "2026-02-07T12:00:00.000Z";
      state.assetHistory[asset.id] = (state.assetHistory[asset.id] || []).concat({ id: "hist-transfer-" + asset.id, asset_id: asset.id, institution_id: asset.institution_id, unit_id: asset.unit_id, action: "asset_transferred", performed_by: actorRole + "-user", created_at: asset.updated_at });
      return route.fulfill({ json: { ok: true, asset } });
    }
    const assetMaintenance = path.match(/^\/assets\/([^/]+)\/maintenance$/);
    if (assetMaintenance && request.method() === "POST") {
      const asset = state.assets.find((item) => item.id === assetMaintenance[1]);
      const body = request.postDataJSON();
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole) || !asset || !actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && asset.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      asset.condition = body.condition || asset.condition; asset.status = "em_manutencao"; asset.updated_at = "2026-02-07T13:00:00.000Z";
      state.assetHistory[asset.id] = (state.assetHistory[asset.id] || []).concat({ id: "hist-maint-" + asset.id, asset_id: asset.id, institution_id: asset.institution_id, unit_id: asset.unit_id, action: "asset_maintenance_registered", performed_by: actorRole + "-user", created_at: asset.updated_at });
      return route.fulfill({ json: { ok: true, asset } });
    }
    const assetDeactivate = path.match(/^\/assets\/([^/]+)\/deactivate$/);
    if (assetDeactivate && request.method() === "POST") {
      const asset = state.assets.find((item) => item.id === assetDeactivate[1]);
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole) || !asset || !actorCanUseInstitution(asset.institution_id) || (actorRole === "gestor" && asset.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "asset_scope_forbidden" } });
      asset.status = "baixado"; asset.updated_at = "2026-02-07T14:00:00.000Z";
      state.assetHistory[asset.id] = (state.assetHistory[asset.id] || []).concat({ id: "hist-low-" + asset.id, asset_id: asset.id, institution_id: asset.institution_id, unit_id: asset.unit_id, action: "asset_deactivated", performed_by: actorRole + "-user", created_at: asset.updated_at });
      return route.fulfill({ json: { ok: true, asset } });
    }
    if (request.method() === "GET" && path === "/documents") {
      const requestedInstitution = url.searchParams.get("institution_id") || actorInstitution;
      if (!actorCanUseInstitution(requestedInstitution)) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      if (options.documentsFail) return route.fulfill({ status: 500, json: { ok: false, error: "documents_failed" } });
      let docs = state.documents.filter((doc) => doc.institution_id === requestedInstitution);
      if (actorRole === "gestor") docs = docs.filter((doc) => !doc.unit_id || doc.unit_id === "unit-a");
      if (actorRole === "leitura") docs = docs.filter((doc) => doc.institution_id === actorInstitution);
      return route.fulfill({ json: { ok: true, documents: docs } });
    }
    if (request.method() === "POST" && path === "/documents") {
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole)) return route.fulfill({ status: 403, json: { ok: false, error: "document_write_forbidden" } });
      const body = request.postDataJSON();
      const instId = actorRole === "platform_admin" ? body.institution_id || "inst-a" : actorInstitution;
      if (!actorCanUseInstitution(instId)) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      const unit = body.unit_id ? findUnit(body.unit_id) : null;
      if (body.unit_id && (!unit || unit.institution_id !== instId || (actorRole === "gestor" && body.unit_id !== "unit-a"))) return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      state.documentCount += 1;
      const doc = { id: "doc-new-" + state.documentCount, institution_id: instId, unit_id: body.unit_id || null, title: body.title, description: body.description || "", document_type: body.document_type || "outro", status: "active", current_version: 0, created_by: actorRole + "-user", created_at: "2026-02-06T10:00:00.000Z" };
      state.documents.unshift(doc);
      state.versions[doc.id] = [];
      return route.fulfill({ json: { ok: true, document: doc } });
    }
    const docMatch = path.match(/^\/documents\/([^/]+)$/);
    if (docMatch && request.method() === "GET") {
      const doc = state.documents.find((item) => item.id === docMatch[1]);
      if (!doc) return route.fulfill({ status: 404, json: { ok: false, error: "document_not_found" } });
      if (!actorCanUseInstitution(doc.institution_id) || (actorRole === "gestor" && doc.unit_id && doc.unit_id !== "unit-a")) return route.fulfill({ status: 403, json: { ok: false, error: "institution_scope_forbidden" } });
      return route.fulfill({ json: { ok: true, document: doc, versions: state.versions[doc.id] || [] } });
    }
    const versionMatch = path.match(/^\/documents\/([^/]+)\/versions$/);
    if (versionMatch && request.method() === "POST") {
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole)) return route.fulfill({ status: 403, json: { ok: false, error: "document_write_forbidden" } });
      const doc = state.documents.find((item) => item.id === versionMatch[1]);
      if (!doc) return route.fulfill({ status: 404, json: { ok: false, error: "document_not_found" } });
      if (doc.status === "archived") return route.fulfill({ status: 409, json: { ok: false, error: "document_archived" } });
      if (actorRole === "gestor" && doc.unit_id !== "unit-a") return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      const body = request.postDataJSON();
      if (!/^https?:\/\//.test(body.file_reference || "") && !(body.file_reference || "").startsWith("/api/municipal-admin/document-files/")) return route.fulfill({ status: 400, json: { ok: false, error: "file_reference_unsafe" } });
      const next = (state.versions[doc.id] || []).length + 1;
      state.versionCount += 1;
      const version = { id: "ver-new-" + state.versionCount, document_id: doc.id, institution_id: doc.institution_id, unit_id: doc.unit_id, version_number: next, original_filename: body.original_filename || "", mime_type: body.mime_type || "", size_bytes: Number(body.size_bytes || 0), file_reference: body.file_reference, file_hash: body.file_hash || "", created_at: "2026-02-06T10:10:00.000Z", storage_path: "private/raw/new.pdf" };
      state.versions[doc.id] = (state.versions[doc.id] || []).concat(version);
      doc.current_version = next;
      return route.fulfill({ json: { ok: true, document: doc, version } });
    }
    const downloadMatch = path.match(/^\/documents\/([^/]+)\/download$/);
    if (downloadMatch && request.method() === "GET") {
      const doc = state.documents.find((item) => item.id === downloadMatch[1]);
      if (!doc) return route.fulfill({ status: 404, json: { ok: false, error: "document_not_found" } });
      const versions = state.versions[doc.id] || [];
      const latest = versions[versions.length - 1];
      if (!latest) return route.fulfill({ status: 404, json: { ok: false, error: "document_version_not_found" } });
      return route.fulfill({ json: { ok: true, download: { document_id: doc.id, version_id: latest.id, version_number: latest.version_number, file_reference: latest.file_reference, original_filename: latest.original_filename, mime_type: latest.mime_type, size_bytes: latest.size_bytes, file_hash: latest.file_hash, storage_path: latest.storage_path } } });
    }
    const archiveMatch = path.match(/^\/documents\/([^/]+)\/archive$/);
    if (archiveMatch && request.method() === "POST") {
      if (!["platform_admin", "municipal_admin", "gestor"].includes(actorRole)) return route.fulfill({ status: 403, json: { ok: false, error: "document_write_forbidden" } });
      const doc = state.documents.find((item) => item.id === archiveMatch[1]);
      if (!doc) return route.fulfill({ status: 404, json: { ok: false, error: "document_not_found" } });
      doc.status = "archived";
      return route.fulfill({ json: { ok: true, document: doc } });
    }
    if (request.method() === "GET" && path === "/notifications") {
      let rows = state.notifications.filter((item) => actorCanUseInstitution(item.institution_id));
      if (actorRole === "gestor") rows = rows.filter((item) => !item.unit_id || item.unit_id === "unit-a");
      return route.fulfill({ json: { ok: true, notifications: rows } });
    }
    if (request.method() === "GET" && path === "/notifications/unread-count") {
      const requestedNotificationInstitution = url.searchParams.get("institution_id") || "";
      const rows = state.notifications.filter((item) => actorCanUseInstitution(item.institution_id) && (!requestedNotificationInstitution || item.institution_id === requestedNotificationInstitution) && item.status !== "read" && item.status !== "cancelled");
      return route.fulfill({ json: { ok: true, unread_count: rows.length } });
    }
    const notificationRead = path.match(/^\/notifications\/([^/]+)\/read$/);
    if (notificationRead && request.method() === "POST") {
      const item = state.notifications.find((row) => row.id === notificationRead[1]);
      if (!item || !actorCanUseInstitution(item.institution_id)) return route.fulfill({ status: 404, json: { ok: false, error: "notification_not_found" } });
      item.status = "read";
      item.read_at = "2026-02-06T09:00:00.000Z";
      return route.fulfill({ json: { ok: true, notification: item } });
    }
    const notificationCancel = path.match(/^\/notifications\/([^/]+)\/cancel$/);
    if (notificationCancel && request.method() === "POST") {
      const item = state.notifications.find((row) => row.id === notificationCancel[1]);
      if (!item || !actorCanUseInstitution(item.institution_id)) return route.fulfill({ status: 404, json: { ok: false, error: "notification_not_found" } });
      item.status = "cancelled";
      return route.fulfill({ json: { ok: true, notification: item } });
    }
    if (request.method() === "GET" && path === "/sentinel/alerts") {
      let alerts = state.sentinelAlerts.filter((item) => actorCanUseInstitution(item.institution_id));
      if (actorRole === "gestor") alerts = alerts.filter((item) => item.unit_id === "unit-a");
      return route.fulfill({ json: { ok: true, alerts } });
    }
    const sentinelDetail = path.match(/^\/sentinel\/alerts\/([^/]+)$/);
    if (sentinelDetail && request.method() === "GET") {
      const alert = state.sentinelAlerts.find((item) => item.id === sentinelDetail[1]);
      if (!alert || !actorCanUseInstitution(alert.institution_id)) return route.fulfill({ status: 404, json: { ok: false, error: "sentinel_alert_not_found" } });
      return route.fulfill({ json: { ok: true, alert } });
    }
    const sentinelAction = path.match(/^\/sentinel\/alerts\/([^/]+)\/(acknowledge|resolve)$/);
    if (sentinelAction && request.method() === "POST") {
      if (actorRole === "leitura") return route.fulfill({ status: 403, json: { ok: false, error: "sentinel_write_forbidden" } });
      const alert = state.sentinelAlerts.find((item) => item.id === sentinelAction[1]);
      if (!alert || !actorCanUseInstitution(alert.institution_id)) return route.fulfill({ status: 404, json: { ok: false, error: "sentinel_alert_not_found" } });
      alert.status = sentinelAction[2] === "resolve" ? "resolved" : "acknowledged";
      return route.fulfill({ json: { ok: true, alert } });
    }
    if (request.method() === "POST" && path === "/sentinel/scan") {
      if (actorRole === "leitura") return route.fulfill({ status: 403, json: { ok: false, error: "sentinel_write_forbidden" } });
      let alerts = state.sentinelAlerts.filter((item) => actorCanUseInstitution(item.institution_id));
      if (actorRole === "gestor") alerts = alerts.filter((item) => item.unit_id === "unit-a");
      return route.fulfill({ json: { ok: true, alerts } });
    }
    if (request.method() === "POST" && path === "/reports/preview") {
      if (actorRole === "leitura") return route.fulfill({ status: 403, json: { ok: false, error: "report_write_forbidden" } });
      const body = request.postDataJSON();
      if (actorRole === "gestor" && body.unit_id !== "unit-a") return route.fulfill({ status: 403, json: { ok: false, error: "unit_scope_forbidden" } });
      return route.fulfill({ json: { ok: true, report: { id: "report-preview-a", operation_id: "op-report-a", report_type: body.report_type, title: "Relatorio municipal de " + body.report_type, unit_id: body.unit_id, period: body.period, conclusion: "Preview gerado com dados municipais." } } });
    }
    if (request.method() === "POST" && path === "/reports/archive") {
      if (actorRole === "leitura") return route.fulfill({ status: 403, json: { ok: false, error: "report_write_forbidden" } });
      const body = request.postDataJSON();
      if (!body.confirmation) return route.fulfill({ status: 400, json: { ok: false, error: "confirmation_required" } });
      state.reportArchiveCount += 1;
      return route.fulfill({ json: { ok: true, document: { id: "doc-report-" + state.reportArchiveCount, title: body.title, unit_id: body.unit_id, status: "active", current_version: 1 }, version: { version_number: 1 } } });
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
    await page.getByRole("button", { name: "Prateleira Operacional" }).click();
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
    await page.getByRole("button", { name: "Prateleira Operacional" }).click();
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
    await page.getByRole("button", { name: "Prateleira Operacional" }).click();
    await page.evaluate(() => window.MunicipalAdminUi.openShelfUnitForTest("unit-a-2"));
    await expect(page.locator(".ma-status")).toContainText("Acesso negado para almoxarifado");
    await expect(page.locator(".ma-shelf")).not.toContainText("Almox Distrital");
  });

  test("almoxarifado sem itens apresenta estados vazios", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Prateleira Operacional" }).click();
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
    await page.getByRole("button", { name: "Prateleira Operacional" }).click();
    const shelf = page.locator(".ma-shelf");
    await expect(shelf).toContainText("Seringa");
    await expect(page.locator(".ma-shelf-card", { hasText: "Almox Distrital" })).toContainText("stock_source_failed");
  });

  test("aba Acervo aparece para platform_admin, municipal_admin e gestor", async ({ page }) => {
    for (const role of ["platform_admin", "municipal_admin", "gestor"]) {
      await page.context().clearCookies();
      await installSession(page);
      await mockMunicipalApi(page, { role });
      await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("button", { name: "Acervo", exact: true })).toBeVisible();
    }
  });

  test("leitura acessa Acervo em modo somente leitura", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "leitura" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Acervo", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Almoxarifados", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Criar documento" })).toHaveCount(0);
    await expect(page.getByText("Relatorio A")).toBeVisible();
  });

  test("Acervo exibe lista vazia e falha parcial sem derrubar painel", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin", docsEmpty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await expect(page.getByText("Nenhum documento encontrado.")).toBeVisible();

    const page2 = await page.context().newPage();
    await installSession(page2);
    await mockMunicipalApi(page2, { role: "municipal_admin", documentsFail: true });
    await page2.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page2.getByRole("button", { name: "Acervo" }).click();
    await expect(page2.locator(".ma-panel").first()).toContainText("documents_failed");
    await expect(page2.getByRole("button", { name: "Almoxarifados" })).toBeVisible();
  });

  test("Acervo lista documento, filtra por unidade, tipo e busca", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await expect(page.getByText("Relatorio A")).toBeVisible();
    await page.locator("[data-form='document-filters'] select[name='unit_id']").selectOption("unit-a-2");
    await expect(page.getByText("Relatorio A")).toHaveCount(0);
    await page.locator("[data-form='document-filters'] select[name='unit_id']").selectOption("");
    await page.locator("[data-form='document-filters'] select[name='document_type']").selectOption("relatorio");
    await expect(page.getByText("Relatorio A")).toBeVisible();
    await page.locator("[data-form='document-filters'] input[name='search']").fill("zzz");
    await expect(page.getByText("Relatorio A")).toHaveCount(0);
  });

  test("Acervo cria documento e cria versao 1", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor", docsEmpty: true });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await page.locator("[data-form='document-create'] input[name='title']").fill("RELATORIO_HOMOLOGACAO_E2E");
    await page.locator("[data-form='document-create'] input[name='description']").fill("Documento de teste");
    await page.locator("[data-form='document-create'] select[name='unit_id']").selectOption("unit-a");
    await page.getByRole("button", { name: "Criar documento" }).click();
    await expect(page.locator(".ma-status")).toContainText("Documento aberto");
    await expect(page.getByText("Documento sem versao.")).toBeVisible();
    await page.locator("[data-form='document-version'] input[name='original_filename']").fill("relatorio.pdf");
    await page.locator("[data-form='document-version'] input[name='mime_type']").fill("application/pdf");
    await page.locator("[data-form='document-version'] input[name='size_bytes']").fill("1024");
    await page.locator("[data-form='document-version'] input[name='file_reference']").fill("/api/municipal-admin/document-files/relatorio.pdf");
    await page.locator("[data-form='document-version'] input[name='file_hash']").fill("HASH_TESTE");
    await page.getByRole("button", { name: "Criar versao" }).click();
    await expect(page.locator(".ma-status")).toContainText("Documento aberto");
    await expect(page.getByText("Versao 1")).toBeVisible();
  });

  test("Acervo rejeita referencia insegura, abre detalhe e download seguro", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await page.getByRole("button", { name: "Abrir" }).first().click();
    await expect(page.getByText("Versao 1")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("storage_path");
    await expect(page.locator("body")).not.toContainText("private/raw");
    await page.locator("[data-form='document-version'] input[name='file_reference']").fill("file:///tmp/raw.pdf");
    await page.getByRole("button", { name: "Criar versao" }).click();
    await expect(page.locator(".ma-status")).toContainText("Referencia de arquivo insegura");
    await page.getByRole("button", { name: "Abrir/baixar referencia" }).click();
    await expect(page.locator(".ma-status")).toContainText("Download autorizado");
  });

  test("Acervo arquiva e bloqueia nova versao", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await page.getByRole("button", { name: "Abrir" }).first().click();
    await page.getByRole("button", { name: "Arquivar documento" }).click();
    await expect(page.locator(".ma-status")).toContainText("Documento arquivado");
    await expect(page.getByText("Documento arquivado nao recebe nova versao.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar versao" })).toHaveCount(0);
  });

  test("Acervo nunca mostra unidade externa para gestor", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Acervo", exact: true }).click();
    await expect(page.locator(".ma-panel").first()).toContainText("Almox Central");
    await expect(page.locator(".ma-panel").first()).not.toContainText("Almox Distrital");
    await expect(page.locator(".ma-panel").first()).not.toContainText("Almox B");
  });
  test("Patrimonio lista, filtra, busca e abre detalhe", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Patrimonio" }).click();
    await expect(page.getByRole("heading", { name: "Patrimonio" })).toBeVisible();
    await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    await expect(page.getByText("PAT-002 - Cadeira Reserva")).toBeVisible();
    await page.locator('[data-form="asset-filters"] input[name="search"]').fill("PAT-001");
    await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    await expect(page.getByText("PAT-002 - Cadeira Reserva")).toHaveCount(0);
    await page.getByRole("button", { name: "Abrir" }).click();
    await expect(page.locator(".ma-detail")).toContainText("Conservacao: Bom");
    await expect(page.locator(".ma-detail")).toContainText("Historico");
  });

  test("Patrimonio cadastra bem e rejeita tombamento duplicado", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Patrimonio" }).click();
    const create = page.locator('[data-form="asset-create"]');
    await create.locator('input[name="asset_tag"]').fill("PAT-010");
    await create.locator('input[name="name"]').fill("Notebook Fiscalizacao");
    await create.locator('input[name="category"]').fill("Informatica");
    await create.locator('select[name="unit_id"]').selectOption("unit-a");
    await create.getByRole("button", { name: "Cadastrar bem" }).click();
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("Bem cadastrado");
    await expect(page.locator(".ma-list").getByText("PAT-010 - Notebook Fiscalizacao")).toBeVisible();
    await create.locator('input[name="asset_tag"]').fill("PAT-001");
    await create.locator('input[name="name"]').fill("Duplicado");
    await create.getByRole("button", { name: "Cadastrar bem" }).click();
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("asset_tag_duplicate");
  });

  test("Patrimonio transfere, registra manutencao e da baixa sem excluir", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Patrimonio" }).click();
    await page.getByRole("button", { name: "Abrir" }).first().click();
    const transfer = page.locator('[data-form="asset-transfer"]');
    await transfer.locator('select[name="target_unit_id"]').selectOption("unit-a-2");
    await transfer.locator('input[name="location"]').fill("Sala 2");
    await transfer.locator('input[name="reason"]').fill("Remanejamento");
    await transfer.getByRole("button", { name: "Transferir" }).click();
    await expect(page.locator(".ma-detail")).toContainText("Status: Transferido");
    const maintenance = page.locator('[data-form="asset-maintenance"]');
    await maintenance.locator('input[name="notes"]').fill("Ajuste preventivo");
    await maintenance.locator('select[name="condition"]').selectOption("regular");
    await maintenance.getByRole("button", { name: "Registrar manutencao" }).click();
    await expect(page.locator(".ma-detail")).toContainText("Status: Em manutencao");
    await page.getByRole("button", { name: "Dar baixa" }).click();
    await expect(page.locator(".ma-detail")).toContainText("Status: Baixado");
    await expect(page.locator(".ma-list").getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
  });

  test("Patrimonio respeita isolamento e permissoes", async ({ page }) => {
    await installSession(page);
    await mockMunicipalApi(page, { role: "gestor" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Patrimonio" }).click();
    await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    await expect(page.getByText("PAT-002 - Cadeira Reserva")).toHaveCount(0);
    await expect(page.getByText("Bem Tenant B")).toHaveCount(0);

    const leitura = await page.context().newPage();
    await installSession(leitura);
    await mockMunicipalApi(leitura, { role: "leitura" });
    await leitura.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await expect(leitura.getByRole("button", { name: "Patrimonio", exact: true })).toBeVisible();
    await leitura.getByRole("button", { name: "Patrimonio", exact: true }).click();
    await expect(leitura.getByText("Perfil leitura: consulta patrimonial sem escrita.")).toBeVisible();
    await expect(leitura.getByRole("button", { name: "Cadastrar bem" })).toHaveCount(0);
    await leitura.close();
  });

  test("Patrimonio consulta e busca offline sem escrita", async ({ page, context }) => {
    await installSession(page);
    const mock = await mockMunicipalApi(page, { role: "municipal_admin" });
    await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Patrimonio" }).click();
    await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    const before = mock.state.assets.length;
    await context.setOffline(true);
    await page.route("https://municipal.local/api/municipal-admin/assets**", (route) => route.abort());
    await page.getByRole("button", { name: "Atualizar patrimonio" }).click();
    await expect(page.locator("[data-municipal-admin-root]")).toContainText("dados sincronizados em");
    await page.locator('[data-form="asset-filters"] input[name="search"]').fill("PAT-001");
    await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cadastrar bem" })).toHaveCount(0);
    await expect(page.getByText("Consulta offline somente leitura")).toBeVisible();
    expect(mock.state.assets.length).toBe(before);
    await context.setOffline(false);
  });

  test("Patrimonio renderiza em desktop, tablet e celular", async ({ page }) => {
    for (const size of [{ width: 1280, height: 820 }, { width: 820, height: 900 }, { width: 390, height: 840 }]) {
      await page.setViewportSize(size);
      await installSession(page);
      await mockMunicipalApi(page, { role: "municipal_admin" });
      await page.goto(pageUrl, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Patrimonio" }).click();
      await expect(page.getByRole("heading", { name: "Patrimonio" })).toBeVisible();
      await expect(page.getByText("PAT-001 - Mesa Diretoria")).toBeVisible();
    }
  });});


test("painel integrado navega por todas as areas principais", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page);
  await page.goto(pageUrl);
  for (const name of ["Visao Geral", "Almoxarifados", "Sentinela", "Relatorios", "Acervo", "Patrimonio", "Auditoria", "Notificacoes", "Assistente ELO"]) {
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
  }
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visao Geral" })).toBeVisible();
  await page.getByRole("button", { name: "Notificacoes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Notificacoes" })).toBeVisible();
});

test("visao geral mostra cards com dados municipais e contador de notificacoes", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page);
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByText("Almoxarifados ativos")).toBeVisible();
  await expect(page.getByText("Baixos/zerados")).toBeVisible();
  await expect(page.getByRole("button", { name: /Notificacoes nao lidas: 1/ })).toBeVisible();
  await expect(page.getByText("Ultima sincronizacao offline")).toBeVisible();
});

test("Sentinela abre alerta, reconhece e resolve com confirmacao humana", async ({ page }) => {
  await installSession(page);
  const mock = await mockMunicipalApi(page);
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Sentinela", exact: true }).click();
  await expect(page.getByText("Luva zerada").first()).toBeVisible();
  await page.getByText("Luva zerada").first().click();
  await page.getByRole("button", { name: "Reconhecer" }).click();
  await expect.poll(() => mock.state.sentinelAlerts.find((item) => item.id === "sent-a")?.status).toBe("acknowledged");
  await page.getByRole("button", { name: "Resolver" }).click();
  await expect.poll(() => mock.state.sentinelAlerts.find((item) => item.id === "sent-a")?.status).toBe("resolved");
});

test("relatorio gera preview e confirma salvamento no Acervo", async ({ page }) => {
  await installSession(page);
  const mock = await mockMunicipalApi(page);
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Relatorios", exact: true }).click();
  await page.getByRole("button", { name: "Gerar preview" }).click();
  await expect(page.getByText("Preview gerado com dados municipais")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar e salvar no Acervo" }).click();
  await expect.poll(() => mock.state.reportArchiveCount).toBe(1);
});

test("ELO abre com contexto municipal autorizado sem expor IDs", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page);
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Assistente ELO", exact: true }).click();
  await page.getByRole("button", { name: "Perguntar ao ELO" }).nth(1).click();
  await expect(page.getByText("Contexto municipal autorizado. Use o chat ELO existente para consultar estoque", { exact: false })).toBeVisible();
  await expect(page.getByText("institution_id")).toHaveCount(0);
  await expect(page.getByText("unit_id")).toHaveCount(0);
});

test("gestor nao ve unidade externa no painel integrado", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page, { role: "gestor" });
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByText("Almox Central").first()).toBeVisible();
  await expect(page.getByText("Almox Distrital")).toHaveCount(0);
  await page.getByRole("button", { name: "Sentinela", exact: true }).click();
  await expect(page.getByText("Tenant B")).toHaveCount(0);
});

test("leitura ve dashboard e nao executa escritas", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page, { role: "leitura" });
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visao Geral" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Relatorios", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Notificacoes", exact: true }).click();
  await page.getByRole("button", { name: "Marcar como lida" }).click();
  await expect(page.getByText("Notificacao lida.")).toBeVisible();
});

test("falha parcial nao derruba a visao geral", async ({ page }) => {
  await installSession(page);
  await mockMunicipalApi(page, { assetsFail: true, documentsFail: true, shelfFailUnit: "unit-a" });
  await page.goto(pageUrl);
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visao Geral" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => { const s = window.MunicipalAdminUi && window.MunicipalAdminUi.getStateForTest(); return [s && s.documentsError, s && s.assetsError, Object.values(s && s.shelfByUnit || {}).map((item) => item && item.error).join(" ")].filter(Boolean).join(" "); })).not.toBe("");
  await page.getByRole("button", { name: "Visao Geral", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Visao Geral" })).toBeVisible();
});
