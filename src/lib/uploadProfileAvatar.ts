import { supabase } from "@/integrations/supabase/client";

const BUCKET = "pro-photos";

export async function uploadProfileAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar-${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (upErr) throw upErr;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;
  const { error: profErr } = await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", userId);
  if (profErr) throw profErr;
  return url;
}

/** Keep public pro page photo in sync when the pro updates their dashboard avatar. */
export async function syncProPrimaryPhotoFromAvatar(proProfileId: string, userId: string, avatarUrl: string): Promise<void> {
  const { data: existing } = await supabase
    .from("pro_photos")
    .select("id")
    .eq("pro_profile_id", proProfileId)
    .eq("is_primary", true)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from("pro_photos").update({ url: avatarUrl }).eq("id", existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("pro_photos").insert({
    pro_profile_id: proProfileId,
    url: avatarUrl,
    is_primary: true,
  });
  if (error) throw error;
}
