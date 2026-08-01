import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { buildRunbook, renderRunbookMarkdown } from "./municipal-demo-build-runbook.js";
import { isMain, parseArgs, sanitize } from "./municipal-demo-lib.js";
import { validateOperatorInput } from "./municipal-demo-validate-operator-input.js";

const DEFAULT_ENV_OUTPUT = "backend/.env.demo.operator.example";
const DEFAULT_RUNBOOK_JSON = "artifacts/municipal-demo-runbook.json";
const DEFAULT_CHECKLIST_MD = "artifacts/municipal-demo-operator-checklist.md";

const QUESTION_MAP = [
  ["environmentName", "Nome interno ficticio do ambiente (DEMO_MUNICIPAL_...): "],
  ["plannedDomain", "Dominio HTTPS planejado: "],
  ["projectRef", "Project ref demo isolado: "],
  ["technicalOwner", "Responsavel tecnico sem e-mail/telefone/CPF: "],
  ["isolationConfirmed", "Confirma isolamento do projeto? Digite SIM: "],
  ["backupConfirmed", "Confirma plano/evidencia de backup? Digite SIM: "],
  ["integrationsDisabledConfirmed", "Confirma WhatsApp/e-mail desligados? Digite SIM: "],
  ["platformAdminUserId", "UUID ficticio platform_admin: "],
  ["municipalAdminUserId", "UUID ficticio municipal_admin: "],
  ["gestorUserId", "UUID ficticio gestor: "],
  ["leituraUserId", "UUID ficticio leitura: "]
];

function exampleInput() {
  return {
    environmentName: "DEMO_MUNICIPAL_EXEMPLO",
    plannedDomain: "https://demo-municipal.exemplo.com",
    projectRef: "demowizardabcdefghij",
    technicalOwner: "OperadorTecnicoDemo",
    isolationConfirmed: "SIM",
    backupConfirmed: "SIM",
    integrationsDisabledConfirmed: "SIM",
    platformAdminUserId: "11111111-1111-4111-8111-111111111111",
    municipalAdminUserId: "22222222-2222-4222-8222-222222222222",
    gestorUserId: "33333333-3333-4333-8333-333333333333",
    leituraUserId: "44444444-4444-4444-8444-444444444444"
  };
}
function valueFromArgs(args, key) {
  const kebab = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return args[key] || args[kebab] || "";
}

function inputFromArgs(args = {}) {
  return Object.fromEntries(QUESTION_MAP.map(([key]) => [key, valueFromArgs(args, key)]));
}

async function promptInput() {
  const rl = createInterface({ input, output });
  const answers = {};
  try {
    for (const [key, question] of QUESTION_MAP) {
      answers[key] = await rl.question(question);
    }
  } finally {
    rl.close();
  }
  return answers;
}

function envOperatorExample(input) {
  const validated = validateOperatorInput(input);
  return `# Exemplo local para operador da Demo Municipal.\n# Nao contem credenciais reais, senha, token, JWT, service key ou connection string.\n# Nao copie este arquivo para .env sem preencher credenciais fora do Git.\n\nAPP_ENV=demo\nMUNICIPAL_DEMO_MODE=true\nRUN_DEMO_LIVE_TESTS=false\n\nDEMO_ENVIRONMENT_NAME=${validated.environmentName}\nDEMO_PROJECT_REF=${validated.projectRef}\nDEMO_SUPABASE_URL=https://${validated.projectRef}.supabase.co\nDEMO_PANEL_URL=${validated.plannedDomain}\nAI_ALLOWED_ORIGINS=${validated.plannedDomain}\n\nMUNICIPAL_WHATSAPP_ENABLED=false\nMUNICIPAL_EMAIL_ENABLED=false\n\n# UUIDs ficticios mascarados para conferencia visual; use os valores completos apenas no arquivo local seguro fora do Git.\nDEMO_PLATFORM_ADMIN_USER_ID=${validated.users.platformAdminUserId}\nDEMO_MUNICIPAL_ADMIN_USER_ID=${validated.users.municipalAdminUserId}\nDEMO_GESTOR_USER_ID=${validated.users.gestorUserId}\nDEMO_LEITURA_USER_ID=${validated.users.leituraUserId}\n`;
}

function ensureInsideAllowedOutput(root, outputPath) {
  const resolved = resolve(root, outputPath);
  const relative = resolved.slice(resolve(root).length + 1).replaceAll("\\", "/");
  if (relative === DEFAULT_ENV_OUTPUT || relative.startsWith("artifacts/")) return resolved;
  const error = new Error("wizard_output_path_forbidden");
  error.code = "wizard_output_path_forbidden";
  throw error;
}

function writeTextFile(path, content, force = false) {
  if (existsSync(path) && !force) {
    const error = new Error("wizard_output_exists_use_force");
    error.code = "wizard_output_exists_use_force";
    throw error;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

async function runWizard(args = {}, options = {}) {
  const root = resolve(options.cwd || process.cwd(), args.root || ".");
  const nonInteractive = Boolean(args["non-interactive"] || args.nonInteractive);
  const force = Boolean(args.force);
  const dryRun = Boolean(args["dry-run"] || args.dryRun || options.write === false);
  const operatorInput = args.example ? exampleInput() : nonInteractive ? inputFromArgs(args) : await promptInput();
  const validated = validateOperatorInput(operatorInput);
  const runbook = buildRunbook(operatorInput, { root });
  const envOutput = ensureInsideAllowedOutput(root, args["env-output"] || DEFAULT_ENV_OUTPUT);
  const jsonOutput = ensureInsideAllowedOutput(root, args["runbook-output"] || DEFAULT_RUNBOOK_JSON);
  const checklistOutput = ensureInsideAllowedOutput(root, args["checklist-output"] || DEFAULT_CHECKLIST_MD);

  if (!dryRun) {
    writeTextFile(envOutput, envOperatorExample(operatorInput), force);
    writeTextFile(jsonOutput, JSON.stringify(runbook, null, 2) + "\n", force);
    writeTextFile(checklistOutput, renderRunbookMarkdown(runbook), force);
  }

  return sanitize({
    ok: true,
    interactive: !nonInteractive,
    dry_run: dryRun,
    written: !dryRun,
    network_opened: false,
    supabase_accessed: false,
    sql_executed: false,
    user_created: false,
    deploy_executed: false,
    outputs: {
      env: DEFAULT_ENV_OUTPUT,
      runbook: DEFAULT_RUNBOOK_JSON,
      checklist: DEFAULT_CHECKLIST_MD
    },
    environment: validated
  });
}

async function main(argv = process.argv.slice(2)) {
  try {
    const result = await runWizard(parseArgs(argv));
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(JSON.stringify(sanitize({
      ok: false,
      code: error.code || error.name || "wizard_error",
      message: error.message,
      errors: error.errors
    }), null, 2));
    process.exitCode = 1;
    return null;
  }
}

if (isMain(import.meta.url)) {
  main();
}

export {
  DEFAULT_CHECKLIST_MD,
  DEFAULT_ENV_OUTPUT,
  DEFAULT_RUNBOOK_JSON,
  QUESTION_MAP,
  envOperatorExample,
  exampleInput,
  inputFromArgs,
  runWizard
};





