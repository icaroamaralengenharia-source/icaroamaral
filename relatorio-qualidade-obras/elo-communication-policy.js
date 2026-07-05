(function initEloCommunicationPolicy(global) {
  "use strict";

  const VERSION = "20260705-elo-communication-policy-v1";
  const TECHNICAL_TITLES = [
    "memoria de calculo",
    "base tecnica",
    "auditoria tecnica",
    "auditor",
    "eap",
    "eap automatica",
    "observacoes tecnicas",
    "observacoes legais"
  ];
  const DISCLAIMER_PATTERNS = [
    /nao\s+faco\s+dimensionamento\s+estrutural\.?/i,
    /n[aÃ£]o\s+fa[cÃ§]o\s+dimensionamento\s+estrutural\.?/i,
    /armadura\s+e\s+detalhamento\s+exigem\s+projeto\s+estrutural.*$/i,
    /profissional\s+habilitado/i,
    /n[aÃ£]o\s+substitui\s+projeto/i,
    /validar\s+com\s+engenheiro/i,
    /aviso\s+legal/i,
    /disclaimer/i
  ];

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function normalizeMode(mode) { return normalize(mode || "CONVERSA").toUpperCase(); }
  function isCasualMode(mode) { return mode === "ENGENHEIRO" || mode === "ACOLHIMENTO"; }

  function isTechnicalTitle(line) {
    const text = normalize(String(line || "").replace(/^\s*[-#*>\d.)]+\s*/g, "").replace(/[:ï¼š]\s*$/g, ""));
    return TECHNICAL_TITLES.some(function (title) {
      return text === title || text.indexOf(title) === 0;
    });
  }

  function looksLikeSectionTitle(line) {
    return /^\s*(\*\*)?([A-ZÃÃ‰ÃÃ“ÃšÃƒÃ•Ã‡][A-ZÃÃ‰ÃÃ“ÃšÃƒÃ•Ã‡0-9 /_-]{3,}|[0-9]+\.\s+.+)(\*\*)?\s*:?\s*$/.test(String(line || ""));
  }

  function removeTechnicalBlocks(text) {
    const lines = String(text || "").split(/\r?\n/);
    const kept = [];
    let skipping = false;
    lines.forEach(function (line) {
      if (isTechnicalTitle(line)) {
        skipping = true;
        return;
      }
      if (skipping && looksLikeSectionTitle(line)) skipping = false;
      if (!skipping) kept.push(line);
    });
    return kept.join("\n");
  }

  function removeDisclaimers(text) {
    let result = String(text || "");
    DISCLAIMER_PATTERNS.forEach(function (pattern) {
      result = result.replace(pattern, "");
    });
    result = result.split(/\r?\n/).filter(function (line) {
      const normalized = normalize(line);
      return !/profissional habilitado|nao substitui|dimensionamento estrutural|aviso legal|disclaimer/.test(normalized);
    }).join("\n");
    return result;
  }

  function hasMissingDataTone(text) {
    return /preciso|informe|faltam|falta|sem\s+dados|antes\s+de\s+calcular|n[aÃ£]o\s+consigo|n[aÃ£]o\s+posso/.test(normalize(text));
  }

  function defaultEngineeringAssumption(text) {
    const normalized = normalize(text);
    if (/pilar|estrutural|sapata|baldrame|viga/.test(normalized)) {
      return "altura de 3,00 m, concreto FCK 25 MPa e taxa inicial de aco de 100 kg/m3";
    }
    if (/parede|alvenaria/.test(normalized)) {
      return "bloco ceramico comum, perda de 5% e area sem vaos ate voce informar portas e janelas";
    }
    if (/piso|ceram/.test(normalized)) {
      return "contrapiso de 3 cm, perda de 5% no piso e argamassa colante AC-II";
    }
    return "parametros padrao de engenharia para uma estimativa inicial";
  }

  function applyMissingDataPosture(text, mode) {
    const normalized = normalize(text);
    if (mode !== "ENGENHEIRO" || normalized.indexOf("para este item, vou assumir") >= 0 || /Calculei como lista de compras parametrica|Lista de compras:/i.test(String(text || "")) || !hasMissingDataTone(text)) return text;
    const assumption = defaultEngineeringAssumption(text);
    const opener = "Para este item, vou assumir " + assumption + " para seguirmos. Quer ajustar ou manter assim?";
    if (/pilar|estrutural|sapata|baldrame|viga/.test(normalized)) {
      return opener + "\n\nO basico do pilar e: forma, aco CA-50/CA-60, estribos, arame recozido, espacadores, concreto, vibracao/adensamento e desforma.";
    }
    const firstUseful = String(text || "").split(/\r?\n/).filter(function (line) {
      return clean(line) && !/antes\s+de\s+calcular|preciso|informe/i.test(line);
    }).slice(0, 4).join("\n");
    return firstUseful ? opener + "\n\n" + firstUseful : opener;
  }

  function limitParagraphs(text, maxParagraphs) {
    const paragraphs = String(text || "")
      .split(/\n\s*\n/g)
      .map(function (part) { return part.trim(); })
      .filter(Boolean);
    return paragraphs.slice(0, maxParagraphs).join("\n\n");
  }

  function fallbackCasualResponse(mode) {
    if (mode === "ACOLHIMENTO") return "Entendi a frustracao. Vamos direto: me diga o item e a medida principal que eu destravo com uma premissa padrao.";
    if (mode === "ENGENHEIRO") return "Vamos direto: me diga o item e a medida principal. Se faltar algo, eu assumo uma premissa padrao e sigo.";
    return "Entendi. Me diga o proximo passo e eu organizo sem burocracia.";
  }

  function applyPolicy(rawResponse, mode) {
    const selectedMode = normalizeMode(mode);
    let response = String(rawResponse || "").trim();

    if (!response) return response;

    if (isCasualMode(selectedMode)) {
      response = removeTechnicalBlocks(response);
      response = removeDisclaimers(response);
      response = applyMissingDataPosture(response, selectedMode);
    }

    if (selectedMode !== "ORCAMENTISTA") {
      response = limitParagraphs(response, 2);
    }

    response = response.replace(/\n{3,}/g, "\n\n").trim();
    return response || fallbackCasualResponse(selectedMode);
  }

  global.EloCommunicationPolicy = {
    version: VERSION,
    applyPolicy: applyPolicy,
    normalizeMode: normalizeMode
  };
})(typeof window !== "undefined" ? window : globalThis);

