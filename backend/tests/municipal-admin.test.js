import assert from "node:assert/strict";
import { test } from "node:test";
import { createMemoryMunicipalAdminStore, createMunicipalAdminService } from "../src/municipal-admin-service.js";

function ctx(role, overrides = {}) {
  return {
    ok: true,
    userId: overrides.userId || role + "-user",
    institutionId: overrides.institutionId || "inst-a",
    role,
    profile: Object.assign({
      id: overrides.profileId || role + "-profile",
      auth_user_id: overrides.userId || role + "-user",
      institution_id: overrides.institutionId || "inst-a",
      unit_id: overrides.unitId || "",
      role,
      status: overrides.status || "active",
      email: role + "@example.com"
    }, overrides.profile || {})
  };
}

function setup() {
  const store = createMemoryMunicipalAdminStore({
    institutions: [
      { id: "inst-a", name: "Prefeitura A", city: "A", state: "BA", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "inst-b", name: "Prefeitura B", city: "B", state: "BA", status: "active", created_at: "2026-01-01T00:00:00.000Z" }
    ],
    units: [
      { id: "unit-a", institution_id: "inst-a", name: "Almox A", code: "A", status: "active", created_at: "2026-01-01T00:00:00.000Z" },
      { id: "unit-b", institution_id: "inst-b", name: "Almox B", code: "B", status: "active", created_at: "2026-01-01T00:00:00.000Z" }
    ],
    profiles: [
      { id: "profile-platform", auth_user_id: "platform-user", institution_id: "", unit_id: null, role: "platform_admin", status: "active", email: "platform@example.com", name: "Platform" },
      { id: "profile-admin-a", auth_user_id: "admin-a", institution_id: "inst-a", unit_id: null, role: "municipal_admin", status: "active", email: "admin-a@example.com", name: "Admin A" },
      { id: "profile-gestor-a", auth_user_id: "gestor-a", institution_id: "inst-a", unit_id: "unit-a", role: "gestor", status: "active", email: "gestor-a@example.com", name: "Gestor A" },
      { id: "profile-func-a", auth_user_id: "func-a", institution_id: "inst-a", unit_id: null, role: "funcionario", status: "active", email: "func-a@example.com", name: "Func A" },
      { id: "profile-admin-b", auth_user_id: "admin-b", institution_id: "inst-b", unit_id: null, role: "municipal_admin", status: "active", email: "admin-b@example.com", name: "Admin B" }
    ],
    municipal_admin_invites: [],
    municipal_admin_audit_log: []
  });
  return { store, service: createMunicipalAdminService({ store, randomToken: () => "token-fixo", now: () => new Date("2026-01-10T00:00:00.000Z") }) };
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (err) => err && err.code === code);
}

test("platform_admin cria instituicao e usuario comum nao cria", async () => {
  const { service, store } = setup();
  const created = await service.createInstitution(ctx("platform_admin", { userId: "platform-user", institutionId: "" }), { name: "Prefeitura Nova", city: "Salvador", state: "ba", document: "00" });
  assert.equal(created.institution.name, "Prefeitura Nova");
  assert.equal(created.institution.state, "BA");
  assert.equal(store.tables.municipal_admin_audit_log.at(-1).action, "institution_created");
  await rejectsCode(service.createInstitution(ctx("funcionario"), { name: "Bloqueada" }), "platform_admin_required");
});

test("municipal_admin cria unidade apenas na propria instituicao", async () => {
  const { service } = setup();
  const own = await service.createUnit(ctx("municipal_admin", { userId: "admin-a" }), "inst-a", { name: "Almox Central", code: "CENTRAL" });
  assert.equal(own.unit.institution_id, "inst-a");
  await rejectsCode(service.createUnit(ctx("municipal_admin", { userId: "admin-a" }), "inst-b", { name: "Outro" }), "institution_scope_forbidden");
});

test("gestor cria convite de funcionario e nao cria platform_admin", async () => {
  const { service } = setup();
  const invite = await service.createInvite(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "inst-a", { email: "func@example.com", role: "funcionario", unit_id: "unit-a" });
  assert.equal(invite.invite.email, "func@example.com");
  assert.equal(invite.invite_token, "token-fixo");
  assert.equal(invite.invite.token_hash, undefined);
  await rejectsCode(service.createInvite(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "inst-a", { email: "root@example.com", role: "platform_admin" }), "role_assignment_forbidden");
});

test("unit_id de outra instituicao e troca manual de tenant sao rejeitados", async () => {
  const { service } = setup();
  await rejectsCode(service.createInvite(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "inst-a", { email: "x@example.com", role: "funcionario", unit_id: "unit-b" }), "unit_scope_invalid");
  await rejectsCode(service.listUsers(ctx("municipal_admin", { userId: "admin-a" }), "inst-b"), "institution_scope_forbidden");
});

test("convite expirado ou reutilizado e rejeitado", async () => {
  const { service } = setup();
  const expired = createMemoryMunicipalAdminStore({
    institutions: [{ id: "inst-a", name: "A", status: "active" }],
    units: [],
    profiles: [],
    municipal_admin_invites: [{ id: "invite-exp", institution_id: "inst-a", email: "novo@example.com", role: "funcionario", token_hash: "e186eb749c7888bab1d1777bfbd3209756f5a10ec40956c5e789f09450faf659", expires_at: "2026-01-01T00:00:00.000Z", status: "pending" }],
    municipal_admin_audit_log: []
  });
  const expiredService = createMunicipalAdminService({ store: expired, now: () => new Date("2026-01-10T00:00:00.000Z") });
  await rejectsCode(expiredService.acceptInvite("token-fixo", { id: "new-user", email: "novo@example.com" }), "invite_expired");

  const invite = await service.createInvite(ctx("municipal_admin", { userId: "admin-a" }), "inst-a", { email: "novo@example.com", role: "funcionario" });
  const first = await service.acceptInvite(invite.invite_token, { id: "new-user", email: "novo@example.com" });
  assert.equal(first.profile.institution_id, "inst-a");
  await rejectsCode(service.acceptInvite(invite.invite_token, { id: "new-user-2", email: "novo2@example.com" }), "invite_not_found");
});

test("usuario desativado perde acesso", async () => {
  const { service } = setup();
  await rejectsCode(service.me(ctx("gestor", { status: "inactive" })), "user_inactive");
});

test("listagem nao mistura tenants e GET /me retorna somente escopo autorizado", async () => {
  const { service } = setup();
  const users = await service.listUsers(ctx("municipal_admin", { userId: "admin-a" }), "inst-a");
  assert.deepEqual(users.users.map((user) => user.institution_id).filter(Boolean).sort(), ["inst-a", "inst-a", "inst-a"]);
  const me = await service.me(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }));
  assert.equal(me.me.institution_id, "inst-a");
  assert.deepEqual(me.me.allowed_units.map((unit) => unit.id), ["unit-a"]);
});

test("papel e unidades sao validados ao alterar usuario", async () => {
  const { service } = setup();
  await rejectsCode(service.updateUserRole(ctx("gestor", { userId: "gestor-a", unitId: "unit-a" }), "func-a", { role: "municipal_admin" }), "role_assignment_forbidden");
  await rejectsCode(service.updateUserUnits(ctx("municipal_admin", { userId: "admin-a" }), "func-a", { unit_id: "unit-b" }), "unit_scope_invalid");
  const updated = await service.updateUserUnits(ctx("municipal_admin", { userId: "admin-a" }), "func-a", { unit_id: "unit-a" });
  assert.deepEqual(updated.units, ["unit-a"]);
});