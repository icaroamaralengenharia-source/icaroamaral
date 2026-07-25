(function (root) {
  "use strict";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function normalizeText(value) {
    return clean(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeUnit(value) {
    const unit = normalizeText(value || "un");
    const aliases = {
      saco: "sc",
      sacos: "sc",
      sc: "sc",
      kg: "kg",
      quilo: "kg",
      quilos: "kg",
      m2: "m2",
      "m 2": "m2",
      m3: "m3",
      "m 3": "m3",
      un: "un",
      und: "un",
      unidade: "un",
      unidades: "un"
    };
    return aliases[unit] || unit || "un";
  }

  function numberValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const parsed = Number(String(value || "").replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sameScope(item, scope) {
    if (!item || typeof item !== "object") return false;
    const projectId = clean(item.projectId || item.project_id || item.project);
    const workId = clean(item.workId || item.work_id || item.work || item.obraId || item.obra_id);
    return (!scope.projectId || !projectId || projectId === scope.projectId) &&
      (!scope.workId || !workId || workId === scope.workId);
  }

  function readJson(storage, key, fallback) {
    if (!storage || typeof storage.getItem !== "function") return fallback;
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function arrayOf(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeProduction(item, scope) {
    const safe = item && typeof item === "object" ? item : {};
    return {
      projectId: clean(safe.projectId || safe.project_id || scope.projectId),
      workId: clean(safe.workId || safe.work_id || scope.workId),
      id: clean(safe.id || safe.productionId || safe.production_id),
      serviceId: clean(safe.serviceId || safe.service_id || safe.workItemId || safe.work_item_id),
      service: clean(safe.service || safe.serviceName || safe.description || safe.name),
      quantity: numberValue(safe.quantity || safe.executedQuantity || safe.producedQuantity || safe.amount || safe.quantidade),
      unit: normalizeUnit(safe.unit || safe.unidade)
    };
  }

  function normalizeMovement(item, scope) {
    const safe = item && typeof item === "object" ? item : {};
    return {
      projectId: clean(safe.projectId || safe.project_id || scope.projectId),
      workId: clean(safe.workId || safe.work_id || scope.workId),
      id: clean(safe.id || safe.movementId || safe.movement_id),
      type: clean(safe.type || safe.movementType || safe.kind || "saida"),
      material: clean(safe.material || safe.materialName || safe.name || safe.description || safe.insumo),
      unit: normalizeUnit(safe.unit || safe.unidade || safe.measureUnit),
      quantity: numberValue(safe.quantity || safe.qty || safe.amount || safe.quantidade || safe.actualStockExit),
      productionId: clean(safe.productionId || safe.production_id),
      service: clean(safe.service || safe.productionService || safe.serviceName || safe.servico)
    };
  }

  function normalizeBalance(item, scope) {
    const safe = item && typeof item === "object" ? item : {};
    const source = safe.item && typeof safe.item === "object" ? Object.assign({}, safe.item, safe) : safe;
    const projectId = clean(source.projectId || source.project_id || scope.projectId);
    const workId = clean(source.workId || source.work_id || scope.workId);
    return {
      projectId,
      workId,
      item: {
        projectId,
        workId,
        id: clean(source.id || source.itemId || source.item_id),
        name: clean(source.name || source.material || source.materialName || source.description || source.insumo),
        unit: normalizeUnit(source.unit || source.unidade || source.measureUnit)
      },
      balance: numberValue(source.realBalance ?? source.currentQuantity ?? source.current_quantity ?? source.balance ?? source.quantity)
    };
  }

  function normalizeExpectedConsumption(item, scope) {
    const safe = item && typeof item === "object" ? item : {};
    return {
      projectId: clean(safe.projectId || safe.project_id || scope.projectId),
      workId: clean(safe.workId || safe.work_id || scope.workId),
      productionId: clean(safe.productionId || safe.production_id),
      serviceId: clean(safe.serviceId || safe.service_id || safe.workItemId || safe.work_item_id),
      service: clean(safe.service || safe.serviceName || safe.production || safe.description),
      material: clean(safe.material || safe.materialName || safe.name || safe.insumo),
      unit: normalizeUnit(safe.unit || safe.unidade || safe.measureUnit),
      coefficient: numberValue(safe.coefficient || safe.consumptionCoefficient || safe.quantityPerUnit || safe.perUnit),
      expectedConsumption: numberValue(safe.expectedConsumption || safe.expectedQuantity || safe.quantity)
    };
  }

  function localRdosFrom(input) {
    const storage = input.localStorage;
    const report = input.obraReport && typeof input.obraReport === "object" ? input.obraReport : {};
    if (Array.isArray(report.rdos)) return report.rdos;
    if (Array.isArray(report.dailyLogs)) return report.dailyLogs;
    if (typeof report.getUserDailyLogs === "function") return arrayOf(report.getUserDailyLogs());
    return arrayOf(readJson(storage, "obraReportDailyLogs", []));
  }

  function productionsFromRdos(rdos, scope) {
    const productions = [];
    arrayOf(rdos).filter((rdo) => sameScope(rdo, scope)).forEach((rdo) => {
      arrayOf(rdo.productions).forEach((production) => {
        productions.push(normalizeProduction(Object.assign({}, production, {
          projectId: production.projectId || production.project_id || rdo.projectId || rdo.project_id,
          workId: production.workId || production.work_id || rdo.workId || rdo.work_id
        }), scope));
      });
    });
    return productions.filter((item) => sameScope(item, scope) && item.service && item.quantity > 0);
  }

  function stockMovementsFrom(input, rdos, scope) {
    const report = input.obraReport && typeof input.obraReport === "object" ? input.obraReport : {};
    if (Array.isArray(report.stockMovements)) return report.stockMovements;
    if (Array.isArray(report.movements)) return report.movements;
    if (typeof report.getStockMovements === "function") return arrayOf(report.getStockMovements());
    return arrayOf(rdos).flatMap((rdo) => arrayOf(rdo.stockMovements || rdo.movements));
  }

  function stockBalancesFrom(input) {
    const operational = input.operationalStock && typeof input.operationalStock === "object" ? input.operationalStock : {};
    if (typeof operational.getAlmoxBalances === "function") return arrayOf(operational.getAlmoxBalances());
    const almox = readJson(input.localStorage, "obraReportAlmoxarifadoData", null);
    if (almox && Array.isArray(almox.balances)) return almox.balances;
    if (almox && Array.isArray(almox.items)) return almox.items;
    const stockMaster = readJson(input.localStorage, "obrareport_stock_master_v1", null);
    if (stockMaster && Array.isArray(stockMaster.balances)) return stockMaster.balances;
    if (stockMaster && Array.isArray(stockMaster.items)) return stockMaster.items;
    return [];
  }

  function plannedConsumptionsFrom(input) {
    const report = input.obraReport && typeof input.obraReport === "object" ? input.obraReport : {};
    if (report.stockIa && Array.isArray(report.stockIa.plannedConsumptions)) {
      return report.stockIa.plannedConsumptions;
    }
    return arrayOf(readJson(input.localStorage, "obraReport.stockIa.plannedConsumptions", []));
  }

  function quality(sourcesUsed) {
    const missingSources = Object.keys(sourcesUsed).filter((key) => !sourcesUsed[key]);
    return {
      level: missingSources.length ? "low" : "high",
      missingSources
    };
  }

  function buildEloStockObrasSnapshot(input) {
    const safe = input || {};
    const scope = {
      projectId: clean(safe.projectId),
      workId: clean(safe.workId)
    };
    const rdos = localRdosFrom(safe);
    const rawMovements = stockMovementsFrom(safe, rdos, scope);
    const rawBalances = stockBalancesFrom(safe);
    const rawExpected = plannedConsumptionsFrom(safe);
    const productions = productionsFromRdos(rdos, scope);
    const stockMovements = rawMovements.map((item) => normalizeMovement(item, scope)).filter((item) => sameScope(item, scope) && item.material && item.quantity > 0);
    const stockBalances = rawBalances.map((item) => normalizeBalance(item, scope)).filter((item) => sameScope(item, scope) && item.item.name);
    const sinapiExpectedConsumptions = rawExpected.map((item) => normalizeExpectedConsumption(item, scope)).filter((item) => sameScope(item, scope) && item.material && (item.coefficient > 0 || item.expectedConsumption > 0));
    const sourcesUsed = {
      rdos: rdos.length > 0,
      stockMovements: rawMovements.length > 0,
      stockBalances: rawBalances.length > 0,
      plannedConsumptions: rawExpected.length > 0
    };
    return {
      projectId: scope.projectId,
      workId: scope.workId,
      productions,
      stockMovements,
      stockBalances,
      sinapiExpectedConsumptions,
      sourcesUsed,
      dataQuality: quality(sourcesUsed)
    };
  }

  const api = { buildEloStockObrasSnapshot };
  if (typeof exports !== "undefined") exports.buildEloStockObrasSnapshot = buildEloStockObrasSnapshot;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.EloStockObrasSnapshot = api;
})(typeof window !== "undefined" ? window : globalThis);

export const buildEloStockObrasSnapshot = globalThis.EloStockObrasSnapshot.buildEloStockObrasSnapshot;
