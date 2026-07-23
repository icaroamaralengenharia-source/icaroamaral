import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  createApp,
  createEloVectorMemoryStore_
} from "../src/app.js";

const FORBIDDEN_RESPONSES = [
  /Para registrar materiais, pense em produ[cç][aã]o e consumo/i,
  /Sua biblioteca local ainda n[aã]o tem itens/i,
  /Deseja guardar isso para eu lembrar depois\??/i,
  /Deseja guardar isso na Biblioteca do Elo\??/i,
  /^Guardar$/im,
  /^N[aã]o guardar$/im,
  /Guardar na Biblioteca/im
];

const STRESS_SCENARIOS = [
  {
    group: "conversa geral",
    message: "Ol\u00e1",
    eloContext: "geral",
    expect: /ol[a\u00e1]|elo|ajudar|conversar/i
  },
  {
    group: "conversa geral",
    message: "Quem \u00e9 voc\u00ea?",
    eloContext: "geral",
    expect: /Elo|assistente|sistema digital/i
  },
  {
    group: "conversa geral",
    message: "Me explique o que \u00e9 concreto armado",
    eloContext: "obras",
    expect: /concreto armado|a[c\u00e7]o|armadura|compress[a\u00e3]o|tra[c\u00e7][a\u00e3]o/i
  },
  {
    group: "memoria",
    message: "lembre que prefiro respostas curtas",
    eloContext: "geral",
    expect: /respostas curtas|prefer[e\u00ea]ncia|registrada/i,
    savePrompt: "memory"
  },
  {
    group: "memoria",
    message: "qual minha prefer\u00eancia?",
    eloContext: "geral",
    expect: /respostas curtas|curtas/i
  },
  {
    group: "biblioteca",
    message: "guarde na biblioteca um resumo do projeto Stock Full",
    eloContext: "geral",
    expect: /Stock Full|resumo|estoque|lojistas/i,
    savePrompt: "library"
  },
  {
    group: "biblioteca",
    message: "o que existe na biblioteca?",
    eloContext: "geral",
    expect: /biblioteca|Stock Full|resumo/i
  },
  {
    group: "obras",
    message: "calcule parede 20x3 com bloco cer\u00e2mico",
    eloContext: "obras",
    expect: /dimensão real do bloco|bloco cerâmico/i,
    savePrompt: "none",
    mode: "technical_validation"
  },
  {
    group: "obras",
    message: "quanto concreto para uma laje 8x10 com 10 cm",
    eloContext: "obras",
    expect: /FCK do concreto|concreto/i,
    mode: "technical_validation"
  },
  {
    group: "obras",
    message: "quantos metros de cabo para 12 pontos",
    eloContext: "obras",
    expect: /cabo|12 pontos|metros|estimativa/i
  },
  {
    group: "stock full",
    message: "como registrar uma entrada de estoque",
    eloContext: "obras",
    expect: /entrada|estoque|produto|quantidade/i
  },
  {
    group: "stock full",
    message: "como registrar uma sa\u00edda",
    eloContext: "obras",
    expect: /sa[i\u00ed]da|estoque|quantidade|saldo/i
  },
  {
    group: "stock full",
    message: "como descobrir produtos parados",
    eloContext: "obras",
    expect: /produtos parados|auditoria|sem movimento|estoque/i
  },
  {
    group: "pdf e relatorios",
    message: "quero gerar PDF",
    eloContext: "obras",
    expect: /PDF|relat[o\u00f3]rio|revis/i
  },
  {
    group: "pdf e relatorios",
    message: "como exportar um relat\u00f3rio",
    eloContext: "obras",
    expect: /exportar|relat[o\u00f3]rio|PDF/i
  },
  {
    group: "saude",
    message: "como controlar validade de medicamentos",
    eloContext: "saude",
    expect: /validade|medicamentos|lote|alerta/i
  },
  {
    group: "saude",
    message: "como registrar lote",
    eloContext: "saude",
    expect: /lote|validade|rastreabilidade|medicamento/i
  }
];

const CONSISTENCY_MESSAGES = [
  "oi",
  "calcule parede 20x3",
  "quero gerar PDF",
  "guarde isso na biblioteca",
  "resuma nossa conversa"
];

test("stress test do Elo encaminha conversas reais ao cerebro oficial", async () => {
  const originalFetch = globalThis.fetch;
  const openAiCalls = [];
  const forbiddenHits = [];
  globalThis.fetch = buildMockedOpenAiFetch_(originalFetch, openAiCalls);

  try {
    await withTemporaryEloServer_(async (baseUrl) => {
      const client = createEloConversationClient_(baseUrl);

      for (const scenario of STRESS_SCENARIOS) {
        const data = await client.ask(scenario.message, scenario.eloContext);
        assertValidEloResponse_(data, scenario);
        collectForbiddenHits_(data.answer, scenario.group + ": " + scenario.message, forbiddenHits);
        assert.match(data.answer, scenario.expect, scenario.message);
        if (scenario.savePrompt) {
          assert.equal(data.savePrompt.type, scenario.savePrompt, scenario.message);
          assert.equal(data.savePrompt.show, scenario.savePrompt !== "none", scenario.message);
        }
      }

      assert.equal(openAiCalls.length, STRESS_SCENARIOS.filter((scenario) => scenario.mode !== "technical_validation").length);
      assert.equal(forbiddenHits.length, 0, formatForbiddenHits_(forbiddenHits));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("stress test do Elo mantem consistencia em sequencia de conversa", async () => {
  const originalFetch = globalThis.fetch;
  const openAiCalls = [];
  const forbiddenHits = [];
  globalThis.fetch = buildMockedOpenAiFetch_(originalFetch, openAiCalls);

  try {
    await withTemporaryEloServer_(async (baseUrl) => {
      const client = createEloConversationClient_(baseUrl);
      const answers = [];

      for (const message of CONSISTENCY_MESSAGES) {
        const data = await client.ask(message, "obras");
        assertValidEloResponse_(data, {
          group: "consistencia",
          message,
          mode: message === "calcule parede 20x3" ? "technical_validation" : "remote"
        });
        collectForbiddenHits_(data.answer, "consistencia: " + message, forbiddenHits);
        answers.push(data.answer);
      }

      assert.equal(openAiCalls.length, CONSISTENCY_MESSAGES.length - 1);
      assert.match(answers[1], /dimensão real do bloco|bloco cerâmico/i);
      assert.match(answers[2], /PDF|relat[o\u00f3]rio/i);
      assert.match(answers[3], /biblioteca|conte[u\u00fa]do|guardar/i);
      assert.match(answers[4], /conversa|parede|PDF|biblioteca/i);
      assert.equal(forbiddenHits.length, 0, formatForbiddenHits_(forbiddenHits));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Elo cobre conversa natural, ironia, tecnico curto e follow-up com contexto", async () => {
  const originalFetch = globalThis.fetch;
  const openAiCalls = [];
  const forbiddenHits = [];
  globalThis.fetch = buildMockedOpenAiFetch_(originalFetch, openAiCalls);

  try {
    await withTemporaryEloServer_(async (baseUrl) => {
      const client = createEloConversationClient_(baseUrl);
      const scenarios = [
        { message: "oi", expectMode: "remote", expectOpenAi: true },
        { message: "hi", expectMode: "remote", expectOpenAi: true },
        { message: "tudo bem?", expectMode: "remote", expectOpenAi: true },
        { message: "ah claro, ficou perfeito, so que nao", expectMode: "remote", expectOpenAi: true },
        { message: "calcule parede 20x3", expectMode: "technical_validation", expectOpenAi: false },
        { message: "resuma nossa conversa", expectMode: "remote", expectOpenAi: true }
      ];

      for (const scenario of scenarios) {
        const beforeCalls = openAiCalls.length;
        const data = await client.ask(scenario.message, "obras");
        assertValidEloResponse_(data, {
          group: "roteamento natural",
          message: scenario.message,
          mode: scenario.expectMode
        });
        collectForbiddenHits_(data.answer, "roteamento natural: " + scenario.message, forbiddenHits);
        assert.equal(openAiCalls.length, beforeCalls + (scenario.expectOpenAi ? 1 : 0), scenario.message);
      }

      const followUpCall = openAiCalls[openAiCalls.length - 1];
      assert.match(followUpCall.promptText, /calcule parede 20x3/i);
      assert.match(followUpCall.promptText, /tudo bem\?/i);
      assert.equal(forbiddenHits.length, 0, formatForbiddenHits_(forbiddenHits));
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontend roteia conversa humana e busca atual sem molde conceitual", () => {
  const source = readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8");
  const pureRouteIndex = source.indexOf("handleEloCorePureConversationalAnswer_(cleanQuestion)");
  const onlineRouteIndex = source.lastIndexOf("requestEloOnlineAnswer(cleanQuestion, attachedFiles)");
  const searchRouteIndex = source.indexOf("requestEloWebSearchAnswer_(cleanQuestion).then");
  const searchButtonIndex = source.indexOf('label: "Pesquise"');
  const technicalBlocker = source.match(/function hasEloCoreTechnicalConversationBlocker_[\s\S]*?\n  \}/)?.[0] || "";
  const casualDetector = source.match(/function detectEloCoreCasualConversationIntent_[\s\S]*?\n  \}/)?.[0] || "";
  const casualAnswer = source.match(/function buildEloCoreCasualConversationAnswer_[\s\S]*?\n  function buildEloCorePureConversationalAnswer_/)?.[0] || "";

  assert.ok(pureRouteIndex >= 0 && onlineRouteIndex >= 0 && pureRouteIndex < onlineRouteIndex);
  assert.ok(searchRouteIndex >= 0);
  assert.ok(searchButtonIndex >= 0 && searchRouteIndex > searchButtonIndex);
  const greetingDetector = source.match(/function detectSocialGreeting[\s\S]*?return null;\n  \}/)?.[0] || "";
  assert.match(source, /function normalizeEloSocialGreetingText_/);
  assert.match(source, /function getEloSocialGreetingDistance_/);
  assert.match(greetingDetector, /oi/);
  assert.match(greetingDetector, /ola/);
  assert.match(greetingDetector, /eae/);
  assert.match(greetingDetector, /bd/);
  assert.match(greetingDetector, /tdb/);
  assert.match(greetingDetector, /hello/);
  assert.match(greetingDetector, /hey/);
  assert.match(greetingDetector, /good morning/);
  assert.match(greetingDetector, /text\.length > 18/);
  assert.match(greetingDetector, /split\(\/\\s\+\/\)\.length > 3/);
  assert.match(greetingDetector, /hasEloCoreTechnicalConversationBlocker_/);
  assert.match(greetingDetector, /estoque\|concreto\|parede/);
  assert.match(casualDetector, /tempo\|clima\|dia/);
  assert.match(casualDetector, /so que nao/);
  assert.match(casualDetector, /kkk\+/);
  assert.match(casualAnswer, /Clima bom pra trabalhar sem sofrer tanto/);
  assert.match(casualAnswer, /Entendi a ironia/);
  assert.match(casualAnswer, /getSocialGreetingResponse\(question\)/);
  assert.match(casualAnswer, /getConversationalResponse/);
  assert.doesNotMatch(casualAnswer, /estou pronto|Perspectivas|Reflex[aã]o|Pr[oó]xima a[cç][aã]o/i);
  assert.match(technicalBlocker, /parede\|bloco\|reboco\|concreto/);
  assert.match(source, /appendMessage\("system", "Nao consegui consultar informacoes em tempo real agora\."\)/);
  assert.doesNotMatch(source.slice(searchRouteIndex, searchRouteIndex + 700), /label: "Pesquise"|action: liveSearchResponse\.action/);
});

test("frontend preserva scroll do chat historico e memoria", () => {
  const source = readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8");
  const css = readFileSync("elo.css", "utf8");
  const historyBlock = source.match(/function showEloCoreHistory_[\s\S]*?\.catch/)?.[0] || "";
  const memoryBlock = source.match(/function showEloCoreMemoryPanel_[\s\S]*?function buildEloCoreMemoryRecallResponse_/)?.[0] || "";
  const appendMessageBlock = source.match(/function appendMessage[\s\S]*?return message;\n  \}/)?.[0] || "";

  assert.match(historyBlock, /ELO_UI\.messages\.scrollTop = 0/);
  assert.match(memoryBlock, /ELO_UI\.messages\.scrollTop = 0/);
  assert.match(source, /scrollEloConversationToBottom_\(\{ force: shouldStick \|\| kind === "assistant" \}\)/);
  assert.match(css, /scroll-padding-top: 16px/);
  assert.match(css, /scroll-padding-bottom: calc\(14px \+ var\(--elo-composer-height, 72px\)\)/);
  assert.match(css, /body\[data-elo-product="chat"\] \.elo-product-chat \.elo-messages/);
  assert.match(css, /scroll-margin-top: 14px/);
  assert.match(css, /padding-bottom: calc\(12px \+ var\(--elo-composer-height, 66px\)\)/);
});
test("frontend preserva continuidade do wall_budget simples", () => {
  const source = readFileSync("relatorio-qualidade-obras/elo-assistente.js", "utf8");
  const casualAnswer = source.match(/function buildEloCoreCasualConversationAnswer_[\s\S]*?\n  function buildEloCorePureConversationalAnswer_/)?.[0] || "";
  const wallTask = source.match(/function buildEloWallBudgetTaskAnswer_[\s\S]*?\n  function detectEloConversationTopic_/)?.[0] || "";
  const pendingAnswer = source.match(/function buildEloWallBudgetPendingActionAnswer_[\s\S]*?\n  function isEloWallBudgetFollowUp_/)?.[0] || "";
  const wallParser = source.match(/function parseEloWallServiceBriefing_[\s\S]*?\n  function hasEloQuantitativeIntent_/)?.[0] || "";
  const wallFacts = source.match(/function buildEloWallBudgetFacts_[\s\S]*?\n  function rememberEloActiveWallBudgetTask_/)?.[0] || "";

  assert.match(casualAnswer, /if \(social\) return Object\.assign\(\{\}, social, \{ fullAnswer: ""/);
  assert.match(casualAnswer, /if \(conversational\) return Object\.assign\(\{\}, conversational, \{ fullAnswer: ""/);
  assert.match(casualAnswer, /const shortAnswer = "Tá mesmo\. Clima bom pra trabalhar sem sofrer tanto, né\?"/);
  assert.doesNotMatch(casualAnswer, /shortAnswer: "Tá mesmo\.", fullAnswer/);

  assert.match(wallParser, /if \(!hasAnyTerm\(text, \["parede", "muro", "alvenaria"\]\)\)/);
  assert.doesNotMatch(wallParser, /bloco", "tijolo"[\s\S]*?return null/);
  assert.match(wallTask, /pendingActionResponse[\s\S]*?const activeTask/);
  assert.match(wallTask, /calcule\|calcular\|quantitativo/);
  assert.match(wallTask, /pendingAction = \{ type: "include_chapisco_reboco", scope: "current_wall_budget"/);
  assert.match(wallTask, /Quer incluir chapisco e reboco nos dois lados desse orçamento\?/);
  assert.match(pendingAnswer, /isEloWallBudgetPositiveReply_\(message\)/);
  assert.match(pendingAnswer, /task\.pendingAction = null/);
  assert.match(pendingAnswer, /Inclui chapisco e reboco no orçamento atual/);
  assert.match(pendingAnswer, /Mantive o orçamento sem alteração/);
  assert.doesNotMatch(wallTask + pendingAnswer, /wall_budget_package/);
  assert.match(wallFacts, /length: briefing\.length/);
  assert.match(wallFacts, /height: briefing\.height/);
  assert.match(wallFacts, /grossArea: estimate\.area \|\| briefing\.area/);
  assert.match(wallFacts, /blockType:/);
  assert.match(wallFacts, /faceA:/);
  assert.match(wallFacts, /faceB:/);

  assert.match(source, /sessionTheme: "wall_budget_package", sessionIntent: "budget_v2_wall_quantities"/);
  const wallBriefingBlock = source.match(/buildWallBriefingResponse_\(state\) \{[\s\S]*?sessionIntent: "budget_v2_wall_briefing"/)?.[0] || "";
  assert.match(wallBriefingBlock, /sessionTheme: "wall_budget_package"/);
  assert.match(wallBriefingBlock, /sessionIntent: "budget_v2_wall_briefing"/);
  assert.match(source, /sessionTheme: "wall_budget_package", sessionIntent: "budget_v2_wall_complete_created"/);
});
test("stress test do Elo documenta cobertura de cenarios", () => {
  const coverage = {
    scenarios: STRESS_SCENARIOS.length + CONSISTENCY_MESSAGES.length,
    groups: new Set(STRESS_SCENARIOS.map((scenario) => scenario.group).concat(["respostas proibidas", "consistencia"])).size,
    forbiddenResponses: FORBIDDEN_RESPONSES.length
  };

  assert.equal(coverage.scenarios, 22);
  assert.equal(coverage.groups, 9);
  assert.ok(coverage.forbiddenResponses >= 7);
});

function buildMockedOpenAiFetch_(originalFetch, openAiCalls) {
  return async function mockedFetch(url, options) {
    const target = String(url);
    if (target.startsWith("https://api.openai.com/v1/embeddings")) {
      return new Response(JSON.stringify({
        data: [{ embedding: Array.from({ length: 1536 }, () => 0.001) }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    if (target.startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const promptText = JSON.stringify(payload.input);
      const message = extractLatestEloMessage_(payload.input);
      openAiCalls.push({ message, promptText });
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: buildMockedEloAnswer_(message, promptText) }] }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
}

function extractLatestEloMessage_(input) {
  const latest = Array.isArray(input) ? input[input.length - 1] : null;
  const content = String(latest && latest.content ? latest.content : "");
  const match = content.match(/Mensagem original do usu[áa]rio:\s*([\s\S]*?)\n\s*Mensagem interpretada:/i);
  return match && match[1] ? match[1].trim() : content.trim();
}

function buildMockedEloAnswer_(message, promptText) {
  const text = normalizeText_(message);
  const prompt = normalizeText_(promptText);

  if (text === "ola" || text === "oi") {
    return "Ola. Eu sou o Elo e estou pronto para conversar com clareza e contexto.";
  }
  if (text.includes("quem e voce")) {
    return "Eu sou o Elo, um assistente digital para organizar ideias, memoria recente, biblioteca e projetos.";
  }
  if (text.includes("concreto armado")) {
    return "Concreto armado combina concreto e aco: o concreto resiste bem a compressao e a armadura ajuda na tracao.";
  }
  if (text.includes("lembre que prefiro respostas curtas")) {
    return "Preferencia registrada no contexto: responder de forma curta e direta.";
  }
  if (text.includes("qual minha preferencia")) {
    return prompt.includes("prefiro respostas curtas")
      ? "Sua preferencia registrada nesta conversa e receber respostas curtas."
      : "Nao encontrei preferencia salva no contexto enviado.";
  }
  if (text.includes("guarde na biblioteca") && text.includes("stock full")) {
    return "Resumo do projeto Stock Full: sistema para lojistas controlarem estoque, entradas, saidas, saldo e auditoria.";
  }
  if (text.includes("o que existe na biblioteca")) {
    return "Na biblioteca desta conversa existe um resumo do projeto Stock Full para consulta futura.";
  }
  if (text.includes("parede 20x3")) {
    return "Parede de alvenaria: 20 m x 3 m = 60 m2. Para bloco ceramico, estime o consumo conforme o bloco e aplique perda.";
  }
  if (text.includes("laje 8x10") && text.includes("10 cm")) {
    return "Concreto para laje: 8 m x 10 m x 0,10 m = 8 m3 antes de perdas. Revise cobrimento, espessura e projeto.";
  }
  if (text.includes("12 pontos") && text.includes("cabo")) {
    return "Para 12 pontos, estime os metros de cabo pelo percurso real dos eletrodutos, com folga tecnica por ponto e quadro.";
  }
  if (text.includes("entrada de estoque")) {
    return "Para registrar uma entrada de estoque, selecione o produto, informe quantidade, unidade, origem e salve o movimento.";
  }
  if (text.includes("registrar uma saida")) {
    return "Para registrar uma saida, escolha o produto, informe quantidade, destino ou responsavel e confira o saldo antes de salvar.";
  }
  if (text.includes("produtos parados")) {
    return "Produtos parados aparecem em auditoria por itens sem movimento, baixo giro, saldo alto e ultima saida antiga.";
  }
  if (text.includes("gerar pdf")) {
    return "Para gerar PDF no ObraReport, revise o relatorio, fotos, conclusao tecnica e acione a exportacao em PDF.";
  }
  if (text.includes("exportar um relatorio")) {
    return "Para exportar um relatorio, confira os dados obrigatorios e gere o PDF para entregar ou arquivar.";
  }
  if (text.includes("validade de medicamentos")) {
    return "Controle validade de medicamentos por lote, data de vencimento, alerta de proximidade e retirada pelo FEFO.";
  }
  if (text.includes("registrar lote")) {
    return "Registre lote com codigo, validade, fornecedor, quantidade, unidade e rastreabilidade do medicamento.";
  }
  if (text.includes("guarde isso na biblioteca")) {
    return "Posso guardar o conteudo na biblioteca quando voce informar o texto ou confirmar o resumo que deseja preservar.";
  }
  if (text.includes("resuma nossa conversa")) {
    return "Resumo da conversa: saudacao inicial, calculo de parede de 60 m2, orientacao sobre PDF e pedido de biblioteca.";
  }

  return "Resposta valida do Elo pelo cerebro oficial.";
}

function createEloConversationClient_(baseUrl) {
  const history = [];
  return {
    async ask(message, eloContext) {
      const response = await fetch(baseUrl + "/api/elo/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:5500"
        },
        body: JSON.stringify({
          message,
          history,
          eloContext,
          context: {
            source: "elo_stress_test",
            mode: "standalone",
            eloContext,
            deviceId: "elo_dev_stress_test"
          }
        })
      });
      const data = await response.json();
      assert.equal(response.status, 200, message);
      history.push({ role: "user", content: message });
      history.push({ role: "assistant", content: data.answer });
      return data;
    }
  };
}

async function withTemporaryEloServer_(callback) {
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      OPENAI_API_KEY: "test-key"
    },
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  });
  const instance = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  try {
    await callback("http://127.0.0.1:" + instance.address().port);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

function assertValidEloResponse_(data, scenario) {
  assert.equal(data.ok, true, scenario.message);
  assert.equal(data.mode, scenario.mode || "remote", scenario.message);
  assert.equal(data.fallback, false, scenario.message);
  assert.equal(typeof data.answer, "string", scenario.message);
  assert.ok(data.answer.trim().length > 0, scenario.message);
  assert.doesNotMatch(data.answer, /(?:Error|TypeError|ReferenceError|stack trace|at\s+\w+\s+\()/i, scenario.message);
}

function collectForbiddenHits_(answer, label, target) {
  FORBIDDEN_RESPONSES.forEach((pattern) => {
    if (pattern.test(answer)) {
      target.push({ label, pattern: String(pattern), answer });
    }
  });
}

function formatForbiddenHits_(hits) {
  return hits.map((hit) => hit.label + " -> " + hit.pattern).join("\n");
}

function normalizeText_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
