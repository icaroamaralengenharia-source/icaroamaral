import { createClient } from "@supabase/supabase-js";

const TABLES = new Set(["elo_conversations", "elo_messages", "elo_memories"]);
const MEMORY_CATEGORIES = new Set(["profile", "preference", "project", "decision", "routine", "technical_context", "company", "writing_style", "pending_task"]);
const SENSITIVE_RE = /\b(senha|password|token|api key|chave api|cart[aã]o|cpf|cnpj|banco|pix|segredo|email|e-mail)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function now() {
  return new Date().toISOString();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || null));
}

function safeError(code, status = 500) {
  return Object.assign(new Error(code), { status });
}

function normalizeBearerJwt(input = {}) {
  const raw = clean(input.jwt || input.token || input.accessToken || input.access_token || input.authorization || input.Authorization, 4096);
  const token = raw.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw safeError("jwt_required", 401);
  return token;
}

function normalizeUserId(input = {}) {
  const userId = clean(input.userId || input.user_id || input.owner_user_id, 140);
  if (!userId) throw safeError("user_id_required", 400);
  return userId;
}

function assertTable(table) {
  if (!TABLES.has(table)) throw safeError("unsupported_table", 500);
}

function rethrowSupabaseError(error, fallbackCode = "supabase_request_failed") {
  if (!error) return;
  const message = clean(error.code || error.message || fallbackCode, 160);
  const status = Number(error.status || error.statusCode) || 502;
  throw safeError(message || fallbackCode, status);
}

function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: clean(item && item.id, 120),
    name: clean(item && item.name, 180),
    type: clean(item && item.type, 120),
    size: Number(item && item.size) || 0,
    reference: clean(item && (item.reference || item.url), 500)
  })).slice(0, 12);
}

function normalizeConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.owner_user_id,
    owner_user_id: row.owner_user_id,
    anonymous_id: row.anonymous_id || null,
    institution_id: row.institution_id || null,
    company_id: row.company_id || null,
    project_id: row.project_id || null,
    title: row.title,
    summary: row.summary || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    archived_at: row.archived_at || null
  };
}

function normalizeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    user_id: row.owner_user_id,
    owner_user_id: row.owner_user_id,
    anonymous_id: row.anonymous_id || null,
    institution_id: row.institution_id || null,
    company_id: row.company_id || null,
    project_id: row.project_id || null,
    role: row.role,
    content: row.content,
    attachments: Array.isArray(row.attachments) ? row.attachments : [],
    created_at: row.created_at
  };
}

function normalizeMemory(row) {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.owner_user_id,
    owner_user_id: row.owner_user_id,
    anonymous_id: row.anonymous_id || null,
    institution_id: row.institution_id || null,
    company_id: row.company_id || null,
    project_id: row.project_id || null,
    source_conversation_id: row.conversation_id || null,
    conversation_id: row.conversation_id || null,
    category: row.category,
    memory_key: row.memory_key,
    memory_value: row.memory_value,
    confidence: row.confidence,
    is_active: row.is_active !== false,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function normalizeMemoryInput(input = {}, ownerUserId) {
  const value = clean(input.memory_value || input.memoryValue || input.value, 2000);
  if (!value) throw safeError("memory_value_required", 400);
  if (SENSITIVE_RE.test(value) || EMAIL_RE.test(value)) throw safeError("sensitive_memory_blocked", 400);
  const category = clean(input.category, 80) || "preference";
  return {
    owner_user_id: ownerUserId,
    anonymous_id: null,
    institution_id: input.institution_id || input.institutionId || null,
    company_id: input.company_id || input.companyId || null,
    project_id: input.project_id || input.projectId || null,
    conversation_id: clean(input.conversation_id || input.conversationId || input.source_conversation_id || input.sourceConversationId, 160) || null,
    category: MEMORY_CATEGORIES.has(category) ? category : "preference",
    memory_key: clean(input.memory_key || input.memoryKey || input.key, 180) || "geral",
    memory_value: value,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8))),
    is_active: input.is_active !== false && input.isActive !== false,
    updated_at: now()
  };
}

export function createEloCoreSupabaseStore(options = {}) {
  const env = options.env || process.env;
  const supabaseUrl = clean(options.supabaseUrl || env.SUPABASE_URL, 500);
  const supabaseAnonKey = clean(options.supabaseAnonKey || env.SUPABASE_ANON_KEY, 2000);
  const createClientFn = options.createClient || createClient;

  if (!supabaseUrl) throw safeError("supabase_url_required", 500);
  if (!supabaseAnonKey) throw safeError("supabase_anon_key_required", 500);

  function clientFor(input = {}) {
    const jwt = normalizeBearerJwt(input);
    return createClientFn(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
  }

  async function createConversation(input = {}) {
    const ownerUserId = normalizeUserId(input);
    const client = clientFor(input);
    const payload = {
      owner_user_id: ownerUserId,
      anonymous_id: null,
      institution_id: input.institution_id || input.institutionId || null,
      company_id: input.company_id || input.companyId || null,
      project_id: input.project_id || input.projectId || null,
      title: clean(input.title, 160) || "Nova conversa",
      summary: clean(input.summary, 1000) || null
    };
    assertTable("elo_conversations");
    const result = await client.from("elo_conversations").insert(payload).select("*").single();
    rethrowSupabaseError(result.error);
    return clone(normalizeConversation(result.data));
  }

  async function listConversations(input = {}) {
    const client = clientFor(input);
    const includeArchived = input.includeArchived === true || input.includeArchived === "true";
    let query = client.from("elo_conversations").select("*").order("updated_at", { ascending: false });
    if (!includeArchived) query = query.is("archived_at", null);
    const result = await query;
    rethrowSupabaseError(result.error);
    return (result.data || []).map((item) => clone(normalizeConversation(item)));
  }

  async function getConversation(id, input = {}) {
    const client = clientFor(input);
    const cleanId = clean(id, 140);
    const conversationResult = await client.from("elo_conversations").select("*").eq("id", cleanId).maybeSingle();
    rethrowSupabaseError(conversationResult.error);
    if (!conversationResult.data) throw safeError("conversation_not_found", 404);
    const messagesResult = await client.from("elo_messages").select("*").eq("conversation_id", cleanId).order("created_at", { ascending: true });
    rethrowSupabaseError(messagesResult.error);
    return {
      conversation: clone(normalizeConversation(conversationResult.data)),
      messages: (messagesResult.data || []).map((item) => clone(normalizeMessage(item)))
    };
  }

  async function updateConversation(id, patch = {}, input = {}) {
    const client = clientFor(input);
    const payload = { updated_at: now() };
    if (patch.title !== undefined) payload.title = clean(patch.title, 160);
    if (patch.summary !== undefined) payload.summary = clean(patch.summary, 1000) || null;
    if (patch.archive === true || patch.archived === true) payload.archived_at = now();
    if (patch.archive === false || patch.archived === false) payload.archived_at = null;
    const result = await client.from("elo_conversations").update(payload).eq("id", clean(id, 140)).select("*").maybeSingle();
    rethrowSupabaseError(result.error);
    if (!result.data) throw safeError("conversation_not_found", 404);
    return clone(normalizeConversation(result.data));
  }

  async function addMessage(conversationId, input = {}) {
    const ownerUserId = normalizeUserId(input);
    const client = clientFor(input);
    const role = ["user", "assistant", "system"].includes(input.role) ? input.role : "user";
    const content = clean(input.content, 12000);
    if (!content) throw safeError("message_content_required", 400);
    if (SENSITIVE_RE.test(content) && input.allowSensitive !== true) throw safeError("sensitive_message_blocked", 400);
    const payload = {
      conversation_id: clean(conversationId, 140),
      owner_user_id: ownerUserId,
      anonymous_id: null,
      institution_id: input.institution_id || input.institutionId || null,
      company_id: input.company_id || input.companyId || null,
      project_id: input.project_id || input.projectId || null,
      role,
      content,
      attachments: normalizeAttachments(input.attachments)
    };
    const result = await client.from("elo_messages").insert(payload).select("*").single();
    rethrowSupabaseError(result.error);
    await client.from("elo_conversations").update({ updated_at: now() }).eq("id", payload.conversation_id);
    return clone(normalizeMessage(result.data));
  }

  async function listMemories(input = {}) {
    const client = clientFor(input);
    const includeInactive = input.includeInactive === true || input.includeInactive === "true";
    let query = client.from("elo_memories").select("*").order("updated_at", { ascending: false });
    if (!includeInactive) query = query.eq("is_active", true);
    if (input.category) query = query.eq("category", clean(input.category, 80));
    if (input.memory_key || input.memoryKey || input.key) query = query.eq("memory_key", clean(input.memory_key || input.memoryKey || input.key, 180));
    const result = await query;
    rethrowSupabaseError(result.error);
    return (result.data || []).map((item) => clone(normalizeMemory(item)));
  }

  async function upsertMemory(input = {}) {
    const ownerUserId = normalizeUserId(input);
    const client = clientFor(input);
    const next = normalizeMemoryInput(input, ownerUserId);
    if (next.category === "project" && next.is_active !== false) {
      const deactivate = await client.from("elo_memories").update({ is_active: false, updated_at: now() }).eq("category", "project").eq("is_active", true);
      rethrowSupabaseError(deactivate.error);
    }
    const existing = await client.from("elo_memories").select("*").eq("category", next.category).eq("memory_key", next.memory_key).eq("is_active", true).maybeSingle();
    rethrowSupabaseError(existing.error);
    const result = existing.data
      ? await client.from("elo_memories").update(next).eq("id", existing.data.id).select("*").single()
      : await client.from("elo_memories").insert(next).select("*").single();
    rethrowSupabaseError(result.error);
    return clone(normalizeMemory(result.data));
  }

  async function updateMemory(id, patch = {}, input = {}) {
    const client = clientFor(input);
    const payload = { updated_at: now() };
    if (patch.memory_value !== undefined || patch.memoryValue !== undefined || patch.value !== undefined) {
      const value = clean(patch.memory_value || patch.memoryValue || patch.value, 2000);
      if (!value) throw safeError("memory_value_required", 400);
      if (SENSITIVE_RE.test(value) || EMAIL_RE.test(value)) throw safeError("sensitive_memory_blocked", 400);
      payload.memory_value = value;
    }
    if (patch.memory_key !== undefined || patch.memoryKey !== undefined || patch.key !== undefined) payload.memory_key = clean(patch.memory_key || patch.memoryKey || patch.key, 180);
    if (patch.category !== undefined) {
      const category = clean(patch.category, 80);
      payload.category = MEMORY_CATEGORIES.has(category) ? category : "preference";
    }
    if (patch.is_active !== undefined || patch.isActive !== undefined) payload.is_active = patch.is_active !== false && patch.isActive !== false;
    const result = await client.from("elo_memories").update(payload).eq("id", clean(id, 140)).select("*").maybeSingle();
    rethrowSupabaseError(result.error);
    if (!result.data) throw safeError("memory_not_found", 404);
    return clone(normalizeMemory(result.data));
  }

  async function deleteMemory(id, input = {}) {
    const client = clientFor(input);
    const result = await client.from("elo_memories").delete().eq("id", clean(id, 140)).select("id").maybeSingle();
    rethrowSupabaseError(result.error);
    if (!result.data) throw safeError("memory_not_found", 404);
    return { ok: true, id: result.data.id };
  }

  async function clearMemories(input = {}) {
    const client = clientFor(input);
    const result = await client.from("elo_memories").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    rethrowSupabaseError(result.error);
    return { ok: true, deleted: (result.data || []).length };
  }

  async function mergeAnonymous() {
    throw safeError("anonymous_merge_not_supported_by_supabase_store", 400);
  }

  return {
    createConversation,
    listConversations,
    getConversation,
    updateConversation,
    addMessage,
    listMemories,
    upsertMemory,
    updateMemory,
    deleteMemory,
    clearMemories,
    mergeAnonymous
  };
}
