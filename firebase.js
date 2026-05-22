
// Firebase v9 (modular) - inicialización (SIN build, usando CDN)
// No cambia tu UI, solo conecta Auth + Firestore.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyDyaNZzOuj2MZWoqH6J7Yo0HLJY9JveLpI',
  authDomain: 'institiut.firebaseapp.com',
  projectId: 'institiut',
  storageBucket: 'institiut.firebasestorage.app',
  messagingSenderId: '407523530299',
  appId: '1:407523530299:web:b682ecdb6c876553d0ae1e',
  measurementId: 'G-LVVS15QDE9'
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
