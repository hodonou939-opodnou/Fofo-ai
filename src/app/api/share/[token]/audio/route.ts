import { NextResponse } from "next/server";
import { createAnonSupabaseClient, getSharedTrack } from "@/lib/tracks/shared";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

// Streams (or, with ?download=1, downloads) a shared track for anyone holding
// its link: a short-lived signed URL, allowed by the "read shared" storage
// policy only while the track is shared and not deleted.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const track = await getSharedTrack(token);
  if (!track) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  const { data: signed, error } = await createAnonSupabaseClient()
    .storage.from("generations")
    .createSignedUrl(
      track.storagePath,
      SIGNED_URL_TTL_SECONDS,
      download ? { download: `fofo-${token}.${track.format}` } : undefined
    );
  if (error || !signed) {
    console.error("signing a shared track failed", error);
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
