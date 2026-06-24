(function (root) {
  "use strict";

  const VERSION = "20260624-elo-budget-engine-v1";

  const SCOPE_TEMPLATES = {
    casa_terrea: [
      ["servicos_preliminares", "Serviços preliminares", "un", "locacao obra limpeza inicial canteiro", true],
      ["fundacao", "Fundação", "m3", "fundacao sapata radier baldrame concreto", true],
      ["estrutura", "Estrutura", "m3", "estrutura concreto pilar viga laje", true],
      ["alvenaria", "Alvenaria", "m2", "alvenaria bloco ceramico bloco baiano parede", true],
      ["cobertura", "Cobertura", "m2", "cobertura telha portuguesa telhamento", true],
      ["instalacoes_eletricas", "Instalações elétricas", "pt", "ponto eletrico tomada luz eletroduto cabo", true],
      ["instalacoes_hidraulicas", "Instalações hidráulicas", "pt", "tubo pvc agua fria esgoto caixa sifonada", true],
      ["revestimentos_internos", "Revestimentos internos", "m2", "chapisco reboco emboco massa unica parede interna", true],
      ["revestimentos_externos", "Revestimentos externos", "m2", "chapisco reboco emboco fachada externo", true],
      ["piso", "Piso", "m2", "piso ceramico revestimento ceramico porcelanato", true],
      ["pintura", "Pintura", "m2", "pintura tinta acrilica parede", true],
      ["esquadrias", "Esquadrias", "un", "porta madeira janela aluminio", true],
      ["limpeza_final", "Limpeza final", "m2", "limpeza final obra", false]
    ],
    muro: [["fundacao", "Fundação do muro", "m3", "sapata baldrame fundacao muro", true], ["alvenaria", "Alvenaria do muro", "m2", "alvenaria bloco muro", true], ["revestimento", "Revestimento", "m2", "chapisco reboco muro", true], ["pintura", "Pintura", "m2", "pintura muro", true]],
    reforma_simples: [["demolicoes", "Demolições/remoções", "m2", "demolicao retirada revestimento", true], ["revestimentos", "Revestimentos", "m2", "revestimento piso parede", true], ["pintura", "Pintura", "m2", "pintura tinta acrilica", true], ["limpeza_final", "Limpeza final", "m2", "limpeza final", false]],
    banheiro: [["impermeabilizacao", "Impermeabilização", "m2", "impermeabilizacao banheiro", true], ["revestimento_parede", "Revestimento de parede", "m2", "revestimento ceramico parede banheiro", true], ["piso", "Piso", "m2", "piso ceramico banheiro", true], ["hidraulica", "Hidráulica", "pt", "tubo pvc caixa sifonada banheiro", true]],
    piso_revestimento: [["contrapiso", "Contrapiso", "m2", "contrapiso regularizacao piso", true], ["piso", "Piso/revestimento", "m2", "piso ceramico porcelanato revestimento", true], ["rejunte", "Rejunte", "m2", "rejuntamento piso ceramico", true]],
    telhado_cobertura: [["estrutura", "Estrutura da cobertura", "m2", "estrutura madeira telhado cobertura", true], ["telhamento", "Telhamento", "m2", "telhamento telha portuguesa cobertura", true], ["cumeeira", "Cumeeira e arremates", "m", "cumeeira telha portuguesa", true]]
  };

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }

  function clone(obj) { return JSON.parse(JSON.stringify(obj || {})); }

  function inferProjectType(projectFacts, technicalContext) {
    const text = normalize([projectFacts.type, projectFacts.tipoObra, projectFacts.originalMessage, technicalContext && technicalContext.lastMessage].join(" "));
    if (/muro/.test(text)) return "muro";
    if (/banheiro/.test(text)) return "banheiro";
    if (/reforma/.test(text)) return "reforma_simples";
    if (/telhado|cobertura/.test(text) && !/casa/.test(text)) return "telhado_cobertura";
    if (/piso|revestimento|porcelanato|ceramico/.test(text) && !/casa/.test(text)) return "piso_revestimento";
    return "casa_terrea";
  }

  function collectFacts(projectFacts, technicalContext) {
    const facts = clone(projectFacts);
    const tech = technicalContext || {};
    const services = tech.services || {};
    const text = [facts.originalMessage, tech.lastMessage].map(clean).join(" ");
    let match = text.match(/(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (!facts.builtAreaM2 && !facts.areaConstruidaM2 && /casa|area|área|terrea|térrea|orcamento|orçamento/i.test(text) && match) facts.builtAreaM2 = number(match[1]);
    match = text.match(/paredes?[^\d]*(\d+(?:[,.]\d+)?)\s*m(?:\s|$|de\s+altura)/i) || text.match(/altura[^\d]*(\d+(?:[,.]\d+)?)\s*m\b/i);
    if (!facts.wallHeightM && match) facts.wallHeightM = number(match[1]);
    if (!facts.wallMaterial && /bloco\s+(baiano|ceramico|cerâmico)/i.test(text)) facts.wallMaterial = /baiano/i.test(text) ? "bloco ceramico baiano" : "bloco ceramico";
    if (!facts.roofMaterial && /telha\s+portuguesa/i.test(text)) facts.roofMaterial = "telha portuguesa";
    if (!facts.floorMaterial && /piso\s+ceramico|piso\s+cerâmico|porcelanato/i.test(text)) facts.floorMaterial = /porcelanato/i.test(text) ? "porcelanato" : "piso ceramico";
    if (!facts.floorAreaM2 && facts.floorMaterial && match) facts.floorAreaM2 = number(match[1]);
    if (!facts.floorAreaM2 && services.piso_ceramico && services.piso_ceramico.areaM2) facts.floorAreaM2 = services.piso_ceramico.areaM2;
    if (!facts.floorMaterial && services.piso_ceramico) facts.floorMaterial = services.piso_ceramico.service || "piso ceramico";
    if (!facts.roofMaterial && services.telhado && services.telhado.material) facts.roofMaterial = services.telhado.material;
    if (!facts.wallMaterial && tech.facts && tech.facts.wallMaterial) facts.wallMaterial = tech.facts.wallMaterial;
    if (!facts.builtAreaM2 && tech.facts && tech.facts.builtAreaM2) facts.builtAreaM2 = tech.facts.builtAreaM2;
    if (!facts.wallHeightM && tech.facts && tech.facts.wallHeightM) facts.wallHeightM = tech.facts.wallHeightM;
    if (services.contrapiso && services.contrapiso.areaM2) facts.contrapisoAreaM2 = services.contrapiso.areaM2;
    if (services.contrapiso && services.contrapiso.thicknessCm) facts.contrapisoThicknessCm = services.contrapiso.thicknessCm;
    return facts;
  }

  function buildScope(type, facts) {
    return (SCOPE_TEMPLATES[type] || SCOPE_TEMPLATES.casa_terrea).map(function (row) {
      const id = row[0];
      let status = row[4] ? "pendente" : "estimado";
      if (id === "alvenaria" && facts.wallMaterial) status = facts.wallAreaM2 ? "resolvido" : "pendente";
      if ((id === "cobertura" || id === "telhamento") && facts.roofMaterial) status = facts.builtAreaM2 ? "estimado" : "pendente";
      if (id === "piso" && (facts.floorMaterial || facts.floorAreaM2)) status = (facts.floorAreaM2 || facts.builtAreaM2) ? "estimado" : "pendente";
      if (id === "contrapiso" && (facts.contrapisoAreaM2 || facts.floorAreaM2)) status = facts.contrapisoThicknessCm ? "estimado" : "pendente";
      return { id: id, service: row[1], unit: row[2], searchTerms: row[3], dependsOnUserData: row[4], status: status };
    });
  }

  function estimatePreliminaryQuantities(projectFacts) {
    const facts = projectFacts || {};
    const quantities = [];
    const missing = [];
    const builtArea = number(facts.builtAreaM2 || facts.areaConstruidaM2);
    if (builtArea > 0) {
      quantities.push({ id: "area_construida", service: "Área construída", unit: "m2", quantity: builtArea, source: "informado", confidence: 0.95, note: "Área informada pelo usuário." });
      if (facts.floorMaterial) quantities.push({ id: "piso", service: "Piso", unit: "m2", quantity: number(facts.floorAreaM2) || builtArea, source: facts.floorAreaM2 ? "informado" : "estimado", confidence: facts.floorAreaM2 ? 0.95 : 0.65, note: facts.floorAreaM2 ? "Área de piso informada." : "Usando área construída como aproximação de piso." });
      if (facts.roofMaterial) quantities.push({ id: "cobertura", service: "Cobertura", unit: "m2", quantity: builtArea, source: "estimado", confidence: 0.55, note: "Área de cobertura preliminar; inclinação, beiral e perdas podem alterar." });
    }
    if (builtArea <= 0 && facts.floorMaterial && number(facts.floorAreaM2) > 0) {
      quantities.push({ id: "piso", service: "Piso", unit: "m2", quantity: number(facts.floorAreaM2), source: "informado", confidence: 0.95, note: "Área de piso informada." });
    }
    if (facts.contrapisoAreaM2 && facts.contrapisoThicknessCm) quantities.push({ id: "contrapiso", service: "Contrapiso", unit: "m3", quantity: number(facts.contrapisoAreaM2) * number(facts.contrapisoThicknessCm) / 100, source: "estimado", confidence: 0.7, note: "Volume estimado por área x espessura." });
    if (facts.slabAreaM2 && facts.slabThicknessCm) quantities.push({ id: "laje", service: "Laje/concreto", unit: "m3", quantity: number(facts.slabAreaM2) * number(facts.slabThicknessCm) / 100, source: "estimado", confidence: 0.7, note: "Volume estimado por área x espessura." });
    if (facts.wallHeightM && !facts.wallAreaM2) missing.push({ id: "wall_area", message: "Informe perímetro ou área de alvenaria para calcular blocos com precisão." });
    if (!facts.foundationType) missing.push({ id: "foundation_type", message: "Informe tipo de fundação: sapata, radier, baldrame ou outro." });
    if (!facts.structuralSystem) missing.push({ id: "structural_system", message: "Informe sistema estrutural principal para escolher composições de estrutura." });
    if (!facts.roofMaterial) missing.push({ id: "roof_material", message: "Informe tipo de cobertura/telha para selecionar composição." });
    if (!facts.floorMaterial) missing.push({ id: "floor_material", message: "Informe tipo de piso/revestimento." });
    return { quantities: quantities, missing: missing };
  }

  function searchComposition(query, unit) {
    const engine = root.CompositionSearchEngine;
    if (!engine || typeof engine.searchOfficialCompositions !== "function") return { found: false, candidates: [], reason: "composition_search_engine_unavailable" };
    return engine.searchOfficialCompositions(query, { unit: unit, limit: 3 });
  }

  function resolveCompositions(scope, facts) {
    return scope.map(function (item) {
      const extras = [];
      if (item.id === "alvenaria" && facts.wallMaterial) extras.push(facts.wallMaterial);
      if ((item.id === "cobertura" || item.id === "telhamento") && facts.roofMaterial) extras.push(facts.roofMaterial);
      if (item.id === "piso" && facts.floorMaterial) extras.push(facts.floorMaterial);
      const query = clean([item.searchTerms].concat(extras).join(" "));
      const result = searchComposition(query, item.unit);
      const candidates = (result.candidates || []).filter(function (c) { return Number(c.score || 0) >= 0.5; }).slice(0, 3).map(function (c) { return { code: c.code, description: c.description, unit: c.unit, score: c.score, reasons: (c.reasons || []).slice(0, 3) }; });
      return { scopeId: item.id, service: item.service, query: query, found: candidates.length > 0, canCalculateNow: item.status === "resolvido" && candidates.length > 0, missingData: item.status === "pendente", candidates: candidates };
    });
  }

  function buildRisks(facts, missing) {
    const risks = ["Este é um orçamento preliminar técnico. Para orçamento executivo, faltam projeto, dimensões completas, especificações e composição final."];
    if (missing.length) risks.push("Existem pendências técnicas; não é seguro fechar custo total ou consumo final.");
    if (!facts.wallAreaM2) risks.push("Área de alvenaria não consolidada; blocos, chapisco, reboco e pintura dependem de perímetro/vãos.");
    if (!facts.foundationType) risks.push("Fundação sem tipo definido; consumo de concreto/aço não deve ser estimado como executivo.");
    return risks;
  }

  function buildPreliminaryBudget(projectFacts, technicalContext) {
    const facts = collectFacts(projectFacts || {}, technicalContext || {});
    const type = inferProjectType(facts, technicalContext || {});
    facts.projectType = type;
    const scope = buildScope(type, facts);
    const quantityResult = estimatePreliminaryQuantities(facts);
    const compositions = resolveCompositions(scope, facts);
    const missing = quantityResult.missing.concat(scope.filter(function (item) { return item.status === "pendente"; }).map(function (item) { return { id: item.id, message: item.service + ": faltam premissas para cálculo executivo." }; }));
    const confidence = Math.max(0.25, Math.min(0.85, 0.35 + (facts.builtAreaM2 ? 0.15 : 0) + (facts.wallMaterial ? 0.1 : 0) + (facts.roofMaterial ? 0.1 : 0) + (facts.floorMaterial ? 0.1 : 0) - Math.min(0.25, missing.length * 0.02)));
    const budget = { mode: "preliminary_budget", confidence: Number(confidence.toFixed(2)), projectFacts: facts, scope: scope, quantities: quantityResult.quantities, compositions: compositions, missing: missing, risks: buildRisks(facts, missing), summary: "Orçamento preliminar estruturado com escopo, quantitativos seguros, composições candidatas e pendências." };
    return budget;
  }

  function formatQuantity(item) { return "- " + item.service + ": " + Number(item.quantity || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " " + item.unit + " (" + item.source + ") - " + item.note; }

  function buildBudgetReportText(budget) {
    const b = budget || buildPreliminaryBudget({}, {});
    const lines = ["ORÇAMENTO PRELIMINAR INICIADO", "", "Dados identificados:"];
    const facts = b.projectFacts || {};
    lines.push("- Tipo: " + (facts.projectType || "nao definido").replace(/_/g, " "));
    if (facts.builtAreaM2) lines.push("- Área construída: " + Number(facts.builtAreaM2).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²");
    if (facts.wallHeightM) lines.push("- Altura de paredes: " + Number(facts.wallHeightM).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m");
    if (facts.wallMaterial) lines.push("- Sistema de parede: " + facts.wallMaterial);
    if (facts.roofMaterial) lines.push("- Cobertura: " + facts.roofMaterial);
    if (facts.floorMaterial) lines.push("- Piso: " + facts.floorMaterial + (facts.floorAreaM2 ? " em " + facts.floorAreaM2 + " m²" : ""));
    lines.push("", "Escopo técnico inicial:");
    b.scope.forEach(function (item, index) { lines.push((index + 1) + ". " + item.service + " — " + item.status); });
    lines.push("", "Quantitativos preliminares:");
    if (b.quantities.length) b.quantities.forEach(function (item) { lines.push(formatQuantity(item)); }); else lines.push("- Nenhum quantitativo seguro calculado ainda.");
    lines.push("", "Composições SINAPI/ORSE candidatas:");
    const withCandidates = b.compositions.filter(function (item) { return item.candidates.length; });
    if (withCandidates.length) {
      withCandidates.slice(0, 8).forEach(function (item) {
        lines.push("- " + item.service + ":");
        item.candidates.slice(0, 3).forEach(function (c) { lines.push("  - " + c.code + " - " + c.description + " (" + c.unit + ", score " + c.score + ")"); });
      });
    } else {
      lines.push("- Ainda preciso dos sistemas construtivos para selecionar as composições corretas.");
    }
    lines.push("", "Pendências:");
    if (b.missing.length) b.missing.slice(0, 12).forEach(function (item) { lines.push("- " + item.message); }); else lines.push("- Nenhuma pendência crítica registrada nesta etapa preliminar.");
    lines.push("", "Riscos técnicos:");
    b.risks.forEach(function (risk) { lines.push("- " + risk); });
    lines.push("", "Próxima pergunta:", nextQuestion(b));
    return lines.join("\n");
  }

  function nextQuestion(budget) {
    const facts = budget.projectFacts || {};
    if (!facts.wallMaterial) return "Qual será o sistema principal de parede? Ex: bloco cerâmico baiano, bloco de concreto, drywall.";
    if (!facts.roofMaterial) return "Qual será o tipo de cobertura/telha?";
    if (!facts.floorMaterial) return "Qual será o tipo e a área de piso/revestimento?";
    if (!facts.wallAreaM2) return "Informe perímetro, área de alvenaria ou dimensões dos ambientes para calcular paredes com precisão.";
    return "Informe fundação, estrutura, instalações e esquadrias para evoluir o orçamento.";
  }

  root.EloBudgetEngine = { version: VERSION, scopeTemplates: SCOPE_TEMPLATES, buildPreliminaryBudget: buildPreliminaryBudget, estimatePreliminaryQuantities: estimatePreliminaryQuantities, buildBudgetReportText: buildBudgetReportText };
})(typeof window !== "undefined" ? window : globalThis);



