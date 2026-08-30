(function () {
  const template = window.StelecomTemplate;
  const profileStorageKey = "stelecomMunicipalProfiles";
  const reportImageMaxSide = 1400;
  const reportImageQuality = 0.76;
  const reportImageMimeType = "image/jpeg";
  const acceptedPhotoPattern = /^image\/(jpeg|png|webp)$/;
  const state = {
    city: "Tremedal",
    workType: "DT1B",
    date: "",
    reportType: "STELECOM",
    checklistAnswers: {},
    profileSaved: false,
    legends: Object.fromEntries(template.categories.map((category) => [category.id, category.defaultLegend])),
    cameras: [],
    tomadas: [],
    rack: [],
    caixa: [],
    mastro: []
  };

  const nodes = {
    city: document.querySelector("[data-visit-city]"),
    workType: document.querySelector("[data-work-type]"),
    date: document.querySelector("[data-visit-date]"),
    reportType: document.querySelector("[data-report-type]"),
    checklist: document.querySelector("[data-checklist-profile]"),
    tabs: document.querySelector("[data-category-tabs]"),
    panels: document.querySelector("[data-category-panels]"),
    generate: document.querySelector("[data-generate-pdf]"),
    statusTitle: document.querySelector("[data-status-title]"),
    statusDetail: document.querySelector("[data-status-detail]")
  };

  let activeCategory = template.categories[0].id;

  function setStatus(title, detail) {
    nodes.statusTitle.textContent = title;
    nodes.statusDetail.textContent = detail;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cityKey(value) {
    return template.normalizeCity(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "cidade";
  }

  function reportKey() {
    return template.normalizeReportType(state.reportType).toLowerCase();
  }

  function readProfiles() {
    try {
      return JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeProfiles(profiles) {
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(profiles || {}));
      return true;
    } catch (error) {
      return false;
    }
  }

  function normalizeAnswers(answers) {
    const valid = new Set(["SIM", "NAO"]);
    return Object.fromEntries(Object.entries(answers || {}).filter(([, value]) => valid.has(value)));
  }

  function loadChecklistProfile() {
    const profiles = readProfiles();
    const cityProfile = profiles[cityKey(state.city)] || {};
    const reportProfile = cityProfile[reportKey()] || null;
    state.checklistAnswers = normalizeAnswers(reportProfile && reportProfile.checklist);
    state.profileSaved = Boolean(reportProfile);
  }

  function saveChecklistProfile() {
    const profiles = readProfiles();
    const key = cityKey(state.city);
    profiles[key] = profiles[key] || { city: template.normalizeCity(state.city) };
    profiles[key][reportKey()] = Object.assign({}, profiles[key][reportKey()] || {}, {
      checklist: normalizeAnswers(state.checklistAnswers),
      updatedAt: new Date().toISOString()
    });
    if (writeProfiles(profiles)) {
      state.profileSaved = true;
      setStatus("Dados desta cidade salvos", `${template.normalizeCity(state.city)} / ${template.normalizeReportType(state.reportType)} atualizado no navegador.`);
    }
  }

  function checklistItems() {
    return template.reportTypes[template.normalizeReportType(state.reportType)].checklist;
  }

  function missingChecklistItems() {
    return checklistItems().filter((entry) => !state.checklistAnswers[String(entry.item)]);
  }

  function setChecklistAnswer(item, answer) {
    state.checklistAnswers[String(item)] = answer;
    saveChecklistProfile();
    renderChecklist();
  }

  function renderChecklist() {
    if (!nodes.checklist) return;
    const items = checklistItems();
    const missing = missingChecklistItems().length;
    nodes.checklist.innerHTML = `
      <div class="checklist-profile-head">
        <div>
          <h2>Tabela SIM/NÃO</h2>
          <p>${escapeHtml(template.normalizeCity(state.city))} / ${escapeHtml(template.normalizeReportType(state.reportType))} · ${missing ? `${missing} nao definido(s)` : "todos preenchidos"}</p>
        </div>
        <span class="autosave-pill">${state.profileSaved ? "Dados desta cidade salvos" : "NÃO DEFINIDO"}</span>
      </div>
      <div class="checklist-answer-list">
        ${items.map((entry) => {
          const answer = state.checklistAnswers[String(entry.item)] || "";
          return `
            <article class="checklist-answer-card" data-checklist-item="${entry.item}">
              <div class="checklist-answer-text">
                <strong>${entry.item}. ${escapeHtml(entry.service)}</strong>
                <span>${escapeHtml(entry.type)}${entry.observation ? " · " + escapeHtml(entry.observation) : ""}</span>
              </div>
              <div class="choice-buttons" role="group" aria-label="Item ${entry.item}">
                <button class="choice-button ${answer === "SIM" ? "is-selected" : ""}" type="button" data-answer-item="${entry.item}" data-answer="SIM">SIM</button>
                <button class="choice-button ${answer === "NAO" ? "is-selected" : ""}" type="button" data-answer-item="${entry.item}" data-answer="NAO">NÃO</button>
              </div>
              ${answer ? "" : `<small class="undefined-answer">NÃO DEFINIDO</small>`}
            </article>`;
        }).join("")}
      </div>`;

    nodes.checklist.querySelectorAll("[data-answer-item]").forEach((button) => {
      button.addEventListener("click", () => setChecklistAnswer(button.dataset.answerItem, button.dataset.answer));
    });
  }

  function revokePhoto(photo) {
    if (photo && photo.url) URL.revokeObjectURL(photo.url);
  }

  function loadImageFromBlob(blob) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(blob, { imageOrientation: "from-image" });
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Nao foi possivel ler a imagem."));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, mimeType, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Nao foi possivel otimizar a imagem."));
      }, mimeType, quality);
    });
  }

  function scaledDimensions(width, height) {
    const maxSide = Math.max(width, height);
    if (!maxSide || maxSide <= reportImageMaxSide) return { width, height };
    const scale = reportImageMaxSide / maxSide;
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale))
    };
  }

  async function optimizeReportImage(file) {
    if (!file || !acceptedPhotoPattern.test(file.type || "")) {
      throw new Error("Arquivo invalido. Use JPG, PNG ou WEBP.");
    }

    const image = await loadImageFromBlob(file);
    const originalWidth = image.naturalWidth || image.width;
    const originalHeight = image.naturalHeight || image.height;
    if (!originalWidth || !originalHeight) throw new Error("Imagem sem dimensoes validas.");

    const size = scaledDimensions(originalWidth, originalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas indisponivel para otimizar imagem.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    if (typeof image.close === "function") image.close();

    const optimizedBlob = await canvasToBlob(canvas, reportImageMimeType, reportImageQuality);
    const shouldKeepOriginal = size.width === originalWidth
      && size.height === originalHeight
      && file.type === reportImageMimeType
      && optimizedBlob.size >= file.size;
    const outputBlob = shouldKeepOriginal ? file : optimizedBlob;

    return {
      blob: outputBlob,
      width: size.width,
      height: size.height,
      originalWidth,
      originalHeight,
      originalBytes: file.size || 0,
      optimizedBytes: outputBlob.size || file.size || 0,
      mimeType: outputBlob.type || reportImageMimeType,
      optimizedForReport: true,
      compressionRatio: file.size ? outputBlob.size / file.size : 1
    };
  }

  async function photoFromFile(categoryId, file, index) {
    const optimized = await optimizeReportImage(file);
    return {
      id: categoryId + "-" + Date.now() + "-" + index + "-" + Math.random().toString(16).slice(2),
      name: file.name,
      file: optimized.blob,
      url: URL.createObjectURL(optimized.blob),
      width: optimized.width,
      height: optimized.height,
      originalWidth: optimized.originalWidth,
      originalHeight: optimized.originalHeight,
      originalBytes: optimized.originalBytes,
      optimizedBytes: optimized.optimizedBytes,
      mimeType: optimized.mimeType,
      optimizedForReport: true,
      legend: state.legends[categoryId]
    };
  }

  async function addFiles(categoryId, files) {
    const selected = Array.from(files || []);
    const accepted = selected.filter((file) => acceptedPhotoPattern.test(file.type || ""));
    const blocked = selected.length - accepted.length;
    if (!accepted.length) {
      if (blocked) setStatus("Arquivo invalido", "Use apenas imagens JPG, PNG ou WEBP.");
      return;
    }

    setStatus("Otimizando fotos", `${accepted.length} foto(s) sendo preparadas para PDF leve.`);
    const mapped = [];
    try {
      for (const [index, file] of accepted.entries()) {
        mapped.push(await photoFromFile(categoryId, file, index));
      }
    } catch (error) {
      mapped.forEach(revokePhoto);
      throw error;
    }

    state[categoryId].push(...mapped);
    render();
    const originalBytes = mapped.reduce((total, photo) => total + photo.originalBytes, 0);
    const optimizedBytes = mapped.reduce((total, photo) => total + photo.optimizedBytes, 0);
    const reduction = originalBytes ? Math.max(0, Math.round((1 - optimizedBytes / originalBytes) * 100)) : 0;
    const invalidText = blocked ? ` ${blocked} arquivo(s) ignorado(s).` : "";
    setStatus("Fotos otimizadas", `${mapped.length} foto(s) adicionada(s) em ${labelOf(categoryId)}. Reducao aproximada: ${reduction}%.${invalidText}`);
  }

  function labelOf(categoryId) {
    return template.categories.find((category) => category.id === categoryId)?.label || categoryId;
  }

  function movePhoto(categoryId, photoId, direction) {
    const list = state[categoryId];
    const index = list.findIndex((photo) => photo.id === photoId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= list.length) return;
    const [photo] = list.splice(index, 1);
    list.splice(target, 0, photo);
    render();
    setStatus("Ordem atualizada", `A ordem das fotos em ${labelOf(categoryId)} foi alterada.`);
  }

  function removePhoto(categoryId, photoId) {
    const list = state[categoryId];
    const index = list.findIndex((photo) => photo.id === photoId);
    if (index < 0) return;
    const [photo] = list.splice(index, 1);
    revokePhoto(photo);
    render();
    setStatus("Foto excluida", `A foto foi removida de ${labelOf(categoryId)}.`);
  }

  function renderTabs() {
    nodes.tabs.innerHTML = template.categories.map((category) => `
      <button class="category-tab ${category.id === activeCategory ? "is-active" : ""}" type="button" data-open-category="${category.id}">
        ${category.label} (${state[category.id].length})
      </button>`).join("");

    nodes.tabs.querySelectorAll("[data-open-category]").forEach((button) => {
      button.addEventListener("click", () => {
        activeCategory = button.dataset.openCategory;
        render();
      });
    });
  }

  function renderPanels() {
    nodes.panels.innerHTML = template.categories.map((category) => {
      const photos = state[category.id];
      const cards = photos.map((photo, index) => `
        <article class="photo-card">
          <img src="${photo.url}" alt="${escapeHtml(photo.name)}">
          <div class="photo-meta">
            <strong>${index + 1}. ${escapeHtml(photo.name)}</strong>
            <span class="photo-optimized">Foto otimizada</span>
            <div class="photo-actions">
              <button type="button" data-move-photo="${photo.id}" data-direction="-1" ${index === 0 ? "disabled" : ""}>Subir</button>
              <button type="button" data-move-photo="${photo.id}" data-direction="1" ${index === photos.length - 1 ? "disabled" : ""}>Descer</button>
              <button type="button" data-remove-photo="${photo.id}">Excluir</button>
            </div>
          </div>
        </article>`).join("");

      return `
        <article class="category-panel ${category.id === activeCategory ? "is-active" : ""}" data-panel="${category.id}">
          <div class="category-header">
            <div>
              <h3>${category.label}</h3>
              <span class="category-count">${photos.length} foto(s)</span>
            </div>
            <label class="upload-button">
              ADICIONAR FOTOS
              <input type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" multiple data-file-input="${category.id}">
            </label>
          </div>
          <label class="legend-field">
            <span>LEGENDA PADRAO</span>
            <input type="text" value="${escapeHtml(state.legends[category.id])}" data-legend-input="${category.id}">
          </label>
          <div class="photo-grid">${cards || `<div class="empty-photos">Nenhuma foto adicionada.</div>`}</div>
        </article>`;
    }).join("");

    nodes.panels.querySelectorAll("[data-file-input]").forEach((input) => {
      input.addEventListener("change", () => {
        addFiles(input.dataset.fileInput, input.files).catch(() => {
          setStatus("Falha na imagem", "Nao foi possivel otimizar uma das fotos selecionadas.");
        }).finally(() => {
          input.value = "";
        });
      });
    });

    nodes.panels.querySelectorAll("[data-legend-input]").forEach((input) => {
      input.addEventListener("input", () => {
        state.legends[input.dataset.legendInput] = input.value;
      });
    });

    nodes.panels.querySelectorAll("[data-move-photo]").forEach((button) => {
      button.addEventListener("click", () => movePhoto(activeCategory, button.dataset.movePhoto, Number(button.dataset.direction)));
    });

    nodes.panels.querySelectorAll("[data-remove-photo]").forEach((button) => {
      button.addEventListener("click", () => removePhoto(activeCategory, button.dataset.removePhoto));
    });
  }

  function render() {
    renderChecklist();
    renderTabs();
    renderPanels();
  }

  function visitPayload() {
    return {
      date: template.normalizeDate(state.date),
      city: template.normalizeCity(state.city),
      workType: template.normalizeWorkType(state.workType),
      reportType: template.normalizeReportType(state.reportType),
      checklistAnswers: { ...state.checklistAnswers },
      legends: { ...state.legends },
      cameras: state.cameras,
      tomadas: state.tomadas,
      rack: state.rack,
      caixa: state.caixa,
      mastro: state.mastro
    };
  }

  function waitForReportImages(reportWindow) {
    const images = Array.from(reportWindow.document.images || []);
    if (!images.length) return Promise.resolve();

    return Promise.all(images.map((image) => new Promise((resolve) => {
      if (image.complete && image.naturalWidth > 0) {
        resolve();
        return;
      }

      const finish = () => resolve();
      image.addEventListener("load", finish, { once: true });
      image.addEventListener("error", finish, { once: true });
    })));
  }

  async function ensurePhotosOptimized() {
    for (const category of template.categories) {
      for (const photo of state[category.id]) {
        if (photo.optimizedForReport || !photo.file) continue;
        const optimized = await optimizeReportImage(photo.file);
        revokePhoto(photo);
        photo.file = optimized.blob;
        photo.url = URL.createObjectURL(optimized.blob);
        photo.width = optimized.width;
        photo.height = optimized.height;
        photo.originalWidth = optimized.originalWidth;
        photo.originalHeight = optimized.originalHeight;
        photo.originalBytes = optimized.originalBytes;
        photo.optimizedBytes = optimized.optimizedBytes;
        photo.mimeType = optimized.mimeType;
        photo.optimizedForReport = true;
      }
    }
  }

  async function generatePdf() {
    const visit = visitPayload();
    if (!template.isValidDate(visit.date)) {
      nodes.date.focus();
      setStatus("Data obrigatoria", "Informe a data da visita no formato dd/mm/aaaa.");
      return;
    }

    const missing = missingChecklistItems();
    if (missing.length) {
      setStatus("Tabela incompleta", `Existem ${missing.length} campos da tabela ainda nao preenchidos.`);
      nodes.checklist.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setStatus("Janela bloqueada", "Permita pop-ups para gerar o PDF.");
      return;
    }

    setStatus("Otimizando PDF", "Conferindo fotos antes de montar o relatorio.");
    try {
      await ensurePhotosOptimized();
    } catch (error) {
      reportWindow.close();
      setStatus("Falha na imagem", "Nao foi possivel preparar uma foto para o PDF.");
      return;
    }

    const optimizedVisit = visitPayload();
    reportWindow.document.open();
    reportWindow.document.write(template.buildStelecomReport(optimizedVisit, optimizedVisit.reportType).replace('./styles.css', new URL('./styles.css', location.href).href));
    reportWindow.document.close();
    reportWindow.document.title = template.buildFilename(optimizedVisit, optimizedVisit.reportType);
    waitForReportImages(reportWindow).then(() => {
      reportWindow.focus();
      reportWindow.print();
    });
    setStatus("PDF preparado", `Use Salvar como PDF com o nome ${template.buildFilename(optimizedVisit, optimizedVisit.reportType)}.`);
  }

  nodes.date.addEventListener("input", () => {
    state.date = template.normalizeDate(nodes.date.value);
    nodes.date.value = state.date;
  });
  nodes.city.addEventListener("input", () => {
    state.city = nodes.city.value;
    loadChecklistProfile();
    renderChecklist();
  });
  nodes.workType.addEventListener("change", () => {
    state.workType = template.normalizeWorkType(nodes.workType.value);
    nodes.workType.value = state.workType;
  });
  nodes.reportType.addEventListener("change", () => {
    state.reportType = template.normalizeReportType(nodes.reportType.value);
    nodes.reportType.value = state.reportType;
    loadChecklistProfile();
    renderChecklist();
  });
  nodes.city.value = state.city;
  nodes.city.setAttribute("list", "stelecom-city-options");
  nodes.workType.value = state.workType;
  nodes.reportType.value = state.reportType;
  nodes.generate.addEventListener("click", generatePdf);
  loadChecklistProfile();
  render();

  window.StelecomApp = {
    getState: () => visitPayload(),
    getProfiles: readProfiles,
    setChecklistAnswer,
    loadChecklistProfile,
    optimizeReportImage,
    imageOptimizationSettings: {
      maxSide: reportImageMaxSide,
      quality: reportImageQuality,
      mimeType: reportImageMimeType
    },
    generatePdf
  };
})();

