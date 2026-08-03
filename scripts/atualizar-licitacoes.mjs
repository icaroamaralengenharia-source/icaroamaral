import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

export const PNCP_ENDPOINT = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao";
export const PNCP_DOCS_URL = "https://pncp.gov.br/pncp-consulta/v3/api-docs";
export const OUTPUT_PATH = "noticias/dados/licitacoes.json";
export const MAX_PAGES = 3;
export const MAX_RESULTS = 100;
export const PAGE_SIZE = 10;
export const DEFAULT_MODALIDADES = [4, 6, 8, 12, 5, 7, 1, 2, 3, 9];
export const USER_AGENT = "Amaral-Hunter-Licitacoes/1.0 (+https://www.icaroamaral.com.br/)";

const ENGINEERING_TERMS = [
  "engenharia", "arquitetura", "urbanismo", "projeto", "laudo", "pericia", "inspecao",
  "avaliacao", "fiscalizacao", "supervisao", "obra", "reforma", "manutencao predial",
  "infraestrutura", "saneamento", "drenagem", "pavimentacao", "topografia", "bim",
  "levantamento cadastral", "acessibilidade", "recuperacao estrutural", "estrutural",
  "edificacao", "asfaltico", "construcao", "civil", "terraplanagem", "terraplenagem"
];

const TECHNOLOGY_TERMS = [
  "software", "saas", "sistema web", "plataforma", "desenvolvimento", "automacao",
  "dashboard", "integracao", "api", "aplicativo", "inteligencia artificial",
  "gestao digital", "licenciamento de software", "sustentacao de sistema",
  "sistemas", "tecnologia da informacao", "portal web"
];

const REJECT_TERMS = [
  "medicamento", "farmacia", "alimentacao", "merenda", "uniforme", "veiculo",
  "combustivel", "material escolar", "publicidade", "show", "esporte", "limpeza comum",
  "vigilancia", "arma", "armamento", "generos alimenticios", "motorista", "jardineiro"
];

export function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function deterministicId(...parts) {
  return createHash("sha256")
    .update(parts.map((part) => normalizeText(part)).join("|"))
    .digest("hex")
    .slice(0, 16);
}

export function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function isoOrNull(value) {
  const date = parseDate(value);
  return date ? date.toISOString() : null;
}

export function dateOnly(date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

export function buildPublicationUrl({ dataInicial, dataFinal, codigoModalidadeContratacao, pagina, tamanhoPagina = PAGE_SIZE }) {
  const url = new URL(PNCP_ENDPOINT);
  url.searchParams.set("dataInicial", dataInicial);
  url.searchParams.set("dataFinal", dataFinal);
  url.searchParams.set("codigoModalidadeContratacao", String(codigoModalidadeContratacao));
  url.searchParams.set("pagina", String(pagina));
  url.searchParams.set("tamanhoPagina", String(tamanhoPagina));
  return url.toString();
}

export function pncpOpportunityUrl(item) {
  const cnpj = item?.orgaoEntidade?.cnpj;
  const ano = item?.anoCompra;
  const sequencial = item?.sequencialCompra;
  if (!cnpj || !ano || !sequencial) return null;
  return `https://pncp.gov.br/app/editais/${encodeURIComponent(cnpj)}/${encodeURIComponent(ano)}/${encodeURIComponent(sequencial)}`;
}

export function thematicMatch(item) {
  const haystack = normalizeText([
    item?.objetoCompra,
    item?.informacaoComplementar,
    item?.modalidadeNome,
    item?.amparoLegal?.descricao,
    item?.unidadeOrgao?.nomeUnidade,
    item?.orgaoEntidade?.razaoSocial
  ].filter(Boolean).join(" "));
  if (!haystack) return { accepted: false, groups: [], terms: [], rejectedTerms: [] };
  const rejectedTerms = REJECT_TERMS.filter((term) => haystack.includes(normalizeText(term)));
  const engineering = ENGINEERING_TERMS.filter((term) => haystack.includes(normalizeText(term)));
  const technology = TECHNOLOGY_TERMS.filter((term) => haystack.includes(normalizeText(term)));
  const terms = [...engineering, ...technology];
  const groups = [];
  if (engineering.length) groups.push("engenharia");
  if (technology.length) groups.push("tecnologia");
  const accepted = terms.length > 0 && !(rejectedTerms.length && terms.length < 2);
  return { accepted, groups, terms, rejectedTerms };
}

export function classifyItem(item, terms = []) {
  const text = normalizeText([item?.objetoCompra, item?.modalidadeNome, ...terms].join(" "));
  if (/saas|sistema web|software|plataforma|desenvolvimento|api|aplicativo|sistemas/.test(text)) return "SaaS e Sistemas";
  if (/tecnologia|automacao|dashboard|inteligencia artificial|gestao digital/.test(text)) return "Tecnologia";
  if (/laudo|pericia|inspecao|avaliacao/.test(text)) return "Laudos e Pericias";
  if (/fiscalizacao|supervisao/.test(text)) return "Fiscalizacao";
  if (/infraestrutura|saneamento|drenagem|pavimentacao|asfaltico/.test(text)) return "Infraestrutura";
  if (/arquitetura|urbanismo|acessibilidade/.test(text)) return "Arquitetura";
  if (/engenharia|obra|reforma|construcao|estrutural|topografia|bim/.test(text)) return "Engenharia";
  return "Outros Servicos Tecnicos";
}

export function isFutureAbsurd(date, now = new Date()) {
  if (!date) return false;
  const max = new Date(now);
  max.setFullYear(max.getFullYear() + 3);
  return date.getTime() > max.getTime();
}

export function isRecentPublication(item, now = new Date(), days = 7) {
  const published = parseDate(item?.dataPublicacaoPncp || item?.dataInclusao);
  if (!published) return false;
  const start = new Date(now);
  start.setDate(start.getDate() - days);
  return published.getTime() >= start.getTime() && published.getTime() <= now.getTime() + 36 * 60 * 60 * 1000;
}

export function isOpenProcess(item, now = new Date()) {
  const deadline = parseDate(item?.dataEncerramentoProposta);
  if (!deadline) return isRecentPublication(item, now);
  if (isFutureAbsurd(deadline, now)) return false;
  return deadline.getTime() >= now.getTime();
}

function moreCompleteScore(item) {
  return [
    item.titulo, item.objeto, item.orgao, item.unidadeCompradora, item.cidade, item.estado,
    item.modalidade, item.numeroCompra, item.numeroProcesso, item.valorEstimado, item.dataLimite,
    item.oportunidadeUrl
  ].filter((value) => value !== null && value !== "").length;
}

export function normalizePncpItem(item, { now = new Date() } = {}) {
  const officialUrl = pncpOpportunityUrl(item);
  const sourceUrl = isSafeHttpUrl(officialUrl) ? officialUrl : item?.linkSistemaOrigem;
  if (!item?.numeroControlePNCP && !isSafeHttpUrl(sourceUrl)) return null;
  if (!isSafeHttpUrl(sourceUrl)) return null;
  if (!isOpenProcess(item, now)) return null;
  if (!isRecentPublication(item, now)) return null;
  const match = thematicMatch(item);
  if (!match.accepted) return null;
  const title = String(item?.objetoCompra || item?.informacaoComplementar || item?.numeroControlePNCP || "Licitacao PNCP").replace(/\s+/g, " ").trim();
  const id = deterministicId(item?.numeroControlePNCP || "", sourceUrl, item?.orgaoEntidade?.razaoSocial || "", item?.numeroCompra || "", title);
  return {
    id,
    titulo: title.slice(0, 140),
    objeto: title || null,
    orgao: item?.orgaoEntidade?.razaoSocial || null,
    unidadeCompradora: item?.unidadeOrgao?.nomeUnidade || null,
    cidade: item?.unidadeOrgao?.municipioNome || null,
    estado: item?.unidadeOrgao?.ufSigla || null,
    modalidade: item?.modalidadeNome || null,
    numeroCompra: item?.numeroCompra || null,
    numeroProcesso: item?.processo || null,
    valorEstimado: typeof item?.valorTotalEstimado === "number" ? item.valorTotalEstimado : null,
    moeda: typeof item?.valorTotalEstimado === "number" ? "BRL" : null,
    dataPublicacao: isoOrNull(item?.dataPublicacaoPncp || item?.dataInclusao),
    dataAbertura: isoOrNull(item?.dataAberturaProposta),
    dataLimite: isoOrNull(item?.dataEncerramentoProposta),
    situacao: item?.situacaoCompraNome || null,
    categoria: classifyItem(item, match.terms),
    palavrasEncontradas: [...new Set(match.terms)].slice(0, 8),
    fonte: "PNCP",
    oportunidadeUrl: sourceUrl,
    dominioFonte: new URL(sourceUrl).hostname,
    dataColeta: now.toISOString()
  };
}

export function dedupeLicitacoes(items) {
  const maps = [new Map(), new Map(), new Map(), new Map()];
  const result = [];
  let duplicates = 0;
  for (const item of items) {
    const keys = [
      item.id,
      normalizeText(item.oportunidadeUrl),
      normalizeText([item.orgao, item.numeroCompra].join("|")),
      normalizeText([item.titulo, item.orgao].join("|"))
    ];
    const existingIndex = keys.map((key, index) => maps[index].get(key)).find((value) => value !== undefined);
    if (existingIndex === undefined) {
      const index = result.push(item) - 1;
      keys.forEach((key, keyIndex) => { if (key) maps[keyIndex].set(key, index); });
      continue;
    }
    duplicates += 1;
    if (moreCompleteScore(item) > moreCompleteScore(result[existingIndex])) result[existingIndex] = item;
  }
  return { items: result, duplicates };
}


export function sortLicitacoes(items, mode = "prazo") {
  const copy = [...items];
  copy.sort((a, b) => {
    if (mode === "valor") return (b.valorEstimado || -1) - (a.valorEstimado || -1);
    if (mode === "publicacao") return (parseDate(b.dataPublicacao)?.getTime() || 0) - (parseDate(a.dataPublicacao)?.getTime() || 0);
    if (mode === "categoria") return String(a.categoria || "").localeCompare(String(b.categoria || ""), "pt-BR");
    const da = parseDate(a.dataLimite)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const db = parseDate(b.dataLimite)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  return copy;
}

export function emptyPayload() {
  return { atualizadoEm: null, fonte: "PNCP", total: 0, licitacoes: [] };
}

export async function readExisting(filePath = OUTPUT_PATH) {
  try {
    const parsed = JSON.parse(await readFile(filePath, "utf8"));
    return {
      atualizadoEm: parsed.atualizadoEm || null,
      fonte: parsed.fonte || "PNCP",
      total: Number.isFinite(parsed.total) ? parsed.total : 0,
      licitacoes: Array.isArray(parsed.licitacoes) ? parsed.licitacoes : []
    };
  } catch {
    return emptyPayload();
  }
}

export async function writeAtomic(filePath, payload) {
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tmp, filePath);
}

export function pncpHeaders() {
  return {
    Accept: "application/json",
    "User-Agent": USER_AGENT,
    "Cache-Control": "no-cache"
  };
}

export function parseRetryAfter(value, now = new Date()) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 60_000);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.min(Math.max(0, date.getTime() - now.getTime()), 60_000);
}

export function retryDelayMs({ attempt, retryAfter, baseMs = 1200 }) {
  const retryAfterMs = parseRetryAfter(retryAfter);
  if (retryAfterMs !== null) return retryAfterMs;
  return baseMs * 2 ** attempt;
}

function isRetryableStatus(status) {
  return status === 429 || status >= 500;
}

function pncpHttpError(status, retryAfter) {
  const error = new Error(`PNCP HTTP ${status}`);
  error.status = status;
  error.retryAfter = retryAfter || null;
  error.retryable = isRetryableStatus(status);
  return error;
}

async function parseJsonResponse({ status, ok, contentType, retryAfter, text }) {
  if (!ok) throw pncpHttpError(status, retryAfter);
  if (!String(contentType || "").toLocaleLowerCase("pt-BR").includes("application/json")) throw new Error(`PNCP content-type inesperado: ${contentType || "indefinido"}`);
  return JSON.parse(text);
}

export async function httpsJsonLimited(url, { timeoutMs = 20000, maxBytes = 5_000_000, headers = pncpHeaders() } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", headers, timeout: timeoutMs }, (res) => {
      let bytes = 0;
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        bytes += Buffer.byteLength(chunk);
        if (bytes > maxBytes) {
          req.destroy(new Error("PNCP payload excedeu limite de tamanho"));
          return;
        }
        body += chunk;
      });
      res.on("end", async () => {
        try {
          const parsed = await parseJsonResponse({
            status: res.statusCode || 0,
            ok: (res.statusCode || 0) >= 200 && (res.statusCode || 0) < 300,
            contentType: res.headers["content-type"] || "",
            retryAfter: res.headers["retry-after"] || null,
            text: body
          });
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("PNCP timeout")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchJsonOnce(url, { fetchImpl = fetch, timeoutMs = 20000, maxBytes = 5_000_000, headers = pncpHeaders() } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { redirect: "follow", signal: controller.signal, headers });
    const text = await response.text();
    if (text.length > maxBytes) throw new Error("PNCP payload excedeu limite de tamanho");
    return parseJsonResponse({
      status: response.status,
      ok: response.ok,
      contentType: response.headers?.get?.("content-type") || "",
      retryAfter: response.headers?.get?.("retry-after") || null,
      text
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchJsonLimited(url, { fetchImpl = fetch, httpsImpl = httpsJsonLimited, timeoutMs = 20000, maxBytes = 5_000_000, attempts = 3, sleepImpl = delay } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetchJsonOnce(url, { fetchImpl, timeoutMs, maxBytes });
    } catch (error) {
      lastError = error;
      if (!error.retryable || attempt >= attempts - 1) break;
      await sleepImpl(retryDelayMs({ attempt, retryAfter: error.retryAfter }));
    }
  }
  if (lastError?.retryable && httpsImpl) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await httpsImpl(url, { timeoutMs, maxBytes, headers: pncpHeaders() });
      } catch (error) {
        lastError = error;
        if (!error.retryable || attempt >= attempts - 1) break;
        await sleepImpl(retryDelayMs({ attempt, retryAfter: error.retryAfter }));
      }
    }
  }
  throw lastError || new Error("PNCP sem resposta");
}

export async function collectPncp({
  fetchImpl = fetch,
  now = new Date(),
  maxPages = MAX_PAGES,
  maxResults = MAX_RESULTS,
  modalidades = DEFAULT_MODALIDADES,
  pageSize = PAGE_SIZE,
  sleepImpl = delay,
  fetchOptions = {}
} = {}) {
  const dataFinalDate = new Date(now);
  const dataInicialDate = new Date(now);
  dataInicialDate.setDate(dataInicialDate.getDate() - 7);
  const dataInicial = dateOnly(dataInicialDate);
  const dataFinal = dateOnly(dataFinalDate);
  const raw = [];
  const stats = {
    endpoint: PNCP_ENDPOINT,
    dataInicial,
    dataFinal,
    pagesRequested: 0,
    received: 0,
    compatible: 0,
    closed: 0,
    duplicates: 0,
    engineering: 0,
    technology: 0
  };
  outer: for (const modalidade of modalidades) {
    for (let pagina = 1; pagina <= maxPages; pagina += 1) {
      if (stats.pagesRequested >= maxPages) break outer;
      const url = buildPublicationUrl({ dataInicial, dataFinal, codigoModalidadeContratacao: modalidade, pagina, tamanhoPagina: pageSize });
      const payload = await fetchJsonLimited(url, { fetchImpl, sleepImpl, ...fetchOptions });
      stats.pagesRequested += 1;
      const data = Array.isArray(payload?.data) ? payload.data : [];
      stats.received += data.length;
      raw.push(...data);
      if (!data.length || payload?.paginasRestantes === 0) break;
      await sleepImpl(1500);
    }
  }
  const normalized = [];
  for (const item of raw) {
    const open = isOpenProcess(item, now);
    if (!open) stats.closed += 1;
    const normalizedItem = normalizePncpItem(item, { now });
    if (!normalizedItem) continue;
    normalized.push(normalizedItem);
    if (normalizedItem.palavrasEncontradas.some((term) => ENGINEERING_TERMS.includes(term))) stats.engineering += 1;
    if (normalizedItem.palavrasEncontradas.some((term) => TECHNOLOGY_TERMS.includes(term))) stats.technology += 1;
  }
  const deduped = dedupeLicitacoes(normalized);
  stats.duplicates = deduped.duplicates;
  const licitacoes = sortLicitacoes(deduped.items).slice(0, maxResults);
  stats.compatible = licitacoes.length;
  return {
    ok: true,
    stats,
    payload: {
      atualizadoEm: now.toISOString(),
      fonte: "PNCP",
      total: licitacoes.length,
      licitacoes
    }
  };
}

export async function updateLicitacoes({ dryRun = false, outputPath = OUTPUT_PATH, fetchImpl = fetch, now = new Date(), fetchOptions = {} } = {}) {
  const previous = await readExisting(outputPath);
  try {
    const result = await collectPncp({ fetchImpl, now, fetchOptions });
    if (!result.payload.licitacoes.length) throw new Error("PNCP sem licitacoes compativeis");
    if (!dryRun) await writeAtomic(outputPath, result.payload);
    return { ...result, previous, fileChanged: !dryRun };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      previous,
      payload: previous,
      stats: {
        endpoint: PNCP_ENDPOINT,
        pagesRequested: 0,
        received: 0,
        compatible: previous.licitacoes.length,
        closed: 0,
        duplicates: 0,
        engineering: 0,
        technology: 0
      },
      fileChanged: false
    };
  }
}

export function summarizeStats(result) {
  const stats = result.stats || {};
  const items = result.payload?.licitacoes || [];
  const states = [...new Set(items.map((item) => item.estado).filter(Boolean))].sort();
  const nextSeven = items.filter((item) => {
    const deadline = parseDate(item.dataLimite);
    if (!deadline) return false;
    const limit = new Date();
    limit.setDate(limit.getDate() + 7);
    return deadline.getTime() <= limit.getTime();
  }).length;
  return [
    `ok=${result.ok}`,
    `endpoint=${stats.endpoint || PNCP_ENDPOINT}`,
    `paginas=${stats.pagesRequested || 0}`,
    `recebidos=${stats.received || 0}`,
    `compativeis=${stats.compatible || 0}`,
    `encerrados=${stats.closed || 0}`,
    `duplicados=${stats.duplicates || 0}`,
    `engenharia=${stats.engineering || 0}`,
    `tecnologia=${stats.technology || 0}`,
    `total=${items.length}`,
    `estados=${states.join(",") || "nenhum"}`,
    `prazos_7_dias=${nextSeven}`,
    `arquivo_alterado=${result.fileChanged ? "sim" : "nao"}`
  ].join("\n");
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await updateLicitacoes({ dryRun });
  console.log(summarizeStats(result));
  if (!result.ok) {
    console.error(result.error || "Falha controlada no Hunter Licitacoes");
    process.exitCode = 1;
  }
}

const executedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const modulePath = fileURLToPath(import.meta.url);
if (executedPath === modulePath) {
  main();
}
