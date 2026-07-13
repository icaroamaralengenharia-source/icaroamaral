(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_composition_consumption";
  const OUTPUT_SCHEMA = "elo.residential_consumption_price";
  const FORBIDDEN_FIELDS = ["unitPrice", "inputPrice", "materialPrice", "precoUnitario", "price", "cost", "partialCost", "subtotal", "totalBudget", "budget", "budgetEap", "budgetDocumentData", "pdfAction", "BDI", "bdi", "socialCharges", "freight"];

  function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.keys(value).reduce(function (acc, key) { acc[key] = clone(value[key]); return acc; }, {});
    return value;
  }
  function number(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (isObject(value)) {
      return Object.keys(value).sort().reduce(function (acc, key) {
        if (key !== "generatedAt") acc[key] = stable(value[key]);
        return acc;
      }, {});
    }
    return value;
  }
  function fingerprint(value) {
    const text = JSON.stringify(stable(value));
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) { hash ^= text.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return "fp_" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function issue(code, reason) { return { code: code, reason: reason }; }
  function hasForbiddenPrice(value) {
    if (!isObject(value)) return false;
    return FORBIDDEN_FIELDS.some(function (field) { return Object.prototype.hasOwnProperty.call(value, field); });
  }
  function compositionCode(entry) { return clean(entry && entry.composition && entry.composition.code); }
  function serviceQuantity(entry) { return number(entry && entry.service && entry.service.quantity); }
  function serviceUnit(entry) { return clean(entry && entry.service && entry.service.unit); }

  function validateConsumption(consumption) {
    const errors = [];
    if (!isObject(consumption)) errors.push(issue("invalid_input", "Input deve ser pacote canonico de consumo residencial."));
    if (isObject(consumption) && consumption.schema !== INPUT_SCHEMA) errors.push(issue("invalid_schema", "Schema incompativel."));
    if (isObject(consumption) && consumption.status === "invalid") errors.push(issue("invalid_consumption_status", "Consumo de origem esta invalido."));
    if (isObject(consumption) && !isObject(consumption.consumption)) errors.push(issue("missing_consumption", "Bloco consumption ausente."));
    return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors: errors };
  }

  function makeSkipped(entry, classification, reasonCode, reason) {
    return {
      takeoffItemId: entry && entry.takeoffItemId || null,
      requestId: entry && entry.requestId || null,
      compositionCode: compositionCode(entry) || null,
      classification: classification,
      reasonCode: reasonCode,
      reason: reason,
      originalStatus: entry && entry.status || null,
      quantity: serviceQuantity(entry),
      unit: serviceUnit(entry) || null
    };
  }

  function classifyConsumption(entry) {
    if (!isObject(entry)) return makeSkipped({}, "invalid", "invalid_consumption_item", "Item de consumo invalido.");
    if (entry.status !== "calculated") return makeSkipped(entry, "skipped", "consumption_not_calculated", "Apenas consumo calculado pode ser precificado.");
    if (!entry.takeoffItemId) return makeSkipped(entry, "invalid", "missing_takeoff_reference", "takeoffItemId ausente.");
    if (!entry.requestId) return makeSkipped(entry, "invalid", "missing_request_reference", "requestId ausente.");
    if (!compositionCode(entry)) return makeSkipped(entry, "invalid", "missing_composition_code", "Codigo da composicao ausente.");
    const quantity = serviceQuantity(entry);
    if (quantity === null || quantity <= 0) return makeSkipped(entry, "invalid", "invalid_service_quantity", "Quantidade do servico invalida.");
    if (!serviceUnit(entry)) return makeSkipped(entry, "invalid", "missing_service_unit", "Unidade do servico ausente.");
    if (hasForbiddenPrice(entry) || hasForbiddenPrice(entry.composition) || arr(entry.inputs).some(hasForbiddenPrice)) {
      return makeSkipped(entry, "blocked", "embedded_price_forbidden", "Preco embutido no consumo e proibido nesta etapa.");
    }
    if (arr(entry.errors).length) return makeSkipped(entry, "invalid", "consumption_errors", "Item possui erros de consumo.");
    return { classification: "eligible", reasonCode: "eligible", reason: "Consumo apto para precificacao por fonte oficial." };
  }

  function mapConsumptionToBudgetRow(entry, index) {
    return {
      rowId: entry.requestId || "residential_price_" + index,
      id: entry.requestId || "residential_price_" + index,
      takeoffItemId: entry.takeoffItemId,
      requestId: entry.requestId,
      package: entry.requestId,
      serviceId: entry.takeoffItemId,
      service: clean(entry.service && entry.service.description || entry.composition && entry.composition.description),
      quantity: serviceQuantity(entry),
      unit: serviceUnit(entry),
      compositionCode: compositionCode(entry),
      compositionDescription: clean(entry.composition && entry.composition.description),
      compositionSource: clean(entry.composition && entry.composition.source),
      traceability: clone(entry.traceability || {})
    };
  }

  function buildRequest(consumption, options) {
    const validation = validateConsumption(consumption);
    const calculated = arr(consumption && consumption.consumption && consumption.consumption.calculated);
    const pending = arr(consumption && consumption.consumption && consumption.consumption.pending);
    const rejected = arr(consumption && consumption.consumption && consumption.consumption.rejected);
    const rows = [];
    const skippedItems = [];
    if (!validation.valid) return { status: "invalid", inputCount: 0, eligibleCount: 0, rows: [], skippedItems: [], errors: validation.errors };
    calculated.forEach(function (entry, index) {
      const classified = classifyConsumption(entry, options);
      if (classified.classification === "eligible") rows.push(mapConsumptionToBudgetRow(entry, index));
      else skippedItems.push(classified);
    });
    pending.forEach(function (entry) { skippedItems.push(makeSkipped(entry, "skipped", "consumption_pending", "Consumo pendente preservado.")); });
    rejected.forEach(function (entry) { skippedItems.push(makeSkipped(entry, "skipped", "consumption_rejected", "Consumo rejeitado preservado.")); });
    return { status: rows.length ? "ready" : "blocked", inputCount: calculated.length, eligibleCount: rows.length, rows: rows, skippedItems: skippedItems, errors: [] };
  }

  function emptyModel(consumption, options) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      sourceConsumption: { schema: consumption && consumption.schema || null, version: consumption && consumption.version || null, inputFingerprint: consumption && consumption.audit && consumption.audit.inputFingerprint || null, consumptionFingerprint: consumption && consumption.audit && consumption.audit.consumptionFingerprint || null },
      request: { inputCount: 0, eligibleCount: 0, rows: [] },
      price: { pricedRows: [], missingPrices: [], canTotal: false, totals: null, errors: [] },
      skippedItems: [],
      priceBase: { source: null, prices: {} },
      totals: { inputConsumptionCount: 0, eligiblePriceCount: 0, pricedRowCount: 0, missingPriceCount: 0, skippedPriceCount: 0 },
      warnings: [],
      errors: [],
      blockingFields: [],
      completeness: { score: 0, eligibleCount: 0, pricedCount: 0, missingCount: 0 },
      audit: { generatedAt: options && options.generatedAt || new Date().toISOString(), source: "ResidentialConsumptionPriceAdapter", inputFingerprint: fingerprint(consumption || null), requestFingerprint: null, priceFingerprint: null }
    };
  }

  function callPriceEngine(request, options) {
    const settings = options || {};
    try {
      if (settings.priceEngine && typeof settings.priceEngine.attachPricesToBudgetRows === "function") {
        return { result: settings.priceEngine.attachPricesToBudgetRows(request.rows.map(clone), clone(settings.priceSource || settings.priceBase || {})) };
      }
    } catch (error) {
      return { error: { code: "price_engine_error", message: error && error.message || "Erro controlado no motor de precos." } };
    }
    return { error: { code: "price_engine_required", message: "EloPriceEngine nao foi fornecido por injecao explicita." } };
  }

  function buildPriceBase(priceResult, options) {
    const prices = {};
    arr(priceResult && priceResult.pricedRows).forEach(function (row) {
      if (row && row.compositionCode && row.unitPrice != null) prices[row.compositionCode] = row.unitPrice;
    });
    return { source: clean(options && options.priceSource && options.priceSource.source || options && options.priceBase && options.priceBase.source || "official_injected"), prices: prices };
  }

  function price(consumption, options) {
    const settings = options || {};
    const model = emptyModel(consumption, settings);
    const request = buildRequest(consumption, settings);
    model.request = { inputCount: request.inputCount || 0, eligibleCount: request.eligibleCount || 0, rows: clone(request.rows || []) };
    model.skippedItems = clone(request.skippedItems || []);
    model.audit.requestFingerprint = fingerprint(model.request);
    if (request.status === "invalid") {
      model.status = "invalid";
      model.errors = request.errors.slice();
    } else if (!request.rows.length) {
      model.status = "blocked";
      model.blockingFields.push("request.rows");
      model.warnings.push({ code: "no_eligible_consumption", message: "Nenhum consumo apto para precificacao." });
    } else {
      const called = callPriceEngine(request, settings);
      if (called.error) {
        model.status = "blocked";
        model.blockingFields.push("options.priceEngine");
        model.price.errors.push(called.error);
      } else {
        model.price = Object.assign({ pricedRows: [], missingPrices: [], canTotal: false, totals: null, errors: [] }, clone(called.result || {}));
        model.price.errors = arr(model.price.errors);
      }
    }
    model.priceBase = buildPriceBase(model.price, settings);
    model.audit.priceFingerprint = fingerprint(model.price);
    model.totals.inputConsumptionCount = arr(consumption && consumption.consumption && consumption.consumption.calculated).length;
    model.totals.eligiblePriceCount = model.request.eligibleCount;
    model.totals.pricedRowCount = arr(model.price.pricedRows).filter(function (row) { return row.unitPrice != null && row.totalPrice != null; }).length;
    model.totals.missingPriceCount = arr(model.price.missingPrices).length;
    model.totals.skippedPriceCount = model.skippedItems.length;
    model.completeness.eligibleCount = model.totals.eligiblePriceCount;
    model.completeness.pricedCount = model.totals.pricedRowCount;
    model.completeness.missingCount = model.totals.missingPriceCount;
    model.completeness.score = model.totals.eligiblePriceCount ? Math.round((model.totals.pricedRowCount / model.totals.eligiblePriceCount) * 100) : 0;
    if (model.status !== "invalid" && model.status !== "blocked") {
      model.status = model.price.errors.length ? "invalid" : (model.totals.eligiblePriceCount > 0 && model.totals.missingPriceCount === 0 && model.totals.pricedRowCount === model.totals.eligiblePriceCount && model.price.canTotal === true ? "complete" : "partial");
    }
    return model;
  }

  const api = { buildRequest: buildRequest, price: price, calculate: price, validateConsumption: validateConsumption, classifyConsumption: classifyConsumption, mapConsumptionToBudgetRow: mapConsumptionToBudgetRow, getVersion: function () { return VERSION; } };
  root.ResidentialConsumptionPriceAdapter = api;
  root.EloResidentialConsumptionPriceAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
