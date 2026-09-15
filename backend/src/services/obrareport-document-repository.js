import { randomUUID } from "node:crypto";

const TABLE = "obrareport_generated_documents";
const WORKS_TABLE = "obrareport_projects";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function objectOf(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function contextOf(context = {}) {
  const safe = objectOf(context);
  const profile = objectOf(safe.profile);
  return {
    institutionId: clean(profile.institution_id || profile.institutionId || safe.institutionId || safe.institution_id),
    userId: clean(safe.userId || safe.user_id || profile.auth_user_id || profile.user_id || profile.id)
  };
}

function requireInstitution(context) {
  const ctx = contextOf(context);
  if (!ctx.institutionId) throw Object.assign(new Error("institution_required"), { status: 400 });
  return ctx;
}

function databaseError(code, cause) {
  return Object.assign(new Error(code), { status: 503, cause });
}

function notFound() {
  return Object.assign(new Error("document_not_found"), { status: 404 });
}

function normalize(row) {
  if (!row) return null;
  return {
    id: clean(row.id),
    institution_id: clean(row.institution_id),
    work_id: clean(row.work_id) || null,
    rdo_id: clean(row.rdo_id) || null,
    source_type: clean(row.source_type),
    source_id: clean(row.source_id),
    document_type: clean(row.document_type),
    title: clean(row.title || row.document_type),
    provider: clean(row.provider),
    external_file_id: clean(row.external_file_id || row.file_id),
    artifact_url: clean(row.artifact_url || row.file_url),
    idempotency_key: clean(row.idempotency_key) || null,
    status: clean(row.status),
    hash: clean(row.hash),
    metadata_json: objectOf(row.metadata_json),
    generated_by: clean(row.generated_by),
    created_at: row.created_at || row.generated_at || null,
    updated_at: row.updated_at || row.generated_at || null,
    generated_at: row.generated_at || row.created_at || null
  };
}

function rowFromInput(context, input = {}) {
  const ctx = requireInstitution(context);
  const safe = objectOf(input);
  const sourceType = clean(safe.sourceType || safe.source_type);
  const sourceId = clean(safe.sourceId || safe.source_id);
  const idempotencyKey = clean(safe.idempotencyKey || safe.idempotency_key);
  if (!sourceType || !sourceId) throw Object.assign(new Error("document_source_required"), { status: 400 });
  if (!idempotencyKey) throw Object.assign(new Error("document_idempotency_key_required"), { status: 400 });
  const now = new Date().toISOString();
  const metadata = Object.assign({}, objectOf(safe.metadata), { sourceType });
  const sourceTypeForDatabase = sourceType === "rdo" ? "rdo" : "technical_report";
  return {
    id: clean(safe.id) || `obr_doc_${randomUUID()}`,
    institution_id: ctx.institutionId,
    work_id: clean(safe.workId || safe.work_id) || null,
    rdo_id: clean(safe.rdoId || safe.rdo_id) || null,
    source_type: sourceTypeForDatabase,
    source_id: sourceId,
    document_type: clean(safe.documentType || safe.document_type) || "technical_report_pdf",
    status: clean(safe.status) || "generated",
    file_id: clean(safe.externalFileId || safe.external_file_id) || null,
    file_url: clean(safe.artifactUrl || safe.artifact_url) || null,
    hash: clean(safe.hash) || null,
    metadata_json: metadata,
    generated_by: ctx.userId || null,
    generated_at: safe.generatedAt || now,
    created_at: safe.createdAt || now,
    updated_at: safe.updatedAt || now,
    title: clean(safe.title || safe.documentType || safe.document_type) || "Relatório técnico",
    provider: clean(safe.provider) || "google_drive_apps_script",
    external_file_id: clean(safe.externalFileId || safe.external_file_id) || null,
    artifact_url: clean(safe.artifactUrl || safe.artifact_url) || null,
    idempotency_key: idempotencyKey
  };
}

export function createSupabaseObraReportDocumentRepository({ client } = {}) {
  if (!client || typeof client.from !== "function") throw new Error("document_supabase_store_not_configured");

  async function findById(context, id) {
    const ctx = requireInstitution(context);
    const result = await client.from(TABLE).select("*").eq("id", clean(id)).eq("institution_id", ctx.institutionId).maybeSingle();
    if (result.error) throw databaseError("document_read_failed", result.error);
    return normalize(result.data);
  }

  async function findByIdempotencyKey(context, key) {
    const ctx = requireInstitution(context);
    const idempotencyKey = clean(key);
    if (!idempotencyKey) return null;
    const result = await client.from(TABLE).select("*").eq("institution_id", ctx.institutionId).eq("idempotency_key", idempotencyKey).maybeSingle();
    if (result.error) throw databaseError("document_idempotency_read_failed", result.error);
    return normalize(result.data);
  }

  return {
    mode: "supabase",
    async findById(context, id) {
      return findById(context, id);
    },
    async findByIdempotencyKey(context, key) {
      return findByIdempotencyKey(context, key);
    },
    async insert(context, input) {
      const ctx = requireInstitution(context);
      const row = rowFromInput(ctx, input);
      const result = await client.from(TABLE).insert(row).select("*").single();
      if (result.error) {
        const raced = await findByIdempotencyKey(ctx, row.idempotency_key);
        if (raced) return { document: raced, duplicate: true };
        throw databaseError("document_persistence_failed", result.error);
      }
      return { document: normalize(result.data), duplicate: false };
    },
    async list(context, filters = {}) {
      const ctx = requireInstitution(context);
      const safe = objectOf(filters);
      let query = client.from(TABLE).select("*").eq("institution_id", ctx.institutionId);
      const workId = clean(safe.workId || safe.work_id);
      const rdoId = clean(safe.rdoId || safe.rdo_id);
      const sourceType = clean(safe.sourceType || safe.source_type);
      if (workId) query = query.eq("work_id", workId);
      if (rdoId) query = query.eq("rdo_id", rdoId);
      if (sourceType) query = query.eq("source_type", sourceType === "rdo" ? "rdo" : "technical_report");
      const result = await query.order("updated_at", { ascending: false });
      if (result.error) throw databaseError("document_list_failed", result.error);
      return (Array.isArray(result.data) ? result.data : []).map(normalize);
    },
    async getById(context, id) {
      const document = await findById(context, id);
      if (!document) throw notFound();
      return document;
    },
    async validateWork(context, workId) {
      const ctx = requireInstitution(context);
      const id = clean(workId);
      if (!id) return null;
      const result = await client.from(WORKS_TABLE).select("*").eq("id", id).eq("institution_id", ctx.institutionId).maybeSingle();
      if (result.error) throw databaseError("work_read_failed", result.error);
      if (!result.data) throw Object.assign(new Error("work_not_found"), { status: 404 });
      return result.data;
    }
  };
}
