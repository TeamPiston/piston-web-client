"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/entities/session";

const subscribeToMount = () => () => {};
const getClientMountState = () => true;
const getServerMountState = () => false;

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isLoggedIn, isRestoring } = useAuth();
  const isMounted = useSyncExternalStore(
    subscribeToMount,
    getClientMountState,
    getServerMountState,
  );

  useEffect(() => {
    if (isMounted && !isRestoring && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, isMounted, isRestoring, router]);

  if (!isMounted || isRestoring || !isLoggedIn) {
    return null;
  }

  return children;
}
