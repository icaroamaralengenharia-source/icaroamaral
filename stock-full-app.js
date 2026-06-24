(function () {
  if (!window.location.search || window.location.search.indexOf("produto=stock-full") < 0) {
    const separator = window.location.pathname.indexOf("?") >= 0 ? "&" : "?";
    const nextUrl = window.location.pathname + separator + "produto=stock-full&perfil=loja" + (window.location.hash || "");
    window.history.replaceState(null, "", nextUrl);
  }
  document.documentElement.classList.add("stock-full-app-document");
  document.body.classList.add("stock-full-app", "stock-full-context", "stock-full-profile-loja");
  if (!window.STOCK_FULL_PASSWORD_REDIRECT_URL) {
    window.STOCK_FULL_PASSWORD_REDIRECT_URL = window.location.origin + window.location.pathname;
  }
})();
