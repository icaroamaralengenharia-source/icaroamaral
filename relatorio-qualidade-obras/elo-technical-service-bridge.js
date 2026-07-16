(function (root) {
  "use strict";

  const VERSION = "20260716-elo-technical-service-bridge-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).replace(/m[²2]/gi, "m2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function number(value) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function round(value) { return Math.round(number(value) * 1000) / 1000; }
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
    const directArea = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m\^2|m²|metros?\s+quadrados?)/i);
    if (directArea) return { quantity: round(directArea[1]), unit: "m2", dimensions: { area: round(directArea[1]) } };
    const length = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+de\s+comprimento/);
    const height = normalized.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)\s+de\s+altura/);
    if (length && height) {
      const l = number(length[1]);
      const h = number(height[1]);
      return { quantity: round(l * h), unit: "m2", dimensions: { length: l, height: h } };
    }
    const multiplication = raw.match(/(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?\s*[xX×]\s*(\d+(?:[,.]\d+)?)\s*(?:m|metros?)?/);
    if (multiplication) {
      const a = number(multiplication[1]);
      const b = number(multiplication[2]);
      return { quantity: round(a * b), unit: "m2", dimensions: { length: a, height: b } };
    }
    return { quantity: 0, unit: "", dimensions: {} };
  }

  function inferServiceFromText(text) {
    const normalized = normalize(text);
    if (/parede|alvenaria|bloco/.test(normalized)) return "alvenaria de bloco ceramico";
    if (/piso|revestimento ceramico|porcelanato/.test(normalized)) return "revestimento de piso";
    if (/reboco|emboco|massa unica/.test(normalized)) return "reboco em parede";
    if (/chapisco/.test(normalized)) return "chapisco em alvenaria";
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

  function build(input, options) {
    const settings = options || {};
    const text = clean(input && input.text);
    const extracted = extractDimensionsFromText(text);
    const service = clean(input && input.service) || inferServiceFromText(text);
    const quantity = round(input && input.quantity || extracted.quantity);
    const requestedUnit = unit(input && input.unit || extracted.unit || "m2");
    const dimensions = Object.assign({}, extracted.dimensions, input && input.dimensions || {});
    const warnings = [];
    const assumptions = [];
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
        warnings: warnings
      };
    }

    const searchEngine = settings.compositionSearchEngine || root.CompositionSearchEngine;
    if (!searchEngine || typeof searchEngine.searchOfficialCompositions !== "function") {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_search_unavailable", assumptions: assumptions, warnings: ["composition_search_unavailable"] };
    }
    const query = [service, text].filter(Boolean).join(" ");
    const search = searchEngine.searchOfficialCompositions(query, { unit: requestedUnit, limit: settings.limit || 5 }) || {};
    const candidate = search.candidates && search.candidates[0];
    if (!candidate) {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: null, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_composition_not_found", assumptions: assumptions, warnings: ["composition_not_found"] };
    }

    const composition = candidate.composition || candidate;
    const consumptionEngine = settings.consumptionEngine || root.EloConsumptionEngine;
    if (!consumptionEngine || typeof consumptionEngine.calculateConsumptionFromCompositions !== "function") {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: candidate, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_consumption_unavailable", assumptions: assumptions, warnings: ["consumption_engine_unavailable"] };
    }
    const consumption = consumptionEngine.calculateConsumptionFromCompositions([
      { packageId: "technical_service", serviceId: "technical_service", quantity: quantity, unit: requestedUnit }
    ], [
      { packageId: "technical_service", serviceId: "technical_service", found: true, composition: composition }
    ]);
    const calculated = consumption.consumptions && consumption.consumptions[0];
    if (!calculated) {
      return { service: service, quantity: quantity, unit: requestedUnit, dimensions: dimensions, composition: candidate, materials: [], labor: [], equipment: [], unitCost: null, totalCost: null, pricingStatus: "blocked_consumption_failed", assumptions: assumptions, warnings: (consumption.blocked || []).map(function (item) { return item.reason; }) };
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
      warnings: warnings
    };
  }

  root.EloTechnicalServiceBridge = { version: VERSION, build: build, extractDimensionsFromText: extractDimensionsFromText, inferServiceFromText: inferServiceFromText };
})(typeof window !== "undefined" ? window : globalThis);
