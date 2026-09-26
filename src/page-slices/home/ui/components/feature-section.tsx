import type { ReactNode } from "react";
import { Box, Check, CornerDownLeft, Plus, X } from "lucide-react";

interface FeatureItem {
  eyebrow: string;
  title: string;
  description: string;
  graphic: ReactNode;
  reversed?: boolean;
  tone?: "blue" | "violet";
}

const features: FeatureItem[] = [
  {
    eyebrow: "연결",
    title: "처음 한 번만\n프린터를 연결하세요",
    description:
      "같은 와이파이에 있다면 IP 주소 하나로 끝나요. 복잡한 드라이버 설치나 케이블 연결이 필요 없어요.",
    graphic: <PrinterSetupCard />,
  },
  {
    eyebrow: "만들기",
    title: "만들고 싶은 걸\n말로 설명하세요",
    description:
      "3D 모델링을 몰라도 괜찮아요. 평소에 말하듯 자연어 AI가 알아듣고 모델을 만들어 드려요.",
    graphic: <PromptCard />,
    reversed: true,
  },
  {
    eyebrow: "고르기",
    title: "남이 만든 디자인을\n그대로 가져올 수도 있어요",
    description:
      "무엇을 만들지 막막하다면 Feed를 둘러보세요. 마음에 드는 작품의 프롬프트를 그대로 쓸 수 있어요.",
    graphic: <DesignGridCard />,
  },
  {
    eyebrow: "검증",
    title: "출력할 수 있는지\n알아서 검사해요",
    description:
      "벽이 너무 얇거나 공중에 떠 있는 구조처럼 출력하기 전에 먼저 걸러드려요.",
    graphic: <InspectionCard />,
    reversed: true,
  },
  {
    eyebrow: "출력",
    title: "버튼 하나로\n프린터까지 이어져요",
    description:
      "연결된 프린터를 고르고 색상만 정하면 끝이에요. 진행 상황은 아이디어에서 볼 수 있어요.",
    graphic: <PrintControlCard />,
    tone: "violet",
  },
];

export function FeatureSection() {
  return (
    <section className="bg-[#fbfbfb]">
      {features.map((feature) => (
        <FeatureRow key={feature.title} feature={feature} />
      ))}
    </section>
  );
}

function FeatureRow({ feature }: { feature: FeatureItem }) {
  return (
    <section className="border-t border-zinc-100 bg-white/70">
      <div
        className={
          "mx-auto grid min-h-[520px] w-full max-w-6xl items-center gap-12 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:gap-20 lg:py-28 " +
          (feature.reversed ? "lg:[&>div:first-child]:order-2" : "")
        }
      >
        <FeatureCopy feature={feature} />
        <div className="flex justify-center">{feature.graphic}</div>
      </div>
    </section>
  );
}

function FeatureCopy({ feature }: { feature: FeatureItem }) {
  return (
    <div className="max-w-md">
      <p
        className={
          "mb-5 text-sm font-bold " +
          (feature.tone === "violet" ? "text-indigo-500" : "text-[#5B7FFF]")
        }
      >
        {feature.eyebrow}
      </p>
      <h2 className="whitespace-pre-line text-3xl font-extrabold leading-tight text-zinc-950 sm:text-4xl">
        {feature.title}
      </h2>
      <p className="mt-6 text-base font-medium leading-8 text-zinc-500">
        {feature.description}
      </p>
    </div>
  );
}

function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={
        "w-full max-w-[420px] rounded-lg border border-zinc-200 bg-white p-5 shadow-sm " +
        className
      }
    >
      {children}
    </div>
  );
}

function PrinterSetupCard() {
  return (
    <SurfaceCard className="max-w-[360px]">
      <div className="mb-5">
        <h3 className="text-sm font-bold text-zinc-900">프린터 추가</h3>
        <p className="mt-1 text-xs font-medium text-zinc-400">
          출력에 사용할 프린터 정보를 입력해 주세요.
        </p>
      </div>
      <div className="space-y-4">
        <Field label="프린터 이름" value="개인 프린터" />
        <Field label="프린터 모델" value="QIDI X-Max 4" />
        <div>
          <p className="mb-1.5 text-xs font-semibold text-zinc-600">IP 주소</p>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <div className="rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-semibold text-zinc-700">
              192.168.0.31
            </div>
            <button className="rounded-lg border border-zinc-200 px-3 text-xs font-bold text-zinc-700">
              연결 테스트
            </button>
          </div>
        </div>
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-bold text-emerald-600">연결에 성공했어요</p>
          <p className="mt-1 text-xs font-medium text-emerald-500">
            0.4mm 노즐 · PLA · 32C / 185C
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button className="h-10 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-500">
            취소
          </button>
          <button className="h-10 rounded-lg bg-[#5B7FFF] text-xs font-bold text-white">
            등록하기
          </button>
        </div>
      </div>
    </SurfaceCard>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold text-zinc-600">{label}</p>
      <div className="rounded-lg border border-zinc-200 px-3 py-2.5 text-xs font-semibold text-zinc-700">
        {value}
      </div>
    </div>
  );
}

function PromptCard() {
  return (
    <SurfaceCard className="max-w-[460px] p-6">
      <div className="mb-6 flex justify-end">
        <div className="max-w-[260px] rounded-lg rounded-br-md bg-[#5B7FFF] px-4 py-3 text-xs font-bold leading-5 text-white">
          높이 100mm 정도 되는 화분 받침을 만들어줘
        </div>
      </div>
      <div className="mb-4 max-w-[300px] rounded-lg rounded-bl-md bg-zinc-50 px-4 py-3 text-xs font-semibold leading-5 text-zinc-600">
        원형 받침대를 생성했어요. 벽 두께 2mm로 안정적입니다.
      </div>
      <div className="mb-10 flex justify-end">
        <div className="rounded-lg rounded-br-md bg-[#5B7FFF] px-4 py-3 text-xs font-bold text-white">
          손잡이 홈도 추가해줘
        </div>
      </div>
      <div className="flex h-11 items-center gap-3 rounded-lg border border-[#9ab0ff] px-4">
        <Plus className="h-4 w-4 text-zinc-700" />
        <span className="flex-1 text-xs font-semibold text-zinc-400">
          메시지를 입력해 주세요.
        </span>
        <CornerDownLeft className="h-4 w-4 text-zinc-700" />
      </div>
    </SurfaceCard>
  );
}

function DesignGridCard() {
  return (
    <SurfaceCard className="max-w-[430px]">
      <div className="grid grid-cols-2 gap-4">
        {["12각지지대", "큐브형화분", "케이블홀더", "책상정리함"].map((name, index) => (
          <div key={name} className="rounded-lg bg-zinc-50 p-4">
            <div className="flex aspect-square items-center justify-center rounded-lg bg-white">
              <Box className="h-16 w-16 text-zinc-400" strokeWidth={1.2} />
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-zinc-700">{name}</p>
                <p className="mt-1 truncate text-[10px] font-medium text-zinc-400">
                  creator{index + 1}@piston
                </p>
              </div>
              <span
                className={
                  "h-4 w-4 shrink-0 rounded-full border " +
                  (index === 1 ? "border-[#5B7FFF] bg-[#5B7FFF]" : "border-zinc-300")
                }
              />
            </div>
          </div>
        ))}
      </div>
    </SurfaceCard>
  );
}

function InspectionCard() {
  return (
    <SurfaceCard className="max-w-[430px] border-red-300">
      <div className="mb-4 flex items-center gap-2 text-red-500">
        <X className="h-4 w-4" />
        <h3 className="text-sm font-extrabold">이대로는 출력할 수 없어요</h3>
      </div>
      <p className="text-xs font-medium leading-5 text-zinc-500">
        모델은 만들어졌지만 아래 항목이 프린터 규격을 벗어났어요.
      </p>
      <div className="mt-4 space-y-3 rounded-lg bg-zinc-50 p-4">
        <Issue title="벽 두께" value="0.8 mm -> 최소 1.2 mm 필요" />
        <Issue title="손잡이 기울기" value="1.4 mm -> 최소 2 mm 필요" />
      </div>
      <button className="mt-4 h-11 w-full rounded-lg border border-zinc-200 text-xs font-bold text-zinc-700">
        규격에 맞게 자동 수정
      </button>
    </SurfaceCard>
  );
}

function Issue({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-zinc-400">{title}</p>
      <p className="mt-1 text-sm font-extrabold text-zinc-900">{value}</p>
    </div>
  );
}

function PrintControlCard() {
  return (
    <SurfaceCard className="max-w-[390px]">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-extrabold text-zinc-900">
            출력 전 꼭 확인해 주세요
          </h3>
          <p className="mt-1 text-xs font-medium text-zinc-400">
            아래 항목을 확인한 뒤 출력을 시작해 주세요.
          </p>
        </div>
        <X className="h-4 w-4 text-zinc-400" />
      </div>
      <div className="grid grid-cols-2 rounded-lg bg-zinc-50 p-4 text-center">
        <div>
          <p className="text-[10px] font-bold text-zinc-400">예상 출력 시간</p>
          <p className="mt-1 text-lg font-extrabold text-zinc-900">1시간</p>
        </div>
        <div>
          <p className="text-[10px] font-bold text-zinc-400">필라멘트 사용량</p>
          <p className="mt-1 text-lg font-extrabold text-zinc-900">12m / 36g</p>
        </div>
      </div>
      <ol className="mt-4 space-y-2 rounded-lg bg-zinc-50 p-4">
        {[
          "사용 중인 프린터가 연결되어 있는지",
          "사용할 필라멘트가 남아 있는지",
          "작업대 표면에 출력 흔적이 없는지",
          "프린터 주변 환풍이 안전한지",
        ].map((text) => (
          <li key={text} className="flex gap-2 text-xs font-semibold text-zinc-600">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B7FFF]" />
            <span>{text}</span>
          </li>
        ))}
      </ol>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="h-11 rounded-lg border border-zinc-200 text-xs font-bold text-zinc-500">
          취소
        </button>
        <button className="h-11 rounded-lg bg-[#5B7FFF] text-xs font-bold text-white">
          출력 시작하기
        </button>
      </div>
    </SurfaceCard>
  );
}
