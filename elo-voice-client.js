(function () {
  "use strict";

  var enabled = true;
  var currentAudio = null;
  var currentUrl = "";
  var fallbackEnabled = true;

  function endpoint(path) {
    var configuredBaseUrl = String(window.ELO_API_BASE_URL || window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
    var isLocalPage = /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname || "") || window.location.protocol === "file:";
    var baseUrl = isLocalPage && !window.ELO_API_BASE_URL ? "http://localhost:3000" : configuredBaseUrl;
    return baseUrl + path;
  }

  function releaseAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.removeAttribute("src");
        currentAudio.load();
      } catch (error) {}
      currentAudio = null;
    }
    if (currentUrl) {
      try { URL.revokeObjectURL(currentUrl); } catch (error) {}
      currentUrl = "";
    }
  }

  function browserSpeak(text, options) {
    if (!fallbackEnabled || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      return Promise.reject(new Error("tts_fallback_unavailable"));
    }
    window.speechSynthesis.cancel();
    return new Promise(function (resolve, reject) {
      var utterance = new SpeechSynthesisUtterance(String(text || ""));
      utterance.lang = (options && options.lang) || "pt-BR";
      utterance.rate = Number(options && options.rate) || 1;
      utterance.pitch = Number(options && options.pitch) || 1;
      utterance.onend = function () { resolve({ mode: "browser" }); };
      utterance.onerror = function () { reject(new Error("tts_fallback_failed")); };
      window.speechSynthesis.speak(utterance);
    });
  }

  async function speak(text, options) {
    options = options || {};
    if (!enabled) return { skipped: true };
    var cleanText = String(text || "").trim();
    if (!cleanText) return { skipped: true, reason: "empty_text" };
    fallbackEnabled = options.fallback !== false;
    stop();

    var t0 = performance.now();
    try {
      var requestStartedAt = performance.now();
      var response = await fetch(endpoint("/api/elo/tts"), {
        method: "POST",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: cleanText,
          voice: options.voice || "default",
          format: options.format || "mp3"
        })
      });
      var receivedAt = performance.now();
      if (!response.ok) throw new Error("tts_backend_" + response.status);
      var audioBlob = await response.blob();
      releaseAudio();
      currentUrl = URL.createObjectURL(audioBlob);
      currentAudio = new Audio(currentUrl);
      currentAudio.preload = "auto";
      var audio = currentAudio;
      var firstAudioAt = 0;
      var result = await new Promise(function (resolve, reject) {
        audio.onplaying = function () { firstAudioAt = performance.now(); };
        audio.onended = function () {
          var durationMs = Number.isFinite(audio.duration) ? Math.round(audio.duration * 1000) : 0;
          releaseAudio();
          resolve({
            mode: "neural",
            requestMs: Math.round(receivedAt - requestStartedAt),
            timeToFirstAudioMs: firstAudioAt ? Math.round(firstAudioAt - t0) : 0,
            durationMs: durationMs,
            providerMs: Number(response.headers.get("x-elo-tts-provider-ms") || 0)
          });
        };
        audio.onerror = function () { reject(new Error("tts_audio_playback_failed")); };
        audio.play().catch(reject);
      });
      return result;
    } catch (error) {
      releaseAudio();
      if (fallbackEnabled) return browserSpeak(cleanText, options);
      return { mode: "text", error: String(error && error.message || error) };
    }
  }

  function stop() {
    releaseAudio();
    if (window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch (error) {}
    }
  }

  function pause() {
    if (currentAudio) currentAudio.pause();
    else if (window.speechSynthesis) window.speechSynthesis.pause();
  }

  function resume() {
    if (currentAudio) return currentAudio.play();
    if (window.speechSynthesis) window.speechSynthesis.resume();
    return Promise.resolve();
  }

  function isSpeaking() {
    return Boolean(currentAudio && !currentAudio.paused) || Boolean(window.speechSynthesis && window.speechSynthesis.speaking);
  }

  function setEnabled(value) {
    enabled = value !== false;
    if (!enabled) stop();
  }

  window.EloVoice = { speak: speak, stop: stop, pause: pause, resume: resume, isSpeaking: isSpeaking, setEnabled: setEnabled };
})();
