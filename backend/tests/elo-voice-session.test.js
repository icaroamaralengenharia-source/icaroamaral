import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../../relatorio-qualidade-obras/elo-voice-session.js', import.meta.url), 'utf8');
function harness(overrides = {}) {
  let now = 0, sequence = 0;
  const timers = new Map(), recognizers = [], submissions = [], states = [];
  const sandbox = { AbortController, setTimeout, clearTimeout };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox);
  const session = sandbox.EloVoiceSession.create({
    now: () => now,
    setTimeout: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, at: now + ms }); return id; },
    clearTimeout: id => timers.delete(id),
    createRecognition: () => {
      const recognizer = {
        running: false, aborted: 0,
        start() { this.running = true; this.onstart?.(); },
        stop() { this.running = false; this.onend?.(); },
        abort() { this.running = false; this.aborted += 1; },
        result(text, isFinal = true) {
          const item = [{ transcript: text }]; item.isFinal = isFinal;
          this.onresult?.({ resultIndex: 0, results: [item] });
        }
      };
      recognizers.push(recognizer);
      return recognizer;
    },
    submit: (text, scope) => submissions.push({ text, scope }),
    onState: state => states.push(state),
    ...overrides
  });
  const tick = ms => {
    const target = now + ms;
    for (let guard = 0; guard < 100; guard += 1) {
      const due = [...timers].filter(([, task]) => task.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) { now = target; return; }
      timers.delete(due[0]); now = due[1].at; due[1].fn();
    }
    throw new Error('Voice retry loop did not terminate');
  };
  return { session, recognizers, submissions, states, tick, timers };
}

test('capture starts only after explicit activation and submits a final turn once', () => {
  const h = harness();
  assert.equal(h.recognizers.length, 0);
  assert.equal(h.session.getState().state, 'INATIVO');
  h.session.start();
  const recognizer = h.recognizers[0], late = recognizer.onresult;
  recognizer.result('Quero continuar esta conversa.', false);
  assert.equal(h.submissions.length, 0);
  recognizer.result('Quero continuar esta conversa.');
  late({ resultIndex: 0, results: [[{ transcript: 'duplicata obsoleta' }]] });
  assert.equal(h.submissions.length, 1);
  assert.equal(h.submissions[0].text, 'Quero continuar esta conversa.');
  assert.equal(h.session.getState().state, 'PROCESSANDO');
  assert.equal(h.session.getState().microphoneActive, false);
});

test('two voice turns reuse the session and capture stays off throughout playback', () => {
  const h = harness(); h.session.start();
  for (let turn = 0; turn < 2; turn += 1) {
    h.recognizers[turn].result('Turno ' + turn);
    const scope = h.submissions[turn].scope;
    h.tick(500);
    assert.equal(h.session.playbackStarted(scope), true);
    assert.equal(h.session.getState().responseReadyLatencyMs, 500);
    assert.equal(h.recognizers.filter(rec => rec.running).length, 0);
    assert.equal(h.recognizers.length, turn + 1);
    h.session.playbackEnded(scope);
    h.tick(250);
    assert.equal(scope.isCurrent(), false);
    assert.equal(h.session.getState().state, 'OUVINDO');
  }
  h.session.end();
  assert.equal(h.recognizers.filter(rec => rec.running).length, 0);
  assert.equal(h.timers.size, 0);
});

test('button interruption aborts the request and rejects all obsolete playback callbacks', () => {
  const h = harness(); h.session.start(); h.recognizers[0].result('Primeiro turno');
  const old = h.submissions[0].scope;
  assert.equal(h.session.interrupt(), true);
  assert.equal(old.signal.aborted, true);
  assert.equal(h.session.playbackStarted(old), false);
  h.tick(250);
  h.recognizers[1].result('Correção do usuário');
  const current = h.submissions[1].scope;
  assert.equal(h.session.playbackEnded(old), false);
  assert.equal(h.session.getState().turnId, current.id);
  assert.equal(h.session.playbackStarted(current), true);
  h.session.interrupt(); h.tick(250);
  assert.equal(h.session.getState().state, 'OUVINDO');
});

test('ending during microphone permission activation aborts even before onstart', () => {
  let aborted = false, recognition;
  const h = harness({ createRecognition: () => (recognition = { start() {}, stop() {}, abort() { aborted = true; } }) });
  h.session.start();
  const staleStart = recognition.onstart;
  h.session.end(); staleStart(); h.tick(30000);
  assert.equal(aborted, true);
  assert.equal(h.session.getState().state, 'ENCERRADO');
  assert.equal(h.session.getState().microphoneActive, false);
  assert.equal(h.submissions.length, 0);
});

test('background pause releases capture and needs an explicit foreground resume', () => {
  const h = harness(); h.session.start(); h.session.pause('APP_HIDDEN'); h.tick(30000);
  assert.equal(h.recognizers.length, 1);
  assert.equal(h.recognizers[0].running, false);
  assert.equal(h.session.getState().state, 'PAUSADO');
  h.session.resume();
  assert.equal(h.recognizers.length, 2);
  assert.equal(h.session.getState().state, 'OUVINDO');
});

test('permission denial and missing capture capability do not schedule retries', () => {
  const h = harness(); h.session.start(); h.recognizers[0].onerror({ error: 'not-allowed' }); h.tick(30000);
  assert.equal(h.session.getState().state, 'SEM_PERMISSAO');
  assert.equal(h.session.getState().active, false);
  assert.equal(h.recognizers.length, 1);
  const unsupported = harness({ createRecognition: () => null }); unsupported.session.start();
  assert.equal(unsupported.session.getState().reason, 'UNSUPPORTED_CAPTURE');
  assert.equal(unsupported.session.getState().microphoneActive, false);
});

test('network failures back off and pause after a bounded number of attempts', () => {
  const h = harness(); h.session.start();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    h.recognizers[attempt].onerror({ error: 'network' });
    if (attempt < 3) { assert.equal(h.session.getState().state, 'RECONECTANDO'); h.tick(500 * 2 ** (attempt + 1)); }
  }
  assert.equal(h.session.getState().reason, 'NETWORK_RETRY_LIMIT');
  assert.equal(h.recognizers.length, 4);
  assert.equal(h.timers.size, 0);
});

test('silence is never submitted and repeated empty capture pauses safely', () => {
  const h = harness(); h.session.start();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    h.recognizers[attempt].onend(); if (attempt < 2) h.tick(700);
  }
  assert.equal(h.submissions.length, 0);
  assert.equal(h.session.getState().reason, 'SILENCE_LIMIT');
});

test('a recognizer that does not release capture cannot trigger TTS or a turn', () => {
  const h = harness(); h.session.start(); h.recognizers[0].stop = () => {};
  h.recognizers[0].result('Final reconhecido, captura travada'); h.tick(2000);
  assert.equal(h.submissions.length, 0);
  assert.equal(h.session.getState().reason, 'CAPTURE_DID_NOT_STOP');
  assert.equal(h.recognizers[0].running, false);
});

test('explicit spoken end releases capture without sending a chat message', () => {
  const h = harness(); h.session.start(); h.recognizers[0].result('ELO, encerrar conversa por voz');
  assert.equal(h.submissions.length, 0);
  assert.equal(h.session.getState().state, 'ENCERRADO');
  assert.equal(h.session.getState().reason, 'SPOKEN_END');
});

test('turn timeout cancels the request and does not restart capture implicitly', () => {
  const h = harness(); h.session.start(); h.recognizers[0].result('Turno sem resposta');
  const scope = h.submissions[0].scope; h.tick(60000);
  assert.equal(scope.signal.aborted, true);
  assert.equal(h.session.getState().reason, 'TURN_TIMEOUT');
  assert.equal(h.recognizers.length, 1);
});

test('pending draft blocks activation and another audio source pauses the session', () => {
  const draft = harness({ canStart: () => 'DRAFT_OR_SESSION_NOT_READY' }); draft.session.start();
  assert.equal(draft.recognizers.length, 0);
  let audioBusy = false;
  const h = harness({ canListen: () => !audioBusy }); h.session.start(); h.recognizers[0].result('Resposta textual');
  audioBusy = true; h.session.textReady(h.submissions[0].scope); h.tick(250);
  assert.equal(h.session.getState().state, 'PAUSADO');
  assert.equal(h.recognizers.length, 1);
  let draftReady = true;
  const partial = harness({ canStart: () => draftReady || 'DRAFT_OR_SESSION_NOT_READY' });
  partial.session.start(); partial.session.pause(); draftReady = false;
  assert.equal(partial.session.resume(), false);
  assert.equal(partial.recognizers.length, 1);
  const blockedAudio = harness({ prepareAudio: () => { throw new Error('native audio unavailable'); } });
  assert.equal(blockedAudio.session.start(), false);
  assert.equal(blockedAudio.session.getState().reason, 'AUDIO_FOCUS_UNAVAILABLE');
  assert.equal(blockedAudio.recognizers.length, 0);
});

test('cancelled and overlapping readonly operations always restore remote persistence', async () => {
  const assistant = readFileSync(new URL('../../relatorio-qualidade-obras/elo-assistente.js', import.meta.url), 'utf8');
  const start = assistant.indexOf('  function runEloWithoutRemotePersistence_(');
  assert.ok(start >= 0);
  const end = assistant.indexOf('\n  function ', start + 1);
  const context = { ELO_UI: { suppressRemotePersistence: false }, Promise, Set };
  vm.runInNewContext(assistant.slice(start, end) + '\nglobalThis.run = runEloWithoutRemotePersistence_;', context);
  let finishFirst, finishSecond;
  const first = new Promise(resolve => { finishFirst = resolve; });
  const second = new Promise(resolve => { finishSecond = resolve; });
  const controller = new AbortController();
  const firstWork = context.run(() => first, { signal: controller.signal, isCurrent: () => !controller.signal.aborted });
  await Promise.resolve();
  assert.equal(context.ELO_UI.suppressRemotePersistence, true);
  controller.abort();
  assert.equal(context.ELO_UI.suppressRemotePersistence, false);
  const secondWork = context.run(() => second, null);
  finishFirst(); await firstWork;
  assert.equal(context.ELO_UI.suppressRemotePersistence, true, 'late cleanup must not release a newer operation');
  finishSecond(); await secondWork;
  assert.equal(context.ELO_UI.suppressRemotePersistence, false);
  const completed = { isCurrent: () => true };
  await context.run(() => { completed.isCurrent = () => false; return 'local text result'; }, completed);
  assert.equal(context.ELO_UI.suppressRemotePersistence, false, 'completion must clean up even after its voice turn becomes obsolete');
  await assert.rejects(context.run(() => { throw new Error('tool failed'); }, null), /tool failed/);
  assert.equal(context.ELO_UI.suppressRemotePersistence, false);
  context.ELO_UI.suppressRemotePersistence = true;
  await context.run(() => 'nested existing scope', null);
  assert.equal(context.ELO_UI.suppressRemotePersistence, true, 'an existing outer scope must be preserved');
});
