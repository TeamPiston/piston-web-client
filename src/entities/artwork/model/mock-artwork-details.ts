import type { ArtworkDetail } from "./artwork";
import { MOCK_ARTWORKS } from "./mock-artworks";

type ArtworkDetailMetadata = Omit<ArtworkDetail, keyof typeof MOCK_ARTWORKS[number]>;

const ARTWORK_DETAIL_METADATA: Record<string, ArtworkDetailMetadata> = {
  "1": {
    description:
      "책상 위에 흩어진 필기구를 한곳에 정리할 수 있는 연필 홀더입니다. 가볍고 안정적인 구조로 사무실이나 작업 공간에 잘 어울립니다.",
    filamentColors: [
      { name: "빨강", value: "#f04444" },
      { name: "주황", value: "#ff7855" },
    ],
    filamentUsage: { length: "12m", weight: "36g" },
    estimatedPrintTime: "1시간",
  },
  "2": {
    description:
      "작은 공간에 장식품으로 놓기 좋은 기본 큐브입니다. 모서리가 단순해 출력 테스트와 컬러 샘플 제작에도 사용할 수 있습니다.",
    filamentColors: [
      { name: "파랑", value: "#5a7bff" },
      { name: "초록", value: "#0dcc9a" },
    ],
    filamentUsage: { length: "8m", weight: "24g" },
    estimatedPrintTime: "42분",
  },
  "3": {
    description:
      "스마트폰이나 작은 태블릿을 세워둘 수 있는 데스크 스탠드입니다. 케이블이 지나갈 수 있는 홈을 고려한 디자인입니다.",
    filamentColors: [
      { name: "검정", value: "#252525" },
      { name: "노랑", value: "#ffd166" },
    ],
    filamentUsage: { length: "18m", weight: "52g" },
    estimatedPrintTime: "1시간 24분",
  },
  "4": {
    description:
      "작은 다육 식물을 위한 미니 화분입니다. 책상이나 선반에 놓기 좋은 크기로 제작되며 가벼운 소재와 잘 어울립니다.",
    filamentColors: [
      { name: "주황", value: "#ff7855" },
      { name: "초록", value: "#0dcc9a" },
    ],
    filamentUsage: { length: "20m", weight: "61g" },
    estimatedPrintTime: "1시간 36분",
  },
  "5": {
    description:
      "게임 보드 위에 포인트로 놓을 수 있는 체스 타워 모형입니다. 높은 형태의 출력 안정성을 확인할 수 있는 작품입니다.",
    filamentColors: [
      { name: "보라", value: "#8b6cff" },
      { name: "흰색", value: "#f3f3f3" },
    ],
    filamentUsage: { length: "25m", weight: "74g" },
    estimatedPrintTime: "2시간 5분",
  },
  "6": {
    description:
      "열쇠나 액세서리를 잠시 올려둘 수 있는 미니 트레이입니다. 낮은 높이와 넓은 바닥으로 출력이 안정적입니다.",
    filamentColors: [
      { name: "노랑", value: "#ffd166" },
      { name: "빨강", value: "#f04444" },
    ],
    filamentUsage: { length: "15m", weight: "45g" },
    estimatedPrintTime: "1시간 8분",
  },
  "7": {
    description:
      "작은 부품과 소품을 분류해 보관할 수 있는 블록 케이스입니다. 여러 개를 쌓아 사용하는 방식으로 확장할 수 있습니다.",
    filamentColors: [
      { name: "파랑", value: "#5a7bff" },
      { name: "검정", value: "#252525" },
    ],
    filamentUsage: { length: "22m", weight: "66g" },
    estimatedPrintTime: "1시간 48분",
  },
  "8": {
    description:
      "책상이나 선반에 이름과 문구를 표시할 수 있는 네임 플레이트입니다. 색상을 조합해 간단한 표지판으로 활용할 수 있습니다.",
    filamentColors: [
      { name: "초록", value: "#0dcc9a" },
      { name: "흰색", value: "#f3f3f3" },
    ],
    filamentUsage: { length: "10m", weight: "30g" },
    estimatedPrintTime: "55분",
  },
  "9": {
    description:
      "책상 아래나 벽면에 케이블을 정리할 수 있는 케이블 홀더입니다. 작은 부품이라 여러 개를 한 번에 출력하기 좋습니다.",
    filamentColors: [
      { name: "검정", value: "#252525" },
      { name: "주황", value: "#ff7855" },
    ],
    filamentUsage: { length: "9m", weight: "27g" },
    estimatedPrintTime: "48분",
  },
};

export const MOCK_ARTWORK_DETAILS: ArtworkDetail[] = MOCK_ARTWORKS.map(
  (artwork) => ({
    ...artwork,
    ...ARTWORK_DETAIL_METADATA[artwork.id],
  }),
);

export function getMockArtworkDetailById(id: string) {
  return MOCK_ARTWORK_DETAILS.find((artwork) => artwork.id === id);
}