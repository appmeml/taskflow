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

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

window.showToast = function(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
};

window.showError = function(error) {
  const message = error.message || error;
  console.error(message);
  window.showToast(message, 'error');
};

window.currentUser = null;

firebase.auth().onAuthStateChanged((user) => {
  window.currentUser = user;
  if (user) {
    console.log('✅ Usuario autenticado:', user.email);
  } else {
    console.log('❌ Usuario NO autenticado');
  }
});
