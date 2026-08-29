(function (root, factory) {
  const adapter = factory();
  if (typeof module === "object" && module.exports) module.exports = adapter;
  root.ApartmentHandoverDocumentAdapter = adapter;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  const SOURCE_TYPE = "apartment_handover_inspection";
  const NOT_INSPECTED = "NAO_INSPECIONADO";
  const PDF_FIELDS = ["documentId", "document_id", "latestDocumentId", "latest_document_id", "fileId", "file_id", "latestFileId", "latest_file_id", "pdfUrl", "pdf_url"];
  const BLOB_FIELDS = new Set(["blob", "data", "base64", "file", "previewUrl", "objectUrl", "url"]);

  function clean(value) {
    return String(value || "").trim();
  }

  function valueOf(source, keys) {
    for (const key of keys) {
      if (source && source[key] !== undefined && source[key] !== null && clean(source[key])) return source[key];
    }
    return "";
  }

  function getInspection(state) {
    if (!state || typeof state !== "object") return {};
    if (state.inspection && typeof state.inspection === "object") return state.inspection;
    if (state.report && state.report.inspection && typeof state.report.inspection === "object") return state.report.inspection;
    return {};
  }

  function getSourceId(state, inspection) {
    return clean(valueOf(inspection, ["id", "inspectionId", "inspection_id"])) ||
      clean(valueOf(state || {}, ["id", "inspectionId", "inspection_id", "sourceId", "source_id"])) ||
      null;
  }

  function getMetadata(state, inspection) {
    return inspection.metadata || state?.metadata || state?.report || {};
  }

  function getResults(inspection) {
    if (inspection.results && typeof inspection.results === "object") return Object.values(inspection.results);
    if (Array.isArray(inspection.items)) return inspection.items;
    return [];
  }

  function normalizeItemStatus(status) {
    const normalized = clean(status).toUpperCase();
    if (normalized === "NI") return NOT_INSPECTED;
    return normalized || NOT_INSPECTED;
  }

  function buildSummary(state) {
    const inspection = getInspection(state);
    const results = getResults(inspection);
    const counts = {
      totalItems: 0,
      conforme: 0,
      naoConforme: 0,
      naoAplicavel: 0,
      naoVerificado: 0,
      naoInspecionado: 0
    };

    for (const result of results) {
      const status = normalizeItemStatus(result?.status);
      counts.totalItems += 1;
      if (status === "C") counts.conforme += 1;
      else if (status === "NC") counts.naoConforme += 1;
      else if (status === "NA") counts.naoAplicavel += 1;
      else if (status === "NV") counts.naoVerificado += 1;
      else if (status === NOT_INSPECTED) counts.naoInspecionado += 1;
    }

    return counts;
  }

  function countPhotos(state) {
    const inspection = getInspection(state);
    const ids = new Set();
    const photos = inspection.photos && typeof inspection.photos === "object" ? Object.values(inspection.photos) : [];

    for (const photo of photos) {
      const id = clean(photo?.id || photo?.photoId || photo?.photo_id);
      if (id) ids.add(id);
    }

    for (const result of getResults(inspection)) {
      for (const id of result?.photoIds || result?.photo_ids || []) {
        if (clean(id)) ids.add(clean(id));
      }
      for (const photo of result?.fotos || []) {
        const id = clean(photo?.id || photo?.photoId || photo?.photo_id || photo?.legenda);
        if (id) ids.add(id);
      }
    }

    return ids.size;
  }

  function sanitizePhotoMetadata(photo) {
    if (!photo || typeof photo !== "object") return photo;
    const sanitized = {};
    for (const [key, value] of Object.entries(photo)) {
      if (BLOB_FIELDS.has(key)) continue;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        sanitized[key] = sanitizePhotoMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  function sanitizePhotos(photos) {
    if (!photos || typeof photos !== "object") return {};
    return Object.fromEntries(Object.entries(photos).map(([key, value]) => [key, sanitizePhotoMetadata(value)]));
  }

  function hasPersistedPdf(options) {
    return PDF_FIELDS.some((field) => clean(options?.[field]));
  }

  function normalizeDocumentStatus(state, options) {
    const inspection = getInspection(state);
    const status = clean(inspection.status || state?.status).toLowerCase();
    if (status === "archived" || status === "arquivado") return "archived";
    if (hasPersistedPdf(options)) return "final_pdf_generated";
    if (status === "completed" || status === "finalizada" || inspection.completedAt) return "completed";
    return "draft";
  }

  function canContinue(status) {
    return status === "draft";
  }

  function canReinspect(status) {
    return status === "completed" || status === "final_pdf_generated";
  }

  function buildTitle(state) {
    const inspection = getInspection(state);
    const metadata = getMetadata(state, inspection);
    const project = clean(valueOf(metadata, ["projectName", "obra", "empreendimento"]));
    const tower = clean(valueOf(metadata, ["towerName", "torre", "bloco"]));
    const unit = clean(valueOf(metadata, ["unitName", "unidade"]));
    const parts = ["Vistoria de Entrega"];
    if (project) parts.push(project);
    if (tower || unit) parts.push([tower, unit].filter(Boolean).join(" "));
    return parts.join(" - ");
  }

  function getCreatedAt(state, inspection) {
    return clean(valueOf(inspection, ["createdAt", "created_at", "startedAt", "started_at"])) ||
      clean(valueOf(state || {}, ["createdAt", "created_at"])) ||
      null;
  }

  function getUpdatedAt(state, inspection) {
    return clean(valueOf(inspection, ["updatedAt", "updated_at", "reopenedAt", "reopened_at", "completedAt", "completed_at", "startedAt", "started_at"])) ||
      clean(valueOf(state || {}, ["updatedAt", "updated_at"])) ||
      null;
  }

  function toDocument(state, context, options) {
    const inspection = getInspection(state);
    const metadata = getMetadata(state, inspection);
    const status = normalizeDocumentStatus(state, options);
    const summary = buildSummary(state);
    const photoCount = countPhotos(state);
    const sourceId = getSourceId(state, inspection);
    const latestDocumentId = valueOf(options || {}, ["latestDocumentId", "latest_document_id", "documentId", "document_id"]) || null;
    const latestFileId = valueOf(options || {}, ["latestFileId", "latest_file_id", "fileId", "file_id"]) || null;

    return {
      sourceType: SOURCE_TYPE,
      sourceId,
      institutionId: valueOf(context || {}, ["institutionId", "institution_id"]) || null,
      clientId: valueOf(context || {}, ["clientId", "client_id"]) || null,
      projectId: valueOf(context || {}, ["projectId", "project_id"]) || null,
      title: buildTitle(state),
      status,
      createdBy: valueOf(context || {}, ["createdBy", "created_by", "userId", "user_id"]) || null,
      createdAt: getCreatedAt(state, inspection),
      updatedAt: getUpdatedAt(state, inspection),
      completedAt: valueOf(inspection, ["completedAt", "completed_at"]) || null,
      canContinue: canContinue(status),
      canReinspect: canReinspect(status),
      pdfAvailable: hasPersistedPdf(options),
      latestDocumentId,
      latestFileId,
      pdfUrl: valueOf(options || {}, ["pdfUrl", "pdf_url"]) || null,
      metadata: {
        inspectionType: valueOf(metadata, ["inspectionType", "tipoVistoria", "tipo"]) || null,
        projectName: valueOf(metadata, ["projectName", "obra", "empreendimento"]) || null,
        developerName: valueOf(metadata, ["developerName", "construtora"]) || null,
        towerName: valueOf(metadata, ["towerName", "torre", "bloco"]) || null,
        unitName: valueOf(metadata, ["unitName", "unidade"]) || null,
        address: valueOf(metadata, ["address", "endereco"]) || null,
        clientName: valueOf(metadata, ["clientName", "cliente", "proprietario"]) || null,
        technicalResponsible: valueOf(metadata, ["technicalResponsible", "responsavelTecnico"]) || null,
        professionalRegistry: valueOf(metadata, ["professionalRegistry", "creaCau"]) || null,
        inspectionDate: valueOf(metadata, ["inspectionDate", "dataVistoria"]) || null,
        reinspectionOfId: valueOf(inspection, ["reinspectionOfId", "reinspection_of_id"]) || null,
        photoCount,
        hasPhotos: photoCount > 0,
        summary
      }
    };
  }

  function toDocumentListItem(state, context, options) {
    const document = toDocument(state, context, options);
    return {
      id: document.latestDocumentId || document.sourceId,
      sourceType: document.sourceType,
      sourceId: document.sourceId,
      title: document.title,
      clientId: document.clientId,
      projectId: document.projectId,
      status: document.status,
      updatedAt: document.updatedAt,
      author: document.createdBy,
      pdfAvailable: document.pdfAvailable,
      canContinue: document.canContinue,
      canReinspect: document.canReinspect
    };
  }

  function toTransactionalPayload(state, context, options) {
    const document = toDocument(state, context, options);
    const inspection = getInspection(state);
    return {
      institution_id: document.institutionId,
      client_id: document.clientId,
      project_id: document.projectId,
      created_by: document.createdBy,
      updated_by: document.createdBy,
      source_type: SOURCE_TYPE,
      source_id: document.sourceId,
      title: document.title,
      status: document.status,
      inspection_data_json: {
        ...inspection,
        photos: sanitizePhotos(inspection.photos),
        documentMetadata: document.metadata
      }
    };
  }

  return {
    SOURCE_TYPE,
    NOT_INSPECTED,
    buildSummary,
    countPhotos,
    normalizeDocumentStatus,
    toDocument,
    toDocumentListItem,
    toTransactionalPayload
  };
});
