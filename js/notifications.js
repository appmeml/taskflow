// ═══════════════════════════════════════════════════════════════════
// NOTIFICATIONS · Actividad en tableros compartidos
// ═══════════════════════════════════════════════════════════════════
// Cuando un miembro edita algo, notificamos a los otros.
// Estructura:
// users/{userId}/boards/{boardId}/activity/{activityId}
//   - type: "card_created" | "card_moved" | "list_added" | etc
//   - by: string (email de quién lo hizo)
//   - target: string (qué se modificó: "Título de la tarjeta")
//   - timestamp: timestamp

const NotificationsModule = (() => {
  let boardId;
  let activityFeed = document.getElementById("activity-feed");

  window.onBoardActivityReady = (bId) => {
    boardId = bId;
    if (activityFeed) {
      listenForActivity();
    }
  };

  // Escuchar actividad en tiempo real
  function listenForActivity() {
    if (!boardId || !window.currentUser) return;

    const activityRef = db
      .collection("users")
      .doc(window.currentUser.uid)
      .collection("boards")
      .doc(boardId)
      .collection("activity");

    activityRef
      .orderBy("timestamp", "desc")
      .limit(20)
      .onSnapshot((snap) => {
        if (!activityFeed) return;

        activityFeed.innerHTML = "";

        snap.forEach((doc) => {
          const activity = doc.data();
          const actEl = document.createElement("div");
          actEl.className = "activity-item";

          const icon = getActivityIcon(activity.type);
          const action = getActivityText(activity.type, activity.target);

          actEl.innerHTML = `
            <span class="activity-icon">${icon}</span>
            <div class="activity-details">
              <span class="activity-user">${activity.by}</span>
              <span class="activity-action">${action}</span>
              <span class="activity-time">${formatActivityTime(activity.timestamp)}</span>
            </div>
          `;

          activityFeed.appendChild(actEl);
        });
      });
  }

  function getActivityIcon(type) {
    const icons = {
      card_created: "➕",
      card_moved: "↔️",
      card_deleted: "🗑️",
      list_created: "📋",
      list_deleted: "🗑️",
      member_added: "👤",
      member_removed: "👤",
    };
    return icons[type] || "•";
  }

  function getActivityText(type, target) {
    const texts = {
      card_created: `creó tarjeta "${target}"`,
      card_moved: `movió tarjeta "${target}"`,
      card_deleted: `eliminó tarjeta`,
      list_created: `creó lista "${target}"`,
      list_deleted: `eliminó lista`,
      member_added: `agregó miembro`,
      member_removed: `removió miembro`,
    };
    return texts[type] || "Realizó una acción";
  }

  function formatActivityTime(timestamp) {
    if (!timestamp) return "";
    const date = new Date(timestamp.toDate());
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);

    if (minutes < 1) return "Ahora";
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    return date.toLocaleDateString("es-ES");
  }

  // ─── Registrar eventos de actividad ────────────────────────

  async function logActivity(type, target = "") {
    if (!boardId || !window.currentUser) return;

    try {
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .doc(boardId)
        .collection("activity")
        .add({
          type: type,
          target: target,
          by: window.currentUser.email,
          timestamp: new Date(),
        });

      // Notificar a otros miembros (opcional, más adelante)
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  }

  return {
    logActivity,
    setupActivityFeed: listenForActivity,
  };
})();

// Exponer para que board.js lo use
window.logActivity = NotificationsModule.logActivity;
