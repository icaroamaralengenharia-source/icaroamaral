(function (root) {
  "use strict";

  const VERSION = "20260624-elo-executive-budget-v2-controlled-closing";
  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function add(list, id, message) { if (!list.some(function (x) { return x.id === id; })) list.push({ id, message }); }

  function evaluateExecutiveReadiness(projectRecord, budget) {
    const record = projectRecord || {};
    const project = record.project || {};
    const premises = record.premises || {};
    const b = budget || {};
    const blockers = [];
    const missing = [];
    const requiredToClose = [];
    if (!clean(project.name) && !clean(record.client && record.client.name)) add(blockers, "project_identity", "Informe cliente ou identificação da obra.");
    if (!clean(project.cityUf)) add(blockers, "city_uf", "Informe cidade/UF da obra.");
    if (!clean(project.type)) add(missing, "project_type", "Informe tipo de obra.");
    if (!project.builtAreaM2) add(missing, "built_area", "Informe área construída.");
    if ((record.workPackages || []).some(function (p) { return p.status !== "ready"; })) add(blockers, "scope_not_closed", "Escopo ainda possui pacotes pendentes.");
    if (!(record.compositionSelections || []).some(function (c) { return c.selected === true; })) add(blockers, "candidate_compositions", "Composições ainda são candidatas, não selecionadas.");
    if ((b.budgetTable && b.budgetTable.summary && b.budgetTable.summary.pendingRows) > 0) add(blockers, "pending_quantities", "Existem quantitativos/linhas pendentes.");
    if ((b.consumptionBlocked || []).length) add(blockers, "unit_or_consumption_blocked", "Há consumo bloqueado por unidade, composição ou coeficiente.");
    if (!clean(premises.sinapiState) || !clean(premises.sinapiReferenceMonth)) add(missing, "sinapi_base", "Informe UF e mês da base SINAPI.");
    if (!premises.priceSource) add(blockers, "price_source", "Fonte de preço/custo oficial ausente.");
    if (premises.bdi === undefined || premises.bdi === null || premises.bdi === "") add(missing, "bdi", "Informe BDI se aplicável.");
    requiredToClose.push.apply(requiredToClose, blockers.concat(missing));
    const checks = 10;
    const failed = blockers.length + missing.length;
    const score = Math.max(0, Math.min(1, (checks - failed) / checks));
    return { ready: blockers.length === 0 && missing.length === 0, score: Number(score.toFixed(2)), blockers, missing, requiredToClose, executivePreview: buildExecutiveBudgetPreview(record, b).executivePreview };
  }

  function buildExecutiveBudgetPreview(projectRecord, budget) {
    const b = budget || {};
    const rows = (b.budgetTable && b.budgetTable.rows || []).map(function (row) { return { package: row.package, service: row.service, quantity: row.quantity, unit: row.unit, compositionCode: row.compositionCode, status: row.pending && row.pending.length ? "pending" : row.consumptionStatus }; });
    return { executivePreview: { rows, totals: null, bdi: projectRecord && projectRecord.premises && projectRecord.premises.bdi || null, schedule: [] }, blocked: rows.filter(function (r) { return r.status !== "ready"; }) };
  }


  function buildExecutiveClosingChecklist(projectRecord, budget) {
    const record = projectRecord || {};
    const project = record.project || {};
    const premises = record.premises || {};
    const b = budget || {};
    const selected = (record.compositionSelections || []).filter(function (c) { return c.selected === true; }).length;
    const pendingRows = b.budgetTable && b.budgetTable.summary && b.budgetTable.summary.pendingRows || 0;
    const checklist = [
      { id: "client", label: "Cliente/obra identificados", ok: !!(clean(record.client && record.client.name) || clean(project.name)), required: true },
      { id: "city_uf", label: "Cidade/UF informada", ok: !!clean(project.cityUf || (project.city && project.state)), required: true },
      { id: "base", label: "Base SINAPI carregada", ok: !!(b.baseStatus && b.baseStatus.loaded), required: true },
      { id: "scope", label: "Escopo fechado", ok: !(record.workPackages || []).some(function (p) { return p.status !== "ready"; }), required: true },
      { id: "quantities", label: "Quantidades completas", ok: pendingRows === 0, required: true },
      { id: "compositions", label: "Composições confirmadas", ok: selected > 0 && selected >= ((b.compositionMatches || []).filter(function (m) { return m.found; }).length || 1), required: true },
      { id: "prices", label: "Preços disponíveis", ok: !!premises.priceSource, required: true },
      { id: "bdi", label: "BDI definido ou dispensado", ok: premises.bdi !== undefined || premises.bdiExempt === true, required: true },
      { id: "revision", label: "Revisão atual registrada", ok: (record.revisions || []).length > 0, required: true },
      { id: "responsible", label: "Responsável técnico informado", ok: !!clean(record.responsible || premises.responsibleEngineer), required: false }
    ];
    const blockers = checklist.filter(function (item) { return item.required && !item.ok; }).map(function (item) { return { id: item.id, message: item.label + " pendente." }; });
    const nextActions = blockers.map(function (item) { return "Resolver: " + item.message; });
    return { canClose: blockers.length === 0, checklist: checklist, blockers: blockers, nextActions: nextActions };
  }


  function prepareExecutiveClosing(projectRecord, budget, options) {
    const record = projectRecord || {};
    const b = budget || {};
    const opts = options || {};
    const readiness = evaluateExecutiveReadiness(record, b);
    const checklistBase = buildExecutiveClosingChecklist(record, b);
    const priceStatus = b.priceStatus || {};
    const blockers = [].concat(readiness.blockers || [], checklistBase.blockers || []);
    const nextActions = [].concat(checklistBase.nextActions || []);
    const rows = b.budgetTable && b.budgetTable.rows || [];
    const selected = record.compositionSelections || [];
    const lockedRows = [];
    const priceRequirements = [];
    rows.forEach(function (row, index) {
      const rowId = row.rowId || row.id || "row_" + index;
      const hasQuantity = row.quantity !== undefined && row.quantity !== null && row.quantity !== "" && !(row.pending || []).length;
      const hasComposition = selected.some(function (item) { return item.selected === true && (item.serviceId === row.serviceId || item.service === row.service || item.code === row.compositionCode); });
      const hasPrice = !!((priceStatus.pricedRows || []).find(function (priced) { return (priced.rowId === rowId || priced.service === row.service) && priced.unitPrice != null; }));
      const unitCompatible = !/blocked|incompatible|pendente/i.test(String(row.consumptionStatus || ""));
      const ok = hasQuantity && hasComposition && hasPrice && unitCompatible;
      if (ok) lockedRows.push({ rowId: rowId, service: row.service, status: "lockable" });
      if (!hasPrice) priceRequirements.push({ rowId: rowId, service: row.service, reason: "price_missing" });
    });
    if ((b.compositionMatches || []).some(function (m) { return m.found && !selected.some(function (s) { return s.selected === true && s.serviceId === m.serviceId; }); })) add(blockers, "candidate_compositions", "Existem composi??es candidatas n?o confirmadas.");
    if (priceRequirements.length) add(blockers, "prices", "Existem linhas sem pre?o informado ou validado.");
    if (opts.requireBdi !== false && !(record.premises && (record.premises.bdi !== undefined || record.premises.bdiExempt === true))) add(blockers, "bdi", "BDI obrigat?rio ausente ou n?o dispensado.");
    const uniqueBlockers = [];
    blockers.forEach(function (item) { add(uniqueBlockers, item.id, item.message); });
    uniqueBlockers.forEach(function (item) { if (!nextActions.some(function (a) { return a.indexOf(item.message) >= 0; })) nextActions.push("Resolver: " + item.message); });
    const checks = Math.max(1, rows.length + checklistBase.checklist.length + 3);
    const failed = uniqueBlockers.length + priceRequirements.length;
    const score = Math.max(0, Math.min(1, (checks - failed) / checks));
    return { canClose: uniqueBlockers.length === 0 && priceRequirements.length === 0, score: Number(score.toFixed(2)), checklist: checklistBase.checklist, blockers: uniqueBlockers, nextActions: nextActions, lockedRows: lockedRows, priceRequirements: priceRequirements, bdiRequirement: { required: opts.requireBdi !== false, present: !!(record.premises && (record.premises.bdi !== undefined || record.premises.bdiExempt === true)) } };
  }

  function lockExecutiveRow(projectRecord, rowId, data) {
    const record = projectRecord || {};
    const payload = data || {};
    const checks = payload.checks || {};
    const ok = checks.quantityConfirmed && checks.compositionSelected && checks.priceValidated && checks.premisesConfirmed && checks.unitCompatible !== false;
    if (!ok) return Object.assign({}, record, { lockError: "row_checklist_not_ok", rowId: rowId });
    const r = JSON.parse(JSON.stringify(record));
    r.lockedRows = r.lockedRows || [];
    if (r.lockedRows.some(function (row) { return row.rowId === rowId; })) return Object.assign(r, { lockError: "row_already_locked", rowId: rowId });
    r.lockedRows.push(Object.assign({ rowId: rowId, lockedAt: new Date().toISOString(), status: "locked" }, payload));
    r.revisions = r.revisions || [];
    r.revisions.push({ number: r.revisions.length + 1, date: new Date().toISOString(), origin: "executive_lock", summary: "Linha executiva bloqueada: " + rowId });
    r.history = r.history || [];
    r.history.push({ at: new Date().toISOString(), type: "executive_row_locked", message: "Linha executiva bloqueada.", rowId: rowId });
    return r;
  }

  root.EloExecutiveBudgetEngine = { version: VERSION, evaluateExecutiveReadiness, buildExecutiveBudgetPreview, buildExecutiveClosingChecklist, prepareExecutiveClosing, lockExecutiveRow };
})(typeof window !== "undefined" ? window : globalThis);

