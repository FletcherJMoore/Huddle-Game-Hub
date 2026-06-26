import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
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

export function sendVerificationEmail(user) {
  return sendEmailVerification(user);
}

export function signInWithGoogle(auth) {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export function setDisplayName(user, name) {
  return updateProfile(user, { displayName: name });
}

export function signOutUser(auth) {
  return signOut(auth);
}
