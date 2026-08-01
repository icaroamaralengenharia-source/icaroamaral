const BLOCKED_PROJECT_REFS = new Set([
  "mplpzyalcxhhinuvjthx",
  "lidueokjpzxdybtongbk"
]);

const REQUIRED_DEMO_ENV = [
  "APP_ENV",
  "NODE_ENV",
  "MUNICIPAL_DEMO_MODE",
  "DEMO_SUPABASE_URL",
  "DEMO_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_ALLOWED_ORIGINS"
];

const SENSITIVE_KEY_RE = /key|token|secret|password|senha|authorization|bearer|jwt/i;

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function boolFlag(value) {
  return clean(value).toLowerCase() === "true";
}

function add(checks, id, status, message) {
  checks.push({ id, status, message });
}

function parseOrigins(value) {
  return clean(value).split(",").map((item) => clean(item)).filter(Boolean);
}

function isLocalhost(hostname) {
  return ["localhost", "127.0.0.1", "::1"].includes(clean(hostname).toLowerCase());
}

function parseUrl(value) {
  try {
    return new URL(clean(value));
  } catch (_) {
    return null;
  }
}

function projectRefFromSupabaseUrl(value) {
  const parsed = parseUrl(value);
  if (!parsed) return "";
  const match = parsed.hostname.toLowerCase().match(/^([a-z0-9]+)\.supabase\.co$/);
  return match ? match[1] : "";
}

function containsBlockedProject(value) {
  const text = clean(value).toLowerCase();
  if (!text) return "";
  const ref = projectRefFromSupabaseUrl(text);
  for (const blocked of BLOCKED_PROJECT_REFS) {
    if (text.includes(blocked) || ref === blocked) return blocked;
  }
  return "";
}

function isDemoEnv(env) {
  return clean(env.APP_ENV).toLowerCase() === "demo" || boolFlag(env.MUNICIPAL_DEMO_MODE);
}

function publicMode(env) {
  const appEnv = clean(env.APP_ENV).toLowerCase();
  return !["development", "dev", "local", "test"].includes(appEnv);
}

function requiredMissing(env) {
  return REQUIRED_DEMO_ENV.filter((key) => !clean(env[key]));
}

function validateDemoOrigins(env, checks) {
  const origins = parseOrigins(env.AI_ALLOWED_ORIGINS);
  if (!origins.length) {
    add(checks, "origins_present", "fail", "AI_ALLOWED_ORIGINS deve listar dominios autorizados.");
    return [];
  }

  if (origins.includes("*")) {
    add(checks, "origins_no_wildcard", "fail", "Origem wildcard nao e permitida no ambiente demo.");
  } else {
    add(checks, "origins_no_wildcard", "pass", "CORS nao usa wildcard.");
  }

  const publicEnvironment = publicMode(env);
  const invalid = [];
  for (const origin of origins) {
    const parsed = parseUrl(origin);
    if (!parsed) {
      invalid.push(origin);
      continue;
    }
    const local = isLocalhost(parsed.hostname);
    if (publicEnvironment && local) invalid.push(origin);
    if (publicEnvironment && !local && parsed.protocol !== "https:") invalid.push(origin);
  }

  if (invalid.length) {
    add(checks, "origins_https", "fail", "Demo publica exige HTTPS e nao aceita localhost.");
  } else {
    add(checks, "origins_https", "pass", "Origins da demo estao fechadas e compativeis com HTTPS.");
  }
  return origins;
}

function validateMunicipalDemoConfig(envInput = process.env) {
  const env = envInput || {};
  const checks = [];

  const missing = requiredMissing(env);
  if (missing.length) {
    add(checks, "required_env", "fail", "Variaveis obrigatorias da demo ausentes: " + missing.join(", "));
  } else {
    add(checks, "required_env", "pass", "Variaveis obrigatorias da demo informadas.");
  }

  if (clean(env.APP_ENV).toLowerCase() !== "demo") {
    add(checks, "app_env_demo", "fail", "APP_ENV deve ser demo.");
  } else {
    add(checks, "app_env_demo", "pass", "APP_ENV=demo.");
  }

  if (clean(env.NODE_ENV).toLowerCase() !== "production") {
    add(checks, "node_env_production", "warning", "NODE_ENV recomendado para demo e production.");
  } else {
    add(checks, "node_env_production", "pass", "NODE_ENV=production.");
  }

  if (!boolFlag(env.MUNICIPAL_DEMO_MODE)) {
    add(checks, "demo_mode", "fail", "MUNICIPAL_DEMO_MODE deve ser true.");
  } else {
    add(checks, "demo_mode", "pass", "Modo demo municipal ativo.");
  }

  const origins = validateDemoOrigins(env, checks);

  const blocked = [
    ["DEMO_SUPABASE_URL", env.DEMO_SUPABASE_URL],
    ["DEMO_DATABASE_URL", env.DEMO_DATABASE_URL],
    ["SUPABASE_URL", env.SUPABASE_URL]
  ].map(([key, value]) => ({ key, ref: containsBlockedProject(value) })).find((item) => item.ref);
  if (blocked) {
    add(checks, "blocked_project_ref", "fail", "Banco demo nao pode apontar para projeto E2E/proibido.");
  } else {
    add(checks, "blocked_project_ref", "pass", "Projeto E2E/proibido nao foi identificado na configuracao demo.");
  }

  if (clean(env.SUPABASE_URL) && clean(env.SUPABASE_URL) === clean(env.DEMO_SUPABASE_URL)) {
    add(checks, "no_supabase_fallback", "warning", "Prefira DEMO_SUPABASE_URL exclusivo e evite fallback em SUPABASE_URL.");
  } else {
    add(checks, "no_supabase_fallback", "pass", "Configuracao usa variavel demo dedicada sem fallback operacional.");
  }

  if (boolFlag(env.MUNICIPAL_WHATSAPP_ENABLED)) {
    add(checks, "whatsapp_disabled", "fail", "WhatsApp deve ficar desativado na demo.");
  } else {
    add(checks, "whatsapp_disabled", "pass", "WhatsApp desativado.");
  }

  if (boolFlag(env.MUNICIPAL_EMAIL_ENABLED)) {
    add(checks, "email_disabled", "fail", "E-mail deve ficar desativado na demo.");
  } else {
    add(checks, "email_disabled", "pass", "E-mail desativado.");
  }

  const openAiConfigured = Boolean(clean(env.OPENAI_API_KEY));
  if (!openAiConfigured) {
    add(checks, "ai_optional", "warning", "OPENAI_API_KEY ausente: ELO deve degradar sem derrubar o painel.");
  } else {
    add(checks, "ai_optional", "pass", "Chave de IA configurada no backend.");
  }

  const databaseConfigured = Boolean(clean(env.DEMO_SUPABASE_URL) && clean(env.SUPABASE_SERVICE_ROLE_KEY));
  const sanitized = {
    appEnv: clean(env.APP_ENV).toLowerCase(),
    nodeEnv: clean(env.NODE_ENV).toLowerCase(),
    municipalDemoMode: boolFlag(env.MUNICIPAL_DEMO_MODE),
    databaseConfigured,
    demoSupabaseConfigured: Boolean(clean(env.DEMO_SUPABASE_URL)),
    demoDatabaseUrlConfigured: Boolean(clean(env.DEMO_DATABASE_URL)),
    corsOrigins: origins,
    integrations: {
      whatsapp: false,
      email: false,
      ai: openAiConfigured ? "configured" : "unavailable"
    },
    seed: {
      enabled: boolFlag(env.MUNICIPAL_DEMO_SEED_ENABLED)
    }
  };

  const serialized = JSON.stringify(sanitized);
  for (const [key, value] of Object.entries(env)) {
    if (SENSITIVE_KEY_RE.test(key) && clean(value) && serialized.includes(clean(value))) {
      add(checks, "sanitized_output", "fail", "Configuracao sanitizada nao pode conter valores sensiveis.");
      return { ok: false, checks, config: sanitized };
    }
  }
  add(checks, "sanitized_output", "pass", "Configuracao retornada nao expoe segredos.");

  return {
    ok: isDemoEnv(env) && checks.every((check) => check.status !== "fail"),
    checks,
    config: sanitized
  };
}

export {
  BLOCKED_PROJECT_REFS,
  REQUIRED_DEMO_ENV,
  containsBlockedProject,
  projectRefFromSupabaseUrl,
  validateMunicipalDemoConfig
};