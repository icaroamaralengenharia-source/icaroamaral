function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const SOURCE_TYPES = new Set(["analysis", "image_analysis", "rdo", "manual"]);

function httpError(code, status = 400, cause = null) {
  return Object.assign(new Error(code), { status, cause });
}

function generatorPayloadForRdo(rdo, input = {}) {
  const data = objectOf(rdo && (rdo.rdo_data_json || rdo.rdoData));
  const workName = clean(input.workName || data.workName || data.obra || data.projectName || "ObraReport");
  return {
    submittedAt: new Date().toISOString(),
    source: "rdo",
    tipoRelatorio: "RDO",
    report: {
      obra: workName,
      date: clean(rdo.rdo_date || data.date),
      observacoes: clean(data.observation || data.observations || data.observacoes || data.summary || ""),
      atividades: Array.isArray(data.activities) ? data.activities : [],
      dadosRdo: data
    },
    fotosUnidade: [],
    inconformidades: []
  };
}

function validateGeneratorResponse(response, body) {
  const pdfUrl = clean(body && body.pdfUrl);
  const pdfFileId = clean(body && (body.pdfFileId || body.fileId));
  if (!response || !response.ok) throw httpError("report_generator_failed", 502);
  if (!body || body.ok !== true || !pdfUrl) throw httpError("report_generator_invalid_response", 502);
  return { pdfUrl, pdfFileId };
}

export function createObraReportReportOrchestrator({ documentRepository, rdoRepository = null, appsScriptUrl = "", fetchImpl = globalThis.fetch } = {}) {
  if (!documentRepository) throw new Error("document_repository_required");

  async function generate(context, input = {}) {
    const safe = objectOf(input);
    const sourceType = clean(safe.sourceType || safe.source_type).toLowerCase();
    if (!SOURCE_TYPES.has(sourceType)) throw httpError("document_source_type_invalid", 400);
    const workId = clean(safe.workId || safe.work_id);
    const rdoId = clean(safe.rdoId || safe.rdo_id);
    if (sourceType === "rdo" && (!rdoId || !rdoRepository || typeof rdoRepository.getById !== "function")) {
      throw httpError("rdo_repository_not_configured", 503);
    }
    if (workId && typeof documentRepository.validateWork === "function") {
      await documentRepository.validateWork(context, workId);
    }
    let rdo = null;
    if (sourceType === "rdo") {
      rdo = await rdoRepository.getById(context, rdoId);
      if (workId && clean(rdo.project_id) && clean(rdo.project_id) !== workId) throw httpError("rdo_work_mismatch", 403);
    }
    const sourceId = clean(safe.sourceId || safe.source_id || rdoId || workId || sourceType);
    const idempotencyKey = clean(safe.idempotencyKey || safe.idempotency_key);
    if (!idempotencyKey) throw httpError("document_idempotency_key_required", 400);
    const existing = await documentRepository.findByIdempotencyKey(context, idempotencyKey);
    if (existing) return { document: existing, duplicate: true, generatorCalled: false };
    if (typeof fetchImpl !== "function" || !clean(appsScriptUrl)) throw httpError("report_generator_not_configured", 503);
    const generatorPayload = Object.keys(objectOf(safe.generatorPayload || safe.generator_payload)).length
      ? objectOf(safe.generatorPayload || safe.generator_payload)
      : (rdo ? generatorPayloadForRdo(rdo, safe) : {});
    const response = await fetchImpl(appsScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(generatorPayload)
    });
    const body = await response.json().catch(() => ({}));
    const generated = validateGeneratorResponse(response, body);
    const inserted = await documentRepository.insert(context, {
      sourceType,
      sourceId,
      workId,
      rdoId: sourceType === "rdo" ? rdoId : clean(safe.rdoId || safe.rdo_id),
      documentType: clean(safe.documentType || safe.document_type) || "technical_report_pdf",
      title: clean(safe.title) || clean(generatorPayload.report && generatorPayload.report.obra) || "Relatório técnico",
      provider: "google_drive_apps_script",
      externalFileId: generated.pdfFileId,
      artifactUrl: generated.pdfUrl,
      idempotencyKey,
      metadata: Object.assign({}, objectOf(safe.metadata), { generatorRequestId: clean(body.requestId), mimeType: "application/pdf" })
    });
    return { document: inserted.document, duplicate: inserted.duplicate, generatorCalled: true };
  }

  return { generate };
}
