import type { SupabaseClient } from "@supabase/supabase-js";
import type { Track, TrackStatus } from "@/lib/tracks/types";

type TrackRow = {
  id: string;
  title: string | null;
  prompt: string;
  status: TrackStatus;
  error_message: string | null;
  share_token: string | null;
  created_at: string;
  duration_seconds: number;
  rhythms: { slug: string; name: string } | null;
  audio_assets: { duration_seconds: number } | { duration_seconds: number }[] | null;
};

export function toTrack(row: TrackRow): Track {
  const asset = Array.isArray(row.audio_assets) ? row.audio_assets[0] : row.audio_assets;
  return {
    id: row.id,
    title: row.title ?? row.prompt.slice(0, 60),
    prompt: row.prompt,
    rhythmSlug: row.rhythms?.slug ?? null,
    rhythmName: row.rhythms?.name ?? null,
    durationSeconds: asset?.duration_seconds ?? row.duration_seconds,
    status: row.status,
    errorMessage: row.error_message,
    shareToken: row.share_token,
    createdAt: row.created_at,
  };
}

// The signed-in user's creations, newest first, without deleted ones (RLS
// already limits the rows to the owner).
export async function listTracks(
  supabase: SupabaseClient,
  { limit, rhythmSlug }: { limit?: number; rhythmSlug?: string } = {}
): Promise<Track[]> {
  const rhythmJoin = rhythmSlug ? "rhythms!inner(slug, name)" : "rhythms(slug, name)";
  let query = supabase
    .from("generation_jobs")
    .select(
      `id, title, prompt, status, error_message, share_token, created_at, duration_seconds, ${rhythmJoin}, audio_assets(duration_seconds)`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (rhythmSlug) query = query.eq("rhythms.slug", rhythmSlug);
  if (limit) query = query.limit(limit);

  const { data } = await query;
  return ((data as unknown as TrackRow[] | null) ?? []).map(toTrack);
}
