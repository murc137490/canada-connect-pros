import { supabase } from "@/integrations/supabase/client";
import { cleanSupportQuery, inferSupportReplyLanguage } from "@/lib/supportAiQuery";

export type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-hf`;

export async function sendSupportChatMessage(
  rawInput: string,
  priorMessages: SupportChatMessage[],
  fallbacks: { signIn: string; noReply: string; errorGeneric: string }
): Promise<{ ok: true; reply: string } | { ok: false; reply: string }> {
  const cleaned = cleanSupportQuery(rawInput);
  const replyLang = inferSupportReplyLanguage(priorMessages, cleaned);

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    return { ok: false, reply: fallbacks.signIn };
  }

  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    return { ok: false, reply: "App misconfiguration: VITE_SUPABASE_ANON_KEY is missing." };
  }

  try {
    const resp = await fetch(AI_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({
        message: cleaned,
        access_token: session.access_token,
        language: replyLang,
        intent: "support_help",
        conversation_history: priorMessages
          .slice(-16)
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map(({ role, content }) => ({ role, content })),
      }),
    });

    const data = (await resp.json().catch(() => ({}))) as {
      message?: string;
      error?: string;
      details?: string;
    };
    const reply = data.message?.trim();
    const errMsg = data.error;
    const details = data.details;

    if (!resp.ok) {
      // Never show raw Gemini/HF error dumps in the chat UI.
      console.error("Support AI HTTP error", resp.status, errMsg, details);
      return { ok: false, reply: fallbacks.errorGeneric };
    }

    return { ok: true, reply: reply || fallbacks.noReply };
  } catch (e) {
    console.error("Support AI error:", e);
    return { ok: false, reply: fallbacks.errorGeneric };
  }
}
