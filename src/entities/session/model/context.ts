import { createContext } from "react";
import type { LoginCredentials } from "./api-session";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  userId?: string;
  createdAt?: string;
}

export interface SessionContextValue {
  isLoggedIn: boolean;
  isRestoring: boolean;
  user: UserProfile | null;
  apiSessionId: string | null;
  login: (user: UserProfile) => void;
  loginWithCredentials: (credentials: LoginCredentials, signal?: AbortSignal) => Promise<boolean>;
  logout: () => void;
  prepareLocalSignOut: () => (onSignedOut: () => void) => Promise<void>;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
