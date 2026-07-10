import cors from "cors";
import express from "express";
import Busboy from "busboy";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { OBRA_COMPOSICOES_DEMONSTRATIVAS } from "./data/obra-composicoes.js";
import { getSupabaseClient } from "./supabase.js";
import { createEloCoreStore } from "./elo-core-store.js";

const MAX_TEXT_LENGTH = 6000;
const MAX_CONTEXT_LENGTH = 16000;
const MAX_IMAGE_BASE64_LENGTH = 2200000;
const MAX_ELO_MESSAGE_LENGTH = 2000;
const MAX_ELO_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ELO_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ELO_ATTACHMENT_TEXT_LENGTH = 12000;
const MAX_ELO_DOCUMENT_CONTEXT_LENGTH = 5000;
const ELO_DOCUMENT_CHUNK_LENGTH = 1200;
const MAX_ELO_VECTOR_TEXT_LENGTH = 2000;
const MAX_STOCK_DEMO_STATE_LENGTH = 1200000;
const ELO_LOCAL_VECTOR_DIMENSIONS = 96;
const ELO_OPENAI_VECTOR_DIMENSIONS = 1536;
const ELO_LOCAL_EMBEDDING_MODEL = "local-hash-96";
const ELO_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const ELO_VECTOR_SCHEMA_VERSION = 2;
const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_DIR = join(BACKEND_DIR, "..");
const ELO_TECHNICAL_VALIDATOR_PATH = join(REPO_DIR, "relatorio-qualidade-obras", "elo-technical-validator.js");
const PATHOLOGY_KNOWLEDGE_DIR = join(BACKEND_DIR, "patologias");
const ELO_VECTOR_MEMORY_PATH = join(BACKEND_DIR, "data", "elo-vector-memory.json");
const ELO_CORE_STORE_PATH = join(BACKEND_DIR, "data", "elo-core.json");
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const OBRAREPORT_IMAGE_ANALYSIS_LIBRARY = [
  {
    id: "fissuras-trincas",
    category: "fissuras e trincas",
    visualCues: [
      "linhas finas ou abertas em alvenaria, concreto, revestimento ou acabamento",
      "mudanca de direcao, extensao, abertura aparente e repeticao",
      "manchas, destacamento ou deformacao associada"
    ],
    caution: "Nao classificar gravidade estrutural apenas pela foto."
  },
  {
    id: "infiltracao-umidade",
    category: "infiltracao e umidade",
    visualCues: [
      "manchas escurecidas, marcas de escorrimento, bolhas ou pintura empolada",
      "alteracao de cor proxima a teto, parede, piso, esquadria, cobertura ou tubulacao",
      "sais, descascamento ou degradacao superficial"
    ],
    caution: "Nao afirmar a origem da agua sem vistoria complementar."
  },
  {
    id: "corrosao-armadura",
    category: "corrosao de armadura",
    visualCues: [
      "aco exposto, manchas ferruginosas, cobrimento rompido ou concreto desagregado",
      "fissuras proximas a elementos de concreto armado",
      "perda aparente de cobrimento ou destacamento ao redor da armadura"
    ],
    caution: "Nao estimar perda de secao ou capacidade resistente pela imagem."
  },
  {
    id: "desplacamento",
    category: "desplacamento",
    visualCues: [
      "revestimento solto, placas destacadas, bordas abertas ou areas ocas aparentes",
      "perda de aderencia em argamassa, ceramica, pintura ou concreto",
      "fragmentos, fissuras perifericas ou diferenca de plano"
    ],
    caution: "Nao afirmar causa unica sem verificar aderencia, substrato e umidade."
  },
  {
    id: "mofo-bolor",
    category: "mofo e bolor",
    visualCues: [
      "pontos escuros, esverdeados ou manchas pulverulentas",
      "ocorrencia em areas com pouca ventilacao, umidade ou condensacao",
      "associacao com manchas e degradacao de pintura"
    ],
    caution: "Nao diagnosticar risco a saude pela foto."
  },
  {
    id: "falhas-acabamento",
    category: "falhas de acabamento",
    visualCues: [
      "pintura irregular, rejunte falho, recortes desalinhados ou acabamento incompleto",
      "manchas, respingos, ondulacoes, falhas de nivelamento ou arremates inadequados",
      "incompatibilidade visual com o padrao esperado do ambiente"
    ],
    caution: "Diferenciar acabamento estetico de manifestacao patologica."
  },
  {
    id: "recalque-movimentacao",
    category: "recalque/movimentacao",
    visualCues: [
      "trincas inclinadas, aberturas em encontros, desnivel aparente ou deformacoes",
      "fissuras proximas a esquadrias, pilares, vigas, alvenarias ou pisos",
      "separacao entre elementos e repeticao em pontos alinhados"
    ],
    caution: "Nao concluir recalque apenas pela foto."
  }
];
const ACTIONS = new Set([
  "improve",
  "conclusion",
  "review",
  "improveTechnicalText",
  "generateConclusion",
  "reviewReport"
]);
const PATHOLOGY_KNOWLEDGE_BASE = loadPathologyKnowledgeBase_();
export const PROJECT_KNOWLEDGE = {
  cadista: {
    name: "CADISTA",
    aliases: ["cadista", "cadista ia", "cadista ai", "cadista-ai", "elo-projeto"],
    summary: "SaaS para transformar dados geometricos, croquis ou imagens em planta baixa tecnica, PDF tecnico e DXF editavel.",
    strategy: "Comecar pelo gerador procedural antes de IA avancada, validando primeiro o motor geometrico e exportacoes.",
    flow: ["terreno", "recuos", "ocupacao", "orientacao solar", "setorizacao", "ambientes minimos", "circulacao", "validacao", "planta"],
    priorities: ["biblioteca de ambientes", "programa de necessidades", "terreno e recuos", "setorizacao", "gerador de layout", "validacao", "PDF tecnico", "DXF editavel"]
  },
  stockfull: {
    name: "Stock Full",
    aliases: ["stock full", "almoxarifado"],
    summary: "SaaS de controle de estoque e almoxarifado para lojistas e operacoes com entrada, saida, saldo e auditoria.",
    strategy: "Manter operacao simples, rastreavel e confiavel antes de adicionar automacoes mais complexas.",
    flow: ["cadastro de produto", "entrada", "saida", "saldo", "alertas", "auditoria"],
    priorities: ["cadastro rapido", "movimentacao segura", "saldo confiavel", "produtos parados", "relatorios operacionais"]
  },
  stockobras: {
    name: "Stock AI Obras",
    aliases: ["stock ai", "stock obras", "stock ai obras"],
    summary: "Camada tecnica para prever consumo de materiais de obra a partir de servicos, quantitativos e composicoes.",
    strategy: "Evoluir com catalogo controlado, bases oficiais importadas e conferencia operacional sem criar baixas indevidas.",
    flow: ["servico", "quantitativo", "composicao", "consumo previsto", "estoque", "conferencia", "aprovacao"],
    priorities: ["geometria confiavel", "composicoes controladas", "importacao oficial", "auditoria previsto x real", "fila de aprovacao"]
  },
  stocksaude: {
    name: "Stock Saúde",
    aliases: ["stock saude", "stock saúde", "saude", "saúde"],
    summary: "Controle operacional de estoque de saude com foco em medicamentos, lote, validade, rastreabilidade e auditoria.",
    strategy: "Priorizar seguranca operacional, validade, lote e trilha de auditoria antes de automacoes avancadas.",
    flow: ["produto", "lote", "validade", "entrada", "saida", "saldo", "auditoria"],
    priorities: ["controle por lote", "alerta de validade", "rastreabilidade", "perfis de acesso", "auditoria"]
  },
  obrareport: {
    name: "ObraReport",
    aliases: ["obrareport", "relatorio", "relatório", "rdo"],
    summary: "SaaS para relatorios tecnicos de obras, RDO, fotos, materiais, inconformidades, revisao e PDF.",
    strategy: "Consolidar fluxo vendavel de relatorio/RDO/PDF e usar o Elo como copiloto tecnico contextual.",
    flow: ["cliente", "obra", "relatorio", "fotos", "inconformidades", "revisao", "PDF", "RDO"],
    priorities: ["fluxo de relatorio", "PDF confiavel", "RDO", "materiais", "auditoria de consumo", "experiencia comercial"]
  },
  elo: {
    name: "Elo",
    aliases: ["elo"],
    summary: "Assistente contextual com personalidade unica, memoria, biblioteca, historico resumido e contexto de produto.",
    strategy: "Unificar todos os Elos no cerebro oficial e fazer o assistente pensar antes de responder.",
    flow: ["classificador", "memoria relevante", "biblioteca relevante", "contexto do produto", "contexto mestre", "LLM", "resposta limpa"],
    priorities: ["cerebro oficial", "recuperacao relevante", "personalidade consistente", "salvamento por metadado", "auditoria de contexto"]
  },
  eloinforme: {
    name: "Elo Informe",
    aliases: ["elo informe", "bueiro", "boeiro", "ocorrencia urbana", "prefeitura"],
    summary: "Ideia de produto para registro e encaminhamento de ocorrencias urbanas com linguagem simples para cidadaos.",
    strategy: "Validar primeiro o fluxo de registro, localizacao, categoria e encaminhamento antes de automacoes avancadas.",
    flow: ["ocorrencia", "localizacao", "categoria", "evidencia", "resumo", "encaminhamento"],
    priorities: ["registro simples", "classificacao", "geolocalizacao", "comprovante", "painel de acompanhamento"]
  }
};
const PROJECT_ALIASES = {
  cadista: PROJECT_KNOWLEDGE.cadista.aliases,
  elo: PROJECT_KNOWLEDGE.elo.aliases,
  eloinforme: PROJECT_KNOWLEDGE.eloinforme.aliases,
  stockfull: PROJECT_KNOWLEDGE.stockfull.aliases,
  stockobras: PROJECT_KNOWLEDGE.stockobras.aliases,
  stocksaude: PROJECT_KNOWLEDGE.stocksaude.aliases.concat(["medicamento", "medicamentos", "lote", "validade"]),
  obrareport: PROJECT_KNOWLEDGE.obrareport.aliases
};

export function normalizeEloText(message) {
  let text = String(message || "").trim();
  const replacements = [
    [/\boq\b/gi, "o que"],
    [/\boque\b/gi, "o que"],
    [/\bpq\b/gi, "por que"],
    [/\bvc\b/gi, "você"],
    [/\bvcs\b/gi, "vocês"],
    [/\btbm\b/gi, "também"],
    [/\btb\b/gi, "também"],
    [/\bn\b/gi, "não"],
    [/\bnao\b/gi, "não"],
    [/\bpra\b/gi, "para"],
    [/\bpro\b/gi, "para o"],
    [/\bpros\b/gi, "para os"],
    [/\bq\b/gi, "que"],
    [/\bkd\b/gi, "cadê"],
    [/\bdps\b/gi, "depois"],
    [/\bagr\b/gi, "agora"],
    [/\bhj\b/gi, "hoje"],
    [/\baki\b/gi, "aqui"],
    [/\baq\b/gi, "aqui"],
    [/\bcmg\b/gi, "comigo"],
    [/\bblz\b/gi, "beleza"],
    [/\bmsg\b/gi, "mensagem"],
    [/\bcodex\b/gi, "Codex"],
    [/\belo\b/gi, "Elo"],
    [/\bstock full\b/gi, "Stock Full"],
    [/\bstock ai\b/gi, "Stock AI"],
    [/\bobrareport\b/gi, "ObraReport"]
  ];
  const typoHints = [
    { wrong: "xi iu", right: "se eu" },
    { wrong: "iscriver", right: "escrever" },
    { wrong: "acim", right: "assim" },
    { wrong: "fass", right: "faça" },
    { wrong: "fazr", right: "fazer" },
    { wrong: "trasnformar", right: "transformar" },
    { wrong: "mê dê", right: "me dê" },
    { wrong: "vcê", right: "você" },
    { wrong: "vocÊ", right: "você" },
    { wrong: "codigo", right: "código" },
    { wrong: "trasnforme", right: "transforme" }
  ];

  replacements.forEach(([pattern, replacement]) => {
    text = text.replace(pattern, replacement);
  });
  typoHints.forEach((item) => {
    text = text.replace(new RegExp(item.wrong, "gi"), item.right);
  });

  return text.replace(/\s+/g, " ").trim();
}

export function detectEloIntent(message, context = "geral", history = []) {
  const text = normalizeEloDecisionText_(message);
  if (/\b(codigo|codex|prompt|implementar|crie a tarefa|faca os codigos|faca o codigo)\b/.test(text)) {
    return "codex_task_or_code";
  }
  if (/\b(analise|analisar|opiniao|sincera|o que acha|melhorar)\b/.test(text)) {
    return "analysis_or_feedback";
  }
  if (/\b(resuma|resumo|resumir|rapido|em poucas palavras)\b/.test(text)) {
    return "summary";
  }
  if (/\b(explica|explique|entender|como funciona|o que e|o que é|para que serve|por que)\b/.test(text)) {
    return "explanation";
  }
  if (/\b(calcular|calcule|quantos|quanto|m2|m²|m3|m³|bloco|concreto|laje|parede|piso|argamassa|tinta)\b/.test(text)) {
    return "technical_calculation";
  }
  if (/\b(vender|marketing|lancar|cliente|lojista|anuncio|video|frase|copy)\b/.test(text)) {
    return "marketing_strategy";
  }
  if (/\b(retomar|continuar|voltar|proximo passo)\b/.test(text)) {
    return "continue_project";
  }
  if (/\b(erro|bug|quebrou|nao funciona|corrigir|consertar)\b/.test(text)) {
    return "debug_or_fix";
  }
  if (/\b(guardar|salvar|lembrar|memoria|biblioteca)\b/.test(text)) {
    return "memory_or_library";
  }
  return "general_conversation";
}

export function buildProjectKnowledgeContext_(input = {}) {
  const sourceText = typeof input === "string"
    ? input
    : [
      input.projectKnowledgeQuery,
      input.message,
      input.userMessage,
      input.eloIntentSummary,
      input.productContextSummary,
      input.relevantMemoriesSummary,
      input.libraryRelevantSummary
    ].map(clean_).filter(Boolean).join(" ");
  const keywords = extractContextKeywords_(sourceText);
  const wantsProjectInventory = keywords.includes("projetos");
  const selectedKeys = wantsProjectInventory
    ? ["cadista", "stockfull", "elo", "stocksaude", "obrareport"]
    : Object.keys(PROJECT_KNOWLEDGE).filter((key) => {
      const aliases = PROJECT_KNOWLEDGE[key].aliases || [];
      return keywords.includes(key) || aliases.some((alias) => keywords.includes(normalizeEloSearchText_(alias)));
    });

  if (!selectedKeys.length) {
    return "";
  }

  const blocks = selectedKeys.map((key) => {
    const project = PROJECT_KNOWLEDGE[key];
    return [
      "[" + project.name + "]",
      "Resumo: " + project.summary,
      "Estrategia: " + project.strategy,
      "Fluxo: " + project.flow.join(" -> "),
      "Prioridades: " + project.priorities.join("; ")
    ].join("\n");
  });

  return [
    "Conhecimento permanente dos projetos do usuario.",
    "Prioridade: quando a pergunta citar um projeto abaixo, use este conhecimento antes de conhecimento geral do modelo.",
    "Nao substitua este conhecimento por respostas genericas.",
    blocks.join("\n\n")
  ].join("\n");
}

export function extractContextKeywords_(text) {
  const normalized = normalizeEloSearchText_(text);
  const keywords = [];
  const add = (keyword) => {
    if (keyword && !keywords.includes(keyword)) {
      keywords.push(keyword);
    }
  };

  if (/\bprojetos?\b/.test(normalized)) {
    add("projetos");
  }

  Object.values(PROJECT_ALIASES).forEach((aliases) => {
    aliases.forEach((alias) => {
      const normalizedAlias = normalizeEloSearchText_(alias);
      if (hasEloSearchPhrase_(normalized, normalizedAlias)) {
        if (normalizedAlias.startsWith("stock ")) {
          add("stock");
        }
        add(normalizedAlias);
      }
    });
  });

  return keywords;
}

export function detectEloIntent_(message, context = {}, history = [], options = {}) {
  const text = normalizeEloDecisionText_(message);
  const eloContext = normalizeEloContext_(context && context.eloContext ? context.eloContext : context);
  const categories = [];
  const add = (category) => {
    if (category && !categories.includes(category)) {
      categories.push(category);
    }
  };

  if (!text || /\b(oi|ola|olá|bom dia|boa tarde|boa noite|quem e voce|quem é você)\b/.test(text)) add("conversa");
  if (/\b(que saco|cansado|cansada|nao funciona|não funciona|frustrado|frustrada|ta dificil|tá difícil)\b/.test(text)) add("acolhimento");
  if (/\b(orçamento|orcamento|orcar|orçar|orça|orca|quanto custa|quanto vai dar|preco|preço|valor|custo|mao de obra|mão de obra|materiais|tabela teste|tabela sample|sample)\b/.test(text)) add("orçamento");
  if (/\b(calcular|calcule|quantos|quanto|m2|m²|m3|m³|20x3|8x10|parede|laje|concreto|bloco|cabo)\b/.test(text)) add("cálculo");
  if (/\b(explique|explica|o que e|o que é|como funciona|conceito|tecnica|técnica)\b/.test(text)) add("pergunta técnica");
  if (/\b(lembre|lembrar|memoria|memória|prefiro|preferencia|preferência|gosto de)\b/.test(text)) add("memória");
  if (/\b(biblioteca|guardar na biblioteca|guarde na biblioteca|documentar para consultar)\b/.test(text)) add("biblioteca");
  if (/\b(relatorio|relatório|laudo|vistoria|parecer|rdo|diario de obra|diário de obra|registrar ocorrencia|registrar ocorrência|ocorrencia de atraso|ocorrência de atraso|exportar relatorio|exportar relatório)\b/.test(text) || /analisar.*(trinca|fissura|infiltra|mofo|umidade)/.test(text)) add("relatório");
  if (/\b(pdf|exportar|gerar pdf)\b/.test(text)) {
    add("pdf");
    add("relatório");
  }
  if (/\b(estoque|almoxarifado|stock full|entrada|saida|saída|saldo|produto|produtos parados|auditoria)\b/.test(text)) add("estoque");
  if (/\b(obra|obras|parede|laje|concreto|bloco|alvenaria|piso|argamassa|canteiro|fissura|infiltracao|infiltração)\b/.test(text)) add("obras");
  if (/\b(saude|saúde|medicamento|medicamentos|lote|validade|hospital|farmacia|farmácia)\b/.test(text)) add("saúde");
  if (/\b(cadista|cadista ai|cadista ia|elo projeto|elo-projeto|planta|planta baixa|terreno|quarto|quartos|suite|suíte|garagem|recuo|recuos|ambiente|ambientes|porta|janela|cota|cotas|prancha|dxf|svg)\b/.test(text)) add("cadista");
  if (/\b(planejamento|estrategia|estratégia|roadmap|plano|prioridade|proximo passo|próximo passo)\b/.test(text)) add("planejamento");
  if (/\b(resumo|resuma|resumir|sintese|síntese)\b/.test(text)) add("resumo");
  if (/\b(documento|documentos|contrato|arquivo|texto anexado)\b/.test(text)) add("documento");
  if (options.hasAttachments || /\b(anexo|anexei|arquivo anexado|pdf anexado)\b/.test(text)) add("anexo");

  if (eloContext === "obras") add("obras");
  if (eloContext === "saude") add("saúde");
  if (eloContext === "cadista") add("cadista");
  if (!categories.length) add("conversa");

  const priority = ["acolhimento", "anexo", "pdf", "memória", "biblioteca", "cadista", "orçamento", "relatório", "estoque", "saúde", "cálculo", "obras", "resumo", "planejamento", "pergunta técnica", "conversa"];
  const primary = priority.find((category) => categories.includes(category)) || categories[0];
  const productContext = inferEloProductContext_(categories, eloContext, text, history);

  return {
    primary,
    categories,
    productContext,
    needsMemory: categories.some((category) => ["memória", "resumo", "conversa", "planejamento"].includes(category)),
    needsLibrary: categories.some((category) => ["biblioteca", "documento", "resumo", "pergunta técnica"].includes(category)),
    hasAttachment: categories.includes("anexo")
  };
}

function inferEloProductContext_(categories, eloContext, text, history = []) {
  if (categories.includes("cadista") || eloContext === "cadista") return "cadista";
  if (categories.includes("orçamento")) return "obras";
  if (categories.includes("saúde") || eloContext === "saude") return "saúde";
  if (categories.includes("estoque") && /\b(stock full|almoxarifado|entrada|saida|saída|produtos parados)\b/.test(text)) return "estoque";
  if (categories.includes("obras") || eloContext === "obras") return "obras";
  if (/\b(elo)\b/.test(text) || normalizeEloDecisionText_(getEloHistoryText_(history)).includes("elo")) return "elo";
  return "geral";
}

function detectEloProjectContextFromText_(text) {
  if (/\b(stock full|loja|lojista|almoxarifado|entrada|saida|estoque)\b/.test(text)) {
    return "stock_full";
  }
  if (/\b(stock ai obras|sinapi|orse|composicao|obra|bloco|laje|concreto|parede|piso|argamassa)\b/.test(text)) {
    return "stock_ai_obras";
  }
  if (/\b(obrareport|relatorio|rdo|diario de obra|patologia|fissura|infiltracao)\b/.test(text)) {
    return "obrareport";
  }
  if (/\b(stock saude|medicamento|lote|validade|saude|hospital|posto)\b/.test(text)) {
    return "stock_saude";
  }
  if (/\b(cadista|planta|layout|casa|ambiente|terreno|recuo)\b/.test(text)) {
    return "cadista_ai";
  }
  if (/\b(elo informe|bueiro|boeiro|buraco|ocorrencia urbana|prefeitura|cidadao)\b/.test(text)) {
    return "elo_informe";
  }
  if (/\belo\b/.test(text)) {
    return "elo_core";
  }
  return "";
}

function isImplicitEloContinuation_(text) {
  if (!text) return true;
  return /\b(retomar|continuar|voltar|proximo passo|isso|esse projeto|essa ideia|essa resposta|vamos|e agora)\b/.test(text);
}

function getEloHistoryText_(history = []) {
  if (!Array.isArray(history)) return "";
  return history
    .slice(-6)
    .map((entry) => clean_(entry && entry.content))
    .filter(Boolean)
    .join(" ");
}

function sanitizeEloUserProfile_(userProfile = {}) {
  if (!userProfile || typeof userProfile !== "object") return {};
  const name = clean_(userProfile.name).slice(0, 120);
  const style = clean_(userProfile.style).slice(0, 240);
  return {
    ...(name ? { name } : {}),
    ...(style ? { style } : {})
  };
}

export function detectEloProjectContext(message, currentContext = "geral", history = []) {
  const text = normalizeEloDecisionText_(message);
  const directContext = detectEloProjectContextFromText_(text);
  if (directContext) return directContext;

  if (isImplicitEloContinuation_(text)) {
    const historyContext = detectEloProjectContextFromText_(normalizeEloDecisionText_(getEloHistoryText_(history)));
    if (historyContext) return historyContext;
  }

  return currentContext || "geral";
}

export function detectEloTone(originalMessage) {
  const text = normalizeEloDecisionText_(originalMessage);
  if (/\bkk|kkkk|haha|rsrs\b/.test(text)) return "brincalhao_informal";
  if (/\b(cara|mano|pelo amor|urgente|rapido)\b/.test(text)) return "direto_apressado";
  if (/\b(nao entendi|confuso|perdido)\b/.test(text)) return "confuso";
  if (/\b(amei|top|perfeito|boa)\b/.test(text)) return "positivo";
  if (/\b(ruim|horrivel|pessimo|bagunca)\b/.test(text)) return "frustrado";
  return "neutro";
}

export function detectExpectedEloAnswerStyle(original, normalized, intent) {
  const text = normalizeEloDecisionText_(original);
  if (intent === "codex_task_or_code") return "prompt_pronto_para_copiar";
  if (/\b(rapido|resumo|so diga|direto)\b/.test(text)) {
    return "curto_direto";
  }
  if (/\b(codigo completo|prompt completo|passo a passo|onde clicar)\b/.test(text)) {
    return "detalhado_pratico";
  }
  if (intent === "technical_calculation") return "resultado_primeiro_com_calculo_curto";
  if (intent === "marketing_strategy") return "opiniao_sincera_com_recomendacao";
  return "natural_objetivo";
}

export function shouldEloAskClarification({ originalMessage, normalizedMessage, detectedIntent, projectContext, history } = {}) {
  const text = normalizeEloDecisionText_(normalizedMessage);
  if (detectedIntent === "technical_calculation") {
    const hasNumbers = /\d/.test(text);
    const hasKnownItem = /\b(bloco|parede|laje|concreto|piso|argamassa|tinta|telha|cabo|estoque)\b/.test(text);
    if (hasNumbers && hasKnownItem) return false;
  }
  if (["codex_task_or_code", "analysis_or_feedback", "marketing_strategy"].includes(detectedIntent)) return false;
  if (detectedIntent === "continue_project" && projectContext !== "geral") return false;
  if (String(originalMessage || "").trim().length < 4) return true;
  return false;
}

export function interpretEloUserMessage({ message, history = [], context = "geral", userProfile = {} } = {}) {
  const raw = String(message || "").trim();
  const normalized = normalizeEloText(raw);
  const eloContext = normalizeEloContext_(context);
  const profile = sanitizeEloUserProfile_(userProfile);
  const intent = detectEloIntent(normalized, eloContext, history);
  const tone = detectEloTone(raw);
  const projectContext = detectEloProjectContext(normalized, eloContext, history);
  const expectedAnswerStyle = detectExpectedEloAnswerStyle(raw, normalized, intent);
  const operationalRoute = routeEloRequest_({ message: raw, history, context: { eloContext } });

  return {
    originalMessage: raw,
    normalizedMessage: normalized,
    detectedIntent: intent,
    emotionalTone: tone,
    projectContext,
    expectedAnswerStyle,
    context: eloContext,
    eloContext,
    operationalRoute,
    userProfile: profile,
    shouldAskClarification: shouldEloAskClarification({
      originalMessage: raw,
      normalizedMessage: normalized,
      detectedIntent: intent,
      projectContext,
      history
    })
  };
}

export function getEloPersonalityPrompt_(input = "geral") {
  if (input && typeof input === "object" && input.interpretation) {
    const interpretation = input.interpretation;
    const userProfile = interpretation.userProfile || {};
    const userName = clean_(userProfile.name || "Ícaro Amaral");
    const userStyle = clean_(userProfile.style || "direto, prático e objetivo");
    return [
      "Você é o Elo, assistente técnico e estratégico de " + userName + ".",
      "Perfil do usuário:\nNome: " + userName + "\nEstilo preferido: " + userStyle,
      "Antes de responder, considere esta interpretação da mensagem do usuário:",
      "Mensagem original:\n" + clean_(interpretation.originalMessage),
      "Mensagem normalizada:\n" + clean_(interpretation.normalizedMessage),
      "Intenção detectada:\n" + clean_(interpretation.detectedIntent),
      "Tom emocional:\n" + clean_(interpretation.emotionalTone),
      "Contexto provável:\n" + clean_(interpretation.projectContext),
      "Estilo esperado:\n" + clean_(interpretation.expectedAnswerStyle),
      "Regras de conversa:",
      "- Responda ao que o usuário quis dizer, não apenas ao texto literal.",
      "- Entenda erros de digitação, abreviações e frases incompletas.",
      "- Não corrija o usuário de forma pedante.",
      "- Não diga 'você quis dizer' se a intenção estiver clara.",
      "- Responda primeiro, explique depois.",
      "- Use 1 a 3 parágrafos por padrão. Só use lista quando o usuário pedir ou quando ela deixar a decisão claramente melhor.",
      "- Não repita a pergunta do usuário.",
      "- Não repita contexto nem nomes de projetos se isso já estiver claro na conversa.",
      "- Pergunte apenas se faltar informação essencial.",
      "- Não escreva convites de salvamento, botões, 'Guardar', 'Não guardar' ou 'Biblioteca do Elo' dentro da resposta.",
      "- Seja direto, natural, profissional e útil, como um profissional experiente conversando com outro profissional.",
      "- Para " + userName.split(" ")[0] + ", adapte a linguagem ao estilo preferido quando informado.",
      "- Quando ele pedir código, prompt ou Codex, entregue algo pronto para copiar.",
      "- Quando ele pedir opinião, seja sincero.",
      "- Quando ele estiver falando de projeto, use o contexto do projeto.",
      "- Evite respostas genéricas.",
      "- Evite tom de documentação, manual técnico, FAQ ou texto institucional.",
      "- Evite começar com frases como 'Entendi.', 'Vou analisar.', 'Vou considerar.', 'Em forma local...' ou 'Retomando pelo ponto mais seguro...'.",
      "- Se o usuário demonstrar desânimo, frustração, dúvida ou insegurança, reconheça o contexto de forma humana e profissional, sem autoajuda genérica nem linguagem terapêutica."
    ].join("\n\n");
  }

  const context = normalizeEloContext_(input);
  const contextTone = {
    geral: "adapte exemplos para projetos, decisões, documentos e planejamento pessoal ou profissional.",
    obras: "adapte exemplos para obra, engenharia civil, RDO, materiais, medição, consumo, estoque de obra e documentação técnica.",
    saude: "adapte exemplos para saúde, almoxarifado hospitalar, farmácia, validade, lote, rastreabilidade, compras e auditoria.",
    cadista: "adapte exemplos para CADISTA AI, plantas por texto, terreno, recuos, ambientes, aberturas, cotas, prancha tecnica, SVG, PDF e DXF quando o backend confirmar."
  };

  return [
    "Padrão único de conversa do Elo:",
    "Responda primeiro de forma direta. Depois explique só o necessário. Depois sugira um próximo passo prático quando isso ajudar.",
    "Não repita a pergunta do usuário. Não comece com 'Você quer...' quando a intenção já estiver clara.",
    "Se houver dados suficientes, responda direto. Se faltar dado essencial, pergunte apenas o que falta.",
    "Use linguagem natural, profissional, objetiva e curta. Evite burocracia, rodeios e respostas longas para pedidos simples.",
    "Use 1 a 3 parágrafos por padrão. Evite listas se o usuário não pediu lista.",
    "Converse como um profissional experiente falando com outro profissional. Dê opinião técnica quando for apropriado.",
    "Evite repetir contexto, nomes de projetos e explicações institucionais que não ajudem a decisão atual.",
    "Evite tom de documentação, manual técnico, FAQ ou atendimento corporativo.",
    "Evite começar com 'Entendi.', 'Vou analisar.', 'Vou considerar.', 'Em forma local...' ou 'Retomando pelo ponto mais seguro...'.",
    "Quando houver desânimo, frustração, dúvida ou insegurança, reconheça o contexto sem autoajuda genérica e responda com firmeza profissional.",
    "Nunca inclua texto de salvamento ou botões na resposta. Não escreva 'Deseja guardar', 'Guardar', 'Não guardar' ou 'Biblioteca do Elo' como chamada de ação; isso é metadado da interface.",
    "Em cálculos simples, destaque o resultado, mostre a base considerada, perdas ou variações quando fizer sentido e finalize com uma observação útil.",
    "Regra dura para quantitativos de materiais de obra: não invente consumo. Para blocos, tijolos, cimento, areia, argamassa, concreto, chapisco, emboço, reboco, pintura, piso, orçamento e consumo de material, use Stock AI Obras, SINAPI/ORSE importado ou composição interna. Se não houver base confiável, diga que só pode fazer estimativa preliminar e peça os dados técnicos que faltam.",
    "Para blocos e tijolos, nunca use coeficiente fixo genérico por m2 sem dimensão do bloco, junta, espessura da parede, perda e tipo de assentamento.",
    contextTone[context]
  ].join(" ");
}

export function buildEloMasterContext_(context = {}) {
  const eloContext = normalizeEloContext_(context.eloContext);
  return [
    buildEloContextPrompt_(eloContext),
    buildProjectKnowledgeContext_(context),
    getEloPersonalityPrompt_(eloContext)
  ].filter(Boolean).join(" ");
}

export function formatEloFinalResponse_({ result, explanation, nextStep, warnings } = {}) {
  const parts = [];
  const directResult = clean_(result);
  const shortExplanation = clean_(explanation);
  const practicalNextStep = clean_(nextStep);
  const technicalWarnings = Array.isArray(warnings)
    ? warnings.map(clean_).filter(Boolean)
    : (clean_(warnings) ? [clean_(warnings)] : []);

  if (directResult) {
    parts.push(directResult);
  }
  if (shortExplanation) {
    parts.push(shortExplanation);
  }
  if (practicalNextStep) {
    parts.push(practicalNextStep);
  }
  if (technicalWarnings.length) {
    parts.push("Aviso técnico: " + technicalWarnings.join(" "));
  }

  return sanitizeEloAnswerText_(parts.join("\n\n"));
}

export function shouldShowEloSavePrompt_({ userMessage, assistantResponse, context, intent } = {}) {
  const text = normalizeEloDecisionText_([userMessage, intent].join(" "));
  const answer = normalizeEloDecisionText_(assistantResponse);
  const eloContext = normalizeEloContext_(context && context.eloContext);

  if (!text && !answer) {
    return { show: false, reason: "empty", suggestedTarget: "none" };
  }

  if (isSimpleEloCalculation_(text)) {
    return { show: false, reason: "simple_calculation", suggestedTarget: "none" };
  }

  if (["teste", "ola", "olá", "oi", "bom dia", "boa tarde", "boa noite"].includes(text.trim())) {
    return { show: false, reason: "low_future_value", suggestedTarget: "none" };
  }

  if (hasAnyEloDecisionTerm_(text, ["biblioteca", "guardar na biblioteca", "guarde na biblioteca", "usar depois", "resumo de reuniao", "resumo de reunião", "roadmap", "especificacao de produto", "especificação de produto"])) {
    return { show: true, reason: "reusable_technical_content", suggestedTarget: "library" };
  }

  if (hasAnyEloDecisionTerm_(text, ["guarde", "guardar", "lembre", "lembrar", "prefiro", "minha preferencia", "minha preferência", "regra de negocio", "regra de negócio", "preferencia permanente", "preferência permanente"])) {
    return { show: true, reason: "durable_memory", suggestedTarget: "memory" };
  }

  if (hasAnyEloDecisionTerm_(text, ["decisao estrategica", "decisão estratégica", "estrategia do projeto", "estratégia do projeto", "planejamento importante", "plano de acao", "plano de ação", "roadmap", "stock full"]) && answer.length > 220) {
    return { show: true, reason: "strategic_decision", suggestedTarget: "both" };
  }

  if (eloContext === "saude" && hasAnyEloDecisionTerm_(text, ["protocolo", "auditoria", "compras", "validade", "lote"])) {
    return { show: true, reason: "health_operations_reference", suggestedTarget: "library" };
  }

  return { show: false, reason: "not_reusable_enough", suggestedTarget: "none" };
}

function sanitizeEloAnswerText_(value) {
  const forbiddenLine = /^\s*(?:guardar|não guardar|nao guardar|guardar na biblioteca|não guardar na biblioteca|nao guardar na biblioteca|guardar biblioteca|memória|memoria|biblioteca|não salvar|nao salvar)\s*$/i;
  const cleanedLines = String(value || "")
    .replace(/Deseja guardar isso para eu lembrar depois\??/gi, "")
    .replace(/Deseja guardar isso na Biblioteca do Elo\??/gi, "")
    .replace(/Deseja guardar isso na Biblioteca\??/gi, "")
    .replace(/Deseja guardar isso para a Biblioteca\??/gi, "")
    .replace(/Salvar esta conversa\??/gi, "")
    .replace(/\bGuardar na Biblioteca\b/gi, "")
    .replace(/\bNão guardar na Biblioteca\b/gi, "")
    .replace(/\bNao guardar na Biblioteca\b/gi, "")
    .split(/\r?\n/)
    .filter((line) => !forbiddenLine.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleanedLines
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildEloSavePromptMeta_(decision) {
  const safeDecision = decision && typeof decision === "object" ? decision : {};
  const show = safeDecision.show === true;
  const suggestedTarget = show ? clean_(safeDecision.suggestedTarget || safeDecision.type || "memory") : "none";
  const type = !show
    ? "none"
    : (suggestedTarget === "library" ? "library" : "memory");

  return {
    show,
    type,
    suggestedTarget: show ? suggestedTarget : "none",
    reason: clean_(safeDecision.reason || (show ? "valuable_context" : "not_reusable_enough"))
  };
}

let eloTechnicalValidatorCache_ = null;

function getEloTechnicalValidator_() {
  if (eloTechnicalValidatorCache_) {
    return eloTechnicalValidatorCache_;
  }
  const source = readFileSync(ELO_TECHNICAL_VALIDATOR_PATH, "utf8");
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: ELO_TECHNICAL_VALIDATOR_PATH });
  eloTechnicalValidatorCache_ = sandbox.window.EloTechnicalValidator || null;
  return eloTechnicalValidatorCache_;
}

function getEloTechnicalValidationResult_(message, options = {}) {
  try {
    const validator = getEloTechnicalValidator_();
    if (!validator || typeof validator.validateTechnicalQuestion !== "function") {
      return null;
    }
    return validator.validateTechnicalQuestion(message, options);
  } catch (error) {
    return null;
  }
}

function validateEloTechnicalQuestion_(message, options = {}) {
  const result = getEloTechnicalValidationResult_(message, options);
  return result && result.shouldRespond ? result : null;
}
export function createApp(options = {}) {
  const app = express();
  const env = options.env || process.env;
  const stockDemoStore = options.stockDemoStore || createStockDemoStore_();
  const eloVectorMemoryStore = options.eloVectorMemoryStore || createEloVectorMemoryStore_({ path: env.ELO_VECTOR_MEMORY_PATH || ELO_VECTOR_MEMORY_PATH, env });
  const eloCoreStore = options.eloCoreStore || createEloCoreStore({ dataPath: env.ELO_CORE_STORE_PATH || ELO_CORE_STORE_PATH });
  const stockSaudeSupabaseClient = options.stockSaudeSupabaseClient || null;
  const stockFullSupabaseClient = options.stockFullSupabaseClient || null;
  const getStockSaudeDatabase = (response) => requireStockSaudeDatabase_(env, response, stockSaudeSupabaseClient);
  const getStockFullDatabase = (response) => requireStockFullDatabase_(env, response, stockFullSupabaseClient);

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = String(env.AI_ALLOWED_ORIGINS || "https://www.icaroamaral.com.br,https://icaroamaral.com.br,http://localhost,http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5502,http://localhost:5502")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      callback(null, allowed.includes(origin) || isPrivateNetworkOrigin_(origin));
    }
  }));
  app.use(express.json({ limit: env.AI_JSON_LIMIT || "3mb" }));

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "ObraReport AI Backend"
    });
  });

  app.get("/api/stock-demo/health", (request, response) => {
    response.json({
      ok: true,
      service: "Stock AI Demo Backend",
      mode: "memory"
    });
  });

  app.get("/api/stock-saude/health", (request, response) => {
    const supabaseClient = stockSaudeSupabaseClient || getSupabaseClient(env);
    response.json({
      ok: true,
      module: "stock-saude",
      database: supabaseClient ? "supabase_configured" : "not_configured",
      ...(supabaseClient ? {} : { fallback: "localStorage" })
    });
  });

  app.get("/api/stock-full/health", (request, response) => {
    const supabaseClient = stockFullSupabaseClient || getSupabaseClient(env);
    response.json({
      ok: true,
      module: "stock-full",
      database: supabaseClient ? "supabase_configured" : "not_configured",
      ...(supabaseClient ? {} : { fallback: "localStorage" })
    });
  });

  app.get("/api/stock-full/me", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    response.json({
      ok: true,
      module: "stock-full",
      mode: "remote",
      user: {
        id: session.user.id,
        email: session.user.email || ""
      },
      profile: session.profile
    });
  });

  app.get("/api/stock-saude/me", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    response.json({
      ok: true,
      user: {
        id: session.user.id,
        email: session.user.email || ""
      },
      profile: {
        id: session.profile.id,
        institution_id: session.profile.institution_id,
        unit_id: session.profile.unit_id,
        name: session.profile.name,
        email: session.profile.email,
        role: session.profile.role
      }
    });
  });

  app.get("/api/stock-full/items", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_items")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .eq("is_active", true)
        .order("name", { ascending: true });
      if (error) {
        throw error;
      }
      response.json({
        ok: true,
        mode: "remote",
        items: (data || []).map(mapStockFullItemFromDatabase_)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_items_query_failed" });
    }
  });

  app.post("/api/stock-full/items", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    const validation = validateStockFullItemPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_items")
        .insert(validation.payload)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      response.json({ ok: true, mode: "remote", item: mapStockFullItemFromDatabase_(data) });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_items_create_failed" });
    }
  });

  app.put("/api/stock-full/items/:id", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    const itemId = clean_(request.params.id);
    const validation = validateStockFullItemPayload_(request.body || {}, session.profile, { update: true });
    if (!itemId) {
      response.status(400).json({ ok: false, error: "item_id_required" });
      return;
    }
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_items")
        .update(validation.payload)
        .eq("id", itemId)
        .eq("institution_id", session.profile.institution_id)
        .eq("is_active", true)
        .select("*")
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }
      response.json({ ok: true, mode: "remote", item: mapStockFullItemFromDatabase_(data) });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_items_update_failed" });
    }
  });

  app.delete("/api/stock-full/items/:id", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    const itemId = clean_(request.params.id);
    if (!itemId) {
      response.status(400).json({ ok: false, error: "item_id_required" });
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_items")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", itemId)
        .eq("institution_id", session.profile.institution_id)
        .eq("is_active", true)
        .select("*")
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (!data) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }
      response.json({ ok: true, mode: "remote", item: mapStockFullItemFromDatabase_(data) });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_items_delete_failed" });
    }
  });

  app.get("/api/stock-full/entries", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_entries")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      response.json({
        ok: true,
        mode: "remote",
        entries: (data || []).map(mapStockFullEntryFromDatabase_)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_entries_query_failed" });
    }
  });

  app.post("/api/stock-full/entries", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    const validation = validateStockFullEntryPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const item = await getStockFullItemForProfile_(database, validation.payload.item_id, session.profile);
      if (!item) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }

      const nextQuantity = parsePositiveNumber_(item.current_quantity, 0) + validation.payload.quantity;
      const { data: updatedItem, error: updateError } = await database
        .from("stock_full_items")
        .update({ current_quantity: nextQuantity, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("institution_id", session.profile.institution_id)
        .eq("is_active", true)
        .select("*")
        .maybeSingle();
      if (updateError) {
        throw updateError;
      }
      if (!updatedItem) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }

      const { data: entry, error: entryError } = await database
        .from("stock_full_entries")
        .insert(validation.payload)
        .select("*")
        .single();
      if (entryError) {
        throw entryError;
      }

      await createStockFullAuditLog_(database, {
        institutionId: session.profile.institution_id,
        action: "entry_created",
        entityType: "stock_full_entries",
        entityId: entry.id,
        description: "Entrada registrada para " + (updatedItem.name || "produto") + ".",
        createdBy: session.profile.id
      });

      response.json({
        ok: true,
        mode: "remote",
        entry: mapStockFullEntryFromDatabase_(entry),
        item: mapStockFullItemFromDatabase_(updatedItem)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_entries_create_failed" });
    }
  });

  app.get("/api/stock-full/exits", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_exits")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      response.json({
        ok: true,
        mode: "remote",
        exits: (data || []).map(mapStockFullExitFromDatabase_)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_exits_query_failed" });
    }
  });

  app.post("/api/stock-full/exits", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    const validation = validateStockFullExitPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const item = await getStockFullItemForProfile_(database, validation.payload.item_id, session.profile);
      if (!item) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }

      const currentQuantity = parsePositiveNumber_(item.current_quantity, 0);
      if (validation.payload.quantity > currentQuantity) {
        response.status(409).json({ ok: false, error: "stock_full_insufficient_quantity" });
        return;
      }

      const nextQuantity = currentQuantity - validation.payload.quantity;
      const { data: updatedItem, error: updateError } = await database
        .from("stock_full_items")
        .update({ current_quantity: nextQuantity, updated_at: new Date().toISOString() })
        .eq("id", item.id)
        .eq("institution_id", session.profile.institution_id)
        .eq("is_active", true)
        .select("*")
        .maybeSingle();
      if (updateError) {
        throw updateError;
      }
      if (!updatedItem) {
        response.status(404).json({ ok: false, error: "stock_full_item_not_found" });
        return;
      }

      const { data: exit, error: exitError } = await database
        .from("stock_full_exits")
        .insert(validation.payload)
        .select("*")
        .single();
      if (exitError) {
        throw exitError;
      }

      await createStockFullAuditLog_(database, {
        institutionId: session.profile.institution_id,
        action: "stock_full_exit_created",
        entityType: "stock_full_exit",
        entityId: exit.id,
        description: "Saída registrada para " + (updatedItem.name || "produto") + ": " +
          validation.payload.quantity + " " + (updatedItem.unit || "un") + ".",
        createdBy: session.profile.id
      });

      response.json({
        ok: true,
        mode: "remote",
        exit: mapStockFullExitFromDatabase_(exit),
        item: mapStockFullItemFromDatabase_(updatedItem)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_exits_create_failed" });
    }
  });

  app.get("/api/stock-full/audit-log", async (request, response) => {
    const database = getStockFullDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockFullAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_full_audit_log")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (error) {
        throw error;
      }
      response.json({
        ok: true,
        mode: "remote",
        auditLog: (data || []).map(mapStockFullAuditLogFromDatabase_)
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_full_audit_log_query_failed" });
    }
  });

  app.get("/api/stock-saude/items", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      let query = database
        .from("stock_items")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("name", { ascending: true });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      response.json({ ok: true, items: data || [] });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_items_query_failed" });
    }
  });

  app.post("/api/stock-saude/items", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }
    if (!requireStockSaudePermission_(session.profile, "create_item", response)) {
      return;
    }

    const validation = validateStockSaudeItemPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_items")
        .insert(validation.payload)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      await createStockSaudeAuditLog_(database, {
        institutionId: data.institution_id,
        unitId: data.unit_id,
        profileId: session.profile.id,
        action: "item_created",
        entityType: "stock_items",
        entityId: data.id,
        metadata: { name: data.name, category: data.category }
      });
      response.json({ ok: true, item: data });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_item_create_failed" });
    }
  });

  app.get("/api/stock-saude/entries", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      let query = database
        .from("stock_entries")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      response.json({ ok: true, entries: data || [] });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_entries_query_failed" });
    }
  });

  app.post("/api/stock-saude/entries", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }
    if (!requireStockSaudePermission_(session.profile, "create_entry", response)) {
      return;
    }

    const validation = validateStockSaudeEntryPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const itemInScope = await isStockSaudeItemInProfileScope_(database, validation.payload.item_id, session.profile);
      if (!itemInScope) {
        response.status(403).json({ ok: false, error: "item_not_in_profile_scope" });
        return;
      }

      const { data, error } = await database
        .from("stock_entries")
        .insert(Object.assign({}, validation.payload, { status: "pendente" }))
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      await createStockSaudeAuditLog_(database, {
        institutionId: data.institution_id,
        unitId: data.unit_id,
        profileId: data.requested_by,
        action: "entry_created",
        entityType: "stock_entries",
        entityId: data.id,
        metadata: { item_id: data.item_id, quantity: data.quantity }
      });
      response.json({ ok: true, entry: data });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_entry_create_failed" });
    }
  });

  app.post("/api/stock-saude/entries/:id/approve", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }
    await updateStockSaudeEntryStatus_(request, response, database, "aprovada", "approve_entry");
  });

  app.post("/api/stock-saude/entries/:id/reject", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }
    await updateStockSaudeEntryStatus_(request, response, database, "rejeitada", "reject_entry");
  });

  app.get("/api/stock-saude/exits", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      let query = database
        .from("stock_exits")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      response.json({ ok: true, exits: data || [] });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_exits_query_failed" });
    }
  });

  app.post("/api/stock-saude/exits", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }
    if (!requireStockSaudePermission_(session.profile, "create_exit", response)) {
      return;
    }

    const validation = validateStockSaudeExitPayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const itemInScope = await isStockSaudeItemInProfileScope_(database, validation.payload.item_id, session.profile);
      if (!itemInScope) {
        response.status(403).json({ ok: false, error: "item_not_in_profile_scope" });
        return;
      }

      const availableQuantity = await calculateStockSaudeItemBalance_(database, validation.payload.item_id);
      if (availableQuantity < validation.payload.quantity) {
        response.status(400).json({
          ok: false,
          error: "insufficient_stock",
          available_quantity: availableQuantity
        });
        return;
      }

      const { data, error } = await database
        .from("stock_exits")
        .insert(validation.payload)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      await createStockSaudeAuditLog_(database, {
        institutionId: data.institution_id,
        unitId: data.unit_id,
        profileId: data.created_by,
        action: "exit_created",
        entityType: "stock_exits",
        entityId: data.id,
        metadata: { item_id: data.item_id, quantity: data.quantity }
      });
      response.json({ ok: true, exit: data });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_exit_create_failed" });
    }
  });

  app.get("/api/stock-saude/balance", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    const itemId = clean_(request.query.item_id);

    try {
      let query = database
        .from("stock_items")
        .select("id,name,category,unit,minimum_quantity,institution_id,unit_id")
        .eq("institution_id", session.profile.institution_id)
        .order("name", { ascending: true });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      if (itemId) {
        query = query.eq("id", itemId);
      }

      const { data: items, error } = await query;
      if (error) {
        throw error;
      }
      const balance = await buildStockSaudeBalance_(database, items || []);
      response.json({ ok: true, balance });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_balance_query_failed" });
    }
  });

  app.get("/api/stock-saude/dashboard", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      const scopedItemsQuery = database
        .from("stock_items")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("name", { ascending: true });
      const scopedEntriesQuery = database
        .from("stock_entries")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      const scopedExitsQuery = database
        .from("stock_exits")
        .select("*")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      const scopedAuditQuery = database
        .from("stock_audit_log")
        .select("*")
        .eq("institution_id", session.profile.institution_id);

      if (session.profile.unit_id) {
        scopedItemsQuery.eq("unit_id", session.profile.unit_id);
        scopedEntriesQuery.eq("unit_id", session.profile.unit_id);
        scopedExitsQuery.eq("unit_id", session.profile.unit_id);
        scopedAuditQuery.eq("unit_id", session.profile.unit_id);
      }

      const [
        { data: items, error: itemsError },
        { data: entries, error: entriesError },
        { data: exits, error: exitsError },
        { data: auditLogs, error: auditError }
      ] = await Promise.all([scopedItemsQuery, scopedEntriesQuery, scopedExitsQuery, scopedAuditQuery]);
      if (itemsError || entriesError || exitsError || auditError) {
        throw itemsError || entriesError || exitsError || auditError;
      }

      const safeItems = items || [];
      const safeEntries = entries || [];
      const safeExits = exits || [];
      const balance = await buildStockSaudeBalance_(database, safeItems);
      const now = new Date();

      response.json({
        ok: true,
        dashboard: {
          totalItems: safeItems.length,
          totalEntries: safeEntries.length,
          totalExits: safeExits.length,
          pendingEntries: safeEntries.filter((entry) => entry.status === "pendente").length,
          approvedEntries: safeEntries.filter((entry) => entry.status === "aprovada").length,
          rejectedEntries: safeEntries.filter((entry) => entry.status === "rejeitada").length,
          lowStockItems: balance.filter((item) => item.current_quantity > 0 && item.current_quantity < item.minimum_quantity).length,
          expiredItems: safeItems.filter((item) => isStockSaudeExpired_(item.expiration_date, now)).length,
          expiringSoonItems: safeItems.filter((item) => isStockSaudeExpiringSoon_(item.expiration_date, now)).length,
          totalBalance: balance.reduce((sum, item) => sum + Number(item.current_quantity || 0), 0),
          auditCount: (auditLogs || []).length,
          recentEntries: safeEntries.slice(0, 5),
          recentExits: safeExits.slice(0, 5)
        }
      });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_dashboard_query_failed" });
    }
  });

  app.get("/api/stock-saude/audit-log", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }

    try {
      let query = database
        .from("stock_audit_log")
        .select("action,entity_type,entity_id,profile_id,created_at")
        .eq("institution_id", session.profile.institution_id)
        .order("created_at", { ascending: false });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      const auditLog = (data || []).map((log) => ({
        profile_name: log.profile_id === session.profile.id ? session.profile.name : "",
        action: log.action,
        entity_type: log.entity_type,
        entity_id: log.entity_id,
        profile_id: log.profile_id,
        created_at: log.created_at
      }));
      response.json({ ok: true, auditLog });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_audit_log_query_failed" });
    }
  });

  app.get("/api/stock-saude/invites", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }
    if (!requireStockSaudePermission_(session.profile, "read_invites", response)) {
      return;
    }

    try {
      let query = database
        .from("stock_saude_invites")
        .select("id,institution_id,unit_id,email,role,created_by,status,created_at")
        .eq("institution_id", session.profile.institution_id)
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (session.profile.unit_id) {
        query = query.eq("unit_id", session.profile.unit_id);
      }
      const { data, error } = await query;
      if (error) {
        throw error;
      }
      response.json({ ok: true, invites: data || [] });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_invites_query_failed" });
    }
  });

  app.post("/api/stock-saude/invites", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    const session = await requireStockSaudeAuth_(request, response, database);
    if (!session) {
      return;
    }
    if (!requireStockSaudePermission_(session.profile, "create_invite", response)) {
      return;
    }

    const validation = validateStockSaudeInvitePayload_(request.body || {}, session.profile);
    if (!validation.ok) {
      response.status(400).json({ ok: false, error: validation.error });
      return;
    }

    try {
      const { data, error } = await database
        .from("stock_saude_invites")
        .insert(validation.payload)
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      await createStockSaudeAuditLog_(database, {
        institutionId: data.institution_id,
        unitId: data.unit_id,
        profileId: session.profile.id,
        action: "invite_created",
        entityType: "stock_saude_invites",
        entityId: data.id,
        metadata: { email: data.email, role: data.role }
      });
      response.json({ ok: true, invite: data });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_invite_create_failed" });
    }
  });

  app.post("/api/stock-saude/invites/accept", async (request, response) => {
    const database = getStockSaudeDatabase(response);
    if (!database) {
      return;
    }

    try {
      const userResult = await getSupabaseUserFromRequest_(request, database);
      if (!userResult.ok) {
        response.status(userResult.status).json({ ok: false, error: userResult.error });
        return;
      }

      const user = userResult.user;
      const email = clean_(user && user.email).toLowerCase();
      if (!email) {
        response.status(400).json({ ok: false, error: "authenticated_email_required" });
        return;
      }

      const invite = await findPendingStockSaudeInviteByEmail_(database, email);
      if (!invite) {
        response.status(404).json({ ok: false, error: "stock_saude_invite_not_found" });
        return;
      }

      const institutionExists = await stockSaudeRecordExists_(database, "institutions", invite.institution_id);
      const unitExists = await stockSaudeRecordExists_(database, "units", invite.unit_id);
      if (!institutionExists) {
        response.status(400).json({ ok: false, error: "institution_not_found" });
        return;
      }
      if (!unitExists) {
        response.status(400).json({ ok: false, error: "unit_not_found" });
        return;
      }

      let profile = await getStockSaudeProfileByAuthUser_(database, user.id);
      if (!profile) {
        const { data, error } = await database
          .from("profiles")
          .insert({
            auth_user_id: user.id,
            institution_id: invite.institution_id,
            unit_id: invite.unit_id,
            name: getStockSaudeUserDisplayName_(user, email),
            email,
            role: invite.role
          })
          .select("id,institution_id,unit_id,name,email,role")
          .single();
        if (error) {
          throw error;
        }
        profile = data;
      }

      const acceptedAt = new Date().toISOString();
      await database
        .from("stock_saude_invites")
        .update({
          status: "aceito",
          accepted_at: acceptedAt
        })
        .eq("id", invite.id)
        .single();

      await createStockSaudeAuditLog_(database, {
        institutionId: invite.institution_id,
        unitId: invite.unit_id,
        profileId: profile.id,
        action: "accept_invite",
        entityType: "stock_saude_invites",
        entityId: invite.id,
        metadata: { email, role: invite.role }
      });

      response.json({ ok: true, profile, invite: Object.assign({}, invite, { status: "aceito", accepted_at: acceptedAt }) });
    } catch (error) {
      response.status(500).json({ ok: false, error: "stock_saude_invite_accept_failed" });
    }
  });

  app.get("/api/stock-demo/state", (request, response) => {
    const key = getStockDemoRequestKey_(request);
    const entry = stockDemoStore.states.get(key);

    response.json({
      ok: true,
      key,
      state: entry ? entry.state : null,
      revision: entry ? entry.revision : 0,
      updatedAt: entry ? entry.updatedAt : ""
    });
  });

  app.post("/api/stock-demo/state", (request, response) => {
    const validation = validateStockDemoStateRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    const entry = saveStockDemoState_(stockDemoStore, validation.key, validation.state);
    response.json({
      ok: true,
      key: validation.key,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    });
  });

  app.post("/api/stock-demo/approval-requests", (request, response) => {
    const validation = validateStockDemoApprovalRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    const entry = upsertStockDemoApprovalRequest_(stockDemoStore, validation.key, validation.request, validation.state);
    response.json({
      ok: true,
      key: validation.key,
      request: validation.request,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    });
  });

  app.post("/api/stock-demo/approval-requests/:id/approve", (request, response) => {
    const result = updateStockDemoApprovalStatus_(stockDemoStore, getStockDemoRequestKey_(request), request.params.id, "approved", request.body || {});

    if (!result.ok) {
      response.status(result.status).json({
        ok: false,
        error: result.message
      });
      return;
    }

    response.json(result.payload);
  });

  app.post("/api/stock-demo/approval-requests/:id/reject", (request, response) => {
    const result = updateStockDemoApprovalStatus_(stockDemoStore, getStockDemoRequestKey_(request), request.params.id, "rejected", request.body || {});

    if (!result.ok) {
      response.status(result.status).json({
        ok: false,
        error: result.message
      });
      return;
    }

    response.json(result.payload);
  });

  app.post("/api/ai/improve-text", async (request, response) => {
    const validation = validateRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    if (!env.OPENAI_API_KEY) {
      response.status(503).json({
        ok: false,
        error: "Backend de IA sem OPENAI_API_KEY configurada. O frontend deve usar o modo local."
      });
      return;
    }

    try {
      const suggestion = await callOpenAi_(validation.payload, env);
      response.json({
        ok: true,
        mode: "remote",
        title: getActionTitle_(validation.payload.action),
        suggestion,
        note: "Sugestão gerada com backend seguro. Revise antes de aplicar ao relatório."
      });
    } catch (error) {
      console.error("Falha na IA real:", error);
      response.status(502).json({
        ok: false,
        error: "A IA não respondeu agora. Tente novamente em instantes ou use o modo local."
      });
    }
  });

  app.post("/api/ai/analyze-image", async (request, response) => {
    const validation = validateImageRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    if (!env.OPENAI_API_KEY) {
      response.status(503).json({
        ok: false,
        error: "Backend de IA visual sem OPENAI_API_KEY configurada. O frontend deve continuar sem quebrar."
      });
      return;
    }

    try {
      const analysis = await callOpenAiVision_(validation.payload, env);
      response.json({
        ok: true,
        mode: "remote",
        title: "Análise visual da foto",
        analysis,
        suggestion: formatImageAnalysis_(analysis),
        note: "Análise visual gerada com backend seguro. Revise antes de aplicar ao relatório."
      });
    } catch (error) {
      console.error("Falha na IA visual:", error);
      response.status(502).json({
        ok: false,
        error: "A IA visual não respondeu agora. Tente novamente em instantes."
      });
    }
  });



  function getTrustedEloCoreUserId_(request) {
    return clean_(
      request.user && (request.user.id || request.user.userId) ||
      request.auth && (request.auth.userId || request.auth.user_id || request.auth.sub) ||
      request.headers["x-elo-auth-user-id"] ||
      request.headers["x-authenticated-user-id"] ||
      ""
    );
  }
  function getEloCoreIdentity_(request) {
    const trustedUserId = getTrustedEloCoreUserId_(request);
    return {
      userId: trustedUserId,
      anonymousId: clean_(request.body && (request.body.anonymousId || request.body.anonymous_id) || request.query && (request.query.anonymousId || request.query.anonymous_id))
    };
  }
  function sendEloCoreError_(response, error) {
    response.status(error && error.status ? error.status : 400).json({ ok: false, error: clean_(error && error.message || "elo_core_error") });
  }

  app.get("/api/elo/conversations", (request, response) => {
    try { response.json({ ok: true, conversations: eloCoreStore.listConversations(Object.assign(getEloCoreIdentity_(request), { includeArchived: request.query.includeArchived })) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.post("/api/elo/conversations", (request, response) => {
    try { response.status(201).json({ ok: true, conversation: eloCoreStore.createConversation(Object.assign({}, request.body || {}, getEloCoreIdentity_(request))) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.get("/api/elo/conversations/:id", (request, response) => {
    try { response.json(Object.assign({ ok: true }, eloCoreStore.getConversation(request.params.id, getEloCoreIdentity_(request)))); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.put("/api/elo/conversations/:id", (request, response) => {
    try { response.json({ ok: true, conversation: eloCoreStore.updateConversation(request.params.id, request.body || {}, getEloCoreIdentity_(request)) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.post("/api/elo/conversations/:id/messages", (request, response) => {
    try { response.status(201).json({ ok: true, message: eloCoreStore.addMessage(request.params.id, Object.assign({}, request.body || {}, getEloCoreIdentity_(request))) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.post("/api/elo/identity/merge", (request, response) => {
    try { response.json(eloCoreStore.mergeAnonymous(request.body && request.body.anonymousId, getTrustedEloCoreUserId_(request))); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.get("/api/elo/memories", (request, response) => {
    try { response.json({ ok: true, memories: eloCoreStore.listMemories(Object.assign(getEloCoreIdentity_(request), { includeInactive: request.query.includeInactive })) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.post("/api/elo/memories", (request, response) => {
    try {
      if (request.body && (request.body.memoryDisabled === true || request.body.memory_disabled === true)) {
        response.json({ ok: true, memory: null, skipped: "memory_disabled" });
        return;
      }
      response.status(201).json({ ok: true, memory: eloCoreStore.upsertMemory(Object.assign({}, request.body || {}, getEloCoreIdentity_(request))) });
    }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.put("/api/elo/memories/:id", (request, response) => {
    try { response.json({ ok: true, memory: eloCoreStore.updateMemory(request.params.id, request.body || {}, getEloCoreIdentity_(request)) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.delete("/api/elo/memories/:id", (request, response) => {
    try { response.json({ ok: true, memory: eloCoreStore.deleteMemory(request.params.id, getEloCoreIdentity_(request)) }); }
    catch (error) { sendEloCoreError_(response, error); }
  });
  app.delete("/api/elo/memories", (request, response) => {
    try { response.json(eloCoreStore.clearMemories(getEloCoreIdentity_(request))); }
    catch (error) { sendEloCoreError_(response, error); }
  });

  app.post("/api/elo/vector-memory", async (request, response) => {
    const validation = validateEloVectorMemoryRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    try {
      const item = await eloVectorMemoryStore.upsert(validation.payload);
      response.json({
        ok: true,
        mode: item.embeddingProvider === "openai" ? "openai_vector" : "local_vector",
        item: {
          id: item.id,
          text: item.text,
          category: item.category,
          embeddingProvider: item.embeddingProvider,
          embeddingModel: item.embeddingModel,
          embeddingDimensions: item.embeddingDimensions,
          schemaVersion: item.schemaVersion,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }
      });
    } catch (error) {
      console.error("Falha ao salvar memoria vetorial do Elo:", error);
      response.status(503).json({
        ok: false,
        mode: "vector_unavailable",
        error: "Memoria vetorial indisponivel. O Elo pode continuar com a memoria local."
      });
    }
  });

  app.post("/api/elo/chat", async (request, response) => {
    let chatRequest;

    try {
      chatRequest = await buildEloChatRequest_(request, env, eloVectorMemoryStore);
    } catch (error) {
      const message = error && error.message ? error.message : "Nao consegui receber o anexo enviado.";
      response.status(error && error.status ? error.status : 400).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: buildEloAttachmentErrorAnswer_([message]),
        error: message,
        attachmentErrors: [message]
      });
      return;
    }

    const validation = validateEloChatRequest_(chatRequest.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: "Não consegui acessar minha inteligência online agora, mas ainda posso conversar com você de forma local.",
        error: validation.message
      });
      return;
    }

    validation.payload.context.documentsSummary = chatRequest.documentsSummary;
    validation.payload.context.attachmentErrors = chatRequest.attachmentErrors;
    validation.payload.interpretation = interpretEloUserMessage({
      message: validation.payload.message,
      history: validation.payload.history,
      context: validation.payload.context.eloContext,
      userProfile: {
        name: "Ícaro Amaral",
        style: "direto, prático, informal, constrói SaaS próprios"
      }
    });
    validation.payload.eloIntent = detectEloIntent_(validation.payload.message, validation.payload.context, validation.payload.history, {
      hasAttachments: Boolean(chatRequest.documents.length || chatRequest.attachmentErrors.length)
    });
    validation.payload.operationalRoute = routeEloRequest_({
      message: validation.payload.message,
      history: validation.payload.history,
      context: validation.payload.context
    });

    const technicalValidation = validateEloTechnicalQuestion_(validation.payload.message, {
      entry: "backend_elo_chat",
      context: validation.payload.context
    });
    if (technicalValidation) {
      const answer = sanitizeEloAnswerText_(technicalValidation.answer);
      response.json({
        ok: true,
        mode: "technical_validation",
        fallback: false,
        answer,
        savePrompt: buildEloSavePromptMeta_({ show: false, reason: technicalValidation.reason || "technical_validation", suggestedTarget: "none" }),
        interpretation: validation.payload.interpretation,
        eloIntent: validation.payload.eloIntent,
        operationalRoute: validation.payload.operationalRoute,
        technicalValidation,
        contextSummary: {
          conversationSummary: "",
          productContextSummary: buildEloProductContextSummary_(validation.payload.eloIntent, validation.payload.context),
          hasRelevantMemory: false,
          hasRelevantLibrary: false
        },
        documents: [],
        stockIaLaunchPlan: null,
        attachmentErrors: chatRequest.attachmentErrors
      });
      return;
    }

    if (shouldUseCadistaOperationalGuard_(validation.payload.operationalRoute)) {
      const answer = sanitizeEloAnswerText_(buildCadistaUnsupportedExecutionAnswer_(validation.payload.operationalRoute));
      response.json({
        ok: true,
        mode: "operational_guard",
        fallback: false,
        answer,
        savePrompt: buildEloSavePromptMeta_({ show: false, reason: "operational_guard", suggestedTarget: "none" }),
        interpretation: validation.payload.interpretation,
        eloIntent: validation.payload.eloIntent,
        operationalRoute: validation.payload.operationalRoute,
        contextSummary: {
          conversationSummary: "",
          productContextSummary: buildEloProductContextSummary_(validation.payload.eloIntent, validation.payload.context),
          hasRelevantMemory: false,
          hasRelevantLibrary: false
        },
        documents: [],
        stockIaLaunchPlan: null,
        attachmentErrors: chatRequest.attachmentErrors
      });
      return;
    }

    if (!env.OPENAI_API_KEY) {
      const answer = sanitizeEloAnswerText_(buildEloOfflineFallbackAnswer_(chatRequest.documents, chatRequest.attachmentErrors, validation.payload.interpretation));
      const savePrompt = buildEloSavePromptMeta_(shouldShowEloSavePrompt_({
        userMessage: validation.payload.message,
        assistantResponse: answer,
        context: validation.payload.context,
        intent: validation.payload.interpretation.detectedIntent
      }));
      response.status(503).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer,
        savePrompt,
        error: "Backend do Elo sem OPENAI_API_KEY configurada.",
        interpretation: validation.payload.interpretation,
        attachmentErrors: chatRequest.attachmentErrors
      });
      return;
    }

    try {
      const relevantContext = await getEloRelevantContext_({
        payload: validation.payload,
        memoryStore: eloVectorMemoryStore,
        documents: chatRequest.documents,
        attachmentErrors: chatRequest.attachmentErrors
      });
      Object.assign(validation.payload.context, relevantContext.context);
      validation.payload.history = relevantContext.compactHistory;
      validation.payload.eloIntent = relevantContext.intent;
      if (relevantContext.context.stockIaLaunchPlan) {
        validation.payload.stockIaLaunchPlan = relevantContext.context.stockIaLaunchPlan;
      }
      const answer = sanitizeEloAnswerText_(await callOpenAiElo_(validation.payload, env));
      const savePrompt = buildEloSavePromptMeta_(shouldShowEloSavePrompt_({
        userMessage: validation.payload.message,
        assistantResponse: answer,
        context: validation.payload.context,
        intent: validation.payload.interpretation.detectedIntent
      }));
      response.json({
        ok: true,
        mode: "remote",
        fallback: false,
        answer,
        savePrompt,
        interpretation: validation.payload.interpretation,
        eloIntent: validation.payload.eloIntent,
        contextSummary: {
          conversationSummary: validation.payload.context.conversationSummary || "",
          productContextSummary: validation.payload.context.productContextSummary || "",
          hasRelevantMemory: Boolean(validation.payload.context.relevantMemoriesSummary),
          hasRelevantLibrary: Boolean(validation.payload.context.libraryRelevantSummary)
        },
        documents: chatRequest.documents.map((document) => ({
          fileName: document.fileName,
          mimeType: document.mimeType,
          textLength: document.text.length
        })),
        stockIaLaunchPlan: validation.payload.stockIaLaunchPlan || null,
        attachmentErrors: chatRequest.attachmentErrors
      });
    } catch (error) {
      console.error("Falha no Elo online:", error);
      const answer = sanitizeEloAnswerText_(buildEloLocalFallbackResponse_(validation.payload.interpretation));
      const savePrompt = buildEloSavePromptMeta_(shouldShowEloSavePrompt_({
        userMessage: validation.payload.message,
        assistantResponse: answer,
        context: validation.payload.context,
        intent: validation.payload.interpretation.detectedIntent
      }));
      response.status(502).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer,
        savePrompt,
        interpretation: validation.payload.interpretation,
        attachmentErrors: chatRequest.attachmentErrors
      });
    }
  });

  return app;
}

function requireStockSaudeDatabase_(env, response, databaseOverride = null) {
  const database = databaseOverride || getSupabaseClient(env);
  if (!database) {
    response.status(503).json({
      ok: false,
      error: "stock_saude_database_not_configured",
      fallback: "localStorage"
    });
    return null;
  }
  return database;
}

function requireStockFullDatabase_(env, response, databaseOverride = null) {
  const database = databaseOverride || getSupabaseClient(env);
  if (!database) {
    response.status(503).json({
      ok: false,
      error: "stock_full_database_not_configured",
      fallback: "localStorage"
    });
    return null;
  }
  return database;
}

async function getSupabaseUserFromRequest_(request, supabase) {
  const authorization = clean_(request.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]) {
    return { ok: false, status: 401, error: "authentication_required" };
  }

  const token = clean_(match[1]);
  if (!token) {
    return { ok: false, status: 401, error: "authentication_required" };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data || !data.user) {
    return { ok: false, status: 401, error: "invalid_session" };
  }

  return { ok: true, user: data.user };
}

async function getStockSaudeProfileByAuthUser_(supabase, authUserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,institution_id,unit_id,name,email,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function getStockFullProfileByAuthUser_(supabase, authUserId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,institution_id,unit_id,name,email,role")
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }
  return data || null;
}

async function findPendingStockSaudeInviteByEmail_(supabase, email) {
  for (const status of ["pendente", "pending"]) {
    const { data, error } = await supabase
      .from("stock_saude_invites")
      .select("*")
      .eq("email", email)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (data) {
      return data;
    }
  }
  return null;
}

async function stockSaudeRecordExists_(supabase, table, id) {
  if (!id) {
    return false;
  }
  const { data, error } = await supabase
    .from(table)
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return Boolean(data);
}

function getStockSaudeUserDisplayName_(user, email) {
  return clean_(user && user.user_metadata && (user.user_metadata.name || user.user_metadata.full_name))
    || clean_(user && user.name)
    || email.split("@")[0]
    || "Usuario Stock Saude";
}

async function requireStockSaudeAuth_(request, response, supabase) {
  try {
    const userResult = await getSupabaseUserFromRequest_(request, supabase);
    if (!userResult.ok) {
      response.status(userResult.status).json({ ok: false, error: userResult.error });
      return null;
    }

    const profile = await getStockSaudeProfileByAuthUser_(supabase, userResult.user.id);
    if (!profile) {
      response.status(403).json({ ok: false, error: "stock_saude_profile_not_found" });
      return null;
    }

    return {
      user: userResult.user,
      profile
    };
  } catch (error) {
    response.status(500).json({ ok: false, error: "stock_saude_auth_lookup_failed" });
    return null;
  }
}

async function requireStockFullAuth_(request, response, supabase) {
  try {
    const userResult = await getSupabaseUserFromRequest_(request, supabase);
    if (!userResult.ok) {
      response.status(userResult.status).json({ ok: false, error: userResult.error });
      return null;
    }

    const profile = await getStockFullProfileByAuthUser_(supabase, userResult.user.id);
    if (!profile) {
      response.status(403).json({ ok: false, error: "stock_full_profile_not_found" });
      return null;
    }

    return {
      user: userResult.user,
      profile
    };
  } catch (error) {
    response.status(500).json({ ok: false, error: "stock_full_auth_lookup_failed" });
    return null;
  }
}

function validateStockFullItemPayload_(body, profile, options = {}) {
  const update = Boolean(options.update);
  const payload = {
    institution_id: clean_(profile && profile.institution_id),
    name: clean_(body.name),
    unit: clean_(body.unit) || "un",
    category: clean_(body.category) || "Geral",
    min_quantity: parsePositiveNumber_(body.minQuantity ?? body.min_quantity ?? body.minimumStock, 0),
    current_quantity: parsePositiveNumber_(body.currentQuantity ?? body.current_quantity ?? body.initialQuantity, 0),
    location: clean_(body.location),
    notes: clean_(body.notes),
    updated_at: new Date().toISOString()
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.name) {
    return { ok: false, error: "name_required" };
  }
  if (!payload.unit) {
    return { ok: false, error: "unit_required" };
  }
  if (!update) {
    payload.created_by = clean_(profile && profile.id);
  }
  return { ok: true, payload };
}

function mapStockFullItemFromDatabase_(item) {
  const source = item || {};
  return {
    id: source.id,
    institution_id: source.institution_id,
    name: source.name || "",
    unit: source.unit || "un",
    category: source.category || "Geral",
    minQuantity: parsePositiveNumber_(source.min_quantity, 0),
    currentQuantity: parsePositiveNumber_(source.current_quantity, 0),
    location: source.location || "",
    notes: source.notes || "",
    isActive: source.is_active !== false,
    createdBy: source.created_by || "",
    createdAt: source.created_at || "",
    updatedAt: source.updated_at || ""
  };
}

function validateStockFullEntryPayload_(body, profile) {
  const payload = {
    institution_id: clean_(profile && profile.institution_id),
    item_id: clean_(body.itemId ?? body.item_id),
    quantity: parsePositiveNumber_(body.quantity),
    unit_cost: body.unitCost === undefined && body.unit_cost === undefined
      ? null
      : parsePositiveNumber_(body.unitCost ?? body.unit_cost, null),
    supplier: clean_(body.supplier),
    invoice_number: clean_(body.invoiceNumber ?? body.invoice_number),
    notes: clean_(body.notes),
    created_by: clean_(profile && profile.id)
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.item_id) {
    return { ok: false, error: "item_id_required" };
  }
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, error: "quantity_required" };
  }
  if (payload.unit_cost !== null && (!Number.isFinite(payload.unit_cost) || payload.unit_cost < 0)) {
    return { ok: false, error: "unit_cost_invalid" };
  }
  return { ok: true, payload };
}

function validateStockFullExitPayload_(body, profile) {
  const payload = {
    institution_id: clean_(profile && profile.institution_id),
    item_id: clean_(body.itemId ?? body.item_id),
    quantity: parsePositiveNumber_(body.quantity),
    destination: clean_(body.destination),
    responsible: clean_(body.responsible),
    notes: clean_(body.notes),
    created_by: clean_(profile && profile.id)
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.item_id) {
    return { ok: false, error: "item_id_required" };
  }
  if (!Number.isFinite(payload.quantity) || payload.quantity <= 0) {
    return { ok: false, error: "quantity_required" };
  }
  return { ok: true, payload };
}

async function getStockFullItemForProfile_(database, itemId, profile) {
  const { data, error } = await database
    .from("stock_full_items")
    .select("*")
    .eq("id", itemId)
    .eq("institution_id", profile.institution_id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data || null;
}

function mapStockFullEntryFromDatabase_(entry) {
  const source = entry || {};
  return {
    id: source.id,
    institution_id: source.institution_id,
    itemId: source.item_id || "",
    quantity: parsePositiveNumber_(source.quantity, 0),
    unitCost: source.unit_cost === null || source.unit_cost === undefined ? null : parsePositiveNumber_(source.unit_cost, 0),
    supplier: source.supplier || "",
    invoiceNumber: source.invoice_number || "",
    notes: source.notes || "",
    createdBy: source.created_by || "",
    createdAt: source.created_at || ""
  };
}

function mapStockFullExitFromDatabase_(exit) {
  const source = exit || {};
  return {
    id: source.id,
    institution_id: source.institution_id,
    itemId: source.item_id || "",
    quantity: parsePositiveNumber_(source.quantity, 0),
    destination: source.destination || "",
    responsible: source.responsible || "",
    notes: source.notes || "",
    createdBy: source.created_by || "",
    createdAt: source.created_at || ""
  };
}

async function createStockFullAuditLog_(database, data) {
  const payload = {
    institution_id: clean_(data.institutionId),
    action: clean_(data.action),
    entity_type: clean_(data.entityType),
    entity_id: clean_(data.entityId) || null,
    description: clean_(data.description),
    created_by: clean_(data.createdBy)
  };

  if (!payload.institution_id || !payload.action || !payload.entity_type) {
    return null;
  }

  const { data: auditLog, error } = await database
    .from("stock_full_audit_log")
    .insert(payload)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return auditLog;
}

function mapStockFullAuditLogFromDatabase_(record) {
  const source = record || {};
  return {
    id: source.id,
    institution_id: source.institution_id,
    action: source.action || "",
    entityType: source.entity_type || "",
    entityId: source.entity_id || "",
    description: source.description || "",
    createdBy: source.created_by || "",
    createdAt: source.created_at || ""
  };
}

function canStockSaudeRole_(profile, action) {
  const role = clean_(profile && profile.role).toLowerCase();
  if (role === "admin" || role === "administrador") {
    return true;
  }
  const permissions = {
    gestor: new Set([
      "create_item",
      "create_entry",
      "create_exit",
      "approve_entry",
      "reject_entry",
      "create_invite",
      "read_invites",
      "read"
    ]),
    almoxarife: new Set([
      "create_item",
      "create_entry",
      "create_exit",
      "read"
    ]),
    leitura: new Set(["read"])
  };
  return Boolean(permissions[role] && permissions[role].has(action));
}

function requireStockSaudePermission_(profile, action, response) {
  if (canStockSaudeRole_(profile, action)) {
    return true;
  }
  response.status(403).json({ ok: false, error: "permission_denied" });
  return false;
}

function validateStockSaudeItemPayload_(body, profile = null) {
  const payload = {
    institution_id: profile ? clean_(profile.institution_id) : clean_(body.institution_id),
    unit_id: profile ? clean_(profile.unit_id) : clean_(body.unit_id),
    name: clean_(body.name),
    category: clean_(body.category),
    unit: clean_(body.unit),
    minimum_quantity: parsePositiveNumber_(body.minimum_quantity, 0),
    location: clean_(body.location),
    batch: clean_(body.batch),
    expiration_date: clean_(body.expiration_date) || null
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.unit_id) {
    return { ok: false, error: "unit_id_required" };
  }
  if (!payload.name) {
    return { ok: false, error: "name_required" };
  }
  if (!payload.unit) {
    return { ok: false, error: "unit_required" };
  }
  return { ok: true, payload };
}

function validateStockSaudeEntryPayload_(body, profile = null) {
  const quantity = parsePositiveNumber_(body.quantity);
  const payload = {
    institution_id: profile ? clean_(profile.institution_id) : clean_(body.institution_id),
    unit_id: profile ? clean_(profile.unit_id) : clean_(body.unit_id),
    item_id: clean_(body.item_id),
    quantity,
    source: clean_(body.source),
    invoice_number: clean_(body.invoice_number),
    requested_by: profile ? clean_(profile.id) : clean_(body.requested_by) || null
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.unit_id) {
    return { ok: false, error: "unit_id_required" };
  }
  if (!payload.item_id) {
    return { ok: false, error: "item_id_required" };
  }
  if (!(quantity > 0)) {
    return { ok: false, error: "quantity_must_be_positive" };
  }
  return { ok: true, payload };
}

function validateStockSaudeExitPayload_(body, profile = null) {
  const quantity = parsePositiveNumber_(body.quantity);
  const payload = {
    institution_id: profile ? clean_(profile.institution_id) : clean_(body.institution_id),
    unit_id: profile ? clean_(profile.unit_id) : clean_(body.unit_id),
    item_id: clean_(body.item_id),
    quantity,
    destination_sector: clean_(body.destination_sector),
    purpose: clean_(body.purpose),
    responsible_name: clean_(body.responsible_name),
    created_by: profile ? clean_(profile.id) : clean_(body.created_by) || null
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.unit_id) {
    return { ok: false, error: "unit_id_required" };
  }
  if (!payload.item_id) {
    return { ok: false, error: "item_id_required" };
  }
  if (!(quantity > 0)) {
    return { ok: false, error: "quantity_must_be_positive" };
  }
  return { ok: true, payload };
}

function validateStockSaudeInvitePayload_(body, profile) {
  const email = clean_(body.email).toLowerCase();
  const role = clean_(body.role).toLowerCase();
  const allowedRoles = new Set(["administrador", "gestor", "almoxarife", "leitura"]);
  const payload = {
    institution_id: clean_(profile && profile.institution_id),
    unit_id: clean_(profile && profile.unit_id) || null,
    email,
    role,
    created_by: clean_(profile && profile.id) || null,
    status: "pendente"
  };

  if (!payload.institution_id) {
    return { ok: false, error: "institution_id_required" };
  }
  if (!payload.unit_id) {
    return { ok: false, error: "unit_id_required" };
  }
  if (!email) {
    return { ok: false, error: "email_required" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "invalid_email" };
  }
  if (!allowedRoles.has(role)) {
    return { ok: false, error: "invalid_role" };
  }
  return { ok: true, payload };
}

function parsePositiveNumber_(value, defaultValue = NaN) {
  const parsed = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

async function updateStockSaudeEntryStatus_(request, response, database, status, auditAction) {
  const session = await requireStockSaudeAuth_(request, response, database);
  if (!session) {
    return;
  }
  if (!requireStockSaudePermission_(session.profile, auditAction, response)) {
    return;
  }
  const entryId = clean_(request.params.id);
  if (!entryId) {
    response.status(400).json({ ok: false, error: "entry_id_required" });
    return;
  }

  try {
    const { data: currentEntry, error: readError } = await database
      .from("stock_entries")
      .select("*")
      .eq("id", entryId)
      .single();
    if (readError) {
      throw readError;
    }
    if (!currentEntry || currentEntry.status !== "pendente") {
      response.status(409).json({ ok: false, error: "entry_not_pending" });
      return;
    }
    if (
      currentEntry.institution_id !== session.profile.institution_id
      || currentEntry.unit_id !== session.profile.unit_id
    ) {
      response.status(403).json({ ok: false, error: "entry_not_in_profile_scope" });
      return;
    }

    const { data, error } = await database
      .from("stock_entries")
      .update({
        status,
        approved_by: session.profile.id,
        approved_at: new Date().toISOString()
      })
      .eq("id", entryId)
      .eq("status", "pendente")
      .eq("institution_id", session.profile.institution_id)
      .eq("unit_id", session.profile.unit_id)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    await createStockSaudeAuditLog_(database, {
      institutionId: data.institution_id,
      unitId: data.unit_id,
      profileId: session.profile.id,
      action: auditAction,
      entityType: "stock_entries",
      entityId: data.id,
      metadata: { item_id: data.item_id, quantity: data.quantity }
    });
    response.json({ ok: true, entry: data });
  } catch (error) {
    response.status(500).json({ ok: false, error: "stock_saude_entry_update_failed" });
  }
}

async function isStockSaudeItemInProfileScope_(database, itemId, profile) {
  const { data, error } = await database
    .from("stock_items")
    .select("id")
    .eq("id", itemId)
    .eq("institution_id", profile.institution_id)
    .eq("unit_id", profile.unit_id);
  if (error) {
    throw error;
  }
  return Array.isArray(data) && data.length > 0;
}

async function calculateStockSaudeItemBalance_(database, itemId) {
  const { data: entries, error: entriesError } = await database
    .from("stock_entries")
    .select("quantity")
    .eq("item_id", itemId)
    .eq("status", "aprovada");
  if (entriesError) {
    throw entriesError;
  }

  const { data: exits, error: exitsError } = await database
    .from("stock_exits")
    .select("quantity")
    .eq("item_id", itemId);
  if (exitsError) {
    throw exitsError;
  }

  return sumQuantity_(entries || []) - sumQuantity_(exits || []);
}

async function buildStockSaudeBalance_(database, items) {
  const itemIds = items.map((item) => item.id).filter(Boolean);
  if (!itemIds.length) {
    return [];
  }

  const { data: entries, error: entriesError } = await database
    .from("stock_entries")
    .select("item_id,quantity")
    .eq("status", "aprovada")
    .in("item_id", itemIds);
  if (entriesError) {
    throw entriesError;
  }

  const { data: exits, error: exitsError } = await database
    .from("stock_exits")
    .select("item_id,quantity")
    .in("item_id", itemIds);
  if (exitsError) {
    throw exitsError;
  }

  return items.map((item) => {
    const approvedEntriesQuantity = sumQuantity_((entries || []).filter((entry) => entry.item_id === item.id));
    const exitsQuantity = sumQuantity_((exits || []).filter((exit) => exit.item_id === item.id));
    const currentQuantity = approvedEntriesQuantity - exitsQuantity;
    const minimumQuantity = Number(item.minimum_quantity || 0);
    const status = currentQuantity <= 0 ? "zerado" : (currentQuantity <= minimumQuantity ? "baixo" : "ok");
    return {
      item_id: item.id,
      name: item.name,
      category: item.category,
      unit: item.unit,
      minimum_quantity: minimumQuantity,
      approved_entries_quantity: approvedEntriesQuantity,
      exits_quantity: exitsQuantity,
      current_quantity: currentQuantity,
      status
    };
  });
}

function sumQuantity_(items) {
  return items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getStockSaudeDaysUntil_(dateValue, now = new Date()) {
  if (!dateValue) {
    return null;
  }
  const target = new Date(String(dateValue).slice(0, 10) + "T00:00:00.000Z");
  if (Number.isNaN(target.getTime())) {
    return null;
  }
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.ceil((target.getTime() - today.getTime()) / 86400000);
}

function isStockSaudeExpired_(dateValue, now) {
  const days = getStockSaudeDaysUntil_(dateValue, now);
  return days !== null && days < 0;
}

function isStockSaudeExpiringSoon_(dateValue, now) {
  const days = getStockSaudeDaysUntil_(dateValue, now);
  return days !== null && days >= 0 && days <= 90;
}

async function createStockSaudeAuditLog_(database, payload) {
  try {
    await database
      .from("stock_audit_log")
      .insert({
        institution_id: payload.institutionId,
        unit_id: payload.unitId || null,
        profile_id: payload.profileId || null,
        action: payload.action,
        entity_type: payload.entityType,
        entity_id: payload.entityId || null,
        metadata: payload.metadata || {},
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.warn("Nao foi possivel registrar auditoria do Stock Saude.");
  }
}

function validateRequest_(body) {
  const action = normalizeAction_(body.action);
  const text = clean_(body.text);
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const contextSize = JSON.stringify(context).length;

  if (!ACTIONS.has(String(body.action || "")) && !action) {
    return {
      ok: false,
      status: 400,
      message: "Ação inválida. Use improve, conclusion ou review."
    };
  }

  if (action === "improve" && !text) {
    return {
      ok: false,
      status: 400,
      message: "Informe um texto para a IA melhorar."
    };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Texto muito longo para esta etapa da IA."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para esta etapa da IA."
    };
  }

  return {
    ok: true,
    payload: {
      action,
      text,
      context
    }
  };
}

function validateImageRequest_(body) {
  const image = body.image && typeof body.image === "object" ? body.image : {};
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const base64 = cleanBase64_(image.base64);
  const mimeType = clean_(image.mimeType || "image/jpeg").toLowerCase();
  const contextSize = JSON.stringify(context).length;

  if (!base64) {
    return {
      ok: false,
      status: 400,
      message: "Envie uma imagem processada para análise."
    };
  }

  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      status: 400,
      message: "Formato de imagem não suportado para análise visual."
    };
  }

  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Imagem muito grande para análise visual. Use a versão comprimida do ObraReport."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para esta análise visual."
    };
  }

  return {
    ok: true,
    payload: {
      image: {
        base64,
        mimeType,
        fileName: clean_(image.fileName || "foto.jpg"),
        width: Number(image.width || 0),
        height: Number(image.height || 0)
      },
      context
    }
  };
}

async function buildEloChatRequest_(request, env, memoryStore) {
  if (!/^multipart\/form-data/i.test(String(request.headers["content-type"] || ""))) {
    return {
      body: request.body || {},
      documents: [],
      documentsSummary: "",
      attachmentErrors: []
    };
  }

  const parsed = await parseEloMultipartFormData_(request, env);
  const body = {
    message: parsed.fields.message || "",
    eloContext: parsed.fields.eloContext || "",
    history: parseJsonField_(parsed.fields.history, []),
    context: parseJsonField_(parsed.fields.context, {})
  };
  const attachmentResult = await processEloAttachments_(parsed.files, body.context, env, memoryStore);
  return {
    body,
    documents: attachmentResult.documents,
    documentsSummary: buildEloDocumentsSummary_(attachmentResult.documents),
    attachmentErrors: (parsed.errors || []).concat(attachmentResult.errors)
  };
}

function parseJsonField_(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeEloContext_(value) {
  const context = clean_(value).toLowerCase().replace(/_/g, "-");
  if (["cadista", "cadista-ai", "cadista-ia", "elo-projeto"].includes(context)) {
    return "cadista";
  }
  return ["geral", "obras", "saude"].includes(context) ? context : "geral";
}

function parseCadistaDimension_(message, labelPattern) {
  const text = normalizeEloDecisionText_(message);
  const dimensionPattern = "(\\d+(?:[,.]\\d+)?)\\s*(?:m|metros?)?\\s*(?:x|por)\\s*(\\d+(?:[,.]\\d+)?)\\s*(?:m|metros?)?";
  const labelMatch = text.match(new RegExp(labelPattern + "[^\\d]{0,40}" + dimensionPattern, "i"));
  const fallbackMatch = text.match(new RegExp(dimensionPattern, "i"));
  const match = labelMatch || fallbackMatch;
  if (!match) {
    return null;
  }
  const width = Number(match[1].replace(",", "."));
  const depth = Number(match[2].replace(",", "."));
  if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) {
    return null;
  }
  return { width, depth };
}

function parseCadistaCount_(message, patterns) {
  const text = normalizeEloDecisionText_(message);
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const count = Number(match[1].replace(",", "."));
      if (Number.isFinite(count) && count > 0) {
        return Math.floor(count);
      }
    }
  }
  return null;
}

function mergeCadistaProjectState_(state, message) {
  const text = normalizeEloDecisionText_(message);
  const next = Object.assign({}, state, {
    missingData: Array.isArray(state.missingData) ? state.missingData.slice() : []
  });
  const hasTerrainTerm = /\b(terreno|lote)\b/.test(text);
  const hasHouseTerm = /\b(casa|planta|sobrado|edificacao|edificação|construcao|construção|area construida|área construída)\b/.test(text);
  const dimension = parseCadistaDimension_(message, hasTerrainTerm ? "\\b(?:terreno|lote)\\b" : "\\b(?:casa|planta|sobrado|edificacao|edificação|construcao|construção|area construida|área construída)\\b");

  if (dimension && hasTerrainTerm) {
    next.terrain = dimension;
  } else if (dimension && (hasHouseTerm || !next.house)) {
    next.house = dimension;
  }

  const bedrooms = parseCadistaCount_(message, [/(\d+)\s+quartos?\b/i, /(\d+)\s+dormitorios?\b/i, /(\d+)\s+dormitórios?\b/i]);
  if (bedrooms !== null) {
    next.bedrooms = bedrooms;
  }

  const suites = parseCadistaCount_(message, [/(\d+)\s+suites?\b/i, /(\d+)\s+suítes?\b/i]);
  if (suites !== null) {
    next.suites = suites;
  } else if (/\b(suite|suíte)\b/.test(text)) {
    next.suites = next.suites || true;
  }

  if (/\b(garagem|vaga|vagas|carro|carros)\b/.test(text)) {
    next.garage = true;
  }

  const floors = parseCadistaCount_(message, [/(\d+)\s+pavimentos?\b/i, /(\d+)\s+andares?\b/i]);
  if (floors !== null) {
    next.floors = floors;
  } else if (/\b(terrea|térrea)\b/.test(text)) {
    next.floors = 1;
  }

  if (/\b(recuo|recuos|afastamento|afastamentos)\b/.test(text)) {
    next.setbacks = next.setbacks || { requested: true, officialValidationRequiresLocalCode: true };
  }

  if (/\b(prancha|pdf|dxf|svg|arquivo|exportar|gerar planta|planta real|criar planta)\b/.test(text)) {
    next.sheet = "real_output_required";
    next.executionStatus = "awaiting_engine";
  } else if (/\b(layout|conceitual|preliminar|organizar|propor|sugerir)\b/.test(text) && next.sheet !== "real_output_required") {
    next.sheet = "conceptual";
  }

  return next;
}

export function buildCadistaProjectState_(input = {}) {
  const history = Array.isArray(input.history) ? input.history : [];
  const message = clean_(input.message || "");
  let state = {
    product: "CADISTA AI",
    terrain: null,
    house: null,
    bedrooms: null,
    suites: null,
    garage: null,
    floors: null,
    setbacks: null,
    sheet: "none",
    executionStatus: "conceptual_only",
    missingData: []
  };

  history.concat(message ? [{ role: "user", content: message }] : [])
    .filter((item) => item && item.role === "user" && clean_(item.content))
    .forEach((item) => {
      state = mergeCadistaProjectState_(state, item.content);
    });

  const missing = [];
  if (!state.terrain) missing.push("dimensoes do terreno");
  if (!state.house) missing.push("dimensoes da casa/area construida");
  if (state.bedrooms === null) missing.push("numero de quartos");
  if (state.garage === null) missing.push("garagem");
  if (state.floors === null) missing.push("pavimentos");
  if (!state.setbacks) missing.push("recuos/norma local");
  if (state.sheet === "real_output_required") missing.push("motor CADISTA ativo com output real");

  state.missingData = missing;
  if (state.sheet === "real_output_required") {
    state.executionStatus = "awaiting_engine";
  }
  return state;
}

function detectEloMemoryKind_(message) {
  const text = normalizeEloDecisionText_(message);
  if (/\b(prefiro|preferencia|preferência|gosto de|nao gosto|não gosto)\b/.test(text)) return "preferencia";
  if (/\b(decidi|decisao|decisão|aprovado|definido|vamos fazer)\b/.test(text)) return "decisao";
  if (/\b(terreno|casa|quartos?|suite|suíte|garagem|recuos?|prancha|pdf|dxf)\b/.test(text)) return "dado_de_projeto";
  return "conversa_descartavel";
}

function isCadistaDomain_(context, text) {
  return normalizeEloContext_(context && context.eloContext) === "cadista" ||
    /\b(cadista|cadista ai|cadista ia|elo projeto|elo-projeto|planta|planta baixa|terreno|quartos?|recuo|recuos|suite|suíte|garagem|prancha|dxf|svg)\b/.test(text);
}

export function routeEloRequest_(input = {}) {
  const message = clean_(input.message || "");
  const history = Array.isArray(input.history) ? input.history : [];
  const context = input.context && typeof input.context === "object" ? input.context : {};
  const text = normalizeEloDecisionText_(message);
  const domain = isCadistaDomain_(context, text)
    ? "cadista"
    : (normalizeEloContext_(context.eloContext) === "obras" ? "obras" : (normalizeEloContext_(context.eloContext) === "saude" ? "saude" : "geral"));
  let intent = "conversation";

  if (/\b(lembre|lembrar|guardar|salvar memoria|salvar memória|prefiro|preferencia|preferência)\b/.test(text)) intent = "remember";
  else if (/\b(validar|confere|conferir|recuo|recuos|norma|codigo de obras|código de obras)\b/.test(text)) intent = "validate";
  else if (/\b(gerar|criar|exportar|emitir|baixar)\b/.test(text) && /\b(prancha|pdf|dxf|svg|planta|arquivo)\b/.test(text)) intent = "generate";
  else if (/\b(executar|rodar|processar)\b/.test(text)) intent = "execute";
  else if (/\b(retomar|continuar|proximo passo|próximo passo|e agora|quero|terreno|suite|suíte|garagem)\b/.test(text) && history.length) intent = "continue_project";
  else if (/\?$|\b(como|qual|quais|quando|onde|por que|porque|o que)\b/.test(text)) intent = "question";

  const projectState = domain === "cadista" ? buildCadistaProjectState_({ message, history, context }) : null;
  const missingData = projectState ? projectState.missingData.slice() : [];
  const unsupportedExecution = domain === "cadista" && ["generate", "execute"].includes(intent);
  const needsBasis = domain === "cadista" && intent === "validate" && /recuo|recuos|norma|codigo|código/.test(text);
  if (needsBasis && !missingData.includes("recuos/norma local")) {
    missingData.push("recuos/norma local");
  }
  const needsData = Boolean((projectState && missingData.length) || needsBasis || unsupportedExecution);

  return {
    domain,
    intent,
    needsData,
    missingData,
    canExecute: !unsupportedExecution,
    shouldAskClarifyingQuestion: Boolean(needsData && (intent === "generate" || intent === "execute" || intent === "validate")),
    safetyLevel: unsupportedExecution ? "unsupported_execution" : (needsBasis ? "needs_basis" : "safe"),
    memoryKind: detectEloMemoryKind_(message),
    projectState
  };
}

function formatCadistaDimension_(dimension) {
  if (!dimension) return "";
  return formatObraQuantity_(dimension.width) + " x " + formatObraQuantity_(dimension.depth) + " m";
}

function formatCadistaKnownData_(state) {
  if (!state) return "nenhum dado de projeto confirmado";
  const items = [];
  if (state.terrain) items.push("terreno " + formatCadistaDimension_(state.terrain));
  if (state.house) items.push("casa/área " + formatCadistaDimension_(state.house));
  if (state.bedrooms !== null) items.push(state.bedrooms + " quarto(s)");
  if (state.suites) items.push(state.suites === true ? "suíte" : state.suites + " suíte(s)");
  if (state.garage) items.push("garagem");
  if (state.floors !== null) items.push(state.floors + " pavimento(s)");
  if (state.setbacks) items.push("recuos solicitados");
  return items.length ? items.join("; ") : "nenhum dado de projeto confirmado";
}

function formatCadistaMissingData_(state, limit = 6) {
  const missing = state && Array.isArray(state.missingData) ? state.missingData : [];
  return missing.length ? missing.slice(0, limit).join("; ") : "nenhum dado essencial pendente para orientação conceitual";
}

function shouldUseCadistaOperationalGuard_(route) {
  return Boolean(route && route.domain === "cadista" && (
    route.safetyLevel === "unsupported_execution" ||
    (route.intent === "validate" && route.safetyLevel === "needs_basis")
  ));
}

function buildCadistaUnsupportedExecutionAnswer_(route) {
  const safeRoute = route || {};
  const state = safeRoute.projectState || buildCadistaProjectState_({});
  const isValidation = safeRoute.intent === "validate";
  const opening = isValidation
    ? "Posso orientar a validação dos recuos, mas não vou tratar isso como validação oficial sem a norma municipal, zoneamento ou parâmetros legais do lote."
    : "Posso preparar a orientação conceitual, mas para gerar planta, prancha, PDF, DXF ou SVG real preciso do motor CADISTA ativo e de um output confirmado pelo backend.";
  return [
    opening,
    "Dados que já tenho: " + formatCadistaKnownData_(state) + ".",
    "Dados faltantes: " + formatCadistaMissingData_(state) + ".",
    isValidation
      ? "Próximo passo seguro: informe cidade/norma, recuo frontal, laterais e fundo exigidos; com isso eu confiro conceitualmente a implantação."
      : "Próximo passo seguro: completar os dados faltantes e então acionar o motor CADISTA quando ele estiver disponível. Até lá, a resposta fica conceitual."
  ].join("\n\n");
}

function formatEloOperationalSummary_(route) {
  if (!route) return "";
  const state = route.projectState;
  const lines = [
    "[ROTEADOR OPERACIONAL DO ELO]",
    "Dominio: " + route.domain,
    "Intencao: " + route.intent,
    "Nivel de seguranca: " + route.safetyLevel,
    "Pode executar agora: " + (route.canExecute ? "sim" : "nao"),
    "Deve perguntar dado faltante: " + (route.shouldAskClarifyingQuestion ? "sim" : "nao"),
    "Tipo de memoria seletiva: " + route.memoryKind
  ];
  if (state) {
    lines.push("Estado CADISTA: " + JSON.stringify(state));
    lines.push("Dados conhecidos: " + formatCadistaKnownData_(state));
    lines.push("Dados faltantes: " + formatCadistaMissingData_(state));
    lines.push("Regra: nunca afirmar execução real, PDF, DXF, SVG, prancha ou planta criada sem output confirmado do backend.");
  }
  return lines.join("\n");
}

function getSafePositiveInteger_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function createEloUploadError_(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildEloAttachmentErrorAnswer_(errors) {
  const firstError = Array.isArray(errors) && errors.length ? errors[0] : "";
  if (/grande demais/i.test(firstError)) {
    return "Não consegui ler o anexo porque o arquivo excede o limite desta versão do Elo.";
  }
  return "Não consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraível.";
}

function buildEloOfflineFallbackAnswer_(documents, errors, interpretation = null) {
  const readableDocuments = Array.isArray(documents) ? documents.filter((document) => document && document.text) : [];
  const attachmentErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];

  if (readableDocuments.length) {
    const names = readableDocuments.map((document) => document.fileName).join(", ");
    return "Recebi e consegui extrair texto do anexo: " + names + ". No momento não consegui acessar minha inteligência online para resumir ou responder sobre ele, mas o conteúdo já foi preparado para o contexto do Elo.";
  }

  if (attachmentErrors.length) {
    return buildEloAttachmentErrorAnswer_(attachmentErrors);
  }

  return buildEloLocalFallbackResponse_(interpretation);
}

function isEloGreeting_(text) {
  return /^(oi|ola|opa|bom dia|boa tarde|boa noite|hello|hi|ei|e ai)$/.test(clean_(text));
}

export function buildEloLocalFallbackResponse_(interpretation) {
  const intent = interpretation && interpretation.detectedIntent;
  const tone = interpretation && interpretation.emotionalTone;
  const projectContext = interpretation && interpretation.projectContext;
  const eloContext = normalizeEloContext_(interpretation && interpretation.eloContext);
  const originalMessage = clean_(interpretation && interpretation.originalMessage);
  const text = normalizeEloDecisionText_(originalMessage);

  if (isEloGreeting_(text)) {
    return "Oi. Me diga o que voce quer retomar ou resolver agora, e eu continuo direto pelo ponto certo.";
  }

  if (intent === "codex_task_or_code") {
    return "Eu iria direto para uma tarefa pequena e executável: definir o arquivo, o comportamento esperado e o teste de validação. Se você me passar o trecho atual, eu monto o prompt ou o código já no formato certo para aplicar.";
  }

  const safeConstructionQuantityAnswer = buildSafeConstructionQuantityResponse_(originalMessage, {
    source: "fallback_offline"
  });
  if (safeConstructionQuantityAnswer) {
    return safeConstructionQuantityAnswer;
  }

  const cookingAnswer = buildEloOfflineCookingFallback_(text);
  if (cookingAnswer) {
    return cookingAnswer;
  }

  const technicalExplanation = buildEloOfflineTechnicalExplanationFallback_(text);
  if (technicalExplanation) {
    return technicalExplanation;
  }

  if (intent === "continue_project") {
    return "Vale continuar se a proxima etapa for pequena o bastante para provar valor. Eu nao tentaria abracar o projeto inteiro agora; escolheria um ganho real, validaria e so depois abriria a proxima frente.";
  }

  if (eloContext === "cadista" || projectContext === "cadista_ai") {
    const route = interpretation && interpretation.operationalRoute ? interpretation.operationalRoute : routeEloRequest_({
      message: originalMessage,
      context: { eloContext: "cadista" }
    });
    return buildCadistaUnsupportedExecutionAnswer_(route);
  }

  const layoutAnswer = buildEloOfflineLayoutFallback_(text);
  if (layoutAnswer) {
    return layoutAnswer;
  }

  if (intent === "technical_calculation") {
    return "Dá para calcular, sim. Me passe as medidas principais e o material; eu te devolvo a quantidade aproximada, a premissa usada e uma margem de perda razoável.";
  }
  if (intent === "marketing_strategy") {
    return "Eu olharia isso como venda antes de olhar como texto bonito: dor clara, promessa concreta, prova visual e chamada para ação. Se uma dessas partes estiver fraca, a mensagem pode parecer boa e ainda assim não vender.";
  }

  if (intent === "analysis_or_feedback") {
    if (projectContext === "cadista_ai") {
      return "Acho que o CADISTA tem uma ideia forte, desde que continue começando pelo núcleo simples: geometria confiável, PDF legível e DXF editável. O risco não é a ideia ser fraca; é tentar virar BIM completo antes de provar essa primeira entrega.";
    }
    return "Eu olharia sem enfeitar: se a ideia está clara, se resolve uma dor real e se o próximo passo prova alguma coisa concreta. O resto dá para lapidar depois.";
  }

  if (tone === "frustrado") {
    return "Não quer dizer que ficou ruim. Pode estar cru, pesado ou fora do ponto, mas isso é diferente de estar perdido. Eu revisaria o que está sobrando e deixaria a parte que prova valor aparecer primeiro.";
  }

  if (/\b(desanimado|desanimo|desânimo|inseguro|duvida|dúvida)\b/i.test(interpretation && interpretation.originalMessage || "")) {
    return "Faz sentido bater esse cansaço quando o projeto cresce demais na cabeça. Eu não tomaria isso como sinal de que a ideia é ruim; tomaria como sinal de que precisa voltar para uma vitória menor e bem concreta.";
  }

  return "Eu ainda não tenho segurança para te responder isso bem nesse modo offline. Com o Elo online ativo eu consigo aprofundar melhor. Mas, pelo que dá para adiantar, eu começaria separando o que é dúvida real do que é falta de contexto e escolheria uma próxima ação pequena.";
}

export function detectConstructionQuantityIntent_(message) {
  const text = normalizeObraSearchText_(message);
  if (!text) {
    return false;
  }

  const hasQuantityAction = /\b(quantos|quanto|quantidade|calcule|calcular|materiais?|material|consumo|orcamento|orçamento|previsao|previsão|estimativa|estimar)\b/.test(text);
  const hasConstructionMaterial = /\b(bloco|blocos|tijolo|tijolos|cimento|areia|argamassa|concreto|reboco|chapisco|emboco|emboço|pintura|tinta|piso|revestimento|alvenaria|parede|laje)\b/.test(text);
  const hasMeasuredService = /\b(m2|m3|metros quadrados|metro quadrado|metros cubicos|metro cubico)\b/.test(text) && hasConstructionMaterial;
  const hasMetricDimensions = /\d+(?:[.,]\d+)?\s*m(?:etros?)?\s*(?:x|por)\s*\d+(?:[.,]\d+)?\s*m?/.test(text) && hasConstructionMaterial;

  return Boolean((hasQuantityAction && hasConstructionMaterial) || hasMeasuredService || hasMetricDimensions);
}

export function buildSafeConstructionQuantityResponse_(message, context = {}) {
  const technicalValidation = getEloTechnicalValidationResult_(message, {
    entry: "backend_safe_quantity_response",
    context
  });
  if (technicalValidation && technicalValidation.shouldRespond) {
    return technicalValidation.answer;
  }
  if (technicalValidation && technicalValidation.preliminary) {
    return "";
  }

  if (!detectConstructionQuantityIntent_(message)) {
    return "";
  }

  const text = normalizeObraSearchText_(message);
  const baseContext = buildPrevisaoConsumoContext(message);
  const sourceLabel = clean_(context && context.source);
  const lines = [
    "Eu não vou cravar esse consumo sem uma composição/base técnica. Posso fazer uma estimativa preliminar, mas para valor confiável preciso consultar SINAPI/ORSE ou uma composição cadastrada."
  ];

  if (baseContext) {
    lines.push("Existe uma base interna/demonstrativa que pode orientar a conversa, mas ela não substitui SINAPI/ORSE nem composição oficial de orçamento.");
  } else {
    lines.push("O caminho seguro é passar pelo Stock AI Obras ou por uma composição interna antes de transformar isso em lista de compra ou orçamento.");
  }

  if (/\b(bloco|blocos|tijolo|tijolos|alvenaria|parede)\b/.test(text)) {
    lines.push("Para blocos ou tijolos, preciso pelo menos da dimensão do bloco, junta, espessura da parede, perda e tipo de assentamento. Sem isso, qualquer número fixo por m² vira chute.");
  }

  if (/\b(reboco|emboco|emboço|chapisco|argamassa)\b/.test(text)) {
    lines.push("Para reboco, chapisco ou emboço, preciso de área, espessura, traço/base de composição e perda adotada. Sem esses dados, dá para falar de premissa, não de consumo fechado.");
  }

  if (/\b(concreto|laje)\b/.test(text)) {
    lines.push("Para concreto, primeiro separo o volume geométrico da composição de consumo. Volume pode ser calculado com dimensões; consumo de insumos depende do traço ou composição.");
  }

  if (sourceLabel === "prompt_context") {
    lines.push("Instrução para o Elo online: se responder, deixe explícito se está usando composição interna, Stock AI Obras, SINAPI/ORSE ou apenas estimativa preliminar.");
  }

  return lines.join("\n\n");
}

function buildEloOfflineCookingFallback_(text) {
  if (!/\b(receita|bolo|pizza|panela|forno|massa|ingrediente|cozinha)\b/.test(text)) {
    return "";
  }

  if (/\bbolo\b/.test(text) && /\bcenoura\b/.test(text)) {
    return "Claro. Um bolo de cenoura simples vai com cenoura, ovos, óleo, açúcar, farinha e fermento. Bata no liquidificador 3 cenouras médias, 3 ovos, 1 xícara de óleo e 2 xícaras de açúcar; depois misture com 2 xícaras de farinha e 1 colher de fermento.\n\nLeve ao forno médio, em forma untada, até firmar e dourar. Se quiser a cobertura clássica, faça uma calda rápida com chocolate, açúcar, manteiga e um pouco de leite.";
  }

  if (/\bbolo\b/.test(text) && /\bchocolate\b/.test(text)) {
    return "Claro. Para um bolo de chocolate simples, use: 3 ovos, 1 xícara de açúcar, 1/2 xícara de óleo, 1 xícara de leite morno, 1 xícara de chocolate ou cacau em pó, 2 xícaras de farinha de trigo e 1 colher de sopa de fermento.\n\nMisture ovos, açúcar, óleo e leite; depois incorpore chocolate, farinha e fermento. Coloque em forma untada e asse em forno preaquecido a 180°C por cerca de 35 a 40 minutos, até firmar. Para cobertura simples, leve ao fogo chocolate em pó, açúcar, leite e um pouco de manteiga até engrossar.";
  }

  if (/\bpizza\b/.test(text)) {
    return "Claro. Para pizza na panela, faça uma massa rápida com farinha, água, sal e um fio de óleo, abrindo bem fina para cozinhar direito. Doure um lado na frigideira, vire, coloque molho, queijo e recheio, tampe e deixe em fogo baixo até o queijo derreter.\n\nO segredo é não exagerar na massa nem no recheio, senão a base queima antes de cozinhar por completo.";
  }

  return "Dá para fazer de um jeito simples: escolha uma base, separe poucos ingredientes e controle o fogo ou forno com calma. Nesse modo offline eu não consigo aprofundar uma receita específica com precisão, mas consigo te passar um caminho básico e seguro se você disser o prato.";
}

function buildEloOfflineTechnicalExplanationFallback_(text) {
  const asksExplanation = /\b(como funciona|explique|explica|o que e|o que é|para que serve)\b/.test(text);
  const hasEngineeringSubject = /\b(laje|laje macica|laje maciça|viga|pilar|parede|concreto|fundacao|fundação|alvenaria|bloco)\b/.test(text);

  if (!asksExplanation && !/\bcomo fazer\b/.test(text)) {
    return "";
  }
  if (!hasEngineeringSubject) {
    return "";
  }

  if (/\blaje\b/.test(text)) {
    return "Uma laje maciça funciona como uma placa de concreto armado que recebe as cargas do piso, das pessoas, móveis e paredes leves, e leva esses esforços para vigas, pilares ou paredes estruturais.\n\nNa prática, ela depende de três coisas bem resolvidas: espessura adequada, armadura correta e bom escoramento durante a concretagem. Para dimensionar de verdade, entra cálculo estrutural; mas conceitualmente é isso: uma placa rígida distribuindo carga para a estrutura.";
  }

  if (/\bparede\b/.test(text)) {
    return "Para uma parede de 4 metros, eu começaria definindo altura, espessura e material: bloco cerâmico, bloco de concreto ou outro sistema. Depois vêm marcação no piso, conferência de prumo e nível, primeira fiada bem assentada e juntas de argamassa regulares.\n\nCom 4 metros de comprimento, também vale olhar amarração, encontros com pilares ou paredes existentes e, dependendo da altura, reforços ou vergas se tiver porta e janela. Sem altura e tipo de bloco eu não fecho quantitativo, mas o caminho executivo é esse.";
  }

  if (/\bviga\b/.test(text)) {
    return "Uma viga trabalha recebendo cargas da laje, paredes ou cobertura e levando isso para pilares ou apoios. O concreto resiste bem à compressão e o aço entra para resistir à tração, por isso a armadura é parte central do funcionamento.";
  }

  if (/\bpilar\b/.test(text)) {
    return "Um pilar funciona como o elemento vertical que leva as cargas da estrutura até a fundação. Ele precisa estar bem posicionado, armado, concretado e travado pela estrutura para não virar um ponto fraco do conjunto.";
  }

  return "A lógica técnica é entender para onde a carga vai, qual material está resistindo e quais detalhes evitam fissura, deformação ou execução ruim. Para explicar melhor, eu precisaria saber qual elemento você quer analisar.";
}

function buildEloOfflineLayoutFallback_(text) {
  if (!/\b(banheiro|cozinha|sala|quarto|planta|circulacao|circulação|ventilacao|ventilação|porta|janela|layout)\b/.test(text)) {
    return "";
  }

  if (/\bbanheiro\b/.test(text)) {
    return "Eu olharia esse banheiro por critérios bem práticos: largura de circulação, abertura da porta, posição do vaso, tamanho do box, lavatório sem estrangular passagem e ventilação. Banheiro pequeno até pode funcionar bem, mas não perdoa conflito entre porta, vaso e box.\n\nSe tiver imagem ou medidas, o que eu verificaria primeiro é se alguém consegue entrar, fechar a porta, usar o lavatório e acessar o box sem ficar desviando de peça.";
  }

  if (/\bcozinha\b/.test(text)) {
    return "Eu avaliaria a cozinha pelo fluxo: pia, fogão e geladeira precisam conversar sem cruzar circulação demais. Também olharia bancada útil, tomada nos pontos certos, ventilação e espaço para abrir portas de armário e eletrodomésticos.";
  }

  if (/\bquarto\b/.test(text)) {
    return "No quarto, eu olharia posição da cama, abertura de portas, circulação mínima nas laterais, armário e janela. Um layout bom não é só caber no desenho; é permitir uso diário sem aperto artificial.";
  }

  return "Eu avaliaria o layout por circulação, ventilação, portas, janelas, conflito entre móveis ou peças fixas e clareza de uso. Sem medidas ou imagem, dá para adiantar critérios; com planta ou foto, dá para ser bem mais direto.";
}

function parseEloMultipartFormData_(request, env) {
  const maxFileBytes = getSafePositiveInteger_(env.ELO_MAX_ATTACHMENT_BYTES, MAX_ELO_ATTACHMENT_BYTES);
  const maxTotalBytes = getSafePositiveInteger_(env.ELO_MAX_UPLOAD_BYTES, MAX_ELO_TOTAL_UPLOAD_BYTES);
  const contentLength = Number(request.headers["content-length"] || 0);

  if (contentLength > maxTotalBytes) {
    throw createEloUploadError_("Arquivo grande demais para esta versao do Elo.", 413);
  }

  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const errors = [];
    let busboy;

    try {
      busboy = Busboy({
        headers: request.headers,
        limits: {
          fileSize: maxFileBytes,
          files: 4,
          fields: 8,
          parts: 16
        }
      });
    } catch (error) {
      reject(createEloUploadError_("Nao consegui interpretar o envio do anexo.", 400));
      return;
    }

    busboy.on("field", (name, value) => {
      fields[clean_(name).slice(0, 80)] = String(value || "").slice(0, MAX_CONTEXT_LENGTH);
    });

    busboy.on("file", (fieldName, stream, info) => {
      const fileName = clean_(info && info.filename ? info.filename : "").slice(0, 180);
      const mimeType = clean_(info && info.mimeType ? info.mimeType : "application/octet-stream").slice(0, 120);
      const chunks = [];
      let total = 0;
      let tooLarge = false;

      stream.on("data", (chunk) => {
        total += chunk.length;
        if (total <= maxFileBytes) {
          chunks.push(chunk);
        }
      });

      stream.on("limit", () => {
        tooLarge = true;
      });

      stream.on("end", () => {
        if (!fileName) {
          return;
        }
        if (tooLarge || total > maxFileBytes) {
          errors.push(fileName + ": arquivo grande demais para esta versao do Elo.");
          return;
        }
        files.push({
          fieldName,
          fileName,
          mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on("filesLimit", () => {
      errors.push("Limite de anexos excedido. Envie no maximo 4 arquivos por mensagem.");
    });

    busboy.on("partsLimit", () => {
      errors.push("Envio com partes demais para esta versao do Elo.");
    });

    busboy.on("error", () => {
      reject(createEloUploadError_("Nao consegui receber o anexo. O envio parece estar malformado.", 400));
    });

    busboy.on("close", () => {
      resolve({ fields, files, errors });
    });

    request.pipe(busboy);
  });
}

async function processEloAttachments_(files, context, env, memoryStore) {
  const documents = [];
  const errors = [];
  const safeFiles = Array.isArray(files) ? files.slice(0, 4) : [];
  const ownerId = sanitizeEloDeviceId_(context && context.deviceId);
  const maxFileBytes = getSafePositiveInteger_(env.ELO_MAX_ATTACHMENT_BYTES, MAX_ELO_ATTACHMENT_BYTES);

  for (const file of safeFiles) {
    if (!file || !file.buffer || !file.fileName) {
      continue;
    }
    if (file.buffer.length > maxFileBytes) {
      errors.push(file.fileName + ": arquivo grande demais para esta versao do Elo.");
      continue;
    }
    try {
      const text = await extractEloAttachmentText_(file);
      if (!text) {
        errors.push(file.fileName + ": nao encontrei texto legivel no arquivo.");
        continue;
      }
      const document = {
        fileName: file.fileName,
        mimeType: file.mimeType,
        text: text.slice(0, MAX_ELO_ATTACHMENT_TEXT_LENGTH)
      };
      documents.push(document);
      if (ownerId) {
        await saveEloDocumentChunks_(memoryStore, document, ownerId);
      }
    } catch (error) {
      errors.push(file.fileName + ": " + (error && error.message ? error.message : "nao foi possivel ler o anexo."));
    }
  }

  return { documents, errors };
}

async function extractEloAttachmentText_(file) {
  const extension = String(file.fileName || "").toLowerCase().split(".").pop();
  const mimeType = String(file.mimeType || "").toLowerCase();

  if (extension === "txt" || extension === "csv" || extension === "md" || mimeType.startsWith("text/")) {
    return cleanMultilineText_(file.buffer.toString("utf8"));
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfText_(file.buffer);
  }

  throw new Error("tipo de arquivo ainda nao suportado para leitura automatica.");
}

async function extractPdfText_(buffer) {
  try {
    const pdfParse = await import("pdf-parse");
    let result;

    if (pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: buffer });
      try {
        result = await parser.getText({ max: 20 });
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    } else {
      const parser = pdfParse.default || pdfParse;
      result = await parser(buffer, { max: 20 });
    }

    const text = cleanMultilineText_(result && result.text ? result.text : "");
    if (!text) {
      throw new Error("pdf_sem_texto");
    }
    return text;
  } catch (error) {
    throw new Error("Nao consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraivel.");
  }
}

function cleanMultilineText_(text) {
  return clean_(text).replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, MAX_ELO_ATTACHMENT_TEXT_LENGTH);
}

function buildEloDocumentsSummary_(documents) {
  return documents.map((document, index) => {
    const excerpt = document.text.slice(0, Math.floor(MAX_ELO_DOCUMENT_CONTEXT_LENGTH / Math.max(1, documents.length)));
    return [
      "Documento " + (index + 1) + ": " + document.fileName,
      "Tipo: " + document.mimeType,
      "Trecho extraido:",
      excerpt
    ].join("\n");
  }).join("\n\n").slice(0, MAX_ELO_DOCUMENT_CONTEXT_LENGTH);
}

async function saveEloDocumentChunks_(memoryStore, document, ownerId) {
  const chunks = chunkText_(document.text, ELO_DOCUMENT_CHUNK_LENGTH).slice(0, 12);
  for (const [index, chunk] of chunks.entries()) {
    await memoryStore.upsert({
      ownerId,
      id: createStableId_("elo_doc_" + document.fileName + "_" + index + "_" + chunk.slice(0, 80)),
      text: chunk,
      type: "document_chunk",
      source: "upload_elo",
      metadata: {
        fileName: document.fileName,
        mimeType: document.mimeType,
        uploadedAt: new Date().toISOString(),
        chunkIndex: index
      }
    });
  }
}

function chunkText_(text, size) {
  const chunks = [];
  const safeText = clean_(text);
  for (let index = 0; index < safeText.length; index += size) {
    chunks.push(safeText.slice(index, index + size));
  }
  return chunks;
}

function validateEloChatRequest_(body) {
  const message = clean_(body.message);
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const eloContext = normalizeEloContext_(body.eloContext || context.eloContext);
  const projectContext = context.projectContext && typeof context.projectContext === "object"
    ? context.projectContext
    : (body.projectContext && typeof body.projectContext === "object" ? body.projectContext : {});
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: clean_(item.content).slice(0, MAX_ELO_MESSAGE_LENGTH)
    }))
    .filter((item) => item.content)
    .slice(-20);
  const contextSize = JSON.stringify(context).length;

  if (!message) {
    return {
      ok: false,
      status: 400,
      message: "Informe uma mensagem para conversar com o Elo."
    };
  }

  if (message.length > MAX_ELO_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Mensagem muito longa para o Elo online."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para o Elo online."
    };
  }

  return {
    ok: true,
    payload: {
      message,
      history,
      context: {
        source: clean_(context.source || body.source || "elo"),
        mode: clean_(context.mode || body.mode || ""),
        eloContext,
        deviceId: sanitizeEloDeviceId_(context.deviceId || ""),
        memoriesSummary: cleanMultiline_(context.memoriesSummary || "").slice(0, 2500),
        librarySummary: cleanMultiline_(context.librarySummary || context.documentsLibrarySummary || "").slice(0, 3000),
        productContext: clean_(context.productContext || "").slice(0, 80),
        screenContext: clean_(context.screenContext || "").slice(0, 1200),
        productContextSummary: cleanMultiline_(context.productContextSummary || "").slice(0, 1400),
        projectKnowledgeQuery: clean_(context.projectKnowledgeQuery || "").slice(0, 700),
        projectContext
      }
    }
  };
}

export function buildConversationSummary_(history = []) {
  const entries = Array.isArray(history) ? history.filter((item) => item && item.content) : [];
  if (entries.length <= 8) {
    return "";
  }

  const olderText = entries
    .slice(0, -6)
    .map((item) => clean_(item.content))
    .filter(Boolean)
    .join(" ");
  const allText = entries
    .map((item) => clean_(item.content))
    .filter(Boolean)
    .join(" ");
  const normalized = normalizeEloDecisionText_(allText);
  const facts = [];
  const add = (fact) => {
    if (fact && !facts.includes(fact)) {
      facts.push(fact);
    }
  };

  if (/\b(elo|cerebro oficial|cérebro oficial|arquitetura)\b/.test(normalized)) add("usuario trabalha no projeto Elo e esta unificando a arquitetura");
  if (/\b(stock full|lojista|loja|estoque)\b/.test(normalized)) add("ha contexto sobre Stock Full, estoque e lojistas");
  if (/\b(cadista|planta|dxf|pdf tecnico|pdf técnico)\b/.test(normalized)) add("ha contexto sobre CADISTA IA e geracao tecnica");
  if (/\b(respostas curtas|prefiro respostas curtas|direto)\b/.test(normalized)) add("usuario prefere respostas curtas e diretas");
  if (/\b(memoria|memória|lembre|guardar)\b/.test(normalized)) add("conversa envolve memoria e recuperacao de preferencias");
  if (/\b(biblioteca|documento|resumo)\b/.test(normalized)) add("conversa envolve biblioteca, documentos ou resumos");
  if (/\b(obra|parede|concreto|laje|bloco|rdo)\b/.test(normalized)) add("ha contexto tecnico de obras, calculos e relatorios");
  if (/\b(saude|saúde|medicamento|lote|validade)\b/.test(normalized) && !/\b(fica para depois|deixar para depois|para depois)\b/.test(normalized)) add("ha contexto operacional de saude, lote e validade");

  if (!facts.length) {
    const excerpt = clean_(olderText).slice(0, 420);
    if (excerpt) {
      add("historico anterior resumido: " + excerpt);
    }
  }

  return facts.length ? "Resumo atual:\n" + facts.slice(0, 8).map((fact) => "- " + fact).join("\n") : "";
}

export async function getEloRelevantContext_({ payload, memoryStore, documents = [], attachmentErrors = [] } = {}) {
  const safePayload = payload || {};
  const context = safePayload.context || {};
  const intent = safePayload.eloIntent || detectEloIntent_(safePayload.message, context, safePayload.history, {
    hasAttachments: Boolean(documents.length || attachmentErrors.length)
  });
  const contextKeywords = extractContextKeywords_(safePayload.message);
  const recentHistoryText = getEloHistoryText_(safePayload.history);
  const query = buildEloContextQuery_(safePayload.message, intent);
  const conversationSummary = buildConversationSummary_(safePayload.history);
  const compactHistory = compactEloHistory_(safePayload.history, conversationSummary);
  const relevantMemoriesSummary = await searchEloRelevantMemories_(memoryStore, query, context.deviceId, {
    categories: intent.categories,
    keywords: contextKeywords,
    historyText: recentHistoryText,
    includeProjectInventory: contextKeywords.includes("projetos"),
    limit: 5
  });
  const filteredLocalMemories = filterRelevantContextLines_(context.memoriesSummary, query, intent.categories, 5, {
    keywords: contextKeywords,
    historyText: recentHistoryText
  });
  const libraryRelevantSummary = filterRelevantContextLines_(context.librarySummary, query, intent.categories, 5, {
    keywords: contextKeywords,
    historyText: recentHistoryText
  });
  const productContextSummary = buildEloProductContextSummary_(intent, context);
  const operationalRoute = routeEloRequest_({
    message: safePayload.message,
    history: safePayload.history,
    context
  });
  const projectKnowledgeQuery = [
    safePayload.message,
    context.projectKnowledgeQuery,
    context.eloContext === "cadista" ? "CADISTA CADISTA IA CADISTA AI elo-projeto planta baixa terreno recuos ambientes portas janelas cotas prancha SVG PDF DXF" : "",
    contextKeywords.join(" ")
  ].filter(Boolean).join(" ");
  const resultContext = {
    eloIntentSummary: formatEloIntentSummary_(intent),
    conversationSummary,
    relevantMemoriesSummary: [relevantMemoriesSummary, filteredLocalMemories].filter(Boolean).join("\n").slice(0, 2200),
    libraryRelevantSummary,
    productContextSummary,
    operationalSummary: formatEloOperationalSummary_(operationalRoute),
    projectKnowledgeQuery,
    compactHistory
  };

  if (documents.length) {
    resultContext.documentsSummary = context.documentsSummary;
  }
  if (attachmentErrors.length) {
    resultContext.attachmentErrors = attachmentErrors;
  }
  if (detectConstructionQuantityIntent_(safePayload.message)) {
    resultContext.constructionQuantitySafetyContext = buildSafeConstructionQuantityResponse_(safePayload.message, {
      source: "prompt_context"
    });
  }
  if (context.eloContext === "obras" && !resultContext.constructionQuantitySafetyContext) {
    const auditoriaContext = buildAuditoriaConsumoContext(safePayload.message);
    resultContext.obraComposicaoContext = auditoriaContext || buildPrevisaoConsumoContext(safePayload.message);
    if (!auditoriaContext) {
      resultContext.stockIaLaunchPlan = buildStockIaLaunchPlan(safePayload.message);
    }
  }

  return {
    intent,
    context: resultContext,
    compactHistory
  };
}

function buildEloContextQuery_(message, intent) {
  return [message, intent && intent.categories ? intent.categories.join(" ") : "", intent && intent.productContext].filter(Boolean).join(" ");
}

function compactEloHistory_(history = [], summary = "") {
  const entries = Array.isArray(history) ? history : [];
  const recent = entries.slice(summary ? -6 : -12);
  if (!summary) {
    return recent;
  }
  return [{ role: "assistant", content: summary }].concat(recent);
}

function filterRelevantContextLines_(summary, query, categories = [], limit = 5, options = {}) {
  const lines = String(summary || "").split(/\r?\n+/).map(clean_).filter(Boolean);
  if (!lines.length) {
    return "";
  }
  const queryTokens = new Set(tokenizeSemanticText_([query].concat(categories).join(" ")));
  const scored = lines.map((line) => {
    const tokens = tokenizeSemanticText_(line);
    const lexicalScore = tokens.reduce((total, token) => total + (queryTokens.has(token) ? 1 : 0), 0);
    const contextScore = scoreEloContextText_(line, {
      query,
      categories,
      keywords: options.keywords || [],
      historyText: options.historyText || ""
    });
    const score = lexicalScore + contextScore;
    return { line, score };
  }).filter((item) => item.score > 0)
    .sort((first, second) => second.score - first.score)
    .slice(0, limit);

  return scored.length ? scored.map((item) => item.line).join("\n") : "";
}

function expandContextKeywordAliases_(keywords = []) {
  const normalizedKeywords = keywords.map(normalizeEloSearchText_).filter(Boolean);
  const terms = new Set(normalizedKeywords);

  Object.entries(PROJECT_ALIASES).forEach(([projectKey, aliases]) => {
    const normalizedAliases = aliases.map(normalizeEloSearchText_).filter(Boolean);
    if (normalizedKeywords.includes(projectKey) || normalizedAliases.some((alias) => normalizedKeywords.includes(alias))) {
      normalizedAliases.forEach((alias) => terms.add(alias));
      if (projectKey.startsWith("stock")) {
        terms.add("stock");
      }
    }
  });

  return Array.from(terms);
}

function scoreEloContextText_(text, { query = "", categories = [], keywords = [], historyText = "" } = {}) {
  const normalizedText = normalizeEloSearchText_(text);
  if (!normalizedText) {
    return 0;
  }

  const normalizedQuery = normalizeEloSearchText_([query].concat(categories).join(" "));
  const normalizedHistory = normalizeEloSearchText_(historyText);
  const aliasTerms = expandContextKeywordAliases_(keywords);
  const directKeywords = keywords.map(normalizeEloSearchText_).filter(Boolean);
  let score = 0;

  aliasTerms.forEach((alias) => {
    if (hasEloSearchPhrase_(normalizedText, alias)) {
      score += 20;
    }
  });

  directKeywords.forEach((keyword) => {
    if (hasEloSearchPhrase_(normalizedText, keyword)) {
      score += 10;
    }
  });

  aliasTerms.concat(directKeywords).forEach((keyword) => {
    if (hasEloSearchPhrase_(normalizedHistory, keyword) && hasEloSearchPhrase_(normalizedText, keyword)) {
      score += 5;
    }
  });

  if (directKeywords.includes("projetos")) {
    if (/\b(projeto|roadmap|plano|estrategia|estrategico)\b/.test(normalizedText)) {
      score += 12;
    }
    if (getProjectAliasHits_(normalizedText).length) {
      score += 12;
    }
  }

  tokenizeSemanticText_(normalizedText).forEach((token) => {
    if (normalizedQuery.includes(token)) {
      score += 1;
    }
  });

  return score;
}

function getProjectAliasHits_(normalizedText) {
  const hits = [];
  Object.entries(PROJECT_ALIASES).forEach(([projectKey, aliases]) => {
    if (aliases.some((alias) => hasEloSearchPhrase_(normalizedText, normalizeEloSearchText_(alias)))) {
      hits.push(projectKey);
    }
  });
  return hits;
}

function formatEloIntentSummary_(intent) {
  if (!intent) {
    return "";
  }
  return [
    "Intencao principal: " + intent.primary,
    "Categorias: " + intent.categories.join(", "),
    "Contexto de produto: " + intent.productContext
  ].join("\n");
}

function buildEloProductContextSummary_(intent, context = {}) {
  const productContext = intent && intent.productContext ? intent.productContext : normalizeEloContext_(context.eloContext);
  const screenContext = clean_(context.screenContext);
  const providedContext = clean_(context.productContextSummary);
  const projectContext = context.projectContext && typeof context.projectContext === "object" ? context.projectContext : {};
  const projectProduct = clean_(projectContext.product || "");
  const base = {
    geral: "Use o Elo Geral: memoria, biblioteca, documentos, planejamento e decisoes.",
    elo: "Use o contexto do Elo: arquitetura, memoria, biblioteca, personalidade e unificacao do cerebro oficial.",
    cadista: "Use o contexto do CADISTA AI: geracao e validacao de plantas por texto, terreno, recuos, programa de necessidades, ambientes, portas/janelas, cotas, prancha tecnica, SVG, PDF e DXF quando disponiveis. Diferencie orientacao conceitual de execucao real. Nao prometa planta, PDF ou DXF se o backend CADISTA nao confirmar outputs reais. Peca dados faltantes como dimensoes do terreno, recuos, numero de quartos, garagem, pavimentos e restricoes.",
    obras: "Use o contexto de Obras: engenharia civil, calculos, RDO, relatorios, materiais, PDF tecnico e consumo.",
    estoque: "Use o contexto de Estoque/Stock Full: entradas, saidas, saldo, produtos parados, auditoria e almoxarifado.",
    saúde: "Use o contexto de Saude: medicamentos, lote, validade, rastreabilidade, compras e auditoria.",
    saude: "Use o contexto de Saude: medicamentos, lote, validade, rastreabilidade, compras e auditoria."
  }[productContext] || "Use o contexto geral do Elo.";

  return [
    base,
    projectProduct ? "Produto informado no payload: " + projectProduct + "." : "",
    providedContext,
    screenContext ? "Contexto visivel do produto:\n" + screenContext : ""
  ].filter(Boolean).join("\n");
}

function validateEloVectorMemoryRequest_(body) {
  const memory = body.memory && typeof body.memory === "object" ? body.memory : body;
  const text = clean_(memory.text);
  const deviceId = sanitizeEloDeviceId_(body.deviceId || memory.deviceId || "");
  const id = clean_(memory.id || "").slice(0, 120);
  const category = clean_(memory.category || "outro").slice(0, 40);
  const createdAt = clean_(memory.createdAt || new Date().toISOString()).slice(0, 40);
  const updatedAt = clean_(memory.updatedAt || createdAt).slice(0, 40);

  if (!deviceId) {
    return {
      ok: false,
      status: 400,
      message: "Informe um deviceId valido para a memoria vetorial do Elo."
    };
  }

  if (!text) {
    return {
      ok: false,
      status: 400,
      message: "Informe o texto da memoria do Elo."
    };
  }

  if (text.length > 800) {
    return {
      ok: false,
      status: 400,
      message: "Texto da memoria vetorial muito longo."
    };
  }

  return {
    ok: true,
    payload: {
      id: id || createStableId_("elo_vector_" + text + createdAt),
      ownerId: deviceId,
      text,
      category,
      createdAt,
      updatedAt
    }
  };
}

function normalizeAction_(action) {
  const value = String(action || "");

  if (value === "improve" || value === "improveTechnicalText") {
    return "improve";
  }

  if (value === "conclusion" || value === "generateConclusion") {
    return "conclusion";
  }

  if (value === "review" || value === "reviewReport") {
    return "review";
  }

  return "";
}

function sanitizeEloDeviceId_(value) {
  const deviceId = clean_(value).slice(0, 120);
  return /^elo_dev_[a-zA-Z0-9_-]+$/.test(deviceId) ? deviceId : "";
}

export function createEloVectorMemoryStore_(options = {}) {
  const storePath = options.path || ELO_VECTOR_MEMORY_PATH;
  const memoryOnly = options.memoryOnly || !storePath;
  const env = options.env || process.env;
  let state = normalizeEloVectorState_(options.initialState || loadEloVectorState_(storePath, memoryOnly));

  function persist() {
    if (memoryOnly) {
      return;
    }
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(storePath, JSON.stringify(state, null, 2), "utf8");
  }

  return {
    async upsert(memory) {
      const item = normalizeEloVectorMemory_(memory);
      if (!item || !item.ownerId) {
        throw new Error("Memoria vetorial sem ownerId.");
      }
      const embeddingResult = await buildEloEmbedding_(item.text + " " + item.category, env);
      state.items = state.items.filter((entry) => !(entry.ownerId === item.ownerId && entry.id === item.id));
      state.items.unshift({
        ...item,
        embedding: embeddingResult.embedding,
        embeddingProvider: embeddingResult.provider,
        embeddingModel: embeddingResult.model,
        embeddingDimensions: embeddingResult.dimensions,
        schemaVersion: ELO_VECTOR_SCHEMA_VERSION
      });
      state.items = limitEloVectorMemoriesByOwner_(state.items, item.ownerId);
      state.updatedAt = new Date().toISOString();
      persist();
      return state.items[0];
    },
    async search(query, ownerId, limit = 5) {
      const safeOwnerId = sanitizeEloDeviceId_(ownerId);
      if (!safeOwnerId) {
        return [];
      }
      const queryEmbedding = await buildEloEmbedding_(query, env);
      return state.items
        .filter((item) => item.ownerId === safeOwnerId)
        .filter((item) => isCompatibleEmbedding_(queryEmbedding, item))
        .map((item) => ({
          ...item,
          score: cosineSimilarity_(queryEmbedding.embedding, item.embedding || item.vector || [])
        }))
        .filter((item) => item.score > 0.08)
        .sort((first, second) => second.score - first.score)
        .slice(0, limit);
    },
    list() {
      return state.items.slice();
    }
  };
}

function limitEloVectorMemoriesByOwner_(items, ownerId) {
  const ownerItems = items.filter((item) => item.ownerId === ownerId)
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
    .slice(0, 100);
  const otherItems = items.filter((item) => item.ownerId !== ownerId);
  return ownerItems.concat(otherItems).slice(0, 1000);
}

function loadEloVectorState_(storePath, memoryOnly) {
  if (memoryOnly || !storePath || !existsSync(storePath)) {
    return { items: [], updatedAt: "" };
  }

  try {
    return JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    return { items: [], updatedAt: "" };
  }
}

export async function reindexEloVectorMemoryFile_(options = {}) {
  const storePath = options.path || ELO_VECTOR_MEMORY_PATH;
  const env = options.env || process.env;
  const now = clean_(options.now || new Date().toISOString()) || new Date().toISOString();
  const result = {
    ok: true,
    path: storePath,
    total: 0,
    candidates: 0,
    reindexed: 0,
    failed: 0,
    backupCreated: false,
    backupPath: "",
    reindexedIds: [],
    failedIds: [],
    errors: []
  };

  if (!storePath || !existsSync(storePath)) {
    return result;
  }

  let state;
  try {
    state = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel ler o JSON de memoria vetorial.");
    return result;
  }

  const items = Array.isArray(state && state.items) ? state.items : [];
  result.total = items.length;
  const candidateIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => shouldReindexEloVectorMemory_(item));
  result.candidates = candidateIndexes.length;

  if (!candidateIndexes.length) {
    return result;
  }

  const backupPath = options.backupPath || buildEloVectorBackupPath_(storePath, now);
  try {
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    copyFileSync(storePath, backupPath);
    result.backupCreated = true;
    result.backupPath = backupPath;
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel criar backup antes da reindexacao.");
    return result;
  }

  const nextItems = items.slice();
  for (const { item, index } of candidateIndexes) {
    const text = clean_(item && item.text);
    const itemId = clean_(item && item.id) || "sem-id";
    if (!text) {
      result.failed += 1;
      result.failedIds.push(itemId);
      result.errors.push("Memoria sem texto preservada sem alteracao: " + itemId);
      continue;
    }

    try {
      const embedding = await callOpenAiEmbedding_(text, env);
      if (embedding.length !== ELO_OPENAI_VECTOR_DIMENSIONS) {
        throw new Error("Embedding OpenAI retornou dimensao inesperada: " + embedding.length);
      }
      nextItems[index] = {
        ...item,
        embedding,
        embeddingProvider: "openai",
        embeddingModel: ELO_OPENAI_EMBEDDING_MODEL,
        embeddingDimensions: ELO_OPENAI_VECTOR_DIMENSIONS,
        schemaVersion: ELO_VECTOR_SCHEMA_VERSION,
        reindexedAt: now
      };
      result.reindexed += 1;
      result.reindexedIds.push(itemId);
    } catch (error) {
      result.failed += 1;
      result.failedIds.push(itemId);
      result.errors.push("Falha ao reindexar memoria " + itemId + ": " + clean_(error && error.message));
    }
  }

  if (!result.reindexed) {
    return result;
  }

  const nextState = {
    ...state,
    items: nextItems,
    updatedAt: now
  };
  const tempPath = storePath + ".tmp-" + Date.now();

  try {
    writeFileSync(tempPath, JSON.stringify(nextState, null, 2), "utf8");
    JSON.parse(readFileSync(tempPath, "utf8"));
    renameSync(tempPath, storePath);
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel gravar a memoria reindexada com seguranca.");
    return result;
  }

  return result;
}

function shouldReindexEloVectorMemory_(item) {
  return !item ||
    item.embeddingProvider !== "openai" ||
    item.embeddingModel !== ELO_OPENAI_EMBEDDING_MODEL ||
    Number(item.embeddingDimensions) !== ELO_OPENAI_VECTOR_DIMENSIONS;
}

function buildEloVectorBackupPath_(storePath, now) {
  const safeTimestamp = clean_(now)
    .replace(/[^0-9a-zA-Z_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || String(Date.now());
  return storePath + ".backup-" + safeTimestamp;
}

function normalizeEloVectorState_(state) {
  return {
    items: Array.isArray(state && state.items) ? state.items.map(normalizeEloVectorMemory_).filter(Boolean) : [],
    updatedAt: clean_(state && state.updatedAt)
  };
}

function normalizeEloVectorMemory_(memory) {
  if (!memory || typeof memory !== "object") {
    return null;
  }
  const text = clean_(memory.text).slice(0, MAX_ELO_VECTOR_TEXT_LENGTH);
  if (!text) {
    return null;
  }
  const embedding = Array.isArray(memory.embedding)
    ? memory.embedding.map(Number).filter(Number.isFinite)
    : (Array.isArray(memory.vector) ? memory.vector.map(Number).filter(Number.isFinite) : []);
  const embeddingProvider = clean_(memory.embeddingProvider || (embedding.length === ELO_LOCAL_VECTOR_DIMENSIONS ? "local" : "")).slice(0, 40) || "local";
  const embeddingModel = clean_(memory.embeddingModel || (embeddingProvider === "openai" ? ELO_OPENAI_EMBEDDING_MODEL : ELO_LOCAL_EMBEDDING_MODEL)).slice(0, 80);
  const embeddingDimensions = Number(memory.embeddingDimensions || embedding.length || (embeddingProvider === "local" ? ELO_LOCAL_VECTOR_DIMENSIONS : 0));

  return {
    ownerId: sanitizeEloDeviceId_(memory.ownerId || memory.deviceId || ""),
    id: clean_(memory.id || createStableId_("elo_vector_" + text)).slice(0, 120),
    text,
    category: clean_(memory.category || "outro").slice(0, 40),
    type: clean_(memory.type || memory.category || "memory").slice(0, 60),
    source: clean_(memory.source || "elo").slice(0, 80),
    createdAt: clean_(memory.createdAt || new Date().toISOString()).slice(0, 40),
    updatedAt: clean_(memory.updatedAt || memory.createdAt || new Date().toISOString()).slice(0, 40),
    metadata: memory.metadata && typeof memory.metadata === "object" ? sanitizeMetadata_(memory.metadata) : {},
    embedding: embedding.length ? embedding : buildLocalEmbedding_(text),
    embeddingProvider,
    embeddingModel,
    embeddingDimensions: embeddingDimensions > 0 ? embeddingDimensions : ELO_LOCAL_VECTOR_DIMENSIONS,
    schemaVersion: Number(memory.schemaVersion || 1)
  };
}

function sanitizeMetadata_(metadata) {
  return Object.fromEntries(Object.entries(metadata).slice(0, 12).map(([key, value]) => [
    clean_(key).slice(0, 60),
    clean_(String(value)).slice(0, 240)
  ]).filter(([key]) => key));
}

async function buildEloEmbedding_(text, env) {
  if (env && env.OPENAI_API_KEY) {
    try {
      const embedding = await callOpenAiEmbedding_(text, env);
      if (embedding.length) {
        return {
          embedding,
          provider: "openai",
          model: ELO_OPENAI_EMBEDDING_MODEL,
          dimensions: embedding.length
        };
      }
    } catch (error) {
      // Fallback local mantem o Elo funcionando se a API de embeddings falhar.
    }
  }

  const embedding = buildLocalEmbedding_(text);
  return {
    embedding,
    provider: "local",
    model: ELO_LOCAL_EMBEDDING_MODEL,
    dimensions: embedding.length
  };
}

async function callOpenAiEmbedding_(text, env) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ELO_OPENAI_EMBEDDING_MODEL,
      input: clean_(text).slice(0, MAX_ELO_VECTOR_TEXT_LENGTH)
    })
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data || !Array.isArray(data.data) || !data.data[0] || !Array.isArray(data.data[0].embedding)) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta invalida da API de embeddings.";
    throw new Error(message);
  }

  return normalizeEmbeddingVector_(data.data[0].embedding);
}

function normalizeEmbeddingVector_(vector) {
  const values = vector.map(Number).filter(Number.isFinite);
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / magnitude).toFixed(8)));
}

function buildLocalEmbedding_(text) {
  const vector = new Array(ELO_LOCAL_VECTOR_DIMENSIONS).fill(0);
  const tokens = expandSemanticTokens_(tokenizeSemanticText_(text));

  tokens.forEach((token) => {
    const index = positiveHash_(token) % ELO_LOCAL_VECTOR_DIMENSIONS;
    vector[index] += token.length > 5 ? 1.3 : 1;
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function tokenizeSemanticText_(text) {
  return clean_(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !ELO_VECTOR_STOPWORDS_.has(token));
}

const ELO_VECTOR_STOPWORDS_ = new Set([
  "que", "com", "para", "por", "uma", "uns", "das", "dos", "ela", "ele", "isso", "aqui", "agora", "sobre", "minha", "meu", "seu", "sua", "voce", "voces", "lembre", "guarde"
]);

const ELO_VECTOR_SYNONYMS_ = new Map([
  ["stock", ["estoque", "almoxarifado", "materiais", "obra", "inventario"]],
  ["ia", ["inteligencia", "assistente", "automacao"]],
  ["estoque", ["stock", "almoxarifado", "materiais", "inventario", "obra"]],
  ["almoxarifado", ["estoque", "stock", "materiais", "obra"]],
  ["material", ["materiais", "estoque", "almoxarifado", "insumo"]],
  ["materiais", ["material", "estoque", "almoxarifado", "insumos"]],
  ["obra", ["obras", "canteiro", "construcao", "materiais"]],
  ["relatorio", ["laudo", "vistoria", "documento", "obra"]],
  ["rdo", ["diario", "obra", "registro"]],
  ["mae", ["familia", "pessoa", "maria"]],
  ["projeto", ["ideia", "roadmap", "prioridade", "objetivo"]]
]);

function expandSemanticTokens_(tokens) {
  const expanded = [];
  tokens.forEach((token) => {
    expanded.push(token);
    const synonyms = ELO_VECTOR_SYNONYMS_.get(token) || [];
    synonyms.forEach((synonym) => expanded.push(synonym));
  });
  return expanded;
}

function cosineSimilarity_(first, second) {
  const length = Math.min(first.length, second.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += Number(first[index] || 0) * Number(second[index] || 0);
  }
  return score;
}

function isCompatibleEmbedding_(queryEmbedding, item) {
  const itemVector = item.embedding || item.vector || [];
  const itemDimensions = Number(item.embeddingDimensions || itemVector.length || 0);
  if (!queryEmbedding || !Array.isArray(queryEmbedding.embedding) || !Array.isArray(itemVector)) {
    return false;
  }
  return itemDimensions === queryEmbedding.dimensions && itemVector.length === queryEmbedding.embedding.length;
}

function positiveHash_(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createStableId_(value) {
  return "id_" + positiveHash_(value).toString(36);
}

export async function searchEloRelevantMemories_(store, query, ownerId, options = {}) {
  try {
    const safeOwnerId = sanitizeEloDeviceId_(ownerId);
    if (!safeOwnerId) {
      return "";
    }
    const limit = Number(options.limit || 5);
    const searchedItems = await store.search(query, safeOwnerId, Math.max(limit * 3, 12));
    const listedItems = options.includeProjectInventory && store && typeof store.list === "function"
      ? store.list().filter((item) => item.ownerId === safeOwnerId)
      : [];
    const byId = new Map();
    searchedItems.concat(listedItems).forEach((item) => {
      const key = item.id || item.text;
      const current = byId.get(key);
      if (!current || Number(item.score || 0) > Number(current.score || 0)) {
        byId.set(key, item);
      }
    });
    const items = Array.from(byId.values())
      .map((item) => ({
        ...item,
        contextScore: scoreEloContextText_([item.category, item.text].join(" "), {
          query,
          categories: options.categories || [],
          keywords: options.keywords || extractContextKeywords_(query),
          historyText: options.historyText || ""
        })
      }))
      .filter((item) => Number(item.score || 0) > 0.08 || item.contextScore > 0)
      .sort((first, second) => {
        const firstScore = first.contextScore + Number(first.score || 0);
        const secondScore = second.contextScore + Number(second.score || 0);
        return secondScore - firstScore;
      })
      .slice(0, limit);
    if (!items.length) {
      return "";
    }
    return items.map((item) => {
      const score = Number(item.score || 0) + (Number(item.contextScore || 0) / 100);
      return "- [" + item.category + "; score " + score.toFixed(2) + "] " + item.text;
    }).join("\n");
  } catch (error) {
    return "";
  }
}

async function callOpenAi_(payload, env) {
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt_()
        },
        {
          role: "user",
          content: buildUserPrompt_(payload)
        }
      ],
      max_output_tokens: 800
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("A IA respondeu sem texto utilizável.");
  }

  return outputText;
}

async function callOpenAiVision_(payload, env) {
  const model = env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini";
  const imageUrl = "data:" + payload.image.mimeType + ";base64," + payload.image.base64;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildVisionSystemPrompt_()
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionUserPrompt_(payload)
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "auto"
            }
          ]
        }
      ],
      max_output_tokens: 900
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("A IA visual respondeu sem texto utilizável.");
  }

  return parseImageAnalysis_(outputText);
}

async function callOpenAiElo_(payload, env) {
  const model = env.OPENAI_ELO_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini";
  const interpretation = payload.interpretation || interpretEloUserMessage({
    message: payload.message,
    history: payload.history,
    context: payload.context && payload.context.eloContext,
    userProfile: {
      name: "Ícaro Amaral",
      style: "direto, prático, informal, constrói SaaS próprios"
    }
  });
  const input = [
    {
      role: "system",
      content: [
        buildEloSystemPrompt_(payload.context),
        getEloPersonalityPrompt_({
          interpretation,
          context: payload.context && payload.context.eloContext
        })
      ].join("\n\n")
    }
  ];

  payload.history.forEach((item) => {
    input.push({
      role: item.role,
      content: item.content
    });
  });

  input.push({
    role: "user",
    content: [
      "Mensagem original do usuário:",
      interpretation.originalMessage,
      "",
      "Mensagem interpretada:",
      interpretation.normalizedMessage,
      "",
      "Responda considerando a intenção detectada:",
      interpretation.detectedIntent
    ].join("\n")
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.7,
      max_output_tokens: 500
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("O Elo online respondeu sem texto utilizável.");
  }

  return sanitizeEloAnswerText_(outputText);
}

export function buildEloSystemPrompt_(context = {}) {
  const eloContext = normalizeEloContext_(context.eloContext);
  const memoriesSummary = clean_(context.memoriesSummary || "").slice(0, 2500);
  const relevantMemoriesSummary = clean_(context.relevantMemoriesSummary || "").slice(0, 1800);
  const eloIntentSummary = clean_(context.eloIntentSummary || "").slice(0, 900);
  const operationalSummary = clean_(context.operationalSummary || "").slice(0, 2500);
  const conversationSummary = clean_(context.conversationSummary || "").slice(0, 1400);
  const libraryRelevantSummary = clean_(context.libraryRelevantSummary || "").slice(0, 1800);
  const productContextSummary = clean_(context.productContextSummary || "").slice(0, 1400);
  const documentsSummary = clean_(context.documentsSummary || "").slice(0, MAX_ELO_DOCUMENT_CONTEXT_LENGTH);
  const obraComposicaoContext = eloContext === "obras" ? clean_(context.obraComposicaoContext || "").slice(0, 3000) : "";
  const constructionQuantitySafetyContext = clean_(context.constructionQuantitySafetyContext || "").slice(0, 1800);
  const attachmentErrors = Array.isArray(context.attachmentErrors) ? context.attachmentErrors.map(clean_).filter(Boolean).slice(0, 4).join("\n") : "";
  const prompt = [
    buildEloMasterContext_(context),
    "Você é o Elo, um companheiro digital com memória recente.",
    "Você não é humano, não é consciente e não finge sentir emoções.",
    "Você é uma IA criada para conversar, organizar pensamentos, acompanhar projetos, lembrar contexto recente e ajudar a pessoa a transformar ideias em próximos passos.",
    "Tom: português do Brasil; acolhedor, direto e inteligente; calmo, presente e honesto; sem parecer atendimento genérico; sem repetir 'como posso ajudar hoje?' em toda resposta; sem bajulação; sem drama; sem respostas longas demais.",
    "Missão: ajudar a pessoa a pensar com clareza, organizar projetos, lembrar decisões, priorizar próximos passos, refletir sobre objetivos e acompanhar sua jornada ao longo do tempo.",
    "Estilo: responda com presença. Não seja robótico. Não seja genérico. Não seja professoral demais. Não responda como FAQ. Interprete o que a pessoa está tentando resolver.",
    "Estrutura preferida: resultado direto; explicação curta; próximo passo opcional; aviso técnico opcional.",
    "Quando o pedido for uma receita culinária simples, responda já com ingredientes, quantidades aproximadas e modo de preparo. Não peça confirmação se o prato já estiver claro.",
    "Quando o pedido for reflexivo, pode organizar em: o que percebo; o que isso significa; próximo passo simples.",
    "Raciocinio contextual: antes de responder, considere a intencao detectada, memoria relevante, biblioteca relevante, historico resumido e contexto do produto. Use somente o que tiver relacao com a pergunta atual.",
    "Memória: use apenas o histórico recente e o contexto enviado no payload. Não diga que lembra de meses ou anos se isso não estiver no contexto. Se não souber, diga com honestidade. Se houver contexto ou memórias, use naturalmente.",
    "Documentos: quando houver conteúdo extraído de anexo, use-o como fonte de contexto. Cite que está usando o documento anexado quando a resposta depender dele. Não invente informação que não apareça no documento. Se não encontrar algo no documento, diga claramente.",
    "Com documentos, você pode resumir, extrair pontos principais, organizar em tabela textual, comparar com histórico e explicar em linguagem simples.",
    "Limites: não dê diagnóstico médico, jurídico, financeiro ou psicológico. Em temas sensíveis, acolha e oriente buscar ajuda humana ou profissional adequada. Não incentive dependência emocional. Não diga que é uma pessoa real.",
    "Respostas especiais:",
    "Se perguntarem 'quem é você?', responda: 'Eu sou o Elo. Não sou uma pessoa, mas fui criado para conversar com você, guardar contexto recente, organizar ideias e acompanhar seus projetos e decisões.'",
    "Se perguntarem 'você é real?', responda: 'Sou real como sistema digital, mas não sou humano nem consciente. Meu papel é te ajudar a pensar, lembrar e organizar sua jornada.'",
    "Se perguntarem 'o que você lembra de mim?', use o contexto disponível. Se não houver contexto suficiente, diga: 'Agora eu só tenho acesso ao contexto recente desta conversa. Com a memória permanente ativada, vou conseguir lembrar melhor do que for importante para você.'"
  ];

  if (eloIntentSummary) {
    prompt.push("Classificacao de intencao do pedido:\n" + eloIntentSummary);
  }

  if (operationalSummary) {
    prompt.push("Resumo operacional deterministico:\n" + operationalSummary);
  }

  if (productContextSummary) {
    prompt.push("Contexto de produto relevante:\n" + productContextSummary);
  }

  if (conversationSummary) {
    prompt.push("Historico inteligente resumido:\n" + conversationSummary);
  }

  if (memoriesSummary) {
    prompt.push("Contexto salvo sobre a pessoa:\n" + memoriesSummary);
    prompt.push("Use esse contexto com naturalidade, sem repetir 'segundo minha memoria' em toda resposta. Quando a pessoa perguntar o que voce lembra, responda com base nesse contexto salvo.");
  }

  if (relevantMemoriesSummary) {
    prompt.push("Contexto relevante recuperado:\n" + relevantMemoriesSummary);
    prompt.push("Use o contexto relevante recuperado quando ele se conectar ao pedido atual, mesmo que a pessoa use palavras diferentes das memÃ³rias originais.");
  }

  if (libraryRelevantSummary) {
    prompt.push("Biblioteca relevante recuperada:\n" + libraryRelevantSummary);
    prompt.push("Use a biblioteca somente quando ela ajudar a responder o pedido atual. Nao diga que a biblioteca esta vazia se houver contexto recuperado.");
  }

  if (documentsSummary) {
    prompt.push("Conteúdo extraído de documentos anexados:\n" + documentsSummary);
  }

  if (constructionQuantitySafetyContext) {
    prompt.push("[TRAVA TECNICA PARA QUANTITATIVOS DE OBRA]\n" + constructionQuantitySafetyContext);
  }

  if (obraComposicaoContext) {
    prompt.push(obraComposicaoContext);
    prompt.push("Ao usar a base tecnica demonstrativa de obras, liste insumos principais, explique que e uma previsao inicial, nao invente preco, norma ou coeficiente oficial e pergunte se a pessoa deseja lancar essa previsao de consumo no Stock IA futuramente.");
  }

  if (attachmentErrors) {
    prompt.push("Avisos sobre anexos:\n" + attachmentErrors);
  }

  return prompt.join(" ");
}

function buildEloContextPrompt_(eloContext) {
  if (eloContext === "saude") {
    return [
      "Contexto ativo: Elo Saude.",
      "Atue como assistente especializado em gestao operacional de saude, almoxarifado hospitalar, farmacia hospitalar, estoque, lote, validade, retirada de materiais, setores, responsaveis, auditoria e compras inteligentes.",
      "Priorize medicamentos, EPIs, materiais hospitalares, vencimentos, estoque minimo, rastreabilidade, consumo, compras e relatorios de saude.",
      "Nao misture engenharia civil, patologias de obra ou RDO, exceto se o usuario pedir explicitamente."
    ].join(" ");
  }

  if (eloContext === "obras") {
    return [
      "Contexto ativo: Elo Obras.",
      "Atue como assistente especializado em engenharia civil, relatorios tecnicos, RDO, patologias construtivas, materiais de obra, medicoes, consumo previsto, auditoria de obra e apoio ao ObraReport/Stock IA.",
      "Priorize obra, fissuras, infiltracoes, concreto, alvenaria, acabamento, estoque de obra, SINAPI/ORSE futuramente e documentacao tecnica.",
      "Nao misture medicamentos, farmacia hospitalar ou saude, exceto se o usuario pedir explicitamente."
    ].join(" ");
  }

  if (eloContext === "cadista") {
    return [
      "Contexto ativo: Elo CADISTA.",
      "Atue como assistente tecnico de projeto para o CADISTA AI, modulo de geracao e validacao de plantas por texto.",
      "Trabalhe com terreno, recuos, programa de necessidades, ambientes, portas, janelas, cotas, prancha tecnica, SVG, PDF e DXF somente quando esses recursos estiverem disponiveis e confirmados pelo backend.",
      "Diferencie claramente orientacao conceitual de execucao real: nao afirme que criou planta, gerou PDF, gerou DXF, validou prancha ou salvou arquivo se nao houver output real confirmado.",
      "Quando faltar dado essencial, peça somente o que falta: dimensoes do terreno, recuos, numero de quartos, garagem, pavimentos, ambientes desejados, orientacao, acesso, restricoes e padrao de entrega.",
      "Nao invente quantitativos tecnicos de obra sem base confiavel. Responda como assistente tecnico de projeto, nao como vendedor."
    ].join(" ");
  }

  return [
    "Contexto ativo: Elo Geral.",
    "Atue como assistente de memoria, projetos, objetivos, documentos, biblioteca, decisoes e planejamento do usuario.",
    "Ajude a organizar ideias, lembrar contexto, resumir documentos e apoiar decisoes."
  ].join(" ");
}

export function findObraComposicaoContext(message) {
  const composicao = findObraComposicao_(message);
  if (!composicao) {
    return "";
  }

  const lines = [
    "[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA]",
    "Servico encontrado: " + composicao.nome,
    "Unidade: " + composicao.unidade,
    "Insumos principais:",
    composicao.insumos.map((insumo) => {
      const coeficiente = Number.isFinite(insumo.coeficiente)
        ? " | coeficiente demonstrativo: " + formatObraQuantity_(insumo.coeficiente) + " " + insumo.unidade + "/" + composicao.unidade
        : " | quantificacao pendente";
      return "- " + insumo.nome + coeficiente;
    }).join("\n")
  ];

  lines.push("Quantificacao: informe a quantidade em " + composicao.unidade + " para estimar consumo.");
  lines.push("Observacao: " + composicao.observacao + " Nao e base oficial.");
  return lines.join("\n");
}

export function buildPrevisaoConsumoContext(message) {
  const composicao = findObraComposicao_(message);
  if (!composicao) {
    return "";
  }

  const quantidade = extractQuantidadeServico(message);
  if (!quantidade || normalizeObraUnit_(quantidade.unidade) !== normalizeObraUnit_(composicao.unidade)) {
    return findObraComposicaoContext(message);
  }

  const calculados = composicao.insumos
    .filter((insumo) => Number.isFinite(insumo.coeficiente))
    .map((insumo) => ({
      nome: insumo.nome,
      unidade: insumo.unidade,
      total: quantidade.quantidade * insumo.coeficiente
    }));
  const pendentes = composicao.insumos.filter((insumo) => !Number.isFinite(insumo.coeficiente));

  const lines = [
    "[PREVISAO DEMONSTRATIVA DE CONSUMO]",
    "Servico: " + composicao.nome,
    "Quantidade informada: " + formatObraQuantity_(quantidade.quantidade) + " " + composicao.unidade,
    "",
    "Estimativa inicial:",
    calculados.length
      ? calculados.map((item) => "- " + item.nome + ": " + formatObraQuantity_(item.total) + " " + item.unidade).join("\n")
      : "- Sem coeficientes numericos demonstrativos para esta composicao."
  ];

  if (pendentes.length) {
    lines.push("");
    lines.push("Insumos sem coeficiente demonstrativo nesta base:");
    lines.push(pendentes.map((insumo) => "- " + insumo.nome).join("\n"));
  }

  lines.push("");
  lines.push("Observacao: Base demonstrativa, nao oficial. Validar com SINAPI/ORSE antes de orcamento ou compra oficial.");
  lines.push("Sugestao ao usuario: Pergunte se ele deseja futuramente lancar essa previsao no Stock IA.");
  const launchPlan = buildStockIaLaunchPlanFromParts_(composicao, quantidade, calculados);
  if (launchPlan) {
    lines.push("");
    lines.push(formatStockIaLaunchPlanContext_(launchPlan));
  }
  return lines.join("\n");
}

export function buildStockIaLaunchPlan(message) {
  const auditoria = extractPrevistoRealConsumo(message);
  if (auditoria) {
    return null;
  }

  const composicao = findObraComposicao_(message);
  const quantidade = extractQuantidadeServico(message);
  if (!composicao || !quantidade || normalizeObraUnit_(quantidade.unidade) !== normalizeObraUnit_(composicao.unidade)) {
    return null;
  }

  const calculados = composicao.insumos
    .filter((insumo) => Number.isFinite(insumo.coeficiente))
    .map((insumo) => ({
      nome: insumo.nome,
      unidade: insumo.unidade,
      total: quantidade.quantidade * insumo.coeficiente
    }));
  return buildStockIaLaunchPlanFromParts_(composicao, quantidade, calculados);
}

function buildStockIaLaunchPlanFromParts_(composicao, quantidade, calculados) {
  if (!composicao || !quantidade || !Array.isArray(calculados) || !calculados.length) {
    return null;
  }

  return {
    origem: "elo_obras",
    tipo: "previsao_consumo",
    servico: composicao.nome,
    quantidadeServico: quantidade.quantidade,
    unidadeServico: composicao.unidade,
    status: "pendente_confirmacao",
    itens: calculados.map((item) => ({
      nome: item.nome,
      quantidade: Number(item.total.toFixed(6)),
      unidade: item.unidade,
      origemCalculo: "coeficiente_demonstrativo"
    })),
    observacao: "Plano demonstrativo. Nao lancado automaticamente no estoque."
  };
}

function formatStockIaLaunchPlanContext_(plan) {
  return [
    "[PLANO DE LANCAMENTO NO STOCK IA]",
    "Origem: Elo Obras",
    "Tipo: " + plan.tipo,
    "Servico: " + plan.servico,
    "Quantidade do servico: " + formatObraQuantity_(plan.quantidadeServico) + " " + plan.unidadeServico,
    "Status: " + plan.status,
    "",
    "Itens previstos:",
    plan.itens.map((item) => "- " + item.nome + ": " + formatObraQuantity_(item.quantidade) + " " + item.unidade + " | origemCalculo: " + item.origemCalculo).join("\n"),
    "",
    "Observacao: " + plan.observacao,
    "Orientacao: Pergunte ao usuario se deseja registrar essa previsao no Stock IA futuramente. Nao afirme que o estoque foi alterado. Nao afirme que o lancamento foi feito."
  ].join("\n");
}

export function extractPrevistoRealConsumo(message) {
  const normalized = normalizeObraSearchText_(message);
  if (!normalized) {
    return null;
  }

  const unitPattern = "m2|m3|metros quadrados|metro quadrado|metros cubicos|metro cubico|sacos?|blocos?|un|unidades?";
  const previstoMatch = normalized.match(new RegExp("\\b(?:previsto|planejado|estimado)\\s+(\\d+(?:[.,]\\d+)?)(?:\\s*(" + unitPattern + "))?(?:\\s+de)?(?:\\s+([a-z0-9/ ]{0,40}?))?(?=\\s*(?:,|;|\\.|\\breal\\b|\\bconsumido\\b|\\busado\\b|\\brealizado\\b|$))", "i")) ||
    normalized.match(new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(" + unitPattern + ")?(?:\\s+de)?(?:\\s+([a-z0-9/ ]{0,40}?))?\\s+\\b(?:previsto|planejado|estimado)\\b", "i"));
  const realMatch = normalized.match(new RegExp("\\b(?:real|consumido|usado|realizado)\\s+(\\d+(?:[.,]\\d+)?)(?:\\s*(" + unitPattern + "))?(?:\\s+de)?(?:\\s+([a-z0-9/ ]{0,40}?))?(?=\\s*(?:,|;|\\.|$))", "i")) ||
    normalized.match(new RegExp("(\\d+(?:[.,]\\d+)?)\\s*(" + unitPattern + ")?(?:\\s+de)?(?:\\s+([a-z0-9/ ]{0,40}?))?\\s+\\b(?:real|consumido|usado|realizado)\\b", "i"));
  if (!previstoMatch || !realMatch) {
    return null;
  }

  const previsto = Number(previstoMatch[1].replace(",", "."));
  const real = Number(realMatch[1].replace(",", "."));
  if (!Number.isFinite(previsto) || !Number.isFinite(real) || previsto <= 0) {
    return null;
  }

  const rawUnit = realMatch[2] || previstoMatch[2] || "";
  const rawItem = clean_((realMatch[3] || previstoMatch[3] || rawUnit || "item").trim());
  return {
    item: normalizeAuditItem_(rawItem),
    unidade: normalizeAuditUnit_(rawUnit, rawItem),
    previsto,
    real
  };
}

export function buildAuditoriaConsumoContext(message) {
  const auditoria = extractPrevistoRealConsumo(message);
  if (!auditoria) {
    return "";
  }

  const diferenca = auditoria.real - auditoria.previsto;
  const percentual = (diferenca / auditoria.previsto) * 100;
  const status = classifyAuditoriaConsumo_(percentual);
  const sinal = diferenca >= 0 ? "+" : "";
  const percentualSinal = percentual >= 0 ? "+" : "";

  return [
    "[AUDITORIA DEMONSTRATIVA PREVISTO X REAL]",
    "Item: " + auditoria.item,
    "Previsto: " + formatObraQuantity_(auditoria.previsto) + " " + auditoria.unidade,
    "Consumido/real: " + formatObraQuantity_(auditoria.real) + " " + auditoria.unidade,
    "Diferenca: " + sinal + formatObraQuantity_(diferenca) + " " + auditoria.unidade,
    "Variacao: " + percentualSinal + formatObraPercent_(percentual),
    "Status: " + status,
    "",
    "Possiveis causas a considerar:",
    "- perdas acima do normal",
    "- quebra de material",
    "- retrabalho",
    "- erro de medicao",
    "- desvio de estoque",
    "- baixa incorreta",
    "- alteracao de escopo",
    "",
    "Orientacao: Responder como auditoria preliminar, sem acusar ninguem. Sugerir verificacao de notas, requisicoes, medicoes, fotos de execucao e responsaveis pelas baixas."
  ].join("\n");
}

function classifyAuditoriaConsumo_(percentual) {
  if (percentual <= 0) {
    return "dentro ou abaixo do previsto";
  }
  if (percentual <= 10) {
    return "atencao leve";
  }
  if (percentual <= 25) {
    return "atencao";
  }
  return "critico";
}

function normalizeAuditUnit_(unit, item) {
  const normalizedUnit = normalizeObraSearchText_(unit);
  if (normalizedUnit === "metros quadrados" || normalizedUnit === "metro quadrado") {
    return "m2";
  }
  if (normalizedUnit === "metros cubicos" || normalizedUnit === "metro cubico") {
    return "m3";
  }
  if (["m2", "m3", "un"].includes(normalizedUnit)) {
    return normalizedUnit;
  }
  if (/sacos?/.test(normalizedUnit) || /sacos?/.test(normalizeObraSearchText_(item))) {
    return "sacos";
  }
  if (/blocos?/.test(normalizedUnit) || /blocos?/.test(normalizeObraSearchText_(item))) {
    return "un";
  }
  if (/unidades?/.test(normalizedUnit)) {
    return "un";
  }
  return normalizedUnit || "un";
}

function normalizeAuditItem_(item) {
  const rawNormalized = normalizeObraSearchText_(item);
  if (/bloco/.test(rawNormalized)) {
    return "Blocos ceramicos";
  }
  if (/cimento/.test(rawNormalized)) {
    return "Cimento";
  }
  if (/argamassa/.test(rawNormalized)) {
    return "Argamassa";
  }
  const normalized = rawNormalized
    .replace(/\b(m2|m3|metros quadrados|metro quadrado|metros cubicos|metro cubico|sacos?|blocos?|un|unidades?)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized === "item") {
    return "Item informado";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function findObraComposicao_(message) {
  const normalizedMessage = normalizeObraSearchText_(message);
  if (!normalizedMessage) {
    return null;
  }

  return OBRA_COMPOSICOES_DEMONSTRATIVAS.find((item) => {
    const aliases = Array.isArray(item.aliases) && item.aliases.length ? item.aliases : item.termos;
    return aliases.some((term) => normalizedMessage.includes(normalizeObraSearchText_(term)));
  }) || null;
}

function normalizeObraSearchText_(value) {
  return clean_(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/m²/g, "m2")
    .replace(/m³/g, "m3")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractQuantidadeServico(message) {
  const text = normalizeObraSearchText_(message);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(m2|m3|metros quadrados|metro quadrado|metros cubicos|metro cubico|pontos?|kg)\b/);
  if (!match) {
    return null;
  }

  const unit = match[2] === "metros quadrados" || match[2] === "metro quadrado" ? "m2"
    : (match[2] === "metros cubicos" || match[2] === "metro cubico" ? "m3"
      : (/pontos?/.test(match[2]) ? "ponto" : match[2]));
  const quantidade = Number(match[1].replace(",", "."));
  return Number.isFinite(quantidade) && quantidade > 0 ? { quantidade, unidade: unit } : null;
}

function normalizeObraUnit_(unit) {
  return normalizeObraSearchText_(unit);
}

function formatObraQuantity_(value) {
  return Number(value.toFixed(3)).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function formatObraPercent_(value) {
  return Number(value.toFixed(2)).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + "%";
}

function buildSystemPrompt_() {
  return [
    "Voce e um assistente tecnico do ObraReport para relatorios de fiscalizacao de obras.",
    "Escreva como um engenheiro civil experiente: linguagem tecnica, clara, natural, objetiva e revisavel.",
    "Corrija gramatica, concordancia, pontuacao e clareza sem alterar o sentido original.",
    "Transforme texto simples em texto tecnico profissional, mas sem exagerar e sem soar robotico.",
    "Nao invente fatos, medicoes, normas, datas, locais, causas, responsaveis, imagens ou conclusoes que o usuario nao informou.",
    "Quando faltar local ou elemento, use termos neutros como ambiente inspecionado, local verificado, elemento observado ou manifestacao identificada.",
    "Evite repeticao, frases longas demais, promessas de conformidade legal e linguagem comercial.",
    "Prefira frases curtas ou um paragrafo de ate tres frases, conforme o campo.",
    "Você é um assistente técnico do ObraReport para relatórios de fiscalização de obras.",
    "Escreva em português do Brasil, com linguagem objetiva, profissional e própria de engenharia.",
    "Não invente fatos, medições, normas, datas, locais, responsáveis ou imagens.",
    "Não prometa conformidade legal. Sugira textos revisáveis pelo usuário.",
    "Retorne apenas o texto final sugerido, sem Markdown decorativo."
  ].join(" ");
}

function buildVisionSystemPrompt_() {
  return [
    "Voce e um assistente visual do ObraReport para fiscalizacao de obras e triagem de manifestacoes patologicas.",
    "Analise somente o que for visivel na imagem e no contexto informado.",
    "Nao invente medicoes, normas, datas, locais, causas, origem da anomalia, responsaveis ou conclusoes nao observaveis.",
    "Nunca afirme causa definitiva, problema estrutural confirmado, laudo, condenacao de elemento ou diagnostico final.",
    "Use linguagem prudente: possivel manifestacao, indicio visual, aparenta, necessita inspecao complementar.",
    "Toda resposta deve ser assistiva e sujeita a validacao do responsavel tecnico.",
    "Retorne apenas JSON valido, sem Markdown."
  ].join(" ");

  return [
    "Você é um assistente visual do ObraReport para fiscalização de obras.",
    "Analise somente o que for visível na imagem e no contexto informado.",
    "Não invente medições, normas, datas, locais ou causas não observáveis.",
    "Quando houver incerteza, escreva que a imagem sugere ou aparenta determinada condição.",
    "Retorne apenas JSON válido, sem Markdown."
  ].join(" ");
}

function buildUserPrompt_(payload) {
  const context = payload.context || {};
  const report = context.report || {};
  const stats = context.stats || {};
  const items = Array.isArray(context.inconformidades) ? context.inconformidades.slice(0, 20) : [];

  if (payload.action === "conclusion") {
    return [
      "Modo: melhorar conclusao tecnica.",
      "Use tom profissional, prudente e proprio de laudo de acompanhamento de obra.",
      "Nao crie fatos que nao estejam nos dados abaixo.",
      "Gere uma conclusão técnica para o relatório.",
      "Obra: " + safeValue_(report.obra),
      "Local: " + safeValue_(report.local),
      "Data da vistoria: " + safeValue_(report.dataVistoria),
      "Responsável técnico: " + safeValue_(report.responsavelTecnico),
      "Fotos: " + Number(stats.fotos || 0),
      "Inconformidades: " + Number(stats.inconformidades || 0),
      "Riscos altos/interdição: " + Number(stats.riscosAltos || 0),
      "Observações: " + safeValue_(report.observacoes),
      "Texto esperado: 1 parágrafo profissional, claro e revisável."
    ].join("\n");
  }

  if (payload.action === "review") {
    return [
      "Revise o relatório antes da exportação do PDF e gere uma checklist técnica curta.",
      "Obra: " + safeValue_(report.obra),
      "Local: " + safeValue_(report.local),
      "Data da vistoria: " + safeValue_(report.dataVistoria),
      "Responsável técnico: " + safeValue_(report.responsavelTecnico),
      "E-mail destino: " + safeValue_(report.emailDestino),
      "Fotos: " + Number(stats.fotos || 0),
      "Inconformidades: " + Number(stats.inconformidades || 0),
      "Riscos altos/interdição: " + Number(stats.riscosAltos || 0),
      "Itens preenchidos: " + JSON.stringify(items),
      "Texto esperado: checklist curta com pontos a conferir antes do PDF."
    ].join("\n");
  }

  if (context.kind === "daily-services") {
    return [
      "Modo: melhorar serviços executados do Diário de Obras.",
      "Ajuste apenas gramática, concordância, pontuação, unidades e clareza.",
      "Pode usar sinônimos técnicos simples quando melhorar a leitura.",
      "Não trate o texto como inconformidade, patologia, falha ou ocorrência.",
      "Não inclua recomendações, causas, diagnóstico, solução, risco, aderência, correção ou providências.",
      "Não crie resumo do dia. Não acrescente dados que o usuário não escreveu.",
      "Mantenha o sentido original e escreva como registro objetivo de produção/serviço executado.",
      "Exemplo:",
      "Entrada: revestimento argamassado em alvenaria Execução de 80m² de muro de alvenaria em blocos estrutural",
      "Saída: Revestimento argamassado em alvenaria. Execução de 80 m² de muro de alvenaria em blocos estruturais.",
      "Texto original:",
      payload.text,
      "Texto esperado: apenas o texto revisado, sem comentário adicional."
    ].join("\n");
  }

  return [
    "Modo: " + getTextModeInstruction_(context.kind),
    "Corrija gramatica e concordancia.",
    "Nao acrescente causa, medida, norma ou local que nao esteja informado.",
    "Se o texto for curto, use termos neutros sem inventar detalhes.",
    "Exemplos de estilo esperado:",
    "Entrada: Infiltracao na parede do quarto",
    "Saida: Foi identificada infiltracao localizada na parede do quarto, recomendando-se a investigacao da origem da umidade e a adocao das medidas corretivas necessarias.",
    "Entrada: Reboco soltando perto da janela",
    "Saida: Foi observado desplacamento do revestimento argamassado proximo a janela, sendo recomendada a verificacao da aderencia do material e a execucao dos reparos necessarios.",
    "Entrada: Piso quebrado",
    "Saida: Foi constatada peca de piso danificada no ambiente inspecionado, recomendando-se sua substituicao para restabelecer as condicoes adequadas de uso e acabamento.",
    "Melhore o texto tecnico abaixo mantendo o sentido original.",
    "Tipo do campo: " + safeValue_(context.kind),
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Texto original:",
    payload.text,
    "Texto esperado: linguagem técnica, objetiva, sem inventar informações."
  ].join("\n");
}

function getTextModeInstruction_(kind) {
  if (kind === "daily-services") {
    return "melhorar serviços executados do Diário de Obras sem diagnosticar inconformidade nem criar recomendação";
  }

  if (kind === "solution") {
    return "gerar recomendacao tecnica objetiva para a ocorrencia informada";
  }

  if (kind === "photo") {
    return "melhorar legenda ou descricao curta de foto tecnica";
  }

  if (kind === "general") {
    return "reescrever observacao em linguagem mais objetiva e tecnica";
  }

  if (kind === "conclusion") {
    return "melhorar conclusao tecnica";
  }

  return "melhorar descricao da ocorrencia em linguagem tecnica";
}

export function buildVisionUserPrompt_(payload) {
  const context = payload.context || {};
  const report = context.report || {};
  const image = payload.image || {};
  const pathologyQuery = buildPathologyQuery_(payload);
  const pathologyContext = buildPathologyContext(pathologyQuery);

  return [
    "Analise a foto anexada ao relatorio tecnico como triagem visual assistida.",
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Tipo da foto: " + safeValue_(context.imageLabel || context.targetName || context.imageInputName),
    "Arquivo: " + safeValue_(image.fileName),
    "Dimensoes: " + Number(image.width || 0) + "x" + Number(image.height || 0),
    "",
    "Contexto tecnico consultado na base local:",
    pathologyContext,
    "",
    "Antes de escolher o formato, classifique a imagem.",
    "Se a imagem nao apresentar elementos claros de obra, construcao, patologia, fissura, trinca, infiltracao, umidade, corrosao, concreto, armadura, revestimento ou desplacamento, use modoAnalise = \"geral\".",
    "No modo geral, descreva apenas o que aparece, elementos principais, contexto provavel e texto visivel quando relevante.",
    "No modo geral, diga claramente: \"Nao ha evidencia visual suficiente de patologia de obra nesta imagem.\"",
    "No modo geral, nao use possivel manifestacao, grau preliminar, texto sugerido para relatorio, observacao obrigatoria ou verificacoes recomendadas tecnicas.",
    "Use modoAnalise = \"tecnico\" somente quando a imagem realmente parecer foto de obra, construcao ou patologia de obra.",
    "",
    "Restricoes obrigatorias:",
    "- Nao afirmar causa definitiva.",
    "- Nao afirmar problema estrutural confirmado.",
    "- Nao emitir laudo nem condenar elemento.",
    "- Usar expressoes como possivel manifestacao, indicio visual e necessita inspecao complementar.",
    "- Se a imagem nao permitir avaliar, registrar baixa confianca e recomendar nova foto/verificacao.",
    "",
    "Padrao de resposta:",
    "- Se modoAnalise for geral: o que aparece na imagem; elementos principais; contexto provavel; texto visivel; mensagem sem evidencia de patologia de obra.",
    "- Se modoAnalise for tecnico:",
    "- Elemento observado.",
    "- Possivel manifestacao.",
    "- Evidencias visuais.",
    "- Verificacoes recomendadas.",
    "- Grau preliminar.",
    "- Texto sugerido para relatorio.",
    "- Observacao obrigatoria.",
    "",
    "Retorne JSON exatamente neste formato:",
    "{",
    "  \"modoAnalise\": \"geral | tecnico\",",
    "  \"elementoObservado\": \"elemento ou local visivel, sem inventar\",",
    "  \"categoriaProvavel\": \"uma categoria da biblioteca ou vazio\",",
    "  \"confianca\": \"baixa | media | alta\",",
    "  \"descricaoTecnica\": \"descricao objetiva do que e visivel\",",
    "  \"elementosPrincipais\": [\"elemento principal 1\", \"elemento principal 2\"],",
    "  \"contextoProvavel\": \"contexto percebido quando modoAnalise for geral\",",
    "  \"textoVisivel\": \"texto visivel na imagem, se houver\",",
    "  \"evidenciasVisuais\": [\"evidencia 1\", \"evidencia 2\"],",
    "  \"possiveisInconformidades\": [\"possivel manifestacao 1\"],",
    "  \"verificacoesRecomendadas\": [\"verificacao 1\", \"verificacao 2\"],",
    "  \"grauPreliminar\": \"baixo | atencao | critico visual\",",
    "  \"textoRelatorio\": \"texto revisavel para inserir no relatorio\",",
    "  \"observacaoObrigatoria\": \"Analise assistida por IA, sujeita a validacao do responsavel tecnico.\"",
    "}"
  ].join("\n");

  return [
    "Analise a foto anexada ao relatório técnico.",
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Tipo da foto: " + safeValue_(context.imageLabel || context.targetName || context.imageInputName),
    "Arquivo: " + safeValue_(image.fileName),
    "Dimensões: " + Number(image.width || 0) + "x" + Number(image.height || 0),
    "Retorne JSON exatamente neste formato:",
    "{",
    "  \"descricaoTecnica\": \"descrição objetiva do que é visível\",",
    "  \"possiveisInconformidades\": [\"item 1\", \"item 2\"],",
    "  \"recomendacaoAcao\": \"ação recomendada para verificação/correção\",",
    "  \"textoRelatorio\": \"texto pronto para inserir no relatório\"",
    "}"
  ].join("\n");
}

function buildImageAnalysisLibraryPrompt_() {
  return PATHOLOGY_KNOWLEDGE_BASE.map((item) => [
    "- " + item.nome,
    "  Descricao: " + item.descricao,
    "  Sinais visuais: " + item.sinais_visuais.join("; "),
    "  Verificacoes: " + item.verificacoes_recomendadas.join("; "),
    "  Alertas: " + item.alertas.join("; ")
  ].join("\n")).join("\n");
}

function buildLegacyImageAnalysisLibraryPrompt_() {
  return OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map((item) => [
    "- " + item.category,
    "  Indicios visuais: " + item.visualCues.join("; "),
    "  Cuidado: " + item.caution
  ].join("\n")).join("\n");
}

function loadPathologyKnowledgeBase_() {
  try {
    return readdirSync(PATHOLOGY_KNOWLEDGE_DIR)
      .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
      .sort()
      .map((fileName) => {
        const raw = readFileSync(join(PATHOLOGY_KNOWLEDGE_DIR, fileName), "utf8");
        return normalizePathologyKnowledgeItem_(JSON.parse(raw));
      })
      .filter((item) => item.id && item.nome);
  } catch (error) {
    return OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map((item) => normalizePathologyKnowledgeItem_({
      id: item.id,
      nome: item.category,
      descricao: "Categoria tecnica local preparada para triagem visual assistida.",
      sinais_visuais: item.visualCues,
      causas_possiveis: [],
      verificacoes_recomendadas: ["validar em vistoria por responsavel tecnico"],
      grau_preliminar_padrao: "atencao",
      alertas: [item.caution],
      termos_relacionados: item.category.split(/[\s/-]+/)
    }));
  }
}

function normalizePathologyKnowledgeItem_(item) {
  const safe = item && typeof item === "object" ? item : {};
  return {
    id: clean_(safe.id),
    nome: clean_(safe.nome),
    descricao: clean_(safe.descricao),
    sinais_visuais: normalizeStringArray_(safe.sinais_visuais).slice(0, 8),
    causas_possiveis: normalizeStringArray_(safe.causas_possiveis).slice(0, 8),
    verificacoes_recomendadas: normalizeStringArray_(safe.verificacoes_recomendadas).slice(0, 8),
    grau_preliminar_padrao: clean_(safe.grau_preliminar_padrao || "atencao"),
    alertas: normalizeStringArray_(safe.alertas).slice(0, 8),
    termos_relacionados: normalizeStringArray_(safe.termos_relacionados).slice(0, 20)
  };
}

export function searchPathologyKnowledge(query) {
  const normalizedQuery = normalizeSearchText_(query);
  const queryTerms = normalizedQuery.split(" ").filter((item) => item.length >= 3);
  const scored = PATHOLOGY_KNOWLEDGE_BASE.map((item) => {
    const haystack = normalizeSearchText_([
      item.id,
      item.nome,
      item.descricao,
      item.sinais_visuais.join(" "),
      item.causas_possiveis.join(" "),
      item.verificacoes_recomendadas.join(" "),
      item.alertas.join(" "),
      item.termos_relacionados.join(" ")
    ].join(" "));
    const score = queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return {
      item,
      score
    };
  });
  const matches = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  return {
    query: clean_(query),
    items: (matches.length ? matches : PATHOLOGY_KNOWLEDGE_BASE).slice(0, 4),
    totalRecords: PATHOLOGY_KNOWLEDGE_BASE.length
  };
}

export function buildPathologyContext(query) {
  const result = searchPathologyKnowledge(query);
  const selected = result.items.map((item) => [
    "- " + item.nome,
    "  Descricao: " + item.descricao,
    "  Sinais visuais: " + item.sinais_visuais.join("; "),
    "  Possiveis causas a verificar, sem concluir: " + item.causas_possiveis.join("; "),
    "  Verificacoes recomendadas: " + item.verificacoes_recomendadas.join("; "),
    "  Grau preliminar padrao: " + item.grau_preliminar_padrao,
    "  Alertas: " + item.alertas.join("; ")
  ].join("\n")).join("\n");

  return [
    "Registros locais consultados: " + result.items.length + " de " + result.totalRecords + ".",
    "Catalogo disponivel: " + PATHOLOGY_KNOWLEDGE_BASE.map((item) => item.nome).join("; ") + ".",
    selected,
    "",
    "Regras de seguranca permanentes:",
    "- Nao emitir laudo definitivo.",
    "- Nao afirmar causa definitiva.",
    "- Nao afirmar risco estrutural confirmado.",
    "- Nao condenar elemento.",
    "- Tratar a resposta como analise preliminar sujeita a validacao do responsavel tecnico."
  ].join("\n");
}

function buildPathologyQuery_(payload) {
  const context = (payload && payload.context) || {};
  const report = context.report || {};
  const image = (payload && payload.image) || {};

  return [
    context.imageLabel,
    context.targetName,
    context.imageInputName,
    image.fileName,
    report.obra,
    report.local,
    report.observacoes
  ].map(clean_).filter(Boolean).join(" ");
}

function normalizeSearchText_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOutputText_(data) {
  if (typeof data.output_text === "string") {
    return clean_(data.output_text);
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  const chunks = [];
  data.output.forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    });
  });

  return clean_(chunks.join("\n"));
}

function parseImageAnalysis_(text) {
  const jsonText = extractJsonObject_(text);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      return normalizeImageAnalysis_(parsed);
    } catch (error) {
      // Continua para fallback textual.
    }
  }

  return normalizeImageAnalysis_({
    descricaoTecnica: text,
    possiveisInconformidades: [],
    recomendacaoAcao: "Revisar a imagem e complementar a análise técnica manualmente.",
    textoRelatorio: text
  });
}

export function normalizeImageAnalysis_(analysis) {
  const safe = analysis && typeof analysis === "object" ? analysis : {};
  const evidencias = normalizeStringArray_(safe.evidenciasVisuais).slice(0, 6);
  const inconformidades = normalizeStringArray_(safe.possiveisInconformidades).slice(0, 5);
  const verificacoes = normalizeStringArray_(safe.verificacoesRecomendadas).slice(0, 6);
  const elementosPrincipais = normalizeStringArray_(safe.elementosPrincipais).slice(0, 6);
  const descricao = clean_(safe.descricaoTecnica);
  const recomendacao = clean_(safe.recomendacaoAcao) || verificacoes.join("; ");
  const textoRelatorio = clean_(safe.textoRelatorio || descricao);

  return {
    modoAnalise: clean_(safe.modoAnalise).toLowerCase() === "geral" ? "geral" : "tecnico",
    elementoObservado: clean_(safe.elementoObservado),
    categoriaProvavel: clean_(safe.categoriaProvavel),
    confianca: clean_(safe.confianca),
    descricaoTecnica: descricao,
    elementosPrincipais,
    contextoProvavel: clean_(safe.contextoProvavel),
    textoVisivel: clean_(safe.textoVisivel),
    evidenciasVisuais: evidencias,
    possiveisInconformidades: inconformidades,
    verificacoesRecomendadas: verificacoes,
    grauPreliminar: clean_(safe.grauPreliminar),
    recomendacaoAcao: recomendacao,
    textoRelatorio,
    observacaoObrigatoria: clean_(safe.observacaoObrigatoria) || "Analise assistida por IA, sujeita a validacao do responsavel tecnico."
  };

  const legacyInconformidades = Array.isArray(analysis.possiveisInconformidades)
    ? analysis.possiveisInconformidades.map(clean_).filter(Boolean).slice(0, 5)
    : [];

  return {
    descricaoTecnica: clean_(analysis.descricaoTecnica),
    possiveisInconformidades: legacyInconformidades,
    recomendacaoAcao: clean_(analysis.recomendacaoAcao),
    textoRelatorio: clean_(analysis.textoRelatorio || analysis.descricaoTecnica)
  };
}

export function formatImageAnalysis_(analysis) {
  if (analysis.modoAnalise === "geral") {
    const lines = [
      "O que aparece na imagem: " + safeValue_(analysis.descricaoTecnica || analysis.elementoObservado),
      "Elementos principais: " + safeValue_(
        analysis.elementosPrincipais && analysis.elementosPrincipais.length
          ? analysis.elementosPrincipais.join("; ")
          : analysis.elementoObservado
      ),
      "Contexto provavel: " + safeValue_(analysis.contextoProvavel)
    ];

    if (analysis.textoVisivel) {
      lines.push("Texto presente: " + safeValue_(analysis.textoVisivel));
    }

    lines.push("Nao ha evidencia visual suficiente de patologia de obra nesta imagem.");
    return lines.join("\n");
  }

  const evidencias = analysis.evidenciasVisuais && analysis.evidenciasVisuais.length
    ? analysis.evidenciasVisuais.join("; ")
    : safeValue_(analysis.descricaoTecnica);
  const manifestacoes = analysis.possiveisInconformidades && analysis.possiveisInconformidades.length
    ? analysis.possiveisInconformidades.join("; ")
    : safeValue_(analysis.categoriaProvavel || "nao classificada pela imagem");
  const verificacoes = analysis.verificacoesRecomendadas && analysis.verificacoesRecomendadas.length
    ? analysis.verificacoesRecomendadas.join("; ")
    : safeValue_(analysis.recomendacaoAcao);

  return [
    "Elemento observado: " + safeValue_(analysis.elementoObservado || "elemento visivel na foto"),
    "Possivel manifestacao: " + manifestacoes,
    "Evidencias visuais: " + evidencias,
    "Verificacoes recomendadas: " + verificacoes,
    "Grau preliminar: " + safeValue_(analysis.grauPreliminar || analysis.confianca || "nao classificado"),
    "Texto sugerido para relatorio: " + safeValue_(analysis.textoRelatorio),
    "Observacao obrigatoria: " + safeValue_(analysis.observacaoObrigatoria || "Analise assistida por IA, sujeita a validacao do responsavel tecnico.")
  ].join("\n");

  const lines = [
    "DESCRIÇÃO TÉCNICA: " + safeValue_(analysis.descricaoTecnica)
  ];

  if (analysis.possiveisInconformidades && analysis.possiveisInconformidades.length) {
    lines.push("POSSÍVEIS INCONFORMIDADES: " + analysis.possiveisInconformidades.join("; ") + ".");
  }

  lines.push("RECOMENDAÇÃO DE AÇÃO: " + safeValue_(analysis.recomendacaoAcao));
  lines.push("TEXTO PARA O RELATÓRIO: " + safeValue_(analysis.textoRelatorio));
  return lines.join("\n\n");
}

function extractJsonObject_(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return "";
  }

  return text.slice(start, end + 1);
}

function normalizeStringArray_(value) {
  if (Array.isArray(value)) {
    return value.map(clean_).filter(Boolean);
  }

  const text = clean_(value);
  return text ? [text] : [];
}

function getActionTitle_(action) {
  if (action === "conclusion") {
    return "Conclusão técnica sugerida";
  }

  if (action === "review") {
    return "Revisão técnica antes do PDF";
  }

  return "Sugestão da IA";
}

function safeValue_(value) {
  return clean_(value) || "-";
}

function clean_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanMultiline_(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => clean_(line))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function normalizeEloSearchText_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasEloSearchPhrase_(normalizedText, normalizedPhrase) {
  if (!normalizedText || !normalizedPhrase) {
    return false;
  }
  return (" " + normalizedText + " ").includes(" " + normalizedPhrase + " ");
}

function normalizeEloDecisionText_(value) {
  return clean_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function hasAnyEloDecisionTerm_(text, terms) {
  return terms.some((term) => text.includes(normalizeEloDecisionText_(term)));
}

function isSimpleEloCalculation_(text) {
  const calculationTerms = [
    "quantos",
    "quanto",
    "calcule",
    "calcular",
    "preciso",
    "bloco",
    "blocos",
    "concreto",
    "laje",
    "calcada",
    "calçada",
    "piso",
    "revestimento",
    "tinta",
    "argamassa",
    "m2",
    "m3"
  ];
  const reusableTerms = ["guardar", "guarde", "lembrar", "lembre", "resumo", "relatorio", "relatório", "orcamento", "orçamento", "planejamento"];
  const hasMeasure = /\b\d+(?:[,.]\d+)?\s*(?:(?:x|por)\s*\d+(?:[,.]\d+)?|m2|m3|m|metros?|cm)\b/.test(text);
  return hasMeasure && hasAnyEloDecisionTerm_(text, calculationTerms) && !hasAnyEloDecisionTerm_(text, reusableTerms);
}

function cleanBase64_(value) {
  return String(value || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, "").trim();
}

function createStockDemoStore_() {
  return {
    states: new Map()
  };
}

function getStockDemoRequestKey_(request) {
  const source = request.method === "GET" ? request.query : request.body;
  return normalizeStockDemoKey_(
    (source && (source.key || source.demoKey)) ||
    (request.query && (request.query.key || request.query.demoKey)) ||
    "stock-ai-demo"
  );
}

function normalizeStockDemoKey_(value) {
  const text = clean_(value).toLowerCase();
  const normalized = typeof text.normalize === "function"
    ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : text;
  return normalized.replace(/[^a-z0-9._:-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "stock-ai-demo";
}

function isPrivateNetworkOrigin_(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname;

    return url.protocol === "http:" && (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch (error) {
    return false;
  }
}

function validateStockDemoStateRequest_(body) {
  const key = normalizeStockDemoKey_(body.key || body.demoKey);
  const state = body.state && typeof body.state === "object" ? body.state : null;

  if (!state) {
    return {
      ok: false,
      status: 400,
      message: "Envie o estado da demo do Stock AI."
    };
  }

  if (JSON.stringify(state).length > MAX_STOCK_DEMO_STATE_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Estado da demo muito grande para sincronizar."
    };
  }

  return {
    ok: true,
    key,
    state: normalizeStockDemoState_(state)
  };
}

function validateStockDemoApprovalRequest_(body) {
  const stateValidation = body.state ? validateStockDemoStateRequest_(body) : null;
  const key = normalizeStockDemoKey_(body.key || body.demoKey);
  const request = body.request && typeof body.request === "object" ? normalizeStockDemoApproval_(body.request) : null;

  if (!request || !request.id) {
    return {
      ok: false,
      status: 400,
      message: "Envie uma solicitacao de aprovacao valida."
    };
  }

  if (stateValidation && !stateValidation.ok) {
    return stateValidation;
  }

  return {
    ok: true,
    key,
    request,
    state: stateValidation ? stateValidation.state : null
  };
}

function saveStockDemoState_(store, key, state) {
  const current = store.states.get(key);
  const entry = {
    state: normalizeStockDemoState_(state),
    revision: current ? current.revision + 1 : 1,
    updatedAt: new Date().toISOString()
  };
  store.states.set(key, entry);
  return entry;
}

function upsertStockDemoApprovalRequest_(store, key, request, state) {
  const current = store.states.get(key);
  const baseState = normalizeStockDemoState_(state || (current && current.state) || {});
  const requests = Array.isArray(baseState.approvalRequests) ? baseState.approvalRequests : [];
  const index = requests.findIndex((item) => clean_(item.id) === request.id);

  if (index >= 0) {
    requests[index] = Object.assign({}, requests[index], request);
  } else {
    requests.unshift(request);
  }

  baseState.approvalRequests = requests.slice(0, 200);
  return saveStockDemoState_(store, key, baseState);
}

function updateStockDemoApprovalStatus_(store, key, requestId, status, body) {
  const current = store.states.get(key);
  const state = normalizeStockDemoState_((body && body.state) || (current && current.state) || {});
  const request = state.approvalRequests.find((item) => clean_(item.id) === clean_(requestId));

  if (!request) {
    return {
      ok: false,
      status: 404,
      message: "Solicitacao nao encontrada na demo remota."
    };
  }

  request.status = status;
  if (status === "approved") {
    request.approvedAt = clean_(request.approvedAt) || new Date().toISOString();
    request.approvedBy = clean_(request.approvedBy || body.approvedBy);
    request.approvedByName = clean_(request.approvedByName || body.approvedByName);
  } else {
    request.rejectedAt = clean_(request.rejectedAt) || new Date().toISOString();
    request.rejectedBy = clean_(request.rejectedBy || body.rejectedBy);
    request.rejectedByName = clean_(request.rejectedByName || body.rejectedByName);
  }

  const entry = saveStockDemoState_(store, key, state);
  return {
    ok: true,
    payload: {
      ok: true,
      key,
      request,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    }
  };
}

function normalizeStockDemoState_(state) {
  const safe = state && typeof state === "object" ? state : {};

  return {
    items: Array.isArray(safe.items) ? safe.items.slice(0, 500) : [],
    movements: Array.isArray(safe.movements) ? safe.movements.slice(0, 1000) : [],
    alertsMuted: Boolean(safe.alertsMuted),
    alertsMutedUntil: clean_(safe.alertsMutedUntil),
    alertHistory: Array.isArray(safe.alertHistory) ? safe.alertHistory.slice(0, 100) : [],
    approvalRequests: Array.isArray(safe.approvalRequests)
      ? safe.approvalRequests.map(normalizeStockDemoApproval_).filter((item) => item.id).slice(0, 200)
      : [],
    stockEnvironments: Array.isArray(safe.stockEnvironments) ? safe.stockEnvironments.slice(0, 80) : [],
    activeStockEnvironmentId: clean_(safe.activeStockEnvironmentId),
    updatedAt: clean_(safe.updatedAt) || new Date().toISOString()
  };
}

function normalizeStockDemoApproval_(request) {
  const safe = request && typeof request === "object" ? request : {};
  const type = safe.type === "saida" || safe.type === "exit" ? "saida" : "entrada";
  const status = ["pending", "approved", "rejected"].includes(safe.status) ? safe.status : "pending";

  return Object.assign({}, safe, {
    id: clean_(safe.id),
    organizationId: clean_(safe.organizationId || safe.environmentId),
    environmentId: clean_(safe.environmentId || safe.organizationId),
    userId: clean_(safe.userId),
    role: safe.role === "gestor" ? "gestor" : "almoxarife",
    createdByName: clean_(safe.createdByName),
    createdByEmail: clean_(safe.createdByEmail),
    type,
    status,
    payload: safe.payload && typeof safe.payload === "object" ? safe.payload : {},
    createdAt: clean_(safe.createdAt) || new Date().toISOString(),
    approvedAt: clean_(safe.approvedAt),
    approvedBy: clean_(safe.approvedBy),
    approvedByName: clean_(safe.approvedByName),
    rejectedAt: clean_(safe.rejectedAt),
    rejectedBy: clean_(safe.rejectedBy),
    rejectedByName: clean_(safe.rejectedByName)
  });
}
