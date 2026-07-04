(function (root) {
  "use strict";

  const VERSION = "20260704-elo-budget-eap-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) {
    const parsed = Number(String(value || "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  function slug(value) {
    return normalize(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "item";
  }
  function unique(items) {
    const seen = {};
    return (items || []).filter(function (item) {
      const key = normalize(item);
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  const STAGES = {
    premissas: "Premissas",
    preliminares: "Servicos preliminares",
    movimento_terra: "Movimento de terra",
    fundacao_baldrame: "Fundacao / baldrame",
    alvenaria: "Alvenaria",
    instalacoes: "Instalacoes",
    estrutura_superior: "Estrutura superior / forro / laje",
    cobertura: "Cobertura",
    revestimentos: "Revestimentos",
    pisos_paredes: "Pisos e paredes",
    esquadrias: "Esquadrias",
    loucas_metais: "Loucas e metais",
    pintura: "Pintura",
    finalizacao: "Finalizacao",
    reforma_banheiro: "Reforma de banheiro"
  };

  function stageList(ids) {
    return ids.map(function (id, index) {
      return { id: id, ordem: index + 1, nome: STAGES[id] || id.replace(/_/g, " ") };
    });
  }

  function item(stageId, nome, disciplina, unidadeEsperada, termosBusca, quantidadeBase, options) {
    const safe = options || {};
    return {
      id: safe.id || stageId + "_" + slug(nome),
      etapaId: stageId,
      nome: nome,
      disciplina: disciplina,
      unidadeEsperada: unidadeEsperada || "un",
      obrigatorio: safe.obrigatorio !== false,
      origem: "eap-canonica",
      termosBusca: termosBusca || [nome],
      quantidadeBase: quantidadeBase || null,
      pendencias: (safe.pendencias || []).slice(),
      bloqueadores: (safe.bloqueadores || []).slice()
    };
  }

  function quantity(value, unit, source) {
    return value ? { valor: value, unidade: unit, origem: source || "inferida" } : null;
  }

  function inferType(input, text) {
    const type = normalize(input.tipo || input.type || input.projectType || input.tipoObra);
    if (/muro/.test(type) || /\bmuro\b/.test(text)) return "muro";
    if (/banheiro/.test(type) || (/banheiro/.test(text) && /reforma|demolicao|retirada/.test(text))) return "banheiro";
    return "casa";
  }

  function normalizeInput(input) {
    const safe = input || {};
    const text = normalize([safe.originalMessage, safe.message, safe.descricao, safe.description].join(" "));
    const area = number(safe.areaConstruidaM2 || safe.builtAreaM2 || safe.areaM2);
    const length = number(safe.comprimentoM || safe.lengthM || safe.wallLengthM);
    const height = number(safe.alturaM || safe.heightM || safe.wallHeightM);
    const width = number(safe.larguraM || safe.widthM);
    const depth = number(safe.profundidadeM || safe.depthM);
    const ambientes = safe.ambientes || {};
    const bathrooms = number(ambientes.banheiros || safe.banheiros || safe.bathrooms);
    const suites = number(ambientes.suites || safe.suites);
    return {
      raw: safe,
      text: text,
      tipo: inferType(safe, text),
      areaConstruidaM2: area,
      comprimentoM: length,
      alturaM: height,
      larguraM: width,
      profundidadeM: depth,
      uf: clean(safe.uf || safe.state || safe.estado || safe.cityUf),
      padrao: clean(safe.padrao || safe.projectStandard || safe.padraoAcabamento),
      fundacao: clean(safe.fundacao || safe.foundationType),
      ambientes: ambientes,
      banheiros: bathrooms + suites,
      cobertura: clean(safe.cobertura || safe.roofMaterial),
      parede: clean(safe.parede || safe.wallMaterial),
      piso: clean(safe.piso || safe.floorMaterial),
      temAreaServico: Number(ambientes.areaServico || safe.areaServico || 0) > 0,
      temPortao: /portao|portão/.test(text) || safe.portao === true,
      box: /box/.test(text) || safe.box === true || /medio|m[eé]dio/.test(clean(safe.padrao || safe.projectStandard))
    };
  }

  function addProblem(target, id, message, severity) {
    target.push({ id: id, message: message, severity: severity || "alta" });
  }

  function finalize(type, stages, items, pendencias, bloqueadores, assumidos) {
    const itemPending = items.some(function (entry) {
      return entry.obrigatorio && ((entry.pendencias || []).length || (entry.bloqueadores || []).length);
    });
    return {
      version: VERSION,
      tipo: type,
      etapas: stages,
      itens: items,
      pendencias: pendencias,
      bloqueadores: bloqueadores,
      assumidos: assumidos,
      podeFecharOrcamentoCompleto: false,
      podeGerarEstimativaPreliminar: true,
      resumo: {
        totalEtapas: stages.length,
        totalItens: items.length,
        totalPendencias: pendencias.length,
        totalBloqueadores: bloqueadores.length,
        possuiItemObrigatorioPendente: itemPending
      }
    };
  }

  function buildHouseEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.areaConstruidaM2) addProblem(bloqueadores, "area_construida", "Casa sem area construida informada.", "critica");
    if (!ctx.uf) addProblem(pendencias, "cidade_uf", "Cidade/UF nao informada para base SINAPI/ORSE.", "alta");
    if (!ctx.padrao) assumidos.push("padrao_simples_preliminar");
    if (!ctx.fundacao) {
      assumidos.push("fundacao_superficial_a_confirmar");
      addProblem(pendencias, "tipo_fundacao", "Tipo de fundacao ainda precisa ser confirmado.", "alta");
    }
    if (!ctx.banheiros) addProblem(pendencias, "banheiros", "Numero de banheiros nao informado.", "critica");

    const area = quantity(ctx.areaConstruidaM2, "m2", "area_construida");
    const bathrooms = ctx.banheiros || 1;
    const stages = stageList(["premissas", "preliminares", "movimento_terra", "fundacao_baldrame", "alvenaria", "instalacoes", "estrutura_superior", "cobertura", "revestimentos", "pisos_paredes", "esquadrias", "loucas_metais", "pintura", "finalizacao"]);
    const items = [
      item("premissas", "area construida", "premissas", "m2", ["area construida"], area, { bloqueadores: ctx.areaConstruidaM2 ? [] : ["area_construida"] }),
      item("premissas", "cidade/UF", "premissas", "un", ["cidade uf", "sinapi uf"], null, { pendencias: ctx.uf ? [] : ["cidade_uf"] }),
      item("premissas", "padrao de acabamento", "premissas", "un", ["padrao acabamento"], null),
      item("premissas", "tipo de fundacao", "fundacao", "un", ["tipo fundacao", "sapata", "radier"], null, { pendencias: ctx.fundacao ? [] : ["tipo_fundacao"] }),
      item("preliminares", "limpeza do terreno", "preliminares", "m2", ["limpeza terreno"], area),
      item("preliminares", "locacao da obra", "preliminares", "m2", ["locacao de obra", "gabarito"], area),
      item("movimento_terra", "escavacao de valas/sapatas", "movimento_terra", "m3", ["escavacao valas", "escavacao sapata"]),
      item("movimento_terra", "reaterro compactado", "movimento_terra", "m3", ["reaterro compactado", "compactacao"]),
      item("fundacao_baldrame", "concreto magro quando aplicavel", "fundacao", "m3", ["concreto magro", "lastro concreto"]),
      item("fundacao_baldrame", "forma", "fundacao", "m2", ["forma fundacao", "forma madeira"]),
      item("fundacao_baldrame", "aco", "fundacao", "kg", ["aco ca-50", "armacao fundacao"]),
      item("fundacao_baldrame", "concreto", "fundacao", "m3", ["concreto fundacao", "concreto fck"]),
      item("fundacao_baldrame", "viga baldrame", "fundacao", "m", ["viga baldrame", "concreto viga baldrame"]),
      item("fundacao_baldrame", "impermeabilizacao do baldrame", "impermeabilizacao", "m2", ["impermeabilizacao baldrame", "pintura asfaltica"]),
      item("alvenaria", "alvenaria de bloco/tijolo", "alvenaria", "m2", ["alvenaria bloco ceramico", "bloco tijolo"], area),
      item("alvenaria", "argamassa de assentamento", "alvenaria", "m3", ["argamassa assentamento"]),
      item("alvenaria", "vergas", "alvenaria", "m", ["verga alvenaria"]),
      item("alvenaria", "contravergas", "alvenaria", "m", ["contraverga alvenaria"]),
      item("instalacoes", "eletrica embutida", "eletrica", "pt", ["ponto eletrico", "eletroduto"]),
      item("instalacoes", "hidraulica", "hidraulica", "pt", ["ponto hidraulico", "agua fria"]),
      item("instalacoes", "esgoto sanitario", "esgoto", "pt", ["ponto esgoto", "tubulacao esgoto"]),
      item("instalacoes", "aguas pluviais quando aplicavel", "pluvial", "m", ["aguas pluviais", "condutor pluvial"]),
      item("instalacoes", "caixas/ralos", "instalacoes", "un", ["caixa sifonada", "ralo"]),
      item("instalacoes", "testes", "instalacoes", "un", ["teste estanqueidade", "teste eletrico"]),
      item("estrutura_superior", "vigas/cintas superiores", "estrutura", "m", ["cinta respaldo", "viga superior"]),
      item("estrutura_superior", "laje ou forro conforme input", "estrutura", "m2", ["laje", "forro"], area),
      item("estrutura_superior", "escoramento quando aplicavel", "estrutura", "m2", ["escoramento laje"]),
      item("cobertura", "estrutura do telhado", "cobertura", "m2", ["estrutura telhado", "madeiramento cobertura"], area),
      item("cobertura", "telhamento", "cobertura", "m2", ["telhamento", ctx.cobertura || "telha ceramica"], area),
      item("cobertura", "cumeeira", "cobertura", "m", ["cumeeira"]),
      item("cobertura", "rufos/calhas quando aplicavel", "cobertura", "m", ["rufo", "calha"]),
      item("revestimentos", "chapisco", "revestimento", "m2", ["chapisco alvenaria"]),
      item("revestimentos", "emboco/reboco interno", "revestimento", "m2", ["emboco interno", "reboco interno"]),
      item("revestimentos", "emboco/reboco externo", "revestimento", "m2", ["emboco externo", "reboco externo"]),
      item("pisos_paredes", "contrapiso", "piso", "m2", ["contrapiso argamassa"], area),
      item("pisos_paredes", "piso", "piso", "m2", [ctx.piso || "piso ceramico", "porcelanato"], area),
      item("pisos_paredes", "argamassa colante", "piso", "kg", ["argamassa colante"]),
      item("pisos_paredes", "rejunte", "piso", "kg", ["rejunte"]),
      item("pisos_paredes", "revestimento de parede em areas molhadas", "revestimento", "m2", ["revestimento banheiro", "revestimento cozinha"]),
      item("pisos_paredes", "rodape", "piso", "m", ["rodape"]),
      item("esquadrias", "portas internas", "esquadria", "un", ["porta interna"]),
      item("esquadrias", "porta externa", "esquadria", "un", ["porta externa"]),
      item("esquadrias", "janelas", "esquadria", "un", ["janela aluminio", "janela"]),
      item("esquadrias", "ferragens/fechaduras", "esquadria", "un", ["ferragem porta", "fechadura"]),
      item("loucas_metais", "vaso sanitario por banheiro", "loucas_metais", "un", ["vaso sanitario"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "lavatorio por banheiro", "loucas_metais", "un", ["lavatorio banheiro"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "chuveiro por banheiro", "loucas_metais", "un", ["chuveiro"], quantity(bathrooms, "un", "banheiros")),
      item("loucas_metais", "box por banheiro quando especificado ou padrao medio", "loucas_metais", "un", ["box banheiro"], ctx.box ? quantity(bathrooms, "un", "banheiros") : null),
      item("loucas_metais", "pia/cuba da cozinha", "loucas_metais", "un", ["pia cozinha", "cuba cozinha"], quantity(1, "un", "cozinha")),
      item("loucas_metais", "torneira cozinha", "loucas_metais", "un", ["torneira cozinha"], quantity(1, "un", "cozinha")),
      item("loucas_metais", "tanque da area de servico quando houver", "loucas_metais", "un", ["tanque area de servico"], ctx.temAreaServico ? quantity(1, "un", "area_servico") : null),
      item("loucas_metais", "registros", "loucas_metais", "un", ["registro gaveta", "registro pressao"]),
      item("loucas_metais", "ralos", "loucas_metais", "un", ["ralo banheiro", "ralo area servico"]),
      item("loucas_metais", "caixa sifonada", "loucas_metais", "un", ["caixa sifonada"]),
      item("pintura", "selador", "pintura", "m2", ["selador parede"]),
      item("pintura", "massa quando aplicavel", "pintura", "m2", ["massa corrida", "massa acrilica"]),
      item("pintura", "pintura interna", "pintura", "m2", ["pintura interna", "tinta pva"]),
      item("pintura", "pintura externa", "pintura", "m2", ["pintura externa", "tinta acrilica"]),
      item("pintura", "pintura de teto", "pintura", "m2", ["pintura teto"]),
      item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final obra"], area)
    ];
    return finalize("casa", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildWallEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.comprimentoM) addProblem(bloqueadores, "comprimento_muro", "Muro sem comprimento informado.", "critica");
    if (!ctx.alturaM) addProblem(bloqueadores, "altura_muro", "Muro sem altura informada.", "critica");
    const area = ctx.comprimentoM && ctx.alturaM ? quantity(ctx.comprimentoM * ctx.alturaM, "m2", "comprimento_altura") : null;
    const stages = stageList(["preliminares", "movimento_terra", "fundacao_baldrame", "alvenaria", "revestimentos", "pintura", "finalizacao"]);
    const items = [
      item("preliminares", "locacao", "preliminares", "m", ["locacao muro", "gabarito muro"], quantity(ctx.comprimentoM, "m", "comprimento")),
      item("movimento_terra", "escavacao", "movimento_terra", "m3", ["escavacao baldrame", "escavacao sapata"]),
      item("fundacao_baldrame", "fundacao/baldrame", "fundacao", "m", ["fundacao muro", "viga baldrame muro"]),
      item("fundacao_baldrame", "forma", "fundacao", "m2", ["forma baldrame", "forma concreto"]),
      item("fundacao_baldrame", "aco", "fundacao", "kg", ["aco ca-50", "armacao baldrame"]),
      item("fundacao_baldrame", "concreto", "fundacao", "m3", ["concreto baldrame", "concreto sapata"]),
      item("fundacao_baldrame", "pilares/cintas quando aplicavel", "estrutura", "un", ["pilar muro", "cinta muro"]),
      item("alvenaria", "alvenaria", "alvenaria", "m2", ["alvenaria muro", "bloco ceramico", "bloco concreto"], area),
      item("revestimentos", "chapisco dos dois lados", "revestimento", "m2", ["chapisco muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null),
      item("revestimentos", "reboco dos dois lados", "revestimento", "m2", ["reboco muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null),
      item("pintura", "pintura dos dois lados", "pintura", "m2", ["pintura muro dois lados"], area ? quantity(area.valor * 2, "m2", "duas_faces") : null)
    ];
    if (ctx.temPortao) items.push(item("esquadrias", "portao metalico", "esquadria", "un", ["portao metalico", "instalacao portao"], quantity(1, "un", "citado")));
    items.push(item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final obra"], area));
    return finalize("muro", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildBathroomEap(ctx) {
    const pendencias = [];
    const bloqueadores = [];
    const assumidos = [];
    if (!ctx.larguraM || !ctx.profundidadeM) addProblem(bloqueadores, "dimensoes_banheiro", "Banheiro sem dimensoes informadas.", "critica");
    const area = ctx.larguraM && ctx.profundidadeM ? quantity(ctx.larguraM * ctx.profundidadeM, "m2", "largura_profundidade") : null;
    const stages = stageList(["reforma_banheiro", "instalacoes", "pisos_paredes", "loucas_metais", "pintura", "finalizacao"]);
    const items = [
      item("reforma_banheiro", "demolicao de revestimento", "demolicao", "m2", ["demolicao revestimento banheiro"], area),
      item("reforma_banheiro", "retirada de loucas/metais", "demolicao", "un", ["retirada loucas metais"]),
      item("reforma_banheiro", "transporte/entulho", "demolicao", "m3", ["transporte entulho", "bota fora entulho"]),
      item("reforma_banheiro", "regularizacao", "revestimento", "m2", ["regularizacao banheiro"], area),
      item("reforma_banheiro", "impermeabilizacao", "impermeabilizacao", "m2", ["impermeabilizacao banheiro", "argamassa polimerica"], area),
      item("pisos_paredes", "piso", "piso", "m2", ["piso banheiro", "piso ceramico"], area),
      item("pisos_paredes", "argamassa colante", "piso", "kg", ["argamassa colante"]),
      item("pisos_paredes", "rejunte", "piso", "kg", ["rejunte"]),
      item("pisos_paredes", "revestimento de parede", "revestimento", "m2", ["revestimento parede banheiro"]),
      item("loucas_metais", "vaso sanitario", "loucas_metais", "un", ["vaso sanitario"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "lavatorio", "loucas_metais", "un", ["lavatorio banheiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "chuveiro", "loucas_metais", "un", ["chuveiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "ralo", "loucas_metais", "un", ["ralo banheiro"], quantity(1, "un", "banheiro")),
      item("loucas_metais", "caixa sifonada", "loucas_metais", "un", ["caixa sifonada"], quantity(1, "un", "banheiro")),
      item("instalacoes", "ponto de agua", "hidraulica", "pt", ["ponto agua banheiro"], quantity(1, "pt", "banheiro")),
      item("instalacoes", "ponto de esgoto", "esgoto", "pt", ["ponto esgoto banheiro"], quantity(1, "pt", "banheiro")),
      item("instalacoes", "eletrica minima", "eletrica", "pt", ["ponto eletrico banheiro", "interruptor banheiro"]),
      item("pintura", "pintura de teto", "pintura", "m2", ["pintura teto banheiro"], area),
      item("finalizacao", "limpeza final", "finalizacao", "m2", ["limpeza final banheiro"], area)
    ];
    return finalize("banheiro", stages, items, pendencias, bloqueadores, assumidos);
  }

  function buildEloBudgetEap(input) {
    const ctx = normalizeInput(input || {});
    if (ctx.tipo === "muro") return buildWallEap(ctx);
    if (ctx.tipo === "banheiro") return buildBathroomEap(ctx);
    return buildHouseEap(ctx);
  }

  root.EloBudgetEapEngine = {
    version: VERSION,
    buildEloBudgetEap: buildEloBudgetEap
  };
  root.buildEloBudgetEap = buildEloBudgetEap;
})(typeof window !== "undefined" ? window : globalThis);
