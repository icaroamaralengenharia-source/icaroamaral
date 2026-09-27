import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp, createEloVectorMemoryStore_ } from "../src/app.js";
import { createEloCoreStore } from "../src/elo-core-store.js";

const ORIGIN = "http://127.0.0.1:5500";

function createEnv_(extra = {}) {
  return Object.assign({
    PORT: "0",
    ELO_RDO_STORE: "file",
    AI_ALLOWED_ORIGINS: ORIGIN,
    OPENAI_API_KEY: "test-key"
  }, extra);
}

async function listen_(app) {
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  return { server, url: "http://127.0.0.1:" + server.address().port };
}

async function close_(server) {
  await new Promise((resolve) => server.close(resolve));
}

function postChat_(url, body) {
  return fetch(url + "/api/elo/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: ORIGIN },
    body: JSON.stringify(body)
  });
}

async function postMultipart_(url, message, anonymousId) {
  const form = new FormData();
  form.append("message", message);
  form.append("anonymousId", anonymousId);
  form.append("context", JSON.stringify({ source: "elo", mode: "standalone", anonymousId, deviceId: "elo_dev_step08" }));
  form.append("history", "[]");
  form.append("files", new Blob(["Documento de fixture do Step 07."], { type: "text/plain" }), "fixture.txt");
  return fetch(url + "/api/elo/chat", { method: "POST", headers: { Origin: ORIGIN }, body: form });
}

function createAppHarness_(dataPath, env = {}, vectorStore = null) {
  return createApp({
    env: createEnv_(env),
    eloCoreStore: createEloCoreStore({ dataPath }),
    eloVectorMemoryStore: vectorStore || createEloVectorMemoryStore_({ memoryOnly: true })
  });
}

test("memória explícita tem precedência, separa múltiplos fatos e atualiza por campo", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-memory-"));
  const dataPath = join(tempDir, "elo-core.json");
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const prompt = String(payload.input && payload.input[0] && payload.input[0].content || "");
      prompts.push(prompt);
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: /BETA/i.test(prompt) ? "BETA" : "Não encontrei essa memória." }] }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
  const harness = await listen_(createAppHarness_(dataPath));
  try {
    const saved = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "memorize: minha cor de teste é azul, meu código de projeto é ALFA e meu material preferido de teste é concreto",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    const savedData = await saved.json();
    assert.equal(saved.status, 201);
    assert.equal(savedData.memories.length, 3);

    const initial = createEloCoreStore({ dataPath });
    assert.equal((await initial.listMemories({ anonymousId: "step08-user-a" })).length, 3);

    const updated = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "memorize meu código de projeto é BETA",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    const updatedData = await updated.json();
    assert.equal(updated.status, 201);
    assert.equal(updatedData.memories.length, 1);

    const repeated = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "memorize meu código de projeto é BETA",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    assert.equal(repeated.status, 201);
    assert.equal((await createEloCoreStore({ dataPath }).listMemories({ anonymousId: "step08-user-a" })).length, 3);

    const memories = await initial.listMemories({ anonymousId: "step08-user-a" });
    const codeMemories = memories.filter((item) => /codigo.*projeto/i.test(item.memory_key));
    assert.equal(codeMemories.length, 1);
    assert.equal(codeMemories[0].memory_value, "meu código de projeto é BETA");
    assert.equal(memories.some((item) => /ALFA/i.test(item.memory_value)), false);

    const recall = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "qual é meu código de projeto?",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    const recallData = await recall.json();
    assert.equal(recall.status, 200);
    assert.equal(recallData.answer, "BETA");
    assert.match(prompts.at(-1), /BETA/i);
    assert.doesNotMatch(prompts.at(-1), /ALFA/i);
  } finally {
    await close_(harness.server);
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("memória explícita aceita formas autorizadas, vence calculadora/RDO e não indexa anexo junto", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-precedence-"));
  const dataPath = join(tempDir, "elo-core.json");
  const vectorStore = createEloVectorMemoryStore_({ memoryOnly: true });
  const app = createAppHarness_(dataPath, { OPENAI_API_KEY: "" }, vectorStore);
  const harness = await listen_(app);
  try {
    for (const message of [
      "memorize meu código sem dois pontos é ALFA",
      "lembre que minha meta de teste é 14/09/2026",
      "guarde que meu código de RDO de teste é RDO-123"
    ]) {
      const response = await postChat_(harness.url, { anonymousId: "step08-user-a", message, context: { anonymousId: "step08-user-a" }, history: [] });
      assert.equal(response.status, 201);
      assert.equal((await response.json()).mode, "memory_saved");
    }

    const attachmentResponse = await postMultipart_(harness.url, "memorize: meu projeto de teste se chama Aurora", "step08-user-a");
    const attachmentData = await attachmentResponse.json();
    assert.equal(attachmentResponse.status, 201);
    assert.equal(attachmentData.mode, "memory_saved");
    assert.equal(vectorStore.list().length, 0);

    const memories = await createEloCoreStore({ dataPath }).listMemories({ anonymousId: "step08-user-a" });
    assert.equal(memories.length, 4);
    assert.ok(memories.some((item) => /14\/09\/2026/.test(item.memory_value)));
    assert.ok(memories.some((item) => /RDO-123/.test(item.memory_value)));
    assert.ok(memories.some((item) => /Aurora/.test(item.memory_value)));
  } finally {
    await close_(harness.server);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("memória sanitiza entrada e bloqueia segredos", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-safety-"));
  const dataPath = join(tempDir, "elo-core.json");
  const harness = await listen_(createAppHarness_(dataPath, { OPENAI_API_KEY: "" }));
  try {
    const safe = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "memorize: meu rótulo <script>alert(1)</script> é texto seguro",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    assert.equal(safe.status, 201);
    const safeData = await safe.json();
    assert.match(safeData.memories[0].memory_value, /texto seguro/);
    assert.doesNotMatch(safeData.memories[0].memory_value, /<script>/i);

    const secret = await postChat_(harness.url, {
      anonymousId: "step08-user-a",
      message: "memorize: minha senha é super-secreta",
      context: { anonymousId: "step08-user-a" },
      history: []
    });
    assert.equal(secret.status, 400);
    assert.equal((await secret.json()).error, "sensitive_memory_blocked");
  } finally {
    await close_(harness.server);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("negação e perguntas sobre lembrar não salvam memória", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-negative-"));
  const dataPath = join(tempDir, "elo-core.json");
  const harness = await listen_(createAppHarness_(dataPath, { OPENAI_API_KEY: "" }));
  try {
    for (const message of ["não memorize isso", "você lembra como fazer um RDO?", "lembre-me o que é concreto protendido"]) {
      const response = await postChat_(harness.url, { anonymousId: "step08-user-a", message, context: { anonymousId: "step08-user-a" }, history: [] });
      assert.notEqual(response.status, 201);
    }
    assert.deepEqual(await createEloCoreStore({ dataPath }).listMemories({ anonymousId: "step08-user-a" }), []);
  } finally {
    await close_(harness.server);
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("memória permanente persiste em reload, nova conversa e isola usuários", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-isolation-"));
  const dataPath = join(tempDir, "elo-core.json");
  const originalFetch = globalThis.fetch;
  const prompts = [];
  globalThis.fetch = async (url, options) => {
    if (String(url).startsWith("https://api.openai.com/")) {
      const payload = JSON.parse(options.body);
      const prompt = String(payload.input && payload.input[0] && payload.input[0].content || "");
      prompts.push(prompt);
      const hasPermanentMemory = /PERMANENT USER MEMORY[\s\S]*TEST_SECRET_A/i.test(prompt);
      return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: hasPermanentMemory ? "memória A" : "não encontrei" }] }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };
  let harness = await listen_(createAppHarness_(dataPath));
  try {
    const saved = await postChat_(harness.url, { anonymousId: "step08-user-a", message: "memorize: TEST_SECRET_A é uma fixture sintética", context: { anonymousId: "step08-user-a" }, history: [] });
    assert.equal(saved.status, 201);
    await close_(harness.server);
    harness = await listen_(createAppHarness_(dataPath));

    const userA = await postChat_(harness.url, { anonymousId: "step08-user-a", message: "qual é TEST_SECRET_A?", context: { anonymousId: "step08-user-a" }, history: [] });
    const userB = await postChat_(harness.url, { anonymousId: "step08-user-b", message: "qual é TEST_SECRET_A?", context: { anonymousId: "step08-user-b" }, history: [] });
    assert.equal((await userA.json()).answer, "memória A");
    assert.equal((await userB.json()).answer, "não encontrei");
    assert.match(prompts[0], /PERMANENT USER MEMORY[\s\S]*TEST_SECRET_A/i);
    assert.doesNotMatch(prompts[1], /PERMANENT USER MEMORY[\s\S]*TEST_SECRET_A/i);
  } finally {
    await close_(harness.server);
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("memória privada sem identidade autenticada falha fechado", async () => {
  const app = createApp({ env: createEnv_({ ELO_CORE_STORE: "supabase", OPENAI_API_KEY: "" }), eloVectorMemoryStore: createEloVectorMemoryStore_({ memoryOnly: true }) });
  const harness = await listen_(app);
  try {
    const response = await fetch(harness.url + "/api/elo/memories", { headers: { Origin: ORIGIN } });
    const data = await response.json();
    assert.equal(response.status, 401);
    assert.equal(data.error, "authentication_required");
  } finally {
    await close_(harness.server);
  }
});

test("memória mantém consistência sob estresse leve de 50 operações", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-step08-stress-"));
  const dataPath = join(tempDir, "elo-core.json");
  const store = createEloCoreStore({ dataPath });
  try {
    for (let index = 0; index < 50; index += 1) {
      await store.upsertMemory({
        anonymousId: "step08-stress-user",
        category: "preference",
        memory_key: "stress_field_" + (index % 5),
        memory_value: "valor " + index
      });
    }
    const memories = await store.listMemories({ anonymousId: "step08-stress-user" });
    assert.equal(memories.length, 5);
    assert.equal(new Set(memories.map((item) => item.memory_key)).size, 5);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("contrato frontend mantém precedência explícita e contexto separado", () => {
  const source = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  assert.match(source, /const explicitAskMemoryResponse = buildEloExplicitMemoryCommandResponse_\(cleanQuestion\)/);
  assert.match(source, /function splitEloExplicitMemoryFacts_/);
  assert.match(source, /workingMemorySummary/);
  assert.match(source, /last_analysis|activeAnalysisContext/);
  assert.match(source, /documentsSummary/);
});
