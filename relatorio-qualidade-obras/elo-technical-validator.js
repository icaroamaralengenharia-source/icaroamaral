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

  function hasQuantityIntent(text) {
    return /\b(quantitativo|quantidade|quantos|quanto|calcule|calcular|orcamento|orçamento|custo|valor|preco|preço|mao de obra|mão de obra|produtividade|consumo|materiais?|material|previsao|previsão|estimativa|estimar|executar|fazer)\b/.test(text) ||
      /\d+(?:[,.]\d+)?\s*(?:m2|m²|m3|m³|m|metros?|cm)\b/.test(text);
  }

  function hasTechnicalIntent(text) {
    return hasQuantityIntent(text) && (hasConcreteSubject(text) || hasWallSubject(text) || hasCoatingSubject(text));
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

  function buildMissingBaseAnswer(original) {
    return [
      MISSING_BASE_ANSWER,
      "",
      "Base técnica utilizada: composição técnica não localizada",
      "",
      buildPremisesBlock(original)
    ].join("\n");
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
      coatingThickness: COATING_THICKNESS_QUESTION
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
