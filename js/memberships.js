// ═══════════════════════════════════════════════════════════════════
// MEMBERSHIPS · Compartir tableros, invitaciones, permisos
// ═══════════════════════════════════════════════════════════════════
// Estructura:
// users/{userId}/boards/{boardId}/members/{memberId}
//   - userId: string (quién es miembro)
//   - email: string (del usuario para invitarlo)
//   - role: "owner" | "editor" | "viewer"
//   - joinedAt: timestamp
//
// notifications/{userId}/{notificationId}
//   - type: "invite" | "removed" | "activity"
//   - fromUser: string (nombre de quién activa)
//   - boardId: string
//   - boardName: string
//   - message: string
//   - read: boolean
//   - createdAt: timestamp

const MembershipsModule = window.MembershipsModule = (() => {
  const membersList = document.getElementById("members-list");
  const inviteBtn = document.getElementById("invite-member-btn");
  const notificationBell = document.getElementById("notification-bell");
  const notificationPanel = document.getElementById("notification-panel");
  const notificationsList = document.getElementById("notifications-list");

  let boardId;
  let currentBoard;
  let unreadCount = 0;

  // Inicializar
  window.onBoardLoaded = (board, bId) => {
    boardId = bId;
    currentBoard = board;
    loadMembers();
    loadNotifications();
    setupNotificationBell();
  };

  // ─── NOTIFICACIONES ─────────────────────────────────────────
  function setupNotificationBell() {
    if (!notificationBell || !window.currentUser) return;

    // Escuchar notificaciones en tiempo real
    db.collection("notifications")
      .doc(window.currentUser.uid)
      .collection("messages")
      .orderBy("createdAt", "desc")
      .limit(10)
      .onSnapshot((snap) => {
        unreadCount = 0;
        notificationsList.innerHTML = "";

        snap.forEach((doc) => {
          const notif = doc.data();
          const notifId = doc.id;

          if (!notif.read) unreadCount++;

          const notifEl = document.createElement("div");
          notifEl.className = `notification-item ${notif.read ? "" : "unread"}`;
          notifEl.innerHTML = `
            <div class="notification-content">
              <div class="notification-message">${notif.message}</div>
              <div class="notification-time">${formatTime(notif.createdAt)}</div>
            </div>
            ${!notif.read ? '<div class="notification-dot"></div>' : ""}
          `;

          // Click en notificación invita
          if (notif.type === "invite" && !notif.read) {
            const acceptBtn = document.createElement("button");
            acceptBtn.className = "notification-action accept";
            acceptBtn.textContent = "Aceptar";
            acceptBtn.addEventListener("click", () => {
              acceptInvite(notif.boardId, notifId);
            });

            const rejectBtn = document.createElement("button");
            rejectBtn.className = "notification-action reject";
            rejectBtn.textContent = "Rechazar";
            rejectBtn.addEventListener("click", () => {
              rejectInvite(notifId);
            });

            notifEl.appendChild(acceptBtn);
            notifEl.appendChild(rejectBtn);
          } else {
            // Click para marcar como leído
            notifEl.addEventListener("click", () => {
              markAsRead(notifId);
            });
          }

          notificationsList.appendChild(notifEl);
        });

        updateNotificationBadge();
      });
  }

  function updateNotificationBadge() {
    const badge = notificationBell?.querySelector(".notification-badge");
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? "block" : "none";
    }
  }

  function loadNotifications() {
    if (!window.currentUser) return;

    const userRef = db.collection("notifications").doc(window.currentUser.uid);

    userRef.onSnapshot((doc) => {
      if (doc.exists) {
        const data = doc.data();
        console.log("Notificaciones del usuario:", data);
      }
    });
  }

  async function markAsRead(notificationId) {
    if (!window.currentUser) return;

    try {
      await db
        .collection("notifications")
        .doc(window.currentUser.uid)
        .collection("messages")
        .doc(notificationId)
        .update({ read: true });
    } catch (error) {
      console.error("Error marcando notificación:", error);
    }
  }

  // ─── MEMBRESÍAS ────────────────────────────────────────────

  function loadMembers() {
    if (!boardId || !window.currentUser) return;

    const membersRef = db
      .collection("users")
      .doc(window.currentUser.uid)
      .collection("boards")
      .doc(boardId)
      .collection("members");

    if (!membersList) return;

    membersRef.onSnapshot((snap) => {
      membersList.innerHTML = "";

      snap.forEach((doc) => {
        const member = doc.data();
        renderMemberItem(member, doc.id);
      });
    });
  }

  function renderMemberItem(member, memberId) {
    const item = document.createElement("div");
    item.className = "member-item";

    const initials = member.email
      .split("@")[0]
      .slice(0, 2)
      .toUpperCase();

    item.innerHTML = `
      <div class="member-avatar">${initials}</div>
      <div class="member-info">
        <div class="member-email">${member.email}</div>
        <div class="member-role">${member.role}</div>
      </div>
      <div class="member-actions">
        <select class="member-role-select" data-member-id="${memberId}">
          <option value="viewer" ${member.role === "viewer" ? "selected" : ""}>
            Visor
          </option>
          <option value="editor" ${member.role === "editor" ? "selected" : ""}>
            Editor
          </option>
          <option value="owner" ${member.role === "owner" ? "selected" : ""}>
            Propietario
          </option>
        </select>
        <button class="member-remove" data-member-id="${memberId}" title="Eliminar">
          ✕
        </button>
      </div>
    `;

    const select = item.querySelector(".member-role-select");
    const removeBtn = item.querySelector(".member-remove");

    select.addEventListener("change", () => {
      updateMemberRole(memberId, select.value);
    });

    removeBtn.addEventListener("click", () => {
      if (confirm(`¿Eliminar a ${member.email}?`)) {
        removeMember(memberId, member.email);
      }
    });

    membersList.appendChild(item);
  }

  // ─── INVITACIONES ──────────────────────────────────────────

  if (inviteBtn) {
    inviteBtn.addEventListener("click", showInviteModal);
  }

  function showInviteModal() {
    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Invitar miembro</h3>
          <button class="modal-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <input
            type="email"
            id="invite-email"
            placeholder="email@ejemplo.com"
            class="invite-input"
          />
          <select id="invite-role" class="invite-role">
            <option value="viewer">Visor (solo lectura)</option>
            <option value="editor" selected>Editor</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel">Cancelar</button>
          <button class="btn-whatsapp">📱 WhatsApp</button>
          <button class="btn-send">Enviar invitación</button>
        </div>
      </div>
    `;

    const closeBtn = modal.querySelector(".modal-close");
    const cancelBtn = modal.querySelector(".btn-cancel");
    const sendBtn = modal.querySelector(".btn-send");
    const waBtn = modal.querySelector(".btn-whatsapp");
    const emailInput = modal.querySelector("#invite-email");
    const roleSelect = modal.querySelector("#invite-role");

    const close = () => modal.remove();

    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);

    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    sendBtn.addEventListener("click", () => {
      const email = emailInput.value.trim().toLowerCase();
      const role = roleSelect.value;

      if (!email) {
        window.showToast("Escribe un email", "error");
        return;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        window.showToast("Email inválido", "error");
        return;
      }

      sendInvitation(email, role);
      close();
    });

    waBtn.addEventListener("click", () => {
      const boardName = currentBoard ? currentBoard.title : "un tablero";
      const from = window.currentUser ? window.currentUser.email : "alguien";
      const text = `¡Hola! ${from} te invita a colaborar en el tablero *"${boardName}"* en TaskFlow. Inicia sesión en la app para aceptar la invitación.`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });

    document.body.appendChild(modal);
    emailInput.focus();
  }

  async function sendInvitation(email, role) {
    if (!boardId || !window.currentUser || !currentBoard) return;

    try {
      // 1. Buscar al usuario por email
      const usersSnap = await db
        .collection("users")
        .where("email", "==", email)
        .get();

      if (usersSnap.empty) {
        window.showToast("Usuario no encontrado", "error");
        return;
      }

      const targetUserId = usersSnap.docs[0].id;
      const targetUserData = usersSnap.docs[0].data();

      // 2. Agregar como miembro pendiente en el tablero
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("members")
        .doc(targetUserId)
        .set({
          userId: targetUserId,
          email: email,
          role: role,
          status: "pending", // Pendiente de aceptar
          invitedBy: window.currentUser.email,
          invitedAt: new Date(),
        });

      // 3. Enviar notificación
      await sendNotification(
        targetUserId,
        "invite",
        `${window.currentUser.email} te invitó a "${currentBoard.title}"`,
        {
          boardId: boardId,
          boardName: currentBoard.title,
          invitedBy: window.currentUser.email,
        }
      );

      window.showToast(`Invitación enviada a ${email}`);
    } catch (error) {
      window.showError(error);
    }
  }

  async function acceptInvite(boardId, notificationId) {
    if (!window.currentUser) return;

    try {
      // Marcar notificación como leída
      await db
        .collection("notifications")
        .doc(window.currentUser.uid)
        .collection("messages")
        .doc(notificationId)
        .update({ read: true });

      // El tablero ya está en la colección de miembros
      // Solo necesitamos cambiar el status a "active"
      // (Nota: en una app real, buscarías el tablero en la invitación)

      window.showToast("Invitación aceptada");

      // Recargar tableros
      if (window.BoardsModule && window.BoardsModule.loadBoards) {
        window.BoardsModule.loadBoards();
      }
    } catch (error) {
      window.showError(error);
    }
  }

  async function rejectInvite(notificationId) {
    if (!window.currentUser) return;

    try {
      await db
        .collection("notifications")
        .doc(window.currentUser.uid)
        .collection("messages")
        .doc(notificationId)
        .delete();

      window.showToast("Invitación rechazada");
    } catch (error) {
      window.showError(error);
    }
  }

  async function updateMemberRole(memberId, newRole) {
    if (!boardId || !window.currentUser) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("members")
        .doc(memberId)
        .update({ role: newRole });

      window.showToast("Rol actualizado");
    } catch (error) {
      window.showError(error);
    }
  }

  async function removeMember(memberId, memberEmail) {
    if (!boardId || !window.currentUser) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("members")
        .doc(memberId)
        .delete();

      // Notificar al usuario que fue removido
      await sendNotification(
        memberId,
        "activity",
        `Fuiste removido de un tablero por ${window.currentUser.email}`,
        {}
      );

      window.showToast(`${memberEmail} removido`);
    } catch (error) {
      window.showError(error);
    }
  }

  // ─── HELPER: Enviar notificación ────────────────────────

  async function sendNotification(userId, type, message, metadata = {}) {
    try {
      await db
        .collection("notifications")
        .doc(userId)
        .collection("messages")
        .add({
          type: type, // "invite", "activity", "mention"
          message: message,
          read: false,
          createdAt: new Date(),
          ...metadata,
        });
    } catch (error) {
      console.error("Error enviando notificación:", error);
    }
  }

  // Helper: formatear tiempo
  function formatTime(timestamp) {
    if (!timestamp) return "Ahora";
    const date = new Date(timestamp.toDate());
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString("es-ES");
  }

  return {
    sendNotification,
    updateMembers: loadMembers,
  };
})();
