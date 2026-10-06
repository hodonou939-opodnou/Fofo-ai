"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import TrackGrid from "@/components/tracks/track-grid";
import { isDuration } from "@/lib/generation/options";
import { saveDraft } from "@/lib/studio/draft";
import type { Track } from "@/lib/tracks/types";

export default function LibraryView({ initialTracks }: { initialTracks: Track[] }) {
  const [tracks, setTracks] = useState(initialTracks);
  const router = useRouter();

  const onChange = useCallback((next: Track) => {
    setTracks((all) => all.map((t) => (t.id === next.id ? { ...t, ...next } : t)));
  }, []);
  const onRemoved = useCallback((id: string) => {
    setTracks((all) => all.filter((t) => t.id !== id));
  }, []);
  // Retrying from the library carries the idea to the Studio's creation box.
  const onRetry = useCallback(
    (track: Track) => {
      saveDraft({
        prompt: track.prompt ?? track.title,
        rhythmSlug: track.rhythmSlug ?? "",
        mood: "Festif",
        energy: "Modérée",
        durationSeconds: isDuration(track.durationSeconds) ? track.durationSeconds : 30,
      });
      router.push("/studio");
    },
    [router]
  );

  return <TrackGrid tracks={tracks} label="Ma bibliothèque" onChange={onChange} onRemoved={onRemoved} onRetry={onRetry} />;
}
