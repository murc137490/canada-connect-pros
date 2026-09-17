/** Short public booking id shown to clients/admins (8 digits). */

export function displayBookingId(
  publicCode: string | null | undefined,
  bookingUuid?: string | null,
): string {
  const code = (publicCode ?? "").trim().toUpperCase();
  if (/^\d{8}$/.test(code)) return code;
  if (bookingUuid && /^[0-9a-f-]{36}$/i.test(bookingUuid)) {
    // Deterministic 8-digit fallback from UUID when code is missing/legacy.
    const hex = bookingUuid.replace(/-/g, "").slice(0, 8);
    const n = Number.parseInt(hex, 16) % 100_000_000;
    return String(n).padStart(8, "0");
  }
  if (code.length >= 5 && code.length <= 12 && !code.includes("-")) {
    return code;
  }
  return "--------";
}

/** Ticket / claim reference: letter + digits (e.g. R0000123). */
export function formatIssueTicketRef(issueNumber: number | string | null | undefined): string {
  const n =
    typeof issueNumber === "number"
      ? issueNumber
      : Number.parseInt(String(issueNumber ?? "").replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return "";
  return `R${String(Math.trunc(n)).padStart(7, "0")}`;
}
