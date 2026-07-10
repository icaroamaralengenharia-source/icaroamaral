import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
// Local JSON is a development fallback; production should provide a durable store path/service.
const DEFAULT_DATA_PATH = join(BACKEND_DIR, "data", "elo-core.json");
const MEMORY_CATEGORIES = new Set(["profile", "preference", "project", "decision", "routine", "technical_context", "company", "writing_style", "pending_task"]);
const SENSITIVE_RE = /\b(senha|password|token|api key|chave api|cart[aã]o|cpf|cnpj|banco|pix|segredo|email|e-mail)\b/i;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}
function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value || null)); }
function newId(prefix) { return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
function safeIdentity(identity = {}) {
  const userId = clean(identity.userId || identity.user_id, 140);
  const anonymousId = clean(identity.anonymousId || identity.anonymous_id, 140);
  if (userId) return { userId, anonymousId: anonymousId || "" };
  if (anonymousId) return { userId: "", anonymousId };
  throw Object.assign(new Error("identity_required"), { status: 400 });
}
function matchesIdentity(record, identity) {
  return identity.userId ? record.user_id === identity.userId : record.anonymous_id === identity.anonymousId;
}
function normalizeAttachments(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    id: clean(item && item.id, 120) || newId("att"),
    name: clean(item && item.name, 180),
    type: clean(item && item.type, 120),
    size: Number(item && item.size) || 0,
    reference: clean(item && (item.reference || item.url), 500)
  })).slice(0, 12);
}
function normalizeMemory(input = {}, identity) {
  const value = clean(input.memory_value || input.memoryValue || input.value, 2000);
  if (!value) throw Object.assign(new Error("memory_value_required"), { status: 400 });
  if (SENSITIVE_RE.test(value) || EMAIL_RE.test(value)) throw Object.assign(new Error("sensitive_memory_blocked"), { status: 400 });
  const category = clean(input.category, 80) || "preference";
  return {
    id: clean(input.id, 120) || newId("mem"),
    user_id: identity.userId || null,
    anonymous_id: identity.userId ? null : identity.anonymousId,
    category: MEMORY_CATEGORIES.has(category) ? category : "preference",
    memory_key: clean(input.memory_key || input.memoryKey || input.key, 180) || "geral",
    memory_value: value,
    confidence: Math.max(0, Math.min(1, Number(input.confidence ?? 0.8))),
    source_conversation_id: clean(input.source_conversation_id || input.sourceConversationId, 160) || null,
    created_at: clean(input.created_at || input.createdAt) || now(),
    updated_at: now(),
    is_active: input.is_active !== false && input.isActive !== false
  };
}

export function createEloCoreStore(options = {}) {
  const dataPath = options.dataPath || DEFAULT_DATA_PATH;
  function readDb() {
    if (!existsSync(dataPath)) return { conversations: {}, messages: {}, memories: {} };
    try {
      const parsed = JSON.parse(readFileSync(dataPath, "utf8") || "{}");
      return {
        conversations: parsed.conversations && typeof parsed.conversations === "object" ? parsed.conversations : {},
        messages: parsed.messages && typeof parsed.messages === "object" ? parsed.messages : {},
        memories: parsed.memories && typeof parsed.memories === "object" ? parsed.memories : {}
      };
    } catch (_) {
      return { conversations: {}, messages: {}, memories: {} };
    }
  }
  function writeDb(db) {
    mkdirSync(dirname(dataPath), { recursive: true });
    const tempPath = dataPath + ".tmp-" + process.pid + "-" + Date.now();
    writeFileSync(tempPath, JSON.stringify(db, null, 2), "utf8");
    renameSync(tempPath, dataPath);
  }
  function createConversation(input = {}) {
    const identity = safeIdentity(input);
    const id = clean(input.id, 120) || newId("conv");
    const created = now();
    const conversation = {
      id,
      user_id: identity.userId || null,
      anonymous_id: identity.userId ? null : identity.anonymousId,
      title: clean(input.title, 160) || "Nova conversa",
      created_at: created,
      updated_at: created,
      archived_at: null
    };
    const db = readDb();
    db.conversations[id] = conversation;
    db.messages[id] = [];
    writeDb(db);
    return clone(conversation);
  }
  function listConversations(input = {}) {
    const identity = safeIdentity(input);
    const includeArchived = input.includeArchived === true || input.includeArchived === "true";
    return Object.values(readDb().conversations)
      .filter((item) => matchesIdentity(item, identity))
      .filter((item) => includeArchived || !item.archived_at)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }
  function getConversation(id, input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    const conversation = db.conversations[clean(id, 120)];
    if (!conversation || !matchesIdentity(conversation, identity)) throw Object.assign(new Error("conversation_not_found"), { status: 404 });
    return { conversation: clone(conversation), messages: clone(db.messages[conversation.id] || []) };
  }
  function updateConversation(id, patch = {}, input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    const key = clean(id, 120);
    const conversation = db.conversations[key];
    if (!conversation || !matchesIdentity(conversation, identity)) throw Object.assign(new Error("conversation_not_found"), { status: 404 });
    if (patch.title !== undefined) conversation.title = clean(patch.title, 160) || conversation.title;
    if (patch.archive === true || patch.archived === true) conversation.archived_at = conversation.archived_at || now();
    if (patch.archive === false || patch.archived === false) conversation.archived_at = null;
    conversation.updated_at = now();
    db.conversations[key] = conversation;
    writeDb(db);
    return clone(conversation);
  }
  function addMessage(conversationId, input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    const key = clean(conversationId, 120);
    const conversation = db.conversations[key];
    if (!conversation || !matchesIdentity(conversation, identity)) throw Object.assign(new Error("conversation_not_found"), { status: 404 });
    const role = ["user", "assistant", "system"].includes(input.role) ? input.role : "user";
    const content = clean(input.content, 12000);
    if (!content) throw Object.assign(new Error("message_content_required"), { status: 400 });
    if (SENSITIVE_RE.test(content) && input.allowSensitive !== true) throw Object.assign(new Error("sensitive_message_blocked"), { status: 400 });
    const message = { id: newId("msg"), conversation_id: key, role, content, attachments: normalizeAttachments(input.attachments), created_at: now() };
    db.messages[key] = Array.isArray(db.messages[key]) ? db.messages[key] : [];
    db.messages[key].push(message);
    conversation.updated_at = message.created_at;
    if ((!conversation.title || conversation.title === "Nova conversa") && role === "user") conversation.title = content.slice(0, 60);
    db.conversations[key] = conversation;
    writeDb(db);
    return clone(message);
  }
  function listMemories(input = {}) {
    const identity = safeIdentity(input);
    const includeInactive = input.includeInactive === true || input.includeInactive === "true";
    return Object.values(readDb().memories)
      .filter((item) => matchesIdentity(item, identity))
      .filter((item) => !input.category || item.category === clean(input.category, 80))
      .filter((item) => !input.memory_key && !input.memoryKey && !input.key || item.memory_key === clean(input.memory_key || input.memoryKey || input.key, 180))
      .filter((item) => includeInactive || item.is_active !== false)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map(clone);
  }
  function upsertMemory(input = {}) {
    const identity = safeIdentity(input);
    const next = normalizeMemory(input, identity);
    const db = readDb();
    const existing = Object.values(db.memories).find((item) => matchesIdentity(item, identity) && item.category === next.category && item.memory_key === next.memory_key && item.is_active !== false);
    const id = clean(input.id, 120) || (existing && existing.id) || next.id;
    db.memories[id] = Object.assign({}, existing || {}, next, { id, created_at: existing ? existing.created_at : next.created_at, updated_at: now() });
    writeDb(db);
    return clone(db.memories[id]);
  }
  function updateMemory(id, patch = {}, input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    const key = clean(id, 120);
    const memory = db.memories[key];
    if (!memory || !matchesIdentity(memory, identity)) throw Object.assign(new Error("memory_not_found"), { status: 404 });
    if (patch.memory_value !== undefined || patch.memoryValue !== undefined || patch.value !== undefined) {
      const value = clean(patch.memory_value || patch.memoryValue || patch.value, 2000);
      if (!value) throw Object.assign(new Error("memory_value_required"), { status: 400 });
      if (SENSITIVE_RE.test(value) || EMAIL_RE.test(value)) throw Object.assign(new Error("sensitive_memory_blocked"), { status: 400 });
      memory.memory_value = value;
    }
    if (patch.memory_key !== undefined || patch.memoryKey !== undefined || patch.key !== undefined) memory.memory_key = clean(patch.memory_key || patch.memoryKey || patch.key, 180) || memory.memory_key;
    if (patch.category !== undefined) memory.category = MEMORY_CATEGORIES.has(clean(patch.category, 80)) ? clean(patch.category, 80) : memory.category;
    if (patch.is_active !== undefined || patch.isActive !== undefined) memory.is_active = patch.is_active !== false && patch.isActive !== false;
    memory.updated_at = now();
    db.memories[key] = memory;
    writeDb(db);
    return clone(memory);
  }
  function deleteMemory(id, input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    const key = clean(id, 120);
    const memory = db.memories[key];
    if (!memory || !matchesIdentity(memory, identity)) throw Object.assign(new Error("memory_not_found"), { status: 404 });
    delete db.memories[key];
    writeDb(db);
    return { ok: true, id: key };
  }
  function clearMemories(input = {}) {
    const identity = safeIdentity(input);
    const db = readDb();
    let deleted = 0;
    Object.keys(db.memories).forEach((id) => {
      if (matchesIdentity(db.memories[id], identity)) {
        delete db.memories[id];
        deleted += 1;
      }
    });
    writeDb(db);
    return { ok: true, deleted };
  }
  function mergeAnonymous(anonymousId, userId) {
    const identity = { anonymousId: clean(anonymousId, 140), userId: clean(userId, 140) };
    if (!identity.anonymousId || !identity.userId) throw Object.assign(new Error("merge_identity_required"), { status: 400 });
    const db = readDb();
    Object.values(db.conversations).forEach((item) => { if (item.anonymous_id === identity.anonymousId) { item.user_id = identity.userId; item.anonymous_id = null; item.updated_at = now(); } });
    Object.values(db.memories).forEach((item) => { if (item.anonymous_id === identity.anonymousId) { item.user_id = identity.userId; item.anonymous_id = null; item.updated_at = now(); } });
    writeDb(db);
    return { ok: true };
  }
  return { dataPath, createConversation, listConversations, getConversation, updateConversation, addMessage, listMemories, upsertMemory, updateMemory, deleteMemory, clearMemories, mergeAnonymous };
}

export const defaultEloCoreStore = createEloCoreStore();
