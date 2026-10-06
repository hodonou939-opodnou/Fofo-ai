"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import Cover from "@/components/brand/cover";
import Button from "@/components/ui/button";
import TrackMenu from "@/components/tracks/track-menu";
import { useLiveStatus } from "@/components/tracks/use-live-status";
import { formatDuration, type Track } from "@/lib/tracks/types";

export default function TrackCard({
  track: given,
  isCurrent = false,
  isPlaying = false,
  onPlay,
  onChange,
  onRemoved,
  onRetry,
}: {
  track: Track;
  isCurrent?: boolean;
  isPlaying?: boolean;
  onPlay: (track: Track) => void;
  onChange: (track: Track) => void;
  onRemoved: (id: string) => void;
  onRetry?: (track: Track) => void;
}) {
  const { live, trackingLost } = useLiveStatus(given.id, given.status);
  // Status comes from polling while the creation runs; everything the person
  // edits (title, sharing) always comes from the parent.
  const track: Track = live
    ? {
        ...given,
        status: live.status,
        errorMessage: live.errorMessage,
        durationSeconds: live.durationSeconds ?? given.durationSeconds,
      }
    : given;

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  const reported = useRef(given.status);
  useEffect(() => {
    if (!live || live.status === reported.current) return;
    reported.current = live.status;
    onChangeRef.current(track);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- report each status change once
  }, [live?.status]);

  const running = track.status === "queued" || track.status === "processing";

  return (
    <article className="group relative">
      <div
        className={[
          "relative overflow-hidden rounded-panel border transition",
          isCurrent ? "border-gold/70 shadow-glow" : "border-ember hover:border-gold/40",
        ].join(" ")}
      >
        <Cover slug={track.rhythmSlug} seed={track.id} className="aspect-square w-full" />

        {track.status === "completed" && (
          <button
            type="button"
            onClick={() => onPlay(track)}
            aria-label={`Écouter : ${track.title}`}
            className="absolute inset-0 flex items-end justify-start p-3"
          >
            <span
              className={[
                "grid size-12 place-items-center rounded-full shadow-lift transition",
                isCurrent && isPlaying
                  ? "bg-gold text-night"
                  : "bg-ivory/95 text-night opacity-90 group-hover:scale-105 group-hover:opacity-100",
              ].join(" ")}
            >
              {isCurrent && isPlaying ? <Equalizer /> : <PlayIcon />}
            </span>
          </button>
        )}

        {running && !trackingLost && (
          <div className="shimmer-surface absolute inset-0 flex items-end p-4 opacity-90">
            <p aria-live="polite" className="text-sm font-medium text-ivory">
              {track.status === "processing" ? "Création en cours…" : "En file d'attente…"}
            </p>
          </div>
        )}

        {(track.status === "failed" || track.status === "cancelled") && (
          <div className="absolute inset-0 bg-night/70" aria-hidden />
        )}

      </div>

      {/* Outside the clipped cover box, and with no z-index of its own (that would
          trap the phone bottom sheet under the player and tab bar). */}
      <div className="absolute top-2 right-2">
        <TrackMenu track={track} onChange={onChange} onRemoved={onRemoved} />
      </div>

      <div className="mt-3 min-w-0">
        <p title={track.title} className="truncate font-semibold text-ivory">
          {track.title}
        </p>
        <p className="mt-0.5 flex items-center gap-3 text-sm text-dust">
          {track.rhythmName && <span>{track.rhythmName}</span>}
          {track.status === "completed" && track.durationSeconds != null && (
            <span className="tabular-nums">{formatDuration(track.durationSeconds)}</span>
          )}
        </p>

        {track.status === "failed" && (
          <div className="mt-2">
            <p role="alert" className="text-sm text-danger">
              {track.errorMessage ?? "La création a échoué."}
            </p>
            {onRetry && (
              <Button variant="subtle" size="sm" className="mt-2" onClick={() => onRetry(track)}>
                Réessayer
              </Button>
            )}
          </div>
        )}
        {track.status === "cancelled" && <p className="mt-2 text-sm text-dust">Création annulée.</p>}
        {trackingLost && running && (
          <p role="alert" className="mt-2 text-sm text-dust">
            Impossible de suivre la création — retrouve-la dans{" "}
            <Link href="/bibliotheque" className="text-gold-light underline-offset-4 hover:underline">
              ta bibliothèque
            </Link>
            .
          </p>
        )}
      </div>
    </article>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" className="ml-0.5 size-5" aria-hidden>
      <path d="M6 4l10 6-10 6V4Z" fill="currentColor" />
    </svg>
  );
}

function Equalizer() {
  return (
    <span className="flex h-4 items-end gap-0.5" aria-hidden>
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1 animate-pulse rounded-sm bg-night"
          style={{ height: "100%", animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
