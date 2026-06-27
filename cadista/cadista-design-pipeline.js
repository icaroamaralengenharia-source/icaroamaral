(function () {
  "use strict";

  const state = { open: false, last: null };

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function warning(message, code) {
    return { code: code || "pipeline_warning", message };
  }

  function getHouseLibrary() {
    return window.CadistaHouseTemplateLibrary || null;
  }

  function getAdvisor() {
    return window.CadistaLayoutAdvisor || null;
  }

  function getParametricEngine() {
    return window.CadistaParametricLayoutEngine || null;
  }

  function getGraphEngine() {
    return window.CadistaArchitecturalGraph || null;
  }

  function getRulesEngine() {
    return window.CadistaArchitecturalRulesEngine || null;
  }

  function getConverter() {
    return window.CadistaTemplateToCadConverter || null;
  }

  function detectIntent(input, warnings) {
    const houseLibrary = getHouseLibrary();
    if (!houseLibrary || typeof houseLibrary.detectCadistaHouseTemplateIntent !== "function") {
      warnings.push(warning("Detector CADISTA nao carregado.", "missing_detector"));
      return null;
    }
    const intent = houseLibrary.detectCadistaHouseTemplateIntent(input);
    if (!intent) warnings.push(warning("Nao identifiquei tipologia residencial no pedido.", "intent_not_detected"));
    return intent;
  }

  function recommendTemplates(intent, warnings) {
    const houseLibrary = getHouseLibrary();
    if (!intent || !houseLibrary || typeof houseLibrary.recommendCadistaTemplates !== "function") return [];
    try {
      const recommendations = houseLibrary.recommendCadistaTemplates(intent) || [];
      if (!recommendations.length) warnings.push(warning("Nenhum modelo recomendado para o pedido.", "empty_recommendations"));
      if (recommendations.length > 0 && recommendations.length < 3) warnings.push(warning("Menos de 3 recomendacoes disponiveis para este pedido.", "few_recommendations"));
      return recommendations;
    } catch (error) {
      warnings.push(warning(`Falha ao recomendar modelos: ${error.message}`, "recommendation_error"));
      return [];
    }
  }

  function chooseTemplate(input, intent, recommendations, warnings) {
    if (!intent || !intent.lot) return null;
    const advisor = getAdvisor();
    if (advisor && typeof advisor.adviseCadistaLayout === "function") {
      try {
        const advice = advisor.adviseCadistaLayout(input);
        if (advice && advice.ok && advice.best && advice.best.model) {
          return Object.assign({}, advice.best.model, { pipelineScore: advice.best.score, pipelineJustification: advice.best.justification });
        }
        if (advice && advice.question) warnings.push(warning(advice.question, "advisor_question"));
      } catch (error) {
        warnings.push(warning(`Advisor CADISTA falhou; usando primeira recomendacao. ${error.message}`, "advisor_error"));
      }
    }
    return recommendations[0] || null;
  }

  function adaptTemplate(selectedTemplate, intent, warnings) {
    const engine = getParametricEngine();
    if (!selectedTemplate || !intent) return null;
    if (!engine || typeof engine.adaptCadistaTemplateToLot !== "function") {
      warnings.push(warning("Motor parametrico nao carregado.", "missing_parametric_engine"));
      return null;
    }
    try {
      const adaptedTemplate = engine.adaptCadistaTemplateToLot(selectedTemplate, intent);
      if (typeof engine.validateCadistaParametricLayout === "function") {
        const validation = engine.validateCadistaParametricLayout(adaptedTemplate);
        (validation.errors || []).forEach((message) => warnings.push(warning(message, "parametric_error")));
        (validation.warnings || []).forEach((message) => warnings.push(warning(message, "parametric_warning")));
      }
      return adaptedTemplate;
    } catch (error) {
      warnings.push(warning(`Falha no motor parametrico: ${error.message}`, "parametric_exception"));
      return null;
    }
  }

  function improveAdaptedTemplate(adaptedTemplate, intent, warnings) {
    const rulesEngine = getRulesEngine();
    if (!adaptedTemplate || !rulesEngine || typeof rulesEngine.improveCadistaRoomProportions !== "function") return { adaptedTemplate, improvements: [] };
    try {
      const result = rulesEngine.improveCadistaRoomProportions(adaptedTemplate, intent);
      return { adaptedTemplate: result.adaptedTemplate || adaptedTemplate, improvements: result.improvements || [] };
    } catch (error) {
      warnings.push(warning(`Regras de proporcao nao foram aplicadas: ${error.message}`, "architectural_rules_proportion_error"));
      return { adaptedTemplate, improvements: [] };
    }
  }

  function buildGraph(adaptedTemplate, intent, warnings) {
    const graphEngine = getGraphEngine();
    if (!adaptedTemplate) return null;
    if (!graphEngine || typeof graphEngine.buildCadistaArchitecturalGraph !== "function") {
      warnings.push(warning("Grafo arquitetonico nao carregado.", "missing_graph_engine"));
      return null;
    }
    try {
      const graph = graphEngine.buildCadistaArchitecturalGraph(adaptedTemplate, intent);
      if (typeof graphEngine.validateCadistaArchitecturalGraph === "function") {
        const validation = graphEngine.validateCadistaArchitecturalGraph(graph);
        (validation.errors || []).forEach((message) => warnings.push(warning(message, "graph_error")));
        (validation.warnings || []).forEach((message) => warnings.push(warning(message, "graph_warning")));
      }
      return graph;
    } catch (error) {
      warnings.push(warning(`Falha ao montar grafo arquitetonico: ${error.message}`, "graph_exception"));
      return null;
    }
  }

  function convertToCad(selectedTemplate, adaptedTemplate, graph, intent, warnings) {
    const converter = getConverter();
    if (!selectedTemplate || !adaptedTemplate || !graph) return null;
    if (!converter || typeof converter.convertCadistaTemplateToEditableCad !== "function") {
      warnings.push(warning("Conversor CAD editavel nao carregado.", "missing_converter"));
      return null;
    }
    try {
      const cad = converter.convertCadistaTemplateToEditableCad({ template: selectedTemplate, adaptedTemplate, graph, intent });
      const hasEntities = cad && Array.isArray(cad.walls) && Array.isArray(cad.doors) && Array.isArray(cad.windows) && Array.isArray(cad.rooms);
      if (!hasEntities) warnings.push(warning("Conversao CAD nao retornou entidades completas.", "cad_entities_missing"));
      if (!cad || !cad.metadata || cad.metadata.editable !== true) warnings.push(warning("CAD gerado nao marcou metadata.editable=true.", "cad_not_editable"));
      return cad || null;
    } catch (error) {
      warnings.push(warning(`Falha ao converter para CAD editavel: ${error.message}`, "cad_exception"));
      return null;
    }
  }

  function applyArchitecturalRules(cad, graph, intent, warnings) {
    const rulesEngine = getRulesEngine();
    if (!cad) return { cad: null, review: null };
    if (!rulesEngine || typeof rulesEngine.applyCadistaArchitecturalRules !== "function") {
      warnings.push(warning("Motor de regras arquitetonicas nao carregado.", "missing_architectural_rules"));
      return { cad, review: null };
    }
    try {
      const review = rulesEngine.applyCadistaArchitecturalRules(cad, graph, intent);
      (review.issues || []).forEach((message) => warnings.push(warning(message, "architectural_rule_issue")));
      return { cad: review.cad || cad, review };
    } catch (error) {
      warnings.push(warning(`Falha ao aplicar regras arquitetonicas: ${error.message}`, "architectural_rules_error"));
      return { cad, review: null };
    }
  }

  function buildSummary(result) {
    if (!result.intent) return "Nao foi possivel detectar a intencao arquitetonica.";
    if (!result.intent.lot) return "Informe largura e profundidade do terreno para continuar.";
    if (!result.selectedTemplate) return "Intencao detectada, mas nenhum modelo foi selecionado.";
    if (!result.readyToApply) return "Pipeline executado com pendencias; revisar avisos antes de aplicar.";
    const score = Number.isFinite(Number(result.selectedTemplate.pipelineScore)) ? ` Score ${result.selectedTemplate.pipelineScore}.` : "";
    const architecturalScore = result.architecturalReview && Number.isFinite(Number(result.architecturalReview.architecturalScore)) ? ` Regras arquitetonicas ${result.architecturalReview.architecturalScore}/100.` : "";
    return `Modelo ${result.selectedTemplate.name} pronto para CAD editavel.${score}${architecturalScore}`;
  }

  function runCadistaDesignPipeline(input) {
    const warnings = [];
    const rawInput = typeof input === "string" ? input : input && input.rawInput || input && input.text || "";
    const intent = detectIntent(rawInput || input, warnings);
    const recommendations = recommendTemplates(intent, warnings);
    if (!intent) {
      const result = { intent: null, recommendations, selectedTemplate: null, adaptedTemplate: null, graph: null, cad: null, warnings, summary: "", readyToApply: false };
      result.summary = buildSummary(result);
      return result;
    }
    if (!intent.lot) {
      warnings.push(warning("Informe largura e profundidade do terreno. Exemplo: terreno 10x20.", "missing_lot"));
      const result = { intent, recommendations, selectedTemplate: null, adaptedTemplate: null, graph: null, cad: null, warnings, summary: "", readyToApply: false };
      result.summary = buildSummary(result);
      return result;
    }
    const selectedTemplate = chooseTemplate(rawInput || intent.rawInput || "", intent, recommendations, warnings);
    if (!selectedTemplate) warnings.push(warning("Nenhum template selecionado para conversao.", "missing_selected_template"));
    const rawAdaptedTemplate = adaptTemplate(selectedTemplate, intent, warnings);
    const improved = improveAdaptedTemplate(rawAdaptedTemplate, intent, warnings);
    const adaptedTemplate = improved.adaptedTemplate;
    const graph = buildGraph(adaptedTemplate, intent, warnings);
    const rawCad = convertToCad(selectedTemplate, adaptedTemplate, graph, intent, warnings);
    const ruled = applyArchitecturalRules(rawCad, graph, intent, warnings);
    const cad = ruled.cad;
    const architecturalReview = ruled.review;
    const readyToApply = Boolean(intent && intent.lot && selectedTemplate && adaptedTemplate && graph && cad && cad.metadata && cad.metadata.editable === true && cad.walls && cad.doors && cad.windows && cad.rooms && (!architecturalReview || architecturalReview.passed !== false));
    const result = { intent, recommendations, selectedTemplate, adaptedTemplate, graph, cad, warnings, summary: "", readyToApply, architecturalReview, architecturalImprovements: improved.improvements || [] };
    result.summary = buildSummary(result);
    return result;
  }

  function applyCadistaPipelineResult(result) {
    if (!result || !result.readyToApply || !result.cad) return result;
    if (window.CadistaTemplateToCadConverter && typeof window.CadistaTemplateToCadConverter.applyCadistaEditableTemplateToCanvas === "function") {
      window.CadistaTemplateToCadConverter.applyCadistaEditableTemplateToCanvas(result.cad);
    } else {
      window.dispatchEvent(new CustomEvent("cadista:editable-template-ready", { detail: result.cad }));
    }
    window.dispatchEvent(new CustomEvent("cadista:design-pipeline-ready", { detail: result }));
    try { window.localStorage.setItem("cadista:last-design-pipeline", JSON.stringify(result)); } catch (error) {}
    return result;
  }

  function createUi() {
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-pipeline-launcher";
    launcher.textContent = "Pipeline";
    const panel = document.createElement("section");
    panel.className = "cadista-pipeline-panel";
    panel.hidden = true;
    panel.innerHTML = `<div class="cadista-pipeline-head"><strong>Pipeline CADISTA</strong><button type="button" data-pipeline-close>x</button></div><div class="cadista-pipeline-body"><textarea data-pipeline-input placeholder="Ex.: casa 3 quartos suite terreno 10x25"></textarea><div class="cadista-pipeline-actions"><button type="button" data-pipeline-run>Rodar</button><button type="button" data-pipeline-apply>Aplicar CAD</button></div><div class="cadista-pipeline-output" data-pipeline-output>Informe o pedido para consolidar o fluxo.</div></div>`;
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    const input = panel.querySelector("[data-pipeline-input]");
    const output = panel.querySelector("[data-pipeline-output]");
    launcher.addEventListener("click", () => {
      state.open = !state.open;
      panel.hidden = !state.open;
      if (state.open && !input.value) input.value = getActiveCommandText();
    });
    panel.querySelector("[data-pipeline-close]").addEventListener("click", () => { state.open = false; panel.hidden = true; });
    panel.querySelector("[data-pipeline-run]").addEventListener("click", () => renderPipeline(input.value, output));
    panel.querySelector("[data-pipeline-apply]").addEventListener("click", () => {
      if (state.last && state.last.readyToApply) applyCadistaPipelineResult(state.last);
      renderPipeline(input.value, output, state.last);
    });
  }

  function renderPipeline(text, output, existing) {
    const result = existing || runCadistaDesignPipeline(text);
    state.last = result;
    const intentText = result.intent ? `${result.intent.bedrooms || "-"}Q ${result.intent.lot ? result.intent.lot.label : "sem terreno"}` : "nao detectada";
    const modelText = result.selectedTemplate ? result.selectedTemplate.name : "-";
    const scoreText = result.selectedTemplate && Number.isFinite(Number(result.selectedTemplate.pipelineScore)) ? result.selectedTemplate.pipelineScore : "-";
    const architecturalScore = result.architecturalReview && Number.isFinite(Number(result.architecturalReview.architecturalScore)) ? result.architecturalReview.architecturalScore : "-";
    const cadText = result.cad ? `${result.cad.walls.length} paredes, ${result.cad.doors.length} portas, ${result.cad.windows.length} janelas, ${result.cad.rooms.length} ambientes` : "-";
    output.innerHTML = `<p><strong>${escapeHtml(result.summary)}</strong></p><dl><dt>Intencao</dt><dd>${escapeHtml(intentText)}</dd><dt>Modelo</dt><dd>${escapeHtml(modelText)}</dd><dt>Score</dt><dd>${escapeHtml(scoreText)}</dd><dt>Arquitetura</dt><dd>${escapeHtml(architecturalScore)}</dd><dt>CAD editavel</dt><dd>${escapeHtml(cadText)}</dd><dt>Status</dt><dd>${result.readyToApply ? "pronto" : "pendente"}</dd></dl>${result.warnings.length ? `<ul>${result.warnings.slice(0, 6).map((item) => `<li>${escapeHtml(item.message || item)}</li>`).join("")}</ul>` : ""}`;
  }

  function getActiveCommandText() {
    const active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/i.test(active.tagName || "") && active.value) return active.value;
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-pipeline-panel"));
    const found = fields.find((field) => normalizeText(field.value || "").includes("casa") || normalizeText(field.value || "").includes("planta"));
    return found ? found.value : "";
  }

  function styles() {
    const css = `.cadista-pipeline-launcher{position:fixed;right:18px;bottom:186px;z-index:2147483000;border:0;border-radius:6px;background:#7c2d12;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}.cadista-pipeline-panel{position:fixed;right:18px;bottom:234px;z-index:2147483000;width:min(430px,calc(100vw - 36px));max-height:min(700px,calc(100vh - 252px));overflow:auto;border:1px solid #e3c7b7;border-radius:8px;background:#fff;color:#2c160d;box-shadow:0 22px 48px rgba(0,0,0,.22);font:13px/1.35 Arial,sans-serif}.cadista-pipeline-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #f0ded4;background:#fff7f2}.cadista-pipeline-head strong{font-size:13px;text-transform:uppercase}.cadista-pipeline-head button{width:28px;height:28px;min-height:28px;padding:0;border:1px solid #e3c7b7;border-radius:6px;background:#fff;color:#2c160d}.cadista-pipeline-body{display:grid;gap:10px;padding:12px 14px}.cadista-pipeline-body textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #e3c7b7;border-radius:6px;padding:8px;font:12px Arial,sans-serif}.cadista-pipeline-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cadista-pipeline-actions button{min-height:32px;border:1px solid #7c2d12;border-radius:6px;background:#7c2d12;color:#fff;font-weight:700}.cadista-pipeline-output{display:grid;gap:8px}.cadista-pipeline-output p{margin:0}.cadista-pipeline-output dl{display:grid;grid-template-columns:90px 1fr;gap:5px;margin:0}.cadista-pipeline-output dt{font-weight:800}.cadista-pipeline-output dd{margin:0}.cadista-pipeline-output ul{margin:0;padding-left:18px;color:#7c2d12}`;
    const node = document.createElement("style");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.CadistaDesignPipeline = { runCadistaDesignPipeline, applyCadistaPipelineResult };
  window.runCadistaDesignPipeline = runCadistaDesignPipeline;
  window.applyCadistaPipelineResult = applyCadistaPipelineResult;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createUi, { once: true });
  else createUi();
})();
