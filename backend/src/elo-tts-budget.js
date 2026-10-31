import { createHash } from "node:crypto";

const USAGE = new Set(["conversation", "audiobook"]);

function positiveMoney_(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 1_000_000) / 1_000_000 : null;
}

function clean_(value, max = 160) {
  return String(value ?? "").trim().slice(0, max);
}

export function createTtsCostEstimate({ characters, env = {} } = {}) {
  const count = Number(characters);
  if (!Number.isSafeInteger(count) || count <= 0 || count > 10_000_000) {
    return { ok: false, status: 400, error: "tts_estimate_character_count_invalid" };
  }
  const perThousandChars = positiveMoney_(env.ELO_TTS_ESTIMATED_USD_PER_1000_CHARS);
  if (!perThousandChars) return { ok: false, status: 503, error: "tts_budget_not_configured" };
  const estimateUsd = Math.max(0.000001, Math.ceil(count * perThousandChars / 1000 * 1_000_000) / 1_000_000);
  return { ok: true, estimateUsd, estimateOnly: true, characters: count };
}

export function createTtsBudgetRequest({ userId, usage, documentId, chunkIndex, text, voice, format, instructions, env = {} } = {}) {
  const safeUserId = clean_(userId, 128);
  const safeUsage = clean_(usage, 32);
  const safeDocumentId = clean_(documentId, 128);
  const safeText = String(text ?? "");
  if (!safeUserId || !USAGE.has(safeUsage) || !safeText) {
    return { ok: false, status: 400, error: "tts_budget_request_invalid" };
  }
  if (safeUsage === "audiobook" && (!/^[\w.:-]{1,128}$/.test(safeDocumentId) || !Number.isSafeInteger(chunkIndex) || chunkIndex < 0)) {
    return { ok: false, status: 400, error: "tts_audiobook_identity_required" };
  }

  const userLimitUsd = positiveMoney_(env.ELO_TTS_USER_LIMIT_USD);
  // Conversation depends only on the shared user limit.
  const documentLimitUsd = safeUsage === "audiobook" ? positiveMoney_(env.ELO_TTS_DOCUMENT_LIMIT_USD) : null;
  const estimate = createTtsCostEstimate({ characters: safeText.length, env });
  if (!estimate.ok || !userLimitUsd || (safeUsage === "audiobook" && !documentLimitUsd)) {
    return { ok: false, status: 503, error: "tts_budget_not_configured" };
  }

  const estimateUsd = estimate.estimateUsd;
  const textHash = createHash("sha256").update(safeText, "utf8").digest("hex");
  const requestKey = safeUsage === "audiobook"
    ? createHash("sha256").update([safeUserId, safeDocumentId, chunkIndex, textHash].join("\n")).digest("hex")
    // v34 sends no stable conversation request ID. Deduplicate the canonical
    // synthesis payload; a repeated payload never triggers another paid call.
    : createHash("sha256").update(JSON.stringify([
      safeUserId, "conversation", textHash, env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts",
      voice || "alloy", format || "mp3", instructions || ""
    ])).digest("hex");

  return {
    ok: true,
    request: {
      userId: safeUserId,
      usage: safeUsage,
      documentId: safeUsage === "audiobook" ? safeDocumentId : null,
      requestKey,
      estimateUsd,
      userLimitUsd,
      documentLimitUsd
    }
  };
}

export function createSupabaseTtsBudgetStore(supabase) {
  if (!supabase || typeof supabase.rpc !== "function") return null;
  return {
    async reserve(request) {
      if (!supabase || typeof supabase.rpc !== "function") throw new Error("tts_budget_store_unavailable");
      const { data, error } = await supabase.rpc("elo_tts_reserve", {
        p_user_id: request.userId,
        p_usage: request.usage,
        p_document_id: request.documentId,
        p_request_key: request.requestKey,
        p_estimate_usd: request.estimateUsd,
        p_user_limit_usd: request.userLimitUsd,
        p_document_limit_usd: request.documentLimitUsd
      });
      if (error) throw new Error("tts_budget_reservation_failed");
      return data;
    },
    async settle(request, outcome) {
      if (!supabase || typeof supabase.rpc !== "function") throw new Error("tts_budget_store_unavailable");
      const { error } = await supabase.rpc("elo_tts_settle", {
        p_user_id: request.userId,
        p_request_key: request.requestKey,
        p_outcome: outcome
      });
      if (error) throw new Error("tts_budget_settlement_failed");
    }
  };
}
