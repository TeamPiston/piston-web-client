import type {
  ArtworkModelDimensions,
  ArtworkModelParams,
  ArtworkModelScale,
} from "@/features/stl-viewer";

export type MessageRole = "assistant" | "user";

export interface PrintIssue {
  current: string;
  label: string;
  required: string;
}

export interface PrintWarning {
  description: string;
  issues: PrintIssue[];
  title: string;
}

export interface PrintCorrectionIssue {
  corrected: string;
  current: string;
  label: string;
}

export interface PrintCorrection {
  issues: PrintCorrectionIssue[];
  title: string;
}

export interface CopyrightWarning {
  description: string;
  title: string;
}

export interface ChatMessage {
  content: string;
  id: string;
  copyrightWarning?: CopyrightWarning;
  hasPrintIssue?: boolean;
  isPrintIssueResolved?: boolean;
  isCopyrightIssue?: boolean;
  printCorrection?: PrintCorrection;
  printWarning?: PrintWarning;
  role: MessageRole;
}

export type PrintSuccessPhase = "fading" | "hidden" | "visible";

export interface DesignVersion extends ArtworkModelParams {
  description: string;
  id: string;
  label: string;
  meta: string;
}

export interface ResolvedArtworkModelParams {
  color: string;
  dimensions: ArtworkModelDimensions;
  scale: ArtworkModelScale;
  stlUrl: string;
}

export interface ChatHistory {
  id: string;
  title: string;
}

export interface AttachedImage {
  id: string;
  name: string;
  url: string;
}
