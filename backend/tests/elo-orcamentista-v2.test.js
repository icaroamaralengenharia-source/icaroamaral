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

function loadAssistant(pathname = "/elo.html", options = {}) {
  const calls = { router: 0, technical: 0, composition: 0, budgetEngine: 0 };
  const sandbox = {
    console,
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      location: { hostname: "localhost", protocol: "http:", origin: "http://localhost", pathname },
      localStorage: createStorage({
        obrareport_elo_perfil_usuario_v1: JSON.stringify({ userName: "Icaro" })
      }),
      performance: { mark() {}, now() { return 0; } },
      setTimeout() {},
      fetch() {
        throw new Error("fetch nao deve ser chamado pelo orcamentista local");
      },
      EloBrainRouter: {
        routeEloBrain() {
          calls.router += 1;
          return null;
        }
      },
      EloTechnicalEngine: {
        buildResponse() {
          calls.technical += 1;
          return null;
        }
      },
      CompositionSearchEngine: {
        searchOfficialCompositions() {
          calls.composition += 1;
          return [];
        }
      }
    }
  };
  if (options.budgetEngine) {
    sandbox.window.EloBudgetEngine = {
      buildPreliminaryBudget(projectFacts, technicalContext) {
        calls.budgetEngine += 1;
        return options.budgetEngine(projectFacts, technicalContext);
      }
    };
  }
  sandbox.globalThis = sandbox.window;  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls };
}

test("Orcamentista V2 inicia briefing residencial sem buscar SINAPI direto", () => {
  const { assistant, calls } = loadAssistant();
  const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar");

  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.match(response.fullAnswer, /area construida/i);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /padrao construtivo/i);
  assert.equal(calls.router, 0);
  assert.equal(calls.technical, 0);
  assert.equal(calls.composition, 0);
});

test("Orcamentista V2 continua briefing com area cidade e padrao sem reiniciar fluxo", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.equal(state.type, "residential");
  assert.equal(state.areaM2, 120);
  assert.equal(state.state, "BA");
  assert.match(state.city, /Vitoria da Conquista/i);
  assert.match(response.fullAnswer, /Dados confirmados/i);
  assert.match(response.fullAnswer, /area construida: 120 m2/i);
  assert.match(response.fullAnswer, /cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /padrao: medio/i);
  assert.doesNotMatch(response.fullAnswer, /Padrao de acabamento pendente/i);
  assert.match(response.fullAnswer, /Escopo preliminar/i);
  assert.match(response.fullAnswer, /Servicos preliminares/i);
  assert.match(response.fullAnswer, /Limpeza final/i);
});

test("Orcamentista V2 monta escopo para casa completa e avisa pendencias", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("quanto custa construir uma casa terrea de 100 m2 padrao simples?");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(state.type, "residential");
  assert.equal(state.areaM2, 100);
  assert.equal(state.standard, "simples");
  assert.match(response.fullAnswer, /Dados confirmados/i);
  assert.match(response.fullAnswer, /area construida: 100 m2/i);
  assert.match(response.fullAnswer, /padrao: simples/i);
  assert.doesNotMatch(response.fullAnswer, /Padrao de acabamento pendente/i);
  assert.match(response.fullAnswer, /Escopo preliminar/i);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /nao vou inventar preco/i);
});

test("Orcamentista V2 preserva fluxo de parede", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("orca uma parede de bloco baiano 8 metros por 2,80");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(state.type, "wall");
  assert.doesNotMatch(response.fullAnswer, /ORCAMENTO RESIDENCIAL PRELIMINAR/i);
  assert.match(response.fullAnswer, /parede|bloco|comprimento|altura|vãos|vaos|composição|composicao/i);
});

test("Orcamentista V2 nao inventa preco sem composicao oficial", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("quanto custa construir uma casa terrea de 100 m2 padrao simples?");

  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/i);
  assert.match(response.fullAnswer, /pendente de composicao SINAPI\/ORSE oficial|nao vou inventar preco/i);
});

test("Orcamentista V2 segue disponivel nas tres superficies compartilhadas", () => {
  ["/elo.html", "/stock-ai-obras.html", "/relatorio-qualidade-obras/relatorio-qualidade-obras.html"].forEach((pathname) => {
    const { assistant } = loadAssistant(pathname);
    const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar");
    assert.equal(typeof assistant.ask, "function", pathname);
    assert.equal(response.sessionIntent, "budget_v2_briefing", pathname);
    assert.match(response.fullAnswer, /ELO ORCAMENTISTA V2/i, pathname);
  });
});
test("Orcamentista V2 separa dados herdados sem apresentar como confirmados", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao simples");
  const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar para uma casa terrea de 120 m2.");

  assert.match(response.fullAnswer, /Dados confirmados:[\s\S]*area construida: 120 m2/i);
  assert.doesNotMatch(response.fullAnswer, /Dados confirmados:[\s\S]*cidade\/UF: Vitoria da Conquista\/BA[\s\S]*Dados herdados/i);
  assert.match(response.fullAnswer, /Dados herdados:[\s\S]*cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /Dados herdados:[\s\S]*padrao: simples/i);
  assert.match(response.fullAnswer, /Posso reutilizar esses dados ou deseja alterá-los\?/i);
});

test("Orcamentista V2 reutiliza memoria quando usuario confirma dados herdados", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const response = assistant.buildResponseForTest("quero orçamento residencial preliminar para casa térrea de 120 m2");

  assert.match(response.fullAnswer, /Dados herdados:[\s\S]*cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /Dados herdados:[\s\S]*padrao: medio/i);
  assert.match(response.fullAnswer, /Posso reutilizar esses dados ou deseja alterá-los\?/i);
});

test("Orcamentista V2 gera lista qualitativa de materiais sem quantidade nem preco", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const response = assistant.buildResponseForTest("faça a lista de materiais");

  assert.equal(response.sessionIntent, "budget_v2_material_list");
  assert.match(response.fullAnswer, /LISTA PRELIMINAR QUALITATIVA DE MATERIAIS/i);
  assert.match(response.fullAnswer, /Fundação[\s\S]*concreto[\s\S]*aço[\s\S]*brita[\s\S]*formas/i);
  assert.match(response.fullAnswer, /Instalações elétricas[\s\S]*cabos[\s\S]*eletrodutos[\s\S]*quadro[\s\S]*tomadas/i);
  assert.match(response.fullAnswer, /Esta é uma lista preliminar qualitativa/i);
  assert.match(response.fullAnswer, /quantificação dependerá do projeto, memorial e composições oficiais/i);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d|\b\d+[,.]?\d*\s*(kg|m2|m3|un)\b/i);
});

test("Orcamentista V2 nao duplica campos entre confirmados herdados assumidos e pendentes", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");

  const answer = response.fullAnswer;
  const confirmed = answer.slice(answer.indexOf("Dados confirmados:"), answer.indexOf("Dados herdados:"));
  const inherited = answer.slice(answer.indexOf("Dados herdados:"), answer.indexOf("Dados assumidos:"));
  const assumed = answer.slice(answer.indexOf("Dados assumidos:"), answer.indexOf("Dados pendentes:"));
  const pending = answer.slice(answer.indexOf("Dados pendentes:"), answer.indexOf("Escopo preliminar:"));

  assert.match(confirmed, /area construida|cidade\/UF|padrao/i);
  assert.doesNotMatch(inherited, /area construida|cidade\/UF|padrao/i);
  assert.doesNotMatch(assumed, /padrao|cidade|area/i);
  assert.doesNotMatch(pending, /area construida|cidade\/UF|padrao construtivo/i);
});
test("Orcamentista V2 libera mensagem obrigado depois de orcamento ativo", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const response = assistant.buildResponseForTest("obrigado");

  assert.notEqual(response.sessionIntent, "budget_v2_scope");
  assert.notEqual(response.sessionIntent, "budget_v2_briefing");
  assert.doesNotMatch(response.fullAnswer || response.shortAnswer || "", /ELO ORCAMENTISTA V2|ORCAMENTO RESIDENCIAL PRELIMINAR/i);
});

test("Orcamentista V2 libera relatorio tecnico depois de orcamento ativo", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const response = assistant.buildResponseForTest("quero um relatório técnico");

  assert.notEqual(response.sessionIntent, "budget_v2_scope");
  assert.notEqual(response.sessionIntent, "budget_v2_briefing");
  assert.doesNotMatch(response.fullAnswer || response.shortAnswer || "", /ELO ORCAMENTISTA V2|ORCAMENTO RESIDENCIAL PRELIMINAR/i);
});

test("Orcamentista V2 transforma dados herdados em confirmados apos confirmacao", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  assistant.buildResponseForTest("Quero orcamento residencial preliminar para uma casa terrea de 120 m2.");
  const response = assistant.buildResponseForTest("sim, pode reutilizar");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(state.inheritedFields.length, 0);
  assert.ok(state.confirmedFields.includes("city"));
  assert.ok(state.confirmedFields.includes("state"));
  assert.ok(state.confirmedFields.includes("standard"));
  assert.match(response.fullAnswer, /Dados confirmados:[\s\S]*cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /Dados confirmados:[\s\S]*padrao: medio/i);
  assert.doesNotMatch(response.fullAnswer, /Dados herdados:[\s\S]*Vitoria da Conquista/i);
});

test("Orcamentista V2 novo orcamento limpa estado anterior", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const before = assistant.getBudgetOrchestratorV2StateForTest();
  const response = assistant.buildResponseForTest("novo orçamento");
  const after = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(response.sessionIntent, "budget_v2_reset");
  assert.ok(before.budgetId);
  assert.ok(after.budgetId);
  assert.notEqual(after.budgetId, before.budgetId);
  assert.equal(after.type, "unknown");
  assert.equal(after.city, "");
  assert.equal(after.standard, "");
  assert.match(response.fullAnswer, /Zerei o orçamento anterior/i);
});

test("Orcamentista V2 depois de limpar nao confirma cidade e padrao antigos", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  assistant.buildResponseForTest("limpar orçamento");
  const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar para uma casa terrea de 80 m2.");

  assert.match(response.fullAnswer, /Dados confirmados:[\s\S]*area construida: 80 m2/i);
  assert.doesNotMatch(response.fullAnswer, /Dados confirmados:[\s\S]*Vitoria da Conquista/i);
  assert.doesNotMatch(response.fullAnswer, /Dados confirmados:[\s\S]*padrao: medio/i);
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /padrao construtivo/i);
});

test("Orcamentista V2 lista de materiais continua sendo continuacao valida", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const response = assistant.buildResponseForTest("materiais dessa casa");

  assert.equal(response.sessionIntent, "budget_v2_material_list");
  assert.match(response.fullAnswer, /LISTA PRELIMINAR QUALITATIVA DE MATERIAIS/i);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/i);
});

function sampleBudgetV2DocumentData() {
  return {
    budgetId: "budget-v2-test-001",
    facts: {
      projectType: "residential",
      builtAreaM2: 120,
      areaConstruidaM2: 120,
      city: "Vitoria da Conquista",
      state: "BA",
      cityUf: "Vitoria da Conquista/BA",
      projectStandard: "medio",
      floors: 1
    },
    inheritedFacts: {
      cityUf: "Vitoria da Conquista/BA",
      projectStandard: "simples"
    },
    assumptions: ["1 pavimento"],
    pendingFields: ["composicoes oficiais", "BDI"],
    scope: [
      { label: "Servicos preliminares", status: "pending_official_composition" },
      { label: "Fundacao", status: "pending_official_composition" }
    ],
    materials: [
      { title: "Fundacao", items: ["concreto", "aco", "brita", "formas"] },
      { title: "Alvenaria", items: ["blocos", "argamassa", "vergas"] }
    ],
    quantities: [],
    compositions: [],
    budget: null,
    risks: ["Validar memoriais e base oficial antes de contratar."],
    nextSteps: ["Importar composicoes SINAPI/ORSE", "Validar BDI e encargos"]
  };
}

test("BudgetV2ProfessionalPdfAdapter converte documento V2 para entrada do PDF existente", () => {
  const { assistant } = loadAssistant();
  const data = assistant.buildBudgetV2ProfessionalPdfDataForTest(sampleBudgetV2DocumentData());

  assert.equal(data.record.numero, "budget-v2-test-001");
  assert.equal(data.record.titulo, "ELO Orçamentista V2");
  assert.equal(data.context.nomeDocumento, "ELO Orçamentista V2");
  assert.match(data.record.conteudo_markdown, /ID interno do orçamento: budget-v2-test-001/i);
  assert.match(data.record.conteudo_markdown, /Tipo: Orçamento residencial preliminar/i);
});

test("BudgetV2ProfessionalPdfAdapter reutiliza template profissional com dados confirmados herdados e pendencias", () => {
  const { assistant } = loadAssistant();
  const data = assistant.buildBudgetV2ProfessionalPdfDataForTest(sampleBudgetV2DocumentData());
  const html = assistant.buildProfessionalPdfDocumentForTest(data.record, data.context);

  assert.match(html, /elo-professional-pdf/);
  assert.match(html, /ELO Orçamentista V2/);
  assert.match(html, /Dados confirmados[\s\S]*area construida: 120 m2/i);
  assert.match(html, /Dados confirmados[\s\S]*padrao: medio/i);
  assert.match(html, /Dados herdados[\s\S]*Vitoria da Conquista\/BA/i);
  assert.match(html, /Dados herdados[\s\S]*padrao: simples/i);
  assert.match(html, /Pendencias e informacoes faltantes[\s\S]*composicoes oficiais/i);
  assert.match(html, /BDI/i);
});

test("BudgetV2ProfessionalPdfAdapter inclui materiais qualitativos e nao inventa valores", () => {
  const { assistant } = loadAssistant();
  const data = assistant.buildBudgetV2ProfessionalPdfDataForTest(sampleBudgetV2DocumentData());
  const html = assistant.buildProfessionalPdfDocumentForTest(data.record, data.context);

  assert.match(html, /Lista de materiais qualitativa/i);
  assert.match(html, /Fundacao[\s\S]*concreto[\s\S]*aco/i);
  assert.match(html, /Alvenaria[\s\S]*blocos[\s\S]*argamassa/i);
  assert.match(html, /valores pendentes/i);
  assert.doesNotMatch(html, /R\$\s*\d/i);
  assert.match(html, /Este documento é preliminar\. Quantitativos e valores dependem de projeto, memorial, composições oficiais SINAPI\/ORSE, BDI, encargos e preços vigentes\./i);
});

test("Orcamentista V2 mostra acao de PDF quando orcamento esta valido", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");

  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.ok(response.pdfAction);
  assert.equal(response.pdfAction.type, "budget_v2_professional_pdf");
  assert.equal(response.pdfAction.label, "Gerar PDF do or\u00e7amento");
  assert.ok(response.budgetOrchestratorV2.budgetDocumentData);
});


test("Orcamentista V2 continua fluxo visual multi-etapa ate liberar PDF", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  let response = assistant.buildResponseForTest("120 m2");

  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.match(response.fullAnswer, /cidade\/UF/i);
  assert.match(response.fullAnswer, /padrao construtivo/i);
  assert.equal(response.pdfAction, null);

  response = assistant.buildResponseForTest("Vitoria da Conquista - BA");
  assert.equal(response.sessionIntent, "budget_v2_briefing");
  assert.match(response.fullAnswer, /cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /padrao construtivo/i);
  assert.equal(response.pdfAction, null);

  response = assistant.buildResponseForTest("Padrao medio");
  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.match(response.fullAnswer, /padrao: medio/i);
  assert.ok(response.pdfAction);
  assert.equal(response.pdfAction.label, "Gerar PDF do or\u00e7amento");
  const data = assistant.buildBudgetV2ProfessionalPdfDataForTest(response.budgetOrchestratorV2.budgetDocumentData);
  const html = assistant.buildProfessionalPdfDocumentForTest(data.record, data.context);
  assert.match(html, /area construida: 120 m2/i);
  assert.match(html, /cidade\/UF: Vitoria da Conquista\/BA/i);
  assert.match(html, /padrao: medio/i);
});

test("Orcamentista V2 one-shot com dados minimos libera PDF", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");

  assert.equal(response.sessionIntent, "budget_v2_scope");
  assert.match(response.fullAnswer, /area construida: 120 m2/i);
  assert.match(response.fullAnswer, /cidade\/UF: Vit.ria da Conquista\/BA/i);
  assert.match(response.fullAnswer, /padrao: medio/i);
  assert.ok(response.pdfAction);
  assert.equal(response.pdfAction.label, "Gerar PDF do or\u00e7amento");
});

test("Orcamentista V2 nao mostra acao de PDF em mensagem comum", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("bom dia");

  assert.equal(response.pdfAction, undefined);
});

test("Orcamentista V2 bloqueia PDF quando faltam dados minimos", () => {
  const { assistant } = loadAssistant();
  const result = assistant.openBudgetV2ProfessionalPdfForTest({
    budgetId: "budget-incompleto",
    facts: { "area construida": "120 m2" },
    pendingFields: ["cidade/UF", "padrao construtivo"]
  });

  assert.equal(result.ok, false);
  assert.equal(result.message, "Complete os dados m\u00ednimos do or\u00e7amento antes de gerar o PDF.");
});

test("Orcamentista V2 acao de PDF usa template profissional existente", () => {
  const { assistant } = loadAssistant();
  const completeDocument = Object.assign({}, sampleBudgetV2DocumentData(), { pendingFields: [] });
  const result = assistant.openBudgetV2ProfessionalPdfForTest(completeDocument);

  assert.equal(result.ok, true);
  assert.match(result.html, /elo-professional-pdf/);
  assert.match(result.html, /ELO Or.amentista V2/);
  assert.match(result.html, /Imprimir \/ Salvar como PDF/);
});
function mockStructuredBudget(projectFacts) {
  return {
    projectFacts,
    scope: [
      { id: "servicos_preliminares", service: "Servicos preliminares", status: "ready", unit: "m2" },
      { id: "alvenaria", service: "Alvenaria", status: "pending", unit: "m2" }
    ],
    quantities: [{ packageId: "servicos_preliminares", serviceId: "area_construida", quantity: projectFacts.builtAreaM2, unit: "m2", source: "informed" }],
    compositionMatches: [{ packageId: "alvenaria", serviceId: "alvenaria_bloco", found: false, candidates: [] }],
    risks: ["Orcamento preliminar tecnico."],
    missing: [{ id: "wall_material", message: "Informe sistema de parede." }],
    budgetTable: { rows: [], summary: { readyRows: 0, pendingRows: 1 } }
  };
}

test("BudgetEngineAdapter recebe estado do V2 e padroniza pacote interno", () => {
  const { assistant } = loadAssistant("/elo.html", { budgetEngine: mockStructuredBudget });
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const state = assistant.getBudgetOrchestratorV2StateForTest();
  const pack = response.budgetOrchestratorV2.budgetPackage;

  assert.equal(pack.budgetId, state.budgetId);
  assert.equal(pack.facts.builtAreaM2, 120);
  assert.equal(pack.facts.cityUf, "Vitoria da Conquista/BA");
  assert.equal(pack.facts.projectStandard, "medio");
  assert.ok(Array.isArray(pack.scope));
  assert.ok(Array.isArray(pack.quantities));
  assert.ok(Array.isArray(pack.compositions));
  assert.ok(Array.isArray(pack.risks));
});

test("BudgetEngineAdapter chama EloBudgetEngine quando ha dados suficientes", () => {
  const { assistant, calls } = loadAssistant("/elo.html", { budgetEngine: mockStructuredBudget });
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const pack = response.budgetOrchestratorV2.budgetPackage;

  assert.equal(calls.budgetEngine, 1);
  assert.equal(pack.source, "EloBudgetEngine");
  assert.equal(pack.engineCalled, true);
  assert.match(response.fullAnswer, /estruturado pelo motor tecnico/i);
});

test("BudgetEngineAdapter mantem fallback quando EloBudgetEngine nao esta disponivel", () => {
  const { assistant, calls } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const pack = response.budgetOrchestratorV2.budgetPackage;

  assert.equal(calls.budgetEngine, 0);
  assert.equal(pack.source, "adapter_fallback");
  assert.equal(pack.engineCalled, false);
  assert.ok(pack.scope.length >= 5);
  assert.match(response.fullAnswer, /pendente de composicao SINAPI\/ORSE oficial/i);
});
