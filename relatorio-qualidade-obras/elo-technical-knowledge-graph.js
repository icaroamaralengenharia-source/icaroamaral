(function (root) {
  "use strict";

  const VERSION = "20260624-elo-technical-knowledge-graph-v0";
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

  const nodes = [
    ["casa", "Casa", "typology", ["casa", "residencial"], ["area", "cidade_uf", "padrao"]],
    ["fundacao", "Fundação", "package", ["fundacao", "sapata", "radier", "baldrame"], ["tipo_fundacao"]],
    ["estrutura", "Estrutura", "package", ["estrutura", "pilar", "viga", "laje"], ["sistema_estrutural"]],
    ["alvenaria", "Alvenaria", "package", ["alvenaria", "parede", "bloco"], ["area_alvenaria", "tipo_bloco"]],
    ["cobertura", "Cobertura", "package", ["cobertura", "telhado", "telhamento"], ["tipo_telha", "estrutura"]],
    ["piso", "Piso", "package", ["piso", "revestimento", "porcelanato"], ["area_piso", "tipo_piso"]],
    ["revestimento", "Revestimento", "service", ["chapisco", "reboco", "emboco"], ["area", "ambiente"]],
    ["pintura", "Pintura", "service", ["pintura", "tinta"], ["area_pintura"]],
    ["instalacoes", "Instalações", "package", ["eletrica", "hidraulica"], ["pontos", "projeto"]],
    ["esquadrias", "Esquadrias", "package", ["porta", "janela"], ["quantidade", "dimensoes"]],
    ["estrutura_madeira", "Estrutura de madeira", "service", ["madeira", "ripa", "caibro", "terca"], ["tipo_madeira"]],
    ["estrutura_metalica", "Estrutura metálica", "service", ["metalica", "aco"], ["perfil"]],
    ["telha_portuguesa", "Telha portuguesa", "material", ["telha portuguesa", "telhado portugues"], ["area_cobertura"]],
    ["telha_colonial", "Telha colonial", "material", ["telha colonial"], ["area_cobertura"]],
    ["cumeeira", "Cumeeira", "material", ["cumeeira"], ["comprimento"]],
    ["ripa", "Ripa", "material", ["ripa"], ["area_cobertura"]],
    ["caibro", "Caibro", "material", ["caibro"], ["area_cobertura"]],
    ["terca", "Terça", "material", ["terca", "terça"], ["area_cobertura"]],
    ["mao_obra", "Mão de obra", "labor", ["mao de obra", "pedreiro", "carpinteiro"], []],
    ["bloco_ceramico", "Bloco cerâmico", "material", ["bloco ceramico"], ["area_alvenaria"]],
    ["bloco_baiano", "Bloco baiano", "material", ["bloco baiano", "bloco ceramico baiano"], ["area_alvenaria"]],
    ["argamassa", "Argamassa", "material", ["argamassa"], ["tipo_argamassa"]],
    ["verga", "Verga", "service", ["verga"], ["vao"]],
    ["contraverga", "Contraverga", "service", ["contraverga"], ["vao"]],
    ["chapisco", "Chapisco", "service", ["chapisco"], ["area"]],
    ["reboco", "Reboco", "service", ["reboco", "emboco", "massa unica"], ["area", "espessura"]],
    ["contrapiso", "Contrapiso", "service", ["contrapiso"], ["area", "espessura"]],
    ["piso_ceramico", "Piso cerâmico", "material", ["piso ceramico", "revestimento ceramico"], ["area", "junta"]],
    ["porcelanato", "Porcelanato", "material", ["porcelanato"], ["area", "junta"]],
    ["ac_i", "Argamassa AC-I", "material", ["ac i", "aci"], []],
    ["ac_ii", "Argamassa AC-II", "material", ["ac ii", "ac2"], []],
    ["ac_iii", "Argamassa AC-III", "material", ["ac iii", "ac3"], []],
    ["rejunte", "Rejunte", "material", ["rejunte", "rejuntamento"], ["area"]],
    ["espacadores", "Espaçadores", "material", ["espacador", "espaçador"], []],
    ["auditoria", "Auditoria", "audit", ["auditoria", "conferencia"], []],
    ["servico_executado", "Serviço executado", "audit", ["servico executado", "executado"], []],
    ["retirada_estoque", "Retirada de estoque", "audit", ["retirada", "estoque", "almoxarifado"], []],
    ["consumo_previsto", "Consumo previsto", "audit", ["consumo previsto"], []],
    ["rdo", "RDO", "audit", ["rdo", "diario de obra"], []],
    ["desvio", "Desvio", "audit", ["desvio", "divergencia"], []],
    ["justificativa", "Justificativa", "audit", ["justificativa"], []]
  ].map(function (n) { return { id: n[0], label: n[1], type: n[2], searchTerms: n[3], requiredParameters: n[4] }; });
  const edges = [];
  function edge(from, to, relation) { edges.push({ from, to, relation }); }
  ["fundacao","estrutura","alvenaria","cobertura","piso","revestimento","pintura","instalacoes","esquadrias"].forEach(function (id) { edge("casa", id, "contains"); });
  ["estrutura_madeira","estrutura_metalica","telha_portuguesa","telha_colonial","cumeeira","ripa","caibro","terca","mao_obra"].forEach(function (id) { edge("cobertura", id, id === "mao_obra" ? "requires" : "uses"); });
  ["bloco_ceramico","bloco_baiano","argamassa","verga","contraverga","chapisco","reboco"].forEach(function (id) { edge("alvenaria", id, "uses"); });
  ["contrapiso","piso_ceramico","porcelanato","ac_i","ac_ii","ac_iii","rejunte","espacadores"].forEach(function (id) { edge("piso", id, "uses"); });
  ["servico_executado","retirada_estoque","consumo_previsto","rdo","desvio","justificativa"].forEach(function (id) { edge("auditoria", id, id === "desvio" ? "measured_by" : "audits"); });

  function buildTechnicalKnowledgeGraph() { return { nodes: nodes.slice(), edges: edges.slice() }; }
  function matchingNodes(term) { const text = normalize(term); return nodes.filter(function (n) { return normalize(n.label).indexOf(text) >= 0 || text.indexOf(normalize(n.label)) >= 0 || (n.searchTerms || []).some(function (t) { return text.indexOf(normalize(t)) >= 0 || normalize(t).indexOf(text) >= 0; }); }); }
  function findRelatedConcepts(term) {
    const seeds = matchingNodes(term);
    const ids = {};
    seeds.forEach(function (n) { ids[n.id] = true; edges.forEach(function (e) { if (e.from === n.id) ids[e.to] = true; if (e.to === n.id) ids[e.from] = true; }); });
    return nodes.filter(function (n) { return ids[n.id]; });
  }
  function expandSearchTermsFromGraph(term) { const seen = {}; return findRelatedConcepts(term).reduce(function (list, node) { [node.label].concat(node.searchTerms || []).forEach(function (t) { const key = normalize(t); if (key && !seen[key]) { seen[key] = true; list.push(t); } }); return list; }, []); }
  function suggestNextQuestions(context) { const terms = expandSearchTermsFromGraph(context && context.term || context && context.message || ""); return terms.slice(0, 5).map(function (term) { return "Confirme parâmetro técnico para " + term + "."; }); }

  root.EloTechnicalKnowledgeGraph = { version: VERSION, buildTechnicalKnowledgeGraph, findRelatedConcepts, suggestNextQuestions, expandSearchTermsFromGraph };
})(typeof window !== "undefined" ? window : globalThis);
