import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createApp } from "../src/app.js";

const originalFetch = globalThis.fetch;
let activeServer = null;
let capturedModelPayloads = [];

afterEach(async () => {
  globalThis.fetch = originalFetch;
  capturedModelPayloads = [];
  if (activeServer) {
    await new Promise((resolve) => activeServer.close(resolve));
    activeServer = null;
  }
});

async function startSyntheticEloServer_() {
  const memorySentinel = "MEM-READ-417: a obra fictícia usa tijolos roxos";
  const previousAttachment = {
    id: "synthetic-previous-attachment-119",
    category: "document_chunk",
    text: "PREVIOUS-CHAT-ATTACHMENT-119: conteúdo fictício de anexo antigo",
    type: "document_chunk",
    source: "upload_elo",
    score: 0.95
  };
  const state = { vectorReads: 0, vectorWrites: 0, canonicalReads: 0, canonicalWrites: 0, conversationMessages: [] };
  const uploadedChunks = [];
  const profileSentinel = {
    category: "profile",
    memory_key: "cidade",
    memory_value: "PROFILE-628: cidade fictícia X",
    is_active: true
  };
  const canonicalMemories = [profileSentinel];
  const vectorMemoryStore = {
    async search() {
      state.vectorReads += 1;
      return [{ id: "synthetic-memory-417", category: "technical_context", text: memorySentinel, score: 0.95 }, previousAttachment]
        .concat(uploadedChunks.map((item) => Object.assign({}, item, { score: 0.95 })));
    },
    list() {
      return [];
    },
    async upsert(item) {
      state.vectorWrites += 1;
      uploadedChunks.push(item);
      return {};
    }
  };
  const canonicalMemoryStore = {
    async listMemories() {
      state.canonicalReads += 1;
      return canonicalMemories.slice();
    },
    async upsertMemory(memory) {
      state.canonicalWrites += 1;
      canonicalMemories.push(Object.assign({ is_active: true }, memory));
      return memory;
    },
    async getConversation() {
      return { conversation: { id: "synthetic-conversation-628" }, messages: state.conversationMessages };
    }
  };

  capturedModelPayloads = [];
  globalThis.fetch = async (url, options = {}) => {
    if (String(url) === "https://api.openai.com/v1/responses") {
      capturedModelPayloads.push(JSON.parse(options.body || "{}"));
      return new Response(JSON.stringify({
        output: [{ content: [{ type: "output_text", text: "Resposta sintética." }] }]
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return originalFetch(url, options);
  };

  const app = createApp({
    env: {
      NODE_ENV: "test",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      OPENAI_API_KEY: "synthetic-test-only",
      ELO_CORE_STORE: "json",
      ELO_RDO_STORE: "file"
    },
    eloVectorMemoryStore: vectorMemoryStore,
    eloCoreStore: canonicalMemoryStore,
    enableEloTelemetryRetention: false
  });
  activeServer = await new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
  return { baseUrl: "http://127.0.0.1:" + activeServer.address().port, state };
}

async function postSyntheticChat_(baseUrl, { message, context = {}, history = [] }) {
  return fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500",
      "x-elo-auth-user-id": "synthetic-user-628"
    },
    body: JSON.stringify({ message, history, context: { deviceId: "elo_dev_synthetic417", ...context } })
  });
}

function capturedInput_() {
  const latest = capturedModelPayloads.at(-1);
  assert.ok(latest, "expected a captured pre-provider payload");
  return JSON.stringify(latest.input || []);
}

test("ELO current-chat-only prose suppresses memory then normal mode works in a new request", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  const response = await postSyntheticChat_(baseUrl, {
    message: "Use somente as mensagens desta conversa. Não utilize memória persistente anterior. Qual material a obra fictícia usa e qual cidade fictícia X consta no perfil?"
  });

  assert.equal(response.status, 200);
  const modelInput = capturedInput_();
  assert.deepEqual({
    vectorReads: state.vectorReads,
    canonicalReads: state.canonicalReads,
    memoryInPayload: modelInput.includes("MEM-READ-417"),
    profileInPayload: modelInput.includes("PROFILE-628")
  }, {
    vectorReads: 0,
    canonicalReads: 0,
    memoryInPayload: false,
    profileInPayload: false
  });

  const normalResponse = await postSyntheticChat_(baseUrl, {
    message: "Qual material a obra fictícia usa e qual cidade fictícia X consta no perfil?"
  });
  assert.equal(normalResponse.status, 200);
  assert.match(capturedInput_(), /MEM-READ-417/);
  assert.match(capturedInput_(), /PROFILE-628/);
});

test("ELO normal mode makes relevant synthetic memory and profile available", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  const response = await postSyntheticChat_(baseUrl, {
    message: "Qual material a obra fictícia usa e qual cidade fictícia X consta no perfil?"
  });

  assert.equal(response.status, 200);
  const modelInput = capturedInput_();
  assert.equal(state.vectorReads, 1);
  assert.equal(state.canonicalReads, 1);
  assert.match(modelInput, /MEM-READ-417/);
  assert.match(modelInput, /PROFILE-628/);
  assert.doesNotMatch(modelInput, /PREVIOUS-CHAT-ATTACHMENT-119/);
});

test("ELO explicit current-chat-only flag preserves only current chat history", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  const response = await postSyntheticChat_(baseUrl, {
    message: "Qual código eu te passei?",
    history: [{ role: "user", content: "o código desta conversa é CHAT-953" }],
    context: { memoryScope: "CONVERSATION_ONLY" }
  });

  assert.equal(response.status, 200);
  const modelInput = capturedInput_();
  assert.equal(state.vectorReads, 0);
  assert.equal(state.canonicalReads, 0);
  assert.match(modelInput, /CHAT-953/);
  assert.doesNotMatch(modelInput, /MEM-READ-417|PROFILE-628/);
});

test("ELO current-chat-only scope blocks explicit persistent memory writes", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  const response = await postSyntheticChat_(baseUrl, {
    message: "lembre que TEMP-WRITE-842 é um valor de teste",
    context: { memoryScope: "CONVERSATION_ONLY" }
  });

  assert.equal(response.status, 200);
  assert.equal(state.canonicalWrites, 0);
});

test("ELO memory endpoint suppresses writes when source conversation is current-chat-only", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  state.conversationMessages = [{
    role: "user",
    content: "Use somente as mensagens desta conversa. Não utilize memória persistente anterior."
  }];

  const response = await fetch(baseUrl + "/api/elo/memories", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500",
      "x-elo-auth-user-id": "synthetic-user-628"
    },
    body: JSON.stringify({
      sourceConversationId: "synthetic-conversation-628",
      category: "technical_context",
      memory_key: "synthetic_write_842",
      memory_value: "TEMP-WRITE-842"
    })
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.skipped, "conversation_only");
  assert.equal(state.canonicalWrites, 0);

  const newChatResponse = await postSyntheticChat_(baseUrl, {
    message: "Qual era o valor sintético TEMP-WRITE-842?"
  });
  assert.equal(newChatResponse.status, 200);
  assert.doesNotMatch(capturedModelPayloads.at(-1).input[0].content, /PERMANENT USER MEMORY\n[\s\S]{0,400}TEMP-WRITE-842/);
});

test("ELO current attachment remains in model context without persistent indexing", async () => {
  const { baseUrl, state } = await startSyntheticEloServer_();
  const form = new FormData();
  form.append("message", "Resuma o anexo desta conversa.");
  form.append("history", JSON.stringify([]));
  form.append("context", JSON.stringify({ deviceId: "elo_dev_synthetic417", memoryScope: "CONVERSATION_ONLY" }));
  form.append("files", new Blob(["CURRENT-ATTACHMENT-731: anexo sintético atual"], { type: "text/plain" }), "current.txt");

  const response = await fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: { Origin: "http://127.0.0.1:5500", "x-elo-auth-user-id": "synthetic-user-628" },
    body: form
  });

  assert.equal(response.status, 200);
  const modelInput = capturedInput_();
  assert.match(modelInput, /CURRENT-ATTACHMENT-731/);
  assert.equal(state.vectorWrites, 0);

  const nextChatResponse = await postSyntheticChat_(baseUrl, {
    message: "Resuma o anexo da conversa anterior."
  });
  assert.equal(nextChatResponse.status, 200);
  assert.doesNotMatch(capturedInput_(), /CURRENT-ATTACHMENT-731/);
});

test("ELO keeps same-chat image context and drops image context bound to another chat", async () => {
  const { baseUrl } = await startSyntheticEloServer_();
  const previousChatResponse = await postSyntheticChat_(baseUrl, {
    message: "Use somente as mensagens desta conversa. Não utilize memória persistente anterior.",
    context: {
      memoryScope: "CONVERSATION_ONLY",
      currentConversationId: "SYNTH-CHAT-CURRENT-953",
      imageAnalysisContext: {
        type: "image",
        source: "explicit_history",
        available: true,
        conversationId: "SYNTH-CHAT-PREVIOUS-119",
        analysis: "PREVIOUS-CHAT-ATTACHMENT-119"
      }
    }
  });
  assert.equal(previousChatResponse.status, 200);
  assert.doesNotMatch(capturedInput_(), /PREVIOUS-CHAT-ATTACHMENT-119/);

  const currentChatResponse = await postSyntheticChat_(baseUrl, {
    message: "Use somente as mensagens desta conversa. Não utilize memória persistente anterior. O que aparece na imagem anterior?",
    context: {
      memoryScope: "CONVERSATION_ONLY",
      currentConversationId: "SYNTH-CHAT-CURRENT-953",
      imageAnalysisContext: {
        type: "image",
        source: "explicit_history",
        available: true,
        conversationId: "SYNTH-CHAT-CURRENT-953",
        analysis: "CURRENT-CHAT-IMAGE-ANALYSIS-731"
      }
    }
  });
  assert.equal(currentChatResponse.status, 200);
  assert.match(capturedInput_(), /CURRENT-CHAT-IMAGE-ANALYSIS-731/);
});

test("ELO empty new-chat payload does not inherit the previous chat sentinel", async () => {
  const { baseUrl } = await startSyntheticEloServer_();
  await postSyntheticChat_(baseUrl, {
    message: "Pergunta no chat anterior.",
    history: [{ role: "user", content: "o código desta conversa é CHAT-953" }]
  });
  const response = await postSyntheticChat_(baseUrl, { message: "Nova conversa sintética." });

  assert.equal(response.status, 200);
  assert.doesNotMatch(capturedInput_(), /CHAT-953|PREVIOUS-CHAT-ATTACHMENT-119/);
});
