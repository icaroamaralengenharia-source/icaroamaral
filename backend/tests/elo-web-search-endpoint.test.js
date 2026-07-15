import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.js";

async function listenTestApp_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return {
    server,
    baseUrl: "http://127.0.0.1:" + server.address().port
  };
}

async function closeTestServer_(server) {
  await new Promise((resolve) => server.close(resolve));
}

test("Elo web search retorna JSON com answer, sources e CORS", async () => {
  let providerRequest = null;
  const app = createApp({
    env: { PORT: "0", OPENAI_API_KEY: "test-key", AI_ALLOWED_ORIGINS: "https://www.icaroamaral.com.br" },
    webSearchFetch: async (url, options = {}) => {
      providerRequest = { url, body: JSON.parse(options.body || "{}") };
      return {
        ok: true,
        async json() {
          return {
            output_text: "Resultado com fonte",
            output: [
              {
                content: [
                  {
                    type: "output_text",
                    text: "Resultado com fonte",
                    annotations: [
                      { title: "Fonte exemplo", url: "https://fonte.example/copa" }
                    ]
                  }
                ]
              }
            ]
          };
        }
      };
    }
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/web-search", {
      method: "POST",
      headers: {
        Origin: "https://www.icaroamaral.com.br",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: "proximos jogos da Copa do Mundo" })
    });
    const data = await response.json();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://www.icaroamaral.com.br");
    assert.equal(data.ok, true);
    assert.equal(data.query, "proximos jogos da Copa do Mundo");
    assert.equal(data.answer, "Resultado com fonte");
    assert.deepEqual(data.sources, ["Fonte exemplo - https://fonte.example/copa"]);
    assert.equal(providerRequest.url, "https://api.openai.com/v1/responses");
    assert.equal(providerRequest.body.tools[0].type, "web_search_preview");
    assert.equal(providerRequest.body.input[1].content, "proximos jogos da Copa do Mundo");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("Elo web search rejeita query vazia com JSON", async () => {
  const app = createApp({ env: { PORT: "0", OPENAI_API_KEY: "test-key" } });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "   " })
    });
    const data = await response.json();
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.equal(data.ok, false);
    assert.equal(data.error, "query_required");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("Elo web search sem provedor configurado retorna erro controlado", async () => {
  const app = createApp({ env: { PORT: "0" } });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "cotacao do dolar hoje" })
    });
    const data = await response.json();
    assert.equal(response.status, 503);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.equal(data.ok, false);
    assert.equal(data.error, "web_search_provider_not_configured");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("Elo web search falha do provedor retorna JSON controlado", async () => {
  const app = createApp({
    env: { PORT: "0", OPENAI_API_KEY: "test-key" },
    webSearchFetch: async () => ({
      ok: false,
      async json() {
        return { error: { message: "provider down" } };
      }
    })
  });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/web-search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "noticias atuais" })
    });
    const data = await response.json();
    assert.equal(response.status, 502);
    assert.match(response.headers.get("content-type") || "", /application\/json/);
    assert.equal(data.ok, false);
    assert.equal(data.error, "web_search_failed");
  } finally {
    await closeTestServer_(testServer.server);
  }
});

test("Elo web search responde preflight CORS", async () => {
  const app = createApp({ env: { PORT: "0", AI_ALLOWED_ORIGINS: "https://www.icaroamaral.com.br" } });
  const testServer = await listenTestApp_(app);
  try {
    const response = await fetch(testServer.baseUrl + "/api/elo/web-search", {
      method: "OPTIONS",
      headers: {
        Origin: "https://www.icaroamaral.com.br",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type"
      }
    });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://www.icaroamaral.com.br");
    assert.match(response.headers.get("access-control-allow-methods") || "", /POST/);
  } finally {
    await closeTestServer_(testServer.server);
  }
});