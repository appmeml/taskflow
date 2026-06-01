// ═══════════════════════════════════════════════════════════════════
// BOARDS · Crear, listar y navegar tableros
// ═══════════════════════════════════════════════════════════════════
// Estructura Firestore:
// users/{userId}/boards/{boardId}
//   - title: string
//   - background: string (color hex)
//   - createdAt: timestamp
//   - lists/{listId}
//     - title: string
//     - position: number (para ordenar)
//     - cards/{cardId}
//       - title: string
//       - position: number

const BoardsModule = (() => {
  const container = document.getElementById("boards-container");
  const createBtn = document.getElementById("create-board-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userEmail = document.getElementById("user-email");

  const BACKGROUNDS = [
    "#0079bf",
    "#d29034",
    "#519839",
    "#b04632",
    "#89609e",
    "#cd5a91",
  ];
  let selectedBg = BACKGROUNDS[0];

  // Mostrar email del usuario
  window.onUserReady = (user) => {
    userEmail.textContent = user.email;
    loadBoards();
  };

  // Cargar tableros
  function loadBoards() {
    if (!window.currentUser) return;

    const boardsRef = db
      .collection("users")
      .doc(window.currentUser.uid)
      .collection("boards");

    // Escuchar cambios en tiempo real
    boardsRef.orderBy("createdAt", "desc").onSnapshot((snap) => {
      container.innerHTML = "";

      snap.forEach((doc) => {
        const board = doc.data();
        const boardId = doc.id;
        renderBoardCard(boardId, board);
      });

      // Botón para crear nuevo
      container.appendChild(createNewBoardCard());
    });
  }

  function renderBoardCard(boardId, board) {
    const card = document.createElement("div");
    card.className = "board-card";
    card.style.backgroundColor = board.background;

    card.innerHTML = `
      <a href="board.html?id=${boardId}" class="board-card-link">
        <div class="board-card-title">${board.title}</div>
        <div class="board-card-meta">
          <span class="board-card-date">${new Date(board.createdAt.toDate()).toLocaleDateString("es-ES")}</span>
        </div>
      </a>
      <button class="board-card-delete" title="Eliminar">✕</button>
    `;

    card
      .querySelector(".board-card-delete")
      .addEventListener("click", (e) => {
        e.preventDefault();
        if (confirm(`¿Eliminar "${board.title}"?`)) {
          deleteBoard(boardId);
        }
      });

    container.appendChild(card);
  }

  function createNewBoardCard() {
    const card = document.createElement("div");
    card.className = "board-card create-card";

    const isOpen = { value: false };

    card.innerHTML = `
      <button class="create-board-btn">+ Crear tablero</button>
      <div class="create-form" style="display:none;">
        <input type="text" placeholder="Nombre del tablero…" id="board-name" />
        <div class="color-picker">
          ${BACKGROUNDS.map(
            (color) =>
              `<button class="color-btn" style="background-color:${color};" data-color="${color}"></button>`
          ).join("")}
        </div>
        <div class="form-actions">
          <button class="btn-primary" id="submit-board">Crear</button>
          <button class="btn-secondary" id="cancel-board">Cancelar</button>
        </div>
      </div>
    `;

    const form = card.querySelector(".create-form");
    const input = card.querySelector("#board-name");

    card.querySelector(".create-board-btn").addEventListener("click", () => {
      isOpen.value = true;
      form.style.display = "block";
      input.focus();
    });

    card.querySelectorAll(".color-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        document
          .querySelectorAll(".color-btn")
          .forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedBg = btn.dataset.color;
      });
    });

    card.querySelector("#submit-board").addEventListener("click", () => {
      const title = input.value.trim();
      if (title) createBoard(title);
      else window.showToast("Escribe un nombre", "error");
    });

    card.querySelector("#cancel-board").addEventListener("click", () => {
      isOpen.value = false;
      form.style.display = "none";
      input.value = "";
      selectedBg = BACKGROUNDS[0];
    });

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const title = input.value.trim();
        if (title) createBoard(title);
      }
    });

    return card;
  }

  async function createBoard(title) {
    if (!window.currentUser) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .add({
          title,
          background: selectedBg,
          createdAt: new Date(),
        });

      window.showToast(`Tablero "${title}" creado`);
    } catch (error) {
      window.showError(error);
    }
  }

  async function deleteBoard(boardId) {
    if (!window.currentUser) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .delete();

      window.showToast("Tablero eliminado");
    } catch (error) {
      window.showError(error);
    }
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => AuthModule.logout());
  }

  return { loadBoards };
})();
