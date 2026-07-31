import express from "express";
import { createMunicipalNotificationService, createSupabaseMunicipalNotificationStore, toMunicipalNotificationHttpError } from "./municipal-notification-service.js";

function clean(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
function sendError(response, err) { const safe = toMunicipalNotificationHttpError(err); response.status(safe.status).json({ ok: false, error: safe.error }); }

export function createMunicipalNotificationRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) throw Object.assign(new Error("municipal_notification_database_not_configured"), { status: 503, code: "municipal_notification_database_not_configured" });
    service = createMunicipalNotificationService({ database, store: options.store || createSupabaseMunicipalNotificationStore(database), env: options.env, sentinelService: options.sentinelService });
    return service;
  }

  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") throw Object.assign(new Error("municipal_notification_auth_not_configured"), { status: 503, code: "municipal_notification_auth_not_configured" });
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

  router.get("/notifications", route((request, context, svc) => svc.listNotifications(context, request.query || {})));
  router.get("/notifications/unread-count", route((request, context, svc) => svc.unreadCount(context, request.query || {})));
  router.post("/notifications/:id/read", route((request, context, svc) => svc.markRead(context, request.params.id)));
  router.post("/notifications/:id/cancel", route((request, context, svc) => svc.cancel(context, request.params.id)));
  router.post("/notifications/dispatch", route((request, context, svc) => svc.dispatch(context, request.body || {})));

  return router;
}

export function registerMunicipalNotificationRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalNotificationRouter(options));
}
