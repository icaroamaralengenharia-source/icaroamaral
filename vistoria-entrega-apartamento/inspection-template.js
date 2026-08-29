(function () {
  "use strict";

  const environments = [
    ["geral", "Geral da unidade", "Aplicável a qualquer apartamento"],
    ["sala", "Sala", "Ambiente social principal"],
    ["sala-jantar", "Sala de jantar", "Ambiente de refeições"],
    ["circulacao", "Circulação", "Hall e corredores internos"],
    ["quarto-1", "Quarto 1", "Dormitório principal ou primeiro dormitório"],
    ["quarto-2", "Quarto 2", "Segundo dormitório quando existente"],
    ["suite", "Suíte", "Dormitório com banheiro privativo"],
    ["cozinha", "Cozinha", "Área de preparo de alimentos"],
    ["area-servico", "Área de serviço", "Lavanderia e apoio"],
    ["banheiro-social", "Banheiro social", "Banheiro de uso comum"],
    ["banheiro-suite", "Banheiro da suíte", "Banheiro privativo"],
    ["varanda", "Varanda", "Área externa privativa"],
    ["area-tecnica", "Área técnica", "Área de equipamentos e infraestrutura"]
  ].map(([id, name, description]) => ({ id, name, description, optional: id !== "geral" }));

  const systems = [
    ["acabamentos", "Acabamentos"],
    ["pisos", "Pisos"],
    ["paredes", "Paredes"],
    ["tetos", "Tetos"],
    ["revestimentos", "Revestimentos"],
    ["portas", "Portas"],
    ["janelas", "Janelas"],
    ["vidros", "Vidros"],
    ["ferragens", "Ferragens"],
    ["eletrica", "Instalações elétricas"],
    ["hidrossanitaria", "Instalações hidrossanitárias"],
    ["loucas-metais", "Louças e metais"],
    ["impermeabilizacao", "Impermeabilização"],
    ["drenagem", "Drenagem"],
    ["ventilacao", "Ventilação"],
    ["gas", "Gás"],
    ["seguranca", "Segurança"],
    ["limpeza", "Limpeza e acabamento final"]
  ].map(([id, name]) => ({ id, name }));

  const shared = [
    item("acab-nivelamento", "acabamentos", "Acabamento final uniforme, sem marcas evidentes de retrabalho ou falhas aparentes.", "Superfícies entregues com padrão compatível, sem danos aparentes no momento da vistoria.", false, "outro", "Inspeção visual", ["acabamento"]),
    item("piso-integridade", "pisos", "Piso sem peças trincadas, quebradas ou com manchas permanentes aparentes.", "Revestimento íntegro, limpo e sem dano visível.", false, "outro", "Inspeção visual", ["piso"]),
    item("piso-aderencia", "pisos", "Piso sem indícios de peças ocas, soltas ou com desplacamento perceptível.", "Peças aderidas e sem som cavo relevante na amostragem.", false, "outro", "Martelo de borracha", ["piso", "aderencia"]),
    item("piso-nivel", "pisos", "Diferenças de nível não geram tropeço, empoçamento ou interferência de uso.", "Transições regulares e compatíveis com o projeto entregue.", true, "nível", "Nível", ["medicao", "nivel"]),
    item("parede-pintura", "paredes", "Paredes com pintura uniforme, sem manchas, bolhas, descascamentos ou fissuras aparentes.", "Pintura homogênea e sem manifestações patológicas visíveis.", false, "outro", "Inspeção visual", ["pintura"]),
    item("parede-prumo", "paredes", "Paredes aparentam prumo e alinhamento compatíveis com acabamento final.", "Sem desvios visualmente relevantes para o uso e acabamento.", true, "dimensão", "Prumo", ["medicao", "prumo"]),
    item("teto-acabamento", "tetos", "Teto ou forro sem manchas de umidade, fissuras, ondulações ou falhas de pintura.", "Plano visualmente regular, seco e íntegro.", false, "outro", "Inspeção visual", ["forro", "pintura"]),
    item("porta-funcionamento", "portas", "Porta abre e fecha sem atrito excessivo e sem interferência com piso ou batente.", "Folha opera livremente e permanece alinhada.", false, "outro", "Inspeção funcional", ["porta"]),
    item("porta-fechadura", "portas", "Fechadura, maçaneta, dobradiças e guarnições estão fixas e operantes.", "Ferragens firmes, completas e sem dano funcional.", false, "outro", "Inspeção funcional", ["ferragem"]),
    item("janela-operacao", "janelas", "Janela abre, fecha e trava sem esforço anormal ou desalinhamento perceptível.", "Esquadria opera e trava corretamente.", false, "outro", "Inspeção funcional", ["janela"]),
    item("janela-vedacao", "janelas", "Janela apresenta vedação aparente íntegra, sem frestas, peças soltas ou falhas visíveis.", "Guarnições, escovas e arremates completos.", false, "outro", "Inspeção visual", ["vedacao", "janela"]),
    item("vidro-integridade", "vidros", "Vidros sem trincas, lascas, riscos profundos ou folgas perceptíveis.", "Painéis íntegros, fixos e limpos.", false, "outro", "Inspeção visual", ["vidro"]),
    item("tomadas-interruptores", "eletrica", "Tomadas, interruptores e espelhos estão fixos, alinhados e sem danos aparentes.", "Componentes completos, firmes e identificáveis.", false, "outro", "Inspeção visual", ["eletrica"]),
    item("pontos-tensao", "eletrica", "Pontos elétricos testados apresentam alimentação compatível quando energizados.", "Medição registrada sem definir aprovação automática nesta etapa.", true, "tensão", "Multímetro", ["medicao", "eletrica"]),
    item("hidraulica-vazamento", "hidrossanitaria", "Pontos hidrossanitários aparentes sem vazamentos, gotejamentos ou umidade ativa.", "Conexões secas durante teste visual/funcional.", false, "outro", "Inspeção funcional", ["hidraulica"]),
    item("ralos-escoamento", "drenagem", "Ralos e grelhas apresentam escoamento livre, sem retorno ou obstrução aparente.", "Fluxo sem acúmulo relevante no teste de campo.", true, "caimento", "Nível", ["medicao", "drenagem"]),
    item("ventilacao-grade", "ventilacao", "Grelhas, venezianas ou aberturas de ventilação estão desobstruídas e acabadas.", "Ventilação permanente quando prevista, sem obstrução aparente.", false, "outro", "Inspeção visual", ["ventilacao"]),
    item("limpeza-final", "limpeza", "Ambiente entregue limpo, sem resíduos de obra que prejudiquem a vistoria ou o uso.", "Condição permite inspeção e uso inicial.", false, "outro", "Inspeção visual", ["limpeza"])
  ];

  const profiles = {
    geral: ["acab-nivelamento", "tomadas-interruptores", "pontos-tensao", "limpeza-final"],
    sala: ["acab-nivelamento", "piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "parede-prumo", "teto-acabamento", "porta-funcionamento", "janela-operacao", "janela-vedacao", "vidro-integridade", "tomadas-interruptores", "pontos-tensao", "limpeza-final"],
    "sala-jantar": ["acab-nivelamento", "piso-integridade", "piso-aderencia", "parede-pintura", "teto-acabamento", "janela-operacao", "tomadas-interruptores", "limpeza-final"],
    circulacao: ["piso-integridade", "piso-aderencia", "parede-pintura", "teto-acabamento", "tomadas-interruptores", "limpeza-final"],
    "quarto-1": ["acab-nivelamento", "piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "parede-prumo", "teto-acabamento", "porta-funcionamento", "porta-fechadura", "janela-operacao", "janela-vedacao", "vidro-integridade", "tomadas-interruptores", "pontos-tensao", "limpeza-final"],
    "quarto-2": ["acab-nivelamento", "piso-integridade", "piso-aderencia", "parede-pintura", "teto-acabamento", "porta-funcionamento", "porta-fechadura", "janela-operacao", "janela-vedacao", "tomadas-interruptores", "limpeza-final"],
    suite: ["acab-nivelamento", "piso-integridade", "piso-aderencia", "parede-pintura", "teto-acabamento", "porta-funcionamento", "porta-fechadura", "janela-operacao", "vidro-integridade", "tomadas-interruptores", "pontos-tensao", "limpeza-final"],
    cozinha: ["acab-nivelamento", "piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "teto-acabamento", "tomadas-interruptores", "pontos-tensao", "hidraulica-vazamento", "ralos-escoamento", "ventilacao-grade", "limpeza-final"],
    "area-servico": ["piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "teto-acabamento", "tomadas-interruptores", "pontos-tensao", "hidraulica-vazamento", "ralos-escoamento", "ventilacao-grade", "limpeza-final"],
    "banheiro-social": ["acab-nivelamento", "piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "teto-acabamento", "hidraulica-vazamento", "ralos-escoamento", "ventilacao-grade", "limpeza-final"],
    "banheiro-suite": ["acab-nivelamento", "piso-integridade", "piso-aderencia", "parede-pintura", "teto-acabamento", "hidraulica-vazamento", "ralos-escoamento", "ventilacao-grade", "limpeza-final"],
    varanda: ["piso-integridade", "piso-aderencia", "piso-nivel", "parede-pintura", "teto-acabamento", "janela-vedacao", "ralos-escoamento", "limpeza-final"],
    "area-tecnica": ["acab-nivelamento", "porta-funcionamento", "tomadas-interruptores", "pontos-tensao", "hidraulica-vazamento", "ventilacao-grade", "limpeza-final"]
  };

  const environmentSpecific = {
    geral: [
      item("geral-documentacao", "seguranca", "Manual, chaves, controles e garantias foram conferidos com a entrega da unidade.", "Documentação e acessórios de entrega disponibilizados para conferência.", false, "outro", "Checklist de entrega", ["documentacao"]),
      item("geral-quadro", "eletrica", "Quadro elétrico identificado, acessível e sem componentes soltos ou expostos.", "Disjuntores e identificação visíveis, com tampa e proteção presentes.", false, "outro", "Inspeção visual", ["quadro"]),
      item("geral-registros", "hidrossanitaria", "Registros gerais acessíveis, identificáveis e sem vazamentos aparentes.", "Registros operáveis e sem sinais de umidade ativa.", false, "outro", "Inspeção funcional", ["registro"]),
      item("geral-interfone", "seguranca", "Interfone, campainha ou controle de acesso disponível para teste quando aplicável.", "Equipamento presente e sem dano aparente; funcionamento registrado em campo.", false, "outro", "Inspeção funcional", ["seguranca"])
    ],
    cozinha: [
      item("cozinha-bancada", "revestimentos", "Bancada, frontão e arremates sem trincas, lascas, manchas ou folgas aparentes.", "Peças íntegras e rejuntes/acabamentos completos.", false, "outro", "Inspeção visual", ["bancada"]),
      item("cozinha-gas", "gas", "Ponto de gás identificado, tamponado ou conectado conforme entrega, sem dano aparente.", "Ponto acessível, identificado e sem intervenção improvisada visível.", false, "outro", "Inspeção visual", ["gas"]),
      item("cozinha-cuba", "loucas-metais", "Cuba, sifão e torneira sem vazamentos aparentes durante teste de uso.", "Conjunto firme, íntegro e seco após acionamento.", false, "outro", "Inspeção funcional", ["cuba", "metais"])
    ],
    "area-servico": [
      item("servico-tanque", "loucas-metais", "Tanque, torneira e sifão sem vazamentos, fissuras ou fixação deficiente.", "Conjunto operante e seco após teste.", false, "outro", "Inspeção funcional", ["tanque"]),
      item("servico-maquina", "hidrossanitaria", "Pontos de máquina de lavar possuem alimentação e esgoto aparentes, acessíveis e íntegros.", "Pontos identificáveis, sem obstrução ou vazamento aparente.", false, "outro", "Inspeção visual", ["maquina"])
    ],
    "banheiro-social": [
      item("banheiro-bacia", "loucas-metais", "Bacia sanitária firme, sem fissuras, vazamento ou instabilidade perceptível.", "Louça íntegra, fixada e sem vazamento no acionamento.", false, "outro", "Inspeção funcional", ["louca"]),
      item("banheiro-chuveiro", "hidrossanitaria", "Ponto de chuveiro e registros apresentam acabamento completo e sem vazamentos aparentes.", "Metais e conexões firmes e secos durante teste.", false, "outro", "Inspeção funcional", ["chuveiro"]),
      item("banheiro-box", "impermeabilizacao", "Área molhada sem indícios aparentes de falha de impermeabilização ou umidade ativa.", "Sem manchas, bolhas ou umidade visível nas áreas verificadas.", true, "umidade", "Medidor de umidade", ["impermeabilizacao", "medicao"])
    ],
    "banheiro-suite": [
      item("banheiro-suite-bacia", "loucas-metais", "Bacia sanitária da suíte firme, íntegra e sem vazamentos aparentes.", "Louça fixada, íntegra e funcional.", false, "outro", "Inspeção funcional", ["louca"]),
      item("banheiro-suite-chuveiro", "hidrossanitaria", "Ponto de chuveiro da suíte sem vazamento aparente nos registros e acabamento.", "Conjunto seco e completo após teste.", false, "outro", "Inspeção funcional", ["chuveiro"])
    ],
    varanda: [
      item("varanda-guarda-corpo", "seguranca", "Guarda-corpo, quando existente, está firme, íntegro e sem folgas perceptíveis.", "Elemento fixo, sem dano aparente ou instabilidade manual.", false, "outro", "Inspeção visual", ["seguranca"]),
      item("varanda-caimento", "drenagem", "Piso da varanda apresenta caimento funcional para ralo ou área de drenagem prevista.", "Sem empoçamento relevante observado no teste possível.", true, "caimento", "Nível", ["drenagem", "medicao"])
    ],
    "area-tecnica": [
      item("area-tecnica-equipamentos", "seguranca", "Suportes, bases e pontos de equipamentos técnicos estão íntegros e acessíveis.", "Infraestrutura sem dano aparente e com acesso de manutenção preservado.", false, "outro", "Inspeção visual", ["equipamentos"])
    ]
  };

  const items = [];
  for (const environment of environments) {
    for (const baseId of profiles[environment.id]) {
      const base = shared.find((entry) => entry.baseId === baseId);
      items.push({ ...base, id: `${environment.id}-${base.baseId}`, environmentId: environment.id });
    }
    for (const extra of environmentSpecific[environment.id] || []) {
      items.push({ ...extra, id: `${environment.id}-${extra.baseId}`, environmentId: environment.id });
    }
  }

  function item(baseId, systemId, title, acceptanceCriteria, requiresMeasurement, measurementType, recommendedInstrument, tags) {
    return { baseId, systemId, title, text: title, acceptanceCriteria, requiresMeasurement, measurementType, recommendedInstrument, tags };
  }

  window.VistoriaEntregaTemplates = {
    activeTemplateId: "apartment-handover-professional-v2",
    templates: [{
      id: "apartment-handover-professional-v2",
      type: "inspectionTemplate",
      label: "Vistoria de entrega de apartamento",
      version: 2,
      environments,
      systems,
      sections: systems,
      items,
      futureTemplateSlots: ["casa", "areas_comuns", "locacao", "pre_entrega"]
    }]
  };
})();
