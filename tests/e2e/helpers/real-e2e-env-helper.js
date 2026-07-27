import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadE2eEnv, validateE2eEnv } from "../../../scripts/e2e/validate-e2e-env.mjs";

const require = createRequire(new URL("../../../backend/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

export const E2E_RUN_ID = process.env.E2E_RUN_ID || `real_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
export const STATE_PATH = resolve("backend/data/e2e-test-state.json");
export const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT || 3579);
export const BACKEND_BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let backendProcess = null;
let cachedContext = null;

export function sha256(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

export function sanitize(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, "Bearer [redacted]")
    .replace(/eyJ[A-Za-z0-9._-]+/g, "[jwt-redacted]")
    .replace(/(SUPABASE_(?:ANON|SERVICE_ROLE)_KEY|E2E_ADMIN_PASSWORD)\s*[:=]\s*[^,\s}]+/g, "$1=[redacted]");
}

export function forbiddenTextPattern() {
  return /\bNaN\b|undefined|\[object Object\]|sessionIntent|sessionTheme|meta_web_search|Ready for cost|Auditoria técnica V3|Authorization|Bearer\s+[A-Za-z0-9._-]+|service role|stack trace/i;
}

export function assertNoForbiddenText(expect, value) {
  expect(sanitize(value)).not.toMatch(forbiddenTextPattern());
}

async function waitForBackend() {
  const deadline = Date.now() + 20_000;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/api/health`);
      if (response.ok) return;
      lastError = new Error(`backend_status_${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 300));
  }
  throw lastError || new Error("backend_not_ready");
}

export async function createRealE2eContext() {
  if (cachedContext) return cachedContext;
  const { env, envPath } = loadE2eEnv([], process.env);
  const validation = validateE2eEnv(env);
  if (!validation.ok) throw new Error("Ambiente E2E inseguro ou incompleto.");
  if (!existsSync(STATE_PATH)) throw new Error("Estado E2E ausente. Rode setup antes da suite real.");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await supabaseAnon.auth.signInWithPassword({ email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD });
  if (signIn.error) throw new Error(`Login E2E falhou: ${signIn.error.message}`);

  if (state.ids.profileId && state.ids.institutionId) {
    const repair = await supabaseAdmin
      .from("profiles")
      .update({ institution_id: state.ids.institutionId, unit_id: state.ids.unitId || null })
      .eq("id", state.ids.profileId)
      .eq("auth_user_id", state.ids.authUserId)
      .select("id,institution_id,company_id,unit_id")
      .maybeSingle();
    if (repair.error) throw new Error(`Profile E2E incompleto: ${repair.error.message}`);
  }

  backendProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: resolve("backend"),
    env: { ...process.env, ...env, PORT: String(BACKEND_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  backendProcess.stdout.on("data", () => {});
  backendProcess.stderr.on("data", () => {});
  await waitForBackend();

  cachedContext = {
    envPath,
    env,
    state,
    supabaseAdmin,
    supabaseAnon,
    session: signIn.data.session,
    runId: E2E_RUN_ID,
    backendBaseUrl: BACKEND_BASE_URL,
    authHeader: { authorization: `Bearer ${signIn.data.session.access_token}` },
    stockScope: state.ids.stockFullInstitutionId || state.ids.institutionId || state.slug,
    obraHeaders: { "x-institution-id": state.slug, "x-user-id": state.ids.authUserId },
    budgetHeaders: { "x-institution-id": state.slug, "x-user-id": state.ids.authUserId }
  };
  return cachedContext;
}

export function stopRealE2eBackend() {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  backendProcess = null;
  cachedContext = null;
}

export async function apiJson(request, method, path, body, headers = {}) {
  const response = await request.fetch(`${BACKEND_BASE_URL}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    data: body === undefined ? undefined : body
  });
  let data;
  try { data = await response.json(); } catch (_) { data = { raw: await response.text() }; }
  return { response, data, status: response.status(), path, method };
}

export async function createStockItem(request, ctx, suffix = randomUUID().slice(0, 8), quantity = 0) {
  const result = await apiJson(request, "POST", "/api/stock-full/items", {
    name: `E2E ${ctx.runId} ${suffix}`,
    unit: "un",
    category: "E2E",
    minQuantity: 1,
    currentQuantity: quantity,
    location: "Deposito E2E",
    notes: ctx.runId
  }, ctx.authHeader);
  return result;
}

export async function getStockItem(request, ctx, id) {
  const list = await apiJson(request, "GET", "/api/stock-full/items", undefined, ctx.authHeader);
  return (list.data.items || []).find((item) => item.id === id) || null;
}