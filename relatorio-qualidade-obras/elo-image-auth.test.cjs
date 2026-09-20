const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SOURCE_PATH = path.join(__dirname, "ai-assistant.js");
const SOURCE = fs.readFileSync(SOURCE_PATH, "utf8");

function loadAssistant({ token = "valid-token", response }) {
  const calls = [];
  const context = {
    console,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return response;
    },
    window: {
      RELATORIO_QUALIDADE_CONFIG: { aiImageAnalysisUrl: "https://backend.test/api/ai/analyze-image" },
      EloCanonicalSession: {
        getAccessToken: () => token
      }
    }
  };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: "ai-assistant.js" });
  return { assistant: context.window.ObraReportAI, calls };
}

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function image() {
  return { base64: "aGVsbG8=", mimeType: "image/png", fileName: "canary.png", width: 2, height: 2 };
}

test("T1: imagem com sessão envia Authorization Bearer e contexto", async () => {
  const { assistant, calls } = loadAssistant({
    response: jsonResponse(200, { ok: true, suggestion: "CODIGO_IMG_3568", analysis: {} })
  });

  await assistant.analyzeImage(image(), { source: "elo", question: "leia" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers.Authorization, "Bearer valid-token");
  assert.equal(JSON.parse(calls[0].options.body).context.source, "elo");
});

test("T2: sem sessão não faz chamada anônima", async () => {
  const { assistant, calls } = loadAssistant({
    token: "",
    response: jsonResponse(200, { ok: true, suggestion: "não deveria chamar" })
  });

  const result = await assistant.analyzeImage(image(), { source: "elo" });

  assert.equal(calls.length, 0);
  assert.equal(result.mode, "auth_required");
  assert.equal(result.authRequired, true);
});

test("T3: HTTP 401 é classificado como erro de autenticação", async () => {
  const { assistant, calls } = loadAssistant({
    response: jsonResponse(401, { ok: false, error: "authentication_required" })
  });

  const result = await assistant.analyzeImage(image(), { source: "elo" });

  assert.equal(calls[0].options.headers.Authorization, "Bearer valid-token");
  assert.equal(result.mode, "auth_error");
  assert.equal(result.authRequired, true);
  assert.notEqual(result.title, "IA visual indisponivel");
});

test("T4: HTTP 200 preserva a resposta visual", async () => {
  const { assistant } = loadAssistant({
    response: jsonResponse(200, { ok: true, suggestion: "CODIGO_IMG_3568", analysis: {} })
  });

  const result = await assistant.analyzeImage(image(), { source: "elo" });

  assert.equal(result.mode, "remote");
  assert.match(result.suggestion, /CODIGO_IMG_3568/);
});

test("T5: transporte atual usa JSON e não injeta multipart Content-Type manual", async () => {
  const { assistant, calls } = loadAssistant({
    response: jsonResponse(200, { ok: true, suggestion: "ok", analysis: {} })
  });

  await assistant.analyzeImage(image(), { source: "elo" });

  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(typeof calls[0].options.body, "string");
  assert.equal(calls[0].options.headers["Content-Type"].includes("multipart"), false);
});
