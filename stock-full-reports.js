(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };

  function buildSummaryText(data) {
    const balances = data && Array.isArray(data.balances) ? data.balances : [];
    if (!balances.length) return "Cadastre produtos e movimentações para gerar um resumo real do Stock Full.";
    const critical = balances.filter(function (balance) {
      return Number(balance.balance || 0) <= 0 || Number(balance.balance || 0) <= Number(balance.item && balance.item.minimumStock || 0);
    });
    const main = balances[0] || {};
    return "Stock Full possui " + balances.length + " produto(s). " +
      "Produto em destaque: " + clean(main.item && main.item.name || "sem nome") + ". " +
      "Alertas de reposição: " + critical.length + ".";
  }

  function createBackupPayload(state, meta) {
    return {
      module: "stock-full",
      version: 1,
      exportedAt: new Date().toISOString(),
      meta: meta || {},
      state: state || {}
    };
  }

  function isStockFullBackup(payload) {
    return payload && payload.module === "stock-full" && payload.state && typeof payload.state === "object";
  }

  window.StockFullReports = {
    buildSummaryText,
    createBackupPayload,
    isStockFullBackup
  };
})(window);
