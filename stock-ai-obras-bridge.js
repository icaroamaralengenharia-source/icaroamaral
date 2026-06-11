(function () {
  "use strict";

  function isStockAiObrasPage_() {
    return document.body && document.body.dataset && document.body.dataset.eloProduct === "stock-ai-obras";
  }

  function clean_(value) {
    return String(value || "").trim();
  }

  function normalize_(value) {
    return clean_(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasAny_(text, terms) {
    return terms.some(function (term) {
      return text.indexOf(term) >= 0;
    });
  }

  function isInstitutionalEloProjectQuestion_(question) {
    const text = normalize_(question);
    if (!text) {
      return false;
    }
    const projectTerms = [
      "cadista",
      "stock full",
      "stock saude",
      "obrareport",
      "obra report",
      "elo",
      "elo informe"
    ];
    const institutionalTerms = [
      "quem e",
      "o que e",
      "qual o plano",
      "plano do",
      "quais projetos",
      "projetos existem",
      "resuma",
      "resumo",
      "estrategia",
      "roadmap"
    ];
    return hasAny_(text, projectTerms) && hasAny_(text, institutionalTerms);
  }

  function appendBridgeMessage_(kind, text) {
    const messages = document.querySelector(".elo-messages");
    if (!messages) {
      return;
    }

    const message = document.createElement("div");
    const bubble = document.createElement("div");
    message.className = "elo-message " + kind;
    bubble.className = "elo-message-bubble";
    bubble.textContent = text;
    message.appendChild(bubble);
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
  }

  function getImportElements_() {
    return {
      input: document.querySelector(".stock-obras-import-input"),
      source: document.querySelector(".stock-obras-import-source"),
      state: document.querySelector(".stock-obras-import-state"),
      referenceMonth: document.querySelector(".stock-obras-import-month"),
      sheetName: document.querySelector(".stock-obras-import-sheet"),
      columnMap: document.querySelector(".stock-obras-import-column-map"),
      status: document.querySelector(".stock-obras-import-status"),
      validateButton: document.querySelector('[data-stock-obras-import-action="validate"]'),
      importButton: document.querySelector('[data-stock-obras-import-action="import"]'),
      clearButton: document.querySelector('[data-stock-obras-import-action="clear"]')
    };
  }

  function setImportStatus_(text) {
    const elements = getImportElements_();
    if (elements.status) {
      elements.status.textContent = text;
    }
  }

  function getImportRows_(jsonData) {
    if (Array.isArray(jsonData)) {
      return jsonData;
    }
    return jsonData && (jsonData.compositions || jsonData.rows || jsonData.items) || [];
  }

  function isMockImport_(jsonData, result) {
    const rows = getImportRows_(jsonData);
    return !!(jsonData && (jsonData.isMock || jsonData.mockOnly)) ||
      rows.some(function (row) {
        const metadata = row && row.metadata || {};
        return !!(row && (row.isMock || row.mockOnly || metadata.isMock || metadata.mockOnly));
      }) ||
      (result.imported || []).some(function (composition) {
        const engine = window.StockAiCompositionEngine || {};
        if (typeof engine.isMockComposition === "function") {
          return engine.isMockComposition(composition);
        }
        const metadata = composition && composition.metadata || {};
        return !!(composition && (composition.isMock || composition.mockOnly || metadata.isMock || metadata.mockOnly));
      });
  }

  function formatImportSources_(summary) {
    const sources = summary && summary.sources || {};
    const labels = Object.keys(sources).filter(function (source) {
      return sources[source] > 0;
    });
    return labels.length ? labels.join(", ") : "nao identificada";
  }

  function formatRejectedReasons_(rejected) {
    const reasons = [];
    (rejected || []).slice(0, 3).forEach(function (item) {
      (item.reasons || []).slice(0, 1).forEach(function (reason) {
        reasons.push("- " + reason);
      });
    });
    return reasons.length ? "\nMotivos principais:\n" + reasons.join("\n") : "";
  }

  function handleCompositionImportJson_(jsonData) {
    const engine = window.StockAiCompositionEngine || {};
    if (typeof engine.loadRealCompositionsFromJson !== "function" ||
      typeof engine.setExternalCompositionCatalog !== "function") {
      setImportStatus_("Motor de composicoes ainda nao carregado. Tente novamente em alguns segundos.");
      return;
    }

    const result = engine.loadRealCompositionsFromJson(jsonData);
    const valid = result.imported ? result.imported.length : 0;
    const invalid = result.rejected ? result.rejected.length : 0;
    if (!valid) {
      setImportStatus_("Nao foi possivel importar o arquivo. Verifique se o JSON esta no formato esperado." +
        formatRejectedReasons_(result.rejected));
      return;
    }

    engine.setExternalCompositionCatalog(result.imported);
    const lines = [
      "Base importada com sucesso: " + valid + " composicoes validas, " + invalid + " rejeitadas.",
      "Fonte detectada: " + formatImportSources_(result.summary)
    ];
    if (isMockImport_(jsonData, result)) {
      lines.push("Arquivo de teste detectado. Nao usar como base real executiva.");
    }
    if (invalid) {
      lines.push(formatRejectedReasons_(result.rejected));
    }
    setImportStatus_(lines.filter(Boolean).join("\n"));
  }

  function readSelectedCompositionFile_() {
    const elements = getImportElements_();
    const file = elements.input && elements.input.files && elements.input.files[0];
    if (!file) {
      setImportStatus_("Selecione um arquivo JSON antes de importar.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function () {
      try {
        handleCompositionImportJson_(JSON.parse(String(reader.result || "")));
      } catch (error) {
        setImportStatus_("Nao foi possivel importar o arquivo. Verifique se o JSON esta no formato esperado.");
      }
    };
    reader.onerror = function () {
      setImportStatus_("Nao foi possivel importar o arquivo. Verifique se o JSON esta no formato esperado.");
    };
    reader.readAsText(file);
  }

  function clearImportedCompositionCatalog_() {
    const engine = window.StockAiCompositionEngine || {};
    if (typeof engine.clearImportedOfficialBase === "function") {
      engine.clearImportedOfficialBase();
    }
    if (typeof engine.clearExternalCompositionCatalog === "function") {
      engine.clearExternalCompositionCatalog();
    }
    const elements = getImportElements_();
    if (elements.input) {
      elements.input.value = "";
    }
    setImportStatus_("Base oficial importada removida. O Stock AI voltou ao catalogo demonstrativo/fallback.");
  }

  function parseColumnMap_(elements) {
    const raw = clean_(elements.columnMap && elements.columnMap.value);
    if (!raw) {
      return { ok: true, value: undefined };
    }
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
        return { ok: false, error: "ColumnMap deve ser um objeto JSON." };
      }
      return { ok: true, value: parsed };
    } catch (error) {
      return { ok: false, error: "ColumnMap invalido. Informe um JSON valido antes de validar ou importar." };
    }
  }

  function getOfficialImportOptions_() {
    const elements = getImportElements_();
    const columnMap = parseColumnMap_(elements);
    if (!columnMap.ok) {
      return { ok: false, error: columnMap.error };
    }
    return {
      ok: true,
      value: {
        source: clean_(elements.source && elements.source.value).toUpperCase(),
        state: clean_(elements.state && elements.state.value).toUpperCase(),
        referenceMonth: clean_(elements.referenceMonth && elements.referenceMonth.value),
        sheetName: clean_(elements.sheetName && elements.sheetName.value),
        columnMap: columnMap.value
      }
    };
  }

  function getSelectedOfficialFile_() {
    const elements = getImportElements_();
    return elements.input && elements.input.files && elements.input.files[0];
  }

  function isCsvFile_(file) {
    const name = clean_(file && file.name).toLowerCase();
    const type = clean_(file && file.type).toLowerCase();
    return !!(file && !isXlsxFile_(file) && (/\.csv$/i.test(name) || /(^|\/|;)csv($|;)/i.test(type) || type === "text/plain"));
  }

  function isXlsxFile_(file) {
    const name = clean_(file && file.name).toLowerCase();
    const type = clean_(file && file.type).toLowerCase();
    return !!(file && (/\.xlsx$/i.test(name) ||
      /spreadsheetml\.sheet/i.test(type)));
  }

  function readOfficialFile_(file, mode, callback) {
    const reader = new FileReader();
    reader.onload = function () {
      callback(null, reader.result);
    };
    reader.onerror = function () {
      callback(new Error("Nao foi possivel ler o arquivo selecionado."));
    };
    if (mode === "arrayBuffer") {
      reader.readAsArrayBuffer(file);
      return;
    }
    reader.readAsText(file);
  }

  function countInputs_(compositions) {
    return (compositions || []).reduce(function (total, composition) {
      return total + ((composition.inputs || composition.materials || []).length);
    }, 0);
  }

  function formatExamples_(compositions) {
    const examples = (compositions || []).slice(0, 3).map(function (composition) {
      return "- " + (composition.code || composition.id || "sem codigo") + " - " +
        (composition.name || composition.description || composition.service || "sem descricao");
    });
    return examples.length ? examples.join("\n") : "- Nenhuma composicao pronta detectada.";
  }

  function formatOfficialValidationStatus_(parsed, validation) {
    const ready = validation && (validation.compositions || validation.ready || validation.imported) || [];
    const errors = (parsed && parsed.errors || []).concat(validation && validation.errors || []);
    const warnings = [
      "Nenhum coeficiente sera inventado.",
      "A base demonstrativa continua disponivel como fallback.",
      "A importacao oficial tera prioridade sobre a demonstrativa somente apos importar."
    ];
    const lines = [
      "Status: " + (validation && validation.ok ? "arquivo valido para importacao" : "arquivo ainda nao esta pronto"),
      "Erros: " + (errors.length ? "\n" + errors.slice(0, 8).map(function (error) { return "- " + error; }).join("\n") : "nenhum"),
      "Avisos:\n- " + warnings.join("\n- "),
      "Total de linhas: " + (parsed && parsed.rows ? parsed.rows.length : 0),
      "Total de composicoes: " + ready.length,
      "Total de insumos: " + countInputs_(ready),
      "Fonte: " + clean_(parsed && parsed.rows && parsed.rows[0] && parsed.rows[0].source || ""),
      "UF: " + clean_(parsed && parsed.rows && parsed.rows[0] && parsed.rows[0].state || ""),
      "Mes: " + clean_(parsed && parsed.rows && parsed.rows[0] && parsed.rows[0].referenceMonth || ""),
      "Exemplos:\n" + formatExamples_(ready)
    ];
    if (parsed && parsed.format === "SINAPI_ANALITICO") {
      lines.splice(1, 0, "Formato SINAPI Analitico detectado.");
      if (parsed.pricingType) {
        lines.splice(2, 0, "Tipo: " + parsed.pricingType);
      }
    }
    return lines.join("\n");
  }

  function formatOfficialImportStatus_(result) {
    const engine = window.StockAiCompositionEngine || {};
    const stats = typeof engine.getImportedOfficialBaseStats === "function"
      ? engine.getImportedOfficialBaseStats()
      : {};
    const imported = result && result.imported || [];
    const errors = result && result.errors || [];
    const lines = [
      "Status: base oficial importada com prioridade sobre a demonstrativa.",
      "Erros: " + (errors.length ? "\n" + errors.slice(0, 8).map(function (error) { return "- " + error; }).join("\n") : "nenhum"),
      "Avisos:\n- Nenhum coeficiente foi inventado.\n- Templates, examples e mocks sao rejeitados.\n- A base demonstrativa continua disponivel como fallback.",
      "Total de linhas: " + (result && result.rows ? result.rows.length : 0),
      "Total de composicoes: " + (stats.totalCompositions || imported.length || 0),
      "Total de insumos: " + (stats.totalInputs || countInputs_(imported)),
      "Fonte: " + (stats.source || ""),
      "UF: " + (stats.state || ""),
      "Mes: " + (stats.referenceMonth || ""),
      "Exemplos:\n" + formatExamples_(imported)
    ];
    if (result && (result.format === "SINAPI_ANALITICO" || result.parsed && result.parsed.format === "SINAPI_ANALITICO")) {
      lines.splice(1, 0, "Formato SINAPI Analitico detectado.");
      if (result.pricingType) {
        lines.splice(2, 0, "Tipo: " + result.pricingType);
      }
    }
    return lines.join("\n");
  }

  function setOfficialImportFallbackXlsx_() {
    setImportStatus_("Nao foi possivel ler o XLSX.\nVerifique se a biblioteca XLSX esta carregada.\nUse CSV nesta fase ou importe XLSX pelo fluxo backend/testes.");
  }

  function formatSinapiAnaliticoFailure_(result) {
    const errors = result && result.errors && result.errors.length
      ? result.errors
      : ["Verifique cabecalhos, coeficientes e itens."];
    const message = "Formato SINAPI Analitico detectado, mas nao foi possivel importar. Verifique cabecalhos, coeficientes e itens.";
    const normalizedFirst = errors.length ? String(errors[0] || "").toLowerCase() : "";
    return Object.assign({}, result || {}, {
      ok: false,
      format: "SINAPI_ANALITICO",
      errors: normalizedFirst.indexOf("formato sinapi analitico detectado") >= 0
        ? errors
        : [message].concat(errors)
    });
  }

  function parseOfficialFileResult_(file, fileContent, options, action) {
    const engine = window.StockAiCompositionEngine || {};
    if (isXlsxFile_(file)) {
      if (!window.XLSX) {
        return { ok: false, xlsxFallback: true };
      }
      let workbook = null;
      if (typeof engine.detectSinapiAnaliticoFormat === "function" && window.XLSX && typeof window.XLSX.read === "function") {
        try {
          workbook = window.XLSX.read(fileContent, { type: "array" });
        } catch (readError) {
          return {
            ok: false,
            errors: [
              "Nao foi possivel ler o XLSX. Verifique se a biblioteca XLSX esta carregada e se o arquivo nao esta corrompido.",
              readError && readError.message ? readError.message : String(readError || "")
            ].filter(Boolean)
          };
        }
        const sinapiDetected = engine.detectSinapiAnaliticoFormat(workbook, options);
        if (sinapiDetected && sinapiDetected.detected) {
          if (typeof engine.parseSinapiAnaliticoXlsx !== "function") {
            return formatSinapiAnaliticoFailure_({
              errors: ["Adaptador SINAPI Analitico ainda nao carregado."]
            });
          }
          if (action === "import") {
            if (typeof engine.importSinapiAnaliticoXlsx !== "function") {
              return formatSinapiAnaliticoFailure_({
                errors: ["Importador SINAPI Analitico ainda nao carregado."]
              });
            }
            const sinapiImported = engine.importSinapiAnaliticoXlsx(workbook, options);
            return sinapiImported.ok ? sinapiImported : formatSinapiAnaliticoFailure_(sinapiImported);
          }
          const sinapiParsed = engine.parseSinapiAnaliticoXlsx(workbook, options);
          if (!sinapiParsed.ok) {
            return formatSinapiAnaliticoFailure_(sinapiParsed);
          }
          const sinapiValidation = typeof engine.validateOfficialBaseImport === "function"
            ? engine.validateOfficialBaseImport({ rows: sinapiParsed.rows }, options)
            : { ok: false, errors: ["Validador oficial ainda nao carregado."] };
          return sinapiValidation.ok
            ? { ok: true, parsed: sinapiParsed, validation: sinapiValidation }
            : formatSinapiAnaliticoFailure_({ parsed: sinapiParsed, validation: sinapiValidation, errors: sinapiValidation.errors });
        }
      }
      if (action === "import") {
        return typeof engine.importOfficialBaseXlsx === "function"
          ? engine.importOfficialBaseXlsx(fileContent, options)
          : { ok: false, errors: ["Motor XLSX oficial ainda nao carregado."] };
      }
      const parsedXlsx = typeof engine.parseOfficialBaseXlsx === "function"
        ? engine.parseOfficialBaseXlsx(fileContent, options)
        : { ok: false, rows: [], errors: ["Motor XLSX oficial ainda nao carregado."] };
      if (!parsedXlsx.ok) {
        return parsedXlsx;
      }
      const validationXlsx = typeof engine.validateOfficialBaseImport === "function"
        ? engine.validateOfficialBaseImport({ rows: parsedXlsx.rows }, options)
        : { ok: false, errors: ["Validador oficial ainda nao carregado."] };
      return { ok: validationXlsx.ok, parsed: parsedXlsx, validation: validationXlsx };
    }

    if (isCsvFile_(file)) {
      if (action === "import") {
        return typeof engine.importOfficialBaseCsv === "function"
          ? engine.importOfficialBaseCsv(String(fileContent || ""), options)
          : { ok: false, errors: ["Motor CSV oficial ainda nao carregado."] };
      }
      const parsed = typeof engine.parseOfficialBaseCsv === "function"
        ? engine.parseOfficialBaseCsv(String(fileContent || ""), options)
        : { ok: false, rows: [], errors: ["Motor CSV oficial ainda nao carregado."] };
      if (!parsed.ok) {
        return parsed;
      }
      const validation = typeof engine.validateOfficialBaseImport === "function"
        ? engine.validateOfficialBaseImport({ rows: parsed.rows }, options)
        : { ok: false, errors: ["Validador oficial ainda nao carregado."] };
      return { ok: validation.ok, parsed: parsed, validation: validation };
    }

    return { ok: false, errors: ["Formato nao suportado. Use CSV nesta fase ou XLSX quando disponivel no ambiente."] };
  }

  function handleOfficialBaseFile_(action) {
    const engine = window.StockAiCompositionEngine || {};
    if (!engine || typeof engine !== "object") {
      setImportStatus_("Motor de composicoes ainda nao carregado. Tente novamente em alguns segundos.");
      return;
    }
    const options = getOfficialImportOptions_();
    if (!options.ok) {
      setImportStatus_(options.error);
      return;
    }
    const file = getSelectedOfficialFile_();
    if (!file) {
      setImportStatus_("Selecione um arquivo CSV ou XLSX antes de validar ou importar.");
      return;
    }
    const mode = isXlsxFile_(file) ? "arrayBuffer" : "text";
    readOfficialFile_(file, mode, function (error, content) {
      if (error) {
        setImportStatus_(error.message);
        return;
      }
      try {
        const result = parseOfficialFileResult_(file, content, options.value, action);
        if (result.xlsxFallback) {
          setOfficialImportFallbackXlsx_();
          return;
        }
        if (action === "import") {
          if (!result.ok) {
            setImportStatus_(formatOfficialValidationStatus_(result.parsed || result, result));
            return;
          }
          setImportStatus_(formatOfficialImportStatus_(result));
          return;
        }
        setImportStatus_(formatOfficialValidationStatus_(result.parsed || result, result.validation || result));
      } catch (runtimeError) {
        setImportStatus_("Nao foi possivel processar o arquivo com seguranca. Use CSV nesta fase ou revise o formato informado.");
      }
    });
  }

  function getStockAiObrasAnswer_(question) {
    const centralEngine = window.StockAiCompositionEngine || {};
    const centralGeometry = typeof centralEngine.parseGeometryRequest === "function"
      ? centralEngine.parseGeometryRequest(question)
      : null;
    const isCentralRequest = typeof centralEngine.isStockAiRequest === "function"
      ? centralEngine.isStockAiRequest(question)
      : (typeof centralEngine.isCompositionRequest === "function" && centralEngine.isCompositionRequest(question)) ||
        !!(centralGeometry && centralGeometry.detected);
    if (typeof centralEngine.buildAnswerFromMessage === "function" && isCentralRequest) {
      return clean_(centralEngine.buildAnswerFromMessage(question)) || buildLocalStockAiObrasAnswer_(question);
    }

    const engine = window.StockAiObrasEngine || {};
    if (typeof engine.isStockAiCompositionRequest !== "function" ||
      typeof engine.buildStockAiCompositionAnswerFromMessage !== "function") {
      return buildLocalStockAiObrasAnswer_(question);
    }

    if (!engine.isStockAiCompositionRequest(question)) {
      return buildLocalStockAiObrasAnswer_(question);
    }

    return clean_(engine.buildStockAiCompositionAnswerFromMessage(question)) || buildLocalStockAiObrasAnswer_(question);
  }

  function isLocalCompositionRequest_(question) {
    const text = normalize_(question);
    return hasAny_(text, [
      "composicao",
      "lista de composicao",
      "lista de material",
      "lista de materiais",
      "quantitativo",
      "quantas telhas",
      "qual o madeiramento",
      "calcular materiais",
      "calcule materiais",
      "quanto material",
      "sinapi",
      "orse",
      "qual material",
      "material eu preciso",
      "materiais eu preciso",
      "vou fazer",
      "vou executar",
      "quero construir",
      "construir uma parede",
      "preciso fazer",
      "consumo previsto",
      "argamassa de assentamento"
    ]) && hasAny_(text, [
      "alvenaria",
      "parede",
      "bloco ceramico",
      "argamassa",
      "chapisco",
      "reboco",
      "massa",
      "pintura",
      "telhado",
      "cobertura",
      "telha",
      "telha ceramica",
      "telha fibrocimento",
      "madeiramento",
      "caibro",
      "ripa",
      "terca",
      "estrutura de madeira",
      "concreto"
    ]);
  }

  function getLocalQuantity_(question) {
    const match = clean_(question).match(/(\d+(?:[.,]\d+)?)\s*(m(?:²|2)|metro quadrado|metros quadrados)/i);
    if (!match) {
      return {
        quantity: 1,
        unit: "m²",
        assumed: true
      };
    }

    return {
      quantity: Number(match[1].replace(",", ".")) || 1,
      unit: "m²",
      assumed: false
    };
  }

  function getLocalServices_(question) {
    const text = normalize_(question);
    const services = [];

    if (hasAny_(text, ["alvenaria", "parede", "bloco ceramico", "tijolo ceramico"])) {
      services.push({
        name: "Alvenaria de bloco cerâmico",
        materials: [
          ["Bloco cerâmico", 13, "un"],
          ["Argamassa de assentamento", 18, "kg"],
          ["Cimento", 0.1, "saco"],
          ["Areia", 0.018, "m³"]
        ]
      });
    }
    if (text.indexOf("chapisco") >= 0) {
      services.push({
        name: "Chapisco",
        materials: [
          ["Cimento", 0.05, "saco"],
          ["Areia", 0.006, "m³"]
        ]
      });
    }
    if (text.indexOf("reboco") >= 0 || /\bmassa\b/.test(text)) {
      services.push({
        name: "Reboco",
        materials: [
          ["Cimento", 0.08, "saco"],
          ["Areia", 0.02, "m³"]
        ]
      });
    }
    if (text.indexOf("pintura") >= 0) {
      services.push({
        name: "Pintura interna",
        materials: [
          ["Tinta", 0.12, "litro"],
          ["Massa corrida", 0.18, "kg"]
        ]
      });
    }
    if ((text.indexOf("telhado") >= 0 || text.indexOf("telha") >= 0 || text.indexOf("cobertura") >= 0) && text.indexOf("fibrocimento") < 0) {
      services.push({
        name: "Telha cerâmica",
        materials: [
          ["Telha cerâmica", 16, "un"],
          ["Cumeeira cerâmica", 0.25, "un"],
          ["Prego/arame de fixação", 0.04, "kg"]
        ]
      });
    }
    if (text.indexOf("fibrocimento") >= 0) {
      services.push({
        name: "Telha fibrocimento",
        materials: [
          ["Telha fibrocimento", 1.05, "m²"],
          ["Parafuso de fixação", 2.5, "un"],
          ["Arruela de vedação", 2.5, "un"]
        ]
      });
    }
    if (hasAny_(text, ["madeiramento", "caibro", "ripa", "terca", "estrutura de madeira"])) {
      services.push({
        name: "Estrutura de madeira para telhado",
        materials: [
          ["Ripa", 2.8, "m"],
          ["Caibro", 1.2, "m"],
          ["Terça de madeira", 0.35, "m"],
          ["Prego/parafuso de fixação", 0.1, "kg"],
          ["Tratamento preservativo", 0.05, "litro"]
        ]
      });
    }
    if (text.indexOf("concreto") >= 0) {
      services.push({
        name: "Concreto simples",
        unit: "m³",
        materials: [
          ["Cimento", 7, "saco"],
          ["Areia", 0.55, "m³"],
          ["Brita", 0.8, "m³"]
        ]
      });
    }

    return services;
  }

  function buildLocalStockAiObrasAnswer_(question) {
    if (!isLocalCompositionRequest_(question)) {
      return "";
    }

    const quantityInfo = getLocalQuantity_(question);
    const services = getLocalServices_(question);
    if (!services.length) {
      return "";
    }

    const materials = {};
    services.forEach(function (service) {
      service.materials.forEach(function (material) {
        const key = normalize_(material[0]) + "|" + material[2];
        if (!materials[key]) {
          materials[key] = {
            name: material[0],
            unit: material[2],
            quantity: 0
          };
        }
        materials[key].quantity += material[1] * quantityInfo.quantity;
      });
    });

    const lines = ["Entendi o planejamento:"];
    if (quantityInfo.assumed) {
      lines.push("- Área total não informada; usei uma base demonstrativa de 1 m² para listar a composição.");
    }
    services.forEach(function (service) {
      lines.push("- " + quantityInfo.quantity.toLocaleString("pt-BR") + " " + (service.unit || quantityInfo.unit) + " de " + service.name);
    });
    lines.push("");
    lines.push("Composição estimada:");
    Object.keys(materials).map(function (key) {
      return materials[key];
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }).forEach(function (material) {
      lines.push("- " + material.name + ": " + Number(material.quantity.toFixed(3)).toLocaleString("pt-BR") + " " + material.unit);
    });
    lines.push("");
    lines.push("Observação:");
    lines.push("Composição demonstrativa/editável. Validar antes de orçamento, compra oficial ou medição contratual.");
    return lines.join("\n");
  }

  function answerStockAiObrasQuestion_(input, event) {
    const question = clean_(input && input.value);
    if (isInstitutionalEloProjectQuestion_(question)) {
      return false;
    }

    const answer = getStockAiObrasAnswer_(question);
    if (!answer) {
      return false;
    }

    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    appendBridgeMessage_("user", question);
    appendBridgeMessage_("assistant", answer);
    input.value = "";
    if (window.console && typeof window.console.info === "function") {
      window.console.info("Stock AI Obras bridge respondeu composição");
    }
    return true;
  }

  function bindStockAiObrasBridge_() {
    if (!isStockAiObrasPage_()) {
      return;
    }

    const form = document.querySelector(".elo-input-row");
    const input = document.querySelector(".elo-input");
    if (!form || !input || form.dataset.stockAiObrasBridgeBound) {
      return;
    }

    form.dataset.stockAiObrasBridgeBound = "true";
    form.addEventListener("submit", function (event) {
      answerStockAiObrasQuestion_(input, event);
    }, true);

    input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" || event.shiftKey) {
        return;
      }
      answerStockAiObrasQuestion_(input, event);
    }, true);

    const importElements = getImportElements_();
    if (importElements.validateButton && !importElements.validateButton.dataset.stockAiObrasImportBound) {
      importElements.validateButton.dataset.stockAiObrasImportBound = "true";
      importElements.validateButton.addEventListener("click", function () {
        handleOfficialBaseFile_("validate");
      });
    }
    if (importElements.importButton && !importElements.importButton.dataset.stockAiObrasImportBound) {
      importElements.importButton.dataset.stockAiObrasImportBound = "true";
      importElements.importButton.addEventListener("click", function () {
        handleOfficialBaseFile_("import");
      });
    }
    if (importElements.clearButton && !importElements.clearButton.dataset.stockAiObrasImportBound) {
      importElements.clearButton.dataset.stockAiObrasImportBound = "true";
      importElements.clearButton.addEventListener("click", clearImportedCompositionCatalog_);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindStockAiObrasBridge_);
  } else {
    bindStockAiObrasBridge_();
  }
})();
