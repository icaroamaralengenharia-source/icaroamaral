import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "@playwright/test";

const STATUS_LABELS = {
  C: "Conforme",
  NC: "Nao Conforme",
  NA: "Nao Aplicavel",
  NV: "Nao Verificado",
  NI: "Nao Inspecionado"
};

const STATUS_ORDER = ["C", "NC", "NA", "NV", "NI"];

function clean(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value).trim() || fallback;
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeStatus(value) {
  const raw = clean(value, "NI").toUpperCase();
  if (["CONFORME", "OK", "APROVADO"].includes(raw)) return "C";
  if (["NAO CONFORME", "NÃO CONFORME", "INCONFORME"].includes(raw)) return "NC";
  if (["NAO APLICAVEL", "NÃO APLICÁVEL", "N/A"].includes(raw)) return "NA";
  if (["NAO VERIFICADO", "NÃO VERIFICADO"].includes(raw)) return "NV";
  if (["NAO INSPECIONADO", "NÃO INSPECIONADO"].includes(raw)) return "NI";
  return STATUS_ORDER.includes(raw) ? raw : "NI";
}

function photoSrc(photo) {
  const source = photo && (photo.foto || photo.image || photo);
  if (!source) return "";
  if (typeof source === "string") return source.startsWith("data:") ? source : "";
  if (source.dataUrl) return source.dataUrl;
  if (source.url && /^data:/i.test(source.url)) return source.url;
  if (source.base64) return `data:${clean(source.mimeType, "image/jpeg")};base64,${source.base64}`;
  if (source.buffer) {
    const buffer = Buffer.isBuffer(source.buffer) ? source.buffer : Buffer.from(source.buffer);
    return `data:${clean(source.mimeType, "image/jpeg")};base64,${buffer.toString("base64")}`;
  }
  return "";
}

function normalizePhotos(item) {
  return []
    .concat(item && Array.isArray(item.fotos) ? item.fotos : [])
    .concat(item && item.foto ? [{ foto: item.foto, legenda: item.legenda || item.descricao }] : [])
    .map((photo, index) => ({
      number: photo.numero || index + 1,
      caption: clean(photo.legenda || photo.descricao || `Foto ${index + 1}`),
      src: photoSrc(photo)
    }))
    .filter((photo) => photo.src);
}

function normalizeMeasurements(item) {
  return []
    .concat(item && Array.isArray(item.medicoes) ? item.medicoes : [])
    .map((measurement) => ({
      ambiente: clean(measurement.ambiente || item.ambiente, "-"),
      item: clean(measurement.item || item.item, "-"),
      grandeza: clean(measurement.grandeza || measurement.tipo || measurement.nome, "-"),
      valor: clean(measurement.valor || measurement.resultado, "-"),
      unidade: clean(measurement.unidade, ""),
      instrumento: clean(measurement.instrumento || measurement.instrument || measurement.instrumentId, "Nao informado"),
      referencia: clean(measurement.referencia || measurement.criterio || item.criterioAceitacao, "-"),
      acceptanceDecisionBasis: measurement.acceptanceDecisionBasis === true
    }));
}

function normalizeInstrument(instrument) {
  return {
    type: clean(instrument.type || instrument.tipo || instrument.nome || instrument.instrumento || instrument.name || instrument.descricao, "Instrumento nao informado"),
    brand: clean(instrument.brand || instrument.marca, ""),
    model: clean(instrument.model || instrument.modelo, ""),
    identification: clean(instrument.identification || instrument.identificacao || instrument.id || instrument.numeroSerie, "Nao informado"),
    serialNumber: clean(instrument.serialNumber || instrument.numeroSerie || instrument.serie, ""),
    calibrationStatus: clean(instrument.calibrationStatus || instrument.statusCalibracao, ""),
    calibrationDate: clean(instrument.calibrationDate || instrument.dataCalibracao, ""),
    calibrationDueDate: clean(instrument.calibrationDueDate || instrument.validadeCalibracao || instrument.validade || instrument.calibracao, "Nao informado"),
    verificationDate: clean(instrument.verificationDate || instrument.dataVerificacao, ""),
    notes: clean(instrument.notes || instrument.observacoes, "")
  };
}

export function normalizeApartmentHandoverInspectionPayload(payload) {
  const report = payload && payload.report ? payload.report : payload || {};
  const inspection = report.inspection || {};
  const items = (inspection.items || report.items || []).map((item, index) => {
    const status = normalizeStatus(item.status);
    return {
      number: Number(item.numero || item.number || index + 1),
      ambiente: clean(item.ambiente, "Ambiente nao informado"),
      sistema: clean(item.sistema, "Sistema nao informado"),
      item: clean(item.item || item.descricao, "Item nao informado"),
      criterio: clean(item.criterioAceitacao || item.criterio, "Nao informado"),
      status,
      statusLabel: STATUS_LABELS[status],
      severidade: clean(item.severidade || item.grauRisco, "-"),
      descricaoTecnica: clean(item.descricaoTecnica || item.descricao || item.observacoes, "-"),
      recomendacaoAcao: clean(item.recomendacaoAcao || item.solucaoRecomendada, "-"),
      situacao: clean(item.situacao || item.statusCorrecao || item.correctionStatus, "Pendente"),
      professionalOpinion: clean(item.professionalOpinion || ""),
      completionCriticality: clean(item.completionCriticality || item.criticality || "normal"),
      photoRequired: item.photoRequired === true,
      observacoes: clean(item.observacoes, ""),
      fotos: normalizePhotos(item),
      medicoes: normalizeMeasurements(item)
    };
  });

  const counts = STATUS_ORDER.reduce((acc, status) => Object.assign(acc, { [status]: 0 }), {});
  for (const item of items) counts[item.status] += 1;
  const inspected = counts.C + counts.NC + counts.NA + counts.NV;
  const percent = items.length ? Math.round((inspected / items.length) * 1000) / 10 : 0;
  const nonConformities = items.filter((item) => item.status === "NC");
  const notVerified = items.filter((item) => item.status === "NV" || item.status === "NI");
  const measurements = items.flatMap((item) => item.medicoes);
  const instruments = []
    .concat(Array.isArray(inspection.instrumentos) ? inspection.instrumentos : [])
    .map(normalizeInstrument);

  return {
    report,
    inspection,
    isDraft: inspection.finalizada === false || clean(inspection.status).toLowerCase() === "draft",
    documentStatus: inspection.finalizada === false || clean(inspection.status).toLowerCase() === "draft" ? "RASCUNHO - NAO FINALIZADO" : "DOCUMENTO FINAL",
    title: "LAUDO DE VISTORIA DE ENTREGA",
    empreendimento: clean(report.empreendimento || report.obra, "Nao informado"),
    construtora: clean(report.construtora || report.nomeEmpresa, "Nao informado"),
    bloco: clean(report.bloco, "Nao informado"),
    unidade: clean(report.unidade, "Nao informado"),
    endereco: clean(report.endereco || report.local, "Nao informado"),
    cliente: clean(report.cliente || report.proprietario, "Nao informado"),
    responsavelTecnico: clean(report.responsavelTecnico, "Nao informado"),
    creaCau: clean(report.creaCau || report.registroProfissional, "Nao informado"),
    artRrt: clean(report.artRrt, "Nao informado"),
    professionalOpinion: clean(report.professionalOpinion || inspection.professionalOpinion || ""),
    dataVistoria: clean(report.dataVistoria || payload.submittedAt, "Nao informado"),
    items,
    counts,
    percent,
    nonConformities,
    notVerified,
    measurements,
    instruments
  };
}

function rows(items) {
  return items.map((item) => `<tr>
    <td>${item.number}</td>
    <td>${escapeHtml(item.ambiente)}</td>
    <td>${escapeHtml(item.sistema)}</td>
    <td>${escapeHtml(item.item)}</td>
    <td>${escapeHtml(item.criterio)}</td>
    <td><span class="status status-${item.status}">${escapeHtml(item.statusLabel)}</span></td>
  </tr>`).join("");
}

function environmentSummary(items) {
  const grouped = new Map();
  for (const item of items) {
    if (!grouped.has(item.ambiente)) grouped.set(item.ambiente, { total: 0, C: 0, NC: 0, NA: 0, NV: 0, NI: 0 });
    const group = grouped.get(item.ambiente);
    group.total += 1;
    group[item.status] += 1;
  }
  return Array.from(grouped.entries()).map(([ambiente, count]) => `<tr>
    <td>${escapeHtml(ambiente)}</td><td>${count.total}</td><td>${count.C}</td><td>${count.NC}</td><td>${count.NA}</td><td>${count.NV}</td><td>${count.NI}</td>
  </tr>`).join("");
}

function photoFigures(nc) {
  return nc.fotos.map((photo) => `<figure>
    <img src="${escapeHtml(photo.src)}" alt="${escapeHtml(photo.caption)}">
    <figcaption>${escapeHtml(nc.ambiente)} - ${escapeHtml(photo.caption)}</figcaption>
  </figure>`).join("");
}

function correctionPlan(data) {
  if (!data.nonConformities.length) return "<p>Nao aplicavel.</p>";
  return `<table class="comfortable"><thead><tr><th>NC</th><th>Ambiente</th><th>Severidade</th><th>Recomendacao</th><th>Situacao</th></tr></thead><tbody>${data.nonConformities.map((nc, index) => `<tr><td>NC-${String(index + 1).padStart(3, "0")}</td><td>${escapeHtml(nc.ambiente)}</td><td>${escapeHtml(nc.severidade)}</td><td>${escapeHtml(nc.recomendacaoAcao)}</td><td>${escapeHtml(nc.situacao)}</td></tr>`).join("")}</tbody></table>`;
}

function pluralizePt(count, singular, plural) {
  return Number(count) === 1 ? singular : plural;
}

export function buildPendingItemsConclusionSentence(counts) {
  const nv = Number(counts && counts.NV) || 0;
  const ni = Number(counts && counts.NI) || 0;
  const total = nv + ni;
  if (!total) return "";
  const parts = [];
  if (nv) parts.push(`${nv} ${pluralizePt(nv, "item Nao Verificado", "itens Nao Verificados")}`);
  if (ni) parts.push(`${ni} ${pluralizePt(ni, "item Nao Inspecionado", "itens Nao Inspecionados")}`);
  const verb = total === 1 ? "Permanece" : "Permanecem";
  const reviewVerb = total === 1 ? "deve" : "devem";
  return `${verb} ${parts.join(" e ")}, que ${reviewVerb} ser revisado${total === 1 ? "" : "s"} pelo responsavel tecnico antes do encerramento definitivo.`;
}

function conclusion(data) {
  const parts = [`Com base nos itens efetivamente inspecionados e nas verificacoes registradas nesta vistoria, foram analisados ${data.items.length} itens, com ${data.counts.C} conformes e ${data.counts.NC} nao conformes.`];
  if (data.counts.NC) parts.push(`As ${data.counts.NC} nao conformidades devem ser tratadas conforme o plano de correcoes registrado neste documento.`);
  const pendingSentence = buildPendingItemsConclusionSentence(data.counts);
  if (pendingSentence) parts.push(pendingSentence);
  if (data.professionalOpinion) parts.push(`Parecer profissional informado: ${data.professionalOpinion}.`);
  return parts.join(" ");
}

export function buildApartmentHandoverInspectionHtml(payload, options = {}) {
  const data = normalizeApartmentHandoverInspectionPayload(payload);
  const draft = data.isDraft ? `<div class="draft">RASCUNHO - NAO FINALIZADO</div>` : `<div class="final-badge">DOCUMENTO FINAL</div>`;
  const countCards = STATUS_ORDER.map((status) => `<div class="metric metric-${status}"><strong>${data.counts[status]}</strong><span>${STATUS_LABELS[status]}</span></div>`).join("");
  const ncBlocks = data.nonConformities.map((nc, index) => `<section class="section nc-block ${index ? "break-before" : ""}">
    <h2>NAO CONFORMIDADE NC-${String(index + 1).padStart(3, "0")}</h2>
    <div class="grid two">
      <p><strong>Ambiente:</strong> ${escapeHtml(nc.ambiente)}</p>
      <p><strong>Sistema:</strong> ${escapeHtml(nc.sistema)}</p>
      <p><strong>Severidade:</strong> ${escapeHtml(nc.severidade)}</p>
      <p><strong>Item:</strong> ${escapeHtml(nc.item)}</p>
    </div>
    <p><strong>Descricao tecnica:</strong> ${escapeHtml(nc.descricaoTecnica)}</p>
    <p><strong>Recomendacao:</strong> ${escapeHtml(nc.recomendacaoAcao)}</p>
    <div class="photos">${photoFigures(nc)}</div>
  </section>`).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${escapeHtml(data.title)} - ${escapeHtml(data.unidade)}</title>
<style>
  @page { size: A4; margin: 16mm 13mm 19mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #1b2433; font-family: Arial, Helvetica, sans-serif; font-size: 11px; line-height: 1.48; }
  h1, h2, h3 { margin: 0; color: #101827; letter-spacing: 0; }
  h1 { font-size: 28px; line-height: 1.1; text-transform: uppercase; }
  h2 { font-size: 15px; margin-bottom: 9px; padding-bottom: 6px; border-bottom: 1px solid #b9c4d2; text-transform: uppercase; }
  h3 { font-size: 12.5px; margin: 10px 0 5px; }
  p { margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  tr { page-break-inside: avoid; }
  th, td { border: 1px solid #ccd4df; padding: 6px 7px; vertical-align: top; }
  th { background: #e9eef5; font-size: 9.5px; text-transform: uppercase; }
  .cover { min-height: 249mm; display: flex; flex-direction: column; justify-content: space-between; padding: 7mm 0; }
  .brand { border-left: 6px solid #26364d; padding-left: 14px; max-width: 180mm; }
  .subtitle { margin-top: 10px; font-size: 14px; color: #42526a; }
  .draft { margin: 22px 0; padding: 13px; border: 2px solid #8a1f1f; color: #8a1f1f; font-weight: 700; text-align: center; font-size: 18px; }
  .final-badge { display: inline-block; margin-top: 22px; padding: 7px 11px; border: 1px solid #91a0b5; color: #344256; font-weight: 700; font-size: 11px; text-transform: uppercase; }
  .cover-highlight { margin: 28px 0; padding: 14px 0; border-top: 1px solid #cfd7e3; border-bottom: 1px solid #cfd7e3; }
  .cover-highlight strong { display: block; font-size: 18px; margin-top: 3px; }
  .cover-meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px 17px; border-top: 1px solid #cfd7e3; padding-top: 15px; }
  .section { page-break-inside: avoid; margin: 0 0 14px; }
  .break-before { break-before: page; page-break-before: always; }
  .grid { display: grid; gap: 6px 12px; }
  .two { grid-template-columns: repeat(2, 1fr); }
  .metrics { display: grid; grid-template-columns: 1.05fr repeat(4, 1fr) 1.2fr; gap: 8px; margin: 9px 0 12px; }
  .metric { border: 1px solid #cbd5e1; padding: 9px; min-height: 49px; }
  .metric strong { display: block; font-size: 19px; }
  .metric span { display: block; font-size: 9.2px; text-transform: uppercase; color: #4a5568; }
  .metric-NI span { font-size: 8.8px; line-height: 1.15; }
  .status { display: inline-block; min-width: 72px; padding: 3px 6px; border-radius: 2px; text-align: center; font-weight: 700; font-size: 8.8px; }
  .status-C { background: #e7f5ec; color: #155b34; }
  .status-NC { background: #fdeaea; color: #8a1f1f; }
  .status-NA { background: #eef2f7; color: #334155; }
  .status-NV, .status-NI { background: #fff6d8; color: #775600; }
  .photos { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 9px; margin: 9px auto 0; justify-items: center; }
  figure { width: 100%; max-width: 82mm; margin: 0 auto; border: 1px solid #d2d9e4; padding: 6px; page-break-inside: avoid; text-align: center; }
  figure img { display: block; width: 100%; max-width: 100%; height: 90px; margin-left: auto; margin-right: auto; object-fit: contain; background: #f6f8fb; }
  figcaption { width: 100%; margin: 5px auto 0; font-size: 9.2px; color: #4b5563; text-align: center; overflow-wrap: anywhere; }
  .checklist { font-size: 9.6px; }
  .checklist th, .checklist td { padding: 4px 5px; }
  .final-section { font-size: 11px; line-height: 1.55; }
  .final-section h2 { font-size: 15px; margin-top: 4px; }
  .comfortable th, .comfortable td { font-size: 10px; padding: 7px; }
  .conclusion-box { border: 1px solid #b9c4d2; padding: 12px; margin-top: 8px; background: #fbfcfe; }
  .signature { margin-top: 25mm; width: 360px; border-top: 1.5px solid #111827; padding-top: 10px; font-size: 11px; line-height: 1.6; }
  .footer-note { margin-top: 14px; font-size: 9px; color: #667085; }
</style>
</head>
<body>
  <section class="cover">
    <div>
      <div class="brand">
        <h1>${escapeHtml(data.title)}</h1>
        <div class="subtitle">Vistoria de entrega de unidade autonoma</div>
      </div>
      ${draft}
      <div class="cover-highlight">
        <span>Empreendimento</span><strong>${escapeHtml(data.empreendimento)}</strong>
        <span>Unidade</span><strong>${escapeHtml(data.unidade)}</strong>
      </div>
    </div>
    <div class="cover-meta">
      <p><strong>Construtora:</strong> ${escapeHtml(data.construtora)}</p>
      <p><strong>Bloco/Torre:</strong> ${escapeHtml(data.bloco)}</p>
      <p><strong>Endereco:</strong> ${escapeHtml(data.endereco)}</p>
      <p><strong>Data:</strong> ${escapeHtml(data.dataVistoria)}</p>
      <p><strong>Responsavel tecnico:</strong> ${escapeHtml(data.responsavelTecnico)}</p>
      <p><strong>ART / RRT:</strong> ${escapeHtml(data.artRrt)}</p>
    </div>
  </section>

  <section class="section break-before"><h2>Identificacao</h2><div class="grid two">
    <p><strong>Cliente/proprietario:</strong> ${escapeHtml(data.cliente)}</p><p><strong>Registro profissional:</strong> ${escapeHtml(data.creaCau)}</p>
    <p><strong>Local vistoriado:</strong> ${escapeHtml(data.endereco)}</p><p><strong>Tipo:</strong> ${escapeHtml(data.inspection.tipo || "Vistoria de entrega")}</p>
  </div></section>
  <section class="section"><h2>Objeto</h2><p>Este laudo registra as condicoes verificadas na unidade indicada, com foco em entrega, acabamento, funcionamento aparente dos sistemas e pendencias observadas no ato da vistoria.</p></section>
  <section class="section"><h2>Metodologia</h2><p>A vistoria foi realizada por verificacao visual, conferencia funcional simples quando aplicavel, registro de evidencias fotograficas e classificacao dos itens conforme legenda tecnica.</p></section>
  <section class="section"><h2>Legenda</h2><p><strong>C:</strong> Conforme. <strong>NC:</strong> Nao Conforme. <strong>NA:</strong> Nao Aplicavel. <strong>NV:</strong> Nao Verificado. <strong>NI:</strong> Nao Inspecionado.</p></section>
  <section class="section"><h2>Resumo executivo</h2><div class="metrics"><div class="metric"><strong>${data.items.length}</strong><span>Total de itens</span></div>${countCards}</div><p><strong>Percentual vistoriado:</strong> ${data.percent.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</p></section>
  <section class="section"><h2>Resumo por ambiente</h2><table><thead><tr><th>Ambiente</th><th>Total</th><th>C</th><th>NC</th><th>NA</th><th>NV</th><th>NI</th></tr></thead><tbody>${environmentSummary(data.items)}</tbody></table></section>
  <section class="section break-before"><h2>Checklist completo</h2><table class="checklist"><thead><tr><th>No.</th><th>Ambiente</th><th>Sistema</th><th>Item</th><th>Criterio</th><th>Status</th></tr></thead><tbody>${rows(data.items)}</tbody></table></section>
  <section class="section break-before"><h2>Nao conformidades</h2>${ncBlocks || "<p>Nenhuma nao conformidade registrada.</p>"}</section>
  <section class="section break-before final-section"><h2>Fotografias</h2><p>As fotografias vinculadas as nao conformidades estao apresentadas junto de cada registro, preservando proporcao e legenda.</p></section>
  <section class="section final-section"><h2>Medicoes e verificacoes</h2>${data.measurements.length ? `<table class="comfortable"><thead><tr><th>Ambiente</th><th>Item</th><th>Grandeza</th><th>Valor</th><th>Instrumento</th><th>Referencia</th></tr></thead><tbody>${data.measurements.map((m) => `<tr><td>${escapeHtml(m.ambiente)}</td><td>${escapeHtml(m.item)}</td><td>${escapeHtml(m.grandeza)}</td><td>${escapeHtml(m.valor)} ${escapeHtml(m.unidade)}</td><td>${escapeHtml(m.instrumento)}</td><td>${escapeHtml(m.referencia)}</td></tr>`).join("")}</tbody></table>` : "<p>Nenhuma medicao informada.</p>"}</section>
  <section class="section final-section"><h2>Instrumentos</h2>${data.instruments.length ? `<table class="comfortable"><thead><tr><th>Tipo</th><th>Identificacao</th><th>Marca/modelo</th><th>Calibracao/verificacao</th></tr></thead><tbody>${data.instruments.map((i) => `<tr><td>${escapeHtml(i.type)}</td><td>${escapeHtml(i.identification)}</td><td>${escapeHtml([i.brand, i.model].filter(Boolean).join(" / ") || "Nao informado")}</td><td>${escapeHtml([i.calibrationStatus, i.calibrationDate, i.calibrationDueDate, i.verificationDate].filter(Boolean).join(" / ") || "Nao informado")}</td></tr>`).join("")}</tbody></table>` : "<p>Nenhum instrumento informado.</p>"}</section>
  <section class="section final-section"><h2>NV / NI</h2>${data.notVerified.length ? `<table class="comfortable"><thead><tr><th>No.</th><th>Ambiente</th><th>Item</th><th>Status</th></tr></thead><tbody>${data.notVerified.map((i) => `<tr><td>${i.number}</td><td>${escapeHtml(i.ambiente)}</td><td>${escapeHtml(i.item)}</td><td>${escapeHtml(i.statusLabel)}</td></tr>`).join("")}</tbody></table>` : "<p>Nao ha itens nao verificados ou nao inspecionados.</p>"}</section>
  <section class="section final-section"><h2>Plano de correcoes</h2>${correctionPlan(data)}</section>
  <section class="section final-section break-before"><h2>Conclusao</h2><div class="conclusion-box">${escapeHtml(conclusion(data))}</div></section>
  <section class="section final-section"><h2>Re-vistoria</h2><p>Recomenda-se re-vistoria apos a execucao das correcoes, com novo registro fotografico e baixa formal das pendencias.</p></section>
  <section class="section final-section"><h2>Responsabilidade tecnica</h2><p>Responsavel: ${escapeHtml(data.responsavelTecnico)}. Registro: ${escapeHtml(data.creaCau)}. ART / RRT: ${escapeHtml(data.artRrt)}.</p><div class="signature">Assinatura<br>${escapeHtml(data.responsavelTecnico)}<br>${escapeHtml(data.creaCau)}<br>ART / RRT: ${escapeHtml(data.artRrt)}</div><p class="footer-note">Documento gerado localmente pelo motor independente de vistoria de entrega do ObraReport.</p></section>
</body>
</html>`;
}

function footerTemplate(data) {
  return `<div style="font-family: Arial, Helvetica, sans-serif; font-size: 9.2px; color: #526070; width: 100%; padding: 0 13mm; display: flex; justify-content: space-between; box-sizing: border-box;"><span>ObraReport</span><span>${escapeHtml(data.empreendimento)} - Unidade ${escapeHtml(data.unidade)}</span><span>Pagina <span class="pageNumber"></span> de <span class="totalPages"></span></span></div>`;
}

export async function generateApartmentHandoverInspectionPdf(payload, outputPath, options = {}) {
  const data = normalizeApartmentHandoverInspectionPayload(payload);
  let review = options.review || null;
  const finalRequested = options.mode === "final" || options.final === true;
  if (finalRequested) {
    if (!review) {
      const module = await import("./apartment-handover-review.js");
      review = module.reviewApartmentHandoverInspection(payload, options.reviewOptions || {});
    }
    if (review && review.canGenerateFinal === false) {
      return { ok: false, code: "INSPECTION_PREFLIGHT_BLOCKED", review };
    }
  }
  const html = buildApartmentHandoverInspectionHtml(payload, { ...options, review });
  await mkdir(dirname(outputPath), { recursive: true });
  if (options.htmlPath) await writeFile(options.htmlPath, html, "utf8");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.setContent(html, { waitUntil: "load" });
    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(data)
    });
    await page.close();
  } finally {
    await browser.close();
  }
  return { ok: true, html, normalized: data, outputPath, review };
}
