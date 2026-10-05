import { createServerSupabaseClient } from "@/lib/supabase/server";
import { failStaleGenerationJobs } from "@/lib/generation/stale-jobs";
import AudioPlayer from "@/components/studio/audio-player";

const LIBRARY_PAGE_SIZE = 50;

const STATUS_LABELS: Record<string, string> = {
  queued: "En file d'attente",
  processing: "Génération en cours",
  failed: "Échec",
  cancelled: "Annulée",
};

export default async function LibraryPage() {
  const supabase = await createServerSupabaseClient();

  // Jobs whose worker died never got a terminal write: fail them first, so the
  // library never shows a generation "en cours" forever.
  const { error: staleError } = await failStaleGenerationJobs(supabase);
  if (staleError) console.error("[library] could not fail stale jobs", staleError);

  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("id, prompt, status, created_at, rhythms(name)")
    .order("created_at", { ascending: false })
    .limit(LIBRARY_PAGE_SIZE);

  return (
    <main className="px-6 py-12 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">Ma bibliothèque</h1>
      {!jobs || jobs.length === 0 ? (
        <p className="text-sm text-[var(--color-ink)]/70">
          Tu n&apos;as pas encore créé de musique.
        </p>
      ) : (
        <ul className="flex flex-col gap-6">
          {jobs.map((job) => (
            <li key={job.id} className="border-b border-[var(--color-ink)]/10 pb-4">
              <p className="font-medium">
                {(job.rhythms as unknown as { name: string } | null)?.name ?? "Rythme"}
              </p>
              <p className="text-sm text-[var(--color-ink)]/70">{job.prompt}</p>
              {job.status === "completed" ? (
                <AudioPlayer jobId={job.id} />
              ) : (
                <p className="text-xs italic mt-1">
                  Statut : {STATUS_LABELS[job.status] ?? job.status}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
