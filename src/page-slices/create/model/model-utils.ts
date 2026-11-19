import { DEFAULT_MODEL_PARAMS } from "./mock-data";
import type {
  DesignVersion,
  PrintCorrection,
  PrintWarning,
  ResolvedArtworkModelParams,
} from "./types";

export const resolveModelParams = (version: DesignVersion): ResolvedArtworkModelParams => ({
  stlUrl: version.stlUrl ?? DEFAULT_MODEL_PARAMS.stlUrl,
  scale: version.scale ?? DEFAULT_MODEL_PARAMS.scale,
  color: version.color ?? DEFAULT_MODEL_PARAMS.color,
  dimensions: version.dimensions ?? DEFAULT_MODEL_PARAMS.dimensions,
});

const getFirstNumber = (value: string) => {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
};

const formatMillimeters = (value: number) => `${value.toFixed(1)} mm`;

export const createPrintCorrection = (warning: PrintWarning): PrintCorrection => ({
  title: "규격에 맞게 고쳤어요",
  issues: warning.issues.map((issue) => {
    const currentValue = getFirstNumber(issue.current);
    const minimumValue = getFirstNumber(issue.required);
    const safetyMargin = minimumValue * 0.2;
    const correctedValue = Math.max(currentValue, minimumValue + safetyMargin);

    return {
      label: issue.label,
      current: issue.current,
      corrected: formatMillimeters(correctedValue),
    };
  }),
});
