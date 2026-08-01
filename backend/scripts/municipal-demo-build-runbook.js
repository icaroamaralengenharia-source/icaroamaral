import { readRequiredFile, sanitize } from "./municipal-demo-lib.js";
import { safeOperatorInput } from "./municipal-demo-validate-operator-input.js";

const HASH_FILES = {
  schema: "backend/src/data/municipal-demo-schema-bundle.sql",
  seed: "backend/src/data/municipal-demo-seed.sql",
  verification: "backend/src/data/municipal-demo-verification.sql",
  liveVerification: "backend/src/data/municipal-demo-live-verification.sql"
};

const SAFE_COMMANDS = [
  "npm --prefix backend run demo:preflight",
  "npm --prefix backend run demo:apply-schema",
  "npm --prefix backend run demo:apply-seed",
  "npm --prefix backend run demo:verify",
  "npm --prefix backend run demo:smoke:local",
  "node --test backend/tests/municipal-demo-live-preflight.test.js"
];

const WRITE_COMMANDS = [
  "Copiar e executar manualmente backend/src/data/municipal-demo-schema-bundle.sql no SQL Editor do projeto demo isolado.",
  "Copiar e executar manualmente backend/src/data/municipal-demo-seed.sql apos substituir placeholders por usuarios ficticios.",
  "Executar cleanup manual existente somente com autorizacao e somente para DEMO_MUNICIPAL_."
];

function sqlHashes(root) {
  return Object.fromEntries(Object.entries(HASH_FILES).map(([kind, file]) => {
    const info = readRequiredFile(root, file);
    return [kind, { file, sha256: info.sha256, bytes: info.bytes }];
  }));
}

function buildRunbook(input = {}, options = {}) {
  const root = options.root || process.cwd();
  const safeInput = safeOperatorInput(input);
  const runbook = sanitize({
    generated_at: new Date().toISOString(),
    decision: "RUNBOOK LOCAL GERADO - SEM EXECUCAO REAL",
    environment: safeInput,
    sql_hashes: sqlHashes(root),
    manual_order: [
      "Criar projeto Supabase demo isolado manualmente.",
      "Criar quatro usuarios ficticios no Auth demo.",
      "Configurar variaveis fora do Git.",
      "Rodar preflight local.",
      "Rodar dry-run do schema.",
      "Aplicar schema manualmente no SQL Editor.",
      "Rodar dry-run do seed.",
      "Substituir placeholders do seed por usuarios ficticios.",
      "Aplicar seed manualmente no SQL Editor.",
      "Rodar verification read-only.",
      "Validar health local/operacional.",
      "Validar painel.",
      "Validar offline.",
      "Executar testes live por blocos somente apos autorizacao.",
      "Registrar evidencia.",
      "Aprovar ou reprovar a demo."
    ],
    safe_commands: SAFE_COMMANDS,
    manual_write_commands: WRITE_COMMANDS,
    literal_confirmations: [
      "APLICAR_SCHEMA_DEMO",
      "APLICAR_SEED_DEMO",
      "REMOVER_DADOS_DEMO_MUNICIPAL",
      "SIM"
    ],
    rollback_cleanup: [
      "Nao existe rollback automatico nesta etapa.",
      "Usar cleanup manual existente apenas com evidencia e autorizacao.",
      "Cleanup deve filtrar somente prefixos DEMO_MUNICIPAL_ ou DEMO_MUNICIPAL_LIVE_52_.",
      "Nao apagar auth.users, instituicao principal, E2E ou producao."
    ],
    approval_criteria: [
      "Preflight aprovado.",
      "Schema e seed aplicados manualmente uma unica vez.",
      "Verification read-only sem inconsistencias.",
      "RLS live bloqueia tenant externo e leitura sem escrita.",
      "Concorrencia live sem duplicidade e sem saldo negativo.",
      "Painel live em desktop, tablet e celular.",
      "Offline validado.",
      "Evidencias salvas sem segredos."
    ],
    prohibitions: [
      "Nao executar SQL automaticamente.",
      "Nao usar Supabase CLI.",
      "Nao inserir credenciais no Git.",
      "Nao usar E2E ou producao.",
      "Nao ativar WhatsApp/e-mail.",
      "Nao definir RUN_DEMO_LIVE_TESTS=true sem autorizacao manual.",
      "Nao imprimir URLs privadas, tokens, senhas ou UUIDs completos."
    ]
  });
  return runbook;
}

function renderRunbookMarkdown(runbook) {
  const hashes = Object.entries(runbook.sql_hashes).map(([kind, info]) => `- ${kind}: ${info.file} - SHA-256 ${info.sha256}`).join("\n");
  return `# Runbook Demo Municipal Gerado\n\nGerado em: ${runbook.generated_at}\n\n## Ambiente\n\n- Nome: ${runbook.environment.environmentName}\n- Dominio planejado: ${runbook.environment.plannedDomain}\n- Project ref: ${runbook.environment.projectRef}\n- Responsavel tecnico: ${runbook.environment.technicalOwner}\n\n## Usuarios Ficticios\n\n- Platform admin: ${runbook.environment.users.platformAdminUserId}\n- Municipal admin: ${runbook.environment.users.municipalAdminUserId}\n- Gestor: ${runbook.environment.users.gestorUserId}\n- Leitura: ${runbook.environment.users.leituraUserId}\n\n## Hashes\n\n${hashes}\n\n## Ordem Manual\n\n${runbook.manual_order.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n## Comandos Seguros\n\n${runbook.safe_commands.map((item) => `- \`${item}\``).join("\n")}\n\n## Comandos de Escrita Manual\n\n${runbook.manual_write_commands.map((item) => `- ${item}`).join("\n")}\n\n## Confirmacoes Literais\n\n${runbook.literal_confirmations.map((item) => `- \`${item}\``).join("\n")}\n\n## Rollback e Cleanup\n\n${runbook.rollback_cleanup.map((item) => `- ${item}`).join("\n")}\n\n## Criterios de Aprovacao\n\n${runbook.approval_criteria.map((item) => `- ${item}`).join("\n")}\n\n## Proibicoes\n\n${runbook.prohibitions.map((item) => `- ${item}`).join("\n")}\n`;
}

export { HASH_FILES, SAFE_COMMANDS, WRITE_COMMANDS, buildRunbook, renderRunbookMarkdown, sqlHashes };

