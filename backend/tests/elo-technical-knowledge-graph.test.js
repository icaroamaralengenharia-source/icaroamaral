import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
const testDir = dirname(fileURLToPath(import.meta.url)); const repoDir = join(testDir, "..", "..");
function load(){ const sandbox={console,window:{}}; sandbox.globalThis=sandbox.window; vm.createContext(sandbox); vm.runInContext(readFileSync(join(repoDir,"relatorio-qualidade-obras","elo-technical-knowledge-graph.js"),"utf8"),sandbox); return sandbox.window.EloTechnicalKnowledgeGraph; }
test("KnowledgeGraph expande telhado portugues",()=>{ const e=load(); const terms=e.expandSearchTermsFromGraph("telhado português").map(t=>t.toLowerCase()); assert.ok(terms.some(t=>t.includes("cobertura"))); assert.ok(terms.some(t=>t.includes("telha portuguesa"))); assert.ok(terms.some(t=>t.includes("ripa"))); assert.ok(terms.some(t=>t.includes("caibro"))); assert.ok(terms.some(t=>t.includes("terca")||t.includes("terça"))); });
test("KnowledgeGraph expande bloco baiano",()=>{ const e=load(); const terms=e.expandSearchTermsFromGraph("bloco baiano").map(t=>t.toLowerCase()); assert.ok(terms.some(t=>t.includes("alvenaria"))); assert.ok(terms.some(t=>t.includes("bloco cer"))); assert.ok(terms.some(t=>t.includes("argamassa"))); assert.ok(terms.some(t=>t.includes("chapisco"))); assert.ok(terms.some(t=>t.includes("reboco"))); });
