import type { ArtworkDetail, FilamentColor } from "./artwork";
import { MOCK_ARTWORKS } from "./mock-artworks";

const DEFAULT_STL_URL = "/pencil-holder.stl";

const FILAMENT_COLORS: FilamentColor[] = [
  { name: "빨강", value: "#f04444" },
  { name: "주황", value: "#ff7855" },
  { name: "노랑", value: "#ffd166" },
  { name: "초록", value: "#0dcc9a" },
  { name: "파랑", value: "#5a7bff" },
];

export const MOCK_ARTWORK_DETAILS: ArtworkDetail[] = MOCK_ARTWORKS.map(
  (artwork, index) => ({
    ...artwork,
    stlUrl: DEFAULT_STL_URL,
    description:
      artwork.title +
      "에 대한 설명이 들어갈 예정입니다. 작품의 특징과 사용 목적, 출력 시 참고할 내용을 확인할 수 있습니다. " +
      "필요한 경우 긴 설명도 읽기 쉽도록 확인할 수 있는 상세 설명입니다.",
    filamentColors: FILAMENT_COLORS,
    filamentUsage: {
      length: 12 + index + "m",
      weight: 36 + index * 2 + "g",
    },
    estimatedPrintTime: index + 1 + "시간",
  }),
);

export function getMockArtworkDetailById(id: number) {
  return MOCK_ARTWORK_DETAILS.find((artwork) => artwork.id === id);
}
