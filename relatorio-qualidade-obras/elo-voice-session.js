(function (root) {
  "use strict";
  // Coordinates capture and playback. Conversation, auth, memory and tools stay
  // in the official ELO pipeline supplied by the adapter.
  const transitions = {
    INATIVO: ["ATIVANDO", "ERRO", "ENCERRADO"],
    ATIVANDO: ["OUVINDO", "RECONECTANDO", "PAUSADO", "SEM_PERMISSAO", "ERRO", "ENCERRADO"],
    OUVINDO: ["CAPTURANDO_FALA", "PROCESSANDO", "ATIVANDO", "RECONECTANDO", "PAUSADO", "SEM_PERMISSAO", "ERRO", "ENCERRADO"],
    CAPTURANDO_FALA: ["PROCESSANDO", "ATIVANDO", "RECONECTANDO", "PAUSADO", "SEM_PERMISSAO", "ERRO", "ENCERRADO"],
    PROCESSANDO: ["RESPONDENDO_POR_VOZ", "ATIVANDO", "INTERROMPIDO", "PAUSADO", "ERRO", "ENCERRADO"],
    RESPONDENDO_POR_VOZ: ["ATIVANDO", "INTERROMPIDO", "PAUSADO", "ERRO", "ENCERRADO"],
    INTERROMPIDO: ["ATIVANDO", "PAUSADO", "ERRO", "ENCERRADO"],
    RECONECTANDO: ["ATIVANDO", "PAUSADO", "ERRO", "ENCERRADO"],
    PAUSADO: ["ATIVANDO", "ERRO", "ENCERRADO"],
    SEM_PERMISSAO: ["ATIVANDO", "ERRO", "ENCERRADO"],
    ERRO: ["ATIVANDO", "ENCERRADO"],
    ENCERRADO: ["ATIVANDO", "ERRO"]
  };
  function create(options) {
    const opts = options || {};
    let state = "INATIVO", reason = "", active = false, microphoneActive = false;
    let capture = null, turn = null, sequence = 0, generation = 0;
    let timer = 0, captureTimer = 0, failures = 0, silence = 0, count = 0;
    let responseReadyLatencyMs = null;
    const now = opts.now || Date.now;
    const delay = opts.setTimeout || root.setTimeout.bind(root);
    const clear = opts.clearTimeout || root.clearTimeout.bind(root);
    function snapshot() {
      return { state: state, reason: reason, active: active, microphoneActive: microphoneActive,
        turnId: turn ? turn.id : null, transitions: count, responseReadyLatencyMs: responseReadyLatencyMs };
    }
    function move(next, why) {
      if (next !== state && transitions[state].indexOf(next) < 0) throw new Error("Invalid ELO voice transition: " + state + " -> " + next);
      state = next; reason = why || ""; count += 1;
      if (opts.onState) opts.onState(snapshot());
    }
    function clearTimers() { clear(timer); clear(captureTimer); timer = 0; captureTimer = 0; }
    function releaseCapture() {
      const previous = capture;
      capture = null; microphoneActive = false; clear(captureTimer); captureTimer = 0;
      if (!previous) return;
      ["onstart", "onspeechstart", "onresult", "onerror", "onend"].forEach(function (name) { previous[name] = null; });
      try { if (previous.abort) previous.abort(); else previous.stop(); } catch (_) {}
    }
    function cancelTurn() {
      const previous = turn;
      turn = null;
      if (previous && previous.controller) previous.controller.abort();
      if (opts.cancelTurn) opts.cancelTurn(previous);
    }
    function stopWork() {
      clearTimers(); releaseCapture(); cancelTurn();
      if (opts.stopOutput) opts.stopOutput();
    }
    function fail(code) {
      active = false; generation += 1; stopWork();
      move(code === "not-allowed" || code === "service-not-allowed" ? "SEM_PERMISSAO" : "ERRO", code);
      return false;
    }
    function end(code) {
      active = false; generation += 1; stopWork(); move("ENCERRADO", code || "USER_ENDED"); return true;
    }
    function pause(code) {
      if (!active) return false;
      generation += 1; stopWork(); move("PAUSADO", code || "USER_PAUSED"); return true;
    }
    function laterListen(ms) {
      clear(timer);
      const expected = generation;
      timer = delay(function () { timer = 0; if (active && generation === expected) listen(); }, ms);
    }
    function finishText(text) {
      if (!active) return;
      if (/^(?:elo[, ]*)?(?:encerr[ae]|encerrar|finaliz[ae]|finalizar|parar) (?:a )?(?:conversa|sess[aã]o)(?: por voz| de voz)?[.!]?$/i.test(text)) return end("SPOKEN_END");
      failures = 0; silence = 0;
      const controller = root.AbortController ? new root.AbortController() : null;
      const current = { id: ++sequence, generation: generation, controller: controller, signal: controller && controller.signal, startedAt: now() };
      current.isCurrent = function () { return active && turn === current && generation === current.generation; };
      turn = current;
      move("PROCESSANDO");
      timer = delay(function () { if (current.isCurrent()) fail("TURN_TIMEOUT"); }, 60000);
      try { opts.submit(text, current); } catch (_) { if (current.isCurrent()) fail("SUBMIT_FAILED"); }
    }
    function listen() {
      if (!active) return false;
      if (opts.canListen && !opts.canListen()) return pause("AUDIO_BUSY_OR_HIDDEN");
      clearTimers(); releaseCapture();
      move("ATIVANDO");
      let recognizer;
      try { recognizer = opts.createRecognition(); } catch (_) { return fail("UNSUPPORTED_CAPTURE"); }
      if (!recognizer) return fail("UNSUPPORTED_CAPTURE");
      capture = recognizer;
      const expected = generation, chunks = [];
      let finalSeen = false;
      const current = function () { return active && capture === recognizer && generation === expected; };
      recognizer.lang = "pt-BR"; recognizer.interimResults = true;
      recognizer.continuous = false; recognizer.maxAlternatives = 1;
      recognizer.onstart = function () {
        if (!current()) return;
        clear(timer); timer = 0; microphoneActive = true;
        move("OUVINDO");
        captureTimer = delay(function () { if (current()) pause("CAPTURE_TIME_LIMIT"); }, 45000);
      };
      recognizer.onspeechstart = function () { if (current() && state === "OUVINDO") move("CAPTURANDO_FALA"); };
      recognizer.onresult = function (event) {
        if (!current()) return;
        const results = event && event.results || [];
        for (let index = Number(event.resultIndex) || 0; index < results.length; index += 1) {
          chunks[index] = { text: String(results[index][0] && results[index][0].transcript || "").trim(), final: !!results[index].isFinal };
        }
        const text = chunks.filter(Boolean).map(function (part) { return part.text; }).join(" ").trim();
        if (text && state === "OUVINDO") move("CAPTURANDO_FALA");
        if (opts.onDraft) opts.onDraft(text);
        if (!finalSeen && chunks.some(function (part) { return part && part.final; })) {
          finalSeen = true;
          // Do not speak while a recognizer has failed to release its capture.
          clear(timer);
          timer = delay(function () { if (current()) fail("CAPTURE_DID_NOT_STOP"); }, 2000);
          try { recognizer.stop(); } catch (_) { fail("CAPTURE_DID_NOT_STOP"); }
        }
      };
      recognizer.onend = function () {
        if (!current()) return;
        const text = chunks.filter(function (part) { return part && part.final; }).map(function (part) { return part.text; }).join(" ").trim();
        clearTimers(); releaseCapture();
        if (finalSeen && text) finishText(text);
        else if (++silence >= 3) pause("SILENCE_LIMIT");
        else laterListen(700);
      };
      recognizer.onerror = function (event) {
        if (!current()) return;
        const code = String(event && event.error || "CAPTURE_FAILED");
        clearTimers(); releaseCapture();
        if (code === "no-speech") {
          if (++silence >= 3) pause("SILENCE_LIMIT"); else laterListen(700);
        } else if (code === "network") {
          if (++failures > 3) pause("NETWORK_RETRY_LIMIT");
          else { move("RECONECTANDO", code); laterListen(500 * Math.pow(2, failures)); }
        } else fail(code);
      };
      timer = delay(function () { if (current()) fail("ACTIVATION_TIMEOUT"); }, 10000);
      try { recognizer.start(); } catch (error) { return fail(error && error.name === "NotAllowedError" ? "not-allowed" : "CAPTURE_START_FAILED"); }
      return true;
    }
    function start() {
      if (active) return false;
      const ready = opts.canStart ? opts.canStart() : true;
      if (ready !== true) return fail(typeof ready === "string" ? ready : "DRAFT_OR_SESSION_NOT_READY");
      active = true; generation += 1; failures = 0; silence = 0;
      if (opts.stopOutput) opts.stopOutput();
      try { if (opts.prepareAudio) opts.prepareAudio(); } catch (_) { return fail("AUDIO_FOCUS_UNAVAILABLE"); }
      return listen();
    }
    function resume() {
      if (!active || state !== "PAUSADO") return false;
      const ready = opts.canStart ? opts.canStart() : true;
      if (ready !== true) return fail(typeof ready === "string" ? ready : "DRAFT_OR_SESSION_NOT_READY");
      generation += 1; failures = 0; silence = 0;
      try { if (opts.prepareAudio) opts.prepareAudio(); } catch (_) { return fail("AUDIO_FOCUS_UNAVAILABLE"); }
      return listen();
    }
    function interrupt() {
      if (!active || (state !== "PROCESSANDO" && state !== "RESPONDENDO_POR_VOZ")) return false;
      generation += 1; stopWork(); move("INTERROMPIDO", "USER_INTERRUPTED"); laterListen(250); return true;
    }
    function playbackStarted(token) {
      if (!token || !token.isCurrent() || state !== "PROCESSANDO") return false;
      clear(timer); responseReadyLatencyMs = Math.max(0, now() - token.startedAt);
      move("RESPONDENDO_POR_VOZ");
      timer = delay(function () { if (token.isCurrent()) fail("PLAYBACK_TIME_LIMIT"); }, 180000);
      return true;
    }
    function completed(token, spoken) {
      if (!token || !token.isCurrent() || state !== (spoken ? "RESPONDENDO_POR_VOZ" : "PROCESSANDO")) return false;
      clear(timer); turn = null; laterListen(250); return true;
    }
    return { start: start, end: end, pause: pause, resume: resume, interrupt: interrupt,
      playbackStarted: playbackStarted, playbackEnded: function (token) { return completed(token, true); },
      textReady: function (token) { return completed(token, false); },
      getState: snapshot, getTurn: function () { return turn; } };
  }
  root.EloVoiceSession = { create: create, states: Object.keys(transitions), version: "20261014-voice-session-v1" };
})(typeof window !== "undefined" ? window : globalThis);
