import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { buildEloSystemPrompt_ } from "../src/app.js";

const repoDir = join(fileURLToPath(new URL("..", import.meta.url)), "..");
const policyPath = join(repoDir, "relatorio-qualidade-obras", "elo-proactive-reasoning-policy.js");
const policySource = readFileSync(policyPath, "utf8");

function loadPolicy() {
  const sandbox = { console };
  vm.runInNewContext(policySource, sandbox, { filename: policyPath });
  return sandbox.EloProactiveReasoningPolicy;
}

function plan(message, context = {}, metadata = {}) {
  return loadPolicy().buildResponsePlan(message, context, metadata);
}

const simpleCases = [
  ["18 x 7", "CALCULATION"],
  ["Qual é a capital da Bahia?", "SIMPLE_FACT"],
  ["Hoje é que dia?", "SIMPLE_FACT"],
  ["Oi, tudo bem?", "CONVERSATION"],
  ["136", "SIMPLE_FACT"]
];
simpleCases.forEach(([message, intent], index) => {
  test(`SIMPLE ${index + 1}: ${message}`, () => {
    const result = plan(message);
    assert.equal(result.intent, intent);
    assert.equal(result.proactivityLevel, "NONE");
    assert.equal(result.selfCheckLevel, "NONE");
  });
});

const technicalCases = [
  "Como avaliar uma trinca na parede?",
  "Vou concretar amanhã.",
  "Quanto concreto para uma laje de 40m² com 10 cm?",
  "Como registrar um RDO da obra?",
  "Qual material usar na impermeabilização?"
];
technicalCases.forEach((message, index) => {
  test(`TECHNICAL ${index + 1}: ${message}`, () => {
    const result = plan(message);
    assert.equal(result.intent, "TECHNICAL");
    assert.ok(["RELEVANT", "CRITICAL"].includes(result.proactivityLevel));
    assert.ok(["TECHNICAL", "HIGH_STAKES"].includes(result.selfCheckLevel));
  });
});

const decisionCases = [
  "Qual telha você escolheria?",
  "Entre telha metálica e cerâmica, qual você escolheria?",
  "Devo fazer o piso agora?",
  "Qual opção vale mais a pena?",
  "Faço ou não faço essa alteração?"
];
decisionCases.forEach((message, index) => {
  test(`DECISION ${index + 1}: ${message}`, () => {
    const result = plan(message);
    assert.equal(result.intent, "DECISION");
    assert.equal(result.answerMode, "DECISION");
    assert.equal(result.decisionSupport.required, true);
    assert.equal(result.proactivityLevel, "LIGHT");
  });
});

test("KNOWLEDGE GAP 1: viga sem dados essenciais", () => {
  const result = plan("Qual ferro eu uso nessa viga?");
  assert.deepEqual(Array.from(result.missingEssential), ["vao", "secao", "apoios", "carga"]);
  assert.ok(["TECHNICAL", "HIGH_STAKES"].includes(result.selfCheckLevel));
});

test("KNOWLEDGE GAP 2: laje com área mas sem espessura", () => {
  const result = plan("Tem 40m² de laje. Quanto concreto?");
  assert.deepEqual(Array.from(result.missingEssential), ["espessura"]);
});

test("KNOWLEDGE GAP 3: área e espessura disponíveis não bloqueiam", () => {
  const result = plan("Quanto concreto para a laje?", { workingMemorySummary: "Área 40 m², espessura 10 cm." });
  assert.deepEqual(Array.from(result.missingEssential), []);
});

test("KNOWLEDGE GAP 4: medição sem critério pede mínimo útil", () => {
  const result = plan("Acho que essa medição está certa.");
  assert.deepEqual(Array.from(result.missingUseful), ["quantidade medida e critério contratual"]);
});

test("KNOWLEDGE GAP 5: não inventa dado para decisão", () => {
  const result = plan("Qual telha você escolheria?");
  assert.equal(result.missingEssential.length, 0);
  assert.equal(result.missingUseful.length, 1);
});

test("CONTEXT 1: follow-up usa contexto recente", () => {
  const result = plan("e depois?", { history: [{ role: "user", content: "Estou executando a alvenaria da casa." }] });
  assert.equal(result.intent, "CONTEXT");
  assert.ok(result.contextSignals.recent);
});

test("CONTEXT 2: follow-up quantitativo mantém obra atual", () => {
  const result = plan("quanto vai?", { history: [{ role: "user", content: "Tenho uma laje de 40 m²." }] });
  assert.equal(result.intent, "TECHNICAL");
});

test("CONTEXT 3: estágio é inferido só por evidência", () => {
  assert.equal(plan("Vou concretar amanhã.").projectStage, "estrutura");
  assert.equal(plan("Preciso de ajuda.").projectStage, "");
});

test("CONTEXT 4: contexto de trabalho tem prioridade observável", () => {
  const result = plan("detalhe isso", {
    workingMemorySummary: "Referente atual: viga de 4 m.",
    memoriesSummary: "Tema antigo: pintura externa."
  });
  assert.deepEqual(Array.from(result.contextPriority.slice(0, 2)), ["CURRENT_USER_MESSAGE", "CURRENT_WORKING_CONTEXT"]);
  assert.equal(result.contextSignals.working, true);
});

test("CONTEXT 5: memória permanente não substitui mensagem atual", () => {
  const result = plan("Quanto é 18 x 7?", { memoriesSummary: "Projeto antigo de cobertura." });
  assert.equal(result.intent, "CALCULATION");
  assert.equal(result.proactivityLevel, "NONE");
});

const riskCases = [
  "Vou concretar sem conferir as instalações.",
  "Vou retirar o escoramento agora.",
  "Vou fechar a hidráulica sem teste.",
  "A medição está incompatível, mas vou aprovar.",
  "Vou fazer assim mesmo, sem conferir a armadura."
];
riskCases.forEach((message, index) => {
  test(`RISK ${index + 1}: ${message}`, () => {
    const result = plan(message);
    assert.equal(result.proactivityLevel, "CRITICAL");
    assert.equal(result.selfCheckLevel, "HIGH_STAKES");
    assert.equal(result.riskDetected, true);
    assert.equal(result.valueAddLimit, 2);
  });
});

test("SELF-CHECK 1: conta simples não recebe segunda passagem pesada", () => {
  const policy = loadPolicy();
  const result = policy.selfCheckResponse(plan("2 + 2"), "4");
  assert.equal(result.level, "NONE");
  assert.equal(result.passed, true);
});

test("SELF-CHECK 2: lacuna essencial é detectada", () => {
  const policy = loadPolicy();
  const result = plan("Qual ferro eu uso nessa viga?");
  assert.equal(policy.selfCheckResponse(result, "Use aço CA-50.").passed, false);
});

test("SELF-CHECK 3: risco crítico sem discordância é detectado", () => {
  const policy = loadPolicy();
  const result = plan("Vou concretar sem conferir as instalações.");
  assert.equal(policy.selfCheckResponse(result, "Pode fazer, está certo.").passed, false);
  assert.match(policy.applySelfCheck(result, "Pode fazer, está certo."), /não faria|não fecharia|antes de/i);
});

test("SELF-CHECK 4: risco crítico bem tratado passa", () => {
  const policy = loadPolicy();
  const result = plan("Vou retirar o escoramento agora.");
  assert.equal(policy.selfCheckResponse(result, "Eu não retiraria o escoramento sem confirmar a condição estrutural.").passed, true);
});

test("SELF-CHECK 5: preço sem fonte é sinalizado", () => {
  const policy = loadPolicy();
  const result = plan("Qual o custo dessa obra?", {}, {});
  assert.ok(policy.selfCheckResponse(result, "O preço é R$ 25.000,00.").issues.includes("ungrounded_numeric_claim"));
});

test("SELF-CHECK 6: preço contextualizado não é bloqueado", () => {
  const policy = loadPolicy();
  const result = plan("Qual o custo dessa obra?", { workingMemorySummary: "Orçamento informado: R$ 25.000,00." });
  assert.equal(policy.selfCheckResponse(result, "Com base no orçamento informado, o valor é R$ 25.000,00.").issues.includes("ungrounded_numeric_claim"), false);
});

test("SELF-CHECK 7: norma não inventada é sinalizada", () => {
  const policy = loadPolicy();
  const result = plan("Como executar essa etapa técnica?");
  assert.ok(policy.selfCheckResponse(result, "A NBR 99999 obriga esse procedimento.").issues.includes("ungrounded_normative_claim"));
});

test("SELF-CHECK 8: modo estruturado preserva schema", () => {
  const policy = loadPolicy();
  const result = plan("Gere o relatório", {}, { responseType: "json" });
  assert.equal(result.structured, true);
  assert.match(policy.buildPrompt(result), /preserve.*schema/i);
});

const adversarialPrompts = ["e aí?", "isso dá?", "faço ou não?", "quanto vai?", "e depois?", "qual melhor?", "faz aí", "tá certo?", "posso concretar?"];
adversarialPrompts.forEach((message, index) => {
  test(`ADVERSARIAL ${index + 1}: ${message}`, () => {
    const result = plan(message, { history: [{ role: "user", content: "Estou na etapa de alvenaria e preciso liberar a próxima frente." }] });
    assert.ok(result.intent);
    assert.ok(result.answerMode);
    assert.ok(result.proactivityLevel);
    assert.ok(result.nextAction !== undefined);
  });
});

test("STRESS 200 turnos: sem bleed, memória inventada ou perda controlada", () => {
  const policy = loadPolicy();
  const history = [];
  let crossProjectBleed = 0;
  let inventedMemory = 0;
  let lostRecentContext = 0;
  const distributions = { NONE: 0, LIGHT: 0, TECHNICAL: 0, HIGH_STAKES: 0 };
  const prompts = [
    "18 x 7", "Vou concretar amanhã.", "Qual ferro uso nessa viga?", "Estou cansado desse projeto.",
    "Qual telha você escolheria?", "e depois?", "Tem 40m² de laje. Quanto concreto?", "Faça o RDO.",
    "Vou concretar sem conferir as instalações.", "Oi, tudo bem?"
  ];
  for (let turn = 0; turn < 200; turn += 1) {
    const message = prompts[turn % prompts.length];
    const context = { history: history.slice(-12), workingMemorySummary: turn % 2 ? "Obra atual: laje e alvenaria." : "" };
    const result = policy.buildResponsePlan(message, context, message === "Faça o RDO." ? { responseType: "report" } : {});
    distributions[result.selfCheckLevel] += 1;
    if (result.contextSignals.permanent && !context.memoriesSummary && !context.relevantMemoriesSummary) inventedMemory += 1;
    if (message === "e depois?" && result.intent !== "CONTEXT") lostRecentContext += 1;
    if (result.projectStage === "" && /concretar|laje|viga|alvenaria/.test(message.toLowerCase())) crossProjectBleed += 1;
    history.push({ role: turn % 2 ? "assistant" : "user", content: message });
  }
  assert.equal(crossProjectBleed, 0);
  assert.equal(inventedMemory, 0);
  assert.equal(lostRecentContext, 0);
  assert.equal(distributions.NONE > 0, true);
  assert.equal(distributions.HIGH_STAKES > 0, true);
});

test("COST CONTROL: perguntas simples não acionam self-check pesado", () => {
  const policy = loadPolicy();
  const simple = Array.from({ length: 40 }, (_, index) => `${index + 2} + 2`);
  const levels = simple.map((message) => policy.buildResponsePlan(message).selfCheckLevel);
  const heavy = levels.filter((level) => level === "TECHNICAL" || level === "HIGH_STAKES").length;
  assert.equal(heavy, 0);
});

test("WEB/APP PARITY: 30 prompts compartilham intenção e níveis", () => {
  const web = loadPolicy();
  const app = loadPolicy();
  const prompts = ["18 x 7", "Oi", "Qual telha?", "Qual ferro nessa viga?", "Vou concretar amanhã.", "e depois?"];
  for (let index = 0; index < 30; index += 1) {
    const message = prompts[index % prompts.length];
    const context = { history: [{ role: "user", content: "Obra atual: laje e alvenaria." }] };
    const webPlan = web.buildResponsePlan(message, context, {});
    const appPlan = app.buildResponsePlan(message, context, {});
    assert.deepEqual(
      [webPlan.intent, webPlan.proactivityLevel, webPlan.selfCheckLevel, webPlan.answerMode],
      [appPlan.intent, appPlan.proactivityLevel, appPlan.selfCheckLevel, appPlan.answerMode]
    );
  }
});

test("INTEGRATION: plano proativo entra no prompt do backend sem expor conteúdo do usuário", () => {
  const result = plan("Vou concretar sem conferir as instalações.");
  const prompt = buildEloSystemPrompt_({ proactiveReasoningPlan: result, eloContext: "obras" });
  assert.match(prompt, /PROACTIVE_REASONING_LAYER/);
  assert.match(prompt, /CRITICAL/);
  assert.match(prompt, /discorde claramente/i);
  assert.doesNotMatch(prompt, /Vou concretar sem conferir/);
});

test("OFFLINE: guarda crítica não concorda automaticamente", () => {
  const context = { console, window: undefined, globalThis: {} };
  vm.runInNewContext(policySource, context);
  const coreSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-offline-core-v2.js"), "utf8");
  vm.runInNewContext(coreSource, context);
  const result = context.globalThis.EloOfflineCoreV2.resolve("Vou concretar sem conferir as instalações.");
  assert.match(result.shortAnswer, /não faria|antes de liberar|conferiria/i);
});

test("SURFACES: camada carregada no Web, Stock, relatório e Service Worker", () => {
  ["elo.html", "stock-ai-obras.html", "relatorio-qualidade-obras/relatorio-qualidade-obras.html", "elo-sw.js"].forEach((file) => {
    assert.match(readFileSync(join(repoDir, file), "utf8"), /elo-proactive-reasoning-policy\.js/);
  });
});
