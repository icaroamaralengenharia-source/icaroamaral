import test from "node:test";
import assert from "node:assert/strict";
import {
  getStockFullProjectId,
  getStockFullProjectIdFromValue,
  isStockFullWorkScopeMatch,
  mapStockFullWork,
  STOCK_FULL_WORK_REQUIRED,
  STOCK_FULL_WORK_NOT_ALLOWED
} from "../src/stock-full-work-scope.js";

test("Stock Full resolves the canonical project id from request aliases", () => {
  assert.equal(getStockFullProjectId({ body: { projectId: "obra-a" } }), "obra-a");
  assert.equal(getStockFullProjectId({ query: { work_id: "obra-b" } }), "obra-b");
  assert.equal(getStockFullProjectId({ headers: { "x-project-id": "obra-c" } }), "obra-c");
  assert.equal(getStockFullProjectId({ body: {}, query: {}, headers: {} }), "");
});

test("Stock Full does not treat a missing work as tenant-global scope", () => {
  assert.equal(getStockFullProjectIdFromValue({ institution_id: "tenant-a" }), "");
  assert.equal(isStockFullWorkScopeMatch({ project_id: "obra-a" }, "obra-a"), true);
  assert.equal(isStockFullWorkScopeMatch({ project_id: "obra-b" }, "obra-a"), false);
  assert.equal(STOCK_FULL_WORK_REQUIRED, "WORK_REQUIRED");
  assert.equal(STOCK_FULL_WORK_NOT_ALLOWED, "WORK_NOT_ALLOWED");
});

test("Stock Full exposes work and client identifiers without leaking tenant data", () => {
  assert.deepEqual(mapStockFullWork({
    id: "obra-a",
    institution_id: "tenant-a",
    client_id: "client-a",
    name: "Residência A",
    address: "Rua A"
  }), {
    id: "obra-a",
    projectId: "obra-a",
    workId: "obra-a",
    institutionId: "tenant-a",
    clientId: "client-a",
    name: "Residência A",
    address: "Rua A"
  });
});
