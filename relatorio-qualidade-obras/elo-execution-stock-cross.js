(function (root) {
  "use strict";

  function cleanText(value) {
    return String(value == null ? "" : value).trim();
  }

  function normalizeKey(value) {
    return cleanText(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function toNumber(value) {
    const parsed = Number(String(value == null ? "" : value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundQuantity(value) {
    return Math.round(toNumber(value) * 1000000) / 1000000;
  }

  function sameScope(item, projectId, workId) {
    const itemProjectId = cleanText(item && (item.projectId || item.project_id || item.project));
    const itemWorkId = cleanText(item && (item.workId || item.work_id || item.work));
    return (!projectId || !itemProjectId || itemProjectId === projectId) &&
      (!workId || !itemWorkId || itemWorkId === workId);
  }

  function materialNameOf(item) {
    return cleanText(item && (item.material || item.materialName || item.name || item.description || item.insumo));
  }

  function unitOf(item) {
    return cleanText(item && (item.unit || item.unidade || item.measureUnit)) || "un";
  }

  function quantityOf(item) {
    return toNumber(item && (item.quantity || item.qty || item.amount || item.consumption || item.expectedConsumption || item.actualStockExit));
  }

  function materialKey(name, unit) {
    return normalizeKey(name) + "::" + normalizeKey(unit || "un");
  }

  function addMaterial(index, item) {
    const name = materialNameOf(item);
    if (!name) return null;
    const unit = unitOf(item);
    const key = materialKey(name, unit);
    if (!index[key]) {
      index[key] = {
        material: name,
        unit: unit,
        expectedConsumption: 0,
        actualStockExit: 0,
        currentBalance: null,
        hasExpectedReference: false,
        hasProduction: false
      };
    }
    return index[key];
  }

  function productionQuantityForReference(reference, productions) {
    const productionId = cleanText(reference.productionId || reference.production_id || reference.serviceId || reference.service_id || reference.workItemId || reference.work_item_id);
    const productionName = normalizeKey(reference.production || reference.service || reference.serviceName || reference.description);
    return productions.reduce(function (sum, production) {
      const candidateId = cleanText(production.id || production.productionId || production.serviceId || production.workItemId);
      const candidateName = normalizeKey(production.service || production.serviceName || production.description || production.name);
      if (productionId && candidateId && productionId !== candidateId) return sum;
      if (!productionId && productionName && candidateName && productionName !== candidateName) return sum;
      return sum + toNumber(production.quantity || production.executedQuantity || production.producedQuantity || production.amount);
    }, 0);
  }

  function applyExpectedConsumptions(index, references, productions) {
    references.forEach(function (reference) {
      const target = addMaterial(index, reference);
      if (!target) return;
      const productionQuantity = productionQuantityForReference(reference, productions);
      const coefficient = toNumber(reference.coefficient || reference.consumptionCoefficient || reference.quantityPerUnit || reference.perUnit);
      const directExpected = toNumber(reference.expectedConsumption || reference.expectedQuantity || reference.quantity);
      const expected = coefficient > 0 && productionQuantity > 0 ? coefficient * productionQuantity : directExpected;
      if (expected > 0) {
        target.expectedConsumption += expected;
        target.hasExpectedReference = true;
      }
    });
  }

  function applyStockMovements(index, movements) {
    movements.forEach(function (movement) {
      const type = normalizeKey(movement.type || movement.movementType || movement.kind);
      const isExit = type === "saida" || type === "exit" || type === "stock exit" || type === "consumo rdo" || type === "consumption";
      if (!isExit) return;
      const target = addMaterial(index, movement);
      if (!target) return;
      target.actualStockExit += quantityOf(movement);
    });
  }

  function applyBalances(index, balances) {
    balances.forEach(function (balance) {
      const item = balance.item && typeof balance.item === "object" ? Object.assign({}, balance.item, balance) : balance;
      const target = addMaterial(index, item);
      if (!target) return;
      target.currentBalance = roundQuantity(item.realBalance != null ? item.realBalance : item.balance);
    });
  }

  function markProductionCoverage(index, productions) {
    productions.forEach(function (production) {
      const materials = Array.isArray(production.materials) ? production.materials : [];
      materials.forEach(function (material) {
        const target = addMaterial(index, material);
        if (target) target.hasProduction = true;
      });
    });
    Object.keys(index).forEach(function (key) {
      if (index[key].expectedConsumption > 0) index[key].hasProduction = true;
    });
  }

  function statusFor(item) {
    if (!item.hasExpectedReference && item.actualStockExit > 0) return "stock_exit_without_production";
    if (!item.hasExpectedReference) return "missing_reference";
    if (item.expectedConsumption > 0 && item.actualStockExit <= 0) return "production_without_stock_exit";
    if (item.currentBalance != null && item.currentBalance < 0) return "insufficient_balance";
    const difference = item.actualStockExit - item.expectedConsumption;
    const tolerance = Math.max(Math.abs(item.expectedConsumption) * 0.02, 0.000001);
    if (difference > tolerance) return "consumption_above_expected";
    if (difference < -tolerance) return "consumption_below_expected";
    return "ok";
  }

  function buildAlerts(materials) {
    return materials.filter(function (item) {
      return item.status !== "ok";
    }).map(function (item) {
      return {
        material: item.material,
        status: item.status,
        difference: item.difference
      };
    });
  }

  function crossExecutionWithStock(input) {
    const safe = input || {};
    const projectId = cleanText(safe.projectId);
    const workId = cleanText(safe.workId);
    const productions = (Array.isArray(safe.productions) ? safe.productions : []).filter(function (item) {
      return sameScope(item, projectId, workId);
    });
    const stockMovements = (Array.isArray(safe.stockMovements) ? safe.stockMovements : []).filter(function (item) {
      return sameScope(item, projectId, workId);
    });
    const stockBalances = (Array.isArray(safe.stockBalances) ? safe.stockBalances : []).filter(function (item) {
      return sameScope(item.item || item, projectId, workId);
    });
    const references = (Array.isArray(safe.sinapiExpectedConsumptions) ? safe.sinapiExpectedConsumptions : []).filter(function (item) {
      return sameScope(item, projectId, workId);
    });
    const index = {};

    applyExpectedConsumptions(index, references, productions);
    applyStockMovements(index, stockMovements);
    applyBalances(index, stockBalances);
    markProductionCoverage(index, productions);

    const materials = Object.keys(index).map(function (key) {
      const item = index[key];
      const expectedConsumption = roundQuantity(item.expectedConsumption);
      const actualStockExit = roundQuantity(item.actualStockExit);
      const currentBalance = item.currentBalance == null ? null : roundQuantity(item.currentBalance);
      const result = {
        material: item.material,
        unit: item.unit,
        expectedConsumption: expectedConsumption,
        actualStockExit: actualStockExit,
        currentBalance: currentBalance,
        difference: roundQuantity(actualStockExit - expectedConsumption),
        status: "ok"
      };
      result.status = statusFor(Object.assign({}, item, result));
      return result;
    }).sort(function (a, b) {
      return a.material.localeCompare(b.material);
    });
    const alerts = buildAlerts(materials);

    return {
      summary: {
        projectId: projectId,
        workId: workId,
        productions: productions.length,
        materials: materials.length,
        alerts: alerts.length
      },
      materials: materials,
      alerts: alerts,
      dataQuality: {
        hasProductions: productions.length > 0,
        hasStockMovements: stockMovements.length > 0,
        hasStockBalances: stockBalances.length > 0,
        hasSinapiExpectedConsumptions: references.length > 0
      }
    };
  }

  const api = { crossExecutionWithStock: crossExecutionWithStock };

  if (typeof exports !== "undefined") exports.crossExecutionWithStock = crossExecutionWithStock;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EloExecutionStockCross = api;
})(typeof window !== "undefined" ? window : globalThis);

export const crossExecutionWithStock = globalThis.EloExecutionStockCross.crossExecutionWithStock;
