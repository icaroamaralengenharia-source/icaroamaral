import express from "express";
import { createMunicipalAssetService, createSupabaseMunicipalAssetStore, toMunicipalAssetHttpError } from "./municipal-asset-service.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function sendError(response, err) {
  const safe = toMunicipalAssetHttpError(err);
  response.status(safe.status).json({ ok: false, error: safe.error });
}

export function createMunicipalAssetRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) throw Object.assign(new Error("municipal_asset_database_not_configured"), { status: 503, code: "municipal_asset_database_not_configured" });
    service = createMunicipalAssetService({ database, store: options.store || createSupabaseMunicipalAssetStore(database) });
    return service;
  }

  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") throw Object.assign(new Error("municipal_asset_auth_not_configured"), { status: 503, code: "municipal_asset_auth_not_configured" });
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

  router.post("/assets", route((request, context, svc) => svc.createAsset(context, request.body || {})));
  router.get("/assets", route((request, context, svc) => svc.listAssets(context, request.query || {})));
  router.get("/assets/:assetId", route((request, context, svc) => svc.getAsset(context, request.params.assetId)));
  router.patch("/assets/:assetId", route((request, context, svc) => svc.updateAsset(context, request.params.assetId, request.body || {})));
  router.post("/assets/:assetId/transfer", route((request, context, svc) => svc.transferAsset(context, request.params.assetId, request.body || {})));
  router.post("/assets/:assetId/maintenance", route((request, context, svc) => svc.registerMaintenance(context, request.params.assetId, request.body || {})));
  router.post("/assets/:assetId/deactivate", route((request, context, svc) => svc.deactivateAsset(context, request.params.assetId, request.body || {})));
  router.get("/assets/:assetId/history", route((request, context, svc) => svc.getAssetHistory(context, request.params.assetId)));

  return router;
}

export function registerMunicipalAssetRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalAssetRouter(options));
}
