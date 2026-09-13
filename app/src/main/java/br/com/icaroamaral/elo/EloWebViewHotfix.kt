package br.com.icaroamaral.elo

object EloWebViewHotfix {
    fun connectivityScript(state: String): String {
        val safeState = state.replace("'", "")
        return """
(function(){
  document.documentElement.setAttribute('data-elo-native-connectivity', '$safeState');
  window.dispatchEvent(new CustomEvent('elo-native-connectivity', { detail: { state: '$safeState' } }));
})();
        """.trimIndent()
    }

    fun installScript(): String = """
(function(){
  if (window.__eloAndroid021PhysicalHotfixV1) return;
  window.__eloAndroid021PhysicalHotfixV1 = true;

  var css = [
    'html,body{width:100%;max-width:100%;overflow-x:hidden;}',
    'body[data-elo-product="chat"] .elo-product-top{box-sizing:border-box;max-width:calc(100vw - 16px);min-width:0;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;}',
    'body[data-elo-product="chat"] .elo-product-brand,body[data-elo-product="chat"] .elo-core-actions,body[data-elo-product="chat"] .elo-local-auth,body[data-elo-product="chat"] .elo-local-auth-session{min-width:0;}',
    'body[data-elo-product="chat"] .elo-core-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:6px;}',
    'body[data-elo-product="chat"] .elo-core-actions button,body[data-elo-product="chat"] .elo-local-auth-session button{white-space:nowrap;}',
    '.elo-native-status-chip{display:inline-flex;align-items:center;gap:5px;min-height:26px;padding:0 8px;border-radius:999px;border:1px solid rgba(22,163,74,.18);color:#166534;background:rgba(22,163,74,.08);font-size:11px;font-weight:800;white-space:nowrap;}',
    '.elo-native-pause-button{min-height:30px;padding:0 10px;border-radius:999px;border:1px solid rgba(34,211,238,.38);background:#0f172a;color:#e0f2fe;font-size:12px;font-weight:900;white-space:nowrap;box-shadow:0 8px 22px rgba(15,23,42,.18);}',
    '.elo-native-pause-button:active{transform:translateY(1px);}',
    'html[data-elo-native-connectivity]:not([data-elo-native-connectivity="ONLINE_VALIDATED"]) .elo-native-status-chip{border-color:rgba(180,83,9,.22);color:#92400e;background:#fffbeb;}',
    'html[data-elo-native-connectivity]:not([data-elo-native-connectivity="ONLINE_VALIDATED"]) .elo-native-status-chip::before{content:"";width:7px;height:7px;border-radius:999px;background:#f59e0b;}',
    'html[data-elo-native-connectivity="ONLINE_VALIDATED"] .elo-native-status-chip::before{content:"";width:7px;height:7px;border-radius:999px;background:#16a34a;}',
    'body[data-elo-product="chat"] .elo-history-list{width:100%;max-width:100%;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:10px;align-items:stretch;}',
    'body[data-elo-product="chat"] .elo-history-item{width:100%;min-width:0;box-sizing:border-box;}',
    'body[data-elo-product="chat"] .elo-history-title,body[data-elo-product="chat"] .elo-history-meta,body[data-elo-product="chat"] .elo-history-summary{overflow-wrap:anywhere;}',
    'body[data-elo-product="chat"] .elo-standalone-panel.is-history-view,body[data-elo-product="chat"] [data-elo-history-panel],body[data-elo-product="chat"] .elo-history-panel{width:min(100%,960px);max-width:960px;}',
    'body[data-elo-product="chat"] .elo-product-chat,body[data-elo-product="chat"] .elo-product-center{min-width:0;}',
    '@media(max-width:599px){body[data-elo-product="chat"] .elo-product-top{grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:6px;padding:7px 8px;}body[data-elo-product="chat"] .elo-product-brand{grid-row:1;}.elo-native-status-chip{grid-row:1;justify-self:end;}body[data-elo-product="chat"] .elo-core-actions{grid-column:1/-1;width:100%;justify-content:space-between;}body[data-elo-product="chat"] .elo-core-actions button{flex:1 1 auto;min-width:0;padding:0 7px;font-size:11px;}body[data-elo-product="chat"] .elo-local-auth-session{grid-column:1/-1;width:100%;justify-content:flex-end;}body[data-elo-product="chat"] .elo-local-auth-session [data-elo-auth-user]{max-width:48vw;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}body[data-elo-product="chat"] .elo-product-shell{padding-top:104px;}}',
    '@media(orientation:landscape) and (max-height:520px){body[data-elo-product="chat"] .elo-product-top{top:6px;min-height:42px;}body[data-elo-product="chat"] .elo-product-shell{padding-top:58px;}body[data-elo-product="chat"] .elo-product-center,body[data-elo-product="chat"].elo-chat-state .elo-product-center{width:min(100%,calc(100vw - 18px));max-width:none;}body[data-elo-product="chat"] .elo-product-chat,body[data-elo-product="chat"] .elo-product-chat .elo-standalone-panel,body[data-elo-product="chat"] .elo-product-chat .elo-standalone-panel.is-chat-active{max-width:none;}body[data-elo-product="chat"] .elo-standalone-panel.is-history-view,body[data-elo-product="chat"] [data-elo-history-panel],body[data-elo-product="chat"] .elo-history-panel{width:min(100%,calc(100vw - 18px));max-width:none;}}'
  ].join('\n');
  var style = document.createElement('style');
  style.id = 'elo-android-021-hotfix';
  style.textContent = css;
  document.head.appendChild(style);

  function ensureStatusChip(){
    var top = document.querySelector('.elo-product-top');
    if (!top || document.querySelector('.elo-native-status-chip')) return;
    var chip = document.createElement('span');
    chip.className = 'elo-native-status-chip';
    chip.setAttribute('aria-live', 'polite');
    chip.textContent = 'Online';
    top.insertBefore(chip, top.children[1] || null);
  }
  function ensurePauseButton(){
    var actions = document.querySelector('.elo-core-actions') || document.querySelector('.elo-local-auth-session') || document.querySelector('.elo-product-top');
    if (!actions || document.querySelector('.elo-native-pause-button')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'elo-native-pause-button';
    button.textContent = 'EDU-REX';
    button.setAttribute('aria-label', 'Abrir EDU-REX');
    button.setAttribute('title', 'EDU-REX');
    button.addEventListener('click', function(event){
      event.preventDefault();
      event.stopImmediatePropagation();
      try {
        if (window.EloPauseGame && typeof window.EloPauseGame.open === 'function') {
          window.EloPauseGame.open();
        }
      } catch (err) {}
      return false;
    }, true);
    actions.appendChild(button);
  }
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
      if (!isLocalMedia(media) || !window.EloNativeBridge || !window.EloNativeBridge.playResolvedOfflineMusic) return false;
      var command = resolvedMusicCommand(media);
      var raw = window.EloNativeBridge.playResolvedOfflineMusic(command);
      var parsed = JSON.parse(raw || '{}');
      if (parsed && parsed.handled) {
        console.info('ELO_NATIVE_LOCAL_MUSIC_FALLBACK', command, parsed.trackId || '');
        return true;
      }
    } catch (err) {}
    return false;
  }
  function wrapMediaPlayerMethod(player, name){
    if (!player || typeof player[name] !== 'function' || player[name].__eloNativeWrapped) return;
    var original = player[name];
    var wrapped = function(media){
      if (callNativeResolvedMusic(media)) return Promise.resolve(true);
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
  }
  var observer = new MutationObserver(function(){ ensureStatusChip(); ensurePauseButton(); normalizeActionButtons(); removeIntrusiveOfflineNotices(); improveHistoryCards(); installNativeLocalMusicFallback(); });
  observer.observe(document.documentElement, { childList:true, subtree:true });
  window.addEventListener('resize', function(){ normalizeActionButtons(); removeIntrusiveOfflineNotices(); improveHistoryCards(); });
  window.addEventListener('orientationchange', function(){ window.setTimeout(function(){ normalizeActionButtons(); improveHistoryCards(); }, 120); });
  window.addEventListener('elo-native-connectivity', syncConnectivity);
  ensureStatusChip();
  ensurePauseButton();
  normalizeActionButtons();
  syncConnectivity();
  improveHistoryCards();
  installNativeLocalMusicFallback();
  window.setInterval(syncConnectivity, 3000);
  window.setInterval(installNativeLocalMusicFallback, 1000);
})();
    """.trimIndent()
}