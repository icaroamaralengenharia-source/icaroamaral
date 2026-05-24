(function () {
  "use strict";

  const config = window.RELATORIO_QUALIDADE_CONFIG || {};
  const form = document.getElementById("qualityReportForm");
  const inconformidadesContainer = document.getElementById("inconformidades");
  const log = document.getElementById("formLog");
  const submitButton = document.getElementById("submitButton");
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const maxInconformidades = config.maxInconformidades || 20;

  const todayInput = document.querySelector("[name='dataVistoria']");
  if (todayInput) {
    todayInput.valueAsDate = new Date();
  }

  renderInconformidadeFields();

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    try {
      setBusy(true);
      setLog("Preparando dados e convertendo imagens em Base64...");

      if (!config.appsScriptUrl || config.appsScriptUrl.includes("COLE_AQUI")) {
        throw new Error("Configure a URL do Web App em frontend/relatorio-config.js.");
      }

      const formData = new FormData(form);
      const inconformidades = [];

      for (let index = 1; index <= maxInconformidades; index += 1) {
        const number = String(index).padStart(2, "0");
        const photoInput = form.querySelector("[name='fotoInconformidade" + number + "']");
        const file = photoInput && photoInput.files ? photoInput.files[0] : null;
        const descricao = clean(formData.get("descricaoInconformidade" + number));
        const solucao = clean(formData.get("solucaoInconformidade" + number));

        if (!file && !descricao && !solucao) {
          continue;
        }

        if (!file) {
          throw new Error("Anexe a foto da Inconformidade " + number + ".");
        }

        if (!descricao || !solucao) {
          throw new Error("Preencha descrição técnica e solução recomendada da Inconformidade " + number + ".");
        }

        if (!allowedTypes.has(file.type)) {
          throw new Error("Arquivo não permitido na Inconformidade " + number + ". Use PNG, JPG ou WEBP.");
        }

        const photo = await imageFileToOptimizedBase64(file, number);
        inconformidades.push({
          numero: number,
          descricaoTecnica: descricao,
          solucaoRecomendada: solucao,
          foto: photo
        });
      }

      if (!inconformidades.length) {
        throw new Error("Preencha pelo menos uma inconformidade com foto, descrição técnica e solução recomendada.");
      }

      const payload = {
        submittedAt: new Date().toISOString(),
        source: window.location.href,
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

  function clean(value) {
    return String(value || "").trim();
  }

  function setBusy(isBusy) {
    submitButton.disabled = isBusy;
    submitButton.textContent = isBusy ? "Enviando..." : "Enviar Relatório";
  }

  function setLog(message, kind) {
    log.textContent = message;
    log.className = "form-log" + (kind ? " " + kind : "");
  }

  function renderInconformidadeFields() {
    const fragment = document.createDocumentFragment();

    for (let index = 1; index <= maxInconformidades; index += 1) {
      const number = String(index).padStart(2, "0");
      const section = document.createElement("section");
      section.className = "nonconformity-card";

      section.appendChild(createTitle("RQO " + number + " — INCONFORMIDADE"));
      section.appendChild(createFileField("Foto da Inconformidade " + number, "fotoInconformidade" + number));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Descrição Técnica", "descricaoInconformidade" + number));
      section.appendChild(createTextAreaField("Inconformidade " + number + " - Solução Recomendada", "solucaoInconformidade" + number));

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

  function createTextAreaField(labelText, name) {
    const label = document.createElement("label");
    const textarea = document.createElement("textarea");

    textarea.name = name;
    textarea.rows = 4;

    label.appendChild(document.createTextNode(labelText));
    label.appendChild(textarea);
    return label;
  }

  function imageFileToOptimizedBase64(file, number) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();

      reader.onerror = function () {
        reject(new Error("Não foi possível ler a imagem: " + file.name));
      };

      reader.onload = function () {
        const image = new Image();

        image.onerror = function () {
          reject(new Error("Imagem inválida na Inconformidade " + number + ": " + file.name));
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
            fileName: safeFileName("RQO-" + number + "-" + file.name.replace(/\.[^.]+$/, "") + ".jpg"),
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
