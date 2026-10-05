import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Redirects the owner of a completed job to a short-lived signed URL for its
// audio. `?download=1` signs an attachment URL instead, so "Télécharger"
// saves the file rather than playing it in a tab (a cross-origin redirect
// makes the browser ignore <a download>).
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createRouteSupabaseClient(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: asset } = await supabase
    .from("audio_assets")
    .select("storage_path, format, generation_jobs!inner(user_id)")
    .eq("generation_job_id", jobId)
    .maybeSingle();

  if (!asset || (asset.generation_jobs as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data: signed, error } = await supabase.storage
    .from("generations")
    .createSignedUrl(
      asset.storage_path,
      SIGNED_URL_TTL_SECONDS,
      download ? { download: `fofo-${jobId}.${asset.format}` } : undefined
    );

  if (error || !signed) {
    return NextResponse.json({ error: "signing_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
