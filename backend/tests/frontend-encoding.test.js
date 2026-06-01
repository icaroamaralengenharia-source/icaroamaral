import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT_DIR = join(import.meta.dirname, "..", "..");
const FRONTEND_FILE = join(ROOT_DIR, "relatorio-qualidade-obras", "relatorio-qualidade-obras.js");

test("rotulos da sugestao visual aplicada nao contem mojibake", () => {
  const source = readFileSync(FRONTEND_FILE, "utf8");
  const visualSuggestionBlock = extractFunctionBlock_(source, "buildVisualAiDescriptionText_");
  const appendBlock = extractFunctionBlock_(source, "appendAiTextToField_");
  const checkedSource = visualSuggestionBlock + "\n" + appendBlock;
  const expectedLabels = [
    "Possível manifestação:",
    "Evidências visuais:",
    "--- Sugestão da IA ---"
  ];

  expectedLabels.forEach((label) => {
    assert.match(checkedSource, new RegExp(escapeRegExp_(label)));
  });

  assert.doesNotMatch(checkedSource, /PossÃ|EvidÃ|SugestÃ|Â/);
});

function escapeRegExp_(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractFunctionBlock_(source, functionName) {
  const start = source.indexOf("function " + functionName);

  assert.notEqual(start, -1, "Funcao " + functionName + " nao encontrada.");

  const nextFunction = source.indexOf("\n  function ", start + 1);
  return source.slice(start, nextFunction === -1 ? source.length : nextFunction);
}
