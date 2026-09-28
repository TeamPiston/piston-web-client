"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Maximize2, Minimize2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useStlModel } from "../model/use-stl-model";

function StlMesh({ url }: { url: string }) {
  const geometry = useStlModel(url);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#9ca3af" roughness={0.45} metalness={0.08} />
    </mesh>
  );
}

interface ArtworkModelPreviewProps {
  url: string;
}

export function ArtworkModelPreview({ url }: ArtworkModelPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === previewRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleFullscreen = async () => {
    if (!previewRef.current) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await previewRef.current.requestFullscreen();
  };

  return (
    <div
      ref={previewRef}
      className="relative aspect-[4/3] min-h-[280px] w-full overflow-hidden rounded-[22px] bg-[#f6f6f6] sm:min-h-[340px] lg:aspect-auto lg:h-[clamp(360px,39vh,420px)]"
    >
      <Canvas
        camera={{ fov: 42, near: 0.1, far: 200, position: [0, 14, 42] }}
        shadows
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 15, 8]} intensity={1.1} />
        <Suspense fallback={null}>
          <Center>
            <StlMesh url={url} />
          </Center>
        </Suspense>
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={10}
          maxDistance={90}
        />
      </Canvas>

      <button
        type="button"
        onClick={handleFullscreen}
        aria-label={isFullscreen ? "전체화면 닫기" : "전체화면으로 보기"}
        title={isFullscreen ? "전체화면 닫기" : "전체화면으로 보기"}
        className="absolute bottom-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-gray-900 shadow-sm transition hover:bg-white"
      >
        {isFullscreen ? (
          <Minimize2 className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Maximize2 className="h-5 w-5" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
