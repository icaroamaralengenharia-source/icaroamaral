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
    } catch (_) {
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
    return safeParseArray(storageOf(storage).getItem(LONG_TERM_KEY));
  }

  function writeLongTermMemories(list, storage) {
    storageOf(storage).setItem(LONG_TERM_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function readProjectMemories(storage) {
    return safeParseArray(storageOf(storage).getItem(PROJECT_KEY));
  }

  function writeProjectMemories(list, storage) {
    storageOf(storage).setItem(PROJECT_KEY, JSON.stringify(Array.isArray(list) ? list.slice(0, 20) : []));
  }

  function pushLongTermMemory(text, category, storage) {
    const target = storageOf(storage);
    const now = new Date().toISOString();
    const next = {
      id: `offline-lab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      text,
      category: category || "outro",
      importance: "media",
      createdAt: now,
      updatedAt: now
    };
    const normalized = normalizeText(text);
    const current = readLongTermMemories(target).filter((item) => normalizeText(item && item.text) !== normalized);
    writeLongTermMemories([next].concat(current).slice(0, 80), target);
    return next;
  }

  function saveProjectMemory(projectName, storage) {
    const target = storageOf(storage);
    const now = new Date().toISOString();
    const normalizedName = String(projectName || "").trim();
    const current = readProjectMemories(target).filter(
      (item) => normalizeText(item && item.project_name) !== normalizeText(normalizedName)
    );
    const next = {
      id: `offline-lab-project-${Date.now()}`,
      project_name: normalizedName,
      current_goal: `Desenvolver ${normalizedName}.`,
      last_completed_task: "",
      pending_task: "",
      decisions: [],
      is_active: true,
      created_at: now,
      updated_at: now
    };
    writeProjectMemories([next].concat(current).slice(0, 20), target);
    pushLongTermMemory(`O projeto atual é ${normalizedName}.`, "projeto", target);
    return next;
  }

  function parseRememberCommand(text) {
    const normalized = String(text || "").trim();
    const lower = normalizeText(normalized);
    const dogMatch = lower.match(/(?:lembre|memorize).{0,30}(?:cachorro|cao).{0,20}(?:se\s+chama|chama|e)\s+([a-z0-9_-]+)/i);
    if (dogMatch) {
      const name = normalized.match(/(?:se\s+chama|chama|é| e )\s*([\p{L}0-9_-]+)/iu);
      const dogName = name ? name[1] : dogMatch[1];
      return {
        kind: "longTerm",
        category: "pessoa",
        text: `Meu cachorro se chama ${dogName}.`
      };
    }

    const projectMatch = normalized.match(/(?:lembre|memorize).{0,40}(?:projeto atual|nosso projeto|projeto)\s+(?:é|e|chama|se chama)\s+(.+)$/iu);
    if (projectMatch && projectMatch[1]) {
      return {
        kind: "project",
        projectName: projectMatch[1].replace(/[.!?]+$/g, "").trim()
      };
    }

    const generic = normalized.match(/^(?:lembre|memorize)\s+(?:que\s+)?(.+)$/iu);
    if (generic && generic[1]) {
      return {
        kind: "longTerm",
        category: "outro",
        text: generic[1].replace(/[.!?]+$/g, "").trim() + "."
      };
    }

    return null;
  }

  function answerMemoryQuestion(text, storage) {
    const lower = normalizeText(text);
    const longTerm = readLongTermMemories(storage);

    if (/(?:nome do meu cachorro|como meu cachorro se chama|meu cachorro)/.test(lower)) {
      const found = longTerm.find((item) => /cachorro/.test(normalizeText(item && item.text)));
      if (found) {
        return `Você me disse: ${found.text}`;
      }
    }

    if (/(?:qual projeto|projeto estamos|projeto atual|photo bridge)/.test(lower)) {
      const project = readProjectMemories(storage).find((item) => item && item.is_active !== false);
      if (project && project.project_name) {
        return `O projeto atual registrado no lab é ${project.project_name}.`;
      }
      const found = longTerm.find((item) => /projeto/.test(normalizeText(item && item.text)));
      if (found) {
        return `Você me disse: ${found.text}`;
      }
    }

    return null;
  }

  function remember(text, storage) {
    const parsed = parseRememberCommand(text);
    if (!parsed) {
      return null;
    }
    if (parsed.kind === "project") {
      const project = saveProjectMemory(parsed.projectName, storage);
      return {
        type: "project",
        item: project,
        message: `Certo. Vou lembrar no lab offline que o projeto atual é ${project.project_name}.`
      };
    }
    const item = pushLongTermMemory(parsed.text, parsed.category, storage);
    return {
      type: "longTerm",
      item,
      message: `Certo. Vou lembrar no lab offline: ${item.text}`
    };
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
