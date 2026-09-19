function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeRdo(rdo) {
  if (!rdo) return null;
  const data = objectOf(rdo.rdo_data_json || rdo.rdoData);
  return {
    id: clean(rdo.id),
    date: clean(rdo.rdo_date || rdo.date || data.date),
    observation: clean(data.observation || data.observations || data.observacoes || data.summary)
  };
}

function normalizeWork(work, document) {
  if (!work && !document.work_id) return null;
  const data = objectOf(document.metadata_json);
  return {
    id: clean(work && work.id || document.work_id),
    name: clean(work && (work.name || work.title || work.project_name) || data.workName)
  };
}

export function buildObraReportDocumentContext({ document, work = null, rdo = null } = {}) {
  const safeDocument = objectOf(document);
  return {
    document: {
      id: clean(safeDocument.id),
      title: clean(safeDocument.title || safeDocument.document_type),
      documentType: clean(safeDocument.document_type),
      sourceType: clean(safeDocument.source_type),
      sourceId: clean(safeDocument.source_id),
      workId: clean(safeDocument.work_id),
      rdoId: clean(safeDocument.rdo_id),
      status: clean(safeDocument.status),
      createdAt: safeDocument.created_at || safeDocument.generated_at || null,
      updatedAt: safeDocument.updated_at || safeDocument.created_at || safeDocument.generated_at || null
    },
    work: normalizeWork(work, safeDocument),
    rdo: normalizeRdo(rdo),
    summary: clean(safeDocument.title || safeDocument.document_type || "Relatório técnico"),
    generatedAt: safeDocument.created_at || safeDocument.generated_at || null
  };
}
