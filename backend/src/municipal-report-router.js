import express from "express";
import { createMunicipalReportService, createSupabaseMunicipalReportStore, toMunicipalReportHttpError } from "./municipal-report-service.js";
import { createMunicipalReportArchiveService } from "./municipal-report-archive-service.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function sendError(response, err) {
  const safe = toMunicipalReportHttpError(err);
  response.status(safe.status).json({ ok: false, error: safe.error });
}

export function createMunicipalReportRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  let archiveService = options.archiveService || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) throw Object.assign(new Error("municipal_report_database_not_configured"), { status: 503, code: "municipal_report_database_not_configured" });
    service = createMunicipalReportService({ database, store: options.store || createSupabaseMunicipalReportStore(database) });
    return service;
  }

  function getArchiveService() {
    if (archiveService) return archiveService;
    if (!database && !options.store) throw Object.assign(new Error("municipal_report_database_not_configured"), { status: 503, code: "municipal_report_database_not_configured" });
    archiveService = createMunicipalReportArchiveService({ database, store: options.store || createSupabaseMunicipalReportStore(database) });
    return archiveService;
  }

  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") throw Object.assign(new Error("municipal_report_auth_not_configured"), { status: 503, code: "municipal_report_auth_not_configured" });
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

  router.get("/reports/types", route((request, context, svc) => svc.listTypes(context)));
  router.post("/reports/preview", route((request, context, svc) => svc.preview(context, request.body || {})));
  router.post("/reports/generate", route((request, context, svc) => svc.generate(context, request.body || {})));
  router.post("/reports/archive", route((request, context) => getArchiveService().archive(context, request.body || {})));

  return router;
}

export function registerMunicipalReportRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalReportRouter(options));
}
