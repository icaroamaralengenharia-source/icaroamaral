import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const projectRoot = process.cwd();
const assetsRoot = path.resolve(projectRoot, "app/src/main/assets");
const catalogPath = path.join(assetsRoot, "offline-media/catalog.json");
const optimizedRoot = path.join(assetsRoot, "offline-media/optimized");
const hashManifestPath = path.resolve(projectRoot, "scripts/music-assets.sha256");

const catalogJson = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const tracks = Array.isArray(catalogJson) ? catalogJson : catalogJson.tracks;
if (!Array.isArray(tracks)) throw new Error("Catalog must contain a tracks array");

const catalogPaths = new Set(
  tracks.flatMap((track) => (track.files ?? []).map((file) => file.path)),
);
const physicalFiles = fs.readdirSync(optimizedRoot)
  .filter((name) => name.toLowerCase().endsWith(".opus"))
  .map((name) => `offline-media/optimized/${name}`)
  .sort();
const missing = [...catalogPaths].filter((file) => !fs.existsSync(path.join(assetsRoot, file))).sort();
const extra = physicalFiles.filter((file) => !catalogPaths.has(file)).sort();

const expectedHashes = new Map(
  fs.readFileSync(hashManifestPath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [file, hash] = line.trim().split(/\s+/);
      return [file, hash];
    }),
);
const hashMismatches = [];
for (const [file, expected] of expectedHashes) {
  const actual = fs.existsSync(path.join(assetsRoot, file))
    ? crypto.createHash("sha256").update(fs.readFileSync(path.join(assetsRoot, file))).digest("hex")
    : "MISSING";
  if (actual !== expected) hashMismatches.push(`${file}: expected ${expected}, got ${actual}`);
}

const result = {
  catalogTracks: tracks.length,
  expectedAudioFiles: 52,
  audioFilesPresent: physicalFiles.length,
  missing,
  extra,
  hashMismatches,
};
console.log(`CATALOG TRACKS = ${result.catalogTracks}`);
console.log(`EXPECTED AUDIO FILES = ${result.expectedAudioFiles}`);
console.log(`AUDIO FILES PRESENT = ${result.audioFilesPresent}`);
console.log(`MISSING = ${missing.length}`);
console.log(`EXTRA = ${extra.length}`);
console.log(`HASH MISMATCH = ${hashMismatches.length}`);

if (result.catalogTracks !== 50 || physicalFiles.length !== 52 || missing.length || extra.length || hashMismatches.length || expectedHashes.size !== 52) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
