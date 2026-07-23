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
  return (Array.isArray(stock && stock.movements) ? stock.movements : [])
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

  return {
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
}

export default observeObra;
