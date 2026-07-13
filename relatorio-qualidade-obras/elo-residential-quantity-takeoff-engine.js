(function (root) {
  "use strict";

  const VERSION = "1.0.0";
  const INPUT_SCHEMA = "elo.residential_geometry_model";
  const OUTPUT_SCHEMA = "elo.residential_quantity_takeoff";
  const UNITS = { m: 3, m2: 3, m3: 3, un: 0 };
  const DISCIPLINES = [
    "PRELIMINARY", "EARTHWORK", "FOUNDATION", "STRUCTURE", "MASONRY",
    "WATERPROOFING", "ROOFING", "OPENINGS", "FLOORS", "WALL_FINISHES",
    "CEILINGS", "PAINTING", "ELECTRICAL", "HYDRAULIC", "SANITARY",
    "DRAINAGE", "FIXTURES", "FINAL_CLEANING", "INDIRECTS"
  ];
  const SUPPORTED_ITEMS = [
    ["BUILT_AREA", "PRELIMINARY", "Area construida", "m2"],
    ["IMPLANTATION_AREA", "PRELIMINARY", "Area de implantacao", "m2"],
    ["FREE_SITE_AREA", "PRELIMINARY", "Area livre do terreno", "m2"],
    ["FLOOR_AREA_TOTAL", "FLOORS", "Area total de piso", "m2"],
    ["FLOOR_AREA_ROOM", "FLOORS", "Area de piso por ambiente", "m2"],
    ["CEILING_AREA_TOTAL", "CEILINGS", "Area total de teto", "m2"],
    ["CEILING_AREA_ROOM", "CEILINGS", "Area de teto por ambiente", "m2"],
    ["WALL_GROSS_AREA_ROOM", "MASONRY", "Area bruta de paredes por ambiente", "m2"],
    ["WALL_NET_AREA_ROOM", "MASONRY", "Area liquida de paredes por ambiente", "m2"],
    ["WALL_GROSS_AREA_TOTAL", "MASONRY", "Area bruta total de paredes", "m2"],
    ["WALL_NET_AREA_TOTAL", "MASONRY", "Area liquida total de paredes", "m2"],
    ["OPENING_AREA_TOTAL", "OPENINGS", "Area total de vaos", "m2"],
    ["DOOR_COUNT", "OPENINGS", "Quantidade de portas", "un"],
    ["DOOR_AREA_TOTAL", "OPENINGS", "Area total de portas", "m2"],
    ["WINDOW_COUNT", "OPENINGS", "Quantidade de janelas", "un"],
    ["WINDOW_AREA_TOTAL", "OPENINGS", "Area total de janelas", "m2"],
    ["OTHER_OPENING_COUNT", "OPENINGS", "Outros vaos", "un"],
    ["OTHER_OPENING_AREA_TOTAL", "OPENINGS", "Area de outros vaos", "m2"],
    ["ROOM_PERIMETER", "MASONRY", "Perimetro por ambiente", "m"],
    ["ROOM_PERIMETER_TOTAL", "MASONRY", "Perimetro total", "m"],
    ["ROOM_VOLUME", "MASONRY", "Volume por ambiente", "m3"],
    ["ROOM_VOLUME_TOTAL", "MASONRY", "Volume interno total", "m3"],
    ["FLOOR_LEVEL_AREA", "FLOORS", "Area por pavimento", "m2"],
    ["FINAL_CLEANING_AREA", "FINAL_CLEANING", "Area base de limpeza final", "m2"],
    ["INTERNAL_PAINTING_BASE_AREA", "PAINTING", "Area liquida base para pintura interna", "m2"],
    ["CEILING_PAINTING_BASE_AREA", "PAINTING", "Area base de pintura de teto", "m2"],
    ["FLOOR_FINISH_BASE_AREA", "FLOORS", "Area base de acabamento de piso", "m2"],
    ["WALL_FINISH_BASE_AREA", "WALL_FINISHES", "Area base de revestimento de parede", "m2"]
  ];
  const PENDING_DEFINITIONS = [
    ["INITIAL_SITE_CLEANING", "PRELIMINARY", "Limpeza inicial do terreno", "depende de area e escopo de preparacao do terreno"],
    ["LAYOUT_MARKING", "PRELIMINARY", "Locacao", "depende de projeto executivo e eixos"],
    ["SITE_FACILITIES", "PRELIMINARY", "Canteiro", "depende de plano de canteiro"],
    ["TEMPORARY_FENCE", "PRELIMINARY", "Tapume", "depende de perimetro e especificacao"],
    ["EARTHWORK_CUT", "EARTHWORK", "Terraplenagem", "depende de levantamento topografico"],
    ["EXCAVATION", "EARTHWORK", "Escavacao", "depende de secao e profundidade"],
    ["BACKFILL", "EARTHWORK", "Aterro", "depende de cotas e volume executivo"],
    ["FOUNDATION", "FOUNDATION", "Fundacao", "depende de projeto estrutural e sondagem"],
    ["GRADE_BEAM", "FOUNDATION", "Baldrame", "depende de projeto estrutural"],
    ["WATERPROOFING", "WATERPROOFING", "Impermeabilizacao", "depende de especificacao"],
    ["STRUCTURE", "STRUCTURE", "Estrutura", "depende de projeto estrutural"],
    ["CONCRETE", "STRUCTURE", "Concreto", "depende de volume estrutural"],
    ["FORMWORK", "STRUCTURE", "Forma", "depende de geometria estrutural"],
    ["REBAR", "STRUCTURE", "Armacacao", "depende de detalhamento estrutural"],
    ["STRUCTURAL_SLAB", "STRUCTURE", "Laje estrutural", "depende de projeto estrutural"],
    ["ROOF", "ROOFING", "Cobertura", "depende de inclinacao e projeto de cobertura"],
    ["ROOF_TILE", "ROOFING", "Telhamento", "depende de especificacao de telha"],
    ["RIDGE", "ROOFING", "Cumeeira", "depende de geometria da cobertura"],
    ["GUTTERS", "ROOFING", "Calhas", "depende de projeto de aguas pluviais"],
    ["FLASHINGS", "ROOFING", "Rufos", "depende de encontros da cobertura"],
    ["LINTELS", "MASONRY", "Vergas", "depende de detalhamento de vaos"],
    ["COUNTER_LINTELS", "MASONRY", "Contravergas", "depende de detalhamento de vaos"],
    ["BASEBOARDS", "FLOORS", "Rodapes", "depende de especificacao e perimetros executivos"],
    ["THRESHOLDS", "FLOORS", "Soleiras", "depende de mapa de esquadrias"],
    ["WINDOW_SILLS", "OPENINGS", "Peitoris", "depende de mapa de esquadrias"],
    ["ELECTRICAL", "ELECTRICAL", "Eletrica", "depende de quantidade de pontos e projeto"],
    ["HYDRAULIC", "HYDRAULIC", "Hidraulica", "depende de projeto e tracado"],
    ["SANITARY", "SANITARY", "Sanitaria", "depende de projeto e tracado"],
    ["DRAINAGE", "DRAINAGE", "Drenagem", "depende de projeto e cotas"],
    ["GAS", "HYDRAULIC", "Gas", "depende de projeto e tracado"],
    ["AIR_CONDITIONING", "ELECTRICAL", "Ar-condicionado", "depende de pontos e cargas"],
    ["SANITARY_FIXTURES", "FIXTURES", "Loucas", "depende de especificacao"],
    ["METALS", "FIXTURES", "Metais", "depende de especificacao"],
    ["COUNTERTOPS", "FIXTURES", "Bancadas", "depende de projeto executivo"],
    ["GLASS", "OPENINGS", "Vidros", "depende de mapa de esquadrias"],
    ["LOCAL_ADMINISTRATION", "INDIRECTS", "Administracao local", "depende de politica de custos"],
    ["MOBILIZATION", "INDIRECTS", "Mobilizacao", "depende de logistica"],
    ["DEMOBILIZATION", "INDIRECTS", "Desmobilizacao", "depende de logistica"],
    ["FREIGHT", "INDIRECTS", "Frete", "depende de politica de custos"],
    ["LOSSES", "INDIRECTS", "Perdas", "depende de politica de perdas"],
    ["BDI", "INDIRECTS", "BDI", "depende de politica de custos"]
  ];

  function isObject(value) { return value && typeof value === "object" && !Array.isArray(value); }
  function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
  function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
  function round(value, unit) {
    const precision = UNITS[unit] == null ? 3 : UNITS[unit];
    const factor = Math.pow(10, precision);
    return precision === 0 ? Math.round(Number(value || 0)) : Math.round(Number(value || 0) * factor) / factor;
  }
  function finite(value) { return typeof value === "number" && Number.isFinite(value); }
  function number(value) {
    if (value === null || value === undefined || value === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  function arr(value) { return Array.isArray(value) ? value : []; }
  function normalizeKey(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
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
  function issue(list, field, message, code) {
    if (!list.some(function (item) { return item.field === field && item.code === code; })) list.push({ field: field, code: code, message: message });
  }
  function makeModel(options) {
    return {
      schema: OUTPUT_SCHEMA,
      version: VERSION,
      status: "partial",
      sourceGeometry: { schema: null, version: null, inputFingerprint: null, geometryFingerprint: null },
      disciplines: DISCIPLINES.map(function (name) { return { id: name, name: name, status: "pending", itemIds: [], quantifiedCount: 0, pendingCount: 0, blockedCount: 0, warnings: [], errors: [] }; }),
      items: [],
      totals: { itemCount: 0, quantifiedItemCount: 0, pendingItemCount: 0, blockedItemCount: 0 },
      quantitiesByUnit: { m: 0, m2: 0, m3: 0, un: 0 },
      assumptions: [],
      missingFields: [],
      blockingFields: [],
      warnings: [],
      errors: [],
      completeness: { score: 0, requiredCount: SUPPORTED_ITEMS.length, quantifiedRequiredCount: 0, pendingRequiredCount: 0, geometrySupportedScore: 0, residentialOverallReadiness: "partial" },
      audit: { generatedAt: options && options.generatedAt || new Date().toISOString(), source: "ResidentialQuantityTakeoffEngine", inputFingerprint: null, takeoffFingerprint: null }
    };
  }
  function addDisciplineItem(model, item) {
    const discipline = model.disciplines.find(function (entry) { return entry.id === item.discipline; });
    if (!discipline) return;
    discipline.itemIds.push(item.id);
    if (item.status === "quantified") discipline.quantifiedCount += 1;
    if (item.status === "pending") discipline.pendingCount += 1;
    if (item.status === "blocked" || item.status === "invalid") discipline.blockedCount += 1;
    if (item.warnings.length) discipline.warnings = discipline.warnings.concat(item.warnings);
    if (item.errors.length) discipline.errors = discipline.errors.concat(item.errors);
  }
  function itemBase(code, discipline, name, unit, quantity, source, calculation, role, status) {
    const rounded = quantity === null || quantity === undefined ? null : round(quantity, unit);
    return {
      id: normalizeKey(code + "-" + (source && source.roomIds && source.roomIds[0] || source && source.floorIds && source.floorIds[0] || source && source.openingIds && source.openingIds[0] || "total")),
      discipline: discipline,
      code: code,
      name: name,
      description: null,
      unit: unit,
      quantity: rounded,
      aggregationRole: role || "total",
      source: Object.assign({ type: status === "pending" ? "pending" : "derived", geometryPath: null, roomIds: [], floorIds: [], openingIds: [] }, source || {}),
      calculation: Object.assign({ formula: null, operands: {}, rawResult: quantity, roundedResult: rounded, roundingPrecision: UNITS[unit] }, calculation || {}),
      status: status || "quantified",
      assumptions: [],
      warnings: [],
      errors: []
    };
  }
  function addItem(model, state, item) {
    const validUnit = Object.prototype.hasOwnProperty.call(UNITS, item.unit);
    if (!validUnit) {
      item.status = "invalid";
      item.errors.push({ field: item.id + ".unit", code: "invalid_unit", message: "Unidade invalida." });
    }
    if (item.quantity !== null && (!finite(item.quantity) || item.quantity < 0)) {
      item.status = "invalid";
      item.errors.push({ field: item.id + ".quantity", code: "invalid_quantity", message: "Quantidade invalida." });
    }
    if (state.itemIds[item.id]) {
      item.status = "invalid";
      item.errors.push({ field: item.id, code: "duplicate_item", message: "Item duplicado." });
    }
    state.itemIds[item.id] = true;
    model.items.push(item);
    addDisciplineItem(model, item);
    item.errors.forEach(function (entry) { issue(model.errors, entry.field, entry.message, entry.code); });
  }
  function pendingItem(code, discipline, name, reason, geometryInvalid) {
    const item = itemBase(code, discipline, name, "un", null, { type: "pending" }, { formula: null, operands: { reason: reason } }, "independent", geometryInvalid ? "blocked" : "pending");
    item.assumptions.push(reason);
    item.warnings.push({ field: item.id, code: "pending_executive_takeoff", message: reason });
    return item;
  }
  function calculateRoomTakeoff(room) {
    const safe = room || {};
    const id = safe.id || "room";
    const g = safe.geometry || {};
    const qty = number(safe.quantity) || 1;
    return {
      roomId: id,
      floorAreaM2: number(g.floorAreaM2),
      ceilingAreaM2: number(g.ceilingAreaM2),
      wallGrossAreaM2: number(g.wallGrossAreaM2),
      wallNetAreaM2: number(g.wallNetAreaM2),
      perimeterM: g.perimeterM === null || g.perimeterM === undefined ? null : round(number(g.perimeterM) * qty, "m"),
      volumeM3: number(g.volumeM3),
      quantity: qty
    };
  }
  function calculateOpeningTakeoff(opening) {
    const safe = opening || {};
    return {
      openingId: safe.id || "opening",
      count: number(safe.quantity) || 1,
      areaM2: number(safe.totalAreaM2)
    };
  }
  function calculateFloorTakeoff(floor) {
    const safe = floor || {};
    return { floorId: safe.id || "floor", areaM2: number(safe.areaM2), openingAreaM2: number(safe.openingAreaM2) || 0 };
  }
  function sum(list, fn) {
    return list.reduce(function (total, entry) {
      const value = fn(entry);
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
  }
  function hasFloorFinish(room, options) {
    return !!(options && options.floorFinishDefined) || !!(room && room.finishes && (room.finishes.floor || room.finishes.floorDefault));
  }
  function hasWallFinish(room, options) {
    return !!(options && options.wallFinishDefined) || !!(room && room.finishes && (room.finishes.walls || room.finishes.wall || room.finishes.wallFinishHeightM));
  }
  function addQuantified(model, state, code, discipline, name, unit, quantity, source, formula, operands, role) {
    addItem(model, state, itemBase(code, discipline, name, unit, quantity, source, { formula: formula, operands: operands || {} }, role || "total", "quantified"));
  }
  function build(geometryModel, options) {
    const input = clone(geometryModel || {});
    const opts = clone(options || {});
    const state = { itemIds: {} };
    const model = makeModel(opts);
    model.audit.inputFingerprint = fingerprint(input || {});
    model.sourceGeometry.schema = input && input.schema || null;
    model.sourceGeometry.version = input && input.version || null;
    model.sourceGeometry.inputFingerprint = input && input.audit && input.audit.inputFingerprint || null;
    model.sourceGeometry.geometryFingerprint = input && input.audit && input.audit.geometryFingerprint || null;
    if (!input || input.schema !== INPUT_SCHEMA) {
      issue(model.errors, "schema", "Modelo geometrico incompativel.", "invalid_schema");
      model.status = "invalid";
      return finalize(model);
    }
    if (input.status === "invalid") {
      issue(model.errors, "status", "Modelo geometrico de origem invalido.", "invalid_source_geometry");
      model.blockingFields.push("sourceGeometry.status");
    }
    const geometryInvalid = input.status === "invalid";
    const rooms = arr(input.rooms);
    const floors = arr(input.floors);
    const doors = arr(input.openings && input.openings.doors);
    const windows = arr(input.openings && input.openings.windows);
    const otherOpenings = arr(input.openings && input.openings.otherOpenings);
    const allOpenings = doors.concat(windows, otherOpenings);
    const surfaces = input.surfaces || {};
    if (!Array.isArray(input.rooms)) model.missingFields.push("rooms");
    if (!Array.isArray(input.floors)) model.missingFields.push("floors");
    if (!input.audit || !input.audit.geometryFingerprint) model.warnings.push({ field: "audit.geometryFingerprint", code: "missing_fingerprint", message: "Fingerprint geometrico ausente." });
    arr(input.blockingFields).forEach(function (field) { model.blockingFields.push("geometry." + field); });
    arr(input.errors).forEach(function (entry) { issue(model.errors, "geometry." + (entry.field || "error"), entry.message || "Erro geometrico de origem.", entry.code || "source_geometry_error"); });

    addQuantified(model, state, "BUILT_AREA", "PRELIMINARY", "Area construida", "m2", number(input.site && input.site.builtAreaM2), { geometryPath: "site.builtAreaM2" }, "site.builtAreaM2", {}, "total");
    addQuantified(model, state, "IMPLANTATION_AREA", "PRELIMINARY", "Area de implantacao", "m2", number(input.site && input.site.implantationAreaM2), { geometryPath: "site.implantationAreaM2" }, "site.implantationAreaM2", {}, "total");
    addQuantified(model, state, "FREE_SITE_AREA", "PRELIMINARY", "Area livre do terreno", "m2", number(input.site && input.site.freeAreaM2), { geometryPath: "site.freeAreaM2" }, "site.freeAreaM2", {}, "total");
    addQuantified(model, state, "FLOOR_AREA_TOTAL", "FLOORS", "Area total de piso", "m2", number(surfaces.floorAreaM2), { geometryPath: "surfaces.floorAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.floorAreaM2)", {}, "total");
    rooms.forEach(function (room) {
      const takeoff = calculateRoomTakeoff(room);
      addQuantified(model, state, "FLOOR_AREA_ROOM_" + room.id, "FLOORS", "Area de piso - " + (room.name || room.id), "m2", takeoff.floorAreaM2, { geometryPath: "rooms." + room.id + ".geometry.floorAreaM2", roomIds: [room.id] }, "room.geometry.floorAreaM2", { quantity: takeoff.quantity }, "detail");
      addQuantified(model, state, "CEILING_AREA_ROOM_" + room.id, "CEILINGS", "Area de teto - " + (room.name || room.id), "m2", takeoff.ceilingAreaM2, { geometryPath: "rooms." + room.id + ".geometry.ceilingAreaM2", roomIds: [room.id] }, "room.geometry.ceilingAreaM2", { quantity: takeoff.quantity }, "detail");
      addQuantified(model, state, "WALL_GROSS_AREA_ROOM_" + room.id, "MASONRY", "Area bruta de paredes - " + (room.name || room.id), "m2", takeoff.wallGrossAreaM2, { geometryPath: "rooms." + room.id + ".geometry.wallGrossAreaM2", roomIds: [room.id] }, "room.geometry.wallGrossAreaM2", { quantity: takeoff.quantity }, "detail");
      addQuantified(model, state, "WALL_NET_AREA_ROOM_" + room.id, "MASONRY", "Area liquida de paredes - " + (room.name || room.id), "m2", takeoff.wallNetAreaM2, { geometryPath: "rooms." + room.id + ".geometry.wallNetAreaM2", roomIds: [room.id] }, "room.geometry.wallNetAreaM2", { quantity: takeoff.quantity }, "detail");
      addQuantified(model, state, "ROOM_PERIMETER_" + room.id, "MASONRY", "Perimetro - " + (room.name || room.id), "m", takeoff.perimeterM, { geometryPath: "rooms." + room.id + ".geometry.perimeterM", roomIds: [room.id] }, "room.geometry.perimeterM * room.quantity", { quantity: takeoff.quantity }, "detail");
      addQuantified(model, state, "ROOM_VOLUME_" + room.id, "MASONRY", "Volume - " + (room.name || room.id), "m3", takeoff.volumeM3, { geometryPath: "rooms." + room.id + ".geometry.volumeM3", roomIds: [room.id] }, "room.geometry.volumeM3", { quantity: takeoff.quantity }, "detail");
      if (hasFloorFinish(room, opts)) addQuantified(model, state, "FLOOR_FINISH_BASE_AREA_" + room.id, "FLOORS", "Base de acabamento de piso - " + (room.name || room.id), "m2", takeoff.floorAreaM2, { geometryPath: "rooms." + room.id + ".geometry.floorAreaM2", roomIds: [room.id] }, "room.geometry.floorAreaM2", {}, "detail");
      if (hasWallFinish(room, opts)) addQuantified(model, state, "WALL_FINISH_BASE_AREA_" + room.id, "WALL_FINISHES", "Base de revestimento de parede - " + (room.name || room.id), "m2", takeoff.wallNetAreaM2, { geometryPath: "rooms." + room.id + ".geometry.wallNetAreaM2", roomIds: [room.id] }, "room.geometry.wallNetAreaM2", {}, "detail");
    });
    addQuantified(model, state, "CEILING_AREA_TOTAL", "CEILINGS", "Area total de teto", "m2", number(surfaces.ceilingAreaM2), { geometryPath: "surfaces.ceilingAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.ceilingAreaM2)", {}, "total");
    addQuantified(model, state, "WALL_GROSS_AREA_TOTAL", "MASONRY", "Area bruta total de paredes", "m2", number(surfaces.internalWallGrossAreaM2), { geometryPath: "surfaces.internalWallGrossAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.wallGrossAreaM2)", {}, "total");
    addQuantified(model, state, "WALL_NET_AREA_TOTAL", "MASONRY", "Area liquida total de paredes", "m2", number(surfaces.internalWallNetAreaM2), { geometryPath: "surfaces.internalWallNetAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.wallNetAreaM2)", {}, "total");
    addQuantified(model, state, "OPENING_AREA_TOTAL", "OPENINGS", "Area total de vaos", "m2", number(input.openings && input.openings.totalAreaM2), { geometryPath: "openings.totalAreaM2", openingIds: allOpenings.map(function (o) { return o.id; }) }, "sum(opening.totalAreaM2)", {}, "total");
    addQuantified(model, state, "DOOR_COUNT", "OPENINGS", "Quantidade de portas", "un", sum(doors, function (o) { return calculateOpeningTakeoff(o).count; }), { geometryPath: "openings.doors", openingIds: doors.map(function (o) { return o.id; }) }, "sum(door.quantity)", {}, "total");
    addQuantified(model, state, "DOOR_AREA_TOTAL", "OPENINGS", "Area total de portas", "m2", sum(doors, function (o) { return calculateOpeningTakeoff(o).areaM2; }), { geometryPath: "openings.doors.totalAreaM2", openingIds: doors.map(function (o) { return o.id; }) }, "sum(door.totalAreaM2)", {}, "total");
    addQuantified(model, state, "WINDOW_COUNT", "OPENINGS", "Quantidade de janelas", "un", sum(windows, function (o) { return calculateOpeningTakeoff(o).count; }), { geometryPath: "openings.windows", openingIds: windows.map(function (o) { return o.id; }) }, "sum(window.quantity)", {}, "total");
    addQuantified(model, state, "WINDOW_AREA_TOTAL", "OPENINGS", "Area total de janelas", "m2", sum(windows, function (o) { return calculateOpeningTakeoff(o).areaM2; }), { geometryPath: "openings.windows.totalAreaM2", openingIds: windows.map(function (o) { return o.id; }) }, "sum(window.totalAreaM2)", {}, "total");
    addQuantified(model, state, "OTHER_OPENING_COUNT", "OPENINGS", "Outros vaos", "un", sum(otherOpenings, function (o) { return calculateOpeningTakeoff(o).count; }), { geometryPath: "openings.otherOpenings", openingIds: otherOpenings.map(function (o) { return o.id; }) }, "sum(otherOpening.quantity)", {}, "total");
    addQuantified(model, state, "OTHER_OPENING_AREA_TOTAL", "OPENINGS", "Area de outros vaos", "m2", sum(otherOpenings, function (o) { return calculateOpeningTakeoff(o).areaM2; }), { geometryPath: "openings.otherOpenings.totalAreaM2", openingIds: otherOpenings.map(function (o) { return o.id; }) }, "sum(otherOpening.totalAreaM2)", {}, "total");
    addQuantified(model, state, "ROOM_PERIMETER_TOTAL", "MASONRY", "Perimetro total", "m", sum(rooms, function (r) { return calculateRoomTakeoff(r).perimeterM; }), { geometryPath: "rooms.geometry.perimeterM", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.perimeterM * quantity)", {}, "total");
    addQuantified(model, state, "ROOM_VOLUME_TOTAL", "MASONRY", "Volume interno total", "m3", sum(rooms, function (r) { return calculateRoomTakeoff(r).volumeM3; }), { geometryPath: "rooms.geometry.volumeM3", roomIds: rooms.map(function (r) { return r.id; }) }, "sum(room.geometry.volumeM3)", {}, "total");
    floors.forEach(function (floor) {
      const takeoff = calculateFloorTakeoff(floor);
      addQuantified(model, state, "FLOOR_LEVEL_AREA_" + floor.id, "FLOORS", "Area do pavimento " + (floor.number || floor.id), "m2", takeoff.areaM2, { geometryPath: "floors." + floor.id + ".areaM2", floorIds: [floor.id] }, "floor.areaM2", {}, "detail");
    });
    addQuantified(model, state, "FINAL_CLEANING_AREA", "FINAL_CLEANING", "Area base de limpeza final", "m2", number(input.site && input.site.builtAreaM2) || number(surfaces.floorAreaM2), { geometryPath: number(input.site && input.site.builtAreaM2) ? "site.builtAreaM2" : "surfaces.floorAreaM2" }, "builtAreaM2 || floorAreaM2", {}, "total");
    addQuantified(model, state, "INTERNAL_PAINTING_BASE_AREA", "PAINTING", "Area liquida base para pintura interna", "m2", number(surfaces.internalWallNetAreaM2), { geometryPath: "surfaces.internalWallNetAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "surfaces.internalWallNetAreaM2", {}, "total");
    addQuantified(model, state, "CEILING_PAINTING_BASE_AREA", "PAINTING", "Area base de pintura de teto", "m2", number(surfaces.ceilingAreaM2), { geometryPath: "surfaces.ceilingAreaM2", roomIds: rooms.map(function (r) { return r.id; }) }, "surfaces.ceilingAreaM2", {}, "total");
    if (opts.floorFinishDefined) addQuantified(model, state, "FLOOR_FINISH_BASE_AREA", "FLOORS", "Area base de acabamento de piso", "m2", number(surfaces.floorAreaM2), { geometryPath: "surfaces.floorAreaM2" }, "surfaces.floorAreaM2", {}, "total");
    if (opts.wallFinishDefined) addQuantified(model, state, "WALL_FINISH_BASE_AREA", "WALL_FINISHES", "Area base de revestimento de parede", "m2", number(surfaces.internalWallNetAreaM2), { geometryPath: "surfaces.internalWallNetAreaM2" }, "surfaces.internalWallNetAreaM2", {}, "total");

    PENDING_DEFINITIONS.forEach(function (definition) { addItem(model, state, pendingItem(definition[0], definition[1], definition[2], definition[3], geometryInvalid)); });
    validateTotals(model, input);
    return finalize(model);
  }
  function validateTotals(model, input) {
    const rooms = arr(input.rooms);
    const openings = arr(input.openings && input.openings.doors).concat(arr(input.openings && input.openings.windows), arr(input.openings && input.openings.otherOpenings));
    rooms.forEach(function (room) {
      const gross = number(room.geometry && room.geometry.wallGrossAreaM2);
      const net = number(room.geometry && room.geometry.wallNetAreaM2);
      if (net !== null && net < 0) issue(model.errors, "rooms." + room.id + ".wallNetAreaM2", "Area liquida negativa.", "negative_wall_net_area");
      if (gross !== null && net !== null && net > gross) issue(model.errors, "rooms." + room.id + ".wallNetAreaM2", "Area liquida maior que area bruta.", "wall_net_greater_than_gross");
    });
    openings.forEach(function (opening) {
      if (opening.roomId && !rooms.some(function (room) { return room.id === opening.roomId; })) issue(model.errors, "openings." + opening.id + ".roomId", "Referencia de ambiente inexistente.", "missing_room_reference");
      if (number(opening.totalAreaM2) !== null && number(opening.totalAreaM2) < 0) issue(model.errors, "openings." + opening.id + ".totalAreaM2", "Area de abertura negativa.", "negative_opening_area");
      if (!Number.isFinite(Number(opening.totalAreaM2 || 0))) issue(model.errors, "openings." + opening.id + ".totalAreaM2", "Area de abertura invalida.", "invalid_opening_area");
    });
    const floorTotal = model.items.find(function (item) { return item.code === "FLOOR_AREA_TOTAL"; });
    const roomFloorSum = sum(rooms, function (room) { return number(room.geometry && room.geometry.floorAreaM2); });
    if (floorTotal && floorTotal.quantity !== null && Math.abs(floorTotal.quantity - roomFloorSum) > 0.01) issue(model.warnings, "surfaces.floorAreaM2", "Total de pisos diverge da soma dos ambientes.", "floor_total_mismatch");
    const openingTotal = model.items.find(function (item) { return item.code === "OPENING_AREA_TOTAL"; });
    const openingSum = sum(openings, function (opening) { return number(opening.totalAreaM2); });
    if (openingTotal && openingTotal.quantity !== null && Math.abs(openingTotal.quantity - openingSum) > 0.01) issue(model.warnings, "openings.totalAreaM2", "Total de aberturas diverge da soma das aberturas.", "opening_total_mismatch");
  }
  function finalize(model) {
    model.items.forEach(function (item) {
      if (item.status === "quantified" && item.quantity === null) {
        item.status = "pending";
        item.warnings.push({ field: item.id, code: "missing_quantity", message: "Quantidade geometrica pendente." });
        model.missingFields.push(item.source.geometryPath || item.id);
      }
      if (item.status === "invalid") item.errors.forEach(function (entry) { issue(model.errors, entry.field, entry.message, entry.code); });
    });
    model.totals.itemCount = model.items.length;
    model.totals.quantifiedItemCount = model.items.filter(function (item) { return item.status === "quantified"; }).length;
    model.totals.pendingItemCount = model.items.filter(function (item) { return item.status === "pending"; }).length;
    model.totals.blockedItemCount = model.items.filter(function (item) { return item.status === "blocked" || item.status === "invalid"; }).length;
    model.items.forEach(function (item) {
      if (item.status === "quantified" && item.quantity !== null && Object.prototype.hasOwnProperty.call(model.quantitiesByUnit, item.unit)) {
        model.quantitiesByUnit[item.unit] = round(model.quantitiesByUnit[item.unit] + item.quantity, item.unit);
      }
    });
    model.disciplines.forEach(function (discipline) {
      discipline.status = discipline.errors.length || discipline.blockedCount ? "blocked" : (discipline.pendingCount ? "pending" : "quantified");
    });
    const supportedCodes = SUPPORTED_ITEMS.map(function (item) { return item[0]; });
    const quantifiedRequired = supportedCodes.filter(function (code) {
      return model.items.some(function (item) { return item.code === code || item.code.indexOf(code + "_") === 0; }) && model.items.filter(function (item) { return item.code === code || item.code.indexOf(code + "_") === 0; }).some(function (item) { return item.status === "quantified"; });
    }).length;
    model.completeness.quantifiedRequiredCount = quantifiedRequired;
    model.completeness.pendingRequiredCount = Math.max(0, model.completeness.requiredCount - quantifiedRequired);
    model.completeness.geometrySupportedScore = round(quantifiedRequired / model.completeness.requiredCount * 100, "un");
    model.completeness.score = model.completeness.geometrySupportedScore;
    model.completeness.residentialOverallReadiness = model.errors.length ? "invalid" : "partial";
    if (model.errors.length) model.status = "invalid";
    else if (model.totals.pendingItemCount || model.blockingFields.length) model.status = "partial";
    else model.status = "complete";
    const hashable = clone(model);
    if (hashable.audit) hashable.audit.generatedAt = null;
    model.audit.takeoffFingerprint = fingerprint(hashable);
    return model;
  }
  function normalize(input, options) { return build(input, options); }
  function validate(input, options) {
    const result = build(input, options);
    return { status: result.status, valid: result.status !== "invalid", complete: result.status === "complete", errors: clone(result.errors), warnings: clone(result.warnings), blockingFields: result.blockingFields.slice(), completeness: clone(result.completeness) };
  }
  function getSupportedItems() { return SUPPORTED_ITEMS.map(function (item) { return { code: item[0], discipline: item[1], name: item[2], unit: item[3] }; }); }
  function getSupportedDisciplines() { return DISCIPLINES.slice(); }
  const api = {
    build: build,
    normalize: normalize,
    validate: validate,
    calculateRoomTakeoff: calculateRoomTakeoff,
    calculateOpeningTakeoff: calculateOpeningTakeoff,
    calculateFloorTakeoff: calculateFloorTakeoff,
    getSupportedItems: getSupportedItems,
    getSupportedDisciplines: getSupportedDisciplines,
    getVersion: function () { return VERSION; }
  };
  root.ResidentialQuantityTakeoffEngine = api;
  root.EloResidentialQuantityTakeoffEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
