"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionContext, type SessionContextValue } from "./context";
import type { UserProfile } from "./context";
import { ACCESS_TOKEN_STORAGE_KEY, AUTH_EXPIRED_EVENT, SESSION_STORAGE_KEY } from "./config";
import { MOCK_USER_PROFILE } from "@/shared/mock/mock-data";

function isUserProfile(value: unknown): value is UserProfile {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.name === "string"
  );
}

function getStoredUser(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (storedSession === "true") {
    return MOCK_USER_PROFILE;
  }

  if (!storedSession) {
    return null;
  }

  try {
    const parsedSession: unknown = JSON.parse(storedSession);
    return isUserProfile(parsedSession) ? parsedSession : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(getStoredUser);

  useEffect(() => {
    const handleAuthExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
  }, []);

  const login = (nextUser: UserProfile) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextUser));
    }
    setUser(nextUser);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
      window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    }
    setUser(null);
  };

  const value: SessionContextValue = {
    isLoggedIn: user !== null,
    user,
    login,
    logout,
  };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
