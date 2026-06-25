import { store } from "../../state/store.js";
import { elements } from "../../state/dom.js";
import {
  createAccountWithEmail,
  sendVerificationEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser
} from "../../services/auth-service.js";
import { getFriendlyAuthError } from "../../utils/firebase-errors.js";
import { displayName } from "../boards/board-model.js";

export function setAuthError(message = "") {
  elements.authError.textContent = message;
  elements.authError.classList.toggle("hidden", !message);
}

export function setAuthNotice(message = "") {
  elements.authNotice.textContent = message;
  elements.authNotice.classList.toggle("hidden", !message);
}

function setAuthLoading(isLoading) {
  elements.emailSignInButton.disabled = isLoading;
  elements.emailSignUpButton.disabled = isLoading;
  elements.googleSignInButton.disabled = isLoading;
}

export function renderAccount() {
  const name = displayName();
  const initials = name
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

  elements.authStatus.textContent = "Signed in";
  elements.authDetail.textContent = store.currentUser?.email || "Authenticated user";
  elements.profileAvatar.textContent = initials || "U";
  elements.profileMenuAvatar.textContent = initials || "U";
  elements.settingsDisplayName.textContent = store.currentUser?.displayName || displayName();
  elements.settingsEmail.textContent = store.currentUser?.email || "Not available";
}

async function authenticateWithEmail(mode) {
  setAuthError();
  setAuthNotice();
  setAuthLoading(true);

  try {
    const email = elements.authEmail.value.trim();
    const password = elements.authPassword.value;
    if (mode === "signUp") {
      const credential = await createAccountWithEmail(store.services.auth, email, password);
      await sendVerificationEmail(credential.user);
      await signOutUser(store.services.auth);
      setAuthNotice("Verification email sent. Confirm your email, then log in.");
    } else {
      await signInWithEmail(store.services.auth, email, password);
    }
    elements.emailAuthForm.reset();
  } catch (error) {
    console.error("Email authentication failed", error);
    setAuthError(getFriendlyAuthError(error));
  } finally {
    setAuthLoading(false);
  }
}

export function bindAuthEvents() {
  elements.emailAuthForm.addEventListener("submit", (event) => {
    event.preventDefault();
    authenticateWithEmail("signIn");
  });

  elements.emailSignUpButton.addEventListener("click", () => {
    authenticateWithEmail("signUp");
  });

  elements.googleSignInButton.addEventListener("click", async () => {
    setAuthError();
    setAuthLoading(true);
    try {
      await signInWithGoogle(store.services.auth);
    } catch (error) {
      console.error("Google authentication failed", error);
      setAuthError(getFriendlyAuthError(error));
    } finally {
      setAuthLoading(false);
    }
  });

  elements.signOutButton.addEventListener("click", () => {
    signOutUser(store.services.auth);
  });
}
