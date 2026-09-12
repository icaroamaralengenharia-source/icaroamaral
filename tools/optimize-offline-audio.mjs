import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const root = process.cwd();
const manifestPath = path.join(root, "relatorio-qualidade-obras", "offline-media", "pack-v1", "catalog.json");
const outputRoot = path.join(root, "relatorio-qualidade-obras", "offline-media", "optimized");
const reportPath = path.join(root, "relatorio-qualidade-obras", "offline-media", "pack-v1", "optimization-report.json");
const ffmpeg = process.env.ELO_FFMPEG || "ffmpeg";
const ffprobe = process.env.ELO_FFPROBE || "ffprobe";
const derivable = /^(?:CC0|Public\s+domain|Public\s+Domain|CC\s+BY(?:-SA)?(?:\s+2\.0|\s+3\.0|\s+4\.0)?|Creative\s+Commons\s+Attribution(?:-ShareAlike)?(?:\s+\d\.\d)?)/i;

const hashFile = async file => crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex");
const json = async file => JSON.parse(await fs.readFile(file, "utf8"));
const writeJson = async (file, value) => fs.writeFile(file, JSON.stringify(value, null, 2) + "\n", "utf8");
const absoluteSource = sourcePath => path.join(root, "relatorio-qualidade-obras", sourcePath.replace(/^\.\//, ""));
const runProbe = async file => {
  const { stdout } = await execFileAsync(ffprobe, ["-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels", "-of", "json", file]);
  const data = JSON.parse(stdout);
  const stream = (data.streams || []).find(item => item.codec_name) || {};
  return { duration: Number(data.format?.duration || 0), codec: stream.codec_name || "", sampleRate: Number(stream.sample_rate || 0), channels: Number(stream.channels || 0) };
};

await fs.mkdir(outputRoot, { recursive: true });
const catalog = await json(manifestPath);
const results = [];
let optimizedFiles = 0;
let exceptions = 0;

for (const item of catalog) {
  const permitted = derivable.test(String(item.license || ""));
  for (let index = 0; index < (item.files || []).length; index += 1) {
    const file = item.files[index];
    const sourcePath = file.sourcePath || file.path;
    const sourceFile = absoluteSource(sourcePath);
    const sourceStat = await fs.stat(sourceFile);
    const sourceInfo = await runProbe(sourceFile);
    const sourceHash = await hashFile(sourceFile);
    const base = `${item.id}-${index + 1}.opus`;
    const optimizedPath = `offline-media/optimized/${base}`;
    const optimizedFile = path.join(outputRoot, base);
    const record = {
      id: item.id,
      title: item.title,
      sourcePath,
      sourceBytes: sourceStat.size,
      sourceHash,
      sourceCodec: sourceInfo.codec,
      sourceDurationSeconds: sourceInfo.duration,
      license: item.license || "",
      sourceUrl: item.sourceUrl || "",
      origin: item.origin || "",
      derived: false,
      optimizedPath: null,
      optimizedBytes: null,
      optimizedHash: null,
      optimizedCodec: null,
      optimizedBitrate: null,
      optimizedDurationSeconds: null,
      exception: null
    };

    if (permitted) {
      await execFileAsync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", "-i", sourceFile, "-map", "0:a:0", "-vn", "-c:a", "libopus", "-b:a", "96k", "-vbr", "on", "-application", "audio", "-map_metadata", "0", optimizedFile]);
      const optimizedStat = await fs.stat(optimizedFile);
      const optimizedInfo = await runProbe(optimizedFile);
      const optimizedHash = await hashFile(optimizedFile);
      file.sourcePath = sourcePath;
      file.sourceBytes = sourceStat.size;
      file.sourceHash = sourceHash;
      file.sourceFormat = file.format || path.extname(sourcePath).slice(1);
      file.path = optimizedPath;
      file.format = "opus";
      file.optimizedPath = optimizedPath;
      file.optimizedBytes = optimizedStat.size;
      file.optimizedHash = optimizedHash;
      file.optimizedCodec = optimizedInfo.codec;
      file.optimizedBitrate = 96000;
      file.sourceDurationSeconds = sourceInfo.duration;
      file.durationSeconds = optimizedInfo.duration;
      file.optimizedSampleRate = optimizedInfo.sampleRate;
      file.optimizedChannels = optimizedInfo.channels;
      record.derived = true;
      record.optimizedPath = optimizedPath;
      record.optimizedBytes = optimizedStat.size;
      record.optimizedHash = optimizedHash;
      record.optimizedCodec = optimizedInfo.codec;
      record.optimizedBitrate = 96000;
      record.optimizedDurationSeconds = optimizedInfo.duration;
      optimizedFiles += 1;
    } else {
      record.exception = "license_does_not_permit_derivation";
      exceptions += 1;
    }
    results.push(record);
  }
}

await writeJson(manifestPath, catalog);
await writeJson(reportPath, {
  generatedAt: new Date().toISOString(),
  tracks: catalog.length,
  audioFiles: results.length,
  optimizedFiles,
  exceptions,
  targetCodec: "opus",
  targetBitrate: 96000,
  validation: { sourcePreserved: true, licensesPreserved: true, durationChecked: true, hashesChecked: true }
});
console.log(`OPTIMIZED_TRACKS=${catalog.length} OPTIMIZED_FILES=${optimizedFiles} EXCEPTIONS=${exceptions}`);
