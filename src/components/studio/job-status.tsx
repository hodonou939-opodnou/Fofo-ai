"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { failStaleGenerationJobs, isStaleJob } from "@/lib/generation/stale-jobs";
import AudioPlayer from "./audio-player";

type Status = "queued" | "processing" | "completed" | "failed" | "cancelled";
const TERMINAL_STATUSES: ReadonlySet<Status> = new Set(["completed", "failed", "cancelled"]);

const POLL_INTERVAL_MS = 3_000;
const MAX_POLL_BACKOFF_MS = 30_000;
const MAX_CONSECUTIVE_READ_FAILURES = 5;

// Rendered with key={jobId}, so a new job always starts from "queued".
export default function JobStatus({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<Status>("queued");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trackingLost, setTrackingLost] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveFailures = 0;
    const supabase = createBrowserSupabaseClient();

    async function readJob() {
      try {
        const { data, error } = await supabase
          .from("generation_jobs")
          .select("status, error_message, updated_at")
          .eq("id", jobId)
          .single();
        return error ? null : data;
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
        const backoff = POLL_INTERVAL_MS * 2 ** consecutiveFailures;
        timer = setTimeout(poll, Math.min(backoff, MAX_POLL_BACKOFF_MS));
        return;
      }

      consecutiveFailures = 0;
      setStatus(job.status as Status);
      setErrorMessage(job.error_message);
      if (TERMINAL_STATUSES.has(job.status as Status)) return;

      // The worker died without a terminal write: have the server fail the
      // job, then re-read right away to show the failed state. Re-read only
      // once, so a job the server doesn't consider stale (clock skew) goes
      // back to normal polling instead of spinning.
      if (!justReaped && isStaleJob(job.updated_at)) {
        await failStaleGenerationJobs(supabase);
        if (!cancelled) poll(true);
        return;
      }

      timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
    poll();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId]);

  if (status === "failed") {
    return (
      <p role="alert" className="mt-4 text-red-600 text-sm">
        {errorMessage ?? "La génération a échoué."}
      </p>
    );
  }

  if (status === "cancelled") {
    return <p className="mt-4 text-sm text-[var(--color-ink)]/70">La génération a été annulée.</p>;
  }

  if (status === "completed") {
    return <AudioPlayer jobId={jobId} />;
  }

  if (trackingLost) {
    return (
      <p role="alert" className="mt-4 text-sm">
        Impossible de suivre la génération — retrouve-la dans{" "}
        <Link href="/bibliotheque" className="underline">
          ta bibliothèque
        </Link>
        .
      </p>
    );
  }

  return (
    <p className="mt-4 text-sm text-[var(--color-ink)]/70">
      {status === "processing" ? "Génération en cours…" : "En file d'attente…"}
    </p>
  );
}
