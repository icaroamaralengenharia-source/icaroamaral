const state = {
  noticias: [],
  categoria: "",
  busca: "",
};

const elements = {
  updatedAt: document.getElementById("ultima-atualizacao"),
  total: document.getElementById("total-noticias"),
  list: document.getElementById("lista-noticias"),
  status: document.getElementById("estado-carregamento"),
  search: document.getElementById("busca-noticias"),
  category: document.getElementById("filtro-categoria"),
};

function formatDate(value) {
  if (!value) return "Não informado";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function appendText(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text || "";
  parent.appendChild(node);
  return node;
}

function renderCategories() {
  const categories = [...new Set(state.noticias.map((item) => item.categoria).filter(Boolean))].sort();
  for (const category of categories) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.category.appendChild(option);
  }
}

function matchesFilters(item) {
  const search = state.busca.trim().toLocaleLowerCase("pt-BR");
  const text = [item.titulo, item.resumo, item.fonte, item.categoria]
    .join(" ")
    .toLocaleLowerCase("pt-BR");
  return (!state.categoria || item.categoria === state.categoria) && (!search || text.includes(search));
}

function renderList() {
  elements.list.replaceChildren();
  const filtered = state.noticias.filter(matchesFilters);
  elements.total.textContent = String(filtered.length);

  if (filtered.length === 0) {
    elements.status.textContent = state.noticias.length === 0
      ? "Nenhuma notícia disponível no momento."
      : "Nenhuma notícia encontrada para os filtros atuais.";
    return;
  }

  elements.status.textContent = "";
  for (const item of filtered) {
    const card = document.createElement("article");
    card.className = "news-card";
    appendText(card, "h2", item.titulo);
    appendText(card, "p", item.resumo);

    const meta = document.createElement("div");
    meta.className = "card-meta";
    appendText(meta, "span", item.fonte);
    appendText(meta, "span", formatDate(item.publicadoEm));
    appendText(meta, "span", item.categoria || "Geral");
    card.appendChild(meta);

    const link = document.createElement("a");
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer external";
    link.textContent = "Ler na fonte";
    card.appendChild(link);
    elements.list.appendChild(card);
  }
}

async function loadNews() {
  try {
    const response = await fetch("./dados/noticias.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    state.noticias = Array.isArray(payload.noticias) ? payload.noticias : [];
    elements.updatedAt.textContent = formatDate(payload.atualizadoEm);
    renderCategories();
    renderList();
  } catch (error) {
    elements.updatedAt.textContent = "Indisponível";
    elements.total.textContent = "0";
    elements.status.textContent = "Não foi possível carregar as notícias agora. Tente novamente mais tarde.";
  }
}

elements.search.addEventListener("input", (event) => {
  state.busca = event.target.value;
  renderList();
});

elements.category.addEventListener("change", (event) => {
  state.categoria = event.target.value;
  renderList();
});

loadNews();
