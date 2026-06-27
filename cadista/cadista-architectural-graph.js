(function () {
  "use strict";

  function normalizeText(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function node(id, type, room, extra) {
    return Object.assign({ id, type, room }, extra || {});
  }

  function edge(from, to, relation, reason) {
    return { from, to, relation, reason: reason || "" };
  }

  function roomIds(adaptedTemplate) {
    return (adaptedTemplate && adaptedTemplate.roomSizes || []).map((room) => room.id);
  }

  function hasRoom(adaptedTemplate, id) {
    return roomIds(adaptedTemplate).includes(id);
  }

  function buildCadistaArchitecturalGraph(adaptedTemplate, intentInput) {
    if (!adaptedTemplate || !adaptedTemplate.sourceTemplateId) throw new Error("Template adaptado invalido para grafo arquitetonico.");
    const intent = intentInput || adaptedTemplate.intent || {};
    const text = normalizeText([intent.rawInput, adaptedTemplate.family, adaptedTemplate.strategy].filter(Boolean).join(" "));
    const socialIntegrated = Boolean(adaptedTemplate.constraints && adaptedTemplate.constraints.socialIntegratedRequired) || /(social integrado|conceito aberto|cozinha americana|open concept|balcao|ilha)/.test(text);
    const needsCorridor = Boolean(adaptedTemplate.constraints && adaptedTemplate.constraints.suiteRequired) || /(corredor|setor intimo|privacidade|3_quartos)/.test(text);
    const nodes = [
      node("sala", "social", "Sala de estar"),
      node("jantar", "social", "Jantar"),
      node("cozinha", "service", "Cozinha"),
      node("servico", "service", hasRoom(adaptedTemplate, "servico") ? "Area de servico" : "Area de servico prevista", { optional: !hasRoom(adaptedTemplate, "servico") }),
      node("banheiro_social", "wet", "Banheiro social"),
      node("corredor", "circulation", "Corredor", { required: needsCorridor })
    ];
    if (hasRoom(adaptedTemplate, "quarto_1")) nodes.push(node("quarto_1", "private", "Quarto 1"));
    if (hasRoom(adaptedTemplate, "quarto_2")) nodes.push(node("quarto_2", "private", "Quarto 2"));
    if (hasRoom(adaptedTemplate, "suite")) nodes.push(node("suite", "private", "Suite", { required: true }));
    if (hasRoom(adaptedTemplate, "banho_suite")) nodes.push(node("banho_suite", "wet", "Banheiro suite", { required: true }));

    const edges = [];
    if (socialIntegrated) {
      edges.push(edge("sala", "jantar", "integrated", "area social integrada"));
      edges.push(edge("jantar", "cozinha", "integrated", "cozinha participa do nucleo social"));
    } else {
      edges.push(edge("sala", "jantar", "open", "setor social contiguo"));
      edges.push(edge("jantar", "cozinha", "door", "cozinha conectada ao jantar"));
    }
    if (hasRoom(adaptedTemplate, "servico")) edges.push(edge("cozinha", "servico", "door", "servico deve ficar proximo da cozinha"));
    edges.push(edge("sala", "corredor", "transition", "transicao do social para o intimo"));
    if (hasRoom(adaptedTemplate, "quarto_1")) edges.push(edge("corredor", "quarto_1", "door", "quarto acessado pelo corredor"));
    if (hasRoom(adaptedTemplate, "quarto_2")) edges.push(edge("corredor", "quarto_2", "door", "quarto acessado pelo corredor"));
    edges.push(edge("corredor", "banheiro_social", "door", "banheiro social acessivel sem passar por quarto"));
    if (hasRoom(adaptedTemplate, "suite")) edges.push(edge("corredor", "suite", "door", "suite com acesso privativo"));
    if (hasRoom(adaptedTemplate, "suite") && hasRoom(adaptedTemplate, "banho_suite")) edges.push(edge("suite", "banho_suite", "door", "suite contem banheiro proprio"));

    return {
      sourceTemplateId: adaptedTemplate.sourceTemplateId,
      family: adaptedTemplate.family,
      nodes,
      edges,
      requirements: {
        socialIntegrated,
        needsCorridor,
        suiteRequired: Boolean(adaptedTemplate.constraints && adaptedTemplate.constraints.suiteRequired),
        serviceRequired: hasRoom(adaptedTemplate, "servico")
      },
      warnings: adaptedTemplate.warnings || []
    };
  }

  function hasNode(graph, id) {
    return Boolean((graph.nodes || []).find((item) => item.id === id));
  }

  function hasEdge(graph, from, to, relation) {
    return Boolean((graph.edges || []).find((item) => item.from === from && item.to === to && (!relation || item.relation === relation)));
  }

  function hasConnection(graph, a, b, relation) {
    return hasEdge(graph, a, b, relation) || hasEdge(graph, b, a, relation);
  }

  function validateCadistaArchitecturalGraph(graph) {
    const errors = [];
    const warnings = [];
    if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
      return { ok: false, errors: ["Grafo arquitetonico ausente ou invalido."], warnings: [] };
    }
    ["sala", "cozinha", "banheiro_social"].forEach((id) => {
      if (!hasNode(graph, id)) errors.push(`No obrigatorio ausente: ${id}.`);
    });
    if (graph.requirements && graph.requirements.socialIntegrated) {
      if (!hasConnection(graph, "sala", "jantar", "integrated")) errors.push("Social integrado exige sala e jantar conectados.");
      if (!hasConnection(graph, "jantar", "cozinha", "integrated")) errors.push("Social integrado exige jantar e cozinha conectados.");
    }
    if (graph.requirements && graph.requirements.serviceRequired && !hasConnection(graph, "cozinha", "servico")) {
      warnings.push("Cozinha sem relacao direta com area de servico.");
    }
    if (hasNode(graph, "corredor")) {
      ["quarto_1", "quarto_2", "suite"].forEach((room) => {
        if (hasNode(graph, room) && !hasConnection(graph, "corredor", room, "door")) warnings.push(`${room} deveria abrir para corredor/hall.`);
      });
      if (!hasConnection(graph, "corredor", "banheiro_social", "door")) errors.push("Banheiro social deve ser acessivel sem passar por quarto.");
      if (hasConnection(graph, "cozinha", "quarto_1") || hasConnection(graph, "cozinha", "quarto_2")) warnings.push("Quarto ligado diretamente a cozinha; revisar privacidade.");
    }
    if (graph.requirements && graph.requirements.suiteRequired) {
      if (!hasNode(graph, "suite")) errors.push("Suite obrigatoria ausente.");
      if (!hasNode(graph, "banho_suite")) errors.push("Banheiro da suite ausente.");
      if (hasNode(graph, "suite") && hasNode(graph, "banho_suite") && !hasConnection(graph, "suite", "banho_suite", "door")) errors.push("Suite deve conter banheiro conectado.");
    }
    (graph.warnings || []).forEach((item) => warnings.push(item));
    return { ok: errors.length === 0, errors, warnings };
  }

  function summarizeCadistaArchitecturalGraph(graph) {
    const validation = validateCadistaArchitecturalGraph(graph);
    const nodeCount = graph && graph.nodes ? graph.nodes.length : 0;
    const edgeCount = graph && graph.edges ? graph.edges.length : 0;
    const integrated = graph && graph.requirements && graph.requirements.socialIntegrated ? "social integrado" : "social setorizado";
    const suite = graph && graph.requirements && graph.requirements.suiteRequired ? "com suite validada" : "sem suite obrigatoria";
    return `Grafo com ${nodeCount} ambientes e ${edgeCount} relacoes: ${integrated}, ${suite}. Validacao: ${validation.ok ? "OK" : "revisar"}.`;
  }

  window.CadistaArchitecturalGraph = {
    buildCadistaArchitecturalGraph,
    validateCadistaArchitecturalGraph,
    summarizeCadistaArchitecturalGraph
  };
  window.buildCadistaArchitecturalGraph = buildCadistaArchitecturalGraph;
  window.validateCadistaArchitecturalGraph = validateCadistaArchitecturalGraph;
  window.summarizeCadistaArchitecturalGraph = summarizeCadistaArchitecturalGraph;
})();
