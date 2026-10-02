import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;

  // Same bearer-token-aware client pattern as /api/generate: a Bearer token
  // (tests, server-to-server) gets its own client with the token applied to
  // every request so RLS sees the right auth.uid(); cookie sessions
  // (browser/Studio UI) use the cookie-bound server client.
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

  const supabase = bearerToken
    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${bearerToken}` } },
      })
    : await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: asset } = await supabase
    .from("audio_assets")
    .select("storage_path, generation_jobs!inner(user_id)")
    .eq("generation_job_id", jobId)
    .maybeSingle();

  if (!asset || (asset.generation_jobs as unknown as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage
    .from("generations")
    .createSignedUrl(asset.storage_path, 60 * 60);

  if (error || !signed) {
    return NextResponse.json({ error: "signing_failed" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
