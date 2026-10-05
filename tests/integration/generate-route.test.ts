import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GENERATION_FAILURE_MESSAGES } from "@/lib/generation/failure-messages";
import { MAX_GENERATIONS_PER_HOUR } from "@/lib/generation/rate-limit";
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
const createdJobIds: string[] = [];

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
  return { client, userId: data.user.id, accessToken: signIn.session!.access_token };
}

afterAll(async () => {
  for (const id of createdJobIds) {
    await admin.from("generation_jobs").delete().eq("id", id);
  }
  for (const id of createdUserIds) {
    await admin.auth.admin.deleteUser(id);
  }
});

describe("POST /api/generate", () => {
  let accessToken: string;

  beforeAll(async () => {
    await assertMockProvider();
    const { accessToken: token } = await signUpAndSignIn(`gen-${Date.now()}@example.test`);
    accessToken = token;
  });

  it("creates a queued job for a valid request, recording the provider that runs it", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "zinli",
      prompt: "a calm evening song",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.jobId).toBeTruthy();
    createdJobIds.push(body.jobId);

    const { data: job } = await admin
      .from("generation_jobs")
      .select("provider")
      .eq("id", body.jobId)
      .single();
    expect(job?.provider).toBe("mock");
  });

  it("rejects an unknown rhythm slug", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "does-not-exist",
      prompt: "x",
      mood: "Paisible",
      energy: "Modérée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(404);
  });

  it("rejects a request without a submission id", async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        rhythmSlug: "zinli",
        prompt: "x",
        mood: "Paisible",
        energy: "Modérée",
        durationSeconds: 15,
      }),
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_request" });
  });

  it("rejects an unauthenticated request", async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        rhythmSlug: "zinli",
        prompt: "x",
        mood: "Paisible",
        energy: "Modérée",
        durationSeconds: 15,
        submissionId: randomUUID(),
      }),
    });
    expect(res.status).toBe(401);
  });

  it("returns the same job id when the same submission is retried (idempotency)", async () => {
    const body = {
      rhythmSlug: "toba",
      prompt: "idempotency-check-prompt",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
      submissionId: randomUUID(),
    };
    const first = await postGenerate(accessToken, body);
    const second = await postGenerate(accessToken, body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    const firstJson = await first.json();
    const secondJson = await second.json();
    createdJobIds.push(firstJson.jobId);
    expect(secondJson.jobId).toBe(firstJson.jobId);
  });

  it("creates a new job for a new submission with identical parameters", async () => {
    const body = {
      rhythmSlug: "toba",
      prompt: "second-take-prompt",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
    };
    const first = await (await postGenerate(accessToken, body)).json();
    const second = await (await postGenerate(accessToken, body)).json();
    createdJobIds.push(first.jobId, second.jobId);
    expect(second.jobId).not.toBe(first.jobId);
  });

  it("processes the job in the background to completion with a stored audio asset", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "tchinkounme",
      prompt: "a festive instrumental",
      mood: "Festif",
      energy: "Élevée",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const { jobId } = await res.json();
    createdJobIds.push(jobId);

    const job = await waitForTerminalJob(admin, jobId);

    expect(job?.status).toBe("completed");
    const { data: asset } = await admin
      .from("audio_assets")
      .select("storage_path, file_size_bytes")
      .eq("generation_job_id", jobId)
      .maybeSingle();
    expect(asset).not.toBeNull();
    expect(asset!.storage_path).toContain(jobId);

    const { data: stored, error } = await admin.storage
      .from("generations")
      .download(asset!.storage_path);
    expect(error).toBeNull();
    expect(stored!.size).toBeGreaterThan(0);
    expect(stored!.size).toBe(Number(asset!.file_size_bytes));
  }, 15000);

  it("marks the job failed with a French, provider-free message when the provider fails", async () => {
    const res = await postGenerate(accessToken, {
      rhythmSlug: "toba",
      prompt: "FORCE_FAIL please",
      mood: "Paisible",
      energy: "Faible",
      durationSeconds: 15,
    });
    expect(res.status).toBe(201);
    const { jobId } = await res.json();
    createdJobIds.push(jobId);

    const job = await waitForTerminalJob(admin, jobId);

    expect(job?.status).toBe("failed");
    expect(job?.error_message).toBe(GENERATION_FAILURE_MESSAGES.unavailable);
  }, 15000);
});

describe("POST /api/generate rate limit", () => {
  it("returns 429 past the hourly limit, but still answers a retry of an existing submission", async () => {
    await assertMockProvider();
    const { userId, accessToken } = await signUpAndSignIn(`rate-${Date.now()}@example.test`);
    const submission = {
      rhythmSlug: "zinli",
      prompt: "rate-limit-check",
      mood: "Paisible",
      energy: "Faible",
      durationSeconds: 15,
      submissionId: randomUUID(),
    };

    const first = await postGenerate(accessToken, submission);
    expect(first.status).toBe(201);
    const { jobId } = await first.json();

    const { data: rhythm } = await admin.from("rhythms").select("id").eq("slug", "zinli").single();
    const { error } = await admin.from("generation_jobs").insert(
      Array.from({ length: MAX_GENERATIONS_PER_HOUR - 1 }, (_, i) => ({
        user_id: userId,
        rhythm_id: rhythm!.id,
        prompt: "filler",
        duration_seconds: 15,
        status: "failed",
        idempotency_key: `rate-limit-filler-${userId}-${i}`,
      }))
    );
    expect(error).toBeNull();

    const retry = await postGenerate(accessToken, submission);
    expect(retry.status).toBe(201);
    expect((await retry.json()).jobId).toBe(jobId);

    const fresh = await postGenerate(accessToken, { ...submission, submissionId: randomUUID() });
    expect(fresh.status).toBe(429);
    expect(await fresh.json()).toEqual({ error: "rate_limited" });
  }, 15000);
});
