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
      status: document.querySelector(".stock-obras-import-status"),
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
    if (typeof engine.clearExternalCompositionCatalog === "function") {
      engine.clearExternalCompositionCatalog();
    }
    const elements = getImportElements_();
    if (elements.input) {
      elements.input.value = "";
    }
    setImportStatus_("Base importada removida. O Stock AI voltou a usar a base demonstrativa/editavel.");
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
    if (importElements.importButton && !importElements.importButton.dataset.stockAiObrasImportBound) {
      importElements.importButton.dataset.stockAiObrasImportBound = "true";
      importElements.importButton.addEventListener("click", readSelectedCompositionFile_);
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
