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
  const calls = { router: 0, technical: 0, composition: 0, budgetEngine: 0, executiveBudgetEngine: 0 };
  const clipboardWrites = [];
  const sandbox = {
    console,
    navigator: {
      clipboard: {
        writeText(text) {
          clipboardWrites.push(text);
          return Promise.resolve();
        }
      }
    },
    document: { readyState: "complete", addEventListener() {}, body: { dataset: {}, getAttribute() { return ""; } } },
    window: {
      ELO_SKIP_AUTO_WIDGET: true,
      isSecureContext: true,
      navigator: null,
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
  if (options.executiveBudgetEngine) {
    sandbox.window.EloExecutiveBudgetEngine = {
      version: "test-v3",
      buildResidentialExecutiveBudget(input) {
        calls.executiveBudgetEngine += 1;
        return options.executiveBudgetEngine(input);
      },
      classifyProjectTypology(input) {
        return options.executiveBudgetEngine(input).typologyRouting.typology;
      }
    };
  }
  if (options.budgetEngine) {
    sandbox.window.EloBudgetEngine = {
      buildPreliminaryBudget(projectFacts, technicalContext) {
        calls.budgetEngine += 1;
        return options.budgetEngine(projectFacts, technicalContext);
      }
    };
  }
  sandbox.window.navigator = sandbox.navigator;
  sandbox.globalThis = sandbox.window;  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-assistente.js"), "utf8"), sandbox, { filename: "elo-assistente.js" });
  return { assistant: sandbox.window.EloAssistente, calls, clipboardWrites };
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


test("Blindagem comercial nao contamina patologia laudo nem geometria simples", () => {
  const { assistant } = loadAssistant();
  const pathology = assistant.buildResponseForTest("A parede está com trinca diagonal perto da janela. O que pode ser?").fullAnswer;
  const report = assistant.buildResponseForTest("Faça um relato técnico curto sobre infiltração em parede interna.").fullAnswer;
  const geometry = assistant.buildResponseForTest("Qual volume de pilar 20x30 com 3 m?").fullAnswer;

  [pathology, report, geometry].forEach((answer) => {
    assert.doesNotMatch(answer, /^AVISO: Esta é uma estimativa preliminar/i);
    assert.doesNotMatch(answer, /\| Item \| Serviço \| Unidade \| Quantidade \| Valor unitário \| Total \|/i);
    assert.doesNotMatch(answer, /## 5\. Confirmação técnica/i);
  });
  assert.match(geometry, /0[,.]18\s*m/i);
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

  assert.match(data.record.numero, /^ELO-BA-\d{4}-\d{6}$/);
  assert.match(data.record.titulo, /ELO Or.amentista V2/);
  assert.match(data.context.nomeDocumento, /ELO Or.amentista V2/);
  assert.match(data.record.conteudo_markdown, /N.mero do documento: ELO-BA-\d{4}-\d{6}/i);
  assert.match(data.record.conteudo_markdown, /Tipo: Or.amento residencial preliminar/i);
  assert.doesNotMatch(data.record.conteudo_markdown, /budget-v2-test-001|budget-|pending_official_composition|adapter_fallback|undefined|null|NaN/i);
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


test("Orcamentista V2 aplica retirada total da eletrica preservando revisao anterior", () => {
  const { assistant } = loadAssistant();
  const original = assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
  assert.equal(original.sessionIntent, "budget_v2_scope");
  assert.ok(original.budgetOrchestratorV2.budgetPackage);
  assert.ok(original.pdfAction);

  const beforeState = assistant.getBudgetOrchestratorV2StateForTest();
  const beforePackage = JSON.parse(JSON.stringify(beforeState.budgetPackage));
  const beforeElectrical = beforePackage.quantities.filter((item) => item.category === "instalacoes_eletricas");
  assert.ok(beforeElectrical.length > 0);

  const response = assistant.buildResponseForTest("Retire toda a el\u00e9trica.");
  const afterState = assistant.getBudgetOrchestratorV2StateForTest();
  const afterPackage = response.budgetOrchestratorV2.budgetPackage;

  assert.equal(response.sessionIntent, "budget_v2_scope_remove_electrical_applied");
  assert.match(response.fullAnswer, /retirei todas as instalacoes eletricas/i);
  assert.equal(JSON.stringify(beforeState.budgetPackage), JSON.stringify(beforePackage));
  assert.equal(afterPackage.quantities.some((item) => item.category === "instalacoes_eletricas"), false);
  assert.equal(afterPackage.scope.some((item) => item.id === "instalacoes_eletricas"), false);
  assert.ok(afterPackage.quantities.some((item) => item.serviceId === "pontos_hidraulicos"));
  assert.ok(afterPackage.quantities.some((item) => item.category === "estrutura"));
  assert.ok(afterPackage.quantities.some((item) => item.serviceId === "alvenaria_externa"));
  assert.ok(afterPackage.quantities.some((item) => item.category === "cobertura"));
  assert.equal(afterPackage.quantities.some((item) => item.parentServiceId && beforeElectrical.some((removed) => removed.serviceId === item.parentServiceId)), false);
  assert.equal(JSON.stringify(afterPackage.scopeExclusions), JSON.stringify([{ target: "electrical", reason: "removed_by_user_instruction", revisionNumber: 2 }]));
  assert.ok(response.pdfAction);
  assert.doesNotMatch(JSON.stringify(response.pdfAction.budgetDocumentData.budgetPackage.scope), /instalacoes_eletricas/i);
  assert.equal(afterState.revisions.length, 1);
  assert.equal(response.revision.action, "remove_scope");
  assert.equal(response.revision.target, "electrical");
  assert.equal(response.revision.removedItems.length, beforeElectrical.length);
  assert.equal(JSON.stringify(response.revision.previousBudgetPackage), JSON.stringify(beforePackage));
  assert.equal(JSON.stringify(response.revision.resultingBudgetPackage), JSON.stringify(afterPackage));
});

test("Orcamentista V2 recoloca eletrica removida usando revisao anterior", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
  const originalPackage = JSON.parse(JSON.stringify(assistant.getBudgetOrchestratorV2StateForTest().budgetPackage));
  const originalElectrical = originalPackage.quantities.filter((item) => item.category === "instalacoes_eletricas");
  const originalHydraulic = JSON.stringify(originalPackage.quantities.filter((item) => item.category === "instalacoes_hidrossanitarias"));
  const originalPriceMap = new Map((originalPackage.financialLines || []).map((item) => [item.serviceId, JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })]));

  const removed = assistant.buildResponseForTest("Retire toda a el\u00e9trica.");
  assert.equal(JSON.stringify(removed.revision.previousBudgetPackage), JSON.stringify(originalPackage));
  const stateAfterRemoval = assistant.getBudgetOrchestratorV2StateForTest();
  stateAfterRemoval.revisions[0].previousBudgetPackage.scope.push({ id: "eletrica_fantasma", label: "Eletrica ausente fora da revisao", category: "instalacoes_eletricas" });
  stateAfterRemoval.budgetPackage.scopeExclusions.push({ target: "electrical", reason: "outra_remocao", revisionNumber: 99 });
  stateAfterRemoval.budgetPackage.scopeExclusions.push({ target: "hydraulic", reason: "teste_preservacao", revisionNumber: 77 });
  const removalRevision = JSON.parse(JSON.stringify(stateAfterRemoval.revisions[0]));
  assert.equal(removed.budgetOrchestratorV2.budgetPackage.quantities.some((item) => item.category === "instalacoes_eletricas"), false);
  assert.equal(originalPackage.scope.some((item) => item.id === "eletrica_fantasma"), false);

  const restored = assistant.buildResponseForTest("Recoloque a el\u00e9trica.");
  const restoredPackage = restored.budgetOrchestratorV2.budgetPackage;
  const restoredElectrical = restoredPackage.quantities.filter((item) => item.category === "instalacoes_eletricas");

  assert.equal(restored.sessionIntent, "budget_v2_scope_restore_electrical_applied");
  assert.equal(restored.revision.action, "restore_scope");
  assert.equal(restored.revision.target, "electrical");
  assert.equal(restored.revision.sourceRevisionNumber, removalRevision.revisionNumber);
  assert.equal(JSON.stringify(restoredElectrical.map((item) => item.serviceId).sort()), JSON.stringify(originalElectrical.map((item) => item.serviceId).sort()));
  assert.equal(JSON.stringify(restoredElectrical.sort((a, b) => a.serviceId.localeCompare(b.serviceId))), JSON.stringify(originalElectrical.sort((a, b) => a.serviceId.localeCompare(b.serviceId))));
  assert.equal(JSON.stringify(restored.revision.restoredItems.map((item) => item.serviceId).sort()), JSON.stringify(originalElectrical.map((item) => item.serviceId).sort()));
  assert.equal(restoredPackage.scope.some((item) => item.id === "instalacoes_eletricas"), true);
  assert.equal(restoredPackage.scope.some((item) => item.id === "eletrica_fantasma"), false);
  assert.equal(new Set(restoredPackage.quantities.map((item) => item.serviceId)).size, restoredPackage.quantities.length);
  assert.equal(JSON.stringify(restoredPackage.quantities.filter((item) => item.category === "instalacoes_hidrossanitarias")), originalHydraulic);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "electrical" && item.revisionNumber === removalRevision.revisionNumber), false);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "electrical" && item.revisionNumber === 99), true);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "hydraulic" && item.revisionNumber === 77), true);
  assert.equal(JSON.stringify(assistant.getBudgetOrchestratorV2StateForTest().revisions[0]), JSON.stringify(removalRevision));
  assert.ok(restored.pdfAction);
  assert.ok(restored.budgetOrchestratorV2.budgetDocumentData);
  assert.equal((restoredPackage.financialLines || []).every((item) => !originalPriceMap.has(item.serviceId) || originalPriceMap.get(item.serviceId) === JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })), true);

  const second = assistant.buildResponseForTest("Recoloque a el\u00e9trica.");
  const secondState = assistant.getBudgetOrchestratorV2StateForTest();
  const secondPackage = secondState.budgetPackage;
  assert.equal(second.sessionIntent, "budget_v2_scope_restore_electrical_without_removal");
  assert.equal(new Set(secondPackage.quantities.map((item) => item.serviceId)).size, secondPackage.quantities.length);
  assert.equal(secondState.revisions.length, 2);
});

test("Orcamentista V2 nao cria revisao eletrica sem orcamento ativo", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("Retire toda a el\u00e9trica.");
  const state = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(response.sessionIntent, "budget_v2_scope_remove_electrical_without_budget");
  assert.match(response.fullAnswer, /primeiro preciso de um orcamento residencial ativo/i);
  assert.equal(state.type, undefined);
  assert.equal(state.budgetPackage, undefined);
  assert.equal(state.revisions, undefined);
});

test("Orcamentista V2 nao recoloca eletrica sem remocao anterior", () => {
  const { assistant } = loadAssistant();
  const original = assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
  const beforeState = assistant.getBudgetOrchestratorV2StateForTest();
  const beforePackageJson = JSON.stringify(beforeState.budgetPackage);

  const response = assistant.buildResponseForTest("Recoloque a el\u00e9trica.");
  const afterState = assistant.getBudgetOrchestratorV2StateForTest();

  assert.equal(original.sessionIntent, "budget_v2_scope");
  assert.equal(response.sessionIntent, "budget_v2_scope_restore_electrical_without_removal");
  assert.match(response.fullAnswer, /nao encontrei uma revisao anterior/i);
  assert.equal(JSON.stringify(afterState.budgetPackage), beforePackageJson);
  assert.deepEqual(afterState.revisions || [], beforeState.revisions || []);
});

test("Orcamentista V2 nao trata frases ambiguas como retirada total da eletrica", () => {
  ["diminua a el\u00e9trica", "corte algumas tomadas", "economize na el\u00e9trica", "el\u00e9trica est\u00e1 cara", "retire uma tomada"].forEach((message) => {
    const { assistant } = loadAssistant();
    const original = assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
    assert.equal(original.sessionIntent, "budget_v2_scope");
    const beforeState = assistant.getBudgetOrchestratorV2StateForTest();

    const response = assistant.buildResponseForTest(message);
    const afterState = assistant.getBudgetOrchestratorV2StateForTest();

    assert.notEqual(response.sessionIntent, "budget_v2_scope_remove_electrical_applied", message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_remove_electrical_without_budget", message);
    assert.deepEqual(afterState.revisions || [], beforeState.revisions || [], message);
  });
});

test("Orcamentista V2 nao trata frases ambiguas como recolocar eletrica", () => {
  ["adicione algumas tomadas", "melhore a el\u00e9trica", "aumente a el\u00e9trica", "coloque ilumina\u00e7\u00e3o externa", "inclua um ponto el\u00e9trico"].forEach((message) => {
    const { assistant } = loadAssistant();
    assistant.buildResponseForTest("Quero or\u00e7amento residencial preliminar para casa t\u00e9rrea de 120 m\u00b2 em Vit\u00f3ria da Conquista - BA, padr\u00e3o m\u00e9dio");
    assistant.buildResponseForTest("Retire toda a el\u00e9trica.");
    const beforeState = assistant.getBudgetOrchestratorV2StateForTest();

    const response = assistant.buildResponseForTest(message);
    const afterState = assistant.getBudgetOrchestratorV2StateForTest();

    assert.notEqual(response.sessionIntent, "budget_v2_scope_restore_electrical_applied", message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_restore_electrical_without_removal", message);
    assert.equal((afterState.revisions || []).filter((revision) => revision.action === "restore_scope").length, 0, message);
  });
});


test("Orcamentista V2 aplica remocao real da hidraulica preservando loucas metais e revisao", () => {
  const { assistant } = loadAssistant();
  const original = assistant.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");
  const beforeState = assistant.getBudgetOrchestratorV2StateForTest();
  const beforePackage = JSON.parse(JSON.stringify(beforeState.budgetPackage));
  const expectedRemoved = beforePackage.quantities.filter((item) => ["pontos_hidraulicos", "pontos_sanitarios"].includes(item.serviceId));
  const expectedRemovedScope = beforePackage.scope.filter((item) => expectedRemoved.some((removed) => removed.serviceId === (item.serviceId || item.id)) || (item.serviceId || item.id) === "instalacoes_hidrossanitarias");
  const preservedIds = ["chuveiros", "loucas", "metais", "pontos_eletricos", "pontos_iluminacao", "impermeabilizacao_areas_molhadas"];
  const beforePriceMap = new Map((beforePackage.financialLines || []).map((item) => [item.serviceId, JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })]));
  const beforeCompositionKeys = new Set((beforePackage.compositions || []).map((item) => item.serviceId || item.id || item.code || item.description));

  const response = assistant.buildResponseForTest("Retire toda a hidraulica.");
  const afterState = assistant.getBudgetOrchestratorV2StateForTest(), afterPackage = response.budgetOrchestratorV2.budgetPackage;
  const removedIds = new Set(response.revision.removedItems.map((item) => item.serviceId || item.id));

  assert.equal(original.sessionIntent, "budget_v2_scope");
  assert.ok(expectedRemoved.length > 0);
  assert.equal(response.sessionIntent, "budget_v2_scope_remove_hydraulic_applied");
  assert.match(response.shortAnswer, /Retirei a hidraulica do orcamento/i);
  assert.equal(afterState.revisions.length, 1);
  assert.equal(response.revision.action, "remove_scope");
  assert.equal(response.revision.target, "hydraulic");
  assert.equal(JSON.stringify(response.revision.previousBudgetPackage), JSON.stringify(beforePackage));
  assert.equal(JSON.stringify(response.revision.removedItems.map((item) => item.serviceId).sort()), JSON.stringify(expectedRemoved.map((item) => item.serviceId).sort()));
  assert.equal(JSON.stringify(response.revision.removedScopeItems.map((item) => item.serviceId || item.id).sort()), JSON.stringify(expectedRemovedScope.map((item) => item.serviceId || item.id).sort()));
  assert.equal(afterPackage.quantities.some((item) => removedIds.has(item.serviceId || item.id)), false);
  assert.equal(afterPackage.scope.some((item) => removedIds.has(item.serviceId || item.id)), false);
  preservedIds.forEach((serviceId) => assert.ok(afterPackage.quantities.some((item) => item.serviceId === serviceId), serviceId));
  assert.ok(afterPackage.quantities.some((item) => item.category === "estrutura"));
  assert.ok(afterPackage.quantities.some((item) => item.serviceId === "alvenaria_externa"));
  assert.ok(afterPackage.quantities.some((item) => item.category === "cobertura"));
  assert.equal(afterPackage.quantities.some((item) => item.parentServiceId && removedIds.has(item.parentServiceId)), false);
  assert.equal(JSON.stringify(afterPackage.scopeExclusions), JSON.stringify([{ target: "hydraulic", reason: "removed_by_user_instruction", revisionNumber: 2 }]));
  assert.ok(response.pdfAction && response.budgetOrchestratorV2.budgetDocumentData);
  assert.equal((afterPackage.financialLines || []).every((item) => !beforePriceMap.has(item.serviceId) || beforePriceMap.get(item.serviceId) === JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })), true);
  assert.equal((afterPackage.compositions || []).every((item) => beforeCompositionKeys.has(item.serviceId || item.id || item.code || item.description)), true);
  assert.equal(JSON.stringify(response.revision.resultingBudgetPackage), JSON.stringify(afterPackage));

  const second = assistant.buildResponseForTest("Retire toda a hidraulica.");
  const secondState = assistant.getBudgetOrchestratorV2StateForTest();
  assert.equal(second.sessionIntent, "budget_v2_scope_remove_hydraulic_already_removed");
  assert.equal(secondState.revisions.length, 1);
  assert.equal(secondState.budgetPackage.scopeExclusions.filter((item) => item.target === "hydraulic").length, 1);
  preservedIds.forEach((serviceId) => assert.ok(secondState.budgetPackage.quantities.some((item) => item.serviceId === serviceId), serviceId));
});

test("Orcamentista V2 mantem hidraulica sem orcamento e frases ambiguas fora da rota", () => {
  const empty = loadAssistant().assistant, withoutBudget = empty.buildResponseForTest("Retire toda a hidraulica.");
  assert.equal(withoutBudget.sessionIntent, "budget_v2_scope_remove_hydraulic_without_budget");
  assert.equal(empty.getBudgetOrchestratorV2StateForTest().budgetPackage, undefined);
  ["diminua a hidraulica", "retire uma torneira", "retire um ponto de agua", "economize na hidraulica", "hidraulica esta cara", "retire apenas o esgoto", "retire apenas a agua fria"].forEach((message) => {
    const { assistant } = loadAssistant();
    assistant.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");
    const before = assistant.getBudgetOrchestratorV2StateForTest(), response = assistant.buildResponseForTest(message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_remove_hydraulic_applied", message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_remove_hydraulic_without_budget", message);
    assert.deepEqual(assistant.getBudgetOrchestratorV2StateForTest().revisions || [], before.revisions || [], message);
  });
});
test("Orcamentista V2 recoloca hidraulica removida usando somente revisao fonte", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");
  const originalPackage = JSON.parse(JSON.stringify(assistant.getBudgetOrchestratorV2StateForTest().budgetPackage));
  const originalHydraulic = originalPackage.quantities.filter((item) => ["pontos_hidraulicos", "pontos_sanitarios"].includes(item.serviceId));
  const originalScope = originalPackage.scope.filter((item) => originalHydraulic.some((removed) => removed.serviceId === (item.serviceId || item.id)) || (item.serviceId || item.id) === "instalacoes_hidrossanitarias");
  const preservedIds = ["chuveiros", "loucas", "metais", "pontos_eletricos", "pontos_iluminacao", "impermeabilizacao_areas_molhadas"];
  const originalPrices = new Map((originalPackage.financialLines || []).map((item) => [item.serviceId, JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })]));
  const originalCompositionKeys = new Set((originalPackage.compositions || []).map((item) => item.serviceId || item.id || item.code || item.description));

  const removed = assistant.buildResponseForTest("Retire toda a hidraulica.");
  const stateAfterRemoval = assistant.getBudgetOrchestratorV2StateForTest();
  stateAfterRemoval.budgetPackage.scopeExclusions.push({ target: "hydraulic", reason: "outra_remocao", revisionNumber: 99 });
  stateAfterRemoval.budgetPackage.scopeExclusions.push({ target: "electrical", reason: "preservar_eletrica", revisionNumber: 88 });
  stateAfterRemoval.budgetPackage.quantities.push({ serviceId: "acabamento_pos_hidraulica", description: "Item atual apos remocao", category: "acabamentos", quantity: 1, unit: "un" });
  stateAfterRemoval.revisions[0].previousBudgetPackage.quantities.push({ serviceId: "hidraulica_fora_da_revisao", description: "Hidraulica fora da lista removida", category: "instalacoes_hidrossanitarias", quantity: 1, unit: "un" });
  const removalRevision = JSON.parse(JSON.stringify(stateAfterRemoval.revisions[0]));

  const restored = assistant.buildResponseForTest("Recoloque a hidraulica.");
  const restoredState = assistant.getBudgetOrchestratorV2StateForTest(), restoredPackage = restored.budgetOrchestratorV2.budgetPackage;
  const restoredHydraulic = restored.revision.restoredItems.map((item) => item.serviceId).sort();

  assert.equal(removed.sessionIntent, "budget_v2_scope_remove_hydraulic_applied");
  assert.equal(restored.sessionIntent, "budget_v2_scope_restore_hydraulic_applied");
  assert.equal(restored.revision.action, "restore_scope");
  assert.equal(restored.revision.target, "hydraulic");
  assert.equal(restored.revision.sourceRevisionNumber, removalRevision.revisionNumber);
  assert.equal(restoredState.revisions.length, 2);
  assert.equal(JSON.stringify(restoredHydraulic), JSON.stringify(removed.revision.removedItems.map((item) => item.serviceId).sort()));
  assert.equal(JSON.stringify(restored.revision.restoredScopeItems.map((item) => item.serviceId || item.id).sort()), JSON.stringify(removed.revision.removedScopeItems.map((item) => item.serviceId || item.id).sort()));
  assert.equal(JSON.stringify(restored.revision.restoredItems.sort((a, b) => a.serviceId.localeCompare(b.serviceId))), JSON.stringify(originalHydraulic.sort((a, b) => a.serviceId.localeCompare(b.serviceId))));
  assert.equal(JSON.stringify(restored.revision.restoredScopeItems.map((item) => item.serviceId || item.id).sort()), JSON.stringify(originalScope.map((item) => item.serviceId || item.id).sort()));
  assert.equal(restoredPackage.quantities.some((item) => item.serviceId === "hidraulica_fora_da_revisao"), false);
  assert.ok(restoredPackage.quantities.some((item) => item.serviceId === "acabamento_pos_hidraulica"));
  preservedIds.forEach((serviceId) => assert.ok(restoredPackage.quantities.some((item) => item.serviceId === serviceId), serviceId));
  assert.equal(new Set(restoredPackage.quantities.map((item) => item.serviceId || item.id)).size, restoredPackage.quantities.length);
  assert.equal(new Set(restoredPackage.scope.map((item) => item.serviceId || item.id)).size, restoredPackage.scope.length);
  assert.equal(restoredPackage.quantities.some((item) => item.parentServiceId && !restoredPackage.quantities.some((parent) => (parent.serviceId || parent.id) === item.parentServiceId)), false);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "hydraulic" && item.revisionNumber === removalRevision.revisionNumber), false);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "hydraulic" && item.revisionNumber === 99), true);
  assert.equal(restoredPackage.scopeExclusions.some((item) => item.target === "electrical" && item.revisionNumber === 88), true);
  assert.equal((restoredPackage.financialLines || []).every((item) => !originalPrices.has(item.serviceId) || originalPrices.get(item.serviceId) === JSON.stringify({ unitPrice: item.unitPrice, price: item.price, totalPrice: item.totalPrice, total: item.total })), true);
  assert.equal((restoredPackage.compositions || []).every((item) => originalCompositionKeys.has(item.serviceId || item.id || item.code || item.description)), true);
  assert.equal(JSON.stringify(restoredState.revisions[0]), JSON.stringify(removalRevision));
  assert.ok(restored.pdfAction && restored.budgetOrchestratorV2.budgetDocumentData);

  const second = assistant.buildResponseForTest("Recoloque a hidraulica.");
  const secondState = assistant.getBudgetOrchestratorV2StateForTest();
  assert.equal(second.sessionIntent, "budget_v2_scope_restore_hydraulic_already_present");
  assert.equal(secondState.revisions.length, 2);
  assert.equal(new Set(secondState.budgetPackage.quantities.map((item) => item.serviceId || item.id)).size, secondState.budgetPackage.quantities.length);
});

test("Orcamentista V2 nao recoloca hidraulica sem remocao nem em frases ambiguas", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar para casa terrea de 120 m2 em Vitoria da Conquista - BA, padrao medio");
  const beforeState = assistant.getBudgetOrchestratorV2StateForTest(), beforePackage = JSON.stringify(beforeState.budgetPackage);
  const withoutRemoval = assistant.buildResponseForTest("Recoloque a hidraulica.");
  assert.equal(withoutRemoval.sessionIntent, "budget_v2_scope_restore_hydraulic_without_removal");
  assert.equal(JSON.stringify(assistant.getBudgetOrchestratorV2StateForTest().budgetPackage), beforePackage);
  assert.deepEqual(assistant.getBudgetOrchestratorV2StateForTest().revisions || [], beforeState.revisions || []);
  ["adicione uma torneira", "recoloque um ponto de agua", "melhore a hidraulica", "aumente a hidraulica", "inclua apenas o esgoto", "inclua agua quente", "coloque uma pia"].forEach((message) => {
    const response = assistant.buildResponseForTest(message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_restore_hydraulic_applied", message);
    assert.notEqual(response.sessionIntent, "budget_v2_scope_restore_hydraulic_without_removal", message);
  });
});

test("Orcamentista V2 mostra acoes transacionais para orcamento valido", () => {
  const { assistant } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");

  assert.ok(Array.isArray(response.budgetActions));
  assert.deepEqual(Array.from(response.budgetActions, (action) => action.label), ["Salvar orçamento", "Meus Orçamentos"]);
  assert.equal(response.budgetActions[0].type, "budget_v2_save");
  assert.ok(response.budgetActions[0].budgetDocumentData);
});

test("Orcamentista V2 troca acoes quando orcamento ja esta salvo", () => {
  const { assistant } = loadAssistant();
  const completeDocument = Object.assign({}, sampleBudgetV2DocumentData(), { pendingFields: [], savedBudgetId: "elo_budget_salvo_1" });
  const actions = assistant.buildBudgetV2TransactionalActionsForTest(completeDocument);

  assert.deepEqual(Array.from(actions, (action) => action.label), [
    "Atualizar orçamento",
    "Criar nova versão",
    "Gerar PDF controlado",
    "Ver eventos",
    "Meus Orçamentos"
  ]);
  assert.equal(actions[2].type, "budget_v2_controlled_pdf");
});

test("Orcamentista V2 nao mostra acoes transacionais em mensagem comum", () => {
  const { assistant } = loadAssistant();
  const hello = assistant.buildResponseForTest("Olá");
  const identity = assistant.buildResponseForTest("Quem é você?");

  assert.equal(hello.pdfAction, undefined);
  assert.equal(hello.budgetActions, undefined);
  assert.equal(identity.pdfAction, undefined);
  assert.equal(identity.budgetActions, undefined);
});

test("ELO reconhece atalho Meus Orcamentos sem capturar fluxo generico", () => {
  const { assistant } = loadAssistant();
  const response = assistant.buildResponseForTest("Meus Orçamentos ELO");

  assert.equal(response.sessionIntent, "budget_v2_list");
  assert.ok(Array.isArray(response.budgetActions));
  assert.equal(response.budgetActions[0].label, "Meus Orçamentos");
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

function mockExecutiveBudgetV3(input) {
  const type = input && input.project && input.project.type || "desconhecida";
  const typology = type === "sobrado" ? "sobrado" : type === "galpao_metalico" ? "galpao_metalico" : type === "reforma_banheiro" ? "reforma_banheiro" : type === "muro_arrimo" ? "muro_arrimo" : type === "ampliacao_residencial" ? "ampliacao_residencial" : type === "desconhecida" || type === "unknown" ? "desconhecida" : "residencia_nova";
  const disciplinesByType = {
    residencia_nova: ["fundacao", "estrutura", "alvenaria", "cobertura", "instalacoes_hidraulicas", "instalacoes_eletricas", "revestimentos", "pintura"],
    sobrado: ["fundacao", "estrutura", "alvenaria", "cobertura", "instalacoes_hidraulicas", "instalacoes_eletricas", "revestimentos", "pintura"],
    galpao_metalico: ["fundacao", "estrutura_metalica", "piso_industrial", "fechamento_metalico", "cobertura", "drenagem"],
    reforma_banheiro: ["demolicao", "instalacoes_hidraulicas", "impermeabilizacao", "revestimentos", "loucas", "metais"],
    desconhecida: []
  };
  const pendencias = typology === "sobrado" ? [{ id: "sobrado", message: "Confirmar escada, laje e compatibilidade estrutural do sobrado." }] : typology === "galpao_metalico" ? [{ id: "galpao", message: "Motor de galpao metalico ainda nao possui quantitativos completos." }] : typology === "reforma_banheiro" ? [{ id: "banheiro", message: "Detalhar demolicao, pontos hidraulicos, loucas e metais." }] : [];
  return {
    typologyRouting: {
      typology,
      label: typology,
      applicableDisciplines: disciplinesByType[typology] || [],
      pendencias,
      readyForCost: false
    },
    premissas: [
      { id: "city", label: "cidade", ok: Boolean(input && input.project && input.project.city) },
      { id: "standard", label: "padrao construtivo", ok: Boolean(input && input.project && input.project.standard) },
      { id: "foundationType", label: "tipo de fundacao", ok: false }
    ],
    pendencias,
    checklist: (disciplinesByType[typology] || []).map((id) => ({ id, label: id, status: "parcial" })),
    readyForCost: false
  };
}

test("Orcamentista V2 conecta auditor V3 no or�amento residencial", () => {
  const { assistant, calls } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const response = assistant.buildResponseForTest("Quero orcamento residencial preliminar");

  assert.equal(calls.executiveBudgetEngine, 1);
  assert.match(response.fullAnswer, /Auditoria tecnica V3/i);
  assert.match(response.fullAnswer, /Tipologia identificada: residencia_nova/i);
  assert.match(response.fullAnswer, /Ready for cost: false/i);
  assert.doesNotMatch(response.fullAnswer, /R\$\s*\d/i);
});

test("Orcamentista V2 casa terrea 70m2 retorna estrutura tecnica V3", () => {
  const { assistant } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const response = assistant.buildResponseForTest("casa terrea 70m�");

  assert.match(response.fullAnswer, /Auditoria tecnica V3/i);
  assert.match(response.fullAnswer, /fundacao/i);
  assert.match(response.fullAnswer, /alvenaria/i);
  assert.match(response.fullAnswer, /Premissas faltantes/i);
});

test("Orcamentista V2 sobrado 140m2 exige escada laje e estrutura no auditor V3", () => {
  const { assistant } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const response = assistant.buildResponseForTest("sobrado 140m�");

  assert.match(response.fullAnswer, /Tipologia identificada: sobrado/i);
  assert.match(response.fullAnswer, /escada, laje e compatibilidade estrutural/i);
  assert.match(response.fullAnswer, /Ready for cost: false/i);
});

test("Orcamentista V2 galpao metalico nao vira residencia", () => {
  const { assistant } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const response = assistant.buildResponseForTest("orcamento completo de galpao metalico 300 m2");

  assert.match(response.fullAnswer, /Tipologia identificada: galpao_metalico/i);
  assert.match(response.fullAnswer, /estrutura_metalica/i);
  assert.doesNotMatch(response.fullAnswer, /loucas|metais/i);
});

test("Orcamentista V2 reforma de banheiro nao vira obra nova", () => {
  const { assistant } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const response = assistant.buildResponseForTest("orcamento completo para reforma de banheiro");

  assert.match(response.fullAnswer, /Tipologia identificada: reforma_banheiro/i);
  assert.match(response.fullAnswer, /demolicao/i);
  assert.match(response.fullAnswer, /impermeabilizacao/i);
  assert.doesNotMatch(response.fullAnswer, /fundacao complementar|estrutura_metalica/i);
});

test("Orcamentista V2 mantem fallback antigo quando auditor V3 indisponivel", () => {
  const { assistant, calls } = loadAssistant();
  assistant.buildResponseForTest("Quero orcamento residencial preliminar");
  const response = assistant.buildResponseForTest("120 m2 em Vitoria da Conquista, BA, padrao medio");
  const pack = response.budgetOrchestratorV2.budgetPackage;

  assert.equal(calls.executiveBudgetEngine, 0);
  assert.equal(pack.executiveAudit, null);
  assert.match(response.fullAnswer, /Escopo preliminar/i);
  assert.doesNotMatch(response.fullAnswer, /Auditoria tecnica V3/i);
});


test("Memoria curta salva cadastro de obra sem abrir orcamento e reutiliza na produtividade", () => {
  const { assistant } = loadAssistant("/elo.html", { executiveBudgetEngine: mockExecutiveBudgetV3 });
  const cadastro = assistant.buildResponseForTest("Minha obra Residencial Alfa fica em Vitoria da Conquista-BA e tem 120 m2.");

  assert.match(cadastro.fullAnswer, /Residencial Alfa/i);
  assert.match(cadastro.fullAnswer, /Vit.ria da Conquista|Vitoria da Conquista/i);
  assert.match(cadastro.fullAnswer, /120/i);
  assert.doesNotMatch(cadastro.fullAnswer, /Or?amento preliminar|Orcamento preliminar/i);
  assert.doesNotMatch(cadastro.fullAnswer, /Valor unit.rio|Mem.ria de c.lculo/i);

  const produtividade = assistant.buildResponseForTest("Qual produtividade da equipe?");
  assert.match(produtividade.fullAnswer, /Residencial Alfa/i);
  assert.match(produtividade.fullAnswer, /Vit.ria da Conquista|Vitoria da Conquista/i);
  assert.match(produtividade.fullAnswer, /composi??o validada|composicao validada|SINAPI|ORSE/i);
  assert.match(produtividade.fullAnswer, /n?o vou tratar produtividade|nao vou tratar produtividade|n?o.*oficial|nao.*oficial/i);
  assert.doesNotMatch(produtividade.fullAnswer, /gastando muito cimento/i);
});
