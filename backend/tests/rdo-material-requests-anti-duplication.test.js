import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const frontendFile = join(testDir, "..", "..", "relatorio-qualidade-obras", "relatorio-qualidade-obras.js");
const frontendSource = readFileSync(frontendFile, "utf8");
const buildMovementsBlock = extractFunctionBlock_(frontendSource, "buildStockMovementsFromDailyLogs_");
const deliveryHelperBlock = [
  extractFunctionBlock_(frontendSource, "validateRdoMaterialRequestDelivery_"),
  extractFunctionBlock_(frontendSource, "buildRdoMaterialRequestAlmoxExitMovement_"),
  extractFunctionBlock_(frontendSource, "getRdoMaterialRequestDeliveryStatus_")
].join("\n");

test("RDO materialRequests sozinho nao gera consumo_rdo", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_test_1",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_1",
      productionId: "prd_1",
      requestedName: "Cimento",
      requestedQuantity: 20,
      requestedUnit: "saco",
      status: "acima_do_previsto",
      decision: "Pedido acima do previsto"
    }]
  }];

  const before = clone_(dailyLogs);
  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 0);
  assert.deepEqual(dailyLogs, before);
  assert.equal(movements.some((movement) => movement.type === "consumo_rdo"), false);
});

test("RDO materialRequests nao altera materials nem copia solicitacao", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_test_materials_empty",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_keep",
      productionId: "prd_1",
      requestedName: "Cimento",
      requestedQuantity: 12,
      requestedUnit: "saco",
      status: "simulado"
    }]
  }];

  buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.deepEqual(dailyLogs[0].materials, []);
  assert.equal(dailyLogs[0].materialRequests.length, 1);
  assert.equal(dailyLogs[0].materialRequests[0].requestedQuantity, 12);
});

test("RDO materialRequests aprovado nao gera consumo_rdo nem altera materials", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_approved_request",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_approved",
      requestedName: "Cimento",
      requestedQuantity: 18,
      requestedUnit: "saco",
      predictedQuantity: 20,
      availableQuantity: 100,
      status: "coerente",
      approvalStatus: "aprovado",
      approvedBy: "Gestor Teste",
      approvedAt: "2026-06-07T12:00:00.000Z"
    }]
  }];

  const before = clone_(dailyLogs);
  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 0);
  assert.deepEqual(dailyLogs, before);
  assert.deepEqual(dailyLogs[0].materials, []);
  assert.equal(movements.some((movement) => movement.type === "consumo_rdo"), false);
});

test("RDO materialRequests rejeitado nao gera consumo_rdo nem altera materials", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_rejected_request",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_rejected",
      requestedName: "Cimento",
      requestedQuantity: 80,
      requestedUnit: "saco",
      predictedQuantity: 20,
      availableQuantity: 100,
      status: "acima_do_previsto",
      approvalStatus: "rejeitado",
      rejectedBy: "Gestor Teste",
      rejectedAt: "2026-06-07T12:00:00.000Z",
      rejectionReason: "Acima do previsto."
    }]
  }];

  const before = clone_(dailyLogs);
  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 0);
  assert.deepEqual(dailyLogs, before);
  assert.deepEqual(dailyLogs[0].materials, []);
  assert.equal(movements.some((movement) => movement.type === "consumo_rdo"), false);
});

test("RDO materialRequests aprovado e entregue nao gera consumo_rdo", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_delivered_request",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_delivered_1",
      approvalStatus: "aprovado",
      almoxExitId: "almox_exit_1",
      deliveredQuantity: 10,
      deliveredBy: "Almoxarife",
      deliveredAt: "2026-06-07T12:00:00.000Z",
      deliveryStatus: "entregue",
      requestedName: "Cimento",
      requestedQuantity: 10,
      requestedUnit: "saco"
    }]
  }];

  const before = clone_(dailyLogs);
  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 0);
  assert.deepEqual(dailyLogs, before);
  assert.equal(movements.some((movement) => movement.type === "consumo_rdo"), false);
});

test("RDO materialRequests com entrega parcial nao gera consumo_rdo", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_partial_delivery_request",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_partial_delivery_1",
      approvalStatus: "aprovado",
      almoxExitId: "almox_exit_partial_1",
      deliveredQuantity: 5,
      deliveredBy: "Almoxarife",
      deliveredAt: "2026-06-07T12:00:00.000Z",
      deliveryStatus: "entregue_parcial",
      requestedName: "Cimento",
      requestedQuantity: 10,
      requestedUnit: "saco"
    }]
  }];

  const before = clone_(dailyLogs);
  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 0);
  assert.deepEqual(dailyLogs, before);
  assert.equal(movements.some((movement) => movement.quantity === 5), false);
});

test("RDO materialRequests entregue nao altera materials nem a propria solicitacao", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_delivery_integrity",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_delivery_integrity",
      approvalStatus: "aprovado",
      almoxExitId: "almox_exit_integrity",
      deliveredQuantity: 10,
      deliveredBy: "Almoxarife",
      deliveredAt: "2026-06-07T12:00:00.000Z",
      deliveryStatus: "entregue",
      requestedName: "Cimento",
      requestedQuantity: 10,
      requestedUnit: "saco"
    }]
  }];

  const before = clone_(dailyLogs);
  buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.deepEqual(dailyLogs[0].materials, []);
  assert.deepEqual(dailyLogs[0].materialRequests, before[0].materialRequests);
});

test("RDO materials real continua gerando somente consumo registrado", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_test_2",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [{
      id: "mat_1",
      name: "Cimento",
      quantity: 5,
      unit: "saco",
      unitValue: 40,
      totalValue: 200,
      note: "Consumo real registrado no RDO"
    }],
    materialRequests: [{
      id: "req_2",
      requestedName: "Cimento",
      requestedQuantity: 20,
      requestedUnit: "saco",
      status: "simulado"
    }]
  }];

  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, "consumo_rdo");
  assert.equal(movements[0].source, "rdo");
  assert.equal(movements[0].quantity, 5);
  assert.equal(movements[0].name, "Cimento");
  assert.notEqual(movements[0].quantity, dailyLogs[0].materialRequests[0].requestedQuantity);
});

test("RDO materials real continua gerando consumo mesmo com materialRequest entregue", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_real_material_with_delivered_request",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [{
      id: "mat_real_consumption",
      name: "Cimento",
      quantity: 3,
      unit: "saco",
      unitValue: 40,
      totalValue: 120,
      note: "Consumo real registrado no RDO"
    }],
    materialRequests: [{
      id: "req_delivered_ignored",
      approvalStatus: "aprovado",
      almoxExitId: "almox_exit_ignored",
      deliveredQuantity: 10,
      deliveredBy: "Almoxarife",
      deliveredAt: "2026-06-07T12:00:00.000Z",
      deliveryStatus: "entregue",
      requestedName: "Cimento",
      requestedQuantity: 10,
      requestedUnit: "saco"
    }]
  }];

  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);

  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, "consumo_rdo");
  assert.equal(movements[0].quantity, 3);
  assert.notEqual(movements[0].quantity, dailyLogs[0].materialRequests[0].deliveredQuantity);
});

test("RDO antigo sem materialRequests continua gerando movimento", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_legacy_1",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [{
      id: "mat_legacy_1",
      name: "Areia",
      quantity: 1.5,
      unit: "m3",
      unitValue: 120,
      totalValue: 180,
      note: "Consumo real legado"
    }]
  }];

  assert.doesNotThrow(() => buildStockMovementsFromDailyLogs_(dailyLogs));

  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, "consumo_rdo");
  assert.equal(movements[0].quantity, 1.5);
  assert.equal(movements[0].name, "Areia");
});

test("RDO materialRequests nao participa da origem da baixa derivada", () => {
  const { buildStockMovementsFromDailyLogs_ } = loadRdoMovementHooks_();
  const dailyLogs = [{
    id: "rdo_balance_guard",
    workId: "obra_1",
    date: "2026-06-07",
    materials: [],
    materialRequests: [{
      id: "req_balance_guard",
      requestedName: "Cimento",
      requestedQuantity: 99,
      requestedUnit: "saco",
      status: "simulado"
    }]
  }];

  const movements = buildStockMovementsFromDailyLogs_(dailyLogs);
  const rdoConsumptionQuantity = movements
    .filter((movement) => movement.type === "consumo_rdo")
    .reduce((sum, movement) => sum + movement.quantity, 0);

  assert.equal(rdoConsumptionQuantity, 0);
  assert.equal(movements.length, 0);
});

test("buildStockMovementsFromDailyLogs nao le materialRequests ou requestedQuantity", () => {
  assert.doesNotMatch(buildMovementsBlock, /materialRequests/);
  assert.doesNotMatch(buildMovementsBlock, /requestedQuantity/);
  assert.doesNotMatch(buildMovementsBlock, /deliveredQuantity/);
  assert.doesNotMatch(buildMovementsBlock, /almoxExitId/);
});

test("entrega de materialRequest aprovada valida somente com item e saldo suficiente", () => {
  const { validateRdoMaterialRequestDelivery_ } = loadRdoDeliveryHooks_();
  const result = validateRdoMaterialRequestDelivery_(
    {
      id: "req_delivery_valid",
      approvalStatus: "aprovado",
      almoxItemId: "almox_item_1"
    },
    { deliveredQuantity: 10 },
    { itemExists: true, availableQuantity: 12 }
  );

  assert.equal(result.ok, true);
  assert.equal(result.deliveredQuantity, 10);
});

test("entrega de materialRequest bloqueia solicitacao nao aprovada", () => {
  const { validateRdoMaterialRequestDelivery_ } = loadRdoDeliveryHooks_();
  const result = validateRdoMaterialRequestDelivery_(
    {
      id: "req_delivery_pending",
      approvalStatus: "pendente",
      almoxItemId: "almox_item_1"
    },
    { deliveredQuantity: 10 },
    { itemExists: true, availableQuantity: 12 }
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /aprovadas/);
});

test("entrega de materialRequest bloqueia dupla entrega com almoxExitId", () => {
  const { validateRdoMaterialRequestDelivery_ } = loadRdoDeliveryHooks_();
  const result = validateRdoMaterialRequestDelivery_(
    {
      id: "req_delivery_duplicate",
      approvalStatus: "aprovado",
      almoxItemId: "almox_item_1",
      almoxExitId: "almmov_existente"
    },
    { deliveredQuantity: 10 },
    { itemExists: true, availableQuantity: 12 }
  );

  assert.equal(result.ok, false);
  assert.match(result.message, /ja possui entrega/);
});

test("entrega de materialRequest bloqueia item ausente e saldo insuficiente", () => {
  const { validateRdoMaterialRequestDelivery_ } = loadRdoDeliveryHooks_();

  const missingItem = validateRdoMaterialRequestDelivery_(
    {
      id: "req_delivery_missing_item",
      approvalStatus: "aprovado"
    },
    { deliveredQuantity: 10 },
    { itemExists: true, availableQuantity: 12 }
  );

  const insufficientStock = validateRdoMaterialRequestDelivery_(
    {
      id: "req_delivery_no_stock",
      approvalStatus: "aprovado",
      almoxItemId: "almox_item_1"
    },
    { deliveredQuantity: 10 },
    { itemExists: true, availableQuantity: 5 }
  );

  assert.equal(missingItem.ok, false);
  assert.match(missingItem.message, /Vincule um item/);
  assert.equal(insufficientStock.ok, false);
  assert.match(insufficientStock.message, /Saldo insuficiente/);
});

test("saida oficial da entrega do RDO e movimento exclusivo do Almoxarifado", () => {
  const { buildRdoMaterialRequestAlmoxExitMovement_ } = loadRdoDeliveryHooks_();
  const movement = buildRdoMaterialRequestAlmoxExitMovement_(
    {
      id: "req_delivery_build",
      almoxItemId: "almox_item_1",
      productionId: "prod_1",
      requestedQuantity: 20,
      approvedQuantity: 18
    },
    {
      deliveredQuantity: 10,
      responsible: "Almoxarife",
      recipient: "Equipe alvenaria",
      sector: "Obra",
      purpose: "Alvenaria 42 m2",
      notes: "Entrega parcial"
    },
    {
      id: "almmov_test_1",
      environmentId: "env_1",
      dailyLogId: "dia_1",
      workId: "obra_1",
      now: "2026-06-07T12:00:00.000Z",
      movementDate: "2026-06-07",
      movementTime: "12:00"
    }
  );

  assert.equal(movement.id, "almmov_test_1");
  assert.equal(movement.environmentId, "env_1");
  assert.equal(movement.itemId, "almox_item_1");
  assert.equal(movement.type, "saida");
  assert.equal(movement.source, "rdo_material_request");
  assert.equal(movement.quantity, 10);
  assert.equal(movement.dailyLogId, "dia_1");
  assert.equal(movement.materialRequestId, "req_delivery_build");
  assert.equal(movement.workId, "obra_1");
  assert.equal(movement.productionId, "prod_1");
  assert.equal(movement.requestedQuantity, 20);
  assert.equal(movement.approvedQuantity, 18);
  assert.equal(Object.hasOwn(movement, "materials"), false);
  assert.notEqual(movement.type, "consumo_rdo");
});

test("status da entrega do RDO diferencia parcial e total", () => {
  const { getRdoMaterialRequestDeliveryStatus_ } = loadRdoDeliveryHooks_();

  assert.equal(
    getRdoMaterialRequestDeliveryStatus_({ requestedQuantity: 10, approvedQuantity: 10 }, 5),
    "entregue_parcial"
  );
  assert.equal(
    getRdoMaterialRequestDeliveryStatus_({ requestedQuantity: 10, approvedQuantity: 10 }, 10),
    "entregue"
  );
  assert.equal(
    getRdoMaterialRequestDeliveryStatus_({ requestedQuantity: 10 }, 10),
    "entregue"
  );
});

function loadRdoMovementHooks_() {
  let generatedId = 0;
  const sandbox = {
    clean: (value) => String(value || "").trim(),
    createId_: (prefix) => prefix + "_test_" + (++generatedId),
    getWorkName_: (workId) => workId === "obra_1" ? "Obra Teste" : "",
    normalizeStockMaterialKey_: (name, unit) => normalizeKey_(name) + "|" + normalizeKey_(unit || "un"),
    parseNumber_: (value) => {
      const number = Number(String(value || "0").replace(",", "."));
      return Number.isFinite(number) ? number : 0;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(buildMovementsBlock, sandbox);
  return {
    buildStockMovementsFromDailyLogs_: sandbox.buildStockMovementsFromDailyLogs_
  };
}

function loadRdoDeliveryHooks_() {
  let generatedId = 0;
  const sandbox = {
    clean: (value) => String(value || "").trim(),
    createId_: (prefix) => prefix + "_test_" + (++generatedId),
    getDefaultAlmoxMovementDate_: () => "2026-06-07",
    getDefaultAlmoxMovementTime_: () => "12:00",
    buildAlmoxMovementDateTime_: (dateValue, timeValue) => {
      const date = String(dateValue || "2026-06-07").trim();
      const time = String(timeValue || "12:00").trim();
      return date + "T" + time + ":00";
    },
    parseNumber_: (value) => {
      const number = Number(String(value || "0").replace(",", "."));
      return Number.isFinite(number) ? number : 0;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(deliveryHelperBlock, sandbox);
  return {
    validateRdoMaterialRequestDelivery_: sandbox.validateRdoMaterialRequestDelivery_,
    buildRdoMaterialRequestAlmoxExitMovement_: sandbox.buildRdoMaterialRequestAlmoxExitMovement_,
    getRdoMaterialRequestDeliveryStatus_: sandbox.getRdoMaterialRequestDeliveryStatus_
  };
}

function extractFunctionBlock_(source, functionName) {
  const start = source.indexOf("function " + functionName);
  assert.notEqual(start, -1, "Funcao " + functionName + " nao encontrada.");

  const nextFunction = source.indexOf("\n  function ", start + 1);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}

function normalizeKey_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clone_(value) {
  return JSON.parse(JSON.stringify(value));
}
