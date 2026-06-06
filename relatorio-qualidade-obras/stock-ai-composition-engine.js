(function () {
  "use strict";

  const LIBRARY_VERSION = "1.6";
  const DEMO_SOURCE = "Base técnica demonstrativa/editável";
  const DEMO_WARNING = "Composição demonstrativa/editável. Validar antes de orçamento, compra oficial ou medição contratual.";
  const PURCHASE_WARNING = "Lista de compra gerada a partir de composições demonstrativas/editáveis e saldo local. Validar antes de compra oficial.";

  const REAL_SOURCE_WARNING = "Base importada: SINAPI/ORSE.";
  const DEMO_REPLACE_WARNING = "Base demonstrativa/editavel. Substitua por composicao SINAPI/ORSE para uso executivo.";
  let importedCompositionCatalog = [];
  let importedOfficialBaseCatalog = [];

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const raw = clean(value);
    let normalized = raw;
    if (raw.indexOf(".") >= 0 && raw.indexOf(",") >= 0) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else if (raw.indexOf(",") >= 0) {
      normalized = raw.replace(",", ".");
    } else if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
      normalized = raw.replace(/\./g, "");
    }
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundQuantity(value) {
    const parsed = parseNumber(value);
    return Math.round((parsed + Number.EPSILON) * 1000) / 1000;
  }

  function formatQuantity(value) {
    return roundQuantity(value).toLocaleString("pt-BR");
  }

  function normalizeUnit(unit) {
    const rawUnit = clean(unit).toLowerCase();
    if (/m\s*(2|²)|metro[s]?\s+quadrado[s]?/.test(rawUnit)) {
      return "m2";
    }
    if (/m\s*(3|³)|metro[s]?\s+cubico[s]?|metro[s]?\s+cúbico[s]?/.test(rawUnit)) {
      return "m3";
    }
    if (/^metro[s]?$/.test(rawUnit)) {
      return "m";
    }
    const normalized = normalize(unit);
    if (normalized === "m2" || normalized.indexOf("quadrado") >= 0) {
      return "m2";
    }
    if (normalized === "m3" || normalized.indexOf("cubico") >= 0) {
      return "m3";
    }
    if (normalized === "m") {
      return "m";
    }
    if (normalized === "kg" || normalized === "quilo" || normalized === "quilos") {
      return "kg";
    }
    if (normalized === "ponto" || normalized === "pontos") {
      return "un";
    }
    if (normalized === "un" || normalized === "und" || normalized === "unidade" || normalized === "unidades") {
      return "un";
    }
    return normalized || "un";
  }

  function displayUnit(unit) {
    const normalized = normalizeUnit(unit);
    if (normalized === "m2") {
      return "m²";
    }
    if (normalized === "m3") {
      return "m³";
    }
    return clean(unit) || normalized || "un";
  }

  function normalizeCompositionUnit(unit) {
    return normalizeUnit(unit);
  }

  function normalizeServiceType(description) {
    const text = normalize(description);
    if (hasAny(text, ["alvenaria", "parede", "vedacao", "vedacao"])) {
      return "alvenaria";
    }
    if (hasAny(text, ["pilar", "coluna"])) {
      return "pilar";
    }
    if (hasAny(text, ["viga", "baldrame"])) {
      return "viga";
    }
    if (hasAny(text, ["radier"])) {
      return "radier";
    }
    if (hasAny(text, ["laje"])) {
      return "laje";
    }
    if (hasAny(text, ["piso", "contrapiso"])) {
      return "piso";
    }
    if (hasAny(text, ["telhado", "cobertura", "telha"])) {
      return "cobertura";
    }
    if (hasAny(text, ["rufo", "calha", "pingadeira"])) {
      return "rufo_calha";
    }
    if (hasAny(text, ["eletroduto", "conduite"])) {
      return "eletroduto";
    }
    if (hasAny(text, ["cabo", "fio", "fiacao"])) {
      return "cabo";
    }
    if (hasAny(text, ["tubulacao", "tubo", "agua fria", "esgoto"])) {
      return "tubulacao";
    }
    return text.split(" ").slice(0, 3).join("_") || "geral";
  }

  function getCompositionSource(compositionData) {
    return clean(compositionData && compositionData.source) || DEMO_SOURCE;
  }

  function isMockComposition(compositionData) {
    const metadata = compositionData && compositionData.metadata || {};
    return !!(compositionData && (compositionData.isMock || compositionData.mockOnly || metadata.isMock || metadata.mockOnly));
  }

  function isRealComposition(compositionData) {
    if (isMockComposition(compositionData)) {
      return false;
    }
    const source = normalize(getCompositionSource(compositionData)).toUpperCase();
    return !!(compositionData && compositionData.metadata && compositionData.metadata.isRealComposition) ||
      source === "SINAPI" || source === "ORSE";
  }

  function material(name, coefficient, unit, note) {
    return {
      id: "mat_" + normalize(name).replace(/\s+/g, "_") + "_" + normalizeUnit(unit),
      name: name,
      material: name,
      quantityPerUnit: coefficient,
      coefficient: coefficient,
      unit: unit || "un",
      note: note || "Coeficiente demonstrativo/editavel."
    };
  }

  function composition(id, service, category, productionUnit, lossPercent, materials, aliases, note, options) {
    const settings = options || {};
    return {
      id: id,
      code: settings.code || id,
      service: service,
      name: service,
      category: category || "Geral",
      productionUnit: productionUnit || "un",
      unit: productionUnit || "un",
      lossPercent: lossPercent || 0,
      source: DEMO_SOURCE,
      note: note || DEMO_WARNING,
      warning: note || DEMO_WARNING,
      libraryVersion: LIBRARY_VERSION,
      requiredParameters: settings.requiredParameters || [],
      aliases: aliases || [],
      materials: materials || []
    };
  }

  function validateCompositionDetailed(compositionData) {
    const item = compositionData || {};
    const inputs = item.inputs || item.materials || [];
    const reasons = [];
    if (!clean(item.source) || !clean(item.code || item.id) || !clean(item.description || item.service || item.name)) {
      reasons.push("Campos obrigatorios ausentes: source, code e description.");
    }
    if (!["m2", "m3", "m", "un", "kg"].includes(normalizeCompositionUnit(item.unit || item.productionUnit))) {
      reasons.push("Unidade da composicao invalida ou ausente.");
    }
    if (!clean(item.serviceType) && !clean(item.description || item.service || item.name)) {
      reasons.push("serviceType ausente e description insuficiente para inferencia.");
    }
    if (!Array.isArray(inputs) || !inputs.length) {
      reasons.push("Composicao sem inputs validos.");
    }
    (Array.isArray(inputs) ? inputs : []).forEach(function (input, index) {
      const coefficientValue = input && (
        input.coefficient !== undefined ? input.coefficient :
          input.quantityPerUnit !== undefined ? input.quantityPerUnit :
            input.coeficiente
      );
      if (!clean(input && (input.name || input.material || input.descricao))) {
        reasons.push("Input " + (index + 1) + " sem name.");
      }
      if (!clean(input && (input.unit || input.unidade))) {
        reasons.push("Input " + (index + 1) + " sem unit.");
      }
      if (parseNumber(coefficientValue) <= 0) {
        reasons.push("Input " + (index + 1) + ": coefficient oficial ausente ou zerado. Preencha manualmente com o valor oficial maior que zero antes de importar.");
      }
    });
    return {
      valid: reasons.length === 0,
      reasons: reasons
    };
  }

  function validateCompositionSchema(compositionData) {
    return validateCompositionDetailed(compositionData).valid;
  }

  function hasTemplatePlaceholder(value) {
    const text = normalize(value);
    return !text ||
      text.indexOf("codigo oficial") >= 0 ||
      text.indexOf("codigo insumo oficial") >= 0 ||
      text.indexOf("descricao oficial") >= 0 ||
      text.indexOf("nome oficial do insumo") >= 0 ||
      text.indexOf("preencher") >= 0 ||
      text.indexOf("aaaa mm") >= 0 ||
      text.indexOf("yyyy mm") >= 0 ||
      text.indexOf("placeholder") >= 0;
  }

  function validateSmallRealCompositionFile(jsonData) {
    const root = Array.isArray(jsonData) ? {} : (jsonData || {});
    const rows = Array.isArray(jsonData) ? jsonData : (root.compositions || root.rows || root.items) || [];
    const rejected = [];
    const ready = [];
    rows.forEach(function (row, index) {
      const rowWithRoot = Object.assign({
        source: root.source,
        sourceRegion: root.sourceRegion || root.state || root.uf,
        sourceDate: root.sourceDate || root.referenceMonth
      }, row);
      const normalized = normalizeComposition(rowWithRoot);
      const metadata = normalized.metadata || {};
      const source = getCompositionSource(normalized);
      const sourceType = clean(rowWithRoot.sourceType || root.sourceType);
      const referenceMonth = clean(rowWithRoot.referenceMonth || root.referenceMonth);
      const state = clean(rowWithRoot.state || rowWithRoot.uf || root.state || root.uf || normalized.sourceRegion);
      const reference = clean(rowWithRoot.reference || rowWithRoot.referencia || root.reference || normalized.sourceDate);
      const rowIsOfficial = rowWithRoot.isOfficial === true || metadata.isOfficial === true;
      const reasons = validateCompositionDetailed(normalized).reasons.slice();
      if (source !== "SINAPI" && source !== "ORSE") {
        reasons.push("Fonte deve ser SINAPI ou ORSE para teste real pequeno.");
      }
      if (sourceType !== "official_manual_entry") {
        reasons.push("sourceType deve ser official_manual_entry para primeira composicao real oficial controlada.");
      }
      if (rowIsOfficial !== true) {
        reasons.push("isOfficial deve ser true para composicao oficial manual.");
      }
      if (hasTemplatePlaceholder(referenceMonth)) {
        reasons.push("referenceMonth oficial ainda e placeholder ou esta ausente.");
      }
      if (hasTemplatePlaceholder(state) || normalize(state) === "uf") {
        reasons.push("state/UF oficial ainda e placeholder ou esta ausente.");
      }
      if (hasTemplatePlaceholder(reference)) {
        reasons.push("Referencia oficial ainda e placeholder ou esta ausente.");
      }
      if (hasTemplatePlaceholder(normalized.code)) {
        reasons.push("Codigo oficial ainda e placeholder.");
      }
      if (hasTemplatePlaceholder(normalized.description)) {
        reasons.push("Descricao oficial ainda e placeholder.");
      }
      if (hasTemplatePlaceholder(normalized.sourceDate)) {
        reasons.push("Referencia oficial ainda e placeholder.");
      }
      if ((source === "SINAPI" || source === "ORSE") && metadata.manualReviewRequired !== true) {
        reasons.push("metadata.manualReviewRequired deve ser true para base SINAPI/ORSE real.");
      }
      (normalized.inputs || []).forEach(function (input, inputIndex) {
        if (hasTemplatePlaceholder(input.code)) {
          reasons.push("Input " + (inputIndex + 1) + " ainda tem codigo placeholder.");
        }
        if (hasTemplatePlaceholder(input.name)) {
          reasons.push("Input " + (inputIndex + 1) + " ainda tem nome placeholder.");
        }
        if (parseNumber(input.coefficient) <= 0) {
          reasons.push("Input " + (inputIndex + 1) + ": coefficient oficial ausente ou zerado. Preencha manualmente com o valor oficial maior que zero antes de importar.");
        }
      });
      if (reasons.length) {
        rejected.push({
          index: index,
          code: normalized.code,
          source: source,
          reasons: reasons,
          row: row
        });
        return;
      }
      ready.push(normalized);
    });
    return {
      ok: ready.length === rows.length && rejected.length === 0,
      ready: ready,
      rejected: rejected,
      summary: buildImportSummary(rows.length, ready, rejected)
    };
  }

  function analyzeOfficialCompositionReadiness(jsonData) {
    const root = Array.isArray(jsonData) ? {} : (jsonData || {});
    const rows = Array.isArray(jsonData) ? jsonData : (root.compositions || root.rows || root.items) || [];
    const row = rows[0] || {};
    const rowWithRoot = Object.assign({
      source: root.source,
      sourceRegion: root.sourceRegion || root.state || root.uf,
      sourceDate: root.sourceDate || root.referenceMonth
    }, row);
    const normalized = normalizeComposition(rowWithRoot);
    const metadata = normalized.metadata || {};
    const sourceType = clean(rowWithRoot.sourceType || root.sourceType);
    const referenceMonth = clean(rowWithRoot.referenceMonth || root.referenceMonth);
    const state = clean(rowWithRoot.state || rowWithRoot.uf || root.state || root.uf || normalized.sourceRegion);
    const reference = clean(rowWithRoot.reference || rowWithRoot.referencia || root.reference || normalized.sourceDate);
    const rowIsOfficial = rowWithRoot.isOfficial === true || metadata.isOfficial === true;
    const inputs = normalized.inputs || [];
    const errors = [];
    const warnings = [];
    const checklist = [];

    function addCheck(label, passed, errorMessage, warningMessage) {
      checklist.push({
        label: label,
        passed: !!passed,
        status: passed ? "ok" : "error",
        message: passed ? "OK" : errorMessage
      });
      if (!passed && errorMessage) {
        errors.push(errorMessage);
      }
      if (passed && warningMessage) {
        warnings.push(warningMessage);
      }
    }

    function inputLabel(input, index) {
      return clean(input && (input.name || input.code)) || "insumo " + (index + 1);
    }

    const source = getCompositionSource(normalized);
    addCheck("codigo preenchido", !hasTemplatePlaceholder(normalized.code), "code da composicao vazio ou placeholder.");
    addCheck("descricao preenchida", !hasTemplatePlaceholder(normalized.description), "descricao/name da composicao vazia ou placeholder.");
    addCheck("unidade preenchida", !hasTemplatePlaceholder(normalized.unit) && !!clean(normalized.unit), "unit da composicao ausente.");
    addCheck("referencia preenchida", !hasTemplatePlaceholder(reference), "reference da composicao ausente ou placeholder.");
    addCheck("sourceType correto", sourceType === "official_manual_entry", "sourceType deve ser official_manual_entry.");
    addCheck("isOfficial true", rowIsOfficial === true, "isOfficial deve ser true.");
    addCheck("UF preenchida", !hasTemplatePlaceholder(state) && normalize(state) !== "uf", "state/UF ausente ou placeholder.");
    addCheck("mes preenchido", !hasTemplatePlaceholder(referenceMonth), "referenceMonth ausente ou placeholder.");
    addCheck("possui insumos", inputs.length > 0, "A composicao nao possui inputs/insumos.");
    addCheck("todos os insumos possuem codigo", inputs.length > 0 && inputs.every(function (input) {
      return !hasTemplatePlaceholder(input.code);
    }), "Existe insumo sem codigo oficial preenchido.");
    addCheck("todos os insumos possuem unidade", inputs.length > 0 && inputs.every(function (input) {
      return !hasTemplatePlaceholder(input.unit) && !!clean(input.unit);
    }), "Existe insumo sem unidade oficial preenchida.");
    addCheck("todos os insumos possuem coeficiente > 0", inputs.length > 0 && inputs.every(function (input) {
      return parseNumber(input.coefficient) > 0;
    }), "Existe insumo com coefficient oficial ausente, zerado ou negativo.");

    inputs.forEach(function (input, index) {
      const label = inputLabel(input, index);
      if (parseNumber(input.coefficient) <= 0) {
        errors.push("Coeficiente oficial ausente no insumo " + label + ". Preencha o valor oficial antes da importacao.");
      }
      if (hasTemplatePlaceholder(input.code)) {
        errors.push("Codigo oficial ausente no insumo " + label + ".");
      }
      if (hasTemplatePlaceholder(input.unit) || !clean(input.unit)) {
        errors.push("Unidade oficial ausente no insumo " + label + ".");
      }
    });

    if (source !== "SINAPI" && source !== "ORSE") {
      errors.push("Fonte deve ser SINAPI ou ORSE antes da importacao oficial.");
    }
    if (isMockComposition(normalized) || normalize(root.notice).indexOf("mock") >= 0 || normalize(reference).indexOf("test only") >= 0) {
      warnings.push("Arquivo marcado como TEST ONLY/MOCK DE TESTE. Use apenas para validacao automatizada, nao como base real.");
    }

    const passed = checklist.filter(function (item) { return item.passed; }).length;
    const score = checklist.length ? Math.round((passed / checklist.length) * 100) : 0;
    const strictValidation = validateSmallRealCompositionFile(jsonData);
    const ready = score === 100 && strictValidation.ok;
    const status = score === 100 ? "Pronta para importacao" :
      score >= 80 ? "Quase pronta" :
        score >= 40 ? "Parcialmente preenchida" :
          "Incompleta";

    return {
      ready: ready,
      score: ready ? 100 : score,
      status: ready ? "Pronta para importacao" : status,
      source: source,
      code: normalized.code,
      reference: reference,
      state: state,
      referenceMonth: referenceMonth,
      inputCount: inputs.length,
      errors: errors,
      warnings: warnings,
      checklist: checklist
    };
  }

  function generateOfficialCompositionDiagnosticReport(jsonData) {
    const root = Array.isArray(jsonData) ? {} : (jsonData || {});
    const rows = Array.isArray(jsonData) ? jsonData : (root.compositions || root.rows || root.items) || [];
    const readiness = analyzeOfficialCompositionReadiness(jsonData);
    const validation = validateSmallRealCompositionFile(jsonData);
    const sourceType = clean(root.sourceType || (rows[0] && rows[0].sourceType));
    const totalInputs = rows.reduce(function (total, row) {
      const inputs = row && (row.inputs || row.insumos || row.materials);
      return total + (Array.isArray(inputs) ? inputs.length : 0);
    }, 0);
    const warnings = readiness.warnings.slice();
    const errors = readiness.errors.concat(validation.rejected.reduce(function (items, item) {
      return items.concat(item.reasons || []);
    }, [])).filter(Boolean);

    function unique(values) {
      const seen = {};
      return values.filter(function (value) {
        const key = normalize(value);
        if (!key || seen[key]) {
          return false;
        }
        seen[key] = true;
        return true;
      });
    }

    function displayValue(value) {
      return clean(value) || "nao preenchido";
    }

    function normalizeReportRow(row) {
      return normalizeComposition(Object.assign({
        source: root.source,
        sourceRegion: root.sourceRegion || root.state || root.uf,
        sourceDate: root.sourceDate || root.referenceMonth
      }, row || {}));
    }

    function rowReference(row, normalized) {
      return clean(row && (row.reference || row.referencia) || root.reference || normalized.sourceDate);
    }

    const compositionSections = rows.map(function (row, index) {
      const normalized = normalizeReportRow(row);
      const inputs = normalized.inputs || [];
      return {
        type: "composition",
        index: index,
        code: normalized.code,
        name: normalized.description,
        unit: normalized.unit,
        reference: rowReference(row, normalized),
        isOfficial: row && row.isOfficial === true || normalized.metadata && normalized.metadata.isOfficial === true,
        inputCount: inputs.length,
        inputs: inputs.map(function (input) {
          return {
            code: input.code,
            name: input.name,
            unit: input.unit,
            coefficient: input.coefficient
          };
        })
      };
    });

    const status = readiness.ready ? "Pronta para importacao" : readiness.status;
    const nextAction = readiness.ready
      ? "Importar pela interface e conferir se a resposta mostra fonte, codigo, UF e referencia oficiais."
      : "Corrigir os erros listados antes de importar. Nao preencher coeficientes sem fonte oficial.";
    const sections = [{
      type: "summary",
      title: "Resumo da fonte",
      items: [
        { label: "Fonte", value: readiness.source },
        { label: "Tipo de fonte", value: sourceType },
        { label: "UF", value: readiness.state },
        { label: "Mes de referencia", value: readiness.referenceMonth },
        { label: "Total de composicoes", value: rows.length },
        { label: "Total de insumos", value: totalInputs },
        { label: "Status", value: status },
        { label: "Score", value: readiness.score }
      ]
    }].concat(compositionSections);

    const lines = [];
    lines.push("DIAGNOSTICO DA COMPOSICAO OFICIAL");
    lines.push("Fonte: " + displayValue(readiness.source));
    lines.push("Tipo de fonte: " + displayValue(sourceType));
    lines.push("UF: " + displayValue(readiness.state));
    lines.push("Mes de referencia: " + displayValue(readiness.referenceMonth));
    lines.push("Total de composicoes: " + rows.length);
    lines.push("Total de insumos: " + totalInputs);
    lines.push("Status: " + status + " (" + readiness.score + "/100)");
    compositionSections.forEach(function (section) {
      lines.push("");
      lines.push("Composicao " + (section.index + 1));
      lines.push("- Codigo: " + displayValue(section.code));
      lines.push("- Nome/descricao: " + displayValue(section.name));
      lines.push("- Unidade: " + displayValue(section.unit));
      lines.push("- Referencia: " + displayValue(section.reference));
      lines.push("- Oficial: " + (section.isOfficial ? "sim" : "nao"));
      lines.push("- Quantidade de insumos: " + section.inputCount);
      lines.push("- Insumos:");
      if (!section.inputs.length) {
        lines.push("  - nenhum insumo preenchido");
      }
      section.inputs.forEach(function (input) {
        lines.push("  - " + displayValue(input.code) + " | " + displayValue(input.name) +
          " | " + displayValue(input.unit) + " | coeficiente: " + displayValue(input.coefficient));
      });
    });
    lines.push("");
    lines.push("Erros:");
    unique(errors).forEach(function (error) {
      lines.push("- " + error);
    });
    if (!unique(errors).length) {
      lines.push("- nenhum erro encontrado");
    }
    lines.push("");
    lines.push("Avisos:");
    unique(warnings).forEach(function (warning) {
      lines.push("- " + warning);
    });
    if (!unique(warnings).length) {
      lines.push("- nenhum aviso encontrado");
    }
    lines.push("");
    lines.push("Proxima acao recomendada: " + nextAction);

    return {
      ok: readiness.ready,
      title: "Diagnostico da composicao oficial",
      source: readiness.source,
      sourceType: sourceType,
      referenceMonth: readiness.referenceMonth,
      state: readiness.state,
      totalCompositions: rows.length,
      totalInputs: totalInputs,
      readiness: readiness,
      sections: sections,
      warnings: unique(warnings),
      errors: unique(errors),
      textReport: lines.join("\n")
    };
  }

  function normalizeComposition(rawComposition) {
    const raw = rawComposition || {};
    const metadata = raw.metadata || {};
    const source = clean(raw.source || raw.base || raw.catalog || "CUSTOM").toUpperCase();
    const code = clean(raw.code || raw.codigo || raw.id);
    const description = clean(raw.description || raw.descricao || raw.service || raw.name);
    const unit = normalizeCompositionUnit(raw.unit || raw.unidade || raw.productionUnit);
    const inputs = raw.inputs || raw.insumos || raw.materials || [];
    const normalized = {
      id: clean(raw.id) || source + "-" + code,
      source: source,
      sourceRegion: clean(raw.sourceRegion || raw.region || raw.uf),
      sourceDate: clean(raw.sourceDate || raw.date || raw.data || raw.referenceMonth || raw.reference || raw.referencia),
      sourceType: clean(raw.sourceType || metadata.sourceType),
      code: code,
      description: description,
      service: description,
      name: description,
      serviceType: clean(raw.serviceType) || normalizeServiceType(description),
      unit: unit,
      productionUnit: unit,
      category: clean(raw.category || raw.categoria) || "Base real importada",
      lossPercent: parseNumber(raw.lossPercent || raw.perda || 0),
      sourceLabel: clean(raw.sourceLabel),
      inputs: inputs.map(function (input, index) {
        const coefficientValue = input.coefficient !== undefined ? input.coefficient :
          input.quantityPerUnit !== undefined ? input.quantityPerUnit :
            input.coeficiente;
        const coefficient = parseNumber(coefficientValue);
        return {
          code: clean(input.code || input.codigo || "input_" + index),
          name: clean(input.name || input.material || input.descricao),
          type: clean(input.type || input.tipo || "material") || "material",
          unit: normalizeCompositionUnit(input.unit || input.unidade),
          coefficient: coefficient
        };
      }),
      aliases: (raw.aliases || []).concat([description, clean(raw.serviceType)]).filter(Boolean),
      requiredParameters: raw.requiredParameters || [],
      metadata: Object.assign({}, metadata, {
        importedFrom: clean(raw.importedFrom || metadata.importedFrom || "arquivo local"),
        originalUnit: clean(raw.originalUnit || raw.unit || raw.unidade || unit),
        sourceType: clean(raw.sourceType || metadata.sourceType),
        isRealComposition: !isMockComposition(raw) && (source === "SINAPI" || source === "ORSE"),
        isMock: !!(raw.isMock || metadata.isMock),
        mockOnly: !!(raw.mockOnly || metadata.mockOnly)
      })
    };
    normalized.materials = normalized.inputs.map(function (input) {
      return material(input.name, input.coefficient, input.unit, "Coeficiente importado de base " + source + ".");
    });
    normalized.warning = isRealComposition(normalized) ? REAL_SOURCE_WARNING : DEMO_WARNING;
    normalized.note = normalized.warning;
    return normalized;
  }

  function parseSinapiCompositionRows(rows) {
    return loadRealCompositionsFromRows(rows, { source: "SINAPI" }).imported;
  }

  function parseOrseCompositionRows(rows) {
    return loadRealCompositionsFromRows(rows, { source: "ORSE" }).imported;
  }

  function buildImportSummary(total, imported, rejected) {
    const sources = {};
    imported.forEach(function (item) {
      const source = getCompositionSource(item);
      sources[source] = (sources[source] || 0) + 1;
    });
    return {
      total: total,
      valid: imported.length,
      invalid: rejected.length,
      sources: sources
    };
  }

  function normalizeImportRows(rows, options) {
    const settings = options || {};
    const forcedSource = clean(settings.source).toUpperCase();
    return (Array.isArray(rows) ? rows : []).map(function (row) {
      return forcedSource ? Object.assign({}, row, { source: forcedSource }) : row;
    });
  }

  function importCompositionRows(rows, options) {
    const settings = options || {};
    const sourceRows = normalizeImportRows(rows, settings);
    const imported = [];
    const rejected = [];
    sourceRows.forEach(function (row, index) {
      const normalized = normalizeComposition(row);
      const validation = validateCompositionDetailed(normalized);
      if (validation.valid) {
        imported.push(normalized);
        return;
      }
      rejected.push({
        index: index,
        code: clean(row && (row.code || row.codigo || row.id)),
        source: clean(row && (row.source || row.base || row.catalog || settings.source)),
        reasons: validation.reasons,
        row: row
      });
    });
    return {
      ok: rejected.length === 0,
      imported: imported,
      rejected: rejected,
      summary: buildImportSummary(sourceRows.length, imported, rejected)
    };
  }

  function loadRealCompositionsFromJson(jsonData, options) {
    const rows = Array.isArray(jsonData) ? jsonData : (jsonData && (jsonData.compositions || jsonData.rows || jsonData.items)) || [];
    return importCompositionRows(rows, options);
  }

  function loadRealCompositionsFromRows(rows, options) {
    const settings = options || {};
    const source = clean(settings.source).toUpperCase();
    if (source === "SINAPI" || source === "ORSE") {
      return importCompositionRows(rows, Object.assign({}, settings, { source: source }));
    }
    return importCompositionRows(rows, settings);
  }

  function setExternalCompositionCatalog(compositions) {
    const result = loadRealCompositionsFromJson(compositions);
    importedCompositionCatalog = result.imported.slice();
    return result;
  }

  function getExternalCompositionCatalog() {
    return importedCompositionCatalog.slice();
  }

  function clearExternalCompositionCatalog() {
    importedCompositionCatalog = [];
    return importedCompositionCatalog.slice();
  }

  function loadExternalCompositions(data, source) {
    const rows = Array.isArray(data) ? data : (data && (data.rows || data.compositions || data.items)) || [];
    const result = loadRealCompositionsFromRows(rows, { source: source || (data && data.source) });
    importedCompositionCatalog = result.imported.slice();
    return importedCompositionCatalog.slice();
  }

  function getField(row, names) {
    const item = row || {};
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      if (item[name] !== undefined && item[name] !== null && clean(item[name]) !== "") {
        return item[name];
      }
    }
    return "";
  }

  function normalizeOfficialSource(value) {
    const source = normalize(value).toUpperCase();
    if (source === "SINAPI") {
      return "SINAPI";
    }
    if (source === "ORSE") {
      return "ORSE";
    }
    return clean(value).toUpperCase();
  }

  function normalizeOfficialBaseRows(data, options) {
    const settings = options || {};
    const root = Array.isArray(data) ? {} : (data || {});
    const rows = Array.isArray(data) ? data : (root.rows || root.items || root.compositions || []);
    return rows.map(function (row, index) {
      const source = normalizeOfficialSource(getField(row, ["source", "base", "catalog", "catalogSource"]) || settings.source || root.source);
      const referenceMonth = clean(getField(row, ["referenceMonth", "sourceDate", "date", "mesReferencia", "mes_referencia"]) || settings.referenceMonth || root.referenceMonth || root.sourceDate);
      const state = clean(getField(row, ["state", "uf", "sourceRegion", "region", "estado"]) || settings.state || root.state || root.uf || root.sourceRegion);
      const compositionCode = clean(getField(row, ["compositionCode", "code", "codigoComposicao", "codigo_composicao", "codigo"]));
      const compositionName = clean(getField(row, ["compositionName", "compositionDescription", "description", "descricaoComposicao", "descricao_composicao", "descricao", "name"]));
      const compositionUnit = normalizeCompositionUnit(getField(row, ["compositionUnit", "unit", "unidadeComposicao", "unidade_composicao", "unidade"]));
      const inputCode = clean(getField(row, ["inputCode", "insumoCode", "codigoInsumo", "codigo_insumo", "materialCode", "codigo_material"]));
      const inputName = clean(getField(row, ["inputName", "insumoName", "nomeInsumo", "nome_insumo", "materialName", "material", "nameInsumo"]));
      const inputUnit = normalizeCompositionUnit(getField(row, ["inputUnit", "insumoUnit", "unidadeInsumo", "unidade_insumo", "materialUnit"]));
      const coefficient = parseNumber(getField(row, ["coefficient", "coeficiente", "coefficientValue", "quantidade", "quantityPerUnit"]));
      const serviceType = clean(getField(row, ["serviceType", "tipoServico", "tipo_servico"])) || normalizeServiceType(compositionName);
      return {
        index: index,
        source: source,
        referenceMonth: referenceMonth,
        state: state,
        compositionCode: compositionCode,
        compositionName: compositionName,
        compositionUnit: compositionUnit,
        inputCode: inputCode,
        inputName: inputName,
        inputUnit: inputUnit,
        coefficient: coefficient,
        serviceType: serviceType,
        raw: row
      };
    }).filter(function (row) {
      return clean([
        row.source,
        row.referenceMonth,
        row.state,
        row.compositionCode,
        row.compositionName,
        row.inputCode,
        row.inputName,
        row.coefficient
      ].join(""));
    });
  }

  function isOfficialImportMockOrTemplate(row) {
    const text = normalize([
      row && row.source,
      row && row.compositionCode,
      row && row.compositionName,
      row && row.inputCode,
      row && row.inputName,
      row && row.referenceMonth,
      row && row.state,
      row && row.raw && (row.raw.reference || row.raw.notice || row.raw.metadata && row.raw.metadata.importedFrom)
    ].join(" "));
    return text.indexOf("test only") >= 0 ||
      text.indexOf("mock") >= 0 ||
      text.indexOf("template") >= 0 ||
      text.indexOf("example") >= 0 ||
      hasTemplatePlaceholder(row && row.compositionCode) ||
      hasTemplatePlaceholder(row && row.compositionName) ||
      hasTemplatePlaceholder(row && row.inputCode) ||
      hasTemplatePlaceholder(row && row.inputName);
  }

  function validateOfficialBaseRow(row) {
    const reasons = [];
    if (row.source !== "SINAPI" && row.source !== "ORSE") {
      reasons.push("Fonte oficial deve ser SINAPI ou ORSE.");
    }
    if (!clean(row.referenceMonth) || hasTemplatePlaceholder(row.referenceMonth)) {
      reasons.push("referenceMonth/mes de referencia oficial ausente ou placeholder.");
    }
    if (!clean(row.state) || normalize(row.state) === "uf" || hasTemplatePlaceholder(row.state)) {
      reasons.push("state/UF oficial ausente ou placeholder.");
    }
    if (!clean(row.compositionCode) || hasTemplatePlaceholder(row.compositionCode)) {
      reasons.push("Codigo da composicao oficial ausente ou placeholder.");
    }
    if (!clean(row.compositionName) || hasTemplatePlaceholder(row.compositionName)) {
      reasons.push("Descricao da composicao oficial ausente ou placeholder.");
    }
    if (!clean(row.compositionUnit)) {
      reasons.push("Unidade da composicao oficial ausente.");
    }
    if (!clean(row.inputCode) || hasTemplatePlaceholder(row.inputCode)) {
      reasons.push("Codigo do insumo oficial ausente ou placeholder.");
    }
    if (!clean(row.inputName) || hasTemplatePlaceholder(row.inputName)) {
      reasons.push("Nome do insumo oficial ausente ou placeholder.");
    }
    if (!clean(row.inputUnit)) {
      reasons.push("Unidade do insumo oficial ausente.");
    }
    if (parseNumber(row.coefficient) <= 0) {
      reasons.push("Coeficiente oficial ausente, zerado ou invalido no insumo " + (row.inputName || row.inputCode || "sem identificacao") + ".");
    }
    if (isOfficialImportMockOrTemplate(row)) {
      reasons.push("Linha parece ser template, example, MOCK ou TEST ONLY; nao pode entrar como base oficial.");
    }
    return reasons;
  }

  function buildOfficialCompositionFromGroup(group) {
    const first = group[0];
    const inputs = group.map(function (row) {
      return {
        code: row.inputCode,
        name: row.inputName,
        material: row.inputName,
        type: clean(row.raw && row.raw.inputType) || "material",
        unit: row.inputUnit,
        coefficient: roundQuantity(row.coefficient),
        quantityPerUnit: roundQuantity(row.coefficient),
        note: "Coeficiente oficial importado de arquivo local " + first.source + "."
      };
    });
    return normalizeComposition({
      source: first.source,
      sourceType: "official_imported_file",
      sourceRegion: first.state,
      sourceDate: first.referenceMonth,
      referenceMonth: first.referenceMonth,
      state: first.state,
      code: first.compositionCode,
      description: first.compositionName,
      name: first.compositionName,
      service: first.compositionName,
      serviceType: first.serviceType,
      unit: first.compositionUnit,
      productionUnit: first.compositionUnit,
      isOfficial: true,
      inputs: inputs,
      metadata: {
        isOfficial: true,
        isRealComposition: true,
        sourceType: "official_imported_file",
        importedFrom: "arquivo oficial local " + first.source,
        referenceMonth: first.referenceMonth,
        state: first.state
      }
    });
  }

  function validateOfficialBaseImport(data, options) {
    const rows = normalizeOfficialBaseRows(data, options);
    const rejected = [];
    const grouped = {};
    rows.forEach(function (row) {
      const reasons = validateOfficialBaseRow(row);
      if (reasons.length) {
        rejected.push({
          index: row.index,
          code: row.compositionCode,
          inputCode: row.inputCode,
          source: row.source,
          reasons: reasons,
          row: row.raw
        });
        return;
      }
      const key = [row.source, row.state, row.referenceMonth, row.compositionCode].map(normalize).join("|");
      grouped[key] = grouped[key] || [];
      grouped[key].push(row);
    });
    const compositions = Object.keys(grouped).map(function (key) {
      return buildOfficialCompositionFromGroup(grouped[key]);
    });
    const errors = rejected.reduce(function (list, item) {
      return list.concat(item.reasons.map(function (reason) {
        return "Linha " + (item.index + 1) + ": " + reason;
      }));
    }, []);
    if (!rows.length) {
      errors.push("Nenhuma linha oficial encontrada para importacao.");
    }
    return {
      ok: rows.length > 0 && rejected.length === 0 && compositions.length > 0,
      ready: rows.length > 0 && rejected.length === 0 && compositions.length > 0,
      rows: rows,
      compositions: compositions,
      imported: compositions,
      rejected: rejected,
      errors: errors,
      summary: buildImportSummary(rows.length, compositions, rejected)
    };
  }

  function importOfficialBase(data, options) {
    const validation = validateOfficialBaseImport(data, options);
    if (!validation.ok) {
      return Object.assign({}, validation, {
        imported: [],
        catalogSize: importedOfficialBaseCatalog.length
      });
    }
    importedOfficialBaseCatalog = validation.compositions.slice();
    return Object.assign({}, validation, {
      imported: importedOfficialBaseCatalog.slice(),
      catalogSize: importedOfficialBaseCatalog.length
    });
  }

  function searchImportedOfficialCompositions(query, options) {
    const settings = options || {};
    const terms = normalize(query).split(" ").filter(Boolean);
    const rawQuery = normalize(query);
    const limit = parseNumber(settings.limit) || 20;
    return importedOfficialBaseCatalog.map(function (item) {
      const haystack = normalize([
        item.code,
        item.name,
        item.description,
        item.service,
        item.serviceType,
        item.source,
        item.sourceRegion,
        item.sourceDate
      ].join(" "));
      let score = 0;
      if (normalize(item.code) === rawQuery) {
        score += 1000;
      }
      if (rawQuery && normalize(item.code).indexOf(rawQuery) >= 0) {
        score += 700;
      }
      if (rawQuery && haystack.indexOf(rawQuery) >= 0) {
        score += 500;
      }
      terms.forEach(function (term) {
        if (haystack.indexOf(term) >= 0) {
          score += 100;
        }
      });
      return { item: item, score: score };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score || clean(a.item.code).localeCompare(clean(b.item.code));
    }).slice(0, limit).map(function (entry) {
      return entry.item;
    });
  }

  function clearImportedOfficialBase() {
    importedOfficialBaseCatalog = [];
    return importedOfficialBaseCatalog.slice();
  }

  function getImportedOfficialBaseStats() {
    const sources = {};
    const states = {};
    const referenceMonths = {};
    const totalInputs = importedOfficialBaseCatalog.reduce(function (total, item) {
      sources[getCompositionSource(item)] = true;
      if (clean(item.sourceRegion)) {
        states[clean(item.sourceRegion)] = true;
      }
      if (clean(item.sourceDate)) {
        referenceMonths[clean(item.sourceDate)] = true;
      }
      return total + ((item.inputs || item.materials || []).length);
    }, 0);
    const sourceList = Object.keys(sources);
    const stateList = Object.keys(states);
    const monthList = Object.keys(referenceMonths);
    return {
      totalCompositions: importedOfficialBaseCatalog.length,
      totalInputs: totalInputs,
      sources: sourceList,
      states: stateList,
      referenceMonths: monthList,
      source: sourceList.join(", "),
      state: stateList.join(", "),
      referenceMonth: monthList.join(", ")
    };
  }

  function splitCsvLine(line, delimiter) {
    const values = [];
    let current = "";
    let quoted = false;
    const separator = delimiter || ";";
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];
      if (char === "\"" && quoted && nextChar === "\"") {
        current += "\"";
        index += 1;
        continue;
      }
      if (char === "\"") {
        quoted = !quoted;
        continue;
      }
      if (char === separator && !quoted) {
        values.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }
    values.push(current.trim());
    return values;
  }

  function countDelimiterOutsideQuotes(line, delimiter) {
    let quoted = false;
    let count = 0;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];
      if (char === "\"" && quoted && nextChar === "\"") {
        index += 1;
        continue;
      }
      if (char === "\"") {
        quoted = !quoted;
        continue;
      }
      if (char === delimiter && !quoted) {
        count += 1;
      }
    }
    return count;
  }

  function detectOfficialCsvDelimiter(headerLine, requestedDelimiter) {
    if (requestedDelimiter && requestedDelimiter !== "auto") {
      return requestedDelimiter;
    }
    const candidates = [";", ",", "\t"].map(function (delimiter) {
      return {
        delimiter: delimiter,
        count: countDelimiterOutsideQuotes(headerLine, delimiter)
      };
    }).sort(function (a, b) {
      return b.count - a.count;
    });
    return candidates[0] && candidates[0].count > 0 ? candidates[0].delimiter : ";";
  }

  const OFFICIAL_CSV_COLUMN_ALIASES = {
    compositionCode: [
      "compositionCode", "codigoComposicao", "codigo_composicao", "cod_composicao",
      "codigo composicao", "codigo da composicao", "CODIGO_COMPOSICAO"
    ],
    compositionName: [
      "compositionName", "descricaoComposicao", "descricao_composicao",
      "descricao composicao", "descricao da composicao"
    ],
    compositionUnit: [
      "compositionUnit", "unidadeComposicao", "unidade_composicao", "unidade composicao"
    ],
    inputCode: [
      "inputCode", "codigoInsumo", "codigo_insumo", "cod_insumo", "codigo insumo"
    ],
    inputName: [
      "inputName", "descricaoInsumo", "descricao_insumo", "descricao insumo", "nome insumo"
    ],
    inputUnit: [
      "inputUnit", "unidadeInsumo", "unidade_insumo", "unidade insumo"
    ],
    coefficient: [
      "coefficient", "coeficiente", "coef", "consumo", "quantidade_coeficiente"
    ]
  };

  function buildOfficialCsvColumnIndexes(headers, columnMap) {
    const normalizedHeaders = headers.map(normalize);
    const indexes = {};
    const map = columnMap || {};
    Object.keys(OFFICIAL_CSV_COLUMN_ALIASES).forEach(function (field) {
      const manualColumn = clean(map[field]);
      if (manualColumn) {
        const manualIndex = normalizedHeaders.indexOf(normalize(manualColumn));
        if (manualIndex >= 0) {
          indexes[field] = manualIndex;
        }
        return;
      }
      const aliases = OFFICIAL_CSV_COLUMN_ALIASES[field].map(normalize);
      for (let index = 0; index < normalizedHeaders.length; index += 1) {
        if (aliases.indexOf(normalizedHeaders[index]) >= 0) {
          indexes[field] = index;
          return;
        }
      }
    });
    return indexes;
  }

  function parseOfficialBaseCsv(csvText, options) {
    const settings = options || {};
    const source = normalizeOfficialSource(settings.source);
    const state = clean(settings.state || settings.uf || settings.sourceRegion);
    const referenceMonth = clean(settings.referenceMonth || settings.sourceDate);
    const errors = [];
    if (source !== "SINAPI" && source !== "ORSE") {
      errors.push("source deve ser SINAPI ou ORSE.");
    }
    if (!state) {
      errors.push("state/UF e obrigatorio.");
    }
    if (!referenceMonth) {
      errors.push("referenceMonth e obrigatorio.");
    }
    const text = String(csvText || "").replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter(function (line) {
      return clean(line);
    });
    if (!clean(text)) {
      errors.push("CSV vazio.");
    }
    if (!lines.length) {
      return {
        ok: false,
        rows: [],
        delimiter: "",
        headers: [],
        errors: errors.length ? errors : ["CSV vazio."]
      };
    }
    const delimiter = detectOfficialCsvDelimiter(lines[0], settings.delimiter || "auto");
    const headers = splitCsvLine(lines[0], delimiter).map(clean);
    const columnIndexes = buildOfficialCsvColumnIndexes(headers, settings.columnMap);
    const requiredFields = Object.keys(OFFICIAL_CSV_COLUMN_ALIASES);
    const missing = requiredFields.filter(function (field) {
      return columnIndexes[field] === undefined;
    });
    if (headers.length < 2 || missing.length === requiredFields.length) {
      errors.push("CSV sem cabecalho valido.");
    }
    if (missing.length) {
      errors.push("CSV sem colunas minimas: " + missing.join(", ") + ".");
    }
    if (lines.length < 2) {
      errors.push("CSV sem linhas de dados.");
    }
    const rows = lines.slice(1).map(function (line) {
      const values = splitCsvLine(line, delimiter);
      return {
        source: source,
        state: state,
        referenceMonth: referenceMonth,
        compositionCode: values[columnIndexes.compositionCode] || "",
        compositionName: values[columnIndexes.compositionName] || "",
        compositionUnit: values[columnIndexes.compositionUnit] || "",
        inputCode: values[columnIndexes.inputCode] || "",
        inputName: values[columnIndexes.inputName] || "",
        inputUnit: values[columnIndexes.inputUnit] || "",
        coefficient: values[columnIndexes.coefficient] || ""
      };
    }).filter(function (row) {
      return clean(Object.keys(row).map(function (key) { return row[key]; }).join(""));
    });
    return {
      ok: errors.length === 0,
      rows: errors.length ? [] : rows,
      delimiter: delimiter,
      headers: headers,
      columnIndexes: columnIndexes,
      errors: errors,
      summary: errors.length ? "CSV invalido." : rows.length + " linha(s) CSV normalizada(s)."
    };
  }

  function importOfficialBaseCsv(csvText, options) {
    const parsed = parseOfficialBaseCsv(csvText, options);
    if (!parsed.ok) {
      return Object.assign({}, parsed, {
        imported: [],
        catalogSize: importedOfficialBaseCatalog.length
      });
    }
    const result = importOfficialBase({ rows: parsed.rows }, options);
    return Object.assign({}, result, {
      parsed: parsed,
      rows: parsed.rows
    });
  }

  function getOfficialXlsxToolkit(options) {
    const settings = options || {};
    if (settings.xlsx) {
      return settings.xlsx;
    }
    if (typeof window !== "undefined" && window.XLSX) {
      return window.XLSX;
    }
    if (typeof XLSX !== "undefined") {
      return XLSX;
    }
    return null;
  }

  function readOfficialXlsxInput(fileOrBuffer, options) {
    const settings = options || {};
    const xlsx = getOfficialXlsxToolkit(settings);
    if (!xlsx || typeof xlsx.read !== "function") {
      return {
        ok: false,
        workbook: null,
        errors: ["Dependencia XLSX indisponivel para leitura da planilha."]
      };
    }
    if (fileOrBuffer && fileOrBuffer.SheetNames && fileOrBuffer.Sheets) {
      return { ok: true, workbook: fileOrBuffer, errors: [] };
    }
    if (!fileOrBuffer) {
      return {
        ok: false,
        workbook: null,
        errors: ["Arquivo XLSX vazio ou ausente."]
      };
    }
    try {
      if (typeof fileOrBuffer === "string") {
        if (settings.readFile) {
          return { ok: true, workbook: xlsx.read(settings.readFile(fileOrBuffer), { type: "buffer" }), errors: [] };
        }
        return {
          ok: false,
          workbook: null,
          errors: ["Caminho local XLSX exige options.readFile em ambiente seguro."]
        };
      }
      const isBuffer = typeof Buffer !== "undefined" && Buffer.isBuffer && Buffer.isBuffer(fileOrBuffer);
      if (isBuffer) {
        return { ok: true, workbook: xlsx.read(fileOrBuffer, { type: "buffer" }), errors: [] };
      }
      if (fileOrBuffer instanceof ArrayBuffer) {
        return { ok: true, workbook: xlsx.read(fileOrBuffer, { type: "array" }), errors: [] };
      }
      if (fileOrBuffer && fileOrBuffer.buffer && typeof fileOrBuffer.length === "number") {
        return { ok: true, workbook: xlsx.read(fileOrBuffer, { type: "array" }), errors: [] };
      }
      return {
        ok: false,
        workbook: null,
        errors: ["Formato XLSX nao suportado. Use Buffer, ArrayBuffer, Uint8Array ou workbook XLSX."]
      };
    } catch (error) {
      return {
        ok: false,
        workbook: null,
        errors: ["Falha ao ler XLSX: " + (error && error.message ? error.message : "erro desconhecido") + "."]
      };
    }
  }

  function normalizeOfficialSheetRows(table, options, sheetName) {
    const settings = options || {};
    const source = normalizeOfficialSource(settings.source);
    const state = clean(settings.state || settings.uf || settings.sourceRegion);
    const referenceMonth = clean(settings.referenceMonth || settings.sourceDate);
    const errors = [];
    if (source !== "SINAPI" && source !== "ORSE") {
      errors.push("source deve ser SINAPI ou ORSE.");
    }
    if (!state) {
      errors.push("state/UF e obrigatorio.");
    }
    if (!referenceMonth) {
      errors.push("referenceMonth e obrigatorio.");
    }
    const lines = (table || []).filter(function (row) {
      return clean((row || []).join(""));
    });
    if (!lines.length) {
      errors.push("Aba vazia.");
      return {
        ok: false,
        rows: [],
        headers: [],
        columnIndexes: {},
        errors: errors,
        sheetName: sheetName || ""
      };
    }
    const headers = (lines[0] || []).map(clean);
    const columnIndexes = buildOfficialCsvColumnIndexes(headers, settings.columnMap);
    const requiredFields = Object.keys(OFFICIAL_CSV_COLUMN_ALIASES);
    const missing = requiredFields.filter(function (field) {
      return columnIndexes[field] === undefined;
    });
    if (headers.length < 2 || missing.length === requiredFields.length) {
      errors.push("XLSX sem cabecalho valido.");
    }
    if (missing.length) {
      errors.push("XLSX sem colunas minimas: " + missing.join(", ") + ".");
    }
    if (lines.length < 2) {
      errors.push("XLSX sem linhas de dados.");
    }
    const rows = lines.slice(1).map(function (line) {
      return {
        source: source,
        state: state,
        referenceMonth: referenceMonth,
        compositionCode: line[columnIndexes.compositionCode] || "",
        compositionName: line[columnIndexes.compositionName] || "",
        compositionUnit: line[columnIndexes.compositionUnit] || "",
        inputCode: line[columnIndexes.inputCode] || "",
        inputName: line[columnIndexes.inputName] || "",
        inputUnit: line[columnIndexes.inputUnit] || "",
        coefficient: line[columnIndexes.coefficient] || ""
      };
    }).filter(function (row) {
      return clean(Object.keys(row).map(function (key) { return row[key]; }).join(""));
    });
    return {
      ok: errors.length === 0,
      rows: errors.length ? [] : rows,
      headers: headers,
      columnIndexes: columnIndexes,
      errors: errors,
      sheetName: sheetName || "",
      summary: errors.length ? "XLSX invalido." : rows.length + " linha(s) XLSX normalizada(s)."
    };
  }

  function parseOfficialBaseXlsx(fileOrBuffer, options) {
    const settings = options || {};
    const xlsx = getOfficialXlsxToolkit(settings);
    const loaded = readOfficialXlsxInput(fileOrBuffer, settings);
    if (!loaded.ok) {
      return Object.assign({}, loaded, {
        ok: false,
        rows: [],
        sheetName: clean(settings.sheetName),
        sheets: []
      });
    }
    const workbook = loaded.workbook;
    const sheetNames = workbook && workbook.SheetNames || [];
    if (!sheetNames.length) {
      return {
        ok: false,
        rows: [],
        sheetName: "",
        sheets: [],
        errors: ["Planilha XLSX sem abas."]
      };
    }
    const wantedSheet = clean(settings.sheetName);
    if (wantedSheet && sheetNames.indexOf(wantedSheet) < 0) {
      return {
        ok: false,
        rows: [],
        sheetName: wantedSheet,
        sheets: sheetNames.slice(),
        errors: ["Aba XLSX nao encontrada: " + wantedSheet + "."]
      };
    }
    const sheetsToRead = wantedSheet ? [wantedSheet] : sheetNames;
    let firstInvalid = null;
    for (let index = 0; index < sheetsToRead.length; index += 1) {
      const sheetName = sheetsToRead[index];
      const worksheet = workbook.Sheets[sheetName];
      const table = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        raw: false,
        defval: ""
      });
      const parsed = normalizeOfficialSheetRows(table, settings, sheetName);
      if (parsed.ok) {
        return Object.assign({}, parsed, {
          sheets: sheetNames.slice()
        });
      }
      if (!firstInvalid || parsed.errors.join(" ").indexOf("Aba vazia") < 0) {
        firstInvalid = parsed;
      }
    }
    return Object.assign({}, firstInvalid || {
      ok: false,
      rows: [],
      sheetName: wantedSheet,
      errors: ["Nenhuma aba XLSX com dados validos."]
    }, {
      ok: false,
      rows: [],
      sheets: sheetNames.slice()
    });
  }

  function importOfficialBaseXlsx(fileOrBuffer, options) {
    const parsed = parseOfficialBaseXlsx(fileOrBuffer, options);
    if (!parsed.ok) {
      return Object.assign({}, parsed, {
        imported: [],
        catalogSize: importedOfficialBaseCatalog.length
      });
    }
    const result = importOfficialBase({ rows: parsed.rows }, options);
    return Object.assign({}, result, {
      parsed: parsed,
      rows: parsed.rows
    });
  }

  const SINAPI_ANALITICO_HEADER_ALIASES = {
    compositionCode: ["codigo da composicao", "codigo composicao", "cod composicao"],
    compositionName: ["descricao da composicao", "descricao composicao"],
    compositionUnit: ["unidade"],
    itemType: ["tipo item", "tipo do item"],
    inputCode: ["codigo item", "codigo do item"],
    inputName: ["descricao item", "descricao do item"],
    inputUnit: ["unidade item", "unidade do item"],
    coefficient: ["coeficiente"]
  };

  function normalizeSheetTableRows(rows) {
    return (rows || []).map(function (row) {
      return Array.isArray(row) ? row.map(clean) : [];
    }).filter(function (row) {
      return clean(row.join(""));
    });
  }

  function findSinapiAnaliticoHeader(table) {
    const rows = normalizeSheetTableRows(table);
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const normalizedHeaders = rows[rowIndex].map(normalize);
      const indexes = {};
      Object.keys(SINAPI_ANALITICO_HEADER_ALIASES).forEach(function (field) {
        const aliases = SINAPI_ANALITICO_HEADER_ALIASES[field].map(normalize);
        for (let index = 0; index < normalizedHeaders.length; index += 1) {
          if (aliases.indexOf(normalizedHeaders[index]) >= 0 && indexes[field] === undefined) {
            indexes[field] = index;
          }
        }
      });
      const requiredFields = Object.keys(SINAPI_ANALITICO_HEADER_ALIASES);
      const missing = requiredFields.filter(function (field) {
        return indexes[field] === undefined;
      });
      if (!missing.length) {
        return {
          found: true,
          headerIndex: rowIndex,
          headers: rows[rowIndex],
          columnIndexes: indexes,
          rows: rows
        };
      }
    }
    return {
      found: false,
      headerIndex: -1,
      headers: [],
      columnIndexes: {},
      rows: rows
    };
  }

  function extractSinapiReferenceMonthFromRows(rows) {
    const allText = normalizeSheetTableRows(rows).map(function (row) {
      return row.join(" ");
    }).join(" ");
    const match = allText.match(/(?:data de preco|data de preço|referencia de coleta|referência de coleta)[^0-9]*(\d{1,2})[\/.-](\d{4})/i) ||
      allText.match(/(\d{1,2})[\/.-](\d{4})/);
    if (!match) {
      return "";
    }
    return match[2] + "-" + String(match[1]).padStart(2, "0");
  }

  function detectSinapiAnaliticoFormat(workbookOrRows, options) {
    const settings = options || {};
    const xlsx = getOfficialXlsxToolkit(settings);
    const candidates = [];
    if (Array.isArray(workbookOrRows)) {
      candidates.push({ sheetName: "", rows: workbookOrRows });
    } else if (workbookOrRows && workbookOrRows.SheetNames && workbookOrRows.Sheets) {
      (workbookOrRows.SheetNames || []).forEach(function (sheetName) {
        const worksheet = workbookOrRows.Sheets[sheetName];
        const table = xlsx && xlsx.utils && typeof xlsx.utils.sheet_to_json === "function"
          ? xlsx.utils.sheet_to_json(worksheet, { header: 1, blankrows: false, raw: false, defval: "" })
          : [];
        candidates.push({ sheetName: sheetName, rows: table });
      });
    }
    for (let index = 0; index < candidates.length; index += 1) {
      const header = findSinapiAnaliticoHeader(candidates[index].rows);
      if (header.found) {
        return Object.assign({}, header, {
          ok: true,
          detected: true,
          sheetName: candidates[index].sheetName,
          referenceMonth: extractSinapiReferenceMonthFromRows(candidates[index].rows)
        });
      }
    }
    return {
      ok: false,
      detected: false,
      sheetName: "",
      headerIndex: -1,
      headers: [],
      columnIndexes: {},
      rows: [],
      errors: ["Cabecalho SINAPI Analitico nao encontrado."]
    };
  }

  function normalizeSinapiAnaliticoItemType(value) {
    const text = normalize(value);
    if (text === "insumo") {
      return "insumo";
    }
    if (text === "composicao" || text === "composicao auxiliar") {
      return "composicao";
    }
    return text || clean(value).toLowerCase();
  }

  function parseSinapiAnaliticoRows(rows, options) {
    const settings = options || {};
    const source = normalizeOfficialSource(settings.source || "SINAPI");
    const state = clean(settings.state || settings.uf || settings.sourceRegion);
    const detected = detectSinapiAnaliticoFormat(rows, settings);
    const referenceMonth = clean(settings.referenceMonth || settings.sourceDate || detected.referenceMonth);
    const errors = [];
    if (source !== "SINAPI") {
      errors.push("source deve ser SINAPI para adaptador SINAPI Analitico.");
    }
    if (!state) {
      errors.push("state/UF e obrigatorio.");
    }
    if (!referenceMonth) {
      errors.push("referenceMonth e obrigatorio ou deve ser extraido do arquivo.");
    }
    if (!detected.detected) {
      errors.push("Arquivo sem cabecalho SINAPI Analitico.");
      return {
        ok: false,
        rows: [],
        errors: errors,
        headerIndex: -1,
        headers: []
      };
    }
    const table = detected.rows;
    const indexes = detected.columnIndexes;
    const parsedRows = [];
    table.slice(detected.headerIndex + 1).forEach(function (line, lineIndex) {
      const compositionCode = clean(line[indexes.compositionCode]);
      if (!compositionCode) {
        return;
      }
      const itemType = clean(line[indexes.itemType]);
      parsedRows.push({
        source: "SINAPI",
        state: state,
        referenceMonth: referenceMonth,
        pricingType: clean(settings.pricingType),
        locality: clean(settings.locality),
        compositionCode: compositionCode,
        compositionName: clean(line[indexes.compositionName]),
        compositionUnit: clean(line[indexes.compositionUnit]),
        inputType: normalizeSinapiAnaliticoItemType(itemType),
        itemType: itemType,
        inputCode: clean(line[indexes.inputCode]),
        inputName: clean(line[indexes.inputName]),
        inputUnit: clean(line[indexes.inputUnit]),
        coefficient: line[indexes.coefficient],
        sourceRow: detected.headerIndex + 2 + lineIndex
      });
    });
    if (!parsedRows.length) {
      errors.push("Arquivo SINAPI Analitico sem composicoes.");
    }
    parsedRows.forEach(function (row) {
      if (!clean(row.inputCode)) {
        errors.push("Composicao " + row.compositionCode + " possui item sem codigo.");
      }
      if (!clean(row.inputName)) {
        errors.push("Composicao " + row.compositionCode + " possui item sem descricao.");
      }
      if (parseNumber(row.coefficient) <= 0) {
        errors.push("Composicao " + row.compositionCode + " possui item com coefficient <= 0.");
      }
    });
    const normalized = normalizeOfficialBaseRows({ rows: parsedRows }, {
      source: "SINAPI",
      state: state,
      referenceMonth: referenceMonth
    });
    return {
      ok: errors.length === 0,
      rows: errors.length ? [] : parsedRows,
      normalizedRows: errors.length ? [] : normalized,
      errors: errors,
      headerIndex: detected.headerIndex,
      headers: detected.headers,
      columnIndexes: detected.columnIndexes,
      referenceMonth: referenceMonth,
      state: state,
      source: "SINAPI",
      pricingType: clean(settings.pricingType),
      locality: clean(settings.locality),
      totalRows: parsedRows.length,
      totalCompositions: Object.keys(parsedRows.reduce(function (grouped, row) {
        grouped[row.compositionCode] = true;
        return grouped;
      }, {})).length
    };
  }

  function parseSinapiAnaliticoXlsx(fileOrBuffer, options) {
    const settings = options || {};
    const xlsx = getOfficialXlsxToolkit(settings);
    const loaded = readOfficialXlsxInput(fileOrBuffer, settings);
    if (!loaded.ok) {
      return Object.assign({}, loaded, {
        ok: false,
        rows: [],
        sheets: []
      });
    }
    const workbook = loaded.workbook;
    const sheetNames = workbook && workbook.SheetNames || [];
    if (!sheetNames.length) {
      return {
        ok: false,
        rows: [],
        sheets: [],
        errors: ["Planilha XLSX sem abas."]
      };
    }
    const wantedSheet = clean(settings.sheetName);
    if (wantedSheet && sheetNames.indexOf(wantedSheet) < 0) {
      return {
        ok: false,
        rows: [],
        sheets: sheetNames.slice(),
        errors: ["Aba XLSX nao encontrada: " + wantedSheet + "."]
      };
    }
    const sheetsToRead = wantedSheet ? [wantedSheet] : sheetNames;
    let firstInvalid = null;
    for (let index = 0; index < sheetsToRead.length; index += 1) {
      const sheetName = sheetsToRead[index];
      const worksheet = workbook.Sheets[sheetName];
      const table = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        blankrows: false,
        raw: false,
        defval: ""
      });
      const parsed = parseSinapiAnaliticoRows(table, settings);
      if (parsed.ok) {
        return Object.assign({}, parsed, {
          format: "SINAPI_ANALITICO",
          sheetName: sheetName,
          sheets: sheetNames.slice()
        });
      }
      firstInvalid = firstInvalid || Object.assign({}, parsed, { sheetName: sheetName });
    }
    return Object.assign({}, firstInvalid || {
      ok: false,
      rows: [],
      errors: ["Nenhuma aba XLSX com formato SINAPI Analitico valido."]
    }, {
      ok: false,
      rows: [],
      sheets: sheetNames.slice()
    });
  }

  function importSinapiAnaliticoXlsx(fileOrBuffer, options) {
    const parsed = parseSinapiAnaliticoXlsx(fileOrBuffer, options);
    if (!parsed.ok) {
      return Object.assign({}, parsed, {
        imported: [],
        catalogSize: importedOfficialBaseCatalog.length
      });
    }
    const result = importOfficialBase({ rows: parsed.rows }, Object.assign({}, options || {}, {
      source: "SINAPI",
      state: parsed.state,
      referenceMonth: parsed.referenceMonth
    }));
    return Object.assign({}, result, {
      parsed: parsed,
      rows: parsed.rows,
      format: "SINAPI_ANALITICO",
      pricingType: parsed.pricingType,
      locality: parsed.locality
    });
  }

  function getWindowExternalCompositions() {
    const external = window.StockAiRealCompositions;
    if (!external) {
      return [];
    }
    const rows = Array.isArray(external) ? external : (external.compositions || external.rows || []);
    if (!rows.length) {
      return [];
    }
    const source = Array.isArray(external) ? "" : external.source;
    const catalogSource = clean(source || "CUSTOM").toUpperCase();
    const parsed = catalogSource === "SINAPI"
      ? parseSinapiCompositionRows(rows)
      : catalogSource === "ORSE"
        ? parseOrseCompositionRows(rows)
        : rows.map(normalizeComposition).filter(validateCompositionSchema);
    return parsed;
  }

  function getSourcePriority(compositionData) {
    const source = normalize(getCompositionSource(compositionData)).toUpperCase();
    const metadata = compositionData && compositionData.metadata || {};
    const sourceType = clean(compositionData && compositionData.sourceType || metadata.sourceType);
    if (sourceType === "official_imported_file") {
      return source === "ORSE" ? 5900 : 6000;
    }
    if (source === "SINAPI") {
      return 5000;
    }
    if (source === "ORSE") {
      return 4900;
    }
    if (source === "CUSTOM" || source === "PERSONALIZADA") {
      return 3000;
    }
    return 100;
  }

  function mergeCompositionCatalogs(baseCatalog, importedCatalog) {
    const seen = {};
    return (importedCatalog || []).concat(baseCatalog || []).filter(function (item) {
      const key = normalize(getCompositionSource(item)) + "|" + normalize(item.code || item.id);
      if (seen[key]) {
        return false;
      }
      seen[key] = true;
      return true;
    });
  }

  const DEFAULT_COMPOSITIONS = [
    composition("std_escavacao_manual", "Escavacao manual", "Fundacao / Estrutura", "m3", 8, [
      material("Mao de obra de escavacao", 1.2, "h"),
      material("Remocao manual de solo", 1, "m3"),
      material("Ferramentas manuais", 0.05, "un")
    ], ["escavacao", "vala", "sapata", "fundacao"]),
    composition("std_lastro_concreto_magro", "Lastro de concreto magro", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 4.5, "saco"),
      material("Areia", 0.55, "m3"),
      material("Brita", 0.75, "m3")
    ], ["lastro", "concreto magro", "regularizacao de fundo"]),
    composition("std_concreto_simples", "Concreto simples", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 7, "saco"),
      material("Areia", 0.55, "m3"),
      material("Brita", 0.8, "m3")
    ], ["concreto", "concreto simples", "concreto nao armado"]),
    composition("std_concreto_estrutural", "Concreto estrutural", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 8, "saco"),
      material("Areia media", 0.52, "m3"),
      material("Brita 1", 0.78, "m3"),
      material("Aditivo plastificante", 0.8, "litro")
    ], ["concreto armado", "concreto estrutural", "estrutura", "viga", "pilar", "laje"]),
    composition("std_sapata_isolada_demo", "Sapata isolada demonstrativa", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 50, "kg"),
      material("Forma de madeira", 2.2, "m2"),
      material("Lastro de concreto magro", 0.05, "m3")
    ], ["sapata isolada", "fundacao sapata isolada"],
      "Composicao demonstrativa/editavel para sapata isolada. Nao substitui projeto estrutural, memoria de calculo ou composicao oficial.",
      { code: "DEMO-EST-SAPATA-001" }),
    composition("std_sapata_corrida_demo", "Sapata corrida demonstrativa", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 42, "kg"),
      material("Forma de madeira", 1.8, "m2"),
      material("Lastro de concreto magro", 0.04, "m3")
    ], ["sapata corrida", "fundacao corrida"],
      "Composicao demonstrativa/editavel para sapata corrida. Validar secoes, armadura e solo com projeto estrutural.",
      { code: "DEMO-EST-SAPATA-CORRIDA-001" }),
    composition("std_bloco_fundacao_demo", "Bloco de fundacao demonstrativo", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 55, "kg"),
      material("Forma de madeira", 2.4, "m2"),
      material("Lastro de concreto magro", 0.05, "m3")
    ], ["bloco de fundacao", "bloco fundacao"],
      "Composicao demonstrativa/editavel para bloco de fundacao. Validar cargas, armadura e projeto estrutural.",
      { code: "DEMO-EST-BLOCO-001" }),
    composition("std_baldrame_demo", "Baldrame demonstrativo", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 60, "kg"),
      material("Forma de madeira", 4.5, "m2")
    ], ["baldrame", "viga baldrame"],
      "Composicao demonstrativa/editavel para baldrame. Validar dimensoes, armadura e impermeabilizacao.",
      { code: "DEMO-EST-BALDRAME-001" }),
    composition("std_fundacao_concreto_armado_demo", "Fundacao em concreto armado demonstrativa", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 45, "kg"),
      material("Forma de madeira", 2, "m2"),
      material("Lastro de concreto magro", 0.05, "m3")
    ], ["sapata", "sapata isolada", "sapata corrida", "bloco de fundacao", "fundacao em concreto", "fundação em concreto"],
      "Composicao demonstrativa/editavel para fundacoes simples. Nao substitui projeto estrutural, memoria de calculo ou composicao oficial."),
    composition("std_forma_madeira", "Forma de madeira", "Fundacao / Estrutura", "m2", 10, [
      material("Compensado plastificado", 0.22, "m2"),
      material("Sarrafo de madeira", 0.55, "m"),
      material("Prego", 0.08, "kg"),
      material("Desmoldante", 0.04, "litro")
    ], ["forma", "caixaria", "madeira forma"]),
    composition("std_armacao_aco_ca50", "Armacao de aco CA-50", "Fundacao / Estrutura", "kg", 5, [
      material("Aco CA-50", 1, "kg"),
      material("Arame recozido", 0.025, "kg"),
      material("Espacador plastico", 0.08, "un")
    ], ["armacao", "armação", "ferro", "aco", "aço", "ca50"]),
    composition("std_pilar_concreto_armado", "Pilar de concreto armado demonstrativo", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 95, "kg"),
      material("Forma de madeira", 8, "m2")
    ], ["pilar", "coluna", "pilar de concreto armado"],
      "Composicao demonstrativa/editavel para pilar de concreto armado. Validar armadura, cobrimento e projeto estrutural.",
      { code: "DEMO-EST-PILAR-001", requiredParameters: ["largura", "comprimento", "altura"] }),
    composition("std_viga_concreto_armado", "Viga de concreto armado demonstrativa", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 85, "kg"),
      material("Forma de madeira", 6.5, "m2")
    ], ["viga", "viga de concreto armado"],
      "Composicao demonstrativa/editavel para viga de concreto armado. Validar armadura, vao e projeto estrutural.",
      { code: "DEMO-EST-VIGA-001", requiredParameters: ["largura", "altura", "comprimento"] }),
    composition("std_laje_concreto", "Laje macica ou pre-moldada", "Fundacao / Estrutura", "m2", 5, [
      material("Concreto estrutural", 0.1, "m3"),
      material("Aco CA-50", 7, "kg"),
      material("Forma/escoramento", 1, "m2")
    ], ["laje", "laje macica", "laje premoldada", "pre-moldada"]),
    composition("std_laje_macica_concreto_armado_demo", "Laje macica demonstrativa", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 70, "kg"),
      material("Forma/escoramento", 10, "m2")
    ], ["laje macica concreto armado", "laje macica por volume", "laje em concreto armado"],
      "Composicao demonstrativa/editavel para laje macica. Validar armadura, escoramento e projeto estrutural.",
      { code: "DEMO-EST-LAJE-MACICA-001" }),
    composition("std_laje_trelicada_demo", "Laje trelicada demonstrativa", "Fundacao / Estrutura", "m2", 5, [
      material("Vigota trelicada", 1, "m2"),
      material("Elemento de enchimento", 1, "m2"),
      material("Concreto para capa", 0.05, "m3"),
      material("Tela soldada", 1, "m2"),
      material("Escoramento", 1, "m2")
    ], ["laje trelicada", "laje treliçada", "laje com vigota trelicada"],
      "Composicao demonstrativa/editavel para laje trelicada. Conferir capa, intereixo, escoramento e especificacao do fornecedor."),
    composition("std_alvenaria", "Alvenaria de bloco ceramico", "Alvenaria / Vedacao", "m2", 5, [
      material("Bloco ceramico", 13, "un"),
      material("Cimento", 0.1, "saco"),
      material("Areia", 0.018, "m3"),
      material("Argamassa de assentamento", 18, "kg")
    ], ["alvenaria", "parede", "bloco", "bloco ceramico", "tijolo ceramico", "vedacao"]),
    composition("std_alvenaria_bloco_concreto", "Alvenaria de bloco de concreto", "Alvenaria / Vedacao", "m2", 5, [
      material("Bloco de concreto", 12.5, "un"),
      material("Argamassa de assentamento", 0.02, "m3"),
      material("Cimento", 0.12, "saco")
    ], ["parede bloco concreto", "bloco concreto", "alvenaria estrutural"]),
    composition("std_muro_bloco_demo", "Muro de bloco demonstrativo", "Alvenaria / Vedacao", "m2", 5, [
      material("Bloco de concreto", 12.5, "un"),
      material("Argamassa de assentamento", 0.02, "m3"),
      material("Cimento", 0.12, "saco"),
      material("Aco CA-50", 1.2, "kg")
    ], ["muro", "muro de bloco", "muro de bloco de concreto"],
      "Composicao demonstrativa/editavel para muro de bloco. Validar fundacao, graute, pilaretes e projeto estrutural quando aplicavel.",
      { code: "DEMO-EST-MURO-001" }),
    composition("std_verga_contraverga", "Verga e contraverga", "Alvenaria / Vedacao", "m", 5, [
      material("Concreto estrutural", 0.025, "m3"),
      material("Aco CA-50", 1.4, "kg"),
      material("Forma de madeira", 0.25, "m2")
    ], ["verga", "contraverga", "abertura"]),
    composition("std_grauteamento_simples", "Grauteamento simples", "Alvenaria / Vedacao", "m3", 5, [
      material("Graute", 1, "m3"),
      material("Cimento", 7, "saco"),
      material("Pedrisco", 0.75, "m3")
    ], ["graute", "grauteamento"]),
    composition("std_chapisco", "Chapisco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.05, "saco"),
      material("Areia", 0.006, "m3")
    ], ["chapisco", "massa chapisco"]),
    composition("std_emboco", "Emboco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.07, "saco"),
      material("Areia", 0.018, "m3")
    ], ["emboco", "emboço", "massa grossa", "massa"]),
    composition("std_reboco", "Reboco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.08, "saco"),
      material("Areia", 0.02, "m3")
    ], ["reboco", "massa fina", "massa"]),
    composition("std_contrapiso", "Contrapiso", "Revestimentos", "m2", 5, [
      material("Cimento", 0.12, "saco"),
      material("Areia", 0.025, "m3")
    ], ["contrapiso", "regularizacao piso", "regularização piso"]),
    composition("std_piso", "Piso ceramico", "Revestimentos", "m2", 3, [
      material("Piso ceramico", 1.05, "m2"),
      material("Argamassa colante", 0.25, "saco"),
      material("Rejunte", 0.2, "kg")
    ], ["piso", "piso ceramico", "ceramica piso"]),
    composition("std_revestimento", "Revestimento ceramico de parede", "Revestimentos", "m2", 3, [
      material("Revestimento ceramico", 1.05, "m2"),
      material("Argamassa colante", 0.25, "saco"),
      material("Rejunte", 0.18, "kg")
    ], ["revestimento", "azulejo", "ceramica parede", "parede ceramica"]),
    composition("std_rejuntamento", "Rejuntamento", "Revestimentos", "m2", 3, [
      material("Rejunte", 0.22, "kg"),
      material("Espacador", 0.08, "un"),
      material("Limpeza pos-rejunte", 0.02, "litro")
    ], ["rejunte", "rejuntamento"]),
    composition("std_pintura", "Pintura interna", "Revestimentos", "m2", 5, [
      material("Tinta", 0.12, "litro"),
      material("Massa corrida", 0.18, "kg")
    ], ["pintura", "pintura interna", "tinta parede"]),
    composition("std_pintura_externa", "Pintura externa", "Revestimentos", "m2", 5, [
      material("Tinta acrilica externa", 0.14, "litro"),
      material("Selador acrilico", 0.08, "litro"),
      material("Massa acrilica", 0.15, "kg")
    ], ["pintura externa", "fachada", "tinta externa"]),
    composition("std_telhado_madeira", "Estrutura de madeira para telhado", "Cobertura", "m2", 7, [
      material("Madeiramento", 0.045, "m3"),
      material("Ripa", 2.8, "m"),
      material("Caibro", 1.2, "m"),
      material("Terca de madeira", 0.35, "m"),
      material("Prego/parafuso de fixacao", 0.1, "kg"),
      material("Tratamento preservativo", 0.05, "litro")
    ], ["estrutura telhado", "madeiramento", "telhado madeira", "caibro", "ripa", "terca", "estrutura de madeira"]),
    composition("std_telhado", "Telha ceramica", "Cobertura", "m2", 7, [
      material("Telha ceramica", 16, "un"),
      material("Cumeeira ceramica", 0.25, "un"),
      material("Prego/arame de fixacao", 0.04, "kg")
    ], ["telhado", "telha", "telha ceramica", "cobertura ceramica"], null, { requiredParameters: ["tipo_cobertura"] }),
    composition("std_telha_fibrocimento", "Telha fibrocimento", "Cobertura", "m2", 5, [
      material("Telha fibrocimento", 1.05, "m2"),
      material("Parafuso de fixacao", 2.5, "un"),
      material("Arruela de vedacao", 2.5, "un")
    ], ["fibrocimento", "telha brasilit", "cobertura fibrocimento"]),
    composition("std_rufo_calha", "Rufo/calha simples", "Cobertura", "m", 5, [
      material("Chapa galvanizada", 1.05, "m"),
      material("Selante PU", 0.08, "tubo"),
      material("Parafuso/bucha", 2, "un")
    ], ["rufo", "calha", "pingadeira"], null, { requiredParameters: ["comprimento_linear"] }),
    composition("std_ponto_eletrico", "Ponto eletrico simples", "Instalacoes", "un", 5, [
      material("Caixa eletrica", 1, "un"),
      material("Eletroduto", 3, "m"),
      material("Cabo eletrico", 9, "m"),
      material("Tomada/interruptor", 1, "un")
    ], ["ponto eletrico", "tomada", "interruptor", "fiacao", "fiação"]),
    composition("std_eletroduto", "Eletroduto embutido", "Instalacoes", "m", 3, [
      material("Eletroduto", 1.03, "m"),
      material("Conexoes eletricas", 0.15, "un"),
      material("Fixadores", 0.4, "un")
    ], ["eletroduto", "conduite", "conduíte"]),
    composition("std_cabo_eletrico", "Cabo eletrico", "Instalacoes", "m", 3, [
      material("Cabo eletrico", 1.05, "m"),
      material("Fita isolante", 0.01, "rolo"),
      material("Identificador", 0.02, "un")
    ], ["cabo", "fio", "fiacao", "fiação", "cabo eletrico"]),
    composition("std_ponto_hidraulico_agua_fria", "Ponto hidraulico agua fria", "Instalacoes", "un", 5, [
      material("Tubo PVC agua fria", 3, "m"),
      material("Conexoes PVC agua fria", 3, "un"),
      material("Registro/terminal", 1, "un")
    ], ["ponto hidraulico", "agua fria", "água fria"]),
    composition("std_ponto_sanitario", "Ponto sanitario", "Instalacoes", "un", 5, [
      material("Tubo PVC esgoto", 3, "m"),
      material("Conexoes PVC esgoto", 3, "un"),
      material("Caixa sifonada/terminal", 0.5, "un")
    ], ["ponto sanitario", "esgoto banheiro"]),
    composition("std_esgoto", "Tubulacao PVC esgoto", "Instalacoes", "m", 3, [
      material("Tubo PVC esgoto", 1.03, "m"),
      material("Conexoes PVC", 0.25, "un")
    ], ["tubulacao esgoto", "tubulação esgoto", "esgoto", "pvc esgoto"]),
    composition("std_agua", "Tubulacao PVC agua fria", "Instalacoes", "m", 3, [
      material("Tubo PVC agua", 1.03, "m"),
      material("Conexoes PVC", 0.2, "un")
    ], ["tubulacao agua", "tubulação agua", "agua fria", "água fria", "pvc agua"]),
    composition("std_impermeabilizacao_simples", "Impermeabilizacao simples", "Outros servicos uteis", "m2", 5, [
      material("Primer", 0.12, "litro"),
      material("Manta/argamassa impermeavel", 1.05, "m2"),
      material("Tela estruturante", 0.15, "m2")
    ], ["impermeabilizacao", "impermeabilização", "manta", "infiltracao"]),
    composition("std_forro_gesso", "Forro de gesso", "Outros servicos uteis", "m2", 5, [
      material("Placa de gesso", 1.05, "m2"),
      material("Perfil metalico", 1.8, "m"),
      material("Parafuso", 12, "un"),
      material("Massa para junta", 0.25, "kg")
    ], ["forro", "gesso", "forro gesso"]),
    composition("std_drywall", "Drywall", "Outros servicos uteis", "m2", 5, [
      material("Chapa drywall", 2.1, "m2"),
      material("Montante/guia metalica", 2.2, "m"),
      material("Parafuso drywall", 18, "un"),
      material("Massa e fita para junta", 0.3, "kg")
    ], ["drywall", "parede drywall", "gesso acartonado"]),
    composition("std_pavimentacao_intertravada", "Pavimentacao intertravada", "Outros servicos uteis", "m2", 5, [
      material("Paver/bloco intertravado", 1.03, "m2"),
      material("Areia de assentamento", 0.05, "m3"),
      material("Po de pedra", 0.03, "m3")
    ], ["paver", "intertravado", "pavimentacao", "pavimentação"]),
    composition("std_meio_fio", "Meio-fio", "Outros servicos uteis", "m", 5, [
      material("Meio-fio pre-moldado", 1.02, "m"),
      material("Concreto de assentamento", 0.025, "m3"),
      material("Argamassa de rejunte", 0.006, "m3")
    ], ["meio fio", "meio-fio", "guia"]),
    composition("std_drenagem_simples", "Drenagem simples", "Outros servicos uteis", "m", 5, [
      material("Tubo drenante/PVC", 1.03, "m"),
      material("Brita", 0.08, "m3"),
      material("Manta geotextil", 1.1, "m2")
    ], ["drenagem", "dreno", "agua pluvial", "água pluvial"]),
    composition("std_radier", "Radier demonstrativo", "Fundacao / Estrutura", "m3", 8, [
      material("Concreto estrutural", 1, "m3"),
      material("Tela soldada", 9, "m2"),
      material("Brita/lastro", 0.5, "m3"),
      material("Lona plastica", 8.5, "m2"),
      material("Espacador", 32, "un")
    ], ["radier", "fundacao radier", "fundação radier", "laje radier", "base radier"],
      "Composicao demonstrativa/editavel para radier. Validar espessura, armadura, solo, carga e projeto estrutural.",
      { code: "DEMO-EST-RADIER-001", requiredParameters: ["espessura"] }),
    composition("std_quadro_distribuicao", "Quadro de distribuicao", "Instalacoes", "un", 5, [
      material("Quadro de distribuicao", 1, "un"),
      material("Disjuntor", 6, "un"),
      material("Barramento", 1, "un"),
      material("Trilho DIN", 1, "un"),
      material("Conectores/terminais", 1, "un"),
      material("Identificacao/circuitos", 1, "un")
    ], ["quadro de distribuicao", "quadro de distribuição", "quadro eletrico", "quadro elétrico", "qdc", "qd", "quadro disjuntores"],
      "Estimativa basica. Validar carga, circuitos, normas e projeto eletrico."),
    composition("std_caixa_dagua", "Caixa d'agua", "Instalacoes", "un", 5, [
      material("Caixa d'agua", 1, "un"),
      material("Flange/adaptador", 2, "un"),
      material("Registro", 1, "un"),
      material("Tubo PVC agua fria", 3, "m"),
      material("Conexoes PVC", 4, "un"),
      material("Fita veda rosca", 1, "un")
    ], ["caixa dagua", "caixa d'agua", "reservatorio", "reservatório", "caixa de agua", "caixa de água"],
      "Validar volume, altura, base de apoio e projeto hidraulico.",
      { requiredParameters: ["capacidade_litros"] }),
    composition("std_sarjeta_concreto", "Sarjeta de concreto", "Outros servicos uteis", "m", 5, [
      material("Concreto simples", 0.04, "m3"),
      material("Forma lateral", 0.3, "m2"),
      material("Brita/regularizacao", 0.03, "m3")
    ], ["sarjeta", "sarjeta de concreto", "canaleta de concreto", "drenagem superficial"],
      "Estimativa preliminar. Validar secao, declividade e drenagem."),
    composition("std_textura_externa", "Textura externa", "Revestimentos", "m2", 8, [
      material("Selador acrilico", 0.08, "litro"),
      material("Textura acrilica", 1.2, "kg"),
      material("Fita/mascaramento", 0.03, "un")
    ], ["textura externa", "textura acrilica externa", "textura fachada", "grafiato", "revestimento texturizado"],
      "Validar rendimento do fabricante, tipo de superficie e numero de demaos."),
    composition("std_tela_soldada", "Tela soldada", "Fundacao / Estrutura", "m2", 8, [
      material("Tela soldada", 1.08, "m2"),
      material("Espacador", 4, "un"),
      material("Arame recozido", 0.03, "kg")
    ], ["tela soldada", "tela q92", "tela q138", "malha pop", "tela para concreto", "armadura em tela"],
      "Validar tipo da tela, bitola, malha, transpasse e projeto estrutural.",
      { requiredParameters: ["tipo_tela"] })
  ];

  function getCompositions() {
    const baseCatalog = DEFAULT_COMPOSITIONS.map(function (item) {
      return Object.assign({}, item, {
        aliases: (item.aliases || []).slice(),
        requiredParameters: (item.requiredParameters || []).slice(),
        materials: (item.materials || []).map(function (mat) {
          return Object.assign({}, mat);
        })
      });
    });
    const windowCatalog = getWindowExternalCompositions();
    const externalCatalog = windowCatalog.length ? windowCatalog : importedCompositionCatalog;
    const importedCatalog = importedOfficialBaseCatalog.concat(externalCatalog);
    return mergeCompositionCatalogs(baseCatalog, importedCatalog);
  }

  const EXTRA_ALIASES_BY_ID = {
    std_escavacao_manual: ["escavar", "escavar vala", "vala", "fundacao", "fundação"],
    std_lastro_concreto_magro: ["lastro", "lastro de concreto", "concreto magro"],
    std_concreto_simples: ["concreto simples", "concreto nao armado", "concretagem simples"],
    std_concreto_estrutural: ["concreto estrutural", "concreto armado"],
    std_sapata_isolada_demo: ["sapata isolada demonstrativa", "sapata", "sapata isolada"],
    std_sapata_corrida_demo: ["sapata corrida demonstrativa", "sapata corrida"],
    std_bloco_fundacao_demo: ["bloco de fundacao demonstrativo", "bloco de fundacao", "bloco fundacao"],
    std_baldrame_demo: ["baldrame demonstrativo", "baldrame", "viga baldrame"],
    std_fundacao_concreto_armado_demo: ["fundacao em concreto armado demonstrativa", "fundacao em concreto"],
    std_armacao_aco_ca50: ["aco", "aço", "aco ca 50", "aco ca-50", "ca 50", "ca-50", "armadura", "armacao", "armação", "ferro", "vergalhao", "vergalhão", "arame"],
    std_pilar_concreto_armado: ["pilar demonstrativo", "pilar", "pilares", "pilar de concreto", "pilar de concreto armado", "coluna"],
    std_viga_concreto_armado: ["viga demonstrativa", "viga", "vigas", "viga de concreto", "viga de concreto armado"],
    std_laje_concreto: ["laje", "laje macica", "laje pre moldada", "laje premoldada"],
    std_laje_macica_concreto_armado_demo: ["laje macica em concreto armado demonstrativa", "laje macica concreto armado", "laje macica por volume"],
    std_laje_trelicada_demo: ["laje trelicada", "laje treliçada", "laje com vigota trelicada"],
    std_alvenaria: ["alvenaria", "parede", "bloco ceramico", "bloco cerâmico", "tijolo ceramico", "tijolo cerâmico", "tijolo baiano"],
    std_alvenaria_bloco_concreto: ["alvenaria de bloco de concreto", "parede de bloco de concreto", "bloco de concreto", "bloco concreto"],
    std_muro_bloco_demo: ["muro demonstrativo", "muro", "muro de bloco", "muro de bloco de concreto"],
    std_verga_contraverga: ["verga", "contraverga", "verga e contraverga"],
    std_grauteamento_simples: ["graute", "grautear", "grauteamento"],
    std_rejuntamento: ["rejunte", "rejuntar", "rejuntamento"],
    std_pintura: ["pintura interna", "pintar parede interna", "pintar", "tinta interna"],
    std_pintura_externa: ["pintura externa", "pintar fachada", "fachada", "tinta externa"],
    std_telhado_madeira: ["madeiramento", "estrutura de madeira", "estrutura de madeira para telhado", "caibro", "ripa", "terca", "terça"],
    std_telhado: ["telhado", "cobertura", "cobrir", "telha ceramica", "telha cerâmica", "quantas telhas"],
    std_telha_fibrocimento: ["telha fibrocimento", "fibrocimento", "cobertura fibrocimento"],
    std_rufo_calha: ["rufo", "calha", "rufo e calha", "rufo/calha"],
    std_ponto_eletrico: ["ponto eletrico", "ponto elétrico", "pontos eletricos", "pontos elétricos", "eletrica", "elétrica"],
    std_eletroduto: ["eletroduto", "eletroduto embutido"],
    std_cabo_eletrico: ["cabo eletrico", "cabo elétrico", "fiacao", "fiação"],
    std_ponto_hidraulico_agua_fria: ["ponto hidraulico", "ponto hidráulico", "pontos hidraulicos", "agua fria", "água fria"],
    std_ponto_sanitario: ["ponto sanitario", "ponto sanitário", "pontos sanitarios", "pontos sanitários"],
    std_tubulacao_pvc_esgoto: ["tubulacao pvc esgoto", "tubulação pvc esgoto", "tubo esgoto", "esgoto"],
    std_tubulacao_pvc_agua_fria: ["tubulacao pvc agua fria", "tubulação pvc água fria", "tubo agua fria", "tubo água fria", "agua fria", "água fria"],
    std_drenagem_simples: ["drenagem", "dreno", "tubo drenante", "drenagem simples"],
    std_meio_fio: ["meio fio", "meio-fio", "guia"],
    std_pavimentacao_intertravada: ["paver", "intertravado", "pavimentacao intertravada", "pavimentação intertravada"],
    std_radier: ["radier", "fundacao radier", "fundação radier", "laje radier", "base radier"],
    std_quadro_distribuicao: ["quadro de distribuicao", "quadro de distribuição", "quadro eletrico", "quadro elétrico", "qdc", "qd", "quadro disjuntores"],
    std_caixa_dagua: ["caixa dagua", "caixa d agua", "caixa d'agua", "caixa de agua", "caixa de água", "reservatorio", "reservatório"],
    std_sarjeta_concreto: ["sarjeta", "sarjeta de concreto", "canaleta de concreto", "drenagem superficial"],
    std_textura_externa: ["textura externa", "textura acrilica externa", "textura acrílica externa", "textura fachada", "grafiato", "revestimento texturizado"],
    std_tela_soldada: ["tela soldada", "tela q92", "tela q138", "malha pop", "tela para concreto", "armadura em tela"]
  };

  function getCompositionTerms(item) {
    return [item.service, item.name]
      .concat(item.aliases || [])
      .concat(EXTRA_ALIASES_BY_ID[item.id] || [])
      .map(normalize)
      .filter(Boolean)
      .filter(function (term, index, list) {
        return list.indexOf(term) === index;
      });
  }

  function wordCount(text) {
    return normalize(text).split(" ").filter(Boolean).length;
  }

  function hasTerm(text, term) {
    const cleanTerm = normalize(term);
    if (!cleanTerm) {
      return false;
    }
    return (" " + text + " ").indexOf(" " + cleanTerm + " ") >= 0 ||
      (cleanTerm.length >= 5 && text.indexOf(cleanTerm) >= 0);
  }

  function blocksComposition(text, item) {
    const id = item.id;
    const hasSpecificRoofType = hasTerm(text, "telha ceramica") || hasTerm(text, "telha cerâmica") ||
      hasTerm(text, "ceramico") || hasTerm(text, "ceramica") ||
      hasTerm(text, "fibrocimento") || hasTerm(text, "madeiramento") || hasTerm(text, "estrutura de madeira");
    if ((id === "std_alvenaria" || id === "std_concreto_simples") && hasTerm(text, "bloco de concreto")) {
      return true;
    }
    if (id === "std_alvenaria" && (hasTerm(text, "pintar") || hasTerm(text, "pintura externa") || hasTerm(text, "pintura interna"))) {
      return true;
    }
    if (id === "std_pintura" && hasTerm(text, "pintura externa")) {
      return true;
    }
    if (id === "std_piso" && (hasTerm(text, "rejuntar") || hasTerm(text, "rejuntamento"))) {
      return true;
    }
    if (id === "std_concreto_estrutural" && (hasTerm(text, "pilar") || hasTerm(text, "viga") || hasTerm(text, "baldrame") || hasTerm(text, "laje"))) {
      return true;
    }
    if (id === "std_alvenaria" && (hasTerm(text, "grautear") || hasTerm(text, "grauteamento") || hasTerm(text, "graute"))) {
      return true;
    }
    if (id === "std_telhado" && hasTerm(text, "fibrocimento")) {
      return true;
    }
    if ((id === "std_telhado" || id === "std_telhado_madeira") &&
      (hasTerm(text, "cobertura") || hasTerm(text, "cobrir") || hasTerm(text, "telhado")) &&
      !hasSpecificRoofType) {
      return true;
    }
    if (id === "std_laje_concreto" && hasTerm(text, "tela soldada")) {
      return true;
    }
    if (id === "std_concreto_simples" && hasTerm(text, "sarjeta")) {
      return true;
    }
    return false;
  }

  function scoreComposition(item, text, requestedUnit) {
    if (blocksComposition(text, item)) {
      return -1;
    }
    const service = normalize(item.service);
    const unit = normalizeUnit(requestedUnit);
    let score = 0;
    if (service && text === service) {
      score += 1000;
    } else if (service && hasTerm(text, service)) {
      score += 700 + wordCount(service) * 25;
    }
    getCompositionTerms(item).forEach(function (term) {
      if (!term || term === service || !hasTerm(text, term)) {
        return;
      }
      const words = wordCount(term);
      score += words > 1 ? 360 + words * 35 : 240;
    });
    if (unit && unit !== "un" && normalizeUnit(item.productionUnit) === unit) {
      score += 40;
    }
    if (unit && normalizeUnit(item.productionUnit) !== unit) {
      return -1;
    }
    if (score > 0) {
      score += getSourcePriority(item);
    }
    return score;
  }

  function rankCompositions(query, options) {
    const settings = options || {};
    const text = normalize(typeof query === "string" ? query : (query && (query.service || query.name || query.id)));
    const requestedUnit = settings.unit || (query && query.unit);
    const unit = requestedUnit ? normalizeUnit(requestedUnit) : "";
    if (!text) {
      return [];
    }
    return getCompositions().map(function (item) {
      return {
        item: item,
        score: scoreComposition(item, text, unit)
      };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score ||
        getSourcePriority(b.item) - getSourcePriority(a.item) ||
        wordCount(b.item.service) - wordCount(a.item.service);
    });
  }

  function findBestComposition(query, options) {
    const ranked = rankCompositions(query, options);
    return ranked.length ? ranked[0].item : null;
  }

  function findComposition(query) {
    const ranked = rankCompositions(query);
    return ranked.length ? ranked[0].item : null;
  }

  function hasAny(text, terms) {
    return terms.some(function (term) {
      return text.indexOf(normalize(term)) >= 0;
    });
  }

  function isCompositionRequest(message) {
    const text = normalize(message);
    const intentTerms = [
      "composicao", "compor", "calcular materiais", "calcule materiais",
      "materiais para", "qual material", "quanto material", "quantas telhas",
      "qual o madeiramento", "vou fazer", "vou executar", "quero fazer",
      "quero construir", "preciso fazer", "consumo previsto", "lista de material",
      "lista de materiais", "quantitativo", "quanto comprar", "quanto preciso",
      "preciso calcular", "quero cobrir", "cobrir", "instalar", "executar",
      "rejuntar", "pintar", "grautear", "escavar", "concretar"
    ];
    return hasAny(text, intentTerms) && rankCompositions(text).length > 0;
  }

  function isStockAiRequest(message) {
    const geometry = parseGeometryRequest(message);
    return !!(geometry && geometry.detected) || isCompositionRequest(message);
  }

  function normalizeRequestedUnit(unit) {
    return displayUnit(unit);
  }

  function getGeometryServiceName(serviceType, geometryType) {
    if (serviceType === "alvenaria") {
      return "Alvenaria de bloco ceramico";
    }
    if (serviceType === "pilar") {
      return "Pilar de concreto armado demonstrativo";
    }
    if (serviceType === "viga") {
      return "Viga de concreto armado demonstrativa";
    }
    if (serviceType === "baldrame") {
      return "Baldrame demonstrativo";
    }
    if (serviceType === "sapata_corrida") {
      return "Sapata corrida demonstrativa";
    }
    if (serviceType === "bloco_fundacao") {
      return "Bloco de fundacao demonstrativo";
    }
    if (serviceType === "radier") {
      return "Radier demonstrativo";
    }
    if (serviceType === "laje") {
      return geometryType === "volume" ? "Laje macica demonstrativa" : "Laje macica ou pre-moldada";
    }
    if (serviceType === "sapata") {
      return "Sapata isolada demonstrativa";
    }
    if (serviceType === "muro") {
      return "Muro de bloco demonstrativo";
    }
    if (serviceType === "reservatorio") {
      return "";
    }
    if (serviceType === "rufo" || serviceType === "calha" || serviceType === "pingadeira") {
      return "Rufo/calha simples";
    }
    if (serviceType === "eletroduto") {
      return "Eletroduto embutido";
    }
    if (serviceType === "cabo") {
      return "Cabo eletrico";
    }
    if (serviceType === "tubulacao_esgoto") {
      return "Tubulacao PVC esgoto";
    }
    if (serviceType === "tubulacao_agua") {
      return "Tubulacao PVC agua fria";
    }
    if (serviceType === "tomada" || serviceType === "interruptor") {
      return "Ponto eletrico simples";
    }
    if (serviceType === "caixa_dagua") {
      return "Caixa d'agua";
    }
    if (serviceType === "piso") {
      return "Piso ceramico";
    }
    if (serviceType === "cobertura") {
      return "Telha ceramica";
    }
    return "";
  }

  function parseDimensionNumber(value) {
    return roundQuantity(parseNumber(value));
  }

  function centimetersToMeters(value) {
    return roundQuantity(parseNumber(value) / 100);
  }

  function parseStructuralDimension(value, unit) {
    const parsed = parseDimensionNumber(value);
    const normalizedUnit = normalize(unit);
    if (normalizedUnit.indexOf("cm") >= 0 || normalizedUnit.indexOf("centimetro") >= 0) {
      return centimetersToMeters(value);
    }
    if (normalizedUnit.indexOf("m") === 0 || normalizedUnit.indexOf("metro") >= 0) {
      return parsed;
    }
    return parsed > 10 ? roundQuantity(parsed / 100) : parsed;
  }

  function formatStructuralSection(width, height) {
    return formatMeters(width) + " x " + formatMeters(height);
  }

  function formatMeters(value) {
    return formatQuantity(value) + " m";
  }

  function formatSquareMeters(value) {
    return formatQuantity(value) + " m2";
  }

  function formatCubicMeters(value) {
    return formatQuantity(value) + " m3";
  }

  function buildGeometryResult(serviceType, geometryType, quantity, unit, explanation, dimensions, label) {
    return {
      detected: true,
      complete: true,
      serviceType: serviceType,
      service: getGeometryServiceName(serviceType, geometryType),
      geometryType: geometryType,
      quantity: roundQuantity(quantity),
      unit: unit,
      explanation: explanation,
      dimensions: dimensions || {},
      label: label || serviceType
    };
  }

  function buildIncompleteGeometryResult(serviceType, question, label) {
    return {
      detected: true,
      complete: false,
      serviceType: serviceType,
      service: getGeometryServiceName(serviceType, ""),
      geometryType: "",
      quantity: 0,
      unit: "",
      explanation: "",
      dimensions: {},
      label: label || serviceType,
      questions: [question]
    };
  }

  const LINEAR_GEOMETRY_SERVICES = [
    { serviceType: "rufo", label: "rufo", terms: ["rufo"], question: "Qual o comprimento total do rufo em metros?" },
    { serviceType: "calha", label: "calha", terms: ["calha", "calhas"], question: "Qual o comprimento total da calha em metros?" },
    { serviceType: "cumeeira", label: "cumeeira", terms: ["cumeeira"], question: "Qual o comprimento total da cumeeira em metros?" },
    { serviceType: "rodape", label: "rodape", terms: ["rodape", "roda pe"], question: "Qual o comprimento total do rodape em metros?" },
    { serviceType: "roda_meio", label: "roda-meio", terms: ["roda meio", "roda meio", "rodameio"], question: "Qual o comprimento total do roda-meio em metros?" },
    { serviceType: "roda_forro", label: "roda-forro", terms: ["roda forro", "rodaforro"], question: "Qual o comprimento total do roda-forro em metros?" },
    { serviceType: "pingadeira", label: "pingadeira", terms: ["pingadeira"], question: "Qual o comprimento total da pingadeira em metros?" },
    { serviceType: "corrimao", label: "corrimao", terms: ["corrimao", "corrimao"], question: "Qual o comprimento total do corrimao em metros?" },
    { serviceType: "guarda_corpo", label: "guarda-corpo", terms: ["guarda corpo", "guardacorpo"], question: "Qual o comprimento total do guarda-corpo em metros?" },
    { serviceType: "eletroduto", label: "eletroduto", terms: ["eletroduto", "conduite"], question: "Qual o comprimento total do eletroduto em metros?" },
    { serviceType: "tubulacao", label: "tubulacao", terms: ["tubulacao", "tubo"], question: "Qual o comprimento total da tubulacao em metros?" },
    { serviceType: "cabo", label: "cabo", terms: ["cabo", "fio"], question: "Qual o comprimento total do cabo em metros?" }
  ];

  const UNIT_GEOMETRY_SERVICES = [
    { serviceType: "porta", label: "porta", terms: ["porta", "portas"], question: "Quantas portas serao instaladas?" },
    { serviceType: "janela", label: "janela", terms: ["janela", "janelas"], question: "Quantas janelas serao instaladas?" },
    { serviceType: "luminaria", label: "luminaria", terms: ["luminaria", "luminarias"], question: "Quantas luminarias serao instaladas?" },
    { serviceType: "tomada", label: "tomada", terms: ["tomada", "tomadas"], question: "Quantas tomadas serao instaladas?" },
    { serviceType: "interruptor", label: "interruptor", terms: ["interruptor", "interruptores"], question: "Quantos interruptores serao instalados?" },
    { serviceType: "caixa_inspecao", label: "caixa de inspecao", terms: ["caixa de inspecao", "caixas de inspecao"], question: "Quantas caixas de inspecao serao instaladas?" },
    { serviceType: "caixa_dagua", label: "caixa d'agua", terms: ["caixa dagua", "caixas dagua", "caixa d agua", "caixas d agua"], question: "Quantas caixas d'agua serao instaladas?" }
  ];

  function findGeometryService(text, services) {
    return services.find(function (service) {
      return hasAny(text, service.terms);
    }) || null;
  }

  function parseLinearQuantity(originalMessage, text, service) {
    const number = "(\\d+(?:[.,]\\d+)?)";
    const unit = "(?:m\\b|ml\\b|metro\\b|metros\\b|m\\s*linear\\b|metros\\s+lineares\\b)";
    const terms = service.terms.map(function (term) {
      return term.replace(/\s+/g, "\\s*[- ]?\\s*");
    }).join("|");
    const source = normalizeQuantityText(originalMessage);
    const before = source.match(new RegExp(number + "\\s*" + unit + "\\s*(?:de\\s+)?(?:" + terms + ")", "i"));
    const after = source.match(new RegExp("(?:" + terms + ")\\s*(?:" + number + "\\s*" + unit + "|" + number + "\\b)", "i"));
    const match = before || after;
    if (!match) {
      return null;
    }
    return parseDimensionNumber(before ? match[1] : (match[1] || match[2]));
  }

  function parseUnitQuantity(originalMessage, text, service) {
    const number = "(\\d+(?:[.,]\\d+)?)";
    const unit = "(?:un\\b|unidade\\b|unidades\\b|pecas\\b|peças\\b)?";
    const terms = service.terms.map(function (term) {
      return term.replace(/\s+/g, "\\s*['’ -]?\\s*");
    }).join("|");
    const source = text;
    const before = source.match(new RegExp(number + "\\s*" + unit + "\\s*(?:de\\s+)?(?:" + terms + ")", "i"));
    const after = source.match(new RegExp("(?:" + terms + ")\\s*(?:" + number + "\\s*" + unit + "|" + number + "\\b)", "i"));
    const match = before || after;
    if (!match) {
      return null;
    }
    return parseDimensionNumber(before ? match[1] : (match[1] || match[2]));
  }

  function normalizeQuantityText(value) {
    return clean(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9.,]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripStockContext(message) {
    return clean(message)
      .replace(/\b(?:e\s+)?(?:tenho\s+em\s+estoque|em\s+estoque|estoque|disponivel|disponivel|ja\s+possuo|ja\s+possuo|no\s+estoque\s+existe)\b[\s\S]*$/i, "")
      .trim();
  }

  function buildLinearGeometryResult(service, quantity) {
    return buildGeometryResult(
      service.serviceType,
      "length",
      quantity,
      "m",
      "Comprimento identificado: " + formatMeters(quantity) + " de " + service.label,
      { length: quantity },
      service.label
    );
  }

  function buildUnitGeometryResult(service, quantity) {
    return buildGeometryResult(
      service.serviceType,
      "unit",
      quantity,
      "un",
      "Quantidade identificada: " + formatQuantity(quantity) + " unidades de " + service.label,
      { count: quantity },
      service.label
    );
  }

  function hasExplicitCoverageType(text) {
    return hasTerm(text, "telha ceramica") || hasTerm(text, "telha cerâmica") ||
      hasTerm(text, "ceramico") || hasTerm(text, "ceramica") ||
      hasTerm(text, "fibrocimento") || hasTerm(text, "metalica") || hasTerm(text, "metálica") ||
      hasTerm(text, "sanduiche") || hasTerm(text, "sanduíche") || hasTerm(text, "laje impermeabilizada");
  }

  function hasCompatibleComposition(serviceName, unit) {
    const compositionData = findComposition({ service: serviceName, unit: unit, requestedUnit: unit });
    return !!(compositionData && normalizeUnit(compositionData.productionUnit) === normalizeUnit(unit));
  }

  function createGeometryServiceEntry(service, geometry) {
    if (!service || !service.service || !hasCompatibleComposition(service.service, service.unit)) {
      return null;
    }
    return {
      service: service.service,
      quantity: service.quantity,
      unit: service.unit,
      requestedUnit: service.unit,
      materialHint: service.label || service.serviceType || service.service,
      score: 500,
      geometry: geometry
    };
  }

  function getGeometryServicesWithoutComposition(geometry) {
    if (!geometry || !geometry.detected || !geometry.complete) {
      return [];
    }
    const source = geometry.geometryType === "composite"
      ? (geometry.derivedServices || [])
      : [{
        serviceType: geometry.serviceType,
        service: geometry.service,
        quantity: geometry.quantity,
        unit: geometry.unit,
        label: geometry.label,
        explanation: geometry.explanation
      }];
    return source.filter(function (service) {
      return !service.service || !hasCompatibleComposition(service.service, service.unit);
    });
  }

  function parseCompositeGeometryRequest(message) {
    const originalMessage = clean(message);
    const text = normalize(originalMessage);
    const isHouse = hasTerm(text, "casa");
    const isShed = hasTerm(text, "galpao") || hasTerm(text, "galpão");
    const isRoom = hasAny(text, ["ambiente", "comodo", "sala"]);
    if (!isHouse && !isShed && !isRoom) {
      return null;
    }

    const number = "(\\d+(?:[.,]\\d+)?)";
    const planMatch = originalMessage.match(new RegExp(number + "\\s*(?:m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(?:m|metros?)?", "i"));
    if (!planMatch) {
      return buildIncompleteGeometryResult(
        "edificacao_composta",
        "Qual o comprimento e a largura da " + (isShed ? "galpao" : isRoom ? "ambiente" : "casa") + "?",
        isShed ? "Galpao" : isRoom ? "Ambiente" : "Casa"
      );
    }

    const length = parseDimensionNumber(planMatch[1]);
    const width = parseDimensionNumber(planMatch[2]);
    const heightMatch = originalMessage.match(new RegExp("(?:pe\\s*[- ]?\\s*direito|pé\\s*[- ]?\\s*direito|altura)\\s*(?:de\\s*)?" + number + "\\s*(?:m|metros?)?", "i"));
    const height = heightMatch ? parseDimensionNumber(heightMatch[1]) : (isShed ? 6 : 3);
    const floorArea = roundQuantity(length * width);
    const perimeter = roundQuantity(2 * (length + width));
    const wallArea = roundQuantity(perimeter * height);
    const roofArea = floorArea;
    const label = isShed ? "Galpao" : isRoom ? "Ambiente" : "Casa";
    const warning = "Estimativa simplificada para planejamento inicial. Nao desconta vaos, inclinacao de telhado, beirais, paredes internas, perdas especificas nem detalhes estruturais.";
    const coverageHasType = hasExplicitCoverageType(text);

    return {
      detected: true,
      complete: true,
      serviceType: "edificacao_composta",
      service: "",
      geometryType: "composite",
      quantity: null,
      unit: "composite",
      explanation: "Geometria composta identificada: planta " + formatMeters(length) + " x " + formatMeters(width) + ", pe-direito " + formatMeters(height),
      dimensions: {
        length: length,
        width: width,
        height: height,
        perimeter: perimeter,
        floorArea: floorArea,
        wallArea: wallArea,
        roofArea: roofArea
      },
      derivedServices: [
        {
          serviceType: "alvenaria",
          service: getGeometryServiceName("alvenaria", "area"),
          quantity: wallArea,
          unit: "m2",
          explanation: "Paredes externas estimadas: perimetro " + formatMeters(perimeter) + " x pe-direito " + formatMeters(height) + " = " + formatSquareMeters(wallArea)
        },
        {
          serviceType: "piso",
          service: getGeometryServiceName("piso", "area"),
          quantity: floorArea,
          unit: "m2",
          explanation: "Piso estimado: " + formatMeters(length) + " x " + formatMeters(width) + " = " + formatSquareMeters(floorArea)
        },
        {
          serviceType: "cobertura",
          service: coverageHasType ? getGeometryServiceName("cobertura", "area") : "",
          quantity: roofArea,
          unit: "m2",
          label: "cobertura",
          explanation: "Cobertura inicial estimada: " + formatMeters(length) + " x " + formatMeters(width) + " = " + formatSquareMeters(roofArea) + ", sem inclinacao"
        }
      ],
      label: label,
      warning: warning
    };
  }

  function parseGeometryRequest(message) {
    const originalMessage = stripStockContext(message);
    const text = normalize(originalMessage);
    const number = "(\\d+(?:[.,]\\d+)?)";

    const composite = parseCompositeGeometryRequest(originalMessage);
    if (composite) {
      return composite;
    }

    const linearService = findGeometryService(text, LINEAR_GEOMETRY_SERVICES);
    if (linearService) {
      const linearQuantity = parseLinearQuantity(originalMessage, text, linearService);
      const detectedLinearService = linearService.serviceType === "tubulacao" && hasTerm(text, "esgoto")
        ? Object.assign({}, linearService, { serviceType: "tubulacao_esgoto", label: "tubulacao de esgoto" })
        : linearService.serviceType === "tubulacao" && (hasTerm(text, "agua") || hasTerm(text, "agua fria"))
          ? Object.assign({}, linearService, { serviceType: "tubulacao_agua", label: "tubulacao de agua fria" })
          : linearService;
      if (linearQuantity) {
        return buildLinearGeometryResult(detectedLinearService, linearQuantity);
      }
      return buildIncompleteGeometryResult(detectedLinearService.serviceType, detectedLinearService.question, detectedLinearService.label);
    }

    const unitService = findGeometryService(text, UNIT_GEOMETRY_SERVICES);
    if (unitService) {
      const unitQuantity = parseUnitQuantity(originalMessage, text, unitService);
      if (unitQuantity) {
        return buildUnitGeometryResult(unitService, unitQuantity);
      }
      return buildIncompleteGeometryResult(unitService.serviceType, unitService.question, unitService.label);
    }

    if (hasTerm(text, "reservatorio") || hasTerm(text, "reservatório")) {
      const reservoirMatch = originalMessage.match(new RegExp(number + "\\s*(?:m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(?:m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(?:m|metros?)?", "i"));
      if (reservoirMatch) {
        const length = parseDimensionNumber(reservoirMatch[1]);
        const width = parseDimensionNumber(reservoirMatch[2]);
        const height = parseDimensionNumber(reservoirMatch[3]);
        const volume = roundQuantity(length * width * height);
        return buildGeometryResult(
          "reservatorio",
          "volume",
          volume,
          "m3",
          "Volume geometrico bruto: " + formatMeters(length) + " x " + formatMeters(width) + " x " + formatMeters(height) + " = " + formatCubicMeters(volume) + ". Nao e dimensionamento estrutural.",
          { length: length, width: width, height: height },
          "Reservatorio"
        );
      }
      return buildIncompleteGeometryResult("reservatorio", "Qual o comprimento, largura e altura do reservatorio?", "Reservatorio");
    }

    if (hasAny(text, ["parede", "muro", "alvenaria"])) {
      const isWall = hasTerm(text, "muro");
      const wallMatch = originalMessage.match(new RegExp(number + "\\s*(?:m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(?:m|metros?)?", "i"));
      if (wallMatch) {
        const length = parseDimensionNumber(wallMatch[1]);
        const height = parseDimensionNumber(wallMatch[2]);
        const area = roundQuantity(length * height);
        const thicknessMatch = originalMessage.match(new RegExp("(?:espessura|com)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)", "i"));
        if (isWall && thicknessMatch) {
          const thickness = parseStructuralDimension(thicknessMatch[1], thicknessMatch[2]);
          const volume = roundQuantity(area * thickness);
          return buildGeometryResult(
            "muro",
            "volume",
            volume,
            "m3",
            "Volume calculado: " + formatMeters(length) + " x " + formatMeters(height) + " x " + formatMeters(thickness) + " = " + formatCubicMeters(volume),
            { length: length, height: height, area: area, thickness: thickness },
            "Muro"
          );
        }
        return buildGeometryResult(
          isWall ? "muro" : "alvenaria",
          "area",
          area,
          "m2",
          "Area calculada: " + formatMeters(length) + " x " + formatMeters(height) + " = " + formatSquareMeters(area),
          { length: length, height: height },
          isWall ? "Muro" : "Parede"
        );
      }
      return buildIncompleteGeometryResult("alvenaria", "Qual o comprimento e a altura da parede?", "Parede");
    }

    if (hasTerm(text, "radier") || hasTerm(text, "laje")) {
      const isRadier = hasTerm(text, "radier");
      const isJoistSlab = hasTerm(text, "trelicada") || hasTerm(text, "treliçada");
      const serviceType = isRadier ? "radier" : "laje";
      const label = isRadier ? "Radier" : isJoistSlab ? "Laje trelicada" : "Laje macica";
      const areaMatch = originalMessage.match(new RegExp(number + "\\s*(?:m2|m²|metros?\\s+quadrados?)", "i"));
      const planMatch = originalMessage.match(new RegExp(number + "\\s*(?:m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(?:m|metros?)?", "i"));
      const thicknessMatch = originalMessage.match(new RegExp("(?:espessura|capa|com)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)", "i")) ||
        originalMessage.match(new RegExp("(?:m2|m²|metros?\\s+quadrados?)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)", "i"));
      const area = areaMatch ? parseDimensionNumber(areaMatch[1]) : planMatch ? roundQuantity(parseDimensionNumber(planMatch[1]) * parseDimensionNumber(planMatch[2])) : 0;
      if (area && thicknessMatch && (!isJoistSlab || isRadier || hasAny(text, ["capa", "concreto", "espessura"]))) {
        const thickness = parseStructuralDimension(thicknessMatch[1], thicknessMatch[2]);
        const volume = roundQuantity(area * thickness);
        return buildGeometryResult(
          serviceType,
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatSquareMeters(area) + " x " + formatMeters(thickness) + " = " + formatCubicMeters(volume),
          { area: area, thickness: thickness },
          label
        );
      }
      if (area && isJoistSlab) {
        const result = buildGeometryResult(
          "laje",
          "area",
          area,
          "m2",
          "Area identificada: " + formatSquareMeters(area) + " de laje trelicada. Sem capa de concreto informada.",
          { area: area },
          label
        );
        result.service = "Laje trelicada demonstrativa";
        return result;
      }
      if (area && isRadier) {
        return buildIncompleteGeometryResult("radier", "Qual a espessura prevista do radier?", "Radier");
      }
      if (area) {
        return buildIncompleteGeometryResult("laje", "Qual a espessura da laje?", label);
      }
      return buildIncompleteGeometryResult(serviceType, "Qual o comprimento, largura e espessura do " + serviceType + "?", label);
    }

    if (hasTerm(text, "pilar") || hasTerm(text, "pilares") || hasTerm(text, "coluna")) {
      const pillarMatch = originalMessage.match(new RegExp("(?:" + number + "\\s*)?(?:pilar(?:es)?|colunas?).*?" + number + "\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?(?:.*?(?:altura|com)?\\s*" + number + "\\s*(?:m|metros?))", "i"));
      if (pillarMatch) {
        const count = pillarMatch[1] ? parseDimensionNumber(pillarMatch[1]) : 1;
        const width = parseStructuralDimension(pillarMatch[2], pillarMatch[4]);
        const depth = parseStructuralDimension(pillarMatch[3], pillarMatch[4]);
        const height = parseDimensionNumber(pillarMatch[5]);
        const volume = roundQuantity(count * width * depth * height);
        return buildGeometryResult(
          "pilar",
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatQuantity(count) + " x " + formatMeters(width) + " x " + formatMeters(depth) + " x " + formatMeters(height) + " = " + formatCubicMeters(volume),
          { count: count, width: width, depth: depth, height: height },
          "Pilar"
        );
      }
      return buildIncompleteGeometryResult("pilar", "Quantos pilares serao executados e qual a altura?", "Pilar");
    }

    if (hasTerm(text, "bloco de fundacao") || hasTerm(text, "bloco de fundação") || hasTerm(text, "blocos de fundacao") || hasTerm(text, "blocos de fundação")) {
      const foundationBlockMatch = originalMessage.match(new RegExp("(?:" + number + "\\s*)?blocos?\\s+de\\s+funda(?:c|ç)(?:a|ã)o.*?" + number + "\\s*(?:x|por)\\s*" + number + "\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?", "i"));
      if (foundationBlockMatch) {
        const count = foundationBlockMatch[1] ? parseDimensionNumber(foundationBlockMatch[1]) : 1;
        const length = parseStructuralDimension(foundationBlockMatch[2], foundationBlockMatch[5]);
        const width = parseStructuralDimension(foundationBlockMatch[3], foundationBlockMatch[5]);
        const height = parseStructuralDimension(foundationBlockMatch[4], foundationBlockMatch[5]);
        const volume = roundQuantity(count * length * width * height);
        return buildGeometryResult(
          "bloco_fundacao",
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatQuantity(count) + " x " + formatMeters(length) + " x " + formatMeters(width) + " x " + formatMeters(height) + " = " + formatCubicMeters(volume),
          { count: count, length: length, width: width, height: height },
          "Bloco de fundacao"
        );
      }
      return buildIncompleteGeometryResult("bloco_fundacao", "Qual a quantidade e as dimensoes do bloco de fundacao?", "Bloco de fundacao");
    }

    if (hasTerm(text, "viga") || hasTerm(text, "vigas") || hasTerm(text, "baldrame")) {
      const serviceType = hasTerm(text, "baldrame") ? "baldrame" : "viga";
      const label = serviceType === "baldrame" ? "Baldrame" : "Viga";
      const beamMatch = originalMessage.match(new RegExp("(?:" + number + "\\s*)?(?:vigas?|baldrames?).*?(?:" + number + "\\s*(?:m|metros?)\\s*,?\\s*)?" + number + "\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?", "i"));
      if (beamMatch) {
        const count = beamMatch[1] ? parseDimensionNumber(beamMatch[1]) : 1;
        const explicitLength = beamMatch[2] ? parseDimensionNumber(beamMatch[2]) : 0;
        const trailingLengthMatch = explicitLength ? null : originalMessage.match(new RegExp("(?:com|comprimento|extensao|extensão)?\\s*" + number + "\\s*(?:m|metros?)", "i"));
        const length = explicitLength || (trailingLengthMatch ? parseDimensionNumber(trailingLengthMatch[1]) : 0);
        const width = parseStructuralDimension(beamMatch[3], beamMatch[5]);
        const height = parseStructuralDimension(beamMatch[4], beamMatch[5]);
        if (!length) {
          return buildIncompleteGeometryResult(serviceType, "Qual o comprimento total da " + label.toLowerCase() + "?", label);
        }
        const volume = roundQuantity(count * width * height * length);
        return buildGeometryResult(
          serviceType,
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatQuantity(count) + " x " + formatMeters(length) + " x " + formatStructuralSection(width, height) + " = " + formatCubicMeters(volume),
          { count: count, width: width, height: height, length: length },
          label
        );
      }
      const linearBeamMatch = originalMessage.match(new RegExp(number + "\\s*(?:m|metros?)\\s*(?:de\\s*)?(?:vigas?|baldrames?).*?" + number + "\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?", "i"));
      if (linearBeamMatch) {
        const length = parseDimensionNumber(linearBeamMatch[1]);
        const width = parseStructuralDimension(linearBeamMatch[2], linearBeamMatch[4]);
        const height = parseStructuralDimension(linearBeamMatch[3], linearBeamMatch[4]);
        const volume = roundQuantity(length * width * height);
        return buildGeometryResult(
          serviceType,
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatMeters(length) + " x " + formatStructuralSection(width, height) + " = " + formatCubicMeters(volume),
          { length: length, width: width, height: height },
          label
        );
      }
      return buildIncompleteGeometryResult(serviceType, "Qual a secao e o comprimento total da " + label.toLowerCase() + "?", label);
    }

    if (hasTerm(text, "sapata") || hasTerm(text, "sapatas")) {
      const isStripFooting = hasTerm(text, "sapata corrida");
      const stripFootingMatch = originalMessage.match(new RegExp("sapata\\s+corrida.*?" + number + "\\s*(m|metros?)?.*?largura\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?.*?altura\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?", "i")) ||
        originalMessage.match(new RegExp("sapata\\s+corrida.*?" + number + "\\s*(m|metros?)?.*?" + number + "\\s*(cm|centimetros?|m|metros?)?\\s*(?:de\\s*)?largura.*?" + number + "\\s*(cm|centimetros?|m|metros?)?\\s*(?:de\\s*)?altura", "i"));
      if (stripFootingMatch) {
        const length = parseDimensionNumber(stripFootingMatch[1]);
        const width = parseStructuralDimension(stripFootingMatch[3], stripFootingMatch[4]);
        const height = parseStructuralDimension(stripFootingMatch[5], stripFootingMatch[6]);
        const volume = roundQuantity(length * width * height);
        return buildGeometryResult(
          "sapata_corrida",
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatMeters(length) + " x " + formatStructuralSection(width, height) + " = " + formatCubicMeters(volume),
          { length: length, width: width, height: height },
          "Sapata corrida"
        );
      }
      const footingMatch = originalMessage.match(new RegExp("(?:" + number + "\\s*)?sapatas?.*?" + number + "\\s*(cm|centimetros?|m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?\\s*(?:x|por)\\s*" + number + "\\s*(cm|centimetros?|m|metros?)?", "i"));
      if (footingMatch) {
        const count = footingMatch[1] ? parseDimensionNumber(footingMatch[1]) : 1;
        const fallbackUnit = footingMatch[7] || footingMatch[5] || footingMatch[3];
        const length = parseStructuralDimension(footingMatch[2], footingMatch[3] || fallbackUnit);
        const width = parseStructuralDimension(footingMatch[4], footingMatch[5] || fallbackUnit);
        const height = parseStructuralDimension(footingMatch[6], footingMatch[7] || fallbackUnit);
        const volume = roundQuantity(count * length * width * height);
        return buildGeometryResult(
          isStripFooting ? "sapata_corrida" : "sapata",
          "volume",
          volume,
          "m3",
          "Volume calculado: " + formatQuantity(count) + " x " + formatMeters(length) + " x " + formatMeters(width) + " x " + formatMeters(height) + " = " + formatCubicMeters(volume),
          { count: count, length: length, width: width, height: height },
          isStripFooting ? "Sapata corrida" : "Sapata"
        );
      }
      return buildIncompleteGeometryResult("sapata", "Qual a quantidade e as dimensoes da sapata em comprimento, largura e altura?", "Sapata");
    }

    return {
      detected: false,
      complete: false,
      serviceType: "",
      geometryType: "",
      quantity: 0,
      unit: "",
      explanation: "",
      dimensions: {}
    };
  }

  function parseRequestLegacy(message) {
    const originalMessage = clean(message);
    const text = normalize(originalMessage);
    const quantityMatch = originalMessage.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|m\b|un\b)/i);
    const hasIntent = isCompositionRequest(originalMessage);
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : (hasIntent ? 1 : 0);
    const unit = quantityMatch ? normalizeRequestedUnit(quantityMatch[2]) : "";
    const services = [];

    [
      ["Alvenaria de bloco ceramico", "m2", ["alvenaria", "parede", "bloco ceramico", "tijolo ceramico"]],
      ["Chapisco", "m2", ["chapisco"]],
      ["Emboco", "m2", ["emboco", "massa grossa"]],
      ["Reboco", "m2", ["reboco", "massa fina"]],
      ["Pintura interna", "m2", ["pintura", "tinta"]],
      ["Telha ceramica", "m2", ["telhado", "telha ceramica", "cobertura"]],
      ["Telha fibrocimento", "m2", ["telha fibrocimento", "fibrocimento"]],
      ["Estrutura de madeira para telhado", "m2", ["madeiramento", "caibro", "ripa", "terca", "estrutura de madeira"]],
      ["Concreto simples", "m3", ["concreto simples", "concreto"]],
      ["Concreto estrutural", "m3", ["concreto estrutural", "concreto armado"]],
      ["Piso ceramico", "m2", ["piso ceramico", "piso"]],
      ["Revestimento ceramico de parede", "m2", ["revestimento", "azulejo"]]
    ].forEach(function (rule) {
      const service = rule[0];
      const defaultUnit = rule[1];
      const terms = rule[2];
      if (!hasAny(text, terms)) {
        return;
      }
      if (service === "Emboco" && text.indexOf("reboco") >= 0 && text.indexOf("emboco") < 0 && text.indexOf("massa grossa") < 0) {
        return;
      }
      if (service === "Concreto simples" && (text.indexOf("concreto estrutural") >= 0 || text.indexOf("concreto armado") >= 0)) {
        return;
      }
      if (service === "Telha ceramica" && text.indexOf("fibrocimento") >= 0) {
        return;
      }
      services.push({
        service: service,
        quantity: quantity,
        unit: unit || displayUnit(defaultUnit),
        requestedUnit: unit,
        materialHint: terms.find(function (term) { return text.indexOf(normalize(term)) >= 0; }) || ""
      });
    });

    if (text.indexOf("massa") >= 0 &&
      !services.some(function (item) { return item.service === "Emboco"; }) &&
      !services.some(function (item) { return item.service === "Reboco"; })) {
      services.push({ service: "Emboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
      services.push({ service: "Reboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
    }

    return {
      originalMessage: originalMessage,
      quantity: quantity,
      unit: unit,
      assumedBaseQuantity: !quantityMatch && quantity > 0,
      services: services.filter(function (item, index, list) {
        return list.findIndex(function (candidate) { return normalize(candidate.service) === normalize(item.service); }) === index;
      })
    };
  }

  function parseRequest(message) {
    const originalMessage = clean(message);
    const text = normalize(originalMessage);
    const geometry = parseGeometryRequest(originalMessage);
    if (geometry.detected) {
      const geometryServiceSource = geometry.geometryType === "composite"
        ? (geometry.derivedServices || [])
        : [{
          serviceType: geometry.serviceType,
          service: geometry.service,
          quantity: geometry.quantity,
          unit: geometry.unit,
          label: geometry.label
        }];
      const geometryService = geometryServiceSource.map(function (service) {
        return createGeometryServiceEntry(service, geometry);
      }).filter(Boolean);
      return {
        originalMessage: originalMessage,
        quantity: geometry.geometryType === "composite" ? 1 : geometry.quantity,
        unit: geometry.unit,
        missingQuantity: !geometry.complete,
        assumedBaseQuantity: false,
        geometry: geometry,
        servicesWithoutComposition: getGeometryServicesWithoutComposition(geometry),
        services: geometryService
      };
    }
    const quantityMatch = originalMessage.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|kg|quilo|quilos|ponto|pontos|m\b|un\b|und\b|unidade|unidades)/i);
    const looseQuantityMatch = !quantityMatch ? originalMessage.match(/\b(\d+(?:[.,]\d+)?)\b/) : null;
    const wordOneQuantity = !quantityMatch && !looseQuantityMatch && /\b(um|uma)\b/i.test(originalMessage);
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : looseQuantityMatch ? parseNumber(looseQuantityMatch[1]) : wordOneQuantity ? 1 : 0;
    const unit = quantityMatch ? normalizeRequestedUnit(quantityMatch[2]) : "";
    if ((hasTerm(text, "cobertura") || hasTerm(text, "telhado")) && !hasExplicitCoverageType(text)) {
      return {
        originalMessage: originalMessage,
        quantity: quantity,
        unit: unit || "m2",
        missingQuantity: quantity <= 0,
        assumedBaseQuantity: false,
        geometry: geometry,
        servicesWithoutComposition: quantity > 0 ? [{
          serviceType: "cobertura",
          quantity: quantity,
          unit: unit || "m2",
          label: "cobertura"
        }] : [],
        services: []
      };
    }
    const isExplicitCoverageRequest = (hasTerm(text, "cobertura") || hasTerm(text, "telhado") || hasTerm(text, "telha")) && hasExplicitCoverageType(text);
    const ranked = rankCompositions(text, { unit: unit }).filter(function (entry) {
      return !isExplicitCoverageRequest || normalize(entry.item.category).indexOf("cobertura") >= 0;
    });
    const bestScore = ranked.length ? ranked[0].score : 0;
    const services = ranked.filter(function (entry) {
      return entry.score >= 100 && entry.score >= Math.max(100, bestScore * 0.2);
    }).slice(0, 6).map(function (entry) {
      return {
        service: entry.item.service,
        quantity: quantity,
        unit: unit || displayUnit(entry.item.productionUnit),
        requestedUnit: unit,
        materialHint: entry.item.service,
        score: entry.score
      };
    });

    if (text.indexOf("massa") >= 0 &&
      !services.some(function (item) { return item.service === "Emboco"; }) &&
      !services.some(function (item) { return item.service === "Reboco"; })) {
      services.push({ service: "Emboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa", score: 180 });
      services.push({ service: "Reboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa", score: 180 });
    }

    if ((hasTerm(text, "madeiramento") || hasTerm(text, "estrutura de madeira") || hasTerm(text, "caibro") || hasTerm(text, "ripa")) &&
      !services.some(function (item) { return item.service === "Estrutura de madeira para telhado"; })) {
      services.push({
        service: "Estrutura de madeira para telhado",
        quantity: quantity,
        unit: unit || "m²",
        requestedUnit: unit,
        materialHint: "madeiramento",
        score: 240
      });
    }

    const lineServices = [];
    let inStockSectionForServices = false;
    originalMessage.split(/\n+/).forEach(function (line) {
      const normalizedLine = normalize(line);
      if (/^(tenho|tenho em estoque|disponivel|disponível|ja possuo|já possuo|no estoque existe|estoque)\s*:?\s*/.test(normalizedLine)) {
        inStockSectionForServices = true;
        return;
      }
      if (inStockSectionForServices && /(\d+(?:[.,]\d+)?)\s*(sacos?|m²|m2|m³|m3|kg|telhas?|blocos?|unidades?|un|m)/i.test(line)) {
        return;
      }
      if (inStockSectionForServices && normalizedLine) {
        inStockSectionForServices = false;
      }
      const lineQuantityMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|kg|quilo|quilos|ponto|pontos|m\b|un\b|und\b|unidade|unidades)/i);
      if (!lineQuantityMatch || /^(tenho|tenho em estoque|dispon[ií]vel|j[aá] possuo|no estoque existe|estoque)\s*:?\s*/i.test(clean(line))) {
        return;
      }
      const lineUnit = normalizeRequestedUnit(lineQuantityMatch[2]);
      const lineQuantity = parseNumber(lineQuantityMatch[1]);
      const lineText = normalize(line);
      const isLineExplicitCoverageRequest = (hasTerm(lineText, "cobertura") || hasTerm(lineText, "telhado") || hasTerm(lineText, "telha")) && hasExplicitCoverageType(lineText);
      const lineRanked = rankCompositions(lineText, { unit: lineUnit }).filter(function (entry) {
        return !isLineExplicitCoverageRequest || normalize(entry.item.category).indexOf("cobertura") >= 0;
      });
      const lineBestScore = lineRanked.length ? lineRanked[0].score : 0;
      lineRanked.filter(function (entry) {
        return entry.score >= 100 && entry.score >= Math.max(100, lineBestScore * 0.2);
      }).slice(0, 4).forEach(function (entry) {
        lineServices.push({
          service: entry.item.service,
          quantity: lineQuantity,
          unit: lineUnit || displayUnit(entry.item.productionUnit),
          requestedUnit: lineUnit,
          materialHint: entry.item.service,
          score: entry.score + 20
        });
      });
    });

    const servicesByName = {};
    services.concat(lineServices).forEach(function (item) {
      servicesByName[normalize(item.service)] = item;
    });
    const uniqueServices = Object.keys(servicesByName).map(function (key) {
      return servicesByName[key];
    });

    return {
      originalMessage: originalMessage,
      quantity: quantity,
      unit: unit,
      missingQuantity: isCompositionRequest(originalMessage) && quantity <= 0 && uniqueServices.length > 0,
      assumedBaseQuantity: false,
      geometry: geometry,
      services: uniqueServices
    };
  }

  function calculatePredictedConsumption(serviceInput) {
    const input = serviceInput || {};
    const compositionData = input.composition || input.selectedComposition || findComposition(input);
    const executedQuantity = parseNumber(input.quantity || input.executedQuantity);
    const service = clean(input.service || input.serviceName || (compositionData && compositionData.service));
    const unit = clean(input.unit || (compositionData && compositionData.productionUnit)) || "un";
    const result = {
      service: service,
      executedQuantity: roundQuantity(executedQuantity),
      unit: unit,
      composition: compositionData ? {
        id: compositionData.id,
        service: compositionData.service,
        productionUnit: compositionData.productionUnit,
        source: compositionData.source || DEMO_SOURCE,
        sourceRegion: compositionData.sourceRegion || "",
        sourceDate: compositionData.sourceDate || "",
        code: compositionData.code || "",
        isRealComposition: isRealComposition(compositionData),
        lossPercent: parseNumber(compositionData.lossPercent),
        note: compositionData.note || (isRealComposition(compositionData) ? REAL_SOURCE_WARNING : DEMO_WARNING)
      } : null,
      predictedItems: [],
      technicalNotes: [],
      warning: DEMO_WARNING
    };

    if (!compositionData || executedQuantity <= 0) {
      result.technicalNotes.push("Sem composicao compativel ou quantidade executada invalida.");
      return result;
    }

    const lossMultiplier = 1 + (parseNumber(compositionData.lossPercent) / 100);
    result.predictedItems = (compositionData.materials || []).map(function (mat, index) {
      const coefficient = parseNumber(mat.quantityPerUnit || mat.coefficient);
      const quantity = roundQuantity(executedQuantity * coefficient * lossMultiplier);
      return {
        id: mat.id || "pred_" + index,
        name: mat.name || mat.material,
        material: mat.name || mat.material,
        coefficient: coefficient,
        quantity: quantity,
        predictedQuantity: quantity,
        unit: mat.unit || "un",
        note: mat.note || DEMO_WARNING,
        sources: [
          service + " " + formatQuantity(executedQuantity) + " " + displayUnit(unit) +
          " · composicao: " + compositionData.service +
          " · fonte: " + (compositionData.source || DEMO_SOURCE)
        ]
      };
    }).filter(function (item) {
      return item.name && parseNumber(item.quantity) > 0;
    });

    result.technicalNotes.push("Perda aplicada: " + formatQuantity(parseNumber(compositionData.lossPercent)) + "%.");
    result.technicalNotes.push(isRealComposition(compositionData) ? REAL_SOURCE_WARNING : DEMO_REPLACE_WARNING);
    return result;
  }

  function consolidateMaterials(predictedItems) {
    const grouped = {};
    (predictedItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = item.unit || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      if (!grouped[key]) {
        grouped[key] = {
          id: "est_" + key.replace(/[^a-z0-9]+/g, "_"),
          name: name,
          material: name,
          quantity: 0,
          predictedQuantity: 0,
          unit: unit,
          note: "Consumo previsto por composicao tecnica demonstrativa/editavel.",
          sources: []
        };
      }
      grouped[key].quantity += parseNumber(item.quantity || item.predictedQuantity);
      grouped[key].predictedQuantity = grouped[key].quantity;
      grouped[key].sources = grouped[key].sources.concat(item.sources || []);
    });
    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.quantity = roundQuantity(item.quantity);
      item.predictedQuantity = item.quantity;
      if (item.sources.length) {
        item.note += " Origem: " + item.sources.join("; ") + ".";
      }
      return item;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function calculateMultipleServices(services) {
    const predictions = [];
    const missing = [];
    (services || []).forEach(function (service) {
      const prediction = calculatePredictedConsumption(service);
      if (!prediction.composition || prediction.executedQuantity <= 0) {
        missing.push(service);
        return;
      }
      predictions.push(prediction);
    });
    const items = consolidateMaterials(predictions.reduce(function (list, prediction) {
      return list.concat(prediction.predictedItems || []);
    }, []));
    return {
      items: items,
      predictedItems: items,
      predictions: predictions,
      missing: missing,
      warning: DEMO_WARNING
    };
  }

  function classifyConsumptionStatus(estimated, registered, differencePercent) {
    if (estimated <= 0 && registered > 0) {
      return "sem previsao";
    }
    if (estimated > 0 && registered <= 0) {
      return "sem consumo real";
    }
    if (differencePercent < -25) {
      return "abaixo do previsto";
    }
    if (Math.abs(differencePercent) <= 10) {
      return "dentro do previsto";
    }
    if (differencePercent > 25) {
      return "critico";
    }
    return "atencao";
  }

  function comparePredictedVsActual(predictedItems, actualItems) {
    const predicted = {};
    const actual = {};
    (predictedItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = clean(item.unit) || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      predicted[key] = predicted[key] || { name: name, quantity: 0, unit: unit };
      predicted[key].quantity += parseNumber(item.quantity || item.predictedQuantity || item.estimated);
    });
    (actualItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = clean(item.unit) || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      actual[key] = actual[key] || { name: name, quantity: 0, unit: unit };
      actual[key].quantity += parseNumber(item.quantity || item.actualQuantity || item.registered);
    });
    return Object.keys(Object.assign({}, predicted, actual)).map(function (key) {
      const predictedItem = predicted[key];
      const actualItem = actual[key];
      const estimated = roundQuantity(predictedItem ? predictedItem.quantity : 0);
      const registered = roundQuantity(actualItem ? actualItem.quantity : 0);
      const difference = roundQuantity(registered - estimated);
      const differencePercent = estimated > 0 ? roundQuantity((difference / estimated) * 100) : 0;
      return {
        name: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        material: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        unit: (predictedItem && predictedItem.unit) || (actualItem && actualItem.unit) || "un",
        estimated: estimated,
        predicted: estimated,
        registered: registered,
        actual: registered,
        difference: difference,
        differencePercent: differencePercent,
        status: classifyConsumptionStatus(estimated, registered, differencePercent)
      };
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function materialMatchKeys(name) {
    const normalized = normalize(name);
    const aliases = {
      "bloco ceramico": ["bloco", "tijolo", "tijolo ceramico"],
      "cimento": ["cimento cp ii", "cimento cp iv", "cimento portland"],
      "argamassa": ["argamassa colante", "massa", "cimento areia", "argamassa de assentamento"],
      "areia": ["areia media", "areia fina", "areia lavada"],
      "brita": ["brita 1", "pedrisco"],
      "tinta": ["tinta acrilica", "tinta parede"],
      "telha ceramica": ["telha", "telhado"],
      "telha fibrocimento": ["fibrocimento", "telha brasilit"],
      "madeiramento": ["ripa", "caibro", "terca", "estrutura de madeira"],
      "aco ca 50": ["aco", "aço", "ferro", "armacao", "armação"]
    };
    const words = normalized.split(" ").filter(function (word) { return word.length >= 4; });
    const keys = [normalized].concat(words);
    Object.keys(aliases).forEach(function (key) {
      if (normalized.indexOf(key) >= 0 || aliases[key].some(function (alias) { return normalized.indexOf(normalize(alias)) >= 0; })) {
        keys.push(key);
        keys.push.apply(keys, aliases[key].map(normalize));
      }
    });
    return keys.filter(Boolean).filter(function (key, index, list) {
      return list.indexOf(key) === index;
    });
  }

  function matchPredictedMaterialToStockItem(predictedMaterial, stockItems) {
    const materialName = clean(predictedMaterial && (predictedMaterial.name || predictedMaterial.material));
    const materialUnit = normalizeUnit(predictedMaterial && predictedMaterial.unit || "un");
    const keys = materialMatchKeys(materialName);
    const candidates = (stockItems || []).map(function (entry) {
      return entry && entry.item ? entry : {
        item: entry,
        realBalance: entry && entry.realBalance !== undefined ? entry.realBalance : entry && entry.balance
      };
    }).filter(function (entry) {
      return entry && entry.item;
    });
    return candidates.find(function (entry) {
      const item = entry.item || {};
      return normalizeUnit(item.unit || "un") === materialUnit && normalize(item.name) === normalize(materialName);
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = materialMatchKeys(item.name);
      return normalizeUnit(item.unit || "un") === materialUnit && keys.some(function (key) { return itemKeys.indexOf(key) >= 0; });
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = materialMatchKeys(item.name);
      if (normalizeUnit(item.unit || "un") !== materialUnit) {
        return false;
      }
      return keys.some(function (key) {
        return itemKeys.some(function (itemKey) {
          return key.length >= 4 && itemKey.length >= 4 && (key.indexOf(itemKey) >= 0 || itemKey.indexOf(key) >= 0);
        });
      });
    }) || null;
  }

  function getPurchaseStatus(requiredQuantity, currentBalance, stockMatch) {
    if (!stockMatch) {
      return "sem item no estoque";
    }
    if (currentBalance >= requiredQuantity) {
      return "suficiente";
    }
    if (currentBalance <= 0) {
      return "critico";
    }
    if (requiredQuantity > 0 && currentBalance / requiredQuantity <= 0.25) {
      return "critico";
    }
    return "comprar";
  }

  function getPurchaseStatusRank(status) {
    if (status === "critico") return 4;
    if (status === "sem item no estoque") return 3;
    if (status === "comprar") return 2;
    return 1;
  }

  function buildPurchasePlan(productions, stockItems, options) {
    const settings = options || {};
    const predicted = settings.predictedItems || calculateMultipleServices(productions || []).items;
    const stock = Array.isArray(stockItems) ? stockItems : [];
    const items = (predicted || []).map(function (item) {
      const stockMatch = matchPredictedMaterialToStockItem(item, stock);
      const stockItem = stockMatch && stockMatch.item ? stockMatch.item : null;
      const requiredQuantity = roundQuantity(parseNumber(item.quantity || item.predictedQuantity || item.estimated));
      const currentBalance = stockMatch ? roundQuantity(parseNumber(stockMatch.realBalance)) : 0;
      const purchaseQuantity = roundQuantity(Math.max(requiredQuantity - currentBalance, 0));
      const status = getPurchaseStatus(requiredQuantity, currentBalance, stockMatch);
      return {
        id: "purchase_plan_" + normalize(item.name || item.material) + "_" + normalizeUnit(item.unit || "un"),
        material: item.name || item.material || "Material",
        materialName: item.name || item.material || "Material",
        unit: item.unit || "un",
        predictedQuantity: requiredQuantity,
        requiredQuantity: requiredQuantity,
        currentBalance: currentBalance,
        purchaseQuantity: purchaseQuantity,
        status: status,
        stockItemId: stockItem ? stockItem.id : null,
        stockItemName: stockItem ? stockItem.name : "",
        note: status === "sem item no estoque"
          ? "Material previsto sem item correspondente no estoque local."
          : status === "critico"
            ? "Saldo insuficiente para a producao prevista. Revisar compra antes da execucao."
            : status === "comprar"
              ? "Comprar a diferenca entre consumo previsto e saldo local."
              : "Saldo local atende ao consumo previsto."
      };
    }).sort(function (a, b) {
      return getPurchaseStatusRank(b.status) - getPurchaseStatusRank(a.status) ||
        String(a.materialName || "").localeCompare(String(b.materialName || ""));
    });
    return {
      items: items,
      summary: {
        totalPredicted: items.length,
        sufficient: items.filter(function (item) { return item.status === "suficiente"; }).length,
        toBuy: items.filter(function (item) { return item.status === "comprar"; }).length,
        critical: items.filter(function (item) { return item.status === "critico"; }).length,
        notFound: items.filter(function (item) { return item.status === "sem item no estoque"; }).length
      },
      warning: PURCHASE_WARNING
    };
  }

  function escapeReportHtml(value) {
    return clean(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatReportValue(value, fallback) {
    const text = clean(value);
    return text || fallback || "nao informado";
  }

  function formatReportQuantity(value, unit) {
    return formatQuantity(value) + (unit ? " " + displayUnit(unit) : "");
  }

  function getCompositionReportType(compositionData) {
    if (isRealComposition(compositionData)) {
      return "oficial";
    }
    if (isMockComposition(compositionData)) {
      return "mock de teste";
    }
    return "demonstrativo";
  }

  function buildStockAIReportConsumptionFromComposition(service, compositionData) {
    const executedQuantity = parseNumber(service && service.quantity);
    const lossMultiplier = 1 + (parseNumber(compositionData && compositionData.lossPercent) / 100);
    const items = ((compositionData && (compositionData.materials || compositionData.inputs)) || []).map(function (input, index) {
      const coefficient = parseNumber(input.quantityPerUnit !== undefined ? input.quantityPerUnit : input.coefficient);
      const quantity = roundQuantity(executedQuantity * coefficient * lossMultiplier);
      return {
        id: input.id || "report_pred_" + index,
        name: input.name || input.material,
        material: input.name || input.material,
        coefficient: coefficient,
        quantity: quantity,
        predictedQuantity: quantity,
        unit: input.unit || "un",
        sources: [clean(compositionData.name || compositionData.service || compositionData.code || "Composicao informada")]
      };
    }).filter(function (item) {
      return item.name && parseNumber(item.quantity) > 0;
    });
    return {
      items: consolidateMaterials(items),
      predictedItems: consolidateMaterials(items),
      predictions: [{
        service: service && service.service,
        executedQuantity: executedQuantity,
        unit: service && service.unit,
        composition: compositionData,
        predictedItems: items,
        technicalNotes: []
      }],
      missing: items.length ? [] : [service],
      warning: isRealComposition(compositionData) ? REAL_SOURCE_WARNING : DEMO_WARNING
    };
  }

  function buildStockAIReportModel(data) {
    const input = typeof data === "string" ? { originalQuestion: data } : (data || {});
    const originalQuestion = clean(input.originalQuestion || input.question || input.message || input.pergunta);
    const request = input.request || (originalQuestion ? parseRequest(originalQuestion) : {});
    const geometry = input.geometry || request.geometry || null;
    const services = input.services || request.services || [];
    const missingServices = input.servicesWithoutComposition || request.servicesWithoutComposition || [];
    const reportedStock = input.reportedStock || input.stockItems || (originalQuestion ? parseStockItemsFromMessage(originalQuestion) : []);
    const stockItems = input.stockItems || reportedStock;
    const providedComposition = input.composition || input.compositionData || null;
    const consumption = input.consumption || input.predictedConsumption ||
      (providedComposition && services.length ? buildStockAIReportConsumptionFromComposition(services[0], providedComposition) : calculateMultipleServices(services));
    const predictedItems = input.predictedItems || consumption.items || consumption.predictedItems || [];
    const purchasePlan = input.purchasePlan || buildPurchasePlan(services, stockItems, { predictedItems: predictedItems });
    const primaryPrediction = (consumption.predictions || []).find(function (prediction) {
      return prediction && prediction.composition;
    }) || null;
    const primaryService = input.service || services[0] || missingServices[0] || {};
    const compositionData = providedComposition || (primaryPrediction && primaryPrediction.composition) || findComposition(primaryService);
    const source = compositionData ? getCompositionSource(compositionData) : "";
    const type = getCompositionReportType(compositionData);
    const stockComparison = (purchasePlan.items || []).map(function (item) {
      return {
        material: item.materialName,
        predicted: item.requiredQuantity,
        available: item.currentBalance,
        missing: item.purchaseQuantity,
        unit: item.unit,
        status: item.status
      };
    });
    const missingPurchaseItems = (purchasePlan.items || []).filter(function (item) {
      return item.purchaseQuantity > 0 || item.status === "sem item no estoque" || item.status === "critico";
    });
    const technicalNotes = [];

    if (compositionData && isRealComposition(compositionData)) {
      technicalNotes.push("Base oficial: " + getCompositionSource(compositionData) +
        (compositionData.code ? " codigo " + compositionData.code : "") +
        (compositionData.sourceRegion ? " UF/regiao " + compositionData.sourceRegion : "") +
        (compositionData.sourceDate ? " referencia " + compositionData.sourceDate : "") + ".");
    } else {
      technicalNotes.push("Valores demonstrativos/editaveis, nao substituem orcamento oficial.");
    }
    if (missingServices.length || (consumption.missing || []).length) {
      technicalNotes.push("Existem quantitativos sem composicao compativel cadastrada.");
    }
    if (geometry && geometry.serviceType === "reservatorio") {
      technicalNotes.push("Reservatorio tratado como volume geometrico bruto; nao e dimensionamento estrutural.");
    }

    return {
      originalQuestion: originalQuestion,
      request: request,
      geometry: geometry,
      services: services,
      missingServices: missingServices,
      primaryService: primaryService,
      composition: compositionData,
      compositionSource: source,
      compositionType: type,
      consumption: consumption,
      predictedItems: predictedItems,
      reportedStock: reportedStock,
      stockComparison: stockComparison,
      purchasePlan: purchasePlan,
      missingPurchaseItems: missingPurchaseItems,
      technicalNotes: technicalNotes
    };
  }

  function buildStockAIReportSections(model) {
    const geometry = model.geometry || {};
    const compositionData = model.composition || {};
    const primaryService = model.primaryService || {};
    const hasStock = (model.reportedStock || []).length > 0;
    const status = model.predictedItems.length ? "Consumo previsto calculado" :
      model.missingServices.length ? "Pendente de composicao" : "Relatorio gerado";

    return [
      {
        title: "Cabecalho",
        items: [
          ["Relatorio", "Relatorio Tecnico Stock AI Obras"],
          ["Data/hora", new Date().toLocaleString("pt-BR")],
          ["Tipo", model.compositionType],
          ["Fonte da composicao", model.compositionSource || "sem composicao identificada"]
        ]
      },
      {
        title: "Resumo executivo",
        items: [
          ["Pergunta analisada", model.originalQuestion || "dados estruturados"],
          ["Servico identificado", primaryService.service || primaryService.label || "nao identificado"],
          ["Quantitativo calculado", primaryService.quantity ? formatReportQuantity(primaryService.quantity, primaryService.unit) : "nao calculado"],
          ["Composicao utilizada", compositionData.name || compositionData.service || "sem composicao compativel"],
          ["Status geral", status]
        ]
      },
      {
        title: "Quantitativo geometrico",
        items: [
          ["Tipo de geometria", geometry.geometryType || "nao informado"],
          ["Tipo de servico", geometry.serviceType || primaryService.serviceType || "nao informado"],
          ["Dimensoes usadas", geometry.explanation || "nao informadas"],
          ["Quantidade final", geometry.quantity ? formatReportQuantity(geometry.quantity, geometry.unit) : primaryService.quantity ? formatReportQuantity(primaryService.quantity, primaryService.unit) : "nao calculada"]
        ]
      },
      {
        title: "Composicao utilizada",
        items: [
          ["Codigo", compositionData.code || compositionData.id || "sem codigo"],
          ["Nome", compositionData.name || compositionData.service || "sem composicao"],
          ["Unidade", compositionData.unit || compositionData.productionUnit || "nao informada"],
          ["Fonte", model.compositionSource || "nao informada"],
          ["Classificacao", model.compositionType],
          ["UF/regiao", compositionData.sourceRegion || "nao aplicavel"],
          ["Mes/referencia", compositionData.sourceDate || "nao aplicavel"]
        ]
      },
      {
        title: "Consumo previsto",
        table: {
          headers: ["Material", "Quantidade prevista", "Unidade"],
          rows: (model.predictedItems || []).map(function (item) {
            return [item.name || item.material, formatQuantity(item.quantity || item.predictedQuantity), item.unit || "un"];
          }),
          emptyText: "Sem consumo previsto calculado."
        }
      },
      {
        title: "Comparacao com estoque",
        table: {
          headers: ["Material", "Previsto", "Disponivel", "Faltante", "Unidade", "Status"],
          rows: hasStock ? model.stockComparison.map(function (item) {
            return [item.material, formatQuantity(item.predicted), formatQuantity(item.available), formatQuantity(item.missing), item.unit, item.status];
          }) : [],
          emptyText: "Relatorio gerado sem comparacao de estoque."
        }
      },
      {
        title: "Planejamento de compra",
        table: {
          headers: ["Material", "Comprar", "Unidade", "Prioridade/status"],
          rows: (model.missingPurchaseItems || []).map(function (item) {
            return [item.materialName, formatQuantity(item.purchaseQuantity), item.unit, item.status];
          }),
          emptyText: "Sem materiais faltantes identificados."
        }
      },
      {
        title: "Observacoes tecnicas",
        items: model.technicalNotes.map(function (note) {
          return ["Observacao", note];
        })
      }
    ];
  }

  function buildStockAIReportPlainText(title, sections) {
    const lines = [title];
    (sections || []).forEach(function (section) {
      lines.push("");
      lines.push(section.title.toUpperCase());
      if (section.items) {
        section.items.forEach(function (item) {
          lines.push("- " + item[0] + ": " + item[1]);
        });
      }
      if (section.table) {
        if (!section.table.rows.length) {
          lines.push("- " + section.table.emptyText);
        } else {
          lines.push(section.table.headers.join(" | "));
          section.table.rows.forEach(function (row) {
            lines.push(row.join(" | "));
          });
        }
      }
    });
    return lines.join("\n");
  }

  function buildStockAIReportHtml(title, summary, sections) {
    return "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\">" +
      "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
      "<title>" + escapeReportHtml(title) + "</title>" +
      "<style>" +
      "body{font-family:Arial,sans-serif;margin:0;padding:28px;color:#102033;background:#f6f8fb}" +
      ".page{max-width:980px;margin:0 auto;background:#fff;border:1px solid #dbe4ee;padding:28px}" +
      "h1{margin:0 0 6px;font-size:24px}h2{margin:24px 0 10px;font-size:16px;color:#0f5f8f}.sub{color:#607080;margin:0}" +
      ".section{border-top:1px solid #e2e8f0;margin-top:18px;padding-top:14px}.list{display:grid;grid-template-columns:210px 1fr;gap:6px 12px}.list dt{font-weight:700}.list dd{margin:0;color:#405062}" +
      "table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #e2e8f0;padding:8px;text-align:left;font-size:12px}th{background:#f6f9fc;color:#102033}.empty{color:#607080}footer{margin-top:22px;color:#607080;font-size:12px}@media print{body{background:#fff;padding:0}.page{border:0}.section{break-inside:avoid}}" +
      "</style></head><body><main class=\"page\">" +
      "<h1>" + escapeReportHtml(title) + "</h1>" +
      "<p class=\"sub\">" + escapeReportHtml(summary) + "</p>" +
      (sections || []).map(function (section) {
        let html = "<section class=\"section\"><h2>" + escapeReportHtml(section.title) + "</h2>";
        if (section.items) {
          html += "<dl class=\"list\">" + section.items.map(function (item) {
            return "<dt>" + escapeReportHtml(item[0]) + "</dt><dd>" + escapeReportHtml(item[1]) + "</dd>";
          }).join("") + "</dl>";
        }
        if (section.table) {
          if (!section.table.rows.length) {
            html += "<p class=\"empty\">" + escapeReportHtml(section.table.emptyText) + "</p>";
          } else {
            html += "<table><thead><tr>" + section.table.headers.map(function (header) {
              return "<th>" + escapeReportHtml(header) + "</th>";
            }).join("") + "</tr></thead><tbody>" + section.table.rows.map(function (row) {
              return "<tr>" + row.map(function (cell) {
                return "<td>" + escapeReportHtml(cell) + "</td>";
              }).join("") + "</tr>";
            }).join("") + "</tbody></table>";
          }
        }
        return html + "</section>";
      }).join("") +
      "<footer>Gerado por Stock AI Obras / ObraReport.</footer>" +
      "<script>window.addEventListener('load',function(){setTimeout(function(){window.print();},350);});</script>" +
      "</main></body></html>";
  }

  function generateStockAITechnicalReport(data) {
    const model = buildStockAIReportModel(data);
    const title = "Relatorio Tecnico Stock AI Obras";
    const sections = buildStockAIReportSections(model);
    const summary = (model.primaryService && model.primaryService.service ? model.primaryService.service : "Analise Stock AI") +
      " - " + (model.predictedItems.length ? "consumo previsto calculado" : "sem consumo previsto completo");
    const plainText = buildStockAIReportPlainText(title, sections);
    return {
      ok: true,
      title: title,
      summary: summary,
      sections: sections,
      html: buildStockAIReportHtml(title, summary, sections),
      plainText: plainText,
      model: model
    };
  }

  function printStockAITechnicalReport(reportData) {
    const report = reportData && reportData.html ? reportData : generateStockAITechnicalReport(reportData);
    if (!window || typeof window.open !== "function") {
      return report;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return report;
    }
    printWindow.document.open();
    printWindow.document.write(report.html);
    printWindow.document.close();
    return report;
  }

  function parseStockItemsFromMessage(message) {
    const stockItems = [];
    const stockLines = [];
    let inStockSection = false;
    const stockTriggerPattern = /(tenho em estoque|dispon[ií]vel no estoque|estoque atual|saldo|tenho dispon[ií]vel|temos no estoque|material dispon[ií]vel|no estoque existe|estoque)\s*:?\s*/i;
    clean(message).split(/\n+/).forEach(function (line) {
      const normalizedLine = normalize(line);
      const triggerMatch = line.match(stockTriggerPattern);
      if (triggerMatch) {
        inStockSection = true;
        stockLines.push(clean(line.slice(triggerMatch.index + triggerMatch[0].length)).replace(/\.$/, ""));
        return;
      }
      if (inStockSection && /(\d+(?:[.,]\d+)?)\s*(sacos?|m²|m2|m³|m3|kg|telhas?|blocos?|unidades?|un|m)/i.test(line)) {
        stockLines.push(line);
        return;
      }
      if (inStockSection && normalizedLine && !/^e\b/.test(normalizedLine)) {
        inStockSection = false;
      }
    });
    clean(message).split(/[.;]+/).slice(1).forEach(function (segment) {
      const stockSegment = clean(segment);
      if (/^(tenho|temos)\s+\d+(?:[.,]\d+)?\s*(sacos?|mÂ²|m2|mÂ³|m3|kg|telhas?|blocos?|unidades?|un|m|metros?)/i.test(stockSegment)) {
        stockLines.push(stockSegment.replace(/^(tenho|temos)\s+/i, ""));
      }
    });
    const text = stockLines.join("\n").replace(/\bmetros?\b/gi, "m").replace(/\b(m|un|kg|sacos?)\./gi, "$1");
    const fullMessageKey = normalize(message);
    const pattern = /(\d+(?:[.,]\d+)?)\s*(sacos?|m²|m2|m³|m3|kg|telhas?|blocos?|unidades?|un|m)(?:\s+de\s+(.+?))?(?=(?:\s+e\s+|\s*,\s*|\s*;\s*)\d+(?:[.,]\d+)?\s*(?:sacos?|m²|m2|m³|m3|kg|telhas?|blocos?|unidades?|un|m)\b|$)/gi;
    let match;
    while ((match = pattern.exec(text))) {
      const quantity = parseNumber(match[1]);
      const rawUnit = normalize(match[2]);
      const rawMaterial = clean(match[3]).replace(/\.$/, "");
      const materialKey = normalize(rawMaterial);
      let unit = normalizeUnit(rawUnit);
      let name = rawMaterial;
      if (rawUnit.indexOf("saco") >= 0) {
        unit = "saco";
      }
      if (rawUnit.indexOf("bloco") >= 0) {
        unit = "un";
        name = "Bloco ceramico";
      } else if (rawUnit.indexOf("telha") >= 0) {
        unit = "un";
        name = "Telha ceramica";
      } else if (materialKey.indexOf("cimento") >= 0) {
        name = "Cimento";
      } else if (materialKey.indexOf("areia") >= 0) {
        name = "Areia";
      } else if (materialKey.indexOf("concreto") >= 0) {
        name = "Concreto estrutural";
      } else if (materialKey.indexOf("cabo") >= 0 || materialKey.indexOf("fio") >= 0) {
        name = "Cabo eletrico";
      } else if (materialKey.indexOf("aco") >= 0 || materialKey.indexOf("ferro") >= 0) {
        name = "Aco CA-50";
      } else if (!materialKey && unit === "m" && (hasTerm(fullMessageKey, "cabo") || hasTerm(fullMessageKey, "fio"))) {
        name = "Cabo eletrico";
      }
      if (quantity > 0 && name) {
        stockItems.push({
          item: {
            id: "reported_stock_" + normalize(name).replace(/\s+/g, "_") + "_" + unit,
            name: name,
            unit: unit
          },
          realBalance: quantity,
          source: "message"
        });
      }
    }
    const grouped = {};
    stockItems.forEach(function (entry) {
      const key = normalize(entry.item.name) + "|" + normalizeUnit(entry.item.unit);
      if (!grouped[key]) {
        grouped[key] = entry;
        return;
      }
      grouped[key].realBalance = roundQuantity(parseNumber(grouped[key].realBalance) + parseNumber(entry.realBalance));
    });
    return Object.keys(grouped).map(function (key) {
      return grouped[key];
    });
  }

  function getRequiredParameterQuestion(serviceName, parameter) {
    const service = normalize(serviceName);
    if (parameter === "comprimento_linear" && service.indexOf("rufo") >= 0) {
      return "Preciso do comprimento do rufo em metros lineares.";
    }
    if (parameter === "comprimento_linear") {
      return "Qual o comprimento total da calha em metros lineares?";
    }
    if (parameter === "tipo_cobertura") {
      return "Qual o tipo de cobertura? telha cerâmica, fibrocimento, metálica, sanduíche ou laje impermeabilizada?";
    }
    if (parameter === "capacidade_litros") {
      return "Qual a capacidade da caixa d'água?";
    }
    if (parameter === "espessura") {
      return "Qual a espessura prevista do radier?";
    }
    if (parameter === "tipo_tela") {
      return "Qual o tipo da tela? Q92, Q138, Q196 ou outro?";
    }
    if (service.indexOf("pilar") >= 0) {
      return "Qual a seção dos pilares e altura? Exemplo: 20x20 cm e 3 metros.";
    }
    if (service.indexOf("viga") >= 0) {
      return "Qual a seção e comprimento das vigas?";
    }
    return "Preciso de mais um parâmetro técnico para calcular " + serviceName + ".";
  }

  function hasRequiredParameterValue(message, service, parameter) {
    const text = normalize(message);
    const unit = normalizeUnit(service.unit);
    if (parameter === "comprimento_linear") {
      return parseNumber(service.quantity) > 0 && unit === "m";
    }
    if (parameter === "tipo_cobertura") {
      return hasTerm(text, "telha ceramica") || hasTerm(text, "telha cerâmica") ||
        hasTerm(text, "ceramico") || hasTerm(text, "ceramica") ||
        hasTerm(text, "fibrocimento") || hasTerm(text, "metalica") || hasTerm(text, "metálica") ||
        hasTerm(text, "sanduiche") || hasTerm(text, "sanduíche") || hasTerm(text, "laje impermeabilizada");
    }
    if (parameter === "capacidade_litros") {
      return /\d+\s*(l|litro|litros)\b/i.test(message);
    }
    if (parameter === "espessura") {
      return hasTerm(text, "espessura") || /\d+\s*cm\b/i.test(message);
    }
    if (parameter === "tipo_tela") {
      return /\bq\s*(92|138|196)\b/i.test(message) || hasTerm(text, "tipo da tela");
    }
    if (parameter === "largura" || parameter === "comprimento" || parameter === "altura") {
      return normalizeUnit(service.requestedUnit) === "m3" || /\d+\s*x\s*\d+/i.test(message);
    }
    return true;
  }

  function buildParameterQuestions(request) {
    const questions = [];
    const text = normalize(request.originalMessage);
    if ((hasTerm(text, "cobertura") || hasTerm(text, "cobrir") || hasTerm(text, "telhado")) &&
      !hasTerm(text, "telha ceramica") && !hasTerm(text, "telha cerâmica") &&
      !hasTerm(text, "ceramico") && !hasTerm(text, "ceramica") &&
      !hasTerm(text, "fibrocimento") && !hasTerm(text, "madeiramento") && !hasTerm(text, "estrutura de madeira")) {
      const coverageMatch = request.originalMessage.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|metro quadrado|metros quadrados)\s*(?:de\s+)?(cobertura|telhado)/i);
      const coverageText = coverageMatch
        ? formatQuantity(coverageMatch[1]) + " " + displayUnit(coverageMatch[2])
        : request.quantity ? formatQuantity(request.quantity) + " " + displayUnit(request.unit || "m2") : "área informada";
      questions.push("Identifiquei cobertura de " + coverageText + ", porém preciso do tipo de cobertura para calcular telhas e estrutura.");
    }
    (request.services || []).forEach(function (service) {
      const compositionData = findComposition(service);
      (compositionData && compositionData.requiredParameters || []).forEach(function (parameter) {
        if (!hasRequiredParameterValue(request.originalMessage, service, parameter)) {
          if (compositionData.id === "std_rufo_calha" && parameter === "comprimento_linear") {
            questions.push(hasTerm(text, "calha")
              ? "Qual o comprimento total da calha em metros lineares?"
              : "Preciso do comprimento do rufo em metros lineares.");
            return;
          }
          questions.push(getRequiredParameterQuestion(compositionData.service, parameter));
        }
      });
    });
    return questions.filter(function (question, index, list) {
      return list.indexOf(question) === index;
    });
  }

  function appendGeometrySummary(lines, geometry) {
    if (!geometry || !geometry.detected || !geometry.complete) {
      return;
    }
    if (geometry.geometryType === "composite") {
      const dimensions = geometry.dimensions || {};
      lines.push("🏗️ GEOMETRIA COMPOSTA");
      lines.push("- Planta: " + formatMeters(dimensions.length) + " x " + formatMeters(dimensions.width) + ".");
      lines.push("- Area de piso: " + formatSquareMeters(dimensions.floorArea) + ".");
      lines.push("- Perimetro externo: " + formatMeters(dimensions.perimeter) + ".");
      lines.push("- Area estimada de paredes externas: " + formatSquareMeters(dimensions.wallArea) + ".");
      lines.push("- Cobertura estimada: " + formatSquareMeters(dimensions.roofArea) + ".");
      lines.push("- Observacao: " + geometry.warning);
      return;
    }
    lines.push("📐 QUANTITATIVO GEOMÉTRICO");
    lines.push("- " + geometry.label + " identificado.");
    lines.push("- " + geometry.explanation + ".");
  }

  function formatCompositionSource(compositionData) {
    if (!compositionData) {
      return "";
    }
    if (isMockComposition(compositionData)) {
      return "Fonte: MOCK DE TESTE - nao usar como base real";
    }
    if (isRealComposition(compositionData)) {
      return "Fonte: " + getCompositionSource(compositionData) +
        (compositionData.code ? " - codigo " + compositionData.code : "") +
        (compositionData.sourceDate ? " - referencia " + compositionData.sourceDate : "") +
        (compositionData.sourceRegion ? " - " + compositionData.sourceRegion : "");
    }
    return "Fonte: " + getCompositionSource(compositionData);
  }

  function appendServicesWithoutComposition(lines, services) {
    const missing = services || [];
    if (!missing.length) {
      return;
    }
    lines.push("");
    lines.push("QUANTITATIVOS SEM COMPOSICAO CADASTRADA");
    missing.forEach(function (service) {
      if (service.serviceType === "cobertura") {
        lines.push("- Cobertura estimada: " + formatQuantity(service.quantity) + " " + displayUnit(service.unit) + ". Para calcular materiais da cobertura, informe o tipo: telha ceramica, fibrocimento, metalica etc.");
        return;
      }
      lines.push("- " + (service.label || service.serviceType || "Servico") + ": " + formatQuantity(service.quantity) + " " + displayUnit(service.unit) + ". Ainda nao existe composicao tecnica cadastrada para este servico.");
    });
  }

  function buildAnswerFromMessageLegacy(message, options) {
    const settings = options || {};
    const request = parseRequest(message);
    if (request.missingQuantity && request.services.length) {
      if (parameterQuestions.length) {
        return ["PERGUNTAS COMPLEMENTARES"]
          .concat(parameterQuestions.map(function (question) { return "- " + question; }))
          .concat(["", "OBSERVAÇÕES", "- Não vou assumir dados técnicos obrigatórios sem confirmação.", "- " + DEMO_WARNING])
          .join("\n");
      }
      const firstService = request.services[0];
      const lines = [
        "Encontrei o serviço " + firstService.service + ", mas preciso saber a quantidade em " + displayUnit(firstService.unit) + " para calcular os materiais.",
        "",
        "Exemplo: \"Vou fazer 80 " + displayUnit(firstService.unit) + " de " + firstService.service + "\".",
        "",
        "Observação:",
        DEMO_WARNING
      ];
      return lines.join("\n");
    }
    if (!request.quantity || !request.services.length) {
      return "";
    }
    const result = calculateMultipleServices(request.services);
    if (!result.items.length) {
      return "";
    }
    const lines = ["Entendi o planejamento:"];
    if (request.assumedBaseQuantity) {
      lines.push("- Área total não informada; usei uma base demonstrativa de 1 m² para listar a composição.");
    }
    request.services.forEach(function (service) {
      lines.push("- " + formatQuantity(service.quantity) + " " + displayUnit(service.unit) + " de " + service.service);
    });
    lines.push("");
    lines.push("Composição estimada:");
    lines.push("Materiais previstos:");
    result.items.forEach(function (item) {
      lines.push("- " + item.name + ": " + formatQuantity(item.quantity) + " " + displayUnit(item.unit));
    });
    if (settings.stockItems && settings.stockItems.length) {
      const purchasePlan = buildPurchasePlan(request.services, settings.stockItems, { predictedItems: result.items });
      if (purchasePlan.items.length) {
        lines.push("");
        lines.push("Planejamento de compra:");
        purchasePlan.items.slice(0, 8).forEach(function (item) {
          lines.push("- " + item.materialName + ": saldo " + formatQuantity(item.currentBalance) + " " + displayUnit(item.unit) +
            ", comprar " + formatQuantity(item.purchaseQuantity) + " " + displayUnit(item.unit) + " (" + item.status + ")");
        });
      }
    }
    if (request.originalMessage && /\d+\s*cm/i.test(request.originalMessage)) {
      lines.push("");
      lines.push("Observação técnica: dimensões informadas foram mantidas como contexto. Nesta fase, o cálculo principal usa composição demonstrativa por área/unidade de serviço.");
    }
    lines.push("");
    lines.push("Observação:");
    lines.push(DEMO_WARNING);
    return lines.join("\n");
  }

  function buildAnswerFromMessage(message, options) {
    const settings = options || {};
    const request = parseRequest(message);
    const geometryQuestions = request.geometry && request.geometry.questions || [];
    const parameterQuestions = buildParameterQuestions(request).concat(geometryQuestions).filter(function (question, index, list) {
      return question && list.indexOf(question) === index;
    });
    const reportedStock = parseStockItemsFromMessage(message);
    const stockItems = (settings.stockItems || []).concat(reportedStock);
    const servicesWithoutComposition = request.servicesWithoutComposition || [];

    if (request.missingQuantity && request.services.length) {
      if (parameterQuestions.length) {
        return ["PERGUNTAS COMPLEMENTARES"]
          .concat(parameterQuestions.map(function (question) { return "- " + question; }))
          .concat(["", "OBSERVAÇÕES", "- Não vou assumir dados técnicos obrigatórios sem confirmação.", "- " + DEMO_WARNING])
          .join("\n");
      }
      const firstService = request.services[0];
      return [
        "PERGUNTAS COMPLEMENTARES",
        "- Encontrei o serviço " + firstService.service + ", mas preciso saber a quantidade em " + displayUnit(firstService.unit) + " para calcular os materiais.",
        "",
        "OBSERVAÇÕES",
        "- Não vou assumir dados técnicos obrigatórios sem confirmação.",
        "- " + DEMO_WARNING
      ].join("\n");
    }

    if ((!request.quantity || !request.services.length) && parameterQuestions.length) {
      return ["PERGUNTAS COMPLEMENTARES"]
        .concat(parameterQuestions.map(function (question) { return "- " + question; }))
        .concat(["", "OBSERVAÇÕES", "- Não vou assumir dados técnicos obrigatórios sem confirmação.", "- " + DEMO_WARNING])
        .join("\n");
    }

    const calculableServices = (request.services || []).filter(function (service) {
      const compositionData = findComposition(service);
      const required = compositionData && compositionData.requiredParameters || [];
      return !required.some(function (parameter) {
        return !hasRequiredParameterValue(request.originalMessage, service, parameter);
      });
    });

    if (request.quantity && !calculableServices.length && parameterQuestions.length) {
      return ["PERGUNTAS COMPLEMENTARES"]
        .concat(parameterQuestions.map(function (question) { return "- " + question; }))
        .concat(["", "OBSERVAÇÕES", "- Não vou assumir dados técnicos obrigatórios sem confirmação.", "- " + DEMO_WARNING])
        .join("\n");
    }

    if ((!request.quantity || !calculableServices.length) && request.geometry && request.geometry.complete && servicesWithoutComposition.length) {
      const lines = [];
      appendGeometrySummary(lines, request.geometry);
      appendServicesWithoutComposition(lines, servicesWithoutComposition);
      lines.push("");
      lines.push("OBSERVAÇÕES");
      lines.push("- " + DEMO_WARNING);
      lines.push("- " + PURCHASE_WARNING);
      return lines.join("\n");
    }

    if (!request.quantity || !calculableServices.length) {
      return "";
    }

    const result = calculateMultipleServices(calculableServices);
    if (!result.items.length) {
      return "";
    }

    const purchasePlan = buildPurchasePlan(calculableServices, stockItems, { predictedItems: result.items });
    const missingPurchaseItems = (purchasePlan.items || []).filter(function (item) {
      return item.purchaseQuantity > 0 || item.status === "sem item no estoque" || item.status === "critico";
    });
    const lines = [];
    if (request.geometry && request.geometry.detected && request.geometry.complete && request.geometry.geometryType === "composite") {
      appendGeometrySummary(lines, request.geometry);
      lines.push("");
    }
    if (request.geometry && request.geometry.detected && request.geometry.complete && request.geometry.geometryType !== "composite") {
      lines.push("📐 QUANTITATIVO GEOMÉTRICO");
      lines.push("- " + request.geometry.label + " identificado.");
      lines.push("- " + request.geometry.explanation + ".");
      lines.push("");
    }
    lines.push("🧱 COMPOSIÇÃO IDENTIFICADA");

    request.services.forEach(function (service) {
      const compositionData = findComposition(service);
      lines.push("- " + formatQuantity(service.quantity) + " " + displayUnit(service.unit) + " de " + service.service);
      if (compositionData) {
        lines.push("  Composicao utilizada: " + (compositionData.code || compositionData.id || "sem codigo") + " - " + (compositionData.name || compositionData.service));
        lines.push("  Tipo estrutural: " + (compositionData.category || service.serviceType || "Geral"));
        lines.push("  " + formatCompositionSource(compositionData));
      }
    });
    appendServicesWithoutComposition(lines, servicesWithoutComposition);

    lines.push("");
    lines.push("Materiais previstos:");
    lines.push("📦 CONSUMO PREVISTO");
    result.items.forEach(function (item) {
      lines.push("- " + item.name + ": " + formatQuantity(item.quantity) + " " + displayUnit(item.unit));
    });

    lines.push("");
    lines.push("📊 ESTOQUE X PREVISTO");
    if (reportedStock.length) {
      reportedStock.forEach(function (entry) {
        lines.push("- " + entry.item.name + ": " + formatQuantity(entry.realBalance) + " " + displayUnit(entry.item.unit));
      });
    } else {
      lines.push("- Nenhum estoque informado na mensagem.");
    }

    lines.push("");
    lines.push("MATERIAIS FALTANTES");
    if (missingPurchaseItems.length) {
      missingPurchaseItems.forEach(function (item) {
        lines.push("- " + item.materialName + ": necessário " + formatQuantity(item.requiredQuantity) + " " + displayUnit(item.unit) +
          ", estoque " + formatQuantity(item.currentBalance) + " " + displayUnit(item.unit) +
          ", comprar " + formatQuantity(item.purchaseQuantity) + " " + displayUnit(item.unit));
      });
    } else {
      lines.push("- Estoque informado atende aos materiais previstos ou não houve estoque para comparar.");
    }

    lines.push("");
    lines.push("PERDAS PREVISTAS");
    result.predictions.forEach(function (prediction) {
      const loss = prediction.composition ? prediction.composition.lossPercent : 0;
      lines.push("- " + prediction.service + ": perda demonstrativa de " + formatQuantity(loss) + "%.");
    });

    lines.push("");
    lines.push("🛒 PLANEJAMENTO DE COMPRA");
    if (purchasePlan.items.length) {
      purchasePlan.items.slice(0, 12).forEach(function (item) {
        lines.push("- " + item.materialName + ": comprar " + formatQuantity(item.purchaseQuantity) + " " + displayUnit(item.unit) + " (" + item.status + ")");
      });
    } else {
      lines.push("- Sem itens previstos para compra.");
    }

    if (parameterQuestions.length) {
      lines.push("");
      lines.push("PERGUNTAS COMPLEMENTARES");
      parameterQuestions.forEach(function (question) {
        lines.push("- " + question);
      });
    }

    if (request.originalMessage && /\d+\s*cm/i.test(request.originalMessage)) {
      lines.push("");
      lines.push("OBSERVAÇÃO TÉCNICA");
      lines.push("- Dimensões informadas foram mantidas como contexto. Nesta fase, o cálculo principal usa composição demonstrativa por área/unidade de serviço.");
    }

    lines.push("");
    lines.push("OBSERVAÇÕES");
    lines.push("- " + DEMO_WARNING);
    lines.push("- " + PURCHASE_WARNING);
    return lines.join("\n");
  }

  window.StockAiCompositionEngine = Object.assign({}, window.StockAiCompositionEngine || {}, {
    version: LIBRARY_VERSION,
    source: DEMO_SOURCE,
    warning: DEMO_WARNING,
    getVersion: function () { return LIBRARY_VERSION; },
    getCompositions: getCompositions,
    findComposition: findComposition,
    findBestComposition: findBestComposition,
    isCompositionRequest: isCompositionRequest,
    isStockAiRequest: isStockAiRequest,
    normalizeComposition: normalizeComposition,
    normalizeCompositionUnit: normalizeCompositionUnit,
    normalizeServiceType: normalizeServiceType,
    getCompositionSource: getCompositionSource,
    isRealComposition: isRealComposition,
    isMockComposition: isMockComposition,
    mergeCompositionCatalogs: mergeCompositionCatalogs,
    parseSinapiCompositionRows: parseSinapiCompositionRows,
    parseOrseCompositionRows: parseOrseCompositionRows,
    loadRealCompositionsFromJson: loadRealCompositionsFromJson,
    loadRealCompositionsFromRows: loadRealCompositionsFromRows,
    validateSmallRealCompositionFile: validateSmallRealCompositionFile,
    analyzeOfficialCompositionReadiness: analyzeOfficialCompositionReadiness,
    generateOfficialCompositionDiagnosticReport: generateOfficialCompositionDiagnosticReport,
    setExternalCompositionCatalog: setExternalCompositionCatalog,
    getExternalCompositionCatalog: getExternalCompositionCatalog,
    clearExternalCompositionCatalog: clearExternalCompositionCatalog,
    loadExternalCompositions: loadExternalCompositions,
    normalizeOfficialBaseRows: normalizeOfficialBaseRows,
    validateOfficialBaseImport: validateOfficialBaseImport,
    importOfficialBase: importOfficialBase,
    parseOfficialBaseCsv: parseOfficialBaseCsv,
    importOfficialBaseCsv: importOfficialBaseCsv,
    parseOfficialBaseXlsx: parseOfficialBaseXlsx,
    importOfficialBaseXlsx: importOfficialBaseXlsx,
    detectSinapiAnaliticoFormat: detectSinapiAnaliticoFormat,
    parseSinapiAnaliticoRows: parseSinapiAnaliticoRows,
    parseSinapiAnaliticoXlsx: parseSinapiAnaliticoXlsx,
    importSinapiAnaliticoXlsx: importSinapiAnaliticoXlsx,
    searchImportedOfficialCompositions: searchImportedOfficialCompositions,
    clearImportedOfficialBase: clearImportedOfficialBase,
    getImportedOfficialBaseStats: getImportedOfficialBaseStats,
    validateCompositionSchema: validateCompositionSchema,
    parseGeometryRequest: parseGeometryRequest,
    parseRequest: parseRequest,
    normalize: normalize,
    normalizeUnit: normalizeUnit,
    calculatePredictedConsumption: calculatePredictedConsumption,
    calculateMultipleServices: calculateMultipleServices,
    consolidateMaterials: consolidateMaterials,
    comparePredictedVsActual: comparePredictedVsActual,
    buildPurchasePlan: buildPurchasePlan,
    generateStockAITechnicalReport: generateStockAITechnicalReport,
    printStockAITechnicalReport: printStockAITechnicalReport,
    buildAnswerFromMessage: buildAnswerFromMessage,
    matchPredictedMaterialToStockItem: matchPredictedMaterialToStockItem
  });
})();
