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
    <div className="flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-slate-900 px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 max-w-3xl text-center">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">3D 모델 랜더링 테스트</h1>
        <p className="mt-1 text-sm text-slate-400">
          public/pencil-holder.stl 파일을 로드 중입니다.
        </p>
      </div>

      <div className="h-[clamp(320px,65vh,760px)] w-full max-w-[1400px] overflow-hidden rounded-xl border border-slate-700 bg-black shadow-2xl">
        <StlViewer url="/pencil-holder.stl" />
      </div>
    </div>
  );
}
