import { createServerSupabaseClient } from "@/lib/supabase/server";
import AudioPlayer from "@/components/studio/audio-player";

export default async function LibraryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: jobs } = await supabase
    .from("generation_jobs")
    .select("id, prompt, status, created_at, rhythms(name)")
    .order("created_at", { ascending: false });

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
                <p className="text-xs italic mt-1">Statut : {job.status}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
