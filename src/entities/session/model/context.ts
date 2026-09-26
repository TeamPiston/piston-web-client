import { createContext } from "react";

export interface SessionContextValue {
  isLoggedIn: boolean;
  login: () => void;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
