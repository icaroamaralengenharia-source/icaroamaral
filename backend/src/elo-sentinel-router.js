import express from "express";
import { createEloSentinelService } from "./elo-sentinel-service.js";
import { createEloSentinelStore } from "./elo-sentinel-store.js";

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isEnabled(env = {}) {
  return clean(env.ELO_SENTINEL_ENABLED).toLowerCase() === "true";
}

function isOperationalTimelineEnabled(env = {}) {
  return clean(env.ELO_OPERATIONAL_TIMELINE_ENABLED || env.ELO_SENTINEL_OPERATIONAL_TIMELINE_ENABLED).toLowerCase() === "true";
}

function safeStatus(error, fallback = 500) {
  const status = Number(error && (error.status || error.statusCode)) || fallback;
  if (status < 400 || status > 599) return fallback;
  return status;
}

function safeErrorCode(error, fallback = "elo_sentinel_request_failed") {
  const known = clean(error && (error.code || error.message), 160);
  if (!known || /database|postgres|duplicate key|violates|syntax/i.test(known)) return fallback;
  return known;
}

function contextScope(context = {}, source = {}) {
  const profile = context.profile || {};
  return {
    institution_id: clean(context.institutionId || context.institution_id || profile.institution_id || source.institution_id || source.institutionId, 140),
    company_id: clean(context.companyId || context.company_id || profile.company_id || source.company_id || source.companyId, 140),
    project_id: clean(source.project_id || source.projectId || context.projectId || context.project_id || profile.project_id, 140),
    created_by: clean(context.userId || context.user_id || profile.id, 140) || null
  };
}

function requestScope(request, context) {
  return contextScope(context, Object.assign({}, request.query || {}, request.body || {}));
}

async function requireAuth(request, response, resolveAuthContext) {
  if (!clean(request.headers.authorization)) {
    response.status(401).json({ ok: false, error: "authentication_required" });
    return null;
  }
  const context = request.eloAuthContext || await resolveAuthContext(request);
  if (!context || !context.ok) {
    response.status(context && context.status ? context.status : 401).json({ ok: false, error: clean(context && context.error || "invalid_session") });
    return null;
  }
  return context;
}

export function createEloSentinelRouter(options = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const store = options.store || createEloSentinelStore({ client: options.database || null });
  const service = options.service || createEloSentinelService({ store });
  const resolveAuthContext = options.resolveAuthContext || (async () => ({ ok: false, status: 401, error: "authentication_required" }));

  router.use(express.json({ limit: "256kb" }));

  router.use((request, response, next) => {
    if (!isEnabled(env)) {
      response.status(503).json({ ok: false, error: "elo_sentinel_disabled" });
      return;
    }
    next();
  });

  router.post("/evidences", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const scope = requestScope(request, context);
      const result = await service.createEvidence(Object.assign({}, request.body || {}, scope));
      response.status(result.idempotent ? 200 : 201).json({ ok: true, evidence: result.evidence, event: result.event, idempotent: result.idempotent });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/evidences", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.listEvidences(Object.assign({}, request.query || {}, requestScope(request, context)));
      response.json({ ok: true, evidences: result.evidences, page: result.page });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/timeline", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.listTimeline(Object.assign({}, request.query || {}, requestScope(request, context)));
      response.json({ ok: true, events: result.events, page: result.page });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });


  router.post("/pending-items", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const scope = requestScope(request, context);
      const result = await service.createPendingItem(Object.assign({}, request.body || {}, scope));
      response.status(result.idempotent ? 200 : 201).json({ ok: true, pending_item: result.pending_item, event: result.event, idempotent: result.idempotent });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/pending-items", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.listPendingItems(Object.assign({}, request.query || {}, requestScope(request, context)));
      response.json({ ok: true, pending_items: result.pending_items, page: result.page });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/pending-items/:id", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.getPendingItem(request.params.id, Object.assign({}, request.query || {}, requestScope(request, context)));
      response.json({ ok: true, pending_item: result.pending_item, events: result.events });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.put("/pending-items/:id", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.updatePendingItem(request.params.id, Object.assign({}, request.body || {}, requestScope(request, context)));
      response.json({ ok: true, pending_item: result.pending_item, events: result.events });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.post("/pending-items/:id/evidences", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.linkEvidenceToPendingItem(request.params.id, Object.assign({}, request.body || {}, requestScope(request, context)));
      response.status(result.idempotent ? 200 : 201).json({ ok: true, link: result.link, event: result.event, idempotent: result.idempotent });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.post("/pending-items/:id/validate", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const result = await service.validatePendingItem(request.params.id, Object.assign({}, request.body || {}, requestScope(request, context)));
      response.json({ ok: true, pending_item: result.pending_item, event: result.event });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });
  return router;
}

export function createEloOperationalTimelineRouter(options = {}) {
  const env = options.env || process.env;
  const router = express.Router();
  const store = options.store || createEloSentinelStore({ client: options.database || null });
  const service = options.service || createEloSentinelService({ store });
  const resolveAuthContext = options.resolveAuthContext || (async () => ({ ok: false, status: 401, error: "authentication_required" }));

  router.get("/:projectId/timeline", async (request, response) => {
    try {
      if (!isOperationalTimelineEnabled(env)) {
        response.status(503).json({ ok: false, error: "elo_operational_timeline_disabled" });
        return;
      }
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const scope = contextScope(context, Object.assign({}, request.query || {}, { project_id: request.params.projectId }));
      if (clean(request.query.project_id || request.query.projectId, 140) && clean(request.query.project_id || request.query.projectId, 140) !== scope.project_id) {
        response.status(404).json({ ok: false, error: "project_not_found" });
        return;
      }
      const filters = Object.assign({}, request.query || {}, scope);
      if (!clean(request.query.created_by || request.query.createdBy, 140)) delete filters.created_by;
      const result = await service.listOperationalTimeline(filters);
      response.json({ ok: true, events: result.events, page: result.page });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  return router;
}

export function registerEloSentinelRoutes(app, options = {}) {
  app.use("/api/elo/sentinel", createEloSentinelRouter(options));
  app.use("/api/elo/projects", createEloOperationalTimelineRouter(options));
}