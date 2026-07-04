(function (root) {
  "use strict";

  const VERSION = "20260624-elo-budget-engine-v3-operational";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function clone(obj) { return JSON.parse(JSON.stringify(obj || {})); }

  function collectM2Values(text) {
    const values = [];
    String(text || "").replace(/(\d+(?:[,.]\d+)?)\s*m[²2]/gi, function (_, value) { values.push(number(value)); return _; });
    return values.filter(function (value) { return value > 0; });
  }

  function parseSmallCount(value) {
    const text = normalize(value);
    const direct = number(text);
    if (direct) return direct;
    const words = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6 };
    return words[text] || 0;
  }

  function extractCountBeforeTerm(rawText, termPattern) {
    const text = normalize(rawText);
    const match = text.match(new RegExp("\\b(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis)\\s+" + termPattern + "\\b"));
    return match ? parseSmallCount(match[1]) : 0;
  }

  function buildProgramSummary(facts) {
    const parts = [];
    if (facts.bedrooms) parts.push(facts.bedrooms + " quarto" + (facts.bedrooms > 1 ? "s" : "") + (facts.bedroomProfile ? " de " + facts.bedroomProfile : ""));
    if (facts.bathrooms) parts.push(facts.bathrooms + " banheiro" + (facts.bathrooms > 1 ? "s" : ""));
    return parts.join(", ");
  }

  function collectFacts(projectFacts, technicalContext) {
    const facts = clone(projectFacts);
    const tech = technicalContext || {};
    const services = tech.services || {};
    const rawText = [facts.originalMessage, tech.lastMessage].map(clean).join(" ");
    const text = normalize(rawText);
    const m2Values = collectM2Values(rawText);

    if (!facts.builtAreaM2 && !facts.areaConstruidaM2 && /casa|area|terrea|orcamento|orcar|obra/.test(text) && m2Values.length) facts.builtAreaM2 = m2Values[0];
    const heightMatch = rawText.match(/paredes?[^\d]*(\d+(?:[,.]\d+)?)\s*m(?:\s|$|de\s+altura)/i) || rawText.match(/altura[^\d]*(\d+(?:[,.]\d+)?)\s*m\b/i);
    if (!facts.wallHeightM && heightMatch) facts.wallHeightM = number(heightMatch[1]);
    const perimeterMatch = rawText.match(/per[ií]metro[^\d]*(\d+(?:[,.]\d+)?)\s*m\b/i);
    if (!facts.wallPerimeterM && perimeterMatch) facts.wallPerimeterM = number(perimeterMatch[1]);
    const wallAreaMatch = rawText.match(/(?:alvenaria|parede|paredes)[^\d]*(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (!facts.wallAreaM2 && wallAreaMatch) facts.wallAreaM2 = number(wallAreaMatch[1]);

    if (!facts.wallMaterial && /bloco\s+(baiano|ceramico|cerâmico)/i.test(rawText)) facts.wallMaterial = /baiano/i.test(rawText) ? "bloco ceramico baiano" : "bloco ceramico";
    if (!facts.bathrooms) facts.bathrooms = extractCountBeforeTerm(rawText, "banheiros?");
    if (!facts.bedrooms) facts.bedrooms = extractCountBeforeTerm(rawText, "quartos?");
    if (!facts.bedroomProfile && /quartos?\s+de\s+casal/.test(text)) facts.bedroomProfile = "casal";
    if (!facts.projectStandard && /simples/.test(text)) facts.projectStandard = "simples";
    if (!facts.projectStandard && /economico/.test(text)) facts.projectStandard = "economico";
    if (!facts.projectStandard && /padrao\s+medio/.test(text)) facts.projectStandard = "medio";
    if (!facts.projectStandard && /alto\s+padrao/.test(text)) facts.projectStandard = "alto";
    if (!facts.programSummary) facts.programSummary = buildProgramSummary(facts);
    if (!facts.roofMaterial && /telha\s+portuguesa/i.test(rawText)) facts.roofMaterial = "telha portuguesa";
    if (!facts.roofStructure && /estrutura\s+de\s+madeira/i.test(rawText)) facts.roofStructure = "estrutura de madeira";
    if (!facts.floorMaterial && /piso\s+ceramico|piso\s+cerâmico|porcelanato/i.test(rawText)) facts.floorMaterial = /porcelanato/i.test(rawText) ? "porcelanato" : "piso ceramico";
    if (!facts.floorAreaM2 && facts.floorMaterial && m2Values.length) facts.floorAreaM2 = m2Values.length > 1 ? m2Values[m2Values.length - 1] : (!facts.builtAreaM2 ? m2Values[0] : 0);

    if (!facts.floorAreaM2 && services.piso_ceramico && services.piso_ceramico.areaM2) facts.floorAreaM2 = services.piso_ceramico.areaM2;
    if (!facts.floorMaterial && services.piso_ceramico) facts.floorMaterial = services.piso_ceramico.service || "piso ceramico";
    if (!facts.roofMaterial && services.telhado && services.telhado.material) facts.roofMaterial = services.telhado.material;
    if (!facts.roofStructure && services.telhado && services.telhado.structure) facts.roofStructure = services.telhado.structure;
    if (!facts.wallMaterial && tech.facts && tech.facts.wallMaterial) facts.wallMaterial = tech.facts.wallMaterial;
    if (!facts.builtAreaM2 && tech.facts && tech.facts.builtAreaM2) facts.builtAreaM2 = tech.facts.builtAreaM2;
    if (!facts.wallHeightM && tech.facts && tech.facts.wallHeightM) facts.wallHeightM = tech.facts.wallHeightM;
    if (!facts.wallPerimeterM && tech.facts && tech.facts.wallPerimeterM) facts.wallPerimeterM = tech.facts.wallPerimeterM;
    if (services.contrapiso && services.contrapiso.areaM2) facts.contrapisoAreaM2 = services.contrapiso.areaM2;
    if (services.contrapiso && services.contrapiso.thicknessCm) facts.contrapisoThicknessCm = services.contrapiso.thicknessCm;
    return facts;
  }

  function searchComposition(query, unit) {
    const engine = root.CompositionSearchEngine;
    if (!engine || typeof engine.searchOfficialCompositions !== "function") return { found: false, candidates: [], reason: "composition_search_engine_unavailable" };
    return engine.searchOfficialCompositions(query, { unit: unit, limit: 5 });
  }

  function serviceExtras(packageId, facts) {
    const extras = [];
    if (packageId === "alvenaria" && facts.wallMaterial) extras.push(facts.wallMaterial);
    if (packageId === "cobertura" && facts.roofMaterial) extras.push(facts.roofMaterial);
    if (packageId === "cobertura" && facts.roofStructure) extras.push(facts.roofStructure);
    if (packageId === "piso_revestimento" && facts.floorMaterial) extras.push(facts.floorMaterial);
    if (packageId === "contrapiso") extras.push("contrapiso argamassa");
    return extras;
  }

  function resolveCompositionMatches(workPackages, quantities, facts) {
    const matches = [];
    (workPackages.packages || []).forEach(function (pack) {
      (pack.services || []).forEach(function (service) {
        const quantity = quantities.find(function (item) { return item.packageId === pack.id && item.serviceId === service.id; });
        const requestedUnit = quantity && quantity.unit || service.unit;
        const query = clean((pack.searchTerms || []).concat(serviceExtras(pack.id, facts)).join(" "));
        const result = searchComposition(query, requestedUnit);
        const candidates = (result.candidates || []).filter(function (candidate) { return Number(candidate.score || 0) >= 0.5; }).slice(0, 3);
        matches.push({
          packageId: pack.id,
          serviceId: service.id,
          service: service.description,
          query: query,
          found: candidates.length > 0,
          candidates: candidates,
          composition: candidates[0] || null,
          searchedTerms: result.searchedTerms || [],
          reason: result.reason || ""
        });
      });
    });
    return matches;
  }

  function buildRisks(facts, missing) {
    const risks = ["Este é um orçamento preliminar técnico. Não substitui orçamento executivo, projeto completo, memorial e validação profissional."];
    if ((missing || []).length) risks.push("Existem pendências técnicas; não é seguro fechar custo total ou consumo final.");
    if (!number(facts.wallAreaM2) && !(number(facts.wallPerimeterM) && number(facts.wallHeightM))) risks.push("Área de alvenaria não consolidada; blocos, chapisco, reboco e pintura dependem de perímetro/vãos.");
    if (!facts.foundationType) risks.push("Fundação sem tipo definido; consumo de concreto/aço não deve ser estimado como executivo.");
    return risks;
  }

  function buildConstructionReadiness(facts, technicalContext) {
    const sequenceEngine = root.EloConstructionSequenceEngine || null;
    const roomEngine = root.EloRoomRequirementsEngine || null;
    const gateEngine = root.EloStageGateEngine || null;
    const sourceText = [facts && facts.originalMessage, technicalContext && technicalContext.lastMessage].map(clean).join(" ");
    const construction = sequenceEngine && sequenceEngine.analyzeConstruction ? sequenceEngine.analyzeConstruction({
      originalMessage: sourceText,
      projectFacts: facts || {},
      foundItems: technicalContext && technicalContext.foundItems || {}
    }) : null;
    const rooms = roomEngine && roomEngine.validateRooms ? roomEngine.validateRooms({
      text: sourceText,
      rooms: technicalContext && (technicalContext.rooms || technicalContext.ambientes) || []
    }) : null;
    const gate = gateEngine && gateEngine.evaluateBudgetGate ? gateEngine.evaluateBudgetGate({
      construction: construction,
      rooms: rooms
    }) : {
      status: "partial",
      complete: false,
      partial: true,
      blocked: false,
      pendentes: [],
      bloqueadores: [],
      podeFecharOrcamentoCompleto: false,
      podeGerarEstimativaPreliminar: true,
      motivo: "Motor deterministico de obra nao carregado."
    };
    return {
      etapaAtual: construction && construction.etapaAtual || null,
      encontrados: construction && construction.encontrados || [],
      pendentes: construction && construction.pendentes || [],
      assumidos: construction && construction.assumidos || [],
      bloqueadores: gate.bloqueadores || [],
      termosBuscaPorItem: construction && construction.termosBuscaPorItem || {},
      proximaPergunta: construction && construction.proximaPergunta || nextQuestion({ projectFacts: facts || {} }),
      podeFecharOrcamentoCompleto: gate.podeFecharOrcamentoCompleto === true,
      podeGerarEstimativaPreliminar: gate.podeGerarEstimativaPreliminar !== false,
      status: gate.status,
      rooms: rooms,
      gate: gate
    };
  }
  function buildBudgetEap(facts, technicalContext) {
    const eapEngine = root.EloBudgetEapEngine || null;
    if (!eapEngine || typeof eapEngine.buildEloBudgetEap !== "function") return null;
    const sourceText = [facts && facts.originalMessage, technicalContext && technicalContext.lastMessage].map(clean).join(" ");
    return eapEngine.buildEloBudgetEap({
      tipo: facts && (facts.projectType || facts.tipoObra || facts.type),
      originalMessage: sourceText,
      areaConstruidaM2: facts && (facts.builtAreaM2 || facts.areaConstruidaM2),
      builtAreaM2: facts && (facts.builtAreaM2 || facts.areaConstruidaM2),
      ambientes: {
        quartos: facts && facts.bedrooms,
        banheiros: facts && facts.bathrooms,
        suites: facts && facts.suites,
        cozinha: facts && (facts.kitchen || facts.cozinha),
        areaServico: facts && (facts.areaServico || facts.serviceArea)
      },
      cobertura: facts && facts.roofMaterial,
      parede: facts && facts.wallMaterial,
      piso: facts && facts.floorMaterial,
      uf: facts && (facts.uf || facts.state || facts.cityUf),
      padrao: facts && facts.projectStandard,
      fundacao: facts && facts.foundationType,
      comprimentoM: facts && (facts.wallLengthM || facts.comprimentoM),
      alturaM: facts && (facts.wallHeightM || facts.alturaM),
      larguraM: facts && (facts.widthM || facts.larguraM),
      profundidadeM: facts && (facts.depthM || facts.profundidadeM)
    });
  }

  function nextQuestion(budget) {
    const facts = budget.projectFacts || {};
    if (!facts.wallMaterial) return "Qual será o sistema principal de parede? Ex: bloco cerâmico baiano, bloco de concreto, drywall.";
    if (!facts.roofMaterial) return "Qual será o tipo de cobertura/telha?";
    if (!facts.floorMaterial) return "Qual será o tipo e a área de piso/revestimento?";
    if (!number(facts.wallAreaM2) && !(number(facts.wallPerimeterM) && number(facts.wallHeightM))) return "Informe perímetro, área de alvenaria ou dimensões dos ambientes para calcular paredes com precisão.";
    return "Informe fundação, estrutura, instalações e esquadrias para evoluir o orçamento.";
  }

  function buildPreliminaryBudget(projectFacts, technicalContext) {
    const facts = collectFacts(projectFacts || {}, technicalContext || {});
    const workPackageEngine = root.EloWorkPackageEngine;
    const quantityEngine = root.EloQuantityEngine;
    const consumptionEngine = root.EloConsumptionEngine;
    const tableEngine = root.EloBudgetTableEngine;
    const workPackages = workPackageEngine.buildWorkPackages(facts, technicalContext || {});
    facts.projectType = workPackages.typology;
    const quantityResult = quantityEngine.estimateQuantities(facts, workPackages);
    const compositionMatches = resolveCompositionMatches(workPackages, quantityResult.quantities, facts);
    const consumptionResult = consumptionEngine.calculateConsumptionFromCompositions(quantityResult.quantities, compositionMatches);
    const budgetTable = tableEngine.buildBudgetTable({ workPackages: workPackages, quantities: quantityResult.quantities, compositionMatches: compositionMatches, consumptions: consumptionResult.consumptions, audits: null });
    const projectRecordEngine = root.EloProjectRecordEngine || null;
    const executiveEngine = root.EloExecutiveBudgetEngine || null;
    const uiDataEngine = root.EloUiDataEngine || null;
    const graphEngine = root.EloTechnicalKnowledgeGraph || null;
    const projectStore = root.EloProjectStore || null;
    const selectionEngine = root.EloCompositionSelectionEngine || null;
    const exportEngine = root.EloExportEngine || null;
    const baseStatusEngine = root.EloBaseStatusEngine || null;
    const traceabilityEngine = root.EloTraceabilityEngine || null;
    const priceEngine = root.EloPriceEngine || null;
    const dashboardView = root.EloDashboardView || null;
    const packageMissing = [];
    (workPackages.packages || []).forEach(function (pack) {
      (pack.missing || []).forEach(function (item) { packageMissing.push({ id: pack.id + ":" + item, message: pack.name + ": faltam dados - " + item + "." }); });
    });
    const missing = quantityResult.missing.concat(packageMissing);
    const confidence = Math.max(0.25, Math.min(0.9, 0.35 + (facts.builtAreaM2 ? 0.12 : 0) + (facts.wallMaterial ? 0.08 : 0) + (facts.roofMaterial ? 0.08 : 0) + (facts.floorMaterial ? 0.08 : 0) + (budgetTable.summary.readyRows * 0.03) - Math.min(0.25, missing.length * 0.01)));
    const constructionReadiness = buildConstructionReadiness(facts, technicalContext || {});
    const budgetEap = buildBudgetEap(facts, technicalContext || {});
    const baseBudget = {
      mode: "preliminary_budget",
      confidence: Number(confidence.toFixed(2)),
      projectFacts: facts,
      constructionReadiness: constructionReadiness,
      budgetEap: budgetEap,
      workPackages: workPackages,
      quantities: quantityResult.quantities,
      compositionMatches: compositionMatches,
      consumptions: consumptionResult.consumptions,
      consumptionBlocked: consumptionResult.blocked,
      budgetTable: budgetTable,
      missing: missing,
      risks: buildRisks(facts, missing),
      summary: "Orçamento preliminar estruturado com pacotes, quantitativos, composições candidatas, consumo calculável e pendências.",
      scope: (workPackages.packages || []).map(function (pack) { return { id: pack.id, service: pack.name, status: pack.status, unit: pack.services[0] && pack.services[0].unit || "", searchTerms: (pack.searchTerms || []).join(" ") }; }),
      compositions: compositionMatches.map(function (match) { return { scopeId: match.packageId, serviceId: match.serviceId, service: match.service, query: match.query, found: match.found, candidates: match.candidates }; })
    };
    const baseStatus = baseStatusEngine ? baseStatusEngine.getTechnicalBaseStatus() : null;
    baseBudget.baseStatus = baseStatus;
    const projectRecord = projectRecordEngine ? projectRecordEngine.buildOrUpdateProjectRecord(technicalContext && technicalContext.projectRecord || null, { budget: baseBudget, projectFacts: facts, origin: "orçamento", summary: baseBudget.summary }) : null;
    const savedRecord = projectStore && projectRecord ? projectStore.createProjectRecordFromBudget(Object.assign({}, baseBudget, { projectRecord: projectRecord })) : projectRecord;
    const executiveReadiness = executiveEngine ? executiveEngine.evaluateExecutiveReadiness(savedRecord, baseBudget) : null;
    const closingChecklist = executiveEngine && executiveEngine.buildExecutiveClosingChecklist ? executiveEngine.buildExecutiveClosingChecklist(savedRecord, baseBudget) : null;
    const dashboardData = uiDataEngine ? uiDataEngine.buildEloDashboardData({ projectRecord: savedRecord, budget: baseBudget, executiveReadiness: executiveReadiness }) : null;
    const knowledgeGraphHints = graphEngine ? graphEngine.expandSearchTermsFromGraph([facts.roofMaterial, facts.wallMaterial, facts.floorMaterial, facts.projectType].filter(Boolean).join(" ")).slice(0, 20) : [];
    const selectableCompositions = selectionEngine ? selectionEngine.listSelectableCompositions(baseBudget) : [];
    const traceability = traceabilityEngine ? traceabilityEngine.buildTraceabilityEntries({ quantities: baseBudget.quantities, consumptions: baseBudget.consumptions, compositions: baseBudget.compositionMatches, blocked: baseBudget.consumptionBlocked }) : [];
    const priceStatus = priceEngine ? priceEngine.attachPricesToBudgetRows(baseBudget.budgetTable && baseBudget.budgetTable.rows || [], technicalContext && technicalContext.priceSource || {}) : { pricedRows: [], missingPrices: [], canTotal: false, totals: null };
    baseBudget.priceStatus = priceStatus;
    const executiveClosing = executiveEngine && executiveEngine.prepareExecutiveClosing ? executiveEngine.prepareExecutiveClosing(savedRecord, baseBudget, { requireBdi: true }) : closingChecklist;
    const executivePreview = executiveReadiness && executiveReadiness.executivePreview || null;
    const exportData = exportEngine ? { budgetCsv: exportEngine.exportBudgetToCsv(baseBudget.budgetTable), projectJson: exportEngine.exportProjectRecordToJson(savedRecord), executivePreviewCsv: exportEngine.exportExecutivePreviewToCsv(executivePreview) } : null;
    baseBudget.projectRecord = savedRecord;
    baseBudget.projectRecordSaved = !!(projectStore && savedRecord);
    baseBudget.projectRecordId = savedRecord && savedRecord.id || "";
    baseBudget.backendSaveStatus = projectStore && projectStore.getLastBackendStatus ? projectStore.getLastBackendStatus() : { source: savedRecord && savedRecord.persistenceSource || "local", ok: true };
    baseBudget.executiveReadiness = executiveReadiness;
    baseBudget.closingChecklist = closingChecklist;
    baseBudget.executiveClosing = executiveClosing;
    baseBudget.dashboardData = dashboardData;
    baseBudget.knowledgeGraphHints = knowledgeGraphHints;
    baseBudget.selectableCompositions = selectableCompositions;
    baseBudget.traceability = traceability;
    baseBudget.exportData = exportData;
    baseBudget.dashboardActionsAvailable = true;
    if (dashboardData) {
      dashboardData.projectRecordId = baseBudget.projectRecordId;
      dashboardData.baseStatus = baseBudget.baseStatus;
      dashboardData.executiveClosing = executiveClosing;
      dashboardData.closingChecklist = closingChecklist;
      dashboardData.selectableCompositions = selectableCompositions;
      dashboardData.missing = baseBudget.missing;
      dashboardData.audits = savedRecord && savedRecord.audits || [];
    }
    baseBudget.operationalDashboardHtml = dashboardView && dashboardData ? dashboardView.buildDashboardHtml(dashboardData) : "";
    if (dashboardView && dashboardView.setLastBudget) dashboardView.setLastBudget(baseBudget);
    return baseBudget;
  }

  function formatQuantity(item) {
    return "- " + item.description + ": " + Number(item.quantity || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 }) + " " + item.unit + " (" + item.source + ") - " + item.formula + (item.warnings && item.warnings.length ? " | aviso: " + item.warnings.join("; ") : "");
  }

  function buildBudgetReportText(budget) {
    const b = budget || buildPreliminaryBudget({}, {});
    const facts = b.projectFacts || {};
    const lines = ["ORÇAMENTO PRELIMINAR ESTRUTURADO", ""];
    lines.push("1. Dados identificados");
    lines.push("- Tipo: " + (facts.projectType || "nao definido").replace(/_/g, " "));
    if (facts.builtAreaM2) lines.push("- Área construída: " + Number(facts.builtAreaM2).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m²");
    if (facts.programSummary) lines.push("- Programa: " + facts.programSummary);
    if (facts.projectStandard) lines.push("- Padr\u00e3o: " + facts.projectStandard);
    if (facts.wallHeightM) lines.push("- Altura de paredes: " + Number(facts.wallHeightM).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " m");
    if (facts.wallMaterial) lines.push("- Sistema de parede: " + facts.wallMaterial);
    if (facts.roofMaterial) lines.push("- Cobertura: " + facts.roofMaterial);
    if (facts.floorMaterial) lines.push("- Piso: " + facts.floorMaterial + (facts.floorAreaM2 ? " em " + facts.floorAreaM2 + " m²" : ""));
    lines.push("", "2. Pacotes de serviço");
    lines.push("- Montei " + ((b.workPackages && b.workPackages.packages || []).length) + " pacotes de serviço.");
    (b.workPackages && b.workPackages.packages || []).slice(0, 13).forEach(function (pack) { lines.push("- " + pack.name + ": " + pack.status); });
    lines.push("", "3. Quantitativos seguros");
    if (b.quantities.length) b.quantities.forEach(function (item) { lines.push(formatQuantity(item)); }); else lines.push("- Nenhum quantitativo seguro calculado ainda.");
    lines.push("", "4. Composições candidatas");
    const matches = (b.compositionMatches || []).filter(function (item) { return item.candidates && item.candidates.length; });
    if (matches.length) matches.slice(0, 8).forEach(function (item) { lines.push("- " + item.service + ": " + item.candidates.map(function (c) { return c.code + " (" + c.unit + ", score " + c.score + ")"; }).join("; ")); }); else lines.push("- Ainda não há composição oficial candidata suficiente para cálculo.");
    lines.push("", "5. Consumos calculáveis");
    if (b.consumptions.length) b.consumptions.slice(0, 6).forEach(function (consumption) { lines.push("- " + consumption.compositionCode + ": " + consumption.inputs.length + " insumo(s), memória: " + consumption.memory.join("; ")); }); else lines.push("- Nenhum consumo calculado ainda; faltam composição compatível e quantitativo seguro.");
    lines.push("", "Tabela preliminar:");
    lines.push("- Linhas: " + b.budgetTable.summary.totalRows + " | prontas: " + b.budgetTable.summary.readyRows + " | pendentes: " + b.budgetTable.summary.pendingRows + " | bloqueadas: " + b.budgetTable.summary.blockedRows);
    if (b.projectRecord) {
      const recordSummary = root.EloProjectRecordEngine && root.EloProjectRecordEngine.summarizeProjectRecord ? root.EloProjectRecordEngine.summarizeProjectRecord(b.projectRecord) : {};
      lines.push("", "PRONTUÁRIO DA OBRA");
      lines.push("- Obra: " + (b.projectRecord.project && b.projectRecord.project.name || "não informada"));
      lines.push("- Tipo: " + (b.projectRecord.project && b.projectRecord.project.type || facts.projectType || "não definido"));
      lines.push("- Área: " + (b.projectRecord.project && b.projectRecord.project.builtAreaM2 ? b.projectRecord.project.builtAreaM2 + " m²" : "não informada"));
      lines.push("- Revisão: R" + (recordSummary.revision || 0));
      lines.push("- Status: " + (b.projectRecord.status || "preliminary"));
    }
    if (b.executiveReadiness) {
      lines.push("", "PRONTIDÃO PARA EXECUTIVO");
      lines.push("- Score: " + Math.round((b.executiveReadiness.score || 0) * 100) + "%");
      const blockers = (b.executiveReadiness.blockers || []).slice(0, 5);
      if (blockers.length) blockers.forEach(function (item) { lines.push("- Bloqueio: " + item.message); }); else lines.push("- Sem bloqueios principais registrados.");
    }
    if (b.dashboardData) {
      const cardValue = function (id) { const card = (b.dashboardData.cards || []).find(function (item) { return item.id === id; }); return card ? card.value : 0; };
      lines.push("", "PAINEL");
      lines.push("- Pacotes: " + cardValue("packages"));
      lines.push("- Pendências: " + cardValue("pending"));
      lines.push("- Composições localizadas: " + cardValue("compositions"));
      lines.push("- Consumos calculados: " + cardValue("consumptions"));
      lines.push("- Auditorias críticas: " + cardValue("critical-audits"));
    }
    if (b.constructionReadiness) {
      lines.push("", "MOTOR DE OBRA");
      lines.push("- Etapa atual: " + (b.constructionReadiness.etapaAtual && b.constructionReadiness.etapaAtual.nome || "nao definida"));
      lines.push("- Status: " + (b.constructionReadiness.status || "partial"));
      lines.push("- Pode fechar orçamento completo: " + (b.constructionReadiness.podeFecharOrcamentoCompleto ? "sim" : "nao"));
      if (b.constructionReadiness.bloqueadores && b.constructionReadiness.bloqueadores.length) lines.push("- Bloqueadores: " + b.constructionReadiness.bloqueadores.slice(0, 8).join(", "));
      if (b.constructionReadiness.assumidos && b.constructionReadiness.assumidos.length) lines.push("- Premissas assumidas: " + b.constructionReadiness.assumidos.slice(0, 6).join(", "));
      if (b.constructionReadiness.proximaPergunta) lines.push("- Proxima pergunta: " + b.constructionReadiness.proximaPergunta);
    }
    if (b.budgetEap) {
      lines.push("", "EAP AUTOMATICA");
      lines.push("- Tipo: " + (b.budgetEap.tipo || "nao definido"));
      lines.push("- Etapas: " + ((b.budgetEap.etapas || []).length));
      lines.push("- Itens: " + ((b.budgetEap.itens || []).length));
      lines.push("- Pendencias: " + ((b.budgetEap.pendencias || []).length));
      lines.push("- Bloqueadores: " + ((b.budgetEap.bloqueadores || []).length));
      lines.push("- Pode fechar orçamento completo: " + (b.budgetEap.podeFecharOrcamentoCompleto ? "sim" : "nao"));
    }
    lines.push("", "SITUAÇÃO DO PRODUTO");
    lines.push("- Prontuário: " + (b.projectRecordSaved ? "salvo localmente" : "não salvo"));
    if (b.baseStatus) lines.push("- Base técnica: " + (b.baseStatus.loaded ? ((b.baseStatus.source || "SINAPI") + " " + (b.baseStatus.state || "") + " " + (b.baseStatus.referenceMonth || "") + ", " + b.baseStatus.totalCompositions + " composições") : "não carregada"));
    if (b.executiveReadiness) lines.push("- Prontidão executivo: " + Math.round((b.executiveReadiness.score || 0) * 100) + "%");
    if (b.closingChecklist && b.closingChecklist.blockers && b.closingChecklist.blockers.length) lines.push("- Bloqueios principais: " + b.closingChecklist.blockers.slice(0, 3).map(function (item) { return item.message; }).join(" | "));
    lines.push("", "6. Pendências");
    if (b.missing.length) b.missing.slice(0, 12).forEach(function (item) { lines.push("- " + item.message); }); else lines.push("- Nenhuma pendência crítica registrada nesta etapa preliminar.");
    lines.push("", "7. Próxima pergunta", nextQuestion(b));
    lines.push("", "8. Aviso", "- Preliminar, não executivo. Não fechei valor em R$ porque ainda faltam premissas e composição final validada.");
    return lines.join("\n");
  }

  root.EloBudgetEngine = { version: VERSION, buildPreliminaryBudget: buildPreliminaryBudget, buildBudgetReportText: buildBudgetReportText };
})(typeof window !== "undefined" ? window : globalThis);
