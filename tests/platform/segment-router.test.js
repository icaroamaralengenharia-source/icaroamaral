import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSegmentReadiness,
  getSegmentById,
  getSegmentModules,
  getSegments,
  recommendSegmentFromText
} from "../../src/platform/segment-router.js";

test("segment-router carrega todos os segmentos comerciais", () => {
  assert.equal(getSegments().length, 4);
  assert.deepEqual(getSegments().map((segment) => segment.id).sort(), [
    "ai-hub",
    "commerce",
    "engineering",
    "healthcare"
  ]);
});

test("commerce recomenda Stock Full + ELO", () => {
  const commerce = getSegmentById("commerce");
  assert.equal(commerce.offer, "Stock Full Essencial");
  assert.deepEqual(commerce.suggestedModules, ["stock-full", "elo"]);
});

test("engineering recomenda ObraReport + Stock Obras + ELO + CADISTA", () => {
  assert.deepEqual(getSegmentModules("engineering"), ["obrareport", "stock-obras", "elo", "cadista"]);
});

test("healthcare marca implantacao controlada", () => {
  const healthcare = getSegmentById("healthcare");
  const readiness = evaluateSegmentReadiness("healthcare");
  assert.equal(healthcare.status, "controlled_implantation_only");
  assert.equal(readiness.canSellNow, false);
  assert.equal(readiness.salesMode, "implantacao controlada");
});

test("ai-hub marca cerebro da plataforma", () => {
  const aiHub = getSegmentById("ai-hub");
  const readiness = evaluateSegmentReadiness("ai-hub");
  assert.equal(aiHub.status, "platform_brain");
  assert.equal(aiHub.offer, "ELO como cérebro da plataforma");
  assert.equal(readiness.canSellNow, false);
});

test("texto de loja e estoque recomenda commerce", () => {
  const segment = recommendSegmentFromText("minha loja precisa controlar estoque");
  assert.equal(segment.id, "commerce");
});

test("texto de RDO da obra recomenda engineering", () => {
  const segment = recommendSegmentFromText("preciso fazer RDO da obra");
  assert.equal(segment.id, "engineering");
});

test("texto de medicamentos e validade recomenda healthcare", () => {
  const segment = recommendSegmentFromText("controle de medicamentos e validade");
  assert.equal(segment.id, "healthcare");
});

test("texto ambiguo recomenda ai-hub com proxima pergunta", () => {
  const segment = recommendSegmentFromText("quero melhorar minha rotina");
  assert.equal(segment.id, "ai-hub");
  assert.match(segment.suggestedNextQuestion, /comercio\/estoque/i);
});

test("evaluateSegmentReadiness retorna canSellNow correto", () => {
  assert.equal(evaluateSegmentReadiness("commerce").canSellNow, true);
  assert.equal(evaluateSegmentReadiness("engineering").canSellNow, true);
  assert.equal(evaluateSegmentReadiness("healthcare").canSellNow, false);
  assert.equal(evaluateSegmentReadiness("ai-hub").canSellNow, false);
});
