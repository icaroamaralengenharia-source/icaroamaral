import assert from "node:assert/strict";
import { test } from "node:test";
import { findPdfTextLeaks, hasPdfTextLeaks } from "../../scripts/pdf-audit-guards.mjs";

test("auditor de PDF nao marca falso positivo em palavras comuns", () => {
  const text = "Pendencias financeiras adicionais. Esquadrias_janelas com conferencia manual.";
  assert.equal(hasPdfTextLeaks(text), false);
});

test("auditor de PDF encontra NaN como valor real e vazamentos internos", () => {
  const text = [
    "Subtotal R$ NaN",
    "Area calculada NaN m²",
    "BDI NaN%",
    "Campo undefined",
    "Campo null",
    "Objeto [object Object]"
  ].join("\n");
  const ids = findPdfTextLeaks(text).map((item) => item.id);
  assert.ok(ids.includes("money_nan"));
  assert.ok(ids.includes("area_nan"));
  assert.ok(ids.includes("percent_nan"));
  assert.ok(ids.includes("undefined_token"));
  assert.ok(ids.includes("null_token"));
  assert.ok(ids.includes("object_object"));
});
