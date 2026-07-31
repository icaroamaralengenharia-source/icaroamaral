import { createSupabaseMunicipalAdminStore, municipalAdminInternals, toMunicipalAdminHttpError } from "./municipal-admin-service.js";

const DOCUMENT_TYPES = new Set(["inventario", "inspecao", "conferencia", "prestacao_contas", "nota", "termo", "relatorio", "outro"]);
const WRITE_ROLES = new Set(["platform_admin", "municipal_admin", "gestor"]);
const READ_ROLES = new Set(["platform_admin", "municipal_admin", "gestor", "almoxarife", "funcionario", "leitura"]);
const ACTIVE = new Set(["active", "ativo"]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function nowIso(now = () => new Date()) {
  const value = now();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function error(status, code) {
  const err = new Error(code);
  err.status = status;
  err.code = code;
  return err;
}

function isActive(value) {
  return ACTIVE.has(lower(value || "active"));
}

function publicDocument(document) {
  if (!document) return null;
  const copy = Object.assign({}, document);
  delete copy.storage_path;
  delete copy.storagePath;
  return copy;
}

function publicVersion(version) {
  if (!version) return null;
  const copy = Object.assign({}, version);
  delete copy.storage_path;
  delete copy.storagePath;
  return copy;
}

function assertReadable(session) {
  if (!READ_ROLES.has(session.role)) throw error(403, "document_access_forbidden");
}

function assertWritable(session) {
  if (!WRITE_ROLES.has(session.role)) throw error(403, "document_write_forbidden");
}

function validDocumentType(value) {
  const type = lower(value || "outro");
  if (!DOCUMENT_TYPES.has(type)) throw error(400, "document_type_invalid");
  return type;
}

function validStatus(value) {
  const status = lower(value || "active");
  if (!["active", "archived"].includes(status)) throw error(400, "document_status_invalid");
  return status;
}

function assertSafeFileReference(value) {
  const reference = clean(value);
  if (!reference) throw error(400, "file_reference_required");
  if (/^https?:\/\//i.test(reference)) {
    try {
      const parsed = new URL(reference);
      if (!["http:", "https:"].includes(parsed.protocol)) throw error(400, "file_reference_unsafe");
      return reference;
    } catch {
      throw error(400, "file_reference_unsafe");
    }
  }
  if (reference.startsWith("/api/municipal-admin/document-files/")) return reference;
  throw error(400, "file_reference_unsafe");
}

async function assertInstitutionExists(store, institutionId) {
  const id = clean(institutionId);
  if (!id) throw error(400, "institution_id_required");
  const institution = await store.get("institutions", id);
  if (!institution || !isActive(institution.status)) throw error(404, "institution_not_found");
  return id;
}

async function resolveInstitution(store, session, requestedInstitutionId) {
  if (session.role === "platform_admin") return await assertInstitutionExists(store, requestedInstitutionId);
  const id = clean(session.institutionId);
  if (!id) throw error(403, "institution_scope_forbidden");
  if (requestedInstitutionId && clean(requestedInstitutionId) !== id) throw error(403, "institution_scope_forbidden");
  return await assertInstitutionExists(store, id);
}

async function assertUnitScope(store, session, institutionId, requestedUnitId, options = {}) {
  let unitId = clean(requestedUnitId);
  if (!unitId && session.role === "gestor" && options.defaultGestorUnit !== false) unitId = clean(session.unitId);
  if (!unitId) return null;
  const unit = await store.get("units", unitId);
  if (!unit || clean(unit.institution_id) !== clean(institutionId) || !isActive(unit.status)) throw error(403, "unit_scope_forbidden");
  if (session.role === "gestor" && clean(session.unitId) !== unitId) throw error(403, "unit_scope_forbidden");
  return unitId;
}

function assertDocumentScope(session, document) {
  if (!document) throw error(404, "document_not_found");
  if (session.role !== "platform_admin" && clean(document.institution_id) !== clean(session.institutionId)) throw error(403, "institution_scope_forbidden");
  if (session.role === "gestor" && clean(document.unit_id) && clean(document.unit_id) !== clean(session.unitId)) throw error(403, "unit_scope_forbidden");
  return document;
}

async function writeAudit(store, session, action, document, metadata = {}) {
  await store.insert("municipal_admin_audit_log", {
    actor_user_id: clean(session.userId),
    institution_id: clean(document.institution_id),
    target_type: "municipal_document",
    target_id: clean(document.id),
    action,
    metadata: municipalAdminInternals.sanitizeMetadata(metadata) || {},
    created_at: nowIso()
  });
}

function cleanDocumentPayload(body = {}) {
  const title = clean(body.title);
  if (!title) throw error(400, "document_title_required");
  return {
    title,
    description: clean(body.description),
    document_type: validDocumentType(body.document_type || body.documentType),
    status: validStatus(body.status)
  };
}

function cleanVersionPayload(body = {}) {
  return {
    original_filename: clean(body.original_filename || body.originalFilename),
    mime_type: clean(body.mime_type || body.mimeType),
    size_bytes: Number.isFinite(Number(body.size_bytes ?? body.sizeBytes)) ? Math.max(0, Math.floor(Number(body.size_bytes ?? body.sizeBytes))) : 0,
    file_reference: assertSafeFileReference(body.file_reference || body.fileReference),
    file_hash: clean(body.file_hash || body.fileHash)
  };
}

export function createMunicipalDocumentService(options = {}) {
  const store = options.store || createSupabaseMunicipalAdminStore(options.database);
  const getNow = options.now || (() => new Date());

  return {
    async createDocument(context, body) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWritable(session);
      const institutionId = await resolveInstitution(store, session, body && (body.institution_id || body.institutionId));
      const unitId = await assertUnitScope(store, session, institutionId, body && (body.unit_id || body.unitId));
      const payload = Object.assign(cleanDocumentPayload(body), {
        institution_id: institutionId,
        unit_id: unitId,
        current_version: 0,
        created_by: clean(session.userId),
        created_at: nowIso(getNow),
        updated_at: nowIso(getNow)
      });
      const document = await store.insert("municipal_documents", payload);
      await writeAudit(store, session, "document_created", document, { document_type: document.document_type, unit_id: unitId });
      return { document: publicDocument(document) };
    },

    async listDocuments(context, query = {}) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertReadable(session);
      const institutionId = session.role === "platform_admin"
        ? clean(query.institution_id || query.institutionId)
        : clean(session.institutionId);
      if (session.role === "platform_admin" && !institutionId) throw error(400, "institution_id_required");
      await assertInstitutionExists(store, institutionId);
      let documents = await store.list("municipal_documents", { institution_id: institutionId });
      if (session.role === "gestor" && clean(session.unitId)) documents = documents.filter((item) => !clean(item.unit_id) || clean(item.unit_id) === clean(session.unitId));
      const unitFilter = clean(query.unit_id || query.unitId);
      if (unitFilter) {
        await assertUnitScope(store, session, institutionId, unitFilter, { defaultGestorUnit: false });
        documents = documents.filter((item) => clean(item.unit_id) === unitFilter);
      }
      return { documents: documents.map(publicDocument) };
    },

    async getDocument(context, documentId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertReadable(session);
      const document = assertDocumentScope(session, await store.get("municipal_documents", documentId));
      const versions = await store.list("municipal_document_versions", { document_id: clean(document.id) });
      return { document: publicDocument(document), versions: versions.map(publicVersion) };
    },

    async createVersion(context, documentId, body) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWritable(session);
      const document = assertDocumentScope(session, await store.get("municipal_documents", documentId));
      if (lower(document.status) === "archived") throw error(409, "document_archived");
      await assertUnitScope(store, session, document.institution_id, document.unit_id, { defaultGestorUnit: false });
      const nextVersion = Number(document.current_version || 0) + 1;
      const version = await store.insert("municipal_document_versions", Object.assign(cleanVersionPayload(body), {
        document_id: document.id,
        institution_id: document.institution_id,
        unit_id: document.unit_id || null,
        version_number: nextVersion,
        uploaded_by: clean(session.userId),
        created_at: nowIso(getNow)
      }));
      const updated = await store.update("municipal_documents", document.id, { current_version: nextVersion, updated_at: nowIso(getNow) });
      await writeAudit(store, session, "document_version_created", updated || document, { version_number: nextVersion, version_id: version.id });
      return { document: publicDocument(updated || document), version: publicVersion(version) };
    },

    async downloadDocument(context, documentId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertReadable(session);
      const document = assertDocumentScope(session, await store.get("municipal_documents", documentId));
      const versions = await store.list("municipal_document_versions", { document_id: document.id });
      const version = versions.sort((a, b) => Number(b.version_number || 0) - Number(a.version_number || 0))[0];
      if (!version) throw error(404, "document_version_not_found");
      await writeAudit(store, session, "document_downloaded", document, { version_number: version.version_number });
      return {
        download: {
          document_id: document.id,
          version_id: version.id,
          version_number: version.version_number,
          file_reference: assertSafeFileReference(version.file_reference),
          original_filename: clean(version.original_filename),
          mime_type: clean(version.mime_type),
          size_bytes: Number(version.size_bytes || 0),
          file_hash: clean(version.file_hash)
        }
      };
    },

    async archiveDocument(context, documentId) {
      const session = municipalAdminInternals.sessionFromContext(context);
      assertWritable(session);
      const document = assertDocumentScope(session, await store.get("municipal_documents", documentId));
      await assertUnitScope(store, session, document.institution_id, document.unit_id, { defaultGestorUnit: false });
      if (lower(document.status) === "archived") throw error(409, "document_already_archived");
      const archived = await store.update("municipal_documents", document.id, { status: "archived", updated_at: nowIso(getNow) });
      await writeAudit(store, session, "document_archived", archived || document);
      return { document: publicDocument(archived || document) };
    }
  };
}

export { createSupabaseMunicipalAdminStore as createSupabaseMunicipalDocumentStore, toMunicipalAdminHttpError as toMunicipalDocumentHttpError };
