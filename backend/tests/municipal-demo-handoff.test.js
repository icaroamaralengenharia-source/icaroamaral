import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const root = process.cwd();
const handoffPath = "docs/HANDOFF-CRIACAO-PROJETO-DEMO.md";
const blockedRefs = ["mplpzyalcxhhinuvjthx", "lidueokjpzxdybtongbk"];

function read(path = handoffPath) {
  return readFileSync(resolve(root, path), "utf8");
}

function copyBlock(text) {
  const match = text.match(/```text\n([\s\S]*?)```/);
  assert.ok(match, "bloco copiavel ausente");
  return match[1];
}

test("handoff existe e orienta a criacao manual do projeto demo", () => {
  assert.ok(existsSync(resolve(root, handoffPath)));
  const text = read();
  assert.match(text, /Abrir o provedor autorizado/i);
  assert.match(text, /Criar um projeto exclusivo de demonstracao/i);
  assert.match(text, /DEMO_MUNICIPAL_/);
  assert.match(text, /Parar antes de executar qualquer SQL/i);
});

test("handoff documenta projetos bloqueados e ambientes que nao podem ser reutilizados", () => {
  const text = read();
  for (const ref of blockedRefs) {
    assert.match(text, new RegExp(ref), `project ref bloqueado ausente: ${ref}`);
  }
  for (const forbidden of ["E2E", "producao", "projeto de cliente"]) {
    assert.match(text, new RegExp(forbidden, "i"), `ambiente proibido ausente: ${forbidden}`);
  }
});

test("bloco copiavel contem apenas campos nao sensiveis esperados", () => {
  const block = copyBlock(read());
  const expectedFields = [
    "NOME_INTERNO=",
    "DOMINIO_HTTPS=",
    "PROJECT_REF=",
    "REGIAO=",
    "RESPONSAVEL=",
    "ISOLAMENTO=SIM",
    "BACKUP=SIM",
    "WHATSAPP_DESLIGADO=SIM",
    "EMAIL_DESLIGADO=SIM"
  ];
  for (const field of expectedFields) {
    assert.match(block, new RegExp(`^${field}$`, "m"), `campo ausente: ${field}`);
  }
  assert.doesNotMatch(block, /senha|token|jwt|service|connection|string|key|chave|password/i);
});

test("nao orienta expor credenciais nem contem campos sensiveis", () => {
  const text = read();
  assert.match(text, /Nunca enviar ao Codex\/chat/i);
  assert.match(text, /Nao enviar senha/i);
  assert.match(text, /Nao enviar token/i);
  assert.match(text, /Nao enviar chave administrativa/i);
  assert.match(text, /Nao enviar string de conexao/i);
  assert.doesNotMatch(copyBlock(text), /senha|token|credencial|chave|connection|string|jwt|service/i);
});

test("nao contem comando SQL, deploy ou instrucao operacional destrutiva", () => {
  const text = read();
  assert.doesNotMatch(text, /\b(select|insert|update|delete|drop|truncate|alter|create table)\b/i);
  assert.doesNotMatch(text, /\bdeploy\b.*(executar|rodar|fazer)|npm\s+run\s+deploy|supabase\s+/i);
  assert.doesNotMatch(text, /--execute/i);
});

test("confirmacoes SIM obrigatorias estao no bloco copiavel", () => {
  const block = copyBlock(read());
  for (const confirmation of ["ISOLAMENTO=SIM", "BACKUP=SIM", "WHATSAPP_DESLIGADO=SIM", "EMAIL_DESLIGADO=SIM"]) {
    assert.match(block, new RegExp(`^${confirmation}$`, "m"));
  }
});
