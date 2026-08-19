(function () {
  "use strict";

  const STATE_OFF = "OFF";
  const STATE_WAKE_LISTENING = "WAKE_LISTENING";
  const STATE_WAKE_GRACE_PERIOD = "WAKE_GRACE_PERIOD";
  const STATE_COMMAND_LISTENING = "COMMAND_LISTENING";
  const STATE_DISPATCHING = "DISPATCHING";
  const WAKE_ACK_SILENCE_MS = 1500;
  const COMMAND_TIMEOUT_MS = 8000;
  const RESTART_DELAY_MS = 120;
  const START_WATCHDOG_MS = 1500;
  const WAKE_WORDS = ["elo", "hello"];
  const CANCEL_WORDS = ["cancelar", "cancela"];

  let state = STATE_OFF;
  let recognition = null;
  let recognitionActive = false;
  let recognitionStarted = false;
  let recognitionMode = "";
  let recognitionStopReason = "";
  let stopPending = false;
  let pendingCommandStart = false;
  let commandTimer = null;
  let wakeAckTimer = null;
  let wakeRestartTimer = null;
  let recognitionStartWatchdog = null;
  let commandDelivered = false;
  let manualStop = false;
  let lastError = "";
  let pendingWakeCommand = "";
  const debugEvents = [];

  function recordDebug(event, details) {
    const entry = {
      event: event,
      state: state,
      recognitionMode: recognitionMode,
      recognitionExists: !!recognition,
      recognitionActive: recognitionActive,
      recognitionStarted: recognitionStarted,
      stopPending: stopPending,
      timestamp: new Date().toISOString(),
      details: details || null
    };
    debugEvents.push(entry);
    if (debugEvents.length > 100) debugEvents.shift();
    try {
      if (window.localStorage && window.localStorage.getItem("elo_wake_debug_v1") === "1") console.info("[ELO Wake]", entry);
    } catch (error) {}
  }

  function normalizeTranscript(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function firstToken(text) {
    return normalizeTranscript(text).split(" ").filter(Boolean)[0] || "";
  }

  function isWakeWord(text) {
    const normalized = normalizeTranscript(text);
    return WAKE_WORDS.indexOf(normalized) >= 0;
  }

  function startsWithWakeWord(text) {
    return WAKE_WORDS.indexOf(firstToken(text)) >= 0;
  }

  function extractCommandAfterWake(transcript) {
    const raw = String(transcript || "").trim();
    if (!raw) return "";
    const match = raw.match(/^\s*(?:elo|élo|hello)\b[\s,;:!?.-]*/i);
    if (!match) return "";
    return raw.slice(match[0].length).trim().replace(/^[-,;:!?.\s]+/, "").trim();
  }

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
    if (commandTimer !== null) window.clearTimeout(commandTimer);
    commandTimer = null;
  }

  function clearWakeAckTimer() {
    if (wakeAckTimer !== null) window.clearTimeout(wakeAckTimer);
    wakeAckTimer = null;
  }

  function clearWakeRestartTimer() {
    if (wakeRestartTimer !== null) window.clearTimeout(wakeRestartTimer);
    wakeRestartTimer = null;
  }

  function clearRecognitionStartWatchdog() {
    if (recognitionStartWatchdog !== null) window.clearTimeout(recognitionStartWatchdog);
    recognitionStartWatchdog = null;
  }

  function startCommandTimeout() {
    clearCommandTimer();
    commandTimer = window.setTimeout(function () {
      if (state !== STATE_COMMAND_LISTENING) return;
      enterWakeListening("Diga ELO para chamar.");
    }, COMMAND_TIMEOUT_MS);
  }

  function scheduleWakeRestart(reason) {
    if (manualStop || state !== STATE_WAKE_LISTENING) return;
    clearWakeRestartTimer();
    recordDebug("restart_scheduled", { reason: reason || "wake" });
    wakeRestartTimer = window.setTimeout(function () {
      wakeRestartTimer = null;
      if (manualStop || state !== STATE_WAKE_LISTENING) return;
      startRecognitionForWake();
    }, RESTART_DELAY_MS);
  }

  function scheduleRecognitionStartWatchdog(mode) {
    clearRecognitionStartWatchdog();
    recognitionStartWatchdog = window.setTimeout(function () {
      recognitionStartWatchdog = null;
      if (manualStop || state === STATE_OFF || recognitionStarted || !recognitionActive || stopPending) return;
      const expectedMode = mode || recognitionMode || "wake";
      recordDebug("start_watchdog_restart", { mode: expectedMode });
      recognitionActive = false;
      try { if (recognition && typeof recognition.stop === "function") recognition.stop(); } catch (error) {}
      if (state === STATE_WAKE_LISTENING) scheduleWakeRestart("start_watchdog");
      if (state === STATE_COMMAND_LISTENING) window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
    }, START_WATCHDOG_MS);
  }

  function safeRecognitionStart(mode) {
    if (!recognition || state === STATE_OFF || recognitionActive || stopPending) return false;
    try {
      recognition.start();
      recognitionActive = true;
      recognitionStarted = false;
      recognitionMode = mode || recognitionMode || "wake";
      recognitionStopReason = "";
      stopPending = false;
      recordDebug("start_called", { mode: recognitionMode });
      scheduleRecognitionStartWatchdog(recognitionMode);
      return true;
    } catch (error) {
      const message = String(error && (error.name || error.message) || error || "");
      lastError = message;
      recordDebug(/InvalidStateError|already started|recognition has already started/i.test(message) ? "start_invalid_state" : "start_failed", { message: message, mode: mode || recognitionMode });
      return false;
    }
  }

  function safeRecognitionStop(reason) {
    if (!recognition || (!recognitionActive && !stopPending)) return;
    recognitionStopReason = reason || "controlled";
    stopPending = true;
    try {
      recognition.stop();
      recordDebug("stop_called", { mode: recognitionMode, reason: recognitionStopReason });
    } catch (error) {
      recognitionActive = false;
      recognitionStarted = false;
      stopPending = false;
      clearRecognitionStartWatchdog();
      recordDebug("stop_failed", { message: String(error && (error.name || error.message) || error || ""), reason: recognitionStopReason });
    }
  }

  function startRecognitionForWake() {
    if (state !== STATE_WAKE_LISTENING || manualStop) return;
    pendingCommandStart = false;
    if (!safeRecognitionStart("wake")) scheduleWakeRestart("start_failed");
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

  function beginCommandListening() {
    if (manualStop || state !== STATE_WAKE_GRACE_PERIOD) return;
    state = STATE_COMMAND_LISTENING;
    commandDelivered = false;
    pendingWakeCommand = "";
    setStatus("Pode falar.");
    updateToggle();
    if (recognitionActive && !stopPending) {
      recognitionMode = "command";
      startCommandTimeout();
      return;
    }
    startRecognitionForCommand();
  }

  function scheduleWakePrompt() {
    clearWakeAckTimer();
    recordDebug("wake_grace_scheduled", { delay: WAKE_ACK_SILENCE_MS });
    wakeAckTimer = window.setTimeout(function () {
      wakeAckTimer = null;
      if (manualStop || state !== STATE_WAKE_GRACE_PERIOD || pendingWakeCommand) return;
      beginCommandListening();
    }, WAKE_ACK_SILENCE_MS);
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
    clearWakeAckTimer();
    clearWakeRestartTimer();
    pendingCommandStart = false;
    pendingWakeCommand = "";
    commandDelivered = false;
    setStatus(message || "Diga ELO para chamar.");
    updateToggle();
    if (!recognitionActive && !stopPending) startRecognitionForWake();
  }

  function enterWakeGracePeriod() {
    if (manualStop || state !== STATE_WAKE_LISTENING) return;
    state = STATE_WAKE_GRACE_PERIOD;
    clearCommandTimer();
    clearWakeRestartTimer();
    pendingWakeCommand = "";
    commandDelivered = false;
    setStatus("Ouvindo...");
    updateToggle();
    recordDebug("wake_grace_started", { delay: WAKE_ACK_SILENCE_MS });
    scheduleWakePrompt();
  }

  function completeCommand(transcript) {
    const command = String(transcript || "").trim();
    if (!command || commandDelivered) return;
    commandDelivered = true;
    state = STATE_DISPATCHING;
    clearCommandTimer();
    clearWakeAckTimer();
    pendingWakeCommand = "";
    safeRecognitionStop("dispatch");
    enterWakeListening("Diga ELO para chamar.");
    recordDebug("dispatch", { command: command });
    dispatchCommand(command);
  }

  function cancelCommand() {
    commandDelivered = true;
    clearCommandTimer();
    clearWakeAckTimer();
    safeRecognitionStop("cancel");
    enterWakeListening("Comando cancelado. Diga ELO para chamar.");
  }

  function handleWakeListeningTranscript(transcript, normalized, isFinal) {
    const commandAfterWake = extractCommandAfterWake(transcript);
    const wakeAtStart = startsWithWakeWord(transcript);
    const wakeOnly = isWakeWord(normalized);
    recordDebug("wake_analysis", { rawTranscript: String(transcript || ""), commandAfterWake: commandAfterWake, wakeAtStart: wakeAtStart, wakeOnly: wakeOnly, isFinal: isFinal === true });
    if (commandAfterWake) {
      if (isFinal) completeCommand(commandAfterWake);
      else {
        pendingWakeCommand = commandAfterWake;
        enterWakeGracePeriod();
        clearWakeAckTimer();
      }
      return;
    }
    if (wakeAtStart || wakeOnly) enterWakeGracePeriod();
  }

  function handleWakeGraceTranscript(transcript, normalized, isFinal) {
    let command = extractCommandAfterWake(transcript);
    const raw = String(transcript || "").trim();
    if (!command && raw && !isWakeWord(normalized) && normalizeTranscript(raw) !== "diga") command = raw;
    if (!command) return;
    pendingWakeCommand = command;
    clearWakeAckTimer();
    recordDebug("wake_grace_command", { command: command, isFinal: isFinal === true });
    if (isFinal) completeCommand(command);
  }

  function handleTranscript(transcript, isFinal) {
    const normalized = normalizeTranscript(transcript);
    if (!normalized) return;
    const commandAfterWake = extractCommandAfterWake(transcript);
    recordDebug("onresult", {
      rawTranscript: String(transcript || ""),
      normalized: normalized,
      wakeMatch: isWakeWord(normalized) || startsWithWakeWord(transcript),
      commandAfterWake: commandAfterWake,
      isFinal: isFinal === true
    });

    if (state === STATE_WAKE_LISTENING) {
      handleWakeListeningTranscript(transcript, normalized, isFinal);
      return;
    }
    if (state === STATE_WAKE_GRACE_PERIOD) {
      handleWakeGraceTranscript(transcript, normalized, isFinal);
      return;
    }
    if (state === STATE_COMMAND_LISTENING && isFinal) {
      if (normalizeTranscript(transcript) === "diga") return;
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

  function handleRecognitionEnd() {
    const endedMode = recognitionMode;
    const endedReason = recognitionStopReason;
    recognitionActive = false;
    recognitionStarted = false;
    stopPending = false;
    recognitionMode = "";
    recognitionStopReason = "";
    clearRecognitionStartWatchdog();
    recordDebug("onend", { mode: endedMode, reason: endedReason });

    if (manualStop || state === STATE_OFF) return;
    if (state === STATE_WAKE_GRACE_PERIOD) return;
    if (pendingCommandStart && state === STATE_COMMAND_LISTENING) {
      window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
      return;
    }
    if (state === STATE_COMMAND_LISTENING && !commandDelivered) {
      window.setTimeout(startRecognitionForCommand, RESTART_DELAY_MS);
      return;
    }
    if (state === STATE_WAKE_LISTENING) scheduleWakeRestart("onend");
  }

  function createRecognition() {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) return null;
    const instance = new Recognition();
    instance.lang = "pt-BR";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onstart = function () {
      recognitionActive = true;
      recognitionStarted = true;
      stopPending = false;
      clearRecognitionStartWatchdog();
      recordDebug("onstart", { mode: recognitionMode });
    };
    instance.onresult = handleResult;
    instance.onerror = function (event) {
      lastError = event && event.error ? String(event.error) : "speech_recognition_error";
      recordDebug("onerror", { error: lastError });
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
    debugEvents.length = 0;
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
    clearWakeAckTimer();
    clearWakeRestartTimer();
    clearRecognitionStartWatchdog();
    state = STATE_OFF;
    pendingCommandStart = false;
    pendingWakeCommand = "";
    commandDelivered = false;
    safeRecognitionStop("manual");
    recognition = null;
    recognitionActive = false;
    recognitionStarted = false;
    stopPending = false;
    recognitionMode = "";
    recognitionStopReason = "";
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
    getDebugForTest: function () { return debugEvents.slice(); },
    getRuntimeForTest: function () { return { state: state, recognitionExists: !!recognition, recognitionActive: recognitionActive, recognitionStarted: recognitionStarted, recognitionMode: recognitionMode, stopPending: stopPending, pendingWakeCommand: pendingWakeCommand, lastError: lastError }; },
    extractCommandAfterWakeForTest: extractCommandAfterWake,
    handleTranscriptForTest: handleTranscript,
    normalizeTranscriptForTest: normalizeTranscript,
    isWakeWordForTest: isWakeWord
  };
})();
