(function () {
  "use strict";

  const STATE_OFF = "OFF";
  const STATE_WAKE_LISTENING = "WAKE_LISTENING";
  const STATE_COMMAND_LISTENING = "COMMAND_LISTENING";
  const COMMAND_TIMEOUT_MS = 8000;
  const RESTART_DELAY_MS = 120;
  const WAKE_WORDS = ["elo", "hello"];
  const CANCEL_WORDS = ["cancelar", "cancela"];

  let state = STATE_OFF;
  let recognition = null;
  let commandTimer = null;
  let restartingAfterSpeech = false;
  let manualStop = false;
  let lastError = "";

  function normalizeTranscript(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasExactWord(text, words) {
    const tokens = normalizeTranscript(text).split(" ").filter(Boolean);
    return words.some(function (word) { return tokens.indexOf(word) >= 0; });
  }

  function isWakeWord(text) { return hasExactWord(text, WAKE_WORDS); }

  function isCancelCommand(text) {
    return CANCEL_WORDS.indexOf(normalizeTranscript(text)) >= 0;
  }

  function getRecognitionConstructor() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function setStatus(message) {
    const statusEl = document.querySelector("[data-elo-wake-status]");
    if (statusEl) statusEl.textContent = message || "";
  }

  function updateToggle() {
    const button = document.querySelector("[data-elo-wake-toggle]");
    if (!button) return;
    const active = state !== STATE_OFF;
    button.setAttribute("aria-pressed", active ? "true" : "false");
    button.textContent = active ? "● ELO ativo" : "○ ELO inativo";
    button.dataset.eloWakeState = state;
    button.title = state === STATE_COMMAND_LISTENING ? "ELO ouvindo o proximo comando" : (active ? "Desativar ELO por voz" : "Ativar ELO por voz");
  }

  function clearCommandTimer() {
    if (commandTimer) window.clearTimeout(commandTimer);
    commandTimer = null;
  }

  function startCommandTimeout() {
    clearCommandTimer();
    commandTimer = window.setTimeout(function () {
      if (state === STATE_COMMAND_LISTENING) {
        state = STATE_WAKE_LISTENING;
        setStatus("ELO ativo. Diga ELO para chamar.");
        updateToggle();
      }
    }, COMMAND_TIMEOUT_MS);
  }

  function safeRecognitionStart() {
    if (!recognition || state === STATE_OFF) return;
    try {
      recognition.start();
    } catch (error) {
      if (!/already started|recognition has already started/i.test(String(error && error.message || ""))) {
        lastError = String(error && error.message || error || "");
      }
    }
  }

  function safeRecognitionStop() {
    if (!recognition) return;
    try { recognition.stop(); } catch (error) {}
  }

  function restartRecognitionSoon() {
    if (manualStop || restartingAfterSpeech || state === STATE_OFF) return;
    window.setTimeout(safeRecognitionStart, RESTART_DELAY_MS);
  }

  function speakWakeGreeting() {
    restartingAfterSpeech = true;
    safeRecognitionStop();

    function resume() {
      restartingAfterSpeech = false;
      if (state === STATE_COMMAND_LISTENING) safeRecognitionStart();
    }

    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!synth || !Utterance) {
      resume();
      return;
    }

    try {
      const utterance = new Utterance("Oi");
      utterance.lang = "pt-BR";
      utterance.rate = 1;
      utterance.onend = resume;
      utterance.onerror = resume;
      synth.cancel();
      synth.speak(utterance);
      window.setTimeout(function () { if (restartingAfterSpeech) resume(); }, 900);
    } catch (error) {
      resume();
    }
  }

  function dispatchCommand(transcript) {
    const command = String(transcript || "").trim();
    if (!command) return false;
    if (window.EloAssistente && typeof window.EloAssistente.ask === "function") {
      window.EloAssistente.ask(command);
      return true;
    }
    if (typeof window.askElo === "function") {
      window.askElo(command);
      return true;
    }
    lastError = "Fluxo central do ELO indisponivel.";
    setStatus(lastError);
    return false;
  }

  function enterWakeListening(message) {
    state = STATE_WAKE_LISTENING;
    clearCommandTimer();
    setStatus(message || "ELO ativo. Diga ELO para chamar.");
    updateToggle();
  }

  function enterCommandListening() {
    state = STATE_COMMAND_LISTENING;
    setStatus("ELO ouvindo comando...");
    updateToggle();
    startCommandTimeout();
    speakWakeGreeting();
  }

  function handleTranscript(transcript, isFinal) {
    const normalized = normalizeTranscript(transcript);
    if (!normalized || restartingAfterSpeech) return;
    if (state === STATE_WAKE_LISTENING) {
      if (isWakeWord(normalized)) enterCommandListening();
      return;
    }
    if (state === STATE_COMMAND_LISTENING && isFinal) {
      if (isCancelCommand(normalized)) {
        enterWakeListening("Comando cancelado. Diga ELO para chamar.");
        return;
      }
      clearCommandTimer();
      dispatchCommand(transcript);
      enterWakeListening("ELO ativo. Diga ELO para chamar.");
    }
  }

  function handleResult(event) {
    const results = event && event.results ? event.results : [];
    for (let index = event.resultIndex || 0; index < results.length; index += 1) {
      const result = results[index];
      const transcript = result && result[0] ? result[0].transcript : "";
      handleTranscript(transcript, result && result.isFinal === true);
    }
  }

  function createRecognition() {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return null;
    const instance = new Recognition();
    instance.lang = "pt-BR";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = handleResult;
    instance.onerror = function (event) {
      lastError = event && event.error ? String(event.error) : "speech_recognition_error";
      if (lastError === "not-allowed" || lastError === "service-not-allowed") {
        stop();
        setStatus("Permissao do microfone necessaria para ativar o ELO por voz.");
      }
    };
    instance.onend = restartRecognitionSoon;
    return instance;
  }

  function start() {
    if (state !== STATE_OFF) return true;
    lastError = "";
    recognition = createRecognition();
    if (!recognition) {
      lastError = "Reconhecimento de voz indisponivel neste navegador.";
      setStatus(lastError);
      updateToggle();
      return false;
    }
    manualStop = false;
    enterWakeListening();
    safeRecognitionStart();
    return true;
  }

  function stop() {
    manualStop = true;
    clearCommandTimer();
    state = STATE_OFF;
    restartingAfterSpeech = false;
    safeRecognitionStop();
    recognition = null;
    setStatus("");
    updateToggle();
  }

  function isActive() { return state !== STATE_OFF; }
  function isListeningForCommand() { return state === STATE_COMMAND_LISTENING; }

  function bindToggle() {
    const button = document.querySelector("[data-elo-wake-toggle]");
    if (!button || button.dataset.eloWakeBound) return;
    button.dataset.eloWakeBound = "true";
    button.addEventListener("click", function () { if (isActive()) stop(); else start(); });
    updateToggle();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindToggle);
  else bindToggle();

  window.EloWakeWord = {
    start: start,
    stop: stop,
    isActive: isActive,
    isListeningForCommand: isListeningForCommand,
    getLastErrorForTest: function () { return lastError; },
    getStateForTest: function () { return state; },
    handleTranscriptForTest: handleTranscript,
    normalizeTranscriptForTest: normalizeTranscript,
    isWakeWordForTest: isWakeWord
  };
})();
