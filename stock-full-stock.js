(function (window) {
  "use strict";

  const core = window.StockFullCore || {};
  const clean = core.clean || function (value) { return String(value || "").trim(); };
  const parseNumber = core.parseNumber || function (value) { const number = Number(value || 0); return Number.isFinite(number) ? number : 0; };
  const roundQuantity = core.roundQuantity || function (value) { return Math.round(Number(value || 0) * 1000) / 1000; };

  function getMovementOrigin(movement) {
    const origin = clean(movement && movement.origin);
    if (origin) return origin;
    if (movement && movement.remoteSource) return movement.type === "saida" ? "manual_exit" : "manual_entry";
    if (movement && movement.type === "saida") return "manual_exit";
    if (movement && clean(movement.documentNumber)) return "manual_entry";
    if (movement && clean(movement.notes).toLowerCase().indexOf("entrada inicial") >= 0) return "initial_stock";
    if (movement && clean(movement.notes).toLowerCase().indexOf("csv") >= 0) return "csv_import";
    return "adjustment";
  }

  function isManualEntry(movement) {
    return movement && movement.type === "entrada" && getMovementOrigin(movement) === "manual_entry";
  }

  function isInitialStock(movement) {
    return getMovementOrigin(movement) === "initial_stock";
  }

  function isCsvImport(movement) {
    return getMovementOrigin(movement) === "csv_import";
  }

  function getItemBalance(item, movements) {
    const safeItem = item || {};
    const itemId = clean(safeItem.id);
    const entries = (movements || []).filter(function (movement) {
      return clean(movement.itemId || movement.productId) === itemId && movement.type === "entrada";
    }).reduce(function (sum, movement) {
      return sum + Math.max(0, parseNumber(movement.quantity));
    }, 0);
    const exits = (movements || []).filter(function (movement) {
      return clean(movement.itemId || movement.productId) === itemId && movement.type === "saida";
    }).reduce(function (sum, movement) {
      return sum + Math.max(0, parseNumber(movement.quantity));
    }, 0);
    return roundQuantity(entries - exits);
  }

  function buildBalances(items, movements) {
    return (items || []).filter(function (item) {
      return item && !item.archived && !item.isArchived && !item.inactive;
    }).map(function (item) {
      const balance = getItemBalance(item, movements || []);
      const minimum = parseNumber(item.minimumStock || item.minStock);
      return {
        item,
        entries: roundQuantity((movements || []).filter(function (movement) {
          return clean(movement.itemId || movement.productId) === clean(item.id) && movement.type === "entrada";
        }).reduce(function (sum, movement) { return sum + Math.max(0, parseNumber(movement.quantity)); }, 0)),
        exits: roundQuantity((movements || []).filter(function (movement) {
          return clean(movement.itemId || movement.productId) === clean(item.id) && movement.type === "saida";
        }).reduce(function (sum, movement) { return sum + Math.max(0, parseNumber(movement.quantity)); }, 0)),
        balance,
        status: balance <= 0 ? "Crítico" : (minimum > 0 && balance <= minimum ? "Atenção" : "OK")
      };
    }).sort(function (a, b) {
      return clean(a.item && a.item.name).localeCompare(clean(b.item && b.item.name));
    });
  }

  function canExit(quantity, balance) {
    const exitQuantity = parseNumber(quantity);
    return exitQuantity > 0 && exitQuantity <= parseNumber(balance);
  }

  window.StockFullStock = {
    getMovementOrigin,
    isManualEntry,
    isInitialStock,
    isCsvImport,
    getItemBalance,
    buildBalances,
    canExit
  };
})(window);
