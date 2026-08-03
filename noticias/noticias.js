const TECH_NOTE = "Conteúdo informativo. A aplicação em obra ou projeto deve considerar normas vigentes, condições locais e responsabilidade técnica.";

const state = {
  activeTab: "dicas",
  dicas: [],
  noticias: [],
  oportunidades: [],
  filters: {
    dicas: { busca: "", categoria: "", nivel: "", buscaAberta: false },
    noticias: { busca: "", categoria: "", buscaAberta: false },
    oportunidades: { busca: "", tipo: "", estado: "", modalidade: "", prazo: "", buscaAberta: false },
  },
};

const elements = {
  updatedAt: document.getElementById("ultima-atualizacao"),
  total: document.getElementById("total-conteudos"),
  year: document.getElementById("ano-atual"),
  tabs: Array.from(document.querySelectorAll("[role='tab'][data-tab]")),
  panels: Array.from(document.querySelectorAll("[role='tabpanel'][data-panel]")),
  dicas: {
    list: document.getElementById("lista-dicas"), status: document.getElementById("estado-dicas"), results: document.getElementById("resumo-dicas"),
    search: document.getElementById("busca-dicas"), toggle: document.getElementById("alternar-busca-dicas"), tools: document.querySelector("[data-tools='dicas']"),
    category: document.getElementById("filtro-categoria-dicas"), level: document.getElementById("filtro-nivel-dicas"), clear: document.getElementById("limpar-filtros-dicas"),
  },
  noticias: {
    list: document.getElementById("lista-noticias"), status: document.getElementById("estado-noticias"), results: document.getElementById("resumo-noticias"),
    search: document.getElementById("busca-noticias"), toggle: document.getElementById("alternar-busca-noticias"), tools: document.querySelector("[data-tools='noticias']"),
    category: document.getElementById("filtro-categoria-noticias"), clear: document.getElementById("limpar-filtros-noticias"),
  },
  oportunidades: {
    list: document.getElementById("lista-oportunidades"), status: document.getElementById("estado-oportunidades"), results: document.getElementById("resumo-oportunidades"),
    search: document.getElementById("busca-oportunidades"), toggle: document.getElementById("alternar-busca-oportunidades"), tools: document.querySelector("[data-tools='oportunidades']"),
    type: document.getElementById("filtro-tipo-oportunidades"), state: document.getElementById("filtro-estado-oportunidades"), mode: document.getElementById("filtro-modalidade-oportunidades"), deadline: document.getElementById("filtro-prazo-oportunidades"), clear: document.getElementById("limpar-filtros-oportunidades"),
  },
};

function normalizeText(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function isSafeImageUrl(value) {
  if (!isSafeHttpUrl(value)) return false;
  const pathname = new URL(value).pathname.toLocaleLowerCase("pt-BR");
  return !pathname.endsWith(".svg") && !pathname.endsWith(".svgz");
}

function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || "";
  parent.append(node);
  return node;
}

function appendPill(parent, text, extraClass) {
  if (!text) return null;
  const pill = appendText(parent, "span", text, extraClass ? `pill ${extraClass}` : "pill");
  return pill;
}

function fillSelect(select, values, defaultLabel) {
  if (!select) return;
  const option = document.createElement("option");
  option.value = "";
  option.textContent = defaultLabel;
  select.replaceChildren(option);
  values.filter(Boolean).sort().forEach((value) => {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = value;
    select.append(item);
  });
}

function updateSearchDisclosure(key) {
  const controls = elements[key];
  const filters = state.filters[key];
  if (!controls.tools || !controls.toggle) return;
  const open = filters.buscaAberta || Boolean(filters.busca.trim());
  controls.tools.classList.toggle("is-search-open", open);
  controls.toggle.setAttribute("aria-expanded", String(open));
}

function setTab(tabName, updateHash = true) {
  const allowed = ["dicas", "noticias", "oportunidades"];
  const safeTab = allowed.includes(tabName) ? tabName : "dicas";
  state.activeTab = safeTab;
  elements.tabs.forEach((tab) => {
    const active = tab.dataset.tab === safeTab;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  elements.panels.forEach((panel) => { panel.hidden = panel.dataset.panel !== safeTab; });
  if (updateHash && window.location.hash !== `#${safeTab}`) window.history.replaceState(null, "", `#${safeTab}`);
}

function setupTabs() {
  elements.tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => setTab(tab.dataset.tab || "dicas"));
    tab.addEventListener("keydown", (event) => {
      const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      let nextIndex = index;
      if (event.key === "ArrowRight") nextIndex = (index + 1) % elements.tabs.length;
      if (event.key === "ArrowLeft") nextIndex = (index - 1 + elements.tabs.length) % elements.tabs.length;
      if (event.key === "Home") nextIndex = 0;
      if (event.key === "End") nextIndex = elements.tabs.length - 1;
      elements.tabs[nextIndex].focus();
      setTab(elements.tabs[nextIndex].dataset.tab || "dicas");
    });
  });
  window.addEventListener("hashchange", () => setTab(window.location.hash.replace("#", ""), false));
  setTab(window.location.hash.replace("#", "") || "dicas", false);
  if (!window.location.hash) window.history.replaceState(null, "", "#dicas");
}

function createImageCredit(item) {
  const creditText = String(item.imagemCredito || (item.imagemOrigem ? `Imagem: ${item.imagemOrigem}` : "")).trim();
  if (!creditText) return null;
  if (isSafeHttpUrl(item.fonteUrl)) {
    const link = document.createElement("a");
    link.className = "image-credit";
    link.href = item.fonteUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.textContent = creditText;
    return link;
  }
  const credit = document.createElement("span");
  credit.className = "image-credit";
  credit.textContent = creditText;
  return credit;
}

function createCover(item, label) {
  const cover = document.createElement("div");
  cover.className = "card-cover";
  if (isSafeImageUrl(item.imagemUrl)) {
    cover.classList.add("has-real-image");
    const image = document.createElement("img");
    image.src = item.imagemUrl;
    const alt = String(item.imagemAlt || item.titulo || label || "Imagem da dica").trim();
    image.alt = isSafeHttpUrl(alt) ? String(item.titulo || label || "Imagem da dica") : alt;
    image.loading = "lazy";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";
    const credit = createImageCredit(item);
    image.addEventListener("error", () => {
      image.remove();
      if (credit) credit.remove();
      cover.classList.remove("has-real-image");
    });
    cover.append(image);
    if (credit) cover.append(credit);
  }
  appendText(cover, "span", label || "Conteúdo", "cover-label");
  return cover;
}

function readingTime(text) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 180))} min`;
}

function createBaseCard(item, index, label) {
  const card = document.createElement("article");
  card.className = "content-card";
  if (index === 0) {
    card.classList.add("featured");
    appendText(card, "span", "Destaque", "featured-badge");
  }
  card.append(createCover(item, label));
  const body = document.createElement("div");
  body.className = "card-body";
  card.append(body);
  return { card, body };
}

function createTipCard(item, index) {
  const built = createBaseCard(item, index, item.categoria || "Dica");
  built.card.classList.add("tip-card");
  const body = built.body;
  const row = document.createElement("div");
  row.className = "card-row";
  appendPill(row, item.categoria || "Dica");
  appendPill(row, item.nivel || "Geral", "warning");
  appendPill(row, readingTime(item.conteudo || item.resumo));
  body.append(row);
  appendText(body, "h3", item.titulo || "Dica sem título");
  appendText(body, "p", item.resumo || "Resumo não informado.");
  const tags = document.createElement("div");
  tags.className = "card-row";
  (Array.isArray(item.tags) ? item.tags : []).slice(0, 4).forEach((tag) => appendPill(tags, tag));
  body.append(tags);
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-action";
  button.textContent = "Ler dica";
  const details = document.createElement("div");
  details.className = "tip-details";
  details.hidden = true;
  details.tabIndex = -1;
  appendText(details, "p", item.conteudo || item.resumo || "Conteúdo em revisão.");
  appendText(details, "p", item.avisoTecnico || TECH_NOTE, "tech-note");
  button.addEventListener("click", () => {
    const open = details.hidden;
    details.hidden = !open;
    button.textContent = open ? "Fechar dica" : "Ler dica";
    if (open) details.focus(); else button.focus();
  });
  details.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    details.hidden = true;
    button.textContent = "Ler dica";
    button.focus();
  });
  body.append(button);
  body.append(appendText(document.createElement("div"), "p", item.avisoTecnico || TECH_NOTE, "tech-note"));
  built.card.append(details);
  return built.card;
}

function createNewsCard(item, index) {
  const built = createBaseCard(item, index, item.categoria || "Notícia");
  const body = built.body;
  appendPill(body, item.categoria || "Geral");
  appendText(body, "h3", item.titulo || "Notícia sem título");
  appendText(body, "p", item.resumo || "Resumo não informado.");
  const meta = document.createElement("div");
  meta.className = "card-meta";
  appendText(meta, "span", item.fonte || "Fonte");
  appendText(meta, "span", "•");
  appendText(meta, "span", formatDate(item.publicadoEm));
  body.append(meta);
  if (isSafeHttpUrl(item.url)) {
    const link = document.createElement("a");
    link.className = "card-action";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.textContent = "Ler na fonte";
    body.append(link);
  } else {
    appendText(body, "span", "Fonte indisponível", "pill danger");
  }
  return built.card;
}

function createOpportunityCard(item, index) {
  const built = createBaseCard(item, index, item.tipo || "Oportunidade");
  const body = built.body;
  const row = document.createElement("div");
  row.className = "card-row";
  appendPill(row, item.tipo || "Oportunidade");
  appendPill(row, item.status || "validada", item.status === "encerrada" ? "danger" : "warning");
  body.append(row);
  appendText(body, "h3", item.titulo || "Oportunidade sem título");
  appendText(body, "p", item.resumo || "Resumo não informado.");
  const meta = document.createElement("div");
  meta.className = "card-meta";
  appendText(meta, "span", item.organizacao || "Organização não informada");
  appendText(meta, "span", [item.cidade, item.estado].filter(Boolean).join("/") || "Local não informado");
  appendText(meta, "span", item.modalidade || "Modalidade não informada");
  appendText(meta, "span", item.dataLimite ? `Prazo: ${formatDate(item.dataLimite)}` : "Prazo não informado");
  if (item.remuneracao) appendText(meta, "span", `Remuneração: ${item.remuneracao}`);
  if (item.valorEstimado) appendText(meta, "span", `Valor: ${item.valorEstimado}`);
  body.append(meta);
  const tags = document.createElement("div");
  tags.className = "card-row";
  (Array.isArray(item.tags) ? item.tags : []).slice(0, 4).forEach((tag) => appendPill(tags, tag));
  body.append(tags);
  if (isSafeHttpUrl(item.oportunidadeUrl || item.fonteUrl)) {
    const link = document.createElement("a");
    link.className = "card-action";
    link.href = item.oportunidadeUrl || item.fonteUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.textContent = "Abrir oportunidade";
    body.append(link);
  }
  return built.card;
}

function renderEmpty(list, message) {
  const empty = document.createElement("div");
  empty.className = "status-message";
  appendText(empty, "p", message);
  list.replaceChildren(empty);
}

function renderDicas() {
  const controls = elements.dicas;
  const filters = state.filters.dicas;
  const reviewed = state.dicas.filter((item) => item && item.revisadoManualmente === true);
  const search = normalizeText(filters.busca);
  const filtered = reviewed.filter((item) => {
    const text = normalizeText([item.titulo, item.resumo, item.conteudo, item.categoria, ...(item.tags || [])].join(" "));
    return (!filters.categoria || item.categoria === filters.categoria) && (!filters.nivel || item.nivel === filters.nivel) && (!search || text.includes(search));
  });
  controls.results.textContent = `Exibindo ${filtered.length} de ${reviewed.length} dicas`;
  controls.clear.disabled = !filters.busca && !filters.categoria && !filters.nivel;
  controls.list.setAttribute("aria-busy", "false");
  controls.status.textContent = "";
  updateSearchDisclosure("dicas");
  if (!filtered.length) return renderEmpty(controls.list, reviewed.length ? "Nenhuma dica encontrada com os filtros selecionados." : "Nenhuma dica revisada foi publicada ainda.");
  controls.list.replaceChildren(...filtered.map(createTipCard));
}

function renderNoticias() {
  const controls = elements.noticias;
  const filters = state.filters.noticias;
  const search = normalizeText(filters.busca);
  const filtered = state.noticias.filter((item) => {
    const text = normalizeText([item.titulo, item.resumo, item.fonte, item.categoria].join(" "));
    return (!filters.categoria || item.categoria === filters.categoria) && (!search || text.includes(search));
  });
  controls.results.textContent = `Exibindo ${filtered.length} de ${state.noticias.length} notícias`;
  controls.clear.disabled = !filters.busca && !filters.categoria;
  controls.list.setAttribute("aria-busy", "false");
  controls.status.textContent = "";
  updateSearchDisclosure("noticias");
  if (!filtered.length) return renderEmpty(controls.list, state.noticias.length ? "Nenhuma notícia encontrada com os filtros selecionados." : "Nenhuma notícia disponível no momento.");
  controls.list.replaceChildren(...filtered.map(createNewsCard));
}

function opportunityOpen(item) {
  if (normalizeText(item.status) === "encerrada") return false;
  if (!item.dataLimite) return true;
  const deadline = new Date(item.dataLimite);
  if (Number.isNaN(deadline.getTime())) return true;
  return deadline.getTime() >= Date.now();
}

function renderOportunidades() {
  const controls = elements.oportunidades;
  const filters = state.filters.oportunidades;
  const openItems = state.oportunidades.filter(opportunityOpen);
  const search = normalizeText(filters.busca);
  const filtered = openItems.filter((item) => {
    const text = normalizeText([item.titulo, item.organizacao, item.tipo, item.resumo, item.cidade, item.estado, item.modalidade, ...(item.tags || [])].join(" "));
    const prazoOk = !filters.prazo || (filters.prazo === "abertas" && opportunityOpen(item)) || (filters.prazo === "sem-prazo" && !item.dataLimite);
    return (!filters.tipo || item.tipo === filters.tipo) && (!filters.estado || item.estado === filters.estado) && (!filters.modalidade || item.modalidade === filters.modalidade) && prazoOk && (!search || text.includes(search));
  });
  controls.results.textContent = `Exibindo ${filtered.length} de ${openItems.length} oportunidades`;
  controls.clear.disabled = !filters.busca && !filters.tipo && !filters.estado && !filters.modalidade && !filters.prazo;
  controls.list.setAttribute("aria-busy", "false");
  controls.status.textContent = "";
  updateSearchDisclosure("oportunidades");
  if (!filtered.length) return renderEmpty(controls.list, "Nenhuma oportunidade validada foi encontrada no momento.");
  controls.list.replaceChildren(...filtered.slice(0, 3).map((item, index) => createOpportunityCard(item, index)).concat(filtered.slice(3).map((item, index) => createOpportunityCard(item, index + 3))));
}

function renderTotals() {
  const reviewed = state.dicas.filter((item) => item && item.revisadoManualmente === true).length;
  const openOpps = state.oportunidades.filter(opportunityOpen).length;
  const total = reviewed + state.noticias.length + openOpps;
  elements.total.textContent = String(total);
}

async function fetchJson(path, fallback) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json().catch(() => fallback);
}

async function loadDicas() {
  try {
    const payload = await fetchJson("./dados/dicas.json", { dicas: [] });
    state.dicas = Array.isArray(payload.dicas) ? payload.dicas : [];
    fillSelect(elements.dicas.category, [...new Set(state.dicas.map((item) => item.categoria))], "Todas");
    fillSelect(elements.dicas.level, [...new Set(state.dicas.map((item) => item.nivel))], "Todos");
  } catch {
    state.dicas = [];
    elements.dicas.status.textContent = "Não foi possível carregar as dicas agora.";
  } finally {
    renderDicas();
    renderTotals();
  }
}

async function loadNoticias() {
  try {
    const payload = await fetchJson("./dados/noticias.json", { noticias: [] });
    state.noticias = Array.isArray(payload.noticias) ? payload.noticias : [];
    elements.updatedAt.textContent = formatDate(payload.atualizadoEm);
    fillSelect(elements.noticias.category, [...new Set(state.noticias.map((item) => item.categoria))], "Todas");
  } catch {
    state.noticias = [];
    elements.updatedAt.textContent = "Indisponível";
    elements.noticias.status.textContent = "Não foi possível carregar as notícias agora.";
  } finally {
    renderNoticias();
    renderTotals();
  }
}

async function loadOportunidades() {
  try {
    const payload = await fetchJson("./dados/oportunidades.json", { oportunidades: [] });
    state.oportunidades = Array.isArray(payload.oportunidades) ? payload.oportunidades : [];
    fillSelect(elements.oportunidades.type, [...new Set(state.oportunidades.map((item) => item.tipo))], "Todos");
    fillSelect(elements.oportunidades.state, [...new Set(state.oportunidades.map((item) => item.estado))], "UF");
    fillSelect(elements.oportunidades.mode, [...new Set(state.oportunidades.map((item) => item.modalidade))], "Modalidade");
  } catch {
    state.oportunidades = [];
    elements.oportunidades.status.textContent = "Não foi possível carregar as oportunidades agora.";
  } finally {
    renderOportunidades();
    renderTotals();
  }
}

function setupFilters() {
  ["dicas", "noticias", "oportunidades"].forEach((key) => {
    const controls = elements[key];
    const filters = state.filters[key];
    if (controls.toggle) controls.toggle.addEventListener("click", () => {
      filters.buscaAberta = !(controls.tools && controls.tools.classList.contains("is-search-open"));
      updateSearchDisclosure(key);
      if (filters.buscaAberta && controls.search) controls.search.focus();
    });
    if (controls.search) controls.search.addEventListener("input", (event) => { filters.busca = event.target.value; filters.buscaAberta = Boolean(filters.busca); renderAll(); });
    if (controls.clear) controls.clear.addEventListener("click", () => { Object.keys(filters).forEach((name) => { filters[name] = name === "buscaAberta" ? false : ""; }); clearControlValues(controls); renderAll(); });
  });
  elements.dicas.category.addEventListener("change", (event) => { state.filters.dicas.categoria = event.target.value; renderDicas(); });
  elements.dicas.level.addEventListener("change", (event) => { state.filters.dicas.nivel = event.target.value; renderDicas(); });
  elements.noticias.category.addEventListener("change", (event) => { state.filters.noticias.categoria = event.target.value; renderNoticias(); });
  elements.oportunidades.type.addEventListener("change", (event) => { state.filters.oportunidades.tipo = event.target.value; renderOportunidades(); });
  elements.oportunidades.state.addEventListener("change", (event) => { state.filters.oportunidades.estado = event.target.value; renderOportunidades(); });
  elements.oportunidades.mode.addEventListener("change", (event) => { state.filters.oportunidades.modalidade = event.target.value; renderOportunidades(); });
  elements.oportunidades.deadline.addEventListener("change", (event) => { state.filters.oportunidades.prazo = event.target.value; renderOportunidades(); });
}

function clearControlValues(controls) {
  ["search", "category", "level", "type", "state", "mode", "deadline"].forEach((key) => { if (controls[key]) controls[key].value = ""; });
}

function renderAll() {
  renderDicas();
  renderNoticias();
  renderOportunidades();
}

if (elements.year) elements.year.textContent = String(new Date().getFullYear());
setupTabs();
setupFilters();
loadDicas();
loadNoticias();
loadOportunidades();