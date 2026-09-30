"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { useLoader } from "@react-three/fiber";

function StlMesh({ url }: { url: string }) {
  const geometry = useLoader(STLLoader, url);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#b2b8c2" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

interface StlViewerProps {
  url: string;
  compact?: boolean;
  autoRotate?: boolean;
  interactive?: boolean;
}

export function StlViewer({
  url,
  compact = false,
  autoRotate = false,
  interactive = true,
}: StlViewerProps) {
  return (
    <div
      aria-hidden={!interactive}
      className={[
        "relative w-full overflow-hidden",
        compact
          ? "h-full min-h-[176px] rounded-[18px] bg-[#f6f6f6] sm:min-h-[200px]"
          : "h-[clamp(320px,60vh,720px)] min-h-0 rounded-lg bg-slate-950 shadow-inner",
        !interactive && "pointer-events-none",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Canvas
        camera={{
          fov: compact ? 42 : 75,
          near: 0.1,
          far: 200,
          position: compact ? [0, 14, 42] : [0, 20, 50],
        }}
        shadows
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 5]} intensity={1.2} />

        <Suspense fallback={null}>
          <Center>
            <StlMesh url={url} />
          </Center>
        </Suspense>

        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          enableRotate={interactive}
          enableZoom={interactive}
          enablePan={interactive}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={10}
          maxDistance={150}
        />
      </Canvas>
    </div>
  );
}
