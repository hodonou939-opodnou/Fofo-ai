import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_GENERATIONS_PER_HOUR = 10;

export async function checkRateLimit(
  supabase: Pick<SupabaseClient, "from">,
  userId: string
): Promise<{ allowed: boolean; count: number }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", oneHourAgo);

  const used = count ?? 0;
  return { allowed: used < MAX_GENERATIONS_PER_HOUR, count: used };
}
