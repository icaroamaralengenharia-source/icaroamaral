(function (root) {
  "use strict";

  const VERSION = "20260624-technical-engine-v1";

  const CATALOG = {
    piso_ceramico: {
      label: "Piso ceramico",
      aliases: ["piso ceramico", "porcelanato", "assentar piso", "assentamento de piso"],
      unit: "m2",
      required: ["area", "dimensao_peca", "junta", "tipo_argamassa"],
      questions: {
        area: "Qual a area do piso em m2?",
        dimensao_peca: "Qual a dimensao da peca?",
        junta: "Qual a largura da junta?",
        tipo_argamassa: "Qual tipo de argamassa sera usado?"
      }
    },
    chapisco: {
      label: "Chapisco",
      aliases: ["chapisco", "chapiscado"],
      unit: "m2",
      required: ["area", "ambiente"],
      questions: {
        area: "Qual a area do chapisco em m2?",
        ambiente: "O chapisco sera interno ou externo?"
      }
    },
    reboco: {
      label: "Reboco / emboco",
      aliases: ["reboco", "emboco", "emboço", "massa unica", "massa grossa", "massa fina"],
      unit: "m2",
      required: ["area", "espessura", "ambiente"],
      questions: {
        area: "Qual a area do reboco em m2?",
        espessura: "Qual a espessura media do reboco?",
        ambiente: "O reboco sera interno ou externo?"
      }
    },
    contrapiso: {
      label: "Contrapiso",
      aliases: ["contrapiso", "regularizacao de piso"],
      unit: "m2",
      required: ["area", "espessura"],
      questions: {
        area: "Qual a area do contrapiso em m2?",
        espessura: "Qual a espessura do contrapiso?"
      }
    },
    pintura: {
      label: "Pintura",
      aliases: ["pintura", "pintar", "tinta"],
      unit: "m2",
      required: ["area", "tipo_tinta", "demaos", "selador", "massa_corrida"],
      questions: {
        area: "Qual a area de pintura em m2?",
        tipo_tinta: "Qual o tipo da tinta?",
        demaos: "Quantas demaos serao aplicadas?",
        selador: "Vai usar selador?",
        massa_corrida: "Vai usar massa corrida?"
      }
    },
    alvenaria: {
      label: "Alvenaria",
      aliases: ["alvenaria", "parede", "bloco ceramico", "bloco baiano", "tijolo"],
      unit: "m2",
      required: ["area", "tipo_bloco", "espessura"],
      questions: {
        area: "Qual a area de alvenaria em m2?",
        tipo_bloco: "Qual o tipo do bloco?",
        espessura: "Qual a espessura da parede/bloco?"
      }
    },
    laje: {
      label: "Laje",
      aliases: ["laje", "concretar laje"],
      unit: "m2",
      required: ["area", "espessura", "fck"],
      questions: {
        area: "Qual a area da laje em m2?",
        espessura: "Qual a espessura da laje?",
        fck: "Qual o FCK do concreto?"
      }
    },
    concreto: {
      label: "Concreto",
      aliases: ["concreto", "concretagem", "concretar"],
      unit: "m3",
      required: ["volume", "fck", "tipo_lancamento"],
      questions: {
        volume: "Qual o volume de concreto em m3?",
        fck: "Qual o FCK do concreto?",
        tipo_lancamento: "O concreto sera bombeado ou convencional?"
      }
    },
    muro: {
      label: "Muro",
      aliases: ["muro", "construir muro"],
      unit: "m2",
      required: ["comprimento", "altura", "tipo_bloco"],
      questions: {
        comprimento: "Qual o comprimento do muro?",
        altura: "Qual a altura do muro?",
        tipo_bloco: "Qual o tipo do bloco?"
      }
    },
    fundacao: {
      label: "Fundacao",
      aliases: ["fundacao", "fundação", "sapata", "baldrame", "estaca", "radier"],
      unit: "m3",
      required: ["tipo_fundacao"],
      questions: {
        tipo_fundacao: "Qual o tipo de fundacao?"
      }
    }
  };

  const ORDER = ["piso_ceramico", "chapisco", "reboco", "contrapiso", "pintura", "alvenaria", "laje", "concreto", "muro", "fundacao"];

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function parseNumber(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value, digits) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: digits === undefined ? 2 : digits,
      maximumFractionDigits: digits === undefined ? 2 : digits
    });
  }

  function unit(value) {
    const text = normalize(value);
    if (/^(m2|m²|metro quadrado|metros quadrados)$/.test(text)) return "m2";
    if (/^(m3|m³|metro cubico|metros cubicos)$/.test(text)) return "m3";
    if (/^(m|metro|metros)$/.test(text)) return "m";
    if (/^(kg|quilo|quilos)$/.test(text)) return "kg";
    if (/^(l|litro|litros)$/.test(text)) return "l";
    if (/^(un|und|unidade|unidades)$/.test(text)) return "un";
    return text || "";
  }

  function extractQuantity(message) {
    const match = clean(message).match(/(\d+(?:[,.]\d+)?)\s*(m2|m²|m3|m³|kg|quilo|quilos|litros?|l\b|un\b|und\b|unidade|unidades|m\b|metros?\b)/i);
    return match ? { value: parseNumber(match[1]), unit: unit(match[2]) } : { value: 0, unit: "" };
  }

  function extractProjectFacts(message, previousFacts) {
    const facts = Object.assign({}, previousFacts || {});
    const original = clean(message);
    const text = normalize(original);
    const area = original.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m²|metros quadrados?)\s*(?:de\s*)?(?:area construida|área construída|area|casa|construcao)?/i);
    if (area && /area construida|área construída|area|casa|construcao|or[cç]amento/i.test(original)) facts.areaConstruidaM2 = parseNumber(area[1]);
    const height = original.match(/(?:paredes?.*?|pe\s*direito.*?|altura.*?)(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*(?:de\s*)?(?:altura)?/i) ||
      original.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s*de\s*altura/i);
    if (height) facts.alturaParedeM = parseNumber(height[1]);
    if (/terrea|terrea/.test(text)) facts.tipoObra = "casa terrea";
    if (/bloco.*baiano|baiano/.test(text)) facts.tipoBloco = "bloco ceramico baiano";
    else if (/bloco.*ceramico|ceramico/.test(text)) facts.tipoBloco = "bloco ceramico de vedacao";
    return facts;
  }

  function normalizeService(message) {
    const text = normalize(message);
    if (/\blaje\b/.test(text)) return { id: "laje", rule: CATALOG.laje, score: 1000 };
    if (/\bmuro\b/.test(text)) return { id: "muro", rule: CATALOG.muro, score: 1000 };
    let best = null;
    ORDER.forEach(function (id) {
      const rule = CATALOG[id];
      const score = rule.aliases.reduce(function (total, alias) {
        return total + (text.indexOf(normalize(alias)) >= 0 ? normalize(alias).length : 0);
      }, 0);
      if (score > 0 && (!best || score > best.score)) best = { id: id, rule: rule, score: score };
    });
    return best;
  }

  function extractParameters(message, service, facts) {
    const text = normalize(message);
    const params = {};
    const quantity = extractQuantity(message);
    if (quantity.value > 0 && quantity.unit === "m2") params.area = quantity.value;
    if (quantity.value > 0 && quantity.unit === "m3") params.volume = quantity.value;
    if (quantity.value > 0 && quantity.unit === "m") params.comprimento = quantity.value;
    const thickness = clean(message).match(/(?:espessura|camada)\D{0,20}(\d+(?:[,.]\d+)?)\s*(cm|mm|m)\b/i) ||
      clean(message).match(/(\d+(?:[,.]\d+)?)\s*(cm|mm)\s*(?:de\s*)?(?:reboco|contrapiso|laje|espessura)/i);
    if (thickness) params.espessura = thickness[1].replace(".", ",") + " " + thickness[2];
    const fck = clean(message).match(/fck\s*(\d{2})|(\d{2})\s*mpa/i);
    if (fck) params.fck = (fck[1] || fck[2]) + " MPa";
    if (/interno|interna/.test(text)) params.ambiente = "interno";
    if (/externo|externa|fachada/.test(text)) params.ambiente = "externo";
    if (/acrilica|latex|pva|esmalte/.test(text)) params.tipo_tinta = "informado";
    const coats = text.match(/(\d+)\s*demaos/);
    if (coats) params.demaos = coats[1];
    if (/selador/.test(text)) params.selador = "sim";
    if (/sem selador/.test(text)) params.selador = "nao";
    if (/massa corrida/.test(text)) params.massa_corrida = "sim";
    if (/sem massa/.test(text)) params.massa_corrida = "nao";
    const piece = clean(message).match(/\b(\d{1,3}\s*x\s*\d{1,3}(?:\s*x\s*\d{1,3})?)\s*(?:cm)?\b/i);
    if (piece && service && service.id === "piso_ceramico") params.dimensao_peca = piece[1].replace(/\s*x\s*/g, "x");
    const joint = clean(message).match(/junta\D{0,16}(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b/i);
    if (joint) params.junta = joint[1] + " " + joint[2];
    if (/argamassa/.test(text)) params.tipo_argamassa = "informado";
    if (facts && facts.tipoBloco) params.tipo_bloco = facts.tipoBloco;
    if (/bloco/.test(text) || /baiano/.test(text)) params.tipo_bloco = facts && facts.tipoBloco || "bloco informado";
    if (/bombeado/.test(text)) params.tipo_lancamento = "bombeado";
    if (/convencional|manual/.test(text)) params.tipo_lancamento = "convencional";
    if (/sapata|baldrame|estaca|radier/.test(text)) params.tipo_fundacao = text.match(/sapata|baldrame|estaca|radier/)[0];
    if (facts && facts.alturaParedeM) params.altura = facts.alturaParedeM;
    return params;
  }

  function discoverMissingParameters(serviceId, params) {
    const rule = CATALOG[serviceId];
    return rule ? rule.required.filter(function (param) {
      return params[param] === undefined || params[param] === null || params[param] === "";
    }) : [];
  }

  function inputsOf(composition) {
    return composition && (composition.inputs || composition.materials || []) || [];
  }

  function isOfficial(engine, composition) {
    if (!composition) return false;
    if (engine && typeof engine.isRealComposition === "function" && engine.isRealComposition(composition)) return true;
    const source = normalize(composition.source || composition.sourceName || "");
    const metadata = composition.metadata || {};
    return composition.isRealComposition === true || composition.isOfficial === true || metadata.isRealComposition === true || /sinapi|orse/.test(source);
  }

  function resolveComposition(service, quantityUnit) {
    const engine = root.StockAiCompositionEngine || null;
    if (!engine || !service) return { status: "engine_unavailable", composition: null, candidates: [] };
    let candidates = [];
    if (typeof engine.searchImportedOfficialCompositions === "function") {
      candidates = candidates.concat(engine.searchImportedOfficialCompositions(service.rule.label, { limit: 8, controlledService: service.id }) || []);
    }
    if (typeof engine.findComposition === "function") {
      const found = engine.findComposition({ service: service.rule.label, serviceType: service.id, unit: quantityUnit || service.rule.unit, controlledServiceId: service.id });
      if (found) candidates.push(found);
    }
    candidates = candidates.filter(function (item, index) {
      return item && candidates.findIndex(function (candidate) {
        return clean(candidate.code || candidate.id || candidate.name) === clean(item.code || item.id || item.name);
      }) === index;
    }).filter(function (item) {
      return isOfficial(engine, item) && inputsOf(item).length > 0;
    });
    if (candidates.length === 1) return { status: "unique", composition: candidates[0], candidates: candidates };
    if (candidates.length > 1) return { status: "multiple", composition: null, candidates: candidates };
    return { status: "not_found", composition: null, candidates: [] };
  }

  function calculateConsumption(composition, quantity) {
    return inputsOf(composition).map(function (input) {
      const coefficient = parseNumber(input.coefficient || input.quantityPerUnit || input.consumption);
      return {
        code: clean(input.code),
        name: clean(input.name || input.material || input.description || "Insumo sem nome"),
        unit: unit(input.unit || "un") || clean(input.unit || "un"),
        coefficient: coefficient,
        quantity: coefficient * parseNumber(quantity)
      };
    }).filter(function (item) {
      return item.coefficient > 0 && item.quantity > 0;
    });
  }

  function convertUnits(items) {
    return (items || []).slice();
  }

  function factsAnswer(facts) {
    const lines = ["FATOS TECNICOS REGISTRADOS"];
    if (facts.areaConstruidaM2) lines.push("- Area construida: " + formatNumber(facts.areaConstruidaM2) + " m2");
    if (facts.alturaParedeM) lines.push("- Altura/pe-direito informado: " + formatNumber(facts.alturaParedeM) + " m");
    if (facts.tipoBloco) lines.push("- Tipo de bloco: " + facts.tipoBloco);
    if (facts.tipoObra) lines.push("- Tipo de obra: " + facts.tipoObra);
    lines.push("", "PROXIMO PASSO TECNICO", "- Informe o servico e o quantitativo executado/previsto.");
    lines.push("", "OBSERVACAO", "- Nao confundi altura com area: altura fica em metros; area fica em m2.");
    return lines.join("\n");
  }

  function technicalAnswer(analysis) {
    const lines = ["SERVICO IDENTIFICADO", "- " + analysis.service.rule.label, "- Modo: motor tecnico de consumo/auditoria", ""];
    if (analysis.quantity.value > 0) lines.push("QUANTIDADE DO SERVICO", "- " + formatNumber(analysis.quantity.value) + " " + (analysis.quantity.unit || analysis.service.rule.unit), "");
    if (analysis.missing.length) {
      lines.push("PARAMETROS FALTANTES");
      analysis.missing.forEach(function (param) {
        lines.push("- " + (analysis.service.rule.questions[param] || ("Informe " + param + ".")));
      });
      lines.push("", "OBSERVACOES", "- Nao calculei consumo porque ainda faltam parametros tecnicos obrigatorios.", "- Nenhum coeficiente foi inventado.");
      return lines.join("\n");
    }
    if (analysis.compositionResolution.status === "multiple") {
      lines.push("COMPOSICOES ENCONTRADAS");
      analysis.compositionResolution.candidates.slice(0, 5).forEach(function (candidate) {
        lines.push("- " + clean(candidate.code || candidate.id || "sem codigo") + " - " + clean(candidate.name || candidate.description || candidate.service));
      });
      lines.push("", "PROXIMO PARAMETRO NECESSARIO", "- Informe o codigo da composicao correta.");
      return lines.join("\n");
    }
    if (!analysis.compositionResolution.composition) {
      lines.push("COMPOSICAO UTILIZADA", "- Base tecnica oficial nao localizada para os dados informados.", "", "PENDENCIAS", "- Importe/baseie uma composicao SINAPI/ORSE ou informe o codigo oficial correspondente.", "- Nenhum consumo, mao de obra ou equipamento foi inventado.");
      return lines.join("\n");
    }
    const composition = analysis.compositionResolution.composition;
    lines.push("COMPOSICAO UTILIZADA", "- " + clean(composition.code || composition.id || "sem codigo") + " - " + clean(composition.name || composition.description || composition.service), "- Fonte: " + clean(composition.source || composition.sourceName || "SINAPI/ORSE/importacao oficial"), "", "COEFICIENTES E CONSUMO PREVISTO");
    analysis.consumption.forEach(function (item) {
      lines.push("- " + (item.code ? item.code + " - " : "") + item.name + ": coef. " + formatNumber(item.coefficient, 4) + " " + item.unit + "/" + (composition.unit || composition.productionUnit || analysis.service.rule.unit) + " => " + formatNumber(item.quantity, 3) + " " + item.unit);
    });
    lines.push("", "PRONTO PARA AUDITORIA", "- Compare este consumo previsto com retirada do almoxarifado e producao registrada no RDO.", "- Nenhum coeficiente foi inventado.");
    return lines.join("\n");
  }


  function analyzeMultipleServices(message, facts) {
    const text = normalize(message);
    const ids = [];
    if (/\bchapisco\b/.test(text)) ids.push("chapisco");
    if (/\b(reboco|emboco|emboco|massa unica)\b/.test(text)) ids.push("reboco");
    if (ids.length < 2) return null;
    const quantity = extractQuantity(message);
    const lines = ["SERVICOS IDENTIFICADOS", "- Modo: motor tecnico de consumo/auditoria"];
    ids.forEach(function (id) { lines.push("- " + CATALOG[id].label); });
    if (quantity.value > 0) lines.push("", "QUANTIDADE INFORMADA", "- " + formatNumber(quantity.value) + " " + (quantity.unit || "m2") + " para conferencia dos servicos citados");
    lines.push("", "PARAMETROS FALTANTES");
    const details = ids.map(function (id) {
      const params = extractParameters(message, { id: id, rule: CATALOG[id] }, facts || {});
      if (quantity.value > 0 && quantity.unit === "m2") params.area = quantity.value;
      const missing = discoverMissingParameters(id, params);
      missing.forEach(function (param) { lines.push("- " + CATALOG[id].label + ": " + CATALOG[id].questions[param]); });
      return { id: id, missing: missing };
    });
    lines.push("", "OBSERVACOES", "- Nao calculei consumo porque ainda faltam parametros tecnicos obrigatorios.", "- Nenhum coeficiente foi inventado.", "- Depois dos parametros, o motor tenta localizar composicao SINAPI/ORSE oficial para cada servico.");
    return {
      detected: true,
      mode: "technical_consumption",
      service: { id: "multiple", rule: { label: "Servicos combinados" } },
      facts: facts || {},
      quantity: quantity,
      missing: details.reduce(function (all, item) { return all.concat(item.missing.map(function (param) { return item.id + ":" + param; })); }, []),
      services: details,
      answer: lines.join("\n")
    };
  }

  function analyze(message, options) {
    const settings = options || {};
    const facts = extractProjectFacts(message, settings.facts || {});
    const multiService = analyzeMultipleServices(message, facts);
    if (multiService) return multiService;
    const service = normalizeService(message);
    const text = normalize(message);
    if (service && service.id === "alvenaria" && /area construida|orcamento|casa/.test(text) && !/\b(executar|executou|fazer|construir|assentar|levantar|pediu)\b/.test(text)) {
      return { detected: true, mode: "project_facts", facts: facts, answer: factsAnswer(facts) };
    }
    if (!service) {
      const hasFacts = Object.keys(facts).some(function (key) { return facts[key] !== undefined && facts[key] !== ""; });
      return { detected: hasFacts, mode: hasFacts ? "project_facts" : "not_technical", facts: facts, answer: hasFacts ? factsAnswer(facts) : "" };
    }
    const params = extractParameters(message, service, facts);
    const quantity = extractQuantity(message);
    if (!quantity.value && params.area) {
      quantity.value = params.area;
      quantity.unit = "m2";
    }
    if (!quantity.value && params.volume) {
      quantity.value = params.volume;
      quantity.unit = "m3";
    }
    const missing = discoverMissingParameters(service.id, params);
    const compositionResolution = missing.length ? { status: "not_checked", composition: null, candidates: [] } : resolveComposition(service, quantity.unit || service.rule.unit);
    const consumption = compositionResolution.composition && quantity.value > 0 ? calculateConsumption(compositionResolution.composition, quantity.value) : [];
    const analysis = { detected: true, mode: "technical_consumption", service: service, facts: facts, params: params, quantity: quantity, missing: missing, compositionResolution: compositionResolution, consumption: consumption };
    analysis.answer = technicalAnswer(analysis);
    return analysis;
  }

  function buildResponse(message, options) {
    const result = analyze(message, options || {});
    if (!result.detected) return null;
    return {
      shortAnswer: result.mode === "project_facts" ? "Fatos tecnicos registrados." : "Analise tecnica preparada.",
      fullAnswer: result.answer,
      nextAction: result.missing && result.missing.length ? "Responda apenas os parametros faltantes." : "Revise a composicao e use o resultado para auditoria.",
      canSave: false,
      sessionTheme: "elo_technical_engine",
      sessionIntent: result.mode,
      technicalEngine: result
    };
  }

  root.EloTechnicalEngine = {
    version: VERSION,
    parameterCatalog: CATALOG,
    analyze: analyze,
    buildResponse: buildResponse,
    extractProjectFacts: extractProjectFacts,
    parseTechnicalIntent: analyze,
    normalizeService: normalizeService,
    discoverMissingParameters: discoverMissingParameters,
    resolveComposition: resolveComposition,
    calculateConsumption: calculateConsumption,
    convertUnits: convertUnits
  };
})(typeof window !== "undefined" ? window : globalThis);
