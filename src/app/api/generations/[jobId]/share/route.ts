import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { statusForRpcError } from "@/lib/supabase/rpc-errors";
import { publishSharedCopy, removeSharedCopy } from "@/lib/tracks/share-copy";

async function setSharing(supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>, jobId: string, enabled: boolean) {
  return supabase.rpc("set_generation_job_sharing", { p_job_id: jobId, p_enabled: enabled });
}

// Turn sharing on or off for one of the user's finished creations
// (set_generation_job_sharing, 0006) and keep its one public copy (0007) in
// step: published when sharing starts, removed before it stops.
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createRouteSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const enabled = body?.enabled === true;

  if (!enabled) {
    // Remove the public copy first: if that fails, keep sharing on rather than
    // leaving a reachable copy behind a link the owner believes is dead.
    const { error: removeError } = await removeSharedCopy(supabase, jobId);
    if (removeError) {
      console.error("removing a shared copy failed", removeError);
      return NextResponse.json({ error: "unshare_failed" }, { status: 500 });
    }
  }

  const { data: token, error } = await setSharing(supabase, jobId, enabled);
  if (error) {
    const status = statusForRpcError(error);
    if (status === 500) console.error("set_generation_job_sharing failed", error);
    return NextResponse.json({ error: status === 409 ? "not_shareable" : "not_found" }, { status });
  }

  const shareToken = typeof token === "string" ? token : null;
  if (enabled && shareToken) {
    const { error: publishError } = await publishSharedCopy(supabase, jobId, shareToken);
    if (publishError) {
      console.error("publishing a shared copy failed", publishError);
      await setSharing(supabase, jobId, false);
      return NextResponse.json({ error: "share_failed" }, { status: 500 });
    }
  }

  const url = shareToken ? `${new URL(request.url).origin}/t/${shareToken}` : null;
  return NextResponse.json({ shareToken, url });
}
