(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_consumption_price";
  const OUTPUT_SCHEMA = "elo.residential_real_budget_package";

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

  function validatePricePackage(pricePackage) {
    const errors = [];
    if (!isObject(pricePackage)) errors.push(issue("invalid_input", "Input deve ser pacote canonico de precos residencial."));
    if (isObject(pricePackage) && pricePackage.schema !== INPUT_SCHEMA) errors.push(issue("invalid_schema", "Schema incompativel."));
    if (isObject(pricePackage) && pricePackage.status === "invalid") errors.push(issue("invalid_price_status", "Pacote de precos esta invalido."));
    if (isObject(pricePackage) && !isObject(pricePackage.price)) errors.push(issue("missing_price", "Bloco price ausente."));
    return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors: errors };
  }

  function rowIdentity(row, index) {
    const safe = row || {};
    return clean(safe.requestId || safe.takeoffItemId || safe.compositionCode || safe.serviceId || safe.rowId || "item_" + index);
  }
  function rowKeys(row) {
    const safe = row || {};
    return [safe.requestId, safe.takeoffItemId, safe.compositionCode, safe.serviceId, safe.rowId].map(clean).filter(Boolean);
  }
  function requestRows(pricePackage) { return arr(pricePackage && pricePackage.request && pricePackage.request.rows); }
  function pricedRows(pricePackage) { return arr(pricePackage && pricePackage.price && pricePackage.price.pricedRows); }
  function pricedRowsByKey(pricePackage) {
    const byKey = {};
    pricedRows(pricePackage).forEach(function (row) {
      rowKeys(row).forEach(function (key) { if (!byKey[key]) byKey[key] = row; });
    });
    return byKey;
  }
  function mergeRows(pricePackage) {
    const sourceRows = requestRows(pricePackage).length ? requestRows(pricePackage) : pricedRows(pricePackage);
    const pricesByKey = pricedRowsByKey(pricePackage);
    const seen = {};
    return sourceRows.map(function (row, index) {
      const id = rowIdentity(row, index);
      if (!id || seen[id]) return null;
      seen[id] = true;
      const priced = rowKeys(row).map(function (key) { return pricesByKey[key]; }).filter(Boolean)[0] || {};
      return { id: id, source: row || {}, priced: priced };
    }).filter(Boolean);
  }
  function buildPriceBase(pricePackage, options) {
    const base = clone(pricePackage && pricePackage.priceBase || options && options.priceBase || {});
    const prices = Object.assign({}, base.prices || {});
    pricedRows(pricePackage).forEach(function (row) {
      const code = clean(row && row.compositionCode);
      const value = number(row && row.unitPrice);
      if (code && value !== null && value > 0) prices[code] = value;
    });
    base.prices = prices;
    return base;
  }
  function validQuantity(row) {
    const qty = number(row && row.quantity);
    return qty !== null && qty > 0;
  }

  function buildRealBudgetInput(pricePackage, options) {
    const settings = options || {};
    const rows = mergeRows(pricePackage).filter(function (entry) { return validQuantity(entry.source); });
    const etapas = [{ id: "residential_pipeline", nome: "Pipeline residencial" }];
    const itens = rows.map(function (entry) {
      const source = entry.source;
      const priced = entry.priced;
      return {
        id: entry.id,
        etapaId: "residential_pipeline",
        nome: clean(source.service || source.compositionDescription || priced.service || priced.compositionDescription),
        descricao: clean(source.compositionDescription || priced.compositionDescription || source.service || priced.service),
        disciplina: clean(source.discipline || source.takeoffCode || source.traceability && source.traceability.takeoffCode || "residential_pipeline"),
        unidadeEsperada: clean(source.unit || priced.unit),
        obrigatorio: true,
        quantidadeBase: { valor: number(source.quantity), unidade: clean(source.unit || priced.unit), origem: "residential_pipeline" },
        takeoffItemId: clean(source.takeoffItemId || priced.takeoffItemId || entry.id),
        requestId: clean(source.requestId || priced.requestId || source.rowId || priced.rowId),
        compositionCode: clean(source.compositionCode || priced.compositionCode),
        source: { adapter: "ResidentialRealBudgetAdapter", rowId: clean(source.rowId), requestId: clean(source.requestId), takeoffItemId: clean(source.takeoffItemId) }
      };
    });
    const resolvedItems = rows.map(function (entry) {
      const source = entry.source;
      const priced = entry.priced;
      return {
        eapItemId: entry.id,
        confianca: number(source.confidence) != null ? number(source.confidence) : null,
        composicaoSelecionada: {
          code: clean(source.compositionCode || priced.compositionCode),
          description: clean(source.compositionDescription || priced.compositionDescription || source.service || priced.service),
          source: clean(source.compositionSource || priced.compositionSource || priced.priceSource || source.priceSource),
          unit: clean(source.unit || priced.unit)
        }
      };
    });
    const quantities = rows.map(function (entry) {
      const source = entry.source;
      return {
        eapItemId: entry.id,
        quantity: number(source.quantity),
        unit: clean(source.unit),
        source: "residential_pipeline"
      };
    });
    return {
      projectFacts: clone(settings.projectFacts || {}),
      budgetEap: { etapas: etapas, itens: itens, assumidos: arr(settings.assumptions).slice() },
      compositionResolution: { resolvedItems: resolvedItems, unresolvedItems: [] },
      quantities: quantities,
      priceBase: buildPriceBase(pricePackage, settings),
      technicalAudit: clone(settings.technicalAudit || { canGenerate: { executiveBudget: false }, blockers: [{ id: "technical_audit_required", message: "Auditoria tecnica executiva nao fornecida.", source: "technical_audit" }], assumptions: [] }),
      bdiPercent: settings.bdiPercent
    };
  }

  function emptyModel(pricePackage, options) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      featureFlag: options && options.featureFlag || "ELO_RESIDENTIAL_NEW_PIPELINE",
      sourcePrice: { schema: pricePackage && pricePackage.schema || null, version: pricePackage && pricePackage.version || null, priceFingerprint: pricePackage && pricePackage.audit && pricePackage.audit.priceFingerprint || null },
      realBudgetInput: null,
      realBudget: null,
      warnings: [],
      errors: [],
      blockingFields: [],
      audit: { generatedAt: options && options.generatedAt || new Date().toISOString(), source: "ResidentialRealBudgetAdapter", inputFingerprint: fingerprint(pricePackage || null), realBudgetInputFingerprint: null, realBudgetFingerprint: null }
    };
  }

  function callRealBudgetEngine(input, options) {
    const settings = options || {};
    try {
      if (settings.realBudgetEngine && typeof settings.realBudgetEngine.buildCompleteBudget === "function") {
        return { result: settings.realBudgetEngine.buildCompleteBudget(clone(input)) };
      }
    } catch (error) {
      return { error: { code: "real_budget_engine_error", message: error && error.message || "Erro controlado no motor de orcamento real." } };
    }
    return { error: { code: "real_budget_engine_required", message: "EloRealBudgetEngine nao foi fornecido por injecao explicita." } };
  }

  function build(pricePackage, options) {
    const settings = options || {};
    const model = emptyModel(pricePackage, settings);
    const validation = validatePricePackage(pricePackage);
    if (!validation.valid) {
      model.status = "invalid";
      model.errors = validation.errors.slice();
      return model;
    }
    model.realBudgetInput = buildRealBudgetInput(pricePackage, settings);
    model.audit.realBudgetInputFingerprint = fingerprint(model.realBudgetInput);
    if (!model.realBudgetInput.budgetEap.itens.length) {
      model.status = "blocked";
      model.blockingFields.push("realBudgetInput.budgetEap.itens");
      model.warnings.push({ code: "no_budget_items", message: "Nenhum item residencial chegou ao EloRealBudgetEngine." });
      return model;
    }
    const called = callRealBudgetEngine(model.realBudgetInput, settings);
    if (called.error) {
      model.status = "blocked";
      model.blockingFields.push("options.realBudgetEngine");
      model.errors.push(called.error);
      return model;
    }
    model.realBudget = clone(called.result || {});
    model.audit.realBudgetFingerprint = fingerprint(model.realBudget);
    model.status = model.realBudget && model.realBudget.status || "partial";
    return model;
  }

  const api = { build: build, calculate: build, buildRealBudgetInput: buildRealBudgetInput, validatePricePackage: validatePricePackage, getVersion: function () { return VERSION; } };
  root.ResidentialRealBudgetAdapter = api;
  root.EloResidentialRealBudgetAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
