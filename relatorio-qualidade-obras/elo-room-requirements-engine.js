(function (root) {
  "use strict";

  const VERSION = "20260718-elo-room-requirements-v2";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = normalize(item);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  const ZERO_ELECTRICAL = {
    lightingPoints: 0,
    switchPoints: 0,
    generalOutletPoints: 0,
    dedicatedOutletPoints: 0,
    specialPoints: 0
  };

  const ZERO_HYDRAULIC = {
    coldWaterPoints: 0,
    hotWaterPoints: 0,
    sewagePoints: 0,
    floorDrains: 0,
    fixtures: {}
  };

  function electrical(values) {
    return Object.assign({}, ZERO_ELECTRICAL, values || {});
  }

  function hydraulic(values) {
    return Object.assign({}, ZERO_HYDRAULIC, values || {}, { fixtures: Object.assign({}, values && values.fixtures ? values.fixtures : {}) });
  }

  const REQUIREMENTS = {
    quarto: {
      id: "quarto",
      nome: "Quarto",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 4 }),
      hydraulic: hydraulic()
    },
    sala: {
      id: "sala",
      nome: "Sala",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 5, specialPoints: 1 }),
      hydraulic: hydraulic()
    },
    banheiro: {
      id: "banheiro",
      nome: "Banheiro",
      obrigatorios: ["vaso", "lavatorio", "chuveiro", "ralo", "caixa_sifonada", "ponto_agua", "ponto_esgoto", "registro", "impermeabilizacao", "piso", "revestimento_parede"],
      condicionais: [{ item: "box", when: "box_especificado" }],
      termosBusca: {
        vaso: ["vaso sanitario", "bacia sanitaria"],
        lavatorio: ["lavatorio banheiro", "cuba banheiro"],
        chuveiro: ["chuveiro", "ponto chuveiro"],
        ralo: ["ralo sifonado", "ralo banheiro"],
        caixa_sifonada: ["caixa sifonada"],
        ponto_agua: ["ponto de agua banheiro", "agua fria banheiro"],
        ponto_esgoto: ["ponto de esgoto banheiro", "tubulacao esgoto banheiro"],
        registro: ["registro gaveta", "registro pressao"],
        impermeabilizacao: ["impermeabilizacao banheiro", "argamassa polimerica banheiro"],
        piso: ["piso ceramico banheiro", "argamassa colante piso banheiro"],
        revestimento_parede: ["revestimento parede banheiro", "azulejo banheiro"],
        box: ["box banheiro", "vidro box"]
      },
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 1 }),
      hydraulic: hydraulic({
        coldWaterPoints: 3,
        sewagePoints: 3,
        floorDrains: 1,
        fixtures: { toilet: 1, washbasin: 1, shower: 1 }
      })
    },
    lavabo: {
      id: "lavabo",
      nome: "Lavabo",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 1 }),
      hydraulic: hydraulic({
        coldWaterPoints: 2,
        sewagePoints: 2,
        fixtures: { toilet: 1, washbasin: 1 }
      })
    },
    cozinha: {
      id: "cozinha",
      nome: "Cozinha",
      obrigatorios: ["pia_cuba", "torneira", "ponto_agua", "ponto_esgoto", "piso", "revestimento_area_molhada"],
      condicionais: [{ item: "bancada", when: "bancada_especificada" }],
      termosBusca: {
        pia_cuba: ["pia cozinha", "cuba cozinha"],
        torneira: ["torneira cozinha"],
        ponto_agua: ["ponto de agua cozinha"],
        ponto_esgoto: ["ponto de esgoto cozinha"],
        piso: ["piso ceramico cozinha"],
        revestimento_area_molhada: ["revestimento parede cozinha", "area molhada cozinha"],
        bancada: ["bancada cozinha", "bancada granito"]
      },
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 6, dedicatedOutletPoints: 2 }),
      hydraulic: hydraulic({
        coldWaterPoints: 1,
        sewagePoints: 1,
        fixtures: { sink: 1 }
      })
    },
    area_servico: {
      id: "area_servico",
      nome: "Area de servico",
      obrigatorios: ["tanque", "ponto_maquina", "ralo", "torneira", "ponto_esgoto"],
      condicionais: [],
      termosBusca: {
        tanque: ["tanque area de servico"],
        ponto_maquina: ["ponto maquina lavar", "ponto maquina area servico"],
        ralo: ["ralo area de servico"],
        torneira: ["torneira tanque"],
        ponto_esgoto: ["ponto esgoto area de servico"]
      },
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 2, dedicatedOutletPoints: 1 }),
      hydraulic: hydraulic({
        coldWaterPoints: 2,
        sewagePoints: 2,
        floorDrains: 1,
        fixtures: { tank: 1, washingMachine: 1 }
      })
    },
    garagem: {
      id: "garagem",
      nome: "Garagem",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 1 }),
      hydraulic: hydraulic()
    },
    varanda: {
      id: "varanda",
      nome: "Varanda",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 1 }),
      hydraulic: hydraulic()
    },
    circulacao: {
      id: "circulacao",
      nome: "Corredor/circulacao",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1 }),
      hydraulic: hydraulic()
    },
    escritorio: {
      id: "escritorio",
      nome: "Escritorio",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 1, generalOutletPoints: 5, specialPoints: 1 }),
      hydraulic: hydraulic()
    },
    escada: {
      id: "escada",
      nome: "Escada",
      obrigatorios: [],
      condicionais: [],
      termosBusca: {},
      electrical: electrical({ lightingPoints: 1, switchPoints: 2 }),
      hydraulic: hydraulic()
    }
  };

  const ROOM_ALIASES = {
    area_de_servico: "area_servico",
    lavanderia: "area_servico",
    corredor: "circulacao",
    circulacao: "circulacao",
    circulacao_interna: "circulacao",
    dormitorio: "quarto",
    suite: "quarto",
    estar: "sala",
    sala_de_estar: "sala",
    home_office: "escritorio"
  };

  const PATTERNS = {
    vaso: /\b(vaso|bacia sanitaria|bacia sanit[aÃ¡]ria)\b/,
    lavatorio: /\b(lavatorio|lavat[oÃ³]rio|cuba banheiro|pia banheiro)\b/,
    chuveiro: /\b(chuveiro|ducha)\b/,
    ralo: /\b(ralo)\b/,
    caixa_sifonada: /\b(caixa sifonada)\b/,
    ponto_agua: /\b(ponto de agua|ponto de [aÃ¡]gua|agua fria|[aÃ¡]gua fria|tubulacao agua|tubula[cÃ§][aÃ£]o [aÃ¡]gua)\b/,
    ponto_esgoto: /\b(ponto de esgoto|esgoto|tubo esgoto|tubulacao esgoto)\b/,
    registro: /\b(registro)\b/,
    impermeabilizacao: /\b(impermeabilizacao|impermeabiliza[cç][aã]o|impermeabilizar|argamassa polimerica)\b/,
    piso: /\b(piso|porcelanato|ceramico|cer[aÃ¢]mica)\b/,
    revestimento_parede: /\b(revestimento de parede|revestimento parede|azulejo)\b/,
    box: /\b(box)\b/,
    pia_cuba: /\b(pia|cuba)\b/,
    torneira: /\b(torneira)\b/,
    revestimento_area_molhada: /\b(revestimento|area molhada|[aÃ¡]rea molhada|azulejo)\b/,
    bancada: /\b(bancada)\b/,
    tanque: /\b(tanque)\b/,
    ponto_maquina: /\b(maquina de lavar|m[aÃ¡]quina de lavar|ponto maquina|ponto m[aÃ¡]quina)\b/
  };

  function canonicalRoomType(roomType) {
    const normalized = normalize(roomType).replace(/\s+/g, "_");
    return ROOM_ALIASES[normalized] || normalized;
  }

  function getRequirement(roomType) {
    return REQUIREMENTS[canonicalRoomType(roomType)] || null;
  }

  function getRoomTechnicalRequirements(roomType) {
    const requirement = getRequirement(roomType);
    if (!requirement) {
      return {
        roomType: roomType || "nao_classificado",
        electrical: electrical(),
        hydraulic: hydraulic(),
        assumptions: [],
        warnings: ["Ambiente sem regra tecnica cadastrada: " + (roomType || "nao_classificado")]
      };
    }
    return {
      roomType: requirement.id,
      nome: requirement.nome,
      electrical: clone(requirement.electrical || electrical()),
      hydraulic: clone(requirement.hydraulic || hydraulic()),
      assumptions: ["Agua quente considerada zero por padrao."],
      warnings: []
    };
  }

  function addElectricalTotals(totals, electricalRequirements) {
    Object.keys(ZERO_ELECTRICAL).forEach(function (key) {
      totals[key] += Number(electricalRequirements[key] || 0);
    });
  }

  function addHydraulicTotals(totals, hydraulicRequirements) {
    ["coldWaterPoints", "hotWaterPoints", "sewagePoints", "floorDrains"].forEach(function (key) {
      totals[key] += Number(hydraulicRequirements[key] || 0);
    });
    Object.keys(hydraulicRequirements.fixtures || {}).forEach(function (fixture) {
      totals.fixtures[fixture] = (totals.fixtures[fixture] || 0) + Number(hydraulicRequirements.fixtures[fixture] || 0);
    });
  }

  function buildTotals(rooms) {
    const totals = {
      electrical: electrical(),
      hydraulic: hydraulic()
    };
    rooms.forEach(function (room) {
      addElectricalTotals(totals.electrical, room.electrical || electrical());
      addHydraulicTotals(totals.hydraulic, room.hydraulic || hydraulic());
    });
    return totals;
  }

  function hasItem(room, item) {
    const items = room.items || room.itens || {};
    if (items[item] === true || items[normalize(item)] === true) return true;
    const text = normalize([room.text, room.description, room.descricao, room.name, room.nome].join(" "));
    const pattern = PATTERNS[item];
    return pattern ? pattern.test(text) : false;
  }

  function conditionApplies(room, condition) {
    const text = normalize([room.text, room.description, room.descricao, room.name, room.nome].join(" "));
    if (condition.when === "box_especificado") return /\bbox\b/.test(text) || room.box === true;
    if (condition.when === "bancada_especificada") return /\bbancada\b/.test(text) || room.bancada === true;
    return false;
  }

  function validateRoom(room) {
    const safe = room || {};
    const type = safe.type || safe.tipo || safe.roomType || safe.ambiente || "";
    const requirement = getRequirement(type);
    if (!requirement) {
      const unknownTechnical = getRoomTechnicalRequirements(type);
      return {
        roomType: type || "nao_classificado",
        status: "sem_regra",
        encontrados: [],
        pendentes: [],
        bloqueadores: [],
        termosBuscaPorItem: {},
        electrical: unknownTechnical.electrical,
        hydraulic: unknownTechnical.hydraulic,
        assumptions: unknownTechnical.assumptions,
        warnings: unknownTechnical.warnings
      };
    }
    const required = requirement.obrigatorios.slice();
    (requirement.condicionais || []).forEach(function (condition) {
      if (conditionApplies(safe, condition)) required.push(condition.item);
    });
    const encontrados = [];
    const pendentes = [];
    required.forEach(function (item) {
      if (hasItem(safe, item)) encontrados.push(item); else pendentes.push(item);
    });
    return {
      roomType: requirement.id,
      nome: requirement.nome,
      status: pendentes.length ? "blocked" : "complete",
      encontrados: encontrados,
      pendentes: pendentes,
      bloqueadores: pendentes.slice(),
      termosBuscaPorItem: requirement.termosBusca,
      podeFecharAmbiente: pendentes.length === 0,
      electrical: clone(requirement.electrical || electrical()),
      hydraulic: clone(requirement.hydraulic || hydraulic()),
      assumptions: ["Agua quente considerada zero por padrao."],
      warnings: []
    };
  }

  function inferRoomsFromText(text) {
    const normalized = normalize(text);
    const rooms = [];
    if (/\bbanheiro\b/.test(normalized)) rooms.push({ type: "banheiro", text: text });
    if (/\bcozinha\b/.test(normalized)) rooms.push({ type: "cozinha", text: text });
    if (/\barea de servico|lavanderia|tanque\b/.test(normalized)) rooms.push({ type: "area_servico", text: text });
    if (/\bquarto|dormitorio|dormit[oÃ³]rio\b/.test(normalized)) rooms.push({ type: "quarto", text: text });
    if (/\bsala\b/.test(normalized)) rooms.push({ type: "sala", text: text });
    if (/\blavabo\b/.test(normalized)) rooms.push({ type: "lavabo", text: text });
    if (/\bgaragem\b/.test(normalized)) rooms.push({ type: "garagem", text: text });
    if (/\bvaranda\b/.test(normalized)) rooms.push({ type: "varanda", text: text });
    if (/\bcorredor|circulacao|circula[cÃ§][aÃ£]o\b/.test(normalized)) rooms.push({ type: "circulacao", text: text });
    if (/\bescritorio|escrit[oÃ³]rio|home office\b/.test(normalized)) rooms.push({ type: "escritorio", text: text });
    if (/\bescada\b/.test(normalized)) rooms.push({ type: "escada", text: text });
    return rooms;
  }

  function validateRooms(input) {
    const safe = input || {};
    const rooms = (safe.rooms || safe.ambientes || []).slice();
    if (!rooms.length && safe.text) rooms.push.apply(rooms, inferRoomsFromText(safe.text));
    const validations = rooms.map(validateRoom);
    const pendentes = unique(validations.reduce(function (all, item) { return all.concat(item.pendentes || []); }, []));
    const bloqueadores = unique(validations.reduce(function (all, item) { return all.concat(item.bloqueadores || []); }, []));
    const assumptions = unique(validations.reduce(function (all, item) { return all.concat(item.assumptions || []); }, []));
    const warnings = unique(validations.reduce(function (all, item) { return all.concat(item.warnings || []); }, []));
    return {
      version: VERSION,
      rooms: validations,
      totals: buildTotals(validations),
      assumptions: assumptions,
      warnings: warnings,
      pendentes: pendentes,
      bloqueadores: bloqueadores,
      podeFecharAmbientes: bloqueadores.length === 0
    };
  }

  root.EloRoomRequirementsEngine = {
    version: VERSION,
    getRequirement: function (roomType) { return clone(getRequirement(roomType) || null); },
    getRoomTechnicalRequirements: getRoomTechnicalRequirements,
    validateRoom: validateRoom,
    validateRooms: validateRooms
  };
})(typeof window !== "undefined" ? window : globalThis);
