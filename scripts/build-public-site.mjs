import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outputDir = path.join(repoRoot, "public-site");

const rootFiles = [
  "index.html",
  "elo.html",
  "elo-projeto.html",
  "sobreoelo.html",
  "stockfull.html",
  "stock-full.html",
  "stock-full-app.html",
  "stock-ai.html",
  "stock-ai-obras.html",
  "stock-full-saude.html",
  "stock-saude.html",
  "stock-saude-app.html",
  "saude.html",
  "cadista-login.html",
  "elo.css",
  "saude.css",
  "sobreoelo.css",
  "stock-ai.css",
  "stock-full-app.css",
  "stock-full-saude.css",
  "stock-saude.css",
  "saude.js",
  "stock-ai-obras-bridge.js",
  "stock-full-app.js",
  "stock-full-core.js",
  "stock-full-products.js",
  "stock-full-stock.js",
  "stock-full-dashboard.js",
  "stock-full-reports.js",
  "stock-full-sync.js",
  "stock-full-saude.js",
  "stock-saude.js",
  "relatorio-config.js",
  "plans.js",
  "usage-limits.js",
  "billing-demo.js",
  "CNAME"
];

const optionalPaths = ["imagens", "imagens2", "projeto3.jpeg"];
const copiedFiles = [];
const warnings = [];
const errors = [];

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function isExcluded(relativePath, directoryEntry) {
  const normalized = toPosix(relativePath);
  const baseName = path.basename(relativePath);
  const lower = normalized.toLowerCase();
  const lowerBase = baseName.toLowerCase();

  if (!normalized) return false;
  if (lower === ".git" || lower.startsWith(".git/")) return true;
  if (lower === "backend" || lower.startsWith("backend/")) return true;
  if (lower === "node_modules" || lower.startsWith("node_modules/")) return true;
  if (lower === "tests" || lower.startsWith("tests/")) return true;
  if (lower === "e2e" || lower.startsWith("e2e/")) return true;
  if (lower === "test-results" || lower.startsWith("test-results/")) return true;
  if (lower === "tmp" || lower.startsWith("tmp/")) return true;
  if (lower === "backend/test-results" || lower.startsWith("backend/test-results/")) return true;
  if (lower.startsWith("backup-elo-")) return true;
  if (lowerBase.startsWith(".env")) return true;
  if (lowerBase.endsWith(".zip")) return true;
  if (lowerBase.includes(".bak")) return true;
  if (lowerBase.endsWith(".log")) return true;
  if (lowerBase.endsWith(".map")) return true;
  if (lowerBase.startsWith("test")) return true;
  if (lowerBase.startsWith("tmp")) return true;
  if (lowerBase.startsWith("backup")) return true;
  return Boolean(directoryEntry && directoryEntry.isDirectory() && lowerBase === "node_modules");
}

async function exists(sourcePath) {
  try {
    await fs.access(sourcePath);
    return true;
  } catch {
    return false;
  }
}

async function copyFile(relativePath) {
  if (isExcluded(relativePath)) {
    warnings.push(`Ignorado por regra de exclusao: ${relativePath}`);
    return;
  }

  const source = path.join(repoRoot, relativePath);
  const target = path.join(outputDir, relativePath);

  if (!(await exists(source))) {
    warnings.push(`Arquivo opcional ausente: ${relativePath}`);
    return;
  }

  const stat = await fs.stat(source);
  if (!stat.isFile()) {
    warnings.push(`Nao e arquivo: ${relativePath}`);
    return;
  }

  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
  copiedFiles.push({
    source: toPosix(relativePath),
    target: toPosix(path.relative(outputDir, target)),
    bytes: stat.size
  });
}

async function copyDirectory(relativeDir) {
  const sourceDir = path.join(repoRoot, relativeDir);
  if (!(await exists(sourceDir))) {
    warnings.push(`Pasta opcional ausente: ${relativeDir}`);
    return;
  }

  async function walk(currentSource) {
    const entries = await fs.readdir(currentSource, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(currentSource, entry.name);
      const relativePath = path.relative(repoRoot, sourcePath);
      if (isExcluded(relativePath, entry)) continue;

      if (entry.isDirectory()) {
        await walk(sourcePath);
      } else if (entry.isFile()) {
        await copyFile(relativePath);
      }
    }
  }

  await walk(sourceDir);
}

function stripReference(value) {
  return String(value || "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .split("#")[0]
    .split("?")[0]
    .trim();
}

function shouldIgnoreReference(value) {
  const raw = String(value || "").trim();
  const stripped = stripReference(raw);
  if (!raw || raw.startsWith("#")) return true;
  if (!stripped) return true;
  if (/^(https?:)?\/\//i.test(raw)) return true;
  if (/^(data:|mailto:|tel:|javascript:)/i.test(raw)) return true;
  if (stripped.startsWith("/api/")) return true;
  return false;
}

async function outputPathExists(reference, fromFile) {
  const cleanReference = stripReference(reference);
  if (!cleanReference) return true;

  const resolved = cleanReference.startsWith("/")
    ? path.join(outputDir, cleanReference)
    : path.resolve(path.dirname(fromFile), cleanReference);

  const normalizedOutput = path.resolve(outputDir);
  const normalizedTarget = path.resolve(resolved);
  if (!normalizedTarget.startsWith(normalizedOutput)) return false;

  if (await exists(normalizedTarget)) {
    const stat = await fs.stat(normalizedTarget);
    if (stat.isDirectory()) return exists(path.join(normalizedTarget, "index.html"));
    return true;
  }

  return exists(path.join(normalizedTarget, "index.html"));
}

async function validateReferences() {
  const filesToCheck = copiedFiles
    .map((file) => path.join(outputDir, file.target))
    .filter((file) => /\.(html|css)$/i.test(file));
  const referencePattern = /(?:src|href)\s*=\s*["']([^"']+)["']|url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  for (const filePath of filesToCheck) {
    const content = await fs.readFile(filePath, "utf8");
    for (const match of content.matchAll(referencePattern)) {
      const reference = match[1] || match[2] || "";
      if (shouldIgnoreReference(reference)) continue;
      if (!(await outputPathExists(reference, filePath))) {
        errors.push(`Asset ausente em ${toPosix(path.relative(outputDir, filePath))}: ${reference}`);
      }
    }
  }
}

async function writeManifest() {
  const manifestFiles = copiedFiles.slice().sort((a, b) => a.target.localeCompare(b.target));
  const manifest = {
    generatedAt: new Date().toISOString(),
    totalFiles: manifestFiles.length,
    totalBytes: manifestFiles.reduce((sum, file) => sum + file.bytes, 0),
    files: manifestFiles
  };
  const target = path.join(outputDir, "public-site-manifest.json");
  await fs.writeFile(target, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  const stat = await fs.stat(target);
  copiedFiles.push({ source: "generated", target: "public-site-manifest.json", bytes: stat.size });
  return manifest;
}

async function main() {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  for (const file of rootFiles) await copyFile(file);
  await copyDirectory("cadista");
  await copyDirectory("relatorio-qualidade-obras");

  for (const optionalPath of optionalPaths) {
    const source = path.join(repoRoot, optionalPath);
    if (!(await exists(source))) continue;
    const stat = await fs.stat(source);
    if (stat.isDirectory()) await copyDirectory(optionalPath);
    else if (stat.isFile()) await copyFile(optionalPath);
  }

  await validateReferences();
  const manifest = await writeManifest();
  const totalFiles = copiedFiles.length;
  const totalBytes = copiedFiles.reduce((sum, file) => sum + file.bytes, 0);

  console.log(`public-site gerado em: ${outputDir}`);
  console.log(`Arquivos copiados: ${totalFiles}`);
  console.log(`Tamanho total: ${totalBytes} bytes`);
  console.log(`Manifesto base: ${manifest.totalFiles} arquivos antes do manifesto`);

  if (warnings.length) {
    console.warn("\nAvisos:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (errors.length) {
    console.error("\nErros:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nValidacao de assets locais: OK");
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});