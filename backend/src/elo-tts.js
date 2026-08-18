const DEFAULT_TTS_MODEL = "gpt-4o-mini-tts";
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
      maxLength
    }
  };
}

export async function synthesizeSpeech({ text, voice = DEFAULT_TTS_VOICE, format = DEFAULT_TTS_FORMAT, env = {}, fetchImpl = globalThis.fetch } = {}) {
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
  const startedAt = Date.now();
  const response = await fetchImpl("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_TTS_MODEL || DEFAULT_TTS_MODEL,
      voice: sanitizeTtsVoice_(voice),
      input: cleanText,
      format: safeFormat
    })
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

export function registerEloTtsRoute(app, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
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
    try {
      const result = await synthesizeSpeech({
        text: validation.payload.text,
        voice: validation.payload.voice,
        format: validation.payload.format,
        env,
        fetchImpl
      });
      response.set({
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
        "X-Elo-Tts-Provider": result.provider,
        "X-Elo-Tts-Voice": validation.payload.voice,
        "X-Elo-Tts-Format": result.format,
        "X-Elo-Tts-Provider-Ms": String(result.providerMs)
      });
      response.send(result.audio);
    } catch (error) {
      const status = Number(error && error.status) || 502;
      response.status(status).json({ ok: false, error: String(error && error.message || "tts_failed") });
    }
  });
}

export { validateTtsPayload_ };
