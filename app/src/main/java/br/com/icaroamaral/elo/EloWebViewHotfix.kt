package br.com.icaroamaral.elo

object EloWebViewHotfix {
    fun stopOnlinePlayerScript(): String =
        "window.__eloNativeStopOnlinePlayer && window.__eloNativeStopOnlinePlayer();"

    fun connectivityScript(state: String): String {
        val safeState = state.replace("'", "")
        return """
(function(){
  document.documentElement.setAttribute('data-elo-native-connectivity', '$safeState');
  window.dispatchEvent(new CustomEvent('elo-native-connectivity', { detail: { state: '$safeState' } }));
})();
        """.trimIndent()
    }

    fun playbackScript(state: String, trackId: String = "", title: String = "", error: String? = null): String {
        val safeState = org.json.JSONObject.quote(state)
        val safeTrackId = org.json.JSONObject.quote(trackId)
        val safeTitle = org.json.JSONObject.quote(title)
        val safeError = org.json.JSONObject.quote(error.orEmpty())
        return """
(function(){
  var detail = {state:$safeState, trackId:$safeTrackId, title:$safeTitle, error:$safeError};
  document.documentElement.setAttribute('data-elo-native-playback', detail.state);
  window.dispatchEvent(new CustomEvent('elo-native-playback', { detail: detail }));
})();
        """.trimIndent()
    }

    fun installScript(): String {
        val productionScript = installProductionScript()
        return if (isQaDebugBuild()) {
            productionScript + "\n" + qaHeaderOverrideScript()
        } else {
            productionScript
        }
    }

    private fun installProductionScript(): String {
        val isQaBuild = isQaDebugBuild()
        return """
(function(){
  if (window.__eloAndroid021PhysicalHotfixV1) return;
  window.__eloAndroid021PhysicalHotfixV1 = true;
  var isQaBuild = __ELO_QA_BUILD__;

  var css = [
    'html,body{width:100%;max-width:100%;overflow-x:hidden;}',
    'body[data-elo-product="chat"] .elo-product-top{box-sizing:border-box;max-width:calc(100vw - 16px);min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;}',
    'body[data-elo-product="chat"] .elo-product-brand,body[data-elo-product="chat"] .elo-local-auth,body[data-elo-product="chat"] .elo-local-auth-session{min-width:0;}',
    'body[data-elo-product="chat"] .elo-local-auth{position:relative!important;inset:auto!important;z-index:1;max-width:100%;}',
    'body[data-elo-product="chat"].elo-authenticated .elo-local-auth{display:none!important;}',
    '__ELO_ACTIONS_LAYOUT_CSS__',
     'body[data-elo-product="chat"] .elo-local-auth-session button{white-space:nowrap;}',
     '.elo-native-status-chip{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:0 8px;border-radius:999px;border:1px solid rgba(22,163,74,.18);color:#166534;background:rgba(22,163,74,.08);font-size:11px;font-weight:800;white-space:nowrap;}',
     '.elo-native-auth-chip{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:0 8px;border-radius:999px;border:1px solid rgba(37,99,235,.18);color:#1d4ed8;background:rgba(37,99,235,.08);font-size:11px;font-weight:800;white-space:nowrap;}',
     '.elo-native-pause-button{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(34,211,238,.38);background:#0f172a;color:#e0f2fe;font-size:12px;font-weight:900;white-space:nowrap;box-shadow:0 8px 22px rgba(15,23,42,.18);}',
     '.elo-native-pause-button:active{transform:translateY(1px);}',
     '.elo-native-edurex-panel{grid-column:1/-1;display:none;box-sizing:border-box;width:100%;max-height:min(320px,calc(100vh - 160px));overflow:auto;margin-top:2px;padding:12px;border:1px solid rgba(15,23,42,.12);border-radius:14px;background:#fff;color:#0f172a;box-shadow:0 10px 28px rgba(15,23,42,.14);}',
     '.elo-native-edurex-panel.is-open{display:block;}',
     '.elo-native-edurex-panel p{margin:6px 0 10px;font-size:12px;line-height:1.45;}',
     '.elo-native-edurex-panel button{min-height:34px;padding:0 12px;border:1px solid rgba(15,23,42,.18);border-radius:9px;background:#f8fafc;color:#0f172a;font-weight:800;}',
     'html[data-elo-native-connectivity]:not([data-elo-native-connectivity="ONLINE_VALIDATED"]) .elo-native-status-chip{border-color:rgba(180,83,9,.22);color:#92400e;background:#fffbeb;}',
    'html[data-elo-native-connectivity]:not([data-elo-native-connectivity="ONLINE_VALIDATED"]) .elo-native-status-chip::before{content:"";width:7px;height:7px;border-radius:999px;background:#f59e0b;}',
    'html[data-elo-native-connectivity="ONLINE_VALIDATED"] .elo-native-status-chip::before{content:"";width:7px;height:7px;border-radius:999px;background:#16a34a;}',
    'body[data-elo-product="chat"] .elo-history-list{width:100%;max-width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;align-items:stretch;}',
    'body[data-elo-product="chat"] .elo-history-item{width:100%;min-width:0;box-sizing:border-box;}',
    'body[data-elo-product="chat"] .elo-history-title,body[data-elo-product="chat"] .elo-history-meta,body[data-elo-product="chat"] .elo-history-summary{overflow-wrap:anywhere;}',
    'body[data-elo-product="chat"] .elo-standalone-panel.is-history-view,body[data-elo-product="chat"] [data-elo-history-panel],body[data-elo-product="chat"] .elo-history-panel{width:min(100%,960px);max-width:960px;}',
    'body[data-elo-product="chat"] .elo-product-chat,body[data-elo-product="chat"] .elo-product-center{min-width:0;}',
    '@media(max-width:599px){body[data-elo-product="chat"] .elo-product-top{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px;padding:7px 8px;}body[data-elo-product="chat"] .elo-product-brand{grid-row:1;}.elo-native-status-chip{grid-row:1;justify-self:end;}body[data-elo-product="chat"] .elo-local-auth-session{grid-column:1/-1;width:100%;justify-content:flex-end;}body[data-elo-product="chat"] .elo-local-auth-session [data-elo-auth-user]{max-width:48vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body[data-elo-product="chat"] .elo-product-shell{padding-top:78px;}}',
    '__ELO_ACTIONS_MOBILE_CSS__',
    '@media(orientation:landscape) and (max-height:520px){body[data-elo-product="chat"] .elo-product-top{top:6px;min-height:42px;}body[data-elo-product="chat"] .elo-product-shell{padding-top:58px;}body[data-elo-product="chat"] .elo-product-center,body[data-elo-product="chat"].elo-chat-state .elo-product-center{width:min(100%,calc(100vw - 18px));max-width:none;}body[data-elo-product="chat"] .elo-product-chat,body[data-elo-product="chat"] .elo-product-chat .elo-standalone-panel,body[data-elo-product="chat"] .elo-product-chat .elo-standalone-panel.is-chat-active{max-width:none;}body[data-elo-product="chat"] .elo-standalone-panel.is-history-view,body[data-elo-product="chat"] [data-elo-history-panel],body[data-elo-product="chat"] .elo-history-panel{width:min(100%,calc(100vw - 18px));max-width:none;}}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'elo-android-021-hotfix';
  style.textContent = css;
  document.head.appendChild(style);

  function markPerformance(stage){
    try {
      if (window.EloNativeBridge && window.EloNativeBridge.markPerformance) {
        window.EloNativeBridge.markPerformance(stage);
      }
    } catch (_) {}
  }
  markPerformance('ELO_JS_READY');
  markPerformance('AUTH_BOOTSTRAP_START');

  function pageHasOnlineIndicator(){
    var brand = document.querySelector('.elo-product-brand');
    if (!brand || !window.getComputedStyle) return false;
    try {
      var content = window.getComputedStyle(brand, '::after').content || '';
      return String(content).toLowerCase().indexOf('online') !== -1;
    } catch (err) {
      return false;
    }
  }
  function ensureStatusChip(){
    var top = document.querySelector('.elo-product-top');
    var existing = document.querySelector('.elo-native-status-chip');
    if (isQaBuild || pageHasOnlineIndicator()) {
      if (existing) existing.remove();
      return;
    }
    if (!top || existing) return;
    var chip = document.createElement('span');
    chip.className = 'elo-native-status-chip';
    chip.setAttribute('aria-live', 'polite');
    chip.textContent = 'Online';
    top.insertBefore(chip, top.children[1] || null);
  }
  function syncChatAuthLayout(){
    syncAuthLayout();
    var hasConversation = !!document.querySelector('.elo-messages .elo-message, .elo-standalone-panel.is-chat-active');
    document.body.classList.toggle('elo-chat-state', hasConversation);
    if (window.ELO_AUTH_SESSION_VALIDATED === true) markPerformance('AUTH_READY');
    if (document.querySelector('.elo-input')) markPerformance('CHAT_READY');
  }

  function syncAuthLayout(){
    var explicitState = String(window.ELO_AUTH_STATE || '').toUpperCase();
    var state = /^(AUTH_RESTORING|LOGGED_OUT|AUTHENTICATING|AUTHENTICATED|AUTH_ERROR|TRANSIENT_OFFLINE)$/.test(explicitState)
      ? explicitState
      : window.ELO_AUTH_SESSION_VALIDATED === true
        ? 'AUTHENTICATED'
        : window.ELO_AUTH_SESSION_VALIDATED === false
          ? 'LOGGED_OUT'
          : 'AUTH_RESTORING';

    document.body.setAttribute('data-elo-auth-state', state);
    document.body.classList.toggle('elo-authenticated', state === 'AUTHENTICATED');
    document.body.classList.toggle('elo-auth-restoring', state === 'AUTH_RESTORING' || state === 'AUTHENTICATING');
    document.body.classList.toggle('elo-auth-error', state === 'AUTH_ERROR');
    document.body.classList.toggle('elo-transient-offline', state === 'TRANSIENT_OFFLINE');

    var top = document.querySelector('.elo-product-top');
    var indicator = document.querySelector('.elo-native-auth-chip');
    if (state !== 'AUTHENTICATED' || isQaBuild) {
      if (indicator) indicator.remove();
      return;
    }
    if (!top) return;
    if (!indicator) {
      indicator = document.createElement('span');
      indicator.className = 'elo-native-auth-chip';
      indicator.setAttribute('aria-live', 'polite');
      indicator.setAttribute('aria-label', 'Sessão autenticada');
      top.appendChild(indicator);
    }
    indicator.textContent = 'Sessão ativa';
  }
  var chatAuthSyncPending = false;
  function scheduleChatAuthLayout(){
    if (chatAuthSyncPending) return;
    chatAuthSyncPending = true;
    window.setTimeout(function(){
      chatAuthSyncPending = false;
      syncChatAuthLayout();
    }, 80);
  }
  var chatAuthObserver = new MutationObserver(scheduleChatAuthLayout);
  chatAuthObserver.observe(document.body, {childList:true, subtree:true});
  syncChatAuthLayout();

  var eduRexOpen = false;
  function updateEduRexButton(){
    var button = document.querySelector('.elo-native-pause-button');
    if (button) {
      button.setAttribute('aria-expanded', String(eduRexOpen));
      button.setAttribute('aria-label', eduRexOpen ? 'Fechar EDU-REX' : 'Abrir EDU-REX');
    }
    var menuItem = document.querySelector('[data-elo-qa-edurex-menu-item]');
    if (menuItem) menuItem.setAttribute('aria-expanded', String(eduRexOpen));
  }
  function ensureEduRexPanel(){
    var top = document.querySelector('.elo-product-top');
    if (!top || document.querySelector('.elo-native-edurex-panel')) return;
    var panel = document.createElement('section');
    panel.className = 'elo-native-edurex-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'EDU-REX');
    panel.setAttribute('aria-hidden', 'true');
    panel.innerHTML = '<strong>EDU-REX</strong><p>Painel EDU-REX disponível no ELO. Use fechar para retornar à conversa.</p><button type="button" data-elo-native-edurex-close>Fechar</button>';
    panel.querySelector('[data-elo-native-edurex-close]').addEventListener('click', function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEduRex();
    }, true);
    top.appendChild(panel);
  }
  function setFallbackEduRex(open){
    ensureEduRexPanel();
    var panel = document.querySelector('.elo-native-edurex-panel');
    if (!panel) return;
    panel.hidden = !eduRexOpen;
    panel.classList.toggle('is-open', eduRexOpen);
    panel.setAttribute('aria-hidden', String(!eduRexOpen));
    updateEduRexButton();
  }
  function callPauseGame(open){
    try {
      if (!window.EloPauseGame) return false;
      var method = open ? 'open' : 'close';
      if (typeof window.EloPauseGame[method] !== 'function') return false;
      window.EloPauseGame[method]();
      return true;
    } catch (err) {
      return false;
    }
  }
  function openEduRex(){
    eduRexOpen = true;
    if (callPauseGame(true)) {
      var fallback = document.querySelector('.elo-native-edurex-panel');
      if (fallback) setFallbackEduRex(false);
      updateEduRexButton();
      return;
    }
    setFallbackEduRex(true);
  }
  function closeEduRex(){
    eduRexOpen = false;
    callPauseGame(false);
    setFallbackEduRex(false);
  }
  function toggleEduRex(){
    if (eduRexOpen) closeEduRex(); else openEduRex();
  }
  function closeCompactMenu(){
    var menu = document.querySelector('[data-elo-mobile-menu]');
    var toggle = document.querySelector('[data-elo-mobile-menu-toggle]');
    if (menu) menu.classList.remove('is-open');
    if (toggle) {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Abrir menu de ações');
    }
  }
  function ensureQaMenuEntries(){
    if (!isQaBuild) return false;
    var menu = document.querySelector('[data-elo-mobile-menu]');
    if (!menu) return false;

    var eduItems = menu.querySelectorAll('[data-elo-qa-edurex-menu-item],[data-elo-mobile-menu-action="edurex"]');
    var eduItem = eduItems.length ? eduItems[0] : null;
    for (var index = 1; index < eduItems.length; index++) eduItems[index].remove();
    if (!eduItem) {
      eduItem = document.createElement('button');
      eduItem.type = 'button';
      eduItem.className = 'elo-mobile-menu-proxy';
      eduItem.textContent = 'EDU-REX';
      menu.appendChild(eduItem);
    }
    eduItem.setAttribute('data-elo-qa-edurex-menu-item', '');
    eduItem.setAttribute('data-elo-mobile-menu-action', 'edurex');
    eduItem.setAttribute('aria-label', 'Abrir EDU-REX');
    if (!eduItem.__eloQaEduRexBound) {
      eduItem.addEventListener('click', function(event){
        event.preventDefault();
        toggleEduRex();
        closeCompactMenu();
      });
      eduItem.__eloQaEduRexBound = true;
    }

    var logoutItems = menu.querySelectorAll('[data-elo-mobile-menu-action="logout"]');
    for (var logoutIndex = 1; logoutIndex < logoutItems.length; logoutIndex++) logoutItems[logoutIndex].remove();
    if (!logoutItems.length) {
      var logoutItem = document.createElement('button');
      logoutItem.type = 'button';
      logoutItem.className = 'elo-mobile-menu-proxy';
      logoutItem.setAttribute('data-elo-mobile-menu-action', 'logout');
      logoutItem.textContent = 'Sair';
      menu.appendChild(logoutItem);
    }
    return true;
  }
  function ensurePauseButton(){
    if (isQaBuild && ensureQaMenuEntries()) return;
    var actions = document.querySelector('.elo-core-actions') || document.querySelector('.elo-local-auth-session') || document.querySelector('.elo-product-top');
    if (!actions || document.querySelector('.elo-native-pause-button')) return;
    ensureEduRexPanel();
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'elo-native-pause-button';
    button.textContent = 'EDU-REX';
    button.setAttribute('aria-label', 'Abrir EDU-REX');
    button.setAttribute('title', 'EDU-REX');
    button.addEventListener('click', function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      toggleEduRex();
      return false;
    }, true);
    actions.appendChild(button);
    updateEduRexButton();
  }
  document.addEventListener('click', function(event){
    if (!eduRexOpen) return;
    var panel = document.querySelector('.elo-native-edurex-panel');
    var button = document.querySelector('.elo-native-pause-button');
    if (panel && !panel.contains(event.target) && event.target !== button) closeEduRex();
  }, true);
  document.addEventListener('keydown', function(event){
    if (event.key === 'Escape' && eduRexOpen) closeEduRex();
  }, true);
  function syncConnectivity(){
    ensureStatusChip();
    var state = 'ONLINE_VALIDATED';
    try {
      if (window.EloNativeBridge && window.EloNativeBridge.getConnectivityState) {
        var raw = window.EloNativeBridge.getConnectivityState();
        var parsed = JSON.parse(raw || '{}');
        state = parsed.state || state;
      }
    } catch (err) {}
    document.documentElement.setAttribute('data-elo-native-connectivity', state);
    var chip = document.querySelector('.elo-native-status-chip');
    if (chip) chip.textContent = state === 'ONLINE_VALIDATED' ? 'Online' : 'Offline';
  }
  function normalize(value){
    return String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  }
  function localDateAnswer(command){
    try {
      if (window.EloNativeBridge && window.EloNativeBridge.getLocalDateTimeAnswer) {
        return String(window.EloNativeBridge.getLocalDateTimeAnswer(String(command || '')) || '');
      }
    } catch (err) {}
    return '';
  }
  function appendChatMessage(role, text){
    var messages = document.querySelector('.elo-messages');
    if (!messages) return;
    var item = document.createElement('div');
    item.className = 'elo-message ' + role;
    var bubble = document.createElement('div');
    bubble.className = 'elo-message-bubble';
    bubble.textContent = text;
    item.appendChild(bubble);
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    document.body.classList.add('elo-chat-state');
    document.body.classList.remove('elo-empty-state');
    var panel = document.querySelector('.elo-standalone-panel');
    if (panel) panel.classList.add('is-chat-active');
  }
  function maybeAnswerLocalDate(event, command){
    var n = normalize(command);
    if (!/\b(pesquise\s+|pesquise\s+a\s+|pesquise\s+qual\s+)?(que dia e hoje|qual e a data de hoje|qual a data de hoje|hoje e que dia|que horas sao|qual horario|qual o horario|qual hora|qual o dia da semana|data de hoje|hora local)\b/.test(n)) return false;
    var answer = localDateAnswer(command);
    if (!answer) return false;
    if (event) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    appendChatMessage('user', command);
    appendChatMessage('assistant', answer);
    var input = document.querySelector('.elo-input');
    if (input) input.value = '';
    return true;
  }
  function inputText(form){
    var active = document.activeElement;
    if (active && /^(TEXTAREA|INPUT)$/.test(active.tagName) && active.value) return active.value;
    var field = form && form.querySelector ? form.querySelector('.elo-input,textarea,input[type=text],input:not([type])') : null;
    return field && field.value || '';
  }
  document.addEventListener('submit', function(event){ maybeAnswerLocalDate(event, inputText(event.target)); }, true);
  document.addEventListener('keydown', function(event){
    if (event.defaultPrevented || event.key !== 'Enter' || event.shiftKey) return;
    var target = event.target;
    if (!target || !/^(TEXTAREA|INPUT)$/.test(target.tagName)) return;
    maybeAnswerLocalDate(event, target.value || '');
  }, true);
  function markHistoryLoading(){
    var panel = document.querySelector('.elo-standalone-panel');
    if (panel) panel.classList.add('is-history-view');
    window.setTimeout(function(){
      var list = document.querySelector('.elo-history-list');
      if (list && !list.children.length) list.textContent = 'Carregando histórico...';
    }, 30);
  }
  document.addEventListener('click', function(event){
    var button = event.target && event.target.closest ? event.target.closest('[data-elo-history]') : null;
    if (button) markHistoryLoading();
  }, true);
  function normalizeActionButtons(){
    var selectors = ['[data-elo-history]','[data-elo-memory]','[data-elo-open-history]','[data-elo-open-memory]','.elo-history-button','.elo-memory-button'];
    document.querySelectorAll(selectors.join(',')).forEach(function(button){
      if (button && button.tagName === 'BUTTON') button.type = 'button';
      if (button) button.setAttribute('data-elo-native-no-chat-submit', 'true');
    });
  }
  document.addEventListener('click', function(event){
    var action = event.target && event.target.closest ? event.target.closest('[data-elo-native-no-chat-submit],[data-elo-history],[data-elo-memory],[data-elo-open-history],[data-elo-open-memory],.elo-history-button,.elo-memory-button') : null;
    if (!action) return;
    event.preventDefault();
  }, true);
  function removeIntrusiveOfflineNotices(){
    var nodes = document.querySelectorAll('body *');
    nodes.forEach(function(node){
      if (!node || node.classList && node.classList.contains('elo-native-status-chip')) return;
      if (/^(SCRIPT|STYLE|TEXTAREA|INPUT|BUTTON)$/.test(node.tagName || '')) return;
      var text = (node.textContent || '').replace(/\s+/g,' ').trim();
      if (!text || text.length > 180) return;
      if (/elo offline|recursos locais disponiveis|recursos locais disponíveis|voce esta offline|você está offline/i.test(text)) {
        node.setAttribute('data-elo-native-hidden-offline-notice','true');
        node.style.display = 'none';
      }
    });
  }
  function improveHistoryCards(){
    var cards = document.querySelectorAll('.elo-history-item');
    cards.forEach(function(card){
      var title = card.querySelector('.elo-history-title');
      var meta = card.querySelector('.elo-history-meta');
      var summary = card.querySelector('.elo-history-summary');
      var weak = !summary || /sem resumo salvo/i.test(summary.textContent || '');
      if (weak && summary) {
        var metaText = meta && meta.textContent ? meta.textContent.trim() : '';
        summary.textContent = metaText ? 'Conversa de ' + metaText : 'Conversa recente do ELO.';
      }
      if (title && /^nova conversa$/i.test((title.textContent || '').trim()) && summary && summary.textContent) {
        title.textContent = summary.textContent.slice(0, 64);
      }
    });
  }
  function resolvedMusicCommand(media){
    if (!media) return '';
    var parts = [media.title, media.name, media.composer, media.id].filter(Boolean).join(' ');
    return parts ? 'toque ' + parts : 'toque musica offline';
  }
  function isLocalMedia(media){
    if (!media) return false;
    var raw = [media.source, media.provider, media.kind, media.type, media.url, media.src, media.path].filter(Boolean).join(' ');
    return /LOCAL_CLASSICAL|offline-media\/classical|offline classical|local/i.test(raw);
  }
  function callNativeResolvedMusic(media){
    try {
      if (!isLocalMedia(media) || !window.EloNativeBridge) return false;
      stopOnlinePlayerDom();
      var command = resolvedMusicCommand(media);
      var raw = '';
      if (media.id && window.EloNativeBridge.playOfflineTrack) {
        raw = window.EloNativeBridge.playOfflineTrack(String(media.id));
      }
      var parsed = JSON.parse(raw || '{}');
      if (!parsed.handled && window.EloNativeBridge.playResolvedOfflineMusic) {
        raw = window.EloNativeBridge.playResolvedOfflineMusic(command);
        parsed = JSON.parse(raw || '{}');
      }
      if (parsed && parsed.handled) {
        console.info('ELO_NATIVE_LOCAL_MUSIC_FALLBACK', command, parsed.trackId || media.id || '');
        return true;
      }
    } catch (err) {
      console.error('ELO_NATIVE_LOCAL_MUSIC_BRIDGE_FAILED', err && err.name || 'Error', err && err.message || String(err));
    }
    return false;
  }
  function callNativeOnlinePlayer(){
    try {
      if (!window.EloNativeBridge || !window.EloNativeBridge.activateOnlinePlayer) return false;
      return !!window.EloNativeBridge.activateOnlinePlayer();
    } catch (err) {
      console.error('ELO_ONLINE_PLAYER_COORDINATOR_FAILED', err && err.name || 'Error', err && err.message || String(err));
      return false;
    }
  }
  function stopOnlinePlayerDom(){
    var player = window.EloMediaPlayer;
    if (player) {
      var stopped = false;
      ['stop','close','destroy'].forEach(function(name){
        try {
          if (typeof player[name] !== 'function') return;
          player[name]();
          stopped = true;
        } catch (err) {
        }
      });
      if (!stopped) {
        try { if (typeof player.pause === 'function') player.pause(); } catch (err) {}
      }
    }
    document.querySelectorAll('audio,video').forEach(function(media){
      try { media.pause(); } catch (err) {}
      try { media.removeAttribute('autoplay'); } catch (err) {}
      try { media.removeAttribute('src'); media.load(); } catch (err) {}
    });
    document.querySelectorAll([
      '[data-elo-media-player]', '[data-elo-player]', '.elo-media-player',
      '.elo-music-player', '#elo-media-player', '#elo-music-player',
      'iframe[src*="youtube.com/embed"]', 'iframe[src*="youtube-nocookie.com/embed"]'
    ].join(',')).forEach(function(node){
      if (node.tagName === 'IFRAME') node.removeAttribute('src');
      node.setAttribute('aria-hidden', 'true');
      node.style.display = 'none';
    });
    try {
      if (window.EloNativeBridge && window.EloNativeBridge.notifyOnlinePlayerStopped) {
        window.EloNativeBridge.notifyOnlinePlayerStopped();
      }
    } catch (err) {}
    document.documentElement.setAttribute('data-elo-online-player', 'STOPPED');
    window.dispatchEvent(new CustomEvent('elo-online-player-stopped'));
    return true;
  }
  function wrapMediaPlayerMethod(player, name){
    if (!player || typeof player[name] !== 'function' || player[name].__eloNativeWrapped) return;
    var original = player[name];
    var wrapped = function(media){
      if (callNativeResolvedMusic(media)) return Promise.resolve(true);
      stopOnlinePlayerDom();
      callNativeOnlinePlayer();
      return original.apply(this, arguments);
    };
    wrapped.__eloNativeWrapped = true;
    player[name] = wrapped;
  }
  function wrapOnlineStopMethod(player, name){
    if (!player || typeof player[name] !== 'function' || player[name].__eloNativeWrapped) return;
    var original = player[name];
    var wrapped = function(){
      var result = original.apply(this, arguments);
      try {
        if (window.EloNativeBridge && window.EloNativeBridge.notifyOnlinePlayerStopped) {
          window.EloNativeBridge.notifyOnlinePlayerStopped();
        }
      } catch (err) {}
      document.documentElement.setAttribute('data-elo-online-player', 'STOPPED');
      return result;
    };
    wrapped.__eloNativeWrapped = true;
    player[name] = wrapped;
  }
  function nativePlaybackActive(){
    var state = document.documentElement.getAttribute('data-elo-native-playback') || '';
    return state === 'PLAYING' || state === 'PAUSED' || state === 'TRACK_CHANGED';
  }
  function callNativePlaybackControl(method){
    try {
      if (!nativePlaybackActive() || !window.EloNativeBridge || !window.EloNativeBridge[method]) return false;
      var parsed = JSON.parse(window.EloNativeBridge[method]() || '{}');
      return !!(parsed && parsed.handled);
    } catch (err) {
      console.error('ELO_NATIVE_PLAYBACK_CONTROL_FAILED', method, err && err.name || 'Error', err && err.message || String(err));
      return false;
    }
  }
  function wrapNativeControl(player, name, bridgeMethod){
    if (!player || typeof player[name] !== 'function' || player[name].__eloNativeWrapped) return;
    var original = player[name];
    var wrapped = function(){
      if (callNativePlaybackControl(bridgeMethod)) return Promise.resolve(true);
      return original.apply(this, arguments);
    };
    wrapped.__eloNativeWrapped = true;
    player[name] = wrapped;
  }
  function installNativeLocalMusicFallback(){
    if (!window.EloMediaPlayer) return;
    wrapMediaPlayerMethod(window.EloMediaPlayer, 'play');
    wrapMediaPlayerMethod(window.EloMediaPlayer, 'playTrack');
    wrapMediaPlayerMethod(window.EloMediaPlayer, 'playMedia');
    wrapOnlineStopMethod(window.EloMediaPlayer, 'stop');
    wrapOnlineStopMethod(window.EloMediaPlayer, 'close');
    wrapOnlineStopMethod(window.EloMediaPlayer, 'destroy');
    wrapNativeControl(window.EloMediaPlayer, 'pause', 'pauseOfflineTrack');
    wrapNativeControl(window.EloMediaPlayer, 'resume', 'resumeOfflineTrack');
    wrapNativeControl(window.EloMediaPlayer, 'next', 'nextOfflineTrack');
    wrapNativeControl(window.EloMediaPlayer, 'previous', 'previousOfflineTrack');
  }
  function installAudioPlayDiagnostics(){
    if (!window.HTMLMediaElement || HTMLMediaElement.prototype.__eloAudioPlayDiagnostics) return;
    var original = HTMLMediaElement.prototype.play;
    var wrapped = function(){
      var result;
      try {
        result = original.apply(this, arguments);
      } catch (err) {
        console.error('ELO_AUDIO_PLAY_FAILED', err && err.name || 'Error', err && err.message || String(err));
        throw err;
      }
      if (result && typeof result.catch === 'function') {
        result.catch(function(err){
          console.error('ELO_AUDIO_PLAY_FAILED', err && err.name || 'Error', err && err.message || String(err));
        });
      }
      return result;
    };
    wrapped.__eloAudioPlayDiagnostics = true;
    HTMLMediaElement.prototype.play = wrapped;
  }

  function markChatInteraction(event){
    var target = event && event.target;
    var form = target && target.closest ? target.closest('.elo-input-row') : null;
    if (!form) return;
    var input = form.querySelector('.elo-input');
    if (!input || !String(input.value || '').trim()) return;
    markPerformance('USER_SEND_CLICK');
  }

  function markMessageLifecycle(node){
    if (!node || node.nodeType !== 1) return;
    var selector = '.elo-message';
    var matches = node.matches && node.matches(selector) ? [node] : [];
    if (node.querySelectorAll) matches = matches.concat(Array.prototype.slice.call(node.querySelectorAll(selector)));
    matches.forEach(function(message){
      if (message.classList.contains('user')) markPerformance('MESSAGE_RENDERED_LOCAL');
      if (message.classList.contains('is-typing') || message.getAttribute('data-elo-typing') === 'true') {
        markPerformance('PROCESSING_INDICATOR_VISIBLE');
      }
      if (message.classList.contains('assistant') && !message.classList.contains('is-typing') && message.getAttribute('data-elo-typing') !== 'true') {
        markPerformance('FIRST_RESPONSE_DATA');
        markPerformance('FIRST_VISIBLE_RESPONSE');
        markPerformance('RESPONSE_COMPLETE');
      }
    });
  }

  function syncDynamicSurface(){
    ensureStatusChip();
    ensurePauseButton();
    normalizeActionButtons();
    removeIntrusiveOfflineNotices();
    improveHistoryCards();
    installNativeLocalMusicFallback();
    installAudioPlayDiagnostics();
    markMessageLifecycle(document.querySelector('.elo-messages'));
    syncChatAuthLayout();
  }

  var dynamicSyncPending = false;
  function scheduleDynamicSurface(){
    if (dynamicSyncPending) return;
    dynamicSyncPending = true;
    window.setTimeout(function(){
      dynamicSyncPending = false;
      syncDynamicSurface();
    }, 80);
  }

  document.addEventListener('submit', markChatInteraction, true);
  document.addEventListener('keydown', function(event){
    if (event.key === 'Enter' && !event.shiftKey) markChatInteraction(event);
  }, true);
  document.addEventListener('click', function(event){
    var button = event.target && event.target.closest ? event.target.closest('.elo-send-button,[type="submit"]') : null;
    if (button) markChatInteraction(event);
  }, true);

  window.addEventListener('elo-native-playback', function(event){
    var detail = event && event.detail || {};
    document.querySelectorAll('[data-elo-native-track-title]').forEach(function(node){
      node.textContent = detail.title || '';
    });
  });
  window.__eloNativeStopOnlinePlayer = stopOnlinePlayerDom;
  var observer = new MutationObserver(scheduleDynamicSurface);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('resize', scheduleDynamicSurface);
  window.addEventListener('orientationchange', function(){ window.setTimeout(scheduleDynamicSurface, 120); });
  window.addEventListener('pageshow', scheduleDynamicSurface);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'visible') scheduleDynamicSurface();
  });
  window.addEventListener('elo-native-connectivity', syncConnectivity);
  syncDynamicSurface();
  syncConnectivity();
  [0, 100, 300, 700, 1500, 3000, 6000].forEach(function(delay){ window.setTimeout(scheduleDynamicSurface, delay); });
})();
    """.trimIndent()
        .replace("__ELO_QA_BUILD__", isQaBuild.toString())
        .replace(
            "__ELO_ACTIONS_LAYOUT_CSS__",
            if (isQaBuild) "" else "body[data-elo-product=\"chat\"] .elo-core-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;}"
        )
        .replace(
            "__ELO_ACTIONS_MOBILE_CSS__",
            if (isQaBuild) "" else "@media(max-width:599px){body[data-elo-product=\"chat\"] .elo-core-actions{grid-column:1/-1;width:100%;justify-content:space-between;}body[data-elo-product=\"chat\"] .elo-core-actions button{flex:1 1 auto;min-width:0;padding:0 7px;font-size:11px;}}"
        )
    }

    private fun qaHeaderOverrideScript(): String = """
(function(){
  if (window.__eloAndroidHeaderQaOverridesV1) return;
  window.__eloAndroidHeaderQaOverridesV1 = true;

  var style = document.createElement('style');
  style.id = 'elo-android-header-qa-overrides';
  style.textContent = [
    '.elo-native-status-chip,.elo-native-auth-chip{display:none!important;}',
    '@media(max-width:768px){',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated){display:flex!important;flex-direction:column!important;width:100%!important;height:100dvh!important;min-height:100dvh!important;overflow:hidden!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-desktop-sidebar{display:none!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-product-top{position:relative!important;inset:auto!important;transform:none!important;display:flex!important;flex:0 0 auto!important;align-items:stretch!important;justify-content:center!important;width:calc(100vw - 16px)!important;max-width:820px!important;height:auto!important;min-height:0!important;max-height:none!important;margin:calc(env(safe-area-inset-top,0px) + 8px) auto 0!important;padding:0!important;overflow:visible!important;border:0!important;background:transparent!important;box-shadow:none!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-local-auth{position:relative!important;inset:auto!important;box-sizing:border-box!important;width:100%!important;max-width:520px!important;margin:0 auto!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-product-shell{display:flex!important;flex:1 1 0!important;flex-direction:column!important;width:100%!important;height:auto!important;min-height:0!important;margin:0!important;padding:12px 10px max(16px,env(safe-area-inset-bottom,0px))!important;overflow:hidden!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-product-center{width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important;align-items:stretch!important;justify-content:flex-start!important;margin:0!important;transform:none!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-product-chat{width:100%!important;max-width:none!important;min-width:0!important;min-height:0!important;flex:1 1 auto!important;margin:0!important;}',
    'body[data-elo-product="chat"].elo-auth-required:not(.elo-authenticated) .elo-local-auth-form button{box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;text-align:center!important;width:auto!important;height:31.5px!important;min-height:31.5px!important;padding:0 20px!important;border-radius:15.75px!important;line-height:1.2!important;}',
    '}'
  ].join('\n');
  document.querySelectorAll('.elo-native-status-chip,.elo-native-auth-chip').forEach(function(node){ node.remove(); });
  (document.head || document.documentElement).appendChild(style);
})();
    """.trimIndent()

    private fun isQaDebugBuild(): Boolean = BuildConfig.FLAVOR == "qa" && BuildConfig.BUILD_TYPE == "debug"
}
