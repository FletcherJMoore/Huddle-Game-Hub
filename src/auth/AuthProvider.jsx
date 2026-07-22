import { createContext, useCallback, useContext, useEffect, useState } from "react";

import { fetchCurrentUser, logout as apiLogout } from "../lib/api.js";

const AuthContext = createContext(null);

// Holds the session state for the whole app. On mount it asks the backend who
// we are (via the session cookie); the OAuth redirect flow lands back on "/",
// which remounts this and picks up the freshly-set cookie.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await fetchCurrentUser());
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await apiLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
