import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "relatorio-qualidade-obras", "offline-media", "pack-v1");
const MANIFEST = path.join(OUT, "catalog.json");
const CHECKPOINT = path.join(OUT, "import-checkpoint.json");
const CACHE = path.join(OUT, "metadata-cache.json");
const DISCOVERY = path.join(OUT, "discovery-candidates.json");
const API = "https://commons.wikimedia.org/w/api.php";
const TARGET = 50;
const DEPTH = 1;
const AUDIO = /\.(ogg|oga|mp3|wav|flac|opus)$/i;
const LICENSE = /^(CC0|Public domain|Public Domain|CC BY(?:-SA)?(?: 2\.0| 3\.0| 4\.0)?|CC BY-SA(?: 2\.0| 3\.0| 4\.0)?)/i;
const CATEGORIES = ["Audio files of Beethoven's Piano Sonatas Played by Artur Schnabel", "Audio files of 16 Waltzes (Brahms)", "Audio files of Brandenburg Concertos", "Audio files of Baroque period classical music", "Audio files of 20th-century period classical music"];
const clean = value => String(value ?? "").replace(/[\u0000-\u001f<>]/g, "").trim();
const slug = value => clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);
let lastRequest = 0;
let temporary429 = [];

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return fallback; } }
async function writeJson(file, data) { await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8"); }
async function gate() { const wait = 1500 - (Date.now() - lastRequest); if (wait > 0) await sleep(wait); lastRequest = Date.now(); }
function retryAfter(headers) { const match = headers.match(/^retry-after:\s*(\d+)/im); return match ? Number(match[1]) * 1000 : 0; }

async function curl(url, output = null) {
  const token = `elo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const headersFile = path.join(OUT, `.${token}.headers`);
  const bodyFile = output || path.join(OUT, `.${token}.body`);
  await gate();
  try {
    const result = await execFileAsync("curl.exe", ["-L", "--silent", "--show-error", "--max-time", "90", "-A", "ELO-Offline-Music-Importer/3.0", "-D", headersFile, "-o", bodyFile, "-w", "%{http_code}", url], { maxBuffer: 1024 * 1024 });
    return { status: Number(String(result.stdout).trim().slice(-3)), headers: await fs.readFile(headersFile, "utf8").catch(() => ""), bodyFile };
  } catch (error) {
    return { status: Number(clean(error.stdout).slice(-3)) || 0, headers: await fs.readFile(headersFile, "utf8").catch(() => ""), bodyFile, error: clean(error.stderr || error.message) };
  } finally { await fs.rm(headersFile, { force: true }).catch(() => {}); }
}

async function api(params) {
  const url = API + "?" + new URLSearchParams({ ...params, format: "json" });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const result = await curl(url);
    if (result.status === 200) { const data = await readJson(result.bodyFile, null); await fs.rm(result.bodyFile, { force: true }); if (!data) throw new Error("invalid_api_json"); return data; }
    await fs.rm(result.bodyFile, { force: true }).catch(() => {});
    if (result.status !== 429) throw new Error(`Wikimedia HTTP ${result.status || "network"}`);
    const delay = Math.max(retryAfter(result.headers), Math.min(120000, 3000 * 2 ** attempt) + Math.floor(Math.random() * 1500));
    temporary429.push({ phase: "DISCOVERY", attempt: attempt + 1, delayMs: delay, at: new Date().toISOString() }); await sleep(delay);
  }
  throw new Error("Wikimedia HTTP 429 after backoff");
}

function metadataValue(meta, key) { const value = meta?.[key]; return clean(value && typeof value === "object" ? value.value : value); }

async function filesInCategory(category, depth = 0, seen = new Set()) {
  const full = `Category:${category}`; if (seen.has(full) || depth > DEPTH) return []; seen.add(full);
  const files = []; const subcats = []; let continuation = {};
  do {
    const data = await api({ action: "query", list: "categorymembers", cmtitle: full, cmtype: "file|subcat", cmlimit: "200", ...continuation });
    for (const item of data.query?.categorymembers || []) { if (item.ns === 6 && AUDIO.test(item.title)) files.push(item.title); if (item.ns === 14) subcats.push(item.title.replace(/^Category:/, "")); }
    continuation = data.continue ? { cmcontinue: data.continue.cmcontinue, continue: data.continue.continue } : null;
  } while (continuation);
  for (const subcat of subcats) files.push(...await filesInCategory(subcat, depth + 1, seen));
  return [...new Set(files)];
}

async function getMetadata(titles, cache) {
  const fresh = titles.filter(title => !cache[title]);
  for (let i = 0; i < fresh.length; i += 50) {
    const data = await api({ action: "query", prop: "imageinfo", titles: fresh.slice(i, i + 50).join("|"), iiprop: "url|size|mime|extmetadata", iiurlwidth: "1" });
    for (const page of Object.values(data.query?.pages || {})) { const info = page.imageinfo?.[0]; const meta = info?.extmetadata || {}; cache[page.title] = { title: page.title, url: info?.url, size: Number(info?.size || 0), mime: info?.mime || "", license: metadataValue(meta, "LicenseShortName") || metadataValue(meta, "License") || "", artist: metadataValue(meta, "Artist"), description: metadataValue(meta, "ImageDescription"), sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replaceAll(" ", "_"))}` }; }
    await writeJson(CACHE, cache);
  }
  return titles.map(title => cache[title]).filter(Boolean);
}

async function download(candidate, destination) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = await curl(candidate.url, destination);
    if (result.status === 200) { const buffer = await fs.readFile(destination); if (buffer.length < 4096) throw new Error("asset_too_small"); return { bytes: buffer.length, sha256: crypto.createHash("sha256").update(buffer).digest("hex") }; }
    await fs.rm(destination, { force: true }).catch(() => {});
    if (result.status !== 429) throw new Error(`asset HTTP ${result.status || "network"}`);
    const delay = Math.max(retryAfter(result.headers), Math.min(10000, 2000 * 2 ** attempt) + Math.floor(Math.random() * 1500)); temporary429.push({ phase: "DOWNLOAD", title: candidate.title, attempt: attempt + 1, delayMs: delay, at: new Date().toISOString() }); await sleep(delay);
  }
  throw new Error("asset HTTP 429 after backoff");
}

async function existingItems() {
  let items = [...await readJson(MANIFEST, []), ...await readJson(path.join(ROOT, "relatorio-qualidade-obras", "offline-media", "classical", "library.json"), [])];
  const recovered = [["09-wm-piano-sonata-n-1-2-adagio-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 2. Adagio (Beethoven, Schnabel)", "Public domain"], ["10-wm-piano-sonata-n-1-3-menuetto-and-trio-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 3. Menuetto and Trio (Beethoven, Schnabel)", "Public domain"], ["11-wm-piano-sonata-n-1-4-prestissimo-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 4. Prestissimo (Beethoven, Schnabel)", "Public domain"], ["01-wm-brahms-waltz01.ogg", "Brahms Waltz 01", "CC BY-SA 4.0"], ["02-wm-brahms-waltz02.ogg", "Brahms Waltz 02", "CC BY-SA 4.0"]];
  for (const [fileName, title, license] of recovered) { if (items.some(item => item.files?.some(file => file.path.endsWith(fileName)))) continue; try { const stat = await fs.stat(path.join(OUT, fileName)); items.push({ id: `wm-recovered-${slug(title)}`, title, artist: "Wikimedia Commons contributor", composer: "", genre: "classical instrumental", files: [{ path: `offline-media/pack-v1/${fileName}`, format: path.extname(fileName).slice(1), sizeBytes: stat.size }], duration: null, offlineAvailable: true, downloaded: true, storageTier: "on-demand", aliases: [title], license, sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replaceAll(" ", "_"))}`, origin: "Wikimedia Commons", legalStatus: "CLEAR", offlineStoragePermitted: true }); } catch {} }
  return [...new Map(items.map(item => [item.id, item])).values()];
}

await fs.mkdir(OUT, { recursive: true });
const checkpoint = await readJson(CHECKPOINT, { phase: "DISCOVERY", categories: [], discovered: [], downloaded: [], permanentRejects: [], temporary429: [], candidatesAnalyzed: 0 });
temporary429 = checkpoint.temporary429 || [];
const cache = await readJson(CACHE, {});
const existing = await existingItems();
const existingSources = new Set(existing.map(item => item.sourceUrl).filter(Boolean));
const discovered = await readJson(DISCOVERY, checkpoint.discovered || []);
const permanentRejects = checkpoint.permanentRejects || [];
const seen = new Set([...discovered.map(item => item.title), ...permanentRejects.map(item => item.title)]);

if (discovered.length < TARGET * 3) {
  checkpoint.phase = "DISCOVERY";
  for (const category of CATEGORIES) {
    if (checkpoint.categories.includes(category)) continue;
    let titles = []; try { titles = await filesInCategory(category); } catch (error) { checkpoint.temporary429.push({ phase: "DISCOVERY", category, reason: clean(error.message), at: new Date().toISOString() }); continue; }
    const infos = await getMetadata(titles.filter(title => !seen.has(title)), cache); checkpoint.candidatesAnalyzed += infos.length;
    for (const info of infos) { seen.add(info.title); if (!info.url || !AUDIO.test(info.title)) { permanentRejects.push({ title: info.title, reason: "unsupported_audio" }); continue; } if (!LICENSE.test(info.license)) { permanentRejects.push({ title: info.title, reason: `license_not_allowed:${info.license || "missing"}` }); continue; } if (info.size > 50 * 1024 * 1024 || info.size < 4096) { permanentRejects.push({ title: info.title, reason: "size_out_of_bounds" }); continue; } if (!existingSources.has(info.sourceUrl)) discovered.push({ ...info, category }); }
    checkpoint.categories.push(category); checkpoint.discovered = discovered; checkpoint.permanentRejects = permanentRejects; checkpoint.temporary429 = temporary429; await writeJson(DISCOVERY, discovered); await writeJson(CHECKPOINT, checkpoint); if (discovered.length >= TARGET * 3) break;
  }
}

checkpoint.phase = "DOWNLOAD"; const imported = [...existing]; const ids = new Set(imported.map(item => item.id)); const done = new Set(imported.map(item => item.sourceUrl).filter(Boolean));
for (const candidate of discovered) {
  if (imported.length >= TARGET || done.has(candidate.sourceUrl)) continue;
  const base = slug(candidate.title.replace(/^File:/i, "").replace(AUDIO, "")) || `track-${imported.length + 1}`; let id = `wm-${base}`; let suffix = 2; while (ids.has(id)) id = `wm-${base}-${suffix++}`;
  const ext = path.extname(candidate.url.split("?")[0]).toLowerCase() || ".ogg"; const fileName = `${String(imported.length + 1).padStart(2, "0")}-${id}${ext}`; const destination = path.join(OUT, fileName);
  try { const result = await download(candidate, destination); const title = clean(candidate.title.replace(/^File:/i, "").replace(AUDIO, "")); imported.push({ id, title, artist: candidate.artist || "Wikimedia Commons contributor", composer: candidate.artist || "", genre: "instrumental / classical", files: [{ path: `offline-media/pack-v1/${fileName}`, format: ext.slice(1), sizeBytes: result.bytes, sha256: result.sha256 }], duration: null, offlineAvailable: true, downloaded: true, storageTier: imported.length < 10 ? "essential" : "on-demand", aliases: [title, candidate.category?.replace(/^Audio files of /i, "") || ""].filter(Boolean), license: candidate.license, sourceUrl: candidate.sourceUrl, origin: "Wikimedia Commons", legalStatus: "CLEAR", offlineStoragePermitted: true }); ids.add(id); done.add(candidate.sourceUrl); checkpoint.downloaded = [...done]; checkpoint.temporary429 = temporary429; await writeJson(MANIFEST, imported); await writeJson(CHECKPOINT, checkpoint); console.log(`IMPORTED ${imported.length}/${TARGET} ${title}`); } catch (error) { if (!/429/.test(error.message)) permanentRejects.push({ title: candidate.title, reason: clean(error.message) || "download_failed" }); checkpoint.permanentRejects = permanentRejects; checkpoint.temporary429 = temporary429; await writeJson(CHECKPOINT, checkpoint); }
}

checkpoint.phase = imported.length >= TARGET ? "COMPLETE" : "WAITING_FOR_MORE_CANDIDATES"; checkpoint.discovered = discovered; checkpoint.permanentRejects = permanentRejects; checkpoint.temporary429 = temporary429; await writeJson(CHECKPOINT, checkpoint); await writeJson(MANIFEST, imported); await writeJson(path.join(OUT, "import-report.json"), { generatedAt: new Date().toISOString(), target: TARGET, imported: imported.length, candidatesAnalyzed: checkpoint.candidatesAnalyzed, permanentRejected: permanentRejects.length, temporary429: temporary429.length, rejectionCounts: permanentRejects.reduce((counts, item) => { counts[item.reason] = (counts[item.reason] || 0) + 1; return counts; }, {}), phase: checkpoint.phase, pagination: { categorymembers: true, subcategories: true, maxDepth: DEPTH, metadataBatches: true }, optimization: { ffmpeg: false, reason: "ffmpeg_not_available" } }, null, 2);
if (imported.length < TARGET) { console.error(`FULL_50_FAIL imported=${imported.length} permanent=${permanentRejects.length} temporary429=${temporary429.length}`); process.exitCode = 2; } else console.log(`FULL_50_PASS imported=${imported.length}`);
