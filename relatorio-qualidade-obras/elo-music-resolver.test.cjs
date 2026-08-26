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
  Object.assign(context.window, options.window || {});
  context.window.window = context.window;
  context.globalThis = context.window;
  vm.createContext(context);
  if (options.catalog !== false) {
    const catalogSource = fs.readFileSync(path.join(__dirname, 'elo-music-catalog.js'), 'utf8');
    vm.runInContext(catalogSource, context, { filename: 'elo-music-catalog.js' });
  }
  if (options.offlineLibrary) {
    const previousFetch = context.window.fetch;
    context.window.fetch = undefined;
    const offlineSource = fs.readFileSync(path.join(__dirname, 'elo-offline-media-library.js'), 'utf8');
    vm.runInContext(offlineSource, context, { filename: 'elo-offline-media-library.js' });
    const library = JSON.parse(fs.readFileSync(path.join(__dirname, 'offline-media/classical/library.json'), 'utf8'));
    context.window.EloOfflineMediaLibrary.loadFromJsonForTest(library);
    context.window.fetch = previousFetch;
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
  const byStatus = items.reduce((acc, item) => {
    acc[item.validationStatus] = (acc[item.validationStatus] || 0) + 1;
    return acc;
  }, {});
  assert.equal(items.filter((item) => item.videoId !== null).length, 98);
  assert.equal(byStatus.ACTIVE, 92);
  assert.equal(byStatus.REJECTED_PHYSICAL, 6);
  assert.equal(byStatus.PENDING, 2);
  assert.equal(byStatus.ACTIVE + byStatus.REJECTED_PHYSICAL + byStatus.PENDING, 100);
  assert.equal(items.filter((item) => item.playConfirmed === true).length, 2);
  assert.equal(catalog.get('aerosmith-dream-on').validationStatus, 'REJECTED_PHYSICAL');
  assert.equal(catalog.get('dire-straits-sultans-of-swing').validationStatus, 'REJECTED_PHYSICAL');
  assert.equal(catalog.get('eagles-hotel-california').validationStatus, 'REJECTED_PHYSICAL');
  assert.equal(catalog.get('a-ha-take-on-me').validationStatus, 'ACTIVE');
  assert.equal(catalog.get('a-ha-take-on-me').playConfirmed, true);
  assert.equal(catalog.get('the-cure-friday-im-in-love').validationStatus, 'ACTIVE');
  assert.equal(catalog.get('the-cure-friday-im-in-love').playConfirmed, true);
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

  const result = await resolver.resolve('toque take on me');

  assert.equal(result.found, true);
  assert.equal(result.catalogId, 'a-ha-take-on-me');
  assert.equal(result.videoId, 'Q5KLj2a47ow');
  assert.equal(result.providerStatus, 'CATALOG_CACHE_HIT');
  assert.ok(events.some((event) => event.name === 'MEDIA_CATALOG_DIRECT'));
});

test('ELO music resolver unit: catalog cache validado evita nova busca', async () => {
  const { resolver } = loadResolver({
    localStorage: {
      elo_music_catalog_cache_v1: JSON.stringify({
        'a-ha-take-on-me': {
          id: 'youtube:africa1',
          title: 'Take on Me',
          artist: 'A-ha',
          videoId: 'takeonme1',
          playable: true,
          embeddable: true,
          validationStatus: 'ACTIVE',
          source: 'youtube-data-api',
          lastValidatedAt: '2026-08-25T00:00:00.000Z'
        }
      })
    },
    fetch() {
      throw new Error('fetch should not run for valid catalog cache');
    }
  });

  const result = await resolver.resolve('toque take on me');

  assert.equal(result.found, true);
  assert.equal(result.providerStatus, 'CATALOG_CACHE_HIT');
  assert.equal(result.catalogId, 'a-ha-take-on-me');
  assert.equal(result.videoId, 'takeonme1');
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


test('ELO music resolver unit: rejected physical nao retorna videoId direto nem cache stale', async () => {
  const requestedUrls = [];
  const { resolver } = loadResolver({
    localStorage: {
      elo_music_catalog_cache_v1: JSON.stringify({
        'aerosmith-dream-on': {
          id: 'youtube:staleDream',
          title: 'Dream On',
          artist: 'Aerosmith',
          videoId: 'staleDream',
          playable: true,
          embeddable: true,
          validationStatus: 'ACTIVE'
        }
      })
    },
    fetch(url) {
      requestedUrls.push(url);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ok: true, provider: 'youtube-data-api', candidates: [] })
      });
    }
  });

  const result = await resolver.resolve('toque dream on');

  assert.equal(result.found, false);
  assert.equal(result.providerStatus, 'NO_EMBEDDABLE_RESULTS');
  assert.equal(result.catalogMatch.catalogId, 'aerosmith-dream-on');
  assert.equal(result.catalogMatch.validationStatus, 'REJECTED_PHYSICAL');
  assert.equal(result.catalogMatch.playable, false);
  assert.equal(result.catalogMatch.embeddable, false);
  assert.equal(decodeURIComponent(requestedUrls[0]), 'https://obrareport-backend.onrender.com/api/elo/media/search?q=Aerosmith Dream On');
});

test('ELO music resolver unit: offline nao chama provider nem toca catalogo active', async () => {
  const requestedUrls = [];
  let playCalls = 0;
  const { resolver } = loadResolver({
    window: { navigator: { onLine: false } },
    fetch(url) { requestedUrls.push(url); throw new Error('provider should not run offline'); },
    player: { play() { playCalls += 1; return true; } }
  });

  const result = await resolver.resolve('toque take on me');
  const played = await resolver.play({ catalogId: 'a-ha-take-on-me', videoId: 'Q5KLj2a47ow', title: 'Take on Me', validationStatus: 'ACTIVE', playable: true, embeddable: true });

  assert.equal(result.found, false);
  assert.equal(result.providerStatus, 'OFFLINE');
  assert.equal(result.catalogMatch.validationStatus, 'ACTIVE');
  assert.equal(requestedUrls.length, 0);
  assert.equal(played, false);
  assert.equal(playCalls, 0);
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


test('ELO offline classical: 5 obras locais resolvem antes de catalogo e provider', async () => {
  const requestedUrls = [];
  const played = [];
  const { resolver } = loadResolver({
    offlineLibrary: true,
    window: { navigator: { onLine: false } },
    fetch(url) { requestedUrls.push(String(url)); throw new Error('provider should not run for local classical'); },
    player: { play(media) { played.push(media); return true; } }
  });

  const cases = [
    ['ELO, toque Beethoven', 'beethoven-fur-elise', 1],
    ['ELO, toque Clair de Lune', 'debussy-clair-de-lune', 1],
    ['ELO, toque Vivaldi', 'vivaldi-four-seasons-spring', 3],
    ['ELO, toque Canon in D', 'pachelbel-canon-in-d', 1],
    ['ELO, toque Chopin', 'chopin-nocturne-op-9-no-2', 1]
  ];

  for (const [query, id, fileCount] of cases) {
    const result = await resolver.resolve(query);
    assert.equal(result.found, true, query);
    assert.equal(result.id, id, query);
    assert.equal(result.source, 'LOCAL_CLASSICAL', query);
    assert.equal(result.providerStatus, 'LOCAL_CLASSICAL', query);
    assert.equal(result.files.length, fileCount, query);
    assert.equal(await resolver.play(result), true, query);
  }

  assert.equal(requestedUrls.length, 0);
  assert.equal(played.length, 5);
  assert.equal(played[2].files.length, 3);
});

test('ELO offline classical: miss preserva catalogo online para Take on Me', async () => {
  const requestedUrls = [];
  const { resolver } = loadResolver({
    offlineLibrary: true,
    fetch(url) { requestedUrls.push(String(url)); throw new Error('provider should not run for active catalog hit'); }
  });

  const result = await resolver.resolve('ELO, toque Take on Me');

  assert.equal(result.found, true);
  assert.equal(result.catalogId, 'a-ha-take-on-me');
  assert.equal(result.source !== 'LOCAL_CLASSICAL', true);
  assert.equal(result.providerStatus, 'CATALOG_CACHE_HIT');
  assert.equal(requestedUrls.length, 0);
});

test('ELO offline classical: miss offline nao inventa musica online', async () => {
  const requestedUrls = [];
  const playCalls = [];
  const { resolver } = loadResolver({
    offlineLibrary: true,
    window: { navigator: { onLine: false } },
    fetch(url) { requestedUrls.push(String(url)); throw new Error('provider should not run offline'); },
    player: { play(media) { playCalls.push(media); return true; } }
  });

  const result = await resolver.resolve('ELO, toque Hotel California');
  const played = await resolver.play(result);

  assert.equal(result.found, false);
  assert.equal(result.providerStatus, 'OFFLINE');
  assert.equal(result.source, 'offline');
  assert.equal(requestedUrls.length, 0);
  assert.equal(played, false);
  assert.equal(playCalls.length, 0);
});

test('ELO service worker: cache v2 inclui modulo local library.json e 7 audios', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'elo-sw.js'), 'utf8');
  const audioPaths = [
    'beethoven/fur-elise.ogg',
    'debussy/clair-de-lune.ogg',
    'vivaldi/spring-mvt-1-allegro.oga',
    'vivaldi/spring-mvt-2-largo.oga',
    'vivaldi/spring-mvt-3-allegro.oga',
    'pachelbel/canon-in-d.mp3',
    'chopin/nocturne-op-9-no-2.ogg'
  ];

  assert.match(sw, /elo-web-offline-v2/);
  assert.match(sw, /elo-offline-media-library\.js/);
  assert.match(sw, /offline-media\/classical\/library\.json/);
  for (const audioPath of audioPaths) assert.match(sw, new RegExp(audioPath.replace(/[./-]/g, '\\$&')));
});

test('ELO media player: local classical toca fila pausa continua e para', async () => {
  const events = [];
  const title = { textContent: '' };
  const host = {
    innerHTML: '',
    children: [],
    appendChild(node) { this.children.push(node); }
  };
  const root = {
    style: { display: 'none' },
    querySelector(selector) { return selector === '[data-elo-media-title]' ? title : null; }
  };
  const body = { dataset: {}, appendChild() {} };
  const audioInstances = [];
  function Audio(url) {
    this.url = url;
    this.controls = false;
    this.preload = '';
    this.currentTime = 12;
    this.setAttribute = function () {};
    this.removeAttribute = function () {};
    this.load = function () {};
    this.pause = function () { this.paused = true; };
    this.play = function () { this.played = true; return Promise.resolve(true); };
    audioInstances.push(this);
  }
  const context = {
    console: { info(name, payload) { events.push({ name, payload: payload || {} }); }, log() {}, warn() {}, error() {} },
    window: { Audio, console: { info(name, payload) { events.push({ name, payload: payload || {} }); }, log() {}, warn() {}, error() {} } },
    document: {
      body,
      getElementById(id) {
        if (id === 'elo-real-media-player') return root;
        if (id === 'elo-real-media-host') return host;
        return null;
      },
      createElement() { return { style: {}, setAttribute() {}, appendChild() {}, querySelector() { return null; } }; }
    }
  };
  context.window.window = context.window;
  context.window.document = context.document;
  context.globalThis = context.window;
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'elo-media-player.js'), 'utf8');
  vm.runInContext(source, context, { filename: 'elo-media-player.js' });

  const media = {
    id: 'vivaldi-four-seasons-spring',
    title: 'The Four Seasons: Spring / Primavera',
    artist: 'Antonio Vivaldi',
    source: 'LOCAL_CLASSICAL',
    files: [
      { url: './one.oga', path: 'one.oga' },
      { url: './two.oga', path: 'two.oga' },
      { url: './three.oga', path: 'three.oga' }
    ]
  };

  assert.equal(await context.window.EloMediaPlayer.play(media), true);
  assert.equal(context.window.EloMediaPlayer.getState(), 'PLAYING');
  assert.equal(audioInstances.length, 1);
  audioInstances[0].onended();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(audioInstances.length, 2);
  assert.equal(context.window.EloMediaPlayer.pause(), true);
  assert.equal(context.window.EloMediaPlayer.getState(), 'PAUSED');
  assert.equal(context.window.EloMediaPlayer.resume(), true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(context.window.EloMediaPlayer.getState(), 'PLAYING');
  assert.equal(context.window.EloMediaPlayer.stop(), true);
  assert.equal(context.window.EloMediaPlayer.getState(), 'IDLE');
  assert.ok(events.some((event) => event.name === 'MEDIA_PLAYER_START' && event.payload.source === 'LOCAL_CLASSICAL'));
});
