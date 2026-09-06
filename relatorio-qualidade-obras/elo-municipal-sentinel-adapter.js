(function () {
  "use strict";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function output(input, values) {
    return Object.assign({
      handled: true,
      ok: values && values.ok !== false,
      module: "municipal_sentinel",
      action: input && input.action || "",
      mode: "municipal_sentinel_adapter"
    }, values || {});
  }

  function blocked(input, message, code) {
    return output(input, { ok: false, mode: "blocked", error: code || "sentinel_context_required", humanAnswer: message });
  }

  function apiBase() {
    return clean(window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
  }

  function authToken(input) {
    return clean(input && input.context && input.context.authToken || window.ELO_SENTINEL_AUTH_TOKEN || window.MUNICIPAL_ADMIN_AUTH_TOKEN || window.ELO_AUTH_TOKEN);
  }

  function identity(input) {
    return Object.assign({}, window.ELO_MUNICIPAL_CONTEXT || {}, input && input.context && input.context.identity || {}, input && input.context && input.context.municipal || {}, input && input.payload && input.payload.context || {});
  }

  function scope(input) {
    const ctx = identity(input);
    return {
      institution_id: clean(ctx.institutionId || ctx.institution_id || input && input.payload && (input.payload.institution_id || input.payload.institutionId)),
      company_id: clean(ctx.companyId || ctx.company_id || input && input.payload && (input.payload.company_id || input.payload.companyId)),
      project_id: clean(ctx.projectId || ctx.project_id || input && input.payload && (input.payload.project_id || input.payload.projectId))
    };
  }

  function requireScope(input) {
    const current = scope(input);
    if (!authToken(input)) return blocked(input, "Preciso de autenticação para consultar o Sentinela da obra.", "authentication_required");
    if (!current.institution_id) return blocked(input, "Preciso do contexto da prefeitura para consultar o Sentinela.", "institution_id_required");
    if (!current.company_id) return blocked(input, "Preciso do contexto da empresa/órgão para consultar o Sentinela.", "company_id_required");
    if (!current.project_id) return blocked(input, "Preciso da obra ativa antes de consultar o Sentinela.", "project_id_required");
    if (!apiBase()) return blocked(input, "Preciso da URL do backend configurada antes de consultar o Sentinela.", "sentinel_backend_required");
    return null;
  }

  function qs(values) {
    const params = new URLSearchParams();
    Object.keys(values || {}).forEach(function (key) {
      const value = values[key];
      if (value !== undefined && value !== null && clean(value)) params.set(key, clean(value));
    });
    return params.toString();
  }

  function sentinelUrl(path, query) {
    const suffix = qs(Object.assign({}, scope({ payload: { context: window.ELO_MUNICIPAL_CONTEXT || {} } }), query || {}));
    return apiBase() + "/api/elo/sentinel" + path + (suffix ? "?" + suffix : "");
  }

  function payloadWithScope(input, body) {
    return Object.assign({}, body || {}, scope(input));
  }

  function request(input, path, options, query) {
    return fetch(sentinelUrl(path, query || scope(input)), Object.assign({}, options || {}, {
      headers: Object.assign({
        "Content-Type": "application/json",
        Authorization: "Bearer " + authToken(input)
      }, options && options.headers || {})
    })).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) throw new Error(clean(data.error) || "sentinel_request_failed");
        return data;
      });
    });
  }

  function preview(input, message, data) {
    return output(input, { mode: "preview", requiresConfirmation: true, preview: message, humanAnswer: message, data: data || {} });
  }

  function requireConfirmation(input, message) {
    if (input.dryRun) return preview(input, message, { dryRun: true });
    if (!(input.payload && input.payload.confirmation === true)) return blocked(input, "Preciso de confirmação humana antes de executar esta ação do Sentinela.", "confirmation_required");
    return null;
  }

  function activePendingId(input) {
    const ctx = identity(input);
    return clean(input && input.payload && (input.payload.pending_item_id || input.payload.pendingItemId || input.payload.id) || ctx.pendingItemId || ctx.pending_item_id);
  }

  function listEvidences(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    return request(input, "/evidences", {}, input.payload || {}).then(function (data) {
      const rows = data.evidences || [];
      return output(input, { humanAnswer: rows.length ? "Encontrei " + rows.length + " evidência(s) da obra ativa." : "Não encontrei evidências na obra ativa.", data: data });
    });
  }

  function timeline(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    return request(input, "/timeline", {}, input.payload || {}).then(function (data) {
      const rows = data.events || [];
      return output(input, { humanAnswer: rows.length ? "Encontrei " + rows.length + " evento(s) na timeline da obra." : "A timeline da obra ainda não tem eventos.", data: data });
    });
  }

  function listPending(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    return request(input, "/pending-items", {}, input.payload || {}).then(function (data) {
      const rows = data.pending_items || data.pendingItems || [];
      return output(input, { humanAnswer: rows.length ? "Encontrei " + rows.length + " pendência(s) do Sentinela na obra ativa." : "Não encontrei pendências do Sentinela na obra ativa.", data: data });
    });
  }

  function getPending(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    const id = activePendingId(input);
    if (!id) return Promise.resolve(blocked(input, "Selecione uma pendência antes de pedir o detalhe.", "pending_item_id_required"));
    return request(input, "/pending-items/" + encodeURIComponent(id), {}, input.payload || {}).then(function (data) {
      return output(input, { humanAnswer: "Abri o detalhe da pendência selecionada.", data: data });
    });
  }

  function createPending(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    const confirm = requireConfirmation(input, "Posso criar a pendência do Sentinela, mas preciso da sua confirmação antes de gravar.");
    if (confirm) return Promise.resolve(confirm);
    return request(input, "/pending-items", {
      method: "POST",
      body: JSON.stringify(payloadWithScope(input, input.payload || {}))
    }).then(function (data) {
      return output(input, { humanAnswer: "Pendência criada no Sentinela com auditoria.", data: data });
    });
  }

  function updatePending(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    const id = activePendingId(input);
    if (!id) return Promise.resolve(blocked(input, "Selecione uma pendência antes de atualizar.", "pending_item_id_required"));
    const confirm = requireConfirmation(input, "Posso atualizar a pendência do Sentinela, mas preciso da sua confirmação antes de gravar.");
    if (confirm) return Promise.resolve(confirm);
    return request(input, "/pending-items/" + encodeURIComponent(id), {
      method: "PUT",
      body: JSON.stringify(payloadWithScope(input, input.payload || {}))
    }).then(function (data) {
      return output(input, { humanAnswer: "Pendência atualizada no Sentinela com auditoria.", data: data });
    });
  }

  function linkEvidence(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    const id = activePendingId(input);
    if (!id) return Promise.resolve(blocked(input, "Selecione uma pendência antes de vincular evidência.", "pending_item_id_required"));
    const confirm = requireConfirmation(input, "Posso vincular a evidência à pendência, mas preciso da sua confirmação antes de gravar.");
    if (confirm) return Promise.resolve(confirm);
    return request(input, "/pending-items/" + encodeURIComponent(id) + "/evidences", {
      method: "POST",
      body: JSON.stringify(payloadWithScope(input, input.payload || {}))
    }).then(function (data) {
      return output(input, { humanAnswer: "Evidência vinculada à pendência com auditoria.", data: data });
    });
  }

  function validatePending(input) {
    const missing = requireScope(input);
    if (missing) return Promise.resolve(missing);
    const id = activePendingId(input);
    if (!id) return Promise.resolve(blocked(input, "Selecione uma pendência ativa antes de aprovar ou rejeitar a correção.", "pending_item_id_required"));
    const decision = clean(input && input.payload && input.payload.decision);
    if (decision !== "approved" && decision !== "rejected") return Promise.resolve(blocked(input, "A validação precisa informar approved ou rejected.", "invalid_validation_decision"));
    if (decision === "rejected" && !clean(input && input.payload && input.payload.notes)) return Promise.resolve(blocked(input, "Para rejeitar uma correção, registre o motivo.", "validation_notes_required"));
    const confirm = requireConfirmation(input, decision === "approved" ? "Posso aprovar a correção selecionada, mas preciso da sua confirmação antes de gravar." : "Posso rejeitar a correção selecionada com o motivo informado, mas preciso da sua confirmação antes de gravar.");
    if (confirm) return Promise.resolve(confirm);
    const body = Object.assign({}, input.payload || {}, scope(input), { decision: decision });
    delete body.validated_by;
    delete body.validatedBy;
    return request(input, "/pending-items/" + encodeURIComponent(id) + "/validate", {
      method: "POST",
      body: JSON.stringify(body)
    }).then(function (data) {
      return output(input, { humanAnswer: decision === "approved" ? "Correção aprovada no Sentinela com auditoria." : "Correção rejeitada no Sentinela com auditoria.", data: data });
    });
  }

  function execute(input) {
    const action = clean(input && input.action);
    if (action === "sentinel.evidences.list") return listEvidences(input);
    if (action === "sentinel.timeline") return timeline(input);
    if (action === "sentinel.pending.list") return listPending(input);
    if (action === "sentinel.pending.get") return getPending(input);
    if (action === "sentinel.pending.create") return createPending(input);
    if (action === "sentinel.pending.update") return updatePending(input);
    if (action === "sentinel.pending.linkEvidence") return linkEvidence(input);
    if (action === "sentinel.pending.validate") return validatePending(input);
    return output(input, { handled: false, ok: false, error: "unsupported_sentinel_action" });
  }

  window.EloMunicipalSentinelAdapter = Object.assign({}, window.EloMunicipalSentinelAdapter || {}, {
    execute: execute,
    version: "elo-municipal-sentinel-adapter-v1"
  });
})();
