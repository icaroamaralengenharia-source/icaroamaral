const list = document.getElementById("posts-list");
const updated = document.getElementById("updated-label");
const year = document.getElementById("ano-atual");

function safeText(value) {
  return String(value || "").trim();
}

function safeRelativePostUrl(slug) {
  const clean = safeText(slug);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean) ? `./posts/${clean}/` : "#";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

function createPostCard(post) {
  const article = document.createElement("article");
  article.className = "post-card";

  const cover = document.createElement("a");
  cover.className = "post-cover";
  cover.href = safeRelativePostUrl(post.slug);
  const img = document.createElement("img");
  img.src = safeText(post.imagem || "./assets/editorial-fallback.jpg");
  img.alt = safeText(post.imagemAlt || post.titulo || "Imagem editorial");
  img.loading = "lazy";
  img.decoding = "async";
  cover.append(img);
  article.append(cover);

  const body = document.createElement("div");
  body.className = "post-body";
  const meta = document.createElement("div");
  meta.className = "post-meta";
  const category = document.createElement("span");
  category.className = "pill";
  category.textContent = safeText(post.categoria || "Editorial");
  const date = document.createElement("span");
  date.textContent = formatDate(post.publicadoEm || post.criadoEm);
  meta.append(category, date);

  const title = document.createElement("h2");
  title.textContent = safeText(post.titulo || "Publicação sem título");
  const summary = document.createElement("p");
  summary.textContent = safeText(post.resumo || "Resumo indisponível.");
  const link = document.createElement("a");
  link.className = "post-link";
  link.href = safeRelativePostUrl(post.slug);
  link.textContent = "Leia mais";

  body.append(meta, title, summary, link);
  article.append(body);
  return article;
}

async function loadPosts() {
  try {
    const response = await fetch("./dados/posts.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const posts = Array.isArray(payload.posts) ? payload.posts : [];
    list.setAttribute("aria-busy", "false");
    updated.textContent = payload.atualizadoEm ? `Atualizado em ${formatDate(payload.atualizadoEm)}` : "Publicações em preparação";
    if (!posts.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Nenhuma publicação editorial foi liberada ainda.";
      list.replaceChildren(empty);
      return;
    }
    list.replaceChildren(...posts.map(createPostCard));
  } catch {
    list.setAttribute("aria-busy", "false");
    updated.textContent = "Não foi possível carregar as publicações.";
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Tente novamente em instantes.";
    list.replaceChildren(empty);
  }
}

if (year) year.textContent = String(new Date().getFullYear());
if (list) loadPosts();
