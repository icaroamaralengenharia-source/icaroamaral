(function () {
  "use strict";
  if (location.origin !== "https://www.icaroamaral.com.br" || location.pathname !== "/elo.html" || window.top !== window) return;
  if (window.EloNativeBrain) return;
  let port = null, sequence = 0, state = { state: "WAKE_DISABLED", enabled: false, owner: "NONE" }, syncing = false, syncAgain = false, mounting = false, activationPending = false, activationRequested = false;
  let boundScope = null, clearingContext = false, readingControl = null, lastTranscript = "", lastTranscriptFinal = false;
  let activeMusic = null, ownsMusicConfirmation = false;
  let controlPending = "";
  const pending = new Map();
  const api = () => window.EloAssistente;
  function request(type, payload) {
    if (!port) return Promise.reject(new Error("Abra novamente o ELO para conectar a voz."));
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error("A conexão de voz não respondeu.")); }, 20000);
      pending.set(id, { resolve, reject, timer });
      port.postMessage(JSON.stringify({ id, type, payload }));
    });
  }
  function notice(text) {
    const el = document.querySelector(".elo-voice-status");
    if (el && el.textContent !== text) el.textContent = text;
  }
  function finishReadingControl() {
    if (!readingControl) return;
    readingControl.dataset.eloSpeechState = "idle";
    readingControl.textContent = "Ouvir";
    readingControl.setAttribute("aria-pressed", "false");
    readingControl = null;
  }
  function mount() {
    if (mounting || !window.document?.body) return;
    mounting = true;
    try {
      const form = document.querySelector(".elo-input-row");
      if (!form) return;
      let button = document.querySelector(".elo-voice-mode-button");
      if (!button) {
        let group = document.querySelector(".elo-native-voice-controls");
        if (!group) { group = document.createElement("div"); group.className = "elo-native-voice-controls"; form.after(group); }
        button = document.createElement("button"); button.type = "button"; button.className = "elo-inline-button elo-voice-mode-button"; group.append(button);
        const status = document.createElement("span"); status.className = "elo-voice-status"; status.setAttribute("role", "status"); group.append(status);
      }
      const label = state.enabled ? "Desativar assistente" : activationPending ? "Ativando chamado ELO…" : "Ativar chamado ELO";
      if (button.textContent !== label) button.textContent = label;
      button.disabled = !state.enabled && activationPending;
      button.setAttribute("aria-busy", String(!state.enabled && activationPending));
      button.setAttribute("aria-pressed", String(!!state.enabled));
      let end = document.querySelector(".elo-native-end-conversation");
      if (!end) { end = document.createElement("button"); end.type = "button"; end.className = "elo-inline-button elo-native-end-conversation"; end.textContent = "Encerrar conversa"; button.after(end); }
      end.hidden = !state.enabled || state.state === "WAKE_LISTENING";
      document.body.dataset.eloNativeVoiceState = state.state;
      document.body.dataset.eloNativeMicOwner = state.owner;
      const labels = { WAKE_DISABLED: "Chamado ELO desativado.", WAKE_LISTENING: "Aguardando você chamar ELO.", WAKE_DETECTED: "ELO chamado.", BRAIN_LISTENING: "Ouvindo. Você pode falar.", PROCESSING: "Preparando a resposta.", BRAIN_SPEAKING: "Respondendo por voz. Toque no microfone para interromper.", BRAIN_ENDING: "Encerrando a conversa.", RETURN_TO_WAKE: "Voltando a aguardar ELO.", SUSPENDED: "Escuta suspensa. Toque em Retomar chamado." };
      if (activationPending && !state.enabled) notice("Preparando o chamado ELO…");
      else if (state.reason && state.state === "WAKE_DISABLED" && !["EXPLICIT_DISABLE", "SERVICE_DESTROYED"].includes(state.reason))
        notice("Voz indisponível (" + state.reason + "). Abra o ELO e verifique a sessão e as permissões.");
      else if (state.reason === "CAPTURE_STARTING") notice("Abrindo microfone. Aguarde…");
      else if (state.reason === "CAPTURE_RELEASING") notice("Finalizando escuta…");
      else if (["NO_SPEECH_RETRY", "SILENCE_RETRY", "CAPTURE_WATCHDOG_RETRY"].includes(state.reason)) notice("Reabrindo o microfone…");
      else notice(labels[state.state] || "Preparando chamado ELO.");
      let resume = document.querySelector(".elo-native-resume-wake");
      if (!resume) { resume = document.createElement("button"); resume.type = "button"; resume.className = "elo-inline-button elo-native-resume-wake"; resume.textContent = "Retomar chamado"; end.after(resume); }
      resume.hidden = state.state !== "SUSPENDED";
      let actions = document.querySelector(".elo-native-conversation-actions");
      if (!actions) {
        actions = document.createElement("div"); actions.className = "elo-native-conversation-actions";
        actions.setAttribute("role", "group"); actions.setAttribute("aria-label", "Controles da conversa");
        button.after(actions); actions.append(resume, end);
        const icon = path => '<svg class="elo-native-control-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="' + path + '"></path></svg><span></span>';
        resume.innerHTML = icon("M8 5v14l11-7z"); end.innerHTML = icon("M6 6h12v12H6z");
      }
      actions.hidden = end.hidden && resume.hidden;
      for (const [el, key, label, busyLabel] of [[resume, "resume", "Retomar chamado", "Retomando…"], [end, "end", "Encerrar conversa", "Encerrando…"]]) {
        const pending = controlPending === key, text = pending ? busyLabel : label;
        if (el.querySelector("span").textContent !== text) el.querySelector("span").textContent = text;
        el.setAttribute("aria-label", label); el.setAttribute("aria-busy", String(pending));
        el.disabled = !!controlPending;
      }
      let transcript = document.querySelector(".elo-native-transcript");
      if (!transcript) {
        transcript = document.createElement("div"); transcript.className = "elo-native-transcript";
        transcript.style.cssText = "max-height:2.8em;overflow:auto;font-size:14px;line-height:1.35;margin:4px 8px;max-width:calc(100% - 16px);flex-shrink:0;overflow-wrap:anywhere;color:#244a68";
        const status = document.querySelector(".elo-voice-status");
        if (status) status.before(transcript); else resume.after(transcript);
      }
      transcript.hidden = !lastTranscript;
      const transcriptLabel = lastTranscript ? "Você: " + lastTranscript : "";
      if (transcript.textContent !== transcriptLabel) transcript.textContent = transcriptLabel;
      const mic = document.querySelector(".elo-mic-button");
      if (mic && state.enabled) {
        mic.classList.toggle("is-listening", state.owner === "BRAIN");
        mic.setAttribute("aria-label", state.state === "BRAIN_SPEAKING" ? "Interromper resposta" : "Controles da conversa ELO");
      }
    } finally { mounting = false; }
  }
  async function context() {
    const a = api();
    if (!a || !document.body.classList.contains("elo-authenticated")) throw new Error("Entre no ELO antes de ativar o chamado.");
    if (a.exportNativeVoiceContext) return a.exportNativeVoiceContext();
    // Compatibility with the currently published official client; no storage keys or refresh token are exported.
    const accessToken = await a.getValidAccessTokenForTest?.();
    const identity = a.getCoreIdentityForTest?.();
    const conversationId = a.getCurrentConversationIdForTest?.() || await a.ensureCoreConversationForTest?.();
    if (!accessToken || !identity?.userId || !conversationId) throw new Error("A sessão precisa ser confirmada no ELO.");
    return { accessToken, identity, conversationId, neuralVoice: { voice: String(window.ELO_TTS_VOICE || "") }, chatContext: {
      currentConversationId: conversationId, source: "elo", mode: "standalone",
      memoryScope: a.getTemporaryMemoryScopeForTest?.() ? "CONVERSATION_ONLY" : ""
    } };
  }
  async function activate() {
    if (activationPending) return;
    activationPending = true;
    activationRequested = false;
    mount();
    const a = api(), draft = document.querySelector(".elo-input");
    try {
      if (draft?.value.trim()) throw new Error("Envie ou resolva o rascunho antes de ativar o chamado.");
      a?.endVoiceSessionForTest?.();
      a?.setVoiceModeEnabledForTest?.(false);
      a?.stopVoiceInputForTest?.();
      a?.stopSpeechOutputForTest?.();
      const deadline = Date.now() + 2500;
      while (document.querySelector(".elo-mic-button.is-listening") && Date.now() < deadline)
        await new Promise(resolve => setTimeout(resolve, 100));
      if (document.querySelector(".elo-mic-button.is-listening")) throw new Error("Aguarde o microfone anterior parar.");
      const c = await context();
      const prepared = await request("CONTEXT", c);
      if (!prepared.ok) throw new Error("Sessão de voz não confirmada (" + prepared.code + ").");
      boundScope = { userId: c.identity.userId, conversationId: c.conversationId };
      activationRequested = true;
      const armed = await request("ACTIVATE");
      if (!armed.ok) throw new Error("Confirme as permissões no ELO e toque novamente para ativar.");
    } catch (error) {
      activationPending = false;
      activationRequested = false;
      mount();
      throw error;
    }
  }
  async function syncCanonicalHistory() {
    if (document.visibilityState !== "visible") return;
    if (syncing) { syncAgain = true; return; }
    const a = api();
    if (!a?.getCurrentConversationIdForTest || !a?.replayCoreMessagesForTest) return;
    const conversation = a.getCurrentConversationIdForTest();
    if (!conversation) return;
    syncing = true;
    try {
      const token = await a.getValidAccessTokenForTest?.();
      if (!token) return;
      const identity = a.getCoreIdentityForTest?.() || {};
      const response = await fetch("https://obrareport-backend.onrender.com/api/elo/conversations/" + encodeURIComponent(conversation) + "?" + new URLSearchParams(identity),
        { headers: { Authorization: "Bearer " + token }, redirect: "error" });
      if (!response.ok) return;
      const data = await response.json();
      if (data.conversation?.id !== conversation || a.getCurrentConversationIdForTest() !== conversation || !Array.isArray(data.messages)) return;
      const area = document.querySelector(".elo-messages"), input = document.querySelector(".elo-input");
      const draft = input?.value || "", top = area?.scrollTop || 0;
      const atEnd = !area || area.scrollHeight - area.clientHeight - area.scrollTop < 40;
      a.replayCoreMessagesForTest(data.messages); // Existing replay suppresses remote persistence.
      if (input && input.value !== draft) { input.value = draft; input.dispatchEvent(new Event("input", { bubbles: true })); }
      requestAnimationFrame(() => { if (area) area.scrollTop = atEnd ? area.scrollHeight : top; });
    } finally {
      syncing = false;
      if (syncAgain) { syncAgain = false; syncCanonicalHistory().catch(() => {}); }
    }
  }
  document.addEventListener("click", event => {
    const control = event.target.closest?.(".elo-voice-mode-button,.elo-native-end-conversation,.elo-native-resume-wake,.elo-mic-button,.elo-speech-button");
    if (!control) return;
    if (control.matches(".elo-speech-button")) {
      if (state.enabled) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.isTrusted) return;
        if (readingControl === control && state.reason === "MANUAL_READING" && state.state === "BRAIN_SPEAKING") {
          request("END").catch(error => notice(error.message)); return;
        }
        finishReadingControl(); readingControl = control;
        request("READ_MESSAGE", { text: String(control.dataset.eloSpeechText || "").slice(0, 12000) })
          .then(result => { if (!result.ok) throw new Error("Não foi possível ouvir a mensagem agora."); })
          .catch(error => { finishReadingControl(); notice(error.message); });
      }
      return;
    }
    if (control.matches(".elo-mic-button") && !state.enabled) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.isTrusted) return;
    const pendingKey = control.matches(".elo-native-end-conversation") ? "end" : control.matches(".elo-native-resume-wake") ? "resume" : "";
    if (pendingKey && controlPending) return;
    if (pendingKey) { controlPending = pendingKey; mount(); }
    const operation = control.matches(".elo-native-end-conversation") ? request("END") :
      control.matches(".elo-native-resume-wake") ? request("RESUME_WAKE") :
      control.matches(".elo-mic-button") ?
        (["PROCESSING", "BRAIN_SPEAKING"].includes(state.state) ? request("INTERRUPT") :
          state.state === "WAKE_LISTENING" ? Promise.resolve(notice("Diga ELO para começar a conversa.")) : request("END")) :
      state.enabled ? request("DISABLE") : activate();
    Promise.resolve(operation).catch(error => notice(error.message)).finally(() => { if (pendingKey) { controlPending = ""; mount(); } });
  }, true);
  document.addEventListener("input", event => {
    if (state.enabled && event.target.matches?.(".elo-input") && event.target.value.trim()) request("SUSPEND").catch(() => {});
  }, true);
  function onResume() {
    if (document.visibilityState !== "visible") return;
    request("STATUS").catch(() => {});
    if (!document.body.classList.contains("elo-authenticated")) { request("CLEAR_CONTEXT").catch(() => {}); return; }
    if (state.enabled) context().then(async c => {
      const result = await request("CONTEXT", c);
      if (result.ok) boundScope = { userId: c.identity.userId, conversationId: c.conversationId };
    }).catch(() => request("CLEAR_CONTEXT").catch(() => {}));
    syncCanonicalHistory().catch(() => notice("Não foi possível sincronizar o histórico agora."));
  }
  function checkVisibleScope() {
    if (!window.document?.body || !port || !state.enabled || clearingContext || document.visibilityState !== "visible") return;
    const a = api(), identity = a?.getCoreIdentityForTest?.();
    const conversation = a?.getCurrentConversationIdForTest?.();
    if (!document.body.classList.contains("elo-authenticated") || boundScope &&
        (identity?.userId !== boundScope.userId || conversation !== boundScope.conversationId)) {
      clearingContext = true; boundScope = null;
      request("CLEAR_CONTEXT").finally(() => { clearingContext = false; }).catch(() => {});
    }
  }
  const musicPlayer = () => window.EloMediaPlayer?.getSource?.() || window.EloMediaPlayer;
  function musicStatus() { return musicPlayer()?.getPlaybackStatus?.() || {}; }
  function musicCurrent(op) {
    return activeMusic === op && state.enabled && state.state === "PROCESSING" &&
      state.generation === op.generation && state.turn === op.turn;
  }
  function clearMusicConfirmation() {
    if (ownsMusicConfirmation) api()?.clearPendingMusicCandidateForTest?.();
    ownsMusicConfirmation = false;
  }
  async function routeMusicUntilPlayback(op, query) {
    const routed = Promise.resolve(api().handleMusicQueryForTest(query, {
      append: false, isCurrent: () => op.confirmed === true || musicCurrent(op)
    })).then(value => ({ done: true, value }));
    let previous = null;
    const until = Date.now() + 70000;
    while (musicCurrent(op) && Date.now() < until) {
      const s = musicStatus();
      if (s.state === "PLAYING" && s.mediaId && !s.lastError && !s.userActionRequired) {
        op.startedMedia = s.mediaId;
        if (previous?.mediaId === s.mediaId && Number(s.position) > Number(previous.position) + 0.15) {
          op.confirmed = true;
          return { handled: true, decision: "PLAYBACK_CONFIRMED", candidate: musicPlayer()?.getCurrentMedia?.() };
        }
        previous = s;
      }
      const step = await Promise.race([routed, new Promise(resolve => setTimeout(() => resolve({ done: false }), 500))]);
      if (step.done) return step.value;
    }
    return { handled: true, decision: "CANCELLED" };
  }
  async function runMusic(command) {
    const op = { ...command, startedMedia: null };
    activeMusic = op;
    const result = { handled: true, decision: "PLAYER_UNAVAILABLE", played: false, positionAdvanced: false,
      answer: "Não consegui iniciar a música. Abra o player do ELO e tente novamente." };
    try {
      if (!musicCurrent(op) || !api()?.handleMusicQueryForTest) return;
      const text = String(op.text || "").replace(/^\s*elo\b[\s,:-]*/i, "").slice(0, 36000);
      const control = api().detectMediaCommandForTest?.(text);
      let routed;
      if (control) {
        routed = api().handleMediaCommandForTest?.(text);
        if (!routed?.handled) { result.decision = "CONTROL_NOT_CONFIRMED"; return; }
        result.decision = "CONTROL_" + control.toUpperCase();
        if (["pause", "stop"].includes(control)) {
          const s = musicStatus();
          result.answer = control === "pause" && s.state === "PAUSED" ? "Música pausada." :
            control === "stop" && ["IDLE", "STOPPED"].includes(s.state) ? "Música parada." : "O player não confirmou o comando.";
          return;
        }
      } else {
        const confirmation = ownsMusicConfirmation && /^(sim|isso|correto|pode|não|nao)\b/i.test(text);
        const query = op.pending && !confirmation && !api().detectMusicPlayIntentForTest?.(text) ? "Toque " + text : text;
        routed = await routeMusicUntilPlayback(op, query);
        if (!musicCurrent(op)) return;
        result.decision = routed?.decision || "NO_MATCH";
        const candidate = routed?.candidate;
        const label = [candidate?.title, candidate?.artist].filter(Boolean).join(" — ").slice(0, 300);
        if (result.decision === "ASK_CONFIRMATION") {
          ownsMusicConfirmation = true; result.pending = true;
          result.answer = "Você quis dizer " + (label || "esta música") + "?"; return;
        }
        if (["NO_MATCH", "REJECTED"].includes(result.decision)) {
          result.pending = true; result.answer = "Qual é o título e o artista da música?"; return;
        }
        if (!routed?.handled || ["NO_HANDLER", "CANCELLED", "OFFLINE"].includes(result.decision)) return;
        ownsMusicConfirmation = false;
        result.answer = "Tocando " + (label || "a música solicitada") + ".";
        if (op.confirmed) { result.played = true; result.positionAdvanced = true; return; }
      }
      // Intent/resolver success is insufficient. Observe the existing real player.
      const end = Date.now() + 10000;
      let previous = null;
      while (musicCurrent(op) && Date.now() < end) {
        const s = musicStatus();
        if (s.state === "PLAYING" && s.mediaId && !s.lastError && !s.userActionRequired) {
          op.startedMedia = s.mediaId;
          if (previous?.mediaId === s.mediaId && Number(s.position) > Number(previous.position) + 0.15) {
            op.confirmed = true; result.played = true; result.positionAdvanced = true;
            if (control) result.answer = "Reprodução confirmada pelo player.";
            return;
          }
          previous = s;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      result.answer = "A música foi localizada, mas o player ainda não confirmou a reprodução.";
      result.decision = "PLAYBACK_NOT_CONFIRMED";
    } catch (_) {
      result.decision = "MUSIC_ERROR";
      result.answer = "Não consegui iniciar a música. Tente novamente no player do ELO.";
    } finally {
      if (musicCurrent(op)) {
        activeMusic = null;
        request("MUSIC_RESULT", { requestId: op.id, result }).catch(() => {});
      }
    }
  }
  function cancelMusic(id) {
    const op = activeMusic;
    if (!op || id && op.id !== id) return;
    activeMusic = null;
    if (op.startedMedia && musicStatus().mediaId === op.startedMedia) musicPlayer()?.stop?.();
  }
  window.addEventListener("message", event => {
    if (event.data !== "elo-native-brain-channel-v1:ELO_NATIVE_CHANNEL_TOKEN_V1" || event.ports.length !== 1 || port) return;
    if (port) port.close();
    port = event.ports[0];
    port.onmessage = event => {
      let m;
      try { m = JSON.parse(event.data); } catch (_) { return; }
      if (m?.type === "STATE" && m.data) {
        const before = state; state = m.data;
        if (state.state === "BRAIN_LISTENING" && state.reason === "CAPTURE_STARTING" &&
            !(before.state === "BRAIN_LISTENING" && before.reason === "CAPTURE_STARTING")) {
          lastTranscript = ""; lastTranscriptFinal = false;
        }
        if (state.enabled || activationRequested && state.state === "WAKE_DISABLED" && state.reason && !["EXPLICIT_DISABLE", "SERVICE_DESTROYED"].includes(state.reason)) {
          activationPending = false;
          activationRequested = false;
        }
        if (activeMusic && !musicCurrent(activeMusic)) cancelMusic();
        if (["WAKE_DISABLED", "RETURN_TO_WAKE"].includes(state.state)) clearMusicConfirmation();
        if (["WAKE_DISABLED", "WAKE_LISTENING"].includes(state.state)) { lastTranscript = ""; lastTranscriptFinal = false; }
        mount();
        if (readingControl) {
          if (state.reason === "MANUAL_READING" && state.state === "BRAIN_SPEAKING") {
            readingControl.dataset.eloSpeechState = "speaking";
            if (readingControl.textContent !== "Parar") readingControl.textContent = "Parar";
            readingControl.setAttribute("aria-pressed", "true");
          } else finishReadingControl();
        }
        if (before.turn !== state.turn || ["PROCESSING", "BRAIN_SPEAKING"].includes(before.state) && before.state !== state.state) syncCanonicalHistory().catch(() => {});
      } else if (m?.type === "MUSIC_REQUEST" && m.request?.id) {
        runMusic(m.request).catch(() => {});
      } else if (m?.type === "MUSIC_CANCEL") {
        cancelMusic(m.id);
      } else if (m?.type === "TRANSCRIPT" && state.enabled && ["BRAIN_LISTENING", "PROCESSING"].includes(state.state)) {
        const text = String(m.text || "").slice(0, 36000);
        if (m.final) { lastTranscript = text; lastTranscriptFinal = true; }
        else if (!lastTranscriptFinal) lastTranscript = text;
        mount();
      } else if (m?.type === "RESULT") {
        const p = pending.get(m.id); if (!p) return;
        clearTimeout(p.timer); pending.delete(m.id); p.resolve(m);
      }
    };
    port.start(); request("STATUS").catch(() => {}); mount();
  });
  document.addEventListener("visibilitychange", onResume);
  new MutationObserver(() => { mount(); if (window.document?.body) checkVisibleScope(); }).observe(document.body, { childList: true, subtree: true });
  new MutationObserver(checkVisibleScope).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  window.EloNativeBrain = Object.freeze({ version: "20261016-native-brain-v6", onResume, getState: () => ({ ...state }) });
  mount();
})();
