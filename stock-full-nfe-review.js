(function (root) {
  "use strict";

  const core = root.StockFullCore || {};
  const productsApi = root.StockFullProducts || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const storageKey = core.storageKey || "obraReportAlmoxarifadoData";
  let currentReview = null;

  function getElements() {
    return {
      button: root.document.getElementById("stockFullNfeButton"),
      input: root.document.getElementById("stockFullNfeXmlInput"),
      panel: root.document.getElementById("stockFullNfeReviewPanel"),
      cancel: root.document.getElementById("stockFullNfeCancelButton"),
      status: root.document.getElementById("stockFullNfeStatus"),
      header: root.document.getElementById("stockFullNfeHeader"),
      warnings: root.document.getElementById("stockFullNfeWarnings"),
      items: root.document.getElementById("stockFullNfeItems")
    };
  }

  function readState() {
    try {
      const storage = core.getLocalStorage ? core.getLocalStorage() : root.localStorage;
      const raw = storage ? storage.getItem(storageKey) : "";
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function getSession() { return core.getSession ? core.getSession() : {}; }

  function getAvailableProducts() {
    const state = readState();
    const session = getSession();
    const companyId = clean(session.companyId);
    const environmentId = clean(state.activeStockEnvironmentId);
    return (Array.isArray(state.items) ? state.items : []).filter(function (item) {
      const itemCompanyId = clean(item && item.companyId);
      const itemEnvironmentId = clean(item && item.environmentId);
      return (!companyId || !itemCompanyId || itemCompanyId === companyId) && (!environmentId || !itemEnvironmentId || itemEnvironmentId === environmentId);
    }).map(function (item) { return productsApi.normalizeProduct ? productsApi.normalizeProduct(item) : item; });
  }

  function clone(value) { return JSON.parse(JSON.stringify(value || null)); }

  function setStatus(message, type) {
    const elements = getElements();
    if (!elements.status) return;
    elements.status.textContent = message;
    elements.status.dataset.status = type || "info";
  }

  function showPanel() {
    const elements = getElements();
    if (elements.panel) elements.panel.classList.remove("is-hidden");
  }

  function clearNode(node) {
    if (!node) return;
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function appendField(parent, label, value, key) {
    const box = root.document.createElement("div");
    const strong = root.document.createElement("strong");
    const span = root.document.createElement("span");
    strong.textContent = label;
    span.textContent = clean(value) || "-";
    if (key) span.dataset.stockFullNfeHeader = key;
    box.appendChild(strong);
    box.appendChild(span);
    parent.appendChild(box);
  }

  function renderHeader(draft) {
    const elements = getElements();
    clearNode(elements.header);
    if (!elements.header || !draft) return;
    appendField(elements.header, "Chave", draft.accessKey, "accessKey");
    appendField(elements.header, "Numero", draft.number, "number");
    appendField(elements.header, "Emissao", draft.issuedAt, "issuedAt");
    appendField(elements.header, "Fornecedor", draft.supplier && draft.supplier.name, "supplierName");
    appendField(elements.header, "CNPJ", draft.supplier && draft.supplier.cnpj, "supplierCnpj");
  }

  function renderWarnings(warnings) {
    const elements = getElements();
    clearNode(elements.warnings);
    if (!elements.warnings) return;
    const safeWarnings = Array.isArray(warnings) ? warnings : [];
    elements.warnings.classList.toggle("is-hidden", !safeWarnings.length);
    safeWarnings.forEach(function (warning) {
      const item = root.document.createElement("span");
      item.textContent = clean(warning);
      elements.warnings.appendChild(item);
    });
  }

  function updateReviewItem(index, patch) {
    if (!currentReview || !currentReview.items[index]) return;
    currentReview.items[index] = Object.assign({}, currentReview.items[index], patch || {});
  }

  function createTextInput(value, field, index) {
    const input = root.document.createElement("input");
    input.type = "text";
    input.value = clean(value);
    input.dataset.stockFullNfeField = field;
    input.addEventListener("input", function () {
      const patch = {};
      patch[field] = input.value;
      updateReviewItem(index, patch);
    });
    return input;
  }

  function createProductSelect(products, index) {
    const select = root.document.createElement("select");
    select.dataset.stockFullNfeProductSelect = "true";
    const empty = root.document.createElement("option");
    empty.value = "";
    empty.textContent = "Relacionar produto existente";
    select.appendChild(empty);
    products.forEach(function (product) {
      const option = root.document.createElement("option");
      option.value = clean(product.id);
      option.textContent = [product.name, product.sku || product.fiscalCode, product.unit].filter(Boolean).join(" - ");
      select.appendChild(option);
    });
    select.addEventListener("change", function () {
      updateReviewItem(index, { productId: select.value, createProduct: false });
      const checkbox = select.closest("[data-stock-full-nfe-item-row]").querySelector("[data-stock-full-nfe-create-new]");
      if (checkbox) checkbox.checked = false;
    });
    return select;
  }

  function renderItems(draft) {
    const elements = getElements();
    clearNode(elements.items);
    if (!elements.items || !draft) return;
    const products = getAvailableProducts();
    (draft.items || []).forEach(function (item, index) {
      const row = root.document.createElement("article");
      row.className = "stock-full-nfe-item";
      row.dataset.stockFullNfeItemRow = "true";
      const title = root.document.createElement("div");
      title.className = "stock-full-nfe-item-title";
      const strong = root.document.createElement("strong");
      strong.textContent = clean(item.description) || "Item sem descricao";
      const small = root.document.createElement("small");
      small.textContent = "Codigo " + (clean(item.code) || "-") + " | NCM " + (clean(item.ncm) || "-");
      title.appendChild(strong);
      title.appendChild(small);
      const fields = root.document.createElement("div");
      fields.className = "stock-full-nfe-fields";
      [["Descricao conferida", createTextInput(item.description, "description", index)], ["Unidade", createTextInput(item.unit, "unit", index)], ["Quantidade", createTextInput(item.quantity, "quantity", index)], ["Valor unitario", createTextInput(item.unitValue, "unitValue", index)]].forEach(function (entry) {
        const label = root.document.createElement("label");
        label.textContent = entry[0];
        label.appendChild(entry[1]);
        fields.appendChild(label);
      });
      const relation = root.document.createElement("div");
      relation.className = "stock-full-nfe-relation";
      const selectLabel = root.document.createElement("label");
      selectLabel.textContent = "Produto";
      selectLabel.appendChild(createProductSelect(products, index));
      const newLabel = root.document.createElement("label");
      newLabel.className = "stock-full-nfe-check";
      const checkbox = root.document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.dataset.stockFullNfeCreateNew = "true";
      checkbox.addEventListener("change", function () {
        const select = row.querySelector("[data-stock-full-nfe-product-select]");
        if (checkbox.checked && select) select.value = "";
        updateReviewItem(index, { createProduct: checkbox.checked, productId: checkbox.checked ? "" : currentReview.items[index].productId });
      });
      newLabel.appendChild(checkbox);
      newLabel.appendChild(root.document.createTextNode("Criar produto novo depois"));
      relation.appendChild(selectLabel);
      relation.appendChild(newLabel);
      row.appendChild(title);
      row.appendChild(fields);
      row.appendChild(relation);
      elements.items.appendChild(row);
    });
  }

  function buildReview(result) {
    const draft = result && result.draft || {};
    return {
      version: "stock-full-nfe-review/v1",
      draft: clone(draft),
      warnings: Array.isArray(result && result.warnings) ? result.warnings.slice() : [],
      items: (draft.items || []).map(function (item) {
        return { lineNumber: clean(item.lineNumber), productId: "", createProduct: false, description: clean(item.description), unit: clean(item.unit), quantity: clean(item.quantity), unitValue: clean(item.unitValue), totalValue: clean(item.totalValue), ncm: clean(item.ncm), code: clean(item.code) };
      })
    };
  }

  function renderReview() {
    if (!currentReview) return;
    showPanel();
    renderHeader(currentReview.draft);
    renderWarnings(currentReview.warnings);
    renderItems(currentReview.draft);
    setStatus("Rascunho carregado em memoria. Nenhum produto ou movimento foi criado.", "success");
  }

  function loadXmlText(xmlText) {
    const reader = root.StockFullNfeReader;
    showPanel();
    if (!reader || typeof reader.parseNfeXml !== "function") {
      currentReview = null;
      setStatus("Leitor de NF-e indisponivel neste navegador.", "error");
      return { ok: false, error: "reader_unavailable" };
    }
    const result = reader.parseNfeXml(xmlText);
    if (!result || !result.ok) {
      currentReview = null;
      clearNode(getElements().header);
      clearNode(getElements().items);
      renderWarnings([]);
      setStatus("XML rejeitado: " + clean(result && result.error || "nfe_invalid"), "error");
      return result;
    }
    currentReview = buildReview(result);
    renderReview();
    return result;
  }

  async function handleFile(file) {
    const reader = root.StockFullNfeReader || {};
    if (!file) return;
    showPanel();
    if (file.size > (reader.maxXmlBytes || 1024 * 1024)) {
      currentReview = null;
      setStatus("XML rejeitado: arquivo excede o limite seguro.", "error");
      return;
    }
    setStatus("Lendo XML da NF-e...", "info");
    try {
      const text = typeof file.text === "function" ? await file.text() : await new Promise(function (resolve, reject) {
        const fileReader = new FileReader();
        fileReader.onload = function () { resolve(String(fileReader.result || "")); };
        fileReader.onerror = function () { reject(fileReader.error || new Error("file_read_failed")); };
        fileReader.readAsText(file);
      });
      loadXmlText(text);
    } catch (error) {
      currentReview = null;
      setStatus("Nao foi possivel ler o XML selecionado.", "error");
    }
  }

  function clearDraft() {
    currentReview = null;
    const elements = getElements();
    clearNode(elements.header);
    clearNode(elements.items);
    renderWarnings([]);
    if (elements.input) elements.input.value = "";
    if (elements.panel) elements.panel.classList.add("is-hidden");
    setStatus("Rascunho cancelado.", "info");
  }

  function init() {
    const elements = getElements();
    if (!elements.button || !elements.input || !elements.panel) return;
    elements.button.addEventListener("click", function () { elements.input.click(); });
    elements.input.addEventListener("change", function () { handleFile(elements.input.files && elements.input.files[0]); });
    if (elements.cancel) elements.cancel.addEventListener("click", clearDraft);
  }

  root.StockFullNfeReview = { init, loadXmlTextForTest: loadXmlText, clearDraft, getDraftForTest: function () { return clone(currentReview); }, getAvailableProductsForTest: getAvailableProducts };
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", init); else init();
})(window);
