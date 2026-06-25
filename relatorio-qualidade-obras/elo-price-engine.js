(function (root) {
  "use strict";
  const VERSION = "20260624-elo-price-engine-v1";
  function key(row) { return [row.compositionCode, row.serviceId, row.service, row.package].filter(Boolean).join("|"); }
  function number(v) { const n = Number(String(v == null ? "" : v).replace(",", ".")); return Number.isFinite(n) ? n : null; }
  function findPrice(row, source) {
    const s = source || {};
    const keys = [row.compositionCode, row.serviceId, row.service, key(row)].filter(Boolean);
    for (const k of keys) {
      if (s[k] != null) return number(s[k]);
      if (s.prices && s.prices[k] != null) return number(s.prices[k]);
    }
    if (row.unitPrice != null) return number(row.unitPrice);
    if (row.price != null) return number(row.price);
    return null;
  }
  function attachPricesToBudgetRows(budgetRows, priceSource) {
    const missingPrices = [];
    const pricedRows = (budgetRows || []).map(function (row, index) {
      const price = findPrice(row || {}, priceSource || {});
      const quantity = number(row && row.quantity);
      const total = price != null && quantity != null ? Number((price * quantity).toFixed(2)) : null;
      const priced = Object.assign({}, row, { rowId: row.rowId || row.id || "row_" + index, unitPrice: price, totalPrice: total, priceSource: price == null ? "missing" : ((priceSource && priceSource.source) || "user") });
      if (price == null) missingPrices.push({ rowId: priced.rowId, service: priced.service, compositionCode: priced.compositionCode, reason: "price_missing" });
      return priced;
    });
    const canTotal = pricedRows.length > 0 && missingPrices.length === 0;
    return { pricedRows, missingPrices, canTotal, totals: canTotal ? { directCost: Number(pricedRows.reduce((s, r) => s + Number(r.totalPrice || 0), 0).toFixed(2)) } : null };
  }
  function applyBdi(pricedRows, bdiPercent) {
    const bdi = number(bdiPercent);
    const missing = (pricedRows || []).filter((row) => row.unitPrice == null || row.totalPrice == null);
    if (!Number.isFinite(bdi) || missing.length) return { canApply: false, bdiPercent: bdi, rows: pricedRows || [], totalWithBdi: null, reason: missing.length ? "missing_prices" : "bdi_missing" };
    const direct = (pricedRows || []).reduce((s, r) => s + Number(r.totalPrice || 0), 0);
    return { canApply: true, bdiPercent: bdi, rows: pricedRows, totalWithBdi: Number((direct * (1 + bdi / 100)).toFixed(2)) };
  }
  root.EloPriceEngine = { version: VERSION, attachPricesToBudgetRows, applyBdi };
})(typeof window !== "undefined" ? window : globalThis);
