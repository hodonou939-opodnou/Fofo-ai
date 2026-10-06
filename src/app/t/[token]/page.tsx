import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Cover from "@/components/brand/cover";
import Button, { buttonClasses } from "@/components/ui/button";
import SharedPlayer from "@/components/tracks/shared-player";
import { getSharedTrack } from "@/lib/tracks/shared";
import { formatDuration } from "@/lib/tracks/types";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const track = await getSharedTrack(token);
  if (!track) return { title: "Morceau introuvable", robots: { index: false } };
  const description = track.rhythmName
    ? `Une musique originale née du rythme ${track.rhythmName}, créée sur Fofo AI.`
    : "Une musique originale créée sur Fofo AI.";
  return {
    title: track.title,
    description,
    // A share link is private to whoever holds it: never in search results.
    robots: { index: false, follow: false },
    openGraph: { title: track.title, description, type: "music.song", siteName: "Fofo AI" },
    twitter: { card: "summary_large_image", title: track.title, description },
  };
}

export default async function SharedTrackPage({ params }: Props) {
  const { token } = await params;
  const track = await getSharedTrack(token);
  if (!track) notFound();

  const playable = {
    id: `shared-${token}`,
    title: track.title,
    rhythmSlug: track.rhythmSlug,
    rhythmName: track.rhythmName,
    durationSeconds: track.durationSeconds,
    status: "completed" as const,
    errorMessage: null,
    shareToken: token,
    createdAt: track.createdAt,
    src: `/api/share/${token}/audio`,
  };

  return (
    <main className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-6">
      <section className="grid items-center gap-10 md:grid-cols-2">
        <Cover slug={track.rhythmSlug} seed={token} className="aspect-square w-full rounded-panel shadow-lift" />
        <div>
          <p className="text-sm text-dust">Une création Fofo AI</p>
          <h1 className="mt-3 font-display text-6xl break-words text-ivory md:text-7xl">{track.title}</h1>
          <p className="mt-4 flex flex-wrap items-center gap-4 text-dust">
            {track.rhythmName && track.rhythmSlug && (
              <Link href={`/rythmes/${track.rhythmSlug}`} className="text-gold-light hover:underline">
                {track.rhythmName}
              </Link>
            )}
            <span className="tabular-nums">{formatDuration(track.durationSeconds)}</span>
          </p>
          <div className="mt-8 flex items-center gap-4">
            <SharedPlayer track={playable} />
            <a href={`/api/share/${token}/audio?download=1`} className={buttonClasses("ghost", "md")}>
              Télécharger
            </a>
          </div>
        </div>
      </section>

      <section className="mt-20 rounded-panel border border-gold/30 bg-soot/70 p-8 text-center md:p-12">
        <h2 className="font-display text-5xl text-ivory">À toi de créer</h2>
        <p className="mx-auto mt-4 max-w-md text-dust">
          Choisis un rythme du Bénin, décris ton idée : Fofo compose ta propre musique originale.
        </p>
        <Button href={track.rhythmSlug ? `/?rythme=${track.rhythmSlug}#creer` : "/#creer"} size="lg" className="mt-8">
          Crée la tienne
        </Button>
      </section>
    </main>
  );
}
