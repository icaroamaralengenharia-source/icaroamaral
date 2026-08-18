(function () {
  "use strict";

  const STATE_OFF = "OFF";
  const STATE_WAKE_LISTENING = "WAKE_LISTENING";
  const STATE_ACKNOWLEDGING = "ACKNOWLEDGING";
  const STATE_COMMAND_LISTENING = "COMMAND_LISTENING";
  const COMMAND_TIMEOUT_MS = 8000;
  const RESTART_DELAY_MS = 120;
  const ACK_TEXT = "Oi! Pode falar.";
  const WAKE_WORDS = ["elo", "hello"];
  const CANCEL_WORDS = ["cancelar", "cancela"];

  let state = STATE_OFF;
  let recognition = null;
  let recognitionActive = false;
  let recognitionMode = "";
  let stopPending = false;
  let pendingCommandStart = false;
  let commandTimer = null;
  let commandDelivered = false;
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
    button.textContent = state === STATE_COMMAND_LISTENING ? "● ELO ouvindo..." : (active ? "● ELO ativo" : "○ ELO inativo");
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
      if (state !== STATE_COMMAND_LISTENING) return;
      enterWakeListening("Diga ELO para chamar.");
    }, COMMAND_TIMEOUT_MS);
  }

  function safeRecognitionStart(mode) {
    if (!recognition || state === STATE_OFF || recognitionActive) return false;
    try {
      recognition.start();
      recognitionActive = true;
      recognitionMode = mode || recognitionMode || "wake";
      stopPending = false;
      return true;
    } catch (error) {
      const message = String(error && (error.name || error.message) || error || "");
      if (/InvalidStateError|already started|recognition has already started/i.test(message)) {
        lastError = message;
        return false;
      }
      lastError = message;
      setStatus("Nao consegui ativar o reconhecimento de voz.");
      return false;
    }
  }

  function safeRecognitionStop() {
    if (!recognition || (!recognitionActive && !stopPending)) return;
    stopPending = true;
    try { recognition.stop(); } catch (error) { recognitionActive = false; stopPending = false; }
  }

  function startRecognitionForWake() {
    if (state !== STATE_WAKE_LISTENING || manualStop) return;
    pendingCommandStart = false;
    safeRecognitionStart("wake");
  }

  function startRecognitionForCommand() {
    if (state !== STATE_COMMAND_LISTENING || manualStop || !recognition) return;
    if (recognitionActive || stopPending) {
      pendingCommandStart = true;
      return;
    }
    pendingCommandStart = false;
    commandDelivered = false;
    if (safeRecognitionStart("command")) {
      setStatus("Pode falar.");
      updateToggle();
      startCommandTimeout();
      return;
    }
    pendingCommandStart = true;
    window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
  }

  function handleRecognitionEnd() {
    recognitionActive = false;
    stopPending = false;
    recognitionMode = "";

    if (manualStop || state === STATE_OFF) return;
    if (pendingCommandStart && state === STATE_COMMAND_LISTENING) {
      window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
      return;
    }
    if (state === STATE_COMMAND_LISTENING && !commandDelivered) {
      window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
      return;
    }
    if (state === STATE_WAKE_LISTENING) {
      window.setTimeout(startRecognitionForWake, RESTART_DELAY_MS);
    }
  }

  function beginCommandListening() {
    if (manualStop || state !== STATE_ACKNOWLEDGING) return;
    state = STATE_COMMAND_LISTENING;
    commandDelivered = false;
    setStatus("Pode falar.");
    updateToggle();
    startRecognitionForCommand();
  }

  function speakWakeGreeting() {
    const synth = window.speechSynthesis;
    const Utterance = window.SpeechSynthesisUtterance;
    if (!synth || !Utterance) {
      beginCommandListening();
      return;
    }

    try {
      const utterance = new Utterance(ACK_TEXT);
      utterance.lang = "pt-BR";
      utterance.rate = 1;
      utterance.onend = beginCommandListening;
      utterance.onerror = beginCommandListening;
      synth.cancel();
      synth.speak(utterance);
    } catch (error) {
      beginCommandListening();
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
    pendingCommandStart = false;
    commandDelivered = false;
    setStatus(message || "Diga ELO para chamar.");
    updateToggle();
    if (!recognitionActive && !stopPending) startRecognitionForWake();
  }

  function enterAcknowledging() {
    state = STATE_ACKNOWLEDGING;
    clearCommandTimer();
    pendingCommandStart = false;
    commandDelivered = false;
    setStatus("Pode falar.");
    updateToggle();
    safeRecognitionStop();
    speakWakeGreeting();
  }

  function completeCommand(transcript) {
    if (commandDelivered) return;
    commandDelivered = true;
    clearCommandTimer();
    safeRecognitionStop();
    const command = String(transcript || "").trim();
    enterWakeListening("Diga ELO para chamar.");
    dispatchCommand(command);
  }

  function cancelCommand() {
    commandDelivered = true;
    clearCommandTimer();
    safeRecognitionStop();
    enterWakeListening("Comando cancelado. Diga ELO para chamar.");
  }

  function handleTranscript(transcript, isFinal) {
    const normalized = normalizeTranscript(transcript);
    if (!normalized || state === STATE_ACKNOWLEDGING) return;
    if (state === STATE_WAKE_LISTENING) {
      if (isWakeWord(normalized)) enterAcknowledging();
      return;
    }
    if (state === STATE_COMMAND_LISTENING && isFinal) {
      if (isCancelCommand(normalized)) cancelCommand();
      else completeCommand(transcript);
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
    instance.onend = handleRecognitionEnd;
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
    return true;
  }

  function stop() {
    manualStop = true;
    clearCommandTimer();
    state = STATE_OFF;
    pendingCommandStart = false;
    commandDelivered = false;
    safeRecognitionStop();
    recognition = null;
    recognitionActive = false;
    stopPending = false;
    recognitionMode = "";
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
    getRecognitionModeForTest: function () { return recognitionMode; },
    handleTranscriptForTest: handleTranscript,
    normalizeTranscriptForTest: normalizeTranscript,
    isWakeWordForTest: isWakeWord
  };
})();
