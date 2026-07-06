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

  assert.equal(assistant.detectPriorityIntentForTest("Ola, voce pode me ajudar com minha obra?"), "greeting");
  assert.equal(response.fastPath, "greeting");
  assert.match(response.fullAnswer, /orcamento|SINAPI|obra/i);
  assertNoTechnicalCalls(calls);
});

test("IntentRouter salva memoria da obra sem buscar composicao", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Minha obra Residencial Alfa fica em Vitoria da Conquista-BA, tem 120 m2 e padrao medio.");

  assert.equal(response.sessionIntent, "project_memory");
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
  assert.equal(stock.sessionTheme, "almoxarifado_operacional");
  assert.equal(reports.sessionTheme, "relatorios_operacionais");
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
    assert.match(response.fullAnswer, /Triagem|vistoria|causas|verificar|Possiveis causas|Possíveis causas/i, message);
    assert.doesNotMatch(response.fullAnswer, /Servico controlado identificado|tipo de bloco|composicao SINAPI|orçamento assistido de alvenaria/i, message);
  });
  assertNoTechnicalCalls(calls);
});
test("IntentRouter consulta patologia antes do atalho imediato de alvenaria", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const pathologyIndex = source.indexOf("const immediatePathologyResponse = buildEloConstructionPathologyAnswer_(cleanQuestion);");
  const wallIndex = source.indexOf("const immediateWallResponse = buildEloWallContinuationAnswer_(cleanQuestion) || buildEloWallServiceAnswer_(cleanQuestion);");

  assert.notEqual(pathologyIndex, -1);
  assert.notEqual(wallIndex, -1);
  assert.ok(pathologyIndex < wallIndex);
});
test("IntentRouter captura patologia no chat minimo antes do submit comum", () => {
  const source = readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8");
  const captureIndex = source.indexOf("form.dataset.eloPathologyCaptureBound");
  const regularIndex = source.indexOf("form.dataset.eloEngineBound", captureIndex);

  assert.notEqual(captureIndex, -1);
  assert.notEqual(regularIndex, -1);
  assert.ok(captureIndex < regularIndex);
});
test("IntentRouter encaminha proposta e PDF sem busca SINAPI", () => {
  const { assistant, calls } = loadAssistant();
  const proposal = assistant.buildResponseForTest("Gerar proposta tecnica para cliente.");
  const pdf = assistant.buildResponseForTest("Baixar PDF.");

  assert.match(proposal.fullAnswer, /PROPOSTA|SERVICOS|pendente|responsabilidade/i);
  assert.equal(pdf.sessionIntent, "pdf_export");
  assert.match(pdf.fullAnswer, /PDF|documental|export/i);
  assertNoTechnicalCalls(calls);
});


test("IntentRouter evidencia area liquida 206 m2 no orcamento longo", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest([
    "Quero orcamento residencial preliminar para uma casa terrea de 120 m2.",
    "Paredes: 80 m de parede com 2,80 m de altura portas e janelas 18 m2.",
    "Fundacao: 8 sapatas 1,20 x 1,20 x 0,40 e 42 m de baldrame 15 x 30.",
    "Estrutura: 12 pilares 20 x 20 x 3 e 30 m de vigas 15 x 40."
  ].join("\n"));

  assert.equal(response.fastPath, "intent_router_budget_area");
  assert.match(response.fullAnswer, /206,00\s*m2/i);
});

test("Elo expÃµe roteadores de anexo no motor compartilhado", () => {
  const { assistant } = loadAssistant();

  assert.equal(typeof assistant.ask, "function");
  assert.equal(typeof assistant.mountMinimal, "function");
});


test("PDF profissional de orcamento nao despeja HTML no chat e gera artefato completo", () => {
  const { assistant, calls } = loadAssistant();
  assistant.clearBudgetRecordsForTest();
  assistant.setLastBudgetSourceForTest({
    question: "orcamento residencial",
    theme: "residential_budget_package",
    intent: "residential_budget_package",
    answer: [
      "Orcamento residencial preliminar",
      "Casa terrea de 120 m2.",
      "Parede / alvenaria",
      "Area bruta: 80,00 x 2,80 = 224,00 m2",
      "Vaos de portas e janelas: 18,00 m2",
      "Area liquida de parede: 224,00 - 18,00 = 206,00 m2.",
      "Fundacao - 8 sapatas e 42 m de baldrame.",
      "Estrutura - 12 pilares e 30 m de vigas.",
      "Pendencias tecnicas",
      "Confirmar BDI e composicoes oficiais."
    ].join("\n")
  });

  const saved = assistant.buildResponseForTest("Salvar orcamento.");
  assert.equal(saved.sessionIntent, "budget_saved");
  assert.match(saved.fullAnswer, /Gerar PDF do Or/i);
  assert.equal(saved.pdfAction.type, "budget_pdf");

  const [record] = assistant.getBudgetRecordsForTest();
  const html = assistant.buildBudgetRecordHtmlForTest(record, false);

  assert.match(html, new RegExp("PROPOSTA T\\u00c9CNICA DE OR\\u00c7AMENTO"));
  [
    "PROPOSTA T\u00c9CNICA DE OR\u00c7AMENTO",
    "\u00cdCARO AMARAL ENGENHARIA",
    "\u00cdcaro Amaral de Ara\u00fajo",
    "\u00c1rea constru\u00edda",
    "Responsabilidade t\u00e9cnica",
    "Servi\u00e7os previstos",
    "Premissas e observa\u00e7\u00f5es",
    "SINAPI BA 2024-12",
    "\u00c1rea l\u00edquida de parede = 206,00 m\u00b2",
    "Imprimir / Salvar como PDF",
    "Fechar"
  ].forEach((expected) => assert.ok(html.includes(expected), expected));
  const q = String.fromCharCode(63);
  ["T" + q + "CNICA", "OR" + q + "AMENTO", "constru" + q + "da", "revis" + q + "o", "servi" + q + "os", "observa" + q + q + "es", "Ara" + q + "jo", q + "caro", "composi" + q + q + "o"].forEach((broken) => {
    assert.ok(!html.includes(broken), broken);
  });

  const pdf = assistant.buildResponseForTest("Baixar PDF do orcamento " + record.numero + ".");
  assert.equal(pdf.sessionIntent, "budget_pdf");
  assert.doesNotMatch(pdf.fullAnswer, /<html|<section|HTML gerado/i);
  assert.match(pdf.fullAnswer, /PDF profissional preparado|nova janela|Abrir PDF novamente/i);
  assert.equal(pdf.pdfAction.type, "budget_pdf");
  assertNoTechnicalCalls(calls);
});
