import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService';
import { getToken, setToken } from '../services/api';

const AuthContext = createContext(null);

/**
 * Global authentication state.
 * - On mount, if a token exists we validate it via GET /api/auth/me.
 * - `booting` lets routes wait before deciding to redirect to /login,
 *   avoiding a login flash for already-authenticated users.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(() => Boolean(getToken()));

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) return () => {};

    authService
      .me()
      .then((data) => {
        if (!cancelled) setUser(data.user || data);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setBooting(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await authService.register(payload);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
  }, []);

  /**
   * Adopt a session the backend just issued without a /me round trip.
   * Used by guest join: the server creates the identity and returns its token
   * in the same response, so the visitor can enter the meeting immediately.
   */
  const adoptSession = useCallback((token, nextUser) => {
    setToken(token);
    setUser(nextUser);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      booting,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      adoptSession,
      updateUser,
    }),
    [user, booting, login, register, logout, adoptSession, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export { setToken };
export default AuthContext;
