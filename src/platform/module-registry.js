const MODULE_IDS = [
  "elo",
  "cadista",
  "obrareport",
  "stock-obras",
  "stock-full",
  "stock-saude-jovem4"
];

export const platformModules = [
  {
    id: "elo",
    name: "ELO Brain",
    market: "assistente transversal para engenharia, documentos, projetos e operacao",
    countryMode: "GLOBAL_READY",
    route: "/elo.html",
    status: "published",
    saasReady: false,
    requiresSensitiveData: false,
    usesAI: true,
    usesPDF: true,
    usesBilling: false,
    permissions: ["elo:chat", "elo:budget", "elo:report", "elo:orchestrate"],
    integrations: MODULE_IDS.filter((id) => id !== "elo"),
    readiness: {
      login: false,
      multiCompany: false,
      persistence: "local_and_backend_partial",
      permissions: false,
      dataIsolation: false,
      onboarding: true,
      billing: false,
      internationalSupport: true,
      lgpdSensitiveData: true,
      exportsReports: true
    }
  },
  {
    id: "cadista",
    name: "CADISTA AI",
    market: "geracao assistida de plantas, PDF e DXF para arquitetura/engenharia",
    countryMode: "GLOBAL_READY",
    route: "/cadista/",
    status: "prototype",
    saasReady: false,
    requiresSensitiveData: false,
    usesAI: true,
    usesPDF: true,
    usesBilling: false,
    permissions: ["cadista:project:create", "cadista:export:pdf", "cadista:export:dxf"],
    integrations: ["elo", "obrareport"],
    readiness: {
      login: false,
      multiCompany: false,
      persistence: "local",
      permissions: false,
      dataIsolation: false,
      onboarding: false,
      billing: false,
      internationalSupport: true,
      lgpdSensitiveData: true,
      exportsReports: true
    }
  },
  {
    id: "obrareport",
    name: "ObraReport",
    market: "relatorios tecnicos, RDO, clientes, obras, fotos e documentos para engenharia",
    countryMode: "BR",
    route: "/relatorio-qualidade-obras/relatorio-qualidade-obras.html",
    status: "published_pilot",
    saasReady: false,
    requiresSensitiveData: false,
    usesAI: true,
    usesPDF: true,
    usesBilling: true,
    permissions: ["clients:manage", "projects:manage", "reports:write", "rdos:write", "documents:export", "stock:access"],
    integrations: ["elo", "stock-obras", "stock-full"],
    readiness: {
      login: true,
      multiCompany: true,
      persistence: "local_and_backend_partial",
      permissions: true,
      dataIsolation: true,
      onboarding: true,
      billing: false,
      internationalSupport: false,
      lgpdSensitiveData: true,
      exportsReports: true
    }
  },
  {
    id: "stock-obras",
    name: "Stock Obras",
    market: "previsao, consumo e auditoria de materiais por obra com SINAPI/ORSE quando aplicavel",
    countryMode: "BR",
    route: "/stock-ai-obras.html",
    status: "stable_pilot",
    saasReady: false,
    requiresSensitiveData: false,
    usesAI: true,
    usesPDF: true,
    usesBilling: false,
    permissions: ["stock-obras:items", "stock-obras:movements", "stock-obras:reports", "stock-obras:bases"],
    integrations: ["elo", "obrareport"],
    readiness: {
      login: false,
      multiCompany: false,
      persistence: "local",
      permissions: false,
      dataIsolation: false,
      onboarding: true,
      billing: false,
      internationalSupport: false,
      lgpdSensitiveData: true,
      exportsReports: true
    }
  },
  {
    id: "stock-full",
    name: "Stock Full",
    market: "estoque comercial multiempresa para lojas e operacoes gerais",
    countryMode: "GLOBAL_READY",
    route: "/stockfull.html",
    status: "saas_pilot",
    saasReady: true,
    requiresSensitiveData: false,
    usesAI: true,
    usesPDF: true,
    usesBilling: false,
    permissions: ["dashboard:view", "products:view", "products:create", "movements:in", "movements:out", "reports:view", "reports:audit", "backup:export", "settings:view", "users:manage"],
    integrations: ["elo", "obrareport"],
    readiness: {
      login: true,
      multiCompany: true,
      persistence: "supabase_with_local_fallback",
      permissions: true,
      dataIsolation: true,
      onboarding: true,
      billing: false,
      internationalSupport: true,
      lgpdSensitiveData: true,
      exportsReports: true
    }
  },
  {
    id: "stock-saude-jovem4",
    name: "Stock Saude Jovem4",
    market: "almoxarifado de saude com lote, validade, aprovacoes e auditoria",
    countryMode: "BR_HEALTH_RULES",
    route: "/stock-saude.html",
    status: "functional_pilot",
    saasReady: false,
    requiresSensitiveData: true,
    usesAI: true,
    usesPDF: true,
    usesBilling: false,
    permissions: ["health-stock:items", "health-stock:entries", "health-stock:exits", "health-stock:approve", "health-stock:audit", "health-stock:invites"],
    integrations: ["elo"],
    readiness: {
      login: true,
      multiCompany: true,
      persistence: "supabase_with_local_demo",
      permissions: true,
      dataIsolation: true,
      onboarding: false,
      billing: false,
      internationalSupport: false,
      lgpdSensitiveData: false,
      exportsReports: true
    }
  }
];

const CRITERIA = [
  ["login", "login", "Implantar login/autenticacao real por modulo."],
  ["multiempresa", "multiCompany", "Garantir empresa/instituicao como fronteira central."],
  ["persistencia real", "persistence", "Trocar fallback local por persistencia transacional quando o modulo exigir SaaS."],
  ["permissoes", "permissions", "Formalizar matriz de permissoes por perfil."],
  ["isolamento de dados", "dataIsolation", "Validar isolamento por empresa/projeto/usuario."],
  ["onboarding", "onboarding", "Criar fluxo de ativacao e primeiro uso."],
  ["billing", "billing", "Conectar assinaturas, planos e limites de uso."],
  ["suporte internacional", "internationalSupport", "Separar idioma, moeda, impostos e regras locais."],
  ["LGPD/dados sensiveis", "lgpdSensitiveData", "Formalizar LGPD, auditoria, consentimento e retencao de dados."],
  ["exportacao/relatorios", "exportsReports", "Padronizar exportacoes, PDF e historico de documentos."]
];

function criterionPasses(module, key) {
  const readiness = module && module.readiness || {};
  const value = readiness[key];
  if (key === "persistence") return value === "supabase" || value === "backend" || value === "supabase_with_local_fallback" || value === "local_and_backend_partial" || value === true;
  if (key === "lgpdSensitiveData" && !module.requiresSensitiveData) return true;
  return value === true;
}

export function evaluateModuleSaasReadiness(module) {
  if (!module || !module.id) {
    return {
      score: 0,
      level: "invalid",
      blockers: ["Modulo invalido ou sem id."],
      nextActions: ["Cadastrar modulo pelo contrato comum antes de avaliar."]
    };
  }

  const blockers = [];
  const nextActions = [];
  let passed = 0;

  CRITERIA.forEach(([label, key, action]) => {
    if (criterionPasses(module, key)) {
      passed += 1;
      return;
    }
    blockers.push(label);
    nextActions.push(action);
  });

  const score = Math.round((passed / CRITERIA.length) * 100);
  const level = score >= 90 ? "ready" : score >= 70 ? "pilot" : score >= 50 ? "foundation" : "blocked";

  return {
    score,
    level,
    blockers,
    nextActions: Array.from(new Set(nextActions))
  };
}

export function getPlatformModule(id) {
  return platformModules.find((module) => module.id === id) || null;
}

export default platformModules;
