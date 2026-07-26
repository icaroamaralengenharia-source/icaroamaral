import { crossExecutionWithStock } from "../../relatorio-qualidade-obras/elo-execution-stock-cross.js";
import { buildExecutionStockReport } from "../../relatorio-qualidade-obras/elo-execution-stock-report.js";
import { buildEloStockObrasSnapshot } from "../../relatorio-qualidade-obras/elo-stock-obras-snapshot.js";

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
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

function materialKey(name, unit) {
  return normalizeText(name) + "|" + normalizeUnit(unit);
}

function numberValue(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const parsed = Number(String(value || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

export const ELO_OBRA_ALERT_TYPES = Object.freeze({
  materialShortageRisk: "material_shortage_risk",
  consumptionAbovePlanned: "consumption_above_planned",
  exitWithoutCompatibleProduction: "exit_without_compatible_production",
  productionWithoutMaterialConsumption: "production_without_material_consumption",
  criticalPendingItem: "critical_pending_item"
});

function sameScope(item, scope) {
  if (!item || typeof item !== "object") return false;
  const projectId = clean(item.projectId || item.project_id);
  const workId = clean(item.workId || item.work_id || item.obraId || item.obra_id);
  if (scope.projectId && projectId) return projectId === scope.projectId;
  if (scope.workId && workId) return workId === scope.workId;
  if (scope.projectId || scope.workId) return !projectId && !workId;
  return true;
}

function addQuantity(map, item, quantityField) {
  const name = clean(item && (item.name || item.material || item.itemName || item.description));
  const unit = normalizeUnit(item && (item.unit || item.unidade));
  const quantity = numberValue(item && (item[quantityField] ?? item.quantity ?? item.quantidade));
  if (!name || !(quantity > 0)) return;
  const key = materialKey(name, unit);
  if (!map.has(key)) {
    map.set(key, { key, name, unit, quantity: 0, evidence: [] });
  }
  const current = map.get(key);
  current.quantity += quantity;
  current.evidence.push(item);
}

function normalizeBudgetMaterials(budget, scope) {
  const source = budget && (budget.plannedMaterials || budget.materials || budget.consumptions || budget.inputs || []);
  const map = new Map();
  (Array.isArray(source) ? source : []).filter((item) => sameScope(item, scope)).forEach((item) => {
    addQuantity(map, item, "plannedQuantity");
  });
  return map;
}

function normalizeStockBalance(stock, scope) {
  const source = stock && (stock.balances || stock.balance || stock.items || []);
  const map = new Map();
  (Array.isArray(source) ? source : []).filter((item) => sameScope(item, scope)).forEach((item) => {
    const normalized = Object.assign({}, item, {
      quantity: item.currentQuantity ?? item.current_quantity ?? item.realBalance ?? item.balance ?? item.quantity
    });
    addQuantity(map, normalized, "quantity");
  });
  return map;
}

function normalizeStockMovements(stock, scope) {
  const source = stock && (stock.movements || stock.stockMovements || stock.saidas || stock.exits || []);
  return (Array.isArray(source) ? source : [])
    .filter((item) => sameScope(item, scope))
    .map((item) => ({
      original: item,
      id: clean(item.id),
      type: normalizeText(item.type || item.movementType || item.source),
      source: normalizeText(item.source),
      name: clean(item.name || item.material || item.itemName || item.description),
      unit: normalizeUnit(item.unit || item.unidade),
      quantity: numberValue(item.quantity || item.quantidade),
      date: clean(item.date || item.createdAt || item.created_at),
      productionId: clean(item.productionId || item.production_id),
      serviceId: clean(item.serviceId || item.service_id || item.workItemId || item.work_item_id || item.productionId || item.production_id),
      environmentId: clean(item.environmentId || item.environment_id || item.ambienteId || item.ambiente_id),
      service: clean(item.service || item.productionService || item.servico),
      workId: clean(item.workId || item.work_id || item.obraId || item.obra_id),
      projectId: clean(item.projectId || item.project_id)
    }))
    .filter((item) => item.name && item.quantity > 0);
}

function normalizeRdos(rdos, scope) {
  return (Array.isArray(rdos) ? rdos : []).filter((rdo) => sameScope(rdo, scope));
}

function collectRdoConsumptions(rdos) {
  const map = new Map();
  rdos.forEach((rdo) => {
    (Array.isArray(rdo.materials) ? rdo.materials : []).forEach((material) => {
      addQuantity(map, Object.assign({}, material, { rdoId: rdo.id, date: rdo.date || rdo.rdo_date }), "quantity");
    });
  });
  return map;
}

function collectRdoProductions(rdos) {
  const productions = [];
  rdos.forEach((rdo) => {
    (Array.isArray(rdo.productions) ? rdo.productions : []).forEach((production) => {
      const service = clean(production.service || production.name || production.description);
      const quantity = numberValue(production.quantity || production.quantidade);
      if (!service || !(quantity > 0)) return;
      productions.push({
        id: clean(production.id),
        productionId: clean(production.productionId || production.production_id || production.id),
        projectId: clean(production.projectId || production.project_id || rdo.projectId || rdo.project_id),
        workId: clean(production.workId || production.work_id || rdo.workId || rdo.work_id),
        serviceId: clean(production.serviceId || production.service_id || production.workItemId || production.work_item_id || production.id),
        environmentId: clean(production.environmentId || production.environment_id || rdo.environmentId || rdo.environment_id),
        service,
        serviceKey: normalizeText(service),
        quantity,
        unit: normalizeUnit(production.unit),
        rdoId: clean(rdo.id),
        date: clean(rdo.date || rdo.rdo_date),
        materials: Array.isArray(production.materials) ? production.materials : []
      });
    });
  });
  return productions;
}

function hasCompatibleProduction(movement, productions) {
  if (movement.productionId) {
    return productions.some((production) => production.id && production.id === movement.productionId);
  }
  const serviceKey = normalizeText(movement.service);
  if (serviceKey) {
    return productions.some((production) => production.serviceKey === serviceKey || production.serviceKey.includes(serviceKey) || serviceKey.includes(production.serviceKey));
  }
  return false;
}

function hasConsumptionForProduction(production, consumptions, movements) {
  if (production.materials.length) return true;
  const serviceKey = production.serviceKey;
  return movements.some((movement) => {
    const movementService = normalizeText(movement.service);
    return movement.productionId === production.id || (movementService && (movementService === serviceKey || movementService.includes(serviceKey) || serviceKey.includes(movementService)));
  }) || consumptions.size > 0 && serviceKey.length > 0 && Array.from(consumptions.values()).some((item) => item.evidence.some((evidence) => normalizeText(evidence.service || evidence.productionService || "").includes(serviceKey)));
}

function buildImpact(details) {
  return Object.assign({ financial: null, schedule: null }, details || {});
}

function getEvidenceConfidence(evidence) {
  const values = Object.values(evidence || {});
  return values.some((value) => value === null || value === undefined || value === "" || value === 0) ? "low" : "high";
}

function alert(type, severity, evidence, impact, recommendedAction, confidence) {
  return { type, severity, confidence: confidence || getEvidenceConfidence(evidence), evidence, impact: buildImpact(impact), recommendedAction };
}
function hasCrossExecutionInput(input) {
  return [
    input.productions,
    input.stockMovements,
    input.stockBalances,
    input.sinapiExpectedConsumptions,
    input.expectedConsumptions,
    input.stockObras && input.stockObras.plannedConsumptions,
    input.stockObras && input.stockObras.sinapiExpectedConsumptions
  ].some((items) => Array.isArray(items) && items.length > 0);
}

function normalizeExpectedConsumptions(input, scope) {
  const stock = input.stock || input.stockObras || {};
  const source = input.sinapiExpectedConsumptions || input.expectedConsumptions ||
    stock.sinapiExpectedConsumptions || stock.expectedConsumptions || stock.plannedConsumptions || [];
  return (Array.isArray(source) ? source : [])
    .filter((item) => sameScope(item, scope))
    .map((item) => ({
      projectId: clean(item.projectId || item.project_id || scope.projectId),
      workId: clean(item.workId || item.work_id || item.obraId || item.obra_id || scope.workId),
      productionId: clean(item.productionId || item.production_id),
      serviceId: clean(item.serviceId || item.service_id || item.workItemId || item.work_item_id || item.productionId || item.production_id),
      environmentId: clean(item.environmentId || item.environment_id || item.ambienteId || item.ambiente_id),
      service: clean(item.service || item.serviceName || item.production || item.description),
      material: clean(item.material || item.materialName || item.name || item.insumo),
      unit: normalizeUnit(item.unit || item.unidade || item.measureUnit),
      coefficient: numberValue(item.coefficient || item.consumptionCoefficient || item.quantityPerUnit || item.perUnit),
      expectedConsumption: numberValue(item.expectedConsumption || item.expectedQuantity || item.quantity)
    }))
    .filter((item) => item.material && (item.coefficient > 0 || item.expectedConsumption > 0));
}

function stockMovementForCross(movement) {
  return {
    projectId: movement.projectId,
    workId: movement.workId,
    id: movement.id,
    type: movement.type,
    material: movement.name,
    unit: movement.unit,
    quantity: movement.quantity,
    productionId: movement.productionId,
    serviceId: movement.serviceId,
    environmentId: movement.environmentId,
    service: movement.service
  };
}

function buildObserverCrossInput(input, scope, rdos, productions, movements) {
  const directProductions = Array.isArray(input.productions) ? input.productions : [];
  const directMovements = Array.isArray(input.stockMovements) ? input.stockMovements : [];
  const stockSource = input.stock || input.stockObras || {};
  const stockBalances = stockBalancesForCross(input.stockBalances || stockSource.stockBalances || stockSource.balances || stockSource.items || []);
  const sinapiExpectedConsumptions = normalizeExpectedConsumptions(input, scope);
  const normalizedProductions = directProductions.length ? directProductions : productions;
  const productionServiceIds = new Set(normalizedProductions.map((item) => clean(item.serviceId || item.service_id || item.productionId || item.production_id || item.id)).filter(Boolean));
  const normalizedMovements = directMovements.length ? directMovements : movements.map(stockMovementForCross);
  const unlinkedStockMovements = directMovements.length ? [] : normalizedMovements.filter((item) => !clean(item.serviceId || item.service_id || item.productionId || item.production_id));
  const linkedStockMovements = directMovements.length ? normalizedMovements : normalizedMovements.filter((item) => {
    const serviceId = clean(item.serviceId || item.service_id || item.productionId || item.production_id);
    return serviceId && (!productionServiceIds.size || productionServiceIds.has(serviceId));
  });
  const snapshot = buildEloStockObrasSnapshot({
    projectId: scope.projectId,
    workId: scope.workId,
    obraReport: {
      dailyLogs: rdos,
      stockMovements: linkedStockMovements,
      stockIa: { plannedConsumptions: sinapiExpectedConsumptions }
    },
    operationalStock: {
      getAlmoxBalances() {
        return stockBalances;
      }
    }
  });
  return {
    projectId: scope.projectId,
    workId: scope.workId,
    productions: normalizedProductions,
    stockMovements: linkedStockMovements,
    stockBalances,
    sinapiExpectedConsumptions,
    snapshot,
    unlinkedStockMovements
  };
}

function crossDifferencePercent(material) {
  const expected = numberValue(material && material.expectedConsumption);
  if (!(expected > 0)) return null;
  return Math.round((numberValue(material && material.difference) / expected) * 1000000) / 10000;
}

function crossDeviationClassification(material) {
  const status = clean(material && material.status);
  if (status === "insufficient_balance" || status === "production_without_stock_exit" || status === "stock_exit_without_production" || status === "missing_reference") return "critico";
  const percent = crossDifferencePercent(material);
  if (percent == null || Math.abs(percent) <= 10) return "normal";
  if (Math.abs(percent) > 25) return "critico";
  return "atencao";
}

function enrichExecutionStockCross(cross) {
  if (!cross || typeof cross !== "object") return cross;
  const materials = (Array.isArray(cross.materials) ? cross.materials : []).map((material) => Object.assign({}, material, {
    differencePercent: crossDifferencePercent(material),
    classification: crossDeviationClassification(material)
  }));
  const byMaterial = new Map(materials.map((material) => [normalizeText(material.material), material]));
  const alerts = (Array.isArray(cross.alerts) ? cross.alerts : []).map((crossAlert) => {
    const material = byMaterial.get(normalizeText(crossAlert.material));
    return Object.assign({}, crossAlert, {
      differencePercent: material ? material.differencePercent : null,
      classification: material ? material.classification : crossDeviationClassification(crossAlert)
    });
  });
  return Object.assign({}, cross, { materials, alerts });
}

function crossAlertType(status) {
  const types = {
    insufficient_balance: ELO_OBRA_ALERT_TYPES.materialShortageRisk,
    consumption_above_expected: ELO_OBRA_ALERT_TYPES.consumptionAbovePlanned,
    stock_exit_without_production: ELO_OBRA_ALERT_TYPES.exitWithoutCompatibleProduction,
    production_without_stock_exit: ELO_OBRA_ALERT_TYPES.productionWithoutMaterialConsumption
  };
  return types[status] || status;
}

function crossAlertSeverity(status) {
  const severities = {
    insufficient_balance: "critical",
    consumption_above_expected: "high",
    stock_exit_without_production: "medium",
    production_without_stock_exit: "medium",
    consumption_below_expected: "low",
    missing_reference: "low"
  };
  return severities[status] || "medium";
}

function crossAlertRecommendedAction(status, material) {
  const actions = {
    insufficient_balance: "Regularizar saldo de " + material + " antes da próxima frente.",
    consumption_above_expected: "Comparar saída real, perda e coeficiente SINAPI de " + material + ".",
    stock_exit_without_production: "Vincular a saída de " + material + " a uma produção ou justificar o consumo.",
    production_without_stock_exit: "Registrar saída de almoxarifado compatível com a produção de " + material + ".",
    consumption_below_expected: "Verificar se a saída de " + material + " foi lançada parcialmente.",
    missing_reference: "Vincular " + material + " a uma composição SINAPI antes de concluir o consumo esperado."
  };
  return actions[status] || "Revisar divergência entre execução, consumo esperado e almoxarifado.";
}

function generalAlertKey(item) {
  const evidence = item.evidence || {};
  return [
    item.type,
    normalizeText(evidence.material || ""),
    normalizeUnit(evidence.unit || "")
  ].join("|");
}

function addUniqueAlert(alerts, nextAlert) {
  const nextKey = generalAlertKey(nextAlert);
  if (!alerts.some((current) => generalAlertKey(current) === nextKey)) {
    alerts.push(nextAlert);
  }
}

function buildCrossGeneralAlert(crossAlert, material) {
  const status = clean(crossAlert && crossAlert.status);
  const name = clean((material && material.material) || (crossAlert && crossAlert.material));
  return alert(crossAlertType(status), crossAlertSeverity(status), {
    source: "executionStockCross",
    material: name,
    unit: material ? material.unit : null,
    expectedConsumption: material ? material.expectedConsumption : null,
    actualStockExit: material ? material.actualStockExit : null,
    currentBalance: material ? material.currentBalance : null,
    difference: crossAlert ? crossAlert.difference : null,
    crossStatus: status,
    differencePercent: material && material.differencePercent != null ? material.differencePercent : null,
    classification: material && material.classification ? material.classification : null
  }, {
    quantityGap: crossAlert ? Math.abs(numberValue(crossAlert.difference)) : null,
    unit: material ? material.unit : null
  }, crossAlertRecommendedAction(status, name));
}
function stockBalancesForCross(stockBalances) {
  return (Array.isArray(stockBalances) ? stockBalances : []).map((balance) => {
    if (!balance || typeof balance !== "object" || !balance.item || typeof balance.item !== "object") return balance;
    return Object.assign({}, balance, {
      item: Object.assign({}, balance.item, {
        projectId: balance.item.projectId || balance.item.project_id || balance.projectId || balance.project_id,
        project_id: balance.item.project_id || balance.item.projectId || balance.project_id || balance.projectId,
        workId: balance.item.workId || balance.item.work_id || balance.workId || balance.work_id,
        work_id: balance.item.work_id || balance.item.workId || balance.work_id || balance.workId
      })
    });
  });
}

export function observeObra(input = {}) {
  const scope = {
    projectId: clean(input.projectId || input.project_id),
    workId: clean(input.workId || input.work_id || input.obraId || input.obra_id)
  };
  const budget = normalizeBudgetMaterials(input.budget || input.orcamento || {}, scope);
  const stockBalance = normalizeStockBalance(input.stock || input.stockObras || {}, scope);
  const movements = normalizeStockMovements(input.stock || input.stockObras || {}, scope);
  const rdos = normalizeRdos(input.rdos || input.dailyLogs || [], scope);
  const rdoConsumptions = collectRdoConsumptions(rdos);
  const productions = collectRdoProductions(rdos);
  const alerts = [];
  let executionStockCross = null;

  budget.forEach((planned, key) => {
    const balance = stockBalance.get(key);
    if (balance && balance.quantity < planned.quantity) {
      alerts.push(alert(ELO_OBRA_ALERT_TYPES.materialShortageRisk, "critical", {
        material: planned.name,
        unit: planned.unit,
        plannedQuantity: planned.quantity,
        currentBalance: balance.quantity
      }, { quantityGap: planned.quantity - balance.quantity, unit: planned.unit }, "Comprar ou reservar " + planned.name + " antes da próxima frente."));
    }
    const consumed = rdoConsumptions.get(key);
    if (consumed && consumed.quantity > planned.quantity) {
      alerts.push(alert(ELO_OBRA_ALERT_TYPES.consumptionAbovePlanned, "high", {
        material: planned.name,
        unit: planned.unit,
        plannedQuantity: planned.quantity,
        consumedQuantity: consumed.quantity
      }, { quantityGap: consumed.quantity - planned.quantity, unit: planned.unit }, "Revisar medição, perdas e baixa de " + planned.name + "."));
    }
  });

  movements.filter((movement) => movement.type.includes("saida") || movement.type.includes("consumo")).forEach((movement) => {
    if (!hasCompatibleProduction(movement, productions)) {
      alerts.push(alert(ELO_OBRA_ALERT_TYPES.exitWithoutCompatibleProduction, "medium", {
        movementId: movement.id || null,
        material: movement.name,
        quantity: movement.quantity,
        unit: movement.unit,
        date: movement.date || null
      }, {}, "Vincular a saída a uma produção do RDO ou justificar uso indireto."));
    }
  });

  productions.forEach((production) => {
    if (!hasConsumptionForProduction(production, rdoConsumptions, movements)) {
      alerts.push(alert(ELO_OBRA_ALERT_TYPES.productionWithoutMaterialConsumption, "medium", {
        productionId: production.id || null,
        service: production.service,
        quantity: production.quantity,
        unit: production.unit,
        rdoId: production.rdoId || null
      }, {}, "Lançar materiais consumidos ou marcar produção sem consumo direto."));
    }
  });

  rdos.forEach((rdo) => {
    (Array.isArray(rdo.pendingItems) ? rdo.pendingItems : Array.isArray(rdo.pendencias) ? rdo.pendencias : []).forEach((pending) => {
      const severity = normalizeText(pending.severity || pending.criticidade || pending.status).includes("critic") ? "critical" : "medium";
      alerts.push(alert(ELO_OBRA_ALERT_TYPES.criticalPendingItem, severity, {
        rdoId: clean(rdo.id) || null,
        date: clean(rdo.date || rdo.rdo_date) || null,
        description: clean(pending.description || pending.text || pending.title || pending)
      }, {}, "Priorizar tratativa da pendência antes de avançar a frente afetada."));
    });
  });

  if (hasCrossExecutionInput(input)) {
    const crossInput = buildObserverCrossInput(input, scope, rdos, productions, movements);
    executionStockCross = enrichExecutionStockCross(crossExecutionWithStock(crossInput));
    executionStockCross.unlinkedStockMovements = crossInput.unlinkedStockMovements;
    executionStockCross.auditMemory = buildExecutionStockReport({ snapshot: crossInput.snapshot, cross: executionStockCross });
    const materialByName = new Map(executionStockCross.materials.map((material) => [normalizeText(material.material), material]));
    executionStockCross.alerts.forEach((crossAlert) => {
      const material = materialByName.get(normalizeText(crossAlert.material));
      addUniqueAlert(alerts, buildCrossGeneralAlert(crossAlert, material));
    });
  }

  const result = {
    ok: true,
    scope,
    summary: {
      plannedMaterials: budget.size,
      stockMaterials: stockBalance.size,
      stockMovements: movements.length,
      rdos: rdos.length,
      productions: productions.length,
      alerts: alerts.length
    },
    alerts
  };
  if (executionStockCross) {
    result.executionStockCross = {
      summary: executionStockCross.summary,
      materials: executionStockCross.materials,
      alerts: executionStockCross.alerts,
      unlinkedStockMovements: executionStockCross.unlinkedStockMovements,
      auditMemory: executionStockCross.auditMemory,
      dataQuality: executionStockCross.dataQuality
    };
    result.summary.alerts = alerts.length;
  }
  return result;
}

export default observeObra;
