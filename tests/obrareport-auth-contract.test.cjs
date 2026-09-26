const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const script = fs.readFileSync(path.join(root, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
const html = fs.readFileSync(path.join(root, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html"), "utf8");

function loginHandlerSource() {
  const start = script.indexOf('loginForm.addEventListener("submit"');
  const end = script.indexOf('if (logoutButton)', start);
  assert.notEqual(start, -1, "login handler must exist");
  assert.notEqual(end, -1, "login handler must have a bounded end");
  return script.slice(start, end);
}

test("ObraReport auth requires backend credentials", () => {
  const handler = loginHandlerSource();
  assert.match(handler, /if \(!informedEmail \|\| !password\)/);
  assert.match(handler, /cloudApi_\("auth\.login"/);
  assert.match(handler, /cloudApi_\("sync\.get"/);
  assert.doesNotMatch(handler, /loginLocalFallback_\(/);
  assert.doesNotMatch(handler, /local@obrareport\.app/);
});

test("backend auth failure stays on login and clears only the password field", () => {
  const handler = loginHandlerSource();
  assert.match(handler, /revokeLocalAccessSession_\(\)/);
  assert.match(handler, /passwordInput\.value = ""/);
  assert.match(handler, /setLoginAccessStatus_\(message, "error"\)/);
  assert.match(handler, /showLoginPanel_\(\)/);
});

test("a stored local-only session cannot silently open a private route", () => {
  const start = script.indexOf('if (appState.session && appState.session.token)');
  const end = script.indexOf('return;', start);
  const branch = script.slice(start, end);
  assert.match(branch, /refreshCloudState_\(\)/);
  assert.match(branch, /revokeLocalAccessSession_\(\)/);
  assert.match(branch, /showLoginPanel_\(\)/);
  assert.doesNotMatch(branch, /setCloudStatus_\("Modo local ativo"/);

  const accessStart = script.indexOf("function hasAuthenticatedSession_()");
  const accessEnd = script.indexOf("function hasRouteAccess_()", accessStart);
  const access = script.slice(accessStart, accessEnd);
  assert.match(access, /appState\.session\.token/);
  assert.match(access, /appState\.session\.localOnly !== true/);
});

test("login copy does not describe the private route as local-only", () => {
  assert.doesNotMatch(html, /A senha protege a área interna neste navegador/);
  assert.match(html, /O acesso é validado pelo backend/);
});
