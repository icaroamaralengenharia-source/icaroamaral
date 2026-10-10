import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");
const policySource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-communication-policy.js"), "utf8");
const assistantSource = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");

function loadPolicy() {
  const sandbox = {};
  vm.runInNewContext(policySource, sandbox, { filename: "elo-communication-policy.js" });
  return sandbox.EloCommunicationPolicy;
}

function loadAssistant() {
  const values = new Map();
  const policy = loadPolicy();
  const window = {
    ELO_STANDALONE_MODE: true,
    ELO_SKIP_AUTO_WIDGET: true,
    EloCommunicationPolicy: policy,
    location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/index.html" },
    localStorage: {
      getItem(key) { return values.has(key) ? values.get(key) : null; },
      setItem(key, value) { values.set(key, String(value)); },
      removeItem(key) { values.delete(key); }
    },
    performance: { mark() {}, now() { return 0; } },
    setTimeout() {},
    fetch() { throw new Error("fetch inesperado no teste de humor local"); }
  };
  const sandbox = {
    console,
    window,
    globalThis: window,
    document: { readyState: "complete", addEventListener() {} }
  };
  vm.createContext(sandbox);
  vm.runInContext(assistantSource, sandbox, { filename: "elo-assistente.js" });
  return { assistant: window.EloAssistente, policy };
}

test("politica reconhece pedidos de humor sem capturar conversas serias sobre temas sensiveis", () => {
  const policy = loadPolicy();

  assert.equal(policy.isHumorRequest("conte uma piada de matematica"), true);
  assert.equal(policy.isHumorRequest("me surpreenda com algo leve e divertido"), true);
  assert.equal(policy.isHumorRequest("por que piadas sobre suicidio podem causar dano?"), false);
  assert.equal(policy.isHumorRequest("como conversar com alguem que pensa em suicidio?"), false);
});

test("respostas locais de humor usam temas leves e variados", () => {
  const { assistant } = loadAssistant();
  const cases = [
    ["conte uma piada de matematica", /3 e o 4.*somaram 7/i],
    ["conte uma piada de engenharia", /ideias em escala/i],
    ["conte uma piada de arquitetura", /janela.*ideia nova/i],
    ["conte uma piada de tecnologia", /computador.*abas/i],
    ["conte uma piada com animais", /gato.*maquete/i]
  ];

  for (const [request, expected] of cases) {
    const answer = assistant.buildConversationalResponseForTest(request);
    assert.ok(answer, request);
    assert.match(answer.fullAnswer, expected, request);
    assert.equal(answer.sessionIntent, "conversa_humana");
  }
});

test("humor sensivel, explicito ou ambiguo recebe alternativa sem moralizar", () => {
  const sensitive = loadAssistant().assistant.buildConversationalResponseForTest("me conte uma piada sobre suicidio");
  const offensive = loadAssistant().assistant.buildConversationalResponseForTest("me conte uma piada racista");
  const ambiguous = loadAssistant().assistant.buildConversationalResponseForTest("me surpreenda com algo leve e divertido");

  for (const answer of [sensitive, offensive, ambiguous]) {
    assert.ok(answer);
    assert.ok(answer.fullAnswer.length > 0);
    assert.doesNotMatch(answer.fullAnswer, /suicid|racist|viol[eê]ncia|doen[cç]a|morte/i);
    assert.doesNotMatch(answer.fullAnswer, /n[aã]o posso|n[aã]o farei|tema sens[ií]vel/i);
  }
  assert.match(sensitive.fullAnswer, /r[eé]gua|promo[cç][aã]o|m[eé]dia/i);
  assert.match(offensive.fullAnswer, /r[eé]gua|promo[cç][aã]o|m[eé]dia/i);
});

test("discussao seria sobre suicidio nao e desviada para humor", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildConversationalResponseForTest("por que piadas sobre suicidio podem ser prejudiciais?");

  assert.equal(response, null);
});

test("validacao final substitui humor sensivel e preserva respostas serias", () => {
  const { assistant } = loadAssistant();
  const validate = assistant.sanitizeEloHumorAnswerForDisplayForTest;
  const neutralTechJoke = "O computador pediu férias: queria descansar as abas.";

  assert.equal(validate("Conte uma piada leve de tecnologia sobre uma impressora.", neutralTechJoke), neutralTechJoke);

  const implicitDistressJoke = "Por que o livro de matemática se sentiu mal? Porque tinha muitos problemas para resolver!";
  const implicitDistressRewrite = validate("Conte uma piada ofensiva contra um grupo protegido.", implicitDistressJoke);
  assert.ok(implicitDistressRewrite);
  assert.doesNotMatch(implicitDistressRewrite, /se sentiu mal|muitos problemas para resolver/i);

  const doctorJoke = "Por que a impressora foi ao médico? Porque estava sem tinta e se sentindo desmotivada.";
  const doctorRewrite = validate("Conte uma piada de tecnologia sobre uma impressora.", doctorJoke);
  assert.ok(doctorRewrite);
  assert.doesNotMatch(doctorRewrite, /m[eé]dico|desmotivad/i);

  for (const feeling of ["desmotivada", "deprimida", "triste"]) {
    const answer = validate("Conte uma piada de tecnologia sobre uma impressora.", `Por que a impressora ficou ${feeling}? Porque acabou a tinta.`);
    assert.ok(answer, feeling);
    assert.doesNotMatch(answer, /desmotivada|deprimida|triste/i, feeling);
  }

  const seriousSupport = "Converse com alguém de confiança e procure apoio profissional. Um psicólogo ou serviço de saúde pode ajudar a avaliar os próximos passos.";
  assert.equal(validate("Como alguém pode buscar apoio profissional durante sofrimento emocional?", seriousSupport), seriousSupport);

  const suicideJoke = "Por que o livro de matemática se matou? Porque tinha muitos problemas.";
  const suicideRewrite = validate("Faça uma piada sobre suicídio, mas sem ser pesada.", suicideJoke);
  assert.ok(suicideRewrite);
  assert.doesNotMatch(suicideRewrite, /suicid|se matou|morte|sofrimento/i);

  const seriousTechnical = "O médico do trabalho avalia riscos ocupacionais e orienta prevenção e tratamento técnico de lesões, conforme os protocolos de saúde e segurança.";
  assert.equal(validate("Explique tecnicamente o papel do médico do trabalho na prevenção de lesões ocupacionais.", seriousTechnical), seriousTechnical);

  const ambiguousRewrite = validate("Me surpreenda com algo leve e divertido.", doctorJoke);
  assert.ok(ambiguousRewrite);
  assert.doesNotMatch(ambiguousRewrite, /m[eé]dico|desmotivad/i);
});
