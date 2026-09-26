"use client";

import { useState, type ReactNode } from "react";
import { SessionContext, type SessionContextValue } from "./context";
import { SESSION_STORAGE_KEY } from "./config";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(SESSION_STORAGE_KEY) === "true";
  });

  const login = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SESSION_STORAGE_KEY, "true");
    }
    setIsLoggedIn(true);
  };

  const logout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
    setIsLoggedIn(false);
  };

  const value: SessionContextValue = { isLoggedIn, login, logout };

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
