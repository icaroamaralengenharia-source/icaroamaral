import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createApp,
  createEloVectorMemoryStore_
} from "../src/app.js";

const realFetch_ = globalThis.fetch;

async function withTemporaryEloServer_(options, callback) {
  const app = createApp(Object.assign({
    eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true })
  }, options || {}));
  const instance = await new Promise((resolve) => {
    const serverInstance = app.listen(0, () => resolve(serverInstance));
  });
  try {
    await callback("http://127.0.0.1:" + instance.address().port);
  } finally {
    await new Promise((resolve) => instance.close(resolve));
  }
}

async function postJson_(url, body) {
  return realFetch_(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

test("ELO chat pula embedding quando owner nao possui memoria", async () => {
  const originalFetch = globalThis.fetch;
  const calls = { embeddings: 0, responses: 0 };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/embeddings")) {
      calls.embeddings += 1;
      return new Response(JSON.stringify({ data: [{ embedding: [1, 0, 0] }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.includes("/responses")) {
      calls.responses += 1;
      return new Response(JSON.stringify({ output_text: "2 + 2 e 4." }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error("unexpected fetch: " + target);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: { OPENAI_API_KEY: "test-key" }
    });
    await withTemporaryEloServer_({
      eloVectorMemoryStore: store,
      env: { OPENAI_API_KEY: "test-key" }
    }, async (url) => {
      const response = await postJson_(url + "/api/elo/chat", {
        message: "quanto e 2+2?",
        history: [],
        context: { deviceId: "elo_dev_sem_memoria", source: "elo", mode: "standalone", eloContext: "geral" }
      });
      const data = await response.json();
      const latency = JSON.parse(response.headers.get("x-elo-latency") || "{}");

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.mode, "remote");
      assert.equal(calls.embeddings, 0);
      assert.equal(calls.responses, 1);
      assert.equal(latency.embeddingSkipped, true);
      assert.equal(latency.memoryCandidateCount, 0);
      assert.equal(data.contextSummary.hasRelevantMemory, false);
      assert.match(data.answer, /4/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("ELO chat mantem embedding quando owner possui memoria", async () => {
  const originalFetch = globalThis.fetch;
  const calls = { embeddings: 0, responses: 0 };
  globalThis.fetch = async (url) => {
    const target = String(url);
    if (target.includes("/embeddings")) {
      calls.embeddings += 1;
      return new Response(JSON.stringify({ data: [{ embedding: [1, 0, 0] }] }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (target.includes("/responses")) {
      calls.responses += 1;
      return new Response(JSON.stringify({ output_text: "Resposta preservada." }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error("unexpected fetch: " + target);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: { OPENAI_API_KEY: "test-key" },
      initialState: {
        items: [{
          id: "mem-1",
          ownerId: "elo_dev_com_memoria",
          text: "Preferencia salva do usuario.",
          embedding: [1, 0, 0],
          embeddingProvider: "openai",
          embeddingModel: "text-embedding-3-small",
          embeddingDimensions: 3,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }]
      }
    });
    await withTemporaryEloServer_({
      eloVectorMemoryStore: store,
      env: { OPENAI_API_KEY: "test-key" }
    }, async (url) => {
      const response = await postJson_(url + "/api/elo/chat", {
        message: "quanto e 2+2?",
        history: [],
        context: { deviceId: "elo_dev_com_memoria", source: "elo", mode: "standalone", eloContext: "geral" }
      });
      const data = await response.json();
      const latency = JSON.parse(response.headers.get("x-elo-latency") || "{}");

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.equal(data.mode, "remote");
      assert.equal(calls.embeddings, 1);
      assert.equal(calls.responses, 1);
      assert.equal(latency.embeddingSkipped, false);
      assert.equal(latency.memoryCandidateCount, 1);
      assert.equal(data.contextSummary.hasRelevantMemory, true);
      assert.match(data.answer, /Resposta preservada/);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
