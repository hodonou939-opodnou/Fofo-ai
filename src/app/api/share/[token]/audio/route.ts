import { NextResponse } from "next/server";
import { publicSharedUrl } from "@/lib/tracks/share-copy";
import { createAnonSupabaseClient, getSharedTrack } from "@/lib/tracks/shared";

// Sends a listener holding a live share link to the track's public copy
// (?download=1 → as an attachment). The copy is named by the token only and
// cannot be listed; anything malformed, unshared or deleted is a 404.
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const track = await getSharedTrack(token);
  if (!track) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const download = new URL(request.url).searchParams.get("download") === "1";
  return NextResponse.redirect(publicSharedUrl(createAnonSupabaseClient(), token, track.format, download));
}
