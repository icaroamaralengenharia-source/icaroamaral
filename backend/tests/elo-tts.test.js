import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { synthesizeSpeech, validateTtsPayload_ } from "../src/elo-tts.js";

async function listenTestApp_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, baseUrl: "http://127.0.0.1:" + server.address().port };
}

async function closeTestServer_(server) {
  await new Promise((resolve) => server.close(resolve));
}

test("ELO TTS valida payload sem aceitar texto vazio ou exagerado", () => {
  assert.equal(validateTtsPayload_({ text: "   " }).error, "tts_text_required");
  assert.equal(validateTtsPayload_({ text: "x".repeat(20) }, { ELO_TTS_MAX_TEXT_LENGTH: "10" }).error, "tts_text_too_long");
  const valid = validateTtsPayload_({ text: "Olá, número 42.", voice: "nova", format: "mp3" });
  assert.equal(valid.ok, true);
  assert.equal(valid.payload.voice, "nova");
  assert.equal(valid.payload.format, "mp3");
});

test("ELO TTS sem API key retorna erro controlado", async () => {
  const app = createApp({ env: { PORT: "0" } });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Olá." })
    });
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.equal(data.error, "tts_provider_not_configured");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("ELO TTS retorna audio e nao expoe segredo ao frontend", async () => {
  let providerRequest = null;
  const app = createApp({
    env: { PORT: "0", OPENAI_API_KEY: "test-key", AI_ALLOWED_ORIGINS: "https://www.icaroamaral.com.br" },
    ttsFetch: async (url, options = {}) => {
      providerRequest = { url, headers: options.headers, body: JSON.parse(options.body || "{}") };
      return {
        ok: true,
        status: 200,
        async arrayBuffer() {
          return new Uint8Array([82, 73, 70, 70]).buffer;
        }
      };
    }
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/tts", {
      method: "POST",
      headers: {
        Origin: "https://www.icaroamaral.com.br",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: "Olá. Teste com acentos e número 42.", voice: "nova" })
    });
    const audio = Buffer.from(await response.arrayBuffer());
    const serializedHeaders = JSON.stringify(Array.from(response.headers.entries()));

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /audio\/mpeg/);
    assert.equal(response.headers.get("x-elo-tts-provider"), "openai");
    assert.equal(response.headers.get("x-elo-tts-voice"), "nova");
    assert.equal(audio.length, 4);
    assert.equal(providerRequest.url, "https://api.openai.com/v1/audio/speech");
    assert.equal(providerRequest.body.voice, "nova");
    assert.equal(providerRequest.body.input, "Olá. Teste com acentos e número 42.");
    assert.doesNotMatch(serializedHeaders, /test-key|OPENAI_API_KEY|Bearer/i);
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("synthesizeSpeech usa provider abstraido", async () => {
  const result = await synthesizeSpeech({
    text: "Português brasileiro.",
    voice: "alloy",
    env: { OPENAI_API_KEY: "test-key" },
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async arrayBuffer() {
        return new Uint8Array([1, 2, 3]).buffer;
      }
    })
  });
  assert.equal(result.provider, "openai");
  assert.equal(result.contentType, "audio/mpeg");
  assert.equal(result.audio.length, 3);
});
