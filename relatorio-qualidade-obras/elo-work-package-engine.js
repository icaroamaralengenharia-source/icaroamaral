(function (root) {
  "use strict";

  const VERSION = "20260624-elo-work-package-engine-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }

  const HOUSE_PACKAGES = [
    {
      id: "servicos_preliminares",
      name: "Serviços preliminares",
      services: [{ id: "limpeza_inicial", description: "Limpeza inicial e preparação do canteiro", unit: "un" }],
      required: ["implantacao_ou_dados_do_terreno"],
      searchTerms: ["servicos preliminares obra", "limpeza inicial canteiro"]
    },
    {
      id: "fundacao",
      name: "Fundação",
      services: [{ id: "fundacao", description: "Fundação preliminar", unit: "m3" }],
      required: ["tipo_fundacao", "projeto_ou_dimensoes"],
      searchTerms: ["fundacao sapata", "fundacao baldrame", "radier concreto"]
    },
    {
      id: "estrutura",
      name: "Estrutura",
      services: [{ id: "estrutura_concreto", description: "Estrutura de concreto", unit: "m3" }],
      required: ["sistema_estrutural", "projeto_estrutural_ou_dimensoes"],
      searchTerms: ["estrutura concreto pilar viga", "laje concreto"]
    },
    {
      id: "alvenaria",
      name: "Alvenaria",
      services: [{ id: "alvenaria_bloco", description: "Alvenaria de vedação", unit: "m2" }],
      required: ["area_alvenaria ou perimetro + altura", "tipo_bloco"],
      searchTerms: ["alvenaria bloco ceramico", "bloco ceramico vedacao"]
    },
    {
      id: "cobertura",
      name: "Cobertura",
      services: [{ id: "cobertura_telha", description: "Cobertura/telhamento", unit: "m2" }],
      required: ["area_cobertura ou area_construida", "tipo_telha", "estrutura"],
      searchTerms: ["cobertura telha portuguesa", "telha ceramica portuguesa", "telhamento"]
    },
    {
      id: "contrapiso",
      name: "Contrapiso",
      services: [{ id: "contrapiso_argamassa", description: "Contrapiso em argamassa", unit: "m3" }],
      required: ["area_contrapiso", "espessura_contrapiso"],
      searchTerms: ["contrapiso argamassa", "regularizacao piso"]
    },
    {
      id: "piso_revestimento",
      name: "Piso e revestimento",
      services: [{ id: "piso_ceramico", description: "Piso/revestimento cerâmico", unit: "m2" }],
      required: ["area_piso", "tipo_piso"],
      searchTerms: ["piso ceramico", "revestimento ceramico", "porcelanato"]
    },
    {
      id: "chapisco_reboco",
      name: "Chapisco e reboco",
      services: [{ id: "chapisco", description: "Chapisco", unit: "m2" }, { id: "reboco", description: "Reboco/emboço", unit: "m2" }],
      required: ["area_revestimento_parede", "ambiente", "espessura_reboco"],
      searchTerms: ["chapisco alvenaria", "reboco emboco massa unica"]
    },
    {
      id: "pintura",
      name: "Pintura",
      services: [{ id: "pintura_parede", description: "Pintura de paredes", unit: "m2" }],
      required: ["area_pintura", "tipo_tinta", "demaos"],
      searchTerms: ["pintura parede tinta acrilica", "aplicacao de tinta"]
    },
    {
      id: "instalacoes_eletricas",
      name: "Instalações elétricas",
      services: [{ id: "pontos_eletricos", description: "Pontos elétricos", unit: "pt" }],
      required: ["quantidade_pontos_eletricos ou projeto"],
      searchTerms: ["ponto eletrico", "tomada luz eletroduto cabo"]
    },
    {
      id: "instalacoes_hidraulicas",
      name: "Instalações hidráulicas",
      services: [{ id: "pontos_hidraulicos", description: "Pontos hidráulicos", unit: "pt" }],
      required: ["quantidade_pontos_hidraulicos ou projeto"],
      searchTerms: ["instalacao hidraulica", "tubo pvc agua fria esgoto"]
    },
    {
      id: "esquadrias",
      name: "Esquadrias",
      services: [{ id: "portas_janelas", description: "Portas e janelas", unit: "un" }],
      required: ["quantidade_dimensoes_esquadrias"],
      searchTerms: ["porta madeira", "janela aluminio", "esquadria"]
    },
    {
      id: "limpeza_final",
      name: "Limpeza final",
      services: [{ id: "limpeza_final", description: "Limpeza final da obra", unit: "m2" }],
      required: ["area_construida"],
      searchTerms: ["limpeza final obra"]
    }
  ];

  function inferTypology(projectFacts, technicalContext) {
    const facts = projectFacts || {};
    const ctx = technicalContext || {};
    const text = normalize([facts.projectType, facts.type, facts.tipoObra, facts.originalMessage, ctx.lastMessage].join(" "));
    if (/muro/.test(text)) return "muro";
    if (/banheiro/.test(text)) return "banheiro";
    if (/reforma/.test(text)) return "reforma_simples";
    if (/telhado|cobertura/.test(text) && !/casa/.test(text)) return "telhado_cobertura";
    if (/piso|revestimento|porcelanato|ceramico/.test(text) && !/casa/.test(text)) return "piso_revestimento";
    return "casa_terrea";
  }

  function hasFact(facts, key) {
    if (!facts) return false;
    if (key === "area_alvenaria ou perimetro + altura") return number(facts.wallAreaM2) > 0 || (number(facts.wallPerimeterM) > 0 && number(facts.wallHeightM) > 0);
    if (key === "tipo_bloco") return !!clean(facts.wallMaterial);
    if (key === "area_cobertura ou area_construida") return number(facts.roofAreaM2 || facts.builtAreaM2 || facts.areaConstruidaM2) > 0;
    if (key === "tipo_telha") return !!clean(facts.roofMaterial);
    if (key === "estrutura") return !!clean(facts.roofStructure || facts.structuralSystem);
    if (key === "area_piso") return number(facts.floorAreaM2 || facts.builtAreaM2 || facts.areaConstruidaM2) > 0;
    if (key === "tipo_piso") return !!clean(facts.floorMaterial);
    if (key === "area_contrapiso") return number(facts.contrapisoAreaM2 || facts.floorAreaM2) > 0;
    if (key === "espessura_contrapiso") return number(facts.contrapisoThicknessCm) > 0;
    if (key === "area_construida") return number(facts.builtAreaM2 || facts.areaConstruidaM2) > 0;
    if (key === "tipo_fundacao") return !!clean(facts.foundationType);
    if (key === "sistema_estrutural") return !!clean(facts.structuralSystem);
    if (key === "area_pintura") return number(facts.paintAreaM2) > 0;
    if (key === "tipo_tinta") return !!clean(facts.paintType);
    if (key === "demaos") return number(facts.paintCoats) > 0;
    if (key === "area_revestimento_parede") return number(facts.wallCoatingAreaM2 || facts.wallAreaM2) > 0;
    if (key === "ambiente") return !!clean(facts.environment);
    if (key === "espessura_reboco") return number(facts.rebocoThicknessCm) > 0;
    return !!facts[key];
  }

  function buildPackage(template, facts) {
    const available = [];
    const missing = [];
    (template.required || []).forEach(function (item) {
      if (hasFact(facts, item)) available.push(item); else missing.push(item);
    });
    let status = "pending";
    if (missing.length === 0) status = "ready";
    else if (available.length > 0) status = "partial";
    return {
      id: template.id,
      name: template.name,
      status: status,
      services: template.services.slice(),
      required: (template.required || []).slice(),
      available: available,
      missing: missing,
      searchTerms: (template.searchTerms || []).slice()
    };
  }

  function buildWorkPackages(projectFacts, technicalContext) {
    const facts = projectFacts || {};
    const typology = inferTypology(facts, technicalContext || {});
    const templates = HOUSE_PACKAGES;
    return {
      typology: typology,
      packages: templates.map(function (template) { return buildPackage(template, facts); }),
      summary: { totalPackages: templates.length }
    };
  }

  root.EloWorkPackageEngine = { version: VERSION, buildWorkPackages: buildWorkPackages, inferTypology: inferTypology };
})(typeof window !== "undefined" ? window : globalThis);
