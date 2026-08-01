import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import {
  assertAllowedWrite,
  deterministicId,
  mergeWithExisting,
  normalizeItems,
  parseFeed,
  passesEditorialFilter,
  stripHtml,
  summarize,
  updateNews,
} from "../scripts/atualizar-noticias.mjs";

const now = new Date("2026-08-01T12:00:00.000Z");
const source = { nome: "Fonte Teste", url: "https://fonte.example/feed.xml" };

const rssFixture = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <item>
    <title>Obras públicas de saneamento avançam no estado</title>
    <link>https://fonte.example/noticia-1</link>
    <description><![CDATA[<p>Projeto de engenharia civil amplia saneamento básico.</p>]]></description>
    <pubDate>Fri, 31 Jul 2026 10:00:00 -0300</pubDate>
    <category>Infraestrutura</category>
  </item>
</channel></rss>`;

const atomFixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Jornada BIM capacita equipes de arquitetura</title>
    <link href="https://fonte.example/atom-1" />
    <summary>Capacitação em BIM para obras públicas.</summary>
    <updated>2026-07-30T10:00:00Z</updated>
    <category>Inovação</category>
  </entry>
</feed>`;

function item(overrides = {}) {
  return {
    titulo: "Engenharia civil reforça fiscalização de obras públicas",
    url: "https://fonte.example/base",
    resumo: "Fiscalização técnica em obras públicas com foco em engenharia civil.",
    publicadoEm: "2026-07-31T10:00:00Z",
    fonte: "Fonte Teste",
    categoriasOriginais: ["Engenharia"],
    ...overrides,
  };
}

test("lê RSS", () => {
  const items = parseFeed(rssFixture, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, "Obras públicas de saneamento avançam no estado");
  assert.equal(items[0].url, "https://fonte.example/noticia-1");
});

test("lê Atom", () => {
  const items = parseFeed(atomFixture, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, "Jornada BIM capacita equipes de arquitetura");
  assert.equal(items[0].url, "https://fonte.example/atom-1");
});

test("remove HTML", () => {
  assert.equal(stripHtml("<p>Texto <strong>seguro</strong></p><script>alert(1)</script>"), "Texto seguro");
});

test("rejeita javascript:", () => {
  const result = normalizeItems([item({ url: "javascript:alert(1)" })], now);
  assert.equal(result.items.length, 0);
});

test("aplica filtro temático", () => {
  assert.equal(passesEditorialFilter(item()), true);
  assert.equal(passesEditorialFilter(item({ titulo: "Celebridade vence reality show", resumo: "Entretenimento sem relação técnica." })), false);
});

test("remove duplicados por URL", () => {
  const result = normalizeItems([
    item({ titulo: "Engenharia civil fiscaliza obras públicas", url: "https://fonte.example/a" }),
    item({ titulo: "Construção civil recebe nova norma", url: "https://fonte.example/a" }),
  ], now);
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicates, 1);
});

test("remove duplicados por título", () => {
  const result = normalizeItems([
    item({ titulo: "Fiscalização de obras públicas avança", url: "https://fonte.example/a" }),
    item({ titulo: "Fiscalização de obras públicas avança", url: "https://fonte.example/b" }),
  ], now);
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicates, 1);
});

test("limita resumo a 300 caracteres", () => {
  const summary = summarize(`Construção civil ${"planejamento ".repeat(60)}`);
  assert.ok(summary.length <= 300);
});

test("ordena por data", () => {
  const normalized = normalizeItems([
    item({ titulo: "Obra antiga de engenharia", url: "https://fonte.example/a", publicadoEm: "2026-07-20T10:00:00Z" }),
    item({ titulo: "Obra recente de engenharia", url: "https://fonte.example/b", publicadoEm: "2026-07-31T10:00:00Z" }),
  ], now);
  const payload = mergeWithExisting({ noticias: [] }, normalized.items, now);
  assert.equal(payload.noticias[0].titulo, "Obra recente de engenharia");
});

test("preserva JSON anterior quando todas as fontes falham", async () => {
  const result = await updateNews({
    dryRun: true,
    now,
    fetchImpl: async () => {
      throw new Error("falha simulada");
    },
  });
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.payload.noticias));
});

test("rejeita notícia antiga", () => {
  const result = normalizeItems([item({ publicadoEm: "2026-06-01T10:00:00Z" })], now);
  assert.equal(result.items.length, 0);
});

test("rejeita data futura absurda", () => {
  const result = normalizeItems([item({ publicadoEm: "2026-08-10T10:00:00Z" })], now);
  assert.equal(result.items.length, 0);
});

test("aplica limite por fonte", () => {
  const many = Array.from({ length: 20 }, (_, index) => item({
    titulo: `Engenharia civil fiscaliza obra pública ${index}`,
    url: `https://fonte.example/${index}`,
  }));
  const normalized = normalizeItems(many, now);
  const payload = mergeWithExisting({ noticias: [] }, normalized.items, now);
  const count = payload.noticias.filter((news) => news.fonte === "Fonte Teste").length;
  assert.equal(count, 15);
});

test("gera ID determinístico", () => {
  const first = deterministicId({ titulo: "Engenharia civil", url: "https://fonte.example/a" });
  const second = deterministicId({ titulo: "Engenharia civil", url: "https://fonte.example/a" });
  assert.equal(first, second);
});

test("bloqueia escrita fora do arquivo autorizado", () => {
  assert.throws(() => assertAllowedWrite(path.resolve("tmp", "fora.json")), /Escrita bloqueada/);
});
