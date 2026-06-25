const messages = {
  "auth/email-already-in-use": "That email already has an account.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/invalid-credential": "The email or password is incorrect.",
  "auth/popup-closed-by-user": "Google sign-in was closed before it finished.",
  "auth/weak-password": "Use a password with at least 6 characters."
};

export function getFriendlyAuthError(error) {
  return messages[error?.code] ?? "Something went wrong. Please try again.";
}
