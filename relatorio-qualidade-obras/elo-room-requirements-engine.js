(function (root) {
  "use strict";

  const VERSION = "20260704-elo-room-requirements-v1";

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

  const REQUIREMENTS = {
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
      }
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
      }
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
      }
    }
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

  function getRequirement(roomType) {
    return REQUIREMENTS[normalize(roomType).replace(/\s+/g, "_")] || REQUIREMENTS[normalize(roomType)] || null;
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
      return { roomType: type || "nao_classificado", status: "sem_regra", encontrados: [], pendentes: [], bloqueadores: [], termosBuscaPorItem: {} };
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
      podeFecharAmbiente: pendentes.length === 0
    };
  }

  function inferRoomsFromText(text) {
    const normalized = normalize(text);
    const rooms = [];
    if (/\bbanheiro\b/.test(normalized)) rooms.push({ type: "banheiro", text: text });
    if (/\bcozinha\b/.test(normalized)) rooms.push({ type: "cozinha", text: text });
    if (/\barea de servico|lavanderia|tanque\b/.test(normalized)) rooms.push({ type: "area_servico", text: text });
    return rooms;
  }

  function validateRooms(input) {
    const safe = input || {};
    const rooms = (safe.rooms || safe.ambientes || []).slice();
    if (!rooms.length && safe.text) rooms.push.apply(rooms, inferRoomsFromText(safe.text));
    const validations = rooms.map(validateRoom);
    const pendentes = unique(validations.reduce(function (all, item) { return all.concat(item.pendentes || []); }, []));
    const bloqueadores = unique(validations.reduce(function (all, item) { return all.concat(item.bloqueadores || []); }, []));
    return {
      version: VERSION,
      rooms: validations,
      pendentes: pendentes,
      bloqueadores: bloqueadores,
      podeFecharAmbientes: bloqueadores.length === 0
    };
  }

  root.EloRoomRequirementsEngine = {
    version: VERSION,
    getRequirement: function (roomType) { return JSON.parse(JSON.stringify(getRequirement(roomType) || null)); },
    validateRoom: validateRoom,
    validateRooms: validateRooms
  };
})(typeof window !== "undefined" ? window : globalThis);

