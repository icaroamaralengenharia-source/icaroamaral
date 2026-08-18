(function () {
  "use strict";

  var SULTANS_OF_SWING = {
    title: "Sultans of Swing",
    artist: "Dire Straits",
    videoId: "h0ffIJ7ZO4U"
  };
  var player = null;
  var readyPromise = null;
  var pendingVideoId = "";
  var pendingResolve = null;
  var currentMount = null;
  var state = {
    title: "",
    videoId: "",
    playing: false,
    blocked: false,
    status: "Mídia pronta."
  };
  var controls = {
    play: null,
    pause: null,
    resume: null,
    stop: null
  };

  function normalize(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function createSvgIcon(pathData) {
    var svg = document.createElement("span");
    svg.className = "elo-media-control-icon";
    svg.setAttribute("aria-hidden", "true");
    svg.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="' + pathData + '"></path></svg>';
    return svg;
  }

  function createControlButton(name, label, iconPath, handler, variant) {
    var button = document.createElement("button");
    var text = document.createElement("span");
    button.type = "button";
    button.className = "elo-media-control elo-media-control--" + (variant || "primary");
    button.setAttribute("data-elo-media-control", name);
    button.setAttribute("aria-label", label);
    text.className = "elo-media-control-label";
    text.textContent = label;
    button.appendChild(createSvgIcon(iconPath));
    button.appendChild(text);
    button.addEventListener("click", handler);
    controls[name] = button;
    return button;
  }

  function ensureContainer() {
    var container = document.querySelector("[data-elo-media-player]");
    if (container) return container;
    container = document.createElement("section");
    container.className = "elo-media-player";
    container.setAttribute("data-elo-media-player", "true");
    container.hidden = true;

    var heading = document.createElement("div");
    heading.className = "elo-media-heading";

    var eyebrow = document.createElement("span");
    eyebrow.className = "elo-media-eyebrow";
    eyebrow.textContent = "Música";
    heading.appendChild(eyebrow);

    var title = document.createElement("strong");
    title.className = "elo-media-title";
    title.setAttribute("data-elo-media-title", "true");
    title.textContent = SULTANS_OF_SWING.title;
    heading.appendChild(title);
    container.appendChild(heading);

    var status = document.createElement("div");
    status.className = "elo-media-status";
    status.setAttribute("data-elo-media-status", "true");
    status.textContent = state.status;
    container.appendChild(status);

    var actions = document.createElement("div");
    actions.className = "elo-media-actions";
    actions.appendChild(createControlButton("play", "Tocar", "M8 5v14l11-7z", resume, "primary"));
    actions.appendChild(createControlButton("pause", "Pausar", "M7 5h4v14H7zM13 5h4v14h-4z", pause, "primary"));
    actions.appendChild(createControlButton("resume", "Continuar", "M8 5v14l11-7z", resume, "primary"));
    actions.appendChild(createControlButton("stop", "Parar", "M7 7h10v10H7z", stop, "secondary"));
    container.appendChild(actions);

    var frameWrap = document.createElement("div");
    frameWrap.className = "elo-media-frame-wrap";
    var frame = document.createElement("div");
    frame.className = "elo-media-frame";
    frame.id = "elo-youtube-player";
    frameWrap.appendChild(frame);
    container.appendChild(frameWrap);

    var host = currentMount || document.querySelector(".elo-panel") || document.querySelector(".elo-chat-shell") || document.body;
    host.appendChild(container);
    updateControls();
    return container;
  }

  function setMount(mount) {
    if (!mount || typeof mount.appendChild !== "function") return ensureContainer();
    currentMount = mount;
    var container = ensureContainer();
    if (container.parentNode !== mount) mount.appendChild(container);
    return container;
  }

  function setControlVisible(name, visible) {
    if (controls[name]) controls[name].hidden = !visible;
  }

  function updateControls() {
    var hasMedia = !!state.videoId;
    setControlVisible("play", hasMedia && state.blocked);
    setControlVisible("pause", hasMedia && state.playing && !state.blocked);
    setControlVisible("resume", hasMedia && !state.playing && !state.blocked);
    setControlVisible("stop", hasMedia);
    if (controls.stop) controls.stop.disabled = !hasMedia;
  }

  function setStatus(message, blocked) {
    var container = ensureContainer();
    var status = container.querySelector("[data-elo-media-status]");
    var title = container.querySelector("[data-elo-media-title]");
    container.hidden = false;
    state.blocked = !!blocked;
    state.status = message;
    if (title) title.textContent = state.title || SULTANS_OF_SWING.title;
    if (status) status.textContent = message;
    updateControls();
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
              setStatus("Tocando", false);
              if (pendingResolve) {
                pendingResolve({ ok: true, autoplayBlocked: false, title: state.title, videoId: state.videoId });
                pendingResolve = null;
              }
            }
            if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
              state.playing = false;
              setStatus(event.data === YT.PlayerState.PAUSED ? "Pausado" : "Parado", false);
            }
          },
          onError: function () {
            state.playing = false;
            setStatus("Reprodução indisponível neste vídeo.", true);
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

  function play(command, options) {
    options = options || {};
    if (options.track) return playTrack(options.track, options);
    if (options.mount) setMount(options.mount);
    var media = resolveCommand(command);
    if (!media) return Promise.resolve({ ok: false, reason: "unsupported_media_command" });
    return playTrack(media, options);
  }

  function playTrack(track, options) {
    var media = track && typeof track === "object" ? track : null;
    if (!media || !media.videoId) return Promise.resolve({ ok: false, reason: "invalid_track" });
    return playYouTubeVideo(media.videoId, media.artist ? media.title + " - " + media.artist : media.title, options || {});
  }

  function playYouTubeVideo(videoId, title, options) {
    options = options || {};
    if (options.mount) setMount(options.mount);
    state.videoId = String(videoId || "");
    state.title = title || SULTANS_OF_SWING.title;
    state.playing = false;
    state.blocked = false;
    pendingVideoId = state.videoId;
    setStatus("Preparando reprodução", false);
    return new Promise(function (resolve) {
      pendingResolve = resolve;
      ensurePlayer().then(function (ytPlayer) {
        try {
          ytPlayer.loadVideoById(state.videoId);
          ytPlayer.playVideo();
          window.setTimeout(function () {
            if (pendingResolve) {
              setStatus("A música está pronta.", true);
              pendingResolve({ ok: true, autoplayBlocked: true, title: state.title, videoId: state.videoId });
              pendingResolve = null;
            }
          }, 1800);
        } catch (error) {
          setStatus("A música está pronta.", true);
          pendingResolve = null;
          resolve({ ok: true, autoplayBlocked: true, title: state.title, videoId: state.videoId });
        }
      });
    });
  }

  function pause() {
    if (player && typeof player.pauseVideo === "function") player.pauseVideo();
    state.playing = false;
    setStatus("Pausado", false);
    return true;
  }

  function resume() {
    if (!player && state.videoId) return playYouTubeVideo(state.videoId, state.title);
    if (player && typeof player.playVideo === "function") player.playVideo();
    state.blocked = false;
    setStatus("Tocando", false);
    return true;
  }

  function stop() {
    if (player && typeof player.stopVideo === "function") player.stopVideo();
    state.playing = false;
    state.blocked = false;
    setStatus("Parado", false);
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
    playTrack: playTrack,
    playYouTubeVideo: playYouTubeVideo,
    pause: pause,
    resume: resume,
    stop: stop,
    setVolume: setVolume,
    isPlaying: isPlaying,
    mountForTest: setMount,
    resolveCommandForTest: resolveCommand
  };
})();
