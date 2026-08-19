import { supabase } from "@/integrations/supabase/client";
import {
  LEGAL_DOCUMENT_VERSIONS,
  type LegalDocumentType,
} from "@/config/legalConfig";

export type RecordLegalAcceptanceInput = {
  documentType: LegalDocumentType | string;
  languageDisplayed: "en" | "fr";
  languageSelected?: "en" | "fr";
  context?: string | null;
  bookingId?: string | null;
};

/**
 * Persist versioned legal acceptance. Fails soft if table missing (migration pending).
 */
export async function recordLegalAcceptance(
  userId: string,
  input: RecordLegalAcceptanceInput,
): Promise<{ ok: boolean; error?: string }> {
  const meta =
    input.documentType in LEGAL_DOCUMENT_VERSIONS
      ? LEGAL_DOCUMENT_VERSIONS[input.documentType as LegalDocumentType]
      : { version: "unknown", hash: "unknown" };

  const row = {
    user_id: userId,
    document_type: input.documentType,
    document_version: meta.version,
    document_hash: meta.hash,
    language_displayed: input.languageDisplayed,
    language_selected: input.languageSelected ?? input.languageDisplayed,
    context: input.context ?? null,
    booking_id: input.bookingId ?? null,
    accepted_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("legal_document_acceptances" as "profiles").insert(row as never);
  if (error) {
    console.warn("legal_document_acceptances insert failed:", error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
