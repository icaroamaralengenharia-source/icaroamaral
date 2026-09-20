import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { buildEloSystemPrompt_ } from "../src/app.js";

const repoDir = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const policySource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-communication-policy.js"), "utf8");

function loadPolicy() {
  const sandbox = { console };
  vm.runInNewContext(policySource, sandbox, { filename: "elo-communication-policy.js" });
  return sandbox.EloCommunicationPolicy;
}

test("T1-T2: classifica cálculo simples e decisão sem transformar tudo em relatório", () => {
  const policy = loadPolicy();
  assert.equal(policy.classifyInteraction("quanto é 2+2?"), "CALCULATION");
  assert.equal(policy.applyPolicy("4", "CONVERSA"), "4");
  assert.equal(policy.classifyInteraction("qual das duas opções você escolheria?"), "DECISION");
});

test("T3-T4: política exige continuidade e prioriza o contexto recente", () => {
  const policy = loadPolicy();
  const prompt = buildEloSystemPrompt_({
    conversationSummary: "O usuário informou: minha laje tem 40 m².",
    workingMemorySummary: "Referente atual: laje de 40 m².",
    eloContext: "obras"
  });
  assert.match(policy.buildPrompt(), /histórico recente/i);
  assert.match(policy.buildPrompt(), /repita/i);
  assert.match(prompt, /laje tem 40 m²/i);
  assert.match(prompt, /pergunta atual.*memória de trabalho/i);
});

test("T5-T7: conselho, discordância, risco e incerteza fazem parte da política", () => {
  const policy = loadPolicy();
  const prompt = policy.buildPrompt();
  assert.match(prompt, /recomendação real/i);
  assert.match(prompt, /insegura, inconsistente ou ineficiente/i);
  assert.match(prompt, /não invente fatos/i);
  assert.match(prompt, /risco óbvio/i);
  assert.match(prompt, /exatamente o que falta/i);
});

test("T8-T11: naturalidade não adiciona proatividade artificial e usa primeira pessoa", () => {
  const policy = loadPolicy();
  assert.equal(policy.applyPolicy("30.", "CONVERSA"), "30.");
  assert.match(policy.buildPrompt(), /Fale naturalmente em primeira pessoa/i);
  assert.match(policy.buildPrompt(), /não termine sempre com uma pergunta genérica/i);
  assert.equal(policy.classifyInteraction("estou cansado desse projeto"), "CONVERSATION");
});

test("T12-T13: ações, relatórios e JSON preservam o schema", () => {
  const policy = loadPolicy();
  assert.equal(policy.isStructuredMode({ responseType: "json" }), true);
  assert.equal(policy.isStructuredMode({ responseType: "action" }), true);
  assert.equal(policy.isStructuredMode({ responseType: "report" }), true);
  assert.equal(policy.classifyInteraction("gerar relatório", { responseType: "report" }), "REPORT");
  assert.match(policy.buildPrompt(), /preserve formatos estruturados|formato exigido/i);
});

test("T14-T15: memória disponível é contextual e memória ausente não é inventada", () => {
  const withMemory = buildEloSystemPrompt_({
    permanentUserMemorySummary: "Prefere respostas objetivas.",
    memoriesSummary: "Projeto atual: reforma residencial.",
    eloContext: "geral"
  });
  const withoutMemory = buildEloSystemPrompt_({ eloContext: "geral" });
  assert.match(withMemory, /Prefere respostas objetivas/i);
  assert.match(withMemory, /Projeto atual: reforma residencial/i);
  assert.match(withoutMemory, /não invente fatos/i);
  assert.match(withoutMemory, /memória permanente/i);
});
