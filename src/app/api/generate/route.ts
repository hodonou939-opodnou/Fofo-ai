import { NextResponse, after } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/generation/rate-limit";
import { getProvider } from "@/lib/generation/get-provider";
import { buildPrompt } from "@/lib/generation/build-prompt";

const VALID_DURATIONS = [15, 30, 60];

export async function POST(request: Request) {
  // Cookie-based sessions (browser/Studio UI) use the cookie-bound server
  // client. A Bearer token (server-to-server calls, integration tests) gets
  // its own client with that token set as the Authorization header on every
  // request, so RLS sees the right auth.uid() for inserts/selects below —
  // supabase.auth.getUser(token) alone only validates the token, it does not
  // make later .from() calls act as that user.
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

  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body.rhythmSlug !== "string" ||
    typeof body.prompt !== "string" ||
    body.prompt.trim().length === 0 ||
    typeof body.mood !== "string" ||
    typeof body.energy !== "string" ||
    !VALID_DURATIONS.includes(body.durationSeconds)
  ) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { data: rhythm } = await supabase
    .from("rhythms")
    .select("id, name")
    .eq("slug", body.rhythmSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!rhythm) {
    return NextResponse.json({ error: "rhythm_not_found" }, { status: 404 });
  }

  const { allowed } = await checkRateLimit(supabase, user.id);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const idempotencyKey = createHash("sha256")
    .update(
      [user.id, rhythm.id, body.prompt, body.mood, body.energy, body.durationSeconds].join(":")
    )
    .digest("hex");

  const { data: inserted } = await supabase
    .from("generation_jobs")
    .insert({
      user_id: user.id,
      rhythm_id: rhythm.id,
      prompt: body.prompt,
      mood: body.mood,
      energy: body.energy,
      duration_seconds: body.durationSeconds,
      status: "queued",
      idempotency_key: idempotencyKey,
    })
    .select("id")
    .maybeSingle();

  let jobId = inserted?.id;
  if (!jobId) {
    const { data: existing } = await supabase
      .from("generation_jobs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    jobId = existing?.id;
  }
  if (!jobId) {
    return NextResponse.json({ error: "job_creation_failed" }, { status: 500 });
  }

  // Only run the background work for a job we just created (not one returned
  // by the idempotency fast-path above, which is already queued/processing).
  if (inserted?.id === jobId) {
    const provider = getProvider();
    if (!provider) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error_message: "Service de génération non configuré." })
        .eq("id", jobId);
    } else {
      const finalPrompt = buildPrompt({
        rhythmName: rhythm.name,
        userIdea: body.prompt,
        mood: body.mood,
        energy: body.energy,
      });
      after(async () => {
        await supabase
          .from("generation_jobs")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", jobId);

        const result = await provider.generate({
          prompt: finalPrompt,
          durationSeconds: body.durationSeconds,
        });

        if (!result.ok) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_message: result.errorMessage,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return;
        }

        const storagePath = `${user.id}/${jobId}.${result.format}`;
        const { error: uploadError } = await supabase.storage
          .from("generations")
          .upload(storagePath, result.audio, {
            contentType: result.format === "mp3" ? "audio/mpeg" : "audio/wav",
          });

        if (uploadError) {
          await supabase
            .from("generation_jobs")
            .update({
              status: "failed",
              error_message: `Échec du stockage audio: ${uploadError.message}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", jobId);
          return;
        }

        await supabase.from("audio_assets").insert({
          generation_job_id: jobId,
          storage_path: storagePath,
          format: result.format,
          duration_seconds: body.durationSeconds,
          sample_rate: result.sampleRate,
          file_size_bytes: result.audio.length,
        });

        await supabase
          .from("generation_jobs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        await supabase.from("usage_records").insert({
          user_id: user.id,
          generation_job_id: jobId,
          estimated_cost: 0,
        });
      });
    }
  }

  return NextResponse.json({ jobId }, { status: 201 });
}

export const maxDuration = 120;
