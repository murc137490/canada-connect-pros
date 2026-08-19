import { supabase } from "@/integrations/supabase/client";

export const CLIENT_BOOKING_ID_VERIFICATION_BUCKET = "client-booking-verification";

function safeFileExt(file: File): string {
  const raw = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  return raw.length > 8 ? raw.slice(0, 8) : raw;
}

/** Uploads to `{userId}/{uuid}.{ext}`. Returns the storage object path (not a public URL). */
export async function uploadClientBookingIdVerificationPhoto(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.${safeFileExt(file)}`;
  const { error } = await supabase.storage.from(CLIENT_BOOKING_ID_VERIFICATION_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function removeClientBookingIdVerificationPhoto(path: string): Promise<void> {
  await supabase.storage.from(CLIENT_BOOKING_ID_VERIFICATION_BUCKET).remove([path]);
}

function isMissingBookingIdVerificationColumn(message: string): boolean {
  return /booking_id_verification_photo_path|schema cache|could not find|column/i.test(message);
}

/** Upload file to storage and save path on `profiles` for future bookings. */
export async function persistClientBookingIdVerificationOnProfile(
  userId: string,
  file: File,
  previousPath?: string | null,
): Promise<string> {
  if (previousPath?.trim()) {
    await removeClientBookingIdVerificationPhoto(previousPath).catch(() => undefined);
  }
  const path = await uploadClientBookingIdVerificationPhoto(userId, file);
  const { error } = await supabase
    .from("profiles")
    .update({
      booking_id_verification_photo_path: path,
      booking_id_verification_status: "verified",
    } as never)
    .eq("user_id", userId);
  if (error) {
    await removeClientBookingIdVerificationPhoto(path).catch(() => undefined);
    const msg = `${error.message ?? ""} ${(error as { details?: string }).details ?? ""}`;
    if (isMissingBookingIdVerificationColumn(msg)) {
      throw new Error(
        "MISSING_PROFILE_COLUMN: Run supabase/migrations/20260516120000_client_booking_id_verification.sql in Supabase.",
      );
    }
    throw error;
  }
  return path;
}
