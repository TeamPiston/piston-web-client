import { createContext } from "react";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
}

export interface SessionContextValue {
  isLoggedIn: boolean;
  user: UserProfile | null;
  login: (user: UserProfile) => void;
  logout: () => void;
}

export const SessionContext = createContext<SessionContextValue | null>(null);
