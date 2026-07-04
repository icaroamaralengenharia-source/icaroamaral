(function (root) {
  "use strict";

  const VERSION = "20260704-elo-technical-auditor-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = normalize(typeof item === "string" ? item : item && (item.id || item.message || item.nome));
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  const REQUIRED_CHECKS = [
    { id: "fundacao", label: "Fundacao", patterns: ["fundacao", "sapata", "radier", "estaca", "concreto fundacao", "concreto magro"] },
    { id: "baldrame", label: "Baldrame", patterns: ["baldrame", "viga baldrame"] },
    { id: "impermeabilizacao", label: "Impermeabilizacao", patterns: ["impermeabilizacao", "pintura asfaltica", "argamassa polimerica"] },
    { id: "alvenaria", label: "Alvenaria", patterns: ["alvenaria", "bloco", "tijolo"] },
    { id: "instalacoes", label: "Instalacoes", patterns: ["instalacao", "instalacoes", "eletrica", "hidraulica", "esgoto", "ponto de agua", "ponto eletrico"] },
    { id: "ralo", label: "Ralo", patterns: ["ralo"] },
    { id: "caixa_sifonada", label: "Caixa sifonada", patterns: ["caixa sifonada"] },
    { id: "chapisco_reboco", label: "Chapisco/reboco", patterns: ["chapisco", "reboco", "emboco", "massa unica"] },
    { id: "pintura", label: "Pintura", patterns: ["pintura", "selador", "tinta"] },
    { id: "limpeza", label: "Limpeza", patterns: ["limpeza final", "limpeza da obra", "limpeza terreno"] }
  ];

  function asArray(value) { return Array.isArray(value) ? value : []; }

  function inputPart(input, key) {
    const safe = input || {};
    const budget = safe.budget || {};
    return safe[key] || budget[key] || null;
  }

  function textFromEntry(entry) {
    return normalize([
      entry && entry.id,
      entry && entry.nome,
      entry && entry.name,
      entry && entry.service,
      entry && entry.description,
      entry && entry.disciplina,
      entry && entry.etapaId,
      entry && asArray(entry.termosBusca).join(" ")
    ].join(" "));
  }

  function matchesCheck(entry, check) {
    const text = textFromEntry(entry);
    return check.patterns.some(function (pattern) { return text.indexOf(normalize(pattern)) >= 0; });
  }

  function confirmedByResolution(check, resolution) {
    return asArray(resolution && resolution.resolvedItems).some(function (item) {
      return item.composicaoSelecionada && matchesCheck(item, check) && !asArray(item.bloqueadores).length && !asArray(item.pendencias).length;
    });
  }

  function unresolvedByResolution(check, resolution) {
    return asArray(resolution && resolution.unresolvedItems).filter(function (item) {
      return item.obrigatorio !== false && matchesCheck(item, check);
    });
  }

  function confirmedByText(check, input) {
    const facts = inputPart(input, "projectFacts") || {};
    const construction = inputPart(input, "constructionReadiness") || {};
    const text = normalize([
      input && input.originalMessage,
      facts.originalMessage,
      construction.encontrados && construction.encontrados.join(" ")
    ].join(" "));
    return check.patterns.some(function (pattern) { return text.indexOf(normalize(pattern)) >= 0; });
  }

  function collectMissingItems(input) {
    const resolution = inputPart(input, "compositionResolution") || {};
    const eap = inputPart(input, "budgetEap") || {};
    return REQUIRED_CHECKS.map(function (check) {
      const unresolved = unresolvedByResolution(check, resolution);
      const eapHasItem = asArray(eap.itens).some(function (item) { return matchesCheck(item, check); });
      const confirmed = confirmedByResolution(check, resolution) || (!resolution.unresolvedItems && confirmedByText(check, input));
      if (confirmed) return null;
      return {
        id: check.id,
        item: check.label,
        severity: unresolved.length ? "alta" : "media",
        reason: unresolved.length ? "item_obrigatorio_sem_composicao_confiavel" : (eapHasItem ? "item_previsto_sem_confirmacao_tecnica" : "item_nao_identificado"),
        message: check.label + " nao esta tecnicamente confirmado para orcamento executivo."
      };
    }).filter(Boolean);
  }

  function collectBlockers(input, missingItems) {
    const eap = inputPart(input, "budgetEap") || {};
    const construction = inputPart(input, "constructionReadiness") || {};
    const resolution = inputPart(input, "compositionResolution") || {};
    const blockers = [];

    asArray(eap.bloqueadores).forEach(function (item) {
      blockers.push({ id: item.id || item, message: item.message || clean(item), source: "budget_eap", severity: item.severity || "critica" });
    });
    asArray(construction.bloqueadores).forEach(function (item) {
      blockers.push({ id: item, message: "Bloqueador de obra: " + item + ".", source: "construction_readiness", severity: "alta" });
    });
    asArray(resolution.unresolvedItems).filter(function (item) { return item.obrigatorio !== false; }).slice(0, 12).forEach(function (item) {
      blockers.push({ id: item.eapItemId || item.nome, message: "Item obrigatorio sem composicao confiavel: " + item.nome + ".", source: "composition_resolution", severity: "alta" });
    });
    if (missingItems.some(function (item) { return item.id === "fundacao"; })) {
      blockers.push({ id: "fundacao_nao_confirmada", message: "Fundacao nao confirmada bloqueia orcamento executivo.", source: "technical_audit", severity: "critica" });
    }
    return unique(blockers);
  }

  function collectAssumptions(input) {
    const eap = inputPart(input, "budgetEap") || {};
    const construction = inputPart(input, "constructionReadiness") || {};
    return unique([].concat(asArray(eap.assumidos), asArray(construction.assumidos), asArray(input && input.assumptions))).map(function (item) {
      return clean(item);
    });
  }

  function collectInconsistencies(input, blockers) {
    const eap = inputPart(input, "budgetEap") || {};
    const construction = inputPart(input, "constructionReadiness") || {};
    const resolution = inputPart(input, "compositionResolution") || {};
    const inconsistencies = [];
    if (eap.podeFecharOrcamentoCompleto === true) inconsistencies.push({ id: "eap_executivo_v1", message: "EAP sinalizou fechamento completo, mas a V1 do auditor mantem executiveBudget=false." });
    if (construction.podeFecharOrcamentoCompleto === true) inconsistencies.push({ id: "construction_executivo_v1", message: "Motor de obra sinalizou fechamento completo, mas a V1 do auditor mantem executiveBudget=false." });
    if (resolution.podeFecharOrcamentoCompleto === true && blockers.length) inconsistencies.push({ id: "resolver_com_bloqueadores", message: "Resolver indica composicoes fechadas, mas ainda existem bloqueadores tecnicos." });
    return inconsistencies;
  }

  function recommendationFor(item) {
    const map = {
      fundacao: "Confirmar tipo de fundacao, dimensoes, concreto, formas e aco antes de qualquer fechamento.",
      baldrame: "Detalhar viga baldrame, secoes, comprimentos, forma, aco e concreto.",
      impermeabilizacao: "Definir sistema de impermeabilizacao do baldrame e areas molhadas.",
      alvenaria: "Confirmar material de parede, altura, perimetro, vaos, vergas e contravergas.",
      instalacoes: "Levantar pontos eletricos, hidraulicos, esgoto, tubulacoes, caixas e testes.",
      ralo: "Confirmar ralos por banheiro, cozinha, area de servico e areas molhadas.",
      caixa_sifonada: "Confirmar caixa sifonada e ligacoes de esgoto.",
      chapisco_reboco: "Quantificar chapisco, emboco/reboco interno e externo.",
      pintura: "Quantificar pintura interna, externa, teto, selador e massa quando aplicavel.",
      limpeza: "Manter limpeza final como item obrigatorio da EAP."
    };
    return map[item.id] || ("Confirmar " + item.item + " antes do fechamento tecnico.");
  }

  function calculateConfidence(missingItems, blockers, assumptions, inconsistencies, resolution) {
    const unresolvedRequired = asArray(resolution && resolution.unresolvedItems).filter(function (item) { return item.obrigatorio !== false; }).length;
    const score = 0.82
      - Math.min(0.3, blockers.length * 0.025)
      - Math.min(0.28, missingItems.length * 0.025)
      - Math.min(0.18, unresolvedRequired * 0.01)
      - Math.min(0.12, assumptions.length * 0.03)
      - Math.min(0.12, inconsistencies.length * 0.04);
    return Number(clamp(score, 0.15, 0.82).toFixed(2));
  }

  function auditTechnicalBudget(input) {
    const safe = input || {};
    const resolution = inputPart(safe, "compositionResolution") || {};
    const missingItems = collectMissingItems(safe);
    const blockers = collectBlockers(safe, missingItems);
    const assumptions = collectAssumptions(safe);
    const inconsistencies = collectInconsistencies(safe, blockers);
    const confidence = calculateConfidence(missingItems, blockers, assumptions, inconsistencies, resolution);
    const status = blockers.length ? "blocked" : missingItems.length ? "partial" : "review";
    const maturity = blockers.length ? "pre_executive_blocked" : missingItems.length ? "pre_executive_incomplete" : "pre_executive_review";
    const recommendations = unique(missingItems.map(recommendationFor).concat([
      "Nao calcular preco na auditoria tecnica V1.",
      "Nao inventar composicao: use somente composicoes oficiais confiaveis."
    ]));

    return {
      version: VERSION,
      status: status,
      maturity: maturity,
      confidence: confidence,
      canGenerate: {
        preliminaryBudget: true,
        executiveBudget: false,
        pdf: false
      },
      executiveBudget: false,
      missingItems: missingItems,
      inconsistencies: inconsistencies,
      assumptions: assumptions,
      recommendations: recommendations,
      blockers: blockers,
      summary: "Auditoria tecnica V1: orcamento executivo bloqueado; revisar itens obrigatorios, composicoes oficiais e premissas antes de qualquer fechamento."
    };
  }

  root.EloTechnicalAuditor = {
    version: VERSION,
    auditTechnicalBudget: auditTechnicalBudget
  };
  root.auditTechnicalBudget = auditTechnicalBudget;
})(typeof window !== "undefined" ? window : globalThis);
