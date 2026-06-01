// ═══════════════════════════════════════════════════════════════════
// BOARD · Tablero individual: listas, tarjetas, drag & drop
// ═══════════════════════════════════════════════════════════════════

const BoardModule = (() => {
  let boardId;
  let boardData = { lists: {} };
  let draggedCard = null;

  function init() {
    const params = new URLSearchParams(location.search);
    boardId = params.get("id");

    if (!boardId || !window.currentUser) {
      location.href = "index.html";
      return;
    }

    const boardRef = db
      .collection("users")
      .doc(window.currentUser.uid)
      .collection("boards")
      .doc(boardId);

    // Cargar tablero en tiempo real
    boardRef.onSnapshot((doc) => {
      if (!doc.exists) {
        location.href = "index.html";
        return;
      }

      const board = doc.data();
      document.querySelector(".board-title").textContent = board.title;
      document.body.style.backgroundColor = board.background;

      // Cargar listas
      boardRef
        .collection("lists")
        .orderBy("position")
        .onSnapshot((snap) => {
          boardData.lists = {};
          snap.forEach((listDoc) => {
            boardData.lists[listDoc.id] = {
              ...listDoc.data(),
              id: listDoc.id,
              cards: [],
            };

            // Cargar tarjetas de cada lista
            boardRef
              .collection("lists")
              .doc(listDoc.id)
              .collection("cards")
              .orderBy("position")
              .onSnapshot((cardSnap) => {
                boardData.lists[listDoc.id].cards = [];
                cardSnap.forEach((cardDoc) => {
                  boardData.lists[listDoc.id].cards.push({
                    ...cardDoc.data(),
                    id: cardDoc.id,
                  });
                });
                render();
              });
          });
          render();
        });
    });
  }

  function render() {
    const listsContainer = document.getElementById("lists-container");
    listsContainer.innerHTML = "";

    Object.values(boardData.lists)
      .sort((a, b) => a.position - b.position)
      .forEach((list) => {
        const listEl = renderList(list);
        listsContainer.appendChild(listEl);
      });

    // Botón para añadir lista
    const addListBtn = document.createElement("div");
    addListBtn.className = "list add-list-btn";
    addListBtn.innerHTML = `<button class="btn-add-list">+ Añadir lista</button>`;

    addListBtn.querySelector(".btn-add-list").addEventListener("click", () => {
      showAddListForm(addListBtn);
    });

    listsContainer.appendChild(addListBtn);
  }

  function renderList(list) {
    const listEl = document.createElement("div");
    listEl.className = "list";
    listEl.dataset.listId = list.id;

    const cardsHtml = list.cards
      .map(
        (card) => `
      <div class="card" draggable="true" data-card-id="${card.id}" data-list-id="${list.id}">
        <div class="card-content">${card.title}</div>
        <button class="card-delete" title="Eliminar">✕</button>
      </div>
    `
      )
      .join("");

    listEl.innerHTML = `
      <div class="list-header">
        <h3>${list.title}</h3>
        <button class="list-delete" title="Eliminar lista">✕</button>
      </div>
      <div class="cards-container" data-list-id="${list.id}">
        ${cardsHtml}
      </div>
      <button class="btn-add-card">+ Añadir tarjeta</button>
    `;

    // Eventos de lista
    listEl
      .querySelector(".list-delete")
      .addEventListener("click", () => deleteList(list.id));

    listEl
      .querySelector(".btn-add-card")
      .addEventListener("click", () => showAddCardForm(listEl, list.id));

    // Eventos de tarjeta
    const cardsContainer = listEl.querySelector(".cards-container");

    cardsContainer.addEventListener("dragover", (e) => {
      e.preventDefault();
      cardsContainer.classList.add("drag-over");
    });

    cardsContainer.addEventListener("dragleave", (e) => {
      if (e.target === cardsContainer)
        cardsContainer.classList.remove("drag-over");
    });

    cardsContainer.addEventListener("drop", (e) => {
      e.preventDefault();
      cardsContainer.classList.remove("drag-over");

      if (!draggedCard) return;

      const targetListId = list.id;
      const sourceListId = draggedCard.listId;
      const cardId = draggedCard.id;

      if (sourceListId === targetListId && draggedCard.samePath) {
        draggedCard = null;
        return;
      }

      moveCard(cardId, sourceListId, targetListId);
      draggedCard = null;
    });

    // Drag events
    listEl.querySelectorAll(".card").forEach((cardEl) => {
      cardEl.addEventListener("dragstart", (e) => {
        draggedCard = {
          id: cardEl.dataset.cardId,
          listId: cardEl.dataset.listId,
          samePath: true,
        };
        cardEl.classList.add("dragging");
      });

      cardEl.addEventListener("dragend", () => {
        cardEl.classList.remove("dragging");
      });

      cardEl
        .querySelector(".card-delete")
        .addEventListener("click", () => {
          deleteCard(list.id, cardEl.dataset.cardId);
        });
    });

    return listEl;
  }

  function showAddCardForm(listEl, listId) {
    const existingForm = listEl.querySelector(".add-card-form");
    if (existingForm) return;

    const form = document.createElement("div");
    form.className = "add-card-form";
    form.innerHTML = `
      <textarea placeholder="Título de la tarjeta…"></textarea>
      <div class="form-actions">
        <button class="btn-primary">Añadir</button>
        <button class="btn-secondary">Cancelar</button>
      </div>
    `;

    const textarea = form.querySelector("textarea");
    const submitBtn = form.querySelector(".btn-primary");
    const cancelBtn = form.querySelector(".btn-secondary");

    submitBtn.addEventListener("click", async () => {
      const title = textarea.value.trim();
      if (title) {
        await createCard(listId, title);
        form.remove();
      }
    });

    cancelBtn.addEventListener("click", () => form.remove());

    textarea.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const title = textarea.value.trim();
        if (title) {
          createCard(listId, title);
          form.remove();
        }
      }
    });

    listEl.appendChild(form);
    setTimeout(() => textarea.focus(), 0);
  }

  function showAddListForm(container) {
    const existingForm = container.querySelector(".add-list-form");
    if (existingForm) return;

    const form = document.createElement("div");
    form.className = "add-list-form";
    form.innerHTML = `
      <input type="text" placeholder="Nombre de la lista…" />
      <div class="form-actions">
        <button class="btn-primary">Crear</button>
        <button class="btn-secondary">Cancelar</button>
      </div>
    `;

    const input = form.querySelector("input");
    const submitBtn = form.querySelector(".btn-primary");
    const cancelBtn = form.querySelector(".btn-secondary");

    submitBtn.addEventListener("click", async () => {
      const title = input.value.trim();
      if (title) {
        await createList(title);
        form.remove();
      }
    });

    cancelBtn.addEventListener("click", () => form.remove());

    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const title = input.value.trim();
        if (title) {
          createList(title);
          form.remove();
        }
      }
    });

    container.replaceWith(form);
    setTimeout(() => input.focus(), 0);
  }

  async function createList(title) {
    if (!window.currentUser || !boardId) return;

    try {
      const listsRef = db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("lists");

      const position =
        (Object.values(boardData.lists).pop()?.position || 0) + 65536;

      await listsRef.add({
        title,
        position,
        createdAt: new Date(),
      });

      // Registrar actividad
      if (window.logActivity) window.logActivity("list_created", title);
    } catch (error) {
      window.showError(error);
    }
  }

  async function deleteList(listId) {
    if (!window.currentUser || !boardId) return;
    if (!confirm("¿Eliminar lista?")) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("lists")
        .doc(listId)
        .delete();
    } catch (error) {
      window.showError(error);
    }
  }

  async function createCard(listId, title) {
    if (!window.currentUser || !boardId) return;

    try {
      const cardsRef = db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("lists")
        .doc(listId)
        .collection("cards");

      const list = boardData.lists[listId];
      const position = (list.cards[list.cards.length - 1]?.position || 0) + 65536;

      await cardsRef.add({
        title,
        position,
        createdAt: new Date(),
      });

      // Registrar actividad
      if (window.logActivity) window.logActivity("card_created", title);
    } catch (error) {
      window.showError(error);
    }
  }

  async function deleteCard(listId, cardId) {
    if (!window.currentUser || !boardId) return;
    if (!confirm("¿Eliminar tarjeta?")) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("lists")
        .doc(listId)
        .collection("cards")
        .doc(cardId)
        .delete();
    } catch (error) {
      window.showError(error);
    }
  }

  async function moveCard(cardId, sourceListId, targetListId) {
    if (!window.currentUser || !boardId) return;

    try {
      const userRef = db.collection("users").doc(window.currentUser.uid);
      const boardRef = userRef.collection("boards").doc(boardId);

      // Obtener posición en la lista destino
      const targetCards = boardData.lists[targetListId].cards;
      const position = (targetCards[targetCards.length - 1]?.position || 0) + 65536;

      // Obtener la tarjeta
      const cardDoc = await boardRef
        .collection("lists")
        .doc(sourceListId)
        .collection("cards")
        .doc(cardId)
        .get();

      if (!cardDoc.exists) return;

      const cardData = cardDoc.data();

      // Crear copia en lista destino
      await boardRef
        .collection("lists")
        .doc(targetListId)
        .collection("cards")
        .doc(cardId)
        .set({
          ...cardData,
          position,
        });

      // Eliminar de lista origen (si es diferente)
      if (sourceListId !== targetListId) {
        await boardRef
          .collection("lists")
          .doc(sourceListId)
          .collection("cards")
          .doc(cardId)
          .delete();
      }

      // Registrar actividad
      if (window.logActivity) window.logActivity("card_moved", cardData.title);
    } catch (error) {
      window.showError(error);
    }
  }

  // Back button
  document.getElementById("back-btn").addEventListener("click", () => {
    location.href = "index.html";
  });

  // Members button
  const membersBtn = document.getElementById("members-btn");
  const membersModal = document.getElementById("members-modal");
  const closeMembers = document.getElementById("close-members");

  if (membersBtn && membersModal) {
    membersBtn.addEventListener("click", () => {
      membersModal.style.display = "block";
      // Inicializar módulo de membresías
      if (window.MembershipsModule) {
        window.MembershipsModule.updateMembers();
      }
    });

    closeMembers.addEventListener("click", () => {
      membersModal.style.display = "none";
    });

    membersModal.addEventListener("click", (e) => {
      if (e.target === membersModal) {
        membersModal.style.display = "none";
      }
    });
  }

  // Notification bell toggle
  const notificationBell = document.getElementById("notification-bell");
  const notificationPanel = document.getElementById("notification-panel");

  if (notificationBell && notificationPanel) {
    notificationBell.addEventListener("click", () => {
      const isVisible = notificationPanel.style.display !== "none";
      notificationPanel.style.display = isVisible ? "none" : "block";
    });

    document.addEventListener("click", (e) => {
      if (!e.target.closest(".notification-dropdown")) {
        notificationPanel.style.display = "none";
      }
    });
  }

  return { init };
})();

// Ejecutar cuando esté listo
window.onUserReady = () => {
  BoardModule.init();
};
