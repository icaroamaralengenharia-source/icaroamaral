import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { isMain, parseArgs, runCli, sanitize } from "./municipal-demo-lib.js";

const DEFAULT_OUTPUT = "backend/.env.demo.local.example";

function envExampleContent() {
  return `# Ambiente local de exemplo para Demo Municipal.
# Copie para um arquivo local fora do Git e preencha manualmente somente no operador autorizado.
# Este arquivo nao contem credenciais reais, URL real, tokens, senhas ou IDs de usuarios.

APP_ENV=demo
NODE_ENV=production
MUNICIPAL_DEMO_MODE=true

# Use somente o projeto demo isolado. Nunca use E2E ou producao.
DEMO_SUPABASE_URL=https://SEU_PROJECT_REF_DEMO.supabase.co
DEMO_SUPABASE_PROJECT_REF=SEU_PROJECT_REF_DEMO
DEMO_SUPABASE_ANON_KEY=COLE_ANON_KEY_DEMO_LOCALMENTE
SUPABASE_SERVICE_ROLE_KEY=COLE_SERVICE_ROLE_KEY_DEMO_LOCALMENTE

# CORS fechado para o dominio HTTPS da demo.
AI_ALLOWED_ORIGINS=https://demo-municipal.exemplo.com

# Integracoes externas desligadas por padrao.
MUNICIPAL_WHATSAPP_ENABLED=false
MUNICIPAL_EMAIL_ENABLED=false
MUNICIPAL_DEMO_SEED_ENABLED=false

# IA opcional. Deixe vazio para validar degradacao segura do ELO.
OPENAI_API_KEY=
`;
}

function validateEnvExample(content) {
  const forbidden = /(mplpzyalcxhhinuvjthx|lidueokjpzxdybtongbk|=\s*eyJ[A-Za-z0-9_-]{20,}\.|=\s*service_role_[A-Za-z0-9_-]{8,}|=\s*anon_[A-Za-z0-9_-]{8,})/i;
  if (forbidden.test(content)) {
    const err = new Error("env_example_contains_forbidden_value");
    err.code = "env_example_contains_forbidden_value";
    throw err;
  }
  for (const required of ["APP_ENV=demo", "MUNICIPAL_DEMO_MODE=true", "MUNICIPAL_WHATSAPP_ENABLED=false", "MUNICIPAL_EMAIL_ENABLED=false"]) {
    if (!content.includes(required)) {
      const err = new Error(`env_example_missing:${required}`);
      err.code = "env_example_missing";
      throw err;
    }
  }
}

function generateEnvExample(args = {}, options = {}) {
  const cwd = options.cwd || process.cwd();
  const output = resolve(cwd, args.output || DEFAULT_OUTPUT);
  const content = envExampleContent();
  validateEnvExample(content);
  const exists = existsSync(output);
  const dryRun = Boolean(args["dry-run"] || args.dryRun);
  if (exists && !args.force && !dryRun) {
    const err = new Error("env_example_exists_use_force");
    err.code = "env_example_exists_use_force";
    throw err;
  }
  if (!dryRun) {
    mkdirSync(dirname(output), { recursive: true });
    writeFileSync(output, content, "utf8");
  }
  const finalContent = existsSync(output) ? readFileSync(output, "utf8") : content;
  validateEnvExample(finalContent);
  return sanitize({
    ok: true,
    dry_run: dryRun,
    written: !dryRun,
    overwritten: Boolean(exists && args.force && !dryRun),
    output: output.endsWith(DEFAULT_OUTPUT.replaceAll("/", "\\")) ? DEFAULT_OUTPUT : "[custom_output]",
    bytes: Buffer.byteLength(finalContent)
  });
}

if (isMain(import.meta.url)) {
  runCli("env-example", (args) => generateEnvExample(args), process.argv.slice(2));
}

export { DEFAULT_OUTPUT, envExampleContent, generateEnvExample, parseArgs, validateEnvExample };
