const state = {
  noticias: [],
  categoria: "",
  busca: "",
};

const elements = {
  updatedAt: document.getElementById("ultima-atualizacao"),
  total: document.getElementById("total-noticias"),
  results: document.getElementById("resumo-resultados"),
  list: document.getElementById("lista-noticias"),
  status: document.getElementById("estado-carregamento"),
  search: document.getElementById("busca-noticias"),
  category: document.getElementById("filtro-categoria"),
  clear: document.getElementById("limpar-filtros"),
  year: document.getElementById("ano-atual"),
};

const categoryClassMap = [
  { tokens: ["arquitetura", "patrimonio", "cau"], className: "categoria-arquitetura" },
  { tokens: ["engenharia", "obra", "saneamento"], className: "categoria-engenharia" },
  { tokens: ["urbanismo", "cidade", "habitacao"], className: "categoria-urbanismo" },
  { tokens: ["infraestrutura", "transporte", "rodovia"], className: "categoria-infraestrutura" },
  { tokens: ["tecnologia", "bim", "digital"], className: "categoria-tecnologia" },
  { tokens: ["construcao", "industria"], className: "categoria-construcao" },
  { tokens: ["conselho", "fiscalizacao", "institucional"], className: "categoria-institucional" },
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isSafeHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function getCategoryClass(category) {
  const normalized = normalizeText(category);
  const match = categoryClassMap.find((entry) => entry.tokens.some((token) => normalized.includes(token)));
  return match ? match.className : "categoria-geral";
}

function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || "";
  parent.append(node);
  return node;
}

function renderCategories() {
  const categories = [...new Set(state.noticias.map((item) => item.categoria).filter(Boolean))].sort();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Todas";
  elements.category.replaceChildren(defaultOption);

  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.append(option);
  }
}

function matchesFilters(item) {
  const search = normalizeText(state.busca.trim());
  const text = normalizeText([item.titulo, item.resumo, item.fonte, item.categoria].join(" "));
  return (!state.categoria || item.categoria === state.categoria) && (!search || text.includes(search));
}

function updateFilterState(filteredCount) {
  const totalCount = state.noticias.length;
  const hasActiveFilter = Boolean(state.busca.trim() || state.categoria);
  elements.total.textContent = String(totalCount);
  elements.results.textContent = `Exibindo ${filteredCount} de ${totalCount} notícias`;
  elements.clear.disabled = !hasActiveFilter;
}

function renderEmptyState(message, showClearButton) {
  const container = document.createElement("div");
  container.className = "status-message";
  appendText(container, "p", message);

  if (showClearButton) {
    const button = document.createElement("button");
    button.className = "clear-button empty-action";
    button.type = "button";
    button.textContent = "Limpar filtros";
    button.addEventListener("click", clearFilters);
    container.append(button);
  }

  elements.list.replaceChildren(container);
}

function createCover(item) {
  const cover = document.createElement("div");
  cover.className = "card-cover";
  appendText(cover, "span", item.categoria || "Geral", "cover-label");
  return cover;
}

function createMeta(item) {
  const meta = document.createElement("div");
  meta.className = "card-meta";

  const source = document.createElement("span");
  const sourceStrong = appendText(source, "strong", item.fonte || "Fonte");
  sourceStrong.setAttribute("aria-label", `Fonte: ${sourceStrong.textContent}`);
  meta.append(source);

  const separator = document.createElement("span");
  separator.textContent = "•";
  separator.setAttribute("aria-hidden", "true");
  meta.append(separator);

  appendText(meta, "span", formatDate(item.publicadoEm));
  return meta;
}

function createSourceLink(item) {
  if (!isSafeHttpUrl(item.url)) {
    return appendText(document.createElement("span"), "span", "Fonte indisponível", "invalid-source");
  }

  const link = document.createElement("a");
  link.href = item.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer external";
  link.textContent = "Ler na fonte";
  link.setAttribute("aria-label", `Ler na fonte: ${item.titulo || "notícia"}`);
  return link;
}

function createCard(item, index) {
  const card = document.createElement("article");
  card.className = `news-card ${getCategoryClass(item.categoria)}`;
  if (index === 0) card.classList.add("featured");

  if (index === 0) {
    appendText(card, "span", "Destaque", "featured-badge");
  }

  card.append(createCover(item));

  const body = document.createElement("div");
  body.className = "card-body";
  appendText(body, "span", item.categoria || "Geral", "category-pill");

  const title = appendText(body, "h2", item.titulo || "Notícia sem título");
  title.title = item.titulo || "Notícia sem título";

  appendText(body, "p", item.resumo || "Resumo não informado.");
  body.append(createMeta(item));
  body.append(createSourceLink(item));

  card.append(body);
  return card;
}

function renderList() {
  const filtered = state.noticias.filter(matchesFilters);
  updateFilterState(filtered.length);
  elements.list.setAttribute("aria-busy", "false");

  if (filtered.length === 0) {
    elements.status.textContent = "";
    const message = state.noticias.length === 0
      ? "Nenhuma notícia disponível no momento."
      : "Nenhuma notícia encontrada com os filtros selecionados.";
    renderEmptyState(message, state.noticias.length > 0);
    return;
  }

  elements.status.textContent = "";
  const cards = filtered.map((item, index) => createCard(item, index));
  elements.list.replaceChildren(...cards);
}

function clearFilters() {
  state.busca = "";
  state.categoria = "";
  elements.search.value = "";
  elements.category.value = "";
  renderList();
}

async function loadNews() {
  elements.list.setAttribute("aria-busy", "true");

  try {
    const response = await fetch("./dados/noticias.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    state.noticias = Array.isArray(payload.noticias) ? payload.noticias : [];
    elements.updatedAt.textContent = formatDate(payload.atualizadoEm);
    renderCategories();
    renderList();
  } catch (error) {
    state.noticias = [];
    elements.updatedAt.textContent = "Indisponível";
    elements.total.textContent = "0";
    elements.results.textContent = "Exibindo 0 de 0 notícias";
    elements.list.setAttribute("aria-busy", "false");
    elements.status.textContent = "Não foi possível carregar as notícias agora. Tente novamente mais tarde.";
    elements.list.replaceChildren();
  }
}

if (elements.year) {
  elements.year.textContent = String(new Date().getFullYear());
}

elements.search.addEventListener("input", (event) => {
  state.busca = event.target.value;
  renderList();
});

elements.category.addEventListener("change", (event) => {
  state.categoria = event.target.value;
  renderList();
});

elements.clear.addEventListener("click", clearFilters);

loadNews();
