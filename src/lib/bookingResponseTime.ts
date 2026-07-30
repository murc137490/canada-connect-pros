/** Human-readable duration between booking created and pro response (accept/decline). */
export function formatProResponseDuration(
  createdAt: string,
  respondedAt: string | null | undefined,
  locale: "en" | "fr"
): string | null {
  if (!respondedAt?.trim()) return null;
  const a = new Date(createdAt).getTime();
  const b = new Date(respondedAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return null;
  const ms = b - a;
  const mins = Math.round(ms / 60000);
  if (mins < 1) return locale === "fr" ? "< 1 min" : "< 1 min";
  if (mins < 60) return locale === "fr" ? `${mins} min` : `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (locale === "fr") return m ? `${h} h ${m} min` : `${h} h`;
  return m ? `${h} h ${m} m` : `${h} h`;
}
