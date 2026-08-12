export type MarketplaceMatchState =
  | "idle"
  | "hover"
  | "request"
  | "searching"
  | "matching"
  | "matched"
  | "success";

export const MOTION = {
  fast: 0.18,
  base: 0.28,
  reveal: 0.55,
  ease: [0.22, 1, 0.36, 1] as const,
} as const;
