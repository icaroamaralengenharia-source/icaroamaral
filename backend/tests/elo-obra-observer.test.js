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
