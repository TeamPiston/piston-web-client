"use client";

import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/entities/session";
import { Header, LoginRequiredModal } from "@/widgets/header";
import CreateWorkspace from "./create-workspace";

const subscribeToHydration = () => () => {};

const getClientHydrationSnapshot = () => true;

const getServerHydrationSnapshot = () => false;

export default function CreatePage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const handleAuthModalClose = useCallback(() => {
    // History length does not guarantee a same-origin previous entry.
    router.push("/");
  }, [router]);

  if (!isMounted || !isLoggedIn) {
    return (
      <>
        <Header />
        <LoginRequiredModal
          isOpen={isMounted && !isLoggedIn}
          onClose={handleAuthModalClose}
        />
      </>
    );
  }

  return <CreateWorkspace />;
}
