import { brandAddress, brandFrom, BRAND_FROM_NAME } from "./brandSender.ts";

export async function sendBrandEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = brandAddress(Deno.env.get("FROM_EMAIL"));
  if (resendKey) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: brandFrom(fromEmail), to: [to], subject, html }),
      });
      if (response.ok) return true;
      console.error("Resend delivery failed", await response.text());
    } catch (error) {
      console.error("Resend request failed", String(error));
    }
  }

  const host = Deno.env.get("SMTP_HOST")?.trim();
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  if (!host || !user || !pass) return false;
  const port = parseInt(Deno.env.get("SMTP_PORT") || "587", 10);
  try {
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({
      connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } },
      debug: { log: false, allowUnsecure: port === 587 },
    });
    const from = `${BRAND_FROM_NAME} <${fromEmail}>`;
    await client.send({ from, to, subject, content: " ", html });
    client.close();
    return true;
  } catch (error) {
    console.error("SMTP delivery failed", String(error));
    return false;
  }
}
