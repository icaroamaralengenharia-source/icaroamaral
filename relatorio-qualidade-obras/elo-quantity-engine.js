(function (root) {
  "use strict";

  const VERSION = "20260624-elo-quantity-engine-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function round(value) { return Math.round(number(value) * 1000) / 1000; }

  function addQuantity(list, item) {
    if (!item || !item.serviceId) return;
    const exists = list.some(function (existing) { return existing.packageId === item.packageId && existing.serviceId === item.serviceId; });
    if (!exists) list.push(item);
  }

  function missingPush(list, id, message) {
    if (!list.some(function (item) { return item.id === id; })) list.push({ id: id, message: message });
  }

  function estimateQuantities(projectFacts, workPackages) {
    const facts = projectFacts || {};
    const quantities = [];
    const missing = [];
    const builtArea = number(facts.builtAreaM2 || facts.areaConstruidaM2);
    const floorArea = number(facts.floorAreaM2);
    const roofArea = number(facts.roofAreaM2);
    const wallArea = number(facts.wallAreaM2);
    const wallPerimeter = number(facts.wallPerimeterM);
    const wallHeight = number(facts.wallHeightM);

    if (builtArea > 0) {
      addQuantity(quantities, { packageId: "servicos_preliminares", serviceId: "area_construida", description: "Área construída informada", quantity: round(builtArea), unit: "m2", source: "informed", confidence: 1, formula: "informado pelo usuário", warnings: [] });
    }

    if (facts.floorMaterial && floorArea > 0) {
      addQuantity(quantities, { packageId: "piso_revestimento", serviceId: "piso_ceramico", description: "Área de piso cerâmico", quantity: round(floorArea), unit: "m2", source: "informed", confidence: 1, formula: "informado pelo usuário", warnings: [] });
    } else if (facts.floorMaterial && builtArea > 0) {
      addQuantity(quantities, { packageId: "piso_revestimento", serviceId: "piso_ceramico", description: "Área preliminar de piso", quantity: round(builtArea), unit: "m2", source: "estimated", confidence: 0.65, formula: "área construída usada como aproximação preliminar de piso", warnings: ["Confirme a área real de piso/revestimento."] });
    } else if (!facts.floorMaterial) {
      missingPush(missing, "floor_material", "Informe tipo de piso/revestimento.");
    }

    if (facts.roofMaterial && roofArea > 0) {
      addQuantity(quantities, { packageId: "cobertura", serviceId: "cobertura_telha", description: "Área de cobertura", quantity: round(roofArea), unit: "m2", source: "informed", confidence: 1, formula: "informado pelo usuário", warnings: [] });
    } else if (facts.roofMaterial && builtArea > 0) {
      addQuantity(quantities, { packageId: "cobertura", serviceId: "cobertura_telha", description: "Área preliminar de cobertura", quantity: round(builtArea), unit: "m2", source: "estimated", confidence: 0.55, formula: "área construída usada como aproximação preliminar de cobertura", warnings: ["Não considera inclinação, beiral e perdas."] });
    } else if (!facts.roofMaterial) {
      missingPush(missing, "roof_material", "Informe tipo de cobertura/telha.");
    }

    if (number(facts.contrapisoAreaM2) > 0 && number(facts.contrapisoThicknessCm) > 0) {
      const volume = number(facts.contrapisoAreaM2) * number(facts.contrapisoThicknessCm) / 100;
      addQuantity(quantities, { packageId: "contrapiso", serviceId: "contrapiso_argamassa", description: "Volume de contrapiso", quantity: round(volume), unit: "m3", source: "estimated", confidence: 0.8, formula: "area × espessura", warnings: [] });
    } else if (number(facts.contrapisoAreaM2 || facts.floorAreaM2) > 0 && !number(facts.contrapisoThicknessCm)) {
      missingPush(missing, "contrapiso_thickness", "Informe espessura do contrapiso para calcular volume.");
    }

    if (number(facts.slabAreaM2) > 0 && number(facts.slabThicknessCm) > 0) {
      const slabVolume = number(facts.slabAreaM2) * number(facts.slabThicknessCm) / 100;
      addQuantity(quantities, { packageId: "estrutura", serviceId: "laje_concreto", description: "Volume de laje/concreto", quantity: round(slabVolume), unit: "m3", source: "estimated", confidence: 0.8, formula: "area × espessura", warnings: [] });
    }

    if (wallArea > 0) {
      addQuantity(quantities, { packageId: "alvenaria", serviceId: "alvenaria_bloco", description: "Área de alvenaria", quantity: round(wallArea), unit: "m2", source: "informed", confidence: 1, formula: "informado pelo usuário", warnings: [] });
    } else if (wallPerimeter > 0 && wallHeight > 0) {
      addQuantity(quantities, { packageId: "alvenaria", serviceId: "alvenaria_bloco", description: "Área de alvenaria", quantity: round(wallPerimeter * wallHeight), unit: "m2", source: "estimated", confidence: 0.75, formula: "perímetro × altura", warnings: ["Não desconta vãos de portas e janelas."] });
    } else if (wallHeight > 0 || builtArea > 0 || clean(facts.wallMaterial)) {
      missingPush(missing, "wall_area", "Informe perímetro ou área de alvenaria.");
    }

    if (number(facts.paintAreaM2) > 0) {
      addQuantity(quantities, { packageId: "pintura", serviceId: "pintura_parede", description: "Área de pintura", quantity: round(facts.paintAreaM2), unit: "m2", source: "informed", confidence: 1, formula: "informado pelo usuário", warnings: [] });
    }

    (workPackages && workPackages.packages || []).forEach(function (pack) {
      (pack.missing || []).forEach(function (item) {
        missingPush(missing, pack.id + ":" + item, pack.name + ": faltam dados - " + item + ".");
      });
    });

    return { quantities: quantities, missing: missing };
  }

  root.EloQuantityEngine = { version: VERSION, estimateQuantities: estimateQuantities };
})(typeof window !== "undefined" ? window : globalThis);
