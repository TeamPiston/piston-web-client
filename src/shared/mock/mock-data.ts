interface MockUserProfile {
  email: string;
  id: string;
  name: string;
}

interface MockArtwork {
  author: string;
  id: string;
  stlUrl: string;
  title: string;
}

interface MockArtworkDetail extends MockArtwork {
  description: string;
  estimatedPrintTime: string;
  filamentColors: { name: string; value: string }[];
  filamentUsage: { length: string; weight: string };
}

export type MockPrintStatus =
  | "PRINTING"
  | "COMPLETED"
  | "FAILED"
  | "ERROR"
  | "CANCELLED"
  | "CANCELED"
  | "EMPTY";

interface MockPrintTask {
  artworkName: string;
  createdAt: string;
  estimatedEndTime: string;
  failureReason?: string;
  filamentRemaining?: string;
  id: number;
  modelUrl?: string;
  printerName?: string;
  printingMethod?: string;
  progress: number;
  remainingMinutes: number;
  status: MockPrintStatus;
  stoppedAt?: string;
  userId: string;
}

export const MOCK_LOGIN_CREDENTIALS = {
  id: "admin",
  password: "1234",
};

export const MOCK_USER_PROFILE: MockUserProfile = {
  id: "admin",
  email: "admin@example.com",
  name: "관리자",
};

export const MOCK_ACCOUNT_PROFILE: MockUserProfile = {
  id: "dlskawls",
  email: "penamjin@gmail.com",
  name: "dlskawls",
};

export const MOCK_ACCOUNT_SETTINGS = {
  printerConnected: true,
  printerName: "MAX4_02",
  printerModel: "QIDI X-Max 4",
  printerAddress: "192.168.0.24",
  filamentRemaining: "12 m / 36 g",
};

export type MockDesignColorMode = "color" | "monochrome";

export interface MockMyDesign {
  colorMode: MockDesignColorMode;
  createdAt: string;
  dimensions: string;
  estimatedPrintTime: string;
  filamentLength: string;
  filamentWeight: string;
  id: string;
  isPublished: boolean;
  printCount: number;
  stlUrl: string;
  title: string;
}

export const MOCK_MY_DESIGNS: MockMyDesign[] = [
  {
    id: "plant-tray",
    title: "화분 받침 트레이",
    createdAt: "어제 만듦",
    printCount: 1,
    isPublished: true,
    colorMode: "color",
    stlUrl: "/models/mini-tray.stl",
    dimensions: "120 × 120 × 40 mm",
    estimatedPrintTime: "1시간 24분",
    filamentLength: "12 m",
    filamentWeight: "36 g",
  },
  {
    id: "cable-hook",
    title: "벽걸이 케이블 훅",
    createdAt: "3일 전 만듦",
    printCount: 2,
    isPublished: false,
    colorMode: "monochrome",
    stlUrl: "/models/cable-holder.stl",
    dimensions: "80 × 36 × 22 mm",
    estimatedPrintTime: "48분",
    filamentLength: "9 m",
    filamentWeight: "27 g",
  },
  {
    id: "headphone-stand",
    title: "헤드폰 거치대",
    createdAt: "1주 전 만듦",
    printCount: 0,
    isPublished: true,
    colorMode: "color",
    stlUrl: "/models/desk-stand.stl",
    dimensions: "120 × 120 × 40 mm",
    estimatedPrintTime: "1시간 24분",
    filamentLength: "12 m",
    filamentWeight: "36 g",
  },
];

export interface MockFeedPost extends MockArtworkDetail {
  colorMode: MockDesignColorMode;
  likedByCurrentUser: boolean;
  likeCount: number;
  publishedAt: string;
}

export const MOCK_FEED_POSTS: MockFeedPost[] = [
  {
    id: "1",
    title: "연필 홀더",
    author: "작가1",
    stlUrl: "/models/pencil-holder.stl",
    description: "책상 위에 흩어진 필기구를 한곳에 정리할 수 있는 연필 홀더입니다. 가볍고 안정적인 구조로 사무실이나 작업 공간에 잘 어울립니다.",
    filamentColors: [
      { name: "빨강", value: "#f04444" },
      { name: "주황", value: "#ff7855" },
      { name: "파랑", value: "#5a7bff" },
      { name: "연두", value: "#0dcc9a" },
    ],
    filamentUsage: { length: "12 m", weight: "36 g" },
    estimatedPrintTime: "1시간",
    colorMode: "color",
    likedByCurrentUser: false,
    likeCount: 23,
    publishedAt: "오늘",
  },
  {
    id: "2",
    title: "미니 큐브",
    author: "dlskawls",
    stlUrl: "/models/cube.stl",
    description: "작은 공간에 장식품으로 놓기 좋은 기본 큐브입니다. 모서리가 단순해 출력 테스트와 컬러 샘플 제작에도 사용할 수 있습니다.",
    filamentColors: [
      { name: "파랑", value: "#5a7bff" },
      { name: "초록", value: "#0dcc9a" },
    ],
    filamentUsage: { length: "8 m", weight: "24 g" },
    estimatedPrintTime: "42분",
    colorMode: "monochrome",
    likedByCurrentUser: true,
    likeCount: 8,
    publishedAt: "어제",
  },
  {
    id: "3",
    title: "데스크 스탠드",
    author: "JJY",
    stlUrl: "/models/desk-stand.stl",
    description: "스마트폰이나 작은 태블릿을 세워둘 수 있는 데스크 스탠드입니다. 케이블이 지나갈 수 있는 홈을 고려한 디자인입니다.",
    filamentColors: [
      { name: "검정", value: "#252525" },
      { name: "노랑", value: "#ffd166" },
    ],
    filamentUsage: { length: "18 m", weight: "52 g" },
    estimatedPrintTime: "1시간 24분",
    colorMode: "color",
    likedByCurrentUser: false,
    likeCount: 17,
    publishedAt: "2일 전",
  },
  {
    id: "4",
    title: "미니 화분",
    author: "JJY",
    stlUrl: "/models/mini-planter.stl",
    description: "작은 다육 식물을 위한 미니 화분입니다. 책상이나 선반에 놓기 좋은 크기로 제작되며 가벼운 소재와 잘 어울립니다.",
    filamentColors: [
      { name: "주황", value: "#ff7855" },
      { name: "초록", value: "#0dcc9a" },
    ],
    filamentUsage: { length: "20 m", weight: "61 g" },
    estimatedPrintTime: "1시간 36분",
    colorMode: "color",
    likedByCurrentUser: true,
    likeCount: 41,
    publishedAt: "3일 전",
  },
  {
    id: "5",
    title: "체스 타워",
    author: "ㅎㅇ",
    stlUrl: "/models/chess-tower.stl",
    description: "게임 보드 위에 포인트로 놓을 수 있는 체스 타워 모형입니다. 높은 형태의 출력 안정성을 확인할 수 있는 작품입니다.",
    filamentColors: [
      { name: "보라", value: "#8b6cff" },
      { name: "흰색", value: "#f3f3f3" },
    ],
    filamentUsage: { length: "25 m", weight: "74 g" },
    estimatedPrintTime: "2시간 5분",
    colorMode: "monochrome",
    likedByCurrentUser: false,
    likeCount: 12,
    publishedAt: "4일 전",
  },
  {
    id: "6",
    title: "미니 트레이",
    author: "작가2",
    stlUrl: "/models/mini-tray.stl",
    description: "열쇠나 액세서리를 잠시 올려둘 수 있는 미니 트레이입니다. 낮은 높이와 넓은 바닥으로 출력이 안정적입니다.",
    filamentColors: [
      { name: "노랑", value: "#ffd166" },
      { name: "빨강", value: "#f04444" },
    ],
    filamentUsage: { length: "15 m", weight: "45 g" },
    estimatedPrintTime: "1시간 8분",
    colorMode: "color",
    likedByCurrentUser: false,
    likeCount: 6,
    publishedAt: "5일 전",
  },
  {
    id: "7",
    title: "블록 케이스",
    author: "작가3",
    stlUrl: "/models/block-case.stl",
    description: "작은 부품과 소품을 분류해 보관할 수 있는 블록 케이스입니다. 여러 개를 쌓아 사용하는 방식으로 확장할 수 있습니다.",
    filamentColors: [
      { name: "파랑", value: "#5a7bff" },
      { name: "검정", value: "#252525" },
    ],
    filamentUsage: { length: "22 m", weight: "66 g" },
    estimatedPrintTime: "1시간 48분",
    colorMode: "monochrome",
    likedByCurrentUser: false,
    likeCount: 29,
    publishedAt: "1주 전",
  },
  {
    id: "8",
    title: "네임 플레이트",
    author: "작가4",
    stlUrl: "/models/name-plate.stl",
    description: "책상이나 선반에 이름과 문구를 표시할 수 있는 네임 플레이트입니다. 색상을 조합해 간단한 표지판으로 활용할 수 있습니다.",
    filamentColors: [
      { name: "초록", value: "#0dcc9a" },
      { name: "흰색", value: "#f3f3f3" },
    ],
    filamentUsage: { length: "10 m", weight: "30 g" },
    estimatedPrintTime: "55분",
    colorMode: "color",
    likedByCurrentUser: true,
    likeCount: 54,
    publishedAt: "1주 전",
  },
  {
    id: "9",
    title: "케이블 홀더",
    author: "작가5",
    stlUrl: "/models/cable-holder.stl",
    description: "책상 아래나 벽면에 케이블을 정리할 수 있는 케이블 홀더입니다. 작은 부품이라 여러 개를 한 번에 출력하기 좋습니다.",
    filamentColors: [
      { name: "검정", value: "#252525" },
      { name: "주황", value: "#ff7855" },
    ],
    filamentUsage: { length: "9 m", weight: "27 g" },
    estimatedPrintTime: "48분",
    colorMode: "monochrome",
    likedByCurrentUser: false,
    likeCount: 14,
    publishedAt: "2주 전",
  },
];

export const MOCK_ARTWORKS: MockArtwork[] = MOCK_FEED_POSTS.map(({ id, title, author, stlUrl }) => ({
  id,
  title,
  author,
  stlUrl,
}));

export const MOCK_ARTWORK_DETAILS: MockArtworkDetail[] = MOCK_FEED_POSTS;

export function getMockArtworkDetailById(id: string) {
  return MOCK_ARTWORK_DETAILS.find((artwork) => artwork.id === id);
}

export interface MockCreateVersion {
  color: string;
  description: string;
  dimensions: { depth: number; height: number; width: number };
  id: string;
  label: string;
  meta: string;
  scale: [number, number, number];
  stlUrl: string;
}

export interface MockCreateWarning {
  description: string;
  issues: { current: string; label: string; required: string }[];
  title: string;
}

export const MOCK_CREATE_FIXTURES: {
  chatHistories: { id: string; title: string }[];
  copyrightWarning: { description: string; title: string };
  correctedVersion: MockCreateVersion;
  estimatedPrintTime: string;
  defaultModel: {
    color: string;
    dimensions: { depth: number; height: number; width: number };
    scale: [number, number, number];
    stlUrl: string;
  };
  filamentColors: { name: string; value: string }[];
  filamentUsage: { length: string; weight: string };
  printWarning: MockCreateWarning;
  versions: MockCreateVersion[];
} = {
  chatHistories: [
    { id: "pencil-holder", title: "육각형 연필꽂이" },
    { id: "cable-clip", title: "케이블 정리 클립" },
    { id: "monitor-stand", title: "책상 모니터 받침대" },
    { id: "plant-tray", title: "화분 받침 트레이" },
  ],
  filamentColors: [
    { name: "빨강", value: "#f04444" },
    { name: "주황", value: "#ff7855" },
    { name: "노랑", value: "#ffd166" },
    { name: "초록", value: "#0dcc9a" },
  ],
  filamentUsage: { length: "12m", weight: "36g" },
  estimatedPrintTime: "1시간",
  printWarning: {
    title: "이대로는 출력할 수 없어요",
    description: "모델은 만들어졌지만 아래 항목이 프린터 규격을 벗어났어요.",
    issues: [
      { label: "벽 두께", current: "0.8 mm", required: "최소 1.2 mm 필요" },
      { label: "손잡이 기둥 지름", current: "1.4 mm", required: "최소 2 mm 필요" },
    ],
  },
  copyrightWarning: {
    title: "이 요청은 만들어 드릴 수 없어요",
    description:
      "저작권이 있는 캐릭터나 상표가 들어간 디자인은 생성하지 않아요. 직접 떠올린 형태를 설명해 주시면 바로 만들어 드릴게요.",
  },
  versions: [
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
  ],
  correctedVersion: {
    id: "v4",
    label: "v4",
    description: "규격에 맞게 두께 보정",
    meta: "방금",
    stlUrl: "/pencil-holder.stl",
    scale: [1.2, 1.1, 1.2],
    color: "#14b8a6",
    dimensions: { width: 96, height: 110, depth: 96 },
  },
  defaultModel: {
    stlUrl: "/pencil-holder.stl",
    scale: [1, 1, 1],
    color: "#9ca3af",
    dimensions: { width: 80, height: 100, depth: 80 },
  },
};

export const MOCK_PRINT_STATUS_LIST: readonly MockPrintTask[] = [
  {
    id: 5101,
    userId: MOCK_ACCOUNT_PROFILE.id,
    artworkName: "육각형 연필꽂이",
    modelUrl: "/models/pencil-holder.stl",
    printerName: MOCK_ACCOUNT_SETTINGS.printerName,
    printingMethod: "FDM",
    filamentRemaining: MOCK_ACCOUNT_SETTINGS.filamentRemaining,
    status: "PRINTING",
    progress: 62,
    remainingMinutes: 32,
    estimatedEndTime: "오늘 15:12 완료 예정",
    createdAt: "2026-10-06T14:40:00+09:00",
  },
  {
    id: 5102,
    userId: MOCK_ACCOUNT_PROFILE.id,
    artworkName: "육각형 연필꽂이",
    modelUrl: "/models/pencil-holder.stl",
    printerName: MOCK_ACCOUNT_SETTINGS.printerName,
    printingMethod: "FDM",
    filamentRemaining: MOCK_ACCOUNT_SETTINGS.filamentRemaining,
    failureReason: "노즐 막힘 감지",
    stoppedAt: "14:02",
    status: "FAILED",
    progress: 38,
    remainingMinutes: 0,
    estimatedEndTime: "14:02 중단",
    createdAt: "2026-10-06T13:20:00+09:00",
  },
  {
    id: 5103,
    userId: MOCK_ACCOUNT_PROFILE.id,
    artworkName: "화분 받침 트레이",
    modelUrl: "/models/mini-tray.stl",
    printerName: MOCK_ACCOUNT_SETTINGS.printerName,
    printingMethod: "FDM",
    filamentRemaining: "20 m / 61 g",
    status: "COMPLETED",
    progress: 100,
    remainingMinutes: 0,
    estimatedEndTime: "오늘 11:48 완료",
    createdAt: "2026-10-06T10:24:00+09:00",
  },
];

let mockDesigns = cloneDesigns(MOCK_MY_DESIGNS);
let mockCurrentPrintTask: MockPrintTask | null = null;
let isMockPrintInitialized = false;
let nextMockPrintId = 5200;
let isMockAccountDeleted = false;
const mockFeedLikes = new Map(
  MOCK_FEED_POSTS.map((post) => [post.id, post.likedByCurrentUser]),
);

export function isMockModeEnabled() {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

export async function withMockFallback<T>(
  apiOperation: () => Promise<T>,
  mockOperation: () => Promise<T> | T,
): Promise<T> {
  if (isMockModeEnabled()) {
    return mockOperation();
  }

  try {
    return await apiOperation();
  } catch (error) {
    if (isUnauthorizedError(error)) {
      throw error;
    }

    return mockOperation();
  }
}

function isUnauthorizedError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === 401
  );
}

export async function fetchMockPrintStatus(): Promise<MockPrintTask | null> {
  initializeMockPrintStatus();
  return mockCurrentPrintTask ? { ...mockCurrentPrintTask } : null;
}

export async function fetchMockPrintStatusList(): Promise<MockPrintTask[]> {
  return MOCK_PRINT_STATUS_LIST.map((task) => ({ ...task }));
}

export async function createMockPrintTask(artworkName = "육각형 연필꽂이") {
  throwIfMockFailure("print-create");
  initializeMockPrintStatus();
  const matchingDesign = mockDesigns.find((design) => design.title === artworkName);
  const nextTask: MockPrintTask = {
    id: nextMockPrintId++,
    userId: MOCK_ACCOUNT_PROFILE.id,
    artworkName,
    modelUrl: matchingDesign?.stlUrl ?? "/models/pencil-holder.stl",
    printerName: MOCK_ACCOUNT_SETTINGS.printerName,
    printingMethod: "FDM",
    filamentRemaining: matchingDesign
      ? `${matchingDesign.filamentLength} / ${matchingDesign.filamentWeight}`
      : MOCK_ACCOUNT_SETTINGS.filamentRemaining,
    status: "PRINTING",
    progress: 0,
    remainingMinutes: 52,
    estimatedEndTime: "약 52분 후 완료 예정",
    createdAt: new Date().toISOString(),
  };
  mockCurrentPrintTask = nextTask;
  return { ...nextTask };
}

export async function cancelMockPrint(printTaskId: number) {
  throwIfMockFailure("print-cancel");
  initializeMockPrintStatus();
  if (!mockCurrentPrintTask || mockCurrentPrintTask.id !== printTaskId) {
    return;
  }

  mockCurrentPrintTask = {
    ...mockCurrentPrintTask,
    status: "CANCELLED",
    failureReason: "사용자 요청으로 중단",
    stoppedAt: getCurrentLocalTime(),
    remainingMinutes: 0,
    estimatedEndTime: `${getCurrentLocalTime()} 중단`,
  };
}

export async function retryMockPrint(printTaskId: number) {
  throwIfMockFailure("print-retry");
  initializeMockPrintStatus();
  const previousTask = mockCurrentPrintTask?.id === printTaskId
    ? mockCurrentPrintTask
    : MOCK_PRINT_STATUS_LIST.find((task) => task.id === printTaskId);

  return createMockPrintTask(previousTask?.artworkName);
}

export async function fetchMockMyDesigns(): Promise<MockMyDesign[]> {
  return cloneDesigns(mockDesigns);
}

export async function toggleMockDesignPublish(designId: string): Promise<MockMyDesign | null> {
  const design = mockDesigns.find((item) => item.id === designId);
  if (!design) {
    return null;
  }

  design.isPublished = !design.isPublished;
  return { ...design };
}

export async function deleteMockDesign(designId: string) {
  mockDesigns = mockDesigns.filter((design) => design.id !== designId);
}

export async function fetchMockFeedPosts(): Promise<MockFeedPost[]> {
  return MOCK_FEED_POSTS.map((post) => ({
    ...post,
    filamentColors: post.filamentColors.map((color) => ({ ...color })),
    filamentUsage: { ...post.filamentUsage },
    likedByCurrentUser: mockFeedLikes.get(post.id) ?? false,
  }));
}

export async function toggleMockFeedLike(postId: string) {
  const nextValue = !(mockFeedLikes.get(postId) ?? false);
  mockFeedLikes.set(postId, nextValue);
  return nextValue;
}

export async function fetchMockAccountSettings() {
  return {
    ...MOCK_ACCOUNT_SETTINGS,
    printerConnected: isMockPrinterConnected(),
    isDeleted: isMockAccountDeleted,
  };
}

export function isMockPrinterConnected() {
  if (typeof window === "undefined") {
    return MOCK_ACCOUNT_SETTINGS.printerConnected;
  }

  const printerScenario = new URLSearchParams(window.location.search).get("mockPrinter");
  return printerScenario === "disconnected"
    ? false
    : MOCK_ACCOUNT_SETTINGS.printerConnected;
}

export async function deleteMockAccount() {
  throwIfMockFailure("account-delete");
  isMockAccountDeleted = true;
}

export function resetMockData(printStatus?: MockPrintStatus) {
  mockDesigns = cloneDesigns(MOCK_MY_DESIGNS);
  mockCurrentPrintTask = null;
  isMockPrintInitialized = false;
  isMockAccountDeleted = false;
  nextMockPrintId = 5200;
  for (const post of MOCK_FEED_POSTS) {
    mockFeedLikes.set(post.id, post.likedByCurrentUser);
  }
  if (printStatus) {
    initializeMockPrintStatus(printStatus);
  }
}

function initializeMockPrintStatus(forcedStatus?: MockPrintStatus) {
  if (isMockPrintInitialized) {
    return;
  }

  const status = forcedStatus ?? getPrintScenarioFromUrl();
  if (!status) {
    mockCurrentPrintTask = { ...MOCK_PRINT_STATUS_LIST[0] };
  } else if (status === "EMPTY") {
    mockCurrentPrintTask = null;
  } else {
    const scenario = MOCK_PRINT_STATUS_LIST.find((task) => task.status === status);
    if (scenario) {
      mockCurrentPrintTask = { ...scenario };
    } else if (status === "ERROR" || status === "CANCELLED" || status === "CANCELED") {
      const failedTask = MOCK_PRINT_STATUS_LIST.find((task) => task.status === "FAILED");
      mockCurrentPrintTask = failedTask
        ? { ...failedTask, status, failureReason: status === "ERROR" ? failedTask.failureReason : "출력이 취소됐어요" }
        : null;
    } else {
      mockCurrentPrintTask = { ...MOCK_PRINT_STATUS_LIST[0] };
    }
  }

  isMockPrintInitialized = true;
}

function getPrintScenarioFromUrl(): MockPrintStatus | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  const rawStatus = new URLSearchParams(window.location.search).get("mockPrintStatus")?.toUpperCase();
  if (
    rawStatus === "PRINTING" ||
    rawStatus === "FAILED" ||
    rawStatus === "ERROR" ||
    rawStatus === "CANCELLED" ||
    rawStatus === "CANCELED" ||
    rawStatus === "COMPLETED" ||
    rawStatus === "EMPTY"
  ) {
    return rawStatus;
  }

  return undefined;
}

function getCurrentLocalTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function throwIfMockFailure(action: string) {
  if (typeof window === "undefined") {
    return;
  }

  const actions = new URLSearchParams(window.location.search)
    .get("mockError")
    ?.split(",")
    .map((item) => item.trim());
  if (actions?.includes(action)) {
    throw new Error(`Mock failure: ${action}`);
  }
}

function cloneDesigns(designs: MockMyDesign[]) {
  return designs.map((design) => ({ ...design }));
}
