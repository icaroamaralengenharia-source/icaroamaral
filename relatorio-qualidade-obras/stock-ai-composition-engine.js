(function () {
  "use strict";

  const LIBRARY_VERSION = "1.6";
  const DEMO_SOURCE = "Base técnica demonstrativa/editável";
  const DEMO_WARNING = "Composição demonstrativa/editável. Validar antes de orçamento, compra oficial ou medição contratual.";
  const PURCHASE_WARNING = "Lista de compra gerada a partir de composições demonstrativas/editáveis e saldo local. Validar antes de compra oficial.";

  function clean(value) {
    return String(value || "").trim();
  }

  function normalize(value) {
    return clean(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseNumber(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) ? value : 0;
    }
    const normalized = clean(value).replace(/\./g, "").replace(",", ".");
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function roundQuantity(value) {
    const parsed = parseNumber(value);
    return Math.round((parsed + Number.EPSILON) * 1000) / 1000;
  }

  function formatQuantity(value) {
    return roundQuantity(value).toLocaleString("pt-BR");
  }

  function normalizeUnit(unit) {
    const normalized = normalize(unit);
    if (normalized === "m2" || normalized.indexOf("quadrado") >= 0) {
      return "m2";
    }
    if (normalized === "m3" || normalized.indexOf("cubico") >= 0) {
      return "m3";
    }
    if (normalized === "m") {
      return "m";
    }
    if (normalized === "kg" || normalized === "quilo" || normalized === "quilos") {
      return "kg";
    }
    if (normalized === "ponto" || normalized === "pontos") {
      return "un";
    }
    if (normalized === "un" || normalized === "und" || normalized === "unidade" || normalized === "unidades") {
      return "un";
    }
    return normalized || "un";
  }

  function displayUnit(unit) {
    const normalized = normalizeUnit(unit);
    if (normalized === "m2") {
      return "m²";
    }
    if (normalized === "m3") {
      return "m³";
    }
    return clean(unit) || normalized || "un";
  }

  function material(name, coefficient, unit, note) {
    return {
      id: "mat_" + normalize(name).replace(/\s+/g, "_") + "_" + normalizeUnit(unit),
      name: name,
      material: name,
      quantityPerUnit: coefficient,
      coefficient: coefficient,
      unit: unit || "un",
      note: note || "Coeficiente demonstrativo/editavel."
    };
  }

  function composition(id, service, category, productionUnit, lossPercent, materials, aliases, note) {
    return {
      id: id,
      service: service,
      name: service,
      category: category || "Geral",
      productionUnit: productionUnit || "un",
      unit: productionUnit || "un",
      lossPercent: lossPercent || 0,
      source: DEMO_SOURCE,
      note: note || DEMO_WARNING,
      warning: note || DEMO_WARNING,
      libraryVersion: LIBRARY_VERSION,
      aliases: aliases || [],
      materials: materials || []
    };
  }

  const DEFAULT_COMPOSITIONS = [
    composition("std_escavacao_manual", "Escavacao manual", "Fundacao / Estrutura", "m3", 8, [
      material("Mao de obra de escavacao", 1.2, "h"),
      material("Remocao manual de solo", 1, "m3"),
      material("Ferramentas manuais", 0.05, "un")
    ], ["escavacao", "vala", "sapata", "fundacao"]),
    composition("std_lastro_concreto_magro", "Lastro de concreto magro", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 4.5, "saco"),
      material("Areia", 0.55, "m3"),
      material("Brita", 0.75, "m3")
    ], ["lastro", "concreto magro", "regularizacao de fundo"]),
    composition("std_concreto_simples", "Concreto simples", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 7, "saco"),
      material("Areia", 0.55, "m3"),
      material("Brita", 0.8, "m3")
    ], ["concreto", "concreto simples", "concreto nao armado"]),
    composition("std_concreto_estrutural", "Concreto estrutural", "Fundacao / Estrutura", "m3", 5, [
      material("Cimento", 8, "saco"),
      material("Areia media", 0.52, "m3"),
      material("Brita 1", 0.78, "m3"),
      material("Aditivo plastificante", 0.8, "litro")
    ], ["concreto armado", "concreto estrutural", "estrutura", "viga", "pilar", "laje"]),
    composition("std_forma_madeira", "Forma de madeira", "Fundacao / Estrutura", "m2", 10, [
      material("Compensado plastificado", 0.22, "m2"),
      material("Sarrafo de madeira", 0.55, "m"),
      material("Prego", 0.08, "kg"),
      material("Desmoldante", 0.04, "litro")
    ], ["forma", "caixaria", "madeira forma"]),
    composition("std_armacao_aco_ca50", "Armacao de aco CA-50", "Fundacao / Estrutura", "kg", 5, [
      material("Aco CA-50", 1, "kg"),
      material("Arame recozido", 0.025, "kg"),
      material("Espacador plastico", 0.08, "un")
    ], ["armacao", "armação", "ferro", "aco", "aço", "ca50"]),
    composition("std_pilar_concreto_armado", "Pilar de concreto armado", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 95, "kg"),
      material("Forma de madeira", 8, "m2")
    ], ["pilar", "coluna"]),
    composition("std_viga_concreto_armado", "Viga de concreto armado", "Fundacao / Estrutura", "m3", 5, [
      material("Concreto estrutural", 1, "m3"),
      material("Aco CA-50", 85, "kg"),
      material("Forma de madeira", 6.5, "m2")
    ], ["viga", "baldrame"]),
    composition("std_laje_concreto", "Laje macica ou pre-moldada", "Fundacao / Estrutura", "m2", 5, [
      material("Concreto estrutural", 0.1, "m3"),
      material("Aco CA-50", 7, "kg"),
      material("Forma/escoramento", 1, "m2")
    ], ["laje", "laje macica", "laje premoldada", "pre-moldada"]),
    composition("std_alvenaria", "Alvenaria de bloco ceramico", "Alvenaria / Vedacao", "m2", 5, [
      material("Bloco ceramico", 13, "un"),
      material("Cimento", 0.1, "saco"),
      material("Areia", 0.018, "m3"),
      material("Argamassa de assentamento", 18, "kg")
    ], ["alvenaria", "parede", "bloco", "bloco ceramico", "tijolo ceramico", "vedacao"]),
    composition("std_alvenaria_bloco_concreto", "Alvenaria de bloco de concreto", "Alvenaria / Vedacao", "m2", 5, [
      material("Bloco de concreto", 12.5, "un"),
      material("Argamassa de assentamento", 0.02, "m3"),
      material("Cimento", 0.12, "saco")
    ], ["parede bloco concreto", "bloco concreto", "alvenaria estrutural"]),
    composition("std_verga_contraverga", "Verga e contraverga", "Alvenaria / Vedacao", "m", 5, [
      material("Concreto estrutural", 0.025, "m3"),
      material("Aco CA-50", 1.4, "kg"),
      material("Forma de madeira", 0.25, "m2")
    ], ["verga", "contraverga", "abertura"]),
    composition("std_grauteamento_simples", "Grauteamento simples", "Alvenaria / Vedacao", "m3", 5, [
      material("Graute", 1, "m3"),
      material("Cimento", 7, "saco"),
      material("Pedrisco", 0.75, "m3")
    ], ["graute", "grauteamento"]),
    composition("std_chapisco", "Chapisco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.05, "saco"),
      material("Areia", 0.006, "m3")
    ], ["chapisco", "massa chapisco"]),
    composition("std_emboco", "Emboco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.07, "saco"),
      material("Areia", 0.018, "m3")
    ], ["emboco", "emboço", "massa grossa", "massa"]),
    composition("std_reboco", "Reboco", "Revestimentos", "m2", 5, [
      material("Cimento", 0.08, "saco"),
      material("Areia", 0.02, "m3")
    ], ["reboco", "massa fina", "massa"]),
    composition("std_contrapiso", "Contrapiso", "Revestimentos", "m2", 5, [
      material("Cimento", 0.12, "saco"),
      material("Areia", 0.025, "m3")
    ], ["contrapiso", "regularizacao piso", "regularização piso"]),
    composition("std_piso", "Piso ceramico", "Revestimentos", "m2", 3, [
      material("Piso ceramico", 1.05, "m2"),
      material("Argamassa colante", 0.25, "saco"),
      material("Rejunte", 0.2, "kg")
    ], ["piso", "piso ceramico", "ceramica piso"]),
    composition("std_revestimento", "Revestimento ceramico de parede", "Revestimentos", "m2", 3, [
      material("Revestimento ceramico", 1.05, "m2"),
      material("Argamassa colante", 0.25, "saco"),
      material("Rejunte", 0.18, "kg")
    ], ["revestimento", "azulejo", "ceramica parede", "parede ceramica"]),
    composition("std_rejuntamento", "Rejuntamento", "Revestimentos", "m2", 3, [
      material("Rejunte", 0.22, "kg"),
      material("Espacador", 0.08, "un"),
      material("Limpeza pos-rejunte", 0.02, "litro")
    ], ["rejunte", "rejuntamento"]),
    composition("std_pintura", "Pintura interna", "Revestimentos", "m2", 5, [
      material("Tinta", 0.12, "litro"),
      material("Massa corrida", 0.18, "kg")
    ], ["pintura", "pintura interna", "tinta parede"]),
    composition("std_pintura_externa", "Pintura externa", "Revestimentos", "m2", 5, [
      material("Tinta acrilica externa", 0.14, "litro"),
      material("Selador acrilico", 0.08, "litro"),
      material("Massa acrilica", 0.15, "kg")
    ], ["pintura externa", "fachada", "tinta externa"]),
    composition("std_telhado_madeira", "Estrutura de madeira para telhado", "Cobertura", "m2", 7, [
      material("Madeiramento", 0.045, "m3"),
      material("Ripa", 2.8, "m"),
      material("Caibro", 1.2, "m"),
      material("Terca de madeira", 0.35, "m"),
      material("Prego/parafuso de fixacao", 0.1, "kg"),
      material("Tratamento preservativo", 0.05, "litro")
    ], ["estrutura telhado", "madeiramento", "telhado madeira", "caibro", "ripa", "terca", "estrutura de madeira"]),
    composition("std_telhado", "Telha ceramica", "Cobertura", "m2", 7, [
      material("Telha ceramica", 16, "un"),
      material("Cumeeira ceramica", 0.25, "un"),
      material("Prego/arame de fixacao", 0.04, "kg")
    ], ["telhado", "telha", "telha ceramica", "cobertura ceramica"]),
    composition("std_telha_fibrocimento", "Telha fibrocimento", "Cobertura", "m2", 5, [
      material("Telha fibrocimento", 1.05, "m2"),
      material("Parafuso de fixacao", 2.5, "un"),
      material("Arruela de vedacao", 2.5, "un")
    ], ["fibrocimento", "telha brasilit", "cobertura fibrocimento"]),
    composition("std_rufo_calha", "Rufo/calha simples", "Cobertura", "m", 5, [
      material("Chapa galvanizada", 1.05, "m"),
      material("Selante PU", 0.08, "tubo"),
      material("Parafuso/bucha", 2, "un")
    ], ["rufo", "calha", "pingadeira"]),
    composition("std_ponto_eletrico", "Ponto eletrico simples", "Instalacoes", "un", 5, [
      material("Caixa eletrica", 1, "un"),
      material("Eletroduto", 3, "m"),
      material("Cabo eletrico", 9, "m"),
      material("Tomada/interruptor", 1, "un")
    ], ["ponto eletrico", "tomada", "interruptor", "fiacao", "fiação"]),
    composition("std_eletroduto", "Eletroduto embutido", "Instalacoes", "m", 3, [
      material("Eletroduto", 1.03, "m"),
      material("Conexoes eletricas", 0.15, "un"),
      material("Fixadores", 0.4, "un")
    ], ["eletroduto", "conduite", "conduíte"]),
    composition("std_cabo_eletrico", "Cabo eletrico", "Instalacoes", "m", 3, [
      material("Cabo eletrico", 1.05, "m"),
      material("Fita isolante", 0.01, "rolo"),
      material("Identificador", 0.02, "un")
    ], ["cabo", "fio", "fiacao", "fiação", "cabo eletrico"]),
    composition("std_ponto_hidraulico_agua_fria", "Ponto hidraulico agua fria", "Instalacoes", "un", 5, [
      material("Tubo PVC agua fria", 3, "m"),
      material("Conexoes PVC agua fria", 3, "un"),
      material("Registro/terminal", 1, "un")
    ], ["ponto hidraulico", "agua fria", "água fria"]),
    composition("std_ponto_sanitario", "Ponto sanitario", "Instalacoes", "un", 5, [
      material("Tubo PVC esgoto", 3, "m"),
      material("Conexoes PVC esgoto", 3, "un"),
      material("Caixa sifonada/terminal", 0.5, "un")
    ], ["ponto sanitario", "esgoto banheiro"]),
    composition("std_esgoto", "Tubulacao PVC esgoto", "Instalacoes", "m", 3, [
      material("Tubo PVC esgoto", 1.03, "m"),
      material("Conexoes PVC", 0.25, "un")
    ], ["tubulacao esgoto", "tubulação esgoto", "esgoto", "pvc esgoto"]),
    composition("std_agua", "Tubulacao PVC agua fria", "Instalacoes", "m", 3, [
      material("Tubo PVC agua", 1.03, "m"),
      material("Conexoes PVC", 0.2, "un")
    ], ["tubulacao agua", "tubulação agua", "agua fria", "água fria", "pvc agua"]),
    composition("std_impermeabilizacao_simples", "Impermeabilizacao simples", "Outros servicos uteis", "m2", 5, [
      material("Primer", 0.12, "litro"),
      material("Manta/argamassa impermeavel", 1.05, "m2"),
      material("Tela estruturante", 0.15, "m2")
    ], ["impermeabilizacao", "impermeabilização", "manta", "infiltracao"]),
    composition("std_forro_gesso", "Forro de gesso", "Outros servicos uteis", "m2", 5, [
      material("Placa de gesso", 1.05, "m2"),
      material("Perfil metalico", 1.8, "m"),
      material("Parafuso", 12, "un"),
      material("Massa para junta", 0.25, "kg")
    ], ["forro", "gesso", "forro gesso"]),
    composition("std_drywall", "Drywall", "Outros servicos uteis", "m2", 5, [
      material("Chapa drywall", 2.1, "m2"),
      material("Montante/guia metalica", 2.2, "m"),
      material("Parafuso drywall", 18, "un"),
      material("Massa e fita para junta", 0.3, "kg")
    ], ["drywall", "parede drywall", "gesso acartonado"]),
    composition("std_pavimentacao_intertravada", "Pavimentacao intertravada", "Outros servicos uteis", "m2", 5, [
      material("Paver/bloco intertravado", 1.03, "m2"),
      material("Areia de assentamento", 0.05, "m3"),
      material("Po de pedra", 0.03, "m3")
    ], ["paver", "intertravado", "pavimentacao", "pavimentação"]),
    composition("std_meio_fio", "Meio-fio", "Outros servicos uteis", "m", 5, [
      material("Meio-fio pre-moldado", 1.02, "m"),
      material("Concreto de assentamento", 0.025, "m3"),
      material("Argamassa de rejunte", 0.006, "m3")
    ], ["meio fio", "meio-fio", "guia"]),
    composition("std_drenagem_simples", "Drenagem simples", "Outros servicos uteis", "m", 5, [
      material("Tubo drenante/PVC", 1.03, "m"),
      material("Brita", 0.08, "m3"),
      material("Manta geotextil", 1.1, "m2")
    ], ["drenagem", "dreno", "agua pluvial", "água pluvial"]),
    composition("std_radier", "Radier", "Fundacao / Estrutura", "m2", 8, [
      material("Concreto estrutural", 0.12, "m3"),
      material("Tela soldada", 1.08, "m2"),
      material("Brita/lastro", 0.06, "m3"),
      material("Lona plastica", 1.05, "m2"),
      material("Espacador", 4, "un")
    ], ["radier", "fundacao radier", "fundação radier", "laje radier", "base radier"],
      "Estimativa preliminar. Validar espessura, armadura, solo, carga e projeto estrutural."),
    composition("std_quadro_distribuicao", "Quadro de distribuicao", "Instalacoes", "un", 5, [
      material("Quadro de distribuicao", 1, "un"),
      material("Disjuntor", 6, "un"),
      material("Barramento", 1, "un"),
      material("Trilho DIN", 1, "un"),
      material("Conectores/terminais", 1, "un"),
      material("Identificacao/circuitos", 1, "un")
    ], ["quadro de distribuicao", "quadro de distribuição", "quadro eletrico", "quadro elétrico", "qdc", "qd", "quadro disjuntores"],
      "Estimativa basica. Validar carga, circuitos, normas e projeto eletrico."),
    composition("std_caixa_dagua", "Caixa d'agua", "Instalacoes", "un", 5, [
      material("Caixa d'agua", 1, "un"),
      material("Flange/adaptador", 2, "un"),
      material("Registro", 1, "un"),
      material("Tubo PVC agua fria", 3, "m"),
      material("Conexoes PVC", 4, "un"),
      material("Fita veda rosca", 1, "un")
    ], ["caixa dagua", "caixa d'agua", "reservatorio", "reservatório", "caixa de agua", "caixa de água"],
      "Validar volume, altura, base de apoio e projeto hidraulico."),
    composition("std_sarjeta_concreto", "Sarjeta de concreto", "Outros servicos uteis", "m", 5, [
      material("Concreto simples", 0.04, "m3"),
      material("Forma lateral", 0.3, "m2"),
      material("Brita/regularizacao", 0.03, "m3")
    ], ["sarjeta", "sarjeta de concreto", "canaleta de concreto", "drenagem superficial"],
      "Estimativa preliminar. Validar secao, declividade e drenagem."),
    composition("std_textura_externa", "Textura externa", "Revestimentos", "m2", 8, [
      material("Selador acrilico", 0.08, "litro"),
      material("Textura acrilica", 1.2, "kg"),
      material("Fita/mascaramento", 0.03, "un")
    ], ["textura externa", "textura acrilica externa", "textura fachada", "grafiato", "revestimento texturizado"],
      "Validar rendimento do fabricante, tipo de superficie e numero de demaos."),
    composition("std_tela_soldada", "Tela soldada", "Fundacao / Estrutura", "m2", 8, [
      material("Tela soldada", 1.08, "m2"),
      material("Espacador", 4, "un"),
      material("Arame recozido", 0.03, "kg")
    ], ["tela soldada", "tela q92", "tela q138", "malha pop", "tela para concreto", "armadura em tela"],
      "Validar tipo da tela, bitola, malha, transpasse e projeto estrutural.")
  ];

  function getCompositions() {
    return DEFAULT_COMPOSITIONS.map(function (item) {
      return Object.assign({}, item, {
        aliases: (item.aliases || []).slice(),
        materials: (item.materials || []).map(function (mat) {
          return Object.assign({}, mat);
        })
      });
    });
  }

  const EXTRA_ALIASES_BY_ID = {
    std_escavacao_manual: ["escavar", "escavar vala", "vala", "fundacao", "fundação"],
    std_lastro_concreto_magro: ["lastro", "lastro de concreto", "concreto magro"],
    std_concreto_simples: ["concreto simples", "concreto nao armado", "concretagem simples"],
    std_concreto_estrutural: ["concreto estrutural", "concreto armado"],
    std_armacao_aco_ca50: ["aco", "aço", "aco ca 50", "aco ca-50", "ca 50", "ca-50", "armadura", "armacao", "armação", "ferro", "vergalhao", "vergalhão", "arame"],
    std_pilar_concreto_armado: ["pilar", "pilar de concreto", "pilar de concreto armado", "coluna"],
    std_viga_concreto_armado: ["viga", "viga de concreto", "viga de concreto armado", "baldrame"],
    std_laje_concreto: ["laje", "laje macica", "laje pre moldada", "laje premoldada"],
    std_alvenaria: ["alvenaria", "parede", "bloco ceramico", "bloco cerâmico", "tijolo ceramico", "tijolo cerâmico", "tijolo baiano"],
    std_alvenaria_bloco_concreto: ["alvenaria de bloco de concreto", "parede de bloco de concreto", "bloco de concreto", "bloco concreto"],
    std_verga_contraverga: ["verga", "contraverga", "verga e contraverga"],
    std_grauteamento_simples: ["graute", "grautear", "grauteamento"],
    std_rejuntamento: ["rejunte", "rejuntar", "rejuntamento"],
    std_pintura: ["pintura interna", "pintar parede interna", "pintar", "tinta interna"],
    std_pintura_externa: ["pintura externa", "pintar fachada", "fachada", "tinta externa"],
    std_telhado_madeira: ["madeiramento", "estrutura de madeira", "estrutura de madeira para telhado", "caibro", "ripa", "terca", "terça"],
    std_telhado: ["telhado", "cobertura", "cobrir", "telha ceramica", "telha cerâmica", "quantas telhas"],
    std_telha_fibrocimento: ["telha fibrocimento", "fibrocimento", "cobertura fibrocimento"],
    std_rufo_calha: ["rufo", "calha", "rufo e calha", "rufo/calha"],
    std_ponto_eletrico: ["ponto eletrico", "ponto elétrico", "pontos eletricos", "pontos elétricos", "eletrica", "elétrica"],
    std_eletroduto: ["eletroduto", "eletroduto embutido"],
    std_cabo_eletrico: ["cabo eletrico", "cabo elétrico", "fiacao", "fiação"],
    std_ponto_hidraulico_agua_fria: ["ponto hidraulico", "ponto hidráulico", "pontos hidraulicos", "agua fria", "água fria"],
    std_ponto_sanitario: ["ponto sanitario", "ponto sanitário", "pontos sanitarios", "pontos sanitários"],
    std_tubulacao_pvc_esgoto: ["tubulacao pvc esgoto", "tubulação pvc esgoto", "tubo esgoto", "esgoto"],
    std_tubulacao_pvc_agua_fria: ["tubulacao pvc agua fria", "tubulação pvc água fria", "tubo agua fria", "tubo água fria", "agua fria", "água fria"],
    std_drenagem_simples: ["drenagem", "dreno", "tubo drenante", "drenagem simples"],
    std_meio_fio: ["meio fio", "meio-fio", "guia"],
    std_pavimentacao_intertravada: ["paver", "intertravado", "pavimentacao intertravada", "pavimentação intertravada"],
    std_radier: ["radier", "fundacao radier", "fundação radier", "laje radier", "base radier"],
    std_quadro_distribuicao: ["quadro de distribuicao", "quadro de distribuição", "quadro eletrico", "quadro elétrico", "qdc", "qd", "quadro disjuntores"],
    std_caixa_dagua: ["caixa dagua", "caixa d agua", "caixa d'agua", "caixa de agua", "caixa de água", "reservatorio", "reservatório"],
    std_sarjeta_concreto: ["sarjeta", "sarjeta de concreto", "canaleta de concreto", "drenagem superficial"],
    std_textura_externa: ["textura externa", "textura acrilica externa", "textura acrílica externa", "textura fachada", "grafiato", "revestimento texturizado"],
    std_tela_soldada: ["tela soldada", "tela q92", "tela q138", "malha pop", "tela para concreto", "armadura em tela"]
  };

  function getCompositionTerms(item) {
    return [item.service, item.name, item.category]
      .concat(item.aliases || [])
      .concat(EXTRA_ALIASES_BY_ID[item.id] || [])
      .map(normalize)
      .filter(Boolean)
      .filter(function (term, index, list) {
        return list.indexOf(term) === index;
      });
  }

  function wordCount(text) {
    return normalize(text).split(" ").filter(Boolean).length;
  }

  function hasTerm(text, term) {
    const cleanTerm = normalize(term);
    if (!cleanTerm) {
      return false;
    }
    return (" " + text + " ").indexOf(" " + cleanTerm + " ") >= 0 || text.indexOf(cleanTerm) >= 0;
  }

  function blocksComposition(text, item) {
    const id = item.id;
    if ((id === "std_alvenaria" || id === "std_concreto_simples") && hasTerm(text, "bloco de concreto")) {
      return true;
    }
    if (id === "std_alvenaria" && (hasTerm(text, "pintar") || hasTerm(text, "pintura externa") || hasTerm(text, "pintura interna"))) {
      return true;
    }
    if (id === "std_pintura" && hasTerm(text, "pintura externa")) {
      return true;
    }
    if (id === "std_piso" && (hasTerm(text, "rejuntar") || hasTerm(text, "rejuntamento"))) {
      return true;
    }
    if (id === "std_concreto_estrutural" && (hasTerm(text, "pilar") || hasTerm(text, "viga") || hasTerm(text, "baldrame") || hasTerm(text, "laje"))) {
      return true;
    }
    if (id === "std_alvenaria" && (hasTerm(text, "grautear") || hasTerm(text, "grauteamento") || hasTerm(text, "graute"))) {
      return true;
    }
    if (id === "std_telhado" && hasTerm(text, "fibrocimento")) {
      return true;
    }
    if (id === "std_laje_concreto" && hasTerm(text, "tela soldada")) {
      return true;
    }
    if (id === "std_concreto_simples" && hasTerm(text, "sarjeta")) {
      return true;
    }
    return false;
  }

  function scoreComposition(item, text, requestedUnit) {
    if (blocksComposition(text, item)) {
      return -1;
    }
    const service = normalize(item.service);
    const unit = normalizeUnit(requestedUnit);
    let score = 0;
    if (service && text === service) {
      score += 1000;
    } else if (service && hasTerm(text, service)) {
      score += 700 + wordCount(service) * 25;
    }
    getCompositionTerms(item).forEach(function (term) {
      if (!term || term === service || !hasTerm(text, term)) {
        return;
      }
      const words = wordCount(term);
      score += words > 1 ? 360 + words * 35 : 240;
    });
    if (unit && unit !== "un" && normalizeUnit(item.productionUnit) === unit) {
      score += 40;
    }
    return score;
  }

  function rankCompositions(query, options) {
    const settings = options || {};
    const text = normalize(typeof query === "string" ? query : (query && (query.service || query.name || query.id)));
    const unit = normalizeUnit(settings.unit || (query && query.unit));
    if (!text) {
      return [];
    }
    return getCompositions().map(function (item) {
      return {
        item: item,
        score: scoreComposition(item, text, unit)
      };
    }).filter(function (entry) {
      return entry.score > 0;
    }).sort(function (a, b) {
      return b.score - a.score || wordCount(b.item.service) - wordCount(a.item.service);
    });
  }

  function findComposition(query) {
    const ranked = rankCompositions(query);
    return ranked.length ? ranked[0].item : null;
  }

  function hasAny(text, terms) {
    return terms.some(function (term) {
      return text.indexOf(normalize(term)) >= 0;
    });
  }

  function isCompositionRequest(message) {
    const text = normalize(message);
    const intentTerms = [
      "composicao", "compor", "calcular materiais", "calcule materiais",
      "materiais para", "qual material", "quanto material", "quantas telhas",
      "qual o madeiramento", "vou fazer", "vou executar", "quero fazer",
      "quero construir", "preciso fazer", "consumo previsto", "lista de material",
      "lista de materiais", "quantitativo", "quanto comprar", "quanto preciso",
      "preciso calcular", "quero cobrir", "cobrir", "instalar", "executar",
      "rejuntar", "pintar", "grautear", "escavar", "concretar"
    ];
    return hasAny(text, intentTerms) && rankCompositions(text).length > 0;
  }

  function normalizeRequestedUnit(unit) {
    return displayUnit(unit);
  }

  function parseRequestLegacy(message) {
    const originalMessage = clean(message);
    const text = normalize(originalMessage);
    const quantityMatch = originalMessage.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|m\b|un\b)/i);
    const hasIntent = isCompositionRequest(originalMessage);
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : (hasIntent ? 1 : 0);
    const unit = quantityMatch ? normalizeRequestedUnit(quantityMatch[2]) : "";
    const services = [];

    [
      ["Alvenaria de bloco ceramico", "m2", ["alvenaria", "parede", "bloco ceramico", "tijolo ceramico"]],
      ["Chapisco", "m2", ["chapisco"]],
      ["Emboco", "m2", ["emboco", "massa grossa"]],
      ["Reboco", "m2", ["reboco", "massa fina"]],
      ["Pintura interna", "m2", ["pintura", "tinta"]],
      ["Telha ceramica", "m2", ["telhado", "telha ceramica", "cobertura"]],
      ["Telha fibrocimento", "m2", ["telha fibrocimento", "fibrocimento"]],
      ["Estrutura de madeira para telhado", "m2", ["madeiramento", "caibro", "ripa", "terca", "estrutura de madeira"]],
      ["Concreto simples", "m3", ["concreto simples", "concreto"]],
      ["Concreto estrutural", "m3", ["concreto estrutural", "concreto armado"]],
      ["Piso ceramico", "m2", ["piso ceramico", "piso"]],
      ["Revestimento ceramico de parede", "m2", ["revestimento", "azulejo"]]
    ].forEach(function (rule) {
      const service = rule[0];
      const defaultUnit = rule[1];
      const terms = rule[2];
      if (!hasAny(text, terms)) {
        return;
      }
      if (service === "Emboco" && text.indexOf("reboco") >= 0 && text.indexOf("emboco") < 0 && text.indexOf("massa grossa") < 0) {
        return;
      }
      if (service === "Concreto simples" && (text.indexOf("concreto estrutural") >= 0 || text.indexOf("concreto armado") >= 0)) {
        return;
      }
      if (service === "Telha ceramica" && text.indexOf("fibrocimento") >= 0) {
        return;
      }
      services.push({
        service: service,
        quantity: quantity,
        unit: unit || displayUnit(defaultUnit),
        requestedUnit: unit,
        materialHint: terms.find(function (term) { return text.indexOf(normalize(term)) >= 0; }) || ""
      });
    });

    if (text.indexOf("massa") >= 0 &&
      !services.some(function (item) { return item.service === "Emboco"; }) &&
      !services.some(function (item) { return item.service === "Reboco"; })) {
      services.push({ service: "Emboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
      services.push({ service: "Reboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa" });
    }

    return {
      originalMessage: originalMessage,
      quantity: quantity,
      unit: unit,
      assumedBaseQuantity: !quantityMatch && quantity > 0,
      services: services.filter(function (item, index, list) {
        return list.findIndex(function (candidate) { return normalize(candidate.service) === normalize(item.service); }) === index;
      })
    };
  }

  function parseRequest(message) {
    const originalMessage = clean(message);
    const text = normalize(originalMessage);
    const quantityMatch = originalMessage.match(/(\d+(?:[.,]\d+)?)\s*(m²|m2|m³|m3|metro quadrado|metros quadrados|metro cubico|metros cubicos|metro cúbico|metros cúbicos|kg|quilo|quilos|ponto|pontos|m\b|un\b|und\b|unidade|unidades)/i);
    const looseQuantityMatch = !quantityMatch ? originalMessage.match(/\b(\d+(?:[.,]\d+)?)\b/) : null;
    const wordOneQuantity = !quantityMatch && !looseQuantityMatch && /\b(um|uma)\b/i.test(originalMessage);
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : looseQuantityMatch ? parseNumber(looseQuantityMatch[1]) : wordOneQuantity ? 1 : 0;
    const unit = quantityMatch ? normalizeRequestedUnit(quantityMatch[2]) : "";
    const ranked = rankCompositions(text, { unit: unit });
    const bestScore = ranked.length ? ranked[0].score : 0;
    const services = ranked.filter(function (entry) {
      return entry.score >= 100 && entry.score >= Math.max(100, bestScore * 0.2);
    }).slice(0, 6).map(function (entry) {
      return {
        service: entry.item.service,
        quantity: quantity,
        unit: unit || displayUnit(entry.item.productionUnit),
        requestedUnit: unit,
        materialHint: entry.item.service,
        score: entry.score
      };
    });

    if (text.indexOf("massa") >= 0 &&
      !services.some(function (item) { return item.service === "Emboco"; }) &&
      !services.some(function (item) { return item.service === "Reboco"; })) {
      services.push({ service: "Emboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa", score: 180 });
      services.push({ service: "Reboco", quantity: quantity, unit: unit || "m²", requestedUnit: unit, materialHint: "massa", score: 180 });
    }

    if ((hasTerm(text, "madeiramento") || hasTerm(text, "estrutura de madeira") || hasTerm(text, "caibro") || hasTerm(text, "ripa")) &&
      !services.some(function (item) { return item.service === "Estrutura de madeira para telhado"; })) {
      services.push({
        service: "Estrutura de madeira para telhado",
        quantity: quantity,
        unit: unit || "m²",
        requestedUnit: unit,
        materialHint: "madeiramento",
        score: 240
      });
    }

    const uniqueServices = services.filter(function (item, index, list) {
      return list.findIndex(function (candidate) { return normalize(candidate.service) === normalize(item.service); }) === index;
    });

    return {
      originalMessage: originalMessage,
      quantity: quantity,
      unit: unit,
      missingQuantity: isCompositionRequest(originalMessage) && quantity <= 0 && uniqueServices.length > 0,
      assumedBaseQuantity: false,
      services: uniqueServices
    };
  }

  function calculatePredictedConsumption(serviceInput) {
    const input = serviceInput || {};
    const compositionData = input.composition || input.selectedComposition || findComposition(input);
    const executedQuantity = parseNumber(input.quantity || input.executedQuantity);
    const service = clean(input.service || input.serviceName || (compositionData && compositionData.service));
    const unit = clean(input.unit || (compositionData && compositionData.productionUnit)) || "un";
    const result = {
      service: service,
      executedQuantity: roundQuantity(executedQuantity),
      unit: unit,
      composition: compositionData ? {
        id: compositionData.id,
        service: compositionData.service,
        productionUnit: compositionData.productionUnit,
        source: compositionData.source || DEMO_SOURCE,
        lossPercent: parseNumber(compositionData.lossPercent),
        note: compositionData.note || DEMO_WARNING
      } : null,
      predictedItems: [],
      technicalNotes: [],
      warning: DEMO_WARNING
    };

    if (!compositionData || executedQuantity <= 0) {
      result.technicalNotes.push("Sem composicao compativel ou quantidade executada invalida.");
      return result;
    }

    const lossMultiplier = 1 + (parseNumber(compositionData.lossPercent) / 100);
    result.predictedItems = (compositionData.materials || []).map(function (mat, index) {
      const coefficient = parseNumber(mat.quantityPerUnit || mat.coefficient);
      const quantity = roundQuantity(executedQuantity * coefficient * lossMultiplier);
      return {
        id: mat.id || "pred_" + index,
        name: mat.name || mat.material,
        material: mat.name || mat.material,
        coefficient: coefficient,
        quantity: quantity,
        predictedQuantity: quantity,
        unit: mat.unit || "un",
        note: mat.note || DEMO_WARNING,
        sources: [
          service + " " + formatQuantity(executedQuantity) + " " + displayUnit(unit) +
          " · composicao: " + compositionData.service +
          " · fonte: " + (compositionData.source || DEMO_SOURCE)
        ]
      };
    }).filter(function (item) {
      return item.name && parseNumber(item.quantity) > 0;
    });

    result.technicalNotes.push("Perda aplicada: " + formatQuantity(parseNumber(compositionData.lossPercent)) + "%.");
    result.technicalNotes.push(DEMO_WARNING);
    return result;
  }

  function consolidateMaterials(predictedItems) {
    const grouped = {};
    (predictedItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = item.unit || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      if (!grouped[key]) {
        grouped[key] = {
          id: "est_" + key.replace(/[^a-z0-9]+/g, "_"),
          name: name,
          material: name,
          quantity: 0,
          predictedQuantity: 0,
          unit: unit,
          note: "Consumo previsto por composicao tecnica demonstrativa/editavel.",
          sources: []
        };
      }
      grouped[key].quantity += parseNumber(item.quantity || item.predictedQuantity);
      grouped[key].predictedQuantity = grouped[key].quantity;
      grouped[key].sources = grouped[key].sources.concat(item.sources || []);
    });
    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.quantity = roundQuantity(item.quantity);
      item.predictedQuantity = item.quantity;
      if (item.sources.length) {
        item.note += " Origem: " + item.sources.join("; ") + ".";
      }
      return item;
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function calculateMultipleServices(services) {
    const predictions = [];
    const missing = [];
    (services || []).forEach(function (service) {
      const prediction = calculatePredictedConsumption(service);
      if (!prediction.composition || prediction.executedQuantity <= 0) {
        missing.push(service);
        return;
      }
      predictions.push(prediction);
    });
    const items = consolidateMaterials(predictions.reduce(function (list, prediction) {
      return list.concat(prediction.predictedItems || []);
    }, []));
    return {
      items: items,
      predictedItems: items,
      predictions: predictions,
      missing: missing,
      warning: DEMO_WARNING
    };
  }

  function classifyConsumptionStatus(estimated, registered, differencePercent) {
    if (estimated <= 0 && registered > 0) {
      return "sem previsao";
    }
    if (estimated > 0 && registered <= 0) {
      return "sem consumo real";
    }
    if (differencePercent < -25) {
      return "abaixo do previsto";
    }
    if (Math.abs(differencePercent) <= 10) {
      return "dentro do previsto";
    }
    if (differencePercent > 25) {
      return "critico";
    }
    return "atencao";
  }

  function comparePredictedVsActual(predictedItems, actualItems) {
    const predicted = {};
    const actual = {};
    (predictedItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = clean(item.unit) || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      predicted[key] = predicted[key] || { name: name, quantity: 0, unit: unit };
      predicted[key].quantity += parseNumber(item.quantity || item.predictedQuantity || item.estimated);
    });
    (actualItems || []).forEach(function (item) {
      const name = clean(item.name || item.material);
      const unit = clean(item.unit) || "un";
      const key = normalize(name) + "|" + normalizeUnit(unit);
      if (!name) {
        return;
      }
      actual[key] = actual[key] || { name: name, quantity: 0, unit: unit };
      actual[key].quantity += parseNumber(item.quantity || item.actualQuantity || item.registered);
    });
    return Object.keys(Object.assign({}, predicted, actual)).map(function (key) {
      const predictedItem = predicted[key];
      const actualItem = actual[key];
      const estimated = roundQuantity(predictedItem ? predictedItem.quantity : 0);
      const registered = roundQuantity(actualItem ? actualItem.quantity : 0);
      const difference = roundQuantity(registered - estimated);
      const differencePercent = estimated > 0 ? roundQuantity((difference / estimated) * 100) : 0;
      return {
        name: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        material: (predictedItem && predictedItem.name) || (actualItem && actualItem.name) || "Material",
        unit: (predictedItem && predictedItem.unit) || (actualItem && actualItem.unit) || "un",
        estimated: estimated,
        predicted: estimated,
        registered: registered,
        actual: registered,
        difference: difference,
        differencePercent: differencePercent,
        status: classifyConsumptionStatus(estimated, registered, differencePercent)
      };
    }).sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  function materialMatchKeys(name) {
    const normalized = normalize(name);
    const aliases = {
      "bloco ceramico": ["bloco", "tijolo", "tijolo ceramico"],
      "cimento": ["cimento cp ii", "cimento cp iv", "cimento portland"],
      "argamassa": ["argamassa colante", "massa", "cimento areia", "argamassa de assentamento"],
      "areia": ["areia media", "areia fina", "areia lavada"],
      "brita": ["brita 1", "pedrisco"],
      "tinta": ["tinta acrilica", "tinta parede"],
      "telha ceramica": ["telha", "telhado"],
      "telha fibrocimento": ["fibrocimento", "telha brasilit"],
      "madeiramento": ["ripa", "caibro", "terca", "estrutura de madeira"],
      "aco ca 50": ["aco", "aço", "ferro", "armacao", "armação"]
    };
    const words = normalized.split(" ").filter(function (word) { return word.length >= 4; });
    const keys = [normalized].concat(words);
    Object.keys(aliases).forEach(function (key) {
      if (normalized.indexOf(key) >= 0 || aliases[key].some(function (alias) { return normalized.indexOf(normalize(alias)) >= 0; })) {
        keys.push(key);
        keys.push.apply(keys, aliases[key].map(normalize));
      }
    });
    return keys.filter(Boolean).filter(function (key, index, list) {
      return list.indexOf(key) === index;
    });
  }

  function matchPredictedMaterialToStockItem(predictedMaterial, stockItems) {
    const materialName = clean(predictedMaterial && (predictedMaterial.name || predictedMaterial.material));
    const materialUnit = normalizeUnit(predictedMaterial && predictedMaterial.unit || "un");
    const keys = materialMatchKeys(materialName);
    const candidates = (stockItems || []).map(function (entry) {
      return entry && entry.item ? entry : {
        item: entry,
        realBalance: entry && entry.realBalance !== undefined ? entry.realBalance : entry && entry.balance
      };
    }).filter(function (entry) {
      return entry && entry.item;
    });
    return candidates.find(function (entry) {
      const item = entry.item || {};
      return normalizeUnit(item.unit || "un") === materialUnit && normalize(item.name) === normalize(materialName);
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = materialMatchKeys(item.name);
      return normalizeUnit(item.unit || "un") === materialUnit && keys.some(function (key) { return itemKeys.indexOf(key) >= 0; });
    }) || candidates.find(function (entry) {
      const item = entry.item || {};
      const itemKeys = materialMatchKeys(item.name);
      return keys.some(function (key) {
        return itemKeys.some(function (itemKey) {
          return key.length >= 4 && itemKey.length >= 4 && (key.indexOf(itemKey) >= 0 || itemKey.indexOf(key) >= 0);
        });
      });
    }) || null;
  }

  function getPurchaseStatus(requiredQuantity, currentBalance, stockMatch) {
    if (!stockMatch) {
      return "sem item no estoque";
    }
    if (currentBalance >= requiredQuantity) {
      return "suficiente";
    }
    if (currentBalance <= 0) {
      return "critico";
    }
    if (requiredQuantity > 0 && currentBalance / requiredQuantity <= 0.25) {
      return "critico";
    }
    return "comprar";
  }

  function getPurchaseStatusRank(status) {
    if (status === "critico") return 4;
    if (status === "sem item no estoque") return 3;
    if (status === "comprar") return 2;
    return 1;
  }

  function buildPurchasePlan(productions, stockItems, options) {
    const settings = options || {};
    const predicted = settings.predictedItems || calculateMultipleServices(productions || []).items;
    const stock = Array.isArray(stockItems) ? stockItems : [];
    const items = (predicted || []).map(function (item) {
      const stockMatch = matchPredictedMaterialToStockItem(item, stock);
      const stockItem = stockMatch && stockMatch.item ? stockMatch.item : null;
      const requiredQuantity = roundQuantity(parseNumber(item.quantity || item.predictedQuantity || item.estimated));
      const currentBalance = stockMatch ? roundQuantity(parseNumber(stockMatch.realBalance)) : 0;
      const purchaseQuantity = roundQuantity(Math.max(requiredQuantity - currentBalance, 0));
      const status = getPurchaseStatus(requiredQuantity, currentBalance, stockMatch);
      return {
        id: "purchase_plan_" + normalize(item.name || item.material) + "_" + normalizeUnit(item.unit || "un"),
        material: item.name || item.material || "Material",
        materialName: item.name || item.material || "Material",
        unit: item.unit || "un",
        predictedQuantity: requiredQuantity,
        requiredQuantity: requiredQuantity,
        currentBalance: currentBalance,
        purchaseQuantity: purchaseQuantity,
        status: status,
        stockItemId: stockItem ? stockItem.id : null,
        stockItemName: stockItem ? stockItem.name : "",
        note: status === "sem item no estoque"
          ? "Material previsto sem item correspondente no estoque local."
          : status === "critico"
            ? "Saldo insuficiente para a producao prevista. Revisar compra antes da execucao."
            : status === "comprar"
              ? "Comprar a diferenca entre consumo previsto e saldo local."
              : "Saldo local atende ao consumo previsto."
      };
    }).sort(function (a, b) {
      return getPurchaseStatusRank(b.status) - getPurchaseStatusRank(a.status) ||
        String(a.materialName || "").localeCompare(String(b.materialName || ""));
    });
    return {
      items: items,
      summary: {
        totalPredicted: items.length,
        sufficient: items.filter(function (item) { return item.status === "suficiente"; }).length,
        toBuy: items.filter(function (item) { return item.status === "comprar"; }).length,
        critical: items.filter(function (item) { return item.status === "critico"; }).length,
        notFound: items.filter(function (item) { return item.status === "sem item no estoque"; }).length
      },
      warning: PURCHASE_WARNING
    };
  }

  function buildAnswerFromMessage(message, options) {
    const settings = options || {};
    const request = parseRequest(message);
    if (request.missingQuantity && request.services.length) {
      const firstService = request.services[0];
      const lines = [
        "Encontrei o serviço " + firstService.service + ", mas preciso saber a quantidade em " + displayUnit(firstService.unit) + " para calcular os materiais.",
        "",
        "Exemplo: \"Vou fazer 80 " + displayUnit(firstService.unit) + " de " + firstService.service + "\".",
        "",
        "Observação:",
        DEMO_WARNING
      ];
      return lines.join("\n");
    }
    if (!request.quantity || !request.services.length) {
      return "";
    }
    const result = calculateMultipleServices(request.services);
    if (!result.items.length) {
      return "";
    }
    const lines = ["Entendi o planejamento:"];
    if (request.assumedBaseQuantity) {
      lines.push("- Área total não informada; usei uma base demonstrativa de 1 m² para listar a composição.");
    }
    request.services.forEach(function (service) {
      lines.push("- " + formatQuantity(service.quantity) + " " + displayUnit(service.unit) + " de " + service.service);
    });
    lines.push("");
    lines.push("Composição estimada:");
    result.items.forEach(function (item) {
      lines.push("- " + item.name + ": " + formatQuantity(item.quantity) + " " + displayUnit(item.unit));
    });
    if (settings.stockItems && settings.stockItems.length) {
      const purchasePlan = buildPurchasePlan(request.services, settings.stockItems, { predictedItems: result.items });
      if (purchasePlan.items.length) {
        lines.push("");
        lines.push("Planejamento de compra:");
        purchasePlan.items.slice(0, 8).forEach(function (item) {
          lines.push("- " + item.materialName + ": saldo " + formatQuantity(item.currentBalance) + " " + displayUnit(item.unit) +
            ", comprar " + formatQuantity(item.purchaseQuantity) + " " + displayUnit(item.unit) + " (" + item.status + ")");
        });
      }
    }
    if (request.originalMessage && /\d+\s*cm/i.test(request.originalMessage)) {
      lines.push("");
      lines.push("Observação técnica: dimensões informadas foram mantidas como contexto. Nesta fase, o cálculo principal usa composição demonstrativa por área/unidade de serviço.");
    }
    lines.push("");
    lines.push("Observação:");
    lines.push(DEMO_WARNING);
    return lines.join("\n");
  }

  window.StockAiCompositionEngine = Object.assign({}, window.StockAiCompositionEngine || {}, {
    version: LIBRARY_VERSION,
    source: DEMO_SOURCE,
    warning: DEMO_WARNING,
    getVersion: function () { return LIBRARY_VERSION; },
    getCompositions: getCompositions,
    findComposition: findComposition,
    isCompositionRequest: isCompositionRequest,
    parseRequest: parseRequest,
    normalize: normalize,
    normalizeUnit: normalizeUnit,
    calculatePredictedConsumption: calculatePredictedConsumption,
    calculateMultipleServices: calculateMultipleServices,
    consolidateMaterials: consolidateMaterials,
    comparePredictedVsActual: comparePredictedVsActual,
    buildPurchasePlan: buildPurchasePlan,
    buildAnswerFromMessage: buildAnswerFromMessage,
    matchPredictedMaterialToStockItem: matchPredictedMaterialToStockItem
  });
})();
