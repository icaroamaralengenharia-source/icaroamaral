(function () {
  "use strict";

  function sanitizeText_(value) {
    return String(value || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
  }

  function normalizeText_(value) {
    return sanitizeText_(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function extractLocation_(rawText, category) {
    const text = sanitizeText_(rawText);
    const patterns = category === "weather"
      ? [
        /\b(?:em|de|para)\s+([^?.,;]+)$/i,
        /\b(?:temperatura|clima|tempo|previsao|previsão)\s+(?:em|de|para)\s+([^?.,;]+)/i
      ]
      : [/\b(?:em|no|na)\s+([^?.,;]+)$/i];
    for (let index = 0; index < patterns.length; index += 1) {
      const match = text.match(patterns[index]);
      if (match && match[1]) return sanitizeText_(match[1]);
    }
    return "";
  }

  function detectTimezone_(text, context) {
    if (/\bjapao\b|\bjapan\b|\btokyo\b|\btoquio\b/.test(text)) return { timeZone: "Asia/Tokyo", label: "Japão" };
    if (/\bportugal\b|\blisboa\b/.test(text)) return { timeZone: "Europe/Lisbon", label: "Portugal" };
    if (/\bestados unidos\b|\beua\b|\bnew york\b|\bnova york\b/.test(text)) return { timeZone: "America/New_York", label: "Nova York" };
    if (/\blondres\b|\breino unido\b/.test(text)) return { timeZone: "Europe/London", label: "Londres" };
    if (context && context.timeZone && /\b(?:e\s+se|fosse|ai|la|nesse caso)\b/.test(text)) return { timeZone: context.timeZone, label: context.locationLabel || "local informado" };
    return { timeZone: "", label: "" };
  }

  function buildSearchQuery_(rawText, category, context) {
    const question = sanitizeText_(rawText);
    const text = normalizeText_(question);
    if (category === "weather") {
      const previousLocation = context && context.category === "weather" ? sanitizeText_(context.location || "") : "";
      const location = extractLocation_(question, "weather") || previousLocation;
      if (/^e\s+amanha\b|\bamanha\b/.test(text) && location) return "previsão do tempo em " + location + " amanhã";
      if (location) return "temperatura atual em " + location;
    }
    if (category === "finance") {
      if (/\bdolar\b/.test(text)) return "cotação dólar hoje real brasileiro";
      if (/\beuro\b/.test(text)) return "cotação euro hoje real brasileiro";
      if (/\bbitcoin\b|\bbtc\b/.test(text)) return "preço bitcoin agora";
    }
    if (category === "current_fact") return question + " atualmente";
    if (category === "local") return question + " agora";
    return question;
  }

  function classifyLiveDataNeed(text, context) {
    const question = sanitizeText_(text);
    const normalized = normalizeText_(question);
    const previous = context && typeof context === "object" ? context : {};
    if (!normalized) return { needsLiveData: false, category: "none", confidence: 0, reason: "empty" };
    if (/\b(?:quanto e|quanto é)\s*\d+\s*(?:\+|-|x|\*|\/|dividido por)\s*\d+/.test(normalized)) return { needsLiveData: false, category: "none", confidence: 0.99, reason: "simple_math" };
    if (/\b(?:piada|poema|explique|explica|o que e|o que é|quem escreveu dom casmurro|fotossintese|fotossíntese|concreto protendido)\b/.test(normalized)) return { needsLiveData: false, category: "none", confidence: 0.9, reason: "stable_knowledge_or_creative" };

    const explicit = /\b(?:pesquise|pesquisar|busque|buscar|procure|consulte|verifique|olhe na internet|veja na web|google)\b/.test(normalized);
    const timezone = detectTimezone_(normalized, previous);

    if (/\b(?:que dia e hoje|qual dia e hoje|data de hoje|data atual|que horas sao|que horas são|hora atual|horario atual)\b/.test(normalized) ||
        (previous.category === "date_time" && /\b(?:e\s+se|fosse|japao|japan|tokyo|toquio|no japao)\b/.test(normalized))) {
      return { needsLiveData: true, category: "date_time", confidence: 0.99, reason: timezone.timeZone ? "current_date_time_timezone" : "current_date_time", timeZone: timezone.timeZone, locationLabel: timezone.label, lookup: "local_clock" };
    }

    if (/\b(?:temperatura|clima agora|clima|previsao|previsão|vai chover|maxima|minima|máxima|mínima|tempo em|tempo para)\b/.test(normalized) ||
        (previous.category === "weather" && /^e\s+(?:amanha|hoje|depois|mais tarde)\b/.test(normalized))) {
      const location = extractLocation_(question, "weather") || sanitizeText_(previous.location || "");
      return { needsLiveData: true, category: "weather", confidence: location ? 0.98 : 0.88, reason: /^e\s+amanha\b/.test(normalized) ? "weather_follow_up" : "current_weather", location: location, searchQuery: buildSearchQuery_(question, "weather", previous), lookup: "web_search" };
    }

    if (/\b(?:dolar|euro|bitcoin|btc|cotacao|cotação|preco atual|preço atual|valor atual|selic|ipca|incc|bolsa|acao|ações|acoes)\b/.test(normalized)) return { needsLiveData: true, category: "finance", confidence: 0.95, reason: "current_finance", searchQuery: buildSearchQuery_(question, "finance", previous), lookup: "web_search" };
    if (/\b(?:noticias|notícias|ultimas noticias|últimas notícias|aconteceu hoje|novidades recentes|mais recente)\b/.test(normalized)) return { needsLiveData: true, category: "news", confidence: 0.92, reason: "current_news", searchQuery: question, lookup: "web_search" };
    if (/\b(?:quem ganhou|placar|proximo jogo|próximo jogo|classificacao atual|classificação atual|resultado do jogo|rodada|agenda de jogos)\b/.test(normalized)) return { needsLiveData: true, category: "sports", confidence: 0.92, reason: "current_sports", searchQuery: question, lookup: "web_search" };
    if (/\b(?:presidente do brasil|presidente atualmente|ceo atual|quem e o ceo|quem é o ceo|versao atual|versão atual|atualmente|neste momento)\b/.test(normalized)) return { needsLiveData: true, category: "current_fact", confidence: 0.88, reason: "mutable_current_fact", searchQuery: buildSearchQuery_(question, "current_fact", previous), lookup: "web_search" };
    if (/\b(?:aberto agora|funciona hoje|horario de funcionamento|horário de funcionamento|restaurante|transito|trânsito|perto de mim)\b/.test(normalized)) return { needsLiveData: true, category: "local", confidence: 0.86, reason: "current_local_info", searchQuery: buildSearchQuery_(question, "local", previous), lookup: "web_search" };
    if (explicit) return { needsLiveData: true, category: "search", confidence: 0.82, reason: "explicit_search", searchQuery: question, lookup: "web_search" };

    return { needsLiveData: false, category: "none", confidence: 0.2, reason: "stable_or_chat" };
  }

  window.EloLiveDataRouter = { classifyLiveDataNeed: classifyLiveDataNeed };
})();
