import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const manifestPath = path.join(root, "relatorio-qualidade-obras", "offline-media", "pack-v1", "catalog.json");
const reportPath = path.join(root, "relatorio-qualidade-obras", "offline-media", "pack-v1", "optimization-audit.json");
const ffprobe = process.env.ELO_FFPROBE || "ffprobe";
const hash = async file => crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
const abs = value => path.join(root, "relatorio-qualidade-obras", value.replace(/^\.\//, ""));
const probe = async file => {
  const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_name", "-of", "json", file]);
  const data = JSON.parse(stdout);
  return { duration: Number(data.format?.duration || 0), codec: (data.streams || []).find(item => item.codec_name)?.codec_name || "" };
};

const catalog = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const files = [];
for (const item of catalog) {
  for (const file of item.files || []) {
    const sourceFile = abs(file.sourcePath || file.path);
    const optimizedFile = abs(file.optimizedPath || file.path);
    const sourceStat = await fs.stat(sourceFile);
    const optimizedStat = await fs.stat(optimizedFile);
    const sourceProbe = await probe(sourceFile);
    const optimizedProbe = await probe(optimizedFile);
    const sourceHash = await hash(sourceFile);
    const optimizedHash = await hash(optimizedFile);
    const durationDelta = Math.abs(sourceProbe.duration - optimizedProbe.duration);
    files.push({
      id: item.id,
      title: item.title,
      sourceExists: sourceStat.size > 0,
      optimizedExists: optimizedStat.size > 0,
      sourceHashMatches: sourceHash === file.sourceHash,
      optimizedHashMatches: optimizedHash === file.optimizedHash,
      codec: optimizedProbe.codec,
      durationDeltaSeconds: durationDelta,
      durationCompatible: durationDelta <= 2,
      optimizedBytes: optimizedStat.size
    });
  }
}
const passed = files.filter(file => file.sourceExists && file.optimizedExists && file.sourceHashMatches && file.optimizedHashMatches && file.codec === "opus" && file.durationCompatible).length;
const report = { generatedAt: new Date().toISOString(), tracks: catalog.length, audioFiles: files.length, validFiles: passed, validTracks: new Set(files.filter(file => file.sourceExists && file.optimizedExists && file.sourceHashMatches && file.optimizedHashMatches && file.codec === "opus" && file.durationCompatible).map(file => file.id)).size, externalRequests: 0, files };
await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(`AUDIT_TRACKS=${report.validTracks}/${report.tracks} AUDIT_FILES=${report.validFiles}/${report.audioFiles} EXTERNAL_REQUESTS=0`);
if (report.validTracks !== report.tracks || report.validFiles !== report.audioFiles) process.exitCode = 1;
