(function attachEloOfflineLabRouter(global) {
  "use strict";

  const LIBRARY_URL = "../relatorio-qualidade-obras/offline-media/classical/library.json";
  const OFFLINE_MEDIA_BASE_URL = "../relatorio-qualidade-obras/";
  const RECOVERABLE_BACKEND_STATUSES = new Set([502, 503, 504]);
  const NON_OFFLINE_STATUSES = new Set([400, 401, 403, 404]);

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function detectBrowserState(navigatorLike) {
    const nav = navigatorLike || global.navigator || {};
    if (nav.onLine === false) {
      return "BROWSER_OFFLINE";
    }
    return "ONLINE_UNVERIFIED";
  }

  function classifyBackendResult(result) {
    if (!result) {
      return "ONLINE_UNVERIFIED";
    }
    if (result.error) {
      return "BACKEND_UNAVAILABLE";
    }
    if (RECOVERABLE_BACKEND_STATUSES.has(Number(result.status))) {
      return "BACKEND_UNAVAILABLE";
    }
    if (NON_OFFLINE_STATUSES.has(Number(result.status))) {
      return "ONLINE_VALIDATED";
    }
    if (Number(result.status) >= 200 && Number(result.status) < 500) {
      return "ONLINE_VALIDATED";
    }
    return "ONLINE_UNVERIFIED";
  }

  function classifyBackendFailure(error) {
    if (!error) {
      return "ONLINE_UNVERIFIED";
    }
    if (typeof error.status !== "undefined") {
      return classifyBackendResult({ status: error.status });
    }
    return "BACKEND_UNAVAILABLE";
  }

  function createTimeoutError() {
    const err = new Error("Backend timeout");
    err.name = "AbortError";
    return err;
  }

  async function probeBackend(options) {
    if (!options || typeof options.backendProbe !== "function") {
      return { state: "ONLINE_UNVERIFIED", detail: "no-probe" };
    }
    const timeoutMs = Number(options.timeoutMs || 1500);
    let timer = null;
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => reject(createTimeoutError()), timeoutMs);
      });
      const response = await Promise.race([options.backendProbe(), timeout]);
      return {
        state: classifyBackendResult({ status: response && response.status }),
        status: response && response.status
      };
    } catch (error) {
      return {
        state: classifyBackendFailure(error),
        error
      };
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  function isMusicPlayCommand(text) {
    const lower = normalize(text);
    return /^(?:toque|toca|tocar|coloque|reproduza|play)\b/.test(lower);
  }

  function isStopCommand(text) {
    return /^(?:pare|parar|stop|interrompa|pause)\b/.test(normalize(text));
  }

  function isMemoryWriteCommand(text) {
    return /^(?:lembre|memorize)\b/.test(normalize(text));
  }

  function isMemoryReadCommand(text) {
    const lower = normalize(text);
    return /(?:qual|como|o que|lembra).{0,60}(?:cachorro|projeto|photo bridge|memoria)/.test(lower);
  }

  function detectIntent(text) {
    if (isStopCommand(text)) {
      return "MUSIC_STOP";
    }
    if (isMusicPlayCommand(text)) {
      return "MUSIC_PLAY";
    }
    if (isMemoryWriteCommand(text)) {
      return "MEMORY_WRITE";
    }
    if (isMemoryReadCommand(text)) {
      return "MEMORY_READ";
    }
    return "NONE";
  }

  function fileToPlayableUrl(file) {
    return OFFLINE_MEDIA_BASE_URL + String(file.path || "").replace(/^\/+/, "");
  }

  function findLocalTrack(library, text) {
    const query = normalize(text).replace(/^(?:toque|toca|tocar|coloque|reproduza|play)\s+/, "");
    const tracks = Array.isArray(library) ? library : [];
    return tracks.find((track) => {
      if (!track || track.offlineAllowed === false) {
        return false;
      }
      const haystacks = [track.title, track.composer].concat(track.aliases || []).map(normalize);
      return haystacks.some((alias) => alias && (query === alias || query.includes(alias) || alias.includes(query)));
    }) || null;
  }

  async function loadLibrary(fetchImpl) {
    const fetcher = fetchImpl || global.fetch;
    if (typeof fetcher !== "function") {
      throw new Error("fetch indisponível para carregar library.json");
    }
    const response = await fetcher(LIBRARY_URL, { cache: "no-cache" });
    if (!response || !response.ok) {
      throw new Error("Não foi possível carregar library.json offline.");
    }
    return response.json();
  }

  function createStorageFallback() {
    const values = new Map();
    return {
      getItem(key) {
        return values.has(key) ? values.get(key) : null;
      },
      setItem(key, value) {
        values.set(key, String(value));
      },
      removeItem(key) {
        values.delete(key);
      }
    };
  }

  function createRouter(options) {
    const config = options || {};
    const memory = config.memoryAdapter || global.EloOfflineMemoryAdapter;
    const storage = config.storage || global.localStorage || createStorageFallback();
    let libraryPromise = config.library ? Promise.resolve(config.library) : null;

    async function getLibrary() {
      if (!libraryPromise) {
        libraryPromise = loadLibrary(config.fetch);
      }
      return libraryPromise;
    }

    async function route(text, routeOptions) {
      const command = String(text || "").trim();
      const intent = detectIntent(command);
      const browserState = detectBrowserState((routeOptions && routeOptions.navigator) || config.navigator);
      let backend = { state: browserState };

      if (browserState !== "BROWSER_OFFLINE") {
        backend = await probeBackend({
          backendProbe: (routeOptions && routeOptions.backendProbe) || config.backendProbe,
          timeoutMs: (routeOptions && routeOptions.timeoutMs) || config.timeoutMs
        });
      }

      if (intent === "MUSIC_STOP") {
        return {
          handled: true,
          intent,
          localStop: true,
          providerCalls: 0,
          chatCalls: 0,
          connectivity: backend.state,
          message: "Música offline interrompida."
        };
      }

      if (intent === "MUSIC_PLAY") {
        const library = await getLibrary();
        const track = findLocalTrack(library, command);
        if (!track) {
          return {
            handled: true,
            intent,
            localPlay: false,
            unavailableOffline: true,
            providerCalls: 0,
            chatCalls: 0,
            connectivity: backend.state,
            message: "Essa música não está disponível na biblioteca offline."
          };
        }
        return {
          handled: true,
          intent,
          localPlay: true,
          providerCalls: 0,
          chatCalls: 0,
          connectivity: backend.state,
          track,
          files: (track.files || []).map((file) => ({
            path: file.path,
            url: fileToPlayableUrl(file),
            format: file.format,
            duration: file.duration
          })),
          message: `Tocando offline: ${track.title}.`
        };
      }

      if (intent === "MEMORY_WRITE") {
        const remembered = memory && memory.remember ? memory.remember(command, storage) : null;
        return {
          handled: Boolean(remembered),
          intent,
          localMemory: Boolean(remembered),
          providerCalls: 0,
          chatCalls: 0,
          connectivity: backend.state,
          message: remembered ? remembered.message : "Não consegui registrar essa memória offline."
        };
      }

      if (intent === "MEMORY_READ") {
        const answer = memory && memory.answerMemoryQuestion ? memory.answerMemoryQuestion(command, storage) : null;
        return {
          handled: Boolean(answer),
          intent,
          localMemory: Boolean(answer),
          providerCalls: 0,
          chatCalls: 0,
          connectivity: backend.state,
          message: answer || "Não encontrei essa memória no lab offline."
        };
      }

      if (backend.state === "BACKEND_UNAVAILABLE") {
        return {
          handled: false,
          intent,
          localOnly: false,
          providerCalls: 0,
          chatCalls: 0,
          connectivity: backend.state,
          message: "O backend online está indisponível e esse comando não tem execução offline neste lab."
        };
      }

      return {
        handled: false,
        intent,
        localOnly: false,
        providerCalls: 0,
        chatCalls: 0,
        connectivity: backend.state,
        message: "Comando encaminhável ao fluxo online existente."
      };
    }

    return {
      getLibrary,
      route
    };
  }

  global.EloOfflineLabRouter = {
    LIBRARY_URL,
    classifyBackendFailure,
    classifyBackendResult,
    createRouter,
    detectBrowserState,
    detectIntent,
    findLocalTrack,
    normalize,
    probeBackend
  };
})(typeof window !== "undefined" ? window : globalThis);
