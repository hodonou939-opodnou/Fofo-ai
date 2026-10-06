import type { Metadata } from "next";
import StudioView from "@/components/tracks/studio-view";
import { failStaleGenerationJobs } from "@/lib/generation/stale-jobs";
import { getPublishedRhythms } from "@/lib/rhythms/queries";
import { listTracks } from "@/lib/tracks/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Studio" };

const RECENT_TRACKS = 12;

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ rythme?: string }> }) {
  const { rythme } = await searchParams;
  const supabase = await createServerSupabaseClient();
  // Creations whose worker died are failed before listing, so the grid never
  // shows a creation that will spin forever.
  await failStaleGenerationJobs(supabase);
  const [rhythms, tracks] = await Promise.all([
    getPublishedRhythms(supabase),
    listTracks(supabase, { limit: RECENT_TRACKS }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 md:px-6">
      <h1 className="sr-only">Studio</h1>
      <StudioView
        rhythms={rhythms.map((r) => ({ slug: r.slug, name: r.name }))}
        initialTracks={tracks}
        initialRhythm={rythme}
      />
    </main>
  );
}
