import { createClient } from "@supabase/supabase-js";

// Public, by-token access to one shared track (get_shared_track, migration
// 0007). Uses a plain anonymous client — no cookies — so a visitor and a
// member see exactly the same thing. The result carries no internal ids.

const SHARE_TOKEN = /^[0-9a-f]{24}$/;

export type SharedTrack = {
  token: string;
  title: string;
  rhythmName: string | null;
  rhythmSlug: string | null;
  durationSeconds: number;
  format: string;
  createdAt: string;
};

export function createAnonSupabaseClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export function isShareToken(token: string) {
  return SHARE_TOKEN.test(token);
}

type Row = {
  title: string | null;
  rhythm_name: string | null;
  rhythm_slug: string | null;
  duration_seconds: number;
  format: string;
  created_at: string;
};

export async function getSharedTrack(token: string): Promise<SharedTrack | null> {
  if (!isShareToken(token)) return null;
  const { data, error } = await createAnonSupabaseClient().rpc("get_shared_track", { p_token: token });
  if (error) {
    console.error("get_shared_track failed", error);
    return null;
  }
  const row = (data as Row[] | null)?.[0];
  if (!row) return null;
  return {
    token,
    title: row.title ?? "Création Fofo",
    rhythmName: row.rhythm_name,
    rhythmSlug: row.rhythm_slug,
    durationSeconds: Number(row.duration_seconds),
    format: row.format,
    createdAt: row.created_at,
  };
}
