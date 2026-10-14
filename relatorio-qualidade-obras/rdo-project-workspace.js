(function (root) {
  "use strict";

  const STORAGE_KEY = "obrareport-active-project-v1";

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function copy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function projectIdOf(record) {
    return clean(record && (record.project_id || record.projectId || record.workId));
  }

  function create(options) {
    const settings = options || {};
    const adapter = settings.adapter;
    const storage = settings.storage;
    const getUserId = settings.getUserId;
    if (!adapter || typeof adapter.listStockWorks !== "function" || typeof adapter.listRdosByWork !== "function") {
      throw new Error("rdo_workspace_adapter_required");
    }
    if (typeof getUserId !== "function") throw new Error("rdo_workspace_user_provider_required");

    let userId = clean(getUserId());
    let works = [];
    let activeId = "";
    let records = [];
    let summaries = new Map();
    let revision = 0;
    let projectsGeneration = 0;
    let historyGeneration = 0;

    function invalidate() {
      revision += 1;
      projectsGeneration += 1;
      historyGeneration += 1;
      works = [];
      activeId = "";
      records = [];
      summaries = new Map();
    }

    function ensureUser() {
      const currentId = clean(getUserId());
      if (currentId !== userId) {
        invalidate();
        userId = currentId;
      }
      return userId;
    }

    function readPreference() {
      try {
        const value = JSON.parse(storage && storage.getItem(STORAGE_KEY) || "null");
        return value && clean(value.userId) === userId ? clean(value.projectId) : "";
      } catch (_) {
        return "";
      }
    }

    function savePreference(id) {
      if (!userId || !storage) return;
      try {
        if (id) {
          storage.setItem(STORAGE_KEY, JSON.stringify({ userId: userId, projectId: id }));
        } else if (readPreference()) {
          storage.removeItem(STORAGE_KEY);
        }
      } catch (_) {
        // Storage is only a preference; its availability cannot grant access.
      }
    }

    function context() {
      ensureUser();
      return { projectId: activeId, revision: revision, userId: userId };
    }

    function isCurrent(value) {
      ensureUser();
      return Boolean(value && value.projectId === activeId && value.revision === revision && value.userId === userId);
    }

    function getWorks() {
      ensureUser();
      return copy(works);
    }

    function getActiveId() {
      ensureUser();
      return activeId;
    }

    function getActiveWork() {
      ensureUser();
      const work = works.find(function (item) { return item.id === activeId; });
      return work ? copy(work) : null;
    }

    function getRecords() {
      ensureUser();
      return copy(records);
    }

    function getSummary(id) {
      ensureUser();
      const summary = summaries.get(clean(id));
      return summary ? copy(summary) : null;
    }

    function summarize(id) {
      const dates = records.map(function (row) {
        return clean(row.rdo_date || row.rdoDate || row.date || (row.rdo_data_json && row.rdo_data_json.date));
      }).filter(Boolean).sort();
      summaries.set(id, { count: records.length, lastDate: dates.length ? dates[dates.length - 1] : "" });
    }

    function selectProject(id) {
      ensureUser();
      const nextId = clean(id);
      if (nextId && !works.some(function (work) { return work.id === nextId; })) {
        throw new Error("rdo_project_not_in_stock_scope");
      }
      revision += 1;
      historyGeneration += 1;
      activeId = nextId;
      records = [];
      savePreference(nextId);
      return getActiveWork();
    }

    async function loadProjects() {
      ensureUser();
      const preferredId = activeId || readPreference();
      invalidate();
      const generation = projectsGeneration;
      const requestContext = context();
      if (!userId) throw new Error("rdo_workspace_user_required");
      try {
        const result = await adapter.listStockWorks();
        if (generation !== projectsGeneration || !isCurrent(requestContext)) return getWorks();
        if (!Array.isArray(result)) throw new Error("rdo_projects_response_invalid");
        const ids = new Set();
        works = result.filter(function (work) {
          const id = clean(work && work.id);
          if (!id || ids.has(id)) return false;
          ids.add(id);
          return true;
        }).map(function (work) {
          return Object.assign(copy(work), { id: clean(work.id) });
        });
        activeId = works.some(function (work) { return work.id === preferredId; }) ? preferredId : "";
        revision += 1;
        savePreference(activeId);
        return getWorks();
      } catch (error) {
        if (generation !== projectsGeneration || !isCurrent(requestContext)) return getWorks();
        invalidate();
        throw error;
      }
    }

    async function loadHistory() {
      ensureUser();
      const requestContext = context();
      const generation = ++historyGeneration;
      if (!requestContext.projectId) return [];
      try {
        const result = await adapter.listRdosByWork(requestContext.projectId);
        if (generation !== historyGeneration || !isCurrent(requestContext)) return getRecords();
        if (!Array.isArray(result)) throw new Error("rdo_history_response_invalid");
        records = result.filter(function (row) {
          return clean(row && row.id) && projectIdOf(row) === activeId;
        }).map(copy);
        summarize(activeId);
        return getRecords();
      } catch (error) {
        if (generation !== historyGeneration || !isCurrent(requestContext)) return getRecords();
        records = [];
        summaries.delete(activeId);
        throw error;
      }
    }

    function upsertRecord(raw, requestContext) {
      if (!isCurrent(requestContext) || !activeId || projectIdOf(raw) !== activeId || !clean(raw && raw.id)) return false;
      historyGeneration += 1;
      const record = copy(raw);
      const index = records.findIndex(function (item) { return item.id === record.id; });
      if (index >= 0) records[index] = record;
      else records.unshift(record);
      if (summaries.has(activeId)) summarize(activeId);
      return true;
    }

    function clear() {
      ensureUser();
      savePreference("");
      invalidate();
    }

    return {
      loadProjects: loadProjects,
      getWorks: getWorks,
      getActiveWork: getActiveWork,
      getActiveId: getActiveId,
      selectProject: selectProject,
      getRecords: getRecords,
      loadHistory: loadHistory,
      getSummary: getSummary,
      context: context,
      isCurrent: isCurrent,
      upsertRecord: upsertRecord,
      clear: clear
    };
  }

  const api = { create: create };
  if (typeof module === "object" && module.exports) module.exports = api;
  root.ObraReportProjectWorkspace = api;
})(typeof window !== "undefined" ? window : globalThis);
