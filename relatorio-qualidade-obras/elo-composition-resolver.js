(function (root) {
  "use strict";

  const VERSION = "20260704-elo-composition-resolver-v1";
  const DEFAULT_MAX_CANDIDATES = 5;
  const MIN_CONFIDENCE = 0.55;
  const LOW_CONFIDENCE_REQUIRED = 0.7;
  const GENERIC_TERMS = {
    servico: 1,
    obra: 1,
    construcao: 1,
    fornecimento: 1,
    instalacao: 1,
    execucao: 1,
    diverso: 1,
    diversos: 1
  };

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value)
      .replace(/m[²2]/gi, "m2")
      .replace(/m[³3]/gi, "m3")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function normalizeUnit(value) {
    const text = normalize(value);
    if (/^(m2|metro quadrado|metros quadrados)$/.test(text)) return "m2";
    if (/^(m3|metro cubico|metros cubicos)$/.test(text)) return "m3";
    if (/^(m|metro|metros)$/.test(text)) return "m";
    if (/^(un|und|unidade|unidades)$/.test(text)) return "un";
    if (/^(kg|quilo|quilograma|quilogramas)$/.test(text)) return "kg";
    if (/^(l|litro|litros)$/.test(text)) return "l";
    if (/^(pt|ponto|pontos)$/.test(text)) return "pt";
    return text;
  }
  function singular(token) {
    const text = normalize(token);
    if (text.length <= 3) return text;
    if (/coes$/.test(text)) return text.replace(/coes$/, "cao");
    if (/oes$/.test(text)) return text.replace(/oes$/, "ao");
    if (/s$/.test(text) && !/ss$/.test(text)) return text.slice(0, -1);
    return text;
  }
  function tokens(value) {
    const seen = {};
    return normalize(value).split(" ").map(singular).filter(function (token) {
      if (!token || token.length < 2 || seen[token]) return false;
      seen[token] = 1;
      return true;
    });
  }
  function includesToken(text, token) {
    return tokens(text).indexOf(singular(token)) >= 0;
  }
  function field(candidate, names) {
    for (let index = 0; index < names.length; index += 1) {
      const value = candidate && candidate[names[index]];
      if (value !== undefined && value !== null && clean(value)) return value;
    }
    return "";
  }
  function descriptionOf(candidate) {
    return clean(field(candidate, ["description", "name", "service", "compositionName", "nome"]));
  }
  function unitOf(candidate) {
    return normalizeUnit(field(candidate, ["unit", "productionUnit", "compositionUnit", "unidade"]));
  }
  function codeOf(candidate) {
    return clean(field(candidate, ["code", "id", "compositionCode", "codigo"]));
  }
  function essentialTerms(item) {
    const fromName = tokens(item.nome || "").filter(function (token) { return !GENERIC_TERMS[token]; });
    const fromTerms = tokens((item.termosBusca || []).join(" ")).filter(function (token) { return !GENERIC_TERMS[token]; });
    return fromName.concat(fromTerms).filter(function (token, index, list) { return list.indexOf(token) === index; }).slice(0, 8);
  }
  function candidateText(candidate) {
    return [codeOf(candidate), descriptionOf(candidate), field(candidate, ["source", "base", "provider"]), field(candidate, ["category", "classe", "serviceType"])].join(" ");
  }
  function unitCompatible(expected, found) {
    const expectedUnit = normalizeUnit(expected);
    const foundUnit = normalizeUnit(found);
    if (!expectedUnit || !foundUnit) return { compatible: false, reason: "unidade_nao_informada", delta: -0.18 };
    if (expectedUnit === foundUnit) return { compatible: true, reason: "unidade_compativel", delta: 0.22 };
    if ((expectedUnit === "un" && foundUnit === "pt") || (expectedUnit === "pt" && foundUnit === "un")) {
      return { compatible: false, reason: "unidade_proxima_nao_automatica", delta: -0.22 };
    }
    return { compatible: false, reason: "unidade_incompativel", delta: -0.35 };
  }
  function rankCandidate(item, candidate) {
    const reasons = [];
    const expectedUnit = normalizeUnit(item.unidadeEsperada);
    const foundUnit = unitOf(candidate);
    const unit = unitCompatible(expectedUnit, foundUnit);
    let confidence = Number(candidate && candidate.score || 0);
    if (!Number.isFinite(confidence)) confidence = 0;
    confidence += unit.delta;
    reasons.push(unit.reason);

    const text = candidateText(candidate);
    const terms = essentialTerms(item);
    const matches = terms.filter(function (term) { return includesToken(text, term); });
    if (matches.length) {
      confidence += Math.min(0.22, matches.length * 0.055);
      reasons.push("termos_essenciais: " + matches.slice(0, 5).join(", "));
    } else {
      confidence -= 0.2;
      reasons.push("sem_termo_essencial");
    }

    const discipline = normalize(item.disciplina);
    const stage = normalize(item.etapaId);
    if (discipline && normalize(text).indexOf(discipline) >= 0) {
      confidence += 0.08;
      reasons.push("disciplina_compativel");
    }
    if (stage && normalize(text).indexOf(stage.replace(/_/g, " ")) >= 0) {
      confidence += 0.04;
      reasons.push("etapa_compativel");
    }
    if (descriptionOf(candidate) && tokens(descriptionOf(candidate)).length <= 2) {
      confidence -= 0.12;
      reasons.push("descricao_generica");
    }

    confidence = Math.max(0, Math.min(0.99, confidence));
    return Object.assign({}, candidate, {
      confianca: Number(confidence.toFixed(2)),
      unidadeCompativel: unit.compatible,
      motivoEscolha: reasons.join("; ")
    });
  }
  function searchItem(item, engine, maxCandidates) {
    const query = clean((item.termosBusca && item.termosBusca.length ? item.termosBusca : [item.nome]).join(" "));
    if (!engine || typeof engine.searchOfficialCompositions !== "function") {
      return { query: query, candidatos: [], reason: "composition_search_engine_unavailable" };
    }
    const result = engine.searchOfficialCompositions(query, { unit: item.unidadeEsperada, limit: maxCandidates });
    return {
      query: query,
      candidatos: (result.candidates || []).slice(0, maxCandidates),
      reason: result.reason || "",
      searchedTerms: result.searchedTerms || []
    };
  }
  function unresolvedFrom(item, candidatos, reason) {
    const pendencias = (item.pendencias || []).slice();
    if (pendencias.indexOf("composicao_sinapi_nao_resolvida") < 0) pendencias.push("composicao_sinapi_nao_resolvida");
    return {
      eapItemId: item.id,
      etapaId: item.etapaId,
      nome: item.nome,
      disciplina: item.disciplina,
      unidadeEsperada: item.unidadeEsperada,
      termosBusca: (item.termosBusca || []).slice(),
      candidatos: candidatos || [],
      composicaoSelecionada: null,
      confianca: 0,
      motivoEscolha: reason || "sem_candidato_confiavel",
      pendencias: pendencias,
      bloqueadores: (item.bloqueadores || []).slice(),
      obrigatorio: item.obrigatorio !== false,
      auxiliaresDetectadas: []
    };
  }
  function resolvedFrom(item, ranked) {
    return {
      eapItemId: item.id,
      etapaId: item.etapaId,
      nome: item.nome,
      disciplina: item.disciplina,
      unidadeEsperada: item.unidadeEsperada,
      termosBusca: (item.termosBusca || []).slice(),
      candidatos: ranked,
      composicaoSelecionada: ranked[0] || null,
      confianca: ranked[0] ? ranked[0].confianca : 0,
      motivoEscolha: ranked[0] ? ranked[0].motivoEscolha : "",
      pendencias: (item.pendencias || []).slice(),
      bloqueadores: (item.bloqueadores || []).slice(),
      obrigatorio: item.obrigatorio !== false,
      auxiliaresDetectadas: []
    };
  }
  function resolveEloEapCompositions(input) {
    const settings = input || {};
    const eap = settings.eap || {};
    const engine = settings.compositionSearchEngine || root.CompositionSearchEngine || null;
    const maxCandidates = Math.max(1, Number(settings.maxCandidates || DEFAULT_MAX_CANDIDATES) || DEFAULT_MAX_CANDIDATES);
    const resolvedItems = [];
    const unresolvedItems = [];
    const eapBlockers = (eap.bloqueadores || []).slice();

    (eap.itens || []).forEach(function (entry) {
      const search = searchItem(entry, engine, maxCandidates);
      const ranked = search.candidatos.map(function (candidate) {
        return rankCandidate(entry, candidate);
      }).sort(function (a, b) {
        return b.confianca - a.confianca || codeOf(a).localeCompare(codeOf(b));
      }).slice(0, maxCandidates);
      const best = ranked[0] || null;
      const required = entry.obrigatorio !== false;
      const canSelect = best && best.unidadeCompativel && best.confianca >= MIN_CONFIDENCE;
      const lowConfidenceRequired = required && best && best.confianca < LOW_CONFIDENCE_REQUIRED;
      if (canSelect && !lowConfidenceRequired) {
        resolvedItems.push(resolvedFrom(entry, ranked));
      } else {
        const reason = !best ? (search.reason || "sem_candidato") : (!best.unidadeCompativel ? "unidade_incompativel" : "baixa_confianca");
        unresolvedItems.push(unresolvedFrom(entry, ranked, reason));
      }
    });

    const requiredUnresolved = unresolvedItems.filter(function (item) { return item.obrigatorio !== false; });
    const lowConfidenceResolved = resolvedItems.filter(function (item) { return item.obrigatorio !== false && Number(item.confianca || 0) < LOW_CONFIDENCE_REQUIRED; });
    const summary = {
      version: VERSION,
      totalItems: (eap.itens || []).length,
      resolvedCount: resolvedItems.length,
      unresolvedCount: unresolvedItems.length,
      requiredUnresolvedCount: requiredUnresolved.length,
      lowConfidenceRequiredCount: lowConfidenceResolved.length,
      eapBlockersCount: eapBlockers.length,
      maxCandidates: maxCandidates
    };
    return {
      resolvedItems: resolvedItems,
      unresolvedItems: unresolvedItems,
      summary: summary,
      podeFecharOrcamentoCompleto: requiredUnresolved.length === 0 && lowConfidenceResolved.length === 0 && eapBlockers.length === 0
    };
  }

  root.EloCompositionResolver = { version: VERSION, resolveEloEapCompositions: resolveEloEapCompositions };
  root.resolveEloEapCompositions = resolveEloEapCompositions;
})(typeof window !== "undefined" ? window : globalThis);
