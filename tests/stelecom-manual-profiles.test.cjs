const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync("relatorio-stelecom/index.html", "utf8");
const app = readFileSync("relatorio-stelecom/app.js", "utf8");
const css = readFileSync("relatorio-stelecom/styles.css", "utf8");
const templateCode = readFileSync("relatorio-stelecom/stelecom-template.js", "utf8");

function loadTemplate() {
  const context = { console };
  vm.createContext(context);
  vm.runInContext(templateCode, context);
  return context.StelecomTemplate;
}

test("relatorio STELECOM oferece as cinco cidades urgentes e mantém cidade digitável", () => {
  assert.match(html, /data-visit-city/);
  assert.match(html, /list="stelecom-city-options"/);
  for (const city of ["Belo Campo", "Tremedal", "Ibirapuã", "Ibicoara", "Malhada de Pedras"]) {
    assert.match(html, new RegExp(city));
  }
});

test("UI cria tabela SIM/NAO com autosave local e perfis independentes por relatório", () => {
  assert.match(html, /data-checklist-profile/);
  assert.match(app, /stelecomMunicipalProfiles/);
  assert.match(app, /cityKey\(state\.city\)/);
  assert.match(app, /reportKey\(\)/);
  assert.match(app, /checklistAnswers/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(app, /Dados desta cidade salvos/);
  assert.match(app, /NÃO DEFINIDO/);
  assert.match(app, /data-answer="SIM"/);
  assert.match(app, /data-answer="NAO"/);
});

test("trocar cidade, SGTO/STELECOM e DT1B/PM1B preserva fotos e carrega apenas checklist", () => {
  assert.match(app, /nodes\.city\.addEventListener\("input"/);
  assert.match(app, /loadChecklistProfile\(\);\s*renderChecklist\(\);/);
  assert.match(app, /nodes\.reportType\.addEventListener\("change"/);
  assert.match(app, /state\.workType = template\.normalizeWorkType/);
  assert.doesNotMatch(app, /state\.cameras\s*=\s*\[\]/);
  assert.doesNotMatch(app, /state\.tomadas\s*=\s*\[\]/);
});

test("PDF usa exatamente SIM/NAO selecionado e não inventa resposta ausente", () => {
  const template = loadTemplate();
  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Belo Campo",
    workType: "DT1B",
    reportType: "STELECOM",
    checklistAnswers: { 1: "NAO", 2: "SIM" },
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "STELECOM");

  assert.match(report, /RELATORIO_STELECOM_BELO_CAMPO_DT1B_30-08-2026/);
  assert.match(report, /<td class="col-item">1<\/td>[\s\S]*?<td class="col-mark"><\/td>\s*<td class="col-mark">X<\/td>/);
  assert.match(report, /<td class="col-item">2<\/td>[\s\S]*?<td class="col-mark">X<\/td>\s*<td class="col-mark"><\/td>/);
  assert.match(report, /<td class="col-item">3<\/td>[\s\S]*?<td class="col-mark"><\/td>\s*<td class="col-mark"><\/td>/);
});

test("validação bloqueia PDF com campos obrigatórios não preenchidos", () => {
  assert.match(app, /missingChecklistItems\(\)/);
  assert.match(app, /Tabela incompleta/);
  assert.match(app, /Existem \$\{missing\.length\} campos da tabela ainda nao preenchidos/);
});

test("mobile usa cards e botões grandes, sem tabela horizontal para SIM/NAO", () => {
  assert.match(css, /\.checklist-answer-card/);
  assert.match(css, /\.choice-buttons/);
  assert.match(css, /\.choice-button/);
  assert.match(css, /min-height: 52px/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

function createAppContext(options = {}) {
  const template = loadTemplate();
  const node = () => ({
    value: "",
    dataset: {},
    textContent: "",
    innerHTML: "",
    addEventListener() {},
    setAttribute() {},
    focus() {},
    scrollIntoView() {},
    querySelectorAll() { return []; }
  });
  const nodes = new Map();
  const document = {
    querySelector(selector) {
      if (!nodes.has(selector)) nodes.set(selector, node());
      return nodes.get(selector);
    },
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: "",
            fillRect() {},
            drawImage() {}
          };
        },
        toBlob(callback, mimeType, quality) {
          callback({
            size: Math.max(1, Math.round(this.width * this.height * quality * 0.25)),
            type: mimeType
          });
        }
      };
    }
  };
  function URLMock(input, base) {
    return new URL(input, base);
  }
  URLMock.createObjectURL = () => "blob:optimized";
  URLMock.revokeObjectURL = () => {};
  const context = {
    console,
    document,
    localStorage: { getItem() { return null; }, setItem() {} },
    URL: URLMock,
    FileReader: options.FileReaderImpl || function FileReader() {},
    fetch: options.fetchImpl || (async () => ({ ok: false })),
    location: { href: "https://www.icaroamaral.com.br/relatorio-stelecom/" },
    createImageBitmap(file) {
      return Promise.resolve({
        width: file.width,
        height: file.height,
        close() {}
      });
    },
    window: { StelecomTemplate: template }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(app, context);
  return context.window.StelecomApp;
}

function imageFile({ width, height, size, type = "image/jpeg", name = "foto.jpg" }) {
  return { width, height, size, type, name };
}

test("otimizacao reduz fotos grandes sem alterar proporcao e gera JPEG para o PDF", async () => {
  const appContext = createAppContext();
  const settings = appContext.imageOptimizationSettings;
  assert.equal(settings.maxSide, 1400);
  assert.equal(settings.quality, 0.76);
  assert.equal(settings.mimeType, "image/jpeg");

  const horizontal = await appContext.optimizeReportImage(imageFile({ width: 4000, height: 2000, size: 6000000 }));
  assert.equal(horizontal.width, 1400);
  assert.equal(horizontal.height, 700);
  assert.equal(horizontal.mimeType, "image/jpeg");
  assert.ok(horizontal.optimizedBytes < horizontal.originalBytes);

  const vertical = await appContext.optimizeReportImage(imageFile({ width: 2000, height: 4000, size: 6000000 }));
  assert.equal(vertical.width, 700);
  assert.equal(vertical.height, 1400);

  const square = await appContext.optimizeReportImage(imageFile({ width: 3000, height: 3000, size: 7000000, type: "image/png" }));
  assert.equal(square.width, 1400);
  assert.equal(square.height, 1400);
  assert.equal(square.mimeType, "image/jpeg");
});

test("otimizacao nao amplia imagem menor e bloqueia arquivo invalido", async () => {
  const appContext = createAppContext();
  const small = await appContext.optimizeReportImage(imageFile({ width: 800, height: 600, size: 700000, type: "image/jpeg" }));
  assert.equal(small.width, 800);
  assert.equal(small.height, 600);
  assert.ok(small.optimizedBytes <= small.originalBytes);

  await assert.rejects(
    () => appContext.optimizeReportImage({ type: "application/pdf", size: 1000, name: "arquivo.pdf" }),
    /Arquivo invalido/
  );
});


test("empresa do cabeçalho é vinculada à cidade em STELECOM e SGTO", () => {
  const template = loadTemplate();
  const expected = [
    ["Malhada de Pedras", "EMKO ENGENHARIA"],
    ["Belo Campo", "GRADO ENGENHARIA"],
    ["Tremedal", "GRADO ENGENHARIA"],
    ["Ibicoara", "LAM ENGENHARIA"],
    ["Ibirapuã", "AS ENGENHARIA"]
  ];

  for (const [city, company] of expected) {
    assert.equal(template.getCompanyForCity(city), company);
    assert.equal(template.getCompanyForCity(city.toLocaleUpperCase("pt-BR")), company);

    for (const reportType of ["STELECOM", "SGTO"]) {
      for (const workType of ["DT1B", "PM1B"]) {
        const checklist = template.reportTypes[reportType].checklist;
        const report = template.buildStelecomReport({
          date: "30/08/2026",
          city,
          workType,
          reportType,
          checklistAnswers: Object.fromEntries(checklist.map((entry) => [String(entry.item), "SIM"])),
          legends: {},
          cameras: [],
          tomadas: [],
          rack: [],
          caixa: [],
          mastro: []
        }, reportType);

        assert.match(report, new RegExp(`OBRA ${workType} / ${company}`));
        assert.match(report, new RegExp(`CHECKLIST DE INSTALAÇÕES - REDE E CFTV - \\(${reportType}\\)`));
      }
    }
  }
});

test("cidade desconhecida não usa GRADO como fallback universal", () => {
  const template = loadTemplate();
  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Cidade Fora do Mapa",
    workType: "DT1B",
    reportType: "STELECOM",
    checklistAnswers: { 1: "SIM" },
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "STELECOM");

  assert.equal(template.getCompanyForCity("Cidade Fora do Mapa"), "");
  assert.match(report, /OBRA DT1B<\/th>/);
  assert.doesNotMatch(report, /OBRA DT1B \/ GRADO ENGENHARIA/);
});


test("checklist STELECOM e SGTO fica em tabela unica sem CONTINUACAO", () => {
  const template = loadTemplate();

  for (const reportType of ["STELECOM", "SGTO"]) {
    const checklist = template.reportTypes[reportType].checklist;
    const report = template.buildStelecomReport({
      date: "30/08/2026",
      city: "Ibicoara",
      workType: "DT1B",
      reportType,
      checklistAnswers: Object.fromEntries(checklist.map((entry) => [String(entry.item), "SIM"])),
      legends: {},
      cameras: [],
      tomadas: [],
      rack: [],
      caixa: [],
      mastro: []
    }, reportType);

    assert.equal((report.match(/class="report-page checklist-page"/g) || []).length, 1);
    assert.equal((report.match(/class="checklist-table"/g) || []).length, 1);
    assert.doesNotMatch(report, /CONTINUA[ÇC][ÃA]O/);
    assert.doesNotMatch(report, /pageBreaks/);
    assert.match(report, /DESCRIÇÃO DO CHECKLIST IBICOARA DT1B/);
    assert.match(report, /OBRA DT1B \/ LAM ENGENHARIA/);
    assert.match(report, /<td class="col-item">1<\/td>/);
    assert.match(report, new RegExp(`<td class="col-item">${checklist.length}<\\/td>`));
    assert.ok(report.indexOf('class="report-page checklist-page"') < report.indexOf('class="report-page photo-page"'));
  }
});

test("CSS do PDF centraliza cabeçalhos e mantém fotos em nova página", () => {
  const template = loadTemplate();
  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Ibicoara",
    workType: "PM1B",
    reportType: "SGTO",
    checklistAnswers: Object.fromEntries(template.sgtoChecklistItems.map((entry) => [String(entry.item), "SIM"])),
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "SGTO");

  assert.match(report, /\.report-page \+ \.report-page \{ break-before: page; page-break-before: always; \}/);
  assert.match(report, /\.checklist-table th \{[^}]*text-align: center;[^}]*vertical-align: middle;/);
  assert.match(report, /OBRA PM1B \/ LAM ENGENHARIA/);
  assert.match(report, /1 - REGISTRO FOTOGRÁFICO/);
});


test("logo WIA do PDF usa data URL segura quando fornecida no relatório", () => {
  const template = loadTemplate();
  const logoDataUrl = "data:image/png;base64,V0lB";
  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Ibicoara",
    workType: "DT1B",
    reportType: "STELECOM",
    logoUrl: logoDataUrl,
    checklistAnswers: Object.fromEntries(template.stelecomChecklistItems.map((entry) => [String(entry.item), "SIM"])),
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "STELECOM");

  const logoMatches = report.match(/<img class="wia-logo" src="data:image\/png;base64,V0lB"/g) || [];
  assert.equal(logoMatches.length, 6);
  assert.doesNotMatch(report, /<img class="wia-logo" src="\.\/assets\/wia-engenharia\.png"/);
  assert.match(report, /onerror="this\.style\.display='none'"/);
});

test("app carrega logo WIA como data URL antes do PDF", async () => {
  const appContext = createAppContext({
    fetchImpl: async (url) => ({
      ok: true,
      url,
      async blob() {
        return { type: "image/png", payload: "wia" };
      }
    }),
    FileReaderImpl: function FileReader() {
      this.readAsDataURL = (blob) => {
        assert.equal(blob.type, "image/png");
        this.result = "data:image/png;base64,V0lB";
        this.onload();
      };
    }
  });

  assert.equal(await appContext.loadReportLogoUrl(), "data:image/png;base64,V0lB");
});



test("app usa fallback data URL da logo WIA quando fetch local falha", async () => {
  const appContext = createAppContext({
    fetchImpl: async () => {
      throw new Error("file fetch blocked");
    }
  });

  const logoUrl = await appContext.loadReportLogoUrl();
  assert.match(logoUrl, /^data:image\/png;base64,/);
  assert.ok(logoUrl.length > 1000);
});

