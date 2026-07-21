(function () {
  "use strict";

  const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
  ];

  const state = {
    board: Array(9).fill(""),
    locked: false,
    finished: false,
    lastFocus: null
  };

  function findWin(board) {
    for (const line of WIN_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return { player: board[a], line };
      }
    }
    return null;
  }

  function isDraw(board) {
    return board.every(Boolean) && !findWin(board);
  }

  function chooseMove(board, player) {
    for (let index = 0; index < board.length; index += 1) {
      if (board[index]) continue;
      const trial = board.slice();
      trial[index] = player;
      if (findWin(trial)) return index;
    }
    return -1;
  }

  function browserMove() {
    const win = chooseMove(state.board, "O");
    if (win >= 0) return win;
    const block = chooseMove(state.board, "X");
    if (block >= 0) return block;
    if (!state.board[4]) return 4;
    const preferred = [0, 2, 6, 8, 1, 3, 5, 7].filter((index) => !state.board[index]);
    return preferred.length ? preferred[0] : -1;
  }

  function elements() {
    return {
      openButton: document.querySelector("[data-elo-mascot-play]"),
      modal: document.querySelector("[data-elo-mascot-game]"),
      board: document.querySelector("[data-elo-game-board]"),
      status: document.querySelector("[data-elo-game-status]"),
      closeButtons: document.querySelectorAll("[data-elo-game-close]"),
      resetButton: document.querySelector("[data-elo-game-reset]")
    };
  }

  function setStatus(text) {
    const { status } = elements();
    if (status) status.textContent = text;
  }

  function updateResult() {
    const { board } = elements();
    const win = findWin(state.board);
    if (win) {
      state.finished = true;
      state.locked = true;
      setStatus(win.player === "X" ? "Voce venceu o ELO." : "O navegador venceu esta rodada.");
      if (board) {
        win.line.forEach((index) => {
          const cell = board.querySelector(`[data-cell="${index}"]`);
          if (cell) cell.classList.add("is-win");
        });
      }
      return true;
    }
    if (isDraw(state.board)) {
      state.finished = true;
      state.locked = true;
      setStatus("Empate. Rodada equilibrada.");
      return true;
    }
    return false;
  }

  function renderBoard() {
    const { board } = elements();
    if (!board) return;
    board.innerHTML = "";
    state.board.forEach((value, index) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "elo-mascot-cell" + (value === "O" ? " is-browser" : "");
      cell.dataset.cell = String(index);
      cell.textContent = value;
      cell.setAttribute("aria-label", value ? `Casa ${index + 1}: ${value}` : `Casa ${index + 1}: vazia`);
      cell.disabled = Boolean(value) || state.locked || state.finished;
      cell.addEventListener("click", () => playHuman(index));
      board.appendChild(cell);
    });
    updateResult();
  }

  function playHuman(index) {
    if (state.locked || state.finished || state.board[index]) return;
    state.board[index] = "X";
    renderBoard();
    if (state.finished) return;
    state.locked = true;
    setStatus("ELO pensando na resposta...");
    window.setTimeout(() => {
      const move = browserMove();
      if (move >= 0) state.board[move] = "O";
      state.locked = false;
      renderBoard();
      if (!state.finished) setStatus("Sua vez. Voce joga com X.");
    }, 360);
  }

  function resetGame() {
    state.board = Array(9).fill("");
    state.locked = false;
    state.finished = false;
    setStatus("Sua vez. Voce joga com X.");
    renderBoard();
  }

  function openGame() {
    const { modal, board } = elements();
    if (!modal) return;
    state.lastFocus = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("elo-mascot-game-open");
    resetGame();
    const firstCell = board && board.querySelector("button");
    if (firstCell) firstCell.focus();
  }

  function closeGame() {
    const { modal } = elements();
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("elo-mascot-game-open");
    state.locked = false;
    state.finished = false;
    if (state.lastFocus && typeof state.lastFocus.focus === "function") {
      state.lastFocus.focus();
    }
  }


  function closeMascotShell(shell) {
    if (!shell) return;
    shell.classList.add("is-mascot-hidden");
  }

  function createMascotCloseButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "elo-mascot-close";
    button.textContent = "x";
    button.setAttribute("aria-label", "Fechar mascote do ELO");
    return button;
  }

  function bindMascotCloseButton(button, shell) {
    if (!button || !shell || button.dataset.eloMascotCloseBound === "true") return;
    button.dataset.eloMascotCloseBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMascotShell(shell);
    });
  }

  function prepareHeroMascotClose() {
    document.querySelectorAll("[data-elo-mascot-shell]").forEach((shell) => {
      const button = shell.querySelector("[data-elo-mascot-close]");
      bindMascotCloseButton(button, shell);
    });
  }

  function wrapMascotAvatar(avatar) {
    if (!avatar || avatar.closest(".elo-mascot-avatar-wrap")) return;
    const shell = document.createElement("span");
    shell.className = "elo-mascot-avatar-wrap";
    const button = createMascotCloseButton();
    avatar.parentNode.insertBefore(shell, avatar);
    shell.appendChild(button);
    shell.appendChild(avatar);
    bindMascotCloseButton(button, shell);
  }

  function prepareMessageMascotClose() {
    document.querySelectorAll(".elo-mascot-avatar").forEach(wrapMascotAvatar);
  }

  function watchMascotAvatars() {
    prepareHeroMascotClose();
    prepareMessageMascotClose();
    const target = document.body;
    if (!target || target.dataset.eloMascotObserver === "true") return;
    target.dataset.eloMascotObserver = "true";
    const observer = new MutationObserver(() => {
      prepareHeroMascotClose();
      prepareMessageMascotClose();
    });
    observer.observe(target, { childList: true, subtree: true });
  }
  function bindGame() {
    const { openButton, closeButtons, resetButton, modal } = elements();
    watchMascotAvatars();
    if (!openButton || !modal) return;
    openButton.addEventListener("click", openGame);
    closeButtons.forEach((button) => button.addEventListener("click", closeGame));
    if (resetButton) resetButton.addEventListener("click", resetGame);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !modal.hidden) closeGame();
    });
    renderBoard();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindGame);
  } else {
    bindGame();
  }
}());