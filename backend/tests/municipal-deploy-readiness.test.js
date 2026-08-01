import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";

const root = resolve(".");

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function lineOf(content, pattern) {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index < 0 ? 0 : index + 1;
}

function assertNoPattern(path, pattern, message) {
  const content = read(path);
  assert.equal(pattern.test(content), false, `${message} em ${path}:${lineOf(content, pattern)}`);
}

const docs = [
  "docs/DEMO-MUNICIPAL.md",
  "docs/MANUAL-RAPIDO-GESTOR-MUNICIPAL.md",
  "docs/CHECKLIST-DEPLOY-MUNICIPAL.md"
];

const functionalFiles = [
  "backend/src/app.js",
  "backend/src/municipal-admin-router.js",
  "backend/src/municipal-admin-service.js",
  "backend/src/municipal-asset-router.js",
  "backend/src/municipal-asset-service.js",
  "backend/src/municipal-document-router.js",
  "backend/src/municipal-document-service.js",
  "backend/src/municipal-notification-router.js",
  "backend/src/municipal-notification-service.js",
  "backend/src/municipal-operational-shelf-service.js",
  "backend/src/municipal-report-router.js",
  "backend/src/municipal-report-service.js",
  "backend/src/municipal-report-archive-service.js",
  "backend/src/municipal-sentinel-router.js",
  "backend/src/municipal-sentinel-service.js",
  "backend/src/elo-municipal-tools.js",
  "municipal-admin.html",
  "relatorio-qualidade-obras/municipal-admin-ui.js",
  "relatorio-qualidade-obras/municipal-asset-offline-store.js"
];

const frontendFiles = [
  "municipal-admin.html",
  "relatorio-qualidade-obras/municipal-admin-ui.js",
  "relatorio-qualidade-obras/municipal-asset-offline-store.js"
];

test("documentacao de demonstracao municipal cobre roteiro e operacao", () => {
  const demo = read("docs/DEMO-MUNICIPAL.md");
  for (const term of [
    "15 a 20 minutos",
    "Login",
    "Visao Geral",
    "Almoxarifado",
    "Patrimonio",
    "Sentinela",
    "Notificacoes",
    "Relatorios",
    "Acervo",
    "ELO Municipal",
    "Consulta Offline",
    "Dados Que Nao Devem Ser Exibidos",
    "Plano B"
  ]) {
    assert.match(demo, new RegExp(term, "i"));
  }

  const manual = read("docs/MANUAL-RAPIDO-GESTOR-MUNICIPAL.md");
  for (const term of [
    "Acesso",
    "Navegacao",
    "Cadastrar E Consultar Patrimonio",
    "Transferir Bem",
    "Manutencao E Baixa",
    "Consultar Estoque",
    "Reconhecer E Resolver Alerta",
    "Ler Notificacoes",
    "Gerar Relatorio",
    "Salvar No Acervo",
    "Usar ELO Municipal",
    "Funcionamento Offline",
    "Logout",
    "Cuidados Com Senha"
  ]) {
    assert.match(manual, new RegExp(term, "i"));
  }
});

test("checklist documenta configuracao obrigatoria, ambientes, backup e rollback", () => {
  const checklist = read("docs/CHECKLIST-DEPLOY-MUNICIPAL.md");
  for (const term of [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_ANON_KEY",
    "AI_ALLOWED_ORIGINS",
    "MUNICIPAL_WHATSAPP_ENABLED=false",
    "MUNICIPAL_EMAIL_ENABLED=false",
    "Banco E Schemas",
    "RLS",
    "Autenticacao",
    "CORS",
    "HTTPS",
    "Dominio",
    "Backup",
    "Logs E Monitoramento",
    "Arquivos Estaticos",
    "Service Worker E Cache",
    "Testes De Saude",
    "Rollback",
    "Treinamento",
    "Aceite Do Cliente"
  ]) {
    assert.match(checklist, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }

  for (const env of ["Desenvolvimento", "E2E/homologacao", "Demonstracao", "Producao"]) {
    assert.match(checklist, new RegExp(env, "i"));
  }
});

test("readiness bloqueia segredos hardcoded e projeto proibido em codigo funcional", () => {
  const secretLiteral = /(supabase_(?:anon|service_role)_key|service_role|private_key|api_key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9_.-]{24,}["']/i;
  const jwtLiteral = /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/;
  for (const file of functionalFiles) {
    assertNoPattern(file, secretLiteral, "segredo hardcoded detectado");
    assertNoPattern(file, jwtLiteral, "JWT hardcoded detectado");
    assertNoPattern(file, /lidueokjpzxdybtongbk/i, "projeto proibido em codigo funcional");
    assertNoPattern(file, /mplpzyalcxhhinuvjthx/i, "projeto E2E usado como fallback operacional");
  }
});

test("frontend municipal nao contem service key nem credencial privilegiada", () => {
  for (const file of frontendFiles) {
    assertNoPattern(file, /SUPABASE_SERVICE_ROLE_KEY|service_role|private_key/i, "credencial privilegiada no frontend");
    assertNoPattern(file, /MUNICIPAL_WHATSAPP_PROVIDER_TOKEN|MUNICIPAL_EMAIL_PROVIDER_TOKEN/i, "token de integracao no frontend");
  }
});

test("notificacoes externas nao ficam ativadas por padrao", () => {
  const service = read("backend/src/municipal-notification-service.js");
  assert.match(service, /MUNICIPAL_WHATSAPP_ENABLED\)\s*===\s*"true"/);
  assert.match(service, /MUNICIPAL_EMAIL_ENABLED\)\s*===\s*"true"/);
  assert.doesNotMatch(service, /MUNICIPAL_WHATSAPP_ENABLED\s*\|\|\s*["']true["']/);
  assert.doesNotMatch(service, /MUNICIPAL_EMAIL_ENABLED\s*\|\|\s*["']true["']/);
});

test("backend possui health e CORS nao usa wildcard indiscriminado", () => {
  const app = read("backend/src/app.js");
  assert.match(app, /app\.get\(["']\/api\/health["']/);
  assert.match(app, /AI_ALLOWED_ORIGINS/);
  assert.doesNotMatch(app, /origin\s*:\s*["']\*["']/);
  assert.doesNotMatch(app, /callback\(null,\s*["']\*["']\)/);
});

test("documentos nao incluem valores concretos de credenciais", () => {
  const credentialValue = /(SUPABASE_(?:SERVICE_ROLE_KEY|ANON_KEY)|TOKEN|PASSWORD|SECRET)\s*[:=]\s*[A-Za-z0-9_.-]{12,}/i;
  for (const file of docs) {
    assertNoPattern(file, credentialValue, "valor concreto de credencial na documentacao");
    assertNoPattern(file, /eyJ[A-Za-z0-9_-]{20,}/, "JWT na documentacao");
  }
});
