import type { FilamentColor } from "@/entities/artwork";
import type {
  ChatHistory,
  CopyrightWarning,
  DesignVersion,
  PrintWarning,
  ResolvedArtworkModelParams,
} from "./types";

export const CREATE_FILAMENT_COLORS: FilamentColor[] = [
  { name: "빨강", value: "#f04444" },
  { name: "주황", value: "#ff7855" },
  { name: "노랑", value: "#ffd166" },
  { name: "초록", value: "#0dcc9a" },
];

export const CREATE_FILAMENT_USAGE = {
  length: "12m",
  weight: "36g",
};

export const CREATE_ESTIMATED_PRINT_TIME = "1시간";

export const MOCK_PRINT_WARNING: PrintWarning = {
  title: "이대로는 출력할 수 없어요",
  description: "모델은 만들어졌지만 아래 항목이 프린터 규격을 벗어났어요.",
  issues: [
    { label: "벽 두께", current: "0.8 mm", required: "최소 1.2 mm 필요" },
    {
      label: "손잡이 기둥 지름",
      current: "1.4 mm",
      required: "최소 2 mm 필요",
    },
  ],
};

export const MOCK_COPYRIGHT_WARNING: CopyrightWarning = {
  title: "이 요청은 만들어 드릴 수 없어요",
  description:
    "저작권이 있는 캐릭터나 상표가 들어간 디자인은 생성하지 않아요. 직접 떠올린 형태를 설명해 주시면 바로 만들어 드릴게요.",
};

export const COPYRIGHT_KEYWORDS = [
  "피카츄",
  "포켓몬",
  "디즈니",
  "마리오",
  "로고",
  "상표",
  "캐릭터",
  "pokemon",
  "disney",
  "mario",
  "logo",
  "trademark",
  "character",
];

export const INITIAL_CHAT_HISTORIES: ChatHistory[] = [
  { id: "pencil-holder", title: "육각형 연필꽂이" },
  { id: "cable-clip", title: "케이블 정리 클립" },
  { id: "monitor-stand", title: "책상 모니터 받침대" },
  { id: "plant-tray", title: "화분 받침 트레이" },
];

export const MOCK_VERSIONS: DesignVersion[] = [
  {
    id: "v1",
    label: "v1",
    description: "육각형 연필꽂이 생성",
    meta: "5분 전",
    stlUrl: "/pencil-holder.stl",
    scale: [1, 1, 1],
    color: "#9ca3af",
    dimensions: { width: 80, height: 100, depth: 80 },
  },
  {
    id: "v2",
    label: "v2",
    description: "바닥 지름 15mm 넓힘",
    meta: "2분 전",
    stlUrl: "/pencil-holder.stl",
    scale: [1.15, 1, 1.15],
    color: "#7c8cf8",
    dimensions: { width: 92, height: 100, depth: 92 },
  },
  {
    id: "v3",
    label: "v3",
    description: "안쪽을 체스 칸으로 나눔",
    meta: "방금",
    stlUrl: "/pencil-holder.stl",
    scale: [1.15, 1.05, 1.15],
    color: "#5a7bff",
    dimensions: { width: 92, height: 105, depth: 92 },
  },
];

export const DEFAULT_MODEL_PARAMS: ResolvedArtworkModelParams = {
  stlUrl: "/pencil-holder.stl",
  scale: [1, 1, 1],
  color: "#9ca3af",
  dimensions: { width: 80, height: 100, depth: 80 },
};

export const MOCK_CORRECTED_VERSION: Omit<DesignVersion, "id" | "label"> = {
  description: "규격에 맞게 두께 보정",
  meta: "방금",
  stlUrl: "/pencil-holder.stl",
  scale: [1.2, 1.1, 1.2],
  color: "#14b8a6",
  dimensions: { width: 96, height: 110, depth: 96 },
};
