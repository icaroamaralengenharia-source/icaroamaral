import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const files = {
  pack: "docs/PACOTE-OPERACIONAL-DEMO-MUNICIPAL.md",
  checklist: "docs/CHECKLIST-UNICO-DEMO-MUNICIPAL.md",
  guide: "docs/GUIA-CRIACAO-AMBIENTE-DEMO-MUNICIPAL.md",
  operation: "docs/OPERACAO-AMBIENTE-DEMO-MUNICIPAL.md",
  finalReadiness: "docs/RELATORIO-FINAL-PRONTIDAO-DEMO-MUNICIPAL.md",
  schema: "backend/src/data/municipal-demo-schema-bundle.sql",
  seed: "backend/src/data/municipal-demo-seed.sql",
  verification: "backend/src/data/municipal-demo-verification.sql",
  cleanup: "backend/src/data/municipal-demo-cleanup.sql",
  gitignore: ".gitignore",
  packageJson: "backend/package.json"
};

const requiredSections = [
  "Pre-requisitos",
  "Projeto Demo Isolado",
  "Dominio e HTTPS",
  "Variaveis Locais",
  "Usuarios Ficticios",
  "Preflight",
  "Dry-run",
  "Aplicacao Manual do Schema",
  "Aplicacao Manual do Seed",
  "Verification",
  "Health",
  "Painel",
  "Offline",
  "Homologacao Live",
  "Backup",
  "Rollback",
  "Cleanup",
  "Evidencias",
  "Criterios de Aprovacao",
  "Criterios de Parada Imediata"
];

const blockedRefs = [
  "mplpzyalcxhhinuvjthx",
  "lidueokjpzxdybtongbk"
];

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function combinedDocs() {
  return [read(files.pack), read(files.checklist)].join("\n");
}

function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, "");
}

test("pacote operacional e checklist existem e apontam para arquivos internos existentes", () => {
  for (const file of Object.values(files)) {
    assert.ok(existsSync(resolve(root, file)), `arquivo ausente: ${file}`);
  }
  const docs = combinedDocs();
  for (const file of [files.schema, files.seed, files.verification, files.cleanup, files.guide, files.operation, files.finalReadiness]) {
    assert.match(docs, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `caminho nao citado: ${file}`);
  }
});

test("ordem operacional obrigatoria esta preservada", () => {
  const text = read(files.pack);
  let lastIndex = -1;
  for (const section of requiredSections) {
    const index = text.indexOf(section);
    assert.ok(index > lastIndex, `secao fora de ordem ou ausente: ${section}`);
    lastIndex = index;
  }
});

test("checklist unico cobre todos os passos obrigatorios para operador novo", () => {
  const text = read(files.checklist);
  for (const section of requiredSections) {
    assert.match(text, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `checklist sem ${section}`);
  }
  assert.match(text, /Use este checklist do inicio ao fim/i);
  assert.match(text, /Marque cada item manualmente/i);
});

test("nenhuma credencial real, segredo ou project ref bloqueado aparece no pacote", () => {
  const docs = combinedDocs();
  assert.doesNotMatch(docs, /service[_-]?role|SUPABASE_SERVICE_ROLE_KEY|JWT|eyJ[A-Za-z0-9_-]{20,}\.|postgres:\/\/|connection string real|senha real|token real/i);
  for (const ref of blockedRefs) {
    assert.doesNotMatch(docs, new RegExp(ref, "i"), `project ref bloqueado citado: ${ref}`);
  }
});

test("comandos padrao nao executam escrita nem ativam live", () => {
  const pkg = JSON.parse(read(files.packageJson));
  for (const [name, script] of Object.entries(pkg.scripts || {})) {
    if (!name.startsWith("demo:")) continue;
    assert.doesNotMatch(script, /--execute/i, `${name} nao pode executar por padrao`);
    assert.doesNotMatch(script, /RUN_DEMO_LIVE_TESTS=true/i, `${name} nao pode ativar live por padrao`);
  }
  const docsWithoutCode = stripCodeBlocks(combinedDocs());
  assert.doesNotMatch(docsWithoutCode, /RUN_DEMO_LIVE_TESTS=true\s+[^`\n]*npm|--execute\s+[^`\n]*npm/i);
});

test("comandos de escrita estao destacados e exigem confirmacoes literais", () => {
  const docs = combinedDocs();
  for (const confirmation of ["APLICAR_SCHEMA_DEMO", "APLICAR_SEED_DEMO", "REMOVER_DADOS_DEMO_MUNICIPAL"]) {
    assert.match(docs, new RegExp(`--confirm\\s+${confirmation}`), `confirmacao ausente: ${confirmation}`);
  }
  assert.match(docs, /ESCRITA MANUAL[\s\S]*municipal-demo-apply-schema\.js --execute --confirm APLICAR_SCHEMA_DEMO/i);
  assert.match(docs, /ESCRITA MANUAL[\s\S]*municipal-demo-apply-seed\.js --execute --confirm APLICAR_SEED_DEMO/i);
  assert.match(docs, /ESCRITA MANUAL[\s\S]*municipal-demo-cleanup\.js --execute --confirm REMOVER_DADOS_DEMO_MUNICIPAL/i);
});

test("WhatsApp e email permanecem desligados", () => {
  const docs = combinedDocs();
  assert.match(docs, /MUNICIPAL_WHATSAPP_ENABLED=false/);
  assert.match(docs, /MUNICIPAL_EMAIL_ENABLED=false/);
  assert.doesNotMatch(docs, /MUNICIPAL_WHATSAPP_ENABLED=true|MUNICIPAL_EMAIL_ENABLED=true/);
});

test("verification e tratado como read-only e cleanup como manual filtrado", () => {
  const docs = combinedDocs();
  assert.match(docs, /municipal-demo-verification\.sql[\s\S]*(somente leitura|SELECT|WITH)/i);
  assert.match(docs, /municipal-demo-cleanup\.sql[\s\S]*(manual|filtrado|DEMO_MUNICIPAL_)/i);
  assert.match(docs, /Nao repetir em caso de erro sem analise|Nao repetir sem analise/i);
});

test("artifacts permanece fora do Git", () => {
  assert.match(read(files.gitignore), /^artifacts\/$/m);
  const docs = combinedDocs();
  assert.match(docs, /artifacts\//);
  assert.match(docs, /fora do Git|ignorado pelo Git/i);
});

test("criterios de aprovacao e parada imediata estao explicitos", () => {
  const docs = combinedDocs();
  for (const phrase of [
    "preflight passa",
    "dry-run passa",
    "verification sem inconsistencias",
    "offline ok",
    "projeto incorreto",
    "credencial impressa",
    "falha de RLS",
    "mistura de tenants"
  ]) {
    assert.match(docs, new RegExp(phrase, "i"), `criterio ausente: ${phrase}`);
  }
});
