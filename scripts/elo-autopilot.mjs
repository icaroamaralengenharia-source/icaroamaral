import { createHash } from "node:crypto";
import dns from "node:dns/promises";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Readability } from "@mozilla/readability";
import { JSDOM, VirtualConsole } from "jsdom";
import { parseFeed, stripHtml } from "./atualizar-noticias.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, "..");
export const CONFIG_PATH = path.join(ROOT_DIR, "config", "elo-autopilot.json");
export const POSTS_PATH = path.join(ROOT_DIR, "novidades", "dados", "posts.json");
export const POSTS_DIR = path.join(ROOT_DIR, "novidades", "posts");
export const IMAGE_DIR = path.join(ROOT_DIR, "novidades", "assets", "posts");
export const SITEMAP_PATH = path.join(ROOT_DIR, "sitemap.xml");
export const SITE_ORIGIN = "https://www.icaroamaral.com.br";
export const USER_AGENT = "ELO-Autopilot/1.0 (+https://www.icaroamaral.com.br/novidades/)";

const DEFAULT_STOPWORDS = new Set([
  "a", "o", "os", "as", "um", "uma", "de", "da", "do", "das", "dos", "e", "em", "para",
  "por", "com", "sem", "sobre", "que", "no", "na", "nos", "nas", "ao", "aos", "mais",
  "como", "sua", "seu", "suas", "seus", "brasil", "brasileiro", "brasileira", "novo", "nova",
  "noticia", "noticias", "setor", "mercado", "ano", "anos", "dia", "apos", "entre", "contra", "cbic", "cau", "agencia", "brasil", "brasileira", "promove", "participa"
]);

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

export function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugify(value) {
  const slug = normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return slug || "novidade-editorial";
}

export function safePostSlug(value) {
  const slug = clean(value);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Slug invalido.");
  if (slug.includes("..") || slug.includes("/") || slug.includes("\\")) throw new Error("Slug inseguro.");
  return slug;
}

function tokens(value) {
  return normalizeText(value).split(/\s+/).filter((token) => token.length >= 4 && !DEFAULT_STOPWORDS.has(token));
}

function tokenSet(value) {
  return new Set(tokens(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function hash(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 16);
}

function hostname(value) {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export async function readConfig(configPath = CONFIG_PATH) {
  return JSON.parse(await readFile(configPath, "utf8"));
}

export async function readPosts(postsPath = POSTS_PATH) {
  try {
    const payload = JSON.parse(await readFile(postsPath, "utf8"));
    return { atualizadoEm: payload.atualizadoEm || null, posts: Array.isArray(payload.posts) ? payload.posts : [] };
  } catch {
    return { atualizadoEm: null, posts: [] };
  }
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (ip === "::1" || ip === "0:0:0:0:0:0:0:1") return true;
  if (ip.startsWith("fe80:") || ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("::ffff:")) return isPrivateIp(ip.slice(7));
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}

function assertProtocolAndHost(url) {
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("Protocolo bloqueado.");
  if (url.username || url.password) throw new Error("Credenciais em URL bloqueadas.");
  const host = url.hostname.toLocaleLowerCase("pt-BR");
  if (["localhost", "0.0.0.0"].includes(host) || host.endsWith(".localhost")) throw new Error("Host local bloqueado.");
  if (net.isIP(host) && isPrivateIp(host)) throw new Error("IP privado bloqueado.");
}

export async function assertPublicHttpUrl(value, { lookup = dns.lookup } = {}) {
  const url = new URL(value);
  assertProtocolAndHost(url);
  if (!net.isIP(url.hostname)) {
    const records = await lookup(url.hostname, { all: true, verbatim: true });
    if (!records.length || records.some((record) => isPrivateIp(record.address))) throw new Error("DNS privado bloqueado.");
  }
  return url.href;
}

async function readLimitedBody(response, maxBytes, message) {
  const reader = response.body?.getReader?.();
  if (!reader) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > maxBytes) throw new Error(message);
    return buffer;
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) throw new Error(message);
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

export async function fetchSafe(urlValue, {
  fetchImpl = fetch,
  lookup = dns.lookup,
  timeoutMs = 15000,
  maxBytes = 900000,
  maxRedirects = 4,
  accept = "text/html,application/xhtml+xml;q=0.9,application/xml;q=0.8,text/xml;q=0.8",
  allowedContentType = /text\/html|application\/xhtml\+xml|application\/xml|text\/xml|rss|atom/i,
} = {}) {
  let current = await assertPublicHttpUrl(urlValue, { lookup });
  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": USER_AGENT, accept },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.get?.("location");
        if (!location || redirect === maxRedirects) throw new Error("Redirect bloqueado.");
        current = await assertPublicHttpUrl(new URL(location, current).href, { lookup });
        continue;
      }
      const contentType = response.headers?.get?.("content-type") || "";
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!allowedContentType.test(contentType)) throw new Error(`Content-Type recusado: ${contentType || "ausente"}`);
      const body = await readLimitedBody(response, maxBytes, "Resposta excede limite.");
      return { url: current, contentType, body };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Redirect bloqueado.");
}

export async function collectCandidates(config, { fetchImpl = fetch, lookup = dns.lookup, now = new Date() } = {}) {
  const found = [];
  const stats = { sources: [], errors: [] };
  for (const source of config.sources || []) {
    try {
      const result = await fetchSafe(source.url, {
        fetchImpl,
        lookup,
        maxBytes: config.limits?.maxFeedBytes || 1500000,
        timeoutMs: config.limits?.timeoutMs || 15000,
        allowedContentType: /xml|rss|atom|text\/plain|text\/xml|application\/json/i,
      });
      const items = parseFeed(result.body.toString("utf8"), { nome: source.name, url: source.url, tipo: source.type || "rss" });
      stats.sources.push({ name: source.name, items: items.length });
      for (const item of items) {
        if (!item.titulo || !item.url) continue;
        found.push({
          id: hash(`${source.name}|${item.url}|${item.titulo}`),
          titulo: clean(item.titulo),
          url: item.url,
          fonte: source.name,
          data: item.publicadoEm,
          resumo_feed: clean(item.resumo),
          categoria: item.categoria || "",
          sourceQuality: Number(source.quality || 0.75),
          collectedAt: now.toISOString(),
        });
      }
    } catch (error) {
      stats.errors.push({ source: source.name, error: error.message });
    }
  }
  return { candidates: found, stats };
}

function sourceRecencyScore(dateValue, now = new Date()) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 0.2;
  const ageDays = Math.max(0, (now.getTime() - date.getTime()) / 86400000);
  return Math.max(0, 1 - ageDays / 21);
}

function topicRelevanceScore(candidate, topics = []) {
  const text = normalizeText(`${candidate.titulo} ${candidate.resumo_feed} ${candidate.categoria}`);
  const topicTokens = unique(topics.flatMap(tokens));
  if (!topicTokens.length) return 0;
  const hits = topicTokens.filter((token) => text.includes(token));
  return Math.min(1, hits.length / Math.min(6, topicTokens.length));
}

function keywordRepetitionScore(cluster) {
  const bag = new Map();
  cluster.items.flatMap((item) => tokens(`${item.titulo} ${item.resumo_feed}`)).forEach((token) => bag.set(token, (bag.get(token) || 0) + 1));
  const repeated = [...bag.values()].filter((count) => count > 1).length;
  return Math.min(1, repeated / 6);
}

export function subjectKey(candidate, topics = []) {
  const topicWords = unique(topics.flatMap(tokens));
  const words = tokens(`${candidate.titulo} ${candidate.resumo_feed}`);
  const preferred = words.filter((word) => topicWords.includes(word));
  const selected = unique([...preferred, ...words]).slice(0, 5);
  return selected.slice(0, 3).join("-") || slugify(candidate.titulo).split("-").slice(0, 3).join("-");
}

function setSimilarity(a, b) {
  const aa = a instanceof Set ? a : tokenSet(a);
  const bb = b instanceof Set ? b : tokenSet(b);
  if (!aa.size || !bb.size) return 0;
  const intersection = [...aa].filter((token) => bb.has(token)).length;
  return intersection / Math.max(aa.size, bb.size);
}

function titleSimilarity(a, b) {
  return setSimilarity(a, b);
}

function candidateText(candidate = {}) {
  return [candidate.titulo, candidate.resumo_feed, candidate.categoria, candidate.fonte].filter(Boolean).join(" ");
}

function candidateSimilarity(a = {}, b = {}) {
  const title = titleSimilarity(a.titulo || "", b.titulo || "");
  const body = setSimilarity(candidateText(a), candidateText(b));
  const keywords = setSimilarity(tokens(candidateText(a)).slice(0, 12).join(" "), tokens(candidateText(b)).slice(0, 12).join(" "));
  return Math.max(title, body, keywords);
}

function shouldGroupCandidate(candidate, group, config = {}) {
  const threshold = Number(config.limits?.clusterSimilarityThreshold || 0.34);
  return group.items.some((item) => candidateSimilarity(candidate, item) >= threshold);
}

export function groupPautas(candidates, config) {
  const clusters = [];
  const ordered = [...candidates].sort((a, b) => sourceRecencyScore(b.data) - sourceRecencyScore(a.data) || (b.sourceQuality || 0) - (a.sourceQuality || 0));
  for (const candidate of ordered) {
    const cluster = clusters.find((item) => shouldGroupCandidate(candidate, item, config));
    if (cluster) cluster.items.push(candidate);
    else clusters.push({ key: subjectKey(candidate, config.topics || []), items: [candidate] });
  }
  return clusters.map((group) => {
    const sourceCount = unique(group.items.map((item) => item.fonte)).length;
    const best = [...group.items].sort((a, b) => (b.sourceQuality || 0) - (a.sourceQuality || 0) || sourceRecencyScore(b.data) - sourceRecencyScore(a.data))[0];
    return {
      ...group,
      titulo: best?.titulo || group.items[0]?.titulo || "Pauta editorial",
      sourceCount,
      keywords: unique(group.items.flatMap((item) => tokens(`${item.titulo} ${item.resumo_feed}`))).slice(0, 10),
    };
  });
}

export function isDuplicatePauta(pauta, posts = []) {
  return posts.some((post) => titleSimilarity(pauta.titulo, post.titulo) >= 0.5 || titleSimilarity(pauta.keywords?.join(" "), [...(post.tags || []), post.titulo].join(" ")) >= 0.55);
}

export function rankPautas(pautas, config, posts = [], now = new Date()) {
  const weights = config.weights || {};
  return pautas.map((pauta) => {
    const recency = Math.max(...pauta.items.map((item) => sourceRecencyScore(item.data, now)), 0);
    const sourceCount = Math.min(1, pauta.sourceCount / Math.max(1, config.limits?.minSourcesForStrongPauta || 2));
    const topicRelevance = Math.max(...pauta.items.map((item) => topicRelevanceScore(item, config.topics || [])), 0);
    const keywordRepetition = keywordRepetitionScore(pauta);
    const sourceQuality = pauta.items.reduce((sum, item) => sum + item.sourceQuality, 0) / Math.max(1, pauta.items.length);
    const novelty = isDuplicatePauta(pauta, posts) ? 0 : 1;
    const score = recency * (weights.recency || 1)
      + sourceCount * (weights.sourceCount || 1)
      + topicRelevance * (weights.topicRelevance || 1)
      + keywordRepetition * (weights.keywordRepetition || 1)
      + sourceQuality * (weights.sourceQuality || 1)
      + novelty * (weights.novelty || 1);
    return { ...pauta, score: Number(score.toFixed(3)), scoreParts: { recency, sourceCount, topicRelevance, keywordRepetition, sourceQuality, novelty } };
  }).sort((a, b) => b.score - a.score);
}

function normalizeUrlKey(value) {
  try {
    const url = new URL(value);
    url.hash = "";
    return url.href.replace(/\/$/, "");
  } catch {
    return String(value || "").replace(/\/$/, "");
  }
}

export function buildSecondaryQueries(pauta = {}, config = {}) {
  const limits = config.limits || {};
  const aliases = config.sourceDiscovery?.queryAliases || {};
  const maxQueries = Number(limits.maxSecondaryQueries || 5);
  const base = unique([
    pauta.titulo,
    (pauta.keywords || []).slice(0, 5).join(" "),
    ...(pauta.items || []).slice(0, 2).map((item) => item.titulo),
  ].map(clean)).filter(Boolean);
  const aliasQueries = unique(tokens([pauta.titulo, pauta.keywords?.join(" ")].join(" ")).flatMap((word) => aliases[word] || []));
  return unique([...base, ...aliasQueries].map((query) => clean(query).slice(0, 140))).slice(0, maxQueries);
}

function sourceCandidateRelevance(candidate, pauta, queries) {
  const queryText = queries.join(" ");
  return Math.max(candidateSimilarity(candidate, { titulo: pauta.titulo, resumo_feed: pauta.keywords?.join(" ") }), setSimilarity(candidateText(candidate), queryText));
}

function sourceCandidateScore(candidate, relevance, now = new Date()) {
  const recency = sourceRecencyScore(candidate.data, now);
  const authority = Number(candidate.sourceQuality || 0.75);
  const depth = Math.min(1, clean(candidate.resumo_feed).length / 220);
  return Number((relevance * 4 + recency * 1.4 + authority * 1.2 + depth * 0.7).toFixed(3));
}

function commandTopicRelevance(pauta = {}, commandTopic = "") {
  if (!commandTopic) return 1;
  const pautaText = [pauta.titulo, pauta.keywords?.join(" "), ...(pauta.items || []).flatMap((item) => [item.titulo, item.resumo_feed])].join(" ");
  const normalizedPauta = normalizeText(pautaText);
  const normalizedTopic = normalizeText(commandTopic);
  if (normalizedTopic && normalizedPauta.includes(normalizedTopic)) return 1;
  return Math.max(setSimilarity(pautaText, commandTopic), titleSimilarity(pauta.titulo || "", commandTopic));
}

export function selectSourcesForPauta(pauta, maxSources = 5) {
  const seenUrls = new Set();
  const seenSources = new Set();
  return [...pauta.items]
    .sort((a, b) => (b.discoveryScore ?? b.sourceQuality ?? 0) - (a.discoveryScore ?? a.sourceQuality ?? 0) || sourceRecencyScore(b.data) - sourceRecencyScore(a.data))
    .filter((item) => {
      const urlKey = normalizeUrlKey(item.url);
      const sourceKey = normalizeText(item.fonte);
      if (seenUrls.has(urlKey) || seenSources.has(sourceKey)) return false;
      seenUrls.add(urlKey);
      seenSources.add(sourceKey);
      return true;
    })
    .slice(0, maxSources);
}

export async function discoverSecondarySources({ pauta, config, initialCandidates = [], selectedSources = [], fetchImpl = fetch, lookup = dns.lookup, now = new Date() } = {}) {
  const limits = config.limits || {};
  const queries = buildSecondaryQueries(pauta, config);
  const maxCandidates = Number(limits.maxSecondaryCandidates || 80);
  const maxSources = Number(limits.maxSourcesSelected || limits.maxSourcesPerPost || 5);
  const pool = [...initialCandidates];
  for (const source of config.secondarySources || []) {
    const collected = await collectCandidates({ ...config, sources: [source] }, { fetchImpl, lookup, now });
    pool.push(...collected.candidates);
  }
  const selectedKeys = new Set(selectedSources.map((item) => normalizeUrlKey(item.url)));
  const candidates = pool
    .filter((item) => item?.url && !selectedKeys.has(normalizeUrlKey(item.url)))
    .map((item) => {
      const discoveryRelevance = sourceCandidateRelevance(item, pauta, queries);
      return { ...item, discoveryRelevance, discoveryScore: sourceCandidateScore(item, discoveryRelevance, now) };
    })
    .filter((item) => item.discoveryRelevance >= Number(limits.secondarySourceMinRelevance || 0.24) && item.discoveryScore >= Number(limits.secondarySourceMinScore || 1.15))
    .sort((a, b) => b.discoveryScore - a.discoveryScore)
    .slice(0, maxCandidates);
  const seededSources = selectedSources.map((item) => ({ ...item, discoveryRelevance: 1, discoveryScore: Number.MAX_SAFE_INTEGER }));
  const sources = selectSourcesForPauta({ items: [...seededSources, ...candidates] }, maxSources);
  return {
    queries,
    candidates,
    sources,
    uniqueSources: new Set(sources.map((item) => normalizeText(item.fonte))).size,
  };
}

export function classifyPauta(pauta = {}, articles = [], commandTopic = "") {
  const text = normalizeText([
    commandTopic,
    pauta.titulo,
    pauta.keywords?.join(" "),
    ...(pauta.items || []).flatMap((item) => [item.titulo, item.resumo_feed, item.categoria]),
    ...articles.flatMap((article) => [article.tituloOriginal, article.conteudo?.slice(0, 500)]),
  ].join(" "));
  const headline = normalizeText(`${commandTopic || ""} ${pauta.titulo || ""} ${pauta.keywords?.join(" ") || ""}`);
  if (/\b(tendencia|tendencias|futuro|mercado|panorama|transformacao|cenarios?)\b/.test(headline)) return "trend";
  const eventMatch = /\b(workshop|seminario|evento|encontro|curso|congresso|webinar|agenda|inscric|vagas|carga horaria)\b/.test(text);
  const technicalHeadline = /\b(selos?|certificac|leed|aqua|hqe|construcao verde|construcoes verdes|sustentabilidade|sustentavel)\b/.test(headline);
  if (eventMatch && !commandTopic) return "event";
  if (technicalHeadline) return "technical_topic";
  if (eventMatch) return "event";
  if (/\b(anuncia|lanca|lancamento|comunicado|edital|aviso|publica|abre inscric)\b/.test(text)) return "announcement";
  if (/\b(tendencia|futuro|mercado|panorama|transformacao|avanca|cresce|cenarios?)\b/.test(text)) return "trend";
  if (/\b(analise|impacto|efeito|desafio|oportunidade|beneficio|comparativo)\b/.test(text)) return "analysis";
  if (/\b(bim|leed|aqua|hqe|certificac|sustentavel|sustentabilidade|inteligencia artificial|metodo construtivo|tecnica|tecnico)\b/.test(text)) return "technical_topic";
  return (pauta.sourceCount || articles.length || 0) <= 1 ? "single_source_news" : "trend";
}

function textSimilarity(a, b) {
  return setSimilarity(tokens(a).slice(0, 220).join(" "), tokens(b).slice(0, 220).join(" "));
}

function syndicationHint(source = {}, other = {}) {
  const text = normalizeText(`${source.autor || ""} ${source.conteudo || ""}`);
  const otherName = normalizeText(`${other.fonte || ""} ${hostname(other.url)}`);
  return otherName && text.includes(otherName) && titleSimilarity(source.tituloOriginal || source.titulo, other.tituloOriginal || other.titulo) >= 0.45;
}

export function isIndependentSource(source = {}, other = {}) {
  const sourceUrl = normalizeUrlKey(source.url || source.canonical || "");
  const otherUrl = normalizeUrlKey(other.url || other.canonical || "");
  if (sourceUrl && otherUrl && sourceUrl === otherUrl) return false;
  const titleScore = titleSimilarity(source.tituloOriginal || source.titulo || "", other.tituloOriginal || other.titulo || "");
  const bodyScore = textSimilarity(source.conteudo || source.resumo_feed || "", other.conteudo || other.resumo_feed || "");
  if (titleScore >= 0.72 || bodyScore >= 0.95) return false;
  if (syndicationHint(source, other) || syndicationHint(other, source)) return false;
  const sourceDomain = hostname(source.url) || normalizeText(source.dominio || source.fonte);
  const otherDomain = hostname(other.url) || normalizeText(other.dominio || other.fonte);
  if (sourceDomain && otherDomain && sourceDomain === otherDomain && (titleScore >= 0.42 || bodyScore >= 0.68)) return false;
  return true;
}

export function selectIndependentSources(sources = [], maxSources = 5) {
  const selected = [];
  const discarded = [];
  for (const source of sources) {
    const duplicate = selected.find((item) => !isIndependentSource(source, item));
    if (duplicate) {
      discarded.push({ fonte: source.fonte, url: source.url, reason: "not_independent" });
      continue;
    }
    selected.push(source);
    if (selected.length >= maxSources) break;
  }
  return { sources: selected, discarded };
}

export function countIndependentSources(sources = []) {
  return selectIndependentSources(sources, sources.length).sources.length;
}

export function validateSourcePolicy(pautaType, sources = []) {
  const independentSources = countIndependentSources(sources);
  const needsMultiple = ["trend", "analysis", "technical_topic"].includes(pautaType);
  return {
    ok: sources.length > 0 && (!needsMultiple || independentSources >= 2),
    pautaType,
    sources: sources.length,
    independentSources,
    minIndependentSources: needsMultiple ? 2 : 1,
    reason: sources.length === 0
      ? "Nenhuma fonte real foi lida."
      : needsMultiple && independentSources < 2
        ? "Pauta ampla exige pelo menos 2 fontes independentes ou escopo reduzido."
        : "",
  };
}

export async function extractArticle(source, { fetchImpl = fetch, lookup = dns.lookup, config = {} } = {}) {
  const result = await fetchSafe(source.url, {
    fetchImpl,
    lookup,
    timeoutMs: config.limits?.timeoutMs || 15000,
    maxBytes: config.limits?.maxHtmlBytes || 900000,
    maxRedirects: config.limits?.maxRedirects || 4,
  });
  const html = result.body.toString("utf8");
  const dom = new JSDOM(html, { url: result.url, virtualConsole: new VirtualConsole() });
  const document = dom.window.document;
  const canonical = document.querySelector("link[rel='canonical']")?.href || result.url;
  const author = document.querySelector("meta[name='author']")?.getAttribute("content") || "";
  const published = document.querySelector("meta[property='article:published_time']")?.getAttribute("content") || source.data || "";
  const parsed = new Readability(document).parse();
  const title = clean(parsed?.title || document.title || source.titulo);
  const text = clean(stripHtml(parsed?.content || document.body?.textContent || ""));
  if (!title || text.length < 300) throw new Error("Artigo sem conteudo principal suficiente.");
  const url = new URL(canonical);
  return {
    fonte: source.fonte,
    tituloOriginal: title,
    url: canonical,
    dominio: url.hostname.replace(/^www\./, ""),
    autor: clean(author) || null,
    data: clean(published) || null,
    conteudo: text.slice(0, 9000),
  };
}

export function buildEditorialPrompt({ config, pauta, articles, posts }) {
  return [
    "Voce e o ELO AUTOPILOT, um editor tecnico para um site brasileiro de engenharia, arquitetura e tecnologia aplicada a construcao.",
    "Escreva uma sintese editorial original em portugues do Brasil, baseada nas fontes fornecidas.",
    "Nao copie paragrafos, frases longas ou estruturas da fonte; nao invente entrevistas, numeros, falas, fontes ou experiencia propria.",
    "Diferencie mentalmente FATO SUPORTADO, INFERENCIA e CONHECIMENTO GERAL. Para publicacao automatica, apenas FATO SUPORTADO pode aparecer como afirmacao factual.",
    "Nao use conhecimento geral do modelo para complementar a materia, salvo quando a informacao estiver sustentada pelas fontes fornecidas.",
    "Nao acrescente beneficios, impactos, estatisticas, tendencias, consequencias, datas, numeros, nomes, certificacoes, efeitos ambientais, economicos ou sociais que nao estejam explicitamente sustentados pelas fontes fornecidas.",
    "Se uma ideia parecer provavel, mas nao estiver nas fontes, omita. Nao transforme contexto geral em fato atribuido ao evento/noticia.",
    "Se houver apenas uma fonte, limite o escopo ao que essa fonte sustenta claramente.",
    "Retorne somente JSON valido com: titulo, subtitulo, resumo, conteudo, seoTitle, seoDescription, slug, categoria, tags, imagePrompt, claims.",
    "conteudo deve ser um array de blocos: { subtitulo, paragrafos }.",
    "claims deve ser um array de objetos { claim, sourceIds }. Cada afirmacao factual relevante do artigo precisa aparecer em claims e apontar para sourceIds validos.",
    `Marca: ${config.brand}`,
    `Temas: ${(config.topics || []).join(", ")}`,
    `Pauta escolhida: ${pauta.titulo}`,
    `Historico recente: ${(posts || []).slice(0, 8).map((post) => post.titulo).join(" | ") || "sem posts"}`,
    "Fontes extraidas:",
    ...articles.map((article, index) => {
      const sourceId = article.sourceId || `source_${index + 1}`;
      return `${index + 1}. sourceId: ${sourceId}\nFonte: ${article.fonte}\nTitulo: ${article.tituloOriginal}\nURL: ${article.url}\nConteudo:\n${article.conteudo.slice(0, 3000)}`;
    }),
  ].join("\n\n");
}

function extractJson(text) {
  const raw = clean(text);
  if (raw.startsWith("{")) return JSON.parse(raw);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Resposta LLM sem JSON.");
  return JSON.parse(match[0]);
}

function redactSensitive(value) {
  let text = clean(value);
  const apiKey = clean(process.env.OPENAI_API_KEY);
  if (apiKey) text = text.split(apiKey).join("[REDACTED]");
  return text
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED]")
    .replace(/\b[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g, "[REDACTED]")
    .slice(0, 700);
}

function openAiRequestId(response) {
  return response?.headers?.get?.("x-request-id")
    || response?.headers?.get?.("request-id")
    || response?.headers?.get?.("openai-request-id")
    || "";
}

function classifyOpenAiFailure({ status = 0, code = "", type = "", message = "", errorName = "" } = {}) {
  const normalizedCode = normalizeText(code);
  const normalizedType = normalizeText(type);
  const normalizedMessage = normalizeText(message);
  const normalizedName = normalizeText(errorName);
  if (normalizedName.includes("abort") || normalizedCode.includes("timeout") || normalizedMessage.includes("timeout")) return "TIMEOUT";
  if (!status && (normalizedName.includes("typeerror") || normalizedMessage.includes("fetch") || normalizedMessage.includes("network") || normalizedCode.includes("econn") || normalizedCode.includes("enotfound"))) return "NETWORK_ERROR";
  if (status === 401) return "AUTH_ERROR";
  if (status === 403) return "PERMISSION_ERROR";
  if (status === 404 || normalizedCode.includes("model") || normalizedType.includes("model") || normalizedMessage.includes("model")) return "MODEL_ERROR";
  if (status === 429) return "RATE_LIMIT_OR_QUOTA";
  if (status >= 500) return "OPENAI_SERVICE_ERROR";
  return "UNKNOWN_ERROR";
}

export function buildOpenAiErrorDiagnostic({ status = 0, payload = null, model = "", requestId = "", cause = null } = {}) {
  const error = payload?.error && typeof payload.error === "object" ? payload.error : {};
  const message = redactSensitive(error.message || cause?.message || (status ? `OpenAI HTTP ${status}` : "OpenAI call failed"));
  const code = redactSensitive(error.code || cause?.code || "");
  const type = redactSensitive(error.type || cause?.name || "");
  return {
    provider: "openai",
    status: status || null,
    classification: classifyOpenAiFailure({ status, code, type, message, errorName: cause?.name }),
    type: type || null,
    code: code || null,
    message,
    model: redactSensitive(model),
    requestId: redactSensitive(requestId),
  };
}

export function formatOpenAiDiagnostic(diagnostic = {}) {
  return [
    "OPENAI CALL FAILED",
    `HTTP STATUS: ${diagnostic.status ?? "n/a"}`,
    `ERROR CLASSIFICATION: ${diagnostic.classification || "UNKNOWN_ERROR"}`,
    `ERROR TYPE/CODE: ${[diagnostic.type, diagnostic.code].filter(Boolean).join(" / ") || "n/a"}`,
    `ERROR MESSAGE: ${diagnostic.message || "n/a"}`,
    `MODEL: ${diagnostic.model || "n/a"}`,
    `REQUEST ID: ${diagnostic.requestId || "n/a"}`,
  ];
}

function createOpenAiError(diagnostic) {
  const error = new Error(diagnostic.message || "OpenAI call failed");
  error.name = "OpenAiCallError";
  error.openAiDiagnostic = diagnostic;
  return error;
}

export async function generateEditorialArticle({ config, pauta, articles, posts = [], fetchImpl = fetch } = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY ausente.");
  const model = process.env[config.llm?.modelEnv || "OPENAI_ELO_AUTOPILOT_MODEL"] || process.env[config.llm?.fallbackModelEnv || "OPENAI_MODEL"] || "gpt-4.1-mini";
  const prompt = buildEditorialPrompt({ config, pauta, articles, posts });
  let response;
  try {
    response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        input: [
          { role: "system", content: "Voce gera JSON editorial estrito para publicacao web." },
          { role: "user", content: prompt },
        ],
        text: { format: { type: "json_object" } },
      }),
    });
  } catch (error) {
    throw createOpenAiError(buildOpenAiErrorDiagnostic({ model, cause: error }));
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw createOpenAiError(buildOpenAiErrorDiagnostic({ status: response.status, payload, model, requestId: openAiRequestId(response) }));
  }
  const output = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((item) => item.text || "").join("\n") || "";
  return { article: validateLlmArticle(extractJson(output)), usage: payload.usage || null, model };
}

export function validateLlmArticle(article) {
  const required = ["titulo", "resumo", "conteudo", "seoTitle", "seoDescription", "slug", "categoria", "tags", "imagePrompt"];
  for (const key of required) {
    if (article[key] == null || article[key] === "") throw new Error(`Campo LLM ausente: ${key}`);
  }
  const slug = slugify(article.slug || article.titulo);
  const blocks = Array.isArray(article.conteudo) ? article.conteudo : [];
  if (!blocks.length) throw new Error("Artigo sem blocos.");
  const normalizedBlocks = blocks.map((block) => ({
    subtitulo: clean(block.subtitulo),
    paragrafos: Array.isArray(block.paragrafos) ? block.paragrafos.map(clean).filter(Boolean) : [],
  })).filter((block) => block.subtitulo && block.paragrafos.length);
  if (!normalizedBlocks.length) throw new Error("Artigo sem paragrafos.");
  return {
    titulo: clean(article.titulo),
    subtitulo: clean(article.subtitulo),
    resumo: clean(article.resumo),
    conteudo: normalizedBlocks,
    seoTitle: clean(article.seoTitle).slice(0, 70),
    seoDescription: clean(article.seoDescription).slice(0, 160),
    slug,
    categoria: clean(article.categoria),
    tags: Array.isArray(article.tags) ? article.tags.map(clean).filter(Boolean).slice(0, 8) : [],
    imagePrompt: clean(article.imagePrompt),
    claims: Array.isArray(article.claims) ? article.claims.map((claim) => ({
      claim: clean(claim?.claim),
      sourceIds: Array.isArray(claim?.sourceIds) ? claim.sourceIds.map(clean).filter(Boolean) : [],
    })).filter((claim) => claim.claim) : [],
  };
}

function articlePlainText(article) {
  return [article.titulo, article.resumo, ...article.conteudo.flatMap((block) => [block.subtitulo, ...block.paragrafos])].join(" ");
}

function ngrams(text, size = 12) {
  const words = normalizeText(text).split(/\s+/).filter(Boolean);
  const result = new Set();
  for (let i = 0; i <= words.length - size; i += 1) result.add(words.slice(i, i + size).join(" "));
  return result;
}

export function antiCopyCheck(article, sources, { maxLongMatches = 2, maxParagraphSimilarity = 0.72 } = {}) {
  const generatedText = articlePlainText(article);
  const generatedNgrams = ngrams(generatedText, 12);
  let longMatches = 0;
  for (const source of sources) {
    const sourceNgrams = ngrams(source.conteudo, 16);
    for (const gram of generatedNgrams) if (sourceNgrams.has(gram)) longMatches += 1;
  }
  const paragraphs = article.conteudo.flatMap((block) => block.paragrafos);
  let maxSimilarity = 0;
  for (const paragraph of paragraphs) {
    for (const source of sources) maxSimilarity = Math.max(maxSimilarity, titleSimilarity(paragraph, source.conteudo));
  }
  return {
    ok: longMatches <= maxLongMatches && maxSimilarity <= maxParagraphSimilarity,
    longMatches,
    maxParagraphSimilarity: Number(maxSimilarity.toFixed(3)),
  };
}

export function antiHallucinationCheck(article, sources, pauta) {
  const text = normalizeText(articlePlainText(article));
  const sourceText = normalizeText(sources.map((source) => source.conteudo).join(" "));
  const topicWords = tokens(`${pauta.titulo} ${pauta.keywords?.join(" ")}`).slice(0, 8);
  const supportedTerms = topicWords.filter((word) => text.includes(word) && sourceText.includes(word));
  return {
    ok: sources.length > 0 && article.titulo.length >= 12 && articlePlainText(article).length >= 900 && supportedTerms.length >= Math.min(2, topicWords.length || 2),
    supportedTerms,
  };
}

function claimWords(value) {
  return unique(tokens(value).filter((word) => !["fonte", "segundo", "afirma", "aponta", "destaca", "materia", "evento"].includes(word)));
}

function sourceIdsFor(sources = []) {
  return sources.map((source, index) => source.sourceId || source.id || `source_${index + 1}`);
}

function claimSupportScore(claim, source) {
  const words = claimWords(claim);
  if (!words.length) return 0;
  const sourceText = normalizeText(`${source.tituloOriginal || ""} ${source.conteudo || ""}`);
  const hits = words.filter((word) => sourceText.includes(word)).length;
  const ratio = hits / words.length;
  const exactShort = normalizeText(claim).length >= 28 && sourceText.includes(normalizeText(claim).slice(0, 120));
  return Math.max(ratio, exactShort ? 0.95 : 0);
}

export function validateClaimsAgainstSources(article, sources = {}, { minScore = 0.62 } = {}) {
  const sourceList = Array.isArray(sources) ? sources : Object.values(sources || {});
  const validIds = sourceIdsFor(sourceList);
  const byId = new Map(sourceList.map((source, index) => [validIds[index], source]));
  const claims = Array.isArray(article?.claims) ? article.claims : [];
  const unsupportedClaims = [];
  const supportedClaims = [];
  const warnings = [];
  if (!sourceList.length) warnings.push("article_without_sources");
  if (!claims.length) unsupportedClaims.push({ claim: "[sem claims]", sourceIds: [], reason: "missing_claims" });
  for (const entry of claims) {
    const claim = clean(entry?.claim);
    const sourceIds = Array.isArray(entry?.sourceIds) ? entry.sourceIds.map(clean).filter(Boolean) : [];
    if (!claim) continue;
    if (!sourceIds.length) {
      unsupportedClaims.push({ claim, sourceIds, reason: "missing_source_id" });
      continue;
    }
    const missing = sourceIds.filter((id) => !byId.has(id));
    if (missing.length) {
      unsupportedClaims.push({ claim, sourceIds, reason: "invalid_source_id", missingSourceIds: missing });
      continue;
    }
    const scored = sourceIds.map((id) => ({ id, score: claimSupportScore(claim, byId.get(id)) }));
    const best = scored.reduce((max, item) => Math.max(max, item.score), 0);
    if (best < minScore) {
      unsupportedClaims.push({ claim, sourceIds, reason: "unsupported_by_text", bestScore: Number(best.toFixed(3)) });
      continue;
    }
    supportedClaims.push({ claim, sourceIds, bestScore: Number(best.toFixed(3)) });
  }
  return {
    ok: sourceList.length > 0 && unsupportedClaims.length === 0,
    claims: claims.length,
    supportedClaims,
    unsupportedClaims,
    warnings,
    validSourceIds: validIds,
  };
}

function sentences(value) {
  return clean(value).split(/(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function removeUnsupportedSentences(text, unsupportedClaims) {
  const unsupportedWords = unsupportedClaims.map((item) => claimWords(item.claim));
  return sentences(text).filter((sentence) => {
    const sentenceText = normalizeText(sentence);
    return !unsupportedWords.some((words) => {
      if (!words.length) return false;
      const hits = words.filter((word) => sentenceText.includes(word)).length;
      return hits / Math.max(1, words.length) >= 0.5;
    });
  }).join(" ");
}

export function reviseUnsupportedClaims(article, verification) {
  const unsupported = verification?.unsupportedClaims || [];
  if (!unsupported.length) return article;
  const content = (article.conteudo || []).map((block) => ({
    subtitulo: block.subtitulo,
    paragrafos: (block.paragrafos || []).map((paragraph) => removeUnsupportedSentences(paragraph, unsupported)).filter(Boolean),
  })).filter((block) => block.subtitulo && block.paragrafos.length);
  return {
    ...article,
    conteudo: content,
    claims: (article.claims || []).filter((claim) => !unsupported.some((item) => normalizeText(item.claim) === normalizeText(claim.claim))),
  };
}

export function runFactualVerifier(article, sources, { allowLlmVerifier = false } = {}) {
  const deterministic = validateClaimsAgainstSources(article, sources);
  return {
    supported: deterministic.ok,
    unsupportedClaims: deterministic.unsupportedClaims,
    warnings: deterministic.warnings,
    deterministic,
    llmVerifierUsed: false,
    usage: allowLlmVerifier ? { model: null, inputTokens: 0, outputTokens: 0, estimatedCost: null, skipped: "deterministic_gate" } : null,
  };
}

export function enforceFactualGrounding(article, sources, { allowAutoRevision = true } = {}) {
  const first = runFactualVerifier(article, sources);
  if (first.supported) return { ok: true, article, verifier: first, autoRevision: false };
  if (!allowAutoRevision) return { ok: false, article, verifier: first, autoRevision: false };
  const revised = reviseUnsupportedClaims(article, first.deterministic);
  const second = runFactualVerifier(revised, sources);
  return {
    ok: second.supported,
    article: revised,
    verifier: second,
    autoRevision: true,
    firstVerifier: first,
  };
}

export async function generateEditorialImage({ article, config, fetchImpl = fetch, outputDir = IMAGE_DIR } = {}) {
  const slug = safePostSlug(article.slug);
  const imageConfig = config.image || {};
  if (imageConfig.provider !== "pollinations") throw new Error("Provedor de imagem nao configurado.");
  const width = Number(imageConfig.width || 1200);
  const height = Number(imageConfig.height || 675);
  const prompt = `${article.imagePrompt}. Editorial illustration, Brazilian construction, architecture and engineering context, no logos, no text in image.`;
  const url = new URL(`https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`);
  url.searchParams.set("width", String(width));
  url.searchParams.set("height", String(height));
  url.searchParams.set("nologo", "true");
  if (imageConfig.model) url.searchParams.set("model", imageConfig.model);
  const response = await fetchImpl(url.href, { headers: { "user-agent": USER_AGENT, accept: "image/jpeg,image/webp,image/png" } });
  const contentType = response.headers?.get?.("content-type") || "";
  if (!response.ok) throw new Error(`Imagem HTTP ${response.status}`);
  if (!/^image\/(jpeg|png|webp)\b/i.test(contentType)) throw new Error(`Imagem Content-Type recusado: ${contentType || "ausente"}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1000 || buffer.byteLength > 5_000_000) throw new Error("Imagem fora do tamanho esperado.");
  await mkdir(outputDir, { recursive: true });
  const ext = contentType.includes("webp") ? "webp" : contentType.includes("png") ? "png" : "jpg";
  const relative = `./assets/posts/${slug}.${ext}`;
  await writeFile(path.join(outputDir, `${slug}.${ext}`), buffer);
  return {
    path: relative,
    absolutePath: path.join(outputDir, `${slug}.${ext}`),
    provider: "pollinations",
    prompt,
    contentType,
    bytes: buffer.byteLength,
    usage: {
      imageTokens: response.headers?.get?.("x-usage-total-tokens") || null,
      model: response.headers?.get?.("x-model-used") || imageConfig.model || null,
    },
  };
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toArticleHtml(post) {
  return post.conteudo.map((block) => `<h2>${escapeHtml(block.subtitulo)}</h2>\n${block.paragrafos.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n")}`).join("\n");
}

export function buildPostPage(post) {
  const url = `${SITE_ORIGIN}/novidades/posts/${post.slug}/`;
  const imageUrl = `${SITE_ORIGIN}/novidades/${post.imagem.replace(/^\.\//, "")}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.titulo,
    description: post.seoDescription || post.resumo,
    image: imageUrl,
    datePublished: post.publicadoEm,
    dateModified: post.publicadoEm,
    author: { "@type": "Organization", name: "Amaral Engenharia" },
    publisher: { "@type": "Organization", name: "Amaral Engenharia" },
    mainEntityOfPage: url,
  };
  const jsonLdText = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(post.seoTitle || post.titulo)}</title>
    <meta name="description" content="${escapeHtml(post.seoDescription || post.resumo)}">
    <link rel="canonical" href="${escapeHtml(url)}">
    <meta name="robots" content="index,follow">
    <meta property="og:title" content="${escapeHtml(post.titulo)}">
    <meta property="og:description" content="${escapeHtml(post.resumo)}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:image" content="${escapeHtml(imageUrl)}">
    <link rel="stylesheet" href="../../novidades.css">
    <script type="application/ld+json">${jsonLdText}</script>
  </head>
  <body>
    <header class="site-header"><div class="header-inner"><a class="brand-link" href="/">Engenharia, Arquitetura, Urbanismo e Tecnologia</a><nav aria-label="Navegação principal"><a href="/novidades/">Novidades</a><a href="/">Voltar ao site</a></nav></div></header>
    <main class="article-shell">
      <p class="article-kicker">${escapeHtml(post.categoria)}</p>
      <h1>${escapeHtml(post.titulo)}</h1>
      <p class="article-meta">${escapeHtml(new Date(post.publicadoEm).toLocaleDateString("pt-BR", { dateStyle: "long" }))} · Síntese editorial</p>
      <figure class="article-cover"><img src="../../${escapeHtml(post.imagem.replace(/^\.\//, ""))}" alt="${escapeHtml(post.imagemAlt)}"></figure>
      <article class="article-content">${toArticleHtml(post)}</article>
      <section class="sources" aria-labelledby="fontes-titulo">
        <h2 id="fontes-titulo">Fontes</h2>
        <ul>
          ${post.fontes.map((source) => `<li><a href="${escapeHtml(source.url)}" rel="noopener noreferrer external">${escapeHtml(source.fonte)} — ${escapeHtml(source.tituloOriginal)}</a></li>`).join("\n          ")}
        </ul>
      </section>
    </main>
  </body>
</html>
`;
}

export function buildIndexPayload(posts, now = new Date()) {
  return {
    atualizadoEm: now.toISOString(),
    posts: posts.slice().sort((a, b) => new Date(b.publicadoEm) - new Date(a.publicadoEm)),
  };
}

export function buildSitemap(posts) {
  const urls = [
    `${SITE_ORIGIN}/`,
    `${SITE_ORIGIN}/noticias/`,
    `${SITE_ORIGIN}/novidades/`,
    ...posts.map((post) => `${SITE_ORIGIN}/novidades/posts/${post.slug}/`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${unique(urls).map((url) => `  <url>\n    <loc>${escapeHtml(url)}</loc>\n  </url>`).join("\n")}
</urlset>
`;
}

export async function persistPost(post, previousPayload, now = new Date()) {
  const slug = safePostSlug(post.slug);
  const nextPosts = [post, ...(previousPayload.posts || []).filter((item) => item.slug !== slug)];
  const payload = buildIndexPayload(nextPosts, now);
  await mkdir(path.join(POSTS_DIR, slug), { recursive: true });
  await writeFile(POSTS_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await writeFile(path.join(POSTS_DIR, slug, "index.html"), buildPostPage(post), "utf8");
  await writeFile(SITEMAP_PATH, buildSitemap(payload.posts), "utf8");
  return payload;
}

function estimateCost(usage, config) {
  const pricing = config.pricing || {};
  if (!usage || pricing.inputPerMillion == null || pricing.outputPerMillion == null) return null;
  const input = usage.input_tokens || usage.prompt_tokens || 0;
  const output = usage.output_tokens || usage.completion_tokens || 0;
  return {
    currency: pricing.currency || "USD",
    inputTokens: input,
    outputTokens: output,
    text: (input / 1_000_000) * pricing.inputPerMillion + (output / 1_000_000) * pricing.outputPerMillion,
  };
}

export async function runAutopilot({
  dryRun = false,
  publish = null,
  topic = "",
  configPath = CONFIG_PATH,
  fetchImpl = fetch,
  lookup = dns.lookup,
  now = new Date(),
  log = console.log,
  postsPath = POSTS_PATH,
} = {}) {
  let config = await readConfig(configPath);
  const commandTopic = clean(topic);
  if (commandTopic) config = Object.assign({}, config, { topics: unique([commandTopic].concat(config.topics || [])) });
  const envPublish = String(process.env.AUTOPILOT_PUBLISH || "").toLowerCase() === "true";
  const shouldPublish = publish ?? (envPublish || config.publishDefault === true);
  const report = {
    candidates: 0,
    pautas: 0,
    selected: null,
    sourcesSelected: [],
    sourcesRead: 0,
    llm: "NOT_CALLED",
    antiCopy: "FAIL",
    antiHallucination: "FAIL",
    evidenceMap: "FAIL",
    claimValidation: "FAIL",
    factualVerifier: "FAIL",
    autoRevision: "NAO",
    unsupportedClaimBlock: "FAIL",
    pautaType: "",
    sourcePolicy: null,
    claimStats: { total: 0, supported: 0, unsupported: 0 },
    unsupportedClaims: [],
    verifierUsage: null,
    image: "FAIL",
    post: "FAIL",
    seo: "FAIL",
    sitemap: "FAIL",
    publication: false,
    blockers: [],
    usage: null,
    imageUsage: null,
    cost: null,
    openAiDiagnostic: null,
    commandTopic,
    draftId: "",
    imageAbsolutePath: "",
    sourceDiscovery: {
      secondarySearch: "SKIPPED",
      queries: [],
      secondaryCandidates: 0,
      uniqueSources: 0,
      independentSources: 0,
      discarded: [],
      multiSource: "FAIL",
      scoping: "NAO",
    },
  };
  if (!config.enabled) {
    report.blockers.push("Autopilot desativado na configuracao.");
    return report;
  }
  const previous = await readPosts(postsPath);
  const collected = await collectCandidates(config, { fetchImpl, lookup, now });
  report.candidates = collected.candidates.length;
  const ranked = rankPautas(groupPautas(collected.candidates, config), config, previous.posts, now);
  report.pautas = ranked.length;
  const topicRanked = commandTopic ? ranked.filter((item) => commandTopicRelevance(item, commandTopic) >= Number(config.limits?.commandTopicMinRelevance || 0.18)) : ranked;
  let pauta = topicRanked.find((item) => !isDuplicatePauta(item, previous.posts));
  if (!pauta && commandTopic) {
    pauta = {
      key: slugify(commandTopic),
      items: [],
      titulo: commandTopic,
      sourceCount: 0,
      keywords: tokens(commandTopic).slice(0, 10),
      score: 0,
      scoreParts: { syntheticTopic: 1 },
    };
  }
  if (!pauta) {
    report.blockers.push("Nenhuma pauta nova encontrada.");
    return report;
  }
  report.selected = pauta;
  let selectedSources = selectSourcesForPauta(pauta, config.limits?.maxSourcesPerPost || 5);
  const secondary = await discoverSecondarySources({ pauta, config, initialCandidates: collected.candidates, selectedSources, fetchImpl, lookup, now });
  selectedSources = secondary.sources;
  report.sourceDiscovery.secondarySearch = secondary.queries.length ? "PASS" : "SKIPPED";
  report.sourceDiscovery.queries = secondary.queries;
  report.sourceDiscovery.secondaryCandidates = secondary.candidates.length;
  report.sourceDiscovery.uniqueSources = secondary.uniqueSources;
  report.sourcesSelected = selectedSources;
  const articles = [];
  for (const source of selectedSources.slice(0, Number(config.limits?.maxSourcesToRead || config.limits?.maxSourcesPerPost || 5))) {
    try {
      const article = await extractArticle(source, { fetchImpl, lookup, config });
      articles.push({ ...article, sourceId: `source_${articles.length + 1}` });
    } catch (error) {
      report.blockers.push(`Fonte nao lida: ${source.fonte} (${error.message})`);
    }
  }
  const independent = selectIndependentSources(articles, Number(config.limits?.maxSourcesSelected || config.limits?.maxSourcesPerPost || 5));
  const independentArticles = independent.sources.map((article, index) => ({ ...article, sourceId: `source_${index + 1}` }));
  articles.splice(0, articles.length, ...independentArticles);
  report.sourceDiscovery.discarded = independent.discarded;
  report.sourceDiscovery.independentSources = articles.length;
  report.sourceDiscovery.multiSource = articles.length >= 2 ? "PASS" : "FAIL";
  report.sourcesRead = articles.length;
  if (!articles.length) {
    report.blockers.push("Nenhuma fonte real foi lida.");
    return report;
  }
  let editorialPauta = pauta;
  let pautaType = classifyPauta(editorialPauta, articles, commandTopic);
  report.pautaType = pautaType;
  let sourcePolicy = validateSourcePolicy(pautaType, articles);
  if (!sourcePolicy.ok && articles.length === 1 && ["trend", "analysis", "technical_topic"].includes(pautaType)) {
    const scopedPauta = {
      ...pauta,
      titulo: articles[0].tituloOriginal,
      sourceCount: 1,
      items: [{ titulo: articles[0].tituloOriginal, resumo_feed: articles[0].conteudo.slice(0, 500), fonte: articles[0].fonte, url: articles[0].url, sourceQuality: 1 }],
      keywords: tokens(`${articles[0].tituloOriginal} ${articles[0].conteudo.slice(0, 500)}`).slice(0, 10),
    };
    const scopedType = classifyPauta(scopedPauta, articles, "");
    const scopedPolicy = validateSourcePolicy(scopedType, articles);
    if (scopedPolicy.ok && ["event", "announcement", "single_source_news"].includes(scopedType)) {
      editorialPauta = scopedPauta;
      pautaType = scopedType;
      sourcePolicy = scopedPolicy;
      report.selected = scopedPauta;
      report.pautaType = scopedType;
      report.sourceDiscovery.scoping = "REDUZIDO";
    }
  }
  report.sourcePolicy = sourcePolicy;
  if (!sourcePolicy.ok) {
    report.blockers.push(sourcePolicy.reason || "Politica de fontes rejeitou a pauta.");
    return report;
  }
  let generated;
  try {
    generated = await generateEditorialArticle({ config, pauta: editorialPauta, articles, posts: previous.posts, fetchImpl });
    report.llm = "PASS";
    report.usage = generated.usage;
    report.cost = estimateCost(generated.usage, config);
  } catch (error) {
    report.llm = "FAIL";
    if (error.openAiDiagnostic) {
      report.openAiDiagnostic = error.openAiDiagnostic;
      formatOpenAiDiagnostic(error.openAiDiagnostic).forEach((line) => log(line));
    }
    report.blockers.push(`LLM falhou: ${error.message}`);
    return report;
  }
  const copy = antiCopyCheck(generated.article, articles);
  report.antiCopy = copy.ok ? "PASS" : "FAIL";
  report.copy = copy;
  const hallucination = antiHallucinationCheck(generated.article, articles, editorialPauta);
  report.antiHallucination = hallucination.ok ? "PASS" : "FAIL";
  report.hallucination = hallucination;
  const grounding = enforceFactualGrounding(generated.article, articles);
  generated.article = grounding.article;
  report.evidenceMap = generated.article.claims.length > 0 ? "PASS" : "FAIL";
  report.claimValidation = grounding.verifier.deterministic.ok ? "PASS" : "FAIL";
  report.factualVerifier = grounding.verifier.supported ? "PASS" : "FAIL";
  report.autoRevision = grounding.autoRevision ? "SIM" : "NAO";
  report.unsupportedClaimBlock = grounding.ok ? "PASS" : "FAIL";
  report.unsupportedClaims = grounding.verifier.unsupportedClaims;
  report.claimStats = {
    total: grounding.verifier.deterministic.claims,
    supported: grounding.verifier.deterministic.supportedClaims.length,
    unsupported: grounding.verifier.unsupportedClaims.length,
  };
  report.verifierUsage = grounding.verifier.usage || { model: null, inputTokens: 0, outputTokens: 0, estimatedCost: null };
  if (!copy.ok || !hallucination.ok || !grounding.ok || isDuplicatePauta({ titulo: generated.article.titulo, keywords: generated.article.tags }, previous.posts)) {
    report.blockers.push(grounding.ok ? "Validacao editorial rejeitou o artigo." : "Claims sem suporte bloquearam a publicacao.");
    return report;
  }
  let image = null;
  try {
    if (dryRun || !shouldPublish) {
      image = await generateEditorialImage({ article: generated.article, config, fetchImpl, outputDir: path.join(os.tmpdir(), "elo-autopilot-images") });
    } else {
      image = await generateEditorialImage({ article: generated.article, config, fetchImpl });
    }
    report.image = "PASS";
    report.imageUsage = image.usage;
    report.imageAbsolutePath = image.absolutePath;
  } catch (error) {
    report.blockers.push(`Imagem falhou: ${error.message}`);
    return report;
  }
  const post = {
    id: hash(`${generated.article.slug}|${now.toISOString()}`),
    slug: generated.article.slug,
    titulo: generated.article.titulo,
    subtitulo: generated.article.subtitulo,
    resumo: generated.article.resumo,
    conteudo: generated.article.conteudo,
    categoria: generated.article.categoria,
    tags: generated.article.tags,
    imagem: image.path,
    imagemAlt: `Ilustração editorial sobre ${generated.article.titulo}`,
    publicadoEm: now.toISOString(),
    criadoEm: now.toISOString(),
    fontes: articles.map((article) => ({
      fonte: article.fonte,
      tituloOriginal: article.tituloOriginal,
      url: article.url,
      dominio: article.dominio,
      autor: article.autor,
      data: article.data,
    })),
    seoTitle: generated.article.seoTitle,
    seoDescription: generated.article.seoDescription,
    autopilot: {
      pauta: pauta.titulo,
      score: pauta.score,
      imageProvider: image.provider,
      imagePrompt: image.prompt,
      llmProvider: "openai",
      llmModel: generated.model,
      pautaType,
      claims: generated.article.claims,
      claimStats: report.claimStats,
    },
  };
  report.post = "PASS";
  report.seo = post.seoTitle && post.seoDescription && post.slug && post.fontes.length ? "PASS" : "FAIL";
  report.draftId = hash(`${post.slug}|${commandTopic || pauta.titulo}|${now.toISOString()}`);
  report.postPreview = post;
  if (!dryRun && shouldPublish) {
    await persistPost(post, previous, now);
    report.publication = true;
    report.sitemap = "PASS";
  } else {
    report.sitemap = buildSitemap([post, ...previous.posts]).includes(`/novidades/posts/${post.slug}/`) ? "PASS" : "FAIL";
  }
  logReport(report, { log, dryRun, shouldPublish });
  return report;
}

export async function prepareEditorialPost({ topic = "", configPath = CONFIG_PATH, fetchImpl = fetch, lookup = dns.lookup, now = new Date(), log = () => {} } = {}) {
  const report = await runAutopilot({ dryRun: true, publish: false, topic, configPath, fetchImpl, lookup, now, log });
  if (report.post !== "PASS" || !report.postPreview) {
    const error = new Error(report.blockers && report.blockers.length ? report.blockers.join("; ") : "elo_autopilot_prepare_failed");
    error.report = report;
    throw error;
  }
  return {
    draftId: report.draftId,
    topic: clean(topic),
    report,
    post: report.postPreview,
    imageAbsolutePath: report.imageAbsolutePath,
    preparedAt: now.toISOString(),
  };
}

export async function publishPreparedEditorialPost(draft, { now = new Date(), readPostsFn = readPosts, persistPostFn = persistPost, imageDir = IMAGE_DIR } = {}) {
  const safe = draft && typeof draft === "object" ? draft : null;
  if (!safe || !safe.post) throw new Error("draft_required");
  const post = Object.assign({}, safe.post, { publicadoEm: safe.post.publicadoEm || now.toISOString(), criadoEm: safe.post.criadoEm || now.toISOString() });
  safePostSlug(post.slug);
  if (safe.imageAbsolutePath) {
    const finalImagePath = path.join(imageDir, path.basename(safe.imageAbsolutePath));
    await mkdir(imageDir, { recursive: true });
    if (path.resolve(safe.imageAbsolutePath) !== path.resolve(finalImagePath)) await copyFile(safe.imageAbsolutePath, finalImagePath);
  }
  const previous = await readPostsFn();
  await persistPostFn(post, previous, now);
  return { ok: true, post, publication: true, sitemap: "PASS" };
}

export function logReport(report, { log = console.log, dryRun = false, shouldPublish = false } = {}) {
  log("ELO AUTOPILOT");
  log(`CANDIDATOS: ${report.candidates}`);
  log(`PAUTAS: ${report.pautas}`);
  log(`PAUTA ESCOLHIDA: ${report.selected?.titulo || "nenhuma"}`);
  log(`SCORE: ${report.selected?.score ?? "n/a"}`);
  if (report.sourceDiscovery) {
    log("QUERY SECUNDARIA:");
    (report.sourceDiscovery.queries || []).forEach((query, index) => log(`${index + 1}. ${query}`));
    log(`CANDIDATOS SECUNDARIOS: ${report.sourceDiscovery.secondaryCandidates ?? 0}`);
    log(`FONTES UNICAS: ${report.sourceDiscovery.uniqueSources ?? 0}`);
    log(`FONTES INDEPENDENTES DISCOVERY: ${report.sourceDiscovery.independentSources ?? 0}`);
    log(`FONTES DESCARTADAS: ${(report.sourceDiscovery.discarded || []).length}`);
    (report.sourceDiscovery.discarded || []).forEach((item) => log(`- ${item.fonte || "n/a"}: ${item.reason}`));
    log(`MULTI-SOURCE: ${report.sourceDiscovery.multiSource || "FAIL"}`);
    log(`ESCOPING: ${report.sourceDiscovery.scoping || "NAO"}`);
  }
  log("FONTES:");
  report.sourcesSelected.forEach((source, index) => log(`${index + 1}. ${source.fonte} - ${source.titulo}`));
  log(`FONTES LIDAS: ${report.sourcesRead}/${report.sourcesSelected.length}`);
  log(`TIPO DE PAUTA: ${report.pautaType || "n/a"}`);
  log(`FONTES INDEPENDENTES: ${report.sourcePolicy?.independentSources ?? "n/a"}`);
  log(`CLAIMS: ${report.claimStats?.total ?? 0}`);
  log(`CLAIMS SUPORTADOS: ${report.claimStats?.supported ?? 0}`);
  log(`CLAIMS NAO SUPORTADOS: ${report.claimStats?.unsupported ?? 0}`);
  log(`REVISAO AUTOMATICA: ${report.autoRevision || "NAO"}`);
  log(`LLM: ${report.llm}`);
  if (report.openAiDiagnostic) formatOpenAiDiagnostic(report.openAiDiagnostic).forEach((line) => log(line));
  log(`EVIDENCE MAP: ${report.evidenceMap}`);
  log(`CLAIM VALIDATION: ${report.claimValidation}`);
  log(`FACTUAL VERIFIER: ${report.factualVerifier}`);
  log(`ANTI-COPIA: ${report.antiCopy}`);
  log(`IMAGEM: ${report.image}`);
  log(`POST: ${report.post}`);
  log(`SEO: ${report.seo}`);
  log(`SITEMAP: ${report.sitemap}`);
  log(`PUBLICACAO: ${!dryRun && shouldPublish && report.publication ? "SIM" : "NAO"}`);
  log(`MOTIVO DE BLOQUEIO: ${report.blockers.join("; ") || "n/a"}`);
  log(`CUSTO ESTIMADO: ${report.cost ? `${report.cost.currency} ${report.cost.text.toFixed(6)}` : "NAO CONFIRMADO"}`);
  log(`CUSTO VERIFIER: ${report.verifierUsage?.estimatedCost ?? "0"}`);
  if (report.blockers.length) {
    log("BLOCKERS:");
    report.blockers.forEach((blocker) => log(`- ${blocker}`));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes("--dry-run");
  const publish = process.argv.includes("--publish") ? true : process.argv.includes("--no-publish") ? false : null;
  const report = await runAutopilot({ dryRun, publish });
  const failed = report.blockers.length || report.llm !== "PASS" || report.image !== "PASS" || report.antiCopy !== "PASS" || report.antiHallucination !== "PASS" || report.factualVerifier !== "PASS";
  if (failed && !report.openAiDiagnostic) logReport(report, { dryRun, shouldPublish: publish ?? process.env.AUTOPILOT_PUBLISH === "true" });
  if (failed) process.exitCode = 1;
}
