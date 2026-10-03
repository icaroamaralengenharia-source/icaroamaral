const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'elo.html'), 'utf8');
const assistant = fs.readFileSync(path.join(root, 'relatorio-qualidade-obras', 'elo-assistente.js'), 'utf8');

test('web surface loads the central orchestrator before the assistant', () => {
  const orchestratorPosition = html.indexOf('elo-central-orchestrator.js');
  const assistantPosition = html.indexOf('elo-assistente.js');
  assert.ok(orchestratorPosition >= 0);
  assert.ok(assistantPosition > orchestratorPosition);
});

test('assistant sends a sanitized shadow plan with active context metadata', () => {
  assert.match(assistant, /function observeEloCentralOrchestrator_\(question, attachments, source\)/);
  assert.match(assistant, /orchestrator\.setActiveDocument/);
  assert.match(assistant, /orchestrator\.setActiveWork/);
  assert.match(assistant, /orchestrator\.observe\(question/);
});

test('central orchestrator has no Stock Full tool registration', () => {
  const source = fs.readFileSync(path.join(root, 'relatorio-qualidade-obras', 'elo-central-orchestrator.js'), 'utf8');
  assert.doesNotMatch(source, /registerTool\(\{\s*id:\s*["'](?:stock|stock-full)/i);
});
