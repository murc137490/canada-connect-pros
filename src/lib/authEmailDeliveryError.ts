/** Supabase Auth returns this when signup requires email confirmation but SMTP/default mail fails. */
export function isAuthEmailDeliveryError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("confirmation email") ||
    m.includes("error sending") ||
    m.includes("unable to send") ||
    m.includes("failed to send") ||
    m.includes("email could not be sent") ||
    m.includes("sending confirmation") ||
    (m.includes("smtp") && m.includes("error")) ||
    m.includes("mail delivery")
  );
}
