import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { statusForRpcError } from "@/lib/supabase/rpc-errors";
import { removeSharedCopy } from "@/lib/tracks/share-copy";

type Params = { params: Promise<{ jobId: string }> };

async function signedIn(request: Request) {
  const supabase = await createRouteSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

// Rename one of the user's creations (rename_generation_job, migration 0006).
export async function PATCH(request: Request, { params }: Params) {
  const { jobId } = await params;
  const { supabase, user } = await signedIn(request);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title.trim() : "";

  const { error } = await supabase.rpc("rename_generation_job", { p_job_id: jobId, p_title: title });
  if (error) {
    const status = statusForRpcError(error);
    if (status === 500) console.error("rename_generation_job failed", error);
    return NextResponse.json({ error: status === 400 ? "invalid_title" : "not_found" }, { status });
  }
  return NextResponse.json({ title });
}

// Delete one of the user's creations: the row is soft-deleted (so the hourly
// limit can't be dodged) and its audio file is removed from storage.
export async function DELETE(request: Request, { params }: Params) {
  const { jobId } = await params;
  const { supabase, user } = await signedIn(request);
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  // A shared track's public copy goes first, while its token still proves
  // ownership; if that fails, nothing is deleted.
  const { error: copyError } = await removeSharedCopy(supabase, jobId);
  if (copyError) {
    console.error("removing a deleted track's shared copy failed", copyError);
    return NextResponse.json({ error: "delete_failed" }, { status: 500 });
  }

  const { data: storagePath, error } = await supabase.rpc("delete_generation_job", { p_job_id: jobId });
  if (error) {
    const status = statusForRpcError(error);
    if (status === 500) console.error("delete_generation_job failed", error);
    return NextResponse.json({ error: status === 409 ? "not_deletable" : "not_found" }, { status });
  }

  if (typeof storagePath === "string") {
    const { error: removeError } = await supabase.storage.from("generations").remove([storagePath]);
    // The job is already gone for the user; an orphaned file only costs space.
    if (removeError) console.error("removing a deleted track's audio failed", removeError);
  }
  return new NextResponse(null, { status: 204 });
}
