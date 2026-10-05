import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  assertMockProvider,
  baseUrl,
  postGenerate,
  waitForTerminalJob,
} from "./generation-helpers";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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

  it("redirects the owner to a signed URL that serves the audio, and to an attachment for download", async () => {
    await assertMockProvider();
    const owner = await signUpAndSignIn(`listener-${Date.now()}@example.test`);
    const created = await postGenerate(owner.accessToken, {
      rhythmSlug: "zinli",
      prompt: "a song to play back",
      mood: "Paisible",
      energy: "Faible",
      durationSeconds: 15,
    });
    const { jobId } = await created.json();
    expect((await waitForTerminalJob(admin, jobId))?.status).toBe("completed");

    const play = await fetch(`${baseUrl}/api/audio/${jobId}`, {
      redirect: "manual",
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(play.status).toBe(307);
    const audio = await fetch(play.headers.get("location")!);
    expect(audio.status).toBe(200);
    expect(audio.headers.get("content-type")).toMatch(/^audio\//);
    expect((await audio.arrayBuffer()).byteLength).toBeGreaterThan(0);

    const download = await fetch(`${baseUrl}/api/audio/${jobId}?download=1`, {
      redirect: "manual",
      headers: { authorization: `Bearer ${owner.accessToken}` },
    });
    expect(download.status).toBe(307);
    const file = await fetch(download.headers.get("location")!);
    expect(file.status).toBe(200);
    expect(file.headers.get("content-disposition")).toMatch(/attachment/);
    expect(file.headers.get("content-disposition")).toContain(`fofo-${jobId}.wav`);
  }, 20000);
});
