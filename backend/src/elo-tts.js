import { createTtsBudgetRequest, createTtsCostEstimate } from "./elo-tts-budget.js";

const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
const INSTRUCTION_TTS_MODELS = new Set([DEFAULT_TTS_MODEL]);
const DEFAULT_TTS_VOICE = "alloy";
const DEFAULT_TTS_FORMAT = "mp3";
const DEFAULT_MAX_TTS_TEXT_LENGTH = 1200;
const TTS_VOICES = new Set(["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer"]);
const TTS_FORMATS = new Map([
  ["mp3", "audio/mpeg"],
  ["wav", "audio/wav"],
  ["opus", "audio/opus"],
  ["aac", "audio/aac"],
  ["flac", "audio/flac"],
  ["pcm", "audio/L16"]
]);

function cleanTtsText_(value) {
  return String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeTtsVoice_(value) {
  const voice = String(value || "").trim().toLowerCase();
  return TTS_VOICES.has(voice) ? voice : DEFAULT_TTS_VOICE;
}

function sanitizeTtsFormat_(value) {
  const format = String(value || "").trim().toLowerCase();
  return TTS_FORMATS.has(format) ? format : DEFAULT_TTS_FORMAT;
}

function sanitizeTtsInstructions_(value) {
  return String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 1200);
}

function resolveTtsLimit_(env = {}) {
  const limit = Number(env.ELO_TTS_MAX_TEXT_LENGTH || DEFAULT_MAX_TTS_TEXT_LENGTH);
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.round(limit), 4000) : DEFAULT_MAX_TTS_TEXT_LENGTH;
}

function validateTtsPayload_(body = {}, env = {}) {
  const maxLength = resolveTtsLimit_(env);
  const text = cleanTtsText_(body.text);
  if (!text) {
    return { ok: false, status: 400, error: "tts_text_required" };
  }
  if (text.length > maxLength) {
    return { ok: false, status: 413, error: "tts_text_too_long", maxLength };
  }
  return {
    ok: true,
    payload: {
      text,
      voice: sanitizeTtsVoice_(body.voice),
      format: sanitizeTtsFormat_(body.format),
      instructions: sanitizeTtsInstructions_(body.instructions),
      maxLength
    }
  };
}

export async function synthesizeSpeech({ text, voice = DEFAULT_TTS_VOICE, format = DEFAULT_TTS_FORMAT, instructions = "", env = {}, fetchImpl = globalThis.fetch } = {}) {
  const cleanText = cleanTtsText_(text);
  if (!cleanText) {
    const error = new Error("tts_text_required");
    error.status = 400;
    throw error;
  }
  if (!env.OPENAI_API_KEY) {
    const error = new Error("tts_provider_not_configured");
    error.status = 503;
    throw error;
  }
  if (typeof fetchImpl !== "function") {
    const error = new Error("tts_fetch_unavailable");
    error.status = 503;
    throw error;
  }

  const safeFormat = sanitizeTtsFormat_(format);
  const model = env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL;
  const startedAt = Date.now();
  const providerBody = {
    model,
    voice: sanitizeTtsVoice_(voice),
    input: cleanText,
    format: safeFormat
  };
  const safeInstructions = sanitizeTtsInstructions_(instructions);
  if (safeInstructions && INSTRUCTION_TTS_MODELS.has(model)) providerBody.instructions = safeInstructions;
  const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(providerBody)
  });
  const providerMs = Date.now() - startedAt;
  if (!response || !response.ok) {
    const error = new Error("tts_provider_failed");
    error.status = 502;
    error.providerStatus = response && response.status ? response.status : 0;
    throw error;
  }
  const audio = Buffer.from(await response.arrayBuffer());
  if (!audio.length) {
    const error = new Error("tts_empty_audio");
    error.status = 502;
    throw error;
  }
  return {
    audio,
    contentType: TTS_FORMATS.get(safeFormat) || "audio/mpeg",
    format: safeFormat,
    provider: "openai",
    providerMs
  };
}

export function registerEloTtsRoute(app, { env = process.env, fetchImpl = globalThis.fetch, resolveAuthContext, budgetStore } = {}) {
  app.post("/api/elo/tts/estimate", async (request, response) => {
    let authContext;
    try {
      authContext = typeof resolveAuthContext === "function" ? await resolveAuthContext(request) : null;
    } catch (_) { authContext = null; }
    if (!authContext || authContext.ok !== true || !authContext.userId) {
      response.status(Number(authContext && authContext.status) || 401).json({ ok: false, error: "authentication_required" });
      return;
    }
    const estimate = createTtsCostEstimate({ characters: request.body && request.body.characters, env });
    if (!estimate.ok) {
      response.status(estimate.status).json({ ok: false, error: estimate.error });
      return;
    }
    response.json({ ok: true, estimateUsd: estimate.estimateUsd, estimateOnly: true, characters: estimate.characters });
  });

  app.post("/api/elo/tts", async (request, response) => {
    const contentType = String(request.headers["content-type"] || "");
    if (contentType && !/application\/json/i.test(contentType)) {
      response.status(415).json({ ok: false, error: "content_type_not_supported" });
      return;
    }
    const validation = validateTtsPayload_(request.body || {}, env);
    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.error,
        maxLength: validation.maxLength
      });
      return;
    }

    let authContext;
    try {
      authContext = typeof resolveAuthContext === "function"
        ? await resolveAuthContext(request)
        : { ok: false, status: 503, error: "tts_auth_not_configured" };
    } catch (_) {
      authContext = { ok: false, status: 401, error: "invalid_session" };
    }
    if (!authContext || authContext.ok !== true || !authContext.userId) {
      response.status(Number(authContext && authContext.status) || 401).json({ ok: false, error: "authentication_required" });
      return;
    }

    const usage = request.body && request.body.usage === "audiobook" ? "audiobook" : "conversation";
    const budget = createTtsBudgetRequest({
      userId: authContext.userId,
      usage,
      documentId: request.body && request.body.documentId,
      chunkIndex: request.body && request.body.chunkIndex,
      text: validation.payload.text,
      voice: validation.payload.voice,
      format: validation.payload.format,
      instructions: validation.payload.instructions,
      env
    });
    if (!budget.ok) {
      response.status(budget.status).json({ ok: false, error: budget.error });
      return;
    }
    if (!budgetStore || typeof budgetStore.reserve !== "function" || typeof budgetStore.settle !== "function") {
      response.status(503).json({ ok: false, error: "tts_budget_store_unavailable" });
      return;
    }

    let reservation;
    try {
      reservation = await budgetStore.reserve(budget.request);
    } catch (_) {
      response.status(503).json({ ok: false, error: "tts_budget_unavailable" });
      return;
    }
    if (!reservation || reservation.reserved !== true) {
      const duplicate = reservation && reservation.reason === "duplicate";
      response.status(duplicate ? 409 : 429).json({
        ok: false,
        error: duplicate ? "tts_chunk_already_requested" : "tts_budget_exceeded",
        estimateUsd: budget.request.estimateUsd,
        estimateOnly: true
      });
      return;
    }

    try {
      const result = await synthesizeSpeech({
        text: validation.payload.text,
        voice: validation.payload.voice,
        format: validation.payload.format,
        instructions: validation.payload.instructions,
        env,
        fetchImpl
      });
      // If settlement is temporarily unavailable, keep the reservation held.
      // Returning the audio preserves playback; the held amount fails closed
      // against duplicate generation until an operator reconciles the row.
      try { await budgetStore.settle(budget.request, "completed"); } catch (_) {}
      response.set({
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-Elo-Tts-Provider": result.provider,
        "X-Elo-Tts-Voice": validation.payload.voice,
        "X-Elo-Tts-Format": result.format,
        "X-Elo-Tts-Provider-Ms": String(result.providerMs),
        "X-Elo-Tts-Estimate-Usd": String(budget.request.estimateUsd),
        "X-Elo-Tts-Estimate-Only": "true"
      });
      response.send(result.audio);
    } catch (error) {
      // A network timeout may have reached the provider. Keep its reservation
      // in that ambiguous case to prevent an automatic paid retry.
      if (Number(error && error.providerStatus) > 0) {
        try { await budgetStore.settle(budget.request, "failed"); } catch (_) {}
      }
      const status = Number(error && error.status) || 502;
      response.status(status).json({ ok: false, error: String(error && error.message || "tts_failed") });
    }
  });
}

export { validateTtsPayload_ };
