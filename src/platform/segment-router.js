export const platformSegments = [
  {
    id: "commerce",
    publicName: "Comércio e Estoque",
    pain: "Minha loja ou depósito precisa controlar estoque sem depender de planilha.",
    suggestedModules: ["stock-full", "elo"],
    offer: "Stock Full Essencial",
    promise: "Controle de estoque no celular, com inventário guiado, operação offline e auditoria.",
    status: "ready_for_paid_pilot"
  },
  {
    id: "engineering",
    publicName: "Engenharia e Obras",
    pain: "Preciso documentar obra, gerar relatórios, RDOs e controlar materiais.",
    suggestedModules: ["obrareport", "stock-obras", "elo", "cadista"],
    offer: "Pacote Engenharia Assistida",
    promise: "Relatórios, diário de obra, estoque técnico e apoio de IA para rotina de engenharia.",
    status: "assisted_paid_pilot"
  },
  {
    id: "healthcare",
    publicName: "Saúde e Rotina Sensível",
    pain: "Preciso controlar insumos, lote, validade, aprovações e rastreabilidade.",
    suggestedModules: ["stock-saude-jovem4", "elo"],
    offer: "Stock Saúde Implantação Controlada",
    promise: "Controle rastreável de insumos de saúde, com responsabilidade e auditoria.",
    status: "controlled_implantation_only"
  },
  {
    id: "ai-hub",
    publicName: "Assistente ELO",
    pain: "Quero conversar com a IA e descobrir qual solução usar.",
    suggestedModules: ["elo"],
    offer: "ELO como cérebro da plataforma",
    promise: "O ELO entende sua necessidade e direciona para o especialista certo.",
    status: "platform_brain"
  }
];

const SEGMENT_KEYWORDS = {
  commerce: ["loja", "estoque", "produto", "venda", "balcao", "deposito", "inventario", "funcionario"],
  engineering: ["obra", "relatorio", "rdo", "engenharia", "construtora", "vistoria", "material de obra", "diario"],
  healthcare: ["saude", "clinica", "medicamento", "validade", "lote", "atendimento", "insumo sensivel"],
  "ai-hub": ["ia", "assistente", "conversar", "ajuda", "nao sei", "qual solucao"]
};

const READINESS_BY_SEGMENT = {
  commerce: {
    score: 90,
    level: "ready_for_paid_pilot",
    canSellNow: true,
    salesMode: "piloto pago",
    blockers: ["billing central ainda nao conectado"],
    recommendedNextActions: ["Vender como Stock Full Essencial em piloto pago acompanhado."]
  },
  engineering: {
    score: 75,
    level: "assisted_paid_pilot",
    canSellNow: true,
    salesMode: "piloto pago assistido",
    blockers: ["CADISTA ainda em maturacao", "Stock Obras deve entrar como recurso tecnico, nao SaaS isolado"],
    recommendedNextActions: ["Vender como Pacote Engenharia Assistida com escopo controlado."]
  },
  healthcare: {
    score: 55,
    level: "controlled_implantation_only",
    canSellNow: false,
    salesMode: "implantacao controlada",
    blockers: ["dados sensiveis exigem compliance", "nao vender self-service"],
    recommendedNextActions: ["Validar LGPD, auditoria, acesso e retencao antes de escalar."]
  },
  "ai-hub": {
    score: 60,
    level: "platform_brain",
    canSellNow: false,
    salesMode: "cerebro transversal da plataforma",
    blockers: ["nao vender isolado como produto principal"],
    recommendedNextActions: ["Usar ELO como entrada consultiva e roteador para os especialistas."]
  }
};

const AMBIGUOUS_NEXT_QUESTION = "Voce quer ajuda com comercio/estoque, engenharia/obra, saude ou apenas conversar com o ELO?";

function normalizeText(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function countKeywordHits(normalizedText, keywords) {
  return keywords.reduce((total, keyword) => {
    return normalizedText.includes(normalizeText(keyword)) ? total + 1 : total;
  }, 0);
}

function cloneSegment(segment) {
  return segment ? { ...segment, suggestedModules: [...segment.suggestedModules] } : null;
}

export function getSegments() {
  return platformSegments.map(cloneSegment);
}

export function getSegmentById(id) {
  return cloneSegment(platformSegments.find((segment) => segment.id === id));
}

export function recommendSegmentFromText(text) {
  const normalizedText = normalizeText(text);
  const scores = Object.entries(SEGMENT_KEYWORDS).map(([segmentId, keywords]) => ({
    segmentId,
    score: countKeywordHits(normalizedText, keywords)
  }));
  const maxScore = Math.max(...scores.map((entry) => entry.score));

  if (maxScore <= 0) {
    return {
      ...getSegmentById("ai-hub"),
      suggestedNextQuestion: AMBIGUOUS_NEXT_QUESTION
    };
  }

  const winners = scores.filter((entry) => entry.score === maxScore);
  if (winners.length !== 1) {
    return {
      ...getSegmentById("ai-hub"),
      suggestedNextQuestion: AMBIGUOUS_NEXT_QUESTION
    };
  }

  return getSegmentById(winners[0].segmentId);
}

export function getSegmentOffer(segmentId) {
  const segment = getSegmentById(segmentId);
  return segment ? segment.offer : null;
}

export function getSegmentModules(segmentId) {
  const segment = getSegmentById(segmentId);
  return segment ? segment.suggestedModules : [];
}

export function evaluateSegmentReadiness(segmentId) {
  const readiness = READINESS_BY_SEGMENT[segmentId];
  if (!readiness) {
    return {
      score: 0,
      level: "invalid",
      canSellNow: false,
      salesMode: "indefinido",
      blockers: ["segmento invalido"],
      recommendedNextActions: ["Cadastrar segmento comercial antes de avaliar."]
    };
  }

  return {
    ...readiness,
    blockers: [...readiness.blockers],
    recommendedNextActions: [...readiness.recommendedNextActions]
  };
}

export default platformSegments;
