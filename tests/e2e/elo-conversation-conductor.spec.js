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

  test("descobre objetivo de responder cliente e conduz tom da mensagem", async function ({ page }) {
    const answer = await enhance(page, "tenho infiltracao na parede e preciso responder meu cliente");
    const memory = await state(page);

    expect(memory.hiddenObjective).toBe("responder_cliente");
    expect(memory.strategyMode).toBe("consultoria_cliente");
    expect(memory.strategyDeliverable).toBe("mensagem pronta para cliente");
    expectText(answer, /mensagem pronta para cliente|resposta profissional para cliente/i);
    expectText(answer, /tecnica, tranquilizadora ou mais firme/i);
  });

  test("orcamento de casa pergunta finalidade sem perder coleta tecnica", async function ({ page }) {
    const technicalAnswer = "Preciso de poucos dados para montar o orcamento: cidade/estado, area aproximada em m2, padrao desejado e tipo da obra.";
    const answer = await enhance(page, "quero orcamento de uma casa", technicalAnswer);
    const memory = await state(page);

    expect(memory.hiddenObjective).toBe("montar_orcamento");
    expect(memory.strategyMode).toBe("orcamento_guiado");
    expectText(answer, /cidade\/estado/i);
    expectText(answer, /area aproximada/i);
    expectText(answer, /padrao/i);
    expectText(answer, /cliente, estudar viabilidade ou executar a obra/i);
    expect(String(answer || "")).not.toMatch(/assinar|contratar|mensalidade|plano/i);
  });

  test("laudo tecnico coleta destinatario antes de estruturar documento", async function ({ page }) {
    const answer = await enhance(page, "preciso de um laudo tecnico");
    const memory = await state(page);

    expect(memory.hiddenObjective).toBe("elaborar_laudo");
    expect(memory.strategyMode).toBe("coleta_para_documento");
    expect(memory.strategyDeliverable).toBe("estrutura de laudo tecnico");
    expectText(answer, /cliente, condominio, justica, banco ou prefeitura/i);
  });

  test("sindico com rachadura aumentando prioriza triagem de risco", async function ({ page }) {
    const answer = await enhance(page, "sou sindico e apareceu uma rachadura aumentando", "Isso pede triagem tecnica antes de qualquer reparo. Possiveis causas: movimentacao, fissuracao ativa ou falha estrutural.");
    const memory = await state(page);

    expect(memory.persona).toBe("sindico_condominio");
    expect(memory.urgency).toBe("alta");
    expect(["triagem_tecnica", "decisao_condominio"]).toContain(memory.strategyMode);
    expectText(answer, /risco|aumento rapido|vazamento ativo|deformacao|estalo|deslocamento/i);
    expect(String(answer || "")).not.toMatch(/tipo de bloco|orcamento assistido de alvenaria|SINAPI|ORSE/i);
  });

  test("bom dia mantem resposta curta sem entrega ou venda pesada", async function ({ page }) {
    const answer = await enhance(page, "bom dia");
    const memory = await state(page);

    expect(memory.strategyMode).toBe("resposta_curta");
    expectText(answer, /Me diga o que voce quer resolver agora/i);
    expect(String(answer || "")).not.toMatch(/Entrega possivel|assinar|contratar|mensalidade|plano|preco/i);
  });

  test("preco para testar vira lead hot e sugere caso real sem inventar preco", async function ({ page }) {
    const baseAnswer = "Para calcular o custo, preciso saber exatamente o que voce quer testar e a escala do caso.";
    const answer = await enhance(page, "quanto custa para testar?", baseAnswer);
    const memory = await state(page);

    expect(memory.leadTemperature).toBe("hot");
    expect(memory.commercialStage).toBe("fechamento");
    expect(["montar_orcamento", "vender_servico"]).toContain(memory.hiddenObjective);
    expectText(answer, /caso real/i);
    expectText(answer, /relatorio|orcamento|checklist|RDO|comunicacao/i);
    expect(String(answer || "")).not.toMatch(/R\$|\d+[,.]\d{2}|mensalidade de/i);
  });
});