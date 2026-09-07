import assert from "node:assert/strict";
import { test } from "node:test";

const categories = ["CAMERAS", "TOMADAS", "RACK", "MASTRO_ANTENA", "CAIXA_FUNDO_MADEIRA"];
const reportKeys = {
  CAMERAS: "cameras",
  TOMADAS: "tomadas",
  RACK: "rack",
  MASTRO_ANTENA: "mastroAntena",
  CAIXA_FUNDO_MADEIRA: "caixaFundoMadeira"
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function parseTimeInput(value) {
  const match = String(value || "").match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/);
  if (!match) return null;
  const [, hh, mm, ss = "00"] = match;
  const hour = Number(hh);
  const minute = Number(mm);
  const second = Number(ss);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { seconds: hour * 3600 + minute * 60 + second, hasSeconds: Boolean(match[3]) };
}

function localParts(iso) {
  const match = String(iso || "").match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})/);
  if (!match) return null;
  return { date: match[1], seconds: Number(match[2]) * 3600 + Number(match[3]) * 60 + Number(match[4]) };
}

function bestTimestamp(photo) {
  return photo.exifDateOriginal || photo.dateTaken || photo.exifDateDigitized || photo.dateModified || photo.dateAdded || null;
}

function matchPhotosByTimeWindow(photos, { date, startTime, endTime }) {
  const start = parseTimeInput(startTime);
  const end = parseTimeInput(endTime);
  if (!start || !end || start.seconds > end.seconds) return { ok: false, photos: [], photosWithoutTimestamp: photos.filter((photo) => !bestTimestamp(photo)) };
  const inclusiveEnd = end.hasSeconds ? end.seconds : end.seconds + 59;
  return {
    ok: true,
    photos: photos.filter((photo) => {
      const parts = localParts(bestTimestamp(photo));
      return parts && (!date || parts.date === date) && parts.seconds >= start.seconds && parts.seconds <= inclusiveEnd;
    }),
    photosWithoutTimestamp: photos.filter((photo) => !bestTimestamp(photo))
  };
}

function buildReview(photos, windows) {
  const byCategory = {};
  const owners = new Map();
  for (const category of categories) {
    const window = windows[category];
    if (!window) continue;
    const automatic = new Set(matchPhotosByTimeWindow(photos, window).photos.map((photo) => photo.uri));
    for (const uri of window.manuallyExcludedPhotoIds || []) automatic.delete(uri);
    for (const uri of window.manuallyIncludedPhotoIds || []) automatic.add(uri);
    byCategory[category] = automatic;
    for (const uri of automatic) {
      if (!owners.has(uri)) owners.set(uri, []);
      owners.get(uri).push(category);
    }
  }
  return {
    byCategory,
    conflicts: [...owners].filter(([, ownerCategories]) => ownerCategories.length > 1).map(([uri, ownerCategories]) => ({ uri, categories: ownerCategories }))
  };
}

function validateWindows(photos, windows) {
  for (const category of categories) if (!windows[category]) return { ok: false, message: `${category} sem janela` };
  for (const category of categories) {
    const window = windows[category];
    const start = parseTimeInput(window.startTime);
    const end = parseTimeInput(window.endTime);
    if (!start || !end || start.seconds > end.seconds) return { ok: false, message: `${category} invalida` };
  }
  const review = buildReview(photos, windows);
  if (review.conflicts.length) return { ok: false, message: "CONFLITO DE JANELA" };
  return { ok: true, message: "PASS" };
}

function toReportPayload(photos, windows) {
  const validation = validateWindows(photos, windows);
  assert.equal(validation.ok, true, validation.message);
  const byUri = new Map(photos.map((photo) => [photo.uri, photo]));
  const review = buildReview(photos, windows);
  const payload = Object.fromEntries(Object.values(reportKeys).map((key) => [key, []]));
  for (const category of categories) {
    for (const uri of [...(review.byCategory[category] || [])].sort()) {
      payload[reportKeys[category]].push({ ...byUri.get(uri), category, classification: { source: "SGTO_FAST_TIMELINE", reason: "time_window_v2" } });
    }
  }
  return payload;
}

function parseCategoryWindowCommand(input) {
  const text = normalize(input);
  const category = text.includes("camera") ? "CAMERAS"
    : text.includes("tomada") ? "TOMADAS"
      : text.includes("rack") ? "RACK"
        : /mastro|antena/.test(text) ? "MASTRO_ANTENA"
          : text.includes("caixa") ? "CAIXA_FUNDO_MADEIRA"
            : null;
  if (!category) return null;
  const time = String.raw`(\d{1,2}:\d{2}(?::\d{2})?)`;
  const range = text.match(new RegExp(String.raw`(?:de|das|entre)\s+${time}\s+(?:ate|as|a|e)\s+${time}`)) ||
    text.match(new RegExp(String.raw`${time}\s+(?:ate|as|a|e)\s+${time}`));
  if (range) return { category, startTime: range[1], endTime: range[2], missingEnd: false };
  const start = text.match(new RegExp(String.raw`(?:de|das|a partir de)\s+${time}`));
  return start ? { category, startTime: start[1], endTime: null, missingEnd: true } : null;
}

function photo(uri, time, overrides = {}) {
  return { uri, exifDateOriginal: `2026-08-28T${time}-03:00`, ...overrides };
}

function realistic41Photos() {
  const times = [
    "16:05:00", "16:06:00", "16:07:00", "16:08:00", "16:09:00",
    "16:10:00", "16:11:00", "16:12:00", "16:13:00", "16:14:00", "16:15:00",
    "16:20:00", "16:21:00", "16:22:00", "16:23:00", "16:24:00", "16:25:00", "16:26:00", "16:27:00", "16:28:00", "16:29:00", "16:30:00", "16:31:00", "16:32:00", "16:33:00", "16:34:00", "16:35:00", "16:36:00", "16:37:00", "16:38:00",
    "16:40:00", "16:41:00", "16:42:00", "16:43:00", "16:44:00", "16:45:00", "16:46:00", "16:47:00", "16:48:00",
    "16:50:00", "16:55:00"
  ];
  return times.map((time, index) => photo(`p${String(index + 1).padStart(2, "0")}`, time));
}

test("V2 match por minuto usa fim inclusivo do minuto inteiro", () => {
  const photos = [photo("a", "16:07:00"), photo("b", "16:07:59"), photo("c", "16:08:00")];
  assert.deepEqual(matchPhotosByTimeWindow(photos, { date: "2026-08-28", startTime: "16:07", endTime: "16:07" }).photos.map((item) => item.uri), ["a", "b"]);
});

test("V2 match por segundo respeita limite exato inclusivo", () => {
  const photos = [photo("a", "16:07:11"), photo("b", "16:07:12"), photo("c", "16:07:33"), photo("d", "16:07:34")];
  assert.deepEqual(matchPhotosByTimeWindow(photos, { date: "2026-08-28", startTime: "16:07:12", endTime: "16:07:33" }).photos.map((item) => item.uri), ["b", "c"]);
});

test("V2 janela vazia e foto sem timestamp nao fazem fallback", () => {
  const result = matchPhotosByTimeWindow([{ uri: "sem-data" }, photo("fora", "15:00:00")], { date: "2026-08-28", startTime: "16:00", endTime: "16:01" });
  assert.equal(result.photos.length, 0);
  assert.equal(result.photosWithoutTimestamp.length, 1);
});

test("V2 categorias fora de ordem sao validas", () => {
  const photos = [photo("rack", "16:06:00"), photo("camera", "16:30:00"), photo("tomada", "15:58:00"), photo("mastro", "16:50:00"), photo("caixa", "16:08:00")];
  const windows = {
    CAMERAS: { category: "CAMERAS", date: "2026-08-28", startTime: "16:20", endTime: "16:40" },
    RACK: { category: "RACK", date: "2026-08-28", startTime: "16:05", endTime: "16:06" },
    TOMADAS: { category: "TOMADAS", date: "2026-08-28", startTime: "15:55", endTime: "16:05" },
    MASTRO_ANTENA: { category: "MASTRO_ANTENA", date: "2026-08-28", startTime: "16:50", endTime: "16:55" },
    CAIXA_FUNDO_MADEIRA: { category: "CAIXA_FUNDO_MADEIRA", date: "2026-08-28", startTime: "16:07", endTime: "16:09" }
  };
  assert.equal(validateWindows(photos, windows).ok, true);
});

test("V2 overlapping windows geram conflito explicito", () => {
  const photos = [photo("x", "16:10:00")];
  const review = buildReview(photos, {
    CAMERAS: { date: "2026-08-28", startTime: "16:00", endTime: "16:15" },
    RACK: { date: "2026-08-28", startTime: "16:10", endTime: "16:20" }
  });
  assert.deepEqual(review.conflicts, [{ uri: "x", categories: ["CAMERAS", "RACK"] }]);
});

test("V2 inclusao e exclusao manual ajustam candidatas sem IA", () => {
  const photos = [photo("a", "16:00:00"), photo("b", "16:10:00"), photo("manual", "18:00:00")];
  const review = buildReview(photos, {
    CAMERAS: { date: "2026-08-28", startTime: "16:00", endTime: "16:10", manuallyExcludedPhotoIds: ["a"], manuallyIncludedPhotoIds: ["manual"] }
  });
  assert.deepEqual([...review.byCategory.CAMERAS].sort(), ["b", "manual"]);
});

test("V2 adapter do relatorio preserva grupos SGTO esperados", () => {
  const photos = [photo("cam", "16:20:00"), photo("tom", "16:40:00"), photo("rack", "16:10:00"), photo("mast", "16:50:00"), photo("caixa", "16:05:00")];
  const payload = toReportPayload(photos, {
    CAMERAS: { date: "2026-08-28", startTime: "16:20", endTime: "16:20" },
    TOMADAS: { date: "2026-08-28", startTime: "16:40", endTime: "16:40" },
    RACK: { date: "2026-08-28", startTime: "16:10", endTime: "16:10" },
    MASTRO_ANTENA: { date: "2026-08-28", startTime: "16:50", endTime: "16:50" },
    CAIXA_FUNDO_MADEIRA: { date: "2026-08-28", startTime: "16:05", endTime: "16:05" }
  });
  assert.equal(payload.cameras.length, 1);
  assert.equal(payload.tomadas.length, 1);
  assert.equal(payload.rack.length, 1);
  assert.equal(payload.mastroAntena.length, 1);
  assert.equal(payload.caixaFundoMadeira.length, 1);
});

test("V2 parser natural extrai categoria e janela", () => {
  assert.deepEqual(parseCategoryWindowCommand("câmeras de 16:07 até 16:45"), { category: "CAMERAS", startTime: "16:07", endTime: "16:45", missingEnd: false });
  assert.deepEqual(parseCategoryWindowCommand("rack das 15:44:20 às 15:49:55"), { category: "RACK", startTime: "15:44:20", endTime: "15:49:55", missingEnd: false });
  assert.deepEqual(parseCategoryWindowCommand("Câmeras a partir de 16:07"), { category: "CAMERAS", startTime: "16:07", endTime: null, missingEnd: true });
});

test("V2 fixture realista 41 fotos distribui janelas fora de ordem", () => {
  const photos = realistic41Photos();
  const windows = {
    TOMADAS: { date: "2026-08-28", startTime: "16:40", endTime: "16:48" },
    RACK: { date: "2026-08-28", startTime: "16:10", endTime: "16:15" },
    CAMERAS: { date: "2026-08-28", startTime: "16:20", endTime: "16:38" },
    CAIXA_FUNDO_MADEIRA: { date: "2026-08-28", startTime: "16:05", endTime: "16:09" },
    MASTRO_ANTENA: { date: "2026-08-28", startTime: "16:50", endTime: "16:55" }
  };
  assert.equal(validateWindows(photos, windows).ok, true);
  const review = buildReview(photos, windows);
  assert.equal(review.byCategory.TOMADAS.size, 9);
  assert.equal(review.byCategory.RACK.size, 6);
  assert.equal(review.byCategory.CAMERAS.size, 19);
  assert.equal(review.byCategory.CAIXA_FUNDO_MADEIRA.size, 5);
  assert.equal(review.byCategory.MASTRO_ANTENA.size, 2);
});
