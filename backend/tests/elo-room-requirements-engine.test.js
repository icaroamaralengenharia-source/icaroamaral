import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function loadEngine() {
  const sandbox = { console, window: {} };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-room-requirements-engine.js"), "utf8"), sandbox, { filename: "elo-room-requirements-engine.js" });
  return sandbox.window.EloRoomRequirementsEngine;
}

test("banheiro 2x2,5 nao fecha sem ralo caixa agua esgoto loucas metais impermeabilizacao piso e revestimento", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "banheiro",
    text: "Banheiro de 2,00 m x 2,50 m com vaso, lavatÃ³rio e chuveiro."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.equal(result.status, "blocked");
  assert.ok(result.pendentes.includes("ralo"));
  assert.ok(result.pendentes.includes("caixa_sifonada"));
  assert.ok(result.pendentes.includes("ponto_agua"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
  assert.ok(result.pendentes.includes("registro"));
  assert.ok(result.pendentes.includes("impermeabilizacao"));
  assert.ok(result.pendentes.includes("piso"));
  assert.ok(result.pendentes.includes("revestimento_parede"));
});

test("banheiro exige box apenas quando especificado", () => {
  const engine = loadEngine();
  const withoutBox = engine.validateRoom({
    type: "banheiro",
    items: {
      vaso: true,
      lavatorio: true,
      chuveiro: true,
      ralo: true,
      caixa_sifonada: true,
      ponto_agua: true,
      ponto_esgoto: true,
      registro: true,
      impermeabilizacao: true,
      piso: true,
      revestimento_parede: true
    }
  });
  const withBox = engine.validateRoom({ type: "banheiro", box: true, items: withoutBox.encontrados.reduce((acc, item) => Object.assign(acc, { [item]: true }), {}) });
  assert.equal(withoutBox.podeFecharAmbiente, true);
  assert.ok(withBox.pendentes.includes("box"));
});

test("cozinha nao fecha sem pia agua esgoto piso e revestimento molhado", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "cozinha",
    text: "Cozinha com torneira."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.ok(result.pendentes.includes("pia_cuba"));
  assert.ok(result.pendentes.includes("ponto_agua"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
  assert.ok(result.pendentes.includes("piso"));
  assert.ok(result.pendentes.includes("revestimento_area_molhada"));
});

test("area de servico nao fecha sem tanque ponto maquina ralo torneira e esgoto", () => {
  const engine = loadEngine();
  const result = engine.validateRoom({
    type: "area_servico",
    text: "Ãrea de serviÃ§o prevista."
  });
  assert.equal(result.podeFecharAmbiente, false);
  assert.ok(result.pendentes.includes("tanque"));
  assert.ok(result.pendentes.includes("ponto_maquina"));
  assert.ok(result.pendentes.includes("ralo"));
  assert.ok(result.pendentes.includes("torneira"));
  assert.ok(result.pendentes.includes("ponto_esgoto"));
});

