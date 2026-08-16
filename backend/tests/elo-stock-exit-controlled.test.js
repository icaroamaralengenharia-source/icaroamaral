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
  const movements = (options.movements || []).map((movement) => ({ ...movement }));
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



test("Elo consulta saidas de hoje sem escrever", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-s1", type: "saida", itemId: "item-cimento", productId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", movementDate: dateKey, movementTime: "14:32", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-e1", type: "entrada", itemId: "item-cimento", productId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 3, unit: "saco", movementDate: dateKey, movementTime: "10:10", environmentId: "env-a", companyId: "company-a" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("o que saiu hoje?");

  assert.equal(answer.sessionIntent, "stock_movements_day");
  assert.match(answer.fullAnswer, /Saidas de hoje:/);
  assert.match(answer.fullAnswer, /Cimento Teste ELO Saida — 5 saco — 14:32/);
  assert.doesNotMatch(answer.fullAnswer, /10:10/);
  assert.match(answer.fullAnswer, /Total: 1 movimentacao\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo consulta entradas de hoje e todas as movimentacoes de hoje", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-s1", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", movementDate: dateKey, movementTime: "14:32", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-e1", type: "entrada", itemId: "item-mascara", itemName: "Mascara", quantity: 2, unit: "un", movementDate: dateKey, movementTime: "09:15", environmentId: "env-a", companyId: "company-a" }
  ] });

  const entries = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("quais foram as entradas de hoje?");
  const all = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("mostre as movimentacoes de hoje");

  assert.match(entries.fullAnswer, /Entradas de hoje:/);
  assert.match(entries.fullAnswer, /Mascara — 2 un — 09:15/);
  assert.doesNotMatch(entries.fullAnswer, /14:32/);
  assert.match(all.fullAnswer, /Movimentacoes de hoje:/);
  assert.match(all.fullAnswer, /Cimento Teste ELO Saida/);
  assert.match(all.fullAnswer, /Mascara/);
  assert.match(all.fullAnswer, /Total: 2 movimentacoes\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo filtra movimentacoes por ontem e informa dia sem movimento", () => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const todayKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const yesterdayKey = yesterday.getFullYear() + "-" + String(yesterday.getMonth() + 1).padStart(2, "0") + "-" + String(yesterday.getDate()).padStart(2, "0");
  const { sandbox } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-y1", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 1, unit: "saco", movementDate: yesterdayKey, movementTime: "08:00", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-t1", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 2, unit: "saco", movementDate: todayKey, movementTime: "16:00", environmentId: "env-a", companyId: "company-a" }
  ] });

  const yesterdayAnswer = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("o que saiu do estoque ontem?");
  const noEntries = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("quais foram as entradas de hoje?");

  assert.match(yesterdayAnswer.fullAnswer, /Saidas de ontem:/);
  assert.match(yesterdayAnswer.fullAnswer, /08:00/);
  assert.doesNotMatch(yesterdayAnswer.fullAnswer, /16:00/);
  assert.equal(noEntries.fullAnswer, "Nenhuma entrada registrada hoje.");
});

test("Elo nao mistura outro company ou environment na consulta", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-ok", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 1, unit: "saco", movementDate: dateKey, movementTime: "11:00", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-env", type: "saida", itemId: "item-outro-env", itemName: "Outro ambiente", quantity: 9, unit: "saco", movementDate: dateKey, movementTime: "12:00", environmentId: "env-b", companyId: "company-a" },
    { id: "mov-company", type: "saida", itemId: "item-outra-company", itemName: "Outra empresa", quantity: 8, unit: "saco", movementDate: dateKey, movementTime: "13:00", environmentId: "env-a", companyId: "company-b" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementDayAnswerForTest("o que saiu hoje?");

  assert.match(answer.fullAnswer, /11:00/);
  assert.doesNotMatch(answer.fullAnswer, /12:00/);
  assert.doesNotMatch(answer.fullAnswer, /13:00/);
  assert.match(answer.fullAnswer, /Total: 1 movimentacao\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});



test("Elo consulta responsavel de saida e entrada sem escrever", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-s1", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", responsible: "Manoel", movementDate: dateKey, movementTime: "14:32", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-e1", type: "entrada", itemId: "item-mascara", itemName: "Mascara", quantity: 2, unit: "un", responsible: "Carla", movementDate: dateKey, movementTime: "09:15", environmentId: "env-a", companyId: "company-a" }
  ] });

  const whoMoved = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem movimentou o estoque hoje?");
  const whoEntry = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem registrou essa entrada?");

  assert.equal(whoMoved.sessionIntent, "stock_movement_responsible");
  assert.match(whoMoved.fullAnswer, /Manoel — saida de 5 saco de Cimento Teste ELO Saida — 14:32\./);
  assert.match(whoMoved.fullAnswer, /Carla — entrada de 2 un de Mascara — 09:15\./);
  assert.match(whoEntry.fullAnswer, /Carla — entrada de 2 un de Mascara — 09:15\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo consulta ultima movimentacao", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-old", type: "entrada", itemId: "item-mascara", itemName: "Mascara", quantity: 1, unit: "un", responsible: "Carla", movementDate: dateKey, movementTime: "08:00", sortKey: dateKey + "T08:00:00", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-new", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", responsible: "Manoel", movementDate: dateKey, movementTime: "16:10", sortKey: dateKey + "T16:10:00", environmentId: "env-a", companyId: "company-a" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem fez a ultima movimentacao?");

  assert.match(answer.fullAnswer, /Ultima movimentacao:/);
  assert.match(answer.fullAnswer, /Manoel — saida de 5 saco de Cimento Teste ELO Saida — 16:10\./);
  assert.doesNotMatch(answer.fullAnswer, /08:00/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo filtra responsavel por produto", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-cim", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", responsible: "Manoel", movementDate: dateKey, movementTime: "14:32", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-mas", type: "saida", itemId: "item-mascara", itemName: "Mascara", quantity: 1, unit: "un", responsible: "Joao", movementDate: dateKey, movementTime: "12:00", environmentId: "env-a", companyId: "company-a" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem deu saida no cimento?");

  assert.match(answer.fullAnswer, /Manoel/);
  assert.match(answer.fullAnswer, /Cimento Teste ELO Saida/);
  assert.doesNotMatch(answer.fullAnswer, /Joao/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo informa registro sem responsavel", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-s1", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 5, unit: "saco", movementDate: dateKey, movementTime: "14:32", environmentId: "env-a", companyId: "company-a" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem fez a ultima movimentacao?");

  assert.match(answer.fullAnswer, /Responsável não identificado no registro\./);
  assert.match(answer.fullAnswer, /saida de 5 saco de Cimento Teste ELO Saida/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo isola responsavel por company e environment", () => {
  const today = new Date();
  const dateKey = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ movements: [
    { id: "mov-ok", type: "saida", itemId: "item-cimento", itemName: "Cimento Teste ELO Saida", quantity: 1, unit: "saco", responsible: "Manoel", movementDate: dateKey, movementTime: "11:00", environmentId: "env-a", companyId: "company-a" },
    { id: "mov-env", type: "saida", itemId: "item-outro-env", itemName: "Outro ambiente", quantity: 9, unit: "saco", responsible: "Outro Env", movementDate: dateKey, movementTime: "12:00", environmentId: "env-b", companyId: "company-a" },
    { id: "mov-company", type: "saida", itemId: "item-outra-company", itemName: "Outra empresa", quantity: 8, unit: "saco", responsible: "Outro Tenant", movementDate: dateKey, movementTime: "13:00", environmentId: "env-a", companyId: "company-b" }
  ] });

  const answer = sandbox.window.EloAssistente.buildStockMovementResponsibleAnswerForTest("quem movimentou o estoque hoje?");

  assert.match(answer.fullAnswer, /Manoel/);
  assert.doesNotMatch(answer.fullAnswer, /Outro Env/);
  assert.doesNotMatch(answer.fullAnswer, /Outro Tenant/);
  assert.match(answer.fullAnswer, /Total: 1 movimentacao\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
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
