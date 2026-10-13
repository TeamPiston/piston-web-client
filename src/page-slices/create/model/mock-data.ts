import type { FilamentColor } from "@/entities/artwork";
import { MOCK_CREATE_FIXTURES } from "@/shared/mock/mock-data";
import type {
  ChatHistory,
  CopyrightWarning,
  DesignVersion,
  PrintWarning,
  ResolvedArtworkModelParams,
} from "./types";

export const CREATE_FILAMENT_COLORS: FilamentColor[] = MOCK_CREATE_FIXTURES.filamentColors;
export const CREATE_FILAMENT_USAGE = MOCK_CREATE_FIXTURES.filamentUsage;
export const CREATE_ESTIMATED_PRINT_TIME = MOCK_CREATE_FIXTURES.estimatedPrintTime;
export const MOCK_PRINT_WARNING: PrintWarning = MOCK_CREATE_FIXTURES.printWarning;
export const MOCK_COPYRIGHT_WARNING: CopyrightWarning = MOCK_CREATE_FIXTURES.copyrightWarning;
export const INITIAL_CHAT_HISTORIES: ChatHistory[] = MOCK_CREATE_FIXTURES.chatHistories;
export const MOCK_VERSIONS: DesignVersion[] = MOCK_CREATE_FIXTURES.versions;
export const DEFAULT_MODEL_PARAMS: ResolvedArtworkModelParams = MOCK_CREATE_FIXTURES.defaultModel;
export const MOCK_CORRECTED_VERSION: Omit<DesignVersion, "id" | "label"> = MOCK_CREATE_FIXTURES.correctedVersion;

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
