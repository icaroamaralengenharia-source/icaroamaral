(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const SCHEMA = "elo.residential_briefing_complete";
  const BRAZIL_STATES = {
    AC: 1, AL: 1, AP: 1, AM: 1, BA: 1, CE: 1, DF: 1, ES: 1, GO: 1,
    MA: 1, MT: 1, MS: 1, MG: 1, PA: 1, PB: 1, PR: 1, PE: 1, PI: 1,
    RJ: 1, RN: 1, RS: 1, RO: 1, RR: 1, SC: 1, SP: 1, SE: 1, TO: 1
  };
  const SUPPORTED_PRICE_SOURCES = { SINAPI: 1, ORSE: 1 };
  const SAFE_DEFAULTS = [
    "schema",
    "version",
    "project.country",
    "building.useType",
    "rooms",
    "openings.doors",
    "openings.windows",
    "openings.otherOpenings",
    "fixtures.sanitaryFixtures",
    "fixtures.faucetsAndMetals",
    "fixtures.countertops",
    "fixtures.glassItems",
    "fixtures.accessories"
  ];
  const REQUIRED_FIELDS = [
    { id: "project.city", label: "cidade", blocking: true },
    { id: "project.state", label: "UF", blocking: true },
    { id: "project.referenceMonth", label: "mes-base", blocking: true },
    { id: "project.priceSource", label: "fonte de preco", blocking: true },
    { id: "project.priceRegime", label: "regime de preco/desoneracao", blocking: true },
    { id: "site.builtAreaM2", label: "area construida", blocking: true },
    { id: "site.floors", label: "numero de pavimentos", blocking: true },
    { id: "building.constructionStandard", label: "padrao construtivo", blocking: true },
    { id: "building.ceilingHeightM", label: "pe-direito", blocking: true },
    { id: "program", label: "programa de necessidades", blocking: true },
    { id: "building.structuralSystem", label: "estrutura", blocking: true },
    { id: "building.foundationSystem", label: "fundacao", blocking: true },
    { id: "building.roofSystem", label: "cobertura", blocking: true },
    { id: "building.wallSystem", label: "sistema de paredes", blocking: true },
    { id: "finishes.main", label: "acabamentos principais", blocking: true },
    { id: "systems.premises", label: "premissas de instalacoes", blocking: true },
    { id: "costing.bdiPolicy", label: "BDI ou politica explicita de BDI", blocking: true },
    { id: "costing.lossPolicy", label: "perdas ou politica explicita de perdas", blocking: true }
  ];
  const SUPPORTED_FIELDS = [
    "project.name", "project.description", "project.city", "project.state", "project.country",
    "project.referenceMonth", "project.priceSource", "project.priceRegime",
    "site.landAreaM2", "site.builtAreaM2", "site.implantationAreaM2", "site.floors",
    "site.slopeCondition", "site.soilCondition", "site.accessCondition",
    "building.useType", "building.constructionType", "building.constructionStandard",
    "building.ceilingHeightM", "building.structuralSystem", "building.foundationSystem",
    "building.slabSystem", "building.roofSystem", "building.wallSystem",
    "program.bedrooms", "program.suites", "program.bathrooms", "program.livingRooms",
    "program.kitchens", "program.serviceAreas", "program.garages", "program.balconies",
    "program.offices", "program.gourmetAreas", "program.otherRooms",
    "rooms", "openings.doors", "openings.windows", "openings.otherOpenings",
    "finishes.floorDefault", "finishes.wallDefault", "finishes.ceilingDefault",
    "finishes.internalPaintDefault", "finishes.externalPaintDefault",
    "finishes.wetAreaWallHeightM", "finishes.skirtingHeightM",
    "systems.electrical", "systems.hydraulic", "systems.sanitary", "systems.drainage",
    "systems.gas", "systems.airConditioning", "systems.dataAndCommunication",
    "fixtures.sanitaryFixtures", "fixtures.faucetsAndMetals", "fixtures.countertops",
    "fixtures.glassItems", "fixtures.accessories",
    "costing.bdiPercent", "costing.lossPercent", "costing.freightPercent",
    "costing.localAdministrationPercent", "costing.socialChargesRegime",
    "costing.desoneration", "costing.bdiPolicy", "costing.lossPolicy"
  ];
  const ALIASES = {
    "project.name": ["project.name", "name", "nome", "nomeObra", "obra"],
    "project.description": ["project.description", "description", "descricao", "descriÃ§Ã£o"],
    "project.city": ["project.city", "city", "cidade", "municipio", "municÃ­pio"],
    "project.state": ["project.state", "state", "uf", "estado"],
    "project.referenceMonth": ["project.referenceMonth", "referenceMonth", "mesBase", "mÃªs-base", "mes-base", "mesReferencia", "dataBase"],
    "project.priceSource": ["project.priceSource", "priceSource", "fontePreco", "fonte de preco", "fonte de preÃ§o", "basePreco", "base"],
    "project.priceRegime": ["project.priceRegime", "priceRegime", "regimePreco", "regime de preco", "regime de preÃ§o", "desoneracao", "desoneraÃ§Ã£o"],
    "site.landAreaM2": ["site.landAreaM2", "landAreaM2", "areaTerreno", "Ã¡rea do terreno", "area do terreno"],
    "site.builtAreaM2": ["site.builtAreaM2", "builtAreaM2", "builtArea", "areaConstruida", "area construÃ­da", "Ã¡rea construÃ­da", "areaM2"],
    "site.implantationAreaM2": ["site.implantationAreaM2", "implantationAreaM2", "areaImplantacao", "Ã¡rea de implantaÃ§Ã£o"],
    "site.floors": ["site.floors", "floors", "pavimentos", "numeroPavimentos", "nÃºmero de pavimentos", "andares"],
    "site.slopeCondition": ["site.slopeCondition", "slopeCondition", "declividade", "condicaoDeclive"],
    "site.soilCondition": ["site.soilCondition", "soilCondition", "solo", "condicaoSolo"],
    "site.accessCondition": ["site.accessCondition", "accessCondition", "acesso", "condicaoAcesso"],
    "building.constructionType": ["building.constructionType", "constructionType", "tipoConstrucao", "tipo de construcao", "tipo de construÃ§Ã£o"],
    "building.constructionStandard": ["building.constructionStandard", "constructionStandard", "standard", "padrao", "padrÃ£o", "padraoConstrutivo"],
    "building.ceilingHeightM": ["building.ceilingHeightM", "ceilingHeightM", "ceilingHeight", "peDireito", "pÃ©-direito", "pe direito"],
    "building.structuralSystem": ["building.structuralSystem", "structuralSystem", "estrutura", "sistemaEstrutural"],
    "building.foundationSystem": ["building.foundationSystem", "foundationSystem", "fundacao", "fundaÃ§Ã£o", "tipoFundacao"],
    "building.slabSystem": ["building.slabSystem", "slabSystem", "laje", "sistemaLaje"],
    "building.roofSystem": ["building.roofSystem", "roofSystem", "cobertura", "telhado", "tipoCobertura"],
    "building.wallSystem": ["building.wallSystem", "wallSystem", "parede", "paredes", "sistemaParedes"],
    "program.bedrooms": ["program.bedrooms", "bedrooms", "quartos", "dormitorios", "dormitÃ³rios"],
    "program.suites": ["program.suites", "suites", "suÃ­tes"],
    "program.bathrooms": ["program.bathrooms", "bathrooms", "banheiros"],
    "program.livingRooms": ["program.livingRooms", "livingRooms", "salas", "sala"],
    "program.kitchens": ["program.kitchens", "kitchens", "cozinhas", "cozinha"],
    "program.serviceAreas": ["program.serviceAreas", "serviceAreas", "areasServico", "Ã¡reas de serviÃ§o", "areaServico"],
    "program.garages": ["program.garages", "garages", "garagens", "garagem"],
    "program.balconies": ["program.balconies", "balconies", "varandas", "varanda"],
    "program.offices": ["program.offices", "offices", "escritorios", "escritÃ³rios"],
    "program.gourmetAreas": ["program.gourmetAreas", "gourmetAreas", "areaGourmet", "Ã¡rea gourmet"],
    "finishes.floorDefault": ["finishes.floorDefault", "floorDefault", "piso", "pisoDefault", "acabamentoPiso"],
    "finishes.wallDefault": ["finishes.wallDefault", "wallDefault", "paredeAcabamento", "acabamentoParede"],
    "finishes.ceilingDefault": ["finishes.ceilingDefault", "ceilingDefault", "teto", "forro", "acabamentoTeto"],
    "finishes.internalPaintDefault": ["finishes.internalPaintDefault", "internalPaintDefault", "pinturaInterna", "tintaInterna"],
    "finishes.externalPaintDefault": ["finishes.externalPaintDefault", "externalPaintDefault", "pinturaExterna", "tintaExterna"],
    "finishes.wetAreaWallHeightM": ["finishes.wetAreaWallHeightM", "wetAreaWallHeightM", "alturaRevestimentoAreasMolhadas"],
    "finishes.skirtingHeightM": ["finishes.skirtingHeightM", "skirtingHeightM", "alturaRodape"],
    "costing.bdiPercent": ["costing.bdiPercent", "bdiPercent", "bdi"],
    "costing.lossPercent": ["costing.lossPercent", "lossPercent", "perdas", "perdaPercentual"],
    "costing.freightPercent": ["costing.freightPercent", "freightPercent", "frete"],
    "costing.localAdministrationPercent": ["costing.localAdministrationPercent", "localAdministrationPercent", "administracaoLocal"],
    "costing.socialChargesRegime": ["costing.socialChargesRegime", "socialChargesRegime", "encargos", "regimeEncargos"],
    "costing.desoneration": ["costing.desoneration", "desoneration", "desoneracao", "desoneraÃ§Ã£o"],
    "costing.bdiPolicy": ["costing.bdiPolicy", "bdiPolicy", "politicaBdi", "polÃ­tica de bdi"],
    "costing.lossPolicy": ["costing.lossPolicy", "lossPolicy", "politicaPerdas", "polÃ­tica de perdas"]
  };

  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function isPlainObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function normalizeKey(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }
  function normalizePath(value) { return clean(value).split(".").map(normalizeKey).join("."); }
  function emptyToNull(value) {
    if (value === undefined || value === null) return null;
    if (typeof value === "string" && clean(value) === "") return null;
    return value;
  }
  function pushUnique(list, value) { if (value && list.indexOf(value) < 0) list.push(value); }
  function addIssue(list, field, message, code) {
    if (!list.some(function (item) { return item.field === field && item.code === code; })) {
      list.push({ field: field, code: code, message: message });
    }
  }
  function addClassification(state, listName, field) { pushUnique(state[listName], field); }
  function markProvided(state, field) { addClassification(state, "providedFields", field); }
  function markDerived(state, field) { addClassification(state, "derivedFields", field); }
  function markDefaulted(state, field) { addClassification(state, "defaultedFields", field); }
  function markMissing(state, field) { addClassification(state, "missingFields", field); }
  function markBlocking(state, field) { addClassification(state, "blockingFields", field); }
  function markInvalid(state, field, message) {
    addClassification(state, "invalidFields", field);
    addIssue(state.errors, field, message, "invalid");
  }
  function createIndex(input) {
    const index = {};
    function add(key, path, value) {
      const normalized = normalizeKey(key);
      if (normalized && index[normalized] === undefined) index[normalized] = { value: value, path: path };
      const normalizedPath = normalizePath(path);
      if (normalizedPath && index[normalizedPath] === undefined) index[normalizedPath] = { value: value, path: path };
    }
    function walk(value, path) {
      if (!isPlainObject(value)) return;
      Object.keys(value).forEach(function (key) {
        const childPath = path ? path + "." + key : key;
        const child = value[key];
        add(key, childPath, child);
        if (isPlainObject(child)) walk(child, childPath);
      });
    }
    walk(input || {}, "");
    return index;
  }
  function readValue(input, index, field) {
    const aliases = ALIASES[field] || [field];
    for (let i = 0; i < aliases.length; i += 1) {
      const alias = aliases[i];
      const pathValue = readPath(input, alias);
      if (pathValue !== undefined) return { found: true, value: pathValue, sourcePath: alias };
      const byPath = index[normalizePath(alias)];
      if (byPath) return { found: true, value: byPath.value, sourcePath: byPath.path };
      const byKey = index[normalizeKey(alias)];
      if (byKey) return { found: true, value: byKey.value, sourcePath: byKey.path };
    }
    return { found: false, value: null, sourcePath: "" };
  }
  function readPath(input, path) {
    const parts = clean(path).split(".");
    let current = input;
    for (let i = 0; i < parts.length; i += 1) {
      if (!isPlainObject(current) || !Object.prototype.hasOwnProperty.call(current, parts[i])) return undefined;
      current = current[parts[i]];
    }
    return current;
  }
  function parseNumber(value) {
    value = emptyToNull(value);
    if (value === null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const normalized = clean(value)
      .replace(/\s/g, "")
      .replace(/m2|mÂ²|m3|mÂ³|m|%/gi, "")
      .replace(/\.(?=\d{3}(?:\D|$))/g, "")
      .replace(",", ".");
    const numericText = normalized.match(/^-?\d+(?:\.\d+)?/);
    const parsed = Number(numericText ? numericText[0] : normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function parseInteger(value) {
    const number = parseNumber(value);
    return number === null ? null : Math.trunc(number);
  }
  function parsePercent(value) {
    const number = parseNumber(value);
    return number === null ? null : number;
  }
  function normalizeString(value) {
    value = emptyToNull(value);
    return value === null ? null : clean(value);
  }
  function normalizeCity(value) {
    const text = normalizeString(value);
    if (!text) return null;
    return text.toLowerCase().replace(/(^|\s|-)([a-z\u00c0-\u017f])/g, function (_, prefix, char) {
      return prefix + char.toUpperCase();
    });
  }
  function normalizeState(value) {
    const text = normalizeString(value);
    if (!text) return null;
    return clean(text).slice(0, 2).toUpperCase();
  }
  function normalizePriceSource(value) {
    const text = normalizeString(value);
    if (!text) return null;
    const upper = text.toUpperCase();
    if (upper.indexOf("SINAPI") >= 0) return "SINAPI";
    if (upper.indexOf("ORSE") >= 0) return "ORSE";
    return upper;
  }
  function normalizeBoolean(value) {
    if (value === true || value === false) return value;
    const text = normalizeKey(value);
    if (/^(sim|yes|true|1|com|desonerado)$/.test(text)) return true;
    if (/^(nao|no|false|0|sem|naodesonerado)$/.test(text)) return false;
    return value;
  }
  function normalizeMonth(value) {
    const text = normalizeString(value);
    if (!text) return null;
    let match = text.match(/^(\d{4})[-/](\d{1,2})$/);
    if (match) return match[1] + "-" + String(Number(match[2])).padStart(2, "0");
    match = text.match(/^(\d{1,2})[-/](\d{4})$/);
    if (match) return match[2] + "-" + String(Number(match[1])).padStart(2, "0");
    return text;
  }
  function normalizeArray(value) {
    if (Array.isArray(value)) return clone(value);
    if (value === undefined || value === null || value === "") return [];
    return [clone(value)];
  }
  function normalizeObject(value) { return isPlainObject(value) ? clone(value) : {}; }
  function valueAt(output, field) {
    const parts = field.split(".");
    let current = output;
    for (let i = 0; i < parts.length; i += 1) {
      if (!current) return null;
      current = current[parts[i]];
    }
    return current;
  }
  function setFromInput(input, index, state, target, key, field, normalizer) {
    const found = readValue(input, index, field);
    if (!found.found) {
      target[key] = null;
      return null;
    }
    const normalized = normalizer ? normalizer(found.value) : emptyToNull(found.value);
    target[key] = normalized;
    if (normalized !== null && normalized !== undefined && !(Array.isArray(normalized) && !normalized.length)) markProvided(state, field);
    return normalized;
  }
  function normalizeOpening(raw, state, basePath, index) {
    const source = isPlainObject(raw) ? raw : {};
    const sourceIndex = createIndex(source);
    const width = readValue(source, sourceIndex, "widthM").found ? parseNumber(readValue(source, sourceIndex, "widthM").value) : parseNumber(source.widthM || source.width || source.larguraM || source.largura);
    const height = readValue(source, sourceIndex, "heightM").found ? parseNumber(readValue(source, sourceIndex, "heightM").value) : parseNumber(source.heightM || source.height || source.alturaM || source.altura);
    const quantity = parseInteger(source.quantity || source.quantidade || 1) || 1;
    const item = {
      id: normalizeString(source.id) || basePath.replace(/\./g, "_") + "_" + (index + 1),
      type: normalizeString(source.type || source.tipo) || null,
      quantity: quantity,
      widthM: width,
      heightM: height
    };
    if (width !== null && width <= 0) markInvalid(state, basePath + "." + index + ".widthM", "A largura da abertura deve ser positiva.");
    if (height !== null && height <= 0) markInvalid(state, basePath + "." + index + ".heightM", "A altura da abertura deve ser positiva.");
    if (quantity < 1) markInvalid(state, basePath + "." + index + ".quantity", "A quantidade da abertura deve ser maior que zero.");
    return item;
  }
  function normalizeRoom(raw, state, usedIds, index) {
    const source = isPlainObject(raw) ? raw : {};
    const width = parseNumber(source.widthM || source.width || source.larguraM || source.largura);
    const length = parseNumber(source.lengthM || source.length || source.comprimentoM || source.comprimento);
    let area = parseNumber(source.areaM2 || source.area || source.area_m2);
    let perimeter = parseNumber(source.perimeterM || source.perimeter || source.perimetroM || source.perimetro);
    const floor = parseInteger(source.floor || source.pavimento || 1) || 1;
    const quantity = parseInteger(source.quantity || source.quantidade || 1) || 1;
    const name = normalizeString(source.name || source.nome || source.type || source.tipo) || "Ambiente " + (index + 1);
    const type = normalizeString(source.type || source.tipo) || null;
    let id = source.id ? slug(source.id) : slug(name);
    usedIds[id] = (usedIds[id] || 0) + 1;
    if (usedIds[id] > 1) id = id + "-" + usedIds[id];
    if (area === null && width !== null && length !== null && width > 0 && length > 0) {
      area = round(width * length, 3);
      markDerived(state, "rooms." + id + ".areaM2");
    } else if (area !== null) {
      markProvided(state, "rooms." + id + ".areaM2");
    }
    if (perimeter === null && width !== null && length !== null && width > 0 && length > 0) {
      perimeter = round(2 * (width + length), 3);
      markDerived(state, "rooms." + id + ".perimeterM");
    } else if (perimeter !== null) {
      markProvided(state, "rooms." + id + ".perimeterM");
    }
    const roomPath = "rooms." + id;
    if (width !== null) markProvided(state, roomPath + ".widthM");
    if (length !== null) markProvided(state, roomPath + ".lengthM");
    if (width !== null && width <= 0) markInvalid(state, roomPath + ".widthM", "A largura do ambiente deve ser positiva.");
    if (length !== null && length <= 0) markInvalid(state, roomPath + ".lengthM", "O comprimento do ambiente deve ser positivo.");
    if (area !== null && area <= 0) markInvalid(state, roomPath + ".areaM2", "A area do ambiente deve ser positiva.");
    if (perimeter !== null && perimeter <= 0) markInvalid(state, roomPath + ".perimeterM", "O perimetro do ambiente deve ser positivo.");
    if (floor < 1) markInvalid(state, roomPath + ".floor", "O pavimento do ambiente deve ser maior ou igual a 1.");
    if (quantity < 1) markInvalid(state, roomPath + ".quantity", "A quantidade do ambiente deve ser maior que zero.");
    const openings = normalizeObject(source.openings || source.aberturas);
    return {
      id: id,
      name: name,
      type: type,
      floor: floor,
      quantity: quantity,
      widthM: width,
      lengthM: length,
      areaM2: area,
      perimeterM: perimeter,
      ceilingHeightM: parseNumber(source.ceilingHeightM || source.peDireito),
      openings: {
        doors: normalizeArray(openings.doors || openings.portas || source.doors || source.portas).map(function (entry, doorIndex) { return normalizeOpening(entry, state, roomPath + ".openings.doors", doorIndex); }),
        windows: normalizeArray(openings.windows || openings.janelas || source.windows || source.janelas).map(function (entry, windowIndex) { return normalizeOpening(entry, state, roomPath + ".openings.windows", windowIndex); })
      },
      finishes: Object.assign({ floor: null, walls: null, ceiling: null, paint: null, wallFinishHeightM: null }, normalizeObject(source.finishes || source.acabamentos)),
      systems: Object.assign({ electricalPoints: null, hydraulicPoints: null, sanitaryPoints: null, drainPoints: null }, normalizeObject(source.systems || source.instalacoes)),
      source: area !== null && state.derivedFields.indexOf(roomPath + ".areaM2") >= 0 ? "derived" : "provided"
    };
  }
  function slug(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .replace(/(.{32}).+/, "$1")
      .replace(/-+$/g, "") || "item";
  }
  function round(value, digits) {
    const factor = Math.pow(10, digits || 2);
    return Math.round(Number(value || 0) * factor) / factor;
  }
  function normalizeRooms(input, state) {
    const roomsInput = input.rooms || input.ambientes || [];
    const rooms = normalizeArray(roomsInput);
    if (!rooms.length) markDefaulted(state, "rooms");
    const usedIds = {};
    return rooms.map(function (room, index) { return normalizeRoom(room, state, usedIds, index); });
  }
  function normalizeOpenings(input, state) {
    const raw = normalizeObject(input.openings || input.aberturas);
    const doors = normalizeArray(raw.doors || raw.portas || input.doors || input.portas);
    const windows = normalizeArray(raw.windows || raw.janelas || input.windows || input.janelas);
    const other = normalizeArray(raw.otherOpenings || raw.outrasAberturas || input.otherOpenings);
    if (!doors.length) markDefaulted(state, "openings.doors");
    if (!windows.length) markDefaulted(state, "openings.windows");
    if (!other.length) markDefaulted(state, "openings.otherOpenings");
    return {
      doors: doors.map(function (entry, index) { return normalizeOpening(entry, state, "openings.doors", index); }),
      windows: windows.map(function (entry, index) { return normalizeOpening(entry, state, "openings.windows", index); }),
      otherOpenings: other.map(function (entry) { return clone(entry); })
    };
  }
  function normalizeProgram(input, index, state) {
    const program = {};
    ["bedrooms", "suites", "bathrooms", "livingRooms", "kitchens", "serviceAreas", "garages", "balconies", "offices", "gourmetAreas"].forEach(function (key) {
      const field = "program." + key;
      const read = readValue(input, index, field);
      const value = read.found ? parseInteger(read.value) : null;
      program[key] = value;
      if (value !== null) markProvided(state, field);
      if (value !== null && value < 0) markInvalid(state, field, "Quantidade de ambientes deve ser inteiro nao negativo.");
    });
    const otherRooms = readValue(input, index, "program.otherRooms");
    program.otherRooms = otherRooms.found ? normalizeArray(otherRooms.value) : [];
    if (!program.otherRooms.length) markDefaulted(state, "program.otherRooms");
    return program;
  }
  function hasProgram(program, rooms) {
    const keys = ["bedrooms", "suites", "bathrooms", "livingRooms", "kitchens", "serviceAreas", "garages", "balconies", "offices", "gourmetAreas"];
    return keys.some(function (key) { return Number(program[key] || 0) > 0; }) || (program.otherRooms || []).length > 0 || (rooms || []).length > 0;
  }
  function hasMainFinishes(finishes) {
    return !!(finishes.floorDefault && finishes.wallDefault && finishes.ceilingDefault && (finishes.internalPaintDefault || finishes.externalPaintDefault));
  }
  function nonEmptyObject(value) { return isPlainObject(value) && Object.keys(value).length > 0; }
  function hasSystemPremises(systems) {
    return nonEmptyObject(systems.electrical) && nonEmptyObject(systems.hydraulic) && nonEmptyObject(systems.sanitary);
  }
  function hasBdiPolicy(costing) { return costing.bdiPercent !== null || !!costing.bdiPolicy; }
  function hasLossPolicy(costing) { return costing.lossPercent !== null || !!costing.lossPolicy; }
  function buildCanonical(input, context) {
    const source = clone(input || {});
    const ctx = context || {};
    const index = createIndex(source);
    const state = {
      providedFields: [],
      derivedFields: [],
      defaultedFields: [],
      missingFields: [],
      blockingFields: [],
      invalidFields: [],
      warnings: [],
      errors: []
    };
    const out = {
      schema: SCHEMA,
      version: VERSION,
      status: "incomplete",
      project: { name: null, description: null, city: null, state: null, country: "BR", referenceMonth: null, priceSource: null, priceRegime: null },
      site: { landAreaM2: null, builtAreaM2: null, implantationAreaM2: null, floors: null, slopeCondition: null, soilCondition: null, accessCondition: null },
      building: { useType: "residential", constructionType: null, constructionStandard: null, ceilingHeightM: null, structuralSystem: null, foundationSystem: null, slabSystem: null, roofSystem: null, wallSystem: null },
      program: null,
      rooms: [],
      openings: null,
      finishes: { floorDefault: null, wallDefault: null, ceilingDefault: null, internalPaintDefault: null, externalPaintDefault: null, wetAreaWallHeightM: null, skirtingHeightM: null },
      systems: { electrical: {}, hydraulic: {}, sanitary: {}, drainage: {}, gas: {}, airConditioning: {}, dataAndCommunication: {} },
      fixtures: { sanitaryFixtures: [], faucetsAndMetals: [], countertops: [], glassItems: [], accessories: [] },
      costing: { bdiPercent: null, lossPercent: null, freightPercent: null, localAdministrationPercent: null, socialChargesRegime: null, desoneration: null },
      assumptions: [],
      providedFields: state.providedFields,
      derivedFields: state.derivedFields,
      defaultedFields: state.defaultedFields,
      missingFields: state.missingFields,
      blockingFields: state.blockingFields,
      warnings: state.warnings,
      errors: state.errors,
      invalidFields: state.invalidFields,
      completeness: { score: 0, requiredCount: REQUIRED_FIELDS.length, providedRequiredCount: 0, missingRequiredCount: 0 },
      audit: { generatedAt: new Date().toISOString(), source: normalizeString(ctx.source) || null, inputFingerprint: null }
    };
    SAFE_DEFAULTS.forEach(function (field) { markDefaulted(state, field); });
    setFromInput(source, index, state, out.project, "name", "project.name", normalizeString);
    setFromInput(source, index, state, out.project, "description", "project.description", normalizeString);
    setFromInput(source, index, state, out.project, "city", "project.city", normalizeCity);
    setFromInput(source, index, state, out.project, "state", "project.state", normalizeState);
    setFromInput(source, index, state, out.project, "referenceMonth", "project.referenceMonth", normalizeMonth);
    setFromInput(source, index, state, out.project, "priceSource", "project.priceSource", normalizePriceSource);
    setFromInput(source, index, state, out.project, "priceRegime", "project.priceRegime", function (value) { return normalizeString(normalizeBoolean(value)); });
    setFromInput(source, index, state, out.site, "landAreaM2", "site.landAreaM2", parseNumber);
    setFromInput(source, index, state, out.site, "builtAreaM2", "site.builtAreaM2", parseNumber);
    setFromInput(source, index, state, out.site, "implantationAreaM2", "site.implantationAreaM2", parseNumber);
    setFromInput(source, index, state, out.site, "floors", "site.floors", parseInteger);
    setFromInput(source, index, state, out.site, "slopeCondition", "site.slopeCondition", normalizeString);
    setFromInput(source, index, state, out.site, "soilCondition", "site.soilCondition", normalizeString);
    setFromInput(source, index, state, out.site, "accessCondition", "site.accessCondition", normalizeString);
    setFromInput(source, index, state, out.building, "constructionType", "building.constructionType", normalizeString);
    setFromInput(source, index, state, out.building, "constructionStandard", "building.constructionStandard", normalizeString);
    setFromInput(source, index, state, out.building, "ceilingHeightM", "building.ceilingHeightM", parseNumber);
    setFromInput(source, index, state, out.building, "structuralSystem", "building.structuralSystem", normalizeString);
    setFromInput(source, index, state, out.building, "foundationSystem", "building.foundationSystem", normalizeString);
    setFromInput(source, index, state, out.building, "slabSystem", "building.slabSystem", normalizeString);
    setFromInput(source, index, state, out.building, "roofSystem", "building.roofSystem", normalizeString);
    setFromInput(source, index, state, out.building, "wallSystem", "building.wallSystem", normalizeString);
    out.program = normalizeProgram(source, index, state);
    out.rooms = normalizeRooms(source, state);
    out.openings = normalizeOpenings(source, state);
    ["floorDefault", "wallDefault", "ceilingDefault", "internalPaintDefault", "externalPaintDefault"].forEach(function (key) {
      setFromInput(source, index, state, out.finishes, key, "finishes." + key, normalizeString);
    });
    ["wetAreaWallHeightM", "skirtingHeightM"].forEach(function (key) {
      setFromInput(source, index, state, out.finishes, key, "finishes." + key, parseNumber);
    });
    const systems = normalizeObject(source.systems || source.instalacoes);
    ["electrical", "hydraulic", "sanitary", "drainage", "gas", "airConditioning", "dataAndCommunication"].forEach(function (key) {
      const value = systems[key] || systems[systemPortugueseKey(key)];
      out.systems[key] = normalizeObject(value);
      if (nonEmptyObject(out.systems[key])) markProvided(state, "systems." + key);
    });
    const fixtures = normalizeObject(source.fixtures || source.pecas || source.loucasMetais);
    out.fixtures.sanitaryFixtures = normalizeArray(fixtures.sanitaryFixtures || fixtures.loucas || fixtures.pecasSanitarias);
    out.fixtures.faucetsAndMetals = normalizeArray(fixtures.faucetsAndMetals || fixtures.metais);
    out.fixtures.countertops = normalizeArray(fixtures.countertops || fixtures.bancadas);
    out.fixtures.glassItems = normalizeArray(fixtures.glassItems || fixtures.vidros);
    out.fixtures.accessories = normalizeArray(fixtures.accessories || fixtures.acessorios);
    ["bdiPercent", "lossPercent", "freightPercent", "localAdministrationPercent"].forEach(function (key) {
      setFromInput(source, index, state, out.costing, key, "costing." + key, parsePercent);
    });
    setFromInput(source, index, state, out.costing, "socialChargesRegime", "costing.socialChargesRegime", normalizeString);
    setFromInput(source, index, state, out.costing, "desoneration", "costing.desoneration", function (value) { return normalizeBoolean(value); });
    const bdiPolicy = readValue(source, index, "costing.bdiPolicy");
    const lossPolicy = readValue(source, index, "costing.lossPolicy");
    if (bdiPolicy.found) { out.costing.bdiPolicy = normalizeString(bdiPolicy.value); markProvided(state, "costing.bdiPolicy"); }
    if (lossPolicy.found) { out.costing.lossPolicy = normalizeString(lossPolicy.value); markProvided(state, "costing.lossPolicy"); }
    out.assumptions = normalizeArray(source.assumptions || source.premissas);
    validateCanonical(out, state);
    applyRequiredFields(out, state);
    out.completeness = buildCompleteness(out, state);
    out.status = state.errors.length ? "invalid" : (state.blockingFields.length ? "incomplete" : "complete");
    out.audit.inputFingerprint = fingerprint(out);
    return out;
  }
  function systemPortugueseKey(key) {
    return {
      electrical: "eletrica",
      hydraulic: "hidraulica",
      sanitary: "sanitaria",
      drainage: "drenagem",
      gas: "gas",
      airConditioning: "arCondicionado",
      dataAndCommunication: "dadosComunicacao"
    }[key] || key;
  }
  function validateCanonical(out, state) {
    if (out.project.state && !BRAZIL_STATES[out.project.state]) markInvalid(state, "project.state", "UF brasileira invalida.");
    if (out.project.referenceMonth && !isValidMonth(out.project.referenceMonth)) markInvalid(state, "project.referenceMonth", "Mes-base deve estar no formato YYYY-MM valido.");
    if (out.project.priceSource && !SUPPORTED_PRICE_SOURCES[out.project.priceSource]) markInvalid(state, "project.priceSource", "Fonte de preco suportada: SINAPI ou ORSE.");
    if (out.site.builtAreaM2 !== null && out.site.builtAreaM2 <= 0) markInvalid(state, "site.builtAreaM2", "Area construida deve ser maior que zero.");
    if (out.site.landAreaM2 !== null && out.site.landAreaM2 <= 0) markInvalid(state, "site.landAreaM2", "Area do terreno deve ser maior que zero.");
    if (out.site.landAreaM2 > 0 && out.site.builtAreaM2 > out.site.landAreaM2 * Math.max(1, out.site.floors || 1) * 1.2) {
      addIssue(state.warnings, "site.builtAreaM2", "Area construida parece incompatÃ­vel com o terreno informado.", "area_incompatibility");
    }
    if (out.site.floors !== null && out.site.floors < 1) markInvalid(state, "site.floors", "Pavimentos deve ser inteiro maior ou igual a 1.");
    if (out.building.ceilingHeightM !== null && (out.building.ceilingHeightM < 2.2 || out.building.ceilingHeightM > 6)) {
      markInvalid(state, "building.ceilingHeightM", "Pe-direito fora de faixa tecnica plausivel.");
    }
    ["bdiPercent", "lossPercent", "freightPercent", "localAdministrationPercent"].forEach(function (key) {
      const value = out.costing[key];
      if (value !== null && (value < 0 || value > 100)) markInvalid(state, "costing." + key, "Percentual deve estar entre 0 e 100.");
    });
    Object.keys(out.program).forEach(function (key) {
      if (key === "otherRooms") return;
      const value = out.program[key];
      if (value !== null && (!Number.isInteger(value) || value < 0)) markInvalid(state, "program." + key, "Quantidade de ambientes deve ser inteiro nao negativo.");
    });
    if (out.program.suites !== null && out.program.bedrooms !== null && out.program.suites > out.program.bedrooms) {
      addIssue(state.warnings, "program.suites", "Suites maior que quartos; confirme o programa de necessidades.", "suite_greater_than_bedrooms");
    }
    if (out.site.floors && out.site.floors > 1 && out.building.roofSystem && /terrea|tÃ©rrea/.test(String(out.building.roofSystem).toLowerCase())) {
      addIssue(state.warnings, "building.roofSystem", "Cobertura informada pode estar incoerente com mais de um pavimento.", "roof_floor_coherence");
    }
  }
  function isValidMonth(value) {
    const match = clean(value).match(/^(\d{4})-(\d{2})$/);
    if (!match) return false;
    const month = Number(match[2]);
    return month >= 1 && month <= 12;
  }
  function requiredSatisfied(out, id) {
    if (id === "program") return hasProgram(out.program, out.rooms);
    if (id === "finishes.main") return hasMainFinishes(out.finishes);
    if (id === "systems.premises") return hasSystemPremises(out.systems);
    if (id === "costing.bdiPolicy") return hasBdiPolicy(out.costing);
    if (id === "costing.lossPolicy") return hasLossPolicy(out.costing);
    const value = valueAt(out, id);
    return value !== null && value !== undefined && value !== "";
  }
  function applyRequiredFields(out, state) {
    REQUIRED_FIELDS.forEach(function (field) {
      if (!requiredSatisfied(out, field.id)) {
        markMissing(state, field.id);
        if (field.blocking) markBlocking(state, field.id);
      }
    });
  }
  function buildCompleteness(out, state) {
    const provided = REQUIRED_FIELDS.filter(function (field) {
      if (!requiredSatisfied(out, field.id)) return false;
      if (state.defaultedFields.indexOf(field.id) >= 0) return false;
      return true;
    }).length;
    const missing = REQUIRED_FIELDS.length - provided;
    return {
      score: REQUIRED_FIELDS.length ? Math.round((provided / REQUIRED_FIELDS.length) * 100) : 100,
      requiredCount: REQUIRED_FIELDS.length,
      providedRequiredCount: provided,
      missingRequiredCount: missing
    };
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (isPlainObject(value)) {
      const out = {};
      Object.keys(value).sort().forEach(function (key) {
        if (key === "generatedAt") return;
        out[key] = stable(value[key]);
      });
      return out;
    }
    return value;
  }
  function fingerprint(out) {
    const relevant = {
      schema: out.schema,
      version: out.version,
      project: out.project,
      site: out.site,
      building: out.building,
      program: out.program,
      rooms: out.rooms,
      openings: out.openings,
      finishes: out.finishes,
      systems: out.systems,
      fixtures: out.fixtures,
      costing: out.costing,
      assumptions: out.assumptions
    };
    return "fp_" + hash(JSON.stringify(stable(relevant)));
  }
  function hash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      h ^= text.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return (h >>> 0).toString(16);
  }
  function normalize(input, context) { return buildCanonical(input, context); }
  function validate(input, context) {
    const built = buildCanonical(input, context);
    return {
      status: built.status,
      valid: built.status !== "invalid",
      complete: built.status === "complete",
      missingFields: built.missingFields.slice(),
      blockingFields: built.blockingFields.slice(),
      warnings: clone(built.warnings),
      errors: clone(built.errors),
      completeness: clone(built.completeness)
    };
  }
  function build(input, context) { return buildCanonical(input, context); }
  function getRequiredFields() { return clone(REQUIRED_FIELDS); }
  function getSupportedFields() { return SUPPORTED_FIELDS.slice(); }
  function getVersion() { return VERSION; }

  root.ResidentialBriefingCompleteEngine = {
    getVersion: getVersion,
    getRequiredFields: getRequiredFields,
    getSupportedFields: getSupportedFields,
    normalize: normalize,
    validate: validate,
    build: build
  };
  root.EloResidentialBriefingCompleteEngine = root.ResidentialBriefingCompleteEngine;
})(typeof window !== "undefined" ? window : globalThis);
