import assert from "node:assert/strict";
import { test } from "node:test";
import { createContext, runInContext } from "node:vm";
import { readFileSync } from "node:fs";

function createStorage_() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); },
    clear() { data.clear(); }
  };
}

function createElementStub_() {
  return {
    appendChild() {},
    addEventListener() {},
    setAttribute() {},
    removeAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    style: {},
    dataset: {},
    textContent: "",
    value: ""
  };
}

function loadEloStockEntrySandbox_(options = {}) {
  const validatorContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-technical-validator.js", import.meta.url), "utf8");
  const stockEngineContent = readFileSync(new URL("../../relatorio-qualidade-obras/stock-ai-composition-engine.js", import.meta.url), "utf8");
  const eloContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const balances = (options.balances || [
    { itemId: "item-cimento", id: "item-cimento", sku: "CIM-001", name: "Cimento", unit: "saco", balance: 42, realBalance: 42, minimumStock: 10 },
    { itemId: "item-mascara", id: "item-mascara", sku: "MAS-001", name: "Mascara", unit: "un", balance: 5, realBalance: 5 },
    { itemId: "item-tinta", id: "item-tinta", sku: "TIN-001", name: "Tinta Acrilica", unit: "lata", balance: 10, realBalance: 10 }
  ]).map((item) => ({ ...item }));
  const movements = [];
  const calls = [];
  const element = createElementStub_();
  const sandbox = {
    console,
    setTimeout() {},
    clearTimeout() {},
    Math,
    Date,
    JSON,
    RegExp,
    Number,
    String,
    Array,
    Object,
    URLSearchParams,
    location: { hostname: "127.0.0.1", protocol: "http:", pathname: "/relatorio-qualidade-obras/relatorio-qualidade-obras.html", search: "", hash: "#app/almoxarifado" },
    localStorage: createStorage_(),
    sessionStorage: createStorage_(),
    document: {
      body: { dataset: {}, getAttribute() { return ""; }, appendChild() {} },
      readyState: "complete",
      addEventListener() {},
      getElementById() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      createElement() { return { ...element }; }
    },
    navigator: {},
    fetch: async () => ({ ok: false, json: async () => ({}) })
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.ELO_SKIP_AUTO_WIDGET = true;
  sandbox.ObraReportOperationalStock = {
    getAlmoxBalances() {
      return balances.map((item) => ({ ...item }));
    },
    getAlmoxMovements() {
      return movements.map((movement) => ({ ...movement }));
    },
    createConfirmedEntry(payload) {
      calls.push({ ...payload });
      if (options.blockEntry) return { ok: false, message: options.blockMessage || "Usuario sem permissao para registrar entrada." };
      const item = balances.find((candidate) => candidate.itemId === payload.itemId || candidate.id === payload.itemId);
      if (!item) return { ok: false, message: "Item nao encontrado no Almoxarifado." };
      const before = Number(item.balance || item.realBalance || 0);
      const quantity = Number(payload.quantity || 0);
      item.balance = before + quantity;
      item.realBalance = item.balance;
      const movement = { id: "mov-" + calls.length, type: "entrada", itemId: item.itemId, quantity, unit: item.unit, material: item.name, balanceAfter: item.balance };
      movements.unshift(movement);
      return { ok: true, entryId: payload.entryId, itemId: item.itemId, quantity, unit: item.unit, balanceBefore: before, balanceAfter: item.balance, movement, movements: [movement], before: [], after: balances.map((entry) => ({ ...entry })) };
    }
  };
  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  runInContext(stockEngineContent, sandbox);
  runInContext(eloContent, sandbox);
  return { sandbox, balances, movements, calls };
}

test("Elo parseia comandos de entrada sem acionar escrita", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_();
  const parse = sandbox.window.EloAssistente.parseStockEntryCommandForTest;

  assert.deepEqual(JSON.parse(JSON.stringify(parse("registre entrada de 30 sacos de cimento"))), { type: "entrada", quantity: 30, unit: "saco", originalUnit: "sacos", productQuery: "cimento", sourceMessage: "registre entrada de 30 sacos de cimento" });
  assert.equal(parse("adicione 20 unidades de máscara").quantity, 20);
  assert.equal(parse("adicione 20 unidades de máscara").unit, "un");
  assert.equal(parse("deram entrada 50 latas de tinta").productQuery, "tinta");
  assert.equal(parse("cadastre 30 sacos de cimento"), null);
  assert.equal(calls.length, 0);
});

test("Elo mostra preview, confirma uma entrada real e bloqueia dupla confirmacao", () => {
  const { sandbox, calls, balances } = loadEloStockEntrySandbox_();

  const preview = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 30 sacos de cimento");
  assert.equal(preview.sessionIntent, "stock_entry_preview");
  assert.match(preview.fullAnswer, /Entrada no Stock/);
  assert.match(preview.fullAnswer, /Saldo atual: 42 saco/);
  assert.match(preview.fullAnswer, /Saldo previsto: 72 saco/);
  assert.equal(calls.length, 0);

  const confirmed = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("sim");
  assert.equal(confirmed.sessionIntent, "stock_entry_confirmed");
  assert.match(confirmed.fullAnswer, /Entrada registrada no Stock/);
  assert.match(confirmed.fullAnswer, /Novo saldo: 72 saco/);
  assert.equal(calls.length, 1);
  assert.equal(balances.find((item) => item.itemId === "item-cimento").balance, 72);

  const repeated = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("confirmar");
  assert.equal(repeated.sessionIntent, "stock_entry_idempotent");
  assert.equal(calls.length, 1);
});

test("Elo resolve entrada por SKU exato", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_();
  const preview = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 2 sacos de CIM-001");

  assert.equal(preview.sessionIntent, "stock_entry_preview");
  assert.match(preview.fullAnswer, /Produto: Cimento/);
  sandbox.window.EloAssistente.buildStockEntryAnswerForTest("pode registrar");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].itemId, "item-cimento");
});

test("Elo pede escolha quando o produto e ambiguo", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_({ balances: [
    { itemId: "c1", id: "c1", sku: "CIM-001", name: "Cimento CP II", unit: "saco", balance: 10 },
    { itemId: "c2", id: "c2", sku: "CIM-002", name: "Cimento CP V", unit: "saco", balance: 20 }
  ] });

  const preview = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de cimento");
  assert.equal(preview.sessionIntent, "stock_entry_ambiguous");
  assert.match(preview.fullAnswer, /Qual deles/);
  assert.equal(calls.length, 0);
});

test("Elo bloqueia produto inexistente, quantidade invalida e unidade incompativel", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_();

  assert.equal(sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de areia").sessionIntent, "stock_entry_blocked");
  assert.match(sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 0 sacos de cimento").fullAnswer, /Quantidade invalida/);
  assert.match(sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de -1 sacos de cimento").fullAnswer, /Quantidade invalida/);
  assert.match(sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 latas de cimento").fullAnswer, /Unidade incompatível/);
  assert.equal(calls.length, 0);
});

test("Elo cancela entrada pendente sem escrever", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_();

  sandbox.window.EloAssistente.buildStockEntryAnswerForTest("adicione 20 unidades de máscara");
  const cancelled = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("cancelar");
  assert.equal(cancelled.sessionIntent, "stock_entry_cancelled");
  assert.equal(calls.length, 0);
  assert.equal(sandbox.window.EloAssistente.getPendingStockEntryForTest(), null);
});

test("Elo propaga bloqueio de permissao movements:in da ponte oficial", () => {
  const { sandbox, calls, balances } = loadEloStockEntrySandbox_({ blockEntry: true });

  sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 30 sacos de cimento");
  const blocked = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("sim");
  assert.equal(blocked.sessionIntent, "stock_entry_blocked");
  assert.match(blocked.fullAnswer, /sem permissao|sem permiss.o/i);
  assert.equal(calls.length, 1);
  assert.equal(balances.find((item) => item.itemId === "item-cimento").balance, 42);
});

test("Elo mantem saida bloqueada e preserva Stock Read e cadastro", () => {
  const { sandbox, calls } = loadEloStockEntrySandbox_();

  const exit = sandbox.window.EloAssistente.buildResponseForTest("retire 10 sacos de cimento");
  assert.equal(exit.sessionIntent, "stock_full_exit_blocked");
  assert.match(exit.fullAnswer, /Saida pelo ELO ainda nao esta habilitada/);
  assert.equal(calls.length, 0);

  const balance = sandbox.window.EloAssistente.buildResponseForTest("qual saldo do cimento no estoque?");
  assert.equal(balance.sessionIntent, "stock_full_saldo");
  assert.match(balance.fullAnswer, /42 saco/);

  assert.equal(sandbox.window.EloAssistente.parseStockProductCreateCommandForTest("registre entrada de 30 sacos de cimento"), null);
});

test("contrato local exporta wrapper de entrada e Elo nao escreve direto no Stock", () => {
  const eloSource = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const reportSource = readFileSync(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.js", import.meta.url), "utf8");

  assert.match(reportSource, /function createConfirmedOperationalEntry_\(payload\)[\s\S]*saveAlmoxEntryFromFormData_\(formData\)/);
  assert.match(reportSource, /requireStockFullPermission_\("movements:in"/);
  assert.match(reportSource, /createConfirmedEntry:\s*createConfirmedOperationalEntry_/);
  assert.doesNotMatch(eloSource, /saveAlmoxState_/);
  assert.doesNotMatch(eloSource, /state\.movements|movements\.push/);
});