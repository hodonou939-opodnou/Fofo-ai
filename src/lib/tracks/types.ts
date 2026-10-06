export type TrackStatus = "queued" | "processing" | "completed" | "failed" | "cancelled";

// One creation as every part of the UI sees it (grid, player, share page).
export type Track = {
  id: string;
  title: string;
  rhythmSlug: string | null;
  rhythmName: string | null;
  durationSeconds: number | null;
  status: TrackStatus;
  errorMessage: string | null;
  shareToken: string | null;
  createdAt: string;
  /** Where the audio streams from; defaults to the owner's secured route. */
  src?: string;
};

export const TERMINAL_STATUSES: readonly TrackStatus[] = ["completed", "failed", "cancelled"];

export function isTerminal(status: TrackStatus) {
  return TERMINAL_STATUSES.includes(status);
}

export function audioSrc(track: Track) {
  return track.src ?? `/api/audio/${track.id}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
