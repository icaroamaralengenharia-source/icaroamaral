(function () {
  "use strict";

  const TEST_COMMANDS = [
    "casa 1 quarto economica terreno 6x20",
    "casa 1 quarto moderna terreno 10x20",
    "casa 2 quartos barata terreno 8x20",
    "casa 2 quartos moderna terreno 10x20",
    "casa 2 quartos em L com varanda terreno 12x25",
    "casa 3 quartos sendo uma suite terreno 10x25",
    "casa 3 quartos sala jantar cozinha integrada balcao americano lavanderia externa terreno 12x25",
    "casa 3 quartos barata com suite terreno 8x20",
    "casa 3 quartos moderna com ilha terreno 12x25",
    "casa 3 quartos rural com varanda terreno 12x25"
  ];

  const state = { open: false, results: [] };

  function runCadistaVisualPipelineTest() {
    const results = TEST_COMMANDS.map((command, index) => {
      try {
        if (typeof window.runCadistaDesignPipeline !== "function") throw new Error("Pipeline CADISTA nao carregado.");
        const result = window.runCadistaDesignPipeline(command);
        return normalizeResult(command, index + 1, result, null);
      } catch (error) {
        return normalizeResult(command, index + 1, null, error);
      }
    });
    state.results = results;
    renderResults(results);
    return results;
  }

  function normalizeResult(command, index, result, error) {
    const cad = result && result.cad || null;
    const selectedTemplate = result && result.selectedTemplate || null;
    const intent = result && result.intent || null;
    const warnings = result && Array.isArray(result.warnings) ? result.warnings : [];
    const editable = Boolean(cad && cad.metadata && cad.metadata.editable === true);
    const hasEntities = Boolean(cad && cad.walls && cad.walls.length && cad.doors && cad.doors.length && cad.windows && cad.windows.length && cad.rooms && cad.rooms.length);
    return {
      index,
      command,
      ok: Boolean(result && result.readyToApply && hasEntities && editable && cad.metadata.isStaticSvg !== true && architecturalPassed),
      result,
      error: error ? error.message : "",
      family: intent && intent.family || "-",
      model: selectedTemplate && selectedTemplate.name || "-",
      templateId: selectedTemplate && selectedTemplate.id || "-",
      score: selectedTemplate && Number.isFinite(Number(selectedTemplate.pipelineScore)) ? selectedTemplate.pipelineScore : "-",
      architecturalScore: review && Number.isFinite(Number(review.architecturalScore || review.score)) ? review.architecturalScore || review.score : "-",
      architecturalPassed,
      issues: review && Array.isArray(review.issues) ? review.issues : [],
      improvements: review && Array.isArray(review.improvements) ? review.improvements : [],
      warnings: warnings.map((item) => item.message || item.code || String(item)),
      counts: {
        walls: cad && cad.walls ? cad.walls.length : 0,
        doors: cad && cad.doors ? cad.doors.length : 0,
        windows: cad && cad.windows ? cad.windows.length : 0,
        rooms: cad && cad.rooms ? cad.rooms.length : 0
      },
      editable,
      staticSvg: Boolean(cad && cad.metadata && cad.metadata.isStaticSvg === true),
      readyToApply: Boolean(result && result.readyToApply)
    };
  }

  function renderResults(results) {
    const panel = ensurePanel();
    const output = panel.querySelector("[data-visual-output]");
    const passed = results.filter((item) => item.ok).length;
    output.innerHTML = [
      `<div class="cadista-visual-summary"><strong>${passed}/${results.length} plantas aprovadas</strong><span>${passed === results.length ? "Todas renderizadas como preview a partir de objetos CAD editaveis." : "Revise os itens com alerta."}</span></div>`,
      `<div class="cadista-visual-grid">${results.map(renderCard).join("")}</div>`
    ].join("");
    panel.hidden = false;
    state.open = true;
  }

  function renderCard(item) {
    const cad = item.result && item.result.cad;
    return `
      <article class="cadista-visual-card ${item.ok ? "ok" : "fail"}">
        <div class="cadista-visual-card-head">
          <strong>${item.index}. ${escapeHtml(item.model)}</strong>
          <span>${item.ok ? "OK" : "REVISAR"}</span>
        </div>
        <p>${escapeHtml(item.command)}</p>
        ${renderPreview(cad)}
        <dl>
          <dt>Familia</dt><dd>${escapeHtml(item.family)}</dd>
          <dt>Template</dt><dd>${escapeHtml(item.templateId)}</dd>
          <dt>Score</dt><dd>${escapeHtml(item.score)}</dd>
          <dt>Arquitetura</dt><dd>${escapeHtml(item.architecturalScore)} / ${item.architecturalPassed ? "OK" : "revisar"}</dd>
          <dt>Paredes</dt><dd>${item.counts.walls}</dd>
          <dt>Portas</dt><dd>${item.counts.doors}</dd>
          <dt>Janelas</dt><dd>${item.counts.windows}</dd>
          <dt>Ambientes</dt><dd>${item.counts.rooms}</dd>
          <dt>Editavel</dt><dd>${item.editable ? "sim" : "nao"}</dd>
          <dt>SVG estatico</dt><dd>${item.staticSvg ? "sim" : "nao"}</dd>
        </dl>
        ${item.error ? `<p class="cadista-visual-error">${escapeHtml(item.error)}</p>` : ""}
        ${item.warnings.length ? `<ul>${item.warnings.slice(0, 4).map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>` : ""}
      </article>
    `;
  }

  function renderPreview(cad) {
    if (!cad || !cad.walls || !cad.walls.length) return `<div class="cadista-visual-preview empty">Sem CAD gerado</div>`;
    const bounds = calculateBounds(cad);
    const width = 220;
    const height = 160;
    const scale = Math.min(width / Math.max(bounds.width, 1), height / Math.max(bounds.height, 1)) * 0.82;
    const offsetX = (width - bounds.width * scale) / 2 - bounds.minX * scale;
    const offsetY = (height - bounds.height * scale) / 2 - bounds.minY * scale;
    function pxX(value) { return round(value * scale + offsetX); }
    function pxY(value) { return round(value * scale + offsetY); }
    const rooms = (cad.rooms || []).map((room) => `<rect x="${pxX(room.x)}" y="${pxY(room.y)}" width="${round(room.width * scale)}" height="${round(room.depth * scale)}" fill="${roomColor(room.zone || room.name)}" stroke="#d2cabf" stroke-width="1"/>`).join("");
    const walls = (cad.walls || []).map((wall) => {
      const width = wall.wallRole === "external" || Number(wall.thickness) >= 0.18 ? 3.2 : 1.5;
      return `<line x1="${pxX(wall.x1)}" y1="${pxY(wall.y1)}" x2="${pxX(wall.x2)}" y2="${pxY(wall.y2)}" stroke="#1f2933" stroke-width="${width}" stroke-linecap="square"/>`;
    }).join("");
    const doors = (cad.doors || []).map((door) => `<circle cx="${pxX(door.x)}" cy="${pxY(door.y)}" r="2.4" fill="#b45309"/>`).join("");
    const windows = (cad.windows || []).map((item) => `<rect x="${pxX(item.x) - 3}" y="${pxY(item.y) - 1.5}" width="6" height="3" fill="#0369a1"/>`).join("");
    const labels = (cad.rooms || []).slice(0, 9).map((room) => `<text x="${pxX(room.x + room.width / 2)}" y="${pxY(room.y + room.depth / 2)}" text-anchor="middle" font-size="7" fill="#27313a">${escapeSvg(shortLabel(room.name))}</text>`).join("");
    return `<svg class="cadista-visual-preview" viewBox="0 0 ${width} ${height}" role="img" aria-label="Preview CAD editavel">${rooms}${walls}${doors}${windows}${labels}</svg>`;
  }

  function calculateBounds(cad) {
    const xs = [];
    const ys = [];
    (cad.walls || []).forEach((wall) => {
      xs.push(Number(wall.x1), Number(wall.x2));
      ys.push(Number(wall.y1), Number(wall.y2));
    });
    (cad.rooms || []).forEach((room) => {
      xs.push(Number(room.x), Number(room.x) + Number(room.width));
      ys.push(Number(room.y), Number(room.y) + Number(room.depth));
    });
    const minX = Math.min.apply(null, xs);
    const maxX = Math.max.apply(null, xs);
    const minY = Math.min.apply(null, ys);
    const maxY = Math.max.apply(null, ys);
    return { minX, minY, width: maxX - minX, height: maxY - minY };
  }

  function roomColor(value) {
    const text = String(value || "").toLowerCase();
    if (text.includes("private") || text.includes("quarto") || text.includes("suite")) return "#edf3ff";
    if (text.includes("service") || text.includes("cozinha") || text.includes("servico")) return "#f2f7e9";
    if (text.includes("wet") || text.includes("banheiro")) return "#e8f6fb";
    if (text.includes("circulation") || text.includes("corredor")) return "#f5f0e8";
    return "#fff8df";
  }

  function shortLabel(value) {
    return String(value || "").replace("sala jantar cozinha integradas", "social").replace("area de servico", "servico").replace("banheiro social", "banho");
  }

  function ensurePanel() {
    let panel = document.querySelector("[data-cadista-visual-panel]");
    if (panel) return panel;
    styles();
    const launcher = document.createElement("button");
    launcher.type = "button";
    launcher.className = "cadista-visual-launcher";
    launcher.textContent = "Teste 10";
    launcher.addEventListener("click", () => {
      const target = ensurePanel();
      state.open = !state.open;
      target.hidden = !state.open;
      if (state.open && !state.results.length) runCadistaVisualPipelineTest();
    });
    panel = document.createElement("section");
    panel.className = "cadista-visual-panel";
    panel.setAttribute("data-cadista-visual-panel", "true");
    panel.hidden = true;
    panel.innerHTML = `<div class="cadista-visual-head"><strong>Teste Visual CADISTA - 10 Plantas</strong><button type="button" data-visual-run>Rodar teste</button><button type="button" data-visual-close>x</button></div><div data-visual-output class="cadista-visual-output">Clique em Rodar teste.</div>`;
    panel.querySelector("[data-visual-run]").addEventListener("click", runCadistaVisualPipelineTest);
    panel.querySelector("[data-visual-close]").addEventListener("click", () => { state.open = false; panel.hidden = true; });
    document.body.appendChild(panel);
    document.body.appendChild(launcher);
    return panel;
  }

  function styles() {
    if (document.querySelector("[data-cadista-visual-style]")) return;
    const css = `.cadista-visual-launcher{position:fixed;right:18px;bottom:228px;z-index:2147483000;border:0;border-radius:6px;background:#1f2937;color:#fff;padding:10px 12px;font:700 12px Arial,sans-serif;box-shadow:0 10px 26px rgba(0,0,0,.18)}.cadista-visual-panel{position:fixed;left:18px;right:18px;bottom:18px;top:72px;z-index:2147482999;overflow:auto;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#111827;box-shadow:0 24px 64px rgba(0,0,0,.24);font:12px/1.35 Arial,sans-serif}.cadista-visual-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#f8fafc}.cadista-visual-head strong{margin-right:auto;font-size:13px;text-transform:uppercase}.cadista-visual-head button{min-height:30px;border:1px solid #1f2937;border-radius:6px;background:#1f2937;color:#fff;font-weight:700}.cadista-visual-output{padding:12px}.cadista-visual-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;padding:10px;border:1px solid #d8e1eb;border-radius:6px;background:#f8fafc}.cadista-visual-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.cadista-visual-card{display:grid;gap:7px;border:1px solid #d9e2ec;border-radius:8px;padding:10px;background:#fff}.cadista-visual-card.ok{border-color:#a7d8bd}.cadista-visual-card.fail{border-color:#efb5b5;background:#fffafa}.cadista-visual-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}.cadista-visual-card-head strong{font-size:12px}.cadista-visual-card-head span{font-weight:800;color:#166534}.cadista-visual-card.fail .cadista-visual-card-head span{color:#991b1b}.cadista-visual-card p{margin:0;color:#475569}.cadista-visual-preview{width:100%;height:160px;border:1px solid #e5e7eb;border-radius:6px;background:#fff}.cadista-visual-preview.empty{display:grid;place-items:center;color:#64748b}.cadista-visual-card dl{display:grid;grid-template-columns:82px 1fr;gap:3px;margin:0}.cadista-visual-card dt{font-weight:800;color:#334155}.cadista-visual-card dd{margin:0;color:#111827}.cadista-visual-card ul{margin:0;padding-left:18px;color:#92400e}.cadista-visual-card .cadista-visual-improvements{color:#166534}.cadista-visual-error{color:#991b1b;font-weight:800}`;
    const node = document.createElement("style");
    node.setAttribute("data-cadista-visual-style", "true");
    node.textContent = css;
    document.head.appendChild(node);
  }

  function round(value) {
    return Math.round(Number(value || 0) * 100) / 100;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function escapeSvg(value) {
    return escapeHtml(value).replace(/'/g, "&apos;");
  }

  window.CadistaVisualPipelineTest = { commands: TEST_COMMANDS, runCadistaVisualPipelineTest };
  window.runCadistaVisualPipelineTest = runCadistaVisualPipelineTest;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ensurePanel, { once: true });
  else ensurePanel();
})();
