const config = window.SITE_CONFIG || {};

document.querySelectorAll("[data-price]").forEach((node) => {
  node.textContent = config.price || "R$9,90";
});

document.querySelectorAll("[data-checkout]").forEach((node) => {
  node.setAttribute("href", config.checkoutUrl || "https://www.icaroamaral.com.br/checkout");
});

const form = document.querySelector(".lead-form");
const status = document.querySelector("[data-form-status]");

if (form && status) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "Cadastro registrado. Conecte este formulário ao seu serviço de email marketing.";
    form.reset();
  });
}

const header = document.querySelector("[data-header]");

if (header) {
  window.addEventListener("scroll", () => {
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }, { passive: true });
}
