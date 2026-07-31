import express from "express";
import { createMunicipalSentinelService, createSupabaseMunicipalSentinelStore, toMunicipalSentinelHttpError } from "./municipal-sentinel-service.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function sendError(response, err) {
  const safe = toMunicipalSentinelHttpError(err);
  response.status(safe.status).json({ ok: false, error: safe.error });
}

export function createMunicipalSentinelRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) throw Object.assign(new Error("municipal_sentinel_database_not_configured"), { status: 503, code: "municipal_sentinel_database_not_configured" });
    service = createMunicipalSentinelService({ database, store: options.store || createSupabaseMunicipalSentinelStore(database) });
    return service;
  }

  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") throw Object.assign(new Error("municipal_sentinel_auth_not_configured"), { status: 503, code: "municipal_sentinel_auth_not_configured" });
    const context = await resolveAuthContext(request);
    if (!context || !context.ok) throw Object.assign(new Error(clean(context && context.error) || "authentication_required"), { status: context && context.status || 401, code: clean(context && context.error) || "authentication_required" });
    return context;
  }

  function route(handler) {
    return async (request, response) => {
      try {
        const context = await requireContext(request);
        const result = await handler(request, context, getService());
        response.json(Object.assign({ ok: true }, result || {}));
      } catch (err) {
        sendError(response, err);
      }
    };
  }

  router.get("/sentinel/alerts", route((request, context, svc) => svc.listAlerts(context, request.query || {})));
  router.get("/sentinel/alerts/:alertId", route((request, context, svc) => svc.getAlert(context, request.params.alertId, request.query || {})));
  router.post("/sentinel/scan", route((request, context, svc) => svc.scan(context, request.body || {})));
  router.post("/sentinel/alerts/:alertId/acknowledge", route((request, context, svc) => svc.acknowledge(context, request.params.alertId, request.body || {})));
  router.post("/sentinel/alerts/:alertId/resolve", route((request, context, svc) => svc.resolve(context, request.params.alertId, request.body || {})));

  return router;
}

export function registerMunicipalSentinelRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalSentinelRouter(options));
}
