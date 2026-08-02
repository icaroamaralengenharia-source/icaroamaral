import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mergeOpportunities, updateOpportunities } from "../scripts/atualizar-conteudo-noticias.mjs";

async function readText(path) {
  return readFile(path, "utf8");
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

test("aba padrao e Dicas", async () => {
  const html = await readText("noticias/index.html");
  assert.match(html, /id="tab-dicas"[\s\S]*aria-selected="true"/);
  assert.match(html, /id="panel-dicas"[\s\S]*data-panel="dicas"/);
});

test("hash correto e Dicas sem hash", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /window\.location\.hash\.replace\("#", ""\) \|\| "dicas"/);
  assert.match(js, /#\$\{safeTab\}/);
});

test("teclado nas abas", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /ArrowRight/);
  assert.match(js, /ArrowLeft/);
  assert.match(js, /Home/);
  assert.match(js, /End/);
});

test("dica revisada aparece e dica nao revisada fica marcada para ocultar", async () => {
  const dicas = await readJson("noticias/dados/dicas.json");
  assert.equal(dicas.dicas.some((item) => item.revisadoManualmente === true), true);
  assert.equal(dicas.dicas.some((item) => item.revisadoManualmente === false), true);
  const js = await readText("noticias/noticias.js");
  assert.match(js, /revisadoManualmente === true/);
});

test("aviso tecnico presente", async () => {
  const dicas = await readJson("noticias/dados/dicas.json");
  assert.equal(dicas.dicas.every((item) => String(item.avisoTecnico || "").includes("Conteúdo informativo")), true);
});

test("URL insegura bloqueada e sem APIs HTML perigosas", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /protocol === "http:"/);
  assert.match(js, /protocol === "https:"/);
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|iframe/i);
});

test("imagens de noticias e fallback preservados", async () => {
  const noticias = await readJson("noticias/dados/noticias.json");
  const css = await readText("noticias/noticias.css");
  assert.equal(noticias.noticias.some((item) => item.imagemUrl), true);
  assert.match(css, /card-cover[\s\S]*linear-gradient/);
  assert.match(css, /card-cover img/);
});

test("oportunidade sem prazo nao inventa prazo", () => {
  const payload = mergeOpportunities({ oportunidades: [] }, [{ id: "1", titulo: "Licitação de engenharia", oportunidadeUrl: "https://pncp.gov.br/app/editais/1", fonteUrl: "https://pncp.gov.br/", fonte: "PNCP", tipo: "licitação", status: "aberta", dataPublicacao: "2026-08-01T00:00:00.000Z" }], new Date("2026-08-02T00:00:00.000Z"));
  assert.equal(payload.oportunidades[0].dataLimite || "", "");
});

test("oportunidade encerrada oculta no frontend", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /normalizeText\(item\.status\) === "encerrada"/);
  assert.match(js, /state\.oportunidades\.filter\(opportunityOpen\)/);
});

test("remuneracao e valor nao sao inventados", () => {
  const payload = mergeOpportunities({ oportunidades: [] }, [{ id: "1", titulo: "Curso oficial", oportunidadeUrl: "https://pncp.gov.br/app/editais/curso", fonteUrl: "https://pncp.gov.br/", fonte: "PNCP", tipo: "curso", status: "aberta", dataPublicacao: "2026-08-01T00:00:00.000Z" }], new Date("2026-08-02T00:00:00.000Z"));
  assert.equal(payload.oportunidades[0].remuneracao || "", "");
  assert.equal(payload.oportunidades[0].valorEstimado || "", "");
});

test("deduplicacao de oportunidades por URL e titulo", () => {
  const payload = mergeOpportunities({ oportunidades: [] }, [
    { id: "1", titulo: "Licitação engenharia", oportunidadeUrl: "https://pncp.gov.br/a", fonteUrl: "https://pncp.gov.br/", fonte: "PNCP", dataPublicacao: "2026-08-01" },
    { id: "2", titulo: "Licitação engenharia", oportunidadeUrl: "https://pncp.gov.br/b", fonteUrl: "https://pncp.gov.br/", fonte: "PNCP", dataPublicacao: "2026-08-01" },
    { id: "3", titulo: "Outra licitação", oportunidadeUrl: "https://pncp.gov.br/a", fonteUrl: "https://pncp.gov.br/", fonte: "PNCP", dataPublicacao: "2026-08-01" },
  ]);
  assert.equal(payload.oportunidades.length, 1);
});

test("falha nao apaga JSON", async () => {
  const result = await updateOpportunities({ dryRun: true, fetchImpl: async () => { throw new Error("falha"); }, now: new Date("2026-08-02T00:00:00.000Z") });
  assert.equal(result.ok, false);
  assert.equal(Array.isArray(result.payload.oportunidades), true);
});

test("erro isolado por aba", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /async function loadDicas\(\)[\s\S]*catch/);
  assert.match(js, /async function loadNoticias\(\)[\s\S]*catch/);
  assert.match(js, /async function loadOportunidades\(\)[\s\S]*catch/);
});

test("cron horario e workflow limitado aos dois JSON", async () => {
  const workflow = await readText(".github/workflows/atualizar-noticias.yml");
  assert.match(workflow, /cron: "17 \* \* \* \*"/);
  assert.match(workflow, /noticias\/dados\/noticias\.json/);
  assert.match(workflow, /noticias\/dados\/oportunidades\.json/);
  assert.doesNotMatch(workflow, /git add noticias\/dados\/dicas\.json/);
});

test("dicas fora da automacao", async () => {
  const script = await readText("scripts/atualizar-conteudo-noticias.mjs");
  assert.match(script, /dicas\.json preservado/);
  assert.doesNotMatch(script, /writeFile\([^\n]*dicas/i);
});

test("hero sem min-height e filtros compactos", async () => {
  const css = await readText("noticias/noticias.css");
  assert.doesNotMatch(css, /content-hero[\s\S]{0,160}min-height/);
  assert.match(css, /content-hero[\s\S]{0,120}padding: 24px 0 16px/);
  assert.match(css, /content-tab[\s\S]{0,160}min-height: 40px/);
  assert.match(css, /min-height: 40px/);
});

test("cards com altura natural e layout 3 2 1", async () => {
  const css = await readText("noticias/noticias.css");
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: 1fr/);
  assert.doesNotMatch(css, /grid-auto-rows:\s*1fr/);
  assert.doesNotMatch(css, /\.content-card[\\s\\S]{0,160}height:\s*100%/);
  assert.match(css, /align-items: start/);
});

test("cards visiveis na primeira tela", async () => {
  const css = await readText("noticias/noticias.css");
  const html = await readText("noticias/index.html");
  assert.match(css, /content-hero[\s\S]{0,120}padding: 24px 0 16px/);
  assert.match(html, /<section id="lista-dicas"/);
});

test("quantidade de dicas iniciais respeita requisito", async () => {
  const dicas = await readJson("noticias/dados/dicas.json");
  const reviewed = dicas.dicas.filter((item) => item.revisadoManualmente === true).length;
  const drafts = dicas.dicas.filter((item) => item.revisadoManualmente !== true).length;
  assert.equal(dicas.dicas.length >= 12 && dicas.dicas.length <= 20, true);
  assert.equal(reviewed >= 3, true);
  assert.equal(drafts > reviewed, true);
});