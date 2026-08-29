(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ObraReportDocumentsUi = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function typeLabel(sourceType) {
    if (sourceType === "technical_report") return "Relatorio Tecnico";
    if (sourceType === "rdo") return "Diario de Obras / RDO";
    if (sourceType === "apartment_handover_inspection") return "Vistoria de Entrega";
    return "Documento";
  }

  function statusLabel(documentItem) {
    const displayStatus = clean(documentItem && documentItem.displayStatus);
    if (displayStatus) return displayStatus;
    const status = clean(documentItem && documentItem.status).toLowerCase();
    if (status === "archived") return "ARQUIVADO";
    if (["completed", "closed", "final_pdf_generated"].indexOf(status) >= 0) return "CONCLUIDO";
    return "RASCUNHO";
  }

  function resolveName(map, id, fallback) {
    if (!id) return fallback || "-";
    const item = map && map[id];
    return clean(item && (item.name || item.title)) || fallback || id;
  }

  function formatDate(value) {
    const text = clean(value);
    if (!text) return "-";
    return text.slice(0, 10);
  }

  function normalizeCard(documentItem, context) {
    const safe = documentItem || {};
    const ctx = context || {};
    const clientName = clean(safe.clientName) || resolveName(ctx.clientsById, safe.clientId, safe.clientId ? "" : "-");
    const projectName = clean(safe.projectName) || resolveName(ctx.worksById, safe.projectId, safe.projectId ? "" : "-");
    return {
      id: clean(safe.id || safe.sourceId || safe.documentId),
      sourceType: clean(safe.sourceType || safe.source_type),
      sourceId: clean(safe.sourceId || safe.source_id),
      typeLabel: typeLabel(clean(safe.sourceType || safe.source_type)),
      title: clean(safe.title) || typeLabel(clean(safe.sourceType || safe.source_type)),
      client: clientName || "-",
      project: projectName || "-",
      date: formatDate(safe.date || safe.updatedAt || safe.createdAt),
      status: statusLabel(safe),
      author: clean(safe.createdBy || safe.created_by) || "-",
      pdfLabel: safe.pdfAvailable ? "PDF: Disponivel" : "PDF: Nao disponivel",
      pdfAvailable: Boolean(safe.pdfAvailable),
      fileUrl: clean(safe.fileUrl || safe.file_url),
      documentId: clean(safe.documentId || safe.latestDocumentId || safe.document_id),
      canContinue: Boolean(safe.canContinue),
      canReinspect: Boolean(safe.canReinspect)
    };
  }

  function createButton(documentRef, label, kind, onClick) {
    const button = documentRef.createElement("button");
    button.type = "button";
    button.className = "mini-button" + (kind ? " " + kind : "");
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function appendMeta(container, documentRef, label, value) {
    const item = documentRef.createElement("span");
    item.textContent = label + ": " + (clean(value) || "-");
    container.appendChild(item);
  }

  function renderDocumentsList(target, documents, options) {
    if (!target) return;
    const opts = options || {};
    const documentRef = opts.document || target.ownerDocument;
    const list = Array.isArray(documents) ? documents : [];
    target.innerHTML = "";
    if (!list.length) {
      target.textContent = clean(opts.emptyMessage) || "Nenhum documento vinculado com seguranca ao seu acesso.";
      target.className = "entity-list empty-list";
      return;
    }

    target.className = "entity-list obrareport-documents-list";
    list.forEach(function (item) {
      const card = normalizeCard(item, opts);
      const article = documentRef.createElement("article");
      const content = documentRef.createElement("div");
      const title = documentRef.createElement("strong");
      const meta = documentRef.createElement("div");
      const actions = documentRef.createElement("div");

      article.className = "entity-item obrareport-document-card";
      article.dataset.sourceType = card.sourceType;
      article.dataset.documentId = card.documentId;
      title.textContent = card.title;
      meta.className = "document-card-meta";
      actions.className = "entity-actions";

      appendMeta(meta, documentRef, "Tipo", card.typeLabel);
      appendMeta(meta, documentRef, "Cliente", card.client);
      appendMeta(meta, documentRef, "Obra", card.project);
      appendMeta(meta, documentRef, "Data", card.date);
      appendMeta(meta, documentRef, "Status", card.status);
      appendMeta(meta, documentRef, "Autor", card.author);
      appendMeta(meta, documentRef, "PDF", card.pdfAvailable ? "Disponivel" : "Nao disponivel");

      actions.appendChild(createButton(documentRef, "Abrir", "primary", function () {
        if (typeof opts.onOpen === "function") opts.onOpen(item, card);
      }));
      if (card.pdfAvailable && card.fileUrl) {
        actions.appendChild(createButton(documentRef, "Baixar PDF", "", function () {
          if (typeof opts.onDownload === "function") opts.onDownload(item, card);
        }));
      }
      if (card.canContinue) {
        actions.appendChild(createButton(documentRef, "Continuar", "", function () {
          if (typeof opts.onContinue === "function") opts.onContinue(item, card);
        }));
      }
      if (card.canReinspect) {
        actions.appendChild(createButton(documentRef, "Nova re-vistoria", "", function () {
          if (typeof opts.onReinspect === "function") opts.onReinspect(item, card);
        }));
      }

      content.appendChild(title);
      content.appendChild(meta);
      article.appendChild(content);
      article.appendChild(actions);
      target.appendChild(article);
    });
  }

  return {
    normalizeCard: normalizeCard,
    renderDocumentsList: renderDocumentsList,
    statusLabel: statusLabel,
    typeLabel: typeLabel
  };
});