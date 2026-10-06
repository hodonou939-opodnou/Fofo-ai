"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { failStaleGenerationJobs, isStaleJob } from "@/lib/generation/stale-jobs";
import { isTerminal, type TrackStatus } from "@/lib/tracks/types";

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_BACKOFF_MS = 30_000;
const MAX_CONSECUTIVE_READ_FAILURES = 5;

export type LiveStatus = {
  status: TrackStatus;
  errorMessage: string | null;
  durationSeconds: number | null;
};

type JobRow = {
  status: TrackStatus;
  error_message: string | null;
  updated_at: string;
  audio_assets?: { duration_seconds: number } | { duration_seconds: number }[] | null;
};

function assetDuration(row: JobRow): number | null {
  const asset = Array.isArray(row.audio_assets) ? row.audio_assets[0] : row.audio_assets;
  return asset?.duration_seconds ?? null;
}

// Follows a creation that isn't finished yet (polling every 3 s, the
// documented Realtime-or-polling fallback) until it completes, fails or is
// cancelled. Read errors back off and give up after 5 in a row; a creation
// whose worker died is failed through the stale-job reaper, then re-read once.
export function useLiveStatus(jobId: string, initialStatus: TrackStatus) {
  const [live, setLive] = useState<LiveStatus | null>(null);
  const [trackingLost, setTrackingLost] = useState(false);

  useEffect(() => {
    if (isTerminal(initialStatus)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    const supabase = createBrowserSupabaseClient();

    async function readJob(): Promise<JobRow | null> {
      try {
        const { data, error } = await supabase
          .from("generation_jobs")
          .select("status, error_message, updated_at, audio_assets(duration_seconds)")
          .eq("id", jobId)
          .single();
        return error ? null : (data as JobRow);
      } catch {
        return null;
      }
    }

    async function poll(justReaped = false) {
      const job = await readJob();
      if (cancelled) return;

      if (!job) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= MAX_CONSECUTIVE_READ_FAILURES) {
          setTrackingLost(true);
          return;
        }
        timer = setTimeout(poll, Math.min(POLL_INTERVAL_MS * 2 ** consecutiveFailures, MAX_POLL_BACKOFF_MS));
        return;
      }

      consecutiveFailures = 0;
      setLive({ status: job.status, errorMessage: job.error_message, durationSeconds: assetDuration(job) });
      if (isTerminal(job.status)) return;

      if (!justReaped && isStaleJob(job.updated_at)) {
        await failStaleGenerationJobs(supabase);
        if (!cancelled) void poll(true);
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
    void poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, initialStatus]);

  return { live, trackingLost };
}
