import { MOCK_PRINTERS, readMockPrinters, type MockPrinter } from "./mock-printers";

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

interface MockArtworkPrint {
  title: string;
  stlUrl: string;
  printerId: string;
  colorMode: string;
}

export type MockPrintPersistenceWarning = "snapshot-removed" | "snapshot-may-be-stale";

interface MockPrintTask {
  persistenceWarning?: MockPrintPersistenceWarning;
  job?: MockArtworkPrint;
  simulateFailure?: boolean;
  artworkName: string;
  createdAt: string;
  estimatedEndTime: string;
  failureReason?: string;
  filamentRemaining?: string;
  id: number;
  modelUrl?: string;
  printerId?: string;
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
  id: "demo-user",
  email: "demo@example.com",
  name: "데모 사용자",
};

export const MOCK_ACCOUNT_SETTINGS = {
  printerConnected: true,
  printerName: "MAX4_02",
  printerModel: "QIDI X-Max 4",
  printerAddress: "192.0.2.24",
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
    author: "데모 작가1",
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
    author: "데모 작가2",
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
    author: "데모 작가2",
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
    author: "데모 작가3",
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
type MockPrintState = { task: MockPrintTask | null };
let normalPrint: MockPrintState | undefined;
let debugPrint: (MockPrintState & { scenario: MockPrintStatus }) | undefined;
const firstMockPrintId = 5200;
let nextMockPrintId = firstMockPrintId;
const mockPrintStorageKey = "piston:mock-print:v1";
const mockPrintListeners = new Set<() => void>();
const mockPrintMinutes = 52;
let isMockAccountDeleted = false;
const mockFeedLikes = new Map(
  MOCK_FEED_POSTS.map((post) => [post.id, post.likedByCurrentUser]),
);

export function isMockModeEnabled() {
  return process.env.NEXT_PUBLIC_USE_MOCK === "true";
}

function isMockUrlControlEnabled() {
  return isMockModeEnabled() || process.env.NODE_ENV !== "production";
}

export async function withMockFallback<T>(
  apiOperation: () => Promise<T>,
  mockOperation: () => Promise<T> | T,
): Promise<T> {
  if (isMockModeEnabled()) {
    return mockOperation();
  }

  // The historical name is retained for callers; API mode never falls back.
  return apiOperation();
}

export async function fetchMockPrintStatus(): Promise<MockPrintTask | null> {
  const state = getPrintState();
  advancePrintState(state);
  return state.task ? { ...state.task } : null;
}

export async function fetchMockPrintStatusList(): Promise<MockPrintTask[]> {
  return MOCK_PRINT_STATUS_LIST.map((task) => ({ ...task }));
}

export function createMockPrintTask(
  artworkName = "육각형 연필꽂이",
  selection?: { job: MockArtworkPrint; printerName: string },
) {
  return startMockPrint(artworkName, selection);
}

function startMockPrint(
  artworkName: string,
  selection?: { job: MockArtworkPrint; printerName: string },
  retryPrinter?: MockPrinter,
) {
  if (!isMockModeEnabled()) throw new Error("출력 기능 준비 중");
  throwIfMockFailure("print-create");
  const state = getPrintState();
  if (hasActiveMockPrint()) {
    throw new Error("이미 출력 중인 작업이 있어요.");
  }
  const printer = retryPrinter ?? (selection
    ? { id: selection.job.printerId, name: selection.printerName }
    : (readMockPrinters() ?? MOCK_PRINTERS).find(({ connectionStatus }) => connectionStatus === "connected"));
  if (!printer) throw new Error("연결된 프린터가 없어요.");

  const matchingDesign = mockDesigns.find((design) => design.title === artworkName);
  const nextTask: MockPrintTask = {
    id: nextMockPrintId++,
    userId: MOCK_ACCOUNT_PROFILE.id,
    artworkName,
    job: selection?.job,
    simulateFailure: selection && hasMockFailure("print-progress"),
    modelUrl: selection?.job.stlUrl ?? matchingDesign?.stlUrl ?? "/models/pencil-holder.stl",
    printerId: printer.id,
    printerName: printer.name,
    printingMethod: "FDM",
    filamentRemaining: matchingDesign
      ? `${matchingDesign.filamentLength} / ${matchingDesign.filamentWeight}`
      : MOCK_ACCOUNT_SETTINGS.filamentRemaining,
    status: "PRINTING",
    progress: 0,
    remainingMinutes: mockPrintMinutes,
    estimatedEndTime: "약 52분 후 완료 예정",
    createdAt: new Date().toISOString(),
  };
  return updateMockPrintTask(state, nextTask);
}

export async function cancelMockPrint(printTaskId: number) {
  throwIfMockFailure("print-cancel");
  const state = getPrintState();
  advancePrintState(state);
  const task = state.task;
  if (task?.id !== printTaskId || task.status !== "PRINTING") {
    return;
  }

  const cancelledTask: MockPrintTask = {
    ...task,
    status: "CANCELLED",
    failureReason: "사용자 요청으로 중단",
    stoppedAt: getCurrentLocalTime(),
    remainingMinutes: 0,
    estimatedEndTime: `${getCurrentLocalTime()} 중단`,
  };
  return updateMockPrintTask(state, cancelledTask);
}

export async function retryMockPrint(printTaskId: number) {
  throwIfMockFailure("print-retry");
  const previousTask = getPrintState().task;
  if (previousTask?.id !== printTaskId ||
    !["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(previousTask.status)) {
    throw new Error("다시 출력할 작업을 확인하지 못했어요.");
  }

  const printer = getMockRetryPrinter(previousTask);
  if (printer?.connectionStatus !== "connected") {
    throw new Error("이 작업의 프린터가 삭제됐거나 연결이 끊겼어요.");
  }

  const selection = previousTask.job && { job: previousTask.job, printerName: printer.name };
  return startMockPrint(previousTask.artworkName, selection, printer);
}

type MockPrintPrinter = Pick<MockPrintTask, "printerId" | "printerName" | "job">;

function mockPrintPrinterId(task: MockPrintPrinter) {
  return task.printerId ?? task.job?.printerId ??
    MOCK_PRINTERS.find(({ name }) => name === task.printerName)?.id;
}

export function getMockRetryPrinter(
  task: MockPrintPrinter,
  printers: readonly MockPrinter[] | null | undefined = readMockPrinters(),
) {
  const id = mockPrintPrinterId(task);
  return (printers === undefined ? MOCK_PRINTERS : printers)?.find((printer) => printer.id === id);
}

export function subscribeMockPrint(listener: () => void) {
  mockPrintListeners.add(listener);
  return () => { mockPrintListeners.delete(listener); };
}

export function getCurrentMockPrint() {
  return getPrintState().task;
}

export function hasActiveMockPrint() {
  advanceMockPrint();
  return isActiveMockPrint(getNormalPrint().task) || isActiveMockPrint(getPrintState().task);
}

export function isActiveMockPrint(task: MockPrintTask | null) {
  // The built-in status fixtures are replaceable; jobs submitted in this tab are not.
  return task?.status === "PRINTING" && task.id >= firstMockPrintId;
}

export function clearMockPrintForPrinter(printerId: string) {
  for (const state of new Set([getNormalPrint(), getPrintState()])) {
    if (state.task && mockPrintPrinterId(state.task) === printerId) {
      updateMockPrintTask(state, null);
    }
  }
}

export function advanceMockPrint() {
  const normal = getNormalPrint();
  const visible = getPrintState();
  advancePrintState(normal);
  if (visible !== normal) advancePrintState(visible);
}

function advancePrintState(state: MockPrintState) {
  const task = state.task;
  if (!task || !isActiveMockPrint(task)) return;

  const elapsedMinutes = Math.max(0, (Date.now() - Date.parse(task.createdAt)) / 60_000);
  if (task.simulateFailure && elapsedMinutes >= 1) {
    updateMockPrintTask(state, {
      ...task,
      status: "FAILED",
      failureReason: "가상 출력 중 오류가 발생했어요.",
      stoppedAt: getCurrentLocalTime(),
      remainingMinutes: 0,
      estimatedEndTime: "출력 실패",
    });
    return;
  }

  const progress = Math.min(100, Math.floor(elapsedMinutes * 100 / mockPrintMinutes));
  const remainingMinutes = Math.max(0, Math.ceil(mockPrintMinutes - elapsedMinutes));
  if (progress === task.progress && remainingMinutes === task.remainingMinutes) return;

  updateMockPrintTask(state, {
    ...task,
    status: progress === 100 ? "COMPLETED" : "PRINTING",
    progress,
    remainingMinutes,
    estimatedEndTime: progress === 100 ? `${getCurrentLocalTime()} 완료` : `약 ${remainingMinutes}분 후 완료 예정`,
  });
}

function updateMockPrintTask(state: MockPrintState, task: MockPrintTask): MockPrintTask;
function updateMockPrintTask(state: MockPrintState, task: null): null;
function updateMockPrintTask(state: MockPrintState, task: MockPrintTask | null) {
  const next = task && { ...task };
  if (next) delete next.persistenceWarning;
  if (state === normalPrint && isMockModeEnabled() && typeof window !== "undefined") {
    const warning = persistMockPrint(next);
    if (next && warning) next.persistenceWarning = warning;
  }
  state.task = next;
  mockPrintListeners.forEach((listener) => listener());
  return next && { ...next };
}

// If updating fails, try to remove the previous snapshot before exposing the new in-memory state.
function persistMockPrint(task: MockPrintTask | null): MockPrintPersistenceWarning | undefined {
  try {
    window.sessionStorage.setItem(mockPrintStorageKey, JSON.stringify(task));
  } catch {
    try {
      window.sessionStorage.removeItem(mockPrintStorageKey);
      return "snapshot-removed";
    } catch {
      return "snapshot-may-be-stale";
    }
  }
}

function restoreMockPrint() {
  if (!isMockModeEnabled() || typeof window === "undefined") return;

  try {
    const saved = window.sessionStorage?.getItem(mockPrintStorageKey);
    if (saved == null) return;

    const task: MockPrintTask | null = JSON.parse(saved);
    if (task !== null && (
      !Number.isSafeInteger(task.id) || task.id < 1 ||
      task.userId !== MOCK_ACCOUNT_PROFILE.id ||
      typeof task.artworkName !== "string" || !Number.isFinite(Date.parse(task.createdAt)) ||
      !["PRINTING", "COMPLETED", "FAILED", "CANCELLED"].includes(task.status) ||
      !Number.isFinite(task.progress) || !Number.isFinite(task.remainingMinutes) ||
      typeof task.estimatedEndTime !== "string" ||
      (task.printerId !== undefined && typeof task.printerId !== "string") ||
      (task.modelUrl !== undefined && !isLocalMockModel(task.modelUrl)) ||
      (task.simulateFailure !== undefined && typeof task.simulateFailure !== "boolean") ||
      (task.job !== undefined && (
        !task.job || typeof task.job.title !== "string" || !isLocalMockModel(task.job.stlUrl) ||
        typeof task.job.printerId !== "string" || typeof task.job.colorMode !== "string"
      ))
    )) return;

    const printers = readMockPrinters();
    const printerId = task ? mockPrintPrinterId(task) : undefined;
    if (task) nextMockPrintId = Math.max(nextMockPrintId, task.id + 1);
    return {
      task: task && printers !== null && (printers ?? MOCK_PRINTERS).some(({ id }) => id === printerId)
        ? { ...task, printerId, persistenceWarning: undefined }
        : null,
    };
  } catch {
    // An unreadable demo snapshot can be replaced by a fresh demo session.
  }
}

function isLocalMockModel(url: unknown) {
  return typeof url === "string" && /^\/(?:models\/)?[\w.-]+\.stl$/i.test(url);
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
  if (!isMockUrlControlEnabled() || typeof window === "undefined") {
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
  normalPrint = printStatus ? { task: getPrintFixture(printStatus) } : undefined;
  debugPrint = undefined;
  isMockAccountDeleted = false;
  nextMockPrintId = firstMockPrintId;
  try {
    if (isMockModeEnabled() && typeof window !== "undefined") {
      window.sessionStorage?.removeItem(mockPrintStorageKey);
    }
  } catch {
    // The in-memory demo is already reset.
  }
  for (const post of MOCK_FEED_POSTS) {
    mockFeedLikes.set(post.id, post.likedByCurrentUser);
  }
}

function getNormalPrint() {
  return normalPrint ??= restoreMockPrint() ?? { task: getPrintFixture("PRINTING") };
}

function getPrintState() {
  const scenario = isMockModeEnabled() ? getPrintScenarioFromUrl() : undefined;
  if (!scenario) {
    debugPrint = undefined;
    return getNormalPrint();
  }
  if (debugPrint?.scenario !== scenario) {
    debugPrint = { scenario, task: getPrintFixture(scenario) };
  }
  return debugPrint;
}

function getPrintFixture(status: MockPrintStatus): MockPrintTask | null {
  if (status === "EMPTY") return null;
  const fixture = MOCK_PRINT_STATUS_LIST.find((task) => task.status === status);
  if (fixture) return { ...fixture };
  const failed = MOCK_PRINT_STATUS_LIST.find((task) => task.status === "FAILED");
  return failed ? {
    ...failed,
    status,
    failureReason: status === "ERROR" ? failed.failureReason : "출력이 취소됐어요",
  } : null;
}

function getPrintScenarioFromUrl(): MockPrintStatus | undefined {
  if (!isMockUrlControlEnabled() || typeof window === "undefined") {
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
  if (hasMockFailure(action)) {
    throw new Error(`Mock failure: ${action}`);
  }
}

function hasMockFailure(action: string) {
  if (!isMockUrlControlEnabled() || typeof window === "undefined") return false;

  const actions = new URLSearchParams(window.location.search)
    .get("mockError")
    ?.split(",")
    .map((item) => item.trim());
  return actions?.includes(action) ?? false;
}

function cloneDesigns(designs: MockMyDesign[]) {
  return designs.map((design) => ({ ...design }));
}
