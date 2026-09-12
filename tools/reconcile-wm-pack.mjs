import fs from "node:fs/promises";
import path from "node:path";
const root = process.cwd();
const dir = path.join(root, "relatorio-qualidade-obras", "offline-media", "pack-v1");
const manifestPath = path.join(dir, "catalog.json");
const known = [
  ["09-wm-piano-sonata-n-1-2-adagio-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 2. Adagio (Beethoven, Schnabel)", "Public domain"],
  ["10-wm-piano-sonata-n-1-3-menuetto-and-trio-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 3. Menuetto and Trio (Beethoven, Schnabel)", "Public domain"],
  ["11-wm-piano-sonata-n-1-4-prestissimo-beethoven-schnabel.ogg", "Piano Sonata N° 1 - 4. Prestissimo (Beethoven, Schnabel)", "Public domain"],
  ["01-wm-brahms-waltz01.ogg", "Brahms Waltz 01", "CC BY-SA 4.0"],
  ["02-wm-brahms-waltz02.ogg", "Brahms Waltz 02", "CC BY-SA 4.0"]
];
let catalog = [];
try { catalog = JSON.parse(await fs.readFile(manifestPath, "utf8")); } catch {}
for (const [fileName, title, license] of known) {
  if (catalog.some(item => item.files?.some(file => file.path.endsWith(fileName)))) continue;
  const stat = await fs.stat(path.join(dir, fileName));
  catalog.push({ id: `wm-recovered-${fileName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, title, artist: "Wikimedia Commons contributor", composer: "", genre: "classical instrumental", files: [{ path: `offline-media/pack-v1/${fileName}`, format: path.extname(fileName).slice(1), sizeBytes: stat.size }], duration: null, offlineAvailable: true, downloaded: true, storageTier: "on-demand", aliases: [title], license, sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replaceAll(" ", "_"))}`, origin: "Wikimedia Commons", legalStatus: "CLEAR", offlineStoragePermitted: true });
}
await fs.writeFile(manifestPath, JSON.stringify(catalog, null, 2) + "\n");
console.log(`RECONCILED=${catalog.length}`);
