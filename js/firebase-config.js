// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjRj5Ba8HQiqb6W4UBAVDGMgVLhidvGsk",
  authDomain: "taskflow-ec.firebaseapp.com",
  projectId: "taskflow-ec",
  storageBucket: "taskflow-ec.firebasestorage.app",
  messagingSenderId: "175224756577",
  appId: "1:175224756577:web:3fef747dcae223c934cd20"
};

firebase.initializeApp(firebaseConfig);
window.auth = firebase.auth();
window.db = firebase.firestore();
// Aliases so existing scripts that use bare `db`/`auth` still work
const auth = window.auth;
const db = window.db;

window.showToast = function(message, type = 'success') {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => { requestAnimationFrame(() => toast.classList.add('show')); });
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
};

window.showError = function(error) {
  const message = error.message || error;
  console.error(message);
  window.showToast(message, 'error');
};

window.currentUser = null;

async function initWorkspace(user) {
  try {
    const memberRef = window.db.collection('workspaceMembers').doc(user.uid);
    const configRef = window.db.collection('workspaceConfig').doc('settings');

    const memberDoc = await memberRef.get();
    if (!memberDoc.exists) {
      const configDoc = await configRef.get();
      const isFirst = !configDoc.exists;
      await memberRef.set({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || (user.email || '').split('@')[0] || 'Usuario',
        role: isFirst ? 'admin' : 'member',
        joinedAt: new Date(),
        photoURL: user.photoURL || null
      });
      if (isFirst) {
        await configRef.set({
          membershipRestriction: 'open',
          boardCreation: { public: 'any', workspace: 'any', private: 'any' },
          boardDeletion: { public: 'any', workspace: 'any', private: 'any' },
          guestInvitations: 'any',
          createdAt: new Date(),
          createdBy: user.uid
        });
      }
    }

    const [cfgDoc, memDoc] = await Promise.all([configRef.get(), memberRef.get()]);
    window.workspaceConfig = cfgDoc.exists ? cfgDoc.data() : {
      membershipRestriction: 'open',
      boardCreation: { public: 'any', workspace: 'any', private: 'any' },
      boardDeletion: { public: 'any', workspace: 'any', private: 'any' },
      guestInvitations: 'any'
    };
    window.isAdmin = memDoc.exists && memDoc.data().role === 'admin';
  } catch(e) {
    console.warn('Workspace init error:', e);
    window.workspaceConfig = {
      membershipRestriction: 'open',
      boardCreation: { public: 'any', workspace: 'any', private: 'any' },
      boardDeletion: { public: 'any', workspace: 'any', private: 'any' },
      guestInvitations: 'any'
    };
    window.isAdmin = false;
  }
}

firebase.auth().onAuthStateChanged(async (user) => {
  window.currentUser = user;
  if (user) {
    console.log('✅ Usuario autenticado:', user.email);
    await initWorkspace(user);
    if (window.onUserReady) window.onUserReady();
  } else {
    console.log('❌ Usuario NO autenticado — redirigiendo');
    window.location.href = 'index.html';
  }
});
