(function () {
  "use strict";

  const FAMILY = "CASA_TERREA_1_QUARTO";
  const GROUPS = {
    rectangular: "Retangulares",
    square: "Quadradas",
    open: "Conceito aberto",
    lshape: "Em L",
    compact: "Tiny, kitnet e rural"
  };

  const TEMPLATES = [
    template("1q-retangular-estreita-01", "Retangular estreita", "rectangular", ["estreita", "economica", "lote profundo"], ["5x20", "6x20", "7x20", "8x20"], "linear_front_to_back", "Sala na frente, cozinha central, banheiro no miolo e quarto no fundo."),
    template("1q-retangular-longa-02", "Retangular longa", "rectangular", ["comprida", "varanda", "linear"], ["6x25", "7x25", "8x25"], "linear_with_front_porch", "Varanda, sala, cozinha linear, banho e quarto final."),
    template("1q-retangular-compacta-03", "Retangular compacta", "rectangular", ["compacta", "integrada", "baixo custo"], ["6x18", "7x18", "8x20"], "compact_integrated", "Sala e cozinha integradas, banheiro lateral e quarto no fundo."),
    template("1q-retangular-corredor-lateral-04", "Retangular com corredor lateral", "rectangular", ["estreita", "ventilacao lateral", "corredor"], ["7x20", "8x20", "8x25"], "side_corridor", "Ambientes em sequencia com faixa lateral para iluminacao e ventilacao."),
    template("1q-retangular-economica-05", "Retangular economica", "rectangular", ["economica", "popular", "pouca circulacao"], ["5x20", "6x20", "7x20"], "wet_core_between_social_private", "Circulacao minima e banheiro entre cozinha e quarto."),
    template("1q-retangular-premium-06", "Retangular premium", "rectangular", ["premium", "moderna", "varanda gourmet"], ["8x20", "10x20", "10x25"], "premium_linear_suite", "Suite maior, cozinha americana e varanda gourmet pequena."),
    template("1q-quadrada-compacta-07", "Quadrada compacta", "square", ["quadrada", "compacta", "integrada"], ["10x10", "11x11", "12x12"], "square_integrated_core", "Sala e cozinha integradas, quarto lateral e banheiro central."),
    template("1q-quadrada-social-frontal-08", "Quadrada social frontal", "square", ["quadrada", "sala ampla", "social"], ["10x12", "12x12"], "front_social_square", "Sala ampla na frente, cozinha ao fundo e quarto lateral."),
    template("1q-quadrada-nucleo-molhado-09", "Quadrada com nucleo molhado", "square", ["bem aproveitada", "hidraulica compacta", "servico"], ["10x10", "10x12", "12x12"], "wet_core_cluster", "Banheiro, cozinha e lavanderia agrupados para reduzir infraestrutura."),
    template("1q-quadrada-varanda-frontal-10", "Quadrada com varanda frontal", "square", ["varanda", "entrada protegida", "quadrada"], ["10x12", "12x12"], "square_front_porch", "Entrada protegida e sala integrada com varanda frontal."),
    template("1q-quadrada-quarto-maior-11", "Quadrada com quarto maior", "square", ["quarto amplo", "compacta", "privativa"], ["10x10", "12x12"], "large_bedroom_square", "Quarto priorizado com area social compacta."),
    template("1q-quadrada-chale-12", "Quadrada tipo chale", "square", ["chale", "simetrica", "economica"], ["10x10", "12x12"], "simple_symmetric_chalet", "Implantacao simetrica, simples e economica."),
    template("1q-aberto-simples-13", "Conceito aberto simples", "open", ["conceito aberto", "integrada", "simples"], ["8x20", "10x20", "12x12"], "open_social_simple", "Sala, jantar e cozinha em ambiente unico."),
    template("1q-aberto-ilha-14", "Conceito aberto com ilha", "open", ["moderna", "ilha", "cozinha central"], ["10x20", "12x20", "12x25"], "open_kitchen_island", "Cozinha central com bancada ou ilha e social amplo."),
    template("1q-aberto-varanda-15", "Conceito aberto com varanda", "open", ["varanda", "integracao externa", "social"], ["8x20", "10x20", "12x20"], "open_porch_connection", "Integracao entre sala, cozinha e varanda."),
    template("1q-aberto-suite-16", "Conceito aberto com suite", "open", ["suite", "moderna", "reservada"], ["10x20", "12x20"], "open_social_private_suite", "Quarto reservado com acesso proximo ao banheiro."),
    template("1q-aberto-economico-17", "Conceito aberto economico", "open", ["economica", "pouca parede", "sem corredor"], ["7x20", "8x20", "10x20"], "open_low_partition", "Poucos corredores e paredes internas para reduzir custo."),
    template("1q-aberto-premium-18", "Conceito aberto premium", "open", ["premium", "moderna", "social amplo"], ["10x20", "12x20", "12x25"], "open_premium_private_bedroom", "Area social ampla com quarto reservado."),
    template("1q-l-compacta-19", "Planta em L compacta", "lshape", ["em l", "compacta", "setorizada"], ["8x20", "10x20"], "compact_l_layout", "Quarto em uma perna e area social na outra."),
    template("1q-l-patio-20", "Planta em L com patio", "lshape", ["patio", "em l", "externa"], ["10x20", "12x20", "12x25"], "l_with_inner_patio", "Area externa protegida no encontro do L."),
    template("1q-l-varanda-21", "Planta em L com varanda", "lshape", ["varanda", "em l", "social"], ["10x20", "12x20"], "l_with_social_porch", "Varanda acompanha a area social."),
    template("1q-l-intima-22", "Planta em L intima", "lshape", ["intima", "quarto isolado", "privacidade"], ["8x20", "10x20"], "private_bedroom_l", "Quarto mais isolado da sala e cozinha."),
    template("1q-l-rural-23", "Planta em L rural", "lshape", ["rural", "sitio", "varanda"], ["10x25", "12x25", "15x30"], "rural_l_porch_service", "Varanda, cozinha generosa e lavanderia externa."),
    template("1q-l-moderna-24", "Planta em L moderna", "lshape", ["moderna", "integrada", "banheiro central"], ["10x20", "12x20"], "modern_l_wet_core", "Social integrado, banheiro no miolo e quarto lateral."),
    template("1q-tiny-linear-25", "Tiny house linear", "compact", ["tiny house", "estreita", "linear"], ["5x15", "5x20", "6x20"], "tiny_linear_sequence", "Largura pequena com ambientes em sequencia."),
    template("1q-tiny-quadrada-26", "Tiny house quadrada", "compact", ["tiny house", "ultracompacta", "quadrada"], ["8x8", "9x9", "10x10"], "tiny_square_core", "Solucao ultracompacta para lote pequeno."),
    template("1q-tiny-mezanino-27", "Tiny house com mezanino opcional", "compact", ["tiny house", "mezanino futuro", "compacta"], ["5x20", "6x20", "8x20"], "tiny_future_mezzanine", "Base terrea com possibilidade futura de mezanino."),
    template("1q-kitnet-ampliada-28", "Kitnet ampliada", "compact", ["kitnet", "economica", "compacta"], ["5x20", "6x20", "8x20"], "expanded_studio_separate_bedroom", "Quarto separado, banheiro e sala/cozinha compacta."),
    template("1q-edicula-adu-29", "Edicula ADU", "compact", ["edicula", "adu", "casa de fundo"], ["8x20", "10x20", "12x25"], "backyard_adu_independent_access", "Casa de fundo com acesso independente."),
    template("1q-popular-rural-30", "Casa popular rural", "compact", ["rural", "popular", "varanda", "servico"], ["10x25", "12x25", "15x30"], "popular_rural_porch", "Varanda frontal, sala, cozinha, quarto, banheiro e area de servico.")
  ];

  const state = {
    text: "",
    lot: null,
    selectedId: "",
    group: "",
    open: false
  };

  function template(id, name, group, tags, bestFor, strategy, description) {
    return {
      id,
      name,
      family: FAMILY,
      group,
      groupName: GROUPS[group],
      tags,
      bestFor,
      rooms: ["sala", "cozinha", "banheiro", "quarto", "servico"],
      strategy,
      description
    };
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function detectIntent(text) {
    const clean = normalizeText(text);
    const oneBedroom = /(\b1\s*quarto\b|\bum\s+quarto\b|\bone\s+bedroom\b|\b1\s*bedroom\b)/.test(clean);
    const house = /(casa|planta|terrea|kitnet|tiny house|house|floor plan|adu|edicula)/.test(clean);
    const chooseByLot = /(nao sei|nao tenho certeza|escolha|melhor|recomende|sugira)/.test(clean) && parseLot(clean);
    return oneBedroom && house || chooseByLot ? FAMILY : "";
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
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }

  function scoreTemplate(model, context) {
    const text = normalizeText(context.text);
    const lot = context.lot;
    let score = 0;
    if (lot) {
      const ratio = lot.depth / Math.max(lot.width, 0.01);
      if (lot.width <= 8 && (model.group === "rectangular" || model.id.includes("tiny-linear"))) score += 7;
      if (ratio >= 2.2 && (model.group === "rectangular" || model.group === "compact")) score += 5;
      if (ratio >= 1.7 && ratio < 2.2 && (model.group === "rectangular" || model.group === "open")) score += 4;
      if (Math.abs(lot.width - lot.depth) <= 3 && (model.group === "square" || model.group === "open")) score += 6;
      if (lot.width >= 10 && model.group === "lshape") score += 1;
    }
    for (const tag of model.tags) {
      const cleanTag = normalizeText(tag);
      if (cleanTag && text.includes(cleanTag)) score += 5;
    }
    if (/(barat|econom|popular|baixo custo)/.test(text) && model.tags.includes("economica")) score += 8;
    if (/(moderna|premium|ilha|gourmet)/.test(text) && /moderna|premium|ilha|gourmet/.test(model.tags.join(" "))) score += 8;
    if (/(varanda|rural|sitio|chacara)/.test(text) && /varanda|rural|sitio/.test(model.tags.join(" "))) score += 8;
    if (/(aproveitada|pouca circulacao|nucleo molhado|compacta)/.test(text) && /(bem aproveitada|compacta|pouca circulacao)/.test(model.tags.join(" "))) score += 7;
    if (/(em l|\bl\b)/.test(text) && model.group === "lshape") score += 9;
    if (/(conceito aberto|integrada|open)/.test(text) && model.group === "open") score += 9;
    return score;
  }

  function recommend(text, limit) {
    const lot = parseLot(text);
    const ranked = TEMPLATES.map((model) => ({ model, score: scoreTemplate(model, { text, lot }) }))
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id));
    return ranked.slice(0, limit || 3).map((item) => item.model);
  }

  function groupedTemplates() {
    return Object.keys(GROUPS).map((group) => ({
      id: group,
      name: GROUPS[group],
      items: TEMPLATES.filter((model) => model.group === group)
    }));
  }

  function buildCommand(model, lot) {
    const lotText = lot ? ` em terreno ${lot.label}` : "";
    return [
      `Gerar planta baixa de casa terrea de 1 quarto${lotText}.`,
      `Familia: ${FAMILY}.`,
      `Tipologia escolhida: ${model.name}.`,
      `Estrategia: ${model.strategy}.`,
      "Respeitar recuos, taxa de ocupacao, medidas minimas, ventilacao, circulacao, portas, janelas, banheiro funcional e cozinha funcional.",
      `Ambientes: ${model.rooms.join(", ")}.`,
      `Diretriz: ${model.description}`
    ].join(" ");
  }

  function styles() {
    const css = `
      .cadista-1q-launcher{position:fixed;right:18px;bottom:18px;z-index:2147483000;border:0;border-radius:6px;background:#123d31;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}
      .cadista-1q-panel{position:fixed;right:18px;bottom:66px;z-index:2147483000;width:min(380px,calc(100vw - 36px));max-height:min(680px,calc(100vh - 96px));overflow:auto;border:1px solid #cfd8d2;border-radius:8px;background:#fff;color:#1b2420;box-shadow:0 22px 48px rgba(0,0,0,.22);font:13px/1.35 Arial,sans-serif}
      .cadista-1q-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #e0e5e1;background:#f7faf8}
      .cadista-1q-head strong{font-size:13px;text-transform:uppercase}.cadista-1q-head button{width:28px;height:28px;min-height:28px;padding:0;border:1px solid #b8c5bf;border-radius:6px;background:#fff;color:#1b2420}
      .cadista-1q-body{display:grid;gap:10px;padding:12px 14px}.cadista-1q-body textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #bac6c0;border-radius:6px;padding:8px;font:12px Arial,sans-serif}
      .cadista-1q-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cadista-1q-actions button,.cadista-1q-card button{min-height:32px;border:1px solid #123d31;border-radius:6px;background:#123d31;color:#fff;font-weight:700}
      .cadista-1q-actions button.secondary{background:#fff;color:#123d31}.cadista-1q-grid{display:grid;gap:8px}.cadista-1q-card{display:grid;gap:5px;border:1px solid #d9e1dd;border-radius:6px;padding:9px;background:#fbfcfb}
      .cadista-1q-card strong{font-size:13px}.cadista-1q-card small{color:#5e6c65}.cadista-1q-tag{display:inline-block;margin:2px 4px 0 0;border-radius:999px;background:#edf5f1;color:#1f5f49;padding:2px 6px;font-size:11px;font-weight:700}
      .cadista-1q-group{display:grid;gap:6px;border-top:1px solid #edf0ee;padding-top:8px}.cadista-1q-group summary{cursor:pointer;font-weight:800;color:#123d31}
      .cadista-1q-note{margin:0;border:1px solid #e7d5a8;border-radius:6px;background:#fff8e7;color:#67460e;padding:8px;font-size:12px}
    `;
    const node = document.createElement("style");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function createUi() {
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-1q-launcher";
    launcher.textContent = "Biblioteca 1Q";

    const panel = document.createElement("section");
    panel.className = "cadista-1q-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="cadista-1q-head">
        <strong>Casa terrea de 1 quarto</strong>
        <button type="button" data-cadista-1q-close aria-label="Fechar">x</button>
      </div>
      <div class="cadista-1q-body">
        <textarea data-cadista-1q-text placeholder="Ex.: casa terrea de 1 quarto em terreno 8x20"></textarea>
        <div class="cadista-1q-actions">
          <button type="button" data-cadista-1q-recommend>Recomendar</button>
          <button type="button" class="secondary" data-cadista-1q-groups>Ver familias</button>
        </div>
        <p class="cadista-1q-note" data-cadista-1q-note>Informe o pedido ou use o comando principal do CADISTA.</p>
        <div class="cadista-1q-grid" data-cadista-1q-results></div>
      </div>
    `;

    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const input = panel.querySelector("[data-cadista-1q-text]");
    const results = panel.querySelector("[data-cadista-1q-results]");
    const note = panel.querySelector("[data-cadista-1q-note]");

    function renderRecommendations(text) {
      state.text = text || input.value;
      state.lot = parseLot(state.text);
      const intent = detectIntent(state.text);
      if (!intent) {
        note.textContent = "Pedido fora da familia CASA_TERREA_1_QUARTO. Use termos como casa 1 quarto, kitnet terrea ou tiny house 1 bedroom.";
        results.innerHTML = "";
        return;
      }
      const picks = recommend(state.text, 3);
      note.textContent = state.lot ? `Recomendacoes para terreno ${state.lot.label}.` : "Informe o tamanho do terreno para refinar. Ex.: 8x20, 10x20, 12x25.";
      results.innerHTML = picks.map(renderCard).join("");
    }

    function renderGroups() {
      note.textContent = "30 modelos-base agrupados por familia tipologica.";
      results.innerHTML = groupedTemplates().map((group) => `
        <details class="cadista-1q-group" open>
          <summary>${escapeHtml(group.name)} (${group.items.length})</summary>
          ${group.items.map(renderCard).join("")}
        </details>
      `).join("");
    }

    function renderCard(model) {
      return `
        <article class="cadista-1q-card">
          <strong>${escapeHtml(model.name)}</strong>
          <small>${escapeHtml(model.description)}</small>
          <div>${model.tags.map((tag) => `<span class="cadista-1q-tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <button type="button" data-cadista-1q-apply="${escapeHtml(model.id)}">Aplicar tipologia</button>
        </article>
      `;
    }

    launcher.addEventListener("click", () => {
      state.open = !state.open;
      panel.hidden = !state.open;
      if (state.open && !input.value) {
        const activeText = getActiveCommandText();
        if (activeText) input.value = activeText;
      }
    });
    panel.querySelector("[data-cadista-1q-close]").addEventListener("click", () => {
      state.open = false;
      panel.hidden = true;
    });
    panel.querySelector("[data-cadista-1q-recommend]").addEventListener("click", () => renderRecommendations(input.value));
    panel.querySelector("[data-cadista-1q-groups]").addEventListener("click", renderGroups);
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cadista-1q-apply]");
      if (!button) return;
      const model = TEMPLATES.find((item) => item.id === button.getAttribute("data-cadista-1q-apply"));
      if (!model) return;
      const command = buildCommand(model, state.lot || parseLot(input.value));
      applyCommand(command);
      note.textContent = "Tipologia aplicada como comando estruturado para o CADISTA.";
    });

    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || target === input || !/^(TEXTAREA|INPUT)$/i.test(target.tagName || "")) return;
      const text = target.value || "";
      if (detectIntent(text)) {
        input.value = text;
        state.open = true;
        panel.hidden = false;
        renderRecommendations(text);
      }
    }, true);
  }

  function getActiveCommandText() {
    const active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/i.test(active.tagName || "") && active.value) return active.value;
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-1q-panel"));
    const found = fields.find((field) => detectIntent(field.value || ""));
    return found ? found.value : "";
  }

  function applyCommand(command) {
    const fields = Array.from(document.querySelectorAll("textarea,input"))
      .filter((field) => !field.closest(".cadista-1q-panel") && !/password|hidden|checkbox|radio/i.test(field.type || ""));
    const preferred = fields.find((field) => /comando|prompt|pedido|descricao|programa|briefing/i.test(`${field.id} ${field.name} ${field.placeholder}`));
    const target = preferred || fields.find((field) => field.offsetParent !== null);
    if (target) {
      target.focus();
      target.value = command;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.dispatchEvent(new CustomEvent("cadista:one-bedroom-template", {
      detail: {
        family: FAMILY,
        command,
        lot: parseLot(command),
        templates: TEMPLATES
      }
    }));
    try {
      window.localStorage.setItem("cadista:last-one-bedroom-command", command);
    } catch (error) {
      // Local storage can be blocked in private contexts.
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.CadistaOneBedroomLibrary = {
    family: FAMILY,
    templates: TEMPLATES,
    groups: GROUPS,
    detectIntent,
    parseLot,
    recommend,
    buildCommand
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createUi, { once: true });
  } else {
    createUi();
  }
})();
