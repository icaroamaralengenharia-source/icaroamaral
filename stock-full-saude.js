const localAnchors = document.querySelectorAll('a[href^="#"]');

localAnchors.forEach((anchor) => {
  anchor.addEventListener("click", (event) => {
    const targetId = anchor.getAttribute("href");
    if (!targetId || targetId === "#") {
      return;
    }

    const target = document.querySelector(targetId);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

const revealItems = document.querySelectorAll(".sf-resource-grid article, .sf-device-grid article, .sf-audience-grid article, .sf-trust-grid span, .sf-flow li, .sf-chat-msg, .sf-chat-prompts span");

if ("IntersectionObserver" in window) {
  revealItems.forEach((item) => item.classList.add("sf-reveal"));

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}
