(function (root) {
  "use strict";

  const VERSION = "20260624-composition-search-v2-real-index";
  const DEFAULT_LIMIT = 8;
  const SYNONYMS = [
    ["telhado", ["cobertura"]],
    ["telha portuguesa", ["telha ceramica portuguesa"]],
    ["telha colonial", ["telha ceramica colonial"]],
    ["piso ceramico", ["revestimento ceramico"]],
    ["assentar piso", ["revestimento ceramico"]],
    ["porcelanato", ["revestimento porcelanato"]],
    ["reboco", ["emboco", "massa unica"]],
    ["parede", ["alvenaria"]],
    ["bloco baiano", ["bloco ceramico"]],
    ["bloco ceramico baiano", ["bloco ceramico"]],
    ["contrapiso", ["regularizacao", "piso cimentado"]],
    ["cimento", ["cimento portland"]],
    ["areia", ["areia media"]],
    ["brita", ["pedra britada"]],
    ["laje", ["concreto", "laje"]],
    ["sapata", ["fundacao", "sapata"]],
    ["impermeabilizante", ["impermeabilizacao"]],
    ["pintura", ["aplicacao de tinta"]],
    ["rejunte", ["rejuntamento"]],
    ["argamassa", ["argamassa"]],
    ["ac ii", ["argamassa colante ac ii"]],
    ["ac iii", ["argamassa colante ac iii"]],
    ["saco", ["cimento portland", "argamassa"]],
    ["sacos", ["cimento portland", "argamassa"]]
  ];
  const STOPWORDS = { a: 1, o: 1, os: 1, as: 1, de: 1, da: 1, do: 1, das: 1, dos: 1, para: 1, com: 1, sem: 1, em: 1, no: 1, na: 1, nos: 1, nas: 1, um: 1, uma: 1, que: 1, quero: 1, vou: 1, fazer: 1, saber: 1, preciso: 1, quantos: 1, quantas: 1, quanto: 1, material: 1, materiais: 1, chao: 1, m2: 1, m3: 1, un: 1, und: 1, kg: 1, l: 1, m: 1 };
  let cachedIndex = null;

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value)
      .replace(/m[²2]/gi, "m2")
      .replace(/m[³3]/gi, "m3")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/\bxapisco\b/g, "chapisco")
      .replace(/\brebocu\b/g, "reboco")
      .replace(/\bparedi\b/g, "parede")
      .replace(/\bbloko\b/g, "bloco")
      .replace(/\bqnto\b/g, "quanto")
      .replace(/\bqtos\b/g, "quantos")
      .replace(/\bpresiso\b/g, "preciso")
      .replace(/\bfaze\b/g, "fazer")
      .replace(/\bac2\b/g, "ac ii")
      .replace(/\bac iii\b/g, "ac iii")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function singularToken(token) {
    const value = normalize(token);
    if (value.length <= 3) return value;
    if (/coes$/.test(value)) return value.replace(/coes$/, "cao");
    if (/oes$/.test(value)) return value.replace(/oes$/, "ao");
    if (/ais$/.test(value)) return value.replace(/ais$/, "al");
    if (/eis$/.test(value)) return value.replace(/eis$/, "el");
    if (/s$/.test(value) && !/ss$/.test(value)) return value.slice(0, -1);
    return value;
  }

  function tokenize(value) {
    const seen = {};
    return normalize(value).split(" ").map(singularToken).filter(function (token) {
      if (!token || token.length < 2 || STOPWORDS[token] || seen[token]) return false;
      seen[token] = 1;
      return true;
    });
  }

  function normalizeUnit(value) {
    const text = normalize(value);
    if (/^(m2|metro quadrado|metros quadrado)$/.test(text)) return "m2";
    if (/^(m3|metro cubico|metros cubico)$/.test(text)) return "m3";
    if (/^(m|metro)$/.test(text)) return "m";
    if (/^(un|und|unidade)$/.test(text)) return "un";
    if (/^(kg|quilo)$/.test(text)) return "kg";
    if (/^(l|litro)$/.test(text)) return "l";
    return text;
  }

  function expandQuery(query, options) {
    const settings = options || {};
    const raw = [query, settings.service, settings.normalizedService, settings.material, settings.context, settings.unit, settings.quantity].filter(Boolean).join(" ");
    const normalized = normalize(raw);
    const expansions = [];
    SYNONYMS.forEach(function (entry) {
      if (normalized.indexOf(normalize(entry[0])) >= 0) {
        entry[1].forEach(function (term) { expansions.push(term); });
      }
    });
    const normalizedQuery = normalize([raw].concat(expansions).join(" "));
    return { raw: clean(query), normalizedQuery: normalizedQuery, expansions: expansions, terms: tokenize(normalizedQuery) };
  }

  function inputsOf(composition) {
    return composition && (composition.inputs || composition.materials || composition.insumos || []) || [];
  }

  function field(composition, names) {
    for (let index = 0; index < names.length; index += 1) {
      const value = composition && composition[names[index]];
      if (value !== undefined && value !== null && clean(value)) return value;
    }
    return "";
  }

  function codeOf(composition) { return clean(field(composition, ["code", "id", "compositionCode", "codigo"])); }
  function descriptionOf(composition) { return clean(field(composition, ["description", "name", "service", "compositionName", "nome"])); }
  function sourceOf(composition) { return clean(field(composition, ["source", "sourceName", "base", "provider"])) || "base oficial"; }
  function unitOf(composition) { return normalizeUnit(field(composition, ["unit", "productionUnit", "compositionUnit", "unidade"])); }

  function isOfficialComposition(engine, composition) {
    if (!composition) return false;
    const metadata = composition.metadata || {};
    const source = normalize(sourceOf(composition));
    return (engine && typeof engine.isRealComposition === "function" && engine.isRealComposition(composition)) ||
      composition.isOfficial === true || composition.isRealComposition === true || metadata.isRealComposition === true || /sinapi|orse/.test(source);
  }

  function collectEntries(options) {
    const settings = options || {};
    const engine = settings.engine || root.StockAiCompositionEngine || null;
    const list = [];
    function add(items, location) {
      (items || []).forEach(function (item) {
        if (isOfficialComposition(engine, item)) list.push({ composition: item, location: location });
      });
    }
    add(settings.compositions, "options.compositions");
    if (engine) {
      if (typeof engine.getImportedOfficialBaseCatalog === "function") add(engine.getImportedOfficialBaseCatalog(), "StockAiCompositionEngine.importedOfficialBaseCatalog");
      if (typeof engine.getExternalCompositionCatalog === "function") add(engine.getExternalCompositionCatalog(), "StockAiCompositionEngine.externalCompositionCatalog");
      if (typeof engine.getCompositions === "function") add(engine.getCompositions(), "StockAiCompositionEngine.getCompositions");
    }
    const seen = {};
    return list.filter(function (entry) {
      const key = [sourceOf(entry.composition), codeOf(entry.composition), descriptionOf(entry.composition), unitOf(entry.composition)].map(normalize).join("|");
      if (!key || seen[key]) return false;
      seen[key] = 1;
      return true;
    });
  }

  function signature(entries) {
    return (entries || []).map(function (entry) {
      const composition = entry.composition;
      return [entry.location, sourceOf(composition), codeOf(composition), unitOf(composition), inputsOf(composition).length].join(":");
    }).join("|");
  }

  function locations(entries) {
    const seen = {};
    return (entries || []).map(function (entry) { return entry.location; }).filter(function (location) {
      if (!location || seen[location]) return false;
      seen[location] = 1;
      return true;
    });
  }

  function tokenSet(value) {
    const set = {};
    tokenize(value).forEach(function (token) { set[token] = 1; });
    return set;
  }
  function buildIndex(options) {
    const settings = options || {};
    if (cachedIndex && !settings.compositions && !settings.engine) {
      return Object.assign({}, cachedIndex, { indexDurationMs: 0, fromCache: true });
    }
    const startedAt = Date.now();
    const entries = collectEntries(settings);
    const key = signature(entries);
    if (cachedIndex && cachedIndex.key === key) {
      return Object.assign({}, cachedIndex, { indexDurationMs: 0, fromCache: true });
    }
    const uniqueInputs = {};
    let totalInputs = 0;
    const tokenIndex = {};
    const items = entries.map(function (entry, itemIndex) {
      const composition = entry.composition;
      const inputs = inputsOf(composition);
      totalInputs += inputs.length;
      const inputsText = normalize(inputs.map(function (input) {
        const inputKey = clean(input.code || input.id || input.name || input.description || input.material);
        if (inputKey) uniqueInputs[inputKey] = 1;
        return [input.code, input.name, input.description, input.material, input.unit].join(" ");
      }).join(" "));
      const description = normalize(descriptionOf(composition));
      const haystack = normalize([codeOf(composition), descriptionOf(composition), field(composition, ["serviceType", "category", "classe"]), unitOf(composition), sourceOf(composition), inputsText].join(" "));
      const haystackTokens = tokenSet(haystack);
      Object.keys(haystackTokens).forEach(function (token) {
        if (!tokenIndex[token]) tokenIndex[token] = [];
        tokenIndex[token].push(itemIndex);
      });
      return {
        entry: entry,
        code: normalize(codeOf(composition)),
        description: description,
        inputsText: inputsText,
        haystack: haystack,
        descriptionTokens: tokenSet(description),
        inputsTokens: tokenSet(inputsText),
        haystackTokens: haystackTokens,
        unit: unitOf(composition)
      };
    });
    cachedIndex = {
      key: key,
      items: items,
      tokenIndex: tokenIndex,
      totalCompositions: entries.length,
      totalInputs: totalInputs,
      uniqueInputs: Object.keys(uniqueInputs).length,
      baseLocations: locations(entries),
      indexDurationMs: Date.now() - startedAt,
      fromCache: false
    };
    return cachedIndex;
  }

  function hasToken(tokenSetObject, token) {
    return !!(tokenSetObject && tokenSetObject[singularToken(token)]);
  }

  function scoreIndexed(indexed, expanded, options) {
    const composition = indexed.entry.composition;
    const requestedUnit = normalizeUnit((options || {}).unit || "");
    let raw = 0;
    const reasons = [];
    if (indexed.code && expanded.normalizedQuery === indexed.code) {
      raw += 120;
      reasons.push("bateu codigo oficial " + codeOf(composition));
    } else if (indexed.code && expanded.normalizedQuery.indexOf(indexed.code) >= 0) {
      raw += 90;
      reasons.push("bateu codigo oficial " + codeOf(composition));
    }
    expanded.expansions.forEach(function (term) {
      const normalizedTerm = normalize(term);
      if (indexed.description.indexOf(normalizedTerm) >= 0) {
        raw += 28;
        reasons.push("bateu sinonimo tecnico " + term + " na descricao");
      } else if (indexed.inputsText.indexOf(normalizedTerm) >= 0) {
        raw += 8;
        reasons.push("bateu sinonimo tecnico " + term + " nos insumos");
      } else if (indexed.haystack.indexOf(normalizedTerm) >= 0) {
        raw += 5;
        reasons.push("bateu sinonimo tecnico " + term);
      }
    });
    expanded.terms.forEach(function (term) {
      if (hasToken(indexed.descriptionTokens, term)) {
        raw += 14;
        reasons.push("bateu termo " + term + " na descricao");
      } else if (hasToken(indexed.inputsTokens, term)) {
        raw += 8;
        reasons.push("bateu termo " + term + " nos insumos");
      } else if (hasToken(indexed.haystackTokens, term)) {
        raw += 5;
        reasons.push("bateu termo " + term);
      }
    });
    if (raw > 0 && requestedUnit && indexed.unit && requestedUnit === indexed.unit) {
      raw += 16;
      reasons.push("unidade compativel " + indexed.unit);
    }
    if (raw > 0 && requestedUnit && indexed.unit && requestedUnit !== indexed.unit) raw -= 12;
    if (raw > 0 && /sinapi/.test(normalize(sourceOf(composition)))) raw += 3;
    if (raw > 0 && /orse/.test(normalize(sourceOf(composition)))) raw += 2;
    return { rawScore: raw, score: Math.max(0, Math.min(0.99, raw / 140)), reasons: reasons.filter(function (reason, index) { return reasons.indexOf(reason) === index; }).slice(0, 8) };
  }

  function candidate(indexed, scored) {
    const composition = indexed.entry.composition;
    return {
      code: codeOf(composition),
      description: descriptionOf(composition),
      unit: unitOf(composition),
      source: sourceOf(composition),
      score: Number(scored.score.toFixed(2)),
      reasons: scored.reasons,
      inputs: inputsOf(composition).slice(),
      composition: composition,
      indexedFrom: indexed.entry.location
    };
  }

  function collectCandidateItems(index, expanded) {
    const byIndex = {};
    const tokens = expanded.terms.concat(tokenize(expanded.expansions.join(" ")));
    tokens.forEach(function (token) {
      (index.tokenIndex[token] || []).forEach(function (itemIndex) { byIndex[itemIndex] = 1; });
    });
    const keys = Object.keys(byIndex);
    if (!keys.length) return [];
    return keys.map(function (key) { return index.items[Number(key)]; }).filter(Boolean);
  }
  function searchOfficialCompositions(query, options) {
    const startedAt = Date.now();
    const settings = options || {};
    const expanded = expandQuery(query, settings);
    const index = buildIndex(settings);
    const candidateItems = collectCandidateItems(index, expanded);
    const ranked = candidateItems.map(function (indexed) {
      return { indexed: indexed, scored: scoreIndexed(indexed, expanded, settings) };
    }).filter(function (item) {
      return item.scored.rawScore > 0;
    }).sort(function (a, b) {
      return b.scored.rawScore - a.scored.rawScore || codeOf(a.indexed.entry.composition).localeCompare(codeOf(b.indexed.entry.composition));
    });
    const candidates = ranked.slice(0, Number(settings.limit || DEFAULT_LIMIT) || DEFAULT_LIMIT).map(function (item) {
      return candidate(item.indexed, item.scored);
    });
    const base = {
      query: clean(query),
      normalizedQuery: expanded.normalizedQuery,
      searchedTerms: expanded.terms,
      indexedCount: index.totalCompositions,
      indexedInputCount: index.totalInputs,
      indexedUniqueInputCount: index.uniqueInputs,
      baseLocations: index.baseLocations,
      indexDurationMs: index.indexDurationMs,
      searchDurationMs: Date.now() - startedAt
    };
    if (!candidates.length) return Object.assign(base, { found: false, reason: "no_official_composition_found" });
    return Object.assign(base, { found: true, candidates: candidates });
  }

  function getIndexStats(options) {
    const index = buildIndex(options || {});
    return {
      version: VERSION,
      totalCompositions: index.totalCompositions,
      totalInputs: index.totalInputs,
      uniqueInputs: index.uniqueInputs,
      baseLocations: index.baseLocations,
      indexDurationMs: index.indexDurationMs,
      fromCache: index.fromCache
    };
  }

  function clearIndexCache() {
    cachedIndex = null;
  }

  root.CompositionSearchEngine = {
    version: VERSION,
    synonyms: SYNONYMS.slice(),
    normalize: normalize,
    tokenize: tokenize,
    expandQuery: expandQuery,
    collectOfficialCompositions: function (options) { return collectEntries(options || {}).map(function (entry) { return entry.composition; }); },
    clearIndexCache: clearIndexCache,
    getIndexStats: getIndexStats,
    searchOfficialCompositions: searchOfficialCompositions
  };
})(typeof window !== "undefined" ? window : globalThis);




