"use client";

import { Center, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { useStlModel } from "../model/use-stl-model";

function StlMesh({ url }: { url: string }) {
  const geometry = useStlModel(url);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#b2b8c2" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

interface StlViewerProps {
  url: string;
}

export function StlViewer({ url }: StlViewerProps) {
  return (
    <div className="relative h-[500px] w-full overflow-hidden rounded-lg bg-slate-950 shadow-inner">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, 20, 50] }}
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
          minDistance={10}
          maxDistance={150}
        />
      </Canvas>
    </div>
  );
}
