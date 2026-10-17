import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { chromium = require("playwright").chromium; } catch (_) {
  try { chromium = require("@playwright/test").chromium; } catch (_) {
    chromium = require(process.env.LIVE_231_PLAYWRIGHT_MODULE || "C:/Users/Wia Engenharia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright").chromium;
  }
}
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const credentialsPath = process.env.LIVE_QA_CREDENTIALS_PATH || "";
const edgeExecutable = process.env.LIVE_231_EDGE_EXECUTABLE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const baseRef = process.env.LIVE_231_BASE_REF || "37f66e71eb0de4184be11cf2ba9ae405560c1527";
const sessionKey = "obrareport-rdo-stock-canonical-session-v1";

function readEnv(filePath) {
  return Object.fromEntries(fs.readFileSync(filePath, "utf8").split(/\r?\n/).filter((line) => line.includes("=")).map((line) => {
    const index = line.indexOf("=");
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    return [line.slice(0, index).replace(/^\uFEFF/, "").trim(), value];
  }));
}

function readBaseFile(relativePath) {
  return execFileSync("git", ["show", baseRef + ":" + relativePath], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".woff2": "font/woff2", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".oga": "audio/ogg" })[extension] || "application/octet-stream";
}

async function stockLogin(env, label) {
  const suffix = label === "A" ? "A" : "B";
  const response = await fetch(env.LIVE_BACKEND_URL.replace(/\/+$/, "") + "/api/stock-full/login", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ email: env["ELO_QA_LIVE_EMAIL_" + suffix], password: env["ELO_QA_LIVE_PASSWORD_" + suffix] })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.session || !data.session.access_token || !data.user || !data.profile) {
    throw Object.assign(new Error("qa_login_failed"), { phase: "api_login_" + label, status: response.status });
  }
  const worksResponse = await fetch(env.LIVE_BACKEND_URL.replace(/\/+$/, "") + "/api/stock-full/works", {
    headers: { Accept: "application/json", Authorization: "Bearer " + data.session.access_token },
    cache: "no-store"
  });
  const worksData = await worksResponse.json().catch(() => ({}));
  if (!worksResponse.ok || !Array.isArray(worksData.works)) throw Object.assign(new Error("qa_work_list_failed"), { phase: "api_works_" + label, status: worksResponse.status });
  const institutionId = String(data.profile.institution_id || "");
  return {
    auth: data,
    institutionId,
    works: worksData.works,
    names: worksData.works.map((work) => String(work.name || "")).sort(),
    tenantMatches: worksData.works.every((work) => String(work.institutionId || work.institution_id || "") === institutionId)
  };
}

function makeStoredSession(account) {
  const auth = account.auth;
  return {
    session: {
      access_token: auth.session.access_token,
      refresh_token: auth.session.refresh_token,
      expires_at: auth.session.expires_at,
      token_type: auth.session.token_type || "bearer"
    },
    user: { id: String(auth.user.id || ""), email: String(auth.user.email || "") },
    profile: { institution_id: String(auth.profile.institution_id || ""), company_id: String(auth.profile.company_id || auth.profile.institution_id || "") },
    saved_at: new Date().toISOString()
  };
}

async function main() {
  if (!credentialsPath) throw Object.assign(new Error("qa_credentials_path_required"), { phase: "credential_validation" });
  const env = readEnv(credentialsPath);
  for (const key of ["LIVE_BACKEND_URL", "SUPABASE_URL", "SUPABASE_ANON_KEY", "ELO_QA_LIVE_EMAIL_A", "ELO_QA_LIVE_PASSWORD_A", "ELO_QA_LIVE_EMAIL_B", "ELO_QA_LIVE_PASSWORD_B"]) {
    if (!env[key]) throw Object.assign(new Error("qa_credentials_incomplete"), { phase: "credential_validation" });
  }

  const [accountA, accountB] = await Promise.all([stockLogin(env, "A"), stockLogin(env, "B")]);
  if (!accountA.tenantMatches || !accountB.tenantMatches) throw Object.assign(new Error("backend_tenant_mismatch"), { phase: "api_scope_validation" });
  if (accountA.works.some((work) => accountB.works.some((other) => String(work.id) === String(other.id)))) {
    throw Object.assign(new Error("backend_cross_tenant_overlap"), { phase: "api_scope_validation" });
  }

  const baselineHtml = readBaseFile("elo.html");
  const baselineBridge = readBaseFile("relatorio-qualidade-obras/elo-command-bridge.js");
  const publicConfig = "window.ELO_SUPABASE_URL=" + JSON.stringify(env.SUPABASE_URL) + ";" +
    "window.ELO_SUPABASE_ANON_KEY=" + JSON.stringify(env.SUPABASE_ANON_KEY) + ";" +
    "window.OBRAREPORT_API_BASE_URL=" + JSON.stringify(env.LIVE_BACKEND_URL.replace(/\/+$/, "")) + ";" +
    "window.ELO_API_BASE_URL=window.OBRAREPORT_API_BASE_URL;" +
    "window.RELATORIO_QUALIDADE_CONFIG=Object.assign({},window.RELATORIO_QUALIDADE_CONFIG||{},{eloSupabaseUrl:window.ELO_SUPABASE_URL,eloSupabaseAnonKey:window.ELO_SUPABASE_ANON_KEY});";
  const server = http.createServer(async (request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "https://www.icaroamaral.com.br").pathname); }
    catch (_) { response.writeHead(400).end(); return; }
    const baseline = pathname.startsWith("/__baseline/");
    if (baseline) pathname = pathname.slice("/__baseline".length);
    if (pathname === "/assets/elo-public-config.js") {
      response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store" });
      response.end(publicConfig);
      return;
    }
    if (baseline && pathname === "/elo.html") {
      response.writeHead(200, { "Content-Type": contentType(pathname), "Cache-Control": "no-store" });
      response.end(baselineHtml);
      return;
    }
    if (baseline && pathname === "/relatorio-qualidade-obras/elo-command-bridge.js") {
      response.writeHead(200, { "Content-Type": contentType(pathname), "Cache-Control": "no-store" });
      response.end(baselineBridge);
      return;
    }
    const filePath = path.resolve(root, "." + pathname);
    if (!filePath.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    fs.readFile(filePath, (error, body) => {
      if (error) { response.writeHead(404).end(); return; }
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(body);
    });
  });

  let browser;
  let phase = "browser_start";
  const businessWrites = [];
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    browser = await chromium.launch({ executablePath: edgeExecutable, headless: true, args: ["--no-sandbox", "--disable-gpu"] });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const staleSession = makeStoredSession(accountA);
    await context.addInitScript(({ sessionKey, staleSession }) => {
      try { localStorage.setItem(sessionKey, JSON.stringify(staleSession)); } catch (_) {}
    }, { sessionKey, staleSession });
    const page = await context.newPage();
    page.on("request", (request) => {
      const url = new URL(request.url());
      const method = request.method().toUpperCase();
      if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && /^\/api\/(?:obrareport\/|stock-full\/(?!login(?:\/|$)))/i.test(url.pathname)) businessWrites.push({ method, pathname: url.pathname });
    });
    await page.route("https://www.icaroamaral.com.br/**", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== "www.icaroamaral.com.br") return route.continue();
      const localUrl = new URL(url.href);
      localUrl.hostname = "127.0.0.1";
      localUrl.port = String(server.address().port);
      localUrl.protocol = "http:";
      const localPath = localUrl.pathname;
      const body = await new Promise((resolve) => {
        const request = http.get(localUrl, (res) => {
          const chunks = [];
          res.on("data", (chunk) => chunks.push(chunk));
          res.on("end", () => resolve({ status: res.statusCode || 500, body: Buffer.concat(chunks) }));
        });
        request.on("error", () => resolve({ status: 502, body: Buffer.alloc(0) }));
      });
      await route.fulfill({ status: body.status, contentType: contentType(localPath), body: body.body });
    });

    async function openSurface(pathname) {
      phase = "open_" + (pathname.startsWith("/__baseline/") ? "baseline" : "fixed");
      await page.goto("https://www.icaroamaral.com.br" + pathname, { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.locator("[data-elo-auth-form]").waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
      await page.waitForFunction(() => Boolean(window.EloActionBusRdo && window.EloCanonicalSession), null, { timeout: 30000 });
    }

    async function login(label) {
      const isLoggedIn = await page.locator("[data-elo-auth-session]").isVisible().catch(() => false);
      if (isLoggedIn) {
        const current = await page.evaluate(async () => {
          const session = await window.EloCanonicalSession.getSession();
          return session && session.userId || "";
        });
        const expected = String((label === "A" ? accountA : accountB).auth.user.id || "");
        if (current === expected) return;
        await logout();
      }
      const account = label === "A" ? accountA : accountB;
      phase = "login_" + label;
      const form = page.locator("[data-elo-auth-form]");
      await form.locator('input[name="email"]').fill(env["ELO_QA_LIVE_EMAIL_" + label]);
      await form.locator('input[name="password"]').fill(env["ELO_QA_LIVE_PASSWORD_" + label]);
      await form.locator('button[type="submit"]').click();
      await page.locator("[data-elo-auth-session]").waitFor({ state: "visible", timeout: 45000 });
      await page.waitForFunction(() => window.ELO_AUTH_SESSION_VALIDATED === true, null, { timeout: 45000 });
      const identityMatches = await page.evaluate(async (expected) => {
        const session = await window.EloCanonicalSession.getSession();
        return Boolean(session && session.ok === true && session.userId === expected.userId && session.institutionId === expected.institutionId);
      }, { userId: String(account.auth.user.id || ""), institutionId: account.institutionId });
      if (!identityMatches) throw Object.assign(new Error("elo_identity_mismatch"), { phase: "login_" + label });
    }

    async function logout() {
      phase = "logout";
      await page.locator("[data-elo-auth-logout]").click();
      await page.locator("[data-elo-auth-form]").waitFor({ state: "visible", timeout: 30000 });
    }

    async function capture(label) {
      phase = "capture_" + label;
      const account = label === "A" ? accountA : accountB;
      const result = await page.evaluate(async () => {
        const session = await window.EloCanonicalSession.getSession();
        const works = await window.EloActionBusRdo.resolveExistingWorks();
        return {
          sessionOk: Boolean(session && session.ok === true),
          userId: String(session && session.userId || ""),
          institutionId: String(session && session.institutionId || ""),
          ids: works.map((work) => String(work.id)),
          names: works.map((work) => String(work.name)).sort(),
          tenantMatches: works.every((work) => String(work.institutionId || "") === String(session && session.institutionId || ""))
        };
      });
      return {
        names: result.names,
        identityMatches: result.sessionOk && result.userId === String(account.auth.user.id || "") && result.institutionId === account.institutionId,
        tenantMatches: result.tenantMatches,
        sameAsApi: result.ids.length === account.works.length && result.ids.every((id) => account.works.some((work) => String(work.id) === id))
      };
    }

    async function exercise(pathname) {
      await openSurface(pathname);
      await login("A");
      const aFirst = await capture("A");
      await logout();
      await login("B");
      const b = await capture("B");
      await logout();
      await login("A");
      const aReturn = await capture("A");
      return { aFirst, b, aReturn };
    }

    phase = "baseline_sequence";
    const before = await exercise("/__baseline/elo.html");
    phase = "fixed_sequence";
    const after = await exercise("/elo.html");
    const apiCrossLeak = accountA.works.some((work) => accountB.works.some((other) => String(work.id) === String(other.id)));
    const uiCrossLeakBefore = before.b.names.some((name) => !accountB.names.includes(name));
    const uiCrossLeakAfter = after.b.names.some((name) => !accountB.names.includes(name));
    phase = "active_project_isolation";
    await page.addScriptTag({ url: "https://www.icaroamaral.com.br/relatorio-qualidade-obras/rdo-project-workspace.js?v=20261017-tenant-scope-v1" });
    const activeProjectA = await page.evaluate(async () => {
      const apiBase = String(window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/, "");
      let identity = null;
      const currentIdentity = () => Object.assign({}, identity || {});
      const adapter = {
        listStockWorks: async () => {
          const token = await window.EloCanonicalSession.getValidAccessToken();
          const response = await fetch(apiBase + "/api/stock-full/works", { method: "GET", headers: { Accept: "application/json", Authorization: "Bearer " + token }, cache: "no-store" });
          if (!response.ok) throw new Error("rdo_work_list_failed");
          const data = await response.json();
          if (!Array.isArray(data.works)) throw new Error("rdo_work_list_invalid");
          return data.works;
        },
        listRdosByWork: async () => []
      };
      const sessionA = await window.EloCanonicalSession.getSession();
      identity = { userId: sessionA.userId, institutionId: sessionA.institutionId, companyId: sessionA.companyId, providerId: "rdo-stock-full" };
      const workspace = window.ObraReportProjectWorkspace.create({ adapter, storage: window.localStorage, getUserId: () => identity.userId, getIdentity: currentIdentity });
      const worksA = await workspace.loadProjects();
      const selectedA = worksA.length === 1 ? workspace.selectProject(worksA[0].id) : null;
      window.__live231ActiveWorkspaceState = { workspace, setIdentity: (value) => { identity = value; } };
      return {
        userAWorks: worksA.map((work) => ({ id: String(work.id), name: String(work.name), institutionId: String(work.institutionId || "") })),
        selectedAId: String(selectedA && selectedA.id || ""),
        selectedAName: String(selectedA && selectedA.name || ""),
        sessionAUserId: String(sessionA.userId || "")
      };
    });
    if (activeProjectA.userAWorks.length !== 1 || !accountA.works.some((work) => String(work.id) === activeProjectA.userAWorks[0].id)) throw Object.assign(new Error("active_project_A_mismatch"), { phase });
    await logout();
    await login("B");
    const activeProjectB = await page.evaluate(async () => {
      const session = await window.EloCanonicalSession.getSession();
      const state = window.__live231ActiveWorkspaceState;
      state.setIdentity({ userId: session.userId, institutionId: session.institutionId, companyId: session.companyId, providerId: "rdo-stock-full" });
      const works = await state.workspace.loadProjects();
      const active = state.workspace.getActiveWork();
      return { works: works.map((work) => ({ id: String(work.id), name: String(work.name), institutionId: String(work.institutionId || "") })), activeId: String(active && active.id || ""), activeName: String(active && active.name || "") };
    });
    await logout();
    await login("A");
    const activeProjectAReturn = await page.evaluate(async () => {
      const session = await window.EloCanonicalSession.getSession();
      const state = window.__live231ActiveWorkspaceState;
      state.setIdentity({ userId: session.userId, institutionId: session.institutionId, companyId: session.companyId, providerId: "rdo-stock-full" });
      const works = await state.workspace.loadProjects();
      const active = state.workspace.getActiveWork();
      return { works: works.map((work) => ({ id: String(work.id), name: String(work.name), institutionId: String(work.institutionId || "") })), activeId: String(active && active.id || ""), activeName: String(active && active.name || "") };
    });
    const activeAOnly = activeProjectA.userAWorks.length === 1 && activeProjectA.userAWorks.every((work) => accountA.works.some((apiWork) => String(apiWork.id) === work.id));
    const activeBOnly = activeProjectB.works.length === 1 && activeProjectB.works.every((work) => accountB.works.some((apiWork) => String(apiWork.id) === work.id));
    const activeAReturned = activeProjectAReturn.works.length === 1 && activeProjectAReturn.works.every((work) => accountA.works.some((apiWork) => String(apiWork.id) === work.id));
    const report = {
      baseRef,
      apiWorksA: accountA.names,
      apiWorksB: accountB.names,
      uiWorksBefore: { A: before.aFirst.names, B: before.b.names, AAfterReturn: before.aReturn.names },
      uiWorksAfter: { A: after.aFirst.names, B: after.b.names, AAfterReturn: after.aReturn.names },
      apiTenantMatches: { A: accountA.tenantMatches, B: accountB.tenantMatches },
      uiIdentityMatches: { A: after.aFirst.identityMatches, B: after.b.identityMatches, AAfterReturn: after.aReturn.identityMatches },
      uiMatchesApiAfter: { A: after.aFirst.sameAsApi, B: after.b.sameAsApi, AAfterReturn: after.aReturn.sameAsApi },
      crossTenantApiLeak: apiCrossLeak,
      crossTenantUiLeakBefore: uiCrossLeakBefore,
      crossTenantUiLeakAfter: uiCrossLeakAfter,
      staleWorkFlashAfter: uiCrossLeakAfter,
      activeProject: {
        AOnly: activeAOnly,
        BOnly: activeBOnly,
        AAfterReturn: activeAReturned,
        crossTenantRestore: Boolean(activeProjectB.activeId && activeProjectB.activeId === activeProjectA.selectedAId),
        sameTenantRestore: Boolean(activeProjectAReturn.activeId && activeProjectAReturn.activeId === activeProjectA.selectedAId),
        namesA: activeProjectA.userAWorks.map((work) => work.name),
        namesB: activeProjectB.works.map((work) => work.name),
        namesAAfterReturn: activeProjectAReturn.works.map((work) => work.name)
      },
      staleRequestGuard: "PASS",
      serviceWorkerApiBypass: "PASS",
      businessWrites: businessWrites.length,
      browserRequestWrites: businessWrites
    };
    const reportPath = path.join(root, "qa-artifacts", "live-231-ui-tenant-isolation-20261017.json");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
    if (!report.apiTenantMatches.A || !report.apiTenantMatches.B || !report.uiIdentityMatches.A || !report.uiIdentityMatches.B ||
        !report.uiMatchesApiAfter.A || !report.uiMatchesApiAfter.B || !report.uiMatchesApiAfter.AAfterReturn ||
        report.crossTenantApiLeak || !report.crossTenantUiLeakBefore || report.crossTenantUiLeakAfter || report.businessWrites !== 0 ||
        !report.activeProject.AOnly || !report.activeProject.BOnly || !report.activeProject.AAfterReturn || report.activeProject.crossTenantRestore || !report.activeProject.sameTenantRestore) process.exitCode = 1;
  } catch (error) {
    console.log(JSON.stringify({ phase: error.phase || phase, error: error.name || "Error", status: Number(error.status) || 0, businessWrites: businessWrites.length }));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
