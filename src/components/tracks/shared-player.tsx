"use client";

import { usePlayer } from "@/components/player/player-provider";
import type { Track } from "@/lib/tracks/types";

// The big play button of a share page: plays through the shared-audio route
// in the app-wide player, so it keeps playing if the visitor explores.
export default function SharedPlayer({ track }: { track: Track }) {
  const player = usePlayer();
  const isCurrent = player.current?.id === track.id;
  const playing = isCurrent && player.isPlaying;

  return (
    <button
      type="button"
      onClick={() => (isCurrent ? player.toggle() : player.play(track))}
      aria-label={playing ? "Pause" : `Écouter : ${track.title}`}
      className="grid size-20 place-items-center rounded-full bg-gold text-night shadow-glow transition hover:scale-105"
    >
      <svg viewBox="0 0 20 20" className="size-8" aria-hidden>
        {playing ? <path d="M6 4h3v12H6zM11 4h3v12h-3z" fill="currentColor" /> : <path d="M6.5 4l10 6-10 6V4Z" fill="currentColor" />}
      </svg>
    </button>
  );
}
