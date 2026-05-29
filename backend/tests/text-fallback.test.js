import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

const assistant = loadAssistant_();

const CASES = [
  ["infiltracao na parede", ["umidade", "origem"]],
  ["trinca na viga", ["trinca", "verificacao tecnica"]],
  ["piso quebrado", ["piso", "substituicao"]],
  ["pintura manchada", ["pintura", "acabamento"]],
  ["reboco soltando", ["revestimento argamassado", "aderencia"]],
  ["tomada sem acabamento", ["instalacao eletrica", "seguranca"]],
  ["porta desalinhada", ["esquadria", "alinhamento"]],
  ["janela com infiltracao", ["umidade", "medidas corretivas"]],
  ["vazamento no banheiro", ["vazamento", "perda de agua"]],
  ["entulho no corredor", ["limpeza", "seguranca"]],
  ["falta de limpeza", ["limpeza", "residuos"]],
  ["parede fora de prumo", ["prumo", "geometricamente"]],
  ["ceramica oca", ["revestimento", "aderencia"]],
  ["ralo sem caimento", ["escoamento", "caimento"]],
  ["ferragem exposta", ["armadura", "cobrimento"]],
  ["concreto com falha", ["concreto", "reparo tecnico"]],
  ["gesso trincado", ["gesso", "juntas"]],
  ["rodape mal executado", ["rodape", "acabamento"]],
  ["impermeabilizacao com falha", ["impermeabilizacao", "estanqueidade"]],
  ["esquadria sem vedacao", ["esquadria", "vedacao"]]
];

test("fallback local melhora 20 textos reais de obra", async () => {
  for (const [input, expectedTerms] of CASES) {
    const result = await assistant.improveTechnicalText(input, {
      kind: "technical",
      report: {
        obra: "Obra teste",
        local: "Ambiente de teste"
      }
    });

    assert.equal(result.mode, "local");
    assert.ok(result.suggestion.length > input.length, input);
    assert.doesNotMatch(result.suggestion, /\bundefined\b|\bnull\b/i, input);
    assert.match(result.suggestion, /Foi (identificada|identificado|observada|observado|constatada|constatado)/, input);
    assert.doesNotMatch(
      result.suggestion,
      /\b(manifestacao|investigacao|adocao|necessarias|peca|aderencia|execucao|instalacao|eletrica|hidraulica|verificacao|correcao|exposicao|tecnico|recomposicao|pendencia|condicoes|seguranca|liberacao|divergencia|nivel)\b/i,
      input
    );

    expectedTerms.forEach((term) => {
      assert.ok(
        normalize_(result.suggestion).includes(normalize_(term)),
        input + " deveria conter " + term + " em: " + result.suggestion
      );
    });
  }
});

test("fallback local gera recomendacao tecnica no modo solution", async () => {
  const result = await assistant.improveTechnicalText("reboco soltando perto da janela", {
    kind: "solution"
  });

  assert.equal(result.mode, "local");
  assert.match(result.suggestion, /^Sendo recomendada|^Recomendando-se/);
  assert.match(normalize_(result.suggestion), /aderencia/);
});

function loadAssistant_() {
  const file = join(process.cwd(), "..", "relatorio-qualidade-obras", "ai-assistant.js");
  const code = readFileSync(file, "utf8");
  const context = {
    window: {
      RELATORIO_QUALIDADE_CONFIG: {}
    },
    console
  };

  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.ObraReportAI;
}

function normalize_(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
