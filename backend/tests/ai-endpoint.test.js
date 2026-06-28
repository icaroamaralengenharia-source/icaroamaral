import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { createContext, runInContext } from "node:vm";
import {
  buildEloLocalFallbackResponse_,
  buildConversationSummary_,
  buildEloSystemPrompt_,
  buildEloMasterContext_,
  buildCadistaProjectState_,
  buildProjectKnowledgeContext_,
  buildPathologyContext,
  buildVisionUserPrompt_,
  createApp,
  createEloVectorMemoryStore_,
  detectEloIntent_,
  buildPrevisaoConsumoContext,
  buildAuditoriaConsumoContext,
  buildSafeConstructionQuantityResponse_,
  buildStockIaLaunchPlan,
  detectConstructionQuantityIntent_,
  extractQuantidadeServico,
  extractContextKeywords_,
  extractPrevistoRealConsumo,
  findObraComposicaoContext,
  formatEloFinalResponse_,
  formatImageAnalysis_,
  getEloRelevantContext_,
  interpretEloUserMessage,
  normalizeEloText,
  normalizeImageAnalysis_,
  PROJECT_KNOWLEDGE,
  reindexEloVectorMemoryFile_,
  routeEloRequest_,
  searchEloRelevantMemories_,
  searchPathologyKnowledge,
  shouldShowEloSavePrompt_
} from "../src/app.js";

let server;
let baseUrl;
let eloVectorMemoryStore;

test("elo master prompt aplica resposta direta em todos os contextos", () => {
  const prompt = buildEloMasterContext_({ eloContext: "obras" });

  assert.match(prompt, /forma direta/i);
  assert.match(prompt, /Não repita a pergunta/i);
  assert.match(prompt, /cálculos simples/i);
  assert.match(prompt, /Não comece com 'Você quer/i);
});

test("elo final response monta resultado explicacao proximo passo e aviso", () => {
  const answer = formatEloFinalResponse_({
    result: "Resultado: 750 blocos cerâmicos",
    explanation: "Área considerada: 20 m x 3 m = 60 m².",
    nextStep: "Informe portas e janelas para descontar da conta.",
    warnings: "Valide perdas conforme execução."
  });

  assert.match(answer, /Resultado: 750 blocos/);
  assert.match(answer, /Área considerada/);
  assert.match(answer, /Informe portas/);
  assert.match(answer, /Aviso técnico/);
});

test("elo save prompt nao aparece para calculo simples isolado", () => {
  const answer = formatEloFinalResponse_({
    result: "Resultado: 750 blocos cerâmicos.\n\nDeseja guardar isso para eu lembrar depois?\nGuardar\nNão guardar",
    explanation: "Área considerada: 20 m x 3 m = 60 m²."
  });
  const decision = shouldShowEloSavePrompt_({
    userMessage: "calcule parede 20x3 com bloco cerâmico",
    assistantResponse: answer,
    context: { eloContext: "obras" }
  });

  assert.match(answer, /Resultado: 750 blocos/);
  assert.doesNotMatch(answer, /Deseja guardar/i);
  assert.doesNotMatch(answer, /Biblioteca do Elo/i);
  assert.doesNotMatch(answer, /^Guardar$/im);
  assert.doesNotMatch(answer, /^Não guardar$/im);
  assert.equal(decision.show, false);
  assert.equal(decision.reason, "simple_calculation");
});

test("roteador operacional do Elo monta estado CADISTA por mensagem e historico", () => {
  const history = [
    { role: "user", content: "criar casa 8x10 com 2 quartos" },
    { role: "user", content: "o terreno e 10x25" }
  ];
  const route = routeEloRequest_({
    message: "quero uma suite e garagem",
    history,
    context: { eloContext: "cadista" }
  });

  assert.equal(route.domain, "cadista");
  assert.equal(route.intent, "continue_project");
  assert.equal(route.safetyLevel, "safe");
  assert.deepEqual(route.projectState.house, { width: 8, depth: 10 });
  assert.deepEqual(route.projectState.terrain, { width: 10, depth: 25 });
  assert.equal(route.projectState.bedrooms, 2);
  assert.equal(route.projectState.suites, true);
  assert.equal(route.projectState.garage, true);
});

test("estado CADISTA marca prancha PDF e DXF como execucao dependente de motor real", () => {
  const state = buildCadistaProjectState_({
    history: [
      { role: "user", content: "criar casa 8x10 com 2 quartos" },
      { role: "user", content: "o terreno e 10x25" }
    ],
    message: "gerar prancha preliminar em PDF e DXF"
  });

  assert.equal(state.sheet, "real_output_required");
  assert.equal(state.executionStatus, "awaiting_engine");
  assert.ok(state.missingData.includes("motor CADISTA ativo com output real"));
});

test("roteador CADISTA bloqueia promessa de execucao real e valida recuos com base", () => {
  const generateRoute = routeEloRequest_({
    message: "gerar prancha preliminar",
    history: [{ role: "user", content: "terreno 10x25 e casa 8x10 com 2 quartos" }],
    context: { eloContext: "cadista" }
  });
  const setbackRoute = routeEloRequest_({
    message: "validar recuos",
    history: [{ role: "user", content: "terreno 10x25 e casa 8x10 com 2 quartos" }],
    context: { eloContext: "cadista" }
  });

  assert.equal(generateRoute.intent, "generate");
  assert.equal(generateRoute.canExecute, false);
  assert.equal(generateRoute.safetyLevel, "unsupported_execution");
  assert.equal(setbackRoute.intent, "validate");
  assert.equal(setbackRoute.safetyLevel, "needs_basis");
  assert.ok(setbackRoute.missingData.includes("recuos/norma local"));
});

test("roteador preserva pergunta geral fora do CADISTA", () => {
  const route = routeEloRequest_({
    message: "qual e o proximo passo do Elo?",
    context: { eloContext: "geral" }
  });

  assert.equal(route.domain, "geral");
  assert.equal(route.intent, "question");
  assert.equal(route.projectState, null);
});

test("prompt mestre do Elo inclui resumo operacional CADISTA", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "cadista",
    operationalSummary: "Dominio: cadista\nIntencao: generate\nPode executar agora: nao\nRegra: nunca afirmar execução real sem output confirmado."
  });

  assert.match(prompt, /Resumo operacional deterministico/i);
  assert.match(prompt, /Dominio: cadista/i);
  assert.match(prompt, /nunca afirmar execu/i);
});

test("elo save prompt direciona memoria e biblioteca conforme valor futuro", () => {
  const memoryDecision = shouldShowEloSavePrompt_({
    userMessage: "lembre que a estratégia do Cadista AI é começar com gerador procedural antes de IA avançada",
    assistantResponse: "Registrado como dado da obra.",
    context: { eloContext: "obras" }
  });
  const libraryDecision = shouldShowEloSavePrompt_({
    userMessage: "monte um resumo estratégico do projeto Stock Full para eu guardar na biblioteca",
    assistantResponse: "Resumo estratégico do projeto Stock Full...",
    context: { eloContext: "obras" }
  });

  assert.equal(memoryDecision.show, true);
  assert.equal(memoryDecision.suggestedTarget, "memory");
  assert.equal(libraryDecision.show, true);
  assert.equal(libraryDecision.suggestedTarget, "library");
});

test("frontend do Elo renderiza somente um bloco visual de salvamento", () => {
  const source = readFileSync(join("..", "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const saveTitleMatches = source.match(/Salvar esta conversa\?/g) || [];

  assert.equal(saveTitleMatches.length, 1);
  assert.match(source, /function sanitizeEloAnswerForDisplay/);
  assert.match(source, /function removePendingEloSavePrompts/);
  assert.match(source, /elo-save-prompt elo-save-card/);
  assert.doesNotMatch(source, /createElement\("button", "elo-inline-button", "Guardar na Biblioteca"\)/);
  assert.doesNotMatch(source, /createElement\("span", "elo-privacy", "Deseja guardar isso na Biblioteca\?"\)/);
});

test("frontend do Elo standalone mostra sugestoes dos projetos oficiais", () => {
  const source = readFileSync(join("..", "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const suggestionsFunctionStart = source.indexOf("function getContextSuggestions");
  const standaloneStart = source.indexOf("if (isStandaloneMode())", suggestionsFunctionStart);
  const standaloneEnd = source.indexOf("const route = String(window.location.hash", standaloneStart);
  const standaloneBlock = source.slice(standaloneStart, standaloneEnd);

  assert.ok(suggestionsFunctionStart > 0);
  assert.match(standaloneBlock, /label: "CADISTA"/);
  assert.match(standaloneBlock, /label: "Stock Full"/);
  assert.match(standaloneBlock, /label: "Elo"/);
  assert.match(standaloneBlock, /label: "Stock Saúde"/);
  assert.match(standaloneBlock, /label: "ObraReport"/);
  assert.doesNotMatch(standaloneBlock, /Quero criar um RDO/);
  assert.doesNotMatch(standaloneBlock, /Quero lançar material/);
});

test("frontend do Elo sugere os cinco projetos oficiais", () => {
  const source = readFileSync(join("..", "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const suggestionsStart = source.indexOf("const ELO_PROJECT_SUGGESTIONS");
  const suggestionsEnd = source.indexOf("function createProjectId", suggestionsStart);
  const suggestionsBlock = source.slice(suggestionsStart, suggestionsEnd);

  ["CADISTA", "Stock Full", "Elo", "Stock Saúde", "ObraReport"].forEach((name) => {
    assert.match(suggestionsBlock, new RegExp('name: "' + name + '"'));
  });
  assert.doesNotMatch(suggestionsBlock, /name: "Stock IA"/);
  assert.doesNotMatch(suggestionsBlock, /name: "CADISTA IA"/);
});

test("elo normaliza texto informal e erros comuns", () => {
  const normalized = normalizeEloText("TUDO O QUE EU ESCREVO, ATE XI IU ISCRIVER ACIM, VOCÊ ENTENDE kk");

  assert.match(normalized, /se eu escrever assim/i);
  assert.match(normalized, /VOCÊ ENTENDE kk/i);
});

test("elo interpreta intencoes reais dos exemplos manuais", () => {
  const examples = [
    ["faz o codigo completo cara", "codex_task_or_code", "direto_apressado", "prompt_pronto_para_copiar"],
    ["quero fazer uma parede de 20x3 quantos blocos eu preciso? será bloco cerâmico", "technical_calculation", "neutro", "resultado_primeiro_com_calculo_curto"],
    ["vamos retomar o elo", "continue_project", "neutro", "natural_objetivo"],
    ["analise essa resposta", "analysis_or_feedback", "neutro", "natural_objetivo"],
    ["isso ficou bom pra vender o stock full?", "marketing_strategy", "neutro", "opiniao_sincera_com_recomendacao"],
    ["faça pro codex", "codex_task_or_code", "neutro", "prompt_pronto_para_copiar"]
  ];

  examples.forEach(([message, intent, tone, style]) => {
    const interpretation = interpretEloUserMessage({ message, context: "geral" });
    assert.equal(interpretation.detectedIntent, intent);
    assert.equal(interpretation.emotionalTone, tone);
    assert.equal(interpretation.expectedAnswerStyle, style);
  });

  assert.equal(interpretEloUserMessage({ message: "vamos retomar o elo", context: "geral" }).projectContext, "elo_core");
  assert.equal(interpretEloUserMessage({ message: "isso ficou bom pra vender o stock full?", context: "geral" }).projectContext, "stock_full");

  const resumedStockFull = interpretEloUserMessage({
    message: "vamos continuar",
    context: "geral",
    history: [{ role: "user", content: "Estou montando o Stock Full para lojistas controlarem estoque." }]
  });
  const profiled = interpretEloUserMessage({
    message: "faz o codigo completo cara",
    userProfile: { name: "Ícaro Amaral", style: "direto, prático, informal" }
  });

  assert.equal(resumedStockFull.projectContext, "stock_full");
  assert.equal(resumedStockFull.shouldAskClarification, false);
  assert.deepEqual(profiled.userProfile, { name: "Ícaro Amaral", style: "direto, prático, informal" });
});

test("elo fallback local usa intencao detectada", () => {
  const codeInterpretation = interpretEloUserMessage({ message: "faz o codigo completo cara" });
  const marketingInterpretation = interpretEloUserMessage({ message: "isso ficou bom pra vender o stock full?" });

  assert.match(buildEloLocalFallbackResponse_(codeInterpretation), /tarefa pequena e executável/i);
  assert.match(buildEloLocalFallbackResponse_(marketingInterpretation), /venda/i);
});

test("elo fallback offline responde assunto direto em perguntas simples", () => {
  const cases = [
    ["oi", /Me diga o que voce quer retomar|continuo direto/i],
    ["receita de bolo de cenoura", /cenoura|ovos|farinha|fermento/i],
    ["receita de bolo de chocolate", /chocolate|ovos|farinha|fermento|180°C/i],
    ["receita de pizza na panela", /pizza na panela|frigideira|massa/i],
    ["como funciona uma laje maciça", /placa de concreto armado|cargas|armadura/i],
    ["como fazer uma parede de 4 metros?", /dimensão real do bloco cerâmico|dimensão do bloco/i],
    ["o que você acha desse banheiro?", /banheiro|box|vaso|ventilação/i],
    ["vale a pena continuar o CADISTA?", /Vale continuar|provar valor/i],
    ["estou desanimado com o projeto", /cansaço|vitória menor/i]
  ];

  cases.forEach(([message, expected]) => {
    const interpretation = interpretEloUserMessage({ message });
    const answer = buildEloLocalFallbackResponse_(interpretation);

    assert.match(answer, expected, message);
    assert.doesNotMatch(answer, /Em forma local|Vou analisar|Entendi\.|modo offline|nao tenho seguranca|não tenho segurança/i, message);
  });
});

test("elo diferencia explicacao tecnica de calculo no fallback offline", () => {
  const explanation = interpretEloUserMessage({ message: "como funciona uma laje maciça" });
  const calculation = interpretEloUserMessage({ message: "quanto concreto vai numa laje maciça 5x4" });

  assert.equal(explanation.detectedIntent, "explanation");
  assert.equal(calculation.detectedIntent, "technical_calculation");
  assert.match(buildEloLocalFallbackResponse_(explanation), /funciona como uma placa/i);
  assert.match(buildEloLocalFallbackResponse_(calculation), /FCK do concreto/i);
});

test("elo fallback seguro usa validador tecnico comum", () => {
  const concrete = buildSafeConstructionQuantityResponse_("calcule concreto para laje 20 m² com 8 cm");
  const wallMissingBlock = buildSafeConstructionQuantityResponse_("quantos blocos vão em 25m² de parede?");
  const wallMissingBase = buildSafeConstructionQuantityResponse_("Faça o orçamento de parede bloco 14x19x39, 20 m de comprimento, 2,80 m de altura, sem portas, sem janelas, perda 10%, revestimento dos dois lados, espessura 2 cm.");

  assert.match(concrete, /FCK do concreto/);
  assert.match(wallMissingBlock, /dimensão real do bloco cerâmico/);
  assert.match(wallMissingBase, /Para gerar quantitativo, mão de obra ou valor com segurança/);
  assert.match(wallMissingBase, /Base técnica utilizada: composição técnica não localizada/);
  assert.match(wallMissingBase, /Premissas utilizadas:/);
  assert.doesNotMatch(wallMissingBase, /60\s*blocos?\s*\/?\s*m[²2]/i);
});

test("elo pede parametros especificos antes de qualquer consumo no fallback seguro", () => {
  const blocos = buildEloLocalFallbackResponse_(interpretEloUserMessage({
    message: "quantos blocos vão em 25m² de parede?"
  }));
  const reboco = buildEloLocalFallbackResponse_(interpretEloUserMessage({
    message: "calcule materiais para reboco"
  }));

  assert.match(blocos, /dimensão real do bloco cerâmico|dimensão do bloco/i);
  assert.doesNotMatch(blocos, /60\s*blocos?\s*\/?\s*m[²2]/i);
  assert.match(reboco, /um lado ou nos dois lados|espessura|composição/i);
});

test("elo 2.0 classifica intencao contextual por categoria", () => {
  const calc = detectEloIntent_("calcule parede 20x3", { eloContext: "obras" });
  const pdf = detectEloIntent_("quero gerar PDF", { eloContext: "obras" });
  const memory = detectEloIntent_("lembre que gosto de respostas curtas", { eloContext: "geral" });
  const health = detectEloIntent_("como controlar validade de medicamentos", { eloContext: "saude" });

  assert.equal(calc.primary, "cálculo");
  assert.ok(calc.categories.includes("obras"));
  assert.equal(calc.productContext, "obras");
  assert.equal(pdf.primary, "pdf");
  assert.ok(pdf.categories.includes("relatório"));
  assert.equal(memory.primary, "memória");
  assert.equal(memory.needsMemory, true);
  assert.equal(health.productContext, "saúde");
  assert.ok(health.categories.includes("saúde"));
});

test("elo 2.0 resume historico longo e preserva preferencias", () => {
  const history = [
    { role: "user", content: "Estou retomando o projeto Elo e a arquitetura do cérebro oficial." },
    { role: "assistant", content: "Vamos organizar a unificação." },
    { role: "user", content: "Lembre que prefiro respostas curtas e diretas." },
    { role: "assistant", content: "Preferência anotada." },
    { role: "user", content: "Também estou validando memória e biblioteca." },
    { role: "assistant", content: "Certo." },
    { role: "user", content: "Agora quero testar obras e PDF." },
    { role: "assistant", content: "Vamos testar." },
    { role: "user", content: "calcule parede 20x3" }
  ];
  const summary = buildConversationSummary_(history);

  assert.match(summary, /projeto Elo/i);
  assert.match(summary, /respostas curtas/i);
  assert.match(summary, /memoria|memória/i);
  assert.match(summary, /obras/i);
});

test("elo 2.0 recupera somente contexto relevante de memoria e biblioteca", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_contextual",
    id: "cadista",
    text: "CADISTA IA deve começar com gerador procedural antes de IA avançada.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_contextual",
    id: "saude",
    text: "Stock Saude controla validade de medicamentos por lote.",
    category: "saude",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const relevant = await getEloRelevantContext_({
    memoryStore: store,
    payload: {
      message: "qual o plano do CADISTA IA?",
      history: [],
      context: {
        eloContext: "geral",
        deviceId: "elo_dev_contextual",
        memoriesSummary: "- Prefiro respostas curtas.\n- Stock Saude usa lote e validade.\n- CADISTA IA prioriza geometria procedural.",
        librarySummary: "- Stock Full: estoque para lojistas.\n- CADISTA IA: motor geometrico, PDF e DXF.\n- Jogo: roteiro narrativo."
      },
      eloIntent: detectEloIntent_("qual o plano do CADISTA IA?", { eloContext: "geral" })
    }
  });

  assert.match(relevant.context.relevantMemoriesSummary, /CADISTA IA/i);
  assert.doesNotMatch(relevant.context.relevantMemoriesSummary, /Stock Saude controla validade/i);
  assert.match(relevant.context.libraryRelevantSummary, /CADISTA IA/i);
  assert.doesNotMatch(relevant.context.libraryRelevantSummary, /Jogo/i);
});

test("elo 2.0 extrai palavras-chave de contexto por projeto", () => {
  assert.deepEqual(extractContextKeywords_("resuma nosso plano do CADISTA"), ["cadista"]);
  assert.deepEqual(extractContextKeywords_("quais projetos do stock full"), ["projetos", "stock", "stock full"]);
  assert.deepEqual(extractContextKeywords_("como evoluir o elo"), ["elo"]);
});

test("elo project knowledge v1 monta contexto permanente por projeto", () => {
  const cadista = buildProjectKnowledgeContext_("resuma nosso plano do CADISTA");
  const inventory = buildProjectKnowledgeContext_("quais projetos eu tenho");

  assert.equal(PROJECT_KNOWLEDGE.cadista.name, "CADISTA");
  assert.match(cadista, /Conhecimento permanente dos projetos/i);
  assert.match(cadista, /CADISTA/i);
  assert.match(cadista, /terreno -> recuos -> ocupacao -> orientacao solar/i);
  assert.match(cadista, /biblioteca de ambientes/i);
  assert.doesNotMatch(cadista, /Stock Saúde/i);
  assert.match(inventory, /Stock Full/i);
  assert.match(inventory, /ObraReport/i);
});

test("prompt mestre do Elo prioriza conhecimento de projeto", () => {
  const prompt = buildEloSystemPrompt_({
    projectKnowledgeQuery: "resuma nosso plano do CADISTA"
  });

  assert.match(prompt, /Conhecimento permanente dos projetos do usuario/i);
  assert.match(prompt, /Prioridade: quando a pergunta citar um projeto/i);
  assert.match(prompt, /Nao substitua este conhecimento por respostas genericas/i);
  assert.match(prompt, /CADISTA/i);
  assert.match(prompt, /gerador procedural/i);
});

test("elo 2.0 prioriza contexto do CADISTA quando o projeto e citado", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_project_aliases",
    id: "cadista-plano",
    text: "CADISTA IA sera inicialmente procedural: terreno, recuos, orientacao solar, setorizacao, ambientes minimos, circulacao, validacao e planta automatica.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_project_aliases",
    id: "saude-validade",
    text: "Stock Saude controla validade de medicamentos por lote.",
    category: "saude",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const relevant = await getEloRelevantContext_({
    memoryStore: store,
    payload: {
      message: "resuma nosso plano do CADISTA",
      history: [{ role: "user", content: "Ontem falamos do CADISTA e do gerador procedural." }],
      context: {
        eloContext: "geral",
        deviceId: "elo_dev_project_aliases",
        memoriesSummary: "- Stock Saude usa lote e validade.\n- CADISTA IA prioriza biblioteca de ambientes e gerador de layout.",
        librarySummary: "- CADISTA: biblioteca de ambientes, programa de necessidades, terreno, recuos, setorizacao e validacao.\n- Stock Full: estoque para lojistas."
      },
      eloIntent: detectEloIntent_("resuma nosso plano do CADISTA", { eloContext: "geral" })
    }
  });

  assert.match(relevant.context.relevantMemoriesSummary, /CADISTA IA/i);
  assert.match(relevant.context.libraryRelevantSummary, /CADISTA/i);
  assert.doesNotMatch(relevant.context.relevantMemoriesSummary.split("\n")[0], /Stock Saude/i);
  assert.doesNotMatch(relevant.context.libraryRelevantSummary.split("\n")[0], /Stock Full/i);
});

test("elo 2.0 recupera multiplos projetos em pergunta ampla", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  const baseMemory = {
    ownerId: "elo_dev_project_inventory",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  };
  await store.upsert({ ...baseMemory, id: "cadista", text: "CADISTA IA: motor geometrico procedural para plantas, PDF e DXF." });
  await store.upsert({ ...baseMemory, id: "stockfull", text: "Stock Full: estoque para lojistas, entradas, saidas e saldo." });
  await store.upsert({ ...baseMemory, id: "elo", text: "Elo: cerebro oficial com memoria, biblioteca e personalidade unica." });

  const relevant = await getEloRelevantContext_({
    memoryStore: store,
    payload: {
      message: "quais projetos eu tenho",
      history: [],
      context: {
        eloContext: "geral",
        deviceId: "elo_dev_project_inventory",
        librarySummary: "- CADISTA: planta automatica.\n- Stock Full: almoxarifado para lojistas.\n- Elo: memoria e biblioteca."
      },
      eloIntent: detectEloIntent_("quais projetos eu tenho", { eloContext: "geral" })
    }
  });

  assert.match(relevant.context.relevantMemoriesSummary, /CADISTA IA/i);
  assert.match(relevant.context.relevantMemoriesSummary, /Stock Full/i);
  assert.match(relevant.context.relevantMemoriesSummary, /Elo/i);
  assert.match(relevant.context.libraryRelevantSummary, /CADISTA/i);
  assert.match(relevant.context.libraryRelevantSummary, /Stock Full/i);
});

test("elo 2.0 prioriza contexto do Elo sem misturar CADISTA", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_elo_context",
    id: "elo-core",
    text: "Elo 2.0 deve usar classificador, memoria relevante, biblioteca relevante e contexto mestre antes do LLM.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_elo_context",
    id: "cadista-core",
    text: "CADISTA IA deve gerar plantas tecnicas por geometria procedural.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const relevant = await getEloRelevantContext_({
    memoryStore: store,
    payload: {
      message: "como evoluir o elo",
      history: [],
      context: {
        eloContext: "geral",
        deviceId: "elo_dev_elo_context",
        librarySummary: "- Elo: unificacao do cerebro oficial, memoria, biblioteca e personalidade.\n- CADISTA: gerador procedural de plantas."
      },
      eloIntent: detectEloIntent_("como evoluir o elo", { eloContext: "geral" })
    }
  });

  assert.match(relevant.context.relevantMemoriesSummary, /Elo 2\.0/i);
  assert.match(relevant.context.libraryRelevantSummary, /Elo/i);
  assert.doesNotMatch(relevant.context.relevantMemoriesSummary.split("\n")[0], /CADISTA/i);
  assert.doesNotMatch(relevant.context.libraryRelevantSummary.split("\n")[0], /CADISTA/i);
});

test("elo 2.0 contexto de saude nao recupera CADISTA", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_health_context",
    id: "cadista-core",
    text: "CADISTA IA deve gerar plantas tecnicas por geometria procedural.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_health_context",
    id: "saude-validade",
    text: "Stock Saude controla validade de medicamentos por lote e rastreabilidade.",
    category: "saude",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const relevant = await getEloRelevantContext_({
    memoryStore: store,
    payload: {
      message: "como controlar validade de medicamentos",
      history: [],
      context: {
        eloContext: "saude",
        deviceId: "elo_dev_health_context",
        memoriesSummary: "- CADISTA IA usa gerador procedural.\n- Stock Saude usa lote, validade e rastreabilidade.",
        librarySummary: "- CADISTA: planta automatica.\n- Stock Saude: validade de medicamentos por lote."
      },
      eloIntent: detectEloIntent_("como controlar validade de medicamentos", { eloContext: "saude" })
    }
  });

  assert.match(relevant.context.relevantMemoriesSummary, /Stock Saude/i);
  assert.match(relevant.context.libraryRelevantSummary, /Stock Saude/i);
  assert.doesNotMatch(relevant.context.relevantMemoriesSummary, /CADISTA/i);
  assert.doesNotMatch(relevant.context.libraryRelevantSummary, /CADISTA/i);
});

test("stock demo health continua funcionando", async () => {
  const response = await fetch(baseUrl + "/api/stock-demo/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.service, "Stock AI Demo Backend");
});

test("stock saude health responde com fallback local sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.module, "stock-saude");
  assert.equal(data.database, "not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock saude me retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/me");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full health responde com fallback local sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-full/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.module, "stock-full");
  assert.equal(data.database, "not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full me retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-full/me");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_full_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock full me exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full me reconhece profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_();
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.module, "stock-full");
    assert.equal(data.mode, "remote");
    assert.equal(data.profile.institution_id, "inst_auth");
    assert.equal(data.profile.unit_id, "unit_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full me retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/me", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full items exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/items");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full items retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/items", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full items lista somente itens da instituicao autenticada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_1",
          institution_id: "inst_auth",
          name: "Caderno universitario",
          unit: "un",
          category: "Papelaria",
          min_quantity: 5,
          current_quantity: 12,
          is_active: true
        },
        {
          id: "sf_item_outro",
          institution_id: "outra_inst",
          name: "Item de outro cliente",
          unit: "un",
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/items", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, "remote");
    assert.equal(data.items.length, 1);
    assert.equal(data.items[0].id, "sf_item_1");
    assert.equal(data.items[0].minQuantity, 5);
    assert.equal(data.items[0].currentQuantity, 12);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full cria atualiza e desativa item remoto", async () => {
  const supabase = createMockStockSaudeSupabase_();
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const createResponse = await fetch(testServer.baseUrl + "/api/stock-full/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Parafuso 8mm",
        unit: "cx",
        category: "Ferragens",
        minQuantity: 4,
        currentQuantity: 10,
        location: "Prateleira A",
        notes: "Produto comercial"
      })
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(created.ok, true);
    assert.equal(created.mode, "remote");
    assert.equal(created.item.name, "Parafuso 8mm");
    assert.equal(created.item.minQuantity, 4);

    const updateResponse = await fetch(testServer.baseUrl + "/api/stock-full/items/" + created.item.id, {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Parafuso 10mm",
        unit: "cx",
        category: "Ferragens",
        minQuantity: 6,
        currentQuantity: 8,
        location: "Prateleira B"
      })
    });
    const updated = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updated.ok, true);
    assert.equal(updated.item.name, "Parafuso 10mm");
    assert.equal(updated.item.currentQuantity, 8);

    const deleteResponse = await fetch(testServer.baseUrl + "/api/stock-full/items/" + created.item.id, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-token" }
    });
    const deleted = await deleteResponse.json();

    assert.equal(deleteResponse.status, 200);
    assert.equal(deleted.ok, true);
    assert.equal(deleted.item.isActive, false);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full nao atualiza item de outra instituicao", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_outro",
          institution_id: "outra_inst",
          name: "Item protegido",
          unit: "un",
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/items/sf_item_outro", {
      method: "PUT",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Tentativa indevida",
        unit: "un"
      })
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_item_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full entries exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "sf_item_1", quantity: 2 })
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full entries retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_1", quantity: 2 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full cria entrada remota aumenta saldo e registra auditoria", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_1",
          institution_id: "inst_auth",
          name: "Caderno universitario",
          unit: "un",
          category: "Papelaria",
          min_quantity: 5,
          current_quantity: 12,
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        itemId: "sf_item_1",
        quantity: 8,
        unitCost: 3.5,
        supplier: "Fornecedor Teste",
        invoiceNumber: "NF-001",
        notes: "Entrada remota"
      })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, "remote");
    assert.equal(data.entry.itemId, "sf_item_1");
    assert.equal(data.entry.quantity, 8);
    assert.equal(data.item.currentQuantity, 20);

    const auditResponse = await fetch(testServer.baseUrl + "/api/stock-full/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const auditData = await auditResponse.json();
    assert.equal(auditResponse.status, 200);
    assert.equal(auditData.auditLog.length, 1);
    assert.equal(auditData.auditLog[0].action, "entry_created");
    assert.equal(auditData.auditLog[0].entityType, "stock_full_entries");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full bloqueia entrada para item de outra instituicao", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_outro",
          institution_id: "outra_inst",
          name: "Item protegido",
          unit: "un",
          current_quantity: 5,
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_outro", quantity: 3 })
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_item_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full entries lista somente entradas da instituicao autenticada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullEntries: [
        {
          id: "sf_entry_1",
          institution_id: "inst_auth",
          item_id: "sf_item_1",
          quantity: 3,
          created_at: "2026-06-08T10:00:00.000Z"
        },
        {
          id: "sf_entry_outro",
          institution_id: "outra_inst",
          item_id: "sf_item_outro",
          quantity: 9,
          created_at: "2026-06-08T11:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/entries", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.entries.length, 1);
    assert.equal(data.entries[0].id, "sf_entry_1");
    assert.equal(data.entries[0].quantity, 3);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full audit-log lista somente logs da instituicao autenticada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullAuditLogs: [
        {
          id: "sf_audit_1",
          institution_id: "inst_auth",
          action: "entry_created",
          entity_type: "stock_full_entries",
          entity_id: "sf_entry_1",
          description: "Entrada autenticada",
          created_at: "2026-06-08T10:00:00.000Z"
        },
        {
          id: "sf_audit_outro",
          institution_id: "outra_inst",
          action: "entry_created",
          entity_type: "stock_full_entries",
          entity_id: "sf_entry_outro",
          description: "Entrada de outra empresa",
          created_at: "2026-06-08T11:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.auditLog.length, 1);
    assert.equal(data.auditLog[0].id, "sf_audit_1");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full exits exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId: "sf_item_1", quantity: 2 })
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full exits retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_1", quantity: 2 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full cria saida remota reduz saldo e registra auditoria", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_1",
          institution_id: "inst_auth",
          name: "Caderno universitario",
          unit: "un",
          category: "Papelaria",
          min_quantity: 5,
          current_quantity: 20,
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        itemId: "sf_item_1",
        quantity: 6,
        destination: "Balcao",
        responsible: "Operador Teste",
        notes: "Saida remota"
      })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.mode, "remote");
    assert.equal(data.exit.itemId, "sf_item_1");
    assert.equal(data.exit.quantity, 6);
    assert.equal(data.item.currentQuantity, 14);

    const auditResponse = await fetch(testServer.baseUrl + "/api/stock-full/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const auditData = await auditResponse.json();
    assert.equal(auditResponse.status, 200);
    assert.equal(auditData.auditLog.length, 1);
    assert.equal(auditData.auditLog[0].action, "stock_full_exit_created");
    assert.equal(auditData.auditLog[0].entityType, "stock_full_exit");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full bloqueia saida maior que saldo remoto", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_1",
          institution_id: "inst_auth",
          name: "Caneta",
          unit: "un",
          current_quantity: 5,
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_1", quantity: 6 })
    });
    const data = await response.json();

    assert.equal(response.status, 409);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_insufficient_quantity");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full bloqueia saida para item de outra instituicao", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_outro",
          institution_id: "outra_inst",
          name: "Item protegido",
          unit: "un",
          current_quantity: 10,
          is_active: true
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_outro", quantity: 3 })
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_item_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full bloqueia saida para item inativo", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        {
          id: "sf_item_inativo",
          institution_id: "inst_auth",
          name: "Item inativo",
          unit: "un",
          current_quantity: 10,
          is_active: false
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ itemId: "sf_item_inativo", quantity: 3 })
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_full_item_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full exits lista somente saidas da instituicao autenticada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullExits: [
        {
          id: "sf_exit_1",
          institution_id: "inst_auth",
          item_id: "sf_item_1",
          quantity: 3,
          created_at: "2026-06-08T10:00:00.000Z"
        },
        {
          id: "sf_exit_outro",
          institution_id: "outra_inst",
          item_id: "sf_item_outro",
          quantity: 9,
          created_at: "2026-06-08T11:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.exits.length, 1);
    assert.equal(data.exits[0].id, "sf_exit_1");
    assert.equal(data.exits[0].quantity, 3);
  } finally {
    await closeTestServer_(testServer.server);
  }
});



test("stock full saida com mesma offline_uuid nao duplica baixa", async () => {
  const supabase = createMockStockSaudeSupabase_({
    stockFullItems: [
      {
        id: "sf_item_1",
        institution_id: "inst_auth",
        name: "Caderno universitario",
        unit: "un",
        current_quantity: 20,
        is_active: true
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const body = JSON.stringify({ itemId: "sf_item_1", quantity: 6, offline_uuid: "offline-exit-1", responsible: "Operador Teste" });
    const firstResponse = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      body
    });
    const first = await firstResponse.json();
    const secondResponse = await fetch(testServer.baseUrl + "/api/stock-full/exits", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
      body
    });
    const second = await secondResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(secondResponse.status, 200);
    assert.equal(first.item.currentQuantity, 14);
    assert.equal(second.duplicate, true);
    assert.equal(second.exit.offlineUuid, "offline-exit-1");
    assert.equal(second.item.currentQuantity, 14);
    assert.equal(supabase.stockFullExits.length, 1);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock full live mostra saida online e isola outra empresa", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockFullSupabaseClient: createMockStockSaudeSupabase_({
      stockFullItems: [
        { id: "sf_item_1", institution_id: "inst_auth", name: "Caneta azul", unit: "un", current_quantity: 7, is_active: true },
        { id: "sf_item_b", institution_id: "outra_inst", name: "Produto B", unit: "un", current_quantity: 9, is_active: true }
      ],
      stockFullExits: [
        { id: "sf_exit_1", institution_id: "inst_auth", item_id: "sf_item_1", quantity: 3, responsible: "Funcionario A", created_at: "2026-06-08T10:00:00.000Z" },
        { id: "sf_exit_b", institution_id: "outra_inst", item_id: "sf_item_b", quantity: 4, responsible: "Funcionario B", created_at: "2026-06-08T11:00:00.000Z" }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-full/live", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.exits.length, 1);
    assert.equal(data.exits[0].id, "sf_exit_1");
    assert.equal(data.exits[0].itemName, "Caneta azul");
    assert.equal(data.exits[0].employeeName, "Funcionario A");
    assert.equal(data.exits[0].currentQuantity, 7);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude items retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/items?institution_id=inst_teste");
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("stock saude cria item retorna 503 controlado sem Supabase", async () => {
  const response = await fetch(baseUrl + "/api/stock-saude/items", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      institution_id: "inst_teste",
      unit_id: "unit_teste",
      name: "Mascara cirurgica",
      unit: "un"
    })
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.error, "stock_saude_database_not_configured");
  assert.equal(data.fallback, "localStorage");
});

test("frontend Stock Saude prepara autenticacao Supabase sem remover fallback local", async () => {
  const content = readFileSync(join("..", "stock-saude.js"), "utf8");

  assert.match(content, /function getStockSaudeSupabaseToken\(\)/);
  assert.match(content, /async function fetchStockSaudeMe\(\)/);
  assert.match(content, /async function initStockSaudeAuthContext\(\)/);
  assert.match(content, /\/api\/stock-saude\/me/);
  assert.match(content, /\/api\/stock-saude\/audit-log/);
  assert.match(content, /listAuditLog\(token\)/);
  assert.match(content, /Criou item/);
  assert.match(content, /Registrou entrada/);
  assert.match(content, /Registrou saida/);
  assert.match(content, /Aprovou entrada/);
  assert.match(content, /Rejeitou entrada/);
  assert.match(content, /activeHistoryFilter === "aprovacoes"/);
  assert.match(content, /activeHistoryFilter === "itens"/);
  assert.match(content, /function canStockSaudeRole\(action\)/);
  assert.match(content, /stockSaudeAuthContext\.mode !== "supabase"/);
  assert.match(content, /Seu perfil nao tem permissao para esta acao/);
  assert.match(content, /function buildStockSaudeManagerPdfHtml_\(data\)/);
  assert.match(content, /async function generateStockSaudeManagementPdf\(\)/);
  assert.match(content, /Gerar PDF Gerencial/);
  assert.match(content, /Relatorio Gerencial - Stock Saude/);
  assert.match(content, /Controle de estoque, movimentacoes, pendencias e auditoria operacional/);
  assert.match(content, /StockSaudeAPI\.getDashboard\(token\)/);
  assert.match(content, /StockSaudeAPI\.listAuditLog\(token\)/);
  assert.match(content, /\/api\/stock-saude\/invites/);
  assert.match(content, /async listInvites\(token\)/);
  assert.match(content, /async createInvite\(token, invite\)/);
  assert.match(content, /async acceptInvite\(token\)/);
  assert.match(content, /\/api\/stock-saude\/invites\/accept/);
  assert.match(content, /Convidar usuario/);
  assert.match(content, /Aceitar convite/);
  assert.match(content, /Voce foi vinculado a instituicao com sucesso/);
  assert.match(content, /stockSaudeInviteForm/);
  assert.match(content, /create_invite/);
  assert.match(content, /read_invites/);
  assert.match(content, /loadCurrentStockSaudeState\(\)/);
  assert.match(content, /window\.print\(\)/);
  assert.match(content, /async function exportStockSaudeCsv\(\)/);
  assert.match(content, /async function exportStockSaudeExcel\(\)/);
  assert.match(content, /buildStockSaudeCsvContent\(state\)/);
  assert.match(content, /buildStockSaudeExcelContent\(state\)/);
  assert.match(content, /Exportar CSV/);
  assert.match(content, /Exportar Excel/);
  assert.match(content, /stock-saude-operacional\.csv/);
  assert.match(content, /stock-saude-operacional\.xls/);
  assert.match(content, /Nome", "Categoria", "Unidade", "Saldo", "Minimo", "Local/);
  assert.match(content, /Data", "Item", "Quantidade", "Status", "Responsavel/);
  assert.match(content, /Data", "Item", "Quantidade", "Responsavel/);
  assert.match(content, /Authorization: "Bearer " \+ token/);
  assert.match(content, /mode: "supabase"/);
  assert.match(content, /mode: "local"/);
  assert.match(content, /STOCK_SAUDE_DEMO_INSTITUTION_ID/);
  assert.match(content, /STOCK_SAUDE_DEMO_UNIT_ID/);
  assert.match(content, /STOCK_SAUDE_DEMO_PROFILE_ID/);
  assert.doesNotMatch(content, /console\.(?:log|info|warn|error)\([^)]*token/i);
});

test("frontend Stock Full detecta token Supabase e preserva modo local", async () => {
  const content = readFileSync(join("..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");

  assert.match(content, /function getStockFullSupabaseToken_\(\)/);
  assert.match(content, /async function fetchStockFullMe_\(\)/);
  assert.match(content, /async function initStockFullAuthContext_\(\)/);
  assert.match(content, /\/api\/stock-full\/me/);
  assert.match(content, /stockFullRuntimeMode = "local"/);
  assert.match(content, /Conectado ao Stock Full/);
  assert.match(content, /Não sincronizado na nuvem/);
  assert.doesNotMatch(content, /console\.(?:log|info|warn|error)\([^)]*token/i);
});

test("frontend Stock Full prepara API remota de produtos sem sincronizar movimentacoes", async () => {
  const content = readFileSync(join("..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");

  assert.match(content, /async function loadStockFullRemoteItems_\(\)/);
  assert.match(content, /async function createStockFullRemoteItem_/);
  assert.match(content, /async function updateStockFullRemoteItem_/);
  assert.match(content, /async function deleteStockFullRemoteItem_/);
  assert.match(content, /\/api\/stock-full\/items/);
  assert.match(content, /TODO Fase 3: sincronizacao\/importacao controlada de itens locais para nuvem/);
  assert.match(content, /Produtos, entradas e saídas na nuvem/);
});

test("frontend Stock Full prepara entradas e saidas remotas sem sincronizacao automatica", async () => {
  const content = readFileSync(join("..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");

  assert.match(content, /async function createStockFullRemoteEntry_/);
  assert.match(content, /async function loadStockFullRemoteEntries_/);
  assert.match(content, /async function createStockFullRemoteExit_/);
  assert.match(content, /async function loadStockFullRemoteExits_/);
  assert.match(content, /async function loadStockFullRemoteAuditLog_/);
  assert.match(content, /\/api\/stock-full\/entries/);
  assert.match(content, /\/api\/stock-full\/exits/);
  assert.match(content, /\/api\/stock-full\/audit-log/);
  assert.match(content, /TODO Fase futura: importação\/sincronização controlada de entradas locais para nuvem/);
  assert.match(content, /TODO Fase futura: importação\/sincronização controlada de saídas locais para nuvem/);
});

test("stock saude items exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria item exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Item teste", unit: "un" })
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria item valida name e unit com profile autenticado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ category: "Medicamento" })
    });
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.equal(data.ok, false);
    assert.equal(data.error, "name_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria itens usando institution e unit do profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10,
        location: "Farmacia",
        expiration_date: null
      },
      {
        id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outro",
        category: "Medicamento",
        unit: "un",
        minimum_quantity: 1
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items?institution_id=forjada&unit_id=forjada", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.items.length, 1);
    assert.equal(listData.items[0].institution_id, "inst_auth");
    assert.equal(listData.items[0].unit_id, "unit_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        name: "Seringa",
        category: "Material",
        unit: "un",
        minimum_quantity: 25,
        location: "Almoxarifado"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.item.institution_id, "inst_auth");
    assert.equal(createData.item.unit_id, "unit_auth");
    assert.equal(createData.item.name, "Seringa");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao cria item", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Item leitura", unit: "un" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude entries exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude entries retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria entry valida item_id e quantidade", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const missingItemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ quantity: 10 })
    });
    const missingItemData = await missingItemResponse.json();
    assert.equal(missingItemResponse.status, 400);
    assert.equal(missingItemData.error, "item_id_required");

    const invalidQuantityResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 0 })
    });
    const invalidQuantityData = await invalidQuantityResponse.json();
    assert.equal(invalidQuantityResponse.status, 400);
    assert.equal(invalidQuantityData.error, "quantity_must_be_positive");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao registra entrada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria entries usando profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 12,
        status: "pendente",
        requested_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      },
      {
        id: "entry_2",
        item_id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 3,
        status: "pendente",
        requested_by: "profile_auth",
        created_at: "2026-06-01T11:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.entries.length, 1);
    assert.equal(listData.entries[0].institution_id, "inst_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        requested_by: "forjado",
        item_id: "item_1",
        quantity: 7,
        invoice_number: "NF-TESTE"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.entry.institution_id, "inst_auth");
    assert.equal(createData.entry.unit_id, "unit_auth");
    assert.equal(createData.entry.requested_by, "profile_auth");
    assert.equal(createData.entry.status, "pendente");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia entry para item de outra instituicao", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Item externo",
        unit: "un"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_outra_inst", quantity: 5 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "item_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao registra saida", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude exits exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude exits retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria exit valida item_id e quantidade", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const missingItemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ quantity: 10 })
    });
    const missingItemData = await missingItemResponse.json();
    assert.equal(missingItemResponse.status, 400);
    assert.equal(missingItemData.error, "item_id_required");

    const invalidQuantityResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 0 })
    });
    const invalidQuantityData = await invalidQuantityResponse.json();
    assert.equal(invalidQuantityResponse.status, 400);
    assert.equal(invalidQuantityData.error, "quantity_must_be_positive");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude lista e cria exits usando profile autenticado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada",
        requested_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 4,
        destination_sector: "Enfermaria",
        purpose: "Reposicao",
        responsible_name: "Gestor",
        created_by: "profile_auth",
        created_at: "2026-06-01T12:00:00.000Z"
      },
      {
        id: "exit_2",
        item_id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 2,
        created_by: "profile_auth",
        created_at: "2026-06-01T13:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(listData.ok, true);
    assert.equal(listData.exits.length, 1);
    assert.equal(listData.exits[0].institution_id, "inst_auth");

    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        institution_id: "forjada",
        unit_id: "forjada",
        created_by: "forjado",
        item_id: "item_1",
        quantity: 3,
        destination_sector: "UPA Centro",
        purpose: "Atendimento"
      })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.exit.institution_id, "inst_auth");
    assert.equal(createData.exit.unit_id, "unit_auth");
    assert.equal(createData.exit.created_by, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia exit para item de outra unidade", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        name: "Item externo",
        unit: "un"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_outra_unit", quantity: 1 })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "item_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude balance exige Authorization e ignora escopo forjado", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      },
      {
        id: "item_2",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outro",
        category: "Medicamento",
        unit: "un",
        minimum_quantity: 1
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 5
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const unauthorizedResponse = await fetch(testServer.baseUrl + "/api/stock-saude/balance");
    const unauthorizedData = await unauthorizedResponse.json();
    assert.equal(unauthorizedResponse.status, 401);
    assert.equal(unauthorizedData.error, "authentication_required");

    const response = await fetch(testServer.baseUrl + "/api/stock-saude/balance?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.balance.length, 1);
    assert.equal(data.balance[0].item_id, "item_1");
    assert.equal(data.balance[0].current_quantity, 15);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude cria auditoria para item, entry e exit", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Seringa", unit: "un" })
    });
    await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 2 })
    });
    await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });

    const actions = supabase.auditLogs.map((log) => log.action);
    assert.deepEqual(actions, ["item_created", "entry_created", "exit_created"]);
    supabase.auditLogs.forEach((log) => {
      assert.equal(log.institution_id, "inst_auth");
      assert.equal(log.unit_id, "unit_auth");
      assert.equal(log.profile_id, "profile_auth");
      assert.ok(log.created_at);
    });
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprovacao exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      entries: [
        {
          id: "entry_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST"
    });
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprovacao retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude bloqueia aprovacao de entrada fora do escopo", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      entries: [
        {
          id: "entry_outra_inst",
          institution_id: "outra_inst",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_outra_inst/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "entry_not_in_profile_scope");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role almoxarife nao aprova entrada", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("almoxarife"),
      entries: [
        {
          id: "entry_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          item_id: "item_1",
          quantity: 5,
          status: "pendente"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aprova entrada com profile real e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente",
        requested_by: "profile_auth"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ approved_by: "forjado" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.entry.status, "aprovada");
    assert.equal(data.entry.approved_by, "profile_auth");
    assert.ok(data.entry.approved_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "approve_entry");
    assert.equal(supabase.auditLogs[0].profile_id, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role gestor aprova entrada", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("gestor"),
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.entry.status, "aprovada");
    assert.equal(data.entry.approved_by, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role administrador pode criar item entrada saida e aprovar", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("administrador"),
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10
      }
    ],
    entries: [
      {
        id: "entry_approved",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada"
      },
      {
        id: "entry_pending",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 2,
        status: "pendente"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const itemResponse = await fetch(testServer.baseUrl + "/api/stock-saude/items", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "Seringa", unit: "un" })
    });
    assert.equal(itemResponse.status, 200);

    const entryResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 2 })
    });
    assert.equal(entryResponse.status, 200);

    const exitResponse = await fetch(testServer.baseUrl + "/api/stock-saude/exits", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ item_id: "item_1", quantity: 1 })
    });
    assert.equal(exitResponse.status, 200);

    const approvalResponse = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_pending/approve", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    assert.equal(approvalResponse.status, 200);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role gestor cria convite", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("gestor")
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const createResponse = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "novo@teste.local", role: "almoxarife" })
    });
    const createData = await createResponse.json();

    assert.equal(createResponse.status, 200);
    assert.equal(createData.ok, true);
    assert.equal(createData.invite.email, "novo@teste.local");
    assert.equal(createData.invite.role, "almoxarife");
    assert.equal(createData.invite.institution_id, "inst_auth");
    assert.equal(createData.invite.unit_id, "unit_auth");
    assert.equal(createData.invite.created_by, "profile_auth");
    assert.equal(createData.invite.status, "pendente");

    const listResponse = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const listData = await listResponse.json();

    assert.equal(listResponse.status, 200);
    assert.equal(listData.invites.length, 1);
    assert.equal(listData.invites[0].email, "novo@teste.local");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role administrador cria convite", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: createMockStockSaudeProfile_("administrador")
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "leitura@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.invite.role, "leitura");
    assert.equal(supabase.invites.length, 1);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role leitura nao cria convite", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("leitura")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "bloqueado@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude role almoxarife nao cria convite", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: createMockStockSaudeProfile_("almoxarife")
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites", {
      method: "POST",
      headers: {
        Authorization: "Bearer valid-token",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: "bloqueado@teste.local", role: "leitura" })
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.error, "permission_denied");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite retorna 404 para convite inexistente", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: null,
      user: {
        id: "auth_convidado",
        email: "sem-convite@teste.local"
      }
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.error, "stock_saude_invite_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite nao permite convite de outro email", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      profile: null,
      user: {
        id: "auth_convidado",
        email: "usuario@teste.local"
      },
      invites: [
        {
          id: "invite_1",
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          email: "outro@teste.local",
          role: "leitura",
          status: "pendente",
          created_by: "profile_auth",
          created_at: "2026-06-01T10:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 404);
    assert.equal(data.error, "stock_saude_invite_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite retorna profile existente sem duplicar", async () => {
  const profile = createMockStockSaudeProfile_("leitura");
  const supabase = createMockStockSaudeSupabase_({
    profile,
    user: {
      id: profile.auth_user_id,
      email: profile.email
    },
    invites: [
      {
        id: "invite_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: profile.email,
        role: "gestor",
        status: "pendente",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.profile.id, profile.id);
    assert.equal(supabase.profiles.length, 1);
    assert.equal(supabase.invites[0].status, "aceito");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite cria profile automatico e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: null,
    user: {
      id: "auth_novo",
      email: "novo@teste.local",
      user_metadata: { name: "Novo Usuario" }
    },
    invites: [
      {
        id: "invite_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: "novo@teste.local",
        role: "almoxarife",
        status: "pendente",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.profile.auth_user_id, undefined);
    assert.equal(data.profile.email, "novo@teste.local");
    assert.equal(data.profile.role, "almoxarife");
    assert.equal(data.profile.institution_id, "inst_auth");
    assert.equal(data.profile.unit_id, "unit_auth");
    assert.equal(supabase.profiles.length, 1);
    assert.equal(supabase.profiles[0].auth_user_id, "auth_novo");
    assert.equal(supabase.invites[0].status, "aceito");
    assert.ok(supabase.invites[0].accepted_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "accept_invite");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude aceite fluxo feliz vincula convite pendente", async () => {
  const supabase = createMockStockSaudeSupabase_({
    profile: null,
    user: {
      id: "auth_fluxo",
      email: "fluxo@teste.local"
    },
    invites: [
      {
        id: "invite_fluxo",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        email: "fluxo@teste.local",
        role: "leitura",
        status: "pending",
        created_by: "profile_auth",
        created_at: "2026-06-01T10:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/invites/accept", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.profile.email, "fluxo@teste.local");
    assert.equal(data.invite.status, "aceito");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude rejeita entrada com profile real e registra auditoria", async () => {
  const supabase = createMockStockSaudeSupabase_({
    entries: [
      {
        id: "entry_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        item_id: "item_1",
        quantity: 5,
        status: "pendente",
        requested_by: "profile_auth"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/entries/entry_1/reject", {
      method: "POST",
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.entry.status, "rejeitada");
    assert.equal(data.entry.approved_by, "profile_auth");
    assert.ok(data.entry.approved_at);
    assert.equal(supabase.auditLogs.length, 1);
    assert.equal(supabase.auditLogs[0].action, "reject_entry");
    assert.equal(supabase.auditLogs[0].profile_id, "profile_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard consolida dados reais do profile", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Dipirona",
        category: "Medicamento",
        unit: "caixa",
        minimum_quantity: 10,
        expiration_date: "2026-07-01"
      },
      {
        id: "item_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Seringa vencida",
        category: "Material",
        unit: "un",
        minimum_quantity: 2,
        expiration_date: "2026-01-01"
      }
    ],
    entries: [
      {
        id: "entry_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 20,
        status: "aprovada",
        created_at: "2026-06-03T10:00:00.000Z"
      },
      {
        id: "entry_2",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 3,
        status: "pendente",
        created_at: "2026-06-04T10:00:00.000Z"
      },
      {
        id: "entry_3",
        item_id: "item_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 1,
        status: "rejeitada",
        created_at: "2026-06-04T11:00:00.000Z"
      }
    ],
    exits: [
      {
        id: "exit_1",
        item_id: "item_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 15,
        created_at: "2026-06-04T12:00:00.000Z"
      }
    ],
    auditLogs: [
      {
        id: "audit_1",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        action: "item_created"
      },
      {
        id: "audit_2",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        action: "approve_entry"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.dashboard.totalItems, 2);
    assert.equal(data.dashboard.totalEntries, 3);
    assert.equal(data.dashboard.totalExits, 1);
    assert.equal(data.dashboard.pendingEntries, 1);
    assert.equal(data.dashboard.approvedEntries, 1);
    assert.equal(data.dashboard.rejectedEntries, 1);
    assert.equal(data.dashboard.lowStockItems, 1);
    assert.equal(data.dashboard.expiredItems, 1);
    assert.equal(data.dashboard.expiringSoonItems, 1);
    assert.equal(data.dashboard.totalBalance, 5);
    assert.equal(data.dashboard.auditCount, 2);
    assert.equal(data.dashboard.recentEntries.length, 3);
    assert.equal(data.dashboard.recentExits.length, 1);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude dashboard filtra por institution e unit do profile", async () => {
  const supabase = createMockStockSaudeSupabase_({
    items: [
      {
        id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        name: "Item auth",
        unit: "un",
        minimum_quantity: 1
      },
      {
        id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        name: "Outra inst",
        unit: "un",
        minimum_quantity: 1
      },
      {
        id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        name: "Outra unit",
        unit: "un",
        minimum_quantity: 1
      }
    ],
    entries: [
      {
        id: "entry_auth",
        item_id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 4,
        status: "aprovada"
      },
      {
        id: "entry_outra_unit",
        item_id: "item_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        quantity: 99,
        status: "aprovada"
      }
    ],
    exits: [
      {
        id: "exit_auth",
        item_id: "item_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        quantity: 1
      },
      {
        id: "exit_outra_inst",
        item_id: "item_outra_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        quantity: 99
      }
    ],
    auditLogs: [
      {
        id: "audit_auth",
        institution_id: "inst_auth",
        unit_id: "unit_auth"
      },
      {
        id: "audit_outra_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/dashboard?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.dashboard.totalItems, 1);
    assert.equal(data.dashboard.totalEntries, 1);
    assert.equal(data.dashboard.totalExits, 1);
    assert.equal(data.dashboard.totalBalance, 3);
    assert.equal(data.dashboard.auditCount, 1);
    assert.equal(data.dashboard.recentEntries[0].id, "entry_auth");
    assert.equal(data.dashboard.recentExits[0].id, "exit_auth");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log exige Authorization quando Supabase esta configurado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_()
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log");
    const data = await response.json();

    assert.equal(response.status, 401);
    assert.equal(data.ok, false);
    assert.equal(data.error, "authentication_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log retorna 403 quando profile nao existe", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({ profile: null })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.equal(data.ok, false);
    assert.equal(data.error, "stock_saude_profile_not_found");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log filtra escopo e ordena do mais recente", async () => {
  const supabase = createMockStockSaudeSupabase_({
    auditLogs: [
      {
        id: "audit_old",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "item_created",
        entity_type: "stock_items",
        entity_id: "item_1",
        created_at: "2026-06-02T10:00:00.000Z"
      },
      {
        id: "audit_other_unit",
        institution_id: "inst_auth",
        unit_id: "outra_unit",
        profile_id: "profile_auth",
        action: "entry_created",
        entity_type: "stock_entries",
        entity_id: "entry_outra_unit",
        created_at: "2026-06-04T12:00:00.000Z"
      },
      {
        id: "audit_new",
        institution_id: "inst_auth",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "approve_entry",
        entity_type: "stock_entries",
        entity_id: "entry_1",
        created_at: "2026-06-04T11:00:00.000Z"
      },
      {
        id: "audit_other_inst",
        institution_id: "outra_inst",
        unit_id: "unit_auth",
        profile_id: "profile_auth",
        action: "exit_created",
        entity_type: "stock_exits",
        entity_id: "exit_outra_inst",
        created_at: "2026-06-04T13:00:00.000Z"
      }
    ]
  });
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: supabase
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log?institution_id=outra_inst&unit_id=outra_unit", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.auditLog.length, 2);
    assert.equal(data.auditLog[0].action, "approve_entry");
    assert.equal(data.auditLog[1].action, "item_created");
    assert.deepEqual(Object.keys(data.auditLog[0]).sort(), [
      "action",
      "created_at",
      "entity_id",
      "entity_type",
      "profile_id",
      "profile_name"
    ]);
    assert.equal(data.auditLog[0].profile_name, "Gestor Teste");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("stock saude audit-log retorna trilha operacional feliz", async () => {
  const app = createApp({
    env: { PORT: "0" },
    stockSaudeSupabaseClient: createMockStockSaudeSupabase_({
      auditLogs: [
        {
          institution_id: "inst_auth",
          unit_id: "unit_auth",
          profile_id: "profile_auth",
          action: "create_item",
          entity_type: "stock_entries",
          entity_id: "entry_1",
          created_at: "2026-06-04T12:00:00.000Z"
        }
      ]
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/stock-saude/audit-log", {
      headers: { Authorization: "Bearer valid-token" }
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.deepEqual(data.auditLog[0], {
      profile_name: "Gestor Teste",
      action: "create_item",
      entity_type: "stock_entries",
      entity_id: "entry_1",
      profile_id: "profile_auth",
      created_at: "2026-06-04T12:00:00.000Z"
    });
  } finally {
    await closeTestServer_(testServer.server);
  }
});

before(async () => {
  eloVectorMemoryStore = createEloVectorMemoryStore_({ memoryOnly: true });
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500"
    },
    eloVectorMemoryStore
  });

  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve) => server.close(resolve));
});

test("health responde ok", async () => {
  const response = await fetch(baseUrl + "/api/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test("bloqueia action inválida", async () => {
  const response = await postAi_({
    action: "invalid",
    text: "teste",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("valida texto vazio em improve", async () => {
  const response = await postAi_({
    action: "improve",
    text: "",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("sem chave retorna erro amigável para fallback local", async () => {
  const response = await postAi_({
    action: "review",
    text: "",
    context: {
      report: {
        obra: "Obra teste"
      },
      stats: {
        fotos: 1,
        inconformidades: 0,
        riscosAltos: 0
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("análise visual exige imagem processada", async () => {
  const response = await postImage_({
    image: {},
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("análise visual sem chave retorna erro amigável", async () => {
  const response = await postImage_({
    image: {
      base64: tinyJpegBase64_(),
      mimeType: "image/jpeg",
      fileName: "teste.jpg",
      width: 1,
      height: 1
    },
    context: {
      report: {
        obra: "Obra teste"
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("elo chat exige mensagem", async () => {
  const response = await postEloChat_({
    message: "",
    history: []
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.equal(data.fallback, true);
});

test("elo chat protege concreto sem FCK antes do fallback online", async () => {
  const response = await postEloChat_({
    message: "Quero calcular concreto para uma laje de 20 m² com 8 cm de espessura.",
    history: [],
    context: {
      source: "elo",
      mode: "standalone",
      eloContext: "obras"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, "technical_validation");
  assert.match(data.answer, /preciso confirmar o FCK do concreto/);
  assert.doesNotMatch(data.answer, /cimento|areia|brita/i);
});
test("elo chat sem chave solicita fallback local", async () => {
  const response = await postEloChat_({
    message: "Oi Elo, voce esta online?",
    history: [
      { role: "system", content: "ignorar" },
      { role: "user", content: "Ola" },
      { role: "assistant", content: "Ola, posso ajudar." }
    ],
    context: {
      source: "elo",
      mode: "standalone"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.mode, "fallback_required");
  assert.equal(data.fallback, true);
  assert.match(data.answer, /modo offline|Elo online ativo/i);
  assert.doesNotMatch(data.answer, /forma local/i);
});

test("elo chat sem chave responde pergunta simples pelo fallback inteligente", async () => {
  const response = await postEloChat_({
    message: "receita de bolo de cenoura",
    history: [],
    context: {
      source: "elo",
      mode: "standalone"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.answer, /cenoura|ovos|farinha|fermento/i);
  assert.doesNotMatch(data.answer, /projeto|próxima ação|retrabalho/i);
});

test("elo chat separa savePrompt do answer limpo", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const inputText = JSON.stringify(payload.input);
      let text = "Resposta limpa do Elo.";
      if (/calcule parede 20x3/i.test(inputText)) {
        text = "Resultado: 750 blocos cerâmicos.\n\nDeseja guardar isso para eu lembrar depois?\nGuardar\nNão guardar";
      } else if (/Cadista AI/i.test(inputText)) {
        text = "A estratégia faz sentido: começar pelo gerador procedural reduz risco antes da IA avançada.\n\nDeseja guardar isso para eu lembrar depois?\nGuardar";
      } else if (/Stock Full/i.test(inputText)) {
        text = "Resumo estratégico do projeto Stock Full: foco em controle simples para lojistas.\n\nDeseja guardar isso na Biblioteca do Elo?\nGuardar na Biblioteca";
      }
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text }] }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      async function post(message) {
        const response = await fetch(url + "/api/elo/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:5500"
          },
          body: JSON.stringify({
            message,
            history: [],
            context: { source: "elo", mode: "standalone", eloContext: "obras" }
          })
        });
        return response.json();
      }

      const calc = await post("calcule parede 20x3 com bloco cerâmico");
      const memory = await post("lembre que a estratégia do Cadista AI é começar com gerador procedural antes de IA avançada");
      const library = await post("monte um resumo estratégico do projeto Stock Full para eu guardar na biblioteca");

      assert.equal(calc.savePrompt.show, false);
      assert.equal(calc.savePrompt.type, "none");
      assert.equal(calc.mode, "technical_validation");
      assert.match(calc.answer, /dimensão real do bloco cerâmico/i);
      assert.doesNotMatch(calc.answer, /Deseja guardar|Biblioteca do Elo|^Guardar$|^Não guardar$/im);

      assert.equal(memory.savePrompt.show, true);
      assert.equal(memory.savePrompt.type, "memory");
      assert.doesNotMatch(memory.answer, /Deseja guardar|^Guardar$/im);

      assert.equal(library.savePrompt.show, true);
      assert.equal(library.savePrompt.type, "library");
      assert.doesNotMatch(library.answer, /Deseja guardar|Biblioteca do Elo|Guardar na Biblioteca/im);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("elo chat oficial responde perguntas abertas sem texto legado do frontend", async () => {
  const originalFetch = globalThis.fetch;
  const openAiInputs = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const inputText = JSON.stringify(payload.input);
      openAiInputs.push(inputText);
      let text = "Resposta do cérebro oficial do Elo.";
      if (/calcule parede 20x3/i.test(inputText)) {
        text = "Área da parede: 60 m². Para bloco cerâmico, considere uma estimativa conforme o bloco escolhido e margem de perda.";
      } else if (/guarde na biblioteca um resumo do projeto Stock Full/i.test(inputText)) {
        text = "Resumo do projeto Stock Full: controle simples de estoque para lojistas, com entradas, saídas, saldo e alertas operacionais.";
      } else if (/quero gerar PDF/i.test(inputText)) {
        text = "No contexto do ObraReport, revise os dados do relatório, fotos e conclusão técnica antes de gerar o PDF.";
      } else if (/prefiro respostas curtas/i.test(inputText)) {
        text = "Preferência registrada no contexto: respostas curtas no Elo.";
      }
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text }] }]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      async function post(message) {
        const response = await fetch(url + "/api/elo/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:5500"
          },
          body: JSON.stringify({
            message,
            history: [],
            eloContext: "obras",
            context: { source: "elo", mode: "obrareport", eloContext: "obras" }
          })
        });
        assert.equal(response.status, 200);
        return response.json();
      }

      const calc = await post("calcule parede 20x3 com bloco cerâmico");
      const library = await post("guarde na biblioteca um resumo do projeto Stock Full");
      const pdf = await post("quero gerar PDF");
      const memory = await post("lembre que prefiro respostas curtas no Elo");

      assert.equal(openAiInputs.length, 3);
      assert.equal(calc.mode, "technical_validation");
      assert.match(calc.answer, /dimensão real do bloco cerâmico/i);
      assert.equal(calc.savePrompt.show, false);
      assert.equal(calc.savePrompt.type, "none");
      assert.doesNotMatch(calc.answer, /Para registrar materiais|Deseja guardar|Biblioteca do Elo/i);

      assert.match(library.answer, /Stock Full/i);
      assert.equal(library.savePrompt.show, true);
      assert.equal(library.savePrompt.type, "library");
      assert.doesNotMatch(library.answer, /Sua biblioteca local ainda não tem itens|Deseja guardar|Guardar na Biblioteca/i);

      assert.match(pdf.answer, /PDF|ObraReport/i);
      assert.doesNotMatch(pdf.answer, /Para registrar materiais/i);

      assert.equal(memory.savePrompt.show, true);
      assert.equal(memory.savePrompt.type, "memory");
      assert.doesNotMatch(memory.answer, /Deseja guardar|Guardar|Não guardar/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("prompt mestre do Elo define identidade, memoria e limites", () => {
  const prompt = buildEloSystemPrompt_();

  assert.match(prompt, /Contexto ativo: Elo Geral/i);
  assert.match(prompt, /companheiro digital com memória recente/i);
  assert.match(prompt, /não é humano/i);
  assert.match(prompt, /sem parecer atendimento genérico/i);
  assert.match(prompt, /o que percebo/i);
  assert.match(prompt, /histórico recente/i);
  assert.match(prompt, /não dê diagnóstico médico, jurídico, financeiro ou psicológico/i);
  assert.match(prompt, /Eu sou o Elo/i);
  assert.match(prompt, /Sou real como sistema digital/i);
});

test("prompt mestre do Elo aplica contexto Saude", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "saude"
  });

  assert.match(prompt, /Contexto ativo: Elo Saude/i);
  assert.match(prompt, /almoxarifado hospitalar/i);
  assert.match(prompt, /lote/i);
  assert.match(prompt, /validade/i);
  assert.match(prompt, /estoque minimo/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Obras/i);
});

test("prompt mestre do Elo aplica contexto Obras", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "obras"
  });

  assert.match(prompt, /Contexto ativo: Elo Obras/i);
  assert.match(prompt, /engenharia civil/i);
  assert.match(prompt, /RDO/i);
  assert.match(prompt, /fissuras/i);
  assert.match(prompt, /estoque de obra/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Saude/i);
});

test("Elo Obras encontra base tecnica de composicoes por mensagem", () => {
  const context = findObraComposicaoContext("Quais insumos entram em piso ceramico?");

  assert.match(context, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.match(context, /Piso ceramico/i);
  assert.match(context, /Argamassa colante/i);
  assert.match(context, /Rejunte/i);
  assert.match(context, /informe a quantidade em m2/i);
  assert.doesNotMatch(context, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
});

test("Elo Obras extrai quantidade de servico", () => {
  assert.deepEqual(extractQuantidadeServico("Vou executar 250 m2 de alvenaria"), {
    quantidade: 250,
    unidade: "m2"
  });
  assert.deepEqual(extractQuantidadeServico("Vou concretar 10 m3"), {
    quantidade: 10,
    unidade: "m3"
  });
  assert.deepEqual(extractQuantidadeServico("Quanto material para 80 metros quadrados de reboco?"), {
    quantidade: 80,
    unidade: "m2"
  });
  assert.deepEqual(extractQuantidadeServico("Vou fazer 20 pontos de tomada"), {
    quantidade: 20,
    unidade: "ponto"
  });
});

test("Elo Obras calcula previsao demonstrativa de consumo", () => {
  const context = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria com bloco ceramico");

  assert.match(context, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.match(context, /Alvenaria de vedacao/i);
  assert.match(context, /Quantidade informada: 250 m2/i);
  assert.match(context, /Bloco ceramico: 6\.750 un/i);
  assert.match(context, /Argamassa de assentamento: 5 m3/i);
  assert.match(context, /Insumos sem coeficiente demonstrativo/i);
  assert.match(context, /Cimento/i);
  assert.match(context, /Stock IA/i);
  assert.match(context, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.match(context, /pendente_confirmacao/i);
  assert.match(context, /origemCalculo: coeficiente_demonstrativo/i);
  assert.match(context, /Nao lancado automaticamente no estoque/i);
});

test("Elo Obras encontra composicoes novas e respeita pendencia de coeficientes", () => {
  const chapisco = buildPrevisaoConsumoContext("Vou executar 100 m2 de chapisco");
  const pintura = buildPrevisaoConsumoContext("Vou fazer 80 m2 de pintura");
  const concreto = buildPrevisaoConsumoContext("Vou executar 10 m3 de concreto");
  const tomada = buildPrevisaoConsumoContext("Vou fazer 20 pontos de tomada");
  const aguaFria = buildPrevisaoConsumoContext("Vou fazer 15 pontos de agua fria");

  assert.match(chapisco, /Chapisco/i);
  assert.match(chapisco, /Sem coeficientes numericos demonstrativos/i);
  assert.match(chapisco, /Cimento/i);
  assert.match(chapisco, /Insumos sem coeficiente demonstrativo/i);
  assert.doesNotMatch(chapisco, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);

  assert.match(pintura, /Pintura acrilica/i);
  assert.match(pintura, /Tinta acrilica: 13,6 l/i);
  assert.match(pintura, /Selador: 8 l/i);

  assert.match(concreto, /Concretagem simples/i);
  assert.match(concreto, /Concreto: 10 m3/i);

  assert.match(tomada, /Instalacao eletrica - tomada/i);
  assert.match(tomada, /Sem coeficientes numericos demonstrativos/i);
  assert.match(tomada, /Tomada/i);
  assert.doesNotMatch(tomada, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);

  assert.match(aguaFria, /Instalacao hidraulica - ponto de agua fria/i);
  assert.match(aguaFria, /Sem coeficientes numericos demonstrativos/i);
  assert.match(aguaFria, /Tubo PVC agua fria/i);
  assert.doesNotMatch(aguaFria, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
});

test("Elo Obras prepara plano estruturado para Stock IA sem lancamento real", () => {
  const plan = buildStockIaLaunchPlan("Vou executar 250 m2 de alvenaria com bloco ceramico");

  assert.equal(plan.origem, "elo_obras");
  assert.equal(plan.tipo, "previsao_consumo");
  assert.equal(plan.status, "pendente_confirmacao");
  assert.equal(plan.servico, "Alvenaria de vedacao");
  assert.equal(plan.quantidadeServico, 250);
  assert.equal(plan.unidadeServico, "m2");
  assert.deepEqual(plan.itens[0], {
    nome: "Bloco ceramico",
    quantidade: 6750,
    unidade: "un",
    origemCalculo: "coeficiente_demonstrativo"
  });
  assert.match(plan.observacao, /Nao lancado automaticamente no estoque/i);
  assert.equal(buildStockIaLaunchPlan("Vou fazer 20 pontos de tomada"), null);
});

test("Elo Obras extrai previsto e real de consumo", () => {
  assert.deepEqual(extractPrevistoRealConsumo("Previsto 6750 blocos, consumido 8900 blocos"), {
    item: "Blocos ceramicos",
    unidade: "un",
    previsto: 6750,
    real: 8900
  });
  assert.deepEqual(extractPrevistoRealConsumo("Compare 5 m3 de argamassa previsto com 6,8 m3 consumido"), {
    item: "Argamassa",
    unidade: "m3",
    previsto: 5,
    real: 6.8
  });
  assert.deepEqual(extractPrevistoRealConsumo("Audite o consumo: previsto 100 sacos de cimento, real 132"), {
    item: "Cimento",
    unidade: "sacos",
    previsto: 100,
    real: 132
  });
});

test("Elo Obras calcula auditoria critica de consumo", () => {
  const context = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");

  assert.match(context, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(context, /Previsto: 6\.750 un/i);
  assert.match(context, /Consumido\/real: 8\.900 un/i);
  assert.match(context, /Diferenca: \+2\.150 un/i);
  assert.match(context, /Variacao: \+31,85%/i);
  assert.match(context, /Status: critico/i);
});

test("Elo Obras classifica faixas da auditoria de consumo", () => {
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 108"), /Status: atencao leve/i);
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 120"), /Status: atencao/i);
  assert.match(buildAuditoriaConsumoContext("Previsto 100 sacos de cimento, real 80"), /Status: dentro ou abaixo do previsto/i);
});

test("prompt do Elo Obras injeta base tecnica somente no contexto obras", () => {
  const composicao = findObraComposicaoContext("Quanto material preciso para 80 m2 de reboco?");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: composicao
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: composicao
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: composicao
  });

  assert.match(obrasPrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.match(obrasPrompt, /Reboco/i);
  assert.match(obrasPrompt, /informe a quantidade em m2/i);
  assert.doesNotMatch(saudePrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
  assert.doesNotMatch(geralPrompt, /\[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA\]/i);
});

test("prompt do Elo Obras injeta previsao calculada somente no contexto obras", () => {
  const previsao = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: previsao
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: previsao
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: previsao
  });

  assert.match(obrasPrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.match(obrasPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.match(obrasPrompt, /Bloco ceramico: 6\.750 un/i);
  assert.match(obrasPrompt, /pendente_confirmacao/i);
  assert.doesNotMatch(saudePrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.doesNotMatch(saudePrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.doesNotMatch(geralPrompt, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
  assert.doesNotMatch(geralPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
});

test("prompt do Elo Obras injeta auditoria somente no contexto obras", () => {
  const auditoria = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");
  const obrasPrompt = buildEloSystemPrompt_({
    eloContext: "obras",
    obraComposicaoContext: auditoria
  });
  const saudePrompt = buildEloSystemPrompt_({
    eloContext: "saude",
    obraComposicaoContext: auditoria
  });
  const geralPrompt = buildEloSystemPrompt_({
    eloContext: "geral",
    obraComposicaoContext: auditoria
  });

  assert.match(obrasPrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(obrasPrompt, /Status: critico/i);
  assert.doesNotMatch(obrasPrompt, /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
  assert.doesNotMatch(saudePrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.doesNotMatch(geralPrompt, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
});

test("Elo Obras prioriza auditoria quando ha previsto e real", () => {
  const auditoria = buildAuditoriaConsumoContext("Previsto 6750 blocos, consumido 8900 blocos");
  const previsao = buildPrevisaoConsumoContext("Vou executar 250 m2 de alvenaria");

  assert.match(auditoria, /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
  assert.match(previsao, /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
});

test("prompt mestre do Elo inclui memoria permanente enviada no contexto", () => {
  const prompt = buildEloSystemPrompt_({
    memoriesSummary: "- [pessoa; importancia alta] Minha mae se chama Maria."
  });

  assert.match(prompt, /Contexto salvo sobre a pessoa/i);
  assert.match(prompt, /Minha mae se chama Maria/i);
  assert.match(prompt, /sem repetir 'segundo minha memoria'/i);
});

test("prompt mestre do Elo inclui contexto relevante recuperado por vetor", () => {
  const prompt = buildEloSystemPrompt_({
    relevantMemoriesSummary: "- [projeto; score 0.42] Stock IA organiza almoxarifado e controle de materiais."
  });

  assert.match(prompt, /Contexto relevante recuperado/i);
  assert.match(prompt, /Stock IA organiza almoxarifado/i);
});

test("prompt mestre do Elo inclui conteudo de documento anexado", () => {
  const prompt = buildEloSystemPrompt_({
    documentsSummary: "Documento 1: contrato.txt\nTrecho extraido:\nPrazo de entrega: 30 dias."
  });

  assert.match(prompt, /documentos anexados/i);
  assert.match(prompt, /contrato\.txt/i);
  assert.match(prompt, /Prazo de entrega: 30 dias/i);
  assert.match(prompt, /Não invente informação/i);
});

test("memoria vetorial recupera contexto por significado", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "stock-ia",
    text: "Meu projeto principal e o Stock IA para controlar almoxarifado, materiais e entradas de obra.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "familia",
    text: "Minha mae se chama Maria e gosta de conversar com calma.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const summary = await searchEloRelevantMemories_(store, "Como esta aquela ideia do estoque?", "elo_dev_usuario_a");

  assert.match(summary, /Stock IA/i);
  assert.doesNotMatch(summary.split("\n")[0], /Maria/i);
});

test("memoria vetorial fica isolada por deviceId", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "mae-maria",
    text: "Minha mae se chama Maria.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const userA = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_a");
  const userB = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_b");
  const noDevice = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "");

  assert.match(userA, /Maria/i);
  assert.doesNotMatch(userB, /Maria/i);
  assert.equal(noDevice, "");
});

test("endpoint de memoria vetorial salva item local", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "memoria-teste",
      text: "Controle de estoque da obra com materiais e almoxarifado.",
      category: "projeto"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, "local_vector");
  assert.equal(data.item.id, "memoria-teste");
  assert.equal(data.item.embeddingProvider, "local");
  assert.equal(data.item.embeddingModel, "local-hash-96");
  assert.equal(data.item.embeddingDimensions, 96);
  assert.equal(data.item.schemaVersion, 2);
});

test("memoria vetorial usa embedding real mockado com OPENAI_API_KEY", async () => {
  const originalFetch = globalThis.fetch;
  let embeddingPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      embeddingPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_openai_embedding",
      id: "openai-memoria",
      text: "Memoria com embedding real mockado.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 3);
    assert.equal(item.schemaVersion, 2);
    assert.equal(embeddingPayload.model, "text-embedding-3-small");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial usa fallback local quando embedding real falha", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_embedding_fallback",
      id: "fallback-memoria",
      text: "Controle de estoque com fallback local.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "local");
    assert.equal(item.embeddingModel, "local-hash-96");
    assert.equal(item.embeddingDimensions, 96);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial nao mistura vetores incompatíveis", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      },
      initialState: {
        items: [
          {
            ownerId: "elo_dev_dimensoes",
            id: "local-antigo",
            text: "Memoria local antiga sobre estoque.",
            category: "projeto",
            embedding: new Array(96).fill(0.1),
            embeddingProvider: "local",
            embeddingModel: "local-hash-96",
            embeddingDimensions: 96,
            schemaVersion: 1
          }
        ]
      }
    });
    const items = await store.search("estoque", "elo_dev_dimensoes", 5);

    assert.equal(items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reindexacao segura converte memoria local para OpenAI", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_reindex",
      id: "memoria-local",
      text: "Memoria antiga sobre contrato e prazo.",
      category: "projeto",
      source: "elo",
      createdAt: "2026-06-01T00:00:00.000Z",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.ok, true);
    assert.equal(result.candidates, 1);
    assert.equal(result.reindexed, 1);
    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 1536);
    assert.equal(item.embedding.length, 1536);
    assert.equal(item.schemaVersion, 2);
    assert.equal(item.reindexedAt, "2026-06-03T10:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura preserva campos essenciais da memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_preserva",
      deviceId: "elo_dev_preserva",
      id: "memoria-preservada",
      text: "Memoria antiga com dados preservados.",
      category: "pessoa",
      type: "memory",
      source: "elo",
      fileName: "memoria.txt",
      createdAt: "2026-06-01T00:00:00.000Z",
      metadata: { fileName: "memoria.txt", origem: "teste" },
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(item.ownerId, "elo_dev_preserva");
    assert.equal(item.deviceId, "elo_dev_preserva");
    assert.equal(item.id, "memoria-preservada");
    assert.equal(item.text, "Memoria antiga com dados preservados.");
    assert.equal(item.category, "pessoa");
    assert.equal(item.type, "memory");
    assert.equal(item.source, "elo");
    assert.equal(item.fileName, "memoria.txt");
    assert.equal(item.createdAt, "2026-06-01T00:00:00.000Z");
    assert.deepEqual(item.metadata, { fileName: "memoria.txt", origem: "teste" });
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura cria backup antes de alterar memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_backup",
      id: "memoria-backup",
      text: "Memoria antiga que exige backup.",
      category: "projeto",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const backup = readJsonFile_(result.backupPath);

    assert.equal(result.backupCreated, true);
    assert.equal(existsSync(result.backupPath), true);
    assert.equal(backup.items[0].embeddingProvider, "local");
    assert.equal(backup.items[0].embeddingModel, "local-hash-96");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura mantem memoria intacta quando OpenAI falha", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  const originalItem = {
    ownerId: "elo_dev_falha",
    id: "memoria-falha",
    text: "Memoria antiga protegida contra falha.",
    category: "projeto",
    embedding: new Array(96).fill(0.1),
    embeddingProvider: "local",
    embeddingModel: "local-hash-96",
    embeddingDimensions: 96,
    schemaVersion: 1
  };
  writeEloVectorTestFile_(storePath, [originalItem]);
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.reindexed, 0);
    assert.equal(result.failed, 1);
    assert.deepEqual(item, originalItem);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura nao cria backup quando nao ha registros pendentes", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const item = {
    ownerId: "elo_dev_sem_pendencia",
    id: "memoria-openai",
    text: "Memoria ja indexada com OpenAI.",
    category: "projeto",
    embedding: new Array(1536).fill(0.01),
    embeddingProvider: "openai",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    schemaVersion: 2
  };
  writeEloVectorTestFile_(storePath, [item]);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });

    assert.equal(result.candidates, 0);
    assert.equal(result.reindexed, 0);
    assert.equal(result.backupCreated, false);
    assert.deepEqual(readJsonFile_(storePath).items[0], item);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("elo chat com anexo txt indexa documento sem quebrar fallback", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, resuma este documento",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_teste"
    },
    files: [
      {
        name: "contrato.txt",
        type: "text/plain",
        content: "Contrato de obra. Prazo de entrega: 30 dias. Pagamento em duas parcelas."
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega do contrato?", "elo_dev_doc_teste");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.answer, /extrair texto do anexo/i);
  assert.match(data.answer, /contrato\.txt/i);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("documento anexado preserva chunk maior que 800 caracteres na memoria vetorial", async () => {
  const longText = "Contrato longo do Elo. " + "Clausula tecnica preservada para indexacao sem corte prematuro. ".repeat(18);
  const response = await postEloChatMultipart_({
    message: "Elo, leia este documento longo",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_longo"
    },
    files: [
      {
        name: "contrato-longo.txt",
        type: "text/plain",
        content: longText
      }
    ]
  });
  const data = await response.json();
  const indexedChunk = eloVectorMemoryStore.list().find((item) => item.ownerId === "elo_dev_doc_longo" && item.source === "upload_elo");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(indexedChunk);
  assert.ok(indexedChunk.text.length > 800);
  assert.match(indexedChunk.text, /Clausula tecnica preservada/i);
});

test("elo chat com pdf vazio ou sem texto retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_teste"
    },
    files: [
      {
        name: "vazio.pdf",
        type: "application/pdf",
        content: "%PDF-1.4\n%%EOF"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(Array.isArray(data.attachmentErrors));
  assert.match(data.attachmentErrors.join("\n"), /PDF pode estar escaneado|texto extraivel|corrompido/i);
});

test("elo chat com pdf corrompido retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_corrompido"
    },
    files: [
      {
        name: "corrompido.pdf",
        type: "application/pdf",
        content: "isto nao e um pdf valido"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.attachmentErrors.join("\n"), /corrompido|texto extraivel|Nao consegui ler/i);
});

test("elo chat com pdf valido extrai e indexa texto", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, qual e o prazo deste PDF?",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_valido"
    },
    files: [
      {
        name: "contrato-valido.pdf",
        type: "application/pdf",
        content: tinyPdfBuffer_()
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega?", "elo_dev_pdf_valido");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("upload acima do limite retorna JSON amigavel", async () => {
  await withTemporaryEloServer_({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      ELO_MAX_UPLOAD_BYTES: "100",
      ELO_MAX_ATTACHMENT_BYTES: "50"
    }
  }, async (url) => {
    const response = await postEloChatMultipartTo_(url, {
      message: "Elo, leia este anexo",
      context: {
        source: "elo",
        mode: "standalone",
        deviceId: "elo_dev_limite"
      },
      files: [
        {
          name: "grande.txt",
          type: "text/plain",
          content: "x".repeat(400)
        }
      ]
    });
    const data = await response.json();

    assert.equal(response.status, 413);
    assert.equal(data.fallback, true);
    assert.match(data.answer, /excede o limite|grande demais/i);
    assert.match(data.attachmentErrors.join("\n"), /grande demais/i);
  });
});

test("falha da OpenAI preserva attachmentErrors", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, leia este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_openai_falha"
        },
        files: [
          {
            name: "corrompido.pdf",
            type: "application/pdf",
            content: "pdf invalido"
          }
        ]
      });
      const data = await response.json();

      assert.equal(response.status, 502);
      assert.equal(data.fallback, true);
      assert.match(data.attachmentErrors.join("\n"), /Nao consegui ler|corrompido|texto extraivel/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("payload enviado ao LLM contem resumo do documento", async () => {
  const originalFetch = globalThis.fetch;
  let openAiPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      openAiPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "O documento anexado informa prazo de entrega de 30 dias." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, resuma este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_payload_pdf"
        },
        files: [
          {
            name: "contrato-valido.pdf",
            type: "application/pdf",
            content: tinyPdfBuffer_()
          }
        ]
      });
      const data = await response.json();
      const payloadText = JSON.stringify(openAiPayload);

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.match(data.answer, /30 dias/i);
      assert.match(payloadText, /Prazo de entrega: 30 dias/i);
      assert.match(payloadText, /contrato-valido\.pdf/i);
      assert.match(payloadText, /Mensagem original do usuário/i);
      assert.match(payloadText, /Mensagem interpretada/i);
      assert.match(payloadText, /Intenção detectada/i);
      assert.match(payloadText, /summary/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo 2.0 monta contexto mestre antes do LLM", async () => {
  const originalFetch = globalThis.fetch;
  let openAiPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      openAiPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Resposta contextual sobre o Elo com memória e biblioteca relevantes." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const storeResponse = await fetch(url + "/api/elo/vector-memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:5500"
        },
        body: JSON.stringify({
          deviceId: "elo_dev_contextual_endpoint",
          memory: {
            id: "elo_pref_curta",
            text: "Prefiro respostas curtas no Elo durante a unificacao da arquitetura.",
            category: "preferencia"
          }
        })
      });
      assert.equal(storeResponse.status, 200);

      const longHistory = [
        { role: "user", content: "Estou unificando o cérebro oficial do Elo." },
        { role: "assistant", content: "Vamos manter o backend como cérebro." },
        { role: "user", content: "Lembre que prefiro respostas curtas." },
        { role: "assistant", content: "Certo." },
        { role: "user", content: "Também quero biblioteca relevante." },
        { role: "assistant", content: "Vou considerar isso." },
        { role: "user", content: "O Stock Saúde fica para depois." },
        { role: "assistant", content: "Entendido." },
        { role: "user", content: "Agora fale do Elo." }
      ];
      const response = await fetch(url + "/api/elo/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:5500"
        },
        body: JSON.stringify({
          message: "resuma o plano do Elo 2.0",
          history: longHistory,
          eloContext: "geral",
          context: {
            source: "elo",
            mode: "standalone",
            eloContext: "geral",
            deviceId: "elo_dev_contextual_endpoint",
            librarySummary: "- Elo 2.0: classificador, memoria relevante, biblioteca e contexto mestre.\n- Stock Saude: lote e validade."
          }
        })
      });
      const data = await response.json();
      const promptText = JSON.stringify(openAiPayload.input);

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.eloIntent.primary, "resumo");
      assert.match(promptText, /Classificacao de intencao do pedido/i);
      assert.match(promptText, /Historico inteligente resumido/i);
      assert.match(promptText, /usuario trabalha no projeto Elo/i);
      assert.match(promptText, /Contexto relevante recuperado/i);
      assert.match(promptText, /Prefiro respostas curtas/i);
      assert.match(promptText, /Biblioteca relevante recuperada/i);
      assert.match(promptText, /Elo 2\.0: classificador/i);
      assert.doesNotMatch(promptText, /Stock Saude: lote e validade/i);
      assert.equal(data.contextSummary.hasRelevantMemory, true);
      assert.equal(data.contextSummary.hasRelevantLibrary, true);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo injeta trava tecnica para quantitativos de obra", async () => {
  const payload = {
    message: "parede de bloco cerâmico 10m x 2,5m, chapisco, emboço e reboco",
    history: [],
    context: {
      source: "elo",
      mode: "standalone",
      eloContext: "obras"
    }
  };
  payload.eloIntent = detectEloIntent_(payload.message, payload.context, payload.history);

  const relevantContext = await getEloRelevantContext_({
    payload,
    memoryStore: { search: async () => [] }
  });
  const prompt = buildEloSystemPrompt_(Object.assign({}, payload.context, relevantContext.context));

  assert.match(prompt, /\[TRAVA TECNICA PARA QUANTITATIVOS DE OBRA\]/i);
  assert.match(prompt, /dimensão real do bloco cerâmico/i);
  assert.doesNotMatch(prompt, /\[BASE TECNICA DE COMPOSICOES|\[PREVISAO DEMONSTRATIVA DE CONSUMO/i);
  assert.doesNotMatch(prompt, /60\s*blocos?\s*\/?\s*m[²2]/i);
});

test("endpoint do Elo injeta conhecimento permanente do projeto citado", async () => {
  const originalFetch = globalThis.fetch;
  let openAiPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      openAiPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "O CADISTA começa pelo gerador procedural, com terreno, recuos, setorizacao e validacao antes de PDF e DXF." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await fetch(url + "/api/elo/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://127.0.0.1:5500"
        },
        body: JSON.stringify({
          message: "resuma nosso plano do CADISTA",
          history: [],
          context: {
            source: "elo",
            mode: "standalone",
            eloContext: "geral"
          }
        })
      });
      const data = await response.json();
      const promptText = JSON.stringify(openAiPayload.input);

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.match(promptText, /Conhecimento permanente dos projetos do usuario/i);
      assert.match(promptText, /CADISTA/i);
      assert.match(promptText, /terreno -> recuos -> ocupacao -> orientacao solar/i);
      assert.match(promptText, /Conhecimento permanente dos projetos.*CADISTA/s);
      assert.doesNotMatch(promptText, /Stock Saude: lote e validade/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo injeta previsao de consumo apenas no contexto obras", async () => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      prompts.push(payload.input[0].content);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Resposta contextual do Elo." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const obrasResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria. Autorizo estimativa preliminar NÃO OFICIAL.",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_obras_composicao"
        },
        eloContext: "obras"
      });
      const saudeResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria. Autorizo estimativa preliminar NÃO OFICIAL.",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_saude_sem_composicao"
        },
        eloContext: "saude"
      });
      const geralResponse = await postEloChatMultipartTo_(url, {
        message: "Vou executar 250 m2 de alvenaria. Autorizo estimativa preliminar NÃO OFICIAL.",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_geral_sem_composicao"
        },
        eloContext: "geral"
      });

      assert.equal(obrasResponse.status, 200);
      assert.equal(saudeResponse.status, 200);
      assert.equal(geralResponse.status, 200);
      const obrasData = await obrasResponse.clone().json();
      const saudeData = await saudeResponse.clone().json();
      const geralData = await geralResponse.clone().json();
      assert.match(prompts[0], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.match(prompts[0], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.match(prompts[0], /Alvenaria de vedacao/i);
      assert.match(prompts[0], /Bloco ceramico: 6\.750 un/i);
      assert.match(prompts[0], /pendente_confirmacao/i);
      assert.equal(obrasData.stockIaLaunchPlan.status, "pendente_confirmacao");
      assert.equal(obrasData.stockIaLaunchPlan.tipo, "previsao_consumo");
      assert.equal(obrasData.stockIaLaunchPlan.origem, "elo_obras");
      assert.equal(obrasData.stockIaLaunchPlan.itens[0].nome, "Bloco ceramico");
      assert.equal(obrasData.stockIaLaunchPlan.itens[0].origemCalculo, "coeficiente_demonstrativo");
      assert.doesNotMatch(prompts[1], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[1], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(saudeData.stockIaLaunchPlan, null);
      assert.doesNotMatch(prompts[2], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[2], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(geralData.stockIaLaunchPlan, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("endpoint do Elo prioriza auditoria previsto x real no contexto obras", async () => {
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      prompts.push(payload.input[0].content);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "Auditoria contextual do Elo." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const obrasResponse = await postEloChatMultipartTo_(url, {
        message: "Previsto 6750 blocos, consumido 8900 blocos",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_obras_auditoria"
        },
        eloContext: "obras"
      });
      const saudeResponse = await postEloChatMultipartTo_(url, {
        message: "Previsto 6750 blocos, consumido 8900 blocos",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_saude_sem_auditoria"
        },
        eloContext: "saude"
      });

      assert.equal(obrasResponse.status, 200);
      assert.equal(saudeResponse.status, 200);
      const obrasData = await obrasResponse.clone().json();
      assert.match(prompts[0], /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
      assert.match(prompts[0], /Status: critico/i);
      assert.doesNotMatch(prompts[1], /\[AUDITORIA DEMONSTRATIVA PREVISTO X REAL\]/i);
      assert.doesNotMatch(prompts[0], /\[PREVISAO DEMONSTRATIVA DE CONSUMO\]/i);
      assert.doesNotMatch(prompts[0], /\[PLANO DE LANCAMENTO NO STOCK IA\]/i);
      assert.equal(obrasData.stockIaLaunchPlan, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontend do Elo nao expoe chave OpenAI", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    new URL("../../elo.html", import.meta.url),
    new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url),
    new URL("../../relatorio-qualidade-obras/relatorio-config.js", import.meta.url)
  ];
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));

  contents.forEach((content) => {
    assert.doesNotMatch(content, /OPENAI_API_KEY/);
    assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  });
});

test("frontend do Elo reconhece attachmentErrors em resposta online", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /attachmentErrors/);
  assert.match(content, /formatEloAttachmentErrors_/);
  assert.match(content, /data && Array\.isArray\(data\.attachmentErrors\)/);
  assert.match(content, /data && data\.fallback && data\.answer/);
});

test("frontend do Elo envia eloContext no JSON e multipart", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /function getEloContext\(\)/);
  assert.match(content, /eloContext: eloContext/);
  assert.match(content, /formData\.append\("eloContext", payload\.eloContext\)/);
  assert.match(content, /stock-saude/);
  assert.match(content, /stock-ai/);
});

test("frontend do Elo chama endpoint oficial antes dos handlers legados", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const askStart = content.indexOf("function askElo");
  const firstOnlineCall = content.indexOf("requestEloOnlineAnswer(cleanQuestion", askStart);
  const fallbackStart = content.indexOf("function buildEloLocalFallbackResponseForQuestion_");
  const fallbackEnd = content.indexOf("function buildProductAttachmentControls", fallbackStart);

  assert.ok(askStart > 0);
  assert.ok(firstOnlineCall > askStart);
  assert.ok(fallbackStart > firstOnlineCall);

  const askBeforeFallback = content.slice(askStart, fallbackStart);
  assert.doesNotMatch(askBeforeFallback, /buildEloStockBalanceAnswer_/);
  assert.doesNotMatch(askBeforeFallback, /buildEloOperationalConstructionAnswer_/);
  assert.doesNotMatch(askBeforeFallback, /applyEloCommunicationLayer\(cleanQuestion/);
  assert.doesNotMatch(askBeforeFallback, /buildResponse\(cleanQuestion\)/);

  const fallbackBlock = content.slice(fallbackStart, fallbackEnd);
  assert.match(fallbackBlock, /buildEloStockBalanceAnswer_/);
  assert.match(fallbackBlock, /buildEloOperationalConstructionAnswer_/);
  assert.match(fallbackBlock, /applyEloCommunicationLayer\(question, buildResponse\(question\)\)/);
});

test("frontend do Elo nao usa fallback local para conhecimento institucional", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const guardStart = content.indexOf("function isEloOfficialProjectQuestion_");
  const fallbackStart = content.indexOf("function buildEloLocalFallbackResponseForQuestion_");
  const fallbackEnd = content.indexOf("function buildProductAttachmentControls", fallbackStart);
  const fallbackBlock = content.slice(fallbackStart, fallbackEnd);

  assert.ok(guardStart > 0);
  assert.match(content.slice(guardStart, fallbackStart), /cadista/);
  assert.match(content.slice(guardStart, fallbackStart), /stock full/);
  assert.match(content.slice(guardStart, fallbackStart), /stock saude/);
  assert.match(content.slice(guardStart, fallbackStart), /obrareport/);
  assert.match(content.slice(guardStart, fallbackStart), /elo informe/);
  assert.match(fallbackBlock, /isEloOfficialProjectQuestion_\(question\)/);
  assert.match(fallbackBlock, /buildEloOnlineUnavailableResponse_\(\)/);
  assert.equal(fallbackBlock.indexOf("isEloOfficialProjectQuestion_(question)") < fallbackBlock.indexOf("buildResponse(question)"), true);
  assert.match(content, /Não consegui consultar o Elo online neste momento\./);
});

test("frontend do Elo registra plano Stock IA apenas como planejamento local", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /obraReport\.stockIa\.plannedConsumptions/);
  assert.match(content, /tryConfirmPendingStockIaPlan/);
  assert.match(content, /saveStockIaPlannedConsumption/);
  assert.match(content, /status: "planejado"/);
  assert.match(content, /Nenhum saldo de estoque foi alterado/);
  assert.doesNotMatch(content, /fetch\([^)]*stock-demo/i);
  assert.doesNotMatch(content, /approval-requests/i);
});

test("paginas reais do Elo carregam assistente com cache-buster da correcao", async () => {
  const { readFile } = await import("node:fs/promises");
  const pages = await Promise.all([
    readFile(new URL("../../elo.html", import.meta.url), "utf8"),
    readFile(new URL("../../stock-ai-obras.html", import.meta.url), "utf8"),
    readFile(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.html", import.meta.url), "utf8")
  ]);

  pages.forEach((content) => {
    assert.match(content, /elo-assistente\.js\?v=20260624-public-flow-v19/);
    assert.doesNotMatch(content, /<script src="(?:relatorio-qualidade-obras\/)?elo-assistente\.js"><\/script>/);
  });
});

test("Elo standalone carrega motor Stock AI antes do assistente", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../elo.html", import.meta.url), "utf8");
  const stockEngineIndex = content.indexOf("relatorio-qualidade-obras/stock-ai-composition-engine.js");
  const eloAssistantIndex = content.indexOf("relatorio-qualidade-obras/elo-assistente.js");

  assert.ok(stockEngineIndex > 0);
  assert.ok(eloAssistantIndex > stockEngineIndex);
});

test("validador tecnico compartilhado cobre entradas de Stock e Elo", () => {
  const validator = loadEloTechnicalValidatorSandbox_();

  const concrete = validator.validateTechnicalQuestion("calcule concreto para laje 20 m² com 8 cm", { entry: "elo_principal" });
  const missingBlock = validator.validateTechnicalQuestion("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.", { entry: "stock_obras" });
  const missingOpenings = validator.validateTechnicalQuestion("Quero fazer uma parede de bloco baiano 14x19x39 com 2,80 m de altura e 20 m de comprimento.", { entry: "stock_obras" });
  const missingBase = validator.validateTechnicalQuestion("Faça o orçamento de uma parede de bloco baiano 14x19x39 com 2,80 m de altura e 20 m de comprimento, sem portas, sem janelas, perda de 10%, revestimento dos dois lados, espessura 2 cm.", { entry: "stock_full" });
  const authorized = validator.validateTechnicalQuestion("Tenho concreto de 2 m3 FCK 20 MPa. Autorizo estimativa preliminar NÃO OFICIAL.", { entry: "stock_ia" });

  assert.match(concrete.answer, /FCK do concreto/);
  assert.match(missingBlock.answer, /dimensão real do bloco cerâmico/);
  assert.match(missingOpenings.answer, /A parede terá portas ou janelas/);
  assert.match(missingBase.answer, /Base técnica utilizada: composição técnica não localizada/);
  assert.match(missingBase.answer, /Premissas utilizadas:/);
  assert.equal(authorized.allowed, true);
  assert.equal(authorized.shouldRespond, false);
  assert.equal(authorized.kind, "preliminary_authorized");
});

test("validador tecnico compartilhado cobre pavimentacao e pintura do dia a dia", () => {
  const validator = loadEloTechnicalValidatorSandbox_();

  const pavementNoArea = validator.validateTechnicalQuestion("Quero fazer piso intertravado", { entry: "elo_principal" });
  const pavementNoJoint = validator.validateTechnicalQuestion("Quero fazer piso intertravado em 30 m²", { entry: "stock_obras" });
  const pavementNoPiece = validator.validateTechnicalQuestion("Piso intertravado 30 m², junta 5 mm", { entry: "stock_obras" });
  const pavementInformal = validator.validateTechnicalQuestion("Quero colocar intertravado na garagem 5x5.", { entry: "stock_obras" });
  const cobblestone = validator.validateTechnicalQuestion("Quero calçar 80 m² com paralelepípedo", { entry: "stock_full" });
  const paintingNoArea = validator.validateTechnicalQuestion("Quero pintar uma parede", { entry: "elo_principal" });
  const paintingNoEnvironment = validator.validateTechnicalQuestion("Quero pintar 50 m² de parede", { entry: "backend" });
  const paintingInformal = validator.validateTechnicalQuestion("Pinta uma casa de 120 m² quanto custa?", { entry: "backend" });
  const paintingNoSystem = validator.validateTechnicalQuestion("Quero pintar 50 m² de parede interna", { entry: "backend" });
  const paintingMissingBase = validator.validateTechnicalQuestion("Pintura interna 50 m², reboco novo, selador + 2 demãos de tinta acrílica", { entry: "stock_ia" });
  const preliminary = validator.validateTechnicalQuestion("Autorizo estimativa NÃO OFICIAL para pintura interna 50 m², reboco novo, selador + 2 demãos de tinta acrílica", { entry: "stock_ia" });

  assert.match(pavementNoArea.answer, /dimensões do piso ou da área total/);
  assert.match(pavementNoJoint.answer, /largura da junta/);
  assert.match(pavementNoPiece.answer, /dimensão da peça/);
  assert.match(pavementInformal.answer, /largura da junta/);
  assert.match(cobblestone.answer, new RegExp("largura da junta|base/assentamento"));
  assert.match(paintingNoArea.answer, /área ou das dimensões/);
  assert.match(paintingNoEnvironment.answer, /interna ou externa/);
  assert.match(paintingInformal.answer, /interna ou externa/);
  assert.match(paintingNoSystem.answer, /Qual sistema deseja considerar/);
  assert.match(paintingMissingBase.answer, /Para calcular pintura com segurança/);
  assert.match(paintingMissingBase.answer, /Base técnica utilizada: composição técnica não localizada/);
  assert.match(paintingMissingBase.answer, /Premissas utilizadas:/);
  assert.match(paintingMissingBase.answer, /Área considerada: 50,00 m²/);
  assert.doesNotMatch(paintingMissingBase.answer, /litros|latas|mão de obra|R$/i);
  assert.equal(preliminary.allowed, true);
  assert.equal(preliminary.shouldRespond, false);
  assert.equal(preliminary.kind, "preliminary_authorized");
  assert.equal(preliminary.preliminary, true);
});

test("validador tecnico alinha respostas de piso e pintura em todas as entradas", () => {
  const validator = loadEloTechnicalValidatorSandbox_();
  const entries = [
    "elo_principal",
    "widget_elo",
    "stock_obras",
    "stock_full_stock_ia_chat",
    "backend_api_elo_chat",
    "elo_projeto_api_elo_chat"
  ];
  const prompts = [
    ["Quero colocar intertravado na garagem 5x5", /largura da junta/],
    ["Quanto de tinta compro para 50 m²?", /interna ou externa/],
    ["Pintura interna 80 m² com massa corrida", /número de demãos|sistema/i],
    ["Piso intertravado 30 m² junta 5 mm", /dimensão da peça/],
    ["Pintura externa muro 40 m², selador + 2 demãos de tinta acrílica", /Base técnica utilizada: composição técnica não localizada/]
  ];

  entries.forEach((entry) => {
    prompts.forEach(([prompt, expected]) => {
      const validation = validator.validateTechnicalQuestion(prompt, { entry });
      assert.equal(validation.shouldRespond, true, entry + " :: " + prompt);
      assert.match(validation.answer, expected, entry + " :: " + prompt);
      assert.doesNotMatch(validation.answer, /litros|latas|R$|consumo estimado/i, entry + " :: " + prompt);
    });
  });
});

test("Stock Obras usa o validador comum para piso e pintura antes do motor local", () => {
  const sandbox = loadStockAiCompositionSandbox_();
  const engine = sandbox.window.StockAiCompositionEngine;

  assert.match(engine.buildAnswerFromMessage("Quero colocar intertravado na garagem 5x5", { entry: "stock_obras" }), /largura da junta/);
  assert.match(engine.buildAnswerFromMessage("Quanto de tinta compro para 50 m²?", { entry: "stock_obras" }), /interna ou externa/);
  assert.match(engine.buildAnswerFromMessage("Pintura interna 80 m² com massa corrida", { entry: "stock_obras" }), /número de demãos|sistema/i);
  assert.match(engine.buildAnswerFromMessage("Piso intertravado 30 m² junta 5 mm", { entry: "stock_obras" }), /dimensão da peça/);
  const blocked = engine.buildAnswerFromMessage("Pintura externa muro 40 m², selador + 2 demãos de tinta acrílica", { entry: "stock_obras" });
  assert.match(blocked, /Base técnica utilizada: composição técnica não localizada/);
  assert.match(blocked, /Premissas utilizadas:/);
  assert.doesNotMatch(blocked, /litros|latas|R$|consumo estimado/i);
});

test("backend e Elo Projeto via api elo chat aplicam o mesmo validador de piso e pintura", async () => {
  await withTemporaryEloServer_({
    env: {
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500"
    }
  }, async (url) => {
    const contexts = [
      { source: "elo", mode: "standalone", eloContext: "obras" },
      { source: "elo-projeto", mode: "standalone", eloContext: "obras" }
    ];
    const prompts = [
      ["Quero colocar intertravado na garagem 5x5", /largura da junta/],
      ["Quanto de tinta compro para 50 m²?", /interna ou externa/],
      ["Pintura interna 80 m² com massa corrida", /número de demãos|sistema/i],
      ["Piso intertravado 30 m² junta 5 mm", /dimensão da peça/],
      ["Pintura externa muro 40 m², selador + 2 demãos de tinta acrílica", /Base técnica utilizada: composição técnica não localizada/]
    ];

    for (const context of contexts) {
      for (const [message, expected] of prompts) {
        const response = await fetch(url + "/api/elo/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://127.0.0.1:5500"
          },
          body: JSON.stringify({ message, history: [], context })
        });
        const data = await response.json();
        assert.equal(response.status, 200, context.source + " :: " + message);
        assert.equal(data.mode, "technical_validation", context.source + " :: " + message);
        assert.match(data.answer, expected, context.source + " :: " + message);
        assert.doesNotMatch(data.answer, /litros|latas|R$|consumo estimado/i, context.source + " :: " + message);
      }
    }
  });
});

test("paginas do Elo carregam validador tecnico antes dos motores", async () => {
  const { readFile } = await import("node:fs/promises");
  const pages = await Promise.all([
    readFile(new URL("../../elo.html", import.meta.url), "utf8"),
    readFile(new URL("../../stock-ai-obras.html", import.meta.url), "utf8"),
    readFile(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.html", import.meta.url), "utf8")
  ]);

  pages.forEach((content) => {
    const validatorIndex = content.indexOf("elo-technical-validator.js");
    const stockEngineIndex = content.indexOf("stock-ai-composition-engine.js");
    const eloAssistantIndex = content.indexOf("elo-assistente.js");

    assert.ok(validatorIndex > 0);
    assert.ok(stockEngineIndex > validatorIndex);
    assert.ok(eloAssistantIndex > validatorIndex);
  });
});
test("Elo operacional bloqueia quantitativo sem composicao tecnica", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho 14 pilares 20x30 com 3m. Posso executar?");

  assert.equal(response.sessionTheme, "base_tecnica_quantitativo");
  assert.match(response.fullAnswer, /Para gerar quantitativo, mão de obra ou valor com segurança/);
  assert.match(response.fullAnswer, /SINAPI ou ORSE/);
  assert.doesNotMatch(response.fullAnswer, /Aco CA-50: 251,37 kg/i);
});
test("Elo pre-validador pede premissas obrigatorias antes da base tecnica", async () => {
  const concreteSandbox = await loadEloOperationalSandbox_([]);
  const blockSandbox = await loadEloOperationalSandbox_([]);
  const coatingSandbox = await loadEloOperationalSandbox_([]);

  const concrete = concreteSandbox.window.EloAssistente.buildPremiseQuestionForTest("calcule concreto para laje 20 m² com 8 cm");
  const block = blockSandbox.window.EloAssistente.buildPremiseQuestionForTest("calcule parede 8x3 com reboco nos dois lados, sem portas e sem janelas, perda 8%");
  const coating = coatingSandbox.window.EloAssistente.buildPremiseQuestionForTest("calcule reboco de 50 m²");

  assert.match(concrete.fullAnswer, /preciso confirmar o FCK do concreto/);
  assert.match(block.fullAnswer, /dimens.o do bloco|dimens.o real do bloco|medida real do bloco cer.mico|bloco cer/i);
  assert.match(coating.fullAnswer, /um lado ou nos dois lados da parede/);
});
test("Elo coleta premissas de parede em mensagens sequenciais antes de buscar composicao", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Bloco 14x19x39, sem portas, sem janelas, perda de 10%, revestimento dos dois lados.");

  assert.match(first.shortAnswer, /Antes de calcular, preciso completar o briefing técnico da parede/);
  assert.match(first.fullAnswer, /Qual a dimensão do bloco/);
  assert.match(first.fullAnswer, /Área bruta: 56,00 m²/);
  assert.match(first.fullAnswer, /Base técnica utilizada/);
  assert.match(first.fullAnswer, /Geometria informada pelo usuário/);
  assert.match(second.fullAnswer, /Briefing técnico consolidado/);
  assert.match(second.fullAnswer, /Base técnica utilizada: não localizada/);
  assert.match(second.fullAnswer, /Premissas utilizadas:/);
  assert.match(second.fullAnswer, /Comprimento da parede: 20,00 m/);
  assert.match(second.fullAnswer, /Altura da parede: 2,80 m/);
  assert.match(second.fullAnswer, /Área bruta: 56,00 m²/);
  assert.match(second.fullAnswer, /Vãos descontados: nenhum/);
  assert.match(second.fullAnswer, /Área líquida considerada: 56,00 m²/);
  assert.doesNotMatch(second.fullAnswer, /Dimensões consideradas:/);
  assert.doesNotMatch(second.fullAnswer, /Di.rio de Obras|RDO|materiais consumidos/i);
  assert.match(second.fullAnswer, /Bloco considerado: 14x19x39/);
  assert.match(second.fullAnswer, /Perda adotada: 10%/);
  assert.doesNotMatch(second.fullAnswer, /Cimento|Areia|Bloco ceramico: \d/i);
});
function importOfficialCompositionRows_(sandbox, rows) {
  const result = sandbox.window.StockAiCompositionEngine.importOfficialBase({ rows });
  assert.equal(result.ok, true, (result.errors || []).join("; "));
  assert.ok(result.catalogSize >= 1);
  return result;
}

function officialAlvenariaRows_() {
  return [
    {
      source: "SINAPI",
      state: "BA",
      referenceMonth: "2026-06",
      compositionCode: "SINAPI-ALV-ELO",
      compositionName: "Alvenaria de vedacao com bloco ceramico 14x19x29 cm",
      compositionUnit: "m2",
      serviceType: "alvenaria",
      inputCode: "INS-ALV-001",
      inputName: "Bloco ceramico 14x19x29 cm",
      inputUnit: "un",
      coefficient: 13.5
    },
    {
      source: "SINAPI",
      state: "BA",
      referenceMonth: "2026-06",
      compositionCode: "SINAPI-ALV-ELO",
      compositionName: "Alvenaria de vedacao com bloco ceramico 14x19x29 cm",
      compositionUnit: "m2",
      serviceType: "alvenaria",
      inputCode: "INS-ALV-002",
      inputName: "Argamassa de assentamento oficial",
      inputUnit: "m3",
      coefficient: 0.012
    }
  ];
}

function officialChapiscoRows_() {
  return [
    {
      source: "SINAPI",
      state: "BA",
      referenceMonth: "2026-06",
      compositionCode: "SINAPI-CHAP-ELO",
      compositionName: "Chapisco aplicado em alvenaria e estrutura de concreto em parede interna",
      compositionUnit: "m2",
      serviceType: "chapisco",
      inputCode: "INS-CHAP-001",
      inputName: "Argamassa para chapisco oficial",
      inputUnit: "m3",
      coefficient: 0.0042
    },
    {
      source: "SINAPI",
      state: "BA",
      referenceMonth: "2026-06",
      compositionCode: "SINAPI-CHAP-ELO",
      compositionName: "Chapisco aplicado em alvenaria e estrutura de concreto em parede interna",
      compositionUnit: "m2",
      serviceType: "chapisco",
      inputCode: "INS-CHAP-002",
      inputName: "Pedreiro oficial",
      inputUnit: "h",
      coefficient: 0.1
    }
  ];
}

test("Elo usa composicao SINAPI importada apos briefing completo de alvenaria", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  importOfficialCompositionRows_(sandbox, officialAlvenariaRows_());

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Bloco 14x19x29, sem portas, sem janelas, perda de 10%, revestimento dos dois lados.");

  assert.match(first.fullAnswer, /Área bruta: 56,00 m²/);
  assert.match(second.fullAnswer, /composição oficial localizada/i);
  assert.match(second.fullAnswer, /Base técnica utilizada: SINAPI/);
  assert.match(second.fullAnswer, /SINAPI-ALV-ELO/);
  assert.match(second.fullAnswer, /Alvenaria de vedacao com bloco ceramico 14x19x29 cm/);
  assert.match(second.fullAnswer, /Premissas utilizadas:/);
  assert.match(second.fullAnswer, /Área líquida considerada: 56,00 m²/);
  assert.match(second.fullAnswer, /Memória de cálculo:/);
  assert.match(second.fullAnswer, /Consumo calculado pelo motor Stock Obras:/);
  assert.doesNotMatch(second.fullAnswer, /Base técnica utilizada: não localizada/);
  assert.doesNotMatch(second.fullAnswer, /266,00 m²|266 m²/);
});

test("Elo usa composicao SINAPI importada para chapisco com area", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  importOfficialCompositionRows_(sandbox, officialChapiscoRows_());

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho chapisco em parede interna com area de 50 m² em um lado. Posso executar amanhã?");

  assert.match(response.fullAnswer, /SINAPI|Fonte: SINAPI real\/importada/);
  assert.match(response.fullAnswer, /SINAPI-CHAP-ELO|Argamassa para chapisco oficial/);
  assert.doesNotMatch(response.fullAnswer, /composição técnica não localizada|base técnica não localizada/i);
});

test("Elo mantem bloqueio seguro para concreto FCK 25 sem base oficial", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho concreto FCK 25 MPa preparado em betoneira para 12 m³. Posso executar amanhã?");

  assert.match(response.fullAnswer, /composição técnica|SINAPI ou ORSE|Base técnica utilizada/i);
  assert.doesNotMatch(response.fullAnswer, /sacos de cimento|traço|cimento:s*d/i);
});

test("Stock AI nao interpreta dimensao de bloco 14x19x29 como parede 14 m x 19 m", () => {
  const sandbox = loadStockAiCompositionSandbox_();

  const parsed = sandbox.window.StockAiCompositionEngine.parseRequest("alvenaria de vedacao com bloco ceramico 14x19x29");

  assert.notEqual(parsed.geometry && parsed.geometry.quantity, 266);
  assert.doesNotMatch(parsed.answer || "", /266,00 m²|266 m²/);
});

test("Elo nao trata composicao demonstrativa como SINAPI oficial sem autorizacao", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Bloco 14x19x29, sem portas, sem janelas, perda de 10%, revestimento dos dois lados.");

  assert.match(first.fullAnswer, /Qual a dimensão do bloco/);
  assert.match(second.fullAnswer, /Base técnica utilizada: não localizada/);
  assert.match(second.fullAnswer, /autorizar explicitamente uma estimativa preliminar NÃO OFICIAL/);
  assert.doesNotMatch(second.fullAnswer, /std_alvenaria|Base tecnica demonstrativa/i);
});

test("Elo roteia perguntas tecnicas de obras antes da resposta generica", async () => {
  const prompts = [
    "Quantos blocos 14x19x29 preciso para uma parede de 20 m por 2,80 m?",
    "Tenho uma parede de 12 m por 2,80 m com uma porta 0,90x2,10 e duas janelas 1,20x1,00. Quantos blocos 14x19x29 preciso?",
    "Use SINAPI Bahia junho de 2026 para calcular 40 m² de alvenaria com bloco 14x19x29.",
    "Tenho uma residência térrea de 120 m², padrão médio, em Vitória da Conquista-BA. Gere quantitativos principais, composições SINAPI aplicáveis, equipe necessária e riscos de orçamento."
  ];

  for (const prompt of prompts) {
    const sandbox = await loadEloOperationalSandbox_([]);
    importOfficialCompositionRows_(sandbox, officialAlvenariaRows_());
    const response = sandbox.window.EloAssistente.buildResponseForTest(prompt);
    assert.doesNotMatch(response.fullAnswer, /Posso te ajudar a criar um RDO, lançar material, gerar PDF, usar o Stock IA, revisar um relatório ou organizar seu próximo passo/i);
    assert.doesNotMatch(response.fullAnswer, /fam.lia|reflex.o filos.fica|projeto de vida/i);
    assert.match(response.fullAnswer, /SINAPI|ORSE|premissas|composição|técnica|Área bruta|vãos|base técnica|obra/i);
  }
});

test("Elo continua contexto tecnico e consulta SINAPI apos premissas em pergunta direta", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  importOfficialCompositionRows_(sandbox, officialAlvenariaRows_());

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quantos blocos 14x19x29 preciso para uma parede de 20 m por 2,80 m?");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Sem portas, sem janelas, perda 0%, sem revestimento.");

  assert.match(first.fullAnswer, /Área bruta: 56,00 m²/);
  assert.match(first.fullAnswer, /vãos|perda|revestimento/i);
  assert.match(second.fullAnswer, /Base técnica utilizada: SINAPI/);
  assert.match(second.fullAnswer, /SINAPI-ALV-ELO/);
  assert.match(second.fullAnswer, /756\s*un/);
  assert.match(second.fullAnswer, /Memória de cálculo/);
});

test("Elo Nota 10A memoriza dados permanentes da obra e reutiliza em pergunta tecnica", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const saved = sandbox.window.EloAssistente.buildResponseForTest("Minha obra Residencial Alfa fica em Vitória da Conquista-BA e tem 120 m², padrão médio.");
  const response = sandbox.window.EloAssistente.buildResponseForTest("Quanto custa a alvenaria?");
  const workMemory = JSON.parse(sandbox.localStorage.getItem("elo_work_memory_v1"));

  assert.match(saved.fullAnswer, /Entendi\. Salvei na memória da obra: Residencial Alfa, Vitória da Conquista\/BA, 120,00 m², padrão médio/);
  assert.doesNotMatch(saved.fullAnswer, /Memória de cálculo|Base técnica utilizada|Alertas do auditor/);
  assert.match(response.fullAnswer, /Lembrei da obra Residencial Alfa, Vitória da Conquista\/BA, 120,00 m², padrão médio/);
  assert.match(response.fullAnswer, /completar o serviço/i);
  assert.match(response.fullAnswer, /metragem ou área da parede/i);
  assert.match(response.fullAnswer, /base SINAPI\/ORSE|composição interna validada/i);
  assert.doesNotMatch(response.fullAnswer, /Memória permanente de obra|Memória de cálculo|Alertas do auditor/);
  assert.equal(workMemory.activeProjectId, "residencial_alfa");
  assert.equal(workMemory.projects.residencial_alfa.uf, "BA");
  assert.equal(sandbox.localStorage.getItem("elo_long_term_memory_v1"), null);
});

test("Elo Nota 10A alerta produtividade sem composicao validada", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("Qual a produtividade de pedreiro e servente para executar alvenaria?");

  assert.match(response.fullAnswer, /composição validada|SINAPI\/ORSE/);
  assert.match(response.fullAnswer, /não vou tratar produtividade.*como dado oficial/i);
  assert.match(response.fullAnswer, /Sem composição, não vou tratar produtividade/);
  assert.doesNotMatch(response.fullAnswer, /SINAPI real\/importada/);
});

test("Elo Nota 10A nao aplica estrutura tecnica em conversa simples", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("oi, tudo bem?");

  assert.doesNotMatch(response.fullAnswer, /Memória de cálculo/);
  assert.doesNotMatch(response.fullAnswer, /Base técnica utilizada/);
  assert.doesNotMatch(response.fullAnswer, /Alertas do auditor/);
});
test("Elo Nota 10A organiza resposta tecnica no padrao principal calculo premissas base auditor", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("Gere orçamento oficial de uma residência de 120 m² padrão médio em Vitória da Conquista-BA.");
  const answer = response.fullAnswer;

  const order = [
    answer.indexOf("Resposta principal"),
    answer.indexOf("Memória de cálculo"),
    answer.indexOf("Premissas utilizadas"),
    answer.indexOf("Base técnica utilizada"),
    answer.indexOf("Alertas do auditor"),
    answer.indexOf("Próxima ação recomendada")
  ];
  assert.ok(order.every((index) => index >= 0));
  assert.deepEqual(order.slice().sort((a, b) => a - b), order);
});
test("Elo responde geometria de volume sem exigir SINAPI", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("Quantos m³ de concreto são necessários para uma laje maciça de 8 m x 10 m com 12 cm de espessura?");

  assert.match(response.fullAnswer, /Resposta principal/);
  assert.match(response.fullAnswer, /Volume geométrico: 9,60 m³/);
  assert.match(response.fullAnswer, /Premissas utilizadas/);
  assert.match(response.fullAnswer, /Área: 80,00 m²/);
  assert.match(response.fullAnswer, /Espessura: 12,00 cm/);
  assert.match(response.fullAnswer, /Geometria informada pelo usuário/);
  assert.match(response.fullAnswer, /FCK do concreto/);
  assert.doesNotMatch(response.fullAnswer, /Base técnica utilizada: não localizada/);
});

test("Elo responde metros lineares de rodape sem composicao", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("Quantos metros lineares de rodapé existem em um quarto de 3,50 m x 4,00 m?");

  assert.match(response.fullAnswer, /Perímetro\/metros lineares: 15,00 m/);
  assert.match(response.fullAnswer, /Cálculo: 2 x \(comprimento \+ largura\)/);
  assert.match(response.fullAnswer, /SINAPI\/ORSE não é necessária para calcular metros lineares/);
  assert.doesNotMatch(response.fullAnswer, /Base técnica utilizada: não localizada/);
});

test("Elo mostra area liquida de parede com vaos antes de buscar composicao", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("Tenho uma parede de 12 m por 2,80 m com uma porta 0,90x2,10 e duas janelas 1,20x1,00. Quantos blocos 14x19x29 preciso?");

  assert.match(response.fullAnswer, /Resposta principal/);
  assert.match(response.fullAnswer, /Área geométrica da parede: 33,60 m²/);
  assert.match(response.fullAnswer, /Área líquida considerada: 29,31 m²/);
  assert.match(response.fullAnswer, /Vãos descontados: 1 porta 0,90 x 2,10 m = 1,89 m²; 2 janelas 1,20 x 1,00 m = 2,40 m²/);
  assert.match(response.fullAnswer, /Ainda preciso confirmar:/);
  assert.match(response.fullAnswer, /perda adotada/);
  assert.match(response.fullAnswer, /revestimento/);
  assert.doesNotMatch(response.fullAnswer, /Base técnica utilizada: não localizada/);
});
test("Elo recalcula perda a partir do consumo liquido sem acumular perda base", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  sandbox.window.StockAiCompositionEngine.setExternalCompositionCatalog([{
    id: "sinapi_alvenaria_perda_teste",
    code: "SINAPI-PERDA-TESTE",
    service: "Alvenaria SINAPI com perda base",
    productionUnit: "m2",
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2026-06",
    isRealComposition: true,
    lossPercent: 5,
    inputs: [
      { name: "Bloco teste perda", quantityPerUnit: 13, unit: "un" }
    ],
    keywords: ["alvenaria", "parede", "bloco"]
  }]);

  const response = sandbox.window.EloAssistente.buildResponseForTest("PAREDE 10 X 3, bloco 14x19x29, sem portas, sem janelas, perda 10%, sem revestimento");

  assert.match(response.fullAnswer, /Base técnica utilizada: SINAPI/);
  assert.match(response.fullAnswer, /Consumo líquido: 390 un/);
  assert.match(response.fullAnswer, /Perda base da composição: 5% \| consumo com perda base: 409,5 un/);
  assert.match(response.fullAnswer, /Perda adotada: 10%/);
  assert.match(response.fullAnswer, /Consumo final: 429 un/);
  assert.doesNotMatch(response.fullAnswer, /450|450,45|450,5/);
  sandbox.window.StockAiCompositionEngine.clearExternalCompositionCatalog();
});

test("Elo publico acumula orçamento residencial em mensagens naturais", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  const standalone = sandbox.window.EloAssistente.buildResponseForTest("Quero orçamento residencial preliminar para uma casa térrea de 120 m².");
  assert.match(standalone.fullAnswer, /Vou montar um orçamento residencial preliminar/);
  assert.doesNotMatch(standalone.fullAnswer, /BRIEFING DA OBRA/);

  const first = sandbox.window.EloAssistente.buildResponseForTest("Minha obra Residencial Alfa fica em Vitória da Conquista-BA, tem 120 m² e padrão médio.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Quero orçamento residencial preliminar para uma casa térrea de 120 m².");
  const third = sandbox.window.EloAssistente.buildResponseForTest("80 m de parede com 2,80 m de altura portas e janelas 18 m²");
  const fourth = sandbox.window.EloAssistente.buildResponseForTest("8 sapatas 1,20 x 1,20 x 0,40 8 blocos 1,50 x 1,50 x 0,60 42 m de baldrame 15 x 30");

  assert.match(first.fullAnswer, /Residencial Alfa/);
  assert.doesNotMatch(first.fullAnswer, /Residencial Alfa fica/);
  assert.match(second.fullAnswer, /Residencial Alfa/);
  assert.match(second.fullAnswer, /Vitória da Conquista\/BA/);
  assert.match(second.fullAnswer, /Cliente é opcional/);
  assert.match(third.fullAnswer, /Registrei a alvenaria/);
  assert.match(third.fullAnswer, /Área bruta: 224,00 m²/);
  assert.match(third.fullAnswer, /Vãos: 18,00 m²/);
  assert.match(third.fullAnswer, /Área líquida: 206,00 m²/);
  assert.match(fourth.fullAnswer, /Registrei a fundação/);
  assert.match(fourth.fullAnswer, /8 sapatas 1,20 m x 1,20 m x 0,40 m/);
  assert.match(fourth.fullAnswer, /8 blocos 1,50 m x 1,50 m x 0,60 m/);
  assert.match(fourth.fullAnswer, /42,00 m de baldrame 15 x 30/);
  assert.match(fourth.fullAnswer, /Posso consolidar o orçamento preliminar agora/);
});

test("Elo interpreta percentual isolado como perda pendente em todas as paginas que carregam elo-assistente", async () => {
  const pages = [
    "/elo.html",
    "/stock-ai-obras.html",
    "/relatorio-qualidade-obras/relatorio-qualidade-obras.html"
  ];

  for (const pathname of pages) {
    const sandbox = await loadEloOperationalSandbox_([]);
    sandbox.location.pathname = pathname;
    const first = sandbox.window.EloAssistente.buildResponseForTest("PAREDE 10 X 3");
    const second = sandbox.window.EloAssistente.buildResponseForTest("10%");

    assert.match(first.fullAnswer, /Área geométrica da parede: 30,00 m²|Área bruta: 30,00 m²/);
    assert.match(second.fullAnswer, /Perda adotada: 10%|perda adotada/i);
    assert.match(second.fullAnswer, /Área geométrica da parede: 30,00 m²|Área bruta: 30,00 m²/);
    assert.doesNotMatch(second.fullAnswer, /RDO|avanço físico|progresso|Posso te ajudar/i);
  }
});
test("Elo substitui contexto quando usuario informa nova parede completa", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const first = sandbox.window.EloAssistente.buildResponseForTest("PAREDE 10 X 3");
  const second = sandbox.window.EloAssistente.buildResponseForTest("10%");
  const third = sandbox.window.EloAssistente.buildResponseForTest("Tenho uma parede de 12 m por 2,80 m com uma porta 0,90x2,10 e duas janelas 1,20x1,00. Quantos blocos 14x19x29 preciso?");
  const fourth = sandbox.window.EloAssistente.buildResponseForTest("10%");

  assert.match(first.fullAnswer, /Área geométrica da parede: 30,00 m²|Área bruta: 30,00 m²/);
  assert.match(second.fullAnswer, /Perda adotada: 10%/);
  assert.match(third.fullAnswer, /Comprimento da parede: 12,00 m/);
  assert.match(third.fullAnswer, /Altura da parede: 2,80 m/);
  assert.match(third.fullAnswer, /Área bruta: 33,60 m²/);
  assert.match(third.fullAnswer, /Área total de vãos: 4,29 m²/);
  assert.match(third.fullAnswer, /Área líquida considerada: 29,31 m²/);
  assert.doesNotMatch(third.fullAnswer, /Comprimento da parede: 10,00 m|Área bruta: 30,00 m²|Perda adotada: 10%/);
  assert.match(fourth.fullAnswer, /Comprimento da parede: 12,00 m/);
  assert.match(fourth.fullAnswer, /Área bruta: 33,60 m²/);
  assert.match(fourth.fullAnswer, /Área líquida considerada: 29,31 m²/);
  assert.match(fourth.fullAnswer, /Perda adotada: 10%/);
  assert.doesNotMatch(fourth.fullAnswer, /RDO|avanço físico|progresso|Posso te ajudar/i);
});
test("Elo exige vaos obrigatorios depois da dimensao do bloco", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Bloco 14x19x39");

  assert.match(first.fullAnswer, /Qual a dimensão do bloco/);
  assert.match(second.shortAnswer, /Antes de calcular, preciso completar o briefing técnico da parede/);
  assert.match(second.fullAnswer, /portas ou janelas/);
  assert.match(second.fullAnswer, /1 porta de 0,80 x 2,10 m/);
  assert.match(second.fullAnswer, /2 janelas de 1,20 x 1,00 m/);
  assert.match(second.fullAnswer, /parede íntegra, sem vãos/);
  assert.match(second.fullAnswer, /Base técnica utilizada/);
  assert.match(second.fullAnswer, /Geometria informada pelo usuário/);
});

test("Elo desconta vaos informados nas premissas de parede", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const first = sandbox.window.EloAssistente.buildResponseForTest("Quero fazer uma parede de bloco baiano com 2,80 m de altura e 20 m de comprimento.");
  const second = sandbox.window.EloAssistente.buildResponseForTest("Bloco 14x19x39, 1 porta de 0,80 x 2,10 m, 2 janelas de 1,20 x 1,00 m, perda de 10%, revestimento dos dois lados.");

  assert.match(first.fullAnswer, /Qual a dimensão do bloco/);
  assert.match(second.fullAnswer, /Base técnica utilizada: não localizada/);
  assert.match(second.fullAnswer, /Área bruta: 56,00 m²/);
  assert.match(second.fullAnswer, /Vãos descontados: 1 porta 0,80 x 2,10 m = 1,68 m²; 2 janelas 1,20 x 1,00 m = 2,40 m²/);
  assert.match(second.fullAnswer, /Área líquida considerada: 51,92 m²/);
  assert.doesNotMatch(second.fullAnswer, /Cimento|Areia|Bloco ceramico: \d/i);
});
test("Elo standalone operacional mostra previsao sem saldo disponivel", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho 14 pilares 20x30 com 3m FCK 25 MPa. Posso executar? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.equal(response.sessionTheme, "elo_operacional_obras");
  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Fonte: Base técnica demonstrativa\/editável/);
  assert.match(response.fullAnswer, /Aco CA-50: 251,37 kg/i);
  assert.match(response.fullAnswer, /Nao encontrei saldo do Almoxarifado disponivel nesta tela para comparar\./);
  assert.deepEqual(sandbox.__almoxMovements, []);
});

test("Elo operacional responde com saldo suficiente sem criar movimentacao", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 620, realBalance: 620 },
    { name: "Cimento", unit: "saco", balance: 80, realBalance: 80 },
    { name: "Areia", unit: "m3", balance: 900, realBalance: 900 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m² com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Posso executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.equal(response.sessionTheme, "elo_operacional_obras");
  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Fonte: Base técnica demonstrativa\/editável/);
  assert.match(response.fullAnswer, /Almoxarifado/);
  assert.match(response.fullAnswer, /Saldo suficiente/);
  assert.doesNotMatch(response.fullAnswer, /Areia: 756 m3/i);
  assert.match(response.fullAnswer, /Areia: 0,756 m³/i);
  assert.doesNotMatch(response.fullAnswer, /saida oficial criada/i);
});

test("Elo operacional interpreta parede 12 m x 3 m como 36 m2", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 500, realBalance: 500 },
    { name: "Cimento", unit: "saco", balance: 80, realBalance: 80 },
    { name: "Areia", unit: "m3", balance: 50, realBalance: 50 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede 12 m x 3 m com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Dá para executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Bloco ceramico: 491,4 un/i);
  assert.match(response.fullAnswer, /Areia: 0,68 m³/i);
  assert.doesNotMatch(response.fullAnswer, /Areia: 680 m3/i);
});

test("Elo operacional alerta saldo insuficiente e nao altera estoque", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco ceramico", unit: "un", balance: 620, realBalance: 620 },
    { name: "Cimento", unit: "saco", balance: 1, realBalance: 1 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 },
    { name: "Argamassa de assentamento", unit: "kg", balance: 900, realBalance: 900 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m² com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Posso executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Material insuficiente/);
  assert.match(response.fullAnswer, /faltam/i);
  assert.deepEqual(sandbox.__almoxMovements, []);
});

test("Elo operacional calcula piso e compara estoque sem converter unidade errada", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Piso ceramico", unit: "m2", balance: 40, realBalance: 40 },
    { name: "Argamassa colante", unit: "saco", balance: 20, realBalance: 20 },
    { name: "Rejunte", unit: "kg", balance: 20, realBalance: 20 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho piso de 30 m². Posso executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Piso ceramico: 32,445 m²/i);
  assert.match(response.fullAnswer, /Saldo suficiente/);
  assert.doesNotMatch(response.fullAnswer, /32450/);
});

test("Elo operacional calcula reboco e compara estoque", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 10, realBalance: 10 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho reboco de 50 m², revestimento dos dois lados. Posso fazer amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Reboco|Previsão Stock AI/);
  assert.match(response.fullAnswer, /Areia: 1,05 m³/i);
  assert.doesNotMatch(response.fullAnswer, /Areia: 1050 m3/i);
});

test("Elo operacional trata concreto por volume sem converter m3 para m2", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 20, realBalance: 20 },
    { name: "Areia", unit: "m3", balance: 5, realBalance: 5 },
    { name: "Brita", unit: "m3", balance: 5, realBalance: 5 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho concreto de 2 m3 FCK 20 MPa. Tenho material? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.doesNotMatch(response.fullAnswer, /2000 m³|2000 m3/i);
});

test("Elo operacional informa item inexistente no almoxarifado", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Cimento", unit: "saco", balance: 12, realBalance: 12 },
    { name: "Areia", unit: "m3", balance: 2, realBalance: 2 }
  ]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m² com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Posso executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Material não encontrado no Almoxarifado/);
  assert.match(response.fullAnswer, /Bloco ceramico: não encontrado/i);
});

test("Elo operacional mostra previsao mesmo com almoxarifado vazio", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 40 m² com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Posso executar amanhã? Autorizo estimativa preliminar NÃO OFICIAL.");

  assert.match(response.fullAnswer, /Previsão Stock AI/);
  assert.match(response.fullAnswer, /Nao encontrei saldo do Almoxarifado disponivel nesta tela para comparar/);
  assert.match(response.fullAnswer, /Almoxarifado sem saldo comparavel/);
});

test("Elo operacional pede dados quando Stock AI nao consegue prever", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Posso executar concreto amanhã?");

  assert.match(response.fullAnswer, /Eu ainda não consegui calcular essa previsão técnica/);
  assert.match(response.fullAnswer, /parede de 40 m²/);
});

test("Elo operacional indica fonte real quando composicao importada estiver disponivel", async () => {
  const sandbox = await loadEloOperationalSandbox_([
    { name: "Bloco teste real", unit: "un", balance: 100, realBalance: 100 },
    { name: "Areia real", unit: "m3", balance: 10, realBalance: 10 }
  ]);
  sandbox.window.StockAiCompositionEngine.setExternalCompositionCatalog([{
    id: "sinapi_alvenaria_teste",
    code: "SINAPI-TESTE",
    service: "Alvenaria de teste SINAPI",
    productionUnit: "m2",
    source: "SINAPI",
    sourceRegion: "BA",
    sourceDate: "2026-06",
    isRealComposition: true,
    inputs: [
      { name: "Bloco teste real", quantityPerUnit: 2, unit: "un" },
      { name: "Areia real", quantityPerUnit: 0.01, unit: "m3" }
    ],
    keywords: ["alvenaria", "parede", "bloco"]
  }]);

  const response = sandbox.window.EloAssistente.buildOperationalConstructionAnswer("Tenho uma parede de 10 m² com bloco 14x19x39, sem portas e sem janelas, perda 8%, revestimento dos dois lados. Posso executar amanhã?");

  assert.match(response.fullAnswer, /Fonte: SINAPI real\/importada|Base técnica utilizada: SINAPI|- Fonte: SINAPI/);
  assert.match(response.fullAnswer, /Bloco teste real/);
  assert.match(response.fullAnswer, /Consumo líquido: 20 un/);
  assert.match(response.fullAnswer, /Consumo final: 21,6 un/);
  sandbox.window.StockAiCompositionEngine.clearExternalCompositionCatalog();
});

test("Elo operacional usa ponte de leitura do Almoxarifado sem API de baixa", async () => {
  const { readFile } = await import("node:fs/promises");
  const eloContent = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const appContent = await readFile(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.js", import.meta.url), "utf8");

  assert.match(eloContent, /ObraReportOperationalStock/);
  assert.match(eloContent, /getAlmoxBalances/);
  assert.doesNotMatch(eloContent, /saveAlmoxState_/);
  assert.doesNotMatch(eloContent, /almox\.movements|movements\.push/);
  assert.doesNotMatch(eloContent, /materials\[\]\.push|consumo_rdo/);
  assert.match(appContent, /getOperationalAlmoxBalanceSnapshot_/);
  assert.match(appContent, /window\.ObraReportOperationalStock/);
});

test("endpoint de memoria vetorial exige deviceId valido", async () => {
  const response = await postEloVectorMemory_({
    memory: {
      id: "sem-device",
      text: "Minha mae se chama Maria.",
      category: "pessoa"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /deviceId/i);
});

test("endpoint de memoria vetorial rejeita texto acima do limite", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "texto-grande",
      text: "a".repeat(801),
      category: "outro"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /longo/i);
});

test("prompt visual inclui biblioteca de patologias e restricoes tecnicas", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "fissura-parede.jpg",
      width: 1200,
      height: 900
    },
    context: {
      imageLabel: "Foto da inconformidade 01",
      report: {
        obra: "Obra teste",
        local: "Bloco A"
      }
    }
  });

  assert.match(prompt, /fissuras e trincas/i);
  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao de armadura/i);
  assert.match(prompt, /Nao afirmar causa definitiva/);
  assert.match(prompt, /Nao emitir laudo/);
  assert.match(prompt, /validacao do responsavel tecnico/);
});

test("base consultavel de patologias localiza verificacoes e alertas", () => {
  const result = searchPathologyKnowledge("mancha de umidade com pintura descascando");

  assert.equal(result.totalRecords, 8);
  assert.ok(result.items.length >= 1);
  assert.ok(result.items.some((item) => /umidade|infiltracao/i.test(item.nome)));
  assert.ok(result.items[0].verificacoes_recomendadas.length > 0);
  assert.ok(result.items[0].alertas.length > 0);
});

test("contexto de patologias resume a base para a IA visual", () => {
  const context = buildPathologyContext("aco exposto com ferrugem em viga de concreto");

  assert.match(context, /Registros locais consultados:/);
  assert.match(context, /Corrosao de armadura/);
  assert.match(context, /Verificacoes recomendadas:/);
  assert.match(context, /Nao emitir laudo definitivo/);
  assert.match(context, /validacao do responsavel tecnico/);
});

test("prompt visual preserva categorias de infiltracao e corrosao", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "umidade-corrosao.jpg",
      width: 800,
      height: 600
    },
    context: {
      report: {
        obra: "Inspecao teste"
      }
    }
  });

  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao/i);
  assert.match(prompt, /armadura/i);
});

test("analise visual formatada usa padrao de patologias e observacao obrigatoria", () => {
  const analysis = normalizeImageAnalysis_({
    elementoObservado: "Parede interna",
    categoriaProvavel: "fissuras e trincas",
    confianca: "media",
    descricaoTecnica: "Indicio visual de fissura linear no revestimento.",
    evidenciasVisuais: ["linha fina no revestimento", "alteracao superficial localizada"],
    possiveisInconformidades: ["possivel manifestacao de fissura"],
    verificacoesRecomendadas: ["verificar abertura e extensao", "acompanhar evolucao"],
    grauPreliminar: "atencao",
    textoRelatorio: "Foi observado indicio visual de fissura em parede interna, recomendando-se verificacao complementar."
  });
  const formatted = formatImageAnalysis_(analysis);

  assert.match(formatted, /Elemento observado:/);
  assert.match(formatted, /Possivel manifestacao:/);
  assert.match(formatted, /Evidencias visuais:/);
  assert.match(formatted, /Verificacoes recomendadas:/);
  assert.match(formatted, /Grau preliminar:/);
  assert.match(formatted, /Texto sugerido para relatorio:/);
  assert.match(formatted, /Analise assistida por IA, sujeita a validacao do responsavel tecnico/);
});

test("stock demo sincroniza estado remoto em memoria", async () => {
  const key = "prefeitura-sao-joao-secretaria";
  const state = {
    items: [{ id: "item-1", name: "Mascara", environmentId: "env-1" }],
    movements: [],
    approvalRequests: [],
    stockEnvironments: [{ id: "env-1", clientName: "Prefeitura Sao Joao" }],
    activeStockEnvironmentId: "env-1"
  };

  const saveResponse = await postStockDemoState_({ key, state });
  const saveData = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saveData.ok, true);
  assert.equal(saveData.revision, 1);

  const getResponse = await fetch(baseUrl + "/api/stock-demo/state?key=" + encodeURIComponent(key));
  const getData = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getData.ok, true);
  assert.equal(getData.state.items[0].name, "Mascara");
});

test("stock demo registra solicitacao de aprovacao", async () => {
  const response = await postStockDemoApproval_({
    key: "prefeitura-sao-joao-aprovacao",
    request: {
      id: "apv-1",
      environmentId: "env-1",
      organizationId: "env-1",
      role: "almoxarife",
      type: "entrada",
      status: "pending",
      payload: {
        product: "Luva",
        quantity: 50,
        unit: "cx"
      }
    },
    state: {
      items: [],
      movements: [],
      approvalRequests: [],
      stockEnvironments: [{ id: "env-1" }],
      activeStockEnvironmentId: "env-1"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.state.approvalRequests.length, 1);
  assert.equal(data.state.approvalRequests[0].status, "pending");
});


test("Elo PDF profissional central estrutura dados incompletos sem inventar", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  const html = sandbox.window.EloAssistente.buildProfessionalPdfDocumentForTest({
    numero: "ELO-TEST-0001",
    conteudo_markdown: "Resposta principal\nOrcamento simples com dados incompletos.\n\nPendencias tecnicas\n- falta cliente;\n- falta composicao oficial."
  }, { nomeDocumento: "Orcamento tecnico preliminar" });

  assert.match(html, /elo-professional-pdf/);
  assert.match(html, /Documento tecnico de engenharia/);
  assert.match(html, /Cliente[\s\S]*nao informado/);
  assert.match(html, /Pendencias e informacoes faltantes/);
  assert.match(html, /falta composicao oficial/);
  assert.match(html, /Responsabilidade t(?:e|é)cnica e revis(?:a|ã)o/);
  assert.match(html, /Pagina/);
});

test("Elo PDF profissional central preserva composicao tecnica encontrada", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  const html = sandbox.window.EloAssistente.buildProfessionalPdfDocumentForTest({
    numero: "ELO-TEST-0002",
    cliente: "Cliente Alfa",
    obra: "Residencial Alfa",
    cidade_uf: "Feira de Santana/BA",
    conteudo_markdown: [
      "Resposta principal",
      "Orcamento com composicao tecnica encontrada.",
      "",
      "Premissas utilizadas",
      "- Parede 40 m2; bloco 14x19x39.",
      "",
      "Composicoes utilizadas",
      "- SINAPI 87519 - Alvenaria de bloco ceramico.",
      "",
      "Base tecnica utilizada",
      "- SINAPI BA 2026-01 importada e validada.",
      "",
      "Memoria de calculo",
      "- Area liquida: 40 m2."
    ].join("\n")
  }, { nomeDocumento: "Proposta tecnica preliminar" });

  assert.match(html, /Cliente Alfa/);
  assert.match(html, /Residencial Alfa/);
  assert.match(html, /SINAPI 87519/);
  assert.match(html, /SINAPI BA 2026-01 importada e validada/);
  assert.match(html, /Area liquida: 40 m2/);
});

test("Elo PDF sem orcamento salvo responde sem quebrar", async () => {
  const sandbox = await loadEloOperationalSandbox_([]);
  sandbox.window.EloAssistente.clearBudgetRecordsForTest();
  const response = sandbox.window.EloAssistente.buildResponseForTest("baixar PDF do orcamento");

  assert.ok(response);
  assert.doesNotMatch(response.fullAnswer || "", /TypeError|ReferenceError/);
  assert.match((response.fullAnswer || "") + "\n" + (response.shortAnswer || ""), /Nenhum orcamento salvo|Documento profissional|Ainda nao encontrei orcamento salvo suficiente/i);
});

test("Elo PDF profissional usa o mesmo template nos tres pontos de entrada", async () => {
  const pages = [
    { pathname: "/elo.html", context: "geral" },
    { pathname: "/elo-projeto.html", context: "cadista" },
    { pathname: "/stock-ai-obras.html", context: "obras" }
  ];

  for (const page of pages) {
    const sandbox = await loadEloOperationalSandbox_([]);
    sandbox.location.pathname = page.pathname;
    sandbox.document.body.dataset.eloContext = page.context;
    const html = sandbox.window.EloAssistente.buildProfessionalPdfDocumentForTest({
      numero: "ELO-SHARED-001",
      conteudo_markdown: "Premissas utilizadas\n- teste compartilhado.\n\nBase tecnica utilizada\n- nao localizada."
    }, { nomeDocumento: "Documento compartilhado" });

    assert.match(html, /elo-professional-pdf/);
    assert.match(html, /Documento compartilhado/);
    assert.match(html, /Icaro Amaral Engenharia/);
    assert.match(html, /Imprimir \/ Salvar como PDF/);
  }
});

function writeEloVectorTestFile_(path, items) {
  writeFileSync(path, JSON.stringify({
    items,
    updatedAt: "2026-06-01T00:00:00.000Z"
  }, null, 2), "utf8");
}

function loadEloTechnicalValidatorSandbox_() {
  const validatorContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-technical-validator.js", import.meta.url), "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  return sandbox.window.EloTechnicalValidator;
}
function loadStockAiCompositionSandbox_() {
  const validatorContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-technical-validator.js", import.meta.url), "utf8");
  const stockEngineContent = readFileSync(new URL("../../relatorio-qualidade-obras/stock-ai-composition-engine.js", import.meta.url), "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  runInContext(stockEngineContent, sandbox);
  return sandbox;
}
async function loadEloOperationalSandbox_(balances) {
    const validatorContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-technical-validator.js", import.meta.url), "utf8");
const stockEngineContent = readFileSync(new URL("../../relatorio-qualidade-obras/stock-ai-composition-engine.js", import.meta.url), "utf8");
  const eloContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const storage = new Map();
  const element = {
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    dataset: {},
    textContent: "",
    value: ""
  };
  const sandbox = {
    console,
    setTimeout() {},
    clearTimeout() {},
    Math,
    Date,
    JSON,
    RegExp,
    Number,
    String,
    Array,
    Object,
    URLSearchParams,
    __almoxMovements: [],
    location: {
      hostname: "127.0.0.1",
      protocol: "http:",
      pathname: "/relatorio-qualidade-obras/relatorio-qualidade-obras.html",
      search: "",
      hash: "#app/almoxarifado"
    },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); },
      removeItem(key) { storage.delete(key); }
    },
    sessionStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    document: {
      body: { dataset: {}, getAttribute() { return ""; }, appendChild() {} },
      readyState: "complete",
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return Object.assign({}, element); }
    },
    navigator: {},
    fetch: async () => ({ ok: false, json: async () => ({}) })
  };
  sandbox.window = sandbox;
  sandbox.ELO_SKIP_AUTO_WIDGET = true;
  sandbox.ObraReportOperationalStock = {
    getAlmoxBalances() {
      return balances;
    }
  };

  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  runInContext(stockEngineContent, sandbox);
  runInContext(eloContent, sandbox);
  return sandbox;
}

function readJsonFile_(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mockOpenAiEmbeddingFetch_(embedding, originalFetch) {
  return async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
}

function postAi_(body) {
  return fetch(baseUrl + "/api/ai/improve-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postImage_(body) {
  return fetch(baseUrl + "/api/ai/analyze-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChat_(body) {
  return fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChatMultipart_({ message, history = [], context = {}, eloContext = "", files = [] }) {
  return postEloChatMultipartTo_(baseUrl, { message, history, context, eloContext, files });
}

function postEloChatMultipartTo_(url, { message, history = [], context = {}, eloContext = "", files = [] }) {
  const formData = new FormData();
  formData.append("message", message);
  if (eloContext) {
    formData.append("eloContext", eloContext);
  }
  formData.append("history", JSON.stringify(history));
  formData.append("context", JSON.stringify(context));
  files.forEach((file) => {
    formData.append("files", new Blob([file.content], { type: file.type }), file.name);
  });
  return fetch(url + "/api/elo/chat", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:5500"
    },
    body: formData
  });
}

async function withTemporaryEloServer_(options, callback) {
  const app = createApp(Object.assign({
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  }, options || {}));
  const instance = await new Promise((resolve) => {
    const serverInstance = app.listen(0, () => resolve(serverInstance));
  });
  try {
    await callback("http://127.0.0.1:" + instance.address().port);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

function tinyPdfBuffer_() {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT /F1 24 Tf 100 700 Td (Prazo de entrega: 30 dias) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R /Size 6 >>
%%EOF`);
}

function postEloVectorMemory_(body) {
  return fetch(baseUrl + "/api/elo/vector-memory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoState_(body) {
  return fetch(baseUrl + "/api/stock-demo/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoApproval_(body) {
  return fetch(baseUrl + "/api/stock-demo/approval-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

async function listenTestApp_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    server,
    baseUrl: "http://127.0.0.1:" + server.address().port
  };
}

async function closeTestServer_(server) {
  await new Promise((resolve) => server.close(resolve));
}

function createMockStockSaudeSupabase_(options = {}) {
  const profile = Object.prototype.hasOwnProperty.call(options, "profile") ? options.profile : createMockStockSaudeProfile_("gestor");
  const profiles = profile ? [profile] : [];
  const authUser = options.user || {
    id: profile ? profile.auth_user_id : "auth_user_without_profile",
    email: profile ? profile.email : "sem-profile@teste.local"
  };
  const institutions = (options.institutions || [{ id: "inst_auth" }]).slice();
  const units = (options.units || [{ id: "unit_auth", institution_id: "inst_auth" }]).slice();
  const items = (options.items || []).slice();
  const stockFullItems = (options.stockFullItems || []).slice();
  const stockFullEntries = (options.stockFullEntries || []).slice();
  const stockFullExits = (options.stockFullExits || []).slice();
  const stockFullAuditLogs = (options.stockFullAuditLogs || []).slice();
  const entries = (options.entries || []).slice();
  const exits = (options.exits || []).slice();
  const auditLogs = (options.auditLogs || []).slice();
  const invites = (options.invites || []).slice();

  const client = {
    auditLogs,
    invites,
    profiles,
    stockFullItems,
    stockFullEntries,
    stockFullExits,
    auth: {
      async getUser(token) {
        if (token !== "valid-token") {
          return { data: null, error: { message: "invalid" } };
        }
        return {
          data: {
            user: {
              id: authUser.id,
              email: authUser.email,
              user_metadata: authUser.user_metadata || {}
            }
          },
          error: null
        };
      }
    },
    from(table) {
      if (table === "profiles") {
        return createMockProfilesQuery_(profiles);
      }
      if (table === "institutions") {
        return createMockSimpleIdQuery_(institutions);
      }
      if (table === "units") {
        return createMockSimpleIdQuery_(units);
      }
      if (table === "stock_items") {
        return createMockStockItemsQuery_(items);
      }
      if (table === "stock_full_items") {
        return createMockStockFullItemsQuery_(stockFullItems);
      }
      if (table === "stock_full_entries") {
        return createMockStockFullEntriesQuery_(stockFullEntries);
      }
      if (table === "stock_full_exits") {
        return createMockStockFullExitsQuery_(stockFullExits);
      }
      if (table === "stock_full_audit_log") {
        return createMockStockFullAuditLogQuery_(stockFullAuditLogs);
      }
      if (table === "stock_entries") {
        return createMockStockEntriesQuery_(entries);
      }
      if (table === "stock_exits") {
        return createMockStockExitsQuery_(exits);
      }
      if (table === "stock_audit_log") {
        return createMockStockAuditLogQuery_(auditLogs);
      }
      if (table === "stock_saude_invites") {
        return createMockStockInvitesQuery_(invites);
      }
      return createMockStockItemsQuery_([]);
    }
  };
  return client;
}

function createMockStockSaudeProfile_(role = "gestor") {
  return {
    id: "profile_auth",
    auth_user_id: "auth_user_1",
    institution_id: "inst_auth",
    unit_id: "unit_auth",
    name: "Gestor Teste",
    email: "gestor@teste.local",
    role
  };
}

function createMockProfilesQuery_(profiles) {
  let authUserId = "";
  const filters = [];
  return {
    select() {
      return this;
    },
    eq(column, value) {
      if (column === "auth_user_id") {
        authUserId = value;
      }
      filters.push({ column, value });
      return this;
    },
    insert(payload) {
      const profile = Object.assign({
        id: "profile_created",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      profiles.push(profile);
      return {
        select() {
          return {
            async single() {
              const projected = Object.assign({}, profile);
              delete projected.auth_user_id;
              return { data: projected, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      const profile = profiles.find((candidate) => {
        if (authUserId) {
          return candidate.auth_user_id === authUserId;
        }
        return filters.every((filter) => candidate[filter.column] === filter.value);
      });
      return {
        data: profile || null,
        error: null
      };
    }
  };
}

function createMockSimpleIdQuery_(records) {
  const filters = [];
  return {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    async maybeSingle() {
      return {
        data: records.find((record) => filters.every((filter) => record[filter.column] === filter.value)) || null,
        error: null
      };
    }
  };
}

function createMockStockItemsQuery_(items) {
  const filters = [];
  const inFilters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const item = Object.assign({
        id: "item_created",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      items.push(item);
      return {
        select() {
          return {
            async single() {
              return { data: item, error: null };
            }
          };
        }
      };
    },
    then(resolve) {
      const data = items.filter((item) => {
        return filters.every((filter) => item[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(item[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockFullItemsQuery_(items) {
  const filters = [];
  let updatePayload = null;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const item = Object.assign({
        id: "stock_full_item_" + String(items.length + 1),
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      items.push(item);
      return {
        select() {
          return {
            async single() {
              return { data: item, error: null };
            }
          };
        }
      };
    },
    update(payload) {
      updatePayload = payload || {};
      return this;
    },
    async maybeSingle() {
      const item = items.find((candidate) => filters.every((filter) => candidate[filter.column] === filter.value));
      if (item && updatePayload) {
        Object.assign(item, updatePayload);
      }
      return {
        data: item || null,
        error: null
      };
    },
    then(resolve) {
      const data = items.filter((item) => filters.every((filter) => item[filter.column] === filter.value));
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockFullEntriesQuery_(entries) {
  const filters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const entry = Object.assign({
        id: "stock_full_entry_" + String(entries.length + 1),
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      entries.push(entry);
      return {
        select() {
          return {
            async single() {
              return { data: entry, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      const entry = entries.find((candidate) => filters.every((filter) => candidate[filter.column] === filter.value));
      return { data: entry || null, error: null };
    },
    then(resolve) {
      const data = entries.filter((entry) => filters.every((filter) => entry[filter.column] === filter.value));
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockFullExitsQuery_(exits) {
  const filters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const exit = Object.assign({
        id: "stock_full_exit_" + String(exits.length + 1),
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      exits.push(exit);
      return {
        select() {
          return {
            async single() {
              return { data: exit, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      const exit = exits.find((candidate) => filters.every((filter) => candidate[filter.column] === filter.value));
      return { data: exit || null, error: null };
    },
    then(resolve) {
      const data = exits.filter((exit) => filters.every((filter) => exit[filter.column] === filter.value));
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockFullAuditLogQuery_(auditLogs) {
  const filters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const record = Object.assign({
        id: "stock_full_audit_" + String(auditLogs.length + 1),
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      auditLogs.push(record);
      return {
        select() {
          return {
            async single() {
              return { data: record, error: null };
            }
          };
        }
      };
    },
    then(resolve) {
      const data = auditLogs.filter((record) => filters.every((filter) => record[filter.column] === filter.value));
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockEntriesQuery_(entries) {
  const filters = [];
  const inFilters = [];
  let updatePayload = null;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    update(payload) {
      updatePayload = payload;
      return this;
    },
    insert(payload) {
      const entry = Object.assign({
        id: "entry_created",
        status: "pendente",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      entries.push(entry);
      return {
        select() {
          return {
            async single() {
              return { data: entry, error: null };
            }
          };
        }
      };
    },
    async single() {
      const entry = entries.find((candidate) => {
        return filters.every((filter) => candidate[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(candidate[filter.column]));
      });
      if (!entry) {
        return { data: null, error: null };
      }
      if (updatePayload) {
        Object.assign(entry, updatePayload);
      }
      return { data: entry, error: null };
    },
    then(resolve) {
      const data = entries.filter((entry) => {
        return filters.every((filter) => entry[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(entry[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockExitsQuery_(exits) {
  const filters = [];
  const inFilters = [];
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    in(column, values) {
      inFilters.push({ column, values });
      return this;
    },
    order() {
      return this;
    },
    insert(payload) {
      const exit = Object.assign({
        id: "exit_created",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      exits.push(exit);
      return {
        select() {
          return {
            async single() {
              return { data: exit, error: null };
            }
          };
        }
      };
    },
    then(resolve) {
      const data = exits.filter((exit) => {
        return filters.every((filter) => exit[filter.column] === filter.value)
          && inFilters.every((filter) => filter.values.includes(exit[filter.column]));
      });
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockInvitesQuery_(invites) {
  const filters = [];
  let orderConfig = null;
  let updatePayload = null;
  const query = {
    select() {
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order(column, options = {}) {
      orderConfig = { column, ascending: options.ascending !== false };
      return this;
    },
    update(payload) {
      updatePayload = payload;
      return this;
    },
    insert(payload) {
      const invite = Object.assign({
        id: "invite_created",
        status: "pendente",
        created_at: new Date().toISOString()
      }, Array.isArray(payload) ? payload[0] : payload);
      invites.push(invite);
      return {
        select() {
          return {
            async single() {
              return { data: invite, error: null };
            }
          };
        }
      };
    },
    async maybeSingle() {
      let data = invites.filter((invite) => filters.every((filter) => invite[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      return { data: data[0] || null, error: null };
    },
    async single() {
      const invite = invites.find((candidate) => filters.every((filter) => candidate[filter.column] === filter.value));
      if (invite && updatePayload) {
        Object.assign(invite, updatePayload);
      }
      return { data: invite || null, error: null };
    },
    then(resolve) {
      let data = invites.filter((invite) => filters.every((filter) => invite[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function createMockStockAuditLogQuery_(auditLogs) {
  const filters = [];
  let selectedColumns = null;
  let orderConfig = null;
  const query = {
    select(columns) {
      selectedColumns = String(columns || "*")
        .split(",")
        .map((column) => column.trim())
        .filter(Boolean);
      return this;
    },
    eq(column, value) {
      filters.push({ column, value });
      return this;
    },
    order(column, options = {}) {
      orderConfig = { column, ascending: options.ascending !== false };
      return this;
    },
    async insert(payload) {
      auditLogs.push(Array.isArray(payload) ? payload[0] : payload);
      return { data: null, error: null };
    },
    then(resolve) {
      let data = auditLogs.filter((log) => filters.every((filter) => log[filter.column] === filter.value));
      if (orderConfig) {
        data = data.slice().sort((a, b) => {
          const left = String(a[orderConfig.column] || "");
          const right = String(b[orderConfig.column] || "");
          return orderConfig.ascending ? left.localeCompare(right) : right.localeCompare(left);
        });
      }
      if (selectedColumns && selectedColumns[0] !== "*") {
        data = data.map((log) => {
          const projected = {};
          selectedColumns.forEach((column) => {
            projected[column] = log[column];
          });
          return projected;
        });
      }
      return Promise.resolve({ data, error: null }).then(resolve);
    }
  };
  return query;
}

function tinyJpegBase64_() {
  return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";
}
