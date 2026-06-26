// Email <-> Realtime Database key encoding. RTDB keys may not contain
// '.', '#', '$', '[', ']' or '/', so we percent-encode exactly those. The
// transform is deterministic and collision-free, and the Cloud Functions use an
// identical encoder so client-written keys line up with server-read keys.

export function emailKey(email) {
  return String(email)
    .trim()
    .toLowerCase()
    .replace(/[.#$/[\]]/g, (char) => "%" + char.charCodeAt(0).toString(16));
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}
