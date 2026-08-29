(function () {
  const template = window.StelecomTemplate;
  const state = {
    city: "Tremedal",
    workType: "DT1B",
    date: "",
    reportType: "STELECOM",
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

  function revokePhoto(photo) {
    if (photo && photo.url) URL.revokeObjectURL(photo.url);
  }

  function addFiles(categoryId, files) {
    const accepted = Array.from(files || []).filter((file) => /^image\/(jpeg|png|webp)$/.test(file.type));
    const mapped = accepted.map((file, index) => ({
      id: categoryId + "-" + Date.now() + "-" + index + "-" + Math.random().toString(16).slice(2),
      name: file.name,
      file,
      url: URL.createObjectURL(file),
      legend: state.legends[categoryId]
    }));
    state[categoryId].push(...mapped);
    render();
    setStatus("Fotos adicionadas", `${mapped.length} foto(s) adicionada(s) em ${labelOf(categoryId)}.`);
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
        addFiles(input.dataset.fileInput, input.files);
        input.value = "";
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
    renderTabs();
    renderPanels();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function visitPayload() {
    return {
      date: template.normalizeDate(state.date),
      city: template.normalizeCity(state.city),
      workType: template.normalizeWorkType(state.workType),
      reportType: template.normalizeReportType(state.reportType),
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

  function generatePdf() {
    const visit = visitPayload();
    if (!template.isValidDate(visit.date)) {
      nodes.date.focus();
      setStatus("Data obrigatoria", "Informe a data da visita no formato dd/mm/aaaa.");
      return;
    }

    const reportWindow = window.open("", "_blank");
    if (!reportWindow) {
      setStatus("Janela bloqueada", "Permita pop-ups para gerar o PDF.");
      return;
    }

    reportWindow.document.open();
    reportWindow.document.write(template.buildStelecomReport(visit, visit.reportType).replace('./styles.css', new URL('./styles.css', location.href).href));
    reportWindow.document.close();
    reportWindow.document.title = template.buildFilename(visit, visit.reportType);
    waitForReportImages(reportWindow).then(() => {
      reportWindow.focus();
      reportWindow.print();
    });
    setStatus("PDF preparado", `Use Salvar como PDF com o nome ${template.buildFilename(visit, visit.reportType)}.`);
  }

  nodes.date.addEventListener("input", () => {
    state.date = template.normalizeDate(nodes.date.value);
    nodes.date.value = state.date;
  });
  nodes.city.addEventListener("input", () => {
    state.city = nodes.city.value;
  });
  nodes.workType.addEventListener("change", () => {
    state.workType = template.normalizeWorkType(nodes.workType.value);
    nodes.workType.value = state.workType;
  });
  nodes.reportType.addEventListener("change", () => {
    state.reportType = template.normalizeReportType(nodes.reportType.value);
    nodes.reportType.value = state.reportType;
  });
  nodes.city.value = state.city;
  nodes.workType.value = state.workType;
  nodes.reportType.value = state.reportType;
  nodes.generate.addEventListener("click", generatePdf);
  render();

  window.StelecomApp = {
    getState: () => visitPayload(),
    generatePdf
  };
})();
