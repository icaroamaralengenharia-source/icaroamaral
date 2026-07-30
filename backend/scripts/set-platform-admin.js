import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      out[key] = next;
      i += 1;
    } else {
      out[key] = "true";
    }
  }
  return out;
}

function loadEnvFile(path) {
  const resolved = resolve(path || "backend/.env");
  if (!existsSync(resolved)) return {};
  const env = {};
  String(readFileSync(resolved, "utf8")).split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[match[1]] = value;
  });
  return env;
}

function maskEmail(email) {
  const value = clean(email).toLowerCase();
  const [name, domain] = value.split("@");
  if (!domain) return value.slice(0, 4) + "...";
  return name.slice(0, 2) + "***@" + domain;
}

function shortId(id) {
  const value = clean(id);
  return value ? value.slice(0, 8) + "..." : "";
}

function assertSafeEnvironment(env, args) {
  const label = clean(args.environment || env.MUNICIPAL_ADMIN_ENVIRONMENT || env.E2E_ENVIRONMENT).toLowerCase();
  if (!["local", "test", "homologacao", "homologation", "staging"].includes(label)) {
    throw new Error("environment_not_confirmed_use_local_test_or_homologacao");
  }
  if (/prod|production|producao|produção/i.test(label) && args.allowProduction !== "true") {
    throw new Error("production_refused_without_explicit_flag");
  }
  return label;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = Object.assign({}, loadEnvFile(args.env), process.env);
  const environment = assertSafeEnvironment(env, args);
  const supabaseUrl = clean(env.SUPABASE_URL);
  const serviceRoleKey = clean(env.SUPABASE_SERVICE_ROLE_KEY);
  const email = clean(args.email || env.MUNICIPAL_PLATFORM_ADMIN_EMAIL).toLowerCase();
  const userIdArg = clean(args.userId || env.MUNICIPAL_PLATFORM_ADMIN_USER_ID);

  if (!supabaseUrl || !serviceRoleKey) throw new Error("supabase_admin_credentials_required");
  if (!email && !userIdArg) throw new Error("email_or_user_id_required");
  if (args.confirm !== "PROMOTE_PLATFORM_ADMIN") throw new Error("confirmation_required");

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  let authUser = null;
  if (userIdArg) {
    const { data, error } = await supabase.auth.admin.getUserById(userIdArg);
    if (error || !data || !data.user) throw new Error("auth_user_not_found");
    authUser = data.user;
  } else {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    authUser = (data.users || []).find((user) => clean(user.email).toLowerCase() === email);
    if (!authUser) throw new Error("auth_user_not_found");
  }

  const profilePayload = {
    auth_user_id: authUser.id,
    institution_id: null,
    unit_id: null,
    name: clean(authUser.user_metadata && (authUser.user_metadata.name || authUser.user_metadata.full_name)) || "Platform Admin",
    email: clean(authUser.email).toLowerCase(),
    role: "platform_admin",
    status: "active"
  };

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id,auth_user_id,email,role,status")
    .eq("auth_user_id", authUser.id)
    .maybeSingle();
  if (lookupError) throw lookupError;

  const result = existing
    ? await supabase.from("profiles").update(profilePayload).eq("id", existing.id).select("id,email,role,status").single()
    : await supabase.from("profiles").insert(profilePayload).select("id,email,role,status").single();
  if (result.error) throw result.error;

  console.log(JSON.stringify({ ok: true, environment, profileId: shortId(result.data.id), email: maskEmail(result.data.email), role: result.data.role, status: result.data.status }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: clean(error && error.message) || "set_platform_admin_failed" }, null, 2));
  process.exit(1);
});