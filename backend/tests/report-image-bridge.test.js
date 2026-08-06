import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const frontendSource = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
const assistantSource = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "ai-assistant.js"), "utf8");
const appsScriptSource = readFileSync(join(repoRoot, "apps-script-versionado", "Code.gs"), "utf8");
function loadVisualAssistant(fetchImpl) {
  const warnings = [];
  const sandbox = {
    window: {
      RELATORIO_QUALIDADE_CONFIG: {
        aiImageAnalysisUrl: "https://backend.test/api/ai/analyze-image"
      },
      console: {
        warn(...args) {
          warnings.push(args);
        }
      }
    },
    fetch: fetchImpl
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(assistantSource, sandbox, { filename: "ai-assistant.js" });
  return { assistant: sandbox.window.ObraReportAI, warnings };
}

test("ponte foto IA mostra botao apenas com analise estruturada", () => {
  assert.match(frontendSource, /Aplicar an.lise nos campos/);
  assert.match(frontendSource, /dataset\.aiApplyStructured = "true"/);
  assert.match(frontendSource, /button\.hidden = !\(activeAiTarget && activeAiTarget\.canApplyStructured\)/);
  assert.match(frontendSource, /Boolean\(structured && imageInputName\.indexOf\("fotoInconformidade"\) === 0\)/);
});

test("ponte foto IA guarda analise estruturada no registro da imagem", () => {
  assert.match(frontendSource, /record\.analysis = structured/);
  assert.match(frontendSource, /record\.analysisSuggestion = result && result\.suggestion/);
  assert.match(frontendSource, /record\.analysisUpdatedAt = new Date\(\)\.toISOString\(\)/);
  assert.match(frontendSource, /imageCache\.set\(imageInputName, record\)/);
});

test("ponte foto IA aplica campos reais da inconformidade sem inventar ids", () => {
  assert.match(frontendSource, /descricaoInconformidade" \+ number/);
  assert.match(frontendSource, /solucaoInconformidade" \+ number/);
  assert.match(frontendSource, /grauRisco" \+ number/);
  assert.match(frontendSource, /form\.elements\.observacoes/);
  assert.doesNotMatch(frontendSource, /localizacaoInconformidade|categoriaInconformidade|manifestacaoInconformidade/);
});

test("ponte foto IA nao sobrescreve texto existente sem controle", () => {
  assert.match(frontendSource, /window\.confirm\(/);
  assert.match(frontendSource, /ja tem conteudo\. Deseja anexar/);
  assert.match(frontendSource, /ja esta preenchido\. Deseja substituir/);
  assert.match(frontendSource, /--- Analise preliminar da IA, a confirmar em vistoria ---/);
});

test("ponte foto IA mantem linguagem preliminar e revisavel", () => {
  assert.match(frontendSource, /ensurePreliminaryLanguage_/);
  assert.match(frontendSource, /Analise preliminar:.*confirmar em vistoria/);
  assert.match(frontendSource, /An.lise aplicada como rascunho\. Revise antes de emitir o relat.rio\./);
  assert.doesNotMatch(frontendSource, /causa definitiva|diagnostico final|concluiu a causa/i);
});

test("assistente visual sem chave continua com fallback sem quebrar fluxo", () => {
  assert.match(assistantSource, /buildLocalImageFallback_/);
  assert.match(assistantSource, /analysis: null/);
  assert.match(assistantSource, /O backend de IA visual n.+o respondeu/);
});

test("pdf continua recebendo os campos preenchidos normalmente", () => {
  assert.match(frontendSource, /descricaoTecnica: descricao/);
  assert.match(frontendSource, /solucaoRecomendada: solucao/);
  assert.match(frontendSource, /grauRisco: grauRisco/);
  assert.match(appsScriptSource, /item\.descricaoTecnica/);
  assert.match(appsScriptSource, /item\.solucaoRecomendada/);
  assert.match(appsScriptSource, /item\.grauRisco/);
});

test("assistente visual do Elo troca Failed to fetch por mensagem amigavel", async () => {
  const { assistant, warnings } = loadVisualAssistant(async () => {
    throw new TypeError("Failed to fetch");
  });

  const result = await assistant.analyzeImage({
    base64: "BASE64_TESTE",
    mimeType: "image/jpeg",
    fileName: "foto.jpg"
  }, { source: "elo" });
  const visible = [result.title, result.suggestion, result.note].join("\n");

  assert.equal(result.mode, "error");
  assert.equal(result.analysis, null);
  assert.match(visible, /N.o consegui acessar o servi.o de an.lise visual agora\. Tente novamente em alguns instantes\./);
  assert.doesNotMatch(visible, /Failed to fetch|BASE64_TESTE|token|stack/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].type, "network");
  assert.doesNotMatch(JSON.stringify(warnings), /BASE64_TESTE/);
});

test("assistente visual do Elo nao expoe corpo bruto de erro HTTP", async () => {
  const { assistant, warnings } = loadVisualAssistant(async () => ({
    ok: false,
    status: 500,
    async json() {
      return { error: "<html>stack token segredo interno</html>" };
    }
  }));

  const result = await assistant.analyzeImage({
    base64: "BASE64_TESTE",
    mimeType: "image/jpeg",
    fileName: "foto.jpg"
  }, { source: "elo" });
  const visible = [result.title, result.suggestion, result.note].join("\n");

  assert.equal(result.mode, "error");
  assert.equal(result.analysis, null);
  assert.match(visible, /N.o consegui concluir a an.lise visual agora\. Tente novamente em alguns instantes\./);
  assert.doesNotMatch(visible, /<html>|stack|token|segredo|BASE64_TESTE/i);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][1].type, "http");
  assert.equal(warnings[0][1].status, 500);
  assert.doesNotMatch(JSON.stringify(warnings), /BASE64_TESTE|segredo interno/);
});