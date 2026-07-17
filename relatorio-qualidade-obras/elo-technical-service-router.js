(function (root) {
  "use strict";

  const VERSION = "20260716-elo-technical-service-router-v1";
  let pendingTechnicalPdfIdentification = null;
  let knowledgeRegistryInstance = null;

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).replace(/m(?:\^?2|²|Â²)/gi, "m2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "0";
    return String(Math.round(number * 1000) / 1000).replace(".", ",");
  }
  function requestPdfIdentification(payload) {
    pendingTechnicalPdfIdentification = payload || {};
    return {
      shortAnswer: "Posso identificar o documento antes de gerar.",
      fullAnswer: "Deseja colocar o nome da sua empresa ou seu nome no documento? Tambem posso adicionar telefone e e-mail.",
      nextAction: "Informe nome, telefone e e-mail, ou diga pular para gerar sem identificacao.",
      canSave: false,
      sessionTheme: "technical_service_pdf",
      sessionIntent: "technical_service_pdf_identification_prompt"
    };
  }
  function parsePdfIdentification(message) {
    const raw = clean(message);
    const normalized = normalize(raw);
    if (/^(pular|gerar sem identificacao|sem identificacao|sem dados|nao)$/i.test(normalized)) {
      return { displayName: "", phone: "", email: "" };
    }
    const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const phoneMatch = raw.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?\d{4,5}[-\s]?\d{4}/);
    let displayName = raw;
    if (emailMatch) displayName = displayName.replace(emailMatch[0], " " );
    if (phoneMatch) displayName = displayName.replace(phoneMatch[0], " " );
    displayName = displayName
      .replace(/\b(nome|empresa|telefone|fone|celular|email|e-mail)\b\s*:?\s*/gi, " " )
      .replace(/[;,]+/g, " " );
    return {
      displayName: clean(displayName),
      phone: phoneMatch ? clean(phoneMatch[0]) : "",
      email: emailMatch ? clean(emailMatch[0]) : ""
    };
  }
  function routePdfIdentification(message) {
    if (!pendingTechnicalPdfIdentification) return null;
    const identification = parsePdfIdentification(message);
    const payload = pendingTechnicalPdfIdentification;
    pendingTechnicalPdfIdentification = null;
    return {
      shortAnswer: "Identificacao recebida.",
      fullAnswer: identification.displayName ? "Vou gerar o PDF com a identificacao informada." : "Vou gerar o PDF sem identificacao.",
      nextAction: "Gerar PDF tecnico.",
      canSave: false,
      sessionTheme: "technical_service_pdf",
      sessionIntent: "technical_service_pdf_identification_ready",
      technicalServicePdfPayload: payload,
      technicalServicePdfIdentification: identification
    };
  }
  function hasPendingPdfIdentification() { return !!pendingTechnicalPdfIdentification; }
  function clearPdfIdentificationForTest() { pendingTechnicalPdfIdentification = null; }
  function hasDimension(text) {
    return /d+(?:[,.]d+)?s*(?:m3|m^3|m?|m??|metros?s+c[u?]bicos?)/i.test(text) ||
      /d+(?:[,.]d+)?s*(?:m2|m^2|m?|m??|metros?s+quadrados?)/i.test(text) ||
      /d+(?:[,.]d+)?s*(?:m|metros?)s+des+comprimento/i.test(text) && /d+(?:[,.]d+)?s*(?:m|metros?)s+des+altura/i.test(text) ||
      /se[c?][a?]os+d+(?:[,.]d+)?s*(?:cm|m|metros?)?s*[xX???]s*d+(?:[,.]d+)?/i.test(text) ||
      /d+(?:[,.]d+)?s*(?:cm|m|metros?)?s*[xX???]s*d+(?:[,.]d+)?s*(?:cm|m|metros?)?s*[xX???]s*d+(?:[,.]d+)?s*(?:cm|m|metros?)?/i.test(text) ||
      /d+(?:[,.]d+)?s*(?:m|metros?)?s*[xX???]s*d+(?:[,.]d+)?s*(?:m|metros?)?/i.test(text);
  }
  function shouldRoute(message) {
    const text = normalize(message);
    if (!text) return false;
    if (/casa|residencia|residencial|sobrado|orcamento residencial|cadista|dxf|planta baixa|ocr|imagem|foto|anexo|pdf|busca web|pesquise|internet|online|noticia|atual/.test(text)) return false;
    const hasService = /parede|alvenaria|bloco|piso|revestimento|ceramico|porcelanato|reboco|rebocar|emboco|chapisco|contrapiso|pintura|pintar|tinta|cobertura|telhado|telha|escav|sapata|vala|concreto|viga|baldrame|pilar|cinta/.test(text);
    const hasStructuralService = /escav|sapata|vala|concreto|viga|baldrame|pilar|cinta|cobertura|telhado|telha/.test(text);
    const hasIntent = /quantitativo|quantidade|material|materiais|consumo|orcamento|orcament|custo|preco|valor|quanto|qual material/.test(text);
    return hasService && (hasIntent || hasStructuralService && hasDimension(message));
  }
  function missingDimensionResponse(message) {
    const text = normalize(message);
    let service = "servico";
    if (/cobertura|telhado|telha/.test(text)) service = "cobertura";
    else if (/escav|sapata|vala|concreto|viga|baldrame|pilar|cinta/.test(text)) service = "servi?o estrutural";
    else if (/parede|alvenaria|bloco/.test(text)) service = "parede/alvenaria";
    else if (/contrapiso/.test(text)) service = "contrapiso";
    else if (/piso|revestimento|ceramico|porcelanato/.test(text)) service = "piso/revestimento";
    else if (/pintura|pintar|tinta/.test(text)) service = "pintura";
    else if (/chapisco/.test(text)) service = "chapisco";
    else if (/reboco|rebocar|emboco/.test(text)) service = "reboco";
    return {
      shortAnswer: "Preciso da dimensão do " + service + ".",
      fullAnswer: "Para calcular o quantitativo, informe a área em m2 ou as dimensões. Ex.: parede 30 m x 2,80 m, piso 40 m2 ou reboco 100 m2.",
      nextAction: "Informe área em m2 ou comprimento e altura.",
      canSave: false,
      sessionTheme: "technical_service_bridge",
      sessionIntent: "technical_service_missing_dimension"
    };
  }
  function lineItems(title, items) {
    const lines = [];
    if (!items || !items.length) return lines;
    lines.push("", title + ":");
    items.forEach(function (item) {
      lines.push("- " + item.name + ": " + formatNumber(item.quantity) + " " + item.unit);
    });
    return lines;
  }
  function formatBridgeResult(result) {
    const composition = result.composition || {};
    const lines = [
      "Quantitativo calculado por composição técnica.",
      "",
      "Serviço: " + (result.service || "não identificado"),
      "Quantidade: " + formatNumber(result.quantity) + " " + (result.unit || ""),
      "Composição utilizada: " + [composition.code, composition.description].filter(Boolean).join(" - "),
      "Fonte: " + (composition.source || "não informada")
    ];
    if (result.calculationMemory && result.calculationMemory.length) {
      lines.push("", "Memoria de calculo:");
      result.calculationMemory.forEach(function (item) { lines.push("- " + item); });
    }
    if (result.relatedCompositions && result.relatedCompositions.length > 1) {
      lines.push("", "Composi??es complementares:");
      result.relatedCompositions.slice(1).forEach(function (item) { lines.push("- " + [item.code, item.description].filter(Boolean).join(" - ")); });
    }
    if (result.pending && result.pending.length) {
      lines.push("", "Pendencias:");
      result.pending.forEach(function (item) { lines.push("- " + item); });
    }
    lines.push.apply(lines, lineItems("Materiais", result.materials));
    lines.push.apply(lines, lineItems("Mão de obra", result.labor));
    lines.push.apply(lines, lineItems("Equipamentos", result.equipment));
    lines.push("");
    if ((result.assumptions || []).some(function (item) { return /aco estrutural nao incluido|a.o estrutural n.o inclu.do/i.test(String(item || "")); })) {
      lines.push("", "A?o estrutural n?o inclu?do neste quantitativo.");
    }
    if (result.pricingStatus === "priced") {
      lines.push("Preço:");
      lines.push("- Custo unitário: R$ " + formatNumber(result.unitCost) + "/" + result.unit);
      lines.push("- Custo total: R$ " + formatNumber(result.totalCost));
    } else {
      lines.push("Quantitativo calculado. A base encontrada não possui preço confiável, portanto não fechei o orçamento.");
    }
    return {
      shortAnswer: "Quantitativo calculado.",
      fullAnswer: lines.join("\n"),
      nextAction: result.pricingStatus === "priced" ? "Revise BDI, perdas e escopo antes de fechar." : "Para orçamento, carregue base com preços confiáveis.",
      canSave: true,
      sessionTheme: "technical_service_bridge",
      sessionIntent: "technical_service_bridge_quantity",
      technicalServiceBridge: result
    };
  }
  function getKnowledgeRegistry() {
    if (knowledgeRegistryInstance) return knowledgeRegistryInstance;
    const registry = root.EloKnowledgeRegistry;
    if (!registry || typeof registry.createSync !== "function") return null;
    try {
      knowledgeRegistryInstance = registry.createSync({ surface: "relatorio-qualidade-obras" });
    } catch (error) {
      knowledgeRegistryInstance = null;
    }
    return knowledgeRegistryInstance;
  }
  function routeKnowledge(message) {
    const registry = getKnowledgeRegistry();
    if (!registry || typeof registry.handleCommandSync !== "function") return null;
    try {
      return registry.handleCommandSync(message);
    } catch (error) {
      return null;
    }
  }
  function route(message) {
    const knowledgeResponse = routeKnowledge(message);
    if (knowledgeResponse) return knowledgeResponse;
    const pdfIdentificationResponse = routePdfIdentification(message);
    if (pdfIdentificationResponse) return pdfIdentificationResponse;
    if (!shouldRoute(message)) return null;
    if (!hasDimension(message)) return missingDimensionResponse(message);
    const bridge = root.EloTechnicalServiceBridge;
    if (!bridge || typeof bridge.build !== "function") return null;
    const result = bridge.build({ text: message });
    if (!result || !result.composition || /^blocked_(search|consumption|composition)/.test(result.pricingStatus || "")) return null;
    return formatBridgeResult(result);
  }
  function install() {
    const assistant = root.EloAssistente;
    if (!assistant || assistant.__technicalServiceRouterInstalled) return false;
    const originals = assistant.__technicalServiceRouterOriginals || {
      ask: assistant.ask,
      buildResponse: assistant.buildResponse,
      buildResponseForTest: assistant.buildResponseForTest
    };
    assistant.__technicalServiceRouterOriginals = originals;
    function wrapResponse(original) {
      if (typeof original !== "function") return original;
      return function wrappedTechnicalServiceResponse(message) {
        const response = route(message);
        if (response) return response;
        return original.apply(this, arguments);
      };
    }
    assistant.buildResponse = wrapResponse(originals.buildResponse);
    assistant.buildResponseForTest = wrapResponse(originals.buildResponseForTest);
    if (typeof originals.ask === "function") {
      assistant.ask = function wrappedTechnicalServiceAsk(message) {
        const response = route(message);
        if (!response) return originals.ask.apply(this, arguments);
        const originalBuild = assistant.buildResponse;
        const originalBuildForTest = assistant.buildResponseForTest;
        assistant.buildResponse = function () { return response; };
        assistant.buildResponseForTest = function () { return response; };
        try {
          return originals.ask.apply(this, arguments);
        } finally {
          assistant.buildResponse = originalBuild;
          assistant.buildResponseForTest = originalBuildForTest;
        }
      };
    }
    assistant.__technicalServiceRouterInstalled = true;
    return true;
  }

  root.EloTechnicalServiceRouter = {
    version: VERSION,
    route: route,
    install: install,
    requestPdfIdentification: requestPdfIdentification,
    hasPendingPdfIdentification: hasPendingPdfIdentification,
    clearPdfIdentificationForTest: clearPdfIdentificationForTest
  };
  install();
})(typeof window !== "undefined" ? window : globalThis);
