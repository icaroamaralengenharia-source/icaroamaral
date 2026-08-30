(function (root) {
  const stelecomChecklistItems = [
    { item: 1, service: "TOMADA ELETRICA NAO PREVISTA EM PROJETO PARA INSTALACAO DO RADIO NA SALA DE ATENDIMENTO ( BASE FIXA)", type: "RADIO", done: false },
    { item: 2, service: "ELETRODUTO 1\" PARA PASSAGEM DO CABO RF", type: "RADIO", done: true },
    { item: 3, service: "SUPORTE PARA MASTRO 1 1/4\"", type: "RADIO", done: true },
    { item: 4, service: "MASTRO 1 1/4 DE 4 METROS INSTALADO NA COBERTURA", type: "RADIO", done: true },
    { item: 5, service: "REDE DE ENTRADA - COM PONTALETE E ELETRODUTO 1 1/2\"", type: "TELEFONIA", done: true },
    { item: 6, service: "CAIXA DE DISTRIBUICAO TAMANHO MINIMO DE 40CMX40CM C/ FUNDO DE MADEIRA INSTALADA NA ALTURA PADRAO DE 1,20M", type: "TELEFONIA", done: true },
    { item: 7, service: "BLOCO DE DISTRIBUICAO COOK - M10", type: "TELEFONIA", done: true },
    { item: 8, service: "TUBULACAO DA ENTRADA SUBTERRANEA 1 1/2'' COM CAIXA DE PASSAGEM", type: "TELEFONIA", done: true },
    { item: 9, service: "INSTALACAO DE PATCH PANEL CAT 5E NO RACK DA SALA TECNICA", type: "TELEFONIA", done: true },
    { item: 10, service: "CABO DE ENTRADA - CTP/APL CAT 5 DE 10 PARES DEVIDAMENTE INSTALADO E COM TESTE DE CONTINUIDADE REALIZADO ENTRE BLOCO M10 X PATCH PANEL CAT 5E", type: "TELEFONIA", done: true },
    { item: 11, service: "PONTO DE CONCENTRACAO DOS CABOS DE ENTRADA E DISTRIBUICAO NA SALA TECNICA DEVIDAMENTE CONECTADO, ANILHADO, IDENTIFICADO E ORGANIZADO COM VELCRO", type: "TELEFONIA", done: true },
    { item: 12, service: "REDE INTERNA PROJETADA COM CABOS UTP CAT 6 DEVIDAMENTE DISTRIBUIDOS", type: "TELEFONIA", done: true },
    { item: 13, service: "SALAS PREVISTAS EM PROJETO COM CONECTORES (MACHO E FEMEA) RJ45 CAT6 NOS PONTOS DE VOZ", type: "TELEFONIA", done: true }
  ];

  const sgtoChecklistItems = [
    { item: 1, service: "FORNECER E INFORMAR A TENSÃO (110V OU 220V)", type: "REDE / CFTV", done: true, observation: "380/220" },
    { item: 2, service: "RACK DEVIDAMENTE ENERGIZADO, EQUIPADO COM BANDEJA E 2 PATCH PANEL'S CAT 6 CONFORME PROJETADO", type: "REDE / CFTV", done: true },
    { item: 3, service: "REDE DE ENTRADA - COM PONTALETE E ELETRODUTO 1 1/2\"", type: "REDE / CFTV", done: true },
    { item: 4, service: "TUBULAÇÃO DA ENTRADA SUBTERRÂNEA 1 1/2'' COM CAIXA DE PASSAGEM", type: "REDE / CFTV", done: true },
    { item: 5, service: "NO CASO DE CONJUGADA, ELETRODUTO DE 1 1/2'' COM CABO FTP CAT6 INTERLIGADA ENTRE OS RACKS DAS UNIDADES", type: "REDE / CFTV", done: true },
    { item: 6, service: "CABEAMENTO ESTRUTURADO CONFORME PROJETO ORGANIZADO COM VELCRO (CABO UTP CAT6)", type: "REDE / CFTV", done: true },
    { item: 7, service: "CABOS DEVEM ESTA ANILHADOS, CRIMPADOS E CONECTADOS NAS PORTAS ESPECIFICADAS", type: "REDE / CFTV", done: true },
    { item: 8, service: "SALAS PREVISTAS EM PROJETO COM CONECTORES (MACHO E FEMEA) RJ45 CAT6 NOS PONTOS DE REDE / CFTV", type: "REDE / CFTV", done: true },
    { item: 9, service: "IDENTIFICAÇÃO DOS PONTOS DE REDE NO PAINEL DE DISTRIBUIÇÃO (PATCH PANEL) E NOS PONTOS DE REDE DAS SALAS PROJETADAS", type: "REDE / CFTV", done: true, observation: "Padrão de clipagem e padrão de identificação rack - patch panel - porta. Ex: R01 - PP02 - 24, Rack 01, patch panel 02, porta 24." },
    { item: 10, service: "CÂMERAS (POE) FIXADAS, INSTALADAS/CONECTADAS E POSICIONADAS CONFORME PROJETO", type: "REDE / CFTV", done: true },
    { item: 11, service: "IDENTIFICAÇÃO DO CABEAMENTO DAS CÂMERAS NO PAINEL DE DISTRIBUIÇÃO E PROXIMO AOS CONECTORES DAS CAMERAS", type: "REDE / CFTV", done: true },
    { item: 12, service: "PONTOS DE CONEXAO EXTERNA DAS CAMERAS COM CAIXAS HERMÉTICAS 4X2 DE SOBREPOR FIXADAS CONFORME LOCAÇÃO PROJETADA", type: "REDE / CFTV", done: true },
    { item: 13, service: "CERTIFICAÇÃO DOS PONTOS DE REDE", type: "REDE / CFTV", done: true },
    { item: 14, service: "CLIMATIZAÇÃO DA SALA TÉCNICA", type: "REDE / CFTV", done: true },
    { item: 15, service: "ELABORAÇÃO DE LEGENDA COM DESCRIÇÃO DOS PONTOS / AMBIENTE PARA POSSIBILITAR IDENTIFICAÇÃO EM CASO DE DESVIO", type: "REDE / CFTV", done: true }
  ];

  const reportTypes = {
    STELECOM: { label: "STELECOM", checklist: stelecomChecklistItems, pageBreaks: [12] },
    SGTO: { label: "SGTO", checklist: sgtoChecklistItems, pageBreaks: [8] }
  };

  const companyByCity = {
    "malhada-de-pedras": "EMKO ENGENHARIA",
    "belo-campo": "GRADO ENGENHARIA",
    "tremedal": "GRADO ENGENHARIA",
    "ibicoara": "LAM ENGENHARIA",
    "ibirapua": "AS ENGENHARIA"
  };

  const categories = [
    { id: "cameras", label: "CAMERAS", reportLabel: "CAMERAS", defaultLegend: "Fotos: Ponto de camera interna e externa, conectadas, identificadas." },
    { id: "tomadas", label: "TOMADAS", reportLabel: "TOMADAS", defaultLegend: "Tomadas instaladas e identificadas." },
    { id: "rack", label: "RACK", reportLabel: "RACK", defaultLegend: "Foto: Rack sem identificacao e instalacao nao foi concluida." },
    { id: "caixa", label: "CAIXA COM FUNDO DE MADEIRA", reportLabel: "CAIXA COM FUNDO DE MADEIRA", defaultLegend: "Foto: Caixa 40 x 40 com fundo de madeira, bloco de distribuicao e identificacao correta." },
    { id: "mastro", label: "MASTRO / ANTENA", reportLabel: "MASTRO / ANTENA", defaultLegend: "Foto: Mastro para antena de radio e antena de radio" }
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normalizeDate(value) {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return digits.slice(0, 2) + "/" + digits.slice(2);
    return digits.slice(0, 2) + "/" + digits.slice(2, 4) + "/" + digits.slice(4);
  }

  function isValidDate(value) {
    return /^\d{2}\/\d{2}\/\d{4}$/.test(String(value || ""));
  }

  function dateForFilename(value) {
    return normalizeDate(value).replace(/\//g, "-");
  }

  function normalizeWorkType(value) {
    return String(value || "DT1B").toUpperCase() === "PM1B" ? "PM1B" : "DT1B";
  }

  function normalizeReportType(value) {
    return String(value || "STELECOM").toUpperCase() === "SGTO" ? "SGTO" : "STELECOM";
  }

  function normalizeCity(value) {
    return String(value || "Tremedal").trim() || "Tremedal";
  }

  function cityCompanyKey(value) {
    return normalizeCity(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function getCompanyForCity(city) {
    return companyByCity[cityCompanyKey(city)] || "";
  }

  function cityForHeader(value) {
    return normalizeCity(value).toLocaleUpperCase("pt-BR");
  }

  function cityForFilename(value) {
    return normalizeCity(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "CIDADE";
  }

  function buildFilename(visit, reportType) {
    const city = cityForFilename(visit?.city);
    const workType = normalizeWorkType(visit?.workType);
    const type = normalizeReportType(reportType || visit?.reportType);
    return "RELATORIO_" + type + "_" + city + "_" + workType + "_" + dateForFilename(visit?.date || "") + ".pdf";
  }

  function chunk(list, size) {
    const chunks = [];
    for (let index = 0; index < list.length; index += size) chunks.push(list.slice(index, index + size));
    return chunks;
  }

  function getPhotoReportUnitLabel(workType) {
    return normalizeWorkType(workType) === "PM1B" ? "Pelotão PM 1B" : "PC DT 1B";
  }

  function reportLogo() {
    const logoUrl = root.location ? new URL("./assets/wia-engenharia.png", root.location.href).href : "./assets/wia-engenharia.png";
    return `<img class="wia-logo" src="${escapeHtml(logoUrl)}" alt="WIA Engenharia">`;
  }

  function checklistAnswerFor(visit, entry) {
    const answers = visit && visit.checklistAnswers ? visit.checklistAnswers : {};
    const answer = String(answers[String(entry.item)] || "").toUpperCase();
    if (answer === "SIM" || answer === "NAO") return answer;
    if (answer === "NÃO") return "NAO";
    return "";
  }
  function buildChecklistPage(items, visit, pageIndex, reportType) {
    const date = visit.date;
    const workType = normalizeWorkType(visit.workType);
    const city = cityForHeader(visit.city);
    const company = getCompanyForCity(visit.city);
    const obraLabel = company ? "OBRA " + workType + " / " + company : "OBRA " + workType;
    const descriptionLabel = `DESCRIÇÃO DO CHECKLIST ${city} ${workType}`;
    const type = normalizeReportType(reportType);
    const rows = items.map((entry) => {
      const answer = checklistAnswerFor(visit, entry);
      return `
      <tr>
        <td class="col-item">${entry.item}</td>
        <td class="col-service">${escapeHtml(entry.service)}</td>
        <td class="col-type">${escapeHtml(entry.type)}</td>
        <td class="col-date">${escapeHtml(date)}</td>
        <td class="col-mark">${answer === "SIM" ? "X" : ""}</td>
        <td class="col-mark">${answer === "NAO" ? "X" : ""}</td>
        <td class="col-observation">${escapeHtml(entry.observation || "")}</td>
      </tr>`;
    }).join("");

    const subtitle = pageIndex === 0
      ? `<tr class="meta-row"><th colspan="4">${escapeHtml(descriptionLabel)}</th><th colspan="2">FOI REALIZADO?</th><th></th></tr>`
      : `<tr class="meta-row"><th colspan="7">CONTINUAÇÃO - ${escapeHtml(descriptionLabel)}</th></tr>`;

    return `
      <section class="report-page checklist-page">
        <header class="report-header">
          ${reportLogo()}
        </header>
        <table class="checklist-table">
          <thead>
            <tr class="title-row"><th colspan="7">CHECKLIST DE INSTALAÇÕES - REDE E CFTV - (${escapeHtml(type)})</th></tr>
            <tr class="work-row"><th colspan="7">${escapeHtml(obraLabel)}</th></tr>
            ${subtitle}
            <tr class="columns-row">
              <th class="col-item">ITEM</th>
              <th class="col-service">SERVIÇO</th>
              <th class="col-type">TIPO</th>
              <th class="col-date">DATA</th>
              <th class="col-mark">SIM</th>
              <th class="col-mark">NÃO</th>
              <th class="col-observation">OBSERVAÇÃO</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
  }

  function buildPhotoPages(visit) {
    const pages = [];
    let isFirstPhotoPage = true;
    for (const category of categories) {
      const photos = visit[category.id] || [];
      const groups = chunk(photos, 4);
      if (!groups.length) groups.push([]);

      groups.forEach((group, index) => {
        const showPhotoHeader = isFirstPhotoPage;
        const isLastMastroPage = category.id === "mastro" && index === groups.length - 1;
        const cells = Array.from({ length: 4 }, (_, cellIndex) => {
          const photo = group[cellIndex];
          return `<td class="photo-cell">${photo ? `<img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.name)}">` : ""}</td>`;
        });
        const legend = visit.legends[category.id] || category.defaultLegend;
        pages.push(`
          <section class="report-page photo-page">
            <header class="report-header photo-report-header">
              ${reportLogo()}
            </header>
            ${showPhotoHeader ? `
              <table class="photo-heading-table">
                <tr><th>1 - REGISTRO FOTOGRÁFICO</th></tr>
                <tr><th>${escapeHtml(getPhotoReportUnitLabel(visit.workType))}</th></tr>
              </table>` : ""}
            <table class="photo-table">
              <tbody>
                <tr>${cells[0]}${cells[1]}</tr>
                <tr>${cells[2]}${cells[3]}</tr>
                <tr><td class="photo-legend" colspan="2">${escapeHtml(legend)}</td></tr>
              </tbody>
            </table>
            ${isLastMastroPage ? `<div class="visit-date-block">DATA DA VISITA ${escapeHtml(visit.date)}</div>` : ""}
          </section>`);
        isFirstPhotoPage = false;
      });
    }
    return pages.join("");
  }

  function fallbackReportCss() {
    return `
      @page checklist { size: A4 landscape; margin: 0; }
      @page photos { size: A4 portrait; margin: 0; }
      * { box-sizing: border-box; }
      body { margin: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
      .report-root { --report-header-height: 23mm; --report-logo-width: 48mm; --checklist-font-size: 8.8px; --checklist-heading-font-size: 10px; color: #000; font-family: Arial, Helvetica, sans-serif; font-size: 10px; }
      .report-page { background: #fff; overflow: hidden; }
      .report-page + .report-page { break-before: page; page-break-before: always; }
      .report-header { height: var(--report-header-height); display: flex; align-items: flex-start; justify-content: flex-start; overflow: hidden; }
      .wia-logo { display: block; width: var(--report-logo-width); height: auto; object-fit: contain; }
      .checklist-page { page: checklist; width: 297mm; min-height: 210mm; padding: 8mm 9mm; }
      .checklist-table { width: 100%; margin-top: 2mm; border-collapse: collapse; table-layout: fixed; }
      .checklist-table th, .checklist-table td { border: 1px solid #000; vertical-align: middle; }
      .checklist-table th { font-size: var(--checklist-heading-font-size); font-weight: 700; text-align: center; }
      .checklist-table td { font-size: var(--checklist-font-size); font-weight: 700; line-height: 1.15; padding: 2px 4px; }
      .title-row th { height: 7.6mm; font-size: 12px; }
      .work-row th { height: 6.8mm; font-size: 11px; }
      .meta-row th { height: 6.8mm; background: #fff; }
      .columns-row th { height: 7mm; background: #e6e6e6; }
      .col-item { width: 10mm; text-align: center; }
      .col-service { width: 162mm; }
      .col-type { width: 30mm; text-align: center; }
      .col-date { width: 28mm; text-align: center; }
      .col-mark { width: 9mm; text-align: center; }
      .col-observation { width: 28mm; }
      .photo-page { page: photos; width: 210mm; min-height: 297mm; padding: 15mm 14mm 16mm; }
      .photo-report-header { height: var(--report-header-height); }
      .photo-heading-table { width: 100%; margin-top: 2mm; border-collapse: collapse; table-layout: fixed; }
      .photo-heading-table th { height: 9mm; border: 1px solid #000; background: #d9d9d9; font-size: 12px; font-weight: 700; text-align: center; }
      .photo-table { width: 100%; margin-top: 5mm; border-collapse: collapse; table-layout: fixed; }
      .photo-cell { width: 50%; height: 82mm; border: 1px solid #000; padding: 0.8mm; text-align: center; vertical-align: middle; }
      .photo-cell img { display: block; width: 96%; height: 96%; max-width: 96%; max-height: 96%; margin: auto; object-fit: contain; }
      .photo-legend { height: 12mm; border: 1px solid #000; padding: 2mm 3mm; font-size: 11.2px; font-weight: 700; text-align: left; vertical-align: middle; }
      .visit-date-block { margin-top: 26mm; font-size: 11px; font-weight: 700; text-align: center; }
    `;
  }

  function collectRuntimeCss() {
    if (!root.document || !root.document.styleSheets) return "";
    let css = "";
    for (const sheet of Array.from(root.document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules || [])) css += rule.cssText + "\n";
      } catch (error) {
        // Ignore stylesheets the browser will not expose.
      }
    }
    return css;
  }
  function buildChecklistPages(visit, reportType) {
    const type = normalizeReportType(reportType);
    const config = reportTypes[type];
    const pages = [];
    let start = 0;
    for (const end of config.pageBreaks) {
      pages.push(buildChecklistPage(config.checklist.slice(start, end), visit, pages.length, type));
      start = end;
    }
    pages.push(buildChecklistPage(config.checklist.slice(start), visit, pages.length, type));
    return pages.join("");
  }

  function buildStelecomReport(visit, reportType) {
    const type = normalizeReportType(reportType || visit?.reportType);
    const safeVisit = {
      date: normalizeDate(visit?.date || ""),
      city: normalizeCity(visit?.city),
      workType: normalizeWorkType(visit?.workType),
      reportType: type,
      checklistAnswers: visit?.checklistAnswers || {},
      legends: visit?.legends || {},
      cameras: visit?.cameras || [],
      tomadas: visit?.tomadas || [],
      rack: visit?.rack || [],
      caixa: visit?.caixa || [],
      mastro: visit?.mastro || []
    };

    const checklistPages = buildChecklistPages(safeVisit, type);

    return `
      <!doctype html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(buildFilename(safeVisit, type))}</title>
        <style>${fallbackReportCss()}</style>
      </head>
      <body>
        <main class="report-root">
          ${checklistPages}
          ${buildPhotoPages(safeVisit)}
        </main>
      </body>
      </html>`;
  }

  root.StelecomTemplate = {
    checklistItems: stelecomChecklistItems,
    stelecomChecklistItems,
    sgtoChecklistItems,
    reportTypes,
    companyByCity,
    getCompanyForCity,
    categories,
    normalizeDate,
    normalizeWorkType,
    normalizeReportType,
    normalizeCity,
    cityForFilename,
    isValidDate,
    buildFilename,
    checklistAnswerFor,
    buildStelecomReport
  };
})(typeof window !== "undefined" ? window : globalThis);

