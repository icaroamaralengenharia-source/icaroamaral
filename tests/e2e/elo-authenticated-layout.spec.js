import { expect, test } from "@playwright/test";

const VIEWPORTS = [
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "desktop-1536", width: 1536, height: 864 },
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 }
];

async function openAuthenticatedElo(page, viewport) {
  await page.setViewportSize(viewport);
  await page.goto("/elo.html", { waitUntil: "networkidle" });
  await page.evaluate(() => {
    document.body.classList.remove("elo-auth-required", "elo-local-readonly");
    document.body.classList.add("elo-authenticated", "elo-empty-state");
    document.querySelector("[data-elo-auth-form]")?.setAttribute("hidden", "");
    document.querySelector("[data-elo-auth-session]")?.removeAttribute("hidden");
    const user = document.querySelector("[data-elo-auth-user]");
    if (user) user.textContent = "engenharia.usuario.com.email.muito.longo@empresa-exemplo.com.br";
  });
}

function overlaps(first, second) {
  return first.left < second.right && first.right > second.left &&
    first.top < second.bottom && first.bottom > second.top;
}

for (const viewport of VIEWPORTS) {
  test(`mantém o layout autenticado sem sobreposição em ${viewport.name}`, async ({ page }) => {
    await openAuthenticatedElo(page, viewport);

    const layout = await page.evaluate(() => {
      document.body.classList.remove("elo-auth-required", "elo-local-readonly");
      document.body.classList.add("elo-authenticated", "elo-empty-state");
      document.querySelector("[data-elo-auth-form]")?.setAttribute("hidden", "");
      document.querySelector("[data-elo-auth-session]")?.removeAttribute("hidden");
      const authenticatedUser = document.querySelector("[data-elo-auth-user]");
      if (authenticatedUser) authenticatedUser.textContent = "engenharia.usuario.com.email.muito.longo@empresa-exemplo.com.br";

      const rect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const box = element.getBoundingClientRect();
        return {
          left: box.left,
          top: box.top,
          right: box.right,
          bottom: box.bottom,
          width: box.width,
          height: box.height
        };
      };
      const visible = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return false;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && box.width > 0 && box.height > 0;
      };
      const header = rect(".elo-product-top");
      const children = [".elo-product-brand", ".elo-core-actions", ".elo-local-auth"]
        .filter(visible)
        .map((selector) => ({ selector, box: rect(selector) }));
      const childOverlaps = [];
      children.forEach((first, firstIndex) => {
        children.slice(firstIndex + 1).forEach((second) => {
          if (first.box && second.box && first.box.left < second.box.right && first.box.right > second.box.left &&
              first.box.top < second.box.bottom && first.box.bottom > second.box.top) {
            childOverlaps.push([first.selector, second.selector]);
          }
        });
      });
      const user = document.querySelector("[data-elo-auth-user]");
      const userStyle = user ? getComputedStyle(user) : null;
      const onlineStyle = getComputedStyle(document.querySelector(".elo-product-brand"), "::after");
      return {
        authenticated: document.body.classList.contains("elo-authenticated") && !document.body.classList.contains("elo-auth-required"),
        header,
        children,
        childOverlaps,
        hero: rect(".elo-product-heading"),
        composer: rect(".elo-input-row"),
        voice: visible(".elo-voice-mode-button") ? rect(".elo-voice-mode-button") : null,
        status: visible(".elo-voice-status") ? rect(".elo-voice-status") : null,
        onlineVisible: onlineStyle.display !== "none" && onlineStyle.content !== "none",
        userOverflow: userStyle ? {
          overflow: userStyle.overflow,
          whiteSpace: userStyle.whiteSpace,
          textOverflow: userStyle.textOverflow
        } : null,
        bodyOverflow: document.documentElement.scrollWidth > innerWidth,
        pageOverflow: document.documentElement.scrollHeight > innerHeight
      };
    });

    expect(layout.authenticated).toBe(true);
    expect(layout.header).not.toBeNull();
    expect(layout.hero).not.toBeNull();
    expect(layout.composer).not.toBeNull();
    expect(layout.header.bottom).toBeLessThanOrEqual(layout.hero.top);
    expect(layout.children.every(({ box }) => box.bottom <= layout.header.bottom + 1)).toBe(true);
    expect(layout.childOverlaps).toEqual([]);
    expect(layout.onlineVisible).toBe(true);
    expect(layout.userOverflow).toEqual({
      overflow: "hidden",
      whiteSpace: "nowrap",
      textOverflow: "ellipsis"
    });
    expect(layout.voice && overlaps(layout.voice, layout.composer)).toBe(false);
    expect(layout.status && overlaps(layout.status, layout.composer)).toBe(false);
    expect(layout.composer.bottom).toBeLessThanOrEqual(viewport.height + 1);
    expect(layout.bodyOverflow).toBe(false);
    expect(layout.pageOverflow).toBe(false);
  });
}
