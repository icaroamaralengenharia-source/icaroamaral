(function () {
  "use strict";

  const ENDPOINT_PATH = "/api/ai/analyze-image";
  const PRODUCTION_API_BASE_URL = "https://obrareport-backend.onrender.com";
  window.OBRAREPORT_PRODUCTION_API_BASE_URL = window.OBRAREPORT_PRODUCTION_API_BASE_URL || PRODUCTION_API_BASE_URL;
  const TIMEOUT_MS = 25000;
  const MAX_IMAGE_EDGE = 1600;
  const JPEG_QUALITY = 0.82;
  const severityMap = { critica: "critica", crítica: "critica", alta: "alta", media: "media", média: "media", baixa: "baixa" };
  const statusSet = new Set(["C", "NC", "NV"]);

  async function analyzeInspectionPhoto(input) {
    if (!input || !input.image) throw new Error("image_required");
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      throw buildPublicError("offline", "Análise por IA indisponível sem conexão.");
    }

    const image = await prepareImage(input.image);
    const context = buildContext(input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(resolveEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, context }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw buildPublicError("backend", data?.error || "Não foi possível analisar a foto.");
      if (!data || (!data.analysis && !data.suggestion)) throw buildPublicError("invalid", "Resposta inválida da IA visual.");
      return normalizeSuggestion(data, input);
    } catch (error) {
      if (error && error.publicMessage) throw error;
      if (error && error.name === "AbortError") throw buildPublicError("timeout", "Tempo esgotado ao analisar a foto.");
      throw buildPublicError("network", "Não foi possível analisar a foto.");
    } finally {
      clearTimeout(timeout);
    }
  }

  function buildContext(input) {
    const environment = compactEntity(input.environment);
    const system = compactEntity(input.system);
    const item = compactEntity(input.item);
    const acceptanceCriteria = input.acceptanceCriteria || input.item?.acceptanceCriteria || "";
    return {
      source: "vistoria_entrega_apartamento",
      kind: "apartment_handover_inspection",
      objective: "Analisar visualmente a foto em relação ao item específico informado pelo profissional.",
      technicalContext: [
        "TIPO: Vistoria de entrega de apartamento",
        "AMBIENTE: " + (environment?.name || "não informado"),
        "SISTEMA: " + (system?.name || "não informado"),
        "ITEM: " + (item?.name || "não informado"),
        "CRITÉRIO DE ACEITAÇÃO: " + (acceptanceCriteria || "não informado"),
        "OBSERVAÇÃO ATUAL: " + (input.existingResult?.notes || input.existingResult?.observation || "não informada"),
        "OBJETIVO: Analisar visualmente a foto em relação a este item específico."
      ].join("\n"),
      safety: [
        "Analise somente o que é visualmente observável na imagem.",
        "Considere que a foto foi registrada durante vistoria de entrega de apartamento.",
        "Avalie especificamente o item informado.",
        "Não invente causa, norma, medição, dimensão, material não identificável, defeito oculto ou comprometimento estrutural sem evidência visual suficiente.",
        "Se houver não conformidade aparente, descreva objetivamente, sugira severidade e proponha recomendação técnica prudente.",
        "Se a imagem não permitir concluir, informe incerteza e sugira verificação adicional.",
        "Se a foto parecer não corresponder ao item informado, sinalize incompatibilidade e não altere o item automaticamente.",
        "A IA sugere; o profissional decide."
      ],
      inspection: {
        type: "vistoria de entrega de apartamento",
        environment,
        system,
        item,
        acceptanceCriteria,
        currentStatus: input.existingResult?.status || "NAO_INSPECIONADO",
        currentObservation: input.existingResult?.observation || "",
        currentDescription: input.existingResult?.notes || ""
      }
    };
  }
  function compactEntity(entity) {
    if (!entity) return null;
    return { id: entity.id || null, name: entity.name || entity.title || entity.text || null };
  }

  async function prepareImage(source) {
    if (source.base64) {
      return {
        base64: cleanBase64(source.base64),
        mimeType: source.mimeType || "image/jpeg",
        fileName: source.fileName || "foto.jpg",
        width: Number(source.width || 0),
        height: Number(source.height || 0)
      };
    }

    const file = source instanceof File || source instanceof Blob ? source : source.file;
    if (!file) throw new Error("image_file_required");
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) return fileToPayload(file);

    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    const payload = await fileToPayload(blob || file);
    payload.fileName = file.name || "foto.jpg";
    payload.width = width;
    payload.height = height;
    return payload;
  }

  async function fileToPayload(file) {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    return {
      base64: cleanBase64(dataUrl),
      mimeType: file.type || "image/jpeg",
      fileName: file.name || "foto.jpg",
      width: 0,
      height: 0
    };
  }

  function normalizeSuggestion(data, input) {
    const analysis = data.analysis || {};
    const suggestionText = clean(data.suggestion);
    const recommendation = pickRecommendation(analysis, suggestionText, data.note);
    const likelyIssue = Boolean((analysis.possiveisInconformidades || []).length || analysis.categoriaProvavel || analysis.grauPreliminar);
    const suggestedStatus = normalizeStatus(analysis.suggestedStatus || analysis.statusSugerido || (likelyIssue ? "NC" : "C"));
    const suggestedSeverity = normalizeSeverity(analysis.suggestedSeverity || analysis.grauPreliminar);
    const context = {
      environmentId: input.environment?.id || input.existingResult?.environmentId || null,
      systemId: input.system?.id || input.existingResult?.systemId || null,
      itemId: input.item?.id || input.existingResult?.inspectionItemId || null
    };
    return {
      detectedIssue: suggestedStatus === "NC" && likelyIssue,
      suggestedStatus,
      suggestedSeverity,
      technicalDescription: clean(analysis.technicalDescription || analysis.descricaoTecnica || analysis.textoRelatorio || suggestionText),
      recommendation: recommendation.text,
      recommendationSource: recommendation.source,
      confidence: normalizeConfidence(analysis.confidence || analysis.confianca),
      context,
      itemMismatch: detectItemMismatch(analysis, suggestionText),
      suggestedEnvironmentId: normalizeSuggestedId(analysis.suggestedEnvironmentId || analysis.ambienteProvavelId, context.environmentId),
      suggestedSystemId: normalizeSuggestedId(analysis.suggestedSystemId || analysis.sistemaProvavelId, context.systemId),
      suggestedItemId: normalizeSuggestedId(analysis.suggestedItemId || analysis.itemProvavelId, context.itemId),
      observations: clean(analysis.observations || analysis.observacaoObrigatoria || "Sugestão assistida por IA, sujeita à validação do responsável técnico."),
      raw: sanitizeRaw(data)
    };
  }

  function pickRecommendation(analysis, suggestionText, note) {
    const fromAnalysis = clean(analysis.recomendacaoAcao || analysis.recommendation);
    if (fromAnalysis) return { text: fromAnalysis, source: "analysis" };
    if (isTechnicalRecommendation(suggestionText)) return { text: suggestionText, source: "suggestion" };
    const noteText = clean(note);
    if (isTechnicalRecommendation(noteText)) return { text: noteText, source: "note" };
    return { text: "", source: "not_returned" };
  }

  function isTechnicalRecommendation(value) {
    const text = clean(value).toLowerCase();
    if (!text || text.length < 24) return false;
    return /\b(recomenda|recomendacao|recomendação|corrigir|correcao|correção|substituir|reparar|avaliar|verificar|refazer|regularizar)\b/.test(text);
  }

  function detectItemMismatch(analysis, suggestionText) {
    if (analysis.itemMismatch === true || analysis.incompatibilidadeItem === true) return true;
    const text = [analysis.observacaoObrigatoria, analysis.textoRelatorio, analysis.descricaoTecnica, suggestionText].map(clean).join(" ").toLowerCase();
    return /foto|imagem/.test(text) && /não corresponde|nao corresponde|incompat[ií]vel|outro item|item informado/.test(text);
  }
  function normalizeStatus(value) {
    const status = String(value || "").trim().toUpperCase();
    if (statusSet.has(status)) return status;
    return "NV";
  }

  function normalizeSeverity(value) {
    const key = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (!key) return null;
    return severityMap[key] || (key.includes("critic") ? "critica" : key.includes("alt") ? "alta" : key.includes("baix") ? "baixa" : key.includes("medi") ? "media" : null);
  }

  function normalizeConfidence(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("alta")) return "alta";
    if (text.includes("baixa")) return "baixa";
    if (text.includes("media") || text.includes("média")) return "media";
    return null;
  }

  function normalizeSuggestedId(value, fallback) {
    const text = clean(value);
    return text && text !== fallback ? text : null;
  }

  function sanitizeRaw(data) {
    return {
      mode: data.mode || "",
      title: data.title || "",
      note: data.note || "",
      analysis: data.analysis ? {
        categoriaProvavel: data.analysis.categoriaProvavel || "",
        confianca: data.analysis.confianca || "",
        grauPreliminar: data.analysis.grauPreliminar || "",
        possiveisInconformidades: Array.isArray(data.analysis.possiveisInconformidades) ? data.analysis.possiveisInconformidades.slice(0, 5) : []
      } : null
    };
  }

  function clean(value) { return String(value || "").trim(); }
  function cleanBase64(value) { return String(value || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, ""); }
  function resolveEndpoint() {
    const configured = window.RELATORIO_QUALIDADE_CONFIG?.aiImageAnalysisUrl;
    if (configured) return String(configured);
    const baseUrl = String(window.OBRAREPORT_API_BASE_URL || window.OBRAREPORT_PRODUCTION_API_BASE_URL || "").replace(/\/+$/g, "");
    return baseUrl + ENDPOINT_PATH;
  }
  function buildPublicError(code, message) { const error = new Error(code); error.code = code; error.publicMessage = message; return error; }

  window.VistoriaEntregaAI = { analyzeInspectionPhoto, prepareImage, normalizeSuggestion, buildContext, endpoint: resolveEndpoint };
})();
