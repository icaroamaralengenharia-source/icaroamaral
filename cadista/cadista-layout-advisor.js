(function () {
  "use strict";

  const CRITERIA = [
    "aproveitamento do terreno",
    "circulacao",
    "iluminacao",
    "ventilacao",
    "economia",
    "simplicidade estrutural",
    "privacidade",
    "possibilidade de ampliacao",
    "compatibilidade com pedido do cliente"
  ];

  const state = { open: false, last: null };

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function hasAny(text, words) {
    return words.some((word) => text.includes(word));
  }

  function parseBudget(input) {
    const text = normalizeText(input).replace(/\./g, "").replace(/,/g, ".");
    if (/(barat|econom|baixo custo|popular)/.test(text)) return "baixo";
    if (/(premium|alto padrao|gourmet)/.test(text)) return "alto";
    const match = text.match(/(?:r\$\s*)?(\d{4,7})(?:\s*reais)?/);
    if (!match) return null;
    const value = Number(match[1]);
    if (!Number.isFinite(value)) return null;
    if (value <= 120000) return "baixo";
    if (value >= 250000) return "alto";
    return "medio";
  }

  function getHouseLibrary() {
    return window.CadistaHouseTemplateLibrary || null;
  }

  function getFamilyLibrary(intent) {
    if (!intent) return null;
    if (intent.bedrooms === 1) return window.CadistaOneBedroomLibrary || null;
    if (intent.bedrooms === 2) return window.CadistaTwoBedroomLibrary || null;
    return null;
  }

  function buildIntent(input) {
    const houseLibrary = getHouseLibrary();
    const intent = houseLibrary && typeof houseLibrary.detectCadistaHouseTemplateIntent === "function" ? houseLibrary.detectCadistaHouseTemplateIntent(input) : null;
    if (!intent) return null;
    return Object.assign({}, intent, {
      budget: parseBudget(input),
      style: intent.preference,
      normalizedInput: normalizeText(input)
    });
  }

  function terrainProfile(lot) {
    if (!lot) return "sem_terreno";
    const ratio = lot.depth / Math.max(lot.width, 0.01);
    if (lot.width <= 8 || ratio >= 2.2) return "estreito_profundo";
    if (lot.width >= 12) return "largo";
    if (Math.abs(lot.width - lot.depth) <= 3) return "quadrado";
    return "medio";
  }

  function modelText(model) {
    return normalizeText([model.name, model.group, model.strategy, model.description].concat(model.tags || []).join(" "));
  }


  function hasRuralSignal(text) {
    return /(^|\s)(rural|sitio|varanda|campo|patio)(\s|$)/.test(text) || text.includes("cozinha maior");
  }
  function scoreCadistaModel(model, intent) {
    const text = modelText(model);
    const input = intent.normalizedInput || "";
    const profile = terrainProfile(intent.lot);
    const scores = {
      terrain: 0,
      circulation: 0,
      lighting: 0,
      ventilation: 0,
      economy: 0,
      structure: 0,
      privacy: 0,
      expansion: 0,
      compatibility: 0
    };

    if (profile === "estreito_profundo") {
      if (/retangular|linear|estreita|longa|corredor lateral|geminada|tiny/.test(text)) scores.terrain += 22;
      if (/em l|quadrada/.test(text)) scores.terrain += 8;
    } else if (profile === "medio") {
      if (/retangular|conceito aberto|popular|compacta|l compacta/.test(text)) scores.terrain += 18;
      if (/quadrada|em l/.test(text)) scores.terrain += 12;
    } else if (profile === "largo") {
      if (/em l|varanda|patio|familiar|rural|premium|moderna/.test(text)) scores.terrain += 22;
      if (/retangular/.test(text)) scores.terrain += 10;
    } else if (profile === "quadrado") {
      if (/quadrada|conceito aberto|chale|nucleo molhado/.test(text)) scores.terrain += 22;
      if (/retangular/.test(text)) scores.terrain += 10;
    }

    if (/pouca circulacao|circulacao curta|corredor minimo|integrada|conceito aberto|compacta|economica/.test(text)) scores.circulation += 14;
    if (/corredor lateral|hall|quartos isolados/.test(text)) scores.circulation += 8;

    if (/varanda|patio|lateral|conceito aberto|social integrado/.test(text)) scores.lighting += 12;
    if (hasRuralSignal(input) && hasRuralSignal(text)) scores.lighting += 8;
    if (/varanda|patio|corredor lateral|rural|lateral|frente e fundos/.test(text)) scores.ventilation += 12;
    if (hasRuralSignal(input) && hasRuralSignal(text)) scores.ventilation += 8;

    if (/economica|barata|popular|tiny|kitnet|poucos recortes|pouca parede/.test(text)) scores.economy += 16;
    if (intent.budget === "baixo") scores.economy += /economica|barata|popular|tiny|kitnet/.test(text) ? 12 : -5;
    if (intent.budget === "baixo" && /retangular economica|popular economica|quadrada economica/.test(text)) scores.compatibility += 10;
    if (intent.budget === "alto") scores.economy += /premium|gourmet|moderna|varanda/.test(text) ? 4 : 0;

    if (/retangular|quadrada|poucos recortes|linear|simples|popular/.test(text)) scores.structure += 14;
    if (/em l|patio|premium/.test(text)) scores.structure += 7;

    if (/quartos isolados|intima|privacidade|quarto reservado|setor intimo|bloco separado/.test(text)) scores.privacy += 14;
    if (intent.bedrooms === 2 && /quartos lado a lado|quartos finais|quartos em bloco/.test(text)) scores.privacy += 8;

    if (/expansivel|ampliacao futura|mezanino futuro|adu|edicula|casa de fundo/.test(text)) scores.expansion += 16;
    if (profile === "largo" && /em l|patio|expansivel/.test(text)) scores.expansion += 7;

    if (intent.preference === "rural") scores.compatibility += hasRuralSignal(text) ? 42 : -35;
    if (intent.preference === "em_l" && /em l|planta em l/.test(text)) scores.compatibility += 14;
    if (intent.preference === "moderna" && /moderna|premium|ilha|cozinha americana/.test(text)) scores.compatibility += 12;
    if (intent.preference === "economica" && /economica|barata|popular|tiny|kitnet/.test(text)) scores.compatibility += 12;

    if (intent.preference) {
      const preferenceWords = {
        retangular: ["retangular", "linear", "estreita", "longa"],
        quadrada: ["quadrada", "chale"],
        conceito_aberto: ["conceito aberto", "integrada", "cozinha americana", "social integrado"],
        em_l: ["em l", "planta em l"],
        economica: ["economica", "barata", "popular", "tiny", "kitnet"],
        moderna: ["moderna", "premium", "ilha", "gourmet", "cozinha americana"],
        rural: ["rural", "sitio", "varanda", "cozinha maior"]
      }[intent.preference] || [];
      scores.compatibility += hasAny(text, preferenceWords) ? 22 : -8;
    }
    if (input && hasAny(text, input.split(" ").filter((word) => word.length > 4))) scores.compatibility += 6;

    const total = Object.values(scores).reduce((sum, value) => sum + value, 0);
    return { total: Math.max(0, Math.round(total)), scores };
  }

  function buildCandidatePool(intent) {
    const houseLibrary = getHouseLibrary();
    const familyLibrary = getFamilyLibrary(intent);
    if (!intent || !houseLibrary || !familyLibrary) return [];
    const recommended = typeof houseLibrary.recommendCadistaTemplates === "function" ? houseLibrary.recommendCadistaTemplates(intent) : [];
    const templates = Array.isArray(familyLibrary.templates) ? familyLibrary.templates : [];
    const seen = new Set();
    return recommended.concat(templates).filter((model) => {
      if (!model || seen.has(model.id)) return false;
      seen.add(model.id);
      return true;
    });
  }

  function justify(model, intent, score) {
    const reasons = [];
    const text = modelText(model);
    const profile = terrainProfile(intent.lot);
    if (profile === "estreito_profundo" && /retangular|linear|geminada|tiny/.test(text)) reasons.push("aproveita melhor lote estreito e profundo");
    if (profile === "medio" && /compacta|conceito aberto|popular|retangular/.test(text)) reasons.push("equilibra area social e setor intimo em lote medio");
    if (profile === "largo" && /em l|varanda|patio|familiar/.test(text)) reasons.push("usa a largura para melhorar iluminacao, ventilacao e privacidade");
    if (/economica|popular|tiny|poucos recortes|linear/.test(text)) reasons.push("reduz circulacao, paredes e complexidade estrutural");
    if (/varanda|patio|corredor lateral|conceito aberto/.test(text)) reasons.push("favorece iluminacao e ventilacao natural");
    if (/intima|quartos isolados|privacidade|bloco separado/.test(text)) reasons.push("separa melhor area social e quartos");
    if (/expansivel|ampliacao futura|mezanino futuro/.test(text)) reasons.push("mantem possibilidade de ampliacao futura");
    if (intent.preference) reasons.push(`combina com a preferencia ${preferenceLabel(intent.preference)}`);
    if (!reasons.length) reasons.push("apresenta boa compatibilidade geral com o pedido e o programa informado");
    return `${model.name}: score ${score.total}. ${capitalize(reasons.slice(0, 3).join(", "))}.`;
  }

  function preferenceLabel(preference) {
    return {
      retangular: "retangular",
      quadrada: "quadrada",
      conceito_aberto: "conceito aberto",
      em_l: "em L",
      economica: "economica/popular",
      moderna: "moderna",
      rural: "rural/varanda"
    }[preference] || preference;
  }

  function capitalize(value) {
    const text = String(value || "");
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function adviseCadistaLayout(input) {
    const intent = typeof input === "string" ? buildIntent(input) : Object.assign(buildIntent(input && input.rawInput || "") || {}, input || {});
    if (!intent) return { ok: false, question: "Informe se a casa e de 1 ou 2 quartos e, se possivel, o tamanho do terreno." };
    if (!intent.lot) return { ok: false, intent, question: "Qual a largura e profundidade do terreno? Exemplo: 8x20, 10x20 ou 12x25." };
    const ranked = buildCandidatePool(intent).map((model) => {
      const score = scoreCadistaModel(model, intent);
      return { model, score: score.total, scoreBreakdown: score.scores, justification: justify(model, intent, score) };
    }).sort((a, b) => b.score - a.score || a.model.name.localeCompare(b.model.name));
    const top = ranked.slice(0, 3);
    return {
      ok: true,
      intent,
      best: top[0] || null,
      second: top[1] || null,
      third: top[2] || null,
      recommendations: top,
      summary: buildSummary(intent, top)
    };
  }

  function buildSummary(intent, recommendations) {
    if (!recommendations.length) return "Nao encontrei modelos compativeis na biblioteca atual.";
    const lot = intent.lot ? intent.lot.label : "terreno informado";
    const bedrooms = intent.bedrooms === 1 ? "1 quarto" : "2 quartos";
    const preference = intent.preference ? ` ${preferenceLabel(intent.preference)}` : "";
    return `Para terreno ${lot} e casa de ${bedrooms}${preference}, recomendo o modelo ${recommendations[0].model.name} porque ${recommendations[0].justification.replace(/^[^:]+:\s*score\s*\d+\.\s*/i, "").replace(/\.$/, "")}.`;
  }

  function createUi() {
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-layout-advisor-launcher";
    launcher.textContent = "Advisor";
    const panel = document.createElement("section");
    panel.className = "cadista-layout-advisor-panel";
    panel.hidden = true;
    panel.innerHTML = `<div class="cadista-layout-advisor-head"><strong>Escolha arquitetonica inteligente</strong><button type="button" data-advisor-close>x</button></div><div class="cadista-layout-advisor-body"><textarea data-advisor-input placeholder="Ex.: casa 2 quartos barata terreno 8x20"></textarea><button type="button" data-advisor-run>Analisar modelos</button><div data-advisor-output class="cadista-layout-advisor-output">Informe o pedido para receber 3 opcoes pontuadas.</div></div>`;
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    const input = panel.querySelector("[data-advisor-input]");
    const output = panel.querySelector("[data-advisor-output]");
    launcher.addEventListener("click", () => {
      state.open = !state.open;
      panel.hidden = !state.open;
      if (state.open && !input.value) input.value = getActiveCommandText();
    });
    panel.querySelector("[data-advisor-close]").addEventListener("click", () => { state.open = false; panel.hidden = true; });
    panel.querySelector("[data-advisor-run]").addEventListener("click", () => renderAdvice(input.value, output));
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || target === input || !/^(TEXTAREA|INPUT)$/i.test(target.tagName || "")) return;
      const advice = adviseCadistaLayout(target.value || "");
      if (advice.intent) {
        input.value = target.value;
        state.open = true;
        panel.hidden = false;
        renderAdvice(input.value, output);
      }
    }, true);
  }

  function renderAdvice(text, output) {
    const advice = adviseCadistaLayout(text);
    state.last = advice;
    if (!advice.ok) {
      output.innerHTML = `<p>${escapeHtml(advice.question)}</p>`;
      return;
    }
    output.innerHTML = `<p><strong>${escapeHtml(advice.summary)}</strong></p>${advice.recommendations.map((item, index) => `<article><b>${index + 1}. ${escapeHtml(item.model.name)}</b><span>Score ${item.score}</span><p>${escapeHtml(item.justification)}</p></article>`).join("")}`;
  }

  function getActiveCommandText() {
    const active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/i.test(active.tagName || "") && active.value) return active.value;
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-layout-advisor-panel"));
    const found = fields.find((field) => buildIntent(field.value || ""));
    return found ? found.value : "";
  }

  function styles() {
    const css = `.cadista-layout-advisor-launcher{position:fixed;right:18px;bottom:144px;z-index:2147483000;border:0;border-radius:6px;background:#0f766e;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}.cadista-layout-advisor-panel{position:fixed;right:18px;bottom:192px;z-index:2147483000;width:min(430px,calc(100vw - 36px));max-height:min(700px,calc(100vh - 212px));overflow:auto;border:1px solid #bad8d5;border-radius:8px;background:#fff;color:#12312e;box-shadow:0 22px 48px rgba(0,0,0,.22);font:13px/1.35 Arial,sans-serif}.cadista-layout-advisor-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #d9ebe8;background:#f4fbfa}.cadista-layout-advisor-head strong{font-size:13px;text-transform:uppercase}.cadista-layout-advisor-head button{width:28px;height:28px;min-height:28px;padding:0;border:1px solid #bad8d5;border-radius:6px;background:#fff;color:#12312e}.cadista-layout-advisor-body{display:grid;gap:10px;padding:12px 14px}.cadista-layout-advisor-body textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #bad8d5;border-radius:6px;padding:8px;font:12px Arial,sans-serif}.cadista-layout-advisor-body button{min-height:32px;border:1px solid #0f766e;border-radius:6px;background:#0f766e;color:#fff;font-weight:700}.cadista-layout-advisor-output{display:grid;gap:8px}.cadista-layout-advisor-output p{margin:0}.cadista-layout-advisor-output article{display:grid;gap:4px;border:1px solid #d9ebe8;border-radius:6px;background:#fbfefd;padding:8px}.cadista-layout-advisor-output article span{color:#0f766e;font-weight:800;font-size:12px}`;
    const node = document.createElement("style");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.CadistaLayoutAdvisor = { adviseCadistaLayout, scoreCadistaModel, criteria: CRITERIA };
  window.adviseCadistaLayout = adviseCadistaLayout;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createUi, { once: true });
  else createUi();
})();