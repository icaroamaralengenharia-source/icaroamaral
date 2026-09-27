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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && clean(value) !== "");
}

export function buildRdoGeneratorPayload(rdo, input = {}, work = null, context = {}) {
  const data = objectOf(rdo && (rdo.rdo_data_json || rdo.rdoData));
  const workRecord = objectOf(work);
  const safeInput = objectOf(input);
  const safeContext = objectOf(context);
  const workName = clean(firstValue(
    safeInput.workName,
    data.workName,
    data.work_name,
    data.obra,
    data.projectName,
    workRecord.name,
    workRecord.title,
    workRecord.project_name
  ));
  const date = clean(firstValue(rdo && rdo.rdo_date, data.date, data.rdoDate, data.rdo_date));
  const photos = Array.isArray(data.photos) ? data.photos : Array.isArray(data.fotos) ? data.fotos : [];
  return {
    submittedAt: new Date().toISOString(),
    source: "rdo",
    documentType: "rdo",
    tipoRelatorio: "RDO",
    workId: clean(safeInput.workId || safeInput.work_id || rdo && (rdo.project_id || rdo.projectId)),
    rdoId: clean(safeInput.rdoId || safeInput.rdo_id || rdo && rdo.id),
    institutionId: clean(safeContext.institutionId || safeContext.institution_id || safeContext.profile && (safeContext.profile.institution_id || safeContext.profile.institutionId)),
    report: {
      date,
      workName,
      responsible: firstValue(data.responsible, data.responsavel, data.responsavelTecnico, data.responsiblePerson),
      climate: firstValue(data.climate, data.clima),
      impact: firstValue(data.impact, data.impacts, data.interferencias, data.interferências),
      hours: firstValue(data.hours, data.horario, data.jornada),
      team: firstValue(data.team, data.equipe),
      workers: firstValue(data.workers, data.workerCount, data.trabalhadores, data.funcionarios),
      services: firstValue(data.services, data.activities, data.atividades, data.servicos, data.serviços),
      physicalProgress: firstValue(data.physicalProgress, data.progress, data.avancoFisico, data.avanco_fisico),
      production: firstValue(data.production, data.producao, data.produção),
      materials: firstValue(data.materials, data.materiais),
      requests: firstValue(data.requests, data.solicitacoes, data.solicitações),
      tools: firstValue(data.tools, data.equipment, data.ferramentas, data.equipamentos),
      safety: firstValue(data.safety, data.seguranca, data.segurança),
      occurrences: firstValue(data.occurrences, data.ocorrencias, data.ocorrências),
      observations: firstValue(data.observations, data.observation, data.observacoes, data.observações),
      photos,
      summary: firstValue(data.summary, data.resumo),
      sourceData: data
    },
    fotosRdo: photos
  };
}

function validateGeneratorResponse(response, body) {
  const pdfUrl = clean(body && body.pdfUrl);
  const pdfFileId = clean(body && (body.pdfFileId || body.fileId));
  if (!response || !response.ok) throw httpError("report_generator_failed", 502);
  if (!body || body.ok !== true || !pdfUrl || !pdfFileId) throw httpError("report_generator_invalid_response", 502);
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
    let work = null;
    if (workId && typeof documentRepository.validateWork === "function") {
      work = await documentRepository.validateWork(context, workId);
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
    if (typeof documentRepository.ensureReady === "function") await documentRepository.ensureReady(context);
    if (typeof fetchImpl !== "function" || !clean(appsScriptUrl)) throw httpError("report_generator_not_configured", 503);
    const generatorPayload = Object.keys(objectOf(safe.generatorPayload || safe.generator_payload)).length
      ? objectOf(safe.generatorPayload || safe.generator_payload)
      : (rdo ? buildRdoGeneratorPayload(rdo, safe, work, context) : {});
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
      documentType: clean(safe.documentType || safe.document_type) || (sourceType === "rdo" ? "rdo_pdf" : "technical_report_pdf"),
      title: clean(safe.title) || clean(generatorPayload.report && (generatorPayload.report.workName || generatorPayload.report.obra)) || "RDO",
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
