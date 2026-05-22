import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

import { auth } from './firebase.js';

export function listenAuth(onLoggedIn, onLoggedOut) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onLoggedIn(user);
    else onLoggedOut();
  });
}

export async function loginWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function logout() {
  return signOut(auth);
}

