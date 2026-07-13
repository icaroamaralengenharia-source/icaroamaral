(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_briefing_complete";
  const OUTPUT_SCHEMA = "elo.residential_geometry_model";
  const REQUIRED_GEOMETRY = [
    "site.builtAreaM2",
    "site.floors",
    "rooms.areaOrDimensions",
    "rooms.perimeterOrDimensions",
    "rooms.height",
    "rooms.floor",
    "openings.dimensions",
    "openings.roomBinding"
  ];

  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function round(value, digits) {
    const factor = Math.pow(10, digits == null ? 3 : digits);
    return Math.round(Number(value || 0) * factor) / factor;
  }
  function number(value) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const text = clean(value).replace(/\s/g, "").replace(/m2|mÂ²|m3|mÂ³|m|%/gi, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
    const match = text.match(/^-?\d+(?:\.\d+)?/);
    const parsed = Number(match ? match[0] : text);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function integer(value) {
    const parsed = number(value);
    return parsed === null ? null : Math.trunc(parsed);
  }
  function bool(value) {
    if (value === true || value === false) return value;
    const text = clean(value).toLowerCase();
    if (["true", "sim", "yes", "externa", "external"].indexOf(text) >= 0) return true;
    if (["false", "nao", "nÃ£o", "no", "interna", "internal"].indexOf(text) >= 0) return false;
    return false;
  }
  function normalizeKey(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }
  function pushUnique(list, value) {
    if (value && list.indexOf(value) < 0) list.push(value);
  }
  function issue(list, field, message, code) {
    if (!list.some(function (item) { return item.field === field && item.code === code; })) {
      list.push({ field: field, code: code, message: message });
    }
  }
  function mark(state, list, field) { pushUnique(state[list], field); }
  function warn(state, field, message, code) {
    mark(state, "warningsFields", field);
    issue(state.warnings, field, message, code || "warning");
  }
  function error(state, field, message, code) {
    mark(state, "invalidFields", field);
    issue(state.errors, field, message, code || "invalid");
  }
  function block(state, field, message) {
    mark(state, "blockingFields", field);
    issue(state.warnings, field, message || "Campo geometrico pendente.", "blocking");
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (isObject(value)) {
      return Object.keys(value).sort().reduce(function (acc, key) {
        if (key !== "generatedAt") acc[key] = stable(value[key]);
        return acc;
      }, {});
    }
    return value;
  }
  function fingerprint(value) {
    const text = JSON.stringify(stable(value));
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return "fp_" + (hash >>> 0).toString(16).padStart(8, "0");
  }
  function ratioDifference(provided, derived) {
    if (provided === null || derived === null || provided === 0) return 0;
    return Math.abs(provided - derived) / Math.abs(provided);
  }
  function compareProvidedDerived(state, field, provided, derived) {
    const diff = ratioDifference(provided, derived);
    if (diff > 0.10) error(state, field, "Valor informado diverge mais de 10% do valor derivado.", "geometry_divergence_error");
    else if (diff > 0.02) warn(state, field, "Valor informado diverge mais de 2% do valor derivado.", "geometry_divergence_warning");
  }
  function makeState() {
    return {
      providedFields: [],
      derivedFields: [],
      defaultedFields: [],
      missingFields: [],
      blockingFields: [],
      invalidFields: [],
      warningsFields: [],
      warnings: [],
      errors: []
    };
  }
  function emptyModel(context) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      sourceBriefing: { schema: null, version: null, fingerprint: null },
      site: {
        landAreaM2: null,
        implantationAreaM2: null,
        freeAreaM2: null,
        occupancyRatePercent: null,
        builtAreaM2: null,
        totalFloorAreaM2: null,
        slopeCondition: null,
        soilCondition: null,
        accessCondition: null
      },
      building: {
        floorsCount: null,
        totalBuiltAreaM2: null,
        totalPerimeterM: null,
        totalInternalAreaM2: null,
        totalExternalWallGrossAreaM2: null,
        totalInternalWallGrossAreaM2: null,
        totalCeilingAreaM2: null,
        totalFloorAreaM2: null,
        totalOpeningAreaM2: null,
        averageCeilingHeightM: null
      },
      floors: [],
      rooms: [],
      openings: { doors: [], windows: [], otherOpenings: [], totalAreaM2: 0 },
      surfaces: {
        floorAreaM2: 0,
        ceilingAreaM2: 0,
        internalWallGrossAreaM2: 0,
        internalWallNetAreaM2: 0,
        externalWallGrossAreaM2: 0,
        externalWallNetAreaM2: 0,
        openingAreaM2: 0
      },
      adjacency: { relations: [], unresolved: [] },
      providedFields: [],
      derivedFields: [],
      defaultedFields: [],
      missingFields: [],
      blockingFields: [],
      warnings: [],
      errors: [],
      completeness: { score: 0, requiredCount: REQUIRED_GEOMETRY.length, completeRequiredCount: 0, missingRequiredCount: 0 },
      audit: {
        generatedAt: context && context.generatedAt ? context.generatedAt : new Date().toISOString(),
        source: "ResidentialGeometryModelEngine",
        inputFingerprint: null,
        geometryFingerprint: null
      }
    };
  }
  function fieldSource(state, field, value, source) {
    if (value === null || value === undefined) return;
    if (source === "provided") mark(state, "providedFields", field);
    if (source === "derived") mark(state, "derivedFields", field);
    if (source === "defaulted") mark(state, "defaultedFields", field);
  }
  function deriveRoomGeometry(room, defaults) {
    const state = defaults && defaults.state ? defaults.state : makeState();
    const floorCount = integer(defaults && defaults.floorsCount);
    const defaultHeight = number(defaults && defaults.ceilingHeightM);
    const id = normalizeKey(room && (room.id || room.name || room.type));
    const quantity = integer(room && (room.quantity == null ? 1 : room.quantity));
    const width = number(room && room.widthM);
    const length = number(room && room.lengthM);
    let area = number(room && room.areaM2);
    let perimeter = number(room && room.perimeterM);
    let height = number(room && (room.ceilingHeightM || room.heightM));
    const floorRaw = integer(room && (room.floor == null ? null : room.floor));
    let floor = floorRaw;
    const source = { area: null, perimeter: null, height: null, volume: null };

    if (floor === null && floorCount === 1) {
      floor = 1;
      source.floor = "defaulted";
      mark(state, "defaultedFields", "rooms." + id + ".floor");
    }
    if (height === null && defaultHeight !== null) {
      height = defaultHeight;
      source.height = "defaulted";
      mark(state, "defaultedFields", "rooms." + id + ".heightM");
    } else if (height !== null) {
      source.height = "provided";
      mark(state, "providedFields", "rooms." + id + ".heightM");
    }
    if (area === null && width !== null && length !== null && width > 0 && length > 0) {
      area = round(width * length);
      source.area = "derived";
      mark(state, "derivedFields", "rooms." + id + ".areaM2");
    } else if (area !== null) {
      source.area = "provided";
      mark(state, "providedFields", "rooms." + id + ".areaM2");
      if (width !== null && length !== null && width > 0 && length > 0) compareProvidedDerived(state, "rooms." + id + ".areaM2", area, width * length);
    }
    if (perimeter === null && width !== null && length !== null && width > 0 && length > 0) {
      perimeter = round(2 * (width + length));
      source.perimeter = "derived";
      mark(state, "derivedFields", "rooms." + id + ".perimeterM");
    } else if (perimeter !== null) {
      source.perimeter = "provided";
      mark(state, "providedFields", "rooms." + id + ".perimeterM");
      if (width !== null && length !== null && width > 0 && length > 0) compareProvidedDerived(state, "rooms." + id + ".perimeterM", perimeter, 2 * (width + length));
    }

    if (width !== null) mark(state, "providedFields", "rooms." + id + ".widthM");
    if (length !== null) mark(state, "providedFields", "rooms." + id + ".lengthM");
    if (width !== null && width <= 0) error(state, "rooms." + id + ".widthM", "Largura do ambiente deve ser positiva.");
    if (length !== null && length <= 0) error(state, "rooms." + id + ".lengthM", "Comprimento do ambiente deve ser positivo.");
    if (height !== null && height <= 0) error(state, "rooms." + id + ".heightM", "Altura do ambiente deve ser positiva.");
    if (area !== null && area <= 0) error(state, "rooms." + id + ".areaM2", "Area do ambiente deve ser positiva.");
    if (perimeter !== null && perimeter <= 0) error(state, "rooms." + id + ".perimeterM", "Perimetro do ambiente deve ser positivo.");
    if (quantity === null || quantity < 1) error(state, "rooms." + id + ".quantity", "Quantidade do ambiente deve ser positiva.");
    if (floor === null) block(state, "rooms." + id + ".floor", "Pavimento do ambiente ausente.");
    if (floor !== null && floor < 1) error(state, "rooms." + id + ".floor", "Pavimento do ambiente deve ser positivo.");
    if (floor !== null && floorCount !== null && floor > floorCount) error(state, "rooms." + id + ".floor", "Pavimento do ambiente excede o total de pavimentos.");
    if (area === null) block(state, "rooms." + id + ".areaM2", "Area do ambiente nao determinada.");
    if (perimeter === null) block(state, "rooms." + id + ".perimeterM", "Perimetro do ambiente nao determinado.");
    if (height === null) block(state, "rooms." + id + ".heightM", "Altura do ambiente nao determinada.");

    const multiplier = quantity || 1;
    const volume = area !== null && height !== null ? round(area * height * multiplier) : null;
    if (volume !== null) {
      source.volume = source.area === "provided" && source.height === "provided" ? "provided" : "derived";
      mark(state, "derivedFields", "rooms." + id + ".volumeM3");
    }
    return {
      id: id,
      name: clean(room && room.name) || id,
      type: clean(room && room.type) || null,
      floor: floor,
      quantity: quantity || 1,
      dimensions: { widthM: width, lengthM: length, heightM: height },
      geometry: {
        areaM2: area,
        perimeterM: perimeter,
        volumeM3: volume,
        floorAreaM2: area !== null ? round(area * multiplier) : null,
        ceilingAreaM2: area !== null ? round(area * multiplier) : null,
        wallGrossAreaM2: perimeter !== null && height !== null ? round(perimeter * height * multiplier) : null,
        wallNetAreaM2: perimeter !== null && height !== null ? round(perimeter * height * multiplier) : null,
        openingAreaM2: 0
      },
      openings: { doorIds: [], windowIds: [], otherOpeningIds: [] },
      adjacency: Array.isArray(room && room.adjacency) ? clone(room.adjacency) : [],
      source: source,
      missingFields: [],
      warnings: [],
      errors: []
    };
  }
  function deriveOpeningGeometry(opening, defaults) {
    const state = defaults && defaults.state ? defaults.state : makeState();
    const type = defaults && defaults.type ? defaults.type : (opening && opening.type) || "other";
    const sequence = defaults && defaults.sequence ? defaults.sequence : 1;
    const id = normalizeKey(opening && opening.id ? opening.id : type + "-" + sequence);
    const width = number(opening && opening.widthM);
    const height = number(opening && opening.heightM);
    const quantity = integer(opening && (opening.quantity == null ? 1 : opening.quantity));
    const areaPerUnit = width !== null && height !== null && width > 0 && height > 0 ? round(width * height) : null;
    const totalArea = areaPerUnit !== null ? round(areaPerUnit * (quantity || 1)) : null;
    if (width !== null) mark(state, "providedFields", "openings." + id + ".widthM");
    if (height !== null) mark(state, "providedFields", "openings." + id + ".heightM");
    if (areaPerUnit !== null) mark(state, "derivedFields", "openings." + id + ".areaM2");
    if (width !== null && width <= 0) error(state, "openings." + id + ".widthM", "Largura da abertura deve ser positiva.");
    if (height !== null && height <= 0) error(state, "openings." + id + ".heightM", "Altura da abertura deve ser positiva.");
    if (quantity === null || quantity < 1) error(state, "openings." + id + ".quantity", "Quantidade da abertura deve ser positiva.");
    if (width === null || height === null) block(state, "openings." + id + ".dimensions", "Dimensoes da abertura incompletas.");
    return {
      id: id,
      type: type === "doors" ? "door" : type === "windows" ? "window" : type,
      name: clean(opening && opening.name) || null,
      roomId: opening && (opening.roomId || opening.roomID || opening.room_id) ? normalizeKey(opening.roomId || opening.roomID || opening.room_id) : null,
      floor: integer(opening && opening.floor),
      quantity: quantity || 1,
      widthM: width,
      heightM: height,
      sillHeightM: number(opening && opening.sillHeightM),
      areaPerUnitM2: areaPerUnit,
      totalAreaM2: totalArea,
      external: bool(opening && (opening.external || opening.isExternal)),
      source: areaPerUnit !== null ? "derived" : "provided",
      warnings: [],
      errors: []
    };
  }
  function addOpening(target, opening) {
    const listName = opening.type === "door" ? "doors" : opening.type === "window" ? "windows" : "otherOpenings";
    target[listName].push(opening);
  }
  function buildFloors(model, state) {
    const count = model.building.floorsCount || 0;
    for (let i = 1; i <= count; i += 1) {
      const rooms = model.rooms.filter(function (room) { return room.floor === i; });
      const openingArea = rooms.reduce(function (sum, room) { return sum + (room.geometry.openingAreaM2 || 0); }, 0);
      const area = rooms.reduce(function (sum, room) { return sum + (room.geometry.floorAreaM2 || 0); }, 0);
      const perimeter = rooms.reduce(function (sum, room) { return sum + ((room.geometry.perimeterM || 0) * (room.quantity || 1)); }, 0);
      const wallGross = rooms.reduce(function (sum, room) { return sum + (room.geometry.wallGrossAreaM2 || 0); }, 0);
      const wallNet = rooms.reduce(function (sum, room) { return sum + (room.geometry.wallNetAreaM2 || 0); }, 0);
      model.floors.push({
        id: "floor-" + i,
        number: i,
        name: "Pavimento " + i,
        elevationM: null,
        ceilingHeightM: rooms.length ? round(rooms.reduce(function (sum, room) { return sum + (room.dimensions.heightM || 0); }, 0) / rooms.length) : null,
        roomIds: rooms.map(function (room) { return room.id; }),
        areaM2: round(area),
        perimeterM: round(perimeter),
        openingAreaM2: round(openingArea),
        floorAreaM2: round(area),
        ceilingAreaM2: round(area),
        wallGrossAreaM2: round(wallGross),
        wallNetAreaM2: round(wallNet),
        source: rooms.length ? "derived" : "partial"
      });
    }
    if (count === 0) block(state, "floors", "Nenhum pavimento consolidado.");
  }
  function build(briefing, context) {
    const input = clone(briefing || {});
    const state = makeState();
    const model = emptyModel(context);
    model.audit.inputFingerprint = fingerprint(input || {});
    model.sourceBriefing.schema = input && input.schema || null;
    model.sourceBriefing.version = input && input.version || null;
    model.sourceBriefing.fingerprint = input && input.audit && input.audit.inputFingerprint || null;
    if (!input || input.schema !== INPUT_SCHEMA) {
      error(state, "schema", "Briefing incompativel com o contrato residencial completo.", "invalid_schema");
      model.status = "invalid";
      return finalize(model, state);
    }
    if (input.status === "invalid") {
      error(state, "status", "Briefing de origem esta invalido.", "invalid_source_briefing");
    }

    const site = input.site || {};
    const building = input.building || {};
    model.site.landAreaM2 = number(site.landAreaM2);
    model.site.implantationAreaM2 = number(site.implantationAreaM2) || number(site.builtAreaM2);
    model.site.builtAreaM2 = number(site.builtAreaM2);
    model.site.totalFloorAreaM2 = model.site.builtAreaM2;
    model.site.slopeCondition = site.slopeCondition || null;
    model.site.soilCondition = site.soilCondition || null;
    model.site.accessCondition = site.accessCondition || null;
    model.building.floorsCount = integer(site.floors);
    model.building.averageCeilingHeightM = number(building.ceilingHeightM);
    model.building.totalBuiltAreaM2 = model.site.builtAreaM2;
    fieldSource(state, "site.builtAreaM2", model.site.builtAreaM2, "provided");
    fieldSource(state, "site.floors", model.building.floorsCount, "provided");
    if (model.site.builtAreaM2 === null) block(state, "site.builtAreaM2", "Area construida ausente.");
    if (model.site.builtAreaM2 !== null && model.site.builtAreaM2 <= 0) error(state, "site.builtAreaM2", "Area construida deve ser maior que zero.");
    if (model.building.floorsCount === null) block(state, "site.floors", "Numero de pavimentos ausente.");
    if (model.building.floorsCount !== null && model.building.floorsCount < 1) error(state, "site.floors", "Numero de pavimentos deve ser positivo.");
    if (model.site.landAreaM2 !== null && model.site.implantationAreaM2 !== null) {
      model.site.freeAreaM2 = round(model.site.landAreaM2 - model.site.implantationAreaM2);
      model.site.occupancyRatePercent = round(model.site.implantationAreaM2 / model.site.landAreaM2 * 100);
      mark(state, "derivedFields", "site.freeAreaM2");
      mark(state, "derivedFields", "site.occupancyRatePercent");
      if (model.site.landAreaM2 <= 0) error(state, "site.landAreaM2", "Area do terreno deve ser positiva.");
      if (model.site.implantationAreaM2 <= 0) error(state, "site.implantationAreaM2", "Area de implantacao deve ser positiva.");
      if (model.site.freeAreaM2 < 0) error(state, "site.freeAreaM2", "Terreno menor que a implantacao.");
      if (model.site.occupancyRatePercent > 100) error(state, "site.occupancyRatePercent", "Taxa de ocupacao acima de 100%.");
    }

    const usedRoomIds = {};
    const rawRooms = Array.isArray(input.rooms) ? input.rooms : [];
    if (!Array.isArray(input.rooms)) mark(state, "defaultedFields", "rooms");
    model.rooms = rawRooms.map(function (room, index) {
      const normalized = deriveRoomGeometry(room, {
        state: state,
        floorsCount: model.building.floorsCount,
        ceilingHeightM: model.building.averageCeilingHeightM
      });
      let id = normalized.id || "room-" + (index + 1);
      if (usedRoomIds[id]) {
        warn(state, "rooms." + id, "ID de ambiente duplicado normalizado.", "duplicate_room_id");
        id = id + "-" + (index + 1);
      }
      usedRoomIds[id] = true;
      normalized.id = id;
      return normalized;
    });

    const roomMap = {};
    model.rooms.forEach(function (room) { roomMap[room.id] = room; });
    const openingIds = {};
    function consumeOpening(entry, type, sequence, embeddedRoomId) {
      const raw = clone(entry || {});
      if (embeddedRoomId && !raw.roomId) raw.roomId = embeddedRoomId;
      const opening = deriveOpeningGeometry(raw, { state: state, type: type, sequence: sequence });
      const originalId = opening.id;
      if (openingIds[opening.id]) {
        warn(state, "openings." + opening.id, "Abertura duplicada normalizada e deduplicada.", "duplicate_opening_id");
        return null;
      }
      openingIds[opening.id] = true;
      if (!opening.roomId) {
        warn(state, "openings." + originalId + ".roomId", "Abertura sem ambiente vinculado.", "unbound_opening");
        block(state, "openings." + originalId + ".roomId", "Abertura sem ambiente vinculado.");
      } else if (!roomMap[opening.roomId]) {
        error(state, "openings." + originalId + ".roomId", "Abertura referencia ambiente inexistente.", "missing_room_reference");
      } else {
        const room = roomMap[opening.roomId];
        if (opening.floor === null) opening.floor = room.floor;
        if (opening.type === "door") room.openings.doorIds.push(opening.id);
        else if (opening.type === "window") room.openings.windowIds.push(opening.id);
        else room.openings.otherOpeningIds.push(opening.id);
        room.geometry.openingAreaM2 = round((room.geometry.openingAreaM2 || 0) + (opening.totalAreaM2 || 0));
        if (room.geometry.wallGrossAreaM2 !== null) {
          room.geometry.wallNetAreaM2 = round(room.geometry.wallGrossAreaM2 - room.geometry.openingAreaM2);
          if (opening.totalAreaM2 !== null && opening.totalAreaM2 > room.geometry.wallGrossAreaM2) {
            error(state, "openings." + opening.id + ".totalAreaM2", "Abertura maior que area bruta de parede do ambiente.", "opening_larger_than_wall");
          }
          if (room.geometry.wallNetAreaM2 < 0) {
            error(state, "rooms." + room.id + ".wallNetAreaM2", "Area liquida de parede negativa.", "negative_wall_net_area");
          }
        }
      }
      return opening;
    }
    const globalOpenings = input.openings || {};
    let sequence = 1;
    [["doors", "door"], ["windows", "window"], ["otherOpenings", "other"]].forEach(function (pair) {
      const values = Array.isArray(globalOpenings[pair[0]]) ? globalOpenings[pair[0]] : [];
      if (!values.length) mark(state, "defaultedFields", "openings." + pair[0]);
      values.forEach(function (entry) {
        const opening = consumeOpening(entry, pair[1], sequence++, null);
        if (opening) addOpening(model.openings, opening);
      });
    });
    model.rooms.forEach(function (room) {
      const raw = rawRooms.find(function (candidate) { return normalizeKey(candidate.id || candidate.name || candidate.type) === room.id || candidate.id === room.id; }) || {};
      const embedded = raw.openings || {};
      [["doors", "door"], ["windows", "window"], ["otherOpenings", "other"]].forEach(function (pair) {
        const values = Array.isArray(embedded[pair[0]]) ? embedded[pair[0]] : [];
        values.forEach(function (entry) {
          const opening = consumeOpening(entry, pair[1], sequence++, room.id);
          if (opening) addOpening(model.openings, opening);
        });
      });
    });

    model.openings.totalAreaM2 = round([].concat(model.openings.doors, model.openings.windows, model.openings.otherOpenings).reduce(function (sum, opening) {
      return sum + (opening.totalAreaM2 || 0);
    }, 0));
    model.surfaces.floorAreaM2 = round(model.rooms.reduce(function (sum, room) { return sum + (room.geometry.floorAreaM2 || 0); }, 0));
    model.surfaces.ceilingAreaM2 = round(model.rooms.reduce(function (sum, room) { return sum + (room.geometry.ceilingAreaM2 || 0); }, 0));
    model.surfaces.internalWallGrossAreaM2 = round(model.rooms.reduce(function (sum, room) { return sum + (room.geometry.wallGrossAreaM2 || 0); }, 0));
    model.surfaces.internalWallNetAreaM2 = round(model.rooms.reduce(function (sum, room) { return sum + (room.geometry.wallNetAreaM2 || 0); }, 0));
    model.surfaces.openingAreaM2 = model.openings.totalAreaM2;
    model.building.totalInternalAreaM2 = model.surfaces.floorAreaM2;
    model.building.totalFloorAreaM2 = model.surfaces.floorAreaM2;
    model.building.totalCeilingAreaM2 = model.surfaces.ceilingAreaM2;
    model.building.totalPerimeterM = round(model.rooms.reduce(function (sum, room) { return sum + ((room.geometry.perimeterM || 0) * (room.quantity || 1)); }, 0));
    model.building.totalInternalWallGrossAreaM2 = model.surfaces.internalWallGrossAreaM2;
    model.building.totalOpeningAreaM2 = model.openings.totalAreaM2;
    if (model.site.builtAreaM2 !== null && model.surfaces.floorAreaM2 > 0) {
      const builtAreaDiff = ratioDifference(model.site.builtAreaM2, model.surfaces.floorAreaM2);
      if (builtAreaDiff > 0.02) warn(state, "site.builtAreaM2", "Area construida diverge da soma dos ambientes.", builtAreaDiff > 0.10 ? "geometry_divergence_severe" : "geometry_divergence_warning");
    }
    buildFloors(model, state);
    const floorsFound = model.floors.filter(function (floor) { return floor.roomIds.length > 0; }).length;
    if (model.building.floorsCount !== null && floorsFound > model.building.floorsCount) {
      error(state, "floors", "Pavimentos encontrados excedem quantidade informada.");
    }
    return finalize(model, state);
  }
  function finalize(model, state) {
    model.providedFields = state.providedFields.slice();
    model.derivedFields = state.derivedFields.slice();
    model.defaultedFields = state.defaultedFields.slice();
    model.missingFields = state.missingFields.slice();
    model.blockingFields = state.blockingFields.slice();
    model.warnings = clone(state.warnings);
    model.errors = clone(state.errors);
    REQUIRED_GEOMETRY.forEach(function (field) {
      const missing = model.blockingFields.some(function (item) { return item.indexOf(field.replace(/s\..+$/, "s")) >= 0 || item === field; });
      if (missing) pushUnique(model.missingFields, field);
    });
    const completeRequired = REQUIRED_GEOMETRY.length - model.missingFields.filter(function (field) { return REQUIRED_GEOMETRY.indexOf(field) >= 0; }).length;
    model.completeness = {
      score: Math.max(0, Math.min(100, round(completeRequired / REQUIRED_GEOMETRY.length * 100, 0))),
      requiredCount: REQUIRED_GEOMETRY.length,
      completeRequiredCount: completeRequired,
      missingRequiredCount: REQUIRED_GEOMETRY.length - completeRequired
    };
    model.status = model.errors.length ? "invalid" : (model.blockingFields.length ? "partial" : "complete");
    const geometryForHash = clone(model);
    if (geometryForHash.audit) geometryForHash.audit.generatedAt = null;
    model.audit.geometryFingerprint = fingerprint(geometryForHash);
    return model;
  }
  function normalize(briefing, context) { return build(briefing, context); }
  function validate(briefing, context) {
    const model = build(briefing, context);
    return {
      status: model.status,
      valid: model.status !== "invalid",
      complete: model.status === "complete",
      blockingFields: model.blockingFields.slice(),
      warnings: clone(model.warnings),
      errors: clone(model.errors),
      completeness: clone(model.completeness)
    };
  }
  function getSupportedGeometryFields() {
    return [
      "site.landAreaM2", "site.implantationAreaM2", "site.freeAreaM2", "site.occupancyRatePercent",
      "building.floorsCount", "building.totalBuiltAreaM2", "building.totalPerimeterM",
      "floors", "rooms", "rooms.dimensions", "rooms.geometry", "openings.doors", "openings.windows",
      "openings.otherOpenings", "surfaces", "adjacency", "audit.inputFingerprint", "audit.geometryFingerprint"
    ].slice();
  }
  const api = {
    build: build,
    normalize: normalize,
    validate: validate,
    deriveRoomGeometry: deriveRoomGeometry,
    deriveOpeningGeometry: deriveOpeningGeometry,
    getSupportedGeometryFields: getSupportedGeometryFields,
    getVersion: function () { return VERSION; }
  };
  root.ResidentialGeometryModelEngine = api;
  root.EloResidentialGeometryModelEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
