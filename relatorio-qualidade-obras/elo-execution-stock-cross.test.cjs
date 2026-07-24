const assert = require("node:assert/strict");
const test = require("node:test");
const crossModulePromise = import("./elo-execution-stock-cross.js");

test("cruza execucao, almoxarifado e consumo SINAPI sem misturar obras", async () => {
  const { crossExecutionWithStock } = await crossModulePromise;
  const result = crossExecutionWithStock({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    productions: [
      {
        projectId: "obra-a",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        service: "Alvenaria de vedacao",
        quantity: 100,
        unit: "m2"
      },
      {
        projectId: "obra-b",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        service: "Alvenaria de vedacao",
        quantity: 500,
        unit: "m2"
      }
    ],
    sinapiExpectedConsumptions: [
      {
        projectId: "obra-a",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        material: "Bloco ceramico 9x19x19",
        unit: "un",
        coefficient: 25
      },
      {
        projectId: "obra-a",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        material: "Argamassa industrializada",
        unit: "kg",
        coefficient: 18
      },
      {
        projectId: "obra-a",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        material: "Tela galvanizada",
        unit: "m",
        coefficient: 0.4
      },
      {
        projectId: "obra-a",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        material: "Vergalhao CA-50",
        unit: "kg",
        coefficient: 2
      },
      {
        projectId: "obra-b",
        workId: "serv-alvenaria",
        serviceId: "alvenaria-bloco",
        material: "Bloco ceramico 9x19x19",
        unit: "un",
        coefficient: 99
      }
    ],
    stockMovements: [
      { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico 9x19x19", unit: "un", quantity: 2600 },
      { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Argamassa industrializada", unit: "kg", quantity: 1200 },
      { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Vergalhao CA-50", unit: "kg", quantity: 200 },
      { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Madeira de forma", unit: "m2", quantity: 12 },
      { projectId: "obra-b", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico 9x19x19", unit: "un", quantity: 9000 }
    ],
    stockBalances: [
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Bloco ceramico 9x19x19", unit: "un" }, balance: 50 },
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Argamassa industrializada", unit: "kg" }, balance: 300 },
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Tela galvanizada", unit: "m" }, balance: 15 },
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Vergalhao CA-50", unit: "kg" }, balance: -5 },
      { projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Madeira de forma", unit: "m2" }, balance: 20 },
      { projectId: "obra-b", workId: "serv-alvenaria", item: { name: "Bloco ceramico 9x19x19", unit: "un" }, balance: 8000 }
    ]
  });

  assert.equal(result.summary.projectId, "obra-a");
  assert.equal(result.summary.workId, "serv-alvenaria");
  assert.equal(result.dataQuality.hasProductions, true);
  assert.equal(result.dataQuality.hasSinapiExpectedConsumptions, true);

  const byMaterial = Object.fromEntries(result.materials.map((item) => [item.material, item]));

  assert.equal(byMaterial["Bloco ceramico 9x19x19"].expectedConsumption, 2500);
  assert.equal(byMaterial["Bloco ceramico 9x19x19"].actualStockExit, 2600);
  assert.equal(byMaterial["Bloco ceramico 9x19x19"].difference, 100);
  assert.equal(byMaterial["Bloco ceramico 9x19x19"].status, "consumption_above_expected");

  assert.equal(byMaterial["Argamassa industrializada"].expectedConsumption, 1800);
  assert.equal(byMaterial["Argamassa industrializada"].actualStockExit, 1200);
  assert.equal(byMaterial["Argamassa industrializada"].difference, -600);
  assert.equal(byMaterial["Argamassa industrializada"].status, "consumption_below_expected");

  assert.equal(byMaterial["Tela galvanizada"].expectedConsumption, 40);
  assert.equal(byMaterial["Tela galvanizada"].actualStockExit, 0);
  assert.equal(byMaterial["Tela galvanizada"].status, "production_without_stock_exit");

  assert.equal(byMaterial["Vergalhao CA-50"].expectedConsumption, 200);
  assert.equal(byMaterial["Vergalhao CA-50"].currentBalance, -5);
  assert.equal(byMaterial["Vergalhao CA-50"].status, "insufficient_balance");

  assert.equal(byMaterial["Madeira de forma"].expectedConsumption, 0);
  assert.equal(byMaterial["Madeira de forma"].actualStockExit, 12);
  assert.equal(byMaterial["Madeira de forma"].status, "stock_exit_without_production");

  assert.equal(result.materials.some((item) => item.actualStockExit === 9000), false);
  assert.equal(result.alerts.length, 5);
  assert.deepEqual(new Set(result.alerts.map((alert) => alert.status)), new Set([
    "consumption_above_expected",
    "consumption_below_expected",
    "production_without_stock_exit",
    "insufficient_balance",
    "stock_exit_without_production"
  ]));
});

test("marca missing_reference quando ha producao sem consumo SINAPI recebido", async () => {
  const { crossExecutionWithStock } = await crossModulePromise;
  const result = crossExecutionWithStock({
    projectId: "obra-a",
    workId: "serv-pintura",
    productions: [{ projectId: "obra-a", workId: "serv-pintura", serviceId: "pintura", quantity: 30 }],
    stockMovements: [],
    stockBalances: [{ projectId: "obra-a", workId: "serv-pintura", material: "Tinta acrilica", unit: "l", balance: 18 }],
    sinapiExpectedConsumptions: []
  });

  assert.equal(result.materials.length, 1);
  assert.equal(result.materials[0].material, "Tinta acrilica");
  assert.equal(result.materials[0].status, "missing_reference");
  assert.equal(result.dataQuality.hasSinapiExpectedConsumptions, false);
});
