import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { statusForRpcError } from "@/lib/supabase/rpc-errors";

// Turn sharing on or off for one of the user's finished creations
// (set_generation_job_sharing, migration 0006). The link lives on this site.
export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const supabase = await createRouteSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const enabled = body?.enabled === true;

  const { data: token, error } = await supabase.rpc("set_generation_job_sharing", {
    p_job_id: jobId,
    p_enabled: enabled,
  });
  if (error) {
    const status = statusForRpcError(error);
    if (status === 500) console.error("set_generation_job_sharing failed", error);
    return NextResponse.json({ error: status === 409 ? "not_shareable" : "not_found" }, { status });
  }

  const shareToken = typeof token === "string" ? token : null;
  const url = shareToken ? `${new URL(request.url).origin}/t/${shareToken}` : null;
  return NextResponse.json({ shareToken, url });
}
