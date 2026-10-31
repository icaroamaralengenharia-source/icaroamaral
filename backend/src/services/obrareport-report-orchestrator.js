import { createHash } from "node:crypto";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

const SOURCE_TYPES = new Set(["analysis", "image_analysis", "rdo", "manual"]);
// One repository object represents one document registry in this process.
// The durable unique index is (institution_id, idempotency_key). It does not
// reserve an external generation; this map is not a distributed lock.
const generationFlights = new WeakMap();

function httpError(code, status = 400, cause = null) {
  return Object.assign(new Error(code), { status, cause });
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && clean(value) !== "");
}

function standaloneProductionText(value) {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!item || typeof item !== "object") return clean(item);
    const quantity = item.quantity === 0 ? "0" : clean(item.quantity);
    const amount = [quantity, clean(item.unit)].filter(Boolean).join(" ");
    const description = [clean(item.service), amount].filter(Boolean).join(": ");
    return [description, clean(item.note)].filter(Boolean).join(" — ");
  }).filter(Boolean).join("; ");
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
      climate: firstValue(data.climate, data.clima, data.weather),
      impact: firstValue(data.impact, data.impacts, data.interferencias, data.interferências),
      hours: firstValue(data.hours, data.horario, data.jornada, [data.startTime, data.endTime].filter(Boolean).join(" - ")),
      team: firstValue(data.team, data.equipe, data.teamPresent),
      workers: firstValue(data.workers, data.workerCount, data.trabalhadores, data.funcionarios, data.employeeCount),
      services: firstValue(data.services, data.activities, data.atividades, data.servicos, data.serviços),
      physicalProgress: firstValue(data.physicalProgress, data.progress, data.avancoFisico, data.avanco_fisico),
      production: firstValue(data.production, data.producao, data.produção, standaloneProductionText(data.productions)),
      materials: firstValue(data.materials, data.materiais),
      requests: firstValue(data.requests, data.solicitacoes, data.solicitações, data.materialRequests),
      tools: firstValue(data.tools, data.equipment, data.ferramentas, data.equipamentos),
      safety: firstValue(data.safety, data.seguranca, data.segurança),
      occurrences: firstValue(data.occurrences, data.ocorrencias, data.ocorrências),
      observations: firstValue(data.observations, data.observation, data.observacoes, data.observações, data.generalNotes),
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
  if (!body || body.ok !== true || !pdfUrl) throw httpError("report_generator_invalid_response", 502);
  return { pdfUrl, pdfFileId };
}

function institutionOf(context) {
  const safe = objectOf(context);
  const profile = objectOf(safe.profile);
  // Match the canonical document repository's tenant precedence exactly.
  return clean(profile.institution_id || profile.institutionId || safe.institutionId || safe.institution_id);
}

function requestFingerprint(identity, payload, generatedRdoPayload) {
  const stablePayload = generatedRdoPayload ? Object.assign({}, payload, { submittedAt: undefined }) : payload;
  const serialized = JSON.stringify({ identity, payload: stablePayload }, (_key, value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
  });
  return createHash("sha256").update(serialized).digest("hex");
}

function requireSameOperation(document, identity, fingerprint) {
  const metadata = objectOf(document && (document.metadata_json || document.metadata));
  const stored = objectOf(document);
  const field = (snake, camel) => Object.hasOwn(stored, snake)
    ? { present: true, value: clean(stored[snake]) }
    : { present: Object.hasOwn(stored, camel), value: clean(stored[camel]) };
  const pairs = [
    [field("institution_id", "institutionId"), identity.institutionId],
    [field("work_id", "workId"), identity.workId],
    [field("rdo_id", "rdoId"), identity.rdoId],
    [field("source_id", "sourceId"), identity.sourceId],
    [field("document_type", "documentType"), identity.documentType]
  ];
  // Legacy rows can omit optional metadata. A known different target must
  // never be returned just because it reused the same tenant-level key.
  const sourceType = clean(metadata.sourceType || stored.source_type || stored.sourceType);
  const compatibleType = !sourceType || sourceType === identity.sourceType ||
    sourceType === "technical_report" && identity.sourceType !== "rdo";
  if (!compatibleType || pairs.some(([actual, expected]) => actual.present && actual.value !== expected) ||
      metadata.generationRequestFingerprint && metadata.generationRequestFingerprint !== fingerprint) {
    throw httpError("document_idempotency_key_conflict", 409);
  }
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
    // Every caller performs its own repository authorization/validation before
    // it may observe another request's in-flight result.
    const existing = await documentRepository.findByIdempotencyKey(context, idempotencyKey);
    const explicitPayload = objectOf(safe.generatorPayload || safe.generator_payload);
    const hasExplicitPayload = Object.keys(explicitPayload).length > 0;
    const generatorPayload = hasExplicitPayload ? explicitPayload
      : (rdo ? buildRdoGeneratorPayload(rdo, safe, work, context) : {});
    const identity = {
      institutionId: institutionOf(context), sourceType, sourceId,
      workId, rdoId: clean(safe.rdoId || safe.rdo_id),
      documentType: clean(safe.documentType || safe.document_type) || (sourceType === "rdo" ? "rdo_pdf" : "technical_report_pdf")
    };
    if (!identity.institutionId) throw httpError("institution_required", 400);
    const fingerprint = requestFingerprint(identity, generatorPayload, Boolean(rdo && !hasExplicitPayload));
    if (existing) {
      requireSameOperation(existing, identity, fingerprint);
      return { document: existing, duplicate: true, generatorCalled: false };
    }
    if (typeof fetchImpl !== "function" || !clean(appsScriptUrl)) throw httpError("report_generator_not_configured", 503);
    let flights = generationFlights.get(documentRepository);
    if (!flights) { flights = new Map(); generationFlights.set(documentRepository, flights); }
    const key = JSON.stringify([identity.institutionId, idempotencyKey]);
    const pending = flights.get(key);
    if (pending) {
      if (pending.fingerprint !== fingerprint) throw httpError("document_idempotency_key_conflict", 409);
      const completed = await pending.promise;
      requireSameOperation(completed.document, identity, fingerprint);
      return { document: completed.document, duplicate: true, generatorCalled: false };
    }
    const flight = { fingerprint, promise: null };
    flight.promise = (async () => {
      // Close the gap between the caller's initial read and acquiring its
      // process-local flight; another request may already have persisted it.
      const raced = await documentRepository.findByIdempotencyKey(context, idempotencyKey);
      if (raced) {
        requireSameOperation(raced, identity, fingerprint);
        return { document: raced, duplicate: true, generatorCalled: false };
      }
      const response = await fetchImpl(appsScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(generatorPayload)
      });
      const body = await response.json().catch(() => ({}));
      const generated = validateGeneratorResponse(response, body);
      const inserted = await documentRepository.insert(context, {
        sourceType, sourceId, workId, rdoId: identity.rdoId, documentType: identity.documentType,
        title: clean(safe.title) || clean(generatorPayload.report && (generatorPayload.report.workName || generatorPayload.report.obra)) || "RDO",
        provider: "google_drive_apps_script", externalFileId: generated.pdfFileId,
        artifactUrl: generated.pdfUrl, idempotencyKey,
        metadata: Object.assign({}, objectOf(safe.metadata), { generatorRequestId: clean(body.requestId),
          mimeType: "application/pdf", generationRequestFingerprint: fingerprint })
      });
      requireSameOperation(inserted.document, identity, fingerprint);
      return { document: inserted.document, duplicate: inserted.duplicate, generatorCalled: true };
    })();
    flights.set(key, flight);
    try {
      return await flight.promise;
    } finally {
      if (flights.get(key) === flight) flights.delete(key);
    }
  }

  return { generate };
}
