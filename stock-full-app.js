(function () {
  document.documentElement.classList.add("stock-full-app-document");
  document.body.classList.add("stock-full-app", "stock-full-context", "stock-full-profile-loja");
  if (!window.STOCK_FULL_PASSWORD_REDIRECT_URL) {
    window.STOCK_FULL_PASSWORD_REDIRECT_URL = window.location.origin + window.location.pathname;
  }
})();
