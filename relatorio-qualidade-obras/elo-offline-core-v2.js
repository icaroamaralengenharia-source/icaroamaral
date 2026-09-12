(function (root) {
  "use strict";

  var state = { topic: "", lastAnswer: "", lastResult: null };
  var technical = {
    impermeabilizacao: "Impermeabilização é o conjunto de técnicas e produtos que impede a passagem de água para proteger a edificação. A base é preparar o substrato, tratar fissuras e encontros, aplicar o sistema especificado e testar antes de proteger.",
    alvenaria: "Uma sequência básica de alvenaria é: conferir locação e prumo; preparar a base; marcar vãos; assentar blocos com juntas controladas; conferir alinhamento, prumo e nível; executar vergas/contravergas; e liberar para instalações e revestimento após a cura necessária.",
    concreto: "Para concreto, confira forma, armadura, cobrimento, limpeza e passagens antes da concretagem; lance e adense sem segregação; faça acabamento e cura; depois registre resistência e não conformidades.",
    argamassa: "Argamassa exige traço compatível, materiais limpos, mistura homogênea, substrato preparado, espessura controlada e cura. Evite corrigir excesso de água no local.",
    revestimento: "Revestimentos devem seguir preparo da base, chapisco quando aplicável, emboço regularizado, juntas e acabamento compatíveis com o ambiente.",
    cobertura: "Em cobertura, verifique caimento, sobreposições, arremates, rufos, calhas, fixações e teste de estanqueidade antes da entrega.",
    instalacoes: "Instalações devem ser conferidas por projeto, prumadas, testes de estanqueidade/continuidade, identificação e proteção antes do fechamento.",
    quantitativos: "Quantitativos confiáveis dependem de unidade, dimensões, perdas justificadas e memória de cálculo. Separe medido, previsto e executado.",
    fiscalizacao: "Fiscalização registra serviço, local, data, evidência, critério de aceitação, responsável e ação corretiva; não substitui a responsabilidade técnica.",
    patologias: "Patologia construtiva deve ser descrita por manifestação, localização, extensão, evolução e hipótese; a causa só deve ser confirmada após investigação.",
    acessibilidade: "Acessibilidade exige conferir rota, desníveis, largura, circulação, alcance, sinalização e uso real conforme o projeto e a legislação aplicável.",
    arquitetura: "Uma boa decisão arquitetônica relaciona programa, orientação solar, ventilação, circulação, estrutura, instalações, acessibilidade e manutenção.",
    medicao: "Medição deve comparar o executado com o critério contratual, registrar unidade, quantidade, período, evidências e pendências.",
    orcamento: "Orçamento preliminar precisa declarar escopo, unidade, quantidade, preço de referência, BDI/perdas quando aplicáveis e limitações.",
    vistoria: "Vistoria começa por identificação do imóvel, ambiente e condição; registre evidência objetiva, risco, recomendação e necessidade de retorno.",
    impermeabilizacao_materiais: "Escolha o sistema de impermeabilização conforme pressão de água, movimentação, exposição, substrato e proteção mecânica.",
    fundacao: "Antes da fundação, confira locação, sondagem, cotas, escavação, lastro, armaduras, formas, drenagem e sequência de concretagem.",
    piso: "Piso exige base firme e limpa, regularidade, caimento, juntas, paginação, argamassa adequada e proteção durante a cura.",
    seguranca: "Segurança de obra começa por planejamento de riscos, isolamento, acesso seguro, EPI/EPC, treinamento e inspeção diária.",
    projeto: "Leia um projeto identificando escala, cotas, eixos, níveis, legenda, cortes, detalhes e compatibilização com as demais disciplinas."
  };

  var rules = [
    ["greeting", ["oi", "olá", "ola", "fala elo", "bom dia", "boa tarde", "boa noite", "e aí", "eai", "salve", "como vai", "tudo bem"], "Bom dia, chefe. O que manda?"],
    ["thanks", ["obrigado", "obrigada", "valeu", "agradeço", "brigado", "show", "perfeito"], "Tamo junto, chefe."],
    ["bye", ["tchau", "até mais", "ate mais", "falou", "vou sair", "encerrar", "despedida"], "Até mais, chefe. Fico por aqui."],
    ["confirm", ["sim", "isso", "correto", "exato", "pode ser", "confirmo", "fechado", "combinado"], "Fechado. Pode mandar a próxima."],
    ["deny", ["não", "nao", "negativo", "deixa", "cancelar", "cancela", "esquece"], "Tudo bem. Não vou executar essa ação."],
    ["help", ["ajuda", "me ajude", "socorro", "o que você faz", "o que voce faz", "comandos", "pode fazer"], "Posso conversar, calcular, responder dúvidas técnicas locais, consultar a biblioteca de engenharia e tocar mídia disponível offline."],
    ["identity", ["quem é você", "quem e voce", "seu nome", "fala de você", "fala de voce"], "Sou o ELO, assistente local de obra, arquitetura e conversa."],
    ["offline", ["estou sem internet", "estou offline", "sem internet", "modo avião", "modo aviao", "tem internet"], "Consigo continuar com as funções locais. Só aviso sobre conexão quando o pedido realmente precisar de internet."],
    ["music_next", ["próxima música", "proxima musica", "pular música", "pular musica", "outra música", "outra musica", "voltar", "música anterior", "musica anterior", "embaralhe", "embaralhar"], "A próxima faixa depende da fila local disponível."],
    ["music_stop", ["parar música", "parar musica", "pare a música", "pare a musica", "stop"], "Música parada."],
    ["music_pause", ["pause", "pausar", "pausa", "pausar música", "pausar musica"], "Música pausada."],
    ["music_resume", ["continue", "continuar", "retomar música", "retomar musica", "resume"], "Continuando a música."],
    ["music_volume", ["volume", "aumenta o som", "diminui o som", "mais alto", "mais baixo"], "O volume é controlado pelo dispositivo."],
    ["date_today", ["que dia é hoje", "que dia e hoje", "data de hoje", "hoje é que dia", "hoje e que dia"], ""],
    ["date_tomorrow", ["que dia é amanhã", "que dia e amanha", "amanhã", "amanha", "dia seguinte"], ""],
    ["date_yesterday", ["que dia foi ontem", "que dia era ontem", "ontem"], ""],
    ["date_after_tomorrow", ["depois de amanhã", "depois de amanha"], ""],
    ["date_before_yesterday", ["anteontem", "antes de ontem"], ""],
    ["time", ["que horas são", "que horas sao", "hora atual", "horário", "horario"], ""],
    ["date_weekday", ["que dia será", "que dia sera", "qual o dia da semana", "dia da semana"], ""],
    ["calc", ["quanto é", "quanto e", "calcule", "calcular", "faz a conta", "conta"], ""],
    ["engineering", ["engenharia", "arquitetura", "obra", "concreto", "argamassa", "alvenaria", "impermeabilização", "impermeabilizacao", "patologia", "vistoria", "fiscalização", "fiscalizacao", "quantitativo", "medição", "medicao", "fundação", "fundacao", "revestimento", "cobertura", "acessibilidade"], ""],
    ["online_required", ["pesquise", "pesquisa", "preço atual", "preco atual", "cotação", "cotacao", "notícias", "noticias", "clima", "tempo agora", "busque na internet"], "Chefe, esse pedido depende da internet. Assim que a conexão voltar eu consigo pesquisar."],
    ["continuity", ["e vezes", "vezes", "mais", "menos", "dividido por", "também", "tambem", "e amanhã", "e amanha"], ""]
  ];

  function clean(value) { return String(value == null ? "" : value).replace(/[\u0000-\u001f<>]/g, "").trim(); }
  function norm(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/×/g, " x ").replace(/,/g, ".").replace(/\s+/g, " ").trim(); }
  function number(value) { var text = String(value).trim(); return Number(text.indexOf(",") >= 0 ? text.replace(/\./g, "").replace(",", ".") : text); }
  function fmt(value) { return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6 }).format(value); }
  function day(value) { return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }).format(value); }
  function dateAnswer(offset) { var d = new Date(); d.setDate(d.getDate() + offset); return day(d).replace(/^./, function (c) { return c.toUpperCase(); }); }
  function timeAnswer() { return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date()); }
  function matchRule(text) { var t = norm(text); for (var i = 0; i < rules.length; i += 1) { if (rules[i][1].some(function (phrase) { return t === norm(phrase) || t.indexOf(norm(phrase)) >= 0; })) return rules[i]; } return null; }
  function localDate(text) { var t = norm(text); if (/depois de amanha/.test(t)) return dateAnswer(2); if (/anteontem|antes de ontem/.test(t)) return dateAnswer(-2); if (/amanha|dia seguinte/.test(t)) return dateAnswer(1); if (/ontem/.test(t)) return dateAnswer(-1); if (/hoje|data de hoje|dia sera|dia da semana/.test(t)) return dateAnswer(0); if (/que horas|hora atual|horario/.test(t)) return "Agora são " + timeAnswer() + "."; return null; }
  function evaluate(expression) {
    var text = norm(expression).replace(/quanto e|quanto é|calcule|calcular|faz a conta|conta/g, "").replace(/dividido por|vezes/g, "*").replace(/\bmais\b/g, "+").replace(/\bmenos\b/g, "-").replace(/\bde\b/g, "").trim();
    var percent = text.match(/([\d.]+)\s*%\s*(?:de|do|da)?\s*([\d.]+)/);
    if (percent) return number(percent[1]) * number(percent[2]) / 100;
    var rule3 = text.match(/([\d.]+)\s*(?:esta para|para)\s*([\d.]+).*?([\d.]+)\s*(?:esta para|para)?\s*x/);
    if (rule3) return number(rule3[1]) * number(rule3[3]) / number(rule3[2]);
    var area = text.match(/area.*?([\d.]+)\s*[x×]\s*([\d.]+)/); if (area) return number(area[1]) * number(area[2]);
    var volume = text.match(/(?:volume|laje).*?([\d.]+)\s*[x×]\s*([\d.]+)\s*[x×]\s*([\d.]+)/); if (volume) return number(volume[1]) * number(volume[2]) * number(volume[3]);
    var sqrt = text.match(/(?:raiz quadrada de|raiz de)\s*([\d.]+)/); if (sqrt) return Math.sqrt(number(sqrt[1]));
    var pow = text.match(/([\d.]+)\s*(?:\^|elevado a|potencia de)\s*([\d.]+)/); if (pow) return Math.pow(number(pow[1]), number(pow[2]));
    var convert = text.match(/([\d.]+)\s*(m3|m²|m2|cm|mm|kg|g|l|litros?)\s*(?:para|em|em )\s*(m3|m²|m2|cm|mm|kg|g|l|litros?)/); if (convert) return conversion(number(convert[1]), convert[2], convert[3]);
    var expressionOnly = text.replace(/\bx\b/g, "*").replace(/[^0-9+*/().\-]/g, "");
    if (!/[+*/-]/.test(expressionOnly) || !/^[-+*/().\d]+$/.test(expressionOnly)) return null;
    try { var result = Function("\"use strict\"; return (" + expressionOnly + ")")(); return Number.isFinite(result) ? result : null; } catch (error) { return null; }
  }
  function conversion(value, from, to) { var f = { m: 1, cm: .01, mm: .001, kg: 1, g: .001, l: 1, litros: 1, m2: 1, "m²": 1, m3: 1 }; var units = { m: ["m"], cm: ["cm"], mm: ["mm"], kg: ["kg"], g: ["g"], l: ["l", "litros"], litros: ["l", "litros"], m2: ["m2", "m²"], "m²": ["m2", "m²"], m3: ["m3"] }; if (!f[from] || !f[to] || (from.startsWith("m") !== to.startsWith("m") && from !== to)) return null; return value * f[from] / f[to]; }
  function calculation(text) { var result = evaluate(text); if (result == null) return null; state.lastResult = result; return "Resultado: " + fmt(result) + "."; }
  function music(text) { var lib = root.EloOfflineMediaLibrary; var player = root.EloMediaPlayer; if (!lib || !player) return "O player offline ainda não foi carregado."; var item = lib.find(text); if (!item || !item.files || !item.files.length || item.offlineAvailable === false) return "Essa música ainda não está disponível offline."; player.play(item); state.topic = "music"; return "Tocando " + item.title + " offline."; }
  function musicQueue(text) { var lib = root.EloOfflineMediaLibrary; var player = root.EloMediaPlayer; if (!lib || !player || typeof lib.next !== "function") return "A fila offline ainda não foi carregada."; var t = norm(text); if (/embaralh/.test(t)) { lib.setShuffle(true); return "Embaralhamento ativado para a biblioteca offline."; } var item = lib.next(null, /voltar|anterior/.test(t) ? "back" : "next"); if (!item) return "Essa música ainda não está disponível offline."; if (typeof player.next === "function") player.next(item); else player.play(item); state.topic = "music"; return "Tocando " + item.title + " offline."; }
  function engineering(text) { var t = norm(text); var keys = Object.keys(technical); for (var i = 0; i < keys.length; i += 1) if (t.indexOf(norm(keys[i])) >= 0) return technical[keys[i]]; if (/sequencia.*alvenaria|execucao.*alvenaria/.test(t)) return technical.alvenaria; return "Posso orientar esse tema localmente. Diga o serviço, material ou etapa da obra que você quer analisar."; }
  function resolve(text) {
    var raw = clean(text); var t = norm(raw); if (!t) return null;
    var date = localDate(raw); if (date) { state.topic = "date"; state.lastAnswer = date; return response(date, "offline_date"); }
    if (/próxima|proxima|pular musica|pular música|outra musica|outra música|voltar|anterior|embaralhe|embaralhar/.test(t)) return response(musicQueue(raw), "offline_music_queue");
    if (/toque|toca|reproduza|play|fur elise|für elise|musica/.test(t) && !/pause|parar|pare|continue/.test(t)) return response(music(raw), "offline_music");
    if (/pause|pausar|parar musica|parar música|continue|continuar musica|continuar música/.test(t) && root.EloMediaPlayer) { if (/pause|pausar/.test(t)) root.EloMediaPlayer.pause(); else if (/parar/.test(t)) root.EloMediaPlayer.stop(); else root.EloMediaPlayer.resume(); return response(/parar/.test(t) ? "Música parada." : /pause|pausar/.test(t) ? "Música pausada." : "Música retomada.", "offline_music_control"); }
    if (/pesquise|preco atual|preço atual|cotacao|cotação|noticias|notícias|clima|tempo agora/.test(t)) return response("Chefe, esse pedido depende da internet. Assim que a conexão voltar eu consigo pesquisar.", "online_required");
    var calc = calculation(raw); if (calc) { state.topic = "calculation"; return response(calc, "offline_calculation"); }
    var rule = matchRule(raw); if (rule) { if (rule[0] === "date_today") return response(dateAnswer(0), "offline_date"); if (rule[0] === "date_tomorrow") return response(dateAnswer(1), "offline_date"); if (rule[0] === "date_yesterday") return response(dateAnswer(-1), "offline_date"); if (rule[0] === "date_after_tomorrow") return response(dateAnswer(2), "offline_date"); if (rule[0] === "date_before_yesterday") return response(dateAnswer(-2), "offline_date"); if (rule[0] === "engineering") return response(engineering(raw), "offline_engineering"); if (rule[0] === "continuity" && state.topic === "calculation") { var c = calculation(state.lastResult + " " + raw); if (c) return response(c, "offline_calculation"); } state.topic = rule[0]; return response(rule[2], "offline_conversation"); }
    if (/impermeabil|alvenaria|concreto|argamassa|revestimento|cobertura|instalac|quantitativo|fiscaliza|patologia|vistoria|orcamento|orçamento|arquitetura|acessibilidade|fundacao|fundação/.test(t)) return response(engineering(raw), "offline_engineering");
    if (/pesquise|preco atual|preço atual|cotacao|cotação|noticias|notícias|clima|tempo agora/.test(t)) return response("Chefe, esse pedido depende da internet. Assim que a conexão voltar eu consigo pesquisar.", "online_required");
    return null;
  }
  function response(text, intent) { return { shortAnswer: text, fullAnswer: text, nextAction: "", canSave: false, sessionTheme: "elo_offline_core_v2", sessionIntent: intent, offline: true, backendRequests: 0 }; }
  root.EloOfflineCoreV2 = { version: "2.0.0", resolve: resolve, getState: function () { return JSON.parse(JSON.stringify(state)); }, intentCount: rules.reduce(function (n, rule) { return n + rule[1].length; }, 0), knowledgeCount: Object.keys(technical).length, reset: function () { state = { topic: "", lastAnswer: "", lastResult: null }; } };
})(typeof window !== "undefined" ? window : globalThis);
