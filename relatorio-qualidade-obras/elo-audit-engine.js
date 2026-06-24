(function (root) {
  "use strict";

  const VERSION = "20260624-elo-audit-engine-v1";

  function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  function normalize(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
  function number(value) { const parsed = Number(String(value || "").replace(",", ".")); return Number.isFinite(parsed) ? parsed : 0; }
  function round(value) { return Math.round(number(value) * 1000) / 1000; }
  function unit(value) { const text = normalize(value); if (/saco/.test(text)) return "sacos"; if (/kg|quilo/.test(text)) return "kg"; if (/m2|metro quadrado/.test(text)) return "m2"; if (/m3|metro cubico/.test(text)) return "m3"; if (/un|und|unidade/.test(text)) return "un"; return text; }

  function itemKey(value) { return normalize(value).replace(/cimento portland/g, "cimento").replace(/argamassa colante/g, "argamassa"); }

  function flattenPlanned(plannedConsumption) {
    const list = [];
    (plannedConsumption || []).forEach(function (consumption) {
      (consumption.inputs || []).forEach(function (input) {
        const conversion = input.conversion || {};
        if (conversion.available && conversion.unit) {
          list.push({ item: input.name, planned: number(conversion.totalConverted), unit: unit(conversion.unit), sourceUnit: input.unit, packageId: consumption.packageId, serviceId: consumption.serviceId });
        } else {
          list.push({ item: input.name, planned: number(input.total), unit: unit(input.unit), packageId: consumption.packageId, serviceId: consumption.serviceId });
        }
      });
    });
    return list;
  }

  function statusFor(diff, tolerance) {
    if (diff <= tolerance) return "ok";
    if (diff <= 25) return "attention";
    return "critical";
  }

  function auditConsumption(options) {
    const settings = options || {};
    const tolerance = number(settings.tolerancePercent || 10) || 10;
    const planned = flattenPlanned(settings.plannedConsumption || settings.consumptions || []);
    const withdrawals = settings.withdrawals || [];
    const alerts = [];
    const comparisons = [];
    const missing = [];
    if (!planned.length) return { status: "blocked", alerts: ["Não há consumo previsto para auditar."], comparisons: [], missing: [{ id: "planned_consumption", message: "plannedConsumption ausente." }] };
    if (!withdrawals.length) return { status: "blocked", alerts: ["Não há retiradas para comparar."], comparisons: [], missing: [{ id: "withdrawals", message: "withdrawals ausente." }] };
    withdrawals.forEach(function (withdrawal) {
      const wName = clean(withdrawal.item || withdrawal.name || withdrawal.material);
      const wUnit = unit(withdrawal.unit || withdrawal.unidade);
      const plannedItem = planned.find(function (item) { return itemKey(item.item).indexOf(itemKey(wName)) >= 0 || itemKey(wName).indexOf(itemKey(item.item)) >= 0; });
      if (!plannedItem) {
        comparisons.push({ item: wName, planned: 0, withdrawn: number(withdrawal.quantity), unit: wUnit, differencePercent: 100, status: "blocked" });
        alerts.push("Item retirado sem previsão: " + wName + ".");
        return;
      }
      if (plannedItem.unit !== wUnit) {
        comparisons.push({ item: wName, planned: plannedItem.planned, withdrawn: number(withdrawal.quantity), unit: wUnit, plannedUnit: plannedItem.unit, differencePercent: 0, status: "blocked" });
        alerts.push("Unidade incompatível para " + wName + ": previsto em " + plannedItem.unit + ", retirado em " + wUnit + ".");
        return;
      }
      const withdrawn = number(withdrawal.quantity);
      const diff = plannedItem.planned > 0 ? Math.abs(withdrawn - plannedItem.planned) / plannedItem.planned * 100 : 100;
      const status = statusFor(diff, tolerance);
      if (status !== "ok") alerts.push(wName + " com diferença de " + round(diff) + "%.");
      comparisons.push({ item: wName, planned: round(plannedItem.planned), withdrawn: round(withdrawn), unit: wUnit, differencePercent: round(diff), status: status });
    });
    const worst = comparisons.some(function (item) { return item.status === "blocked"; }) ? "blocked" : comparisons.some(function (item) { return item.status === "critical"; }) ? "critical" : comparisons.some(function (item) { return item.status === "attention"; }) ? "attention" : "ok";
    if (!(settings.executedQuantities || []).length) missing.push({ id: "executed_quantities", message: "Auditoria parcial: retirada informada sem produção executada." });
    return { status: worst, alerts: alerts, comparisons: comparisons, missing: missing };
  }

  root.EloAuditEngine = { version: VERSION, auditConsumption: auditConsumption };
})(typeof window !== "undefined" ? window : globalThis);
