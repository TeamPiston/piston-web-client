"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { useStlModel } from "../model/use-stl-model";

// 1. STL 파일을 읽어서 3D 메쉬(Mesh)로 만들어주는 컴포넌트
function StlMesh({ url }: { url: string }) {
  const geometry = useStlModel(url);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color="#b2b8c2" roughness={0.4} metalness={0.1} />
    </mesh>
  );
}

export function StlViewer() {
  return (
    // Canvas가 찌그러지지 않도록 부모 박스의 크기(h-[500px])와 배경색을 잡아줍니다.
    <div className="w-full h-[500px] bg-slate-950 rounded-lg overflow-hidden shadow-inner relative">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, 20, 50] }}
        shadows
      >
        {/* 기존에 아주 잘 짜두셨던 조명 세팅 그대로 유지 */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 15, 5]} intensity={1.2} />

        {/* 2. 3D 모델 비동기 로딩 처리 */}
        <Suspense fallback={null}>
          {/* Center 컴포넌트가 연필꽂이 모델을 화면 정중앙(0, 0, 0)에 맞춰줍니다. */}
          <Center>
            {/* 유저분의 public/ 바로 아래 구조에 맞춰 경로를 지정했습니다. */}
            <StlMesh url="/pencil-holder.stl" />
          </Center>
        </Suspense>

        {/* 3. 마우스로 회전(드래그), 확대(스크롤), 이동(우클릭)하는 컨트롤러 */}
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={10}
          maxDistance={150}
        />
      </Canvas>

      {/* 화면 좌측 하단 가이드 문구 */}
      <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-full pointer-events-none select-none">
        🖱️ 마우스 드래그로 3D 모델을 회전해 보세요.
      </div>
    </div>
  );
}
