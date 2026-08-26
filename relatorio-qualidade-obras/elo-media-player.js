(function () {
  "use strict";

  const STATE_IDLE = "IDLE";
  const STATE_BUFFERING = "BUFFERING";
  const STATE_PLAYING = "PLAYING";
  const STATE_PAUSED = "PAUSED";
  const STATE_ERROR = "MEDIA_ERROR";
  const PLAYER_ID = "elo-real-media-player";
  const PLAYER_HOST_ID = "elo-real-media-host";
  const CONTROLS_ID = "elo-real-media-controls";
  const CONFIRM_TIMEOUT_MS = 9000;

  let state = STATE_IDLE;
  let currentMedia = null;
  let ytPlayer = null;
  let localAudio = null;
  let localQueue = [];
  let localQueueIndex = 0;
  let apiPromise = null;
  let playRunId = 0;

  function log(name, payload) {
    try {
      if (window.console && typeof window.console.info === "function") window.console.info(name, payload || {});
    } catch (error) {}
  }

  function sanitize(value) {
    return String(value || "").replace(/[\u0000-\u001f<>]/g, "").trim();
  }

  function normalizeVideoId(value) {
    const text = sanitize(value);
    return /^[a-zA-Z0-9_-]{6,20}$/.test(text) ? text : "";
  }

  function setState(nextState) {
    state = nextState || STATE_IDLE;
    try {
      if (document && document.body) document.body.dataset.eloMediaState = state;
    } catch (error) {}
    log("MEDIA_PLAYER_STATE", {
      state: state,
      videoId: currentMedia && currentMedia.videoId,
      source: currentMedia && currentMedia.source,
      title: currentMedia && currentMedia.title
    });
  }

  function ensureRoot() {
    let root = document.getElementById(PLAYER_ID);
    if (root) return root;

    root = document.createElement("section");
    root.id = PLAYER_ID;
    root.setAttribute("aria-label", "Player de mídia do ELO");
    root.style.position = "fixed";
    root.style.right = "16px";
    root.style.bottom = "16px";
    root.style.width = "min(420px, calc(100vw - 32px))";
    root.style.background = "#101820";
    root.style.color = "#fff";
    root.style.border = "1px solid rgba(255,255,255,.18)";
    root.style.boxShadow = "0 18px 52px rgba(0,0,0,.35)";
    root.style.zIndex = "9999";
    root.style.display = "none";
    root.style.overflow = "hidden";
    root.style.borderRadius = "8px";

    const host = document.createElement("div");
    host.id = PLAYER_HOST_ID;
    host.style.aspectRatio = "16 / 9";
    host.style.background = "#000";

    const title = document.createElement("div");
    title.setAttribute("data-elo-media-title", "true");
    title.style.padding = "10px 12px 0";
    title.style.font = "600 13px/1.35 Inter, system-ui, sans-serif";
    title.style.whiteSpace = "nowrap";
    title.style.overflow = "hidden";
    title.style.textOverflow = "ellipsis";

    const controls = document.createElement("div");
    controls.id = CONTROLS_ID;
    controls.style.display = "flex";
    controls.style.gap = "8px";
    controls.style.padding = "10px 12px 12px";

    [["play", "Tocar"], ["pause", "Pausar"], ["resume", "Continuar"], ["stop", "Parar"]].forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item[1];
      button.setAttribute("data-elo-media-action", item[0]);
      button.style.flex = "1";
      button.style.minWidth = "0";
      button.style.border = "1px solid rgba(255,255,255,.22)";
      button.style.background = "rgba(255,255,255,.1)";
      button.style.color = "#fff";
      button.style.padding = "8px";
      button.style.borderRadius = "6px";
      button.style.font = "600 12px/1 Inter, system-ui, sans-serif";
      controls.appendChild(button);
    });

    root.appendChild(host);
    root.appendChild(title);
    root.appendChild(controls);
    document.body.appendChild(root);

    controls.querySelector('[data-elo-media-action="play"]').onclick = function () { return resume(); };
    controls.querySelector('[data-elo-media-action="pause"]').onclick = function () { return pause(); };
    controls.querySelector('[data-elo-media-action="resume"]').onclick = function () { return resume(); };
    controls.querySelector('[data-elo-media-action="stop"]').onclick = function () { return stop(); };

    log("MEDIA_PLAYER_LOADED", { provider: "youtube_iframe_api" });
    return root;
  }

  function ensureYoutubeApi_() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (resolve, reject) {
      const previousReady = window.onYouTubeIframeAPIReady;
      const timer = window.setTimeout(function () {
        reject(new Error("youtube_iframe_api_timeout"));
      }, CONFIRM_TIMEOUT_MS);
      window.onYouTubeIframeAPIReady = function () {
        try {
          if (typeof previousReady === "function") previousReady();
        } catch (error) {}
        window.clearTimeout(timer);
        resolve(window.YT);
      };
      const existing = document.querySelector && document.querySelector('script[data-elo-youtube-api="true"]');
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.setAttribute("data-elo-youtube-api", "true");
        script.onerror = function () {
          window.clearTimeout(timer);
          reject(new Error("youtube_iframe_api_load_failed"));
        };
        (document.head || document.body).appendChild(script);
      }
    });
    return apiPromise;
  }

  function normalizeMediaCandidate(media) {
    const videoId = normalizeVideoId(media && (media.videoId || media.video_id || media.youtubeId));
    if (!videoId) return null;
    return Object.assign({}, media, {
      title: sanitize(media.title || media.name || "Mídia"),
      artist: sanitize(media.artist || media.author || ""),
      videoId: videoId,
      source: sanitize(media.source || "youtube"),
      playable: media.playable !== false,
      embeddable: media.embeddable !== false
    });
  }

  function isLocalClassicalMedia(media) {
    return !!(media && media.source === "LOCAL_CLASSICAL" && Array.isArray(media.files) && media.files.length);
  }

  function buildCandidateList(media) {
    const list = [media].concat(Array.isArray(media && media.fallbackCandidates) ? media.fallbackCandidates : []);
    return list.map(normalizeMediaCandidate).filter(function (candidate) {
      if (!candidate) return false;
      if (candidate.playable !== true || candidate.embeddable !== true) {
        log("MEDIA_CANDIDATE_REJECTED", {
          videoId: candidate.videoId,
          title: candidate.title,
          reason: candidate.embeddable !== true ? "not_embeddable" : "not_playable"
        });
        return false;
      }
      return true;
    });
  }

  function destroyPlayer() {
    if (ytPlayer && typeof ytPlayer.destroy === "function") {
      try { ytPlayer.destroy(); } catch (error) {}
    }
    ytPlayer = null;
    if (localAudio) {
      try { localAudio.pause(); } catch (error) {}
      try { localAudio.removeAttribute && localAudio.removeAttribute("src"); } catch (error) {}
      try { localAudio.load && localAudio.load(); } catch (error) {}
    }
    localAudio = null;
    localQueue = [];
    localQueueIndex = 0;
    const host = document.getElementById(PLAYER_HOST_ID);
    if (host) host.innerHTML = "";
  }

  function createLocalAudio(url) {
    if (typeof window.Audio === "function") return new window.Audio(url);
    const audio = document.createElement("audio");
    audio.src = url;
    return audio;
  }

  function playLocalQueueItem(runId) {
    if (runId !== playRunId) return Promise.resolve(false);
    const file = localQueue[localQueueIndex];
    if (!file || !file.url) {
      setState(STATE_IDLE);
      return Promise.resolve(true);
    }
    localAudio = createLocalAudio(file.url);
    localAudio.preload = "auto";
    localAudio.controls = true;
    localAudio.setAttribute && localAudio.setAttribute("data-elo-local-audio", "true");
    localAudio.onended = function () {
      if (runId !== playRunId) return;
      localQueueIndex += 1;
      if (localQueueIndex < localQueue.length) {
        playLocalQueueItem(runId);
      } else {
        setState(STATE_IDLE);
      }
    };
    localAudio.onerror = function () {
      log("MEDIA_PLAYER_ERROR", { source: "LOCAL_CLASSICAL", path: file.path || file.url, reason: "local_audio_error" });
      setState(STATE_ERROR);
    };
    const host = document.getElementById(PLAYER_HOST_ID);
    if (host) {
      host.innerHTML = "";
      host.appendChild(localAudio);
    }
    setState(STATE_BUFFERING);
    log("MEDIA_PLAY_ATTEMPT", { source: "LOCAL_CLASSICAL", title: currentMedia && currentMedia.title, file: file.path || file.url, index: localQueueIndex + 1 });
    return Promise.resolve(localAudio.play()).then(function () {
      setState(STATE_PLAYING);
      log("MEDIA_PLAY_CONFIRMED", { source: "LOCAL_CLASSICAL", title: currentMedia && currentMedia.title, file: file.path || file.url, index: localQueueIndex + 1 });
      return true;
    }).catch(function (error) {
      log("MEDIA_PLAYER_ERROR", { source: "LOCAL_CLASSICAL", path: file.path || file.url, reason: sanitize(error && error.message) || "local_audio_play_failed" });
      setState(STATE_ERROR);
      return false;
    });
  }

  function playLocalMedia(media) {
    playRunId += 1;
    const runId = playRunId;
    const root = ensureRoot();
    const title = root.querySelector("[data-elo-media-title]");
    root.style.display = "block";
    destroyPlayer();
    currentMedia = Object.assign({}, media, { source: "LOCAL_CLASSICAL" });
    localQueue = media.files.map(function (file, index) {
      return Object.assign({}, file, { index: index + 1 });
    });
    localQueueIndex = 0;
    if (title) title.textContent = currentMedia.title + (currentMedia.artist ? " - " + currentMedia.artist : "");
    log("MEDIA_PLAYER_START", { ok: true, provider: "local_audio", source: "LOCAL_CLASSICAL", files: localQueue.length });
    return playLocalQueueItem(runId);
  }

  function attemptCandidate(candidate, runId, index) {
    log("MEDIA_CANDIDATE", { index: index + 1, title: candidate.title, artist: candidate.artist, videoId: candidate.videoId, source: candidate.source });
    log("MEDIA_EMBED_CHECK", { videoId: candidate.videoId, method: "youtube_iframe_api_events" });
    log("MEDIA_PLAY_ATTEMPT", { videoId: candidate.videoId, title: candidate.title, index: index + 1 });

    return ensureYoutubeApi_().then(function (YT) {
      if (runId !== playRunId) return false;
      const root = ensureRoot();
      const title = root.querySelector("[data-elo-media-title]");
      const host = document.getElementById(PLAYER_HOST_ID);
      if (!host) return false;
      root.style.display = "block";
      if (title) title.textContent = candidate.title + (candidate.artist ? " - " + candidate.artist : "");
      currentMedia = candidate;
      setState(STATE_BUFFERING);
      destroyPlayer();
      const holder = document.createElement("div");
      holder.id = PLAYER_HOST_ID + "-iframe";
      host.appendChild(holder);

      return new Promise(function (resolve) {
        let settled = false;
        const timer = window.setTimeout(function () {
          if (settled || runId !== playRunId) return;
          settled = true;
          log("MEDIA_PLAYER_ERROR", { videoId: candidate.videoId, reason: "play_confirm_timeout" });
          setState(STATE_ERROR);
          resolve(false);
        }, CONFIRM_TIMEOUT_MS);

        function finish(ok, reason) {
          if (settled || runId !== playRunId) return;
          settled = true;
          window.clearTimeout(timer);
          if (ok) {
            setState(STATE_PLAYING);
            log("MEDIA_PLAY_CONFIRMED", { videoId: candidate.videoId, title: candidate.title });
            resolve(true);
          } else {
            log("MEDIA_PLAYER_ERROR", { videoId: candidate.videoId, reason: reason || "youtube_error" });
            setState(STATE_ERROR);
            resolve(false);
          }
        }

        ytPlayer = new YT.Player(holder.id, {
          width: "100%",
          height: "100%",
          videoId: candidate.videoId,
          playerVars: {
            autoplay: 1,
            playsinline: 1,
            rel: 0,
            origin: window.location && window.location.origin ? window.location.origin : undefined
          },
          events: {
            onReady: function (event) {
              try { event.target.playVideo(); } catch (error) {}
            },
            onStateChange: function (event) {
              if (event && event.data === YT.PlayerState.PLAYING) finish(true);
              if (event && event.data === YT.PlayerState.PAUSED && state !== STATE_ERROR) setState(STATE_PAUSED);
              if (event && event.data === YT.PlayerState.ENDED) setState(STATE_IDLE);
            },
            onError: function (event) {
              finish(false, "youtube_error_" + (event && event.data));
            }
          }
        });
      });
    }).catch(function (error) {
      log("MEDIA_PLAYER_ERROR", { videoId: candidate.videoId, reason: sanitize(error && error.message) });
      setState(STATE_ERROR);
      return false;
    });
  }

  function play(media) {
    if (isLocalClassicalMedia(media)) return playLocalMedia(media);
    const candidates = buildCandidateList(media || {});
    playRunId += 1;
    const runId = playRunId;
    if (!candidates.length) {
      log("MEDIA_PLAYER_START", { ok: false, reason: "no_embeddable_candidate" });
      setState(STATE_ERROR);
      return Promise.resolve(false);
    }
    log("MEDIA_PLAYER_START", { ok: true, provider: "youtube_iframe_api", candidates: candidates.length });

    return candidates.reduce(function (chain, candidate, index) {
      return chain.then(function (played) {
        if (played) return true;
        if (index > 0) log("MEDIA_FALLBACK_NEXT", { index: index + 1, videoId: candidate.videoId });
        return attemptCandidate(candidate, runId, index);
      });
    }, Promise.resolve(false)).then(function (played) {
      if (!played) setState(STATE_ERROR);
      return played;
    });
  }

  function pause() {
    if (currentMedia && currentMedia.source === "LOCAL_CLASSICAL") {
      if (!localAudio || typeof localAudio.pause !== "function") return false;
      localAudio.pause();
      setState(STATE_PAUSED);
      return true;
    }
    if (!currentMedia || !ytPlayer || typeof ytPlayer.pauseVideo !== "function") return false;
    ytPlayer.pauseVideo();
    setState(STATE_PAUSED);
    return true;
  }

  function resume() {
    if (currentMedia && currentMedia.source === "LOCAL_CLASSICAL") {
      if (!localAudio || typeof localAudio.play !== "function") return false;
      Promise.resolve(localAudio.play()).then(function () { setState(STATE_PLAYING); }).catch(function (error) {
        log("MEDIA_PLAYER_ERROR", { source: "LOCAL_CLASSICAL", reason: sanitize(error && error.message) || "local_audio_resume_failed" });
        setState(STATE_ERROR);
      });
      setState(STATE_BUFFERING);
      return true;
    }
    if (!currentMedia || !ytPlayer || typeof ytPlayer.playVideo !== "function") return false;
    ytPlayer.playVideo();
    setState(STATE_BUFFERING);
    return true;
  }

  function stop() {
    if (!currentMedia) return false;
    if (ytPlayer && typeof ytPlayer.stopVideo === "function") {
      try { ytPlayer.stopVideo(); } catch (error) {}
    }
    if (localAudio) {
      try { localAudio.pause(); } catch (error) {}
      try { localAudio.currentTime = 0; } catch (error) {}
    }
    const root = document.getElementById(PLAYER_ID);
    if (root) root.style.display = "none";
    destroyPlayer();
    currentMedia = null;
    setState(STATE_IDLE);
    return true;
  }

  window.EloMediaPlayer = {
    provider: "youtube_iframe_api",
    play: play,
    pause: pause,
    resume: resume,
    stop: stop,
    getState: function () { return state; },
    getCurrentMedia: function () { return currentMedia ? Object.assign({}, currentMedia) : null; }
  };

  log("MEDIA_BRIDGE_LOADED", { player: "EloMediaPlayer", provider: "youtube_iframe_api" });
})();
