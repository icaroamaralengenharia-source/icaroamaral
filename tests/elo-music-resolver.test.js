import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const source = readFileSync(new URL("../elo-music-resolver.js", import.meta.url), "utf8");

function createStorage() {
  const data = new Map();
  return {
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(key, String(value)); },
    removeItem(key) { data.delete(key); }
  };
}

function createResolver(fetchImpl = async () => ({ ok: true, json: async () => ({ ok: true, results: [] }) })) {
  const context = {
    console,
    fetch: fetchImpl,
    window: { localStorage: createStorage() }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.EloMusicResolver;
}

test("resolve musicas conhecidas e aliases por fuzzy leve", async () => {
  let remoteCalls = 0;
  const resolver = createResolver(async () => { remoteCalls += 1; return { ok: true, json: async () => ({ ok: true, results: [] }) }; });
  assert.equal((await resolver.resolveCommand("toque Sultans of Swing")).track.videoId, "h0ffIJ7ZO4U");
  assert.equal((await resolver.resolveCommand("toque sul of swing")).track.videoId, "h0ffIJ7ZO4U");
  assert.equal((await resolver.resolveCommand("toque Bohemian Rhapsody")).track.videoId, "fJ9rUzIMcZQ");
  assert.equal((await resolver.resolveCommand("toque boemiam rapisodi")).track.videoId, "fJ9rUzIMcZQ");
  assert.equal((await resolver.resolveCommand("toque Sweet Child of Mine")).track.videoId, "1w7OgIMMRc4");
  assert.equal((await resolver.resolveCommand("toque swit child of mine")).track.videoId, "1w7OgIMMRc4");
  assert.equal((await resolver.resolveCommand("toque Hotel California")).track.videoId, "BciS5krYL80");
  assert.equal(remoteCalls, 0);
});

test("nao trata perguntas sobre musica como comando de tocar", async () => {
  let remoteCalls = 0;
  const resolver = createResolver(async () => { remoteCalls += 1; return { ok: true, json: async () => ({ ok: true, results: [] }) }; });
  assert.equal((await resolver.resolveCommand("quem canta Sultans of Swing?")).status, "not_music");
  assert.equal((await resolver.resolveCommand("qual o significado de Bohemian Rhapsody?")).status, "not_music");
  assert.equal((await resolver.resolveCommand("quem e Freddie Mercury?")).status, "not_music");
  assert.equal(remoteCalls, 0);
});

test("comando ambiguo pede confirmacao em vez de escolher aleatoriamente", async () => {
  const resolver = createResolver();
  const result = await resolver.resolveCommand("toque hello");
  assert.equal(result.ok, false);
  assert.equal(result.status, "needs_confirmation");
  assert.equal(result.options.map((track) => track.artist).join("|"), "Adele|Lionel Richie");
});

test("comando por artista encontra catalogo local", async () => {
  const resolver = createResolver();
  assert.equal((await resolver.resolveCommand("toque Queen")).track.artist, "Queen");
  assert.equal((await resolver.resolveCommand("toque Dire Straits")).track.artist, "Dire Straits");
});

test("busca remota oficial e aprende alias quando catalogo local nao basta", async () => {
  const calls = [];
  const resolver = createResolver(async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      json: async () => ({
        ok: true,
        provider: "youtube-data-api",
        results: [
          { title: "Cover qualquer", artist: "Outro", videoId: "cover1" },
          { title: "Nova Musica", artist: "Artista Oficial", channel: "Artista Oficial VEVO", videoId: "official1", embeddable: true }
        ]
      })
    };
  });
  const first = await resolver.resolveCommand("reproduza nova musica");
  assert.equal(first.ok, true);
  assert.equal(first.source, "remote");
  assert.equal(first.track.videoId, "official1");
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/elo\/media\/search/);
  assert.equal(calls[0].options.credentials, "omit");

  const second = await resolver.resolveCommand("reproduza nova musica");
  assert.equal(second.source, "local");
  assert.equal(second.track.videoId, "official1");
  assert.equal(calls.length, 1);
});

test("musica desconhecida nao toca video aleatorio", async () => {
  const resolver = createResolver(async () => ({ ok: true, json: async () => ({ ok: true, results: [] }) }));
  const result = await resolver.resolveCommand("toque xyzabc musica que nao existe");
  assert.equal(result.ok, false);
  assert.equal(result.status, "not_found");
});
