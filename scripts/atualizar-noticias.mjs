import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const DATA_FILE = path.resolve(ROOT_DIR, "noticias", "dados", "noticias.json");
const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_NEWS = 60;
const MAX_PER_SOURCE = 15;
const MAX_NEW_PER_RUN = 20;
const MAX_AGE_DAYS = 30;
const USER_AGENT = "icaroamaral-noticias/1.0 (+https://www.icaroamaral.com.br/noticias/)";

export const FONTES = [
  {
    nome: "CAU/BR",
    url: "https://caubr.gov.br/feed/",
    tipo: "rss",
  },
  {
    nome: "CBIC",
    url: "https://cbic.org.br/feed/",
    tipo: "rss",
  },
  {
    nome: "Agência Brasil",
    url: "https://agenciabrasil.ebc.com.br/rss/ultimasnoticias/feed.xml",
    tipo: "rss",
  },
];

const ACCEPT_TERMS = [
  "engenharia", "engenheiro", "construção", "construcao", "arquitetura", "urbanismo",
  "infraestrutura", "obra", "obras", "habitação", "habitacao", "saneamento",
  "estrutura", "estruturas", "fundação", "fundacao", "fundações", "fundacoes",
  "concreto", "inspeção predial", "inspecao predial", "perícia", "pericia",
  "fiscalização", "fiscalizacao", "bim", "norma técnica", "norma tecnica",
  "crea", "confea", "cau", "licitação", "licitacao", "segurança do trabalho",
  "seguranca do trabalho", "canteiro", "edificação", "edificacao", "imobiliário",
  "imobiliario", "retrofit", "patrimônio", "patrimonio", "rrt",
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
  const text = stripHtml(value) || "A fonte não forneceu descrição.";
  if (text.length <= 300) return text;
  const slice = text.slice(0, 297);
  const end = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  if (end >= 120) return slice.slice(0, end + 1).trim();
  const space = slice.lastIndexOf(" ");
  return `${slice.slice(0, space > 120 ? space : 297).trim()}...`;
}

function tagContent(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = block.match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function tagContents(block, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...block.matchAll(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "gi"))]
    .map((match) => stripHtml(match[1]))
    .filter(Boolean);
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
    return {
      titulo,
      url,
      resumo: summarize(descricao),
      publicadoEm,
      categoriasOriginais: categories,
      fonte: source.nome,
      fonteUrl: source.url,
    };
  });
}

export function isAllowedUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function categorize(item) {
  const text = normalizeText(`${item.titulo} ${item.resumo} ${item.categoriasOriginais?.join(" ") || ""}`);
  if (text.includes("bim") || text.includes("digital") || text.includes("tecnologia")) return "Tecnologia e BIM";
  if (text.includes("cau") || text.includes("crea") || text.includes("confea") || text.includes("fiscalizacao") || text.includes("rrt")) return "Conselhos e Fiscalização";
  if (text.includes("arquitetura") || text.includes("urbanismo") || text.includes("patrimonio") || text.includes("retrofit")) return "Arquitetura e Urbanismo";
  if (text.includes("saneamento") || text.includes("infraestrutura") || text.includes("habitacao") || text.includes("obra")) return "Infraestrutura e Obras";
  if (text.includes("seguranca do trabalho") || text.includes("nr-") || text.includes("canteiro")) return "Segurança do Trabalho";
  return "Engenharia e Construção";
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
    const normalized = {
      id: deterministicId({ titulo, url: url.href }),
      titulo,
      resumo: summarize(item.resumo),
      fonte: item.fonte,
      url: url.href,
      publicadoEm: date.toISOString(),
      coletadoEm: collectedAt.toISOString(),
      categoria: categorize(item),
      dominio: url.hostname.replace(/^www\./, ""),
    };
    accepted.push(normalized);
  }

  return { items: accepted, rejected, duplicates };
}

export function mergeWithExisting(existingPayload, newItems, collectedAt = new Date()) {
  const previous = Array.isArray(existingPayload?.noticias) ? existingPayload.noticias : [];
  const recentPrevious = previous.filter((item) => validDate(item.publicadoEm, collectedAt));
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
    byUrl.add(urlKey);
    byTitle.add(titleKey);
    bySourceCount.set(item.fonte, sourceCount + 1);
    finalItems.push(item);
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
  if (resolved !== DATA_FILE) {
    throw new Error(`Escrita bloqueada fora do JSON autorizado: ${resolved}`);
  }
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(DATA_FILE, "utf8"));
  } catch {
    return { atualizadoEm: null, coletadoEm: null, fontes: [], noticias: [] };
  }
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
    if (!/(xml|rss|atom|json|text\/plain|text\/xml)/i.test(contentType)) {
      throw new Error(`Content-Type recusado: ${contentType || "ausente"}`);
    }
    const reader = response.body?.getReader?.();
    if (!reader) {
      const text = await response.text();
      if (Buffer.byteLength(text) > MAX_RESPONSE_BYTES) throw new Error("Resposta excede o limite");
      return text;
    }
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error("Resposta excede o limite");
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    clearTimeout(timeout);
  }
}

async function collectSources({ fetchImpl = fetch } = {}) {
  const stats = {
    fontesConsultadas: FONTES.length,
    fontesValidas: [],
    fontesComErro: [],
    itensEncontrados: 0,
  };
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
  const payload = mergeWithExisting(existing, normalized.items, now);
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
      itensAceitos: normalized.items.length,
      duplicadosRemovidos: normalized.duplicates,
      rejeitados: normalized.rejected,
      arquivo: changed ? "alterado" : "sem mudanças",
    },
    payload,
  };
}

function printResult(result, dryRun) {
  console.log(`fontes consultadas: ${result.stats.fontesConsultadas}`);
  console.log(`fontes válidas: ${result.stats.fontesValidas.length}`);
  for (const source of result.stats.fontesValidas) {
    console.log(`- ${source.nome}: ${source.itens} itens (${source.url})`);
  }
  console.log(`fontes com erro: ${result.stats.fontesComErro.length}`);
  for (const source of result.stats.fontesComErro) {
    console.log(`- ${source.nome}: ${source.erro}`);
  }
  console.log(`itens encontrados: ${result.stats.itensEncontrados}`);
  console.log(`itens aceitos: ${result.stats.itensAceitos}`);
  console.log(`duplicados removidos: ${result.stats.duplicadosRemovidos}`);
  console.log(`arquivo: ${dryRun ? "dry-run, sem gravação" : result.stats.arquivo || "sem mudanças"}`);
  if (result.error) console.log(result.error);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await updateNews({ dryRun });
  printResult(result, dryRun);
  if (!result.ok) process.exitCode = 1;
}
