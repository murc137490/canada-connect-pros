import { supabase } from "@/integrations/supabase/client";

export type PlatformWhatsNewRow = {
  id: string;
  title: string;
  body: string | null;
  href: string;
  created_at: string;
  deleted_at?: string | null;
};

export async function fetchActivePlatformWhatsNewAnnouncements(): Promise<PlatformWhatsNewRow[]> {
  const { data, error } = await supabase
    .from("platform_whats_new_announcements")
    .select("id, title, body, href, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    console.warn("[whats-new] announcements fetch failed", error.message);
    return [];
  }
  return (data ?? []) as PlatformWhatsNewRow[];
}

export async function fetchAdminPlatformWhatsNewAnnouncements(): Promise<PlatformWhatsNewRow[]> {
  const { data, error } = await supabase
    .from("platform_whats_new_announcements")
    .select("id, title, body, href, created_at, deleted_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as PlatformWhatsNewRow[];
}

export async function createPlatformWhatsNewAnnouncement(input: {
  title: string;
  body: string;
  href: string;
  createdBy: string;
}): Promise<PlatformWhatsNewRow> {
  const { data, error } = await supabase
    .from("platform_whats_new_announcements")
    .insert({
      title: input.title.trim(),
      body: input.body.trim() || null,
      href: input.href.trim() || "/dashboard",
      created_by: input.createdBy,
    })
    .select("id, title, body, href, created_at")
    .single();
  if (error) throw error;
  return data as PlatformWhatsNewRow;
}

export async function deletePlatformWhatsNewAnnouncement(id: string): Promise<void> {
  const { error } = await supabase
    .from("platform_whats_new_announcements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}
