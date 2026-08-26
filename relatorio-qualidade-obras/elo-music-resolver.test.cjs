const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function createLocalStorage(initial = {}) {
  const store = Object.assign({}, initial);
  return {
    getItem(key) { return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null; },
    setItem(key, value) { store[key] = String(value); },
    removeItem(key) { delete store[key]; },
    dump() { return Object.assign({}, store); }
  };
}

function loadResolver(options = {}) {
  const events = [];
  const context = {
    console: {
      info(name, payload) { events.push({ name, payload: payload || {} }); },
      log() {}, warn() {}, error() {}
    },
    window: {
      OBRAREPORT_API_BASE_URL: 'https://obrareport-backend.onrender.com',
      setTimeout,
      clearTimeout,
      localStorage: createLocalStorage(options.localStorage),
      console: {
        info(name, payload) { events.push({ name, payload: payload || {} }); },
        log() {}, warn() {}, error() {}
      },
      fetch: options.fetch
    },
    document: { querySelector() { return null; }, body: { appendChild() {} }, createElement() { return {}; } }
  };
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  if (options.catalog !== false) {
    const catalogSource = fs.readFileSync(path.join(__dirname, 'elo-music-catalog.js'), 'utf8');
    vm.runInContext(catalogSource, context, { filename: 'elo-music-catalog.js' });
  }
  if (options.player) context.window.EloMediaPlayer = options.player;
  const source = fs.readFileSync(path.join(__dirname, 'elo-music-resolver.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'elo-music-resolver.js' });
  return { resolver: context.window.EloMusicResolver, events, context };
}

test('ELO music resolver unit: filtra candidatos nao embeddable e preserva fallback', () => {
  const { resolver, events } = loadResolver();
  const result = resolver.normalizeProviderResultForTest({
    ok: true,
    provider: 'youtube-data-api',
    candidates: [
      { title: 'Bloqueado', artist: 'Teste', videoId: 'blocked01', playable: true, embeddable: false },
      { title: 'Sultans Of Swing Live', artist: 'Dire Straits', videoId: 'playable01', playable: true, embeddable: true, relevance: 0.9 },
      { title: 'Sultans Of Swing Audio', artist: 'Dire Straits', videoId: 'playable02', playable: true, embeddable: true, relevance: 0.8 }
    ]
  }, 'Sultans of Swing', 'https://api.test/search?q=Sultans', 200);

  assert.equal(result.found, true);
  assert.equal(result.videoId, 'playable01');
  assert.equal(result.embeddable, true);
  assert.equal(result.playable, true);
  assert.equal(result.fallbackCandidates.length, 1);
  assert.equal(result.fallbackCandidates[0].videoId, 'playable02');
  assert.ok(events.some((event) => event.name === 'MEDIA_CANDIDATE_REJECTED' && event.payload.videoId === 'blocked01'));
});

test('ELO music resolver unit: 503 provider sem chave vira PROVIDER_UNAVAILABLE', () => {
  const { resolver } = loadResolver();
  const result = resolver.normalizeProviderResultForTest({
    ok: false,
    error: 'media_search_provider_not_configured',
    provider: 'youtube-data-api'
  }, 'Galinha Pintadinha', 'https://api.test/search?q=Galinha', 503);

  assert.equal(result.found, false);
  assert.equal(result.providerStatus, 'PROVIDER_UNAVAILABLE');
  assert.equal(Array.isArray(result.candidates), true);
  assert.equal(result.candidates.length, 0);
});



test('ELO music catalog unit: carrega exatamente 100 faixas sem videoId inventado', () => {
  const { context } = loadResolver();
  const catalog = context.window.EloMusicCatalog;
  const items = catalog.list();

  assert.equal(items.length, 100);
  assert.equal(Boolean(catalog.find('toque hotel california')), true);
  assert.equal(catalog.find('toque hotel california').title, 'Hotel California');
  assert.equal(catalog.find('toque sultan of swing').title, 'Sultans of Swing');
  assert.equal(catalog.find('toque more than feeling').title, 'More Than a Feeling');
  assert.equal(catalog.find('toque dont stop believing').title, "Don't Stop Believin'");
  assert.equal(catalog.find('toque ccr have you ever seen the rain').title, 'Have You Ever Seen the Rain');
  assert.equal(catalog.find('toque sweet home alabama').artist, 'Lynyrd Skynyrd');
  assert.equal(catalog.find('toque dreams fleetwood mac').artist, 'Fleetwood Mac');
  assert.equal(catalog.find('toque losing my religion'), null);
  assert.equal(catalog.get('rem-man-on-the-moon').title, 'Man on the Moon');
  assert.equal(items.filter((item) => item.videoId !== null).length, 98);
  assert.equal(items.filter((item) => item.playable === true && item.embeddable === true).length, 98);
  assert.equal(catalog.get('steve-miller-band-fly-like-an-eagle').validationStatus, 'PENDING');
  assert.equal(catalog.get('the-cars-you-might-think').validationStatus, 'PENDING');
  assert.equal(items.some((item) => /fake|mock|sultans-video|galinha-video/i.test(String(item.videoId || item.id))), false);
});

test('ELO music resolver unit: catalog hit validado nao chama provider', async () => {
  const { resolver, events } = loadResolver({
    fetch() {
      throw new Error('fetch should not run for validated catalog hit');
    }
  });

  const result = await resolver.resolve('toque hotel california');

  assert.equal(result.found, true);
  assert.equal(result.catalogId, 'eagles-hotel-california');
  assert.equal(result.videoId, '09839DpTctU');
  assert.equal(result.providerStatus, 'CATALOG_CACHE_HIT');
  assert.ok(events.some((event) => event.name === 'MEDIA_CATALOG_DIRECT'));
});

test('ELO music resolver unit: catalog cache validado evita nova busca', async () => {
  const { resolver } = loadResolver({
    localStorage: {
      elo_music_catalog_cache_v1: JSON.stringify({
        'toto-africa': {
          id: 'youtube:africa1',
          title: 'Africa',
          artist: 'Toto',
          videoId: 'africa1',
          playable: true,
          embeddable: true,
          source: 'youtube-data-api',
          lastValidatedAt: '2026-08-25T00:00:00.000Z'
        }
      })
    },
    fetch() {
      throw new Error('fetch should not run for valid catalog cache');
    }
  });

  const result = await resolver.resolve('toque africa');

  assert.equal(result.found, true);
  assert.equal(result.providerStatus, 'CATALOG_CACHE_HIT');
  assert.equal(result.catalogId, 'toto-africa');
  assert.equal(result.videoId, 'africa1');
});

test('ELO music resolver unit: musica fora do catalogo continua usando provider generico', async () => {
  const requestedUrls = [];
  const { resolver } = loadResolver({
    fetch(url) {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          ok: true,
          provider: 'youtube-data-api',
          candidates: [
            { title: 'Outra Musica', artist: 'Teste', videoId: 'other01', playable: true, embeddable: true }
          ]
        })
      });
    }
  });

  const result = await resolver.resolve('toque uma musica qualquer fora das 100');

  assert.equal(result.found, true);
  assert.equal(result.catalogId, null);
  assert.equal(decodeURIComponent(requestedUrls[0]), 'https://obrareport-backend.onrender.com/api/elo/media/search?q=toque uma musica qualquer fora das 100');
});

test('ELO music resolver unit: MEDIA_ERROR invalida cache de catalogo', async () => {
  const { resolver, context } = loadResolver({
    localStorage: {
      elo_music_catalog_cache_v1: JSON.stringify({
        'aerosmith-dream-on': {
          id: 'youtube:dream1',
          title: 'Dream On',
          artist: 'Aerosmith',
          videoId: 'dream1',
          playable: true,
          embeddable: true
        }
      })
    },
    player: {
      play() { return Promise.resolve(false); }
    }
  });

  await resolver.play({ catalogId: 'aerosmith-dream-on', videoId: 'dream1', title: 'Dream On', playable: true, embeddable: true });
  const cache = JSON.parse(context.window.localStorage.getItem('elo_music_catalog_cache_v1'));

  assert.equal(cache['aerosmith-dream-on'].playable, false);
  assert.equal(cache['aerosmith-dream-on'].embeddable, false);
  assert.equal(cache['aerosmith-dream-on'].invalidationReason, 'MEDIA_ERROR');
});


test('ELO music resolver unit: catalog item pendente usa provider fallback', async () => {
  const requestedUrls = [];
  const { resolver } = loadResolver({
    fetch(url) {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          ok: true,
          provider: 'youtube-data-api',
          candidates: [
            { title: 'Fly Like An Eagle', artist: 'Steve Miller Band', channel: 'Steve Miller Band', videoId: 'freshFLAE1', playable: true, embeddable: true }
          ]
        })
      });
    }
  });

  const result = await resolver.resolve('toque fly like an eagle');

  assert.equal(result.found, true);
  assert.equal(result.catalogId, 'steve-miller-band-fly-like-an-eagle');
  assert.equal(result.videoId, 'freshFLAE1');
  assert.equal(decodeURIComponent(requestedUrls[0]), 'https://obrareport-backend.onrender.com/api/elo/media/search?q=Steve Miller Band Fly Like an Eagle');
});
