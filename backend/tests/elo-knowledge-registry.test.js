import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const testDir = dirname(fileURLToPath(import.meta.url));
const repoDir = join(testDir, "..", "..");

function createMemoryStore() {
  const data = new Map();
  return {
    saved: [],
    updated: [],
    deleted: [],
    async list() {
      return Array.from(data.values()).map((item) => Object.assign({}, item));
    },
    async upsert(item) {
      const next = Object.assign({}, item);
      data.set(next.id, next);
      this.saved.push(next);
      return Object.assign({}, next);
    },
    async update(id, patch) {
      const current = data.get(id);
      if (!current) return null;
      const next = Object.assign({}, current, patch || {});
      data.set(id, next);
      this.updated.push(next);
      return Object.assign({}, next);
    },
    async delete(id) {
      this.deleted.push(id);
      return data.delete(id);
    }
  };
}

function loadRegistry(options = {}) {
  const sandbox = {
    console,
    window: {
      location: { href: "http://localhost/relatorio-qualidade-obras.html" },
      localStorage: options.localStorage || null,
      fetch: options.fetch
    }
  };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(repoDir, "relatorio-qualidade-obras", "elo-knowledge-registry.js"), "utf8"), sandbox, { filename: "elo-knowledge-registry.js" });
  return sandbox.window.EloKnowledgeRegistry;
}

test("salva sinonimo apenas apos confirmacao e expande busca sem alterar sinonimos fixos", async () => {
  const store = createMemoryStore();
  const registry = loadRegistry().create({ store, surface: "test" });

  const pending = await registry.handleCommand("aprenda que bloco baiano significa bloco cerâmico");
  assert.equal(pending.sessionIntent, "knowledge_registry_confirmation");
  assert.equal(store.saved.length, 0);
  assert.equal(pending.pending.confirmed, false);

  const saved = await registry.handleCommand("sim");
  assert.equal(saved.sessionIntent, "knowledge_registry_saved");
  assert.equal(saved.learning.type, "synonym");
  assert.equal(saved.learning.key, "bloco baiano");
  assert.equal(saved.learning.value, "bloco cerâmico");
  assert.equal(saved.learning.confirmed, true);
  assert.equal(store.saved.length, 1);

  const expanded = await registry.expandSearchText("orçamento para bloco baiano");
  assert.match(expanded, /bloco baiano/);
  assert.match(expanded, /bloco cerâmico/);
});

test("regra tecnica nao e salva sem confirmacao explicita", async () => {
  const store = createMemoryStore();
  const registry = loadRegistry().create({ store });

  const pending = await registry.handleCommand("salve regra técnica: nunca usar coeficiente sem fonte");
  assert.equal(pending.sessionIntent, "knowledge_registry_technical_rule_confirmation");
  assert.match(pending.fullAnswer, /Deseja realmente salvar esta regra técnica/);
  assert.equal(store.saved.length, 0);

  const listedBefore = await registry.handleCommand("liste aprendizados");
  assert.equal(listedBefore.learnings.length, 0);

  const confirmed = await registry.handleCommand("sim");
  assert.equal(confirmed.learning.type, "technical_rule");
  assert.equal(confirmed.learning.confirmed, true);
  assert.equal(store.saved.length, 1);
});

test("lista, desativa e apaga aprendizados", async () => {
  const store = createMemoryStore();
  const registry = loadRegistry().create({ store });

  await registry.handleCommand("aprenda que bloco baiano significa bloco cerâmico");
  const saved = await registry.handleCommand("sim");
  const id = saved.learning.id;

  const listed = await registry.handleCommand("liste aprendizados");
  assert.equal(listed.sessionIntent, "knowledge_registry_list");
  assert.equal(listed.learnings.length, 1);
  assert.match(listed.fullAnswer, new RegExp(id));

  const disabled = await registry.handleCommand("desative o aprendizado " + id);
  assert.equal(disabled.disabled, true);
  assert.equal(disabled.learning.enabled, false);

  const afterDisable = await registry.handleCommand("liste aprendizados");
  assert.equal(afterDisable.learnings.length, 0);

  const deleted = await registry.handleCommand("apague o aprendizado " + id);
  assert.equal(deleted.deleted, true);
  assert.equal(store.deleted[0], id);
});

test("preferencia segue confirmacao e usa tipo preference", async () => {
  const store = createMemoryStore();
  const registry = loadRegistry().create({ store });

  const pending = await registry.handleCommand("minha preferência é usar SINAPI BA");
  assert.equal(pending.pending.type, "preference");
  assert.equal(store.saved.length, 0);

  const saved = await registry.handleCommand("sim");
  assert.equal(saved.learning.type, "preference");
  assert.equal(saved.learning.value, "usar SINAPI BA");
  assert.equal(saved.learning.confirmed, true);
});

test("fallback sem registry mantem texto original", async () => {
  const registry = loadRegistry().create({ store: {
    async list() { throw new Error("registry_down"); },
    async upsert() { throw new Error("registry_down"); },
    async update() { throw new Error("registry_down"); },
    async delete() { throw new Error("registry_down"); }
  }, fallback: false });

  const expanded = await registry.expandSearchText("parede com bloco baiano");
  assert.equal(expanded, "parede com bloco baiano");
});

test("estrutura preserva contrato de persistencia do ELO Core Store", async () => {
  const store = createMemoryStore();
  const registry = loadRegistry().create({ store, surface: "relatorio-qualidade-obras" });
  await registry.handleCommand("aprenda que bloco baiano significa bloco cerâmico");
  const saved = await registry.handleCommand("sim");

  assert.deepEqual(Object.keys(saved.learning).filter((key) => [
    "id",
    "type",
    "sourceText",
    "key",
    "value",
    "confirmed",
    "createdAt",
    "surface",
    "enabled"
  ].includes(key)).sort(), [
    "confirmed",
    "createdAt",
    "enabled",
    "id",
    "key",
    "sourceText",
    "surface",
    "type",
    "value"
  ]);
});
