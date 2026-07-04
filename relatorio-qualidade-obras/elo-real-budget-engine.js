(function (root) {
  "use strict";

  const VERSION = "20260704-elo-real-budget-engine-v1";

  function clean(value) { return String(value || "").replace(/s+/g, " ").trim(); }
  function number(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  function round(value) { return Number((Number(value || 0)).toFixed(2)); }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function unique(items) {
    const seen = {};
    return asArray(items).filter(function (item) {
      const key = clean(typeof item === "string" ? item : item && (item.id || item.eapItemId || item.message || item.item || item.nome)).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function compositionCode(composition) {
    return clean(composition && (composition.code || composition.codigo || composition.compositionCode || composition.id));
  }
  function compositionDescription(composition) {
    return clean(composition && (composition.description || composition.nome || composition.name || composition.compositionName || composition.service));
  }
  function selectedComposition(resolved) {
    return resolved && (resolved.composicaoSelecionada || resolved.composition || resolved.candidate || resolved.candidatos && resolved.candidatos[0]) || null;
  }
  function stageName(eap, etapaId) {
    const stage = asArray(eap && eap.etapas).find(function (entry) { return clean(entry.id) === clean(etapaId); });
    return clean(stage && (stage.nome || stage.name)) || clean(etapaId);
  }

  function findResolvedComposition(item, compositionResolution) {
    return asArray(compositionResolution && compositionResolution.resolvedItems).find(function (resolved) {
      return clean(resolved.eapItemId) === clean(item.id);
    }) || null;
  }

  function findQuantity(item, quantities) {
    const explicit = asArray(quantities).find(function (quantity) {
      return clean(quantity.eapItemId || quantity.itemId || quantity.id) === clean(item.id) ||
        (clean(quantity.etapaId || quantity.packageId) === clean(item.etapaId) && clean(quantity.serviceId || quantity.nome || quantity.item) === clean(item.id));
    });
    const source = explicit || item.quantidadeBase || item.quantityBase || null;
    if (!source) return null;
    const value = number(source.valor != null ? source.valor : (source.quantity != null ? source.quantity : source.value));
    const unit = clean(source.unidade || source.unit || item.unidadeEsperada);
    if (value == null || !unit) return null;
    return {
      quantity: value,
      unit: unit,
      source: clean(source.origem || source.source || (explicit ? "quantities" : "eap"))
    };
  }

  function findPrice(composition, priceBase) {
    const code = compositionCode(composition);
    const source = priceBase || {};
    const direct = source[code] != null ? source[code] : source.prices && source.prices[code];
    const price = number(direct != null ? direct : (composition && (composition.unitPrice || composition.price || composition.precoUnitario)));
    if (price == null) return null;
    return { unitPrice: price, source: clean(source.source || source.base || composition.source || composition.fonte || "priceBase") };
  }

  function hasExecutiveRelease(technicalAudit) {
    return technicalAudit && technicalAudit.canGenerate && technicalAudit.canGenerate.executiveBudget === true;
  }

  function auditBlockers(technicalAudit) {
    const blockers = [];
    asArray(technicalAudit && technicalAudit.blockers).forEach(function (item) {
      blockers.push({ id: item.id || clean(item), message: item.message || clean(item), source: item.source || "technical_audit" });
    });
    if (technicalAudit && !hasExecutiveRelease(technicalAudit)) {
      blockers.push({ id: "technical_audit_executive_blocked", message: "Technical Auditor nao liberou orcamento executivo.", source: "technical_audit" });
    }
    return unique(blockers);
  }

  function buildCompleteBudget(input) {
    const safe = input || {};
    const eap = safe.budgetEap || {};
    const compositionResolution = safe.compositionResolution || {};
    const technicalAudit = safe.technicalAudit || {};
    const quantities = safe.quantities || [];
    const priceBase = safe.priceBase || safe.priceSource || safe.prices || {};
    const bdiPercent = number(safe.bdiPercent != null ? safe.bdiPercent : safe.bdi) || 0;
    const missingCompositions = [];
    const missingQuantities = [];
    const missingPrices = [];
    const items = [];

    asArray(eap.itens).forEach(function (item) {
      const resolved = findResolvedComposition(item, compositionResolution);
      const composition = selectedComposition(resolved);
      const code = compositionCode(composition);
      const quantity = findQuantity(item, quantities);
      const price = composition ? findPrice(composition, priceBase) : null;
      const required = item.obrigatorio !== false;

      if (!composition || !code) {
        if (required) missingCompositions.push({ eapItemId: item.id, etapaId: item.etapaId, item: item.nome, reason: "composition_missing" });
        return;
      }
      if (!quantity) {
        if (required) missingQuantities.push({ eapItemId: item.id, etapaId: item.etapaId, item: item.nome, compositionCode: code, reason: "quantity_missing" });
        return;
      }
      if (!price) {
        if (required) missingPrices.push({ eapItemId: item.id, etapaId: item.etapaId, item: item.nome, compositionCode: code, reason: "price_missing" });
        return;
      }

      items.push({
        etapaId: item.etapaId || "",
        etapa: stageName(eap, item.etapaId),
        eapItemId: item.id || "",
        item: item.nome || "",
        quantity: quantity.quantity,
        unit: quantity.unit,
        compositionCode: code,
        compositionDescription: compositionDescription(composition),
        unitPrice: price.unitPrice,
        subtotal: round(quantity.quantity * price.unitPrice),
        source: price.source,
        confidence: number(resolved && resolved.confianca) != null ? number(resolved.confianca) : null
      });
    });

    const subtotal = round(items.reduce(function (sum, item) { return sum + Number(item.subtotal || 0); }, 0));
    const bdiValue = round(subtotal * bdiPercent / 100);
    const total = round(subtotal + bdiValue);
    const auditIssues = auditBlockers(technicalAudit);
    const blockers = unique([].concat(
      missingCompositions.map(function (item) { return { id: "composition:" + item.eapItemId, message: "Composicao faltante para " + item.item + ".", source: "composition" }; }),
      missingQuantities.map(function (item) { return { id: "quantity:" + item.eapItemId, message: "Quantidade faltante para " + item.item + ".", source: "quantity" }; }),
      missingPrices.map(function (item) { return { id: "price:" + item.eapItemId, message: "Preco unitario faltante para " + item.item + ".", source: "price" }; }),
      auditIssues
    ));
    const canClose = missingCompositions.length === 0 && missingQuantities.length === 0 && missingPrices.length === 0 && hasExecutiveRelease(technicalAudit);
    const status = canClose ? "complete" : (items.length ? "partial" : "blocked");

    return {
      version: VERSION,
      status: status,
      canClose: canClose,
      items: items,
      subtotal: subtotal,
      bdiPercent: bdiPercent,
      bdiValue: bdiValue,
      total: total,
      missingCompositions: missingCompositions,
      missingQuantities: missingQuantities,
      missingPrices: missingPrices,
      blockers: blockers,
      assumptions: unique([].concat(asArray(technicalAudit.assumptions), asArray(eap.assumidos), asArray(safe.assumptions))),
      summary: canClose ? "Orcamento completo calculado com itens reais, BDI e total." : "Orcamento parcial: tabela gerada apenas para itens com composicao, quantidade e preco."
    };
  }

  root.EloRealBudgetEngine = {
    version: VERSION,
    buildCompleteBudget: buildCompleteBudget
  };
  root.buildCompleteBudget = buildCompleteBudget;
})(typeof window !== "undefined" ? window : globalThis);
