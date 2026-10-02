import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const baseUrl = process.env.TEST_BASE_URL ?? "http://localhost:3000";

const admin = createClient(url, serviceKey);
const createdUserIds: string[] = [];

async function signUpAndSignIn(email: string) {
  const password = "correct horse battery staple 1!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser returned no user");
  createdUserIds.push(data.user.id);
  const client = createClient(url, anonKey);
  const { data: signIn } = await client.auth.signInWithPassword({ email, password });
  return { userId: data.user.id, accessToken: signIn.session!.access_token };
}

describe("GET /api/audio/:jobId", () => {
  afterAll(async () => {
    for (const id of createdUserIds) {
      await admin.auth.admin.deleteUser(id);
    }
  });

  it("returns 404 for a job that does not belong to the requester", async () => {
    const owner = await signUpAndSignIn(`owner-${Date.now()}@example.test`);
    const stranger = await signUpAndSignIn(`stranger-${Date.now()}@example.test`);

    const { data: rhythm } = await admin.from("rhythms").select("id").eq("slug", "zinli").single();
    const { data: job } = await admin
      .from("generation_jobs")
      .insert({
        user_id: owner.userId,
        rhythm_id: rhythm!.id,
        prompt: "p",
        duration_seconds: 15,
        status: "completed",
        idempotency_key: `audio-route-test-${Date.now()}`,
      })
      .select("id")
      .single();
    await admin.from("audio_assets").insert({
      generation_job_id: job!.id,
      storage_path: `${owner.userId}/${job!.id}.wav`,
      format: "wav",
      duration_seconds: 15,
      sample_rate: 44100,
      file_size_bytes: 100,
    });

    const res = await fetch(`${baseUrl}/api/audio/${job!.id}`, {
      redirect: "manual",
      headers: { authorization: `Bearer ${stranger.accessToken}` },
    });
    expect(res.status).toBe(404);
  });
});
