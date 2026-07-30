/** Multiline customer block for Quebec invoices (name, phone, postal, service address). */
export function buildClientInvoiceContactBlock(
  p: { address?: string | null; full_name?: string | null; phone?: string | null; postal_code?: string | null } | null
): string {
  if (!p) return "";
  const lines: string[] = [];
  if (typeof p.full_name === "string" && p.full_name.trim()) lines.push(p.full_name.trim());
  if (typeof p.phone === "string" && p.phone.trim()) lines.push(p.phone.trim());
  if (typeof p.postal_code === "string" && p.postal_code.trim()) {
    const pc = p.postal_code.trim().toUpperCase().replace(/\s+/g, " ");
    lines.push(`Postal code / Code postal: ${pc}`);
  }
  if (typeof p.address === "string" && p.address.trim()) lines.push(p.address.trim());
  return lines.join("\n").trim();
}
