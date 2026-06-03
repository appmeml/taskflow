// ═══════════════════════════════════════════════════════════════════
// MEMBERSHIPS · Compartir tableros, invitaciones, permisos
// ═══════════════════════════════════════════════════════════════════

const MembershipsModule = window.MembershipsModule = (() => {
  const membersList    = document.getElementById("members-list");
  const inviteBtn      = document.getElementById("invite-member-btn");
  const notifBell      = document.getElementById("notification-bell");
  const notifPanel     = document.getElementById("notification-panel");
  const notifList      = document.getElementById("notifications-list");

  let boardId;
  let currentBoard;
  let unreadCount = 0;
  let unsubNotif = null;

  // ── Init callback ───────────────────────────────────────────────
  window.onBoardLoaded = (board, bId) => {
    boardId = bId;
    currentBoard = board;
    loadMembers();
    setupNotificationBell();
  };

  // ── Helpers ─────────────────────────────────────────────────────
  function esc(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function buildJoinUrl() {
    const base = window.location.href.replace(/board\.html.*$/, '');
    return `${base}board.html?id=${boardId}&owner=${window.currentUser.uid}`;
  }

  function fmtTime(ts) {
    if (!ts) return 'Ahora';
    try {
      const date = ts.toDate ? ts.toDate() : new Date(ts);
      const diff = Date.now() - date;
      const m = Math.floor(diff / 60000);
      if (m < 1) return 'Ahora';
      if (m < 60) return `${m}m`;
      const h = Math.floor(m / 60);
      if (h < 24) return `${h}h`;
      return `${Math.floor(h / 24)}d`;
    } catch { return ''; }
  }

  // ── Notification bell ────────────────────────────────────────────
  function setupNotificationBell() {
    if (!notifBell || !window.currentUser) return;
    if (unsubNotif) unsubNotif();

    unsubNotif = db.collection('notifications')
      .doc(window.currentUser.uid)
      .collection('messages')
      .orderBy('createdAt', 'desc')
      .limit(15)
      .onSnapshot(snap => {
        unreadCount = 0;
        if (notifList) notifList.innerHTML = '';

        snap.forEach(doc => {
          const notif = { id: doc.id, ...doc.data() };
          if (!notif.read) unreadCount++;
          renderNotifItem(notif);
        });

        updateBadge();
      }, err => console.warn('notifications listener:', err));
  }

  function renderNotifItem(notif) {
    if (!notifList) return;
    const el = document.createElement('div');
    el.className = `notification-item${notif.read ? '' : ' unread'}`;

    el.innerHTML = `
      <div class="notification-content">
        <div class="notification-message">${esc(notif.message || '')}</div>
        <div class="notification-time">${fmtTime(notif.createdAt)}</div>
      </div>
      ${!notif.read ? '<div class="notification-dot"></div>' : ''}
    `;

    if (notif.type === 'invite' && !notif.read) {
      const acceptBtn = document.createElement('button');
      acceptBtn.className = 'notification-action accept';
      acceptBtn.textContent = 'Aceptar';
      acceptBtn.addEventListener('click', e => {
        e.stopPropagation();
        acceptInvite(notif);
      });

      const rejectBtn = document.createElement('button');
      rejectBtn.className = 'notification-action reject';
      rejectBtn.textContent = 'Rechazar';
      rejectBtn.addEventListener('click', e => {
        e.stopPropagation();
        rejectInvite(notif.id);
      });

      el.appendChild(acceptBtn);
      el.appendChild(rejectBtn);
    } else {
      el.addEventListener('click', () => markAsRead(notif.id));
    }

    notifList.appendChild(el);
  }

  function updateBadge() {
    const badge = notifBell?.querySelector('.notification-badge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.style.display = unreadCount > 0 ? 'flex' : 'none';
    }
  }

  async function markAsRead(id) {
    if (!window.currentUser) return;
    try {
      await db.collection('notifications').doc(window.currentUser.uid)
        .collection('messages').doc(id).update({ read: true });
    } catch(e) { console.warn('markAsRead:', e); }
  }

  // ── Members list ─────────────────────────────────────────────────
  function loadMembers() {
    if (!boardId || !window.currentUser || !membersList) return;

    db.collection('users').doc(window.currentUser.uid)
      .collection('boards').doc(boardId).collection('members')
      .onSnapshot(snap => {
        membersList.innerHTML = '';
        snap.forEach(doc => renderMemberItem(doc.data(), doc.id));
      }, err => console.warn('members listener:', err));
  }

  function renderMemberItem(member, memberId) {
    const item = document.createElement('div');
    item.className = 'member-item';
    const initials = (member.email || '?').split('@')[0].slice(0, 2).toUpperCase();
    const statusLabel = member.status === 'pending' ? ' <span style="font-size:10px;color:var(--gold)">· pendiente</span>' : '';

    item.innerHTML = `
      <div class="member-avatar">${initials}</div>
      <div class="member-info">
        <div class="member-email">${esc(member.email)}</div>
        <div class="member-role">${esc(member.role)}${statusLabel}</div>
      </div>
      <div class="member-actions">
        <select class="member-role-select" data-member-id="${memberId}">
          <option value="viewer"  ${member.role==='viewer'?'selected':''}>Visor</option>
          <option value="editor"  ${member.role==='editor'?'selected':''}>Editor</option>
          <option value="owner"   ${member.role==='owner'?'selected':''}>Propietario</option>
        </select>
        <button class="member-remove" data-member-id="${memberId}" title="Eliminar">✕</button>
      </div>
    `;

    item.querySelector('.member-role-select').addEventListener('change', e =>
      updateMemberRole(memberId, e.target.value));
    item.querySelector('.member-remove').addEventListener('click', () => {
      if (confirm(`¿Eliminar a ${member.email}?`)) removeMember(memberId, member.email);
    });

    membersList.appendChild(item);
  }

  // ── Invite modal ─────────────────────────────────────────────────
  if (inviteBtn) inviteBtn.addEventListener('click', showInviteModal);

  function showInviteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>Invitar miembro</h3>
          <button class="modal-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body">
          <input type="email" id="invite-email" placeholder="email@ejemplo.com" class="invite-input" />
          <select id="invite-role" class="invite-role">
            <option value="viewer">Visor (solo lectura)</option>
            <option value="editor" selected>Editor</option>
          </select>
        </div>
        <div class="modal-footer" style="flex-wrap:wrap;gap:8px;">
          <button class="btn-cancel">Cancelar</button>
          <button class="btn-whatsapp" style="background:#25D366;color:#fff;border:none;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">📱 WhatsApp</button>
          <button class="btn-email"    style="background:#1565C0;color:#fff;border:none;padding:9px 14px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">✉️ Email</button>
          <button class="btn-send">Enviar</button>
        </div>
      </div>
    `;

    const close = () => modal.remove();
    modal.querySelector('.modal-close').addEventListener('click', close);
    modal.querySelector('.btn-cancel').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });

    const emailInput = modal.querySelector('#invite-email');
    const roleSelect = modal.querySelector('#invite-role');

    // ── WhatsApp ────────────────────────────────────────────────
    modal.querySelector('.btn-whatsapp').addEventListener('click', () => {
      const joinUrl  = buildJoinUrl();
      const board    = currentBoard?.title || 'un tablero';
      const from     = window.currentUser?.email || 'alguien';
      const text = `¡Hola! 👋 *${from}* te invita a colaborar en el tablero *"${board}"* en *TaskFlow*.\n\nUsa este enlace para unirte directamente:\n${joinUrl}\n\n_(Necesitarás una cuenta en TaskFlow)_`;
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
    });

    // ── Email ───────────────────────────────────────────────────
    modal.querySelector('.btn-email').addEventListener('click', () => {
      const to       = emailInput.value.trim();
      const joinUrl  = buildJoinUrl();
      const board    = currentBoard?.title || 'un tablero';
      const from     = window.currentUser?.email || 'alguien';
      const subject  = encodeURIComponent(`Invitación a "${board}" en TaskFlow`);
      const body     = encodeURIComponent(
        `¡Hola!\n\n${from} te invitó a colaborar en el tablero "${board}" en TaskFlow.\n\nHaz clic en el siguiente enlace para unirte:\n${joinUrl}\n\nNecesitarás una cuenta en TaskFlow (registro gratuito).\n\n¡Nos vemos en el tablero!`
      );
      window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    });

    // ── Enviar invitación in-app ────────────────────────────────
    modal.querySelector('.btn-send').addEventListener('click', () => {
      const email = emailInput.value.trim().toLowerCase();
      const role  = roleSelect.value;
      if (!email) { window.showToast('Escribe un email', 'error'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        window.showToast('Email inválido', 'error'); return;
      }
      sendInvitation(email, role);
      close();
    });

    document.body.appendChild(modal);
    emailInput.focus();
  }

  // ── Send invitation ──────────────────────────────────────────────
  async function sendInvitation(email, role) {
    if (!boardId || !window.currentUser || !currentBoard) return;

    try {
      const usersSnap = await db.collection('users').where('email', '==', email).get();
      if (usersSnap.empty) {
        window.showToast('Usuario no encontrado en TaskFlow', 'error');
        return;
      }

      const targetUserId   = usersSnap.docs[0].id;
      const ownerUid       = window.currentUser.uid;

      // Register as pending member
      await db.collection('users').doc(ownerUid)
        .collection('boards').doc(boardId)
        .collection('members').doc(targetUserId)
        .set({
          userId:    targetUserId,
          email,
          role,
          status:    'pending',
          invitedBy: window.currentUser.email,
          invitedAt: new Date(),
        });

      // Send notification with full join context
      await sendNotification(targetUserId, 'invite',
        `${window.currentUser.email} te invitó a "${currentBoard.title}"`,
        {
          boardId,
          boardName: currentBoard.title,
          ownerUid,                          // ← clave para aceptar luego
          invitedBy: window.currentUser.email,
          joinUrl:   buildJoinUrl(),
        }
      );

      window.showToast(`✅ Invitación enviada a ${email}`);
    } catch (error) {
      window.showError(error);
    }
  }

  // ── Accept / reject ──────────────────────────────────────────────
  async function acceptInvite(notif) {
    if (!window.currentUser) return;

    try {
      await markAsRead(notif.id);

      // Change member status to active on owner's board
      if (notif.boardId && notif.ownerUid) {
        await db.collection('users').doc(notif.ownerUid)
          .collection('boards').doc(notif.boardId)
          .collection('members').doc(window.currentUser.uid)
          .update({ status: 'active', joinedAt: new Date() });
      }

      window.showToast('✅ Invitación aceptada');

      // Navigate to the shared board
      if (notif.boardId && notif.ownerUid) {
        const base = window.location.href.replace(/[^/]*$/, '');
        location.href = `${base}board.html?id=${notif.boardId}&owner=${notif.ownerUid}`;
      }
    } catch (error) {
      window.showError(error);
    }
  }

  async function rejectInvite(notifId) {
    if (!window.currentUser) return;
    try {
      await db.collection('notifications').doc(window.currentUser.uid)
        .collection('messages').doc(notifId).delete();
      window.showToast('Invitación rechazada');
    } catch (error) { window.showError(error); }
  }

  // ── Member management ────────────────────────────────────────────
  async function updateMemberRole(memberId, newRole) {
    if (!boardId || !window.currentUser) return;
    try {
      await db.collection('users').doc(window.currentUser.uid)
        .collection('boards').doc(boardId)
        .collection('members').doc(memberId)
        .update({ role: newRole });
      window.showToast('Rol actualizado');
    } catch(e) { window.showError(e); }
  }

  async function removeMember(memberId, memberEmail) {
    if (!boardId || !window.currentUser) return;
    try {
      await db.collection('users').doc(window.currentUser.uid)
        .collection('boards').doc(boardId)
        .collection('members').doc(memberId).delete();

      await sendNotification(memberId, 'activity',
        `Fuiste removido del tablero "${currentBoard?.title || ''}" por ${window.currentUser.email}`, {});

      window.showToast(`${memberEmail} removido`);
    } catch(e) { window.showError(e); }
  }

  // ── Notification helper ──────────────────────────────────────────
  async function sendNotification(userId, type, message, metadata = {}) {
    try {
      await db.collection('notifications').doc(userId).collection('messages').add({
        type, message, read: false, createdAt: new Date(), ...metadata,
      });
    } catch (error) { console.warn('sendNotification failed:', error); }
  }

  return { sendNotification, updateMembers: loadMembers };
})();
