(function (root) {
  "use strict";

  const VERSION = "20260717-elo-knowledge-registry-v1";
  const STORAGE_KEY = "elo_knowledge_registry_v1";
  const CORE_PREFIX = "knowledge:";
  const TYPES = ["synonym", "preference", "technical_rule", "correction"];

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) {
    return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
  function now() { return new Date().toISOString(); }
  function createId(type) {
    return "elo_knowledge_" + clean(type || "item") + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }
  function isType(type) { return TYPES.indexOf(type) >= 0; }
  function categoryFor(type) { return type === "preference" ? "preference" : "technical_context"; }

  function normalizeLearning(input) {
    const source = input || {};
    const type = isType(source.type) ? source.type : "correction";
    const id = clean(source.id) || createId(type);
    return {
      id,
      type,
      sourceText: clean(source.sourceText, 2000),
      key: clean(source.key, 220),
      value: clean(source.value, 2000),
      confirmed: source.confirmed === true,
      createdAt: clean(source.createdAt) || now(),
      surface: clean(source.surface) || "relatorio-qualidade-obras",
      enabled: source.enabled !== false
    };
  }

  function encodeMemory(item) {
    const learning = normalizeLearning(item);
    return {
      category: categoryFor(learning.type),
      memory_key: CORE_PREFIX + learning.id,
      memory_value: JSON.stringify(learning),
      confidence: learning.confirmed ? 0.96 : 0.6
    };
  }

  function decodeMemory(memory) {
    if (!memory) return null;
    try {
      const parsed = JSON.parse(memory.memory_value || memory.memoryValue || "{}");
      if (!parsed || !parsed.type || !parsed.id) return null;
      const item = normalizeLearning(parsed);
      item.coreMemoryId = clean(memory.id);
      return item;
    } catch (_) {
      return null;
    }
  }

  function localStorageStore(storage) {
    const safeStorage = storage || root.localStorage;
    let memory = {};
    function read() {
      try {
        if (!safeStorage) return memory;
        const parsed = JSON.parse(safeStorage.getItem(STORAGE_KEY) || "{}");
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (_) {
        return memory;
      }
    }
    function write(data) {
      memory = data || {};
      try { if (safeStorage) safeStorage.setItem(STORAGE_KEY, JSON.stringify(memory)); } catch (_) {}
    }
    return {
      async list() { return Object.values(read()).map(normalizeLearning); },
      async upsert(item) {
        const data = read();
        const learning = normalizeLearning(item);
        data[learning.id] = learning;
        write(data);
        return learning;
      },
      async update(id, patch) {
        const data = read();
        const current = data[id];
        if (!current) return null;
        data[id] = normalizeLearning(Object.assign({}, current, patch || {}, { id }));
        write(data);
        return data[id];
      },
      async delete(id) {
        const data = read();
        const existed = !!data[id];
        delete data[id];
        write(data);
        return existed;
      }
    };
  }

  function eloCoreStore(options) {
    const settings = options || {};
    const endpoint = clean(settings.endpoint || "/api/elo/memories");
    const identity = settings.identity || { anonymousId: "elo_local" };
    function query(params) {
      const url = new URL(endpoint, root.location && root.location.href || "http://localhost/");
      Object.keys(params || {}).forEach(function (key) {
        if (params[key] !== undefined && params[key] !== null && clean(params[key])) url.searchParams.set(key, params[key]);
      });
      return url.pathname + url.search;
    }
    async function request(path, requestOptions) {
      if (typeof root.fetch !== "function") throw new Error("fetch_unavailable");
      const response = await root.fetch(path, Object.assign({
        headers: { "Content-Type": "application/json" }
      }, requestOptions || {}));
      if (!response || response.ok === false) throw new Error("elo_core_store_unavailable");
      return response.json();
    }
    return {
      async list() {
        const data = await request(query(Object.assign({}, identity, { category: "technical_context", includeInactive: true })));
        const tech = Array.isArray(data.memories) ? data.memories : [];
        const prefs = await request(query(Object.assign({}, identity, { category: "preference", includeInactive: true }))).then(function (payload) {
          return Array.isArray(payload.memories) ? payload.memories : [];
        });
        return tech.concat(prefs).map(decodeMemory).filter(Boolean);
      },
      async upsert(item) {
        const data = await request(endpoint, {
          method: "POST",
          body: JSON.stringify(Object.assign({}, identity, encodeMemory(item)))
        });
        return decodeMemory(data.memory) || normalizeLearning(item);
      },
      async update(id, patch) {
        const all = await this.list();
        const current = all.find(function (item) { return item.id === id || item.coreMemoryId === id; });
        if (!current) return null;
        const next = normalizeLearning(Object.assign({}, current, patch || {}, { id: current.id }));
        const data = await request(endpoint + "/" + encodeURIComponent(current.coreMemoryId || id), {
          method: "PUT",
          body: JSON.stringify(Object.assign({}, identity, encodeMemory(next)))
        });
        return decodeMemory(data.memory) || next;
      },
      async delete(id) {
        const all = await this.list();
        const current = all.find(function (item) { return item.id === id || item.coreMemoryId === id || normalize(item.key) === normalize(id); });
        if (!current) return false;
        await request(endpoint + "/" + encodeURIComponent(current.coreMemoryId || current.id) + "?" + new URLSearchParams(identity).toString(), { method: "DELETE" });
        return true;
      }
    };
  }

  function resilientStore(primary, fallback) {
    return {
      async list() {
        try { return await primary.list(); } catch (_) { return fallback ? fallback.list() : []; }
      },
      async upsert(item) {
        try { return await primary.upsert(item); } catch (_) { return fallback ? fallback.upsert(item) : normalizeLearning(item); }
      },
      async update(id, patch) {
        try { return await primary.update(id, patch); } catch (_) { return fallback ? fallback.update(id, patch) : null; }
      },
      async delete(id) {
        try { return await primary.delete(id); } catch (_) { return fallback ? fallback.delete(id) : false; }
      }
    };
  }

  function parseCommand(message) {
    const raw = clean(message);
    const text = normalize(raw);
    let match = raw.match(/aprenda que\s+(.+?)\s+(?:significa|quer dizer|e o mesmo que|é o mesmo que)\s+(.+)$/i);
    if (match) return { action: "learn", type: "synonym", key: clean(match[1]), value: clean(match[2]), sourceText: raw };
    match = raw.match(/minha prefer[eê]ncia\s+(?:e|é)\s+(.+)$/i);
    if (match) return { action: "learn", type: "preference", key: "preferencia", value: clean(match[1]), sourceText: raw };
    match = raw.match(/(?:salve|aprenda|registre).*(?:regra t[eé]cnica|regra)\s*:?\s*(.+)$/i);
    if (match) return { action: "learn", type: "technical_rule", key: "regra_tecnica", value: clean(match[1]), sourceText: raw };
    if (/^liste aprendizados|listar aprendizados|quais aprendizados/.test(text)) return { action: "list", sourceText: raw };
    match = raw.match(/apague o aprendizado\s+(.+)$/i);
    if (match) return { action: "delete", target: clean(match[1]), sourceText: raw };
    match = raw.match(/desative o aprendizado\s+(.+)$/i);
    if (match) return { action: "disable", target: clean(match[1]), sourceText: raw };
    if (/^(sim|sim pode|confirmo|confirmar|pode salvar|salve)$/.test(text)) return { action: "confirm", sourceText: raw };
    return null;
  }

  function response(payload) {
    return Object.assign({
      ok: true,
      shortAnswer: "",
      fullAnswer: "",
      nextAction: "",
      canSave: false,
      sessionTheme: "elo_knowledge_registry",
      sessionIntent: "knowledge_registry"
    }, payload || {});
  }

  function createRegistry(options) {
    const settings = options || {};
    const fallback = settings.fallback === false ? null : localStorageStore(settings.storage);
    const primary = settings.store || (settings.useEloCore === false ? fallback : resilientStore(eloCoreStore(settings), fallback));
    const surface = clean(settings.surface) || "relatorio-qualidade-obras";
    let pending = null;

    async function listLearnings() {
      return (await primary.list()).map(normalizeLearning).filter(function (item) { return item && item.id; });
    }
    async function saveLearning(candidate, confirmed) {
      const item = normalizeLearning(Object.assign({}, candidate, { confirmed: confirmed === true, surface, enabled: true }));
      return primary.upsert(item);
    }
    async function findLearning(target) {
      const normalized = normalize(target);
      const all = await listLearnings();
      return all.find(function (item) {
        return normalize(item.id) === normalized || normalize(item.key) === normalized || normalize(item.value) === normalized || normalize(item.sourceText).indexOf(normalized) >= 0;
      }) || null;
    }
    async function handleCommand(message) {
      const command = parseCommand(message);
      if (!command) return null;
      if (command.action === "learn") {
        pending = normalizeLearning(command);
        if (pending.type === "technical_rule") {
          return response({
            ok: false,
            pending: pending,
            shortAnswer: "Regra tecnica pendente de confirmacao.",
            fullAnswer: "Deseja realmente salvar esta regra técnica?",
            nextAction: "Responda sim para confirmar ou ignore para nao salvar.",
            sessionIntent: "knowledge_registry_technical_rule_confirmation"
          });
        }
        return response({
          ok: false,
          pending: pending,
          shortAnswer: "Aprendizado pendente de confirmacao.",
          fullAnswer: "Deseja salvar este aprendizado? " + pending.key + " -> " + pending.value,
          nextAction: "Responda sim para confirmar.",
          sessionIntent: "knowledge_registry_confirmation"
        });
      }
      if (command.action === "confirm") {
        if (!pending) return response({ ok: false, shortAnswer: "Nao ha aprendizado pendente.", fullAnswer: "Nao ha aprendizado pendente para confirmar.", sessionIntent: "knowledge_registry_no_pending" });
        const saved = await saveLearning(pending, true);
        pending = null;
        return response({ learning: saved, shortAnswer: "Aprendizado salvo.", fullAnswer: "Aprendizado salvo: " + saved.key + " -> " + saved.value, sessionIntent: "knowledge_registry_saved" });
      }
      if (command.action === "list") {
        const learnings = await listLearnings();
        const active = learnings.filter(function (item) { return item.enabled !== false; });
        return response({
          learnings: active,
          shortAnswer: active.length ? "Aprendizados encontrados." : "Nenhum aprendizado salvo.",
          fullAnswer: active.length ? active.map(function (item) { return "- " + item.id + " [" + item.type + "] " + item.key + " -> " + item.value; }).join("\n") : "Nenhum aprendizado salvo.",
          sessionIntent: "knowledge_registry_list"
        });
      }
      if (command.action === "delete") {
        const item = await findLearning(command.target);
        const deleted = item ? await primary.delete(item.id) : false;
        return response({ deleted: !!deleted, shortAnswer: deleted ? "Aprendizado apagado." : "Aprendizado nao encontrado.", fullAnswer: deleted ? "Aprendizado apagado." : "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_delete" });
      }
      if (command.action === "disable") {
        const item = await findLearning(command.target);
        const updated = item ? await primary.update(item.id, { enabled: false }) : null;
        return response({ learning: updated, disabled: !!updated, shortAnswer: updated ? "Aprendizado desativado." : "Aprendizado nao encontrado.", fullAnswer: updated ? "Aprendizado desativado." : "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_disable" });
      }
      return null;
    }
    async function expandSearchText(text) {
      try {
        const learnings = await listLearnings();
        const normalized = normalize(text);
        const expansions = [];
        learnings.forEach(function (item) {
          if (item.type === "synonym" && item.confirmed && item.enabled !== false && normalized.indexOf(normalize(item.key)) >= 0) expansions.push(item.value);
        });
        return clean([text].concat(expansions).join(" "));
      } catch (_) {
        return clean(text);
      }
    }
    return { version: VERSION, handleCommand, parseCommand, listLearnings, expandSearchText, saveLearning };
  }


  function createSyncRegistry(options) {
    const settings = options || {};
    const storage = settings.storage || root.localStorage;
    const surface = clean(settings.surface) || "relatorio-qualidade-obras";
    let pending = null;
    function listSync() {
      try {
        if (!storage) return [];
        const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || "{}");
        return Object.values(parsed || {}).map(normalizeLearning);
      } catch (_) {
        return [];
      }
    }
    function writeSync(items) {
      try {
        if (!storage) return false;
        const map = {};
        (items || []).forEach(function (item) { const learning = normalizeLearning(item); map[learning.id] = learning; });
        storage.setItem(STORAGE_KEY, JSON.stringify(map));
        return true;
      } catch (_) {
        return false;
      }
    }
    function saveSync(candidate, confirmed) {
      const item = normalizeLearning(Object.assign({}, candidate, { confirmed: confirmed === true, surface, enabled: true }));
      const items = listSync().filter(function (current) { return current.id !== item.id; });
      items.push(item);
      return writeSync(items) ? item : null;
    }
    function findSync(target) {
      const normalized = normalize(target);
      return listSync().find(function (item) {
        return normalize(item.id) === normalized || normalize(item.key) === normalized || normalize(item.value) === normalized || normalize(item.sourceText).indexOf(normalized) >= 0;
      }) || null;
    }
    function handleCommandSync(message) {
      const command = parseCommand(message);
      if (!command) return null;
      if (command.action === "learn") {
        pending = normalizeLearning(command);
        if (pending.type === "technical_rule") {
          return response({
            ok: false,
            pending: pending,
            shortAnswer: "Regra tecnica pendente de confirmacao.",
            fullAnswer: "Deseja realmente salvar esta regra t\u00e9cnica?",
            nextAction: "Responda sim para confirmar ou ignore para nao salvar.",
            sessionIntent: "knowledge_registry_technical_rule_confirmation"
          });
        }
        return response({
          ok: false,
          pending: pending,
          shortAnswer: "Aprendizado pendente de confirmacao.",
          fullAnswer: "Deseja salvar este aprendizado? " + pending.key + " -> " + pending.value,
          nextAction: "Responda sim para confirmar.",
          sessionIntent: "knowledge_registry_confirmation"
        });
      }
      if (command.action === "confirm") {
        if (!pending) return response({ ok: false, shortAnswer: "Nao ha aprendizado pendente.", fullAnswer: "Nao ha aprendizado pendente para confirmar.", sessionIntent: "knowledge_registry_no_pending" });
        const saved = saveSync(pending, true);
        pending = null;
        if (!saved) return null;
        return response({ learning: saved, shortAnswer: "Aprendizado salvo.", fullAnswer: "Aprendizado salvo: " + saved.key + " -> " + saved.value, sessionIntent: "knowledge_registry_saved" });
      }
      if (command.action === "list") {
        const active = listSync().filter(function (item) { return item.enabled !== false; });
        return response({
          learnings: active,
          shortAnswer: active.length ? "Aprendizados encontrados." : "Nenhum aprendizado salvo.",
          fullAnswer: active.length ? active.map(function (item) { return "- " + item.id + " [" + item.type + "] " + item.key + " -> " + item.value; }).join("\n") : "Nenhum aprendizado salvo.",
          sessionIntent: "knowledge_registry_list"
        });
      }
      if (command.action === "delete") {
        const item = findSync(command.target);
        if (!item) return response({ deleted: false, shortAnswer: "Aprendizado nao encontrado.", fullAnswer: "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_delete" });
        const ok = writeSync(listSync().filter(function (current) { return current.id !== item.id; }));
        return response({ deleted: ok, shortAnswer: ok ? "Aprendizado apagado." : "Aprendizado nao encontrado.", fullAnswer: ok ? "Aprendizado apagado." : "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_delete" });
      }
      if (command.action === "disable") {
        const item = findSync(command.target);
        if (!item) return response({ disabled: false, shortAnswer: "Aprendizado nao encontrado.", fullAnswer: "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_disable" });
        item.enabled = false;
        const items = listSync().filter(function (current) { return current.id !== item.id; });
        items.push(item);
        const ok = writeSync(items);
        return response({ learning: item, disabled: ok, shortAnswer: ok ? "Aprendizado desativado." : "Aprendizado nao encontrado.", fullAnswer: ok ? "Aprendizado desativado." : "Aprendizado nao encontrado.", sessionIntent: "knowledge_registry_disable" });
      }
      return null;
    }
    return { version: VERSION, handleCommandSync, parseCommand, listLearnings: listSync };
  }

  root.EloKnowledgeRegistry = {
    version: VERSION,
    create: createRegistry,
    createRegistry,
    createSync: createSyncRegistry,
    parseCommand,
    normalizeLearning,
    localStorageStore,
    eloCoreStore
  };
})(typeof window !== "undefined" ? window : globalThis);
