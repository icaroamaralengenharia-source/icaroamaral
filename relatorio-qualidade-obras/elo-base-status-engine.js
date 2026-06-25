(function (root) {
  "use strict";
  const VERSION = "20260624-elo-base-status-v1";
  function getTechnicalBaseStatus() {
    const search = root.CompositionSearchEngine;
    const stock = root.StockAiCompositionEngine;
    let stats = null;
    try { if (search && search.getIndexStats) stats = search.getIndexStats(); } catch (_) {}
    let imported = [];
    try { if (stock && stock.getImportedOfficialBaseCatalog) imported = stock.getImportedOfficialBaseCatalog(); } catch (_) {}
    const first = imported[0] || {};
    const totalCompositions = stats && stats.totalCompositions || imported.length || 0;
    const totalInputs = stats && (stats.totalInputs || stats.indexedInputCount) || imported.reduce((sum, c) => sum + ((c.inputs || []).length), 0);
    return { loaded: totalCompositions > 0, source: first.source || "SINAPI", state: first.state || first.sourceRegion || "", referenceMonth: first.referenceMonth || first.sourceDate || "", totalCompositions, totalInputs, uniqueInputs: stats && stats.uniqueInputs || stats && stats.indexedUniqueInputCount || 0, indexDurationMs: stats && stats.indexDurationMs || 0, lastLoadedAt: new Date().toISOString() };
  }
  root.EloBaseStatusEngine = { version: VERSION, getTechnicalBaseStatus };
})(typeof window !== "undefined" ? window : globalThis);
