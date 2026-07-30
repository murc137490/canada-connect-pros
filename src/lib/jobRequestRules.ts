export const MIN_CLAIM_REPORT_IMAGES = 3;

export type JobRemovalReason = "inappropriate" | "suspicious" | "redo";

export const JOB_REQUEST_STRIKE_LIMIT = 3;

export function jobRequestRulesList(locale: "en" | "fr"): string[] {
  if (locale === "fr") {
    return [
      "Services domestiques licenciés seulement (plomberie, CVAC, ménage, homme à tout faire, déménagement, etc.).",
      "Interdit : tout contenu illégal; services sexuels; armes; drogues; jeux d'argent; travail électrique/gaz non licencié.",
      "Interdit : amiante/plomb sans certification; surveillance harcelante; contournement fiscal; « cash seulement sans reçu » ambigu.",
      "Québec : respectez la RBQ, la CNESST et les permis municipaux pour rénovations majeures, structures, piscines, etc.",
      "Soyez précis : adresse/code postal, photos, budget réaliste, et fenêtre de temps claire.",
    ];
  }
  return [
    "Licensed home services only (plumbing, HVAC, cleaning, handyman, moving, furniture assembly, etc.).",
    "Not allowed: anything illegal; sexual/adult services; weapons; drugs; gambling; unlicensed electrical/gas work.",
    "Not allowed: asbestos/lead without certification; surveillance/harassment; tax evasion; vague “cash only, no receipt” jobs.",
    "Quebec: follow RBQ, CNESST, and municipal permit rules for major renos, structural work, pools, etc.",
    "Be specific: postal code, photos, realistic budget, and a clear time window.",
  ];
}
