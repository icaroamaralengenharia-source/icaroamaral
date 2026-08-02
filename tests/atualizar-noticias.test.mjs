import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  assertAllowedWrite,
  deterministicId,
  enrichWithOgImages,
  extractFeedImage,
  extractOgImage,
  mergeWithExisting,
  normalizeImageUrl,
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
    <title>Obras publicas de saneamento avancam no estado</title>
    <link>https://fonte.example/noticia-1</link>
    <description><![CDATA[<p>Projeto de engenharia civil amplia saneamento basico.</p>]]></description>
    <pubDate>Fri, 31 Jul 2026 10:00:00 -0300</pubDate>
    <category>Infraestrutura</category>
  </item>
</channel></rss>`;

const atomFixture = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Jornada BIM capacita equipes de arquitetura</title>
    <link href="https://fonte.example/atom-1" />
    <summary>Capacitacao em BIM para obras publicas.</summary>
    <updated>2026-07-30T10:00:00Z</updated>
    <category>Inovacao</category>
  </entry>
</feed>`;

function item(overrides = {}) {
  return {
    titulo: "Engenharia civil reforca fiscalizacao de obras publicas",
    url: "https://fonte.example/base",
    resumo: "Fiscalizacao tecnica em obras publicas com foco em engenharia civil.",
    publicadoEm: "2026-07-31T10:00:00Z",
    fonte: "Fonte Teste",
    categoriasOriginais: ["Engenharia"],
    ...overrides,
  };
}

function response(body, { status = 200, contentType = "text/html", location = null } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        const key = String(name).toLowerCase();
        if (key === "content-type") return contentType;
        if (key === "location") return location;
        return null;
      },
    },
    async text() {
      return body;
    },
  };
}

test("le RSS", () => {
  const items = parseFeed(rssFixture, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, "Obras publicas de saneamento avancam no estado");
  assert.equal(items[0].url, "https://fonte.example/noticia-1");
});

test("le Atom", () => {
  const items = parseFeed(atomFixture, source);
  assert.equal(items.length, 1);
  assert.equal(items[0].titulo, "Jornada BIM capacita equipes de arquitetura");
  assert.equal(items[0].url, "https://fonte.example/atom-1");
});

test("remove HTML", () => {
  assert.equal(stripHtml("<p>Texto <strong>seguro</strong></p><script>alert(1)</script>"), "Texto seguro");
});

test("rejeita javascript em URL de noticia", () => {
  const result = normalizeItems([item({ url: "javascript:alert(1)" })], now);
  assert.equal(result.items.length, 0);
});

test("aplica filtro tematico", () => {
  assert.equal(passesEditorialFilter(item()), true);
  assert.equal(passesEditorialFilter(item({ titulo: "Celebridade vence reality show", resumo: "Entretenimento sem relacao tecnica." })), false);
});

test("remove duplicados por URL", () => {
  const result = normalizeItems([
    item({ titulo: "Engenharia civil fiscaliza obras publicas", url: "https://fonte.example/a" }),
    item({ titulo: "Construcao civil recebe nova norma", url: "https://fonte.example/a" }),
  ], now);
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicates, 1);
});

test("remove duplicados por titulo", () => {
  const result = normalizeItems([
    item({ titulo: "Fiscalizacao de obras publicas avanca", url: "https://fonte.example/a" }),
    item({ titulo: "Fiscalizacao de obras publicas avanca", url: "https://fonte.example/b" }),
  ], now);
  assert.equal(result.items.length, 1);
  assert.equal(result.duplicates, 1);
});

test("limita resumo a 300 caracteres", () => {
  const summary = summarize(`Construcao civil ${"planejamento ".repeat(60)}`);
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
  const result = await updateNews({ dryRun: true, now, fetchImpl: async () => { throw new Error("falha simulada"); } });
  assert.equal(result.ok, false);
  assert.ok(Array.isArray(result.payload.noticias));
});

test("rejeita noticia antiga", () => {
  const result = normalizeItems([item({ publicadoEm: "2026-06-01T10:00:00Z" })], now);
  assert.equal(result.items.length, 0);
});

test("rejeita data futura absurda", () => {
  const result = normalizeItems([item({ publicadoEm: "2026-08-10T10:00:00Z" })], now);
  assert.equal(result.items.length, 0);
});

test("aplica limite por fonte", () => {
  const many = Array.from({ length: 20 }, (_, index) => item({
    titulo: `Engenharia civil fiscaliza obra publica ${index}`,
    url: `https://fonte.example/${index}`,
  }));
  const normalized = normalizeItems(many, now);
  const payload = mergeWithExisting({ noticias: [] }, normalized.items, now);
  const count = payload.noticias.filter((news) => news.fonte === "Fonte Teste").length;
  assert.equal(count, 15);
});

test("gera ID deterministico", () => {
  const first = deterministicId({ titulo: "Engenharia civil", url: "https://fonte.example/a" });
  const second = deterministicId({ titulo: "Engenharia civil", url: "https://fonte.example/a" });
  assert.equal(first, second);
});

test("bloqueia escrita fora do arquivo autorizado", () => {
  assert.throws(() => assertAllowedWrite(path.resolve("tmp", "fora.json")), /Escrita bloqueada/);
});

test("extrai media:content valido", () => {
  const image = extractFeedImage(`<media:content url="https://img.example/obra.jpg" type="image/jpeg" />`, "https://fonte.example/noticia", source);
  assert.equal(image.imagemUrl, "https://img.example/obra.jpg");
  assert.equal(image._imagemFonte, "feed");
});

test("extrai media:thumbnail valido", () => {
  const image = extractFeedImage(`<media:thumbnail url="https://img.example/thumb.png" />`, "https://fonte.example/noticia", source);
  assert.equal(image.imagemUrl, "https://img.example/thumb.png");
});

test("extrai enclosure image/jpeg", () => {
  const image = extractFeedImage(`<enclosure url="https://img.example/foto.jpeg" type="image/jpeg" />`, "https://fonte.example/noticia", source);
  assert.equal(image.imagemUrl, "https://img.example/foto.jpeg");
});

test("ignora enclosure que nao e imagem", () => {
  const image = extractFeedImage(`<enclosure url="https://img.example/audio.mp3" type="audio/mpeg" />`, "https://fonte.example/noticia", source);
  assert.equal(image.imagemUrl, null);
});

test("extrai og:image valido", () => {
  const image = extractOgImage(`<html><head><meta property="og:image" content="https://img.example/capa.jpg"></head></html>`, "https://fonte.example/noticia", "Fonte Teste");
  assert.equal(image.imagemUrl, "https://img.example/capa.jpg");
  assert.equal(image._imagemFonte, "og");
});

test("resolve og:image relativo", () => {
  const image = extractOgImage(`<meta property="og:image" content="/midia/capa.jpg">`, "https://fonte.example/noticia", "Fonte Teste");
  assert.equal(image.imagemUrl, "https://fonte.example/midia/capa.jpg");
});

test("rejeita javascript em imagem", () => {
  assert.equal(normalizeImageUrl("javascript:alert(1)", "https://fonte.example/noticia"), null);
});

test("rejeita data em imagem", () => {
  assert.equal(normalizeImageUrl("data:image/png;base64,abc", "https://fonte.example/noticia"), null);
});

test("rejeita SVG remoto", () => {
  assert.equal(normalizeImageUrl("https://img.example/logo.svg", "https://fonte.example/noticia"), null);
  const image = extractFeedImage(`<media:content url="https://img.example/logo" type="image/svg+xml" />`, "https://fonte.example/noticia", source);
  assert.equal(image.imagemUrl, null);
});

test("resolve URL relativa de imagem do feed", () => {
  const image = extractFeedImage(`<media:content url="../img/obra.jpg" type="image/jpeg" />`, "https://fonte.example/noticias/item", source);
  assert.equal(image.imagemUrl, "https://fonte.example/img/obra.jpg");
});

test("preserva imagem anterior quando nova coleta vem sem imagem", () => {
  const previous = normalizeItems([item({ imagemUrl: "https://img.example/antiga.jpg", imagemAlt: "Antiga", imagemOrigem: "Arquivo" })], now).items[0];
  const next = normalizeItems([item()], now).items[0];
  const payload = mergeWithExisting({ noticias: [previous] }, [next], now);
  assert.equal(payload.noticias[0].imagemUrl, "https://img.example/antiga.jpg");
});

test("imagem do feed tem prioridade sobre imagem anterior", () => {
  const previous = normalizeItems([item({ imagemUrl: "https://img.example/antiga.jpg" })], now).items[0];
  const next = normalizeItems([item({ imagemUrl: "https://img.example/feed.jpg", _imagemFonte: "feed" })], now).items[0];
  const payload = mergeWithExisting({ noticias: [previous] }, [next], now);
  assert.equal(payload.noticias[0].imagemUrl, "https://img.example/feed.jpg");
});

test("noticia sem imagem continua valida com campos null", () => {
  const result = normalizeItems([item()], now);
  assert.equal(result.items.length, 1);
  const payload = mergeWithExisting({ noticias: [] }, result.items, now);
  assert.equal(payload.noticias[0].imagemUrl, null);
  assert.equal(payload.noticias[0].imagemAlt, null);
  assert.equal(payload.noticias[0].imagemOrigem, null);
});

test("HTML malformado nao derruba og:image", () => {
  const image = extractOgImage(`<meta property="og:image" content="https://img.example/capa.jpg"><div`, "https://fonte.example/noticia", "Fonte Teste");
  assert.equal(image.imagemUrl, "https://img.example/capa.jpg");
});

test("limita paginas consultadas para og:image", async () => {
  const items = Array.from({ length: 25 }, (_, index) => normalizeItems([item({
    titulo: `Engenharia civil inspeciona obra publica ${index}`,
    url: `https://fonte.example/og-${index}`,
  })], now).items[0]);
  let calls = 0;
  const result = await enrichWithOgImages(items, {
    maxPages: 20,
    fetchImpl: async () => {
      calls += 1;
      return response(`<meta property="og:image" content="https://img.example/capa-${calls}.jpg">`);
    },
  });
  assert.equal(calls, 20);
  assert.equal(result.stats.paginasOgConsultadas, 20);
  assert.equal(result.stats.imagensOg, 20);
});

test("imagem nao altera ID deterministico", () => {
  const withoutImage = normalizeItems([item()], now).items[0];
  const withImage = normalizeItems([item({ imagemUrl: "https://img.example/foto.jpg" })], now).items[0];
  assert.equal(withoutImage.id, withImage.id);
});

test("fallback continua funcionando sem imagemUrl", () => {
  const items = parseFeed(rssFixture, source);
  assert.equal(items[0].imagemUrl, null);
  assert.equal(items[0].imagemAlt, null);
});

test("noticias.js nao usa innerHTML", async () => {
  const js = await readFile(path.resolve("noticias", "noticias.js"), "utf8");
  assert.equal(js.includes("innerHTML"), false);
});

test("enriquece com og:image quando feed nao fornece imagem", async () => {
  const normalized = normalizeItems([item()], now).items;
  const result = await enrichWithOgImages(normalized, {
    fetchImpl: async () => response(`<meta property="og:image" content="/capa.jpg">`),
  });
  assert.equal(result.items[0].imagemUrl, "https://fonte.example/capa.jpg");
  assert.equal(result.items[0]._imagemFonte, "og");
});