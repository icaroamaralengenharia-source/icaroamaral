(function attachEloOfflineRouter(global) {
  "use strict";

  const RECOVERABLE_BACKEND_STATUSES = [0, 502, 503, 504];
  const NON_OFFLINE_STATUSES = [400, 401, 403, 404];

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function includes(list, value) {
    return list.indexOf(Number(value)) >= 0;
  }

  function detectBrowserState(navigatorLike) {
    const nav = navigatorLike || global.navigator || {};
    return nav.onLine === false ? "BROWSER_OFFLINE" : "ONLINE_UNVERIFIED";
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

  function isMusicPlayCommand(text) {
    return /^(?:toque|toca|tocar|coloque|coloca|colocar|poe|ponha|bota|botar|reproduza|reproduzir|play)\b/.test(normalize(text));
  }

  function isStopCommand(text) {
    return /^(?:pare|para|parar|stop|interrompa)\b/.test(normalize(text));
  }

  function isMemoryWriteCommand(text) {
    return /^(?:lembre|memorize)\b/.test(normalize(text));
  }

  function isMemoryReadCommand(text) {
    const lower = normalize(text);
    return /(?:qual|como|o que|lembra).{0,80}(?:cachorro|projeto|photo bridge|memoria|memória)/.test(lower);
  }

  function isOfflineStatusCommand(text) {
    const lower = normalize(text);
    return /(?:estou|voce esta|você está|status).{0,40}(?:offline|online|conexao|conexão)/.test(lower);
  }

  function detectIntent(text) {
    if (isStopCommand(text)) return "MUSIC_STOP";
    if (isMusicPlayCommand(text)) return "MUSIC_PLAY";
    if (isMemoryWriteCommand(text)) return "MEMORY_WRITE";
    if (isMemoryReadCommand(text)) return "MEMORY_READ";
    if (isOfflineStatusCommand(text)) return "OFFLINE_STATUS";
    return "NONE";
  }

  function getConnectivityState(config, routeOptions) {
    const explicit = routeOptions && routeOptions.backendState || config.backendState;
    if (explicit) return explicit;
    return detectBrowserState((routeOptions && routeOptions.navigator) || config.navigator);
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

  function createRouter(options) {
    const config = options || {};
    const memory = config.memoryAdapter || global.EloOfflineMemoryAdapter;
    const storage = config.storage || global.localStorage;

    async function route(text, routeOptions) {
      const command = String(text || "").trim();
      const intent = detectIntent(command);
      const connectivity = getConnectivityState(config, routeOptions || {});

      if (intent === "MUSIC_STOP") {
        return {
          handled: true,
          intent,
          localStop: stopLocalMusic(),
          providerCalls: 0,
          chatCalls: 0,
          connectivity,
          message: "Música interrompida."
        };
      }

      if (intent === "MUSIC_PLAY") {
        const media = await resolveLocalMusic(command);
        if (!media) {
          return {
            handled: true,
            intent,
            localPlay: false,
            unavailableOffline: true,
            providerCalls: 0,
            chatCalls: 0,
            connectivity,
            message: "Essa música não está disponível na biblioteca offline."
          };
        }
        const played = await playLocalMusic(media);
        return {
          handled: true,
          intent,
          localPlay: played,
          media,
          providerCalls: 0,
          chatCalls: 0,
          connectivity,
          message: played ? "Tocando offline: " + (media.title || "música local") + "." : "Encontrei a música offline, mas o navegador não iniciou a reprodução."
        };
      }

      if (intent === "MEMORY_WRITE") {
        const remembered = memory && typeof memory.remember === "function" ? memory.remember(command, storage) : null;
        return {
          handled: !!remembered,
          intent,
          localMemory: !!remembered,
          providerCalls: 0,
          chatCalls: 0,
          connectivity,
          message: remembered ? remembered.message : "Não consegui registrar essa memória offline."
        };
      }

      if (intent === "MEMORY_READ") {
        const answer = memory && typeof memory.answerMemoryQuestion === "function" ? memory.answerMemoryQuestion(command, storage) : "";
        return {
          handled: !!answer,
          intent,
          localMemory: !!answer,
          providerCalls: 0,
          chatCalls: 0,
          connectivity,
          message: answer || "Não encontrei essa memória neste navegador."
        };
      }

      if (intent === "OFFLINE_STATUS") {
        return {
          handled: true,
          intent,
          providerCalls: 0,
          chatCalls: 0,
          connectivity,
          message: connectivity === "ONLINE_VALIDATED" ? "Estou online." : "Estou em modo local. Recursos online podem estar indisponíveis."
        };
      }

      return {
        handled: false,
        intent,
        localOnly: false,
        providerCalls: 0,
        chatCalls: 0,
        connectivity,
        message: "Estou offline. Esse comando precisa de conexão."
      };
    }

    return { route: route };
  }

  global.EloOfflineRouter = {
    classifyBackendFailure,
    classifyBackendResult,
    createRouter,
    detectBrowserState,
    detectIntent,
    normalize
  };
})(typeof window !== "undefined" ? window : globalThis);
