(function () {
  "use strict";

  function clean(value) {
    return String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  }

  function actionResult(input, values) {
    return Object.assign({
      handled: true,
      ok: values && values.ok !== false,
      module: "municipal",
      action: input && input.action || "",
      mode: "municipal_action_adapter"
    }, values || {});
  }

  function safeError(input, message, code) {
    return actionResult(input, {
      ok: false,
      mode: "blocked",
      error: code || "municipal_context_required",
      humanAnswer: message
    });
  }

  function apiBase() {
    return clean(window.OBRAREPORT_API_BASE_URL || "").replace(/\/+$/g, "");
  }

  function authToken(input) {
    return clean(input && input.context && input.context.authToken || window.MUNICIPAL_ADMIN_AUTH_TOKEN || window.ELO_AUTH_TOKEN || window.ELO_SENTINEL_AUTH_TOKEN);
  }

  function identity(input) {
    return Object.assign({}, window.ELO_MUNICIPAL_CONTEXT || {}, input && input.context && input.context.identity || {}, input && input.context && input.context.municipal || {});
  }

  function institutionId(input) {
    const ctx = identity(input);
    return clean(ctx.institutionId || ctx.institution_id || input && input.payload && (input.payload.institutionId || input.payload.institution_id));
  }

  function unitId(input) {
    const ctx = identity(input);
    return clean(ctx.unitId || ctx.unit_id || input && input.payload && (input.payload.unitId || input.payload.unit_id));
  }

  function requireMunicipalContext(input) {
    if (!authToken(input)) return safeError(input, "Preciso de autenticação municipal para consultar dados reais da prefeitura.", "authentication_required");
    if (!institutionId(input)) return safeError(input, "Preciso do contexto da prefeitura antes de consultar o MVP Municipal.", "institution_id_required");
    if (!apiBase()) return safeError(input, "Preciso da URL do backend municipal configurada antes de consultar dados reais.", "municipal_backend_required");
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

  function municipalUrl(path, query) {
    const suffix = qs(query);
    return apiBase() + "/api/municipal-admin" + path + (suffix ? "?" + suffix : "");
  }

  function request(input, path, options, query) {
    return fetch(municipalUrl(path, query), Object.assign({}, options || {}, {
      headers: Object.assign({
        "Content-Type": "application/json",
        Authorization: "Bearer " + authToken(input)
      }, options && options.headers || {})
    })).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok || data.ok === false) throw new Error(clean(data.error) || "municipal_request_failed");
        return data;
      });
    });
  }

  function preview(input, text, data) {
    return actionResult(input, {
      mode: "preview",
      requiresConfirmation: true,
      preview: text,
      humanAnswer: text,
      data: data || {}
    });
  }

  function endpointQuery(input, extra) {
    return Object.assign({ institution_id: institutionId(input), unit_id: unitId(input) }, extra || {});
  }

  function listAssets(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    return request(input, "/assets", {}, endpointQuery(input)).then(function (data) {
      const assets = data.assets || [];
      return actionResult(input, {
        humanAnswer: assets.length ? "Encontrei " + assets.length + " patrimônio(s) municipal(is) no escopo autorizado." : "Não encontrei patrimônios no escopo municipal autorizado.",
        data: { assets: assets }
      });
    }).catch(function (error) {
      return safeError(input, "Não consegui consultar o patrimônio municipal: " + clean(error.message) + ".", "assets_query_failed");
    });
  }

  function listDocuments(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    return request(input, "/documents", {}, endpointQuery(input)).then(function (data) {
      const documents = data.documents || [];
      return actionResult(input, {
        humanAnswer: documents.length ? "Encontrei " + documents.length + " documento(s) no Acervo Municipal autorizado." : "Não encontrei documentos no Acervo Municipal autorizado.",
        data: { documents: documents }
      });
    }).catch(function (error) {
      return safeError(input, "Não consegui consultar o Acervo Municipal: " + clean(error.message) + ".", "archive_documents_failed");
    });
  }

  function listNotifications(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    return request(input, "/notifications", {}, endpointQuery(input)).then(function (data) {
      const notifications = data.notifications || [];
      return actionResult(input, {
        humanAnswer: notifications.length ? "Encontrei " + notifications.length + " notificação(ões) municipal(is) no escopo autorizado." : "Não encontrei notificações municipais no escopo autorizado.",
        data: { notifications: notifications }
      });
    }).catch(function (error) {
      return safeError(input, "Não consegui consultar notificações municipais: " + clean(error.message) + ".", "notifications_query_failed");
    });
  }

  function attention(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    return Promise.all([
      request(input, "/sentinel/alerts", {}, endpointQuery(input)).catch(function () { return { alerts: [] }; }),
      request(input, "/notifications", {}, endpointQuery(input)).catch(function () { return { notifications: [] }; }),
      request(input, "/assets", {}, endpointQuery(input)).catch(function () { return { assets: [] }; })
    ]).then(function (parts) {
      const alerts = parts[0].alerts || [];
      const notifications = parts[1].notifications || [];
      const assets = parts[2].assets || [];
      const critical = alerts.filter(function (item) { return /critical|high/i.test(clean(item.severity)); }).length;
      const assetIssues = assets.filter(function (item) { return /ruim|inservivel|em_manutencao/i.test(clean(item.condition) + " " + clean(item.status)); }).length;
      return actionResult(input, {
        humanAnswer: "Atenção municipal: " + alerts.length + " alerta(s), " + critical + " crítico(s)/alto(s), " + notifications.length + " notificação(ões) e " + assetIssues + " patrimônio(s) com atenção operacional.",
        data: { alerts: alerts, notifications: notifications, assets: assets }
      });
    });
  }

  function reportPreview(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    if (input.dryRun) {
      return Promise.resolve(preview(input, "Posso gerar um preview de relatório municipal. Confirme antes de salvar qualquer documento no Acervo.", { endpoint: "/api/municipal-admin/reports/preview" }));
    }
    return request(input, "/reports/preview", {
      method: "POST",
      body: JSON.stringify(Object.assign({ report_type: "administrativo", period: new Date().getFullYear() }, endpointQuery(input), input.payload && input.payload.report || {}))
    }).then(function (data) {
      return actionResult(input, { humanAnswer: "Preview de relatório municipal gerado para revisão.", data: data });
    });
  }

  function reportArchive(input) {
    const blocked = requireMunicipalContext(input);
    if (blocked) return Promise.resolve(blocked);
    const payload = input.payload || {};
    if (!payload.confirmation) return Promise.resolve(safeError(input, "Não vou salvar relatório no Acervo sem confirmação humana.", "confirmation_required"));
    if (!clean(payload.operation_id || payload.operationId)) return Promise.resolve(safeError(input, "Preciso de operation_id para arquivar relatório municipal com auditoria.", "operation_id_required"));
    if (input.dryRun) return Promise.resolve(preview(input, "Relatório municipal pronto para arquivar no Acervo após confirmação.", { endpoint: "/api/municipal-admin/reports/archive" }));
    return request(input, "/reports/archive", {
      method: "POST",
      body: JSON.stringify(Object.assign({}, payload, { confirmation: true, operation_id: clean(payload.operation_id || payload.operationId) }))
    }).then(function (data) {
      return actionResult(input, { humanAnswer: "Relatório municipal salvo no Acervo com confirmação humana.", data: data });
    });
  }

  function execute(input) {
    const action = clean(input && input.action);
    if (action === "municipal.attention") return attention(input);
    if (action === "assets.list") return listAssets(input);
    if (action === "archive.documents.list") return listDocuments(input);
    if (action === "notifications.list") return listNotifications(input);
    if (action === "reports.preview") return reportPreview(input);
    if (action === "reports.archive") return reportArchive(input);
    return actionResult(input, { handled: false, ok: false, error: "unsupported_municipal_action" });
  }

  window.EloMunicipalActionAdapter = Object.assign({}, window.EloMunicipalActionAdapter || {}, {
    execute: execute,
    version: "elo-municipal-action-adapter-v1"
  });
})();
