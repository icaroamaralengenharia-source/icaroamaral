(function () {
  "use strict";
  if (window.__ELO_VISIBLE_VIEWPORT_BOUND__) return;
  window.__ELO_VISIBLE_VIEWPORT_BOUND__ = true;
  const VERSION = "20261014-viewport-v3";
  let frame = 0;
  let restoreFrame = 0;
  let interaction = 0;
  let composer = null;
  let header = null;
  let geometry = {};
  const surfaces = typeof ResizeObserver === "function" ? new ResizeObserver(schedule) : null;

  function captureReading() {
    const node = document.querySelector(".elo-messages");
    if (!node) return null;
    return { node: node, first: node.firstElementChild, top: node.scrollTop,
      atEnd: node.scrollHeight - node.scrollTop - node.clientHeight < 48, interaction: interaction };
  }
  function bindSurfaces() {
    const nextComposer = document.querySelector(".elo-input-row");
    const nextHeader = document.querySelector(".elo-product-top");
    if (composer === nextComposer && header === nextHeader) return false;
    if (surfaces) {
      surfaces.disconnect();
      if (nextComposer) surfaces.observe(nextComposer);
      if (nextHeader) surfaces.observe(nextHeader);
    }
    composer = nextComposer;
    header = nextHeader;
    return true;
  }
  function syncVisibleViewport() {
    frame = 0;
    const root = document.documentElement;
    const body = document.body;
    if (!body || body.dataset.eloProduct !== "chat") return;
    const viewport = window.visualViewport;
    const height = Number(viewport && viewport.height) || window.innerHeight;
    const top = Math.max(0, Number(viewport && viewport.offsetTop) || 0);
    if (!(height > 0)) return;
    const managed = body.classList.contains("elo-authenticated") && !root.classList.contains("elo-intent-orcamento");
    const changed = geometry.height !== height || geometry.top !== top || geometry.managed !== managed;
    const snapshot = changed ? captureReading() : null;
    root.classList.toggle("elo-viewport-managed", managed);
    root.style.setProperty("--elo-visible-height", height + "px");
    root.style.setProperty("--elo-visible-top", top + "px");
    geometry = { version: VERSION, height: height, top: top, managed: managed };
    bindSurfaces();
    // A history replay can restore its own position after this frame. Record
    // the immediate layout result so the next frame cannot overwrite it.
    if (snapshot) snapshot.afterLayoutTop = snapshot.node.scrollTop;
    // Coalesce IME resize/pan events. A stale frame cannot jump to the previous
    // conversation, or undo a scroll the reader made while it was pending.
    if (restoreFrame) window.cancelAnimationFrame(restoreFrame);
    restoreFrame = window.requestAnimationFrame(function () {
      restoreFrame = 0;
      if (snapshot && snapshot.interaction === interaction && snapshot.node.isConnected &&
          snapshot.first === snapshot.node.firstElementChild && Math.abs(snapshot.node.scrollTop - snapshot.afterLayoutTop) < 1) {
        snapshot.node.scrollTop = snapshot.atEnd
          ? Math.max(0, snapshot.node.scrollHeight - snapshot.node.clientHeight) : snapshot.top;
      }
      window.dispatchEvent(new CustomEvent("elo:viewport-change", { detail: geometry }));
    });
  }
  function schedule() {
    if (frame) return;
    frame = window.requestAnimationFrame(syncVisibleViewport);
  }
  ["resize", "pageshow", "orientationchange"].forEach(function (name) {
    window.addEventListener(name, schedule, { passive: true });
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", schedule, { passive: true });
    window.visualViewport.addEventListener("scroll", schedule, { passive: true });
  }
  ["touchstart", "wheel", "pointerdown", "keydown"].forEach(function (name) {
    document.addEventListener(name, function () { interaction += 1; }, { passive: true, capture: true });
  });
  document.addEventListener("focusin", schedule);
  document.addEventListener("focusout", schedule);
  document.addEventListener("visibilitychange", function () { if (!document.hidden) schedule(); });
  if (typeof MutationObserver === "function" && document.body) {
    new MutationObserver(function (records) {
      if (bindSurfaces() || records.some(function (record) { return record.target === document.body && record.type === "attributes"; })) schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  }
  window.EloVisibleViewport = { refresh: schedule, getState: function () { return Object.assign({}, geometry); } };
  syncVisibleViewport();
})();
