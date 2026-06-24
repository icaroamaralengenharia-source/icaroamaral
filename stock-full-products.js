(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; };

  function normalizeProduct(product) {
    const source = product || {};
    return {
      id: clean(source.id),
      companyId: clean(source.companyId || source.company_id || source.institution_id),
      sku: clean(source.sku || source.fiscalCode || source.code),
      fiscalCode: clean(source.fiscalCode || source.sku || source.code),
      name: clean(source.name),
      category: clean(source.category) || "Geral",
      unit: clean(source.unit) || "un",
      initialQuantity: parseNumber(source.initialQuantity || source.currentStock || source.current_quantity),
      currentStock: parseNumber(source.currentStock || source.current_quantity || source.initialQuantity),
      minimumStock: parseNumber(source.minimumStock || source.minStock || source.min_quantity),
      minStock: parseNumber(source.minStock || source.minimumStock || source.min_quantity),
      costPrice: parseNumber(source.costPrice || source.cost_price || source.unitCost),
      salePrice: parseNumber(source.salePrice || source.sale_price),
      supplier: clean(source.supplier),
      location: clean(source.location),
      notes: clean(source.notes),
      createdAt: clean(source.createdAt || source.created_at),
      updatedAt: clean(source.updatedAt || source.updated_at)
    };
  }

  function findProduct(products, term) {
    const normalized = clean(term).toLowerCase();
    if (!normalized) return null;
    return (products || []).find(function (product) {
      const safe = normalizeProduct(product);
      return [safe.name, safe.sku, safe.fiscalCode].some(function (value) {
        return clean(value).toLowerCase() === normalized;
      });
    }) || null;
  }

  function filterProducts(products, term) {
    const normalized = clean(term).toLowerCase();
    if (!normalized) return (products || []).slice();
    return (products || []).filter(function (product) {
      const safe = normalizeProduct(product);
      return [safe.name, safe.sku, safe.fiscalCode, safe.category, safe.supplier].some(function (value) {
        return clean(value).toLowerCase().indexOf(normalized) >= 0;
      });
    });
  }

  window.StockFullProducts = {
    normalizeProduct,
    findProduct,
    filterProducts
  };
})(window);
