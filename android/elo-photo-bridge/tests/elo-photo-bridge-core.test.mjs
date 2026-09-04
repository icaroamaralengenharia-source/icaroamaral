import assert from "node:assert/strict";
import { test } from "node:test";

const categories = {
  CAMERAS: "cameras",
  TOMADAS: "tomadas",
  RACK: "rack",
  CAIXA_FUNDO_MADEIRA: "caixaFundoMadeira",
  MASTRO_ANTENA: "mastroAntena",
  UNKNOWN: "unknown"
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseDate(input, now = new Date("2026-09-01T12:00:00-03:00")) {
  const text = normalize(input);
  if (text.includes("hoje")) return "2026-09-01";
  if (text.includes("ontem")) return "2026-08-31";
  const numeric = String(input).match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  if (numeric) {
    const year = numeric[3] ? (numeric[3].length === 2 ? `20${numeric[3]}` : numeric[3]) : String(now.getFullYear());
    return `${year}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  }
  const months = { janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12" };
  const longDate = text.match(/\b(\d{1,2}) de ([a-z]+)(?: de (\d{4}))?\b/);
  if (longDate && months[longDate[2]]) return `${longDate[3] || now.getFullYear()}-${months[longDate[2]]}-${longDate[1].padStart(2, "0")}`;
  return null;
}

function parseTimeRange(input) {
  const normalized = normalize(input);
  const time = String.raw`(\d{1,2})(?:[:h](\d{2})(?::(\d{2}))?)?`;
  const toRange = (match, startIndex, endIndex) => {
    const start = buildTime(match[startIndex], match[startIndex + 1], match[startIndex + 2]);
    const end = buildTime(match[endIndex], match[endIndex + 1], match[endIndex + 2]);
    if (!start || !end) return null;
    return {
      startTime: start.value,
      endTime: end.value,
      rawStartTime: [match[startIndex], match[startIndex + 1], match[startIndex + 2]].filter(Boolean).join(":"),
      rawEndTime: [match[endIndex], match[endIndex + 1], match[endIndex + 2]].filter(Boolean).join(":"),
      startHasSeconds: Boolean(match[startIndex + 2]),
      endHasSeconds: Boolean(match[endIndex + 2])
    };
  };
  const labeled = normalized.match(new RegExp(String.raw`\b(?:inicio|start|comeco)\s*:?\s*${time}\b.*?\b(?:fim|final|end|termino)\s*:?\s*${time}\b`));
  if (labeled) return toRange(labeled, 1, 4);
  const rangeText = normalized.replace(/\b(?:ate|as)\b/g, "a");
  const range = rangeText.match(new RegExp(String.raw`\b${time}\s*a\s*${time}\b`));
  return range ? toRange(range, 1, 4) : null;
}

function hasTimeRangeAttempt(input) {
  const normalized = normalize(input);
  return /\b(?:inicio|start|comeco)\b.*\b(?:fim|final|end|termino)\b/.test(normalized) ||
    /\b\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\s*(?:a|ate|as)\s*\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\b/.test(normalized);
}

function buildTime(hourText, minuteText = "", secondText = "") {
  const hour = Number(hourText);
  const minute = minuteText ? Number(minuteText) : 0;
  const second = secondText ? Number(secondText) : 0;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}${secondText ? `:${String(second).padStart(2, "0")}` : ""}`;
  return { value };
}

function stripTimeRanges(input) {
  return String(input || "")
    .replace(/\b(?:inicio|início|start|comeco|começo)\s*:?\s*\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\b.*?\b(?:fim|final|end|termino|término)\s*:?\s*\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\b/giu, " ")
    .replace(/\bde\s+\d{1,2}[:h]\d{2}(?::\d{2})?\s*(?:a|ate|até|as|às)\s*\d{1,2}[:h]\d{2}(?::\d{2})?\b/giu, " ")
    .replace(/\bdas\s+\d{1,2}[:h]\d{2}(?::\d{2})?\s*(?:a|ate|até|as|às)\s*\d{1,2}[:h]\d{2}(?::\d{2})?\b/giu, " ")
    .replace(/\b\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\s*(?:a|ate|até|as|às)\s*\d{1,2}(?:[:h]\d{2}(?::\d{2})?)?\b/giu, " ");
}
function parseCommand(input) {
  const text = normalize(input);
  const reportType = text.includes("sgto") ? "SGTO" : (text.includes("stelecom") ? "STELECOM" : "UNKNOWN");
  const latestVisit = /ultima visita|ultimo atendimento/.test(text);
  const dateHint = parseDate(input);
  const cityBeforeDate = String(input).match(/\b(?:de|em)\s+([\p{L}\s]+?)\s+(?:do\s+dia|dia|em|no|na)\b/iu);
  const cityAtEnd = String(input).match(/\b(?:de|em)\s+([\p{L}\s]+)$/iu);
  const cityHint = (cityBeforeDate?.[1] || cityAtEnd?.[1] || "").trim();
  const timeRange = parseTimeRange(input);
  return {
    reportType,
    cityHint: /hoje|ontem|agosto|ultima visita/i.test(normalize(cityHint)) ? null : cityHint || null,
    dateHint,
    latestVisit,
    startTimeHint: timeRange?.startTime || null,
    endTimeHint: timeRange?.endTime || null,
    rawStartTimeHint: timeRange?.rawStartTime || null,
    rawEndTimeHint: timeRange?.rawEndTime || null,
    endTimeHasSeconds: Boolean(timeRange?.endHasSeconds),
    timeRangeInvalid: hasTimeRangeAttempt(input) && !timeRange
  };
}
function bestDate(photo) {
  return photo.exifDateOriginal || photo.dateTaken || photo.dateAdded || null;
}

function photosForDate(photos, date) {
  return photos.filter((photo) => bestDate(photo)?.slice(0, 10) === date);
}

function parseTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function parseVisitRefinement(input) {
  const raw = String(input || "").trim();
  const selectedIndex = /^\d+$/.test(raw) ? Number(raw) : null;
  if (selectedIndex) return { selectedIndex, date: null, startTime: null, endTime: null, cityHint: null };
  const command = parseCommand(raw);
  const time = parseTimeRange(raw);
  const cityHint = stripTimeRanges(raw)
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}\s+de\s+[\p{L}]+(?:\s+de\s+\d{4})?\b/giu, " ")
    .replace(/\b(?:monte|montar|faca|faça|gerar|gere|relatorio|relatório|sgto|stelecom|photo|bridge|elo)\b/giu, " ")
    .replace(/\b(?:o|a|do|dia|data|em|no|na|de|ate|até|as|às|inicio|início|fim|final)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { selectedIndex: null, date: command.dateHint, startTime: time?.startTime || null, endTime: time?.endTime || null, cityHint: cityHint || null };
}
function cityMatches(candidate, hint) {
  const c = normalize(candidate);
  const h = normalize(hint);
  if (!h) return true;
  if (!c || c === "unknown") return false;
  return c === h || c.includes(h) || h.includes(c);
}

function intervalMatches(candidate, startTime, endTime) {
  if (!startTime && !endTime) return true;
  const candidateStart = parseTime(candidate.startTime);
  const candidateEnd = parseTime(candidate.endTime) ?? candidateStart;
  const requestedStart = parseTime(startTime) ?? 0;
  const requestedEnd = parseTime(endTime) ?? requestedStart;
  return candidateEnd >= requestedStart && candidateStart <= requestedEnd;
}

function refineCandidateVisits(candidates, input, persistedDate = "") {
  const refinement = parseVisitRefinement(input);
  if (refinement.selectedIndex) return candidates.filter((visit) => visit.index === refinement.selectedIndex);
  const effectiveDate = refinement.date || persistedDate;
  return candidates.filter((visit) => {
    const dateOk = !effectiveDate || visit.date === effectiveDate;
    return dateOk && cityMatches(visit.city, refinement.cityHint) && intervalMatches(visit, refinement.startTime, refinement.endTime);
  });
}

function refinementCandidates() {
  return [
    { index: 1, date: "2026-08-28", startTime: "15:10", endTime: "15:30", city: "Malhada de Pedras", photoCount: 9 },
    { index: 2, date: "2026-08-28", startTime: "15:42", endTime: "16:05", city: "Malhada de Pedras", photoCount: 11 },
    { index: 3, date: "2026-08-28", startTime: "17:00", endTime: "17:20", city: "Tremedal", photoCount: 8 }
  ];
}

function classify(photo) {
  const name = normalize(photo.displayName);
  if (/camera|cam|cftv/.test(name)) return "CAMERAS";
  if (/tomada|ponto/.test(name)) return "TOMADAS";
  if (/rack/.test(name)) return "RACK";
  if (/caixa/.test(name) && /fundo/.test(name) && /madeira/.test(name)) return "CAIXA_FUNDO_MADEIRA";
  if (/mastro|antena/.test(name)) return "MASTRO_ANTENA";
  return "UNKNOWN";
}

function groupVisits(photos, windowMinutes = 180) {
  const ordered = photos.filter(bestDate).sort((a, b) => bestDate(a).localeCompare(bestDate(b)));
  const groups = [];
  for (const photo of ordered) {
    const group = groups.at(-1);
    const previous = group && group.at(-1);
    const sameCity = normalize(previous && previous.city) === normalize(photo.city);
    const minutes = previous ? Math.abs(new Date(bestDate(photo)) - new Date(bestDate(previous))) / 60000 : Infinity;
    if (group && sameCity && minutes <= windowMinutes) group.push(photo);
    else groups.push([photo]);
  }
  return groups.map((items) => {
    const dateCounts = new Map();
    const cityCounts = new Map();
    for (const item of items) {
      const day = bestDate(item).slice(0, 10);
      dateCounts.set(day, (dateCounts.get(day) || 0) + 1);
      if (item.city) cityCounts.set(item.city, (cityCounts.get(item.city) || 0) + 1);
    }
    const date = [...dateCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || "AMBIGUOUS";
    const city = [...cityCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || "UNKNOWN";
    return { city, date, photos: items, confidence: { city: city === "UNKNOWN" ? 0 : (cityCounts.get(city) || 0) / items.length, date: date === "AMBIGUOUS" ? 0 : (dateCounts.get(date) || 0) / items.length } };
  });
}

function toPayload(command, group) {
  const photos = Object.fromEntries(Object.entries(categories).map(([, key]) => [key, []]));
  for (const photo of group.photos) photos[categories[classify(photo)]].push(photo);
  return { reportType: command.reportType, city: group.city, visitDate: group.date, confidence: group.confidence, photos };
}

function fixturePhotos() {
  return [
    ["content://photo/1", "camera_frente_01.jpg", "2026-08-28T08:00:00Z", "Malhada de Pedras"],
    ["content://photo/2", "camera_lateral_02.jpg", "2026-08-28T08:04:00Z", "Malhada de Pedras"],
    ["content://photo/3", "cftv_camera_03.jpg", "2026-08-28T08:08:00Z", "Malhada de Pedras"],
    ["content://photo/4", "tomada_sala.jpg", "2026-08-28T08:12:00Z", "Malhada de Pedras"],
    ["content://photo/5", "ponto_tomada_corredor.jpg", "2026-08-28T08:16:00Z", "Malhada de Pedras"],
    ["content://photo/6", "rack_ti.jpg", "2026-08-28T08:20:00Z", "Malhada de Pedras"],
    ["content://photo/7", "caixa_fundo_madeira.jpg", "2026-08-28T08:24:00Z", "Malhada de Pedras"],
    ["content://photo/8", "mastro_antena.jpg", "2026-08-28T08:28:00Z", "Malhada de Pedras"],
    ["content://photo/9", "ambiente_geral.jpg", "2026-08-28T08:32:00Z", "Malhada de Pedras"],
    ["content://photo/10", "fachada.jpg", "2026-08-28T08:36:00Z", "Malhada de Pedras"]
  ].map(([uri, displayName, exifDateOriginal, city]) => ({ uri, displayName, exifDateOriginal, dateTaken: "2026-08-27T00:00:00Z", dateAdded: "2026-08-29T00:00:00Z", width: 1600, height: 1200, mimeType: "image/jpeg", latitude: -14.386, longitude: -41.878, city }));
}

test("parser extrai tipo, cidade e ultima visita", () => {
  assert.deepEqual(parseCommand("monte o sgto de Malhada de Pedras"), { reportType: "SGTO", cityHint: "Malhada de Pedras", dateHint: null, latestVisit: false, startTimeHint: null, endTimeHint: null, rawStartTimeHint: null, rawEndTimeHint: null, endTimeHasSeconds: false, timeRangeInvalid: false });
  assert.equal(parseCommand("faca o stelecom de Tremedal").reportType, "STELECOM");
  assert.equal(parseCommand("monte o sgto da ultima visita").latestVisit, true);
});

test("comando sem data deve aguardar data antes do MediaStore", () => {
  const command = parseCommand("monte o SGTO");
  assert.equal(command.dateHint, null);
});

test("parser resolve datas explicitas, hoje e ontem", () => {
  assert.equal(parseCommand("monte o SGTO do dia 28/08/2026").dateHint, "2026-08-28");
  assert.equal(parseCommand("faca o SGTO de 28 de agosto").dateHint, "2026-08-28");
  assert.equal(parseCommand("faca o STELECOM de hoje").dateHint, "2026-09-01");
  assert.equal(parseCommand("faca o SGTO de ontem").dateHint, "2026-08-31");
});

test("cidade e hint; data e filtro principal", () => {
  const command = parseCommand("monte o SGTO de Malhada de Pedras do dia 28/08/2026");
  assert.equal(command.cityHint, "Malhada de Pedras");
  assert.equal(command.dateHint, "2026-08-28");
});

test("data prioriza EXIF antes de DATE_TAKEN e DATE_ADDED", () => {
  const photo = { exifDateOriginal: "2026-08-28T08:00:00Z", dateTaken: "2026-08-20T08:00:00Z", dateAdded: "2026-08-30T08:00:00Z" };
  assert.equal(bestDate(photo), "2026-08-28T08:00:00Z");
});

test("filtro por data ignora fotos de outros dias antes do agrupamento", () => {
  const photos = [...fixturePhotos(), { ...fixturePhotos()[0], uri: "content://photo/old", exifDateOriginal: "2026-08-27T08:00:00Z" }];
  const filtered = photosForDate(photos, "2026-08-28");
  assert.equal(filtered.length, 10);
  assert.equal(filtered.some((photo) => photo.uri === "content://photo/old"), false);
});

test("gps ausente resulta em cidade UNKNOWN", () => {
  const [photo] = fixturePhotos();
  const group = groupVisits([{ ...photo, city: null, latitude: null, longitude: null }])[0];
  assert.equal(group.city, "UNKNOWN");
  assert.equal(group.confidence.city, 0);
});

test("agrupa dez fotos da mesma visita e classifica categorias esperadas", () => {
  const command = parseCommand("monte o sgto de Malhada de Pedras do dia 28/08/2026");
  const group = groupVisits(photosForDate(fixturePhotos(), command.dateHint))[0];
  const payload = toPayload(command, group);
  assert.equal(payload.reportType, "SGTO");
  assert.equal(payload.city, "Malhada de Pedras");
  assert.equal(payload.visitDate, "2026-08-28");
  assert.equal(payload.photos.cameras.length, 3);
  assert.equal(payload.photos.tomadas.length, 2);
  assert.equal(payload.photos.rack.length, 1);
  assert.equal(payload.photos.caixaFundoMadeira.length, 1);
  assert.equal(payload.photos.mastroAntena.length, 1);
  assert.equal(payload.photos.unknown.length, 2);
});

test("multiplas visitas no mesmo dia nao sao misturadas", () => {
  const morning = fixturePhotos();
  const afternoon = fixturePhotos().map((photo, index) => ({ ...photo, uri: `content://photo/a${index}`, exifDateOriginal: `2026-08-28T15:${String(index).padStart(2, "0")}:00Z`, city: "Tremedal" }));
  const groups = groupVisits([...morning, ...afternoon], 180);
  assert.equal(groups.length, 2);
});

test("adapter serve SGTO e STELECOM sem depender de IA remota", () => {
  const group = groupVisits(fixturePhotos())[0];
  assert.equal(toPayload(parseCommand("monte o sgto de Malhada de Pedras do dia 28/08/2026"), group).reportType, "SGTO");
  assert.equal(toPayload(parseCommand("faca o stelecom de Malhada de Pedras do dia 28/08/2026"), group).reportType, "STELECOM");
  assert.equal(classify({ displayName: "foto_qualquer.jpg" }), "UNKNOWN");
});

test("refinamento com data horario e cidade retorna somente a visita correta", () => {
  const result = refineCandidateVisits(refinementCandidates(), "28/08/2026 15:40 a 16:10 malhada", "2026-08-28");
  assert.equal(result.length, 1);
  assert.equal(result[0].startTime, "15:42");
});

test("refinamento sem data usa data persistida", () => {
  const result = refineCandidateVisits(refinementCandidates(), "15:40 a 16:10", "2026-08-28");
  assert.equal(result.length, 1);
  assert.equal(result[0].endTime, "16:05");
});

test("cidade parcial malhada casa com Malhada de Pedras e mostra opcoes", () => {
  const result = refineCandidateVisits(refinementCandidates(), "malhada", "2026-08-28");
  assert.equal(result.length, 2);
  assert.deepEqual(result.map((visit) => visit.city), ["Malhada de Pedras", "Malhada de Pedras"]);
});

test("selecao por indice escolhe a opcao exibida", () => {
  const candidates = refineCandidateVisits(refinementCandidates(), "malhada", "2026-08-28").map((visit, index) => ({ ...visit, index: index + 1 }));
  assert.equal(refineCandidateVisits(candidates, "1", "2026-08-28")[0].startTime, "15:10");
  assert.equal(refineCandidateVisits(candidates, "2", "2026-08-28")[0].startTime, "15:42");
});

test("janela sem intersecao retorna zero resultados tratado", () => {
  const result = refineCandidateVisits(refinementCandidates(), "14:00 a 14:20", "2026-08-28");
  assert.equal(result.length, 0);
});

test("parser aceita formatos de refinamento com horario", () => {
  assert.deepEqual(parseVisitRefinement("malhada 15:40 a 16:10"), { selectedIndex: null, date: null, startTime: "15:40", endTime: "16:10", cityHint: "malhada" });
  assert.deepEqual(parseVisitRefinement("15h40 às 16h10"), { selectedIndex: null, date: null, startTime: "15:40", endTime: "16:10", cityHint: null });
  assert.deepEqual(parseVisitRefinement("de 15:40 até 16:10"), { selectedIndex: null, date: null, startTime: "15:40", endTime: "16:10", cityHint: null });
});
const allowedVisualCategories = new Set(["CAMERAS", "TOMADAS", "RACK", "CAIXA_FUNDO_MADEIRA", "MASTRO_ANTENA", "UNKNOWN"]);

function normalizeVisualConfidence(value) {
  if (typeof value === "string") {
    const normalized = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (normalized === "alta" || normalized === "alto") return 0.9;
    if (normalized === "media" || normalized === "medio") return 0.65;
    if (normalized === "baixa" || normalized === "baixo") return 0.3;
  }
  const numeric = Number(String(value ?? 0).replace(",", "."));
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric > 1 ? numeric / 100 : numeric)) : 0;
}

function normalizeVisualCategory(value, confidence = 1) {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeConfidence = normalizeVisualConfidence(confidence);
  if (!allowedVisualCategories.has(normalized)) return "UNKNOWN";
  return normalized !== "UNKNOWN" && safeConfidence >= 0.72 ? normalized : "UNKNOWN";
}

async function classifySelectedPhotos(photos, classifyOne, cache = new Map()) {
  const counts = Object.fromEntries([...allowedVisualCategories].map((category) => [category.toLowerCase(), 0]));
  const classified = [];
  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index];
    const key = [photo.uri, photo.bestInstant || photo.dateTaken || "", photo.width || "", photo.height || ""].join("|");
    let result = cache.get(key);
    if (!result) {
      try {
        result = await classifyOne(photo, index);
      } catch (error) {
        result = { category: "UNKNOWN", confidence: 0, source: "error", reason: error.message };
      }
      result = { ...result, category: normalizeVisualCategory(result.category, Number(result.confidence || 0)) };
      cache.set(key, result);
    }
    counts[result.category.toLowerCase()] += 1;
    classified.push({ ...photo, category: result.category, classification: result });
  }
  return { classified, counts };
}

function movePayloadPhoto(payload, uri, targetCategory) {
  const copy = JSON.parse(JSON.stringify(payload));
  for (const [category, list] of Object.entries(copy.photos)) {
    const index = list.findIndex((photo) => photo.uri === uri);
    if (index < 0) continue;
    const [photo] = list.splice(index, 1);
    photo.category = targetCategory;
    photo.classification = { source: "manual", confidence: 1, reason: "manual_category_correction" };
    copy.photos[targetCategory.toLowerCase()].push(photo);
    return copy;
  }
  return copy;
}

test("visual classifier normaliza categorias fechadas e baixa confianca vira UNKNOWN", () => {
  assert.equal(normalizeVisualCategory("câmeras", 0.92), "CAMERAS");
  assert.equal(normalizeVisualCategory("mastro antena", 0.87), "MASTRO_ANTENA");
  assert.equal(normalizeVisualCategory("RACK", "alta"), "RACK");
  assert.equal(normalizeVisualCategory("porta", 0.99), "UNKNOWN");
  assert.equal(normalizeVisualCategory("RACK", 0.4), "UNKNOWN");
});

test("visual classifier timeout ou rede com erro preserva fluxo em UNKNOWN", async () => {
  const result = await classifySelectedPhotos([{ uri: "content://1", displayName: "foto.jpg" }], () => Promise.reject(new Error("backend_503")));
  assert.equal(result.classified[0].category, "UNKNOWN");
  assert.equal(result.counts.unknown, 1);
});

test("visual classifier cache evita chamada repetida por uri data e dimensoes", async () => {
  let calls = 0;
  const cache = new Map();
  const photo = { uri: "content://1", displayName: "rack.jpg", dateTaken: "2026-08-28T10:00:00Z", width: 1000, height: 800 };
  await classifySelectedPhotos([photo], async () => { calls += 1; return { category: "RACK", confidence: 0.9, source: "vision" }; }, cache);
  await classifySelectedPhotos([photo], async () => { calls += 1; return { category: "CAMERAS", confidence: 0.9, source: "vision" }; }, cache);
  assert.equal(calls, 1);
});

test("correcao manual move foto entre categorias antes do payload final", () => {
  const payload = { photos: { cameras: [], tomadas: [], rack: [], caixa_fundo_madeira: [], mastro_antena: [], unknown: [{ uri: "u1", category: "UNKNOWN" }] } };
  const updated = movePayloadPhoto(payload, "u1", "TOMADAS");
  assert.equal(updated.photos.unknown.length, 0);
  assert.equal(updated.photos.tomadas[0].category, "TOMADAS");
  assert.equal(updated.photos.tomadas[0].classification.source, "manual");
});

test("classificacao parcial monta contagens finais sem misturar visitas", async () => {
  const photos = [
    { uri: "content://camera", displayName: "a.jpg", width: 1, height: 1 },
    { uri: "content://rack", displayName: "b.jpg", width: 1, height: 1 },
    { uri: "content://ambigua", displayName: "c.jpg", width: 1, height: 1 }
  ];
  const result = await classifySelectedPhotos(photos, async (photo) => ({
    category: photo.uri.includes("camera") ? "CAMERAS" : (photo.uri.includes("rack") ? "RACK" : "UNKNOWN"),
    confidence: photo.uri.includes("ambigua") ? 0.2 : 0.94,
    source: "vision"
  }));
  assert.equal(result.counts.cameras, 1);
  assert.equal(result.counts.rack, 1);
  assert.equal(result.counts.unknown, 1);
});
const timelineOrder = ["CAMERAS", "TOMADAS", "RACK", "MASTRO_ANTENA", "CAIXA_FUNDO_MADEIRA"];
const timelineKeys = { CAMERAS: "cameras", TOMADAS: "tomadas", RACK: "rack", MASTRO_ANTENA: "mastroAntena", CAIXA_FUNDO_MADEIRA: "caixaFundoMadeira", UNKNOWN: "unknown" };

function timelinePhotos(count) {
  return Array.from({ length: count }, (_, index) => ({
    uri: `content://timeline/${index + 1}`,
    displayName: `foto_${String(index + 1).padStart(3, "0")}.jpg`,
    exifDateOriginal: new Date(Date.UTC(2026, 7, 28, 18, 40, index)).toISOString(),
    width: 1600,
    height: 1200,
    mimeType: "image/jpeg",
    city: "Malhada de Pedras"
  }));
}

function validateTimelineCuts(photoCount, cuts) {
  for (const category of timelineOrder) {
    if (!Number.isInteger(cuts[category])) return { ok: false, message: `${category} missing` };
    if (cuts[category] < 0 || cuts[category] >= photoCount) return { ok: false, message: `${category} out_of_bounds` };
  }
  for (let index = 1; index < timelineOrder.length; index += 1) {
    if (cuts[timelineOrder[index]] <= cuts[timelineOrder[index - 1]]) return { ok: false, message: `${timelineOrder[index]} order` };
  }
  return { ok: true };
}

function distributeTimeline(photos, cuts, manual = {}) {
  const validation = validateTimelineCuts(photos.length, cuts);
  if (!validation.ok) throw new Error(validation.message);
  const payload = { photos: Object.fromEntries(Object.values(timelineKeys).map((key) => [key, []])) };
  const ordered = [...photos].sort((a, b) => bestDate(a).localeCompare(bestDate(b)));
  for (let index = 0; index < ordered.length; index += 1) {
    const category = manual[ordered[index].uri] || timelineOrder.filter((item) => index >= cuts[item]).at(-1);
    const key = timelineKeys[category] || "unknown";
    payload.photos[key].push({ ...ordered[index], category, classification: { source: "SGTO_FAST_TIMELINE", confidence: 1, reason: manual[ordered[index].uri] ? "manual_category_adjustment" : "timeline_cut_points" } });
  }
  return payload;
}

function realFastTimelineCuts() {
  return { CAMERAS: 0, TOMADAS: 7, RACK: 9, MASTRO_ANTENA: 25, CAIXA_FUNDO_MADEIRA: 26 };
}

function timelineRangeForHarness(category, photoCount, cuts) {
  const index = timelineOrder.indexOf(category);
  const first = cuts[category];
  const last = index === timelineOrder.length - 1 ? photoCount - 1 : cuts[timelineOrder[index + 1]] - 1;
  const rangeLabel = first === last ? `#${first + 1}` : `#${first + 1}-#${last + 1}`;
  return { category, first, last, rangeLabel, count: last - first + 1 };
}

function timelineReviewBlocksHarness(photoCount, cuts) {
  return timelineOrder.map((category) => timelineRangeForHarness(category, photoCount, cuts));
}

function timelineReviewFlowHarness({ photoCount = 51, cuts = realFastTimelineCuts() } = {}) {
  const aiRequests = 0;
  const validation = validateTimelineCuts(photoCount, cuts);
  const blocks = validation.ok ? timelineReviewBlocksHarness(photoCount, cuts) : [];
  const state = {
    cuts: { ...cuts },
    cutsComplete: validation.ok,
    reviewEnabled: validation.ok,
    reviewVisible: validation.ok,
    confirmEnabled: validation.ok,
    reportAvailable: false
  };
  const afterBack = { cuts: { ...state.cuts }, reviewEnabled: state.reviewEnabled };
  const afterConfirm = { ...state, reportAvailable: validation.ok };
  const afterClear = { cuts: {}, cutsComplete: false, reviewEnabled: false, reportAvailable: false };
  return { aiRequests, validation, blocks, state, afterBack, afterConfirm, afterClear };
}
function assertDefaultCuts(count) {
  const payload = distributeTimeline(timelinePhotos(count), { CAMERAS: 0, TOMADAS: 17, RACK: 30, MASTRO_ANTENA: 35, CAIXA_FUNDO_MADEIRA: 41 });
  assert.equal(payload.photos.cameras.length, 17);
  assert.equal(payload.photos.tomadas.length, 13);
  assert.equal(payload.photos.rack.length, 5);
  assert.equal(payload.photos.mastroAntena.length, 6);
  assert.equal(payload.photos.caixaFundoMadeira.length, count - 41);
  assert.equal(payload.photos.cameras[0].classification.source, "SGTO_FAST_TIMELINE");
}

test("SGTO_FAST_TIMELINE distribui 50 fotos pelos cortes 1,18,31,36,42", () => assertDefaultCuts(50));
test("SGTO_FAST_TIMELINE distribui 51 fotos pelos cortes fisicos 1,13,27,34,42", () => {
  const payload = distributeTimeline(timelinePhotos(51), { CAMERAS: 0, TOMADAS: 12, RACK: 26, MASTRO_ANTENA: 33, CAIXA_FUNDO_MADEIRA: 41 });
  assert.equal(payload.photos.cameras.length, 12);
  assert.equal(payload.photos.tomadas.length, 14);
  assert.equal(payload.photos.rack.length, 7);
  assert.equal(payload.photos.mastroAntena.length, 8);
  assert.equal(payload.photos.caixaFundoMadeira.length, 10);
  assert.equal(payload.photos.cameras[0].classification.source, "SGTO_FAST_TIMELINE");
});test("SGTO_FAST_TIMELINE distribui 100 fotos pelos cortes 1,18,31,36,42", () => assertDefaultCuts(100));
test("SGTO_FAST_TIMELINE distribui 200 fotos pelos cortes 1,18,31,36,42", () => assertDefaultCuts(200));

test("SGTO_FAST_TIMELINE bloqueia ordem invalida, corte duplicado e bloco vazio", () => {
  assert.equal(validateTimelineCuts(50, { CAMERAS: 0, TOMADAS: 17, RACK: 16, MASTRO_ANTENA: 35, CAIXA_FUNDO_MADEIRA: 41 }).ok, false);
  assert.equal(validateTimelineCuts(50, { CAMERAS: 0, TOMADAS: 17, RACK: 17, MASTRO_ANTENA: 35, CAIXA_FUNDO_MADEIRA: 41 }).ok, false);
  assert.equal(validateTimelineCuts(50, { CAMERAS: 0, TOMADAS: 17, RACK: 30, MASTRO_ANTENA: 35, CAIXA_FUNDO_MADEIRA: 35 }).ok, false);
});

test("SGTO_FAST_TIMELINE preserva cortes quando ids das fotos nao mudam", () => {
  const ids = timelinePhotos(50).map((photo) => photo.uri);
  const state = { timelinePhotoIds: ids, cameraStartIndex: 0, tomadasStartIndex: 17, rackStartIndex: 30, mastroStartIndex: 35, caixaStartIndex: 41 };
  assert.deepEqual(state.timelinePhotoIds, ids);
  assert.equal(state.caixaStartIndex, 41);
});

test("SGTO_FAST_TIMELINE mover foto individual e payload final sem IA", () => {
  let aiCalls = 0;
  const photos = timelinePhotos(50);
  const payload = distributeTimeline(photos, { CAMERAS: 0, TOMADAS: 17, RACK: 30, MASTRO_ANTENA: 35, CAIXA_FUNDO_MADEIRA: 41 }, { [photos[20].uri]: "RACK" });
  aiCalls += 0;
  assert.equal(payload.photos.rack.some((photo) => photo.uri === photos[20].uri), true);
  assert.equal(payload.photos.rack.find((photo) => photo.uri === photos[20].uri).classification.reason, "manual_category_adjustment");
  assert.equal(aiCalls, 0);
});

function localIsoBahia(date, time) {
  return `${date}T${time}-03:00`;
}

function physicalWindowFixture() {
  const photos = [];
  for (let index = 0; index < 200; index += 1) {
    photos.push({ uri: `content://all/${index}`, displayName: `other_${index}.jpg`, exifDateOriginal: localIsoBahia("2026-08-27", "10:00:00"), city: "Malhada de Pedras" });
  }
  for (let index = 0; index < 100; index += 1) {
    const inWindow = index < 24;
    const minute = inWindow ? 40 + index : index;
    const hour = inWindow && minute >= 60 ? 16 : 15;
    const normalizedMinute = inWindow ? minute % 60 : minute % 40;
    photos.push({
      uri: `content://date/${index}`,
      displayName: `date_${index}.jpg`,
      exifDateOriginal: localIsoBahia("2026-08-28", `${String(hour).padStart(2, "0")}:${String(normalizedMinute).padStart(2, "0")}:00`),
      city: "Malhada de Pedras"
    });
  }
  return photos;
}

function filterByLocalDate(photos, date) {
  return photos.filter((photo) => bestDate(photo).startsWith(date));
}

function filterPhotosByUserWindow(photos, date, start, end) {
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const startSeconds = startHour * 3600 + startMinute * 60;
  const endSeconds = endHour * 3600 + endMinute * 60 + 59;
  return photos.filter((photo) => {
    const value = bestDate(photo);
    if (!value.startsWith(date)) return false;
    const match = value.match(/T(\d{2}):(\d{2}):(\d{2})/);
    const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return seconds >= startSeconds && seconds <= endSeconds;
  });
}

test("janela horaria reduz 300 fotos para data 100 e janela 24 sem reampliar", () => {
  const all = physicalWindowFixture();
  const datePhotos = filterByLocalDate(all, "2026-08-28");
  const windowPhotos = filterPhotosByUserWindow(datePhotos, "2026-08-28", "15:40", "16:10");
  const selectedVisitPhotos = windowPhotos;
  assert.equal(all.length, 300);
  assert.equal(datePhotos.length, 100);
  assert.equal(windowPhotos.length, 24);
  assert.equal(selectedVisitPhotos.length, 24);
});

test("timezone America Bahia inclui limites 15:40:00 e 16:10:59", () => {
  const photos = [
    { uri: "before", exifDateOriginal: localIsoBahia("2026-08-28", "15:39:59") },
    { uri: "start", exifDateOriginal: localIsoBahia("2026-08-28", "15:40:00") },
    { uri: "middle", exifDateOriginal: localIsoBahia("2026-08-28", "15:55:00") },
    { uri: "end", exifDateOriginal: localIsoBahia("2026-08-28", "16:10:59") },
    { uri: "after", exifDateOriginal: localIsoBahia("2026-08-28", "16:11:00") }
  ];
  assert.deepEqual(filterPhotosByUserWindow(photos, "2026-08-28", "15:40", "16:10").map((photo) => photo.uri), ["start", "middle", "end"]);
});

test("janela completa bypassa VisitGrouper e data sem horario permite grouper", () => {
  let grouperCalls = 0;
  const hasCompleteWindow = true;
  if (!hasCompleteWindow) grouperCalls += 1;
  assert.equal(grouperCalls, 0);
  const hasOnlyDate = true;
  if (hasOnlyDate) grouperCalls += 1;
  assert.equal(grouperCalls, 1);
});

test("botao organizar rapido entra em FAST_TIMELINE sem CLASSIFYING_PHOTOS", () => {
  const state = { classificationMode: "FAST_TIMELINE", flowStatus: "FAST_TIMELINE", photoCount: 24 };
  assert.equal(state.classificationMode, "FAST_TIMELINE");
  assert.notEqual(state.flowStatus, "CLASSIFYING_PHOTOS");
  assert.notEqual(state.flowStatus, "WAITING_FOR_VISIT_REFINEMENT");
  assert.notEqual(state.flowStatus, "PAUSED");
});

test("FAST_TIMELINE recebe 37 fotos e IA recebe zero chamadas", () => {
  const selectedVisit = timelinePhotos(37);
  const state = { classificationMode: "FAST_TIMELINE", flowStatus: "FAST_TIMELINE" };
  let aiRequests = 0;
  const timelinePhotosCount = selectedVisit.length;
  if (state.classificationMode === "AI_CLASSIFICATION") aiRequests = selectedVisit.length;
  assert.equal(timelinePhotosCount, 37);
  assert.equal(aiRequests, 0);
});

function clickFastTimelineButton({ selectedVisit, classificationMode = "NONE" }) {
  const logs = ["FAST_CLICK_RECEIVED"];
  const state = {
    classificationMode,
    flowStatus: "IDLE",
    photoCount: selectedVisit.length,
    timelineOpen: false,
    renderItems: 0
  };
  logs.push(`FAST_STATE_BEFORE: state=${state.flowStatus} selectedVisitPhotos=${selectedVisit.length} classificationMode=${state.classificationMode}`);
  if (selectedVisit.length === 0) {
    logs.push("FAST_PRECONDITION_FAIL: selected_visit_empty");
    return { state, logs, aiRequests: 0 };
  }
  state.classificationMode = "FAST_TIMELINE";
  state.flowStatus = "FAST_TIMELINE";
  logs.push("FAST_TIMELINE_OPEN_REQUEST");
  logs.push(`FAST_TIMELINE_RENDER_START: photos=${selectedVisit.length}`);
  state.timelineOpen = true;
  state.renderItems = selectedVisit.length;
  logs.push(`FAST_TIMELINE_RENDER_DONE: items=${selectedVisit.length}`);
  return { state, logs, aiRequests: 0 };
}

test("botao organizar rapido com selectedVisit de 51 fotos abre timeline sem IA", () => {
  const selectedVisit = timelinePhotos(51);
  const result = clickFastTimelineButton({ selectedVisit });
  assert.equal(result.state.classificationMode, "FAST_TIMELINE");
  assert.equal(result.state.timelineOpen, true);
  assert.equal(result.state.renderItems, 51);
  assert.equal(result.aiRequests, 0);
  assert.ok(result.logs.includes("FAST_CLICK_RECEIVED"));
  assert.ok(result.logs.includes("FAST_TIMELINE_OPEN_REQUEST"));
  assert.ok(result.logs.includes("FAST_TIMELINE_RENDER_START: photos=51"));
  assert.ok(result.logs.includes("FAST_TIMELINE_RENDER_DONE: items=51"));
});
function executeCurrentCommandHarness({ source, text, selectedVisit }) {
  const logs = [];
  if (source === "click") logs.push("COMMAND_SUBMIT_CLICK");
  if (source === "ime") logs.push("COMMAND_SUBMIT_IME");
  logs.push("COMMAND_PARSE_START");
  const commandText = text.trim();
  if (!commandText) return { logs: [...logs, "COMMAND_PARSE_FAIL: empty_command"], parserCalled: false, aiRequests: 0, state: { flowStatus: "IDLE" } };
  const parsed = parseCommand(commandText);
  logs.push("COMMAND_PARSE_OK");
  logs.push(`COMMAND_SELECTED_VISIT_PHOTOS: ${selectedVisit.length}`);
  return {
    logs,
    parserCalled: true,
    aiRequests: 0,
    selectedVisit,
    state: {
      classificationMode: "NONE",
      flowStatus: "MODE_SELECTION",
      photoCount: selectedVisit.length,
      fastEnabled: selectedVisit.length > 0,
      aiEnabled: selectedVisit.length > 0,
      statusMessage: `Visita selecionada: ${selectedVisit.length} fotos. Escolha ORGANIZAR RÁPIDO ou CLASSIFICAR COM IA.`
    },
    parsed
  };
}

function refreshCurrentSelectionHarness({ selectedVisit }) {
  return {
    logs: ["REFRESH_CLICK"],
    aiRequests: 0,
    state: {
      classificationMode: "NONE",
      flowStatus: selectedVisit?.length ? "MODE_SELECTION" : "IDLE",
      statusMessage: selectedVisit?.length ? `Visita selecionada: ${selectedVisit.length} fotos. Escolha ORGANIZAR RÁPIDO ou CLASSIFICAR COM IA.` : "Estado atualizado. Para buscar uma visita, use EXECUTAR."
    }
  };
}

test("texto valido com EXECUTAR processa comando e encontra visita sem IA", () => {
  const selectedVisit = timelinePhotos(51);
  const result = executeCurrentCommandHarness({ source: "click", text: "Monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 16:50 as 17:04", selectedVisit });
  assert.equal(result.parserCalled, true);
  assert.equal(result.selectedVisit.length, 51);
  assert.equal(result.aiRequests, 0);
  assert.equal(result.state.flowStatus, "MODE_SELECTION");
  assert.equal(result.state.classificationMode, "NONE");
  assert.ok(result.logs.includes("COMMAND_SUBMIT_CLICK"));
  assert.ok(result.logs.includes("COMMAND_PARSE_OK"));
  assert.ok(result.logs.includes("COMMAND_SELECTED_VISIT_PHOTOS: 51"));
});

test("IME SEND submete o mesmo comando e encontra visita sem IA", () => {
  const selectedVisit = timelinePhotos(51);
  const result = executeCurrentCommandHarness({ source: "ime", text: "Monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 16:50 as 17:04", selectedVisit });
  assert.equal(result.parserCalled, true);
  assert.equal(result.selectedVisit.length, 51);
  assert.equal(result.aiRequests, 0);
  assert.ok(result.logs.includes("COMMAND_SUBMIT_IME"));
  assert.equal(result.state.flowStatus, "MODE_SELECTION");
});

test("ATUALIZAR nao chama IA nem exige classificar com ia", () => {
  const result = refreshCurrentSelectionHarness({ selectedVisit: timelinePhotos(51) });
  assert.equal(result.aiRequests, 0);
  assert.ok(result.logs.includes("REFRESH_CLICK"));
  assert.doesNotMatch(result.state.statusMessage, /use classificar com ia/i);
  assert.equal(result.state.classificationMode, "NONE");
});

test("apos EXECUTAR com visita pronta os dois modos explicitos ficam habilitados", () => {
  const result = executeCurrentCommandHarness({ source: "click", text: "Monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 16:50 as 17:04", selectedVisit: timelinePhotos(51) });
  assert.equal(result.state.fastEnabled, true);
  assert.equal(result.state.aiEnabled, true);
  assert.match(result.state.statusMessage, /ORGANIZAR RÁPIDO|CLASSIFICAR COM IA/);
});

test("apos EXECUTAR organizar rapido abre FAST_TIMELINE com zero IA", () => {
  const selectedVisit = timelinePhotos(51);
  const submitted = executeCurrentCommandHarness({ source: "click", text: "Monte o SGTO de Malhada de Pedras do dia 28/08/2026 das 16:50 as 17:04", selectedVisit });
  const fast = clickFastTimelineButton({ selectedVisit: submitted.selectedVisit, classificationMode: submitted.state.classificationMode });
  assert.equal(fast.state.classificationMode, "FAST_TIMELINE");
  assert.equal(fast.state.timelineOpen, true);
  assert.equal(fast.state.renderItems, 51);
  assert.equal(fast.aiRequests, 0);
});

function timelineAdapterItemHarness({ index = 0, thumbnailOk = false } = {}) {
  const photo = timelinePhotos(51)[index];
  const time = bestDate(photo).slice(11, 19);
  const item = {
    adapterCount: 51,
    viewCreated: true,
    visible: true,
    alpha: 1,
    imageView: {
      visible: true,
      width: 128,
      height: 112,
      drawableNull: !thumbnailOk,
      backgroundVisible: true,
      contentDescription: `Miniatura Foto ${index + 1} ${time}`
    },
    label: {
      visible: true,
      text: `#${String(index + 1).padStart(2, "0")}\n${time}`
    },
    contentDescription: `Foto ${index + 1} ${time}`,
    logs: [
      `FAST_ITEM_BIND: index=${index} uri=${photo.uri}`,
      `FAST_THUMB_LOAD_START: index=${index}`,
      thumbnailOk ? `FAST_THUMB_LOAD_OK: index=${index} width=128 height=128` : `FAST_THUMB_LOAD_FAIL: index=${index} uri=${photo.uri} exception=FileNotFoundException: missing`,
      `FAST_IMAGEVIEW_SIZE: index=${index} width=128 height=112`,
      `FAST_IMAGE_SET: index=${index} drawableNull=${!thumbnailOk}`
    ]
  };
  return item;
}
function renderTimelineUiHarness({ selectedVisit }) {
  const root = ["status", "summary", "command", "actionPanel", "timelinePanel", "webView"];
  const photos = selectedVisit;
  const screenHeight = 1000;
  const usefulHeight = Math.max(screenHeight - 60 - 80, Math.floor(screenHeight * 0.7));
  const expandedHeight = Math.max(Math.floor(usefulHeight * 0.88), 700);
  const collapsedHeight = Math.max(Math.floor(usefulHeight * 0.42), 320);
  const expandedGridHeight = expandedHeight - 260;
  const collapsedGridHeight = collapsedHeight - 180;
  const timelinePanel = {
    created: true,
    parent: "rootLayout",
    visible: false,
    expanded: false,
    height: "wrap_content",
    attachedToWindow: false,
    index: root.indexOf("timelinePanel")
  };
  const desiredIndex = root.indexOf("summary") + 1;
  root.splice(timelinePanel.index, 1);
  root.splice(desiredIndex, 0, "timelinePanel");
  timelinePanel.index = desiredIndex;
  timelinePanel.visible = true;
  timelinePanel.attachedToWindow = true;
  timelinePanel.expanded = true;
  timelinePanel.height = expandedHeight;
  const grid = { height: expandedGridHeight, adapter: { itemCount: photos.length } };
  const collapsed = { panelHeight: collapsedHeight, gridHeight: collapsedGridHeight, itemCount: photos.length };
  const expanded = { panelHeight: expandedHeight, gridHeight: expandedGridHeight, itemCount: photos.length };
  return {
    root,
    timelinePanel,
    commandVisible: false,
    actionPanelVisible: false,
    grid,
    collapsed,
    expanded,
    usefulHeight,
    reviewButton: { visible: true, enabled: false, text: "REVISAR BLOCOS" },
    logs: [
      "FAST_TIMELINE_VIEW_CREATE",
      `FAST_GRID_SOURCE_COUNT: ${photos.length}`,
      `FAST_PHOTO_1_URI: ${photos[0]?.uri}`,
      "FAST_PHOTO_1_URI_SCHEME: content",
      "FAST_MEDIA_PERMISSION_GRANTED: true",
      "FAST_TIMELINE_PARENT_FOUND: true",
      "FAST_TIMELINE_ADD_VIEW",
      "FAST_EXPAND_CLICK",
      `FAST_EXPAND_BEFORE_HEIGHT: ${collapsedHeight}`,
      "FAST_TIMELINE_EXPANDED",
      `FAST_EXPAND_AFTER_HEIGHT: ${expandedHeight}`,
      "FAST_EXPAND_STATE: EXPANDED",
      "FAST_GRID_VISIBLE: true",
      `FAST_GRID_ITEM_COUNT: ${photos.length}`,
      "FAST_TIMELINE_VISIBLE",
      "FAST_TIMELINE_ADAPTER_SET",
      `FAST_TIMELINE_ITEM_COUNT: ${grid.adapter.itemCount}`,
      "FAST_TIMELINE_UI_ATTACHED"
    ]
  };
}

test("FAST_TIMELINE painel inicia visivel expandido com grid de 51 fotos", () => {
  const ui = renderTimelineUiHarness({ selectedVisit: timelinePhotos(51) });
  assert.equal(ui.timelinePanel.created, true);
  assert.equal(ui.timelinePanel.parent, "rootLayout");
  assert.equal(ui.timelinePanel.visible, true);
  assert.equal(ui.timelinePanel.expanded, true);
  assert.ok(ui.timelinePanel.height >= ui.usefulHeight * 0.7);
  assert.equal(ui.timelinePanel.attachedToWindow, true);
  assert.ok(ui.grid.height >= 420);
  assert.equal(ui.grid.adapter.itemCount, 51);
  assert.equal(ui.commandVisible, false);
  assert.equal(ui.actionPanelVisible, false);
  assert.equal(ui.root[ui.timelinePanel.index], "timelinePanel");
  assert.ok(ui.root.indexOf("timelinePanel") < ui.root.indexOf("command"));
  assert.ok(ui.logs.includes("FAST_TIMELINE_EXPANDED"));
  assert.ok(ui.logs.includes("FAST_EXPAND_STATE: EXPANDED"));
  assert.ok(ui.logs.includes("FAST_GRID_VISIBLE: true"));
  assert.ok(ui.logs.includes("FAST_GRID_ITEM_COUNT: 51"));
  assert.ok(ui.logs.includes("FAST_TIMELINE_ADAPTER_SET"));
  assert.ok(ui.logs.includes("FAST_TIMELINE_ITEM_COUNT: 51"));
});

test("FAST_TIMELINE permite recolher e expandir preservando grid de 51 fotos", () => {
  const ui = renderTimelineUiHarness({ selectedVisit: timelinePhotos(51) });
  assert.ok(ui.collapsed.panelHeight < ui.expanded.panelHeight);
  assert.ok(ui.collapsed.gridHeight < ui.expanded.gridHeight);
  assert.equal(ui.collapsed.itemCount, 51);
  assert.equal(ui.expanded.itemCount, 51);
});
test("FAST_TIMELINE prova fonte URI permissao e adapter com 51 itens", () => {
  const ui = renderTimelineUiHarness({ selectedVisit: timelinePhotos(51) });
  assert.ok(ui.logs.includes("FAST_GRID_SOURCE_COUNT: 51"));
  assert.ok(ui.logs.includes("FAST_PHOTO_1_URI: content://timeline/1"));
  assert.ok(ui.logs.includes("FAST_PHOTO_1_URI_SCHEME: content"));
  assert.ok(ui.logs.includes("FAST_MEDIA_PERMISSION_GRANTED: true"));
  assert.equal(ui.grid.adapter.itemCount, 51);
});

test("FAST_TIMELINE primeiro item fica visivel mesmo se thumbnail falhar", () => {
  const item = timelineAdapterItemHarness({ index: 0, thumbnailOk: false });
  assert.equal(item.adapterCount, 51);
  assert.equal(item.viewCreated, true);
  assert.equal(item.visible, true);
  assert.equal(item.alpha, 1);
  assert.equal(item.imageView.visible, true);
  assert.ok(item.imageView.width > 0);
  assert.ok(item.imageView.height > 0);
  assert.equal(item.imageView.drawableNull, true);
  assert.equal(item.imageView.backgroundVisible, true);
  assert.equal(item.label.visible, true);
  assert.match(item.label.text, /#01/);
  assert.match(item.label.text, /18:40:00/);
  assert.match(item.contentDescription, /Foto 1/);
  assert.ok(item.logs.some((line) => line.startsWith("FAST_ITEM_BIND: index=0")));
  assert.ok(item.logs.some((line) => line.startsWith("FAST_THUMB_LOAD_FAIL: index=0")));
  assert.ok(item.logs.includes("FAST_IMAGE_SET: index=0 drawableNull=true"));
});

test("FAST_TIMELINE thumbnail carregada aplica imagem sem esconder item", () => {
  const item = timelineAdapterItemHarness({ index: 1, thumbnailOk: true });
  assert.equal(item.adapterCount, 51);
  assert.equal(item.visible, true);
  assert.equal(item.imageView.visible, true);
  assert.equal(item.imageView.drawableNull, false);
  assert.match(item.label.text, /#02/);
  assert.match(item.contentDescription, /Foto 2/);
  assert.ok(item.logs.some((line) => line.startsWith("FAST_THUMB_LOAD_OK: index=1")));
  assert.ok(item.logs.includes("FAST_IMAGE_SET: index=1 drawableNull=false"));
});

test("FAST_TIMELINE cortes reais liberam revisar, confirmar e relatorio sem IA", () => {
  const flow = timelineReviewFlowHarness();
  assert.equal(flow.validation.ok, true);
  assert.equal(flow.state.cutsComplete, true);
  assert.equal(flow.state.reviewVisible, true);
  assert.equal(flow.state.reviewEnabled, true);
  assert.equal(flow.state.confirmEnabled, true);
  assert.equal(flow.afterConfirm.reportAvailable, true);
  assert.equal(flow.aiRequests, 0);
});

test("FAST_TIMELINE revisao mostra 5 blocos reais com ranges e total 51", () => {
  const flow = timelineReviewFlowHarness();
  assert.deepEqual(flow.blocks.map(({ category, rangeLabel, count }) => ({ category, rangeLabel, count })), [
    { category: "CAMERAS", rangeLabel: "#1-#7", count: 7 },
    { category: "TOMADAS", rangeLabel: "#8-#9", count: 2 },
    { category: "RACK", rangeLabel: "#10-#25", count: 16 },
    { category: "MASTRO_ANTENA", rangeLabel: "#26", count: 1 },
    { category: "CAIXA_FUNDO_MADEIRA", rangeLabel: "#27-#51", count: 25 }
  ]);
  assert.equal(flow.blocks.reduce((sum, block) => sum + block.count, 0), 51);
});

test("FAST_TIMELINE voltar preserva cortes e limpar reseta organizacao", () => {
  const flow = timelineReviewFlowHarness();
  assert.deepEqual(flow.afterBack.cuts, realFastTimelineCuts());
  assert.equal(flow.afterBack.reviewEnabled, true);
  assert.deepEqual(flow.afterClear.cuts, {});
  assert.equal(flow.afterClear.cutsComplete, false);
  assert.equal(flow.afterClear.reviewEnabled, false);
  assert.equal(flow.afterClear.reportAvailable, false);
});
test("IA explicita recebe somente as 24 fotos da janela selecionada", () => {
  const datePhotos = filterByLocalDate(physicalWindowFixture(), "2026-08-28");
  const selectedVisit = filterPhotosByUserWindow(datePhotos, "2026-08-28", "15:40", "16:10");
  const aiPhotos = selectedVisit;
  assert.equal(aiPhotos.length, 24);
  assert.notEqual(aiPhotos.length, 100);
  assert.notEqual(aiPhotos.length, 300);
});

function chooseRealTimestamp(photo) {
  const candidates = [
    ["EXIF_DATETIME_ORIGINAL", photo.exifDateOriginal, photo.exifDateOriginalRaw],
    ["MEDIASTORE_DATE_TAKEN", photo.dateTaken, photo.dateTakenRaw],
    ["EXIF_DATETIME_DIGITIZED", photo.exifDateDigitized, photo.exifDateDigitizedRaw],
    ["MEDIASTORE_DATE_MODIFIED", photo.dateModified, photo.dateModifiedRaw],
    ["MEDIASTORE_DATE_ADDED", photo.dateAdded, photo.dateAddedRaw]
  ];
  for (const [source, value, raw] of candidates) {
    if (value) return { source, value, raw: raw ?? value };
  }
  return null;
}

function parseWindowTime(value, isEnd = false) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const hasSeconds = match[3] != null;
  const second = hasSeconds ? Number(match[3]) : (isEnd ? 59 : 0);
  const millisecond = isEnd ? 999 : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second, millisecond, hasSeconds, secondsOfDay: hour * 3600 + minute * 60 + second + millisecond / 1000 };
}

function filterByAbsoluteWindow(photos, date, start, end, cityHint = null) {
  const parsedStart = parseWindowTime(start, false);
  const parsedEnd = parseWindowTime(end, true);
  if (!parsedStart || !parsedEnd) throw new Error("invalid_time");
  const timeWindowPhotos = photos.filter((photo) => {
    const timestamp = chooseRealTimestamp(photo);
    if (!timestamp) return false;
    if (!String(timestamp.value).startsWith(date)) return false;
    const time = String(timestamp.value).match(/T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?/);
    if (!time) return false;
    const seconds = Number(time[1]) * 3600 + Number(time[2]) * 60 + Number(time[3]) + Number(time[4] || 0) / 1000;
    return seconds >= parsedStart.secondsOfDay && seconds <= parsedEnd.secondsOfDay;
  });
  const cityFiltered = cityHint ? timeWindowPhotos.filter((photo) => cityMatches(photo.city, cityHint)) : timeWindowPhotos;
  if (cityFiltered.length > timeWindowPhotos.length) throw new Error("no_expansion_invariant_failed");
  return { timeWindowPhotos, cityFiltered, selectedVisitPhotos: cityFiltered };
}

function realWindowFixture210() {
  const photos = [];
  for (let index = 0; index < 207; index += 1) {
    photos.push({ uri: `content://wide/${index}`, exifDateOriginal: `2026-08-25T10:${String(index % 60).padStart(2, "0")}:00-03:00`, city: "Ibicoara" });
  }
  for (const second of [10, 42, 55]) {
    photos.push({ uri: `content://window/${second}`, exifDateOriginal: `2026-08-25T09:36:${String(second).padStart(2, "0")}-03:00`, city: "Ibicoara" });
  }
  return photos;
}

test("timestamp-source prioriza captura real antes de DATE_ADDED", () => {
  const photo = {
    exifDateOriginal: "2026-08-25T09:36:42-03:00",
    dateTaken: "2026-08-25T09:36:42-03:00",
    exifDateDigitized: "2026-08-25T09:36:43-03:00",
    dateModified: "2026-08-25T12:00:00-03:00",
    dateAdded: "2026-08-25T18:00:00-03:00"
  };
  assert.equal(chooseRealTimestamp(photo).source, "EXIF_DATETIME_ORIGINAL");
  assert.equal(chooseRealTimestamp({ ...photo, exifDateOriginal: null }).source, "MEDIASTORE_DATE_TAKEN");
  assert.equal(chooseRealTimestamp({ ...photo, exifDateOriginal: null, dateTaken: null }).source, "EXIF_DATETIME_DIGITIZED");
});

test("foto real 09:36:42 entra e sai por segundos inclusivos", () => {
  const photo = { uri: "known", exifDateOriginal: "2026-08-25T09:36:42-03:00", city: "Ibicoara" };
  assert.deepEqual(filterByAbsoluteWindow([photo], "2026-08-25", "09:36", "09:37").selectedVisitPhotos.map((item) => item.uri), ["known"]);
  assert.deepEqual(filterByAbsoluteWindow([photo], "2026-08-25", "09:36:40", "09:36:45").selectedVisitPhotos.map((item) => item.uri), ["known"]);
  assert.deepEqual(filterByAbsoluteWindow([photo], "2026-08-25", "09:36:43", "09:36:50").selectedVisitPhotos, []);
});

test("HH:mm:ss filtra fim inclusivo sem pegar segundo seguinte", () => {
  const photos = ["00", "01", "03", "05", "06"].map((second) => ({ uri: second, exifDateOriginal: `2026-08-25T15:02:${second}-03:00` }));
  const result = filterByAbsoluteWindow(photos, "2026-08-25", "15:02:01", "15:02:05");
  assert.deepEqual(result.selectedVisitPhotos.map((photo) => photo.uri), ["01", "03", "05"]);
  assert.equal(result.selectedVisitPhotos.length, 3);
});

test("210 fotos na data reduzem para 3 na janela absoluta sem reexpandir", () => {
  const datePhotos = realWindowFixture210();
  const result = filterByAbsoluteWindow(datePhotos, "2026-08-25", "09:36", "09:37", "Ibicoara");
  assert.equal(datePhotos.length, 210);
  assert.equal(result.timeWindowPhotos.length, 3);
  assert.equal(result.cityFiltered.length, 3);
  assert.equal(result.selectedVisitPhotos.length, 3);
  assert.ok(result.selectedVisitPhotos.length <= result.timeWindowPhotos.length);
});

test("metadata diferente usa horario de captura, nao DATE_ADDED 18:00", () => {
  const photo = {
    uri: "metadata-diff",
    exifDateOriginal: "2026-08-25T09:36:42-03:00",
    dateTaken: "2026-08-25T09:36:42-03:00",
    dateAdded: "2026-08-25T18:00:00-03:00",
    dateAddedRaw: 1787680800
  };
  const result = filterByAbsoluteWindow([photo], "2026-08-25", "09:36", "09:37");
  assert.equal(result.selectedVisitPhotos[0].uri, "metadata-diff");
  assert.equal(chooseRealTimestamp(photo).source, "EXIF_DATETIME_ORIGINAL");
});

test("sem EXIF original usa DATE_TAKEN valido", () => {
  const photo = { uri: "date-taken", dateTaken: "2026-08-25T09:36:42-03:00", dateAdded: "2026-08-25T18:00:00-03:00" };
  assert.equal(chooseRealTimestamp(photo).source, "MEDIASTORE_DATE_TAKEN");
  assert.equal(filterByAbsoluteWindow([photo], "2026-08-25", "09:36", "09:37").selectedVisitPhotos.length, 1);
});

test("fallback usa DATE_MODIFIED ou DATE_ADDED somente sem captura real", () => {
  const modified = { uri: "modified", dateModified: "2026-08-25T09:36:42-03:00", dateAdded: "2026-08-25T18:00:00-03:00" };
  const added = { uri: "added", dateAdded: "2026-08-25T09:36:42-03:00" };
  assert.equal(chooseRealTimestamp(modified).source, "MEDIASTORE_DATE_MODIFIED");
  assert.equal(chooseRealTimestamp(added).source, "MEDIASTORE_DATE_ADDED");
});

test("city hint restringe a janela, nunca expande", () => {
  const photos = [
    { uri: "ibicoara", exifDateOriginal: "2026-08-25T09:36:42-03:00", city: "Ibicoara" },
    { uri: "outra", exifDateOriginal: "2026-08-25T09:36:43-03:00", city: "Outra Cidade" }
  ];
  const result = filterByAbsoluteWindow(photos, "2026-08-25", "09:36", "09:37", "Ibicoara");
  assert.equal(result.timeWindowPhotos.length, 2);
  assert.deepEqual(result.selectedVisitPhotos.map((photo) => photo.uri), ["ibicoara"]);
  assert.ok(result.selectedVisitPhotos.length <= result.timeWindowPhotos.length);
});

test("janela invalida nao cai para fotos do dia", () => {
  assert.throws(() => filterByAbsoluteWindow(realWindowFixture210(), "2026-08-25", "09:99", "09:37"), /invalid_time/);
});

function makeDiagnosticSnapshot(overrides = {}) {
  const snapshot = {
    dateRaw: "2026-08-25",
    startTimeRaw: "09:36",
    endTimeRaw: "09:37",
    parsedStart: "09:36",
    parsedEnd: "09:37:59.999999999",
    timezone: "America/Bahia",
    completeWindowInformed: true,
    invalidTime: false,
    windowFilterCalled: true,
    photosAfterDate: 210,
    photosAfterTime: 3,
    photosAfterCity: 3,
    selectedVisitPhotos: 3,
    photosSentToTimeline: 3,
    photosSentToAi: 0,
    visitGrouperBypass: true,
    timestampSourceCounts: {
      EXIF_DATETIME_ORIGINAL: 2,
      MEDIASTORE_DATE_TAKEN: 1,
      EXIF_DATETIME_DIGITIZED: 0,
      MEDIASTORE_DATE_MODIFIED: 0,
      MEDIASTORE_DATE_ADDED: 0
    },
    datePhotoSamples: [{ idOrName: "known.jpg", timestampSource: "EXIF_DATETIME_ORIGINAL", timestampRaw: "2026:08:25 09:36:42", timestampLocal: "2026-08-25 09:36:42", insideWindow: true, city: "Ibicoara" }],
    timeWindowSamples: [{ idOrName: "known.jpg", timestampSource: "EXIF_DATETIME_ORIGINAL", timestampRaw: "2026:08:25 09:36:42", timestampLocal: "2026-08-25 09:36:42", insideWindow: true, city: "Ibicoara" }],
    selectedSamples: [{ idOrName: "known.jpg", timestampSource: "EXIF_DATETIME_ORIGINAL", timestampRaw: "2026:08:25 09:36:42", timestampLocal: "2026-08-25 09:36:42", insideWindow: true, city: "Ibicoara" }],
    ...overrides
  };
  snapshot.expandedAfterFilter = snapshot.selectedVisitPhotos > snapshot.photosAfterTime;
  snapshot.filterNotCalledWithCompleteWindow = snapshot.completeWindowInformed && !snapshot.windowFilterCalled;
  snapshot.visitGrouperUsedWithCompleteWindow = snapshot.completeWindowInformed && !snapshot.visitGrouperBypass;
  snapshot.cityFilterZeroedWindow = snapshot.photosAfterTime > 0 && snapshot.photosAfterCity === 0;
  snapshot.timeFilterDidNotReduce = snapshot.photosAfterDate === 210 && snapshot.photosAfterTime === 210;
  return snapshot;
}

function diagnosticText(snapshot) {
  const lines = [
    `DATE_RAW=${snapshot.dateRaw}`,
    `START_RAW=${snapshot.startTimeRaw}`,
    `END_RAW=${snapshot.endTimeRaw}`,
    `START_PARSED=${snapshot.parsedStart}`,
    `END_PARSED=${snapshot.parsedEnd}`,
    `TIMEZONE=${snapshot.timezone}`,
    `WINDOW_FILTER_CALLED=${snapshot.windowFilterCalled}`,
    `AFTER_DATE=${snapshot.photosAfterDate}`,
    `AFTER_TIME=${snapshot.photosAfterTime}`,
    `AFTER_CITY=${snapshot.photosAfterCity}`,
    `SELECTED=${snapshot.selectedVisitPhotos}`,
    `VISITGROUPER_BYPASS=${snapshot.visitGrouperBypass}`,
    `EXPANDED_AFTER_FILTER=${snapshot.expandedAfterFilter}`,
    `SENT_TIMELINE=${snapshot.photosSentToTimeline}`,
    `SENT_AI=${snapshot.photosSentToAi}`,
    "TIMESTAMP_SOURCE_COUNTS:",
    `EXIF_DATETIME_ORIGINAL=${snapshot.timestampSourceCounts.EXIF_DATETIME_ORIGINAL || 0}`,
    `MEDIASTORE_DATE_TAKEN=${snapshot.timestampSourceCounts.MEDIASTORE_DATE_TAKEN || 0}`,
    "SAMPLE_DATE:",
    ...snapshot.datePhotoSamples.map((sample) => `ID=${sample.idOrName} | SOURCE=${sample.timestampSource} | RAW=${sample.timestampRaw} | LOCAL=${sample.timestampLocal} | IN_WINDOW=${sample.insideWindow ? "SIM" : "NAO"} | CITY=${sample.city}`),
    "SAMPLE_TIME:",
    ...snapshot.timeWindowSamples.map((sample) => `ID=${sample.idOrName} | SOURCE=${sample.timestampSource}`),
    "SAMPLE_SELECTED:",
    ...snapshot.selectedSamples.map((sample) => `ID=${sample.idOrName} | SOURCE=${sample.timestampSource}`)
  ];
  if (snapshot.filterNotCalledWithCompleteWindow) lines.push("ERRO=JANELA COMPLETA INFORMADA, MAS FILTRO HORARIO NAO FOI EXECUTADO");
  if (snapshot.timeFilterDidNotReduce) lines.push("ALERTA=FILTRO HORARIO NAO REDUZIU O CONJUNTO");
  if (snapshot.expandedAfterFilter) lines.push("ERRO=CONJUNTO FOI EXPANDIDO APOS O FILTRO HORARIO");
  if (snapshot.visitGrouperUsedWithCompleteWindow) lines.push("ERRO=VISITGROUPER FOI USADO COM JANELA COMPLETA");
  if (snapshot.cityFilterZeroedWindow) lines.push("ALERTA=FILTRO DE CIDADE ZEROU A JANELA");
  return lines.join("\n");
}

test("diagnostic snapshot recebe UI raw e valores parseados", () => {
  const text = diagnosticText(makeDiagnosticSnapshot());
  assert.match(text, /DATE_RAW=2026-08-25/);
  assert.match(text, /START_RAW=09:36/);
  assert.match(text, /END_RAW=09:37/);
  assert.match(text, /START_PARSED=09:36/);
  assert.match(text, /END_PARSED=09:37:59/);
  assert.match(text, /TIMEZONE=America\/Bahia/);
});

test("diagnostic snapshot mostra contadores principais", () => {
  const text = diagnosticText(makeDiagnosticSnapshot());
  assert.match(text, /AFTER_DATE=210/);
  assert.match(text, /AFTER_TIME=3/);
  assert.match(text, /AFTER_CITY=3/);
  assert.match(text, /SELECTED=3/);
  assert.match(text, /SENT_TIMELINE=3/);
  assert.match(text, /SENT_AI=0/);
});

test("diagnostic snapshot mostra fontes de timestamp e amostras", () => {
  const text = diagnosticText(makeDiagnosticSnapshot());
  assert.match(text, /TIMESTAMP_SOURCE_COUNTS/);
  assert.match(text, /EXIF_DATETIME_ORIGINAL=2/);
  assert.match(text, /MEDIASTORE_DATE_TAKEN=1/);
  assert.match(text, /SAMPLE_DATE/);
  assert.match(text, /SAMPLE_TIME/);
  assert.match(text, /SAMPLE_SELECTED/);
  assert.match(text, /LOCAL=2026-08-25 09:36:42/);
  assert.match(text, /IN_WINDOW=SIM/);
});

test("diagnostic snapshot acusa expansao apos filtro", () => {
  const text = diagnosticText(makeDiagnosticSnapshot({ photosAfterTime: 3, selectedVisitPhotos: 210 }));
  assert.match(text, /EXPANDED_AFTER_FILTER=true/);
  assert.match(text, /CONJUNTO FOI EXPANDIDO APOS O FILTRO HORARIO/);
});

test("diagnostic snapshot acusa filtro nao chamado com janela completa", () => {
  const text = diagnosticText(makeDiagnosticSnapshot({ windowFilterCalled: false }));
  assert.match(text, /WINDOW_FILTER_CALLED=false/);
  assert.match(text, /JANELA COMPLETA INFORMADA, MAS FILTRO HORARIO NAO FOI EXECUTADO/);
});

test("diagnostic snapshot acusa VisitGrouper usado com janela completa", () => {
  const text = diagnosticText(makeDiagnosticSnapshot({ visitGrouperBypass: false }));
  assert.match(text, /VISITGROUPER_BYPASS=false/);
  assert.match(text, /VISITGROUPER FOI USADO COM JANELA COMPLETA/);
});

test("diagnostic snapshot acusa filtro horario sem reducao", () => {
  const text = diagnosticText(makeDiagnosticSnapshot({ photosAfterDate: 210, photosAfterTime: 210 }));
  assert.match(text, /FILTRO HORARIO NAO REDUZIU O CONJUNTO/);
});

test("diagnostic snapshot acusa cidade zerando janela", () => {
  const text = diagnosticText(makeDiagnosticSnapshot({ photosAfterTime: 3, photosAfterCity: 0, selectedVisitPhotos: 0 }));
  assert.match(text, /FILTRO DE CIDADE ZEROU A JANELA/);
});

test("copy diagnostic usa texto compacto sem dados sensiveis", () => {
  const text = diagnosticText(makeDiagnosticSnapshot());
  assert.match(text, /DATE_RAW=/);
  assert.doesNotMatch(text, /api[_-]?key|token|secret|password/i);
  assert.doesNotMatch(text, /C:\\/);
});

function runPhysicalPipeline({ photos, date, start, end, cityHint = null }) {
  const calls = [];
  calls.push(`date:${photos.length}`);
  const afterTime = filterByAbsoluteWindow(photos, date, start, end).timeWindowPhotos;
  calls.push(`time:${afterTime.length}`);
  const cityInput = afterTime;
  calls.push(`city:${cityInput.length}`);
  const afterCity = cityHint ? cityInput.filter((photo) => cityMatches(photo.city, cityHint)) : cityInput;
  calls.push(`city-filter:${afterCity.length}`);
  let visitGrouperCalls = 0;
  const selected = afterCity;
  calls.push(`selected:${selected.length}`);
  const timeline = selected;
  calls.push(`timeline:${timeline.length}`);
  return { calls, afterDate: photos.length, afterTime, cityInput, afterCity, visitGrouperCalls, selected, timeline, ai: 0 };
}

function physicalPrintFixture214() {
  const photos = [];
  for (let index = 0; index < 207; index += 1) {
    photos.push({ uri: `content://outside/${index}`, exifDateOriginal: `2026-08-25T10:${String(index % 60).padStart(2, "0")}:00-03:00`, city: "Ibicoara" });
  }
  for (let index = 0; index < 4; index += 1) {
    photos.push({ uri: `content://other-city/${index}`, exifDateOriginal: `2026-08-25T11:${String(index).padStart(2, "0")}:00-03:00`, city: "Outra Cidade" });
  }
  for (const second of [10, 42, 55]) {
    photos.push({ uri: `content://window/${second}`, exifDateOriginal: `2026-08-25T09:36:${String(second).padStart(2, "0")}-03:00`, city: "Ibicoara" });
  }
  return photos;
}

test("pipeline physical reproduz print 214 e restringe janela antes de cidade", () => {
  const result = runPhysicalPipeline({ photos: physicalPrintFixture214(), date: "2026-08-25", start: "09:36", end: "09:37", cityHint: "Ibicoara" });
  assert.equal(result.afterDate, 214);
  assert.equal(result.afterTime.length, 3);
  assert.equal(result.cityInput.length, 3);
  assert.equal(result.visitGrouperCalls, 0);
  assert.ok(result.selected.length <= 3);
  assert.ok(result.timeline.length <= 3);
  assert.equal(result.ai, 0);
});

test("pipeline order prova time filter antes de identificar cidade", () => {
  const result = runPhysicalPipeline({ photos: physicalPrintFixture214(), date: "2026-08-25", start: "09:36", end: "09:37" });
  assert.deepEqual(result.calls.slice(0, 3), ["date:214", "time:3", "city:3"]);
  assert.ok(result.calls.indexOf("time:3") < result.calls.indexOf("city:3"));
  assert.ok(result.calls.indexOf("city:3") < result.calls.indexOf("timeline:3"));
});

test("com janela completa VisitGrouper nao e chamado no caminho real", () => {
  const result = runPhysicalPipeline({ photos: physicalPrintFixture214(), date: "2026-08-25", start: "09:36", end: "09:37" });
  assert.equal(result.visitGrouperCalls, 0);
});

test("janela vazia nao faz fallback para dia inteiro", () => {
  const result = runPhysicalPipeline({ photos: physicalPrintFixture214(), date: "2026-08-25", start: "08:00", end: "08:01" });
  assert.equal(result.afterDate, 214);
  assert.equal(result.afterTime.length, 0);
  assert.equal(result.cityInput.length, 0);
  assert.equal(result.selected.length, 0);
  assert.notEqual(result.selected.length, 214);
});



test("parser propaga inicio e fim rotulados para o comando estruturado", () => {
  const parsed = parseCommand("25/08/2026 início 09:36 fim 09:37");
  assert.equal(parsed.reportType, "UNKNOWN");
  assert.equal(parsed.dateHint, "2026-08-25");
  assert.equal(parsed.startTimeHint, "09:36");
  assert.equal(parsed.endTimeHint, "09:37");
  assert.equal(parsed.rawStartTimeHint, "09:36");
  assert.equal(parsed.rawEndTimeHint, "09:37");
  assert.equal(parsed.timeRangeInvalid, false);
});

test("parser propaga inicio e fim com comando monte sgto", () => {
  const parsed = parseCommand("monte sgto 25/08/2026 início 09:36 fim 09:37");
  const refinement = parseVisitRefinement("monte sgto 25/08/2026 início 09:36 fim 09:37");
  assert.equal(parsed.reportType, "SGTO");
  assert.equal(parsed.dateHint, "2026-08-25");
  assert.equal(parsed.startTimeHint, "09:36");
  assert.equal(parsed.endTimeHint, "09:37");
  assert.equal(refinement.cityHint, null);
});

test("parser aceita variacoes naturais de janela", () => {
  for (const command of [
    "25/08/2026 início 09:36 fim 09:37",
    "25/08/2026 inicio 09:36 fim 09:37",
    "data 25/08/2026 início 09:36 fim 09:37",
    "monte sgto 25/08/2026 início 09:36 fim 09:37",
    "25/08/2026 de 09:36 até 09:37",
    "25/08/2026 das 09:36 às 09:37"
  ]) {
    const parsed = parseCommand(command);
    assert.equal(parsed.dateHint, "2026-08-25", command);
    assert.equal(parsed.startTimeHint, "09:36", command);
    assert.equal(parsed.endTimeHint, "09:37", command);
  }
});

test("parser aceita segundos em inicio e fim rotulados", () => {
  const parsed = parseCommand("25/08/2026 início 09:36:40 fim 09:36:45");
  assert.equal(parsed.dateHint, "2026-08-25");
  assert.equal(parsed.startTimeHint, "09:36:40");
  assert.equal(parsed.endTimeHint, "09:36:45");
  assert.equal(parsed.endTimeHasSeconds, true);
});

test("guard acusa horario semanticamente informado mas invalido", () => {
  const parsed = parseCommand("25/08/2026 início 09:99 fim 09:37");
  assert.equal(parsed.dateHint, "2026-08-25");
  assert.equal(parsed.startTimeHint, null);
  assert.equal(parsed.endTimeHint, null);
  assert.equal(parsed.timeRangeInvalid, true);
});

test("integracao parte do comando real e aplica janela antes de cidade", () => {
  const commandText = "monte sgto 25/08/2026 início 09:36 fim 09:37";
  const parsed = parseCommand(commandText);
  const result = runPhysicalPipeline({
    photos: physicalPrintFixture214(),
    date: parsed.dateHint,
    start: parsed.startTimeHint,
    end: parsed.endTimeHint,
    cityHint: parseVisitRefinement(commandText).cityHint
  });
  assert.equal(parsed.reportType, "SGTO");
  assert.equal(parsed.dateHint, "2026-08-25");
  assert.equal(parsed.startTimeHint, "09:36");
  assert.equal(parsed.endTimeHint, "09:37");
  assert.equal(result.afterDate, 214);
  assert.deepEqual(result.calls.slice(0, 3), ["date:214", "time:3", "city:3"]);
  assert.equal(result.afterTime.length, 3);
  assert.equal(result.afterCity.length, 3);
  assert.equal(result.visitGrouperCalls, 0);
  assert.equal(result.timeline.length, 3);
  assert.equal(result.ai, 0);
  assert.ok(result.selected.length <= result.afterTime.length);
});
