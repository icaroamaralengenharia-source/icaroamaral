import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const ROOT_DIR = join(import.meta.dirname, "..", "..");
const ASSISTANT_FILE = join(ROOT_DIR, "relatorio-qualidade-obras", "elo-assistente.js");
const CSS_FILE = join(ROOT_DIR, "relatorio-qualidade-obras", "relatorio-qualidade-obras.css");

const mojibakeFragments = [
  "Ãƒ", "Ã¡", "Ã ", "Ã¢", "Ã£", "Ã§", "Ã©", "Ãª", "Ã­", "Ã³", "Ã´", "Ãµ", "Ãº", "Ã¼",
  "Â·", "ï¿½", "âœ", "âš", "âž", "â˜", "â€”", "â€“", "ðŸ"
];

test("elo assistente nao contem mojibake nos textos publicos", () => {
  const source = readFileSync(ASSISTANT_FILE, "utf8");
  const css = readFileSync(CSS_FILE, "utf8");
  const checkedSource = source + "\n" + css;

  assert.match(source, /Elo está pensando/);
  assert.match(source, /Não consegui registrar essa previsão/);
  assert.match(css, /Sistema de gestão de obras e relatórios técnicos/);

  for (const fragment of mojibakeFragments) {
    assert.equal(checkedSource.includes(fragment), false, `Fragmento de mojibake encontrado: ${fragment}`);
  }
});
