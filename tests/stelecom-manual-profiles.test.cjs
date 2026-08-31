const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const vm = require("node:vm");

const html = readFileSync("relatorio-stelecom/index.html", "utf8");
const app = readFileSync("relatorio-stelecom/app.js", "utf8");
const css = readFileSync("relatorio-stelecom/styles.css", "utf8");
const templateCode = readFileSync("relatorio-stelecom/stelecom-template.js", "utf8");
let objectUrlSequence = 0;

function createFakeIndexedDB(options = {}) {
  const records = new Map();
  const database = {
    objectStoreNames: { contains: () => records.__created === true },
    createObjectStore() {
      records.__created = true;
      return { indexNames: { contains: () => false }, createIndex() {} };
    },
    transaction(storeName, mode) {
      const transaction = { mode, error: null, oncomplete: null, onabort: null, onerror: null };
      const complete = () => setImmediate(() => {
        if (transaction.error) {
          if (transaction.onerror) transaction.onerror();
          if (transaction.onabort) transaction.onabort();
          return;
        }
        if (transaction.oncomplete) transaction.oncomplete();
      });
      transaction.objectStore = () => ({
        getAll() {
          const request = { result: null, error: null, onsuccess: null, onerror: null };
          setImmediate(() => {
            request.result = Array.from(records.values()).filter((record) => record && record.id);
            if (request.onsuccess) request.onsuccess();
            complete();
          });
          return request;
        },
        put(record) {
          if (options.failPut) {
            transaction.error = Object.assign(new Error("quota"), { name: "QuotaExceededError" });
            complete();
            return;
          }
          records.set(record.id, structuredClone(record));
          complete();
        },
        delete(id) {
          records.delete(id);
          complete();
        },
        indexNames: { contains: () => true },
        createIndex() {}
      });
      return transaction;
    }
  };

  return {
    records,
    open() {
      const request = { result: database, transaction: null, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null };
      request.transaction = { objectStore: () => ({ indexNames: { contains: () => true }, createIndex() {} }) };
      setImmediate(() => {
        if (!records.__created && request.onupgradeneeded) request.onupgradeneeded();
        if (request.onsuccess) request.onsuccess();
      });
      return request;
    }
  };
}
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

test("trocar cidade, SGTO/STELECOM e DT1B/PM1B troca contexto de fotos e carrega checklist", () => {
  assert.match(app, /nodes\.city\.addEventListener\("input"/);
  assert.match(app, /loadChecklistProfile\(\);\s*renderChecklist\(\);\s*switchPhotoContext\(\);/);
  assert.match(app, /nodes\.reportType\.addEventListener\("change"/);
  assert.match(app, /state\.workType = template\.normalizeWorkType/);
  assert.match(app, /photoStateCache/);
  assert.match(app, /activePhotoProfileKey/);
  assert.match(app, /switchPhotoContext\(\)/);
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
    listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
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
  const urlState = { created: [], revoked: [] };
  URLMock.createObjectURL = (blob) => {
    const value = `blob:optimized-${++objectUrlSequence}`;
    urlState.created.push({ value, blob });
    return value;
  };
  URLMock.revokeObjectURL = (value) => urlState.revoked.push(value);
  const storage = options.localStorageStore || new Map();
  const context = {
    console,
    document,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    URL: URLMock,
    FileReader: options.FileReaderImpl || function FileReader() {},
    fetch: options.fetchImpl || (async () => ({ ok: false })),
    indexedDB: options.indexedDB,
    location: { href: "https://www.icaroamaral.com.br/relatorio-stelecom/" },
    createImageBitmap: options.createImageBitmapImpl || ((file) => Promise.resolve({
      width: file.width,
      height: file.height,
      close() {}
    })),
    window: { StelecomTemplate: template, confirm: options.confirmImpl || (() => true), open: options.openImpl }
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(app, context);
  context.window.StelecomApp.__nodes = nodes;
  context.window.StelecomApp.__urlState = urlState;
  return context.window.StelecomApp;
}

function setAppContext(appContext, { city = "Tremedal", reportType = "STELECOM", workType = "DT1B" } = {}) {
  const cityNode = appContext.__nodes.get("[data-visit-city]");
  const reportNode = appContext.__nodes.get("[data-report-type]");
  const workNode = appContext.__nodes.get("[data-work-type]");
  cityNode.value = city;
  cityNode.listeners.input();
  reportNode.value = reportType;
  reportNode.listeners.change();
  workNode.value = workType;
  workNode.listeners.change();
}

function answersFor(appContext, template, reportType) {
  const answers = appContext.getState().checklistAnswers;
  return template.reportTypes[reportType].checklist.map((entry) => answers[String(entry.item)] || "");
}

function allAnswersAre(appContext, template, reportType, answer) {
  return answersFor(appContext, template, reportType).every((value) => value === answer);
}

function imageFile({ width, height, size, type = "image/jpeg", name = "foto.jpg" }) {
  return { width, height, size, type, name };
}

async function addReady(appContext, categoryId, files) {
  await appContext.addFiles(categoryId, files);
  await appContext.waitForPhotoOptimizationsForCurrentReport();
}

function photoCounts(appContext) {
  const state = appContext.getState();
  return Object.fromEntries(["cameras", "tomadas", "rack", "caixa", "mastro"].map((group) => [group, state[group].length]));
}

function dbRecords(indexedDB) {
  return Array.from(indexedDB.records.values()).filter((record) => record && record.id);
}

function dbCounts(indexedDB, profileKey) {
  return Object.fromEntries(["cameras", "tomadas", "rack", "caixa", "mastro"].map((group) => [
    group,
    dbRecords(indexedDB).filter((record) => record.profileKey === profileKey && record.group === group).length
  ]));
}
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function tick() {
  return new Promise((resolve) => setImmediate(resolve));
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

test("acoes em lote adicionam e limpam fotos por grupo sem misturar categorias", async () => {
  let confirms = 0;
  const appContext = createAppContext({
    confirmImpl(message) {
      confirms += 1;
      assert.match(message, /Remover todas as fotos de CAMERAS\?/);
      return true;
    }
  });
  const photo = imageFile({ width: 900, height: 600, size: 500000, name: "grupo.jpg" });

  await addReady(appContext, "cameras", [photo, photo]);
  await addReady(appContext, "tomadas", [photo]);
  assert.equal(appContext.getState().cameras.length, 2);
  assert.equal(appContext.getState().tomadas.length, 1);

  assert.equal(await appContext.clearPhotoGroup("cameras"), true);
  assert.equal(confirms, 1);
  assert.equal(appContext.getState().cameras.length, 0);
  assert.equal(appContext.getState().tomadas.length, 1);
});

test("acoes em lote cobrem todos os grupos reais de fotografia", async () => {
  const appContext = createAppContext();
  const template = loadTemplate();
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "auditoria.jpg" });

  for (const category of template.categories) {
    await addReady(appContext, category.id, [photo]);
    assert.equal(appContext.getState()[category.id].length, 1, `${category.label} deveria receber foto`);
    assert.equal(await appContext.clearPhotoGroup(category.id), true, `${category.label} deveria limpar fotos`);
    assert.equal(appContext.getState()[category.id].length, 0, `${category.label} deveria ficar vazio`);
  }
});

test("cancelar limpeza mantem fotos e grupo vazio nao pede confirmacao", async () => {
  let confirms = 0;
  const appContext = createAppContext({
    confirmImpl() {
      confirms += 1;
      return false;
    }
  });
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "cancelar.jpg" });

  await addReady(appContext, "rack", [photo]);
  assert.equal(await appContext.clearPhotoGroup("rack"), false);
  assert.equal(appContext.getState().rack.length, 1);
  assert.equal(confirms, 1);

  assert.equal(await appContext.clearPhotoGroup("caixa"), false);
  assert.equal(appContext.getState().caixa.length, 0);
  assert.equal(confirms, 1);
});

test("UI mostra adicionar fotos e limpar por grupo, mas controles nao aparecem no PDF", () => {
  const template = loadTemplate();
  assert.match(app, /class="photo-section-actions"/);
  assert.match(app, /data-clear-photos="\$\{category\.id\}"/);
  assert.match(app, /multiple data-file-input="\$\{category\.id\}"/);
  assert.match(css, /\.photo-section-actions/);
  assert.match(css, /\.clear-photos-button/);

  const report = template.buildStelecomReport({
    date: "30/08/2026",
    city: "Ibicoara",
    workType: "DT1B",
    reportType: "STELECOM",
    checklistAnswers: Object.fromEntries(template.stelecomChecklistItems.map((entry) => [String(entry.item), "SIM"])),
    legends: {},
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  }, "STELECOM");

  assert.doesNotMatch(report, /ADICIONAR FOTOS|LIMPAR|data-clear-photos|photo-section-actions/);
});


test("IndexedDB salva, restaura apos reload e recria ObjectURL em ordem", async () => {
  const indexedDB = createFakeIndexedDB();
  const photo = imageFile({ width: 900, height: 600, size: 500000, name: "persistida.jpg" });
  const firstLoad = createAppContext({ indexedDB });
  await firstLoad.loadStoredPhotosForCurrentContext();

  await addReady(firstLoad, "cameras", [photo, photo]);
  await addReady(firstLoad, "tomadas", [photo]);
  const originalIds = firstLoad.getState().cameras.map((item) => item.id);
  assert.equal(firstLoad.getState().cameras.length, 2);
  assert.equal(firstLoad.getState().tomadas.length, 1);
  assert.equal(indexedDB.records.size, 3);

  const secondLoad = createAppContext({ indexedDB });
  await secondLoad.loadStoredPhotosForCurrentContext();
  assert.deepEqual(Array.from(secondLoad.getState().cameras.map((item) => item.id)), Array.from(originalIds));
  assert.equal(secondLoad.getState().tomadas.length, 1);
  assert.notEqual(secondLoad.getState().cameras[0].url, firstLoad.getState().cameras[0].url);
  assert.equal(secondLoad.getState().cameras[0].file.type, "image/jpeg");
});

test("IndexedDB isola cidade, relatorio, tipo de obra e grupo", async () => {
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({ indexedDB });
  await appContext.loadStoredPhotosForCurrentContext();
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "isolada.jpg" });
  const cityNode = appContext.__nodes.get("[data-visit-city]");
  const reportNode = appContext.__nodes.get("[data-report-type]");
  const workNode = appContext.__nodes.get("[data-work-type]");

  cityNode.value = "Ibicoara";
  cityNode.listeners.input();
  reportNode.value = "SGTO";
  reportNode.listeners.change();
  workNode.value = "DT1B";
  workNode.listeners.change();
  await appContext.loadStoredPhotosForCurrentContext();
  await addReady(appContext, "cameras", [photo]);
  await addReady(appContext, "tomadas", [photo]);
  assert.equal(appContext.getState().cameras.length, 1);
  assert.equal(appContext.getState().tomadas.length, 1);

  cityNode.value = "Tremedal";
  cityNode.listeners.input();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 0);
  cityNode.value = "Ibicoara";
  cityNode.listeners.input();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 1);

  reportNode.value = "STELECOM";
  reportNode.listeners.change();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 0);
  reportNode.value = "SGTO";
  reportNode.listeners.change();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 1);

  workNode.value = "PM1B";
  workNode.listeners.change();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 0);
  workNode.value = "DT1B";
  workNode.listeners.change();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().cameras.length, 1);
  assert.equal(appContext.getState().tomadas.length, 1);
});

test("remover uma foto e limpar grupo removem apenas os registros certos", async () => {
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({ indexedDB });
  await appContext.loadStoredPhotosForCurrentContext();
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "limpeza.jpg" });

  await addReady(appContext, "cameras", [photo, photo]);
  await addReady(appContext, "tomadas", [photo]);
  const removedUrl = appContext.getState().cameras[0].url;
  const cameraId = appContext.getState().cameras[0].id;
  appContext.removePhoto("cameras", cameraId);
  await appContext.persistPhotoGroup("cameras");
  assert.equal(appContext.getState().cameras.length, 1);
  assert.ok(appContext.__urlState.revoked.includes(removedUrl));

  const reloadAfterRemove = createAppContext({ indexedDB });
  await reloadAfterRemove.loadStoredPhotosForCurrentContext();
  assert.equal(reloadAfterRemove.getState().cameras.length, 1);
  assert.equal(reloadAfterRemove.getState().tomadas.length, 1);

  assert.equal(await reloadAfterRemove.clearPhotoGroup("cameras"), true);
  const reloadAfterClear = createAppContext({ indexedDB });
  await reloadAfterClear.loadStoredPhotosForCurrentContext();
  assert.equal(reloadAfterClear.getState().cameras.length, 0);
  assert.equal(reloadAfterClear.getState().tomadas.length, 1);
});

test("quota do IndexedDB mostra aviso controlado e mantem foto em sessao", async () => {
  const indexedDB = createFakeIndexedDB({ failPut: true });
  const appContext = createAppContext({ indexedDB });
  await appContext.loadStoredPhotosForCurrentContext();
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "quota.jpg" });

  assert.equal(appContext.photoStorageErrorMessage({ name: "QuotaExceededError" }), "Armazenamento do navegador cheio. Remova fotos antigas ou conclua os relatórios.");
  await addReady(appContext, "mastro", [photo]);
  assert.equal(appContext.getState().mastro.length, 1);
  assert.equal(appContext.__nodes.get("[data-status-detail]").textContent, "Armazenamento do navegador cheio. Remova fotos antigas ou conclua os relatórios.");
});

test("PDF usa fotos restauradas do IndexedDB sem depender do File original", async () => {
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({ indexedDB });
  await appContext.loadStoredPhotosForCurrentContext();
  const photo = imageFile({ width: 640, height: 480, size: 120000, name: "pdf.jpg" });
  await addReady(appContext, "rack", [photo]);

  const reload = createAppContext({ indexedDB });
  await reload.loadStoredPhotosForCurrentContext();
  const template = loadTemplate();
  const report = template.buildStelecomReport(Object.assign(reload.getState(), {
    date: "30/08/2026",
    checklistAnswers: Object.fromEntries(template.stelecomChecklistItems.map((entry) => [String(entry.item), "SIM"]))
  }), "STELECOM");

  assert.match(report, /blob:optimized-/);
  assert.match(report, /RACK/);
});
test("upload mostra preview antes da otimização assíncrona e persiste apenas foto pronta", async () => {
  const gate = deferred();
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }))
  });
  await appContext.loadStoredPhotosForCurrentContext();
  const photo = imageFile({ width: 2200, height: 1200, size: 2800000, name: "preview.jpg" });

  await appContext.addFiles("cameras", [photo]);
  const item = appContext.getState().cameras[0];
  assert.equal(item.status, "optimizing");
  assert.equal(item.optimizedForReport, false);
  assert.equal(item.file, null);
  const previewUrl = item.url;
  assert.match(previewUrl, /blob:optimized-/);
  assert.equal(indexedDB.records.size, 0);
  assert.match(appContext.__nodes.get("[data-category-panels]").innerHTML, /Otimizando\.\.\.|Na fila/);

  gate.resolve();
  await appContext.waitForPhotoOptimizationsForCurrentReport();
  assert.equal(appContext.getState().cameras[0].status, "ready");
  assert.equal(appContext.getState().cameras[0].optimizedForReport, true);
  assert.equal(indexedDB.records.size, 1);
  assert.ok(appContext.__urlState.revoked.includes(previewUrl));
});

test("fila de fotos respeita concorrência 2 e drena itens pendentes", async () => {
  const gates = [];
  let active = 0;
  let maxActive = 0;
  const appContext = createAppContext({
    createImageBitmapImpl: (file) => {
      const gate = deferred();
      gates.push({ gate, file });
      active += 1;
      maxActive = Math.max(maxActive, active);
      return gate.promise.then(() => ({ width: file.width, height: file.height, close() {} })).finally(() => {
        active -= 1;
      });
    }
  });
  const files = Array.from({ length: 5 }, (_, index) => imageFile({ width: 1600, height: 900, size: 1000000, name: `fila-${index}.jpg` }));

  await appContext.addFiles("cameras", files);
  assert.equal(appContext.getPhotoOptimizationStats().limit, 2);
  assert.equal(appContext.getPhotoOptimizationStats().active, 2);
  assert.equal(appContext.getPhotoOptimizationStats().queued, 3);

  for (let index = 0; index < files.length; index += 1) {
    while (!gates.length) await tick();
    const current = gates.shift();
    current.gate.resolve();
    await tick();
  }
  await appContext.waitForPhotoOptimizationsForCurrentReport();
  assert.ok(maxActive <= 2);
  assert.equal(appContext.getPhotoOptimizationStats().pending, 0);
  assert.equal(appContext.getState().cameras.filter((photo) => photo.status === "ready").length, 5);
});

test("remover ou limpar invalida otimização atrasada sem regravar fotos", async () => {
  const gates = [];
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => {
      const gate = deferred();
      gates.push({ gate, file });
      return gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }));
    }
  });
  await appContext.loadStoredPhotosForCurrentContext();

  await appContext.addFiles("cameras", [imageFile({ width: 900, height: 600, size: 500000, name: "remove.jpg" })]);
  const removedUrl = appContext.getState().cameras[0].url;
  appContext.removePhoto("cameras", appContext.getState().cameras[0].id);
  gates.shift().gate.resolve();
  await tick();
  assert.equal(appContext.getState().cameras.length, 0);
  assert.equal(indexedDB.records.size, 0);
  assert.ok(appContext.__urlState.revoked.includes(removedUrl));

  await appContext.addFiles("tomadas", [imageFile({ width: 900, height: 600, size: 500000, name: "clear.jpg" })]);
  assert.equal(await appContext.clearPhotoGroup("tomadas"), true);
  gates.shift().gate.resolve();
  await tick();
  assert.equal(appContext.getState().tomadas.length, 0);
  assert.equal(indexedDB.records.size, 0);
});

test("troca de cidade preserva otimização atrasada no contexto original sem misturar", async () => {
  const gate = deferred();
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }))
  });
  await appContext.loadStoredPhotosForCurrentContext();
  await appContext.addFiles("rack", [imageFile({ width: 900, height: 600, size: 500000, name: "cidade.jpg" })]);
  const originalProfile = appContext.photoProfileKey();

  const cityNode = appContext.__nodes.get("[data-visit-city]");
  cityNode.value = "Ibicoara";
  cityNode.listeners.input();
  assert.equal(appContext.getState().rack.length, 0);
  gate.resolve();
  await tick();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().rack.length, 0);
  assert.deepEqual(dbCounts(indexedDB, originalProfile), { cameras: 0, tomadas: 0, rack: 1, caixa: 0, mastro: 0 });

  cityNode.value = "Tremedal";
  cityNode.listeners.input();
  await appContext.loadStoredPhotosForCurrentContext();
  assert.equal(appContext.getState().rack.length, 1);
  assert.equal(appContext.getState().rack[0].status, "ready");
});

test("falha de otimização fica isolada e IndexedDB salva somente fotos ready", async () => {
  const indexedDB = createFakeIndexedDB();
  let calls = 0;
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("imagem quebrada"));
      return Promise.resolve({ width: file.width, height: file.height, close() {} });
    }
  });
  await appContext.loadStoredPhotosForCurrentContext();
  await appContext.addFiles("caixa", [
    imageFile({ width: 900, height: 600, size: 500000, name: "erro.jpg" }),
    imageFile({ width: 900, height: 600, size: 500000, name: "ok.jpg" })
  ]);
  await appContext.waitForPhotoOptimizationsForCurrentReport();

  assert.equal(appContext.getPhotoOptimizationStats().errors, 1);
  assert.equal(appContext.getState().caixa.filter((photo) => photo.status === "ready").length, 1);
  assert.equal(indexedDB.records.size, 1);
  assert.match(appContext.__nodes.get("[data-category-panels]").innerHTML, /Falha na otimização/);
});

test("gerar PDF aguarda otimização pendente e usa somente blob otimizado", async () => {
  const gate = deferred();
  let written = "";
  const reportWindow = {
    document: {
      images: [],
      title: "",
      open() {},
      write(html) { written = html; },
      close() {}
    },
    close() {},
    focus() {},
    print() {}
  };
  const appContext = createAppContext({
    openImpl: () => reportWindow,
    createImageBitmapImpl: (file) => gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }))
  });
  const template = loadTemplate();
  const dateNode = appContext.__nodes.get("[data-visit-date]");
  dateNode.value = "30/08/2026";
  dateNode.listeners.input();
  appContext.setChecklistBulkAnswer("SIM");
  await appContext.addFiles("mastro", [imageFile({ width: 1600, height: 900, size: 1500000, name: "pdf-pendente.jpg" })]);

  const pdfPromise = appContext.generatePdf();
  await tick();
  assert.equal(appContext.__nodes.get("[data-generate-pdf]").disabled, true);
  assert.match(appContext.__nodes.get("[data-status-detail]").textContent, /Finalizando otimização de 1 fotos/);
  gate.resolve();
  await pdfPromise;

  assert.match(written, /blob:optimized-/);
  assert.match(written, /REGISTRO FOTOGRÁFICO/);
  assert.equal(appContext.getState().mastro[0].originalFile, null);
  assert.equal(appContext.getState().mastro[0].optimizedForReport, true);
  assert.equal(template.sgtoChecklistItems.length, 15);
});
test("troca SGTO/STELECOM preserva fotos pendentes e restaura conjunto completo", async () => {
  const gates = [];
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => {
      const gate = deferred();
      gates.push({ gate, file });
      return gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }));
    }
  });
  await appContext.loadStoredPhotosForCurrentContext();
  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  await appContext.addFiles("cameras", Array.from({ length: 5 }, (_, index) => imageFile({ width: 1600, height: 900, size: 1500000, name: `camera-${index}.jpg` })));
  await appContext.addFiles("tomadas", Array.from({ length: 5 }, (_, index) => imageFile({ width: 1600, height: 900, size: 1500000, name: `tomada-${index}.jpg` })));
  await appContext.addFiles("rack", [imageFile({ width: 900, height: 600, size: 500000, name: "rack.jpg" })]);
  await appContext.addFiles("caixa", [imageFile({ width: 900, height: 600, size: 500000, name: "caixa.jpg" })]);
  await appContext.addFiles("mastro", [imageFile({ width: 900, height: 600, size: 500000, name: "mastro.jpg" })]);

  const sgtoProfile = appContext.photoProfileKey();
  const beforeIds = appContext.getState().cameras.map((photo) => photo.id);
  assert.deepEqual(photoCounts(appContext), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  assert.equal(appContext.getPhotoOptimizationStats().pending, 13);

  setAppContext(appContext, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  assert.deepEqual(photoCounts(appContext), { cameras: 0, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });
  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  assert.deepEqual(photoCounts(appContext), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  assert.deepEqual(appContext.getState().cameras.map((photo) => photo.id), beforeIds);

  while (gates.length) {
    gates.shift().gate.resolve();
    await tick();
  }
  await appContext.waitForPhotoOptimizationsForCurrentReport();
  assert.deepEqual(photoCounts(appContext), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  assert.deepEqual(dbCounts(indexedDB, sgtoProfile), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
});

test("SGTO e STELECOM mantem conjuntos independentes apos alternar e recarregar", async () => {
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({ indexedDB });
  await appContext.loadStoredPhotosForCurrentContext();

  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  await addReady(appContext, "cameras", Array.from({ length: 5 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `sgto-camera-${index}.jpg` })));
  await addReady(appContext, "tomadas", Array.from({ length: 5 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `sgto-tomada-${index}.jpg` })));
  await addReady(appContext, "rack", [imageFile({ width: 900, height: 600, size: 500000, name: "sgto-rack.jpg" })]);
  await addReady(appContext, "caixa", [imageFile({ width: 900, height: 600, size: 500000, name: "sgto-caixa.jpg" })]);
  await addReady(appContext, "mastro", [imageFile({ width: 900, height: 600, size: 500000, name: "sgto-mastro.jpg" })]);
  const sgtoProfile = appContext.photoProfileKey();

  setAppContext(appContext, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  await addReady(appContext, "cameras", Array.from({ length: 4 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `stelecom-camera-${index}.jpg` })));
  await addReady(appContext, "tomadas", Array.from({ length: 3 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `stelecom-tomada-${index}.jpg` })));
  const stelecomProfile = appContext.photoProfileKey();

  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  assert.deepEqual(photoCounts(appContext), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  setAppContext(appContext, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  assert.deepEqual(photoCounts(appContext), { cameras: 4, tomadas: 3, rack: 0, caixa: 0, mastro: 0 });

  const reload = createAppContext({ indexedDB });
  setAppContext(reload, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  await reload.loadStoredPhotosForCurrentContext();
  assert.deepEqual(photoCounts(reload), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  setAppContext(reload, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  await reload.loadStoredPhotosForCurrentContext();
  assert.deepEqual(photoCounts(reload), { cameras: 4, tomadas: 3, rack: 0, caixa: 0, mastro: 0 });
  assert.deepEqual(dbCounts(indexedDB, sgtoProfile), { cameras: 5, tomadas: 5, rack: 1, caixa: 1, mastro: 1 });
  assert.deepEqual(dbCounts(indexedDB, stelecomProfile), { cameras: 4, tomadas: 3, rack: 0, caixa: 0, mastro: 0 });
});

test("gerar PDF nao altera fotos, ordem, status ou IndexedDB", async () => {
  const indexedDB = createFakeIndexedDB();
  let written = "";
  const appContext = createAppContext({
    indexedDB,
    openImpl: () => ({
      document: { images: [], title: "", open() {}, write(html) { written = html; }, close() {} },
      close() {},
      focus() {},
      print() {}
    })
  });
  const dateNode = appContext.__nodes.get("[data-visit-date]");
  dateNode.value = "30/08/2026";
  dateNode.listeners.input();
  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  appContext.setChecklistBulkAnswer("SIM");
  await addReady(appContext, "cameras", Array.from({ length: 4 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `pdf-camera-${index}.jpg` })));
  await addReady(appContext, "tomadas", Array.from({ length: 4 }, (_, index) => imageFile({ width: 1200, height: 800, size: 1000000, name: `pdf-tomada-${index}.jpg` })));
  const profile = appContext.photoProfileKey();
  const before = JSON.stringify(appContext.getState());
  const beforeDb = JSON.stringify(dbCounts(indexedDB, profile));
  await appContext.generatePdf();
  assert.match(written, /REGISTRO FOTOGRÁFICO/);
  assert.equal(JSON.stringify(appContext.getState()), before);
  assert.equal(JSON.stringify(dbCounts(indexedDB, profile)), beforeDb);
});

test("retry reutiliza foto com erro sem duplicar e persiste ao concluir", async () => {
  const indexedDB = createFakeIndexedDB();
  let calls = 0;
  const appContext = createAppContext({
    indexedDB,
    createImageBitmapImpl: (file) => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error("decode"));
      return Promise.resolve({ width: file.width, height: file.height, close() {} });
    }
  });
  await appContext.loadStoredPhotosForCurrentContext();
  await appContext.addFiles("rack", [imageFile({ width: 900, height: 600, size: 500000, name: "retry.jpg" })]);
  await appContext.waitForPhotoOptimizationsForCurrentReport();
  const photoId = appContext.getState().rack[0].id;
  assert.equal(appContext.getState().rack[0].status, "error");
  assert.equal(dbRecords(indexedDB).length, 0);
  assert.equal(appContext.retryPhotoOptimization("rack", photoId), true);
  await appContext.waitForPhotoOptimizationsForCurrentReport();
  assert.equal(appContext.getState().rack.length, 1);
  assert.equal(appContext.getState().rack[0].id, photoId);
  assert.equal(appContext.getState().rack[0].status, "ready");
  assert.equal(dbRecords(indexedDB).length, 1);
});

test("Limpar tudo apaga somente contexto atual, persiste vazio e invalida jobs ativos", async () => {
  const gates = [];
  const storage = new Map();
  const indexedDB = createFakeIndexedDB();
  const appContext = createAppContext({
    indexedDB,
    localStorageStore: storage,
    createImageBitmapImpl: (file) => {
      if (!String(file.name).startsWith("limpar")) return Promise.resolve({ width: file.width, height: file.height, close() {} });
      const gate = deferred();
      gates.push({ gate, file });
      return gate.promise.then(() => ({ width: file.width, height: file.height, close() {} }));
    }
  });
  await appContext.loadStoredPhotosForCurrentContext();

  setAppContext(appContext, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  await addReady(appContext, "cameras", [imageFile({ width: 900, height: 600, size: 500000, name: "outra.jpg" })]);
  appContext.setChecklistBulkAnswer("SIM");
  const stelecomProfile = appContext.photoProfileKey();

  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  await appContext.addFiles("cameras", [imageFile({ width: 900, height: 600, size: 500000, name: "limpar-1.jpg" })]);
  await appContext.addFiles("tomadas", [imageFile({ width: 900, height: 600, size: 500000, name: "limpar-2.jpg" })]);
  appContext.setChecklistBulkAnswer("NAO");
  const sgtoProfile = appContext.photoProfileKey();
  assert.equal(appContext.getPhotoOptimizationStats().pending, 2);

  assert.equal(await appContext.clearCurrentReport(), true);
  assert.deepEqual(photoCounts(appContext), { cameras: 0, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });
  assert.equal(Object.keys(appContext.getState().checklistAnswers).length, 0);
  assert.equal(appContext.getPhotoOptimizationStats().pending, 0);
  while (gates.length) {
    gates.shift().gate.resolve();
    await tick();
  }
  await tick();
  assert.deepEqual(dbCounts(indexedDB, sgtoProfile), { cameras: 0, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });

  const reload = createAppContext({ indexedDB, localStorageStore: storage });
  setAppContext(reload, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  await reload.loadStoredPhotosForCurrentContext();
  assert.deepEqual(photoCounts(reload), { cameras: 0, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });
  assert.equal(Object.keys(reload.getState().checklistAnswers).length, 0);

  setAppContext(reload, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  await reload.loadStoredPhotosForCurrentContext();
  assert.deepEqual(photoCounts(reload), { cameras: 1, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });
  assert.deepEqual(dbCounts(indexedDB, stelecomProfile), { cameras: 1, tomadas: 0, rack: 0, caixa: 0, mastro: 0 });
});
test("Todos SIM e Todos NAO preenchem, alternam e mantem exclusividade", () => {
  const template = loadTemplate();
  const appContext = createAppContext();
  assert.equal(template.stelecomChecklistItems.length, 13);
  assert.equal(template.sgtoChecklistItems.length, 15);

  appContext.setChecklistBulkAnswer("SIM");
  assert.ok(allAnswersAre(appContext, template, "STELECOM", "SIM"));
  const htmlAfterAllSim = appContext.__nodes.get("[data-checklist-profile]").innerHTML;
  assert.equal((htmlAfterAllSim.match(/data-answer="SIM">SIM<\/button>/g) || []).length, 13);
  assert.equal((htmlAfterAllSim.match(/data-answer="NAO">NÃO<\/button>/g) || []).length, 13);
  assert.equal((htmlAfterAllSim.match(/choice-button is-selected" type="button" data-answer-item="\d+" data-answer="SIM"/g) || []).length, 13);
  assert.equal((htmlAfterAllSim.match(/choice-button is-selected" type="button" data-answer-item="\d+" data-answer="NAO"/g) || []).length, 0);

  appContext.setChecklistBulkAnswer("SIM");
  assert.equal(Object.keys(appContext.getState().checklistAnswers).length, 0);

  appContext.setChecklistBulkAnswer("NAO");
  assert.ok(allAnswersAre(appContext, template, "STELECOM", "NAO"));
  appContext.setChecklistBulkAnswer("NAO");
  assert.equal(Object.keys(appContext.getState().checklistAnswers).length, 0);
});

test("estado misto vira Todos SIM ou Todos NAO sem tocar observacoes do template", () => {
  const template = loadTemplate();
  const observation = template.sgtoChecklistItems.find((entry) => entry.observation)?.observation;
  const appContext = createAppContext();
  setAppContext(appContext, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });

  appContext.setChecklistAnswer(1, "SIM");
  appContext.setChecklistAnswer(2, "NAO");
  appContext.setChecklistAnswer(3, "SIM");
  appContext.setChecklistBulkAnswer("SIM");
  assert.ok(allAnswersAre(appContext, template, "SGTO", "SIM"));
  assert.equal(template.sgtoChecklistItems.find((entry) => entry.observation)?.observation, observation);

  appContext.setChecklistAnswer(4, "SIM");
  appContext.setChecklistAnswer(5, "NAO");
  appContext.setChecklistBulkAnswer("NAO");
  assert.ok(allAnswersAre(appContext, template, "SGTO", "NAO"));
  assert.equal(template.sgtoChecklistItems.find((entry) => entry.observation)?.observation, observation);
});

test("preenchimento em lote autosalva e isola cidade, relatorio e DT1B/PM1B", () => {
  const template = loadTemplate();
  const storage = new Map();
  const firstLoad = createAppContext({ localStorageStore: storage });
  setAppContext(firstLoad, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  firstLoad.setChecklistBulkAnswer("SIM");

  const profiles = firstLoad.getProfiles();
  assert.ok(profiles.ibicoara["sgto|dt1b"]);
  assert.equal(profiles.ibicoara["sgto|dt1b"].workType, "DT1B");
  assert.ok(Object.values(profiles.ibicoara["sgto|dt1b"].checklist).every((value) => value === "SIM"));

  setAppContext(firstLoad, { city: "Ibicoara", reportType: "SGTO", workType: "PM1B" });
  assert.equal(Object.keys(firstLoad.getState().checklistAnswers).length, 0);
  firstLoad.setChecklistBulkAnswer("NAO");
  assert.ok(allAnswersAre(firstLoad, template, "SGTO", "NAO"));

  setAppContext(firstLoad, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });
  assert.equal(Object.keys(firstLoad.getState().checklistAnswers).length, 0);
  setAppContext(firstLoad, { city: "Tremedal", reportType: "SGTO", workType: "DT1B" });
  assert.equal(Object.keys(firstLoad.getState().checklistAnswers).length, 0);

  const reload = createAppContext({ localStorageStore: storage });
  setAppContext(reload, { city: "Ibicoara", reportType: "SGTO", workType: "DT1B" });
  assert.ok(allAnswersAre(reload, template, "SGTO", "SIM"));
  setAppContext(reload, { city: "Ibicoara", reportType: "SGTO", workType: "PM1B" });
  assert.ok(allAnswersAre(reload, template, "SGTO", "NAO"));
});

test("PDF reflete Todos SIM, Todos NAO e tudo desmarcado", () => {
  const template = loadTemplate();
  const appContext = createAppContext();
  setAppContext(appContext, { city: "Ibicoara", reportType: "STELECOM", workType: "DT1B" });

  appContext.setChecklistBulkAnswer("SIM");
  let report = template.buildStelecomReport(Object.assign(appContext.getState(), { date: "30/08/2026" }), "STELECOM");
  assert.equal((report.match(/<td class="col-mark">X<\/td>\s*<td class="col-mark"><\/td>/g) || []).length, 13);

  appContext.setChecklistBulkAnswer("NAO");
  report = template.buildStelecomReport(Object.assign(appContext.getState(), { date: "30/08/2026" }), "STELECOM");
  assert.equal((report.match(/<td class="col-mark"><\/td>\s*<td class="col-mark">X<\/td>/g) || []).length, 13);

  appContext.setChecklistBulkAnswer("NAO");
  report = template.buildStelecomReport(Object.assign(appContext.getState(), { date: "30/08/2026" }), "STELECOM");
  assert.equal((report.match(/<td class="col-mark">X<\/td>/g) || []).length, 0);
});

test("UI de preenchimento rapido possui estado ativo e suporte mobile", () => {
  assert.match(app, /class="checklist-bulk-actions"/);
  assert.match(app, /data-bulk-answer="SIM"/);
  assert.match(app, /aria-pressed="\$\{allSim \? "true" : "false"\}"/);
  assert.match(css, /\.bulk-answer-button/);
  assert.match(css, /min-height: 52px/);
});
