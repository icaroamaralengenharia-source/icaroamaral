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


test("GET /api/elo/media/search aceita q para auditoria direta", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0", YOUTUBE_DATA_API_KEY: "secret-key" },
    mediaSearchFetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        json: async () => ({
          items: [{
            id: { videoId: "tieta123" },
            snippet: {
              title: "Tieta - Clipe Oficial",
              channelTitle: "Canal Oficial",
              thumbnails: { default: { url: "https://img.example/tieta.jpg" } }
            }
          }]
        })
      };
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/elo/media/search?q=Tieta");
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.ok, true);
    assert.equal(data.query, "Tieta");
    assert.equal(data.results.length, 1);
    assert.equal(data.results[0].videoId, "tieta123");
    assert.equal(data.results[0].embeddable, true);
  });

  assert.equal(calls.length, 1);
  const called = new URL(calls[0].url);
  assert.equal(called.searchParams.get("q"), "Tieta official music video");
});
function youtubeResultsHtml(renderers) {
  return "<html><script>var ytInitialData = " + JSON.stringify({ contents: { twoColumnSearchResultsRenderer: { primaryContents: { sectionListRenderer: { contents: [{ itemSectionRenderer: { contents: renderers.map((renderer) => ({ videoRenderer: renderer })) } }] } } } } }) + ";</script></html>";
}

function videoRenderer(videoId, title, channelTitle = "") {
  return {
    videoId,
    title: { runs: [{ text: title }] },
    ownerText: { runs: [{ text: channelTitle }] },
    shortBylineText: { runs: [{ text: channelTitle }] },
    thumbnail: { thumbnails: [{ url: "https://img.example/" + videoId + ".jpg" }] }
  };
}

test("POST /api/elo/media/search exige query e usa fallback web sem provider oficial", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0" },
    mediaSearchFetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        text: async () => youtubeResultsHtml([
          videoRenderer("good001", "Dire Straits - Sultans of Swing Official Video", "Dire Straits"),
          videoRenderer("cover01", "Sultans of Swing cover lesson", "Guitar Channel"),
          videoRenderer("good001", "Dire Straits - Sultans of Swing Official Video", "Dire Straits")
        ])
      };
    }
  });

  await withServer(app, async (baseUrl) => {
    const empty = await fetch(baseUrl + "/api/elo/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "" }) });
    assert.equal(empty.status, 400);

    const response = await fetch(baseUrl + "/api/elo/media/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: "Dire Straits Sultans of Swing" }) });
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "youtube-web-search");
    assert.equal(data.results.length, 2);
    assert.equal(data.candidates.length, 2);
    assert.equal(data.results[0].videoId, "good001");
    assert.equal(data.results[0].source, "web_search");
    assert.equal(data.results[0].playable, null);
    assert.equal(data.results[0].embeddable, null);
    assert.equal(JSON.stringify(data).includes("secret-key"), false);
  });

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => new URL(call.url).origin === "https://www.youtube.com"));
  assert.ok(calls.every((call) => call.options.method === "GET"));
});

test("GET /api/elo/media/search cacheia fallback web e limita chamadas", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0" },
    mediaSearchFetch: async (url) => {
      calls.push(url);
      return { ok: true, text: async () => youtubeResultsHtml([videoRenderer("cache01", "A-ha - Take On Me Official Video", "a-ha")]) };
    }
  });

  await withServer(app, async (baseUrl) => {
    const first = await fetch(baseUrl + "/api/elo/media/search?q=Take%20On%20Me");
    const second = await fetch(baseUrl + "/api/elo/media/search?q=Take%20On%20Me");
    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.equal((await first.json()).results[0].videoId, "cache01");
    assert.equal((await second.json()).results[0].videoId, "cache01");
  });

  assert.equal(calls.length, 3);
});

test("GET /api/elo/media/search provider oficial configurado continua prioritario", async () => {
  const calls = [];
  const app = createApp({
    env: { PORT: "0", ELO_YOUTUBE_API_KEY: "secret-key" },
    mediaSearchFetch: async (url) => {
      calls.push(url);
      return { ok: true, json: async () => ({ items: [{ id: { videoId: "api001" }, snippet: { title: "API Oficial", channelTitle: "Canal" } }] }) };
    }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/elo/media/search?q=Sultans");
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "youtube-data-api");
    assert.equal(data.results[0].videoId, "api001");
  });

  assert.equal(calls.length, 1);
  const called = new URL(calls[0]);
  assert.equal(called.origin + called.pathname, "https://www.googleapis.com/youtube/v3/search");
});

test("GET /api/elo/media/search fallback web retorna vazio com HTML inesperado", async () => {
  const app = createApp({
    env: { PORT: "0" },
    mediaSearchFetch: async () => ({ ok: true, text: async () => "<html>sem ytInitialData</html>" })
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/elo/media/search?q=sem%20resultado");
    const data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.provider, "youtube-web-search");
    assert.deepEqual(data.results, []);
  });
});

test("GET /api/elo/media/search fallback web falha limpo em timeout/erro", async () => {
  const app = createApp({
    env: { PORT: "0" },
    mediaSearchFetch: async () => { throw Object.assign(new Error("timeout"), { provider: "youtube-web-search" }); }
  });

  await withServer(app, async (baseUrl) => {
    const response = await fetch(baseUrl + "/api/elo/media/search?q=timeout");
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.equal(data.error, "media_search_failed");
    assert.equal(data.provider, "youtube-web-search");
  });
});
