import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function RhythmDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: rhythm } = await supabase
    .from("rhythms")
    .select("name, description_fr, cultural_review_status, alternate_names")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (!rhythm) notFound();

  return (
    <main className="px-6 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold">{rhythm.name}</h1>
      {rhythm.alternate_names.length > 0 && (
        <p className="mt-1 text-sm text-[var(--color-ink)]/60">
          Aussi connu sous : {rhythm.alternate_names.join(", ")}
        </p>
      )}
      <p className="mt-4">{rhythm.description_fr}</p>
      {rhythm.cultural_review_status === "unverified" && (
        <p className="mt-4 text-xs italic text-[var(--color-ink)]/60">
          Ces informations proviennent de recherches publiques et sont en attente de validation
          par un expert culturel.
        </p>
      )}
    </main>
  );
}
