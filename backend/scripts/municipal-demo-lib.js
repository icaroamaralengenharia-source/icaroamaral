import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const BLOCKED_PROJECT_REFS = new Set([
  "mplpzyalcxhhinuvjthx",
  "lidueokjpzxdybtongbk"
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECRET_RE = /(token|secret|password|senha|authorization|bearer|jwt|service_role|anon_key|api[_-]?key|private_key)/i;
const URL_RE = /https?:\/\/[^\s'")]+/gi;
const UUID_GLOBAL_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

const CONFIRMATIONS = {
  schema: "APLICAR_SCHEMA_DEMO",
  seed: "APLICAR_SEED_DEMO",
  verify: "VERIFICAR_DEMO_MUNICIPAL",
  cleanup: "REMOVER_DADOS_DEMO_MUNICIPAL"
};

const FILES = {
  schema: "backend/src/data/municipal-demo-schema-bundle.sql",
  seed: "backend/src/data/municipal-demo-seed.sql",
  verify: "backend/src/data/municipal-demo-verification.sql",
  cleanup: "backend/src/data/municipal-demo-cleanup.sql"
};

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function bool(value) {
  return clean(value).toLowerCase() === "true";
}

function parseArgs(argv = []) {
  const args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }
    const withoutPrefix = item.slice(2);
    const [key, inlineValue] = withoutPrefix.split("=", 2);
    if (inlineValue != null) {
      args[key] = inlineValue;
    } else if (argv[index + 1] && !argv[index + 1].startsWith("--")) {
      args[key] = argv[index + 1];
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function projectRefFromUrl(value) {
  try {
    const parsed = new URL(clean(value));
    const match = parsed.hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/);
    return match ? match[1] : "";
  } catch (_) {
    return "";
  }
}

function findBlockedProject(value) {
  const text = clean(value).toLowerCase();
  if (!text) return "";
  const ref = projectRefFromUrl(text);
  for (const blocked of BLOCKED_PROJECT_REFS) {
    if (text.includes(blocked) || ref === blocked) return blocked;
  }
  return "";
}

function maskUuid(value) {
  const text = clean(value);
  return UUID_RE.test(text) ? `${text.slice(0, 8)}...${text.slice(-4)}` : text;
}

function sanitize(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_RE.test(key)) {
        out[key] = "[REDACTED]";
      } else {
        out[key] = sanitize(item);
      }
    }
    return out;
  }
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value)
    .replace(URL_RE, "[REDACTED_URL]")
    .replace(UUID_GLOBAL_RE, (match) => maskUuid(match));
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function readRequiredFile(root, relativePath) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    const err = new Error(`required_file_missing:${relativePath}`);
    err.code = "required_file_missing";
    throw err;
  }
  const content = readFileSync(absolutePath, "utf8");
  return { absolutePath, relativePath, content, sha256: sha256(content), bytes: Buffer.byteLength(content) };
}

function assertNoBlockedProject(values) {
  for (const [key, value] of Object.entries(values || {})) {
    const blocked = findBlockedProject(value);
    if (blocked) {
      const err = new Error(`blocked_project_ref:${key}`);
      err.code = "blocked_project_ref";
      err.ref = blocked;
      throw err;
    }
  }
}

function assertNoSecretsInText(content, label) {
  const secretValue = /(supabase_(?:service_role|anon)_key|service_role|password|secret|token|api[_-]?key)\s*[:=]\s*['"]?[A-Za-z0-9_.-]{12,}/i;
  if (secretValue.test(content) || /eyJ[A-Za-z0-9_-]{20,}\./.test(content)) {
    const err = new Error(`secret_detected:${label}`);
    err.code = "secret_detected";
    throw err;
  }
}

function stripSqlComments(sql) {
  return String(sql || "").replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function assertSqlSafety(kind, content) {
  assertNoSecretsInText(content, kind);
  assertNoBlockedProject({ [kind]: content });
  if (/\bproject_id\b/i.test(content)) {
    const err = new Error(`project_id_forbidden:${kind}`);
    err.code = "project_id_forbidden";
    throw err;
  }
  const sql = stripSqlComments(content);
  if (kind === "schema") {
    for (const pattern of [/\bdrop\b/i, /\btruncate\b/i, /\bdelete\s+from\b/i, /\bupdate\b[\s\S]{0,80}\bset\b/i, /\binsert\s+into\b/i]) {
      if (pattern.test(sql)) throw Object.assign(new Error(`unsafe_schema_sql:${kind}`), { code: "unsafe_schema_sql" });
    }
  }
  if (kind === "verify") {
    const statements = sql.split(";").map((item) => item.trim()).filter(Boolean);
    for (const statement of statements) {
      if (!/^(select|with)\b/i.test(statement)) {
        throw Object.assign(new Error(`verify_not_read_only:${statement.slice(0, 40)}`), { code: "verify_not_read_only" });
      }
    }
  }
  if (kind === "cleanup") {
    if (/\bdrop\b|\btruncate\b/i.test(sql)) throw Object.assign(new Error("cleanup_schema_destructive"), { code: "cleanup_schema_destructive" });
    const deletes = sql.split(";").map((item) => item.trim()).filter((item) => /^delete\s+from\b/i.test(item));
    if (!deletes.length) throw Object.assign(new Error("cleanup_without_delete"), { code: "cleanup_without_delete" });
    for (const statement of deletes) {
      if (!/\bwhere\b/i.test(statement) || !/DEMO_MUNICIPAL_/i.test(statement)) {
        throw Object.assign(new Error("cleanup_delete_without_demo_filter"), { code: "cleanup_delete_without_demo_filter" });
      }
    }
  }
}

function replacePlaceholders(content, replacements = {}) {
  let output = content;
  for (const key of ["DEMO_PLATFORM_ADMIN_USER_ID", "DEMO_MUNICIPAL_ADMIN_USER_ID", "DEMO_GESTOR_USER_ID", "DEMO_LEITURA_USER_ID"]) {
    const value = clean(replacements[key] || replacements[key.toLowerCase()] || "");
    if (!value) continue;
    if (!UUID_RE.test(value)) {
      throw Object.assign(new Error(`invalid_uuid_placeholder:${key}`), { code: "invalid_uuid_placeholder" });
    }
    output = output.replaceAll(key, value);
  }
  return output;
}

function unresolvedPlaceholders(content) {
  return [...new Set((content.match(/DEMO_[A-Z_]+_USER_ID/g) || []))];
}

function requireExecuteConfirmation(kind, args) {
  const execute = Boolean(args.execute);
  const confirmation = CONFIRMATIONS[kind];
  if (!execute) return { execute: false, confirmation };
  if (clean(args.confirm) !== confirmation) {
    const err = new Error(`confirmation_required:${confirmation}`);
    err.code = "confirmation_required";
    throw err;
  }
  return { execute: true, confirmation };
}

function resolveProjectRoot(cwd, requestedRoot) {
  const initial = resolve(cwd, requestedRoot || ".");
  if (existsSync(resolve(initial, FILES.schema))) return initial;
  const parent = resolve(initial, "..");
  if (existsSync(resolve(parent, FILES.schema))) return parent;
  return initial;
}

function buildContext(args = {}, env = process.env, cwd = process.cwd()) {
  const root = resolveProjectRoot(cwd, args.root || ".");
  const supabaseUrl = clean(args["supabase-url"] || env.DEMO_SUPABASE_URL || env.SUPABASE_URL);
  const projectRef = projectRefFromUrl(supabaseUrl);
  const providedProjectRef = clean(args["project-ref"] || env.DEMO_SUPABASE_PROJECT_REF);
  const serviceRoleConfigured = Boolean(clean(args["service-role-key"] || env.SUPABASE_SERVICE_ROLE_KEY));
  assertNoBlockedProject({
    "supabase-url": supabaseUrl,
    "project-ref": providedProjectRef,
    DEMO_SUPABASE_URL: env.DEMO_SUPABASE_URL,
    DEMO_SUPABASE_PROJECT_REF: env.DEMO_SUPABASE_PROJECT_REF,
    SUPABASE_URL: env.SUPABASE_URL
  });
  if (providedProjectRef && projectRef && providedProjectRef !== projectRef) {
    const err = new Error("project_ref_mismatch");
    err.code = "project_ref_mismatch";
    throw err;
  }
  return {
    root,
    supabaseUrl,
    projectRef,
    projectRefConfirmed: Boolean(providedProjectRef && projectRef && providedProjectRef === projectRef),
    serviceRoleConfigured,
    demoMode: bool(args["demo-mode"] || env.MUNICIPAL_DEMO_MODE),
    dryRun: !args.execute
  };
}

async function runSqlOperation({ kind, args = {}, env = process.env, cwd = process.cwd(), executor = null }) {
  const context = buildContext(args, env, cwd);
  const { execute, confirmation } = requireExecuteConfirmation(kind, args);
  const file = readRequiredFile(context.root, FILES[kind]);
  assertSqlSafety(kind, file.content);
  let sql = file.content;
  if (kind === "seed") {
    sql = replacePlaceholders(sql, {
      DEMO_PLATFORM_ADMIN_USER_ID: args["platform-admin-user-id"],
      DEMO_MUNICIPAL_ADMIN_USER_ID: args["municipal-admin-user-id"],
      DEMO_GESTOR_USER_ID: args["gestor-user-id"],
      DEMO_LEITURA_USER_ID: args["leitura-user-id"]
    });
    const missing = unresolvedPlaceholders(sql);
    if (execute && missing.length) {
      throw Object.assign(new Error(`placeholders_unresolved:${missing.join(",")}`), { code: "placeholders_unresolved" });
    }
  }
  const summary = {
    ok: true,
    kind,
    dry_run: !execute,
    confirmation_required: confirmation,
    file: file.relativePath,
    sha256: file.sha256,
    bytes: file.bytes,
    project_ref: context.projectRef ? "[configured]" : "[not_configured]",
    project_ref_confirmed: context.projectRefConfirmed,
    service_role_configured: context.serviceRoleConfigured,
    placeholders_unresolved: kind === "seed" ? unresolvedPlaceholders(sql).length : 0
  };
  if (!execute) return summary;
  if (!executor) {
    const err = new Error("automatic_sql_execution_not_configured");
    err.code = "automatic_sql_execution_not_configured";
    err.summary = summary;
    throw err;
  }
  await executor({ sql, context, kind });
  return Object.assign({}, summary, { executed: true });
}

function printResult(result) {
  console.log(JSON.stringify(sanitize(result), null, 2));
}

function printError(error) {
  console.error(JSON.stringify(sanitize({
    ok: false,
    code: error && (error.code || error.name) || "error",
    message: error && error.message || "error",
    summary: error && error.summary
  }), null, 2));
}

async function runCli(kind, operation, argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    const result = await operation(args);
    printResult(result);
    return result;
  } catch (error) {
    printError(error);
    process.exitCode = 1;
    return null;
  }
}

function isMain(metaUrl) {
  return Boolean(process.argv[1]) && metaUrl === pathToFileURL(process.argv[1]).href;
}

export {
  BLOCKED_PROJECT_REFS,
  CONFIRMATIONS,
  FILES,
  UUID_RE,
  assertNoBlockedProject,
  assertSqlSafety,
  buildContext,
  findBlockedProject,
  isMain,
  maskUuid,
  parseArgs,
  readRequiredFile,
  replacePlaceholders,
  requireExecuteConfirmation,
  runCli,
  runSqlOperation,
  sanitize,
  sha256,
  unresolvedPlaceholders
};
