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
// "Afficher plus" loads pages cumulatively; a sane ceiling keeps one request bounded.
const MAX_PAGES = 20;

function pageNumber(raw: string | undefined) {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_PAGES) : 1;
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ rythme?: string; page?: string }>;
}) {
  const { rythme, page: rawPage } = await searchParams;
  const page = pageNumber(rawPage);
  const shown = LIBRARY_PAGE_SIZE * page;
  const supabase = await createServerSupabaseClient();

  // Creations whose worker died never got a terminal write: fail them first,
  // so the library never shows a creation "en cours" forever.
  const { error: staleError } = await failStaleGenerationJobs(supabase);
  if (staleError) console.error("[library] could not fail stale jobs", staleError);

  const [rhythms, tracks] = await Promise.all([
    getPublishedRhythms(supabase),
    // One row more than shown tells us whether there is a next page.
    listTracks(supabase, { limit: shown + 1, rhythmSlug: rythme }),
  ]);
  const hasMore = tracks.length > shown;
  const visible = tracks.slice(0, shown);
  const nextPage = new URLSearchParams({ ...(rythme ? { rythme } : {}), page: String(page + 1) });
  const activeRhythm = rhythms.find((r) => r.slug === rythme);

  const filterClass = (active: boolean) =>
    [
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm transition",
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
        {visible.length > 0 ? (
          <>
            {/* Remount on a new page or filter so the grid never keeps a stale list. */}
            <LibraryView key={`${rythme ?? "tous"}-${page}`} initialTracks={visible} />
            {hasMore && (
              <div className="mt-10 flex justify-center">
                <Button href={`/bibliotheque?${nextPage}`} variant="ghost">
                  Afficher plus
                </Button>
              </div>
            )}
          </>
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
