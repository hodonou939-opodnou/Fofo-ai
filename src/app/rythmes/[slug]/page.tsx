import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cover from "@/components/brand/cover";
import Button from "@/components/ui/button";
import ReferenceList, { display } from "@/components/rhythms/reference-list";
import VideoFacade from "@/components/rhythms/video-facade";
import { getPublishedRhythms, getRhythmWithReferences } from "@/lib/rhythms/queries";
import { masters, resolveSameArtist } from "@/lib/rhythms/references";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const page = await getRhythmWithReferences(supabase, slug);
  if (!page) return { title: "Rythme introuvable" };
  return { title: page.rhythm.name, description: page.rhythm.descriptionFr };
}

export default async function RhythmPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createServerSupabaseClient();
  const [
    page,
    all,
    {
      data: { user },
    },
  ] = await Promise.all([getRhythmWithReferences(supabase, slug), getPublishedRhythms(supabase), supabase.auth.getUser()]);
  if (!page) notFound();

  const { rhythm, references } = page;
  const videos = resolveSameArtist(references).filter((r) => r.videoUrl);
  const others = all.filter((r) => r.slug !== rhythm.slug);
  const createHref = user ? `/studio?rythme=${rhythm.slug}` : `/?rythme=${rhythm.slug}#creer`;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-10 pb-16 md:px-6">
      <section className="grid items-center gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:gap-12">
        <Cover slug={rhythm.slug} seed={`rhythm-${rhythm.slug}`} className="aspect-square w-full rounded-panel shadow-lift" />
        <div>
          <h1 className="font-display text-7xl text-ivory md:text-8xl">{display(rhythm.name)}</h1>
          {rhythm.alternateNames.length > 0 && (
            <p className="mt-4 text-dust">Aussi appelé {rhythm.alternateNames.map(display).join(", ")}</p>
          )}
          {rhythm.region && (
            <p className="mt-6 flex items-center gap-2 text-gold-light">
              <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                <path
                  d="M10 18s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                  fill="currentColor"
                />
              </svg>
              {display(rhythm.region)}
            </p>
          )}
          {rhythm.instruments.length > 0 && (
            <ul aria-label="Instruments" className="mt-4 flex flex-wrap gap-2">
              {rhythm.instruments.map((i) => (
                <li key={i} className="rounded-full border border-ember bg-soot px-3.5 py-1.5 text-sm text-ivory">
                  {display(i)}
                </li>
              ))}
            </ul>
          )}
          <Button href={createHref} size="lg" className="mt-8">
            Créer avec ce rythme
          </Button>
        </div>
      </section>

      <section aria-labelledby="histoire" className="mt-20 max-w-3xl">
        <h2 id="histoire" className="font-display text-5xl text-ivory">
          Son histoire
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-ivory/90">{display(rhythm.descriptionFr)}</p>
        {rhythm.culturalReviewStatus === "unverified" && (
          <p className="mt-4 text-sm text-dust">
            Ces informations proviennent de recherches publiques et sont en attente de validation par un expert culturel.
          </p>
        )}
      </section>

      {references.length > 0 && (
        <section aria-labelledby="maitres" className="mt-20">
          <h2 id="maitres" className="font-display text-5xl text-ivory">
            Les maîtres du rythme
          </h2>
          <div className="mt-8">
            <ReferenceList references={masters(references)} />
          </div>
        </section>
      )}

      {videos.length > 0 && (
        <section aria-labelledby="ecouter" className="mt-20">
          <h2 id="ecouter" className="font-display text-5xl text-ivory">
            À écouter
          </h2>
          <p className="mt-3 text-dust">Les vidéos se chargent seulement quand tu appuies sur lecture.</p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v) => (
              <VideoFacade
                key={v.id}
                url={v.videoUrl!}
                title={display(v.knownWorks?.split(" ; ")[0] ?? v.artist)}
                artist={display(v.artist)}
              />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section aria-labelledby="autres" className="mt-20 border-t border-ember/60 pt-12">
          <h2 id="autres" className="text-xl font-semibold text-ivory">
            Les autres rythmes
          </h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2">
            {others.map((o) => (
              <li key={o.slug}>
                <Link
                  href={`/rythmes/${o.slug}`}
                  className="flex items-center gap-4 rounded-panel border border-ember bg-soot p-3 transition hover:border-gold/50"
                >
                  <Cover slug={o.slug} seed={`rhythm-${o.slug}`} className="size-16 shrink-0 rounded-tile" />
                  <span>
                    <span className="block font-display text-3xl text-ivory">{display(o.name)}</span>
                    {o.region && <span className="text-sm text-dust">{display(o.region)}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
