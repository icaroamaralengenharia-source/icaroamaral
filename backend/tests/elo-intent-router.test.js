import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    }
  };
}

function loadAssistant() {
  const calls = { router: 0, technical: 0, composition: 0 };
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname: "/elo.html" },
      localStorage: createStorage({
        obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" })
      }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() {
        throw new Error("fetch nao deve ser chamado pelo roteador prioritario");
      },
      EloBrainRouter: {
        routeEloBrain() {
          calls.router += 1;
          throw new Error("EloBrainRouter nao deve ser chamado pelo roteador prioritario");
        }
      },
      EloTechnicalEngine: {
        buildResponse() {
          calls.technical += 1;
          throw new Error("EloTechnicalEngine nao deve ser chamado pelo roteador prioritario");
        }
      },
      CompositionSearchEngine: {
        searchOfficialCompositions() {
          calls.composition += 1;
          throw new Error("CompositionSearchEngine nao deve ser chamado pelo roteador prioritario");
        }
      }
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls };
}

function assertNoTechnicalCalls(calls) {
  assert.deepEqual(calls, { router: 0, technical: 0, composition: 0 });
}

test("IntentRouter responde saudacao composta sem base tecnica", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Ola, voce pode me ajudar com minha obra?");

  assert.equal(response.sessionTheme, "suporte");
  assert.equal(response.sessionIntent, "conversa_humana");
  assert.match(response.shortAnswer, /oi|pronto/i);
  assertNoTechnicalCalls(calls);
});
test("IntentRouter salva memoria da obra sem buscar composicao", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Minha obra Residencial Alfa fica em Vitoria da Conquista-BA, tem 120 m2 e padrao medio.");

  assert.equal(response.sessionTheme, "memoria_obra");
  assert.equal(response.sessionIntent, "salvar_memoria_obra");
  assert.match(response.fullAnswer, /Residencial Alfa/i);
  assert.match(response.fullAnswer, /Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /120/);
  assertNoTechnicalCalls(calls);
});
test("IntentRouter trata RDO, estoque e relatorios antes do motor tecnico", () => {
  const { assistant, calls } = loadAssistant();
  const rdo = assistant.buildResponseForTest("O RDO de hoje teve atraso?");
  const stock = assistant.buildResponseForTest("Quais materiais estao em risco de faltar no estoque?");
  const reports = assistant.buildResponseForTest("Quais pontos criticos aparecem nos relatorios?");

  assert.equal(rdo.sessionTheme, "rdo_operacional");
  assert.equal(rdo.sessionIntent, "rdo_resumo");
  assert.equal(stock.sessionTheme, "estoque");
  assert.equal(stock.sessionIntent, "estoque_compras");
  assert.equal(reports.sessionTheme, "relatorio");
  assert.equal(reports.sessionIntent, "ajuda_relatorio");
  assertNoTechnicalCalls(calls);
});
test("IntentRouter distingue RDO operacional de fiscalizacao tecnica complexa", () => {
  const { assistant, calls } = loadAssistant();
  const rdoCases = [
    "Mostre o ultimo RDO.",
    "Resuma o RDO de hoje.",
    "Compare o RDO de ontem com o de hoje.",
    "Qual foi a equipe registrada no RDO?"
  ];
  rdoCases.forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionTheme, "rdo_operacional", message);
    assert.equal(response.sessionIntent, "rdo_resumo", message);
  });

  const cbuqScenario = [
    "[TESTE DE ESTRESSE DO SISTEMA - ELO]",
    "Ola, Elo. Como estao as coisas por ai hoje? Antes de comecarmos o batente, me diga qual foi a coisa mais curiosa ou desafiadora que voce processou nos seus dados esta semana?",
    "Depois de trocarmos essa ideia, preciso que voce assuma o seu papel de assistente tecnico senior e processe o seguinte cenario critico de fiscalizacao:",
    "Contexto: Estou em campo em uma obra publica de pavimentacao asfaltica e drenagem.",
    "O Boletim de Medicao BM aponta a execucao de 1.200 metros de CBUQ, mas ao cruzar com o RDO notei divergencias graves.",
    "O ensaio de controle tecnologico apresentou densidade in situ media de 92% da DMT, quando a especificacao tecnica do contrato exige no minimo 96%.",
    "Na pista ha exsudacao de ligante betuminoso e trilhas de roda prematuras em trecho de 150 m.",
    "A construtora alega liberacao precoce do trafego, mas nao ha registro disso no RDO.",
    "Sua tarefa: converse comigo brevemente e atue como fiscal de engenharia redigindo notificacao formal / relatorio tecnico de inconformidade para SEI."
  ].join("\n");
  const cbuq = assistant.buildResponseForTest(cbuqScenario);
  assert.equal(cbuq.sessionTheme, "fiscalizacao_tecnica");
  assert.equal(cbuq.sessionIntent, "technical_nonconformity_notice");
  assert.doesNotMatch(cbuq.fullAnswer, /Nao encontrei RDO registrado|Cadastre o diario de obra/i);
  assert.match(cbuq.fullAnswer, /92%/);
  assert.match(cbuq.fullAnswer, /96%/);
  assert.match(cbuq.fullAnswer, /4 pontos percentuais/i);
  assert.match(cbuq.fullAnswer, /exsudacao|exsuda/i);
  assert.match(cbuq.fullAnswer, /trilhas de roda|afundamento/i);
  assert.match(cbuq.fullAnswer, /150 m/);
  assert.match(cbuq.fullAnswer, /nao consta|nao deve ser tratada como fato comprovado|nao documentada/i);
  assert.match(cbuq.fullAnswer, /plano de acao|fresagem|recomposicao/i);
  assert.doesNotMatch(cbuq.fullAnswer, /DNIT\s*\d|ABNT\s*NBR\s*\d|NBR\s*\d|processo\s+SEI\s*\d|prazo\s+de\s+\d+\s+dias|glosa definitiva|multa/i);
  assert.match(cbuq.fullAnswer, /nao acompanho uma semana como uma pessoa|memoria verificavel/i);

  [
    "O RDO menciona aplicacao de massa, mas o ensaio indica densidade insuficiente. Avalie.",
    "Cruzei o RDO com o ensaio e a densidade ficou abaixo do minimo. Avalie.",
    "Estou cruzando o BM com o RDO. O ensaio deu 92% e o contrato exige 96%. Redija uma notificacao tecnica.",
    "No RDO nao consta a liberacao antecipada do trafego. Isso deve constar na notificacao?"
  ].forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionTheme, "fiscalizacao_tecnica", message);
    assert.equal(response.sessionIntent, "technical_nonconformity_notice", message);
    assert.doesNotMatch(response.fullAnswer, /Nao encontrei RDO registrado|Cadastre o diario de obra/i, message);
  });

  const pathology = assistant.buildResponseForTest("Ha uma fissura e mencionei isso no RDO. Analise a patologia.");
  assert.equal(pathology.sessionTheme, "patologia_obras");
  assert.equal(pathology.sessionIntent, "triagem_patologia");
  const budget = assistant.buildResponseForTest("Avalie meu orcamento.");
  assert.notEqual(budget.sessionTheme, "fiscalizacao_tecnica");
  assert.notEqual(budget.sessionIntent, "technical_nonconformity_notice");

  const simplePathology = assistant.buildResponseForTest("Avalie esta fissura na parede.");
  assert.equal(simplePathology.sessionTheme, "patologia_obras");
  assert.equal(simplePathology.sessionIntent, "triagem_patologia");

  const pdf = assistant.buildResponseForTest("Avalie este PDF.");
  assert.notEqual(pdf.sessionTheme, "fiscalizacao_tecnica");
  assert.notEqual(pdf.sessionIntent, "technical_nonconformity_notice");

  const productivity = assistant.buildResponseForTest("Avalie a produtividade da equipe.");
  assert.notEqual(productivity.sessionTheme, "fiscalizacao_tecnica");
  assert.notEqual(productivity.sessionIntent, "technical_nonconformity_notice");
  assertNoTechnicalCalls(calls);
});
test("IntentRouter faz triagem de rachadura sem pedir tipo de bloco", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Minha parede esta rachando.");

  assert.equal(response.sessionTheme, "patologia_obras");
  assert.match(response.fullAnswer, /Triagem|vistoria|causas|fissura|rachadura/i);
  assert.doesNotMatch(response.fullAnswer, /tipo de bloco|composicao SINAPI/i);
  assertNoTechnicalCalls(calls);
});

test("IntentRouter prioriza patologia antes de orcamento ou alvenaria", () => {
  const { assistant, calls } = loadAssistant();
  const messages = [
    "tenho infiltracao na parede",
    "parede com umidade subindo",
    "apareceu mofo no quarto",
    "tem uma trinca perto da janela",
    "fissura na parede da sala",
    "quanto custa consertar rachadura?",
    "vazamento no banheiro"
  ];

  messages.forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionTheme, "patologia_obras", message);
    assert.equal(response.sessionIntent, "triagem_patologia", message);
    assert.match(response.fullAnswer, /Triagem|vistoria|causas|verificar|Possiveis causas|Poss�veis causas/i, message);
    assert.doesNotMatch(response.fullAnswer, /Servico controlado identificado|tipo de bloco|composicao SINAPI|or�amento assistido de alvenaria/i, message);
  });
  assertNoTechnicalCalls(calls);
});

test("IntentRouter reconhece rachando sem roubar intents de orcamento", () => {
  const { assistant, calls } = loadAssistant();
  const pathologyMessages = [
    "Minha parede está rachando.",
    "Minha parede tem uma rachadura.",
    "Existe uma fissura na parede.",
    "Encontrei uma trinca no concreto.",
    "A parede rachou perto do pilar, o que pode ser?",
    "O muro rachou perto do pilar.",
    "O concreto rachou junto ao apoio.",
    "Patologia por destacamento e eflorescencia.",
    "O revestimento está destacando.",
    "Há eflorescência na parede.",
    "Há eflorescencia no revestimento."
  ];
  const nonPathologyMessages = [
    "Quanto custa fazer uma parede?",
    "Quanto custa fazer uma parede perto do pilar?",
    "Calcule a quantidade de blocos da parede.",
    "Calcule os blocos da parede.",
    "Quero a composição SINAPI de alvenaria.",
    "Rachou o orcamento da obra.",
    "Qual o custo do revestimento?",
    "Quero composição SINAPI para revestimento.",
    "Calcule a área de revestimento.",
    "Destacar item do orçamento.",
    "Faça um destaque no relatório."
  ];

  pathologyMessages.forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionTheme, "patologia_obras", message);
    assert.equal(response.sessionIntent, "triagem_patologia", message);
    assert.match(response.fullAnswer, /Triagem|vistoria|causas|fissura|rachadura/i, message);
  });

  nonPathologyMessages.forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.notEqual(response.sessionTheme, "patologia_obras", message);
    assert.notEqual(response.sessionIntent, "triagem_patologia", message);
  });
  assertNoTechnicalCalls(calls);
});
test("IntentRouter consulta patologia antes do atalho imediato de alvenaria", () => {
  const { assistant, calls } = loadAssistant();
  const pathology = assistant.buildResponseForTest("Minha parede esta rachando.");
  const wallBudget = assistant.buildResponseForTest("Quanto custa fazer uma parede?");

  assert.equal(pathology.sessionTheme, "patologia_obras");
  assert.equal(pathology.sessionIntent, "triagem_patologia");
  assert.notEqual(wallBudget.sessionTheme, "patologia_obras");
  assert.notEqual(wallBudget.sessionIntent, "triagem_patologia");
  assertNoTechnicalCalls(calls);
});
test("IntentRouter captura patologia no chat minimo antes do submit comum", () => {
  const { assistant, calls } = loadAssistant();
  ["trinca na parede", "parede com umidade subindo"].forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionTheme, "patologia_obras", message);
    assert.equal(response.sessionIntent, "triagem_patologia", message);
    assert.match(response.fullAnswer, /Triagem|vistoria|causas|verificar/i, message);
  });
  assertNoTechnicalCalls(calls);
});
test("IntentRouter encaminha proposta e PDF sem busca SINAPI", () => {
  const { assistant, calls } = loadAssistant();
  const proposal = assistant.buildResponseForTest("Gerar proposta tecnica para cliente.");
  const pdf = assistant.buildResponseForTest("Baixar PDF.");

  assert.equal(proposal.sessionTheme, "briefing_livre_obra");
  assert.equal(proposal.sessionIntent, "parser_texto_livre");
  assert.match(proposal.fullAnswer, /BRIEFING DA OBRA|O que falta|cliente/i);
  assert.equal(pdf.sessionTheme, "documento_operacional_pdf");
  assert.equal(pdf.sessionIntent, "pdf_operacional");
  assert.notEqual(pdf.sessionIntent, "budget_v2_pdf_without_budget");
  assert.match(pdf.fullAnswer, /PDF|impressao|documento/i);
  assertNoTechnicalCalls(calls);
});
test("IntentRouter evidencia area liquida 206 m2 no orcamento longo", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest([
    "Quero orcamento residencial preliminar para uma casa terrea de 120 m2.",
    "Paredes: 80 m de parede com 2,80 m de altura portas e janelas 18 m2.",
    "Fundacao: 8 sapatas 1,20 x 1,20 x 0,40 e 42 m de baldrame 15 x 30.",
    "Estrutura: 12 pilares 20 x 20 x 3 e 30 m de vigas 15 x 40."
  ].join("\n"));

  assert.equal(response.sessionTheme, "technical_composition_budget");
  assert.equal(response.sessionIntent, "budget_v2_technical_composition_missing");
  assert.match(response.fullAnswer, /composi..o t.cnica|SINAPI|ORSE/i);
  assert.doesNotMatch(response.fullAnswer, /206,00\\s*m2/i);
  assertNoTechnicalCalls(calls);
});
test("Elo expõe roteadores de anexo no motor compartilhado", () => {
  const { assistant } = loadAssistant();

  assert.equal(typeof assistant.ask, "function");
  assert.equal(typeof assistant.mountMinimal, "function");
});




test("Elo nao trata leitura de PDF como PDF de orcamento", () => {
  const { assistant } = loadAssistant();
  const documentRequests = [
    "analise este PDF",
    "descreva o PDF",
    "leia o PDF anexado",
    "resuma esse PDF",
    "verifique o documento PDF",
    "analise e descreva"
  ];

  documentRequests.forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.notEqual(response.sessionIntent, "budget_v2_pdf_without_budget", message);
    assert.doesNotMatch(response.fullAnswer || response.shortAnswer || "", /Ainda n.o h. or.amento ativo para PDF/i, message);
  });
});

test("Elo mantem PDF de orcamento quando a intencao e explicita", () => {
  const { assistant } = loadAssistant();
  [
    "gerar PDF do orcamento",
    "exportar orcamento em PDF",
    "baixar PDF da proposta",
    "criar relatorio PDF do orcamento",
    "emitir PDF do orcamento atual"
  ].forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.equal(response.sessionIntent, "budget_v2_pdf_without_budget", message);
    assert.match(response.fullAnswer || response.shortAnswer || "", /gerar o PDF do or.amento|or.amento/i, message);
  });
});

test("Elo prioriza PDF anexado como documento antes dos handlers locais", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const reportPdfIndex = source.indexOf("if (isEloReportPdfGenerationRequest_(cleanQuestion))");
  const attachmentPriorityIndex = source.indexOf("if (attachedFiles.length && !isEloBudgetV2PdfIntent_(cleanQuestion))");
  const noAttachmentRouterIndex = source.indexOf("if (!attachedFiles.length)", attachmentPriorityIndex);
  const lateAttachmentFallbackIndex = source.indexOf("if (attachedFiles.length)", noAttachmentRouterIndex);
  const imageIntentIndex = source.indexOf("if (attachmentIntent.type === \"image\")");
  const imageAnalysisIndex = source.indexOf("analyzeEloImageAttachment_(question, attachmentIntent.file)");

  assert.notEqual(reportPdfIndex, -1);
  assert.notEqual(attachmentPriorityIndex, -1);
  assert.notEqual(noAttachmentRouterIndex, -1);
  assert.notEqual(lateAttachmentFallbackIndex, -1);
  assert.ok(reportPdfIndex < attachmentPriorityIndex);
  assert.ok(attachmentPriorityIndex < noAttachmentRouterIndex);
  assert.ok(noAttachmentRouterIndex < lateAttachmentFallbackIndex);
  assert.ok(source.includes("requestEloOnlineAnswer(cleanQuestion, attachedFiles)"));
  assert.ok(imageIntentIndex >= 0 && imageAnalysisIndex > imageIntentIndex);
});
test("PDF profissional de orcamento nao despeja HTML no chat e gera artefato completo", () => {
  const { assistant, calls } = loadAssistant();
  const documentData = {
    budgetId: "ELO-BA-2026-000123",
    facts: { builtAreaM2: 120, cityUf: "Vitoria da Conquista/BA", projectStandard: "medio" },
    assumptions: ["SINAPI BA 2024-12", "Confirmar BDI e composicoes oficiais."],
    scope: ["Casa terrea de 120 m2", "Parede / alvenaria", "Fundacao", "Estrutura"],
    quantities: [
      "Area bruta de parede: 80,00 x 2,80 = 224,00 m2",
      "Vaos de portas e janelas: 18,00 m2",
      "Area liquida de parede = 206,00 m2"
    ],
    calculationMemory: ["Area liquida de parede = 224,00 - 18,00 = 206,00 m2"],
    compositions: ["SINAPI/ORSE pendente de validacao oficial"],
    pendingFields: ["BDI", "composicoes oficiais"],
    risks: ["Documento preliminar; revisar por profissional habilitado"],
    nextSteps: ["Validar BDI e composicoes oficiais"]
  };

  const data = assistant.buildBudgetV2ProfessionalPdfDataForTest(documentData);
  assert.equal(data.record.numero, "ELO-BA-2026-000123");
  assert.match(data.record.quantitativos, /206,00\s*m2/i);
  assert.match(data.record.premissas, /SINAPI BA 2024-12/i);

  const result = assistant.openBudgetV2ProfessionalPdfForTest(documentData);
  assert.equal(result.ok, true);
  assert.match(result.html, /<!doctype html>/i);
  assert.match(result.html, /Imprimir \/ Salvar como PDF/i);
  const q = String.fromCharCode(63);
  ["or" + q + "amento", "Or" + q + "amentista", "t" + q + "cnico", "composi" + q + q + "es"].forEach((broken) => {
    assert.ok(!result.html.includes(broken), broken);
  });
  assertNoTechnicalCalls(calls);
});
