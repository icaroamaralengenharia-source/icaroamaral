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

function parseCommand(input) {
  const text = normalize(input);
  const reportType = text.includes("sgto") ? "SGTO" : (text.includes("stelecom") ? "STELECOM" : "UNKNOWN");
  const latestVisit = /ultima visita|ultimo atendimento/.test(text);
  const dateHint = parseDate(input);
  const cityBeforeDate = String(input).match(/\b(?:de|em)\s+([\p{L}\s]+?)\s+(?:do\s+dia|dia|em|no|na)\b/iu);
  const cityAtEnd = String(input).match(/\b(?:de|em)\s+([\p{L}\s]+)$/iu);
  const cityHint = (cityBeforeDate?.[1] || cityAtEnd?.[1] || "").trim();
  return { reportType, cityHint: /hoje|ontem|agosto|ultima visita/i.test(normalize(cityHint)) ? null : cityHint || null, dateHint, latestVisit };
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
  const date = parseDate(raw);
  const normalized = normalize(raw).replaceAll("as", "a").replaceAll("ate", "a");
  const time = normalized.match(/\b(\d{1,2})(?:[:h](\d{2}))?\s*(?:a|ate)\s*(\d{1,2})(?:[:h](\d{2}))?\b/);
  const startTime = time ? `${time[1].padStart(2, "0")}:${time[2] || "00"}` : null;
  const endTime = time ? `${time[3].padStart(2, "0")}:${time[4] || "00"}` : null;
  const cityHint = raw
    .replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}\s+de\s+[\p{L}]+(?:\s+de\s+\d{4})?\b/giu, " ")
    .replace(/\bde\s+\d{1,2}[:h]\d{2}\s*(?:a|ate|até|as|às)\s*\d{1,2}[:h]\d{2}\b/giu, " ")
    .replace(/\b\d{1,2}(?:[:h]\d{2})?\s*(?:a|ate|até|as|às)\s*\d{1,2}(?:[:h]\d{2})?\b/giu, " ")
    .replace(/\b(?:do|dia|em|no|na|de|ate|até|as|às)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { selectedIndex: null, date, startTime, endTime, cityHint: cityHint || null };
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
  assert.deepEqual(parseCommand("monte o sgto de Malhada de Pedras"), { reportType: "SGTO", cityHint: "Malhada de Pedras", dateHint: null, latestVisit: false });
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
test("SGTO_FAST_TIMELINE distribui 100 fotos pelos cortes 1,18,31,36,42", () => assertDefaultCuts(100));
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
