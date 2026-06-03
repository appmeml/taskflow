// ═══════════════════════════════════════════════════════════════════
// BOARD · Tablero individual: listas, tarjetas, drag & drop
// ═══════════════════════════════════════════════════════════════════

const BoardModule = (() => {
  let boardId;
  let ownerUid;  // may differ from currentUser when viewing a shared board
  let boardData = { lists: {} };
  let draggedCard = null;

  function escHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function init() {
    const params = new URLSearchParams(location.search);
    boardId  = params.get("id") || localStorage.getItem("selectedBoardId");
    ownerUid = params.get("owner") || window.currentUser.uid;

    if (!boardId || !window.currentUser) {
      location.href = "index.html";
      return;
    }

    // Expose owner so logActivity writes to the correct board
    window.boardOwnerUid = ownerUid;

    if (window.AutomationEngine) {
      window.AutomationEngine.init(boardId, ownerUid, () => boardData);
    }

    const boardRef = db
      .collection("users")
      .doc(ownerUid)
      .collection("boards")
      .doc(boardId);

    // cardListeners[listId] = unsubscribe fn — prevents duplicate listeners
    const cardListeners = {};
    let moduleInitialized = false;

    // Board metadata (title, background) — separate from lists
    boardRef.onSnapshot((doc) => {
      if (!doc.exists) {
        location.href = "index.html";
        return;
      }
      const board = doc.data();
      document.querySelector(".board-title").textContent = board.title;
      document.body.style.backgroundColor = board.background;

      // Fire once: initialize memberships, notifications, activity feed
      if (!moduleInitialized) {
        moduleInitialized = true;
        if (window.onBoardLoaded) window.onBoardLoaded(board, boardId);
        if (window.onBoardActivityReady) window.onBoardActivityReady(boardId);
      }
    });

    // Lists listener — set up ONCE, outside of board's onSnapshot
    boardRef
      .collection("lists")
      .orderBy("position")
      .onSnapshot((snap) => {
        // Unsubscribe card listeners for deleted lists
        const activeIds = new Set(snap.docs.map((d) => d.id));
        for (const [listId, unsub] of Object.entries(cardListeners)) {
          if (!activeIds.has(listId)) {
            unsub();
            delete cardListeners[listId];
          }
        }

        // Rebuild list data preserving existing card arrays
        const updatedLists = {};
        snap.forEach((listDoc) => {
          updatedLists[listDoc.id] = {
            ...listDoc.data(),
            id: listDoc.id,
            cards: boardData.lists[listDoc.id]?.cards || [],
          };

          // Create card listener only once per list
          if (!cardListeners[listDoc.id]) {
            cardListeners[listDoc.id] = boardRef
              .collection("lists")
              .doc(listDoc.id)
              .collection("cards")
              .orderBy("position")
              .onSnapshot((cardSnap) => {
                if (!boardData.lists[listDoc.id]) return;
                boardData.lists[listDoc.id].cards = cardSnap.docs.map((cardDoc) => ({
                  ...cardDoc.data(),
                  id: cardDoc.id,
                }));
                render();
              });
          }
        });

        boardData.lists = updatedLists;
        render();
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
        <div class="card-content">${escHtml(card.title)}</div>
        <button class="card-auto-btn" title="Automatizaciones">⚡</button>
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

      cardEl.querySelector(".card-auto-btn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        const cardData = list.cards.find(c => c.id === cardEl.dataset.cardId);
        showCardAutoPopup(cardEl, cardEl.dataset.cardId, list.id, cardData);
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
        .doc(ownerUid)
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
        .doc(ownerUid)
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
        .doc(ownerUid)
        .collection("boards")
        .doc(boardId)
        .collection("lists")
        .doc(listId)
        .collection("cards");

      const list = boardData.lists[listId];
      if (!list) return;
      const position = (list.cards[list.cards.length - 1]?.position || 0) + 65536;

      const cardCreatedAt = new Date();
      const docRef = await cardsRef.add({
        title,
        position,
        createdAt: cardCreatedAt,
      });

      // Registrar actividad
      if (window.logActivity) window.logActivity("card_created", title);
      if (window.AutomationEngine) {
        window.AutomationEngine.onCardCreated(docRef.id, { title, position, createdAt: cardCreatedAt }, listId);
      }
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
        .doc(ownerUid)
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
      const boardRef = db.collection("users").doc(ownerUid).collection("boards").doc(boardId);

      // Obtener posición en la lista destino
      const targetList = boardData.lists[targetListId];
      if (!targetList) return;
      const targetCards = targetList.cards;
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
      if (sourceListId !== targetListId && window.AutomationEngine) {
        window.AutomationEngine.onCardMoved(cardId, cardData, targetListId);
      }
    } catch (error) {
      window.showError(error);
    }
  }

  function showCardAutoPopup(cardEl, cardId, listId, card) {
    document.querySelectorAll(".card-auto-popup").forEach(p => p.remove());
    const btns = window.AutomationEngine?.getCardButtons() || [];
    if (!btns.length) return;
    const popup = document.createElement("div");
    popup.className = "card-auto-popup";
    btns.forEach(b => {
      const btn = document.createElement("button");
      btn.className = "card-auto-popup-btn";
      btn.textContent = `${b.icon || "⚡"} ${b.name || "Sin nombre"}`;
      btn.addEventListener("click", async () => {
        popup.remove();
        await window.AutomationEngine?.runCardButton(b.id, cardId, listId, card);
      });
      popup.appendChild(btn);
    });
    document.body.appendChild(popup);
    const rect = cardEl.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 4}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 170)}px`;
    setTimeout(() => {
      document.addEventListener("click", () => popup.remove(), { once: true });
    }, 10);
  }

  // Back button
  document.getElementById("back-btn").addEventListener("click", () => {
    location.href = "index.html";
  });

  // Automation button
  document.getElementById("automation-btn")?.addEventListener("click", () => {
    location.href = `automation.html${boardId ? "?id=" + boardId : ""}`;
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
