import { supabase } from "@/integrations/supabase/client";

/** Deletes job_requests older than 7 days (DB purge, not just hidden in UI). */
export async function purgeStaleJobRequests(): Promise<void> {
  try {
    const { error } = await supabase.rpc("purge_job_requests_older_than_seven_days");
    if (error && !/purge_job_requests|function.*does not exist/i.test(error.message)) {
      console.warn("purgeStaleJobRequests:", error.message);
    }
  } catch {
    // Migration may not be applied yet
  }
}
