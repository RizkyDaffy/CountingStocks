import { useState, useCallback } from "react";
import { fetchApi } from "@/lib/api";
import {
  getAuthToken,
  getAuthUser,
  setAuth,
  clearAuth,
  isTokenValid,
  type AuthUser,
} from "@/lib/auth";

export type { AuthUser };

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(() => getAuthUser());
  const [token, setToken] = useState<string | null>(() => (isTokenValid() ? getAuthToken() : null));

  const login = useCallback(async (username: string, password: string) => {
    const data = await fetchApi<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuth(data.token, data.user);
    setUser(data.user);
    setToken(data.token);
    return data;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
    setToken(null);
  }, []);

  return {
    user,
    token,
    isAuthenticated: !!token,
    login,
    logout,
  };
}
