(function (root) {
  "use strict";

  const VERSION = "20260705-elo-parametric-composition-engine-v1";
  const CERAMIC_LOSS = 0.05;
  const MIX_LOSS = 0.10;
  const CEMENT_BAG_KG = 50;
  const MORTAR_BAG_KG = 20;

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function number(value) {
    if (value === null || value === undefined || value === "") return 0;
    const parsed = Number(String(value).replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function round(value, precision) {
    const factor = Math.pow(10, precision == null ? 2 : precision);
    return Math.round(number(value) * factor) / factor;
  }
  function ceil(value) { return Math.ceil(number(value)); }
  function m(value) { return round(value, 3); }

  function requireParams(params, fields) {
    const missing = [];
    fields.forEach(function (field) {
      if (!number(params[field.id]) && !clean(params[field.id])) missing.push(field);
    });
    return missing;
  }

  function ask(missing) {
    return missing.map(function (field) { return field.question; });
  }

  function addPurchase(target, key, name, quantity, unit, source, wastePercent) {
    if (!number(quantity)) return;
    if (!target[key]) target[key] = { id: key, item: name, quantity: 0, unit: unit, sources: [], wastePercent: wastePercent || 0 };
    target[key].quantity += number(quantity);
    if (source) target[key].sources.push(source);
    target[key].quantity = round(target[key].quantity, 3);
  }

  function listFromPurchases(purchases) {
    return Object.keys(purchases).map(function (key) {
      return purchases[key];
    });
  }

  function cementBagsFromConcreteM3(volumeM3) {
    return ceil(volumeM3 * 7 * (1 + MIX_LOSS));
  }
  function sandFromConcreteM3(volumeM3) { return m(volumeM3 * 0.55 * (1 + MIX_LOSS)); }
  function gravelFromConcreteM3(volumeM3) { return m(volumeM3 * 0.85 * (1 + MIX_LOSS)); }
  function waterFromConcreteM3(volumeM3) { return ceil(volumeM3 * 180 * (1 + MIX_LOSS)); }
  function cementBagsFromMortarM3(volumeM3) {
    return ceil(volumeM3 * 6 * (1 + MIX_LOSS));
  }
  function sandFromMortarM3(volumeM3) { return m(volumeM3 * 1.08 * (1 + MIX_LOSS)); }
  function limeKgFromMortarM3(volumeM3) { return ceil(volumeM3 * 100 * (1 + MIX_LOSS)); }

  function resultNeeds(recipe, params, missing) {
    return {
      version: VERSION,
      status: "needs_parameters",
      recipe: recipe,
      parameters: params || {},
      missingParameters: missing.map(function (field) { return field.id; }),
      questions: ask(missing),
      eap: [],
      shoppingList: [],
      assumptions: []
    };
  }

  function resultReady(recipe, params, eap, purchases, assumptions, quantities) {
    return {
      version: VERSION,
      status: "ready",
      recipe: recipe,
      parameters: params,
      eap: eap,
      quantities: quantities || [],
      shoppingList: listFromPurchases(purchases),
      assumptions: assumptions || [],
      wasteRules: {
        ceramicMaterials: "5%",
        concreteAndMortar: "10%"
      }
    };
  }

  function isolatedFooting(params) {
    const p = params || {};
    const missing = requireParams(p, [
      { id: "quantity", question: "Quantas sapatas isoladas serao executadas?" },
      { id: "widthM", question: "Qual a largura de cada sapata em metros? Ex: 0,60." },
      { id: "lengthM", question: "Qual o comprimento de cada sapata em metros? Ex: 0,60." },
      { id: "heightM", question: "Qual a altura/espessura de cada sapata em metros?" },
      { id: "fckMpa", question: "Qual o fck do concreto em MPa?" },
      { id: "steelRateKgM3", question: "Qual a taxa de aco esperada em kg/m3?" }
    ]);
    if (missing.length) return resultNeeds("sapata_isolada", p, missing);

    const quantity = number(p.quantity);
    const width = number(p.widthM);
    const length = number(p.lengthM);
    const height = number(p.heightM);
    const steelRate = number(p.steelRateKgM3);
    const lastroThickness = number(p.leanConcreteThicknessM) || 0.05;
    const excavationDepth = height + lastroThickness + 0.1;
    const excavationVolume = m((width + 0.2) * (length + 0.2) * excavationDepth * quantity);
    const lastroVolume = m(width * length * lastroThickness * quantity);
    const concreteVolume = m(width * length * height * quantity);
    const formArea = m(2 * (width + length) * height * quantity);
    const steelKg = m(concreteVolume * steelRate);
    const reaterroVolume = m(Math.max(0, excavationVolume - lastroVolume - concreteVolume));
    const purchases = {};

    addPurchase(purchases, "cimento_50kg", "Cimento CP II 50 kg", cementBagsFromConcreteM3(concreteVolume + lastroVolume), "sacos", "concreto estrutural + lastro", 10);
    addPurchase(purchases, "areia_media", "Areia media", sandFromConcreteM3(concreteVolume + lastroVolume), "m3", "concreto estrutural + lastro", 10);
    addPurchase(purchases, "brita_1", "Brita 1", gravelFromConcreteM3(concreteVolume + lastroVolume), "m3", "concreto estrutural + lastro", 10);
    addPurchase(purchases, "agua", "Agua", waterFromConcreteM3(concreteVolume + lastroVolume), "l", "concreto estrutural + lastro", 10);
    addPurchase(purchases, "aco_ca50", "Aco CA-50", steelKg, "kg", "taxa informada", 0);
    addPurchase(purchases, "madeira_forma", "Madeira/chapas para forma", m(formArea * 1.1), "m2", "forma lateral", 10);

    return resultReady("sapata_isolada", p, [
      "Escavacao manual",
      "Lastro de concreto magro",
      "Forma de madeira",
      "Armacao de aco",
      "Concreto estrutural",
      "Reaterro compactado"
    ], purchases, [
      "Lastro adotado: " + lastroThickness + " m.",
      "Folga de escavacao adotada: 10 cm por lado e 10 cm no fundo.",
      "Concreto/argamassa com perda automatica de 10%."
    ], [
      { item: "Escavacao manual", quantity: excavationVolume, unit: "m3" },
      { item: "Lastro de concreto magro", quantity: lastroVolume, unit: "m3" },
      { item: "Forma de madeira", quantity: formArea, unit: "m2" },
      { item: "Armacao de aco", quantity: steelKg, unit: "kg" },
      { item: "Concreto estrutural fck " + number(p.fckMpa) + " MPa", quantity: concreteVolume, unit: "m3" },
      { item: "Reaterro compactado", quantity: reaterroVolume, unit: "m3" }
    ]);
  }

  function gradeBeam(params) {
    const p = params || {};
    const missing = requireParams(p, [
      { id: "lengthM", question: "Qual o comprimento total da viga baldrame em metros?" },
      { id: "widthM", question: "Qual a largura da secao da viga em metros?" },
      { id: "heightM", question: "Qual a altura da secao da viga em metros?" },
      { id: "fckMpa", question: "Qual o fck do concreto em MPa?" },
      { id: "steelRateKgM3", question: "Qual a taxa de aco esperada em kg/m3?" }
    ]);
    if (missing.length) return resultNeeds("viga_baldrame", p, missing);

    const length = number(p.lengthM);
    const width = number(p.widthM);
    const height = number(p.heightM);
    const steelRate = number(p.steelRateKgM3);
    const concreteVolume = m(length * width * height);
    const formArea = m(2 * length * height);
    const steelKg = m(concreteVolume * steelRate);
    const purchases = {};

    addPurchase(purchases, "cimento_50kg", "Cimento CP II 50 kg", cementBagsFromConcreteM3(concreteVolume), "sacos", "concreto estrutural", 10);
    addPurchase(purchases, "areia_media", "Areia media", sandFromConcreteM3(concreteVolume), "m3", "concreto estrutural", 10);
    addPurchase(purchases, "brita_1", "Brita 1", gravelFromConcreteM3(concreteVolume), "m3", "concreto estrutural", 10);
    addPurchase(purchases, "agua", "Agua", waterFromConcreteM3(concreteVolume), "l", "concreto estrutural", 10);
    addPurchase(purchases, "aco_ca50", "Aco CA-50", steelKg, "kg", "taxa informada", 0);
    addPurchase(purchases, "madeira_forma", "Madeira/chapas para forma", m(formArea * 1.1), "m2", "forma lateral", 10);

    return resultReady("viga_baldrame", p, [
      "Escavacao/regularizacao da vala",
      "Forma de madeira",
      "Armacao de aco",
      "Concreto estrutural",
      "Impermeabilizacao superior quando aplicavel",
      "Reaterro compactado"
    ], purchases, ["Concreto com perda automatica de 10%."], [
      { item: "Forma de madeira", quantity: formArea, unit: "m2" },
      { item: "Armacao de aco", quantity: steelKg, unit: "kg" },
      { item: "Concreto estrutural fck " + number(p.fckMpa) + " MPa", quantity: concreteVolume, unit: "m3" }
    ]);
  }

  function masonryWall(params) {
    const p = params || {};
    const missing = requireParams(p, [
      { id: "lengthM", question: "Qual o comprimento total da parede em metros?" },
      { id: "heightM", question: "Qual a altura da parede em metros?" },
      { id: "blockType", question: "Qual o bloco/tijolo? Ex: bloco ceramico 14x19x29." },
      { id: "faces", question: "Chapisco/reboco em uma face ou nas duas faces?" }
    ]);
    if (missing.length) return resultNeeds("parede_alvenaria", p, missing);

    const area = m(number(p.lengthM) * number(p.heightM) - number(p.openingsM2));
    const faces = Math.max(1, number(p.faces));
    const blockPerM2 = number(p.blocksPerM2) || 16.7;
    const mortarM3 = m(area * (number(p.mortarM3PerM2) || 0.018));
    const coatingArea = m(area * faces);
    const chapiscoM3 = m(coatingArea * 0.005);
    const rebocoM3 = m(coatingArea * 0.02);
    const purchases = {};

    addPurchase(purchases, "bloco_ceramico", clean(p.blockType), ceil(area * blockPerM2 * (1 + CERAMIC_LOSS)), "pecas", "alvenaria", 5);
    addPurchase(purchases, "cimento_50kg", "Cimento CP II 50 kg", cementBagsFromMortarM3(mortarM3 + chapiscoM3 + rebocoM3), "sacos", "assentamento + chapisco + reboco", 10);
    addPurchase(purchases, "areia_media", "Areia media", sandFromMortarM3(mortarM3 + chapiscoM3 + rebocoM3), "m3", "assentamento + chapisco + reboco", 10);
    addPurchase(purchases, "cal_hidratada", "Cal hidratada", limeKgFromMortarM3(rebocoM3 + mortarM3), "kg", "argamassas", 10);
    addPurchase(purchases, "agua", "Agua", ceil((mortarM3 + chapiscoM3 + rebocoM3) * 220 * (1 + MIX_LOSS)), "l", "argamassas", 10);

    return resultReady("parede_alvenaria", p, [
      "Marcacao e prumo",
      "Assentamento de alvenaria",
      "Argamassa de assentamento",
      "Chapisco",
      "Emboco/reboco",
      "Limpeza final"
    ], purchases, [
      "Blocos ceramicos com perda automatica de 5%.",
      "Argamassas com perda automatica de 10%.",
      "Vaos descontados apenas quando openingsM2 for informado."
    ], [
      { item: "Area liquida de alvenaria", quantity: area, unit: "m2" },
      { item: "Argamassa de assentamento", quantity: mortarM3, unit: "m3" },
      { item: "Chapisco", quantity: chapiscoM3, unit: "m3" },
      { item: "Emboco/reboco", quantity: rebocoM3, unit: "m3" }
    ]);
  }

  function ceramicFloor(params) {
    const p = params || {};
    const missing = requireParams(p, [
      { id: "areaM2", question: "Qual a area total do piso em m2?" },
      { id: "contrapisoThicknessCm", question: "Qual a espessura do contrapiso em cm?" },
      { id: "tileBoxM2", question: "Quantos m2 vem em cada caixa do piso ceramico?" }
    ]);
    if (missing.length) return resultNeeds("piso_ceramico", p, missing);

    const area = number(p.areaM2);
    const thickness = number(p.contrapisoThicknessCm) / 100;
    const contrapisoM3 = m(area * thickness);
    const ceramicM2 = m(area * (1 + CERAMIC_LOSS));
    const tileBoxes = ceil(ceramicM2 / number(p.tileBoxM2));
    const adhesiveKg = m(area * (number(p.adhesiveKgM2) || 5) * (1 + MIX_LOSS));
    const groutKg = m(area * (number(p.groutKgM2) || 0.5) * (1 + CERAMIC_LOSS));
    const purchases = {};

    addPurchase(purchases, "piso_ceramico", "Piso ceramico", tileBoxes, "caixas", "area + perda", 5);
    addPurchase(purchases, "argamassa_colante_20kg", "Argamassa colante AC", ceil(adhesiveKg / MORTAR_BAG_KG), "sacos de 20 kg", "assentamento do piso", 10);
    addPurchase(purchases, "rejunte_kg", "Rejunte", groutKg, "kg", "juntas do piso", 5);
    addPurchase(purchases, "cimento_50kg", "Cimento CP II 50 kg", cementBagsFromMortarM3(contrapisoM3), "sacos", "contrapiso", 10);
    addPurchase(purchases, "areia_media", "Areia media", sandFromMortarM3(contrapisoM3), "m3", "contrapiso", 10);
    addPurchase(purchases, "agua", "Agua", ceil(contrapisoM3 * 220 * (1 + MIX_LOSS)), "l", "contrapiso", 10);

    return resultReady("piso_ceramico", p, [
      "Limpeza e preparacao da base",
      "Execucao de contrapiso",
      "Regularizacao",
      "Assentamento do piso ceramico",
      "Rejuntamento",
      "Limpeza final"
    ], purchases, [
      "Piso ceramico com perda automatica de 5%.",
      "Contrapiso e argamassa colante com perda automatica de 10%."
    ], [
      { item: "Contrapiso", quantity: contrapisoM3, unit: "m3" },
      { item: "Piso ceramico com perda", quantity: ceramicM2, unit: "m2" },
      { item: "Argamassa colante", quantity: adhesiveKg, unit: "kg" },
      { item: "Rejunte", quantity: groutKg, unit: "kg" }
    ]);
  }

  function doorInstallation(params) {
    const p = params || {};
    const missing = requireParams(p, [
      { id: "quantity", question: "Quantas portas serao instaladas?" },
      { id: "widthM", question: "Qual a largura da folha da porta em metros?" },
      { id: "heightM", question: "Qual a altura da folha da porta em metros?" }
    ]);
    if (missing.length) return resultNeeds("instalacao_porta", p, missing);

    const quantity = number(p.quantity);
    const purchases = {};
    addPurchase(purchases, "folha_porta", "Folha de porta " + number(p.widthM) + " x " + number(p.heightM) + " m", quantity, "pecas", "porta", 0);
    addPurchase(purchases, "kit_marco", "Kit marco/batente", quantity, "kits", "marco", 0);
    addPurchase(purchases, "alizar_guarnicao", "Alizar/guarnicao", m(quantity * 5.2), "m", "acabamento do vao", 5);
    addPurchase(purchases, "dobradica", "Dobradica", quantity * 3, "pecas", "3 por porta", 0);
    addPurchase(purchases, "fechadura", "Fechadura completa", quantity, "kits", "1 por porta", 0);
    addPurchase(purchases, "parafusos_buchas", "Parafusos e buchas", quantity * 8, "conjuntos", "fixacao", 0);
    addPurchase(purchases, "espuma_argamassa_fixacao", "Espuma expansiva ou argamassa de fixacao", quantity, "un", "fixacao do marco", 10);

    return resultReady("instalacao_porta", p, [
      "Conferencia do vao",
      "Instalacao do marco/batente",
      "Fixacao da folha",
      "Instalacao de dobradicas",
      "Instalacao de fechadura",
      "Colocacao de alizares/guarnicoes",
      "Ajustes e limpeza final"
    ], purchases, ["Guarnicao considerada em 5,2 m por porta, com 5% de perda."], [
      { item: "Portas instaladas", quantity: quantity, unit: "un" }
    ]);
  }

  function recipeFromText(text) {
    const value = normalize(text);
    if (/sapata/.test(value)) return "sapata_isolada";
    if (/baldrame|viga/.test(value)) return "viga_baldrame";
    if (/parede|alvenaria|muro/.test(value)) return "parede_alvenaria";
    if (/piso|ceram/.test(value)) return "piso_ceramico";
    if (/porta/.test(value)) return "instalacao_porta";
    return "";
  }

  function extractPair(text) {
    const raw = clean(text);
    const match = raw.match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/i);
    if (!match) return null;
    return { first: number(match[1]), second: number(match[2]) };
  }

  function paramsFromText(text, overrides) {
    const params = Object.assign({}, overrides || {});
    const recipe = params.recipe || recipeFromText(text);
    const pair = extractPair(text);
    if (pair && recipe === "parede_alvenaria") {
      if (!params.lengthM) params.lengthM = pair.first;
      if (!params.heightM) params.heightM = pair.second;
    }
    if (pair && recipe === "viga_baldrame") {
      if (!params.widthM) params.widthM = pair.first > 5 ? pair.first / 100 : pair.first;
      if (!params.heightM) params.heightM = pair.second > 5 ? pair.second / 100 : pair.second;
    }
    if (pair && recipe === "sapata_isolada") {
      if (!params.widthM) params.widthM = pair.first > 10 ? pair.first / 100 : pair.first;
      if (!params.lengthM) params.lengthM = pair.second > 10 ? pair.second / 100 : pair.second;
    }
    const areaMatch = clean(text).match(/(\d+(?:[,.]\d+)?)\s*m[²2]/i);
    if (areaMatch && recipe === "piso_ceramico" && !params.areaM2) params.areaM2 = number(areaMatch[1]);
    const quantityMatch = clean(text).match(/(\d+)\s+portas?/i);
    if (quantityMatch && recipe === "instalacao_porta" && !params.quantity) params.quantity = number(quantityMatch[1]);
    params.recipe = recipe;
    return params;
  }

  function calculate(input) {
    const safe = input || {};
    const recipe = clean(safe.recipe || safe.type || safe.item);
    if (recipe === "sapata_isolada") return isolatedFooting(safe);
    if (recipe === "viga_baldrame") return gradeBeam(safe);
    if (recipe === "parede_alvenaria") return masonryWall(safe);
    if (recipe === "piso_ceramico") return ceramicFloor(safe);
    if (recipe === "instalacao_porta") return doorInstallation(safe);
    return resultNeeds("desconhecido", safe, [{ id: "recipe", question: "Qual item voce quer calcular: sapata isolada, viga baldrame, parede, piso ceramico ou porta?" }]);
  }

  function calculateFromText(text, overrides) {
    return calculate(paramsFromText(text, overrides || {}));
  }

  root.EloParametricCompositionEngine = {
    version: VERSION,
    calculate: calculate,
    calculateFromText: calculateFromText,
    paramsFromText: paramsFromText
  };
  root.EloBCP = root.EloParametricCompositionEngine;
})(typeof window !== "undefined" ? window : globalThis);

