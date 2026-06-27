(function () {
  "use strict";

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || null));
  }

  function roomKey(room) {
    const text = normalizeText([room.id, room.name, room.sourceNodeId].join(" "));
    if (/social|sala|jantar/.test(text)) return "social";
    if (/cozinha|kitchen/.test(text)) return "cozinha";
    if (/servico|lavanderia|service/.test(text)) return "servico";
    if (/corredor|hall|circulacao/.test(text)) return "corredor";
    if (/banho_suite|suite-bath|banheiro suite/.test(text)) return "banho_suite";
    if (/banheiro|bath/.test(text)) return "banheiro_social";
    if (/suite/.test(text)) return "suite";
    if (/quarto.*2|bedroom-2/.test(text)) return "quarto_2";
    if (/quarto|bedroom/.test(text)) return "quarto_1";
    return text.replace(/\W+/g, "_") || "ambiente";
  }

  function boundsFromRooms(rooms) {
    const xs = [];
    const ys = [];
    rooms.forEach((room) => {
      xs.push(room.x, room.x + room.width);
      ys.push(room.y, room.y + room.depth);
    });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    return { minX, maxX, minY, maxY, width: maxX - minX, depth: maxY - minY };
  }

  function findRoom(rooms, key) {
    return rooms.find((room) => roomKey(room) === key) || null;
  }

  function isExternalPoint(point, bounds) {
    const tolerance = 0.05;
    return Math.abs(point.x - bounds.minX) <= tolerance ||
      Math.abs(point.x - bounds.maxX) <= tolerance ||
      Math.abs(point.y - bounds.minY) <= tolerance ||
      Math.abs(point.y - bounds.maxY) <= tolerance;
  }

  function applyCadistaArchitecturalRules(layout, graph, intent) {
    const source = layout && layout.cad ? layout.cad : layout;
    const cad = clone(source);
    const issues = [];
    const improvements = [];
    if (!cad || !cad.rooms || !cad.walls) {
      return { cad, architecturalScore: 0, issues: ["CAD ausente para aplicar regras arquitetonicas."], improvements, passed: false };
    }
    improveWalls(cad, improvements);
    improveRoomMetadata(cad, intent, improvements);
    enforceMandatoryRoomLabels(cad, improvements);
    placeCadistaArchitecturalOpenings(cad, graph, intent, improvements);
    const validation = validateCadistaArchitecturalRules(cad, graph, intent);
    validation.improvements = improvements.concat(validation.improvements || []);
    validation.cad = cad;
    cad.metadata = Object.assign({}, cad.metadata || {}, {
      editable: true,
      architecturalRulesApplied: true,
      architecturalScore: validation.architecturalScore,
      architecturalPassed: validation.passed
    });
    cad.architecturalRules = {
      score: validation.architecturalScore,
      passed: validation.passed,
      issues: validation.issues,
      improvements: validation.improvements
    };
    return validation;
  }

  function improveCadistaRoomProportions(layout, intent) {
    const adapted = clone(layout);
    const improvements = [];
    if (!adapted || !adapted.footprint || !Array.isArray(adapted.roomSizes)) return { adaptedTemplate: adapted, improvements };
    const bedrooms = intent && intent.bedrooms || adapted.intent && adapted.intent.bedrooms || 2;
    const social = adapted.roomSizes.find((room) => room.id === "social");
    const corridor = adapted.roomSizes.find((room) => room.id === "corredor");
    if (social && bedrooms >= 2 && social.targetArea < 15) {
      social.targetArea = 15;
      improvements.push("Area social reforcada para leitura arquitetonica mais clara.");
    }
    if (corridor && corridor.targetArea < 2.6 && bedrooms >= 2) {
      corridor.targetArea = 2.6;
      improvements.push("Corredor/hall ajustado para largura visual minima.");
    }
    adapted.roomSizes.forEach((room) => {
      if (/quarto|suite/.test(room.id) && room.targetArea < 7.2) {
        room.targetArea = 7.2;
        improvements.push(`${room.name} ajustado para proporcao minima razoavel.`);
      }
    });
    adapted.architecturalRuleImprovements = (adapted.architecturalRuleImprovements || []).concat(improvements);
    return { adaptedTemplate: adapted, improvements };
  }

  function improveWalls(cad, improvements) {
    const bounds = boundsFromRooms(cad.rooms || []);
    (cad.walls || []).forEach((wall) => {
      const external = Math.abs(wall.x1 - bounds.minX) <= 0.05 && Math.abs(wall.x2 - bounds.minX) <= 0.05 ||
        Math.abs(wall.x1 - bounds.maxX) <= 0.05 && Math.abs(wall.x2 - bounds.maxX) <= 0.05 ||
        Math.abs(wall.y1 - bounds.minY) <= 0.05 && Math.abs(wall.y2 - bounds.minY) <= 0.05 ||
        Math.abs(wall.y1 - bounds.maxY) <= 0.05 && Math.abs(wall.y2 - bounds.maxY) <= 0.05 ||
        String(wall.id || "").includes("perimeter");
      wall.wallRole = external ? "external" : "internal";
      wall.thickness = external ? 0.18 : 0.12;
    });
    improvements.push("Paredes externas marcadas com espessura visual maior e paredes internas refinadas.");
  }

  function improveRoomMetadata(cad, intent, improvements) {
    (cad.rooms || []).forEach((room) => {
      const key = roomKey(room);
      room.architecturalRole = key;
      if (key === "social") room.zone = "social";
      if (key === "cozinha" || key === "servico") room.zone = "service";
      if (key === "corredor") room.zone = "circulation";
      if (key.includes("banheiro") || key === "banho_suite") room.zone = "wet";
      if (/quarto|suite/.test(key) && key !== "banho_suite") room.zone = "private";
    });
    const social = findRoom(cad.rooms, "social");
    const suite = findRoom(cad.rooms, "suite");
    if (social && intent && intent.preferences && intent.preferences.socialIntegrated) {
      social.name = "sala e jantar integradas";
      improvements.push("Social integrado nomeado sem substituir cozinha obrigatoria.");
    }
    if (suite) improvements.push("Suite mantida como ambiente privativo conectado ao banheiro interno.");
  }

  function enforceMandatoryRoomLabels(cad, improvements) {
    const kitchen = findRoom(cad.rooms || [], "cozinha");
    const service = findRoom(cad.rooms || [], "servico");
    const social = findRoom(cad.rooms || [], "social");
    if (kitchen) kitchen.name = "cozinha";
    if (service && !normalizeText(service.name).includes("externa")) service.name = "area de servico";
    if (social && kitchen && normalizeText(social.name).includes("cozinha")) {
      social.name = normalizeText(social.name).includes("jantar") ? "sala e jantar integradas" : "sala";
      improvements.push("Sala, cozinha e area de servico mantidas como ambientes obrigatorios separados.");
    }
  }

  function placeCadistaArchitecturalOpenings(cad, graph, intent, improvements) {
    const rooms = cad.rooms || [];
    const bounds = boundsFromRooms(rooms);
    const doors = [];
    const windows = [];
    const social = findRoom(rooms, "social");
    const kitchen = findRoom(rooms, "cozinha");
    const service = findRoom(rooms, "servico");
    const hall = findRoom(rooms, "corredor");
    const bath = findRoom(rooms, "banheiro_social");
    const suite = findRoom(rooms, "suite");
    const suiteBath = findRoom(rooms, "banho_suite");
    const bedrooms = rooms.filter((room) => /^quarto_/.test(roomKey(room)));

    if (social) doors.push(makeDoor("door-main", "wall-perimeter-n", centerX(social), social.y, 0.9, "exterior", social.name, "main_access"));
    if (kitchen && service) doors.push(makeDoor("door-service", "service-partition", centerX(service), service.y, 0.8, kitchen.name, service.name, "service"));
    if (hall) {
      bedrooms.forEach((room, index) => doors.push(makeDoor(`door-bedroom-${index + 1}`, "hall-bedroom", room.x + room.width, centerY(room), 0.8, hall.name, room.name, "private")));
      if (bath) doors.push(makeDoor("door-bath-social", "hall-bath", bath.x, centerY(bath), 0.7, hall.name, bath.name, "wet"));
      if (suite) doors.push(makeDoor("door-suite", "hall-suite", suite.x, centerY(suite), 0.8, hall.name, suite.name, "suite"));
    }
    if (suite && suiteBath) doors.push(makeDoor("door-suite-bath", "suite-bath", centerX(suiteBath), suiteBath.y, 0.7, suite.name, suiteBath.name, "suite_bath"));

    if (social) windows.push(externalWindow("window-social", social, bounds, 1.6));
    if (kitchen) windows.push(externalWindow("window-kitchen", kitchen, bounds, 1.1));
    if (service) windows.push(externalWindow("window-service", service, bounds, 0.8));
    bedrooms.forEach((room, index) => windows.push(externalWindow(`window-bedroom-${index + 1}`, room, bounds, 1.2)));
    if (suite) windows.push(externalWindow("window-suite", suite, bounds, 1.2));
    if (bath) windows.push(externalWindow("window-bath-social", bath, bounds, 0.6));
    if (suiteBath) windows.push(externalWindow("window-suite-bath", suiteBath, bounds, 0.6));

    cad.doors = doors.filter(Boolean).map((item, index) => Object.assign(item, { id: item.id || `door-${index + 1}`, editable: true }));
    cad.windows = windows.filter(Boolean).map((item, index) => Object.assign(item, { id: item.id || `window-${index + 1}`, editable: true, external: true }));
    improvements.push("Portas reposicionadas por relacao arquitetonica do grafo.");
    improvements.push("Janelas reposicionadas em paredes externas preferenciais.");
    return cad;
  }

  function validateCadistaArchitecturalRules(cad, graph, intent) {
    const issues = [];
    const improvements = [];
    const scores = {
      sectorization: 0,
      lightVentilation: 0,
      circulation: 0,
      privacy: 0,
      serviceKitchen: 0,
      suite: 0,
      editability: 0
    };
    if (!cad || !cad.rooms || !cad.walls) {
      return { cad, architecturalScore: 0, issues: ["CAD invalido."], improvements, passed: false };
    }
    const rooms = cad.rooms || [];
    const bounds = boundsFromRooms(rooms);
    const social = findRoom(rooms, "social");
    const kitchen = findRoom(rooms, "cozinha");
    const service = findRoom(rooms, "servico");
    const hall = findRoom(rooms, "corredor");
    const bath = findRoom(rooms, "banheiro_social");
    const suite = findRoom(rooms, "suite");
    const suiteBath = findRoom(rooms, "banho_suite");
    const bedrooms = rooms.filter((room) => /^quarto_/.test(roomKey(room)));

    if (social && social.y <= bounds.minY + bounds.depth * 0.08) scores.sectorization += 12;
    else issues.push("Area social nao esta claramente junto ao acesso frontal.");
    if (hall && bedrooms.length) scores.sectorization += 10;
    else if (bedrooms.length > 1) issues.push("Setor intimo sem corredor/hall claro.");
    if (kitchen && service && areTouching(kitchen, service)) scores.serviceKitchen += 14;
    else issues.push("Cozinha e area de servico nao estao claramente conectadas.");
    if (bath && hall) scores.circulation += 12;
    else if (bath) issues.push("Banheiro social sem acesso claro por corredor/hall.");
    if (suite && suiteBath && areTouching(suite, suiteBath)) scores.suite += 14;
    else if (suite) issues.push("Suite sem banheiro interno claramente conectado.");

    const bedroomWindowOk = bedrooms.every((room) => hasExternalWindow(cad, room, bounds));
    if (bedroomWindowOk) scores.lightVentilation += 14;
    else issues.push("Algum quarto ficou sem janela externa.");
    if (social && area(social) >= averagePrivateArea(rooms)) scores.sectorization += 8;
    else issues.push("Area social integrada nao ficou maior/mais legivel que quartos.");
    if (hall && hall.width >= 0.85 || hall && hall.depth >= 0.85 || !hall) scores.circulation += 8;
    else issues.push("Corredor/hall abaixo da largura visual minima.");
    if (!hasInternalWindows(cad, bounds)) scores.lightVentilation += 10;
    else issues.push("Ha janela em parede interna.");
    if (!doorFromRoomTo(cad, bath, ["cozinha", "sala", "social"])) scores.privacy += 10;
    else issues.push("Banheiro social abre diretamente para cozinha/sala.");
    if ((cad.walls || []).every((wall) => wall.editable !== false) && (cad.doors || []).every((door) => door.editable !== false)) scores.editability += 16;
    else issues.push("Alguma entidade CAD nao esta marcada como editavel.");

    const architecturalScore = Math.min(100, Object.values(scores).reduce((sum, value) => sum + value, 0));
    const passed = issues.length === 0 || architecturalScore >= 78;
    return { cad, architecturalScore, issues, improvements, passed, scores };
  }

  function makeDoor(id, wallId, x, y, width, roomA, roomB, role) {
    return { id, type: "door", wallId, x: round(x), y: round(y), width: round(width || 0.8), swing: "left", roomA, roomB, role, editable: true };
  }

  function externalWindow(id, room, bounds, width) {
    const distances = [
      { side: "west", value: Math.abs(room.x - bounds.minX), x: room.x, y: centerY(room), wallId: "wall-perimeter-w" },
      { side: "east", value: Math.abs(room.x + room.width - bounds.maxX), x: room.x + room.width, y: centerY(room), wallId: "wall-perimeter-e" },
      { side: "north", value: Math.abs(room.y - bounds.minY), x: centerX(room), y: room.y, wallId: "wall-perimeter-n" },
      { side: "south", value: Math.abs(room.y + room.depth - bounds.maxY), x: centerX(room), y: room.y + room.depth, wallId: "wall-perimeter-s" }
    ].sort((a, b) => a.value - b.value);
    const best = distances[0];
    return { id, type: "window", wallId: best.wallId, x: round(best.x), y: round(best.y), width: round(width || 1), room: room.name, roomId: room.id, side: best.side, external: true, editable: true };
  }

  function centerX(room) { return Number(room.x || 0) + Number(room.width || 0) / 2; }
  function centerY(room) { return Number(room.y || 0) + Number(room.depth || 0) / 2; }
  function area(room) { return Number(room.width || 0) * Number(room.depth || 0); }
  function averagePrivateArea(rooms) {
    const privateRooms = rooms.filter((room) => /quarto|suite/.test(roomKey(room)) && roomKey(room) !== "banho_suite");
    if (!privateRooms.length) return 0;
    return privateRooms.reduce((sum, room) => sum + area(room), 0) / privateRooms.length;
  }
  function areTouching(a, b) {
    if (!a || !b) return false;
    const horizontal = Math.abs(a.x + a.width - b.x) <= 0.05 || Math.abs(b.x + b.width - a.x) <= 0.05;
    const verticalOverlap = a.y < b.y + b.depth && b.y < a.y + a.depth;
    const vertical = Math.abs(a.y + a.depth - b.y) <= 0.05 || Math.abs(b.y + b.depth - a.y) <= 0.05;
    const horizontalOverlap = a.x < b.x + b.width && b.x < a.x + a.width;
    return horizontal && verticalOverlap || vertical && horizontalOverlap;
  }
  function hasDoorRole(cad, role) {
    return (cad.doors || []).some((door) => door.role === role);
  }
  function hasExternalWindow(cad, room, bounds) {
    return (cad.windows || []).some((item) => item.roomId === room.id && item.external && isExternalPoint(item, bounds));
  }
  function hasInternalWindows(cad, bounds) {
    return (cad.windows || []).some((item) => !item.external || !isExternalPoint(item, bounds));
  }
  function doorFromRoomTo(cad, room, forbiddenTerms) {
    if (!room) return false;
    return (cad.doors || []).some((door) => {
      const text = normalizeText([door.roomA, door.roomB].join(" "));
      return text.includes(normalizeText(room.name)) && forbiddenTerms.some((term) => text.includes(term));
    });
  }

  window.CadistaArchitecturalRulesEngine = {
    applyCadistaArchitecturalRules,
    validateCadistaArchitecturalRules,
    improveCadistaRoomProportions,
    placeCadistaArchitecturalOpenings
  };
  window.applyCadistaArchitecturalRules = applyCadistaArchitecturalRules;
  window.validateCadistaArchitecturalRules = validateCadistaArchitecturalRules;
  window.improveCadistaRoomProportions = improveCadistaRoomProportions;
  window.placeCadistaArchitecturalOpenings = placeCadistaArchitecturalOpenings;
})();
