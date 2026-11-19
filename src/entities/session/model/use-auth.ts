"use client";

import { useContext } from "react";
import { SessionContext } from "./context";

export function useAuth() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
