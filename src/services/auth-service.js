import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from "firebase/auth";

export function watchAuthState(auth, onChange) {
  return onAuthStateChanged(auth, onChange);
}

export function signInWithEmail(auth, email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function createAccountWithEmail(auth, email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithGoogle(auth) {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function signOutUser(auth) {
  return signOut(auth);
}
