const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadUi() {
  const source = fs.readFileSync(path.join(__dirname, "..", "relatorio-qualidade-obras", "obrareport-documents-ui.js"), "utf8");
  const context = { globalThis: {} };
  context.globalThis.globalThis = context.globalThis;
  vm.runInNewContext(source, context.globalThis);
  return context.globalThis.ObraReportDocumentsUi;
}

const ui = loadUi();

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.children = [];
    this.dataset = {};
    this.eventListeners = {};
    this.attributes = {};
    this.className = "";
    this.type = "";
    this._textContent = "";
  }
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  addEventListener(type, handler) {
    this.eventListeners[type] = handler;
  }
  set textContent(value) {
    this._textContent = String(value || "");
    this.children = [];
  }
  get textContent() {
    return this._textContent + this.children.map((child) => child.textContent).join("");
  }
  set innerHTML(value) {
    this._textContent = "";
    this.children = [];
    this._innerHTML = String(value || "");
  }
  get innerHTML() {
    return this._innerHTML || "";
  }
}

function createDocument() {
  return {
    createElement(tagName) {
      return new FakeElement(tagName, this);
    }
  };
}

function createTarget() {
  const doc = createDocument();
  return new FakeElement("div", doc);
}

function buttons(card) {
  return card.children[1].children;
}

function render(documents) {
  const target = createTarget();
  const calls = [];
  ui.renderDocumentsList(target, documents, {
    clientsById: { "client-a": { name: "Cliente Alfa" } },
    worksById: { "project-a": { name: "Obra Alfa" } },
    onOpen: (item) => calls.push(["open", item.sourceType]),
    onDownload: (item) => calls.push(["download", item.sourceType]),
    onContinue: (item) => calls.push(["continue", item.sourceType]),
    onReinspect: (item) => calls.push(["reinspect", item.sourceType])
  });
  return { target, calls };
}

test("renderiza cards technical_report, rdo e vistoria com metadados", () => {
  const { target } = render([
    { sourceType: "technical_report", sourceId: "rep-1", title: "Relatorio A", clientId: "client-a", projectId: "project-a", status: "draft", createdBy: "Ana", createdAt: "2026-08-28T10:00:00.000Z", pdfAvailable: false, canContinue: true },
    { sourceType: "rdo", sourceId: "rdo-1", title: "RDO A", clientId: "client-a", projectId: "project-a", status: "closed", date: "2026-08-27", createdBy: "Bruno", pdfAvailable: true, fileUrl: "/api/obrareport/documents/doc-rdo/file" },
    { sourceType: "apartment_handover_inspection", sourceId: "vist-1", title: "Vistoria Apto 101", clientId: "client-a", projectId: "project-a", displayStatus: "PDF FINAL", createdBy: "Carla", updatedAt: "2026-08-29T12:00:00.000Z", pdfAvailable: true, fileUrl: "/api/obrareport/documents/doc-vist/file", canReinspect: true }
  ]);

  assert.equal(target.className, "entity-list obrareport-documents-list");
  assert.equal(target.children.length, 3);
  assert.equal(target.children[0].dataset.sourceType, "technical_report");
  assert.match(target.children[0].textContent, /Tipo: Relatorio Tecnico/);
  assert.match(target.children[0].textContent, /Cliente: Cliente Alfa/);
  assert.match(target.children[0].textContent, /Obra: Obra Alfa/);
  assert.match(target.children[1].textContent, /Tipo: Diario de Obras \/ RDO/);
  assert.match(target.children[1].textContent, /Status: CONCLUIDO/);
  assert.match(target.children[2].textContent, /Tipo: Vistoria de Entrega/);
  assert.match(target.children[2].textContent, /Status: PDF FINAL/);
});

test("mostra apenas acoes aplicaveis por documento", () => {
  const { target, calls } = render([
    { sourceType: "technical_report", sourceId: "rep-1", title: "Relatorio A", canContinue: true, pdfAvailable: false },
    { sourceType: "rdo", sourceId: "rdo-1", title: "RDO A", pdfAvailable: true, fileUrl: "/api/obrareport/documents/doc-rdo/file" },
    { sourceType: "apartment_handover_inspection", sourceId: "vist-1", title: "Vistoria A", pdfAvailable: true, fileUrl: "/api/obrareport/documents/doc-vist/file", canReinspect: true }
  ]);

  assert.deepEqual(buttons(target.children[0]).map((button) => button.textContent), ["Abrir", "Continuar"]);
  assert.deepEqual(buttons(target.children[1]).map((button) => button.textContent), ["Abrir", "Baixar PDF"]);
  assert.deepEqual(buttons(target.children[2]).map((button) => button.textContent), ["Abrir", "Baixar PDF", "Nova re-vistoria"]);

  buttons(target.children[2])[2].eventListeners.click();
  assert.deepEqual(calls.pop(), ["reinspect", "apartment_handover_inspection"]);
});

test("fallback vazio preserva UI com mensagem controlada", () => {
  const target = createTarget();
  ui.renderDocumentsList(target, [], { emptyMessage: "Não foi possível carregar documentos da empresa." });
  assert.equal(target.className, "entity-list empty-list");
  assert.equal(target.textContent, "Não foi possível carregar documentos da empresa.");
});