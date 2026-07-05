(function (root) {
  "use strict";

  const VERSION = "20260624-elo-brain-router-v1";
  const TECHNICAL_TERMS = [
    "sinapi", "orse", "orcamento", "orÃƒÂ§amento", "orcar", "orÃƒÂ§ar", "composicao", "composiÃƒÂ§ÃƒÂ£o", "coeficiente", "estoque", "almoxarifado", "rdo", "auditoria", "retirada", "retirou", "executado", "executou", "material", "materiais", "saco", "sacos", "estrutura",
    "piso", "telha", "telhado", "cobertura", "bloco", "chapisco", "reboco", "emboÃƒÂ§o", "emboco", "contrapiso", "concreto", "sapata", "viga", "pilar", "laje", "pintura", "pintar", "impermeabilizaÃƒÂ§ÃƒÂ£o", "impermeabilizacao", "eletroduto", "pvc", "argamassa", "cimento", "areia", "brita", "parede", "alvenaria", "porcelanato", "ceramico", "cerÃƒÂ¢mico", "casa", "obra", "fundacao", "fundaÃƒÂ§ÃƒÂ£o", "radier", "baldrame"
  ];
  const CONVERSATIONAL_TERMS = [
    "me motive", "motiva", "estou cansado", "to cansado", "tÃƒÂ´ cansado", "voce e o cara", "vocÃƒÂª ÃƒÂ© o cara", "o que acha disso", "vamos organizar", "me ajude a decidir", "desabafo", "minhas ideias", "planejamento pessoal"
  ];
  const SERVICE_HINTS = [
    ["instalacao_porta", /\b(porta|folha\s+de\s+porta|batente|marco|dobradica|fechadura)\b/i],
    ["sapata_isolada", /\b(sapata|sapatas)\b/i],
    ["viga_baldrame", /\b(baldrame|viga\s+baldrame)\b/i],
    ["pilar", /\b(pilar|pilares)\b/i],
    ["parede_alvenaria", /\b(parede|alvenaria|muro|bloco|bloko|baiano|tijolo)\b/i],
    ["piso_ceramico", /\b(piso|porcelanato|ceramica|ceramico|revestimento|argamassa\s+ac|ac\s*2|ac\s*ii|ac\s*iii|junta)\b/i],
    ["contrapiso", /contrapiso|regulariza/i],
    ["telhado", /telha|telhado|cobertura|cumeeira|ripamento|caibro|terÃ§a|terca|fibrocimento|portuguesa|colonial|estrutura\s+de\s+madeira/i],
    ["chapisco", /chapisco|xapisco/i],
    ["reboco", /reboco|rebocu|emboÃ§o|emboco|massa\s+unica/i],
    ["pintura", /pintura|pintar|tinta|selador|massa\s+corrida|dem[aÃ£]o|demaos/i],
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
  function explicitServiceFromText(message) {
    const text = normalize(message);
    for (let index = 0; index < SERVICE_HINTS.length; index += 1) {
      if (SERVICE_HINTS[index][1].test(text)) return SERVICE_HINTS[index][0];
    }
    return "";
  }

  function resetServiceContextIfChanged(context, nextService) {
    if (!context || !context.technical || !nextService) return;
    const previous = context.technical.activeService || "";
    if (previous && previous !== nextService) {
      context.technical.services = {};
      context.technical.audit = {};
      context.technical.lastParametricBudget = null;
      context.technical.contextSwitch = { from: previous, to: nextService, at: new Date().toISOString() };
    }
    context.technical.activeService = nextService;
  }

  function recipeForService(serviceId) {
    if (serviceId === "instalacao_porta") return "instalacao_porta";
    if (serviceId === "sapata_isolada") return "sapata_isolada";
    if (serviceId === "viga_baldrame") return "viga_baldrame";
    if (serviceId === "parede_alvenaria") return "parede_alvenaria";
    if (serviceId === "piso_ceramico") return "piso_ceramico";
    return "";
  }

  function serviceLabel(serviceId) {
    const labels = {
      instalacao_porta: "instalacao de porta",
      sapata_isolada: "sapata isolada",
      viga_baldrame: "viga baldrame",
      pilar: "pilar",
      parede_alvenaria: "parede/alvenaria",
      piso_ceramico: "piso ceramico",
      reboco: "reboco",
      chapisco: "chapisco",
      concreto: "concreto",
      laje: "laje"
    };
    return labels[serviceId] || serviceId || "item";
  }

  function buildUnmappedEngineeringResponse(serviceId) {
    const label = serviceLabel(serviceId);
    const similar = /pilar/.test(serviceId) ? "viga/baldrame estrutural" : (/reboco|chapisco/.test(serviceId) ? "revestimento de parede" : "servico similar");
    return {
      shortAnswer: "Receita em configuracao.",
      fullAnswer: "Estou configurando a receita para " + label + ". Para adiantar, vou assumir padroes de " + similar + ", pode ser?",
      nextAction: "Se aceitar, eu sigo com premissas padrao e lista basica.",
      canSave: false,
      sessionTheme: "elo_engineering_recipe_pending",
      sessionIntent: "engineering_recipe_pending",
      technicalEngine: { mode: "engineering_recipe_pending", serviceId: serviceId }
    };
  }
  function detectService(message, context) {
    const explicit = explicitServiceFromText(message);
    if (explicit) return explicit;
    const text = normalize(message);
    const active = context && context.technical && context.technical.activeService;
    if (active && (/^(e|ÃƒÂ©|eh|tambem|tambÃƒÂ©m|sao|sÃƒÂ£o|quanto|quantos|quantas|isso|interno|externo|estrutura|retirou|executou|junta|ac\s*2|ac\s*ii|ac\s*iii|60x60|\d)/i.test(clean(message)) || /\b(m2|mÃ‚Â²|cm|mm|saco|sacos|fck)\b/i.test(text))) return active;
    return "";
  }
  function hasQuantityUnit(message) {
    return /\d+(?:[,.]\d+)?\s*(m2|mÃ‚Â²|m3|mÃ‚Â³|m\b|cm\b|mm\b|saco|sacos|kg|litro|litros|un|und)/i.test(message || "");
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
  function isBudgetIntent(message, context) {
    const text = normalize(message);
    if (/orcamento|orÃƒÂ§amento|orcar|orÃƒÂ§ar|orcamento preliminar|orÃƒÂ§amento preliminar|orcamento completo|orÃƒÂ§amento completo|orcamento residencial|orÃƒÂ§amento residencial|quanto fica|quanto custa|por etapas/.test(text) && /casa|obra|terrea|tÃƒÂ©rrea|residencial|tudo|preliminar|completo|orcamento|orÃƒÂ§amento/.test(text)) return true;
    if (/casa|residencial|terrea|tÃƒÂ©rrea/.test(text) && /\d+(?:[,.]\d+)?\s*m[Ã‚Â²2]/i.test(message) && /bloco|telha|piso|fundacao|fundaÃƒÂ§ÃƒÂ£o|estrutura|cobertura/.test(text)) return true;
    if (/gerar resumo do orcamento|gerar resumo do orÃƒÂ§amento|resumo do orcamento|resumo do orÃƒÂ§amento|gera orcamento preliminar|gera orÃƒÂ§amento preliminar|gerar orÃƒÂ§amento preliminar|gerar orcamento preliminar/.test(text)) return true;
    if (/quanto fica tudo|quanto fica tudo\?|quanto fica/.test(text) && context && context.technical && (context.technical.activeService || Object.keys(context.technical.services || {}).length)) return true;
    return false;
  }

  function isAcolhimentoIntent(message) {
    return /\b(nao aguento|nÃ£o aguento|frustrado|frustrada|cansado|cansada|perder tempo|perdendo tempo|travado|travou|trava|que saco|zorra|raiva|irritado|irritada)\b/i.test(normalize(message));
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
    let match = raw.match(/casa[^\d]*(\d+(?:[,.]\d+)?)\s*m[Ã‚Â²2]/i) || raw.match(/area\s+construida[^\d]*(\d+(?:[,.]\d+)?)\s*m[Ã‚Â²2]/i);
    if (match) tech.facts.builtAreaM2 = parseNumber(match[1]);
    match = raw.match(/paredes?\s+(?:tem|t[eÃƒÂª]m|possuem|com)?\s*(\d+(?:[,.]\d+)?)\s*m(?:etros?)?\s+de\s+altura/i) || raw.match(/altura[^\d]*(\d+(?:[,.]\d+)?)\s*m\b/i);
    if (match) tech.facts.wallHeightM = parseNumber(match[1]);
    if (/bloco\s+(baiano|ceramico|cerÃƒÂ¢mico)|bloko\s+baiano/i.test(raw)) {
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
    const area = raw.match(/(\d+(?:[,.]\d+)?)\s*m[Ã‚Â²2]/i);
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
    let match = raw.match(/executou\s+(\d+(?:[,.]\d+)?)\s*m[Ã‚Â²2]\s+de\s+parede/i) || raw.match(/rdo\s+informou\s+(\d+(?:[,.]\d+)?)\s*m[Ã‚Â²2]/i);
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
  function formatBcpNumber(value) {
    const numeric = parseNumber(value);
    return numeric.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  }
  function isExecutiveBudgetIntent(message) {
    return /orcamento\s+executivo|orÃƒÂ§amento\s+executivo|executivo\s+oficial|fechar\s+orcamento|fechar\s+orÃƒÂ§amento|auditoria\s+tecnica|auditoria\s+tÃƒÂ©cnica/i.test(normalize(message));
  }
  function isBroadBudgetIntent(message) {
    const text = normalize(message);
    return isBudgetIntent(message, null) || (/orcamento|orÃƒÂ§amento|quanto\s+custa|quanto\s+fica|custo|valor/.test(text) && /casa|obra|residencial|tudo|completo|executivo|preliminar/.test(text));
  }
  function isDirectParametricIntent(message, recipe) {
    const text = normalize(message);
    if (!recipe || recipe === "desconhecido") return false;
    if (isExecutiveBudgetIntent(message)) return false;
    if (isBroadBudgetIntent(message) && /casa|obra|residencial|tudo|completo/.test(text)) return false;
    return /sapata|baldrame|viga|parede|alvenaria|muro|piso|ceramico|ceramica|porta/.test(text);
  }
  function defaultBcpParams(params) {
    const output = Object.assign({}, params || {});
    const assumptions = [];
    function assume(key, value, label) {
      if (!parseNumber(output[key]) && !clean(output[key])) {
        output[key] = value;
        assumptions.push(label);
      }
    }
    if (output.recipe === "sapata_isolada") {
      assume("quantity", 1, "vou considerar 1 sapata isolada");
      assume("heightM", 0.3, "vou considerar altura da sapata de 0,30 m");
      assume("fckMpa", 25, "vou considerar concreto fck 25 MPa");
      assume("steelRateKgM3", 80, "vou considerar taxa de aco de 80 kg/m3");
    }
    if (output.recipe === "viga_baldrame") {
      assume("fckMpa", 25, "vou considerar concreto fck 25 MPa");
      assume("steelRateKgM3", 90, "vou considerar taxa de aco de 90 kg/m3");
    }
    if (output.recipe === "parede_alvenaria") {
      assume("blockType", "bloco ceramico 14x19x29", "vou considerar bloco ceramico 14x19x29");
      assume("faces", 2, "vou considerar chapisco e reboco nas duas faces");
    }
    if (output.recipe === "piso_ceramico") {
      assume("contrapisoThicknessCm", 3, "vou considerar contrapiso de 3 cm");
      assume("tileBoxM2", 2.2, "vou considerar caixas de piso com 2,20 m2");
    }
    if (output.recipe === "instalacao_porta") {
      assume("quantity", 1, "vou considerar 1 porta");
      assume("widthM", 0.8, "vou considerar folha de 0,80 m");
      assume("heightM", 2.1, "vou considerar folha de 2,10 m");
    }
    return { params: output, assumptions: assumptions };
  }
  function formatBcpAnswer(result) {
    const lines = [];
    const assumptions = result && result.assumptions || [];
    if (!result || result.status === "needs_parameters") {
      if (assumptions.length) lines.push("Posso seguir com estas premissas: " + assumptions.join("; ") + ".");
      lines.push("Para fechar o calculo, falta so isto:");
      (result && result.questions || []).forEach(function (question) { lines.push("- " + question); });
      return lines.join("\n");
    }
    lines.push("Calculei como lista de compras parametrica, nao como orcamento executivo oficial.");
    if (assumptions.length) lines.push("Premissas: " + assumptions.join("; ") + ".");
    lines.push("", "Quantitativos:");
    (result.quantities || []).forEach(function (item) { lines.push("- " + item.item + ": " + formatBcpNumber(item.quantity) + " " + item.unit); });
    lines.push("", "Lista de compras:");
    (result.shoppingList || []).forEach(function (item) { lines.push("- " + formatBcpNumber(item.quantity) + " " + item.unit + " - " + item.item); });
    lines.push("", "Quer que eu ajuste alguma premissa ou sigo para custo com precos unitarios?");
    return lines.join("\n");
  }
  function callParametricBrain(message, context) {
    const engine = root.EloParametricCompositionEngine || root.EloBCP || null;
    if (!engine || typeof engine.calculate !== "function" || typeof engine.paramsFromText !== "function") return null;
    const parsed = engine.paramsFromText(message, context && context.bcpOverrides || {});
    if (!isDirectParametricIntent(message, parsed.recipe)) return null;
    const defaults = defaultBcpParams(parsed);
    const result = engine.calculate(defaults.params);
    if (!result || result.recipe === "desconhecido") return null;
    result.assumptions = (defaults.assumptions || []).concat(result.assumptions || []);
    if (context && context.technical) context.technical.lastParametricBudget = result;
    return {
      shortAnswer: result.status === "ready" ? "Lista de compras parametrica calculada." : "Faltam poucos dados para fechar esse calculo.",
      fullAnswer: formatBcpAnswer(result),
      nextAction: result.status === "ready" ? "Ajuste premissas ou envie precos unitarios para estimar custo." : "Responda os dados faltantes ou autorize uma premissa padrao.",
      canSave: result.status === "ready",
      sessionTheme: "elo_bcp_parametric_budget",
      sessionIntent: "parametric_composition",
      technicalEngine: { mode: "parametric_composition", bcp: result, context: context && context.technical || {} }
    };
  }
  function callBudgetBrain(message, context) {
    const budgetEngine = root.EloBudgetEngine || null;
    if (!budgetEngine || typeof budgetEngine.buildPreliminaryBudget !== "function") return null;
    const facts = Object.assign({}, context.technical.facts || {}, { originalMessage: message });
    const budget = budgetEngine.buildPreliminaryBudget(facts, context.technical || {});
    context.technical.facts = Object.assign(context.technical.facts || {}, budget.projectFacts || {});
    if (budget.projectRecord) context.technical.projectRecord = budget.projectRecord;
    const fullAnswer = budgetEngine.buildBudgetReportText(budget);
    return {
      shortAnswer: "OrÃƒÂ§amento preliminar estruturado.",
      fullAnswer: fullAnswer,
      nextAction: budget.missing && budget.missing.length ? "Responda as pendÃƒÂªncias principais para evoluir o orÃƒÂ§amento." : "Revise escopo e composiÃƒÂ§ÃƒÂµes antes de transformar em orÃƒÂ§amento executivo.",
      canSave: true,
      sessionTheme: "elo_preliminary_budget",
      sessionIntent: "preliminary_budget",
      technicalEngine: { mode: "preliminary_budget", budget: budget, context: context.technical }
    };
  }

  function callTechnicalBrain(message, context, serviceId) {
    if (isBudgetIntent(message, context)) {
      const budgetResponse = callBudgetBrain(message, context);
      if (budgetResponse) return budgetResponse;
    }
    const engine = root.EloTechnicalEngine || null;
    const prefix = buildContextPrefix(context, serviceId);
    const enriched = clean([prefix, message].filter(Boolean).join("; "));
    if (/resumo\s+tecnico|resumo\s+t[eÃƒÂ©]cnico/i.test(message)) {
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
    const responseMode = response && response.technicalEngine && response.technicalEngine.mode;
    if (response && response.fullAnswer && !(serviceId && responseMode === "project_facts")) return response;
    const search = root.CompositionSearchEngine || null;
    const searchResult = search && typeof search.searchOfficialCompositions === "function" ? search.searchOfficialCompositions(enriched, { limit: 5 }) : null;
    const lines = ["ANALISE TECNICA", "- Brain tecnico acionado pelo roteador."];
    if (searchResult && searchResult.found) {
      lines.push("", "BUSCA NA BASE OFICIAL", "- Encontrei composicoes relacionadas, mas preciso de parametros para calcular com seguranca.");
      searchResult.candidates.slice(0, 3).forEach(function (candidate) { lines.push("- " + candidate.code + " - " + candidate.description + " (score " + candidate.score + ")"); });
    } else {
      lines.push("", "BUSCA NA BASE OFICIAL", "- Procurei por: " + enriched, "- Nao encontrei composicao suficiente para calcular automaticamente.");
    }
    lines.push("", "OBSERVACAO", "- Nenhum coeficiente foi inventado.");
    return { shortAnswer: "Analise tecnica registrada.", fullAnswer: lines.join("\n"), nextAction: "Informe o servico, quantitativo ou codigo oficial se quiser calcular.", canSave: false, sessionTheme: "elo_technical_brain", sessionIntent: "technical_router_fallback", technicalEngine: { mode: "technical_router_fallback", compositionSearch: searchResult, routerMessage: enriched } };
  }
  function callConversationalBrain(message, context) {
    const text = normalize(message);
    if (/cansado|frustrad|nao aguento|nÃƒÂ£o aguento|perder tempo|travado|irritad|raiva|saco/.test(text)) {
      return {
        shortAnswer: "Entendi a frustracao.",
        fullAnswer: "Entendi a frustracao. Vamos pelo caminho curto: me diga o servico e as medidas, que eu devolvo a lista ou assumo premissas padrao.",
        nextAction: "Envie algo como: parede 20x2,80, piso banheiro 12m2 ou viga baldrame com comprimento e secao.",
        canSave: false,
        sessionTheme: "elo_conversational_brain",
        sessionIntent: "acolhimento_com_solucao",
        context: context
      };
    }
    return {
      shortAnswer: "Estou contigo.",
      fullAnswer: "Estou contigo. Manda o servico ou a duvida e eu respondo direto, sem bloco tecnico desnecessario.",
      nextAction: "Pode mandar o proximo dado tecnico ou continuar a conversa.",
      canSave: false,
      sessionTheme: "elo_conversational_brain",
      sessionIntent: "conversational",
      context: context
    };
  }
  function routeEloBrain(message, context) {
    const ctx = ensureContext(context);
    const text = clean(message);
    if (isAcolhimentoIntent(text) && !isExecutiveBudgetIntent(text)) {
      return { brain: "conversational", reason: "prioridade de acolhimento", confidence: 0.9, result: callConversationalBrain(text, ctx), context: ctx };
    }
    const explicitService = explicitServiceFromText(text);
    if (explicitService) {
      resetServiceContextIfChanged(ctx, explicitService);
      const recipe = recipeForService(explicitService);
      ctx.bcpOverrides = recipe ? Object.assign({}, ctx.bcpOverrides || {}, { recipe: recipe }) : (ctx.bcpOverrides || {});
    }
    const parametricResponse = callParametricBrain(text, ctx);
    if (parametricResponse) {
      ctx.technical.lastMessage = text;
      return { brain: "technical", reason: "intencao de composicao parametrica", confidence: 0.9, result: parametricResponse, context: ctx };
    }
    if (explicitService && !recipeForService(explicitService)) {
      ctx.technical.lastMessage = text;
      return { brain: "technical", reason: "receita parametrica em configuracao: " + explicitService, confidence: 0.88, result: buildUnmappedEngineeringResponse(explicitService), context: ctx };
    }
    if (isBudgetIntent(text, ctx)) {
      ctx.technical.lastMessage = text;
      const result = callBudgetBrain(text, ctx);
      if (result) return { brain: "technical", reason: "intencao de orcamento preliminar", confidence: 0.82, result: result, context: ctx };
    }
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
      ctx.technical.lastMessage = text;
      rememberAudit(text, ctx);
      const activeService = serviceId || ctx.technical.activeService || "";
      if (activeService) resetServiceContextIfChanged(ctx, activeService);
      if (activeService) rememberServiceData(text, ctx, activeService);
      const result = callTechnicalBrain(text, ctx, activeService);
      return { brain: "technical", reason: technical.reasons[0] || (activeService ? "servico tecnico detectado: " + activeService : "termo tecnico detectado"), confidence: Math.max(0.6, technical.score || 0.55), result: result, context: ctx };
    }
    return { brain: "conversational", reason: "sem indicador tecnico forte", confidence: 0.55, result: callConversationalBrain(text, ctx), context: ctx };
  }

  root.EloBrainRouter = {
    version: VERSION,
    routeEloBrain: routeEloBrain,
    detectService: detectService,
    detectService: detectService,
    explicitServiceFromText: explicitServiceFromText,
    normalize: normalize,
    ensureContext: ensureContext
  };
})(typeof window !== "undefined" ? window : globalThis);



