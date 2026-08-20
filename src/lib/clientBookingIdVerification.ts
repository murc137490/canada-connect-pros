import { supabase } from "@/integrations/supabase/client";

export const CLIENT_BOOKING_ID_VERIFICATION_BUCKET = "client-booking-verification";
export const CLIENT_BOOKING_ID_MAX_BYTES = 8 * 1024 * 1024;

function safeFileExt(file: File): string {
  const raw = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "bin";
  return raw.length > 8 ? raw.slice(0, 8) : raw;
}

function newUploadId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  }
}

/** Reject oversized / non image-PDF files before upload (avoids opaque storage failures). */
export function assertClientBookingIdFile(file: File): void {
  if (!file || !(file instanceof File) || file.size <= 0) {
    throw new Error("INVALID_ID_FILE");
  }
  if (file.size > CLIENT_BOOKING_ID_MAX_BYTES) {
    throw new Error("ID_FILE_TOO_LARGE");
  }
  const type = (file.type || "").toLowerCase();
  const nameOk = /\.(jpe?g|png|webp|gif|heic|heif|pdf)$/i.test(file.name);
  const typeOk = type.startsWith("image/") || type === "application/pdf" || type === "";
  if (!typeOk && !nameOk) {
    throw new Error("ID_FILE_TYPE");
  }
}

/** Uploads to `{userId}/{uuid}.{ext}`. Returns the storage object path (not a public URL). */
export async function uploadClientBookingIdVerificationPhoto(userId: string, file: File): Promise<string> {
  assertClientBookingIdFile(file);
  const path = `${userId}/${newUploadId()}.${safeFileExt(file)}`;
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
