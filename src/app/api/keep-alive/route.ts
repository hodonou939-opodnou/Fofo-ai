import { NextResponse } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";

// Supabase's free plan pauses a project after about a week without activity
// (2026-11-05: the live site lost sign-in, generation and the rhythm pages).
// Vercel calls this once a day (vercel.json "crons"); one read of public data
// is enough activity. It reveals nothing beyond what /rythmes already shows.
export async function GET(request: Request) {
  try {
    const supabase = await createRouteSupabaseClient(request);
    const { error } = await supabase.from("rhythms").select("id").eq("status", "published").limit(1);
    if (error) {
      console.error(`[keep-alive] database read failed: ${error.message}`);
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[keep-alive] database read failed", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
