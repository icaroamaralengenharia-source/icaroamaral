const OBSERVACAO_DEMONSTRATIVA = "Coeficientes demonstrativos. Validar com SINAPI/ORSE antes de orcamento, compra oficial ou medicao contratual.";

function insumo(nome, unidade, coeficiente = null) {
  return {
    nome,
    unidade,
    coeficiente,
    origemCoeficiente: Number.isFinite(coeficiente) ? "demonstrativo" : "pendente_validacao_oficial"
  };
}

function composicao(id, nome, unidade, aliases, insumos, statusCoeficientes = "pendente_validacao_oficial") {
  return {
    id,
    nome,
    servico: nome,
    unidade,
    aliases,
    termos: aliases,
    fonte: "base_interna_demonstrativa",
    statusCoeficientes,
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos
  };
}

export const OBRA_COMPOSICOES_DEMONSTRATIVAS = [
  composicao(
    "alvenaria-vedacao-bloco-ceramico",
    "Alvenaria de vedacao",
    "m2",
    ["alvenaria", "parede", "bloco ceramico", "bloco", "parede de bloco", "vedacao"],
    [
      insumo("Bloco ceramico", "un", 27),
      insumo("Argamassa de assentamento", "m3", 0.02),
      insumo("Cimento", "kg"),
      insumo("Areia", "m3"),
      insumo("Cal/aditivo", "kg"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "chapisco-parede",
    "Chapisco",
    "m2",
    ["chapisco", "chapiscar", "preparo de parede para reboco"],
    [
      insumo("Cimento", "kg"),
      insumo("Areia grossa", "m3"),
      insumo("Agua", "l"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "reboco-parede",
    "Reboco",
    "m2",
    ["reboco", "rebocar", "massa fina", "revestimento de parede"],
    [
      insumo("Argamassa de revestimento", "m3", 0.025),
      insumo("Cimento", "kg"),
      insumo("Areia", "m3"),
      insumo("Cal/aditivo", "kg"),
      insumo("Agua", "l"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "emboco-parede",
    "Emboco",
    "m2",
    ["emboco", "emboço", "embocar", "massa grossa"],
    [
      insumo("Argamassa de emboco", "m3"),
      insumo("Cimento", "kg"),
      insumo("Areia", "m3"),
      insumo("Cal/aditivo", "kg"),
      insumo("Agua", "l"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "contrapiso",
    "Contrapiso",
    "m2",
    ["contrapiso", "regularizacao de piso", "regularização de piso"],
    [
      insumo("Argamassa de contrapiso", "m3", 0.04),
      insumo("Cimento", "kg"),
      insumo("Areia", "m3"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "piso-ceramico",
    "Piso ceramico",
    "m2",
    ["piso", "piso ceramico", "piso cerâmico", "ceramica", "cerâmica", "assentamento de piso"],
    [
      insumo("Piso ceramico", "m2", 1.05),
      insumo("Argamassa colante", "kg", 4),
      insumo("Rejunte", "kg", 0.15),
      insumo("Espacadores", "un"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "pintura-acrilica",
    "Pintura acrilica",
    "m2",
    ["pintura", "pintura acrilica", "pintura acrílica", "tinta", "parede pintada"],
    [
      insumo("Tinta acrilica", "l", 0.17),
      insumo("Selador", "l", 0.1),
      insumo("Massa corrida", "kg"),
      insumo("Lixa", "un"),
      insumo("Rolo/pincel", "un"),
      insumo("Pintor", "h"),
      insumo("Servente", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "concretagem-simples",
    "Concretagem simples",
    "m3",
    ["concretagem", "concreto", "concreto simples", "lancamento de concreto", "concretar"],
    [
      insumo("Concreto", "m3", 1),
      insumo("Cimento", "kg"),
      insumo("Areia", "m3"),
      insumo("Brita", "m3"),
      insumo("Agua", "l"),
      insumo("Mao de obra", "h")
    ],
    "demonstrativo"
  ),
  composicao(
    "forma-madeira",
    "Forma de madeira",
    "m2",
    ["forma", "formas", "caixaria", "forma de madeira", "forma para concreto"],
    [
      insumo("Compensado/tábua", "m2"),
      insumo("Sarrafo/pontalete", "m"),
      insumo("Pregos", "kg"),
      insumo("Desmoldante", "l"),
      insumo("Carpinteiro", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "armadura-aco-ca50",
    "Armadura/aco CA-50",
    "kg",
    ["aco", "aço", "armadura", "ferragem", "ca-50", "ca50", "vergalhao", "vergalhão"],
    [
      insumo("Aco CA-50", "kg"),
      insumo("Arame recozido", "kg"),
      insumo("Espacadores", "un"),
      insumo("Armador", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "cobertura-telha-ceramica",
    "Cobertura com telha ceramica",
    "m2",
    ["cobertura", "telhado", "telha", "telha ceramica", "telha cerâmica"],
    [
      insumo("Telha ceramica", "un"),
      insumo("Madeiramento/estrutura", "m"),
      insumo("Cumeeira", "un"),
      insumo("Pregos/parafusos", "kg"),
      insumo("Telhadista", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "cobertura-telha-fibrocimento",
    "Cobertura com telha fibrocimento",
    "m2",
    ["telha fibrocimento", "fibrocimento", "cobertura fibrocimento", "telhado fibrocimento"],
    [
      insumo("Telha fibrocimento", "m2"),
      insumo("Parafusos de fixacao", "un"),
      insumo("Vedacao/arruela", "un"),
      insumo("Estrutura de apoio", "m"),
      insumo("Telhadista", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "impermeabilizacao-manta-asfalto",
    "Impermeabilizacao com manta/asfalto",
    "m2",
    ["impermeabilizacao", "impermeabilização", "manta", "manta asfaltica", "asfalto", "impermeabilizacao com manta"],
    [
      insumo("Primer", "l"),
      insumo("Manta asfaltica", "m2"),
      insumo("Gas/maçarico", "un"),
      insumo("Argamassa de regularizacao", "m3"),
      insumo("Aplicador", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "impermeabilizacao-argamassa-polimerica",
    "Impermeabilizacao com argamassa polimerica",
    "m2",
    ["argamassa polimerica", "argamassa polimérica", "impermeabilizacao polimerica", "impermeabilização polimérica"],
    [
      insumo("Argamassa polimerica", "kg"),
      insumo("Tela estruturante", "m2"),
      insumo("Agua", "l"),
      insumo("Broxa/rolo", "un"),
      insumo("Aplicador", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "hidraulica-ponto-agua-fria",
    "Instalacao hidraulica - ponto de agua fria",
    "ponto",
    ["hidraulica", "hidráulica", "ponto de agua", "ponto de água", "agua fria", "água fria", "ponto hidraulico"],
    [
      insumo("Tubo PVC agua fria", "m"),
      insumo("Conexoes PVC", "un"),
      insumo("Registro/conector", "un"),
      insumo("Adesivo e solucao limpadora", "un"),
      insumo("Encanador", "h"),
      insumo("Ajudante", "h")
    ]
  ),
  composicao(
    "hidraulica-ponto-esgoto",
    "Instalacao hidraulica - ponto de esgoto",
    "ponto",
    ["ponto de esgoto", "esgoto", "instalacao de esgoto", "instalação de esgoto", "tubulacao de esgoto"],
    [
      insumo("Tubo PVC esgoto", "m"),
      insumo("Conexoes PVC esgoto", "un"),
      insumo("Caixa/sifao/ralo", "un"),
      insumo("Adesivo e solucao limpadora", "un"),
      insumo("Encanador", "h"),
      insumo("Ajudante", "h")
    ]
  ),
  composicao(
    "eletrica-ponto-iluminacao",
    "Instalacao eletrica - ponto de iluminacao",
    "ponto",
    ["eletrica", "elétrica", "iluminacao", "iluminação", "ponto de iluminacao", "ponto de iluminação", "luminaria"],
    [
      insumo("Eletroduto", "m"),
      insumo("Condutores", "m"),
      insumo("Caixa eletrica", "un"),
      insumo("Interruptor", "un"),
      insumo("Conectores", "un"),
      insumo("Eletricista", "h"),
      insumo("Ajudante", "h")
    ]
  ),
  composicao(
    "eletrica-ponto-tomada",
    "Instalacao eletrica - tomada",
    "ponto",
    ["tomada", "ponto de tomada", "tomadas", "instalacao eletrica tomada", "instalação elétrica tomada"],
    [
      insumo("Eletroduto", "m"),
      insumo("Condutores", "m"),
      insumo("Caixa 4x2", "un"),
      insumo("Tomada", "un"),
      insumo("Conectores", "un"),
      insumo("Eletricista", "h"),
      insumo("Ajudante", "h")
    ]
  ),
  composicao(
    "revestimento-ceramico-parede",
    "Revestimento ceramico de parede",
    "m2",
    ["revestimento", "ceramica parede", "cerâmica parede", "revestimento ceramico", "azulejo", "parede ceramica"],
    [
      insumo("Revestimento ceramico", "m2"),
      insumo("Argamassa colante", "kg"),
      insumo("Rejunte", "kg"),
      insumo("Espacadores", "un"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ]
  ),
  composicao(
    "assentamento-bloco-concreto",
    "Assentamento de bloco de concreto",
    "m2",
    ["bloco de concreto", "bloco estrutural", "concreto estrutural", "assentamento de bloco", "alvenaria estrutural"],
    [
      insumo("Bloco de concreto", "un"),
      insumo("Argamassa de assentamento", "m3"),
      insumo("Graute", "m3"),
      insumo("Aco de reforco", "kg"),
      insumo("Pedreiro", "h"),
      insumo("Servente", "h")
    ]
  )
];
