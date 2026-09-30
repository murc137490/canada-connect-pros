/**
 * Telnyx Messaging API helper.
 * Secrets: TELNYX_API_KEY, TELNYX_SMS_FROM (E.164, e.g. +14508003177)
 */
export type TelnyxSmsResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status: number };

export function telnyxSmsConfigured(): boolean {
  return !!(Deno.env.get("TELNYX_API_KEY")?.trim() && Deno.env.get("TELNYX_SMS_FROM")?.trim());
}

export async function sendTelnyxSms(params: {
  to: string;
  text: string;
  from?: string;
}): Promise<TelnyxSmsResult> {
  const apiKey = Deno.env.get("TELNYX_API_KEY")?.trim();
  const from = (params.from ?? Deno.env.get("TELNYX_SMS_FROM") ?? "").trim();
  if (!apiKey || !from) {
    return { ok: false, error: "telnyx_not_configured", status: 500 };
  }

  const res = await fetch("https://api.telnyx.com/v2/messages", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      from,
      to: params.to,
      text: params.text,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    data?: { id?: string };
    errors?: { detail?: string; title?: string }[];
    error?: string;
  };

  if (!res.ok) {
    const detail =
      data.errors?.[0]?.detail ||
      data.errors?.[0]?.title ||
      data.error ||
      `telnyx_http_${res.status}`;
    return { ok: false, error: detail, status: res.status >= 500 ? 502 : 400 };
  }

  return { ok: true, id: data.data?.id ?? "" };
}
