import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import test from 'node:test';
import { JSDOM } from 'jsdom';

const native = new URL('../../android-native-wake-20261014/', import.meta.url);
const adapter = readFileSync(new URL('app/src/main/assets/elo-native-brain.js', native), 'utf8');
const web = readFileSync(new URL('../../relatorio-qualidade-obras/elo-assistente.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const tick = () => new Promise(resolve => setImmediate(resolve));
function harness(t, options = {}) {
  const dom = new JSDOM('<body class="elo-authenticated"><div class="elo-messages"></div><div class="elo-input-row"><textarea class="elo-input"></textarea><button class="elo-mic-button"></button></div><button class="elo-speech-button" data-elo-speech-text="Mensagem existente"></button></body>', {
    url: options.url || 'https://www.icaroamaral.com.br/elo.html', runScripts: 'outside-only', pretendToBeVisual: true
  });
  t.after(() => dom.window.close());
  const w = dom.window, sent = [], writes = [], calls = [];
  let click, conversation = 'conv_qa';
  const original = w.document.addEventListener.bind(w.document);
  w.document.addEventListener = (name, callback, ...rest) => { if (name === 'click') click = callback; return original(name, callback, ...rest); };
  w.EloAssistente = {
    exportNativeVoiceContext: async () => { calls.push('context'); return { accessToken: 'test-only', identity: { userId: 'user_qa' }, conversationId: conversation }; },
    getCurrentConversationIdForTest: () => conversation,
    getValidAccessTokenForTest: async () => 'test-only',
    getCoreIdentityForTest: () => ({ userId: 'user_qa' }),
    replayCoreMessagesForTest: messages => { writes.push(messages); w.document.querySelector('.elo-input').value = 'changed-by-replay'; },
    endVoiceSessionForTest: () => calls.push('end-web'),
    stopVoiceInputForTest: () => calls.push('stop-web-mic'),
    stopSpeechOutputForTest: () => calls.push('stop-web-tts'),
    setVoiceModeEnabledForTest: () => {},
    speakTextForTest: () => calls.push('web-tts')
  };
  w.fetch = options.fetch || (async () => ({ ok: true, json: async () => ({ conversation: { id: conversation }, messages: [] }) }));
  const port = {
    start() {}, close() {},
    postMessage(raw) {
      assert.equal(typeof raw, 'string'); const message = JSON.parse(raw); sent.push(message);
      if (options.autoReply !== false) queueMicrotask(() => port.onmessage?.({ data: JSON.stringify({ type: 'RESULT', id: message.id, ok: true, code: 'READY' }) }));
    }
  };
  w.eval(adapter);
  return { w, sent, calls, writes, port,
    connect(nonce = 'ELO_NATIVE_CHANNEL_TOKEN_V1') { w.dispatchEvent(new w.MessageEvent('message', { data: 'elo-native-brain-channel-v1:' + nonce, ports: [port] })); },
    state(data) { port.onmessage({ data: JSON.stringify({ type: 'STATE', data: { turn: 0, ...data } }) }); },
    click(selector, trusted = true) { const event = { target: w.document.querySelector(selector), isTrusted: trusted, preventDefault() {}, stopImmediatePropagation() {} }; click(event); },
    changeConversation(value) { conversation = value; }
  };
}
test('adapter refuses another origin or path', t => {
  for (const url of ['https://example.com/elo.html', 'https://www.icaroamaral.com.br/outro.html']) {
    const h = harness(t, { url }); assert.equal(h.w.EloNativeBrain, undefined);
  }
});
function sendMusic(h, text = 'Toque uma faixa') {
  h.connect();h.state({state:'PROCESSING',enabled:true,owner:'NONE',generation:2,turn:1});
  h.port.onmessage({data:JSON.stringify({type:'MUSIC_REQUEST',request:{id:'music-qa',text,generation:2,turn:1}})});
}
const musicResult = h => h.sent.find(x=>x.type==='MUSIC_RESULT')?.payload.result;
test('native music requires actual advancing playback rather than resolver success', async t => {
  const h=harness(t);let position=0;
  h.w.EloAssistente.handleMusicQueryForTest=async()=>({handled:true,decision:'AUTO_EXACT',candidate:{title:'Faixa',artist:'Artista'}});
  h.w.EloMediaPlayer={getPlaybackStatus:()=>({state:'PLAYING',mediaId:'qa',position:position+=0.5})};
  sendMusic(h);await new Promise(r=>setTimeout(r,600));
  assert.equal(musicResult(h)?.played,true);assert.equal(musicResult(h)?.positionAdvanced,true);
  assert.equal(h.calls.includes('web-tts'),false);
});
test('resolver failure cannot produce a playing claim',async t=>{
  const h=harness(t);h.w.EloAssistente.handleMusicQueryForTest=async()=>({handled:true,decision:'NO_HANDLER'});
  sendMusic(h);await tick();assert.equal(musicResult(h).played,false);assert.doesNotMatch(musicResult(h).answer,/^Tocando/i);
});

test('advancing playback completes handoff before a slow resolver callback',async t=>{
  const h=harness(t);let finish,position=0,current;
  h.w.EloAssistente.handleMusicQueryForTest=(_q,options)=>{current=options.isCurrent;return new Promise(r=>finish=r)};
  h.w.EloMediaPlayer={getPlaybackStatus:()=>({state:'PLAYING',mediaId:'existing-player',position:position+=0.5}),getCurrentMedia:()=>({title:'Faixa atual'})};
  sendMusic(h);await new Promise(r=>setTimeout(r,600));
  assert.equal(musicResult(h)?.played,true);assert.equal(musicResult(h)?.positionAdvanced,true);
  h.state({state:'WAKE_LISTENING',enabled:true,owner:'WAKE',generation:3,turn:1});
  assert.equal(current(),true);finish({handled:true,decision:'AUTO_EXACT'});await tick();
  assert.equal(h.sent.filter(x=>x.type==='MUSIC_RESULT').length,1);
});

test('conversation actions have accessible icons, immediate busy state and duplicate guard',async t=>{
  const h=harness(t,{autoReply:false});h.connect();h.state({state:'SUSPENDED',enabled:true,owner:'NONE'});
  const group=h.w.document.querySelector('.elo-native-conversation-actions');
  assert.equal(group.hidden,false);assert.equal(group.getAttribute('role'),'group');
  const resume=group.querySelector('.elo-native-resume-wake');
  assert.equal(resume.getAttribute('aria-label'),'Retomar chamado');
  assert.equal(resume.querySelector('svg').getAttribute('aria-hidden'),'true');
  h.click('.elo-native-resume-wake');h.click('.elo-native-resume-wake');
  assert.equal(resume.getAttribute('aria-busy'),'true');assert.equal(resume.disabled,true);
  assert.equal(h.sent.filter(x=>x.type==='RESUME_WAKE').length,1);
  const message=h.sent.find(x=>x.type==='RESUME_WAKE');
  h.port.onmessage({data:JSON.stringify({type:'RESULT',id:message.id,ok:true})});await tick();
  assert.equal(resume.disabled,false);assert.equal(resume.getAttribute('aria-busy'),'false');
});
test('ambiguous music asks short confirmation without dispatching another player',async t=>{
  const h=harness(t);h.w.EloAssistente.handleMusicQueryForTest=async()=>({handled:true,decision:'ASK_CONFIRMATION',candidate:{title:'Faixa',artist:'Artista'}});
  sendMusic(h);await tick();assert.equal(musicResult(h).pending,true);assert.equal(musicResult(h).answer,'Você quis dizer Faixa — Artista?');
});
test('late music resolution is invalidated on interruption',async t=>{
  const h=harness(t);let finish,current;
  h.w.EloAssistente.handleMusicQueryForTest=(_q,options)=>{current=options.isCurrent;return new Promise(r=>finish=r)};
  sendMusic(h);assert.equal(current(),true);
  h.state({state:'BRAIN_LISTENING',enabled:true,owner:'BRAIN',generation:3,turn:1});
  assert.equal(current(),false);finish({handled:true,decision:'AUTO_EXACT'});await tick();assert.equal(musicResult(h),undefined);
});
test('microphone preparing label never prematurely says listening',async t=>{
  const h=harness(t);h.connect();h.state({state:'BRAIN_LISTENING',enabled:true,owner:'BRAIN',reason:'CAPTURE_STARTING'});
  assert.match(h.w.document.querySelector('.elo-voice-status').textContent,/Abrindo microfone/);
  h.state({state:'BRAIN_LISTENING',enabled:true,owner:'BRAIN',reason:''});assert.match(h.w.document.querySelector('.elo-voice-status').textContent,/Ouvindo/);await tick();
});
test('loading and port handoff never activate capture', async t => {
  const h = harness(t); assert.equal(h.sent.length, 0); h.connect(); await tick();
  assert.deepEqual(h.sent.map(x => x.type), ['STATUS']); assert.equal(h.calls.length, 0);
});

test('activation shows progress immediately and accepts only one request until native confirmation', async t => {
  const h = harness(t); h.connect(); await tick();
  h.click('.elo-voice-mode-button');
  const button = h.w.document.querySelector('.elo-voice-mode-button');
  assert.equal(button.textContent, 'Ativando chamado ELO…');
  assert.equal(button.disabled, true);
  assert.equal(button.getAttribute('aria-busy'), 'true');
  h.click('.elo-voice-mode-button'); await tick();
  assert.equal(h.sent.filter(message => message.type === 'CONTEXT').length, 1);
  assert.equal(h.sent.filter(message => message.type === 'ACTIVATE').length, 1);
  h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' });
  assert.equal(button.textContent, 'Desativar assistente');
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-busy'), 'false');
});

test('activation failure restores an available button', async t => {
  const h = harness(t, { autoReply: false }); h.connect();
  h.click('.elo-voice-mode-button'); await tick();
  const context = h.sent.find(message => message.type === 'CONTEXT');
  assert.ok(context);
  h.port.onmessage({ data: JSON.stringify({ type: 'RESULT', id: context.id, ok: false, code: 'SESSION_REQUIRED' }) });
  await tick();
  const button = h.w.document.querySelector('.elo-voice-mode-button');
  assert.equal(button.textContent, 'Ativar chamado ELO');
  assert.equal(button.disabled, false);
  assert.equal(button.getAttribute('aria-busy'), 'false');
});
test('wrong navigation nonce cannot take the message port', async t => {
  const h = harness(t); h.connect('another-navigation'); await tick(); assert.equal(h.sent.length, 0);
  h.connect(); await tick(); assert.equal(h.sent[0].type, 'STATUS');
});
test('synthetic activation click cannot enable assistant', async t => {
  const h = harness(t); h.connect(); h.click('.elo-voice-mode-button', false); await tick();
  assert.equal(h.sent.some(x => x.type === 'ACTIVATE'), false);
});
test('trusted activation stops old web audio and validates context first', async t => {
  const h = harness(t); h.connect(); h.click('.elo-voice-mode-button'); await tick(); await tick();
  assert.deepEqual(h.calls, ['end-web', 'stop-web-mic', 'stop-web-tts', 'context']);
  assert.deepEqual(h.sent.filter(x => x.type !== 'STATUS').map(x => x.type), ['CONTEXT', 'ACTIVATE']);
});
test('unresolved draft blocks wake activation', async t => {
  const h = harness(t); h.connect(); h.w.document.querySelector('.elo-input').value = 'Rascunho privado';
  h.click('.elo-voice-mode-button'); await tick(); assert.equal(h.sent.some(x => x.type === 'CONTEXT'), false);
});
test('mic in wake waiting requires the spoken wake word', async t => {
  const h = harness(t); h.connect(); h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' });
  h.click('.elo-mic-button'); await tick(); assert.equal(h.sent.some(x => x.type === 'INTERRUPT' || x.type === 'END' || x.type === 'ACTIVATE'), false);
});
test('manual message reading uses the same native coordinator', async t => {
  const h = harness(t); h.connect(); h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' });
  h.click('.elo-speech-button'); await tick();
  assert.equal(h.sent.find(x => x.type === 'READ_MESSAGE').payload.text, 'Mensagem existente');
  assert.equal(h.calls.includes('web-tts'), false);
});
test('interruption and full disable remain explicit controls', async t => {
  const h = harness(t); h.connect(); h.state({ state: 'BRAIN_SPEAKING', enabled: true, owner: 'NONE' });
  h.click('.elo-mic-button'); h.click('.elo-voice-mode-button'); await tick();
  assert.equal(h.sent.some(x => x.type === 'INTERRUPT'), true); assert.equal(h.sent.some(x => x.type === 'DISABLE'), true);
});
test('logout stops the armed native assistant without waiting for navigation', async t => {
  const h = harness(t); h.connect(); h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' });
  await tick(); h.w.document.body.classList.remove('elo-authenticated'); await tick();
  assert.equal(h.sent.some(x => x.type === 'CLEAR_CONTEXT'), true);
});
test('visible conversation change clears the previous native scope', async t => {
  const h = harness(t); h.connect(); h.click('.elo-voice-mode-button'); await tick(); await tick();
  h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' }); await tick();
  h.changeConversation('conv_other'); h.w.document.body.append(h.w.document.createElement('div')); await tick();
  assert.equal(h.sent.some(x => x.type === 'CLEAR_CONTEXT'), true);
});
test('native manual read button can stop the same reading', async t => {
  const h = harness(t); h.connect(); h.state({ state: 'WAKE_LISTENING', enabled: true, owner: 'WAKE' });
  h.click('.elo-speech-button'); h.state({ state: 'BRAIN_SPEAKING', enabled: true, owner: 'NONE', reason: 'MANUAL_READING' });
  h.click('.elo-speech-button'); await tick(); assert.equal(h.sent.some(x => x.type === 'END'), true);
});
test('partial transcript is visible without overwriting the draft or interpreting HTML', async t => {
  const h=harness(t);h.connect();h.state({state:'BRAIN_LISTENING',enabled:true,owner:'BRAIN'});
  h.w.document.querySelector('.elo-input').value='Meu rascunho';
  h.port.onmessage({data:JSON.stringify({type:'TRANSCRIPT',text:'projeto <img src=x> aurora',final:false})});
  assert.equal(h.w.document.querySelector('.elo-native-transcript').textContent,'Você: projeto <img src=x> aurora');
  assert.equal(h.w.document.querySelector('.elo-native-transcript img'),null);
  assert.equal(h.w.document.querySelector('.elo-input').value,'Meu rascunho');await tick();
});

test('a late partial cannot replace the final transcript and the next turn starts fresh', async t => {
  const h = harness(t); h.connect();
  h.state({ state: 'BRAIN_LISTENING', enabled: true, owner: 'BRAIN', reason: 'CAPTURE_STARTING' });
  const transcript = (text, final) => h.port.onmessage({ data: JSON.stringify({ type: 'TRANSCRIPT', text, final }) });
  transcript('a capital da bahia', false);
  transcript('Qual é a capital da Bahia?', true);
  transcript('a capital da bahia', false);
  assert.equal(h.w.document.querySelector('.elo-native-transcript').textContent, 'Você: Qual é a capital da Bahia?');
  h.state({ state: 'PROCESSING', enabled: true, owner: 'NONE', turn: 1 });
  h.state({ state: 'BRAIN_LISTENING', enabled: true, owner: 'BRAIN', reason: 'CAPTURE_STARTING', turn: 1 });
  transcript('outra pergunta', false);
  assert.equal(h.w.document.querySelector('.elo-native-transcript').textContent, 'Você: outra pergunta');
  await tick();
});
test('disabling voice clears partial text and rejects stale transcript callbacks', async t => {
  const h=harness(t);h.connect();h.state({state:'BRAIN_LISTENING',enabled:true,owner:'BRAIN'});
  h.port.onmessage({data:JSON.stringify({type:'TRANSCRIPT',text:'aurora',final:false})});
  h.state({state:'WAKE_DISABLED',enabled:false,owner:'NONE'});
  h.port.onmessage({data:JSON.stringify({type:'TRANSCRIPT',text:'late callback',final:true})});
  assert.equal(h.w.document.querySelector('.elo-native-transcript').textContent,'');
  assert.equal(h.w.document.querySelector('.elo-native-transcript').hidden,true);await tick();
});
test('foreground history sync reads canonical conversation and preserves draft', async t => {
  const requests = [];
  const h = harness(t, { fetch: async (url, options) => { requests.push({ url, options }); return { ok: true, json: async () => ({ conversation: { id: 'conv_qa' }, messages: [{ role: 'user', content: 'Aurora' }] }) }; } });
  h.connect(); await tick(); h.w.document.querySelector('.elo-input').value = 'Meu rascunho';
  h.w.EloNativeBrain.onResume(); await tick(); await tick();
  assert.equal(requests.length, 1); assert.equal(requests[0].options.method, undefined); assert.equal(requests[0].options.redirect, 'error');
  assert.match(requests[0].url, /^https:\/\/obrareport-backend.onrender.com\/api\/elo\/conversations\/conv_qa\?/);
  assert.equal(h.writes.length, 1); assert.equal(h.w.document.querySelector('.elo-input').value, 'Meu rascunho');
});
test('history from a changed conversation cannot replace the visible conversation', async t => {
  let finish;
  const h = harness(t, { fetch: () => new Promise(resolve => { finish = resolve; }) });
  h.connect(); await tick(); h.w.EloNativeBrain.onResume(); await tick(); h.changeConversation('conv_other');
  finish({ ok: true, json: async () => ({ conversation: { id: 'conv_qa' }, messages: [] }) }); await tick();
  assert.equal(h.writes.length, 0);
});
test('the six approved Web TTS functions retain their frozen hashes', () => {
  const frozen = JSON.parse(readFileSync(new URL('./fixtures/elo-tts-frozen-functions-20261014.json', import.meta.url), 'utf8'));
  for (const [name, hash] of Object.entries(frozen)) {
    const begin = web.indexOf('  function ' + name + '('), end = web.indexOf('\n  function ', begin + 1);
    assert.ok(begin >= 0 && end > begin);
    assert.equal(createHash('sha256').update(web.slice(begin, end).trim()).digest('hex'), hash, name);
  }
});
test('native neural instructions exactly match the approved Web profile', () => {
  const begin = web.indexOf('  function getEloTtsInstructions_('), end = web.indexOf('\n  function ', begin + 1);
  const expected = JSON.parse(web.slice(begin, end).match(/return ("Fale em[^\n]+?");/)[1]);
  const profile = readFileSync(new URL('app/src/main/java/br/com/icaroamaral/elo/EloNeuralVoiceProfile.kt', native), 'utf8');
  assert.equal(JSON.parse(profile.match(/const val INSTRUCTIONS = ("[^\n]+")/)[1]), expected);
});
test('handoff export rejects hidden or unauthenticated pages without reading a token', async () => {
  const begin = web.indexOf('  function exportNativeVoiceContext_('), end = web.indexOf('\n  function ', begin + 1);
  let reads = 0;
  const c = { window: { location: { origin: 'https://www.icaroamaral.com.br', pathname: '/elo.html' }, ELO_AUTH_SESSION_VALIDATED: true }, document: { visibilityState: 'hidden' }, getEloCoreValidAccessToken_: () => { reads++; } };
  vm.createContext(c); vm.runInContext(web.slice(begin, end), c);
  await assert.rejects(c.exportNativeVoiceContext_()); assert.equal(reads, 0);
  c.document.visibilityState = 'visible'; c.window.ELO_AUTH_SESSION_VALIDATED = false;
  await assert.rejects(c.exportNativeVoiceContext_()); assert.equal(reads, 0);
});
