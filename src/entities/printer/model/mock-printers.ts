import { MOCK_PRINTERS } from "@/shared/mock/mock-printers";
import type { Printer } from "./printer";

export { MOCK_PRINTERS };

export function getPrintersWithFallback(
  printers?: Printer[] | null,
): Printer[] {
  return printers ?? MOCK_PRINTERS;
}
