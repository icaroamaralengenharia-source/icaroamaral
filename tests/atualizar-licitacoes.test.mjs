import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildPublicationUrl,
  classifyItem,
  collectPncp,
  dedupeLicitacoes,
  deterministicId,
  fetchJsonLimited,
  isOpenProcess,
  isSafeHttpUrl,
  parseRetryAfter,
  pncpHeaders,
  retryDelayMs,
  normalizePncpItem,
  PNCP_ENDPOINT,
  sortLicitacoes,
  thematicMatch,
  updateLicitacoes,
} from "../scripts/atualizar-licitacoes.mjs";

const now = new Date("2026-08-03T12:00:00.000Z");

function pncpItem(overrides = {}) {
  return {
    numeroControlePNCP: "12345678000199-1-000001/2026",
    anoCompra: 2026,
    sequencialCompra: 1,
    numeroCompra: "1",
    processo: "10/2026",
    objetoCompra: "Contratacao de empresa de engenharia para fiscalizacao de obra publica",
    orgaoEntidade: { cnpj: "12345678000199", razaoSocial: "Municipio Teste" },
    unidadeOrgao: { nomeUnidade: "Secretaria de Obras", municipioNome: "Salvador", ufSigla: "BA" },
    modalidadeNome: "Concorrencia - Eletronica",
    valorTotalEstimado: 120000,
    dataPublicacaoPncp: "2026-08-01T10:00:00",
    dataAberturaProposta: "2026-08-02T10:00:00",
    dataEncerramentoProposta: "2026-08-20T10:00:00",
    situacaoCompraNome: "Divulgada no PNCP",
    ...overrides,
  };
}

function response(body, { status = 200, contentType = "application/json", retryAfter = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => { const key = String(name).toLowerCase(); if (key === "content-type") return contentType; if (key === "retry-after") return retryAfter; return null; } },
    async text() { return typeof body === "string" ? body : JSON.stringify(body); },
  };
}

test("resposta PNCP normalizada", () => {
  const item = normalizePncpItem(pncpItem(), { now });
  assert.equal(item.fonte, "PNCP");
  assert.equal(item.estado, "BA");
  assert.equal(item.categoria, "Fiscalizacao");
  assert.equal(item.valorEstimado, 120000);
});

test("rejeicao sem identificador ou URL", () => {
  const item = normalizePncpItem(pncpItem({ numeroControlePNCP: "", orgaoEntidade: {}, anoCompra: null, sequencialCompra: null }), { now });
  assert.equal(item, null);
});

test("rejeicao de javascript", () => {
  assert.equal(isSafeHttpUrl("javascript:alert(1)"), false);
});

test("aceitacao HTTPS", () => {
  assert.equal(isSafeHttpUrl("https://pncp.gov.br/app/editais/1"), true);
});

test("filtro engenharia", () => {
  assert.equal(thematicMatch(pncpItem({ objetoCompra: "Obra de engenharia civil" })).accepted, true);
});

test("filtro arquitetura", () => {
  assert.equal(classifyItem(pncpItem({ objetoCompra: "Projeto de arquitetura e urbanismo" })), "Arquitetura");
});

test("filtro laudo/pericia", () => {
  assert.equal(classifyItem(pncpItem({ objetoCompra: "Laudo tecnico e pericia predial" })), "Laudos e Pericias");
});

test("filtro fiscalizacao", () => {
  assert.equal(classifyItem(pncpItem({ objetoCompra: "Fiscalizacao de obra" })), "Fiscalizacao");
});

test("filtro tecnologia", () => {
  assert.equal(thematicMatch(pncpItem({ objetoCompra: "Automacao e dashboard de gestao digital" })).groups.includes("tecnologia"), true);
});

test("filtro SaaS", () => {
  assert.equal(classifyItem(pncpItem({ objetoCompra: "Licenciamento de software SaaS e sistema web" })), "SaaS e Sistemas");
});

test("rejeicao de tema incompativel", () => {
  assert.equal(thematicMatch(pncpItem({ objetoCompra: "Aquisicao de medicamentos e alimentacao escolar" })).accepted, false);
});

test("prazo encerrado", () => {
  assert.equal(isOpenProcess(pncpItem({ dataEncerramentoProposta: "2026-07-01T10:00:00" }), now), false);
});

test("prazo nao informado aceita publicacao recente", () => {
  assert.equal(isOpenProcess(pncpItem({ dataEncerramentoProposta: null }), now), true);
});

test("data futura invalida", () => {
  assert.equal(isOpenProcess(pncpItem({ dataEncerramentoProposta: "2035-01-01T00:00:00" }), now), false);
});

test("deduplicacao por ID", () => {
  const a = normalizePncpItem(pncpItem(), { now });
  const b = { ...a, titulo: "Outro titulo" };
  assert.equal(dedupeLicitacoes([a, b]).items.length, 1);
});

test("deduplicacao por URL", () => {
  const a = normalizePncpItem(pncpItem(), { now });
  const b = { ...a, id: "outro", numeroCompra: "2", titulo: "Titulo diferente" };
  assert.equal(dedupeLicitacoes([a, b]).items.length, 1);
});

test("deduplicacao por compra", () => {
  const a = normalizePncpItem(pncpItem(), { now });
  const b = { ...a, id: "outro", oportunidadeUrl: "https://pncp.gov.br/app/editais/x/y/z" };
  assert.equal(dedupeLicitacoes([a, b]).items.length, 1);
});

test("ID deterministico", () => {
  assert.equal(deterministicId("a", "b"), deterministicId("a", "b"));
});

test("ordenacao por prazo", () => {
  const items = [
    { dataLimite: "2026-08-20T00:00:00Z" },
    { dataLimite: "2026-08-05T00:00:00Z" },
  ];
  assert.equal(sortLicitacoes(items)[0].dataLimite, "2026-08-05T00:00:00Z");
});

test("preservacao do JSON anterior", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "licitacoes-"));
  const file = path.join(dir, "licitacoes.json");
  await writeFile(file, JSON.stringify({ atualizadoEm: "x", fonte: "PNCP", total: 1, licitacoes: [{ id: "old" }] }));
  const result = await updateLicitacoes({ outputPath: file, fetchImpl: async () => { throw new Error("falha"); }, now });
  assert.equal(result.ok, false);
  assert.equal(result.payload.licitacoes[0].id, "old");
  await rm(dir, { recursive: true, force: true });
});

test("limite de paginas", async () => {
  let calls = 0;
  await collectPncp({ now, maxPages: 3, modalidades: [4, 6], sleepImpl: async () => {}, fetchImpl: async () => { calls += 1; return response({ data: [pncpItem()], paginasRestantes: 10 }); } });
  assert.equal(calls, 3);
});

test("limite final", async () => {
  const many = Array.from({ length: 120 }, (_, index) => pncpItem({ numeroControlePNCP: `id-${index}`, sequencialCompra: index + 1, numeroCompra: String(index + 1), objetoCompra: `Obra de engenharia civil ${index}` }));
  const result = await collectPncp({ now, maxPages: 1, maxResults: 10, modalidades: [4], sleepImpl: async () => {}, fetchImpl: async () => response({ data: many, paginasRestantes: 0 }) });
  assert.equal(result.payload.licitacoes.length, 10);
});

test("valor ausente nao inventado", () => {
  const item = normalizePncpItem(pncpItem({ valorTotalEstimado: null }), { now });
  assert.equal(item.valorEstimado, null);
  assert.equal(item.moeda, null);
});

test("cidade ausente nao inventada", () => {
  const item = normalizePncpItem(pncpItem({ unidadeOrgao: { ufSigla: "BA", nomeUnidade: "Unidade" } }), { now });
  assert.equal(item.cidade, null);
});

test("URL segura no frontend", async () => {
  const js = await readFile("noticias/noticias.js", "utf8");
  assert.match(js, /isSafeHttpUrl\(item\.oportunidadeUrl\)/);
});

test("ausencia de APIs HTML perigosas", async () => {
  const js = await readFile("noticias/noticias.js", "utf8");
  assert.doesNotMatch(js, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function|iframe/i);
});

test("cron correto", async () => {
  const workflow = await readFile(".github/workflows/atualizar-licitacoes.yml", "utf8");
  assert.match(workflow, /cron: "0 11,19 \* \* \*"/);
});

test("workflow limitado ao JSON de licitacoes", async () => {
  const workflow = await readFile(".github/workflows/atualizar-licitacoes.yml", "utf8");
  assert.match(workflow, /git add noticias\/dados\/licitacoes\.json/);
  assert.doesNotMatch(workflow, /git add \./);
  assert.doesNotMatch(workflow, /noticias\/dados\/dicas\.json/);
});

test("endpoint oficial montado com parametros obrigatorios", () => {
  const url = buildPublicationUrl({ dataInicial: "20260727", dataFinal: "20260803", codigoModalidadeContratacao: 4, pagina: 1 });
  assert.equal(url.startsWith(PNCP_ENDPOINT), true);
  assert.match(url, /dataInicial=20260727/);
  assert.match(url, /codigoModalidadeContratacao=4/);
});



test("headers conservadores do PNCP", () => {
  assert.deepEqual(pncpHeaders(), {
    Accept: "application/json",
    "User-Agent": "Amaral-Hunter-Licitacoes/1.0 (+https://www.icaroamaral.com.br/)",
    "Cache-Control": "no-cache",
  });
});

test("Retry-After em segundos", () => {
  assert.equal(parseRetryAfter("2"), 2000);
});

test("backoff exponencial sem Retry-After", () => {
  assert.equal(retryDelayMs({ attempt: 2, retryAfter: null, baseMs: 100 }), 400);
});

test("429 seguido de 200", async () => {
  const sleeps = [];
  let calls = 0;
  const result = await fetchJsonLimited("https://pncp.gov.br/teste", {
    httpsImpl: null,
    sleepImpl: async (ms) => sleeps.push(ms),
    fetchImpl: async () => {
      calls += 1;
      return calls === 1 ? response("limite", { status: 429, contentType: "text/html", retryAfter: "1" }) : response({ data: [pncpItem()], paginasRestantes: 0 });
    },
  });
  assert.equal(calls, 2);
  assert.equal(sleeps[0], 1000);
  assert.equal(result.data.length, 1);
});

test("limite de tentativas", async () => {
  let calls = 0;
  await assert.rejects(fetchJsonLimited("https://pncp.gov.br/teste", {
    attempts: 3,
    httpsImpl: null,
    sleepImpl: async () => {},
    fetchImpl: async () => { calls += 1; return response("limite", { status: 429, contentType: "text/html" }); },
  }), /PNCP HTTP 429/);
  assert.equal(calls, 3);
});

test("fallback HTTPS nativo apos 429 do fetch", async () => {
  let httpsCalls = 0;
  const result = await fetchJsonLimited("https://pncp.gov.br/teste", {
    attempts: 1,
    sleepImpl: async () => {},
    fetchImpl: async () => response("limite", { status: 429, contentType: "text/html" }),
    httpsImpl: async () => { httpsCalls += 1; return { data: [pncpItem()], paginasRestantes: 0 }; },
  });
  assert.equal(httpsCalls, 1);
  assert.equal(result.data.length, 1);
});

test("paginacao sequencial sem concorrencia", async () => {
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  await collectPncp({
    now,
    maxPages: 3,
    modalidades: [4],
    sleepImpl: async () => {},
    fetchImpl: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return response({ data: [pncpItem({ numeroControlePNCP: 'seq-' + calls, sequencialCompra: calls, numeroCompra: String(calls), objetoCompra: 'Obra de engenharia ' + calls })], paginasRestantes: calls < 3 ? 1 : 0 });
    },
  });
  assert.equal(calls, 3);
  assert.equal(maxActive, 1);
});

test("preservacao do JSON anterior em 429", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "licitacoes-429-"));
  const file = path.join(dir, "licitacoes.json");
  await writeFile(file, JSON.stringify({ atualizadoEm: "x", fonte: "PNCP", total: 1, licitacoes: [{ id: "old" }] }));
  const result = await updateLicitacoes({ outputPath: file, now, fetchImpl: async () => response("limite", { status: 429, contentType: "text/html" }), fetchOptions: { attempts: 1, httpsImpl: null, sleepImpl: async () => {} } });
  assert.equal(result.ok, false);
  assert.equal(result.payload.licitacoes[0].id, "old");
  await rm(dir, { recursive: true, force: true });
});

test("Content-Type invalido", async () => {
  await assert.rejects(fetchJsonLimited("https://pncp.gov.br/teste", {
    httpsImpl: null,
    fetchImpl: async () => response("<html></html>", { status: 200, contentType: "text/html" }),
  }), /content-type/);
});

test("HTTP 200 com JSON valido", async () => {
  const result = await fetchJsonLimited("https://pncp.gov.br/teste", {
    fetchImpl: async () => response({ data: [pncpItem()], paginasRestantes: 0 }),
  });
  assert.equal(result.data.length, 1);
});
