const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
// The site package is ESM; exercise the browser module's CommonJS export directly.
const sourcePath = path.join(__dirname, "rdo-project-workspace.js");
const moduleExport = { exports: {} };
const browserRoot = {};
vm.runInThisContext("(function (module, window) {\n" + fs.readFileSync(sourcePath, "utf8") + "\n})", { filename: sourcePath })(moduleExport, browserRoot);
const { create } = moduleExport.exports;

test("browser global and CommonJS entry expose the same controller", () => {
  assert.equal(browserRoot.ObraReportProjectWorkspace.create, create);
  assert.equal(typeof create, "function");
});

const preferenceKey = "obrareport-active-project-v1";
const projectA = { id: "project-a", name: "Synthetic A", canonicalStockWork: true };
const projectB = { id: "project-b", name: "Synthetic B", canonicalStockWork: true };
const recordA = { id: "rdo-a", project_id: projectA.id, rdo_date: "2026-10-14", rdo_data_json: { generalNotes: "synthetic A" } };
const recordB = { id: "rdo-b", projectId: projectB.id, rdoDate: "2026-10-15" };

function memoryStorage(initial) {
  const values = new Map(Object.entries(initial || {}));
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key)
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(options = {}) {
  let userId = "user-a";
  const storage = options.storage || memoryStorage();
  const adapter = {
    listStockWorks: async () => [projectA, projectB],
    listRdosByWork: async (id) => id === projectA.id ? [recordA] : [recordB],
    ...options.adapter
  };
  const workspace = create({ adapter, storage, getUserId: () => userId });
  return { workspace, storage, adapter, setUser: (id) => { userId = id; } };
}

test("canonical project load does not select the first project or trust blank IDs", async () => {
  const { workspace } = setup({ adapter: {
    listStockWorks: async () => [null, {}, { id: " " }, { id: 42 }, projectA, { ...projectA, name: "duplicate" }, projectB]
  } });
  assert.deepEqual(await workspace.loadProjects(), [projectA, projectB]);
  assert.equal(workspace.getActiveId(), "");
  assert.equal(workspace.getActiveWork(), null);
  assert.equal(workspace.getSummary(projectA.id), null);
  assert.deepEqual(await workspace.loadHistory(), []);
});

test("a selected project persists only its ID and user, and reload revalidates against the API", async () => {
  const storage = memoryStorage();
  const first = setup({ storage }).workspace;
  await first.loadProjects();
  first.selectProject(projectB.id);
  assert.deepEqual(JSON.parse(storage.getItem(preferenceKey)), { userId: "user-a", projectId: projectB.id });
  const second = setup({ storage }).workspace;
  assert.equal(second.getActiveId(), "");
  await second.loadProjects();
  assert.deepEqual(second.getActiveWork(), projectB);
  assert.deepEqual(second.getRecords(), []);
});

test("revoked saved projects clear the context without choosing another project", async () => {
  const storage = memoryStorage({ [preferenceKey]: JSON.stringify({ userId: "user-a", projectId: projectA.id }) });
  const { workspace } = setup({ storage, adapter: { listStockWorks: async () => [projectB] } });
  await workspace.loadProjects();
  assert.equal(workspace.getActiveId(), "");
  assert.equal(storage.getItem(preferenceKey), null);
  assert.throws(() => workspace.selectProject(projectA.id), /not_in_stock_scope/);
});

test("preferences belonging to another user cannot activate a project", async () => {
  const storage = memoryStorage({ [preferenceKey]: JSON.stringify({ userId: "other-user", projectId: projectA.id }) });
  const { workspace } = setup({ storage });
  await workspace.loadProjects();
  assert.equal(workspace.getActiveId(), "");
  workspace.clear();
  assert.equal(JSON.parse(storage.getItem(preferenceKey)).userId, "other-user");
});

test("selectProject rejects unknown IDs, increments context, and clears records on each selection", async () => {
  const { workspace } = setup();
  await workspace.loadProjects();
  assert.throws(() => workspace.selectProject("not-authorized"), /not_in_stock_scope/);
  workspace.selectProject(projectA.id);
  const previous = workspace.context();
  await workspace.loadHistory();
  workspace.selectProject(projectB.id);
  assert.equal(workspace.isCurrent(previous), false);
  assert.ok(workspace.context().revision > previous.revision);
  assert.deepEqual(workspace.getRecords(), []);
  workspace.selectProject("");
  assert.equal(workspace.getActiveId(), "");
});

test("history filters exact project scope and exposes unmodified backend records and summaries", async () => {
  const extra = { id: "rdo-a-2", workId: projectA.id, date: "2026-10-16", additional: { preserved: true } };
  const { workspace } = setup({ adapter: { listRdosByWork: async () => [recordA, recordB, extra, { project_id: projectA.id }] } });
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  assert.deepEqual(await workspace.loadHistory(), [recordA, extra]);
  assert.deepEqual(workspace.getSummary(projectA.id), { count: 2, lastDate: "2026-10-16" });
  assert.equal(workspace.getSummary(projectB.id), null);
  workspace.selectProject(projectB.id);
  assert.deepEqual(workspace.getRecords(), []);
  assert.deepEqual(workspace.getSummary(projectA.id), { count: 2, lastDate: "2026-10-16" });
});

test("an empty successful history differs from a never loaded summary", async () => {
  const { workspace } = setup({ adapter: { listRdosByWork: async () => [] } });
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  assert.equal(workspace.getSummary(projectA.id), null);
  await workspace.loadHistory();
  assert.deepEqual(workspace.getSummary(projectA.id), { count: 0, lastDate: "" });
});

for (const failure of [false, true]) {
  test(`obsolete history ${failure ? "failure" : "success"} cannot overwrite the next project's result`, async () => {
    const old = deferred();
    const { workspace } = setup({ adapter: { listRdosByWork: (id) => id === projectA.id ? old.promise : Promise.resolve([recordB]) } });
    await workspace.loadProjects();
    workspace.selectProject(projectA.id);
    const pending = workspace.loadHistory();
    workspace.selectProject(projectB.id);
    await workspace.loadHistory();
    if (failure) old.reject(new Error("old request failed"));
    else old.resolve([recordA]);
    assert.deepEqual(await pending, [recordB]);
    assert.deepEqual(workspace.getRecords(), [recordB]);
    assert.equal(workspace.getSummary(projectA.id), null);
  });
}

test("the latest of two same-project history requests wins", async () => {
  const first = deferred();
  let calls = 0;
  const newRecord = { ...recordA, rdo_date: "2026-10-20" };
  const { workspace } = setup({ adapter: { listRdosByWork: () => ++calls === 1 ? first.promise : Promise.resolve([newRecord]) } });
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  const pending = workspace.loadHistory();
  await workspace.loadHistory();
  first.resolve([recordA]);
  assert.deepEqual(await pending, [newRecord]);
});

test("current history errors reject and clear records without removing the authorized project", async () => {
  const { workspace, adapter } = setup();
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  await workspace.loadHistory();
  adapter.listRdosByWork = async () => { throw new Error("service failed"); };
  await assert.rejects(workspace.loadHistory(), /service failed/);
  assert.deepEqual(workspace.getRecords(), []);
  assert.equal(workspace.getSummary(projectA.id), null);
  assert.equal(workspace.getActiveId(), projectA.id);
});

test("current project load errors clear the entire authorized context and reject", async () => {
  const { workspace, adapter } = setup();
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  await workspace.loadHistory();
  const prior = workspace.context();
  adapter.listStockWorks = async () => { throw new Error("projects unavailable"); };
  await assert.rejects(workspace.loadProjects(), /projects unavailable/);
  assert.deepEqual(workspace.getWorks(), []);
  assert.deepEqual(workspace.getRecords(), []);
  assert.equal(workspace.getActiveId(), "");
  assert.equal(workspace.isCurrent(prior), false);
});

for (const failure of [false, true]) {
  test(`obsolete project list ${failure ? "error" : "success"} cannot replace a more recent load`, async () => {
    const first = deferred();
    let calls = 0;
    const { workspace } = setup({ adapter: { listStockWorks: () => ++calls === 1 ? first.promise : Promise.resolve([projectB]) } });
    const pending = workspace.loadProjects();
    await workspace.loadProjects();
    workspace.selectProject(projectB.id);
    if (failure) first.reject(new Error("obsolete projects error"));
    else first.resolve([projectA]);
    assert.deepEqual(await pending, [projectB]);
    assert.equal(workspace.getActiveId(), projectB.id);
  });
}

test("a user change invalidates getters and in-flight project and history responses", async () => {
  const projects = deferred();
  const history = deferred();
  const { workspace, adapter, setUser } = setup();
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  adapter.listRdosByWork = () => history.promise;
  const oldHistory = workspace.loadHistory();
  adapter.listStockWorks = () => projects.promise;
  const oldProjects = workspace.loadProjects();
  setUser("user-b");
  assert.deepEqual(workspace.getWorks(), []);
  projects.resolve([projectA]);
  history.resolve([recordA]);
  assert.deepEqual(await oldProjects, []);
  assert.deepEqual(await oldHistory, []);
  assert.equal(workspace.getActiveId(), "");
  assert.equal(workspace.context().userId, "user-b");
});

test("upsert requires the captured active context and exact project and keeps the same record ID", async () => {
  const { workspace } = setup();
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  await workspace.loadHistory();
  const prior = workspace.context();
  const edited = { ...recordA, rdo_data_json: { generalNotes: "updated synthetic A" } };
  assert.equal(workspace.upsertRecord(edited, prior), true);
  assert.deepEqual(workspace.getRecords(), [edited]);
  assert.equal(workspace.getSummary(projectA.id).count, 1);
  assert.equal(workspace.upsertRecord(recordB, prior), false);
  workspace.selectProject(projectB.id);
  assert.equal(workspace.upsertRecord(edited, prior), false);
  assert.deepEqual(workspace.getRecords(), []);
});

test("clear removes only own project preference and invalidates pending responses without touching auth", async () => {
  const storage = memoryStorage({ auth: "synthetic-session-sentinel" });
  const { workspace, adapter } = setup({ storage });
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  const pending = deferred();
  adapter.listRdosByWork = () => pending.promise;
  const old = workspace.loadHistory();
  const prior = workspace.context();
  workspace.clear();
  pending.resolve([recordA]);
  assert.deepEqual(await old, []);
  assert.equal(workspace.isCurrent(prior), false);
  assert.equal(storage.getItem(preferenceKey), null);
  assert.equal(storage.getItem("auth"), "synthetic-session-sentinel");
  assert.deepEqual(workspace.getWorks(), []);
});

test("a history response started before a saved record cannot overwrite that record", async () => {
  const other = { ...recordA, id: "rdo-a-other" };
  const { workspace, adapter } = setup({ adapter: { listRdosByWork: async () => [recordA, other] } });
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  await workspace.loadHistory();
  const pending = deferred();
  adapter.listRdosByWork = () => pending.promise;
  const old = workspace.loadHistory();
  const edited = { ...recordA, rdo_data_json: { generalNotes: "saved after history started" } };
  assert.equal(workspace.upsertRecord(edited, workspace.context()), true);
  pending.resolve([recordA]);
  assert.deepEqual(await old, [edited, other]);
  assert.equal(workspace.getSummary(projectA.id).count, 2);
});

test("missing identity and malformed API responses cannot establish a project scope", async () => {
  const { workspace, adapter, setUser } = setup();
  setUser("");
  await assert.rejects(workspace.loadProjects(), /user_required/);
  setUser("user-a");
  adapter.listStockWorks = async () => ({ works: [projectA] });
  await assert.rejects(workspace.loadProjects(), /projects_response_invalid/);
  assert.deepEqual(workspace.getWorks(), []);
  adapter.listStockWorks = async () => [projectA];
  await workspace.loadProjects();
  workspace.selectProject(projectA.id);
  adapter.listRdosByWork = async () => ({ rdos: [recordA] });
  await assert.rejects(workspace.loadHistory(), /history_response_invalid/);
});

test("storage failure cannot grant access, and returned objects cannot mutate internal scope", async () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } };
  const { workspace } = setup({ storage });
  const list = await workspace.loadProjects();
  list[0].id = "outside-scope";
  assert.throws(() => workspace.selectProject("outside-scope"), /not_in_stock_scope/);
  workspace.selectProject(projectA.id);
  const active = workspace.getActiveWork();
  active.id = "outside-scope";
  const records = await workspace.loadHistory();
  records[0].rdo_data_json.generalNotes = "changed externally";
  assert.deepEqual(workspace.getRecords(), [recordA]);
  assert.equal(workspace.getActiveId(), projectA.id);
});

test("the controller does not log local values or request errors", async () => {
  const originals = { log: console.log, info: console.info, warn: console.warn, error: console.error };
  const calls = [];
  try {
    for (const name of Object.keys(originals)) console[name] = (...args) => calls.push(args);
    const { workspace, adapter } = setup();
    await workspace.loadProjects();
    workspace.selectProject(projectA.id);
    await workspace.loadHistory();
    adapter.listRdosByWork = async () => { throw new Error("synthetic-secret-sentinel"); };
    await assert.rejects(workspace.loadHistory());
    workspace.clear();
    assert.deepEqual(calls, []);
  } finally {
    Object.assign(console, originals);
  }
});
