(function () {
  "use strict";

  const DEFAULT_SETBACKS = { front: 2, back: 1.5, left: 1, right: 1 };
  const MIN = {
    circulationWidth: 0.85,
    singleBedroomArea: 7.2,
    suiteBedroomArea: 9,
    suiteBathArea: 2.4,
    bathArea: 2.2,
    kitchenArea: 4.2,
    serviceArea: 2,
    socialArea: 10
  };

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function parseLot(input) {
    if (!input) return null;
    if (typeof input === "object" && Number(input.width) > 0 && Number(input.depth) > 0) {
      return { width: round(input.width), depth: round(input.depth), label: `${round(input.width)}x${round(input.depth)}` };
    }
    const match = normalizeText(input).match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/);
    if (!match) return null;
    const width = Number(match[1].replace(",", "."));
    const depth = Number(match[2].replace(",", "."));
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;
    return { width: round(width), depth: round(depth), label: `${round(width)}x${round(depth)}` };
  }

  function detectBedrooms(template, text, intent) {
    if (intent && Number(intent.bedrooms) > 0) return Number(intent.bedrooms);
    const source = normalizeText([text, template && template.family, template && template.name].filter(Boolean).join(" "));
    if (/(3_quartos|3 quartos|tres quartos|three bedroom)/.test(source)) return 3;
    if (/(2_quartos|2 quartos|dois quartos|two bedroom)/.test(source)) return 2;
    if (/(1_quarto|1 quarto|um quarto|one bedroom)/.test(source)) return 1;
    return 2;
  }

  function normalizePreferences(input) {
    const text = normalizeText([input && input.rawInput, input && input.preference, input && input.style, input && input.family].filter(Boolean).join(" "));
    const preferences = Object.assign({
      budget: null,
      style: null,
      veranda: false,
      americanKitchen: false,
      island: false,
      laundryExternal: false,
      suiteLarger: false,
      socialIntegrated: false,
      futureExpansion: false
    }, input && input.preferences || {});
    if (/(barat|econom|popular|baixo custo)/.test(text)) preferences.budget = preferences.budget || "baixo";
    if (/(premium|alto padrao|gourmet)/.test(text)) preferences.budget = preferences.budget || "alto";
    if (/(moderna|modern|ilha|premium)/.test(text)) preferences.style = preferences.style || "moderna";
    if (/(rural|sitio|chacara|campo)/.test(text)) preferences.style = preferences.style || "rural";
    if (/(varanda|gourmet)/.test(text)) preferences.veranda = true;
    if (/(cozinha americana|balcao|balcão)/.test(text)) preferences.americanKitchen = true;
    if (/ilha/.test(text)) preferences.island = true;
    if (/(lavanderia externa|area de servico externa|servico externo)/.test(text)) preferences.laundryExternal = true;
    if (/(suite maior|master suite|suite master)/.test(text)) preferences.suiteLarger = true;
    if (/(social integrado|conceito aberto|open concept|integrada)/.test(text) || normalizeText(input && input.family).includes("social_integrado")) preferences.socialIntegrated = true;
    if (/(ampliacao futura|expansivel|future expansion)/.test(text)) preferences.futureExpansion = true;
    return preferences;
  }

  function normalizeSetbacks(input) {
    const source = input && input.setbacks || {};
    return {
      front: Number.isFinite(Number(source.front)) ? Number(source.front) : DEFAULT_SETBACKS.front,
      back: Number.isFinite(Number(source.back)) ? Number(source.back) : DEFAULT_SETBACKS.back,
      left: Number.isFinite(Number(source.left)) ? Number(source.left) : DEFAULT_SETBACKS.left,
      right: Number.isFinite(Number(source.right)) ? Number(source.right) : DEFAULT_SETBACKS.right
    };
  }

  function normalizeCadistaParametricIntent(input) {
    const source = input || {};
    const rawInput = typeof source === "string" ? source : source.rawInput || source.text || "";
    const lot = parseLot(source.lot || rawInput);
    const bedrooms = detectBedrooms(source.template, rawInput, source);
    const preferences = normalizePreferences(Object.assign({}, source, { rawInput }));
    return {
      rawInput,
      family: source.family || source.template && source.template.family || "",
      bedrooms,
      lot,
      setbacks: normalizeSetbacks(source),
      preferences,
      template: source.template || null
    };
  }

  function minimumProgram(intent) {
    const bedrooms = intent.bedrooms || 2;
    const rooms = [
      { id: "social", name: intent.preferences.socialIntegrated ? "sala jantar cozinha integradas" : "sala jantar", zone: "social", minArea: MIN.socialArea + Math.max(0, bedrooms - 1) * 2.2 },
      { id: "cozinha", name: "cozinha", zone: "service", minArea: intent.preferences.americanKitchen ? 4.8 : MIN.kitchenArea },
      { id: "banheiro_social", name: "banheiro social", zone: "wet", minArea: MIN.bathArea }
    ];
    if (intent.preferences.laundryExternal) rooms.push({ id: "servico", name: "area de servico externa", zone: "service", minArea: MIN.serviceArea });
    else rooms.push({ id: "servico", name: "area de servico", zone: "service", minArea: MIN.serviceArea });
    for (let index = 1; index <= Math.max(0, bedrooms - 1); index += 1) {
      rooms.push({ id: `quarto_${index}`, name: `quarto ${index}`, zone: "private", minArea: MIN.singleBedroomArea });
    }
    if (bedrooms >= 3 || normalizeText(intent.family).includes("suite")) {
      rooms.push({ id: "suite", name: "suite", zone: "private", minArea: intent.preferences.suiteLarger ? 11 : MIN.suiteBedroomArea });
      rooms.push({ id: "banho_suite", name: "banheiro suite", zone: "wet", minArea: MIN.suiteBathArea });
    } else if (bedrooms === 1) {
      rooms.push({ id: "quarto_1", name: "quarto", zone: "private", minArea: MIN.singleBedroomArea });
    }
    rooms.push({ id: "corredor", name: "circulacao", zone: "circulation", minArea: bedrooms >= 3 ? 3.2 : 1.8 });
    return rooms;
  }

  function calculateEnvelope(lot, setbacks, bedrooms) {
    if (!lot) {
      const width = bedrooms === 3 ? 10.8 : bedrooms === 2 ? 8.6 : 6.2;
      const depth = bedrooms === 3 ? 13.2 : bedrooms === 2 ? 10.4 : 8.2;
      return { x: 0, y: 0, width, depth, area: round(width * depth), source: "default" };
    }
    const width = Math.max(0, lot.width - setbacks.left - setbacks.right);
    const depth = Math.max(0, lot.depth - setbacks.front - setbacks.back);
    return { x: setbacks.left, y: setbacks.front, width: round(width), depth: round(depth), area: round(width * depth), source: "lot-setbacks" };
  }

  function chooseFootprint(envelope, intent, minArea) {
    const bedrooms = intent.bedrooms || 2;
    const targetWidth = bedrooms === 3 ? 10.8 : bedrooms === 2 ? 8.6 : 6.2;
    const targetDepth = bedrooms === 3 ? 13.2 : bedrooms === 2 ? 10.4 : 8.2;
    const budgetFactor = intent.preferences.budget === "baixo" ? 0.9 : 1;
    const desiredArea = Math.max(minArea * 1.18, targetWidth * targetDepth * budgetFactor);
    const width = Math.max(4.8, Math.min(envelope.width || targetWidth, targetWidth, Math.sqrt(desiredArea * 0.82)));
    const depth = Math.max(6.4, Math.min(envelope.depth || targetDepth, targetDepth, desiredArea / Math.max(width, 1)));
    const overWidth = envelope.width > 0 && width > envelope.width;
    const overDepth = envelope.depth > 0 && depth > envelope.depth;
    return {
      x: round(envelope.x),
      y: round(envelope.y),
      width: round(Math.min(width, envelope.width || width)),
      depth: round(Math.min(depth, envelope.depth || depth)),
      area: round(Math.min(width, envelope.width || width) * Math.min(depth, envelope.depth || depth)),
      orientation: envelope.depth >= envelope.width * 1.6 ? "longitudinal" : envelope.width >= 12 ? "wide" : "balanced",
      compacted: overWidth || overDepth
    };
  }

  function allocateRoomSizes(program, footprint, intent) {
    const minTotal = program.reduce((sum, item) => sum + item.minArea, 0);
    const usable = footprint.area;
    const factor = minTotal > 0 ? Math.max(0.82, Math.min(1.55, usable / minTotal)) : 1;
    return program.map((item) => {
      const socialBonus = item.zone === "social" && intent.preferences.socialIntegrated ? 1.1 : 1;
      const suiteBonus = item.id === "suite" && intent.preferences.suiteLarger ? 1.15 : 1;
      const area = round(item.minArea * Math.min(factor, 1.35) * socialBonus * suiteBonus);
      return Object.assign({}, item, { targetArea: area, compacted: area < item.minArea });
    });
  }

  function buildZones(roomSizes, footprint, intent) {
    const socialDepth = round(footprint.depth * (intent.preferences.socialIntegrated ? 0.42 : 0.36));
    const privateDepth = round(footprint.depth - socialDepth);
    return [
      { id: "zone-social", type: "social", x: footprint.x, y: footprint.y, width: footprint.width, depth: socialDepth, rooms: roomSizes.filter((room) => room.zone === "social" || room.id === "cozinha").map((room) => room.id) },
      { id: "zone-service", type: "service", x: round(footprint.x + footprint.width * 0.68), y: footprint.y, width: round(footprint.width * 0.32), depth: socialDepth, rooms: roomSizes.filter((room) => room.zone === "service" || room.zone === "wet").map((room) => room.id) },
      { id: "zone-private", type: "private", x: footprint.x, y: round(footprint.y + socialDepth), width: footprint.width, depth: privateDepth, rooms: roomSizes.filter((room) => room.zone === "private" || room.zone === "circulation").map((room) => room.id) }
    ];
  }

  function adaptCadistaTemplateToLot(template, intentInput) {
    if (!template || !template.id) throw new Error("Template CADISTA invalido para adaptacao parametrica.");
    const intent = normalizeCadistaParametricIntent(Object.assign({}, intentInput || {}, { template, family: intentInput && intentInput.family || template.family }));
    const warnings = [];
    const program = minimumProgram(intent);
    const minArea = round(program.reduce((sum, item) => sum + item.minArea, 0));
    const envelope = calculateEnvelope(intent.lot, intent.setbacks, intent.bedrooms);
    const footprint = chooseFootprint(envelope, intent, minArea);
    if (!intent.lot) warnings.push("Terreno nao informado; usando envelope tecnico padrao para estudo preliminar.");
    if (envelope.width < 5.5 || envelope.depth < 8) warnings.push("Terreno util apertado apos recuos; revisar recuos e programa.");
    if (footprint.compacted || footprint.area < minArea) warnings.push("Programa compactado para caber no terreno; alguns ambientes podem ficar no minimo tecnico.");
    if (intent.bedrooms >= 3 && footprint.width < 7.2) warnings.push("Tres quartos com suite em largura reduzida exige corredor muito controlado.");
    if (intent.preferences.island && footprint.width < 10.5) warnings.push("Ilha pode nao ser viavel; considerar balcao americano.");
    if (intent.preferences.futureExpansion && envelope.area - footprint.area < 18) warnings.push("Pouca sobra para ampliacao futura dentro do envelope.");
    const roomSizes = allocateRoomSizes(program, footprint, intent);
    const zones = buildZones(roomSizes, footprint, intent);
    const adaptedTemplate = {
      id: `${template.id}-adapted`,
      sourceTemplateId: template.id,
      family: template.family,
      name: template.name,
      strategy: template.strategy,
      originalTemplate: template,
      intent,
      footprint,
      zones,
      roomSizes,
      constraints: {
        lot: intent.lot,
        setbacks: intent.setbacks,
        envelope,
        minimumProgramArea: minArea,
        availableArea: envelope.area,
        circulationWidth: MIN.circulationWidth,
        socialIntegratedRequired: Boolean(intent.preferences.socialIntegrated),
        suiteRequired: intent.bedrooms >= 3 || normalizeText(template.family).includes("suite"),
        wetCorePreferred: true
      },
      warnings
    };
    return adaptedTemplate;
  }

  function validateCadistaParametricLayout(adaptedTemplate) {
    const warnings = [];
    const errors = [];
    if (!adaptedTemplate || !adaptedTemplate.footprint) errors.push("Layout parametrico ausente.");
    const constraints = adaptedTemplate && adaptedTemplate.constraints || {};
    const footprint = adaptedTemplate && adaptedTemplate.footprint || {};
    const rooms = adaptedTemplate && adaptedTemplate.roomSizes || [];
    if (constraints.minimumProgramArea && footprint.area < constraints.minimumProgramArea * 0.9) warnings.push("Area da implantacao abaixo do minimo estimado.");
    if (constraints.envelope && footprint.width > constraints.envelope.width + 0.01) errors.push("Footprint excede largura util do terreno.");
    if (constraints.envelope && footprint.depth > constraints.envelope.depth + 0.01) errors.push("Footprint excede profundidade util do terreno.");
    if (constraints.suiteRequired && !rooms.some((room) => room.id === "suite")) errors.push("Suite obrigatoria nao foi preservada.");
    if (constraints.socialIntegratedRequired && !rooms.some((room) => room.id === "social")) errors.push("Area social integrada obrigatoria ausente.");
    rooms.filter((room) => room.compacted).forEach((room) => warnings.push(`${room.name} ficou abaixo do ideal; revisar dimensoes.`));
    (adaptedTemplate.warnings || []).forEach((item) => warnings.push(item));
    return { ok: errors.length === 0, errors, warnings };
  }

  window.CadistaParametricLayoutEngine = {
    adaptCadistaTemplateToLot,
    normalizeCadistaParametricIntent,
    validateCadistaParametricLayout
  };
  window.adaptCadistaTemplateToLot = adaptCadistaTemplateToLot;
  window.normalizeCadistaParametricIntent = normalizeCadistaParametricIntent;
  window.validateCadistaParametricLayout = validateCadistaParametricLayout;
})();
