// WorkspaceModule — shared permission helper
// Exposed as window.WorkspaceModule
(function() {
  'use strict';

  function getConfig() {
    return window.workspaceConfig || {
      membershipRestriction: 'open',
      boardCreation: { public: 'any', workspace: 'any', private: 'any' },
      boardDeletion: { public: 'any', workspace: 'any', private: 'any' },
      guestInvitations: 'any'
    };
  }

  function canDo(action) {
    // Admins can always do everything
    if (window.isAdmin === true) return true;

    const cfg = getConfig();

    switch (action) {
      case 'createBoard': {
        const bc = cfg.boardCreation || {};
        // Default boards created in TaskFlow are private
        return (bc.private || 'any') !== 'admin';
      }
      case 'deleteBoard': {
        const bd = cfg.boardDeletion || {};
        return (bd.private || 'any') !== 'admin';
      }
      case 'addMember': {
        return (cfg.membershipRestriction || 'open') !== 'admin';
      }
      case 'inviteGuest': {
        return (cfg.guestInvitations || 'any') !== 'admin';
      }
      default:
        return true;
    }
  }

  function permissionError(action) {
    const messages = {
      createBoard: 'Solo los administradores pueden crear tableros en este espacio de trabajo.',
      deleteBoard: 'Solo los administradores pueden eliminar tableros en este espacio de trabajo.',
      addMember: 'Solo los administradores pueden añadir miembros al espacio de trabajo.',
      inviteGuest: 'Solo los administradores pueden enviar invitaciones en este espacio de trabajo.'
    };
    const msg = messages[action] || 'No tienes permiso para realizar esta acción.';
    if (window.showToast) {
      window.showToast(msg, 'error');
    }
  }

  window.WorkspaceModule = { canDo, permissionError };
})();
