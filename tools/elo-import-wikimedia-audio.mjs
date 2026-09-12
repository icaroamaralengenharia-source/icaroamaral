import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "relatorio-qualidade-obras", "offline-media", "pack-v1");
const MANIFEST = path.join(OUT_DIR, "catalog.json");
const API = "https://commons.wikimedia.org/w/api.php";
const LIMIT = 50;
const AUDIO_EXTENSIONS = /\.(ogg|oga|mp3|wav|flac|opus)$/i;
const ALLOWED_LICENSES = /^(CC0|Public domain|Public Domain|CC BY|CC BY-SA|CC BY 4\.0|CC BY-SA 4\.0)/i;
const CATEGORY_TERMS = /(classical|piano|sonata|symphon|concerto|quartet|waltz|nocturne|prelude|fugue|baroque|orchestra|opera|music|musical|brandenburg|beethoven|bach|mozart|chopin|vivaldi|debussy|handel|haydn|schubert|brahms|tchaikovsky|jazz|acoustic|ambient)/i;
const PRIORITY_CATEGORIES = [
  "Audio files of Beethoven's Piano Sonatas Played by Artur Schnabel",
  "Audio files of 16 Waltzes (Brahms)",
  "Audio files of Brandenburg Concertos",
  "Audio files of Baroque period classical music",
  "Audio files of 20th-century period classical music"
];

const clean = value => String(value ?? "").replace(/[\u0000-\u001f<>]/g, "").trim();
const slug = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function api(params) {
  const url = API + "?" + new URLSearchParams({ ...params, format: "json" });
  const response = await fetch(url, { headers: { "User-Agent": "ELO-Offline-Music-Importer/1.0 contact-local" } });
  if (!response.ok) throw new Error(`Wikimedia HTTP ${response.status}`);
  return response.json();
}

function metaValue(meta, key) {
  const value = meta?.[key];
  return clean(value && typeof value === "object" ? value.value : value);
}

async function categoryNames() {
  const names = [];
  let accontinue = "";
  do {
    const data = await api({ action: "query", list: "allcategories", acprefix: "Audio files of ", aclimit: "500", ...(accontinue ? { accontinue } : {}) });
    names.push(...(data.query?.allcategories || []).map(item => item["*"]).filter(name => CATEGORY_TERMS.test(name)));
    accontinue = data.continue?.accontinue || "";
  } while (accontinue && names.length < 250);
  return [...new Set([...PRIORITY_CATEGORIES, ...names])].slice(0, 250);
}

async function categoryFiles(category) {
  const files = [];
  let cmcontinue = "";
  do {
    const data = await api({ action: "query", list: "categorymembers", cmtitle: `Category:${category}`, cmtype: "file", cmlimit: "500", ...(cmcontinue ? { cmcontinue } : {}) });
    files.push(...(data.query?.categorymembers || []).map(item => item.title).filter(title => AUDIO_EXTENSIONS.test(title)));
    cmcontinue = data.continue?.cmcontinue || "";
  } while (cmcontinue && files.length < 250);
  return files;
}

async function imageInfo(titles) {
  const data = await api({ action: "query", prop: "imageinfo", titles: titles.join("|"), iiprop: "url|size|mime|extmetadata", iiurlwidth: "1" });
  return Object.values(data.query?.pages || {}).map(page => {
    const info = page.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const license = metaValue(meta, "LicenseShortName") || metaValue(meta, "License") || "";
    return { title: page.title, url: info?.url, size: Number(info?.size || 0), mime: info?.mime || "", license, artist: metaValue(meta, "Artist"), credit: metaValue(meta, "Credit"), description: metaValue(meta, "ImageDescription"), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}` };
  });
}

async function download(candidate, destination) {
  let response;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    response = await fetch(candidate.url, { headers: { "User-Agent": "ELO-Offline-Music-Importer/1.0 contact-local", Accept: "audio/ogg,audio/mpeg,audio/*;q=0.9,*/*;q=0.1" } });
    if (response.ok) break;
    if (response.status !== 429 || attempt === 6) throw new Error(`asset HTTP ${response.status}`);
    await sleep(5000 * attempt);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length < 4096) throw new Error("asset_too_small");
  await fs.writeFile(destination, buffer);
  const digest = crypto.createHash("sha256").update(buffer).digest("hex");
  return { bytes: buffer.length, sha256: digest };
}

await fs.mkdir(OUT_DIR, { recursive: true });
let existing = [];
try { existing.push(...JSON.parse(await fs.readFile(MANIFEST, "utf8"))); } catch {}
try { existing.push(...JSON.parse(await fs.readFile(path.join(ROOT, "relatorio-qualidade-obras", "offline-media", "classical", "library.json"), "utf8"))); } catch {}
existing = [...new Map(existing.map(item => [item.id, item])).values()];
const existingByUrl = new Map(existing.map(item => [item.sourceUrl, item]));
const rejected = [];
const candidates = [];
const categories = await categoryNames();
for (const category of categories) {
  try {
    const files = await categoryFiles(category);
    if (!files.length) continue;
    for (let i = 0; i < files.length; i += 50) {
      const infos = await imageInfo(files.slice(i, i + 50));
      for (const info of infos) {
        if (!info.url || !AUDIO_EXTENSIONS.test(info.title)) { rejected.push({ title: info.title, reason: "unsupported_audio" }); continue; }
        if (!ALLOWED_LICENSES.test(info.license)) { rejected.push({ title: info.title, reason: `license_not_allowed:${info.license || "missing"}` }); continue; }
        if (info.size > 50 * 1024 * 1024 || info.size < 4096) { rejected.push({ title: info.title, reason: "size_out_of_bounds" }); continue; }
        if (existingByUrl.has(info.sourceUrl) || candidates.some(item => item.sourceUrl === info.sourceUrl)) continue;
        candidates.push({ ...info, category });
      }
      if (candidates.length >= LIMIT * 4) break;
      await sleep(100);
    }
  } catch (error) {
    rejected.push({ category, reason: clean(error.message) || "category_failed" });
  }
  if (existing.length + candidates.length >= LIMIT) break;
}

const imported = [...existing];
const usedIds = new Set(imported.map(item => item.id));
for (const candidate of candidates) {
  if (imported.length >= LIMIT) break;
  const base = slug(candidate.title.replace(/^File:/i, "").replace(AUDIO_EXTENSIONS, "")) || `track-${imported.length + 1}`;
  let id = `wm-${base}`; let suffix = 2;
  while (usedIds.has(id)) id = `wm-${base}-${suffix++}`;
  const extension = path.extname(candidate.url.split("?")[0]).toLowerCase() || ".ogg";
  const fileName = `${String(imported.length + 1).padStart(2, "0")}-${id}${extension}`;
  const destination = path.join(OUT_DIR, fileName);
  try {
    await sleep(1800);
    const downloaded = await download(candidate, destination);
    const title = clean(candidate.title.replace(/^File:/i, "").replace(AUDIO_EXTENSIONS, ""));
    imported.push({ id, title, artist: candidate.artist || "Wikimedia Commons contributor", composer: candidate.artist || "", genre: "instrumental / classical", files: [{ path: `offline-media/pack-v1/${fileName}`, format: extension.slice(1), sizeBytes: downloaded.bytes, sha256: downloaded.sha256 }], duration: null, offlineAvailable: true, downloaded: true, storageTier: imported.length < 10 ? "essential" : "on-demand", aliases: [title, candidate.category.replace(/^Audio files of /i, "")], license: candidate.license, sourceUrl: candidate.sourceUrl, origin: "Wikimedia Commons", legalStatus: "CLEAR", offlineStoragePermitted: true });
    usedIds.add(id);
    console.log(`IMPORTED ${imported.length}/${LIMIT} ${title}`);
  } catch (error) {
    rejected.push({ title: candidate.title, reason: clean(error.message) || "download_failed" });
    try { await fs.rm(destination, { force: true }); } catch {}
  }
}

await fs.writeFile(MANIFEST, JSON.stringify(imported, null, 2) + "\n", "utf8");
await fs.writeFile(path.join(OUT_DIR, "import-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), target: LIMIT, imported: imported.length, rejected, categoriesScanned: categories.length }, null, 2) + "\n", "utf8");
if (imported.length < LIMIT) { console.error(`FULL_50_FAIL imported=${imported.length} rejected=${rejected.length}`); process.exitCode = 2; } else console.log(`FULL_50_PASS imported=${imported.length} rejected=${rejected.length}`);
