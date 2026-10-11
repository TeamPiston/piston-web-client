"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Maximize2, Minimize2 } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type ComponentRef } from "react";
import { MathUtils } from "three";
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

function PreviewOrbitControls({ cameraDistance }: { cameraDistance: number }) {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null);
  const previousDistanceRef = useRef(cameraDistance);
  const targetDistanceRef = useRef<number | null>(null);

  useEffect(() => {
    const distanceChange = cameraDistance - previousDistanceRef.current;
    previousDistanceRef.current = cameraDistance;
    const controls = controlsRef.current;
    if (!controls || distanceChange === 0) {
      return;
    }

    targetDistanceRef.current = MathUtils.clamp(
      (targetDistanceRef.current ?? controls.getDistance()) + distanceChange,
      controls.minDistance,
      controls.maxDistance,
    );
  }, [cameraDistance]);

  // Update distance before OrbitControls applies its rotation and pan damping.
  useFrame((_, delta) => {
    const controls = controlsRef.current;
    const targetDistance = targetDistanceRef.current;
    if (!controls || targetDistance === null) {
      return;
    }

    let nextDistance = MathUtils.damp(controls.getDistance(), targetDistance, 10, delta);
    if (Math.abs(nextDistance - targetDistance) < 0.01) {
      nextDistance = targetDistance;
      targetDistanceRef.current = null;
    }

    camera.position.sub(controls.target).setLength(nextDistance).add(controls.target);
  }, -2);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      minDistance={10}
      maxDistance={90}
      onStart={() => {
        targetDistanceRef.current = null;
      }}
    />
  );
}

interface ArtworkModelPreviewProps {
  cameraDistance?: number;
  color?: string;
  scale?: ArtworkModelScale;
  stlUrl: string;
  variant?: "detail" | "create";
}

export function ArtworkModelPreview({
  cameraDistance = 42,
  color = "#9ca3af",
  scale = [1, 1, 1],
  stlUrl,
  variant = "detail",
}: ArtworkModelPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [initialCamera] = useState(() => ({
    fov: 42,
    near: 0.1,
    far: 200,
    position: [0, 14, cameraDistance] as [number, number, number],
  }));

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
        "relative overflow-hidden bg-[#f5f5f5]",
        isFullscreen
          ? "h-full w-full rounded-none"
          : variant === "create"
            ? "h-full w-full rounded-[28px]"
            : "aspect-[4/3] min-h-[280px] w-full rounded-[22px] sm:min-h-[340px] lg:aspect-auto lg:h-[328px] lg:min-h-0 lg:w-[504px] lg:rounded-[46px]",
      ].join(" ")}
    >
      <Canvas camera={initialCamera} shadows>
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 15, 8]} intensity={1.1} />
        <Suspense fallback={null}>
          <Center>
            <StlMesh color={color} scale={scale} stlUrl={stlUrl} />
          </Center>
        </Suspense>
        <PreviewOrbitControls cameraDistance={cameraDistance} />
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
