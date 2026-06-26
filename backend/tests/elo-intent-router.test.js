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

test("Elo expõe roteadores de anexo no motor compartilhado", () => {
  const { assistant } = loadAssistant();

  assert.equal(typeof assistant.ask, "function");
  assert.equal(typeof assistant.mountMinimal, "function");
});
