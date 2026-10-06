"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { audioSrc, type Track } from "@/lib/tracks/types";

const PLAYBACK_ERROR = "Impossible de lire ce morceau. Il a peut-être été supprimé — réessaie plus tard.";

export type Player = {
  current: Track | null;
  isPlaying: boolean;
  error: string | null;
  position: number;
  duration: number;
  hasPrevious: boolean;
  hasNext: boolean;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
};

const PlayerContext = createContext<Player | null>(null);

export function usePlayer(): Player {
  const player = useContext(PlayerContext);
  if (!player) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return player;
}

// One <audio> element for the whole app, so playback continues while the
// person navigates between pages (it lives in the root layout).
export default function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  const current = index >= 0 ? (queue[index] ?? null) : null;

  const start = useCallback(async (track: Track) => {
    const audio = audioRef.current;
    if (!audio) return;
    setError(null);
    setPosition(0);
    setDuration(track.durationSeconds ?? 0);
    audio.src = audioSrc(track);
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      // Autoplay refused or source unavailable: leave the bar ready to retry.
      setIsPlaying(false);
    }
  }, []);

  const play = useCallback(
    (track: Track, list?: Track[]) => {
      if (track.status !== "completed") return;
      const playable = (list ?? [track]).filter((t) => t.status === "completed");
      const nextQueue = playable.some((t) => t.id === track.id) ? playable : [track];
      setQueue(nextQueue);
      setIndex(nextQueue.findIndex((t) => t.id === track.id));
      void start(track);
    },
    [start]
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      const track = queue[nextIndex];
      if (!track) return;
      setIndex(nextIndex);
      void start(track);
    },
    [queue, start]
  );

  const next = useCallback(() => goTo(index + 1), [goTo, index]);
  const previous = useCallback(() => goTo(index - 1), [goTo, index]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }
    if (error) {
      void start(current);
      return;
    }
    audio
      .play()
      .then(() => setIsPlaying(true))
      .catch(() => setIsPlaying(false));
  }, [current, error, isPlaying, start]);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = seconds;
    setPosition(seconds);
  }, []);

  // Keep the ended → next handler pointed at the latest queue position.
  const nextRef = useRef(next);
  useEffect(() => {
    nextRef.current = next;
  }, [next]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setPosition(audio.currentTime);
    const onMeta = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onEnded = () => {
      setIsPlaying(false);
      nextRef.current();
    };
    const onError = () => {
      setIsPlaying(false);
      setError(PLAYBACK_ERROR);
    };
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, []);

  const value = useMemo<Player>(
    () => ({
      current,
      isPlaying,
      error,
      position,
      duration,
      hasPrevious: index > 0,
      hasNext: index >= 0 && index < queue.length - 1,
      play,
      toggle,
      next,
      previous,
      seek,
    }),
    [current, isPlaying, error, position, duration, index, queue.length, play, toggle, next, previous, seek]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" />
    </PlayerContext.Provider>
  );
}
