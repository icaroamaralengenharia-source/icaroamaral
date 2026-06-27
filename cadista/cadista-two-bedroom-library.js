(function () {
  "use strict";

  const FAMILY = "CASA_TERREA_2_QUARTOS";
  const GROUPS = {
    rectangular: "Retangulares",
    square: "Quadradas",
    open: "Conceito aberto",
    lshape: "Em L",
    popular: "Economica e popular"
  };

  const TEMPLATES = [
    template("2q-retangular-estreita-01", "Retangular estreita", "rectangular", ["estreita", "economica", "lote profundo", "2 quartos"], ["6x20", "7x20", "8x20"], "linear_social_front_bedrooms_back", "Sala na frente, cozinha no miolo, banheiro central e dois quartos ao fundo."),
    template("2q-retangular-longa-02", "Retangular longa", "rectangular", ["comprida", "varanda", "linear"], ["6x25", "7x25", "8x25"], "long_linear_with_final_bedrooms", "Varanda, sala, cozinha linear, banheiro e quartos finais."),
    template("2q-retangular-economica-03", "Retangular economica", "rectangular", ["economica", "barata", "integrada"], ["6x20", "7x20", "8x20"], "integrated_social_bath_between_bedrooms", "Sala e cozinha integradas com banheiro entre os quartos."),
    template("2q-retangular-corredor-lateral-04", "Retangular com corredor lateral", "rectangular", ["corredor lateral", "estreita", "ventilacao"], ["7x20", "8x20"], "side_corridor_to_bedrooms", "Circulacao lateral conectando quartos e melhorando ventilacao."),
    template("2q-retangular-quartos-lado-a-lado-05", "Retangular com quartos lado a lado", "rectangular", ["quartos juntos", "social frente"], ["8x20", "10x20"], "bedrooms_side_by_side_back", "Quartos no fundo e area social na frente."),
    template("2q-retangular-quarto-frontal-06", "Retangular com quarto frontal", "rectangular", ["quarto frontal", "privacidade", "linear"], ["8x20", "10x20"], "one_bedroom_front_one_back", "Um quarto na frente e outro no fundo, com nucleo social no centro."),
    template("2q-quadrada-compacta-07", "Quadrada compacta", "square", ["quadrada", "compacta", "integrada"], ["10x10", "10x12", "12x12"], "square_integrated_two_sides", "Sala e cozinha integradas, dois quartos laterais e banheiro central."),
    template("2q-quadrada-nucleo-molhado-08", "Quadrada com nucleo molhado", "square", ["nucleo molhado", "servico", "bem aproveitada"], ["10x12", "12x12"], "clustered_wet_core", "Cozinha, banheiro e servico agrupados para reduzir infraestrutura."),
    template("2q-quadrada-social-frontal-09", "Quadrada social frontal", "square", ["sala ampla", "social", "quadrada"], ["10x12", "12x12"], "front_social_side_bedrooms", "Sala ampla na frente, cozinha ao fundo e quartos laterais."),
    template("2q-quadrada-corredor-minimo-10", "Quadrada com corredor minimo", "square", ["corredor minimo", "compacta"], ["10x10", "10x12"], "minimal_hall_distribution", "Hall pequeno distribuindo quartos e banheiro."),
    template("2q-quadrada-economica-11", "Quadrada economica", "square", ["economica", "barata", "poucos recortes"], ["10x10", "10x12"], "simple_square_low_cuts", "Maximo aproveitamento com poucos recortes."),
    template("2q-quadrada-familiar-12", "Quadrada familiar", "square", ["familiar", "sala maior", "quartos equilibrados"], ["12x12", "12x15"], "balanced_family_square", "Sala maior e dois quartos equilibrados."),
    template("2q-aberto-simples-13", "Conceito aberto simples", "open", ["conceito aberto", "integrada", "simples"], ["8x20", "10x20"], "open_social_simple", "Sala, jantar e cozinha integrados."),
    template("2q-aberto-cozinha-americana-14", "Conceito aberto com cozinha americana", "open", ["cozinha americana", "moderna", "bancada"], ["10x20", "12x20"], "open_american_kitchen", "Bancada entre cozinha e sala com area social continua."),
    template("2q-aberto-varanda-frontal-15", "Conceito aberto com varanda frontal", "open", ["varanda", "social", "integrada"], ["10x20", "12x20"], "open_front_porch", "Sala conectada a varanda frontal."),
    template("2q-aberto-quartos-isolados-16", "Conceito aberto com quartos isolados", "open", ["quartos isolados", "privacidade", "moderna"], ["10x20", "12x20"], "open_social_private_block", "Area social aberta com setor intimo separado."),
    template("2q-aberto-economico-17", "Conceito aberto economico", "open", ["economica", "circulacao curta", "banheiro central"], ["8x20", "10x20"], "open_low_cost_central_bath", "Banheiro no centro e circulacao curta."),
    template("2q-aberto-moderno-18", "Conceito aberto moderno", "open", ["moderna", "cozinha em l", "social integrado"], ["10x20", "12x20", "12x25"], "modern_open_l_kitchen", "Sala maior, cozinha em L e quartos compactos."),
    template("2q-l-compacta-19", "Planta em L compacta", "lshape", ["em l", "compacta", "setorizada"], ["10x20", "10x25"], "compact_l_bedroom_wing", "Quartos em uma perna e social na outra."),
    template("2q-l-varanda-20", "Planta em L com varanda", "lshape", ["em l", "varanda", "protegida"], ["10x20", "12x20"], "l_protected_porch", "Varanda protegida no encontro do L."),
    template("2q-l-patio-21", "Planta em L com patio", "lshape", ["patio", "iluminacao", "ventilacao"], ["10x25", "12x25"], "l_with_patio_light", "Ventilacao e iluminacao pelo patio."),
    template("2q-l-intima-22", "Planta em L intima", "lshape", ["intima", "quartos reservados", "privacidade"], ["10x20", "12x20"], "private_bedroom_l", "Quartos mais reservados em bloco separado."),
    template("2q-l-rural-23", "Planta em L rural", "lshape", ["rural", "sitio", "cozinha maior", "servico externo"], ["12x25", "15x30"], "rural_l_big_kitchen", "Varanda, cozinha maior e servico externo."),
    template("2q-l-moderna-24", "Planta em L moderna", "lshape", ["moderna", "social integrado", "quartos em bloco"], ["12x20", "12x25"], "modern_l_separate_bedrooms", "Social integrado e quartos em bloco separado."),
    template("2q-popular-economica-25", "Popular economica", "popular", ["popular", "economica", "barata"], ["8x20", "10x20"], "popular_low_cost", "Solucao simples para lote comum."),
    template("2q-popular-varanda-26", "Popular com varanda", "popular", ["popular", "varanda", "frontal"], ["8x20", "10x20", "12x20"], "popular_front_porch", "Varanda frontal, sala, cozinha, banho e dois quartos."),
    template("2q-edicula-adu-27", "Casa de fundo/edicula", "popular", ["edicula", "adu", "acesso independente"], ["8x20", "10x20", "12x25"], "compact_back_house", "Acesso independente e planta compacta."),
    template("2q-tiny-28", "Tiny 2 quartos", "popular", ["tiny", "compacta", "quartos minimos"], ["6x20", "7x20", "8x20"], "tiny_two_bedrooms", "Quartos minimos com sala e cozinha integradas."),
    template("2q-geminada-29", "Geminada terrea", "popular", ["geminada", "parede lateral cega", "estreita"], ["6x20", "7x20", "8x20"], "attached_side_wall", "Parede lateral cega e ventilacao por frente e fundos."),
    template("2q-expansivel-30", "Casa expansivel", "popular", ["expansivel", "ampliacao futura", "familiar"], ["10x20", "10x25", "12x25"], "future_expansion_ready", "Dois quartos agora, preparada para ampliacao futura.")
  ];

  const state = { text: "", lot: null, open: false };

  function template(id, name, group, tags, bestFor, strategy, description) {
    return { id, name, family: FAMILY, group, groupName: GROUPS[group], tags, bestFor, rooms: ["sala", "cozinha", "banheiro", "quarto 1", "quarto 2", "servico"], strategy, description };
  }

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
    return Number(value).toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }

  function detectIntent(text) {
    const clean = normalizeText(text);
    const twoBedrooms = /(\b2\s*quartos\b|\bdois\s+quartos\b|\btwo\s+bedroom\b|\b2\s*bedroom\b|\bduas\s+spaln|\bdvuma\s+spaln)/.test(clean);
    const house = /(casa|planta|terrea|floor plan|house|edicula|adu|geminada)/.test(clean);
    const chooseByLot = /(nao sei|nao tenho certeza|escolha|melhor|recomende|sugira)/.test(clean) && parseLot(clean);
    return twoBedrooms && house || chooseByLot ? FAMILY : "";
  }

  function scoreTemplate(model, context) {
    const text = normalizeText(context.text);
    const lot = context.lot;
    let score = 0;
    if (lot) {
      const ratio = lot.depth / Math.max(lot.width, 0.01);
      if (lot.width <= 8 && (model.group === "rectangular" || model.id.includes("tiny") || model.id.includes("geminada"))) score += 8;
      if (ratio >= 2.2 && (model.group === "rectangular" || model.group === "popular")) score += 5;
      if (lot.width >= 10 && lot.width < 12 && (model.group === "square" || model.group === "open" || model.id.includes("l-compacta"))) score += 5;
      if (lot.width >= 12 && (model.group === "lshape" || model.id.includes("familiar") || model.tags.includes("varanda"))) score += 6;
    }
    for (const tag of model.tags) if (text.includes(normalizeText(tag))) score += 5;
    if (/(barat|econom|popular|baixo custo)/.test(text) && /(economica|barata|popular|tiny)/.test(model.tags.join(" "))) score += 9;
    if (/(moderna|americano|americana|integrada|conceito aberto|cozinha em l)/.test(text) && /(moderna|cozinha americana|integrada|social integrado)/.test(model.tags.join(" "))) score += 9;
    if (/(varanda|rural|sitio|chacara)/.test(text) && /(varanda|rural|sitio|cozinha maior)/.test(model.tags.join(" "))) score += 9;
    if (/(em l|\bl\b)/.test(text) && model.group === "lshape") score += 10;
    return score;
  }

  function recommend(text, limit) {
    const lot = parseLot(text);
    return TEMPLATES.map((model) => ({ model, score: scoreTemplate(model, { text, lot }) }))
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id))
      .slice(0, limit || 3)
      .map((item) => item.model);
  }

  function groupedTemplates() {
    return Object.keys(GROUPS).map((group) => ({ id: group, name: GROUPS[group], items: TEMPLATES.filter((model) => model.group === group) }));
  }

  function buildCommand(model, lot) {
    const lotText = lot ? ` em terreno ${lot.label}` : "";
    return [
      `Gerar planta baixa de casa terrea de 2 quartos${lotText}.`,
      `Familia: ${FAMILY}.`,
      `Tipologia escolhida: ${model.name}.`,
      `Estrategia: ${model.strategy}.`,
      "Programa minimo: sala, cozinha, banheiro, quarto 1, quarto 2 e area de servico quando couber.",
      "Respeitar recuos, taxa de ocupacao, medidas minimas, circulacao curta, ventilacao, portas, janelas, banheiro funcional e cozinha funcional.",
      `Diretriz: ${model.description}`
    ].join(" ");
  }

  function createUi() {
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-2q-launcher";
    launcher.textContent = "Biblioteca 2Q";

    const panel = document.createElement("section");
    panel.className = "cadista-2q-panel";
    panel.hidden = true;
    panel.innerHTML = `
      <div class="cadista-2q-head"><strong>Casa terrea de 2 quartos</strong><button type="button" data-cadista-2q-close aria-label="Fechar">x</button></div>
      <div class="cadista-2q-body">
        <textarea data-cadista-2q-text placeholder="Ex.: casa terrea de 2 quartos em terreno 8x20"></textarea>
        <div class="cadista-2q-actions"><button type="button" data-cadista-2q-recommend>Recomendar</button><button type="button" class="secondary" data-cadista-2q-groups>Ver familias</button></div>
        <p class="cadista-2q-note" data-cadista-2q-note>Informe o pedido ou use o comando principal do CADISTA.</p>
        <div class="cadista-2q-grid" data-cadista-2q-results></div>
      </div>`;
    document.body.appendChild(panel);
    document.body.appendChild(launcher);

    const input = panel.querySelector("[data-cadista-2q-text]");
    const results = panel.querySelector("[data-cadista-2q-results]");
    const note = panel.querySelector("[data-cadista-2q-note]");

    function renderRecommendations(text) {
      state.text = text || input.value;
      state.lot = parseLot(state.text);
      if (!detectIntent(state.text)) {
        note.textContent = "Pedido fora da familia CASA_TERREA_2_QUARTOS. Use termos como casa 2 quartos ou two bedroom house.";
        results.innerHTML = "";
        return;
      }
      note.textContent = state.lot ? `Recomendacoes para terreno ${state.lot.label}.` : "Informe o tamanho do terreno para refinar. Ex.: 8x20, 10x20, 12x25.";
      results.innerHTML = recommend(state.text, 3).map(renderCard).join("");
    }

    function renderGroups() {
      note.textContent = "30 modelos-base agrupados por familia tipologica.";
      results.innerHTML = groupedTemplates().map((group) => `<details class="cadista-2q-group" open><summary>${escapeHtml(group.name)} (${group.items.length})</summary>${group.items.map(renderCard).join("")}</details>`).join("");
    }

    function renderCard(model) {
      return `<article class="cadista-2q-card"><strong>${escapeHtml(model.name)}</strong><small>${escapeHtml(model.description)}</small><div>${model.tags.map((tag) => `<span class="cadista-2q-tag">${escapeHtml(tag)}</span>`).join("")}</div><button type="button" data-cadista-2q-apply="${escapeHtml(model.id)}">Aplicar tipologia</button></article>`;
    }

    launcher.addEventListener("click", () => {
      state.open = !state.open;
      panel.hidden = !state.open;
      if (state.open && !input.value) input.value = getActiveCommandText();
    });
    panel.querySelector("[data-cadista-2q-close]").addEventListener("click", () => { state.open = false; panel.hidden = true; });
    panel.querySelector("[data-cadista-2q-recommend]").addEventListener("click", () => renderRecommendations(input.value));
    panel.querySelector("[data-cadista-2q-groups]").addEventListener("click", renderGroups);
    panel.addEventListener("click", (event) => {
      const button = event.target.closest("[data-cadista-2q-apply]");
      if (!button) return;
      const model = TEMPLATES.find((item) => item.id === button.getAttribute("data-cadista-2q-apply"));
      if (!model) return;
      applyCommand(buildCommand(model, state.lot || parseLot(input.value)));
      note.textContent = "Tipologia aplicada como comando estruturado para o CADISTA.";
    });
    document.addEventListener("input", (event) => {
      const target = event.target;
      if (!target || target === input || !/^(TEXTAREA|INPUT)$/i.test(target.tagName || "")) return;
      if (detectIntent(target.value || "")) {
        input.value = target.value;
        state.open = true;
        panel.hidden = false;
        renderRecommendations(target.value);
      }
    }, true);
  }

  function styles() {
    const css = `.cadista-2q-launcher{position:fixed;right:18px;bottom:60px;z-index:2147483000;border:0;border-radius:6px;background:#2554a0;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}.cadista-2q-panel{position:fixed;right:18px;bottom:108px;z-index:2147483000;width:min(390px,calc(100vw - 36px));max-height:min(680px,calc(100vh - 132px));overflow:auto;border:1px solid #cdd8e7;border-radius:8px;background:#fff;color:#172033;box-shadow:0 22px 48px rgba(0,0,0,.22);font:13px/1.35 Arial,sans-serif}.cadista-2q-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-bottom:1px solid #e1e7f0;background:#f7faff}.cadista-2q-head strong{font-size:13px;text-transform:uppercase}.cadista-2q-head button{width:28px;height:28px;min-height:28px;padding:0;border:1px solid #bac7d8;border-radius:6px;background:#fff;color:#172033}.cadista-2q-body{display:grid;gap:10px;padding:12px 14px}.cadista-2q-body textarea{width:100%;min-height:76px;resize:vertical;border:1px solid #bac7d8;border-radius:6px;padding:8px;font:12px Arial,sans-serif}.cadista-2q-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cadista-2q-actions button,.cadista-2q-card button{min-height:32px;border:1px solid #2554a0;border-radius:6px;background:#2554a0;color:#fff;font-weight:700}.cadista-2q-actions button.secondary{background:#fff;color:#2554a0}.cadista-2q-grid{display:grid;gap:8px}.cadista-2q-card{display:grid;gap:5px;border:1px solid #dbe3ee;border-radius:6px;padding:9px;background:#fbfdff}.cadista-2q-card strong{font-size:13px}.cadista-2q-card small{color:#5d6877}.cadista-2q-tag{display:inline-block;margin:2px 4px 0 0;border-radius:999px;background:#eef3ff;color:#2554a0;padding:2px 6px;font-size:11px;font-weight:700}.cadista-2q-group{display:grid;gap:6px;border-top:1px solid #edf1f6;padding-top:8px}.cadista-2q-group summary{cursor:pointer;font-weight:800;color:#2554a0}.cadista-2q-note{margin:0;border:1px solid #d9c790;border-radius:6px;background:#fff9e8;color:#67460e;padding:8px;font-size:12px}`;
    const node = document.createElement("style");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function getActiveCommandText() {
    const active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/i.test(active.tagName || "") && active.value) return active.value;
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-2q-panel"));
    const found = fields.find((field) => detectIntent(field.value || ""));
    return found ? found.value : "";
  }

  function applyCommand(command) {
    const fields = Array.from(document.querySelectorAll("textarea,input")).filter((field) => !field.closest(".cadista-2q-panel") && !/password|hidden|checkbox|radio/i.test(field.type || ""));
    const preferred = fields.find((field) => /comando|prompt|pedido|descricao|programa|briefing/i.test(`${field.id} ${field.name} ${field.placeholder}`));
    const target = preferred || fields.find((field) => field.offsetParent !== null);
    if (target) {
      target.focus();
      target.value = command;
      target.dispatchEvent(new Event("input", { bubbles: true }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
    }
    window.dispatchEvent(new CustomEvent("cadista:two-bedroom-template", { detail: { family: FAMILY, command, lot: parseLot(command), templates: TEMPLATES } }));
    try { window.localStorage.setItem("cadista:last-two-bedroom-command", command); } catch (error) {}
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  window.CadistaTwoBedroomLibrary = { family: FAMILY, templates: TEMPLATES, groups: GROUPS, detectIntent, parseLot, recommend, buildCommand };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", createUi, { once: true });
  else createUi();
})();