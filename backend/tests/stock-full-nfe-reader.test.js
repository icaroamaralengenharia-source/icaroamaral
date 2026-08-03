import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(testDir, "..", "..");

function loadReader() {
  const sandbox = { console, TextEncoder, window: {} };
  sandbox.globalThis = sandbox.window;
  sandbox.window.window = sandbox.window;
  sandbox.window.TextEncoder = TextEncoder;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(rootDir, "stock-full-nfe-reader.js"), "utf8"), sandbox, { filename: "stock-full-nfe-reader.js" });
  return sandbox.window.StockFullNfeReader;
}

function validNfeXml(overrides = {}) {
  const id = overrides.id || "NFe29260612345678000199550010000012341000012345";
  const namespace = overrides.namespace || "http://www.portalfiscal.inf.br/nfe";
  const secondItem = overrides.secondItem || "";
  const cnpj = Object.hasOwn(overrides, "cnpj") ? overrides.cnpj : "<CNPJ>12345678000199</CNPJ>";
  const issuer = Object.hasOwn(overrides, "issuer") ? overrides.issuer : "<xNome>Fornecedor Teste Ltda</xNome>";
  return `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="${namespace}" versao="4.00">
  <NFe>
    <infNFe Id="${id}" versao="4.00">
      <ide>
        <cUF>29</cUF>
        <nNF>1234</nNF>
        <dhEmi>2026-08-03T10:20:30-03:00</dhEmi>
      </ide>
      <emit>
        ${cnpj}
        ${issuer}
      </emit>
      <det nItem="1">
        <prod>
          <cProd>SKU-001</cProd>
          <xProd>Cimento CP II</xProd>
          <NCM>25232910</NCM>
          <uCom>SC</uCom>
          <qCom>10.5000</qCom>
          <vUnCom>35.1234567890</vUnCom>
          <vProd>368.7962962845</vProd>
        </prod>
      </det>
      ${secondItem}
    </infNFe>
  </NFe>
</nfeProc>`;
}

test("Stock Full NF-e reader extrai rascunho de NF-e valida", () => {
  const reader = loadReader();
  const result = reader.parseNfeXml(validNfeXml());

  assert.equal(result.ok, true);
  assert.equal(result.draft.version, "stock-full-nfe-draft/v1");
  assert.equal(result.draft.accessKey, "29260612345678000199550010000012341000012345");
  assert.equal(result.draft.number, "1234");
  assert.equal(result.draft.issuedAt, "2026-08-03T10:20:30-03:00");
  assert.equal(result.draft.supplier.name, "Fornecedor Teste Ltda");
  assert.equal(result.draft.supplier.cnpj, "12345678000199");
  assert.equal(result.draft.items.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(result.draft.items[0])), {
    lineNumber: "1",
    code: "SKU-001",
    description: "Cimento CP II",
    ncm: "25232910",
    unit: "SC",
    quantity: "10.5000",
    unitValue: "35.1234567890",
    totalValue: "368.7962962845"
  });
  assert.equal(result.warnings.length, 0);
});

test("Stock Full NF-e reader rejeita XML malformado", () => {
  const reader = loadReader();
  const result = reader.parseNfeXml("<NFe><infNFe></NFe>");

  assert.equal(result.ok, false);
  assert.equal(result.error, "xml_malformed");
});

test("Stock Full NF-e reader rejeita XML que nao seja NF-e", () => {
  const reader = loadReader();
  const result = reader.parseNfeXml("<root><invoice><number>1</number></invoice></root>");

  assert.equal(result.ok, false);
  assert.equal(result.error, "xml_not_nfe");
});

test("Stock Full NF-e reader trata namespaces com prefixo", () => {
  const reader = loadReader();
  const xml = validNfeXml().replace(/<nfeProc/g, "<nfe:nfeProc").replace(/<\/nfeProc>/g, "</nfe:nfeProc>")
    .replace(/<NFe>/g, "<nfe:NFe>").replace(/<\/NFe>/g, "</nfe:NFe>")
    .replace(/<infNFe/g, "<nfe:infNFe").replace(/<\/infNFe>/g, "</nfe:infNFe>");
  const result = reader.parseNfeXml(xml);

  assert.equal(result.ok, true);
  assert.equal(result.draft.accessKey, "29260612345678000199550010000012341000012345");
  assert.equal(result.draft.items[0].description, "Cimento CP II");
});

test("Stock Full NF-e reader extrai multiplos itens", () => {
  const reader = loadReader();
  const secondItem = `<det nItem="2"><prod>
    <cProd>SKU-002</cProd>
    <xProd>Argamassa AC-II</xProd>
    <NCM>32149000</NCM>
    <uCom>UN</uCom>
    <qCom>3.000</qCom>
    <vUnCom>22.10</vUnCom>
    <vProd>66.30</vProd>
  </prod></det>`;
  const result = reader.parseNfeXml(validNfeXml({ secondItem }));

  assert.equal(result.ok, true);
  assert.equal(result.draft.items.length, 2);
  assert.equal(result.draft.items[1].code, "SKU-002");
  assert.equal(result.draft.items[1].quantity, "3.000");
});

test("Stock Full NF-e reader retorna avisos para campos opcionais ausentes", () => {
  const reader = loadReader();
  const result = reader.parseNfeXml(validNfeXml({ cnpj: "", issuer: "" }));

  assert.equal(result.ok, true);
  assert.match(result.warnings.join(","), /supplier_name_missing/);
  assert.match(result.warnings.join(","), /supplier_cnpj_missing/);
});

test("Stock Full NF-e reader rejeita arquivo excessivamente grande", () => {
  const reader = loadReader();
  const result = reader.parseNfeXml(validNfeXml(), { maxBytes: 32 });

  assert.equal(result.ok, false);
  assert.equal(result.error, "xml_too_large");
});

test("Stock Full NF-e reader rejeita tentativa de XXE", () => {
  const reader = loadReader();
  const xml = `<?xml version="1.0"?>
<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>
<NFe><infNFe Id="NFe29260612345678000199550010000012341000012345"><ide><nNF>&xxe;</nNF></ide></infNFe></NFe>`;
  const result = reader.parseNfeXml(xml);

  assert.equal(result.ok, false);
  assert.equal(result.error, "xml_external_entities_not_allowed");
});
