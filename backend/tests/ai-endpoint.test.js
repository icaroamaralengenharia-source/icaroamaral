import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import {
  buildEloSystemPrompt_,
  buildPathologyContext,
  buildVisionUserPrompt_,
  createApp,
  createEloVectorMemoryStore_,
  formatImageAnalysis_,
  normalizeImageAnalysis_,
  reindexEloVectorMemoryFile_,
  searchEloRelevantMemories_,
  searchPathologyKnowledge
} from "../src/app.js";

let server;
let baseUrl;
let eloVectorMemoryStore;

before(async () => {
  eloVectorMemoryStore = createEloVectorMemoryStore_({ memoryOnly: true });
  const app = createApp({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500"
    },
    eloVectorMemoryStore
  });

  server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  baseUrl = "http://127.0.0.1:" + server.address().port;
});

after(async () => {
  if (!server) {
    return;
  }

  await new Promise((resolve) => server.close(resolve));
});

test("health responde ok", async () => {
  const response = await fetch(baseUrl + "/api/health");
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
});

test("bloqueia action inválida", async () => {
  const response = await postAi_({
    action: "invalid",
    text: "teste",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("valida texto vazio em improve", async () => {
  const response = await postAi_({
    action: "improve",
    text: "",
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("sem chave retorna erro amigável para fallback local", async () => {
  const response = await postAi_({
    action: "review",
    text: "",
    context: {
      report: {
        obra: "Obra teste"
      },
      stats: {
        fotos: 1,
        inconformidades: 0,
        riscosAltos: 0
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("análise visual exige imagem processada", async () => {
  const response = await postImage_({
    image: {},
    context: {}
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
});

test("análise visual sem chave retorna erro amigável", async () => {
  const response = await postImage_({
    image: {
      base64: tinyJpegBase64_(),
      mimeType: "image/jpeg",
      fileName: "teste.jpg",
      width: 1,
      height: 1
    },
    context: {
      report: {
        obra: "Obra teste"
      }
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.match(data.error, /OPENAI_API_KEY/);
});

test("elo chat exige mensagem", async () => {
  const response = await postEloChat_({
    message: "",
    history: []
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.equal(data.fallback, true);
});

test("elo chat sem chave solicita fallback local", async () => {
  const response = await postEloChat_({
    message: "Oi Elo, voce esta online?",
    history: [
      { role: "system", content: "ignorar" },
      { role: "user", content: "Ola" },
      { role: "assistant", content: "Ola, posso ajudar." }
    ],
    context: {
      source: "elo",
      mode: "standalone"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.ok, false);
  assert.equal(data.mode, "fallback_required");
  assert.equal(data.fallback, true);
  assert.match(data.answer, /forma local/);
});

test("prompt mestre do Elo define identidade, memoria e limites", () => {
  const prompt = buildEloSystemPrompt_();

  assert.match(prompt, /Contexto ativo: Elo Geral/i);
  assert.match(prompt, /companheiro digital com memória recente/i);
  assert.match(prompt, /não é humano/i);
  assert.match(prompt, /sem parecer atendimento genérico/i);
  assert.match(prompt, /o que percebo/i);
  assert.match(prompt, /histórico recente/i);
  assert.match(prompt, /não dê diagnóstico médico, jurídico, financeiro ou psicológico/i);
  assert.match(prompt, /Eu sou o Elo/i);
  assert.match(prompt, /Sou real como sistema digital/i);
});

test("prompt mestre do Elo aplica contexto Saude", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "saude"
  });

  assert.match(prompt, /Contexto ativo: Elo Saude/i);
  assert.match(prompt, /almoxarifado hospitalar/i);
  assert.match(prompt, /lote/i);
  assert.match(prompt, /validade/i);
  assert.match(prompt, /estoque minimo/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Obras/i);
});

test("prompt mestre do Elo aplica contexto Obras", () => {
  const prompt = buildEloSystemPrompt_({
    eloContext: "obras"
  });

  assert.match(prompt, /Contexto ativo: Elo Obras/i);
  assert.match(prompt, /engenharia civil/i);
  assert.match(prompt, /RDO/i);
  assert.match(prompt, /fissuras/i);
  assert.match(prompt, /estoque de obra/i);
  assert.doesNotMatch(prompt, /Contexto ativo: Elo Saude/i);
});

test("prompt mestre do Elo inclui memoria permanente enviada no contexto", () => {
  const prompt = buildEloSystemPrompt_({
    memoriesSummary: "- [pessoa; importancia alta] Minha mae se chama Maria."
  });

  assert.match(prompt, /Contexto salvo sobre a pessoa/i);
  assert.match(prompt, /Minha mae se chama Maria/i);
  assert.match(prompt, /sem repetir 'segundo minha memoria'/i);
});

test("prompt mestre do Elo inclui contexto relevante recuperado por vetor", () => {
  const prompt = buildEloSystemPrompt_({
    relevantMemoriesSummary: "- [projeto; score 0.42] Stock IA organiza almoxarifado e controle de materiais."
  });

  assert.match(prompt, /Contexto relevante recuperado/i);
  assert.match(prompt, /Stock IA organiza almoxarifado/i);
});

test("prompt mestre do Elo inclui conteudo de documento anexado", () => {
  const prompt = buildEloSystemPrompt_({
    documentsSummary: "Documento 1: contrato.txt\nTrecho extraido:\nPrazo de entrega: 30 dias."
  });

  assert.match(prompt, /documentos anexados/i);
  assert.match(prompt, /contrato\.txt/i);
  assert.match(prompt, /Prazo de entrega: 30 dias/i);
  assert.match(prompt, /Não invente informação/i);
});

test("memoria vetorial recupera contexto por significado", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "stock-ia",
    text: "Meu projeto principal e o Stock IA para controlar almoxarifado, materiais e entradas de obra.",
    category: "projeto",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "familia",
    text: "Minha mae se chama Maria e gosta de conversar com calma.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const summary = await searchEloRelevantMemories_(store, "Como esta aquela ideia do estoque?", "elo_dev_usuario_a");

  assert.match(summary, /Stock IA/i);
  assert.doesNotMatch(summary.split("\n")[0], /Maria/i);
});

test("memoria vetorial fica isolada por deviceId", async () => {
  const store = createEloVectorMemoryStore_({ memoryOnly: true });
  await store.upsert({
    ownerId: "elo_dev_usuario_a",
    id: "mae-maria",
    text: "Minha mae se chama Maria.",
    category: "pessoa",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z"
  });

  const userA = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_a");
  const userB = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "elo_dev_usuario_b");
  const noDevice = await searchEloRelevantMemories_(store, "O que voce lembra sobre minha mae?", "");

  assert.match(userA, /Maria/i);
  assert.doesNotMatch(userB, /Maria/i);
  assert.equal(noDevice, "");
});

test("endpoint de memoria vetorial salva item local", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "memoria-teste",
      text: "Controle de estoque da obra com materiais e almoxarifado.",
      category: "projeto"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.mode, "local_vector");
  assert.equal(data.item.id, "memoria-teste");
  assert.equal(data.item.embeddingProvider, "local");
  assert.equal(data.item.embeddingModel, "local-hash-96");
  assert.equal(data.item.embeddingDimensions, 96);
  assert.equal(data.item.schemaVersion, 2);
});

test("memoria vetorial usa embedding real mockado com OPENAI_API_KEY", async () => {
  const originalFetch = globalThis.fetch;
  let embeddingPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      embeddingPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_openai_embedding",
      id: "openai-memoria",
      text: "Memoria com embedding real mockado.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 3);
    assert.equal(item.schemaVersion, 2);
    assert.equal(embeddingPayload.model, "text-embedding-3-small");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial usa fallback local quando embedding real falha", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      }
    });
    const item = await store.upsert({
      ownerId: "elo_dev_embedding_fallback",
      id: "fallback-memoria",
      text: "Controle de estoque com fallback local.",
      category: "projeto"
    });

    assert.equal(item.embeddingProvider, "local");
    assert.equal(item.embeddingModel, "local-hash-96");
    assert.equal(item.embeddingDimensions, 96);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("memoria vetorial nao mistura vetores incompatíveis", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding: [1, 0, 0] }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const store = createEloVectorMemoryStore_({
      memoryOnly: true,
      env: {
        OPENAI_API_KEY: "test-key"
      },
      initialState: {
        items: [
          {
            ownerId: "elo_dev_dimensoes",
            id: "local-antigo",
            text: "Memoria local antiga sobre estoque.",
            category: "projeto",
            embedding: new Array(96).fill(0.1),
            embeddingProvider: "local",
            embeddingModel: "local-hash-96",
            embeddingDimensions: 96,
            schemaVersion: 1
          }
        ]
      }
    });
    const items = await store.search("estoque", "elo_dev_dimensoes", 5);

    assert.equal(items.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reindexacao segura converte memoria local para OpenAI", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_reindex",
      id: "memoria-local",
      text: "Memoria antiga sobre contrato e prazo.",
      category: "projeto",
      source: "elo",
      createdAt: "2026-06-01T00:00:00.000Z",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.ok, true);
    assert.equal(result.candidates, 1);
    assert.equal(result.reindexed, 1);
    assert.equal(item.embeddingProvider, "openai");
    assert.equal(item.embeddingModel, "text-embedding-3-small");
    assert.equal(item.embeddingDimensions, 1536);
    assert.equal(item.embedding.length, 1536);
    assert.equal(item.schemaVersion, 2);
    assert.equal(item.reindexedAt, "2026-06-03T10:00:00.000Z");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura preserva campos essenciais da memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_preserva",
      deviceId: "elo_dev_preserva",
      id: "memoria-preservada",
      text: "Memoria antiga com dados preservados.",
      category: "pessoa",
      type: "memory",
      source: "elo",
      fileName: "memoria.txt",
      createdAt: "2026-06-01T00:00:00.000Z",
      metadata: { fileName: "memoria.txt", origem: "teste" },
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(item.ownerId, "elo_dev_preserva");
    assert.equal(item.deviceId, "elo_dev_preserva");
    assert.equal(item.id, "memoria-preservada");
    assert.equal(item.text, "Memoria antiga com dados preservados.");
    assert.equal(item.category, "pessoa");
    assert.equal(item.type, "memory");
    assert.equal(item.source, "elo");
    assert.equal(item.fileName, "memoria.txt");
    assert.equal(item.createdAt, "2026-06-01T00:00:00.000Z");
    assert.deepEqual(item.metadata, { fileName: "memoria.txt", origem: "teste" });
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura cria backup antes de alterar memoria", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  writeEloVectorTestFile_(storePath, [
    {
      ownerId: "elo_dev_backup",
      id: "memoria-backup",
      text: "Memoria antiga que exige backup.",
      category: "projeto",
      embedding: new Array(96).fill(0.1),
      embeddingProvider: "local",
      embeddingModel: "local-hash-96",
      embeddingDimensions: 96,
      schemaVersion: 1
    }
  ]);
  globalThis.fetch = mockOpenAiEmbeddingFetch_(new Array(1536).fill(0.01), originalFetch);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const backup = readJsonFile_(result.backupPath);

    assert.equal(result.backupCreated, true);
    assert.equal(existsSync(result.backupPath), true);
    assert.equal(backup.items[0].embeddingProvider, "local");
    assert.equal(backup.items[0].embeddingModel, "local-hash-96");
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura mantem memoria intacta quando OpenAI falha", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const originalFetch = globalThis.fetch;
  const originalItem = {
    ownerId: "elo_dev_falha",
    id: "memoria-falha",
    text: "Memoria antiga protegida contra falha.",
    category: "projeto",
    embedding: new Array(96).fill(0.1),
    embeddingProvider: "local",
    embeddingModel: "local-hash-96",
    embeddingDimensions: 96,
    schemaVersion: 1
  };
  writeEloVectorTestFile_(storePath, [originalItem]);
  globalThis.fetch = async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });
    const item = readJsonFile_(storePath).items[0];

    assert.equal(result.reindexed, 0);
    assert.equal(result.failed, 1);
    assert.deepEqual(item, originalItem);
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("reindexacao segura nao cria backup quando nao ha registros pendentes", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "elo-reindex-"));
  const storePath = join(tempDir, "elo-vector-memory.json");
  const item = {
    ownerId: "elo_dev_sem_pendencia",
    id: "memoria-openai",
    text: "Memoria ja indexada com OpenAI.",
    category: "projeto",
    embedding: new Array(1536).fill(0.01),
    embeddingProvider: "openai",
    embeddingModel: "text-embedding-3-small",
    embeddingDimensions: 1536,
    schemaVersion: 2
  };
  writeEloVectorTestFile_(storePath, [item]);

  try {
    const result = await reindexEloVectorMemoryFile_({
      path: storePath,
      env: { OPENAI_API_KEY: "test-key" },
      now: "2026-06-03T10:00:00.000Z"
    });

    assert.equal(result.candidates, 0);
    assert.equal(result.reindexed, 0);
    assert.equal(result.backupCreated, false);
    assert.deepEqual(readJsonFile_(storePath).items[0], item);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("elo chat com anexo txt indexa documento sem quebrar fallback", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, resuma este documento",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_teste"
    },
    files: [
      {
        name: "contrato.txt",
        type: "text/plain",
        content: "Contrato de obra. Prazo de entrega: 30 dias. Pagamento em duas parcelas."
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega do contrato?", "elo_dev_doc_teste");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.answer, /extrair texto do anexo/i);
  assert.match(data.answer, /contrato\.txt/i);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("documento anexado preserva chunk maior que 800 caracteres na memoria vetorial", async () => {
  const longText = "Contrato longo do Elo. " + "Clausula tecnica preservada para indexacao sem corte prematuro. ".repeat(18);
  const response = await postEloChatMultipart_({
    message: "Elo, leia este documento longo",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_doc_longo"
    },
    files: [
      {
        name: "contrato-longo.txt",
        type: "text/plain",
        content: longText
      }
    ]
  });
  const data = await response.json();
  const indexedChunk = eloVectorMemoryStore.list().find((item) => item.ownerId === "elo_dev_doc_longo" && item.source === "upload_elo");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(indexedChunk);
  assert.ok(indexedChunk.text.length > 800);
  assert.match(indexedChunk.text, /Clausula tecnica preservada/i);
});

test("elo chat com pdf vazio ou sem texto retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_teste"
    },
    files: [
      {
        name: "vazio.pdf",
        type: "application/pdf",
        content: "%PDF-1.4\n%%EOF"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.ok(Array.isArray(data.attachmentErrors));
  assert.match(data.attachmentErrors.join("\n"), /PDF pode estar escaneado|texto extraivel|corrompido/i);
});

test("elo chat com pdf corrompido retorna erro amigavel", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, leia este PDF",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_corrompido"
    },
    files: [
      {
        name: "corrompido.pdf",
        type: "application/pdf",
        content: "isto nao e um pdf valido"
      }
    ]
  });
  const data = await response.json();

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(data.attachmentErrors.join("\n"), /corrompido|texto extraivel|Nao consegui ler/i);
});

test("elo chat com pdf valido extrai e indexa texto", async () => {
  const response = await postEloChatMultipart_({
    message: "Elo, qual e o prazo deste PDF?",
    context: {
      source: "elo",
      mode: "standalone",
      deviceId: "elo_dev_pdf_valido"
    },
    files: [
      {
        name: "contrato-valido.pdf",
        type: "application/pdf",
        content: tinyPdfBuffer_()
      }
    ]
  });
  const data = await response.json();
  const indexed = await searchEloRelevantMemories_(eloVectorMemoryStore, "Qual e o prazo de entrega?", "elo_dev_pdf_valido");

  assert.equal(response.status, 503);
  assert.equal(data.fallback, true);
  assert.match(indexed, /Prazo de entrega: 30 dias/i);
});

test("upload acima do limite retorna JSON amigavel", async () => {
  await withTemporaryEloServer_({
    env: {
      PORT: "0",
      AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
      ELO_MAX_UPLOAD_BYTES: "100",
      ELO_MAX_ATTACHMENT_BYTES: "50"
    }
  }, async (url) => {
    const response = await postEloChatMultipartTo_(url, {
      message: "Elo, leia este anexo",
      context: {
        source: "elo",
        mode: "standalone",
        deviceId: "elo_dev_limite"
      },
      files: [
        {
          name: "grande.txt",
          type: "text/plain",
          content: "x".repeat(400)
        }
      ]
    });
    const data = await response.json();

    assert.equal(response.status, 413);
    assert.equal(data.fallback, true);
    assert.match(data.answer, /excede o limite|grande demais/i);
    assert.match(data.attachmentErrors.join("\n"), /grande demais/i);
  });
});

test("falha da OpenAI preserva attachmentErrors", async () => {
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  console.error = () => {};
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      return new Response(JSON.stringify({ error: { message: "falha simulada" } }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, leia este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_openai_falha"
        },
        files: [
          {
            name: "corrompido.pdf",
            type: "application/pdf",
            content: "pdf invalido"
          }
        ]
      });
      const data = await response.json();

      assert.equal(response.status, 502);
      assert.equal(data.fallback, true);
      assert.match(data.attachmentErrors.join("\n"), /Nao consegui ler|corrompido|texto extraivel/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("payload enviado ao LLM contem resumo do documento", async () => {
  const originalFetch = globalThis.fetch;
  let openAiPayload = null;
  globalThis.fetch = async function (url, options) {
    if (String(url).startsWith("https://api.openai.com/")) {
      openAiPayload = JSON.parse(options.body);
      return new Response(JSON.stringify({
        output: [
          {
            content: [
              { type: "output_text", text: "O documento anexado informa prazo de entrega de 30 dias." }
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

  try {
    await withTemporaryEloServer_({
      env: {
        PORT: "0",
        AI_ALLOWED_ORIGINS: "http://127.0.0.1:5500",
        OPENAI_API_KEY: "test-key"
      }
    }, async (url) => {
      const response = await postEloChatMultipartTo_(url, {
        message: "Elo, resuma este PDF",
        context: {
          source: "elo",
          mode: "standalone",
          deviceId: "elo_dev_payload_pdf"
        },
        files: [
          {
            name: "contrato-valido.pdf",
            type: "application/pdf",
            content: tinyPdfBuffer_()
          }
        ]
      });
      const data = await response.json();
      const payloadText = JSON.stringify(openAiPayload);

      assert.equal(response.status, 200);
      assert.equal(data.ok, true);
      assert.match(data.answer, /30 dias/i);
      assert.match(payloadText, /Prazo de entrega: 30 dias/i);
      assert.match(payloadText, /contrato-valido\.pdf/i);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("frontend do Elo nao expoe chave OpenAI", async () => {
  const { readFile } = await import("node:fs/promises");
  const files = [
    new URL("../../elo.html", import.meta.url),
    new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url),
    new URL("../../relatorio-qualidade-obras/relatorio-config.js", import.meta.url)
  ];
  const contents = await Promise.all(files.map((file) => readFile(file, "utf8")));

  contents.forEach((content) => {
    assert.doesNotMatch(content, /OPENAI_API_KEY/);
    assert.doesNotMatch(content, /sk-[A-Za-z0-9_-]{20,}/);
  });
});

test("frontend do Elo reconhece attachmentErrors em resposta online", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /attachmentErrors/);
  assert.match(content, /formatEloAttachmentErrors_/);
  assert.match(content, /data && Array\.isArray\(data\.attachmentErrors\)/);
  assert.match(content, /data && data\.fallback && data\.answer/);
});

test("frontend do Elo envia eloContext no JSON e multipart", async () => {
  const { readFile } = await import("node:fs/promises");
  const content = await readFile(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");

  assert.match(content, /function getEloContext\(\)/);
  assert.match(content, /eloContext: eloContext/);
  assert.match(content, /formData\.append\("eloContext", payload\.eloContext\)/);
  assert.match(content, /stock-saude/);
  assert.match(content, /stock-ai/);
});

test("endpoint de memoria vetorial exige deviceId valido", async () => {
  const response = await postEloVectorMemory_({
    memory: {
      id: "sem-device",
      text: "Minha mae se chama Maria.",
      category: "pessoa"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /deviceId/i);
});

test("endpoint de memoria vetorial rejeita texto acima do limite", async () => {
  const response = await postEloVectorMemory_({
    deviceId: "elo_dev_teste",
    memory: {
      id: "texto-grande",
      text: "a".repeat(801),
      category: "outro"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 400);
  assert.equal(data.ok, false);
  assert.match(data.error, /longo/i);
});

test("prompt visual inclui biblioteca de patologias e restricoes tecnicas", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "fissura-parede.jpg",
      width: 1200,
      height: 900
    },
    context: {
      imageLabel: "Foto da inconformidade 01",
      report: {
        obra: "Obra teste",
        local: "Bloco A"
      }
    }
  });

  assert.match(prompt, /fissuras e trincas/i);
  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao de armadura/i);
  assert.match(prompt, /Nao afirmar causa definitiva/);
  assert.match(prompt, /Nao emitir laudo/);
  assert.match(prompt, /validacao do responsavel tecnico/);
});

test("base consultavel de patologias localiza verificacoes e alertas", () => {
  const result = searchPathologyKnowledge("mancha de umidade com pintura descascando");

  assert.equal(result.totalRecords, 8);
  assert.ok(result.items.length >= 1);
  assert.ok(result.items.some((item) => /umidade|infiltracao/i.test(item.nome)));
  assert.ok(result.items[0].verificacoes_recomendadas.length > 0);
  assert.ok(result.items[0].alertas.length > 0);
});

test("contexto de patologias resume a base para a IA visual", () => {
  const context = buildPathologyContext("aco exposto com ferrugem em viga de concreto");

  assert.match(context, /Registros locais consultados:/);
  assert.match(context, /Corrosao de armadura/);
  assert.match(context, /Verificacoes recomendadas:/);
  assert.match(context, /Nao emitir laudo definitivo/);
  assert.match(context, /validacao do responsavel tecnico/);
});

test("prompt visual preserva categorias de infiltracao e corrosao", () => {
  const prompt = buildVisionUserPrompt_({
    image: {
      fileName: "umidade-corrosao.jpg",
      width: 800,
      height: 600
    },
    context: {
      report: {
        obra: "Inspecao teste"
      }
    }
  });

  assert.match(prompt, /infiltracao/i);
  assert.match(prompt, /umidade/i);
  assert.match(prompt, /corrosao/i);
  assert.match(prompt, /armadura/i);
});

test("analise visual formatada usa padrao de patologias e observacao obrigatoria", () => {
  const analysis = normalizeImageAnalysis_({
    elementoObservado: "Parede interna",
    categoriaProvavel: "fissuras e trincas",
    confianca: "media",
    descricaoTecnica: "Indicio visual de fissura linear no revestimento.",
    evidenciasVisuais: ["linha fina no revestimento", "alteracao superficial localizada"],
    possiveisInconformidades: ["possivel manifestacao de fissura"],
    verificacoesRecomendadas: ["verificar abertura e extensao", "acompanhar evolucao"],
    grauPreliminar: "atencao",
    textoRelatorio: "Foi observado indicio visual de fissura em parede interna, recomendando-se verificacao complementar."
  });
  const formatted = formatImageAnalysis_(analysis);

  assert.match(formatted, /Elemento observado:/);
  assert.match(formatted, /Possivel manifestacao:/);
  assert.match(formatted, /Evidencias visuais:/);
  assert.match(formatted, /Verificacoes recomendadas:/);
  assert.match(formatted, /Grau preliminar:/);
  assert.match(formatted, /Texto sugerido para relatorio:/);
  assert.match(formatted, /Analise assistida por IA, sujeita a validacao do responsavel tecnico/);
});

test("stock demo sincroniza estado remoto em memoria", async () => {
  const key = "prefeitura-sao-joao-secretaria";
  const state = {
    items: [{ id: "item-1", name: "Mascara", environmentId: "env-1" }],
    movements: [],
    approvalRequests: [],
    stockEnvironments: [{ id: "env-1", clientName: "Prefeitura Sao Joao" }],
    activeStockEnvironmentId: "env-1"
  };

  const saveResponse = await postStockDemoState_({ key, state });
  const saveData = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saveData.ok, true);
  assert.equal(saveData.revision, 1);

  const getResponse = await fetch(baseUrl + "/api/stock-demo/state?key=" + encodeURIComponent(key));
  const getData = await getResponse.json();
  assert.equal(getResponse.status, 200);
  assert.equal(getData.ok, true);
  assert.equal(getData.state.items[0].name, "Mascara");
});

test("stock demo registra solicitacao de aprovacao", async () => {
  const response = await postStockDemoApproval_({
    key: "prefeitura-sao-joao-aprovacao",
    request: {
      id: "apv-1",
      environmentId: "env-1",
      organizationId: "env-1",
      role: "almoxarife",
      type: "entrada",
      status: "pending",
      payload: {
        product: "Luva",
        quantity: 50,
        unit: "cx"
      }
    },
    state: {
      items: [],
      movements: [],
      approvalRequests: [],
      stockEnvironments: [{ id: "env-1" }],
      activeStockEnvironmentId: "env-1"
    }
  });
  const data = await response.json();

  assert.equal(response.status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.state.approvalRequests.length, 1);
  assert.equal(data.state.approvalRequests[0].status, "pending");
});

function writeEloVectorTestFile_(path, items) {
  writeFileSync(path, JSON.stringify({
    items,
    updatedAt: "2026-06-01T00:00:00.000Z"
  }, null, 2), "utf8");
}

function readJsonFile_(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function mockOpenAiEmbeddingFetch_(embedding, originalFetch) {
  return async function (url, options) {
    if (String(url) === "https://api.openai.com/v1/embeddings") {
      return new Response(JSON.stringify({
        data: [
          { embedding }
        ]
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    return originalFetch(url, options);
  };
}

function postAi_(body) {
  return fetch(baseUrl + "/api/ai/improve-text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postImage_(body) {
  return fetch(baseUrl + "/api/ai/analyze-image", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChat_(body) {
  return fetch(baseUrl + "/api/elo/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postEloChatMultipart_({ message, history = [], context = {}, files = [] }) {
  return postEloChatMultipartTo_(baseUrl, { message, history, context, files });
}

function postEloChatMultipartTo_(url, { message, history = [], context = {}, files = [] }) {
  const formData = new FormData();
  formData.append("message", message);
  formData.append("history", JSON.stringify(history));
  formData.append("context", JSON.stringify(context));
  files.forEach((file) => {
    formData.append("files", new Blob([file.content], { type: file.type }), file.name);
  });
  return fetch(url + "/api/elo/chat", {
    method: "POST",
    headers: {
      Origin: "http://127.0.0.1:5500"
    },
    body: formData
  });
}

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

function tinyPdfBuffer_() {
  return Buffer.from(`%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 58 >>
stream
BT /F1 24 Tf 100 700 Td (Prazo de entrega: 30 dias) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
trailer
<< /Root 1 0 R /Size 6 >>
%%EOF`);
}

function postEloVectorMemory_(body) {
  return fetch(baseUrl + "/api/elo/vector-memory", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoState_(body) {
  return fetch(baseUrl + "/api/stock-demo/state", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function postStockDemoApproval_(body) {
  return fetch(baseUrl + "/api/stock-demo/approval-requests", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://127.0.0.1:5500"
    },
    body: JSON.stringify(body)
  });
}

function tinyJpegBase64_() {
  return "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/ASP/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/ASP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Al//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IV//2gAMAwEAAgADAAAAEP/EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EFBQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EFBABAQAAAAAAAAAAAAAAAAAAARD/2gAIAQEAAT8QH//Z";
}
