"use client";

import { useRouter } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/entities/session";
import { Header, LoginRequiredModal } from "@/widgets/header";
import { isMockModeEnabled } from "@/shared/mock/mock-data";
import { AuthenticatedApiCreateWorkspace } from "./api-create-workspace";
import CreateWorkspace from "./create-workspace";

const subscribeToHydration = () => () => {};

const getClientHydrationSnapshot = () => true;

const getServerHydrationSnapshot = () => false;

export default function CreatePage() {
  const router = useRouter();
  const isMock = isMockModeEnabled();
  const { isLoggedIn, isRestoring, user, apiSessionId } = useAuth();
  const isMounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  const handleAuthModalClose = useCallback(() => {
    // History length does not guarantee a same-origin previous entry.
    router.push("/");
  }, [router]);

  if (!isMock) {
    if (!isMounted || isRestoring) {
      return <><Header /><p role="status" className="mx-auto py-10 text-sm text-gray-600">로그인 상태를 확인하는 중이에요.</p></>;
    }
    if (isLoggedIn && user?.userId && apiSessionId) {
      return <AuthenticatedApiCreateWorkspace key={apiSessionId} userId={user.userId} sessionId={apiSessionId} />;
    }
  }

  if (!isMounted || !isLoggedIn || !isMock) {
    return (
      <>
        <Header />
        <LoginRequiredModal
          isOpen={isMounted}
          onClose={handleAuthModalClose}
        />
      </>
    );
  }

  return <CreateWorkspace />;
}
