import assert from "node:assert/strict";
import { test } from "node:test";
import { ELO_OBRA_ALERT_TYPES, observeObra } from "../src/elo-obra-observer.js";

function baseInput(overrides = {}) {
  return Object.assign({
    projectId: "obra-a",
    budget: {
      plannedMaterials: [
        { projectId: "obra-a", name: "Cimento Portland", unit: "sc", plannedQuantity: 10 },
        { projectId: "obra-a", name: "Areia media", unit: "m3", plannedQuantity: 5 }
      ]
    },
    stock: {
      balances: [
        { projectId: "obra-a", name: "Cimento portland", unit: "sacos", currentQuantity: 3 },
        { projectId: "obra-a", name: "Areia média", unit: "m3", currentQuantity: 8 }
      ],
      movements: []
    },
    rdos: []
  }, overrides);
}

test("observador aponta cimento insuficiente", () => {
  const result = observeObra(baseInput());
  const alert = result.alerts.find((item) => item.type === ELO_OBRA_ALERT_TYPES.materialShortageRisk);
  assert.equal(alert.severity, "critical");
  assert.equal(alert.confidence, "high");
  assert.equal(alert.evidence.material, "Cimento Portland");
  assert.equal(alert.impact.financial, null);
  assert.equal(alert.impact.schedule, null);
  assert.equal(alert.impact.quantityGap, 7);
});

test("observador aponta consumo acima do previsto", () => {
  const result = observeObra(baseInput({
    stock: { balances: [], movements: [] },
    rdos: [{
      projectId: "obra-a",
      id: "rdo-1",
      date: "2026-07-22",
      materials: [{ name: "cimento portland", unit: "sc", quantity: 12 }]
    }]
  }));
  const alert = result.alerts.find((item) => item.type === ELO_OBRA_ALERT_TYPES.consumptionAbovePlanned);
  assert.equal(alert.severity, "high");
  assert.equal(alert.impact.financial, null);
  assert.equal(alert.evidence.consumedQuantity, 12);
  assert.equal(alert.impact.quantityGap, 2);
});

test("observador aponta saida sem producao compativel", () => {
  const result = observeObra(baseInput({
    stock: {
      balances: [],
      movements: [{ projectId: "obra-a", id: "mov-1", type: "saida", name: "Cimento Portland", unit: "sc", quantity: 2 }]
    },
    rdos: [{ projectId: "obra-a", id: "rdo-1", productions: [{ id: "prod-1", service: "Pintura", unit: "m2", quantity: 20 }] }]
  }));
  const alert = result.alerts.find((item) => item.type === ELO_OBRA_ALERT_TYPES.exitWithoutCompatibleProduction);
  assert.equal(alert.severity, "medium");
  assert.equal(alert.evidence.movementId, "mov-1");
});

test("observador aponta producao sem consumo", () => {
  const result = observeObra(baseInput({
    stock: { balances: [], movements: [] },
    rdos: [{ projectId: "obra-a", id: "rdo-1", productions: [{ id: "prod-1", service: "Alvenaria", unit: "m2", quantity: 30 }] }]
  }));
  const alert = result.alerts.find((item) => item.type === ELO_OBRA_ALERT_TYPES.productionWithoutMaterialConsumption);
  assert.equal(alert.severity, "medium");
  assert.equal(alert.evidence.service, "Alvenaria");
});


test("observador reduz confidence quando evidencia esta incompleta", () => {
  const result = observeObra(baseInput({
    stock: {
      balances: [],
      movements: [{ projectId: "obra-a", type: "saida", name: "Cimento Portland", unit: "sc", quantity: 2 }]
    },
    rdos: []
  }));
  const alert = result.alerts.find((item) => item.type === ELO_OBRA_ALERT_TYPES.exitWithoutCompatibleProduction);
  assert.equal(alert.confidence, "low");
  assert.equal(alert.impact.financial, null);
  assert.equal(alert.impact.schedule, null);
});
test("dados incompletos nao geram conclusao falsa", () => {
  const result = observeObra({
    projectId: "obra-a",
    budget: { plannedMaterials: [{ projectId: "obra-a", name: "Cimento", unit: "sc" }] },
    stock: { balances: [{ projectId: "obra-a", name: "Cimento", unit: "sc" }], movements: [{ projectId: "obra-a", type: "saida", name: "", quantity: 5 }] },
    rdos: [{ projectId: "obra-a", productions: [{ service: "Alvenaria", quantity: 0 }] }]
  });
  assert.equal(result.alerts.length, 0);
});

test("obra A nao mistura dados da obra B", () => {
  const result = observeObra({
    projectId: "obra-a",
    budget: { plannedMaterials: [{ projectId: "obra-a", name: "Cimento", unit: "sc", plannedQuantity: 10 }] },
    stock: {
      balances: [{ projectId: "obra-b", name: "Cimento", unit: "sc", currentQuantity: 0 }],
      movements: [{ projectId: "obra-b", id: "mov-b", type: "saida", name: "Cimento", unit: "sc", quantity: 99 }]
    },
    rdos: [{ projectId: "obra-b", id: "rdo-b", materials: [{ name: "Cimento", unit: "sc", quantity: 99 }] }]
  });
  assert.equal(result.summary.stockMaterials, 0);
  assert.equal(result.summary.stockMovements, 0);
  assert.equal(result.summary.rdos, 0);
  assert.equal(result.alerts.length, 0);
});
function crossInput(overrides = {}) {
  return Object.assign({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    productions: [{
      projectId: "obra-a",
      workId: "serv-alvenaria",
      serviceId: "alvenaria-bloco",
      service: "Alvenaria de vedacao",
      quantity: 100,
      unit: "m2"
    }],
    sinapiExpectedConsumptions: [{
      projectId: "obra-a",
      workId: "serv-alvenaria",
      serviceId: "alvenaria-bloco",
      material: "Bloco ceramico 9x19x19",
      unit: "un",
      coefficient: 25
    }],
    stockMovements: [{
      projectId: "obra-a",
      workId: "serv-alvenaria",
      type: "saida",
      material: "Bloco ceramico 9x19x19",
      unit: "un",
      quantity: 2500
    }],
    stockBalances: [{
      projectId: "obra-a",
      workId: "serv-alvenaria",
      item: { name: "Bloco ceramico 9x19x19", unit: "un" },
      balance: 100
    }]
  }, overrides);
}

test("observador cruza 100 m2 de alvenaria com esperado, saida e saldo", () => {
  const result = observeObra(crossInput());
  assert.equal(result.executionStockCross.summary.productions, 1);
  assert.equal(result.executionStockCross.summary.materials, 1);
  assert.equal(result.executionStockCross.dataQuality.hasProductions, true);
  assert.equal(result.executionStockCross.dataQuality.hasStockMovements, true);

  const material = result.executionStockCross.materials[0];
  assert.equal(material.material, "Bloco ceramico 9x19x19");
  assert.equal(material.expectedConsumption, 2500);
  assert.equal(material.actualStockExit, 2500);
  assert.equal(material.currentBalance, 100);
  assert.equal(material.status, "ok");
});

test("observador incorpora alerta de consumo acima do esperado", () => {
  const result = observeObra(crossInput({
    stockMovements: [{ projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico 9x19x19", unit: "un", quantity: 2600 }]
  }));
  const crossAlert = result.executionStockCross.alerts.find((item) => item.status === "consumption_above_expected");
  const generalAlert = result.alerts.find((item) => item.evidence.crossStatus === "consumption_above_expected");

  assert.equal(crossAlert.difference, 100);
  assert.equal(generalAlert.type, ELO_OBRA_ALERT_TYPES.consumptionAbovePlanned);
  assert.equal(generalAlert.severity, "high");
  assert.equal(generalAlert.evidence.expectedConsumption, 2500);
  assert.equal(generalAlert.evidence.actualStockExit, 2600);
});

test("observador incorpora alerta de saldo insuficiente", () => {
  const result = observeObra(crossInput({
    stockBalances: [{ projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Bloco ceramico 9x19x19", unit: "un" }, balance: -3 }]
  }));
  const generalAlert = result.alerts.find((item) => item.evidence.crossStatus === "insufficient_balance");

  assert.equal(result.executionStockCross.materials[0].status, "insufficient_balance");
  assert.equal(generalAlert.type, ELO_OBRA_ALERT_TYPES.materialShortageRisk);
  assert.equal(generalAlert.severity, "critical");
  assert.equal(generalAlert.evidence.currentBalance, -3);
});

test("observador incorpora alerta de producao sem saida de almoxarifado", () => {
  const result = observeObra(crossInput({ stockMovements: [] }));
  const generalAlert = result.alerts.find((item) => item.evidence.crossStatus === "production_without_stock_exit");

  assert.equal(result.executionStockCross.materials[0].status, "production_without_stock_exit");
  assert.equal(generalAlert.type, ELO_OBRA_ALERT_TYPES.productionWithoutMaterialConsumption);
  assert.equal(generalAlert.severity, "medium");
});

test("observador nao mistura cruzamento da obra A com obra B", () => {
  const result = observeObra(crossInput({
    stockMovements: [
      { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico 9x19x19", unit: "un", quantity: 2500 },
      { projectId: "obra-b", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico 9x19x19", unit: "un", quantity: 9000 }
    ],
    stockBalances: [
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Bloco ceramico 9x19x19", unit: "un" }, balance: 100 },
      { projectId: "obra-b", workId: "serv-alvenaria", item: { name: "Bloco ceramico 9x19x19", unit: "un" }, balance: -999 }
    ]
  }));

  assert.equal(result.executionStockCross.materials[0].actualStockExit, 2500);
  assert.equal(result.executionStockCross.materials[0].currentBalance, 100);
  assert.equal(result.executionStockCross.alerts.length, 0);
});


test("observador monta cross a partir de RDO persistido, almoxarifado e SINAPI recebidos", () => {
  const result = observeObra({
    projectId: "obra-parede-a",
    workId: "obra-1",
    stockObras: {
      movements: [
        { projectId: "obra-parede-a", workId: "obra-1", serviceId: "serv-parede", type: "saida", material: "Bloco ceramico", unit: "un", quantity: 1250 },
        { projectId: "obra-parede-b", workId: "obra-1", serviceId: "serv-parede", type: "saida", material: "Bloco ceramico", unit: "un", quantity: 9000 },
        { projectId: "obra-parede-a", workId: "obra-1", type: "saida", material: "Argamassa", unit: "kg", quantity: 10 }
      ],
      plannedConsumptions: [
        { projectId: "obra-parede-a", workId: "obra-1", serviceId: "serv-parede", material: "Bloco ceramico", unit: "un", coefficient: 25 }
      ]
    },
    rdos: [{
      projectId: "obra-parede-a",
      workId: "obra-1",
      id: "rdo-parede-1",
      productions: [{ serviceId: "serv-parede", service: "Parede de alvenaria", quantity: 50, unit: "m2" }]
    }]
  });

  assert.equal(result.executionStockCross.summary.productions, 1);
  assert.equal(result.executionStockCross.materials[0].expectedConsumption, 1250);
  assert.equal(result.executionStockCross.materials[0].actualStockExit, 1250);
  assert.equal(result.executionStockCross.materials.some((item) => item.actualStockExit === 9000), false);
  assert.equal(result.executionStockCross.unlinkedStockMovements.length, 1);
  assert.equal(result.executionStockCross.unlinkedStockMovements[0].material, "Argamassa");
  assert.equal(result.executionStockCross.auditMemory.ok, true);
});

test("observador valida calcada 24 m2 com retiradas e consumo teorico", () => {
  const result = observeObra({
    projectId: "obra-calcada-a",
    workId: "obra-2",
    stockObras: {
      movements: [
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", type: "saida", material: "Cimento", unit: "sc", quantity: 6 },
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", type: "saida", material: "Areia", unit: "m3", quantity: 3.6 },
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", type: "saida", material: "Brita", unit: "m3", quantity: 2.4 },
        { projectId: "obra-calcada-b", workId: "obra-2", serviceId: "serv-calcada", type: "saida", material: "Cimento", unit: "sc", quantity: 99 },
        { projectId: "obra-calcada-a", workId: "obra-2", type: "saida", material: "Acabamento", unit: "kg", quantity: 5 }
      ],
      plannedConsumptions: [
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", material: "Cimento", unit: "sc", coefficient: 0.25 },
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", material: "Areia", unit: "m3", coefficient: 0.15 },
        { projectId: "obra-calcada-a", workId: "obra-2", serviceId: "serv-calcada", material: "Brita", unit: "m3", coefficient: 0.1 }
      ]
    },
    rdos: [{
      projectId: "obra-calcada-a",
      workId: "obra-2",
      id: "rdo-calcada-1",
      productions: [{ serviceId: "serv-calcada", service: "Calcada em concreto", quantity: 24, unit: "m2" }]
    }]
  });
  const byMaterial = Object.fromEntries(result.executionStockCross.materials.map((item) => [item.material, item]));

  assert.equal(result.executionStockCross.summary.productions, 1);
  assert.equal(byMaterial.Cimento.expectedConsumption, 6);
  assert.equal(byMaterial.Cimento.actualStockExit, 6);
  assert.equal(byMaterial.Cimento.difference, 0);
  assert.equal(byMaterial.Areia.expectedConsumption, 3.6);
  assert.equal(byMaterial.Areia.actualStockExit, 3.6);
  assert.equal(byMaterial.Brita.expectedConsumption, 2.4);
  assert.equal(byMaterial.Brita.actualStockExit, 2.4);
  assert.equal(result.executionStockCross.materials.some((item) => item.actualStockExit === 99), false);
  assert.equal(result.executionStockCross.unlinkedStockMovements.length, 1);
  assert.equal(result.executionStockCross.unlinkedStockMovements[0].material, "Acabamento");
  assert.equal(result.executionStockCross.auditMemory.ok, true);
});

test("observador valida pintura 200 m2 com tinta massa e consumo teorico", () => {
  const result = observeObra({
    projectId: "obra-pintura-a",
    workId: "obra-3",
    stockObras: {
      movements: [
        { projectId: "obra-pintura-a", workId: "obra-3", serviceId: "serv-pintura", type: "saida", material: "Tinta acrilica", unit: "l", quantity: 36 },
        { projectId: "obra-pintura-a", workId: "obra-3", serviceId: "serv-pintura", type: "saida", material: "Massa corrida", unit: "kg", quantity: 120 },
        { projectId: "obra-pintura-b", workId: "obra-3", serviceId: "serv-pintura", type: "saida", material: "Tinta acrilica", unit: "l", quantity: 500 },
        { projectId: "obra-pintura-a", workId: "obra-3", type: "saida", material: "Lixa", unit: "un", quantity: 20 }
      ],
      plannedConsumptions: [
        { projectId: "obra-pintura-a", workId: "obra-3", serviceId: "serv-pintura", material: "Tinta acrilica", unit: "l", coefficient: 0.18 },
        { projectId: "obra-pintura-a", workId: "obra-3", serviceId: "serv-pintura", material: "Massa corrida", unit: "kg", coefficient: 0.6 }
      ]
    },
    rdos: [{
      projectId: "obra-pintura-a",
      workId: "obra-3",
      id: "rdo-pintura-1",
      productions: [{ serviceId: "serv-pintura", service: "Pintura acrilica", quantity: 200, unit: "m2" }]
    }]
  });
  const byMaterial = Object.fromEntries(result.executionStockCross.materials.map((item) => [item.material, item]));

  assert.equal(result.executionStockCross.summary.productions, 1);
  assert.equal(byMaterial["Tinta acrilica"].expectedConsumption, 36);
  assert.equal(byMaterial["Tinta acrilica"].actualStockExit, 36);
  assert.equal(byMaterial["Tinta acrilica"].difference, 0);
  assert.equal(byMaterial["Massa corrida"].expectedConsumption, 120);
  assert.equal(byMaterial["Massa corrida"].actualStockExit, 120);
  assert.equal(result.executionStockCross.materials.some((item) => item.actualStockExit === 500), false);
  assert.equal(result.executionStockCross.unlinkedStockMovements.length, 1);
  assert.equal(result.executionStockCross.unlinkedStockMovements[0].material, "Lixa");
  assert.equal(result.executionStockCross.auditMemory.ok, true);
});

function deviationObserverInput(actualQuantity) {
  return {
    projectId: "obra-desvio-a",
    workId: "obra-4",
    stockObras: {
      movements: [
        { projectId: "obra-desvio-a", workId: "obra-4", serviceId: "serv-desvio", type: "saida", material: "Cimento", unit: "sc", quantity: actualQuantity },
        { projectId: "obra-desvio-a", workId: "obra-4", serviceId: "serv-outro", type: "saida", material: "Cimento", unit: "sc", quantity: 999 },
        { projectId: "obra-desvio-b", workId: "obra-4", serviceId: "serv-desvio", type: "saida", material: "Cimento", unit: "sc", quantity: 888 }
      ],
      plannedConsumptions: [
        { projectId: "obra-desvio-a", workId: "obra-4", serviceId: "serv-desvio", material: "Cimento", unit: "sc", coefficient: 1 }
      ]
    },
    rdos: [{
      projectId: "obra-desvio-a",
      workId: "obra-4",
      id: "rdo-desvio-1",
      productions: [{ serviceId: "serv-desvio", service: "Servico com desvio", quantity: 100, unit: "m2" }]
    }]
  };
}

test("observador classifica consumo exato como normal", () => {
  const result = observeObra(deviationObserverInput(100));
  const material = result.executionStockCross.materials[0];

  assert.equal(material.expectedConsumption, 100);
  assert.equal(material.actualStockExit, 100);
  assert.equal(material.difference, 0);
  assert.equal(material.differencePercent, 0);
  assert.equal(material.classification, "normal");
  assert.equal(result.executionStockCross.alerts.length, 0);
  assert.equal(result.executionStockCross.auditMemory.ok, true);
  assert.equal(result.executionStockCross.materials.some((item) => item.actualStockExit === 999 || item.actualStockExit === 888), false);
});

test("observador classifica desvio intermediario como atencao", () => {
  const result = observeObra(deviationObserverInput(115));
  const material = result.executionStockCross.materials[0];
  const crossAlert = result.executionStockCross.alerts[0];
  const generalAlert = result.alerts.find((item) => item.evidence.crossStatus === "consumption_above_expected");

  assert.equal(material.expectedConsumption, 100);
  assert.equal(material.actualStockExit, 115);
  assert.equal(material.difference, 15);
  assert.equal(material.differencePercent, 15);
  assert.equal(material.classification, "atencao");
  assert.equal(crossAlert.classification, "atencao");
  assert.equal(generalAlert.evidence.classification, "atencao");
  assert.equal(result.executionStockCross.auditMemory.ok, true);
});

test("observador classifica desvio alto como critico", () => {
  const result = observeObra(deviationObserverInput(130));
  const material = result.executionStockCross.materials[0];
  const crossAlert = result.executionStockCross.alerts[0];
  const generalAlert = result.alerts.find((item) => item.evidence.crossStatus === "consumption_above_expected");

  assert.equal(material.expectedConsumption, 100);
  assert.equal(material.actualStockExit, 130);
  assert.equal(material.difference, 30);
  assert.equal(material.differencePercent, 30);
  assert.equal(material.classification, "critico");
  assert.equal(crossAlert.classification, "critico");
  assert.equal(generalAlert.evidence.classification, "critico");
  assert.equal(result.executionStockCross.auditMemory.ok, true);
});
test("observador sem dados novos mantem contrato antigo", () => {
  const result = observeObra(baseInput());

  assert.equal(Object.hasOwn(result, "executionStockCross"), false);
  assert.equal(result.summary.plannedMaterials, 2);
  assert.equal(result.summary.stockMaterials, 2);
  assert.equal(result.summary.stockMovements, 0);
  assert.equal(result.summary.rdos, 0);
  assert.equal(result.summary.productions, 0);
  assert.equal(result.summary.alerts, 1);
});
