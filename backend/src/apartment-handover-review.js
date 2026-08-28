const LEVELS = {
  BLOCKER: "BLOCKER",
  WARNING: "WARNING",
  NOTICE: "NOTICE"
};

const SEVERITIES = new Set(["baixa", "media", "alta", "critica"]);

const SYSTEM_TERMS = {
  paredes: ["parede", "paredes", "alvenaria", "revestimento", "pintura"],
  forro: ["forro", "teto", "sanca", "gesso"],
  portas: ["porta", "portas", "dobradica", "dobradicas", "folha", "batente", "fechadura"],
  esquadrias: ["esquadria", "esquadrias", "janela", "janelas", "porta", "portas", "folha", "batente", "dobradica", "dobradicas", "vidro"],
  janelas: ["janela", "janelas", "esquadria", "vidro", "vedacao"],
  impermeabilizacao: ["umidade", "infiltracao", "impermeabilizacao", "vedacao", "estanqueidade"],
  vedacao: ["vedacao", "umidade", "infiltracao", "janela", "interface"],
  pisos: ["piso", "pisos", "rodape", "revestimento"],
  eletricas: ["eletrica", "tomada", "interruptor", "quadro", "disjuntor", "luminaria"],
  hidraulicas: ["hidraulica", "registro", "torneira", "ralo", "vazamento", "tubulacao"]
};

function clean(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function normalizeText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeStatus(value) {
  const raw = normalizeText(value).toUpperCase();
  if (["CONFORME", "OK", "APROVADO"].includes(raw)) return "C";
  if (["NAO CONFORME", "INCONFORME"].includes(raw)) return "NC";
  if (["NAO APLICAVEL", "N/A"].includes(raw)) return "NA";
  if (["NAO VERIFICADO"].includes(raw)) return "NV";
  if (["NAO INSPECIONADO"].includes(raw)) return "NI";
  return ["C", "NC", "NA", "NV", "NI"].includes(raw) ? raw : "NI";
}

function normalizeInstrument(instrument = {}) {
  return {
    type: clean(instrument.type || instrument.tipo || instrument.nome || instrument.instrumento || instrument.name),
    brand: clean(instrument.brand || instrument.marca),
    model: clean(instrument.model || instrument.modelo),
    identification: clean(instrument.identification || instrument.identificacao || instrument.id || instrument.numeroSerie),
    serialNumber: clean(instrument.serialNumber || instrument.numeroSerie || instrument.serie),
    calibrationStatus: clean(instrument.calibrationStatus || instrument.statusCalibracao),
    calibrationDate: clean(instrument.calibrationDate || instrument.dataCalibracao),
    calibrationDueDate: clean(instrument.calibrationDueDate || instrument.validadeCalibracao || instrument.validade || instrument.calibracao),
    verificationDate: clean(instrument.verificationDate || instrument.dataVerificacao),
    notes: clean(instrument.notes || instrument.observacoes)
  };
}

function getReport(payload) {
  return payload && payload.report ? payload.report : payload || {};
}

function getInspection(payload) {
  return getReport(payload).inspection || {};
}

function getItems(payload) {
  const report = getReport(payload);
  const inspection = getInspection(payload);
  return (inspection.items || report.items || []).map((item, index) => ({
    source: item,
    number: Number(item.numero || item.number || index + 1),
    ambiente: clean(item.ambiente),
    sistema: clean(item.sistema),
    item: clean(item.item || item.descricao),
    criterio: clean(item.criterioAceitacao || item.criterio),
    status: normalizeStatus(item.status),
    severidade: clean(item.severidade || item.grauRisco),
    descricaoTecnica: clean(item.descricaoTecnica || item.descricao),
    recomendacaoAcao: clean(item.recomendacaoAcao || item.solucaoRecomendada),
    completionCriticality: normalizeText(item.completionCriticality || item.criticality || "normal"),
    photoRequired: item.photoRequired === true,
    fotos: Array.isArray(item.fotos) ? item.fotos : item.foto ? [{ foto: item.foto }] : [],
    medicoes: Array.isArray(item.medicoes) ? item.medicoes : []
  }));
}

function issue(level, code, title, message, item, extra = {}) {
  return {
    code,
    level,
    title,
    message,
    itemId: item ? item.number : undefined,
    ncId: item && item.status === "NC" ? `NC-${String(extra.ncIndex || item.number).padStart(3, "0")}` : undefined,
    environmentId: item ? item.ambiente || undefined : undefined,
    systemId: item ? item.sistema || undefined : undefined,
    field: extra.field,
    metadata: extra.metadata || {}
  };
}

function hasExplicitOtherEnvironment(item, knownEnvironments) {
  const own = normalizeText(item.ambiente);
  const text = normalizeText([item.item, item.criterio, item.descricaoTecnica, item.recomendacaoAcao].join(" "));
  return knownEnvironments.find((environment) => {
    const normalized = normalizeText(environment);
    return normalized && normalized !== own && text.includes(normalized);
  });
}

function systemMismatch(item) {
  const selected = normalizeText(item.sistema);
  const text = normalizeText([item.item, item.criterio, item.descricaoTecnica, item.recomendacaoAcao].join(" "));
  const selectedTerms = Object.entries(SYSTEM_TERMS).find(([key]) => selected.includes(key));
  if (!selectedTerms) return false;
  const ownHits = selectedTerms[1].filter((term) => text.includes(term)).length;
  const other = Object.entries(SYSTEM_TERMS)
    .filter(([key]) => key !== selectedTerms[0])
    .map(([key, terms]) => ({ key, hits: terms.filter((term) => text.includes(term)).length }))
    .sort((a, b) => b.hits - a.hits)[0];
  return other && other.hits >= 2 && ownHits === 0;
}

function possibleClassificationMismatch(item) {
  const text = normalizeText([item.descricaoTecnica, item.recomendacaoAcao].join(" "));
  const ambiente = normalizeText(item.ambiente);
  const sistema = normalizeText(item.sistema);
  if (!text || (!ambiente && !sistema)) return false;
  const hasAmbiente = ambiente && text.includes(ambiente);
  const selected = Object.entries(SYSTEM_TERMS).find(([key]) => sistema.includes(key));
  const hasSystem = selected && selected[1].some((term) => text.includes(term));
  const explicitDifferentSystem = systemMismatch(item);
  return explicitDifferentSystem || (!hasAmbiente && selected && !hasSystem && text.length > 80);
}

function instrumentByName(instruments) {
  const map = new Map();
  for (const instrument of instruments) {
    for (const key of [instrument.type, instrument.identification, instrument.serialNumber]) {
      const normalized = normalizeText(key);
      if (normalized) map.set(normalized, instrument);
    }
  }
  return map;
}

function findInstrumentForMeasurement(measurement, instruments, index) {
  const ref = normalizeText(measurement.instrumento || measurement.instrument || measurement.instrumentId);
  if (!ref) return instruments[index] || null;
  const map = instrumentByName(instruments);
  for (const [key, instrument] of map) {
    if (ref.includes(key) || key.includes(ref)) return instrument;
  }
  return instruments.find((instrument) => ref.includes(normalizeText(instrument.type))) || null;
}

function meaningfulTraceValue(value) {
  const normalized = normalizeText(value);
  return Boolean(normalized && normalized !== "nao informado" && normalized !== "nao se aplica");
}

function isTraceabilityIncomplete(instrument) {
  if (!instrument) return true;
  const hasBasicTrace = meaningfulTraceValue(instrument.type) && meaningfulTraceValue(instrument.identification);
  const hasPhysicalTrace = [instrument.brand, instrument.model, instrument.serialNumber].some(meaningfulTraceValue);
  const hasCalibrationOrVerification = [
    instrument.calibrationStatus,
    instrument.calibrationDate,
    instrument.calibrationDueDate,
    instrument.verificationDate
  ].some(meaningfulTraceValue);
  return !hasBasicTrace || !hasPhysicalTrace || !hasCalibrationOrVerification;
}

export function buildApartmentHandoverPreflightSummary(review) {
  const summary = review && review.summary ? review.summary : { blockers: 0, warnings: 0, notices: 0 };
  const parts = [];
  parts.push(`${summary.warnings} alertas precisam de revisao`);
  parts.push(`${summary.notices} pendencias informativas`);
  parts.push(`${summary.blockers} bloqueios`);
  return parts.join(", ");
}

export function reviewApartmentHandoverInspection(payload, options = {}) {
  const report = getReport(payload);
  const inspection = getInspection(payload);
  const items = getItems(payload);
  const blockers = [];
  const warnings = [];
  const notices = [];
  const add = (target) => {
    if (target.level === LEVELS.BLOCKER) blockers.push(target);
    else if (target.level === LEVELS.WARNING) warnings.push(target);
    else notices.push(target);
  };
  const knownEnvironments = [...new Set(items.map((item) => item.ambiente).filter(Boolean))];
  const ncItems = items.filter((item) => item.status === "NC");
  const nvItems = items.filter((item) => item.status === "NV");
  const niItems = items.filter((item) => item.status === "NI");

  if (nvItems.length) {
    add(issue(LEVELS.WARNING, "UNVERIFIED_ITEMS_PRESENT", "Itens nao verificados presentes", `${nvItems.length} itens foram marcados como Nao Verificados. Revise antes da emissao final.`, null, { metadata: { count: nvItems.length } }));
  }
  if (niItems.length) {
    add(issue(LEVELS.WARNING, "UNINSPECTED_ITEMS_PRESENT", "Itens nao inspecionados presentes", `${niItems.length} itens foram marcados como Nao Inspecionados. Revise antes da emissao final.`, null, { metadata: { count: niItems.length } }));
  }

  if (!clean(report.artRrt) || normalizeText(report.artRrt) === "nao informado") {
    const level = options.requiresTechnicalResponsibilityRecord === true || report.requiresTechnicalResponsibilityRecord === true ? LEVELS.BLOCKER : LEVELS.WARNING;
    add(issue(level, "TECHNICAL_RESPONSIBILITY_NOT_INFORMED", "ART/RRT nao informada", "ART/RRT nao informada. Verifique se o servico/documento exige registro de responsabilidade tecnica antes da emissao definitiva.", null, { field: "artRrt" }));
  }

  const isFinal = inspection.finalizada !== false && normalizeText(inspection.status) !== "draft";
  if (isFinal && (!clean(report.responsavelTecnico) || normalizeText(report.responsavelTecnico) === "nao informado")) {
    add(issue(LEVELS.BLOCKER, "TECHNICAL_RESPONSIBLE_MISSING", "Responsavel tecnico ausente", "Informe o responsavel tecnico antes da emissao final do laudo.", null, { field: "responsavelTecnico" }));
  }
  if (isFinal && (!clean(report.creaCau || report.registroProfissional) || normalizeText(report.creaCau || report.registroProfissional) === "nao informado")) {
    add(issue(LEVELS.BLOCKER, "PROFESSIONAL_REGISTRATION_MISSING", "Registro profissional ausente", "Informe o registro profissional antes da emissao final do laudo.", null, { field: "creaCau" }));
  }

  ncItems.forEach((item, index) => {
    if (!item.descricaoTecnica || item.descricaoTecnica === "-") {
      add(issue(LEVELS.BLOCKER, "NC_DESCRIPTION_MISSING", "Descricao tecnica ausente", "Nao conformidade sem descricao tecnica. Preencha antes da emissao final.", item, { field: "descricaoTecnica", ncIndex: index + 1 }));
    }
    if (!item.recomendacaoAcao || item.recomendacaoAcao === "-") {
      add(issue(LEVELS.WARNING, "NC_RECOMMENDATION_MISSING", "Recomendacao ausente", "Nao conformidade sem recomendacao de acao. Revise antes da emissao final.", item, { field: "recomendacaoAcao", ncIndex: index + 1 }));
    }
    if (!item.fotos.length) {
      const level = item.photoRequired ? LEVELS.BLOCKER : LEVELS.WARNING;
      add(issue(level, "NC_WITHOUT_PHOTO", "Nao conformidade sem foto", "Nao conformidade sem foto vinculada. Revise a evidencia antes da emissao final.", item, { field: "fotos", ncIndex: index + 1 }));
    }
    if (!SEVERITIES.has(normalizeText(item.severidade))) {
      add(issue(LEVELS.WARNING, "INVALID_OR_MISSING_SEVERITY", "Severidade ausente ou invalida", "Nao conformidade sem severidade valida. Use baixa, media, alta ou critica.", item, { field: "severidade", ncIndex: index + 1 }));
    }
    const otherEnvironment = hasExplicitOtherEnvironment(item, knownEnvironments);
    if (otherEnvironment) {
      add(issue(LEVELS.WARNING, "ENVIRONMENT_REFERENCE_MISMATCH", "Possivel divergencia de ambiente", "A descricao/recomendacao menciona outro ambiente conhecido. Revise a classificacao antes da emissao final.", item, { ncIndex: index + 1, metadata: { mentionedEnvironment: otherEnvironment } }));
    }
    if (systemMismatch(item)) {
      add(issue(LEVELS.WARNING, "SYSTEM_REFERENCE_MISMATCH", "Possivel divergencia de sistema", "A descricao/recomendacao desta nao conformidade pode nao ser compativel com o sistema selecionado. Revise a classificacao antes da emissao final.", item, { ncIndex: index + 1 }));
    }
    if (possibleClassificationMismatch(item)) {
      add(issue(LEVELS.WARNING, "POSSIBLE_CLASSIFICATION_MISMATCH", "Possivel inconsistencia de classificacao", "A descricao/recomendacao desta nao conformidade pode nao ser compativel com o ambiente, sistema ou item selecionado. Revise a classificacao antes da emissao final.", item, { ncIndex: index + 1 }));
    }
  });

  for (const item of items.filter((entry) => entry.status === "NV" || entry.status === "NI")) {
    if (item.completionCriticality === "critical") {
      add(issue(LEVELS.BLOCKER, "CRITICAL_ITEM_PENDING", "Item critico pendente", "Item critico marcado como Nao Verificado ou Nao Inspecionado. Revise antes da emissao final.", item, { field: "completionCriticality" }));
    } else if (item.completionCriticality === "important") {
      add(issue(LEVELS.WARNING, "IMPORTANT_ITEM_PENDING", "Item importante pendente", "Item importante marcado como Nao Verificado ou Nao Inspecionado. Revise antes da emissao final.", item, { field: "completionCriticality" }));
    }
  }

  const instruments = (Array.isArray(inspection.instrumentos) ? inspection.instrumentos : []).map(normalizeInstrument);
  items.forEach((item) => {
    item.medicoes.forEach((measurement, index) => {
      const instrument = findInstrumentForMeasurement(measurement, instruments, index);
      if (isTraceabilityIncomplete(instrument)) {
        const level = measurement.acceptanceDecisionBasis === true ? LEVELS.WARNING : LEVELS.NOTICE;
        add(issue(level, "INSTRUMENT_TRACEABILITY_INCOMPLETE", "Rastreabilidade de instrumento incompleta", "Instrumento usado em medicao possui rastreabilidade incompleta. Revise dados como marca, modelo, serie, verificacao ou calibracao quando aplicavel.", item, { field: "instrumentos", metadata: { measurement: measurement.grandeza || measurement.tipo || measurement.nome } }));
      }
    });
  });

  const summary = { blockers: blockers.length, warnings: warnings.length, notices: notices.length };
  return {
    ok: blockers.length === 0,
    canGenerateFinal: blockers.length === 0,
    blockers,
    warnings,
    notices,
    summary,
    text: buildApartmentHandoverPreflightSummary({ summary })
  };
}
