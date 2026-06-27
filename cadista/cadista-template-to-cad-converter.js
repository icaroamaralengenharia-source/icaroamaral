(function () {
  "use strict";

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function trimNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function room(id, name, x, y, width, depth, source) {
    return {
      id,
      type: "room",
      name,
      x: round(x),
      y: round(y),
      width: round(width),
      depth: round(depth),
      area: round(width * depth),
      sourceNodeId: source && source.sourceNodeId || null,
      zone: source && source.zone || "",
      editable: true
    };
  }

  function wall(id, x1, y1, x2, y2, sourceTemplateId) {
    return { id, type: "wall", x1: round(x1), y1: round(y1), x2: round(x2), y2: round(y2), thickness: 0.15, editable: true, sourceTemplateId };
  }

  function door(id, wallId, x, y, width, swing, roomA, roomB) {
    return { id, type: "door", wallId, x: round(x), y: round(y), width: round(width || 0.8), swing: swing || "left", roomA, roomB, editable: true };
  }

  function windowItem(id, wallId, x, y, width, roomName) {
    return { id, type: "window", wallId, x: round(x), y: round(y), width: round(width || 1.2), room: roomName, editable: true };
  }

  function label(id, text, x, y) {
    return { id, type: "label", text, x: round(x), y: round(y), editable: true };
  }

  function defaultFootprint(template, intent) {
    const bedrooms = intent && intent.bedrooms || (normalizeText(template && template.family).includes("3_quartos") ? 3 : 2);
    const lot = intent && intent.lot;
    const targetWidth = bedrooms === 3 ? 10.8 : bedrooms === 2 ? 8.6 : 6.2;
    const targetDepth = bedrooms === 3 ? 13.2 : bedrooms === 2 ? 10.4 : 8.2;
    if (!lot) return { x: 0, y: 0, width: targetWidth, depth: targetDepth, area: round(targetWidth * targetDepth) };
    const width = Math.max(5.2, Math.min(targetWidth, lot.width - 2));
    const depth = Math.max(7.2, Math.min(targetDepth, lot.depth - 4));
    return { x: 1, y: 2, width: round(width), depth: round(depth), area: round(width * depth) };
  }

  function addRectWalls(walls, prefix, rect, sourceTemplateId) {
    walls.push(wall(`${prefix}-n`, rect.x, rect.y, rect.x + rect.width, rect.y, sourceTemplateId));
    walls.push(wall(`${prefix}-e`, rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.depth, sourceTemplateId));
    walls.push(wall(`${prefix}-s`, rect.x + rect.width, rect.y + rect.depth, rect.x, rect.y + rect.depth, sourceTemplateId));
    walls.push(wall(`${prefix}-w`, rect.x, rect.y + rect.depth, rect.x, rect.y, sourceTemplateId));
  }

  function normalizeConversionInput(templateOrRequest, maybeIntent) {
    if (templateOrRequest && templateOrRequest.template) {
      return {
        template: templateOrRequest.template,
        adaptedTemplate: templateOrRequest.adaptedTemplate || null,
        graph: templateOrRequest.graph || null,
        intent: templateOrRequest.intent || maybeIntent || {}
      };
    }
    return { template: templateOrRequest, adaptedTemplate: null, graph: null, intent: maybeIntent || {} };
  }

  function ensureParametricData(template, adaptedTemplate, graph, intent) {
    let adapted = adaptedTemplate;
    let architecturalGraph = graph;
    const normalizedIntent = Object.assign({}, intent || {}, { template, family: intent && intent.family || template.family });
    if (!adapted && window.CadistaParametricLayoutEngine && typeof window.CadistaParametricLayoutEngine.adaptCadistaTemplateToLot === "function") {
      adapted = window.CadistaParametricLayoutEngine.adaptCadistaTemplateToLot(template, normalizedIntent);
    }
    if (!adapted) {
      adapted = legacyAdaptedTemplate(template, normalizedIntent);
    }
    if (!architecturalGraph && window.CadistaArchitecturalGraph && typeof window.CadistaArchitecturalGraph.buildCadistaArchitecturalGraph === "function") {
      architecturalGraph = window.CadistaArchitecturalGraph.buildCadistaArchitecturalGraph(adapted, adapted.intent || normalizedIntent);
    }
    return { adaptedTemplate: adapted, graph: architecturalGraph, intent: adapted.intent || normalizedIntent };
  }

  function legacyAdaptedTemplate(template, intent) {
    const footprint = defaultFootprint(template, intent);
    const bedrooms = intent && intent.bedrooms || (normalizeText(template.family).includes("3_quartos") ? 3 : 2);
    const sourceTemplateId = template.id;
    const roomSizes = bedrooms === 3 ? [
      { id: "social", name: "sala jantar", zone: "social", targetArea: 15 },
      { id: "cozinha", name: "cozinha", zone: "service", targetArea: 6 },
      { id: "servico", name: "area de servico", zone: "service", targetArea: 2.4 },
      { id: "quarto_1", name: "quarto 1", zone: "private", targetArea: 7.5 },
      { id: "quarto_2", name: "quarto 2", zone: "private", targetArea: 7.5 },
      { id: "corredor", name: "corredor", zone: "circulation", targetArea: 3 },
      { id: "banheiro_social", name: "banheiro social", zone: "wet", targetArea: 2.4 },
      { id: "suite", name: "suite", zone: "private", targetArea: 9.5 },
      { id: "banho_suite", name: "banheiro suite", zone: "wet", targetArea: 2.5 }
    ] : bedrooms === 1 ? [
      { id: "social", name: "sala", zone: "social", targetArea: 9 },
      { id: "cozinha", name: "cozinha", zone: "service", targetArea: 4 },
      { id: "servico", name: "area de servico", zone: "service", targetArea: 2 },
      { id: "banheiro_social", name: "banheiro", zone: "wet", targetArea: 2.4 },
      { id: "quarto_1", name: "quarto", zone: "private", targetArea: 7.5 }
    ] : [
      { id: "social", name: "sala", zone: "social", targetArea: 11 },
      { id: "cozinha", name: "cozinha", zone: "service", targetArea: 4.5 },
      { id: "servico", name: "area de servico", zone: "service", targetArea: 2 },
      { id: "banheiro_social", name: "banheiro", zone: "wet", targetArea: 2.4 },
      { id: "quarto_1", name: "quarto 1", zone: "private", targetArea: 7.5 },
      { id: "quarto_2", name: "quarto 2", zone: "private", targetArea: 7.5 }
    ];
    return { id: `${sourceTemplateId}-legacy-adapted`, sourceTemplateId, family: template.family, name: template.name, intent, footprint, roomSizes, zones: [], constraints: { suiteRequired: bedrooms >= 3, socialIntegratedRequired: normalizeText(template.family).includes("social_integrado") }, warnings: [] };
  }

  function roomsFromAdaptedTemplate(adaptedTemplate) {
    const fp = adaptedTemplate.footprint || { x: 0, y: 0, width: 9, depth: 11 };
    const rooms = adaptedTemplate.roomSizes || [];
    const bedrooms = adaptedTemplate.intent && adaptedTemplate.intent.bedrooms || (rooms.some((item) => item.id === "suite") ? 3 : 2);
    if (bedrooms >= 3) return buildThreeBedroomRooms(rooms, fp, adaptedTemplate);
    return buildSmallHouseRooms(rooms, fp, bedrooms);
  }

  function findRoom(rooms, id, fallbackName) {
    return rooms.find((item) => item.id === id) || { id, name: fallbackName || id, targetArea: 4, zone: "" };
  }

  function buildThreeBedroomRooms(roomSizes, footprint, adaptedTemplate) {
    const socialFamily = Boolean(adaptedTemplate.constraints && adaptedTemplate.constraints.socialIntegratedRequired) || normalizeText(adaptedTemplate.family).includes("social_integrado");
    const x = footprint.x;
    const y = footprint.y;
    const w = footprint.width;
    const d = footprint.depth;
    const socialDepth = round(d * (socialFamily ? 0.42 : 0.35));
    const privateY = y + socialDepth;
    const privateDepth = d - socialDepth;
    const leftW = round(w * 0.35);
    const hallW = Math.max(0.9, round(w * 0.18));
    const rightW = w - leftW - hallW;
    const bathDepth = Math.max(1.4, round(privateDepth * 0.24));
    const suiteDepth = round((privateDepth - bathDepth) * 0.56);
    return [
      room("room-social", findRoom(roomSizes, "social", "sala e jantar integradas").name, x, y, socialFamily ? w * 0.68 : w * 0.58, socialDepth, { sourceNodeId: "sala", zone: "social" }),
      room("room-kitchen", findRoom(roomSizes, "cozinha", "cozinha").name, x + (socialFamily ? w * 0.68 : w * 0.58), y, w * (socialFamily ? 0.32 : 0.42), socialDepth * 0.7, { sourceNodeId: "cozinha", zone: "service" }),
      room("room-service", findRoom(roomSizes, "servico", "area de servico").name, x + w * 0.68, y + socialDepth * 0.7, w * 0.32, socialDepth * 0.3, { sourceNodeId: "servico", zone: "service" }),
      room("room-bedroom-1", findRoom(roomSizes, "quarto_1", "quarto 1").name, x, privateY, leftW, suiteDepth, { sourceNodeId: "quarto_1", zone: "private" }),
      room("room-bedroom-2", findRoom(roomSizes, "quarto_2", "quarto 2").name, x, privateY + suiteDepth, leftW, privateDepth - suiteDepth, { sourceNodeId: "quarto_2", zone: "private" }),
      room("room-hall", findRoom(roomSizes, "corredor", "corredor").name, x + leftW, privateY, hallW, privateDepth, { sourceNodeId: "corredor", zone: "circulation" }),
      room("room-bath", findRoom(roomSizes, "banheiro_social", "banheiro social").name, x + leftW + hallW, privateY, rightW, bathDepth, { sourceNodeId: "banheiro_social", zone: "wet" }),
      room("room-suite", findRoom(roomSizes, "suite", "suite").name, x + leftW + hallW, privateY + bathDepth, rightW, suiteDepth, { sourceNodeId: "suite", zone: "private" }),
      room("room-suite-bath", findRoom(roomSizes, "banho_suite", "banheiro suite").name, x + leftW + hallW, privateY + bathDepth + suiteDepth, rightW, Math.max(1.35, privateDepth - bathDepth - suiteDepth), { sourceNodeId: "banho_suite", zone: "wet" })
    ];
  }

  function buildSmallHouseRooms(roomSizes, footprint, bedrooms) {
    const x = footprint.x;
    const y = footprint.y;
    const w = footprint.width;
    const d = footprint.depth;
    const frontDepth = bedrooms === 1 ? d * 0.38 : d * 0.36;
    const serviceDepth = Math.max(1.25, d * 0.16);
    const bathDepth = Math.max(1.55, d * 0.2);
    const rightW = Math.max(1.85, w * 0.34);
    const leftW = w - rightW;
    const kitchenDepth = Math.max(2.25, frontDepth - serviceDepth);
    const rooms = [
      room("room-social", findRoom(roomSizes, "social", "sala").name, x, y, leftW, frontDepth, { sourceNodeId: "sala", zone: "social" }),
      room("room-kitchen", findRoom(roomSizes, "cozinha", "cozinha").name, x + leftW, y, rightW, kitchenDepth, { sourceNodeId: "cozinha", zone: "service" }),
      room("room-service", findRoom(roomSizes, "servico", "area de servico").name, x + leftW, y + kitchenDepth, rightW, serviceDepth, { sourceNodeId: "servico", zone: "service" }),
      room("room-bath", findRoom(roomSizes, "banheiro_social", "banheiro").name, x + leftW, y + frontDepth, rightW, bathDepth, { sourceNodeId: "banheiro_social", zone: "wet" })
    ];
    if (bedrooms === 1) {
      rooms.push(room("room-bedroom-1", findRoom(roomSizes, "quarto_1", "quarto").name, x, y + frontDepth, leftW, d - frontDepth, { sourceNodeId: "quarto_1", zone: "private" }));
    } else {
      rooms.push(room("room-bedroom-1", findRoom(roomSizes, "quarto_1", "quarto 1").name, x, y + frontDepth, w * 0.5, d - frontDepth, { sourceNodeId: "quarto_1", zone: "private" }));
      rooms.push(room("room-bedroom-2", findRoom(roomSizes, "quarto_2", "quarto 2").name, x + w * 0.5, y + frontDepth + bathDepth, w * 0.5, d - frontDepth - bathDepth, { sourceNodeId: "quarto_2", zone: "private" }));
    }
    return rooms;
  }

  function buildInternalWalls(rooms, sourceTemplateId) {
    const walls = [];
    const seen = new Set();
    rooms.forEach((item) => {
      const edges = [[item.x, item.y, item.x + item.width, item.y], [item.x + item.width, item.y, item.x + item.width, item.y + item.depth], [item.x + item.width, item.y + item.depth, item.x, item.y + item.depth], [item.x, item.y + item.depth, item.x, item.y]];
      edges.forEach((edge) => {
        const key = edge.map((value) => trimNumber(value)).join(":");
        if (seen.has(key)) return;
        seen.add(key);
        walls.push(wall(`wall-${walls.length + 1}`, edge[0], edge[1], edge[2], edge[3], sourceTemplateId));
      });
    });
    return walls;
  }

  function buildOpenings(rooms, footprint) {
    const doors = [door("door-main", "wall-perimeter-n", footprint.x + footprint.width * 0.42, footprint.y, 0.9, "in", "exterior", "sala")];
    const windows = [];
    rooms.forEach((item, index) => {
      const centerX = item.x + item.width / 2;
      const centerY = item.y + item.depth / 2;
      doors.push(door(`door-${index + 1}`, `wall-${index + 1}`, centerX, item.y, item.name.includes("banheiro") ? 0.7 : 0.8, "left", "circulacao", item.name));
      if (item.name.includes("banheiro") || item.name.includes("servico")) windows.push(windowItem(`window-${index + 1}`, "wall-perimeter-e", item.x + item.width, centerY, 0.6, item.name));
      else windows.push(windowItem(`window-${index + 1}`, "wall-perimeter", centerX, item.y, 1.2, item.name));
    });
    return { doors, windows };
  }

  function convertCadistaTemplateToEditableCad(templateOrRequest, maybeIntent) {
    const request = normalizeConversionInput(templateOrRequest, maybeIntent);
    const template = request.template;
    if (!template || !template.id) throw new Error("Template CADISTA invalido para conversao.");
    const prepared = ensureParametricData(template, request.adaptedTemplate, request.graph, request.intent || {});
    const adaptedTemplate = prepared.adaptedTemplate;
    const graph = prepared.graph || null;
    const intent = prepared.intent || {};
    const footprint = adaptedTemplate.footprint || defaultFootprint(template, intent);
    const sourceTemplateId = template.id;
    const rooms = roomsFromAdaptedTemplate(adaptedTemplate);
    const walls = [];
    addRectWalls(walls, "wall-perimeter", footprint, sourceTemplateId);
    buildInternalWalls(rooms, sourceTemplateId).forEach((item) => walls.push(item));
    const openings = buildOpenings(rooms, footprint);
    const labels = rooms.map((item, index) => label(`label-${index + 1}`, `${item.name} ${trimNumber(item.area)}m2`, item.x + item.width / 2, item.y + item.depth / 2));
    labels.push(label("label-title", template.name, footprint.x + footprint.width / 2, footprint.y - 0.6));
    return {
      walls,
      doors: openings.doors,
      windows: openings.windows,
      rooms,
      labels,
      graph,
      adaptedTemplate,
      metadata: {
        sourceTemplateId,
        family: template.family || intent.family || "",
        editable: true,
        generatedBy: graph ? "cadista-parametric-graph-converter" : "cadista-template-to-cad-converter",
        isStaticSvg: false,
        unit: "m",
        lot: intent.lot || adaptedTemplate.constraints && adaptedTemplate.constraints.lot || null,
        manualCadCompatible: true
      }
    };
  }

  function applyCadistaEditableTemplateToCanvas(result) {
    if (!result || !result.metadata || !result.metadata.editable) throw new Error("Resultado editavel invalido.");
    window.dispatchEvent(new CustomEvent("cadista:editable-template-ready", { detail: result }));
    try { window.localStorage.setItem("cadista:last-editable-template", JSON.stringify(result)); } catch (error) {}
    return result;
  }

  window.CadistaTemplateToCadConverter = { convertCadistaTemplateToEditableCad, applyCadistaEditableTemplateToCanvas };
  window.convertCadistaTemplateToEditableCad = convertCadistaTemplateToEditableCad;
  window.applyCadistaEditableTemplateToCanvas = applyCadistaEditableTemplateToCanvas;
})();
