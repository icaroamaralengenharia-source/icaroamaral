import { expect, test } from "@playwright/test";
import path from "node:path";

const conductorPath = path.resolve("relatorio-qualidade-obras", "elo-conversation-conductor.js");

async function loadConductor(page) {
  await page.goto("about:blank");
  await page.addScriptTag({ path: conductorPath });
  await page.evaluate(function () {
    window.EloConversationConductor.resetState();
  });
}

async function enhance(page, userMessage, assistantResponse = "Entendi sua solicitacao.") {
  return page.evaluate(function (payload) {
    return window.EloConversationConductor.enhanceResponse(payload);
  }, {
    userMessage: userMessage,
    assistantResponse: assistantResponse,
    context: {}
  });
}

async function state(page) {
  return page.evaluate(function () {
    return window.EloConversationConductor.loadState();
  });
}

function expectText(received, expected) {
  expect(String(received || "")).toMatch(expected);
}

test.describe("EloConversationConductor", function () {
  test.beforeEach(async function ({ page }) {
    await loadConductor(page);
  });

  test("detecta engenheiro com dor de produtividade/documentacao e oferece entrega visual", async function ({ page }) {
    const answer = await enhance(page, "sou engenheiro e preciso fazer relatorios mais rapido");
    const memory = await state(page);

    expect(memory.persona).toBe("engenheiro");
    expect(memory.pain).toBe("produtividade/documentacao");
    expect(memory.leadTemperature).toBe("warm");
    expectText(answer, /reduzir seu tempo de documentacao tecnica/i);
    expectText(answer, /relatorio|checklist|PDF/i);
  });

  test("sindico com infiltracao recebe triagem tecnica sem orcamento de alvenaria", async function ({ page }) {
    const answer = await enhance(page, "sou sindico e apareceu infiltracao no predio", "Isso pede triagem tecnica antes de qualquer reparo. Possiveis causas: falha de impermeabilizacao.");
    const memory = await state(page);

    expect(memory.persona).toBe("sindico/condominio");
    expect(memory.pain).toBe("patologia/infiltracao");
    expectText(answer, /triagem tecnica|checklist de vistoria|relatorio preliminar/i);
    expect(String(answer || "")).not.toMatch(/Servico controlado identificado|tipo de bloco|orcamento assistido de alvenaria/i);
  });

  test("imobiliaria com vistoria recebe oferta de checklist e relatorio", async function ({ page }) {
    const answer = await enhance(page, "tenho uma imobiliaria e preciso padronizar vistorias");
    const memory = await state(page);

    expect(memory.persona).toBe("imobiliaria");
    expect(memory.pain).toMatch(/vistoria|documentacao/);
    expectText(answer, /padronizar vistorias|checklist|relatorio/i);
  });

  test("pergunta de preco vira lead hot e propoe teste com caso real sem inventar preco", async function ({ page }) {
    const answer = await enhance(page, "quanto custa para testar?");
    const memory = await state(page);

    expect(memory.leadTemperature).toBe("hot");
    expect(memory.commercialStage).toBe("fechamento");
    expectText(answer, /caso real/i);
    expectText(answer, /relatorio|orcamento|checklist|RDO/i);
    expect(String(answer || "")).not.toMatch(/R\$|\d+[,.]\d{2}|mensalidade de/i);
  });

  test("bom dia abre objetivo sem venda pesada", async function ({ page }) {
    const answer = await enhance(page, "bom dia");
    const memory = await state(page);

    expect(memory.leadTemperature).toBe("cold");
    expectText(answer, /Me diga o que voce quer resolver agora/i);
    expect(String(answer || "")).not.toMatch(/assinar|contratar|mensalidade|plano|preco/i);
  });

  test("orcamento de casa preserva coleta tecnica sem virar discurso comercial", async function ({ page }) {
    const technicalAnswer = "Preciso de poucos dados para montar o orcamento: cidade/estado, area aproximada em m2, padrao desejado e tipo da obra.";
    const answer = await enhance(page, "quero orcamento de uma casa", technicalAnswer);
    const memory = await state(page);

    expect(memory.pain).toBe("orcamento/custo");
    expectText(answer, /cidade\/estado/i);
    expectText(answer, /area aproximada/i);
    expectText(answer, /padrao/i);
    expect(String(answer || "")).not.toMatch(/reduzir seu tempo|vender|contratar|mensalidade/i);
  });
});