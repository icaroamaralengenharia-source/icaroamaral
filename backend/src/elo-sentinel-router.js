import express from "express";
import { createEloSentinelService } from "./elo-sentinel-service.js";
import { createEloSentinelStore } from "./elo-sentinel-store.js";

function clean(value, max = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function isEnabled(env = {}) {
  return clean(env.ELO_SENTINEL_ENABLED).toLowerCase() === "true";
}

function safeStatus(error, fallback = 500) {
  const status = Number(error && (error.status || error.statusCode)) || fallback;
  if (status < 400 || status > 599) return fallback;
  return status;
}

function safeErrorCode(error, fallback = "elo_sentinel_request_failed") {
  return clean(error && (error.code || error.message), 160) || fallback;
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
      response.status(201).json({ ok: true, evidence: result.evidence, event: result.event });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/evidences", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const items = await service.listEvidences(requestScope(request, context));
      response.json({ ok: true, evidences: items });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  router.get("/timeline", async (request, response) => {
    try {
      const context = await requireAuth(request, response, resolveAuthContext);
      if (!context) return;
      const items = await service.listTimeline(requestScope(request, context));
      response.json({ ok: true, events: items });
    } catch (error) {
      response.status(safeStatus(error, 500)).json({ ok: false, error: safeErrorCode(error) });
    }
  });

  return router;
}

export function registerEloSentinelRoutes(app, options = {}) {
  app.use("/api/elo/sentinel", createEloSentinelRouter(options));
}
