(function (root) {
  "use strict";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function queryValue(path, name) {
    const query = String(path || "").split("?")[1] || "";
    for (const part of query.split("&")) {
      const index = part.indexOf("=");
      if (index < 0) continue;
      let key = part.slice(0, index);
      let value = part.slice(index + 1);
      try {
        key = decodeURIComponent(key.replace(/\+/g, " "));
        value = decodeURIComponent(value.replace(/\+/g, " "));
      } catch (_) {
        return "";
      }
      if (key === name) return value;
    }
    return "";
  }

  function notifyDiagnostic(settings, path, requestOptions, response, data) {
    if (typeof settings.onDiagnostic !== "function") return;

    const input = requestOptions || {};
    const method = clean(input.method || "GET").toUpperCase();
    const endpoint = String(path || "").split("?")[0];
    const status = Number(response && response.status) || 0;
    const payload = data && typeof data === "object" ? data : {};
    const rdo = payload.rdo && typeof payload.rdo === "object" ? payload.rdo : {};
    let event = null;

    if (method === "POST" && endpoint === "/api/obrareport/rdos") {
      event = {
        kind: "create",
        httpStatus: status,
        rdoId: clean(rdo.id),
        projectId: clean(rdo.project_id || rdo.projectId),
        institutionId: clean(rdo.institution_id || rdo.institutionId)
      };
    } else if (method === "GET" && /^\/api\/obrareport\/rdos\/[^/]+$/.test(endpoint)) {
      event = {
        kind: "get_by_id",
        httpStatus: status,
        found: Boolean(rdo.id),
        rdoProjectId: clean(rdo.project_id || rdo.projectId),
        rdoInstitutionId: clean(rdo.institution_id || rdo.institutionId)
      };
    } else if (method === "GET" && endpoint === "/api/obrareport/rdos") {
      const rows = Array.isArray(payload.rdos) ? payload.rdos : [];
      const requestProjectId = queryValue(path, "projectId") || queryValue(path, "project_id");
      let trackedId = "";
      try {
        trackedId = typeof settings.getTrackedRdoId === "function" ? clean(settings.getTrackedRdoId()) : "";
      } catch (_) {
        trackedId = "";
      }
      event = {
        kind: requestProjectId ? "list" : "list_all",
        httpStatus: status,
        requestProjectId,
        count: rows.length,
        containsTrackedRdo: Boolean(trackedId && rows.some(function (row) {
          return clean(row && row.id) === trackedId;
        }))
      };
    }

    if (!event) return;
    try {
      settings.onDiagnostic(event);
    } catch (_) {
      // Diagnostics must never change the result of an RDO API request.
    }
  }

  function createRdoCloudAdapter(options) {
    const settings = options || {};
    const baseUrl = clean(settings.baseUrl || root.OBRAREPORT_API_BASE_URL).replace(/\/+$/g, "");
    const fetchImpl = settings.fetchImpl || root.fetch;
    const getToken = settings.getToken;

    if (!baseUrl) throw new Error("rdo_api_base_url_required");
    if (typeof fetchImpl !== "function") throw new Error("rdo_fetch_unavailable");
    if (typeof getToken !== "function") throw new Error("rdo_token_provider_required");

    async function request(path, requestOptions, responseType) {
      const token = clean(await getToken());
      if (!token) throw Object.assign(new Error("rdo_canonical_session_required"), { code: "RDO_CANONICAL_SESSION_REQUIRED" });

      const input = requestOptions || {};
      const headers = Object.assign({
        Accept: responseType === "blob" ? "application/pdf" : "application/json"
      }, input.headers || {}, { Authorization: "Bearer " + token });
      if (input.body !== undefined && !headers["Content-Type"]) headers["Content-Type"] = "application/json";

      const response = await fetchImpl(baseUrl + path, Object.assign({}, input, { headers: headers }));
      if (responseType === "blob" && response.ok) return response.blob();

      let data = {};
      try {
        data = await response.json();
      } catch (_) {
        data = {};
      }
      notifyDiagnostic(settings, path, input, response, data);
      if (!response.ok || data.ok === false) {
        const error = new Error(clean(data.error || data.code) || "rdo_api_request_failed");
        error.status = response.status;
        error.code = clean(data.error || data.code);
        throw error;
      }
      return data;
    }

    function mapStockWork(work) {
      const project = work || {};
      const canonicalWorkId = clean(project.id);
      return {
        id: canonicalWorkId,
        projectId: canonicalWorkId,
        workId: canonicalWorkId,
        canonicalWorkId: canonicalWorkId,
        institutionId: clean(project.institutionId || project.institution_id),
        clientId: clean(project.clientId || project.client_id),
        name: clean(project.name),
        address: clean(project.address),
        status: "Stock Full",
        canonicalStockWork: true
      };
    }

    function mapRdoToDailyLog(rdo, userId) {
      const row = rdo || {};
      const data = row.rdo_data_json && typeof row.rdo_data_json === "object" ? clone(row.rdo_data_json) : {};
      const projectId = clean(row.project_id || row.projectId || data.projectId || data.project_id);
      return Object.assign({}, data, {
        id: clean(row.id),
        userId: clean(userId || data.userId || row.created_by),
        workId: projectId,
        canonicalProjectId: projectId,
        date: clean(row.rdo_date || row.rdoDate || data.date),
        createdAt: row.created_at || data.createdAt || data.created_at || "",
        updatedAt: row.updated_at || data.updatedAt || data.updated_at || "",
        canonicalRdo: true
      });
    }

    function toApiPayload(logItem, work, idempotencyKey) {
      const item = clone(logItem);
      const canonicalWork = work || {};
      const projectId = clean(canonicalWork.id || canonicalWork.canonicalWorkId || item.workId);
      if (!projectId) throw new Error("rdo_canonical_project_id_required");
      item.workId = projectId;
      item.projectId = projectId;
      item.operationId = clean(item.operationId || idempotencyKey || item.id);
      return {
        projectId: projectId,
        clientId: clean(canonicalWork.clientId || canonicalWork.client_id) || null,
        title: clean(item.summary || item.services || item.title) || "RDO",
        rdoDate: clean(item.date || item.rdoDate || item.rdo_date) || null,
        status: "draft",
        idempotencyKey: clean(idempotencyKey || item.operationId || item.id),
        rdoData: item
      };
    }

    return {
      listStockWorks: async function () {
        const result = await request("/api/stock-full/works", { method: "GET" });
        return (Array.isArray(result.works) ? result.works : []).map(mapStockWork).filter(function (work) {
          return Boolean(work.id);
        });
      },
      listRdosByWork: async function (projectId) {
        const id = clean(projectId);
        if (!id) throw new Error("rdo_project_id_required");
        const result = await request("/api/obrareport/rdos?projectId=" + encodeURIComponent(id), { method: "GET" });
        return Array.isArray(result.rdos) ? result.rdos : [];
      },
      listRdosUnfiltered: async function () {
        const result = await request("/api/obrareport/rdos", { method: "GET" });
        return Array.isArray(result.rdos) ? result.rdos : [];
      },
      getRdo: async function (id) {
        const result = await request("/api/obrareport/rdos/" + encodeURIComponent(clean(id)), { method: "GET" });
        return result.rdo || null;
      },
      createRdo: async function (logItem, work, idempotencyKey) {
        const result = await request("/api/obrareport/rdos", {
          method: "POST",
          body: JSON.stringify(toApiPayload(logItem, work, idempotencyKey))
        });
        return result.rdo || null;
      },
      updateRdo: async function (id, logItem, work) {
        const result = await request("/api/obrareport/rdos/" + encodeURIComponent(clean(id)), {
          method: "PUT",
          body: JSON.stringify(toApiPayload(logItem, work, logItem && logItem.operationId))
        });
        return result.rdo || null;
      },
      generateDocument: async function (id, projectId, idempotencyKey) {
        const result = await request("/api/obrareport/rdos/" + encodeURIComponent(clean(id)) + "/generate-document", {
          method: "POST",
          body: JSON.stringify({ workId: clean(projectId), idempotencyKey: clean(idempotencyKey) })
        });
        return result;
      },
      fetchDocumentPdf: async function (documentId) {
        return request("/api/obrareport/documents/" + encodeURIComponent(clean(documentId)) + "/content", { method: "GET" }, "blob");
      },
      mapStockWork: mapStockWork,
      mapRdoToDailyLog: mapRdoToDailyLog,
      toApiPayload: toApiPayload
    };
  }

  root.ObraReportRdoCloudAdapter = { create: createRdoCloudAdapter };
})(typeof window !== "undefined" ? window : globalThis);
