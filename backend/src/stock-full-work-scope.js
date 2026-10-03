function clean(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
}

export const STOCK_FULL_WORK_REQUIRED = "WORK_REQUIRED";
export const STOCK_FULL_WORK_NOT_ALLOWED = "WORK_NOT_ALLOWED";

export function getStockFullProjectId(source = {}) {
  const request = source || {};
  const query = request.query || {};
  const body = request.body || {};
  const headers = request.headers || {};
  return clean(
    body.projectId
      || body.project_id
      || body.workId
      || body.work_id
      || query.projectId
      || query.project_id
      || query.workId
      || query.work_id
      || headers["x-project-id"]
      || headers["x-work-id"]
  );
}

export function getStockFullProjectIdFromValue(value) {
  return clean(value && (value.projectId || value.project_id || value.workId || value.work_id));
}

export function isStockFullWorkScopeMatch(value, projectId) {
  const requested = clean(projectId);
  const candidate = getStockFullProjectIdFromValue(value);
  return Boolean(requested && candidate && requested === candidate);
}

export function mapStockFullWork(project) {
  const source = project || {};
  return {
    id: clean(source.id),
    projectId: clean(source.id),
    workId: clean(source.id),
    institutionId: clean(source.institution_id),
    clientId: clean(source.client_id),
    name: clean(source.name),
    address: clean(source.address)
  };
}

export function workRequiredResult() {
  return { ok: false, status: 400, error: STOCK_FULL_WORK_REQUIRED };
}

export function workNotAllowedResult() {
  return { ok: false, status: 403, error: STOCK_FULL_WORK_NOT_ALLOWED };
}
