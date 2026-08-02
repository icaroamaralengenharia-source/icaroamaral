import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { updateNews } from "./atualizar-noticias.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const OPPORTUNITIES_FILE = path.resolve(ROOT_DIR, "noticias", "dados", "oportunidades.json");
const MAX_OPPORTUNITIES = 60;

export const OPPORTUNITY_SOURCES = [
  {
    nome: "PNCP",
    url: "https://pncp.gov.br/api/search/?tipos_documento=edital&ordenacao=-data&pagina=1&tamanhoPagina=10",
    tipo: "pncp",
  },
];

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeText(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function deterministicOpportunityId(item) {
  return createHash("sha256").update(`${normalizeText(item.titulo)}|${safeUrl(item.oportunidadeUrl || item.fonteUrl)}`).digest("hex").slice(0, 16);
}

async function readExistingOpportunities() {
  try {
    return JSON.parse(await readFile(OPPORTUNITIES_FILE, "utf8"));
  } catch {
    return { atualizadoEm: null, coletadoEm: null, fontes: ["PNCP"], oportunidades: [] };
  }
}

function normalizeOpportunity(input, sourceName, collectedAt) {
  const title = clean(input.titulo || input.title || input.objetoCompra || input.nome || input.descricao);
  const opportunityUrl = safeUrl(input.oportunidadeUrl || input.url || input.link || input.uri || input.portalUrl || input.fonteUrl);
  if (!title || !opportunityUrl) return null;
  const status = normalizeText(input.status || input.situacao || "aberta").includes("encerr") ? "encerrada" : "aberta";
  const item = {
    id: "",
    titulo: title,
    organizacao: clean(input.organizacao || input.orgao || input.razaoSocial || input.unidadeOrgao || ""),
    tipo: clean(input.tipo || "licitação"),
    resumo: clean(input.resumo || input.objetoCompra || input.descricao || title),
    cidade: clean(input.cidade || input.municipio || ""),
    estado: clean(input.estado || input.uf || ""),
    modalidade: clean(input.modalidade || input.modalidadeNome || "não informada"),
    dataPublicacao: clean(input.dataPublicacao || input.dataPublicacaoPncp || input.data || collectedAt.toISOString()),
    dataLimite: clean(input.dataLimite || input.dataEncerramentoProposta || input.dataFimRecebimentoProposta || ""),
    fonte: sourceName,
    fonteUrl: safeUrl(input.fonteUrl || input.urlFonte || "https://www.gov.br/pncp/"),
    oportunidadeUrl: opportunityUrl,
    remuneracao: clean(input.remuneracao || ""),
    valorEstimado: clean(input.valorEstimado || input.valorTotalEstimado || ""),
    tags: Array.isArray(input.tags) ? input.tags.map(clean).filter(Boolean).slice(0, 6) : ["PNCP", "licitação"],
    status,
    dataColeta: collectedAt.toISOString(),
  };
  item.id = clean(input.id) || deterministicOpportunityId(item);
  return item;
}

function extractOpportunityRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.content)) return payload.content;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.resultado)) return payload.resultado;
  return [];
}

export function mergeOpportunities(existingPayload, newItems, collectedAt = new Date()) {
  const previous = Array.isArray(existingPayload?.oportunidades) ? existingPayload.oportunidades : [];
  const byUrl = new Set();
  const byTitle = new Set();
  const merged = [];
  [...newItems, ...previous]
    .filter(Boolean)
    .sort((a, b) => clean(b.dataPublicacao || b.dataColeta).localeCompare(clean(a.dataPublicacao || a.dataColeta)))
    .forEach((item) => {
      const urlKey = safeUrl(item.oportunidadeUrl || item.fonteUrl).replace(/\/$/, "");
      const titleKey = normalizeText(item.titulo);
      if (!urlKey || !titleKey || byUrl.has(urlKey) || byTitle.has(titleKey)) return;
      byUrl.add(urlKey);
      byTitle.add(titleKey);
      merged.push(item);
    });
  return {
    atualizadoEm: collectedAt.toISOString(),
    coletadoEm: collectedAt.toISOString(),
    fontes: [...new Set(merged.map((item) => item.fonte).filter(Boolean))].sort(),
    oportunidades: merged.slice(0, MAX_OPPORTUNITIES),
  };
}

async function collectOpportunities({ fetchImpl = fetch, now = new Date() } = {}) {
  const stats = { fontesConsultadas: OPPORTUNITY_SOURCES.length, fontesValidas: [], fontesComErro: [], itensEncontrados: 0 };
  const items = [];
  for (const source of OPPORTUNITY_SOURCES) {
    try {
      const response = await fetchImpl(source.url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      const rows = extractOpportunityRows(payload);
      stats.itensEncontrados += rows.length;
      stats.fontesValidas.push({ nome: source.nome, url: source.url, itens: rows.length });
      rows.map((row) => normalizeOpportunity(row, source.nome, now)).filter(Boolean).forEach((item) => items.push(item));
    } catch (error) {
      stats.fontesComErro.push({ nome: source.nome, url: source.url, erro: error.message });
    }
  }
  return { stats, items };
}

export async function updateOpportunities({ dryRun = false, fetchImpl = fetch, now = new Date() } = {}) {
  const existing = await readExistingOpportunities();
  const collected = await collectOpportunities({ fetchImpl, now });
  if (collected.stats.fontesValidas.length === 0) {
    return { ok: false, changed: false, stats: { ...collected.stats, itensAceitos: 0 }, payload: existing, error: "Todas as fontes de oportunidades falharam; JSON anterior preservado." };
  }
  const payload = mergeOpportunities(existing, collected.items, now);
  const previousText = `${JSON.stringify(existing, null, 2).trim()}\n`;
  const nextText = `${JSON.stringify(payload, null, 2)}\n`;
  const changed = previousText !== nextText;
  if (!dryRun && changed) await writeFile(OPPORTUNITIES_FILE, nextText, "utf8");
  return { ok: true, changed, stats: { ...collected.stats, itensAceitos: collected.items.length, arquivo: changed ? "alterado" : "sem mudancas" }, payload };
}

export async function updateContent({ dryRun = false, fetchImpl = fetch, now = new Date() } = {}) {
  const news = await updateNews({ dryRun, fetchImpl, now });
  const opportunities = await updateOpportunities({ dryRun, fetchImpl, now });
  return { ok: news.ok || opportunities.ok, news, opportunities };
}

function printResult(result, dryRun) {
  console.log(`modo: ${dryRun ? "dry-run" : "gravacao"}`);
  console.log(`noticias: ${result.news.stats?.itensAceitos || 0} aceitas; arquivo ${result.news.stats?.arquivo || "preservado"}`);
  if (result.news.error) console.log(result.news.error);
  console.log(`oportunidades: ${result.opportunities.stats?.itensAceitos || 0} aceitas; arquivo ${result.opportunities.stats?.arquivo || "preservado"}`);
  console.log(`fontes de oportunidades com erro: ${result.opportunities.stats?.fontesComErro?.length || 0}`);
  if (result.opportunities.error) console.log(result.opportunities.error);
  console.log("dicas: automacao desativada; dicas.json preservado");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dryRun = process.argv.includes("--dry-run");
  const result = await updateContent({ dryRun });
  printResult(result, dryRun);
  if (!result.ok) process.exitCode = 1;
}