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

function loadWithStorage(sharedStorage) {
  const window = { localStorage: sharedStorage };
  const context = { window, globalThis: window, console, Date, Math, setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'elo-central-orchestrator.js'), 'utf8'), context, { filename: 'elo-central-orchestrator.js' });
  return window.EloCentralOrchestratorFactory({ storage: sharedStorage, now: () => 1728000000000, random: () => 0.123456, mode: 'primary' });
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

test('document routing wins over painting/engineering for fifty generic follow-ups', () => {
  const { api } = load();
  api.setActiveDocument({ id: 'doc-50', type: 'pdf', title: 'Vistoria', documents: [{ fileName: 'vistoria.pdf', type: 'pdf' }] });
  const variants = [
    'resuma os principais problemas encontrados', 'quais os problemas encontrados?', 'qual o mais grave?',
    'e o mais grave?', 'resuma este documento', 'o que o PDF mostra?', 'liste os achados',
    'extraia os pontos críticos', 'quais riscos aparecem?', 'o que foi encontrado no arquivo?'
  ];
  for (let index = 0; index < 50; index += 1) {
    const plan = api.plan(variants[index % variants.length]);
    assert.equal(plan.intent, 'document_context', variants[index % variants.length]);
    assert.equal(plan.tool.id, 'context.document');
  }
});

test('deterministic math remains math while document context is active', () => {
  const { api } = load();
  api.setActiveDocument({ id: 'doc-math', type: 'pdf', title: 'Memorial' });
  assert.equal(api.plan('15% de 500').intent, 'math');
  assert.equal(api.plan('120m2 x 5cm').intent, 'math');
  assert.equal(api.plan('amanhã').intent, 'date_time');
});

test('explicit media intent does not hijack an engineering follow-up', () => {
  const { api } = load();
  assert.equal(api.plan('toque música clássica').intent, 'media');
  assert.equal(api.plan('qual a próxima ação para essa fissura?').intent, 'engineering');
});

test('phase two intent map separates report, work, budget and writing requests', () => {
  const { api } = load();
  assert.equal(api.plan('gere um relatório com base nessa análise').intent, 'report_context');
  assert.equal(api.plan('qual é a obra ativa?').intent, 'work_context');
  assert.equal(api.plan('preciso de um orçamento SINAPI').intent, 'budget');
  assert.equal(api.plan('redija uma mensagem para o cliente').intent, 'writing');
  assert.equal(api.plan('mostre uma foto de uma fachada').intent, 'visual_media');
  assert.equal(api.plan('pause a música').intent, 'media');
  assert.equal(api.plan('me ajude a organizar o próximo passo').intent, 'conversation');
});

test('explicit memory survives a new orchestrator instance using the same storage', async () => {
  const shared = storage();
  const first = loadWithStorage(shared);
  await first.orchestrate('memorize que usamos bloco estrutural');
  const second = loadWithStorage(shared);
  const result = await second.orchestrate('qual bloco eu disse que usamos?');
  assert.equal(result.plan.intent, 'memory_recall');
  assert.match(result.result.text, /bloco estrutural/i);
});

test('primary mode is explicit and verifier removes duplicate lines', () => {
  const { api } = load();
  api.configure({ mode: 'primary', enabled: true });
  assert.equal(api.isPrimary(), true);
  const result = api.verify({ text: 'Resposta\nPróxima ação:\nFaça isso.\nPróxima ação:\nFaça isso.' });
  assert.ok(result.warnings.includes('duplicate_content_removed'));
  assert.equal((result.text.match(/Próxima ação:/g) || []).length, 1);
});

test('long documents are chunked and retrieved by relevant section without whole-document replay', () => {
  const { api } = load();
  const pages = Array.from({ length: 150 }, (_, index) => {
    const marker = index === 89 ? 'MARCADOR-CANARIO-PAGINA-90' : index === 149 ? 'MARCADOR-FINAL-DOCUMENTO' : 'conteudo tecnico da pagina ' + (index + 1);
    return 'Página ' + (index + 1) + '. ' + marker + '. ' + 'detalhe '.repeat(180);
  }).join('\n');
  api.setActiveDocument({ id: 'doc-long-150', type: 'pdf', title: 'Laudo longo', text: pages });
  const index = api.getDocumentIndex('doc-long-150');
  assert.ok(index.chunkCount > 100);
  assert.ok(index.characters > 100000);
  const result = api.retrieveDocument('MARCADOR-CANARIO-PAGINA-90', { documentId: 'doc-long-150', limit: 2 });
  assert.equal(result.found, true);
  assert.match(result.chunks[0].text, /MARCADOR-CANARIO-PAGINA-90/);
});

test('document index survives a new orchestrator instance and keeps late-page retrieval', () => {
  const shared = storage();
  const first = loadWithStorage(shared);
  first.setActiveDocument({ id: 'doc-reload', type: 'pdf', title: 'Documento persistente', text: 'início '.repeat(5000) + ' MARCADOR-ULTIMA-PAGINA ' + 'fim '.repeat(5000) });
  first.setActiveDocument({ id: 'doc-reload', type: 'pdf', title: 'Documento persistente', documents: [{ fileName: 'documento.pdf', type: 'pdf' }] });
  const second = loadWithStorage(shared);
  assert.ok(second.getDocumentIndex('doc-reload').chunkCount > 1);
  const result = second.retrieveDocument('MARCADOR-ULTIMA-PAGINA', { documentId: 'doc-reload' });
  assert.match(result.chunks[0].text, /MARCADOR-ULTIMA-PAGINA/);
});

test('document route exposes retrieved context for the primary verifier', async () => {
  const api = loadWithStorage(storage());
  api.setActiveDocument({ id: 'doc-context', type: 'pdf', title: 'Contexto', text: 'achado crítico: fissura vertical na fachada' });
  const result = await api.orchestrate('liste os achados deste documento');
  assert.equal(result.plan.intent, 'document_context');
  assert.equal(result.result.documentContext.found, true);
  assert.match(result.result.documentContext.chunks[0].text, /fissura vertical/i);
});

test('shadow comparison and promotion gate expose a reversible rollout signal', async () => {
  const { api } = load();
  const shadow = api.observe('15% de 500');
  const envelope = await api.orchestrate('15% de 500');
  const comparison = api.compareShadow(envelope, shadow);
  assert.equal(comparison.intentMatch, true);
  api.recordEvent('central_primary_completed', { intent: 'math' });
  const gate = api.promotionGate();
  assert.equal(gate.counts.comparisons, 1);
  assert.equal(gate.counts.primaryCompleted, 1);
  assert.equal(gate.readyForPromotion, true);
});

test('canary mode is deterministic and respects the configured percentage', () => {
  const { api } = load();
  api.configure({ mode: 'canary', canaryPercent: 0 });
  assert.equal(api.shouldUsePrimary('teste'), false);
  api.configure({ canaryPercent: 100 });
  assert.equal(api.shouldUsePrimary('teste'), true);
  assert.equal(api.isPrimary(), false);
});
