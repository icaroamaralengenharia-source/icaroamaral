(function (root) {
  "use strict";

  const VERSION = "20260624-elo-brain-router-v1";
  const TECHNICAL_TERMS = [
    "sinapi", "orse", "orcamento", "orçamento", "orcar", "orçar", "composicao", "composição", "coeficiente", "estoque", "almoxarifado", "rdo", "auditoria", "retirada", "retirou", "executado", "executou", "material", "materiais", "saco", "sacos", "estrutura",
    "piso", "telha", "telhado", "cobertura", "bloco", "chapisco", "reboco", "emboço", "emboco", "contrapiso", "concreto", "sapata", "viga", "pilar", "laje", "pintura", "pintar", "impermeabilização", "impermeabilizacao", "eletroduto", "pvc", "argamassa", "cimento", "areia", "brita", "parede", "alvenaria", "porcelanato", "ceramico", "cerâmico", "casa", "obra", "fundacao", "fundação", "radier", "baldrame"
  ];
  const CONVERSATIONAL_TERMS = [
    "me motive", "motiva", "estou cansado", "to cansado", "tô cansado", "voce e o cara", "você é o cara", "o que acha disso", "vamos organizar", "me ajude a decidir", "desabafo", "minhas ideias", "planejamento pessoal"
  ];
  const SERVICE_HINTS = [
    ["contrapiso", /contrapiso|regulariza/i],
    ["piso_ceramico", /piso|porcelanato|ceramica|ceramico|revestimento|argamassa\s+ac|ac\s*2|ac\s*ii|ac\s*iii|junta/i],
    ["telhado", /telha|telhado|cobertura|cumeeira|ripamento|caibro|terça|terca|fibrocimento|portuguesa|colonial|estrutura\s+de\s+madeira/i],
    ["chapisco", /chapisco|xapisco/i],
    ["reboco", /reboco|rebocu|emboço|emboco|massa\s+unica/i],
    ["pintura", /pintura|pintar|tinta|selador|massa\s+corrida|dem[aã]o|demaos/i],
    ["alvenaria", /parede|alvenaria|bloco|bloko|baiano|tijolo/i],
    ["fundacao", /sapata|radier|baldrame|fundacao|fundação/i],
    ["concreto", /concreto|concretar/i],
    ["laje", /laje/i]
  ];

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function ensureContext(context) {
    const target = context || {};
    if (!target.technical) target.technical = {};
    if (!target.technical.facts) target.technical.facts = {};
    if (!target.technical.services) target.technical.services = {};
    if (!target.technical.audit) target.technical.audit = {};
    return target;
  }
  function parseNumber(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }
  function detectService(message, context) {
    const text = normalize(message);
    for (let index = 0; index < SERVICE_HINTS.length; index += 1) {
      if (SERVICE_HINTS[index][1].test(text)) return SERVICE_HINTS[index][0];
    }
    const active = context && context.technical && context.technical.activeService;
    if (active && (/^(e|é|eh|tambem|também|sao|são|quanto|quantos|quantas|isso|interno|externo|estrutura|retirou|executou|junta|ac\s*2|ac\s*ii|ac\s*iii|60x60|\d)/i.test(clean(message)) || /\b(m2|m²|cm|mm|saco|sacos|fck)\b/i.test(text))) return active;
    return "";
  }
  function hasQuantityUnit(message) {
    return /\d+(?:[,.]\d+)?\s*(m2|m²|m3|m³|m\b|cm\b|mm\b|saco|sacos|kg|litro|litros|un|und)/i.test(message || "");
  }
  function scoreTechnical(message, context) {
    const text = normalize(message);
    let score = 0;
    const reasons = [];
    TECHNICAL_TERMS.forEach(function (term) {
      if (text.indexOf(normalize(term)) >= 0) { score += 0.12; reasons.push("termo tecnico: " + term); }
    });
    if (hasQuantityUnit(message)) { score += 0.35; reasons.push("quantidade com unidade"); }
    if (/\b(fck|ac\s*2|ac\s*ii|ac\s*iii|60x60|junta|interno|externo)\b/i.test(text) && context && context.technical && context.technical.activeService) { score += 0.35; reasons.push("parametro tecnico do servico ativo"); }
    if (/\b(isso\s+esta\s+certo|isso\s+ta\s+certo|quanto\s+cimento|quantos\s+sacos|resumo\s+tecnico)\b/i.test(text) && context && context.technical && context.technical.activeService) { score += 0.35; reasons.push("pergunta tecnica com contexto ativo"); }
    return { score: Math.min(0.99, score), reasons: reasons };
  }
  function scoreConversational(message) {
    const text = normalize(message);
    let score = 0;
    const reasons = [];
    CONVERSATIONAL_TERMS.forEach(function (term) {
      if (text.indexOf(normalize(term)) >= 0) { score += 0.45; reasons.push("termo conversacional: " + term); }
    });
    if (/^(valeu|obrigado|obrigada|bom dia|boa tarde|boa noite)\b/i.test(text)) { score += 0.35; reasons.push("fala social"); }
    return { score: Math.min(0.99, score), reasons: reasons };
  }
  function rememberFacts(message, context) {
    const tech = context.technical;
    const raw = String(message || "");
    const text = normalize(raw);
    let match = raw.match(/casa[^\d]*(\d+(?:[,.]\d+)?)\s*m[²2]/i) || raw.match(/area\s+construida[^\d]*(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (match) tech.facts.builtAreaM2 = parseNumber(match[1]);
    match = raw.match(/paredes?\s+(?:tem|t[eê]m|possuem|com)?\s*(\d+(?:[,.]\d+)?)\s*m(?:etros?)?\s+de\s+altura/i) || raw.match(/altura[^\d]*(\d+(?:[,.]\d+)?)\s*m\b/i);
    if (match) tech.facts.wallHeightM = parseNumber(match[1]);
    if (/bloco\s+(baiano|ceramico|cerâmico)|bloko\s+baiano/i.test(raw)) {
      tech.facts.wallMaterial = /baiano/i.test(raw) ? "bloco ceramico baiano" : "bloco ceramico";
    }
  }
  function serviceMemory(context, serviceId) {
    if (!serviceId) return null;
    if (!context.technical.services[serviceId]) context.technical.services[serviceId] = {};
    return context.technical.services[serviceId];
  }
  function rememberServiceData(message, context, serviceId) {
    const memory = serviceMemory(context, serviceId);
    if (!memory) return;
    const raw = String(message || "");
    const text = normalize(raw);
    if (/telha\s+portuguesa|portuguesa/.test(text)) memory.material = "telha portuguesa";
    if (/estrutura\s+de\s+madeira|madeira/.test(text) && serviceId === "telhado") memory.structure = "estrutura de madeira";
    if (/piso|porcelanato|ceramica|ceramico/.test(text) && serviceId === "piso_ceramico") memory.service = "piso ceramico";
    const area = raw.match(/(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (area && ["piso_ceramico", "chapisco", "reboco", "contrapiso", "pintura", "alvenaria"].indexOf(serviceId) >= 0) memory.areaM2 = parseNumber(area[1]);
    const piece = raw.match(/(\d+\s*x\s*\d+)/i);
    if (piece && serviceId === "piso_ceramico") memory.tileSize = piece[1].replace(/\s+/g, "");
    const joint = raw.match(/junta\s*(\d+(?:[,.]\d+)?)\s*mm/i);
    if (joint && serviceId === "piso_ceramico") memory.jointMm = parseNumber(joint[1]);
    if (/\bac\s*2\b|\bac\s*ii\b/i.test(raw) && serviceId === "piso_ceramico") memory.mortar = "AC-II";
    if (/\bac\s*iii\b/i.test(raw) && serviceId === "piso_ceramico") memory.mortar = "AC-III";
    if (serviceId === "reboco" && !memory.areaM2 && context.technical.services.chapisco && context.technical.services.chapisco.areaM2) memory.areaM2 = context.technical.services.chapisco.areaM2;
    if (/interno|interna/.test(text)) memory.environment = "interno";
    if (/externo|externa/.test(text)) memory.environment = "externo";
    const thickness = raw.match(/(\d+(?:[,.]\d+)?)\s*cm/i);
    if (thickness && ["reboco", "contrapiso", "laje"].indexOf(serviceId) >= 0) memory.thicknessCm = parseNumber(thickness[1]);
    if (/cimento/.test(text)) memory.materialRequested = "cimento";
    context.technical.activeService = serviceId;
  }
  function rememberAudit(message, context) {
    const raw = String(message || "");
    const text = normalize(raw);
    let match = raw.match(/executou\s+(\d+(?:[,.]\d+)?)\s*m[²2]\s+de\s+parede/i) || raw.match(/rdo\s+informou\s+(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (match) {
      context.technical.audit.executedAreaM2 = parseNumber(match[1]);
      context.technical.audit.executedService = /parede|alvenaria/i.test(raw) ? "alvenaria" : (context.technical.activeService || "servico executado");
      context.technical.activeService = context.technical.audit.executedService;
    }
    match = raw.match(/retirou\s+(\d+(?:[,.]\d+)?)\s+sacos?\s+de\s+([^,.]+)/i) || raw.match(/liberou\s+(\d+(?:[,.]\d+)?)\s+sacos?\s+de\s+([^,.]+)/i);
    if (match) {
      context.technical.audit.withdrawnQuantity = parseNumber(match[1]);
      context.technical.audit.withdrawnMaterial = clean(match[2]);
    }
    if (/isso\s+(esta|ta)\s+certo|confer|comparar|consumo\s+acima/.test(text)) context.technical.audit.pendingCheck = true;
  }
  function buildContextPrefix(context, serviceId) {
    const tech = context.technical;
    const parts = [];
    const memory = serviceMemory(context, serviceId || tech.activeService);
    if (serviceId === "telhado" || tech.activeService === "telhado") {
      parts.push("servico cobertura telhado");
      if (memory && memory.material) parts.push(memory.material);
      if (memory && memory.structure) parts.push(memory.structure);
    }
    if (serviceId === "alvenaria" || tech.activeService === "alvenaria") {
      parts.push("servico alvenaria parede");
      if (tech.facts.wallMaterial) parts.push(tech.facts.wallMaterial);
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
    }
    if (serviceId === "piso_ceramico" || tech.activeService === "piso_ceramico") {
      parts.push("servico piso ceramico");
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
      if (memory && memory.tileSize) parts.push(memory.tileSize);
      if (memory && memory.jointMm) parts.push("junta " + memory.jointMm + "mm");
      if (memory && memory.mortar) parts.push(memory.mortar);
      if (memory && memory.environment) parts.push(memory.environment);
    }
    if (serviceId === "chapisco" || tech.activeService === "chapisco") {
      parts.push("servico chapisco");
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
      if (memory && memory.environment) parts.push(memory.environment);
    }
    if (serviceId === "reboco" || tech.activeService === "reboco") {
      parts.push("servico reboco");
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
      if (memory && memory.thicknessCm) parts.push("espessura " + memory.thicknessCm + "cm");
      if (memory && memory.environment) parts.push(memory.environment);
    }
    if (serviceId === "contrapiso" || tech.activeService === "contrapiso") {
      parts.push("servico contrapiso");
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
      if (memory && memory.thicknessCm) parts.push("espessura " + memory.thicknessCm + "cm");
    }
    if (serviceId === "pintura" || tech.activeService === "pintura") {
      parts.push("servico pintura");
      if (memory && memory.areaM2) parts.push(memory.areaM2 + "m2");
      if (memory && memory.environment) parts.push(memory.environment);
    }
    if (tech.audit.executedAreaM2) parts.push("rdo executado " + tech.audit.executedAreaM2 + "m2 de " + (tech.audit.executedService || "servico"));
    if (tech.audit.withdrawnQuantity) parts.push("retirada almoxarifado " + tech.audit.withdrawnQuantity + " sacos de " + (tech.audit.withdrawnMaterial || "material"));
    return parts.join("; ");
  }
  function technicalSummary(context) {
    const tech = context.technical;
    const lines = ["RESUMO TECNICO DO CONTEXTO"];
    if (tech.facts.builtAreaM2) lines.push("- Area construida: " + tech.facts.builtAreaM2 + " m2");
    if (tech.facts.wallHeightM) lines.push("- Altura das paredes: " + tech.facts.wallHeightM + " m");
    if (tech.facts.wallMaterial) lines.push("- Parede/material: " + tech.facts.wallMaterial);
    Object.keys(tech.services).forEach(function (id) {
      const memory = tech.services[id];
      const details = [];
      if (memory.areaM2) details.push(memory.areaM2 + " m2");
      if (memory.material) details.push(memory.material);
      if (memory.structure) details.push(memory.structure);
      if (memory.tileSize) details.push(memory.tileSize);
      if (memory.jointMm) details.push("junta " + memory.jointMm + " mm");
      if (memory.mortar) details.push(memory.mortar);
      if (memory.thicknessCm) details.push("espessura " + memory.thicknessCm + " cm");
      if (memory.environment) details.push(memory.environment);
      lines.push("- " + id + ": " + (details.length ? details.join(", ") : "registrado"));
    });
    if (tech.audit.executedAreaM2 || tech.audit.withdrawnQuantity) lines.push("- Auditoria: " + [tech.audit.executedAreaM2 ? tech.audit.executedAreaM2 + " m2 executados" : "", tech.audit.withdrawnQuantity ? tech.audit.withdrawnQuantity + " sacos retirados de " + tech.audit.withdrawnMaterial : ""].filter(Boolean).join("; "));
    lines.push("", "OBSERVACAO", "- Nenhum coeficiente foi inventado; calculos dependem de composicao oficial e parametros completos.");
    return lines.join("\n");
  }
  function callTechnicalBrain(message, context, serviceId) {
    const engine = root.EloTechnicalEngine || null;
    const prefix = buildContextPrefix(context, serviceId);
    const enriched = clean([prefix, message].filter(Boolean).join("; "));
    if (/resumo\s+tecnico|resumo\s+t[eé]cnico/i.test(message)) {
      return {
        shortAnswer: "Resumo tecnico preparado.",
        fullAnswer: technicalSummary(context),
        nextAction: "Revise os dados antes de calcular ou auditar consumo.",
        canSave: false,
        sessionTheme: "elo_technical_brain",
        sessionIntent: "technical_summary",
        technicalEngine: { mode: "technical_summary", facts: context.technical.facts, context: context.technical }
      };
    }
    if (!engine || typeof engine.buildResponse !== "function") {
      return null;
    }
    const response = engine.buildResponse(enriched, { facts: context.technical.facts });
    if (response && response.technicalEngine) response.technicalEngine.routerMessage = enriched;
    if (response && response.fullAnswer) return response;
    const search = root.CompositionSearchEngine || null;
    const searchResult = search && typeof search.searchOfficialCompositions === "function" ? search.searchOfficialCompositions(enriched, { limit: 5 }) : null;
    const lines = ["ANALISE TECNICA", "- Brain tecnico acionado pelo roteador."];
    if (searchResult && searchResult.found) {
      lines.push("", "BUSCA NA BASE OFICIAL", "- Encontrei composicoes relacionadas, mas preciso de parametros para calcular com seguranca.");
      searchResult.candidates.slice(0, 3).forEach(function (candidate) { lines.push("- " + candidate.code + " - " + candidate.description + " (score " + candidate.score + ")"); });
    } else {
      lines.push("", "BUSCA NA BASE OFICIAL", "- Nao encontrei composicao suficiente para calcular automaticamente.");
    }
    lines.push("", "OBSERVACAO", "- Nenhum coeficiente foi inventado.");
    return { shortAnswer: "Analise tecnica registrada.", fullAnswer: lines.join("\n"), nextAction: "Informe o servico, quantitativo ou codigo oficial se quiser calcular.", canSave: false, sessionTheme: "elo_technical_brain", sessionIntent: "technical_router_fallback", technicalEngine: { mode: "technical_router_fallback", compositionSearch: searchResult, routerMessage: enriched } };
  }
  function callConversationalBrain(message, context) {
    return {
      shortAnswer: "Conversa registrada.",
      fullAnswer: "Estou contigo. Quando você trouxer dado de obra, eu viro para o cérebro técnico e preservo o contexto.",
      nextAction: "Pode continuar a conversa ou informar o próximo dado técnico.",
      canSave: false,
      sessionTheme: "elo_conversational_brain",
      sessionIntent: "conversational",
      context: context
    };
  }
  function routeEloBrain(message, context) {
    const ctx = ensureContext(context);
    const text = clean(message);
    const technical = scoreTechnical(text, ctx);
    const conversational = scoreConversational(text);
    const serviceId = detectService(text, ctx);
    const explicitTechnical = technical.score > 0 || !!serviceId;
    const chooseTechnical = explicitTechnical && technical.score >= Math.max(0.25, conversational.score + 0.05);
    if (!chooseTechnical && conversational.score > 0) {
      return { brain: "conversational", reason: conversational.reasons[0] || "mensagem conversacional", confidence: Math.max(0.55, conversational.score), result: callConversationalBrain(text, ctx), context: ctx };
    }
    if (chooseTechnical || explicitTechnical) {
      rememberFacts(text, ctx);
      rememberAudit(text, ctx);
      const activeService = serviceId || ctx.technical.activeService || "";
      if (activeService) rememberServiceData(text, ctx, activeService);
      const result = callTechnicalBrain(text, ctx, activeService);
      return { brain: "technical", reason: technical.reasons[0] || (activeService ? "servico tecnico detectado: " + activeService : "termo tecnico detectado"), confidence: Math.max(0.6, technical.score || 0.55), result: result, context: ctx };
    }
    return { brain: "conversational", reason: "sem indicador tecnico forte", confidence: 0.55, result: callConversationalBrain(text, ctx), context: ctx };
  }

  root.EloBrainRouter = {
    version: VERSION,
    routeEloBrain: routeEloBrain,
    normalize: normalize,
    ensureContext: ensureContext
  };
})(typeof window !== "undefined" ? window : globalThis);


