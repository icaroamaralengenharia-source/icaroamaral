import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

async function listen_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, baseUrl: "http://127.0.0.1:" + server.address().port };
}

async function close_(server) {
  await new Promise((resolve) => server.close(resolve));
}

function postChat_(baseUrl, body) {
  return fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

test("/api/elo/chat salva memorize no store canonico e recupera em nova chamada isolada por usuario", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-canonical-memory-"));
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const promptText = payload.input[0].content;
      prompts.push(promptText);
      const hasFlor = /flor de concreto/i.test(promptText);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: hasFlor ? "Seu código de revisão arbitrário é flor de concreto." : "Não encontrei essa memória para este usuário." }
            ]
          }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  const store = createEloCoreStore({ dataPath: join(tempDir, "elo-core.json") });
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      OPENAI_API_KEY: "test-key"
    },
    eloCoreStore: store
  });
  const server = await listen_(app);

  try {
    const saveResponse = await postChat_(server.baseUrl, {
      anonymousId: "anon_mem_a",
      message: "memorize: meu código de revisão arbitrário é flor de concreto",
      history: [],
      context: { source: "elo", mode: "standalone", eloContext: "geral", anonymousId: "anon_mem_a" }
    });
    const saveData = await saveResponse.json();
    assert.equal(saveResponse.status, 201);
    assert.equal(saveData.mode, "memory_saved");
    assert.match(saveData.memory.memory_value, /flor de concreto/i);

    const userAResponse = await postChat_(server.baseUrl, {
      anonymousId: "anon_mem_a",
      message: "qual é meu código de revisão arbitrário?",
      history: [],
      context: { source: "elo", mode: "standalone", eloContext: "geral", anonymousId: "anon_mem_a" }
    });
    const userAData = await userAResponse.json();
    assert.equal(userAResponse.status, 200);
    assert.match(userAData.answer, /flor de concreto/i);
    assert.match(prompts[0], /PERMANENT USER MEMORY/i);
    assert.match(prompts[0], /Memoria canonica relevante do usuario/i);
    assert.match(prompts[0], /flor de concreto/i);
    assert.doesNotMatch(prompts[0], /Contexto salvo sobre a pessoa:\n-/i);

    const userBResponse = await postChat_(server.baseUrl, {
      anonymousId: "anon_mem_b",
      message: "qual é meu código de revisão arbitrário?",
      history: [],
      context: { source: "elo", mode: "standalone", eloContext: "geral", anonymousId: "anon_mem_b" }
    });
    const userBData = await userBResponse.json();
    assert.equal(userBResponse.status, 200);
    assert.doesNotMatch(userBData.answer, /flor de concreto/i);
    assert.doesNotMatch(prompts[1], /flor de concreto/i);

    const unrelatedResponse = await postChat_(server.baseUrl, {
      anonymousId: "anon_mem_a",
      message: "como controlar validade de medicamentos?",
      history: [],
      eloContext: "saude",
      context: { source: "elo", mode: "standalone", eloContext: "saude", anonymousId: "anon_mem_a" }
    });
    assert.equal(unrelatedResponse.status, 200);
    assert.doesNotMatch(prompts[2], /flor de concreto/i);
    assert.match(prompts[2], /CURRENT WORKING CONTEXT \/ OBRA/i);
  } finally {
    await close_(server.server);
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});