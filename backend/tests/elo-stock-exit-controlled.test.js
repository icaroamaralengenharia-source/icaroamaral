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

function clone_(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadEloStockExitSandbox_(options = {}) {
  const validatorContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-technical-validator.js", import.meta.url), "utf8");
  const stockEngineContent = readFileSync(new URL("../../relatorio-qualidade-obras/stock-ai-composition-engine.js", import.meta.url), "utf8");
  const eloContent = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const balances = (options.balances || [
    { itemId: "item-cimento", id: "item-cimento", sku: "CIM-001", fiscalCode: "CIM-001", name: "Cimento Teste ELO Saida", unit: "saco", balance: 10, realBalance: 10, minimumStock: 1, companyId: "company-a", environmentId: "env-a" },
    { itemId: "item-mascara", id: "item-mascara", sku: "MAS-001", name: "Mascara", unit: "un", balance: 5, realBalance: 5, companyId: "company-a", environmentId: "env-a" }
  ]).map((item) => ({ ...item }));
  const movements = [];
  const audit = [];
  const entryCalls = [];
  const exitCalls = [];
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
      entryCalls.push({ ...payload });
      const item = balances.find((candidate) => candidate.itemId === payload.itemId || candidate.id === payload.itemId);
      if (!item) return { ok: false, message: "Item nao encontrado no Almoxarifado." };
      const before = Number(item.balance || item.realBalance || 0);
      const quantity = Number(payload.quantity || 0);
      item.balance = before + quantity;
      item.realBalance = item.balance;
      const movement = { id: "mov-entry-" + entryCalls.length, type: "entrada", itemId: item.itemId, quantity, unit: item.unit, material: item.name, balanceAfter: item.balance };
      movements.unshift(movement);
      return { ok: true, entryId: payload.entryId, itemId: item.itemId, quantity, unit: item.unit, balanceBefore: before, balanceAfter: item.balance, movement, movements: [movement], before: [], after: balances.map((entry) => ({ ...entry })) };
    },
    createConfirmedExit(payload) {
      exitCalls.push(clone_(payload));
      if (options.blockExit) return { ok: false, message: options.blockMessage || "Usuario sem permissao para registrar saida." };
      const releaseId = String(payload.releaseId || "");
      const duplicate = movements.filter((movement) => movement.type === "saida" && movement.releaseId === releaseId && movement.origin === "elo_release");
      if (duplicate.length) return { ok: true, duplicate: true, releaseId, before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: duplicate.map((item) => ({ ...item })) };
      const before = balances.map((item) => ({ ...item }));
      const created = [];
      for (const requested of payload.items || []) {
        const itemId = requested.stockItemId || requested.itemId;
        const item = balances.find((candidate) => candidate.itemId === itemId || candidate.id === itemId);
        const quantity = Number(requested.releaseQuantity || requested.quantity || 0);
        if (!item || quantity <= 0) return { ok: false, message: "Item ou quantidade invalida.", before, after: balances.map((entry) => ({ ...entry })), movements: [] };
        if (requested.unit && requested.unit !== item.unit) return { ok: false, message: "Unidade informada diferente da unidade cadastrada.", before, after: balances.map((entry) => ({ ...entry })), movements: [] };
        const available = Number(item.balance || item.realBalance || 0);
        if (quantity > available) return { ok: false, message: "Saida bloqueada para evitar saldo negativo.", before, after: balances.map((entry) => ({ ...entry })), movements: [] };
        item.balance = available - quantity;
        item.realBalance = item.balance;
        const movement = { id: "mov-exit-" + exitCalls.length, type: "saida", itemId: item.itemId, productId: item.itemId, quantity, unit: item.unit, material: item.name, balanceAfter: item.balance, releaseId, origin: "elo_release", source: payload.source || "elo" };
        movements.unshift(movement);
        audit.unshift({ action: "movement_out_created", entityType: "stock_movements", entityId: movement.id, metadata: { itemId: item.itemId, quantity } });
        created.push(movement);
      }
      return { ok: true, releaseId, before, after: balances.map((entry) => ({ ...entry })), movements: created, history: created };
    }
  };
  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  runInContext(stockEngineContent, sandbox);
  runInContext(eloContent, sandbox);
  return { sandbox, balances, movements, audit, entryCalls, exitCalls };
}

test("Elo parseia comandos de saida direta sem acionar escrita", () => {
  const { sandbox, exitCalls } = loadEloStockExitSandbox_();
  const parse = sandbox.window.EloAssistente.parseStockExitCommandForTest;

  assert.deepEqual(JSON.parse(JSON.stringify(parse("retire 5 sacos de Cimento Teste ELO Saida"))), { action: "stock_exit", quantity: 5, unit: "saco", originalUnit: "sacos", productQuery: "cimento teste elo saida", sourceMessage: "retire 5 sacos de Cimento Teste ELO Saida" });
  assert.equal(parse("registre saída de 5 sacos de Cimento Teste ELO Saida").quantity, 5);
  assert.equal(parse("dê baixa em 5 sacos de Cimento Teste ELO Saida").unit, "saco");
  assert.equal(parse("baixe 5 sacos de Cimento Teste ELO Saida").productQuery, "cimento teste elo saida");
  assert.equal(parse("cadastre 5 sacos de Cimento Teste ELO Saida"), null);
  assert.equal(exitCalls.length, 0);
});

test("Elo mostra preview de saida sem escrita e confirma uma saida real", () => {
  const { sandbox, balances, movements, audit, exitCalls } = loadEloStockExitSandbox_();

  const preview = sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 5 sacos de Cimento Teste ELO Saida");
  assert.equal(preview.sessionIntent, "stock_exit_preview");
  assert.match(preview.fullAnswer, /Saida de estoque/);
  assert.match(preview.fullAnswer, /Saldo atual: 10 saco/);
  assert.match(preview.fullAnswer, /Saldo previsto: 5 saco/);
  assert.equal(exitCalls.length, 0);
  assert.equal(movements.length, 0);
  assert.equal(balances[0].balance, 10);

  const confirmed = sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim");
  assert.equal(confirmed.sessionIntent, "stock_exit_confirmed");
  assert.match(confirmed.fullAnswer, /Saida registrada no Stock/);
  assert.match(confirmed.fullAnswer, /Novo saldo: 5 saco/);
  assert.equal(exitCalls.length, 1);
  assert.equal(movements.length, 1);
  assert.equal(movements[0].type, "saida");
  assert.equal(movements[0].quantity, 5);
  assert.equal(balances[0].balance, 5);
  assert.equal(audit[0].action, "movement_out_created");
});

test("Elo bloqueia dupla confirmacao de saida", () => {
  const { sandbox, balances, movements, exitCalls } = loadEloStockExitSandbox_();

  sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 5 sacos de Cimento Teste ELO Saida");
  sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim");
  const repeated = sandbox.window.EloAssistente.buildStockExitAnswerForTest("confirmar");

  assert.equal(repeated.sessionIntent, "stock_exit_idempotent");
  assert.equal(exitCalls.length, 1);
  assert.equal(movements.length, 1);
  assert.equal(balances[0].balance, 5);
});

test("Elo cancela saida pendente e sim posterior nao escreve", () => {
  const { sandbox, balances, movements, exitCalls } = loadEloStockExitSandbox_();

  sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 2 sacos de Cimento Teste ELO Saida");
  const cancelled = sandbox.window.EloAssistente.buildStockExitAnswerForTest("cancelar");
  assert.equal(cancelled.sessionIntent, "stock_exit_cancelled");
  assert.equal(sandbox.window.EloAssistente.getPendingStockExitForTest(), null);
  assert.equal(sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim"), null);
  assert.equal(exitCalls.length, 0);
  assert.equal(movements.length, 0);
  assert.equal(balances[0].balance, 10);
});

test("Elo bloqueia quantidade zero, negativa e saldo insuficiente sem pending", () => {
  const { sandbox, balances, movements, exitCalls } = loadEloStockExitSandbox_();

  assert.equal(sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 0 sacos de Cimento Teste ELO Saida").sessionIntent, "stock_exit_blocked");
  assert.equal(sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire -5 sacos de Cimento Teste ELO Saida").sessionIntent, "stock_exit_blocked");
  const blocked = sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 15 sacos de Cimento Teste ELO Saida");
  assert.equal(blocked.sessionIntent, "stock_exit_insufficient");
  assert.match(blocked.fullAnswer, /Faltam 5 saco/);
  assert.equal(sandbox.window.EloAssistente.getPendingStockExitForTest(), null);
  assert.equal(exitCalls.length, 0);
  assert.equal(movements.length, 0);
  assert.equal(balances[0].balance, 10);
});

test("Elo bloqueia unidade errada, produto inexistente e ambiguidade", () => {
  const { sandbox, exitCalls } = loadEloStockExitSandbox_({ balances: [
    { itemId: "c1", id: "c1", sku: "CIM-001", name: "Cimento CP II", unit: "saco", balance: 10 },
    { itemId: "c2", id: "c2", sku: "CIM-002", name: "Cimento CP V", unit: "saco", balance: 20 }
  ] });

  assert.match(sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 1 lata de Cimento CP II").fullAnswer, /Unidade incompatível/);
  assert.equal(sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 1 saco de Produto Fantasma XYZ").sessionIntent, "stock_exit_blocked");
  assert.equal(sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 1 saco de cimento").sessionIntent, "stock_exit_ambiguous");
  assert.equal(exitCalls.length, 0);
});

test("Elo revalida saldo no momento da confirmacao", () => {
  const { sandbox, balances, movements, exitCalls } = loadEloStockExitSandbox_();

  sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 5 sacos de Cimento Teste ELO Saida");
  balances[0].balance = 3;
  balances[0].realBalance = 3;
  const blocked = sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim");

  assert.equal(blocked.sessionIntent, "stock_exit_balance_changed");
  assert.match(blocked.fullAnswer, /saldo mudou/i);
  assert.equal(exitCalls.length, 0);
  assert.equal(movements.length, 0);
  assert.equal(balances[0].balance, 3);
  assert.equal(sandbox.window.EloAssistente.getPendingStockExitForTest(), null);
});

test("Elo propaga bloqueio de permissao movements:out da ponte oficial", () => {
  const { sandbox, balances, movements, exitCalls } = loadEloStockExitSandbox_({ blockExit: true });

  sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 5 sacos de Cimento Teste ELO Saida");
  const blocked = sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim");

  assert.equal(blocked.sessionIntent, "stock_exit_blocked");
  assert.match(blocked.fullAnswer, /sem permissao|sem permiss.o/i);
  assert.equal(exitCalls.length, 1);
  assert.equal(movements.length, 0);
  assert.equal(balances[0].balance, 10);
});

test("Elo mantem entrada funcionando apos habilitar saida", () => {
  const { sandbox, balances, movements, entryCalls } = loadEloStockExitSandbox_();

  const preview = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de CIM-001");
  assert.equal(preview.sessionIntent, "stock_entry_preview");
  assert.equal(balances[0].balance, 10);
  const confirmed = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("sim");
  assert.equal(confirmed.sessionIntent, "stock_entry_confirmed");
  assert.equal(entryCalls.length, 1);
  assert.equal(balances[0].balance, 15);
  assert.equal(movements[0].type, "entrada");
  sandbox.window.EloAssistente.buildStockEntryAnswerForTest("confirmar");
  assert.equal(entryCalls.length, 1);
  assert.equal(balances[0].balance, 15);
});

test("contrato local exporta wrapper de saida oficial e Elo nao escreve direto no Stock", () => {
  const eloSource = readFileSync(new URL("../../relatorio-qualidade-obras/elo-assistente.js", import.meta.url), "utf8");
  const reportSource = readFileSync(new URL("../../relatorio-qualidade-obras/relatorio-qualidade-obras.js", import.meta.url), "utf8");

  assert.match(reportSource, /function createConfirmedOperationalExit_\(payload\)[\s\S]*saveAlmoxExitFromFormData_\(formData\)/);
  assert.match(reportSource, /requireStockFullPermission_\("movements:out"/);
  assert.match(reportSource, /createConfirmedExit:\s*createConfirmedOperationalExit_/);
  assert.doesNotMatch(eloSource, /saveAlmoxState_/);
  assert.doesNotMatch(eloSource, /state\.movements|movements\.push/);
});
