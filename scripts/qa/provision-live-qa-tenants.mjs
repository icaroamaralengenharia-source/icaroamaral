import { randomBytes, randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { createRequire } from "node:module";
import { access, chmod, lstat, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const EXPECTED_PROJECT_REF = "mplpzyalcxhhinuvjthx";
export const LIVE_BACKEND_URL = "https://obrareport-backend.onrender.com";
export const USER_ROLE = "gestor";

export const TARGETS = Object.freeze({
  A: Object.freeze({
    tenantName: "ELO_QA_LIVE_TENANT_A",
    email: "elo.qa.live.a@elo-e2e.test",
    role: USER_ROLE,
    workId: "elo_qa_live_work_a",
    workName: "ELO_QA_LIVE_WORK_A",
    marker: "ELO_QA_LIVE_TENANT_A"
  }),
  B: Object.freeze({
    tenantName: "ELO_QA_LIVE_TENANT_B",
    email: "elo.qa.live.b@elo-e2e.test",
    role: USER_ROLE,
    workId: "elo_qa_live_work_b",
    workName: "ELO_QA_LIVE_WORK_B",
    marker: "ELO_QA_LIVE_TENANT_B"
  })
});

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const PRIVATE_DIR = path.join(os.homedir(), ".elo-secrets", "pr231-live-qa");
export const PROVISIONER_CONFIG_PATH = path.join(PRIVATE_DIR, "provisioner.env");
export const QA_CREDENTIALS_PATH = path.join(PRIVATE_DIR, "credentials.env");
export const PRIVATE_MANIFEST_PATH = path.join(PRIVATE_DIR, "manifest.json");
export const DRY_RUN_RECEIPT_PATH = path.join(PRIVATE_DIR, "dry-run-receipt.json");
export const PUBLIC_MANIFEST_PATH = path.join(PROJECT_ROOT, "qa-artifacts", "pr231-live-isolation", "live-qa-provision-manifest.json");

const EXPECTED_CONFIG_KEYS = new Set([
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "LIVE_QA_EXPECTED_PROJECT_REF"
]);

const PRIVATE_STATE_VERSION = 1;
const TENANT_MARKER_PREFIX = "ELO_QA_LIVE:";
const require = createRequire(import.meta.url);
const TEARDOWN_EMPTY_TABLES = Object.freeze([
  "units",
  "municipal_admin_invites",
  "municipal_admin_audit_log",
  "obrareport_clients",
  "obrareport_rdos",
  "obrareport_rdo_versions",
  "obrareport_rdo_events",
  "obrareport_technical_reports",
  "obrareport_report_versions",
  "obrareport_report_events",
  "obrareport_generated_documents",
  "obrareport_document_files",
  "stock_full_items",
  "stock_full_entries",
  "stock_full_exits",
  "stock_full_adjustments",
  "elo_conversations"
]);

export class ProvisionerError extends Error {
  constructor(code) {
    super(code);
    this.name = "ProvisionerError";
    this.code = code;
  }
}

function fail(code) {
  throw new ProvisionerError(code);
}

function clean(value) {
  return String(value ?? "").trim();
}

export function parseEnvText(text) {
  const result = Object.create(null);
  const lines = String(text ?? "").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) fail("secure_config_malformed");
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || Object.hasOwn(result, key)) fail("secure_config_malformed");
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (/[\r\n\0]/.test(value)) fail("secure_config_malformed");
    result[key] = value;
  }
  return result;
}

export function validateConfig(config = {}) {
  const urlValue = clean(config.SUPABASE_URL);
  const anonKey = clean(config.SUPABASE_ANON_KEY);
  const serviceRoleKey = clean(config.SUPABASE_SERVICE_ROLE_KEY);
  const statedProjectRef = clean(config.LIVE_QA_EXPECTED_PROJECT_REF);
  if (!urlValue || !anonKey || !serviceRoleKey || !statedProjectRef) fail("secure_config_incomplete");

  let url;
  try {
    url = new URL(urlValue);
  } catch {
    fail("supabase_url_invalid");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) fail("supabase_url_invalid");

  const projectRef = url.hostname.endsWith(".supabase.co")
    ? url.hostname.slice(0, -".supabase.co".length)
    : "";
  if (projectRef !== EXPECTED_PROJECT_REF || statedProjectRef !== EXPECTED_PROJECT_REF) {
    fail("target_project_mismatch");
  }
  return Object.freeze({
    supabaseUrl: url.origin,
    projectRef,
    anonKey,
    serviceRoleKey
  });
}

export function validateTargets(targets = TARGETS) {
  const names = new Set();
  const emails = new Set();
  const workIds = new Set();
  for (const key of ["A", "B"]) {
    const target = targets[key];
    if (!target || !target.tenantName.startsWith("ELO_QA_LIVE_")) fail("tenant_namespace_invalid");
    if (!/^elo\.qa\.live\.[ab]@elo-e2e\.test$/i.test(target.email)) fail("user_namespace_invalid");
    if (target.role === "platform_admin" || target.role === "superadmin") fail("user_role_forbidden");
    if (names.has(target.tenantName) || emails.has(target.email.toLowerCase()) || workIds.has(target.workId)) {
      fail("duplicate_target_definition");
    }
    names.add(target.tenantName);
    emails.add(target.email.toLowerCase());
    workIds.add(target.workId);
  }
  return true;
}

export function parseMode(argv) {
  const args = [...argv];
  const modes = ["--dry-run", "--apply", "--verify", "--teardown", "--prepare-secrets"];
  const selected = args.filter((arg) => modes.includes(arg));
  if (selected.length !== 1 || args.some((arg) => !modes.includes(arg) && arg !== "--confirm-live-qa")) {
    fail("usage_invalid");
  }
  const mode = selected[0].slice(2);
  const confirmed = args.includes("--confirm-live-qa");
  if (["apply", "teardown"].includes(mode) && !confirmed) fail("live_confirmation_required");
  if (mode === "prepare-secrets" && confirmed) fail("usage_invalid");
  return { mode, confirmed };
}

function errorCode(error) {
  const code = clean(error?.code);
  return /^[A-Za-z0-9_-]{1,40}$/.test(code) ? code : "remote_error";
}

function dataOrFail(result, fallbackCode = "remote_error") {
  if (result?.error) fail(`remote_${errorCode(result.error) || fallbackCode}`);
  return result?.data;
}

function oneOrFail(rows, code) {
  if (!Array.isArray(rows) || rows.length > 1) fail(code);
  return rows[0] || null;
}

function sameId(value, expected) {
  return clean(value) !== "" && clean(value) === clean(expected);
}

function profileMatches(row, target, state) {
  return row &&
    sameId(row.id, state.profileId) &&
    sameId(row.auth_user_id, state.authUserId) &&
    sameId(row.institution_id, state.institutionId) &&
    !clean(row.company_id) &&
    !clean(row.unit_id) &&
    clean(row.email).toLowerCase() === target.email.toLowerCase() &&
    clean(row.role) === target.role &&
    ["active", "ativo"].includes(clean(row.status).toLowerCase());
}

function institutionMatches(row, target, state) {
  return row &&
    sameId(row.id, state.institutionId) &&
    clean(row.name) === target.tenantName &&
    clean(row.document) === `${TENANT_MARKER_PREFIX}${target.marker}` &&
    ["active", "ativo"].includes(clean(row.status).toLowerCase());
}

function workMatches(row, target, state) {
  return row &&
    clean(row.id) === target.workId &&
    clean(row.name) === target.workName &&
    sameId(row.institution_id, state.institutionId) &&
    !clean(row.client_id);
}

export function makeInitialState(projectRef = EXPECTED_PROJECT_REF) {
  const timestamp = new Date().toISOString();
  return {
    version: PRIVATE_STATE_VERSION,
    environment: "LIVE_QA_SYNTHETIC",
    projectRef,
    createdAt: timestamp,
    tenantA: { ...stateForTarget(TARGETS.A), createdAt: timestamp },
    tenantB: { ...stateForTarget(TARGETS.B), createdAt: timestamp }
  };
}

function stateForTarget(target) {
  return {
    tenantName: target.tenantName,
    email: target.email,
    role: target.role,
    institutionId: null,
    institutionCreated: false,
    authUserId: null,
    profileId: null,
    profileCreated: false,
    workId: null,
    workCreated: false
  };
}

function validatePrivateState(state) {
  if (!state || state.version !== PRIVATE_STATE_VERSION || state.environment !== "LIVE_QA_SYNTHETIC" || state.projectRef !== EXPECTED_PROJECT_REF) {
    fail("private_manifest_invalid");
  }
  for (const key of ["A", "B"]) {
    const target = TARGETS[key];
    const item = state[`tenant${key}`];
    if (!item || item.tenantName !== target.tenantName || item.email !== target.email || (item.workId && item.workId !== target.workId) || item.role !== target.role) fail("private_manifest_invalid");
    for (const flag of ["institutionCreated", "profileCreated", "workCreated"]) {
      if (typeof item[flag] !== "boolean") fail("private_manifest_invalid");
    }
  }
  return state;
}

async function validateRemoteSchema(client) {
  await client.inspectSchema();
}

async function inspectTargets(client, state) {
  const result = {};
  for (const key of ["A", "B"]) {
    const target = TARGETS[key];
    const item = state?.[`tenant${key}`] || stateForTarget(target);
    const [institutionRows, profileRows, workRows] = await Promise.all([
      client.findInstitutionsByName(target.tenantName),
      client.findProfilesByEmail(target.email),
      client.findProjectsById(target.workId)
    ]);
    const institution = oneOrFail(institutionRows, "tenant_ambiguous");
    const profile = oneOrFail(profileRows, "profile_ambiguous");
    const work = oneOrFail(workRows, "work_ambiguous");

    if (institution && (!item.institutionId || !institutionMatches(institution, target, item))) fail("tenant_exists_unowned_or_mismatched");
    if (profile && (!item.profileId || !profileMatches(profile, target, item))) fail("profile_exists_unowned_or_mismatched");
    if (work && (!item.institutionId || item.workId !== target.workId || !workMatches(work, target, item))) fail("work_exists_unowned_or_mismatched");
    if (item.institutionId && !institution && item.institutionCreated) fail("manifest_tenant_missing");
    if (item.profileId && !profile && item.profileCreated) fail("manifest_profile_missing");
    if (item.workCreated && !work) fail("manifest_work_missing");

    let authUser = null;
    if (item.authUserId) {
      authUser = await client.getAuthUser(item.authUserId);
      if (
        !authUser ||
        !sameId(authUser.id, item.authUserId) ||
        clean(authUser.email).toLowerCase() !== target.email.toLowerCase() ||
        authUser.user_metadata?.qaNamespace !== target.marker
      ) fail("auth_user_unowned_or_mismatched");
    }
    if (item.authUserId && !item.profileId && profile) fail("profile_exists_unowned_or_mismatched");
    result[key] = { institution, profile, work, authUser };
  }
  const a = state?.tenantA;
  const b = state?.tenantB;
  if (a?.institutionId && b?.institutionId && a.institutionId === b.institutionId) fail("tenant_ids_not_distinct");
  if (a?.authUserId && b?.authUserId && a.authUserId === b.authUserId) fail("user_ids_not_distinct");
  return result;
}

function completeState(state, found) {
  return ["A", "B"].every((key) => {
    const item = state[`tenant${key}`];
    const current = found[key];
    return Boolean(item.institutionId && item.authUserId && item.profileId && current.institution && current.authUser && current.profile && current.work);
  });
}

function maskedId(id) {
  const digest = createHash("sha256").update(String(id), "utf8").digest("hex");
  return `sha256:${digest.slice(0, 16)}`;
}

export function sanitizedManifest(state) {
  validatePrivateState(state);
  const tenant = (item) => ({
    institutionId: item.institutionId ? maskedId(item.institutionId) : "sanitized",
    userId: item.authUserId ? maskedId(item.authUserId) : "sanitized",
    profileId: item.profileId ? maskedId(item.profileId) : "sanitized",
    workId: item.workId ? maskedId(item.workId) : "sanitized"
  });
  return {
    environment: "LIVE_QA_SYNTHETIC",
    tenantA: tenant(state.tenantA),
    tenantB: tenant(state.tenantB),
    realDataTouched: false,
    schemaChanged: false,
    rlsChanged: false
  };
}

export function createDryRunReceipt(now = Date.now()) {
  return {
    version: 1,
    projectRef: EXPECTED_PROJECT_REF,
    targets: [TARGETS.A.tenantName, TARGETS.B.tenantName],
    preflight: "PASS",
    schemaChanged: false,
    rlsChanged: false,
    createdAt: new Date(now).toISOString()
  };
}

export function isDryRunReceiptValid(receipt, now = Date.now()) {
  if (!receipt || receipt.version !== 1 || receipt.projectRef !== EXPECTED_PROJECT_REF || receipt.preflight !== "PASS") return false;
  if (receipt.schemaChanged !== false || receipt.rlsChanged !== false) return false;
  if (JSON.stringify(receipt.targets) !== JSON.stringify([TARGETS.A.tenantName, TARGETS.B.tenantName])) return false;
  const timestamp = Date.parse(receipt.createdAt);
  const age = now - timestamp;
  return Number.isFinite(timestamp) && age >= 0 && age <= 30 * 60 * 1000;
}

function credentialsText(config, credentials) {
  return [
    `SUPABASE_URL=${config.supabaseUrl}`,
    `SUPABASE_ANON_KEY=${config.anonKey}`,
    `ELO_QA_LIVE_EMAIL_A=${TARGETS.A.email}`,
    `ELO_QA_LIVE_PASSWORD_A=${credentials.A}`,
    `ELO_QA_LIVE_EMAIL_B=${TARGETS.B.email}`,
    `ELO_QA_LIVE_PASSWORD_B=${credentials.B}`,
    `LIVE_BACKEND_URL=${LIVE_BACKEND_URL}`,
    ""
  ].join("\n");
}

export function makePassword(random = randomBytes) {
  return random(36).toString("base64url");
}

async function savePublicManifest(state, fsApi = { mkdir, writeFile, rename, rm }) {
  const directory = path.dirname(PUBLIC_MANIFEST_PATH);
  await fsApi.mkdir(directory, { recursive: true });
  const tempPath = `${PUBLIC_MANIFEST_PATH}.${process.pid}.tmp`;
  try {
    await fsApi.writeFile(tempPath, `${JSON.stringify(sanitizedManifest(state), null, 2)}\n`, { flag: "wx", mode: 0o600 });
    await fsApi.rename(tempPath, PUBLIC_MANIFEST_PATH);
  } catch (error) {
    await fsApi.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function writePrivateJson(filePath, value) {
  const tempPath = `${filePath}.${process.pid}.tmp`;
  const body = `${JSON.stringify(value, null, 2)}\n`;
  try {
    await writeFile(tempPath, body, { flag: "wx", mode: 0o600 });
    await chmod(tempPath, 0o600).catch(() => {});
    await rename(tempPath, filePath);
    await chmod(filePath, 0o600).catch(() => {});
  } catch (error) {
    await rm(tempPath, { force: true }).catch(() => {});
    fail("private_manifest_write_failed");
  }
}

async function writePrivateEnv(filePath, body) {
  try {
    await writeFile(filePath, body, { flag: "wx", mode: 0o600 });
    await chmod(filePath, 0o600).catch(() => {});
  } catch (error) {
    if (error?.code === "EEXIST") fail("qa_credentials_already_exist");
    fail("qa_credentials_write_failed");
  }
}

async function readPrivateJsonSecure(filePath) {
  const raw = await readSecureFile(filePath);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    fail("private_manifest_unreadable");
  }
}

async function readSecureFile(filePath, aclVerifier = (target, options) => verifyPrivateAcl(target, execFileSync, options)) {
  try {
    const info = await lstat(filePath);
    if (!info.isFile() || info.isSymbolicLink()) fail("secure_file_invalid");
    if (!(await aclVerifier(filePath, { requireProtected: false }))) fail("secure_file_acl_inadequate");
    await access(filePath, fsConstants.R_OK);
    return await readFile(filePath, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    if (error instanceof ProvisionerError) throw error;
    fail("secure_file_unavailable");
  }
}

async function readPrivateConfig(aclVerifier = (target, options) => verifyPrivateAcl(target, execFileSync, options)) {
  const directoryInfo = await lstat(PRIVATE_DIR).catch((error) => {
    if (error?.code === "ENOENT") return null;
    fail("secure_directory_unavailable");
  });
  if (!directoryInfo) return null;
  if (!directoryInfo.isDirectory() || directoryInfo.isSymbolicLink()) fail("secure_directory_invalid");
  if (!(await aclVerifier(PRIVATE_DIR, { requireProtected: true }))) fail("secure_directory_acl_inadequate");
  const text = await readSecureFile(PROVISIONER_CONFIG_PATH, aclVerifier);
  if (text === null) return null;
  const env = parseEnvText(text);
  for (const key of Object.keys(env)) if (!EXPECTED_CONFIG_KEYS.has(key)) fail("secure_config_key_unexpected");
  return validateConfig(env);
}

async function preparePrivateDirectory(directory = PRIVATE_DIR, options = {}) {
  const platform = options.platform || process.platform;
  const runFile = options.execFileSync || execFileSync;
  const fsApi = options.fsApi || { lstat, mkdir };
  const exists = await fsApi.lstat(directory).then(() => true).catch((error) => {
    if (error?.code === "ENOENT") return false;
    fail("secure_directory_unavailable");
  });
  if (exists) {
    if (options.aclVerifier && await options.aclVerifier(directory, { requireProtected: true })) return;
    if (platform === "win32" && await verifyPrivateAcl(directory, runFile, { requireProtected: true })) return;
    fail("secure_directory_already_exists");
  }
  await fsApi.mkdir(directory, { recursive: false, mode: 0o700 }).catch(() => fail("secure_directory_create_failed"));
  if (platform === "win32") {
    try {
      const who = runFile("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
      const sid = String(who).match(/S-1-5(?:-\d+)+/i)?.[0];
      if (!sid) fail("secure_directory_acl_failed");
      runFile("icacls.exe", [
        directory,
        "/inheritance:r",
        "/grant:r",
        `*${sid}:(OI)(CI)F`,
        "*S-1-5-18:(OI)(CI)F",
        "*S-1-5-32-544:(OI)(CI)F"
      ], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "ignore", "ignore"] });
    } catch {
      fail("secure_directory_acl_failed");
    }
    if (!(await verifyPrivateAcl(directory, runFile, { requireProtected: true }))) fail("secure_directory_acl_failed");
  } else {
    await chmod(directory, 0o700).catch(() => fail("secure_directory_acl_failed"));
    const info = await lstat(directory);
    if ((info.mode & 0o077) !== 0) fail("secure_directory_acl_failed");
  }
}

async function currentWindowsSid(runFile = execFileSync) {
  try {
    const who = runFile("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true });
    return String(who).match(/S-1-5(?:-\d+)+/i)?.[0] || "";
  } catch {
    return "";
  }
}

export async function verifyPrivateAcl(filePath, runFile = execFileSync, { requireProtected = false } = {}) {
  if (process.platform !== "win32") {
    try {
      const info = await lstat(filePath);
      return (info.mode & 0o077) === 0;
    } catch {
      return false;
    }
  }
  const ownerSid = await currentWindowsSid(runFile);
  if (!ownerSid) return false;
  const script = [
    `$p='${String(filePath).replace(/'/g, "''")}'`,
    "$a=if ([System.IO.Directory]::Exists($p)) { [System.IO.Directory]::GetAccessControl($p) } else { [System.IO.File]::GetAccessControl($p) }",
    "$owner=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value",
    "$rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]) | ForEach-Object { [PSCustomObject]@{sid=$_.IdentityReference.Value;type=$_.AccessControlType.ToString()} })",
    "[PSCustomObject]@{owner=$owner;protected=$a.AreAccessRulesProtected;rules=$rules} | ConvertTo-Json -Compress -Depth 4"
  ].join("; ");
  try {
    const output = runFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { encoding: "utf8", windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    const acl = JSON.parse(String(output).trim());
    const allowed = new Set([ownerSid, "S-1-5-18", "S-1-5-32-544"]);
    if (acl.owner !== ownerSid || (requireProtected && acl.protected !== true)) return false;
    const rules = Array.isArray(acl.rules) ? acl.rules : acl.rules ? [acl.rules] : [];
    return rules.every((rule) => allowed.has(rule.sid));
  } catch {
    return false;
  }
}

function makeSupabaseAdapter(config) {
  let createClient;
  try {
    const dependency = requireSupabasePackage();
    createClient = dependency.createClient;
  } catch {
    fail("supabase_client_unavailable");
  }
  const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const getRows = async (table, columns, filterColumn, filterValue) => {
    let query = supabase.from(table).select(columns);
    if (filterColumn) query = query.eq(filterColumn, filterValue);
    const result = await query;
    return dataOrFail(result, `table_${table}`) || [];
  };
  const insertOne = async (table, payload, columns) => {
    const result = await supabase.from(table).insert(payload).select(columns).single();
    return dataOrFail(result, `insert_${table}`);
  };
  const deleteOne = async (table, id, extraColumn, extraValue) => {
    let query = supabase.from(table).delete().eq("id", id);
    if (extraColumn) query = query.eq(extraColumn, extraValue);
    const result = await query.select("id");
    return dataOrFail(result, `delete_${table}`) || [];
  };

  return {
    async inspectSchema() {
      for (const [table, columns] of [
        ["institutions", "id,name,document,city,state,status,created_by"],
        ["profiles", "id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status"],
        ["obrareport_projects", "id,institution_id,client_id,name,address"]
      ]) {
        const result = await supabase.from(table).select(columns).limit(0);
        dataOrFail(result, `schema_${table}`);
      }
    },
    findInstitutionsByName: (name) => getRows("institutions", "id,name,document,status", "name", name),
    findProfilesByEmail: (email) => getRows("profiles", "id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status", "email", email),
    findProfilesByInstitution: (institutionId) => getRows("profiles", "id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status", "institution_id", institutionId),
    findProjectsById: (id) => getRows("obrareport_projects", "id,institution_id,client_id,name,address", "id", id),
    findProjectsByInstitution: (institutionId) => getRows("obrareport_projects", "id,institution_id,client_id,name,address", "institution_id", institutionId),
    async getAuthUser(id) {
      const result = await supabase.auth.admin.getUserById(id);
      const data = dataOrFail(result, "auth_get_user");
      return data?.user || null;
    },
    async createAuthUser({ email, password, marker }) {
      const result = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { qaNamespace: marker, environment: "LIVE_QA_SYNTHETIC" }
      });
      const data = dataOrFail(result, "auth_create_user");
      if (!data?.user?.id) fail("auth_create_user_incomplete");
      return data.user;
    },
    async deleteAuthUser(id) {
      const result = await supabase.auth.admin.deleteUser(id);
      dataOrFail(result, "auth_delete_user");
    },
    insertInstitution: (payload) => insertOne("institutions", payload, "id,name,document,status"),
    insertProfile: (payload) => insertOne("profiles", payload, "id,auth_user_id,institution_id,company_id,unit_id,name,email,role,status"),
    insertProject: (payload) => insertOne("obrareport_projects", payload, "id,institution_id,client_id,name,address"),
    deleteInstitution: (id) => deleteOne("institutions", id),
    deleteProfile: (id, authUserId) => deleteOne("profiles", id, "auth_user_id", authUserId),
    deleteProject: (id, institutionId) => deleteOne("obrareport_projects", id, "institution_id", institutionId),
    async countTenantRows(table, institutionId) {
      const rows = await getRows(table, "id", "institution_id", institutionId);
      return rows.length;
    }
  };
}

function requireSupabasePackage() {
  // The backend already owns this dependency; resolve it from the product package.
  const packagePath = path.join(PROJECT_ROOT, "backend", "node_modules", "@supabase", "supabase-js");
  try {
    return require(packagePath);
  } catch {
    const packageRoot = path.join(PROJECT_ROOT, "node_modules", "@supabase", "supabase-js");
    return require(packageRoot);
  }
}

function outputDryRun({ ready, reason = "", idempotent = false, projectRef = EXPECTED_PROJECT_REF }) {
  const safeProject = projectRef === EXPECTED_PROJECT_REF ? `${projectRef.slice(0, 3)}…${projectRef.slice(-4)}` : "unavailable";
  const lines = [
    `TARGET_SUPABASE_PROJECT_REF=${safeProject}`,
    `TENANT_A=${TARGETS.A.tenantName}`,
    `TENANT_B=${TARGETS.B.tenantName}`,
    "USER_A=elo.qa.live.a@<approved-qa-domain>",
    "USER_B=elo.qa.live.b@<approved-qa-domain>",
    `ENTITIES_TO_CREATE=${idempotent ? "0 (all targets already owned by the private manifest)" : "2 tenants, 2 Auth users, 2 profiles, 2 synthetic works"}`,
    "USER_ROLE_A=gestor",
    "USER_ROLE_B=gestor",
    "SCHEMA_CHANGES=0",
    "RLS_CHANGES=0",
    "EXISTING_REAL_ENTITIES_TOUCHED=0",
    `TARGET_ENVIRONMENT_CONFIRMED=${ready ? "YES" : "NO"}`,
    "REAL_DATA_TOUCHED=NO",
    `PREFLIGHT=${ready ? "PASS" : "BLOCKED"}`,
    `READY_TO_APPLY=${ready ? "YES" : "NO"}`
  ];
  if (reason) lines.push(`BLOCK_REASON=${reason}`);
  return lines.join("\n");
}

async function generateCredentials(config, credentials = null) {
  if (credentials) return credentials;
  const next = { A: makePassword(), B: makePassword() };
  const body = credentialsText(config, next);
  await writePrivateEnv(QA_CREDENTIALS_PATH, body);
  return next;
}

async function saveState(state) {
  await writePrivateJson(PRIVATE_MANIFEST_PATH, state);
}

async function runApply(client, config, state, credentials, found, persistState = saveState) {
  const newlyCreatedAuthUsers = [];
  try {
    for (const key of ["A", "B"]) {
      const target = TARGETS[key];
      const item = state[`tenant${key}`];
      if (!item.authUserId) {
        const user = await client.createAuthUser({ email: target.email, password: credentials[key], marker: target.marker });
        newlyCreatedAuthUsers.push({ item, id: user.id });
        item.authUserId = user.id;
        await persistState(state);
      }
    }
  } catch {
    for (const created of newlyCreatedAuthUsers.reverse()) {
      try {
        await client.deleteAuthUser(created.id);
        created.item.authUserId = null;
        await persistState(state);
      } catch {
        fail("auth_partial_create_cleanup_failed");
      }
    }
    fail("auth_create_failed_rolled_back");
  }
  for (const key of ["A", "B"]) {
    const target = TARGETS[key];
    const item = state[`tenant${key}`];
    if (!item.institutionId) {
      item.institutionId = randomUUID();
      item.institutionCreated = false;
      await persistState(state);
    }
    if (!found[key].institution) {
      const institution = await client.insertInstitution({
        id: item.institutionId,
        name: target.tenantName,
        document: `${TENANT_MARKER_PREFIX}${target.marker}`,
        city: null,
        state: null,
        status: "active",
        created_by: null
      });
      if (!sameId(institution.id, item.institutionId)) fail("institution_id_mismatch");
      item.institutionCreated = true;
      await persistState(state);
    } else if (!item.institutionCreated) {
      item.institutionCreated = true;
      await persistState(state);
    }
  }
  for (const key of ["A", "B"]) {
    const target = TARGETS[key];
    const item = state[`tenant${key}`];
    if (!item.profileId) {
      item.profileId = randomUUID();
      item.profileCreated = false;
      await persistState(state);
    }
    if (!found[key].profile) {
      const profile = await client.insertProfile({
        id: item.profileId,
        auth_user_id: item.authUserId,
        institution_id: item.institutionId,
        company_id: null,
        unit_id: null,
        name: `Usuário QA Live ${key}`,
        email: target.email,
        role: target.role,
        status: "active"
      });
      if (!sameId(profile.id, item.profileId)) fail("profile_id_mismatch");
      item.profileCreated = true;
      await persistState(state);
    } else if (!item.profileCreated) {
      item.profileCreated = true;
      await persistState(state);
    }
  }
  for (const key of ["A", "B"]) {
    const target = TARGETS[key];
    const item = state[`tenant${key}`];
    if (!item.workId) {
      item.workId = target.workId;
      item.workCreated = false;
      await persistState(state);
    }
    if (!found[key].work) {
      await client.insertProject({
        id: item.workId,
        institution_id: item.institutionId,
        client_id: null,
        name: target.workName,
        address: "Obra sintética de certificação QA"
      });
      item.workCreated = true;
      await persistState(state);
    } else if (!item.workCreated) {
      item.workCreated = true;
      await persistState(state);
    }
  }

  const verified = await inspectTargets(client, state);
  if (!completeState(state, verified)) fail("provisioning_incomplete");
  if (state.tenantA.institutionId === state.tenantB.institutionId || state.tenantA.authUserId === state.tenantB.authUserId) {
    fail("tenant_ids_not_distinct");
  }
  await savePublicManifest(state);
  return verified;
}

async function runVerify(client, state) {
  if (!state) fail("private_manifest_missing");
  validatePrivateState(state);
  await validateRemoteSchema(client);
  const found = await inspectTargets(client, state);
  if (!completeState(state, found)) fail("provisioning_incomplete");
  if (state.tenantA.institutionId === state.tenantB.institutionId || state.tenantA.authUserId === state.tenantB.authUserId) {
    fail("tenant_ids_not_distinct");
  }
  return found;
}

export async function assertSafeTeardown(client, state) {
  const found = await runVerify(client, state);
  for (const key of ["A", "B"]) {
    const item = state[`tenant${key}`];
    const target = TARGETS[key];
    const profiles = await client.findProfilesByInstitution(item.institutionId);
    if (profiles.length !== 1 || !profileMatches(profiles[0], target, item)) fail("teardown_has_unowned_profile");
    const projects = await client.findProjectsByInstitution(item.institutionId);
    if (projects.length !== 1 || !workMatches(projects[0], target, item)) fail("teardown_has_unowned_work");
    for (const table of TEARDOWN_EMPTY_TABLES) {
      const count = await client.countTenantRows(table, item.institutionId);
      if (count !== 0) fail("teardown_has_qa_data");
    }
  }
  return found;
}

async function runTeardown(client, state) {
  await assertSafeTeardown(client, state);
  for (const key of ["A", "B"]) {
    const item = state[`tenant${key}`];
    const projectRows = await client.deleteProject(item.workId, item.institutionId);
    if (projectRows.length !== 1) fail("teardown_work_delete_mismatch");
  }
  for (const key of ["A", "B"]) {
    const item = state[`tenant${key}`];
    const profileRows = await client.deleteProfile(item.profileId, item.authUserId);
    if (profileRows.length > 1) fail("teardown_profile_delete_mismatch");
    await client.deleteAuthUser(item.authUserId);
    const institutionRows = await client.deleteInstitution(item.institutionId);
    if (institutionRows.length !== 1) fail("teardown_tenant_delete_mismatch");
  }
  await rm(PRIVATE_MANIFEST_PATH, { force: false }).catch(() => fail("teardown_manifest_cleanup_failed"));
  await rm(QA_CREDENTIALS_PATH, { force: false }).catch(() => fail("teardown_credentials_cleanup_failed"));
  await rm(DRY_RUN_RECEIPT_PATH, { force: true }).catch(() => fail("teardown_receipt_cleanup_failed"));
}

export async function runProvisioner({
  mode,
  confirmed = false,
  config,
  client,
  state = null,
  credentials = null,
  dryRunReceipt = null,
  logger = () => {},
  ensurePrivate = async () => {},
  savePrivateState = async () => {},
  saveManifest = async () => {},
  saveDryRunReceipt = async () => {},
  teardown = async () => {}
}) {
  validateTargets();
  if (["apply", "teardown"].includes(mode) && !confirmed) fail("live_confirmation_required");
  if (mode === "prepare-secrets") {
    await ensurePrivate();
    return { ok: true, mode, privateDirectoryReady: true };
  }
  if (!config || !client) fail("secure_config_unavailable");
  if (config.projectRef !== EXPECTED_PROJECT_REF) fail("target_project_mismatch");
  if (state) validatePrivateState(state);
  if (mode === "apply" && !isDryRunReceiptValid(dryRunReceipt)) fail("successful_dry_run_required");

  await validateRemoteSchema(client);
  const found = await inspectTargets(client, state);
  const idempotent = Boolean(state && completeState(state, found));
  if (mode === "dry-run") {
    const receipt = createDryRunReceipt();
    await saveDryRunReceipt(receipt);
    return {
      ok: true,
      mode,
      ready: true,
      idempotent,
      receipt,
      report: outputDryRun({ ready: true, idempotent })
    };
  }
  if (mode === "verify") {
    if (!state) fail("private_manifest_missing");
    const verified = await runVerify(client, state);
    return { ok: true, mode, verified, tenantsDistinct: true };
  }
  if (mode === "teardown") {
    if (!state) fail("private_manifest_missing");
    await teardown(client, state);
    return { ok: true, mode, teardownExecuted: true };
  }
  if (mode !== "apply") fail("usage_invalid");

  await ensurePrivate();
  const nextCredentials = await generateCredentials(config, credentials);
  const nextState = state || makeInitialState(config.projectRef);
  await savePrivateState(nextState);
  await runApply(client, config, nextState, nextCredentials, found, savePrivateState);
  await saveManifest(nextState);
  logger("PROVISIONING_COMPLETE");
  return { ok: true, mode, idempotent, tenantsDistinct: true, roles: { A: USER_ROLE, B: USER_ROLE } };
}

function parseCredentialsText(text, config) {
  const env = parseEnvText(text);
  const allowed = new Set([
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "ELO_QA_LIVE_EMAIL_A",
    "ELO_QA_LIVE_PASSWORD_A",
    "ELO_QA_LIVE_EMAIL_B",
    "ELO_QA_LIVE_PASSWORD_B",
    "LIVE_BACKEND_URL"
  ]);
  for (const key of Object.keys(env)) if (!allowed.has(key)) fail("qa_credentials_invalid");
  if (
    env.SUPABASE_URL !== config.supabaseUrl ||
    env.SUPABASE_ANON_KEY !== config.anonKey ||
    env.ELO_QA_LIVE_EMAIL_A !== TARGETS.A.email ||
    env.ELO_QA_LIVE_EMAIL_B !== TARGETS.B.email ||
    !env.ELO_QA_LIVE_PASSWORD_A ||
    !env.ELO_QA_LIVE_PASSWORD_B
  ) fail("qa_credentials_invalid");
  return { A: env.ELO_QA_LIVE_PASSWORD_A, B: env.ELO_QA_LIVE_PASSWORD_B };
}

async function loadRuntime() {
  await lstat(PRIVATE_DIR).catch((error) => {
    if (error?.code === "ENOENT") fail("secure_directory_missing");
    fail("secure_directory_unavailable");
  });
  const config = await readPrivateConfig();
  if (!config) fail("secure_config_missing");
  const stateRaw = await readPrivateJsonSecure(PRIVATE_MANIFEST_PATH);
  const state = stateRaw ? validatePrivateState(stateRaw) : null;
  const dryRunReceipt = await readPrivateJsonSecure(DRY_RUN_RECEIPT_PATH);
  const rawCredentials = await readSecureFile(QA_CREDENTIALS_PATH);
  if (state && rawCredentials === null) fail("qa_credentials_missing");
  const credentials = rawCredentials === null ? null : parseCredentialsText(rawCredentials, config);
  const client = makeSupabaseAdapter(config);
  return { config, state, dryRunReceipt, credentials, client };
}

function usage() {
  return [
    "Uso:",
    "  node scripts/qa/provision-live-qa-tenants.mjs --prepare-secrets",
    "  node scripts/qa/provision-live-qa-tenants.mjs --dry-run",
    "  node scripts/qa/provision-live-qa-tenants.mjs --apply --confirm-live-qa",
    "  node scripts/qa/provision-live-qa-tenants.mjs --verify",
    "  node scripts/qa/provision-live-qa-tenants.mjs --teardown --confirm-live-qa"
  ].join("\n");
}

function genericFailure(error) {
  return error instanceof ProvisionerError ? error.code : "operation_failed";
}

async function main(argv = process.argv.slice(2)) {
  let request;
  try {
    request = parseMode(argv);
  } catch (error) {
    process.stderr.write(`${genericFailure(error)}\n${usage()}\n`);
    process.exitCode = 2;
    return;
  }

  if (request.mode === "prepare-secrets") {
    try {
      await preparePrivateDirectory();
      process.stdout.write("SECURE_DIRECTORY_READY=YES\n");
      process.stdout.write("CONFIG_FILE=~/.elo-secrets/pr231-live-qa/provisioner.env\n");
      process.stdout.write("QA_CREDENTIALS=generated_only_during_apply\n");
    } catch (error) {
      process.stderr.write(`${genericFailure(error)}\n`);
      process.exitCode = 1;
    }
    return;
  }

  if (request.mode === "dry-run") {
    let projectRef = EXPECTED_PROJECT_REF;
    try {
      const runtime = await loadRuntime();
      const result = await runProvisioner({
        ...runtime,
        mode: request.mode,
        saveDryRunReceipt: async (receipt) => writePrivateJson(DRY_RUN_RECEIPT_PATH, receipt)
      });
      process.stdout.write(`${result.report}\n`);
      return;
    } catch (error) {
      const code = genericFailure(error);
      if (code === "target_project_mismatch") projectRef = "unavailable";
      process.stdout.write(`${outputDryRun({ ready: false, reason: code, projectRef })}\n`);
      process.exitCode = 1;
      return;
    }
  }

  try {
    const runtime = await loadRuntime();
    const state = runtime.state;
    const savePrivateState = async (next) => writePrivateJson(PRIVATE_MANIFEST_PATH, next);
    const saveManifest = async (next) => savePublicManifest(next);
    const teardown = async (activeClient, currentState) => runTeardown(activeClient, currentState);
    const result = await runProvisioner({
      ...runtime,
      state,
      mode: request.mode,
      confirmed: request.confirmed,
      savePrivateState,
      saveCredentials,
      saveManifest,
      teardown,
      ensurePrivate: async () => {
        if (!(await verifyPrivateAcl(PRIVATE_DIR, execFileSync, { requireProtected: true }))) fail("secure_directory_acl_inadequate");
        if (!(await verifyPrivateAcl(PROVISIONER_CONFIG_PATH, execFileSync, { requireProtected: false }))) fail("secure_file_acl_inadequate");
      },
      logger: (event) => process.stdout.write(`${event}=YES\n`)
    });
    if (request.mode === "verify") {
      process.stdout.write("PROVISIONER_VERIFY=PASS\nTENANTS_DISTINCT=YES\nSCHEMA_CHANGES=0\nRLS_CHANGES=0\n");
    } else if (request.mode === "teardown") {
      process.stdout.write("TEARDOWN_EXECUTED=YES\n");
    } else if (request.mode === "apply") {
      process.stdout.write("TENANT_A_CREATED_OR_VERIFIED=YES\nTENANT_B_CREATED_OR_VERIFIED=YES\nUSER_A_CREATED_OR_VERIFIED=YES\nUSER_B_CREATED_OR_VERIFIED=YES\nTENANTS_DISTINCT=YES\nUSER_A_ROLE=gestor\nUSER_B_ROLE=gestor\nSERVICE_ROLE_EXPOSED=NO\nREAL_ENTITIES_TOUCHED=0\n");
    }
  } catch (error) {
    process.stderr.write(`${genericFailure(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
