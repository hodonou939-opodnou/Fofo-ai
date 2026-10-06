import type { SupabaseClient } from "@supabase/supabase-js";

// The one public copy of a shared track (migration 0007): a file named
// <share_token>.<ext> in the "shared" bucket, which nobody can list. Written
// and removed by the owner's own session — never with the service-role key.

const SHARED_BUCKET = "shared";
// Short CDN lifetime, so a copy removed on "Arrêter le partage" disappears fast.
const SHARED_CACHE_SECONDS = "60";

type Asset = { storage_path: string; format: string };

async function assetOf(supabase: SupabaseClient, jobId: string): Promise<Asset | null> {
  const { data } = await supabase
    .from("audio_assets")
    .select("storage_path, format")
    .eq("generation_job_id", jobId)
    .maybeSingle();
  return (data as Asset | null) ?? null;
}

export function sharedObjectName(token: string, format: string) {
  return `${token}.${format}`;
}

// Copies the private audio to the shared bucket under the share token.
export async function publishSharedCopy(supabase: SupabaseClient, jobId: string, token: string) {
  const asset = await assetOf(supabase, jobId);
  if (!asset) return { error: new Error("no audio asset for this job") };

  const { data: file, error: downloadError } = await supabase.storage.from("generations").download(asset.storage_path);
  if (downloadError || !file) return { error: downloadError ?? new Error("empty download") };

  const { error } = await supabase.storage
    .from(SHARED_BUCKET)
    .upload(sharedObjectName(token, asset.format), file, {
      contentType: asset.format === "mp3" ? "audio/mpeg" : "audio/wav",
      cacheControl: SHARED_CACHE_SECONDS,
      upsert: false,
    });
  // Re-sharing reuses the same token: an existing copy is already right.
  if (error && !/exists|duplicate/i.test(error.message)) return { error };
  return { error: null };
}

// Removes the public copy of a job's live share, if any. Must run BEFORE the
// token is cleared: the storage policy recognises the owner through it.
export async function removeSharedCopy(supabase: SupabaseClient, jobId: string) {
  const { data: job } = await supabase.from("generation_jobs").select("share_token").eq("id", jobId).maybeSingle();
  const token = (job as { share_token: string | null } | null)?.share_token;
  if (!token) return { error: null };
  const asset = await assetOf(supabase, jobId);
  if (!asset) return { error: null };
  const { error } = await supabase.storage.from(SHARED_BUCKET).remove([sharedObjectName(token, asset.format)]);
  return { error };
}

export function publicSharedUrl(supabase: SupabaseClient, token: string, format: string, download: boolean) {
  const name = sharedObjectName(token, format);
  return supabase.storage.from(SHARED_BUCKET).getPublicUrl(name, download ? { download: `fofo-${name}` } : undefined).data
    .publicUrl;
}
