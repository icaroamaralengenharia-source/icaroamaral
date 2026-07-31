import crypto from "node:crypto";
import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";

const WRITE_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const SENSITIVE_KEY = /token|secret|password|senha|authorization|bearer|service_role|storage_path|storagePath/i;
const DOCUMENT_TYPES = new Set(["inventario", "inspecao", "conferencia", "prestacao_contas", "nota", "termo", "relatorio", "outro"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function makeError(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sanitize(value, depth = 0) {
  if (depth > 5) return null;
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key) || key === "project_id" || key === "projectId") continue;
    out[key] = sanitize(item, depth + 1);
  }
  return out;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value).sort().reduce((out, key) => {
    if (!SENSITIVE_KEY.test(key) && key !== "project_id" && key !== "projectId") out[key] = stable(value[key]);
    return out;
  }, {});
}

function hashReport(report) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(report))).digest("hex");
}

function publicDocument(document) {
  const copy = sanitize(document || {});
  delete copy.storage_path;
  delete copy.storagePath;
  return copy;
}

function publicVersion(version) {
  const copy = sanitize(version || {});
  delete copy.storage_path;
  delete copy.storagePath;
  return copy;
}

async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") {
    const id = clean(requestedInstitutionId);
    if (!id) throw makeError(400, "institution_id_required");
    const institution = await store.get("institutions", id);
    if (!institution) throw makeError(404, "institution_not_found");
    return id;
  }
  const id = clean(session.institutionId);
  if (!id) throw makeError(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw makeError(403, "institution_scope_forbidden");
  const institution = await store.get("institutions", id);
  if (!institution) throw makeError(404, "institution_not_found");
  return id;
}

async function resolveUnit(store, session, institutionId, requestedUnitId) {
  const id = clean(requestedUnitId || (session.role === "gestor" ? session.unitId : ""));
  if (!id) return null;
  const unit = await store.get("units", id);
  if (!unit || clean(unit.institution_id) !== clean(institutionId)) throw makeError(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== id) throw makeError(403, "unit_scope_forbidden");
  return id;
}

function documentType(value, report) {
  const explicit = lower(value);
  if (DOCUMENT_TYPES.has(explicit)) return explicit;
  const reportType = lower(report && report.type);
  if (reportType === "inventory") return "inventario";
  if (reportType === "conference") return "conferencia";
  if (reportType === "accountability") return "prestacao_contas";
  if (reportType === "receipt_term") return "termo";
  return "relatorio";
}

async function duplicateByOperation(store, institutionId, operationId) {
  if (!operationId) return null;
  const audits = await store.list("municipal_admin_audit_log", { institution_id: institutionId });
  return audits.find((item) => clean(item.action) === "report_archived" && (clean(item.target_id) === operationId || clean(item.metadata && item.metadata.operation_id) === operationId));
}

async function duplicateByHash(store, institutionId, fileHash) {
  const versions = await store.list("municipal_document_versions", { institution_id: institutionId });
  return versions.find((item) => clean(item.file_hash) === fileHash);
}

async function writeAudit(store, session, action, institutionId, targetType, targetId, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: clean(institutionId),
    target_type: targetType,
    target_id: clean(targetId),
    action,
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

export function createMunicipalReportArchiveService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const now = options.now || (() => new Date());

  return {
    async archive(context, body = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      if (!WRITE_ROLES.has(session.role)) throw makeError(403, "municipal_report_archive_forbidden");
      const report = sanitize(body.report || {});
      if (body.confirmation !== true) return { archived: false, report, error: "confirmation_required" };

      const operationId = clean(body.operation_id || body.operationId);
      if (!operationId) throw makeError(400, "operation_id_required");
      const institutionId = await resolveInstitution(store, session, body.institution_id || body.institutionId || report.institution_id || report.institutionId);
      const unitId = await resolveUnit(store, session, institutionId, body.unit_id || body.unitId || report.unit_id || report.unitId);
      const title = clean(body.title || report.title);
      if (!title) throw makeError(400, "document_title_required");
      const type = documentType(body.document_type || body.documentType, report);
      const fileHash = hashReport(report);
      const existingOperation = await duplicateByOperation(store, institutionId, operationId);
      if (existingOperation) throw makeError(409, "report_archive_operation_duplicate");
      const existingHash = await duplicateByHash(store, institutionId, fileHash);
      if (existingHash) throw makeError(409, "report_archive_hash_duplicate");

      try {
        const timestamp = nowIso(now);
        const document = await store.insert("municipal_documents", {
          institution_id: institutionId,
          unit_id: unitId,
          title,
          description: clean(body.description || report.conclusion || "Relatorio municipal arquivado apos confirmacao humana."),
          document_type: type,
          status: "active",
          current_version: 1,
          created_by: clean(session.userId),
          created_at: timestamp,
          updated_at: timestamp
        });
        const version = await store.insert("municipal_document_versions", {
          document_id: document.id,
          institution_id: institutionId,
          unit_id: unitId,
          version_number: 1,
          original_filename: clean(body.original_filename || body.originalFilename || `${operationId}.html`),
          mime_type: clean(body.mime_type || body.mimeType || "text/html"),
          size_bytes: Buffer.byteLength(JSON.stringify(report), "utf8"),
          file_reference: `/api/municipal-admin/document-files/reports/${fileHash}.html`,
          file_hash: fileHash,
          uploaded_by: clean(session.userId),
          created_at: timestamp
        });
        await writeAudit(store, session, "report_archived", institutionId, "municipal_report", operationId, { operation_id: operationId, document_id: document.id, version_id: version.id, file_hash: fileHash });
        await writeAudit(store, session, "document_created", institutionId, "municipal_document", document.id, { operation_id: operationId, document_type: type, unit_id: unitId });
        await writeAudit(store, session, "document_version_created", institutionId, "municipal_document", document.id, { operation_id: operationId, version_number: 1, version_id: version.id });
        return { archived: true, report, document: publicDocument(document), version: publicVersion(version), document_id: document.id, version_number: 1, file_hash: fileHash };
      } catch (err) {
        return { archived: false, report, error: clean(err && (err.code || err.message)) || "municipal_report_archive_failed" };
      }
    }
  };
}

export function toMunicipalReportArchiveHttpError(err) {
  return toMunicipalAdminHttpError(err);
}
