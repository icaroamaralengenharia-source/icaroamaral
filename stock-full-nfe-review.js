(function (root) {
  "use strict";

  const core = root.StockFullCore || {};
  const productsApi = root.StockFullProducts || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(String(value || "0").replace(",", ".")); return Number.isFinite(number) ? number : 0; };
  const storageKey = core.storageKey || "obraReportAlmoxarifadoData";
  let currentReview = null;

  function getElements() {
    return {
      button: root.document.getElementById("stockFullNfeButton"),
      input: root.document.getElementById("stockFullNfeXmlInput"),
      panel: root.document.getElementById("stockFullNfeReviewPanel"),
      cancel: root.document.getElementById("stockFullNfeCancelButton"),
      confirm: root.document.getElementById("stockFullNfeConfirmButton"),
      status: root.document.getElementById("stockFullNfeStatus"),
      header: root.document.getElementById("stockFullNfeHeader"),
      warnings: root.document.getElementById("stockFullNfeWarnings"),
      items: root.document.getElementById("stockFullNfeItems"),
      results: root.document.getElementById("stockFullNfeResults")
    };
  }

  function getStorage() { return core.getLocalStorage ? core.getLocalStorage() : root.localStorage; }

  function readState() {
    try {
      const storage = getStorage();
      const raw = storage ? storage.getItem(storageKey) : "";
      return raw ? JSON.parse(raw) : {};
    } catch (error) {
      return {};
    }
  }

  function writeState(state) {
    const storage = getStorage();
    if (!storage) throw new Error("storage_unavailable");
    storage.setItem(storageKey, JSON.stringify(state || {}));
  }

  function getSession() { return core.getSession ? core.getSession() : {}; }

  function getCompanyId() {
    const session = getSession();
    return clean(session.companyId || session.institutionId || session.company_id || session.institution_id) || "local";
  }

  function getEnvironmentId(state, companyId) {
    return clean(state && state.activeStockEnvironmentId) || (companyId ? "env_" + companyId : "env_local");
  }

  function can(permission) {
    return core.canStockFull ? core.canStockFull(permission, getSession()) : true;
  }

  function normalizeState(state) {
    const companyId = getCompanyId();
    const safe = state && typeof state === "object" ? Object.assign({}, state) : {};
    safe.items = Array.isArray(safe.items) ? safe.items.slice() : [];
    safe.movements = Array.isArray(safe.movements) ? safe.movements.slice() : [];
    safe.auditLog = Array.isArray(safe.auditLog) ? safe.auditLog.slice() : [];
    safe.stockEnvironments = Array.isArray(safe.stockEnvironments) ? safe.stockEnvironments.slice() : [];
    safe.activeStockEnvironmentId = getEnvironmentId(safe, companyId);
    if (!safe.stockEnvironments.some(function (environment) { return clean(environment && environment.id) === safe.activeStockEnvironmentId; })) {
      safe.stockEnvironments.push({ id: safe.activeStockEnvironmentId, companyId: companyId, environmentName: "Estoque principal", mode: "almoxarifado" });
    }
    return safe;
  }

  function getAvailableProducts() {
    const state = normalizeState(readState());
    const companyId = getCompanyId();
    const environmentId = getEnvironmentId(state, companyId);
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

  function renderResults(results) {
    const elements = getElements();
    clearNode(elements.results);
    if (!elements.results) return;
    const safeResults = Array.isArray(results) ? results : [];
    elements.results.classList.toggle("is-hidden", !safeResults.length);
    safeResults.forEach(function (result) {
      const item = root.document.createElement("div");
      item.className = "stock-full-nfe-result";
      item.dataset.status = result.ok ? "ok" : "error";
      item.textContent = clean(result.message) || (result.ok ? "Item confirmado" : "Item rejeitado");
      elements.results.appendChild(item);
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
      confirmed: false,
      confirmationResults: [],
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
    renderResults(currentReview.confirmationResults);
    setStatus("Rascunho carregado em memoria. Nenhum produto ou movimento foi criado.", "success");
  }

  function safeKey(value) { return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 90) || "nfe"; }

  function findProductById(state, productId, companyId, environmentId) {
    return (state.items || []).find(function (item) {
      return clean(item.id) === clean(productId) && (!clean(item.companyId) || clean(item.companyId) === companyId) && (!clean(item.environmentId) || clean(item.environmentId) === environmentId);
    }) || null;
  }

  function hasDuplicateNfe(state, companyId, accessKey) {
    return (state.movements || []).some(function (movement) {
      return clean(movement.companyId) === companyId && clean(movement.documentNumber) === accessKey && clean(movement.origin) === "nfe_import";
    });
  }

  function buildAudit(companyId, environmentId, action, entityId, description, metadata) {
    const session = getSession();
    return { id: "sfaudit_nfe_" + safeKey(entityId || description) + "_" + Date.now().toString(36), companyId: companyId, environmentId: environmentId, createdBy: clean(session.userId || session.userEmail), createdByRole: clean(session.role), action: action, entityType: "stock_nfe", entityId: clean(entityId), description: description, metadata: metadata || {}, createdAt: new Date().toISOString() };
  }

  function validateConfirmation(state, companyId, environmentId) {
    const errors = [];
    if (!currentReview || !currentReview.draft) errors.push("Nenhuma NF-e carregada.");
    if (!can("movements:in")) errors.push("Usuario sem permissao para registrar entrada.");
    const accessKey = clean(currentReview && currentReview.draft && currentReview.draft.accessKey);
    if (!accessKey) errors.push("Chave da NF-e ausente.");
    if (accessKey && hasDuplicateNfe(state, companyId, accessKey)) errors.push("NF-e ja confirmada para esta empresa.");
    const needsProductCreate = currentReview && currentReview.items.some(function (item) { return item.createProduct; });
    if (needsProductCreate && !can("products:create")) errors.push("Usuario sem permissao para criar produto.");
    (currentReview && currentReview.items || []).forEach(function (item, index) {
      const label = "Item " + (item.lineNumber || index + 1);
      if (!item.createProduct && !clean(item.productId)) errors.push(label + ": relacione um produto existente ou marque produto novo.");
      if (item.productId && !findProductById(state, item.productId, companyId, environmentId)) errors.push(label + ": produto existente nao encontrado nesta empresa.");
      if (item.createProduct && !clean(item.description)) errors.push(label + ": descricao obrigatoria para criar produto.");
      if (parseNumber(item.quantity) <= 0) errors.push(label + ": quantidade invalida.");
      if (parseNumber(item.unitValue) < 0) errors.push(label + ": valor unitario invalido.");
    });
    return errors;
  }

  function confirmEntry() {
    showPanel();
    const state = normalizeState(readState());
    const companyId = getCompanyId();
    const environmentId = getEnvironmentId(state, companyId);
    const errors = validateConfirmation(state, companyId, environmentId);
    if (errors.length) {
      currentReview.confirmationResults = errors.map(function (message) { return { ok: false, message: message }; });
      renderResults(currentReview.confirmationResults);
      setStatus("Entrada da NF-e nao confirmada. Corrija todos os itens antes de tentar novamente.", "error");
      return { ok: false, errors: errors.slice(), results: clone(currentReview.confirmationResults) };
    }

    const accessKey = clean(currentReview.draft.accessKey);
    const now = new Date().toISOString();
    const date = clean(currentReview.draft.issuedAt).slice(0, 10) || now.slice(0, 10);
    const supplier = clean(currentReview.draft.supplier && currentReview.draft.supplier.name);
    const nextState = normalizeState(clone(state));
    const results = [];
    currentReview.items.forEach(function (item, index) {
      const line = clean(item.lineNumber) || String(index + 1);
      let productId = clean(item.productId);
      if (item.createProduct) {
        productId = "tmp_product_nfe_" + safeKey(companyId + "_" + accessKey + "_" + line);
        nextState.items.push({ id: productId, operationId: "product:create:nfe:" + safeKey(companyId + ":" + accessKey + ":" + line), offlineUuid: "product:create:nfe:" + safeKey(companyId + ":" + accessKey + ":" + line), companyId: companyId, environmentId: environmentId, fiscalCode: clean(item.code), sku: clean(item.code), name: clean(item.description), category: "NF-e", unit: clean(item.unit) || "un", initialQuantity: 0, currentStock: 0, minimumStock: 0, minStock: 0, costPrice: parseNumber(item.unitValue), supplier: supplier, notes: "Criado a partir da NF-e " + accessKey, createdAt: now, updatedAt: now });
        nextState.auditLog.unshift(buildAudit(companyId, environmentId, "product_created", productId, "Produto criado por conferencia de NF-e: " + clean(item.description), { accessKey: accessKey, lineNumber: line }));
      }
      const movementId = "tmp_movement_nfe_" + safeKey(companyId + "_" + accessKey + "_" + line);
      const operationId = "stock:entry:nfe:" + safeKey(companyId + ":" + accessKey + ":" + line + ":" + productId);
      nextState.movements.push({ id: movementId, operationId: operationId, offlineUuid: operationId, companyId: companyId, environmentId: environmentId, itemId: productId, productId: productId, type: "entrada", quantity: parseNumber(item.quantity), responsible: clean(getSession().userName || getSession().userEmail) || "Stock Full", documentNumber: accessKey, unitCost: parseNumber(item.unitValue), total: parseNumber(item.quantity) * parseNumber(item.unitValue), supplier: supplier, reason: "Entrada por NF-e", origin: "nfe_import", nfeAccessKey: accessKey, nfeNumber: clean(currentReview.draft.number), date: date, movementDate: date, movementTime: "00:00", movementDateTime: date + "T00:00:00.000", notes: "Entrada confirmada pela conferencia de XML NF-e.", createdAt: now });
      nextState.auditLog.unshift(buildAudit(companyId, environmentId, "movement_in_created", movementId, "Entrada por NF-e confirmada: " + clean(item.description), { accessKey: accessKey, lineNumber: line, itemId: productId, quantity: parseNumber(item.quantity), operationId: operationId }));
      updateReviewItem(index, { productId: productId });
      results.push({ ok: true, message: "Item " + line + " confirmado: " + clean(item.description), itemId: productId, operationId: operationId });
    });
    nextState.auditLog = nextState.auditLog.slice(0, 300);
    nextState.updatedAt = now;
    writeState(nextState);
    currentReview.confirmed = true;
    currentReview.confirmationResults = results;
    renderResults(results);
    setStatus("Entrada da NF-e confirmada pelo fluxo oficial do Stock Full.", "success");
    return { ok: true, results: clone(results), state: readState() };
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
      renderResults([]);
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
    renderResults([]);
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
    if (elements.confirm) elements.confirm.addEventListener("click", confirmEntry);
  }

  root.StockFullNfeReview = { init, loadXmlTextForTest: loadXmlText, confirmForTest: confirmEntry, clearDraft, getDraftForTest: function () { return clone(currentReview); }, getAvailableProductsForTest: getAvailableProducts };
  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", init); else init();
})(window);
