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
  const environments = (options.environments || [
    { id: "env-a", environmentId: "env-a", name: "Almoxarifado Central", environmentName: "Almoxarifado Central", companyId: "company-a" },
    { id: "env-b", environmentId: "env-b", name: "Obra A", environmentName: "Obra A", companyId: "company-a" }
  ]).map((environment) => ({ ...environment }));
  const audit = [];
  const entryCalls = [];
  const exitCalls = [];
  const transferCalls = [];
  const syncCalls = [];
  const remoteSyncResults = Array.isArray(options.remoteSyncResults) ? options.remoteSyncResults.slice() : null;
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
    getAlmoxBalances(request = {}) {
      return balances.filter((item) => {
        if (options.activeCompanyId && item.companyId && item.companyId !== options.activeCompanyId) return false;
        if (!request.allEnvironments && options.activeEnvironmentId && item.environmentId && item.environmentId !== options.activeEnvironmentId) return false;
        return true;
      }).map((item) => ({ ...item }));
    },
    getAlmoxEnvironments() {
      return environments.filter((environment) => !options.activeCompanyId || !environment.companyId || environment.companyId === options.activeCompanyId).map((environment) => ({ ...environment }));
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
    createConfirmedTransfer(payload) {
      transferCalls.push(clone_(payload));
      if (options.blockTransfer) return { ok: false, message: options.blockTransferMessage || "Usuario sem permissao para registrar transferencia." };
      const transferId = String(payload.transferId || payload.operationId || "");
      const duplicate = movements.filter((movement) => movement.origin === "elo_transfer" && movement.transferId === transferId);
      if (duplicate.length >= 2) return { ok: true, duplicate: true, transferId, before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: duplicate.map((item) => ({ ...item })) };
      const sourceEnvironment = environments.find((environment) => environment.id === payload.sourceEnvironmentId || environment.environmentId === payload.sourceEnvironmentId);
      const destinationEnvironment = environments.find((environment) => environment.id === payload.destinationEnvironmentId || environment.environmentId === payload.destinationEnvironmentId);
      if (!sourceEnvironment) return { ok: false, message: "Ambiente de origem nao encontrado." };
      if (!destinationEnvironment) return { ok: false, message: "Ambiente de destino nao encontrado." };
      if (sourceEnvironment.companyId && destinationEnvironment.companyId && sourceEnvironment.companyId !== destinationEnvironment.companyId) return { ok: false, message: "Origem e destino precisam pertencer a mesma empresa." };
      if (payload.sourceEnvironmentId === payload.destinationEnvironmentId) return { ok: false, message: "Origem e destino nao podem ser iguais." };
      const sourceItem = balances.find((candidate) => (candidate.itemId === payload.sourceItemId || candidate.id === payload.sourceItemId) && candidate.environmentId === payload.sourceEnvironmentId);
      const destinationItem = balances.find((candidate) => (candidate.itemId === payload.destinationItemId || candidate.id === payload.destinationItemId) && candidate.environmentId === payload.destinationEnvironmentId);
      const quantity = Number(payload.quantity || 0);
      if (!sourceItem || !destinationItem || quantity <= 0) return { ok: false, message: "Item ou quantidade invalida.", before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: [] };
      if (payload.unit && payload.unit !== sourceItem.unit) return { ok: false, message: "Unidade informada diferente da unidade cadastrada na origem.", before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: [] };
      if (sourceItem.unit !== destinationItem.unit) return { ok: false, message: "Unidade do destino diferente da unidade da origem.", before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: [] };
      const sourceBefore = Number(sourceItem.balance || sourceItem.realBalance || 0);
      const destinationBefore = Number(destinationItem.balance || destinationItem.realBalance || 0);
      if (quantity > sourceBefore) return { ok: false, message: "Saldo insuficiente para transferencia.", before: balances.map((item) => ({ ...item })), after: balances.map((item) => ({ ...item })), movements: [] };
      sourceItem.balance = sourceBefore - quantity;
      sourceItem.realBalance = sourceItem.balance;
      destinationItem.balance = destinationBefore + quantity;
      destinationItem.realBalance = destinationItem.balance;
      const outMovement = { id: "mov-transfer-out-" + transferCalls.length, type: "saida", itemId: sourceItem.itemId || sourceItem.id, productId: sourceItem.itemId || sourceItem.id, quantity, unit: sourceItem.unit, material: sourceItem.name, balanceAfter: sourceItem.balance, transferId, operationId: transferId, origin: "elo_transfer", environmentId: payload.sourceEnvironmentId, destinationEnvironmentId: payload.destinationEnvironmentId };
      const inMovement = { id: "mov-transfer-in-" + transferCalls.length, type: "entrada", itemId: destinationItem.itemId || destinationItem.id, productId: destinationItem.itemId || destinationItem.id, quantity, unit: destinationItem.unit, material: destinationItem.name, balanceAfter: destinationItem.balance, transferId, operationId: transferId, origin: "elo_transfer", environmentId: payload.destinationEnvironmentId, sourceEnvironmentId: payload.sourceEnvironmentId };
      movements.unshift(inMovement);
      movements.unshift(outMovement);
      audit.unshift({ action: "movement_in_created", entityType: "stock_movements", entityId: inMovement.id, metadata: { origin: "ELO", transferId, itemId: destinationItem.itemId || destinationItem.id, quantity } });
      audit.unshift({ action: "movement_out_created", entityType: "stock_movements", entityId: outMovement.id, metadata: { origin: "ELO", transferId, itemId: sourceItem.itemId || sourceItem.id, quantity } });
      return { ok: true, transferId, sourceBalanceBefore: sourceBefore, sourceBalanceAfter: sourceItem.balance, destinationBalanceBefore: destinationBefore, destinationBalanceAfter: destinationItem.balance, unit: sourceItem.unit, before: [], after: balances.map((item) => ({ ...item })), movements: [outMovement, inMovement], history: [outMovement, inMovement] };
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
        const movement = { id: "mov-exit-" + exitCalls.length, type: "saida", itemId: item.itemId, productId: item.itemId, quantity, unit: item.unit, material: item.name, balanceAfter: item.balance, releaseId, operationId: "elo:saida:" + releaseId + ":" + item.itemId, origin: "elo_release", source: payload.source || "elo" };
        if (remoteSyncResults) movement.remoteSync = Promise.resolve(remoteSyncResults.shift() || { ok: true, movement });
        movements.unshift(movement);
        audit.unshift({ action: "movement_out_created", entityType: "stock_movements", entityId: movement.id, metadata: { itemId: item.itemId, quantity } });
        created.push(movement);
      }
      return { ok: true, releaseId, before, after: balances.map((entry) => ({ ...entry })), movements: created, history: created };
    },
    syncConfirmedMovement(movement) {
      syncCalls.push(clone_(movement));
      return Promise.resolve(remoteSyncResults && remoteSyncResults.length ? remoteSyncResults.shift() : { ok: true, movement });
    }
  };
  createContext(sandbox);
  runInContext(validatorContent, sandbox);
  runInContext(stockEngineContent, sandbox);
  runInContext(eloContent, sandbox);
  return { sandbox, balances, movements, environments, audit, entryCalls, exitCalls, transferCalls, syncCalls };
}


test("Elo parseia comandos de transferencia sem acionar escrita", () => {
  const { sandbox, transferCalls } = loadEloStockExitSandbox_();
  const parse = sandbox.window.EloAssistente.parseStockTransferCommandForTest;

  assert.deepEqual(JSON.parse(JSON.stringify(parse("transfira 5 sacos de cimento do Almoxarifado Central para Obra A"))), { action: "stock_transfer", quantity: 5, unit: "saco", originalUnit: "sacos", productQuery: "cimento", sourceEnvironmentQuery: "almoxarifado central", destinationEnvironmentQuery: "obra a", sourceMessage: "transfira 5 sacos de cimento do Almoxarifado Central para Obra A" });
  assert.equal(parse("mande 3 sacos de cimento para a Obra B").quantity, 3);
  assert.equal(parse("transfira 2 unidades do ambiente X para o ambiente Y").unit, "un");
  assert.equal(parse("cadastre 5 sacos de cimento"), null);
  assert.equal(transferCalls.length, 0);
});

test("Elo mostra preview de transferencia sem escrita e confirma dois movimentos vinculados", () => {
  const { sandbox, balances, movements, audit, transferCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    balances: [
      { itemId: "cimento-origin", id: "cimento-origin", sku: "CIM-TR", fiscalCode: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
      { itemId: "cimento-dest", id: "cimento-dest", sku: "CIM-TR", fiscalCode: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-b" }
    ]
  });

  const preview = sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 5 sacos de Cimento CP II do Almoxarifado Central para Obra A");
  assert.equal(preview.sessionIntent, "stock_transfer_preview");
  assert.match(preview.fullAnswer, /Transferência de estoque/);
  assert.match(preview.fullAnswer, /Origem: Almoxarifado Central/);
  assert.match(preview.fullAnswer, /Destino: Obra A/);
  assert.match(preview.fullAnswer, /Saldo atual na origem: 10 saco/);
  assert.match(preview.fullAnswer, /Saldo previsto na origem: 5 saco/);
  assert.match(preview.fullAnswer, /Saldo atual no destino: 2 saco/);
  assert.match(preview.fullAnswer, /Saldo previsto no destino: 7 saco/);
  assert.equal(transferCalls.length, 0);
  assert.equal(movements.length, 0);
  assert.equal(balances.find((item) => item.itemId === "cimento-origin").balance, 10);
  assert.equal(balances.find((item) => item.itemId === "cimento-dest").balance, 2);

  const confirmed = sandbox.window.EloAssistente.buildStockTransferAnswerForTest("sim");
  assert.equal(confirmed.sessionIntent, "stock_transfer_confirmed");
  assert.match(confirmed.fullAnswer, /Transferencia registrada no Stock/);
  assert.match(confirmed.fullAnswer, /Saldo origem: 10 -> 5 saco/);
  assert.match(confirmed.fullAnswer, /Saldo destino: 2 -> 7 saco/);
  assert.equal(transferCalls.length, 1);
  assert.equal(movements.length, 2);
  assert.equal(movements.filter((movement) => movement.type === "saida").length, 1);
  assert.equal(movements.filter((movement) => movement.type === "entrada").length, 1);
  assert.equal(movements[0].transferId, movements[1].transferId);
  assert.ok(movements[0].transferId);
  assert.equal(balances.find((item) => item.itemId === "cimento-origin").balance, 5);
  assert.equal(balances.find((item) => item.itemId === "cimento-dest").balance, 7);
  assert.deepEqual(audit.slice(0, 2).map((item) => item.action), ["movement_out_created", "movement_in_created"]);
});

test("Elo bloqueia dupla confirmacao e cancelamento de transferencia", () => {
  const first = loadEloStockExitSandbox_({ activeCompanyId: "company-a", activeEnvironmentId: "env-a", balances: [
    { itemId: "cimento-origin", id: "cimento-origin", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
    { itemId: "cimento-dest", id: "cimento-dest", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-b" }
  ] });
  first.sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 5 sacos de Cimento CP II do Almoxarifado Central para Obra A");
  first.sandbox.window.EloAssistente.buildStockTransferAnswerForTest("sim");
  const repeated = first.sandbox.window.EloAssistente.buildStockTransferAnswerForTest("confirmar");
  assert.equal(repeated.sessionIntent, "stock_transfer_idempotent");
  assert.equal(first.transferCalls.length, 1);
  assert.equal(first.movements.length, 2);

  const second = loadEloStockExitSandbox_({ activeCompanyId: "company-a", activeEnvironmentId: "env-a", balances: [
    { itemId: "cimento-origin", id: "cimento-origin", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
    { itemId: "cimento-dest", id: "cimento-dest", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-b" }
  ] });
  second.sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 2 sacos de Cimento CP II do Almoxarifado Central para Obra A");
  const cancelled = second.sandbox.window.EloAssistente.buildStockTransferAnswerForTest("cancelar");
  assert.equal(cancelled.sessionIntent, "stock_transfer_cancelled");
  assert.equal(second.transferCalls.length, 0);
  assert.equal(second.movements.length, 0);
  assert.equal(second.sandbox.window.EloAssistente.getPendingStockTransferForTest(), null);
});

test("Elo bloqueia transferencia invalida sem escrever", () => {
  const { sandbox, transferCalls, movements } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    environments: [
      { id: "env-a", name: "Almoxarifado Central", environmentName: "Almoxarifado Central", companyId: "company-a" },
      { id: "env-b", name: "Obra A", environmentName: "Obra A", companyId: "company-a" },
      { id: "env-c", name: "Outra Empresa", environmentName: "Outra Empresa", companyId: "company-b" }
    ],
    balances: [
      { itemId: "cimento-origin", id: "cimento-origin", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 5, realBalance: 5, companyId: "company-a", environmentId: "env-a" },
      { itemId: "cimento-dest", id: "cimento-dest", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-b" },
      { itemId: "cimento-other", id: "cimento-other", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-b", environmentId: "env-c" }
    ]
  });

  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 0 sacos de Cimento CP II do Almoxarifado Central para Obra A").sessionIntent, "stock_transfer_blocked");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira -5 sacos de Cimento CP II do Almoxarifado Central para Obra A").sessionIntent, "stock_transfer_blocked");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 6 sacos de Cimento CP II do Almoxarifado Central para Obra A").sessionIntent, "stock_exit_insufficient");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 1 saco de Cimento CP II do Almoxarifado Central para Almoxarifado Central").sessionIntent, "stock_transfer_same_environment");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 1 saco de Cimento CP II do Almoxarifado Central para Obra Fantasma").sessionIntent, "stock_transfer_destination_missing");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 1 saco de Cimento CP II do Almoxarifado Central para Outra Empresa").sessionIntent, "stock_transfer_destination_missing");
  assert.equal(sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 1 lata de Cimento CP II do Almoxarifado Central para Obra A").sessionIntent, "stock_transfer_blocked");
  assert.equal(transferCalls.length, 0);
  assert.equal(movements.length, 0);
});

test("Elo revalida saldo de transferencia no sim", () => {
  const { sandbox, balances, transferCalls, movements } = loadEloStockExitSandbox_({ activeCompanyId: "company-a", activeEnvironmentId: "env-a", balances: [
    { itemId: "cimento-origin", id: "cimento-origin", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
    { itemId: "cimento-dest", id: "cimento-dest", sku: "CIM-TR", name: "Cimento CP II", unit: "saco", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-b" }
  ] });

  sandbox.window.EloAssistente.buildStockTransferAnswerForTest("transfira 5 sacos de Cimento CP II do Almoxarifado Central para Obra A");
  balances.find((item) => item.itemId === "cimento-origin").balance = 3;
  balances.find((item) => item.itemId === "cimento-origin").realBalance = 3;
  const blocked = sandbox.window.EloAssistente.buildStockTransferAnswerForTest("sim");

  assert.equal(blocked.sessionIntent, "stock_transfer_balance_changed");
  assert.equal(transferCalls.length, 0);
  assert.equal(movements.length, 0);
});

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

test("Elo nao confirma sucesso remoto quando sync de saida falha e retry usa a mesma operacao", async () => {
  const { sandbox, balances, exitCalls, syncCalls } = loadEloStockExitSandbox_({
    remoteSyncResults: [
      { ok: false, pending: true, error: "remote_down" },
      { ok: true, movement: { id: "remote-exit-1" } }
    ]
  });

  const preview = sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 5 sacos de Cimento Teste ELO Saida");
  assert.equal(preview.sessionIntent, "stock_exit_preview");

  const blocked = await sandbox.window.EloAssistente.buildStockExitAnswerForTest("sim");
  assert.equal(blocked.sessionIntent, "stock_exit_remote_sync_failed");
  assert.match(blocked.fullAnswer, /remote_down/);
  assert.equal(exitCalls.length, 1);
  assert.equal(syncCalls.length, 0);
  assert.equal(balances.find((item) => item.itemId === "item-cimento").balance, 5);

  const retried = await sandbox.window.EloAssistente.buildStockExitAnswerForTest("confirmar");
  assert.equal(retried.sessionIntent, "stock_exit_confirmed");
  assert.equal(exitCalls.length, 1);
  assert.equal(syncCalls.length, 1);
  assert.equal(syncCalls[0].releaseId, exitCalls[0].releaseId);
  assert.equal(balances.find((item) => item.itemId === "item-cimento").balance, 5);
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



test("Elo resolve produto direto primeiro no ambiente ativo", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    balances: [
      { itemId: "active-cimento", id: "active-cimento", sku: "CIM-A", name: "Cimento Multi Ambiente", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
      { itemId: "other-cimento", id: "other-cimento", sku: "CIM-B", name: "Cimento Multi Ambiente", unit: "saco", balance: 40, realBalance: 40, companyId: "company-a", environmentId: "env-b" }
    ]
  });

  const preview = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de Cimento Multi Ambiente");

  assert.equal(preview.sessionIntent, "stock_entry_preview");
  assert.equal(preview.stockEntry.item.itemId, "active-cimento");
  assert.match(preview.fullAnswer, /Saldo atual: 10 saco/);
  assert.doesNotMatch(preview.fullAnswer, /Ambiente afetado/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo resolve produto direto em outro ambiente do mesmo tenant com fallback seguro", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    balances: [
      { itemId: "remote-cimento", id: "remote-cimento", sku: "CIM-REMOTE", name: "Cimento Remoto ELO", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-b" }
    ]
  });

  const entry = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de Cimento Remoto ELO");
  const exit = sandbox.window.EloAssistente.buildStockExitAnswerForTest("retire 4 sacos de Cimento Remoto ELO");
  const query = sandbox.window.EloAssistente.buildResponseForTest("qual saldo do Cimento Remoto ELO no estoque?");

  assert.equal(entry.sessionIntent, "stock_entry_preview");
  assert.equal(entry.stockEntry.item.itemId, "remote-cimento");
  assert.match(entry.fullAnswer, /Ambiente afetado: Obra A/);
  assert.match(entry.fullAnswer, /Saldo atual: 10 saco/);
  assert.match(entry.fullAnswer, /Saldo previsto: 15 saco/);
  assert.equal(exit.sessionIntent, "stock_exit_preview");
  assert.equal(exit.stockExit.item.itemId, "remote-cimento");
  assert.match(exit.fullAnswer, /Ambiente afetado: Obra A/);
  assert.match(exit.fullAnswer, /Saldo previsto: 6 saco/);
  assert.equal(query.sessionIntent, "stock_full_saldo");
  assert.match(query.fullAnswer, /Cimento Remoto ELO: 10 saco em estoque/);
  assert.match(query.fullAnswer, /Ambiente afetado: Obra A/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo bloqueia ambiguidade quando fallback encontra o mesmo produto em ambientes diferentes", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-c",
    balances: [
      { itemId: "amb-a", id: "amb-a", sku: "AMB-A", name: "Cimento Ambiguo", unit: "saco", balance: 10, realBalance: 10, companyId: "company-a", environmentId: "env-a" },
      { itemId: "amb-b", id: "amb-b", sku: "AMB-B", name: "Cimento Ambiguo", unit: "saco", balance: 8, realBalance: 8, companyId: "company-a", environmentId: "env-b" }
    ]
  });

  const answer = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de Cimento Ambiguo");

  assert.equal(answer.sessionIntent, "stock_entry_ambiguous");
  assert.match(answer.fullAnswer, /Ambiente: Almoxarifado Central/);
  assert.match(answer.fullAnswer, /Ambiente: Obra A/);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo nao resolve produto de outro tenant no fallback allEnvironments", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    balances: [
      { itemId: "tenant-b", id: "tenant-b", sku: "TEN-B", name: "Cimento Outro Tenant", unit: "saco", balance: 10, realBalance: 10, companyId: "company-b", environmentId: "env-b" }
    ]
  });

  const answer = sandbox.window.EloAssistente.buildStockEntryAnswerForTest("registre entrada de 5 sacos de Cimento Outro Tenant");

  assert.equal(answer.sessionIntent, "stock_entry_blocked");
  assert.equal(exitCalls.length + entryCalls.length, 0);
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


test("Elo consulta itens abaixo do minimo sem escrever", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ balances: [
    { itemId: "zero", id: "zero", name: "Argamassa AC-II", unit: "saco", balance: 0, realBalance: 0, minimumStock: 5, companyId: "company-a", environmentId: "env-a" },
    { itemId: "low", id: "low", name: "Cimento CP II", unit: "saco", balance: 3, realBalance: 3, minimumStock: 10, companyId: "company-a", environmentId: "env-a" },
    { itemId: "min", id: "min", name: "Areia Media", unit: "m3", balance: 4, realBalance: 4, minimumStock: 4, companyId: "company-a", environmentId: "env-a" },
    { itemId: "ok", id: "ok", name: "Brita", unit: "m3", balance: 12, realBalance: 12, minimumStock: 5, companyId: "company-a", environmentId: "env-a" },
    { itemId: "nom", id: "nom", name: "Sem Minimo", unit: "un", balance: 2, realBalance: 2, companyId: "company-a", environmentId: "env-a" }
  ] });

  const answer = sandbox.window.EloAssistente.buildResponseForTest("quais itens estão abaixo do mínimo?");

  assert.equal(answer.sessionIntent, "stock_full_baixo_estoque");
  assert.match(answer.fullAnswer, /Itens que precisam de reposição:/);
  assert.match(answer.fullAnswer, /Argamassa AC-II — ZERADO — mínimo 5 — faltam 5/);
  assert.match(answer.fullAnswer, /Cimento CP II — saldo 3 saco — mínimo 10 — faltam 7/);
  assert.match(answer.fullAnswer, /Areia Media — saldo 4 m3 — mínimo 4 — faltam 0/);
  assert.doesNotMatch(answer.fullAnswer, /Brita/);
  assert.doesNotMatch(answer.fullAnswer, /Sem Minimo/);
  assert.match(answer.fullAnswer, /Total: 3 itens\./);
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo reconhece perguntas de estoque acabando e reposicao", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ balances: [
    { itemId: "low", id: "low", name: "Cimento CP II", unit: "saco", balance: 3, realBalance: 3, minStock: 10, companyId: "company-a", environmentId: "env-a" }
  ] });

  assert.equal(sandbox.window.EloAssistente.buildResponseForTest("o que está acabando no estoque?").sessionIntent, "stock_full_baixo_estoque");
  assert.equal(sandbox.window.EloAssistente.buildResponseForTest("quais itens precisam de reposição?").sessionIntent, "stock_full_baixo_estoque");
  assert.equal(sandbox.window.EloAssistente.buildResponseForTest("tem produto com estoque baixo?").sessionIntent, "stock_full_baixo_estoque");
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo consulta somente zerados e informa dia sem alerta de minimo", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({ balances: [
    { itemId: "zero", id: "zero", name: "Argamassa AC-II", unit: "saco", balance: 0, realBalance: 0, minimumStock: 5, companyId: "company-a", environmentId: "env-a" },
    { itemId: "low", id: "low", name: "Cimento CP II", unit: "saco", balance: 3, realBalance: 3, minimumStock: 10, companyId: "company-a", environmentId: "env-a" }
  ] });
  const zeros = sandbox.window.EloAssistente.buildResponseForTest("tem produto zerado no estoque?");

  assert.equal(zeros.sessionIntent, "stock_full_zerados");
  assert.match(zeros.fullAnswer, /Itens zerados:/);
  assert.match(zeros.fullAnswer, /Argamassa AC-II/);
  assert.doesNotMatch(zeros.fullAnswer, /Cimento CP II/);

  const noAlert = loadEloStockExitSandbox_({ balances: [
    { itemId: "ok", id: "ok", name: "Brita", unit: "m3", balance: 12, realBalance: 12, minimumStock: 5, companyId: "company-a", environmentId: "env-a" }
  ] });
  assert.equal(noAlert.sandbox.window.EloAssistente.buildResponseForTest("quais itens estão abaixo do mínimo?").fullAnswer, "Nenhum item está abaixo do estoque mínimo.");
  assert.equal(exitCalls.length + entryCalls.length, 0);
});

test("Elo respeita isolamento company e environment na consulta de minimo", () => {
  const { sandbox, exitCalls, entryCalls } = loadEloStockExitSandbox_({
    activeCompanyId: "company-a",
    activeEnvironmentId: "env-a",
    balances: [
      { itemId: "ok", id: "ok", name: "Cimento CP II", unit: "saco", balance: 3, realBalance: 3, minimumStock: 10, companyId: "company-a", environmentId: "env-a" },
      { itemId: "env", id: "env", name: "Outro ambiente", unit: "saco", balance: 0, realBalance: 0, minimumStock: 10, companyId: "company-a", environmentId: "env-b" },
      { itemId: "tenant", id: "tenant", name: "Outra empresa", unit: "saco", balance: 0, realBalance: 0, minimumStock: 10, companyId: "company-b", environmentId: "env-a" }
    ]
  });

  const answer = sandbox.window.EloAssistente.buildResponseForTest("quais itens precisam de reposição?");

  assert.match(answer.fullAnswer, /Cimento CP II/);
  assert.doesNotMatch(answer.fullAnswer, /Outro ambiente/);
  assert.doesNotMatch(answer.fullAnswer, /Outra empresa/);
  assert.match(answer.fullAnswer, /Total: 1 item\./);
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
