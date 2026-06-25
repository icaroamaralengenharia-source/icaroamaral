(function (root) {
  "use strict";
  const VERSION = "20260624-elo-dashboard-view-v2-operational";
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function rows(items, fn) { return (items || []).map(fn).join(""); }
  function safeData(d) { return d && typeof d === "object" ? d : {}; }
  function lastBudget() { return root.__ELO_LAST_OPERATIONAL_BUDGET__ || null; }
  function lastProject() { const b = lastBudget(); return b && b.projectRecord || root.__ELO_LAST_PROJECT_RECORD__ || null; }
  function buildCards(d) {
    const cards = (d.cards || []).slice();
    if (!cards.some((c) => c.id === "project-saved")) cards.unshift({ id: "project-saved", label: "Prontuario salvo", value: d.projectRecordId ? "sim" : "local", status: d.projectRecordId ? "ok" : "warning" });
    if (!cards.some((c) => c.id === "base-sinapi")) cards.push({ id: "base-sinapi", label: "Base SINAPI", value: d.baseStatus && d.baseStatus.loaded ? "carregada" : "pendente", status: d.baseStatus && d.baseStatus.loaded ? "ok" : "blocked" });
    if (!cards.some((c) => c.id === "executive")) cards.push({ id: "executive", label: "Prontidao executivo", value: d.executiveClosing ? Math.round((d.executiveClosing.score || 0) * 100) + "%" : "bloqueado", status: d.executiveClosing && d.executiveClosing.canClose ? "ok" : "blocked" });
    return rows(cards, (c) => '<article class="elo-dashboard-card elo-status-' + esc(c.status) + '"><span>' + esc(c.label) + '</span><strong>' + esc(c.value) + '</strong></article>');
  }
  function buildBudgetRows(d) {
    return rows(d.tables && d.tables.budgetRows, (r, index) => '<tr><td>' + esc(r.package) + '</td><td>' + esc(r.service) + '</td><td>' + esc(r.quantity == null ? "pendente" : r.quantity) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.quantitySource) + '</td><td>' + esc(r.compositionCode || "pendente") + '</td><td>' + esc(r.consumptionStatus || r.status) + '</td><td>' + esc((r.pending || []).join("; ")) + '</td><td><button type="button" data-elo-action="copy-row" data-row-index="' + index + '">Copiar</button></td></tr>');
  }
  function buildCandidates(d) {
    return rows(d.selectableCompositions || d.candidates || [], (c) => '<tr><td>' + esc(c.serviceId || c.service) + '</td><td>' + esc(c.code || c.compositionCode) + '</td><td>' + esc(c.description) + '</td><td>' + esc(c.source || "SINAPI") + '</td><td>' + esc(c.unit) + '</td><td>' + esc(c.score) + '</td><td><button type="button" data-elo-action="select-composition" data-package-id="' + esc(c.packageId) + '" data-service-id="' + esc(c.serviceId) + '" data-code="' + esc(c.code || c.compositionCode) + '">Selecionar</button></td></tr>');
  }
  function buildConsumptions(d) {
    return rows(d.tables && d.tables.consumptions, (c) => rows(c.inputs || [], (i) => '<tr><td>' + esc(c.serviceId || c.service) + '</td><td>' + esc(i.name) + '</td><td>' + esc(i.coefficient) + '</td><td>' + esc(c.quantity) + '</td><td>' + esc(i.total) + '</td><td>' + esc(i.unit) + '</td><td>' + esc(i.conversion && i.conversion.available ? i.conversion.totalConverted + " " + i.conversion.unit : "") + '</td><td>' + esc(i.source || c.source || "composicao") + '</td></tr>'));
  }
  function buildAudits(d) {
    return rows(d.audits || [], (a) => '<tr><td>' + esc(a.item || a.service || a.id) + '</td><td>' + esc(a.expected) + '</td><td>' + esc(a.withdrawn) + '</td><td>' + esc(a.executed) + '</td><td>' + esc(a.difference) + '</td><td>' + esc(a.status) + '</td><td>' + esc(a.justification) + '</td></tr>');
  }
  function buildChecklist(d) {
    const checklist = d.executiveClosing && d.executiveClosing.checklist || d.closingChecklist && d.closingChecklist.checklist || [];
    return rows(checklist, (item) => '<li class="elo-checklist-item elo-status-' + esc(item.ok ? "ok" : "blocked") + '"><strong>' + esc(item.label || item.id) + '</strong><span>' + esc(item.ok ? "ok" : "bloqueado") + '</span><small>' + esc(item.required ? "obrigatorio" : "opcional") + '</small><em>' + esc(item.nextAction || item.message || "") + '</em></li>');
  }
  function buildPending(d) {
    const items = (d.missing || d.pending || []).concat((d.alerts || []).filter((a) => a.status === "blocked").map((a) => ({ message: a.message, reason: a.status })));
    return rows(items, (p) => '<li><strong>' + esc(p.message || p.id || p.pending) + '</strong><span>' + esc(p.reason || p.motive || "pendente") + '</span><em>' + esc(p.nextAction || "Completar premissa tecnica") + '</em></li>');
  }
  function buildActions() {
    return '<div class="elo-dashboard-actions"><button type="button" data-elo-action="save-project">Salvar prontuario</button><button type="button" data-elo-action="export-csv">Exportar CSV</button><button type="button" data-elo-action="export-json">Exportar JSON</button><button type="button" data-elo-action="generate-checklist">Gerar checklist executivo</button><button type="button" data-elo-action="register-audit">Registrar auditoria</button><button type="button" data-elo-action="copy-summary">Copiar resumo tecnico</button></div>';
  }
  function buildDashboardHtml(dashboardData) {
    const d = safeData(dashboardData);
    return '<section class="elo-dashboard-view elo-operational-dashboard"><header><h3>Painel operacional do ELO</h3><p>Orcamento preliminar auditavel. Valores so aparecem com preco informado.</p></header><div class="elo-dashboard-cards">' + buildCards(d) + '</div>' + buildActions() + '<h3>Orcamento preliminar</h3><table><thead><tr><th>Pacote</th><th>Servico</th><th>Quantidade</th><th>Unidade</th><th>Origem</th><th>Composi??o</th><th>Status</th><th>Pendencias</th><th>Acao</th></tr></thead><tbody>' + buildBudgetRows(d) + '</tbody></table><h3>Composicoes candidatas</h3><table><thead><tr><th>Servico</th><th>Codigo</th><th>Descricao</th><th>Fonte</th><th>Unidade</th><th>Score</th><th>Acao</th></tr></thead><tbody>' + buildCandidates(d) + '</tbody></table><h3>Consumos</h3><table><thead><tr><th>Servico</th><th>Insumo</th><th>Coeficiente</th><th>Quantidade</th><th>Total</th><th>Unidade</th><th>Conversoo</th><th>Origem</th></tr></thead><tbody>' + buildConsumptions(d) + '</tbody></table><h3>Auditorias</h3><table><thead><tr><th>Item</th><th>Previsto</th><th>Retirado</th><th>Executado</th><th>Diferenca</th><th>Status</th><th>Justificativa</th></tr></thead><tbody>' + buildAudits(d) + '</tbody></table><h3>Pendencias</h3><ul class="elo-pending-panel">' + buildPending(d) + '</ul><h3>Checklist executivo</h3><ul class="elo-executive-checklist">' + buildChecklist(d) + '</ul></section>';
  }
  function clearEloDashboard(container) { const el = typeof container === "string" ? root.document && root.document.querySelector(container) : container; if (el) el.innerHTML = ""; }
  function bindActions(el) { if (!el || el.__eloDashboardBound) return; el.__eloDashboardBound = true; el.addEventListener("click", function (event) { const btn = event.target && event.target.closest && event.target.closest("[data-elo-action]"); if (!btn || !root.EloDashboardActions) return; const action = btn.getAttribute("data-elo-action"); if (action === "select-composition") root.EloDashboardActions.selectComposition({ packageId: btn.getAttribute("data-package-id"), serviceId: btn.getAttribute("data-service-id"), compositionCode: btn.getAttribute("data-code") });
      if (action === "save-project") root.EloDashboardActions.saveProject();
      if (action === "export-csv") root.EloDashboardActions.exportCsv();
      if (action === "export-json") root.EloDashboardActions.exportJson();
      if (action === "generate-checklist") root.EloDashboardActions.generateExecutiveChecklist();
      if (action === "register-audit") root.EloDashboardActions.registerAudit({ status: "manual", item: "auditoria manual" });
      if (action === "copy-summary") root.EloDashboardActions.copyTechnicalSummary();
    }); }
  function renderEloDashboard(container, dashboardData, options) { let el = typeof container === "string" ? root.document && root.document.querySelector(container) : container; if (!el && root.document) { el = root.document.createElement("div"); el.id = "elo-operational-dashboard"; el.className = "elo-dashboard-auto"; (root.document.body || root.document.documentElement).appendChild(el); } if (el) { el.innerHTML = buildDashboardHtml(dashboardData, options); bindActions(el); } return el; }
  function setLastBudget(budget) { root.__ELO_LAST_OPERATIONAL_BUDGET__ = budget || null; root.__ELO_LAST_PROJECT_RECORD__ = budget && budget.projectRecord || null; }
  function makeActions() {
    return {
      selectComposition: function (payload) { const b = lastBudget(); const record = lastProject(); const engine = root.EloCompositionSelectionEngine; if (!record || !engine) return { ok: false, error: "project_or_engine_unavailable" }; const selected = engine.selectComposition(record, payload || {}); root.__ELO_LAST_PROJECT_RECORD__ = selected; if (root.EloProjectStore) root.EloProjectStore.saveProjectRecord(selected); return { ok: !selected.selectionError, projectRecord: selected, error: selected.selectionError || "" }; },
      saveProject: function () { const record = lastProject(); if (!record) return { ok: false, error: "project_unavailable" }; const saved = root.EloProjectStore ? root.EloProjectStore.saveProjectRecord(record) : record; return { ok: true, source: saved.persistenceSource || "local", projectRecord: saved }; },
      exportCsv: function () { const b = lastBudget(); return b && b.exportData && b.exportData.budgetCsv || (root.EloExportEngine && b ? root.EloExportEngine.exportBudgetToCsv(b.budgetTable) : ""); },
      exportJson: function () { const record = lastProject(); return record ? JSON.stringify(record, null, 2) : "{}"; },
      generateExecutiveChecklist: function () { const b = lastBudget(); const record = lastProject(); return root.EloExecutiveBudgetEngine && b ? root.EloExecutiveBudgetEngine.prepareExecutiveClosing(record, b, { requireBdi: true }) : null; },
      registerAudit: function (payload) { const record = lastProject(); if (!record) return { ok: false, error: "project_unavailable" }; record.audits = (record.audits || []).concat(Object.assign({ at: new Date().toISOString() }, payload || {})); const saved = root.EloProjectStore ? root.EloProjectStore.saveProjectRecord(record) : record; return { ok: true, projectRecord: saved }; },
      copyTechnicalSummary: function () { const b = lastBudget(); const text = b && root.EloBudgetEngine ? root.EloBudgetEngine.buildBudgetReportText(b) : ""; if (root.navigator && root.navigator.clipboard && text) root.navigator.clipboard.writeText(text).catch(function () {}); return text; }
    };
  }
  root.EloDashboardActions = root.EloDashboardActions || makeActions();
  root.EloDashboardView = { version: VERSION, renderEloDashboard, clearEloDashboard, buildDashboardHtml, setLastBudget };
})(typeof window !== "undefined" ? window : globalThis);
