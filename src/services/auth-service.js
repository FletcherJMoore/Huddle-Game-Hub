import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
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

export function setPhotoURL(user, photoURL) {
  return updateProfile(user, { photoURL });
}

export function updateUserPassword(user, password) {
  return updatePassword(user, password);
}

// Returns the providers already linked to the account (e.g. "google.com").
export function linkedProviders(user) {
  return (user?.providerData ?? []).map((p) => p.providerId);
}

export function linkGoogle(user) {
  return linkWithPopup(user, new GoogleAuthProvider());
}

export function signOutUser(auth) {
  return signOut(auth);
}
