"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/entities/session";
import { StlViewer } from "@/features/stl-viewer";

const subscribeToHydration = () => () => {};
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export default function ThreeDTestPage() {
  const router = useRouter();
  const { isLoggedIn } = useAuth();
  const mounted = useSyncExternalStore(
    subscribeToHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );

  useEffect(() => {
    if (mounted && !isLoggedIn) {
      router.replace("/login");
    }
  }, [mounted, isLoggedIn, router]);

  if (!mounted || !isLoggedIn) {
    return null;
  }

  return (
    <div className="w-full min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold tracking-tight">3D 모델 랜더링 테스트</h1>
        <p className="text-sm text-slate-400 mt-1">
          public/pencil-holder.stl 파일을 로드 중입니다.
        </p>
      </div>

      <div className="w-full max-w-[900px] aspect-video border border-slate-700 rounded-xl overflow-hidden shadow-2xl bg-black">
        <StlViewer url="/pencil-holder.stl" />
      </div>
    </div>
  );
}
