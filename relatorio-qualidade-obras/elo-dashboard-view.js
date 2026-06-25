(function (root) {
  "use strict";
  const VERSION = "20260624-elo-dashboard-view-v1";
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function rows(items, fn) { return (items || []).map(fn).join(""); }
  function buildDashboardHtml(dashboardData) {
    const d = dashboardData || {};
    const cards = rows(d.cards, (c) => '<article class="elo-dashboard-card elo-status-' + esc(c.status) + '"><span>' + esc(c.label) + '</span><strong>' + esc(c.value) + '</strong></article>');
    const budgetRows = rows(d.tables && d.tables.budgetRows, (r) => '<tr><td>' + esc(r.package) + '</td><td>' + esc(r.service) + '</td><td>' + esc(r.quantity == null ? "pendente" : r.quantity) + '</td><td>' + esc(r.unit) + '</td><td>' + esc(r.quantitySource) + '</td><td>' + esc(r.compositionCode || "pendente") + '</td><td>' + esc(r.consumptionStatus) + '</td><td>' + esc((r.pending || []).join("; ")) + '</td></tr>');
    const consumptions = rows(d.tables && d.tables.consumptions, (c) => rows(c.inputs || [], (i) => '<tr><td>' + esc(c.serviceId) + '</td><td>' + esc(i.name) + '</td><td>' + esc(i.coefficient) + '</td><td>' + esc(c.quantity) + '</td><td>' + esc(i.total) + '</td><td>' + esc(i.unit) + '</td><td>' + esc(i.conversion && i.conversion.available ? i.conversion.totalConverted + ' ' + i.conversion.unit : '') + '</td></tr>'));
    const alerts = rows(d.alerts, (a) => '<li class="elo-alert elo-status-' + esc(a.status) + '">' + esc(a.message) + '</li>');
    return '<section class="elo-dashboard-view"><div class="elo-dashboard-cards">' + cards + '</div><h3>Orçamento preliminar</h3><table><thead><tr><th>Pacote</th><th>Serviço</th><th>Qtd.</th><th>Un.</th><th>Origem</th><th>Composição</th><th>Status</th><th>Pendências</th></tr></thead><tbody>' + budgetRows + '</tbody></table><h3>Consumo previsto</h3><table><thead><tr><th>Serviço</th><th>Insumo</th><th>Coef.</th><th>Qtd.</th><th>Total</th><th>Un.</th><th>Conversão</th></tr></thead><tbody>' + consumptions + '</tbody></table><h3>Alertas</h3><ul>' + alerts + '</ul></section>';
  }
  function clearEloDashboard(container) { const el = typeof container === "string" ? root.document && root.document.querySelector(container) : container; if (el) el.innerHTML = ""; }
  function renderEloDashboard(container, dashboardData, options) { let el = typeof container === "string" ? root.document && root.document.querySelector(container) : container; if (!el && root.document) { el = root.document.createElement("div"); el.className = "elo-dashboard-auto"; (root.document.body || root.document.documentElement).appendChild(el); } if (el) el.innerHTML = buildDashboardHtml(dashboardData, options); return el; }
  root.EloDashboardView = { version: VERSION, renderEloDashboard, clearEloDashboard, buildDashboardHtml };
})(typeof window !== "undefined" ? window : globalThis);
