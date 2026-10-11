"use client";

import TrackCard from "@/components/tracks/track-card";
import { usePlayer } from "@/components/player/player-provider";
import type { Track } from "@/lib/tracks/types";

// The cover grid used by the Studio and the library. Playing a track queues
// the grid's other finished tracks behind it in the shared player.
export default function TrackGrid({
  tracks,
  label,
  onChange,
  onRemoved,
  onRetry,
}: {
  tracks: Track[];
  label: string;
  onChange: (track: Track) => void;
  onRemoved: (id: string) => void;
  onRetry?: (track: Track) => void;
}) {
  const player = usePlayer();

  return (
    <ul aria-label={label} className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 lg:grid-cols-4">
      {tracks.map((t) => (
        <li key={t.id} className="min-w-0">
          <TrackCard
            track={t}
            isCurrent={player.current?.id === t.id}
            isPlaying={player.current?.id === t.id && player.isPlaying}
            onPlay={(track) => player.play(track, tracks)}
            onChange={onChange}
            onRemoved={(id) => {
              player.forget(id);
              onRemoved(id);
            }}
            onRetry={onRetry}
          />
        </li>
      ))}
    </ul>
  );
}
