import express from "express";
import { createMunicipalAdminService, createSupabaseMunicipalAdminStore, toMunicipalAdminHttpError } from "./municipal-admin-service.js";
import { createMunicipalOperationalShelfService } from "./municipal-operational-shelf-service.js";
import { createMunicipalProfileService } from "./municipal-profile-service.js";
import { createMunicipalProfileDiffService } from "./municipal-profile-diff-service.js";
import { createMunicipalProfileReviewService } from "./municipal-profile-review-service.js";

function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

function bearer(request) {
  const match = clean(request && request.headers && request.headers.authorization).match(/^Bearer\s+(.+)$/i);
  return match && match[1] ? clean(match[1]) : "";
}

async function authUserFromRequest(request, database) {
  if (!database || !database.auth || typeof database.auth.getUser !== "function") {
    const error = new Error("municipal_admin_auth_not_configured");
    error.status = 503;
    error.code = "municipal_admin_auth_not_configured";
    throw error;
  }
  const token = bearer(request);
  if (!token) {
    const error = new Error("authentication_required");
    error.status = 401;
    error.code = "authentication_required";
    throw error;
  }
  const { data, error } = await database.auth.getUser(token);
  const user = data && data.user;
  if (error || !user || !clean(user.id)) {
    const err = new Error("invalid_session");
    err.status = 401;
    err.code = "invalid_session";
    throw err;
  }
  return user;
}

function sendError(response, err) {
  const safe = toMunicipalAdminHttpError(err);
  response.status(safe.status).json({ ok: false, error: safe.error });
}

export function createMunicipalAdminRouter(options = {}) {
  const router = express.Router();
  const database = options.database || null;
  let service = options.service || null;
  let operationalShelfService = options.operationalShelfService || null;
  let municipalProfileDiffService = options.municipalProfileDiffService || null;
  let municipalProfileService = options.municipalProfileService || null;
  let municipalProfileReviewService = options.municipalProfileReviewService || null;
  const resolveAuthContext = options.resolveAuthContext;

  function getService() {
    if (service) return service;
    if (!database && !options.store) {
      const error = new Error("municipal_admin_database_not_configured");
      error.status = 503;
      error.code = "municipal_admin_database_not_configured";
      throw error;
    }
    service = createMunicipalAdminService({ database, store: options.store });
    return service;
  }

  function getOperationalShelfService() {
    if (operationalShelfService) return operationalShelfService;
    const shelfStore = options.operationalShelfStore || options.store || createSupabaseMunicipalAdminStore(database);
    operationalShelfService = createMunicipalOperationalShelfService({ store: shelfStore });
    return operationalShelfService;
  }
  function getMunicipalProfileReviewService() {
    if (municipalProfileReviewService) return municipalProfileReviewService;
    const reviewStore = options.municipalProfileReviewStore || options.store || createSupabaseMunicipalAdminStore(database);
    municipalProfileReviewService = createMunicipalProfileReviewService({ store: reviewStore });
    return municipalProfileReviewService;
  }

  function getMunicipalProfileDiffService() {
    if (municipalProfileDiffService) return municipalProfileDiffService;
    const diffStore = options.municipalProfileDiffStore || options.store || createSupabaseMunicipalAdminStore(database);
    municipalProfileDiffService = createMunicipalProfileDiffService({ store: diffStore });
    return municipalProfileDiffService;
  }

  function getMunicipalProfileService() {
    if (municipalProfileService) return municipalProfileService;
    const profileStore = options.municipalProfileStore || options.store || createSupabaseMunicipalAdminStore(database);
    municipalProfileService = createMunicipalProfileService({ store: profileStore });
    return municipalProfileService;
  }
  async function requireContext(request) {
    if (typeof resolveAuthContext !== "function") {
      const error = new Error("municipal_admin_auth_not_configured");
      error.status = 503;
      error.code = "municipal_admin_auth_not_configured";
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

  router.post("/institutions", route((request, context, svc) => svc.createInstitution(context, request.body || {})));
  router.get("/institutions", route((request, context, svc) => svc.listInstitutions(context)));
  router.get("/institutions/:institutionId", route((request, context, svc) => svc.getInstitution(context, request.params.institutionId)));
  router.patch("/institutions/:institutionId", route((request, context, svc) => svc.updateInstitution(context, request.params.institutionId, request.body || {})));
  router.post("/institutions/:institutionId/deactivate", route((request, context, svc) => svc.deactivateInstitution(context, request.params.institutionId)));

  router.post("/institutions/:institutionId/units", route((request, context, svc) => svc.createUnit(context, request.params.institutionId, request.body || {})));
  router.get("/institutions/:institutionId/units", route((request, context, svc) => svc.listUnits(context, request.params.institutionId)));
  router.patch("/units/:unitId", route((request, context, svc) => svc.updateUnit(context, request.params.unitId, request.body || {})));
  router.post("/units/:unitId/deactivate", route((request, context, svc) => svc.deactivateUnit(context, request.params.unitId)));
  router.get("/units/:unitId/operational-dashboard", route((request, context) => getOperationalShelfService().getOperationalDashboard(context, request.params.unitId)));

  router.post("/institutions/:institutionId/invites", route((request, context, svc) => svc.createInvite(context, request.params.institutionId, request.body || {})));
  router.post("/invites/:inviteId/cancel", route((request, context, svc) => svc.cancelInvite(context, request.params.inviteId)));
  router.get("/institutions/:institutionId/users", route((request, context, svc) => svc.listUsers(context, request.params.institutionId)));
  router.patch("/users/:userId/role", route((request, context, svc) => svc.updateUserRole(context, request.params.userId, request.body || {})));
  router.patch("/users/:userId/units", route((request, context, svc) => svc.updateUserUnits(context, request.params.userId, request.body || {})));
  router.post("/users/:userId/deactivate", route((request, context, svc) => svc.deactivateUser(context, request.params.userId)));
  router.get("/me", route((request, context, svc) => svc.me(context)));
  router.get("/municipal-profiles/:profileId/diff", route((request, context) => getMunicipalProfileDiffService().getMunicipalProfileVersionDiff(context, request.params.profileId, request.query || {})));
  router.put("/municipal-profiles/:profileId/activate", route((request, context) => getMunicipalProfileService().activateControlledMunicipalProfileVersion(context, request.params.profileId, request.body || {})));
  router.get("/municipal-profile-imports/:importId", route((request, context) => getMunicipalProfileReviewService().getMunicipalProfileImport(context, request.params.importId)));
  router.put("/municipal-profile-imports/:importId/review", route((request, context) => getMunicipalProfileReviewService().saveMunicipalImportReview(context, request.params.importId, request.body || {})));

  router.post("/invites/:token/accept", async (request, response) => {
    try {
      const user = options.authUserFromRequest
        ? await options.authUserFromRequest(request)
        : await authUserFromRequest(request, database);
      const result = await getService().acceptInvite(request.params.token, user);
      response.json(Object.assign({ ok: true }, result));
    } catch (err) {
      sendError(response, err);
    }
  });

  return router;
}

export function registerMunicipalAdminRoutes(app, options = {}) {
  app.use("/api/municipal-admin", createMunicipalAdminRouter(options));
}

