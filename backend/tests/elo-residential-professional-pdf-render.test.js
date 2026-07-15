import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); }
  };
}

function createElement(tag) {
  return {
    tagName: String(tag || "").toUpperCase(),
    dataset: {},
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    getAttribute() { return ""; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    textContent: "",
    value: "",
    options: [],
    selectedIndex: -1
  };
}

function loadAssistant() {
  const sandbox = {
    console,
    Date,
    Math,
    setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
    clearTimeout() {},
    Blob: function Blob() {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
    URLSearchParams,
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      ELO_DISABLE_AUTOFOCUS: true,
      ELO_PRODUCT_MODE: true,
      localStorage: createStorage(),
      sessionStorage: createStorage(),
      location: { hostname: "localhost", protocol: "http:", pathname: "/relatorio-qualidade-obras.html", hash: "" },
      addEventListener() {},
      removeEventListener() {},
      crypto: { randomUUID: () => "pdf-test-id" },
      open() { return { document: { open() {}, write() {}, close() {} }, focus() {} }; },
      setTimeout(fn) { if (typeof fn === "function") fn(); return 0; },
      clearTimeout() {}
    },
    document: {
      readyState: "complete",
      body: createElement("body"),
      createElement,
      addEventListener() {},
      querySelector() { return null; },
      querySelectorAll() { return []; },
      getElementById() { return null; }
    },
    navigator: { userAgent: "node-test" }
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.document = sandbox.document;
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return sandbox.window.EloAssistente;
}

function sampleBudgetDocument() {
  return {
    budgetId: "ELO-RES-PDF-073CDDD",
    facts: { cliente: "Cliente Valida\u00e7\u00e3o", area: "24 m2", cidade: "Salvador", uf: "BA", obra: "Resid\u00eancia compacta" },
    assumptions: ["Caso reduzido com tr\u00eas itens execut\u00e1veis."],
    pendingFields: [],
    scope: ["Limpeza final", "Pintura interna", "Piso cer\u00e2mico"],
    compositions: [
      { code: "SINAPI-FIX-LIMP-001", description: "Limpeza final", unit: "m2", source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" },
      { code: "SINAPI-FIX-PINT-001", description: "Pintura interna", unit: "m2", source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" },
      { code: "SINAPI-FIX-PISO-001", description: "Piso cer\u00e2mico", unit: "m2", source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" }
    ],
    budget: {
      source: "Fixture SINAPI Valida\u00e7\u00e3o PDF",
      officialSource: true,
      referenceMonth: "2026-06",
      subtotal: 4346.52,
      bdiPercent: "12%",
      bdiValue: 521.58,
      total: 4868.10,
      rows: [
        { code: "SINAPI-FIX-LIMP-001", description: "Limpeza final", unit: "m2", quantity: 24, unitPrice: 9.75, total: 234.00, source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" },
        { code: "SINAPI-FIX-PINT-001", description: "Pintura interna", unit: "m2", quantity: 92.4, unitPrice: 22.30, total: 2060.52, source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" },
        { code: "SINAPI-FIX-PISO-001", description: "Piso cer\u00e2mico", unit: "m2", quantity: 24, unitPrice: 85.50, total: 2052.00, source: "Fixture SINAPI Valida\u00e7\u00e3o PDF" }
      ]
    },
    risks: ["Pre\u00e7o de teste, n\u00e3o v\u00e1lido para contrata\u00e7\u00e3o."],
    nextSteps: ["Revis\u00e3o t\u00e9cnica antes de emiss\u00e3o ao cliente."]
  };
}

test("PDF residencial profissional renderiza planilha vertical e oculta campos internos", () => {
  const assistant = loadAssistant();
  const record = assistant.buildBudgetV2ProfessionalPdfDataForTest(sampleBudgetDocument());
  Object.assign(record, {
    cliente: "Cliente Valida\u00e7\u00e3o",
    obra: "Resid\u00eancia compacta",
    cidade: "Salvador",
    uf: "BA",
    numero: "ELO-RES-PDF-073CDDD",
    versao: "2",
    data_atualizacao: "2026-07-13T12:00:00.000Z"
  });

  const html = assistant.buildProfessionalPdfDocumentForTest(record, { nomeDocumento: "Or\u00e7amento Residencial" });

  assert.ok(html.includes("elo-budget-document"));
  assert.match(html, /<table class="elo-budget-table">/);
  assert.match(html, /P\u00e1gina 1 de 2/);
  assert.match(html, /P\u00e1gina 2 de 2/);
  assert.doesNotMatch(html, /P\u00e1gina 0|P\u00e1gina 3|P\u00e1gina 4/);

  const budgetTable = html.match(/<table class="elo-budget-table">[\s\S]*?<\/table>/)[0];
  const rows = budgetTable.match(/<tr>[\s\S]*?<\/tr>/g) || [];
  const budgetRows = rows.filter((row) => /SINAPI-FIX-(?:LIMP|PINT|PISO)-001/.test(row));
  assert.equal(budgetRows.length, 3);
  assert.ok(budgetRows[0].includes("Limpeza final da \u00e1rea constru\u00edda"));
  assert.ok(budgetRows[1].includes("Prepara\u00e7\u00e3o de superf\u00edcie"));
  assert.ok(budgetRows[2].includes("Fornecimento e assentamento"));
  assert.ok(budgetRows.every((row) => row.includes("m\u00b2")));
  assert.ok(budgetRows.some((row) => /24,00/.test(row) && /R\$ 9,75/.test(row) && /R\$ 234,00/.test(row)));
  assert.ok(budgetRows.some((row) => /92,40/.test(row) && /R\$ 22,30/.test(row) && /R\$ 2\.060,52/.test(row)));
  assert.ok(budgetRows.some((row) => /24,00/.test(row) && /R\$ 85,50/.test(row) && /R\$ 2\.052,00/.test(row)));

  assert.match(html, /Subtotal[\s\S]*R\$ 4\.346,52/);
  assert.equal((html.match(/BDI/g) || []).length, 1);
  assert.ok(html.includes("Total do or\u00e7amento") && html.includes("R$ 4.868,10"));
  assert.ok(html.includes("Composi\u00e7\u00f5es adotadas"));
  assert.ok(html.includes("Fixture SINAPI Valida\u00e7\u00e3o PDF"));
  ["Or\u00e7amento", "Composi\u00e7\u00f5es", "cer\u00e2mico", "\u00e1rea", "execu\u00e7\u00e3o", "Revis\u00e3o"].forEach((word) => assert.ok(html.toLowerCase().includes(word.toLowerCase()), word));

  assert.doesNotMatch(html, /source:|officialSource:|referenceMonth:|planilha:|fixture executivo/i);
  assert.doesNotMatch(html, /undefined|null|\{&quot;|\{"|\[object Object\]/i);
  assert.doesNotMatch(html, /Conteudo tecnico consolidado|Conte\u00fado t\u00e9cnico consolidado/i);
});
