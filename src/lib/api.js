// Thin fetch wrapper for the backend API. Same-origin in production (the Node
// server serves the SPA) and proxied in dev; always sends the session cookie.

async function request(path, options = {}) {
  return fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
}

// Current signed-in user, or null. Treats 401 (not signed in), 503 (auth not
// configured), and network errors alike — all mean "no user".
export async function fetchCurrentUser() {
  try {
    const res = await request("/api/auth/me");
    if (res.status !== 200) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function logout() {
  try {
    await request("/api/auth/logout", { method: "POST" });
  } catch {
    /* best effort — the UI clears local state regardless */
  }
}
