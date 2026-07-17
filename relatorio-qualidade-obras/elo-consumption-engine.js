(function (root) {
  "use strict";

  const VERSION = "20260624-elo-consumption-engine-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function round(value) { return Math.round(number(value) * 1000) / 1000; }

  function unit(value) {
    const text = normalize(value).replace(/m2|m 2|metro quadrado|metros quadrados/g, "m2").replace(/m3|m 3|metro cubico|metros cubicos/g, "m3");
    if (/^(m2)$/.test(text)) return "m2";
    if (/^(m3)$/.test(text)) return "m3";
    if (/^(kg|quilo|quilos)$/.test(text)) return "kg";
    if (/^(l|litro|litros)$/.test(text)) return "l";
    if (/^(un|und|unidade|unidades)$/.test(text)) return "un";
    if (/^(h|hora|horas)$/.test(text)) return "h";
    return text;
  }

  function isCompatible(a, b) { return unit(a) && unit(a) === unit(b); }
  function inputsOf(composition) { return composition && (composition.inputs || composition.materials || composition.insumos || []) || []; }
  function coefficientOf(input) { return number(input.coefficient !== undefined ? input.coefficient : input.quantityPerUnit); }
  function typeOf(input) {
    const declared = normalize(input.type || input.tipo || input.inputType || "");
    const inputUnit = unit(input.unit || input.inputUnit || input.coefficientUnit || "");
    const name = normalize([input.name, input.description, input.material, input.inputName].join(" "));
    const text = [declared, inputUnit, name].join(" ");
    if (/equip|vibrador|guincho|compactador|escavadeira|retroescavadeira|martelete/.test(text) || /^(chp|chi)$/.test(inputUnit)) return "equipment";
    if (/mao|obra|labor|pedreiro|servente|telhadista|carpinteiro|ajudante|encargos complementares/.test(text) || inputUnit === "h") return "labor";
    return "material";
  }

  function conversionFor(input, total, inputUnit) {
    const name = normalize([input.name, input.description, input.material].join(" "));
    const u = unit(inputUnit);
    if (u === "kg" && /cimento/.test(name)) return { available: true, display: "sacos de 50 kg", factor: 50, totalConverted: round(total / 50), unit: "sacos" };
    if (u === "kg" && /argamassa/.test(name)) return { available: true, display: "sacos de 20 kg", factor: 20, totalConverted: round(total / 20), unit: "sacos" };
    if (u === "m3" && /agua|água/.test(name)) return { available: true, display: "litros", factor: 1000, totalConverted: round(total * 1000), unit: "l" };
    if (u === "l" && /agua|água/.test(name)) return { available: true, display: "m3", factor: 1000, totalConverted: round(total / 1000), unit: "m3" };
    if (u === "un") return { available: true, display: "unidades", factor: 1, totalConverted: round(total), unit: "un" };
    if (u === "m3") return { available: false, display: "m3 permanece m3", factor: 1, totalConverted: round(total), unit: "m3" };
    if (u === "h") return { available: false, display: "horas permanecem horas", factor: 1, totalConverted: round(total), unit: "h" };
    return { available: false };
  }

  function getComposition(match) {
    return match && (match.composition || match.candidate || match.candidates && match.candidates[0]) || null;
  }

  function calculateConsumptionFromCompositions(quantities, compositionMatches) {
    const consumptions = [];
    const blocked = [];
    const matches = compositionMatches || [];
    (quantities || []).forEach(function (quantity) {
      if (!quantity || quantity.source === "pending" || !number(quantity.quantity)) return;
      const match = matches.find(function (item) {
        return item && (item.serviceId === quantity.serviceId || item.packageId === quantity.packageId || item.scopeId === quantity.packageId) && item.found !== false;
      });
      const composition = getComposition(match);
      if (!composition) {
        blocked.push({ packageId: quantity.packageId, serviceId: quantity.serviceId, reason: "composition_not_found" });
        return;
      }
      const compositionUnit = unit(composition.unit || composition.productionUnit || match.unit);
      if (!isCompatible(compositionUnit, quantity.unit)) {
        blocked.push({ packageId: quantity.packageId, serviceId: quantity.serviceId, reason: "unit_incompatible", quantityUnit: unit(quantity.unit), compositionUnit: compositionUnit, compositionCode: composition.code });
        return;
      }
      const inputs = inputsOf(composition);
      if (!inputs.length) {
        blocked.push({ packageId: quantity.packageId, serviceId: quantity.serviceId, reason: "composition_without_inputs", compositionCode: composition.code });
        return;
      }
      const warnings = [];
      const calculatedInputs = [];
      let hasInvalid = false;
      inputs.forEach(function (input) {
        const coefficient = coefficientOf(input);
        if (coefficient <= 0) {
          hasInvalid = true;
          return;
        }
        const total = round(coefficient * number(quantity.quantity));
        const inputUnit = unit(input.unit || input.inputUnit || input.coefficientUnit || "un");
        calculatedInputs.push({
          code: clean(input.code || input.id || input.inputCode),
          name: clean(input.name || input.description || input.material || input.inputName),
          type: typeOf(input),
          coefficient: coefficient,
          coefficientUnit: inputUnit,
          total: total,
          unit: inputUnit,
          unitPrice: input.unitPrice,
          precoUnitario: input.precoUnitario,
          totalCost: input.totalCost,
          custoTotal: input.custoTotal,
          conversion: conversionFor(input, total, inputUnit)
        });
      });
      if (hasInvalid) {
        blocked.push({ packageId: quantity.packageId, serviceId: quantity.serviceId, reason: "coefficient_missing_or_invalid", compositionCode: composition.code });
        return;
      }
      consumptions.push({
        packageId: quantity.packageId,
        serviceId: quantity.serviceId,
        compositionCode: clean(composition.code),
        compositionDescription: clean(composition.description || composition.name || composition.service),
        compositionUnit: compositionUnit,
        quantity: number(quantity.quantity),
        unit: unit(quantity.unit),
        inputs: calculatedInputs,
        memory: ["total = coeficiente × quantidade"],
        warnings: warnings
      });
    });
    return { consumptions: consumptions, blocked: blocked };
  }

  root.EloConsumptionEngine = { version: VERSION, calculateConsumptionFromCompositions: calculateConsumptionFromCompositions };
})(typeof window !== "undefined" ? window : globalThis);
