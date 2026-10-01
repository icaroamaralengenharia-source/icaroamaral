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

test("central publica exibe somente Dicas e Hunter Licitacoes", async () => {
  const html = await readText("noticias/index.html");
  assert.match(html, /id="tab-dicas"/);
  assert.match(html, /id="tab-licitacoes"/);
  assert.doesNotMatch(html, /id="tab-noticias"|id="panel-noticias"|data-tab="noticias"|data-panel="noticias"/);
  assert.doesNotMatch(html, /id="tab-oportunidades"|id="panel-oportunidades"|data-tab="oportunidades"|data-panel="oportunidades"/);
  assert.doesNotMatch(html, /Notícias|Trabalho e Oportunidades|notícias atualizadas|vagas|emprego/i);
});

test("dropdown publico tem somente Dicas e Hunter Licitacoes", async () => {
  const html = await readText("noticias/index.html");
  const select = html.match(/<select id="seletor-assunto"[\s\S]*?<\/select>/)?.[0] || "";
  assert.match(select, /value="dicas"/);
  assert.match(select, /value="licitacoes"/);
  assert.doesNotMatch(select, /value="noticias"|value="oportunidades"/);
});

test("hash correto e Dicas sem hash", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /window\.location\.hash\.replace\("#", ""\) \|\| "dicas"/);
  assert.match(js, /const allowed = \["dicas", "licitacoes"\]/);
  assert.match(js, /#\$\{safeTab\}/);
});

test("contador principal soma somente conteudo publico", async () => {
  const js = await readText("noticias/noticias.js");
  assert.match(js, /const total = reviewed \+ openBids/);
  assert.doesNotMatch(js, /const total = reviewed \+ state\.noticias\.length/);
  assert.match(js, /loadDicas\(\);\s*loadLicitacoes\(\);/);
  assert.doesNotMatch(js, /loadDicas\(\);\s*loadNoticias\(\);/);
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
  assert.equal(dicas.dicas.every((item) => String(item.avisoTecnico || "").trim().length > 0), true);
  assert.equal(dicas.dicas.every((item) => String(item.avisoTecnico || "").includes("Consulte normas, projeto executivo e profissional habilitado")), true);
});
test("dicas preservam acentos no texto visivel e ids tecnicos sem acento", async () => {
  const dicas = await readJson("noticias/dados/dicas.json");
  const visibleText = dicas.dicas.map((item) => [
    item.titulo,
    item.categoria,
    item.resumo,
    item.conteudo,
    item.avisoTecnico,
    item.imagemAlt,
    ...(item.tags || []),
  ].filter(Boolean).join(" ")).join("\n");

  assert.match(visibleText, /Compatibilização/);
  assert.match(visibleText, /Informação/);
  assert.match(visibleText, /Conteúdo orientativo/);
  assert.match(visibleText, /orientativo/);
  assert.match(visibleText, /desníveis/);
  assert.match(visibleText, /Meça/);
  assert.match(visibleText, /instalações/);
  assert.match(visibleText, /orçamento/);
  assert.match(visibleText, /fiscalização/);
  assert.doesNotMatch(visibleText, /Computabilizacao|Compatibilizacao|Informacao|Conteudo|desn\?veis|Me\?a|inspe\?\?|pagina\?\?|infiltra\?\?|�/);

  const compat = dicas.dicas.find((item) => item.id === "dica-compatibilizacao-digital");
  assert.equal(compat.titulo, "Compatibilização digital antes da obra");
  assert.equal(compat.id, "dica-compatibilizacao-digital");

  const js = await readText("noticias/noticias.js");
  assert.match(js, /appendText\(body, "h3", item\.titulo/);
  assert.match(js, /const text = normalizeText\(\[item\.titulo, item\.resumo, item\.conteudo, item\.categoria/);
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
  const reviewed = dicas.dicas.filter((item) => item.revisadoManualmente === true);
  const drafts = dicas.dicas.filter((item) => item.revisadoManualmente !== true);
  const categories = new Map();
  for (const item of reviewed) {
    categories.set(item.categoria, (categories.get(item.categoria) || 0) + 1);
  }
  assert.equal(reviewed.length, 50);
  assert.equal(drafts.length, 7);
  assert.equal(categories.size, 10);
  assert.deepEqual([...categories.values()].sort((a, b) => a - b), Array(10).fill(5));
});
