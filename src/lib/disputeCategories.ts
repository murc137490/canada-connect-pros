export type DisputeCategoryId =
  | "provider_never_arrived"
  | "incomplete_service"
  | "visible_damage"
  | "wrong_service"
  | "major_quality_issue"
  | "safety_issue"
  | "unauthorized_charges";

export type DisputeCategoryOption = {
  id: DisputeCategoryId;
  claimType: "service_problem" | "payment_problem" | "issue";
  labelKey: string;
  hintKey: string;
};

/** Valid dispute reasons — only these are accepted in the report flow. */
export const VALID_DISPUTE_CATEGORIES: DisputeCategoryOption[] = [
  {
    id: "provider_never_arrived",
    claimType: "service_problem",
    labelKey: "disputeProviderNeverArrived",
    hintKey: "disputeProviderNeverArrivedHint",
  },
  {
    id: "incomplete_service",
    claimType: "service_problem",
    labelKey: "disputeIncompleteService",
    hintKey: "disputeIncompleteServiceHint",
  },
  {
    id: "visible_damage",
    claimType: "service_problem",
    labelKey: "disputeVisibleDamage",
    hintKey: "disputeVisibleDamageHint",
  },
  {
    id: "wrong_service",
    claimType: "service_problem",
    labelKey: "disputeWrongService",
    hintKey: "disputeWrongServiceHint",
  },
  {
    id: "major_quality_issue",
    claimType: "service_problem",
    labelKey: "disputeMajorQuality",
    hintKey: "disputeMajorQualityHint",
  },
  {
    id: "safety_issue",
    claimType: "issue",
    labelKey: "disputeSafety",
    hintKey: "disputeSafetyHint",
  },
  {
    id: "unauthorized_charges",
    claimType: "payment_problem",
    labelKey: "disputeUnauthorizedCharges",
    hintKey: "disputeUnauthorizedChargesHint",
  },
];

/** Shown as policy — not selectable; refunds typically denied. */
export const INVALID_DISPUTE_EXAMPLES = [
  "disputeInvalidSubjective",
  "disputeInvalidChangeOfMind",
  "disputeInvalidCheaperElsewhere",
] as const;
