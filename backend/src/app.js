import cors from "cors";
import express from "express";

const MAX_TEXT_LENGTH = 6000;
const MAX_CONTEXT_LENGTH = 16000;
const MAX_IMAGE_BASE64_LENGTH = 2200000;
const IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const ACTIONS = new Set([
  "improve",
  "conclusion",
  "review",
  "improveTechnicalText",
  "generateConclusion",
  "reviewReport"
]);

export function createApp(options = {}) {
  const app = express();
  const env = options.env || process.env;

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowed = String(env.AI_ALLOWED_ORIGINS || "http://127.0.0.1:5500,http://localhost:5500")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      callback(null, allowed.includes(origin));
    }
  }));
  app.use(express.json({ limit: env.AI_JSON_LIMIT || "3mb" }));

  app.get("/api/health", (request, response) => {
    response.json({
      ok: true,
      service: "ObraReport AI Backend"
    });
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

async function callOpenAi_(payload, env) {
  const model = env.OPENAI_MODEL || "gpt-5.4-mini";
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
  const model = env.OPENAI_VISION_MODEL || env.OPENAI_MODEL || "gpt-5.4-mini";
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

function buildVisionUserPrompt_(payload) {
  const context = payload.context || {};
  const report = context.report || {};
  const image = payload.image || {};

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

function normalizeImageAnalysis_(analysis) {
  const inconformidades = Array.isArray(analysis.possiveisInconformidades)
    ? analysis.possiveisInconformidades.map(clean_).filter(Boolean).slice(0, 5)
    : [];

  return {
    descricaoTecnica: clean_(analysis.descricaoTecnica),
    possiveisInconformidades: inconformidades,
    recomendacaoAcao: clean_(analysis.recomendacaoAcao),
    textoRelatorio: clean_(analysis.textoRelatorio || analysis.descricaoTecnica)
  };
}

function formatImageAnalysis_(analysis) {
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
