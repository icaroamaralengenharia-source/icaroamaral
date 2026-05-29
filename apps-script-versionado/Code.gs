/**
 * Backend Google Apps Script para Relatório de Fiscalização.
 * Recebe dados do site, salva imagens no Drive, gera PDF e envia por e-mail.
 */

const CONFIG = {
  PDF_FOLDER_ID: "1d6-a2fV7nKyM2Nm0cYWD6ePW1L3vB7oR",
  IMAGE_FOLDER_ID: "15-VSuA_IGMkXZyuak-c6C4kPwDxYgV-5",
  LOG_FOLDER_ID: "1SKb9hFw24lR09SxdDWDeUEFXoVidnIC3",
  APP_DATA_FOLDER_NAME: "ObraReport SaaS Data",
  LOGO_IMAGE_FILE_ID: "1TTGNSfXO5JqVSDkKJYrTP4AkHEYNV_9s",
  DEFAULT_EMAIL_TO: "icaroamaralengenharia@gmail.com",
  EMAIL_SUBJECT_PREFIX: "Relatório de Fiscalização",
  MAX_FOTOS_UNIDADE: 20,
  MAX_INCONFORMIDADES: 20
};

function doPost(e) {
  const requestId = Utilities.getUuid();

  try {
    logInfo_(requestId, "doPost iniciado");

    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("Requisição sem corpo JSON.");
    }

    const payload = JSON.parse(e.postData.contents);

    if (isAppApiRequest_(payload)) {
      return json_(processAppApi_(payload, requestId));
    }

    const result = processReport_(payload, requestId);

    return json_({
      ok: true,
      requestId: requestId,
      pdfFileId: result.pdfFile.getId(),
      pdfUrl: result.pdfFile.getUrl(),
      imageFolderUrl: result.imageReportFolder.getUrl()
    });
  } catch (error) {
    logError_(requestId, error, { stage: "doPost" });

    return json_({
      ok: false,
      requestId: requestId,
      error: error.message || String(error)
    });
  }
}

function isAppApiRequest_(payload) {
  return Boolean(
    payload &&
      payload.app === "ObraReport" &&
      typeof payload.action === "string"
  );
}

function processAppApi_(payload, requestId) {
  const action = String(payload.action || "");
  const lock = LockService.getScriptLock();

  lock.waitLock(15000);

  try {
    const store = getAppStore_();
    let result;

    if (action === "health") {
      result = {
        ok: true,
        requestId: requestId,
        app: "ObraReport",
        version: store.version,
        updatedAt: store.updatedAt
      };
    } else if (action === "auth.login") {
      result = handleAuthLogin_(payload, store, requestId);
      saveAppStore_(store);
    } else if (action === "sync.get") {
      result = handleSyncGet_(payload, store, requestId);
    } else if (action === "sync.save") {
      result = handleSyncSave_(payload, store, requestId);
      saveAppStore_(store);
    } else {
      throw new Error("Acao de API desconhecida: " + action);
    }

    return result;
  } finally {
    lock.releaseLock();
  }
}

function handleAuthLogin_(payload, store, requestId) {
  const name = safeText_(payload.name);
  const email = normalizeEmail_(payload.email);
  const password = String(payload.password || "");

  if (!email || !password) {
    throw new Error("Informe e-mail e senha.");
  }

  let user = store.users.find(function (item) {
    return item.email === email;
  });

  if (!user) {
    user = {
      id: createAppId_("usr"),
      name: name || email,
      email: email,
      role: "Responsavel tecnico",
      passwordSalt: Utilities.getUuid(),
      passwordHash: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    user.passwordHash = hashPassword_(password, user.passwordSalt);
    store.users.push(user);
  } else {
    if (user.passwordHash && user.passwordHash !== hashPassword_(password, user.passwordSalt)) {
      throw new Error("E-mail ou senha invalidos.");
    }

    if (name) {
      user.name = name;
      user.updatedAt = new Date().toISOString();
    }
  }

  const token = createAuthToken_(user.id);

  return {
    ok: true,
    requestId: requestId,
    token: token,
    user: publicUser_(user),
    state: buildUserState_(store, user.id)
  };
}

function handleSyncGet_(payload, store, requestId) {
  const user = requireUser_(payload.token, store);

  return {
    ok: true,
    requestId: requestId,
    user: publicUser_(user),
    state: buildUserState_(store, user.id)
  };
}

function handleSyncSave_(payload, store, requestId) {
  const user = requireUser_(payload.token, store);
  const state = payload.state || {};
  const clients = Array.isArray(state.clients) ? state.clients : [];
  const works = Array.isArray(state.works) ? state.works : [];
  const reports = Array.isArray(state.reports) ? state.reports : [];

  store.clients = replaceUserItems_(store.clients, user.id, clients);
  store.works = replaceUserItems_(store.works, user.id, works);
  store.reports = replaceUserItems_(store.reports, user.id, reports, true);
  store.updatedAt = new Date().toISOString();

  return {
    ok: true,
    requestId: requestId,
    user: publicUser_(user),
    state: buildUserState_(store, user.id)
  };
}

function replaceUserItems_(currentItems, userId, nextItems, preserveReportImages) {
  const foreignItems = (currentItems || []).filter(function (item) {
    return item.userId !== userId;
  });

  const existingById = {};

  (currentItems || []).forEach(function (item) {
    if (item && item.id) {
      existingById[item.id] = item;
    }
  });

  const ownedItems = nextItems.map(function (item) {
    const copy = JSON.parse(JSON.stringify(item || {}));
    const existing = existingById[copy.id];

    if (
      preserveReportImages &&
      existing &&
      existing.draft &&
      existing.draft.images &&
      copy.draft &&
      (!copy.draft.images || !Object.keys(copy.draft.images).length)
    ) {
      copy.draft.images = existing.draft.images;
    }

    copy.userId = userId;
    copy.updatedAt = copy.updatedAt || new Date().toISOString();
    copy.createdAt = copy.createdAt || copy.updatedAt;
    copy.id = copy.id || createAppId_("item");
    return copy;
  });

  return foreignItems.concat(ownedItems);
}

function buildUserState_(store, userId) {
  return {
    version: 1,
    users: [publicUser_(store.users.find(function (item) {
      return item.id === userId;
    }))],
    clients: filterByUser_(store.clients, userId),
    works: filterByUser_(store.works, userId),
    reports: filterByUser_(store.reports, userId),
    syncedAt: new Date().toISOString()
  };
}

function filterByUser_(items, userId) {
  return (items || []).filter(function (item) {
    return item.userId === userId;
  });
}

function publicUser_(user) {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || "Responsavel tecnico",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
}

function requireUser_(token, store) {
  const tokenData = verifyAuthToken_(token);
  const user = store.users.find(function (item) {
    return item.id === tokenData.userId;
  });

  if (!user) {
    throw new Error("Sessao invalida. Entre novamente.");
  }

  return user;
}

function getAppStore_() {
  const file = getAppDataFile_();
  const content = file.getBlob().getDataAsString("UTF-8");
  let store;

  try {
    store = content ? JSON.parse(content) : {};
  } catch (error) {
    throw new Error("Banco JSON do ObraReport invalido: " + error.message);
  }

  store.version = store.version || 1;
  store.users = Array.isArray(store.users) ? store.users : [];
  store.clients = Array.isArray(store.clients) ? store.clients : [];
  store.works = Array.isArray(store.works) ? store.works : [];
  store.reports = Array.isArray(store.reports) ? store.reports : [];
  store.updatedAt = store.updatedAt || new Date().toISOString();

  return store;
}

function saveAppStore_(store) {
  store.version = 1;
  store.updatedAt = new Date().toISOString();
  getAppDataFile_().setContent(JSON.stringify(store, null, 2));
}

function getAppDataFile_() {
  const folder = getOrCreateAppDataFolder_();
  const fileName = "obrareport-store.json";
  const files = folder.getFilesByName(fileName);

  if (files.hasNext()) {
    return files.next();
  }

  return folder.createFile(
    fileName,
    JSON.stringify({
      version: 1,
      users: [],
      clients: [],
      works: [],
      reports: [],
      updatedAt: new Date().toISOString()
    }, null, 2),
    MimeType.PLAIN_TEXT
  );
}

function getOrCreateAppDataFolder_() {
  const parent = DriveApp.getFolderById(CONFIG.LOG_FOLDER_ID || CONFIG.PDF_FOLDER_ID);
  const folders = parent.getFoldersByName(CONFIG.APP_DATA_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return parent.createFolder(CONFIG.APP_DATA_FOLDER_NAME);
}

function createAuthToken_(userId) {
  const issuedAt = String(Date.now());
  const payload = userId + "|" + issuedAt;
  const signature = signText_(payload);

  return Utilities.base64EncodeWebSafe(payload + "|" + signature);
}

function verifyAuthToken_(token) {
  if (!token) {
    throw new Error("Sessao ausente. Entre novamente.");
  }

  let decoded;

  try {
    decoded = Utilities.newBlob(Utilities.base64DecodeWebSafe(String(token))).getDataAsString();
  } catch (error) {
    throw new Error("Sessao invalida. Entre novamente.");
  }

  const parts = decoded.split("|");

  if (parts.length !== 3) {
    throw new Error("Sessao invalida. Entre novamente.");
  }

  const payload = parts[0] + "|" + parts[1];
  const expected = signText_(payload);

  if (expected !== parts[2]) {
    throw new Error("Sessao expirada ou invalida. Entre novamente.");
  }

  const maxAgeMs = 1000 * 60 * 60 * 24 * 30;
  const issuedAt = Number(parts[1]);

  if (!issuedAt || Date.now() - issuedAt > maxAgeMs) {
    throw new Error("Sessao expirada. Entre novamente.");
  }

  return {
    userId: parts[0],
    issuedAt: issuedAt
  };
}

function signText_(text) {
  const secret = getAppSecret_();
  const bytes = Utilities.computeHmacSha256Signature(text, secret);
  return bytesToHex_(bytes);
}

function getAppSecret_() {
  const properties = PropertiesService.getScriptProperties();
  let secret = properties.getProperty("OBRAREPORT_APP_SECRET");

  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    properties.setProperty("OBRAREPORT_APP_SECRET", secret);
  }

  return secret;
}

function hashPassword_(password, salt) {
  return bytesToHex_(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(salt || "") + "::" + String(password || ""),
      Utilities.Charset.UTF_8
    )
  );
}

function bytesToHex_(bytes) {
  return bytes.map(function (byte) {
    const value = byte < 0 ? byte + 256 : byte;
    return ("0" + value.toString(16)).slice(-2);
  }).join("");
}

function normalizeEmail_(value) {
  return String(value || "").trim().toLowerCase();
}

function createAppId_(prefix) {
  return prefix + "_" + Utilities.getUuid().replace(/-/g, "").slice(0, 16);
}

function processReport_(payload, requestId) {
  validatePayload_(payload);

  const report = payload.report;
  const timestamp = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM-dd_HH-mm-ss"
  );
  const safeObra = safeName_(report.obra);
  const baseName = timestamp + "_" + safeObra + "_" + requestId.slice(0, 8);

  const pdfFolder = DriveApp.getFolderById(CONFIG.PDF_FOLDER_ID);
  const imageRootFolder = DriveApp.getFolderById(CONFIG.IMAGE_FOLDER_ID);
  const imageReportFolder = imageRootFolder.createFolder(baseName);

  const fotosUnidade = saveImageItems_(
    payload.fotosUnidade || [],
    imageReportFolder,
    "UNIDADE",
    requestId
  );

  const inconformidades = saveImageItems_(
    payload.inconformidades || [],
    imageReportFolder,
    "RQO",
    requestId
  );

  const docFile = createDocument_(
    baseName,
    report,
    fotosUnidade,
    inconformidades,
    requestId
  );

  const pdfBlob = docFile
    .getBlob()
    .getAs(MimeType.PDF)
    .setName(baseName + ".pdf");

  const pdfFile = pdfFolder.createFile(pdfBlob);

  sendEmail_(report, pdfFile, pdfBlob, requestId);

  logInfo_(requestId, "Relatório concluído: " + pdfFile.getUrl());

  return {
    pdfFile: pdfFile,
    imageReportFolder: imageReportFolder,
    docFile: docFile
  };
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Payload inválido.");
  }

  if (!payload.report) {
    throw new Error("Dados do relatório ausentes.");
  }

  const requiredFields = [
    "obra",
    "dataVistoria",
    "responsavelTecnico",
    "local",
    "tipoObra",
    "emailDestino"
  ];

  requiredFields.forEach(function (field) {
    if (!String(payload.report[field] || "").trim()) {
      throw new Error("Campo obrigatório ausente: " + field);
    }
  });

  const fotosUnidade = payload.fotosUnidade || [];
  const inconformidades = payload.inconformidades || [];

  if (!Array.isArray(fotosUnidade) || !Array.isArray(inconformidades)) {
    throw new Error("Listas de fotos inválidas.");
  }

  if (fotosUnidade.length > CONFIG.MAX_FOTOS_UNIDADE) {
    throw new Error("Limite de fotos da unidade excedido. Máximo: " + CONFIG.MAX_FOTOS_UNIDADE);
  }

  if (inconformidades.length > CONFIG.MAX_INCONFORMIDADES) {
    throw new Error("Limite de inconformidades excedido. Máximo: " + CONFIG.MAX_INCONFORMIDADES);
  }

  fotosUnidade.forEach(function (item) {
    if (!item.numero || !item.descricao || !item.foto || !item.foto.base64 || !item.foto.mimeType) {
      throw new Error("Foto da unidade incompleta.");
    }
  });

  inconformidades.forEach(function (item) {
    if (
      !item.numero ||
      !item.descricaoTecnica ||
      !item.solucaoRecomendada ||
      !item.grauRisco ||
      !item.foto ||
      !item.foto.base64 ||
      !item.foto.mimeType
    ) {
      throw new Error("Inconformidade incompleta. Envie foto, descrição, solução e grau de risco.");
    }
  });
}

function saveImageItems_(items, folder, prefix, requestId) {
  return items.map(function (item) {
    try {
      const photo = item.foto;
      const bytes = Utilities.base64Decode(photo.base64);
      const fileName =
        prefix +
        "-" +
        item.numero +
        "_" +
        safeName_(photo.fileName || photo.originalName || "foto.jpg");

      const blob = Utilities.newBlob(bytes, photo.mimeType, fileName);
      const file = folder.createFile(blob);

      return {
        numero: item.numero,
        descricao: item.descricao,
        descricaoTecnica: item.descricaoTecnica,
        solucaoRecomendada: item.solucaoRecomendada,
        grauRisco: item.grauRisco,
        file: file,
        blob: blob,
        fileName: fileName
      };
    } catch (error) {
      logError_(requestId, error, {
        stage: "saveImageItems_",
        prefix: prefix,
        numero: item.numero
      });

      throw new Error("Falha ao salvar imagem " + prefix + " " + item.numero + ": " + error.message);
    }
  });
}

function createDocument_(baseName, report, fotosUnidade, inconformidades, requestId) {
  const doc = DocumentApp.create(baseName + "_doc");
  const body = doc.getBody();

  buildDefaultDocument_(doc, body, report, fotosUnidade, inconformidades, requestId);

  doc.saveAndClose();

  return DriveApp.getFileById(doc.getId());
}

function buildDefaultDocument_(doc, body, report, fotosUnidade, inconformidades, requestId) {
  body.clear();

  body.setMarginTop(34);
  body.setMarginBottom(42);
  body.setMarginLeft(42);
  body.setMarginRight(42);

  addDocumentFooter_(doc, report);
  insertTechnicalCover_(body, report, fotosUnidade, inconformidades, requestId);
  appendSummary_(body, report, fotosUnidade, inconformidades);

  appendMainTitle_(body, "RELATORIO TECNICO PROFISSIONAL");
  appendObjectiveBox_(body);

  appendSectionHeader_(body, "1 - IDENTIFICACAO DA OBRA");
  appendInfoBox_(body, [
    ["OBRA", report.obra],
    ["CLIENTE", report.cliente || "Nao informado"],
    ["EMPRESA", getCompanyName_(report) || "Nao informado"],
    ["DATA DA VISTORIA", formatDateForDisplay_(report.dataVistoria)],
    ["RESPONSÁVEL TÉCNICO", report.responsavelTecnico],
    ["CREA / CAU", getProfessionalRegistry_(report)],
    ["Nº RELATÓRIO", "RF-" + requestId.slice(0, 8).toUpperCase()],
    ["LOCAL", report.local],
    ["DATA DE INICIO DA OBRA", formatDateForDisplay_(report.dataInicioObra)],
    ["LINK DE CAMERAS", report.linkCameras]
  ]);

  appendSectionHeader_(body, "2 - DADOS DO CLIENTE E CONTEXTO");
  appendInfoBox_(body, [
    ["CLIENTE", report.cliente || "Nao informado"],
    ["E-MAIL DE ENVIO", report.emailDestino],
    ["TIPO DE OBRA", report.tipoObra],
    ["AVANÇO FÍSICO", report.avancoFisico],
    ["AVANÇO FINANCEIRO", report.avancoFinanceiro],
    ["FUNCIONÁRIOS EM CAMPO", report.funcionariosCampo],
    ["UTILIZAÇÃO EPI", report.utilizacaoEpi],
    ["CONTROLE DO CONCRETO", report.controleConcreto]
  ]);

  appendSectionHeader_(body, "3 - RESUMO TECNICO");
  appendInfoBox_(body, [
    ["OBSERVACOES", report.observacoes || "Sem observacoes tecnicas informadas."],
    ["REVISAO TECNICA DA IA", report.revisaoTecnicaIa || "Nao informada."]
  ]);

  if (fotosUnidade.length) {
    appendFotosUnidade_(body, fotosUnidade, requestId);
  }

  if (inconformidades.length) {
    appendInconformidades_(body, inconformidades, requestId);
    appendRiskChart_(body, inconformidades);
  }

  appendConclusionBlock_(body, report);
  appendSignatureBlock_(body, report, requestId);
}

function insertTechnicalCover_(body, report, fotosUnidade, inconformidades, requestId) {
  const companyName = getCompanyName_(report);
  const logoBlob = getReportLogoBlob_(report, requestId);
  const heroPhoto = getFirstReportPhoto_(fotosUnidade, inconformidades);

  appendCoverBand_(body, companyName || "ObraReport", "Relatorio Tecnico Profissional");

  if (logoBlob) {
    appendInlineImageCentered_(body, logoBlob, 220, 70, requestId, "cover-logo");
  } else {
    appendCenteredParagraph_(body, companyName || "ObraReport", 18, true, "#082033");
    appendCenteredParagraph_(body, companyName ? "Relatorio tecnico profissional" : "Plataforma de relatorios tecnicos", 10, false, "#5b6673");
  }

  body.appendParagraph("").setSpacingAfter(14);

  appendCenteredParagraph_(body, "RELATORIO DE FISCALIZACAO", 25, true, "#082033");
  appendCenteredParagraph_(body, "Laudo tecnico para acompanhamento de obra", 11, false, "#5b6673");

  body.appendParagraph("").setSpacingAfter(16);

  if (heroPhoto && heroPhoto.blob) {
    appendCoverHeroPhoto_(body, heroPhoto, requestId);
  }

  appendCoverLine_(body, "OBRA", report.obra);
  appendCoverLine_(body, "CLIENTE", report.cliente || "Nao informado");
  appendCoverLine_(body, "EMPRESA", companyName || "Nao informado");
  appendCoverLine_(body, "DATA DA VISTORIA", formatDateForDisplay_(report.dataVistoria));
  appendCoverLine_(body, "RESPONSAVEL TECNICO", report.responsavelTecnico);
  appendCoverLine_(body, "CREA / CAU", getProfessionalRegistry_(report));
  appendCoverLine_(body, "LOCAL", report.local);
  appendCoverLine_(body, "N. RELATORIO", "RF-" + requestId.slice(0, 8).toUpperCase());

  body.appendParagraph("").setSpacingAfter(10);
  appendProfessionalSeal_(body);

  body.appendPageBreak();
}

function getCompanyName_(report) {
  return String(
    (report && (report.nomeEmpresa || report.empresa || report.razaoSocial)) ||
      ""
  ).trim();
}

function getProfessionalRegistry_(report) {
  return safeText_(report && (report.creaCau || report.registroProfissional || report.cargoCreaCau));
}

function getFirstReportPhoto_(fotosUnidade, inconformidades) {
  if (fotosUnidade && fotosUnidade.length) {
    return {
      blob: fotosUnidade[0].blob,
      caption: fotosUnidade[0].descricao || "Foto principal da obra"
    };
  }

  if (inconformidades && inconformidades.length) {
    return {
      blob: inconformidades[0].blob,
      caption: inconformidades[0].descricaoTecnica || "Foto principal da obra"
    };
  }

  return null;
}

function getReportLogoBlob_(report, requestId) {
  return getOptionalImageBlob_(
    report && report.logoEmpresaBase64,
    report && report.logoEmpresaUrl,
    report && report.logoEmpresaMimeType,
    "logo-empresa.png",
    requestId,
    "logo-empresa"
  );
}

function getSignatureBlob_(report, requestId) {
  return getOptionalImageBlob_(
    report && report.assinaturaBase64,
    report && report.assinaturaUrl,
    report && report.assinaturaMimeType,
    "assinatura.png",
    requestId,
    "assinatura"
  );
}

function getOptionalImageBlob_(base64, url, mimeType, fileName, requestId, stage) {
  try {
    if (base64) {
      const cleanBase64 = String(base64).replace(/^data:[^;]+;base64,/, "");
      const bytes = Utilities.base64Decode(cleanBase64);
      return Utilities.newBlob(bytes, mimeType || "image/png", fileName);
    }

    if (url) {
      const response = UrlFetchApp.fetch(String(url), { muteHttpExceptions: true });
      const statusCode = response.getResponseCode();

      if (statusCode >= 200 && statusCode < 300) {
        return response.getBlob().setName(fileName);
      }

      throw new Error("HTTP " + statusCode);
    }
  } catch (error) {
    logError_(requestId, error, { stage: stage });
  }

  return null;
}

function appendCoverHeroPhoto_(body, photo, requestId) {
  const table = body.appendTable([[""]]);
  table.setBorderWidth(1);

  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor("#f8fafc");
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);

  try {
    const paragraph = cell.getChild(0).asParagraph();
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const image = paragraph.appendInlineImage(photo.blob);
    scaleInlineImageToBox_(image, 430, 170);
  } catch (error) {
    logError_(requestId, error, { stage: "cover-hero-photo" });
    cell.editAsText().setText("Foto principal indisponivel");
  }

  const caption = cell.appendParagraph(shortText_(photo.caption, 115));
  caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  caption.editAsText().setFontSize(8).setForegroundColor("#5b6673").setBold(true);

  body.appendParagraph("").setSpacingAfter(12);
}

function appendCoverLine_(body, label, value) {
  const paragraph = body.appendParagraph("");
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  paragraph.setSpacingAfter(8);
  paragraph.appendText(label + ": ").setBold(true).setFontSize(10).setForegroundColor("#082033");
  paragraph.appendText(safeText_(value)).setBold(false).setFontSize(10).setForegroundColor("#111827");
}

function appendCoverBand_(body, brand, seal) {
  const table = body.appendTable([[brand, seal]]);
  table.setBorderWidth(0);

  const left = table.getRow(0).getCell(0);
  const right = table.getRow(0).getCell(1);

  left.setBackgroundColor("#082033");
  right.setBackgroundColor("#0f766e");

  [left, right].forEach(function (cell) {
    cell.setPaddingTop(9);
    cell.setPaddingBottom(9);
    cell.setPaddingLeft(10);
    cell.setPaddingRight(10);
    cell.editAsText().setForegroundColor("#ffffff").setFontSize(10).setBold(true);
  });

  right.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  body.appendParagraph("").setSpacingAfter(18);
}

function appendProfessionalSeal_(body) {
  const table = body.appendTable([["Gerado com ObraReport", "Relatorio Tecnico Profissional"]]);
  table.setBorderWidth(1);

  for (let cellIndex = 0; cellIndex < table.getRow(0).getNumCells(); cellIndex++) {
    const cell = table.getRow(0).getCell(cellIndex);
    cell.setBackgroundColor(cellIndex === 0 ? "#f4f7f9" : "#e8f5f2");
    cell.setPaddingTop(7);
    cell.setPaddingBottom(7);
    cell.setPaddingLeft(9);
    cell.setPaddingRight(9);
    cell.editAsText().setFontSize(9).setBold(true).setForegroundColor("#082033");
    cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }

  body.appendParagraph("").setSpacingAfter(8);
}

function appendSummary_(body, report, fotosUnidade, inconformidades) {
  appendMainTitle_(body, "SUMARIO");

  const sections = [
    ["1", "Identificacao da obra"],
    ["2", "Dados do cliente e contexto"],
    ["3", "Resumo tecnico"]
  ];

  if (fotosUnidade.length) {
    sections.push(["4", "Galeria de fotos"]);
  }

  if (inconformidades.length) {
    sections.push(["5", "Ocorrencias e inconformidades"]);
    sections.push(["6", "Matriz de prioridade"]);
  }

  sections.push(["7", "Conclusao"]);
  sections.push(["8", "Assinatura e responsabilidade tecnica"]);

  const table = body.appendTable(sections);
  table.setBorderWidth(1);

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const row = table.getRow(rowIndex);
    row.getCell(0).setWidth(42);

    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex++) {
      const cell = row.getCell(cellIndex);
      cell.setPaddingTop(6);
      cell.setPaddingBottom(6);
      cell.setPaddingLeft(8);
      cell.setPaddingRight(8);
      cell.editAsText().setFontSize(10).setForegroundColor("#111827");

      if (cellIndex === 0) {
        cell.setBackgroundColor("#082033");
        cell.editAsText().setForegroundColor("#ffffff").setBold(true);
        cell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      }
    }
  }

  body.appendParagraph("").setSpacingAfter(8);
  appendInfoBox_(body, [
    ["OBRA", report.obra],
    ["CLIENTE", report.cliente || "Nao informado"],
    ["DATA", formatDateForDisplay_(report.dataVistoria)]
  ]);
  body.appendPageBreak();
}

function appendFotosUnidade_(body, fotosUnidade, requestId) {
  body.appendPageBreak();
  appendPhotoGrid_(body, fotosUnidade, requestId, "4 - GALERIA DE FOTOS");
}

function appendInconformidades_(body, inconformidades, requestId) {
  body.appendPageBreak();
  appendMainTitle_(body, "5 - OCORRENCIAS E INCONFORMIDADES");

  inconformidades.forEach(function (item, index) {
    if (index > 0) {
      body.appendPageBreak();
      appendMainTitle_(body, "5 - OCORRENCIAS E INCONFORMIDADES");
    }

    appendOccurrenceCard_(body, item, requestId);
  });
}

function appendPhotoCard_(body, title, blob, description, maxWidth, requestId, label) {
  const table = body.appendTable([[title]]);
  table.setBorderWidth(1);

  const header = table.getRow(0).getCell(0);
  header.setBackgroundColor("#f4f7f9");
  header.setPaddingTop(6);
  header.setPaddingBottom(6);
  header.setPaddingLeft(8);
  header.setPaddingRight(8);
  header.editAsText().setFontSize(10).setBold(true).setForegroundColor("#082033");

  appendPhotoBlock_(body, blob, description, maxWidth, requestId, label);
}

function appendPhotoGrid_(body, photos, requestId, title) {
  appendMainTitle_(body, title);

  for (let startIndex = 0; startIndex < photos.length; startIndex += 4) {
    if (startIndex > 0) {
      body.appendPageBreak();
      appendMainTitle_(body, title);
    }

    const pageItems = photos.slice(startIndex, startIndex + 4);
    const totalRows = Math.ceil(pageItems.length / 2);

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const leftItem = pageItems[rowIndex * 2] || null;
      const rightItem = pageItems[rowIndex * 2 + 1] || null;
      const row = pageItems.length === 1 ? body.appendTable([[""]]) : body.appendTable([["", ""]]);
      row.setBorderWidth(1);

      const isSingleColumn = row.getRow(0).getNumCells() === 1;
      appendPhotoGridCell_(row.getRow(0).getCell(0), leftItem, requestId, isSingleColumn ? 330 : 230);

      if (!isSingleColumn) {
        appendPhotoGridCell_(row.getRow(0).getCell(1), rightItem, requestId, 230);
      }

      body.appendParagraph("").setSpacingAfter(8);
    }
  }
}

function appendPhotoGridCell_(cell, item, requestId, maxWidth) {
  cell.setBackgroundColor("#ffffff");
  cell.setPaddingTop(7);
  cell.setPaddingBottom(7);
  cell.setPaddingLeft(7);
  cell.setPaddingRight(7);

  if (!item) {
    cell.editAsText().setText("");
    return;
  }

  const title = cell.getChild(0).asParagraph();
  title.setText("Foto " + safeText_(item.numero));
  title.editAsText().setFontSize(9).setBold(true).setForegroundColor("#082033");

  try {
    const imageParagraph = cell.appendParagraph("");
    imageParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    const image = imageParagraph.appendInlineImage(item.blob);
    scaleInlineImageToBox_(image, maxWidth || 230, 150);
  } catch (error) {
    logError_(requestId, error, {
      stage: "appendPhotoGridCell_",
      label: "foto-unidade-" + item.numero
    });

    cell.appendParagraph("Imagem indisponivel")
      .editAsText()
      .setFontSize(8)
      .setForegroundColor("#b42318");
  }

  const caption = cell.appendParagraph(shortText_(item.descricao, 110));
  caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  caption.editAsText().setFontSize(8).setForegroundColor("#5b6673");
}

function appendOccurrenceCard_(body, item, requestId) {
  const riskKey = normalizeRisk_(item.grauRisco);
  const riskLabel = normalizeRiskLabel_(item.grauRisco);
  const riskStyle = getRiskStyle_(riskKey);
  const header = body.appendTable([[
    "Ocorrencia " + item.numero,
    "Status / gravidade: " + riskLabel
  ]]);
  header.setBorderWidth(1);

  for (let cellIndex = 0; cellIndex < header.getRow(0).getNumCells(); cellIndex++) {
    const cell = header.getRow(0).getCell(cellIndex);
    cell.setBackgroundColor(cellIndex === 0 ? "#082033" : riskStyle.background);
    cell.setPaddingTop(8);
    cell.setPaddingBottom(8);
    cell.setPaddingLeft(8);
    cell.setPaddingRight(8);
    cell.editAsText()
      .setFontSize(10)
      .setBold(true)
      .setForegroundColor(cellIndex === 0 ? "#ffffff" : riskStyle.foreground);
  }

  appendPhotoBlock_(body, item.blob, "Foto relacionada a ocorrencia " + item.numero, 430, requestId, "rqo-" + item.numero);
  appendInfoBox_(body, [
    ["AMBIENTE / LOCAL", "Conforme local informado no relatorio"],
    ["DESCRICAO", item.descricaoTecnica],
    ["RECOMENDACAO TECNICA", item.solucaoRecomendada],
    ["GRAVIDADE / STATUS", riskLabel]
  ]);
}

function appendPhotoBlock_(body, blob, description, maxWidth, requestId, label) {
  try {
    const imageParagraph = body.appendParagraph("");
    imageParagraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    imageParagraph.setSpacingAfter(4);

    const image = imageParagraph.appendInlineImage(blob);
    scaleInlineImage_(image, maxWidth);
  } catch (error) {
    logError_(requestId, error, {
      stage: "appendPhotoBlock_",
      label: label
    });

    body.appendParagraph("Erro ao renderizar a foto no PDF: " + error.message)
      .setForegroundColor("#b42318");
  }

  const caption = body.appendParagraph(safeText_(description));
  caption.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  caption.setSpacingAfter(16);
  caption.editAsText().setFontSize(9).setBold(true).setForegroundColor("#082033");
}

function appendRiskChart_(body, inconformidades) {
  body.appendPageBreak();
  appendMainTitle_(body, "6 - MATRIZ DE PRIORIDADE DE INTERVENCAO");

  const counts = countRisks_(inconformidades);
  const total = inconformidades.length;
  const immediate = counts.Alto + counts.Interdicao;

  const rows = [
    ["Grau de risco", "Quantidade", "Prioridade técnica", "Ação recomendada"],
    ["Baixo", String(counts.Baixo), "Monitoramento", "Acompanhar e registrar em vistoria futura."],
    ["Médio", String(counts.Medio), "Correção programada", "Corrigir com prazo definido pela equipe técnica."],
    ["Alto", String(counts.Alto), "Intervenção imediata", "Corrigir imediatamente e acompanhar a execução."],
    ["Interdição", String(counts.Interdicao), "Paralisação da área", "Isolar ou interditar a área até avaliação técnica."]
  ];

  const table = body.appendTable(rows);
  table.setBorderWidth(1);

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const row = table.getRow(rowIndex);

    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex++) {
      const cell = row.getCell(cellIndex);
      cell.setPaddingTop(6);
      cell.setPaddingBottom(6);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);
      cell.editAsText().setFontSize(9).setForegroundColor("#000000");

      if (rowIndex === 0) {
        cell.setBackgroundColor("#071b31");
        cell.editAsText().setForegroundColor("#ffffff");
        cell.editAsText().setBold(true);
      }

      if (rowIndex > 0) {
        const riskStyle = getRiskStyleByRow_(rowIndex);
        cell.setBackgroundColor(cellIndex === 0 ? riskStyle.background : riskStyle.softBackground);
        cell.editAsText().setForegroundColor(rowIndex === 4 && cellIndex > 0 ? "#7f1d1d" : riskStyle.foreground);

        if (rowIndex === 4) {
          cell.editAsText().setBold(true);
        }
      }
    }
  }

  body.appendParagraph("");
  appendInfoBox_(body, [
    ["TOTAL DE INCONFORMIDADES", String(total)],
    ["NECESSIDADE DE INTERVENÇÃO IMEDIATA", immediate + " item(ns) classificados como Alto ou Interdição"]
  ]);
}

function countRisks_(inconformidades) {
  const counts = {
    Baixo: 0,
    Medio: 0,
    Alto: 0,
    Interdicao: 0
  };

  inconformidades.forEach(function (item) {
    const risk = normalizeRisk_(item.grauRisco);
    counts[risk] += 1;
  });

  return counts;
}

function normalizeRisk_(value) {
  const text = String(value || "").toLowerCase();

  if (text.indexOf("inter") !== -1 || text.indexOf("crit") !== -1) {
    return "Interdicao";
  }

  if (text.indexOf("alto") !== -1) {
    return "Alto";
  }

  if (text.indexOf("med") !== -1) {
    return "Medio";
  }

  return "Baixo";
}

function normalizeRiskLabel_(value) {
  const risk = normalizeRisk_(value);

  if (risk === "Medio") {
    return "Médio";
  }

  if (risk === "Interdicao") {
    return "Interdição";
  }

  return risk;
}

function getRiskStyle_(risk) {
  const styles = {
    Baixo: {
      background: "#d9ead3",
      softBackground: "#f3faf0",
      foreground: "#14532d"
    },
    Medio: {
      background: "#fff2cc",
      softBackground: "#fffaf0",
      foreground: "#854d0e"
    },
    Alto: {
      background: "#fce4d6",
      softBackground: "#fff4ed",
      foreground: "#9a3412"
    },
    Interdicao: {
      background: "#b42318",
      softBackground: "#fee4e2",
      foreground: "#ffffff"
    }
  };

  return styles[risk] || styles.Baixo;
}

function getRiskStyleByRow_(rowIndex) {
  const riskByRow = {
    1: "Baixo",
    2: "Medio",
    3: "Alto",
    4: "Interdicao"
  };

  return getRiskStyle_(riskByRow[rowIndex] || "Baixo");
}

function appendSignatureBlock_(body, report, requestId) {
  body.appendPageBreak();

  body.appendParagraph("")
    .setSpacingAfter(120);

  appendMainTitle_(body, "8 - ASSINATURA E RESPONSABILIDADE TECNICA");
  const companyName = getCompanyName_(report);
  const signatureBlob = getSignatureBlob_(report, requestId);

  appendInfoBox_(body, [
    ["RESPONSAVEL TECNICO", report.responsavelTecnico],
    ["CREA / CAU", getProfessionalRegistry_(report)],
    ["EMPRESA", companyName || "Nao informado"],
    ["DATA", formatDateForDisplay_(report.dataVistoria)],
    ["RESPONSABILIDADE TECNICA", "Documento gerado para fins de acompanhamento tecnico da obra."]
  ]);

  body.appendParagraph("")
    .setSpacingAfter(32);

  if (signatureBlob) {
    appendInlineImageCentered_(body, signatureBlob, 220, 76, requestId, "assinatura");
  }

  appendCenteredParagraph_(body, "____________________________________________", 10, false, "#000000");
  appendCenteredParagraph_(body, safeText_(report.responsavelTecnico), 10, true, "#000000");
  appendCenteredParagraph_(body, getProfessionalRegistry_(report), 9, false, "#666666");

  if (companyName) {
    appendCenteredParagraph_(body, companyName, 9, false, "#666666");
  }
}

function appendConclusionBlock_(body, report) {
  body.appendPageBreak();
  appendMainTitle_(body, "7 - CONCLUSAO");
  appendInfoBox_(body, [
    ["CONCLUSAO TECNICA", report.conclusaoTecnica || "Conclusao tecnica nao informada."],
    ["ENCAMINHAMENTO", "Recomenda-se que as ocorrencias registradas sejam avaliadas, priorizadas e acompanhadas conforme grau de risco e responsabilidade tecnica aplicavel."]
  ]);
  appendProfessionalSeal_(body);
}

function appendMainTitle_(body, text) {
  const table = body.appendTable([[text]]);
  table.setBorderWidth(0);

  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor("#082033");
  cell.setPaddingTop(8);
  cell.setPaddingBottom(8);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);
  cell.editAsText()
    .setBold(true)
    .setFontSize(12)
    .setForegroundColor("#ffffff");

  cell.getChild(0)
    .asParagraph()
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);

  body.appendParagraph("");
}

function appendSectionHeader_(body, text) {
  const table = body.appendTable([[text]]);
  table.setBorderWidth(0);

  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor("#0f766e");
  cell.setPaddingTop(7);
  cell.setPaddingBottom(7);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);
  cell.editAsText()
    .setBold(true)
    .setFontSize(11)
    .setForegroundColor("#ffffff");
}

function appendObjectiveBox_(body) {
  const text =
    "OBJETIVO:\n" +
    "O presente relatorio tem como objetivo apresentar as condicoes identificadas durante a fiscalizacao realizada na obra, contemplando registro fotografico, verificacao de possiveis inconformidades, classificacao de risco e indicacao de medidas recomendadas.";

  const table = body.appendTable([[text]]);
  table.setBorderWidth(1);

  const cell = table.getRow(0).getCell(0);
  cell.setBackgroundColor("#f8fafc");
  cell.setPaddingTop(8);
  cell.setPaddingBottom(9);
  cell.setPaddingLeft(8);
  cell.setPaddingRight(8);
  cell.editAsText()
    .setFontSize(10)
    .setForegroundColor("#111827");

  body.appendParagraph("");
}

function appendInfoLine_(body, label, value) {
  const paragraph = body.appendParagraph("");
  paragraph.setSpacingAfter(4);
  paragraph.appendText(label + ": ")
    .setBold(true)
    .setFontSize(10);
  paragraph.appendText(safeText_(value))
    .setBold(false)
    .setFontSize(10);
}

function appendInfoBox_(body, items) {
  const rows = items.map(function (item) {
    return [item[0] + ": " + safeText_(item[1])];
  });

  const table = body.appendTable(rows);
  table.setBorderWidth(1);

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const row = table.getRow(rowIndex);
    const cell = row.getCell(0);
    const label = String(items[rowIndex][0] || "");
    const text = cell.editAsText();

    cell.setBackgroundColor(rowIndex % 2 === 0 ? "#ffffff" : "#f8fafc");
    cell.setPaddingTop(6);
    cell.setPaddingBottom(6);
    cell.setPaddingLeft(8);
    cell.setPaddingRight(8);

    text.setFontSize(10);
    text.setForegroundColor("#111827");

    if (label) {
      text.setBold(0, label.length, true);
    }
  }

  body.appendParagraph("");
}

function appendCenteredInfoLine_(body, label, value) {
  const paragraph = body.appendParagraph("");
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  paragraph.setSpacingAfter(7);
  paragraph.appendText(label + ": ")
    .setBold(true)
    .setFontSize(10)
    .setForegroundColor("#071b31");
  paragraph.appendText(safeText_(value))
    .setBold(false)
    .setFontSize(10)
    .setForegroundColor("#071b31");
}

function appendCenteredParagraph_(body, text, fontSize, bold, color) {
  const paragraph = body.appendParagraph(String(text || ""));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  paragraph.editAsText()
    .setFontSize(fontSize)
    .setBold(Boolean(bold))
    .setForegroundColor(color);
  return paragraph;
}

function addDocumentFooter_(doc, report) {
  try {
    const footer = doc.addFooter();
    const paragraph = footer.appendParagraph(
      "ObraReport | " +
        safeText_(report && (report.obra || report.cliente)) +
        " | " +
        formatDateForDisplay_(report && report.dataVistoria) +
        " | Pagina "
    );

    paragraph
      .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
      .setFontSize(8)
      .setForegroundColor("#5b6673");

    try {
      paragraph.appendPageNumber();
    } catch (pageError) {
      paragraph.appendText("X");
      console.log("Numero de pagina dinamico indisponivel: " + pageError.message);
    }
  } catch (error) {
    console.log("Rodape ja existente ou nao criado: " + error.message);
  }
}

function sendEmail_(report, pdfFile, pdfBlob, requestId) {
  const recipient = String(report.emailDestino || CONFIG.DEFAULT_EMAIL_TO || "").trim();

  if (!recipient) {
    throw new Error("Nenhum e-mail de destino configurado.");
  }

  MailApp.sendEmail({
    to: recipient,
    subject: CONFIG.EMAIL_SUBJECT_PREFIX + " - " + report.obra,
    body: [
      "Ola,",
      "",
      "Segue em anexo o Relatório de Fiscalização.",
      "",
      "Obra: " + report.obra,
      "Local: " + report.local,
      "Data da vistoria: " + formatDateForDisplay_(report.dataVistoria),
      "PDF no Drive: " + pdfFile.getUrl(),
      "",
      "ID de processamento: " + requestId
    ].join("\n"),
    attachments: [pdfBlob]
  });
}

function scaleInlineImage_(image, maxWidth) {
  const width = image.getWidth();
  const height = image.getHeight();

  if (width > maxWidth) {
    const ratio = maxWidth / width;
    image.setWidth(maxWidth);
    image.setHeight(Math.round(height * ratio));
  }
}

function scaleInlineImageToBox_(image, maxWidth, maxHeight) {
  const width = image.getWidth();
  const height = image.getHeight();

  if (!width || !height) {
    return;
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  image.setWidth(Math.round(width * ratio));
  image.setHeight(Math.round(height * ratio));
}

function appendInlineImageCentered_(body, blob, maxWidth, maxHeight, requestId, label) {
  try {
    const paragraph = body.appendParagraph("");
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    paragraph.setSpacingAfter(10);

    const image = paragraph.appendInlineImage(blob);
    scaleInlineImageToBox_(image, maxWidth, maxHeight);
    return image;
  } catch (error) {
    logError_(requestId, error, {
      stage: "appendInlineImageCentered_",
      label: label
    });
  }

  return null;
}

function formatDateForDisplay_(value) {
  if (!value) {
    return "-";
  }

  const parts = String(value).split("-");

  if (parts.length === 3) {
    return parts[2] + "/" + parts[1] + "/" + parts[0];
  }

  return String(value);
}

function safeText_(value) {
  return String(value || "").trim() || "-";
}

function shortText_(value, maxLength) {
  const text = safeText_(value);

  if (text.length <= maxLength) {
    return text;
  }

  return text.slice(0, maxLength - 3) + "...";
}

function safeName_(value) {
  return String(value || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100) || "arquivo";
}

function json_(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function logInfo_(requestId, message, details) {
  writeLog_("INFO", requestId, message, details);
}

function logError_(requestId, error, details) {
  writeLog_("ERROR", requestId, error && error.stack ? error.stack : String(error), details);
}

function writeLog_(level, requestId, message, details) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    level: level,
    requestId: requestId,
    message: message,
    details: details || null
  });

  console.log(line);

  try {
    if (CONFIG.LOG_FOLDER_ID) {
      const folder = DriveApp.getFolderById(CONFIG.LOG_FOLDER_ID);
      folder.createFile(
        Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd") +
          "_" +
          requestId +
          "_" +
          level +
          ".json",
        line,
        MimeType.PLAIN_TEXT
      );
    }
  } catch (logError) {
    console.log("Falha ao gravar log no Drive: " + logError.message);
  }
}

function testeFinalImagemNoPdf() {
  const chartData = Charts.newDataTable()
    .addColumn(Charts.ColumnType.STRING, "Item")
    .addColumn(Charts.ColumnType.NUMBER, "Valor")
    .addRow(["Imagem de teste", 1])
    .build();

  const chart = Charts.newPieChart()
    .setDataTable(chartData)
    .setTitle("Teste de imagem no PDF")
    .setDimensions(500, 300)
    .build();

  const imageBlob = chart.getAs("image/png").setName("teste-imagem.png");
  const testPngBase64 = Utilities.base64Encode(imageBlob.getBytes());

  const payload = {
    submittedAt: new Date().toISOString(),
    source: "testeFinalImagemNoPdf",
    tipoRelatorio: "fiscalizacao",
    report: {
      obra: "Teste de imagem no PDF",
      dataVistoria: "2026-05-24",
      responsavelTecnico: "Equipe técnica",
      local: "Ambiente de teste",
      dataInicioObra: "2026-05-01",
      linkCameras: "",
      tipoObra: "Residencial",
      avancoFisico: "50%",
      avancoFinanceiro: "40%",
      funcionariosCampo: "10",
      utilizacaoEpi: "Regular",
      controleConcreto: "Conforme",
      observacoes: "Teste automatizado para validar fiscalização, fotos, RQO, matriz de prioridade e assinatura.",
      emailDestino: CONFIG.DEFAULT_EMAIL_TO
    },
    fotosUnidade: [
      {
        numero: "01",
        descricao: "Registro fotográfico geral da unidade.",
        foto: {
          originalName: "foto-unidade.png",
          fileName: "foto-unidade.png",
          mimeType: "image/png",
          base64: testPngBase64
        }
      },
      {
        numero: "02",
        descricao: "Segundo registro fotográfico da unidade.",
        foto: {
          originalName: "foto-unidade-2.png",
          fileName: "foto-unidade-2.png",
          mimeType: "image/png",
          base64: testPngBase64
        }
      }
    ],
    inconformidades: [
      {
        numero: "01",
        descricaoTecnica: "Imagem de teste enviada em Base64 e inserida como Blob no Google Docs.",
        solucaoRecomendada: "Abrir o PDF e confirmar que imagem, grau de risco e matriz de prioridade aparecem corretamente.",
        grauRisco: "Alto",
        foto: {
          originalName: "teste-imagem.png",
          fileName: "teste-imagem.png",
          mimeType: "image/png",
          base64: testPngBase64
        }
      }
    ]
  };

  const result = processReport_(payload, "TESTE-" + Utilities.getUuid());
  console.log("PDF de teste: " + result.pdfFile.getUrl());
}
