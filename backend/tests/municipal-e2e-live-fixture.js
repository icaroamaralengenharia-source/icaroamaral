import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadE2eEnv, validateE2eEnv } from "../../scripts/e2e/validate-e2e-env.mjs";

const require = createRequire(new URL("../package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");

export const AUTHORIZED_PROJECT_REF = "mplpzyalcxhhinuvjthx";
export const FORBIDDEN_PROJECT_REF = "lidueokjpzxdybtongbk";
export const LIVE_PREFIX = "HOMOLOGACAO_FUNCIONAL_43_";
export const BACKEND_PORT = Number(process.env.MUNICIPAL_E2E_LIVE_PORT || 3583);
export const BACKEND_BASE_URL = `http://127.0.0.1:${BACKEND_PORT}`;

let backendProcess = null;
let cachedFixture = null;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function projectRefFromUrl(value) {
  const url = new URL(clean(value));
  const host = url.hostname.toLowerCase();
  const match = host.match(/^([a-z0-9]+)\.supabase\.co$/);
  return match ? match[1] : "";
}

function assertSafeE2eEnv(env) {
  const validation = validateE2eEnv(env);
  if (!validation.ok) throw new Error("E2E_ENV_INVALID");
  const ref = projectRefFromUrl(env.SUPABASE_URL);
  if (ref !== AUTHORIZED_PROJECT_REF) throw new Error(`PROJECT_REF_MISMATCH:${ref || "unknown"}`);
  const serialized = JSON.stringify({
    SUPABASE_URL: env.SUPABASE_URL,
    E2E_ENVIRONMENT: env.E2E_ENVIRONMENT,
    E2E_ALLOW_WRITES: env.E2E_ALLOW_WRITES,
    E2E_TENANT_SLUG: env.E2E_TENANT_SLUG
  });
  if (serialized.includes(FORBIDDEN_PROJECT_REF)) throw new Error("FORBIDDEN_PROJECT_REF_PRESENT");
  if (env.E2E_ENVIRONMENT !== "test") throw new Error("E2E_ENVIRONMENT_NOT_TEST");
  if (env.E2E_ALLOW_WRITES !== "true") throw new Error("E2E_WRITES_NOT_ALLOWED");
  return ref;
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
  throw lastError || new Error("BACKEND_NOT_READY");
}

async function signIn(supabaseAnon, email, password) {
  const result = await supabaseAnon.auth.signInWithPassword({ email, password });
  if (result.error || !result.data.session) throw new Error(`E2E_LOGIN_FAILED:${email}`);
  return result.data.session.access_token;
}

async function requiredSingle(query, code) {
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`${code}:${error.message}`);
  if (!data) throw new Error(code);
  return data;
}

async function loadScopedProfiles(supabaseAdmin, institutionId) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id,auth_user_id,institution_id,unit_id,email,role,status")
    .eq("institution_id", institutionId)
    .in("role", ["platform_admin", "gestor", "leitura"]);
  if (error) throw new Error(`PROFILE_LOOKUP_FAILED:${error.message}`);
  return data || [];
}
async function ensureLeituraProfile(supabaseAdmin, env, institutionId, unitId) {
  const email = "leitura@elo-e2e.test";
  const existingProfile = await supabaseAdmin
    .from("profiles")
    .select("id,auth_user_id,institution_id,unit_id,email,role,status")
    .eq("email", email)
    .maybeSingle();
  if (existingProfile.error) throw new Error(`E2E_LEITURA_PROFILE_LOOKUP_FAILED:${existingProfile.error.message}`);
  if (existingProfile.data) return existingProfile.data;

  const users = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (users.error) throw new Error(`E2E_AUTH_USERS_LOOKUP_FAILED:${users.error.message}`);
  let user = (users.data.users || []).find((item) => clean(item.email).toLowerCase() === email);
  if (!user) {
    const created = await supabaseAdmin.auth.admin.createUser({
      email,
      password: env.E2E_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { name: "Leitura E2E" }
    });
    if (created.error) throw new Error(`E2E_LEITURA_CREATE_FAILED:${created.error.message}`);
    user = created.data.user;
  }
  const inserted = await supabaseAdmin
    .from("profiles")
    .insert({
      auth_user_id: user.id,
      institution_id: institutionId,
      unit_id: unitId,
      name: "Leitura E2E",
      email,
      role: "leitura",
      status: "active"
    })
    .select("id,auth_user_id,institution_id,unit_id,email,role,status")
    .single();
  if (inserted.error) throw new Error(`E2E_LEITURA_PROFILE_CREATE_FAILED:${inserted.error.message}`);
  return inserted.data;
}

function fxUnitIdForLeitura(units) {
  return units && units[0] && units[0].id ? units[0].id : null;
}

function maskId(value) {
  const id = clean(value);
  if (id.length <= 12) return id ? `${id.slice(0, 4)}...` : "";
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

export function makeLiveName(label) {
  return `${LIVE_PREFIX}${label}_${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`.replace(/[^A-Za-z0-9_-]/g, "_");
}

export async function createMunicipalLiveFixture() {
  if (cachedFixture) return cachedFixture;
  const { env } = loadE2eEnv([], process.env);
  const projectRef = assertSafeE2eEnv(env);
  const state = JSON.parse(readFileSync(resolve("backend/data/e2e-test-state.json"), "utf8"));

  const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const supabaseAnon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const institution = await requiredSingle(
    supabaseAdmin.from("institutions").select("id,name,status").eq("name", "HOMOLOGACAO_PREFEITURA_E2E"),
    "E2E_INSTITUTION_NOT_FOUND"
  );
  let { data: units, error: unitsError } = await supabaseAdmin
    .from("units")
    .select("id,institution_id,name,code,status")
    .eq("institution_id", institution.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (unitsError) throw new Error(`E2E_UNITS_LOOKUP_FAILED:${unitsError.message}`);
  if (!Array.isArray(units)) units = [];
  if (units.length < 2) {
    const code = makeLiveName("UNIDADE_B");
    const { data: createdUnit, error: createUnitError } = await supabaseAdmin
      .from("units")
      .insert({
        institution_id: institution.id,
        name: `${LIVE_PREFIX}UNIDADE_TRANSFERENCIA`,
        code,
        address: "Unidade funcional E2E para transferencia patrimonial",
        status: "active"
      })
      .select("id,institution_id,name,code,status")
      .single();
    if (createUnitError) throw new Error(`E2E_SECOND_UNIT_CREATE_FAILED:${createUnitError.message}`);
    units = units.concat(createdUnit);
  }

  const profiles = await loadScopedProfiles(supabaseAdmin, institution.id);
  const platformProfile = await requiredSingle(
    supabaseAdmin.from("profiles").select("id,auth_user_id,institution_id,unit_id,email,role,status").eq("auth_user_id", state.ids.authUserId),
    "E2E_PLATFORM_PROFILE_NOT_FOUND"
  );
  const gestorProfile = profiles.find((row) => row.role === "gestor" && /@elo-e2e\.test$/i.test(row.email || ""));
  const leituraProfile = profiles.find((row) => row.role === "leitura" && /@elo-e2e\.test$/i.test(row.email || "")) || await ensureLeituraProfile(supabaseAdmin, env, institution.id, fxUnitIdForLeitura(units));
  if (!platformProfile) throw new Error("E2E_PLATFORM_PROFILE_NOT_FOUND");
  if (!gestorProfile) throw new Error("E2E_GESTOR_PROFILE_NOT_FOUND");
  if (!leituraProfile) throw new Error("E2E_LEITURA_PROFILE_NOT_FOUND");

  const tokens = {
    platform: await signIn(supabaseAnon, platformProfile.email, env.E2E_ADMIN_PASSWORD),
    gestor: await signIn(supabaseAnon, gestorProfile.email, env.E2E_ADMIN_PASSWORD),
    leitura: await signIn(supabaseAnon, leituraProfile.email, env.E2E_ADMIN_PASSWORD)
  };

  backendProcess = spawn(process.execPath, ["src/server.js"], {
    cwd: resolve("backend"),
    env: {
      ...process.env,
      ...env,
      PORT: String(BACKEND_PORT),
      MUNICIPAL_WHATSAPP_ENABLED: "false",
      MUNICIPAL_EMAIL_ENABLED: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  backendProcess.stdout.on("data", () => {});
  backendProcess.stderr.on("data", () => {});
  await waitForBackend();

  cachedFixture = {
    projectRef,
    env: {
      E2E_ENVIRONMENT: env.E2E_ENVIRONMENT,
      E2E_ALLOW_WRITES: env.E2E_ALLOW_WRITES,
      MUNICIPAL_WHATSAPP_ENABLED: "false",
      MUNICIPAL_EMAIL_ENABLED: "false"
    },
    state,
    supabaseAdmin,
    institution,
    units,
    unitA: units[0],
    unitB: units[1],
    profiles: { platform: platformProfile, gestor: gestorProfile, leitura: leituraProfile },
    tokens,
    auth(role = "platform") {
      return { Authorization: `Bearer ${tokens[role]}`, "Content-Type": "application/json" };
    },
    backendBaseUrl: BACKEND_BASE_URL,
    maskId
  };
  return cachedFixture;
}

export async function apiJson(fixture, role, method, path, body) {
  const response = await fetch(`${fixture.backendBaseUrl}${path}`, {
    method,
    headers: fixture.auth(role),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const data = await response.json().catch(async () => ({ raw: await response.text() }));
  return { response, data, status: response.status };
}

export async function listAudit(fixture, action, targetId = "") {
  let query = fixture.supabaseAdmin
    .from("municipal_admin_audit_log")
    .select("id,action,target_id,institution_id,created_at,metadata")
    .eq("institution_id", fixture.institution.id)
    .eq("action", action)
    .order("created_at", { ascending: false })
    .limit(20);
  if (targetId) query = query.eq("target_id", targetId);
  const { data, error } = await query;
  if (error) throw new Error(`AUDIT_LOOKUP_FAILED:${error.message}`);
  return data || [];
}

export function stopMunicipalLiveFixture() {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  backendProcess = null;
  cachedFixture = null;
}
