// ═══════════════════════════════════════════════════════════════════
// AUTH · Login y registro con Firebase Authentication
// ═══════════════════════════════════════════════════════════════════

const AuthModule = (() => {
  const form = document.getElementById("auth-form");
  const mode = document.getElementById("auth-mode");
  const toggle = document.getElementById("toggle-mode");

  let currentMode = "login";

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const name = document.getElementById("name")?.value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      try {
        if (currentMode === "login") {
          await auth.signInWithEmailAndPassword(email, password);
          window.showToast("¡Bienvenido!");
        } else {
          // Registro: crear usuario en Auth + documento en Firestore
          const userCred = await auth.createUserWithEmailAndPassword(
            email,
            password
          );
          const user = userCred.user;

          // Guardar perfil en Firestore
          await db.collection("users").doc(user.uid).set({
            name: name || email.split("@")[0],
            email: email,
            createdAt: new Date(),
          });

          window.showToast("¡Cuenta creada! Bienvenido.");
        }
      } catch (error) {
        if (error.code === "auth/email-already-in-use") {
          window.showToast("Email ya registrado", "error");
        } else if (error.code === "auth/weak-password") {
          window.showToast("Contraseña muy débil (8+ caracteres)", "error");
        } else if (error.code === "auth/user-not-found") {
          window.showToast("Email no registrado", "error");
        } else if (error.code === "auth/wrong-password") {
          window.showToast("Contraseña incorrecta", "error");
        } else {
          window.showError(error);
        }
      }
    });
  }

  if (toggle) {
    toggle.addEventListener("click", () => {
      currentMode = currentMode === "login" ? "register" : "login";

      const heading = document.querySelector(".auth-heading h1");
      const nameField = document.getElementById("name-field");
      const submit = document.querySelector('button[type="submit"]');

      if (currentMode === "login") {
        heading.textContent = "Iniciar sesión";
        nameField.style.display = "none";
        submit.textContent = "Iniciar sesión";
        toggle.innerHTML =
          "¿No tienes cuenta? <a href='#'>Regístrate aquí</a>";
      } else {
        heading.textContent = "Crear cuenta";
        nameField.style.display = "block";
        submit.textContent = "Crear cuenta";
        toggle.innerHTML = "¿Ya tienes cuenta? <a href='#'>Inicia sesión</a>";
      }
    });
  }

  return {
    logout() {
      auth.signOut();
      window.showToast("Sesión cerrada");
    },
  };
})();
