const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const repo = path.resolve(__dirname, "..", "..");

function loadBridge() {
  const source = readFileSync(path.join(repo, "relatorio-qualidade-obras", "elo-command-bridge.js"), "utf8");
  const storage = new Map();
  const sandbox = {
    window: {
      localStorage: {
        get length() {
          return storage.size;
        },
        key(index) {
          return Array.from(storage.keys())[index] || null;
        },
        getItem(key) {
          return storage.has(key) ? storage.get(key) : null;
        },
        setItem(key, value) {
          storage.set(key, String(value));
        }
      }
    }
  };
  sandbox.window.window = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.window;
}

test("EloCommandBridge expõe contrato central sem CADISTA", () => {
  const window = loadBridge();
  assert.equal(typeof window.EloCommandBridge.execute, "function");
  assert.deepEqual(Array.from(window.EloCommandBridge.modules), [
    "budget",
    "obrareport_rdo",
    "obrareport_report",
    "stock_full",
    "stock_obras",
    "memory",
    "alerts"
  ]);
  assert.equal(window.EloCommandBridge.modules.includes("cadista"), false);
});

test("EloCommandBridge retorna preview e confirmação para ações perigosas", () => {
  const window = loadBridge();
  const response = window.EloCommandBridge.execute({
    module: "stock_full",
    action: "stock_exit",
    payload: { message: "registre saída de 12 sacos para a obra A" },
    dryRun: true
  });
  assert.equal(response.handled, true);
  assert.equal(response.module, "stock_full");
  assert.equal(response.mode, "preview");
  assert.equal(response.requiresConfirmation, true);
  assert.match(response.humanAnswer, /preview|confirma/i);
  assert.doesNotMatch(JSON.stringify(response), /sessionIntent|sessionTheme|Ready for cost|Auditoria t/i);
});

test("EloCommandBridge consulta módulos de leitura sem fingir escrita", () => {
  const window = loadBridge();
  window.localStorage.setItem("elo_budget_records", JSON.stringify([{ numero: "ELO-1", status: "rascunho" }]));
  const budget = window.EloCommandBridge.execute({
    module: "budget",
    action: "list",
    payload: { message: "listar orçamentos" },
    dryRun: true
  });
  assert.equal(budget.handled, true);
  assert.equal(budget.requiresConfirmation, false);
  assert.match(budget.humanAnswer, /orçamento|orcamento/i);

  const stockObras = window.EloCommandBridge.execute({
    module: "stock_obras",
    action: "search_composition",
    payload: { message: "pesquise composição SINAPI para alvenaria" },
    dryRun: true
  });
  assert.equal(stockObras.handled, true);
  assert.equal(stockObras.requiresConfirmation, false);
  assert.match(stockObras.humanAnswer, /bases locais|compos/i);
});

test("EloCommandBridge está carregado nas superfícies ELO sem tocar CADISTA", () => {
  const elo = readFileSync(path.join(repo, "elo.html"), "utf8");
  const stockObras = readFileSync(path.join(repo, "stock-ai-obras.html"), "utf8");
  const obraReport = readFileSync(path.join(repo, "relatorio-qualidade-obras", "relatorio-qualidade-obras.html"), "utf8");
  const cadista = readFileSync(path.join(repo, "cadista", "index.html"), "utf8");
  assert.match(elo, /elo-command-bridge\.js/);
  assert.match(stockObras, /elo-command-bridge\.js/);
  assert.match(obraReport, /elo-command-bridge\.js/);
  assert.doesNotMatch(cadista, /elo-command-bridge\.js/);
});
