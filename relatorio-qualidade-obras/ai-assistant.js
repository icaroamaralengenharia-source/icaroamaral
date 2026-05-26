(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};

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

  function buildImprovedText_(text, context) {
    const kind = context && context.kind ? context.kind : "technical";
    const normalized = ensureFinalPeriod_(clean_(text));

    if (!normalized) {
      return buildEmptyTemplate_(kind, context || {});
    }

    if (kind === "solution") {
      return "Recomenda-se " + lowerFirst_(normalized) + " A execução deve ser registrada por evidência fotográfica e acompanhada pela equipe técnica responsável até a conclusão da correção.";
    }

    if (kind === "photo") {
      return "Registro fotográfico da condição observada em campo. " + normalized + " A imagem deve ser utilizada como evidência técnica da situação verificada na vistoria.";
    }

    return "Durante a vistoria, foi verificado que " + lowerFirst_(normalized) + " A situação deve ser acompanhada tecnicamente, mantendo-se o registro das providências adotadas e das evidências de correção.";
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
    reviewReport: reviewReport
  };
})();
