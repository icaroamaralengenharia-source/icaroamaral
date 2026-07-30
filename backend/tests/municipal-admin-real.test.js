import assert from "node:assert/strict";
import { test } from "node:test";

const RUN = process.env.RUN_MUNICIPAL_REAL_TESTS === "1";
const REQUIRED = [
  "MUNICIPAL_REAL_BASE_URL",
  "MUNICIPAL_REAL_PLATFORM_TOKEN",
  "MUNICIPAL_REAL_GESTOR_TOKEN",
  "MUNICIPAL_REAL_FUNCIONARIO_TOKEN",
  "MUNICIPAL_REAL_INSTITUTION_ID",
  "MUNICIPAL_REAL_OTHER_INSTITUTION_ID"
];

async function api(method, path, token, body) {
  const response = await fetch(process.env.MUNICIPAL_REAL_BASE_URL.replace(/\/+$/g, "") + path, {
    method,
    headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

test("homologacao municipal real ponta a ponta", { skip: !RUN }, async () => {
  const missing = REQUIRED.filter((key) => !String(process.env[key] || "").trim());
  assert.deepEqual(missing, [], "variaveis reais obrigatorias ausentes");
  assert.equal(process.env.MUNICIPAL_REAL_ENVIRONMENT, "homologacao", "ambiente real deve ser homologacao");

  const platformToken = process.env.MUNICIPAL_REAL_PLATFORM_TOKEN;
  const gestorToken = process.env.MUNICIPAL_REAL_GESTOR_TOKEN;
  const funcionarioToken = process.env.MUNICIPAL_REAL_FUNCIONARIO_TOKEN;
  const institutionId = encodeURIComponent(process.env.MUNICIPAL_REAL_INSTITUTION_ID);
  const otherInstitutionId = encodeURIComponent(process.env.MUNICIPAL_REAL_OTHER_INSTITUTION_ID);

  const platformMe = await api("GET", "/api/municipal-admin/me", platformToken);
  assert.equal(platformMe.response.status, 200);
  assert.equal(platformMe.data.me.role, "platform_admin");

  const gestorMe = await api("GET", "/api/municipal-admin/me", gestorToken);
  assert.equal(gestorMe.response.status, 200);
  assert.equal(gestorMe.data.me.role, "gestor");
  assert.equal(gestorMe.data.me.institution_id, process.env.MUNICIPAL_REAL_INSTITUTION_ID);
  assert.ok(Array.isArray(gestorMe.data.me.allowed_units));

  const ownUsers = await api("GET", `/api/municipal-admin/institutions/${institutionId}/users`, gestorToken);
  assert.equal(ownUsers.response.status, 200);
  assert.ok(ownUsers.data.users.every((user) => user.institution_id === process.env.MUNICIPAL_REAL_INSTITUTION_ID));

  const crossUsers = await api("GET", `/api/municipal-admin/institutions/${otherInstitutionId}/users`, gestorToken);
  assert.equal(crossUsers.response.status, 403);

  const forbiddenInvite = await api("POST", `/api/municipal-admin/institutions/${institutionId}/invites`, gestorToken, { email: "blocked@example.test", role: "platform_admin" });
  assert.equal(forbiddenInvite.response.status, 403);

  const funcionarioMe = await api("GET", "/api/municipal-admin/me", funcionarioToken);
  assert.equal(funcionarioMe.response.status, 403);
});