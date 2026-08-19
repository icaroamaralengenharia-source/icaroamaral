import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("POST /api/elo/media/search consulta YouTube Data API no backend", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0", YOUTUBE_API_KEY: "secret-key" },
    mediaSearchFetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          items: [{
            id: { videoId: "abc123" },
            snippet: {
              title: "Musica Oficial",
              channelTitle: "Canal VEVO",
              thumbnails: { medium: { url: "https://img.example/thumb.jpg" } }
            }
          }]
        })
      };
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/elo/media/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "musica oficial" })
    });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.provider, "youtube-data-api");
    assert.equal(data.results[0].videoId, "abc123");
    assert.equal(data.results[0].embeddable, true);
    assert.equal(JSON.stringify(data).includes("secret-key"), false);
  });

  assert.equal(calls.length, 1);
  const called = new URL(calls[0].url);
  assert.equal(called.origin + called.pathname, "https://www.googleapis.com/youtube/v3/search");
  assert.equal(called.searchParams.get("key"), "secret-key");
  assert.equal(called.searchParams.get("videoEmbeddable"), "true");
  assert.equal(calls[0].options.method, "GET");
});

test("POST /api/elo/media/search exige query e provider configurado", async () => {
  await withServer(createApp({ env: { PORT: "0" } }), async (baseUrl) => {
    const empty = await fetch(baseUrl + "/api/elo/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "" }) });
    assert.equal(empty.status, 400);

    const missingProvider = await fetch(baseUrl + "/api/elo/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "hello" }) });
    const data = await missingProvider.json();
    assert.equal(missingProvider.status, 503);
    assert.equal(data.error, "media_search_provider_not_configured");
    assert.equal(data.provider, "youtube-data-api");
  });
});
