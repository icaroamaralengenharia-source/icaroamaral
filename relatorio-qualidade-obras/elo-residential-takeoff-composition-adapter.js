(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_quantity_takeoff";
  const OUTPUT_SCHEMA = "elo.residential_takeoff_composition_resolution";
  const SUPPORTED_UNITS = { m: true, m2: true, m3: true, un: true };
  const OFFICIAL_SOURCES = { SINAPI: true, ORSE: true, SICRO: true };
  const MAPPINGS = [
    ["FLOOR_AREA_TOTAL", "FLOORS", "execucao de piso ou acabamento de piso", "m2", ["piso", "acabamento de piso", "revestimento de piso"]],
    ["CEILING_AREA_TOTAL", "CEILINGS", "acabamento ou pintura de teto", "m2", ["teto", "acabamento de teto", "pintura de teto"]],
    ["WALL_GROSS_AREA_TOTAL", "MASONRY", "alvenaria ou tratamento de parede", "m2", ["parede", "alvenaria", "tratamento de parede"]],
    ["WALL_NET_AREA_TOTAL", "MASONRY", "revestimento ou pintura de parede", "m2", ["parede", "revestimento de parede", "pintura de parede"]],
    ["DOOR_COUNT", "OPENINGS", "instalacao de porta", "un", ["porta", "instalacao de porta"]],
    ["WINDOW_COUNT", "OPENINGS", "instalacao de janela", "un", ["janela", "instalacao de janela"]],
    ["DOOR_AREA_TOTAL", "OPENINGS", "esquadria de porta por area", "m2", ["porta", "esquadria de porta"]],
    ["WINDOW_AREA_TOTAL", "OPENINGS", "esquadria de janela por area", "m2", ["janela", "esquadria de janela"]],
    ["FINAL_CLEANING_AREA", "FINAL_CLEANING", "limpeza final", "m2", ["limpeza final", "limpeza de obra"]],
    ["INTERNAL_PAINTING_BASE_AREA", "PAINTING", "pintura interna de paredes", "m2", ["pintura interna", "pintura de paredes"]],
    ["CEILING_PAINTING_BASE_AREA", "PAINTING", "pintura de teto", "m2", ["pintura de teto", "teto"]],
    ["FLOOR_FINISH_BASE_AREA", "FLOORS", "revestimento de piso", "m2", ["revestimento de piso", "acabamento de piso"]],
    ["WALL_FINISH_BASE_AREA", "WALL_FINISHES", "revestimento de parede", "m2", ["revestimento de parede", "acabamento de parede"]]
  ];
  const MAP_BY_CODE = MAPPINGS.reduce(function (acc, entry) {
    acc[entry[0]] = { takeoffCode: entry[0], discipline: entry[1], serviceName: entry[2], unit: entry[3], terms: entry[4].slice() };
    return acc;
  }, {});
  const FORBIDDEN_FIELDS = ["consumption", "inputs", "materials", "unitPrice", "totalPrice", "cost", "subtotal", "BDI", "bdi", "totalBudget", "budgetDocumentData", "pdfAction"];

  function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function clone(value) {
    if (Array.isArray(value)) return value.map(clone);
    if (isObject(value)) return Object.keys(value).reduce(function (acc, key) { acc[key] = clone(value[key]); return acc; }, {});
    return value;
  }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
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
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return "fp_" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function makeIssue(code, reason) { return { code: code, reason: reason }; }
  function baseCode(code) {
    const text = clean(code);
    if (MAP_BY_CODE[text]) return text;
    const match = text.match(/^(FLOOR_AREA_ROOM|CEILING_AREA_ROOM|WALL_GROSS_AREA_ROOM|WALL_NET_AREA_ROOM|ROOM_PERIMETER|ROOM_VOLUME)(?:_|$)/);
    return match ? match[1] : text;
  }
  function makeSkipped(item, classification, reasonCode, reason) {
    return {
      takeoffItemId: item && item.id || null,
      takeoffCode: item && item.code || null,
      classification: classification,
      reasonCode: reasonCode,
      reason: reason,
      originalStatus: item && item.status || null,
      unit: item && item.unit || null,
      quantity: item && item.quantity == null ? null : item && item.quantity
    };
  }
  function validateTakeoff(takeoff) {
    const errors = [];
    if (!isObject(takeoff)) errors.push(makeIssue("invalid_input", "Input deve ser objeto canonico de quantitativos."));
    if (isObject(takeoff) && takeoff.schema !== INPUT_SCHEMA) errors.push(makeIssue("invalid_schema", "Schema incompativel."));
    if (isObject(takeoff) && takeoff.status === "invalid") errors.push(makeIssue("invalid_takeoff_status", "Takeoff de origem esta invalido."));
    if (isObject(takeoff) && !Array.isArray(takeoff.items)) errors.push(makeIssue("missing_items", "Lista de itens ausente."));
    return { valid: errors.length === 0, status: errors.length ? "invalid" : "valid", errors: errors };
  }
  function hasForbiddenPayload(item) {
    return FORBIDDEN_FIELDS.some(function (field) { return Object.prototype.hasOwnProperty.call(item || {}, field); });
  }
  function classifyItem(item, options) {
    const settings = options || {};
    const status = item && item.status;
    const mapping = item && MAP_BY_CODE[item.code];
    const src = item && item.source;
    if (!isObject(item)) return makeSkipped({}, "invalid", "item_invalid", "Item nao e objeto valido.");
    if (status === "pending") return makeSkipped(item, "skipped", "item_pending", "Item pendente nao deve ser enviado ao resolvedor.");
    if (status === "blocked") return makeSkipped(item, "blocked", "item_blocked", "Item bloqueado nao deve ser enviado ao resolvedor.");
    if (status === "invalid") return makeSkipped(item, "invalid", "item_invalid", "Item invalido nao deve ser enviado ao resolvedor.");
    if (status !== "quantified") return makeSkipped(item, "skipped", "item_invalid", "Status nao elegivel para composicao.");
    if (!finite(item.quantity)) return makeSkipped(item, "invalid", "invalid_quantity", "Quantidade invalida, NaN ou infinita.");
    if (item.quantity < 0) return makeSkipped(item, "invalid", "invalid_quantity", "Quantidade negativa.");
    if (item.quantity === 0) return makeSkipped(item, "skipped", "zero_quantity", "Quantidade zero.");
    if (!SUPPORTED_UNITS[item.unit]) return makeSkipped(item, "skipped", "unsupported_unit", "Unidade nao suportada pelo adaptador.");
    if (hasForbiddenPayload(item) || /material|insumo/i.test(clean(item.type) + " " + clean(item.code))) return makeSkipped(item, "blocked", "material_item_forbidden", "Item de material ou insumo e proibido nesta fase.");
    if (/preco|price|custo|cost/i.test(clean(item.code))) return makeSkipped(item, "blocked", "cost_item_forbidden", "Item de preco ou custo e proibido nesta fase.");
    if (/bdi/i.test(clean(item.code))) return makeSkipped(item, "blocked", "cost_item_forbidden", "BDI e proibido nesta fase.");
    if (!mapping) return makeSkipped(item, "skipped", "missing_mapping", "Codigo de takeoff sem mapeamento declarativo.");
    if (item.unit !== mapping.unit) return makeSkipped(item, "skipped", "unsupported_unit", "Unidade diferente da unidade esperada pelo mapeamento.");
    if (arr(item.errors).length || arr(item.blockingFields).length) return makeSkipped(item, "blocked", "item_blocked", "Item possui erros ou bloqueadores.");
    if (arr(item.assumptions).concat(arr(item.warnings).map(function (w) { return w && (w.message || w.code); })).some(function (value) { return /executivo|pending|pendente/i.test(clean(value)); })) {
      return makeSkipped(item, "blocked", "executive_project_required", "Item depende de projeto executivo ausente.");
    }
    if (item.aggregationRole === "detail" && settings.hasTotalForCode) return makeSkipped(item, "skipped", "detail_duplicate", "Item de detalhe duplicado por total equivalente.");
    if (item.aggregationRole && item.aggregationRole !== "total" && item.aggregationRole !== "independent") return makeSkipped(item, "skipped", "detail_duplicate", "Apenas totais ou independentes sao enviados.");
    if (!isObject(src)) return makeSkipped(item, "skipped", "missing_source", "Fonte geometrica ausente.");
    if (!src.geometryPath) return makeSkipped(item, "skipped", "missing_geometry_reference", "Caminho geometrico ausente.");
    return { classification: "eligible", reasonCode: "eligible", reason: "Item apto para consulta de composicao.", mapping: clone(mapping) };
  }
  function makeRequestId(item) { return "rtc-" + normalize(item.code + "-" + item.id).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""); }
  function mapItemToResolverInput(item, context) {
    const mapping = (context && context.mapping) || MAP_BY_CODE[item.code];
    const source = item.source || {};
    const requestId = makeRequestId(item);
    return {
      id: requestId,
      requestId: requestId,
      takeoffItemId: item.id,
      takeoffCode: item.code,
      etapaId: normalize(mapping.discipline).replace(/[^a-z0-9]+/g, "_") || "residential_takeoff",
      nome: mapping.serviceName,
      disciplina: mapping.discipline,
      unidadeEsperada: mapping.unit,
      termosBusca: mapping.terms.slice(),
      obrigatorio: true,
      pendencias: [],
      bloqueadores: [],
      quantity: item.quantity,
      unit: item.unit,
      query: {
        serviceName: mapping.serviceName,
        description: mapping.serviceName + " - " + item.name,
        unit: mapping.unit,
        quantity: item.quantity,
        qualifiers: { roomType: null, internalExternal: null, finishType: null, wallType: null, floorType: null, openingType: null, constructionStandard: null }
      },
      source: { geometryPath: source.geometryPath || null, roomIds: arr(source.roomIds).slice(), floorIds: arr(source.floorIds).slice(), openingIds: arr(source.openingIds).slice() },
      constraints: { acceptedUnits: [mapping.unit], requireOfficialSource: true, minimumConfidence: context && context.minimumConfidence || null, allowApproximateMatch: false }
    };
  }
  function buildRequest(takeoff, options) {
    const validation = validateTakeoff(takeoff);
    const items = arr(takeoff && takeoff.items);
    const requestItems = [];
    const skippedItems = [];
    const mappings = [];
    const totalCodes = items.reduce(function (acc, item) { if (item && item.aggregationRole === "total") acc[item.code] = true; return acc; }, {});
    if (!validation.valid) {
      return { status: "invalid", items: [], skippedItems: items.map(function (item) { return makeSkipped(item, "invalid", "item_invalid", "Takeoff invalido."); }), mappings: [], errors: validation.errors };
    }
    items.forEach(function (item) {
      const totalEquivalent = totalCodes[baseCode(item.code || "") + "_TOTAL"] || false;
      const classified = classifyItem(item, { hasTotalForCode: totalEquivalent, minimumConfidence: options && options.minimumConfidence });
      if (classified.classification === "eligible") {
        const request = mapItemToResolverInput(item, { mapping: classified.mapping, minimumConfidence: options && options.minimumConfidence });
        requestItems.push(request);
        mappings.push({ takeoffCode: item.code, requestId: request.requestId, serviceName: classified.mapping.serviceName, unit: classified.mapping.unit });
      } else {
        skippedItems.push(classified);
      }
    });
    return {
      status: requestItems.length ? "ready" : "blocked",
      itemCount: items.length,
      eligibleCount: requestItems.length,
      skippedCount: skippedItems.filter(function (item) { return item.classification === "skipped"; }).length,
      blockedCount: skippedItems.filter(function (item) { return item.classification === "blocked" || item.classification === "invalid"; }).length,
      items: requestItems,
      skippedItems: skippedItems,
      mappings: mappings,
      errors: []
    };
  }
  function emptyModel(takeoff, options) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      sourceTakeoff: { schema: takeoff && takeoff.schema || null, version: takeoff && takeoff.version || null, inputFingerprint: takeoff && takeoff.audit && takeoff.audit.inputFingerprint || null, takeoffFingerprint: takeoff && takeoff.audit && takeoff.audit.takeoffFingerprint || null },
      request: { itemCount: 0, eligibleCount: 0, skippedCount: 0, blockedCount: 0, items: [] },
      resolution: { resolved: [], unresolved: [], rejected: [], errors: [] },
      skippedItems: [],
      mappings: [],
      totals: { inputItemCount: 0, eligibleItemCount: 0, resolvedItemCount: 0, unresolvedItemCount: 0, rejectedItemCount: 0, skippedItemCount: 0, blockedItemCount: 0 },
      warnings: [],
      errors: [],
      blockingFields: [],
      completeness: { score: 0, eligibleCount: 0, resolvedCount: 0, unresolvedCount: 0 },
      audit: { generatedAt: options && options.generatedAt || new Date().toISOString(), source: "ResidentialTakeoffCompositionAdapter", inputFingerprint: fingerprint(takeoff || null), requestFingerprint: null, resolutionFingerprint: null }
    };
  }
  function compositionOf(entry) { return entry && (entry.composicaoSelecionada || entry.composition || entry.composicao || entry.candidate) || null; }
  function compField(comp, names) {
    for (let i = 0; i < names.length; i += 1) if (comp && comp[names[i]] != null && clean(comp[names[i]])) return comp[names[i]];
    return null;
  }
  function compositionInputs(comp) { return arr(comp && (comp.inputs || comp.materials || comp.insumos)).map(function (input) {
    return {
      code: compField(input, ["code", "id", "inputCode", "codigo"]),
      description: compField(input, ["description", "name", "material", "inputName", "nome"]),
      name: compField(input, ["name", "description", "material", "inputName", "nome"]),
      type: compField(input, ["type", "tipo", "inputType"]) || "material",
      unit: compField(input, ["unit", "inputUnit", "coefficientUnit", "unidade"]),
      coefficient: input && (input.coefficient !== undefined ? input.coefficient : input.quantityPerUnit)
    };
  }); }
  function normalizeOneResolverEntry(entry, request, statusHint, options) {
    const comp = compositionOf(entry);
    const result = {
      takeoffItemId: request.takeoffItemId,
      requestId: request.requestId,
      quantity: request.quantity,
      unit: request.unit,
      composition: {
        code: compField(comp, ["code", "id", "compositionCode", "codigo"]),
        description: compField(comp, ["description", "name", "service", "compositionName", "nome"]),
        unit: compField(comp, ["unit", "productionUnit", "compositionUnit", "unidade"]),
        source: compField(comp, ["source", "base", "provider"]),
        confidence: entry && entry.confianca != null ? Number(entry.confianca) : (comp && comp.score != null ? Number(comp.score) : null),
        referenceMonth: compField(comp, ["referenceMonth", "mesReferencia", "dataBase"]),
        state: compField(comp, ["state", "uf"]),
        inputs: compositionInputs(comp)
      },
      compatibility: { unitMatch: false, quantityAccepted: request.quantity === entry.quantity || entry.quantity == null, confidenceAccepted: false, sourceAccepted: false },
      status: statusHint || "unresolved",
      warnings: [],
      errors: [],
      trace: { takeoffCode: request.takeoffCode, geometryPath: request.source.geometryPath, roomIds: request.source.roomIds.slice(), floorIds: request.source.floorIds.slice(), openingIds: request.source.openingIds.slice(), resolverReason: entry && (entry.motivoEscolha || entry.reason) || null }
    };
    const minConfidence = options && options.minimumConfidence != null ? Number(options.minimumConfidence) : 0.55;
    result.compatibility.unitMatch = clean(result.composition.unit) === clean(request.unit);
    result.compatibility.confidenceAccepted = result.composition.confidence == null ? true : result.composition.confidence >= minConfidence;
    result.compatibility.sourceAccepted = !(request.constraints && request.constraints.requireOfficialSource) || !!OFFICIAL_SOURCES[clean(result.composition.source).toUpperCase()] || comp && comp.isOfficial === true;
    if (!comp) { result.status = "unresolved"; result.errors.push({ code: "missing_composition", message: "Resolvedor nao retornou composicao." }); return result; }
    if (!result.composition.code) { result.status = "rejected"; result.errors.push({ code: "missing_composition_code", message: "Composicao sem codigo." }); }
    if (!result.composition.description) { result.status = "rejected"; result.errors.push({ code: "missing_composition_description", message: "Composicao sem descricao." }); }
    if (!result.compatibility.unitMatch) { result.status = "rejected"; result.errors.push({ code: "unit_mismatch", message: "Unidade incompat�vel." }); }
    if (!result.compatibility.confidenceAccepted) { result.status = "rejected"; result.errors.push({ code: "low_confidence", message: "Confianca abaixo do minimo." }); }
    if (!result.compatibility.sourceAccepted) { result.status = "rejected"; result.errors.push({ code: "unofficial_source", message: "Origem oficial nao comprovada." }); }
    if (result.status !== "rejected" && statusHint !== "unresolved") result.status = "resolved";
    return result;
  }
  function normalizeResolverResult(result, request, options) {
    const normalized = { resolved: [], unresolved: [], rejected: [], errors: [] };
    if (!isObject(result)) {
      normalized.errors.push({ code: "invalid_resolver_result", message: "Resolvedor retornou formato invalido." });
      arr(request && request.items).forEach(function (item) { normalized.unresolved.push(normalizeOneResolverEntry({}, item, "unresolved", options)); });
      return normalized;
    }
    const byRequest = arr(request && request.items).reduce(function (acc, item) { acc[item.requestId] = item; acc[item.id] = item; return acc; }, {});
    function findRequest(entry) { return byRequest[entry && (entry.eapItemId || entry.requestId || entry.id)] || byRequest[entry && entry.takeoffItemId] || null; }
    arr(result.resolvedItems || result.resolved).forEach(function (entry) {
      const req = findRequest(entry);
      if (!req) { normalized.errors.push({ code: "unmatched_resolver_item", message: "Resultado sem request correspondente." }); return; }
      const one = normalizeOneResolverEntry(entry, req, "resolved", options);
      if (one.status === "resolved") normalized.resolved.push(one); else normalized.rejected.push(one);
    });
    arr(result.unresolvedItems || result.unresolved || result.rejected).forEach(function (entry) {
      const req = findRequest(entry);
      if (!req) { normalized.errors.push({ code: "unmatched_resolver_item", message: "Resultado sem request correspondente." }); return; }
      normalized.unresolved.push(normalizeOneResolverEntry(entry, req, "unresolved", options));
    });
    arr(request && request.items).forEach(function (req) {
      const found = normalized.resolved.concat(normalized.unresolved, normalized.rejected).some(function (entry) { return entry.requestId === req.requestId; });
      if (!found) normalized.unresolved.push(normalizeOneResolverEntry({}, req, "unresolved", options));
    });
    return normalized;
  }
  function callResolver(request, options) {
    const settings = options || {};
    try {
      if (typeof settings.resolveItem === "function") {
        return { result: { resolved: request.items.map(function (item) { return settings.resolveItem(clone(item)); }) } };
      }
      if (settings.resolver && typeof settings.resolver.resolveItem === "function") {
        return { result: { resolved: request.items.map(function (item) { return settings.resolver.resolveItem(clone(item)); }) } };
      }
      if (settings.resolver && typeof settings.resolver.resolveEloEapCompositions === "function") {
        return { result: settings.resolver.resolveEloEapCompositions({ eap: { bloqueadores: [], itens: request.items.map(clone) }, compositionSearchEngine: settings.compositionSearchEngine || null, maxCandidates: settings.maxCandidates, scopePreferences: settings.scopePreferences || {} }) };
      }
    } catch (error) {
      return { error: { code: "resolver_exception", message: error && error.message || "Erro controlado ao chamar resolvedor." } };
    }
    return { error: { code: "resolver_unavailable", message: "Resolvedor compativel nao foi fornecido por injecao." } };
  }
  function resolve(takeoff, options) {
    const settings = options || {};
    const model = emptyModel(takeoff, settings);
    const request = buildRequest(takeoff, settings);
    model.request = { itemCount: request.itemCount || 0, eligibleCount: request.eligibleCount || 0, skippedCount: request.skippedCount || 0, blockedCount: request.blockedCount || 0, items: clone(request.items || []) };
    model.skippedItems = clone(request.skippedItems || []);
    model.mappings = clone(request.mappings || []);
    model.audit.requestFingerprint = fingerprint(model.request);
    if (request.status === "invalid") {
      model.status = "invalid";
      model.errors = request.errors.slice();
    } else if (!request.items.length) {
      model.status = "blocked";
      model.blockingFields.push("request.items");
      model.warnings.push({ code: "no_eligible_items", message: "Nenhum item apto para resolver composicao." });
    } else {
      const called = callResolver(request, settings);
      if (called.error) {
        model.status = "blocked";
        model.blockingFields.push("options.resolver");
        model.resolution.errors.push(called.error);
      } else {
        try {
          model.resolution = normalizeResolverResult(called.result, request, settings);
          model.resolutionContext = clone(called.result && called.result.resolutionContext || { scopePreferences: settings.scopePreferences || {} });
        } catch (error) {
          model.status = "invalid";
          model.errors.push({ code: "resolver_result_exception", message: error && error.message || "Erro ao normalizar resposta do resolvedor." });
        }
      }
    }
    model.audit.resolutionFingerprint = fingerprint(model.resolution);
    model.totals.inputItemCount = arr(takeoff && takeoff.items).length;
    model.totals.eligibleItemCount = model.request.eligibleCount;
    model.totals.resolvedItemCount = model.resolution.resolved.length;
    model.totals.unresolvedItemCount = model.resolution.unresolved.length;
    model.totals.rejectedItemCount = model.resolution.rejected.length;
    model.totals.skippedItemCount = model.skippedItems.filter(function (item) { return item.classification === "skipped"; }).length;
    model.totals.blockedItemCount = model.skippedItems.filter(function (item) { return item.classification === "blocked" || item.classification === "invalid"; }).length;
    model.completeness.eligibleCount = model.totals.eligibleItemCount;
    model.completeness.resolvedCount = model.totals.resolvedItemCount;
    model.completeness.unresolvedCount = model.totals.unresolvedItemCount + model.totals.rejectedItemCount;
    model.completeness.score = model.totals.eligibleItemCount ? Math.round((model.totals.resolvedItemCount / model.totals.eligibleItemCount) * 100) : 0;
    if (model.status !== "invalid" && model.status !== "blocked") {
      model.status = model.errors.length || model.resolution.errors.length ? "invalid" : (model.blockingFields.length ? "blocked" : (model.totals.eligibleItemCount > 0 && model.totals.resolvedItemCount === model.totals.eligibleItemCount && model.totals.unresolvedItemCount === 0 && model.totals.rejectedItemCount === 0 ? "complete" : "partial"));
    }
    return model;
  }
  function getSupportedMappings() { return MAPPINGS.map(function (entry) { return clone(MAP_BY_CODE[entry[0]]); }); }
  const api = { buildRequest: buildRequest, resolve: resolve, validateTakeoff: validateTakeoff, classifyItem: classifyItem, mapItemToResolverInput: mapItemToResolverInput, normalizeResolverResult: normalizeResolverResult, getSupportedMappings: getSupportedMappings, getVersion: function () { return VERSION; } };
  root.ResidentialTakeoffCompositionAdapter = api;
  root.EloResidentialTakeoffCompositionAdapter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
