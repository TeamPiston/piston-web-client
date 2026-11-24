"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "@/shared/api";
import {
  API_SESSION_STORAGE_KEY,
  AUTH_WAIT_TIMEOUT_MS,
  AuthExpiredEvent,
  allowStoredAuthAfterLogin,
  beginApiLogin,
  blockResetAuth,
  blockUnverifiedAuth,
  captureAuth,
  clearLocalSession,
  clearStoredAuth,
  isCurrentAuth,
  isCurrentAuthExpiry,
  isCurrentAuthRevision,
  isStoredAuthBlocked,
  noteAuthStorageChange,
  saveApiSession,
} from "@/shared/api/auth";
import { isMockModeEnabled, MOCK_USER_PROFILE } from "@/shared/mock/mock-data";
import { authenticate, restoreApiProfile, revokeApiSession, type LoginCredentials } from "./api-session";
import { AUTH_EXPIRED_EVENT, SESSION_STORAGE_KEY } from "./config";
import { SessionContext, type SessionContextValue, type UserProfile } from "./context";

function isUserProfile(value: unknown): value is UserProfile {
  return !!value && typeof value === "object" &&
    "id" in value && typeof value.id === "string" &&
    "email" in value && typeof value.email === "string" &&
    "name" in value && typeof value.name === "string";
}

function getStoredUser(): UserProfile | null {
  if (!isMockModeEnabled() || typeof window === "undefined" || isStoredAuthBlocked()) return null;
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === "true") return MOCK_USER_PROFILE;
    const value: unknown = raw ? JSON.parse(raw) : null;
    return isUserProfile(value) ? value : null;
  } catch {
    return null;
  }
}

interface LoginAttempt {
  controller: AbortController;
  result: Promise<boolean>;
}

function waitForLogin(attempt: LoginAttempt, deadline: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (deadline.aborted) return resolve();
    const finish = () => {
      deadline.removeEventListener("abort", finish);
      resolve();
    };
    deadline.addEventListener("abort", finish, { once: true });
    void attempt.result.then(finish, finish);
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const mock = isMockModeEnabled();
  const [verified, setVerified] = useState<{ user: UserProfile; sessionId: string | null } | null>(() => {
    const user = getStoredUser();
    return user ? { user, sessionId: null } : null;
  });
  const [isRestoring, setIsRestoring] = useState(!mock);
  const [restoreAttempt, setRestoreAttempt] = useState(0);
  const observedSessionId = useRef<string | null>(null);
  const loginPending = useRef<LoginAttempt | null>(null);

  useEffect(() => {
    let active = true;
    const handleAuthExpired = (event: Event) => {
      if (!(event instanceof AuthExpiredEvent) || !isCurrentAuthExpiry(event) ||
        (observedSessionId.current !== null && observedSessionId.current !== event.sessionId &&
          !(event.explicit && event.sessionId === null))) return;
      observedSessionId.current = null;
      setVerified(null);
      setIsRestoring(false);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== API_SESSION_STORAGE_KEY && event.key !== null) return;
      const stored = captureAuth();
      const storedSessionId = stored.session?.id ?? null;
      if (storedSessionId === observedSessionId.current) return;

      if (stored.storage.status === "readable") noteAuthStorageChange();
      observedSessionId.current = storedSessionId;
      setVerified(null);
      setIsRestoring(storedSessionId !== null);
      setRestoreAttempt((attempt) => attempt + 1);
    };
    window.addEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);

    if (!mock) {
      window.addEventListener("storage", handleStorage);
      const snapshot = captureAuth();
      const sessionId = snapshot.session?.id ?? null;
      observedSessionId.current = sessionId;
      const verification = sessionId ? restoreApiProfile(snapshot) : Promise.resolve(null);
      void verification.then((user) => {
        if (active && isCurrentAuth(snapshot)) setVerified(user ? { user, sessionId } : null);
      }).catch((error: unknown) => {
        if (active && error instanceof ApiError && error.status === 403) {
          return clearStoredAuth(snapshot, { requireSameAccessToken: true });
        }
      }).finally(() => {
        if (active && (isCurrentAuth(snapshot) ||
          (isCurrentAuthRevision(snapshot) && captureAuth().storage.status === "unavailable"))) {
          setIsRestoring(false);
        }
      });
    }

    return () => {
      active = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleAuthExpired);
      window.removeEventListener("storage", handleStorage);
    };
  }, [mock, restoreAttempt]);

  const login = (user: UserProfile) => {
    if (!mock) return;
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(user));
    allowStoredAuthAfterLogin();
    setVerified({ user, sessionId: null });
  };

  const performApiLogin = async (input: LoginCredentials, signal?: AbortSignal) => {
    let snapshot: ReturnType<typeof beginApiLogin> | undefined;
    try {
      snapshot = beginApiLogin();
      const result = await authenticate(input, signal);
      signal?.throwIfAborted();
      const sessionId = await saveApiSession(snapshot, result.tokens, signal);
      if (!sessionId || captureAuth().session?.id !== sessionId) return false;
      observedSessionId.current = sessionId;
      setVerified({ user: result.user, sessionId });
      setIsRestoring(false);
      return true;
    } finally {
      if (isRestoring && (!snapshot || isCurrentAuthRevision(snapshot))) {
        setRestoreAttempt((attempt) => attempt + 1);
      }
    }
  };

  const loginWithCredentials = async (input: LoginCredentials, signal?: AbortSignal) => {
    if (mock || loginPending.current) return false;
    const controller = new AbortController();
    const loginSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
    const attempt = { controller, result: performApiLogin(input, loginSignal) };
    loginPending.current = attempt;
    try {
      return await attempt.result;
    } finally {
      if (loginPending.current === attempt) loginPending.current = null;
    }
  };

  const logout = () => {
    const snapshot = captureAuth(true);
    if (!mock && verified?.sessionId && verified.sessionId !== snapshot.session?.id && snapshot.session) return;
    if (!mock && snapshot.session) {
      void revokeApiSession(snapshot.session.refreshToken).catch(() => {});
    }
    void clearStoredAuth(snapshot, { explicit: true, mock });
  };

  const prepareLocalSignOut = () => {
    const expected = captureAuth();
    const sessionId = expected.storage.status === "readable"
      ? expected.session?.id ?? null
      : observedSessionId.current;

    return async (onSignedOut: () => void) => {
      if (mock) return;

      blockResetAuth(expected, sessionId);
      const deadline = AbortSignal.timeout(AUTH_WAIT_TIMEOUT_MS);
      // Login settles outside the lock. One deadline covers any attempts during this wait.
      let result;
      do {
        while (loginPending.current && !deadline.aborted) await waitForLogin(loginPending.current, deadline);
        if (observedSessionId.current !== null && observedSessionId.current !== sessionId) return;
        if (deadline.aborted && loginPending.current) {
          const expired = loginPending.current;
          loginPending.current = null;
          expired.controller.abort(deadline.reason);
        }
        result = await clearLocalSession(expected, sessionId, () => !deadline.aborted && loginPending.current !== null);
      } while (result === "login-pending");

      if (result !== "cleared" || loginPending.current || observedSessionId.current !== null) return;

      const current = captureAuth();
      if (current.storage.status === "unavailable") {
        blockUnverifiedAuth(current);
        return;
      }
      if (current.storage.record === null && current.accessToken === null) onSignedOut();
    };
  };

  const value: SessionContextValue = {
    isLoggedIn: verified !== null,
    isRestoring,
    user: verified?.user ?? null,
    apiSessionId: verified?.sessionId ?? null,
    login,
    loginWithCredentials,
    logout,
    prepareLocalSignOut,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
