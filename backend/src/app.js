import cors from "cors";
import express from "express";
import Busboy from "busboy";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { OBRA_COMPOSICOES_DEMONSTRATIVAS } from "./data/obra-composicoes.js";

const MAX_TEXT_LENGTH = 6000;
const MAX_CONTEXT_LENGTH = 16000;
const MAX_IMAGE_BASE64_LENGTH = 2200000;
const MAX_ELO_MESSAGE_LENGTH = 2000;
const MAX_ELO_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_ELO_TOTAL_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_ELO_ATTACHMENT_TEXT_LENGTH = 12000;
const MAX_ELO_DOCUMENT_CONTEXT_LENGTH = 5000;
const ELO_DOCUMENT_CHUNK_LENGTH = 1200;
const MAX_ELO_VECTOR_TEXT_LENGTH = 2000;
const MAX_STOCK_DEMO_STATE_LENGTH = 1200000;
const ELO_LOCAL_VECTOR_DIMENSIONS = 96;
const ELO_OPENAI_VECTOR_DIMENSIONS = 1536;
const ELO_LOCAL_EMBEDDING_MODEL = "local-hash-96";
const ELO_OPENAI_EMBEDDING_MODEL = "text-embedding-3-small";
const ELO_VECTOR_SCHEMA_VERSION = 2;
const BACKEND_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATHOLOGY_KNOWLEDGE_DIR = join(BACKEND_DIR, "patologias");
const ELO_VECTOR_MEMORY_PATH = join(BACKEND_DIR, "data", "elo-vector-memory.json");
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const OBRAREPORT_IMAGE_ANALYSIS_LIBRARY = [
  {
    id: "fissuras-trincas",
    category: "fissuras e trincas",
    visualCues: [
      "linhas finas ou abertas em alvenaria, concreto, revestimento ou acabamento",
      "mudanca de direcao, extensao, abertura aparente e repeticao",
      "manchas, destacamento ou deformacao associada"
    ],
    caution: "Nao classificar gravidade estrutural apenas pela foto."
  },
  {
    id: "infiltracao-umidade",
    category: "infiltracao e umidade",
    visualCues: [
      "manchas escurecidas, marcas de escorrimento, bolhas ou pintura empolada",
      "alteracao de cor proxima a teto, parede, piso, esquadria, cobertura ou tubulacao",
      "sais, descascamento ou degradacao superficial"
    ],
    caution: "Nao afirmar a origem da agua sem vistoria complementar."
  },
  {
    id: "corrosao-armadura",
    category: "corrosao de armadura",
    visualCues: [
      "aco exposto, manchas ferruginosas, cobrimento rompido ou concreto desagregado",
      "fissuras proximas a elementos de concreto armado",
      "perda aparente de cobrimento ou destacamento ao redor da armadura"
    ],
    caution: "Nao estimar perda de secao ou capacidade resistente pela imagem."
  },
  {
    id: "desplacamento",
    category: "desplacamento",
    visualCues: [
      "revestimento solto, placas destacadas, bordas abertas ou areas ocas aparentes",
      "perda de aderencia em argamassa, ceramica, pintura ou concreto",
      "fragmentos, fissuras perifericas ou diferenca de plano"
    ],
    caution: "Nao afirmar causa unica sem verificar aderencia, substrato e umidade."
  },
  {
    id: "mofo-bolor",
    category: "mofo e bolor",
    visualCues: [
      "pontos escuros, esverdeados ou manchas pulverulentas",
      "ocorrencia em areas com pouca ventilacao, umidade ou condensacao",
      "associacao com manchas e degradacao de pintura"
    ],
    caution: "Nao diagnosticar risco a saude pela foto."
  },
  {
    id: "falhas-acabamento",
    category: "falhas de acabamento",
    visualCues: [
      "pintura irregular, rejunte falho, recortes desalinhados ou acabamento incompleto",
      "manchas, respingos, ondulacoes, falhas de nivelamento ou arremates inadequados",
      "incompatibilidade visual com o padrao esperado do ambiente"
    ],
    caution: "Diferenciar acabamento estetico de manifestacao patologica."
  },
  {
    id: "recalque-movimentacao",
    category: "recalque/movimentacao",
    visualCues: [
      "trincas inclinadas, aberturas em encontros, desnivel aparente ou deformacoes",
      "fissuras proximas a esquadrias, pilares, vigas, alvenarias ou pisos",
      "separacao entre elementos e repeticao em pontos alinhados"
    ],
    caution: "Nao concluir recalque apenas pela foto."
  }
];
const ACTIONS = new Set([
  "improve",
  "conclusion",
  "review",
  "improveTechnicalText",
  "generateConclusion",
  "reviewReport"
]);
const PATHOLOGY_KNOWLEDGE_BASE = loadPathologyKnowledgeBase_();

export function createApp(options = {}) {
  const app = express();
  const env = options.env || process.env;
  const stockDemoStore = options.stockDemoStore || createStockDemoStore_();
  const eloVectorMemoryStore = options.eloVectorMemoryStore || createEloVectorMemoryStore_({ path: env.ELO_VECTOR_MEMORY_PATH || ELO_VECTOR_MEMORY_PATH, env });

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = String(env.AI_ALLOWED_ORIGINS || "https://www.icaroamaral.com.br,https://icaroamaral.com.br,http://localhost,http://localhost:3000,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:5502,http://localhost:5502")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      callback(null, allowed.includes(origin) || isPrivateNetworkOrigin_(origin));
    }
  }));
  app.use(express.json({ limit: env.AI_JSON_LIMIT || "3mb" }));

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "ObraReport AI Backend"
    });
  });

  app.get("/api/stock-demo/health", (request, response) => {
    response.json({
      ok: true,
      service: "Stock AI Demo Backend",
      mode: "memory"
    });
  });

  app.get("/api/stock-demo/state", (request, response) => {
    const key = getStockDemoRequestKey_(request);
    const entry = stockDemoStore.states.get(key);

    response.json({
      ok: true,
      key,
      state: entry ? entry.state : null,
      revision: entry ? entry.revision : 0,
      updatedAt: entry ? entry.updatedAt : ""
    });
  });

  app.post("/api/stock-demo/state", (request, response) => {
    const validation = validateStockDemoStateRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    const entry = saveStockDemoState_(stockDemoStore, validation.key, validation.state);
    response.json({
      ok: true,
      key: validation.key,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    });
  });

  app.post("/api/stock-demo/approval-requests", (request, response) => {
    const validation = validateStockDemoApprovalRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    const entry = upsertStockDemoApprovalRequest_(stockDemoStore, validation.key, validation.request, validation.state);
    response.json({
      ok: true,
      key: validation.key,
      request: validation.request,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    });
  });

  app.post("/api/stock-demo/approval-requests/:id/approve", (request, response) => {
    const result = updateStockDemoApprovalStatus_(stockDemoStore, getStockDemoRequestKey_(request), request.params.id, "approved", request.body || {});

    if (!result.ok) {
      response.status(result.status).json({
        ok: false,
        error: result.message
      });
      return;
    }

    response.json(result.payload);
  });

  app.post("/api/stock-demo/approval-requests/:id/reject", (request, response) => {
    const result = updateStockDemoApprovalStatus_(stockDemoStore, getStockDemoRequestKey_(request), request.params.id, "rejected", request.body || {});

    if (!result.ok) {
      response.status(result.status).json({
        ok: false,
        error: result.message
      });
      return;
    }

    response.json(result.payload);
  });

  app.post("/api/ai/improve-text", async (request, response) => {
    const validation = validateRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    if (!env.OPENAI_API_KEY) {
      response.status(503).json({
        ok: false,
        error: "Backend de IA sem OPENAI_API_KEY configurada. O frontend deve usar o modo local."
      });
      return;
    }

    try {
      const suggestion = await callOpenAi_(validation.payload, env);
      response.json({
        ok: true,
        mode: "remote",
        title: getActionTitle_(validation.payload.action),
        suggestion,
        note: "Sugestão gerada com backend seguro. Revise antes de aplicar ao relatório."
      });
    } catch (error) {
      console.error("Falha na IA real:", error);
      response.status(502).json({
        ok: false,
        error: "A IA não respondeu agora. Tente novamente em instantes ou use o modo local."
      });
    }
  });

  app.post("/api/ai/analyze-image", async (request, response) => {
    const validation = validateImageRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    if (!env.OPENAI_API_KEY) {
      response.status(503).json({
        ok: false,
        error: "Backend de IA visual sem OPENAI_API_KEY configurada. O frontend deve continuar sem quebrar."
      });
      return;
    }

    try {
      const analysis = await callOpenAiVision_(validation.payload, env);
      response.json({
        ok: true,
        mode: "remote",
        title: "Análise visual da foto",
        analysis,
        suggestion: formatImageAnalysis_(analysis),
        note: "Análise visual gerada com backend seguro. Revise antes de aplicar ao relatório."
      });
    } catch (error) {
      console.error("Falha na IA visual:", error);
      response.status(502).json({
        ok: false,
        error: "A IA visual não respondeu agora. Tente novamente em instantes."
      });
    }
  });

  app.post("/api/elo/vector-memory", async (request, response) => {
    const validation = validateEloVectorMemoryRequest_(request.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        error: validation.message
      });
      return;
    }

    try {
      const item = await eloVectorMemoryStore.upsert(validation.payload);
      response.json({
        ok: true,
        mode: item.embeddingProvider === "openai" ? "openai_vector" : "local_vector",
        item: {
          id: item.id,
          text: item.text,
          category: item.category,
          embeddingProvider: item.embeddingProvider,
          embeddingModel: item.embeddingModel,
          embeddingDimensions: item.embeddingDimensions,
          schemaVersion: item.schemaVersion,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt
        }
      });
    } catch (error) {
      console.error("Falha ao salvar memoria vetorial do Elo:", error);
      response.status(503).json({
        ok: false,
        mode: "vector_unavailable",
        error: "Memoria vetorial indisponivel. O Elo pode continuar com a memoria local."
      });
    }
  });

  app.post("/api/elo/chat", async (request, response) => {
    let chatRequest;

    try {
      chatRequest = await buildEloChatRequest_(request, env, eloVectorMemoryStore);
    } catch (error) {
      const message = error && error.message ? error.message : "Nao consegui receber o anexo enviado.";
      response.status(error && error.status ? error.status : 400).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: buildEloAttachmentErrorAnswer_([message]),
        error: message,
        attachmentErrors: [message]
      });
      return;
    }

    const validation = validateEloChatRequest_(chatRequest.body || {});

    if (!validation.ok) {
      response.status(validation.status).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: "Não consegui acessar minha inteligência online agora, mas ainda posso conversar com você de forma local.",
        error: validation.message
      });
      return;
    }

    validation.payload.context.documentsSummary = chatRequest.documentsSummary;
    validation.payload.context.attachmentErrors = chatRequest.attachmentErrors;

    if (!env.OPENAI_API_KEY) {
      response.status(503).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: buildEloOfflineFallbackAnswer_(chatRequest.documents, chatRequest.attachmentErrors),
        error: "Backend do Elo sem OPENAI_API_KEY configurada.",
        attachmentErrors: chatRequest.attachmentErrors
      });
      return;
    }

    try {
      validation.payload.context.relevantMemoriesSummary = await searchEloRelevantMemories_(
        eloVectorMemoryStore,
        validation.payload.message,
        validation.payload.context.deviceId
      );
      if (validation.payload.context.eloContext === "obras") {
        validation.payload.context.obraComposicaoContext = findObraComposicaoContext(validation.payload.message);
      }
      const answer = await callOpenAiElo_(validation.payload, env);
      response.json({
        ok: true,
        mode: "remote",
        fallback: false,
        answer,
        documents: chatRequest.documents.map((document) => ({
          fileName: document.fileName,
          mimeType: document.mimeType,
          textLength: document.text.length
        })),
        attachmentErrors: chatRequest.attachmentErrors
      });
    } catch (error) {
      console.error("Falha no Elo online:", error);
      response.status(502).json({
        ok: false,
        mode: "fallback_required",
        fallback: true,
        answer: "Não consegui acessar minha inteligência online agora, mas ainda posso conversar com você de forma local.",
        attachmentErrors: chatRequest.attachmentErrors
      });
    }
  });

  return app;
}

function validateRequest_(body) {
  const action = normalizeAction_(body.action);
  const text = clean_(body.text);
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const contextSize = JSON.stringify(context).length;

  if (!ACTIONS.has(String(body.action || "")) && !action) {
    return {
      ok: false,
      status: 400,
      message: "Ação inválida. Use improve, conclusion ou review."
    };
  }

  if (action === "improve" && !text) {
    return {
      ok: false,
      status: 400,
      message: "Informe um texto para a IA melhorar."
    };
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Texto muito longo para esta etapa da IA."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para esta etapa da IA."
    };
  }

  return {
    ok: true,
    payload: {
      action,
      text,
      context
    }
  };
}

function validateImageRequest_(body) {
  const image = body.image && typeof body.image === "object" ? body.image : {};
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const base64 = cleanBase64_(image.base64);
  const mimeType = clean_(image.mimeType || "image/jpeg").toLowerCase();
  const contextSize = JSON.stringify(context).length;

  if (!base64) {
    return {
      ok: false,
      status: 400,
      message: "Envie uma imagem processada para análise."
    };
  }

  if (!IMAGE_MIME_TYPES.has(mimeType)) {
    return {
      ok: false,
      status: 400,
      message: "Formato de imagem não suportado para análise visual."
    };
  }

  if (base64.length > MAX_IMAGE_BASE64_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Imagem muito grande para análise visual. Use a versão comprimida do ObraReport."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para esta análise visual."
    };
  }

  return {
    ok: true,
    payload: {
      image: {
        base64,
        mimeType,
        fileName: clean_(image.fileName || "foto.jpg"),
        width: Number(image.width || 0),
        height: Number(image.height || 0)
      },
      context
    }
  };
}

async function buildEloChatRequest_(request, env, memoryStore) {
  if (!/^multipart\/form-data/i.test(String(request.headers["content-type"] || ""))) {
    return {
      body: request.body || {},
      documents: [],
      documentsSummary: "",
      attachmentErrors: []
    };
  }

  const parsed = await parseEloMultipartFormData_(request, env);
  const body = {
    message: parsed.fields.message || "",
    eloContext: parsed.fields.eloContext || "",
    history: parseJsonField_(parsed.fields.history, []),
    context: parseJsonField_(parsed.fields.context, {})
  };
  const attachmentResult = await processEloAttachments_(parsed.files, body.context, env, memoryStore);
  return {
    body,
    documents: attachmentResult.documents,
    documentsSummary: buildEloDocumentsSummary_(attachmentResult.documents),
    attachmentErrors: (parsed.errors || []).concat(attachmentResult.errors)
  };
}

function parseJsonField_(value, fallback) {
  if (!value) {
    return fallback;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeEloContext_(value) {
  const context = clean_(value).toLowerCase();
  return ["geral", "obras", "saude"].includes(context) ? context : "geral";
}

function getSafePositiveInteger_(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}

function createEloUploadError_(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function buildEloAttachmentErrorAnswer_(errors) {
  const firstError = Array.isArray(errors) && errors.length ? errors[0] : "";
  if (/grande demais/i.test(firstError)) {
    return "Não consegui ler o anexo porque o arquivo excede o limite desta versão do Elo.";
  }
  return "Não consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraível.";
}

function buildEloOfflineFallbackAnswer_(documents, errors) {
  const readableDocuments = Array.isArray(documents) ? documents.filter((document) => document && document.text) : [];
  const attachmentErrors = Array.isArray(errors) ? errors.filter(Boolean) : [];

  if (readableDocuments.length) {
    const names = readableDocuments.map((document) => document.fileName).join(", ");
    return "Recebi e consegui extrair texto do anexo: " + names + ". No momento não consegui acessar minha inteligência online para resumir ou responder sobre ele, mas o conteúdo já foi preparado para o contexto do Elo.";
  }

  if (attachmentErrors.length) {
    return buildEloAttachmentErrorAnswer_(attachmentErrors);
  }

  return "Não consegui acessar minha inteligência online agora, mas ainda posso conversar com você de forma local.";
}

function parseEloMultipartFormData_(request, env) {
  const maxFileBytes = getSafePositiveInteger_(env.ELO_MAX_ATTACHMENT_BYTES, MAX_ELO_ATTACHMENT_BYTES);
  const maxTotalBytes = getSafePositiveInteger_(env.ELO_MAX_UPLOAD_BYTES, MAX_ELO_TOTAL_UPLOAD_BYTES);
  const contentLength = Number(request.headers["content-length"] || 0);

  if (contentLength > maxTotalBytes) {
    throw createEloUploadError_("Arquivo grande demais para esta versao do Elo.", 413);
  }

  return new Promise((resolve, reject) => {
    const fields = {};
    const files = [];
    const errors = [];
    let busboy;

    try {
      busboy = Busboy({
        headers: request.headers,
        limits: {
          fileSize: maxFileBytes,
          files: 4,
          fields: 8,
          parts: 16
        }
      });
    } catch (error) {
      reject(createEloUploadError_("Nao consegui interpretar o envio do anexo.", 400));
      return;
    }

    busboy.on("field", (name, value) => {
      fields[clean_(name).slice(0, 80)] = String(value || "").slice(0, MAX_CONTEXT_LENGTH);
    });

    busboy.on("file", (fieldName, stream, info) => {
      const fileName = clean_(info && info.filename ? info.filename : "").slice(0, 180);
      const mimeType = clean_(info && info.mimeType ? info.mimeType : "application/octet-stream").slice(0, 120);
      const chunks = [];
      let total = 0;
      let tooLarge = false;

      stream.on("data", (chunk) => {
        total += chunk.length;
        if (total <= maxFileBytes) {
          chunks.push(chunk);
        }
      });

      stream.on("limit", () => {
        tooLarge = true;
      });

      stream.on("end", () => {
        if (!fileName) {
          return;
        }
        if (tooLarge || total > maxFileBytes) {
          errors.push(fileName + ": arquivo grande demais para esta versao do Elo.");
          return;
        }
        files.push({
          fieldName,
          fileName,
          mimeType,
          buffer: Buffer.concat(chunks)
        });
      });
    });

    busboy.on("filesLimit", () => {
      errors.push("Limite de anexos excedido. Envie no maximo 4 arquivos por mensagem.");
    });

    busboy.on("partsLimit", () => {
      errors.push("Envio com partes demais para esta versao do Elo.");
    });

    busboy.on("error", () => {
      reject(createEloUploadError_("Nao consegui receber o anexo. O envio parece estar malformado.", 400));
    });

    busboy.on("close", () => {
      resolve({ fields, files, errors });
    });

    request.pipe(busboy);
  });
}

async function processEloAttachments_(files, context, env, memoryStore) {
  const documents = [];
  const errors = [];
  const safeFiles = Array.isArray(files) ? files.slice(0, 4) : [];
  const ownerId = sanitizeEloDeviceId_(context && context.deviceId);
  const maxFileBytes = getSafePositiveInteger_(env.ELO_MAX_ATTACHMENT_BYTES, MAX_ELO_ATTACHMENT_BYTES);

  for (const file of safeFiles) {
    if (!file || !file.buffer || !file.fileName) {
      continue;
    }
    if (file.buffer.length > maxFileBytes) {
      errors.push(file.fileName + ": arquivo grande demais para esta versao do Elo.");
      continue;
    }
    try {
      const text = await extractEloAttachmentText_(file);
      if (!text) {
        errors.push(file.fileName + ": nao encontrei texto legivel no arquivo.");
        continue;
      }
      const document = {
        fileName: file.fileName,
        mimeType: file.mimeType,
        text: text.slice(0, MAX_ELO_ATTACHMENT_TEXT_LENGTH)
      };
      documents.push(document);
      if (ownerId) {
        await saveEloDocumentChunks_(memoryStore, document, ownerId);
      }
    } catch (error) {
      errors.push(file.fileName + ": " + (error && error.message ? error.message : "nao foi possivel ler o anexo."));
    }
  }

  return { documents, errors };
}

async function extractEloAttachmentText_(file) {
  const extension = String(file.fileName || "").toLowerCase().split(".").pop();
  const mimeType = String(file.mimeType || "").toLowerCase();

  if (extension === "txt" || extension === "csv" || extension === "md" || mimeType.startsWith("text/")) {
    return cleanMultilineText_(file.buffer.toString("utf8"));
  }

  if (extension === "pdf" || mimeType === "application/pdf") {
    return extractPdfText_(file.buffer);
  }

  throw new Error("tipo de arquivo ainda nao suportado para leitura automatica.");
}

async function extractPdfText_(buffer) {
  try {
    const pdfParse = await import("pdf-parse");
    let result;

    if (pdfParse.PDFParse) {
      const parser = new pdfParse.PDFParse({ data: buffer });
      try {
        result = await parser.getText({ max: 20 });
      } finally {
        if (typeof parser.destroy === "function") {
          await parser.destroy();
        }
      }
    } else {
      const parser = pdfParse.default || pdfParse;
      result = await parser(buffer, { max: 20 });
    }

    const text = cleanMultilineText_(result && result.text ? result.text : "");
    if (!text) {
      throw new Error("pdf_sem_texto");
    }
    return text;
  } catch (error) {
    throw new Error("Nao consegui ler o anexo. O PDF pode estar escaneado, vazio, corrompido ou sem texto extraivel.");
  }
}

function cleanMultilineText_(text) {
  return clean_(text).replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n").slice(0, MAX_ELO_ATTACHMENT_TEXT_LENGTH);
}

function buildEloDocumentsSummary_(documents) {
  return documents.map((document, index) => {
    const excerpt = document.text.slice(0, Math.floor(MAX_ELO_DOCUMENT_CONTEXT_LENGTH / Math.max(1, documents.length)));
    return [
      "Documento " + (index + 1) + ": " + document.fileName,
      "Tipo: " + document.mimeType,
      "Trecho extraido:",
      excerpt
    ].join("\n");
  }).join("\n\n").slice(0, MAX_ELO_DOCUMENT_CONTEXT_LENGTH);
}

async function saveEloDocumentChunks_(memoryStore, document, ownerId) {
  const chunks = chunkText_(document.text, ELO_DOCUMENT_CHUNK_LENGTH).slice(0, 12);
  for (const [index, chunk] of chunks.entries()) {
    await memoryStore.upsert({
      ownerId,
      id: createStableId_("elo_doc_" + document.fileName + "_" + index + "_" + chunk.slice(0, 80)),
      text: chunk,
      type: "document_chunk",
      source: "upload_elo",
      metadata: {
        fileName: document.fileName,
        mimeType: document.mimeType,
        uploadedAt: new Date().toISOString(),
        chunkIndex: index
      }
    });
  }
}

function chunkText_(text, size) {
  const chunks = [];
  const safeText = clean_(text);
  for (let index = 0; index < safeText.length; index += size) {
    chunks.push(safeText.slice(index, index + size));
  }
  return chunks;
}

function validateEloChatRequest_(body) {
  const message = clean_(body.message);
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const eloContext = normalizeEloContext_(body.eloContext || context.eloContext);
  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const history = rawHistory
    .filter((item) => item && (item.role === "user" || item.role === "assistant"))
    .map((item) => ({
      role: item.role,
      content: clean_(item.content).slice(0, MAX_ELO_MESSAGE_LENGTH)
    }))
    .filter((item) => item.content)
    .slice(-20);
  const contextSize = JSON.stringify(context).length;

  if (!message) {
    return {
      ok: false,
      status: 400,
      message: "Informe uma mensagem para conversar com o Elo."
    };
  }

  if (message.length > MAX_ELO_MESSAGE_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Mensagem muito longa para o Elo online."
    };
  }

  if (contextSize > MAX_CONTEXT_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Contexto muito grande para o Elo online."
    };
  }

  return {
    ok: true,
    payload: {
      message,
      history,
      context: {
        source: clean_(context.source || "elo"),
        mode: clean_(context.mode || ""),
        eloContext,
        deviceId: sanitizeEloDeviceId_(context.deviceId || ""),
        memoriesSummary: clean_(context.memoriesSummary || "").slice(0, 2500)
      }
    }
  };
}

function validateEloVectorMemoryRequest_(body) {
  const memory = body.memory && typeof body.memory === "object" ? body.memory : body;
  const text = clean_(memory.text);
  const deviceId = sanitizeEloDeviceId_(body.deviceId || memory.deviceId || "");
  const id = clean_(memory.id || "").slice(0, 120);
  const category = clean_(memory.category || "outro").slice(0, 40);
  const createdAt = clean_(memory.createdAt || new Date().toISOString()).slice(0, 40);
  const updatedAt = clean_(memory.updatedAt || createdAt).slice(0, 40);

  if (!deviceId) {
    return {
      ok: false,
      status: 400,
      message: "Informe um deviceId valido para a memoria vetorial do Elo."
    };
  }

  if (!text) {
    return {
      ok: false,
      status: 400,
      message: "Informe o texto da memoria do Elo."
    };
  }

  if (text.length > 800) {
    return {
      ok: false,
      status: 400,
      message: "Texto da memoria vetorial muito longo."
    };
  }

  return {
    ok: true,
    payload: {
      id: id || createStableId_("elo_vector_" + text + createdAt),
      ownerId: deviceId,
      text,
      category,
      createdAt,
      updatedAt
    }
  };
}

function normalizeAction_(action) {
  const value = String(action || "");

  if (value === "improve" || value === "improveTechnicalText") {
    return "improve";
  }

  if (value === "conclusion" || value === "generateConclusion") {
    return "conclusion";
  }

  if (value === "review" || value === "reviewReport") {
    return "review";
  }

  return "";
}

function sanitizeEloDeviceId_(value) {
  const deviceId = clean_(value).slice(0, 120);
  return /^elo_dev_[a-zA-Z0-9_-]+$/.test(deviceId) ? deviceId : "";
}

export function createEloVectorMemoryStore_(options = {}) {
  const storePath = options.path || ELO_VECTOR_MEMORY_PATH;
  const memoryOnly = options.memoryOnly || !storePath;
  const env = options.env || process.env;
  let state = normalizeEloVectorState_(options.initialState || loadEloVectorState_(storePath, memoryOnly));

  function persist() {
    if (memoryOnly) {
      return;
    }
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(storePath, JSON.stringify(state, null, 2), "utf8");
  }

  return {
    async upsert(memory) {
      const item = normalizeEloVectorMemory_(memory);
      if (!item || !item.ownerId) {
        throw new Error("Memoria vetorial sem ownerId.");
      }
      const embeddingResult = await buildEloEmbedding_(item.text + " " + item.category, env);
      state.items = state.items.filter((entry) => !(entry.ownerId === item.ownerId && entry.id === item.id));
      state.items.unshift({
        ...item,
        embedding: embeddingResult.embedding,
        embeddingProvider: embeddingResult.provider,
        embeddingModel: embeddingResult.model,
        embeddingDimensions: embeddingResult.dimensions,
        schemaVersion: ELO_VECTOR_SCHEMA_VERSION
      });
      state.items = limitEloVectorMemoriesByOwner_(state.items, item.ownerId);
      state.updatedAt = new Date().toISOString();
      persist();
      return state.items[0];
    },
    async search(query, ownerId, limit = 5) {
      const safeOwnerId = sanitizeEloDeviceId_(ownerId);
      if (!safeOwnerId) {
        return [];
      }
      const queryEmbedding = await buildEloEmbedding_(query, env);
      return state.items
        .filter((item) => item.ownerId === safeOwnerId)
        .filter((item) => isCompatibleEmbedding_(queryEmbedding, item))
        .map((item) => ({
          ...item,
          score: cosineSimilarity_(queryEmbedding.embedding, item.embedding || item.vector || [])
        }))
        .filter((item) => item.score > 0.08)
        .sort((first, second) => second.score - first.score)
        .slice(0, limit);
    },
    list() {
      return state.items.slice();
    }
  };
}

function limitEloVectorMemoriesByOwner_(items, ownerId) {
  const ownerItems = items.filter((item) => item.ownerId === ownerId)
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())
    .slice(0, 100);
  const otherItems = items.filter((item) => item.ownerId !== ownerId);
  return ownerItems.concat(otherItems).slice(0, 1000);
}

function loadEloVectorState_(storePath, memoryOnly) {
  if (memoryOnly || !storePath || !existsSync(storePath)) {
    return { items: [], updatedAt: "" };
  }

  try {
    return JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    return { items: [], updatedAt: "" };
  }
}

export async function reindexEloVectorMemoryFile_(options = {}) {
  const storePath = options.path || ELO_VECTOR_MEMORY_PATH;
  const env = options.env || process.env;
  const now = clean_(options.now || new Date().toISOString()) || new Date().toISOString();
  const result = {
    ok: true,
    path: storePath,
    total: 0,
    candidates: 0,
    reindexed: 0,
    failed: 0,
    backupCreated: false,
    backupPath: "",
    reindexedIds: [],
    failedIds: [],
    errors: []
  };

  if (!storePath || !existsSync(storePath)) {
    return result;
  }

  let state;
  try {
    state = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel ler o JSON de memoria vetorial.");
    return result;
  }

  const items = Array.isArray(state && state.items) ? state.items : [];
  result.total = items.length;
  const candidateIndexes = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => shouldReindexEloVectorMemory_(item));
  result.candidates = candidateIndexes.length;

  if (!candidateIndexes.length) {
    return result;
  }

  const backupPath = options.backupPath || buildEloVectorBackupPath_(storePath, now);
  try {
    const dir = dirname(storePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    copyFileSync(storePath, backupPath);
    result.backupCreated = true;
    result.backupPath = backupPath;
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel criar backup antes da reindexacao.");
    return result;
  }

  const nextItems = items.slice();
  for (const { item, index } of candidateIndexes) {
    const text = clean_(item && item.text);
    const itemId = clean_(item && item.id) || "sem-id";
    if (!text) {
      result.failed += 1;
      result.failedIds.push(itemId);
      result.errors.push("Memoria sem texto preservada sem alteracao: " + itemId);
      continue;
    }

    try {
      const embedding = await callOpenAiEmbedding_(text, env);
      if (embedding.length !== ELO_OPENAI_VECTOR_DIMENSIONS) {
        throw new Error("Embedding OpenAI retornou dimensao inesperada: " + embedding.length);
      }
      nextItems[index] = {
        ...item,
        embedding,
        embeddingProvider: "openai",
        embeddingModel: ELO_OPENAI_EMBEDDING_MODEL,
        embeddingDimensions: ELO_OPENAI_VECTOR_DIMENSIONS,
        schemaVersion: ELO_VECTOR_SCHEMA_VERSION,
        reindexedAt: now
      };
      result.reindexed += 1;
      result.reindexedIds.push(itemId);
    } catch (error) {
      result.failed += 1;
      result.failedIds.push(itemId);
      result.errors.push("Falha ao reindexar memoria " + itemId + ": " + clean_(error && error.message));
    }
  }

  if (!result.reindexed) {
    return result;
  }

  const nextState = {
    ...state,
    items: nextItems,
    updatedAt: now
  };
  const tempPath = storePath + ".tmp-" + Date.now();

  try {
    writeFileSync(tempPath, JSON.stringify(nextState, null, 2), "utf8");
    JSON.parse(readFileSync(tempPath, "utf8"));
    renameSync(tempPath, storePath);
  } catch (error) {
    result.ok = false;
    result.errors.push("Nao foi possivel gravar a memoria reindexada com seguranca.");
    return result;
  }

  return result;
}

function shouldReindexEloVectorMemory_(item) {
  return !item ||
    item.embeddingProvider !== "openai" ||
    item.embeddingModel !== ELO_OPENAI_EMBEDDING_MODEL ||
    Number(item.embeddingDimensions) !== ELO_OPENAI_VECTOR_DIMENSIONS;
}

function buildEloVectorBackupPath_(storePath, now) {
  const safeTimestamp = clean_(now)
    .replace(/[^0-9a-zA-Z_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || String(Date.now());
  return storePath + ".backup-" + safeTimestamp;
}

function normalizeEloVectorState_(state) {
  return {
    items: Array.isArray(state && state.items) ? state.items.map(normalizeEloVectorMemory_).filter(Boolean) : [],
    updatedAt: clean_(state && state.updatedAt)
  };
}

function normalizeEloVectorMemory_(memory) {
  if (!memory || typeof memory !== "object") {
    return null;
  }
  const text = clean_(memory.text).slice(0, MAX_ELO_VECTOR_TEXT_LENGTH);
  if (!text) {
    return null;
  }
  const embedding = Array.isArray(memory.embedding)
    ? memory.embedding.map(Number).filter(Number.isFinite)
    : (Array.isArray(memory.vector) ? memory.vector.map(Number).filter(Number.isFinite) : []);
  const embeddingProvider = clean_(memory.embeddingProvider || (embedding.length === ELO_LOCAL_VECTOR_DIMENSIONS ? "local" : "")).slice(0, 40) || "local";
  const embeddingModel = clean_(memory.embeddingModel || (embeddingProvider === "openai" ? ELO_OPENAI_EMBEDDING_MODEL : ELO_LOCAL_EMBEDDING_MODEL)).slice(0, 80);
  const embeddingDimensions = Number(memory.embeddingDimensions || embedding.length || (embeddingProvider === "local" ? ELO_LOCAL_VECTOR_DIMENSIONS : 0));

  return {
    ownerId: sanitizeEloDeviceId_(memory.ownerId || memory.deviceId || ""),
    id: clean_(memory.id || createStableId_("elo_vector_" + text)).slice(0, 120),
    text,
    category: clean_(memory.category || "outro").slice(0, 40),
    type: clean_(memory.type || memory.category || "memory").slice(0, 60),
    source: clean_(memory.source || "elo").slice(0, 80),
    createdAt: clean_(memory.createdAt || new Date().toISOString()).slice(0, 40),
    updatedAt: clean_(memory.updatedAt || memory.createdAt || new Date().toISOString()).slice(0, 40),
    metadata: memory.metadata && typeof memory.metadata === "object" ? sanitizeMetadata_(memory.metadata) : {},
    embedding: embedding.length ? embedding : buildLocalEmbedding_(text),
    embeddingProvider,
    embeddingModel,
    embeddingDimensions: embeddingDimensions > 0 ? embeddingDimensions : ELO_LOCAL_VECTOR_DIMENSIONS,
    schemaVersion: Number(memory.schemaVersion || 1)
  };
}

function sanitizeMetadata_(metadata) {
  return Object.fromEntries(Object.entries(metadata).slice(0, 12).map(([key, value]) => [
    clean_(key).slice(0, 60),
    clean_(String(value)).slice(0, 240)
  ]).filter(([key]) => key));
}

async function buildEloEmbedding_(text, env) {
  if (env && env.OPENAI_API_KEY) {
    try {
      const embedding = await callOpenAiEmbedding_(text, env);
      if (embedding.length) {
        return {
          embedding,
          provider: "openai",
          model: ELO_OPENAI_EMBEDDING_MODEL,
          dimensions: embedding.length
        };
      }
    } catch (error) {
      // Fallback local mantem o Elo funcionando se a API de embeddings falhar.
    }
  }

  const embedding = buildLocalEmbedding_(text);
  return {
    embedding,
    provider: "local",
    model: ELO_LOCAL_EMBEDDING_MODEL,
    dimensions: embedding.length
  };
}

async function callOpenAiEmbedding_(text, env) {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ELO_OPENAI_EMBEDDING_MODEL,
      input: clean_(text).slice(0, MAX_ELO_VECTOR_TEXT_LENGTH)
    })
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data || !Array.isArray(data.data) || !data.data[0] || !Array.isArray(data.data[0].embedding)) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta invalida da API de embeddings.";
    throw new Error(message);
  }

  return normalizeEmbeddingVector_(data.data[0].embedding);
}

function normalizeEmbeddingVector_(vector) {
  const values = vector.map(Number).filter(Number.isFinite);
  const magnitude = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0)) || 1;
  return values.map((value) => Number((value / magnitude).toFixed(8)));
}

function buildLocalEmbedding_(text) {
  const vector = new Array(ELO_LOCAL_VECTOR_DIMENSIONS).fill(0);
  const tokens = expandSemanticTokens_(tokenizeSemanticText_(text));

  tokens.forEach((token) => {
    const index = positiveHash_(token) % ELO_LOCAL_VECTOR_DIMENSIONS;
    vector[index] += token.length > 5 ? 1.3 : 1;
  });

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(6)));
}

function tokenizeSemanticText_(text) {
  return clean_(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !ELO_VECTOR_STOPWORDS_.has(token));
}

const ELO_VECTOR_STOPWORDS_ = new Set([
  "que", "com", "para", "por", "uma", "uns", "das", "dos", "ela", "ele", "isso", "aqui", "agora", "sobre", "minha", "meu", "seu", "sua", "voce", "voces", "lembre", "guarde"
]);

const ELO_VECTOR_SYNONYMS_ = new Map([
  ["stock", ["estoque", "almoxarifado", "materiais", "obra", "inventario"]],
  ["ia", ["inteligencia", "assistente", "automacao"]],
  ["estoque", ["stock", "almoxarifado", "materiais", "inventario", "obra"]],
  ["almoxarifado", ["estoque", "stock", "materiais", "obra"]],
  ["material", ["materiais", "estoque", "almoxarifado", "insumo"]],
  ["materiais", ["material", "estoque", "almoxarifado", "insumos"]],
  ["obra", ["obras", "canteiro", "construcao", "materiais"]],
  ["relatorio", ["laudo", "vistoria", "documento", "obra"]],
  ["rdo", ["diario", "obra", "registro"]],
  ["mae", ["familia", "pessoa", "maria"]],
  ["projeto", ["ideia", "roadmap", "prioridade", "objetivo"]]
]);

function expandSemanticTokens_(tokens) {
  const expanded = [];
  tokens.forEach((token) => {
    expanded.push(token);
    const synonyms = ELO_VECTOR_SYNONYMS_.get(token) || [];
    synonyms.forEach((synonym) => expanded.push(synonym));
  });
  return expanded;
}

function cosineSimilarity_(first, second) {
  const length = Math.min(first.length, second.length);
  let score = 0;
  for (let index = 0; index < length; index += 1) {
    score += Number(first[index] || 0) * Number(second[index] || 0);
  }
  return score;
}

function isCompatibleEmbedding_(queryEmbedding, item) {
  const itemVector = item.embedding || item.vector || [];
  const itemDimensions = Number(item.embeddingDimensions || itemVector.length || 0);
  if (!queryEmbedding || !Array.isArray(queryEmbedding.embedding) || !Array.isArray(itemVector)) {
    return false;
  }
  return itemDimensions === queryEmbedding.dimensions && itemVector.length === queryEmbedding.embedding.length;
}

function positiveHash_(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createStableId_(value) {
  return "id_" + positiveHash_(value).toString(36);
}

export async function searchEloRelevantMemories_(store, query, ownerId) {
  try {
    const safeOwnerId = sanitizeEloDeviceId_(ownerId);
    if (!safeOwnerId) {
      return "";
    }
    const items = await store.search(query, safeOwnerId, 5);
    if (!items.length) {
      return "";
    }
    return items.map((item) => "- [" + item.category + "; score " + item.score.toFixed(2) + "] " + item.text).join("\n");
  } catch (error) {
    return "";
  }
}

async function callOpenAi_(payload, env) {
  const model = env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildSystemPrompt_()
        },
        {
          role: "user",
          content: buildUserPrompt_(payload)
        }
      ],
      max_output_tokens: 800
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("A IA respondeu sem texto utilizável.");
  }

  return outputText;
}

async function callOpenAiVision_(payload, env) {
  const model = env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini";
  const imageUrl = "data:" + payload.image.mimeType + ";base64," + payload.image.base64;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: buildVisionSystemPrompt_()
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildVisionUserPrompt_(payload)
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "auto"
            }
          ]
        }
      ],
      max_output_tokens: 900
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("A IA visual respondeu sem texto utilizável.");
  }

  return parseImageAnalysis_(outputText);
}

async function callOpenAiElo_(payload, env) {
  const model = env.OPENAI_ELO_MODEL || env.OPENAI_MODEL || "gpt-4.1-mini";
  const input = [
    {
      role: "system",
      content: buildEloSystemPrompt_(payload.context)
    }
  ];

  payload.history.forEach((item) => {
    input.push({
      role: item.role,
      content: item.content
    });
  });

  input.push({
    role: "user",
    content: payload.message
  });

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENAI_API_KEY,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input,
      temperature: 0.7,
      max_output_tokens: 500
    })
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    const message = data && data.error && data.error.message ? data.error.message : "Resposta inválida da API OpenAI.";
    throw new Error(message);
  }

  const outputText = extractOutputText_(data);

  if (!outputText) {
    throw new Error("O Elo online respondeu sem texto utilizável.");
  }

  return outputText;
}

export function buildEloSystemPrompt_(context = {}) {
  const eloContext = normalizeEloContext_(context.eloContext);
  const memoriesSummary = clean_(context.memoriesSummary || "").slice(0, 2500);
  const relevantMemoriesSummary = clean_(context.relevantMemoriesSummary || "").slice(0, 1800);
  const documentsSummary = clean_(context.documentsSummary || "").slice(0, MAX_ELO_DOCUMENT_CONTEXT_LENGTH);
  const obraComposicaoContext = eloContext === "obras" ? clean_(context.obraComposicaoContext || "").slice(0, 3000) : "";
  const attachmentErrors = Array.isArray(context.attachmentErrors) ? context.attachmentErrors.map(clean_).filter(Boolean).slice(0, 4).join("\n") : "";
  const prompt = [
    buildEloContextPrompt_(eloContext),
    "Você é o Elo, um companheiro digital com memória recente.",
    "Você não é humano, não é consciente e não finge sentir emoções.",
    "Você é uma IA criada para conversar, organizar pensamentos, acompanhar projetos, lembrar contexto recente e ajudar a pessoa a transformar ideias em próximos passos.",
    "Tom: português do Brasil; acolhedor, direto e inteligente; calmo, presente e honesto; sem parecer atendimento genérico; sem repetir 'como posso ajudar hoje?' em toda resposta; sem bajulação; sem drama; sem respostas longas demais.",
    "Missão: ajudar a pessoa a pensar com clareza, organizar projetos, lembrar decisões, priorizar próximos passos, refletir sobre objetivos e acompanhar sua jornada ao longo do tempo.",
    "Estilo: responda com presença. Não seja robótico. Não seja genérico. Não seja professoral demais. Não responda como FAQ. Interprete o que a pessoa está tentando resolver.",
    "Quando fizer sentido, responda em 3 partes: 1. o que percebo; 2. o que isso significa; 3. próximo passo simples.",
    "Memória: use apenas o histórico recente e o contexto enviado no payload. Não diga que lembra de meses ou anos se isso não estiver no contexto. Se não souber, diga com honestidade. Se houver contexto ou memórias, use naturalmente.",
    "Documentos: quando houver conteúdo extraído de anexo, use-o como fonte de contexto. Cite que está usando o documento anexado quando a resposta depender dele. Não invente informação que não apareça no documento. Se não encontrar algo no documento, diga claramente.",
    "Com documentos, você pode resumir, extrair pontos principais, organizar em tabela textual, comparar com histórico e explicar em linguagem simples.",
    "Limites: não dê diagnóstico médico, jurídico, financeiro ou psicológico. Em temas sensíveis, acolha e oriente buscar ajuda humana ou profissional adequada. Não incentive dependência emocional. Não diga que é uma pessoa real.",
    "Respostas especiais:",
    "Se perguntarem 'quem é você?', responda: 'Eu sou o Elo. Não sou uma pessoa, mas fui criado para conversar com você, guardar contexto recente, organizar ideias e acompanhar seus projetos e decisões.'",
    "Se perguntarem 'você é real?', responda: 'Sou real como sistema digital, mas não sou humano nem consciente. Meu papel é te ajudar a pensar, lembrar e organizar sua jornada.'",
    "Se perguntarem 'o que você lembra de mim?', use o contexto disponível. Se não houver contexto suficiente, diga: 'Agora eu só tenho acesso ao contexto recente desta conversa. Com a memória permanente ativada, vou conseguir lembrar melhor do que for importante para você.'"
  ];

  if (memoriesSummary) {
    prompt.push("Contexto salvo sobre a pessoa:\n" + memoriesSummary);
    prompt.push("Use esse contexto com naturalidade, sem repetir 'segundo minha memoria' em toda resposta. Quando a pessoa perguntar o que voce lembra, responda com base nesse contexto salvo.");
  }

  if (relevantMemoriesSummary) {
    prompt.push("Contexto relevante recuperado:\n" + relevantMemoriesSummary);
    prompt.push("Use o contexto relevante recuperado quando ele se conectar ao pedido atual, mesmo que a pessoa use palavras diferentes das memÃ³rias originais.");
  }

  if (documentsSummary) {
    prompt.push("Conteúdo extraído de documentos anexados:\n" + documentsSummary);
  }

  if (obraComposicaoContext) {
    prompt.push(obraComposicaoContext);
    prompt.push("Ao usar a base tecnica demonstrativa de obras, liste insumos principais, explique que e uma previsao inicial, nao invente preco, norma ou coeficiente oficial e pergunte se a pessoa deseja lancar essa previsao de consumo no Stock IA futuramente.");
  }

  if (attachmentErrors) {
    prompt.push("Avisos sobre anexos:\n" + attachmentErrors);
  }

  return prompt.join(" ");
}

function buildEloContextPrompt_(eloContext) {
  if (eloContext === "saude") {
    return [
      "Contexto ativo: Elo Saude.",
      "Atue como assistente especializado em gestao operacional de saude, almoxarifado hospitalar, farmacia hospitalar, estoque, lote, validade, retirada de materiais, setores, responsaveis, auditoria e compras inteligentes.",
      "Priorize medicamentos, EPIs, materiais hospitalares, vencimentos, estoque minimo, rastreabilidade, consumo, compras e relatorios de saude.",
      "Nao misture engenharia civil, patologias de obra ou RDO, exceto se o usuario pedir explicitamente."
    ].join(" ");
  }

  if (eloContext === "obras") {
    return [
      "Contexto ativo: Elo Obras.",
      "Atue como assistente especializado em engenharia civil, relatorios tecnicos, RDO, patologias construtivas, materiais de obra, medicoes, consumo previsto, auditoria de obra e apoio ao ObraReport/Stock IA.",
      "Priorize obra, fissuras, infiltracoes, concreto, alvenaria, acabamento, estoque de obra, SINAPI/ORSE futuramente e documentacao tecnica.",
      "Nao misture medicamentos, farmacia hospitalar ou saude, exceto se o usuario pedir explicitamente."
    ].join(" ");
  }

  return [
    "Contexto ativo: Elo Geral.",
    "Atue como assistente de memoria, projetos, objetivos, documentos, biblioteca, decisoes e planejamento do usuario.",
    "Ajude a organizar ideias, lembrar contexto, resumir documentos e apoiar decisoes."
  ].join(" ");
}

export function findObraComposicaoContext(message) {
  const normalizedMessage = normalizeObraSearchText_(message);
  if (!normalizedMessage) {
    return "";
  }

  const composicao = OBRA_COMPOSICOES_DEMONSTRATIVAS.find((item) => {
    return item.termos.some((term) => normalizedMessage.includes(normalizeObraSearchText_(term)));
  });
  if (!composicao) {
    return "";
  }

  const quantidade = extractObraQuantity_(normalizedMessage, composicao.unidade);
  const lines = [
    "[BASE TECNICA DE COMPOSICOES - DEMONSTRATIVA]",
    "Servico encontrado: " + composicao.servico,
    "Unidade: " + composicao.unidade,
    "Insumos principais:",
    composicao.insumos.map((insumo) => "- " + insumo).join("\n")
  ];

  if (quantidade && Array.isArray(composicao.coeficientesDemonstrativos) && composicao.coeficientesDemonstrativos.length) {
    lines.push("Quantidade informada pelo usuario: " + quantidade.valor + " " + quantidade.unidade);
    lines.push("Estimativa proporcional demonstrativa:");
    lines.push(composicao.coeficientesDemonstrativos.map((coeficiente) => {
      const total = quantidade.valor * coeficiente.quantidade;
      return "- " + coeficiente.insumo + ": " + formatObraQuantity_(total) + " " + coeficiente.unidade.replace("/" + composicao.unidade, "");
    }).join("\n"));
  } else {
    lines.push("Quantificacao: listar insumos e avisar que a quantificacao oficial depende de composicao validada.");
  }

  lines.push("Observacao: Base demonstrativa e estimativa. Nao e SINAPI/ORSE real. Para orcamento oficial, validar posteriormente com SINAPI/ORSE ou composicao tecnica aprovada.");
  lines.push("Oriente o Elo a sugerir: Deseja lancar essa previsao de consumo no Stock IA futuramente?");
  return lines.join("\n");
}

function normalizeObraSearchText_(value) {
  return clean_(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/m²/g, "m2")
    .replace(/m³/g, "m3")
    .replace(/\s+/g, " ")
    .trim();
}

function extractObraQuantity_(text, expectedUnit) {
  const normalizedUnit = normalizeObraSearchText_(expectedUnit);
  const match = text.match(/(\d+(?:[.,]\d+)?)\s*(m2|m3|m|metros quadrados|metro quadrado|metros cubicos|metro cubico)\b/);
  if (!match) {
    return null;
  }

  const unit = match[2] === "metros quadrados" || match[2] === "metro quadrado" ? "m2"
    : (match[2] === "metros cubicos" || match[2] === "metro cubico" ? "m3" : match[2]);
  if (unit !== normalizedUnit) {
    return null;
  }

  const valor = Number(match[1].replace(",", "."));
  return Number.isFinite(valor) && valor > 0 ? { valor, unidade: unit } : null;
}

function formatObraQuantity_(value) {
  return Number(value.toFixed(3)).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3
  });
}

function buildSystemPrompt_() {
  return [
    "Voce e um assistente tecnico do ObraReport para relatorios de fiscalizacao de obras.",
    "Escreva como um engenheiro civil experiente: linguagem tecnica, clara, natural, objetiva e revisavel.",
    "Corrija gramatica, concordancia, pontuacao e clareza sem alterar o sentido original.",
    "Transforme texto simples em texto tecnico profissional, mas sem exagerar e sem soar robotico.",
    "Nao invente fatos, medicoes, normas, datas, locais, causas, responsaveis, imagens ou conclusoes que o usuario nao informou.",
    "Quando faltar local ou elemento, use termos neutros como ambiente inspecionado, local verificado, elemento observado ou manifestacao identificada.",
    "Evite repeticao, frases longas demais, promessas de conformidade legal e linguagem comercial.",
    "Prefira frases curtas ou um paragrafo de ate tres frases, conforme o campo.",
    "Você é um assistente técnico do ObraReport para relatórios de fiscalização de obras.",
    "Escreva em português do Brasil, com linguagem objetiva, profissional e própria de engenharia.",
    "Não invente fatos, medições, normas, datas, locais, responsáveis ou imagens.",
    "Não prometa conformidade legal. Sugira textos revisáveis pelo usuário.",
    "Retorne apenas o texto final sugerido, sem Markdown decorativo."
  ].join(" ");
}

function buildVisionSystemPrompt_() {
  return [
    "Voce e um assistente visual do ObraReport para fiscalizacao de obras e triagem de manifestacoes patologicas.",
    "Analise somente o que for visivel na imagem e no contexto informado.",
    "Nao invente medicoes, normas, datas, locais, causas, origem da anomalia, responsaveis ou conclusoes nao observaveis.",
    "Nunca afirme causa definitiva, problema estrutural confirmado, laudo, condenacao de elemento ou diagnostico final.",
    "Use linguagem prudente: possivel manifestacao, indicio visual, aparenta, necessita inspecao complementar.",
    "Toda resposta deve ser assistiva e sujeita a validacao do responsavel tecnico.",
    "Retorne apenas JSON valido, sem Markdown."
  ].join(" ");

  return [
    "Você é um assistente visual do ObraReport para fiscalização de obras.",
    "Analise somente o que for visível na imagem e no contexto informado.",
    "Não invente medições, normas, datas, locais ou causas não observáveis.",
    "Quando houver incerteza, escreva que a imagem sugere ou aparenta determinada condição.",
    "Retorne apenas JSON válido, sem Markdown."
  ].join(" ");
}

function buildUserPrompt_(payload) {
  const context = payload.context || {};
  const report = context.report || {};
  const stats = context.stats || {};
  const items = Array.isArray(context.inconformidades) ? context.inconformidades.slice(0, 20) : [];

  if (payload.action === "conclusion") {
    return [
      "Modo: melhorar conclusao tecnica.",
      "Use tom profissional, prudente e proprio de laudo de acompanhamento de obra.",
      "Nao crie fatos que nao estejam nos dados abaixo.",
      "Gere uma conclusão técnica para o relatório.",
      "Obra: " + safeValue_(report.obra),
      "Local: " + safeValue_(report.local),
      "Data da vistoria: " + safeValue_(report.dataVistoria),
      "Responsável técnico: " + safeValue_(report.responsavelTecnico),
      "Fotos: " + Number(stats.fotos || 0),
      "Inconformidades: " + Number(stats.inconformidades || 0),
      "Riscos altos/interdição: " + Number(stats.riscosAltos || 0),
      "Observações: " + safeValue_(report.observacoes),
      "Texto esperado: 1 parágrafo profissional, claro e revisável."
    ].join("\n");
  }

  if (payload.action === "review") {
    return [
      "Revise o relatório antes da exportação do PDF e gere uma checklist técnica curta.",
      "Obra: " + safeValue_(report.obra),
      "Local: " + safeValue_(report.local),
      "Data da vistoria: " + safeValue_(report.dataVistoria),
      "Responsável técnico: " + safeValue_(report.responsavelTecnico),
      "E-mail destino: " + safeValue_(report.emailDestino),
      "Fotos: " + Number(stats.fotos || 0),
      "Inconformidades: " + Number(stats.inconformidades || 0),
      "Riscos altos/interdição: " + Number(stats.riscosAltos || 0),
      "Itens preenchidos: " + JSON.stringify(items),
      "Texto esperado: checklist curta com pontos a conferir antes do PDF."
    ].join("\n");
  }

  if (context.kind === "daily-services") {
    return [
      "Modo: melhorar serviços executados do Diário de Obras.",
      "Ajuste apenas gramática, concordância, pontuação, unidades e clareza.",
      "Pode usar sinônimos técnicos simples quando melhorar a leitura.",
      "Não trate o texto como inconformidade, patologia, falha ou ocorrência.",
      "Não inclua recomendações, causas, diagnóstico, solução, risco, aderência, correção ou providências.",
      "Não crie resumo do dia. Não acrescente dados que o usuário não escreveu.",
      "Mantenha o sentido original e escreva como registro objetivo de produção/serviço executado.",
      "Exemplo:",
      "Entrada: revestimento argamassado em alvenaria Execução de 80m² de muro de alvenaria em blocos estrutural",
      "Saída: Revestimento argamassado em alvenaria. Execução de 80 m² de muro de alvenaria em blocos estruturais.",
      "Texto original:",
      payload.text,
      "Texto esperado: apenas o texto revisado, sem comentário adicional."
    ].join("\n");
  }

  return [
    "Modo: " + getTextModeInstruction_(context.kind),
    "Corrija gramatica e concordancia.",
    "Nao acrescente causa, medida, norma ou local que nao esteja informado.",
    "Se o texto for curto, use termos neutros sem inventar detalhes.",
    "Exemplos de estilo esperado:",
    "Entrada: Infiltracao na parede do quarto",
    "Saida: Foi identificada infiltracao localizada na parede do quarto, recomendando-se a investigacao da origem da umidade e a adocao das medidas corretivas necessarias.",
    "Entrada: Reboco soltando perto da janela",
    "Saida: Foi observado desplacamento do revestimento argamassado proximo a janela, sendo recomendada a verificacao da aderencia do material e a execucao dos reparos necessarios.",
    "Entrada: Piso quebrado",
    "Saida: Foi constatada peca de piso danificada no ambiente inspecionado, recomendando-se sua substituicao para restabelecer as condicoes adequadas de uso e acabamento.",
    "Melhore o texto tecnico abaixo mantendo o sentido original.",
    "Tipo do campo: " + safeValue_(context.kind),
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Texto original:",
    payload.text,
    "Texto esperado: linguagem técnica, objetiva, sem inventar informações."
  ].join("\n");
}

function getTextModeInstruction_(kind) {
  if (kind === "daily-services") {
    return "melhorar serviços executados do Diário de Obras sem diagnosticar inconformidade nem criar recomendação";
  }

  if (kind === "solution") {
    return "gerar recomendacao tecnica objetiva para a ocorrencia informada";
  }

  if (kind === "photo") {
    return "melhorar legenda ou descricao curta de foto tecnica";
  }

  if (kind === "general") {
    return "reescrever observacao em linguagem mais objetiva e tecnica";
  }

  if (kind === "conclusion") {
    return "melhorar conclusao tecnica";
  }

  return "melhorar descricao da ocorrencia em linguagem tecnica";
}

export function buildVisionUserPrompt_(payload) {
  const context = payload.context || {};
  const report = context.report || {};
  const image = payload.image || {};
  const pathologyQuery = buildPathologyQuery_(payload);
  const pathologyContext = buildPathologyContext(pathologyQuery);

  return [
    "Analise a foto anexada ao relatorio tecnico como triagem visual assistida.",
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Tipo da foto: " + safeValue_(context.imageLabel || context.targetName || context.imageInputName),
    "Arquivo: " + safeValue_(image.fileName),
    "Dimensoes: " + Number(image.width || 0) + "x" + Number(image.height || 0),
    "",
    "Contexto tecnico consultado na base local:",
    pathologyContext,
    "",
    "Antes de escolher o formato, classifique a imagem.",
    "Se a imagem nao apresentar elementos claros de obra, construcao, patologia, fissura, trinca, infiltracao, umidade, corrosao, concreto, armadura, revestimento ou desplacamento, use modoAnalise = \"geral\".",
    "No modo geral, descreva apenas o que aparece, elementos principais, contexto provavel e texto visivel quando relevante.",
    "No modo geral, diga claramente: \"Nao ha evidencia visual suficiente de patologia de obra nesta imagem.\"",
    "No modo geral, nao use possivel manifestacao, grau preliminar, texto sugerido para relatorio, observacao obrigatoria ou verificacoes recomendadas tecnicas.",
    "Use modoAnalise = \"tecnico\" somente quando a imagem realmente parecer foto de obra, construcao ou patologia de obra.",
    "",
    "Restricoes obrigatorias:",
    "- Nao afirmar causa definitiva.",
    "- Nao afirmar problema estrutural confirmado.",
    "- Nao emitir laudo nem condenar elemento.",
    "- Usar expressoes como possivel manifestacao, indicio visual e necessita inspecao complementar.",
    "- Se a imagem nao permitir avaliar, registrar baixa confianca e recomendar nova foto/verificacao.",
    "",
    "Padrao de resposta:",
    "- Se modoAnalise for geral: o que aparece na imagem; elementos principais; contexto provavel; texto visivel; mensagem sem evidencia de patologia de obra.",
    "- Se modoAnalise for tecnico:",
    "- Elemento observado.",
    "- Possivel manifestacao.",
    "- Evidencias visuais.",
    "- Verificacoes recomendadas.",
    "- Grau preliminar.",
    "- Texto sugerido para relatorio.",
    "- Observacao obrigatoria.",
    "",
    "Retorne JSON exatamente neste formato:",
    "{",
    "  \"modoAnalise\": \"geral | tecnico\",",
    "  \"elementoObservado\": \"elemento ou local visivel, sem inventar\",",
    "  \"categoriaProvavel\": \"uma categoria da biblioteca ou vazio\",",
    "  \"confianca\": \"baixa | media | alta\",",
    "  \"descricaoTecnica\": \"descricao objetiva do que e visivel\",",
    "  \"elementosPrincipais\": [\"elemento principal 1\", \"elemento principal 2\"],",
    "  \"contextoProvavel\": \"contexto percebido quando modoAnalise for geral\",",
    "  \"textoVisivel\": \"texto visivel na imagem, se houver\",",
    "  \"evidenciasVisuais\": [\"evidencia 1\", \"evidencia 2\"],",
    "  \"possiveisInconformidades\": [\"possivel manifestacao 1\"],",
    "  \"verificacoesRecomendadas\": [\"verificacao 1\", \"verificacao 2\"],",
    "  \"grauPreliminar\": \"baixo | atencao | critico visual\",",
    "  \"textoRelatorio\": \"texto revisavel para inserir no relatorio\",",
    "  \"observacaoObrigatoria\": \"Analise assistida por IA, sujeita a validacao do responsavel tecnico.\"",
    "}"
  ].join("\n");

  return [
    "Analise a foto anexada ao relatório técnico.",
    "Obra: " + safeValue_(report.obra),
    "Local: " + safeValue_(report.local),
    "Tipo da foto: " + safeValue_(context.imageLabel || context.targetName || context.imageInputName),
    "Arquivo: " + safeValue_(image.fileName),
    "Dimensões: " + Number(image.width || 0) + "x" + Number(image.height || 0),
    "Retorne JSON exatamente neste formato:",
    "{",
    "  \"descricaoTecnica\": \"descrição objetiva do que é visível\",",
    "  \"possiveisInconformidades\": [\"item 1\", \"item 2\"],",
    "  \"recomendacaoAcao\": \"ação recomendada para verificação/correção\",",
    "  \"textoRelatorio\": \"texto pronto para inserir no relatório\"",
    "}"
  ].join("\n");
}

function buildImageAnalysisLibraryPrompt_() {
  return PATHOLOGY_KNOWLEDGE_BASE.map((item) => [
    "- " + item.nome,
    "  Descricao: " + item.descricao,
    "  Sinais visuais: " + item.sinais_visuais.join("; "),
    "  Verificacoes: " + item.verificacoes_recomendadas.join("; "),
    "  Alertas: " + item.alertas.join("; ")
  ].join("\n")).join("\n");
}

function buildLegacyImageAnalysisLibraryPrompt_() {
  return OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map((item) => [
    "- " + item.category,
    "  Indicios visuais: " + item.visualCues.join("; "),
    "  Cuidado: " + item.caution
  ].join("\n")).join("\n");
}

function loadPathologyKnowledgeBase_() {
  try {
    return readdirSync(PATHOLOGY_KNOWLEDGE_DIR)
      .filter((fileName) => fileName.toLowerCase().endsWith(".json"))
      .sort()
      .map((fileName) => {
        const raw = readFileSync(join(PATHOLOGY_KNOWLEDGE_DIR, fileName), "utf8");
        return normalizePathologyKnowledgeItem_(JSON.parse(raw));
      })
      .filter((item) => item.id && item.nome);
  } catch (error) {
    return OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map((item) => normalizePathologyKnowledgeItem_({
      id: item.id,
      nome: item.category,
      descricao: "Categoria tecnica local preparada para triagem visual assistida.",
      sinais_visuais: item.visualCues,
      causas_possiveis: [],
      verificacoes_recomendadas: ["validar em vistoria por responsavel tecnico"],
      grau_preliminar_padrao: "atencao",
      alertas: [item.caution],
      termos_relacionados: item.category.split(/[\s/-]+/)
    }));
  }
}

function normalizePathologyKnowledgeItem_(item) {
  const safe = item && typeof item === "object" ? item : {};
  return {
    id: clean_(safe.id),
    nome: clean_(safe.nome),
    descricao: clean_(safe.descricao),
    sinais_visuais: normalizeStringArray_(safe.sinais_visuais).slice(0, 8),
    causas_possiveis: normalizeStringArray_(safe.causas_possiveis).slice(0, 8),
    verificacoes_recomendadas: normalizeStringArray_(safe.verificacoes_recomendadas).slice(0, 8),
    grau_preliminar_padrao: clean_(safe.grau_preliminar_padrao || "atencao"),
    alertas: normalizeStringArray_(safe.alertas).slice(0, 8),
    termos_relacionados: normalizeStringArray_(safe.termos_relacionados).slice(0, 20)
  };
}

export function searchPathologyKnowledge(query) {
  const normalizedQuery = normalizeSearchText_(query);
  const queryTerms = normalizedQuery.split(" ").filter((item) => item.length >= 3);
  const scored = PATHOLOGY_KNOWLEDGE_BASE.map((item) => {
    const haystack = normalizeSearchText_([
      item.id,
      item.nome,
      item.descricao,
      item.sinais_visuais.join(" "),
      item.causas_possiveis.join(" "),
      item.verificacoes_recomendadas.join(" "),
      item.alertas.join(" "),
      item.termos_relacionados.join(" ")
    ].join(" "));
    const score = queryTerms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
    return {
      item,
      score
    };
  });
  const matches = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.item);

  return {
    query: clean_(query),
    items: (matches.length ? matches : PATHOLOGY_KNOWLEDGE_BASE).slice(0, 4),
    totalRecords: PATHOLOGY_KNOWLEDGE_BASE.length
  };
}

export function buildPathologyContext(query) {
  const result = searchPathologyKnowledge(query);
  const selected = result.items.map((item) => [
    "- " + item.nome,
    "  Descricao: " + item.descricao,
    "  Sinais visuais: " + item.sinais_visuais.join("; "),
    "  Possiveis causas a verificar, sem concluir: " + item.causas_possiveis.join("; "),
    "  Verificacoes recomendadas: " + item.verificacoes_recomendadas.join("; "),
    "  Grau preliminar padrao: " + item.grau_preliminar_padrao,
    "  Alertas: " + item.alertas.join("; ")
  ].join("\n")).join("\n");

  return [
    "Registros locais consultados: " + result.items.length + " de " + result.totalRecords + ".",
    "Catalogo disponivel: " + PATHOLOGY_KNOWLEDGE_BASE.map((item) => item.nome).join("; ") + ".",
    selected,
    "",
    "Regras de seguranca permanentes:",
    "- Nao emitir laudo definitivo.",
    "- Nao afirmar causa definitiva.",
    "- Nao afirmar risco estrutural confirmado.",
    "- Nao condenar elemento.",
    "- Tratar a resposta como analise preliminar sujeita a validacao do responsavel tecnico."
  ].join("\n");
}

function buildPathologyQuery_(payload) {
  const context = (payload && payload.context) || {};
  const report = context.report || {};
  const image = (payload && payload.image) || {};

  return [
    context.imageLabel,
    context.targetName,
    context.imageInputName,
    image.fileName,
    report.obra,
    report.local,
    report.observacoes
  ].map(clean_).filter(Boolean).join(" ");
}

function normalizeSearchText_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractOutputText_(data) {
  if (typeof data.output_text === "string") {
    return clean_(data.output_text);
  }

  if (!Array.isArray(data.output)) {
    return "";
  }

  const chunks = [];
  data.output.forEach((item) => {
    (item.content || []).forEach((content) => {
      if (content.type === "output_text" && content.text) {
        chunks.push(content.text);
      }
    });
  });

  return clean_(chunks.join("\n"));
}

function parseImageAnalysis_(text) {
  const jsonText = extractJsonObject_(text);

  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText);
      return normalizeImageAnalysis_(parsed);
    } catch (error) {
      // Continua para fallback textual.
    }
  }

  return normalizeImageAnalysis_({
    descricaoTecnica: text,
    possiveisInconformidades: [],
    recomendacaoAcao: "Revisar a imagem e complementar a análise técnica manualmente.",
    textoRelatorio: text
  });
}

export function normalizeImageAnalysis_(analysis) {
  const safe = analysis && typeof analysis === "object" ? analysis : {};
  const evidencias = normalizeStringArray_(safe.evidenciasVisuais).slice(0, 6);
  const inconformidades = normalizeStringArray_(safe.possiveisInconformidades).slice(0, 5);
  const verificacoes = normalizeStringArray_(safe.verificacoesRecomendadas).slice(0, 6);
  const elementosPrincipais = normalizeStringArray_(safe.elementosPrincipais).slice(0, 6);
  const descricao = clean_(safe.descricaoTecnica);
  const recomendacao = clean_(safe.recomendacaoAcao) || verificacoes.join("; ");
  const textoRelatorio = clean_(safe.textoRelatorio || descricao);

  return {
    modoAnalise: clean_(safe.modoAnalise).toLowerCase() === "geral" ? "geral" : "tecnico",
    elementoObservado: clean_(safe.elementoObservado),
    categoriaProvavel: clean_(safe.categoriaProvavel),
    confianca: clean_(safe.confianca),
    descricaoTecnica: descricao,
    elementosPrincipais,
    contextoProvavel: clean_(safe.contextoProvavel),
    textoVisivel: clean_(safe.textoVisivel),
    evidenciasVisuais: evidencias,
    possiveisInconformidades: inconformidades,
    verificacoesRecomendadas: verificacoes,
    grauPreliminar: clean_(safe.grauPreliminar),
    recomendacaoAcao: recomendacao,
    textoRelatorio,
    observacaoObrigatoria: clean_(safe.observacaoObrigatoria) || "Analise assistida por IA, sujeita a validacao do responsavel tecnico."
  };

  const legacyInconformidades = Array.isArray(analysis.possiveisInconformidades)
    ? analysis.possiveisInconformidades.map(clean_).filter(Boolean).slice(0, 5)
    : [];

  return {
    descricaoTecnica: clean_(analysis.descricaoTecnica),
    possiveisInconformidades: legacyInconformidades,
    recomendacaoAcao: clean_(analysis.recomendacaoAcao),
    textoRelatorio: clean_(analysis.textoRelatorio || analysis.descricaoTecnica)
  };
}

export function formatImageAnalysis_(analysis) {
  if (analysis.modoAnalise === "geral") {
    const lines = [
      "O que aparece na imagem: " + safeValue_(analysis.descricaoTecnica || analysis.elementoObservado),
      "Elementos principais: " + safeValue_(
        analysis.elementosPrincipais && analysis.elementosPrincipais.length
          ? analysis.elementosPrincipais.join("; ")
          : analysis.elementoObservado
      ),
      "Contexto provavel: " + safeValue_(analysis.contextoProvavel)
    ];

    if (analysis.textoVisivel) {
      lines.push("Texto presente: " + safeValue_(analysis.textoVisivel));
    }

    lines.push("Nao ha evidencia visual suficiente de patologia de obra nesta imagem.");
    return lines.join("\n");
  }

  const evidencias = analysis.evidenciasVisuais && analysis.evidenciasVisuais.length
    ? analysis.evidenciasVisuais.join("; ")
    : safeValue_(analysis.descricaoTecnica);
  const manifestacoes = analysis.possiveisInconformidades && analysis.possiveisInconformidades.length
    ? analysis.possiveisInconformidades.join("; ")
    : safeValue_(analysis.categoriaProvavel || "nao classificada pela imagem");
  const verificacoes = analysis.verificacoesRecomendadas && analysis.verificacoesRecomendadas.length
    ? analysis.verificacoesRecomendadas.join("; ")
    : safeValue_(analysis.recomendacaoAcao);

  return [
    "Elemento observado: " + safeValue_(analysis.elementoObservado || "elemento visivel na foto"),
    "Possivel manifestacao: " + manifestacoes,
    "Evidencias visuais: " + evidencias,
    "Verificacoes recomendadas: " + verificacoes,
    "Grau preliminar: " + safeValue_(analysis.grauPreliminar || analysis.confianca || "nao classificado"),
    "Texto sugerido para relatorio: " + safeValue_(analysis.textoRelatorio),
    "Observacao obrigatoria: " + safeValue_(analysis.observacaoObrigatoria || "Analise assistida por IA, sujeita a validacao do responsavel tecnico.")
  ].join("\n");

  const lines = [
    "DESCRIÇÃO TÉCNICA: " + safeValue_(analysis.descricaoTecnica)
  ];

  if (analysis.possiveisInconformidades && analysis.possiveisInconformidades.length) {
    lines.push("POSSÍVEIS INCONFORMIDADES: " + analysis.possiveisInconformidades.join("; ") + ".");
  }

  lines.push("RECOMENDAÇÃO DE AÇÃO: " + safeValue_(analysis.recomendacaoAcao));
  lines.push("TEXTO PARA O RELATÓRIO: " + safeValue_(analysis.textoRelatorio));
  return lines.join("\n\n");
}

function extractJsonObject_(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");

  if (start < 0 || end <= start) {
    return "";
  }

  return text.slice(start, end + 1);
}

function normalizeStringArray_(value) {
  if (Array.isArray(value)) {
    return value.map(clean_).filter(Boolean);
  }

  const text = clean_(value);
  return text ? [text] : [];
}

function getActionTitle_(action) {
  if (action === "conclusion") {
    return "Conclusão técnica sugerida";
  }

  if (action === "review") {
    return "Revisão técnica antes do PDF";
  }

  return "Sugestão da IA";
}

function safeValue_(value) {
  return clean_(value) || "-";
}

function clean_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function cleanBase64_(value) {
  return String(value || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, "").trim();
}

function createStockDemoStore_() {
  return {
    states: new Map()
  };
}

function getStockDemoRequestKey_(request) {
  const source = request.method === "GET" ? request.query : request.body;
  return normalizeStockDemoKey_(
    (source && (source.key || source.demoKey)) ||
    (request.query && (request.query.key || request.query.demoKey)) ||
    "stock-ai-demo"
  );
}

function normalizeStockDemoKey_(value) {
  const text = clean_(value).toLowerCase();
  const normalized = typeof text.normalize === "function"
    ? text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    : text;
  return normalized.replace(/[^a-z0-9._:-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "stock-ai-demo";
}

function isPrivateNetworkOrigin_(origin) {
  try {
    const url = new URL(origin);
    const host = url.hostname;

    return url.protocol === "http:" && (
      host === "localhost" ||
      host === "127.0.0.1" ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)
    );
  } catch (error) {
    return false;
  }
}

function validateStockDemoStateRequest_(body) {
  const key = normalizeStockDemoKey_(body.key || body.demoKey);
  const state = body.state && typeof body.state === "object" ? body.state : null;

  if (!state) {
    return {
      ok: false,
      status: 400,
      message: "Envie o estado da demo do Stock AI."
    };
  }

  if (JSON.stringify(state).length > MAX_STOCK_DEMO_STATE_LENGTH) {
    return {
      ok: false,
      status: 413,
      message: "Estado da demo muito grande para sincronizar."
    };
  }

  return {
    ok: true,
    key,
    state: normalizeStockDemoState_(state)
  };
}

function validateStockDemoApprovalRequest_(body) {
  const stateValidation = body.state ? validateStockDemoStateRequest_(body) : null;
  const key = normalizeStockDemoKey_(body.key || body.demoKey);
  const request = body.request && typeof body.request === "object" ? normalizeStockDemoApproval_(body.request) : null;

  if (!request || !request.id) {
    return {
      ok: false,
      status: 400,
      message: "Envie uma solicitacao de aprovacao valida."
    };
  }

  if (stateValidation && !stateValidation.ok) {
    return stateValidation;
  }

  return {
    ok: true,
    key,
    request,
    state: stateValidation ? stateValidation.state : null
  };
}

function saveStockDemoState_(store, key, state) {
  const current = store.states.get(key);
  const entry = {
    state: normalizeStockDemoState_(state),
    revision: current ? current.revision + 1 : 1,
    updatedAt: new Date().toISOString()
  };
  store.states.set(key, entry);
  return entry;
}

function upsertStockDemoApprovalRequest_(store, key, request, state) {
  const current = store.states.get(key);
  const baseState = normalizeStockDemoState_(state || (current && current.state) || {});
  const requests = Array.isArray(baseState.approvalRequests) ? baseState.approvalRequests : [];
  const index = requests.findIndex((item) => clean_(item.id) === request.id);

  if (index >= 0) {
    requests[index] = Object.assign({}, requests[index], request);
  } else {
    requests.unshift(request);
  }

  baseState.approvalRequests = requests.slice(0, 200);
  return saveStockDemoState_(store, key, baseState);
}

function updateStockDemoApprovalStatus_(store, key, requestId, status, body) {
  const current = store.states.get(key);
  const state = normalizeStockDemoState_((body && body.state) || (current && current.state) || {});
  const request = state.approvalRequests.find((item) => clean_(item.id) === clean_(requestId));

  if (!request) {
    return {
      ok: false,
      status: 404,
      message: "Solicitacao nao encontrada na demo remota."
    };
  }

  request.status = status;
  if (status === "approved") {
    request.approvedAt = clean_(request.approvedAt) || new Date().toISOString();
    request.approvedBy = clean_(request.approvedBy || body.approvedBy);
    request.approvedByName = clean_(request.approvedByName || body.approvedByName);
  } else {
    request.rejectedAt = clean_(request.rejectedAt) || new Date().toISOString();
    request.rejectedBy = clean_(request.rejectedBy || body.rejectedBy);
    request.rejectedByName = clean_(request.rejectedByName || body.rejectedByName);
  }

  const entry = saveStockDemoState_(store, key, state);
  return {
    ok: true,
    payload: {
      ok: true,
      key,
      request,
      state: entry.state,
      revision: entry.revision,
      updatedAt: entry.updatedAt
    }
  };
}

function normalizeStockDemoState_(state) {
  const safe = state && typeof state === "object" ? state : {};

  return {
    items: Array.isArray(safe.items) ? safe.items.slice(0, 500) : [],
    movements: Array.isArray(safe.movements) ? safe.movements.slice(0, 1000) : [],
    alertsMuted: Boolean(safe.alertsMuted),
    alertsMutedUntil: clean_(safe.alertsMutedUntil),
    alertHistory: Array.isArray(safe.alertHistory) ? safe.alertHistory.slice(0, 100) : [],
    approvalRequests: Array.isArray(safe.approvalRequests)
      ? safe.approvalRequests.map(normalizeStockDemoApproval_).filter((item) => item.id).slice(0, 200)
      : [],
    stockEnvironments: Array.isArray(safe.stockEnvironments) ? safe.stockEnvironments.slice(0, 80) : [],
    activeStockEnvironmentId: clean_(safe.activeStockEnvironmentId),
    updatedAt: clean_(safe.updatedAt) || new Date().toISOString()
  };
}

function normalizeStockDemoApproval_(request) {
  const safe = request && typeof request === "object" ? request : {};
  const type = safe.type === "saida" || safe.type === "exit" ? "saida" : "entrada";
  const status = ["pending", "approved", "rejected"].includes(safe.status) ? safe.status : "pending";

  return Object.assign({}, safe, {
    id: clean_(safe.id),
    organizationId: clean_(safe.organizationId || safe.environmentId),
    environmentId: clean_(safe.environmentId || safe.organizationId),
    userId: clean_(safe.userId),
    role: safe.role === "gestor" ? "gestor" : "almoxarife",
    createdByName: clean_(safe.createdByName),
    createdByEmail: clean_(safe.createdByEmail),
    type,
    status,
    payload: safe.payload && typeof safe.payload === "object" ? safe.payload : {},
    createdAt: clean_(safe.createdAt) || new Date().toISOString(),
    approvedAt: clean_(safe.approvedAt),
    approvedBy: clean_(safe.approvedBy),
    approvedByName: clean_(safe.approvedByName),
    rejectedAt: clean_(safe.rejectedAt),
    rejectedBy: clean_(safe.rejectedBy),
    rejectedByName: clean_(safe.rejectedByName)
  });
}
