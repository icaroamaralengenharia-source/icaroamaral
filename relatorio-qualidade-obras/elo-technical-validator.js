(function (root) {
  "use strict";

  const FCK_QUESTION = "Antes de calcular, preciso confirmar o FCK do concreto. Qual será o FCK desejado? Ex.: 15, 20, 25 ou 30 MPa. Também confirme o uso: passeio, piso residencial, garagem ou área com carga pesada.";
  const BLOCK_DIMENSION_QUESTION = "Antes de calcular, preciso confirmar a dimensão real do bloco cerâmico. Ele é 29x19x14, 39x19x14 ou outra medida?";
  const OPENINGS_QUESTION = [
    "Antes de calcular, preciso saber se existem vãos para descontar.",
    "A parede terá portas ou janelas?",
    "Se sim, informe quantidade e medidas. Ex.:",
    "- 1 porta de 0,80 x 2,10 m",
    "- 2 janelas de 1,20 x 1,00 m",
    "Ou confirme: parede íntegra, sem vãos."
  ].join("\n");
  const COATING_SIDE_QUESTION = "Você deseja considerar revestimento em um lado ou nos dois lados da parede?";
  const COATING_THICKNESS_QUESTION = "Antes de calcular o revestimento, preciso confirmar a espessura. Qual será a espessura do chapisco, emboço ou reboco?";
  const PAVEMENT_DIMENSIONS_QUESTION = "Antes de calcular, preciso das dimensões do piso ou da área total. Informe comprimento e largura, por exemplo: 5 m x 4 m, ou a área em m².";
  const PAVEMENT_JOINT_QUESTION = "Antes de calcular, preciso confirmar a largura da junta entre as peças. Qual será a junta? Ex.: 3 mm, 5 mm, 1 cm.";
  const PAVEMENT_PIECE_QUESTION = "Para calcular quantidade de peças, preciso da dimensão da peça. Ex.: paver 10x20 cm, bloco intertravado 16 faces, paralelepípedo 10x10x20 cm, ou outra medida real.";
  const PAVEMENT_BASE_QUESTION = "Antes de calcular, preciso confirmar a base/assentamento do piso. Será colchão de areia, pó de pedra, base de brita ou outra solução?";
  const PAVEMENT_LOSS_QUESTION = "Antes de calcular, preciso confirmar a perda adotada para o piso. Qual percentual de perda deseja considerar?";
  const PAVEMENT_USE_QUESTION = "Antes de calcular, preciso confirmar o uso do piso: passeio/calçada, garagem, tráfego leve ou tráfego pesado?";
  const PAVEMENT_MISSING_BASE_ANSWER = "Para calcular esse piso com segurança, preciso localizar uma composição SINAPI/ORSE compatível para o tipo de pavimentação, base, assentamento e rejuntamento informados.";
  const PAINTING_DIMENSIONS_QUESTION = "Antes de calcular pintura, preciso da área ou das dimensões. Informe comprimento e altura da parede/muro ou a área em m².";
  const PAINTING_ENVIRONMENT_QUESTION = "A pintura é interna ou externa? Isso muda o sistema de pintura e a composição SINAPI/ORSE.";
  const PAINTING_SYSTEM_QUESTION = "Qual sistema deseja considerar? Ex.: selador + 2 demãos de tinta, massa corrida + selador + tinta, ou apenas repintura.";
  const PAINTING_SURFACE_QUESTION = "Antes de calcular pintura, preciso confirmar a superfície: reboco novo, reboco antigo, massa corrida, textura, alvenaria aparente ou muro externo?";
  const PAINTING_COATS_QUESTION = "Antes de calcular pintura, preciso confirmar o número de demãos.";
  const PAINTING_PAINT_TYPE_QUESTION = "Antes de calcular pintura, preciso confirmar o tipo de tinta: acrílica, látex/PVA, esmalte ou outra.";
  const PAINTING_MISSING_BASE_ANSWER = "Para calcular pintura com segurança, preciso localizar uma composição SINAPI/ORSE compatível com o tipo de superfície, sistema de pintura e número de demãos.";
  const MISSING_BASE_ANSWER = [
    "Para gerar quantitativo, mão de obra ou valor com segurança, preciso localizar uma composição técnica, como SINAPI ou ORSE. No momento não encontrei uma composição correspondente com os dados informados. Posso continuar de duas formas:",
    "1. você informa o código/composição SINAPI/ORSE;",
    "2. eu faço uma estimativa preliminar, claramente marcada como NÃO OFICIAL."
  ].join("\n");

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalize(value) {
    return clean(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function hasAny(text, terms) {
    return terms.some(function (term) {
      return text.indexOf(term) >= 0;
    });
  }

  function parseNumber(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function hasConcreteSubject(text) {
    return /\b(concreto|piso de concreto|laje|contrapiso|radier|viga|pilar|sapata|baldrame|fundacao|fundacao)\b/.test(text);
  }

  function hasWallSubject(text) {
    return /\b(parede|muro|alvenaria|bloco|bloco baiano|tijolo|tijolos)\b/.test(text);
  }

  function hasCoatingSubject(text) {
    return /\b(revestimento|chapisco|emboco|emboço|reboco|argamassa)\b/.test(text);
  }

  function hasPavementSubject(text) {
    return /\b(paralelepipedo|paralelo|pedra portuguesa|piso intertravado|concreto intertravado|intertravado|paver|bloquete|pavimento intertravado|calcamento|calcada intertravada|calcar|calcada)\b/.test(text);
  }

  function hasPaintingSubject(text) {
    return /\b(pinta|pintar|pintar parede|pintura de parede|pintar muro|pintura de muro|tinta|tinta acrilica|tinta latex|pintura interna|pintura externa|pintura residencial|massa corrida|selador|fundo preparador|pintar uma parede|pintar meu muro|pintura)\b/.test(text);
  }

  function hasQuantityIntent(text) {
    return /\b(quantitativo|quantidade|quantos|quanto|calcule|calcular|orcamento|orçamento|custo|valor|preco|preço|mao de obra|mão de obra|produtividade|consumo|materiais?|material|previsao|previsão|estimativa|estimar|executar|fazer|colocar|calcar|calcamento|pintar|pinta|pintura|gasto|comprar|compro|custa)\b/.test(text) ||
      /\d+(?:[,.]\d+)?\s*(?:m2|m²|m3|m³|m|metros?|cm)\b/.test(text);
  }

  function hasTechnicalIntent(text) {
    return hasQuantityIntent(text) && (hasConcreteSubject(text) || hasWallSubject(text) || hasCoatingSubject(text) || hasPavementSubject(text) || hasPaintingSubject(text));
  }

  function hasFck(text) {
    return /\bfck\s*\d{2}\b/.test(text) || /\b\d{2}\s*mpa\b/.test(text);
  }

  function hasBlockDimension(text) {
    return /\b(?:bloco\s*)?\d{1,2}\s*x\s*\d{1,2}\s*x\s*\d{1,2}\b/.test(text) ||
      /\b(?:bloco\s*)?\d{1,2}\s*cm\s*x\s*\d{1,2}\s*cm\s*x\s*\d{1,2}\s*cm\b/.test(text);
  }

  function hasOpeningsConfirmation(text) {
    return /\b(sem portas?|sem janelas?|sem vaos?|sem vãos|parede integra|parede íntegra|sem abertura|sem aberturas)\b/.test(text) ||
      /\b(porta|portas|janela|janelas)\b.*\d+(?:[,.]\d+)?\s*(?:x|por)\s*\d+(?:[,.]\d+)?/.test(text);
  }

  function hasLoss(text) {
    return /\b(perda|perdas)\b.*\d+(?:[,.]\d+)?\s*%/.test(text) || /\d+(?:[,.]\d+)?\s*%\s*(?:de\s*)?perda/.test(text);
  }

  function hasCoatingSide(text) {
    return /\b(um lado|uma face|1 lado|1 face|dois lados|duas faces|2 lados|2 faces|ambos os lados|duplo)\b/.test(text);
  }

  function hasCoatingThickness(text) {
    return /\b(?:espessura|camada)\b.*\d+(?:[,.]\d+)?\s*(?:cm|mm|m)\b/.test(text) ||
      /\b\d+(?:[,.]\d+)?\s*(?:cm|mm)\b.*\b(reboco|emboco|emboço|chapisco|revestimento)\b/.test(text);
  }

  function hasTechnicalBase(text, options) {
    if (options && options.hasValidatedTechnicalBase === true) {
      return true;
    }
    if (options && options.technicalBase) {
      return true;
    }
    return /\b(sinapi|orse|composicao interna validada|composição interna validada|composicao cadastrada validada|composição cadastrada validada)\b/.test(text);
  }

  function hasExplicitPreliminaryAuthorization(text) {
    return /\b(autorizo|pode fazer|faça|faca|quero)\b/.test(text) &&
      /\b(estimativa preliminar|nao oficial|não oficial)\b/.test(text);
  }


  function parseAreaOrDimensions(original, primaryLabel, secondaryLabel) {
    const text = normalize(original);
    const areaMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|mÂ²|m²|metros quadrados?)/);
    if (areaMatch) {
      return { area: parseNumber(areaMatch[1]) };
    }
    const firstNamed = text.match(new RegExp('(\\d+(?:[,.]\\d+)?)\\s*m?\\s*de\\s*' + primaryLabel));
    const secondNamed = text.match(new RegExp('(\\d+(?:[,.]\\d+)?)\\s*m?\\s*de\\s*' + secondaryLabel));
    if (firstNamed && secondNamed) {
      return { length: parseNumber(firstNamed[1]), width: parseNumber(secondNamed[1]), area: parseNumber(firstNamed[1]) * parseNumber(secondNamed[1]) };
    }
    const directMatch = text.match(/(\d+(?:[,.]\d+)?)\s*m?\s*(?:x|por)\s*(\d+(?:[,.]\d+)?)\s*m?/);
    if (directMatch) {
      const length = parseNumber(directMatch[1]);
      const width = parseNumber(directMatch[2]);
      return { length: length, width: width, area: length * width };
    }
    return {};
  }

  function hasAreaOrDimensions(text) {
    return /(\d+(?:[,.]\d+)?)\s*(?:m2|mÂ²|m²|metros quadrados?)(?=\s|$|,|\.|\?|!|;|:)/.test(text) ||
      /(\d+(?:[,.]\d+)?)\s*m?\s*(?:x|por)\s*(\d+(?:[,.]\d+)?)\s*m?/.test(text) ||
      /\d+(?:[,.]\d+)?\s*m\s*de\s*(?:comprimento|largura|altura)/.test(text);
  }

  function hasPavementJoint(text) {
    return /\bjunta\b.*\d+(?:[,.]\d+)?\s*(?:mm|cm|m)\b/.test(text) ||
      /\d+(?:[,.]\d+)?\s*(?:mm|cm)\s*(?:de\s*)?junta\b/.test(text);
  }

  function hasPavementPiece(text) {
    return /\b(?:paver|paralelepipedo|paralelepÃ­pedo|bloquete|intertravado|bloco intertravado)\b.*\d{1,2}\s*x\s*\d{1,2}/.test(text) ||
      /\b\d{1,2}\s*x\s*\d{1,2}(?:\s*x\s*\d{1,2})?\s*(?:cm)?\b/.test(text) ||
      /\b16\s*faces\b/.test(text);
  }

  function hasPavementBase(text) {
    return /\b(colchao de areia|colchÃ£o de areia|po de pedra|pÃ³ de pedra|base de brita|brita|base granular|assentamento|areia|argamassa)\b/.test(text);
  }

  function hasPavementUse(text) {
    return /\b(passeio|calcada|calÃ§ada|garagem|trafego leve|trÃ¡fego leve|trafego pesado|trÃ¡fego pesado|carga pesada)\b/.test(text);
  }

  function hasPaintingEnvironment(text) {
    return /\b(interna|interno|externa|externo|muro externo|fachada)\b/.test(text);
  }

  function hasPaintingSurface(text) {
    return /\b(reboco novo|reboco antigo|massa corrida|textura|alvenaria aparente|muro externo|muro|parede rebocada|reboco)\b/.test(text);
  }

  function hasPaintingSystem(text) {
    return /\b(apenas tinta|repintura|selador|fundo preparador|massa corrida|textura)\b/.test(text) ||
      /\b\d+\s*(?:demaos|demÃ£os)\b/.test(text);
  }

  function hasPaintingCoats(text) {
    return /\b\d+\s*(?:demaos|demÃ£os)\b/.test(text);
  }

  function hasPaintType(text) {
    return /\b(acrilica|acrÃ­lica|latex|lÃ¡tex|pva|esmalte|tinta)\b/.test(text);
  }

  function buildResponse(kind, answer, extra) {
    const payload = Object.assign({
      allowed: false,
      shouldRespond: true,
      kind: kind,
      answer: answer,
      shortAnswer: answer,
      nextAction: "coletar_premissas",
      sessionTheme: "premissas_quantitativo"
    }, extra || {});
    return payload;
  }

  function parseWallDimensions(original) {
    const text = normalize(original);
    const heightMatch = text.match(/(\d+(?:[,.]\d+)?)\s*m\s*de\s*altura/);
    const lengthMatch = text.match(/(\d+(?:[,.]\d+)?)\s*m\s*de\s*comprimento/);
    if (heightMatch && lengthMatch) {
      return {
        length: parseNumber(lengthMatch[1]),
        height: parseNumber(heightMatch[1])
      };
    }
    const directMatch = text.match(/(\d+(?:[,.]\d+)?)\s*m?\s*(?:x|por)\s*(\d+(?:[,.]\d+)?)\s*m?/);
    if (directMatch) {
      return {
        length: parseNumber(directMatch[1]),
        height: parseNumber(directMatch[2])
      };
    }
    const areaMatch = text.match(/(\d+(?:[,.]\d+)?)\s*(?:m2|m²|metros quadrados?)/);
    if (areaMatch) {
      return {
        area: parseNumber(areaMatch[1])
      };
    }
    return {};
  }

  function parseOpenings(original) {
    const text = normalize(original);
    if (/\b(sem portas?|sem janelas?|sem vaos?|sem vãos|parede integra|parede íntegra)\b/.test(text)) {
      return {
        confirmed: true,
        items: [],
        area: 0
      };
    }
    const items = [];
    const regex = /(\d+)\s*(porta|portas|janela|janelas)\s*(?:de\s*)?(\d+(?:[,.]\d+)?)\s*(?:m\s*)?(?:x|por)\s*(\d+(?:[,.]\d+)?)/g;
    let match;
    while ((match = regex.exec(text))) {
      const quantity = Number(match[1]);
      const type = match[2].indexOf("porta") >= 0 ? "porta" : "janela";
      const width = parseNumber(match[3]);
      const height = parseNumber(match[4]);
      const area = quantity * width * height;
      items.push({
        quantity: quantity,
        type: type,
        width: width,
        height: height,
        area: area
      });
    }
    return {
      confirmed: items.length > 0,
      items: items,
      area: items.reduce(function (sum, item) { return sum + item.area; }, 0)
    };
  }

  function parseBlockDimension(original) {
    const match = normalize(original).match(/(?:bloco\s*)?(\d{1,2})\s*x\s*(\d{1,2})\s*x\s*(\d{1,2})/);
    return match ? match[1] + "x" + match[2] + "x" + match[3] : "";
  }

  function parseLoss(original) {
    const text = normalize(original);
    const match = text.match(/(?:perda|perdas)\D{0,12}(\d+(?:[,.]\d+)?)\s*%/) || text.match(/(\d+(?:[,.]\d+)?)\s*%\s*(?:de\s*)?perda/);
    return match ? match[1].replace(".", ",") + "%" : "";
  }

  function parseCoatingSide(original) {
    const text = normalize(original);
    if (/\b(dois lados|duas faces|2 lados|2 faces|ambos os lados|duplo)\b/.test(text)) {
      return "dois lados";
    }
    if (/\b(um lado|uma face|1 lado|1 face)\b/.test(text)) {
      return "um lado";
    }
    return "";
  }

  function formatOpenings(openings) {
    if (!openings.items.length) {
      return "nenhum";
    }
    return openings.items.map(function (item) {
      return item.quantity + " " + item.type + (item.quantity > 1 ? "s" : "") + " " +
        formatNumber(item.width) + " x " + formatNumber(item.height) + " m = " + formatNumber(item.area) + " m²";
    }).join("; ");
  }


  function parsePavementPiece(original) {
    const text = normalize(original);
    const pieceMatch = text.match(/\b(?:paver|paralelepipedo|paralelepÃ­pedo|bloquete|intertravado|bloco intertravado)?\s*(\d{1,2}\s*x\s*\d{1,2}(?:\s*x\s*\d{1,2})?)\s*(?:cm)?\b/);
    if (pieceMatch) {
      return clean(pieceMatch[1].replace(/\s*x\s*/g, "x")) + " cm";
    }
    if (/\b16\s*faces\b/.test(text)) return "bloco intertravado 16 faces";
    if (/\bparalelepipedo|paralelepÃ­pedo\b/.test(text)) return "paralelepípedo";
    if (/\bpaver|intertravado|bloquete\b/.test(text)) return "paver/intertravado/bloquete";
    return "";
  }

  function parsePavementJoint(original) {
    const text = normalize(original);
    const match = text.match(/\bjunta\b\D{0,20}(\d+(?:[,.]\d+)?)\s*(mm|cm|m)\b/) || text.match(/(\d+(?:[,.]\d+)?)\s*(mm|cm)\s*(?:de\s*)?junta\b/);
    return match ? match[1].replace(".", ",") + " " + match[2] : "";
  }

  function parsePavementBase(original) {
    const text = normalize(original);
    if (/\bcolchao de areia|colchÃ£o de areia\b/.test(text)) return "colchão de areia";
    if (/\bpo de pedra|pÃ³ de pedra\b/.test(text)) return "pó de pedra";
    if (/\bbase de brita|brita\b/.test(text)) return "base de brita";
    if (/\bargamassa\b/.test(text)) return "argamassa";
    if (/\bareia\b/.test(text)) return "areia";
    if (/\bassentamento\b/.test(text)) return "assentamento informado";
    return "";
  }

  function parsePavementUse(original) {
    const text = normalize(original);
    if (/\bgaragem\b/.test(text)) return "garagem";
    if (/\btrafego pesado|trÃ¡fego pesado|carga pesada\b/.test(text)) return "tráfego pesado";
    if (/\btrafego leve|trÃ¡fego leve\b/.test(text)) return "tráfego leve";
    if (/\bpasseio|calcada|calÃ§ada\b/.test(text)) return "passeio/calçada";
    return "";
  }

  function buildPavementPremisesBlock(original) {
    const dimensions = parseAreaOrDimensions(original, "comprimento", "largura");
    const lines = ["Premissas utilizadas:"];
    const text = normalize(original);
    lines.push("- Tipo de piso: " + (/\bparalelepipedo|paralelepÃ­pedo|paralelo\b/.test(text) ? "paralelepípedo" : "paver/intertravado/bloquete"));
    if (dimensions.length) lines.push("- Comprimento: " + formatNumber(dimensions.length) + " m");
    if (dimensions.width) lines.push("- Largura: " + formatNumber(dimensions.width) + " m");
    if (dimensions.area) lines.push("- Área bruta: " + formatNumber(dimensions.area) + " m²");
    lines.push("- Peça considerada: " + (parsePavementPiece(original) || "não informada"));
    lines.push("- Junta considerada: " + (parsePavementJoint(original) || "não informada"));
    lines.push("- Base/assentamento: " + (parsePavementBase(original) || "não informado"));
    lines.push("- Uso: " + (parsePavementUse(original) || "não informado"));
    lines.push("- Perda: " + (parseLoss(original) || "não informada"));
    lines.push("- Fonte técnica: SINAPI/ORSE/composição interna não localizada");
    return lines.join("\n");
  }

  function parsePaintingSystem(original) {
    const text = normalize(original);
    if (/\bmassa corrida\b/.test(text) && /\bselador\b/.test(text)) return "massa corrida + selador + tinta";
    if (/\bfundo preparador\b/.test(text)) return "fundo preparador + tinta";
    if (/\bselador\b/.test(text)) return "selador + tinta";
    if (/\btextura\b/.test(text)) return "textura + tinta";
    if (/\bapenas tinta|repintura\b/.test(text)) return "apenas tinta/repintura";
    return "";
  }

  function parsePaintingSurface(original) {
    const text = normalize(original);
    if (/\breboco novo\b/.test(text)) return "reboco novo";
    if (/\breboco antigo\b/.test(text)) return "reboco antigo";
    if (/\bmassa corrida\b/.test(text)) return "massa corrida";
    if (/\btextura\b/.test(text)) return "textura";
    if (/\balvenaria aparente\b/.test(text)) return "alvenaria aparente";
    if (/\bmuro externo|muro\b/.test(text)) return "muro externo";
    if (/\breboco\b/.test(text)) return "reboco";
    return "";
  }

  function parsePaintingCoats(original) {
    const match = normalize(original).match(/(\d+)\s*(?:demaos|demÃ£os)/);
    return match ? match[1] : "";
  }

  function parsePaintType(original) {
    const text = normalize(original);
    if (/\bacrilica|acrÃ­lica\b/.test(text)) return "acrílica";
    if (/\blatex|lÃ¡tex|pva\b/.test(text)) return "látex/PVA";
    if (/\besmalte\b/.test(text)) return "esmalte";
    if (/\btinta\b/.test(text)) return "tinta não especificada";
    return "";
  }

  function buildPaintingPremisesBlock(original) {
    const dimensions = parseAreaOrDimensions(original, "comprimento", "altura");
    const environment = /\bexterna|externo|muro externo|fachada\b/.test(normalize(original)) ? "externa" : "interna";
    const lines = ["Premissas utilizadas:"];
    if (dimensions.length) lines.push("- Comprimento: " + formatNumber(dimensions.length) + " m");
    if (dimensions.width) lines.push("- Altura: " + formatNumber(dimensions.width) + " m");
    if (dimensions.area) lines.push("- Área considerada: " + formatNumber(dimensions.area) + " m²");
    lines.push("- Ambiente: pintura " + environment);
    lines.push("- Superfície: " + (parsePaintingSurface(original) || "não informada"));
    lines.push("- Sistema de pintura: " + (parsePaintingSystem(original) || "não informado"));
    lines.push("- Número de demãos: " + (parsePaintingCoats(original) || "não informado"));
    lines.push("- Tipo de tinta: " + (parsePaintType(original) || "não informado"));
    lines.push("- Vãos/descontos: área informada considerada como base de cálculo");
    lines.push("- Base técnica: SINAPI/ORSE/composição interna não localizada");
    return lines.join("\n");
  }

  function buildPremisesBlock(original) {
    const dimensions = parseWallDimensions(original);
    const openings = parseOpenings(original);
    const grossArea = dimensions.area || (dimensions.length && dimensions.height ? dimensions.length * dimensions.height : 0);
    const netArea = grossArea ? Math.max(0, grossArea - openings.area) : 0;
    const lines = ["Premissas utilizadas:"];
    if (dimensions.length) {
      lines.push("- Comprimento da parede: " + formatNumber(dimensions.length) + " m");
    }
    if (dimensions.height) {
      lines.push("- Altura da parede: " + formatNumber(dimensions.height) + " m");
    }
    if (grossArea) {
      lines.push("- Área bruta: " + formatNumber(grossArea) + " m²");
      lines.push("- Vãos descontados: " + formatOpenings(openings));
      lines.push("- Área líquida considerada: " + formatNumber(netArea) + " m²");
    }
    const block = parseBlockDimension(original);
    if (block) {
      lines.push("- Bloco considerado: " + block);
    }
    const loss = parseLoss(original);
    if (loss) {
      lines.push("- Perda adotada: " + loss);
    }
    const side = parseCoatingSide(original);
    if (side) {
      lines.push("- Revestimento: " + side);
    }
    return lines.join("\n");
  }

  function buildMissingBaseAnswer(original, service) {
    const serviceAnswer = service === "pavement" ? PAVEMENT_MISSING_BASE_ANSWER : service === "painting" ? PAINTING_MISSING_BASE_ANSWER : MISSING_BASE_ANSWER;
    const premises = service === "pavement" ? buildPavementPremisesBlock(original) : service === "painting" ? buildPaintingPremisesBlock(original) : buildPremisesBlock(original);
    return [
      serviceAnswer,
      "",
      "Base técnica utilizada: composição técnica não localizada",
      "",
      premises
    ].join("\n");
  }

  function validatePavementQuestion(original, text, settings) {
    if (!hasAreaOrDimensions(text)) {
      return buildResponse("missing_pavement_dimensions", PAVEMENT_DIMENSIONS_QUESTION, { reason: "missing_pavement_dimensions" });
    }
    if (!hasPavementJoint(text)) {
      return buildResponse("missing_pavement_joint", PAVEMENT_JOINT_QUESTION, { reason: "missing_pavement_joint" });
    }
    if (!hasPavementPiece(text)) {
      return buildResponse("missing_pavement_piece", PAVEMENT_PIECE_QUESTION, { reason: "missing_pavement_piece" });
    }
    if (!hasPavementBase(text)) {
      return buildResponse("missing_pavement_base", PAVEMENT_BASE_QUESTION, { reason: "missing_pavement_base" });
    }
    if (!hasLoss(text)) {
      return buildResponse("missing_pavement_loss", PAVEMENT_LOSS_QUESTION, { reason: "missing_pavement_loss" });
    }
    if (!hasPavementUse(text)) {
      return buildResponse("missing_pavement_use", PAVEMENT_USE_QUESTION, { reason: "missing_pavement_use" });
    }
    if (!hasTechnicalBase(text, settings)) {
      return buildResponse("missing_technical_base", buildMissingBaseAnswer(original, "pavement"), {
        nextAction: "informar_composicao_tecnica",
        sessionTheme: "base_tecnica_quantitativo",
        reason: "missing_technical_base"
      });
    }
    return { allowed: true, shouldRespond: false, kind: "validated", technicalBase: true };
  }

  function validatePaintingQuestion(original, text, settings) {
    if (!hasAreaOrDimensions(text)) {
      return buildResponse("missing_painting_dimensions", PAINTING_DIMENSIONS_QUESTION, { reason: "missing_painting_dimensions" });
    }
    if (!hasPaintingEnvironment(text)) {
      return buildResponse("missing_painting_environment", PAINTING_ENVIRONMENT_QUESTION, { reason: "missing_painting_environment" });
    }
    if (!hasPaintingSystem(text)) {
      return buildResponse("missing_painting_system", PAINTING_SYSTEM_QUESTION, { reason: "missing_painting_system" });
    }
    if (!hasPaintingSurface(text)) {
      return buildResponse("missing_painting_surface", PAINTING_SURFACE_QUESTION, { reason: "missing_painting_surface" });
    }
    if (!hasPaintingCoats(text)) {
      return buildResponse("missing_painting_coats", PAINTING_COATS_QUESTION, { reason: "missing_painting_coats" });
    }
    if (!hasPaintType(text)) {
      return buildResponse("missing_paint_type", PAINTING_PAINT_TYPE_QUESTION, { reason: "missing_paint_type" });
    }
    if (!hasTechnicalBase(text, settings)) {
      return buildResponse("missing_technical_base", buildMissingBaseAnswer(original, "painting"), {
        nextAction: "informar_composicao_tecnica",
        sessionTheme: "base_tecnica_quantitativo",
        reason: "missing_technical_base"
      });
    }
    return { allowed: true, shouldRespond: false, kind: "validated", technicalBase: true };
  }

  function validateTechnicalQuestion(message, options) {
    const original = clean(message);
    const text = normalize(original);
    const settings = options || {};
    if (!hasTechnicalIntent(text)) {
      return {
        allowed: true,
        shouldRespond: false,
        kind: "not_technical"
      };
    }

    if (hasExplicitPreliminaryAuthorization(text)) {
      return {
        allowed: true,
        shouldRespond: false,
        kind: "preliminary_authorized",
        preliminary: true
      };
    }

    if (hasPavementSubject(text)) {
      return validatePavementQuestion(original, text, settings);
    }

    if (hasPaintingSubject(text)) {
      return validatePaintingQuestion(original, text, settings);
    }

    if (hasConcreteSubject(text) && !hasFck(text)) {
      return buildResponse("missing_concrete_fck", FCK_QUESTION, {
        reason: "missing_fck"
      });
    }

    if (hasWallSubject(text)) {
      if (!hasBlockDimension(text)) {
        return buildResponse("missing_block_dimension", BLOCK_DIMENSION_QUESTION, {
          reason: "missing_block_dimension"
        });
      }
      if (!hasOpeningsConfirmation(text)) {
        return buildResponse("missing_openings", OPENINGS_QUESTION, {
          reason: "missing_openings"
        });
      }
      if (!hasLoss(text)) {
        return buildResponse("missing_loss", "Antes de calcular, preciso confirmar a perda adotada para a parede. Qual percentual de perda deseja considerar?", {
          reason: "missing_loss"
        });
      }
    }

    if (hasCoatingSubject(text)) {
      const isExplicitCoatingService = !hasWallSubject(text) || /\b(chapisco|emboco|emboço|reboco)\b/.test(text);
      if (!hasCoatingSide(text)) {
        return buildResponse("missing_coating_side", COATING_SIDE_QUESTION, {
          reason: "missing_coating_side"
        });
      }
      if (isExplicitCoatingService && !hasCoatingThickness(text)) {
        return buildResponse("missing_coating_thickness", COATING_THICKNESS_QUESTION, {
          reason: "missing_coating_thickness"
        });
      }
    }

    if (!hasTechnicalBase(text, settings)) {
      return buildResponse("missing_technical_base", buildMissingBaseAnswer(original), {
        nextAction: "informar_composicao_tecnica",
        sessionTheme: "base_tecnica_quantitativo",
        reason: "missing_technical_base"
      });
    }

    return {
      allowed: true,
      shouldRespond: false,
      kind: "validated",
      technicalBase: true
    };
  }

  root.EloTechnicalValidator = {
    version: "20260622-unified-technical-validator",
    validateTechnicalQuestion: validateTechnicalQuestion,
    buildPremisesBlock: buildPremisesBlock,
    questions: {
      fck: FCK_QUESTION,
      blockDimension: BLOCK_DIMENSION_QUESTION,
      openings: OPENINGS_QUESTION,
      coatingSide: COATING_SIDE_QUESTION,
      coatingThickness: COATING_THICKNESS_QUESTION,
      pavementDimensions: PAVEMENT_DIMENSIONS_QUESTION,
      pavementJoint: PAVEMENT_JOINT_QUESTION,
      pavementPiece: PAVEMENT_PIECE_QUESTION,
      paintingDimensions: PAINTING_DIMENSIONS_QUESTION,
      paintingEnvironment: PAINTING_ENVIRONMENT_QUESTION,
      paintingSystem: PAINTING_SYSTEM_QUESTION
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
