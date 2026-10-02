"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import AudioPlayer from "./audio-player";

type Status = "queued" | "processing" | "completed" | "failed";

export default function JobStatus({ jobId }: { jobId: string }) {
  const [status, setStatus] = useState<Status>("queued");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function poll() {
      const { data } = await supabase
        .from("generation_jobs")
        .select("status, error_message")
        .eq("id", jobId)
        .single();
      if (cancelled || !data) return;
      setStatus(data.status as Status);
      setErrorMessage(data.error_message);
      if (data.status !== "completed" && data.status !== "failed") {
        setTimeout(poll, 3000);
      }
    }
    poll();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  if (status === "failed") {
    return (
      <p role="alert" className="mt-4 text-red-600 text-sm">
        {errorMessage ?? "La génération a échoué."}
      </p>
    );
  }

  if (status === "completed") {
    return <AudioPlayer jobId={jobId} />;
  }

  return (
    <p className="mt-4 text-sm text-[var(--color-ink)]/70">
      {status === "processing" ? "Génération en cours…" : "En file d'attente…"}
    </p>
  );
}
