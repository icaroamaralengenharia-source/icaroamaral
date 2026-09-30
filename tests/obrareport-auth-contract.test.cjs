const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
const html = fs.readFileSync(path.join(root, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html"), "utf8");

function loginHandlerSource() {
  const start = script.indexOf('loginForm.addEventListener("submit"');
  const end = script.indexOf("if (logoutButton)", start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return script.slice(start, end);
}

test("login exige credenciais reais e consulta auth.me", () => {
  const handler = loginHandlerSource();
  assert.match(handler, /cloudApi_\("auth\.login"/);
  assert.match(handler, /cloudApi_\("sync\.get"/);
  assert.match(handler, /cloudApi_\("auth\.me"/);
  assert.doesNotMatch(handler, /loginLocalFallback_\(/);
});

test("falha de backend permanece no login e limpa somente senha", () => {
  const handler = loginHandlerSource();
  assert.match(handler, /passwordInput\.value = ""/);
  assert.match(handler, /revokeLocalAccessSession_\(\)/);
  assert.match(handler, /showLoginPanel_\(\)/);
});

test("sessão local não abre rota privada e role é explícita", () => {
  const accessStart = script.indexOf("function hasAuthenticatedSession_()");
  const accessEnd = script.indexOf("function hasRouteAccess_()", accessStart);
  const access = script.slice(accessStart, accessEnd);
  assert.match(access, /hasExplicitAuthRole_\(currentUser\)/);
  assert.match(access, /appState\.session\.localOnly !== true/);
  assert.match(script, /function hasExplicitAuthRole_\(user\)/);
});

test("frontend não infere admin por ausência ou role desconhecida", () => {
  const start = script.indexOf("function getUserRole_(user)");
  const end = script.indexOf("function isAdminUser_()", start);
  const resolver = script.slice(start, end);
  assert.match(resolver, /role === "admin"/);
  assert.match(resolver, /return ""/);
  assert.doesNotMatch(resolver, /role === "client"\s*\?\s*"client"\s*:\s*"admin"/);
  assert.match(html, /O acesso é validado pelo backend/);
});
