(function (root) {
  "use strict";

  const VERSION = "20260704-elo-stage-gate-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = clean(item).toLowerCase();
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function evaluateStage(stageAnalysis) {
    const safe = stageAnalysis || {};
    const pendentes = (safe.pendentes || []).slice();
    const bloqueadores = (safe.bloqueadores || []).slice();
    const status = bloqueadores.length ? "blocked" : pendentes.length ? "partial" : "complete";
    return {
      id: safe.id || "",
      nome: safe.nome || "",
      status: status,
      complete: status === "complete",
      partial: status === "partial",
      blocked: status === "blocked",
      pendentes: pendentes,
      bloqueadores: bloqueadores,
      podeAvancar: status !== "blocked"
    };
  }

  function evaluateBudgetGate(input) {
    const safe = input || {};
    const construction = safe.construction || {};
    const rooms = safe.rooms || {};
    const constructionBlockers = construction.bloqueadores || [];
    const constructionPending = construction.pendentes || [];
    const roomBlockers = rooms.bloqueadores || [];
    const roomPending = rooms.pendentes || [];
    const explicitBlockers = safe.bloqueadores || [];
    const blockers = unique([].concat(constructionBlockers, roomBlockers, explicitBlockers));
    const pending = unique([].concat(constructionPending, roomPending, safe.pendentes || []));
    const status = blockers.length ? "blocked" : pending.length ? "partial" : "complete";
    return {
      status: status,
      complete: status === "complete",
      partial: status === "partial",
      blocked: status === "blocked",
      pendentes: pending,
      bloqueadores: blockers,
      podeFecharOrcamentoCompleto: status === "complete",
      podeGerarEstimativaPreliminar: true,
      motivo: status === "complete" ? "Todos os obrigatorios foram atendidos." : "Existem obrigatorios pendentes; apenas estimativa preliminar com premissas explicitas e segura."
    };
  }

  root.EloStageGateEngine = {
    version: VERSION,
    evaluateStage: evaluateStage,
    evaluateBudgetGate: evaluateBudgetGate
  };
})(typeof window !== "undefined" ? window : globalThis);
