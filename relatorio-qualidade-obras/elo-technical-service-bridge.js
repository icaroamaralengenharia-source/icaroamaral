(function (root) {
  "use strict";

  const VERSION = "20260716-elo-technical-service-bridge-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).replace(/m[?3]/gi, "m3").replace(/m[?2]/gi, "m2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function number(value) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function round(value) { return Math.round(number(value) * 1000) / 1000; }
  function toMeters(value, unitText) {
    const parsed = number(value);
    return /cm|centimetro/.test(normalize(unitText)) ? parsed / 100 : parsed;
  }
  function dimensionLabel(value) { return String(round(value)).replace(".", ",") + " m"; }
  function unit(value) {
    const text = normalize(value);
    if (/^(m2|metro quadrado|metros quadrados)$/.test(text)) return "m2";
    if (/^(m3|metro cubico|metros cubicos)$/.test(text)) return "m3";
    if (/^(m|metro|metros)$/.test(text)) return "m";
    if (/^(un|und|unidade|unidades)$/.test(text)) return "un";
    return text;
  }

  function extractDimensionsFromText(text) {
    const raw = clean(text);
    const normalized = normalize(raw);
    const directVolume = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m3|m\^3|metros?\s+cubicos?)/i);
    if (directVolume) {
      const volume = round(directVolume[1]);
      return { quantity: volume, unit: "m3", dimensions: { volume: volume }, calculationMemory: ["Volume informado diretamente: " + String(volume).replace(".", ",") + " m3"] };
    }
    const elementCount = normalized.match(/(\d+)\s*(?:sapatas?|pilares?|elementos?)/);
    const count = elementCount ? number(elementCount[1]) : 1;
    const section = normalized.match(/secao\s+(\d+(?:[,.]\d+)?)\s*(cm|m|metros?)?\s*[xX\u00d7]\s*(\d+(?:[,.]\d+)?)\s*(cm|m|metros?)?/i);
    if (section && /viga|baldrame|cinta/.test(normalized)) {
      const lengthMatch = raw.match(/(?:com\s+)?(\d+(?:[,.]\d+)?)\s*(m|metros?)\b/i);
      if (lengthMatch) {
        const length = toMeters(lengthMatch[1], lengthMatch[2]);
        const width = toMeters(section[1], section[2] || section[4] || "m");
        const height = toMeters(section[3], section[4] || section[2] || "m");
        const volume = round(length * width * height);
        return { quantity: volume, unit: "m3", dimensions: { length: length, width: width, height: height }, calculationMemory: ["Volume = " + dimensionLabel(length) + " x " + dimensionLabel(width) + " x " + dimensionLabel(height) + " = " + String(volume).replace(".", ",") + " m3"] };
      }
    }
    if (section && /pilar/.test(normalized)) {
      const heightMatch = raw.match(/(?:altura|alto|com)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)\s*(m|metros?|cm|centimetros?)\b|(\d+(?:[,.]\d+)?)\s*(m|metros?|cm|centimetros?)\s+de\s+altura/i);
      if (heightMatch) {
        const width = toMeters(section[1], section[2] || section[4] || "m");
        const depth = toMeters(section[3], section[4] || section[2] || "m");
        const height = toMeters(heightMatch[1] || heightMatch[3], heightMatch[2] || heightMatch[4]);
        const volume = round(count * width * depth * height);
        return { quantity: volume, unit: "m3", dimensions: { count: count, width: width, depth: depth, height: height }, calculationMemory: ["Volume = " + count + " x " + dimensionLabel(width) + " x " + dimensionLabel(depth) + " x " + dimensionLabel(height) + " = " + String(volume).replace(".", ",") + " m3"] };
      }
    }
    const triple = raw.match(/(\d+(?:[,.]\d+)?)\s*(cm|m|metros?)?\s*[xX\u00d7]\s*(\d+(?:[,.]\d+)?)\s*(cm|m|metros?)?\s*[xX\u00d7]\s*(\d+(?:[,.]\d+)?)\s*(cm|m|metros?)?/i);
    if (triple) {
      const fallbackUnit = triple[6] || triple[4] || triple[2] || "m";
      const l = toMeters(triple[1], triple[2] || fallbackUnit);
      const w = toMeters(triple[3], triple[4] || fallbackUnit);
      const h = toMeters(triple[5], triple[6] || fallbackUnit);
      const volume = round(count * l * w * h);
      return { quantity: volume, unit: "m3", dimensions: { count: count, length: l, width: w, height: h }, calculationMemory: ["Volume = " + count + " x " + dimensionLabel(l) + " x " + dimensionLabel(w) + " x " + dimensionLabel(h) + " = " + String(volume).replace(".", ",") + " m3"] };
    }
    const directArea = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|metros?\s+quadrados?)/i);
    if (directArea) return { quantity: round(directArea[1]), unit: "m2", dimensions: { area: round(directArea[1]) } };
    const length = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+de\s+comprimento/);
    const width = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+de\s+largura/);
    if (length && width) {
      const l = number(length[1]);
      const w = number(width[1]);
      return { quantity: round(l * w), unit: "m2", dimensions: { length: l, width: w } };
    }
    const height = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+de\s+altura/);
    if (length && height) {
      const l = number(length[1]);
      const h = number(height[1]);
      return { quantity: round(l * h), unit: "m2", dimensions: { length: l, height: h } };
    }
    const multiplication = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*[xX\u00d7]\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/);
    if (multiplication) {
      const a = number(multiplication[1]);
      const b = number(multiplication[2]);
      return { quantity: round(a * b), unit: "m2", dimensions: { length: a, height: b } };
    }
    return { quantity: 0, unit: "", dimensions: {}, calculationMemory: [] };
  }

  function inferServiceFromText(text) {
    const normalized = normalize(text);
    if (/escav/.test(normalized) && /sapata/.test(normalized)) return "escavacao manual para sapata";
    if (/escav/.test(normalized) && /vala/.test(normalized)) return "escavacao manual de vala";
    if (/concreto/.test(normalized) && /sapata/.test(normalized)) return "concreto para fundacao sapata";
    if (/concreto/.test(normalized) && /baldrame/.test(normalized)) return "concreto para viga baldrame";
    if (/concreto/.test(normalized) && /pilar/.test(normalized)) return "concreto para pilar";
    if (/concreto/.test(normalized) && /viga/.test(normalized)) return "concreto para viga";
    if (/cinta/.test(normalized)) return "concreto para cinta de amarracao";
    if (/viga baldrame|baldrame/.test(normalized)) return "concreto para viga baldrame";
    if (/contrapiso/.test(normalized)) return "contrapiso piso cimentado regularizacao";
    if (/chapisco/.test(normalized)) return "chapisco aplicado em alvenaria";
    if (/pintura|pintar|tinta/.test(normalized)) return "pintura latex acrilica em paredes";
    if (/revestimento ceramico|azulejo/.test(normalized) && /parede|intern/.test(normalized)) return "revestimento ceramico parede interna";
    if (/piso ceramico|piso|porcelanato|revestimento ceramico/.test(normalized)) return "revestimento ceramico para piso";
    if (/reboco|rebocar|emboco|massa unica/.test(normalized)) return "reboco emboco massa unica em parede";
    if (/parede|alvenaria|bloco/.test(normalized)) return "alvenaria de bloco ceramico";
    if (/cobertura|telhado|telha/.test(normalized)) return "cobertura";
    return clean(text);
  }

  function inputName(input) { return clean(input.name || input.description || input.material || input.inputName); }
  function inputUnit(input) { return unit(input.unit || input.inputUnit || input.coefficientUnit || "un"); }
  function inputCode(input) { return clean(input.code || input.id || input.inputCode); }
  function inputType(input) {
    const text = normalize(input.type || input.tipo || input.inputType || "");
    if (/mao|obra|labor|hora/.test(text) || inputUnit(input) === "h") return "labor";
    if (/equip/.test(text)) return "equipment";
    return "material";
  }
  function inputPrice(input) {
    const price = number(input.unitPrice !== undefined ? input.unitPrice : input.precoUnitario);
    const total = number(input.totalCost !== undefined ? input.totalCost : input.custoTotal);
    return { unitPrice: price, totalCost: total };
  }

  function consolidate(items) {
    const grouped = {};
    (items || []).forEach(function (item) {
      const key = normalize([item.code, item.name, item.unit].join("|"));
      if (!grouped[key]) grouped[key] = Object.assign({}, item);
      else grouped[key].quantity = round(grouped[key].quantity + item.quantity);
    });
    return Object.keys(grouped).map(function (key) { return grouped[key]; });
  }

  function splitInputs(inputs) {
    const materials = [];
    const labor = [];
    const equipment = [];
    (inputs || []).forEach(function (input) {
      const item = {
        code: inputCode(input),
        name: inputName(input),
        unit: input.unit,
        quantity: round(input.total),
        coefficient: number(input.coefficient),
        coefficientUnit: input.coefficientUnit || input.unit
      };
      if (input.conversion && input.conversion.available) item.conversion = input.conversion;
      if (input.type === "labor") labor.push(item);
      else if (input.type === "equipment") equipment.push(item);
      else materials.push(item);
    });
    return { materials: consolidate(materials), labor: consolidate(labor), equipment: consolidate(equipment) };
  }

  function priceComposition(composition, quantity) {
    let unitCost = 0;
    let hasAnyPrice = false;
    let hasMissingPrice = false;
    (composition.inputs || composition.materials || composition.insumos || []).forEach(function (input) {
      const coefficient = number(input.coefficient !== undefined ? input.coefficient : input.quantityPerUnit);
      const prices = inputPrice(input);
      const partial = prices.totalCost > 0 ? prices.totalCost : prices.unitPrice > 0 && coefficient > 0 ? prices.unitPrice * coefficient : 0;
      if (partial > 0) {
        hasAnyPrice = true;
        unitCost += partial;
      } else {
        hasMissingPrice = true;
      }
    });
    if (!hasAnyPrice) return { unitCost: null, totalCost: null, pricingStatus: "unpriced" };
    if (hasMissingPrice) return { unitCost: round(unitCost), totalCost: null, pricingStatus: "partial_price" };
    return { unitCost: round(unitCost), totalCost: round(unitCost * quantity), pricingStatus: "priced" };
  }


  function slopeFactorFromText(text) {
    const raw = clean(text);
    const normalized = normalize(raw);
    const explicitFactor = normalized.match(/fator\s+(?:de\s+)?(?:inclinacao\s+)?(\d+(?:[,.]\d+)?)/);
    if (explicitFactor) return { factor: number(explicitFactor[1]), label: "fator informado " + String(number(explicitFactor[1])).replace(".", ",") };
    const percent = normalized.match(/inclinacao\s+(?:de\s+)?(\d+(?:[,.]\d+)?)\s*%/);
    if (percent) {
      const slope = number(percent[1]) / 100;
      const factor = Math.sqrt(1 + slope * slope);
      return { factor: round(factor), label: "inclinacao " + String(number(percent[1])).replace(".", ",") + "%" };
    }
    const degrees = normalized.match(/inclinacao\s+(?:de\s+)?(\d+(?:[,.]\d+)?)\s*graus?/);
    if (degrees) {
      const radians = number(degrees[1]) * Math.PI / 180;
      const factor = 1 / Math.cos(radians);
      return { factor: round(factor), label: "inclinacao " + String(number(degrees[1])).replace(".", ",") + " graus" };
    }
    return { factor: 1, label: "sem inclinacao informada" };
  }

  function extractRoofDimensionsFromText(text) {
    const raw = clean(text);
    const normalized = normalize(raw);
    const dimensions = {};
    const memory = [];
    let projectedArea = 0;
    const directArea = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|metros?\s+quadrados?)/i);
    if (directArea) {
      projectedArea = round(directArea[1]);
      dimensions.projectedArea = projectedArea;
      memory.push("?rea projetada informada: " + String(projectedArea).replace(".", ",") + " m2");
    } else {
      const multiplication = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*[xX\u00d7]\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/);
      if (multiplication) {
        const length = number(multiplication[1]);
        const width = number(multiplication[2]);
        projectedArea = round(length * width);
        dimensions.length = length;
        dimensions.width = width;
        dimensions.projectedArea = projectedArea;
        memory.push("?rea projetada = " + dimensionLabel(length) + " x " + dimensionLabel(width) + " = " + String(projectedArea).replace(".", ",") + " m2");
      }
    }
    if (!(projectedArea > 0)) return { quantity: 0, unit: "", dimensions: dimensions, calculationMemory: memory };
    const slope = slopeFactorFromText(raw);
    dimensions.slopeFactor = slope.factor;
    let inclinedArea = round(projectedArea * slope.factor);
    if (slope.factor !== 1) memory.push("?rea inclinada = " + String(projectedArea).replace(".", ",") + " m2 x " + String(slope.factor).replace(".", ",") + " (" + slope.label + ") = " + String(inclinedArea).replace(".", ",") + " m2");
    else memory.push("?rea inclinada = ?rea projetada sem fator informado = " + String(inclinedArea).replace(".", ",") + " m2");
    const loss = raw.match(/perdas?\s+(?:de\s+)?(\d+(?:[,.]\d+)?)\s*%/i);
    if (loss) {
      const lossPercent = number(loss[1]);
      const withLoss = round(inclinedArea * (1 + lossPercent / 100));
      dimensions.lossPercent = lossPercent;
      memory.push("?rea com perdas = " + String(inclinedArea).replace(".", ",") + " m2 x " + String(1 + lossPercent / 100).replace(".", ",") + " = " + String(withLoss).replace(".", ",") + " m2");
      inclinedArea = withLoss;
    }
    return { quantity: inclinedArea, unit: "m2", dimensions: dimensions, calculationMemory: memory };
  }

  function compactComposition(candidate, composition) {
    return {
      code: candidate.code || composition.code || composition.compositionCode || "",
      description: candidate.description || composition.description || composition.compositionName || composition.service || "",
      unit: candidate.unit || composition.unit || composition.compositionUnit || "",
      source: candidate.source || composition.source || "",
      score: candidate.score,
      reasons: candidate.reasons || []
    };
  }

  function consumeComposition(candidate, quantity, requestedUnit, consumptionEngine) {
    const composition = candidate.composition || candidate;
    const consumption = consumptionEngine.calculateConsumptionFromCompositions([
      { packageId: "technical_service", serviceId: "technical_service", quantity: quantity, unit: requestedUnit }
    ], [
      { packageId: "technical_service", serviceId: "technical_service", found: true, composition: composition }
    ]);
    const calculated = consumption.consumptions && consumption.consumptions[0];
    if (!calculated) return { blocked: (consumption.blocked || []).map(function (item) { return item.reason; }) };
    const groups = splitInputs(calculated.inputs);
    const price = priceComposition(composition, quantity);
    return { composition: compactComposition(candidate, composition), groups: groups, price: price };
  }

  function appendGroups(target, groups) {
    target.materials = consolidate(target.materials.concat(groups.materials));
    target.labor = consolidate(target.labor.concat(groups.labor));
    target.equipment = consolidate(target.equipment.concat(groups.equipment));
  }

  function buildRoofResult(base, searchEngine, consumptionEngine, settings) {
    const quantity = base.quantity;
    const requestedUnit = base.unit;
    const pending = [];
    const relatedCompositions = [];
    const output = { materials: [], labor: [], equipment: [] };
    const warnings = base.warnings.slice();
    let foundCost = 0;
    let hasPrice = false;
    let hasUnpriced = false;
    [{ key: "telhamento", query: "telhamento com telha ceramica" }, { key: "estrutura_madeira", query: "trama de madeira cobertura telha ceramica" }].forEach(function (item) {
      const search = searchEngine.searchOfficialCompositions(item.query, { unit: requestedUnit, limit: settings.limit || 5 }) || {};
      const candidate = search.candidates && search.candidates[0];
      if (!candidate) { pending.push(item.key + "_composition_not_found"); return; }
      const consumed = consumeComposition(candidate, quantity, requestedUnit, consumptionEngine);
      if (consumed.blocked) { pending.push(item.key + "_consumption_failed"); warnings.push.apply(warnings, consumed.blocked); return; }
      relatedCompositions.push(Object.assign({ role: item.key }, consumed.composition));
      if (consumed.price && consumed.price.pricingStatus === "priced") { hasPrice = true; foundCost += consumed.price.totalCost; }
      else hasUnpriced = true;
      appendGroups(output, consumed.groups);
    });
    const ridge = normalize(base.text).match(/cumeeira\s+(?:de\s+)?(\d+(?:[,.]\d+)?)\s*(?:m|metros?)/);
    if (ridge) {
      const ridgeLength = round(ridge[1]);
      const ridgeSearch = searchEngine.searchOfficialCompositions("cumeeira telha ceramica", { unit: "m", limit: settings.limit || 5 }) || {};
      const candidate = ridgeSearch.candidates && ridgeSearch.candidates[0];
      if (candidate) {
        const consumed = consumeComposition(candidate, ridgeLength, "m", consumptionEngine);
        if (consumed.blocked) pending.push("cumeeira_consumption_failed");
        else { relatedCompositions.push(Object.assign({ role: "cumeeira" }, consumed.composition)); if (consumed.price && consumed.price.pricingStatus === "priced") { hasPrice = true; foundCost += consumed.price.totalCost; } else hasUnpriced = true; appendGroups(output, consumed.groups); }
      } else pending.push("cumeeira_composition_not_found");
    } else pending.push("cumeeira_length_missing");
    if (!base.dimensions.lossPercent) pending.push("loss_percent_not_informed");
    if (!relatedCompositions.length) return Object.assign(base, { pricingStatus: "blocked_composition_not_found", pending: pending, warnings: warnings.concat(["composition_not_found"]) });
    return Object.assign(base, { composition: relatedCompositions[0], relatedCompositions: relatedCompositions, materials: output.materials, labor: output.labor, equipment: output.equipment, pending: pending, warnings: warnings, pricingStatus: hasPrice && !hasUnpriced ? "priced" : hasPrice ? "partial_price" : "unpriced", unitCost: hasPrice && !hasUnpriced ? round(foundCost / quantity) : hasPrice ? round(foundCost / quantity) : null, totalCost: hasPrice && !hasUnpriced ? round(foundCost) : null });
  }
  function build(input, options) {
    const settings = options || {};
    const text = clean(input && input.text);
    const service = clean(input && input.service) || inferServiceFromText(text);
    const isRoofService = /cobertura|telhado|telha/.test(normalize(service)) || /cobertura|telhado|telha/.test(normalize(text));
    const extracted = isRoofService ? extractRoofDimensionsFromText(text) : extractDimensionsFromText(text);
    const quantity = round(input && input.quantity || extracted.quantity);
    const requestedUnit = unit(input && input.unit || extracted.unit || "m2");
    const dimensions = Object.assign({}, extracted.dimensions, input && input.dimensions || {});
    const calculationMemory = (extracted.calculationMemory || []).slice();
    const warnings = [];
    const assumptions = [];
    if (/concreto|sapata|viga|pilar|baldrame|cinta/.test(normalize(service))) {
      assumptions.push("A?o estrutural n?o inclu?do neste quantitativo.");
    }
    if (!service) warnings.push("service_missing");
    if (!(quantity > 0) || !requestedUnit) warnings.push("quantity_missing");
    if (warnings.length) {
      return {
        service: service,
        quantity: quantity || null,
        unit: requestedUnit,
        dimensions: dimensions,
        composition: null,
        materials: [],
        labor: [],
        equipment: [],
        unitCost: null,
        totalCost: null,
        pricingStatus: "blocked_missing_quantity",
        assumptions: assumptions,
        warnings: warnings,
        calculationMemory: calculationMemory
      };
    }

    const searchEngine = settings.compositionSearchEngine || root.CompositionSearchEngine;
    if (!searchEngine || typeof searchEngine.searchOfficialCompositions !== "function") {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_search_unavailable", assumptions: assumptions, warnings: ["composition_search_unavailable"], calculationMemory: calculationMemory };
    }
    if (isRoofService) {
      const consumptionEngine = settings.consumptionEngine || root.EloConsumptionEngine;
      if (!consumptionEngine || typeof consumptionEngine.calculateConsumptionFromCompositions !== "function") {
        return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_consumption_unavailable", assumptions: assumptions, warnings: ["consumption_engine_unavailable"], calculationMemory: calculationMemory, pending: [] };
      }
      return buildRoofResult({ service: service, text: text, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "", assumptions: assumptions, warnings: warnings, calculationMemory: calculationMemory }, searchEngine, consumptionEngine, settings);
    }
    const technicalService = /escavacao|concreto|sapata|viga|pilar|baldrame|cinta/.test(normalize(service));
    const query = technicalService ? service : [service, text].filter(Boolean).join(" ");
    const search = searchEngine.searchOfficialCompositions(query, { unit: requestedUnit, limit: settings.limit || 5 }) || {};
    const candidate = search.candidates && search.candidates[0];
    if (!candidate) {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_composition_not_found", assumptions: assumptions, warnings: ["composition_not_found"], calculationMemory: calculationMemory };
    }

    const composition = candidate.composition || candidate;
    const consumptionEngine = settings.consumptionEngine || root.EloConsumptionEngine;
    if (!consumptionEngine || typeof consumptionEngine.calculateConsumptionFromCompositions !== "function") {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: candidate, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_consumption_unavailable", assumptions: assumptions, warnings: ["consumption_engine_unavailable"], calculationMemory: calculationMemory };
    }
    const consumption = consumptionEngine.calculateConsumptionFromCompositions([
      { packageId: "technical_service", serviceId: "technical_service", quantity: quantity, unit: requestedUnit }
    ], [
      { packageId: "technical_service", serviceId: "technical_service", found: true, composition: composition }
    ]);
    const calculated = consumption.consumptions && consumption.consumptions[0];
    if (!calculated) {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: candidate, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_consumption_failed", assumptions: assumptions, warnings: (consumption.blocked || []).map(function (item) { return item.reason; }), calculationMemory: calculationMemory };
    }
    const groups = splitInputs(calculated.inputs);
    const price = priceComposition(composition, quantity);
    return {
      service: service,
      quantity: quantity,
      unit: requestedUnit,
      dimensions: dimensions,
      composition: {
        code: candidate.code || composition.code || composition.compositionCode || "",
        description: candidate.description || composition.description || composition.compositionName || composition.service || "",
        unit: candidate.unit || composition.unit || composition.compositionUnit || "",
        source: candidate.source || composition.source || "",
        score: candidate.score,
        reasons: candidate.reasons || []
      },
      materials: groups.materials,
      labor: groups.labor,
      equipment: groups.equipment,
      unitCost: price.unitCost,
      totalCost: price.totalCost,
      pricingStatus: price.pricingStatus,
      assumptions: assumptions,
      warnings: warnings,
      calculationMemory: calculationMemory
    };
  }

  root.EloTechnicalServiceBridge = { version: VERSION, build: build, extractDimensionsFromText: extractDimensionsFromText, inferServiceFromText: inferServiceFromText };
})(typeof window !== "undefined" ? window : globalThis);
