(function attachEloOfflineRouter(global) {
  "use strict";

  const RECOVERABLE_BACKEND_STATUSES = [0, 500, 502, 503, 504];
  const NON_OFFLINE_STATUSES = [400, 401, 403, 404];
  const USER_PROFILE_KEY = "obrareport_elo_perfil_usuario_v1";
  const LONG_TERM_KEY = "elo_long_term_memory_v1";
  const IMPORTANT_MEMORY_KEY = "obrareport_elo_memorias_importantes_v1";
  const CORE_MEMORY_KEY = "obrareport_elo_memoria_v1";
  const NAME_MEMORY_KEY = "nome";
  const STATE_MODEL = global.EloOfflineState || null;
  const STATES = STATE_MODEL ? STATE_MODEL.STATES : {
    ONLINE: "ONLINE",
    DEGRADED_BACKEND: "DEGRADED_BACKEND",
    AUTH_REQUIRED: "AUTH_REQUIRED",
    REMOTE_CAPABILITY_UNAVAILABLE: "REMOTE_CAPABILITY_UNAVAILABLE",
    OFFLINE: "OFFLINE",
    LOCAL_ONLY: "LOCAL_ONLY"
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9+\-*/x÷,.:%\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function includes(list, value) {
    return list.indexOf(Number(value)) >= 0;
  }

  function detectBrowserState(navigatorLike) {
    const nav = navigatorLike || global.navigator || {};
    return nav.onLine === false ? "BROWSER_OFFLINE" : "ONLINE_UNVERIFIED";
  }

  function resolveConnectivityState(config, routeOptions) {
    const options = Object.assign({}, config || {}, routeOptions || {});
    if (STATE_MODEL && typeof STATE_MODEL.resolveConnectivityState === "function") return STATE_MODEL.resolveConnectivityState(options);
    if (options.backendState === "BROWSER_OFFLINE" || (options.navigator && options.navigator.onLine === false)) return STATES.OFFLINE;
    if (options.backendState === "BACKEND_UNAVAILABLE" || options.backendState === "DEGRADED_BACKEND") return STATES.DEGRADED_BACKEND;
    return STATES.ONLINE;
  }

  function legacyConnectivityState(state) {
    switch (state) {
      case STATES.OFFLINE: return "BROWSER_OFFLINE";
      case STATES.DEGRADED_BACKEND: return "BACKEND_UNAVAILABLE";
      case STATES.AUTH_REQUIRED: return "AUTH_INVALID";
      case STATES.REMOTE_CAPABILITY_UNAVAILABLE: return "REMOTE_CAPABILITY_UNAVAILABLE";
      case STATES.LOCAL_ONLY: return "LOCAL_ONLY";
      default: return "ONLINE_VALIDATED";
    }
  }

  function classifyBackendResult(result) {
    if (!result) return "ONLINE_UNVERIFIED";
    if (result.error) return "BACKEND_UNAVAILABLE";
    const status = Number(result.status);
    if (includes(RECOVERABLE_BACKEND_STATUSES, status)) return "BACKEND_UNAVAILABLE";
    if (includes(NON_OFFLINE_STATUSES, status)) return "ONLINE_VALIDATED";
    if (status >= 200 && status < 500) return "ONLINE_VALIDATED";
    return "ONLINE_UNVERIFIED";
  }

  function classifyBackendFailure(error) {
    if (!error) return "ONLINE_UNVERIFIED";
    if (typeof error.status !== "undefined") return classifyBackendResult({ status: error.status });
    return "BACKEND_UNAVAILABLE";
  }

  function classifyConnectivityResult(result) {
    if (STATE_MODEL && typeof STATE_MODEL.classifyConnectivityResult === "function") return STATE_MODEL.classifyConnectivityResult(result);
    return resolveConnectivityState({}, result || {});
  }

  function isConfirmationYes(text) {
    return /^(?:sim|s|isso|essa|esse|pode tocar|e essa|correto|confirma|confirmo|toca|toque)$/.test(normalize(text));
  }

  function isMusicPlayCommand(text) {
    return /^(?:toque|toca|tocar|coloque|coloca|colocar|poe|ponha|bota|botar|reproduza|reproduzir|play)\b/.test(normalize(text));
  }

  function isMusicSuggestionCommand(text) {
    const lower = normalize(text);
    return isMusicPlayCommand(lower) && /\b(?:musica|musicas|som|sons|algo)\b/.test(lower) && /\b(?:trabalhar|foco|concentrar|concentracao|estudar|calma|calmo)\b/.test(lower);
  }

  function isStopCommand(text) {
    return /^(?:pare|para|parar|stop|interrompa)\b/.test(normalize(text));
  }

  function isMemoryWriteCommand(text) {
    return /^(?:lembre|memorize)\b/.test(normalize(text));
  }

  function isMemoryReadCommand(text) {
    const lower = normalize(text);
    return /(?:qual|como|o que|lembra).{0,80}(?:cachorro|projeto|photo bridge|memoria)/.test(lower);
  }

  function isOfflineStatusCommand(text) {
    const lower = normalize(text);
    return /(?:estou|voce esta|status).{0,40}(?:offline|online|conexao)/.test(lower);
  }

  function isDateCommand(text) {
    const lower = normalize(text);
    return /\b(?:que dia e hoje|qual a data de hoje|data de hoje|dia de hoje|que dia e amanha|que dia foi ontem|amanha|ontem|depois de amanha|anteontem|qual o dia da semana|qual o mes atual|qual o ano atual|daqui a \d+ dias|ha \d+ dias)\b/.test(lower);
  }

  function isTimeCommand(text) {
    const lower = normalize(text);
    return /\b(?:que horas sao|qual o horario agora|horario agora|hora atual|que hora e)\b/.test(lower);
  }

  function isCapabilitiesCommand(text) {
    const lower = normalize(text);
    return /\b(?:o que sabe fazer offline|o que voce consegue fazer sem internet|o que consegue fazer offline|funciona offline|capacidades offline)\b/.test(lower);
  }

  function isIdentityCommand(text) {
    const lower = normalize(text);
    return /\b(?:qual meu nome|qual e meu nome|como eu me chamo|voce sabe meu nome)\b/.test(lower);
  }

  function isEloIdentityCommand(text) {
    const lower = normalize(text);
    return /\b(?:quem e voce|quem e o elo|voce e o elo|o que voce e|qual e seu nome|qual seu nome)\b/.test(lower);
  }

  function parseMathExpression(text) {
    const lower = normalize(text).replace(/,/g, ".");
    const percent = lower.match(/(-?\d+(?:\.\d+)?)\s*%\s*(?:de|do|da)\s*(-?\d+(?:\.\d+)?)/);
    if (percent) {
      const rate = Number(percent[1]);
      const base = Number(percent[2]);
      return { left: rate, right: base, operator: "% de", result: rate * base / 100 };
    }
    const match = lower.match(/(-?\d+(?:\.\d+)?)\s*(\+|\-|\*|x|\/|÷)\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return null;
    const left = Number(match[1]);
    const right = Number(match[3]);
    const operator = match[2];
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    let result;
    if (operator === "+") result = left + right;
    else if (operator === "-") result = left - right;
    else if (operator === "*" || operator === "x") result = left * right;
    else if (operator === "/" || operator === "÷") {
      if (right === 0) return { error: "division_by_zero" };
      result = left / right;
    } else return null;
    return { left, right, operator, result };
  }

  function isMathCommand(text) {
    const lower = normalize(text);
    return (/\b(?:quanto e|calcule|calcular|soma|subtraia|multiplique|divida)\b/.test(lower) || /\d+(?:[.,]\d+)?\s*%\s*(?:de|do|da)\s*\d+/.test(lower)) && !!parseMathExpression(lower);
  }

  function detectIntent(text, state) {
    if (state && state.pendingLocalMedia && isConfirmationYes(text)) return "MUSIC_CONFIRMATION";
    if (isStopCommand(text)) return "MUSIC_STOP";
    if (isMusicSuggestionCommand(text)) return "MUSIC_SUGGESTION";
    if (isMusicPlayCommand(text)) return "MUSIC_PLAY";
    if (isMemoryWriteCommand(text)) return "MEMORY_WRITE";
    if (isEloIdentityCommand(text)) return "ELO_IDENTITY_LOCAL";
    if (isIdentityCommand(text)) return "IDENTITY_LOCAL";
    if (isMemoryReadCommand(text)) return "MEMORY_READ";
    if (isDateCommand(text)) return "DATE_LOCAL";
    if (isTimeCommand(text)) return "TIME_LOCAL";
    if (isMathCommand(text)) return "MATH_LOCAL";
    if (isCapabilitiesCommand(text)) return "OFFLINE_CAPABILITIES";
    if (isOfflineStatusCommand(text)) return "OFFLINE_STATUS";
    return "NONE";
  }

  function getConnectivityState(config, routeOptions) {
    return resolveConnectivityState(config, routeOptions);
  }

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch (error) { return null; }
  }

  function readStorageValue(storage, key) {
    try { return storage && storage.getItem ? storage.getItem(key) : null; } catch (error) { return null; }
  }

  function findLocalUserName(storage) {
    const profile = safeParse(readStorageValue(storage, USER_PROFILE_KEY));
    if (profile && typeof profile === "object") {
      const value = profile.userName || profile.name || profile.nome;
      if (value) return String(value).trim();
    }
    const memoryLists = [
      safeParse(readStorageValue(storage, LONG_TERM_KEY)),
      safeParse(readStorageValue(storage, IMPORTANT_MEMORY_KEY)),
      safeParse(readStorageValue(storage, CORE_MEMORY_KEY))
    ];
    for (let listIndex = 0; listIndex < memoryLists.length; listIndex += 1) {
      const list = Array.isArray(memoryLists[listIndex]) ? memoryLists[listIndex] : [];
      for (let index = 0; index < list.length; index += 1) {
        const item = list[index] || {};
        if (normalize(item.memory_key || item.key || "") === NAME_MEMORY_KEY && (item.memory_value || item.value || item.text)) return String(item.memory_value || item.value || item.text).trim();
        const text = String(item.text || item.memory_value || item.value || "");
        const match = text.match(/meu nome (?:é|e)\s+([^.!?\n]{2,80})/i);
        if (match && match[1]) return match[1].trim();
      }
    }
    return "";
  }

  function getNow(config) {
    const value = config && typeof config.now === "function" ? config.now() : new Date();
    return value instanceof Date ? value : new Date(value);
  }

  function formatDate(date) {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    return dd + "/" + mm + "/" + yyyy;
  }

  function formatTime(date) {
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  function formatNumber(value) {
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 100000000) / 100000000).replace(/\.0+$/, "");
  }

  function resolveLocalMusic(command) {
    const library = global.EloOfflineMediaLibrary;
    if (!library || typeof library.find !== "function") return Promise.resolve(null);
    const ready = typeof library.init === "function" ? library.init() : Promise.resolve();
    return Promise.resolve(ready).then(function () {
      const media = library.find(command);
      return media && media.source === "LOCAL_CLASSICAL" ? media : null;
    }).catch(function () {
      return null;
    });
  }

  function getWorkMusicSuggestion() {
    const library = global.EloOfflineMediaLibrary;
    if (!library || typeof library.get !== "function") return resolveLocalMusic("fur elise");
    const ready = typeof library.init === "function" ? library.init() : Promise.resolve();
    return Promise.resolve(ready).then(function () {
      return library.get("beethoven-fur-elise") || library.find("fur elise");
    }).catch(function () { return null; });
  }

  function playLocalMusic(media) {
    const resolver = global.EloMusicResolver;
    if (resolver && typeof resolver.play === "function") {
      return Promise.resolve(resolver.play(media)).then(function (played) { return played !== false; }).catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function stopLocalMusic() {
    const player = global.EloMediaPlayer;
    if (!player || typeof player.stop !== "function") return false;
    try {
      const result = player.stop();
      return !result || result.executed !== false;
    } catch (error) {
      return false;
    }
  }

  function createBase(intent, connectivity) {
    return {
      handled: true,
      intent,
      providerCalls: 0,
      chatCalls: 0,
      connectivity: legacyConnectivityState(connectivity),
      connectivityState: connectivity,
      localOnly: connectivity === STATES.LOCAL_ONLY || connectivity === STATES.OFFLINE
    };
  }

  function createRouter(options) {
    const config = options || {};
    const memory = config.memoryAdapter || global.EloOfflineMemoryAdapter;
    const storage = config.storage || global.localStorage;
    const localStore = config.localStore || (global.EloOfflineLocalStore && global.EloOfflineLocalStore.create
      ? global.EloOfflineLocalStore.create({ storage, identity: config.identity, seed: config.localSeed })
      : null);
    const state = { pendingLocalMedia: null };

    async function route(text, routeOptions) {
      const command = String(text || "").trim();
      const intent = detectIntent(command, state);
      const connectivity = getConnectivityState(config, routeOptions || {});

      if (intent === "MUSIC_CONFIRMATION") {
        const media = state.pendingLocalMedia;
        state.pendingLocalMedia = null;
        const played = media ? await playLocalMusic(media) : false;
        return Object.assign(createBase(intent, connectivity), {
          localPlay: played,
          media,
          message: played ? "Tocando offline: " + (media.title || "música local") + "." : "Encontrei a música offline, mas o navegador não iniciou a reprodução."
        });
      }

      if (intent === "MUSIC_STOP") {
        return Object.assign(createBase(intent, connectivity), {
          localStop: stopLocalMusic(),
          message: "Música interrompida."
        });
      }

      if (intent === "MUSIC_SUGGESTION") {
        const media = await getWorkMusicSuggestion();
        if (!media) {
          return Object.assign(createBase(intent, connectivity), {
            localPlay: false,
            unavailableOffline: true,
            message: "Não encontrei uma opção de música offline para trabalhar neste navegador."
          });
        }
        state.pendingLocalMedia = media;
        return Object.assign(createBase(intent, connectivity), {
          localPlay: false,
          media,
          pendingLocalMediaId: media.id || "",
          message: "Posso tocar offline " + (media.title || "uma música local") + (media.composer ? " - " + media.composer : "") + ". Quer que eu toque?"
        });
      }

      if (intent === "MUSIC_PLAY") {
        const media = await resolveLocalMusic(command);
        if (!media) {
          return Object.assign(createBase(intent, connectivity), {
            localPlay: false,
            unavailableOffline: true,
            message: "Essa música não está disponível na biblioteca offline."
          });
        }
        const played = await playLocalMusic(media);
        return Object.assign(createBase(intent, connectivity), {
          localPlay: played,
          media,
          message: played ? "Tocando offline: " + (media.title || "música local") + "." : "Encontrei a música offline, mas o navegador não iniciou a reprodução."
        });
      }

      if (intent === "MEMORY_WRITE") {
        const remembered = memory && typeof memory.remember === "function" ? memory.remember(command, storage) : null;
        return Object.assign(createBase(intent, connectivity), {
          handled: !!remembered,
          localMemory: !!remembered,
          message: remembered ? remembered.message : "Não consegui registrar essa memória offline."
        });
      }

      if (intent === "MEMORY_READ") {
        const answer = memory && typeof memory.answerMemoryQuestion === "function" ? memory.answerMemoryQuestion(command, storage) : "";
        return Object.assign(createBase(intent, connectivity), {
          handled: !!answer,
          localMemory: !!answer,
          message: answer || "Não encontrei essa memória neste navegador."
        });
      }

      if (intent === "IDENTITY_LOCAL") {
        const name = findLocalUserName(storage);
        return Object.assign(createBase(intent, connectivity), {
          identityAvailable: !!name,
          message: name ? "Seu nome salvo neste navegador é " + name + "." : "Ainda não tenho seu nome salvo neste navegador para responder offline."
        });
      }

      if (intent === "ELO_IDENTITY_LOCAL") {
        return Object.assign(createBase(intent, connectivity), {
          identityAvailable: true,
          message: "Sou o ELO, assistente da plataforma ELO. Continuo com recursos locais quando a rede ou o serviço online não estiver disponível."
        });
      }

      if (intent === "DATE_LOCAL") {
        const now = getNow(config);
        const lower = normalize(command);
        let offset = 0;
        const future = lower.match(/daqui a (\d+) dias/);
        const past = lower.match(/ha (\d+) dias/);
        if (/depois de amanha/.test(lower)) offset = 2;
        else if (/amanha/.test(lower)) offset = 1;
        else if (/ontem/.test(lower)) offset = -1;
        else if (/anteontem/.test(lower)) offset = -2;
        else if (future) offset = Number(future[1]);
        else if (past) offset = -Number(past[1]);
        const date = new Date(now.getTime());
        date.setDate(date.getDate() + offset);
        return Object.assign(createBase(intent, connectivity), { message: (offset === 0 ? "Hoje é " : "A data é ") + formatDate(date) + "." });
      }

      if (intent === "TIME_LOCAL") {
        const now = getNow(config);
        return Object.assign(createBase(intent, connectivity), { message: "Agora são " + formatTime(now) + "." });
      }

      if (intent === "MATH_LOCAL") {
        const parsed = parseMathExpression(command);
        if (parsed && parsed.error === "division_by_zero") {
          return Object.assign(createBase(intent, connectivity), { result: null, message: "Não é possível dividir por zero." });
        }
        return Object.assign(createBase(intent, connectivity), {
          result: parsed.result,
          message: formatNumber(parsed.left) + " " + parsed.operator + " " + formatNumber(parsed.right) + " = " + formatNumber(parsed.result) + "."
        });
      }

      if (intent === "OFFLINE_CAPABILITIES") {
        const categories = global.EloOfflineCapabilityRegistry && typeof global.EloOfflineCapabilityRegistry.categories === "function"
          ? global.EloOfflineCapabilityRegistry.categories().join(", ")
          : "identidade, data, hora, matemática, memória e música";
        return Object.assign(createBase(intent, connectivity), {
          message: "Offline, consigo usar recursos locais do ELO como " + categories.toLowerCase() + ". Recursos remotos continuam sujeitos à conexão e à sessão."
        });
      }

      if (intent === "OFFLINE_STATUS") {
        return Object.assign(createBase(intent, connectivity), {
          message: STATE_MODEL && typeof STATE_MODEL.messageForState === "function" ? STATE_MODEL.messageForState(connectivity) : (connectivity === STATES.ONLINE ? "Estou online." : "Estou usando recursos locais.")
        });
      }

      if (localStore && /\b(?:rdo|diario de obra|vistoria|estoque|stock|documento|anexo|memoria)\b/.test(normalize(command))) {
        const snapshot = localStore.getState && localStore.getState();
        if (snapshot) {
          const lower = normalize(command);
          if (/rdo|diario de obra/.test(lower)) return Object.assign(createBase("RDO_LOCAL", connectivity), { localData: true, data: localStore.listRdo(), message: "RDO disponível no cache local. Status: salvo localmente; não sincronizado." });
          if (/vistoria/.test(lower)) return Object.assign(createBase("VISTORIA_LOCAL", connectivity), { localData: true, data: localStore.listVistoria(), message: "Vistoria disponível no cache local. Status: salvo localmente; não sincronizado." });
          if (/estoque|stock/.test(lower)) return Object.assign(createBase("STOCK_LOCAL", connectivity), { localData: true, data: localStore.stockSnapshot(), message: "Snapshot de estoque disponível localmente. O saldo oficial não foi alterado." });
          if (/documento|anexo/.test(lower)) return Object.assign(createBase("DOCUMENT_LOCAL", connectivity), { localData: true, data: localStore.listDocuments(), attachments: localStore.listAttachments(), message: "Documentos disponíveis no cache local." });
          if (/memoria/.test(lower)) return Object.assign(createBase("MEMORY_LOCAL", connectivity), { localData: true, data: localStore.listMemory(), message: "Memória local disponível nesta sessão." });
        }
      }

      const fallbackMessage = STATE_MODEL && typeof STATE_MODEL.messageForState === "function"
        ? STATE_MODEL.messageForState(connectivity)
        : connectivity === STATES.DEGRADED_BACKEND
          ? "O serviço online do ELO está indisponível no momento."
          : connectivity === STATES.AUTH_REQUIRED
            ? "Sua sessão precisa ser renovada."
            : connectivity === STATES.OFFLINE
              ? "Estou sem acesso à rede, mas posso continuar com recursos locais."
              : "Estou usando recursos locais do ELO.";

      return {
        handled: false,
        intent,
        localOnly: false,
        providerCalls: 0,
        chatCalls: 0,
        connectivity: legacyConnectivityState(connectivity),
        connectivityState: connectivity,
        message: fallbackMessage + " Esse comando não possui execução local disponível."
      };
    }

    return { route: route };
  }

  global.EloOfflineRouter = {
    classifyBackendFailure,
    classifyBackendResult,
    classifyConnectivityResult,
    resolveConnectivityState,
    createRouter,
    detectBrowserState,
    detectIntent: function (text) { return detectIntent(text, {}); },
    normalize
  };
})(typeof window !== "undefined" ? window : globalThis);
