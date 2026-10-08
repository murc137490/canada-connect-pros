import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Same client, without the generated table types (for tables/RPCs added after types.ts was generated:
 * booking_series, pro_client_notes, rebook_nudges, growth RPCs).
 */
export const untypedDb = supabase as unknown as SupabaseClient;
