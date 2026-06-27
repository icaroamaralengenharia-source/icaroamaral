(function () {
  "use strict";

  const FAMILIES = {
    one: "CASA_TERREA_1_QUARTO",
    two: "CASA_TERREA_2_QUARTOS",
    threeSocial: "CASA_TERREA_3_QUARTOS_SOCIAL_INTEGRADO_SUITE",
    threeFree: "CASA_TERREA_3_QUARTOS_SUITE_LIVRE"
  };

  const PREFERENCE_LABELS = {
    retangular: "retangular",
    quadrada: "quadrada",
    conceito_aberto: "conceito aberto",
    em_l: "em L",
    economica: "economica/popular",
    moderna: "moderna",
    rural: "rural/varanda",
    suite: "suite",
    ilha: "ilha",
    servico_externo: "servico externo",
    corredor: "corredor"
  };

  const state = { open: false, intent: null };

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function parseLot(text) {
    const match = normalizeText(text).match(/(\d+(?:[,.]\d+)?)\s*x\s*(\d+(?:[,.]\d+)?)/);
    if (!match) return null;
    const width = Number(match[1].replace(",", "."));
    const depth = Number(match[2].replace(",", "."));
    if (!Number.isFinite(width) || !Number.isFinite(depth) || width <= 0 || depth <= 0) return null;
    return { width, depth, label: `${trimNumber(width)}x${trimNumber(depth)}` };
  }

  function trimNumber(value) {
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }

  function detectPreference(input) {
    const text = normalizeText(input);
    if (/retangular|comprid|estreit|linear/.test(text)) return "retangular";
    if (/quadrad|chale/.test(text)) return "quadrada";
    if (/conceito aberto|integrada|cozinha americana|open|social integrado|balcao/.test(text)) return "conceito_aberto";
    if (/em l|\bl\b/.test(text)) return "em_l";
    if (/barat|econom|popular|baixo custo|tiny|kitnet/.test(text)) return "economica";
    if (/modern|premium|gourmet/.test(text)) return "moderna";
    if (/rural|sitio|chacara|varanda|campo/.test(text)) return "rural";
    if (/ilha/.test(text)) return "ilha";
    if (/lavanderia externa|area de servico externa|servico externo/.test(text)) return "servico_externo";
    if (/corredor|setor intimo|privacidade/.test(text)) return "corredor";
    if (/suite|master/.test(text)) return "suite";
    return null;
  }

  function detectBedrooms(input) {
    const text = normalizeText(input);
    if (/(\b1\s*quarto\b|\bum\s+quarto\b|\bone\s+bedroom\b|\b1\s*bedroom\b)/.test(text)) return 1;
    if (/(\b2\s*quartos\b|\bdois\s+quartos\b|\btwo\s+bedroom\b|\b2\s*bedroom\b)/.test(text)) return 2;
    if (/(\b3\s*quartos?\b|\btres\s+quartos?\b|\bthree\s+bedroom\b|\b3\s*bedroom\b|\bcasa\s+com\s+suite\b|\bsendo\s+uma\s+suite\b)/.test(text)) return 3;
    return null;
  }

  function detectThreeBedroomFamily(input) {
    const text = normalizeText(input);
    if (/(social integrado|sala.*jantar.*cozinha|jantar.*cozinha.*integr|cozinha americana|balcao|ilha|open concept|living dining kitchen|corredor|lavanderia externa|area de servico externa|servico externo|master suite|sendo uma suite)/.test(text)) {
      return FAMILIES.threeSocial;
    }
    return FAMILIES.threeFree;
  }

  function detectCadistaHouseTemplateIntent(input) {
    const text = normalizeText(input);
    const bedrooms = detectBedrooms(text);
    const lot = parseLot(text);
    const chooseByLot = /(nao sei|nao tenho certeza|escolha|melhor|recomende|sugira)/.test(text) && lot;
    const requestedHouse = /(casa|planta|terrea|floor plan|house|kitnet|tiny|edicula|adu|residencia|suite)/.test(text);
    const inferredBedrooms = bedrooms || (chooseByLot ? 2 : null);
    if (!inferredBedrooms || !requestedHouse && !chooseByLot) return null;
    return {
      family: inferredBedrooms === 1 ? FAMILIES.one : inferredBedrooms === 2 ? FAMILIES.two : detectThreeBedroomFamily(text),
      bedrooms: inferredBedrooms,
      lot,
      preference: detectPreference(text),
      rawInput: String(input || "")
    };
  }

  function getLibrary(intent) {
    if (!intent) return null;
    if (intent.bedrooms === 1) return window.CadistaOneBedroomLibrary || null;
    if (intent.bedrooms === 2) return window.CadistaTwoBedroomLibrary || null;
    if (intent.bedrooms === 3) return window.CadistaThreeBedroomLibrary || null;
    return null;
  }

  function preferenceMatches(model, preference) {
    if (!model || !preference) return true;
    const tags = normalizeText([model.group, model.groupName, model.name, model.strategy, model.description].concat(model.tags || []).join(" "));
    if (preference === "retangular") return model.group === "rectangular" || /retangular|linear|estreita|comprida/.test(tags);
    if (preference === "quadrada") return model.group === "square" || /quadrada|chale/.test(tags);
    if (preference === "conceito_aberto") return model.group === "open" || /conceito aberto|integrada|cozinha americana|social integrado|open concept/.test(tags);
    if (preference === "em_l") return model.group === "lshape" || /em l|planta em l/.test(tags);
    if (preference === "economica") return model.group === "compact" || model.group === "popular" || /economica|popular|barata|tiny|kitnet/.test(tags);
    if (preference === "moderna") return /moderna|premium|ilha|gourmet|cozinha americana|social integrado/.test(tags);
    if (preference === "rural") return /rural|sitio|varanda|campo|cozinha maior/.test(tags);
    if (preference === "suite") return /suite|master/.test(tags);
    if (preference === "ilha") return /ilha|cozinha americana|social integrado/.test(tags);
    if (preference === "servico_externo") return /lavanderia externa|area de servico externa|servico externo/.test(tags);
    if (preference === "corredor") return /corredor|privacidade|setor intimo|quartos isolados/.test(tags);
    return true;
  }

  function recommendCadistaTemplates(intent) {
    const library = getLibrary(intent);
    if (!library || !intent) return [];
    const text = [intent.rawInput, intent.preference ? PREFERENCE_LABELS[intent.preference] : "", intent.lot ? intent.lot.label : ""].filter(Boolean).join(" ");
    const recommended = typeof library.recommend === "function" ? library.recommend(Object.assign({}, intent, { rawInput: text }), 12) : [];
    const familyFiltered = recommended.filter((model) => !intent.family || model.family === intent.family);
    const filtered = familyFiltered.filter((model) => preferenceMatches(model, intent.preference));
    const source = filtered.length ? filtered : familyFiltered.length ? familyFiltered : recommended;
    return source.slice(0, 3);
  }

  function buildIntroMessage(intent) {
    if (!intent) return "Digite um pedido como casa 1 quarto, planta 2 quartos, casa 3 quartos ou informe o terreno.";
    const count = intent.bedrooms === 1 ? "1 quarto" : intent.bedrooms === 2 ? "2 quartos" : "3 quartos com suite";
    const familyText = intent.bedrooms === 3 ? " A biblioteca 3Q tem 60 modelos-base, divididos entre social integrado com suite e suite livre." : "";
    const lotText = intent.lot ? ` Pelo terreno ${intent.lot.label}, posso sugerir 3 modelos mais adequados.` : " Se nao houver terreno, informe o tamanho do lote, por exemplo 8x20, 10x20 ou 12x25.";
    const styleText = " Posso organizar por estilo: retangular, quadrada, conceito aberto, em L, economica/popular, moderna ou rural/varanda.";
    return `Tenho ${intent.bedrooms === 3 ? "60" : "30"} modelos-base para casa terrea de ${count}.${familyText}${lotText}${styleText}`;
  }

  function buildCommand(model, intent) {
    const library = getLibrary(intent);
    if (library && typeof library.buildCommand === "function") return library.buildCommand(model, intent.lot);
    return `Gerar planta baixa ${intent.family} com tipologia ${model.name}.`;
  }

  function createUi() {
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-house-library-launcher";
    launcher.textContent = "Modelos 1Q/2Q/3Q";

    const panel = document.createElement("section");
    panel.className = "cadista-house-library-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="cadista-house-library-head"><strong>Biblioteca residencial CADISTA</strong><button type="button" data-house-close aria-label="Fechar">x</button></div>
      <div class="cadista-house-library-body">
        <textarea data-house-input placeholder="Ex.: casa de 3 quartos com suite terreno 10x25 moderna"></textarea>
        <div class="cadista-house-library-actions"><button type="button" data-house-detect>Detectar</button><button type="button" data-house-recommend>Recomendar 3</button></div>
        <p class="cadista-house-library-note" data-house-note>Biblioteca atual: 120 modelos-base, sendo 30 de 1 quarto, 30 de 2 quartos e 60 de 3 quartos.</p>
        <div class="cadista-house-library-grid" data-house-results></div>
      </div>`;
    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const input = panel.querySelector("[data-house-input]");
    const note = panel.querySelector("[data-house-note]");
    const results = panel.querySelector("[data-house-results]");

    function render(inputText) {
      const intent = detectCadistaHouseTemplateIntent(inputText || input.value);
      state.intent = intent;
      if (!intent) {
        note.textContent = "Nao identifiquei se e casa terrea de 1, 2 ou 3 quartos. Informe algo como casa 1 quarto, casa 2 quartos ou casa 3 quartos.";
        results.innerHTML = "";
        return;
      }
      const picks = recommendCadistaTemplates(intent);
      note.textContent = buildIntroMessage(intent);
      results.innerHTML = picks.map((model) => renderCard(model, intent)).join("");
    }

    function renderCard(model, intent) {
      return `<article class="cadista-house-library-card"><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.family)} | ${escapeHtml(model.groupName || model.group)}</small><p>${escapeHtml(model.description)}</p><button type="button" data-house-apply="${escapeHtml(model.id)}">Aplicar modelo</button></article>`;
    }

    launcher.addEventListener("click", () => {
      state.open = !state.open;
      panel.hidden = !state.open;
      if (state.open && !input.value) input.value = getActiveCommandText();
      if (state.open && input.value) render(input.value);
    });
    panel.querySelector("[data-house-close]").addEventListener("click", () => { state.open = false; panel.hidden = true; });
    panel.querySelector("[data-house-detect]").addEventListener("click", () => render(input.value));
    panel.querySelector("[data-house-recommend]").addEventListener("click", () => render(input.value));
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-house-apply]");
      if (!button || !state.intent) return;
      const library = getLibrary(state.intent);
      const model = library && library.templates ? library.templates.find((item) => item.id === button.getAttribute("data-house-apply")) : null;
      if (!model) return;
      applyCommand(buildCommand(model, state.intent));
      note.textContent = "Modelo aplicado como comando estruturado para o CADISTA.";
    });
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || target === input || !/^(TEXTAREA|INPUT)$/i.test(target.tagName || "")) return;
      const intent = detectCadistaHouseTemplateIntent(target.value || "");
      if (intent) {
        input.value = target.value;
        state.open = true;
        panel.hidden = false;
        render(input.value);
      }
    }, true);
  }

  function getActiveCommandText() {
    const active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/i.test(active.tagName || "") && active.value) return active.value;
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-house-library-panel"));
    const found = fields.find((field) => detectCadistaHouseTemplateIntent(field.value || ""));
    return found ? found.value : "";
  }

  function applyCommand(command) {
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-house-library-panel") && !/password|hidden|checkbox|radio/i.test(field.type || ""));
    const preferred = fields.find((field) => /comando|prompt|pedido|descricao|programa|briefing/i.test(`${field.id} ${field.name} ${field.placeholder}`));
    const target = preferred || fields.find((field) => field.offsetParent !== null);
    if (target) {
      target.focus();
      target.value = command;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.dispatchEvent(new CustomEvent("cadista:house-template", { detail: { command, intent: state.intent } }));
    try { window.localStorage.setItem("cadista:last-house-template-command", command); } catch (error) {}
  }

  function styles() {
    const css = `.cadista-house-library-launcher{position:fixed;right:18px;bottom:102px;z-index:2147483000;border:0;border-radius:6px;background:#5b3d91;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}.cadista-house-library-panel{position:fixed;right:18px;bottom:150px;z-index:2147483000;width:min(410px,calc(100vw - 36px));max-height:min(680px,calc(100vh - 176px));overflow:auto;border:1px solid #d7cdea;border-radius:8px;background:#fff;color:#211936;box-shadow:0 22px 48px rgba(0,0,0,.22);font:13px/1.35 Arial,sans-serif}.cadista-house-library-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #e7e0f2;background:#faf8ff}.cadista-house-library-head strong{font-size:13px;text-transform:uppercase}.cadista-house-library-head button{width:28px;height:28px;min-height:28px;padding:0;border:1px solid #cabddf;border-radius:6px;background:#fff;color:#211936}.cadista-house-library-body{display:grid;gap:10px;padding:12px 14px}.cadista-house-library-body textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #cabddf;border-radius:6px;padding:8px;font:12px Arial,sans-serif}.cadista-house-library-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cadista-house-library-actions button,.cadista-house-library-card button{min-height:32px;border:1px solid #5b3d91;border-radius:6px;background:#5b3d91;color:#fff;font-weight:700}.cadista-house-library-note{margin:0;border:1px solid #dfd1a3;border-radius:6px;background:#fff9ea;color:#60440f;padding:8px;font-size:12px}.cadista-house-library-grid{display:grid;gap:8px}.cadista-house-library-card{display:grid;gap:5px;border:1px solid #e1d9ee;border-radius:6px;padding:9px;background:#fdfbff}.cadista-house-library-card strong{font-size:13px}.cadista-house-library-card small{color:#665c74}.cadista-house-library-card p{margin:0;color:#3f374c;font-size:12px}`;
    const node = document.createElement("style");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.CadistaHouseTemplateLibrary = {
    families: FAMILIES,
    detectCadistaHouseTemplateIntent,
    recommendCadistaTemplates,
    buildIntroMessage
  };
  window.detectCadistaHouseTemplateIntent = detectCadistaHouseTemplateIntent;
  window.recommendCadistaTemplates = recommendCadistaTemplates;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createUi, { once: true });
  else createUi();
})();
