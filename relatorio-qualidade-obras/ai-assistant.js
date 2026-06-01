(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};
  const LOCAL_TEXT_PATTERNS = [
    {
      terms: ["infiltracao", "infiltração", "umidade", "mofo"],
      description: "Foi identificada manifestação de umidade{local}",
      recommendation: "recomendando-se a investigação da origem da umidade e a adoção das medidas corretivas necessárias"
    },
    {
      terms: ["vazamento"],
      description: "Foi identificado indício de vazamento{local}",
      recommendation: "recomendando-se a verificação da instalação relacionada e a correção do ponto de perda de água"
    },
    {
      terms: ["gesso", "drywall"],
      description: "Foi constatada irregularidade em elemento de gesso ou sistema de fechamento interno{local}",
      recommendation: "recomendando-se verificar juntas, fixações e acabamento antes da liberação final"
    },
    {
      terms: ["fissura", "trinca", "rachadura"],
      description: "Foi observada fissura ou trinca{local}",
      recommendation: "recomendando-se avaliar a evolução da manifestação e definir o tratamento adequado conforme verificação técnica"
    },
    {
      terms: ["reboco", "argamassa", "revestimento soltando", "soltando"],
      description: "Foi observado desplacamento do revestimento argamassado{local}",
      recommendation: "sendo recomendada a verificação da aderência do material e a execução dos reparos necessários"
    },
    {
      terms: ["pintura", "mancha", "manchada", "descascando"],
      description: "Foi constatada irregularidade no acabamento de pintura{local}",
      recommendation: "recomendando-se corrigir a base afetada e recompor o acabamento após eliminada a causa da manifestação"
    },
    {
      terms: ["piso", "ceramica", "porcelanato", "oca", "quebrado", "quebrada"],
      description: "Foi constatada irregularidade em peça de piso ou revestimento{local}",
      recommendation: "recomendando-se verificar a aderência e executar a substituição ou recomposição necessária"
    },
    {
      terms: ["tomada", "eletrica", "elétrica", "fiação", "fiacao", "interruptor"],
      description: "Foi observada pendência em ponto de instalação elétrica{local}",
      recommendation: "recomendando-se regularizar o acabamento e conferir as condições de segurança antes da liberação de uso"
    },
    {
      terms: ["hidraulica", "hidráulica", "ralo", "caimento", "banheiro"],
      description: "Foi identificada pendência relacionada à instalação hidráulica ou ao escoamento{local}",
      recommendation: "recomendando-se verificar o funcionamento, o caimento e a estanqueidade antes da finalização do serviço"
    },
    {
      terms: ["porta", "janela", "esquadria", "vedacao", "vedação", "desalinhada", "desalinhado"],
      description: "Foi observada irregularidade em esquadria ou elemento de fechamento{local}",
      recommendation: "recomendando-se ajustar alinhamento, fixação e vedação conforme a condição verificada"
    },
    {
      terms: ["limpeza", "entulho", "sujeira", "corredor"],
      description: "Foi constatada pendência de organização e limpeza{local}",
      recommendation: "recomendando-se remover resíduos, liberar a área de circulação e manter o ambiente em condições adequadas de segurança"
    },
    {
      terms: ["prumo", "nivel", "nível", "alinhamento"],
      description: "Foi identificada possível divergência de prumo, nível ou alinhamento{local}",
      recommendation: "recomendando-se conferir geometricamente o elemento e executar os ajustes necessários"
    },
    {
      terms: ["ferragem", "armadura", "aco", "aço", "exposta"],
      description: "Foi constatada exposição de armadura ou elemento metálico{local}",
      recommendation: "recomendando-se proteger o elemento, verificar a causa da exposição e recompor o cobrimento conforme orientação técnica"
    },
    {
      terms: ["concreto", "ninho", "segregacao", "segregação"],
      description: "Foi observada falha de concretagem ou acabamento em concreto{local}",
      recommendation: "recomendando-se avaliar a extensão da falha e definir o reparo técnico adequado antes da continuidade dos serviços"
    },
    {
      terms: ["gesso", "drywall"],
      description: "Foi constatada irregularidade em elemento de gesso ou sistema de fechamento interno{local}",
      recommendation: "recomendando-se verificar juntas, fixações e acabamento antes da liberação final"
    },
    {
      terms: ["rodape", "rodapé"],
      description: "Foi observada irregularidade na execução do rodapé{local}",
      recommendation: "recomendando-se ajustar fixação, alinhamento e acabamento do elemento"
    },
    {
      terms: ["impermeabilizacao", "impermeabilização", "manta"],
      description: "Foi identificada falha ou ponto de atenção no sistema de impermeabilização{local}",
      recommendation: "recomendando-se revisar a estanqueidade e corrigir o sistema antes do fechamento ou liberação da área"
    }
  ];
  const OBRAREPORT_IMAGE_ANALYSIS_LIBRARY = [
    {
      id: "fissuras-trincas",
      category: "fissuras e trincas",
      visualCues: [
        "linhas finas ou abertas em alvenaria, concreto, revestimento ou acabamento",
        "mudanca de direcao, extensao, abertura aparente e repeticao da manifestacao",
        "presenca de manchas, destacamento ou deformacao associada"
      ],
      caution: "Nao classificar gravidade estrutural apenas pela foto. Recomendar avaliacao tecnica quando houver abertura relevante, evolucao ou repeticao."
    },
    {
      id: "infiltracao-umidade",
      category: "infiltracao e umidade",
      visualCues: [
        "manchas escurecidas, marcas de escorrimento, pintura empolada ou desagregacao",
        "umidade proxima a teto, parede, piso, esquadria, banheiro, cobertura ou tubulacao",
        "sais, bolhas, descascamento ou alteracao de cor no acabamento"
      ],
      caution: "Nao afirmar a origem da agua sem ensaio ou verificacao complementar. Indicar investigacao da causa."
    },
    {
      id: "corrosao-armadura",
      category: "corrosao de armadura",
      visualCues: [
        "aco exposto, manchas ferruginosas, cobrimento rompido ou concreto desagregado",
        "fissuras proximas a elementos de concreto armado",
        "perda aparente de cobrimento ou destacamento ao redor da armadura"
      ],
      caution: "Nao estimar perda de secao pela imagem. Recomendar avaliacao da armadura, cobrimento e extensao do dano."
    },
    {
      id: "desplacamento",
      category: "desplacamento",
      visualCues: [
        "revestimento solto, placas destacadas, bordas abertas ou areas ocas aparentes",
        "perda de aderencia em argamassa, ceramica, pintura ou concreto",
        "fragmentos, fissuras perifericas ou diferenca de plano"
      ],
      caution: "Nao afirmar causa unica. Recomendar verificacao de aderencia, substrato e umidade."
    },
    {
      id: "mofo-bolor",
      category: "mofo e bolor",
      visualCues: [
        "pontos escuros, esverdeados ou manchas pulverulentas",
        "ocorrencia em areas com pouca ventilacao, umidade ou condensacao",
        "associacao com odor, manchas e degradacao de pintura"
      ],
      caution: "Nao diagnosticar risco a saude pela foto. Recomendar limpeza adequada e eliminacao da causa da umidade."
    },
    {
      id: "falhas-acabamento",
      category: "falhas de acabamento",
      visualCues: [
        "pintura irregular, rejunte falho, recortes desalinhados ou acabamento incompleto",
        "manchas, respingos, ondulacoes, falhas de nivelamento ou arremates inadequados",
        "incompatibilidade visual com o padrao esperado do ambiente"
      ],
      caution: "Diferenciar acabamento estetico de manifestacao patologica quando a imagem nao mostrar dano tecnico."
    },
    {
      id: "recalque-movimentacao",
      category: "recalque/movimentacao",
      visualCues: [
        "trincas inclinadas, aberturas em encontros, desnivel aparente ou deformacoes",
        "fissuras proximas a esquadrias, pilares, vigas, alvenarias ou pisos",
        "separacao entre elementos e repeticao em pontos alinhados"
      ],
      caution: "Nao concluir recalque apenas pela foto. Recomendar acompanhamento, medicao e avaliacao estrutural quando houver indicios."
    }
  ];

  async function improveTechnicalText(text, context) {
    const payload = {
      action: "improve",
      text: clean_(text),
      context: context || {}
    };

    const remote = await tryRemoteAssistant_(payload);
    if (remote) {
      return remote;
    }

    return {
      mode: "local",
      title: "Sugestão local de melhoria técnica",
      suggestion: buildImprovedText_(payload.text, payload.context),
      note: "Modo local ativo. A estrutura já está preparada para conectar uma API real sem expor chave no frontend."
    };
  }

  async function generateConclusion(context) {
    const payload = {
      action: "conclusion",
      text: "",
      context: context || {}
    };

    const remote = await tryRemoteAssistant_(payload);
    if (remote) {
      return remote;
    }

    const report = payload.context.report || {};
    const stats = payload.context.stats || {};
    const obra = report.obra || "a obra vistoriada";
    const local = report.local ? " localizada em " + report.local : "";
    const riscos = Number(stats.riscosAltos || 0);
    const riscoTexto = riscos > 0
      ? " Há itens classificados com risco alto, exigindo tratativa prioritária e acompanhamento técnico."
      : " Não foram destacados riscos altos no preenchimento atual, mantendo-se a necessidade de acompanhamento técnico dos registros realizados.";

    return {
      mode: "local",
      title: "Conclusão técnica sugerida",
      suggestion:
        "Com base na vistoria realizada em " + obra + local + ", foram registrados os dados técnicos, fotos e inconformidades identificadas no período avaliado. " +
        "Recomenda-se que as providências indicadas neste relatório sejam acompanhadas pela equipe responsável, com registro das correções executadas e nova verificação quando necessário." +
        riscoTexto,
      note: "Conclusão gerada em modo local a partir dos dados preenchidos no relatório."
    };
  }

  async function reviewReport(context) {
    const payload = {
      action: "review",
      text: "",
      context: context || {}
    };

    const remote = await tryRemoteAssistant_(payload);
    if (remote) {
      return remote;
    }

    return {
      mode: "local",
      title: "Revisão técnica antes do PDF",
      suggestion: buildReviewChecklist_(payload.context),
      note: "Revisão local. Use como apoio antes de gerar o PDF final."
    };
  }

  async function analyzeImage(image, context) {
    const payload = {
      image: {
        base64: cleanBase64_(image && image.base64),
        mimeType: image && image.mimeType ? image.mimeType : "image/jpeg",
        fileName: image && image.fileName ? image.fileName : "foto.jpg",
        width: image && image.width ? image.width : 0,
        height: image && image.height ? image.height : 0
      },
      context: context || {}
    };

    const remote = await tryRemoteImageAssistant_(payload);
    if (remote) {
      return remote;
    }

    return buildLocalImageFallback_(payload);
  }

  function buildImageAnalysisPrompt(payload) {
    const safePayload = payload || {};
    const image = safePayload.image || {};
    const context = safePayload.context || {};
    const report = context.report || {};
    const categories = OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map(function (item) {
      return [
        "- " + item.category,
        "  Indicios visuais: " + item.visualCues.join("; "),
        "  Cuidado: " + item.caution
      ].join("\n");
    }).join("\n");

    return [
      "Voce e um assistente tecnico do ObraReport para triagem visual de patologias construtivas.",
      "Analise somente o que for visivel na imagem e no contexto informado.",
      "Nao invente causa, origem, gravidade, medida, norma, local, responsavel ou diagnostico definitivo.",
      "Quando houver incerteza, escreva que a imagem sugere ou aparenta determinada condicao.",
      "Classifique apenas como hipotese tecnica inicial e recomende verificacao por profissional responsavel.",
      "",
      "Contexto do relatorio:",
      "Obra: " + safePromptValue_(report.obra),
      "Local: " + safePromptValue_(report.local),
      "Tipo da foto: " + safePromptValue_(context.imageLabel || context.targetName || context.imageInputName),
      "Arquivo: " + safePromptValue_(image.fileName),
      "Dimensoes: " + Number(image.width || 0) + "x" + Number(image.height || 0),
      "",
      "Biblioteca tecnica local de referencia:",
      categories,
      "",
      "Retorne a analise em JSON com:",
      "{",
      "  \"categoriaProvavel\": \"categoria ou vazio\",",
      "  \"confianca\": \"baixa | media | alta\",",
      "  \"descricaoTecnica\": \"descricao objetiva do que e visivel\",",
      "  \"possiveisInconformidades\": [\"achado 1\", \"achado 2\"],",
      "  \"naoConcluir\": [\"o que nao pode ser afirmado pela foto\"],",
      "  \"recomendacaoAcao\": \"proxima verificacao tecnica recomendada\",",
      "  \"textoRelatorio\": \"texto revisavel para inserir no relatorio\"",
      "}"
    ].join("\n");
  }

  async function tryRemoteAssistant_(payload) {
    if (!config.aiAssistantUrl) {
      return null;
    }

    try {
      const response = await fetch(config.aiAssistantUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok || !result || !result.suggestion) {
        throw new Error(result && result.error ? result.error : "Resposta inválida da IA.");
      }

      return {
        mode: result.mode || "remote",
        title: result.title || "Sugestão da IA",
        suggestion: clean_(result.suggestion),
        note: result.note || "Sugestão gerada pela IA configurada no backend."
      };
    } catch (error) {
      return {
        mode: "local",
        title: "Sugestão local de contingência",
        suggestion: buildImprovedText_(payload.text, payload.context),
        note: "A API de IA não respondeu. O ObraReport usou o modo local para não interromper o trabalho."
      };
    }
  }

  async function tryRemoteImageAssistant_(payload) {
    const endpoint = config.aiImageAnalysisUrl || "";
    if (!endpoint) {
      return null;
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (!response.ok || !result || !result.suggestion) {
        throw new Error(result && result.error ? result.error : "Resposta inválida da IA visual.");
      }

      return {
        mode: result.mode || "remote",
        title: result.title || "Análise visual da foto",
        suggestion: cleanMultiline_(result.suggestion),
        note: result.note || "Análise visual gerada pelo backend seguro.",
        analysis: result.analysis || null
      };
    } catch (error) {
      return buildLocalImageFallback_(payload, "O backend de IA visual não respondeu. O ObraReport manteve o fluxo seguro sem alterar o upload ou o PDF.");
    }
  }

  function buildLocalImageFallback_(payload, note) {
    const image = payload.image || {};
    const context = payload.context || {};
    const label = context.imageLabel || context.targetName || "foto anexada";
    const dimensions = image.width && image.height ? " (" + image.width + "x" + image.height + " px)" : "";
    const categories = OBRAREPORT_IMAGE_ANALYSIS_LIBRARY.map(function (item) {
      return item.category;
    }).join("; ");
    const localSuggestion = [
      "Elemento observado: " + label + dimensions + ".",
      "Possivel manifestacao: nao classificada no modo local. A imagem nao foi analisada por IA visual neste momento.",
      "Evidencias visuais: nao avaliadas automaticamente no fallback local. Revise a foto manualmente e descreva apenas o que estiver visivel.",
      "Verificacoes recomendadas: conferir a imagem em campo; comparar com a biblioteca tecnica preparada (" + categories + "); acionar o backend de IA visual quando disponivel; validar qualquer conclusao com o responsavel tecnico.",
      "Grau preliminar: nao classificado no modo local.",
      "Texto sugerido para relatorio: Registro fotografico anexado ao relatorio. Recomenda-se revisao tecnica da imagem antes da emissao do PDF.",
      "Observacao obrigatoria: Analise assistida por IA, sujeita a validacao do responsavel tecnico."
    ].join("\n");

    return {
      mode: "local",
      title: "Analise visual local de contingencia",
      suggestion: localSuggestion,
      note: note || "Modo local ativo. Nenhuma manifestacao patologica foi inferida sem o backend de IA visual.",
      analysis: null
    };
    const suggestion = [
      "DESCRIÇÃO TÉCNICA: A " + label + dimensions + " foi processada e está pronta para análise visual real pelo backend seguro.",
      "POSSÍVEIS INCONFORMIDADES: A análise visual automática não foi executada neste momento. Revise manualmente a imagem e descreva apenas condições visíveis.",
      "RECOMENDAÇÃO DE AÇÃO: Configure ou religue o backend de IA visual para obter uma análise multimodal. Enquanto isso, mantenha a descrição técnica manual.",
      "TEXTO PARA O RELATÓRIO: Registro fotográfico anexado ao relatório. Recomenda-se revisão técnica da imagem antes da emissão do PDF."
    ].join("\n\n");

    return {
      mode: "local",
      title: "Análise visual local de contingência",
      suggestion: suggestion,
      note: note || "Modo local ativo. Nenhuma informação visual foi inferida sem o backend de IA.",
      analysis: null
    };
  }

  function buildImprovedText_(text, context) {
    const kind = context && context.kind ? context.kind : "technical";
    const normalized = ensureFinalPeriod_(clean_(text));

    if (!normalized) {
      return buildEmptyTemplate_(kind, context || {});
    }

    if (kind === "daily-services") {
      return buildDailyServicesText_(normalized);
    }

    const localText = buildPatternBasedText_(normalized, kind);
    if (localText) {
      return localText;
    }

    if (kind === "solution") {
      return "Recomenda-se " + lowerFirst_(normalized) + " A execução deve ser registrada por evidência fotográfica e acompanhada pela equipe técnica responsável até a conclusão da correção.";
    }

    if (kind === "photo") {
      return "Registro fotográfico da condição observada em campo. " + normalized + " A imagem deve ser utilizada como evidência técnica da situação verificada na vistoria.";
    }

    return "Durante a vistoria, foi verificado que " + lowerFirst_(normalized) + " A situação deve ser acompanhada tecnicamente, mantendo-se o registro das providências adotadas e das evidências de correção.";
  }

  function buildDailyServicesText_(text) {
    return capitalize_(ensureFinalPeriod_(
      text
        .replace(/\s+(execucao|execução|execu[cç][aã]o)\s+/gi, ". Execução ")
        .replace(/\b(execucao|execução|execu[cç][aã]o)\b/gi, "Execução")
        .replace(/\bblocos?\s+estrutural\b/gi, "blocos estruturais")
        .replace(/(\d+(?:[,.]\d+)?)\s*(m2|m²)\b/gi, "$1 m²")
        .replace(/(\d+(?:[,.]\d+)?)\s*(m3|m³)\b/gi, "$1 m³")
        .replace(/(\d+(?:[,.]\d+)?)\s*(m)\b/gi, "$1 m")
        .replace(/\s+/g, " ")
        .replace(/\.\s*\./g, ".")
        .trim()
    ));
  }

  function buildPatternBasedText_(text, kind) {
    const pattern = findLocalPattern_(text);

    if (!pattern) {
      return "";
    }

    const local = extractLocation_(text);
    const description = pattern.description.replace("{local}", local);

    if (kind === "solution") {
      return capitalize_(pattern.recommendation) + ".";
    }

    if (kind === "photo") {
      return "Registro fotográfico do local verificado. " + description + ", " + pattern.recommendation + ".";
    }

    return description + ", " + pattern.recommendation + ".";
  }

  function findLocalPattern_(text) {
    const normalized = normalizeSearchText_(text);

    return LOCAL_TEXT_PATTERNS.find(function (pattern) {
      return pattern.terms.some(function (term) {
        return normalized.indexOf(normalizeSearchText_(term)) !== -1;
      });
    }) || null;
  }

  function extractLocation_(text) {
    const raw = clean_(text).replace(/[.!?]+$/g, "");
    const match = raw.match(/\b(perto da|perto do|proximo a|pr[oó]ximo a|junto a|na|no|nas|nos|da|do|das|dos|em)\s+(.+)$/i);

    if (!match || !match[2]) {
      return " no ambiente inspecionado";
    }

    return " " + match[1].toLowerCase() + " " + match[2].trim();
  }

  function normalizeSearchText_(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function capitalize_(value) {
    if (!value) {
      return "";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function buildEmptyTemplate_(kind, context) {
    if (kind === "solution") {
      return "Recomenda-se executar a correção do item identificado, registrar a intervenção realizada e submeter a solução à verificação da equipe técnica responsável.";
    }

    if (kind === "photo") {
      return "Registro fotográfico da condição observada em campo, utilizado como evidência técnica da vistoria realizada.";
    }

    if (kind === "general") {
      const obra = context.report && context.report.obra ? context.report.obra : "a obra vistoriada";
      return "Durante a vistoria em " + obra + ", foram avaliadas as condições executivas, os registros fotográficos e os pontos de atenção identificados em campo.";
    }

    return "Foi identificada condição técnica que requer acompanhamento, registro das providências adotadas e verificação posterior pela equipe responsável.";
  }

  function buildReviewChecklist_(context) {
    const report = context.report || {};
    const stats = context.stats || {};
    const missing = [];

    if (!report.obra) {
      missing.push("nome da obra");
    }
    if (!report.local) {
      missing.push("local da vistoria");
    }
    if (!report.dataVistoria) {
      missing.push("data da vistoria");
    }
    if (!report.responsavelTecnico) {
      missing.push("responsável técnico");
    }
    if (!report.emailDestino) {
      missing.push("e-mail para envio do PDF");
    }

    const lines = [
      "Revisão antes da exportação:",
      "- Fotos da unidade preenchidas: " + Number(stats.fotos || 0) + ".",
      "- Inconformidades registradas: " + Number(stats.inconformidades || 0) + ".",
      "- Itens de risco alto/interdição: " + Number(stats.riscosAltos || 0) + "."
    ];

    if (missing.length) {
      lines.push("- Conferir campos pendentes: " + missing.join(", ") + ".");
    } else {
      lines.push("- Os campos principais do relatório estão preenchidos.");
    }

    lines.push("- Antes de gerar o PDF, revise descrições, soluções recomendadas, grau de risco e qualidade das imagens anexadas.");
    return lines.join("\n");
  }

  function clean_(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function cleanMultiline_(value) {
    return String(value || "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  }

  function cleanBase64_(value) {
    return String(value || "").replace(/^data:[^,]+,/, "").replace(/\s+/g, "").trim();
  }

  function safePromptValue_(value) {
    return clean_(value) || "-";
  }

  function ensureFinalPeriod_(value) {
    if (!value) {
      return "";
    }

    return /[.!?]$/.test(value) ? value : value + ".";
  }

  function lowerFirst_(value) {
    if (!value) {
      return "";
    }

    return value.charAt(0).toLowerCase() + value.slice(1);
  }

  window.ObraReportAI = {
    improveTechnicalText: improveTechnicalText,
    generateConclusion: generateConclusion,
    reviewReport: reviewReport,
    analyzeImage: analyzeImage,
    buildImageAnalysisPrompt: buildImageAnalysisPrompt,
    imageAnalysisLibrary: OBRAREPORT_IMAGE_ANALYSIS_LIBRARY
  };
})();
