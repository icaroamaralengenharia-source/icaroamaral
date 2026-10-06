const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ISSUER = 'https://mplpzyalcxhhinuvjthx.supabase.co/auth/v1';
const AUTH_KEY = 'sb-elo-core-auth-token';

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(String(key), String(value)); },
    removeItem(key) { values.delete(key); },
    dump() { return Object.fromEntries(values); }
  };
}

function createJwt(exp) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return encode({ alg: 'none', typ: 'JWT' }) + '.' + encode({ iss: ISSUER, exp }) + '.fixture';
}

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}

function loadElo(options = {}) {
  const localStorage = createStorage(options.localStorage || {});
  const sessionStorage = createStorage(options.sessionStorage || {});
  const document = {
    readyState: 'complete',
    body: { dataset: {}, classList: { add() {}, remove() {}, toggle() {} } },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    addEventListener() {},
    createDocumentFragment() { return { appendChild() {} }; },
    createElement() {
      return {
        dataset: {}, style: {}, children: [], classList: { add() {}, remove() {}, contains() { return false; } },
        appendChild(child) { this.children.push(child); return child; },
        addEventListener() {}, remove() {}, setAttribute() {}, querySelector() { return null; }
      };
    }
  };
  const window = {
    ELO_SKIP_AUTO_WIDGET: true,
    ELO_PRODUCT_MODE: true,
    ELO_STANDALONE_MODE: true,
    ELO_API_BASE_URL: 'https://api.fixture.test',
    ELO_SUPABASE_URL: 'https://mplpzyalcxhhinuvjthx.supabase.co',
    ELO_SUPABASE_ANON_KEY: 'anon-key-fixture',
    location: { hostname: 'fixture.test', protocol: 'https:', pathname: '/elo.html', hash: '' },
    localStorage,
    sessionStorage,
    crypto: { randomUUID: () => 'fixture-id' },
    atob(value) { return Buffer.from(String(value), 'base64').toString('binary'); },
    btoa(value) { return Buffer.from(String(value), 'binary').toString('base64'); },
    addEventListener() {},
    removeEventListener() {},
    setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
    clearTimeout() {},
    fetch: options.fetch
  };
  window.window = window;
  window.document = document;
  window.navigator = { userAgent: 'elo-auth-refresh-fixture' };
  const context = {
    console, Date, Math, URLSearchParams, document, navigator: window.navigator,
    window, globalThis: window, fetch: options.fetch,
    setTimeout: window.setTimeout, clearTimeout: window.clearTimeout,
    Blob: function Blob() {},
    URL: { createObjectURL() { return 'blob:fixture'; }, revokeObjectURL() {} }
  };
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'elo-assistente.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'elo-assistente.js' });
  return { elo: context.window.EloAssistente, context, localStorage, sessionStorage };
}

function storedSession(accessToken, refreshToken, extra = {}) {
  const session = Object.assign({ access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 }, extra);
  return JSON.stringify({ currentSession: session, session, access_token: accessToken, refresh_token: refreshToken });
}

function expiredToken() { return createJwt(Math.floor(Date.now() / 1000) - 60); }
function validToken(seconds = 3600) { return createJwt(Math.floor(Date.now() / 1000) + seconds); }

test('auth refresh: token válido não dispara refresh', async () => {
  let refreshCalls = 0;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(validToken(), 'refresh-fixture') },
    fetch() { refreshCalls += 1; return Promise.reject(new Error('unexpected_refresh')); }
  });
  const token = await ctx.elo.getValidAccessTokenForTest();
  assert.equal(typeof token, 'string');
  assert.equal(refreshCalls, 0);
});

test('auth refresh: token expirado renova e persiste refresh rotacionado', async () => {
  let refreshCalls = 0;
  const refreshed = validToken();
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-old') },
    fetch(url) {
      refreshCalls += 1;
      assert.match(String(url), /auth\/v1\/token\?grant_type=refresh_token$/);
      return Promise.resolve(response({ access_token: refreshed, refresh_token: 'refresh-new', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600 }));
    }
  });
  assert.equal(await ctx.elo.getValidAccessTokenForTest(), refreshed);
  assert.equal(refreshCalls, 1);
  const saved = JSON.parse(ctx.localStorage.getItem(AUTH_KEY));
  assert.equal(saved.refresh_token, 'refresh-new');
  assert.equal(saved.session.refresh_token, 'refresh-new');
});

test('auth refresh: refresh inválido exige login e remove somente a sessão ELO', async () => {
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-revoked') },
    fetch() { return Promise.resolve(response({ error: 'invalid_refresh' }, 400)); }
  });
  await assert.rejects(ctx.elo.getValidAccessTokenForTest(), (error) => error && error.authFailure === true);
  assert.equal(ctx.localStorage.getItem(AUTH_KEY), null);
  assert.equal(ctx.sessionStorage.getItem(AUTH_KEY), null);
  assert.equal(ctx.context.window.ELO_AUTH_SESSION_VALIDATED, false);
});

test('auth refresh: falha de rede preserva a sessão persistida', async () => {
  const saved = storedSession(expiredToken(), 'refresh-network');
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: saved },
    fetch() { return Promise.reject(new Error('network_unavailable')); }
  });
  await assert.rejects(ctx.elo.getValidAccessTokenForTest(), (error) => error && error.transient === true);
  assert.equal(ctx.localStorage.getItem(AUTH_KEY), saved);
});

test('auth refresh: dez callers simultâneos compartilham um único refresh', async () => {
  let refreshCalls = 0;
  let resolveRefresh;
  const refreshed = validToken();
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-single-flight') },
    fetch() {
      refreshCalls += 1;
      return new Promise((resolve) => { resolveRefresh = () => resolve(response({ access_token: refreshed, refresh_token: 'refresh-rotated', expires_in: 3600 })); });
    }
  });
  const pending = Array.from({ length: 10 }, () => ctx.elo.getValidAccessTokenForTest());
  await Promise.resolve();
  assert.equal(refreshCalls, 1);
  resolveRefresh();
  assert.deepEqual(await Promise.all(pending), Array(10).fill(refreshed));
});

test('auth refresh: startup com sessão expirada restaura sem login', async () => {
  const refreshed = validToken();
  const calls = [];
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-startup') },
    fetch(url) {
      calls.push(String(url));
      if (String(url).includes('/auth/v1/token?grant_type=refresh_token')) return Promise.resolve(response({ access_token: refreshed, refresh_token: 'refresh-startup-new', expires_in: 3600 }));
      if (String(url).includes('/auth/v1/user')) return Promise.resolve(response({ id: 'user-fixture' }));
      if (String(url).includes('/api/health')) return Promise.resolve(response({ ok: true }));
      return Promise.resolve(response({ ok: true, authContext: { userId: 'user-fixture' } }));
    }
  });
  assert.equal(await ctx.elo.initCorePersistenceForTest(), true);
  assert.equal(ctx.context.window.ELO_AUTH_SESSION_VALIDATED, true);
  assert.equal(ctx.context.window.ELO_AUTH_TOKEN, refreshed);
  assert.equal(calls.filter((url) => url.includes('grant_type=refresh_token')).length, 1);
});

test('auth refresh: sessão persistida após restart também renova', async () => {
  const refreshed = validToken();
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-restart') },
    fetch() { return Promise.resolve(response({ access_token: refreshed, refresh_token: 'refresh-restart-new', expires_in: 3600 })); }
  });
  assert.equal(await ctx.elo.getValidAccessTokenForTest(), refreshed);
});

test('auth refresh: logout durante refresh não revive a sessão', async () => {
  let resolveRefresh;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-logout') },
    fetch() { return new Promise((resolve) => { resolveRefresh = () => resolve(response({ access_token: validToken(), refresh_token: 'refresh-after-logout', expires_in: 3600 })); }); }
  });
  const pending = ctx.elo.getValidAccessTokenForTest();
  await Promise.resolve();
  await ctx.elo.logoutSupabaseForTest();
  resolveRefresh();
  await assert.rejects(pending);
  assert.equal(ctx.localStorage.getItem(AUTH_KEY), null);
  assert.equal(ctx.context.window.ELO_AUTH_TOKEN, '');
});

test('auth refresh: ausência de refresh token exige login', async () => {
  const ctx = loadElo({ localStorage: { [AUTH_KEY]: storedSession(expiredToken(), '') }, fetch() { throw new Error('refresh_must_not_run'); } });
  await assert.rejects(ctx.elo.getValidAccessTokenForTest(), (error) => error && error.authFailure === true);
  assert.equal(ctx.localStorage.getItem(AUTH_KEY), null);
});

test('auth refresh: expiração próxima dispara refresh preventivo', async () => {
  let refreshCalls = 0;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(validToken(30), 'refresh-skew') },
    fetch() { refreshCalls += 1; return Promise.resolve(response({ access_token: validToken(), refresh_token: 'refresh-skew-new', expires_in: 3600 })); }
  });
  await ctx.elo.getValidAccessTokenForTest();
  assert.equal(refreshCalls, 1);
});

test('auth refresh: request protegida recebe no máximo um retry após 401', async () => {
  let protectedCalls = 0;
  let refreshCalls = 0;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(validToken(), 'refresh-retry') },
    fetch(url) {
      if (String(url).includes('/auth/v1/token?grant_type=refresh_token')) {
        refreshCalls += 1;
        return Promise.resolve(response({ access_token: validToken(), refresh_token: 'refresh-retry-new', expires_in: 3600 }));
      }
      protectedCalls += 1;
      return Promise.resolve(protectedCalls === 1 ? response({ error: 'expired' }, 401) : response({ ok: true, memories: [] }));
    }
  });
  await ctx.elo.loadCoreMemoriesForTest();
  assert.equal(protectedCalls, 2);
  assert.equal(refreshCalls, 1);
});

test('auth refresh: identidade usa a sessão renovada', async () => {
  const refreshed = validToken();
  let refreshCalls = 0;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-identity') },
    fetch(url) {
      if (String(url).includes('/auth/v1/token?grant_type=refresh_token')) {
        refreshCalls += 1;
        return Promise.resolve(response({ access_token: refreshed, refresh_token: 'refresh-identity-new', expires_in: 3600 }));
      }
      return Promise.resolve(response({ ok: true, authContext: { userId: 'user-fixture' } }));
    }
  });
  const session = await ctx.elo.getCanonicalSessionForTest();
  assert.equal(session.ok, true);
  assert.equal(session.accessToken, refreshed);
  assert.equal(refreshCalls, 1);
});

test('auth refresh: image auth usa o token renovado', async () => {
  const refreshed = validToken();
  let imageCalls = 0;
  const ctx = loadElo({
    localStorage: { [AUTH_KEY]: storedSession(expiredToken(), 'refresh-image') },
    fetch(url, options = {}) {
      if (String(url).includes('/auth/v1/token?grant_type=refresh_token')) return Promise.resolve(response({ access_token: refreshed, refresh_token: 'refresh-image-new', expires_in: 3600 }));
      if (String(url).includes('/api/ai/analyze-image')) {
        imageCalls += 1;
        assert.equal(options.headers.Authorization, 'Bearer ' + refreshed);
        return Promise.resolve(response({ suggestion: 'analise fixture' }));
      }
      return Promise.resolve(response({ ok: true }));
    }
  });
  const result = await ctx.elo.analyzeImageForReportForTest({ base64: 'fixture', mimeType: 'image/jpeg' }, 'relatorio fixture', { name: 'fixture.jpg' });
  assert.equal(result.suggestion, 'analise fixture');
  assert.equal(imageCalls, 1);
});
