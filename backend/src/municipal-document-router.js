import express from "express";
import { createMunicipalDocumentService, createSupabaseMunicipalDocumentStore, toMunicipalDocumentHttpError } from "./municipal-document-service.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function sendError(response, err) {
  const safe = toMunicipalDocumentHttpError(err);
  response.status(safe.status).json({ ok: false, error: safe.error });
}

export function createMunicipalDocumentRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) {
      const error = new Error("municipal_document_database_not_configured");
      error.status = 503;
      error.code = "municipal_document_database_not_configured";
      throw error;
    }
    const store = options.store || createSupabaseMunicipalDocumentStore(database);
    service = createMunicipalDocumentService({ database, store });
    return service;
  }

  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") {
      const error = new Error("municipal_document_auth_not_configured");
      error.status = 503;
      error.code = "municipal_document_auth_not_configured";
      throw error;
    }
    const context = await resolveAuthContext(request);
    if (!context || !context.ok) {
      const error = new Error(clean(context && context.error) || "authentication_required");
      error.status = context && context.status ? context.status : 401;
      error.code = clean(context && context.error) || "authentication_required";
      throw error;
    }
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

  router.post("/documents", route((request, context, svc) => svc.createDocument(context, request.body || {})));
  router.get("/documents", route((request, context, svc) => svc.listDocuments(context, request.query || {})));
  router.get("/documents/:documentId", route((request, context, svc) => svc.getDocument(context, request.params.documentId)));
  router.post("/documents/:documentId/versions", route((request, context, svc) => svc.createVersion(context, request.params.documentId, request.body || {})));
  router.get("/documents/:documentId/download", route((request, context, svc) => svc.downloadDocument(context, request.params.documentId)));
  router.post("/documents/:documentId/archive", route((request, context, svc) => svc.archiveDocument(context, request.params.documentId)));

  return router;
}

export function registerMunicipalDocumentRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalDocumentRouter(options));
}
