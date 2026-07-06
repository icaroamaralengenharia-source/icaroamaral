import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const frontendSource = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js"), "utf8");
const assistantSource = readFileSync(join(repoRoot, "relatorio-qualidade-obras", "ai-assistant.js"), "utf8");
const appsScriptSource = readFileSync(join(repoRoot, "apps-script-versionado", "Code.gs"), "utf8");

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
