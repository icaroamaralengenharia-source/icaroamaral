(function attachEloOfflineMemoryAdapter(global) {
  "use strict";

  const LONG_TERM_KEY = "elo_long_term_memory_v1";
  const PROJECT_KEY = "elo_core_project_memory_v1";

  function storageOf(storage) {
    return storage || global.localStorage;
  }

  function safeParseArray(raw) {
    try {
      const value = JSON.parse(raw || "[]");
      return Array.isArray(value) ? value : [];
    } catch (error) {
      return [];
    }
  }

  function normalizeText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function readLongTermMemories(storage) {
    const target = storageOf(storage);
    return target ? safeParseArray(target.getItem(LONG_TERM_KEY)) : [];
  }

  function writeLongTermMemories(list, storage) {
    const target = storageOf(storage);
    if (!target) return false;
    target.setItem(LONG_TERM_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    return true;
  }

  function readProjectMemories(storage) {
    const target = storageOf(storage);
    return target ? safeParseArray(target.getItem(PROJECT_KEY)) : [];
  }

  function writeProjectMemories(list, storage) {
    const target = storageOf(storage);
    if (!target) return false;
    target.setItem(PROJECT_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 20) : []));
    return true;
  }

  function pushLongTermMemory(text, category, storage) {
    const target = storageOf(storage);
    if (!target) return null;
    const now = new Date().toISOString();
    const item = {
      id: "offline-web-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      text: String(text || "").trim(),
      category: category || "outro",
      importance: "media",
      createdAt: now,
      updatedAt: now
    };
    if (!item.text) return null;
    const normalized = normalizeText(item.text);
    const current = readLongTermMemories(target).filter(function (entry) {
      return normalizeText(entry && entry.text) !== normalized;
    });
    writeLongTermMemories([item].concat(current).slice(0, 100), target);
    return item;
  }

  function saveProjectMemory(projectName, storage) {
    const target = storageOf(storage);
    if (!target) return null;
    const now = new Date().toISOString();
    const name = String(projectName || "").replace(/[.!?]+$/g, "").trim();
    if (!name) return null;
    const current = readProjectMemories(target).map(function (entry) {
      return entry && typeof entry === "object" ? Object.assign({}, entry, { is_active: false }) : entry;
    }).filter(function (entry) {
      return normalizeText(entry && entry.project_name) !== normalizeText(name);
    });
    const item = {
      id: "offline-web-project-" + Date.now(),
      project_name: name,
      current_goal: "Desenvolver " + name + ".",
      last_completed_task: "",
      pending_task: "",
      decisions: [],
      is_active: true,
      created_at: now,
      updated_at: now
    };
    writeProjectMemories([item].concat(current).slice(0, 20), target);
    pushLongTermMemory("O projeto atual é " + name + ".", "projeto", target);
    return item;
  }

  function parseRememberCommand(text) {
    const original = String(text || "").trim();
    const lower = normalizeText(original);
    let match = original.match(/^(?:lembre|memorize)\s+que\s+meu\s+(?:cachorro|cao|cão)\s+(?:se\s+chama|chama|é|e)\s+([\p{L}0-9_-]+)/iu);
    if (match && match[1]) {
      return { kind: "longTerm", category: "pessoa", text: "Meu cachorro se chama " + match[1] + "." };
    }
    match = original.match(/^(?:lembre|memorize)\s+que\s+o\s+projeto\s+atual\s+(?:é|e|chama|se\s+chama)\s+(.+)$/iu);
    if (match && match[1]) {
      return { kind: "project", projectName: match[1] };
    }
    match = original.match(/^(?:lembre|memorize)\s+(?:que\s+)?(.+)$/iu);
    if (match && match[1] && !/(senha|cpf|cartao|cartão|token|chave\s+api|credencial)/.test(lower)) {
      return { kind: "longTerm", category: "outro", text: match[1].replace(/[.!?]+$/g, "").trim() + "." };
    }
    return null;
  }

  function answerMemoryQuestion(text, storage) {
    const lower = normalizeText(text);
    const longTerm = readLongTermMemories(storage);
    if (/(?:nome do meu cachorro|como meu cachorro se chama|meu cachorro)/.test(lower)) {
      const dog = longTerm.find(function (entry) {
        return /cachorro/.test(normalizeText(entry && entry.text));
      });
      if (dog && dog.text) return "Você me disse: " + dog.text;
    }
    if (/(?:qual projeto|projeto estamos|projeto atual|photo bridge)/.test(lower)) {
      const project = readProjectMemories(storage).find(function (entry) {
        return entry && entry.is_active !== false && entry.project_name;
      });
      if (project && project.project_name) return "O projeto atual registrado é " + project.project_name + ".";
      const remembered = longTerm.find(function (entry) {
        return /projeto/.test(normalizeText(entry && entry.text));
      });
      if (remembered && remembered.text) return "Você me disse: " + remembered.text;
    }
    return null;
  }

  function remember(text, storage) {
    const parsed = parseRememberCommand(text);
    if (!parsed) return null;
    if (parsed.kind === "project") {
      const project = saveProjectMemory(parsed.projectName, storage);
      return project ? { type: "project", item: project, message: "Certo. Vou lembrar que o projeto atual é " + project.project_name + "." } : null;
    }
    const item = pushLongTermMemory(parsed.text, parsed.category, storage);
    return item ? { type: "longTerm", item: item, message: "Certo. Vou lembrar: " + item.text } : null;
  }

  global.EloOfflineMemoryAdapter = {
    LONG_TERM_KEY,
    PROJECT_KEY,
    answerMemoryQuestion,
    normalizeText,
    parseRememberCommand,
    readLongTermMemories,
    readProjectMemories,
    remember,
    saveProjectMemory,
    writeLongTermMemories,
    writeProjectMemories
  };
})(typeof window !== "undefined" ? window : globalThis);
