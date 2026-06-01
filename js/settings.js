// ═══════════════════════════════════════════════════════════════════
// SETTINGS · Preferencias de notificación y seguridad
// ═══════════════════════════════════════════════════════════════════

const SettingsModule = (() => {
  let settingsPanel = document.getElementById("settings-panel");
  let settingsBtn = document.getElementById("settings-btn");

  if (!settingsBtn) {
    console.log("⚠️ Settings no disponible en esta página");
    return {};
  }

  // Abrir/cerrar settings
  settingsBtn.addEventListener("click", () => {
    if (settingsPanel.style.display === "none") {
      settingsPanel.style.display = "block";
      loadSettings();
    } else {
      settingsPanel.style.display = "none";
    }
  });

  async function loadSettings() {
    if (!window.currentUser) return;

    try {
      const settingsDoc = await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("settings")
        .doc("notifications")
        .get();

      const settings = settingsDoc.exists ? settingsDoc.data() : getDefaultSettings();

      renderSettings(settings);
    } catch (error) {
      window.showError(error);
    }
  }

  function getDefaultSettings() {
    return {
      emailNotifications: true,
      emailInvites: true,
      emailActivity: false,
      digestFrequency: "immediate", // "immediate", "daily", "weekly"
    };
  }

  function renderSettings(settings) {
    const content = settingsPanel.querySelector(".settings-content");
    if (!content) return;

    content.innerHTML = `
      <div class="settings-section">
        <h3>Notificaciones por Email</h3>
        
        <div class="settings-item">
          <label>
            <input type="checkbox" id="email-all" 
              ${settings.emailNotifications ? "checked" : ""}
              class="settings-checkbox" />
            Habilitar todas
          </label>
          <span class="settings-hint">Recibir emails de notificaciones</span>
        </div>

        <div class="settings-item" style="margin-left: 20px;">
          <label>
            <input type="checkbox" id="email-invites" 
              ${settings.emailInvites ? "checked" : ""}
              class="settings-checkbox" />
            Invitaciones
          </label>
          <span class="settings-hint">Cuando alguien te invita a un tablero</span>
        </div>

        <div class="settings-item" style="margin-left: 20px;">
          <label>
            <input type="checkbox" id="email-activity" 
              ${settings.emailActivity ? "checked" : ""}
              class="settings-checkbox" />
            Actividad
          </label>
          <span class="settings-hint">Cambios en tableros compartidos</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>Frecuencia de Digests</h3>
        <select id="digest-frequency" class="settings-select">
          <option value="immediate" ${settings.digestFrequency === "immediate" ? "selected" : ""}>
            Inmediato
          </option>
          <option value="daily" ${settings.digestFrequency === "daily" ? "selected" : ""}>
            Diario (9 AM)
          </option>
          <option value="weekly" ${settings.digestFrequency === "weekly" ? "selected" : ""}>
            Semanal (lunes 9 AM)
          </option>
        </select>
      </div>

      <div class="settings-section">
        <h3>Privacidad</h3>
        <div class="settings-item">
          <button id="export-data" class="btn-secondary">
            📥 Descargar mis datos
          </button>
          <span class="settings-hint">Exportar perfil, tableros y datos</span>
        </div>

        <div class="settings-item">
          <button id="delete-account" class="btn-danger">
            🗑️ Eliminar cuenta
          </button>
          <span class="settings-hint">Permanentemente. No se puede deshacer.</span>
        </div>
      </div>

      <div class="settings-actions">
        <button id="save-settings" class="btn-primary">Guardar cambios</button>
      </div>
    `;

    // Event listeners
    document.getElementById("email-all").addEventListener("change", (e) => {
      const checkboxes = [
        document.getElementById("email-invites"),
        document.getElementById("email-activity"),
      ];
      checkboxes.forEach((cb) => (cb.disabled = !e.target.checked));
    });

    document.getElementById("save-settings").addEventListener("click", saveSettings);
    document.getElementById("export-data").addEventListener("click", exportData);
    document.getElementById("delete-account").addEventListener("click", deleteAccount);
  }

  async function saveSettings() {
    if (!window.currentUser) return;

    try {
      const settings = {
        emailNotifications: document.getElementById("email-all").checked,
        emailInvites: document.getElementById("email-invites").checked,
        emailActivity: document.getElementById("email-activity").checked,
        digestFrequency: document.getElementById("digest-frequency").value,
        updatedAt: new Date(),
      };

      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("settings")
        .doc("notifications")
        .set(settings, { merge: true });

      window.showToast("Preferencias guardadas");
    } catch (error) {
      window.showError(error);
    }
  }

  async function exportData() {
    if (!window.currentUser) return;

    try {
      window.showToast("Generando export... (puede tardar)", "info");

      // Obtener usuario
      const userDoc = await db
        .collection("users")
        .doc(window.currentUser.uid)
        .get();

      // Obtener tableros
      const boardsSnap = await db
        .collection("users")
        .doc(window.currentUser.uid)
        .collection("boards")
        .get();

      const boards = [];
      for (const boardDoc of boardsSnap.docs) {
        const board = boardDoc.data();
        const listsSnap = await boardDoc.ref.collection("lists").get();

        const lists = [];
        for (const listDoc of listsSnap.docs) {
          const list = listDoc.data();
          const cardsSnap = await listDoc.ref.collection("cards").get();
          list.cards = cardsSnap.docs.map((cd) => cd.data());
          lists.push(list);
        }

        board.lists = lists;
        boards.push(board);
      }

      // Crear JSON
      const exportData = {
        exportedAt: new Date().toISOString(),
        user: userDoc.data(),
        boards: boards,
      };

      // Descargar como JSON
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `taskflow-export-${Date.now()}.json`;
      link.click();

      window.showToast("Datos descargados");
    } catch (error) {
      window.showError(error);
    }
  }

  async function deleteAccount() {
    if (!confirm("⚠️ Esto eliminará tu cuenta y TODOS tus tableros. ¿Estás seguro?"))
      return;

    if (
      !confirm(
        "Esta acción no se puede deshacer. Escribe tu email para confirmar."
      )
    )
      return;

    const emailConfirm = prompt(
      `Confirma escribiendo: ${window.currentUser.email}`
    );
    if (emailConfirm !== window.currentUser.email) {
      window.showToast("Email no coincide", "error");
      return;
    }

    try {
      // Eliminar todos los datos del usuario
      await db
        .collection("users")
        .doc(window.currentUser.uid)
        .delete();

      // Eliminar notificaciones
      const notifDocs = await db
        .collection("notifications")
        .doc(window.currentUser.uid)
        .collection("messages")
        .get();

      for (const doc of notifDocs.docs) {
        await doc.ref.delete();
      }

      // Eliminar usuario de Firebase Auth
      const user = firebase.auth().currentUser;
      await user.delete();

      window.showToast("Cuenta eliminada");
      setTimeout(() => {
        location.href = "index.html";
      }, 2000);
    } catch (error) {
      window.showError(error);
    }
  }

  return { loadSettings };
})();
