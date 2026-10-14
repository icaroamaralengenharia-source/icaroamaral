import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { buildConversationSummary_, buildEloSystemPrompt_, getEloRelevantContext_, validateEloChatRequest_ } from "../src/app.js";

const repoDir = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const policySource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-communication-policy.js"), "utf8");
const proactivePolicySource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-proactive-reasoning-policy.js"), "utf8");
const technicalValidatorSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-technical-validator.js"), "utf8");

function loadPolicy() {
  const sandbox = { console };
  vm.runInNewContext(policySource, sandbox, { filename: "elo-communication-policy.js" });
  return sandbox.EloCommunicationPolicy;
}

function loadGlobalScript(source, fileName, globalName) {
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename: fileName });
  return sandbox[globalName];
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

test("política conversa de forma universal sem truncar respostas técnicas nem relatos", () => {
  const policy = loadPolicy();
  const prompt = policy.buildPrompt();
  assert.match(prompt, /amigo inteligente/i);
  assert.match(prompt, /qualquer assunto/i);
  assert.match(prompt, /uma a três frases/i);
  assert.match(prompt, /respostas curtas, pronomes, correções/i);
  assert.match(prompt, /nunca corte uma resposta já gerada/i);
  assert.match(prompt, /até 45 palavras/i);
  assert.match(prompt, /diferença entre observar um objeto e enxergar seus detalhes/i);

  const detailedAnswer = [
    "Resultado principal.",
    "\n\nMemória de cálculo: área de 24 m² multiplicada pela espessura informada de 0,12 m resulta em 2,88 m³.",
    "\n\nPremissa: a espessura foi fornecida pelo usuário; não incluí perdas.",
    "\n\nVerificação: confirme vãos, juntas e especificação antes de fechar o quantitativo."
  ].join("");
  assert.equal(policy.applyPolicy(detailedAnswer, "ENGENHEIRO"), detailedAnswer);
  assert.equal(policy.applyPolicy(detailedAnswer, "CONVERSA"), detailedAnswer);
});

test("P0: histórico online mantém vinte turnos e resume fatos literais sem inventar", () => {
  const history = Array.from({ length: 40 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: index === 0
      ? "Minha jiboia fica perto da janela, sem sol direto, e rego duas vezes por semana."
      : index === 2
        ? "A personagem da história se chama Lia."
        : index % 2 === 0 ? `Minha atualização do turno ${index / 2 + 1}.` : `Resposta do turno ${Math.ceil(index / 2)}.`
  }));
  const summary = buildConversationSummary_(history);
  const validation = validateEloChatRequest_({ message: "Você lembra o nome dela?", history, context: {} });

  assert.equal(validation.ok, true);
  assert.equal(validation.payload.history.length, 40);
  assert.match(summary, /jiboia.*janela, sem sol direto.*duas vezes por semana/i);
  assert.match(summary, /Lia/);
  assert.doesNotMatch(summary, /Icaro|Ícaro/);
});

test("contexto acima de 48 mensagens mantém fatos iniciais no resumo enviado ao modelo", async () => {
  const fact = `Meu gato se chama ${randomUUID()} e meu café preferido é coado às 7h.`;
  const history = Array.from({ length: 60 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: index === 0 ? fact : `Mudança de assunto do turno ${index + 1}.`
  }));
  const validation = validateEloChatRequest_({
    message: "Qual o nome do meu gato e como gosto do café?",
    history,
    context: { currentConversationId: "conversation-over-48" }
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.payload.history.length, 48);
  assert.equal(validation.payload.history.some((item) => item.content === fact), false);
  const relevant = await getEloRelevantContext_({ payload: validation.payload, memoryStore: null });
  assert.ok(relevant.context.conversationSummary.includes(fact));
  assert.ok(buildEloSystemPrompt_(relevant.context).includes(fact));
});

test("arquivo contextual é vinculado à conversa e não permanece em outro request/usuário", async () => {
  const fact = `Fato particular fornecido somente nesta conversa: ${randomUUID()}.`;
  const history = Array.from({ length: 48 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant", content: `Assunto recente ${index + 1}.`
  }));
  const archive = { conversationId: "conversation-user-a", messages: [{ role: "user", content: fact }] };
  for (const [conversationId, suppliedArchive, shouldContainFact] of [
    ["conversation-user-a", archive, true],
    ["conversation-user-b", archive, false],
    ["conversation-user-b", undefined, false],
    ["", archive, false]
  ]) {
    const validation = validateEloChatRequest_({
      message: "O que foi informado no início?", history,
      context: { currentConversationId: conversationId, conversationArchive: suppliedArchive }
    });
    assert.equal(validation.ok, true);
    const relevant = await getEloRelevantContext_({ payload: validation.payload, memoryStore: null });
    assert.equal(buildEloSystemPrompt_(relevant.context).includes(fact), shouldContainFact);
  }
});

test("P2: conversa aberta recebe orientação proativa contextual, perguntas simples não", () => {
  const policy = loadGlobalScript(proactivePolicySource, "elo-proactive-reasoning-policy.js", "EloProactiveReasoningPolicy");
  const disclosure = policy.buildResponsePlan("Minha jiboia fica perto da janela e está crescendo bem.", {}, {});
  const factQuestion = policy.buildResponsePlan("Qual é a capital do Chile?", {}, {});

  assert.equal(disclosure.proactivityLevel, "LIGHT");
  assert.equal(disclosure.answerMode, "CONVERSATIONAL");
  assert.equal(factQuestion.proactivityLevel, "NONE");
  assert.match(policy.buildPrompt(disclosure), /vary reaction\/comment\/question/i);
});

test("P3: cálculo genérico de momento para viga biapoiada com carga pontual central", () => {
  const validator = loadGlobalScript(technicalValidatorSource, "elo-technical-validator.js", "EloTechnicalValidator");
  const result = validator.validateTechnicalQuestion(
    "Qual o momento fletor máximo de uma viga simplesmente apoiada, vão L = 4 m, com carga pontual central P = 8 kN?"
  );
  const convertedUnits = validator.validateTechnicalQuestion(
    "Calcule o momento máximo da viga biapoiada, carga concentrada no centro P = 8000 N e L = 400 cm."
  );

  assert.equal(result.kind, "beam_point_load_statics");
  assert.match(result.answer, /8,00 kN·m/);
  assert.match(result.answer, /4,00 kN/);
  assert.equal(convertedUnits.values.maximumMomentKNm, 8);
});

test("P0: prompt online recebe relógio de execução para datas relativas", () => {
  const prompt = buildEloSystemPrompt_({ eloContext: "geral" });
  assert.match(prompt, /RUNTIME CLOCK \(SOURCE OF TRUTH\)/);
  assert.match(prompt, /America\/Bahia/);
});

test("contexto validado preserva analise da imagem e descarta campos arbitrarios", () => {
  const analysis = "Imagem A: fissura vertical junto ao vao da janela.";
  const validation = validateEloChatRequest_({
    message: "Qual e o principal problema?",
    context: {
      currentConversationId: "conversation-current",
      imageAnalysisContext: {
        type: "image",
        source: "explicit_history",
        available: true,
        attachmentId: "attachment-image-a",
        fileName: "image-A.jpeg",
        conversationId: "conversation-current",
        sequence: 1,
        analysis
      },
      lastMeaningfulAnalysis: { analysis: "nao deveria passar pelo allowlist antigo" }
    }
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.payload.context.imageAnalysisContext.source, "explicit_history");
  assert.equal(validation.payload.context.imageAnalysisContext.analysis, analysis);
  assert.equal(validation.payload.context.lastMeaningfulAnalysis, undefined);
});

test("chat aceita entrada longa e mantém histórico realista de vinte turnos", () => {
  const message = "Registro técnico da obra, lote 07; ".repeat(1000).slice(0, 32891).trimEnd().padEnd(32891, "x");
  const history = Array.from({ length: 44 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: index % 2 === 0
      ? `Turno ${index + 1}: a equipe concretou o trecho ${index + 1} e registrou a cura.`
      : `Resposta ${index + 1}: conferir o registro de cura e a liberação da próxima etapa.`
  }));
  const validation = validateEloChatRequest_({ message, history, context: {} });

  assert.equal(validation.ok, true);
  assert.equal(validation.payload.message.length, 32891);
  assert.equal(validation.payload.message, message);
  assert.equal(validation.payload.history.length, 44);

  const overflow = validateEloChatRequest_({ message: "x".repeat(36001), context: {} });
  assert.equal(overflow.ok, false);
  assert.equal(overflow.status, 413);
});

test("validador mantém o resumo documental ativo para perguntas de acompanhamento", () => {
  const documentSummary = "Documento ativo: projeto.pdf\nTrecho extraído: viga baldrame e fundação.";
  const validation = validateEloChatRequest_({
    message: "resuma isso",
    context: { documentsSummary: documentSummary }
  });

  assert.equal(validation.ok, true);
  assert.equal(validation.payload.context.documentsSummary, documentSummary);
});

test("prompt usa analise de imagem ativa ou historica sem alegar indisponibilidade", () => {
  const prompt = buildEloSystemPrompt_({
    imageAnalysisContext: {
      type: "image",
      source: "active_attachment",
      available: true,
      fileName: "image-A.jpeg",
      analysis: "Problema principal: trinca diagonal no encontro da viga."
    }
  });
  assert.match(prompt, /IMAGE ANALYSIS CONTEXT/);
  assert.match(prompt, /trinca diagonal no encontro da viga/i);
  assert.match(prompt, /Ground relevant follow-ups in its supplied analysis/i);
  assert.match(buildEloSystemPrompt_({ imageAnalysisContext: { type: "image", source: "explicit_history", available: false } }), /Do not substitute the active PDF/i);
});
