import { expect, test } from "@playwright/test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const stockObrasUrl = pathToFileURL(resolve("stock-ai-obras.html")).href;

const FLOW_MESSAGES = [
  "Vou fazer 60m² de alvenaria com bloco cerâmico, chapisco e reboco. Faça a composição.",
  "29x19x14",
  "EXISTE UMA PORTA DE 1X2,10 E UMA JANELA DE 1,20X0,90",
  "UMA PORTA"
];

async function sendStockObrasMessage(page, message, index) {
  await page.locator(".elo-input").fill(message);
  await page.locator(".elo-input").press("Enter");
  await expect.poll(async () => page.locator(".elo-message.assistant .elo-message-bubble").count()).toBe(index + 1);
  const answer = await page.locator(".elo-message.assistant .elo-message-bubble").last().innerText();
  const state = await page.evaluate(() => window.EloAssistente.getStockObrasBriefingForTest());

  console.log("[Elo Stock Obras audit]", JSON.stringify({
    passo: index + 1,
    mensagem: message,
    resposta: answer,
    estado_acumulado: state,
    funcao_perguntas_complementares: "stock-ai-obras-bridge.js permite fluxo -> buildEloWallPremiseCollectionResponse_ -> buildEloPremiseCollectionQuestion_",
    campo_faltante: state.pending_question || "nenhum",
    funcao_texto_antes_de_calcular: "buildEloPremiseCollectionQuestion_"
  }, null, 2));

  return { answer, state };
}

test.describe("Elo Stock Obras - briefing de composição", () => {
  test("acumula bloco e vãos sem loop na página Stock AI Obras", async ({ page }) => {
    await page.goto(stockObrasUrl);
    await page.waitForFunction(() => window.EloAssistente && window.EloAssistente.buildResponseForTest && window.EloAssistente.getStockObrasBriefingForTest);
    await page.evaluate(() => {
      window.EloAssistente.resetStockObrasBriefingForTest();
    });

    const first = await sendStockObrasMessage(page, FLOW_MESSAGES[0], 0);
    expect(first.state.area_bruta_m2).toBe(60);
    expect(first.state.servicos_solicitados).toEqual(expect.arrayContaining(["alvenaria com bloco ceramico", "chapisco", "reboco"]));
    expect(["bloco_ceramico_dimensao", "confirmar_bloco_parede"]).toContain(first.state.pending_question);
    expect(first.answer).toMatch(/dimensao do bloco|dimensão do bloco/i);

    const second = await sendStockObrasMessage(page, FLOW_MESSAGES[1], 1);
    expect(second.state.bloco_ceramico_dimensao_cm).toEqual([29, 19, 14]);
    expect(["vaos", "confirmar_vaos_parede"]).toContain(second.state.pending_question);
    expect(second.answer).not.toMatch(/Ajudo sim|mensagem solta|nao entendi|não entendi/i);

    const third = await sendStockObrasMessage(page, FLOW_MESSAGES[2], 2);
    expect(third.state.vaos.portas).toHaveLength(1);
    expect(third.state.vaos.janelas).toHaveLength(1);
    expect(third.state.vaos.portas[0]).toMatchObject({ quantidade: 1, largura_m: 1, altura_m: 2.1 });
    expect(third.state.vaos.janelas[0]).toMatchObject({ quantidade: 1, largura_m: 1.2, altura_m: 0.9 });
    expect(third.state.area_liquida_m2).toBeCloseTo(56.82, 5);
    expect(["", "confirmar_perda_parede", "confirmar_revestimento_parede"]).toContain(third.state.pending_question);
    expect(third.answer).toContain("56,82 m²");
    expect(third.answer).not.toMatch(/quantas portas/i);
    expect(third.answer).not.toMatch(/existem vaos\?|existem vãos\?/i);
    expect(third.answer).not.toMatch(/Antes de calcular, preciso saber se existem vaos.*Antes de calcular, preciso saber se existem vaos/is);

    const fourth = await sendStockObrasMessage(page, FLOW_MESSAGES[3], 3);
    expect(fourth.state.area_liquida_m2).toBeCloseTo(56.82, 5);
    expect(fourth.answer).toMatch(/ja estava considerada|já estava considerada|56,82 m²/i);
    expect(fourth.answer).not.toMatch(/quantas portas|existem vaos\?|existem vãos\?/i);
  });
});