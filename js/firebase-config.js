// ═══════════════════════════════════════════════════════════════════
// FIREBASE CONFIG · Reemplaza con tus credenciales desde Firebase Console
// ═══════════════════════════════════════════════════════════════════

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBjRj5Ba8HQiqb6W4UBAVDGMgVLhidvGsk",
  authDomain: "taskflow-ec.firebaseapp.com",
  projectId: "taskflow-ec",
  storageBucket: "taskflow-ec.firebasestorage.app",
  messagingSenderId: "175224756577",
  appId: "1:175224756577:web:3fef747dcae223c934cd20"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales
const auth = firebase.auth();
const db = firebase.firestore();

// Escuchar cambios de sesión
auth.onAuthStateChanged((user) => {
  if (user) {
    // Usuario autenticado
    window.currentUser = user;
    document.getElementById("auth-container")?.style.display = "none";
    document.getElementById("app-container")?.style.display = "block";
    if (window.onUserReady) window.onUserReady(user);
  } else {
    // Usuario desconectado
    window.currentUser = null;
    document.getElementById("auth-container")?.style.display = "block";
    document.getElementById("app-container")?.style.display = "none";
  }
});

// Utilidades
window.showToast = (message, type = "success") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

window.showError = (error) => {
  console.error(error);
  const msg = error.message || "Error desconocido";
  window.showToast(msg, "error");
};
