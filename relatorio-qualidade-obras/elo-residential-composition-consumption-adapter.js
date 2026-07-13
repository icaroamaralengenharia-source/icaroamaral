(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_takeoff_composition_resolution";
  const OUTPUT_SCHEMA = "elo.residential_composition_consumption";
  const SERVICE_UNITS = { m: true, m2: true, m3: true, un: true };
  const INPUT_UNIT_PRECISION = { kg: 6, g: 3, t: 6, m: 6, m2: 6, m3: 6, l: 6, ml: 3, un: 6, h: 6, hprod: 6, mes: 6, dia: 6 };
  const FORBIDDEN_FIELDS = ["unitPrice", "inputPrice", "compositionPrice", "priceSource", "cost", "partialCost", "subtotal", "totalBudget", "budget", "budgetEap", "budgetDocumentData", "pdfAction", "BDI", "bdi", "socialCharges", "freight", "lossPercent"];

  function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.keys(value).reduce(function (acc, key) { acc[key] = clone(value[key]); return acc; }, {});
    return value;
  }
  function toNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : (/^[+-]?Infinity$/i.test(String(value)) ? parsed : null);
  }
  function round(value, unit) {
    const precision = INPUT_UNIT_PRECISION[normalizeUnit(unit)] == null ? 6 : INPUT_UNIT_PRECISION[normalizeUnit(unit)];
    const factor = Math.pow(10, precision);
    return Math.round(Number(value || 0) * factor) / factor;
  }
  function normalizeUnit(value) {
    const text = normalize(value).replace(/m 2|metro quadrado|metros quadrados/g, "m2").replace(/m 3|metro cubico|metros cubicos/g, "m3").replace(/mês/g, "mes");
    if (text === "und" || text === "unidade" || text === "unidades") return "un";
    if (text === "litro" || text === "litros") return "l";
    if (text === "hora" || text === "horas") return "h";
    return text;
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (isObject(value)) {
      return Object.keys(value).sort().reduce(function (acc, key) {
        if (key !== "generatedAt") acc[key] = stable(value[key]);
        return acc;
      }, {});
    }
    if (typeof value === "number" && !Number.isFinite(value)) return String(value);
    return value;
  }
  function fingerprint(value) {
    const text = JSON.stringify(stable(value));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return "fp_" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function issue(code, reason) { return { code: code, reason: reason }; }
  function inputIdentity(input) { return clean(input && (input.code || input.id || input.inputCode || input.description || input.name || input.material || input.inputName)); }
  function inputUnit(input) { return normalizeUnit(input && (input.unit || input.inputUnit || input.coefficientUnit)); }
  function inputCoefficient(input) { return toNumber(input && (input.coefficient !== undefined ? input.coefficient : input.quantityPerUnit)); }
  function inputType(input) {
    const text = normalize(input && (input.type || input.tipo || input.inputType || "material"));
    if (/labor|mao|obra|hora/.test(text)) return "labor";
    if (/equip/.test(text)) return "equipment";
    if (/serv/.test(text)) return "service";
    return text || "material";
  }
  function compositionInputs(composition) { return arr(composition && (composition.inputs || composition.materials || composition.insumos)); }
  function hasForbiddenPayload(value) { return FORBIDDEN_FIELDS.some(function (field) { return value && Object.prototype.hasOwnProperty.call(value, field); }); }
  function traceOf(item) { return item && (item.traceability || item.trace || {}); }
  function compositionOf(item) { return item && item.composition || {}; }
  function serviceUnitOf(item) { return normalizeUnit(item && (item.unit || item.service && item.service.unit)); }
  function compositionUnitOf(item) { return normalizeUnit(compositionOf(item).unit || compositionOf(item).productionUnit); }
  function serviceQuantityOf(item) { return toNumber(item && (item.quantity !== undefined ? item.quantity : item.service && item.service.quantity)); }

  function validateResolution(resolution) {
    const errors = [];
    if (!isObject(resolution)) errors.push(issue("invalid_input", "Input deve ser pacote canonico de resolucao de composicoes."));
    if (isObject(resolution) && resolution.schema !== INPUT_SCHEMA) errors.push(issue("invalid_schema", "Schema incompativel."));
    if (isObject(resolution) && resolution.status === "invalid") errors.push(issue("invalid_resolution_status", "Resolucao de composicoes esta invalida."));
    if (isObject(resolution) && !isObject(resolution.resolution)) errors.push(issue("missing_resolution", "Bloco resolution ausente."));
    return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors: errors };
  }

  function validateCompositionInputs(composition) {
    const inputs = compositionInputs(composition);
    const errors = [];
    const warnings = [];
    if (!inputs.length) errors.push(issue("missing_inputs", "Composicao sem insumos analiticos."));
    inputs.forEach(function (input, index) {
      const prefix = "inputs." + index;
      const identity = inputIdentity(input);
      const unit = inputUnit(input);
      const coefficient = inputCoefficient(input);
      if (!identity) errors.push(issue("missing_input_identity", prefix + " sem codigo ou descricao."));
      if (!unit) errors.push(issue("missing_input_unit", prefix + " sem unidade."));
      else if (!INPUT_UNIT_PRECISION[unit]) warnings.push(issue("unknown_input_unit", prefix + " com unidade nao mapeada para precisao."));
      if (coefficient === null) errors.push(issue("missing_coefficient", prefix + " sem coeficiente."));
      else if (!Number.isFinite(coefficient)) errors.push(issue("invalid_coefficient", prefix + " com coeficiente invalido."));
      else if (coefficient < 0) errors.push(issue("negative_coefficient", prefix + " com coeficiente negativo."));
    });
    return { valid: errors.length === 0, errors: errors, warnings: warnings };
  }

  function makeSkipped(item, classification, reasonCode, reason) {
    return {
      takeoffItemId: item && item.takeoffItemId || null,
      requestId: item && item.requestId || null,
      compositionCode: item && item.composition && item.composition.code || null,
      classification: classification,
      reasonCode: reasonCode,
      reason: reason,
      originalStatus: item && item.status || null,
      serviceQuantity: serviceQuantityOf(item),
      serviceUnit: serviceUnitOf(item) || null
    };
  }

  function classifyResolvedItem(item) {
    if (!isObject(item)) return makeSkipped({}, "invalid", "resolution_blocked", "Item de resolucao invalido.");
    if (item.status === "unresolved") return makeSkipped(item, "skipped", "resolution_unresolved", "Resolucao unresolved nao deve ser enviada.");
    if (item.status === "rejected") return makeSkipped(item, "skipped", "resolution_rejected", "Resolucao rejected nao deve ser enviada.");
    if (item.status === "blocked") return makeSkipped(item, "blocked", "resolution_blocked", "Resolucao blocked nao deve ser enviada.");
    if (item.status !== "resolved") return makeSkipped(item, "skipped", "resolution_blocked", "Status nao elegivel para consumo.");
    if (!item.takeoffItemId) return makeSkipped(item, "invalid", "missing_takeoff_reference", "takeoffItemId ausente.");
    if (!item.requestId) return makeSkipped(item, "invalid", "missing_request_reference", "requestId ausente.");
    const quantity = serviceQuantityOf(item);
    if (quantity === null || !Number.isFinite(quantity)) return makeSkipped(item, "invalid", "invalid_service_quantity", "Quantidade do servico invalida.");
    if (quantity < 0) return makeSkipped(item, "invalid", "invalid_service_quantity", "Quantidade do servico negativa.");
    if (quantity === 0) return makeSkipped(item, "skipped", "zero_service_quantity", "Quantidade do servico zero.");
    const serviceUnit = serviceUnitOf(item);
    if (!serviceUnit) return makeSkipped(item, "invalid", "missing_service_unit", "Unidade do servico ausente.");
    if (!SERVICE_UNITS[serviceUnit]) return makeSkipped(item, "invalid", "missing_service_unit", "Unidade do servico nao suportada nesta fase.");
    const composition = compositionOf(item);
    if (!clean(composition.code)) return makeSkipped(item, "invalid", "missing_composition_code", "Composicao sem codigo.");
    if (!clean(composition.description)) return makeSkipped(item, "invalid", "missing_composition_description", "Composicao sem descricao.");
    const compositionUnit = compositionUnitOf(item);
    if (!compositionUnit) return makeSkipped(item, "invalid", "missing_composition_unit", "Composicao sem unidade.");
    if (compositionUnit !== serviceUnit) return makeSkipped(item, "invalid", "unit_mismatch", "Unidade da composicao incompativel com unidade do servico.");
    if (!clean(composition.source)) return makeSkipped(item, "blocked", "resolution_blocked", "Origem da composicao ausente.");
    const inputValidation = validateCompositionInputs(composition);
    if (!inputValidation.valid) return makeSkipped(item, "invalid", inputValidation.errors[0].code, inputValidation.errors[0].reason);
    if (arr(item.errors).length) return makeSkipped(item, "invalid", "resolution_blocked", "Item possui erros de resolucao.");
    const trace = traceOf(item);
    if (!isObject(trace) || !trace.geometryPath) return makeSkipped(item, "invalid", "missing_traceability", "Rastreabilidade geometrica ausente.");
    if (hasForbiddenPayload(item) || hasForbiddenPayload(composition)) return makeSkipped(item, "blocked", "resolution_blocked", "Payload contem campos de preco/custo/orcamento proibidos.");
    return { classification: "eligible", reasonCode: "eligible", reason: "Composicao apta para consumo.", warnings: inputValidation.warnings };
  }

  function mapResolvedItemToConsumptionInput(item) {
    const composition = compositionOf(item);
    const trace = traceOf(item);
    const requestId = clean(item.requestId);
    const serviceId = clean(item.takeoffItemId);
    const quantity = serviceQuantityOf(item);
    const unit = serviceUnitOf(item);
    const inputs = compositionInputs(composition).map(function (input) {
      return {
        code: clean(input.code || input.id || input.inputCode) || null,
        description: clean(input.description || input.name || input.material || input.inputName),
        name: clean(input.name || input.description || input.material || input.inputName),
        type: inputType(input),
        unit: inputUnit(input),
        coefficient: inputCoefficient(input)
      };
    });
    return {
      requestId: requestId,
      takeoffItemId: serviceId,
      quantity: { packageId: requestId, serviceId: serviceId, quantity: quantity, unit: unit },
      match: { packageId: requestId, serviceId: serviceId, found: true, composition: { code: clean(composition.code), description: clean(composition.description), unit: normalizeUnit(composition.unit), source: clean(composition.source), referenceMonth: composition.referenceMonth || null, state: composition.state || null, inputs: inputs } },
      service: { code: serviceId, description: clean(item.service && item.service.description || composition.description), quantity: quantity, unit: unit },
      composition: { code: clean(composition.code), description: clean(composition.description), unit: normalizeUnit(composition.unit), source: clean(composition.source), referenceMonth: composition.referenceMonth || null, state: composition.state || null, inputs: inputs },
      traceability: { geometryPath: trace.geometryPath || null, roomIds: arr(trace.roomIds).slice(), floorIds: arr(trace.floorIds).slice(), openingIds: arr(trace.openingIds).slice(), compositionRequestId: requestId }
    };
  }

  function buildRequest(resolution, options) {
    const validation = validateResolution(resolution);
    const resolved = arr(resolution && resolution.resolution && resolution.resolution.resolved);
    const unresolved = arr(resolution && resolution.resolution && resolution.resolution.unresolved);
    const rejected = arr(resolution && resolution.resolution && resolution.resolution.rejected);
    const skippedSource = arr(resolution && resolution.skippedItems);
    const items = [];
    const skippedItems = [];
    const warnings = [];
    if (!validation.valid) return { status: "invalid", inputCount: 0, eligibleCount: 0, skippedCount: 0, blockedCount: 0, items: [], skippedItems: [], warnings: [], errors: validation.errors };
    resolved.forEach(function (item) {
      const classified = classifyResolvedItem(item, options);
      if (classified.classification === "eligible") {
        items.push(mapResolvedItemToConsumptionInput(item));
        warnings.push.apply(warnings, classified.warnings || []);
      } else skippedItems.push(classified);
    });
    unresolved.forEach(function (item) { skippedItems.push(makeSkipped(item, "skipped", "resolution_unresolved", "Resolucao unresolved preservada.")); });
    rejected.forEach(function (item) { skippedItems.push(makeSkipped(item, "skipped", "resolution_rejected", "Resolucao rejected preservada.")); });
    skippedSource.forEach(function (item) { skippedItems.push({ takeoffItemId: item.takeoffItemId || null, requestId: item.requestId || null, compositionCode: item.compositionCode || null, classification: item.classification || "skipped", reasonCode: item.reasonCode || "resolution_blocked", reason: item.reason || "Item ja ignorado na fase anterior.", originalStatus: item.originalStatus || null, serviceQuantity: item.serviceQuantity == null ? null : item.serviceQuantity, serviceUnit: item.serviceUnit || null }); });
    return {
      status: items.length ? "ready" : "blocked",
      inputCount: resolved.length,
      eligibleCount: items.length,
      skippedCount: skippedItems.filter(function (item) { return item.classification === "skipped"; }).length,
      blockedCount: skippedItems.filter(function (item) { return item.classification === "blocked" || item.classification === "invalid"; }).length,
      items: items,
      skippedItems: skippedItems,
      warnings: warnings,
      errors: []
    };
  }

  function emptyModel(resolution, options) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      sourceResolution: { schema: resolution && resolution.schema || null, version: resolution && resolution.version || null, inputFingerprint: resolution && resolution.audit && resolution.audit.inputFingerprint || null, requestFingerprint: resolution && resolution.audit && resolution.audit.requestFingerprint || null, resolutionFingerprint: resolution && resolution.audit && resolution.audit.resolutionFingerprint || null },
      request: { inputCount: 0, eligibleCount: 0, skippedCount: 0, blockedCount: 0, items: [] },
      consumption: { calculated: [], pending: [], rejected: [], errors: [] },
      skippedItems: [],
      totals: { inputResolvedCount: 0, eligibleCompositionCount: 0, calculatedCompositionCount: 0, pendingCompositionCount: 0, rejectedCompositionCount: 0, skippedCompositionCount: 0, blockedCompositionCount: 0, consumptionLineCount: 0 },
      quantitiesByInputUnit: {},
      warnings: [],
      errors: [],
      blockingFields: [],
      completeness: { score: 0, eligibleCount: 0, calculatedCount: 0, pendingCount: 0, rejectedCount: 0 },
      audit: { generatedAt: options && options.generatedAt || new Date().toISOString(), source: "ResidentialCompositionConsumptionAdapter", inputFingerprint: fingerprint(resolution || null), requestFingerprint: null, consumptionFingerprint: null }
    };
  }

  function callEngine(request, options) {
    const settings = options || {};
    const quantities = request.items.map(function (item) { return clone(item.quantity); });
    const matches = request.items.map(function (item) { return clone(item.match); });
    try {
      if (settings.consumptionEngine && typeof settings.consumptionEngine.calculateConsumptionFromCompositions === "function") return { result: settings.consumptionEngine.calculateConsumptionFromCompositions(quantities, matches) };
      if (typeof settings.calculateConsumption === "function") return { result: settings.calculateConsumption(quantities, matches) };
      if (settings.consumptionEngine && typeof settings.consumptionEngine.calculateConsumption === "function") return { result: settings.consumptionEngine.calculateConsumption(quantities, matches) };
    } catch (error) {
      return { error: { code: "consumption_engine_error", message: error && error.message || "Erro controlado no motor de consumo." } };
    }
    return { error: { code: "consumption_engine_required", message: "EloConsumptionEngine nao foi fornecido por injecao explicita." } };
  }

  function requestByIds(request) {
    return request.items.reduce(function (acc, item) { acc[item.requestId + "|" + item.takeoffItemId] = item; return acc; }, {});
  }
  function normalizeConsumptionLine(input, serviceQuantity) {
    const coefficient = toNumber(input.coefficient);
    const raw = toNumber(input.total) !== null ? toNumber(input.total) : (coefficient === null ? null : serviceQuantity * coefficient);
    const unit = normalizeUnit(input.unit || input.coefficientUnit);
    const rounded = raw === null ? null : round(raw, unit);
    return {
      inputCode: clean(input.code || input.id || input.inputCode) || null,
      description: clean(input.name || input.description || input.material || input.inputName),
      type: inputType(input),
      unit: unit,
      coefficient: coefficient,
      serviceQuantity: serviceQuantity,
      rawConsumption: raw,
      consumption: rounded,
      calculation: { formula: "serviceQuantity * coefficient", operands: { serviceQuantity: serviceQuantity, coefficient: coefficient }, rawResult: raw, roundedResult: rounded, roundingPrecision: INPUT_UNIT_PRECISION[unit] == null ? 6 : INPUT_UNIT_PRECISION[unit] },
      status: raw === null || coefficient === null ? "pending" : "calculated",
      warnings: INPUT_UNIT_PRECISION[unit] == null ? [{ code: "unknown_input_unit", message: "Unidade de insumo preservada sem conversao." }] : [],
      errors: []
    };
  }
  function normalizeConsumptionResult(result, request) {
    const normalized = { calculated: [], pending: [], rejected: [], errors: [] };
    if (!isObject(result)) {
      normalized.errors.push({ code: "invalid_engine_result", message: "Motor retornou contrato invalido." });
      arr(request && request.items).forEach(function (item) { normalized.pending.push({ takeoffItemId: item.takeoffItemId, requestId: item.requestId, status: "pending", reasonCode: "invalid_engine_result", reason: "Sem resultado valido do motor." }); });
      return normalized;
    }
    const byId = requestByIds(request || { items: [] });
    arr(result.consumptions || result.calculated).forEach(function (entry) {
      const req = byId[(entry.packageId || entry.requestId) + "|" + (entry.serviceId || entry.takeoffItemId)] || null;
      if (!req) { normalized.errors.push({ code: "invalid_engine_result", message: "Consumo sem request correspondente." }); return; }
      const serviceQuantity = toNumber(entry.quantity) == null ? req.service.quantity : toNumber(entry.quantity);
      const returnedServiceUnit = normalizeUnit(entry.unit || req.service.unit);
      const item = {
        takeoffItemId: req.takeoffItemId,
        requestId: req.requestId,
        service: clone(req.service),
        composition: { code: clean(entry.compositionCode || req.composition.code), description: clean(entry.compositionDescription || req.composition.description), unit: normalizeUnit(entry.compositionUnit || req.composition.unit), source: req.composition.source },
        inputs: arr(entry.inputs).map(function (input) { return normalizeConsumptionLine(input, serviceQuantity); }),
        status: "calculated",
        traceability: clone(req.traceability),
        warnings: arr(entry.warnings).slice(),
        errors: []
      };
      if (serviceQuantity !== req.service.quantity) { item.status = "rejected"; item.errors.push({ code: "service_quantity_mismatch", message: "Quantidade retornada diverge da quantidade enviada." }); }
      if (returnedServiceUnit !== req.service.unit) { item.status = "rejected"; item.errors.push({ code: "service_unit_mismatch", message: "Unidade retornada diverge da unidade enviada." }); }
      if (!item.inputs.length && item.status !== "rejected") { item.status = "partial"; item.warnings.push({ code: "missing_calculated_inputs", message: "Motor nao retornou linhas de consumo." }); }
      if (item.status !== "rejected" && item.inputs.some(function (input) { return input.status !== "calculated"; })) item.status = "partial";
      if (item.status === "rejected") normalized.rejected.push(item); else normalized.calculated.push(item);
    });
    arr(result.blocked || result.pending || result.rejected).forEach(function (entry) {
      const req = byId[(entry.packageId || entry.requestId) + "|" + (entry.serviceId || entry.takeoffItemId)] || null;
      normalized.pending.push({ takeoffItemId: req && req.takeoffItemId || entry.serviceId || null, requestId: req && req.requestId || entry.packageId || null, compositionCode: entry.compositionCode || req && req.composition.code || null, status: "pending", reasonCode: entry.reason || "consumption_engine_error", reason: entry.reason || "Consumo bloqueado pelo motor.", traceability: req ? clone(req.traceability) : null });
    });
    arr(request && request.items).forEach(function (req) {
      const found = normalized.calculated.concat(normalized.pending, normalized.rejected).some(function (item) { return item.requestId === req.requestId && item.takeoffItemId === req.takeoffItemId; });
      if (!found) normalized.pending.push({ takeoffItemId: req.takeoffItemId, requestId: req.requestId, compositionCode: req.composition.code, status: "pending", reasonCode: "invalid_engine_result", reason: "Motor nao retornou item solicitado.", traceability: clone(req.traceability) });
    });
    return normalized;
  }

  function calculate(resolution, options) {
    const settings = options || {};
    const model = emptyModel(resolution, settings);
    const request = buildRequest(resolution, settings);
    model.request = { inputCount: request.inputCount || 0, eligibleCount: request.eligibleCount || 0, skippedCount: request.skippedCount || 0, blockedCount: request.blockedCount || 0, items: clone(request.items || []) };
    model.skippedItems = clone(request.skippedItems || []);
    model.warnings = model.warnings.concat(request.warnings || []);
    model.audit.requestFingerprint = fingerprint(model.request);
    if (request.status === "invalid") {
      model.status = "invalid";
      model.errors = request.errors.slice();
    } else if (!request.items.length) {
      model.status = "blocked";
      model.blockingFields.push("request.items");
      model.warnings.push({ code: "no_eligible_compositions", message: "Nenhuma composicao apta para consumo." });
    } else {
      const called = callEngine(request, settings);
      if (called.error) {
        model.status = "blocked";
        model.blockingFields.push("options.consumptionEngine");
        model.consumption.errors.push(called.error);
      } else {
        model.consumption = normalizeConsumptionResult(called.result, request);
        if (model.consumption.errors.length) model.status = "invalid";
      }
    }
    model.audit.consumptionFingerprint = fingerprint(model.consumption);
    model.totals.inputResolvedCount = arr(resolution && resolution.resolution && resolution.resolution.resolved).length;
    model.totals.eligibleCompositionCount = model.request.eligibleCount;
    model.totals.calculatedCompositionCount = model.consumption.calculated.filter(function (item) { return item.status === "calculated"; }).length;
    model.totals.pendingCompositionCount = model.consumption.pending.length + model.consumption.calculated.filter(function (item) { return item.status === "partial"; }).length;
    model.totals.rejectedCompositionCount = model.consumption.rejected.length;
    model.totals.skippedCompositionCount = model.skippedItems.filter(function (item) { return item.classification === "skipped"; }).length;
    model.totals.blockedCompositionCount = model.skippedItems.filter(function (item) { return item.classification === "blocked" || item.classification === "invalid"; }).length;
    model.consumption.calculated.forEach(function (entry) {
      entry.inputs.forEach(function (input) {
        model.totals.consumptionLineCount += 1;
        model.quantitiesByInputUnit[input.unit] = round((model.quantitiesByInputUnit[input.unit] || 0) + (toNumber(input.consumption) || 0), input.unit);
      });
    });
    model.completeness.eligibleCount = model.totals.eligibleCompositionCount;
    model.completeness.calculatedCount = model.totals.calculatedCompositionCount;
    model.completeness.pendingCount = model.totals.pendingCompositionCount;
    model.completeness.rejectedCount = model.totals.rejectedCompositionCount;
    model.completeness.score = model.totals.eligibleCompositionCount ? Math.round((model.totals.calculatedCompositionCount / model.totals.eligibleCompositionCount) * 100) : 0;
    if (model.status !== "invalid" && model.status !== "blocked") {
      model.status = model.errors.length || model.consumption.errors.length ? "invalid" : (model.blockingFields.length ? "blocked" : (model.totals.eligibleCompositionCount > 0 && model.totals.calculatedCompositionCount === model.totals.eligibleCompositionCount && model.totals.pendingCompositionCount === 0 && model.totals.rejectedCompositionCount === 0 ? "complete" : "partial"));
    }
    return model;
  }

  const api = { buildRequest: buildRequest, calculate: calculate, validateResolution: validateResolution, classifyResolvedItem: classifyResolvedItem, mapResolvedItemToConsumptionInput: mapResolvedItemToConsumptionInput, normalizeConsumptionResult: normalizeConsumptionResult, validateCompositionInputs: validateCompositionInputs, getSupportedInputUnits: function () { return Object.keys(INPUT_UNIT_PRECISION).slice(); }, getVersion: function () { return VERSION; } };
  root.ResidentialCompositionConsumptionAdapter = api;
  root.EloResidentialCompositionConsumptionAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
