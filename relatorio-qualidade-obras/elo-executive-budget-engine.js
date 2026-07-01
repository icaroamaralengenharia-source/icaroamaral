(function (root) {
  "use strict";

  const VERSION = "20260701-elo-executive-budget-v3-5-typology-routing";
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function add(list, id, message) { if (!list.some(function (x) { return x.id === id; })) list.push({ id, message }); }
  function toNumber(value) {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(/[^0-9,.-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function normalizeKey(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  }

  const REQUIRED_PREMISES = [
    { id: "city", label: "cidade" },
    { id: "state", label: "estado" },
    { id: "builtAreaM2", label: "area construida" },
    { id: "floors", label: "quantidade de pavimentos" },
    { id: "standard", label: "padrao construtivo" },
    { id: "ceilingHeightM", label: "pe-direito" },
    { id: "structuralType", label: "tipo estrutural" },
    { id: "roofType", label: "tipo de cobertura" },
    { id: "foundationType", label: "tipo de fundacao" }
  ];

  const DISCIPLINES = [
    { id: "fundacao", label: "Fundacao", dependsOn: [], services: ["locacao", "escavacao", "concreto", "armacao", "forma"], required: ["foundationType", "builtAreaM2"] },
    { id: "estrutura", label: "Estrutura", dependsOn: ["fundacao"], services: ["pilares", "vigas", "lajes", "escadas"], required: ["structuralType", "floors", "ceilingHeightM"] },
    { id: "alvenaria", label: "Alvenaria", dependsOn: ["estrutura"], services: ["paredes", "vergas", "contravergas", "encunhamento"], required: ["builtAreaM2", "ceilingHeightM"] },
    { id: "cobertura", label: "Cobertura", dependsOn: ["alvenaria"], services: ["estrutura de cobertura", "telhamento", "rufos", "calhas"], required: ["roofType", "builtAreaM2"] },
    { id: "instalacoes_hidraulicas", label: "Instalacoes hidraulicas", dependsOn: ["alvenaria"], services: ["agua fria", "esgoto", "aguas pluviais", "reservatorio"], required: ["builtAreaM2", "standard"] },
    { id: "instalacoes_eletricas", label: "Instalacoes eletricas", dependsOn: ["alvenaria"], services: ["eletrodutos", "fios", "quadros", "pontos eletricos"], required: ["builtAreaM2", "standard"] },
    { id: "revestimentos", label: "Revestimentos", dependsOn: ["instalacoes_hidraulicas", "instalacoes_eletricas"], services: ["chapisco", "emboco", "reboco", "pisos", "revestimentos ceramicos"], required: ["builtAreaM2", "standard"] },
    { id: "pintura", label: "Pintura", dependsOn: ["revestimentos"], services: ["selador", "massa", "tinta interna", "tinta externa"], required: ["builtAreaM2", "standard"] },
    { id: "esquadrias", label: "Esquadrias", dependsOn: ["alvenaria"], services: ["portas", "janelas", "ferragens"], required: ["standard"] },
    { id: "loucas", label: "Loucas", dependsOn: ["revestimentos"], services: ["vasos", "cubas", "tanques"], required: ["standard"] },
    { id: "metais", label: "Metais", dependsOn: ["loucas"], services: ["torneiras", "registros", "acessorios"], required: ["standard"] },
    { id: "urbanizacao", label: "Urbanizacao", dependsOn: ["cobertura", "revestimentos"], services: ["calcadas", "drenagem", "limpeza externa"], required: ["builtAreaM2"] },
    { id: "administracao", label: "Administracao", dependsOn: [], services: ["engenharia", "encargos", "mobilizacao", "canteiro"], required: ["builtAreaM2", "city", "state"] }
  ];

  const RESIDENTIAL_DISCIPLINES = ["fundacao", "estrutura", "alvenaria", "cobertura", "instalacoes_hidraulicas", "instalacoes_eletricas", "revestimentos", "pintura", "esquadrias", "loucas", "metais", "urbanizacao", "administracao"];

  const TYPOLOGY_PROFILES = {
    residencia_nova: { id: "residencia_nova", label: "Residencia nova", completeEngine: true, disciplines: RESIDENTIAL_DISCIPLINES.slice(), pendencias: [] },
    sobrado: { id: "sobrado", label: "Sobrado", completeEngine: true, disciplines: RESIDENTIAL_DISCIPLINES.slice(), pendencias: ["Confirmar escada, laje e compatibilidade estrutural do sobrado."] },
    galpao_metalico: { id: "galpao_metalico", label: "Galpao metalico", completeEngine: false, disciplines: ["fundacao", "estrutura_metalica", "piso_industrial", "fechamento_metalico", "cobertura", "drenagem", "administracao"], pendencias: ["Motor de galpao metalico ainda nao possui quantitativos completos."] },
    muro_arrimo: { id: "muro_arrimo", label: "Muro de arrimo", completeEngine: false, disciplines: ["contencao", "fundacao", "drenagem", "impermeabilizacao", "reaterro", "administracao"], pendencias: ["Motor de contencao ainda nao possui dimensionamento geotecnico e estrutural completo."] },
    reforma_banheiro: { id: "reforma_banheiro", label: "Reforma de banheiro", completeEngine: false, disciplines: ["demolicao", "instalacoes_hidraulicas", "instalacoes_eletricas", "impermeabilizacao", "revestimentos", "loucas", "metais", "administracao"], pendencias: ["Motor de reforma de banheiro ainda precisa detalhar demolicao, pontos hidraulicos, loucas e metais."] },
    ampliacao_residencial: { id: "ampliacao_residencial", label: "Ampliacao residencial", completeEngine: false, disciplines: ["compatibilizacao_existente", "fundacao_complementar", "estrutura", "alvenaria", "cobertura", "revestimentos", "pintura", "administracao"], pendencias: ["Motor de ampliacao ainda precisa compatibilizar obra nova com estrutura existente."] },
    desconhecida: { id: "desconhecida", label: "Tipologia desconhecida", completeEngine: false, disciplines: [], pendencias: ["Classifique a tipologia da obra antes de gerar disciplinas executivas."] }
  };

  function classifyProjectTypology(input) {
    const source = input || {};
    const record = source.project || source;
    const text = normalizeKey([record.type, record.typology, record.tipoObra, record.description, record.descricao].join(" "));
    const floors = toNumber(record.floors || record.pavimentos || source.floors || source.pavimentos);
    if (/galpao|galpao_metalico|metalico|industrial/.test(text)) return "galpao_metalico";
    if (/muro.*arrimo|arrimo|contencao|conten[cç]ao/.test(text)) return "muro_arrimo";
    if (/reforma.*banheiro|banheiro/.test(text) && /reforma/.test(text)) return "reforma_banheiro";
    if (/ampliacao|amplia[cç]ao|acrescimo|anexo/.test(text)) return "ampliacao_residencial";
    if (/sobrado/.test(text) || floors > 1) return "sobrado";
    if (/casa|residencia|residencial|casa_terrea|terrea/.test(text)) return "residencia_nova";
    if (!text && toNumber(record.builtAreaM2 || record.areaConstruida || source.builtAreaM2) > 0 && (record.roofType || record.tipoCobertura || record.foundationType || record.tipoFundacao)) return "residencia_nova";
    return "desconhecida";
  }

  function getTypologyProfile(input) {
    const id = classifyProjectTypology(input);
    return TYPOLOGY_PROFILES[id] || TYPOLOGY_PROFILES.desconhecida;
  }

  function createDisciplineStage(id) {
    const discipline = DISCIPLINES.find(function (item) { return item.id === id; });
    if (discipline) return discipline;
    return { id: id, label: id.replace(/_/g, " ").replace(/\b\w/g, function (char) { return char.toUpperCase(); }), dependsOn: [], services: [], required: [] };
  }

  function buildTypologyRouting(input) {
    const profile = getTypologyProfile(input);
    const blocked = RESIDENTIAL_DISCIPLINES.filter(function (id) { return profile.disciplines.indexOf(id) < 0; });
    return {
      typology: profile.id,
      label: profile.label,
      completeEngine: profile.completeEngine,
      applicableDisciplines: profile.disciplines.slice(),
      blockedDisciplines: blocked,
      pendencias: profile.pendencias.map(function (message, index) { return { id: profile.id + "_pendency_" + index, message: message }; }),
      readyForCost: profile.completeEngine
    };
  }

  const TECHNICAL_NODES = {
    fundacao: ["limpeza", "locacao", "escavacao", "sapatas", "blocos", "baldrame", "impermeabilizacao"],
    estrutura: ["pilares", "vigas", "lajes"],
    alvenaria: ["blocos", "argamassa", "vergas", "contravergas", "reboco"],
    cobertura: ["estrutura", "telhas", "calhas", "rufos"],
    instalacoes_hidraulicas: ["agua fria", "esgoto", "aguas pluviais", "reservatorio"],
    instalacoes_eletricas: ["eletrodutos", "fios", "quadros", "pontos eletricos"],
    revestimentos: ["chapisco", "emboco", "reboco", "pisos", "revestimentos ceramicos"],
    pintura: ["selador", "massa", "tinta interna", "tinta externa"],
    esquadrias: ["portas", "janelas", "ferragens"],
    loucas: ["vasos", "cubas", "tanques"],
    metais: ["torneiras", "registros", "acessorios"],
    urbanizacao: ["calcadas", "drenagem", "limpeza externa"],
    administracao: ["engenharia", "encargos", "mobilizacao", "canteiro"]
  };

  const EXTENSION_POINTS = {
    sinapi: { ready: false, kind: "official_cost_base" },
    orse: { ready: false, kind: "official_cost_base" },
    propria: { ready: false, kind: "custom_composition_base" },
    cronograma: { ready: false, kind: "schedule_engine" },
    custos: { ready: false, kind: "cost_engine" }
  };

  const OFFICIAL_COMPOSITION_MAP = {
    fundacao: [
      { quantityId: "escavacao", serviceType: "escavacao", terms: ["escavacao", "vala"], unit: "m3" },
      { quantityId: "concreto", serviceType: "concreto_fundacao", terms: ["concreto", "fundacao", "sapata", "baldrame"], unit: "m3" },
      { quantityId: "formas", serviceType: "forma_fundacao", terms: ["forma", "fundacao", "baldrame"], unit: "m2" },
      { quantityId: "armacao", serviceType: "armacao_fundacao", terms: ["armacao", "aco", "fundacao"], unit: "kg" },
      { quantityId: "impermeabilizacao", serviceType: "impermeabilizacao", terms: ["impermeabilizacao", "baldrame"], unit: "m2" }
    ],
    estrutura: [
      { quantityId: "volume_concreto", serviceType: "concreto_estrutural", terms: ["concreto", "pilar", "viga", "laje"], unit: "m3", rejectPremise: { field: "structuralType", pattern: "metal" } },
      { quantityId: "aco", serviceType: "armacao_estrutural", terms: ["armacao", "aco", "estrutura"], unit: "kg" },
      { quantityId: "formas", serviceType: "forma_estrutura", terms: ["forma", "pilar", "viga", "laje"], unit: "m2" },
      { quantityId: "estrutura_metalica", serviceType: "estrutura_metalica", terms: ["estrutura", "metalica"], unit: "kg", requirePremise: { field: "structuralType", pattern: "metal" } }
    ],
    alvenaria: [
      { quantityId: "area_paredes", serviceType: "alvenaria", terms: ["alvenaria", "bloco"], unit: "m2" },
      { quantityId: "blocos", serviceType: "alvenaria", terms: ["alvenaria", "bloco"], unit: "m2" },
      { quantityId: "argamassa", serviceType: "argamassa_alvenaria", terms: ["argamassa", "assentamento"], unit: "m3" },
      { quantityId: "vergas", serviceType: "verga", terms: ["verga"], unit: "m" },
      { quantityId: "contravergas", serviceType: "contraverga", terms: ["contraverga"], unit: "m" }
    ],
    cobertura: [
      { quantityId: "area", serviceType: "cobertura", terms: ["cobertura", "telhamento", "telha"], unit: "m2" },
      { quantityId: "telhas", serviceType: "cobertura", terms: ["telha", "telhamento"], unit: "m2" },
      { quantityId: "madeira", serviceType: "estrutura_madeira", terms: ["madeira", "cobertura"], unit: "m2", requirePremise: { field: "roofType", pattern: "madeira|ceramica|telha" } },
      { quantityId: "estrutura_metalica", serviceType: "estrutura_metalica_cobertura", terms: ["estrutura", "metalica", "cobertura"], unit: "m2", requirePremise: { field: "roofType", pattern: "metal|metalica" } },
      { quantityId: "calhas", serviceType: "calha", terms: ["calha"], unit: "m" },
      { quantityId: "rufos", serviceType: "rufo", terms: ["rufo"], unit: "m" }
    ],
    revestimentos: [
      { quantityId: "chapisco", serviceType: "chapisco", terms: ["chapisco"], unit: "m2" },
      { quantityId: "emboco", serviceType: "emboco", terms: ["emboco", "massa unica", "reboco"], unit: "m2" },
      { quantityId: "reboco", serviceType: "reboco", terms: ["reboco", "massa unica", "emboco"], unit: "m2" },
      { quantityId: "contrapiso", serviceType: "contrapiso", terms: ["contrapiso", "regularizacao"], unit: "m2" },
      { quantityId: "ceramica", serviceType: "piso_ceramico", terms: ["ceramica", "piso", "revestimento"], unit: "m2" }
    ],
    pintura: [
      { quantityId: "massa", serviceType: "massa_pintura", terms: ["massa", "pintura"], unit: "m2" },
      { quantityId: "selador", serviceType: "selador", terms: ["selador"], unit: "m2" },
      { quantityId: "tinta", serviceType: "pintura", terms: ["pintura", "tinta"], unit: "m2" }
    ]
  };

  function normalizeOfficialRows(source) {
    const rows = source && (source.officialBaseRows || source.officialBase || source.officialCompositions || source.rows) || [];
    if (Array.isArray(rows)) return rows;
    if (Array.isArray(rows.rows)) return rows.rows;
    return [];
  }

  function rowText(row) {
    return normalizeKey([row.serviceType, row.compositionName, row.name, row.description, row.service, row.compositionCode, row.code].join(" "));
  }

  function rowSource(row) { return clean(row.source || row.origem || row.base || "").toUpperCase(); }
  function rowCode(row) { return clean(row.compositionCode || row.code || row.codigo); }
  function rowDescription(row) { return clean(row.compositionName || row.description || row.name || row.service); }
  function rowUnit(row) { return clean(row.compositionUnit || row.unit || row.unidade); }

  function premiseMatches(rule, project) {
    if (!rule) return true;
    const value = normalizeKey(project[rule.field]);
    return new RegExp(rule.pattern, "i").test(value);
  }

  function scoreOfficialRow(row, mapping, project) {
    const text = rowText(row);
    const unit = normalizeKey(rowUnit(row));
    const premiseText = normalizeKey([project.blockType, project.tipoBloco, project.masonryType, project.tipoAlvenaria, project.roofType, project.foundationType, project.structuralType].join(" "));
    if (mapping.requirePremise && !premiseMatches(mapping.requirePremise, project)) return -1;
    if (mapping.rejectPremise && premiseMatches(mapping.rejectPremise, project)) return -1;
    if (/metal/.test(normalizeKey(project.structuralType)) && normalizeKey(mapping.serviceType).indexOf("estrutura_metalica") < 0 && /concreto|pilar|viga|laje/.test(text)) return -1;
    let score = 0;
    if (normalizeKey(row.serviceType) === normalizeKey(mapping.serviceType)) score += 8;
    mapping.terms.forEach(function (term) { if (text.indexOf(normalizeKey(term)) >= 0) score += 2; });
    premiseText.split("_").filter(function (token) { return token.length > 3; }).forEach(function (token) { if (text.indexOf(token) >= 0) score += 5; });
    if (mapping.unit && unit === normalizeKey(mapping.unit)) score += 2;
    if (/sinapi|orse/.test(normalizeKey(rowSource(row)))) score += 1;
    if (/mock|teste|demonstrativo/.test(text)) score -= 20;
    return score;
  }

  function officialCompositionFromRow(row, mapping, quantityItem, reason) {
    const inputs = Array.isArray(row.inputs) ? row.inputs : Array.isArray(row.insumos) ? row.insumos : [];
    return {
      origem: rowSource(row),
      codigo: rowCode(row),
      descricao: rowDescription(row),
      serviceType: clean(row.serviceType || mapping.serviceType),
      quantityId: mapping.quantityId,
      quantidadeReferencia: quantityItem ? quantityItem.quantidade : null,
      unidade: rowUnit(row) || mapping.unit,
      coeficiente: row.coefficient !== undefined ? toNumber(row.coefficient) : null,
      motivoEscolha: reason,
      insumos: inputs.filter(function (item) { return !/mao|mão|pedreiro|servente|carpinteiro|pintor|armador/i.test(clean(item.name || item.inputName || item.description)); }).map(function (item) { return { codigo: clean(item.code || item.inputCode), descricao: clean(item.name || item.inputName || item.description), unidade: clean(item.unit || item.inputUnit), coeficiente: toNumber(item.coefficient) }; }),
      maoDeObra: inputs.filter(function (item) { return /mao|mão|pedreiro|servente|carpinteiro|pintor|armador/i.test(clean(item.name || item.inputName || item.description)); }).map(function (item) { return { codigo: clean(item.code || item.inputCode), descricao: clean(item.name || item.inputName || item.description), unidade: clean(item.unit || item.inputUnit), coeficiente: toNumber(item.coefficient) }; })
    };
  }

  function resolveOfficialCompositions(disciplina, quantitativos, premissas, options) {
    const source = options || {};
    const project = normalizeExecutiveProject({ project: Object.assign({}, premissas || {}, source.project || {}) });
    const rows = normalizeOfficialRows(source);
    const disciplineId = normalizeKey(disciplina);
    const mappings = OFFICIAL_COMPOSITION_MAP[disciplineId] || [];
    const quantities = Array.isArray(quantitativos) ? quantitativos : [];
    const compositions = [];
    const pendencias = [];
    if (!mappings.length) return { disciplina: disciplineId, compositions: [], pendencias: [{ id: "discipline_not_mapped", message: "Disciplina sem mapeamento oficial." }] };
    if (!rows.length) return { disciplina: disciplineId, compositions: [], pendencias: [{ id: "official_base_missing", message: "Base oficial SINAPI/ORSE nao informada." }] };
    mappings.forEach(function (mapping) {
      const quantityItem = quantities.find(function (item) { return normalizeKey(item.id) === normalizeKey(mapping.quantityId); }) || quantities.find(function (item) { return normalizeKey(item.nome).indexOf(normalizeKey(mapping.quantityId)) >= 0; });
      const scored = rows.map(function (row) { return { row: row, score: scoreOfficialRow(row, mapping, project) }; }).filter(function (item) { return item.score > 0 && rowSource(item.row) && rowCode(item.row); }).sort(function (a, b) { return b.score - a.score; });
      if (!scored.length) {
        pendencias.push({ id: mapping.quantityId, message: "Nenhuma composicao oficial encontrada para " + mapping.quantityId + "." });
        return;
      }
      const top = scored[0];
      const tied = scored.filter(function (item) { return item.score === top.score; });
      if (tied.length > 1) {
        pendencias.push({ id: mapping.quantityId + "_ambiguous", message: "Mais de uma composicao oficial possivel para " + mapping.quantityId + ".", candidates: tied.map(function (item) { return { origem: rowSource(item.row), codigo: rowCode(item.row), descricao: rowDescription(item.row), unidade: rowUnit(item.row) }; }) });
        return;
      }
      compositions.push(officialCompositionFromRow(top.row, mapping, quantityItem, "Selecionada por disciplina " + disciplineId + ", quantitativo " + mapping.quantityId + " e premissas tecnicas."));
    });
    return { disciplina: disciplineId, compositions: compositions, pendencias: pendencias };
  }

  function buildOfficialCompositionLayer(input) {
    const source = input || {};
    const quantities = source.quantitativosAutomaticos || buildAutomaticQuantities(source);
    const result = { compositions: [], pendencias: [], byDiscipline: {}, readyForCostComposition: true };
    quantities.stages.forEach(function (stage) {
      const resolved = resolveOfficialCompositions(stage.id, stage.quantitativos, Object.assign({}, source.project || {}, source.premises || {}), source);
      result.byDiscipline[stage.id] = resolved;
      result.compositions = result.compositions.concat(resolved.compositions);
      result.pendencias = result.pendencias.concat(resolved.pendencias.map(function (item) { return Object.assign({ disciplina: stage.id }, item); }));
    });
    result.readyForCostComposition = result.pendencias.length === 0 && result.compositions.length > 0;
    return result;
  }

  function normalizeStageList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(function (item) { return normalizeKey(typeof item === "string" ? item : item.id || item.nome || item.name); }).filter(Boolean);
    return Object.keys(value).map(normalizeKey).filter(Boolean);
  }

  function buildKnowledgeGraph() {
    const nextById = {};
    DISCIPLINES.forEach(function (discipline) { nextById[discipline.id] = []; });
    DISCIPLINES.forEach(function (discipline) {
      discipline.dependsOn.forEach(function (dependency) {
        if (nextById[dependency]) nextById[dependency].push(discipline.id);
      });
    });
    return {
      nodes: DISCIPLINES.map(function (discipline) {
        return {
          id: discipline.id,
          nome: discipline.label,
          preRequisitos: discipline.required.slice(),
          dependencias: discipline.dependsOn.slice(),
          disciplinasSeguintes: (nextById[discipline.id] || []).slice(),
          servicosPrincipais: (TECHNICAL_NODES[discipline.id] || discipline.services).slice()
        };
      }),
      relations: DISCIPLINES.reduce(function (list, discipline) {
        discipline.dependsOn.forEach(function (dependency) { list.push({ from: dependency, to: discipline.id, type: "depends_on" }); });
        return list;
      }, []),
      extensionPoints: Object.assign({}, EXTENSION_POINTS)
    };
  }

  function resolveDependencies(input) {
    const selected = normalizeStageList(input && (input.disciplines || input.etapasSelecionadas || input.stageOrder));
    const profile = getTypologyProfile(input || {});
    const required = selected.length ? selected.slice() : profile.disciplines.slice();
    const resolved = [];
    function include(id) {
      const discipline = DISCIPLINES.find(function (item) { return item.id === id; });
      if (!discipline || resolved.indexOf(id) >= 0) return;
      discipline.dependsOn.forEach(include);
      resolved.push(id);
    }
    required.forEach(include);
    return resolved;
  }

  function validateExecutiveProject(input) {
    const source = input || {};
    const provided = normalizeStageList(source.stageOrder || source.disciplines || source.etapas || source.stages);
    const expected = provided.length && source.project ? resolveDependencies({ project: source.project }) : resolveDependencies(source);
    const ordered = provided.length ? provided : expected.slice();
    const errors = [];
    const missing = expected.filter(function (id) { return ordered.indexOf(id) < 0; });
    missing.forEach(function (id) { add(errors, "missing_" + id, "Disciplina ausente: " + id + "."); });
    ordered.forEach(function (id, index) {
      const discipline = DISCIPLINES.find(function (item) { return item.id === id; });
      if (!discipline) return;
      discipline.dependsOn.forEach(function (dependency) {
        const dependencyIndex = ordered.indexOf(dependency);
        if (dependencyIndex < 0) add(errors, "broken_" + id + "_" + dependency, id + " depende de " + dependency + ".");
        else if (dependencyIndex > index) add(errors, "order_" + id + "_" + dependency, id + " esta antes de " + dependency + ".");
      });
    });
    if (ordered.indexOf("pintura") >= 0 && ordered.indexOf("revestimentos") < 0) add(errors, "painting_without_reboco", "Existe pintura sem reboco.");
    if (ordered.indexOf("cobertura") >= 0 && ordered.indexOf("estrutura") < 0) add(errors, "roof_without_structure", "Existe telhado sem estrutura.");
    const project = normalizeExecutiveProject(source);
    missingProjectPremises(project).forEach(function (item) { add(errors, "premise_" + item.id, item.message); });
    return { valid: errors.length === 0, errors: errors, disciplinasAusentes: missing, dependenciasQuebradas: errors.filter(function (item) { return item.id.indexOf("broken_") === 0; }), ordemIncorreta: errors.filter(function (item) { return item.id.indexOf("order_") === 0; }), premissasIncompativeis: errors.filter(function (item) { return item.id.indexOf("premise_") === 0; }) };
  }

  function explainDependencies(input) {
    const ids = resolveDependencies(input || {});
    const messages = [];
    ids.forEach(function (id) {
      const discipline = DISCIPLINES.find(function (item) { return item.id === id; });
      if (!discipline) return;
      discipline.dependsOn.forEach(function (dependency) {
        const previous = DISCIPLINES.find(function (item) { return item.id === dependency; });
        messages.push("A " + discipline.label.toLowerCase() + " depende da conclusao da " + (previous ? previous.label.toLowerCase() : dependency) + ".");
      });
    });
    if (ids.indexOf("instalacoes_hidraulicas") >= 0 && ids.indexOf("revestimentos") >= 0) messages.push("As instalacoes hidraulicas devem ser executadas antes do revestimento.");
    if (ids.indexOf("pintura") >= 0) messages.push("A pintura depende da conclusao do reboco.");
    return messages;
  }

  function round2(value) { return Math.round((Number(value) || 0) * 100) / 100; }
  function addPending(list, id, message) { add(list, id, message); }
  function quantity(id, nome, quantidade, unidade, origemCalculo, premissasUtilizadas) {
    return { id: id, nome: nome, quantidade: round2(quantidade), unidade: unidade, origemCalculo: origemCalculo, premissasUtilizadas: premissasUtilizadas || [] };
  }

  function buildGeometryModel(input) {
    const source = input || {};
    const project = normalizeExecutiveProject(source);
    const geometry = source.geometry || (source.project && source.project.geometry) || {};
    const perimeterM = toNumber(geometry.perimeterM || geometry.perimetroM || source.perimeterM || source.perimetroM);
    const wallThicknessM = toNumber(geometry.wallThicknessM || geometry.espessuraParedeM || source.wallThicknessM || source.espessuraParedeM);
    const roofSlopePercent = toNumber(geometry.roofSlopePercent || geometry.inclinacaoCoberturaPercentual || source.roofSlopePercent || source.inclinacaoCoberturaPercentual);
    const explicitRoofArea = toNumber(geometry.roofAreaM2 || geometry.areaCoberturaM2 || source.roofAreaM2 || source.areaCoberturaM2);
    const openingsAreaM2 = toNumber(geometry.openingsAreaM2 || geometry.areaAberturasM2 || source.openingsAreaM2 || source.areaAberturasM2);
    const roofAreaM2 = explicitRoofArea || (project.builtAreaM2 && roofSlopePercent ? project.builtAreaM2 * (1 + roofSlopePercent / 100) : 0);
    const heightTotalM = project.ceilingHeightM && project.floors ? project.ceilingHeightM * project.floors : 0;
    const pendencias = [];
    if (!project.builtAreaM2) addPending(pendencias, "builtAreaM2", "Informe area construida.");
    if (!perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro.");
    if (!project.ceilingHeightM) addPending(pendencias, "ceilingHeightM", "Informe pe-direito.");
    if (!wallThicknessM) addPending(pendencias, "wallThicknessM", "Informe espessura das paredes.");
    if (!project.floors) addPending(pendencias, "floors", "Informe quantidade de pavimentos.");
    if (!roofSlopePercent && !explicitRoofArea) addPending(pendencias, "roofSlopePercent", "Informe inclinacao da cobertura ou area de cobertura.");
    if (!roofAreaM2) addPending(pendencias, "roofAreaM2", "Informe area de cobertura ou dados para calcula-la.");
    if (!heightTotalM) addPending(pendencias, "heightTotalM", "Informe dados para altura total.");
    return {
      builtAreaM2: project.builtAreaM2,
      perimeterM: perimeterM,
      ceilingHeightM: project.ceilingHeightM,
      wallThicknessM: wallThicknessM,
      floors: project.floors,
      roofSlopePercent: roofSlopePercent,
      roofAreaM2: round2(roofAreaM2),
      heightTotalM: round2(heightTotalM),
      openingsAreaM2: openingsAreaM2,
      pendencias: pendencias
    };
  }

  function stageQuantities(id, status, quantitativos, premissas, pendencias) {
    return { id: id, status: pendencias.length ? "parcial" : status, quantitativos: quantitativos, unidade: "multiplas", origemCalculo: "GeometryModel + Knowledge Graph", premissasUtilizadas: premissas, pendencias: pendencias };
  }

  function buildFoundationQuantities(project, geometry) {
    const pendencias = [];
    if (!project.foundationType) addPending(pendencias, "foundationType", "Informe tipo de fundacao.");
    if (!geometry.perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro para fundacao.");
    const premises = ["foundationType", "perimeterM"];
    const trenchM3 = geometry.perimeterM * 0.4 * 0.6;
    const concreteM3 = geometry.perimeterM * 0.2 * 0.3;
    return stageQuantities("fundacao", "completa", pendencias.length ? [] : [
      quantity("escavacao", "Escavacao", trenchM3, "m3", "perimetro x largura tecnica de vala x profundidade tecnica", premises),
      quantity("concreto", "Concreto", concreteM3, "m3", "perimetro x secao tecnica de baldrame", premises),
      quantity("formas", "Formas", geometry.perimeterM * 0.6 * 2, "m2", "perimetro x altura tecnica x 2 faces", premises),
      quantity("armacao", "Armacao", concreteM3 * 80, "kg", "volume de concreto x taxa tecnica inicial de aco", premises),
      quantity("impermeabilizacao", "Impermeabilizacao", geometry.perimeterM * 0.3, "m2", "perimetro x faixa tecnica impermeabilizada", premises)
    ], premises, pendencias);
  }

  function buildStructureQuantities(project, geometry) {
    const pendencias = [];
    if (!project.structuralType) addPending(pendencias, "structuralType", "Informe tipo estrutural.");
    if (!project.builtAreaM2) addPending(pendencias, "builtAreaM2", "Informe area construida.");
    if (!project.floors) addPending(pendencias, "floors", "Informe pavimentos.");
    const premises = ["structuralType", "builtAreaM2", "floors"];
    const concreteM3 = project.builtAreaM2 * project.floors * 0.12;
    return stageQuantities("estrutura", "completa", pendencias.length ? [] : [
      quantity("volume_concreto", "Volume de concreto", concreteM3, "m3", "area construida x pavimentos x coeficiente estrutural inicial", premises),
      quantity("aco", "Aco", concreteM3 * 95, "kg", "volume de concreto estrutural x taxa tecnica inicial de aco", premises),
      quantity("formas", "Formas", concreteM3 * 8, "m2", "volume de concreto estrutural x fator tecnico de formas", premises)
    ], premises, pendencias);
  }

  function buildMasonryQuantities(project, geometry) {
    const pendencias = [];
    if (!geometry.perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro para alvenaria.");
    if (!geometry.ceilingHeightM) addPending(pendencias, "ceilingHeightM", "Informe pe-direito.");
    if (!geometry.wallThicknessM) addPending(pendencias, "wallThicknessM", "Informe espessura das paredes.");
    if (!geometry.floors) addPending(pendencias, "floors", "Informe pavimentos.");
    const premises = ["perimeterM", "ceilingHeightM", "wallThicknessM", "floors", "openingsAreaM2"];
    const wallAreaM2 = geometry.perimeterM * geometry.ceilingHeightM * geometry.floors;
    const netWallAreaM2 = Math.max(0, wallAreaM2 - geometry.openingsAreaM2);
    return stageQuantities("alvenaria", "completa", pendencias.length ? [] : [
      quantity("area_paredes", "Area de paredes", netWallAreaM2, "m2", "perimetro x pe-direito x pavimentos - aberturas", premises),
      quantity("volume_alvenaria", "Volume de alvenaria", netWallAreaM2 * geometry.wallThicknessM, "m3", "area liquida de paredes x espessura das paredes", premises),
      quantity("blocos", "Blocos", netWallAreaM2 * 13.5, "un", "area liquida de paredes x consumo tecnico inicial de blocos", premises),
      quantity("argamassa", "Argamassa", netWallAreaM2 * 0.018, "m3", "area liquida de paredes x consumo tecnico inicial de argamassa", premises),
      quantity("vergas", "Vergas", geometry.openingsAreaM2 ? geometry.openingsAreaM2 * 0.35 : 0, "m", "area de aberturas x fator tecnico de vergas", premises),
      quantity("contravergas", "Contravergas", geometry.openingsAreaM2 ? geometry.openingsAreaM2 * 0.25 : 0, "m", "area de aberturas x fator tecnico de contravergas", premises)
    ], premises, pendencias);
  }

  function buildRoofQuantities(project, geometry) {
    const pendencias = [];
    if (!project.roofType) addPending(pendencias, "roofType", "Informe tipo de telha/cobertura.");
    if (!geometry.roofAreaM2) addPending(pendencias, "roofAreaM2", "Informe area de cobertura.");
    if (!geometry.perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro para calhas e rufos.");
    const premises = ["roofType", "roofAreaM2", "perimeterM", "roofSlopePercent"];
    return stageQuantities("cobertura", "completa", pendencias.length ? [] : [
      quantity("area", "Area de cobertura", geometry.roofAreaM2, "m2", "area de cobertura informada ou area construida ajustada pela inclinacao", premises),
      quantity("madeira", "Madeira", geometry.roofAreaM2, "m2", "area de cobertura para estrutura de madeira quando aplicavel", premises),
      quantity("estrutura_metalica", "Estrutura metalica", geometry.roofAreaM2, "m2", "area de cobertura para estrutura metalica quando aplicavel", premises),
      quantity("telhas", "Telhas", geometry.roofAreaM2, "m2", "area de cobertura convertida em area de telhamento", premises),
      quantity("cumeeira", "Cumeeira", Math.sqrt(geometry.roofAreaM2), "m", "raiz da area de cobertura como linha tecnica inicial de cumeeira", premises),
      quantity("calhas", "Calhas", geometry.perimeterM, "m", "perimetro da edificacao", premises),
      quantity("rufos", "Rufos", geometry.perimeterM * 0.25, "m", "perimetro x fator tecnico inicial de rufos", premises)
    ], premises, pendencias);
  }

  function buildCoatingQuantities(project, geometry) {
    const pendencias = [];
    if (!geometry.perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro para revestimentos.");
    if (!geometry.ceilingHeightM) addPending(pendencias, "ceilingHeightM", "Informe pe-direito.");
    if (!project.builtAreaM2) addPending(pendencias, "builtAreaM2", "Informe area construida.");
    const premises = ["perimeterM", "ceilingHeightM", "floors", "openingsAreaM2", "builtAreaM2"];
    const wallFacesM2 = Math.max(0, geometry.perimeterM * geometry.ceilingHeightM * geometry.floors * 2 - geometry.openingsAreaM2);
    return stageQuantities("revestimentos", "completa", pendencias.length ? [] : [
      quantity("chapisco", "Chapisco", wallFacesM2, "m2", "area total de paredes x 2 faces - aberturas", premises),
      quantity("emboco", "Emboco", wallFacesM2, "m2", "area total de paredes x 2 faces - aberturas", premises),
      quantity("reboco", "Reboco", wallFacesM2, "m2", "area total de paredes x 2 faces - aberturas", premises),
      quantity("contrapiso", "Contrapiso", project.builtAreaM2, "m2", "area construida", premises),
      quantity("ceramica", "Ceramica", project.builtAreaM2, "m2", "area construida como base inicial de piso", premises)
    ], premises, pendencias);
  }

  function buildPaintingQuantities(project, geometry) {
    const pendencias = [];
    if (!geometry.perimeterM) addPending(pendencias, "perimeterM", "Informe perimetro para pintura.");
    if (!geometry.ceilingHeightM) addPending(pendencias, "ceilingHeightM", "Informe pe-direito.");
    const premises = ["perimeterM", "ceilingHeightM", "floors", "openingsAreaM2"];
    const paintAreaM2 = Math.max(0, geometry.perimeterM * geometry.ceilingHeightM * geometry.floors * 2 - geometry.openingsAreaM2);
    return stageQuantities("pintura", "completa", pendencias.length ? [] : [
      quantity("massa", "Massa", paintAreaM2, "m2", "area de reboco liberada para pintura", premises),
      quantity("selador", "Selador", paintAreaM2, "m2", "area de reboco liberada para pintura", premises),
      quantity("tinta", "Tinta", paintAreaM2, "m2", "area de reboco liberada para pintura", premises)
    ], premises, pendencias);
  }

  function buildAutomaticQuantities(input) {
    const source = input || {};
    const project = normalizeExecutiveProject(source);
    const geometryModel = buildGeometryModel(source);
    const graph = buildKnowledgeGraph();
    const profile = getTypologyProfile(source);
    const stageBuilders = {
      fundacao: buildFoundationQuantities(project, geometryModel),
      estrutura: buildStructureQuantities(project, geometryModel),
      alvenaria: buildMasonryQuantities(project, geometryModel),
      cobertura: buildRoofQuantities(project, geometryModel),
      revestimentos: buildCoatingQuantities(project, geometryModel),
      pintura: buildPaintingQuantities(project, geometryModel)
    };
    const stages = profile.disciplines.filter(function (id) { return stageBuilders[id]; }).map(function (id) { return stageBuilders[id]; });
    return {
      geometryModel: geometryModel,
      graphVersion: VERSION,
      stages: stages,
      pendencias: geometryModel.pendencias.concat(stages.reduce(function (list, stage) { return list.concat(stage.pendencias); }, [])),
      extensionPoints: Object.assign({}, EXTENSION_POINTS),
      typologyRouting: buildTypologyRouting(source),
      readyForPricing: profile.completeEngine && stages.every(function (stage) { return stage.status === "completa"; }),
      relationsUsed: graph.relations.filter(function (relation) { return stages.some(function (stage) { return stage.id === relation.to || stage.id === relation.from; }); })
    };
  }

  const ENGINEERING_RULES = [
    "area_positive", "perimeter_positive", "perimeter_compatible", "height_positive", "minimum_ceiling_height", "walls_existing", "roof_compatible", "floors_valid",
    "foundation_required", "structure_requires_pillars", "roof_requires_structure", "slab_compatible",
    "painting_after_reboco", "ceramic_after_screed", "frames_after_masonry", "cost_readiness_gate"
  ];

  function engineeringIssue(severity, discipline, rule, reason, consequence, correction) {
    return { severity: severity, discipline: discipline, rule: rule, reason: reason, consequence: consequence, correction: correction };
  }

  function hasProvidedStage(source, id) {
    const provided = normalizeStageList(source.stageOrder || source.disciplines || source.etapas || source.stages);
    return provided.length ? provided.indexOf(id) >= 0 : true;
  }

  function getOrderedExecution(source) {
    return normalizeStageList(source.stageOrder || source.executionOrder || source.disciplines || source.etapas || source.stages);
  }

  function comesBefore(order, first, second) {
    const firstIndex = order.indexOf(first);
    const secondIndex = order.indexOf(second);
    return firstIndex >= 0 && secondIndex >= 0 && firstIndex < secondIndex;
  }

  function validateEngineeringRules(input) {
    const source = input || {};
    const project = normalizeExecutiveProject(source);
    const geometry = buildGeometryModel(source);
    const quantities = buildAutomaticQuantities(source);
    const typologyRouting = buildTypologyRouting(source);
    const order = getOrderedExecution(source);
    const stages = source.stages || source.etapas || {};
    const issues = [];
    typologyRouting.pendencias.forEach(function (item) {
      issues.push(engineeringIssue("ERRO", "tipologia", "typology_engine_incomplete", item.message, "O motor nao deve liberar custos para esta tipologia.", "Completar o motor especifico da tipologia antes de precificar."));
    });
    const minPerimeter = project.builtAreaM2 > 0 ? 4 * Math.sqrt(project.builtAreaM2) : 0;

    if (!(project.builtAreaM2 > 0)) issues.push(engineeringIssue("ERRO", "dados_gerais", "area_positive", "A area construida deve ser maior que zero.", "O motor nao consegue dimensionar disciplinas nem custos oficiais.", "Informe area construida positiva em m2."));
    if (!(geometry.perimeterM > 0)) issues.push(engineeringIssue("ERRO", "dados_gerais", "perimeter_positive", "O perimetro deve ser maior que zero.", "Paredes, fundacao, revestimentos e pintura ficam sem base geometrica.", "Informe o perimetro externo da edificacao."));
    if (project.builtAreaM2 > 0 && geometry.perimeterM > 0 && geometry.perimeterM < minPerimeter * 0.8) issues.push(engineeringIssue("ERRO", "dados_gerais", "perimeter_compatible", "O perimetro informado e incompatível com a area construida.", "A geometria produziria quantitativos subdimensionados.", "Revise area construida e perimetro da planta."));
    if (!(geometry.heightTotalM > 0)) issues.push(engineeringIssue("ERRO", "dados_gerais", "height_positive", "A altura total deve ser positiva.", "Nao e possivel validar alvenaria, estrutura, revestimentos e pintura.", "Informe pe-direito e numero de pavimentos."));
    if (project.ceilingHeightM > 0 && project.ceilingHeightM < 2.4) issues.push(engineeringIssue("ERRO", "dados_gerais", "minimum_ceiling_height", "O pe-direito informado esta abaixo do minimo tecnico adotado de 2,40 m.", "O projeto pode ficar incompatível com uso residencial e quantitativos verticais.", "Revise o pe-direito do projeto."));
    if (!(geometry.perimeterM > 0) || !(geometry.wallThicknessM > 0)) issues.push(engineeringIssue("ERRO", "alvenaria", "walls_existing", "Paredes exigem perimetro e espessura informados.", "Alvenaria, reboco e pintura nao podem ser liberados para custo.", "Informe perimetro e espessura das paredes."));
    if (!clean(project.roofType) || !(geometry.roofAreaM2 > 0)) issues.push(engineeringIssue("ERRO", "cobertura", "roof_compatible", "A cobertura precisa de tipo e area compatíveis.", "Telhas, estrutura de cobertura, calhas e rufos ficam sem base tecnica.", "Informe tipo de cobertura e area ou inclinacao para calculo."));
    if (!(project.floors > 0)) issues.push(engineeringIssue("ERRO", "estrutura", "floors_valid", "A quantidade de pavimentos deve ser positiva.", "Estrutura e altura total ficam inconsistentes.", "Informe a quantidade de pavimentos."));

    if (!clean(project.foundationType) || !hasProvidedStage(source, "fundacao")) issues.push(engineeringIssue("ERRO", "fundacao", "foundation_required", "Casa residencial nao pode seguir sem fundacao definida.", "Estrutura, alvenaria e custos oficiais ficariam tecnicamente inseguros.", "Informe tipo de fundacao e inclua a disciplina fundacao."));
    if (hasProvidedStage(source, "estrutura")) {
      const structuralServices = Array.isArray(stages.estrutura && stages.estrutura.servicos) ? stages.estrutura.servicos.map(normalizeKey) : null;
      const explicitlyNoPillars = source.structure && source.structure.hasPillars === false;
      if (explicitlyNoPillars || (structuralServices && structuralServices.indexOf("pilares") < 0)) issues.push(engineeringIssue("ERRO", "estrutura", "structure_requires_pillars", "Estrutura informada sem pilares.", "A estrutura fica sem caminho claro de transferencia de cargas.", "Inclua pilares ou justifique outro sistema estrutural validado."));
    }
    if (hasProvidedStage(source, "cobertura") && !hasProvidedStage(source, "estrutura")) issues.push(engineeringIssue("ERRO", "cobertura", "roof_requires_structure", "A cobertura depende da estrutura.", "Nao ha suporte tecnico validado para receber a cobertura.", "Inclua e valide a disciplina estrutura antes da cobertura."));
    if (source.slabCompatible === false || /laje/.test(normalizeKey(project.roofType)) && /madeira/.test(normalizeKey(project.structuralType))) issues.push(engineeringIssue("ERRO", "estrutura", "slab_compatible", "A laje informada e incompatível com o sistema estrutural.", "O projeto nao deve seguir para custos oficiais sem revisao estrutural.", "Revise o tipo estrutural ou substitua a solucao de laje."));

    if (order.length && comesBefore(order, "pintura", "revestimentos")) issues.push(engineeringIssue("ERRO", "pintura", "painting_after_reboco", "A pintura depende da conclusao do reboco.", "A sequencia executiva esta invertida e invalida o planejamento.", "Execute revestimentos/reboco antes da pintura."));
    if (order.length && comesBefore(order, "ceramica", "contrapiso")) issues.push(engineeringIssue("ERRO", "revestimentos", "ceramic_after_screed", "Ceramica nao deve vir antes do contrapiso.", "O piso ficaria sem base regularizada para assentamento.", "Inclua contrapiso antes da ceramica."));
    if (order.length && comesBefore(order, "esquadrias", "alvenaria")) issues.push(engineeringIssue("ALERTA", "esquadrias", "frames_after_masonry", "Esquadrias aparecem antes da alvenaria.", "Pode haver conflito de sequencia, medicao e vao.", "Confirme vaos e execute alvenaria antes da instalacao das esquadrias."));

    quantities.stages.forEach(function (stage) {
      if (stage.status !== "completa") issues.push(engineeringIssue("ERRO", stage.id, "cost_readiness_gate", "A disciplina possui pendencias de quantitativo.", "O custo oficial nao deve iniciar para esta disciplina.", "Resolva as pendencias geometricas e executivas antes de precificar."));
    });

    const checklist = DISCIPLINES.map(function (discipline) {
      const related = issues.filter(function (issue) { return issue.discipline === discipline.id; });
      const hasError = related.some(function (issue) { return issue.severity === "ERRO"; });
      const hasAlert = related.some(function (issue) { return issue.severity === "ALERTA"; });
      return { id: discipline.id, nome: discipline.label, status: hasError ? "ERRO" : hasAlert ? "ALERTA" : "OK", readyForCost: !hasError, issues: related };
    });
    const globalIssues = issues.filter(function (issue) { return issue.discipline === "dados_gerais"; });
    const hasBlockingError = issues.some(function (issue) { return issue.severity === "ERRO"; });
    return { valid: !hasBlockingError, readyForCost: typologyRouting.readyForCost && !hasBlockingError, rulesApplied: ENGINEERING_RULES.slice(), validationsCount: ENGINEERING_RULES.length, issues: issues, checklist: checklist, globalIssues: globalIssues, quantitiesReady: quantities.readyForPricing, typologyRouting: typologyRouting };
  }

  const EngineeringRulesEngine = { version: VERSION, rules: ENGINEERING_RULES.slice(), validate: validateEngineeringRules };

  function normalizeExecutiveProject(input) {
    const source = input || {};
    const record = source.project || source;
    const premises = source.premises || {};
    const cityUf = clean(record.cityUf || premises.cityUf || source.cityUf);
    const cityUfParts = cityUf.split(/[/-]/).map(clean).filter(Boolean);
    const type = clean(record.type || source.type || record.typology || source.typology || "residential");
    const normalizedType = normalizeKey(type);
    const floors = toNumber(record.floors || record.pavimentos || premises.floors || premises.pavimentos || source.floors || source.pavimentos || (normalizedType.indexOf("sobrado") >= 0 ? 2 : 0));
    return {
      type: type || "residential",
      city: clean(record.city || premises.city || source.city || cityUfParts[0]),
      state: clean(record.state || record.uf || premises.state || premises.uf || source.state || source.uf || cityUfParts[1]).toUpperCase(),
      builtAreaM2: toNumber(record.builtAreaM2 || record.areaM2 || record.areaConstruidaM2 || premises.builtAreaM2 || premises.areaM2 || source.builtAreaM2 || source.areaM2),
      floors: floors,
      standard: clean(record.standard || record.padrao || record.projectStandard || premises.standard || premises.padrao || premises.projectStandard || source.standard || source.padrao),
      ceilingHeightM: toNumber(record.ceilingHeightM || record.peDireitoM || premises.ceilingHeightM || premises.peDireitoM || source.ceilingHeightM || source.peDireitoM),
      structuralType: clean(record.structuralType || record.tipoEstrutural || premises.structuralType || premises.tipoEstrutural || source.structuralType || source.tipoEstrutural),
      roofType: clean(record.roofType || record.tipoCobertura || premises.roofType || premises.tipoCobertura || source.roofType || source.tipoCobertura),
      foundationType: clean(record.foundationType || record.tipoFundacao || record.tipoFundação || premises.foundationType || premises.tipoFundacao || premises.tipoFundação || source.foundationType || source.tipoFundacao || source.tipoFundação),
      blockType: clean(record.blockType || record.tipoBloco || premises.blockType || premises.tipoBloco || source.blockType || source.tipoBloco),
      masonryType: clean(record.masonryType || record.tipoAlvenaria || premises.masonryType || premises.tipoAlvenaria || source.masonryType || source.tipoAlvenaria)
    };
  }

  function missingProjectPremises(project) {
    const missing = [];
    REQUIRED_PREMISES.forEach(function (premise) {
      const value = project[premise.id];
      const ok = typeof value === "number" ? value > 0 : !!clean(value);
      if (!ok) missing.push({ id: premise.id, label: premise.label, message: "Informe " + premise.label + "." });
    });
    return missing;
  }

  function buildStageStatus(stage, project, stageData, globalMissing) {
    const data = stageData || {};
    const pendencias = [];
    const invalidArea = project.builtAreaM2 < 0;
    if (invalidArea) pendencias.push({ id: "builtAreaM2", message: "Area construida inconsistente." });
    stage.required.forEach(function (id) {
      const value = project[id];
      const ok = typeof value === "number" ? value > 0 : !!clean(value);
      if (!ok) pendencias.push({ id: id, message: "Premissa obrigatoria ausente: " + id + "." });
    });
    const quantitativeItems = Array.isArray(data.quantitativos) ? data.quantitativos : [];
    const compositionItems = Array.isArray(data.composicoes) ? data.composicoes : [];
    let status = "nao_iniciada";
    if (invalidArea) status = "inconsistente";
    else if (globalMissing.length) status = pendencias.length === stage.required.length ? "nao_iniciada" : "parcial";
    else if (pendencias.length) status = "parcial";
    else if (quantitativeItems.length && compositionItems.length) status = "completa";
    else status = "parcial";
    return { status: status, pendencias: pendencias, quantitativeItems: quantitativeItems, compositionItems: compositionItems };
  }

  function buildExecutiveBudgetStructure(input) {
    const source = input || {};
    const project = normalizeExecutiveProject(source);
    const typologyRouting = buildTypologyRouting(source);
    const automaticQuantities = buildAutomaticQuantities(source);
    const engineeringRules = validateEngineeringRules(source);
    const officialCompositions = buildOfficialCompositionLayer(Object.assign({}, source, { quantitativosAutomaticos: automaticQuantities }));
    const globalMissing = missingProjectPremises(project);
    const stageSource = source.stages || source.etapas || {};
    const etapas = typologyRouting.applicableDisciplines.map(function (disciplineId) {
      const discipline = createDisciplineStage(disciplineId);
      const data = stageSource[discipline.id] || {};
      const status = buildStageStatus(discipline, project, data, globalMissing);
      return {
        id: discipline.id,
        nome: discipline.label,
        status: status.status,
        dependeDe: discipline.dependsOn.slice(),
        premissas: discipline.required.map(function (id) { return { id: id, valor: project[id] || null }; }),
        quantitativos: status.quantitativeItems,
        servicos: (Array.isArray(data.servicos) && data.servicos.length ? data.servicos : discipline.services).slice(),
        composicoes: status.compositionItems,
        pendencias: status.pendencias
      };
    });
    const pendencias = globalMissing.slice().concat(typologyRouting.pendencias);
    etapas.forEach(function (stage) {
      stage.pendencias.forEach(function (item) { add(pendencias, stage.id + "_" + item.id, stage.nome + ": " + item.message); });
    });
    const disciplinasFaltantes = etapas.filter(function (stage) { return stage.status !== "completa"; }).map(function (stage) { return stage.id; });
    const checklist = etapas.map(function (stage) {
      const icon = stage.status === "completa" ? "check" : stage.status === "parcial" ? "warning" : stage.status === "inconsistente" ? "error" : "empty";
      return { id: stage.id, label: stage.nome, status: stage.status, icon: icon, message: stage.pendencias.length ? stage.pendencias[0].message : "Etapa estruturada." };
    });
    return {
      projeto: project,
      dadosGerais: project,
      etapas: etapas,
      typologyRouting: typologyRouting,
      geometryModel: automaticQuantities.geometryModel,
      quantitativosAutomaticos: automaticQuantities,
      engineeringRules: engineeringRules,
      officialCompositions: officialCompositions,
      readyForCost: typologyRouting.readyForCost && engineeringRules.readyForCost && officialCompositions.readyForCostComposition,
      checklist: checklist,
      pendencias: pendencias,
      disciplinasFaltantes: disciplinasFaltantes,
      premissas: REQUIRED_PREMISES.map(function (premise) { return { id: premise.id, label: premise.label, valor: project[premise.id] || null, ok: !globalMissing.some(function (item) { return item.id === premise.id; }) }; }),
      prontoParaCalculo: globalMissing.length === 0 && !etapas.some(function (stage) { return stage.status === "inconsistente"; })
    };
  }

  function buildResidentialExecutiveBudget(input) {
    return buildExecutiveBudgetStructure(input);
  }

  function evaluateResidentialExecutiveBudget(input) {
    return buildExecutiveBudgetStructure(input);
  }

  function uniqueList(values) {
    const list = [];
    (Array.isArray(values) ? values : []).forEach(function (value) {
      const id = normalizeKey(value && (value.id || value.nome || value.label || value.descricao) || value);
      if (id && list.indexOf(id) < 0) list.push(id);
    });
    return list;
  }

  function collectCalibrationTerms(result) {
    const terms = [];
    (result.etapas || []).forEach(function (stage) {
      terms.push(stage.id, stage.nome);
      (stage.servicos || []).forEach(function (service) { terms.push(service); });
      (stage.quantitativos || []).forEach(function (item) { terms.push(item.id, item.nome, item.unidade); });
      (stage.composicoes || []).forEach(function (item) { terms.push(item.codigo, item.descricao, item.serviceType); });
    });
    (result.officialCompositions && result.officialCompositions.compositions || []).forEach(function (item) { terms.push(item.codigo, item.descricao, item.serviceType, item.quantityId); });
    return uniqueList(terms);
  }

  function getCalibrationProjectInput(project) {
    const source = project || {};
    if (source.project || source.geometry || source.officialBaseRows || source.stages) return source;
    return { project: source };
  }

  function calibrationStatus(score) {
    if (score >= 85) return "pass";
    if (score >= 70) return "warning";
    return "fail";
  }

  function addCalibrationItem(list, id, message) {
    if (!list.some(function (item) { return item.id === id; })) list.push({ id: id, message: message });
  }

  function calibrateAgainstRealCase(project, referenceCase) {
    const reference = referenceCase || {};
    const input = getCalibrationProjectInput(project);
    const result = buildExecutiveBudgetStructure(input);
    const matches = [];
    const missing = [];
    const unexpected = [];
    const risks = [];
    const recommendations = [];
    let score = 100;

    const expectedTypology = normalizeKey(reference.tipologia || reference.typology || reference.expectedTypology);
    const actualTypology = normalizeKey(result.typologyRouting && result.typologyRouting.typology);
    if (expectedTypology && actualTypology === expectedTypology) matches.push({ id: "typology", message: "Tipologia identificada conforme referencia: " + actualTypology + "." });
    else if (expectedTypology) {
      score -= 25;
      addCalibrationItem(missing, "typology", "Tipologia esperada " + expectedTypology + ", motor retornou " + (actualTypology || "desconhecida") + ".");
      addCalibrationItem(recommendations, "typology", "Ajustar classificacao de tipologia antes de conectar custos finais.");
    }

    const actualDisciplines = uniqueList((result.etapas || []).map(function (stage) { return stage.id; }));
    const expectedDisciplines = uniqueList(reference.disciplinasEsperadas || reference.expectedDisciplines || []);
    expectedDisciplines.forEach(function (id) {
      if (actualDisciplines.indexOf(id) >= 0) matches.push({ id: "discipline_" + id, message: "Disciplina prevista encontrada: " + id + "." });
      else {
        score -= 5;
        addCalibrationItem(missing, "discipline_" + id, "Disciplina esperada ausente: " + id + ".");
        addCalibrationItem(recommendations, "discipline_" + id, "Revisar perfil de tipologia ou dependencias para incluir " + id + ".");
      }
    });

    const terms = collectCalibrationTerms(result);
    uniqueList(reference.itensQueNaoDevemAparecer || reference.forbiddenItems || []).forEach(function (id) {
      if (terms.some(function (term) { return term.indexOf(id) >= 0 || id.indexOf(term) >= 0; })) {
        score -= 8;
        addCalibrationItem(unexpected, "unexpected_" + id, "Item indevido apareceu na estrutura: " + id + ".");
        addCalibrationItem(recommendations, "unexpected_" + id, "Bloquear " + id + " para a tipologia " + (expectedTypology || actualTypology || "informada") + ".");
      }
    });

    const expectedScope = uniqueList(reference.escopoEsperado || reference.expectedScope || []);
    expectedScope.forEach(function (id) {
      if (terms.some(function (term) { return term.indexOf(id) >= 0 || id.indexOf(term) >= 0; })) matches.push({ id: "scope_" + id, message: "Escopo esperado coberto: " + id + "." });
      else {
        score -= 3;
        addCalibrationItem(missing, "scope_" + id, "Item de escopo esperado ausente: " + id + ".");
      }
    });

    const quantityStages = result.quantitativosAutomaticos && result.quantitativosAutomaticos.stages || [];
    expectedDisciplines.forEach(function (id) {
      const stage = quantityStages.find(function (item) { return item.id === id; });
      if (stage && stage.quantitativos && stage.quantitativos.length) matches.push({ id: "quantities_" + id, message: "Quantitativos gerados para " + id + "." });
      else if (actualDisciplines.indexOf(id) >= 0) {
        score -= 2;
        addCalibrationItem(risks, "quantities_" + id, "Sem quantitativos automaticos completos para " + id + ".");
      }
    });

    if (result.engineeringRules && result.engineeringRules.valid) matches.push({ id: "engineering_rules", message: "Regras de engenharia sem erro bloqueante." });
    else {
      score -= 15;
      addCalibrationItem(risks, "engineering_rules", "Regras de engenharia indicam inconsistencias.");
      addCalibrationItem(recommendations, "engineering_rules", "Corrigir inconsistencias tecnicas antes de liberar custos.");
    }

    const compositions = result.officialCompositions && result.officialCompositions.compositions || [];
    if (reference.exigeComposicoesOficiais && !compositions.length) {
      score -= 10;
      addCalibrationItem(risks, "official_compositions", "Nenhuma composicao oficial resolvida para o caso de referencia.");
      addCalibrationItem(recommendations, "official_compositions", "Validar base SINAPI/ORSE e mapeamentos antes de precificacao.");
    } else if (compositions.length) matches.push({ id: "official_compositions", message: "Composicoes oficiais resolvidas sem calcular custos." });

    (result.pendencias || []).slice(0, 8).forEach(function (item) {
      addCalibrationItem(risks, "pendency_" + normalizeKey(item.id || item.message), item.message || String(item));
    });

    score = Math.max(0, Math.min(100, Math.round(score)));
    return {
      score: score,
      status: calibrationStatus(score),
      matches: matches,
      missing: missing,
      unexpected: unexpected,
      risks: risks,
      recommendations: recommendations,
      engineSummary: {
        typology: result.typologyRouting && result.typologyRouting.typology,
        disciplines: actualDisciplines,
        readyForCost: result.readyForCost,
        prontoParaCalculo: result.prontoParaCalculo
      }
    };
  }

  function evaluateExecutiveReadiness(projectRecord, budget) {
    const record = projectRecord || {};
    const project = record.project || {};
    const premises = record.premises || {};
    const b = budget || {};
    const blockers = [];
    const missing = [];
    const requiredToClose = [];
    if (!clean(project.name) && !clean(record.client && record.client.name)) add(blockers, "project_identity", "Informe cliente ou identificação da obra.");
    if (!clean(project.cityUf)) add(blockers, "city_uf", "Informe cidade/UF da obra.");
    if (!clean(project.type)) add(missing, "project_type", "Informe tipo de obra.");
    if (!project.builtAreaM2) add(missing, "built_area", "Informe área construída.");
    if ((record.workPackages || []).some(function (p) { return p.status !== "ready"; })) add(blockers, "scope_not_closed", "Escopo ainda possui pacotes pendentes.");
    if (!(record.compositionSelections || []).some(function (c) { return c.selected === true; })) add(blockers, "candidate_compositions", "Composições ainda são candidatas, não selecionadas.");
    if ((b.budgetTable && b.budgetTable.summary && b.budgetTable.summary.pendingRows) > 0) add(blockers, "pending_quantities", "Existem quantitativos/linhas pendentes.");
    if ((b.consumptionBlocked || []).length) add(blockers, "unit_or_consumption_blocked", "Há consumo bloqueado por unidade, composição ou coeficiente.");
    if (!clean(premises.sinapiState) || !clean(premises.sinapiReferenceMonth)) add(missing, "sinapi_base", "Informe UF e mês da base SINAPI.");
    if (!premises.priceSource) add(blockers, "price_source", "Fonte de preço/custo oficial ausente.");
    if (premises.bdi === undefined || premises.bdi === null || premises.bdi === "") add(missing, "bdi", "Informe BDI se aplicável.");
    requiredToClose.push.apply(requiredToClose, blockers.concat(missing));
    const checks = 10;
    const failed = blockers.length + missing.length;
    const score = Math.max(0, Math.min(1, (checks - failed) / checks));
    return { ready: blockers.length === 0 && missing.length === 0, score: Number(score.toFixed(2)), blockers, missing, requiredToClose, executivePreview: buildExecutiveBudgetPreview(record, b).executivePreview };
  }

  function buildExecutiveBudgetPreview(projectRecord, budget) {
    const b = budget || {};
    const rows = (b.budgetTable && b.budgetTable.rows || []).map(function (row) { return { package: row.package, service: row.service, quantity: row.quantity, unit: row.unit, compositionCode: row.compositionCode, status: row.pending && row.pending.length ? "pending" : row.consumptionStatus }; });
    return { executivePreview: { rows, totals: null, bdi: projectRecord && projectRecord.premises && projectRecord.premises.bdi || null, schedule: [] }, blocked: rows.filter(function (r) { return r.status !== "ready"; }) };
  }

  function buildExecutiveClosingChecklist(projectRecord, budget) {
    const record = projectRecord || {};
    const project = record.project || {};
    const premises = record.premises || {};
    const b = budget || {};
    const selected = (record.compositionSelections || []).filter(function (c) { return c.selected === true; }).length;
    const pendingRows = b.budgetTable && b.budgetTable.summary && b.budgetTable.summary.pendingRows || 0;
    const checklist = [
      { id: "client", label: "Cliente/obra identificados", ok: !!(clean(record.client && record.client.name) || clean(project.name)), required: true },
      { id: "city_uf", label: "Cidade/UF informada", ok: !!clean(project.cityUf || (project.city && project.state)), required: true },
      { id: "base", label: "Base SINAPI carregada", ok: !!(b.baseStatus && b.baseStatus.loaded), required: true },
      { id: "scope", label: "Escopo fechado", ok: !(record.workPackages || []).some(function (p) { return p.status !== "ready"; }), required: true },
      { id: "quantities", label: "Quantidades completas", ok: pendingRows === 0, required: true },
      { id: "compositions", label: "Composições confirmadas", ok: selected > 0 && selected >= ((b.compositionMatches || []).filter(function (m) { return m.found; }).length || 1), required: true },
      { id: "prices", label: "Preços disponíveis", ok: !!premises.priceSource, required: true },
      { id: "bdi", label: "BDI definido ou dispensado", ok: premises.bdi !== undefined || premises.bdiExempt === true, required: true },
      { id: "revision", label: "Revisão atual registrada", ok: (record.revisions || []).length > 0, required: true },
      { id: "responsible", label: "Responsável técnico informado", ok: !!clean(record.responsible || premises.responsibleEngineer), required: false }
    ];
    const blockers = checklist.filter(function (item) { return item.required && !item.ok; }).map(function (item) { return { id: item.id, message: item.label + " pendente." }; });
    const nextActions = blockers.map(function (item) { return "Resolver: " + item.message; });
    return { canClose: blockers.length === 0, checklist: checklist, blockers: blockers, nextActions: nextActions };
  }

  function prepareExecutiveClosing(projectRecord, budget, options) {
    const record = projectRecord || {};
    const b = budget || {};
    const opts = options || {};
    const readiness = evaluateExecutiveReadiness(record, b);
    const checklistBase = buildExecutiveClosingChecklist(record, b);
    const priceStatus = b.priceStatus || {};
    const blockers = [].concat(readiness.blockers || [], checklistBase.blockers || []);
    const nextActions = [].concat(checklistBase.nextActions || []);
    const rows = b.budgetTable && b.budgetTable.rows || [];
    const selected = record.compositionSelections || [];
    const lockedRows = [];
    const priceRequirements = [];
    rows.forEach(function (row, index) {
      const rowId = row.rowId || row.id || "row_" + index;
      const hasQuantity = row.quantity !== undefined && row.quantity !== null && row.quantity !== "" && !(row.pending || []).length;
      const hasComposition = selected.some(function (item) { return item.selected === true && (item.serviceId === row.serviceId || item.service === row.service || item.code === row.compositionCode); });
      const hasPrice = !!((priceStatus.pricedRows || []).find(function (priced) { return (priced.rowId === rowId || priced.service === row.service) && priced.unitPrice != null; }));
      const unitCompatible = !/blocked|incompatible|pendente/i.test(String(row.consumptionStatus || ""));
      const ok = hasQuantity && hasComposition && hasPrice && unitCompatible;
      if (ok) lockedRows.push({ rowId: rowId, service: row.service, status: "lockable" });
      if (!hasPrice) priceRequirements.push({ rowId: rowId, service: row.service, reason: "price_missing" });
    });
    if ((b.compositionMatches || []).some(function (m) { return m.found && !selected.some(function (s) { return s.selected === true && s.serviceId === m.serviceId; }); })) add(blockers, "candidate_compositions", "Existem composicoes candidatas nao confirmadas.");
    if (priceRequirements.length) add(blockers, "prices", "Existem linhas sem preco informado ou validado.");
    if (opts.requireBdi !== false && !(record.premises && (record.premises.bdi !== undefined || record.premises.bdiExempt === true))) add(blockers, "bdi", "BDI obrigatorio ausente ou nao dispensado.");
    const uniqueBlockers = [];
    blockers.forEach(function (item) { add(uniqueBlockers, item.id, item.message); });
    uniqueBlockers.forEach(function (item) { if (!nextActions.some(function (a) { return a.indexOf(item.message) >= 0; })) nextActions.push("Resolver: " + item.message); });
    const checks = Math.max(1, rows.length + checklistBase.checklist.length + 3);
    const failed = uniqueBlockers.length + priceRequirements.length;
    const score = Math.max(0, Math.min(1, (checks - failed) / checks));
    return { canClose: uniqueBlockers.length === 0 && priceRequirements.length === 0, score: Number(score.toFixed(2)), checklist: checklistBase.checklist, blockers: uniqueBlockers, nextActions: nextActions, lockedRows: lockedRows, priceRequirements: priceRequirements, bdiRequirement: { required: opts.requireBdi !== false, present: !!(record.premises && (record.premises.bdi !== undefined || record.premises.bdiExempt === true)) } };
  }

  function lockExecutiveRow(projectRecord, rowId, data) {
    const record = projectRecord || {};
    const payload = data || {};
    const checks = payload.checks || {};
    const ok = checks.quantityConfirmed && checks.compositionSelected && checks.priceValidated && checks.premisesConfirmed && checks.unitCompatible !== false;
    if (!ok) return Object.assign({}, record, { lockError: "row_checklist_not_ok", rowId: rowId });
    const r = JSON.parse(JSON.stringify(record));
    r.lockedRows = r.lockedRows || [];
    if (r.lockedRows.some(function (row) { return row.rowId === rowId; })) return Object.assign(r, { lockError: "row_already_locked", rowId: rowId });
    r.lockedRows.push(Object.assign({ rowId: rowId, lockedAt: new Date().toISOString(), status: "locked" }, payload));
    r.revisions = r.revisions || [];
    r.revisions.push({ number: r.revisions.length + 1, date: new Date().toISOString(), origin: "executive_lock", summary: "Linha executiva bloqueada: " + rowId });
    r.history = r.history || [];
    r.history.push({ at: new Date().toISOString(), type: "executive_row_locked", message: "Linha executiva bloqueada.", rowId: rowId });
    return r;
  }

  root.EloExecutiveBudgetEngine = {
    version: VERSION,
    requiredPremises: REQUIRED_PREMISES.slice(),
    disciplines: DISCIPLINES.slice(),
    buildKnowledgeGraph,
    classifyProjectTypology,
    getTypologyProfile,
    buildTypologyRouting,
    buildGeometryModel,
    buildAutomaticQuantities,
    officialCompositionMap: OFFICIAL_COMPOSITION_MAP,
    resolveOfficialCompositions,
    buildOfficialCompositionLayer,
    EngineeringRulesEngine,
    validateEngineeringRules,
    resolveDependencies,
    validateExecutiveProject,
    explainDependencies,
    extensionPoints: Object.assign({}, EXTENSION_POINTS),
    buildExecutiveBudgetStructure,
    buildResidentialExecutiveBudget,
    evaluateResidentialExecutiveBudget,
    calibrateAgainstRealCase,
    evaluateExecutiveReadiness,
    buildExecutiveBudgetPreview,
    buildExecutiveClosingChecklist,
    prepareExecutiveClosing,
    lockExecutiveRow
  };
})(typeof window !== "undefined" ? window : globalThis);
