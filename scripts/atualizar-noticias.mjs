import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_FILE = path.resolve(ROOT_DIR, "noticias", "dados", "noticias.json");
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_HTML_RESPONSE_BYTES = 600_000;
const MAX_NEWS = 60;
const MAX_PER_SOURCE = 15;
const MAX_NEW_PER_RUN = 10;
const MAX_OG_PAGES_PER_RUN = 20;
const MAX_OG_REDIRECTS = 3;
const MAX_AGE_DAYS = 30;
const USER_AGENT = "icaroamaral-noticias/1.0 (+https://www.icaroamaral.com.br/noticias/)";

export const FONTES = [
  { nome: "CAU/BR", url: "https://caubr.gov.br/feed/", tipo: "rss" },
  { nome: "CBIC", url: "https://cbic.org.br/feed/", tipo: "rss" },
  { nome: "Agencia Brasil", url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml", tipo: "rss" },
];

const ACCEPT_TERMS = [
  "engenharia", "engenheiro", "construcao", "arquitetura", "urbanismo", "infraestrutura",
  "obra", "obras", "habitacao", "saneamento", "estrutura", "estruturas", "fundacao",
  "fundacoes", "concreto", "inspecao predial", "pericia", "fiscalizacao", "bim",
  "norma tecnica", "crea", "confea", "cau", "licitacao", "seguranca do trabalho",
  "canteiro", "edificacao", "imobiliario", "retrofit", "patrimonio", "rrt",
];

const BLOCK_TERMS = [
  "celebridade", "futebol", "esporte", "aposta", "apostas", "adulto", "cripto",
  "criptomoeda", "bbb", "novela", "rapper", "cantor", "atriz", "ator",
];

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

export function stripHtml(value = "") {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function summarize(value = "") {
  const text = stripHtml(value) || "A fonte nao forneceu descricao.";
  if (text.length <= 300) return text;
  const slice = text.slice(0, 297);
  const end = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (end >= 120) return slice.slice(0, end + 1).trim();
  const space = slice.lastIndexOf(" ");
  return `${slice.slice(0, space > 120 ? space : 297).trim()}...`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tagContent(block, tag) {
  const escaped = escapeRegExp(tag);
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function tagContents(block, tag) {
  const escaped = escapeRegExp(tag);
  return [...block.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi"))]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
}

function decodeAttribute(value = "") {
  return decodeEntities(String(value).trim().replace(/^["']|["']$/g, ""));
}

function parseAttributes(value = "") {
  const attributes = {};
  for (const attr of String(value).matchAll(/([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    attributes[attr[1].toLowerCase()] = decodeAttribute(attr[3] ?? attr[4] ?? attr[5] ?? "");
  }
  return attributes;
}

function tagAttributes(block, tag) {
  const escaped = escapeRegExp(tag);
  return [...String(block || "").matchAll(new RegExp(`<${escaped}\\b([^>]*)>`, "gi"))]
    .map((match) => parseAttributes(match[1]));
}

export function normalizeImageUrl(value, baseUrl = "") {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const url = new URL(text, baseUrl || undefined);
    const pathname = url.pathname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    if (pathname.endsWith(".svg") || pathname.endsWith(".svgz")) return null;
    return url.href;
  } catch {
    return null;
  }
}

function isSvgContentType(value = "") {
  return /\bimage\/svg(?:\+xml)?\b/i.test(String(value));
}

function createImageMetadata(url, alt, origin, sourceType) {
  if (!url) return { imagemUrl: null, imagemAlt: null, imagemOrigem: null, _imagemFonte: null };
  return {
    imagemUrl: url,
    imagemAlt: stripHtml(alt || "Imagem da noticia") || "Imagem da noticia",
    imagemOrigem: origin || null,
    _imagemFonte: sourceType,
  };
}

export function extractFeedImage(block, itemUrl, source) {
  const mediaContent = tagAttributes(block, "media:content")
    .find((attrs) => attrs.url && !isSvgContentType(attrs.type));
  const mediaContentUrl = normalizeImageUrl(mediaContent?.url, itemUrl);
  if (mediaContentUrl) return createImageMetadata(mediaContentUrl, mediaContent?.alt || "", source.nome, "feed");

  const mediaThumbnail = tagAttributes(block, "media:thumbnail")
    .find((attrs) => attrs.url && !isSvgContentType(attrs.type));
  const thumbnailUrl = normalizeImageUrl(mediaThumbnail?.url, itemUrl);
  if (thumbnailUrl) return createImageMetadata(thumbnailUrl, mediaThumbnail?.alt || "", source.nome, "feed");

  const enclosure = tagAttributes(block, "enclosure")
    .find((attrs) => /^image\//i.test(attrs.type || "") && !isSvgContentType(attrs.type));
  const enclosureUrl = normalizeImageUrl(enclosure?.url, itemUrl);
  if (enclosureUrl) return createImageMetadata(enclosureUrl, enclosure?.alt || "", source.nome, "feed");

  return createImageMetadata(null, null, null, null);
}

export function parseFeed(xml, source) {
  const text = String(xml || "");
  const isAtom = /<feed[\s>]/i.test(text);
  const blocks = isAtom
    ? [...text.matchAll(/<entry[\s\S]*?<\/entry>/gi)].map((match) => match[0])
    : [...text.matchAll(/<item[\s\S]*?<\/item>/gi)].map((match) => match[0]);

  return blocks.map((block) => {
    const atomLink = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    const categories = tagContents(block, "category");
    const titulo = stripHtml(tagContent(block, "title"));
    const url = isAtom ? decodeEntities(atomLink?.[1] || "") : stripHtml(tagContent(block, "link"));
    const descricao = tagContent(block, "description") || tagContent(block, "summary") || tagContent(block, "content");
    const publicadoEm = tagContent(block, "pubDate") || tagContent(block, "updated") || tagContent(block, "published");
    const image = extractFeedImage(block, url || source.url, source);
    return {
      titulo,
      url,
      resumo: summarize(descricao),
      publicadoEm,
      categoriasOriginais: categories,
      fonte: source.nome,
      fonteUrl: source.url,
      imagemUrl: image.imagemUrl,
      imagemAlt: image.imagemUrl ? image.imagemAlt || titulo : null,
      imagemOrigem: image.imagemOrigem,
      _imagemFonte: image._imagemFonte,
    };
  });
}

export function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function categorize(item) {
  const text = normalizeText(`${item.titulo} ${item.resumo} ${item.categoriasOriginais?.join(" ") || ""}`);
  if (text.includes("bim") || text.includes("digital") || text.includes("tecnologia")) return "Tecnologia e BIM";
  if (text.includes("cau") || text.includes("crea") || text.includes("confea") || text.includes("fiscalizacao") || text.includes("rrt")) return "Conselhos e Fiscalizacao";
  if (text.includes("arquitetura") || text.includes("urbanismo") || text.includes("patrimonio") || text.includes("retrofit")) return "Arquitetura e Urbanismo";
  if (text.includes("saneamento") || text.includes("infraestrutura") || text.includes("habitacao") || text.includes("obra")) return "Infraestrutura e Obras";
  if (text.includes("seguranca do trabalho") || text.includes("nr-") || text.includes("canteiro")) return "Seguranca do Trabalho";
  return "Engenharia e Construcao";
}

export function passesEditorialFilter(item) {
  const text = normalizeText(`${item.titulo} ${item.resumo}`);
  if (!text) return false;
  if (BLOCK_TERMS.some((term) => text.includes(normalizeText(term)))) return false;
  return ACCEPT_TERMS.some((term) => text.includes(normalizeText(term)));
}

function validDate(value, now = new Date()) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const age = now.getTime() - date.getTime();
  if (age < -24 * 60 * 60 * 1000) return null;
  if (age > MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return null;
  return date;
}

export function deterministicId(item) {
  return createHash("sha256")
    .update(`${normalizeText(item.titulo)}|${item.url}`)
    .digest("hex")
    .slice(0, 16);
}

export function normalizeItems(items, collectedAt = new Date()) {
  const accepted = [];
  const duplicateUrls = new Set();
  const duplicateTitles = new Set();
  let rejected = 0;
  let duplicates = 0;

  for (const item of items) {
    const titulo = stripHtml(item.titulo);
    const urlText = String(item.url || "").trim();
    if (!titulo || !isAllowedUrl(urlText)) {
      rejected += 1;
      continue;
    }
    const url = new URL(urlText);
    if (url.protocol !== "https:" && !url.hostname.endsWith(".gov.br")) {
      rejected += 1;
      continue;
    }
    const date = validDate(item.publicadoEm, collectedAt);
    if (!date || !passesEditorialFilter({ ...item, titulo, url: url.href })) {
      rejected += 1;
      continue;
    }
    const titleKey = normalizeText(titulo);
    const urlKey = url.href.replace(/\/$/, "");
    if (duplicateUrls.has(urlKey) || duplicateTitles.has(titleKey)) {
      duplicates += 1;
      continue;
    }
    duplicateUrls.add(urlKey);
    duplicateTitles.add(titleKey);
    const normalizedImageUrl = normalizeImageUrl(item.imagemUrl, url.href);
    accepted.push({
      id: deterministicId({ titulo, url: url.href }),
      titulo,
      resumo: summarize(item.resumo),
      fonte: item.fonte,
      url: url.href,
      publicadoEm: date.toISOString(),
      coletadoEm: collectedAt.toISOString(),
      categoria: categorize(item),
      dominio: url.hostname.replace(/^www\./, ""),
      imagemUrl: normalizedImageUrl,
      imagemAlt: normalizedImageUrl ? stripHtml(item.imagemAlt || titulo) : null,
      imagemOrigem: normalizedImageUrl ? stripHtml(item.imagemOrigem || item.fonte) : null,
      _imagemFonte: normalizedImageUrl ? item._imagemFonte || "feed" : null,
    });
  }

  return { items: accepted, rejected, duplicates };
}

function hasValidImage(item) {
  return Boolean(normalizeImageUrl(item?.imagemUrl, item?.url || ""));
}

function imageFields(item) {
  if (!hasValidImage(item)) return { imagemUrl: null, imagemAlt: null, imagemOrigem: null };
  return {
    imagemUrl: normalizeImageUrl(item.imagemUrl, item.url),
    imagemAlt: stripHtml(item.imagemAlt || item.titulo || "Imagem da noticia"),
    imagemOrigem: stripHtml(item.imagemOrigem || item.fonte || ""),
  };
}

function publicNewsItem(item) {
  return {
    id: item.id,
    titulo: item.titulo,
    resumo: item.resumo,
    fonte: item.fonte,
    url: item.url,
    publicadoEm: item.publicadoEm,
    coletadoEm: item.coletadoEm,
    categoria: item.categoria,
    dominio: item.dominio,
    ...imageFields(item),
  };
}

export function mergeWithExisting(existingPayload, newItems, collectedAt = new Date()) {
  const previous = Array.isArray(existingPayload?.noticias) ? existingPayload.noticias : [];
  const recentPrevious = previous.filter((item) => validDate(item.publicadoEm, collectedAt));
  const previousByUrl = new Map(recentPrevious.map((item) => [String(item.url || "").replace(/\/$/, ""), item]));
  const previousByTitle = new Map(recentPrevious.map((item) => [normalizeText(item.titulo), item]));
  const merged = [...newItems.slice(0, MAX_NEW_PER_RUN), ...recentPrevious];
  const byUrl = new Set();
  const byTitle = new Set();
  const bySourceCount = new Map();
  const finalItems = [];

  for (const item of merged.sort((a, b) => new Date(b.publicadoEm) - new Date(a.publicadoEm))) {
    const urlKey = String(item.url || "").replace(/\/$/, "");
    const titleKey = normalizeText(item.titulo);
    const sourceCount = bySourceCount.get(item.fonte) || 0;
    if (byUrl.has(urlKey) || byTitle.has(titleKey) || sourceCount >= MAX_PER_SOURCE) continue;
    const previousItem = previousByUrl.get(urlKey) || previousByTitle.get(titleKey);
    const candidate = { ...item };
    if (!hasValidImage(candidate) && hasValidImage(previousItem)) Object.assign(candidate, imageFields(previousItem));
    byUrl.add(urlKey);
    byTitle.add(titleKey);
    bySourceCount.set(item.fonte, sourceCount + 1);
    finalItems.push(publicNewsItem(candidate));
    if (finalItems.length >= MAX_NEWS) break;
  }

  return {
    atualizadoEm: collectedAt.toISOString(),
    coletadoEm: collectedAt.toISOString(),
    fontes: [...new Set(finalItems.map((item) => item.fonte))].sort(),
    noticias: finalItems,
  };
}

export function assertAllowedWrite(targetPath) {
  const resolved = path.resolve(targetPath);
  if (resolved !== DATA_FILE) throw new Error(`Escrita bloqueada fora do JSON autorizado: ${resolved}`);
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return { atualizadoEm: null, coletadoEm: null, fontes: [], noticias: [] };
  }
}

async function readResponseBodyWithLimit(response, maxBytes, limitMessage) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error(limitMessage);
    return text;
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new Error(limitMessage);
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchWithLimit(source, fetchImpl = fetch) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetchImpl(source.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        "accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, application/json;q=0.8",
      },
    });
    const contentType = response.headers?.get?.("content-type") || "";
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    if (!/(xml|rss|atom|json|text\/plain|text\/xml)/i.test(contentType)) throw new Error(`Content-Type recusado: ${contentType || "ausente"}`);
    return await readResponseBodyWithLimit(response, MAX_RESPONSE_BYTES, "Resposta excede o limite");
  } finally {
    clearTimeout(timeout);
  }
}

export function extractOgImage(html, pageUrl, sourceName) {
  const metaTags = [...String(html || "").matchAll(/<meta\b([^>]*)>/gi)];
  for (const tag of metaTags) {
    const attrs = parseAttributes(tag[1]);
    const property = String(attrs.property || attrs.name || "").toLowerCase();
    if (property !== "og:image" && property !== "og:image:url" && property !== "twitter:image") continue;
    const imageUrl = normalizeImageUrl(attrs.content, pageUrl);
    if (imageUrl) return createImageMetadata(imageUrl, "", sourceName, "og");
  }
  return createImageMetadata(null, null, null, null);
}

async function fetchHtmlWithLimit(pageUrl, fetchImpl = fetch) {
  let currentUrl = pageUrl;
  for (let redirectCount = 0; redirectCount <= MAX_OG_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "user-agent": USER_AGENT,
          "accept": "text/html,application/xhtml+xml;q=0.9",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.("location");
        let nextUrl = null;
        try {
          const url = new URL(location, currentUrl);
          nextUrl = isAllowedUrl(url.href) ? url.href : null;
        } catch {
          nextUrl = null;
        }
        if (!nextUrl || redirectCount === MAX_OG_REDIRECTS) throw new Error("Redirecionamento recusado");
        currentUrl = nextUrl;
        continue;
      }
      const contentType = response.headers?.get?.("content-type") || "";
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!/\btext\/html\b/i.test(contentType)) throw new Error(`Content-Type recusado: ${contentType || "ausente"}`);
      return await readResponseBodyWithLimit(response, MAX_HTML_RESPONSE_BYTES, "HTML excede o limite");
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("Redirecionamento recusado");
}

export async function enrichWithOgImages(items, { fetchImpl = fetch, maxPages = MAX_OG_PAGES_PER_RUN } = {}) {
  const enriched = [];
  const stats = { imagensOg: 0, paginasOgConsultadas: 0, errosOg: 0 };
  for (const item of items) {
    if (hasValidImage(item) || stats.paginasOgConsultadas >= maxPages) {
      enriched.push(item);
      continue;
    }
    stats.paginasOgConsultadas += 1;
    try {
      const html = await fetchHtmlWithLimit(item.url, fetchImpl);
      const image = extractOgImage(html, item.url, item.fonte);
      if (image.imagemUrl) {
        enriched.push({ ...item, imagemUrl: image.imagemUrl, imagemAlt: item.titulo, imagemOrigem: item.fonte, _imagemFonte: "og" });
        stats.imagensOg += 1;
      } else {
        enriched.push(item);
      }
    } catch {
      stats.errosOg += 1;
      enriched.push(item);
    }
  }
  return { items: enriched, stats };
}

async function collectSources({ fetchImpl = fetch } = {}) {
  const stats = { fontesConsultadas: FONTES.length, fontesValidas: [], fontesComErro: [], itensEncontrados: 0 };
  const allItems = [];
  for (const source of FONTES) {
    try {
      const body = await fetchWithLimit(source, fetchImpl);
      const items = parseFeed(body, source);
      stats.itensEncontrados += items.length;
      stats.fontesValidas.push({ nome: source.nome, url: source.url, itens: items.length });
      allItems.push(...items);
    } catch (error) {
      stats.fontesComErro.push({ nome: source.nome, url: source.url, erro: error.message });
    }
  }
  return { stats, allItems };
}

export async function updateNews({ dryRun = false, fetchImpl = fetch, now = new Date() } = {}) {
  const existing = await readExisting();
  const { stats, allItems } = await collectSources({ fetchImpl });
  if (stats.fontesValidas.length === 0) {
    return {
      ok: false,
      changed: false,
      stats: { ...stats, itensAceitos: 0, duplicadosRemovidos: 0, rejeitados: allItems.length },
      payload: existing,
      error: "Todas as fontes falharam; JSON anterior preservado.",
    };
  }
  const normalized = normalizeItems(allItems, now);
  const withOg = await enrichWithOgImages(normalized.items, { fetchImpl });
  const payload = mergeWithExisting(existing, withOg.items, now);
  const previousText = JSON.stringify(existing, null, 2);
  const nextText = `${JSON.stringify(payload, null, 2)}\n`;
  const changed = `${previousText.trim()}\n` !== nextText;
  if (!dryRun && changed) {
    assertAllowedWrite(DATA_FILE);
    await writeFile(DATA_FILE, nextText, "utf8");
  }
  return {
    ok: true,
    changed,
    stats: {
      ...stats,
      itensAceitos: withOg.items.length,
      duplicadosRemovidos: normalized.duplicates,
      rejeitados: normalized.rejected,
      imagensFeed: withOg.items.filter((item) => item._imagemFonte === "feed").length,
      imagensOg: withOg.stats.imagensOg,
      semImagem: withOg.items.filter((item) => !hasValidImage(item)).length,
      paginasOgConsultadas: withOg.stats.paginasOgConsultadas,
      errosOg: withOg.stats.errosOg,
      arquivo: changed ? "alterado" : "sem mudancas",
    },
    payload,
  };
}

function printResult(result, dryRun) {
  if (dryRun) {
    console.log(`noticias aceitas: ${result.stats.itensAceitos || 0}`);
    console.log(`imagens vindas do feed: ${result.stats.imagensFeed || 0}`);
    console.log(`imagens vindas de og:image: ${result.stats.imagensOg || 0}`);
    console.log(`noticias sem imagem: ${result.stats.semImagem || 0}`);
    console.log(`fontes com erro: ${result.stats.fontesComErro?.length || 0}`);
    if (result.error) console.log(result.error);
    return;
  }
  console.log(`fontes consultadas: ${result.stats.fontesConsultadas}`);
  console.log(`fontes validas: ${result.stats.fontesValidas.length}`);
  for (const source of result.stats.fontesValidas) console.log(`- ${source.nome}: ${source.itens} itens (${source.url})`);
  console.log(`fontes com erro: ${result.stats.fontesComErro.length}`);
  for (const source of result.stats.fontesComErro) console.log(`- ${source.nome}: ${source.erro}`);
  console.log(`itens encontrados: ${result.stats.itensEncontrados}`);
  console.log(`itens aceitos: ${result.stats.itensAceitos}`);
  console.log(`imagens vindas do feed: ${result.stats.imagensFeed || 0}`);
  console.log(`imagens vindas de og:image: ${result.stats.imagensOg || 0}`);
  console.log(`noticias sem imagem: ${result.stats.semImagem || 0}`);
  console.log(`duplicados removidos: ${result.stats.duplicadosRemovidos}`);
  console.log(`arquivo: ${dryRun ? "dry-run, sem gravacao" : result.stats.arquivo || "sem mudancas"}`);
  if (result.error) console.log(result.error);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await updateNews({ dryRun });
  printResult(result, dryRun);
  if (!result.ok) process.exitCode = 1;
}