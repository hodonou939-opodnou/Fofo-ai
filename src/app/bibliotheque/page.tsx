import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/ui/button";
import LibraryView from "@/components/tracks/library-view";
import { failStaleGenerationJobs } from "@/lib/generation/stale-jobs";
import { getPublishedRhythms } from "@/lib/rhythms/queries";
import { listTracks } from "@/lib/tracks/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Ma bibliothèque" };

const LIBRARY_PAGE_SIZE = 50;

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ rythme?: string }> }) {
  const { rythme } = await searchParams;
  const supabase = await createServerSupabaseClient();

  // Creations whose worker died never got a terminal write: fail them first,
  // so the library never shows a creation "en cours" forever.
  const { error: staleError } = await failStaleGenerationJobs(supabase);
  if (staleError) console.error("[library] could not fail stale jobs", staleError);

  const [rhythms, tracks] = await Promise.all([
    getPublishedRhythms(supabase),
    listTracks(supabase, { limit: LIBRARY_PAGE_SIZE, rhythmSlug: rythme }),
  ]);
  const activeRhythm = rhythms.find((r) => r.slug === rythme);

  const filterClass = (active: boolean) =>
    [
      "min-h-10 rounded-full border px-4 py-2 text-sm transition",
      active ? "border-gold bg-gold/15 text-gold-light" : "border-ember text-dust hover:border-gold/50 hover:text-ivory",
    ].join(" ");

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 md:px-6">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <h1 className="font-display text-5xl text-ivory md:text-6xl">Ma bibliothèque</h1>
        <nav aria-label="Filtrer par rythme" className="flex flex-wrap gap-2">
          <Link href="/bibliotheque" aria-current={!activeRhythm ? "page" : undefined} className={filterClass(!activeRhythm)}>
            Tous
          </Link>
          {rhythms.map((r) => (
            <Link
              key={r.slug}
              href={`/bibliotheque?rythme=${r.slug}`}
              aria-current={activeRhythm?.slug === r.slug ? "page" : undefined}
              className={filterClass(activeRhythm?.slug === r.slug)}
            >
              {r.name}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-10">
        {tracks.length > 0 ? (
          <LibraryView initialTracks={tracks} />
        ) : activeRhythm ? (
          <p className="rounded-panel border border-dashed border-ember px-6 py-12 text-center text-dust">
            Aucune création avec ce rythme pour l&apos;instant.
          </p>
        ) : (
          <div className="rounded-panel border border-dashed border-ember px-6 py-14 text-center">
            <p className="text-dust">Ta bibliothèque est vide pour l&apos;instant.</p>
            <Button href="/studio" className="mt-5">
              Créer ma première musique
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
