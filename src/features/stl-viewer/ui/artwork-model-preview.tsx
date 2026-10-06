"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Maximize2, Minimize2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import type { ArtworkModelScale } from "../model/artwork-model";
import { useStlModel } from "../model/use-stl-model";

interface StlMeshProps {
  color: string;
  scale: ArtworkModelScale;
  stlUrl: string;
}

function StlMesh({ color, scale, stlUrl }: StlMeshProps) {
  const geometry = useStlModel(stlUrl);

  return (
    <mesh geometry={geometry} scale={scale} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.45} metalness={0.08} />
    </mesh>
  );
}

interface ArtworkModelPreviewProps {
  cameraDistance?: number;
  color?: string;
  scale?: ArtworkModelScale;
  showFullscreenControl?: boolean;
  stlUrl: string;
  variant?: "detail" | "detail-compact" | "create";
}

export function ArtworkModelPreview({
  cameraDistance = 42,
  color = "#9ca3af",
  scale = [1, 1, 1],
  showFullscreenControl = true,
  stlUrl,
  variant = "detail",
}: ArtworkModelPreviewProps) {
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

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }

      await previewRef.current.requestFullscreen();
    } catch {
      setIsFullscreen(false);
    }
  };

  return (
    <div
      ref={previewRef}
      className={[
        "relative overflow-hidden",
        isFullscreen
          ? "h-full w-full rounded-none bg-[#f5f5f5]"
          : variant === "create"
            ? "h-full w-full rounded-[28px] bg-[#f5f5f5]"
            : variant === "detail-compact"
              ? "h-full w-full rounded-xl bg-transparent"
              : "aspect-[4/3] min-h-[280px] w-full rounded-[22px] bg-[#f5f5f5] sm:min-h-[340px] lg:aspect-auto lg:h-[328px] lg:min-h-0 lg:w-[504px] lg:rounded-[46px]",
      ].join(" ")}
    >
      <Canvas
        key={cameraDistance}
        camera={{ fov: 42, near: 0.1, far: 200, position: [0, 14, cameraDistance] }}
        shadows
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 15, 8]} intensity={1.1} />
        <Suspense fallback={null}>
          <Center>
            <StlMesh color={color} scale={scale} stlUrl={stlUrl} />
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

      {showFullscreenControl && (
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
      )}
    </div>
  );
}
