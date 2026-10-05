import type { SupabaseClient } from "@supabase/supabase-js";

// A queued/processing job not updated for this long is treated as dead and
// failed: the after() worker is not durable, so a killed invocation leaves no
// terminal write. Well above the generate route's maxDuration (120 s), so a
// live worker is never reaped. Shared by the library page and JobStatus.
export const STALE_JOB_THRESHOLD_SECONDS = 5 * 60;

export function isStaleJob(updatedAt: string, now: number = Date.now()): boolean {
  return now - Date.parse(updatedAt) > STALE_JOB_THRESHOLD_SECONDS * 1000;
}

// Fails the signed-in user's own stale jobs (fail_stale_generation_jobs,
// migration 0005) with a French timeout message.
export async function failStaleGenerationJobs(supabase: Pick<SupabaseClient, "rpc">) {
  const { error } = await supabase.rpc("fail_stale_generation_jobs", {
    p_stale_after_seconds: STALE_JOB_THRESHOLD_SECONDS,
  });
  return { error };
}
