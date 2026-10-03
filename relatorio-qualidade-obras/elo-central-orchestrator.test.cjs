const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function storage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function load() {
  const localStorage = storage();
  const window = { localStorage };
  const context = { window, globalThis: window, console, Date, Math, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'elo-central-orchestrator.js'), 'utf8'), context, { filename: 'elo-central-orchestrator.js' });
  return { api: window.EloCentralOrchestratorFactory({ storage: storage(), now: () => 1728000000000, random: () => 0.123456, shadow: true }), window };
}

test('orchestrator exposes version and registry without legacy route duplication', () => {
  const { api } = load();
  assert.match(api.version, /^20261003-vnext/);
  const tools = api.listTools();
  assert.ok(tools.some((tool) => tool.id === 'fast.math'));
  assert.ok(tools.some((tool) => tool.id === 'context.document'));
  assert.ok(tools.every((tool) => !/stock/i.test(tool.id)));
});

test('generic follow-up resolves the active work/document context', async () => {
  const { api } = load();
  api.setActiveWork({ id: 'work-1', name: 'Obra teste' });
  api.setActiveDocument({ id: 'doc-1', title: 'Relatório de vistoria', textLength: 1200 });
  await api.orchestrate('analise este documento');
  const next = await api.orchestrate('e depois?');
  assert.equal(next.plan.intent, 'follow_up');
  assert.equal(next.plan.references.document.id, 'doc-1');
  assert.equal(next.state.activeWork.name, 'Obra teste');
});

test('document context survives deterministic fast path planning', async () => {
  const { api } = load();
  api.setActiveDocument({ id: 'doc-2', title: 'Memorial', textLength: 3000 });
  await api.orchestrate('resuma este documento');
  const plan = api.plan('2 x 3');
  assert.equal(plan.intent, 'math');
  assert.equal(plan.context.activeDocument.id, 'doc-2');
});

test('explicit memory has precedence over generic engineering signals', async () => {
  const { api } = load();
  const result = await api.orchestrate('memorize que a parede usa bloco estrutural');
  assert.equal(result.plan.intent, 'memory_write');
  assert.ok(result.state.memory.explicit.some((item) => /bloco estrutural/i.test(item.value)));
});

test('tool failures become safe verified responses and leave a trace', async () => {
  const { api } = load();
  api.registerTool({ id: 'test.failing', priority: 1000, matches: (plan) => plan.normalized === 'falhar ferramenta' ? 100 : 0, run: () => { throw new Error('internal_only'); } });
  const result = await api.orchestrate('falhar ferramenta');
  assert.equal(result.result.safeFallback, true);
  assert.equal(result.result.verified, true);
  assert.ok(api.getTrace().some((event) => event.event === 'tool_execution_failed'));
});

test('verifier redacts secret-shaped output and records warning', () => {
  const { api } = load();
  const result = api.verify({ text: 'token=abc123 e resposta segura' });
  assert.doesNotMatch(result.text, /abc123/);
  assert.ok(result.warnings.includes('sensitive_output_redacted'));
});
