import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const DEFAULT_DATA_PATH = join(BACKEND_DIR, "data", "obrareport-transactional.json");

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value === undefined ? null : value));
}

function newId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
}

function hash(value) {
  return createHash("sha256").update(String(value || ""), "utf8").digest("hex");
}

function emptyDatabase() {
  return {
    reports: {},
    reportVersions: {},
    reportEvents: {},
    rdos: {},
    rdoVersions: {},
    rdoEvents: {},
    apartmentHandoverInspections: {},
    apartmentHandoverInspectionVersions: {},
    apartmentHandoverInspectionEvents: {},
    generatedDocuments: {},
    documentFiles: {}
  };
}

function readDatabase(dataPath) {
  if (!existsSync(dataPath)) return emptyDatabase();
  try {
    return Object.assign(emptyDatabase(), JSON.parse(readFileSync(dataPath, "utf8") || "{}"));
  } catch (_) {
    return emptyDatabase();
  }
}

function writeDatabase(dataPath, database) {
  mkdirSync(dirname(dataPath), { recursive: true });
  writeFileSync(dataPath, JSON.stringify(Object.assign(emptyDatabase(), database || {}), null, 2), "utf8");
}

function contextOf(context = {}) {
  const safe = objectOf(context);
  const profile = objectOf(safe.profile);
  const user = objectOf(safe.user);
  return {
    institutionId: clean(profile.institution_id || profile.institutionId || safe.institution_id || safe.institutionId),
    userId: clean(profile.user_id || profile.userId || profile.id || user.id || safe.user_id || safe.userId)
  };
}

function requireInstitution(context) {
  const ctx = contextOf(context);
  if (!ctx.institutionId) {
    throw Object.assign(new Error("institution_required"), { status: 400 });
  }
  return ctx;
}

function requirePayloadObject(value, code) {
  const safe = objectOf(value);
  if (!Object.keys(safe).length) {
    throw Object.assign(new Error(code), { status: 400 });
  }
  return safe;
}

function canAccess(record, context) {
  if (!record) return false;
  const ctx = contextOf(context);
  return Boolean(ctx.institutionId && record.institution_id === ctx.institutionId);
}

function requireAccess(record, context, notFoundCode, forbiddenCode) {
  if (!record) throw Object.assign(new Error(notFoundCode), { status: 404 });
  if (!canAccess(record, context)) throw Object.assign(new Error(forbiddenCode), { status: 403 });
}

function requireTenantRecord(record, context, notFoundCode) {
  if (!record || !canAccess(record, context)) throw Object.assign(new Error(notFoundCode), { status: 404 });
}

const APARTMENT_HANDOVER_SOURCE_TYPE = "apartment_handover_inspection";
const APARTMENT_HANDOVER_STATUSES = new Set(["draft", "completed", "final_pdf_generated", "archived"]);

function normalizeInspectionStatus(value) {
  const status = clean(value || "draft");
  if (!APARTMENT_HANDOVER_STATUSES.has(status)) {
    throw Object.assign(new Error("inspection_status_invalid"), { status: 400 });
  }
  return status;
}

function requireApartmentHandoverSourceType(value) {
  const sourceType = clean(value || APARTMENT_HANDOVER_SOURCE_TYPE);
  if (sourceType !== APARTMENT_HANDOVER_SOURCE_TYPE) {
    throw Object.assign(new Error("inspection_source_type_invalid"), { status: 400 });
  }
  return sourceType;
}
function escapeHtml(value) {
  return String(value || "").replace(/[&<>\"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function controlledHtmlDocument(title, data) {
  return [
    "<!doctype html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<title>" + escapeHtml(title) + "</title>",
    "<style>body{font-family:Arial,sans-serif;margin:32px;color:#111827}main{max-width:900px;margin:auto}.obrareport-controlled-document{border-top:4px solid #1f6feb}section{border:1px solid #dbe4ee;border-radius:8px;padding:16px;margin:16px 0}pre{white-space:pre-wrap;font-family:inherit}</style>",
    "</head>",
    "<body>",
    "<main class=\"obrareport-controlled-document\">",
    "<h1>" + escapeHtml(title) + "</h1>",
    "<section><h2>Dados controlados</h2><pre>" + escapeHtml(JSON.stringify(data || {}, null, 2)) + "</pre></section>",
    "<footer>Documento controlado pelo ObraReport.</footer>",
    "</main>",
    "</body>",
    "</html>"
  ].join("");
}

function createFile(database, institutionId, filename, html) {
  const file = {
    id: newId("obr_file"),
    institution_id: institutionId,
    filename,
    mime_type: "text/html; charset=utf-8",
    storage_path: null,
    public_url: "",
    size_bytes: Buffer.byteLength(html, "utf8"),
    hash: hash(html),
    created_at: now(),
    html_content: html
  };
  database.documentFiles[file.id] = file;
  return file;
}

function createDocument(database, institutionId, sourceType, sourceId, documentType, file, userId) {
  const document = {
    id: newId("obr_doc"),
    institution_id: institutionId,
    source_type: sourceType,
    source_id: sourceId,
    document_type: documentType,
    status: "generated",
    file_id: file.id,
    file_url: file.public_url || "",
    hash: file.hash,
    generated_by: clean(userId) || null,
    generated_at: now(),
    metadata_json: { fileName: file.filename, mode: "controlled_html" }
  };
  database.generatedDocuments[document.id] = document;
  return document;
}

export function createObraReportTransactionalService(options = {}) {
  const dataPath = options.dataPath || DEFAULT_DATA_PATH;

  function registerReportEvent(context, reportId, eventType, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const event = {
      id: newId("obr_report_event"),
      report_id: clean(reportId),
      institution_id: ctx.institutionId,
      event_type: clean(eventType),
      user_id: ctx.userId || null,
      payload_json: objectOf(payload),
      created_at: now()
    };
    database.reportEvents[event.id] = event;
    writeDatabase(dataPath, database);
    return clone(event);
  }

  function registerRdoEvent(context, rdoId, eventType, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const event = {
      id: newId("obr_rdo_event"),
      rdo_id: clean(rdoId),
      institution_id: ctx.institutionId,
      event_type: clean(eventType),
      user_id: ctx.userId || null,
      payload_json: objectOf(payload),
      created_at: now()
    };
    database.rdoEvents[event.id] = event;
    writeDatabase(dataPath, database);
    return clone(event);
  }

  function createTechnicalReport(context = {}, payload = {}) {
    const ctx = requireInstitution(context);
    const safe = objectOf(payload);
    const reportData = requirePayloadObject(safe.reportData || safe.report_data || safe.report_data_json, "report_data_required");
    const database = readDatabase(dataPath);
    const report = {
      id: newId("obr_report"),
      institution_id: ctx.institutionId,
      project_id: clean(safe.projectId || safe.project_id) || null,
      client_id: clean(safe.clientId || safe.client_id) || null,
      title: clean(safe.title || reportData.title || reportData.obra) || "Relatorio tecnico",
      status: clean(safe.status) || "draft",
      report_data_json: reportData,
      created_by: ctx.userId || null,
      updated_by: ctx.userId || null,
      created_at: now(),
      updated_at: now()
    };
    database.reports[report.id] = report;
    writeDatabase(dataPath, database);
    registerReportEvent(context, report.id, "report_created", { title: report.title });
    return clone(report);
  }

  function listTechnicalReports(context = {}, filters = {}) {
    requireInstitution(context);
    const safe = objectOf(filters);
    return Object.values(readDatabase(dataPath).reports)
      .filter((report) => canAccess(report, context))
      .filter((report) => !safe.projectId || report.project_id === clean(safe.projectId))
      .filter((report) => !safe.clientId || report.client_id === clean(safe.clientId))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }

  function getTechnicalReport(context = {}, id) {
    const report = readDatabase(dataPath).reports[clean(id)] || null;
    requireAccess(report, context, "report_not_found", "report_forbidden");
    return clone(report);
  }

  function updateTechnicalReport(context = {}, id, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const current = database.reports[clean(id)] || null;
    requireAccess(current, context, "report_not_found", "report_forbidden");
    const safe = objectOf(payload);
    const reportData = requirePayloadObject(safe.reportData || safe.report_data || safe.report_data_json || current.report_data_json, "report_data_required");
    const updated = Object.assign({}, current, {
      title: clean(safe.title || current.title) || current.title,
      status: clean(safe.status || current.status) || "draft",
      report_data_json: reportData,
      updated_by: ctx.userId || null,
      updated_at: now()
    });
    database.reports[updated.id] = updated;
    writeDatabase(dataPath, database);
    registerReportEvent(context, updated.id, "report_updated", { status: updated.status });
    return clone(updated);
  }

  function createTechnicalReportVersion(context = {}, id) {
    const database = readDatabase(dataPath);
    const report = database.reports[clean(id)] || null;
    requireAccess(report, context, "report_not_found", "report_forbidden");
    const versionNumber = Object.values(database.reportVersions).filter((version) => version.report_id === report.id).length + 1;
    const version = {
      id: newId("obr_report_version"),
      report_id: report.id,
      institution_id: report.institution_id,
      version_number: versionNumber,
      report_data_json: clone(report.report_data_json),
      created_by: contextOf(context).userId || null,
      created_at: now()
    };
    database.reportVersions[version.id] = version;
    writeDatabase(dataPath, database);
    registerReportEvent(context, report.id, "report_version_created", { versionId: version.id, versionNumber });
    return clone(version);
  }

  function generateTechnicalReportDocument(context = {}, id) {
    const database = readDatabase(dataPath);
    const report = database.reports[clean(id)] || null;
    requireAccess(report, context, "report_not_found", "report_forbidden");
    const html = controlledHtmlDocument("ObraReport - " + report.title, report.report_data_json);
    const file = createFile(database, report.institution_id, "obrareport-report-" + report.id + ".html", html);
    const document = createDocument(database, report.institution_id, "technical_report", report.id, "technical_report_controlled_html", file, contextOf(context).userId);
    writeDatabase(dataPath, database);
    registerReportEvent(context, report.id, "report_document_generated", { documentId: document.id, hash: document.hash });
    return clone(Object.assign({}, document, { file, html_content: html }));
  }

  function listReportEvents(context = {}, id) {
    getTechnicalReport(context, id);
    return Object.values(readDatabase(dataPath).reportEvents)
      .filter((event) => event.report_id === clean(id))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(clone);
  }

  function createRdo(context = {}, payload = {}) {
    const ctx = requireInstitution(context);
    const safe = objectOf(payload);
    const rdoData = requirePayloadObject(safe.rdoData || safe.rdo_data || safe.rdo_data_json, "rdo_data_required");
    const database = readDatabase(dataPath);
    const rdo = {
      id: newId("obr_rdo"),
      institution_id: ctx.institutionId,
      project_id: clean(safe.projectId || safe.project_id) || null,
      client_id: clean(safe.clientId || safe.client_id) || null,
      title: clean(safe.title || rdoData.title || rdoData.summary) || "Diario de Obras",
      rdo_date: clean(safe.rdoDate || safe.rdo_date || rdoData.date) || null,
      status: clean(safe.status) || "draft",
      rdo_data_json: rdoData,
      created_by: ctx.userId || null,
      updated_by: ctx.userId || null,
      created_at: now(),
      updated_at: now()
    };
    database.rdos[rdo.id] = rdo;
    writeDatabase(dataPath, database);
    registerRdoEvent(context, rdo.id, "rdo_created", { title: rdo.title });
    return clone(rdo);
  }

  function listRdos(context = {}, filters = {}) {
    requireInstitution(context);
    const safe = objectOf(filters);
    return Object.values(readDatabase(dataPath).rdos)
      .filter((rdo) => canAccess(rdo, context))
      .filter((rdo) => !safe.projectId || rdo.project_id === clean(safe.projectId))
      .filter((rdo) => !safe.clientId || rdo.client_id === clean(safe.clientId))
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }

  function getRdo(context = {}, id) {
    const rdo = readDatabase(dataPath).rdos[clean(id)] || null;
    requireAccess(rdo, context, "rdo_not_found", "rdo_forbidden");
    return clone(rdo);
  }

  function updateRdo(context = {}, id, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const current = database.rdos[clean(id)] || null;
    requireAccess(current, context, "rdo_not_found", "rdo_forbidden");
    const safe = objectOf(payload);
    const rdoData = requirePayloadObject(safe.rdoData || safe.rdo_data || safe.rdo_data_json || current.rdo_data_json, "rdo_data_required");
    const updated = Object.assign({}, current, {
      title: clean(safe.title || current.title) || current.title,
      status: clean(safe.status || current.status) || "draft",
      rdo_date: clean(safe.rdoDate || safe.rdo_date || rdoData.date || current.rdo_date) || null,
      rdo_data_json: rdoData,
      updated_by: ctx.userId || null,
      updated_at: now()
    });
    database.rdos[updated.id] = updated;
    writeDatabase(dataPath, database);
    registerRdoEvent(context, updated.id, "rdo_updated", { status: updated.status });
    return clone(updated);
  }

  function createRdoVersion(context = {}, id) {
    const database = readDatabase(dataPath);
    const rdo = database.rdos[clean(id)] || null;
    requireAccess(rdo, context, "rdo_not_found", "rdo_forbidden");
    const versionNumber = Object.values(database.rdoVersions).filter((version) => version.rdo_id === rdo.id).length + 1;
    const version = {
      id: newId("obr_rdo_version"),
      rdo_id: rdo.id,
      institution_id: rdo.institution_id,
      version_number: versionNumber,
      rdo_data_json: clone(rdo.rdo_data_json),
      created_by: contextOf(context).userId || null,
      created_at: now()
    };
    database.rdoVersions[version.id] = version;
    writeDatabase(dataPath, database);
    registerRdoEvent(context, rdo.id, "rdo_version_created", { versionId: version.id, versionNumber });
    return clone(version);
  }

  function generateRdoDocument(context = {}, id) {
    const database = readDatabase(dataPath);
    const rdo = database.rdos[clean(id)] || null;
    requireAccess(rdo, context, "rdo_not_found", "rdo_forbidden");
    const html = controlledHtmlDocument("ObraReport RDO - " + rdo.title, rdo.rdo_data_json);
    const file = createFile(database, rdo.institution_id, "obrareport-rdo-" + rdo.id + ".html", html);
    const document = createDocument(database, rdo.institution_id, "rdo", rdo.id, "rdo_controlled_html", file, contextOf(context).userId);
    writeDatabase(dataPath, database);
    registerRdoEvent(context, rdo.id, "rdo_document_generated", { documentId: document.id, hash: document.hash });
    return clone(Object.assign({}, document, { file, html_content: html }));
  }

  function listRdoEvents(context = {}, id) {
    getRdo(context, id);
    return Object.values(readDatabase(dataPath).rdoEvents)
      .filter((event) => event.rdo_id === clean(id))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(clone);
  }


  function registerApartmentHandoverInspectionEvent(context, inspectionId, eventType, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const event = {
      id: newId("obr_ahi_event"),
      inspection_id: clean(inspectionId),
      institution_id: ctx.institutionId,
      event_type: clean(eventType),
      user_id: ctx.userId || null,
      payload_json: objectOf(payload),
      created_at: now()
    };
    database.apartmentHandoverInspectionEvents[event.id] = event;
    writeDatabase(dataPath, database);
    return clone(event);
  }

  function validateReinspectionLink(database, context, reinspectionOfId) {
    const id = clean(reinspectionOfId);
    if (!id) return null;
    const previous = database.apartmentHandoverInspections[id] || null;
    requireTenantRecord(previous, context, "reinspection_not_found");
    return id;
  }

  function createApartmentHandoverInspection(context = {}, payload = {}) {
    const ctx = requireInstitution(context);
    const safe = objectOf(payload);
    requireApartmentHandoverSourceType(safe.sourceType || safe.source_type);
    const inspectionData = requirePayloadObject(safe.inspectionData || safe.inspection_data || safe.inspection_data_json, "inspection_data_required");
    const database = readDatabase(dataPath);
    const reinspectionOfId = validateReinspectionLink(database, context, safe.reinspectionOfId || safe.reinspection_of_id || inspectionData.reinspectionOfId || inspectionData.reinspection_of_id);
    const createdAt = now();
    const inspection = {
      id: newId("obr_ahi"),
      institution_id: ctx.institutionId,
      client_id: clean(safe.clientId || safe.client_id) || null,
      project_id: clean(safe.projectId || safe.project_id) || null,
      title: clean(safe.title || inspectionData.title || inspectionData.metadata?.projectName) || "Vistoria de Entrega",
      status: normalizeInspectionStatus(safe.status || inspectionData.status),
      source_type: APARTMENT_HANDOVER_SOURCE_TYPE,
      source_id: clean(safe.sourceId || safe.source_id) || null,
      inspection_data_json: inspectionData,
      created_by: ctx.userId || clean(safe.createdBy || safe.created_by) || null,
      updated_by: ctx.userId || clean(safe.updatedBy || safe.updated_by) || null,
      created_at: createdAt,
      updated_at: createdAt,
      completed_at: clean(safe.completedAt || safe.completed_at || inspectionData.completedAt || inspectionData.completed_at) || null,
      reopened_at: clean(safe.reopenedAt || safe.reopened_at || inspectionData.reopenedAt || inspectionData.reopened_at) || null,
      reinspection_of_id: reinspectionOfId
    };
    database.apartmentHandoverInspections[inspection.id] = inspection;
    writeDatabase(dataPath, database);
    registerApartmentHandoverInspectionEvent(context, inspection.id, "inspection_created", { title: inspection.title, status: inspection.status });
    if (inspection.status === "completed" || inspection.completed_at) {
      registerApartmentHandoverInspectionEvent(context, inspection.id, "inspection_completed", { completedAt: inspection.completed_at });
    }
    if (inspection.reopened_at) {
      registerApartmentHandoverInspectionEvent(context, inspection.id, "inspection_reopened", { reopenedAt: inspection.reopened_at });
    }
    return clone(inspection);
  }

  function listApartmentHandoverInspections(context = {}, filters = {}) {
    requireInstitution(context);
    const safe = objectOf(filters);
    const status = clean(safe.status);
    if (status) normalizeInspectionStatus(status);
    const projectId = clean(safe.projectId || safe.project_id);
    const clientId = clean(safe.clientId || safe.client_id);
    return Object.values(readDatabase(dataPath).apartmentHandoverInspections)
      .filter((inspection) => canAccess(inspection, context))
      .filter((inspection) => !projectId || inspection.project_id === projectId)
      .filter((inspection) => !clientId || inspection.client_id === clientId)
      .filter((inspection) => !status || inspection.status === status)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }

  function getApartmentHandoverInspection(context = {}, id) {
    const inspection = readDatabase(dataPath).apartmentHandoverInspections[clean(id)] || null;
    requireTenantRecord(inspection, context, "inspection_not_found");
    return clone(inspection);
  }

  function updateApartmentHandoverInspection(context = {}, id, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const current = database.apartmentHandoverInspections[clean(id)] || null;
    requireTenantRecord(current, context, "inspection_not_found");
    const safe = objectOf(payload);
    const inspectionData = requirePayloadObject(safe.inspectionData || safe.inspection_data || safe.inspection_data_json || current.inspection_data_json, "inspection_data_required");
    const nextStatus = normalizeInspectionStatus(safe.status || current.status);
    const completedAt = clean(safe.completedAt || safe.completed_at || inspectionData.completedAt || inspectionData.completed_at || current.completed_at) || null;
    const reopenedAt = clean(safe.reopenedAt || safe.reopened_at || inspectionData.reopenedAt || inspectionData.reopened_at || current.reopened_at) || null;
    const updated = Object.assign({}, current, {
      title: clean(safe.title || current.title) || current.title,
      status: nextStatus,
      inspection_data_json: inspectionData,
      updated_by: ctx.userId || clean(safe.updatedBy || safe.updated_by) || current.updated_by || null,
      updated_at: now(),
      completed_at: completedAt,
      reopened_at: reopenedAt
    });
    database.apartmentHandoverInspections[updated.id] = updated;
    writeDatabase(dataPath, database);
    registerApartmentHandoverInspectionEvent(context, updated.id, "inspection_updated", { status: updated.status });
    if (current.status !== "completed" && updated.status === "completed") {
      registerApartmentHandoverInspectionEvent(context, updated.id, "inspection_completed", { completedAt: updated.completed_at });
    }
    if (updated.reopened_at && updated.reopened_at !== current.reopened_at) {
      registerApartmentHandoverInspectionEvent(context, updated.id, "inspection_reopened", { reopenedAt: updated.reopened_at });
    }
    return clone(updated);
  }

  function createApartmentHandoverInspectionVersion(context = {}, id) {
    const database = readDatabase(dataPath);
    const inspection = database.apartmentHandoverInspections[clean(id)] || null;
    requireTenantRecord(inspection, context, "inspection_not_found");
    const versionNumber = Object.values(database.apartmentHandoverInspectionVersions).filter((version) => version.inspection_id === inspection.id).length + 1;
    const version = {
      id: newId("obr_ahi_version"),
      inspection_id: inspection.id,
      institution_id: inspection.institution_id,
      version_number: versionNumber,
      inspection_data_json: clone(inspection.inspection_data_json),
      created_by: contextOf(context).userId || null,
      created_at: now()
    };
    database.apartmentHandoverInspectionVersions[version.id] = version;
    writeDatabase(dataPath, database);
    registerApartmentHandoverInspectionEvent(context, inspection.id, "inspection_version_created", { versionId: version.id, versionNumber });
    return clone(version);
  }

  function listApartmentHandoverInspectionEvents(context = {}, id) {
    getApartmentHandoverInspection(context, id);
    return Object.values(readDatabase(dataPath).apartmentHandoverInspectionEvents)
      .filter((event) => event.inspection_id === clean(id))
      .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
      .map(clone);
  }

  function prepareDocumentEmail(context = {}, documentId, payload = {}) {
    const ctx = requireInstitution(context);
    const database = readDatabase(dataPath);
    const document = database.generatedDocuments[clean(documentId)] || null;
    requireAccess(document, context, "document_not_found", "document_forbidden");
    const safe = objectOf(payload);
    const eventStore = document.source_type === "rdo" ? database.rdoEvents : database.reportEvents;
    const sourceKey = document.source_type === "rdo" ? "rdo_id" : "report_id";
    for (const eventType of ["email_prepared", "email_sent_placeholder"]) {
      const event = {
        id: newId(document.source_type === "rdo" ? "obr_rdo_event" : "obr_report_event"),
        [sourceKey]: document.source_id,
        institution_id: ctx.institutionId,
        event_type: eventType,
        user_id: ctx.userId || null,
        payload_json: { documentId: document.id, sent: false },
        created_at: now()
      };
      eventStore[event.id] = event;
    }
    writeDatabase(dataPath, database);
    return {
      ok: true,
      mode: "prepared",
      sent: false,
      subject: clean(safe.subject) || "Documento ObraReport",
      body: clean(safe.body) || "Segue documento preparado pelo ObraReport para revisao e envio.",
      fileUrl: document.file_url || "",
      message: "Email preparado. Envio real depende de provedor SMTP/Resend configurado."
    };
  }

  return {
    dataPath,
    createTechnicalReport,
    listTechnicalReports,
    getTechnicalReport,
    updateTechnicalReport,
    createTechnicalReportVersion,
    generateTechnicalReportDocument,
    listReportEvents,
    createRdo,
    listRdos,
    getRdo,
    updateRdo,
    createRdoVersion,
    generateRdoDocument,
    listRdoEvents,
    registerReportEvent,
    registerRdoEvent,
    createApartmentHandoverInspection,
    listApartmentHandoverInspections,
    getApartmentHandoverInspection,
    updateApartmentHandoverInspection,
    createApartmentHandoverInspectionVersion,
    listApartmentHandoverInspectionEvents,
    registerApartmentHandoverInspectionEvent,
    prepareDocumentEmail
  };
}

export const defaultObraReportTransactionalService = createObraReportTransactionalService();