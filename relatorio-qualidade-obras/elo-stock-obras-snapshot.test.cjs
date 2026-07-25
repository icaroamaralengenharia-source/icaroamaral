const assert = require("node:assert/strict");
const test = require("node:test");
const snapshotModulePromise = import("./elo-stock-obras-snapshot.js");

function createStorage(initial = {}) {
  const data = Object.assign({}, initial);
  return {
    writes: 0,
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    },
    setItem() {
      this.writes += 1;
      throw new Error("write_not_allowed");
    },
    removeItem() {
      this.writes += 1;
      throw new Error("write_not_allowed");
    }
  };
}

test("le movimentos e saldo reais simulados sem escrever", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const localStorage = createStorage();
  const result = buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    localStorage,
    obraReport: {
      dailyLogs: [{
        projectId: "obra-a",
        workId: "serv-alvenaria",
        productions: [{ serviceId: "alvenaria-bloco", service: "Alvenaria", quantity: 100, unit: "m2" }]
      }],
      stockMovements: [{ projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Bloco ceramico", unit: "un", quantity: 2500 }]
    },
    operationalStock: {
      getAlmoxBalances() {
        return [{ projectId: "obra-a", workId: "serv-alvenaria", item: { name: "Bloco ceramico", unit: "un" }, balance: 120 }];
      }
    }
  });

  assert.equal(result.productions.length, 1);
  assert.equal(result.stockMovements[0].quantity, 2500);
  assert.equal(result.stockBalances[0].balance, 120);
  assert.equal(result.sourcesUsed.rdos, true);
  assert.equal(result.sourcesUsed.stockMovements, true);
  assert.equal(result.sourcesUsed.stockBalances, true);
  assert.equal(localStorage.writes, 0);
});

test("le plannedConsumptions existente sem inventar coeficiente", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const result = buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    localStorage: createStorage({
      "obraReport.stockIa.plannedConsumptions": JSON.stringify([
        { projectId: "obra-a", workId: "serv-alvenaria", serviceId: "alvenaria-bloco", material: "Argamassa", unit: "kg", coefficient: 18 },
        { projectId: "obra-a", workId: "serv-alvenaria", serviceId: "alvenaria-bloco", material: "Sem coeficiente", unit: "kg" }
      ])
    })
  });

  assert.equal(result.sinapiExpectedConsumptions.length, 1);
  assert.equal(result.sinapiExpectedConsumptions[0].material, "Argamassa");
  assert.equal(result.sinapiExpectedConsumptions[0].coefficient, 18);
});

test("filtra tudo por workId e projectId", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const result = buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-a",
    localStorage: createStorage(),
    obraReport: {
      dailyLogs: [
        { projectId: "obra-a", workId: "serv-a", productions: [{ service: "Alvenaria", quantity: 100, unit: "m2" }] },
        { projectId: "obra-a", workId: "serv-b", productions: [{ service: "Pintura", quantity: 900, unit: "m2" }] }
      ],
      stockMovements: [
        { projectId: "obra-a", workId: "serv-a", type: "saida", material: "Bloco", unit: "un", quantity: 2500 },
        { projectId: "obra-a", workId: "serv-b", type: "saida", material: "Tinta", unit: "l", quantity: 90 }
      ],
      stockIa: {
        plannedConsumptions: [
          { projectId: "obra-a", workId: "serv-a", material: "Bloco", unit: "un", coefficient: 25 },
          { projectId: "obra-a", workId: "serv-b", material: "Tinta", unit: "l", coefficient: 0.3 }
        ]
      }
    },
    operationalStock: {
      getAlmoxBalances() {
        return [
          { projectId: "obra-a", workId: "serv-a", material: "Bloco", unit: "un", balance: 100 },
          { projectId: "obra-a", workId: "serv-b", material: "Tinta", unit: "l", balance: 10 }
        ];
      }
    }
  });

  assert.deepEqual(result.productions.map((item) => item.service), ["Alvenaria"]);
  assert.deepEqual(result.stockMovements.map((item) => item.material), ["Bloco"]);
  assert.deepEqual(result.stockBalances.map((item) => item.item.name), ["Bloco"]);
  assert.deepEqual(result.sinapiExpectedConsumptions.map((item) => item.material), ["Bloco"]);
});

test("obra A nao mistura B", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const result = buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    localStorage: createStorage({
      "obraReport.stockIa.plannedConsumptions": JSON.stringify([
        { projectId: "obra-b", workId: "serv-alvenaria", material: "Bloco", unit: "un", coefficient: 99 }
      ])
    }),
    obraReport: {
      dailyLogs: [
        { projectId: "obra-a", workId: "serv-alvenaria", productions: [{ service: "Alvenaria", quantity: 100, unit: "m2" }] },
        { projectId: "obra-b", workId: "serv-alvenaria", productions: [{ service: "Alvenaria", quantity: 500, unit: "m2" }] }
      ],
      stockMovements: [
        { projectId: "obra-a", workId: "serv-alvenaria", type: "saida", material: "Bloco", unit: "un", quantity: 2500 },
        { projectId: "obra-b", workId: "serv-alvenaria", type: "saida", material: "Bloco", unit: "un", quantity: 9000 }
      ]
    },
    operationalStock: {
      getAlmoxBalances() {
        return [
          { projectId: "obra-a", workId: "serv-alvenaria", material: "Bloco", unit: "un", balance: 100 },
          { projectId: "obra-b", workId: "serv-alvenaria", material: "Bloco", unit: "un", balance: -999 }
        ];
      }
    }
  });

  assert.equal(result.productions[0].quantity, 100);
  assert.equal(result.stockMovements[0].quantity, 2500);
  assert.equal(result.stockBalances[0].balance, 100);
  assert.equal(result.sinapiExpectedConsumptions.length, 0);
});

test("fonte ausente nao inventa dados e reduz qualidade", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const result = buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-alvenaria",
    localStorage: createStorage()
  });

  assert.deepEqual(result.productions, []);
  assert.deepEqual(result.stockMovements, []);
  assert.deepEqual(result.stockBalances, []);
  assert.deepEqual(result.sinapiExpectedConsumptions, []);
  assert.equal(result.dataQuality.level, "low");
  assert.deepEqual(result.dataQuality.missingSources, ["rdos", "stockMovements", "stockBalances", "plannedConsumptions"]);
});

test("nenhuma escrita e executada ao ler localStorage", async () => {
  const { buildEloStockObrasSnapshot } = await snapshotModulePromise;
  const localStorage = createStorage({
    obraReportAlmoxarifadoData: JSON.stringify({ items: [{ projectId: "obra-a", workId: "serv-a", name: "Cimento", unit: "sc", balance: 3 }] }),
    obrareport_stock_master_v1: JSON.stringify({ items: [{ projectId: "obra-a", workId: "serv-a", name: "Cimento", unit: "sc", balance: 9 }] }),
    "obraReport.stockIa.plannedConsumptions": JSON.stringify([{ projectId: "obra-a", workId: "serv-a", material: "Cimento", unit: "sc", coefficient: 0.1 }])
  });

  buildEloStockObrasSnapshot({
    projectId: "obra-a",
    workId: "serv-a",
    localStorage
  });

  assert.equal(localStorage.writes, 0);
}
);
