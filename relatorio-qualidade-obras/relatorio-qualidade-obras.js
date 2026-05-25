(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};
  const form = document.getElementById("qualityReportForm");
  const fotosUnidadeContainer = document.getElementById("fotosUnidade");
  const inconformidadesContainer = document.getElementById("inconformidades");
  const log = document.getElementById("formLog");
  const submitButton = document.getElementById("submitButton");
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxFotosUnidade = config.maxFotosUnidade || 20;
  const maxInconformidades = config.maxInconformidades || 20;

  const todayInput = document.querySelector("[name='dataVistoria']");
  if (todayInput) {
    todayInput.valueAsDate = new Date();
  }

  renderFotoUnidadeFields();
  renderInconformidadeFields();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
      setBusy(true);
      setLog("Preparando dados e convertendo imagens em Base64...");

      if (!config.appsScriptUrl || config.appsScriptUrl.includes("COLE_AQUI")) {
        throw new Error("Configure a URL do Web App em relatorio-config.js.");
      }

      const formData = new FormData(form);
      const fotosUnidade = await collectFotosUnidade_(formData);
      const inconformidades = await collectInconformidades_(formData);

      if (!fotosUnidade.length && !inconformidades.length) {
        throw new Error("Envie pelo menos uma foto da unidade ou uma inconformidade.");
      }

      const payload = {
        submittedAt: new Date().toISOString(),
        source: window.location.href,
        tipoRelatorio: "fiscalizacao",
        report: {
          obra: clean(formData.get("obra")),
          dataVistoria: clean(formData.get("dataVistoria")),
          responsavelTecnico: clean(formData.get("responsavelTecnico")),
          local: clean(formData.get("local")),
          dataInicioObra: clean(formData.get("dataInicioObra")),
          linkCameras: clean(formData.get("linkCameras")),
          tipoObra: clean(formData.get("tipoObra")),
          avancoFisico: clean(formData.get("avancoFisico")),
          avancoFinanceiro: clean(formData.get("avancoFinanceiro")),
          funcionariosCampo: clean(formData.get("funcionariosCampo")),
          utilizacaoEpi: clean(formData.get("utilizacaoEpi")),
          controleConcreto: clean(formData.get("controleConcreto")),
          observacoes: clean(formData.get("observacoes")),
          emailDestino: clean(formData.get("emailDestino"))
        },
        fotosUnidade: fotosUnidade,
        inconformidades: inconformidades
      };

      setLog("Enviando relatório para o Google Apps Script...");

      const response = await fetch(config.appsScriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      let result;

      try {
        result = JSON.parse(text);
      } catch (error) {
        throw new Error("Resposta inválida do Apps Script: " + text.slice(0, 180));
      }

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Falha ao gerar relatório.");
      }

      setLog("Relatório enviado com sucesso. PDF: " + result.pdfUrl, "success");

      form.reset();

      if (todayInput) {
        todayInput.valueAsDate = new Date();
      }
    } catch (error) {
      console.error(error);
      setLog(error.message || "Erro inesperado ao enviar relatório.", "error");
    } finally {
      setBusy(false);
    }
  });

  async function collectFotosUnidade_(formData) {
    const fotos = [];

    for (let index = 1; index <= maxFotosUnidade; index += 1) {
      const number = String(index).padStart(2, "0");
      const photoInput = form.querySelector("[name='fotoUnidade" + number + "']");
      const file = photoInput && photoInput.files ? photoInput.files[0] : null;
      const descricao = clean(formData.get("descricaoFotoUnidade" + number));

      if (!file && !descricao) {
        continue;
      }

      if (!file) {
        throw new Error("Anexe a Foto da Unidade " + number + ".");
      }

      if (!descricao) {
        throw new Error("Preencha a descrição da Foto da Unidade " + number + ".");
      }

      validateImageFile_(file, "Foto da Unidade " + number);

      fotos.push({
        numero: number,
        descricao: descricao,
        foto: await imageFileToOptimizedBase64(file, "UNIDADE-" + number)
      });
    }

    return fotos;
  }

  async function collectInconformidades_(formData) {
    const inconformidades = [];

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const photoInput = form.querySelector("[name='fotoInconformidade" + number + "']");
      const file = photoInput && photoInput.files ? photoInput.files[0] : null;
      const descricao = clean(formData.get("descricaoInconformidade" + number));
      const solucao = clean(formData.get("solucaoInconformidade" + number));
      const grauRisco = clean(formData.get("grauRisco" + number));

      if (!file && !descricao && !solucao && !grauRisco) {
        continue;
      }

      if (!file) {
        throw new Error("Anexe a foto da Inconformidade " + number + ".");
      }

      if (!descricao || !solucao || !grauRisco) {
        throw new Error("Preencha descrição, solução e grau de risco da Inconformidade " + number + ".");
      }

      validateImageFile_(file, "Inconformidade " + number);

      inconformidades.push({
        numero: number,
        descricaoTecnica: descricao,
        solucaoRecomendada: solucao,
        grauRisco: grauRisco,
        foto: await imageFileToOptimizedBase64(file, "RQO-" + number)
      });
    }

    return inconformidades;
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function validateImageFile_(file, label) {
    if (!allowedTypes.has(file.type)) {
      throw new Error("Arquivo não permitido em " + label + ". Use PNG, JPG ou WEBP.");
    }
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "Enviando..." : "Enviar Relatório";
  }

  function setLog(message, kind) {
    log.textContent = message;
    log.className = "form-log" + (kind ? " " + kind : "");
  }

  function renderFotoUnidadeFields() {
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= maxFotosUnidade; index += 1) {
      const number = String(index).padStart(2, "0");
      const section = document.createElement("section");
      section.className = "nonconformity-card";

      section.appendChild(createTitle("Foto da Unidade " + number));
      section.appendChild(createFileField("Foto da Unidade " + number, "fotoUnidade" + number));
      section.appendChild(createTextAreaField("Descrição da Foto " + number, "descricaoFotoUnidade" + number, 3));

      fragment.appendChild(section);
    }

    fotosUnidadeContainer.innerHTML = "";
    fotosUnidadeContainer.appendChild(fragment);
  }

  function renderInconformidadeFields() {
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const section = document.createElement("section");
      section.className = "nonconformity-card";

      section.appendChild(createTitle("Inconformidade " + number));
      section.appendChild(createFileField("Foto da Inconformidade " + number, "fotoInconformidade" + number));
      section.appendChild(createRiskField("Grau de risco " + number, "grauRisco" + number));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Descrição Técnica", "descricaoInconformidade" + number, 4));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Solução Recomendada", "solucaoInconformidade" + number, 4));

      fragment.appendChild(section);
    }

    inconformidadesContainer.innerHTML = "";
    inconformidadesContainer.appendChild(fragment);
  }

  function createTitle(text) {
    const title = document.createElement("h3");
    title.textContent = text;
    return title;
  }

  function createFileField(labelText, name) {
    const label = document.createElement("label");
    const input = document.createElement("input");

    input.name = name;
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(input);

    return label;
  }

  function createRiskField(labelText, name) {
    const label = document.createElement("label");
    const select = document.createElement("select");

    const options = [
      ["", "Escolher"],
      ["Baixo - acompanhar", "Baixo - acompanhar"],
      ["Médio - corrigir com prioridade", "Médio - corrigir com prioridade"],
      ["Alto - corrigir imediatamente", "Alto - corrigir imediatamente"],
      ["Interdição - paralisar área", "Interdição - paralisar área"]
    ];

    select.name = name;

    options.forEach(function (option) {
      const item = document.createElement("option");
      item.value = option[0];
      item.textContent = option[1];
      select.appendChild(item);
    });

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(select);

    return label;
  }

  function createTextAreaField(labelText, name, rows) {
    const label = document.createElement("label");
    const textarea = document.createElement("textarea");

    textarea.name = name;
    textarea.rows = rows || 4;

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(textarea);

    return label;
  }

  function imageFileToOptimizedBase64(file, prefix) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("Não foi possível ler a imagem: " + file.name));
      };

      reader.onload = function () {
        const image = new Image();

        image.onerror = function () {
          reject(new Error("Imagem inválida: " + file.name));
        };

        image.onload = function () {
          const maxWidth = config.maxImageWidth || 1600;
          const ratio = Math.min(1, maxWidth / image.width);
          const canvas = document.createElement("canvas");

          canvas.width = Math.round(image.width * ratio);
          canvas.height = Math.round(image.height * ratio);

          const context = canvas.getContext("2d");
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          const mimeType = "image/jpeg";
          const dataUrl = canvas.toDataURL(mimeType, config.jpegQuality || 0.84);

          resolve({
            originalName: file.name,
            fileName: safeFileName(prefix + "-" + file.name.replace(/\.[^.]+$/, "") + ".jpg"),
            mimeType: mimeType,
            base64: dataUrl.split(",")[1],
            width: canvas.width,
            height: canvas.height
          });
        };

        image.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  function safeFileName(name) {
    return String(name || "foto.jpg")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90) || "foto.jpg";
  }
})();
