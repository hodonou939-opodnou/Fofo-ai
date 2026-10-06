"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import CreationBox, { type RhythmOption } from "@/components/create/creation-box";
import TrackGrid from "@/components/tracks/track-grid";
import { isDuration } from "@/lib/generation/options";
import type { Draft } from "@/lib/studio/draft";
import type { Track } from "@/lib/tracks/types";

export default function StudioView({
  rhythms,
  initialTracks,
  initialRhythm,
}: {
  rhythms: RhythmOption[];
  initialTracks: Track[];
  initialRhythm?: string;
}) {
  const [tracks, setTracks] = useState(initialTracks);
  const [retry, setRetry] = useState<{ key: number; draft: Draft } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const onCreated = useCallback(
    (jobId: string, draft: Draft) => {
      const rhythm = rhythms.find((r) => r.slug === draft.rhythmSlug);
      const placeholder: Track = {
        id: jobId,
        title: draft.prompt.slice(0, 60),
        prompt: draft.prompt,
        rhythmSlug: draft.rhythmSlug,
        rhythmName: rhythm?.name ?? null,
        durationSeconds: draft.durationSeconds,
        status: "queued",
        errorMessage: null,
        shareToken: null,
        createdAt: new Date().toISOString(),
      };
      // A network retry of the same submission returns the same job: don't list it twice.
      setTracks((all) => [placeholder, ...all.filter((t) => t.id !== jobId)]);
    },
    [rhythms]
  );

  const onChange = useCallback((next: Track) => {
    setTracks((all) => all.map((t) => (t.id === next.id ? { ...t, ...next } : t)));
  }, []);

  const onRemoved = useCallback((id: string) => {
    setTracks((all) => all.filter((t) => t.id !== id));
  }, []);

  const onRetry = useCallback((track: Track) => {
    setRetry((prev) => ({
      key: (prev?.key ?? 0) + 1,
      draft: {
        prompt: track.prompt ?? track.title,
        rhythmSlug: track.rhythmSlug ?? "",
        mood: "Festif",
        energy: "Modérée",
        durationSeconds: isDuration(track.durationSeconds) ? track.durationSeconds : 30,
      },
    }));
    boxRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, []);

  return (
    <div className="flex flex-col gap-14">
      <div ref={boxRef} className="mx-auto w-full max-w-3xl">
        <CreationBox
          key={retry?.key ?? 0}
          rhythms={rhythms}
          mode="signed-in"
          initialRhythm={initialRhythm}
          initialDraft={retry?.draft}
          onCreated={onCreated}
        />
      </div>

      <section aria-labelledby="mes-creations">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 id="mes-creations" className="font-display text-4xl text-ivory md:text-5xl">
            Mes créations
          </h2>
          {tracks.length > 0 && (
            <Link href="/bibliotheque" className="text-sm text-dust hover:text-gold-light">
              Tout voir
            </Link>
          )}
        </div>
        {tracks.length === 0 ? (
          <p className="rounded-panel border border-dashed border-ember px-6 py-12 text-center text-dust">
            Ta première musique t&apos;attend : décris ton idée juste au-dessus.
          </p>
        ) : (
          <TrackGrid tracks={tracks} label="Mes créations" onChange={onChange} onRemoved={onRemoved} onRetry={onRetry} />
        )}
      </section>
    </div>
  );
}
