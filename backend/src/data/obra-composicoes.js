const OBSERVACAO_DEMONSTRATIVA = "Base demonstrativa. Validar com SINAPI/ORSE antes de orcamento oficial.";

export const OBRA_COMPOSICOES_DEMONSTRATIVAS = [
  {
    id: "alvenaria-bloco-ceramico",
    nome: "Alvenaria de vedacao com bloco ceramico",
    servico: "Alvenaria de vedacao com bloco ceramico",
    unidade: "m2",
    aliases: ["alvenaria", "bloco", "bloco ceramico", "parede", "parede de bloco", "vedacao"],
    termos: ["alvenaria", "bloco", "bloco ceramico", "parede", "parede de bloco", "vedacao"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Bloco ceramico", unidade: "un", coeficiente: 27 },
      { nome: "Argamassa de assentamento", unidade: "m3", coeficiente: 0.02 },
      { nome: "Cimento", unidade: "kg", coeficiente: null },
      { nome: "Areia", unidade: "m3", coeficiente: null },
      { nome: "Cal/aditivo", unidade: "kg", coeficiente: null },
      { nome: "Pedreiro", unidade: "h", coeficiente: null },
      { nome: "Servente", unidade: "h", coeficiente: null }
    ]
  },
  {
    id: "reboco-emboco-parede",
    nome: "Reboco/emboco de parede",
    servico: "Reboco/emboco de parede",
    unidade: "m2",
    aliases: ["reboco", "emboco", "emboço", "revestimento de parede", "massa de parede"],
    termos: ["reboco", "emboco", "emboço", "revestimento de parede", "massa de parede"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Argamassa de revestimento", unidade: "m3", coeficiente: 0.025 },
      { nome: "Cimento", unidade: "kg", coeficiente: null },
      { nome: "Areia", unidade: "m3", coeficiente: null },
      { nome: "Cal/aditivo", unidade: "kg", coeficiente: null },
      { nome: "Agua", unidade: "l", coeficiente: null },
      { nome: "Pedreiro", unidade: "h", coeficiente: null },
      { nome: "Servente", unidade: "h", coeficiente: null }
    ]
  },
  {
    id: "contrapiso",
    nome: "Contrapiso",
    servico: "Contrapiso",
    unidade: "m2",
    aliases: ["contrapiso", "regularizacao de piso", "regularização de piso"],
    termos: ["contrapiso", "regularizacao de piso", "regularização de piso"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Argamassa de contrapiso", unidade: "m3", coeficiente: 0.04 },
      { nome: "Cimento", unidade: "kg", coeficiente: null },
      { nome: "Areia", unidade: "m3", coeficiente: null },
      { nome: "Pedreiro", unidade: "h", coeficiente: null },
      { nome: "Servente", unidade: "h", coeficiente: null }
    ]
  },
  {
    id: "piso-ceramico",
    nome: "Piso ceramico",
    servico: "Piso ceramico",
    unidade: "m2",
    aliases: ["piso ceramico", "piso cerâmico", "ceramica", "cerâmica", "assentamento de piso"],
    termos: ["piso ceramico", "piso cerâmico", "ceramica", "cerâmica", "assentamento de piso"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Piso ceramico", unidade: "m2", coeficiente: 1.05 },
      { nome: "Argamassa colante", unidade: "kg", coeficiente: 4 },
      { nome: "Rejunte", unidade: "kg", coeficiente: 0.15 },
      { nome: "Espacadores", unidade: "un", coeficiente: null },
      { nome: "Pedreiro", unidade: "h", coeficiente: null },
      { nome: "Servente", unidade: "h", coeficiente: null }
    ]
  },
  {
    id: "concretagem-simples",
    nome: "Concretagem simples",
    servico: "Concretagem simples",
    unidade: "m3",
    aliases: ["concretagem", "concreto", "concreto simples", "lancamento de concreto", "concretar"],
    termos: ["concretagem", "concreto", "concreto simples", "lancamento de concreto", "concretar"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Concreto", unidade: "m3", coeficiente: 1 },
      { nome: "Cimento", unidade: "kg", coeficiente: null },
      { nome: "Areia", unidade: "m3", coeficiente: null },
      { nome: "Brita", unidade: "m3", coeficiente: null },
      { nome: "Agua", unidade: "l", coeficiente: null },
      { nome: "Mao de obra", unidade: "h", coeficiente: null }
    ]
  },
  {
    id: "pintura-acrilica",
    nome: "Pintura acrilica",
    servico: "Pintura acrilica",
    unidade: "m2",
    aliases: ["pintura", "pintura acrilica", "pintura acrílica", "tinta", "parede pintada"],
    termos: ["pintura", "pintura acrilica", "pintura acrílica", "tinta", "parede pintada"],
    observacao: OBSERVACAO_DEMONSTRATIVA,
    insumos: [
      { nome: "Tinta acrilica", unidade: "l", coeficiente: 0.17 },
      { nome: "Selador", unidade: "l", coeficiente: 0.1 },
      { nome: "Massa corrida", unidade: "kg", coeficiente: null },
      { nome: "Lixa", unidade: "un", coeficiente: null },
      { nome: "Rolo/pincel", unidade: "un", coeficiente: null },
      { nome: "Pintor", unidade: "h", coeficiente: null },
      { nome: "Servente", unidade: "h", coeficiente: null }
    ]
  }
];
