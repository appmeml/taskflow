// ═══════════════════════════════════════════════════════════════════
// AUTENTICACIÓN - Sin módulos (funciona en HTML puro)
// ═══════════════════════════════════════════════════════════════════

const authForm = document.getElementById('auth-form');
const toggleModeBtn = document.getElementById('toggle-mode');
const logoutBtn = document.getElementById('logout-btn');
const userEmailSpan = document.getElementById('user-email');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const nameField = document.getElementById('name-field');

let isRegisterMode = false;

// Toggle entre login y registro
if (toggleModeBtn) {
  toggleModeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    nameField.style.display = isRegisterMode ? 'block' : 'none';
    authForm.querySelector('button').textContent = isRegisterMode ? 'Crear cuenta' : 'Iniciar sesión';
    toggleModeBtn.innerHTML = isRegisterMode 
      ? '¿Ya tienes cuenta? <a href="#">Inicia sesión aquí</a>' 
      : '¿No tienes cuenta? <a href="#">Regístrate aquí</a>';
  });
}

// Handle login/register
if (authForm) {
  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const name = document.getElementById('name').value;
    
    try {
      if (isRegisterMode) {
        // REGISTRAR
        if (!name) {
          window.showToast('Por favor ingresa tu nombre', 'error');
          return;
        }
        
        const result = await firebase.auth().createUserWithEmailAndPassword(email, password);
        const user = result.user;
        
        // Guardar usuario en Firestore
        await db.collection('users').doc(user.uid).set({
          email: email,
          name: name,
          createdAt: new Date()
        });
        
        window.showToast('✅ Cuenta creada exitosamente');
        authForm.reset();
        isRegisterMode = false;
        nameField.style.display = 'none';
        authForm.querySelector('button').textContent = 'Iniciar sesión';
        
      } else {
        // INICIAR SESIÓN
        await firebase.auth().signInWithEmailAndPassword(email, password);
        window.showToast('✅ Sesión iniciada');
        authForm.reset();
      }
    } catch (error) {
      console.error('Error de auth:', error);
      window.showError(error);
    }
  });
}

// Handle logout
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      await firebase.auth().signOut();
      window.showToast('Sesión cerrada');
    } catch (error) {
      window.showError(error);
    }
  });
}

// Monitorear cambios de autenticación
firebase.auth().onAuthStateChanged((user) => {
  window.currentUser = user;
  
  if (user) {
    // Usuario LOGUEADO
    console.log('✅ Usuario autenticado:', user.email);
    authContainer.style.display = 'none';
    appContainer.style.display = 'block';
    if (userEmailSpan) userEmailSpan.textContent = user.email;
    
    // Cargar tableros
    loadBoards();
  } else {
    // Usuario NO LOGUEADO
    console.log('❌ Sin usuario');
    authContainer.style.display = 'block';
    appContainer.style.display = 'none';
  }
});
