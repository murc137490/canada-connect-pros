/** Service tag options for pro profiles (e.g. Emergency Repair, Commercial Work). Stored as service_tags (array) in DB. */
export const SERVICE_TAG_OPTIONS = [
  "Emergency Repair",
  "Commercial Work",
  "Residential",
  "Same-day service",
  "Insured",
] as const;

export type ServiceTagOption = (typeof SERVICE_TAG_OPTIONS)[number];
