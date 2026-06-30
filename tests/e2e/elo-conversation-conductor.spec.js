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

async function enhance(page, userMessage, assistantResponse = "Entendi sua solicitação.") {
  return page.evaluate(function (payload) {
    return window.EloConversationConductor.enhanceResponse(payload);
  }, {
    userMessage: userMessage,
    assistantResponse: assistantResponse,
    context: {}
  });
}

function expectText(received, expected) {
  expect(String(received || "")).toMatch(expected);
}

test.describe("EloConversationConductor", function () {
  test.beforeEach(async function ({ page }) {
    await loadConductor(page);
  });

  test("conduz duvida de infiltracao para diagnostico preliminar", async function ({ page }) {
    const answer = await enhance(page, "tenho infiltração na parede");

    expectText(answer, /diagnostico preliminar|possiveis causas|riscos|proximos passos/i);
  });

  test("conduz pedido de orcamento para coleta minima", async function ({ page }) {
    const answer = await enhance(page, "quero orçamento de uma casa");

    expectText(answer, /tipo da obra/i);
    expectText(answer, /cidade\/estado/i);
    expectText(answer, /area aproximada/i);
    expectText(answer, /padrao/i);
  });

  test("conduz laudo tecnico para estrutura de relatorio", async function ({ page }) {
    const answer = await enhance(page, "preciso de um laudo técnico");

    expectText(answer, /fotos/i);
    expectText(answer, /estrutura do relatorio tecnico/i);
  });

  test("conduz pergunta de preco para caso real", async function ({ page }) {
    await enhance(page, "bom dia");
    const answer = await enhance(page, "quanto custa?");

    expectText(answer, /caso real/i);
    expectText(answer, /relatorio|orcamento|checklist|RDO/i);
  });

  test("bom dia abre objetivo sem forcar venda pesada", async function ({ page }) {
    const answer = await enhance(page, "bom dia");

    expectText(answer, /objetivo agora/i);
    expect(String(answer || "")).not.toMatch(/assinar|contratar|mensalidade/i);
  });
});
