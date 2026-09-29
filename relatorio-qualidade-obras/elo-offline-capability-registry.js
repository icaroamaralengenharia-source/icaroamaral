(function attachEloOfflineCapabilityRegistry(global) {
  "use strict";

  const groups = [
    ["IDENTITY", ["quem é você?", "qual é seu nome?", "você é o ELO?", "o que você é?", "você funciona sem internet?", "o que você consegue fazer offline?", "você está online?", "você está offline?", "qual modo você está usando?", "qual versão do aplicativo?"]],
    ["CONNECTIVITY", ["detectar internet ausente", "detectar backend indisponível", "detectar auth expirada", "detectar capability remota indisponível", "distinguir timeout de offline", "distinguir HTTP 500 de offline", "distinguir 401 de offline", "distinguir erro de TTS", "distinguir erro de STT", "explicar recursos locais disponíveis"]],
    ["DATE_TIME", ["que dia é hoje?", "que dia é amanhã?", "que dia foi ontem?", "qual a data de hoje?", "que horas são?", "qual o dia da semana?", "qual o mês atual?", "qual o ano atual?", "daqui a 7 dias será que dia?", "há 10 dias era que data?"]],
    ["CALCULATOR", ["2 + 2", "100 - 37", "12 × 14", "144 ÷ 12", "15% de 200", "acréscimo de 10% em 500", "desconto de 7,5% em 800", "média de 10, 15 e 20", "regra de três simples", "potência e raiz simples"]],
    ["CONVERSIONS", ["m para cm", "cm para m", "mm para cm", "m² para cm²", "m³ para litros", "litros para m³", "kg para g", "t para kg", "MPa para kPa", "graus para percentual"]],
    ["GEOMETRY", ["área de retângulo", "área de quadrado", "área de triângulo", "área de círculo", "perímetro de retângulo", "volume de paralelepípedo", "volume de cilindro", "diagonal simples", "inclinação percentual", "diferença de cota"]],
    ["CONSTRUCTION_QUANTITIES", ["volume de viga", "volume de pilar", "volume de sapata", "volume de laje", "área de parede", "descontar abertura", "área de piso", "área de cobertura", "quantidade por rendimento", "massa por densidade"]],
    ["ENGINEERING", ["carga por comprimento", "carga por área", "peso por massa", "percentual executado", "percentual restante", "diferença medido previsto", "variação percentual", "somatório quantitativos", "custo unitário", "subtotal com BDI informado"]],
    ["TECH_LIBRARY", ["buscar termo técnico", "buscar SINAPI local", "buscar ORSE local", "explicar item técnico", "buscar composição local", "buscar unidade de serviço", "buscar descrição técnica", "buscar material de catálogo", "buscar norma local", "informar referência ausente"]],
    ["MEMORY_CONTEXT", ["lembrar fato local", "listar memória local", "recuperar preferência", "recuperar currentWork", "recuperar currentUnit", "recuperar último contexto", "isolar usuário A e B", "isolar tenant A e B", "não inventar memória remota", "explicar dependência de sincronização"]],
    ["APP_CONTROLS", ["voltar", "ir para início", "abrir chat", "abrir estoque", "abrir RDO", "abrir configurações", "alternar modo escuro", "rolar para o fim", "limpar campo atual", "fechar teclado"]],
    ["LOCAL_FILES", ["reconhecer PDF local", "reconhecer TXT", "reconhecer CSV", "reconhecer MD", "reconhecer imagem", "mostrar nome tipo tamanho", "ler TXT", "ler CSV", "manter arquivo na sessão", "explicar análise remota indisponível"]],
    ["RDO", ["abrir RDO cached", "listar RDO cached", "mostrar data RDO", "mostrar observações RDO", "mostrar equipe RDO", "mostrar atividades RDO", "criar draft local RDO", "editar draft local RDO", "marcar RDO pending sync", "distinguir local de sincronizado"]],
    ["STOCK", ["consultar snapshot estoque", "listar itens cached", "consultar saldo cached", "buscar item por nome", "somar quantidades locais", "mostrar última sincronização", "criar draft de entrada", "criar draft de saída", "marcar operação pending sync", "não alterar saldo oficial offline"]],
    ["VISTORIA", ["abrir vistoria cached", "listar ambientes", "listar itens", "criar draft de observação", "marcar vistoria pendente", "adicionar nota local", "associar foto local", "listar fotos locais", "editar observação", "distinguir vistoria local de sincronizada"]],
    ["MUSIC", ["listar música offline", "tocar faixa local", "pausar música", "retomar música", "parar música", "próxima faixa", "faixa anterior", "embaralhar fila", "informar faixa atual", "não fingir música ausente"]],
    ["VOICE", ["wake ELO local", "reconhecer comando local", "calcular por voz", "responder data por voz", "responder identidade por voz", "tocar música por voz", "parar por voz", "deduplicar comando", "erro STT como voz", "erro TTS como voz"]],
    ["UX_ERRORS", ["mensagem offline curta", "mensagem backend degradado", "mensagem auth requerida", "mensagem capability remota", "não dizer offline no HTTP 500", "não dizer offline no HTTP 401", "não prometer escrita remota", "não vazar stack", "badge consistente", "recuperar após erro"]],
    ["SECURITY", ["isolar usuário", "isolar tenant", "isolar obra", "bloquear cache cruzado", "logout local seguro", "trocar usuário", "rejeitar identidade vazia", "rejeitar tenant vazio", "não sincronizar outro tenant", "falhar fechado em ID inválido"]],
    ["CONTINUITY_SYNC", ["reload local", "cold start cacheado", "revalidar cache stale", "reconectar backend", "sincronizar draft", "não duplicar sync", "preservar conflito", "resolver conflito documentado", "continuar após backend fail", "preservar contexto local"]]
  ];

  function buildCapabilities() {
    let id = 1;
    const result = [];
    groups.forEach(function (group) {
      group[1].forEach(function (prompt) {
        result.push({
          id: String(id).padStart(3, "0"),
          category: group[0],
          prompt,
          expectedRoute: ["IDENTITY", "CONNECTIVITY", "DATE_TIME", "CALCULATOR", "CONVERSIONS", "GEOMETRY", "CONSTRUCTION_QUANTITIES", "ENGINEERING", "TECH_LIBRARY", "MEMORY_CONTEXT", "APP_CONTROLS", "LOCAL_FILES", "RDO", "STOCK", "VISTORIA", "MUSIC", "VOICE", "UX_ERRORS", "SECURITY", "CONTINUITY_SYNC"].indexOf(group[0]) >= 0 ? "LOCAL" : "REMOTE",
          expectedResultType: group[0] === "CONNECTIVITY" ? "STATE" : ["RDO", "STOCK", "VISTORIA"].indexOf(group[0]) >= 0 ? "LOCAL_DATA" : "ANSWER",
          networkCallsExpected: 0,
          localAvailable: true,
          source: "elo-offline-capability-registry-v1"
        });
        id += 1;
      });
    });
    return result;
  }

  const capabilities = buildCapabilities();

  global.EloOfflineCapabilityRegistry = {
    version: "1.0.0",
    list: function () { return capabilities.map(function (item) { return Object.assign({}, item); }); },
    get: function (id) { return capabilities.find(function (item) { return item.id === String(id).padStart(3, "0"); }) || null; },
    count: function () { return capabilities.length; },
    categories: function () { return Array.from(new Set(capabilities.map(function (item) { return item.category; }))); }
  };
})(typeof window !== "undefined" ? window : globalThis);
