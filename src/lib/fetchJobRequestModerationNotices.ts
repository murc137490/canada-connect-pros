import { supabase } from "@/integrations/supabase/client";

export type JobModerationNotice = {
  id: string;
  title: string;
  body: string;
  rules_reminder: string | null;
  reason: string;
  strike_count: number | null;
  created_at: string;
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchJobRequestModerationNotices(userId: string): Promise<JobModerationNotice[]> {
  const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString();
  const { data, error } = await supabase
    .from("job_request_moderation_notices")
    .select("id, title, body, rules_reminder, reason, strike_count, created_at")
    .eq("user_id", userId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.warn("[whats-new] moderation notices", error.message);
    return [];
  }
  return (data ?? []) as JobModerationNotice[];
}

export async function markJobModerationNoticeRead(id: string): Promise<void> {
  await supabase
    .from("job_request_moderation_notices")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}
