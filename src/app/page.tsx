import Link from "next/link";
import CreationBox from "@/components/create/creation-box";
import RhythmCard from "@/components/rhythms/rhythm-card";
import VideoFacade from "@/components/rhythms/video-facade";
import Ripples from "@/components/brand/ripples";
import { getFeaturedVideos, getPublishedRhythms } from "@/lib/rhythms/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const STEPS = [
  {
    title: "Choisis ton rythme",
    text: "Tchinkounmè, Zinli ou Toba : chaque rythme a son histoire, ses instruments et sa couleur.",
  },
  {
    title: "Décris ton idée",
    text: "Quelques mots suffisent : une fête de village, une veillée, l'entrée des mariés.",
  },
  {
    title: "Écoute et partage",
    text: "Ta musique originale est prête en quelques instants. Télécharge-la ou envoie le lien.",
  },
];

export default async function HomePage({ searchParams }: { searchParams: Promise<{ rythme?: string }> }) {
  const { rythme } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [
    {
      data: { user },
    },
    rhythms,
    videos,
  ] = await Promise.all([supabase.auth.getUser(), getPublishedRhythms(supabase), getFeaturedVideos(supabase)]);

  return (
    <main>
      <section className="relative isolate overflow-hidden">
        <Ripples className="pointer-events-none absolute top-[-18rem] left-1/2 -z-10 w-[64rem] max-w-none -translate-x-1/2 opacity-[0.22]" />
        <div className="mx-auto max-w-3xl px-4 pt-14 pb-16 text-center sm:pt-24 md:px-6">
          <h1 className="font-display text-[3.4rem] text-ivory sm:text-7xl md:text-8xl">
            Fais vivre les rythmes du Bénin
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-dust sm:text-lg">
            Choisis un rythme, décris ton idée : Fofo compose pour toi une musique originale, prête à écouter et à
            partager.
          </p>
          <div id="creer" className="mt-10 scroll-mt-24">
            <CreationBox
              rhythms={rhythms.map((r) => ({ slug: r.slug, name: r.name }))}
              mode={user ? "signed-in" : "guest"}
              initialRhythm={rythme}
            />
          </div>
          {user && (
            <p className="mt-4 text-sm text-dust">
              Tes créations t&apos;attendent dans le{" "}
              <Link href="/studio" className="text-gold-light underline-offset-4 hover:underline">
                Studio
              </Link>
              .
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="rythmes" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
        <div className="max-w-2xl">
          <h2 id="rythmes" className="font-display text-5xl text-ivory md:text-6xl">
            Trois rythmes, trois histoires
          </h2>
          <p className="mt-4 text-dust">Chaque création part d&apos;un rythme réel, avec ses instruments et ses maîtres.</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rhythms.map((r) => (
            <RhythmCard
              key={r.slug}
              slug={r.slug}
              name={r.name}
              region={r.region}
              descriptionFr={r.descriptionFr}
              culturalReviewStatus={r.culturalReviewStatus}
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="comment" className="border-y border-ember/60 bg-soot/50">
        <div className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <h2 id="comment" className="font-display text-5xl text-ivory md:text-6xl">
            Comment ça marche
          </h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span className="font-display text-5xl text-gold">{i + 1}</span>
                <div>
                  <h3 className="text-lg font-semibold text-ivory">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-dust">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {videos.length > 0 && (
        <section aria-labelledby="maitres" className="mx-auto max-w-6xl px-4 py-16 md:px-6">
          <div className="max-w-2xl">
            <h2 id="maitres" className="font-display text-5xl text-ivory md:text-6xl">
              Écoute les maîtres
            </h2>
            <p className="mt-4 text-dust">Avant de créer, découvre celles et ceux qui font vivre ces rythmes.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {videos.map((v) => (
              <figure key={v.rhythmSlug}>
                <VideoFacade url={v.url} title={v.title} artist={v.artist} />
                <figcaption className="mt-3 text-sm text-dust">
                  <Link href={`/rythmes/${v.rhythmSlug}`} className="text-ivory hover:text-gold-light">
                    {v.rhythmName}
                  </Link>
                  {" — "}
                  {v.artist}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
