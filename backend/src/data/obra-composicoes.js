export const OBRA_COMPOSICOES_DEMONSTRATIVAS = [
  {
    id: "alvenaria-bloco-ceramico",
    servico: "Alvenaria de vedacao com bloco ceramico",
    unidade: "m2",
    termos: ["alvenaria", "bloco", "bloco ceramico", "parede", "vedacao"],
    insumos: [
      "bloco ceramico",
      "argamassa de assentamento",
      "cimento",
      "areia",
      "cal/aditivo",
      "pedreiro",
      "servente"
    ],
    coeficientesDemonstrativos: [
      { insumo: "bloco ceramico", quantidade: 16, unidade: "un/m2" },
      { insumo: "argamassa de assentamento", quantidade: 0.018, unidade: "m3/m2" }
    ]
  },
  {
    id: "reboco-emboco-parede",
    servico: "Reboco/emboco de parede",
    unidade: "m2",
    termos: ["reboco", "emboco", "emboço", "revestimento de parede", "massa de parede"],
    insumos: ["cimento", "areia", "cal/aditivo", "agua", "pedreiro", "servente"],
    coeficientesDemonstrativos: [
      { insumo: "argamassa de revestimento", quantidade: 0.025, unidade: "m3/m2" }
    ]
  },
  {
    id: "contrapiso",
    servico: "Contrapiso",
    unidade: "m2",
    termos: ["contrapiso", "regularizacao de piso", "regularização de piso"],
    insumos: ["cimento", "areia", "brita, se aplicavel", "agua", "pedreiro", "servente"],
    coeficientesDemonstrativos: [
      { insumo: "argamassa de contrapiso", quantidade: 0.04, unidade: "m3/m2" }
    ]
  },
  {
    id: "piso-ceramico",
    servico: "Piso ceramico",
    unidade: "m2",
    termos: ["piso ceramico", "piso cerâmico", "ceramica", "cerâmica", "assentamento de piso"],
    insumos: ["piso ceramico", "argamassa colante", "rejunte", "espacadores", "pedreiro", "servente"],
    coeficientesDemonstrativos: [
      { insumo: "piso ceramico", quantidade: 1.08, unidade: "m2/m2" },
      { insumo: "argamassa colante", quantidade: 4.5, unidade: "kg/m2" },
      { insumo: "rejunte", quantidade: 0.25, unidade: "kg/m2" }
    ]
  },
  {
    id: "concretagem-simples",
    servico: "Concretagem simples",
    unidade: "m3",
    termos: ["concretagem", "concreto", "concreto simples", "lancamento de concreto"],
    insumos: ["cimento", "areia", "brita", "agua", "mao de obra"],
    coeficientesDemonstrativos: [
      { insumo: "cimento", quantidade: 7, unidade: "sc/m3" },
      { insumo: "areia", quantidade: 0.55, unidade: "m3/m3" },
      { insumo: "brita", quantidade: 0.75, unidade: "m3/m3" }
    ]
  },
  {
    id: "pintura-acrilica",
    servico: "Pintura acrilica",
    unidade: "m2",
    termos: ["pintura", "pintura acrilica", "pintura acrílica", "tinta", "parede pintada"],
    insumos: ["tinta acrilica", "selador", "massa corrida, se aplicavel", "lixa", "rolo/pincel", "pintor", "servente"],
    coeficientesDemonstrativos: [
      { insumo: "tinta acrilica", quantidade: 0.18, unidade: "l/m2" },
      { insumo: "selador", quantidade: 0.12, unidade: "l/m2" }
    ]
  }
];
