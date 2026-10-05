import { NextResponse, after } from "next/server";
import { createRouteSupabaseClient } from "@/lib/supabase/route";
import { getProvider } from "@/lib/generation/get-provider";
import { buildPrompt } from "@/lib/generation/build-prompt";
import { parseGenerateRequest } from "@/lib/generation/generate-request";
import { computeIdempotencyKey } from "@/lib/generation/idempotency";
import { MAX_GENERATIONS_PER_HOUR, RATE_LIMIT_EXCEEDED_CODE } from "@/lib/generation/rate-limit";
import { processGenerationJob } from "@/lib/generation/process-job";

export async function POST(request: Request) {
  const provider = getProvider();

  // Outside production every response names the active provider, so the
  // test suites can refuse to run against a server that would spend real
  // provider credits (assertMockProvider in tests/integration/generation-helpers.ts).
  const respond = (body: Record<string, unknown>, status: number) => {
    const response = NextResponse.json(body, { status });
    if (process.env.NODE_ENV !== "production") {
      response.headers.set("x-generation-provider", provider?.name ?? "none");
    }
    return response;
  };

  const supabase = await createRouteSupabaseClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return respond({ error: "unauthenticated" }, 401);
  }

  const input = parseGenerateRequest(await request.json().catch(() => null));
  if (!input) {
    return respond({ error: "invalid_request" }, 400);
  }

  // Before any database work: an unconfigured service creates no job row and
  // uses no rate-limit quota.
  if (!provider) {
    return respond({ error: "service_unavailable" }, 503);
  }

  const { data: rhythm } = await supabase
    .from("rhythms")
    .select("id, name")
    .eq("slug", input.rhythmSlug)
    .eq("status", "published")
    .maybeSingle();
  if (!rhythm) {
    return respond({ error: "rhythm_not_found" }, 404);
  }

  // Atomic per user: idempotency lookup, then the hourly limit, then insert.
  const { data: job, error } = await supabase
    .rpc("create_generation_job", {
      p_rhythm_id: rhythm.id,
      p_prompt: input.prompt,
      p_mood: input.mood,
      p_energy: input.energy,
      p_duration_seconds: input.durationSeconds,
      p_provider: provider.name,
      p_idempotency_key: computeIdempotencyKey({
        userId: user.id,
        submissionId: input.submissionId,
        rhythmId: rhythm.id,
        prompt: input.prompt,
        mood: input.mood,
        energy: input.energy,
        durationSeconds: input.durationSeconds,
      }),
      p_max_per_hour: MAX_GENERATIONS_PER_HOUR,
    })
    .single<{ job_id: string; created: boolean }>();

  if (error?.code === RATE_LIMIT_EXCEEDED_CODE) {
    return respond({ error: "rate_limited" }, 429);
  }
  if (error || !job) {
    console.error("[generate] job creation failed", error);
    return respond({ error: "job_creation_failed" }, 500);
  }

  // Only the request that created the job runs it: a retried submission gets
  // the existing job back and never triggers a second provider call.
  if (job.created) {
    const prompt = buildPrompt({
      rhythmName: rhythm.name,
      userIdea: input.prompt,
      mood: input.mood,
      energy: input.energy,
    });
    after(() =>
      processGenerationJob({
        supabase,
        provider,
        job: { id: job.job_id, userId: user.id, prompt, durationSeconds: input.durationSeconds },
      })
    );
  }

  return respond({ jobId: job.job_id }, 201);
}

// The worker runs inside this budget: two 45 s provider attempts plus the 2 s
// retry backoff, then the upload. Must stay a literal (Next reads it statically).
export const maxDuration = 120;
