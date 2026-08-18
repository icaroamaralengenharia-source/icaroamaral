(function () {
  "use strict";

  var SULTANS_OF_SWING = {
    title: "Sultans Of Swing",
    artist: "Dire Straits",
    videoId: "h0ffIJ7ZO4U"
  };
  var player = null;
  var readyPromise = null;
  var pendingVideoId = "";
  var pendingResolve = null;
  var state = {
    title: "",
    videoId: "",
    playing: false,
    blocked: false
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function ensureContainer() {
    var container = document.querySelector("[data-elo-media-player]");
    if (container) return container;
    container = document.createElement("section");
    container.className = "elo-media-player";
    container.setAttribute("data-elo-media-player", "true");
    container.hidden = true;

    var status = document.createElement("div");
    status.className = "elo-media-status";
    status.setAttribute("data-elo-media-status", "true");
    status.textContent = "Mídia pronta.";
    container.appendChild(status);

    var frame = document.createElement("div");
    frame.className = "elo-media-frame";
    frame.id = "elo-youtube-player";
    container.appendChild(frame);

    var actions = document.createElement("div");
    actions.className = "elo-media-actions";
    [
      ["Pausar", pause],
      ["Continuar", resume],
      ["Parar", stop],
      ["▶ Tocar", function () { if (state.videoId) playYouTubeVideo(state.videoId); }]
    ].forEach(function (item) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "elo-inline-button";
      button.textContent = item[0];
      button.addEventListener("click", item[1]);
      actions.appendChild(button);
    });
    container.appendChild(actions);

    var host = document.querySelector(".elo-panel") || document.querySelector(".elo-chat-shell") || document.body;
    host.appendChild(container);
    return container;
  }

  function setStatus(message, blocked) {
    var container = ensureContainer();
    var status = container.querySelector("[data-elo-media-status]");
    container.hidden = false;
    state.blocked = !!blocked;
    if (status) status.textContent = message;
  }

  function loadYouTubeApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (readyPromise) return readyPromise;
    readyPromise = new Promise(function (resolve) {
      var previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof previous === "function") previous();
        resolve(window.YT);
      };
      if (!document.querySelector("script[src='https://www.youtube.com/iframe_api']")) {
        var script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
      }
    });
    return readyPromise;
  }

  function ensurePlayer() {
    ensureContainer();
    return loadYouTubeApi().then(function (YT) {
      if (player) return player;
      player = new YT.Player("elo-youtube-player", {
        height: "180",
        width: "320",
        videoId: pendingVideoId || SULTANS_OF_SWING.videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          origin: window.location.origin
        },
        events: {
          onReady: function () {
            if (pendingVideoId) player.loadVideoById(pendingVideoId);
          },
          onStateChange: function (event) {
            if (event.data === YT.PlayerState.PLAYING) {
              state.playing = true;
              state.blocked = false;
              setStatus("Tocando: " + state.title, false);
              if (pendingResolve) {
                pendingResolve({ ok: true, autoplayBlocked: false, title: state.title, videoId: state.videoId });
                pendingResolve = null;
              }
            }
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              state.playing = false;
            }
          },
          onError: function () {
            state.playing = false;
            setStatus("Não consegui tocar este vídeo pelo YouTube.", true);
            if (pendingResolve) {
              pendingResolve({ ok: false, autoplayBlocked: true, title: state.title, videoId: state.videoId });
              pendingResolve = null;
            }
          }
        }
      });
      return player;
    });
  }

  function resolveCommand(command) {
    var text = normalize(command);
    var isPlay = /\b(toque|tocar|reproduza|coloque|play)\b/.test(text);
    if (!isPlay) return null;
    if (/\bquem\b|\bcanta\b|\bqual\b|\bo que\b/.test(text)) return null;
    if (/sultans of swing|sultan of swing|sul of swing|sultans swing/.test(text)) {
      return SULTANS_OF_SWING;
    }
    return null;
  }

  function play(command) {
    var media = resolveCommand(command);
    if (!media) return Promise.resolve({ ok: false, reason: "unsupported_media_command" });
    return playYouTubeVideo(media.videoId, media.title);
  }

  function playYouTubeVideo(videoId, title) {
    state.videoId = String(videoId || "");
    state.title = title || SULTANS_OF_SWING.title;
    pendingVideoId = state.videoId;
    setStatus("Tocando: " + state.title, false);
    return new Promise(function (resolve) {
      pendingResolve = resolve;
      ensurePlayer().then(function (ytPlayer) {
        try {
          ytPlayer.loadVideoById(state.videoId);
          ytPlayer.playVideo();
          window.setTimeout(function () {
            if (pendingResolve) {
              setStatus("A música está pronta. Clique em Tocar para iniciar.", true);
              pendingResolve({ ok: true, autoplayBlocked: true, title: state.title, videoId: state.videoId });
              pendingResolve = null;
            }
          }, 1800);
        } catch (error) {
          setStatus("A música está pronta. Clique em Tocar para iniciar.", true);
          pendingResolve = null;
          resolve({ ok: true, autoplayBlocked: true, title: state.title, videoId: state.videoId });
        }
      });
    });
  }

  function pause() {
    if (player && typeof player.pauseVideo === "function") player.pauseVideo();
    state.playing = false;
    setStatus(state.title ? "Pausado: " + state.title : "Música pausada.", false);
    return true;
  }

  function resume() {
    if (player && typeof player.playVideo === "function") player.playVideo();
    setStatus(state.title ? "Tocando: " + state.title : "Música retomada.", false);
    return true;
  }

  function stop() {
    if (player && typeof player.stopVideo === "function") player.stopVideo();
    state.playing = false;
    setStatus(state.title ? "Parado: " + state.title : "Música parada.", false);
    return true;
  }

  function setVolume(value) {
    var volume = Math.max(0, Math.min(100, Number(value) || 0));
    if (player && typeof player.setVolume === "function") player.setVolume(volume);
    return volume;
  }

  function isPlaying() {
    return !!state.playing;
  }

  window.EloMedia = {
    play: play,
    playYouTubeVideo: playYouTubeVideo,
    pause: pause,
    resume: resume,
    stop: stop,
    setVolume: setVolume,
    isPlaying: isPlaying,
    resolveCommandForTest: resolveCommand
  };
})();
