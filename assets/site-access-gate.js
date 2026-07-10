(function () {
  "use strict";

  const STORAGE_KEY = "icaro_site_access_v2";
  const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
  const PASSWORD_SHA256 = "e9d05ab4a11ef5c2a5b5652b27baa8257f400a07cb59f53d24bd472fa576195c";
  const LOCK_CLASS = "site-access-locked";

  let gateElement = null;
  let lastFocusedElement = null;

  function now() {
    return Date.now();
  }

  function clearLegacySession() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
  }

  function readSession() {
    try {
      const raw = window.sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || session.authenticated !== true || Number(session.expiresAt) <= now()) {
        clearSession();
        return null;
      }
      return session;
    } catch (error) {
      clearSession();
      return null;
    }
  }

  function writeSession() {
    const session = {
      authenticated: true,
      createdAt: now(),
      expiresAt: now() + SESSION_TTL_MS
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  function clearSession() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch (error) {}
  }

  function isAuthenticated() {
    return Boolean(readSession());
  }

  async function sha256(value) {
    const input = new TextEncoder().encode(value);
    const digest = await window.crypto.subtle.digest("SHA-256", input);
    return Array.from(new Uint8Array(digest)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function blockEvent(event) {
    if (!document.documentElement.classList.contains(LOCK_CLASS)) return;
    if (gateElement && gateElement.contains(event.target)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function bindGlobalBlockers() {
    ["click", "dblclick", "mousedown", "mouseup", "pointerdown", "pointerup", "touchstart", "touchmove", "wheel", "scroll", "keydown", "keyup"].forEach(function (eventName) {
      window.addEventListener(eventName, blockEvent, true);
    });
  }

  function createGate() {
    const gate = document.createElement("section");
    gate.className = "site-access-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "siteAccessTitle");
    gate.innerHTML = [
      '<div class="site-access-dialog">',
      '<h1 id="siteAccessTitle">Acesso restrito</h1>',
      '<p>Digite a senha para acessar o ecossistema Icaro Amaral.</p>',
      '<form class="site-access-form" autocomplete="off">',
      '<label>Senha<input type="password" name="password" autocomplete="current-password" required></label>',
      '<button type="submit">Entrar</button>',
      '<div class="site-access-error" role="status" aria-live="polite"></div>',
      '</form>',
      '<div class="site-access-note">Bloqueio temporario no frontend para visitantes comuns. Nao substitui seguranca real no servidor.</div>',
      '</div>'
    ].join("");

    const form = gate.querySelector("form");
    const input = gate.querySelector("input");
    const error = gate.querySelector(".site-access-error");

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const validPassword = await sha256(input.value) === PASSWORD_SHA256;
      if (validPassword) {
        writeSession();
        unlockPage();
        return;
      }
      error.textContent = "Senha incorreta.";
      input.value = "";
      input.focus();
    });

    return gate;
  }

  function lockPage() {
    document.documentElement.classList.add(LOCK_CLASS);
    if (!gateElement) {
      gateElement = createGate();
      document.body.appendChild(gateElement);
    }
    gateElement.hidden = false;
    lastFocusedElement = document.activeElement;
    const input = gateElement.querySelector("input");
    window.setTimeout(function () {
      input.focus();
    }, 0);
  }

  function unlockPage() {
    document.documentElement.classList.remove(LOCK_CLASS);
    if (gateElement) {
      gateElement.hidden = true;
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      try {
        lastFocusedElement.focus();
      } catch (error) {}
    }
  }

  function refreshLockState() {
    if (isAuthenticated()) {
      unlockPage();
    } else {
      lockPage();
    }
  }

  window.logoutSite = function () {
    clearSession();
    window.location.reload();
  };

  clearLegacySession();
  bindGlobalBlockers();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshLockState, { once: true });
  } else {
    refreshLockState();
  }

  window.setInterval(refreshLockState, 30 * 1000);
})();