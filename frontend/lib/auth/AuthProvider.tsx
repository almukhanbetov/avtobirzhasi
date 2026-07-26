"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { me as fetchMe } from "@/lib/api/auth";
import {
  clearStoredToken,
  getStoredToken,
  setStoredToken,
} from "@/lib/auth/session";
import type { AuthUser } from "@/types/user";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  status: AuthStatus;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider owns the client-side session: a JWT in localStorage plus
// the user it belongs to. On mount it re-validates any stored token against
// GET /api/auth/me rather than trusting it blindly — an expired or
// tampered token is dropped instead of leaving the UI in a half-logged-in
// state.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  // No stored token means there's nothing to validate — go straight to
  // "unauthenticated" during render instead of a render-then-effect round
  // trip. A stored token still needs the effect below to confirm it's live.
  const [status, setStatus] = useState<AuthStatus>(() =>
    getStoredToken() ? "loading" : "unauthenticated",
  );

  useEffect(() => {
    const stored = getStoredToken();
    if (!stored) return;

    let cancelled = false;

    fetchMe(stored)
      .then((fetchedUser) => {
        if (cancelled) return;
        setToken(stored);
        setUser(fetchedUser);
        setStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        clearStoredToken();
        setStatus("unauthenticated");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setStoredToken(newToken);
    setToken(newToken);
    setUser(newUser);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
    setStatus("unauthenticated");
    // Query keys like ["dashboard", "listings"] aren't scoped per-user, so
    // without this a different account logging in on the same browser
    // session would briefly see the previous account's cached data.
    queryClient.clear();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, token, status, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
