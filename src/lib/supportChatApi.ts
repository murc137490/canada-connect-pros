import { supabase } from "@/integrations/supabase/client";
import { cleanSupportQuery, inferSupportReplyLanguage } from "@/lib/supportAiQuery";

export type SupportChatMessage = {
  role: "user" | "assistant";
  content: string;
};

const AI_CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat-hf`;

function isGetAppQuestion(text: string): boolean {
  const q = text.toLowerCase();
  return (
    /\b(download|install|get)\b.{0,40}\b(app|application)\b/.test(q) ||
    /\b(app|application)\b.{0,40}\b(download|install|home\s*screen|écran)\b/.test(q) ||
    /\btélécharg/.test(q) ||
    /\binstaller?\b.{0,30}\b(app|application)\b/.test(q) ||
    /\b(app|application)\s+altshift\b/.test(q) ||
    /\baltshift\s+app\b/.test(q) ||
    /\badd to home\b/.test(q) ||
    /\bécran d['’]?accueil\b/.test(q)
  );
}

function getAppGuideReply(lang: "en" | "fr"): string {
  if (lang === "fr") {
    return "AltShift n’est pas sur l’App Store ni le Play Store — ajoutez-la depuis le site sur l’écran d’accueil.\n\n[Android](/get-app/android) · [iPhone](/get-app/ios)";
  }
  return "AltShift isn’t on the App Store or Play Store — add it from the website to your home screen.\n\n[Android](/get-app/android) · [iPhone](/get-app/ios)";
}

export async function sendSupportChatMessage(
  rawInput: string,
  priorMessages: SupportChatMessage[],
  fallbacks: { signIn: string; noReply: string; errorGeneric: string }
): Promise<{ ok: true; reply: string } | { ok: false; reply: string }> {
  const cleaned = cleanSupportQuery(rawInput);
  const replyLang = inferSupportReplyLanguage(priorMessages, cleaned);

  if (isGetAppQuestion(cleaned)) {
    return { ok: true, reply: getAppGuideReply(replyLang) };
  }

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

  const pagePath =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`.slice(0, 200)
      : undefined;

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
        page_path: pagePath,
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
