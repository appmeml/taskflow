// ═══════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE · Motor de automatización estilo Butler
// ═══════════════════════════════════════════════════════════════════

window.AutomationEngine = (() => {
  'use strict';

  let _boardId, _uid, _getBoardData;
  let _automations = [];
  let _unsubscribe = null;

  // ── Init / Destroy ───────────────────────────────────────────────

  function init(boardId, uid, getBoardData) {
    _boardId = boardId;
    _uid = uid;
    _getBoardData = getBoardData;

    if (_unsubscribe) _unsubscribe();

    _unsubscribe = window.db
      .collection('users').doc(uid)
      .collection('boards').doc(boardId)
      .collection('automations')
      .orderBy('createdAt', 'asc')
      .onSnapshot(snap => {
        _automations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        _renderBoardButtons();
      }, () => { _automations = []; });
  }

  function destroy() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
    _automations = [];
  }

  // ── Event Hooks (called by board.js) ─────────────────────────────

  function onCardMoved(cardId, card, toListId) {
    _automations
      .filter(a => a.enabled !== false && a.type === 'rule' &&
        a.trigger?.type === 'card_moved_to_list' && a.trigger?.listId === toListId)
      .forEach(a => _executeActions(a.actions, cardId, toListId, card, a.id));
  }

  function onCardCreated(cardId, card, listId) {
    _automations
      .filter(a => a.enabled !== false && a.type === 'rule' &&
        a.trigger?.type === 'card_created_in_list' && a.trigger?.listId === listId)
      .forEach(a => _executeActions(a.actions, cardId, listId, card, a.id));
  }

  // ── Action Executor ──────────────────────────────────────────────

  async function _executeActions(actions, cardId, currentListId, card, automationId) {
    if (!actions?.length) return;
    const boardRef = window.db.collection('users').doc(_uid)
      .collection('boards').doc(_boardId);
    let listId = currentListId;

    for (const action of actions) {
      try {
        switch (action.type) {

          case 'move_to_list': {
            if (!action.listId || action.listId === listId) break;
            const bd = _getBoardData?.() || {};
            const pos = ((bd.lists?.[action.listId]?.cards || []).slice(-1)[0]?.position || 0) + 65536;
            const snap = await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).get();
            if (!snap.exists) return;
            await boardRef.collection('lists').doc(action.listId)
              .collection('cards').doc(cardId).set({ ...snap.data(), position: pos });
            await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).delete();
            listId = action.listId;
            if (window.logActivity) window.logActivity('card_move', card?.title || '');
            break;
          }

          case 'move_to_top': {
            const bd = _getBoardData?.() || {};
            const cards = bd.lists?.[listId]?.cards || [];
            const minPos = cards.reduce((m, c) => Math.min(m, c.position || 65536), 65536);
            await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).update({ position: Math.max(1, minPos - 65536) });
            break;
          }

          case 'move_to_bottom': {
            const bd = _getBoardData?.() || {};
            const cards = bd.lists?.[listId]?.cards || [];
            const maxPos = cards.reduce((m, c) => Math.max(m, c.position || 0), 0);
            await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).update({ position: maxPos + 65536 });
            break;
          }

          case 'archive_card': {
            await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).delete();
            if (window.logActivity) window.logActivity('card_delete', card?.title || '');
            _bumpRunCount(automationId);
            return; // card gone — stop
          }

          case 'copy_card_to_list': {
            if (!action.listId) break;
            const bd = _getBoardData?.() || {};
            const pos = ((bd.lists?.[action.listId]?.cards || []).slice(-1)[0]?.position || 0) + 65536;
            const snap = await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).get();
            if (!snap.exists) break;
            await boardRef.collection('lists').doc(action.listId)
              .collection('cards').add({ ...snap.data(), position: pos, createdAt: new Date() });
            break;
          }

          case 'post_comment': {
            if (window.logActivity)
              window.logActivity('card_update', `${card?.title || ''} — ${action.text || ''}`);
            break;
          }

          case 'rename_prepend': {
            if (!action.text) break;
            await boardRef.collection('lists').doc(listId)
              .collection('cards').doc(cardId).update({ title: `${action.text} ${card?.title || ''}` });
            break;
          }
        }
      } catch (e) {
        console.warn('AutomationEngine action failed:', action.type, e);
      }
    }
    _bumpRunCount(automationId);
  }

  // ── Board-wide button actions ────────────────────────────────────

  async function runBoardButton(automationId) {
    const auto = _automations.find(a => a.id === automationId);
    if (!auto) return;
    const bd = _getBoardData?.() || {};
    const boardRef = window.db.collection('users').doc(_uid)
      .collection('boards').doc(_boardId);

    for (const action of (auto.actions || [])) {
      try {
        switch (action.type) {

          case 'archive_all_in_list': {
            const listId = action.listId;
            if (!listId || !bd.lists?.[listId]) break;
            const cards = bd.lists[listId].cards || [];
            if (!cards.length) { if (window.showToast) window.showToast('La lista ya está vacía'); break; }
            const batch = window.db.batch();
            cards.forEach(c => batch.delete(
              boardRef.collection('lists').doc(listId).collection('cards').doc(c.id)
            ));
            await batch.commit();
            if (window.showToast) window.showToast(`✅ ${cards.length} tarjetas archivadas`);
            break;
          }

          case 'sort_list_by_title': {
            const listId = action.listId;
            if (!listId || !bd.lists?.[listId]) break;
            const sorted = [...(bd.lists[listId].cards || [])].sort((a, b) =>
              a.title.localeCompare(b.title, 'es', { sensitivity: 'base' }));
            const batch = window.db.batch();
            sorted.forEach((c, i) => batch.update(
              boardRef.collection('lists').doc(listId).collection('cards').doc(c.id),
              { position: (i + 1) * 65536 }
            ));
            await batch.commit();
            if (window.showToast) window.showToast('✅ Lista ordenada');
            break;
          }

          case 'move_all_to_list': {
            const { fromListId, toListId } = action;
            if (!fromListId || !toListId || !bd.lists?.[fromListId] || !bd.lists?.[toListId]) break;
            const cards = bd.lists[fromListId].cards || [];
            if (!cards.length) { if (window.showToast) window.showToast('No hay tarjetas para mover'); break; }
            let pos = ((bd.lists[toListId].cards || []).slice(-1)[0]?.position || 0);
            const batch = window.db.batch();
            cards.forEach(c => {
              pos += 65536;
              batch.set(boardRef.collection('lists').doc(toListId).collection('cards').doc(c.id),
                { ...c, position: pos });
              batch.delete(boardRef.collection('lists').doc(fromListId).collection('cards').doc(c.id));
            });
            await batch.commit();
            if (window.showToast) window.showToast(`✅ ${cards.length} tarjetas movidas`);
            break;
          }
        }
      } catch (e) {
        console.warn('AutomationEngine board action failed:', action.type, e);
        if (window.showToast) window.showToast('Error en automatización', 'error');
      }
    }
    _bumpRunCount(automationId);
  }

  // ── Card Buttons ─────────────────────────────────────────────────

  function getCardButtons() {
    return _automations.filter(a => a.enabled !== false && a.type === 'card_button');
  }

  async function runCardButton(automationId, cardId, listId, card) {
    const auto = _automations.find(a => a.id === automationId);
    if (!auto) return;
    await _executeActions(auto.actions, cardId, listId, card, automationId);
  }

  // ── Board Button Rendering ────────────────────────────────────────

  function _renderBoardButtons() {
    const bar = document.getElementById('automation-bar');
    if (!bar) return;
    const btns = _automations.filter(a => a.enabled !== false && a.type === 'board_button');
    if (!btns.length) { bar.style.display = 'none'; _syncListsTop(0); return; }
    bar.style.display = 'flex';
    bar.innerHTML = btns.map(a =>
      `<button class="auto-board-btn" data-id="${a.id}">
        <span class="auto-btn-icon">${a.icon || '⚡'}</span>${_esc(a.name)}
       </button>`
    ).join('');
    bar.querySelectorAll('.auto-board-btn').forEach(btn =>
      btn.addEventListener('click', () => runBoardButton(btn.dataset.id))
    );
    _syncListsTop(bar.offsetHeight || 44);
  }

  function _syncListsTop(extraPx) {
    const lc = document.getElementById('lists-container');
    if (!lc) return;
    if (extraPx > 0) {
      lc.style.marginTop = `calc(var(--board-nav-h) + ${extraPx}px)`;
      lc.style.height    = `calc(100vh - var(--board-nav-h) - ${extraPx}px)`;
    } else {
      lc.style.marginTop = '';
      lc.style.height    = '';
    }
  }

  // ── Utils ────────────────────────────────────────────────────────

  function _bumpRunCount(id) {
    if (!id) return;
    window.db.collection('users').doc(_uid).collection('boards').doc(_boardId)
      .collection('automations').doc(id)
      .update({
        runCount: firebase.firestore.FieldValue.increment(1),
        lastRun: new Date()
      }).catch(() => {});
  }

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return { init, destroy, onCardMoved, onCardCreated, getCardButtons, runCardButton, renderBoardButtons: _renderBoardButtons };
})();
