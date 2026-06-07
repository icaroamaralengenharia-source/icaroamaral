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
