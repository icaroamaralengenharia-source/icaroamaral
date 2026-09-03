(function bootEloOfflineLab(global) {
  "use strict";

  const output = document.querySelector("[data-output]");
  const form = document.querySelector("[data-form]");
  const input = document.querySelector("[data-command]");
  const statusEl = document.querySelector("[data-status]");
  const audio = new Audio();
  let queue = [];
  let queueIndex = 0;
  let commandGeneration = 0;
  let playbackGeneration = 0;

  function write(message) {
    output.textContent = message;
  }

  function setStatus(value) {
    statusEl.textContent = value;
  }

  function stopAudio() {
    playbackGeneration += 1;
    queue = [];
    queueIndex = 0;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }

  function playQueue(files) {
    stopAudio();
    queue = Array.isArray(files) ? files.slice() : [];
    queueIndex = 0;
    const runId = playbackGeneration;
    playCurrent(runId);
  }

  function playCurrent(runId) {
    if (runId !== playbackGeneration) {
      return;
    }
    const next = queue[queueIndex];
    if (!next) {
      stopAudio();
      return;
    }
    audio.src = next.url;
    audio.play().catch((error) => {
      if (runId === playbackGeneration) {
        write(`Não consegui tocar o áudio offline: ${error.message}`);
      }
    });
  }

  audio.addEventListener("ended", () => {
    const runId = playbackGeneration;
    queueIndex += 1;
    playCurrent(runId);
  });

  async function backendProbe() {
    return fetch("../api/health", { method: "GET", cache: "no-store" });
  }

  const router = global.EloOfflineLabRouter.createRouter({
    backendProbe,
    timeoutMs: 1500
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const command = input.value.trim();
    if (!command) {
      return;
    }
    const runId = commandGeneration + 1;
    commandGeneration = runId;
    write("Processando...");
    try {
      const result = await router.route(command);
      if (runId !== commandGeneration) {
        return;
      }
      setStatus(result.connectivity);
      if (result.localStop) {
        stopAudio();
      }
      if (result.localPlay) {
        playQueue(result.files);
      }
      write(result.message);
    } catch (error) {
      if (runId !== commandGeneration) {
        return;
      }
      stopAudio();
      write(`Falha no lab offline: ${error.message || error}`);
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
  }

  setStatus(navigator.onLine === false ? "BROWSER_OFFLINE" : "ONLINE_UNVERIFIED");
})(window);